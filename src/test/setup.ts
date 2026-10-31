import "@testing-library/jest-dom";
import { vi } from "vite-plus/test";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn<Storage["getItem"]>(),
  setItem: vi.fn<Storage["setItem"]>(),
  removeItem: vi.fn<Storage["removeItem"]>(),
  clear: vi.fn<Storage["clear"]>(),
  length: 0,
  key: vi.fn<Storage["key"]>(),
};
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  writable: true,
  value: localStorageMock,
});

// Mock ResizeObserver
Object.defineProperty(globalThis, "ResizeObserver", {
  configurable: true,
  writable: true,
  // A class, because libraries such as React Flow construct it with `new`.
  value: class implements ResizeObserver {
    observe = vi.fn<ResizeObserver["observe"]>();
    unobserve = vi.fn<ResizeObserver["unobserve"]>();
    disconnect = vi.fn<ResizeObserver["disconnect"]>();
  },
});

// Mock matchMedia
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn<typeof window.matchMedia>().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn<MediaQueryList["addListener"]>(),
      removeListener: vi.fn<MediaQueryList["removeListener"]>(),
      addEventListener: vi.fn<MediaQueryList["addEventListener"]>(),
      removeEventListener: vi.fn<MediaQueryList["removeEventListener"]>(),
      dispatchEvent: vi.fn<MediaQueryList["dispatchEvent"]>().mockReturnValue(false),
    })),
  });
}
