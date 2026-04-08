import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIdentity } from "../useIdentity";

const mockConnection = vi.hoisted(() => ({
  fetchApi: vi.fn(),
}));

vi.mock("@/lib/connection/ConnectionContext", () => ({
  useConnection: () => mockConnection,
}));

describe("useIdentity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnection.fetchApi = vi.fn();
  });

  describe("bindWallet", () => {
    it("returns binding data on success", async () => {
      const response = {
        accountId: "acc1",
        primaryWallet: "0xWallet",
        createdAt: 1234567890,
      };
      mockConnection.fetchApi.mockResolvedValueOnce(response);

      const { result } = renderHook(() => useIdentity());

      let res: typeof response | null = null;
      await act(async () => {
        res = await result.current.bindWallet({
          accountId: "acc1",
          primaryWallet: "0xWallet",
          signature: "sig",
        });
      });

      expect(mockConnection.fetchApi).toHaveBeenCalledWith(
        "/api/v1/identity/bind",
        {
          method: "POST",
          body: JSON.stringify({
            accountId: "acc1",
            primaryWallet: "0xWallet",
            signature: "sig",
          }),
        }
      );
      expect(res).toEqual(response);
    });

    it("returns null when fetchApi is unavailable", async () => {
      mockConnection.fetchApi = null as any;

      const { result } = renderHook(() => useIdentity());

      let res: unknown;
      await act(async () => {
        res = await result.current.bindWallet({
          accountId: "acc1",
          primaryWallet: "0xWallet",
          signature: "sig",
        });
      });

      expect(res).toBeNull();
    });
  });

  describe("getTier", () => {
    it("returns tier info on success", async () => {
      const tierInfo = {
        tier: "verified" as const,
        permissions: {
          maxTaskValue: "1000",
          canBeJudge: true,
          canPostHighValueTask: false,
        },
        requirements: {
          walletAgeDays: 30,
          oauth: true,
          zkKyc: false,
          minCompletedTasks: 0,
          minReputationScore: 0,
        },
        metrics: {
          walletAgeDays: 30,
          oauthBound: true,
          zkKycBound: false,
          completedTasks: 0,
          reputationScore: 0,
        },
      };
      mockConnection.fetchApi.mockResolvedValueOnce(tierInfo);

      const { result } = renderHook(() => useIdentity());

      let res: typeof tierInfo | null = null;
      await act(async () => {
        res = await result.current.getTier("acc1");
      });

      expect(mockConnection.fetchApi).toHaveBeenCalledWith(
        "/api/v1/identity/tier/acc1"
      );
      expect(res).toEqual(tierInfo);
    });

    it("returns null when fetchApi is unavailable", async () => {
      mockConnection.fetchApi = null as any;

      const { result } = renderHook(() => useIdentity());

      let res: unknown;
      await act(async () => {
        res = await result.current.getTier("acc1");
      });

      expect(res).toBeNull();
    });
  });

  describe("getBinding", () => {
    it("returns binding info on success", async () => {
      const binding = {
        accountId: "acc1",
        primaryWallet: "0xWallet",
        oauthBound: true,
        zkKycBound: false,
        createdAt: 1234567890,
        cooldownRemainingMs: 0,
      };
      mockConnection.fetchApi.mockResolvedValueOnce(binding);

      const { result } = renderHook(() => useIdentity());

      let res: typeof binding | null = null;
      await act(async () => {
        res = await result.current.getBinding("0xWallet");
      });

      expect(mockConnection.fetchApi).toHaveBeenCalledWith(
        "/api/v1/identity/binding/0xWallet"
      );
      expect(res).toEqual(binding);
    });
  });

  describe("verifyZkKyc", () => {
    it("returns verified response on success", async () => {
      const response = {
        accountId: "acc1",
        zkVerified: true,
        nullifierHash: "0xNull",
      };
      mockConnection.fetchApi.mockResolvedValueOnce(response);

      const { result } = renderHook(() => useIdentity());

      let res: typeof response | null = null;
      await act(async () => {
        res = await result.current.verifyZkKyc("acc1", "0xNull");
      });

      expect(mockConnection.fetchApi).toHaveBeenCalledWith(
        "/api/v1/identity/zk-verify",
        {
          method: "POST",
          body: JSON.stringify({
            accountId: "acc1",
            nullifierHash: "0xNull",
          }),
        }
      );
      expect(res).toEqual(response);
    });
  });
});
