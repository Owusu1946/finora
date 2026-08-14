import { createClient } from 'redis';
import { createResumableStreamContext } from 'resumable-stream';

const REDIS_KEY_PREFIX = 'finora:chat-streams';

function cancellationChannel(streamId: string) {
  return `${REDIS_KEY_PREFIX}:cancel:${streamId}`;
}

export async function createRedisStreamSession({
  redisUrl,
  waitUntil,
  onError,
}: {
  redisUrl: string;
  waitUntil: (promise: Promise<unknown>) => void;
  onError: (error: unknown) => void;
}) {
  const publisher = createClient({ url: redisUrl });
  const subscriber = publisher.duplicate();
  publisher.on('error', onError);
  subscriber.on('error', onError);

  let closePromise: Promise<void> | undefined;
  const close = () => {
    closePromise ??= (async () => {
      const results = await Promise.allSettled([
        (async () => {
          if (!subscriber.isOpen) return;
          try {
            await subscriber.unsubscribe();
          } finally {
            if (subscriber.isOpen) await subscriber.close();
          }
        })(),
        publisher.isOpen ? publisher.close() : Promise.resolve(),
      ]);
      for (const result of results) {
        if (result.status === 'rejected') onError(result.reason);
      }
    })();
    return closePromise;
  };

  const connectionResults = await Promise.allSettled([publisher.connect(), subscriber.connect()]);
  const connectionFailure = connectionResults.find((result) => result.status === 'rejected');
  if (connectionFailure?.status === 'rejected') {
    await close();
    throw connectionFailure.reason;
  }

  let producerCompletion: Promise<unknown> | undefined;
  const context = createResumableStreamContext({
    keyPrefix: REDIS_KEY_PREFIX,
    publisher,
    subscriber,
    waitUntil: (promise) => {
      producerCompletion = promise;
    },
  });

  return {
    context,
    close,
    async subscribeToCancellation(streamId: string, onCancel: () => void) {
      await subscriber.subscribe(cancellationChannel(streamId), onCancel);
    },
    async createNewResumableStream(streamId: string, stream: ReadableStream<string>) {
      const resumableStream = await context.createNewResumableStream(streamId, () => stream);
      if (!producerCompletion) throw new Error('Resumable stream lifecycle was not registered.');

      waitUntil(
        producerCompletion
          .catch((error) => {
            onError(error);
          })
          .finally(close),
      );
      return resumableStream;
    },
  };
}

export async function publishStreamCancellation(
  redisUrl: string,
  streamId: string,
  onError: (error: unknown) => void,
) {
  const publisher = createClient({ url: redisUrl });
  publisher.on('error', onError);

  try {
    await publisher.connect();
    return await publisher.publish(cancellationChannel(streamId), 'stop');
  } finally {
    if (publisher.isOpen) {
      try {
        await publisher.close();
      } catch (error) {
        onError(error);
      }
    }
  }
}

export function closeStreamWith(stream: ReadableStream<string>, close: () => Promise<void>) {
  const reader = stream.getReader();

  return new ReadableStream<string>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          await close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        controller.error(error);
        await close();
      }
    },
    async cancel(reason) {
      try {
        await reader.cancel(reason);
      } finally {
        await close();
      }
    },
  });
}
