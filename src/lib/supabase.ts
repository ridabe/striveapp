import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import type { Database } from '@/types/database';

// SecureStore has a ~2048 byte per-key limit. Supabase JWT tokens exceed this,
// so we split large values into chunks to avoid silent storage failures.
const CHUNK_SIZE = 1800;

const ExpoSecureStoreAdapter = {
  getItem: async (key: string) => {
    // Try direct key first (small values)
    const direct = await SecureStore.getItemAsync(key);
    if (direct !== null) return direct;

    // Reassemble from chunks
    const chunks: string[] = [];
    let i = 0;
    while (true) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (chunk === null) break;
      chunks.push(chunk);
      i++;
    }
    return chunks.length > 0 ? chunks.join('') : null;
  },

  setItem: async (key: string, value: string) => {
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    // Remove any old direct value before chunking
    await SecureStore.deleteItemAsync(key).catch(() => {});
    let i = 0;
    for (let offset = 0; offset < value.length; offset += CHUNK_SIZE) {
      await SecureStore.setItemAsync(
        `${key}_chunk_${i}`,
        value.slice(offset, offset + CHUNK_SIZE),
      );
      i++;
    }
  },

  removeItem: async (key: string) => {
    await SecureStore.deleteItemAsync(key).catch(() => {});
    let i = 0;
    while (true) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (chunk === null) break;
      await SecureStore.deleteItemAsync(`${key}_chunk_${i}`);
      i++;
    }
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
