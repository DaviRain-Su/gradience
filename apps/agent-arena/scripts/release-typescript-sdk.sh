#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SDK_DIR="${ROOT_DIR}/clients/typescript"
DRY_RUN="${DRY_RUN:-1}"
NPM_TAG="${NPM_TAG:-latest}"

if [[ -n "${RELEASE_VERSION:-}" ]]; then
    pnpm --dir "${ROOT_DIR}" exec tsx "./scripts/check-release-version.ts" --version "${RELEASE_VERSION}"
else
    pnpm --dir "${ROOT_DIR}" exec tsx "./scripts/check-release-version.ts"
fi

pnpm --dir "${SDK_DIR}" run build

cd "${SDK_DIR}"

if [[ "${DRY_RUN}" == "1" || "${DRY_RUN}" == "true" ]]; then
    echo "[release-sdk] dry-run enabled"
    npm publish --access public --tag "${NPM_TAG}" --dry-run
    exit 0
fi

if [[ -z "${NODE_AUTH_TOKEN:-}" ]]; then
    echo "NODE_AUTH_TOKEN is required for npm publish" >&2
    exit 1
fi

npm publish --access public --tag "${NPM_TAG}"
