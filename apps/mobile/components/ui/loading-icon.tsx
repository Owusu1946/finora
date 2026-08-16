import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

export function LoadingIcon({
  color,
  size = 20,
  style,
}: {
  color: string;
  size?: number | 'small' | 'large';
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const [reducedMotion, setReducedMotion] = useState(false);
  const resolvedSize = size === 'small' ? 16 : size === 'large' ? 24 : size;
  const strokeWidth = Math.max(2, resolvedSize * 0.12);
  const radius = (resolvedSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReducedMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReducedMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    progress.setValue(0);

    const animation = reducedMotion
      ? Animated.loop(
          Animated.sequence([
            Animated.timing(progress, {
              toValue: 1,
              duration: 700,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
              isInteraction: false,
            }),
            Animated.timing(progress, {
              toValue: 0,
              duration: 700,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: true,
              isInteraction: false,
            }),
          ]),
        )
      : Animated.loop(
          Animated.timing(progress, {
            toValue: 1,
            duration: 700,
            easing: Easing.linear,
            useNativeDriver: true,
            isInteraction: false,
          }),
        );

    animation.start();
    return () => animation.stop();
  }, [progress, reducedMotion]);

  const animatedStyle = reducedMotion
    ? {
        opacity: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [0.45, 1],
        }),
      }
    : {
        transform: [
          {
            rotate: progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', '360deg'],
            }),
          },
        ],
      };

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
        },
        animatedStyle,
        style,
      ]}
    >
      <Svg
        width={resolvedSize}
        height={resolvedSize}
        viewBox={`0 0 ${resolvedSize} ${resolvedSize}`}
      >
        <Circle
          cx={resolvedSize / 2}
          cy={resolvedSize / 2}
          r={radius}
          fill='none'
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap='round'
          strokeDasharray={`${circumference * 0.28} ${circumference * 0.72}`}
          transform={`rotate(-90 ${resolvedSize / 2} ${resolvedSize / 2})`}
        />
      </Svg>
    </Animated.View>
  );
}
