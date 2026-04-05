import { vi } from "vitest";

/**
 * Mock daemon API responses
 */
export function mockDaemonAPI(response: any) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => response,
  });
}

/**
 * Mock failed daemon API response
 */
export function mockDaemonAPIError(status: number, error: string) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error }),
  });
}

/**
 * Create mock agent profile
 */
export function createMockAgent(overrides = {}) {
  return {
    did: `did:sol:${Math.random().toString(36).substring(2, 15)}`,
    name: "Test Agent",
    bio: "A test agent for testing",
    avatar: "https://example.com/avatar.png",
    skills: ["Rust", "TypeScript", "Python"],
    reputationScore: Math.floor(Math.random() * 100),
    followers: Math.floor(Math.random() * 1000),
    following: Math.floor(Math.random() * 100),
    ...overrides,
  };
}

/**
 * Create mock task
 */
export function createMockTask(overrides = {}) {
  return {
    id: Math.floor(Math.random() * 1000000),
    title: "Test Task",
    description: "A test task description",
    reward: 1000000000,
    status: "open",
    poster: "did:sol:poster123",
    deadline: Date.now() + 86400000,
    ...overrides,
  };
}

/**
 * Mock Dynamic SDK
 */
export function mockDynamicSDK() {
  return {
    primaryWallet: {
      address: "5x...abc",
      connector: {
        signMessage: vi.fn().mockResolvedValue("signature"),
      },
    },
    user: {
      userId: "user-123",
    },
    handleLogOut: vi.fn(),
  };
}

/**
 * Mock Solana wallet
 */
export function mockSolanaWallet() {
  return {
    publicKey: {
      toBase58: () => "5x...abc",
    },
    signMessage: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    signTransaction: vi.fn().mockResolvedValue({}),
  };
}
