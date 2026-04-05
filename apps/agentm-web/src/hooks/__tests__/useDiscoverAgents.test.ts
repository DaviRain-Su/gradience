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
    expect(result.current.isLoading).toBe(true);

    // Wait for data
    await waitFor(() => {
      expect(result.current.agents).toEqual(mockAgents);
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should handle fetch error", async () => {
    (fetch as any).mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useDiscoverAgents());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.isLoading).toBe(false);
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

    await waitFor(() => {
      expect(result.current.agents).toEqual(mockAgents);
    });

    // Refetch
    await result.current.refetch();

    expect(fetch).toHaveBeenCalledTimes(2);
  });
});
