# Ops — Runbook — ForFish

> Load khi: cần deploy / build lỗi / regenerate asset tĩnh (icon, lưới độ sâu, isobath) / kiểm tra sức khỏe app trước khi push.

covers: scripts/generate-depth-grid.mjs, scripts/generate-icons.mjs, scripts/generate-isobaths.mjs, scripts/doc-health-report.sh, scripts/e2e-build.mjs, scripts/e2e-video-export.mjs
last_verified: 2026-07-29
ttl_days: 90
gate: warn
<!-- re-verified: 2026-06-17 - lệnh regenerate asset (icons/depth-grid/isobaths) + deploy/health-check khớp scripts/ hiện tại -->


> Viết cho người đang cuống: lệnh copy-paste được ngay. **ForFish KHÔNG có process nền** (Vercel serverless + Supabase Edge Functions) → không có start/stop daemon. "Vận hành" = build, deploy, regenerate asset, đọc registry khi nguồn ngoài chết.

**Last updated**: 2026-07-29

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

```bash
# Web: push lên main → Vercel auto-deploy (repo github.com/Long-Forfun/ForFish)
git push origin main

# PWA/native: xem ops/native-deploy.md (manifest/SW + Capacitor wrap)
```
**Verify sau deploy**: mở route từng trục (`/ngu-truong` `/gia-ca` `/van-hanh` `/giay-to`), check nguồn ngoài degrade đúng (thẻ "Thử lại", không treo).

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
