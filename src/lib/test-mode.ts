/**
 * Test mode utilities. Determines if "TEST" tools should be visible.
 * Visible only on dev or lovable.app preview/staging — NEVER on the production custom domain.
 */
export function isTestModeAvailable(): boolean {
  if (typeof window === "undefined") return false;
  if (import.meta.env.DEV) return true;
  const host = window.location.hostname;
  return host.includes("lovable.app") || host === "localhost";
}
