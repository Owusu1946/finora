import { FinoraLogo } from '@/components/brand/finora-logo';
import { LandingIcon } from '@/components/landing/landing-icon';

const footerGroups = [
  {
    title: 'Product',
    links: [
      { label: 'Conversation', href: '#product' },
      { label: 'Business finance', href: '#product' },
      { label: 'Safety', href: '#safety' },
    ],
  },
  {
    title: 'Developers',
    links: [
      { label: 'Finora MCP', href: '#developers' },
      { label: 'Agent capabilities', href: '#developers' },
      { label: 'Safety model', href: '#safety' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', href: '#about' },
      { label: 'Contact', href: 'mailto:hello@finora.app' },
      { label: 'Get started', href: '#get-started' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer
      id='get-started'
      tabIndex={-1}
      className='site-footer'
    >
      <div className='footer-cta'>
        <div>
          <p>Finance should feel this connected.</p>
          <h2>Put your financial world in one conversation.</h2>
        </div>
        <a
          href='mailto:hello@finora.app?subject=Get%20started%20with%20Finora'
          className='button button-light'
        >
          Get started
          <LandingIcon name='up-right' />
        </a>
      </div>

      <div className='footer-main'>
        <div
          id='about'
          tabIndex={-1}
          className='footer-brand'
        >
          <h2 className='sr-only'>About Finora</h2>
          <FinoraLogo tone='light' />
          <p>
            A financial operating system for people and AI agents. AI prepares financial work;
            people review and approve it.
          </p>
        </div>

        <div className='footer-links'>
          {footerGroups.map((group) => (
            <div key={group.title}>
              <h3>{group.title}</h3>
              <ul>
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className='footer-bottom'>
        <p>© Finora. All rights reserved.</p>
        <p>AI prepares. People approve.</p>
      </div>
    </footer>
  );
}
