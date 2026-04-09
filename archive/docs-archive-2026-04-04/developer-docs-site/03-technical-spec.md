# Developer Docs Site - Technical Specification

---

## 🏗️ System Architecture

### Tech Stack

**Frontend**:

- Next.js 14 (App Router)
- Tailwind CSS
- MDX (Markdown + React)
- Framer Motion (animations)

**Backend**:

- Next.js API Routes
- Redis (caching)
- PostgreSQL (analytics)

**Content**:

- Git-based CMS
- OpenAPI specs
- JSON Schema

**Deployment**:

- Vercel (primary)
- Cloudflare CDN
- GitHub Actions (CI/CD)

---

## 📁 Project Structure

```
apps/developer-docs/
├── app/                          # Next.js app router
│   ├── (human)/                  # Human mode routes
│   │   ├── [[...slug]]/page.tsx  # Catch-all doc pages
│   │   ├── api/page.tsx          # API reference
│   │   └── layout.tsx            # Human layout
│   ├── (agent)/                  # Agent mode routes
│   │   └── api/
│   │       └── v1/
│   │           └── docs/
│   │               └── route.ts  # Agent API endpoint
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing
├── components/                   # React components
│   ├── ui/                       # UI primitives
│   ├── docs/                     # Doc-specific
│   │   ├── HumanRenderer.tsx     # Human mode renderer
│   │   ├── AgentSchema.tsx       # Schema display
│   │   └── CodePlayground.tsx    # Interactive code
│   └── navigation/               # Nav components
├── content/                      # Documentation content
│   ├── 01-getting-started/
│   ├── 02-core-concepts/
│   ├── 03-api-reference/
│   ├── 04-examples/
│   └── 05-advanced/
├── lib/                          # Utilities
│   ├── parsers/                  # Content parsers
│   │   ├── mdx.ts               # MDX processor
│   │   ├── schema.ts            # Schema extractor
│   │   └── agent-api.ts         # Agent API generator
│   ├── cache.ts                 # Caching layer
│   └── scale.ts                 # Scale utilities
├── types/                        # TypeScript types
│   ├── docs.ts                  # Doc content types
│   ├── agent.ts                 # Agent API types
│   └── scale.ts                 # Scale config types
├── public/                       # Static assets
└── scripts/                      # Build scripts
    ├── generate-agent-api.ts    # Generate agent endpoints
    └── validate-schemas.ts      # Validate content schemas
```

---

## 🔌 Agent API Design

### Endpoint Specification

```typescript
// GET /api/v1/docs/{module}/{topic}
interface AgentDocRequest {
    module: string; // e.g., "chain-hub", "a2a-protocol"
    topic: string; // e.g., "reputation", "messaging"
    version?: string; // API version
    format?: 'json' | 'yaml' | 'md';
}

interface AgentDocResponse {
    meta: {
        module: string;
        topic: string;
        version: string;
        lastUpdated: string;
        scaleSupport: string[];
    };

    content: {
        summary: string; // One-line description
        description: string; // Detailed description
        learningPath: string[]; // Prerequisites
        complexity: 'beginner' | 'intermediate' | 'advanced';
    };

    api?: {
        endpoint: string;
        method: 'GET' | 'POST' | 'PUT' | 'DELETE';
        parameters: Parameter[];
        returns: ReturnType;
        examples: CodeExample[];
        errorCodes: ErrorCode[];
    };

    scale?: {
        rateLimits: RateLimitConfig;
        caching: CacheConfig;
        batchOperations: boolean;
        pagination: PaginationConfig;
    };

    related: {
        prerequisites: string[];
        nextSteps: string[];
        alternatives: string[];
    };
}

interface Parameter {
    name: string;
    type: string;
    required: boolean;
    description: string;
    agentHint: string; // Hint for Agent usage
    validation?: ValidationRule;
}
```

### Example Response

```json
{
    "meta": {
        "module": "chain-hub",
        "topic": "reputation.get",
        "version": "1.0.0",
        "lastUpdated": "2026-04-03",
        "scaleSupport": ["rate_limiting", "caching", "batch"]
    },

    "content": {
        "summary": "Get reputation score for an Agent",
        "description": "Retrieve the current reputation score...",
        "learningPath": ["chain-hub.intro", "agent.identity"],
        "complexity": "beginner"
    },

    "api": {
        "endpoint": "/api/v1/reputation/{agentId}",
        "method": "GET",
        "parameters": [
            {
                "name": "agentId",
                "type": "string",
                "required": true,
                "description": "Unique Agent identifier",
                "agentHint": "Use the agent's wallet address or ENS name"
            }
        ],
        "returns": {
            "type": "ReputationScore",
            "fields": {
                "score": { "type": "number", "range": [0, 100] },
                "level": { "type": "string", "enum": ["low", "medium", "high"] }
            }
        },
        "examples": [
            {
                "language": "typescript",
                "code": "const score = await chainHub.reputation.get(agentId);",
                "runnable": true
            }
        ],
        "errorCodes": [
            {
                "code": "AGENT_NOT_FOUND",
                "message": "Agent does not exist",
                "solution": "Verify agentId or register the agent first"
            }
        ]
    },

    "scale": {
        "rateLimits": {
            "requestsPerSecond": 100,
            "burstAllowance": 150
        },
        "caching": {
            "ttl": 300,
            "staleWhileRevalidate": 60
        },
        "batchOperations": true,
        "pagination": {
            "defaultLimit": 50,
            "maxLimit": 500
        }
    }
}
```

---

## 📄 Content Schema

### Frontmatter Specification

````yaml
---
# Identity
title: 'Get Reputation Score'
slug: 'reputation-get'
module: 'chain-hub'
phase: '3' # 7-Phase: Technical Spec
version: '1.0.0'

# Classification
complexity: 'beginner'
tags: ['api', 'reputation', 'core', 'read']
categories: ['reference', 'api']

# Scale Support
scale_support:
    - rate_limiting
    - caching
    - batch_operations
    - pagination

# Human Content
human:
    summary: "Retrieve an Agent's reputation score"
    description: |
        This endpoint returns the current reputation score...

    quick_start: |
        ```typescript
        const score = await chainHub.reputation.get(agentId);
        ```

    detailed_guide: './detailed-guide.md'

    examples:
        - title: 'Basic Usage'
          path: './examples/basic.ts'
        - title: 'Batch Operations'
          path: './examples/batch.ts'

    best_practices:
        - 'Cache results for 5 minutes'
        - 'Handle AGENT_NOT_FOUND error'

# Agent Content
agent:
    context: |
        Use this API to check Agent credibility before transactions.
        High reputation (>80) indicates trustworthy Agent.

    function_signature: |
        reputation.get(agentId: string): Promise<ReputationScore>

    parameters:
        - name: 'agentId'
          type: 'string'
          required: true
          validation: '/^[a-zA-Z0-9]{32,44}$/'
          agent_hint: 'Agent wallet address or .sol domain'

    returns:
        type: 'ReputationScore'
        fields:
            score:
                type: 'number'
                range: [0, 100]
                interpretation: 'Higher is better'
            level:
                type: 'enum'
                values: ['low', 'medium', 'high']

    error_handling:
        AGENT_NOT_FOUND:
            message: 'Agent does not exist'
            action: 'Register agent first using POST /agents'
        RATE_LIMITED:
            message: 'Too many requests'
            action: 'Implement exponential backoff'

    learning_path:
        prerequisites:
            - 'chain-hub.intro'
            - 'agent.identity'
        next_steps:
            - 'reputation.update'
            - 'transaction.verify'

    optimization_hints:
        - 'Cache for 5 minutes to reduce API calls'
        - 'Use batch API for multiple agents'
        - 'Handle stale cache gracefully'

# SEO & Metadata
seo:
    title: 'Get Agent Reputation Score | Chain Hub API'
    description: 'Retrieve real-time reputation scores...'
    keywords: ['agent', 'reputation', 'api', 'blockchain']

# Related Content
related:
    - title: 'Update Reputation'
      slug: 'reputation-update'
    - title: 'Verify Transaction'
      slug: 'transaction-verify'

# Change Log
changelog:
    - version: '1.0.0'
      date: '2026-04-03'
      changes: ['Initial release']
---
````

---

## 🚀 Scale Architecture

### Caching Strategy

```typescript
// Multi-layer caching
interface CacheConfig {
    // L1: Edge Cache (Cloudflare)
    edge: {
        ttl: 300; // 5 minutes
        staleWhileRevalidate: 60;
    };

    // L2: Redis Cache
    redis: {
        ttl: 600; // 10 minutes
        keyPattern: 'docs:{module}:{topic}:{version}';
    };

    // L3: In-memory (Vercel)
    memory: {
        maxSize: '100mb';
        ttl: 60; // 1 minute
    };
}
```

### CDN Configuration

```yaml
cdn:
    provider: cloudflare

    rules:
        # Static assets
        - pattern: '/static/*'
          cache: '1 year'

        # API docs (Agent mode)
        - pattern: '/api/v1/docs/*'
          cache: '1 hour'
          staleWhileRevalidate: '5 minutes'

        # Human docs
        - pattern: '/docs/*'
          cache: '24 hours'
          staleWhileRevalidate: '1 hour'

    optimizations:
        - brotli_compression
        - image_optimization
        - http3
```

---

## 🧪 Testing Strategy

### Content Validation

```typescript
// Validate all docs have required fields
const validateDoc = (doc: DocFile): ValidationResult => {
    const required = ['title', 'slug', 'module', 'phase', 'human.summary', 'agent.function_signature'];

    // Check required fields
    // Validate schema
    // Check links
    // Verify examples compile
};
```

### Agent API Testing

```typescript
// Test Agent can understand and use the API
describe('Agent Learning', () => {
    it('should parse schema correctly', () => {
        const doc = fetchAgentDoc('chain-hub', 'reputation.get');
        const agent = new LearningAgent();

        const understanding = agent.learn(doc);
        expect(understanding.canUseAPI).toBe(true);
    });

    it('should generate correct code', () => {
        const code = agent.generateCode('get reputation for agent123');
        expect(code).toBeValid();
    });
});
```

---

## 📦 Deployment

### Vercel Configuration

```json
{
    "buildCommand": "npm run build && npm run generate-agent-api",
    "outputDirectory": ".next",
    "framework": "nextjs",
    "regions": ["iad1", "fra1", "sin1"],
    "headers": [
        {
            "source": "/api/v1/docs/(.*)",
            "headers": [{ "key": "Cache-Control", "value": "public, max-age=3600" }]
        }
    ]
}
```

---

## 🔄 CI/CD Pipeline

```yaml
name: Deploy Docs

on:
    push:
        paths:
            - 'docs/**'
            - 'apps/developer-docs/**'

jobs:
    validate:
        runs-on: ubuntu-latest
        steps:
            - uses: actions/checkout@v4
            - name: Validate Content Schema
              run: npm run validate-schemas
            - name: Test Agent API
              run: npm run test:agent

    build:
        needs: validate
        runs-on: ubuntu-latest
        steps:
            - name: Build Site
              run: npm run build
            - name: Generate Agent API
              run: npm run generate:agent-api
            - name: Deploy to Vercel
              run: vercel --prod
```

---

## 📊 Monitoring

### Metrics to Track

```typescript
interface DocMetrics {
    // Performance
    pageLoadTime: number;
    apiResponseTime: number;
    cacheHitRate: number;

    // Usage
    humanVisits: number;
    agentApiCalls: number;
    searchQueries: number;

    // Quality
    errorRate: number;
    brokenLinks: number;
    outdatedContent: number;
}
```

---

_Technical Spec v1.0.0_
