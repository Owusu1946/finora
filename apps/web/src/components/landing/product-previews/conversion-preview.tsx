import { previewConversion } from './preview-data';
import { PreviewIcon } from './preview-icon';
import { CurrencyGlyph, ProductPreviewFrame } from './preview-primitives';
import styles from './product-preview.module.css';

export function ConversionPreview({
  density = 'full',
  decorative = false,
}: {
  density?: 'full' | 'compact';
  decorative?: boolean;
}) {
  return (
    <ProductPreviewFrame
      density={density}
      label='Prepared US dollar to Ghana cedi conversion awaiting confirmation'
      fallbackSrc='/images/finora/previews/conversion.webp'
      decorative={decorative}
      className={styles.conversionPreview}
    >
      <div className={styles.conversionHeading}>
        <span className={styles.conversionIcon}>
          <PreviewIcon name='swap' />
        </span>
        <span>
          <small>Confirm conversion</small>
          <strong>USD → GHS</strong>
        </span>
      </div>
      <div className={styles.transferPanel}>
        <CurrencyGlyph currency={previewConversion.fromCurrency} />
        <span className={styles.transferCopy}>
          <small>You send</small>
          <strong>{previewConversion.fromAmount}</strong>
        </span>
        <span className={styles.transferArrows}>
          <PreviewIcon name='swap' />
        </span>
        <span className={`${styles.transferCopy} ${styles.transferCopyRight}`}>
          <small>You get</small>
          <strong>{previewConversion.toAmount}</strong>
        </span>
        <CurrencyGlyph currency={previewConversion.toCurrency} />
      </div>
      <div className={styles.conversionFacts}>
        <span>
          <small>Rate</small>
          <strong>{previewConversion.rate}</strong>
        </span>
        <span>
          <small>Fee</small>
          <strong>{previewConversion.fee}</strong>
        </span>
      </div>
      <div className={styles.conversionActions}>
        <span>Cancel</span>
        <strong>Confirm &amp; convert</strong>
      </div>
    </ProductPreviewFrame>
  );
}
