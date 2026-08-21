const DEFAULT_OPENROUTER_MODEL = 'openai/gpt-5-mini';
const DEFAULT_OPENAI_MODEL = 'gpt-5-mini';

type ModelProviderEnvironment = {
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string;
  OPENAI_API_KEY?: string;
};

export type ModelProviderConfig = {
  apiKey: string;
  isOpenRouter: boolean;
  modelId: string;
};

function isOpenRouterKey(apiKey: string | undefined) {
  return apiKey?.startsWith('sk-or-') ?? false;
}

export function getModelProviderConfig(env: ModelProviderEnvironment): ModelProviderConfig | null {
  const openRouterApiKey =
    env.OPENROUTER_API_KEY ??
    (isOpenRouterKey(env.OPENAI_API_KEY) ? env.OPENAI_API_KEY : undefined);

  if (openRouterApiKey) {
    return {
      apiKey: openRouterApiKey,
      isOpenRouter: true,
      modelId: env.OPENROUTER_MODEL ?? DEFAULT_OPENROUTER_MODEL,
    };
  }

  if (!env.OPENAI_API_KEY) return null;
  return {
    apiKey: env.OPENAI_API_KEY,
    isOpenRouter: false,
    modelId: DEFAULT_OPENAI_MODEL,
  };
}
