import { previewWallets } from './preview-data';
import { PreviewIcon } from './preview-icon';
import { MobileHeader, MoneyRow, ProductPreviewFrame } from './preview-primitives';
import styles from './product-preview.module.css';

export function WalletsPreview({
  density = 'full',
  decorative = false,
}: {
  density?: 'full' | 'compact';
  decorative?: boolean;
}) {
  const wallets = density === 'compact' ? previewWallets.slice(0, 2) : previewWallets;

  return (
    <ProductPreviewFrame
      density={density}
      label='Wallets screen showing balances across financial rails'
      fallbackSrc='/images/finora/previews/wallets.webp'
      decorative={decorative}
      className={styles.mobileScreen}
    >
      <MobileHeader account='Personal' />
      <div className={styles.screenBody}>
        <h3 className={styles.screenTitle}>Wallets</h3>
        <div className={styles.netWorth}>
          <span>Business Net Worth</span>
          <strong>$16,560.90</strong>
        </div>
        <div className={styles.actionPills}>
          <span className={styles.primaryPill}>
            <PreviewIcon name='payout' />
            Payout
          </span>
          <span>
            <PreviewIcon name='deposit' />
            Deposit
          </span>
          <span>
            <PreviewIcon name='swap' />
            Convert
          </span>
        </div>
        <div className={styles.tabs}>
          <span className={styles.activeTab}>All</span>
          <span>Fiat</span>
          <span>Crypto</span>
          <span>Mobile Money</span>
        </div>
        <div className={styles.walletRows}>
          {wallets.map((wallet) => (
            <MoneyRow
              key={wallet.currency}
              currency={wallet.currency}
              title={wallet.name}
              detail={wallet.detail}
              amount={wallet.balance}
              equivalent={wallet.equivalent}
            />
          ))}
        </div>
      </div>
    </ProductPreviewFrame>
  );
}
