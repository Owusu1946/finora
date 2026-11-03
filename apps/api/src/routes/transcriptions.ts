import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../app-env';

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const DEEPGRAM_TIMEOUT_MS = 12_000;
const SUPPORTED_AUDIO_TYPES = new Set([
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/webm',
]);

const MAX_KEYTERMS = 50;
const MAX_KEYTERM_LENGTH = 40;

/** Client-supplied Deepgram keyterms, trimmed, de-duplicated, and capped. */
function readKeyterms(values: string[] | undefined) {
  const keyterms: string[] = [];
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const term = value.trim();
    if (!term || term.length > MAX_KEYTERM_LENGTH) continue;
    const id = term.toLowerCase();
    if (seen.has(id)) continue;
    seen.add(id);
    keyterms.push(term);
    if (keyterms.length >= MAX_KEYTERMS) break;
  }
  return keyterms;
}

const DeepgramResponseSchema = z.object({
  metadata: z.object({ duration: z.number().nonnegative().optional() }).optional(),
  results: z.object({
    channels: z.array(
      z.object({
        alternatives: z.array(z.object({ transcript: z.string() })),
      }),
    ),
  }),
});

export const transcriptions = new Hono<AppEnv>();

/**
 * Mints a short-lived Deepgram access token so the device can open a live
 * WebSocket directly against api.deepgram.com for streaming transcripts
 * without ever exposing the project API key. Used by the composer's voice
 * preview; the authoritative transcript still flows through POST /.
 */
transcriptions.get('/live-token', async (c) => {
  const noStore = { 'Cache-Control': 'no-store' };
  const apiKey = c.var.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return c.json(
      { error: 'transcription_unavailable', message: 'Voice transcription is not configured.' },
      503,
      noStore,
    );
  }

  const response = await fetch('https://api.deepgram.com/v1/auth/grant', {
    method: 'POST',
    headers: {
      Authorization: `Token ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ttl_seconds: 30 }),
  });
  if (!response.ok) {
    console.error('Deepgram token grant failed.', { status: response.status });
    return c.json(
      { error: 'token_request_failed', message: 'Live transcription is unavailable.' },
      502,
      noStore,
    );
  }

  const grant = (await response.json()) as { access_token?: unknown };
  if (typeof grant.access_token !== 'string' || !grant.access_token) {
    console.error('Deepgram returned an invalid token grant.');
    return c.json(
      { error: 'token_request_failed', message: 'Live transcription is unavailable.' },
      502,
      noStore,
    );
  }

  return c.json({ token: grant.access_token, expiresIn: 30 }, 200, noStore);
});

transcriptions.post('/', async (c) => {
  const noStore = { 'Cache-Control': 'no-store' };
  const apiKey = c.var.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return c.json(
      { error: 'transcription_unavailable', message: 'Voice transcription is not configured.' },
      503,
      noStore,
    );
  }

  const contentType = c.req.header('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (!contentType || !SUPPORTED_AUDIO_TYPES.has(contentType)) {
    return c.json(
      { error: 'unsupported_audio', message: 'This audio format is not supported.' },
      415,
      noStore,
    );
  }

  const declaredLength = Number(c.req.header('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_AUDIO_BYTES) {
    return c.json({ error: 'audio_too_large', message: 'Recording is too large.' }, 413, noStore);
  }

  const audio = await c.req.arrayBuffer();
  if (audio.byteLength === 0) {
    return c.json({ error: 'empty_audio', message: 'Recording was empty.' }, 400, noStore);
  }
  if (audio.byteLength > MAX_AUDIO_BYTES) {
    return c.json({ error: 'audio_too_large', message: 'Recording is too large.' }, 413, noStore);
  }

  const params = new URLSearchParams({
    model: 'nova-3',
    smart_format: 'true',
    punctuate: 'true',
    mip_opt_out: 'true',
  });
  // Names and money words from the user's data improve recognition (keyterm prompting).
  for (const term of readKeyterms(c.req.queries('keyterm'))) params.append('keyterm', term);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEEPGRAM_TIMEOUT_MS);

  try {
    const response = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': contentType,
      },
      body: audio,
      signal: controller.signal,
    });

    if (!response.ok) {
      console.error('Deepgram transcription failed.', { status: response.status });
      return c.json(
        { error: 'transcription_failed', message: 'Voice transcription failed.' },
        502,
        noStore,
      );
    }

    const parsed = DeepgramResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      console.error('Deepgram returned an invalid response.');
      return c.json(
        { error: 'transcription_failed', message: 'Voice transcription failed.' },
        502,
        noStore,
      );
    }

    const transcript = parsed.data.results.channels[0]?.alternatives[0]?.transcript.trim() ?? '';
    if (!transcript) {
      return c.json(
        { error: 'speech_not_detected', message: 'No speech was detected.' },
        422,
        noStore,
      );
    }

    return c.json(
      {
        transcript,
        durationMs: Math.round((parsed.data.metadata?.duration ?? 0) * 1000),
      },
      200,
      noStore,
    );
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'AbortError';
    console.error('Deepgram transcription request failed.', { timedOut });
    return c.json(
      {
        error: timedOut ? 'transcription_timeout' : 'transcription_failed',
        message: timedOut ? 'Voice transcription timed out.' : 'Voice transcription failed.',
      },
      timedOut ? 504 : 502,
      noStore,
    );
  } finally {
    clearTimeout(timeout);
  }
});
