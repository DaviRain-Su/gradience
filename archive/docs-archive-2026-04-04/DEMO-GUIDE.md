# Social Matching Demo Guide

## 🎉 Quick Start Demo

### 1. 启动 AgentM

```bash
cd /Users/davirian/dev/active/gradience/apps/agentm
pnpm dev
```

### 2. 访问 Social Tab

1. 登录 AgentM (或使用 Demo 模式)
2. 点击左侧导航栏的 **💕 Social** 按钮
3. 进入社交匹配界面

---

## 🎬 Demo Flow (5 minutes)

### Step 1: Create Your Soul Profile (30s)

1. 在 **👤 My Profile** 标签页
2. 点击 **"Create Profile"**
3. 填写表单：
    - **Soul Type**: Human
    - **Display Name**: Your Name
    - **Bio**: "AI enthusiast and blockchain explorer"
    - **Core Values**: innovation, collaboration, learning
    - **Topics**: AI, blockchain, DeFi
    - **Skills**: coding, research
    - **Communication**: Friendly, Moderate, Moderate
4. 点击 **"Save Profile"**

### Step 2: Discover Compatible Souls (30s)

1. 切换到 **🔍 Discover** 标签页
2. 查看预加载的 Demo Profiles：
    - 🤖 **Alice AI** - Research-focused agent
    - 👤 **Bob Chen** - Creative technologist
    - 🤖 **Sage Philosophy AI** - Contemplative AI
    - 👤 **Eve Trader** - Quantitative analyst
3. 点击任意卡片查看完整 Profile

### Step 3: Start Social Probe (90s)

1. 在 Discover 页面，点击 **"Start Probe 🔍"**
2. 自动切换到 **💬 Sessions** 标签页
3. 进行 2-3 轮对话：
    - **You**: "What are your thoughts on AI safety?"
    - **Agent**: [Response]
    - **You**: "How do you approach collaboration?"
    - **Agent**: [Response]
4. 观察 Turn 进度和状态指示器

### Step 4: Generate Compatibility Report (120s)

1. 点击 **"End & Analyze"**
2. 等待 AI 分析 (~15-20 seconds)
    - Embedding similarity calculation
    - LLM 4-dimension analysis
3. 自动跳转到 **💕 Matches** 标签页
4. 查看报告：
    - **Overall Score** (0-100)
    - **Score Breakdown** (Embedding 30% + LLM 70%)
    - **4 Dimension Analysis**:
        - 💎 Values Alignment (35%)
        - 🛡️ Boundary Respect (25%)
        - 💬 Communication Style (20%)
        - 🎯 Interest Overlap (20%)
    - **Recommended Topics** 🌟
    - **Topics to Avoid** 🚫
5. 点击不同标签查看详细分析

### Step 5: Summary (30s)

- 强调核心价值：**AI 驱动的兼容性分析**
- 实际应用场景：
    - Agent-to-Agent 协作匹配
    - Human-Agent 交互优化
    - 去中心化社交网络
    - 智能推荐系统

---

## 🎯 Key Features to Highlight

### 1. Soul Profile System

- **Human-readable**: Markdown format (SOUL.md)
- **Machine-processable**: Structured JSON
- **Privacy-controlled**: Public / ZK-Selective / Private

### 2. Two-Stage Matching

- **Fast Filter**: Embedding similarity (<1s for 100+ profiles)
- **Deep Analysis**: LLM 4-dimension evaluation (~15s)

### 3. Multi-Round Probing

- **Encrypted**: XMTP end-to-end encryption
- **Structured**: Turn-based conversation
- **Boundary-aware**: Auto-end on forbidden topics

### 4. Comprehensive Reports

- **Visual**: Score bars, color coding
- **Actionable**: Evidence, risks, suggestions
- **Shareable**: Markdown format + IPFS storage

---

## 📊 Demo Data

### Pre-loaded Profiles

| Name            | Type     | Focus          | Compatibility Factors             |
| --------------- | -------- | -------------- | --------------------------------- |
| Alice AI        | 🤖 Agent | DeFi research  | Technical, deep, accuracy-focused |
| Bob Chen        | 👤 Human | Creative tech  | Friendly, fast, artistic          |
| Sage Philosophy | 🤖 Agent | Ethics/meaning | Formal, slow, contemplative       |
| Eve Trader      | 👤 Human | Quant trading  | Technical, fast, data-driven      |

### Expected Compatibility Patterns

- **Technical + Technical** = High values/tone match
- **Human + Agent** = Interesting cross-type dynamics
- **Fast + Slow** = Potential pace mismatch
- **Deep + Surface** = Depth alignment challenges

---

## 🔧 Technical Stack

```
┌─────────────────────────────────────────┐
│  AgentM UI (React 19 + TypeScript)     │
├─────────────────────────────────────────┤
│  React Hooks (useSoulProfile, etc.)    │
├─────────────────────────────────────────┤
│  Soul Engine (@gradiences/soul-engine) │
│  ├── Parser (gray-matter + marked)     │
│  ├── Types (Zod validation)            │
│  ├── Probe (multi-turn conversations)  │
│  └── Matching Engine                   │
│      ├── Embedding (Transformers.js)   │
│      ├── LLM Analyzer (OpenAI GPT-4)   │
│      └── Report Generator              │
├─────────────────────────────────────────┤
│  Protocol Layer                        │
│  ├── Nostr (discovery)                 │
│  └── XMTP (encrypted messaging)        │
├─────────────────────────────────────────┤
│  Storage                               │
│  ├── localStorage (demo)               │
│  └── IPFS/Arweave (production)         │
└─────────────────────────────────────────┘
```

---

## 🎨 UI Components

### Available Components

```typescript
// Profile Components
import {
    SoulProfileEditor, // Create/edit profile
    SoulProfileCard, // Compact card view
    SoulProfileView, // Full detail view
    MatchingReportView, // Full report view
    MatchingReportCard, // Report list card
} from './components/social';

// Probe Components
import {
    ProbeChat, // Conversation UI
    ProbeInvitation, // Invitation card
} from './components/social';

// Hooks
import {
    useSoulProfile, // Profile state management
    useSoulMatching, // Matching engine
    useIPFSStorage, // IPFS upload/download
} from './hooks';
```

---

## 🚀 Advanced Demo Options

### Option 1: Real IPFS Storage

1. Get Web3.Storage API token
2. Set environment variable:
    ```bash
    VITE_WEB3_STORAGE_TOKEN=your_token
    ```
3. Profile uploads will go to real IPFS

### Option 2: Real LLM Analysis

1. Set OpenAI API key:
    ```bash
    VITE_OPENAI_API_KEY=your_key
    ```
2. Matching reports will use real GPT-4
3. Each analysis costs ~$0.01-0.02

### Option 3: Real XMTP Messaging

1. Configure XMTP credentials
2. Probes will use actual encrypted messaging
3. Conversations persist on XMTP network

---

## 📈 Performance Metrics

| Operation              | Time    | Notes             |
| ---------------------- | ------- | ----------------- |
| Profile parsing        | <10ms   | Markdown → Object |
| Embedding generation   | <100ms  | Per profile       |
| Similarity calculation | <5ms    | Cosine similarity |
| Top-K matching         | <1s     | 100+ profiles     |
| LLM analysis (4 dims)  | ~15-20s | GPT-4 API calls   |
| Full report generation | ~20-25s | Complete pipeline |

---

## 🎤 Talking Points

### Problem

- Agents and humans need to find compatible collaborators
- Traditional matching is superficial (skills only)
- No standard format for agent "personality"

### Solution

- **Soul Profile**: Standardized format for values, interests, communication style
- **Two-stage matching**: Fast embedding filter + Deep LLM analysis
- **Social probing**: Multi-round conversations to assess compatibility
- **AI reports**: Evidence-based compatibility assessment

### Innovation

- First AI-native compatibility system for agents
- Human-readable + machine-processable profiles
- Privacy-preserving with ZK-selective disclosure
- Decentralized discovery via Nostr

### Use Cases

- Agent marketplace matching
- Human-agent collaboration
- Team formation for projects
- Social network recommendations
- Dating/matching applications

---

## ✅ Demo Checklist

Before demo:

- [ ] AgentM builds successfully
- [ ] Demo profiles load correctly
- [ ] Soul Profile editor works
- [ ] Probe chat interface renders
- [ ] (Optional) OpenAI API key configured
- [ ] (Optional) Web3.Storage token configured

During demo:

- [ ] Create profile smoothly
- [ ] Discover profiles load
- [ ] Probe conversation works
- [ ] Report generates successfully
- [ ] UI is responsive and clear

After demo:

- [ ] Highlight key innovations
- [ ] Discuss technical architecture
- [ ] Mention future roadmap
- [ ] Share documentation links

---

## 🆘 Troubleshooting

### Issue: Profiles not loading

**Fix**: Check localStorage or refresh page

### Issue: Matching fails

**Fix**: Check OpenAI API key or use demo mode

### Issue: UI looks broken

**Fix**: Clear cache, rebuild: `pnpm build`

### Issue: Type errors

**Fix**: These are pre-existing XMTP issues, ignore for demo

---

## 📚 Resources

- **Implementation Doc**: `/docs/SOCIAL-MATCHING-IMPLEMENTATION.md`
- **Soul Engine Package**: `/packages/soul-engine/`
- **UI Components**: `/apps/agentm/src/components/social/`
- **Demo Profiles**: `/apps/agentm/src/renderer/lib/demo-profiles.ts`
- **Format Spec**: `/docs/soul-md-spec.md`

---

## 🎊 Success Criteria

Demo is successful if:

- ✅ User can create Soul Profile
- ✅ User can discover other profiles
- ✅ User can conduct probe conversation
- ✅ User can view compatibility report
- ✅ UI is smooth and intuitive
- ✅ Audience understands the value proposition

**Ready to demo! 🚀**
