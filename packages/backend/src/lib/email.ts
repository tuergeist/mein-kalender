import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  if (!process.env.SMTP_HOST) throw new Error("SMTP_HOST not configured");
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    ...(process.env.SMTP_USER && {
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    }),
  });
  return transporter;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  icalEvent?: { method: string; content: string };
}): Promise<void> {
  const transport = getTransporter();
  const from = process.env.SMTP_FROM || "noreply@mein-kalender.link";

  await transport.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    ...(options.icalEvent && {
      icalEvent: {
        method: options.icalEvent.method,
        content: options.icalEvent.content,
      },
    }),
  });
}
