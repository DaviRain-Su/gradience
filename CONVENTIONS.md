# Coding Conventions

## Development Lifecycle

This project uses a mandatory **7-phase development lifecycle**.
Full specification: [docs/methodology/README.md](docs/methodology/README.md)

```
PRD → Architecture → Technical Spec → Task Breakdown → Test Spec → Implementation → Review & Deploy
```

Rules:
- No code without a Technical Spec (Phase 3)
- No implementation without tests (Phase 5)
- Code must match the Technical Spec exactly — spec wrong? Fix spec first
- Templates: `docs/methodology/templates/`

---

## Rust (Solana Programs)

- **Framework**: Pinocchio (zero-dependency) for all Solana programs
- **Edition**: Rust 2021
- **Lints**: `unused_imports = "deny"`, `dead_code = "warn"`, `unused_variables = "warn"`
- **Error handling**: Never use `unwrap()` in production code — use explicit error variants
- **State accounts**: Define precise byte layouts with discriminator + version headers
- **PDA seeds**: Document in Technical Spec, keep deterministic and collision-free
- **Testing**: LiteSVM for integration tests, Borsh for serialization

### Naming

- Snake case for functions/variables: `post_task`, `judge_and_pay`
- PascalCase for types: `TaskState`, `JudgeMode`
- UPPER_SNAKE_CASE for constants: `MIN_SCORE`, `BPS_DENOMINATOR`
- Error codes: sequential numbering per module (6000+ Arena, 7000+ Chain Hub)

---

## TypeScript / JavaScript

- **Runtime**: Node.js 18+
- **Style**: Single quotes, 4-space indent, trailing semicolons
- **Types**: Strict TypeScript — `noEmit` type checking, no `any` unless justified
- **Imports**: Use `@/` path alias for internal imports (Next.js apps)

### React (AgentM Pro)

- **Framework**: Next.js 15+ with App Router
- **State**: Zustand for global state
- **Styling**: Tailwind CSS v4
- **Components**: Functional components only, `'use client'` directive when needed
- **Auth**: Privy for wallet management (Google OAuth + embedded wallet)
- **Testing**: Playwright for E2E

---

## Solidity (EVM)

- **Version**: `^0.8.24` for main contracts
- **Framework**: Hardhat
- **Guards**: OpenZeppelin ReentrancyGuard for payable functions
- **Errors**: Custom errors (not `require` strings) to save gas
- **Constants**: Align with Solana values (MIN_SCORE=60, 95/3/2 fee split)

---

## Git

- Branch naming: `feat/GRA-XX-description`, `fix/GRA-XX-description`
- Commit messages reference Linear issue IDs: `GRA-XX: description`
- PR titles: short, under 70 chars
- Squash merge to main
- Never force-push to main

---

## Documentation

- Phase docs: `<project>/docs/01-prd.md` through `07-review-report.md`
- API specs: `<project>/docs/api-reference.md`
- Keep README.md up to date with test counts and quick start
