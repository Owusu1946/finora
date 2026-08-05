import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  PURPOSE_CODE_LABELS,
  PURPOSE_CODES,
  type PurposeCode,
} from '@/lib/send-corridors';

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
    <View style={styles.block}>
      <WizardStepHeader
        step={step}
        total={total}
        title='Payment purpose'
        subtitle='Required for cross-border compliance'
      />
      <View style={styles.chips}>
        {PURPOSE_CODES.map((code) => (
          <WizardChip
            key={code}
            label={PURPOSE_CODE_LABELS[code]}
            selected={purposeCode === code}
            onPress={() => onSelect(code)}
          />
        ))}
      </View>
      <View style={styles.nav}>
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [
            styles.navBtn,
            { borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Text style={[styles.navLabel, { color: colors.foreground }]}>Back</Text>
        </Pressable>
        <Pressable
          disabled={!purposeCode}
          onPress={onContinue}
          style={({ pressed }) => [
            styles.navBtnPrimary,
            {
              backgroundColor: colors.foreground,
              opacity: !purposeCode ? 0.4 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.navLabelPrimary, { color: colors.background }]}>Continue</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  nav: { flexDirection: 'row', gap: 10, marginTop: 4 },
  navBtn: {
    flex: 1,
    minHeight: 46,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnPrimary: {
    flex: 1.4,
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: { fontSize: 15, fontWeight: '600' },
  navLabelPrimary: { fontSize: 15, fontWeight: '600' },
});
