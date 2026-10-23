#!/usr/bin/env bash
# VÒNG LÀM–CHẤM–LÀM DẪN ĐƯỒNG trên gpu-desktop (anh Long 22/10/2026: "tổ chức làm rồi chấm rồi làm tới đi đạt
# 90 % các tiêu chí, đưa qua máy GPU chạy phần này cho nó liên tục"). Chạy trong tmux `dan-duong` (cai-gpu.sh).
# Mỗi vòng:
#   1. fetch nhánh gốc DD_NHANH; nhánh ứng viên dan-duong/ung-vien-<ngày> (tiếp nếu đã có trên origin)
#   2. npm ci khi lockfile đổi → npm run dan-duong:cham → .dan-duong/bang-diem.json
#   3. qua cổng (≥90 % + A sạch) ⇒ ghi nhật ký, ngủ DD_NGU_QUA_CONG_PHUT, lặp (bắt hồi quy khi gốc đổi)
#   4. chon-tieu-chi.mjs chọn MỘT tiêu chí hỏng → brief → `claude -p` sửa (Sonnet; Opus khi tiêu chí đã trượt 2 lần)
#   5. npm test + chấm lại: tỉ lệ TĂNG và A không hỏng ⇒ commit + push nhánh ứng viên; không ⇒ reset, ghi "truot"
#   6. ≥90 % lần đầu ⇒ in link mở PR (KHÔNG merge — anh Long duyệt)
# Biến: DD_NHANH (main) · DD_MODEL (claude-sonnet-5-5) · DD_MODEL_MANH (claude-opus-5-5) · DD_TOI_DA_VONG_NGAY (12)
#       DD_NGHI_PHUT (10) · DD_NGU_QUA_CONG_PHUT (360) · DD_W (~/.local/forlife/train/dan-duong) · DD_MOT_VONG=1 (chạy 1 vòng rồi thoát)
set -uo pipefail
W="${DD_W:-$HOME/.local/forlife/train/dan-duong}"; R="$W/repo"
URL="${SDFISH_URL:-https://github.com/Long-Forfun/ForFish.git}"
NHANH="${DD_NHANH:-main}"; MODEL="${DD_MODEL:-claude-sonnet-5-5}"; MODEL_MANH="${DD_MODEL_MANH:-claude-opus-5-5}"
TOI_DA="${DD_TOI_DA_VONG_NGAY:-12}"; NGHI="${DD_NGHI_PHUT:-10}"; NGU_QUA="${DD_NGU_QUA_CONG_PHUT:-360}"
export PATH="$HOME/.local/bin:$HOME/.local/node/bin:$PATH"
mkdir -p "$W/nhat-ky" "$W/brief" "$W/out"
exec 9> "$W/.khoa"; flock -n 9 || { echo "đang có một vòng chạy — bỏ"; exit 0; }
log() { echo "$(date '+%F %T') $*" | tee -a "$W/nhat-ky/$(date +%F).log"; }
ghiLichSu() { # tieuChi ketQua ghi truoc sau
  printf '{"luc":"%s","tieuChi":"%s","ketQua":"%s","ghi":%s,"truoc":%s,"sau":%s,"model":"%s"}\n' \
    "$(date -Is)" "$1" "$2" "$(node -e 'console.log(JSON.stringify(process.argv[1]))' "$3")" "${4:-null}" "${5:-null}" "$MODEL_DUNG" >> "$W/lich-su.jsonl"
}
docDiem() { node -e 'const k=require(process.argv[1]);console.log(k.tiLe, k.aHong.length, k.quaCong?1:0)' "$R/.dan-duong/bang-diem.json" 2>/dev/null; }

# ── chuẩn bị clone làm việc (chỉ của vòng này, không đụng ~/ForFish hay C:\Code\ForFish) ──
if [[ ! -d "$R/.git" ]]; then
  git clone -q "$URL" "$R" || { log "LỖI clone"; exit 1; }
  git -C "$R" config user.name "dan-duong-bot (gpu-desktop)"; git -C "$R" config user.email "dan-duong@sdvico.local"
  git -C "$R" config core.hooksPath .githooks
fi
[[ -n "${GIT_CRED_HELPER:-}" ]] && git -C "$R" config credential.https://github.com.helper "$GIT_CRED_HELPER"

while :; do
  NGAY="$(date +%F)"; UNG="dan-duong/ung-vien-$NGAY"
  SO_VONG="$(grep -c "\"luc\":\"$NGAY" "$W/lich-su.jsonl" 2>/dev/null || echo 0)"
  if (( SO_VONG >= TOI_DA )); then log "đủ $TOI_DA vòng hôm nay — ngủ tới mai"; sleep 3600; continue; fi

  git -C "$R" fetch -q origin || { log "LỖI fetch — nghỉ $NGHI phút"; sleep "${NGHI}m"; continue; }
  git -C "$R" reset -q --hard; git -C "$R" clean -fdq
  if git -C "$R" show-ref -q "refs/remotes/origin/$UNG"; then
    git -C "$R" checkout -q -B "$UNG" "origin/$UNG"
    git -C "$R" merge -q --no-edit "origin/$NHANH" || { git -C "$R" merge --abort; log "LỖI merge gốc vào ứng viên — cần người"; sleep "${NGHI}m"; continue; }
  else
    # ứng viên hôm trước chưa merge thì nối tiếp từ nó, không tách nhánh mới mỗi ngày
    CU="$(git -C "$R" for-each-ref --sort=-refname --format='%(refname:short)' 'refs/remotes/origin/dan-duong/ung-vien-*' | head -1)"
    if [[ -n "$CU" ]]; then git -C "$R" checkout -q -B "$UNG" "$CU"; git -C "$R" merge -q --no-edit "origin/$NHANH" || git -C "$R" merge --abort
    else git -C "$R" checkout -q -B "$UNG" "origin/$NHANH"; fi
  fi
  LOCK_HASH="$(sha256sum "$R/package-lock.json" | cut -c1-16)"
  if [[ "$(cat "$W/.lock-hash" 2>/dev/null)" != "$LOCK_HASH" || ! -d "$R/node_modules" ]]; then
    (cd "$R" && npm ci --no-audit --no-fund -q) || { log "LỖI npm ci"; sleep "${NGHI}m"; continue; }
    echo "$LOCK_HASH" > "$W/.lock-hash"
  fi

  (cd "$R" && npm run -s dan-duong:cham > "$W/out/$NGAY-cham-truoc.log" 2>&1)
  read -r TRUOC A_TRUOC QUA <<<"$(docDiem)"
  [[ -z "${TRUOC:-}" ]] && { log "LỖI chấm không ra bảng (xem out/$NGAY-cham-truoc.log)"; sleep "${NGHI}m"; continue; }
  log "điểm hiện tại $TRUOC % · A hỏng $A_TRUOC · qua cổng $QUA · nhánh $UNG"
  if [[ "$QUA" == "1" ]]; then
    [[ -f "$W/.da-bao-qua" ]] || { log "QUA CỔNG — mở PR: https://github.com/Long-Forfun/ForFish/compare/$NHANH...$UNG?expand=1"; touch "$W/.da-bao-qua"; }
    log "giữ cổng: ngủ $NGU_QUA phút"; sleep "${NGU_QUA}m"; continue
  fi
  rm -f "$W/.da-bao-qua"

  ID="$(node "$R/scripts/dan-duong/chon-tieu-chi.mjs" "$R/.dan-duong/bang-diem.json" "$W/lich-su.jsonl" "$W/brief/$NGAY-$SO_VONG.md")"
  [[ -z "$ID" ]] && { log "không còn tiêu chí nào chọn được (mọi cái còn hỏng đã trượt 3 lần) — cần lead xem lich-su.jsonl"; sleep "${NGU_QUA}m"; continue; }
  TRUOT_N="$(node -e 'const fs=require("fs");const id=process.argv[2];let n=0;for(const l of fs.readFileSync(process.argv[1],"utf8").trim().split("\n").filter(Boolean).reverse()){const r=JSON.parse(l);if(r.tieuChi!==id)continue;if(r.ketQua==="truot")n++;else break;}console.log(n)' "$W/lich-su.jsonl" "$ID" 2>/dev/null || echo 0)"
  MODEL_DUNG="$MODEL"; (( TRUOT_N >= 2 )) && MODEL_DUNG="$MODEL_MANH"
  log "vòng $SO_VONG: sửa $ID bằng $MODEL_DUNG (đã trượt $TRUOT_N)"

  ( cd "$R" && timeout 90m claude -p --model "$MODEL_DUNG" --max-turns 80 --output-format text \
      --permission-mode acceptEdits \
      --allowedTools "Read,Edit,Write,Glob,Grep,Bash(npm test:*),Bash(npm run:*),Bash(npx vitest:*),Bash(git diff:*),Bash(git status:*),Bash(git log:*),Bash(node:*),Bash(ls:*),Bash(cat:*),Bash(sed -n:*),Bash(grep:*)" \
      < "$W/brief/$NGAY-$SO_VONG.md" > "$W/out/$NGAY-$SO_VONG-$ID.log" 2>&1 )
  RC=$?
  if grep -qiE "hết hạn mức|rate limit|usage limit|quota|not logged in|login" "$W/out/$NGAY-$SO_VONG-$ID.log" && (( RC != 0 )); then
    log "DỪNG: claude CLI báo hạn mức/đăng nhập — ngủ 2 giờ"; ghiLichSu "$ID" "loi-cli" "xem out/$NGAY-$SO_VONG-$ID.log" "$TRUOC"; sleep 2h; continue
  fi

  if ! (cd "$R" && npm test > "$W/out/$NGAY-$SO_VONG-test.log" 2>&1); then
    log "trượt $ID: npm test đỏ"; ghiLichSu "$ID" "truot" "npm test đỏ" "$TRUOC"; git -C "$R" reset -q --hard; git -C "$R" clean -fdq; sleep "${NGHI}m"; continue
  fi
  (cd "$R" && npm run -s dan-duong:cham > "$W/out/$NGAY-$SO_VONG-cham-sau.log" 2>&1)
  read -r SAU A_SAU QUA2 <<<"$(docDiem)"
  DAT_ID="$(node -e 'const k=require(process.argv[1]);console.log(k.tieuChi.find(t=>t.id===process.argv[2])?.dat?1:0)' "$R/.dan-duong/bang-diem.json" "$ID")"
  if [[ "$DAT_ID" == "1" && "$A_SAU" == "0" ]] && node -e 'process.exit(Number(process.argv[1])>Number(process.argv[2])?0:1)' "$SAU" "$TRUOC"; then
    git -C "$R" add -A
    TOM="$(tail -c 1500 "$W/out/$NGAY-$SO_VONG-$ID.log" | tr -d '\r' | sed 's/^/    /')"
    if git -C "$R" commit -q -m "feat(dẫn đường): $ID đạt — bảng điểm $TRUOC → $SAU % (vòng GPU $NGAY #$SO_VONG, $MODEL_DUNG)" -m "Tiêu chí: $(node -e 'const k=require(process.argv[1]);console.log(k.tieuChi.find(t=>t.id===process.argv[2])?.ten)' "$R/.dan-duong/bang-diem.json" "$ID")" -m "Tóm tắt của thợ:" -m "$TOM" -m "Co-Authored-By: Claude <noreply@anthropic.com>"; then
      if git -C "$R" push -q origin "HEAD:refs/heads/$UNG"; then
        log "ĐẠT $ID: $TRUOC → $SAU % — đã push $UNG"; ghiLichSu "$ID" "dat" "push $UNG" "$TRUOC" "$SAU"
        [[ "$QUA2" == "1" ]] && log "QUA CỔNG — mở PR: https://github.com/Long-Forfun/ForFish/compare/$NHANH...$UNG?expand=1"
      else log "ĐẠT $ID nhưng push hỏng — giữ commit local"; ghiLichSu "$ID" "dat-chua-push" "push hỏng" "$TRUOC" "$SAU"; fi
    else
      log "trượt $ID: pre-commit hook chặn (doc/test sync?) — xem git status"; ghiLichSu "$ID" "truot" "hook chặn" "$TRUOC" "$SAU"
      git -C "$R" reset -q --hard; git -C "$R" clean -fdq
    fi
  else
    log "trượt $ID: đạt=$DAT_ID · A hỏng=$A_SAU · $TRUOC → $SAU %"; ghiLichSu "$ID" "truot" "đạt=$DAT_ID A=$A_SAU" "$TRUOC" "$SAU"
    git -C "$R" reset -q --hard; git -C "$R" clean -fdq
  fi
  [[ "${DD_MOT_VONG:-}" == "1" ]] && exit 0
  sleep "${NGHI}m"
done
