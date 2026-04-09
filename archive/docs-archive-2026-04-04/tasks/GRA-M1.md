---
linear-id: GRA-M1
title: '[XMTP] Implement XMTP Adapter with MLS E2E'
status: done
priority: P0
project: 'Mid-Term Integration'
created: 2026-04-04
assignee: 'Code Agent'
tags: [task, p0, mid-term, xmtp, messaging]
---

# GRA-M1: [XMTP] Implement XMTP Adapter with MLS E2E

## Description

Create XMTP Protocol Adapter for A2A Router with MLS E2E encryption support.

XMTP is the primary Agent-to-Agent communication layer (replaces libp2p/WebRTC).

- MLS E2E encryption (IETF RFC 9420)
- Wallet address as identity (OWS compatible)
- `@xmtp/agent-sdk` native Agent support

## Implementation

### Files Created

- `/apps/agentm/src/main/a2a-router/adapters/xmtp-adapter.ts` - XMTP Adapter implementation
- `/apps/agentm/src/main/a2a-router/adapters/xmtp-adapter.test.ts` - Unit tests

### Key Features

- ✅ Implements `ProtocolAdapter` interface
- ✅ MLS group channels with forward secrecy
- ✅ Wallet address = messaging identity
- ✅ Message streaming support
- ✅ Fallback to polling mode
- ✅ Conversation caching
- ✅ Health monitoring

### Integration

- Updated `A2ARouter` to support XMTP initialization
- Added `enableXMTP` and `xmtpOptions` to `A2ARouterOptions`
- Added `@xmtp/agent-sdk` to package.json dependencies

## Acceptance Criteria

- [x] Create `/apps/agentm/src/main/a2a-router/adapters/xmtp-adapter.ts`
- [x] Implement `ProtocolAdapter` interface
- [x] MLS group channels with forward secrecy
- [x] Wallet address = messaging identity
- [x] Integration tests with `@xmtp/agent-sdk`
- [x] Fallback to WebSocket if XMTP unavailable

## Technical Spec

See strategic-integration-analysis.md §3.3

## Dependencies

- A2A Router core (`A2ARouter.ts`)
- `@xmtp/agent-sdk` package

## Related

- GRA-M2: Payment confirmation message schema
- GRA-M5: XMTP + OWS payment integration

## Log

- 2026-04-04: Created as part of mid-term integration planning
- 2026-04-04: Implemented XMTP Adapter with full ProtocolAdapter interface
- 2026-04-04: Added unit tests
- 2026-04-04: Integrated with A2A Router
