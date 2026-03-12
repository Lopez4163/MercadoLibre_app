import {
  isLikelyTransientNetworkError,
  isRetryableHttpStatus,
  RetryableRequestError,
  withRetry,
} from "../utils/retry";

const TELEGRAM_API_BASE = "https://api.telegram.org";

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
};

type SendMessageResult = {
  message_id: number;
};

export type TelegramInlineButton = {
  text: string;
  url: string;
};

type TelegramSendMessageOptions = {
  inlineButtons?: TelegramInlineButton[];
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

  return withRetry(
    async () => {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const message = `Telegram API HTTP error (${response.status}) on ${method}`;
        if (isRetryableHttpStatus(response.status)) {
          throw new RetryableRequestError(message);
        }
        throw new Error(message);
      }

      const data = (await response.json()) as TelegramApiResponse<T>;
      if (!data.ok || data.result === undefined) {
        const message = `Telegram API failed on ${method}: ${data.description ?? "unknown error"}`;
        if (data.error_code === 429) {
          throw new RetryableRequestError(message);
        }

        throw new Error(message);
      }

      return data.result;
    },
    {
      shouldRetry: (error) =>
        error instanceof RetryableRequestError || isLikelyTransientNetworkError(error),
    },
  );
}

export async function sendTelegramMessage(
  chatId: string,
  text: string,
  options?: TelegramSendMessageOptions,
) {
  const inlineButtons = options?.inlineButtons?.filter(
    (button) => button.text.trim().length > 0 && button.url.trim().length > 0,
  );

  return telegramRequest<SendMessageResult>("sendMessage", {
    chat_id: chatId,
    text,
    disable_web_page_preview: true,
    reply_markup:
      inlineButtons && inlineButtons.length > 0
        ? {
            inline_keyboard: [inlineButtons.map((button) => ({ text: button.text, url: button.url }))],
          }
        : undefined,
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
