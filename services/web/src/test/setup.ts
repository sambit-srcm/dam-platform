// A tiny stand-in for the browser's localStorage, which the sign-in store saves into
const data = new Map<string, string>();

const fakeStorage = {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => void data.set(key, value),
  removeItem: (key: string) => void data.delete(key),
  clear: () => data.clear(),
};

// The store looks the storage up through `window`, so both names must exist
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: fakeStorage,
});
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage: fakeStorage },
});
