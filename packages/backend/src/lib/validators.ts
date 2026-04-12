import { z } from "zod";
import { FastifyRequest, FastifyReply } from "fastify";

export const registerSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  displayName: z.string().max(200).optional(),
});

export const loginSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const bookingSchema = z.object({
  startTime: z.string().datetime({ message: "startTime must be a valid ISO date" }),
  guestName: z.string().min(1, "Guest name is required").max(200, "Guest name too long"),
  guestEmail: z.string().email("Please provide a valid email address"),
  notes: z.string().max(1000, "Notes too long").optional(),
});

export function zodPreValidation<T>(schema: z.ZodSchema<T>) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
      const firstError = result.error.errors[0];
      return reply.code(400).send({ error: firstError.message });
    }
    (request as FastifyRequest & { validatedBody: T }).body = result.data as typeof request.body;
  };
}
