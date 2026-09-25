// On a phone, Supabase keeps the sign-in in expo-sqlite's localStorage, so it survives a restart
// (Expo's guide for SDK 57). The web build uses the browser's own; see storage.ts.
import 'expo-sqlite/localStorage/install';

export const sessionStorage = globalThis.localStorage;
