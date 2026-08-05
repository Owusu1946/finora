/**
 * Map universal / custom payment URLs onto the Expo Router path `/pay/r/[id]`.
 * https://docs.expo.dev/router/advanced/native-intent/
 */
export function redirectSystemPath({
  path,
  initial: _initial,
}: {
  path: string;
  initial: boolean;
}): string {
  const decoded = (() => {
    try {
      return decodeURIComponent(path);
    } catch {
      return path;
    }
  })();

  const fromHttps = decoded.match(
    /(?:https?:\/\/)?(?:www\.)?pay\.finora\.app\/r\/([A-Za-z0-9_-]+)/i,
  );
  if (fromHttps?.[1]) return `/pay/r/${fromHttps[1]}`;

  const fromScheme = decoded.match(/finora:\/\/pay\/r\/([A-Za-z0-9_-]+)/i);
  if (fromScheme?.[1]) return `/pay/r/${fromScheme[1]}`;

  const fromPath = decoded.match(/(?:^|\/)pay\/r\/([A-Za-z0-9_-]+)/i);
  if (fromPath?.[1] && !decoded.includes('/pay/r/')) {
    return `/pay/r/${fromPath[1]}`;
  }

  return path;
}
