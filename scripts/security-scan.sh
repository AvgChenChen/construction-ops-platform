#!/bin/sh
# Optional local security scanners. Each one is skipped with a clear message when its tool is not installed.
# Nothing here contacts a system other than the URL you pass to `zap`, and that must be local or staging.
set -eu
case "${1:-}" in
  osv)
    command -v osv-scanner >/dev/null || { echo "osv-scanner not installed (brew install osv-scanner). Skipped."; exit 0; }
    osv-scanner scan source --lockfile=package-lock.json --ignore-dev ;;
  secrets)
    command -v gitleaks >/dev/null || { echo "gitleaks not installed (brew install gitleaks). Skipped."; exit 0; }
    gitleaks git --redact --no-banner . ;;
  zap)
    target="${ZAP_TARGET_URL:-http://host.docker.internal:3000}"
    case "$target" in
      http://127.0.0.1:*|http://localhost:*|http://host.docker.internal:*|https://staging.*|https://*.staging.*) ;;
      *) echo "Refusing ZAP scan of $target: only local or staging URLs owned by Mills are allowed."; exit 1 ;;
    esac
    command -v docker >/dev/null || { echo "docker not installed. Skipped."; exit 0; }
    docker run --rm -t ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t "$target" -I ;;
  *) echo "usage: security-scan.sh osv|secrets|zap"; exit 2 ;;
esac
