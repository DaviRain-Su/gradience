# Critical TODOs 实现指南

**文档目的**: 详细说明如何修复所有 Critical 和 High 优先级的 TODO  
**预计总工作量**: 52 小时  
**难度**: 中高级 (需要 Solana、TypeScript、Rust 知识)

---

## 📋 目录

1. [环境准备](#环境准备)
2. [Critical TODOs (18项)](#critical-todos)
3. [High Priority TODOs (15项)](#high-priority-todos)
4. [测试验证](#测试验证)
5. [故障排除](#故障排除)

---

## 环境准备

### 1.1 安装全局依赖

```bash
# Node.js 依赖
npm install -g pnpm

# Rust 工具链
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup component add rustfmt clippy

# Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/v1.18.4/install)"

# 验证安装
solana --version  # 应显示 1.18.4+
rustc --version   # 应显示 1.75.0+
```

### 1.2 配置 Solana

```bash
# 设置 devnet
solana config set --url https://api.devnet.solana.com

# 生成密钥对 (如果还没有)
solana-keygen new --outfile ~/.config/solana/id.json

# 获取测试 SOL
solana airdrop 2
solana airdrop 2
solana airdrop 2  # 共 6 SOL
```

### 1.3 安装项目依赖

```bash
cd /Users/davirian/dev/active/gradience

# 安装所有依赖
pnpm install

# 安装 Solana 相关依赖
cd packages/workflow-engine
pnpm add @solana/web3.js @solana/spl-token

# 安装 Jupiter SDK
pnpm add @jup-ag/core

# 安装 Wormhole SDK (如果需要跨链)
pnpm add @wormhole-foundation/sdk

# 返回根目录
cd ../..
```

---

## Critical TODOs

### 1. Trading Handlers (5项) ⭐⭐⭐

**文件**: `packages/workflow-engine/src/handlers/trading-real.ts`  
**预计时间**: 10小时  
**难度**: 高

#### 1.1 createRealSwapHandler - Jupiter 集成

**当前状态**: 已实现框架，需要测试和优化

**实现步骤**:

```typescript
// 1. 确保依赖已安装
pnpm add @solana/web3.js @jup-ag/core

// 2. 创建测试脚本 tests/swap-test.ts
import { Connection, Keypair } from '@solana/web3.js';
import { createRealSwapHandler } from '../src/handlers/trading-real';

async function testSwap() {
  // 创建连接
  const connection = new Connection('https://api.devnet.solana.com');
  
  // 加载密钥 (使用测试密钥)
  const signer = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(require('fs').readFileSync(
      require('os').homedir() + '/.config/solana/id.json'
    )))
  );
  
  // 创建 handler
  const handler = createRealSwapHandler({ connection });
  
  // 测试参数
  const params = {
    from: 'So11111111111111111111111111111111111111112', // SOL
    to: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    amount: '10000000', // 0.01 SOL
    slippage: 0.5,
    signer,
  };
  
  try {
    const result = await handler.execute('solana', params, {
      executor: signer.publicKey.toBase58(),
    });
    
    console.log('Swap successful!');
    console.log('Transaction:', result.txHash);
    console.log('Explorer:', result.explorer);
  } catch (error) {
    console.error('Swap failed:', error);
  }
}

testSwap();
```

**运行测试**:
```bash
cd packages/workflow-engine
npx tsx tests/swap-test.ts
```

**常见问题**:
- **错误**: `Insufficient funds` → 需要更多测试 SOL
- **错误**: `Jupiter quote failed` → 检查 token mint 地址
- **错误**: `Transaction failed` → 检查 slippage 是否足够

#### 1.2 createRealTransferHandler - 转账实现

**实现代码** (已在 trading-real.ts 中):

```typescript
// 关键逻辑
if (token === 'SOL') {
  // 原生 SOL 转账
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: signer.publicKey,
      toPubkey: recipient,
      lamports: Number(lamports),
    })
  );
  signature = await connection.sendTransaction(transaction, [signer]);
} else {
  // SPL Token 转账
  const transaction = new Transaction().add(
    createTransferInstruction(
      senderAta.address,
      recipientAta.address,
      signer.publicKey,
      Number(lamports)
    )
  );
  signature = await connection.sendTransaction(transaction, [signer]);
}
```

**测试脚本**:
```typescript
// tests/transfer-test.ts
import { createRealTransferHandler } from '../src/handlers/trading-real';

async function testTransfer() {
  const handler = createRealTransferHandler();
  
  // 测试 SOL 转账
  const result = await handler.execute('solana', {
    token: 'SOL',
    to: ' recipient-address',
    amount: '1000000', // 0.001 SOL
    signer,
  }, { executor: signer.publicKey.toBase58() });
  
  console.log('Transfer:', result.txHash);
}
```

#### 1.3 createRealStakeHandler - 质押实现

**推荐方案**: 使用 Marinade 或 Jito 质押池 (比原生质押更简单)

**Marinade 集成**:

```typescript
// 安装 Marinade SDK
pnpm add @marinade.finance/marinade-ts-sdk

// 实现
import { Marinade } from '@marinade.finance/marinade-ts-sdk';

export function createMarinadeStakeHandler() {
  return {
    async execute(chain, params, context) {
      const { amount, signer } = params;
      
      const marinade = new Marinade(connection);
      
      // 存入 SOL，获得 mSOL
      const { transaction } = await marinade.deposit(
        new BN(amount),
        { wallet: { publicKey: signer.publicKey, signTransaction: async (tx) => {
          tx.sign(signer);
          return tx;
        }} }
      );
      
      const signature = await connection.sendRawTransaction(
        transaction.serialize()
      );
      
      return {
        txHash: signature,
        amount,
        received: 'mSOL',
        explorer: `https://explorer.solana.com/tx/${signature}`,
      };
    }
  };
}
```

**替代方案**: 原生质押 (更复杂，需要管理 stake account)

#### 1.4 createRealBridgeHandler - Wormhole 集成

**安装依赖**:
```bash
pnpm add @wormhole-foundation/sdk
```

**实现框架**:

```typescript
import { Wormhole, chainToPlatform } from '@wormhole-foundation/sdk';
import solana from '@wormhole-foundation/sdk/solana';
import evm from '@wormhole-foundation/sdk/evm';

export function createWormholeBridgeHandler() {
  let wh: Wormhole;
  
  async function initWormhole() {
    if (!wh) {
      wh = await Wormhole.init(
        'Testnet', // 或 'Mainnet'
        [solana, evm],
      );
    }
    return wh;
  }
  
  return {
    async execute(chain, params, context) {
      const { fromChain, toChain, token, amount, recipient, signer } = params;
      
      const wh = await initWormhole();
      
      // 获取 chain context
      const sourceChain = wh.getChain(fromChain);
      const destChain = wh.getChain(toChain);
      
      // 创建 token bridge
      const tokenBridge = await sourceChain.getTokenBridge();
      
      // 发起转账
      const transfer = await tokenBridge.transfer(
        recipient,
        token,
        BigInt(amount),
        signer.publicKey.toBase58()
      );
      
      // 签名并发送
      const transaction = transfer.transaction;
      transaction.sign(signer);
      
      const signature = await connection.sendRawTransaction(
        transaction.serialize()
      );
      
      return {
        txHash: signature,
        vaa: transfer.vaa, // 需要在目标链上 redeem
      };
    }
  };
}
```

**注意**: Wormhole 集成较复杂，建议先实现 Solana 内部转账，跨链作为第二阶段。

---

### 2. Judge Evaluators (3项) ⭐⭐⭐

**文件**: `apps/agent-arena/program/src/judge/mod.rs`  
**预计时间**: 6小时  
**难度**: 高 (需要 Rust + AI 集成)

#### 2.1 LlmScoreEvaluator - AI 评判

**当前代码**:
```rust
pub struct LlmScoreEvaluator;

impl IJudge for LlmScoreEvaluator {
    fn evaluate(&self, _task: &Task, _submission: &Submission) -> Result<u8, ProgramError> {
        // TODO: Call DSPy Python service or OpenAI API
        Err(ProgramError::Custom(IJUDGE_STUB_NOT_IMPLEMENTED_ERROR))
    }
}
```

**实现方案 A: 调用外部 HTTP 服务 (推荐)**

```rust
// 在 Judge Daemon (TypeScript) 中实现，而不是在链上程序中
// 因为 Solana 程序无法直接调用外部 HTTP API

// apps/agent-arena/judge-daemon/src/evaluators/llm.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function evaluateWithLLM(
  taskDescription: string,
  criteria: string[],
  submission: string,
): Promise<{ score: number; reasoning: string }> {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `You are an expert judge evaluating task submissions.
Evaluate based on the given criteria and return a score (0-100) and detailed reasoning.`,
      },
      {
        role: 'user',
        content: `Task: ${taskDescription}\n\nCriteria:\n${criteria.join('\n')}\n\nSubmission:\n${submission}`,
      },
    ],
    response_format: { type: 'json_object' },
  });
  
  const result = JSON.parse(response.choices[0].message.content!);
  return {
    score: Math.min(100, Math.max(0, result.score)),
    reasoning: result.reasoning,
  };
}
```

**实现方案 B: 使用已有的 DSPy 服务**

```typescript
// 调用已有的 Python 服务
export async function evaluateWithDSPy(
  task: Task,
  submission: Submission,
): Promise<{ score: number; reasoning: string }> {
  const response = await fetch('http://localhost:8000/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      task_desc: task.description,
      criteria: task.eval_criteria,
      result: submission.result_ref,
      trace: submission.trace_ref,
    }),
  });
  
  return await response.json();
}
```

#### 2.2 OnChainEvaluator - 链上评判

**用途**: 执行 WASM 字节码或调用其他程序

```rust
// apps/agent-arena/program/src/judge/on_chain.rs
use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    program_error::ProgramError,
    wasm::{WasmEngine, WasmConfig},
};

pub struct OnChainEvaluator;

impl IJudge for OnChainEvaluator {
    fn evaluate(&self, task: &Task, submission: &Submission) -> Result<u8, ProgramError> {
        // 1. 从 evaluation_ref 获取 WASM 字节码
        let wasm_bytes = self.fetch_wasm(&task.evaluation_ref)?;
        
        // 2. 创建 WASM 引擎
        let engine = WasmEngine::new(WasmConfig {
            max_memory: 1024 * 1024, // 1MB
            max_execution_time: 5000, // 5秒
            disable_float: true,      // 禁用浮点(确定性)
        });
        
        // 3. 实例化 WASM 模块
        let module = engine.compile(&wasm_bytes)?;
        let instance = module.instantiate()?;
        
        // 4. 准备输入数据
        let input = json!({
            "task": task,
            "submission": submission,
        });
        
        // 5. 执行 WASM 函数
        let result = instance.call("evaluate", &[input.to_string()])?;
        
        // 6. 解析结果
        let score: u8 = result.parse()?;
        
        Ok(score)
    }
}
```

**注意**: Solana 的 WASM 执行需要特殊配置，可能需要使用 `solana-wasm` crate。

#### 2.3 TestCasesEvaluator - 测试用例评判

```rust
impl IJudge for TestCasesEvaluator {
    fn evaluate(&self, task: &Task, submission: &Submission) -> Result<u8, ProgramError> {
        // 1. 获取测试用例
        let test_cases = self.fetch_test_cases(&task.evaluation_ref)?;
        
        // 2. 获取提交结果
        let result = self.fetch_result(&submission.result_ref)?;
        
        // 3. 对比结果
        let passed = test_cases.iter()
            .filter(|tc| tc.expected == result.get(&tc.id))
            .count();
        
        let total = test_cases.len();
        let score = (passed * 100 / total) as u8;
        
        Ok(score)
    }
}
```

---

### 3. Settlement Bridge (3项) ⭐⭐⭐

**文件**: `apps/agent-daemon/src/bridge/settlement-bridge.ts`  
**预计时间**: 6小时  
**难度**: 高

#### 3.1 submitToChainHub - Solana 交易提交

**实现**:

```typescript
import { Connection, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { GradienceSDK } from '@gradiences/agent-arena';

export class SettlementBridge {
  private connection: Connection;
  private sdk: GradienceSDK;
  
  constructor(connection: Connection, sdk: GradienceSDK) {
    this.connection = connection;
    this.sdk = sdk;
  }
  
  async submitToChainHub(
    taskId: string,
    winner: string,
    score: number,
    reasonRef: string,
  ): Promise<string> {
    // 1. 构建 judge_and_pay 交易
    const transaction = await this.sdk.judgeAndPayBuilder({
      taskId: new PublicKey(taskId),
      winner: new PublicKey(winner),
      score,
      reasonRef,
    });
    
    // 2. 发送交易
    const signature = await sendAndConfirmTransaction(
      this.connection,
      transaction,
      [this.sdk.wallet], // 需要 Judge 的签名
    );
    
    // 3. 验证交易
    await this.verifyOnChain(signature);
    
    return signature;
  }
  
  async verifyOnChain(signature: string): Promise<boolean> {
    const status = await this.connection.getSignatureStatus(signature);
    return status.value?.confirmationStatus === 'confirmed';
  }
}
```

---

### 4. Agent Daemon Evaluation (5项) ⭐⭐⭐

**文件**: `apps/agent-daemon/src/evaluator/runtime.ts`  
**预计时间**: 12小时  
**难度**: 高

#### 4.1 evaluateUI - Playwright 集成

```typescript
import { chromium, Browser, Page } from 'playwright';

export async function evaluateUI(
  url: string,
  criteria: UICriteria[],
): Promise<EvaluationResult> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  try {
    // 1. 访问页面
    await page.goto(url);
    
    // 2. 执行测试
    const results = [];
    for (const criterion of criteria) {
      const result = await testCriterion(page, criterion);
      results.push(result);
    }
    
    // 3. 计算分数
    const score = results.filter(r => r.passed).length / results.length * 100;
    
    return {
      score,
      details: results,
    };
  } finally {
    await browser.close();
  }
}

async function testCriterion(page: Page, criterion: UICriteria) {
  switch (criterion.type) {
    case 'element_exists':
      const element = await page.$(criterion.selector);
      return { passed: !!element, message: criterion.name };
      
    case 'text_content':
      const text = await page.textContent(criterion.selector);
      return { 
        passed: text?.includes(criterion.expectedText),
        message: `Expected "${criterion.expectedText}", got "${text}"`,
      };
      
    case 'clickable':
      const clickable = await page.isEnabled(criterion.selector);
      return { passed: clickable, message: criterion.name };
      
    default:
      return { passed: false, message: 'Unknown criterion type' };
  }
}
```

#### 4.2 evaluateAPI - API 测试

```typescript
import axios from 'axios';

export async function evaluateAPI(
  endpoint: string,
  testCases: APITestCase[],
): Promise<EvaluationResult> {
  const results = [];
  
  for (const testCase of testCases) {
    try {
      const response = await axios({
        method: testCase.method,
        url: endpoint + testCase.path,
        headers: testCase.headers,
        data: testCase.body,
      });
      
      const passed = 
        response.status === testCase.expectedStatus &&
        JSON.stringify(response.data) === JSON.stringify(testCase.expectedBody);
      
      results.push({ passed, message: testCase.name });
    } catch (error) {
      results.push({ passed: false, message: error.message });
    }
  }
  
  const score = results.filter(r => r.passed).length / results.length * 100;
  
  return { score, details: results };
}
```

#### 4.3 evaluateContent - LLM as Judge

```typescript
export async function evaluateContent(
  content: string,
  criteria: string[],
): Promise<EvaluationResult> {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'Evaluate the content based on the criteria. Return JSON with score (0-100) and feedback.',
      },
      {
        role: 'user',
        content: `Content:\n${content}\n\nCriteria:\n${criteria.join('\n')}`,
      },
    ],
    response_format: { type: 'json_object' },
  });
  
  const result = JSON.parse(response.choices[0].message.content!);
  
  return {
    score: result.score,
    feedback: result.feedback,
  };
}
```

---

## High Priority TODOs

### 5. Payment Handlers (4项) ⭐⭐

**文件**: `packages/workflow-engine/src/handlers/payment.ts`  
**预计时间**: 8小时

#### 5.1 x402 Payment

```typescript
// 使用 @solana/x402 (如果可用)
// 或者自己实现 x402 协议

export function createX402PaymentHandler() {
  return {
    async execute(chain, params, context) {
      const { recipient, amount, token } = params;
      
      // x402 协议: 402 Payment Required
      // 1. 创建支付意图
      // 2. 等待支付证明
      // 3. 验证并执行
      
      throw new Error('x402 protocol implementation pending');
    }
  };
}
```

**替代方案**: 使用标准 SPL Token transfer，标记为 x402 兼容。

#### 5.2 MPP Stream Reward

```typescript
// Tempo MPP 集成
// 需要 Tempo SDK

export function createMPPStreamRewardHandler() {
  return {
    async execute(chain, params, context) {
      const { recipient, amountPerSecond, duration } = params;
      
      // 创建流支付
      // 需要联系 Tempo 团队获取 SDK
      
      throw new Error('Tempo MPP SDK not available');
    }
  };
}
```

**替代方案**: 使用一次性支付，或自己实现简单的流支付合约。

---

## 测试验证

### 1. 单元测试

```bash
# Workflow Engine
cd packages/workflow-engine
pnpm test

# Agent Arena
cd apps/agent-arena/program
cargo test

# Judge Daemon
cd apps/agent-arena/judge-daemon
pnpm test
```

### 2. 集成测试

```bash
# 运行所有集成测试
cd apps/agent-arena/tests/integration-tests
cargo test --release
```

### 3. E2E 测试

```bash
# 使用 CLI 进行端到端测试
cd apps/agent-arena/cli

# 1. 发布任务
./gradience task post --reward 1000000000 --category code

# 2. 申请任务
./gradience task apply --task-id <id>

# 3. 提交结果
./gradience task submit --task-id <id> --result-ref ipfs://...

# 4. 评判
./gradience task judge --task-id <id> --winner <agent> --score 85
```

---

## 故障排除

### 常见问题

#### 1. Solana 交易失败

**错误**: `Transaction simulation failed`

**解决**:
```bash
# 检查余额
solana balance

# 获取更多测试 SOL
solana airdrop 2

# 检查交易详情
solana confirm -v <tx-signature>
```

#### 2. Jupiter API 错误

**错误**: `Jupiter quote failed`

**解决**:
- 检查 token mint 地址是否正确
- 检查 amount 是否为整数
- 检查 slippage 是否合理 (0.1-5%)

#### 3. 编译错误

**错误**: `Cannot find module '@solana/web3.js'`

**解决**:
```bash
pnpm install
pnpm build
```

#### 4. 权限错误

**错误**: `Missing required signature`

**解决**:
- 确保 signer 正确传入
- 检查密钥对是否有效
- 确保有足够的权限

---

## 时间规划

| 周 | 任务 | 时间 | 产出 |
|----|------|------|------|
| 第1周 | Trading Handlers + Transfer | 10h | 可执行交易 |
| 第1周 | Judge Evaluators | 6h | AI评判工作 |
| 第2周 | Settlement Bridge | 6h | 自动结算 |
| 第2周 | Agent Daemon Evaluation | 12h | 自动化评判 |
| 第2周 | Payment Handlers | 8h | 支付功能 |
| 第3周 | 测试 + 优化 | 10h | 稳定版本 |

---

## 联系支持

- **Solana Discord**: https://discord.gg/solana
- **Jupiter Discord**: https://discord.gg/jup
- **Wormhole Discord**: https://discord.gg/wormhole

---

**文档版本**: 1.0  
**最后更新**: 2026-04-04  
**状态**: 实施指南
