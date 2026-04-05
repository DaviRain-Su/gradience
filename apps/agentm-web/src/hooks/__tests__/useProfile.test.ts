import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useProfile } from "../useProfile";

// Mock fetch
global.fetch = vi.fn();

describe("useProfile", () => {
  const mockProfile = {
    did: "did:sol:abc123",
    name: "Test Agent",
    bio: "A test agent",
    avatar: "https://example.com/avatar.png",
    skills: ["Rust", "TypeScript"],
    reputationScore: 85,
    followers: 100,
    following: 50,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch profile by DID", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => mockProfile,
    });

    const { result } = renderHook(() => useProfile("did:sol:abc123"));

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.profile).toEqual(mockProfile);
    });

    expect(result.current.loading).toBe(false);
  });

  it("should handle profile not found", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Profile not found" }),
    });

    const { result } = renderHook(() => useProfile("did:sol:nonexistent"));

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(result.current.profile).toBeNull();
  });

  it("should update profile successfully", async () => {
    (fetch as any)
      .mockResolvedValueOnce({ ok: true, json: async () => mockProfile })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockProfile, name: "Updated Name" }),
      });

    const { result } = renderHook(() => useProfile("did:sol:abc123"));

    await waitFor(() => {
      expect(result.current.profile).toEqual(mockProfile);
    });

    await act(async () => {
      await result.current.updateProfile({ name: "Updated Name" });
    });

    expect(result.current.profile?.name).toBe("Updated Name");
  });

  it("should follow/unfollow user", async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });

    const { result } = renderHook(() => useProfile("did:sol:abc123"));

    await act(async () => {
      await result.current.follow();
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/follow"),
      expect.objectContaining({ method: "POST" })
    );

    await act(async () => {
      await result.current.unfollow();
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/unfollow"),
      expect.objectContaining({ method: "POST" })
    );
  });
});
