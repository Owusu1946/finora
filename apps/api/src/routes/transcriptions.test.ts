import { createApiEnv } from '@finora/env/api';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { AppEnv } from '../app-env';

import { transcriptions } from './transcriptions';

function createTestApp(apiKey?: string) {
  const app = new Hono<AppEnv>();
  const env = createApiEnv({
    ENVIRONMENT: 'development',
    DATABASE_URL: 'postgresql://user:password@localhost:5432/finora',
    CLERK_SECRET_KEY: 'clerk_test_key',
    DEEPGRAM_API_KEY: apiKey,
  });
  app.use('*', async (c, next) => {
    c.set('env', env);
    await next();
  });
  app.route('/transcriptions', transcriptions);
  return app;
}

function audioRequest(contentType = 'audio/mp4', bytes = new Uint8Array([1, 2, 3])) {
  return new Request('http://localhost/transcriptions', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: bytes,
  });
}

describe('POST /transcriptions', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns a no-store configuration error when Deepgram is unavailable', async () => {
    const response = await createTestApp().request(audioRequest());

    expect(response.status).toBe(503);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });

  it('rejects unsupported audio without calling the provider', async () => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);

    const response = await createTestApp('deepgram_test_key').request(audioRequest('audio/wav'));

    expect(response.status).toBe(415);
    expect(provider).not.toHaveBeenCalled();
  });

  it('forwards cleaned, de-duplicated keyterms to Deepgram', async () => {
    const provider = vi.fn().mockResolvedValue(
      Response.json({
        results: { channels: [{ alternatives: [{ transcript: 'Pay Kwame.' }] }] },
      }),
    );
    vi.stubGlobal('fetch', provider);

    const request = audioRequest();
    const url = new URL(request.url);
    for (const term of [' Kwame ', 'kwame', 'cedis', '', 'x'.repeat(41)]) {
      url.searchParams.append('keyterm', term);
    }
    const response = await createTestApp('deepgram_test_key').request(new Request(url, request));

    expect(response.status).toBe(200);
    const providerUrl = new URL(String(provider.mock.calls[0]?.[0]));
    expect(providerUrl.searchParams.get('model')).toBe('nova-3');
    expect(providerUrl.searchParams.getAll('keyterm')).toEqual(['Kwame', 'cedis']);
  });

  it('caps keyterms at 50', async () => {
    const provider = vi
      .fn()
      .mockResolvedValue(
        Response.json({ results: { channels: [{ alternatives: [{ transcript: 'Hi.' }] }] } }),
      );
    vi.stubGlobal('fetch', provider);

    const request = audioRequest();
    const url = new URL(request.url);
    for (let i = 0; i < 60; i++) url.searchParams.append('keyterm', `term${i}`);
    await createTestApp('deepgram_test_key').request(new Request(url, request));

    const providerUrl = new URL(String(provider.mock.calls[0]?.[0]));
    expect(providerUrl.searchParams.getAll('keyterm')).toHaveLength(50);
  });

  it('returns only the transcript and duration from Deepgram', async () => {
    const provider = vi.fn().mockResolvedValue(
      Response.json({
        metadata: { duration: 1.234 },
        results: { channels: [{ alternatives: [{ transcript: 'Pay Ama fifty cedis.' }] }] },
      }),
    );
    vi.stubGlobal('fetch', provider);

    const response = await createTestApp('deepgram_test_key').request(audioRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      transcript: 'Pay Ama fifty cedis.',
      durationMs: 1234,
    });
    expect(provider).toHaveBeenCalledOnce();
  });

  it('does not accept a successful provider response with no detected speech', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          results: { channels: [{ alternatives: [{ transcript: '   ' }] }] },
        }),
      ),
    );

    const response = await createTestApp('deepgram_test_key').request(audioRequest());

    expect(response.status).toBe(422);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
