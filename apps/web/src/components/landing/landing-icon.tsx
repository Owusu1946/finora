import { ArrowDown01Icon, ArrowUpRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

const icons = {
  down: ArrowDown01Icon,
  'up-right': ArrowUpRight01Icon,
} as const;

export function LandingIcon({ name }: { name: keyof typeof icons }) {
  return (
    <HugeiconsIcon
      icon={icons[name]}
      size='1em'
      strokeWidth={1.8}
      aria-hidden
    />
  );
}
