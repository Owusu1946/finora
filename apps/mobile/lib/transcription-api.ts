import { File } from 'expo-file-system';

import { getApiUrl } from '@/lib/api-url';

type GetToken = () => Promise<string | null>;

const TRANSCRIPTION_TIMEOUT_MS = 15_000;
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
export class TranscriptionApiError extends Error {
  constructor(
    message: string,
    readonly code: 'configuration' | 'timeout' | 'network' | 'unauthorized' | 'server',
  ) {
    super(message);
    this.name = 'TranscriptionApiError';
  }
}

function safelyDelete(recording: File) {
  try {
    if (recording.exists) recording.delete();
  } catch {
    // Cleanup must not replace the transcription result or user-facing error.
  }
}

export async function transcribeRecording(uri: string, contentType: string, getToken: GetToken) {
  const recording = new File(uri);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS);

  try {
    const apiUrl = getApiUrl();
    if (!apiUrl) {
      throw new TranscriptionApiError('The Finora API URL is not configured.', 'configuration');
    }

    const token = await getToken();
    if (!token) {
      throw new TranscriptionApiError('Your session is not ready. Try again.', 'unauthorized');
    }

    const audio = await recording.arrayBuffer();
    if (audio.byteLength === 0) {
      throw new TranscriptionApiError('The recording was empty. Try speaking again.', 'server');
    }
    if (audio.byteLength > MAX_AUDIO_BYTES) {
      throw new TranscriptionApiError(
        'The recording is too large. Try a shorter message.',
        'server',
      );
    }

    const response = await fetch(`${apiUrl}/v1/transcriptions`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        'Content-Type': contentType,
      },
      body: audio,
      signal: controller.signal,
    });

    if (response.status === 401) {
      throw new TranscriptionApiError('Your session expired. Sign in again.', 'unauthorized');
    }
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null);
      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? String(payload.message)
          : 'Could not transcribe that recording.';
      throw new TranscriptionApiError(message, 'server');
    }

    let payload: unknown;
    try {
      const bytes = await response.arrayBuffer();
      const body = new TextDecoder().decode(bytes);
      payload = JSON.parse(body) as unknown;
    } catch {
      throw new TranscriptionApiError(
        'Finora returned an invalid transcription response.',
        'server',
      );
    }
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('transcript' in payload) ||
      typeof payload.transcript !== 'string' ||
      !payload.transcript ||
      !('durationMs' in payload) ||
      typeof payload.durationMs !== 'number' ||
      payload.durationMs < 0
    ) {
      throw new TranscriptionApiError('The transcription response was invalid.', 'server');
    }
    return { transcript: payload.transcript, durationMs: payload.durationMs };
  } catch (error) {
    if (error instanceof TranscriptionApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TranscriptionApiError('Voice transcription took too long. Try again.', 'timeout');
    }
    throw new TranscriptionApiError('Could not reach Finora. Check your connection.', 'network');
  } finally {
    clearTimeout(timeout);
    safelyDelete(recording);
  }
}

export function deleteRecording(uri: string | null) {
  if (!uri) return;
  safelyDelete(new File(uri));
}
