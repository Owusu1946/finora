import { makeAssistantToolUI, useAui } from '@assistant-ui/react-native';
import { useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { CurrencyIcon, type SupportedCurrency } from '@/components/ui/currency-icon';
import { Icon } from '@/components/ui/icon';
import { LoadingIcon } from '@/components/ui/loading-icon';
import { AppText as Text } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { haptics } from '@/lib/haptics';
import { sendChatPrompt } from '@/lib/send-chat-prompt';
import { previewFxQuote } from '@/lib/send-corridors';

type WebSource = {
  id: string;
  title: string;
  url: string;
  domain: string;
  publishedDate?: string | null;
  author?: string | null;
  excerpt?: string | null;
  favicon?: string | null;
  image?: string | null;
};

type WebResult = {
  ok?: boolean;
  errorCode?: string;
  mode?: 'search' | 'research';
  query?: string;
  answer?: string | null;
  sources?: WebSource[];
};

type ProductResult = {
  id: string;
  productName: string;
  price?: string | null;
  priceAmount?: number | null;
  currency?: string | null;
  condition?: 'new' | 'used' | 'refurbished' | 'open_box' | 'unknown';
  seller: string;
  location?: string | null;
  estimatedTotal?: string | null;
  estimatedTotalAmount?: number | null;
  availability?: 'listed' | 'unavailable' | 'unknown';
  verified: boolean;
  confidence?: 'low' | 'medium' | 'high';
  withinBudget?: boolean | null;
  warnings?: string[];
  source: WebSource;
};

type ProductSearchResult = {
  ok?: boolean;
  errorCode?: string;
  mode?: 'products';
  query?: string;
  budget?: number | null;
  currency?: string | null;
  products?: ProductResult[];
};

function parsePriceValue(priceStr?: string | null, amountNum?: number | null): number | null {
  if (amountNum != null && amountNum > 0) return amountNum;
  if (!priceStr) return null;
  const match = priceStr.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const val = parseFloat(match[0]);
  return isNaN(val) || val <= 0 ? null : val;
}

function currencySymbol(currency: string): string {
  switch (currency.toUpperCase()) {
    case 'USD':
    case 'USDC':
      return '$';
    case 'USDT':
      return '₮';
    case 'EUR':
      return '€';
    case 'GBP':
      return '£';
    case 'GHS':
      return 'GH₵';
    case 'NGN':
      return '₦';
    case 'KES':
      return 'KSh';
    default:
      return `${currency} `;
  }
}

function calculateConversionNeeded(
  targetAmount: number,
  targetCurrency: string,
  sourceCurrency: string,
) {
  if (targetCurrency.toUpperCase() === sourceCurrency.toUpperCase()) return null;
  const quote = previewFxQuote({ from: sourceCurrency, to: targetCurrency, amount: 100 });
  if (!quote.rate || quote.rate <= 0) return null;

  // Rate represents target units per 1 source unit after corridor fee
  // sourceAmount = ceil(targetAmount / (rate * (1 - feeRatio)))
  const sourceAmount = Math.ceil(targetAmount / (quote.rate * 0.996));
  const rateDisplay =
    quote.rate >= 1
      ? `1 ${sourceCurrency} ≈ ${quote.rate.toFixed(2)} ${targetCurrency}`
      : `1 ${targetCurrency} ≈ ${(1 / quote.rate).toFixed(2)} ${sourceCurrency}`;

  return {
    sourceCurrency,
    targetCurrency,
    sourceAmount,
    rate: quote.rate,
    displayRate: rateDisplay,
  };
}

function ProductFxConversion({
  product,
  aui,
}: {
  product: ProductResult;
  aui: ReturnType<typeof useAui>;
}) {
  const { colors } = useTheme();
  const prodCurrency = (product.currency ?? 'USD').toUpperCase();
  const prodAmount = parsePriceValue(product.price, product.priceAmount);

  const availableCurrencies: SupportedCurrency[] = (
    prodCurrency === 'USD'
      ? ['GHS', 'EUR', 'GBP', 'USDT']
      : ['USD', 'GHS', 'EUR', 'GBP', 'USDT']
  ).filter((c) => c !== prodCurrency) as SupportedCurrency[];

  const [selectedCurrency, setSelectedCurrency] = useState<SupportedCurrency>(
    prodCurrency === 'GHS' ? 'USD' : 'GHS',
  );

  if (!prodAmount) return null;

  const conversion = calculateConversionNeeded(prodAmount, prodCurrency, selectedCurrency);
  if (!conversion) return null;

  const handleConvert = () => {
    haptics.selection();
    sendChatPrompt(
      aui,
      `Convert ${conversion.sourceAmount} ${conversion.sourceCurrency} to ${conversion.targetCurrency}`,
    );
  };

  const cycleCurrency = () => {
    haptics.selection();
    const currIdx = availableCurrencies.indexOf(selectedCurrency);
    const nextIdx = (currIdx + 1) % availableCurrencies.length;
    setSelectedCurrency(availableCurrencies[nextIdx]);
  };

  return (
    <View
      className='mt-2.5 gap-2 rounded-2xl border border-border/70 p-3'
      style={{ backgroundColor: colors.muted }}
    >
      <View className='flex-row items-center justify-between'>
        <Pressable
          accessibilityRole='button'
          accessibilityLabel={`Change currency from ${selectedCurrency}`}
          onPress={cycleCurrency}
          className='flex-row items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 active:opacity-75'
          style={{ borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth }}
        >
          <CurrencyIcon
            currency={selectedCurrency}
            size={16}
          />
          <Text className='font-sans-semibold text-[11px] text-foreground'>{selectedCurrency}</Text>
          <Icon
            name='swap'
            size={12}
            color={colors.mutedForeground}
          />
        </Pressable>
        <Text className='font-sans text-[11px] text-muted-foreground'>
          {conversion.displayRate}
        </Text>
      </View>
      <View className='flex-row items-center justify-between pt-0.5'>
        <View className='flex-1 pr-2'>
          <Text className='font-sans-bold text-[15px] text-foreground'>
            ≈ {currencySymbol(selectedCurrency)}
            {conversion.sourceAmount.toLocaleString(undefined, {
              minimumFractionDigits: 0,
              maximumFractionDigits: 2,
            })}
          </Text>
          <Text className='font-sans text-[10px] text-muted-foreground'>
            Cross-border FX quote
          </Text>
        </View>
        <Pressable
          accessibilityRole='button'
          accessibilityLabel={`Convert ${conversion.sourceAmount} ${selectedCurrency} to ${conversion.targetCurrency}`}
          onPress={handleConvert}
          className='h-8 flex-row items-center justify-center gap-1.5 rounded-full px-3.5 active:opacity-85'
          style={{ backgroundColor: colors.primary }}
        >
          <Icon
            name='swap'
            size={13}
            color={colors.primaryForeground}
          />
          <Text
            className='font-sans-semibold text-[12px]'
            style={{ color: colors.primaryForeground }}
          >
            Convert & Fund
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

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

function ProductSearchCard({
  result,
  running,
}: {
  result?: ProductSearchResult;
  running: boolean;
}) {
  const { colors } = useTheme();
  const aui = useAui();
  const products = result?.products ?? [];

  if (running && !result) {
    return (
      <View
        className='my-2 min-h-[70px] flex-row items-center gap-3 border border-border bg-composer px-4'
        style={styles.card}
      >
        <LoadingIcon color={colors.mutedForeground} />
        <View className='flex-1'>
          <Text className='font-sans-semibold text-[14px] text-foreground'>Finding products</Text>
          <Text className='font-sans text-[12px] text-muted-foreground'>
            Checking prices, condition, availability, and listing pages...
          </Text>
        </View>
      </View>
    );
  }

  if (result?.ok === false || !products.length) {
    return (
      <View
        className='my-2 border border-border bg-composer p-4'
        style={styles.card}
      >
        <Text className='font-sans-medium text-[14px] text-muted-foreground'>
          {result?.errorCode === 'web_search_not_configured'
            ? 'Product search is not configured yet.'
            : 'No credible product listings were returned.'}
        </Text>
      </View>
    );
  }

  return (
    <View className='my-2 gap-2'>
      <View className='flex-row items-center gap-3 px-1 pb-1'>
        <View className='h-9 w-9 items-center justify-center rounded-full bg-muted'>
          <Icon
            name='dollar'
            size={17}
            color={colors.foreground}
          />
        </View>
        <View className='flex-1'>
          <Text className='font-sans-semibold text-[14px] text-foreground'>Product matches</Text>
          <Text className='font-sans text-[12px] text-muted-foreground'>
            {result?.budget && result.currency
              ? `Budget ${result.currency} ${result.budget.toLocaleString()}`
              : `${products.length} listing${products.length === 1 ? '' : 's'}`}
          </Text>
        </View>
      </View>
      <ScrollView
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={322}
        decelerationRate='fast'
        contentContainerStyle={styles.productCarousel}
        style={styles.productCarouselViewport}
      >
        {products.slice(0, 5).map((product, index) => (
          <View
            key={`${product.id}:${product.source.url}`}
            className='overflow-hidden border border-border bg-composer'
            style={styles.product}
          >
            <Pressable
              accessibilityRole='link'
              accessibilityLabel={`Open ${product.productName}`}
              onPress={() => void Linking.openURL(product.source.url)}
              style={({ pressed }) => [{ opacity: pressed ? 0.8 : 1 }]}
            >
              <ProductImage
                uri={product.source.image}
                label={`${product.productName} product image`}
                fallbackColor={colors.mutedForeground}
              />
              <View className='absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1'>
                <Text className='font-sans-semibold text-[11px] text-foreground'>#{index + 1}</Text>
              </View>
            </Pressable>

            <View className='flex-1 gap-1.5 p-3.5'>
              <Pressable
                accessibilityRole='link'
                accessibilityLabel={`Open ${product.productName}`}
                onPress={() => void Linking.openURL(product.source.url)}
                style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
                className='gap-1'
              >
                <Text
                  numberOfLines={2}
                  className='font-sans-semibold text-[14px] leading-[19px] text-foreground'
                >
                  {product.productName}
                </Text>
                <Text className='font-sans-bold text-[17px] text-foreground'>
                  {product.price ?? 'Price unavailable'}
                </Text>
                <Text className='font-sans text-[11px] text-muted-foreground'>
                  {product.seller}
                  {product.condition && product.condition !== 'unknown'
                    ? ` · ${product.condition.replace('_', ' ')}`
                    : ''}
                </Text>
                <Text
                  className={`font-sans-medium text-[11px] ${
                    product.withinBudget === true
                      ? 'text-success'
                      : product.withinBudget === false
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                  }`}
                >
                  {product.withinBudget === true
                    ? 'Confirmed within budget'
                    : product.withinBudget === false
                      ? 'Over budget'
                      : 'Delivered total not confirmed'}
                </Text>
              </Pressable>

              {/* Cross-border FX & Landed conversion */}
              <ProductFxConversion
                product={product}
                aui={aui}
              />

              <View className='mt-auto flex-row items-center justify-between border-t border-border/80 pt-2'>
                <Pressable
                  accessibilityRole='link'
                  onPress={() => void Linking.openURL(product.source.url)}
                  className='flex-row items-center gap-1 active:opacity-70'
                >
                  <Text className='font-sans-medium text-[11px] text-foreground'>View listing</Text>
                  <Icon
                    name='arrow-up'
                    size={13}
                    color={colors.mutedForeground}
                  />
                </Pressable>
                <Text className='font-sans text-[10px] text-muted-foreground'>
                  {product.verified ? 'Verified' : 'Web match'}
                </Text>
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
      {products.length > 1 ? (
        <Text className='text-center font-sans text-[11px] text-muted-foreground'>
          Swipe horizontally to compare {products.length} listings
        </Text>
      ) : null}
    </View>
  );
}

function ProductImage({
  uri,
  label,
  fallbackColor,
}: {
  uri?: string | null;
  label: string;
  fallbackColor: string;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <View className='relative h-[140px] items-center justify-center bg-muted'>
      {uri && !failed ? (
        <Image
          source={{ uri }}
          accessibilityLabel={label}
          onError={() => setFailed(true)}
          resizeMode='contain'
          style={styles.productImage}
        />
      ) : (
        <View className='h-14 w-14 items-center justify-center rounded-full bg-background'>
          <Icon
            name='card'
            size={26}
            color={fallbackColor}
          />
        </View>
      )}
    </View>
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

export const SearchProductsToolUI = makeAssistantToolUI<
  Record<string, unknown>,
  ProductSearchResult
>({
  toolName: 'search_products',
  display: 'standalone',
  render: ({ result, status }) => (
    <ProductSearchCard
      result={result}
      running={status.type === 'running'}
    />
  ),
});

const styles = {
  card: { borderRadius: Radius.card },
  source: { borderRadius: Radius.card },
  product: { borderRadius: Radius.card, width: 308, marginRight: 14 },
  productCarousel: { paddingBottom: 4, paddingRight: 8 },
  productCarouselViewport: { minHeight: 460 },
  productImage: { width: '100%' as const, height: '100%' as const },
};
