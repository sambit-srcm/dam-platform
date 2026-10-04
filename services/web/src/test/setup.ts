// A tiny stand-in for the browser's localStorage, which the sign-in store saves into
const data = new Map<string, string>();

const fakeStorage = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => void data.set(key, value),
  removeItem: (key: string) => void data.delete(key),
  clear: () => data.clear(),
};

// The store looks the storage up through `window`. Keep a real jsdom window
// when tests ask for one; only invent a stub in the Node environment.
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: fakeStorage,
});
if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: fakeStorage },
  });
} else {
  Object.defineProperty(globalThis.window, 'localStorage', {
    configurable: true,
    value: fakeStorage,
  });
}
