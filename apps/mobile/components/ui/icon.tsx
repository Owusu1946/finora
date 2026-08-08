import { HugeiconsIcon } from '@hugeicons/react-native';

import { HUGE_ICONS, type IconProps } from './icon-mappings';

export function Icon({ name, size = 24, color, weight }: IconProps) {
  return (
    <HugeiconsIcon
      icon={HUGE_ICONS[name]}
      size={size}
      color={color}
      strokeWidth={weight === 'bold' ? 2.25 : 1.8}
    />
  );
}
