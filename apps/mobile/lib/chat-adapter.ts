import type { ChatModelAdapter } from "@assistant-ui/react-native";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Local mock model — streams reasoning + tool calls so CoT UI is visible. */
export const finoraChatAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const prompt =
      lastUser?.content
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join(" ") ?? "";

    const reasoning = `Understanding: "${prompt.slice(0, 80)}${
      prompt.length > 80 ? "…" : ""
    }"\nChecking account context and available wallets…`;

    yield {
      content: [{ type: "reasoning", text: reasoning }],
    };

    await wait(500);
    if (abortSignal.aborted) return;

    yield {
      content: [
        { type: "reasoning", text: reasoning },
        {
          type: "tool-call",
          toolCallId: "call_get_balances",
          toolName: "get_balances",
          args: {},
          argsText: "{}",
        },
      ],
    };

    await wait(600);
    if (abortSignal.aborted) return;

    yield {
      content: [
        { type: "reasoning", text: reasoning },
        {
          type: "tool-call",
          toolCallId: "call_get_balances",
          toolName: "get_balances",
          args: {},
          argsText: "{}",
          result: {
            wallets: [
              { currency: "USD", balance: "—" },
              { currency: "GHS", balance: "—" },
            ],
            note: "Connect WeWire to load live balances",
          },
        },
      ],
    };

    await wait(350);
    if (abortSignal.aborted) return;

    yield {
      content: [
        { type: "reasoning", text: reasoning },
        {
          type: "tool-call",
          toolCallId: "call_get_balances",
          toolName: "get_balances",
          args: {},
          argsText: "{}",
          result: {
            wallets: [
              { currency: "USD", balance: "—" },
              { currency: "GHS", balance: "—" },
            ],
            note: "Connect WeWire to load live balances",
          },
        },
        {
          type: "text",
          text: "I'm Finora — your financial OS. Connect WeWire and the Finora API to check balances, send money, and approve payments from chat.",
        },
      ],
    };
  },
};
