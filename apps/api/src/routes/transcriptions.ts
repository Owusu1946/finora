import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../app-env';

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const DEEPGRAM_TIMEOUT_MS = 12_000;
const SUPPORTED_AUDIO_TYPES = new Set(['audio/mp4', 'audio/m4a', 'audio/x-m4a', 'audio/webm']);

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEEPGRAM_TIMEOUT_MS);

  try {
    const response = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true&mip_opt_out=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Token ${apiKey}`,
          'Content-Type': contentType,
        },
        body: audio,
        signal: controller.signal,
      },
    );

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
