import Constants from 'expo-constants';

const LAN_PROXY_PORT = 8788;

function normalizeUrl(value: string | undefined) {
  return value?.trim().replace(/\/$/, '') || null;
}

function getMetroHost() {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;

  try {
    return new URL(`http://${hostUri}`).hostname;
  } catch {
    return hostUri.split(':')[0] || null;
  }
}

function isPrivateIpv4(host: string) {
  const octets = host.split('.').map(Number);
  if (
    octets.length !== 4 ||
    octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)
  ) {
    return false;
  }

  return (
    octets[0] === 10 ||
    (octets[0] === 172 && octets[1] !== undefined && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
}

export function getApiUrl() {
  if (__DEV__) {
    const metroHost = getMetroHost();
    if (metroHost && isPrivateIpv4(metroHost)) {
      return `http://${metroHost}:${LAN_PROXY_PORT}`;
    }
  }

  return normalizeUrl(process.env.EXPO_PUBLIC_API_URL);
}
