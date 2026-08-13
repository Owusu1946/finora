import {
  SettingsScreen,
  SettingsSection,
  SettingsSwitchRow,
} from '@/components/settings/SettingsPrimitives';
import { useSettings } from '@/lib/settings-context';

export default function NotificationsSettingsScreen() {
  const { settings, loading, update, t } = useSettings();

  return (
    <SettingsScreen loading={loading}>
      <SettingsSection footer={t('notif_footer')}>
        <SettingsSwitchRow
          label={t('settings_approvals_label')}
          detail={t('notif_approvals_detail')}
          value={settings.notifications.approvals}
          onValueChange={(v) =>
            void update({ notifications: { ...settings.notifications, approvals: v } })
          }
        />
        <SettingsSwitchRow
          label='Payments'
          detail={t('notif_payments_detail')}
          value={settings.notifications.payments}
          onValueChange={(v) =>
            void update({ notifications: { ...settings.notifications, payments: v } })
          }
        />
        <SettingsSwitchRow
          label={t('nav_invoices')}
          detail={t('notif_invoices_detail')}
          value={settings.notifications.invoices}
          onValueChange={(v) =>
            void update({ notifications: { ...settings.notifications, invoices: v } })
          }
        />
        <SettingsSwitchRow
          label={t('notif_tips_label')}
          detail={t('notif_tips_detail')}
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
