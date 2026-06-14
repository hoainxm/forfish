#!/bin/sh
# ai-simple-version: 1.1.0 (ForFish)
# doc-health-report — đo lường nguyên tắc 12 (event-first). 3 chế độ:
#   sh scripts/doc-health-report.sh           -> report đầy đủ (exit 0)
#   sh scripts/doc-health-report.sh --ci       -> exit 1 khi doc-lag/ORPHANED/stale/broken-ref
#   sh scripts/doc-health-report.sh --status   -> regenerate docs/app-map/_generated/doc-status.md
# Self-test: sh scripts/doc-health-report.sh --self-test
# Yêu cầu: git, GNU date (Git for Windows có sẵn).

# ── CONFIG ─────────────────────────────────────────────────────────────
MIGRATIONS_DIR='supabase/migrations'
DOC_LAG_MAX_DAYS=7
CLAUDE_MD_CHAR_BUDGET=${CLAUDE_MD_CHAR_BUDGET:-20000}

NOW=$(date +%s)

read_meta() {
  CLINE=$(head -12 "$1" | grep -i '^covers:' | head -1)
  [ -n "$CLINE" ] || { echo ""; return; }
  LV=$(head -12 "$1" | grep -i '^last_verified:' | head -1 | sed 's/^[^:]*:[[:space:]]*//')
  TTL=$(head -12 "$1" | grep -i '^ttl_days:' | head -1 | sed 's/^[^:]*:[[:space:]]*//')
  LV_TS=$(date -d "$LV" +%s 2>/dev/null)
  if [ -z "$LV_TS" ]; then
    LV_TS=0
    echo "WARN: khong parse duoc last_verified '$LV' trong $1 (can GNU date). Coi nhu SUSPECT." >&2
  fi
  PATHS=$(echo "$CLINE" | sed 's/^[Cc]overs:[[:space:]]*//; s/[[:space:]]*,[[:space:]]*/,/g; s/^[[:space:]]*//; s/[[:space:]]*$//')
  echo "$PATHS|$LV_TS|${TTL:-365}"
}

doc_state() {
  META=$(read_meta "$1")
  [ -n "$META" ] || { echo "NO-COVERS|doc khong gan code (hop le cho decision/vision)|0"; return; }
  PATHS=$(echo "$META" | cut -d'|' -f1 | tr ',' ' ')
  LV_TS=$(echo "$META" | cut -d'|' -f2)
  TTL=$(echo "$META" | cut -d'|' -f3)
  EFF_TS=$LV_TS
  DOC_COMMIT=$(git log -1 --format=%H -- "$1" 2>/dev/null)
  if [ -n "$DOC_COMMIT" ]; then
    DOC_TS=$(git log -1 --format=%ct -- "$1" 2>/dev/null || echo 0)
    if [ "$DOC_TS" -gt "$EFF_TS" ]; then
      MSG=$(git show -s --format=%s "$DOC_COMMIT" 2>/dev/null)
      ATTEST=0
      case "$MSG" in re-verify\(*) ATTEST=1;; esac
      if [ "$ATTEST" -eq 0 ]; then
        CFILES=$(git show --name-only --format= "$DOC_COMMIT" 2>/dev/null)
        for p in $PATHS; do
          [ -n "$p" ] || continue
          H=$(echo "$CFILES" | while read -r c; do case "$c" in "$p"|"$p"/*) echo 1; break;; esac; done)
          [ -n "$H" ] && { ATTEST=1; break; }
        done
      fi
      [ "$ATTEST" -eq 1 ] && EFF_TS=$DOC_TS
    fi
  fi
  STATE="VERIFIED"; REASON="ok"; LAG=0
  for p in $PATHS; do
    [ -n "$p" ] || continue
    if [ ! -e "$p" ]; then echo "ORPHANED|path '$p' khong con ton tai|0"; return; fi
    CTS=$(git log -1 --format=%ct -- "$p" 2>/dev/null || echo 0)
    if [ "$CTS" -gt "$EFF_TS" ]; then
      L=$(( (NOW - CTS) / 86400 + 1 ))
      [ "$L" -gt "$LAG" ] && LAG=$L
      STATE="SUSPECT"; REASON="code '$p' doi sau last_verified"
    fi
  done
  if [ "${FAST:-0}" -ne 1 ]; then
    SYMS=$(grep -oE '`[A-Za-z_][A-Za-z0-9_]{2,}\(' "$1" 2>/dev/null | tr -d '`(' | sort -u | head -20)
    for s in $SYMS; do
      git grep -qF "$s" -- ':(exclude)*.md' ':(exclude)*.template' 2>/dev/null \
        || { STATE="SUSPECT"; REASON="symbol '$s()' khong tim thay trong repo (da xoa/rename?)"; }
    done
  fi
  if [ "$STATE" = "VERIFIED" ] && [ "$LV_TS" -gt 0 ]; then
    AGE=$(( (NOW - LV_TS) / 86400 ))
    [ "$AGE" -gt "$TTL" ] && { STATE="SUSPECT"; REASON="qua TTL (${AGE}d > ${TTL}d)"; LAG=$((AGE - TTL)); }
  fi
  echo "$STATE|$REASON|$LAG"
}

update_marker() {
  sed -i '/<!-- DOC-STATUS:/d' "$1"
  if [ "$2" = "SUSPECT" ] || [ "$2" = "ORPHANED" ]; then
    if grep -qi '^ttl_days:' "$1"; then A='^[Tt][Tt][Ll]_days:'
    elif grep -qi '^last_verified:' "$1"; then A='^[Ll]ast_verified:'
    else A='^[Cc]overs:'; fi
    sed -i "/$A/a <!-- DOC-STATUS: $2 ($(date +%Y-%m-%d)) — $3. DOI CHIEU VOI CODE truoc khi tin. May quan ly dong nay, dung sua tay. -->" "$1"
  fi
}

if [ "$1" = "--self-test" ]; then
  SELF="$0"; case "$SELF" in /*) ;; *) SELF="$(pwd)/$SELF";; esac
  T=$(mktemp -d) && OLDPWD_ST=$(pwd) && cd "$T" || exit 1
  git init -q . && git config user.email t@t.t && git config user.name t
  mkdir -p src/a src/b docs/app-map
  echo "function calcX() { return 1 }" > src/a/f.ts
  echo "export const g = 2" > src/b/g.ts
  printf '# 01 t\n> Load khi: test\ncovers: src/a, src/b\nlast_verified: %s\nttl_days: 90\n\nDung \140calcX(\140 va noi dung.\n' "$(date +%Y-%m-%d)" > docs/app-map/01-t.md
  git add -A && git commit -qm c1
  RC=0
  ST=$(doc_state docs/app-map/01-t.md 2>/dev/null | cut -d'|' -f1)
  [ "$ST" = "VERIFIED" ] && echo "PASS: multi-covers + same-day -> VERIFIED" || { echo "FAIL: mong VERIFIED, ra '$ST'"; RC=1; }
  sleep 1; echo "// change" >> src/b/g.ts; git add src/b/g.ts; git commit -qm c2
  ST=$(doc_state docs/app-map/01-t.md 2>/dev/null | cut -d'|' -f1)
  [ "$ST" = "SUSPECT" ] && echo "PASS: code doi sau verify -> SUSPECT" || { echo "FAIL: mong SUSPECT, ra '$ST'"; RC=1; }
  sleep 1; echo "ghi chu" >> docs/app-map/01-t.md; git add docs/app-map/01-t.md; git commit -qm "chore: tidy"
  ST=$(doc_state docs/app-map/01-t.md 2>/dev/null | cut -d'|' -f1)
  [ "$ST" = "SUSPECT" ] && echo "PASS: chore-commit khong launder SUSPECT" || { echo "FAIL: SUSPECT bi rua ('$ST')"; RC=1; }
  sleep 1
  sed -i "/^ttl_days:/a <!-- re-verified: $(date '+%Y-%m-%d %H:%M') - calcX van khop -->" docs/app-map/01-t.md
  git add docs/app-map/01-t.md; git commit -qm "re-verify(01-t): calcX van khop"
  ST=$(doc_state docs/app-map/01-t.md 2>/dev/null | cut -d'|' -f1)
  [ "$ST" = "VERIFIED" ] && echo "PASS: re-verify(...) -> VERIFIED" || { echo "FAIL: re-verify khong cong nhan ('$ST')"; RC=1; }
  mkdir -p src/c && echo "function helperZ() {}" > src/c/h.ts
  printf 'Dung them \140helperZ(\140 ngoai covers.\n' >> docs/app-map/01-t.md
  git add -A; git commit -qm "re-verify(01-t): them ref helperZ"
  ST=$(doc_state docs/app-map/01-t.md 2>/dev/null | cut -d'|' -f1)
  [ "$ST" = "VERIFIED" ] && echo "PASS: symbol song ngoai covers -> VERIFIED" || { echo "FAIL: SUSPECT oan shared util ('$ST')"; RC=1; }
  sed -i 's/calcX/deadFn/' docs/app-map/01-t.md && git add -A && git commit -qm "re-verify(01-t): doi ref"
  ST=$(doc_state docs/app-map/01-t.md 2>/dev/null)
  echo "$ST" | grep -q "symbol 'deadFn()'" && echo "PASS: symbol chet -> SUSPECT" || { echo "FAIL: symbol chet khong bat ($ST)"; RC=1; }
  sh "$SELF" --ci >/dev/null 2>&1
  [ $? -eq 1 ] && echo "PASS: dead symbol -> --ci exit 1" || { echo "FAIL: --ci khong fail"; RC=1; }
  FAST=1; STF=$(doc_state docs/app-map/01-t.md 2>/dev/null | cut -d'|' -f1); FAST=0
  [ "$STF" = "VERIFIED" ] && echo "PASS: --fast skip symbol scan" || { echo "FAIL: --fast van scan ('$STF')"; RC=1; }
  git rm -rq src/a && git commit -qm c4
  ST=$(doc_state docs/app-map/01-t.md 2>/dev/null | cut -d'|' -f1)
  [ "$ST" = "ORPHANED" ] && echo "PASS: covers path xoa -> ORPHANED" || { echo "FAIL: mong ORPHANED, ra '$ST'"; RC=1; }
  cd "$OLDPWD_ST" && rm -rf "$T"
  [ "$RC" -eq 0 ] && echo "self-test: ALL PASS" || echo "self-test: CO FAIL"
  exit $RC
fi

DOCS=$(git ls-files 'docs/app-map/*.md' 'docs/app-map/**/*.md' 2>/dev/null | grep -v '_generated/' | sort -u)

if [ "$1" = "--status" ]; then
  [ "$2" = "--fast" ] && FAST=1
  mkdir -p docs/app-map/_generated
  OUT=docs/app-map/_generated/doc-status.md
  {
    echo "<!-- AUTO-GENERATED by doc-health-report --status — DO NOT EDIT. Regenerate: sh scripts/doc-health-report.sh --status -->"
    echo "# Doc status — $(date +%Y-%m-%d)"
    echo ""
    echo "| Doc | Trang thai | Ly do |"
    echo "|---|---|---|"
    for doc in $DOCS; do
      DS=$(doc_state "$doc")
      echo "| $doc | $(echo "$DS" | cut -d'|' -f1) | $(echo "$DS" | cut -d'|' -f2) |"
    done
  } > "$OUT"
  # Board-only: KHÔNG chèn marker vào doc tay (tránh dirty-tree churn ở repo nhỏ).
  # Cổng đọc = doc-status.md board + /fl router; cổng ghi = covers-gate trong hook.
  echo "regenerated: $OUT"
  exit 0
fi

CI_MODE=0
if [ "$1" = "--ci" ]; then CI_MODE=1; shift; fi
CI_FAIL=0

echo "=== Doc health report — $(date +%Y-%m-%d) ==="
echo "--- Doc-lag: SUSPECT / ORPHANED ---"
SUSPECTS=""
for doc in $DOCS; do
  DS=$(doc_state "$doc")
  ST=$(echo "$DS" | cut -d'|' -f1)
  case "$ST" in
    SUSPECT|ORPHANED)
      LAG=$(echo "$DS" | cut -d'|' -f3)
      LINE="  $doc — $ST: $(echo "$DS" | cut -d'|' -f2) (lag ${LAG}d)"
      SUSPECTS="${SUSPECTS}${LINE}
"
      [ "$ST" = "ORPHANED" ] && CI_FAIL=1
      [ "$LAG" -gt "$DOC_LAG_MAX_DAYS" ] && CI_FAIL=1
      echo "$DS" | grep -q "symbol '" && CI_FAIL=1
      ;;
  esac
done
if [ -n "$SUSPECTS" ]; then printf '%s' "$SUSPECTS"; else echo "  (khong co — moi doc VERIFIED)"; fi

if [ -d docs/app-map/_generated ] && [ -d "$MIGRATIONS_DIR" ]; then
  GEN_TS=$(git log -1 --format=%ct -- docs/app-map/_generated/ 2>/dev/null)
  MIG_TS=$(git log -1 --format=%ct -- "$MIGRATIONS_DIR/" 2>/dev/null)
  if [ -n "$GEN_TS" ] && [ -n "$MIG_TS" ] && [ "$MIG_TS" -gt "$GEN_TS" ]; then
    echo "STALE: migrations moi hon _generated/ -> chay lai generator"; CI_FAIL=1
  fi
fi

if [ -f CLAUDE.md ]; then
  echo "CLAUDE.md: $(wc -c < CLAUDE.md | tr -d ' ') chars (budget $CLAUDE_MD_CHAR_BUDGET)"
fi

echo "--- App-map lint ---"
for f in $DOCS; do
  head -5 "$f" | grep -qiE 'load (khi|when)' || echo "  $f: thieu 'Load khi'"
  head -12 "$f" | grep -qi '^covers:' || echo "  $f: thieu 'covers:' (OK cho decision/vision)"
done

echo "--- Broken cross-ref ---"
BROKEN=$(git ls-files 'docs/app-map/*.md' 'docs/app-map/**/*.md' 2>/dev/null | sort -u | while read -r f; do
  DIR=$(dirname "$f")
  grep -oE '\]\(([^)#]+\.md)' "$f" | sed 's/](//' | while read -r link; do
    case "$link" in http*|/*) continue ;; esac
    [ -f "$DIR/$link" ] || echo "  $f -> $link (khong ton tai)"
  done
done)
if [ -n "$BROKEN" ]; then echo "$BROKEN"; CI_FAIL=1; fi

echo "=== Het report ==="
if [ "$CI_MODE" -eq 1 ] && [ "$CI_FAIL" -eq 1 ]; then
  echo "CI: FAIL — doc-lag/ORPHANED/stale/broken-ref (xem tren)"; exit 1
fi
exit 0
