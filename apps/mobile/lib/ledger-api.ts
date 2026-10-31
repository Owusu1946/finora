import {
  LedgerTransactionResponseSchema,
  LedgerTransactionsResponseSchema,
  LedgerWalletsResponseSchema,
  type FundWalletRequest,
  type ImportWalletsRequest,
} from '@finora/shared';

import { getApiUrl } from './api-url';
import { sessionToken } from './session-token';

const REQUEST_TIMEOUT_MS = 20_000;

/** A ledger request that failed; `code` is the API's error code when it sent one. */
export class LedgerApiError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'LedgerApiError';
  }
}

export async function ledgerRequest(path: string, init?: { method: string; body?: unknown }) {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new LedgerApiError('Finora is unavailable right now.');
  const token = await sessionToken();
  if (!token) throw new LedgerApiError('Your session is not ready. Try again.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${apiUrl}/v1${path}`, {
      method: init?.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const record = typeof payload === 'object' && payload !== null ? payload : {};
      const code =
        'errorCode' in record && typeof record.errorCode === 'string'
          ? record.errorCode
          : `request_failed_${response.status}`;
      throw new LedgerApiError(code, code, record as Record<string, unknown>);
    }
    return payload;
  } catch (error) {
    if (error instanceof LedgerApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new LedgerApiError('Finora took too long to answer. Try again.');
    }
    throw new LedgerApiError('Could not reach Finora. Check your connection.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchLedgerWallets() {
  return LedgerWalletsResponseSchema.parse(await ledgerRequest('/wallets'));
}

export async function importLedgerWallets(input: ImportWalletsRequest) {
  return LedgerWalletsResponseSchema.parse(
    await ledgerRequest('/wallets/import', { method: 'POST', body: input }),
  );
}

export async function fundLedgerWallet(walletId: string, input: FundWalletRequest) {
  const payload = await ledgerRequest(`/wallets/${encodeURIComponent(walletId)}/fund`, {
    method: 'POST',
    body: input,
  });
  return {
    ...LedgerWalletsResponseSchema.parse(payload),
    ...LedgerTransactionResponseSchema.parse(payload),
  };
}

export async function fetchLedgerTransactions(limit = 100) {
  return LedgerTransactionsResponseSchema.parse(await ledgerRequest(`/transactions?limit=${limit}`))
    .transactions;
}

export async function fetchLedgerTransaction(id: string) {
  return LedgerTransactionResponseSchema.parse(
    await ledgerRequest(`/transactions/${encodeURIComponent(id)}`),
  ).transaction;
}
