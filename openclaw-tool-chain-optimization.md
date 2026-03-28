# OpenClaw Runtime: Adaptive Tool Chain Optimization

> **Vision**: Per-user execution path optimization through AutoResearch
> **Goal**: Faster, more efficient LLM tool calls by learning user patterns
> **Mechanism**: Observe → Learn → Optimize → Cache execution paths
>
> **Date**: 2026-03-29

---

## 1. Core Concept: Why Optimize?

### The Problem

```
User: "查看我的钱包"

Naive Execution (Cold Path):
├── LLM: Understand intent (500ms)
├── Tool1: get_wallet_address() (200ms)
├── Tool2: fetch_balance() (300ms)  
├── Tool3: format_display() (100ms)
└── Total: 1.1 seconds

Problem:
- Same user asks this 5 times/day
- Every time: full LLM + 3 tools
- Wasteful, slow
```

### The Solution

```
Learned Execution (Hot Path):
├── Pattern Match: "钱包查询" pattern detected (10ms)
├── Cached: Pre-validated tool sequence
├── Parallel: fetch_balance() + get_recent_tx() simultaneously
└── Total: 200ms (5x faster)

Plus: Pre-fetch data before user asks
```

---

## 2. Architecture: Three-Layer Optimization

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER REQUEST                                    │
│              "查看我的钱包"                                          │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              LAYER 1: Pattern Recognition                           │
│                    (Fast Path Detection)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Query: "查看我的钱包"                                               │
│      ↓                                                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  User Habit Cache (Local, <1ms lookup)                      │    │
│  │                                                              │    │
│  │  Pattern: "查看.*钱包"  →  Confidence: 0.95                 │    │
│  │  Intent: WALLET_QUERY                                       │    │
│  │  Tools: [get_balance, get_transactions]                     │    │
│  │  Preload: [price_feed]  (user always checks price after)    │    │
│  │  Execute: PARALLEL                                          │    │
│  │                                                              │    │
│  │  [MATCH FOUND - Skip LLM reasoning]                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                              │                                       │
│              ┌───────────────┴───────────────┐                       │
│              │                               │                       │
│              ▼                               ▼                       │
│     [HOT PATH]                        [COLD PATH]                    │
│     Pattern match                     No pattern found               │
│     Skip LLM                          Full LLM reasoning             │
│     ~50ms                             ~1000ms                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              LAYER 2: Smart Execution                               │
│                   (Tool Orchestration)                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Hot Path:                                                           │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Optimized Tool Chain (Learned)                             │    │
│  │                                                              │    │
│  │  User Pattern: "After wallet check, 80% check token price" │    │
│  │  Action: Pre-fetch price while showing balance             │    │
│  │                                                              │    │
│  │  Parallel Execution:                                        │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │    │
│  │  │ get_balance  │  │ get_txs      │  │ get_price    │      │    │
│  │  │     ↓        │  │     ↓        │  │     ↓        │      │    │
│  │  │  [Display]   │  │  [Display]   │  │  [Cache]     │      │    │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │    │
│  │                                                              │    │
│  │  User asks: "ETH价格多少？"                                  │    │
│  │  Response: Instant (already cached)                         │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  Cold Path (Fallback):                                               │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Full LLM + Dynamic Tool Selection                          │    │
│  │  - Understand intent                                        │    │
│  │  - Select tools                                             │    │
│  │  - Execute sequentially (safe)                              │    │
│  │  - Record for learning                                      │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│              LAYER 3: AutoResearch Optimization                     │
│                 (Continuous Improvement)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Observation:                                                        │
│  ├── Tool call latency: [200ms, 300ms, 250ms, 280ms]               │
│  ├── User satisfaction: [4, 3, 4, 5] (ratings)                     │
│  ├── Follow-up queries: ["ETH价格", "交易历史", "转账"]              │
│  └── Cache hit rate: 60% → 85% (improving)                         │
│                                                                      │
│  AutoResearch Loop:                                                  │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Hypothesis: "Parallel tool calls reduce perceived latency"  │   │
│  │                                                              │   │
│  │  Experiment:                                                 │   │
│  │  - Control: Sequential execution (current)                   │   │
│  │  - Treatment: Parallel execution                             │   │
│  │                                                              │   │
│  │  Measure:                                                    │   │
│  │  - Time to first display                                     │   │
│  │  - User satisfaction rating                                  │   │
│  │  - Error rate                                                │   │
│  │                                                              │   │
│  │  Result: Parallel 40% faster, no error increase              │   │
│  │  Action: Update pattern to use parallel execution            │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. What Gets Optimized?

### 3.1 Tool Selection (What tools to call)

```python
# Before Learning (LLM decides each time)
user: "查看钱包"
llm: "I need to call get_wallet_info()"
→ Tool call (500ms reasoning + 200ms execution)

# After Learning (Pattern cache)
user: "查看钱包"
pattern_cache: WALLET_QUERY = [get_balance, get_transactions]
→ Direct tool calls (10ms lookup + 200ms execution)

Optimization: Skip LLM reasoning for known patterns
```

### 3.2 Tool Ordering (Sequence optimization)

```python
# Before: Sequential (safe but slow)
tools.execute([
    get_balance,      # 200ms
    get_transactions, # 300ms (depends on balance?)
    get_price         # 150ms
])
# Total: 650ms

# After: Parallel where possible
if pattern.independent_tools:
    asyncio.gather(
        get_balance(),      # 200ms
        get_transactions(), # 300ms
        get_price()         # 150ms
    )
# Total: 300ms (limited by slowest)

Optimization: Identify independent operations
```

### 3.3 Data Pre-fetching (Predictive loading)

```python
# Learned pattern: "After wallet check, 80% check price"
pattern: {
    "trigger": "wallet_query",
    "preload": ["eth_price", "gas_fee"],
    "confidence": 0.80
}

# Execution:
user: "查看钱包"
system: 
    show_balance()      # Immediate
    background_fetch(eth_price, gas_fee)  # Preload

user: "ETH价格多少？"
system: 
    show_cached_price()  # Instant!

Optimization: Hide latency by predicting next request
```

### 3.4 Context Window Optimization (What to pass)

```python
# Before: Full context every time
llm.call(
    context=full_conversation_history,  # 4000 tokens
    tools=all_available_tools           # 50 tools
)

# After: Minimal context for known patterns
if pattern.cached:
    execute(
        context=minimal_required_context,  # 100 tokens
        tools=predicted_tools_only         # 2-3 tools
    )

Optimization: Reduce token usage and latency
```

---

## 4. User Habit Model (What Gets Learned)

```yaml
# user_execution_patterns.yaml
# Stored per-user in OpenClaw runtime

user_id: "user_luncy"
learned_patterns:

  # Pattern 1: Wallet queries
  - pattern_id: "wallet_query_v3"
    trigger:
      keywords: ["钱包", "balance", "查看", "多少"]
      intent_vector: [0.9, 0.1, 0.0]  # WALLET, TRADE, INFO
    
    execution_plan:
      primary_tools: ["get_balance", "get_recent_transactions"]
      preload_tools: ["get_eth_price", "get_gas_fee"]
      execution_mode: "parallel"
      context_window: "minimal"  # Only pass wallet address
    
    performance:
      avg_latency_ms: 180
      user_satisfaction: 4.8
      cache_hit_rate: 0.92
      last_optimized: "2026-03-29"
    
    optimization_history:
      - date: "2026-03-25"
        change: "switched from sequential to parallel"
        improvement: "40% faster"
        experiment_id: "exp_parallel_001"

  # Pattern 2: Task creation
  - pattern_id: "create_task_v2"
    trigger:
      keywords: ["创建", "任务", "提醒", "todo"]
      intent_vector: [0.0, 0.0, 0.95]  # TASK
    
    execution_plan:
      primary_tools: ["create_task", "estimate_time"]
      auto_expand: true  # User always wants subtask breakdown
      default_project: "gradience"  # Most tasks are for this project
    
    learned_defaults:
      - "solidity" → project: "gradience", priority: "high"
      - "meeting" → duration: "30min", type: "communication"

  # Pattern 3: Trading (if applicable)
  - pattern_id: "quick_trade_v1"
    trigger:
      keywords: ["买", "卖", "swap", "trade"]
    
    execution_plan:
      safety_checks: ["confirm_amount", "check_slippage"]
      require_confirmation: true  # Never auto-execute trades
      preload: ["current_price", "gas_estimate"]

# Meta-patterns (patterns about patterns)
meta_patterns:
  time_based:
    "09:00": high_energy_tasks    # Coding, complex analysis
    "15:00": admin_tasks           # Email, scheduling
    "22:00": learning_tasks        # Reading, research
  
  context_switching:
    after_meeting: "need_5min_break"  # User needs transition time
    deep_work_block: "no_interruptions"  # Batch notifications
```

---

## 5. AutoResearch Optimization Loop

### What Gets Measured?

```python
class ExecutionMetrics:
    """Metrics collected for every tool call"""
    
    # Performance
    latency_ms: int              # Time to complete
    time_to_first_byte_ms: int   # Time to first display
    token_usage: int             # LLM tokens consumed
    
    # Quality
    user_satisfaction: int       # 1-5 rating (explicit or implicit)
    error_rate: float            # % of failed calls
    retry_count: int             # How many retries needed
    
    # Usage patterns
    follow_up_queries: List[str] # What user asks next
    cache_hit: bool              # Was pattern cache used?
    pattern_confidence: float    # How sure were we?
```

### Optimization Experiments

```python
class ToolChainOptimizer:
    """AutoResearch for tool execution"""
    
    def generate_hypothesis(self, pattern: UserPattern) -> Hypothesis:
        """LLM generates optimization ideas based on metrics"""
        
        prompt = f"""
        Pattern: {pattern.name}
        Current performance: {pattern.metrics}
        Tool chain: {pattern.tools}
        
        Metrics show:
        - Latency: {pattern.metrics.latency_ms}ms
        - User satisfaction: {pattern.metrics.satisfaction}
        - Follow-up queries: {pattern.metrics.follow_ups}
        
        What optimization should we test?
        Consider:
        1. Parallel vs sequential execution
        2. Data pre-fetching
        3. Context reduction
        4. Tool consolidation
        
        Generate 3 testable hypotheses.
        """
        
        return self.llm.generate(prompt)
    
    def run_experiment(self, hypothesis: Hypothesis) -> Results:
        """A/B test the optimization"""
        
        # 50/50 split for 100 interactions
        for interaction in range(100):
            user = get_next_user()
            
            if random() < 0.5:
                # Control: Current implementation
                result = execute_control(pattern)
            else:
                # Treatment: New optimization
                result = execute_treatment(pattern, hypothesis)
            
            record_result(result)
        
        return analyze_results()
    
    def update_pattern(self, pattern: UserPattern, results: Results):
        """Apply winning optimization"""
        
        if results.treatment_better:
            pattern.apply_optimization(results.hypothesis)
            pattern.optimization_history.append({
                "date": now(),
                "hypothesis": results.hypothesis,
                "improvement": results.improvement_percent
            })
        else:
            pattern.mark_failed(results.hypothesis)
```

---

## 6. Example: Complete Learning Flow

### Day 1: Cold Start

```
User: "查看钱包"

System (No pattern):
├── LLM understands intent (500ms)
├── Tool: get_balance() (200ms)
├── Tool: get_transactions() (300ms)
└── Response (1000ms total)

User: "ETH价格多少？"

System:
├── LLM understands (500ms)
├── Tool: get_price() (150ms)
└── Response (650ms total)

[Recorded: Two separate queries, sequential]
```

### Day 7: Pattern Detected

```
System Observation:
- User asks "钱包" → then "价格" 8 times this week
- Pattern confidence: 0.85

AutoResearch Hypothesis:
"Pre-fetch price when user checks wallet"

Experiment:
- Control group: 50 users (no preload)
- Treatment group: 50 users (preload price)

Results after 1 week:
- Treatment: 95% cache hit, satisfaction 4.7
- Control: 60% cache hit, satisfaction 4.2

Decision: Apply optimization
```

### Day 14: Optimized Execution

```
User: "查看钱包"

System (Hot path):
├── Pattern match: "wallet_query" (10ms)
├── Parallel execution:
│   ├── get_balance() → display
│   ├── get_transactions() → display
│   └── get_price() → cache (preload)
└── Response (200ms total)

User: "ETH价格多少？"

System:
├── Cache hit! (1ms)
└── Instant response

[User satisfied, pattern reinforced]
```

### Day 30: Further Optimization

```
AutoResearch Hypothesis:
"Can we predict which token user will ask about?"

Analysis:
- User holds: ETH, SOL, OKB
- 80% of price queries are for largest holding
- 15% for recently traded tokens

Optimization:
Preload price for top 3 holdings

Result: Cache hit rate 95% → 98%
```

---

## 7. Integration with OpenClaw

### Architecture

```
OpenClaw Runtime
├── Core (Message handling, routing)
├── Memory (AgentSoul.md)
├── Skills (Chain Hub)
└── NEW: Execution Optimizer (This system)
    ├── Pattern Cache (per-user, local)
    ├── Metrics Collector
    └── AutoResearch Engine
```

### Code Integration

```typescript
// OpenClaw message handler
class OptimizedAgentRuntime {
  private patternCache: UserPatternCache;
  private metrics: MetricsCollector;
  private optimizer: AutoResearchOptimizer;

  async handleUserMessage(message: string, userId: string) {
    // 1. Check for learned patterns
    const pattern = await this.patternCache.match(message, userId);
    
    if (pattern && pattern.confidence > 0.8) {
      // HOT PATH: Use optimized execution
      return this.executeOptimized(pattern, userId);
    }
    
    // COLD PATH: Full LLM reasoning
    const result = await this.executeWithLLM(message, userId);
    
    // Record for learning
    await this.metrics.record({
      userId,
      message,
      tools_used: result.tools,
      latency: result.latency,
      pattern_matched: false
    });
    
    // Trigger learning if no pattern found
    if (this.shouldLearnPattern(userId, message)) {
      await this.optimizer.analyzeAndOptimize(userId);
    }
    
    return result;
  }

  async executeOptimized(pattern: UserPattern, userId: string) {
    // Execute learned tool chain
    const results = await Promise.all(
      pattern.tools.map(tool => this.executeTool(tool, userId))
    );
    
    // Preload predicted next tools
    if (pattern.preloadTools) {
      this.preloadInBackground(pattern.preloadTools, userId);
    }
    
    return this.formatResponse(results, pattern.responseTemplate);
  }
}
```

---

## 8. Benefits Summary

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Response time** | 1000ms | 200ms | **5x faster** |
| **Token usage** | 4000 | 100 | **40x less** |
| **User satisfaction** | 4.2 | 4.8 | **+14%** |
| **Cache hit rate** | 0% | 90%+ | **Always fast** |

---

## 9. Key Insights

### What Makes This Work

1. **Per-user optimization**: Everyone has different patterns
2. **AutoResearch loop**: Continuous improvement without manual tuning
3. **Hot/cold path**: Fast path for common queries, full LLM for novel ones
4. **Pre-fetching**: Hide latency by predicting next request
5. **Metrics-driven**: Measure everything, optimize based on data

### What's Optimized

1. **Tool selection**: Skip LLM for known patterns
2. **Tool ordering**: Parallel vs sequential
3. **Data pre-loading**: Predictive fetching
4. **Context size**: Minimal tokens for known paths
5. **Response format**: Learned user preferences

---

## 10. Summary

**System Architecture**:

```
User Request
    ↓
Pattern Cache Match? 
    ↓ YES → Optimized Tool Chain (Fast)
    ↓ NO  → LLM Reasoning + Tool Calls (Slow)
    ↓
Execute + Record Metrics
    ↓
AutoResearch Analyzes
    ↓
Generate Optimization Hypothesis
    ↓
A/B Test → Apply Winners
    ↓
Update Pattern Cache
```

**Result**: Each user gets a personalized, continuously optimized AI assistant that gets faster and more accurate over time.

❤️‍🔥