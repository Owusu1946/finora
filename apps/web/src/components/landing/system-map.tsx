import { ApprovalPreview } from '@/components/landing/product-previews/approval-preview';
import { AssistantPreview } from '@/components/landing/product-previews/assistant-preview';
import { ConversionPreview } from '@/components/landing/product-previews/conversion-preview';
import { InvoicesPreview } from '@/components/landing/product-previews/operations-preview';
import { WalletsPreview } from '@/components/landing/product-previews/wallets-preview';

const nodes = [
  {
    className: 'system-node-context',
    eyebrow: 'Context',
    title: 'Every balance in view',
    preview: (
      <WalletsPreview
        density='compact'
        decorative
      />
    ),
  },
  {
    className: 'system-node-prepare',
    eyebrow: 'Prepare',
    title: 'A complete action, ready to review',
    preview: (
      <ConversionPreview
        density='compact'
        decorative
      />
    ),
  },
  {
    className: 'system-node-operations',
    eyebrow: 'Operate',
    title: 'Invoices and payroll stay connected',
    preview: (
      <InvoicesPreview
        density='compact'
        decorative
      />
    ),
  },
  {
    className: 'system-node-approve',
    eyebrow: 'Approve',
    title: 'You remain in control',
    preview: (
      <ApprovalPreview
        density='compact'
        decorative
      />
    ),
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
            <AssistantPreview />
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
            <div className='system-node-screen'>{node.preview}</div>
          </article>
        ))}
      </div>
    </div>
  );
}
