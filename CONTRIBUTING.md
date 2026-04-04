# Contributing to Gradience

Thank you for your interest in contributing to Gradience! This document provides guidelines for contributing to the project.

## Table of Contents

- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Questions?](#questions)

## Development Workflow

### Prerequisites

- **Node.js**: v22+ (specified in `.nvmrc`)
- **pnpm**: v9+ (this project uses pnpm as the package manager)
- **Rust**: Latest stable (for Solana programs)
- **Solana CLI**: v2.2+ (for program development)

### Setup

```bash
# Clone the repository
git clone https://github.com/yourorg/gradience.git
cd gradience

# Install dependencies
pnpm install

# Build workspace packages
pnpm run build

# Run tests
pnpm test
```

### Monorepo Structure

This is a pnpm monorepo with the following structure:

```
├── apps/               # Applications
│   ├── agent-arena/   # Main dApp with frontend, CLI, SDK
│   ├── agentm/        # Desktop messaging app
│   ├── agentm-web/    # Web version
│   └── chain-hub/     # Chain Hub indexer and SDK
├── packages/          # Shared libraries
│   ├── sdk/          # TypeScript SDK
│   ├── cli/          # CLI tools
│   └── ...
├── programs/          # Solana Rust programs
│   ├── agent-arena/
│   ├── chain-hub/
│   └── ...
├── e2e/              # End-to-end tests
└── website/          # Marketing website
```

### Development Phases

This project follows a strict 7-phase development lifecycle:

1. **PRD** - Product Requirements Document
2. **Architecture** - System design and data flow
3. **Technical Spec** - Detailed implementation plan
4. **Task Breakdown** - Granular tasks in Obsidian
5. **Test Spec** - Test cases and coverage requirements
6. **Implementation** - Code development
7. **Review & Deploy** - Code review and deployment

See `docs/methodology/README.md` for details.

## Code Standards

### TypeScript/JavaScript

- Use **strict TypeScript** mode
- Follow existing code patterns in the codebase
- Use ESLint and Prettier for formatting
- All code must pass type checking: `tsc --noEmit`

### Rust (Solana Programs)

- Follow Rust idioms and best practices
- Use `cargo fmt` for formatting
- Use `cargo clippy` for linting
- All programs must have tests

### Formatting

```bash
# Check formatting
pnpm run lint

# Fix formatting issues
pnpm run lint:fix

# Run Prettier
pnpm run format
```

## Testing

### Unit Tests

```bash
# Run all tests
pnpm test

# Run tests for a specific package
pnpm --filter @gradiences/sdk test
```

### Integration Tests

```bash
# Run Solana program tests
cargo test --manifest-path programs/agent-arena/Cargo.toml
```

### E2E Tests

```bash
# Run E2E tests
cd e2e && pnpm test

# Run with UI
pnpm test:ui
```

### Test Coverage

- All new features must include tests
- Aim for >80% coverage for critical paths
- Tests must pass in CI before merge

## Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, semicolons, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Build process, dependencies, etc.

### Examples

```
feat(sdk): add reputation query method
fix(frontend): resolve wallet connection issue
docs: update API documentation
test(arena): add integration tests for task lifecycle
```

### Task References

Include task IDs from Obsidian in commits:

```
feat(sdk): add reputation query method (GRA-64)
```

## Pull Request Process

1. **Create a branch** from `main`:

    ```bash
    git checkout -b feature/your-feature-name
    ```

2. **Make your changes** following the code standards

3. **Run tests locally**:

    ```bash
    pnpm test
    pnpm run typecheck
    pnpm run lint
    ```

4. **Update documentation** if needed (README, docs/, etc.)

5. **Commit your changes** with conventional commit messages

6. **Push and create a PR**:
    - Fill out the PR template
    - Link related issues/tasks
    - Request review from maintainers

7. **Address review feedback**

8. **Merge** (maintainers will merge after approval)

### PR Checklist

- [ ] Tests pass locally
- [ ] Type checking passes
- [ ] Linting passes
- [ ] Documentation updated
- [ ] Commit messages follow conventions
- [ ] No secrets or credentials committed
- [ ] PR description is clear and comprehensive

## Questions?

- **Development questions**: Open a GitHub Discussion
- **Bug reports**: Open a GitHub Issue
- **Security issues**: See [SECURITY.md](SECURITY.md)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
