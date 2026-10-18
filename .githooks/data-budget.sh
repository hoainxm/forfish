#!/bin/sh
# NGÂN SÁCH DỮ LIỆU BẢN ĐỒ — chống phình repo (chốt 2026-08-29; CLAUDE.md
# "Dữ liệu bản đồ trong git — CHỐNG PHÌNH"). Gọi từ `.githooks/commit-msg`
# với $1 = file commit message (chỗ DUY NHẤT git đưa message cho hook), để
# lối thoát `data-budget: <lý do>` thật sự chạy được.
#
#   sh .githooks/data-budget.sh <file-message>   # thoát 1 = chặn
FAIL=0
# Vì sao là hook chứ không phải quy ước: git giữ VĨNH VIỄN từng bản của mọi file
# lớn. Lúc nhận ra repo đã 500 MB thì không gỡ lại được nữa mà không viết lại
# lịch sử. Trần đặt ở chỗ còn kịp nghĩ lại.
DATA_FILE_MAX=$((20 * 1024 * 1024))   # một file
DATA_DIR_MAX=$((120 * 1024 * 1024))   # cả public/data
# Lối thoát có chủ ý: ghi `data-budget: <ly do>` vào commit message.
#
# ⚠️ ĐỪNG viết lại thành `BUDGET_WAIVER=$(grep -c ... || echo 0)` (lỗi đã dính
# 2026-08-29, mất hai lượt mới tìm ra): `grep -c` KHÔNG khớp thì in "0" NHƯNG
# THOÁT MÃ 1, nên `|| echo 0` cũng chạy ⇒ biến mang HAI dòng "0\n0" ⇒
# `[ "$X" -eq 0 ]` lỗi cú pháp ⇒ cả mục kiểm bị bỏ qua KHÔNG MỘT LỜI NÀO, file
# nào cũng lọt. Cổng hỏng im lặng còn tệ hơn không có cổng: nó cho cảm giác an
# toàn giả. `grep -q` trả đúng mã thoát và không in gì — dùng nó.
BUDGET_WAIVER=0
if [ -n "$1" ] && [ -f "$1" ] && grep -qiE '^data-budget:' "$1" 2>/dev/null; then
  BUDGET_WAIVER=1
fi

for f in $(git diff --cached --name-only --diff-filter=ACM | grep '^public/data/' || true); do
  [ -f "$f" ] || continue
  sz=$(wc -c < "$f" | tr -d ' ')
  if [ "$sz" -gt "$DATA_FILE_MAX" ] && [ "$BUDGET_WAIVER" -eq 0 ]; then
    echo "BLOCK: '$f' nang $((sz / 1024 / 1024)) MB, vuot tran 20 MB/file."
    echo "       Sinh muc nhe hon luc build thay vi commit nhieu ban (CLAUDE.md, quy tac 2),"
    echo "       hoac ghi 'data-budget: <ly do>' vao commit message neu that su can."
    FAIL=1
  fi
done

# Chi dem thu GIT PHAI GANH: file da theo doi + file moi chua bi .gitignore loai.
# KHONG dung `du -sb public/data` nua (2026-08-29): tu khi hai muc ban do nhe hon
# duoc SINH LUC BUILD vao chinh thu muc nay (scripts/derive-map-tiers.mjs, da
# .gitignore), `du` dem ca ~58 MB san pham build va chan MOI commit tren may vua
# chay `npm run build`. Loi thoat duy nhat luc do la ghi `data-budget:` — tuc la
# tu tay pha dung cai luat nay dung de bao ve.
if [ -d public/data ]; then
  DIR_SZ=$(git ls-files --cached --others --exclude-standard -- public/data 2>/dev/null \
    | while IFS= read -r f; do [ -f "$f" ] && wc -c < "$f"; done \
    | awk '{s+=$1} END {print s+0}')
  if [ -n "$DIR_SZ" ] && [ "$DIR_SZ" -gt "$DATA_DIR_MAX" ] && [ "$BUDGET_WAIVER" -eq 0 ]; then
    echo "BLOCK: public/data tong $((DIR_SZ / 1024 / 1024)) MB (phan git ganh), vuot tran 120 MB."
    echo "       Buoc tiep theo la dua du lieu nang ra Vercel Blob, khong phai noi tran."
    FAIL=1
  fi
fi


exit $FAIL
