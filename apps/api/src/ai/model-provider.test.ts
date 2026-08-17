import { describe, expect, it } from 'vitest';

import { getModelProviderConfig } from './model-provider';

describe('getModelProviderConfig', () => {
  it('prefers the OpenRouter binding and its configured model', () => {
    expect(
      getModelProviderConfig({
        OPENROUTER_API_KEY: 'sk-or-router',
        OPENROUTER_MODEL: 'openai/gpt-5.6-luna',
        OPENAI_API_KEY: 'sk-openai',
      }),
    ).toEqual({
      apiKey: 'sk-or-router',
      isOpenRouter: true,
      modelId: 'openai/gpt-5.6-luna',
    });
  });

  it('treats a legacy OpenAI binding containing an OpenRouter key as OpenRouter', () => {
    expect(getModelProviderConfig({ OPENAI_API_KEY: 'sk-or-router' })).toEqual({
      apiKey: 'sk-or-router',
      isOpenRouter: true,
      modelId: 'openai/gpt-5-mini',
    });
  });

  it('keeps a real OpenAI key on the direct OpenAI provider', () => {
    expect(getModelProviderConfig({ OPENAI_API_KEY: 'sk-openai' })).toEqual({
      apiKey: 'sk-openai',
      isOpenRouter: false,
      modelId: 'gpt-5-mini',
    });
  });

  it('returns null when no provider key is available', () => {
    expect(getModelProviderConfig({})).toBeNull();
  });
});
