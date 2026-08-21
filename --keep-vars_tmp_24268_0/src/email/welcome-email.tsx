import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  render,
} from 'react-email';

export type WelcomeEmailProps = {
  firstName: string | null;
  ctaUrl: string;
};

const colors = {
  background: '#f4f4f5',
  card: '#ffffff',
  ink: '#18181b',
  muted: '#52525b',
  border: '#e4e4e7',
  soft: '#f8fafc',
};

const logoUrl = 'https://finora-iota-ten.vercel.app/images/finora/email-logo.png';

export function WelcomeEmail({ firstName, ctaUrl }: WelcomeEmailProps) {
  const greeting = firstName ? `Hi ${firstName},` : 'Welcome,';

  return (
    <Html
      lang='en'
      dir='ltr'
    >
      <Head />
      <Preview>Your financial workspace for people and AI is ready.</Preview>
      <Body
        style={{ backgroundColor: colors.background, fontFamily: 'Arial, sans-serif', margin: 0 }}
      >
        <Container
          style={{
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            margin: '32px auto',
            maxWidth: '600px',
            padding: '36px 32px',
          }}
        >
          <Img
            src={logoUrl}
            alt='Finora'
            width='160'
            height='40'
            style={{ display: 'block', margin: '0 0 36px' }}
          />
          <Heading
            as='h1'
            style={{ color: colors.ink, fontSize: '28px', lineHeight: '36px', margin: 0 }}
          >
            Welcome to Finora
          </Heading>
          <Text
            style={{
              color: colors.ink,
              fontSize: '16px',
              lineHeight: '26px',
              margin: '24px 0 12px',
            }}
          >
            {greeting}
          </Text>
          <Text
            style={{
              color: colors.muted,
              fontSize: '16px',
              lineHeight: '26px',
              margin: '0 0 24px',
            }}
          >
            Your Finora account is ready. Finora is your financial workspace for understanding,
            managing, and safely acting on money with AI.
          </Text>
          <Section
            style={{
              backgroundColor: colors.soft,
              border: `1px solid ${colors.border}`,
              padding: '22px 22px 10px',
            }}
          >
            <Heading
              as='h2'
              style={{
                color: colors.ink,
                fontSize: '18px',
                lineHeight: '26px',
                margin: '0 0 14px',
              }}
            >
              One place for your financial life
            </Heading>
            <Text
              style={{
                color: colors.muted,
                fontSize: '15px',
                lineHeight: '24px',
                margin: '0 0 12px',
              }}
            >
              <strong style={{ color: colors.ink }}>Understand.</strong> See accounts, balances,
              transactions, invoices, spending, cash flow, and upcoming obligations in context.
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: '15px',
                lineHeight: '24px',
                margin: '0 0 12px',
              }}
            >
              <strong style={{ color: colors.ink }}>Prepare.</strong> Ask Finora to plan payments,
              transfers, payroll, invoices, currency conversions, and recurring financial work.
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: '15px',
                lineHeight: '24px',
                margin: '0 0 12px',
              }}
            >
              <strong style={{ color: colors.ink }}>Stay in control.</strong> AI can help prepare
              and explain actions, but money never moves without policy checks and your explicit
              approval.
            </Text>
            <Text
              style={{
                color: colors.muted,
                fontSize: '15px',
                lineHeight: '24px',
                margin: '0 0 12px',
              }}
            >
              <strong style={{ color: colors.ink }}>Work your way.</strong> Use Finora for personal
              or business finances, and connect supported AI assistants to the same permissioned
              financial workspace as those capabilities become available.
            </Text>
          </Section>
          <Text
            style={{
              color: colors.muted,
              fontSize: '14px',
              lineHeight: '22px',
              margin: '22px 0 0',
            }}
          >
            Finora is being built in stages. Availability may vary while we bring each financial
            capability online and complete the required safety and compliance checks.
          </Text>
          <Section style={{ margin: '28px 0' }}>
            <Button
              href={ctaUrl}
              style={{
                backgroundColor: colors.ink,
                boxSizing: 'border-box',
                color: '#ffffff',
                display: 'inline-block',
                fontSize: '15px',
                fontWeight: 700,
                padding: '13px 20px',
                textDecoration: 'none',
              }}
            >
              Open Finora
            </Button>
          </Section>
          <Hr
            style={{ border: 0, borderTop: `1px solid ${colors.border}`, margin: '32px 0 20px' }}
          />
          <Text
            style={{
              color: colors.muted,
              fontSize: '13px',
              lineHeight: '20px',
              margin: '0 0 18px',
            }}
          >
            Security reminder: Finora will never ask for your passcode, OTP, or recovery code by
            email.
          </Text>
          <Text
            style={{ color: colors.muted, fontSize: '12px', lineHeight: '19px', margin: '0 0 8px' }}
          >
            Need help? Reply to this email or contact{' '}
            <Link
              href='mailto:hello@askorin.app'
              style={{ color: colors.ink, textDecoration: 'underline' }}
            >
              hello@askorin.app
            </Link>
            .
          </Text>
          <Text style={{ color: '#71717a', fontSize: '12px', lineHeight: '19px', margin: 0 }}>
            © 2026 Finora. Financial intelligence for people and AI.
            <br />
            You received this transactional email because a Finora account was created with this
            address.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderWelcomeEmail(props: WelcomeEmailProps) {
  const email = <WelcomeEmail {...props} />;
  const [html, text] = await Promise.all([render(email), render(email, { plainText: true })]);
  return { html, text };
}
