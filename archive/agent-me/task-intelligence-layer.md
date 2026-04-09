# Gradience Architecture: Task Intelligence Layer

> **Core Insight**: Task management layer != Skills management
> **New Design**: User-specific task intelligence with AutoResearch feedback loop
> **Date**: 2026-03-29

---

## 1. Architecture Clarification

### Your Question

> "任务管理层就是skills工具的管理呢？"

**Answer**: No, they are different layers.

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER INTERFACE LAYER                             │
│  (Chat, Voice, Dashboard)                                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │              TASK INTELLIGENCE LAYER (NEW)                   │  │
│  │                                                               │  │
│  │  User-specific intelligence:                                  │  │
│  │  ├── Personal task patterns (how YOU work)                   │  │
│  │  ├── Energy rhythm (when YOU are productive)                 │  │
│  │  ├── Project contexts (what YOU care about)                  │  │
│  │  ├── Communication style (how YOU like to interact)          │  │
│  │  └── AutoResearch feedback (what works for YOU)              │  │
│  │                                                               │  │
│  │  NOT skills - this is about understanding the USER           │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                  AGENT RUNTIME LAYER                          │  │
│  │                                                               │  │
│  │  OpenClaw provides:                                           │  │
│  │  ├── Memory (AgentSoul.md)                                    │  │
│  │  ├── Reasoning (Kimi/Claude)                                  │  │
│  │  └── Execution (Agent Loop)                                   │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │                   SKILL MARKETPLACE                           │  │
│  │                      (Chain Hub)                              │  │
│  │                                                               │  │
│  │  Skills are TOOLS that agents use:                            │  │
│  │  ├── "solidity-audit" skill                                   │  │
│  │  ├── "twitter-post" skill                                     │  │
│  │  ├── "research-report" skill                                  │  │
│  │  └── "deploy-contract" skill                                  │  │
│  │                                                               │  │
│  │  Skills are SHARED across all users                           │  │
│  │  (like apps in an app store)                                  │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Distinction

| Layer                 | Scope         | Example                          |
| --------------------- | ------------- | -------------------------------- |
| **Task Intelligence** | User-specific | "You always do deep work at 9am" |
| **Agent Runtime**     | Universal     | "Process this request"           |
| **Skills**            | Shared tools  | "Audit Solidity code"            |

---

## 2. Task Intelligence Layer Design

### Core Concept

Each user gets a **Personal Task Intelligence Model** that learns:

```yaml
user_intelligence_model:
    # Learned from behavior
    work_patterns:
        deep_work_hours: [09:00, 10:00, 11:00] # Learned from calendar
        low_energy_hours: [14:00, 15:00] # Learned from task completion
        peak_creativity: 'evening' # Learned from output quality

    project_contexts:
        gradience:
            priority: 'high'
            related_tags: ['blockchain', 'AI', 'infrastructure']
            typical_tasks: ['coding', 'documentation', 'research']

        personal:
            priority: 'medium'
            related_tags: ['health', 'learning']
            typical_tasks: ['reading', 'exercise']

    communication_preferences:
        notification_style: 'concise' # vs "detailed"
        proactive_level: 'high' # vs "only when asked"
        voice_tone: 'casual' # vs "formal"
        reminder_frequency: 'daily_digest' # vs "real-time"

    task_patterns:
        auto_expansion: # When user says X, expand to Y
            - trigger: 'fix bug'
              expansion: ['find bug', 'analyze impact', 'implement fix', 'test', 'deploy']

            - trigger: 'research'
              expansion: ['search sources', 'synthesize findings', 'create summary', 'suggest actions']

        auto_categorization:
            - keyword: 'solidity'
              category: 'coding'
              project: 'gradience'
              energy: 'high'

            - keyword: 'meeting'
              category: 'communication'
              energy: 'low'
```

### How It Works

```
User: "帮我看看这个合约"
    ↓
Task Intelligence Layer:
├── Detect: "合约" → coding task
├── Context: User's gradience project
├── Pattern: User usually audits at 9am
├── Expansion: ["read contract", "find vulnerabilities", "generate report"]
├── Energy: High (matches user's deep work time)
└── Output: Structured task with YOUR preferences
    ↓
Agent Runtime (OpenClaw):
├── Load AgentSoul.md (personality)
├── Use Skills (Chain Hub: solidity-audit)
└── Execute task
    ↓
Feedback Loop (AutoResearch):
├── Did user complete at suggested time?
├── Was the expanded breakdown helpful?
├── Update user_intelligence_model
```

---

## 3. AutoResearch Feedback Loop for Task Management

### Your Insight: Correct!

> "借助autoresearch来自动优化会更好"

**Apply AutoResearch methodology to Task Intelligence:**

```
AutoResearch Loop for Task Management:

Hypothesis: "User works best on coding tasks at 9am"
    ↓
Experiment:
├── Schedule 10 coding tasks at 9am
├── Schedule 10 coding tasks at 3pm
├── Measure: completion rate, quality, user satisfaction
    ↓
Result:
├── 9am: 90% completion, high quality, +feedback
├── 3pm: 60% completion, bugs, -feedback
    ↓
Conclusion: "9am hypothesis confirmed"
    ↓
Update: task_intelligence_model.work_patterns.deep_work_hours
    ↓
Next Hypothesis: "User prefers 2-hour blocks vs 1-hour blocks"
    ↓
[Loop continues...]
```

### Feedback Metrics

```typescript
interface TaskFeedback {
  // Explicit feedback
  user_rating?: 1-5;           // "How well did this work?"
  user_comment?: string;       // "Too many subtasks"

  // Implicit feedback
  completion_time?: number;    // How long it actually took
  completion_quality?: number; // Measured by judge/reviewer
  rescheduled_count?: number;  // How many times user moved it

  // Behavioral signals
  time_to_start?: number;      // Delay before starting
  interruption_count?: number; // How many times interrupted
  context_switches?: number;   // Switched to other tasks?

  // Outcome
  successful_completion: boolean;
}

// AutoResearch uses this to optimize
function optimizeTaskIntelligence(feedback: TaskFeedback[]) {
  // Pattern detection
  const patterns = detectPatterns(feedback);

  // A/B test new suggestions
  const experiments = generateExperiments(patterns);

  // Update model
  updateIntelligenceModel(experiments);
}
```

---

## 4. Personalization Through Prompt Engineering

### Different Users = Different Personalities

```typescript
// Generate user-specific system prompt
function generateUserPrompt(userId: string): string {
  const intelligence = loadUserIntelligence(userId);

  return `
You are ${userName}'s personal agent assistant.

Based on their work patterns:
- Best deep work time: ${intelligence.deep_work_hours.join(', ')}
- Preferred communication: ${intelligence.communication_style}
- Current priorities: ${intelligence.active_projects.join(', ')}

Task handling rules:
${generateTaskRules(intelligence)}

When user says "fix bug", expand to:
${intelligence.task_patterns.auto_expansion['fix bug'].join(' → ')}

Never schedule meetings during: ${intelligence.focus_block_times.join(', ')}
Always provide: ${intelligence.required_outputs.join(', ')}
`;
}

// Example outputs for different users

// For "Luncy" (Founder mode):
"You are Luncy's agent. He is a technical founder working on Gradience.
- Deep work: 9am-12am (coding, architecture)
- Quick responses preferred, bulleted lists
- Expand all technical tasks with full context
- Auto-delegate research to agents when possible"

// For "Busy Executive":
"You are Sarah's assistant. She is a product executive.
- Energy peaks: 10am-2pm (decisions, meetings)
- Concise summaries, no technical details
- Proactively suggest delegations
- Protect calendar blocks religiously"

// For "Grad Student":
"You are Alex's study partner. He is a PhD student.
- Focus time: evenings (reading, writing)
- Detailed explanations, source citations
- Break large tasks into daily chunks
- Track paper deadlines aggressively"
```

---

## 5. Implementation Architecture

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Task Intelligence Engine                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Input Processor                    Pattern Learner             │
│  ├── Natural language parser  ───→  ├── Work pattern detection  │
│  ├── Source aggregation              ├── Energy pattern analysis│
│  └── Context enrichment              └── Project association    │
│         │                                    │                  │
│         ↓                                    ↓                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              User Intelligence Model                     │   │
│  │  (SQLite/JSON per user, encrypted)                      │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│                            ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Task Expansion Engine                       │   │
│  │  ├── Pattern matching ("fix bug" → [...])               │   │
│  │  ├── Dependency analysis                                │   │
│  │  ├── Time estimation (learned per user)                 │   │
│  │  └── Smart scheduling (energy + priority)               │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│                            ↓                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              AutoResearch Optimizer                      │   │
│  │  ├── A/B test scheduling strategies                     │   │
│  │  ├── Measure outcomes                                   │   │
│  │  ├── Update model weights                               │   │
│  │  └── Generate new hypotheses                            │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│                            ↓                                    │
│  Output: Structured, personalized, optimized task              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ↓
                    ┌─────────────────┐
                    │   OpenClaw      │
                    │   (Execution)   │
                    └─────────────────┘
```

### Data Flow

```
User Input:
"帮我看看这个合约的漏洞"
    ↓
[Task Intelligence Layer]
    ↓
Step 1: Parse Intent
├── Action: "audit"
├── Target: "smart contract"
├── Context: Gradience project (learned)
└── Urgency: medium (no deadline mentioned)
    ↓
Step 2: Apply User Patterns
├── User's deep work time: 9am-11am
├── User's best tool: "solidity-audit-pro" skill
├── User's preference: Detailed report + summary
└── User's energy now: Low (based on time)
    ↓
Step 3: Expand Task
├── Subtask 1: Read contract structure (15min)
├── Subtask 2: Check for common vulnerabilities (30min)
├── Subtask 3: Analyze edge cases (30min)
├── Subtask 4: Generate report (15min)
└── Total: 90min, schedule for tomorrow 9am
    ↓
Step 4: Personalize Communication
"Found a contract to audit. I've broken it down into 4 steps
(90min total). Your energy is low now, so I scheduled it for
tomorrow 9am during your deep work block. Sound good?"
    ↓
[OpenClaw Execution]
├── Use "solidity-audit-pro" skill
├── Apply user's report template
└── Execute at scheduled time
    ↓
[AutoResearch Feedback]
├── Did user accept suggestion? ✓
├── Did user complete at 9am? ✓
├── Was 90min estimate accurate? (actual: 75min)
└── Update: User is faster at audits than average
```

---

## 6. Different from Skills

### Skills (Chain Hub)

```
Skills = Universal Capabilities
├── Anyone can use
├── Standardized interface
├── Learn once, use everywhere
└── Examples:
    ├── solidity-audit (通用合约审计)
    ├── twitter-post (通用发帖)
    └── deploy-contract (通用部署)
```

### Task Intelligence (Personal)

```
Task Intelligence = User-Specific Optimization
├── Learned from YOUR behavior
├── Adapts to YOUR patterns
├── Personalized to YOUR context
└── Examples:
    ├── "You prefer audits at 9am"
    ├── "You like detailed reports"
    ├── "You work best in 2h blocks"
    └── "You always forget to test after coding"
```

### Relationship

```
Task Intelligence decides:
├── WHAT to do (task selection)
├── WHEN to do it (scheduling)
├── HOW to break it down (expansion)
└── WHO should do it (delegation)

Skills decide:
└── HOW to execute (implementation)

Example:
Task Intelligence: "Audit this contract tomorrow 9am,
                    90min, use detailed template"
                    ↓
Skills (solidity-audit): [actual execution]
```

---

## 7. Summary

### Your Architecture Intuition: Correct

```
┌─────────────────────────────────────────┐
│  User Interface (Chat/Voice/App)        │
├─────────────────────────────────────────┤
│  Task Intelligence Layer (Personal)     │ ← NEW: User patterns + AutoResearch
│  ├── Work pattern learning              │
│  ├── Smart expansion                    │
│  └── AutoResearch optimization          │
├─────────────────────────────────────────┤
│  Agent Runtime (OpenClaw)               │ ← Personality + Memory
│  ├── AgentSoul.md                       │
│  └── Agent Loop                         │
├─────────────────────────────────────────┤
│  Skills (Chain Hub)                     │ ← Tools/Capabilities
│  └── Universal tools                    │
└─────────────────────────────────────────┘
```

### Three Layers, Three Optimizations

| Layer                 | Optimization Target | Method                     |
| --------------------- | ------------------- | -------------------------- |
| **Task Intelligence** | User productivity   | AutoResearch feedback loop |
| **Agent Runtime**     | Task completion     | Agent loop + reasoning     |
| **Skills**            | Execution quality   | Training + verification    |

**Yes, this is the right architecture.**

Task Intelligence ≠ Skills. It's the **personalization layer** that makes the same skills work differently for different users.

❤️‍🔥
