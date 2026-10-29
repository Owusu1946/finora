import { File } from 'expo-file-system';

import { getApiUrl } from '@/lib/api-url';

type GetToken = () => Promise<string | null>;

/**
 * Streams the growing recording file to Deepgram's live WebSocket for
 * transcripts while the user is still speaking. On stop the composer uses the
 * live transcript directly so results are instant; the one-shot
 * POST /v1/transcriptions call is only the fallback when the live feed produced
 * nothing (e.g. it never connected). Failures here stay silent.
 *
 * Both platforms record ADTS AAC (extension .aac), whose raw frames can be
 * tailed mid-capture and streamed without containers.
 */

const TICK_INTERVAL_MS = 250;
/** Upper bound on waiting for Deepgram to flush its last finals after CloseStream. */
const FLUSH_TIMEOUT_MS = 1_500;

type LiveMessage = {
  type?: string;
  is_final?: boolean;
  results?: {
    channels?: Array<{
      alternatives?: Array<{ transcript?: string }>;
    }>;
  };
};

export type LiveTranscriptionHandlers = {
  /** Fired per Deepgram result; concatenate finals, replace partials. */
  onTranscript: (text: string, isFinal: boolean) => void;
  /** Optional outlet for diagnostics; never user-facing. */
  onError?: (error: unknown) => void;
};

export type LiveTranscriptionSession = {
  /**
   * Ends the feed. `flush` sends any unstreamed bytes and resolves once
   * Deepgram has delivered its final results (capped), so the caller can use
   * the live transcript; cancel discards without flushing.
   */
  stop: (flush?: boolean) => Promise<void>;
};

export async function startLiveTranscription(
  recordingUri: string,
  getToken: GetToken,
  handlers: LiveTranscriptionHandlers,
): Promise<LiveTranscriptionSession> {
  const apiUrl = getApiUrl();
  if (!apiUrl) throw new Error('API URL is not configured.');

  const appToken = await getToken();
  if (!appToken) throw new Error('Session is not ready.');

  const tokenResponse = await fetch(`${apiUrl}/v1/transcriptions/live-token`, {
    headers: { Authorization: `Bearer ${appToken}` },
  });
  if (!tokenResponse.ok) throw new Error(`Token request failed (${tokenResponse.status}).`);
  const grant = (await tokenResponse.json()) as { token?: unknown };
  if (typeof grant.token !== 'string' || !grant.token) throw new Error('Invalid token grant.');

  const params = new URLSearchParams({
    model: 'nova-3',
    smart_format: 'true',
    punctuate: 'true',
    mip_opt_out: 'true',
    interim_results: 'true',
    endpointing: '700',
  });
  const headers = { Authorization: `Bearer ${grant.token}` };

  // RN's WebSocket takes extra headers through its third constructor arg,
  // which the stock DOM typings don't declare.
  const RnWebSocket = WebSocket as unknown as new (
    url: string,
    protocols: string | undefined,
    options?: { headers: Record<string, string> },
  ) => WebSocket;
  const ws = new RnWebSocket(`wss://api.deepgram.com/v1/listen?${params.toString()}`, undefined, {
    headers,
  });

  // Deepgram sends its remaining finals after CloseStream, then closes the socket.
  const closed = new Promise<void>((resolve) => {
    ws.onclose = () => resolve();
  });

  const file = new File(recordingUri);
  let sentBytes = 0;
  let tick: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const sendTail = async () => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const info = file.info();
    const size = info.exists ? Math.max(0, info.size ?? 0) : 0;
    if (size <= sentBytes) return;
    const all = await file.bytes();
    if (all.length <= sentBytes) return;
    // slice() copies so the sent ArrayBuffer owns exactly the new frames.
    const chunk = all.slice(sentBytes);
    sentBytes = all.length;
    if (ws.readyState === WebSocket.OPEN) ws.send(chunk.buffer as ArrayBuffer);
  };

  ws.onmessage = (event) => {
    if (typeof event.data !== 'string') return;
    try {
      const message = JSON.parse(event.data) as LiveMessage;
      if (message.type !== 'Results') return;
      const transcript = message.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? '';
      if (!transcript) return;
      handlers.onTranscript(transcript, message.is_final === true);
    } catch (error) {
      handlers.onError?.(error);
    }
  };
  ws.onerror = (error) => {
    handlers.onError?.(error);
  };

  const session: LiveTranscriptionSession = {
    stop: (flush = true) =>
      new Promise<void>((resolve) => {
        if (stopped) {
          resolve();
          return;
        }
        stopped = true;
        if (tick) {
          clearInterval(tick);
          tick = null;
        }
        const finish = () => {
          try {
            ws.close();
          } catch {
            // Closing must never surface as a user-facing failure.
          }
          resolve();
        };
        if (ws.readyState === WebSocket.OPEN && flush) {
          void sendTail()
            .then(() => {
              ws.send(JSON.stringify({ type: 'CloseStream' }));
            })
            .catch((error) => {
              handlers.onError?.(error);
            })
            .finally(() => {
              const timeout = new Promise<void>((done) => setTimeout(done, FLUSH_TIMEOUT_MS));
              void Promise.race([closed, timeout]).then(finish);
            });
        } else {
          finish();
        }
      }),
  };

  // The recording file appears once the native recorder starts writing;
  // tolerate the first missing ticks.
  setTimeout(() => {
    if (stopped) return;
    void sendTail().catch((error) => handlers.onError?.(error));
    tick = setInterval(() => {
      void sendTail().catch((error) => handlers.onError?.(error));
    }, TICK_INTERVAL_MS);
  }, TICK_INTERVAL_MS);

  return session;
}
