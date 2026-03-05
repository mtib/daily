import type { Context, Next } from "hono";

export async function authMiddleware(c: Context, next: Next) {
  const user =
    c.req.header("Tailscale-User") ??
    c.req.header("X-Webauth-User") ??
    (process.env.NODE_ENV !== "production" ? "dev-user" : null);

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", user);
  await next();
}
