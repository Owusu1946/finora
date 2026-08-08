import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { PaymentConfirmation } from '@/components/chat/PaymentConfirmationCard';
import type { PaymentConfirmationStatus } from '@/components/chat/PaymentConfirmationCard';
import type { Contact } from '@/components/contacts/types';

import { SendMoneyWizard, type SendMoneySeed } from '@/components/chat/SendMoneyWizard';
import { WizardStepHeader } from '@/components/chat/WizardChrome';
import { AVATAR_COLORS } from '@/components/contacts/types';
import { usePasscodeApproval } from '@/components/passcode/use-passcode-approval';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendAgentFollowUp, paymentSentFollowUp } from '@/lib/agent-follow-up';
import { contactToSendSeed, findContactsByName } from '@/lib/contact-lookup';
import { findContactByIdentifier, listContacts, saveContact } from '@/lib/contacts-storage';
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
  destinationCountry?: string;
  settlementMethod?: SendMoneySeed['settlementMethod'];
  purposeCode?: SendMoneySeed['purposeCode'];
  fundingCurrency?: string;
};

type ResolveSendResult = {
  status?: 'sent' | 'cancelled';
  transactionId?: string;
  contactId?: string;
};

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

function toCandidate(c: Contact): ResolveSendCandidate {
  return {
    id: c.id,
    name: c.name,
    initials: c.initials,
    currency: c.currency,
    method: c.method,
    identifier: c.identifier,
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

  const [candidates, setCandidates] = useState<ResolveSendCandidate[]>(seed.candidates ?? []);
  const [loadingContacts, setLoadingContacts] = useState(
    !(seed.candidates && seed.candidates.length > 0),
  );
  const [contact, setContact] = useState<ResolveSendCandidate | null>(
    seed.candidates?.length === 1 ? seed.candidates[0]! : null,
  );
  const [localStatus, setLocalStatus] = useState<PaymentConfirmationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendingStep, setSendingStep] = useState(0);
  const [transactionId, setTransactionId] = useState<string | undefined>();
  const [txRecordId, setTxRecordId] = useState<string | null>(null);
  const [contactSaved, setContactSaved] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);
  const [confirmedPayment, setConfirmedPayment] = useState<PaymentConfirmation | null>(null);
  const finishedRef = useRef(false);
  const followedUpRef = useRef(false);

  useEffect(() => {
    if (seed.candidates && seed.candidates.length > 0) {
      setLoadingContacts(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const matches = seed.queryName
        ? await findContactsByName(seed.queryName)
        : await listContacts();
      if (cancelled) return;
      const next = matches.map(toCandidate);
      setCandidates(next);
      if (next.length === 1) setContact(next[0]!);
      setLoadingContacts(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [seed.candidates, seed.queryName]);

  const wizardSeed: SendMoneySeed | null = useMemo(() => {
    if (!contact) return null;
    const fromContact = contactToSendSeed(toContact(contact));
    return {
      ...fromContact,
      amount: seed.amount,
      currency: seed.currency ?? contact.currency,
      fundingCurrency: seed.fundingCurrency ?? seed.currency ?? contact.currency,
      reference: seed.reference ?? `To ${contact.name}`,
      destinationCountry: seed.destinationCountry ?? fromContact.destinationCountry,
      settlementMethod: seed.settlementMethod ?? fromContact.settlementMethod,
      purposeCode: seed.purposeCode,
    };
  }, [contact, seed]);

  const status = localStatus ?? 'pending';
  const payment = confirmedPayment;

  useEffect(() => {
    const value = payment?.destination.value ?? contact?.identifier;
    if (!value) return;
    void findContactByIdentifier(value).then((existing) => {
      if (existing) setContactSaved(true);
    });
  }, [contact?.identifier, payment?.destination.value]);

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

  if (loadingContacts) {
    return (
      <View
        style={[styles.preparing, { borderColor: colors.border, backgroundColor: colors.composer }]}
      >
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    );
  }

  if (!contact) {
    return (
      <View style={[styles.card, { backgroundColor: colors.composer, borderColor: colors.border }]}>
        <WizardStepHeader
          step={1}
          total={2}
          title={
            seed.queryName ? `Who did you mean by “${seed.queryName}”?` : 'Who should receive it?'
          }
          subtitle={
            seed.queryName
              ? `${candidates.length} contacts match — pick one to continue.`
              : seed.currency
                ? `Sending from your ${seed.currency} wallet — pick a contact.`
                : `${candidates.length} contacts — pick one to continue.`
          }
        />
        <View style={styles.list}>
          {candidates.map((c, index) => (
            <Pressable
              key={c.id}
              onPress={() => {
                haptics.selection();
                setContact(c);
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

  if (!wizardSeed) return null;

  return (
    <>
      {candidates.length > 1 && status === 'pending' ? (
        <Pressable
          onPress={() => {
            haptics.selection();
            setContact(null);
            setConfirmedPayment(null);
            setLocalStatus(null);
          }}
          style={styles.editLink}
        >
          <Text style={{ color: colors.mutedForeground, fontWeight: '600' }}>← Change contact</Text>
        </Pressable>
      ) : null}
      <SendMoneyWizard
        seed={wizardSeed}
        status={status}
        loading={busy}
        sendingStep={sendingStep}
        transactionId={transactionId}
        contactSaved={contactSaved}
        contactSaving={contactSaving}
        onViewDetails={
          status === 'sent' && (txRecordId || transactionId)
            ? () => router.push(`/transaction/${txRecordId ?? transactionId}` as Href)
            : undefined
        }
        onSaveContact={async () => {
          if (!payment || contactSaved || contactSaving) return;
          setContactSaving(true);
          try {
            await saveContact({
              name: payment.recipientName,
              currency: payment.currency as never,
              method: payment.settlementMethodLabel ?? payment.destination.label,
              identifier: payment.destination.value,
            });
            setContactSaved(true);
            haptics.success();
          } finally {
            setContactSaving(false);
          }
        }}
        onConfirm={async (next) => {
          if (status !== 'pending' || busy) return;
          setConfirmedPayment(next);
          setBusy(true);
          const ok = await requestApproval();
          setBusy(false);
          if (!ok) return;
          setSendingStep(0);
          finishedRef.current = false;
          setLocalStatus('sending');
        }}
        onCancel={onCancelled}
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
    fontFamily: 'DMSans_400Regular',
    fontSize: 13,
  },
  contactName: {
    fontFamily: 'DMSans_400Regular',
    fontSize: 15,
    fontWeight: '600',
  },
  editLink: {
    marginLeft: 8,
    marginBottom: 2,
  },
});
