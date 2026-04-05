# @gradiences/ui

Shared UI components library for Gradience, built with React, Tailwind CSS, and Base UI.

## Installation

```bash
pnpm add @gradiences/ui
```

## Usage

```tsx
import { Button, Card, Input } from "@gradiences/ui";

export default function MyComponent() {
  return (
    <Card>
      <Input placeholder="Enter your name" />
      <Button>Submit</Button>
    </Card>
  );
}
```

## Components

- **Button** - Action button with multiple variants and sizes
- **Card** - Container component with header, content, footer sections
- **Input** - Text input field
- **Textarea** - Multi-line text input
- **Label** - Form label component
- **Select** - Dropdown select component
- **Switch** - Toggle switch
- **Slider** - Range slider
- **Tabs** - Tab navigation component

## Development

```bash
# Build the package
pnpm build

# Watch mode for development
pnpm dev

# Type check
pnpm type-check
```

## License

MIT
