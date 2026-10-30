import AsyncStorage from '@react-native-async-storage/async-storage';

import { FX_RATES, INITIAL_WALLETS_DATA, type WalletItem } from '@/components/wallets/types';

import { isUserStorageKeyWritable, userStorageKey } from './session-storage';
import { serializeStorageMutation } from './storage-mutation';

/**
 * The user's wallet balances (demo balances until WeWire is live). Shared by
 * the Wallets screen and anything that spends from a wallet, such as card
 * funding, so a debit made in one place shows everywhere and survives restarts.
 */

const BASE_KEY = 'finora.wallet-balances.v1';
const key = () => userStorageKey(BASE_KEY);
const listeners = new Set<() => void>();

export class InsufficientFundsError extends Error {
  constructor(readonly wallet: WalletItem) {
    super(`Not enough in your ${wallet.name} wallet.`);
    this.name = 'InsufficientFundsError';
  }
}

function notify() {
  listeners.forEach((listener) => listener());
}

export function subscribeWallets(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function rateFor(currency: string) {
  return FX_RATES[currency] ?? 1;
}

function withBalance(wallet: WalletItem, balance: number): WalletItem {
  return { ...wallet, balance, usdEquivalent: balance * rateFor(wallet.currency) };
}

/** USD amount expressed in a wallet's own currency. */
export function usdInWalletCurrency(wallet: WalletItem, usd: number) {
  return usd / rateFor(wallet.currency);
}

/** `amount` in `currency`, expressed in the wallet's own currency (demo FX rates). */
export function amountInWalletCurrency(wallet: WalletItem, amount: number, currency: string) {
  if (currency === wallet.currency) return amount;
  return (amount * rateFor(currency)) / rateFor(wallet.currency);
}

/** Wallets with their stored balances; new users start from the demo balances. */
export async function listWallets(storageKey = key()): Promise<WalletItem[]> {
  const raw = await AsyncStorage.getItem(storageKey).catch(() => null);
  if (!raw) return INITIAL_WALLETS_DATA;
  try {
    const balances = JSON.parse(raw) as Record<string, number>;
    return INITIAL_WALLETS_DATA.map((wallet) =>
      typeof balances[wallet.id] === 'number' ? withBalance(wallet, balances[wallet.id]!) : wallet,
    );
  } catch {
    return INITIAL_WALLETS_DATA;
  }
}

export async function saveWallets(wallets: WalletItem[], storageKey = key()) {
  if (!isUserStorageKeyWritable(storageKey)) return;
  const balances = Object.fromEntries(wallets.map((wallet) => [wallet.id, wallet.balance]));
  await AsyncStorage.setItem(storageKey, JSON.stringify(balances)).catch(() => undefined);
  notify();
}

/**
 * Debit a USD amount from a wallet, converted to the wallet's currency.
 * Throws `InsufficientFundsError` without changing anything when it can't cover it.
 */
export async function debitWallet(walletId: string, usdAmount: number) {
  return debitWalletIn(walletId, usdAmount, 'USD');
}

/** Puts money back after a payment that failed after its debit. */
export async function creditWallet(walletId: string, amount: number) {
  const storageKey = key();
  return serializeStorageMutation(storageKey, async () => {
    const wallets = await listWallets(storageKey);
    await saveWallets(
      wallets.map((item) =>
        item.id === walletId ? withBalance(item, item.balance + amount) : item,
      ),
      storageKey,
    );
  });
}

/**
 * Debit `amount` in `currency` from a wallet, converted to the wallet's currency.
 * Throws `InsufficientFundsError` without changing anything when it can't cover it.
 */
export async function debitWalletIn(walletId: string, amountToPay: number, currency: string) {
  const storageKey = key();
  return serializeStorageMutation(storageKey, async () => {
    const wallets = await listWallets(storageKey);
    const wallet = wallets.find((item) => item.id === walletId);
    if (!wallet) throw new Error('That account is no longer available.');
    const amount = amountInWalletCurrency(wallet, amountToPay, currency);
    if (amount > wallet.balance) throw new InsufficientFundsError(wallet);
    const updated = withBalance(wallet, wallet.balance - amount);
    await saveWallets(
      wallets.map((item) => (item.id === walletId ? updated : item)),
      storageKey,
    );
    return { wallet: updated, amount };
  });
}
