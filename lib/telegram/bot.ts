const TELEGRAM_API_BASE = "https://api.telegram.org";

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type SendMessageResult = {
  message_id: number;
};

type WebhookInfoResult = {
  url: string;
  pending_update_count: number;
};

function getTelegramBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN is not configured");
  }

  return token;
}

async function telegramRequest<T>(method: string, body?: Record<string, unknown>) {
  const token = getTelegramBotToken();
  const url = `${TELEGRAM_API_BASE}/bot${token}/${method}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    throw new Error(`Telegram API HTTP error (${response.status}) on ${method}`);
  }

  const data = (await response.json()) as TelegramApiResponse<T>;
  if (!data.ok || data.result === undefined) {
    throw new Error(`Telegram API failed on ${method}: ${data.description ?? "unknown error"}`);
  }

  return data.result;
}

export async function sendTelegramMessage(chatId: string, text: string) {
  return telegramRequest<SendMessageResult>("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
  });
}

export async function setTelegramWebhook(url: string, secretToken?: string) {
  return telegramRequest<boolean>("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message"],
  });
}

export async function getTelegramWebhookInfo() {
  return telegramRequest<WebhookInfoResult>("getWebhookInfo");
}

export async function deleteTelegramWebhook() {
  return telegramRequest<boolean>("deleteWebhook", {
    drop_pending_updates: false,
  });
}
