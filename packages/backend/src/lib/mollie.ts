import createMollieClient, { SequenceType } from "@mollie/api-client";
import { prisma } from "./prisma";

function getMollieClient() {
  if (!process.env.MOLLIE_API_KEY) {
    throw new Error("MOLLIE_API_KEY not configured");
  }
  return createMollieClient({ apiKey: process.env.MOLLIE_API_KEY });
}

const PLANS = {
  monthly: { amount: { currency: "EUR", value: "19.00" }, interval: "1 month", description: "Mein Kalender Monthly" },
  yearly: { amount: { currency: "EUR", value: "190.00" }, interval: "12 months", description: "Mein Kalender Yearly" },
} as const;

export async function getOrCreateCustomer(
  userId: string,
  email: string,
  name: string
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { mollieCustomerId: true },
  });

  if (user?.mollieCustomerId) {
    return user.mollieCustomerId;
  }

  const customer = await getMollieClient().customers.create({
    name,
    email,
    metadata: JSON.stringify({ userId }),
  });

  await prisma.user.update({
    where: { id: userId },
    data: { mollieCustomerId: customer.id },
  });

  return customer.id;
}

export async function createFirstPayment(
  customerId: string,
  plan: "monthly" | "yearly",
  redirectUrl: string,
  webhookUrl: string
) {
  const payment = await getMollieClient().customerPayments.create({
    customerId,
    amount: { currency: "EUR", value: "0.01" },
    description: `Mein Kalender – setup ${plan} subscription`,
    sequenceType: SequenceType.first,
    redirectUrl,
    webhookUrl,
    metadata: JSON.stringify({ plan }),
  });

  return {
    paymentId: payment.id,
    checkoutUrl: payment.getCheckoutUrl(),
  };
}

export async function createSubscription(
  customerId: string,
  plan: "monthly" | "yearly",
  webhookUrl: string
) {
  const planConfig = PLANS[plan];

  const subscription = await getMollieClient().customerSubscriptions.create({
    customerId,
    amount: planConfig.amount,
    interval: planConfig.interval,
    description: planConfig.description,
    webhookUrl,
  });

  return subscription;
}

export async function cancelSubscription(
  customerId: string,
  subscriptionId: string
) {
  await getMollieClient().customerSubscriptions.cancel(subscriptionId, {
    customerId,
  });
}

export async function getPayment(paymentId: string) {
  return getMollieClient().payments.get(paymentId);
}
