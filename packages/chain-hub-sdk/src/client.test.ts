import { describe, expect, it } from "bun:test";
import { ChainHubClient, ChainHubError } from "./client";
import { SqlPermissionGuard } from "./sql-permissions";

describe("ChainHubClient", () => {
    it("constructs with default config", () => {
        const client = new ChainHubClient();
        expect(client).toBeDefined();
    });

    it("constructs with custom config", () => {
        const client = new ChainHubClient({
            baseUrl: "http://localhost:3001",
            apiKey: "test-key",
            network: "devnet",
        });
        expect(client).toBeDefined();
    });

    it("healthCheck returns false when server is unreachable", async () => {
        const client = new ChainHubClient({ baseUrl: "http://localhost:1" });
        const ok = await client.healthCheck();
        expect(ok).toBe(false);
    });

    it("getReputation returns null for unknown agent", async () => {
        const client = new ChainHubClient({ baseUrl: "http://localhost:1" });
        const rep = await client.getReputation("unknown");
        expect(rep).toBeNull();
    });

    it("getAgentInfo returns null for unknown agent", async () => {
        const client = new ChainHubClient({ baseUrl: "http://localhost:1" });
        const info = await client.getAgentInfo("unknown");
        expect(info).toBeNull();
    });
});

describe("SqlPermissionGuard", () => {
    it("allows valid SELECT queries", () => {
        const guard = new SqlPermissionGuard();
        const result = guard.validate("SELECT * FROM tasks WHERE state = 'open'");
        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
    });

    it("rejects DELETE operations by default", () => {
        const guard = new SqlPermissionGuard();
        const result = guard.validate("DELETE FROM tasks WHERE id = 1");
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain("DELETE");
    });

    it("rejects DDL statements", () => {
        const guard = new SqlPermissionGuard();
        const result = guard.validate("SELECT 1; DROP TABLE tasks");
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain("DDL");
    });

    it("rejects queries on disallowed tables", () => {
        const guard = new SqlPermissionGuard();
        const result = guard.validate("SELECT * FROM users");
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain("users");
    });

    it("rejects LIMIT exceeding maximum", () => {
        const guard = new SqlPermissionGuard({ maxRowLimit: 100 });
        const result = guard.validate("SELECT * FROM tasks LIMIT 500");
        expect(result.valid).toBe(false);
        expect(result.errors[0]).toContain("500");
    });

    it("enforceLimit appends LIMIT when missing", () => {
        const guard = new SqlPermissionGuard({ maxRowLimit: 100 });
        const sql = guard.enforceLimit("SELECT * FROM tasks");
        expect(sql).toBe("SELECT * FROM tasks LIMIT 100");
    });

    it("enforceLimit keeps existing LIMIT", () => {
        const guard = new SqlPermissionGuard({ maxRowLimit: 100 });
        const sql = guard.enforceLimit("SELECT * FROM tasks LIMIT 50");
        expect(sql).toBe("SELECT * FROM tasks LIMIT 50");
    });

    it("applyRowFilters adds WHERE clause", () => {
        const guard = new SqlPermissionGuard({
            rowFilters: { tasks: "poster = 'abc'" },
        });
        const sql = guard.applyRowFilters("SELECT * FROM tasks");
        expect(sql).toContain("WHERE poster = 'abc'");
    });

    it("rejects SQL comments", () => {
        const guard = new SqlPermissionGuard();
        const result = guard.validate("SELECT * FROM tasks -- comment");
        expect(result.valid).toBe(false);
    });
});
