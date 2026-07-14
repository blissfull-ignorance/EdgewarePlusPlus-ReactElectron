#!/usr/bin/env bash
# Requires Bash ≥4.x. macOS ships bash 3.2 by default; install via: brew install bash
set -euo pipefail
# set -euo pipefail: script exits on unhandled errors or unbound variables.
# Commands tested inside if-conditions are exempt from the -e behavior.

TASK_DIR="./tasks/pending"
DONE_DIR="./tasks/done"
FAIL_DIR="./tasks/failed"
LOG_DIR="./tasks"
LOG_FILE="$LOG_DIR/orchestration.log"
MAX_RETRIES=2
RETRY_DELAY=30  # seconds; increase for rate-limit-heavy workloads

mkdir -p "$DONE_DIR" "$FAIL_DIR" "$LOG_DIR" "./tasks/logs"

# Verify prerequisites before starting
if ! command -v claude &> /dev/null; then
  echo "ERROR: claude CLI not found on PATH. Install and authenticate first." >&2
  exit 1
fi

# Abort if the working tree is dirty — git restore during retries would destroy pre-existing work
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: dirty working tree. Commit or stash changes before running orchestration." >&2
  exit 1
fi

# Pre-flight test gate: abort if the test suite is already broken
# Replace 'npm test' with your project's test command (pytest, cargo test, go test ./..., etc.)
if ! npm test > /dev/null 2>&1; then
  echo "[$(date)] ERROR: Pre-flight 'npm test' failed. Fix the test suite before running orchestration." | tee -a "$LOG_FILE" >&2
  exit 1
fi

for task_file in "$TASK_DIR"/*.md; do
  [ -f "$task_file" ] || continue
  task_name=$(basename "$task_file")

  # Validate task_name contains only safe characters
  if [[ ! "$task_name" =~ ^[a-zA-Z0-9_.\-]+$ ]]; then
    echo "[$(date)] ERROR: Task filename contains unsafe characters: $task_name — skipping" >> "$LOG_FILE"
    continue
  fi

  echo "[$(date)] Starting: $task_name" >> "$LOG_FILE"

  # Parse files in scope from task file
  # Expects lines of the form "- path/to/file" under "## Files in Scope"
  mapfile -t scoped_files < <(
    awk '/^## Files in Scope/{found=1; next} /^##/{found=0} found && /^- /{print substr($0,3)}' \
      "$task_file"
  )

  if [ ${#scoped_files[@]} -eq 0 ]; then
    echo "[$(date)] ERROR: No files in scope parsed from $task_name — moving to failed" >> "$LOG_FILE"
    mv "$task_file" "$FAIL_DIR/"
    continue
  fi

  # Verify no scoped file falls under a protected path
  protected_patterns=("src/core/billing/" "migrations/")
  scope_violation=false
  for f in "${scoped_files[@]}"; do
    for p in "${protected_patterns[@]}"; do
      if [[ "$f" == "$p"* ]]; then
        echo "[$(date)] ERROR: Scoped file $f matches protected path $p — skipping task $task_name" >> "$LOG_FILE"
        scope_violation=true
        break 2
      fi
    done
  done

  if [ "$scope_violation" = true ]; then
    mv "$task_file" "$FAIL_DIR/"
    continue
  fi

  retries=0
  success=false

  while [ $retries -lt $MAX_RETRIES ]; do
    TASK_LOG="./tasks/logs/${task_name%.md}.out"
    mkdir -p "$(dirname "$TASK_LOG")"

    # Invoke Claude Code with task content, constrained tools, and turn limit
    # --max-turns 25 is a conservative starting point; adjust based on task complexity and token usage
    # NOTE: --allowedTools "Edit,Write,Bash" grants the agent shell execution capability.
    # Consider the security implications for your environment.
    # See the "Common Pitfalls" section for details on restricting Bash access.
    if timeout 300 claude --print \
         --allowedTools "Edit,Write,Bash" \
         --max-turns 25 \
         < "$task_file" \
         > "$TASK_LOG" \
         2>> "$LOG_FILE"; then

      # Guard: if agent produced no output, treat as failure (possible stdin delivery issue)
      if [ ! -s "$TASK_LOG" ]; then
        echo "[$(date)] WARN: claude produced no output for $task_name — possible stdin delivery failure" >> "$LOG_FILE"
      else
        # Validation gate: run tests
        # Replace 'npm test' with your project's test command
        if npm test >> "$LOG_FILE" 2>&1; then
          # Stage only files declared in the task's "Files in Scope" section
          git add -- "${scoped_files[@]}"

          # Safety check: verify no protected paths were staged
          if git diff --name-only --cached | grep -qE '^(src/core/billing|migrations)/'; then
            echo "[$(date)] ERROR: Protected files staged after git add — aborting commit for $task_name" >> "$LOG_FILE"
            git restore --staged .
            git restore .
            git clean -fd
            retries=$((retries + 1))
            echo "[$(date)] Retry $retries/$MAX_RETRIES for: $task_name (sleeping ${RETRY_DELAY}s)" >> "$LOG_FILE"
            sleep "$RETRY_DELAY"
            continue
          fi

          git commit -m "feat: complete ${task_name%.md} (automated agent run)"
          mv "$task_file" "$DONE_DIR/"
          echo "[$(date)] Completed: $task_name" >> "$LOG_FILE"
          success=true
          break
        fi
      fi
    fi

    retries=$((retries + 1))
    echo "[$(date)] Retry $retries/$MAX_RETRIES for: $task_name (sleeping ${RETRY_DELAY}s)" >> "$LOG_FILE"
    # Reset tracked and untracked files for a clean retry
    git restore .
    git clean -fd
    sleep "$RETRY_DELAY"
  done

  if [ "$success" = false ]; then
    mv "$task_file" "$FAIL_DIR/"
    echo "[$(date)] Failed after retries: $task_name" >> "$LOG_FILE"
  fi
done

echo "[$(date)] Orchestration complete." >> "$LOG_FILE"