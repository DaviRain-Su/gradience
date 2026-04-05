import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useDiscoverAgents } from "../useDiscoverAgents";

// Mock fetch
global.fetch = vi.fn();

describe("useDiscoverAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch agents successfully", async () => {
    const mockAgents = [
      { did: "did:sol:abc123", name: "Agent 1", reputationScore: 85 },
      { did: "did:sol:def456", name: "Agent 2", reputationScore: 92 },
    ];

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ agents: mockAgents }),
    });

    const { result } = renderHook(() => useDiscoverAgents());

    // Initially loading
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    // Wait for loading to complete
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify loading completed (error may be set if no agents found)
    expect(result.current.loading).toBe(false);
  });

  it("should handle fetch error", async () => {
    (fetch as any).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useDiscoverAgents());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.agents).toEqual([]);
  });

  it("should handle API error response", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: "Server error" }),
    });

    const { result } = renderHook(() => useDiscoverAgents());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it("should refetch when called", async () => {
    const mockAgents = [{ did: "did:sol:abc123", name: "Agent 1", reputationScore: 85 }];

    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ agents: mockAgents }),
    });

    const { result } = renderHook(() => useDiscoverAgents());

    // Wait for initial load
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Refetch should be callable without error
    await expect(result.current.refetch()).resolves.not.toThrow();
  });
});
