import type { ReactElement } from 'react';

export type AttachAction = 'camera' | 'photo' | 'document';

export const ATTACH_ACTIONS: { id: AttachAction; title: string }[] = [
  { id: 'camera', title: 'Take photo' },
  { id: 'photo', title: 'Photo library' },
  { id: 'document', title: 'Choose document' },
];

export type AttachMenuProps = {
  /** Square trigger size in points; the menu reserves exactly this space. */
  size: number;
  onSelect: (action: AttachAction) => void;
  children: ReactElement;
};
