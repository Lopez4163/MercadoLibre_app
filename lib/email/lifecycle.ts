import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma";
import { sendEmail } from "./mailer";

type LifecycleEmailInput = {
  userId: string;
  type: "welcome_signup" | "trial_started";
  dedupeKey: string;
  subject: string;
  text: string;
  html?: string;
};

type UserEmailTarget = {
  email: string;
  mlNickname: string | null;
};

function supportEmail() {
  return process.env.SUPPORT_EMAIL?.trim() || process.env.GMAIL_SMTP_USER?.trim() || "";
}

function displayName(user: UserEmailTarget) {
  return user.mlNickname?.trim() || "vendedor";
}

function isDeliverableEmail(email: string) {
  return !email.trim().toLowerCase().endsWith("@mercadolibre.local");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderParagraphs(lines: string[]) {
  return lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("\n");
}

async function sendLifecycleEmail(input: LifecycleEmailInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      email: true,
      mlNickname: true,
    },
  });

  if (!user?.email || !isDeliverableEmail(user.email)) {
    return { sent: false as const, reason: "missing_user_email" as const };
  }

  let delivery: { id: string };
  try {
    delivery = await prisma.emailDelivery.create({
      data: {
        userId: input.userId,
        type: input.type,
        dedupeKey: input.dedupeKey,
        recipient: user.email,
        subject: input.subject,
        status: "pending",
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { sent: false as const, reason: "duplicate" as const };
    }
    throw error;
  }

  try {
    const result = await sendEmail({
      to: user.email,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });

    await prisma.emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "sent",
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
      },
    });

    return { sent: true as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "failed",
        error: message.slice(0, 1000),
      },
    });

    console.error("[email] lifecycle email failed", {
      userId: input.userId,
      type: input.type,
      error,
    });

    return { sent: false as const, reason: "send_failed" as const };
  }
}

export async function sendWelcomeSignupEmail(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      email: true,
      mlNickname: true,
    },
  });

  if (!user) {
    return { sent: false as const, reason: "missing_user" as const };
  }

  const name = displayName(user);
  const subject = "Tu cuenta de MercadoLibs esta lista";
  const lines = [
    `Hola ${name},`,
    "Tu cuenta fue creada y ya esta vinculada con Mercado Libre.",
    "El siguiente paso es iniciar la prueba gratis y conectar Telegram para recibir alertas de ventas, bajo stock y etiquetas listas.",
    supportEmail() ? `Si necesitas ayuda, responde este correo o escribe a ${supportEmail()}.` : "Si necesitas ayuda, responde este correo.",
  ];

  return sendLifecycleEmail({
    userId,
    type: "welcome_signup",
    dedupeKey: "once",
    subject,
    text: lines.join("\n\n"),
    html: renderParagraphs(lines),
  });
}

export async function sendTrialStartedEmail(input: {
  userId: string;
  trialEnd?: Date | null;
  currentPeriodEnd?: Date | null;
}) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      email: true,
      mlNickname: true,
    },
  });

  if (!user) {
    return { sent: false as const, reason: "missing_user" as const };
  }

  const name = displayName(user);
  const accessEnd = input.trialEnd ?? input.currentPeriodEnd ?? null;
  const formattedEnd = accessEnd
    ? new Intl.DateTimeFormat("es-AR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }).format(accessEnd)
    : null;
  const subject = "Tu prueba de MercadoLibs esta activa";
  const lines = [
    `Hola ${name},`,
    formattedEnd
      ? `Tu prueba ya esta activa hasta el ${formattedEnd}.`
      : "Tu prueba ya esta activa.",
    "Durante la prueba puedes sincronizar inventario, revisar pedidos y recibir alertas por Telegram.",
    "Para aprovecharla, conecta Telegram desde la configuracion y revisa tus reglas de notificacion.",
    supportEmail() ? `Preguntas de facturacion: ${supportEmail()}.` : "Responde este correo si tienes preguntas de facturacion.",
  ];

  return sendLifecycleEmail({
    userId: input.userId,
    type: "trial_started",
    dedupeKey: "once",
    subject,
    text: lines.join("\n\n"),
    html: renderParagraphs(lines),
  });
}
