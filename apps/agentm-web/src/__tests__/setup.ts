import { vi } from "vitest";
import "@testing-library/jest-dom";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: function ImageMock({ src, alt, ...rest }: { src: string; alt: string; [key: string]: any }) {
    return { type: "img", props: { src, alt, ...rest } };
  },
}));

// Mock @dynamic-labs/sdk-react-core
vi.mock("@dynamic-labs/sdk-react-core", () => ({
  useDynamicContext: () => ({
    primaryWallet: {
      address: "0x1234567890abcdef",
      connector: { name: "MockConnector" },
    },
    user: { userId: "test-user-id" },
    isAuthenticated: true,
    isLoading: false,
    setShowAuthFlow: vi.fn(),
    handleLogOut: vi.fn(),
  }),
  DynamicContextProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock @dynamic-labs/solana
vi.mock("@dynamic-labs/solana", () => ({
  SolanaWalletConnector: class MockSolanaWalletConnector {},
}));

// Mock ConnectionContext
let mockSessionToken = "test-session-token";
vi.mock("../lib/connection/ConnectionContext", () => ({
  useConnection: () => ({
    get sessionToken() { return mockSessionToken; },
    set sessionToken(value: string) { mockSessionToken = value; },
    walletAddress: "0x1234567890abcdef",
    authenticate: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    refreshSession: vi.fn().mockImplementation(async () => {
      mockSessionToken = "refreshed-token";
      return { sessionToken: "refreshed-token", expiresAt: Date.now() + 86400000 };
    }),
    isConnecting: false,
    connectionError: null,
  }),
  ConnectionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock environment variables
process.env.NEXT_PUBLIC_DYNAMIC_ENVIRONMENT_ID = "test-env-id";
process.env.NEXT_PUBLIC_API_URL = "http://localhost:7420";
process.env.NEXT_PUBLIC_INDEXER_URL = "http://localhost:3001";

// Mock fetch globally
global.fetch = vi.fn();

// Mock IntersectionObserver
class IntersectionObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, "IntersectionObserver", {
  writable: true,
  configurable: true,
  value: IntersectionObserverMock,
});

// Mock ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  disconnect = vi.fn();
  unobserve = vi.fn();
}

Object.defineProperty(window, "ResizeObserver", {
  writable: true,
  configurable: true,
  value: ResizeObserverMock,
});

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
});

// Mock crypto
Object.defineProperty(window, "crypto", {
  value: {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    },
    subtle: {
      digest: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    },
  },
});

// Cleanup after each test
afterEach(() => {
  vi.clearAllMocks();
});
