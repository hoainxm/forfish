# Không lộ nguồn dữ liệu, thuật toán, mô hình — quy tắc + cổng chặn

> **Load khi / Load when**: thêm hay sửa bất kỳ thứ gì chạy trên máy bà con (component, `src/lib/**` mà component import, worker, `public/**`), thêm route `/api/**` trả dữ liệu xuống máy, thêm file `public/data/**`, thêm nguồn dữ liệu ngoài, thêm tham số mô hình.
> Chốt 2026-11-08, anh Long: *"đảm bảo ko để lộ các nguồn dữ liệu của hệ thống đang sử dụng, các thuật toán, các mô hình, tính toán ở máy chủ hoặc server, thứ lưu ở máy hay offline chỉ là con số đc tải về từ hệ thống, đảm bảo cả dịch ngược hoặc tra code cũng ko thấy"*.
> Bằng chứng: rà 08/11 (3 agent đọc code + quét bundle production thật `.next/static`, 163 chunk).

## 0. Sự thật kỹ thuật phải nói trước

1. **Thứ gì chạy trên điện thoại thì người có máy đều đọc được** (JS minify vẫn đọc được; khoá giải mã phải nằm trên máy để giải mã). Không có cách nào giấu tuyệt đối một thuật toán CHẠY trên máy — chỉ có thể: (a) không đưa nó xuống, (b) đưa xuống phần chung chung nhất, giữ phần đáng giá (tham số, nguồn) ở máy chủ.
2. **Offline là luật an toàn** (CLAUDE.md): ngư dân mất sóng nhiều ngày. Dẫn đường né sóng/cạn, lộ trình chuyến biển, thuỷ triều, Sen Biển offline PHẢI chạy trên máy. Với nhóm này mục tiêu là "đọc code không thấy nguồn, không thấy số đã fit", KHÔNG phải "không có thuật toán".
3. **Ghi công bắt buộc theo giấy phép** (ODbL của OSM/OpenSeaMap, CC-BY của EMODnet, Copernicus Marine, Allen Coral Atlas, EOT20, Open-Meteo; điều khoản Gemma): phải hiện ở MỘT chỗ (trang "Nguồn dữ liệu" / Quyền riêng tư). Giấu hẳn là vi phạm giấy phép — chỉ được gom về một chỗ, bỏ khỏi mọi chỗ khác. Dạng câu chữ: hỏi luật sư.

## 1. Ba nhóm — mọi thứ phải xếp vào đúng một nhóm

| Nhóm | Gồm | Ở đâu | Máy được giữ gì |
|---|---|---|---|
| **A. Chỉ máy chủ** | Mô hình dự báo cá + mọi thông số đã fit (`SPECIES_PROFILES`, fish-base, chain, climatology dựng), dữ liệu dựng (`fleet-effort`, `species-catch`, VMS, sổ tàu), URL/mã bộ dữ liệu nguồn, mã mô hình thời tiết, prompt LLM đám mây, luật kiểm duyệt, chọn nguồn/lùi nguồn | `src/app/api/**`, file `import "server-only"`, `scripts/` | KHÔNG gì cả — chỉ kết quả số qua API |
| **B. Chạy trên máy vì offline** | Dẫn đường (`route-plan`), lộ trình chuyến biển (`lo-trinh/*`), thuỷ triều điều hoà, Sen Biển offline, giải mã SDF2 | client | Thuật toán chung + **tham số tải về đã mã** (`model-params` SDF2). KHÔNG hằng số đã fit viết cứng, KHÔNG tên nguồn, KHÔNG chú thích (đã bị minify xoá — nhưng chuỗi thì không) |
| **C. Kết quả** | Lưới cá đã chấm, lưới gió sóng, bão, giá, độ sâu… | API → kho offline | Chỉ số + thời điểm (`generatedAt`, `savedAt`). KHÔNG `source`, `model`, `builtFrom`, `sources`, `chain`, `hint.why`, payload thô của nhà cung cấp |

## 2. Quy tắc code (client)

1. **Không URL bên thứ ba trong code client.** Mọi nguồn ngoài đi qua route của mình (`/api/...`) với tên trung tính. Hằng URL nguồn (`ERDDAP`, `OM_HOST`, `VASEP_LISTING_URL`, `ACA_BENTHIC_URL`…) chỉ nằm trong file `server-only`. Module dùng chung client/server ⇒ tách đôi: `x.ts` (client: nhãn, màu) + `x-server.ts` (URL, tải).
2. **Không tên nguồn / mã bộ dữ liệu / mã mô hình trong CHUỖI client** (chuỗi sống qua minify; chú thích thì không). Cấm: `noaacw*`, `ncep_gfswave025`, `ecmwf_*`, `gfs05`, tên nhà cung cấp trong id (`gdacs-…`, `nchmf-…`). Dùng mã mờ (`a`, `b`, `m1`) — bảng đổi nằm ở server.
3. **Không thông số đã fit trong code client.** Số rút từ dữ liệu/nghiên cứu (trọng số, ngưỡng loài, hiệu ứng trăng, phạt tuyến đã tune) ⇒ đi qua `model-params` (SDF2, `scripts/build-model-params.mjs`). Số chuẩn công khai (thang Beaufort, công thức thiên văn) thì được viết thẳng.
4. **Import một mảng lớn chỉ để lấy vài trường = ship cả mảng.** Tách file chỉ-hiển-thị (vd `species-meta.ts`) — tree-shaking không cứu được mảng dựng lúc nạp module.
5. **Chunk quản trị `/quan-tri` tải được không cần quyền** (file tĩnh). Chữ trợ giúp hạ tầng (đường dẫn `~/.config/...`, tên hệ thống tích hợp, env) lấy từ API admin, không viết trong component.
6. **`public/*.js` (sw.js, worker) phát NGUYÊN VĂN** — chú thích ở đó đi xuống máy. Không viết tên nguồn trong chú thích file `public/`; (nợ) bước build bỏ chú thích sw.js.
7. **Không source map production** (`productionBrowserSourceMaps` để mặc định tắt), `poweredByHeader: false`.

## 3. Quy tắc API trả xuống máy

1. **Không chuyển tiếp payload thô của nhà cung cấp** (vd JSON Open-Meteo còn `generationtime_ms`, `hourly_units`): route dựng lại hình CỦA MÌNH.
2. **Không chuyển tiếp câu lỗi của nguồn** (`e.message` = "Overpass 429"): trả `{ ok:false, code:"unavailable" }`.
3. **Mỗi route dữ liệu có một hàm `toClient…()`** liệt kê TƯỜNG MINH trường được đi xuống (danh sách cho phép, không danh sách cấm). Trường chẩn đoán (`sources`, `dataQuality`, `chain`, `mode`, `builtFrom`) chỉ ở route admin.
4. **Client không chọn nguồn/mô hình bằng tên thật** (`?models=ncep_gfswave025` lộ trên mạng) — server chọn.
5. Route công khai không cần đăng nhập (`/api/status`, …) không trả khối `model`/tuổi mô hình.

## 4. Kho offline + `public/data`

1. Máy chỉ cất **kết quả** (nhóm C). Lưu bản đã qua `toClient…()`; đọc bản lưu cũ thì lọc lại lúc đọc.
2. File `public/data/**`: bước mã hoá (`scripts/encode-data.mjs`) **bỏ trường `nguon/source/sources/url/credit/builtFrom/giayPhep`** trước khi mã (bản rõ có nguồn vẫn ở git/server). Tên file trung tính — không `-aca`, `-etopo`, `-osm` trong tên.
3. **Khoá SDF2 trên máy** là trần đã biết (CLAUDE.md "Trần PWA"): chặn người KHÔNG tài khoản, không chặn người có tài khoản. Không coi mã hoá là chỗ giấu thuật toán — chỗ giấu là KHÔNG đưa xuống (nhóm A).

## 5. Cổng chặn tự động — `scripts/kiem-lo-bundle.mjs`

- Chạy trong `npm run build` (sau `next build`, cả Vercel). Quét `.next/static/**` + `public/*.js` — tức đúng thứ trình duyệt tải — tìm tên nguồn, host, mã mô hình, tên trường nội tạng mô hình (`MAU` trong script).
- **Bánh cóc**: mẫu đã có trong `scripts/kiem-lo-bundle.no.json` (nợ, mỗi dòng có cách trả) thì qua; **mẫu mới ⇒ build đỏ**. Trả xong nợ ⇒ script in "ĐÃ SẠCH" ⇒ xoá dòng.
- Thêm dòng nợ chỉ khi: ghi công bắt buộc theo giấy phép, hoặc chữ nghiệp vụ bà con cần (vd "giám sát hành trình"), và **anh Long duyệt**. Không nới nợ để build qua.
- Xem toàn bộ chỗ trúng: `node scripts/kiem-lo-bundle.mjs --liet-ke`.
- Thêm nguồn ngoài mới ⇒ thêm mẫu tên/host của nó vào `MAU` CÙNG commit.

## 6. Nợ đã đo 2026-11-08 — thứ tự trả

| # | Nợ | Mức | Cách trả | Ảnh hưởng offline |
|---|---|---|---|---|
| 1 | `SPECIES_PROFILES` (thông số fit 39 loài: `sst`, `chlLog`, `w`, cổng bờ/khơi) ship vì `SPECIES_META` dựng từ cả mảng (`fish-predict.ts:365`, chunk thật có `thermFront:.3…`) | Cao | Tách `species-meta.ts` chỉ-hiển-thị; profiles server-only | Không — chấm cá đã ở server |
| 2 | `/api/fish-forecast` trả `sources` (id `noaa-coraltemp-sst`, `hycom-gofs`…), `baseMode:"catch-fleet-static"`, `chain`, `hint.why`; cất nguyên vào IndexedDB + SW | Cao | `toClientFish()`; `baseMode` → cờ boolean; khối chẩn đoán sang route admin; lọc lại bản lưu lúc đọc | Không |
| 3 | `/api/om` chuyển tiếp JSON thô Open-Meteo + câu lỗi; client gửi `models=ncep_gfswave025…` | Cao | Server chọn mô hình theo mã mờ; dựng lại hình riêng; đổi tên route | Không (đọc bản lưu như cũ) |
| 4 | `weather-snapshot` (`sea:*`, `grid:dN`, `scalar:*`) mang `sources:[{id:"copernicus-wav"…}]` | Cao | Bỏ `sources` trước `Response.json` | Không |
| 5 | `public/data` bên trong vẫn có `nguon/source/url/builtFrom` (soundings, vn-aids, xac-tau, fish-climatology, model-params, fleet-density, chat-day…); `model-params` có `builtFrom` + kết quả kiểm định chéo | Cao (với người có khoá) | Bước lọc trường trong `encode-data.mjs`; `build-model-params` chỉ xuất mảng số | Không |
| 6 | `sea-scalars.ts` URL ERDDAP coastwatch + mã `noaacw*` trong bundle | TB | Tách `sea-scalars-server.ts` | Không |
| 7 | `fleet-density.v1.json` (bảng giờ đánh theo tháng × trăng × nghề từ VMS) + hàm dự báo ở client | TB–Cao | Server tính lưới theo ngày, máy cất các ngày đã xem | Có — phải cất sẵn đủ ngày chuyến |
| 8 | `/api/storms` `sources:{nchmf,gdacs}`, id `nchmf-…`/`gdacs-…`, `earlyWarning.url`; `/api/port-prices` `source:"vasep"`; `/api/nautical` `detail: e.message`, id `node/123` | TB | Bỏ trường, băm id, mã lỗi chung | Không |
| 9 | Lộ trình chuyến biển: `HIEU_UNG_RAM`, `LOAI_THEO_NGHE` viết cứng (`lo-trinh/he-so.ts`, `dau-vao.ts`) | TB | Chuyển vào `model-params` | Không (params đã cất offline) |
| 10 | Chunk quản trị: chữ trợ giúp `~/.config/forlife/*.env`, SDWork, S-Tracking, "NOAA/Copernicus/HYCOM" | TB | Chữ trợ giúp từ API admin | Không |
| 11 | `tide-stations.v1.json` (SDF1, ai cũng đọc): `credit`, `source` từng trạm, `phaseConvention` nhắc `src/lib/tides.ts` | TB | Lọc trường lúc mã | Không |
| 12 | `public/sw.js` phát nguyên văn kèm chú thích (Protomaps, OSM, GDACS…); tên file `reef-shapes-aca` | Thấp–TB | Bỏ chú thích sw.js lúc build; đổi tên file qua bảng ánh xạ | Có — đổi tên file phải chạy bộ `qa-offline-acceptance` |
| 13 | `src/data/wholesalers`, `seafood-buyers`: trường `source` = URL trang vàng/mã số thuế | Thấp | Bỏ `source` khỏi bản client | Không |
| 14 | `poweredByHeader` chưa tắt; `/api/status` công khai trả khối `model` | Thấp | Tắt; gác `/api/status` | Không |
| 15 | Ghi công: chú thích bản đồ `ocean-map.ts` ("NASA · ETOPO/EMODnet/GEBCO · OpenSeaMap · OSM · Protomaps · Open-Meteo"), "Nguồn Copernicus Marine" (`scalar-field.ts`), "Giá tuần của VASEP"; trang Quyền riêng tư còn câu "app gửi toạ độ tới các nhà cung cấp" (nay đã qua máy chủ — sai) | Pháp lý | Gom về MỘT trang Nguồn; sửa câu Quyền riêng tư; **hỏi luật sư** dạng ghi công | Không |

**Đã đúng sẵn** (giữ): lõi chấm cá server-only (`fish-forecast-run`, `fish-snapshot` có `server-only`); trọng số pha + bảng kỹ năng qua `model-params` SDF2; không source map production; LLM đám mây + luật kiểm duyệt ở server; ô bản đồ qua proxy tên trung tính; nền bản đồ cùng origin; mọi route dữ liệu qua `dataGate`; `public/data` mã SDF2 mặc định, deploy `--verify`.

## 6b. Đã trả 2026-11-08 (phiên trả nợ — chờ anh Long duyệt commit)

| # | Đã làm | File chính | Offline |
|---|---|---|---|
| 1 | `species-meta.ts` = bảng HIỂN THỊ viết thẳng (tên/màu/nhóm/tầng nước); `SPECIES_WMAX` dựng lười; client không import `fish-predict.ts` nữa (đọc qua `fish-forecast-client.ts`) | `species-meta.ts`, `fish-forecast-client.ts`, `species-meta.test.ts` | Không đổi |
| 2 | `toClientFish()` = danh sách CHO PHÉP (ô: lat/lon/s/top/sp/t/c/hint.sat; bản: date/species/generatedAt/targetDate/`baseMode` cờ/`anhCu` cờ). Route bọc mọi nhánh; 503 trả `{code:"unavailable"}`. Máy lọc lại lúc đọc IndexedDB + kho SW ⇒ bản cũ còn `sources/chain` vẫn dùng được, không xoá. Chẩn đoán nguồn sang `GET /api/admin/he-thong` | `fish-forecast-client.ts`, `api/fish-forecast/route.ts`, `api/admin/he-thong/route.ts` | Bản lưu cũ đọc được (test `api-fish-forecast-status`, `source-registry`) |
| 3 | `/api/om`: máy gửi `m=s1` (mã mờ), máy chủ đổi ra `models=` (`OM_MODEL`); `models=` từ máy bị từ chối; thân trả về dựng lại (`omShape`); 400 của nguồn ⇒ `{code:"bad_query"}` | `om-url.ts`, `api/om/[api]/route.ts` | Không (máy cất số vào IndexedDB như cũ; `/api/om` không nằm trong kho SW) |
| 4 | `/api/weather-snapshot` bỏ `sources` (`snapshotChoMay`) | `snapshot-today.ts` | Không |
| 5 | `encode-data.mjs` `locTruongNguon`: bỏ khoá lý lịch cấp đầu + lọc riêng tide-stations/soundings-verified theo đúng hàm đọc; `build-model-params` v2 chỉ xuất số app đọc | `scripts/encode-data.mjs`, `scripts/build-model-params.mjs`, `encode-loc-nguon.test.ts` | Hàm đọc ra y bản rõ (test). `prov`/`url` thông báo hàng hải GIỮ (thông tin nhà nước, provenance đọc) |
| 6 | URL/mã bộ dữ liệu ERDDAP sang `sea-scalars-server.ts` | `sea-scalars-server.ts` | Không |
| 7 | Lưới mật độ tàu RỜI `public/data` → `src/data/fleet-density.v1.json` (git mv, chỉ máy chủ đọc). `GET /api/fleet-density?nghe&tu` trả NỀN 16 ngày (mùa × trăng, chấm theo vùng); máy cất cả bộ (`forfish.fc.fleetnen.<nghề>`), tự nhân gió + bão | `fleet-density.ts` (máy), `fleet-density-server.ts`, `api/fleet-density/route.ts` | CÓ: bộ 16 ngày cất trong máy, mất sóng dùng bộ đã cất; máy chưa từng tải = "chưa tải" như trước. Lớp này vẫn chỉ xem-trước nội bộ |
| 8 | Bão: id băm `b<hex>` + `key` khoá cơn do máy chủ gắn, khoá cơn quốc tế `qt-…`; bỏ `sources`, `earlyWarning.url`. Giá: `source:"tuan"` (bản lưu cũ chuẩn lại lúc đọc), URL nguồn sang server. Nautical: id băm, lỗi mã chung | `storm-identity.ts`, `port-price-source(-server).ts`, `api/nautical/route.ts` | Link push cũ vẫn nối cơn theo tâm + giờ |
| 9 | `HIEU_UNG_RAM`, `LOAI_THEO_NGHE` → `src/data/lo-trinh-params.json` → `model-params.loTrinh` | `lo-trinh/he-so.ts`, `lo-trinh/dau-vao.ts` | Chưa nạp tham số ⇒ trăng trung tính, chấm theo loài tốt nhất (không ném, không trắng) |
| 10 | Bảng khoá cấu hình (chữ trợ giúp, đường dẫn máy GPU) sang `app-config-meta.ts`; nhãn nguồn tab Hệ thống từ `/api/admin/he-thong` (`admin-nhan-server.ts`); "SDWork" trong chữ quản trị → "CRM" | `app-config-meta.ts`, `admin-nhan-server.ts`, `tab-he-thong.tsx` | Không |
| 11 | tide-stations: bỏ `credit`, `phaseConvention`, `stations[].source`; câu ghi chú "mô hình EOT20" → "mô hình thuỷ triều" | `encode-data.mjs` `LOC_RIENG` | Không |
| 12 | `scripts/bo-chu-thich-public.mjs` bỏ chú thích `public/*.js` lúc build phát hành (terser kèm Next, không nén/đổi tên); cổng quét đọc bản đã bỏ. `reef-shapes-aca.v1.*` → `ran-chi-tiet.v1.*` (git mv) + `TEN_CU_DATA` trong sw.js: kho nền đã có tên cũ thì dùng luôn | `public/sw.js`, `bo-chu-thich-public.test.ts` | CÓ — xem `qa-offline-acceptance.md` mục 2026-11-08 |
| 13 | Trường `source` của 93 vựa → `src/data/wholesalers/nguon.json` (không import); chữ "theo VASEP / masothue" trong ghi chú → chữ chung | `src/data/wholesalers/*`, `seafood-buyers.ts` | Không |
| 14 | `poweredByHeader:false`; `/api/status` công khai bỏ khối `model` (kèm `Bearer CRON_SECRET` mới có) | `next.config.ts`, `api/status/route.ts`, `scripts/smoke.mjs` | Không |
| 15 | Trang `/nguon-du-lieu` (máy chủ dựng, không vào bundle) gom ghi công; bản đồ chỉ còn `© OpenStreetMap · OpenSeaMap` + link; sửa câu Quyền riêng tư (máy chỉ hỏi máy chủ SDFish). **⚠️ CHỜ LUẬT SƯ** duyệt dạng câu ghi công | `app/nguon-du-lieu/page.tsx`, `ocean-map.ts` `ATTRIBUTION_BAN_DO` | Không |
| 16 | (09/11) Nợ `vms` trả: bỏ chữ viết tắt "(VMS)" ở 3 câu bà con thấy — thẻ gia hạn, gợi ý vật tư, nhãn kiểm xuất bến — giữ tên luật "giám sát hành trình"; xoá dòng `vms` khỏi `kiem-lo-bundle.no.json` | `vms-renewal.tsx`, `boat-products.tsx`, `departure-check.ts` | Không |

**Còn lại trong `kiem-lo-bundle.no.json`** (re-verified 2026-11-09, `next build` + quét): CHỈ `supabase-host` — host + khoá publishable của Supabase trong client đăng nhập. Không trả được bằng code an toàn: proxy qua `/sb` đổi tên cookie phiên (`sb-<ref>-auth-token`) ⇒ đăng xuất mọi tài khoản + bản native cần URL tuyệt đối; đường đúng là tên miền riêng cho Supabase (gói trả phí + DNS — anh Long quyết).

## 7. Trần không vượt được (nói thật với chủ dự án)

- Thuật toán nhóm B (dẫn đường, lộ trình, thuỷ triều) vẫn đọc được bằng dịch ngược — chỉ giấu được tham số và nguồn.
- Mô hình Sen Biển trên máy (Gemma tinh chỉnh ~62 MB trong gói Android/iOS, n-gram) rút được khỏi gói cài — tài sản thật là dữ liệu + quy trình huấn luyện (không nằm trên máy).
- Người có tài khoản rút được khoá SDF2 ⇒ đọc được file dữ liệu đã tải. Giảm thiệt hại = mục §4.2 (file không mang nguồn) + nhóm A (không đưa thứ giá trị cao xuống).
