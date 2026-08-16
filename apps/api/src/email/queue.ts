export type WelcomeEmailQueueMessage = {
  deliveryId: string;
};

export function isWelcomeEmailQueueMessage(value: unknown): value is WelcomeEmailQueueMessage {
  if (!value || typeof value !== 'object') return false;
  return typeof Reflect.get(value, 'deliveryId') === 'string';
}
