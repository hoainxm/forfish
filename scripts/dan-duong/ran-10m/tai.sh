#!/usr/bin/env bash
# Tải 3 bộ độ sâu 10 m đảo/rạn Biển Đông (CC BY 4.0) về máy GPU — quyết định anh Long 2026-10-22 (Q6):
# dùng số liệu, ĐỔI TOÀN BỘ TÊN sang tiếng Việt, ghi nguồn CC BY. Dữ liệu nằm NGOÀI repo (D=~/.local/forlife/train/dan-duong/ran-10m).
#   HHU24SWDSCS  Zenodo 13852568  88 MB   đám mây điểm 29,4 M, 128 đảo (Hohai Univ., ESSD 2025)
#   SCSBathy10   Zenodo 19148819  126 MB  → 800 MB, 66 file .nc lưới 10 m + Island Name.csv
#   LGMM-SDB     Zenodo 22787173  2×779 MB lưới 10 m + khoảng tin cậy 95 %, 82 rạn
# Zenodo chậm (~100–250 KB/s): curl -C - nối tiếp; chạy trong tmux. Kiểm md5 HHU24 theo báo cáo D.
set -uo pipefail
D="${1:-$HOME/.local/forlife/train/dan-duong/ran-10m}"; mkdir -p "$D/goc" && cd "$D/goc"
log() { echo "$(date '+%F %T') $*"; }
tai() { # tên-file url
  [[ -s "$1" && -f "$1.ok" ]] && { log "đã có $1"; return 0; }
  for t in 1 2 3 4 5; do
    curl -L -C - --retry 3 --retry-delay 10 -o "$1" "$2" && { touch "$1.ok"; log "xong $1 ($(du -h "$1" | cut -f1))"; return 0; }
    log "lỗi tải $1 (lần $t) — thử lại sau 60 s"; sleep 60
  done; return 1
}
tai HHU24SWDSCS.nc "https://zenodo.org/api/records/13852568/files/HHU24SWDSCS.nc/content" || exit 1
echo "25f105a3cfc4c50eb26b6a4bf520a216  HHU24SWDSCS.nc" | md5sum -c - || { log "md5 HHU24 LỆCH — xoá tải lại"; rm -f HHU24SWDSCS.nc HHU24SWDSCS.nc.ok; exit 1; }
tai Products.zip "https://zenodo.org/api/records/19148819/files/Products.zip/content" || exit 1
[[ -d scsbathy10 ]] || { mkdir -p scsbathy10 && unzip -q -o Products.zip -d scsbathy10 && log "giải nén SCSBathy10: $(find scsbathy10 -name '*.nc' | wc -l) file .nc"; }
tai lgmm_depth_uncertainty.nc "https://zenodo.org/api/records/22787173/files/lgmm_depth_uncertainty.nc/content" || exit 1
tai lgmm_a_depth_uncertainty.nc "https://zenodo.org/api/records/22787173/files/lgmm_a_depth_uncertainty.nc/content" || log "LGMM bản a hỏng — đi tiếp với bản chính"
log "TẢI XONG: $(du -sh "$D/goc" | cut -f1)"
