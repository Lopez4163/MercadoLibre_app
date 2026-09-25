import nodemailer from "nodemailer";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendEmailResult = {
  providerMessageId: string | null;
};

function getRequiredEmailEnv(name: "EMAIL_FROM" | "GMAIL_SMTP_USER" | "GMAIL_SMTP_APP_PASSWORD") {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required email env var: ${name}`);
  }
  return value;
}

function getTransport() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: getRequiredEmailEnv("GMAIL_SMTP_USER"),
      pass: getRequiredEmailEnv("GMAIL_SMTP_APP_PASSWORD"),
    },
  });
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const response = await getTransport().sendMail({
    from: getRequiredEmailEnv("EMAIL_FROM"),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });

  return {
    providerMessageId: typeof response.messageId === "string" ? response.messageId : null,
  };
}
