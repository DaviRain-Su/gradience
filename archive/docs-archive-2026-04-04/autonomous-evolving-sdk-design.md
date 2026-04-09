# 自主进化 SDK 设计：Vercel Agent-First + Karpathy Autoresearch

> **文档类型**: 技术架构设计  
> **日期**: 2026-04-03  
> **核心理念**: SDK 不再是静态工具包，而是会自我进化的有机体  
> **理论基础**: Vercel Agent-First (Know/See/Control) + Karpathy Autoresearch (自主实验闭环)

---

## 执行摘要

### 核心洞察

**传统 SDK**:

```
开发者使用 SDK → 发现问题 → 提 Issue → 维护者修复 → 发布新版本
                    ↑___________________________________________↓
                                    (数月周期)
```

**自主进化 SDK**:

```
Agent 24/7 运行 → 感知问题 → 自动实验 → 验证改进 → 提交 PR
      ↑____________________________________________________↓
                        ( overnight 数百轮)
```

### 理论互补性

| 理论                      | 解决问题                     | 提供能力             |
| ------------------------- | ---------------------------- | -------------------- |
| **Vercel Agent-First**    | Agent 如何理解/感知/操控系统 | Know + See + Control |
| **Karpathy Autoresearch** | Agent 如何持续自我改进       | 实验沙箱 + 评估闭环  |

**叠加效果**:

```
Vercel (操作系统能力) + Autoresearch (进化算法) = 自主进化 SDK
```

---

## 1. 三层架构设计

### 1.1 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│  Layer 3: 进化目标层 (Evolution Goals)                         │
│  ├── program.md — 人类定义的进化目标                            │
│  ├── constraints.md — 不可变约束                                │
│  └── evaluator.py — 客观评估脚本                                │
└──────────────────────┬──────────────────────────────────────────┘
                       │ 读取
┌──────────────────────▼──────────────────────────────────────────┐
│  Layer 2: Agent 进化引擎 (Vercel + Autoresearch)               │
│  ├── Know: 嵌入 SDK 知识                                        │
│  ├── See: 感知运行时信号                                        │
│  └── Control: 执行实验循环                                      │
└──────────────────────┬──────────────────────────────────────────┘
                       │ 修改/测试
┌──────────────────────▼──────────────────────────────────────────┐
│  Layer 1: SDK 本体 (可进化部分)                                │
│  ├── core/ — 核心逻辑 (Agent 可编辑)                           │
│  ├── tests/ — 测试套件 (只读)                                  │
│  └── benchmarks/ — 性能基准 (只读)                             │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Vercel 三层能力映射

```typescript
// sdk.agent.ts — Agent 能力接口

class AutonomousSDK {
    // ========== Know: 知识嵌入 ==========
    knowledge: {
        // SDK 官方文档 (打包在 node_modules)
        docs: EmbeddedDocs;

        // API Schema (TypeScript 定义)
        schema: APISchema;

        // 最佳实践
        bestPractices: BestPractice[];

        // 版本历史
        changelog: Changelog;
    };

    // ========== See: 感知系统 ==========
    observe(): {
        // 构建指标
        buildMetrics: () => BuildMetrics;

        // 运行时信号
        runtimeSignals: () => RuntimeSignals;

        // 测试覆盖
        testCoverage: () => TestCoverage;

        // 兼容性矩阵
        compatibilityMatrix: () => CompatibilityMatrix;

        // 用户遥测 (opt-in)
        telemetry: () => TelemetryData;
    };

    // ========== Control: 执行控制 ==========
    control: {
        // 构建
        build: (options?: BuildOptions) => Promise<BuildResult>;

        // 测试
        test: (scope?: TestScope) => Promise<TestResult>;

        // 基准测试
        benchmark: (suite?: BenchmarkSuite) => Promise<BenchmarkResult>;

        // 版本切换
        switchNodeVersion: (version: string) => Promise<void>;

        // 发布
        publish: (version: string) => Promise<PublishResult>;
    };

    // ========== Autoresearch: 进化循环 ==========
    async evolve(config: EvolutionConfig): Promise<EvolutionResult> {
        while (true) {
            // 1. 读取目标
            const goal = await this.readProgramMd();

            // 2. 感知现状
            const state = await this.observeCurrentState();

            // 3. 生成假设
            const hypothesis = await this.generateHypothesis(goal, state);

            // 4. 执行修改 (仅 core/)
            await this.applyChange(hypothesis);

            // 5. 运行评估
            const score = await this.runEvaluator();

            // 6. 决策
            if (score > baseline) {
                await this.commitChange(hypothesis, score);
                baseline = score;
            } else {
                await this.revertChange();
            }

            // 7. 检查终止条件
            if (this.shouldStop(config)) break;
        }
    }
}
```

---

## 2. 核心组件详解

### 2.1 Know: 知识嵌入层

```typescript
// .agent-knowledge/ — 打包在 SDK 内的知识库

interface EmbeddedKnowledge {
    // SDK 文档 (压缩后嵌入)
    docs: {
        'api-reference.json': APIDoc;
        'best-practices.md': string;
        'migration-guide.md': string;
        'examples/': CodeExample[];
    };

    // 实时生成的知识
    generated: {
        'current-schema.ts': TypeScriptSchema; // 从源码生成
        'error-patterns.json': ErrorPattern[]; // 从 telemetry 学习
        'optimization-tips.md': string; // 从 benchmark 学习
    };

    // 版本信息
    version: {
        sdk: string;
        node: string;
        lastUpdated: number;
    };
}

// Agent 启动时强制加载
class KnowledgeLoader {
    async load(): Promise<EmbeddedKnowledge> {
        // 1. 读取打包知识
        const builtin = await import('./.agent-knowledge/builtin.json');

        // 2. 读取生成知识
        const generated = await import('./.agent-knowledge/generated.json');

        // 3. 验证版本匹配
        if (builtin.version.sdk !== this.currentSDKVersion) {
            throw new Error('Knowledge version mismatch');
        }

        return { ...builtin, ...generated };
    }

    // Agent 提示词约束
    getSystemPrompt(): string {
        return `
      You are the autonomous evolution engine for ${SDK_NAME}.
      
      CRITICAL CONSTRAINTS:
      1. You MUST use APIs defined in ${this.knowledge.docs['api-reference.json']}
      2. You MUST follow patterns in ${this.knowledge.docs['best-practices.md']}
      3. You MUST NOT use deprecated APIs (listed in migration-guide)
      4. You MUST verify changes with evaluator.py before committing
      
      Your goal: ${this.readProgramMd()}
    `;
    }
}
```

### 2.2 See: 感知层

```typescript
// observe.ts — 系统感知接口

interface SDKObserver {
    // 构建指标
    buildMetrics(): Promise<{
        duration: number;
        bundleSize: number;
        treeShakingRatio: number;
        chunkCount: number;
        cacheHitRate: number;
    }>;

    // 运行时信号
    runtimeSignals(): Promise<{
        errorRate: number;
        errorTypes: Record<string, number>;
        callStackPatterns: string[];
        memoryUsage: number;
        cpuUsage: number;
    }>;

    // 测试覆盖
    testCoverage(): Promise<{
        overall: number;
        byModule: Record<string, number>;
        uncoveredLines: string[];
    }>;

    // 兼容性矩阵
    compatibilityMatrix(): Promise<{
        nodeVersions: string[];
        results: Record<
            string,
            {
                compatible: boolean;
                testPassRate: number;
                performance: number;
            }
        >;
    }>;

    // 用户遥测 (opt-in)
    telemetry(): Promise<{
        mostUsedAPIs: string[];
        commonPatterns: string[];
        painPoints: string[];
        featureRequests: string[];
    }>;
}

// MCP 风格接口
class MCPObserver implements SDKObserver {
    private mcp: MCPClient;

    async buildMetrics(): Promise<BuildMetrics> {
        return this.mcp.call('sdk/buildMetrics');
    }

    async runtimeSignals(): Promise<RuntimeSignals> {
        return this.mcp.call('sdk/runtimeSignals');
    }

    // ... 其他方法
}
```

### 2.3 Control: 控制层

```typescript
// control.ts — 执行控制

interface SDKController {
    // 构建
    build(options?: { target?: 'esm' | 'cjs' | 'umd'; minify?: boolean; sourcemap?: boolean }): Promise<{
        success: boolean;
        outputs: string[];
        metrics: BuildMetrics;
    }>;

    // 测试
    test(scope?: { files?: string[]; match?: string; nodeVersion?: string }): Promise<{
        passed: number;
        failed: number;
        duration: number;
        coverage: TestCoverage;
    }>;

    // 基准测试
    benchmark(suite?: string): Promise<{
        results: BenchmarkResult[];
        comparedToBaseline: number;
    }>;

    // 环境切换
    switchNodeVersion(version: string): Promise<void>;

    // Git 操作
    commit(message: string): Promise<string>;
    revert(): Promise<void>;
    diff(): Promise<string>;
}

// Pull-based 执行 (Turbopack 风格)
class PullBasedController implements SDKController {
    private taskQueue: TaskQueue;

    async build(options?: BuildOptions): Promise<BuildResult> {
        // Agent 决定何时构建，而非 watch 触发
        const task = this.taskQueue.create({
            type: 'build',
            priority: options?.priority || 'normal',
            dependencies: options?.dependencies,
        });

        return task.execute();
    }

    // Agent 可以批量执行
    async runBatch(tasks: Task[]): Promise<BatchResult> {
        return Promise.all(tasks.map((t) => t.execute()));
    }
}
```

### 2.4 Autoresearch: 进化循环

```typescript
// evolve.ts — 核心进化循环

class EvolutionEngine {
    private sdk: AutonomousSDK;
    private config: EvolutionConfig;

    async run(): Promise<EvolutionResult> {
        const results: ExperimentResult[] = [];
        let baseline = await this.getBaselineScore();

        while (!this.shouldStop()) {
            const iteration = results.length + 1;
            console.log(`\n=== Evolution Iteration ${iteration} ===`);

            try {
                // 1. 读取进化目标
                const goal = await this.readProgramMd();
                console.log(`Goal: ${goal.description}`);

                // 2. 感知当前状态
                const state = await this.sdk.observe();
                console.log(`Current state: ${JSON.stringify(state, null, 2)}`);

                // 3. 生成改进假设
                const hypothesis = await this.generateHypothesis(goal, state);
                console.log(`Hypothesis: ${hypothesis.description}`);

                // 4. 应用修改 (仅 core/ 目录)
                await this.applyChange(hypothesis);
                console.log('Change applied');

                // 5. 运行完整评估
                const score = await this.runFullEvaluation();
                console.log(`Score: ${score} (baseline: ${baseline})`);

                // 6. 决策
                if (score > baseline) {
                    // 改进成功
                    const commitHash = await this.commitChange(hypothesis, score);
                    baseline = score;
                    results.push({
                        iteration,
                        hypothesis,
                        score,
                        commitHash,
                        status: 'success',
                    });
                    console.log(`✅ Committed: ${commitHash}`);
                } else {
                    // 改进失败，回滚
                    await this.revertChange();
                    results.push({
                        iteration,
                        hypothesis,
                        score,
                        status: 'reverted',
                    });
                    console.log('❌ Reverted');
                }
            } catch (error) {
                // 实验出错，回滚
                await this.revertChange();
                results.push({
                    iteration,
                    error: error.message,
                    status: 'error',
                });
                console.log(`💥 Error: ${error.message}`);
            }

            // 保存进度
            await this.saveProgress(results);
        }

        // 生成最终报告
        return this.generateReport(results);
    }

    private async runFullEvaluation(): Promise<number> {
        // 构建
        const build = await this.sdk.control.build();
        if (!build.success) return 0;

        // 测试
        const test = await this.sdk.control.test();
        if (test.failed > 0) return 0;

        // 基准测试
        const benchmark = await this.sdk.control.benchmark();

        // 运行 evaluator (不可修改)
        return this.runEvaluatorScript({
            build: build.metrics,
            test: test.coverage,
            benchmark: benchmark.results,
        });
    }

    private async runEvaluatorScript(data: EvaluatorInput): Promise<number> {
        // evaluator.py 是神圣的，Agent 不能修改
        const { stdout } = await exec('python evaluator.py', {
            input: JSON.stringify(data),
        });
        return parseFloat(stdout);
    }
}
```

---

## 3. 文件结构

### 3.1 最小可行原型 (MVP)

```
autonomous-sdk/
├── .agent-knowledge/          # 嵌入知识 (Know)
│   ├── builtin/
│   │   ├── api-reference.json
│   │   ├── best-practices.md
│   │   └── examples/
│   └── generated/
│       ├── current-schema.ts
│       └── error-patterns.json
│
├── core/                      # 可进化部分 ⚠️ Agent 只能改这里
│   ├── index.ts
│   ├── optimizer.ts
│   └── utils.ts
│
├── tests/                     # 只读
│   ├── unit/
│   └── integration/
│
├── benchmarks/                # 只读
│   └── performance.suite.ts
│
├── .agent/                    # Agent 运行时
│   ├── knowledge-loader.ts
│   ├── observer.ts
│   ├── controller.ts
│   └── evolution-engine.ts
│
├── evaluator.py               # 神圣不可修改
├── program.md                 # 进化目标
├── constraints.md             # 不可变约束
└── evolve.ts                  # 入口
```

### 3.2 program.md 模板

```markdown
# Evolution Program

## Goal

Reduce bundle size by 15% while maintaining 100% test pass rate
and Node 18+ compatibility.

## Constraints (Hard)

- MUST NOT break public API
- MUST maintain backward compatibility
- Test coverage MUST NOT drop below 90%
- MUST support Node 18, 20, 22

## Metrics (Evaluator Formula)
```

score = (size*reduction * 10) +
(test*pass_rate * 100) +
(coverage _ 50) +
(benchmark_speedup _ 20)

```

## Allowed Modifications
- `core/optimizer.ts` — tree-shaking logic
- `core/utils.ts` — helper functions
- `core/index.ts` — exports (if needed)

## Forbidden
- `tests/` — tests must pass, not be modified
- `benchmarks/` — baseline for measurement
- `evaluator.py` — sacred

## Success Criteria
- score > current_baseline
- All tests pass
- No breaking changes
```

### 3.3 evaluator.py 模板

```python
#!/usr/bin/env python3
# evaluator.py — SACRED: Agent cannot modify this file

import json
import sys

def evaluate(data):
    """
    Calculate evolution score based on metrics.
    Higher is better.
    """
    build = data['build']
    test = data['test']
    benchmark = data['benchmark']

    # Bundle size reduction (lower is better)
    baseline_size = 100000  # bytes
    size_score = (baseline_size - build['bundleSize']) / baseline_size * 1000

    # Test pass rate (higher is better)
    test_score = test['overall'] * 100

    # Coverage (higher is better)
    coverage_score = test['coverage']['overall'] * 50

    # Benchmark speedup (higher is better)
    speedup = benchmark.get('speedup', 1.0)
    speed_score = (speedup - 1) * 200

    # Penalties
    penalty = 0
    if test['failed'] > 0:
        penalty += 10000  # Heavy penalty for failing tests

    if build['bundleSize'] > baseline_size:
        penalty += 5000   # Penalty for size increase

    total = size_score + test_score + coverage_score + speed_score - penalty
    return max(0, total)

if __name__ == '__main__':
    data = json.loads(sys.stdin.read())
    score = evaluate(data)
    print(score)
```

---

## 4. 使用场景

### 4.1 场景 1: 自动性能优化

```typescript
// 启动进化
const sdk = new AutonomousSDK();

await sdk.evolve({
    goal: 'optimize-bundle-size',
    maxIterations: 100,
    timeout: '8h',
});

// 次日早晨检查结果
// → 发现 5 个成功 commit
// → bundle size 减少 18%
// → 所有测试通过
// → 自动生成 PR
```

### 4.2 场景 2: 自动适配新环境

```typescript
// Node 24 发布后立即验证
await sdk.evolve({
    goal: 'verify-node-24-compatibility',
    constraints: {
        nodeVersions: ['18', '20', '22', '24'],
    },
});

// Agent 自动:
// 1. 切换 Node 版本
// 2. 运行测试
// 3. 修复不兼容代码
// 4. 提交 PR
```

### 4.3 场景 3: 新特性自发现

```typescript
// 基于用户遥测自动抽象新 API
const telemetry = await sdk.observe().telemetry();

if (telemetry.commonPatterns.includes('custom-validation')) {
    await sdk.evolve({
        goal: 'abstract-validation-pattern-into-api',
        constraints: {
            mustFollowExistingPatterns: true,
        },
    });
}

// Agent 自动:
// 1. 分析常见 pattern
// 2. 抽象成新 API
// 3. 写测试和文档
// 4. 提交 PR
```

---

## 5. 安全与可控机制

### 5.1 沙箱执行

```typescript
interface SandboxConfig {
    // 文件系统
    readonlyPaths: string[]; // 不可修改
    writablePaths: string[]; // 可修改 (仅 core/)

    // 网络
    network: 'none' | 'restricted' | 'full';
    allowedHosts?: string[];

    // 资源
    maxMemory: string; // '2gb'
    maxCpu: string; // '2 cores'
    timeout: string; // '10m'

    // 监控
    auditLog: boolean;
}

class SandboxedEvolution {
    async runInSandbox(config: SandboxConfig): Promise<void> {
        const container = await docker.create({
            image: 'autonomous-sdk-sandbox',
            binds: [
                { host: './tests', container: '/sdk/tests', mode: 'ro' },
                { host: './core', container: '/sdk/core', mode: 'rw' },
            ],
            network: 'none',
            resources: {
                memory: config.maxMemory,
                cpus: config.maxCpu,
            },
        });

        return container.run('npm run evolve');
    }
}
```

### 5.2 人工审核流程

```
Agent 进化循环
    ↓
生成候选改进
    ↓
人类审核 Queue
    ↓
通过? → 合并到 main
拒绝? → Agent 学习, 下一轮
```

### 5.3 紧急停止

```typescript
class EmergencyStop {
    private stopped = false;

    // 人类可以随时停止
    stop() {
        this.stopped = true;
        this.killAllProcesses();
        this.revertAllChanges();
    }

    // 自动检测异常
    checkSafety(metrics: Metrics): boolean {
        if (metrics.errorRate > 0.1) return false;
        if (metrics.bundleSize > baseline * 2) return false;
        if (metrics.testPassRate < 0.9) return false;
        return true;
    }
}
```

---

## 6. 与现有工具集成

### 6.1 与 Vercel AI SDK 集成

```typescript
// 使用 Vercel AI SDK 作为 Agent 基础
import { generateText } from 'ai';

class VercelAIBasedEngine {
    async generateHypothesis(goal: Goal, state: State): Promise<Hypothesis> {
        const { text } = await generateText({
            model: 'claude-3-5-sonnet',
            system: this.knowledge.getSystemPrompt(),
            prompt: `
        Current state: ${JSON.stringify(state)}
        Goal: ${goal.description}
        
        Generate a hypothesis for improvement.
        Only suggest changes to allowed files.
      `,
        });

        return this.parseHypothesis(text);
    }
}
```

### 6.2 与 GitHub Actions 集成

```yaml
# .github/workflows/evolve.yml
name: Autonomous Evolution

on:
    schedule:
        - cron: '0 0 * * *' # 每天午夜运行

jobs:
    evolve:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4

            - name: Setup Node
              uses: actions/setup-node@v4
              with:
                  node-version: '22'

            - name: Run Evolution
              run: npx autonomous-sdk evolve --max-iterations=100

            - name: Create PR
              uses: peter-evans/create-pull-request@v5
              with:
                  title: 'Auto-evolution: ${{ steps.evolve.outputs.summary }}'
                  body: |
                      This PR was automatically generated by the evolution engine.

                      Changes: ${{ steps.evolve.outputs.changes }}
                      Score improvement: ${{ steps.evolve.outputs.score_delta }}
```

---

## 7. 结论

### 核心公式

```
自主进化 SDK =
    Vercel Agent-First (Know/See/Control)
    + Karpathy Autoresearch (实验闭环)
    + 严格安全边界 (Sandbox + Human Review)
```

### 价值主张

| 传统 SDK       | 自主进化 SDK  |
| -------------- | ------------- |
| 被动等待 Issue | 主动发现问题  |
| 月级迭代周期   | 日级/夜级迭代 |
| 人工优化       | 24/7 自动优化 |
| 静态文档       | 动态知识嵌入  |

### 下一步行动

| 优先级 | 行动                   | 时间 |
| ------ | ---------------------- | ---- |
| P0     | 实现 Knowledge 嵌入层  | 1 周 |
| P0     | 实现 Observer 感知层   | 1 周 |
| P1     | 实现 Controller 控制层 | 1 周 |
| P1     | 实现 Evolution 循环    | 2 周 |
| P2     | 集成 Vercel AI SDK     | 1 周 |
| P2     | GitHub Actions 自动化  | 1 周 |

### 一句话总结

> **"SDK 不再是工具，而是会自己研发自己的工程师。"**

---

_最后更新: 2026-04-03_  
_状态: 概念验证完成，等待 MVP 开发_
