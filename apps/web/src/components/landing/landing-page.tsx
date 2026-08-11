import { FinoraLogo } from '@/components/brand/finora-logo';
import { ApprovalFlow } from '@/components/landing/approval-flow';
import { BentoGrid } from '@/components/landing/bento-grid';
import { SiteFooter } from '@/components/landing/site-footer';
import { SystemMap } from '@/components/landing/system-map';

const navigation = [
  { label: 'Product', href: '#product' },
  { label: 'How it works', href: '#safety' },
  { label: 'Developers', href: '#developers' },
] as const;

export function LandingPage() {
  return (
    <main
      id='top'
      tabIndex={-1}
      className='overflow-hidden bg-white text-zinc-950'
    >
      <section className='hero-section'>
        <header className='site-header'>
          <FinoraLogo />

          <nav
            aria-label='Primary navigation'
            className='hidden items-center gap-7 md:flex'
          >
            {navigation.map((item) => (
              <a
                key={item.label}
                href={item.href}
              >
                {item.label}
              </a>
            ))}
          </nav>

          <a
            href='#get-started'
            className='button button-dark button-compact'
          >
            Get started
          </a>
        </header>

        <div className='hero-copy'>
          <p className='section-eyebrow'>The financial operating system for AI</p>
          <h1>One conversation for every financial move.</h1>
          <p className='hero-description'>
            Finora connects balances, payments, invoices, payroll, and agent-ready tools in one
            intelligent system. AI prepares. You approve.
          </p>
          <div className='hero-actions'>
            <a
              href='#get-started'
              className='button button-dark'
            >
              Get started
              <span aria-hidden>↗</span>
            </a>
            <a
              href='#product'
              className='text-link'
            >
              Explore the system
              <span aria-hidden>↓</span>
            </a>
          </div>
        </div>

        <SystemMap />
      </section>

      <BentoGrid />
      <ApprovalFlow />
      <SiteFooter />
    </main>
  );
}
