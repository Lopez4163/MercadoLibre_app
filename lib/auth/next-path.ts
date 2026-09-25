const ALLOWED_NEXT_PREFIXES = ["/dashboard", "/billing", "/connect/ml", "/start-trial"];

function hasAllowedPrefix(path: string) {
  return ALLOWED_NEXT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`));
}

export function normalizeNextPath(value: string | undefined | null) {
  if (!value) {
    return null;
  }

  if (!value.startsWith("/") || value.startsWith("//")) {
    return null;
  }

  if (value.includes("://")) {
    return null;
  }

  return hasAllowedPrefix(value) ? value : null;
}
