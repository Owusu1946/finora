import { FinoraMark } from '@/components/brand/finora-logo';

import { assistantSuggestions } from './preview-data';
import { Composer, MobileHeader, ProductPreviewFrame } from './preview-primitives';
import styles from './product-preview.module.css';

export function AssistantPreview({
  density = 'full',
  decorative = false,
  className = '',
}: {
  density?: 'full' | 'compact';
  decorative?: boolean;
  className?: string;
}) {
  return (
    <ProductPreviewFrame
      density={density}
      label='Finora assistant home with suggested financial actions'
      decorative={decorative}
      className={`${styles.assistant} ${className}`}
    >
      <MobileHeader />
      <div className={styles.assistantCenter}>
        <FinoraMark className={styles.finoraMark} />
        <h3>How can I help you today?</h3>
        <div className={styles.suggestions}>
          {assistantSuggestions.map((suggestion) => (
            <span
              key={suggestion}
              className={styles.suggestion}
            >
              {suggestion}
            </span>
          ))}
        </div>
      </div>
      <Composer />
    </ProductPreviewFrame>
  );
}
