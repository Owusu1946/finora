import {
  Activity01Icon,
  Add01Icon,
  AiBrain01Icon,
  ArrowDown01Icon,
  ArrowDownLeft01Icon,
  ArrowLeft01Icon,
  ArrowLeftRightIcon,
  ArrowRight01Icon,
  ArrowUpRight01Icon,
  ArrowUpDownIcon,
  Building02Icon,
  Call02Icon,
  Cancel01Icon,
  CancelCircleIcon,
  CheckmarkCircle02Icon,
  CheckIcon,
  CircleDollarSignIcon,
  Clock01Icon,
  ClipboardIcon,
  Copy01Icon,
  CreditCardIcon,
  UserIcon,
  Edit02Icon,
  Eraser01Icon,
  File01Icon,
  FingerPrintScanIcon,
  Image01Icon,
  InformationCircleIcon,
  Link01Icon,
  Loading01Icon,
  MenuTwoLineIcon,
  MessageAdd01Icon,
  Mic01Icon,
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
  | 'clipboard'
  | 'copy'
  | 'check'
  | 'reload'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'menu'
  | 'mic'
  | 'brain'
  | 'tool'
  | 'wallet'
  | 'card'
  | 'activity'
  | 'contacts'
  | 'integrations'
  | 'loading'
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
  | 'clock'
  | 'dollar'
  | 'user'
  | 'save'
  | 'close-circle'
  | 'file'
  | 'image'
  | 'thumb-up'
  | 'thumb-down'
  | 'quote'
  | 'biometric'
  | 'eraser';

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
  clipboard: ClipboardIcon,
  copy: Copy01Icon,
  check: CheckIcon,
  reload: RefreshIcon,
  'chevron-left': ArrowLeft01Icon,
  'chevron-right': ArrowRight01Icon,
  'chevron-down': ArrowDown01Icon,
  menu: MenuTwoLineIcon,
  mic: Mic01Icon,
  brain: AiBrain01Icon,
  tool: Wrench01Icon,
  wallet: Wallet01Icon,
  card: CreditCardIcon,
  activity: Activity01Icon,
  contacts: UserGroupIcon,
  integrations: Link01Icon,
  loading: Loading01Icon,
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
  clock: Clock01Icon,
  dollar: CircleDollarSignIcon,
  user: UserIcon,
  save: CheckmarkCircle02Icon,
  'close-circle': CancelCircleIcon,
  file: File01Icon,
  image: Image01Icon,
  'thumb-up': ThumbsUpIcon,
  'thumb-down': ThumbsDownIcon,
  quote: QuoteDownIcon,
  biometric: FingerPrintScanIcon,
  eraser: Eraser01Icon,
} as const;
