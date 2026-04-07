# A2A 消息格式链下规范（草案）

> **文档状态**: Draft  
> **创建日期**: 2026-04-07  
> **关联文档**: `03-technical-spec.md`, `docs/multi-chain/02-architecture.md`  
> **优先级**: P2

---

## 1. 设计原则

A2A（Agent-to-Agent）消息在链下传输、链上锚定。链上合约 `A2AChannelRegistry` 只存储轻量化的通道状态，消息正文永远不直接上链。

| 层级 | 存储位置 | 内容 |
|------|---------|------|
| **消息正文** | 链下（IPFS / Arweave / 私有 relay） | 加密后的 JSON envelope |
| **通道元数据** | 链上 `A2AChannelRegistry` | channel ID、参与者列表、最后同步 message hash |
| **消息哈希链** | 链上 / 事件日志 | `MessageAnchor(channelId, messageHash, previousHash)` |

---

## 2. 消息 Envelope 格式

```json
{
  "version": "1.0",
  "channel_id": "bytes32 hex string",
  "sender": "evm address or solana pubkey",
  "recipient": "evm address or solana pubkey",
  "timestamp": 1712486400,
  "previous_hash": "sha256 of previous message envelope",
  "payload_hash": "sha256 of encrypted payload",
  "payload_cid": "ipfs://Qm...",
  "encryption": {
    "algorithm": "xcha-cha20-poly1305",
    "ephemeral_pubkey": "base64"
  }
}
```

- `payload_cid`: 指向链下托管的加密 payload。
- `payload_hash`: 用于快速校验 payload 完整性，无需下载完整内容即可验证。
- `previous_hash`: 形成链式结构，保证消息顺序不可篡改。

---

## 3. Payload 格式（解密后）

```json
{
  "type": "text|task_offer|task_result|payment_request|status_update",
  "content": {
    ...type-specific fields...
  },
  "signatures": {
    "sender": "base64 signature of payload_hash"
  }
}
```

**当前阶段支持的类型**:
- `text`: 纯文本消息
- `task_offer`: 子任务报价（关联 `SubtaskMarket`）
- `task_result`: 子任务结果交付
- `status_update`: Agent 状态广播

---

## 4. 加密标准

| 需求 | 推荐方案 | 备注 |
|------|---------|------|
| 端到端加密 | **MLS** (Message Layer Security) | 长期目标，支持群聊前向保密 |
| 过渡期加密 | **XChaCha20-Poly1305** + ECDH | 轻量、库支持广泛（libsodium） |
| 密钥协商 | ECDH (secp256k1 / Ed25519) | 复用 Agent 已有的身份密钥对 |

**注意**: 链上合约不处理任何加密/解密逻辑，仅验证消息哈希锚定。

---

## 5. 链上锚定合约（未来实现）

```solidity
contract A2AChannelRegistry {
    struct Channel {
        address[] participants;
        bytes32 lastMessageHash;
        uint64 lastAnchorAt;
        bool exists;
    }

    mapping(bytes32 => Channel) public channels;

    event ChannelCreated(bytes32 indexed channelId, address[] participants);
    event MessageAnchored(bytes32 indexed channelId, bytes32 messageHash, bytes32 previousHash);
}
```

---

## 6. 向后兼容与演进

- `envelope.version` 字段保证未来格式升级时可识别旧消息。
- 新的加密算法通过在 `encryption.algorithm` 中显式声明来区分。
- 不建议在已存在的 channel 中切换加密算法；如需升级，应创建新 channel。
