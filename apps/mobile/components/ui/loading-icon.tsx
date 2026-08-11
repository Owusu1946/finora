import { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';

import { Icon } from '@/components/ui/icon';

export function LoadingIcon({
  color,
  size = 20,
  style,
}: {
  color: string;
  size?: number | 'small' | 'large';
  style?: StyleProp<ViewStyle>;
}) {
  const rotation = useRef(new Animated.Value(0)).current;
  const resolvedSize = size === 'small' ? 16 : size === 'large' ? 24 : size;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    animation.start();
    return () => animation.stop();
  }, [rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      accessible
      accessibilityLabel='Loading'
      accessibilityRole='progressbar'
      style={[
        {
          width: resolvedSize,
          height: resolvedSize,
          alignSelf: 'center',
          transform: [{ rotate }],
        },
        style,
      ]}
    >
      <Icon
        name='loading'
        size={resolvedSize}
        color={color}
      />
    </Animated.View>
  );
}
