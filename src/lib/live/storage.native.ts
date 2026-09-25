// On a phone, expo-sqlite provides a synchronous localStorage that survives restarts (Expo's guide
// for SDK 57). Supabase keeps the sign-in in it, and the app keeps your name and photo there.
// The web build uses the browser's own; see storage.ts.
import 'expo-sqlite/localStorage/install';

export const deviceStorage: Storage | undefined = globalThis.localStorage;
export const sessionStorage = deviceStorage;
