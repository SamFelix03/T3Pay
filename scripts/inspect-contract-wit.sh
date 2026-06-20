#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WASM="$ROOT/contracts/vaultpay/target/wasm32-wasip2/release/vaultpay_contracts.wasm"

wasm-tools component wit "$WASM"
