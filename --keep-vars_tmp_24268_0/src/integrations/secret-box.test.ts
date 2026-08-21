import { describe, expect, it } from 'vitest';

import { decryptSecret, encryptSecret, randomBase64Url, sha256Base64Url } from './secret-box';

describe('secret-box', () => {
  it('encrypts and decrypts without exposing plaintext', async () => {
    const encrypted = await encryptSecret('refresh-token', 'a-secure-key-with-at-least-32-chars');

    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain('refresh-token');
    await expect(decryptSecret(encrypted, 'a-secure-key-with-at-least-32-chars')).resolves.toBe(
      'refresh-token',
    );
  });

  it('rejects ciphertext that has been tampered with', async () => {
    const encrypted = await encryptSecret('refresh-token', 'a-secure-key-with-at-least-32-chars');
    const [version, iv, ciphertext] = encrypted.split('.');
    const tamperedCiphertext = `${ciphertext!.startsWith('A') ? 'B' : 'A'}${ciphertext!.slice(1)}`;
    const tampered = `${version}.${iv}.${tamperedCiphertext}`;

    await expect(decryptSecret(tampered, 'a-secure-key-with-at-least-32-chars')).rejects.toThrow();
  });

  it('creates URL-safe random values and deterministic hashes', async () => {
    expect(randomBase64Url()).toMatch(/^[A-Za-z0-9_-]+$/);
    await expect(sha256Base64Url('state')).resolves.toBe(await sha256Base64Url('state'));
  });
});
