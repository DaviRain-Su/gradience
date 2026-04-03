# Gradience Architecture Diagrams

This directory contains interactive architecture diagrams for the Gradience Protocol.

## 📊 Available Diagrams

| Diagram | Description |
|---------|-------------|
| `full-stack-architecture.mmd` | Complete system architecture from users to infrastructure |
| `protocol-kernel.mmd` | Core protocol kernel (Bitcoin philosophy) |
| `task-state-machine.mmd` | Task lifecycle state machine |
| `economic-model.mmd` | Fee distribution model (95/3/2) |
| `a2a-layers.mmd` | A2A Protocol layers (Lightning Network analogy) |
| `cross-chain-reputation.mmd` | Cross-chain reputation verification |
| `gan-dynamics.mmd` | GAN adversarial dynamics between Agent and Judge |
| `three-layer-stack.mmd` | Three-layer value stack (Core → Lending → Stablecoin) |

## 🎨 Color Coding

| Color | Component |
|-------|-----------|
| ![#0f7b8a](https://via.placeholder.com/20/0f7b8a/0f7b8a) `#0f7b8a` | Kernel Layer (Agent Layer Program) |
| ![#8b5cf6](https://via.placeholder.com/20/8b5cf6/8b5cf6) `#8b5cf6` | Chain Hub Module |
| ![#3b82f6](https://via.placeholder.com/20/3b82f6/3b82f6) `#3b82f6` | AgentM Products |
| ![#f59e0b](https://via.placeholder.com/20/f59e0b/f59e0b) `#f59e0b` | SDK & Toolchain |
| ![#9945ff](https://via.placeholder.com/20/9945ff/9945ff) `#9945ff` | Solana Infrastructure |
| ![#10b981](https://via.placeholder.com/20/10b981/10b981) `#10b981` | Success / Complete State |
| ![#ef4444](https://via.placeholder.com/20/ef4444/ef4444) `#ef4444` | Error / Refund State |

## 🚀 Viewing Diagrams

### Option 1: Interactive HTML (Recommended)
Open `index.html` in a web browser for interactive, zoomable diagrams with the dark theme.

```bash
# macOS
open public/diagrams/index.html

# Linux
xdg-open public/diagrams/index.html
```

### Option 2: VS Code Extension
Install the [Mermaid Preview](https://marketplace.visualstudio.com/items?itemName=vstirbu.vscode-mermaid-preview) extension and open any `.mmd` file.

### Option 3: Mermaid Live Editor
Copy the contents of any `.mmd` file and paste into [Mermaid Live Editor](https://mermaid.live/).

### Option 4: Developer Docs Site
The architecture diagrams are also integrated into the developer documentation site:
```bash
cd apps/developer-docs
npm run dev
# Visit http://localhost:3000/architecture
```

## 🔄 Regenerating Diagrams

To regenerate all diagrams from source:

```bash
node scripts/generate-diagrams.js
```

## 📝 Diagram Source Format

All diagrams use [Mermaid](https://mermaid.js.org/) syntax. Key diagram types used:

- **Flowchart** (`flowchart TB/LR`) - System architecture, data flow
- **State Diagram** (`stateDiagram-v2`) - Task lifecycle states
- **Sequence Diagram** (`sequenceDiagram`) - Interaction sequences

### Example: Adding a New Diagram

1. Edit `scripts/generate-diagrams.js`
2. Add your diagram to the `diagrams` object:
```javascript
const diagrams = {
  'my-new-diagram': `
flowchart TB
    A["Component A"] --> B["Component B"]
    style A fill:#0f7b8a,color:#fff
    style B fill:#8b5cf6,color:#fff
  `,
  // ... existing diagrams
};
```
3. Run `node scripts/generate-diagrams.js`

## 🔗 Integration with Documentation

These diagrams are used in:
- [Developer Docs](../../apps/developer-docs/app/architecture/page.tsx) - Interactive React components
- [README.md](../../README.md) - Static Mermaid diagrams
- [Architecture Spec](../../docs/02-architecture.md) - Technical documentation

## 📚 References

- [Mermaid Documentation](https://mermaid.js.org/intro/)
- [Gradience Protocol Whitepaper](../../protocol/whitepaper/gradience-en.pdf)
- [Architecture Specification](../../docs/02-architecture.md)
