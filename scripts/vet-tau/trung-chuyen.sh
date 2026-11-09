#!/bin/sh
# TRUNG CHUYỂN hằng tuần — chỉ backend GPU (anh Long 09/11: "Chạy hằng tuần"). Chạy SAU dl-day-du (CN 00:30, ~2 giờ) để có eCDT mới.
# Tài liệu: ~/fish-vet/docs/nhan-dien-tau-ais.md §5.
set -eu
cd "$HOME/fish-vet"
/home/long/.local/node/bin/node --max-old-space-size=12000 scripts/trung-chuyen.mjs
/usr/bin/python3 -I scripts/trung_chuyen_nap.py
/usr/bin/python3 -I scripts/hau_can_diem.py
