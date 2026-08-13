import { ActivityPreview } from '@/components/landing/product-previews/activity-preview';
import { AssistantPreview } from '@/components/landing/product-previews/assistant-preview';
import { ConversionPreview } from '@/components/landing/product-previews/conversion-preview';
import {
  InvoicesPreview,
  PayrollPreview,
} from '@/components/landing/product-previews/operations-preview';
import { WalletsPreview } from '@/components/landing/product-previews/wallets-preview';

export function BentoGrid() {
  return (
    <section
      id='product'
      className='landing-section'
    >
      <div className='section-heading'>
        <div>
          <p className='section-eyebrow'>One financial operating system</p>
          <h2>From question to approval, without changing context.</h2>
        </div>
        <p>
          Finora brings personal and business finance into the same conversational surface, then
          gives agents a carefully bounded way to help.
        </p>
      </div>

      <div className='bento-grid'>
        <article className='bento-card bento-conversation'>
          <div className='bento-copy'>
            <span>Conversation</span>
            <h3>Ask for the outcome, not the menu.</h3>
            <p>
              See balances, inspect spending, prepare a payment, or plan payroll in the same thread.
            </p>
          </div>
          <div className='bento-chat-phone'>
            <AssistantPreview />
          </div>
          <div className='bento-prompt bento-prompt-one'>Show treasury overview</div>
          <div className='bento-prompt bento-prompt-two'>Pay everything due today</div>
        </article>

        <article className='bento-card bento-wallets'>
          <div className='bento-copy'>
            <span>Money at a glance</span>
            <h3>See value across rails.</h3>
            <p>Fiat, stablecoins, and mobile money stay legible in one place.</p>
          </div>
          <div className='bento-preview-host bento-wallet-preview'>
            <WalletsPreview />
          </div>
        </article>

        <article className='bento-card bento-approval'>
          <div className='bento-copy'>
            <span>Human control</span>
            <h3>AI prepares. You decide.</h3>
            <p>Review the rate, fee, and destination before anything can move.</p>
          </div>
          <div className='bento-preview-host bento-approval-preview'>
            <ConversionPreview />
          </div>
        </article>

        <article
          id='developers'
          tabIndex={-1}
          className='bento-card bento-mcp'
        >
          <div className='bento-copy bento-copy-light'>
            <span>Finora MCP</span>
            <h3>The same financial context, available to your agents.</h3>
            <p>
              Curated read and prepare tools give agents useful access without exposing execution,
              credentials, PINs, or biometrics.
            </p>
          </div>

          <div className='mcp-console'>
            <div className='mcp-console-bar'>
              <span />
              <span />
              <span />
              <p>finora.tools</p>
            </div>
            <div className='mcp-console-body'>
              <p className='text-zinc-500'>agent request</p>
              <p className='mt-2 text-white'>Prepare a 100 USD → GHS conversion</p>
              <div className='mcp-tool-row'>
                <span>prepare_conversion</span>
                <strong>ready for approval</strong>
              </div>
              <div className='mcp-boundary'>
                <span>Execution boundary</span>
                <strong>Human approval in Finora required</strong>
              </div>
            </div>
          </div>
        </article>

        <article className='bento-card bento-operations'>
          <div className='bento-copy'>
            <span>Business operations</span>
            <h3>Invoices and payroll, ready when you are.</h3>
            <p>Move from what is due to a prepared action without losing the underlying details.</p>
          </div>
          <div className='operations-stack'>
            <div className='operations-screen operations-invoices'>
              <InvoicesPreview />
            </div>
            <div className='operations-screen operations-payroll'>
              <PayrollPreview />
            </div>
          </div>
        </article>

        <article className='bento-card bento-activity'>
          <div className='bento-copy'>
            <span>Clear records</span>
            <h3>Every move stays legible.</h3>
            <p>Review what happened, on which rail, and in which currency.</p>
          </div>
          <div className='bento-preview-host bento-activity-preview'>
            <ActivityPreview />
          </div>
        </article>
      </div>
    </section>
  );
}
