# Ops — Runbook — ForFish

> Load khi: cần deploy / build lỗi / regenerate asset tĩnh (icon, lưới độ sâu, isobath) / kiểm tra sức khỏe app trước khi push.

covers: scripts/train/run.mjs, scripts/generate-depth-grid.mjs, scripts/generate-icons.mjs, scripts/generate-isobaths.mjs, scripts/doc-health-report.sh, scripts/e2e-build.mjs, scripts/e2e-video-export.mjs
last_verified: 2026-10-19
<!-- re-verified: 2026-10-19b — thêm "Bảng môi trường" (rà Codex mục 10: "một bảng môi trường thống nhất: web domain, native origin, API, cron, DB, build ID"); đối chiếu capacitor.config.ts + android/ios capacitor.config.json (server.url), vercel.json crons, .github/workflows/{deploy,cron-prod,deploy.windows-iis,doc-health}.yml, /api/version. doc-health --ci đã chạy thật trên máy: exit 1 vì doc lệch có sẵn (forecast-accuracy 87 ngày…) — nên để workflow RIÊNG, không gộp vào `ci`. -->
ttl_days: 90
<!-- DOC-STATUS: SUSPECT (2026-10-22) — code 'scripts/train/run.mjs' doi sau last_verified. DOI CHIEU VOI CODE truoc khi tin. May quan ly dong nay, dung sua tay. -->
gate: warn
<!-- re-verified: 2026-10-19 - thêm mục "Train dự báo cá" (runner scripts/train/run.mjs, SDFISH_DATA_DIR) -->
<!-- re-verified: 2026-06-17 - lệnh regenerate asset (icons/depth-grid/isobaths) + deploy/health-check khớp scripts/ hiện tại -->
<!-- re-verified: 2026-06-29 - generate-icons.mjs đổi nguồn icon.svg→logo-src.png; lệnh `node scripts/generate-icons.mjs` không đổi, vẫn xuất public/icons -->
<!-- re-verified: 2026-09-04 - generate-depth-grid.mjs sinh lưới 6 lớp 4 bit/ô (thêm đường bờ vn-coast scanline, 8,53 MB, ~3,5–4 phút, cần mạng ETOPO ~68 MB + GEBCO 90 ô vuông); lệnh `node scripts/generate-depth-grid.mjs` không đổi. CHỈ chạy khi nguồn/luật phân lớp đổi (CLAUDE.md chống phình) — ngày chốt nguồn ghi ở đầu script; chi tiết lớp: 04-data-model §7e -->


> Viết cho người đang cuống: lệnh copy-paste được ngay. **ForFish KHÔNG có process nền** (Vercel serverless + Supabase Edge Functions) → không có start/stop daemon. "Vận hành" = build, deploy, regenerate asset, đọc registry khi nguồn ngoài chết.

**Last updated**: 2026-10-19

## Bảng môi trường — bản nào đang phục vụ ai (2026-10-19)

| Môi trường | Địa chỉ | Build từ | Deploy | Cron | DB | Mã bản đang chạy |
|---|---|---|---|---|---|---|
| **Web công ty (prod)** | `https://sdfish.sdvico.vn` | `main` của **sdvico/forfish** (remote `company`) | `.github/workflows/deploy.yml`: runner Windows tự host, PM2 `forfish` ở `C:\sdfish\forfish`, **chỉ chạy khi `ci` xanh**, ép mã hoá `public/data` + `--verify`, kiểm `/api/version` đúng commit, sai thì tráo về `forfish-prev` | `.github/workflows/cron-prod.yml` (GitHub Actions, `PROD_BASE_URL` mặc định sdfish.sdvico.vn). **Cron trong `vercel.json` KHÔNG tới đây** | Supabase `znzgugvfhgmiszqgjulk` | `GET /api/version` → `{build}` = `SDFISH_BUILD_SHA` (12 ký tự) |
| **Web Vercel CỦA LONG** | `https://forfish.vercel.app` (+ `forfish.sdvico.vn` đã thêm, **chưa verify DNS** TXT `_vercel.sdvico.vn`) | `main` của **Long-Forfun/ForFish** (remote `origin`) — dự án Vercel `forfish`, team `long-nguyens-projects` (kiểm qua Vercel MCP 2026-10-22) | Vercel tự build mỗi push `origin/main` (`VERCEL=1` ⇒ encode-data mã hoá tại chỗ); **next build chạy `tsc` cả `scripts/**/*.ts`** (vitest không bắt lỗi kiểu — 2026-10-22 suýt đỏ) | 5 cron trong `vercel.json` (sea-daily · refresh-fish · refresh-weather · archive · snapshot-prices) | **Cùng** Supabase `znzgugvfhgmiszqgjulk` | `/api/version` = `VERCEL_GIT_COMMIT_SHA`; smoke: `node scripts/smoke.mjs https://forfish.vercel.app --build <sha>` (2026-10-22: `9ea4609e`, 7/7 đạt) |
| **Web Vercel CỦA SDVICO** | `https://forfish-alpha.vercel.app` | `main` của **sdvico/forfish** (remote `company`) — dự án Vercel `hoainxms-projects/forfish`, **KHÔNG trong team Long**, Claude không redeploy được (xác minh 2026-10-22: chạy `562d36e8` = đầu `company/main`; câu "cần xác minh" ngày 2026-10-19 đã có đáp) | Vercel tự build mỗi push `company/main` | như trên | như trên | `/api/version` = `VERCEL_GIT_COMMIT_SHA` |
| **IIS thủ công** | theo `DEPLOY_BASE` máy chủ | nhánh chọn khi bấm | `.github/workflows/deploy.windows-iis.yml` (bấm tay) — `SDFISH_ENCODE_DATA=1` + `--verify` | — | như trên | `/api/version` |
| **App native iOS/Android** | vỏ Capacitor `vn.sdvico.sdfish` | — | store | — | qua web | **tải web từ `server.url = https://forfish-alpha.vercel.app/`** = deploy **của SDVICO** (capacitor.config.ts ghi rõ là CỐ Ý: cần trang `/quyen-rieng-tu` + delta sdvico; kiểm 2026-10-22: `capacitor.config.ts` + android/ios `capacitor.config.json` đều trỏ alpha). ⇒ **push `origin/main` KHÔNG tới app native**; muốn bà con trên app thấy bản mới phải đồng bộ sang `company/main` |
| **Máy dev** | `localhost:3000` | nhánh đang làm | `npm run dev` | không | `.env.local` (thiếu env ⇒ demo; production thiếu env ⇒ 503 `misconfigured`, `lib/demo-mode.ts`) | rỗng ("bản phát triển") |

⚠️ **Điểm cần chủ dự án chốt (Codex chỉ ra, ghi lại sự thật):** app native tải web từ **Vercel của sdvico** (`forfish-alpha.vercel.app`, build `company/main`), không phải web công ty `sdfish.sdvico.vn` và cũng không phải Vercel của Long (`forfish.vercel.app`, build `origin/main`) — **ba deploy, hai nguồn nhánh**. Đo 2026-10-19 hai web cùng bản `ecc6c71e`, nhưng chúng deploy bằng HAI đường riêng (Vercel tự build / runner Windows) nên có thể lệch nhau bất cứ lúc nào ⇒ người dùng app native và người dùng web công ty có thể thấy hai bản app khác nhau. Đổi `server.url` thì kho `localStorage`/IndexedDB **theo origin** sẽ trắng trên máy bà con (sổ tàu, bản đồ đã tải) — phải có đường chuyển dữ liệu trước khi đổi.

**Kiểm nhanh bản đang chạy:** `curl -s https://sdfish.sdvico.vn/api/version` · `curl -s https://forfish-alpha.vercel.app/api/version` — so với `git log -1 --format=%h company/main` / `origin/main`.
**Server sống nhưng dữ liệu có mới không:** `curl -s <web>/api/status` → `duLieu` = `tuoi` | `cu` (bản dự báo cá hoặc lưới thời tiết tính sẵn quá 36 giờ — cron hỏng?) | `khong-doc-duoc` (DB/env), kèm `ageHours` từng bản và ngày fit tham số mô hình (`model.fishBlendFittedAt`, `forecastSkillFittedAt`). Bước health check của deploy.yml in dòng này sau khi tráo bản (không chặn). Đo 2026-10-19 trên máy dev nối DB prod: cá 4,6 h, thời tiết 1,1 h ⇒ `tuoi`.

**Smoke test (rà Codex đợt 2):** `node scripts/smoke.mjs <gốc web> [--build <sha>] [--strict]` — trang chủ 200 · mã bản (khớp `--build`) · `/api/status` (ngày fit + tuổi dự báo; `cu` ⇒ CẢNH BÁO) · đầu file `/data/*` phải là `SDF2` (tide-stations `SDF1`) — dữ liệu RÕ ⇒ LỖI · `/api/fish-forecast` không chuỗi ⇒ 401. Chỉ đọc, không khoá. `deploy.yml` chạy nó sau health check (`continue-on-error`).
⚠️ **Đo thật 2026-10-19 18:2x:** `sdfish.sdvico.vn` (bản `ecc6c71e`) phát `model-params`, `vn-coast`, `tide-stations` **RÕ** (đầu file `{"v"`, `{"ty`) — bản đó build trước 866fa72a (ép `SDFISH_ENCODE_DATA=1` + `--verify`). `forfish-alpha.vercel.app` cùng bản thì ĐẠT (mã tại chỗ nhờ `VERCEL=1`). Hết khi `deploy.yml` mới lên `company/main`.
**Đo hiệu năng — JS mỗi màn (đợt 4 rà Codex, 2026-10-19).** Build production thật (`npm run build` + `node .next/standalone/server.js`), đo trong trình duyệt tổng JS **đã nén** mỗi màn tải (resource timing, cỡ 390×844). Trước = `73757759`, sau = `f4290b2c` (đã tách quản trị + bản đồ + tuyến):

| Màn | Trước | Sau | Ghi chú |
|---|---|---|---|
| `/quan-tri` | 347 KB | **289 KB (−17%)** | tab nạp khi mở (next/dynamic) |
| `/` | 456 KB | 456 KB | gồm ~284 KB **tải trước màn Bản đồ** (MapLibre 268 KB + pmtiles 16 KB) do router Next prefetch link dock `/ngu-truong` SAU khi trang mở — KHÔNG có trong HTML thô; lần tải đầu thật ~170 KB. Cố ý giữ: bấm Bản đồ mở ngay, chunk vào kho (một lần mỗi bản deploy) |
| `/ngu-truong` | 697 KB | 697 KB | màn nặng nhất (MapLibre + lớp) |
| `/tau` `/nguoi` `/tien` `/cho` | 428–446 KB | 429–447 KB | cùng phần prefetch bản đồ |

Thời gian mở đo trên localhost máy dev KHÔNG có nghĩa (vài chục ms) — số thật phải đo trên điện thoại mục tiêu khi sóng yếu (chưa làm: cần máy thật). Tách file lớn (đợt 3) chủ yếu để SỬA dễ, không giảm JS — trừ quản trị nhờ nạp theo tab.

**Sức khoẻ tài liệu:** workflow `doc-health` (riêng, KHÔNG chặn deploy) chạy mỗi PR + 08:00 thứ Hai. Chạy tay: `sh scripts/doc-health-report.sh --ci`.

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

## Train dự báo cá (PC GPU, ngoài Vercel)

Dữ liệu thô + kết quả nằm NGOÀI repo ở `$SDFISH_DATA_DIR` (PC GPU: `/mnt/c/Users/admin/sdfish-data`), không bao giờ vào git. Một cửa: `npm run train:dry` (xem DAG) → `node scripts/train/run.mjs --resume` (adapt → nhãn v2 → lưới → lưới vệ tinh → đặc trưng → eval; có cache + manifest). Chi tiết lệnh/stage: [fish-validate-positions §9.z](fish-validate-positions.md). Sao lưu: snapshot DataLake + `sdfish-data` rsync sang ổ E: (`/mnt/e/sdfish-backup/<ngày>/`, kèm `MANIFEST.txt`); vhdx WSL ở `D:\WSL\Ubuntu-24.04`, `sdfish-data` ở ổ C ngoài OneDrive. Không chạy lúc `gpu-lich` đang giữ RAM.

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

**Deploy self-host PM2 — `.github/workflows/deploy.yml` (tối ưu 2026-09-29, trước ~20 phút/lần)**: runner `self-hosted` Windows, workflow `ci` xanh trên `main` → build standalone → PM2 `forfish` ở `C:\sdfish\forfish`.
**Cổng phát hành (rà Codex 2026-10-19), ĐỪNG gỡ:**
- Kích bằng `workflow_run` của `ci` (không còn `push`): ci đỏ/huỷ ⇒ KHÔNG deploy. Checkout đúng `head_sha` ci đã gác. Bấm tay (`workflow_dispatch`) vẫn được — tự chịu trách nhiệm.
- `SDFISH_ENCODE_DATA=1` khai trong workflow + bước `encode-data.mjs --verify` trước khi đụng bản đang chạy ⇒ không bao giờ phát `public/data` bản rõ vì `.env` máy chủ thiếu cờ.
- Trước khi tráo: `robocopy` bản đang chạy sang `C:\sdfish\forfish-prev`. Sau khi tráo: `GET /api/version` phải trả đúng mã commit (`SDFISH_BUILD_SHA`) trong ~60 s; sai/không lên ⇒ tự tráo lại `forfish-prev` + job ĐỎ.
- Production thiếu env Supabase ⇒ route dữ liệu trả 503 `misconfigured` (lib/demo-mode.ts), không mở cổng. Thấy 503 này ngay sau deploy = `.env` sai.

Chỗ nhanh lên, ĐỪNG gỡ ngược:
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

## Sen Biển hỏi máy nhà (2026-10-19, ADR 0016)

Server ForFish cần, đặt ở env (Vercel / `.env` máy chủ IIS / secret `deploy.yml`):
- `FORLIFE_GW_KEY` — khoá cổng nhà, sinh trên máy GPU: `cd ~/forlife/app && node core/cli.mjs tao-khoa-cong` (in MỘT lần, băm vào `secrets.env` máy nhà, khởi động lại AI Assistant). Bản Vercel có thể bỏ khoá, dùng OIDC: thêm `sub` của project ForFish vào `FORLIFE_GW_OIDC_SUB` máy nhà (AI Assistant `ops/runbook-l3.md` §Nối ForFish).
- `CREW_CCCD_PEPPER` (đã có) — muối mã thuê bao. `FORLIFE_GW_URL` tuỳ chọn.
Thiếu ⇒ `/api/sen-bien/hoi` trả 503 `chua_noi`, Sen Biển nói câu trong máy. Thử: một câu máy không trả lời được (vd câu hỏi mở) trong thẻ Sen Biển ở màn Tàu tôi.

## Escalation — KHÔNG được tự làm

- 🔴 **Migration / RLS / schema** (`supabase/migrations/`, ref `znzgugvfhgmiszqgjulk`): KHÔNG tự apply lên remote. Dừng, hỏi user. Đi qua Supabase MCP có xác nhận.
- 🔴 **Secret/API key**: không hardcode. Kiến trúc zero-secret — chỉ env public Vercel; service key sống trong Edge Function CRM.
- 🟡 Đổi `forfish.*` key name hoặc xoá state user (debts/trips/documents): mất dữ liệu — xem [state-registry.md](state-registry.md) §4.
- Nguồn ngoài lỗi → đọc [external-services.md](external-services.md) cột "khi nó chết thì sao" TRƯỚC khi sửa code.

> Lỗi vận hành mới gặp lần đầu → thêm dòng vào runbook này CÙNG COMMIT với fix (nguyên tắc 11).

## Đối soát ghi dở dang (chợ + đồng bộ sổ, 2026-10-19)

Từ 0064 các việc nhiều bước đã là một giao dịch, nhưng nghi có bản ghi dở (dữ liệu trước 0064, sửa tay ở DB) thì chạy (chỉ đọc, qua Management API hoặc SQL editor):

```sql
select
  (select count(*) from public.market_orders  where status = 'da_huy' and restocked_at is null) as huy_chua_hoan_kho,
  (select count(*) from public.market_requests where status = 'da_dat' and order_id is null)    as yeu_cau_dat_thieu_don;
```

Khác 0 ⇒ với đơn: `select public.market_restock_order('<id>')` (idempotent); với yêu cầu: trả về `da_bao_gia` để bà con bấm lại. Đo 2026-10-19: cả hai = 0.

