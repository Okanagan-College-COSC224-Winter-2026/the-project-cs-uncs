import '@testing-library/jest-dom'

// Node.js v25+ ships an experimental native localStorage that overrides
// jsdom's implementation and lacks standard methods (clear, removeItem, etc.).
// Replace it with a simple in-memory shim so tests work correctly.
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.clear !== 'function') {
  const store: Record<string, string> = {}
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value) },
    removeItem: (key: string) => { delete store[key] },
    clear: () => { Object.keys(store).forEach(k => delete store[k]) },
    get length() { return Object.keys(store).length },
    key: (index: number) => Object.keys(store)[index] ?? null,
  } as Storage
}

