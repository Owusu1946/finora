import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  PaymentConfirmationCard,
  type PaymentConfirmation,
  type PaymentConfirmationStatus,
} from '@/components/chat/PaymentConfirmationCard';
import { WizardChip, WizardStepHeader } from '@/components/chat/WizardChrome';
import type { Contact } from '@/components/contacts/types';
import { AVATAR_COLORS } from '@/components/contacts/types';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  appendAgentFollowUp,
  paymentSentFollowUp,
} from '@/lib/agent-follow-up';
import { contactToPaymentDestination } from '@/lib/contact-lookup';
import { findContactByIdentifier, saveContact } from '@/lib/contacts-storage';
import { haptics } from '@/lib/haptics';
import { recordSentPayment } from '@/lib/transactions-storage';

export type ResolveSendCandidate = {
  id: string;
  name: string;
  initials: string;
  currency: string;
  method: string;
  identifier: string;
};

type ResolveSendArgs = {
  queryName?: string;
  amount?: number;
  currency?: string;
  candidates?: ResolveSendCandidate[];
  reference?: string;
};

type ResolveSendResult = {
  status?: 'sent' | 'cancelled';
  transactionId?: string;
  contactId?: string;
};

type Phase = 'pick' | 'amount' | 'confirm';

function mockTransactionId() {
  const n = Math.floor(Math.random() * 1e8)
    .toString(16)
    .padStart(8, '0')
    .toUpperCase();
  return `WW-${n}`;
}

function toContact(c: ResolveSendCandidate): Contact {
  return {
    id: c.id,
    name: c.name,
    initials: c.initials,
    currency: c.currency as Contact['currency'],
    method: c.method,
    identifier: c.identifier,
    favourite: false,
    lastTxDate: null,
  };
}

function ResolveSendFlow({
  seed,
  onFinished,
  onCancelled,
}: {
  seed: ResolveSendArgs;
  onFinished: (payload: { transactionId: string; contactId: string }) => void;
  onCancelled: () => void;
}) {
  const { colors } = useTheme();
  const aui = useAui();
  const router = useRouter();
  const { requestApproval, modal } = usePasscodeApproval();

  const candidates = seed.candidates ?? [];
  const [contact, setContact] = useState<ResolveSendCandidate | null>(
    candidates.length === 1 ? candidates[0]! : null,
  );
  const [amount, setAmount] = useState<number | null>(seed.amount ?? null);
  const [currency, setCurrency] = useState(
    seed.currency ?? candidates[0]?.currency ?? 'GHS',
  );
  const [customAmount, setCustomAmount] = useState('');
  const [phase, setPhase] = useState<Phase>(() => {
    if (candidates.length > 1) return 'pick';
    if (seed.amount == null) return 'amount';
    return 'confirm';
  });
  const [localStatus, setLocalStatus] = useState<PaymentConfirmationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendingStep, setSendingStep] = useState(0);
  const [transactionId, setTransactionId] = useState<string | undefined>();
  const [txRecordId, setTxRecordId] = useState<string | null>(null);
  const [contactSaved, setContactSaved] = useState(false);
  const finishedRef = useRef(false);
  const followedUpRef = useRef(false);

  const payment: PaymentConfirmation | null = useMemo(() => {
    if (!contact || amount == null) return null;
    const dest = contactToPaymentDestination(toContact(contact));
    return {
      amount,
      currency: currency || contact.currency,
      recipientName: contact.name,
      destination: dest,
      reference: seed.reference ?? `To ${contact.name}`,
    };
  }, [contact, amount, currency, seed.reference]);

  const status = localStatus ?? 'pending';

  useEffect(() => {
    if (!payment) return;
    void findContactByIdentifier(payment.destination.value).then((existing) => {
      if (existing) setContactSaved(true);
    });
  }, [payment]);

  useEffect(() => {
    if (status !== 'sending' || !payment || !contact) return;
    let cancelled = false;
    const run = async () => {
      for (let step = 0; step < 3; step++) {
        if (cancelled) return;
        setSendingStep(step);
        await new Promise((r) => setTimeout(r, step === 0 ? 650 : 750));
      }
      if (cancelled || finishedRef.current) return;
      const txId = mockTransactionId();
      finishedRef.current = true;
      setTransactionId(txId);
      setLocalStatus('sent');
      haptics.success();
      onFinished({ transactionId: txId, contactId: contact.id });
      const recorded = await recordSentPayment({
        payment,
        transactionId: txId,
        source: 'chat',
      });
      if (!cancelled) setTxRecordId(recorded.id);
      if (!followedUpRef.current) {
        followedUpRef.current = true;
        appendAgentFollowUp(aui, paymentSentFollowUp(payment, txId));
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [aui, contact, onFinished, payment, status]);

  if (phase === 'pick') {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.composer, borderColor: colors.border },
        ]}
      >
        <WizardStepHeader
          step={1}
          total={seed.amount == null ? 3 : 2}
          title={`Who did you mean by “${seed.queryName ?? 'them'}”?`}
          subtitle={`${candidates.length} contacts match — pick one to continue.`}
        />
        <View style={styles.list}>
          {candidates.map((c, index) => (
            <Pressable
              key={c.id}
              onPress={() => {
                haptics.selection();
                setContact(c);
                setCurrency(seed.currency ?? c.currency);
                setPhase(seed.amount == null ? 'amount' : 'confirm');
              }}
              style={({ pressed }) => [
                styles.contactRow,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View
                style={[
                  styles.avatar,
                  { backgroundColor: AVATAR_COLORS[index % AVATAR_COLORS.length] },
                ]}
              >
                <Text style={styles.initials}>{c.initials}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.contactName, { color: colors.foreground }]}>{c.name}</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                  {c.method} · {c.identifier}
                </Text>
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{c.currency}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          onPress={() => {
            haptics.selection();
            onCancelled();
          }}
        >
          <Text style={{ color: colors.mutedForeground, fontWeight: '600', textAlign: 'center' }}>
            Cancel
          </Text>
        </Pressable>
      </View>
    );
  }

  if (phase === 'amount' && contact) {
    return (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.composer, borderColor: colors.border },
        ]}
      >
        <WizardStepHeader
          step={candidates.length > 1 ? 2 : 1}
          total={candidates.length > 1 ? 3 : 2}
          title={`How much to ${contact.name}?`}
          subtitle={`${contact.method} · ${contact.identifier}`}
        />
        <View style={styles.chips}>
          {[50, 100, 250, 500, 1000].map((a) => (
            <WizardChip
              key={a}
              label={`${currency} ${a}`}
              selected={amount === a}
              onPress={() => {
                setAmount(a);
                setPhase('confirm');
              }}
            />
          ))}
        </View>
        <TextInput
          value={customAmount}
          onChangeText={setCustomAmount}
          keyboardType='decimal-pad'
          placeholder='Custom amount'
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        />
        <Pressable
          onPress={() => {
            const n = Number(customAmount);
            if (!Number.isFinite(n) || n <= 0) return;
            haptics.selection();
            setAmount(n);
            setPhase('confirm');
          }}
          style={[styles.primaryBtn, { backgroundColor: colors.foreground }]}
        >
          <Text style={{ color: colors.background, fontWeight: '600' }}>Continue</Text>
        </Pressable>
        {candidates.length > 1 ? (
          <Pressable
            onPress={() => {
              haptics.selection();
              setPhase('pick');
            }}
          >
            <Text
              style={{ color: colors.mutedForeground, fontWeight: '600', textAlign: 'center' }}
            >
              Change contact
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  if (!payment) return null;

  return (
    <>
      {(candidates.length > 1 || seed.amount == null) && status === 'pending' ? (
        <Pressable
          onPress={() => {
            haptics.selection();
            setPhase(seed.amount == null ? 'amount' : 'pick');
          }}
          style={styles.editLink}
        >
          <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>← Edit</Text>
        </Pressable>
      ) : null}
      <PaymentConfirmationCard
        payment={payment}
        status={status}
        loading={busy}
        sendingStep={sendingStep}
        transactionId={transactionId}
        contactSaved={contactSaved}
        onViewDetails={
          status === 'sent' && (txRecordId || transactionId)
            ? () => router.push(`/transaction/${txRecordId ?? transactionId}` as Href)
            : undefined
        }
        onSaveContact={
          status === 'sent'
            ? async () => {
                await saveContact({
                  name: payment.recipientName,
                  currency: payment.currency,
                  method: payment.destination.label,
                  identifier: payment.destination.value,
                });
                setContactSaved(true);
                haptics.success();
              }
            : undefined
        }
        onConfirm={async () => {
          if (status !== 'pending' || busy) return;
          setBusy(true);
          const ok = await requestApproval();
          setBusy(false);
          if (!ok) return;
          setSendingStep(0);
          finishedRef.current = false;
          setLocalStatus('sending');
        }}
        onCancel={() => {
          if (status !== 'pending') return;
          onCancelled();
        }}
      />
      {modal}
    </>
  );
}

export const ResolveSendToolUI = makeAssistantToolUI<ResolveSendArgs, ResolveSendResult>({
  toolName: 'resolve_send',
  display: 'standalone',
  render: ({ args, status, addResult }) => {
    const { colors } = useTheme();
    const hasCandidates = (args?.candidates?.length ?? 0) > 0;

    if (status.type === 'running' && !hasCandidates) {
      return (
        <View
          style={[
            styles.preparing,
            { borderColor: colors.border, backgroundColor: colors.composer },
          ]}
        >
          <ActivityIndicator color={colors.mutedForeground} />
        </View>
      );
    }

    return (
      <ResolveSendFlow
        seed={args ?? {}}
        onFinished={({ transactionId, contactId }) => {
          addResult({ status: 'sent', transactionId, contactId });
        }}
        onCancelled={() => {
          addResult({ status: 'cancelled' });
        }}
      />
    );
  },
});

const styles = StyleSheet.create({
  card: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.card,
    padding: 16,
    gap: 14,
    marginVertical: 8,
  },
  preparing: {
    marginVertical: 8,
    minHeight: 72,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: 8,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: Radius.composer,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.composer,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '500',
  },
  primaryBtn: {
    minHeight: 46,
    borderRadius: Radius.composer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editLink: {
    marginLeft: 8,
    marginBottom: 2,
  },
});
