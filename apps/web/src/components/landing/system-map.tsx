import Image from 'next/image';

const nodes = [
  {
    className: 'system-node-context',
    eyebrow: 'Context',
    title: 'Every balance in view',
    alt: 'Finora wallet balances across fiat, crypto, and mobile money',
  },
  {
    className: 'system-node-prepare',
    eyebrow: 'Prepare',
    title: 'A complete action, ready to review',
    alt: 'Finora currency conversion confirmation',
  },
  {
    className: 'system-node-operations',
    eyebrow: 'Operate',
    title: 'Invoices and payroll stay connected',
    alt: 'Finora invoice management screen',
  },
  {
    className: 'system-node-approve',
    eyebrow: 'Approve',
    title: 'You remain in control',
    alt: 'Finora completed payment screen',
  },
] as const;

const paths = [
  'M600 328 C520 315 448 190 288 172',
  'M600 328 C680 315 752 190 912 172',
  'M600 328 C520 360 448 500 292 518',
  'M600 328 C680 360 752 500 908 518',
] as const;

export function SystemMap() {
  return (
    <div className='system-map'>
      <div className='system-map-bar'>
        <div className='flex items-center gap-2.5'>
          <span className='system-map-pulse' />
          <span>Finora intelligence</span>
        </div>
        <span className='hidden text-zinc-500 sm:inline'>
          Human approval required for money movement
        </span>
      </div>

      <div className='system-map-canvas'>
        <svg
          aria-hidden='true'
          className='system-connections'
          viewBox='0 0 1200 680'
          preserveAspectRatio='none'
        >
          <defs>
            <linearGradient
              id='connection-gradient'
              x1='0'
              y1='0'
              x2='1'
              y2='1'
            >
              <stop
                offset='0%'
                stopColor='rgba(255,255,255,0.48)'
              />
              <stop
                offset='100%'
                stopColor='rgba(255,255,255,0.08)'
              />
            </linearGradient>
            {paths.map((path, index) => (
              <path
                key={`route-${index}`}
                id={`system-route-${index}`}
                d={path}
              />
            ))}
          </defs>

          {paths.map((path) => (
            <path
              key={path}
              d={path}
              className='system-connection-path'
              pathLength='1'
            />
          ))}

          {paths.map((_, index) => (
            <circle
              key={`signal-${index}`}
              r='4.5'
              className='system-signal'
            >
              <animateMotion
                dur={`${3.8 + index * 0.35}s`}
                begin={`${index * -0.8}s`}
                repeatCount='indefinite'
              >
                <mpath href={`#system-route-${index}`} />
              </animateMotion>
            </circle>
          ))}
        </svg>

        <div className='system-core-halo' />

        <div className='system-phone-wrap'>
          <div className='system-phone'>
            <Image
              src='/images/finora/screens/chat-home.jpg'
              alt='Finora conversational home screen'
              width={591}
              height={1280}
              priority
              sizes='(max-width: 767px) 58vw, 254px'
              className='h-auto w-full select-none'
            />
          </div>
        </div>

        {nodes.map((node) => (
          <article
            key={node.eyebrow}
            className={`system-node ${node.className}`}
          >
            <div className='system-node-copy'>
              <span>{node.eyebrow}</span>
              <strong>{node.title}</strong>
            </div>
            <div className='system-node-screen'>
              <Image
                src={
                  node.eyebrow === 'Context'
                    ? '/images/finora/screens/node-wallets.webp'
                    : node.eyebrow === 'Prepare'
                      ? '/images/finora/screens/node-fx.webp'
                      : node.eyebrow === 'Operate'
                        ? '/images/finora/screens/node-invoices.webp'
                        : '/images/finora/screens/node-payment.webp'
                }
                alt={node.alt}
                fill
                sizes='280px'
                className='object-cover'
              />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
