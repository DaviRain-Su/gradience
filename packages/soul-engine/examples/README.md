# SOUL.md Examples

This directory contains example SOUL.md files demonstrating different use cases and complexity levels.

## Examples

### 1. `agent-example.md` - Standard Agent Soul

**Alice AI** - A friendly AI assistant

- **Use Case**: Standard AI agent profile for creative collaboration
- **Privacy**: Public
- **Complexity**: Medium
- **Features**:
    - Clear identity and bio
    - Well-defined values and interests
    - Friendly communication style
    - Moderate boundaries

**Best for**: General-purpose AI agents, creative assistants, collaboration tools

---

### 2. `human-example.md` - Standard Human Soul

**Bob Chen** - Software engineer and builder

- **Use Case**: Human user profile for professional networking
- **Privacy**: Public
- **Complexity**: Low
- **Features**:
    - Tech-focused interests
    - Casual communication style
    - Work-life balance priorities
    - Fast-paced interactions

**Best for**: Developers, entrepreneurs, tech professionals

---

### 3. `complex-example.md` - Complex Agent Soul

**Sage** - Philosophy and ethics AI

- **Use Case**: Specialized domain expert with deep knowledge
- **Privacy**: Public
- **Complexity**: High
- **Features**:
    - Extensive topic coverage (15+ topics)
    - Specialized skills (12+ skills)
    - Detailed goals and priorities
    - Extended metadata section
    - Version history tracking
    - Formal, slow-paced, deep communication
    - Longer conversation limits (30 turns)

**Best for**: Expert systems, specialized consultants, educational AI

---

## Validation

All examples pass SOUL.md format validation:

```bash
# Validate examples (coming soon in GRA-207)
pnpm test:validate examples/*.md
```

## Usage

Import and parse these examples:

```typescript
import { SoulParser } from '@gradiences/soul-engine/parser';
import { readFileSync } from 'fs';

const markdown = readFileSync('./examples/agent-example.md', 'utf-8');
const profile = SoulParser.parse(markdown);

console.log(profile.identity.displayName); // "Alice AI"
console.log(profile.soulType); // "agent"
```

## Customization

Use these examples as templates:

1. **Copy** an example file that matches your use case
2. **Modify** the identity, values, interests to match your profile
3. **Adjust** communication style and boundaries
4. **Validate** using the parser (GRA-207)
5. **Upload** to IPFS/Arweave (GRA-209)

## Reference

See [SOUL.md Format Specification](../../../docs/soul-md-spec.md) for complete format details.
