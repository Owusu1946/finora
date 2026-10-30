import { makeAssistantToolUI } from '@assistant-ui/react-native';

import { ConnectOptionsCard, connectOptionsFrom } from '@/components/chat/ConnectOptionsCard';

/**
 * Tools that answer in text but need an app the user may not have connected.
 * They show nothing on success; when the result carries connect options, the
 * chat shows a Connect card in place.
 */
const CONNECT_FALLBACK_TOOLS = [
  'get_business_payments',
  'get_business_balances',
  'find_app_actions',
  'run_app_action',
  'get_gmail_status',
  'search_gmail_messages',
  'get_gmail_message',
  'find_gmail_invoices',
  'search_drive_files',
  'get_drive_file',
] as const;

const CONNECT_FALLBACK_UIS = CONNECT_FALLBACK_TOOLS.map((toolName) =>
  makeAssistantToolUI<Record<string, unknown>, unknown>({
    toolName,
    display: 'standalone',
    render: ({ result }) => {
      const options = connectOptionsFrom(result);
      return options.length > 0 ? <ConnectOptionsCard options={options} /> : null;
    },
  }),
);

export function ConnectFallbackToolUIs() {
  return (
    <>
      {CONNECT_FALLBACK_UIS.map((ToolUI, index) => (
        <ToolUI key={CONNECT_FALLBACK_TOOLS[index]} />
      ))}
    </>
  );
}
