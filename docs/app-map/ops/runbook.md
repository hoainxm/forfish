# Ops — Runbook — ForFish

> Load khi: cần deploy / build lỗi / regenerate asset tĩnh (icon, lưới độ sâu, isobath) / kiểm tra sức khỏe app trước khi push.

covers: scripts/generate-depth-grid.mjs, scripts/generate-icons.mjs, scripts/generate-isobaths.mjs, scripts/doc-health-report.sh, scripts/e2e-build.mjs, scripts/e2e-video-export.mjs
last_verified: 2026-07-30
ttl_days: 90
gate: warn
<!-- re-verified: 2026-06-17 - lệnh regenerate asset (icons/depth-grid/isobaths) + deploy/health-check khớp scripts/ hiện tại -->
<!-- re-verified: 2026-06-29 - generate-icons.mjs đổi nguồn icon.svg→logo-src.png; lệnh `node scripts/generate-icons.mjs` không đổi, vẫn xuất public/icons -->
<!-- re-verified: 2026-09-04 - generate-depth-grid.mjs sinh lưới 6 lớp 4 bit/ô (thêm đường bờ vn-coast scanline, 8,53 MB, ~3,5–4 phút, cần mạng ETOPO ~68 MB + GEBCO 90 ô vuông); lệnh `node scripts/generate-depth-grid.mjs` không đổi. CHỈ chạy khi nguồn/luật phân lớp đổi (CLAUDE.md chống phình) — ngày chốt nguồn ghi ở đầu script; chi tiết lớp: 04-data-model §7e -->


> Viết cho người đang cuống: lệnh copy-paste được ngay. **ForFish KHÔNG có process nền** (Vercel serverless + Supabase Edge Functions) → không có start/stop daemon. "Vận hành" = build, deploy, regenerate asset, đọc registry khi nguồn ngoài chết.

**Last updated**: 2026-08-18

---

## Tổng quan 30 giây

- **App**: Next.js 16 App Router, deploy Vercel (web) + PWA cài được + Capacitor-ready.
- **Chạy bằng**: serverless — không daemon, không cron tự host. API routes (`/api/storms`, `/api/fuel-price`…) chạy on-demand.
- **Phụ thuộc**: nguồn ngoài (Open-Meteo, GDACS…) — xem [external-services.md](external-services.md); state client — xem [state-registry.md](state-registry.md).

## Dev / Build / Lint

```bash
npm run dev      # http://localhost:3000
npm run build    # phải pass trước khi deploy
npm run lint
npm test         # Vitest — logic trong src/lib/
```
**Build fail thường gặp**: type error trong `src/lib/` → chạy `npm test` xem logic; hydration mismatch → check `suppressHydrationWarning` trên `<html>` (đã fix commit ae4c2fd).

## Regenerate asset tĩnh

Chỉ chạy khi đổi nguồn/tham số tương ứng; output commit vào repo.

```bash
node scripts/generate-icons.mjs        # PWA icons từ source → public/icons
node scripts/generate-depth-grid.mjs   # lưới độ sâu cho bản đồ ngư trường (Trục 1)
node scripts/generate-isobaths.mjs     # đường đẳng sâu (isobath)
```
**Output mong đợi**: file trong `public/` thay đổi. Nếu dirty tree sau generate mà không chủ đích → KHÔNG commit, revert.

## Deploy

> ⚠️ **NGUỒN VERCEL PROD = `hoainxm/forfish`** (chủ dự án chốt 2026-09-24). Prod
> chỉ đổi khi **hoainxm/main** nhận commit — sdvico/base có commit KHÔNG làm prod
> đổi. Bài học thật (signup f65803a kẹt 1 ngày): push đủ 2 repo nhưng nếu Vercel
> không auto-build từ hoainxm thì prod vẫn cũ — kiểm Deployments trên Vercel.
>
> **PUSH FLOW = 2 REPO** (sdvico + hoainxm), MỘT lệnh `git push origin main` là đủ
> vì `origin` cấu hình 2 push URL. **`base` (Long-Forfun) chỉ FETCH — KHÔNG push**
> (xem [sync-base-flow.md](sync-base-flow.md)). Nếu `git remote -v` thấy origin có
> push URL Long-Forfun → drift, gỡ:
> `git remote set-url --delete --push origin https://github.com/Long-Forfun/ForFish`.

```bash
# Web: push lên main → Vercel auto-deploy từ hoainxm/forfish.
# origin = 2 push URL (sdvico + hoainxm) → 1 lệnh ra CẢ 2 repo.
git push origin main

# PWA/native: xem ops/native-deploy.md (manifest/SW + Capacitor wrap)
```
**Verify sau deploy**: mở route từng trục (`/ngu-truong` `/gia-ca` `/van-hanh` `/giay-to`), check nguồn ngoài degrade đúng (thẻ "Thử lại", không treo).

**Deploy self-host PM2 — `.github/workflows/deploy.yml` (tối ưu 2026-09-29, trước ~20 phút/lần)**: runner `self-hosted` Windows, push `main` → build standalone → PM2 `forfish` ở `C:\sdfish\forfish`. Chỗ nhanh lên, ĐỪNG gỡ ngược:
- `checkout clean: false` — giữ `node_modules` + `.next/cache` (mặc định `git clean -ffdx` xoá cả hai ⇒ cài lại 683 MB + build lạnh mỗi lần).
- `npm ci` chỉ chạy khi hash `package-lock.json` + `node -v` đổi (dấu ở `node_modules\.deploy-lock-hash`). Nghi `node_modules` hỏng → xoá file dấu đó, lần sau cài lại sạch.
- Không `setup-node cache: npm` (runner tự host đã có `~/.npm`); `PUPPETEER_SKIP_DOWNLOAD`.
- Ráp bản mới vào `C:\sdfish\forfish-next` (stage) khi web cũ vẫn chạy; PM2 chỉ dừng lúc `robocopy /MIR` stage → live (chỉ chép file đổi). robocopy mã < 8 = thành công.
- `concurrency: deploy-prod`, **không** `cancel-in-progress` — huỷ giữa lúc tráo là web chết.
- Chuỗi trong script PowerShell giữ ASCII: `shell: powershell` (5.1) đọc file không BOM theo ANSI ⇒ chữ Việt trong `"…"` vỡ cú pháp (comment thì được).
- Việc trên máy chủ (ngoài repo): loại trừ Windows Defender cho thư mục `_work` của runner, `C:\sdfish`, `%LOCALAPPDATA%\npm-cache`.

**⚠️ PROD IIS (2026-10-05)**: `sdfish.sdvico.vn` là IIS tự host — KHÔNG có Vercel Cron và (đo được) **CHƯA có `CRON_SECRET`**. Cron cho prod chạy bằng `.github/workflows/cron-prod.yml` (sea-daily · snapshot-prices · trace-payments); đặt secret theo [deploy-windows-iis.md §7c](deploy-windows-iis.md). Đoạn dưới chỉ còn đúng cho các bản trên Vercel.
**Env + cron Vercel (2026-08-18)**: `CRON_SECRET` (env Vercel; Vercel Cron tự gắn `Authorization: Bearer`) nay bảo vệ **4** cron trong `vercel.json`: `refresh-fish` `0 2 * * *` · `refresh-weather` `30 2 * * *` · `snapshot-prices` `0 3 * * 6` · **`notify-storms` `*/30 * * * *`** (push tin bão tự động, gói F — xem [external-services](external-services.md) + [02](../02-architecture.md)). ⚠️ Số cron vượt trần Hobby (2) — plan Vercel phải cho phép, **chưa kiểm**; thiếu `CRON_SECRET` → cron trả 401, app bà con không hỏng (vẫn tự hỏi `/api/storms` khi mở). Kiểm nhanh sau deploy: `curl -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/notify-storms` → `{ok:true, storms:N, pushed:[…]}` (401 `unauthorized` · 503 `not_configured`/`vapid_not_configured`/`storms_unavailable` · 500 `query_failed`); chạy 2 lần liền mà `pushed` lần 2 vẫn có tin cùng cơn = lỗi (khử trùng 48h bằng `push_messages sent_by='system:storm'`).

## Video hướng dẫn cho bà con (quay tự động)

Bộ video dạy dùng app — quay bằng Playwright trên **build riêng**, không đụng `.next` của dev server và không đụng DB thật.

```bash
node scripts/e2e-build.mjs all     # demo → .next-e2e (cổng 3100) · auth → .next-e2e-auth (3101)
npm run e2e:videos                 # quay tất cả → test-reports/triage/e2e-output/**/video.webm
npx playwright test tests/e2e/demo/06-cai-ve-may-android.spec.ts --project=demo   # quay riêng 1 video
npm run e2e:export                 # .webm → .mp4 (phóng 3×, H.264) → test-reports/videos/
```

| Video | Nội dung |
|---|---|
| 01–03 (demo) | thời tiết biển · bản đồ ngư trường · dẫn đường tiết kiệm dầu |
| 04–05 (auth) | sổ thuyền viên (cảnh báo chéo) · giá cá & tin mua bán |
| **06 (demo)** | **Android: cài SDFish về máy từ web + dùng lúc mất sóng** |
| **07 (demo)** | **iPhone: thêm vào Màn hình chính + dùng lúc mất sóng** |

- Cỡ chữ: `E2E_DISPLAY_MODE=to|gon` (bà con cần cả 2 bộ). Địa chỉ web hiện trên thanh trình duyệt giả: `E2E_SITE_URL=<tên miền thật>`.
- 06/07 vẽ lại **vỏ máy** (thanh Chrome, hộp thoại "Cài đặt", khay Chia sẻ iOS, màn hình chính) vì đó là giao diện hệ điều hành — Playwright không quay được. App + đoạn mất sóng (`context.setOffline(true)`) là **thật**.
- **Sau khi build e2e, `tsconfig.json` bị Next chèn thêm `include` `.next-e2e/*` + format lại** → `git checkout -- tsconfig.json` trước khi commit.
- Cần `ffmpeg` trong PATH cho bước export (`winget install Gyan.FFmpeg`).

## Health check doc (nguyên tắc 12)

```bash
sh scripts/doc-health-report.sh            # báo cáo doc trôi / SUSPECT
sh scripts/doc-health-report.sh --status   # regenerate _generated/doc-status.md
sh .githooks/pre-commit --self-test        # verify hook còn parse + gate đúng
```

## Escalation — KHÔNG được tự làm

- 🔴 **Migration / RLS / schema** (`supabase/migrations/`, ref `znzgugvfhgmiszqgjulk`): KHÔNG tự apply lên remote. Dừng, hỏi user. Đi qua Supabase MCP có xác nhận.
- 🔴 **Secret/API key**: không hardcode. Kiến trúc zero-secret — chỉ env public Vercel; service key sống trong Edge Function CRM.
- 🟡 Đổi `forfish.*` key name hoặc xoá state user (debts/trips/documents): mất dữ liệu — xem [state-registry.md](state-registry.md) §4.
- Nguồn ngoài lỗi → đọc [external-services.md](external-services.md) cột "khi nó chết thì sao" TRƯỚC khi sửa code.

> Lỗi vận hành mới gặp lần đầu → thêm dòng vào runbook này CÙNG COMMIT với fix (nguyên tắc 11).
