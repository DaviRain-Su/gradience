# Changelog

All notable changes to the Gradience Protocol will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Security

- Removed hardcoded credentials from repository (CRITICAL)
- Removed Solana program keypairs from git history (CRITICAL)
- Updated `.gitignore` to prevent secret commits
- Created SECURITY.md with incident response and key rotation procedures

### Fixed

- Fixed CI workflows that silently ignored failures (`continue-on-error: true`)
- Fixed CI to use `--frozen-lockfile` for reproducible installs
- Fixed PostgreSQL default password fallback in Docker Compose
- Fixed SSH deployment to use non-root user
- Fixed E2E test workflow (was disabled)
- Fixed package naming inconsistency (added `@gradiences/` scope)
- Fixed website package.json metadata (description, author, license)

### Changed

- Deleted 17 `package-lock.json` files (project uses pnpm)
- Deleted duplicate `program-backup/` directories
- Removed `apps/chain-hub` from pnpm workspace (it's a Rust project)
- Added e2e tests to pnpm workspace
- Added Prettier check to CI
- Added Hackathon apps to workspace

### Added

- Added MIT LICENSE file
- Added SECURITY.md with vulnerability reporting process
- Added CONTRIBUTING.md with development guidelines
- Added CODE_OF_CONDUCT.md
- Added programs/README.md for Solana programs documentation
- Added docs/PROGRAM_CLEANUP_NOTICE.md

### CI/CD

- Added lint job with Prettier and ESLint checks
- Fixed Solana test workflow paths to include `programs/`
- Updated E2E test workflow to actually run tests
- Added artifact upload for failed E2E tests

## [0.1.0] - 2026-04-04

### Added

- Initial release of Gradience Protocol
- Agent Arena MVP with race model settlement
- Chain Hub indexer and SDK
- AgentM desktop and web applications
- TypeScript SDK and CLI
- Solana programs using Pinocchio framework
- Whitepaper and protocol documentation

[Unreleased]: https://github.com/gradiences/gradience/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/gradiences/gradience/releases/tag/v0.1.0
