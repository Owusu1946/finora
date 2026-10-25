import { View } from 'react-native';
import {
  Extrapolation,
  type SharedValue,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';

import type { Palette } from '@/constants/theme';

import { Icon } from '@/components/ui/icon';

type AccountDiscsProps = {
  progress: SharedValue<number>;
  /** 0 = none, 1 = personal (left), 2 = business (right) */
  selection: SharedValue<number>;
  /** Horizontal center of the hero slot, in slot coords. */
  cx: number;
  colors: Palette;
};

const CHIP = 72;
const SPREAD = 74;

const chipBase = {
  width: CHIP,
  height: CHIP,
  borderRadius: CHIP / 2,
  left: -CHIP / 2,
  top: -CHIP / 2,
  borderWidth: 1,
} as const;

const iconCenter = {
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

/**
 * Hero discs for the account step: two icon chips that split apart as the
 * pager lands on the last beat; the chosen side lights up and grows.
 */
export function AccountDiscs({ progress, selection, cx, colors }: AccountDiscsProps) {
  const sep = useDerivedValue(() =>
    interpolate(progress.value, [2.4, 3], [8, SPREAD], Extrapolation.CLAMP),
  );
  const reveal = useDerivedValue(() =>
    interpolate(progress.value, [2.35, 2.75, 3], [0, 1, 1], Extrapolation.CLAMP),
  );

  const leftAmount = useDerivedValue(() =>
    interpolate(selection.value, [0.4, 0.6, 1.4, 1.6], [0, 1, 1, 0], Extrapolation.CLAMP),
  );
  const rightAmount = useDerivedValue(() =>
    interpolate(selection.value, [1.4, 1.6], [0, 1], Extrapolation.CLAMP),
  );

  const leftDisc = useAnimatedStyle(() => ({
    opacity: reveal.value,
    backgroundColor: interpolateColor(leftAmount.value, [0, 1], [colors.muted, colors.foreground]),
    borderColor: interpolateColor(leftAmount.value, [0, 1], [colors.border, colors.foreground]),
    transform: [{ translateX: -sep.value }, { scale: 1 + 0.12 * leftAmount.value }],
  }));
  const rightDisc = useAnimatedStyle(() => ({
    opacity: reveal.value,
    backgroundColor: interpolateColor(rightAmount.value, [0, 1], [colors.muted, colors.foreground]),
    borderColor: interpolateColor(rightAmount.value, [0, 1], [colors.border, colors.foreground]),
    transform: [{ translateX: sep.value }, { scale: 1 + 0.12 * rightAmount.value }],
  }));

  const leftDim = useAnimatedStyle(() => ({ opacity: 1 - leftAmount.value }));
  const leftLit = useAnimatedStyle(() => ({ opacity: leftAmount.value }));
  const rightDim = useAnimatedStyle(() => ({ opacity: 1 - rightAmount.value }));
  const rightLit = useAnimatedStyle(() => ({ opacity: rightAmount.value }));

  return (
    <View
      className='h-0 w-0'
      style={{ position: 'absolute', left: cx, top: '50%' }}
    >
      <View className='absolute h-0 w-0 items-center justify-center'>
        {/* Left disc: personal */}
        <View
          className='absolute items-center justify-center overflow-hidden'
          style={[chipBase, leftDisc]}
        >
          <View style={iconCenter}>
            <View style={[iconCenter, leftDim]}>
              <Icon
                name='user'
                size={24}
                color={colors.mutedForeground}
              />
            </View>
            <View style={[iconCenter, leftLit]}>
              <Icon
                name='user'
                size={24}
                color={colors.background}
              />
            </View>
          </View>
        </View>

        {/* Right disc: business */}
        <View
          className='absolute items-center justify-center overflow-hidden'
          style={[chipBase, rightDisc]}
        >
          <View style={iconCenter}>
            <View style={[iconCenter, rightDim]}>
              <Icon
                name='bank'
                size={24}
                color={colors.mutedForeground}
              />
            </View>
            <View style={[iconCenter, rightLit]}>
              <Icon
                name='bank'
                size={24}
                color={colors.background}
              />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
