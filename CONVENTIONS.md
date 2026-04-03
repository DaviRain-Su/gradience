# Coding Conventions

> **Task**: GRA-55 - Create coding conventions
> **Date**: 2026-04-03

## Rust

### Naming
- `snake_case` for functions, variables
- `PascalCase` for types, traits
- `SCREAMING_SNAKE_CASE` for constants
- `_prefix` for unused variables

### Formatting
- Use `rustfmt` with default config
- Max line length: 100
- Use `cargo clippy` for linting

### Error Handling
- Use `thiserror` for custom errors
- Avoid `unwrap()` in production
- Use `?` operator for propagation

## TypeScript

### Naming
- `camelCase` for functions, variables
- `PascalCase` for classes, interfaces
- `UPPER_CASE` for constants

### Formatting
- Use Prettier
- 2 spaces indentation
- Single quotes

### Imports
- Group: external → internal → relative
- Alphabetize within groups

## Git

### Commits
```
type(scope): description

body (optional)

footer (optional)
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Branches
- `main` - production
- `develop` - integration
- `feature/GRA-XX-description` - features
- `fix/GRA-XX-description` - bug fixes
