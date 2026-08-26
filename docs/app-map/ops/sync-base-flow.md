# ops: Luồng SYNC BASE → sdvico + hoainxm (chuẩn tái dùng)

> Load khi: user nói "sync base", "merge base về", "kéo code mới từ Long-Forfun", "check repo base cập nhật", hoặc bất kỳ task đồng bộ code từ repo gốc Long-Forfun sang sdvico + hoainxm.

> **Kích hoạt bằng mô tả ngắn**: các cụm trên → chạy ĐÚNG luồng dưới, KHÔNG cần giải thích lại từ đầu.

## 0. Bất biến của luồng (đọc 1 lần, nhớ mãi)

- **Hướng CHỈ MỘT CHIỀU**: `base` (Long-Forfun) → `origin` (sdvico + hoainxm). CHỈ lấy commit base mà origin chưa có. **KHÔNG BAO GIỜ** đẩy ngược delta sdvico lên base.
- **Remote topology** (đã cấu hình sẵn trong repo):
  - `base` = https://github.com/Long-Forfun/ForFish (NGUỒN, fetch+push nhưng ta chỉ FETCH)
  - `origin` = 2 push URL: https://github.com/sdvico/forfish (fetch+push) + https://github.com/hoainxm/forfish (push). → **1 lần `git push origin` = đẩy CẢ 2 remote đích**.
- **origin/main và base/main LUÔN diverge thật** (không ff): sdvico có delta riêng (đại lý, thu tiền thủ công, webhook NV4/5/7, privacy, self-host); base có tính năng mới. Pattern lịch sử = sdvico định kỳ MERGE base vào rồi giữ delta.

## 1. Các bước (đã kiểm chứng 2026-08-01)

```bash
# B0 — đồng bộ + đo
git fetch base --prune && git fetch origin --prune
MB=$(git merge-base origin/main base/main)
git log --oneline origin/main..base/main      # commit base cần lấy
git merge-tree --write-tree --name-only origin/main base/main   # preview conflict THẬT

# B0.5 — an toàn: tag backup. LÀM THẲNG TRÊN main, KHÔNG tách branch
#         (chủ dự án chốt 2026-08-26 — tag backup đủ lưới an toàn; nhánh riêng
#          chỉ tổ dọn. Hỏng thì `git reset --hard backup/main-before-sync-<date>`.)
git tag backup/main-before-sync-<date> main

# B1 — merge THẲNG trên main, gỡ conflict theo §2
git merge base/main --no-commit --no-ff

# B2 — migration reconcile theo §3 (git mv renumber, git rm bản trùng)

# B3 — verify (TẤT CẢ phải xanh trước khi commit)
npx tsc --noEmit          # 0 error
npm test                  # all pass
npm run build             # success
sh .githooks/pre-commit --self-test

# B4 — commit THẲNG trên main (hook chạy nếu bật; covers-gate §4) → chờ user duyệt PUSH
git add -u && git commit -F <msg>
git push origin main      # ⚠️ irreversible, ra 2 repo công khai — CHỈ khi user duyệt
```

## 2. Nguyên tắc gỡ conflict — "GIỮ DELTA SDVICO + THÊM MỚI BASE" (union, mất-gì-cũng-không)

origin là ĐÍCH → mọi hành vi sdvico phải còn; tính năng base chồng LÊN, không đè.

| Kiểu conflict | Cách gỡ |
|---|---|
| **add/add lib** (2 bên tự tạo cùng file, vd `auth-error.ts`) | UNION export cả 2 hàm. Test cũng union + gộp helper. |
| **isDemo / sổ mẫu / seed demo** | sdvico ĐÃ BỎ (chốt 2026-07-29). Gỡ mọi `isDemo`/`demoX`/khối "tủ/lịch/sổ mẫu" base auto-merge vào; NHƯNG GIỮ feature `saveFailed` (báo máy hết chỗ) của base — ghép vào cấu trúc no-demo. |
| **2 hệ audit** (`writeAudit`→`admin_audit` sdvico vs `logActivity`→`admin_activity_log` base) | GIỮ CẢ HAI call ở mỗi site (2 trail song song, không regress). `logActivity` bọc try/catch → an toàn kể cả bảng chưa có. |
| **Mô hình quyền admin** (`admin-auth.ts`) | Theo **staff-permissions của base** (superset: admin permissions=null, manager tra `staff_permissions` per tab×action). Không mất năng lực admin-DB của sdvico. |
| **API route đụng cột** (vd `accounts/route.ts`) | UNION SELECT + union `.map` field. Coi chừng biến chỉ khai báo 1 phía (vd `adminPhones` base / `latestPay` sdvico) — thiếu là vỡ vùng non-conflict. |
| **sw.js** (🟡 offline + security) | GIỮ 2 lớp: `isPrivateApi` 503 (sdvico) + allowlist default-deny (base). Không nới cache. `node --check` sau khi gỡ. |
| **quan-tri/page.tsx** (nhiều hunk, 2 spine) | Xác định state THỰC khai báo (`tab` vs `activeTab`) rồi ép nhất quán. Spine quyền = base (permsFor/isAdmin). Union tabs + Account type. Gỡ component dead sau khi chọn. File lớn → giao subagent với khung này. |
| **Docs** (frontmatter + `<!-- re-verified -->`) | UNION comment log (không bỏ dòng nào), lấy `last_verified` MỚI NHẤT. Mâu thuẫn nội dung (demo, debts.ts) → đối chiếu SOURCE đã merge, theo trạng thái thật (sdvico đã bỏ = thắng). |

## 3. Migration reconcile (🔴 DB — KHÔNG tự apply prod)

- 2 repo **đánh số lệch** cùng migration logic → `git merge` KHÔNG nhân đôi (khác tên = file khác) nhưng base's migration MỚI sẽ **đụng SỐ** với migration sdvico.
- Xử: (a) migration base **trùng LOGIC** bản sdvico đã có → **`git rm`** (vd `0020_role_admin` = trùng `0019_admin_role`). (b) migration base **mới thật** đụng số → **`git mv` renumber** sang số trống kế tiếp của sdvico (lần này `0028-0031`). Verify `ls | sed 's/_.*//' | sort | uniq -d` = rỗng.
- Đối chiếu cột/bảng trước khi renumber (đừng thêm cột đã có). Tất cả migration base dùng `if not exists` → idempotent, an toàn.
- Update `04-data-model.md` CÙNG LÚC: số mới + đánh dấu **⚠️ CHƯA APPLY prod** (base đánh "đã apply" là theo prod BASE, không phải sdvico). Sửa mọi link `../../supabase/migrations/<số cũ>` → số mới. Coi chừng số **overload** (vd "0017" = product_inquiries sdvico ĐÃ CÓ vs staff_permissions base → 0028).
- ⚠️ Gửi FILE thôi; **user tự apply Supabase prod** (ref `znzgugvfhgmiszqgjulk`).

## 4. Cổng covers-gate (pre-commit hook)

Đổi code trong vùng `covers:` của doc nào → doc đó phải re-verify CÙNG COMMIT, nếu không hook CHẶN. Sync base hay đụng:
- `10-ba-spec-quan-tri-van-hanh.md` covers `src/app/quan-tri, src/app/api/admin, src/lib/admin-auth.ts, src/lib/admin.ts` → bump `last_verified` + thêm `<!-- re-verified: <date> — <claims> -->`.
- Fix: sửa nội dung HOẶC bump + comment, commit msg kèm `re-verify(<doc>): <claims>`.

## 5. Chốt an toàn (không thoả hiệp)

- Merge **THẲNG trên main** + tag backup (chủ dự án chốt 2026-08-26, bỏ nhánh riêng). Tag `backup/main-before-sync-<date>` là lưới: hỏng thì `git reset --hard <tag>`.
- KHÔNG `--force` lên remote chung.
- KHÔNG tự apply migration lên Supabase prod.
- Push ra 2 repo công khai = **irreversible** → chỉ khi user duyệt rõ.
- Base thường tiếp tục chạy trước origin — mỗi lần sync là 1 mạch mới từ B0.

## 6. Ghi chú vận hành máy sdvico (cập nhật 2026-08-26 — mạch sync thật)

**Topology trong clone sdvico thường THIẾU sẵn** (doc §0 tả bản đã cấu hình đủ; clone thật có thể chỉ có `origin`=sdvico, không có `base`, không có hoainxm):
- Chưa có remote `base` → `git remote add base https://github.com/Long-Forfun/ForFish` rồi `git fetch base --prune`.
- `origin` chỉ push sdvico → thêm push URL hoainxm cho dual-push (1 `git push origin` ra CẢ 2 repo):

```bash
git remote set-url --add --push origin https://github.com/sdvico/forfish
git remote set-url --add --push origin https://github.com/hoainxm/forfish
```

  ⚠️ Phải thêm CẢ dòng sdvico: khi set push URL tường minh ĐẦU TIÊN, fetch-URL thôi làm đích push — thiếu dòng sdvico thì push chỉ ra hoainxm.

**macOS — 2 script vấp shell cổ, ĐỪNG tin kết quả trên máy Mac:**
- `.githooks/pre-commit --self-test`: macOS bó `bash 3.2` → syntax error ở `case` inline trong `$(while …)`. Chạy bằng `zsh` (hoặc bash≥4 / CI) mới đúng. Hook cũng chỉ chạy khi `git config core.hooksPath .githooks` — clone mặc định KHÔNG bật, nên commit không tự chặn.
- `scripts/doc-health-report.sh --status`: viết cho GNU sed; BSD sed (macOS) làm **NÁT** bảng `doc-status.md`. ĐỪNG regenerate trên Mac — để CI/Linux làm, hoặc khi merge cứ gỡ tay lấy giá trị base (mạch này đã làm vậy).

**Mạch 2026-08-26**: lấy 10 commit "ra khơi" (plotter-readout — ô toạ độ GPS + sheet 2 nấc), 7 conflict (1 source `snap-sheet.tsx` + 6 doc frontmatter), **0 migration**. Verify tsc/test(2179)/build xanh. Merge commit = `dbbd27d`.
