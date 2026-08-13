import type { ReactNode } from 'react';

import { PreviewIcon } from './preview-icon';
import styles from './product-preview.module.css';

export type PreviewDensity = 'full' | 'compact';

export function ProductPreviewFrame({
  children,
  density = 'full',
  label,
  decorative = false,
  className = '',
}: {
  children: ReactNode;
  density?: PreviewDensity;
  label: string;
  decorative?: boolean;
  className?: string;
}) {
  const accessibility = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img', 'aria-label': `${label}. Illustrative UI using demo data.` };

  return (
    <div
      {...accessibility}
      className={`${styles.frame} ${density === 'compact' ? styles.compact : styles.full} ${className}`}
    >
      {children}
    </div>
  );
}

export function MobileHeader({
  account,
  title,
}: {
  account?: 'Business' | 'Personal';
  title?: string;
}) {
  return (
    <div className={styles.mobileHeader}>
      <span className={styles.roundIcon}>
        <PreviewIcon name='menu' />
      </span>
      <span className={styles.headerCenter}>
        {title && <strong>{title}</strong>}
        {account && (
          <span className={styles.accountBadge}>
            <i />
            {account}
          </span>
        )}
      </span>
      <span className={styles.headerActions}>
        <span className={styles.roundIcon}>
          <PreviewIcon name='qr' />
        </span>
        <span className={styles.roundIcon}>
          <PreviewIcon name='message' />
        </span>
      </span>
    </div>
  );
}

export function Composer() {
  return (
    <div className={styles.composer}>
      <span className={styles.composerText}>Ask Finora… use @ to tag</span>
      <span className={styles.composerTools}>
        <PreviewIcon name='add' />
        <PreviewIcon name='qr' />
      </span>
      <span className={styles.sendIcon}>
        <PreviewIcon name='send' />
      </span>
    </div>
  );
}

export function CurrencyGlyph({ currency }: { currency: string }) {
  return (
    <span
      className={styles.currencyGlyph}
      data-currency={currency.toLowerCase()}
      aria-hidden
    >
      <span>{currency === 'USDT' ? '₮' : currency === 'USDC' ? '$' : currency}</span>
    </span>
  );
}

export function MoneyRow({
  currency,
  title,
  detail,
  amount,
  equivalent,
  positive = false,
}: {
  currency: string;
  title: string;
  detail: string;
  amount: string;
  equivalent?: string;
  positive?: boolean;
}) {
  return (
    <div className={styles.moneyRow}>
      <CurrencyGlyph currency={currency} />
      <span className={styles.rowCopy}>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
      <span className={`${styles.rowAmount} ${positive ? styles.positive : ''}`}>
        <strong>{amount}</strong>
        {equivalent && <small>{equivalent}</small>}
      </span>
    </div>
  );
}

export function DocumentIcon() {
  return (
    <span className={styles.documentIcon}>
      <PreviewIcon name='file' />
    </span>
  );
}
