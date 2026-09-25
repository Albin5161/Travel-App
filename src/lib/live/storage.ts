// The web build keeps the sign-in, your name and your photo in the browser's localStorage.
// Phones use storage.native.ts.
export const deviceStorage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage;
export const sessionStorage = deviceStorage;
