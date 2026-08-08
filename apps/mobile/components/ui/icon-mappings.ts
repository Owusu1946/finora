import {
  Activity01Icon,
  Add01Icon,
  AiBrain01Icon,
  ArrowDown01Icon,
  ArrowDownLeft01Icon,
  ArrowLeft01Icon,
  ArrowLeftRightIcon,
  ArrowRight01Icon,
  ArrowUp01Icon,
  ArrowUpRight01Icon,
  ArrowUpDownIcon,
  Attachment01Icon,
  Building02Icon,
  Call02Icon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  CheckIcon,
  Copy01Icon,
  Edit02Icon,
  File01Icon,
  FingerPrintScanIcon,
  Image01Icon,
  InformationCircleIcon,
  Link01Icon,
  Menu01Icon,
  MessageAdd01Icon,
  QrCodeIcon,
  QuoteDownIcon,
  RefreshIcon,
  SentIcon,
  Share01Icon,
  Settings01Icon,
  Shield01Icon,
  StopIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  UserGroupIcon,
  ViewIcon,
  ViewOffIcon,
  Wallet01Icon,
  Wrench01Icon,
} from '@hugeicons/core-free-icons';

export type IconName =
  | 'compose'
  | 'send'
  | 'stop'
  | 'add'
  | 'remove'
  | 'copy'
  | 'check'
  | 'reload'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'menu'
  | 'brain'
  | 'tool'
  | 'wallet'
  | 'activity'
  | 'contacts'
  | 'integrations'
  | 'settings'
  | 'attach'
  | 'edit'
  | 'arrow-down'
  | 'arrow-up'
  | 'arrow-down-left'
  | 'swap'
  | 'swap-vert'
  | 'bank'
  | 'phone'
  | 'eye'
  | 'eye-off'
  | 'qr'
  | 'share'
  | 'shield'
  | 'info'
  | 'save'
  | 'close-circle'
  | 'file'
  | 'image'
  | 'thumb-up'
  | 'thumb-down'
  | 'quote'
  | 'biometric';

export type IconProps = {
  name: IconName;
  size?: number;
  color: string;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
};

export const HUGE_ICONS = {
  compose: MessageAdd01Icon,
  send: SentIcon,
  stop: StopIcon,
  add: Add01Icon,
  remove: Cancel01Icon,
  copy: Copy01Icon,
  check: CheckIcon,
  reload: RefreshIcon,
  'chevron-left': ArrowLeft01Icon,
  'chevron-right': ArrowRight01Icon,
  'chevron-down': ArrowDown01Icon,
  menu: Menu01Icon,
  brain: AiBrain01Icon,
  tool: Wrench01Icon,
  wallet: Wallet01Icon,
  activity: Activity01Icon,
  contacts: UserGroupIcon,
  integrations: Link01Icon,
  settings: Settings01Icon,
  attach: Add01Icon,
  edit: Edit02Icon,
  'arrow-down': ArrowDown01Icon,
  'arrow-up': ArrowUpRight01Icon,
  'arrow-down-left': ArrowDownLeft01Icon,
  swap: ArrowLeftRightIcon,
  'swap-vert': ArrowUpDownIcon,
  bank: Building02Icon,
  phone: Call02Icon,
  eye: ViewIcon,
  'eye-off': ViewOffIcon,
  qr: QrCodeIcon,
  share: Share01Icon,
  shield: Shield01Icon,
  info: InformationCircleIcon,
  save: CheckmarkCircle02Icon,
  'close-circle': CancelCircleIcon,
  file: File01Icon,
  image: Image01Icon,
  'thumb-up': ThumbsUpIcon,
  'thumb-down': ThumbsDownIcon,
  quote: QuoteDownIcon,
  biometric: FingerPrintScanIcon,
} as const;
