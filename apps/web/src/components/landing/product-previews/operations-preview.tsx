import { previewEmployees, previewInvoices } from './preview-data';
import { DocumentIcon, MobileHeader, ProductPreviewFrame } from './preview-primitives';
import styles from './product-preview.module.css';

export function InvoicesPreview({
  density = 'full',
  decorative = false,
}: {
  density?: 'full' | 'compact';
  decorative?: boolean;
}) {
  return (
    <ProductPreviewFrame
      density={density}
      label='Invoices screen showing supplier bills due for review'
      fallbackSrc='/images/finora/previews/invoices.webp'
      decorative={decorative}
      className={styles.mobileScreen}
    >
      <MobileHeader account='Business' />
      <div className={styles.screenBody}>
        <h3 className={styles.screenTitle}>Invoices</h3>
        <p className={styles.screenDescription}>
          Supplier bills from Gmail and chat. Pay with the same passcode as sends.
        </p>
        <div className={styles.filterPills}>
          <span className={styles.primaryPill}>Due</span>
          <span>Scheduled</span>
          <span>Paid</span>
          <span>All</span>
        </div>
        <div className={styles.invoiceRows}>
          {previewInvoices.map((invoice) => (
            <div
              key={invoice.vendor}
              className={styles.invoiceRow}
            >
              <DocumentIcon />
              <span className={styles.rowCopy}>
                <strong>{invoice.vendor}</strong>
                <small>{invoice.reference}</small>
              </span>
              <span className={styles.invoiceAmount}>
                <strong>{invoice.amount}</strong>
                <small>Due</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    </ProductPreviewFrame>
  );
}

export function PayrollPreview({
  density = 'full',
  decorative = false,
}: {
  density?: 'full' | 'compact';
  decorative?: boolean;
}) {
  return (
    <ProductPreviewFrame
      density={density}
      label='Payroll screen showing August team salaries prepared for approval'
      fallbackSrc='/images/finora/previews/payroll.webp'
      decorative={decorative}
      className={styles.mobileScreen}
    >
      <MobileHeader account='Business' />
      <div className={styles.screenBody}>
        <h3 className={styles.screenTitle}>Payroll</h3>
        <p className={styles.screenDescription}>
          Team roster for August 2026. WeWire settles each salary as its own payout after approval.
        </p>
        <div className={styles.payrollSummary}>
          <span>Next run total</span>
          <strong>$5,700.00</strong>
          <small>2 active employees</small>
          <b>Run payroll in chat</b>
        </div>
        <p className={styles.listLabel}>Team</p>
        <div className={styles.employeeRows}>
          {previewEmployees.map((employee) => (
            <div
              key={employee.name}
              className={styles.employeeRow}
            >
              <span className={styles.rowCopy}>
                <strong>{employee.name}</strong>
                <small>{employee.role}</small>
              </span>
              <strong>{employee.amount}</strong>
            </div>
          ))}
        </div>
      </div>
    </ProductPreviewFrame>
  );
}
