import {
  SettingsScreen,
  SettingsSection,
  SettingsSwitchRow,
} from '@/components/settings/SettingsPrimitives';
import { useSettings } from '@/lib/settings-context';

export default function NotificationsSettingsScreen() {
  const { settings, loading, update } = useSettings();

  return (
    <SettingsScreen loading={loading}>
      <SettingsSection footer='Agent prepares always land in Approvals, even if alerts are off.'>
        <SettingsSwitchRow
          label='Approvals'
          detail='When an agent prepares a payment or plan'
          value={settings.notifications.approvals}
          onValueChange={(v) =>
            void update({ notifications: { ...settings.notifications, approvals: v } })
          }
        />
        <SettingsSwitchRow
          label='Payments'
          detail='Sent, received, and failed transfers'
          value={settings.notifications.payments}
          onValueChange={(v) =>
            void update({ notifications: { ...settings.notifications, payments: v } })
          }
        />
        <SettingsSwitchRow
          label='Invoices'
          detail='New or due supplier invoices from Gmail'
          value={settings.notifications.invoices}
          onValueChange={(v) =>
            void update({ notifications: { ...settings.notifications, invoices: v } })
          }
        />
        <SettingsSwitchRow
          label='Tips & product'
          detail='Occasional product updates'
          value={settings.notifications.marketing}
          onValueChange={(v) =>
            void update({ notifications: { ...settings.notifications, marketing: v } })
          }
          isLast
        />
      </SettingsSection>
    </SettingsScreen>
  );
}
