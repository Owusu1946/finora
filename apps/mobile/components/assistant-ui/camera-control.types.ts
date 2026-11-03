/** What a camera control does; each platform picks its own icon for it. */
export type CameraControlKind = 'back' | 'more' | 'close' | 'flash-on' | 'flash-off' | 'flip';

export type CameraControlProps = {
  kind: CameraControlKind;
  label: string;
  onPress: () => void;
};

export const CAMERA_CONTROL_SIZE = 48;
