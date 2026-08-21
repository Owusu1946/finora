import AsyncStorage from '@react-native-async-storage/async-storage';

// Remove the pre-server cache left by older app versions during session reset.
export async function clearMemoryStore(): Promise<void> {
  try {
    await AsyncStorage.removeItem('finora.memories.v1');
  } catch {
    // A missing native storage module should not block sign-out cleanup.
  }
}
