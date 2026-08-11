import Image from 'next/image';

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
            <Image
              src='/images/finora/screens/chat-home.jpg'
              alt='Finora chat interface with suggested financial actions'
              width={591}
              height={1280}
              sizes='(max-width: 767px) 58vw, 285px'
              className='h-auto w-full'
            />
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
          <div className='bento-screen-crop bento-wallet-crop'>
            <Image
              src='/images/finora/screens/wallets.png'
              alt='Finora wallets showing multiple currencies and rails'
              fill
              sizes='(max-width: 767px) 90vw, 440px'
              className='object-cover object-top'
            />
          </div>
        </article>

        <article className='bento-card bento-approval'>
          <div className='bento-copy'>
            <span>Human control</span>
            <h3>AI prepares. You decide.</h3>
            <p>Review the rate, fee, and destination before anything can move.</p>
          </div>
          <div className='bento-screen-crop bento-approval-crop'>
            <Image
              src='/images/finora/screens/fx-confirm.png'
              alt='A prepared currency conversion awaiting confirmation'
              fill
              sizes='(max-width: 767px) 90vw, 420px'
              className='object-cover'
              style={{ objectPosition: '50% 34%' }}
            />
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
              <Image
                src='/images/finora/screens/invoices.png'
                alt='Finora invoices screen'
                fill
                sizes='320px'
                className='object-cover object-top'
              />
            </div>
            <div className='operations-screen operations-payroll'>
              <Image
                src='/images/finora/screens/payroll.png'
                alt='Finora payroll screen'
                fill
                sizes='320px'
                className='object-cover object-top'
              />
            </div>
          </div>
        </article>

        <article className='bento-card bento-activity'>
          <div className='bento-copy'>
            <span>Clear records</span>
            <h3>Every move stays legible.</h3>
            <p>Review what happened, on which rail, and in which currency.</p>
          </div>
          <div className='bento-screen-crop bento-activity-crop'>
            <Image
              src='/images/finora/screens/activity.png'
              alt='Finora transaction activity across several payment rails'
              fill
              sizes='(max-width: 767px) 90vw, 440px'
              className='object-cover object-top'
            />
          </div>
        </article>
      </div>
    </section>
  );
}
