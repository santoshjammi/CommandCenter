#!/usr/bin/env bash
# publish.sh — Enhance tools → rebuild frontend → commit & push
#
# Usage:
#   ./publish.sh                     # default: enhance 50 tools, then build & push
#   ./publish.sh --batch-size 20     # smaller enhancement batch
#   ./publish.sh --category "AI Tools"
#   ./publish.sh --slug cursor       # single tool, then full build
#   ./publish.sh --no-enhance        # skip enhancement, just rebuild & push
#   ./publish.sh --no-push           # enhance + build, but don't git push
#   ./publish.sh --dry-run           # show what would change, nothing saved
#
# Cron (daily at 03:00):
#   0 3 * * * cd /path/to/CommandCenter && bash publish.sh >> logs/publish.log 2>&1
# ---------------------------------------------------------------------------
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_ACTIVATE="$SCRIPT_DIR/../venv/bin/activate"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
LOG_DIR="$SCRIPT_DIR/logs"
mkdir -p "$LOG_DIR"

# ── Parse arguments ─────────────────────────────────────────────────────────
BATCH_SIZE=50
CATEGORY=""
SLUG=""
DRY_RUN=false
NO_ENHANCE=false
NO_PUSH=false
EXTRA_ENHANCE_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --batch-size)   BATCH_SIZE="$2"; shift 2 ;;
    --category)     CATEGORY="$2";   shift 2 ;;
    --slug)         SLUG="$2";       shift 2 ;;
    --dry-run)      DRY_RUN=true;    EXTRA_ENHANCE_ARGS+=(--dry-run); shift ;;
    --no-enhance)   NO_ENHANCE=true; shift ;;
    --no-push)      NO_PUSH=true;    shift ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

# ── Helpers ──────────────────────────────────────────────────────────────────
timestamp() { date '+%Y-%m-%d %H:%M:%S'; }
log()        { echo "[$(timestamp)] $*"; }
hr()         { echo "────────────────────────────────────────────────────────"; }

hr
log "🚀  DevKeys publish pipeline starting"
hr

# ── 1. Activate Python venv ──────────────────────────────────────────────────
if [[ -f "$VENV_ACTIVATE" ]]; then
  # shellcheck source=/dev/null
  source "$VENV_ACTIVATE"
  log "✅  Python venv activated: $(python3 --version)"
else
  log "⚠️   No venv found at $VENV_ACTIVATE — using system Python"
fi

cd "$SCRIPT_DIR"

# ── 2. Enhancement pass ───────────────────────────────────────────────────────
if [[ "$NO_ENHANCE" == true ]]; then
  log "⏭️   Skipping enhancement (--no-enhance)"
else
  log "🔍  Running enhance_tools.py …"

  ENHANCE_ARGS=(--batch-size "$BATCH_SIZE")
  [[ -n "$CATEGORY" ]] && ENHANCE_ARGS+=(--category "$CATEGORY")
  [[ -n "$SLUG" ]]     && ENHANCE_ARGS+=(--slug "$SLUG")
  ENHANCE_ARGS+=(${EXTRA_ENHANCE_ARGS[@]+"${EXTRA_ENHANCE_ARGS[@]}"})

  python3 enhance_tools.py "${ENHANCE_ARGS[@]}"

  if [[ "$DRY_RUN" == true ]]; then
    log "ℹ️   Dry-run mode — no files were changed"
    hr
    log "🏁  Pipeline finished (dry-run, nothing pushed)"
    exit 0
  fi

  log "✅  Enhancement complete"
fi

# ── 3. Rebuild Next.js frontend ───────────────────────────────────────────────
log "🏗️   Building frontend …"
cd "$FRONTEND_DIR"
npm run build
log "✅  Frontend build complete"

cd "$SCRIPT_DIR"

# ── 4. Git commit & push ──────────────────────────────────────────────────────
if [[ "$NO_PUSH" == true ]]; then
  log "⏭️   Skipping git push (--no-push)"
  hr
  log "🏁  Pipeline finished (ready to deploy, not pushed)"
  exit 0
fi

log "📦  Staging changes …"

# Stage the data files and frontend build artefact (search index)
git add data/tools/ data/enhancement_log.json frontend/public/search-index.json 2>/dev/null || true

# Check if there is anything to commit
if git diff --cached --quiet; then
  log "ℹ️   Nothing new to commit — already up to date"
else
  COMMIT_DATE="$(date '+%Y-%m-%d')"
  CHANGED_COUNT="$(git diff --cached --name-only -- data/tools/ | wc -l | tr -d ' ')"
  git commit -m "chore: daily enhancement ${COMMIT_DATE} — ${CHANGED_COUNT} tools updated"
  log "✅  Committed: ${CHANGED_COUNT} tool(s) updated"

  git push
  log "✅  Pushed to origin"
fi

hr
log "🏁  Pipeline finished"
