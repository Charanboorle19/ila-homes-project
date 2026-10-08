const COOKIE_NAME = "visitor_code";
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export function getVisitorCode(): string | undefined {
  if (typeof document === "undefined") return undefined;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${COOKIE_NAME}=`));

  return match ? decodeURIComponent(match.slice(COOKIE_NAME.length + 1)) : undefined;
}

export function setVisitorCode(code: string): void {
  if (typeof document === "undefined") return;

  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(
    code,
  )}; expires=${new Date(Date.now() + ONE_YEAR_IN_SECONDS * 1000).toUTCString()}; path=/; SameSite=Lax${secure}`;

  // Read back to confirm the browser actually stored it.
  const stored = getVisitorCode();

  if (stored) {
    console.log("[visitor] Cookie verified in document.cookie", {
      cookie: `${COOKIE_NAME}=${stored}`,
      expires_in_days: 365,
    });
  } else {
    console.warn(
      "[visitor] Cookie write was blocked. Check Secure/SameSite settings or browser cookie policy.",
      { attempted_value: code },
    );
  }
}