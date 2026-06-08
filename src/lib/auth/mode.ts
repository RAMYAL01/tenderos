/**
 * Auth-mode switch (server-side only). Lets server components render the right
 * auth UI without importing the heavy OIDC/Clerk modules.
 *
 *   AUTH_PROVIDER = "clerk" (default, cloud) | "oidc" (on-prem Keycloak)
 *
 * Do NOT import this from a Client Component — `process.env.AUTH_PROVIDER` is a
 * server var and would read as undefined in the browser.
 */
export function isOidcAuth(): boolean {
  return process.env.AUTH_PROVIDER === "oidc";
}
