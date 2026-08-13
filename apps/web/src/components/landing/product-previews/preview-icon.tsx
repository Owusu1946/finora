import {
  Add01Icon,
  ArrowDownLeft01Icon,
  ArrowLeftRightIcon,
  ArrowUpRight01Icon,
  CheckIcon,
  File01Icon,
  MenuTwoLineIcon,
  MessageAdd01Icon,
  QrCodeIcon,
  SentIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';

const icons = {
  add: Add01Icon,
  check: CheckIcon,
  deposit: ArrowDownLeft01Icon,
  file: File01Icon,
  menu: MenuTwoLineIcon,
  message: MessageAdd01Icon,
  payout: ArrowUpRight01Icon,
  qr: QrCodeIcon,
  send: SentIcon,
  swap: ArrowLeftRightIcon,
} as const;

type PreviewIconName = keyof typeof icons;

export function PreviewIcon({
  name,
  className = '',
}: {
  name: PreviewIconName;
  className?: string;
}) {
  return (
    <HugeiconsIcon
      icon={icons[name]}
      size='1em'
      strokeWidth={1.8}
      className={className}
      aria-hidden
    />
  );
}
