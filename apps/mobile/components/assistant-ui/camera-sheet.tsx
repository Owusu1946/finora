import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import { useRef, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/icon';
import { SheetModal } from '@/components/ui/sheet-modal';
import { AppText as Text } from '@/components/ui/text';
import { haptics } from '@/lib/haptics';

import { CameraControl } from './camera-control';
import { CAMERA_CONTROL_SIZE } from './camera-control.types';

const SHUTTER_SIZE = 78;

/** Longest edge we capture at: sharp enough for receipts, small enough to upload fast. */
const MAX_PHOTO_EDGE = 2048;

export type CapturedPhoto = { uri: string; width: number; height: number };

/** Largest supported `WxH` picture size whose longest edge fits `MAX_PHOTO_EDGE`. */
function pickPictureSize(sizes: string[]) {
  let best: { size: string; area: number } | null = null;
  for (const size of sizes) {
    const match = /^(\d+)x(\d+)$/.exec(size);
    if (!match) continue;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (Math.max(width, height) > MAX_PHOTO_EDGE) continue;
    if (!best || width * height > best.area) best = { size, area: width * height };
  }
  return best?.size;
}

function PermissionPrompt({
  canAskAgain,
  onRequest,
}: {
  canAskAgain: boolean;
  onRequest: () => void;
}) {
  return (
    <View style={styles.permission}>
      <Icon
        name='camera'
        size={28}
        color='#ffffff'
      />
      <Text className='font-sans-semibold text-lg text-white'>Allow camera access</Text>
      <Text className='text-center font-sans-medium text-[15px] leading-5 text-white/70'>
        Take a photo of a receipt, invoice, or document to attach it to your chat.
      </Text>
      <Pressable
        accessibilityRole='button'
        onPress={() => (canAskAgain ? onRequest() : void Linking.openSettings())}
        style={({ pressed }) => [styles.permissionButton, { opacity: pressed ? 0.8 : 1 }]}
      >
        <Text className='font-sans-semibold text-[16px] text-black'>
          {canAskAgain ? 'Continue' : 'Open Settings'}
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Native sheet with a live camera card. The "more" control reveals the light and
 * flip; the shutter hands the photo back to the composer.
 */
export function CameraSheet({
  visible,
  onClose,
  onCapture,
}: {
  visible: boolean;
  onClose: () => void;
  onCapture: (photo: CapturedPhoto) => void;
}) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  // A torch, not a capture flash: it lights the scene as soon as it is on, and
  // the capture flash was silently dropped by the upload-sized photo preset.
  const [light, setLight] = useState(false);
  const lightAvailable = facing === 'back';
  const [controlsOpen, setControlsOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [pictureSize, setPictureSize] = useState<string>();
  // Keep the controls clear of the home indicator now the camera runs to the edge.
  const barBottom = Math.max(useSafeAreaInsets().bottom, 16) + 8;

  const close = () => {
    setControlsOpen(false);
    setLight(false);
    setReady(false);
    onClose();
  };

  const capture = async () => {
    if (!ready || capturing || !cameraRef.current) return;
    setCapturing(true);
    haptics.impact();
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        close();
        onCapture({ uri: photo.uri, width: photo.width, height: photo.height });
      }
    } finally {
      setCapturing(false);
    }
  };

  return (
    <SheetModal
      visible={visible}
      onClose={close}
      showHandle={false}
      detents={[{ fraction: 0.7 }]}
      edgeToEdge
      backgroundColor='#000000'
      style={styles.sheet}
    >
      {visible && permission?.granted ? (
        <CameraView
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          facing={facing}
          enableTorch={light && lightAvailable}
          animateShutter
          pictureSize={pictureSize}
          onCameraReady={() => {
            setReady(true);
            void cameraRef.current
              ?.getAvailablePictureSizesAsync()
              .then((sizes) => setPictureSize(pickPictureSize(sizes)))
              .catch(() => undefined);
          }}
        />
      ) : null}

      {permission && !permission.granted ? (
        <PermissionPrompt
          canAskAgain={permission.canAskAgain}
          onRequest={() => void requestPermission()}
        />
      ) : null}

      {controlsOpen ? (
        <Animated.View
          entering={FadeInDown.duration(180)}
          exiting={FadeOutDown.duration(140)}
          style={[
            styles.controlStack,
            { bottom: barBottom + SHUTTER_SIZE / 2 + CAMERA_CONTROL_SIZE / 2 + 12 },
          ]}
        >
          {/* The front camera has no light; hide the control instead of a dead button. */}
          {lightAvailable ? (
            <CameraControl
              kind={light ? 'flash-on' : 'flash-off'}
              label={light ? 'Turn light off' : 'Turn light on'}
              onPress={() => setLight((value) => !value)}
            />
          ) : null}
          <CameraControl
            kind='flip'
            label='Flip camera'
            onPress={() => setFacing((value) => (value === 'back' ? 'front' : 'back'))}
          />
        </Animated.View>
      ) : null}

      <View style={[styles.bottomBar, { bottom: barBottom }]}>
        <CameraControl
          kind='back'
          label='Close camera'
          onPress={close}
        />
        <Pressable
          accessibilityRole='button'
          accessibilityLabel='Take photo'
          disabled={!ready || capturing}
          onPress={() => void capture()}
          style={[styles.shutterRing, { opacity: ready ? 1 : 0.5 }]}
        >
          {({ pressed }) => (
            <View style={[styles.shutter, { transform: [{ scale: pressed ? 0.92 : 1 }] }]} />
          )}
        </Pressable>
        <CameraControl
          kind={controlsOpen ? 'close' : 'more'}
          label={controlsOpen ? 'Hide camera options' : 'Camera options'}
          onPress={() => setControlsOpen((open) => !open)}
        />
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  // Edge to edge: the native sheet's own rounded corners clip the camera.
  sheet: {
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  bottomBar: {
    position: 'absolute',
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  controlStack: {
    position: 'absolute',
    right: 20,
    gap: 12,
  },
  shutterRing: {
    width: SHUTTER_SIZE,
    height: SHUTTER_SIZE,
    borderRadius: SHUTTER_SIZE / 2,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutter: {
    width: SHUTTER_SIZE - 14,
    height: SHUTTER_SIZE - 14,
    borderRadius: (SHUTTER_SIZE - 14) / 2,
    backgroundColor: '#ffffff',
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 32,
    paddingBottom: SHUTTER_SIZE,
  },
  permissionButton: {
    marginTop: 6,
    paddingHorizontal: 20,
    minHeight: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});
