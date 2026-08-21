const encoder = new TextEncoder();
const decoder = new TextDecoder();

function encodeBase64Url(value: Uint8Array) {
  let binary = '';
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function encryptionKey(secret: string) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(secret));
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptSecret(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await encryptionKey(secret),
    encoder.encode(value),
  );
  return `v1.${encodeBase64Url(iv)}.${encodeBase64Url(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(value: string, secret: string) {
  const [version, iv, ciphertext] = value.split('.');
  if (version !== 'v1' || !iv || !ciphertext) throw new Error('Unsupported encrypted secret.');
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decodeBase64Url(iv) },
    await encryptionKey(secret),
    decodeBase64Url(ciphertext),
  );
  return decoder.decode(plaintext);
}

export async function sha256Base64Url(value: string) {
  return encodeBase64Url(
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))),
  );
}

export function randomBase64Url(byteLength = 32) {
  return encodeBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}
