import { PreviewIcon } from './preview-icon';
import { Composer, ProductPreviewFrame } from './preview-primitives';
import styles from './product-preview.module.css';

export function ApprovalPreview({
  density = 'full',
  decorative = false,
}: {
  density?: 'full' | 'compact';
  decorative?: boolean;
}) {
  return (
    <ProductPreviewFrame
      density={density}
      label='Completed payment receipt with transaction reference and audit details'
      decorative={decorative}
      className={styles.receiptPreview}
    >
      <div className={styles.receiptCard}>
        <span className={styles.receiptCheck}>
          <PreviewIcon name='check' />
        </span>
        <small>Sent</small>
        <strong>USDT 500.00</strong>
        <p>to Yuki Tanaka</p>
        <div className={styles.receiptDetails}>
          <span>
            <small>Crypto</small>
            <strong>TY9a…0hA1</strong>
          </span>
          <span>
            <small>Transaction</small>
            <strong>WW-02AD38D1</strong>
          </span>
          <span>
            <small>Reference</small>
            <strong>From USD wallet</strong>
          </span>
        </div>
        <span className={styles.receiptButton}>View transaction</span>
      </div>
      {density === 'full' && <Composer />}
    </ProductPreviewFrame>
  );
}
