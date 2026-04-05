import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useSessionAuth } from "../useSessionAuth";

// Get the mock from setup.ts
const localStorageMock = window.localStorage as unknown as {
  getItem: ReturnType<typeof vi.fn>;
  setItem: ReturnType<typeof vi.fn>;
  removeItem: ReturnType<typeof vi.fn>;
};

describe("useSessionAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue(null);
  });

  it("should initialize as unauthenticated", () => {
    const { result } = renderHook(() => useSessionAuth());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.sessionToken).toBeNull();
  });

  it("should check for existing session on mount", () => {
    localStorageMock.getItem.mockReturnValue("existing-token");

    const { result } = renderHook(() => useSessionAuth());

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.sessionToken).toBe("existing-token");
  });

  it("should authenticate successfully", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionToken: "new-token", expiresAt: Date.now() + 86400000 }),
    });

    const { result } = renderHook(() => useSessionAuth());

    await act(async () => {
      await result.current.authenticate("wallet-address", "signature");
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.sessionToken).toBe("new-token");
    expect(localStorageMock.setItem).toHaveBeenCalledWith("sessionToken", "new-token");
  });

  it("should handle authentication failure", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid signature" }),
    });

    const { result } = renderHook(() => useSessionAuth());

    await act(async () => {
      await expect(
        result.current.authenticate("wallet-address", "invalid-signature")
      ).rejects.toThrow();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBeTruthy();
  });

  it("should logout successfully", async () => {
    localStorageMock.getItem.mockReturnValue("existing-token");

    const { result } = renderHook(() => useSessionAuth());

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.sessionToken).toBeNull();
    expect(localStorageMock.removeItem).toHaveBeenCalledWith("sessionToken");
  });

  it("should refresh session before expiry", async () => {
    const nearExpiryToken = "near-expiry-token";
    localStorageMock.getItem.mockReturnValue(nearExpiryToken);

    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sessionToken: "refreshed-token", expiresAt: Date.now() + 86400000 }),
    });

    const { result } = renderHook(() => useSessionAuth());

    await act(async () => {
      await result.current.refreshSession();
    });

    expect(result.current.sessionToken).toBe("refreshed-token");
  });
});
