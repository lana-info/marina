#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$PROJECT_ROOT"

fail() { echo "ERROR: $*" >&2; exit 1; }
warn() { echo "WARNING: $*" >&2; }
note() { echo "INFO: $*"; }

[[ "$(uname -s)" == "Linux" ]] || fail "This bootstrap requires Linux/Ubuntu or a compatible Linux environment."
[[ -f /etc/os-release ]] && . /etc/os-release || true
note "OS: ${PRETTY_NAME:-Linux}"

for command_name in git bash; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Missing required command: $command_name"
done

if ! command -v curl >/dev/null 2>&1; then
  warn "Optional command is missing: curl"
fi
[[ -d /etc/ssl/certs ]] || warn "CA certificate directory is missing."

git rev-parse --show-toplevel >/dev/null 2>&1 || fail "Run this script inside the cloned repository."
[[ -f AGENTS.md ]] || warn "AGENTS.md is missing."
[[ -f PROJECT.md ]] || warn "PROJECT.md is missing."
[[ -f TASKS.md ]] || warn "TASKS.md is missing."
[[ -f STATE.md ]] || warn "STATE.md is missing."

if [[ -f package.json ]]; then
  command -v node >/dev/null 2>&1 || fail "package.json found but Node.js is missing."
  command -v npm >/dev/null 2>&1 || fail "package.json found but npm is missing."
  node --version
  npm --version
  if [[ -f package-lock.json ]]; then npm ci; else npm install; fi
else
  note "No package.json; Node dependency setup skipped."
fi

if [[ -f requirements.txt || -f pyproject.toml ]]; then
  command -v python3 >/dev/null 2>&1 || fail "Python project detected but python3 is missing."
  python3 -m venv .venv
  # shellcheck disable=SC1091
  source .venv/bin/activate
  python -m pip install --upgrade pip
  if [[ -f requirements.txt ]]; then python -m pip install -r requirements.txt; fi
  if [[ -f pyproject.toml ]]; then python -m pip install -e .; fi
else
  note "No Python dependency manifest; Python environment setup skipped."
fi

if [[ -f Cargo.toml ]]; then
  command -v cargo >/dev/null 2>&1 || fail "Cargo project detected but cargo is missing."
  cargo build
fi

if [[ -f go.mod ]]; then
  command -v go >/dev/null 2>&1 || fail "Go project detected but go is missing."
  go mod download
fi

if command -v codex >/dev/null 2>&1; then
  note "Codex CLI: $(codex --version 2>/dev/null || true)"
else
  warn "Codex CLI is not on PATH; install or provision it separately. Secrets are not configured by this script."
fi

for agent_file in .codex/agents/*.toml; do
  [[ -e "$agent_file" ]] || break
  grep -q '^name = ' "$agent_file" || fail "Invalid custom agent file: $agent_file"
  grep -q '^model = ' "$agent_file" || fail "Custom agent has no model: $agent_file"
done

tests_run=0
if [[ -f package.json ]]; then
  if npm run | grep -qE '^  test'; then npm test; tests_run=1; else note "No npm test script; baseline test skipped."; fi
fi
if [[ -f pyproject.toml || -f requirements.txt ]]; then
  if command -v pytest >/dev/null 2>&1; then pytest; tests_run=1; else note "pytest is not installed; Python baseline test skipped."; fi
fi
if [[ -f Cargo.toml ]]; then cargo test; tests_run=1; fi
if [[ -f go.mod ]]; then go test ./...; tests_run=1; fi
if [[ "$tests_run" -eq 0 ]]; then note "No project test runner detected; no baseline tests were run."; fi

git diff --check
note "Bootstrap completed. No SSH, firewall, secrets, production workers, or deployment were changed."
