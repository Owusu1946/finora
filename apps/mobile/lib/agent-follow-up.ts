type ThreadAppender = {
  thread: {
    append: (message: {
      role?: 'assistant' | 'user' | 'system';
      content: { type: 'text'; text: string }[];
      startRun?: boolean;
    }) => void;
  };
};

/** Append a non-running assistant follow-up after a money action completes. */
export function appendAgentFollowUp(aui: ThreadAppender, text: string) {
  aui.thread.append({
    role: 'assistant',
    content: [{ type: 'text', text }],
    startRun: false,
  });
}

export function paymentSentFollowUp(
  payment: {
    amount: number;
    currency: string;
    recipientName: string;
    destination: { label: string };
  },
  transactionId?: string,
) {
  const amount = `${payment.currency} ${payment.amount.toLocaleString()}`;
  const tx = transactionId ? ` (ref ${transactionId})` : '';
  return (
    `Sent ${amount} to ${payment.recipientName} via ${payment.destination.label}${tx}. ` +
    `You can save them as a contact from the receipt card. ` +
    `What else do you want to do — check balances, receive money, or convert FX?`
  );
}

export function conversionDoneFollowUp(
  quote: {
    fromAmount: number;
    fromCurrency: string;
    toAmount: number;
    toCurrency: string;
    rate: number;
  },
  conversionId?: string,
) {
  const id = conversionId ? ` (ref ${conversionId})` : '';
  return (
    `Converted ${quote.fromAmount.toLocaleString()} ${quote.fromCurrency} → ` +
    `${quote.toAmount.toLocaleString()} ${quote.toCurrency} at ${quote.rate.toFixed(4)}${id}. ` +
    `What else do you want to do — send money, receive, or check balances?`
  );
}
