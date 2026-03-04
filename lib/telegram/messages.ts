export function buildTelegramConnectedMessage() {
  return [
    "MercadoLibs connected successfully.",
    "You will receive stock alerts here once notifications are enabled.",
  ].join("\n");
}

export function buildTelegramConnectionExpiredMessage() {
  return "Connection link expired. Please reconnect from the dashboard to generate a new link.";
}

export function buildTelegramTestPingMessage() {
  return [
    "Test alert from MercadoLibs.",
    "Telegram connection is active and ready for stock notifications.",
  ].join("\n");
}
