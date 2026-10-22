#!/usr/bin/env bash
# Cài / khởi động vòng dẫn đường trên gpu-desktop. Chạy TRÊN máy GPU (hoặc: ssh gpu-desktop 'bash -s' < scripts/dan-duong/cai-gpu.sh).
#   bash cai-gpu.sh [nhánh-gốc]      — chép vong.sh về ~/.local/forlife/train/dan-duong, mở tmux `dan-duong`
#   bash cai-gpu.sh --dung           — dừng tmux
#   bash cai-gpu.sh --xem            — đuôi nhật ký hôm nay
set -uo pipefail
W="$HOME/.local/forlife/train/dan-duong"; mkdir -p "$W"
export PATH="$HOME/.local/bin:$HOME/.local/node/bin:$PATH"
case "${1:-}" in
  --dung) tmux kill-session -t "=dan-duong" 2>/dev/null && echo "đã dừng" || echo "không có phiên"; exit 0;;
  --xem) tail -n 40 "$W/nhat-ky/$(date +%F).log" 2>/dev/null || echo "chưa có nhật ký hôm nay"; exit 0;;
esac
NHANH="${1:-main}"
# vong.sh lấy từ chính nhánh gốc để script luôn khớp bộ chấm trong repo
URL="${SDFISH_URL:-https://github.com/Long-Forfun/ForFish.git}"
TMP="$(mktemp -d)"; git clone -q --depth 1 --branch "$NHANH" --filter=blob:none --sparse "$URL" "$TMP/r" && git -C "$TMP/r" sparse-checkout set scripts/dan-duong -q
cp "$TMP/r/scripts/dan-duong/vong.sh" "$W/vong.sh"; chmod +x "$W/vong.sh"; rm -rf "$TMP"
# đẩy nhánh bằng bộ giữ mật khẩu đang dùng cho ~/forlife (Git Credential Manager của Windows) nếu có
GIT_CRED_HELPER="$(git -C "$HOME/forlife" config --get credential.https://github.com.helper 2>/dev/null || true)"
command -v claude >/dev/null || { echo "LỖI: thiếu claude CLI trong PATH"; exit 1; }
tmux has-session -t "=dan-duong" 2>/dev/null && { echo "đang chạy rồi — tmux attach -t =dan-duong"; exit 0; }
tmux new-session -d -s dan-duong "export DD_NHANH='$NHANH' GIT_CRED_HELPER='$GIT_CRED_HELPER' PATH='$PATH'; bash '$W/vong.sh'; echo 'vong.sh đã thoát'; sleep infinity"
echo "đã mở tmux dan-duong (nhánh gốc $NHANH). Xem: tmux attach -t =dan-duong · tail -f $W/nhat-ky/$(date +%F).log"
