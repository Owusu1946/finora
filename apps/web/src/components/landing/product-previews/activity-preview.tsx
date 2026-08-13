import { previewActivity } from './preview-data';
import { MobileHeader, MoneyRow, ProductPreviewFrame } from './preview-primitives';
import styles from './product-preview.module.css';

export function ActivityPreview({
  density = 'full',
  decorative = false,
}: {
  density?: 'full' | 'compact';
  decorative?: boolean;
}) {
  const activity = density === 'compact' ? previewActivity.slice(0, 2) : previewActivity;

  return (
    <ProductPreviewFrame
      density={density}
      label='Activity screen showing transactions across currencies and rails'
      decorative={decorative}
      className={styles.mobileScreen}
    >
      <MobileHeader
        title='Activity'
        account='Personal'
      />
      <div className={styles.screenBody}>
        <div className={`${styles.tabs} ${styles.activityTabs}`}>
          <span className={styles.activeTab}>All</span>
          <span>Sent</span>
          <span>Received</span>
          <span>Swaps</span>
        </div>
        <div className={styles.activityRows}>
          {activity.map((item) => (
            <MoneyRow
              key={`${item.currency}-${item.counterparty}`}
              currency={item.currency}
              title={item.counterparty}
              detail={item.detail}
              amount={item.amount}
            />
          ))}
        </div>
      </div>
    </ProductPreviewFrame>
  );
}
