# Ops — Runbook — ForFish

> Load khi: cần deploy / build lỗi / regenerate asset tĩnh (icon, lưới độ sâu, isobath) / kiểm tra sức khỏe app trước khi push.

covers: scripts/train/run.mjs, scripts/kairos-luat.mjs, scripts/kairos-thu.mjs, scripts/kairos-kiem.mjs, scripts/kairos-chung.mjs, scripts/generate-depth-grid.mjs, scripts/generate-icons.mjs, scripts/generate-isobaths.mjs, scripts/doc-health-report.sh, scripts/e2e-build.mjs, scripts/e2e-video-export.mjs, scripts/thoi-tiet-thu.mjs, scripts/o-ban-do-thu.mjs
last_verified: 2026-10-30
<!-- re-verified: 2026-10-30 — Kairos đổi sang Gemma qua Ollama (mục env + bước kiểm tay); log `[AI]` thay `[claude]`, thêm `[gemma] Ollama không trả lời … — thử Claude`. -->
<!-- re-verified: 2026-10-29 — đọc `scripts/e2e-video-export.mjs` + `package.json` (e2e:export) + `playwright.config.ts` (outputDir, viewport 402×874, cổng 3100/3101) + `tests/e2e/{demo,auth}`: lệnh và bảng video khớp; bổ sung mục Video — xuất riêng một video bằng `npm run e2e:export -- 06`, tên file .mp4 theo số (`1-thoi-tiet-bien.mp4`…), thông số ffmpeg (3× lanczos = 1206×2622, 30 khung/giây, CRF 20, faststart, bỏ tiếng), vì sao không quay thẳng ở 3×, và hai lỗi dừng sớm (chưa quay / thiếu ffmpeg). -->
<!-- re-verified: 2026-10-29 — kairos-thu sau 2026-10-19: nguồn `kieu=gov` (Bộ NN&MT + 15 tỉnh/thành, cờ `docTruoc` đọc trang chi tiết trước khi lọc), bỏ văn bản trước mốc `CHINH_SACH_TU_ISO` 01/01/2026, luôn gửi `attachments` (sửa 503); kairos-kiem thêm đối chiếu danh sách tên miền lừa đảo (ghi vào bảng timer). Lệnh `--thu` ở mục 2 vẫn đúng. -->
<!-- re-verified: 2026-10-26e — thêm timer kairos-luat (2 bài/ngày, scripts/kairos-luat.mjs — Sen Biển tuyên truyền luật NĐ 246/2026, 14 §21e); lam-moi.sh glob scripts/kairos-* + src/lib/kairos nên tự có file mới. -->
<!-- re-verified: 2026-10-26c — kairos-thu: bước 2d đọc PDF đính kèm bằng `pdftotext` (poppler-utils, đã có /usr/bin/pdftotext trên gpu-desktop) ⇒ log "[dòng] <tên file>: N dòng tàu"; bước 5b `[dòng] gửi N dòng ⇒ nhận N` / "chưa gửi được … để lượt sau" (hàng đợi ~/.local/forlife/kairos/cho-gui-dong.json). Thiếu pdftotext ⇒ "[dòng] … pdftotext hỏng/thiếu" — `sudo apt install poppler-utils`. -->
<!-- re-verified: 2026-10-26b — kairos-thu: nguồn kieu=gov (14 §21) — log "[nguồn] gov-…: N bài, M mới (gov: K cho bà con)" + "[gov] a/b thông báo đọc được trang chi tiết · c có file đính kèm"; thử: `node scripts/kairos-thu.mjs --thu --goc --nguon=gov-gialai-van-ban,gov-gialai-snnmt-thong-bao,gov-gialai-snnmt-bien-dao`. lam-moi.sh xuất `src/lib/kairos` nên tự có chinh-sach.mjs; migration 0074 đã áp 2026-10-26. -->
<!-- re-verified: 2026-10-24e — kairos-thu: bước 2b lần ra bài gốc tin Google News (log "[bài gốc] Google News N/M"); thử: node scripts/kairos-thu.mjs --thu --goc. -->
<!-- re-verified: 2026-10-24d — thêm timer kairos-agent (10 phút, scripts/kairos-agent.mjs — 2000 agent tri thức); kairos-kiem gửi gói 25, đồng hồ 60 s. -->
<!-- re-verified: 2026-10-31 — thêm timer kairos-trien-khai (3i): tin triển khai SDVICO từ ảnh nhóm Zalo, tự đăng trừ bài nhạy cảm. -->
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
| **Web Vercel CỦA SDVICO** (⚠️ 2026-10-27 đo: **503 DEPLOYMENT_PAUSED** — project bị tạm dừng; không còn ai dùng sau khi app native chuyển sang web công ty) | `https://forfish-alpha.vercel.app` | `main` của **sdvico/forfish** (remote `company`) — dự án Vercel `hoainxms-projects/forfish`, **KHÔNG trong team Long**, Claude không redeploy được (xác minh 2026-10-22: chạy `562d36e8` = đầu `company/main`; câu "cần xác minh" ngày 2026-10-19 đã có đáp) | Vercel tự build mỗi push `company/main` | như trên | như trên | `/api/version` = `VERCEL_GIT_COMMIT_SHA` |
| **IIS thủ công** | theo `DEPLOY_BASE` máy chủ | nhánh chọn khi bấm | `.github/workflows/deploy.windows-iis.yml` (bấm tay) — `SDFISH_ENCODE_DATA=1` + `--verify` | — | như trên | `/api/version` |
| **App native iOS/Android** | vỏ Capacitor `vn.sdvico.sdfish` | — | store (`android-release.yml`, chỉ chạy ở sdvico/forfish) | — | qua web | **tải web từ `server.url = https://sdfish.sdvico.vn/`** = **web công ty** (đổi 2026-10-27, anh Long — trước trỏ `forfish-alpha.vercel.app`, nay alpha 503 tạm dừng ⇒ app mở ra lỗi). Cùng nguồn nhánh `company/main` như trước. URL nằm TRONG binary ⇒ phải phát hành AAB mới thì máy bà con mới đổi; workflow nay **đỏ** nếu config sinh ra không trỏ `https://sdfish.sdvico.vn/` hoặc trang chủ / `/quyen-rieng-tu` không trả 200. ⇒ **push `origin/main` KHÔNG tới app native**; muốn bà con trên app thấy bản mới phải đồng bộ sang `company/main` |
| **Máy dev** | `localhost:3000` | nhánh đang làm | `npm run dev` | không | `.env.local` (thiếu env ⇒ demo; production thiếu env ⇒ 503 `misconfigured`, `lib/demo-mode.ts`) | rỗng ("bản phát triển") |

✅ **ĐÃ CHỐT 2026-10-27 (anh Long: "Đổi capacitor.config server.url sang https://sdfish.sdvico.vn")** — app native tải web công ty, còn HAI deploy (web công ty + Vercel của Long). Phần dưới là bối cảnh cũ. ⚠️ Hệ quả đã biết khi đổi: kho máy theo origin nên bản app mới mở ra trống phần chỉ-trong-máy (sổ đã đồng bộ về lại khi đăng nhập; bản đồ phải tải lại) — chấp nhận vì alpha đã chết, bà con vốn không mở được. Bối cảnh cũ: app native tải web từ **Vercel của sdvico** (`forfish-alpha.vercel.app`, build `company/main`), không phải web công ty `sdfish.sdvico.vn` và cũng không phải Vercel của Long (`forfish.vercel.app`, build `origin/main`) — **ba deploy, hai nguồn nhánh**. Đo 2026-10-19 hai web cùng bản `ecc6c71e`, nhưng chúng deploy bằng HAI đường riêng (Vercel tự build / runner Windows) nên có thể lệch nhau bất cứ lúc nào ⇒ người dùng app native và người dùng web công ty có thể thấy hai bản app khác nhau. Đổi `server.url` thì kho `localStorage`/IndexedDB **theo origin** sẽ trắng trên máy bà con (sổ tàu, bản đồ đã tải) — phải có đường chuyển dữ liệu trước khi đổi.

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
- **Cổng dò lần lượt (2026-10-26)**: `PORT` của GitHub → `PORT` trong `C:\sdfish\forfish\.env` → `.env.production` → 3000 (phòng hờ: PM2 chạy app theo `.env` máy chủ, GitHub có thể thiếu `PORT`). Cổng trúng ghi `HEALTH_PORT` cho smoke test; smoke test cũng lấy mã từ `SDFISH_BUILD_SHA`, KHÔNG gọi `git` (cùng lỗi dubious ownership). **Đỏ thì log in sẵn chẩn đoán**: từng cổng đã thử + kết quả (mã bản nhận được / lỗi kết nối), `pm2 describe forfish`, 40 dòng `pm2 logs` — đọc mấy dòng đó trước khi đoán.
- Production thiếu env Supabase ⇒ route dữ liệu trả 503 `misconfigured` (lib/demo-mode.ts), không mở cổng. Thấy 503 này ngay sau deploy = `.env` sai.

Chỗ nhanh lên, ĐỪNG gỡ ngược:
- `checkout clean: false` — giữ `node_modules` + `.next/cache` (mặc định `git clean -ffdx` xoá cả hai ⇒ cài lại 683 MB + build lạnh mỗi lần).
- **Dọn kho git mỗi lần deploy** (bước `Clean old git packs`, 2026-11-05): `clean: false` giữ cả `.git`, mà checkout `fetch-depth: 1` kéo trọn ảnh chụp commit thành **một pack ~90 MB mới mỗi lần** (shallow không dùng lại pack cũ) ⇒ runner đầy 9,3 GB (`.git\objects\pack` 252 file = 6,4 GB). Bước này `reflog expire` + `gc --prune=now` ⇒ còn 1 pack (~90–100 MB). Giả lập máy dev: 9 → 1 pack, 1,5 s, kéo commit sau vẫn bình thường. Hỏng thì bỏ qua (không chặn deploy). Dọn tay một lần: `cd <runner>\_work\forfish\forfish` rồi `git -c safe.directory=* gc --prune=now`.
- Chỉ cài gói khi hash `package-lock.json` + `node -v` đổi (dấu ở `node_modules\.deploy-lock-hash`). **Lockfile đổi, cùng bản Node ⇒ CÀI BÙ `npm install`** trên `node_modules` sẵn có (2026-10-26; `npm ci` xoá sạch 683 MB rồi cài lại = **8 phút 23 giây** đo thật run #61); cài bù hỏng ⇒ tự lùi `npm ci` sạch. Đổi bản Node / runner mới / mất file dấu ⇒ `npm ci` sạch. Nghi `node_modules` hỏng → xoá file dấu đó, lần sau cài lại sạch.
- **Build KHÔNG typecheck khi đến từ `workflow_run`** (2026-10-26): `SDFISH_SKIP_BUILD_TYPECHECK=1` → `next.config.ts` `typescript.ignoreBuildErrors`. An toàn vì `ci` vừa chạy `npm run typecheck` XANH trên đúng commit đó. Đo máy dev, cùng code, cache ấm: build **112 s → 30 s** (typecheck chiếm 86 s). Bấm tay (`workflow_dispatch`), Vercel, máy dev KHÔNG đặt cờ ⇒ vẫn kiểm.
- **`ci.yml` ba job song song** (lint · typecheck · test, mỗi job tự `npm ci`) thay một job nối đuôi + cache `.eslintcache` (`--cache-strategy content`) + `tsconfig.tsbuildinfo`. **Push chỉ sửa `docs/**`/`*.md` ⇒ không chạy ci ⇒ không deploy** (PR vẫn chạy đủ). Đổi tên workflow `ci` là gãy `workflow_run` của deploy — đừng.
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
npm run e2e:export -- 06           # chỉ xuất video có số 06
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
- Bước export: Playwright chỉ ghi WebM đúng cỡ viewport 402×874 — Zalo/Facebook/nhiều iPhone không mở được WebM. Script phóng **3×** (lanczos ⇒ 1206×2622, làm tròn số chẵn), H.264 `high`, 30 khung/giây, CRF 20, `+faststart` (mở là chạy), **bỏ tiếng**. Tên ra theo số video (`1-thoi-tiet-bien.mp4` … `7-them-vao-man-hinh-iphone.mp4`), không theo tên thư mục dài của Playwright. ĐỪNG quay thẳng ở 3× — canvas WebGL bản đồ nặng quá, treo (đã dính). Chưa có `test-reports/triage/e2e-output` hoặc thiếu ffmpeg ⇒ script báo rồi thoát mã 1; một video ffmpeg lỗi ⇒ in `✗` và mã thoát 1, các video khác vẫn xuất.

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
| Kiểm duyệt | `scripts/kairos-kiem.mjs` | 5 phút | hàng chờ ⇒ luật cứng chủ quyền + mô hình chấm ⇒ `POST /api/kairos/kiem`; cuối lượt `DELETE /api/kairos/kiem?scope=media` dọn ảnh mồ côi >24 giờ (không cần Claude — log `[ảnh]`); từ 2026-10-27 đối chiếu link trong bài với danh sách tên miền lừa đảo Phishing.Database (MIT) — file `lua-dao-ten-mien.txt` trong thư mục trạng thái, tải lại khi cũ hơn 24 giờ (đồng hồ 90 s), tải hỏng ⇒ dùng bản cũ, chưa từng có ⇒ chỉ luật cứng `link-doc.mjs` (log `[link độc]`) |

Hai script chỉ dùng thư viện có sẵn của Node (≥20) + file `.mjs` trong repo — **không cần `node_modules`** (bản trong `C:\Code\ForFish` là bản Windows, không chạy được trong WSL — không sao). Chạy thẳng từ `~/ForFish` (symlink tới checkout Windows — đừng clone thêm).

**1. Tệp env ngoài repo** — `~/.config/forlife/kairos.env`, `chmod 600`:

```bash
KAIROS_INGEST_KEY=<cùng giá trị ô "Khoá nhập tin Kairos" ở /quan-tri › Hệ thống>
KAIROS_API_BASE=https://<miền app, không có / cuối>
# tuỳ chọn:
# KAIROS_STATE_DIR=/home/long/.local/forlife/kairos   # sổ chặn trùng + hàng đợi gửi lại + thư mục rỗng cho claude
# KAIROS_LLM=gemma                                     # mặc định (2026-10-30); "claude" = quay lại claude -p
# KAIROS_GEMMA_MODEL=gemma4:e4b                         # không có trong Ollama ⇒ tự lùi gemma4:e2b
#   (hết mỗi lượt script tự nhả e4b + nạp lại gemma4:e2b num_ctx 4096 cho Sen Biển — kairos-chung.mjs ketThuc)
# OLLAMA_URL=http://127.0.0.1:11434                     # Ollama của AI Assistant; không trả lời ⇒ thử claude -p
# KAIROS_MODEL=claude-haiku-5-5                       # chỉ dùng khi đi đường Claude; CLI không nhận ⇒ tự lùi "haiku"
# CLAUDE_BIN=/home/long/.local/bin/claude
```

Khoá: /quan-tri › Hệ thống › **Khoá nhập tin Kairos** › Tạo ngẫu nhiên › Lưu, rồi dán CÙNG giá trị vào tệp trên. Env `KAIROS_INGEST_KEY` ở Vercel (nếu đặt) ĐÈ ô đó — đổi khoá thì đổi cả hai chỗ. Script đọc lại tệp mỗi lượt, không cần khởi động lại.

**2. Kiểm tay trước khi cài timer**

```bash
node ~/ForFish/scripts/kairos-thu.mjs --thu              # đọc RSS thật, in 15 bài đầu; KHÔNG gọi claude, KHÔNG gửi, KHÔNG ghi sổ
curl -s http://127.0.0.1:11434/api/generate -d '{"model":"gemma4:e4b","prompt":"Trả lời đúng một chữ: ok","stream":false}'   # Gemma (mặc định từ 2026-10-30) trả lời được không?
echo 'Trả lời đúng một chữ: ok' | claude -p --model claude-haiku-5-5 --output-format json --max-turns 1   # chỉ khi KAIROS_LLM=claude
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

**3i. Tin triển khai SDVICO (2026-10-31)** — `kairos-trien-khai.service` (ExecStartPre lam-moi.sh, `node …/app/scripts/kairos-trien-khai.mjs`) + `kairos-trien-khai.timer` (`OnCalendar=*-*-* 07..21:16/30` — dời từ :00/:30 ngày 2026-11-05 cho khỏi trùng phút, xem "Lịch máy GPU", `Persistent=true`). Mỗi lượt MỘT đợt ảnh cũ nhất (kho ảnh thực tế AI Assistant, nhóm "Triển Khai Kinh Doanh" + "SDVICO Sản xuất-DV Kỹ thuật") ⇒ Claude viết bài SDVICO Chính thức (vào thẳng, không "bà con ơi") ⇒ `POST /api/kairos/sdvico-tin` ≤5 ảnh. Dính tiền / chính sách / nhạy cảm ⇒ sổ `trien-khai.json` ghi `nhay_cam`, chờ anh duyệt cả đợt ở AI Assistant › Hệ thống › Ảnh thực tế rồi lượt sau đăng. Thử: `node scripts/kairos-trien-khai.mjs --thu`. 429 ⇒ đủ 3 tin/24 giờ. 503 `no_sdvico_profile` ⇒ thiếu hồ sơ `sdvico:chinh-thuc`.

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

> **2026-10-29 — QUÉT CẢ BIỂN ĐÔNG + GỬI NÉN**: `chuan-hoa.mjs` đổi hộp sang `VUNG_QUET` (0–25N, 99–122E, ~99 ô ⇒ một lượt lâu hơn, ~45–60 s) và `tau-ais-thu.mjs` gửi thân gzip. `lam-moi.sh` tự lấy hai tệp này từ origin/main; máy chủ phải lên TRƯỚC hoặc CÙNG lúc (route nhap đã nhận cả thân nén lẫn thường) — vài lượt hỏng trong lúc Vercel đang deploy là bình thường, lượt sau gửi lại. Kiểm: `journalctl --user -u tau-ais-thu -n 30` thấy "~99 ô … ⇒ N tàu".

> **2026-10-30 — KHO CHI TIẾT TÀU (MMSI/IMO) + KHO GIỜ BẢN 2**: mỗi lượt, sau quét ô, máy thu tra thêm tàu chưa có (≤250 tàu, ≤5 phút) và nối NGUYÊN JSON nguồn vào `<state>/luu/chi-tiet/tau.ndjson` (mỗi dòng `{id, luc, general, info}` hoặc `{id, luc, loi}`; dòng sau đè dòng trước cùng id). Xem tiến độ: `journalctl --user -u tau-ais-thu -n 20 | grep "chi tiết"` ("kho N tàu (M có MMSI)"). Bị chặn ⇒ log "nghỉ tới …" (`chiTietNghiDen` trong `lan-cuoi.json`; xoá khoá này để tra lại ngay). Kho giờ từ 30/10 là dòng `{v:2, luc, soTau, tho[]}` — hàng nguồn đủ trường + MMSI/IMO/CALLSIGN; dòng cũ không `v` là bản gọn. Thử không gửi: `xvfb-run -a node app/scripts/tau-ais-thu.mjs --thu` (tra 5 tàu, VẪN ghi kho chi tiết — dùng `TAU_AIS_STATE_DIR` + `TAU_AIS_PROFILE` riêng nếu không muốn đụng kho thật; đừng chạy chung hồ sơ khi timer đang chạy).

> **2026-10-29 — KHO AIS VĨNH VIỄN Ở MÁY NHÀ** (anh Long: "lưu để còn phục vụ cho các thuật toán dự báo cá, tối ưu đường đi, các route hay đi, tàu dầu, tàu tải"): mỗi GIỜ VN, lượt đầu tiên ghi một bản đầy đủ `{luc, soTau, tau[]}` (đủ trường: id, tên, loại, cờ, lat/lon, kn, hướng đi, mũi, tuổi tin, dài, cảng đến) vào `~/.local/forlife/tau-ais/luu/YYYY-MM/YYYY-MM-DD.ndjson.gz` (đổi chỗ: `TAU_AIS_LUU_DIR` trong tau-ais.env). Mỗi bản là một khối gzip nối đuôi ⇒ `zcat tệp | jq -c .soTau` đọc cả ngày. Ghi TRƯỚC khi gửi máy chủ (máy chủ hỏng vẫn có dữ liệu); lỗi đĩa chỉ log. Mốc giờ đã lưu nằm ở `lan-cuoi.json` (`gioLuu`). Dung lượng ước (~30 nghìn tàu): ~1 MB nén/giờ ⇒ ~25 MB/ngày ⇒ ~9 GB/năm — **KHÔNG tự xoá**, theo dõi ổ đĩa. Server chỉ giữ 7 ngày (bảng `tau_ais_vet`, migration 0076).

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

## Thời tiết từ máy nhà — gpu-desktop tải nguồn Open-Meteo (2026-10-30)

> Vì sao: cron `/api/cron/refresh-weather` trên Vercel bắn song song các lưới lớn ⇒ Open-Meteo trả 429 `Minutely API request limit exceeded` ⇒ khung 16 ngày (lưới gió sóng + lớp màu) không ghi được, DB đứng ở bản cũ. Hàm Vercel sống 60 s nên không chờ qua phút được. Máy nhà thì chờ được: `scripts/thoi-tiet-thu.mjs` hỏi `GET /api/thoi-tiet/nhap` danh sách URL (~56), tải LẦN LƯỢT (429 ⇒ chờ 65 s, thử lại tối đa 4 lần), gửi gói nén gzip (đo lượt thật 30/10: thô 22,8 MB ⇒ nén 1,9 MB, dưới trần thân 4,5 MB của Vercel) lên `POST /api/thoi-tiet/nhap`; máy chủ ghép bằng đúng logic cron (`lib/thoi-tiet-lam-moi`, URL không có trong gói ⇒ máy chủ tự gọi mạng, đếm `truot`). Cron Vercel + GitHub Action vẫn chạy song song — hai đường cùng ghi một bảng, bản nào mới hơn thắng theo luật ghép sẵn có.

1. **Khoá**: dùng CHUNG bí mật cron (`app_config.cron_secret`). `~/.config/forlife/thoi-tiet.env` (chmod 600):
   ```
   THOI_TIET_API_BASE=https://forfish.vercel.app
   CRON_SECRET=<app_config.cron_secret>
   ```
2. **Thư mục** `~/.local/forlife/thoi-tiet/`: `lam-moi.sh` (khuôn tau-ais) xuất `scripts/thoi-tiet-thu.mjs` từ origin/main của `C:\Code\ForFish` vào `app-<ref>`, `app` → symlink. Script không import gì ngoài Node.
3. **Unit** `~/.config/systemd/user/thoi-tiet-thu.{service,timer}`: `OnCalendar=*-*-* 05,11,17,23:50:00` (giờ VN = 22:50/04:50/10:50/16:50 UTC, ngay sau mốc ra bản 04/10/16/22 UTC), `Persistent=true`, `TimeoutStartSec=25min`. Xem: `journalctl --user -u thoi-tiet-thu -n 20`.
4. **Chạy thử không gửi**: `node ~/.local/forlife/thoi-tiet/app/scripts/thoi-tiet-thu.mjs --thu` ⇒ `[tải] 56/56 URL · 22.8 MB ⇒ nén 1.91 MB`; lượt thật 30/10 17:26 VN: `"grid":{"3":true,"16":true}` · `"mayNha":{"nhan":56,"trung":36,"truot":0}` (20 URL dự phòng cảng không cần dùng).

| Triệu chứng (journal) | Nguyên nhân | Làm gì |
|---|---|---|
| `không lấy được danh sách URL: 401` | CRON_SECRET lệch | dán lại từ app_config |
| `[tải] 429 …` lặp nhiều lần | trần phút/ngày Open-Meteo (dùng chung IP nhà) | tự chờ; cả lượt hỏng thì lượt sau |
| `[gửi] 200 … "truot":N` với N lớn | máy chủ đổi URL sau khi máy nhà lấy danh sách (deploy giữa lượt) | lượt sau tự khớp |
| `[gửi] 200 … "grid":{"16":false}` | Open-Meteo không trả khung 16 ngày cả ở máy nhà | xem `[tải]` trong cùng lượt |

## Ô bản đồ từ máy nhà — gpu-desktop tải trước vùng biển VN (2026-11-04)

> Vì sao: kho ô máy chủ (`lib/kho-o-ban-do`, ops/external-services › "Kho ô bản đồ phía máy chủ") chỉ đầy dần theo lượt bà con kéo. Máy nhà tải TRƯỚC vùng biển VN và đẩy vào ngăn `may-nha` ⇒ EMODnet/NASA sập vẫn còn ô. Mỗi ô là ảnh GỐC của nguồn (ngày mới nhất có ảnh), KHÔNG ghép nhiều ngày.

1. **Khoá**: dùng CHUNG bí mật cron. `~/.config/forlife/o-ban-do.env` (chmod 600):
   ```
   O_BAN_DO_API_BASE=https://sdfish.sdvico.vn
   CRON_SECRET=<app_config.cron_secret>
   ```
   Trỏ vào máy chủ CÓ ĐĨA BỀN (IIS). Phía máy chủ KHÔNG cần cài gì: kho tự nằm ở `C:\SDViCo Soft\FORFISH\shared\kho-o` (cạnh `current`, deploy không xoá); xem/xoá + đổi trần ở /quan-tri › Hệ thống.
2. **Thư mục** `~/.local/forlife/o-ban-do/`: `lam-moi.sh` (khuôn thời tiết) xuất `scripts/o-ban-do-thu.mjs` + `src/lib/o-ban-do-nguon.mjs` từ origin/main của `C:\Code\ForFish` vào `app-<ref>`; chưa có trên main ⇒ giữ `app` → `app-dev` (cài tay 04/11 từ nhánh `feat/kho-o-ban-do`). Bản sao ô ở `kho/<src>/<z>/<x>/<y>.png`, mốc đẩy hải đồ ở `kho/chart.gui-luc`.
3. **Unit** `~/.config/systemd/user/o-ban-do-thu.{service,timer}`: `OnCalendar=*-*-* 07,19:40:00` (giờ VN), `Persistent=true`, `TimeoutStartSec=40min`. Xem: `journalctl --user -u o-ban-do-thu -n 20`.
4. **Chạy thử không gửi**: `node ~/.local/forlife/o-ban-do/app/scripts/o-ban-do-thu.mjs --thu --lop=sst,chlorophyll` ⇒ lượt 04/11: `[sst] 90/90 ô` · `[phù du] N/90 ô · theo ngày {…}`. Ép đẩy hải đồ: `--hai-do`.

| Triệu chứng (journal) | Nguyên nhân | Làm gì |
|---|---|---|
| `[gửi] 404` | máy chủ chưa deploy bản có `/api/o-ban-do/nhap` | deploy IIS (chạy tay) rồi lượt sau tự gửi |
| `[gửi] 401` | CRON_SECRET lệch | dán lại từ app_config |
| `[gửi] 500 … "code":"disk"` | đĩa máy chủ đầy / thư mục kho không ghi được | /quan-tri › Hệ thống › thẻ Kho ô bản đồ (báo "không ghi được" + thư mục) ⇒ kiểm quyền tài khoản service `forfish` trên thư mục đó |
| `[phù du] … theo ngày` dồn về ngày cũ | GIBS chưa ra ảnh mấy ngày gần | tự lành; ảnh cũ vẫn trong kho máy chủ |

## Nguồn ngày từ máy GPU — phù du nhiều nguồn + sao kho dự phòng (2026-11-04)

Anh Long: *"kiếm thêm nguồn phù du đi, chứ 1 nguồn ko ổn, cho gpu tổ chức quét hàng ngày để bổ sung"* + *"lưu ở gpu cho back up"*.

- **Chạy ở đâu**: gpu-desktop, timer user `nguon-ngay-quet.timer` (04:50 + 14:50 UTC = 11:50 + 21:50 giờ VN; lượt 11:50 đứng sau cron lưu trữ 03:35 UTC để sao được bản của ngày). Service chạy `lam-moi.sh` (lấy `scripts/nguon-ngay/` từ origin/main của checkout Windows, cùng khuôn `thoi-tiet`) rồi `venv/bin/python app/scripts/nguon-ngay/quet.py`. Thư mục `~/.local/forlife/nguon-ngay/` (venv dựng bằng `~/.local/bin/uv`: xarray, zarr<3, fsspec, aiohttp, scipy, numpy — máy không có `python3-venv`).
- **Khoá**: `~/.config/forlife/nguon-ngay.env` (chmod 600) — `API_BASE` + `CRON_SECRET`, chép từ `thoi-tiet.env`. Đổi bí mật cron ở `/quan-tri` thì sửa cả hai tệp.
- **Một lượt**: (1) hỏi máy chủ ngày nào đã có trong cửa sổ 25 ngày · (2) mỗi nguồn đọc trục thời gian, tải NGÀY CÒN THIẾU (ERDDAP `.nc`, Copernicus zarr), đưa về lưới 0,05° · (3) dựng lại `chl-ghep` cho ngày vừa có thêm thành phần · (4) gửi lô 10 gói gzip lên `POST /api/collect/nguon-ngay`, ghi bản y hệt vào kho sao · (5) SAU CÙNG sao kho `forecast-archive` về `~/.local/forlife/kho-du-bao/` (file mới/đổi cỡ, từ 2026-10-10, 8 luồng — tuần tự ~3 s/file, lượt đầu ~2 100 file gần 2 giờ).
- **Thử tay**: `~/.local/forlife/nguon-ngay/venv/bin/python ~/.local/forlife/nguon-ngay/app/scripts/nguon-ngay/quet.py --thu --cua-so 6` (tải + in, không gửi). Log: `journalctl --user -u nguon-ngay-quet -n 80`.
- **Hỏng thì sao**: nguồn nào lỗi chỉ bỏ nguồn đó, lượt sau tự lấp (cửa sổ 25 ngày); máy chủ không trả được danh sách ngày đã có ⇒ dừng cả lượt (đừng tải lại cả cửa sổ). Lượt quét không đụng production — dự báo cá vẫn đọc nguồn như cũ.
- **Đo lần đầu (2026-11-04, cửa sổ 6 ngày)**: phù du DINEOF (nguồn production) phủ 48% biển ngày 30/10; ghép thêm OLCI S3A + VIIRS N20/NPP ⇒ 64%; ngày 29/10 có thêm Copernicus L4 ⇒ 74% (≈ kín biển, phần còn lại là đất).

## S-Tracking — hạn cước + cảnh báo tàu từ máy GPU (2026-11-05)

> Anh Long: *"chạy GPU, check 7h, 12h, 17h, 21h để cập nhật cái hạn mới nhất, tổ chức DB ở GPU lưu toàn bộ các thông tin liên quan tới user"*. Anh là đại lý Viettel — Viettel cho phép lấy dữ liệu. Nguồn + đồng hồ: [external-services.md › S-Tracking](external-services.md). Bảng ForFish: migration 0080 ([04](../04-data-model.md)).

1. **Tệp env** `~/.config/forlife/stracking.env` (chmod 600; Windows mở: `notepad \wsl.localhost\Ubuntu-24.04\home\long\.config\forlife\stracking.env`):
   ```
   STRACKING_USER=<tài khoản đại lý>
   STRACKING_PASSWORD=<mật khẩu>
   STRACKING_KEY=<khoá — /quan-tri › Hệ thống › Khoá máy thu S-Tracking › Tạo ngẫu nhiên › Lưu, dán CÙNG giá trị>
   STRACKING_API_BASE=https://forfish.vercel.app
   ```
2. **Thư mục** `~/.local/forlife/stracking/`: `app` → bản chạy (`app-dev` cài tay 05/11; `lam-moi.sh` tự xuất `scripts/stracking-dong-bo.mjs` + `src/lib/stracking/dong-bo.mjs` từ origin/main khi có) · `node_modules` → `~/ForFish/node_modules` (Playwright) · `profile/` hồ sơ Chromium giữ phiên đăng nhập · **`stracking.db`** = KHO ĐẦY ĐỦ (SQLite): `thiet_bi` (mọi cột + bản thô `tho` + `bam_da_gui`), `han_lich_su` (mỗi lần hạn đổi = một lần gia hạn), `canh_bao`, `lan_chay`.
3. **Unit** `stracking-dong-bo.{service,timer}`: 07:30 · 12:20 · 17:20 · 21:00 giờ VN (mỗi giờ một dòng `OnCalendar`, xem "Lịch máy GPU"), `TimeoutStartSec=20min`, ExecStart bọc `flock -w 600 ~/.local/forlife/.khoa-chromium` (không chạy chồng máy thu AIS). Xem: `journalctl --user -u stracking-dong-bo -n 30`.
4. **Chạy thử không gửi**: `cd ~/.local/forlife/stracking && xvfb-run -a node app/scripts/stracking-dong-bo.mjs --thu` → đo 05/11: tự đăng nhập được, báo cáo dịch vụ 4 056 · phương tiện 15 857/16 055 · cảnh báo 4 106 · kho 15 853 máy (14 561 có SĐT) · **51 s**. Gửi lại toàn bộ: `--gui-lai`.
5. **Lượt ĐỦ / NHẸ** (anh Long 05/11: *"dữ liệu ban đầu thôi, sau đó cào thì chỉ push cái thay đổi thôi, tránh nặng tải"*): lượt ĐẦU TIÊN mỗi ngày VN (07:30) hoặc kho trống hoặc `--day-du` ⇒ cào ĐỦ danh sách 16 nghìn máy (~64 MB, ~90 s). Các lượt sau ⇒ NHẸ: chỉ báo cáo dịch vụ + cảnh báo + TRA LẺ máy vừa rời báo cáo (thường là vừa gia hạn; `/deviceAisList` với `filter[]=serial` — thiếu `filter[]` trang bỏ qua điều kiện, trả cả 16 nghìn máy), hồ sơ còn lại lấy từ kho. Đo 05/11: ĐỦ 93 s gửi 1 065 hồ sơ đổi · NHẸ **20 s, 0 hồ sơ** + 14 cảnh báo. Mốc cào đủ: bảng `trang_thai` (`pt_day_du_luc`); máy đang trong báo cáo: cột `thiet_bi.trong_bao_cao`.
6. **NHẮC NHỞ** (anh Long 05/11: *"đồng bộ tổng cục quan trọng, vì nếu ko đồng bộ, mkn >6h là họ sẽ bị phạt … cần tổ chức logic nhắc nhở"*) — `lib/stracking/nhac-nho.mjs` (thuần, test `stracking-nhac-nho.test.ts`). Máy GPU tính trên TOÀN BỘ kho mỗi lượt, chống lặp bằng bảng SQLite `da_nhac (khoa, sdt)`, gửi `nhac: [{sdt, tau, loai, day, dong}]` lên `/api/stracking/nhap`; route gộp với cảnh báo thành 1 tin/SĐT vào hộp thư + đẩy lên máy. Máy CHỈ đánh dấu đã nhắc khi máy chủ trả `ghi.nhac` (số) — chưa có thì lượt sau gửi lại. Luật: mất kết nối NGOÀI KHƠI 4–6 giờ ⇒ "sắp quá 6 giờ" (1 lần/đợt) · ≥6 giờ ⇒ "quá 6 giờ là bị phạt", nhắc lại mỗi 6 giờ trong đợt · đồng bộ Tổng cục "Thất bại" ⇒ 1 lần/ngày (ngoài khơi đẩy, trong bờ chỉ hộp thư) · cước còn 15/7/3/1/0 ngày (≤3 mới đẩy) · quá hạn 1/7/30 ngày. Người nhận: chủ tàu + thuyền trưởng. Nguồn mất kết nối: `POST /getListDeviceDisconnect` (trang đầu PHẢI có page "1", pageSkip "0", direction "0", isFirstPage "true", isLastPage "false" — để trống ⇒ 500), 1 trang 1 000 dòng ≈ 22 ngày, 0,9 s. Đo 05/11: 67 tàu ngoài khơi đang mất kết nối ⇒ 80 nhắc; lượt đầu cả kho ⇒ ~1 100 nhắc (781 Tổng cục, 286 sắp hết cước, 32 quá hạn).
**GIỮ PHIÊN ĐĂNG NHẬP** (anh Long 05/11: "tại sao phiên ko được giữ ?" → "làm đi"): cookie đăng nhập S-Tracking là cookie PHIÊN (không ngày hết hạn, HttpOnly) ⇒ Chromium xoá khi đóng, hồ sơ `profile/` không giữ được ⇒ trước đó lượt nào cũng đăng nhập lại (~24 lần/ngày, dễ bị Google đòi captcha). Giờ đăng nhập xong + cuối mỗi lượt tốt ⇒ lưu cookie ra `~/.local/forlife/stracking/phien.json` (**chmod 600** — tương đương một phiên tài khoản đại lý, giữ kín như tệp env), đầu lượt nạp lại; log "dùng lại phiên đã lưu". Máy chủ đá ra ⇒ đăng nhập như cũ + ghi phiên sống bao lâu vào `trang_thai.phien_song_gio` (đọc để biết thời hạn thật của máy chủ). Muốn ép đăng nhập lại: xoá `phien.json`.
7. **Unit `stracking-mkn.{service,timer}`** — MỖI GIỜ phút :45: `--mkn` = chỉ đọc mất kết nối ngoài khơi + nhắc mốc 6 giờ (~10 s), cùng khoá Chromium. Thử: `node app/scripts/stracking-dong-bo.mjs --mkn --thu`.
8. **Mỗi lượt gửi gì**: chỉ hồ sơ ĐỔI so với lần gửi trước (băm từng hồ sơ) + cảnh báo chưa gửi; lô 4 000 hồ sơ, thân gzip ⇒ `POST /api/stracking/nhap`. Lượt đầu ~14,5 nghìn hồ sơ (4 lô).
6. **Thông báo cảnh báo tàu** (anh Long 05/11: *"các thông báo liên quan tàu thì show trên sdfish luôn ở phần thông báo, push đi"*): rồi *"cái nào trong ngày thôi, cảnh báo thông minh vào"*): route nhập lấy cảnh báo VỪA CHÈN (trùng khoá không báo lại), chỉ cái xảy ra ≤12 giờ (kho tồn/gửi bù không dội), **chống lặp** cùng máy + cùng loại 6 giờ, gộp **1 tin/SĐT/lượt** (chủ tàu + thuyền trưởng), xếp SOS › Vượt biên › Sắp vượt biên › Tắt thiết bị › Mất GPS › Pin, trần **400 tin/lượt** (`lib/stracking/thong-bao.ts`) ⇒ hộp thư `push_messages` (`sent_by='system:stracking'`, mở `/tau`); **Báo động** thì Web Push máy đã bật, **Cảnh cáo** chỉ hộp thư. **Nhắc nhở** (mất kết nối >6 giờ là bị phạt, chưa đồng bộ Tổng cục, hạn cước — máy GPU tính + chống lặp, timer `stracking-mkn` :45 mỗi giờ) đi CÙNG tin của SĐT (`ghepNhac`); response `ghi.nhac` là số ⇒ GPU đánh dấu đã nhắc, null ⇒ gửi lại lượt sau; `ghi.nhacSdtBo` = vượt trần 1.500 SĐT/lượt. Hỏng chỉ log `[stracking] thông báo cảnh báo hỏng`, không 503. Log Vercel mỗi lượt: `[stracking] cảnh báo mới N ⇒ T tin, đẩy a/b máy`.
7. **Tài khoản bà con S-Tracking (05/11, anh Long duyệt)**: 12 139 SĐT chưa có tài khoản được tạo sẵn (SĐT@sdvico.local, mật khẩu mặc định, `user_metadata.nguon='s-tracking'`); 10 431 SĐT chủ tàu gán vai `chu-tau` (hàng `customers` mới tên = chủ tàu S-Tracking); 10 350 chủ tàu free chưa có sổ tàu được điền `user_docs.boats` (id `st-<serial>`, tên, mã tàu đúng dạng, chủ tàu). KHÔNG đụng 85 khách premium và người đã tự khai tàu. SĐT mới xuất hiện ở lượt sau CHƯA tự tạo tài khoản — nợ: làm tay lại, tự động khi có yêu cầu.

| Triệu chứng (journal) | Nguyên nhân | Làm gì |
|---|---|---|
| `thiếu cấu hình … STRACKING_KEY` (mã 2) | env thiếu | sửa tệp env (bước 1) |
| `HẾT PHIÊN … trang đòi giải captcha` (mã 3) | Google bật thử thách reCAPTCHA — máy KHÔNG vượt | đăng nhập tay một lần: `cd ~/.local/forlife/stracking && node app/scripts/stracking-dong-bo.mjs --dang-nhap --thu` (cửa sổ thật trên WSLg, chờ ≤5 phút); các lượt sau dùng lại hồ sơ |
| `HẾT PHIÊN … sai tài khoản/mật khẩu?` | mật khẩu đổi | sửa env |
| `danh sách phương tiện thiếu (N/M) — không ghi đè kho` | trang trả thiếu | lượt sau đọc lại; lặp nhiều lượt ⇒ soi `--thu --anh` |
| `trang đổi định dạng — thiếu cột: …` | Viettel đổi bảng | sửa `COT_PHUONG_TIEN`/`COT_CANH_BAO` trong `lib/stracking/dong-bo.mjs` (+ test) |
| `gửi hỏng: HTTP 401 bad_key` / `503 not_configured` / `503 store_down` | khoá lệch / app chưa có khoá / migration 0080 chưa apply | dán lại khoá / đặt khoá ở /quan-tri / apply 0080 |
| `503 store_down` + log Vercel `unsupported Unicode escape sequence` | ký tự NUL trong dữ liệu Viettel (dính 05/11 ở cảnh báo) | đã lọc ở `chu`/`chuoiHoacNull` (`KY_TU_DIEU_KHIEN`); lỗi lại ⇒ soi trường mới chưa đi qua hai hàm này |

## Canh service máy GPU (2026-11-05)

Anh Long: *"gpu phải tổ chức kiểm tra định kỳ các service đang chạy nhé"*. `~/.local/forlife/canh/canh.sh` (NGOÀI mọi repo — canh MỌI unit user systemd, kể cả của AI-Assistant) + `canh-gpu.timer` (`*:03/10`). Mỗi lượt:
1. Timer đã enable mà "dead" (không còn lịch — kiểu `forlife-watch` đứng từ 21/10 vì chỉ có `OnUnitActiveSec`) ⇒ restart timer.
2. Service chạy liên tục (Type ≠ oneshot, enabled) không active ⇒ restart, ≤3 lần/giờ/service; quá thì báo "CẦN NGƯỜI XEM".
3. Việc oneshot (theo lịch) failed ⇒ KHÔNG chạy lại (có việc nặng như vòng train đêm) — chỉ ghi 3 dòng log cuối của chính việc đó.

Xem: `~/.local/forlife/canh/canh.sh xem` · `cat ~/.local/forlife/canh/su-kien.log` · `journalctl --user -t canh-gpu`. Lượt đầu 05/11 16:11: bật lại `forlife-watch.timer`; báo `forlife-dem` (cổng chấm "rò chéo không đạt", mã 21) và `o-ban-do-thu` (máy chủ trả 404 khi gửi, 171 gói hỏng). Chưa báo qua Zalo/push — chỉ ghi tệp + journal.

## Lịch máy GPU — các việc theo giờ cách nhau ≥30 phút (2026-11-05)

Anh Long: *"tối ưu phân phối cái lịch chạy GPU để tránh bị dồn tải"* rồi *"tách phân phối lại, cách nhau 30 phút"*. Luật:
- Mọi việc chạy THEO GIỜ cách nhau **≥30 phút**, bỏ `RandomizedDelaySec` (ngẫu nhiên phá khoảng cách). Mỗi giờ một dòng `OnCalendar=*-*-* HH:MM:00 Asia/Ho_Chi_Minh` — systemd KHÔNG nhận `07:30,12:20` chung một dòng (dính thật 05/11: timer thành "elapsed", không còn lịch).
- Việc theo NHỊP (`OnUnitActiveSec` 1–15 phút, `kairos-trien-khai` mỗi 30 phút) không xếp được ≥30 phút với nhau — chúng nhẹ hoặc gọi LLM ngắn, giữ ngẫu nhiên nhỏ.
- Hai việc mở Chromium (`tau-ais-thu`, `stracking-dong-bo`) dùng chung khoá `~/.local/forlife/.khoa-chromium` (flock, chờ ≤10 phút).
- Sửa lịch: `daemon-reload` rồi `restart` timer; `Persistent=true` sẽ chạy BÙ mốc vừa lỡ — với việc có đăng bài (Sen Biển, luật) phải xem trước mốc cuối đã chạy chưa. Bản cũ của unit: `*.bak-2026-11-05`. Unit AI-Assistant (`forlife-*`, `sen-bien-dem`) KHÔNG sửa — cặp 06:35/07:00 của nó cách 25 phút, để nguyên.

| Giờ VN | Việc | Nặng |
|---|---|---|
| 00:30 | `forlife-dem` (AI-Assistant) | GPU train |
| 05:50 | `thoi-tiet-thu` | mạng |
| 06:35 | `sen-bien-dem` (AI-Assistant) | GPU |
| 07:00 | `forlife-bao-cao-ams` (AI-Assistant) | nhẹ |
| **07:30** | `stracking-dong-bo` | Chromium ~1 phút |
| **08:00** | `o-ban-do-thu` (trước 07:40 +≤5′) | mạng/đĩa ~5 phút |
| **09:00** | `kairos-luat` (trước 08h +≤2 giờ) | LLM |
| **10:00** | `kairos-sen-bien` (trước ngẫu nhiên 7–19h) | LLM |
| 11:50 | `thoi-tiet-thu` | mạng |
| **12:20** | `stracking-dong-bo` | Chromium |
| **12:50** | `nguon-ngay-quet` (trước 11:50 +≤5′, trùng thời tiết) | mạng |
| **15:00** | `kairos-luat` (trước 16h +≤2 giờ) | LLM |
| **17:20** | `stracking-dong-bo` | Chromium |
| 17:50 | `thoi-tiet-thu` | mạng |
| 19:40 | `o-ban-do-thu` | mạng/đĩa |
| **21:00** | `stracking-dong-bo` | Chromium |
| **22:50** | `nguon-ngay-quet` | mạng |
| 23:50 | `thoi-tiet-thu` | mạng |
| mỗi giờ :45 | `stracking-mkn` (mất kết nối ⇒ nhắc mốc 6 giờ, ~10 s, khoá Chromium) | nhẹ |
| theo nhịp | `kairos-truc` 1′ · `kairos-kiem` 5′ · `forlife-truc-ntts` 5′ · `forlife-gpu-lich` :00/5 · `kairos-agent` 10′ · `tau-ais-thu` 10′ (khoá Chromium) · `canh-gpu` :03/10 · `kairos-thu` 15′ · `kairos-trien-khai` 07–21 :16/:46 | nhẹ / LLM ngắn |

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

