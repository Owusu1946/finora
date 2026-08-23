import { Pressable, View } from 'react-native';

import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PURPOSE_CODE_LABELS, PURPOSE_CODES, type PurposeCode } from '@/lib/send-corridors';

export function PurposeCodeStep({
  step,
  total,
  purposeCode,
  onSelect,
  onBack,
  onContinue,
}: {
  step: number;
  total: number;
  purposeCode: PurposeCode | null;
  onSelect: (code: PurposeCode) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  const { colors } = useTheme();

  return (
    <View className='gap-3'>
      <WizardStepHeader
        step={step}
        total={total}
        title='Payment purpose'
        subtitle='Required for cross-border compliance'
      />
      <View className='flex-row flex-wrap gap-2'>
        {PURPOSE_CODES.map((code) => (
          <WizardChip
            key={code}
            label={PURPOSE_CODE_LABELS[code]}
            selected={purposeCode === code}
            onPress={() => onSelect(code)}
          />
        ))}
      </View>
      <View className='flex-row gap-2.5 mt-1'>
        <Pressable
          onPress={onBack}
          className='flex-1 min-h-[46px] border items-center justify-center'
          style={({ pressed }) => [{ borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
        >
          <Text className='text-[16px] font-semibold text-foreground'>Back</Text>
        </Pressable>
        <Pressable
          disabled={!purposeCode}
          onPress={onContinue}
          className='flex-[1.4] min-h-[46px] items-center justify-center'
          style={({ pressed }) => [
            {
              backgroundColor: colors.foreground,
              opacity: !purposeCode ? 0.4 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text className='text-[16px] font-semibold text-background'>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = {
  navBtn: {
    borderRadius: Radius.composer,
  },
  navBtnPrimary: {
    borderRadius: Radius.composer,
  },
};
