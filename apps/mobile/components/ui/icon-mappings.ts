import type MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import type { ComponentProps } from 'react';

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
  | 'quote';

export type IconProps = {
  name: IconName;
  size?: number;
  color: string;
  weight?: SymbolWeight;
};

export const SF_SYMBOLS: Record<IconName, SymbolViewProps['name']> = {
  compose: 'square.and.pencil',
  send: 'arrow.up',
  stop: 'stop.fill',
  add: 'plus',
  remove: 'xmark',
  copy: 'doc.on.doc',
  check: 'checkmark',
  reload: 'arrow.clockwise',
  'chevron-left': 'chevron.left',
  'chevron-right': 'chevron.right',
  'chevron-down': 'chevron.down',
  menu: 'line.3.horizontal',
  brain: 'brain',
  tool: 'wrench.and.screwdriver',
  wallet: 'creditcard',
  activity: 'list.bullet',
  contacts: 'person.2',
  integrations: 'link',
  settings: 'gearshape',
  attach: 'paperclip',
  edit: 'pencil',
  'arrow-down': 'arrow.down',
  'arrow-up': 'arrow.up.right',
  'arrow-down-left': 'arrow.down.left',
  swap: 'arrow.triangle.2.circlepath',
  bank: 'building.columns',
  phone: 'phone',
  eye: 'eye',
  'eye-off': 'eye.slash',
  qr: 'qrcode',
  share: 'square.and.arrow.up',
  shield: 'shield',
  info: 'info.circle',
  save: 'checkmark.circle',
  'close-circle': 'xmark.circle.fill',
  file: 'doc',
  image: 'photo',
  'thumb-up': 'hand.thumbsup',
  'thumb-down': 'hand.thumbsdown',
  quote: 'quote.bubble',
};

export const MATERIAL_ICONS: Record<IconName, ComponentProps<typeof MaterialIcons>['name']> = {
  compose: 'edit',
  send: 'arrow-upward',
  stop: 'stop',
  add: 'add',
  remove: 'close',
  copy: 'content-copy',
  check: 'check',
  reload: 'refresh',
  'chevron-left': 'chevron-left',
  'chevron-right': 'chevron-right',
  'chevron-down': 'keyboard-arrow-down',
  menu: 'menu',
  brain: 'psychology',
  tool: 'build',
  wallet: 'account-balance-wallet',
  activity: 'history',
  contacts: 'people',
  integrations: 'link',
  settings: 'settings',
  attach: 'attach-file',
  edit: 'edit',
  'arrow-down': 'keyboard-arrow-down',
  'arrow-up': 'north-east',
  'arrow-down-left': 'south-west',
  swap: 'swap-horiz',
  bank: 'account-balance',
  phone: 'phone',
  eye: 'visibility',
  'eye-off': 'visibility-off',
  qr: 'qr-code',
  share: 'share',
  shield: 'security',
  info: 'info-outline',
  save: 'check-circle',
  'close-circle': 'cancel',
  file: 'description',
  image: 'image',
  'thumb-up': 'thumb-up',
  'thumb-down': 'thumb-down',
  quote: 'format-quote',
};
