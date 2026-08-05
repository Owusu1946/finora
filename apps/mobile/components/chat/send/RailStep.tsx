import { StyleSheet, View } from 'react-native';

import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import {
  SETTLEMENT_METHOD_LABELS,
  type SettlementMethod,
} from '@/lib/send-corridors';

export function RailStep({
  step,
  total,
  rails,
  selected,
  onSelect,
  countryName,
}: {
  step: number;
  total: number;
  rails: SettlementMethod[];
  selected: SettlementMethod | null;
  onSelect: (rail: SettlementMethod) => void;
  countryName?: string;
}) {
  return (
    <View style={styles.block}>
      <WizardStepHeader
        step={step}
        total={total}
        title='How should it arrive?'
        subtitle={
          countryName
            ? `Payment rails available for ${countryName}`
            : 'Choose the settlement rail'
        }
      />
      <View style={styles.chips}>
        {rails.map((rail) => (
          <WizardChip
            key={rail}
            label={SETTLEMENT_METHOD_LABELS[rail]}
            selected={selected === rail}
            onPress={() => onSelect(rail)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
