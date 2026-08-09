# Marina: Windows ↔ VDS workflow

## Source of truth

- Repository: `https://github.com/lana-info/marina.git`
- Primary branch: `main`
- Recommended VDS path: `~/projects/marina`
- VDS/Linux is the primary development and test environment.
- Windows is reserved for Windows-specific and visual checks.
- GitHub is the handoff point.

Only one side may edit `main` at a time. Do not edit the same branch on Windows and VDS concurrently.

## First clone on VDS

```bash
mkdir -p ~/projects
git clone --branch main https://github.com/lana-info/marina.git ~/projects/marina
cd ~/projects/marina
chmod +x scripts/bootstrap_vds.sh
./scripts/bootstrap_vds.sh
```

For a private repository, authenticate GitHub first using the approved SSH or HTTPS method. Do not put tokens in files or commands that will be committed.

## Start Codex

```bash
cd ~/projects/marina
codex
```

The project-local `AGENTS.md` and `.codex/agents/*.toml` provide portable roles. Available roles are `luna_worker`, `terra_worker`, and `sol_architect`; model availability is still subject to the VDS Codex installation.

## Run in tmux

```bash
tmux new -s marina
cd ~/projects/marina
codex
# Detach: Ctrl-b d
tmux attach -t marina
```

## Sync VDS from GitHub

Before editing:

```bash
git fetch origin
git status --short --branch
git pull --ff-only origin main
```

If `pull --ff-only` refuses, stop and resolve the divergence explicitly; do not rebase or force-push automatically.

## Checkpoint on VDS

```bash
git diff --check
git status --short
git add -A
git diff --cached --check
git commit -m "<describe the completed checkpoint>"
git push origin main
```

Before committing, inspect the staged diff and ensure no `.env`, credentials, private keys, tokens, or user data are staged.

## VDS → Windows

1. Finish the current operation on VDS.
2. Run targeted tests and `git diff --check`.
3. Commit and push to `main`.
4. Stop editing on VDS.
5. On Windows, run:

```powershell
git fetch origin
git pull --ff-only origin main
```

6. Perform Windows-specific or visual checks only.

## Windows → VDS

1. Finish Windows-specific checks.
2. Do not keep uncommitted changes when handing off.
3. Run checks, commit, and push to `main`.
4. Stop editing on Windows.
5. On VDS, run `git fetch origin` and `git pull --ff-only origin main`.

## Safety rules

- Never use `git reset --hard`, `git clean -fd*`, force push, or automatic rebase in the handoff workflow.
- Do not start production workers or deployment from bootstrap.
- Do not change SSH, firewall, accounts, secrets, or permissions through this project workflow.
- Keep Windows-only tasks separate from Linux-safe work; they must not block independent checks that do not touch the same files.
