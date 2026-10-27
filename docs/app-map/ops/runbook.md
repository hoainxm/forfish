# Ops — Runbook — ForFish

> Load khi: cần deploy / build lỗi / regenerate asset tĩnh (icon, lưới độ sâu, isobath) / kiểm tra sức khỏe app trước khi push.

covers: scripts/train/run.mjs, scripts/kairos-luat.mjs, scripts/kairos-thu.mjs, scripts/kairos-kiem.mjs, scripts/kairos-chung.mjs, scripts/generate-depth-grid.mjs, scripts/generate-icons.mjs, scripts/generate-isobaths.mjs, scripts/doc-health-report.sh, scripts/e2e-build.mjs, scripts/e2e-video-export.mjs
last_verified: 2026-10-19
<!-- re-verified: 2026-10-26e — thêm timer kairos-luat (2 bài/ngày, scripts/kairos-luat.mjs — Sen Biển tuyên truyền luật NĐ 246/2026, 14 §21e); lam-moi.sh glob scripts/kairos-* + src/lib/kairos nên tự có file mới. -->
<!-- re-verified: 2026-10-26c — kairos-thu: bước 2d đọc PDF đính kèm bằng `pdftotext` (poppler-utils, đã có /usr/bin/pdftotext trên gpu-desktop) ⇒ log "[dòng] <tên file>: N dòng tàu"; bước 5b `[dòng] gửi N dòng ⇒ nhận N` / "chưa gửi được … để lượt sau" (hàng đợi ~/.local/forlife/kairos/cho-gui-dong.json). Thiếu pdftotext ⇒ "[dòng] … pdftotext hỏng/thiếu" — `sudo apt install poppler-utils`. -->
<!-- re-verified: 2026-10-26b — kairos-thu: nguồn kieu=gov (14 §21) — log "[nguồn] gov-…: N bài, M mới (gov: K cho bà con)" + "[gov] a/b thông báo đọc được trang chi tiết · c có file đính kèm"; thử: `node scripts/kairos-thu.mjs --thu --goc --nguon=gov-gialai-van-ban,gov-gialai-snnmt-thong-bao,gov-gialai-snnmt-bien-dao`. lam-moi.sh xuất `src/lib/kairos` nên tự có chinh-sach.mjs; migration 0074 đã áp 2026-10-26. -->
<!-- re-verified: 2026-10-24e — kairos-thu: bước 2b lần ra bài gốc tin Google News (log "[bài gốc] Google News N/M"); thử: node scripts/kairos-thu.mjs --thu --goc. -->
<!-- re-verified: 2026-10-24d — thêm timer kairos-agent (10 phút, scripts/kairos-agent.mjs — 2000 agent tri thức); kairos-kiem gửi gói 25, đồng hồ 60 s. -->
<!-- re-verified: 2026-10-24c — thêm timer kairos-sen-bien (1 bài/ngày 7h–19h, scripts/kairos-sen-bien.mjs); lam-moi.sh xuất ':(glob)scripts/kairos-*' (script mới tự có, file chưa có trên main không làm hỏng lần làm mới). -->
<!-- re-verified: 2026-10-24b — kairos-thu.mjs đọc baoDuocPhep + nguồn kieu google-news/chiTinBien (thu-core.tuGoogleNews, chu-de.laChuyenBien); bài chỉ có tiêu đề không tóm tắt bằng Claude. Sự cố: nguồn Google News trả 0 bài mới liên tục ⇒ kiểm baoDuocPhep (báo đổi tên miền) hoặc Google đổi định dạng <source>. -->
<!-- re-verified: 2026-10-24 — KAIROS ĐÃ CÀI THẬT trên gpu-desktop: timer kairos-thu 15 phút + kairos-kiem 5 phút (systemd user, linger), chạy bản xuất từ origin/main ở ~/.local/forlife/kairos/app (KHÔNG từ checkout đang có người sửa), KAIROS_API_BASE=https://forfish.vercel.app (production repo Long-Forfun/ForFish — KHÔNG phải sdfish.sdvico.vn); sổ mới gan-day.json chặn tin cùng sự kiện khác báo (cung-su-kien.mjs) -->
<!-- re-verified: 2026-10-19b — thêm "Bảng môi trường" (rà Codex mục 10: "một bảng môi trường thống nhất: web domain, native origin, API, cron, DB, build ID"); đối chiếu capacitor.config.ts + android/ios capacitor.config.json (server.url), vercel.json crons, .github/workflows/{deploy,cron-prod,deploy.windows-iis,doc-health}.yml, /api/version. doc-health --ci đã chạy thật trên máy: exit 1 vì doc lệch có sẵn (forecast-accuracy 87 ngày…) — nên để workflow RIÊNG, không gộp vào `ci`. -->
ttl_days: 90
gate: warn
<!-- re-verified: 2026-10-19 - thêm mục "Train dự báo cá" (runner scripts/train/run.mjs, SDFISH_DATA_DIR) -->
<!-- re-verified: 2026-06-17 - lệnh regenerate asset (icons/depth-grid/isobaths) + deploy/health-check khớp scripts/ hiện tại -->
<!-- re-verified: 2026-06-29 - generate-icons.mjs đổi nguồn icon.svg→logo-src.png; lệnh `node scripts/generate-icons.mjs` không đổi, vẫn xuất public/icons -->
<!-- re-verified: 2026-09-04 - generate-depth-grid.mjs sinh lưới 6 lớp 4 bit/ô (thêm đường bờ vn-coast scanline, 8,53 MB, ~3,5–4 phút, cần mạng ETOPO ~68 MB + GEBCO 90 ô vuông); lệnh `node scripts/generate-depth-grid.mjs` không đổi. CHỈ chạy khi nguồn/luật phân lớp đổi (CLAUDE.md chống phình) — ngày chốt nguồn ghi ở đầu script; chi tiết lớp: 04-data-model §7e -->


> Viết cho người đang cuống: lệnh copy-paste được ngay. **ForFish KHÔNG có process nền** (Vercel serverless + Supabase Edge Functions) → không có start/stop daemon. "Vận hành" = build, deploy, regenerate asset, đọc registry khi nguồn ngoài chết.

**Last updated**: 2026-10-23

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

**Sức khoẻ tài liệu:** workflow `doc-health` (riêng, KHÔNG chặn deploy) chạy mỗi PR + 08:00 thứ Hai. Chạy tay: `sh scripts/doc-health-report.sh --ci`. Trạng thái từng doc (VERIFIED/SUSPECT/ORPHANED) chỉ ghi ở `docs/app-map/_generated/doc-status.md` — hook pre-commit sinh lại + stage file này mỗi commit (`--status --fast`), **không** chèn dòng `DOC-STATUS` vào doc nữa (bỏ 2026-10-25).

---

## Tổng quan 30 giây

- **App**: Next.js 16 App Router, deploy Vercel (web) + PWA cài được + Capacitor-ready.
- **Chạy bằng**: serverless — không daemon, không cron tự host. API routes (`/api/storms`, `/api/fuel-price`…) chạy on-demand.
- **Phụ thuộc**: nguồn ngoài (Open-Meteo, GDACS…) — xem [external-services.md](external-services.md); state client — xem [state-registry.md](state-registry.md).

## Dev / Build / Lint

> **Lint tốn ~2,6 GB RAM** (đo 2026-10-27). CI (`ci.yml`, repo private ⇒ runner ~7 GB) đặt `NODE_OPTIONS=--max-old-space-size=4096` RIÊNG cho bước Lint — thiếu là `JavaScript heap out of memory` (exit 134) từ khi lên Node 24, deploy bị bỏ qua. Máy dev thiếu RAM: chạy `NODE_OPTIONS=--max-old-space-size=4096 npm run lint`.

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
**Vùng chạy (2026-10-26)**: `vercel.json` ghim `"regions": ["icn1"]` (Seoul) cho cạnh Supabase ap-northeast-2. Kiểm: header `X-Vercel-Id` của một route `/api/*` phải có `::icn1::` (ví dụ `hkg1::icn1::…`); thấy `iad1` là vùng bị đè trong Settings → Functions của project.

**Verify sau deploy**: mở route từng trục (`/ngu-truong` `/gia-ca` `/van-hanh` `/giay-to`), check nguồn ngoài degrade đúng (thẻ "Thử lại", không treo).

**Deploy self-host PM2 — `.github/workflows/deploy.yml` (tối ưu 2026-09-29, trước ~20 phút/lần)**: runner `self-hosted` Windows, workflow `ci` xanh trên `main` → build standalone → PM2 `forfish` ở `C:\sdfish\forfish`.
**Cổng phát hành (rà Codex 2026-10-19), ĐỪNG gỡ:**
- Kích bằng `workflow_run` của `ci` (không còn `push`): ci đỏ/huỷ ⇒ KHÔNG deploy. Checkout đúng `head_sha` ci đã gác. Bấm tay (`workflow_dispatch`) vẫn được — tự chịu trách nhiệm.
- `SDFISH_ENCODE_DATA=1` khai trong workflow + bước `encode-data.mjs --verify` trước khi đụng bản đang chạy ⇒ không bao giờ phát `public/data` bản rõ vì `.env` máy chủ thiếu cờ.
- Trước khi tráo: `robocopy` bản đang chạy sang `C:\sdfish\forfish-prev`. Sau khi tráo: `GET /api/version` phải trả đúng mã commit (`SDFISH_BUILD_SHA`) trong ~60 s; sai/không lên ⇒ tự tráo lại `forfish-prev` + job ĐỎ.
- Mã mong đợi lấy thẳng từ env `SDFISH_BUILD_SHA`, KHÔNG gọi `git` (2026-10-26): runner báo `fatal: detected dubious ownership` (workspace khác chủ với user chạy runner) ⇒ `git rev-parse` rỗng ⇒ bản mới chạy ĐÚNG vẫn bị rollback (`ba3c6f60`/`b9eee877`/`c3e12c60`, prod kẹt `562d36e8`). Env rỗng ⇒ job đỏ (không để `StartsWith("")` cho mọi bản qua). Bước nào sau `checkout` cần git trên runner thì phải tự `git config --global --add safe.directory <workspace>` trước.
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

## Kairos — máy thu tin + agent kiểm duyệt trên gpu-desktop (2026-10-23)

> **ĐÃ CÀI 2026-10-24** trên gpu-desktop (xem mục "Bản chạy" cuối phần này). Phần dưới giữ làm hướng dẫn cài lại. Trước đó: chỉ hướng dẫn — chưa cài. Người cài làm tay trên gpu-desktop sau khi nhánh Kairos lên main và migration 0065 đã được anh Long duyệt + áp. Spec: [14 §9 + A17](../14-ba-spec-kairos.md); đồng hồ + lùi: [external-services.md › Kairos](external-services.md).

Hai việc, cùng khuôn gọi `claude -p` bằng **gói Claude của anh Long** (không API key):

| Việc | Script | Nhịp | Làm gì |
|---|---|---|---|
| Thu tin | `scripts/kairos-thu.mjs` | 15 phút | RSS 27 nguồn ⇒ chặn trùng ⇒ tóm tắt lô 20 ⇒ `POST /api/kairos/nhap` |
| Kiểm duyệt | `scripts/kairos-kiem.mjs` | 5 phút | hàng chờ ⇒ luật cứng chủ quyền + mô hình chấm ⇒ `POST /api/kairos/kiem`; cuối lượt `DELETE /api/kairos/kiem?scope=media` dọn ảnh mồ côi >24 giờ (không cần Claude — log `[ảnh]`) |

Hai script chỉ dùng thư viện có sẵn của Node (≥20) + file `.mjs` trong repo — **không cần `node_modules`** (bản trong `C:\Code\ForFish` là bản Windows, không chạy được trong WSL — không sao). Chạy thẳng từ `~/ForFish` (symlink tới checkout Windows — đừng clone thêm).

**1. Tệp env ngoài repo** — `~/.config/forlife/kairos.env`, `chmod 600`:

```bash
KAIROS_INGEST_KEY=<cùng giá trị ô "Khoá nhập tin Kairos" ở /quan-tri › Hệ thống>
KAIROS_API_BASE=https://<miền app, không có / cuối>
# tuỳ chọn:
# KAIROS_STATE_DIR=/home/long/.local/forlife/kairos   # sổ chặn trùng + hàng đợi gửi lại + thư mục rỗng cho claude
# KAIROS_MODEL=claude-haiku-5-5                       # CLI không nhận ⇒ tự lùi "haiku"
# CLAUDE_BIN=/home/long/.local/bin/claude
```

Khoá: /quan-tri › Hệ thống › **Khoá nhập tin Kairos** › Tạo ngẫu nhiên › Lưu, rồi dán CÙNG giá trị vào tệp trên. Env `KAIROS_INGEST_KEY` ở Vercel (nếu đặt) ĐÈ ô đó — đổi khoá thì đổi cả hai chỗ. Script đọc lại tệp mỗi lượt, không cần khởi động lại.

**2. Kiểm tay trước khi cài timer**

```bash
node ~/ForFish/scripts/kairos-thu.mjs --thu              # đọc RSS thật, in 15 bài đầu; KHÔNG gọi claude, KHÔNG gửi, KHÔNG ghi sổ
echo 'Trả lời đúng một chữ: ok' | claude -p --model claude-haiku-5-5 --output-format json --max-turns 1   # gói Claude còn đăng nhập?
node ~/ForFish/scripts/kairos-kiem.mjs --thu             # cần khoá: đọc hàng chờ, in prompt lô đầu, KHÔNG gửi
```

**3. Unit systemd user** — `~/.config/systemd/user/kairos-thu.service`:

```ini
[Unit]
Description=Kairos — thu tin bao (SDFish)
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/env node %h/ForFish/scripts/kairos-thu.mjs
TimeoutStartSec=14min
Nice=10
```

`~/.config/systemd/user/kairos-thu.timer`:

```ini
[Unit]
Description=Kairos — thu tin bao moi 15 phut

[Timer]
OnBootSec=3min
OnUnitActiveSec=15min
RandomizedDelaySec=60
Persistent=true

[Install]
WantedBy=timers.target
```

`kairos-kiem.service` / `kairos-kiem.timer`: chép hai tệp trên, đổi tên script thành `kairos-kiem.mjs`, `TimeoutStartSec=20min` (100 mục × lô 20 × tối đa 120 s), `OnUnitActiveSec=5min`. Dịch vụ `oneshot` đang chạy thì timer không bật chồng lượt thứ hai.

```bash
loginctl enable-linger "$USER"        # timer chạy cả khi không ai đăng nhập (WSL: cần systemd=true trong /etc/wsl.conf và WSL còn chạy)
systemctl --user daemon-reload
systemctl --user enable --now kairos-thu.timer kairos-kiem.timer
systemctl --user list-timers 'kairos-*'
journalctl --user -u kairos-thu -n 50 --no-pager      # mỗi nguồn một dòng + [chọn] [tóm tắt] [gửi]
journalctl --user -u kairos-kiem -n 50 --no-pager     # [hàng chờ] [kết luận] [gửi]
systemctl --user disable --now kairos-thu.timer kairos-kiem.timer   # tạm dừng
```

**3b. Bản chạy thật (2026-10-24)** — unit gọi `/home/long/.local/node/bin/node` (Node không nằm trên PATH WSL) và chạy script từ `~/.local/forlife/kairos/app`: bản xuất `git archive origin/main` (scripts/kairos-*.mjs + kairos-nguon.json + src/lib/kairos) từ `/mnt/c/Code/ForFish/.git`, `kairos-thu.service` làm mới ở ExecStartPre (hỏng thì chạy bản cũ). Không chạy từ checkout có người đang sửa dở. `KAIROS_API_BASE=https://forfish.vercel.app`. Sổ `gan-day.json` (≤3000 mục, 48 giờ) là vân tay bài đã gửi — bài báo khác cùng sự kiện bị bỏ (`[trùng sự kiện] bỏ N bài`).

**3c. Sen Biển giới thiệu (2026-10-24)** — `kairos-sen-bien.service` (ExecStartPre lam-moi.sh, `node …/app/scripts/kairos-sen-bien.mjs`) + `kairos-sen-bien.timer` (`OnCalendar=*-*-* 07:00:00`, `RandomizedDelaySec=12h`, `Persistent=true`). Thử: `node scripts/kairos-sen-bien.mjs --thu` (gọi Claude, KHÔNG đăng). 503 `no_sen_bien_profile` ⇒ migration 0068 chưa áp. 429 ⇒ đã đủ 2 bài/20 giờ, bỏ lượt (mã 0).

**3d. 2000 agent tri thức (2026-10-24)** — `kairos-agent.service` (ExecStartPre lam-moi.sh, `node …/app/scripts/kairos-agent.mjs`, TimeoutStartSec 8min) + `kairos-agent.timer` (`OnBootSec=7min`, `OnUnitActiveSec=10min`, `RandomizedDelaySec=90`). Thử: `node scripts/kairos-agent.mjs --thu` (đọc dòng tin + gọi Claude, KHÔNG đăng). Log `[gửi] N/M việc nhận · bỏ {…}`: `tran_doi`/`tran_agent` = đủ trần ngày (bình thường), `no_profile` = tên agent trùng bà con thật (agent đó nghỉ). Tắt cả đội: `systemctl --user disable --now kairos-agent.timer`.

**3f. SDVICO trực khách (2026-10-25, 14 §3.14)** — `kairos-truc.service` (KHÔNG lam-moi: dùng bản app do timer agent làm mới mỗi 10 phút — `lam-moi.sh` từ 2026-10-25 chép thêm `src/lib/sdvico/tu-van.mjs`, bản sao lưu `lam-moi.sh.bak-2026-10-25`; `node …/app/scripts/kairos-truc.mjs`, TimeoutStartSec 4min, Nice 5) + `kairos-truc.timer` (`OnBootSec=3min`, `OnUnitActiveSec=1min`). Không có hội thoại chờ ⇒ thoát ngay, không gọi Claude. Mô hình `KAIROS_TRUC_MODEL` (mặc định claude-sonnet-5-5) trong `~/.config/forlife/kairos.env` hoặc env service. Thử: `node scripts/kairos-truc.mjs --thu` (lấy + viết, KHÔNG gửi). Log `[trực] <id>: đã trả lời · LẬP PHIẾU cho KD` / `bỏ (422 co_gia)` = lời bị máy chủ chặn (lượt sau viết lại). Tắt: `systemctl --user disable --now kairos-truc.timer`.

**3g. Nguồn gov — tab Chính sách (2026-10-26, 14 §21)** — mae.gov.vn trả header HTTP sai chuẩn ⇒ fetch của Node báo "Response does not match the HTTP/1.1 protocol"; máy thu tự lùi về `curl` (cả trang lẫn PDF; curl có sẵn trên gpu-desktop). Nguồn `docTruoc` (Bộ) đọc trang chi tiết rồi mới lọc, tiêu đề chỉ số hiệu được ghép "trích yếu (số hiệu)". không timer mới: `kairos-thu` đọc thêm 3 nguồn `kieu: "gov"` (gialai.gov.vn danh mục văn bản + 2 RSS Sở NN&MT Gia Lai) trong cùng lượt 15 phút. Thử không gửi: `node scripts/kairos-thu.mjs --thu --goc --nguon=gov-gialai-van-ban,gov-gialai-snnmt-thong-bao,gov-gialai-snnmt-bien-dao` (`--goc` để tải cả trang chi tiết: dòng in `· N file đính kèm`). Log `(gov: K cho bà con)` = số bài qua lưới từ khoá; `[gov] a/b … c có file đính kèm`. Máy chủ trả 400 kèm nhiều `invalid` ⇒ máy thu đang gửi bài section chinh-sach từ host không phải gov (sửa kairos-nguon.json). Cột `attachments` chưa có (0074 chưa áp) ⇒ `/api/kairos/feed` lỗi 500 — áp migration trước khi deploy. **Tra cứu danh sách (14 §21b)**: PDF đính kèm ⇒ `pdftotext -layout` (poppler-utils) ⇒ `[dòng] <file>: N dòng tàu` ⇒ sau /nhap gửi `PUT /api/kairos/dinh-kem` (`[dòng] gửi N ⇒ nhận N`); bài chưa vào kho (404) thì nằm ở `cho-gui-dong.json` chờ lượt sau; bảng 0075 chưa áp ⇒ 503 cũng nằm chờ.

**3h. Sen Biển tuyên truyền luật (2026-10-26, 14 §21e)** — `kairos-luat.service` (ExecStartPre lam-moi.sh, `node …/app/scripts/kairos-luat.mjs`) + `kairos-luat.timer` (`OnCalendar=*-*-* 08,16:00:00`, `RandomizedDelaySec=2h`, `Persistent=true` — 2 bài/ngày sáng chiều). Đi theo thứ tự kho `tuyen-truyen-luat.MUC` (37 mục, không lặp 45 ngày), sổ `luat.json` trong `KAIROS_STATE_DIR`. Thử: `node scripts/kairos-luat.mjs --thu` (gọi Claude, KHÔNG đăng) · `--thu --muc=d21-k2-a` xem một mục. Log `[claude] giải thích không qua kiểm (sai_so_tien)` = Claude nhắc mức tiền không có trong trích ⇒ dùng bản mẫu (bình thường). 400 `thieu_trich` = bản app trên GPU lệch bản máy chủ (kho khác nhau) ⇒ chạy lam-moi/deploy cho khớp. 429 ⇒ đã đủ 4 bài Sen Biển/20 giờ, bỏ lượt (mã 0). Tắt: `systemctl --user disable --now kairos-luat.timer`. Unit mẫu: chép `kairos-sen-bien.service/.timer` đổi tên + OnCalendar.

**4. Sự cố**

| Thấy | Nghĩa | Làm |
|---|---|---|
| Tab quản trị Kairos: "Đã N giờ không có bài báo mới" | máy thu không chạy / không gửi được | `systemctl --user status kairos-thu.timer`, đọc `journalctl` |
| `thiếu cấu hình: KAIROS_INGEST_KEY…` (mã 2) | tệp env thiếu / sai đường | sửa `~/.config/forlife/kairos.env` |
| `[gửi] hỏng (401)` | khoá lệch giữa máy GPU và app | dán lại khoá (bước 1); bài nằm ở `cho-gui.json`, lượt sau tự gửi |
| `[gửi] hỏng (503)` | app chưa đặt khoá hoặc kho chưa cấu hình (0065 chưa áp) | đặt khoá ở /quan-tri; KHÔNG tự áp migration |
| `[claude] dừng gọi cả lượt: het_han_muc` | hết hạn mức gói | không làm gì: tin vẫn lên bằng mô tả RSS; bài báo chờ agent tới khi có hạn mức lại |
| `chua_dang_nhap` | CLI mất đăng nhập | `claude` rồi `/login` trên máy GPU |
| Bài báo không lên dòng tin dù máy thu chạy | agent kiểm duyệt không chạy (bài báo chỉ lên khi `dat`) | xem `journalctl --user -u kairos-kiem`. Tab Kairos › Hàng chờ chỉ có bài agent ĐÃ nghi/chặn — bài chưa chấm phải chờ agent chạy lại |
| Một nguồn chết lâu | báo đổi đường RSS | sửa `scripts/kairos-nguon.json` (đừng xoá id — đặt `enabled: false`), kiểm bằng `--thu --nguon=<id>` |

## Tàu xung quanh — máy thu AIS trên gpu-desktop (2026-10-26)

> **ĐÃ CÀI 2026-10-26** (bản tay `app-dev`, timer chưa bật tới khi nhánh lên main + khoá đặt). Máy thu mở web nguồn bằng Chromium thật có màn hình ảo, đọc ô dữ liệu, đẩy lên `POST /api/tau-ais/nhap`. Nguồn + đồng hồ: [external-services.md › Tàu xung quanh](external-services.md).

1. **Khoá**: /quan-tri › Hệ thống › **Khoá máy thu tàu AIS** › Tạo ngẫu nhiên › Lưu — hoặc env `TAU_AIS_KEY` ở Vercel (ĐÈ ô DB). Dán CÙNG giá trị vào `~/.config/forlife/tau-ais.env`:
   ```
   TAU_AIS_KEY=<khoá>
   TAU_AIS_API_BASE=https://forfish.vercel.app
   # tuỳ chọn: MT_EMAIL=… MT_PASSWORD=… (đăng nhập nguồn; khách vẫn đủ tàu)
   ```
2. **Thư mục** `~/.local/forlife/tau-ais/`: `app` → symlink bản chạy (`app-dev` cài tay 26/10; `lam-moi.sh` tự xuất `scripts/tau-ais-thu.mjs` + `src/lib/tau-ais/chuan-hoa.mjs` từ origin/main của `C:\Code\ForFish` khi có) · `node_modules` → `~/ForFish/node_modules` (playwright 1.62 + chromium đã cài) · `profile/` hồ sơ Chromium (xoá là làm lại từ đầu, vô hại) · `lan-cuoi.json` kết quả lượt cuối · `man-hinh.png` khi chạy `--anh`.
3. **Unit** `~/.config/systemd/user/tau-ais-thu.{service,timer}` (ExecStart `xvfb-run -a node app/scripts/tau-ais-thu.mjs`, 10 phút, TimeoutStartSec 8 phút). Bật: `systemctl --user enable --now tau-ais-thu.timer`. Xem: `journalctl --user -u tau-ais-thu -n 30`.
4. **Chạy thử không gửi**: `cd ~/.local/forlife/tau-ais && xvfb-run -a node app/scripts/tau-ais-thu.mjs --thu` → dòng `42 ô (0 hỏng) · N hàng ⇒ M tàu (cá K) · 21 s` + cỡ bản (đo 26/10: ~16 nghìn tàu, ~1 MB, gzip nhỏ hơn nhiều).
5. **Kiểm đầu app**: `curl -s -H "x-device-token: …" https://forfish.vercel.app/api/tau-ais | head -c 300` (cần chuỗi thiết bị — middleware gác) → `{"v":1,"luc":…,"soTau":…}`; 404 `chua_co` = máy thu chưa gửi lần nào.

| Triệu chứng (journal) | Nguyên nhân | Làm gì |
|---|---|---|
| `thiếu cấu hình … TAU_AIS_KEY` (mã 2) | tệp env thiếu | sửa `~/.config/forlife/tau-ais.env` |
| `bị chặn 403 ngay trang chủ` / `ô x/y bị chặn 403` | Cloudflare chặn hồ sơ (headless, hay bị đánh dấu) | không làm gì: lượt sau tự xoá `profile/`; vẫn 403 nhiều lượt ⇒ IP bị chặn, đổi mạng/đợi |
| `gửi hỏng: HTTP 401 bad_key` | khoá lệch máy GPU ↔ app | dán lại khoá (bước 1) |
| `gửi hỏng: HTTP 503 not_configured` | app chưa có khoá (DB lẫn env) | đặt khoá ở /quan-tri hoặc env Vercel |
| `không có tàu nào — nguồn đổi định dạng?` | trang nguồn đổi URL/định dạng ô | chạy `--thu --anh`, soi `man-hinh.png`, sửa `TRANG_MO`/URL ô trong script |
| Lớp trong app nói "bản lúc" cũ nhiều giờ | timer chết / lượt nào cũng hỏng | `systemctl --user status tau-ais-thu.timer`, journal |

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

