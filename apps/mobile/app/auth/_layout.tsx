import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // Native push/pop slide, not crossfade
        animation: 'slide_from_right',
        // Back gesture responds anywhere on the screen, not just the edge
        fullScreenGestureEnabled: true,
        gestureEnabled: true,
      }}
    />
  );
}
