export function getAppBaseUrl() {
  const configured = process.env.APP_BASE_URL ?? process.env.NEXTAUTH_URL;
  if (!configured) {
    throw new Error("Missing APP_BASE_URL or NEXTAUTH_URL.");
  }

  if (/^https:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured)) {
    return configured.replace(/^https:/i, "http:");
  }

  return configured;
}
