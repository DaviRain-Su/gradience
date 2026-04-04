# Gradience Documentation

Modern documentation site for the Gradience protocol, built with [Mintlify](https://mintlify.com/).

## Features

- 🎨 **Modern Design** - Clean, professional documentation theme
- 🌙 **Dark Mode** - Automatic dark/light mode switching
- 🔍 **Full-text Search** - Instant search across all docs
- 📱 **Responsive** - Works on desktop, tablet, and mobile
- 🧭 **Smart Navigation** - Auto-generated navigation and anchors
- 💬 **Feedback** - Built-in thumbs up/down feedback
- ✏️ **Edit on GitHub** - Easy contribution workflow

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
cd docs-site
npm install
```

### Development

```bash
npm run dev
```

This starts the local development server at `http://localhost:3000`.

### Build

```bash
npm run build
```

## Project Structure

```
docs-site/
├── mint.json              # Mintlify configuration
├── package.json           # Dependencies
├── README.md             # This file
├── logo/                 # Logo assets
│   ├── dark.svg
│   └── light.svg
├── images/               # Documentation images
├── overview/             # Overview docs
│   ├── introduction.mdx
│   ├── quickstart.mdx
│   └── architecture.mdx
├── sdk/                  # SDK documentation
│   ├── installation.mdx
│   ├── authentication.mdx
│   └── ...
├── api/                  # API reference
└── protocol/             # Protocol docs
```

## Writing Documentation

### MDX Format

Documents use MDX (Markdown + JSX):

```mdx
---
title: "Page Title"
description: "Page description"
---

# Heading

Content here...

<CardGroup cols={2}>
  <Card title="Card 1" icon="rocket">
    Description
  </Card>
</CardGroup>
```

### Available Components

- `<Card>` - Info cards
- `<CardGroup>` - Grid of cards
- `<Steps>` - Numbered steps
- `<CodeGroup>` - Tabbed code blocks
- `<Param>` - API parameters
- `<Response>` - API responses

### Adding Images

Place images in `images/` folder and reference:

```mdx
<img src="/images/diagram.png" alt="Description" />
```

## Deployment

### Mintlify Cloud (Recommended)

1. Push to GitHub
2. Connect repo to [Mintlify Dashboard](https://dashboard.mintlify.com)
3. Auto-deploy on every push

### Self-hosted

```bash
npm run build
# Deploy dist/ folder to your hosting
```

## Customization

Edit `mint.json` to customize:

- Colors and branding
- Navigation structure
- Social links
- Search settings

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - see LICENSE file
