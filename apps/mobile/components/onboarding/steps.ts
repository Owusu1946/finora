export type OnboardingStep = {
  title: string;
  subtitle: string;
  /** Uppercase micro-brand treatment (Beat 0). */
  brand?: boolean;
  /** Primary CTA label, phrased as a reply to the step's copy. */
  cta: string;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    title: 'Finora',
    subtitle: 'Money, in conversation.',
    brand: true,
    cta: 'Let’s go',
  },
  {
    title: 'Ask. Send. Receive.',
    subtitle: 'Balances, payouts, invoices — in plain language.',
    cta: 'Show me',
  },
  {
    title: 'You stay in control.',
    subtitle: 'AI can request. You approve. Everything is audited.',
    cta: 'Sounds good',
  },
  {
    title: 'How will you use Finora?',
    subtitle: 'Choose an account type to continue.',
    cta: 'Get Started',
  },
] as const;

export const STEP_COUNT = ONBOARDING_STEPS.length;
export const LAST_STEP = STEP_COUNT - 1;
