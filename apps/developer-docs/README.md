# Developer Docs

Next.js-based documentation site for Gradience Protocol.

## Overview

This application hosts:

- Protocol documentation
- API references
- Integration guides
- Architecture diagrams

## Tech Stack

- **Framework**: Next.js 14
- **Documentation**: Nextra / MDX
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Quick Start

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build
```

## Development

```bash
# Start dev server
pnpm dev

# Build
pnpm build

# Start production server
pnpm start
```

## Content

Documentation files are in `/pages`:

```
pages/
├── index.mdx          # Home page
├── protocol/          # Protocol docs
├── sdk/              # SDK reference
├── api/              # API docs
└── guides/           # Integration guides
```

## Deployment

Automatically deployed to Vercel on push to main.

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md)
