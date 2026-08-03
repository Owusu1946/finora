export type OnboardingStep = {
  title: string;
  subtitle: string;
  /** Uppercase micro-brand treatment (Beat 0). */
  brand?: boolean;
};

export const ONBOARDING_STEPS: readonly OnboardingStep[] = [
  {
    title: 'Finora',
    subtitle: 'Money, in conversation.',
    brand: true,
  },
  {
    title: 'Ask. Send. Receive.',
    subtitle: 'Balances, payouts, invoices — in plain language.',
  },
  {
    title: 'You stay in control.',
    subtitle: 'AI can request. You approve. Everything is audited.',
  },
  {
    title: 'How will you use Finora?',
    subtitle: 'Choose an account type, then get started.',
  },
] as const;

export const STEP_COUNT = ONBOARDING_STEPS.length;
export const LAST_STEP = STEP_COUNT - 1;
