import { TOOL_NAMES } from "@finora/shared";
import { WewireClient } from "@finora/wewire";
import { Hono } from "hono";
import { cors } from "hono/cors";

type AppEnv = {
  Bindings: Env;
};

const app = new Hono<AppEnv>();

app.use("*", cors());

app.get("/", (c) =>
  c.json({
    name: "finora-api",
    status: "ok",
    tools: TOOL_NAMES,
  }),
);

app.get("/health", (c) => c.json({ ok: true }));

/**
 * Placeholder financial tool surface.
 * Mobile and MCP will call these; WeWire stays behind this API.
 */
app.get("/v1/balances", async (c) => {
  const apiKey = c.env.WEWIRE_API_KEY;
  if (!apiKey) {
    return c.json(
      {
        error: "WEWIRE_API_KEY not configured",
        balances: [],
      },
      503,
    );
  }

  const wewire = new WewireClient({
    apiKey,
    environment: c.env.ENVIRONMENT === "production" ? "production" : "sandbox",
  });

  // Until auth + sub-customer mapping exists, return business wallets.
  const wallets = await wewire.listBusinessWallets();
  return c.json({ balances: wallets });
});

app.post("/v1/webhooks/wewire", async (c) => {
  // Signature verification + idempotent processing come next.
  const payload = await c.req.json();
  console.log("wewire webhook", payload);
  return c.json({ received: true });
});

export default app;
