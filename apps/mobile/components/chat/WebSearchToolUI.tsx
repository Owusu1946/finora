import { makeAssistantToolUI } from '@assistant-ui/react-native';
import { useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, View } from 'react-native';

import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';

type WebSource = {
  id: string;
  title: string;
  url: string;
  domain: string;
  publishedDate?: string | null;
  author?: string | null;
  excerpt?: string | null;
  favicon?: string | null;
};

type WebResult = {
  ok?: boolean;
  errorCode?: string;
  mode?: 'search' | 'research';
  query?: string;
  answer?: string | null;
  sources?: WebSource[];
};

function SourceSheet({ sources, onClose }: { sources: WebSource[]; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <Modal
      visible
      animationType='slide'
      presentationStyle='pageSheet'
      onRequestClose={onClose}
    >
      <View className='flex-1 bg-background'>
        <View className='flex-row items-center border-b border-border px-5 pb-3 pt-5'>
          <View className='flex-1'>
            <Text className='font-sans-semibold text-[19px] text-foreground'>Sources</Text>
            <Text className='font-sans text-[13px] text-muted-foreground'>
              {sources.length} source{sources.length === 1 ? '' : 's'} used
            </Text>
          </View>
          <Pressable
            accessibilityLabel='Close sources'
            onPress={onClose}
            className='h-10 w-10 items-center justify-center rounded-full bg-muted'
          >
            <Icon
              name='remove'
              size={18}
              color={colors.foreground}
            />
          </Pressable>
        </View>
        <ScrollView contentContainerClassName='gap-3 p-4 pb-10'>
          {sources.map((source, index) => (
            <Pressable
              key={`${source.id}:${source.url}`}
              accessibilityRole='link'
              onPress={() => void Linking.openURL(source.url)}
              className='border border-border bg-composer p-4'
              style={({ pressed }) => [styles.source, pressed && { opacity: 0.72 }]}
            >
              <View className='flex-row items-start gap-3'>
                <View className='h-7 w-7 items-center justify-center rounded-full bg-muted'>
                  <Text className='font-sans-semibold text-[12px] text-foreground'>
                    {index + 1}
                  </Text>
                </View>
                <View className='flex-1 gap-1'>
                  <Text className='font-sans-medium text-[12px] text-muted-foreground'>
                    {source.domain}
                    {source.publishedDate ? ` · ${source.publishedDate.slice(0, 10)}` : ''}
                  </Text>
                  <Text className='font-sans-semibold text-[15px] leading-[20px] text-foreground'>
                    {source.title}
                  </Text>
                  {source.excerpt ? (
                    <Text
                      numberOfLines={4}
                      className='font-sans text-[13px] leading-[18px] text-muted-foreground'
                    >
                      {source.excerpt}
                    </Text>
                  ) : null}
                </View>
                <Icon
                  name='arrow-up'
                  size={16}
                  color={colors.mutedForeground}
                />
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

function WebResultCard({
  result,
  running,
  deep,
}: {
  result?: WebResult;
  running: boolean;
  deep: boolean;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const sources = result?.sources ?? [];

  if (running && !result) {
    return (
      <View
        className='my-2 min-h-[70px] flex-row items-center gap-3 border border-border bg-composer px-4'
        style={styles.card}
      >
        <LoadingIcon color={colors.mutedForeground} />
        <View className='flex-1'>
          <Text className='font-sans-semibold text-[14px] text-foreground'>
            {deep ? 'Researching the web' : 'Searching the web'}
          </Text>
          <Text className='font-sans text-[12px] text-muted-foreground'>
            {deep
              ? 'Comparing sources and checking evidence…'
              : 'Finding current, relevant sources…'}
          </Text>
        </View>
      </View>
    );
  }

  if (result?.ok === false || !sources.length) {
    return (
      <View
        className='my-2 border border-border bg-composer p-4'
        style={styles.card}
      >
        <Text className='font-sans-medium text-[14px] text-muted-foreground'>
          {result?.errorCode === 'web_search_not_configured'
            ? 'Web search is not configured yet.'
            : 'No usable web sources were returned.'}
        </Text>
      </View>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => {
          haptics.selection();
          setOpen(true);
        }}
        className='my-1.5 flex-row items-center gap-3 border border-border bg-composer px-4 py-3'
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}
      >
        <View className='h-9 w-9 items-center justify-center rounded-full bg-muted'>
          <Icon
            name={deep ? 'brain' : 'tool'}
            size={17}
            color={colors.foreground}
          />
        </View>
        <View className='flex-1'>
          <Text className='font-sans-semibold text-[14px] text-foreground'>
            {deep ? 'Deep research complete' : 'Web search complete'}
          </Text>
          <Text className='font-sans text-[12px] text-muted-foreground'>
            Sources · {sources.length}
          </Text>
        </View>
        <Icon
          name='chevron-right'
          size={17}
          color={colors.mutedForeground}
        />
      </Pressable>
      {open ? (
        <SourceSheet
          sources={sources}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

export const SearchWebToolUI = makeAssistantToolUI<Record<string, unknown>, WebResult>({
  toolName: 'search_web',
  display: 'standalone',
  render: ({ result, status }) => (
    <WebResultCard
      result={result}
      running={status.type === 'running'}
      deep={false}
    />
  ),
});

export const ResearchWebToolUI = makeAssistantToolUI<Record<string, unknown>, WebResult>({
  toolName: 'research_web',
  display: 'standalone',
  render: ({ result, status }) => (
    <WebResultCard
      result={result}
      running={status.type === 'running'}
      deep
    />
  ),
});

const styles = {
  card: { borderRadius: Radius.card },
  source: { borderRadius: Radius.card },
};
