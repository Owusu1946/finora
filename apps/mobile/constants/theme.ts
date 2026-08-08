/**
 * Design tokens mirrored from assistant-ui `examples/with-expo`.
 * Neutral zinc palette, ChatGPT-grade look, hairline borders.
 */

export type Palette = {
  background: string;
  foreground: string;
  card: string;
  cardForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  border: string;
  primary: string;
  primaryForeground: string;
  composer: string;
  destructive: string;
  destructiveForeground: string;
  destructiveSurface: string;
  ring: string;
};

export const Colors: { light: Palette; dark: Palette } = {
  light: {
    background: '#ffffff',
    foreground: '#18181b',
    card: '#ffffff',
    cardForeground: '#18181b',
    muted: '#f4f4f5',
    mutedForeground: '#71717a',
    accent: '#f4f4f5',
    border: '#e4e4e7',
    primary: '#18181b',
    primaryForeground: '#fafafa',
    composer: '#fafafa',
    destructive: '#dc2626',
    destructiveForeground: '#ffffff',
    destructiveSurface: 'rgba(220, 38, 38, 0.08)',
    ring: '#a1a1aa',
  },
  dark: {
    background: '#18181b',
    foreground: '#fafafa',
    card: '#27272a',
    cardForeground: '#fafafa',
    muted: '#3f3f46',
    mutedForeground: '#a1a1aa',
    accent: '#3f3f46',
    border: 'rgba(255, 255, 255, 0.1)',
    primary: '#e4e4e7',
    primaryForeground: '#18181b',
    composer: '#232326',
    destructive: '#f87171',
    destructiveForeground: '#18181b',
    destructiveSurface: 'rgba(248, 113, 113, 0.12)',
    ring: '#52525b',
  },
};

export const Radius = {
  // Keep the scale visibly rounded across the app. These values are shared by
  // cards, controls, bubbles, and inputs; avoid introducing one-off radii.
  sm: 14,
  md: 18,
  lg: 22,
  card: 26,
  bubble: 28,
  composer: 32,
  attachment: 22,
  pill: 999,
} as const;

export const Rounded = {
  borderCurve: 'continuous' as const,
} as const;

export const Spacing = {
  threadMaxWidth: 768,
  gutter: 16,
} as const;
