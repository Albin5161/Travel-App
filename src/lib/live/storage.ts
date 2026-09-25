// The web build keeps the sign-in in the browser's localStorage. Phones use storage.native.ts.
export const sessionStorage = typeof window === 'undefined' ? undefined : window.localStorage;
