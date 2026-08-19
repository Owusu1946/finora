import type { OrbState } from '@mhaadi/thinking-orbs-native';

export type ChatActivity = {
  orbState: OrbState;
  label: string;
};

type ActivityPart = {
  type?: string;
  toolName?: string;
  status?: { type?: string };
};

const TOOL_ACTIVITY: Record<string, ChatActivity> = {
  get_gmail_status: { orbState: 'connecting', label: 'Checking Gmail connection...' },
  search_gmail_messages: { orbState: 'searching', label: 'Searching Gmail...' },
  find_gmail_invoices: { orbState: 'searching', label: 'Searching Gmail for invoices...' },
  get_gmail_message: { orbState: 'searching', label: 'Reading the selected email...' },
  get_balances: { orbState: 'solving', label: 'Checking your balances...' },
  prepare_conversion: { orbState: 'shaping', label: 'Preparing the currency conversion...' },
  prepare_payment: { orbState: 'shaping', label: 'Preparing the payment...' },
  prepare_internal_transfer: { orbState: 'shaping', label: 'Preparing the internal transfer...' },
  prepare_supplier_payment: { orbState: 'shaping', label: 'Preparing the supplier payment...' },
  prepare_employee_payment: { orbState: 'shaping', label: 'Preparing the employee payment...' },
  prepare_payroll: { orbState: 'shaping', label: 'Preparing payroll...' },
  prepare_recurring: { orbState: 'shaping', label: 'Preparing the recurring payment...' },
  create_financial_plan: { orbState: 'weaving', label: 'Building your financial plan...' },
  create_virtual_card: { orbState: 'shaping', label: 'Preparing the virtual card...' },
  get_virtual_card: { orbState: 'working', label: 'Loading your virtual card...' },
  list_invoices: { orbState: 'searching', label: 'Checking your invoices...' },
  list_expenses: { orbState: 'searching', label: 'Loading your expenses...' },
  list_calendar_dues: { orbState: 'searching', label: 'Checking upcoming dues...' },
  list_sms_requests: { orbState: 'searching', label: 'Checking payment requests...' },
  list_employees: { orbState: 'searching', label: 'Loading employees...' },
  list_suppliers: { orbState: 'searching', label: 'Loading suppliers...' },
  list_beneficiaries: { orbState: 'searching', label: 'Loading beneficiaries...' },
  list_policies: { orbState: 'searching', label: 'Checking your policies...' },
  list_receive_methods: { orbState: 'searching', label: 'Loading receive methods...' },
  list_virtual_accounts: { orbState: 'searching', label: 'Loading virtual accounts...' },
  list_virtual_cards: { orbState: 'searching', label: 'Loading virtual cards...' },
  list_automations: { orbState: 'searching', label: 'Loading automations...' },
  get_treasury_overview: { orbState: 'solving', label: 'Preparing your treasury overview...' },
  financial_report: { orbState: 'solving', label: 'Preparing your financial report...' },
  generate_financial_insights: {
    orbState: 'solving',
    label: 'Preparing your financial insights...',
  },
  resolve_send: { orbState: 'solving', label: 'Working out the payment details...' },
  fund_account: { orbState: 'shaping', label: 'Preparing the funding flow...' },
  create_payment_request: { orbState: 'shaping', label: 'Preparing the payment request...' },
  generate_payment_link: { orbState: 'shaping', label: 'Preparing the payment link...' },
  create_employee: { orbState: 'shaping', label: 'Preparing the employee profile...' },
  schedule_payment_wizard: { orbState: 'shaping', label: 'Preparing the scheduled payment...' },
};

const DEFAULT_ACTIVITY: ChatActivity = { orbState: 'working', label: 'Working on that...' };
const REASONING_ACTIVITY: ChatActivity = { orbState: 'solving', label: 'Thinking through that...' };
const COMPOSING_ACTIVITY: ChatActivity = { orbState: 'composing', label: 'Writing a response...' };
const APPROVAL_ACTIVITY: ChatActivity = {
  orbState: 'breathing',
  label: 'Waiting for your approval...',
};

function toolActivity(toolName: string) {
  return (
    TOOL_ACTIVITY[toolName] ?? {
      ...DEFAULT_ACTIVITY,
      label: `${toolName.replaceAll('_', ' ').replace(/^./, (character) => character.toUpperCase())}...`,
    }
  );
}

export function resolveChatActivity(parts: readonly unknown[]): ChatActivity {
  const activityParts = parts as ActivityPart[];
  const approvalTool = [...activityParts]
    .reverse()
    .find((part) => part.type === 'tool-call' && part.status?.type === 'requires-action');
  if (approvalTool) return APPROVAL_ACTIVITY;

  const activeTool = [...activityParts]
    .reverse()
    .find((part) => part.type === 'tool-call' && part.status?.type === 'running');
  if (activeTool?.toolName) return toolActivity(activeTool.toolName);

  if (activityParts.some((part) => part.type === 'reasoning')) return REASONING_ACTIVITY;
  return activityParts.some((part) => part.type === 'text')
    ? COMPOSING_ACTIVITY
    : REASONING_ACTIVITY;
}
