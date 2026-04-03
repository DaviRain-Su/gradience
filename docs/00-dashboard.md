# Gradience Project Dashboard

> Obsidian Vault Dashboard  
> Last Updated: 2026-04-03

---

## 📊 Project Statistics

```dataview
TABLE priority, status, project
FROM "tasks"
WHERE status != "done"
SORT priority ASC, file.name ASC
```

---

## 🔴 P0 - Critical (Do First)

```dataview
LIST
FROM "tasks"
WHERE priority = "P0" AND status != "done"
SORT file.name ASC
```

### Key Blockers
- [[GRA-64]] Chain Hub Indexer Profile API
- [[GRA-91]] Metaplex Agent Kit Research
- [[GRA-70]] EVM cancel_task

---

## 🟡 P1 - High Priority

```dataview
LIST
FROM "tasks"
WHERE priority = "P1" AND status = "todo"
LIMIT 10
```

---

## 🏆 Active Hackathons

### 💎 Metaplex Agents Track ($5,000)
- [[GRA-91]] Research Metaplex Agent Kit
- [[GRA-92]] Integrate Agent Kit
- [[GRA-93]] Register Agent on Solana
- [[GRA-94]] Launch Agent Token
- [[GRA-95]] Build A2A Interactions
- [[GRA-96]] Integrate Chain Hub Reputation ⭐
- [[GRA-97]] Create Demo
- [[GRA-98]] X Article & Submission

### 📊 GoldRush Agentic Track ($500)
- [[GRA-99]] Research GoldRush API
- [[GRA-100]] Wallet Risk Scoring
- [[GRA-104]] Counterparty Trust Score
- [[GRA-105]] Chain Hub Integration

---

## 📁 Quick Links

### Documentation
- [[01-prd]] Product Requirements
- [[02-architecture]] System Architecture
- [[03-technical-spec]] Technical Specification
- [[methodology/README|Development Methodology]]

### Project Analysis
- [[project-analysis-2026-04-03|Project Analysis]]
- [[project-progress-report-2026-04-03|Progress Report]]
- [[hackathon-comparison-2026-04-03|Hackathon Comparison]]
- [[execution-dashboard|Execution Dashboard]]

### Ideas
- [[idea-agent-social-domain-analysis|Agent Social + Web3 Domain]]
- [[obsidian-cli-integration-plan|Obsidian CLI Migration Plan]]

### Experience Reports
- [[experience-reports/2026-04-03-website-deployment|Website Deployment]]
- [[experience-reports/2026-04-03-agentm-web-white-screen|AgentM Web Bug]]

---

## 🚀 Getting Started

### For Code Agents

1. **Check Tasks**
   ```bash
   ./scripts/task.sh list todo P0
   ```

2. **Pick a Task**
   ```bash
   ./scripts/task.sh show GRA-64
   ```

3. **Start Working**
   ```bash
   ./scripts/task.sh update GRA-64 in-progress --open
   ```

4. **Mark Complete**
   ```bash
   ./scripts/task.sh update GRA-64 done
   ```

### Task Commands

| Command | Description |
|---------|-------------|
| `task.sh list` | List all tasks |
| `task.sh list todo P0` | List P0 todo tasks |
| `task.sh show GRA-64` | Show task details |
| `task.sh update GRA-64 done` | Mark as done |
| `task.sh create "Title" P0 "Project"` | Create new task |
| `task.sh stats` | Show statistics |

---

## 📈 Module Status

| Module | Status | Completion |
|--------|--------|------------|
| AgentM Pro | ✅ Complete | 100% |
| AgentM Web | ✅ Complete | 100% |
| P0 Fixes | ✅ Complete | 100% |
| Agent Arena | 🟡 In Progress | 83% |
| A2A Protocol | 🟡 In Progress | 57% |
| Chain Hub | 🟡 In Progress | 71% |
| Agent Layer EVM | 🔴 Blocked | 44% |
| AgentM Core | 🔴 Not Started | 0% |

---

## 🎯 This Week's Goals

- [ ] [[GRA-64]] Indexer API Design
- [ ] [[GRA-91]] Metaplex Research
- [ ] [[GRA-92]] Metaplex Integration
- [ ] [[GRA-70]] EVM cancel_task

---

*Use `Cmd/Ctrl + Click` to navigate between notes*
