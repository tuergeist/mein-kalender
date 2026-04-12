import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate, AuthUser } from "../lib/auth";
import {
  getOrCreateCustomer,
  createFirstPayment,
  createSubscription,
  cancelSubscription,
  getPayment,
} from "../lib/mollie";

interface AuthenticatedRequest {
  user: AuthUser;
}

const WEBHOOK_URL = "https://app.mein-kalender.link/api/webhooks/mollie";
const REDIRECT_URL = "https://app.mein-kalender.link/settings/billing?status=success";

export async function billingRoutes(app: FastifyInstance) {
  // POST /api/checkout — start checkout flow
  app.post<{ Body: { plan: "monthly" | "yearly" } }>(
    "/api/checkout",
    { preHandler: authenticate },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;
      const { plan } = request.body;

      if (!plan || !["monthly", "yearly"].includes(plan)) {
        return reply.code(400).send({ error: "Plan must be 'monthly' or 'yearly'" });
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { email: true, displayName: true },
      });

      if (!dbUser) {
        return reply.code(404).send({ error: "User not found" });
      }

      const customerId = await getOrCreateCustomer(
        user.id,
        dbUser.email,
        dbUser.displayName || dbUser.email
      );

      const { checkoutUrl } = await createFirstPayment(
        customerId,
        plan,
        REDIRECT_URL,
        WEBHOOK_URL
      );

      return { checkoutUrl };
    }
  );

  // POST /api/webhooks/mollie — webhook handler (NO AUTH)
  app.post<{ Body: { id: string } }>(
    "/api/webhooks/mollie",
    { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { id: paymentId } = request.body;

      if (!paymentId || typeof paymentId !== "string") {
        return reply.code(400).send({ error: "Missing payment id" });
      }

      // Idempotency: skip if already processed
      const existing = await prisma.paymentEvent.findUnique({
        where: { paymentId },
      });
      if (existing) {
        app.log.info(`Webhook: payment ${paymentId} already processed, skipping`);
        return reply.code(200).send({ ok: true });
      }

      // Verify payment with Mollie API (rejects fake payment IDs)
      let payment;
      try {
        payment = await getPayment(paymentId);
      } catch (err) {
        app.log.error(`Webhook: failed to verify payment ${paymentId} with Mollie: ${err}`);
        return reply.code(200).send({ ok: true });
      }

      // Record the payment event for idempotency
      await prisma.paymentEvent.create({
        data: { paymentId, status: payment.status as string },
      });

      // Find user by mollieCustomerId
      const customerId =
        typeof payment.customerId === "string" ? payment.customerId : null;

      if (!customerId) {
        app.log.warn(`Webhook: payment ${paymentId} has no customerId`);
        return reply.code(200).send({ ok: true });
      }

      const user = await prisma.user.findFirst({
        where: { mollieCustomerId: customerId },
      });

      if (!user) {
        app.log.warn(`Webhook: no user found for customerId ${customerId}`);
        return reply.code(200).send({ ok: true });
      }

      // First payment completed — create the subscription
      if (
        payment.status === "paid" &&
        payment.sequenceType === "first"
      ) {
        const metadata = payment.metadata
          ? JSON.parse(payment.metadata as string)
          : null;
        const plan: "monthly" | "yearly" = metadata?.plan || "monthly";

        const subscription = await createSubscription(
          customerId,
          plan,
          WEBHOOK_URL
        );

        await prisma.user.update({
          where: { id: user.id },
          data: {
            subscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            subscriptionPlan: plan,
          },
        });

        app.log.info(
          `Created ${plan} subscription ${subscription.id} for user ${user.id}`
        );
        return reply.code(200).send({ ok: true });
      }

      // Recurring payment — update subscription status
      if (payment.subscriptionId) {
        const newStatus =
          payment.status === "paid" ? "active" : payment.status;

        await prisma.user.update({
          where: { id: user.id },
          data: { subscriptionStatus: newStatus },
        });

        app.log.info(
          `Updated subscription status to ${newStatus} for user ${user.id}`
        );
      }

      return reply.code(200).send({ ok: true });
    }
  );

  // GET /api/billing — get billing status
  app.get(
    "/api/billing",
    { preHandler: authenticate },
    async (request) => {
      const { user } = request as unknown as AuthenticatedRequest;

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: {
          subscriptionPlan: true,
          subscriptionStatus: true,
          trialEndsAt: true,
        },
      });

      if (!dbUser) {
        return { plan: null, status: null, trialEndsAt: null, isActive: false };
      }

      const trialActive = dbUser.trialEndsAt
        ? new Date() < dbUser.trialEndsAt
        : false;
      const subscriptionActive = dbUser.subscriptionStatus === "active";

      return {
        plan: dbUser.subscriptionPlan,
        status: dbUser.subscriptionStatus,
        trialEndsAt: dbUser.trialEndsAt?.toISOString() ?? null,
        isActive: trialActive || subscriptionActive,
      };
    }
  );

  // POST /api/billing/cancel — cancel subscription
  app.post(
    "/api/billing/cancel",
    { preHandler: authenticate },
    async (request, reply) => {
      const { user } = request as unknown as AuthenticatedRequest;

      const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { mollieCustomerId: true, subscriptionId: true },
      });

      if (!dbUser?.mollieCustomerId || !dbUser?.subscriptionId) {
        return reply.code(400).send({ error: "No active subscription" });
      }

      await cancelSubscription(dbUser.mollieCustomerId, dbUser.subscriptionId);

      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: "cancelled" },
      });

      return { status: "cancelled" };
    }
  );
}
