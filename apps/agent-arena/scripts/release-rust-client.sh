#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUST_CLIENT_MANIFEST="${ROOT_DIR}/clients/rust/Cargo.toml"
DRY_RUN="${DRY_RUN:-1}"

if [[ -n "${RELEASE_VERSION:-}" ]]; then
    pnpm --dir "${ROOT_DIR}" exec tsx "./scripts/check-release-version.ts" --version "${RELEASE_VERSION}"
else
    pnpm --dir "${ROOT_DIR}" exec tsx "./scripts/check-release-version.ts"
fi

if [[ "${DRY_RUN}" == "1" || "${DRY_RUN}" == "true" ]]; then
    echo "[release-rust] dry-run enabled"
    cargo publish --manifest-path "${RUST_CLIENT_MANIFEST}" --dry-run
    exit 0
fi

if [[ -z "${CARGO_REGISTRY_TOKEN:-}" ]]; then
    echo "CARGO_REGISTRY_TOKEN is required for cargo publish" >&2
    exit 1
fi

cargo publish --manifest-path "${RUST_CLIENT_MANIFEST}"
