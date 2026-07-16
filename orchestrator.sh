#!/usr/bin/env bash
set -euo pipefail

usage() {
    cat <<EOF
Usage: $0 [-n MAX_ITERATIONS]

Options:
  -n, --max-iterations N   Stop after N planning/execution cycles.
                           If omitted, runs indefinitely.
  -h, --help               Show this help.
EOF
}

MAX_ITERATIONS=0  # 0 = infinite

while [[ $# -gt 0 ]]; do
    case "$1" in
        -n|--max-iterations)
            if [[ $# -lt 2 ]]; then
                echo "Error: $1 requires a number" >&2
                exit 1
            fi
            MAX_ITERATIONS="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1" >&2
            usage >&2
            exit 1
            ;;
    esac
done

PLAN_PROMPT=$(cat <<'EOF'
Based on the HANDOVER.md, create a TASK.md outlining the next Session highest priority task with simple steps.

The last steps must always be:
1. Improve comments/documentation where appropriate.
2. Commit all changes with a meaningful commit message.
3. Update HANDOVER.md to describe the current project state and recommend the next highest-priority task.
EOF
)

EXECUTE_PROMPT=$(cat <<'EOF'
Perform the task outlined in TASK.md.
EOF
)

iteration=0

while (( MAX_ITERATIONS == 0 || iteration < MAX_ITERATIONS )); do
    ((iteration++))

    echo
    echo "=================================================="
    echo "Planning Session ($(date))"
    echo "=================================================="

    opencode run "$PLAN_PROMPT"\
        --auto \

    echo
    echo "=================================================="
    echo "Execution Session ($(date))"
    echo "=================================================="

    opencode run "$EXECUTE_PROMPT"\
        --auto \

    echo
    echo "Completed iteration $iteration."
done

echo "Reached maximum iterations ($MAX_ITERATIONS). Exiting."
