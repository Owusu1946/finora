import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import {
  PaymentRequestCard,
  PaymentRequestWizard,
  type PaymentRequestResult,
  type PaymentRequestSeed,
} from '@/components/chat/PaymentRequestCard';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type CreatePaymentRequestArgs = PaymentRequestSeed;

type CreatePaymentRequestResult = {
  status?: 'created' | 'cancelled';
  request?: PaymentRequestResult;
};

function PaymentRequestToolRender({
  args,
  status,
  result,
  addResult,
}: {
  args: CreatePaymentRequestArgs | undefined;
  status: { type: string };
  result?: CreatePaymentRequestResult;
  addResult: (result: CreatePaymentRequestResult) => void;
}) {
  const { colors } = useTheme();

  if (result?.status === 'cancelled') return null;
  if (result?.request) return <PaymentRequestCard request={result.request} />;

  if (status.type === 'running' && args == null) {
    return (
      <View
        style={[styles.preparing, { borderColor: colors.border, backgroundColor: colors.composer }]}
      >
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    );
  }

  return (
    <PaymentRequestWizard
      seed={args ?? {}}
      onCreated={(request) => {
        addResult({ status: 'created', request });
      }}
      onCancelled={() => {
        addResult({ status: 'cancelled' });
      }}
    />
  );
}

export const CreatePaymentRequestToolUI = makeAssistantToolUI<
  CreatePaymentRequestArgs,
  CreatePaymentRequestResult
>({
  toolName: 'create_payment_request',
  display: 'standalone',
  render: (props) => <PaymentRequestToolRender {...props} />,
});

/** Registry mobile surface alias — same UX as create_payment_request. */
export const GeneratePaymentLinkToolUI = makeAssistantToolUI<
  CreatePaymentRequestArgs,
  CreatePaymentRequestResult
>({
  toolName: 'generate_payment_link',
  display: 'standalone',
  render: (props) => <PaymentRequestToolRender {...props} />,
});

const styles = StyleSheet.create({
  preparing: {
    marginVertical: 8,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
