# 04 — Data model: schema, RLS, logic giấy tờ

> **Mục đích / Purpose**: Nguồn canonical về database (Supabase) và domain logic Trục 4 (tủ giấy tờ + trạng thái hạn).

**Load khi / Load when**: đụng DB/migration/RLS, sửa `src/lib/documents.ts`, nối vault với Supabase, hoặc thêm bảng mới.

covers: supabase/migrations, src/lib/documents.ts, src/lib/owned-assets.ts, src/lib/sdwork-webhook.ts, src/lib/sdwork-outbound.ts, src/lib/phone.ts
last_verified: 2026-11-12
<!-- re-verified: 2026-11-12 — `lib/phone.ts` thêm `contactPhone(session, typed)` (THUẦN, chọn SĐT người liên hệ cho /api/sdvico/order + /api/sdvico/request: có phiên ⇒ SĐT phiên — vá G13 ba-spec 19). KHÔNG đổi schema, migration, RLS hay cách chuẩn hoá SĐT (`normalizeVnPhone`/`isValidVnPhone` giữ nguyên). -->
<!-- re-verified: 2026-11-09c — `model-params.v1.json` khối `loTrinh`: BỎ `loaiTheoNghe` (chủ tàu tự chọn loài), THÊM `dauTrungBinh{nghề:{litGio, litDem?}}`; `hieuUngRam` thêm `keo-doi` −0,097 · `luoi-keo` 0; `chang.luoi-re` 0,79/5,06/1,31. Nguồn sự thật `src/data/lo-trinh-params.json`. Kho máy: `forfish.routes.v1` input thêm `loai?` (tuỳ chọn). Không migration, không RLS. -->
<!-- re-verified: 2026-11-08g — `model-params.v1.json` `loTrinh.dayNghe` {nghề: {ran,n2,n4,n12,sau,gan}} + `loTrinh.dayO` {"i,j": [6 tỉ phần]} (nguồn `src/data/lo-trinh-params.json` + `src/data/day-o025.json` MỚI, ~31 KB, chỉ số). `forfish.routes.v1[]` thêm trường tuỳ chọn `trongSo: [{ma, ten, trangThai, cau}]` (bảng lớp dữ liệu lúc tính); bản cũ không có vẫn đọc. Không đổi tên khoá, không migration. -->
<!-- re-verified: 2026-11-08i — KHOÁ MÁY MỚI `forfish.trip-log.v1` (localStorage, `lib/lo-trinh/nhat-ky.ts`): mảng `NhatKyChuyen` {routeId, ten, nghe, ngayDi, ngayNenVe, viTri[{at, lat, lon, cachHaiLy, ngayThu}], sanLuong?{kg, luc}} — đo hiệu quả lộ trình CHỈ TRONG MÁY, trần 60 chuyến × 200 lần; sao lưu `transfer`. `forfish.routes.v1[]` thêm trường tuỳ chọn `input.diemDau`, `ketQua.dauTheoPha {chay, danh, den}`, `ketQua.tuChoDung`. KHÔNG bảng/migration Supabase. -->
<!-- re-verified: 2026-11-08c — `model-params.v1.json` `loTrinh.chang` MỚI: {nghề: {aGio, vKn, p80HeSo}} (nguồn `src/data/lo-trinh-params.json`, số đo vết tàu — docs/research/vet-tau-pha-nghe-2026-11.md §6); app đọc qua `lo-trinh/he-so.ts moHinhChang`, thiếu ⇒ mặc định dè dặt. Không đổi tên khoá, không migration. -->
<!-- re-verified: 2026-11-08b — DỮ LIỆU KHÔNG LỘ NGUỒN (docs/app-map/ops/khong-lo-nguon.md §6b). (1) `public/data/fleet-density.v1.json` → `src/data/fleet-density.v1.json` (git mv, CHỈ máy chủ đọc bằng fs; scripts build-fleet-density/add-density-species ghi vào đây). (2) `reef-shapes-aca.v1.{pmtiles,bin}` → `ran-chi-tiet.v1.{pmtiles,bin}` (git mv, nội dung y nguyên; `PREMIUM_SDF2` theo tên mới; sw.js `TEN_CU_DATA` đọc bản đã cất dưới tên cũ). (3) `model-params.v1.json` v2: chỉ `fishBlend.perLead[{lead,w}]`, `fishBlend.guard.degenerate`, `forecastSkill.perLeadDay[…số]`, `loTrinh{hieuUngRam, loaiTheoNghe}` (nguồn sự thật `src/data/lo-trinh-params.json` MỚI); bỏ builtFrom/method/caveat/kiểm định chéo. (4) `encode-data.mjs` `locTruongNguon` lúc mã: bỏ khoá cấp đầu nguon/source/sources/credit/builtFrom/giayPhep/phaseConvention/attribution; tide-stations bỏ `stations[].source`; soundings-verified chỉ giữ trường decodeVerdicts đọc. Bản RÕ trong git giữ nguyên. (5) `src/data/wholesalers/nguon.json` MỚI (id → URL nguồn, không import); trường `source` rời khỏi `Wholesaler`. (6) Kho máy MỚI: `forecast-cache` ns `fleetnen`, id = nghề (bộ nền 16 ngày). Không migration, không RLS. -->
<!-- re-verified: 2026-11-06 — MIGRATION 0086 `sdt_khac` (thay `customers.sdt_phu` 0084): ≤3 số/tài khoản, một số đã duyệt một người, dòng chờ của bà con; ✅ ĐÃ APPLY prod 2026-11-06 (20261106044448). -->
<!-- re-verified: 2026-11-05i — MIGRATION 0084 `customers.sdt_phu` (+ `sdt_phu_luc`): 1 SĐT phụ/tài khoản, check 10 số + khác SĐT chính, index một phần; chỉ nhân viên gán (PATCH /api/admin/accounts/sdt-phu). Tra máy S-Tracking theo SĐT chính + phụ qua `lib/stracking/sdt-phu`. ✅ ĐÃ APPLY prod 2026-11-05 (20261105150914, Supabase MCP, anh Long "Áp và gán luôn"); gán tay 0918388742 ⇒ sdt_phu 0946364444 (+1 dòng nhật ký account.sdt-phu). -->
<!-- re-verified: 2026-11-05h — MIGRATION 0083 `dong_y_dieu_khoan` (anh Long 05/11: T&C lúc đăng ký/đăng nhập lần đầu, "1 cái click là đồng ý"): bảng chỉ-thêm phone · ban · luc_may · luc_chu · nguon (dang-ky|dang-nhap|mo-app) · platform · user_agent; RLS bật, 0 policy, revoke anon/authenticated (khuôn 0065). Ghi qua POST /api/me/dong-y, đọc ở /api/auth/token (`dongYBan`). ✅ ĐÃ APPLY prod 2026-11-05 (20261105141841). Code chịu được bảng chưa có (503 ⇒ máy giữ treo, gửi bù). -->
<!-- re-verified: 2026-11-05g — KHOÁ GIA HẠN VÀO /quan-tri: KHÔNG migration. `app_config` thêm 2 khoá: `sdfish_renewal_secret` (secret, env dự phòng SDFISH_RENEWAL_SECRET; ≥16 ký tự, không khoảng trắng — phải TRÙNG secret bên CRM) + `sdwork_crm_url` (không secret, env dự phòng SDWORK_SUPABASE_URL; đúng khuôn https://<ref>.supabase.co). Ô DB thắng env. Chỉ luồng gia hạn (lib/renewal-server) đọc hai ô này. -->
<!-- re-verified: 2026-11-04 — KHO Ô BẢN ĐỒ: KHÔNG migration. `app_config` thêm khoá `kho_o_tran_mb` (không secret, env dự phòng SDFISH_KHO_O_MB; 100–100000 MB, mặc định 2048) = trần ngăn máy chủ tự tải của kho ô đĩa (lib/kho-o-ban-do). Ô bản đồ lưu trên ĐĨA máy chủ, không vào DB/Storage. -->
<!-- re-verified: 2026-11-03 — MIGRATION 0079 `vai_viec_lam` (spec 17, anh Long: "tổ chức hệ thống account … ngư dân vô kiếm việc … đại lý … thu mua … chủ tàu"): `customers.vai` (ngu-dan|chu-tau|thu-mua|dai-ly|null, check) + `vai_doi_luc` + `vai_xac_minh_at` + index; suy vai cho hàng null theo §3.2 (shops ⇒ dai-ly · devices/user_docs boats ⇒ chu-tau · kairos nghe thu-mua ⇒ thu-mua); bảng `job_posts` · `job_seekers` · `job_reports` · `vua_profiles` (RLS bật, 0 policy, revoke anon/authenticated — khuôn 0065). ✅ ĐÃ APPLY prod 2026-11-03 (20261103071342). Code chịu được cột chưa có: /api/me/vai trả 503, cổng bản đồ theo vai bỏ qua (fail-open). -->
<!-- re-verified: 2026-11-02 — API ĐƠN VỊ TÍCH HỢP AIS: KHÔNG migration. `app_config` thêm khoá `doi_tac_ais` (secret, env DOI_TAC_AIS) = danh sách `ten:sha256(token):khu(1–5 viết liền):goi(60|30)` — chỉ lưu băm, token rõ in một lần ở scripts/doi-tac-khoa.mjs. `weather_snapshot` thêm 2 khoá `tau-ais:goi-60`, `tau-ais:goi-30` (bản AIS chép theo nhịp gói license, ghi ở POST /api/tau-ais/nhap; không nằm trong whitelist /api/weather-snapshot). -->
<!-- re-verified: 2026-10-31 — MIGRATION 0078 `tau_ais_quanh` (anh Long: "xem tàu có phát AIS trong bán kính 6 hải lý trong 6h"): KHÔNG thêm bảng/cột — hàm `tau_ais_quanh(p_lat, p_lon, p_km, p_tu bigint)` stable security definer đọc `tau_ais_vet` (0076): dòng có `ngay` ≥ ngày VN của `p_tu` và `cap_nhat` ≥ `p_tu`, bung `diem`, giữ mốc giờ ≥ `p_tu` lọt hộp độ quanh tâm (km ≤100, cos vĩ độ ≥0,2), trả (tau_id, diem các mốc lọt) mỗi tàu một dòng, tối đa 2000; vòng tròn thật lọc lại ở route (`lib/tau-ais-quanh gopTauQuanh`). Revoke public/anon/authenticated — chỉ service role. **ĐÃ APPLY prod 2026-11-01** (qua SUPABASE_DB_URL; thử quanh Vũng Tàu 6 giờ ra 123 tàu). Hàm hỏng ⇒ route `chiBan:true`, chỉ tàu trong bản mới nhất. -->
<!-- re-verified: 2026-10-29 — doc-health báo symbol chết: §3d còn ghi hàm chặn riêng tư cũ của `sw.js` ⇒ sửa theo hiện trạng (allowlist `API_CACHE_ALLOW` + `isCacheableApiPath`; `purgeApiCache` ↔ message `forfish:purge-api-cache` vẫn còn). Rà commit covers từ 19/10: migration 0065–0075 đều đã có mục + ghi chú apply; `documents.ts` chỉ thêm `giayTuUrl` (c3e12c60) ⇒ thêm 1 dòng §3; `DOCUMENT_KINDS` 7 loại, `getExpiryStatus` (`days===0` → expired) khớp bảng; owned-assets/sdwork-*/phone không đổi. -->
<!-- re-verified: 2026-10-29 — `documents.ts` thêm `giayTuUrl` (c3e12c6) ⇒ ghi vào §3; `DocumentKind` 7 loại, `getExpiryStatus`/`byUrgency` khớp bảng §3. Migration tới 0075 đều có mục. Mục 3d (audit 2026-07-29) sửa: hàm chặn /api riêng tư cũ không còn, sw.js nay dùng allowlist `API_CACHE_ALLOW` + `isCacheableApiPath()` (khớp `sw-cache-policy.ts`); `purgeApiCache` + `SDFISH_API_V` sdfish-api-v2 vẫn đúng. -->
<!-- re-verified: 2026-10-26c — thêm migration 0075_kairos_dinh_kem_dong (bảng dòng tàu trong PDF đính kèm thông báo gov, RLS + revoke) — 14 §21b. ĐÃ APPLY 2026-10-26. -->
<!-- re-verified: 2026-10-26b — thêm migration 0074_kairos_chinh_sach (check topic + `chinh-sach` ở kairos_sources/kairos_posts; cột `kairos_posts.attachments jsonb` ≤10) — 14 §21. ✅ ĐÃ APPLY 2026-10-26 qua connector Supabase (trước khi deploy — `supabase-store` POST_COLS chọn cột này). -->
<!-- re-verified: 2026-10-26 — TÀU XUNG QUANH (AIS): KHÔNG migration — bản vị trí tàu ghi đè khoá `tau-ais:latest` trong bảng snapshot chung `weather_snapshot` (payload `{v:1, luc, soTau, tau[]}` ~1 MB, service-role qua lib/weather-snapshot); app_config thêm khoá `tau_ais_key` (secret, env-thắng TAU_AIS_KEY). -->
<!-- re-verified: 2026-10-29 — QUYỀN XEM AIS THEO TÀI KHOẢN (anh Long: "AIS là chỉ cho Long view thôi nhé, cũng 1 dạng option bật cho ai người đó view đc"): KHÔNG migration — app_config thêm khoá `tau_ais_xem` (KHÔNG secret, env lùi TAU_AIS_XEM): danh sách SĐT ngăn phẩy/chấm phẩy/xuống dòng, chưa đặt ⇒ chỉ 0938635689 (`lib/tau-ais/quyen.ts` MAC_DINH_XEM_AIS). Kiểm ở ranh giới: mọi mẩu phải là SĐT hợp lệ (`danhSachSdtHopLe`). -->
<!-- re-verified: 2026-10-30 — MIGRATION 0077 `kairos_do` (14 §22, Đo Kairos — CDP nội bộ): bảng `kairos_tai_tro_dem` + hàm `kairos_record_tai_tro` + `kairos_do`; ĐÃ APPLY 2026-10-30. -->
<!-- re-verified: 2026-10-29b — MIGRATION 0076 `tau_ais_vet` (anh Long: "tổ chức DB lưu các vị trí thông tin các tàu AIS này, 1h 1 lần để biết cả lộ trình tàu"; "lưu ở server 7 ngày, phần còn lại đưa xuống local … lưu vĩnh viễn dùng để học cái pattern"): bảng MỚI `tau_ais_vet` (tau_id text, ngay date [giờ VN], diem jsonb [[epoch_s, lat, lon, kn, huong]] ≤24/ngày, cap_nhat; PK (tau_id, ngay), index ngay; RLS bật + revoke, không policy — chỉ service role) + hàm `ghi_vet_ais(p_gio bigint, p_ds jsonb)` security definer: nối điểm khi giờ mới hơn điểm cuối (gọi lại cùng giờ = không làm gì), xoá ngày < hôm nay − 7. Ước ~66 nghìn dòng (8 300 tàu × 8 ngày) ≈ 30–60 MB — **SAI, đo lại 2026-10-30**: từ khi quét cả Biển Đông, ~56 nghìn tàu MÃ CỐ ĐỊNH/ngày, jsonb ~82 byte/điểm ⇒ ước ~60 MB/ngày, ~0,5 GB khi đủ 8 ngày (+ chỉ mục; gói Supabase Pro, chưa chạm trần). Trước bản lọc `idCoDinh` trong `thamSoVet` (lên prod 30/10 10:45) bảng đã nhận 275 432 dòng mã rút `v…` (1 điểm/dòng, đổi mã mỗi lượt) — đã xoá tay 30/10 (`delete … where tau_id ~ '^v[0-9a-z]{3,}$'`); từ đó không phát sinh thêm. ĐÃ ÁP 2026-10-29 (anh Long chạy file ở SQL Editor — công cụ áp migration hết giờ chờ xác nhận 3 lần ⇒ KHÔNG có dòng trong lịch sử migration Supabase; kiểm: bảng có, RLS bật, anon không gọi được hàm, hàm ghi/bỏ qua cùng giờ/nối giờ sau đúng). Route POST /api/tau-ais/nhap gọi `ghi_vet_ais` qua `thamSoVet` (lib/tau-ais/chuan-hoa.mjs). Còn một dòng thử `kiem-thu-claude` (tự xoá sau 7 ngày). Kho vĩnh viễn ở máy thu nhà (ops/runbook). -->
<!-- re-verified: 2026-10-27 — ĐỒNG BỘ sdvico/forfish `main` (562d36e8, 9 commit Nam/Hùng 19–21/10) vào main Forfun (anh Long 26/10: "lên hết cả Sen Biển lẫn Kairos sang SD"). NHẬN: thuỷ triều 21 trạm ngoài cửa biển + xem con nước theo giờ (`tide-card`, `lib/tides`, `use-pointer-scrub`), nhắc hạn giấy tờ 30·25·20·15·10 rồi 5→0 + `DocRemindOnOpen` ở trang chủ (`lib/doc-reminder-local`), chuông SDFish khi push tới lúc app mở (`sw.js`, `warning-sound`, `sw-register`), push thuyền viên mở /nguoi, `windows-paths.test`. GỠ: cờ demo `NEXT_PUBLIC_SEN_BIEN`/`lib/sen-bien/bat-tat.ts` (Sen Biển + Kairos phát hành ở SD; ops/sync-base-flow §0b đóng án lệ). KHÔNG LẤY: rail "Chức năng" của sdvico 21/10 (`ra-khoi-rail-menu.test` xoá) — main đã đi tiếp sang rail Lớp-popover + khay ⋯ (22/10, BD-12 25/10). Mảnh giọng "còn" giữ `con_m.mp3` (sdvico đặt `con_`). -->
<!-- re-verified: 2026-10-25c — thêm migration 0073_sdvico_hoi_thoai; 0072 phiếu nay do máy chủ tự lập từ hội thoại — 14 §3.14 -->
<!-- re-verified: 2026-10-20 19:00 — AUDIT nhắc hạn (ops/audit-notify-2026-10-20): đối chiếu code `stormYieldsToReminder` (nhường bão chỉ khi tin ≤12h), sheet đánh dấu lúc HIỆN, `docPushUrl` toàn giấy thuyền viên → `/nguoi`, `keepLatestDocReminder` trong `/api/me/messages`. -->
<!-- re-verified: 2026-10-20 17:30 — NHẮC HẠN GIẤY TỜ: đối chiếu code `lib/doc-reminders.ts` (DOC_REMIND_DAYS 30·25·20·15·10 + 5→0, quá hạn ×3), `lib/doc-reminder-local.ts` + `components/doc-remind-on-open.tsx` (sheet khi mở Trang chủ, sổ `forfish.docRemindSeen.v1`, nhường bão qua `savedStormActive`), `public/sw.js` push `renotify: true` khi có tag. Soi trình duyệt 375px. -->
<!-- re-verified: 2026-10-25b — thêm migration 0072_sdvico_khach_hoi (phiếu khách hỏi sản phẩm SDVICO) + khoá app_config sdvico_lead_key — 14 §3.14 -->
<!-- re-verified: 2026-10-26e — `sdvico_khach_hoi` nhận thêm PHIẾU ĐĂNG KÝ KHUYẾN MÃI (POST /api/sdvico/khuyen-mai): nguon=san-pham, san_pham = `KhuyenMai.tenPhieu` ("KM Sứ định vị GPS 200k"), cang = nơi nhận, loi_nhan = "Đăng ký mua N cái · nhận tại … · ghi chú: …", nguoi_gui = SĐT tài khoản (null khách lạ). KHÔNG đổi schema. -->
<!-- re-verified: 2026-10-24m — app_config thêm khoá NỘI DUNG `kairos_ads` (JSON ≤20 bài Tài trợ, 14 §20) — KHÔNG thuộc CONFIG_KEYS (không hiện ở tab Hệ thống), ghi qua /api/admin/kairos/ads (service-role). Không migration (bảng là KV). -->
<!-- re-verified: 2026-10-24r — thêm migration 0071_kairos_nhac_ten (mentions jsonb cho kairos_posts + kairos_comments) — 14 §3.12 -->
<!-- re-verified: 2026-10-24q — thêm migration 0070_kairos_binh_luan_anh (kairos_comments.image_path + link_preview, body có thể trống khi có ảnh) — 14 §3.4b -->
<!-- re-verified: 2026-10-24c — thêm migration 0069_kairos_cam_xuc (cột kind cho kairos_post_hay / kairos_comment_hay) — 14 §7 -->
<!-- re-verified: 2026-10-24b — thêm migration 0068_kairos_sen_bien (seed hồ sơ Sen Biển) — 14 §14 -->
<!-- re-verified: 2026-10-24 — thêm migration 0067_kairos_ho_so (kairos_profiles + cover_path/que_tinh/nghe/gioi_thieu/home_port — trang cá nhân kiểu FB, 14 §3.8) — ⛔ CHƯA APPLY -->
<!-- re-verified: 2026-10-24 — thêm migration 0066_kairos_phan_phoi (kairos_reads + kairos_record_reads + default rules_accepted_at) — 14 §13 -->
<!-- re-verified: 2026-10-19 — gỡ luật cỡ theo đối tượng (quyết định anh Long 2026-10-19, xem 07/03); cỡ theo thang 03 §0. -->
<!-- re-verified: 2026-10-19 — MIGRATION MỚI 0064_atomic_writes.sql (§ GHI NGUYÊN TỬ): user_docs.rev + 3 hàm market_transition_order/market_patch_request/market_accept_request. ĐÃ APPLY prod 2026-10-19, kiểm thật trên Postgres (rollback). -->
<!-- re-verified: 2026-10-18 — MIGRATION MỚI 0063_market_requests_eta.sql (§7g): market_orders + eta_from/eta_to/request_id (nullable) · bảng market_requests (RLS bật, 0 policy, revoke anon/authenticated). ĐÃ APPLY prod 2026-10-18 (chủ dự án duyệt) — xem §7g. -->
ttl_days: 180
<!-- re-verified: 2026-10-06 17:20 — đồng bộ sổ đối chiếu code: `user-sync.ts` (syncAll/pushKind/markLocalWrite/clearSyncMeta, metaCache), route `/api/me/sync` (identityFromRequest, lọc owner_phone, keepDeleted/stripDeleted), `user-sync-core.ts` — khớp; THÊM gộp 3 chiều theo id (`mergeById`, baseIds), chủ sổ `_owner` + `phone` ở GET, seed khi server chưa có dòng, `showsUnderBoat`; dọn câu "apply nhầm, chưa recoverable" mâu thuẫn. -->
<!-- re-verified: 2026-10-06 16:30 — đối chiếu code: `DocumentKind`/`DOCUMENT_KINDS`/`getExpiryStatus`/`SOON_DAYS_DOCS` (documents.ts + days.ts) khớp; THÊM `dang_ky_tau`, `kindUsuallyNoExpiry`, issuedOn trên form; `Boat` +19 ô theo giấy (boats.ts); user_docs + bucket user-docs ĐO THẬT có ở znzgugvfhgmiszqgjulk (sửa drift "chưa có"); staff_permissions + cờ `resetPassword`; reset mật khẩu khách ⇒ sd123456 (ADR 0008); §5 mục 5 nhắc hạn push. -->
<!-- re-verified: 2026-10-02 15:40 — RBAC: đối chiếu `phone.ts` (thêm `phoneFromAuthEmail`), 0002 `current_phone()` (split_part không xét đuôi — vá ở 0056), 0007/0019 `customers.role` customer|manager|admin, 0024 admin chung, 0028 `staff_permissions`, 0037/0039/0053 `device_tokens` (không hạn, allow_multi chỉ admin). Khớp code trước khi thêm 0056. -->
<!-- re-verified: 2026-07-29 — documents.ts GỠ demoDocuments (dead seed, prod không dùng — app đã lên thật, user mới thấy tủ giấy tờ RỖNG). KHÔNG đổi schema/RLS/shape BoatDocument, không đụng migration/webhook/owned-assets. Xem 02 §4 + 07 §8.1. -->
<!-- re-verified: 2026-08-18 — ĐỐI CHIẾU 5 vùng covers sau gói C/E/F: (1) `documents.ts` `getExpiryStatus` nay import `SOON_DAYS_DOCS/daysUntil/todayIsoVN/addDaysIso` từ `lib/days.ts`, `days===0` → level `expired` "Hết hạn hôm nay" (khớp bảng §3); (2) `owned-assets.ts` `getServiceDueStatus` dùng `SOON_DAYS_SERVICE=14` + `daysUntil` giờ VN, `requestStatusVN` trả `ok|neutral`; (3) `phone.ts` KHÔNG đổi từ 2026-06-16 (4 export `normalizeVnPhone/phoneToEmail/sanitizePhoneInput/isValidVnPhone` + `PHONE_EMAIL_DOMAIN`, đúng như §5b tả "helper SĐT thuần"; report báo SUSPECT chỉ vì commit tạo file trùng ngày last_verified cũ); (4) `sdwork-webhook.ts` + `supabase/migrations` không có thay đổi mới hôm nay ngoài 0034/0035 đã ghi (commit f078783); (5) `push_messages` không migration mới — chỉ THÊM quy ước `sent_by` `system:storm`/`system:order` + `tag` (ghi ở mục 0023). -->
<!-- re-verified: 2026-08-19 — GỘP BASE (sync base): migration base 0032/0033/0034/0036/0037 đánh lại số thành 0045/0046/0047/0048/0049 cho khỏi đụng số sdvico; base 0035_market_listings_owner_phone BỎ vì trùng logic 0043 của sdvico. Mọi mục dưới đây dùng SỐ MỚI và trạng thái apply tính theo prod SDVICO (⚠️ CHƯA APPLY), KHÔNG phải prod base. -->

---

### 0088 — DÙNG THỬ PREMIUM THEO NGÀY — migration [`0088_premium_dung_thu.sql`](../../supabase/migrations/0088_premium_dung_thu.sql) (2026-11-12) — 🔴 **CHƯA APPLY prod** (chủ dự án tự apply)

Hành vi: [20-ba-spec](20-ba-spec-premium-dung-thu.md). Nhân sự cho bà con dùng thử premium 1–14 ngày (dựng sẵn 3/5), mỗi khách một lần, không phải lượt bán. Chỉ đổi `premium_grants`, không thêm cột, không đụng dữ liệu cũ:

| Thay đổi | Ghi chú |
|---|---|
| `premium_grants_action_check` nới thành `activate\|renew\|downgrade\|trial` | `trial` = lượt dùng thử; `isSaleGrant`, "đang quản", `topGranters` KHÔNG đếm |
| chỉ mục duy nhất `premium_grants_one_trial_idx (customer_phone) where action='trial'` | luật "mỗi khách một lần" chặn ở DB — hai nhân sự bấm cùng lúc thì lượt sau vấp 23505 ⇒ route trả 409 `trial_used` |

Chưa apply mà code mới đã chạy: route ghi nhật ký `trial` TRƯỚC khi đổi hạng ⇒ ghi bị ràng buộc cũ chặn ⇒ 503 `trial_unavailable`, KHÔNG mở premium. Gói tháng + các luồng khác không đổi. Hạn dùng thử = 23:59:59 giờ VN của (ngày cấp + N) (`trialUntil`, `lib/tier.ts`).

### 0087 — S-TRACKING: TRẠNG THÁI KẾT NỐI THẬT — migration [`0087_stracking_ket_noi.sql`](../../supabase/migrations/0087_stracking_ket_noi.sql) (2026-11-06) — ✅ **ĐÃ APPLY prod 2026-11-06** (Supabase MCP)

Nhân viên hỏi "Sao ko báo mkn" khi thẻ GL-99280-TS ghi "cập nhật 06:45" lúc 13:11 — máy KHÔNG mất kết nối (đợt cuối 04/09 → 07/09); dòng đó là `cap_nhat_nguon` ("Ngày cập nhật" bản ghi S-Tracking, chỉ lấy lại lượt 07:30). Anh Long: "fix hết đi". `stracking_thiet_bi` thêm `mat_ket_noi_tu` (đang mất từ, null = không), `co_lai_luc` (đợt gần nhất có lại lúc), `ket_noi_kiem_luc` (lúc GPU kiểm) + index một phần `mat_ket_noi_tu is not null`. Máy GPU gửi `ketNoi: [{serial, matTu, coLai}]` mỗi 15 phút (đợt mới nhất mỗi máy trong báo cáo mất kết nối: ~22 ngày khơi / ~9 ngày bờ — `trangThaiKetNoi`); máy chủ (route nhap) chỉ update máy đã có, máy không có trong báo cáo không đụng. Thẻ máy hiện "Có tín hiệu" / "Mất tín hiệu từ …" thay dòng "cập nhật HH:MM".

### 0086 — "SỐ KHÁC CỦA TÔI" (thay SĐT phụ một ô 0084) — migration [`0086_sdt_khac.sql`](../../supabase/migrations/0086_sdt_khac.sql) (2026-11-06) — ✅ **ĐÃ APPLY prod 2026-11-06** (anh Long: "Áp và đẩy"; Supabase MCP `apply_migration`, `schema_migrations` 20261106044448. Soi trước: 1 số phụ, 0 trùng, bảng chưa có. Soi sau: chép đúng 0918388742 ⇒ 0946364444 (đã duyệt, `chep-0084`); RLS bật, 0 policy; anon đọc thấy 0 dòng; authenticated ghi ⇒ 42501 bị chặn)

Anh Long 06/11: *"phải có phương án bind với sdt này hoặc cho khách bổ sung sdt mua hàng sdvico"* + *"có 3 SĐT (cái phụ đang để cho VMS phụ) có bị conflict ko?"*. Cột đơn `customers.sdt_phu` vỡ ở ba chỗ: (1) đăng nhập A, máy giám sát đứng tên B, mua hàng bằng C ⇒ một ô không chứa được cả B lẫn C; (2) chỉ mục 0084 không unique ⇒ một số gán được cho hai tài khoản; (3) chính số phụ có thể là tài khoản tự đăng nhập. Nghĩa của B và C như nhau — *"số này là của tôi, nhân viên đã xác nhận"* — nên MỘT danh sách dùng chung cho S-Tracking và đồ mua SDVICO.

| Cột `sdt_khac` | Kiểu | Luật |
|---|---|---|
| `phone` | text | FK `customers.phone` (cascade) — tài khoản (SĐT chính) |
| `sdt` | text | `^0[1-9][0-9]{8}$`, ≠ `phone`; unique `(phone, sdt)` |
| `nguon` | text | `nhan-vien` (gán ở /quan-tri) · `khach` (bà con gửi từ app) |
| `tao_luc` / `duyet_luc` / `duyet_boi` | timestamptz / timestamptz null / text | **chỉ dòng `duyet_luc` not null được dùng để tra** |

- **Chặn ở DB**: ≤3 dòng / tài khoản kể cả dòng chờ (trigger `sdt_khac_toi_da`, cặp đã có thì nhường unique báo "đã có"); một số ĐÃ DUYỆT thuộc MỘT tài khoản (unique một phần `sdt_khac_da_duyet_mot_nguoi`). RLS bật, 0 policy — chỉ route service role.
- **Chép 0084**: `customers.sdt_phu` ⇒ dòng đã duyệt (`duyet_boi='chep-0084'`); hai tài khoản trùng một số phụ ⇒ giữ dòng sửa sớm nhất. Cột `sdt_phu` GIỮ một nhịp làm đường lùi (bảng chưa có ⇒ `lib/sdt-khac` đọc cột cũ); bỏ ở migration sau. Thử trên pglite 06/11: chép đúng, 3 số + số thứ 4 ⇒ `toi_da`, số đã duyệt cho người khác ⇒ 23505, ≠ SĐT chính, FK, gửi trùng ⇒ `da_co`, chạy lại lần 2 không lỗi.
- **Ai ghi**: bà con `POST/DELETE /api/me/sdt-khac` (dòng CHỜ — không mở quyền gì; rút được số chờ của mình) · nhân viên `POST/DELETE /api/admin/accounts/sdt-khac` (quyền `tai-khoan` edit, nhật ký `account.sdt-khac`; số đó có chuỗi máy còn hiệu lực ⇒ hỏi "Vẫn gắn").
- **Ai đọc**: `lib/sdt-khac` (`sdtTraCuaTaiKhoan` · `phuCuaCacSdt` · `chinhCuaSdtPhu` · `soChoDuyet`) ⇒ `/api/stracking/cua-toi|an|nhap`, `/api/renewal/request|mine`, **`/api/me/sdvico`** (devices + support_requests theo mọi số đã duyệt), `/api/admin/accounts` (`soKhac`).

### 0085 — S-TRACKING: BÀ CON TỰ "XOÁ" MÁY — migration [`0085_stracking_an.sql`](../../supabase/migrations/0085_stracking_an.sql) (2026-11-06) — ✅ **ĐÃ APPLY prod 2026-11-06** (Supabase MCP, anh Long: "làm đi, migrate đi")

Anh Hoà đề xuất trong nhóm Zalo, anh Long duyệt: *"máy nào ẩn thì ko cần thông báo liên quan nữa (ko gọi là ẩn mà là xoá, mặc dù trong hệ thống là ẩn)"*. Bảng `stracking_an (sdt, serial, an_luc, pk(sdt, serial))` — RLS bật + revoke, không policy (chỉ service role). Ghi qua `POST /api/stracking/an` (SĐT từ phiên, chỉ máy khớp SĐT CHỦ TÀU của tài khoản — thuyền trưởng không xem giám sát, 06/11; ghi cho SĐT chính + mọi SĐT của tài khoản gắn với máy, để tin gộp từ SĐT phụ không mang máy về), `DELETE` = hiện lại. `cua-toi` không trả máy đã xoá (trả riêng `daXoa`); route nhap bỏ cảnh báo / "đã hết" / nhắc của (SĐT, máy) đã xoá. Kho `stracking_thiet_bi` không đụng — người khác cùng máy vẫn thấy.

---

### 0084 — SĐT PHỤ CHO TÀI KHOẢN (⛔ THAY bởi 0086 `sdt_khac` — đoạn dưới là lịch sử) — migration [`0084_sdt_phu.sql`](../../supabase/migrations/0084_sdt_phu.sql) (2026-11-05) — ✅ **ĐÃ APPLY prod 2026-11-05** (Supabase MCP `apply_migration`, `schema_migrations` 20261105150914, anh Long: "Áp và gán luôn". Soi sau apply: RLS customers vẫn bật; gán 0918388742 ⇒ `sdt_phu` 0946364444)

Anh Long 05/11: *"cho bổ sung thêm 1 sdt, tức là cho phép 1 acc 2 sdt"*. Ca thật: khách đăng nhập một SĐT, còn tàu trên S-Tracking (Viettel) đứng tên SĐT khác, nên khối Giám sát hành trình không hiện tàu đó.

| Cột | Kiểu | Luật |
|---|---|---|
| `customers.sdt_phu` | text null | `^0[1-9][0-9]{8}$`, khác `phone`; MỘT số/tài khoản; index một phần `where sdt_phu is not null` |
| `customers.sdt_phu_luc` | timestamptz null | lần nhân viên đổi gần nhất |

- **Ai ghi**: CHỈ nhân viên (quyền tab `tai-khoan` edit) — `PATCH /api/admin/accounts/sdt-phu`, nhật ký `account.sdt-phu` (cũ → mới). App chưa có OTP ⇒ bà con KHÔNG tự thêm (tự thêm = xem được máy, tên chủ tàu, cảnh báo của người khác).
- **Ai đọc**: `lib/stracking/sdt-phu.sdtTraCuaTaiKhoan` ⇒ `/api/stracking/cua-toi`, `/api/renewal/request`, `/api/renewal/mine` tra `stracking_thiet_bi` theo SĐT chính + phụ. Đọc hỏng / cột chưa có ⇒ chỉ SĐT chính (không chặn khối).
- **Không đổi**: đăng nhập, SĐT chính, yêu cầu gia hạn vẫn gửi dưới SĐT chính. Tin cảnh báo S-Tracking (hộp thư + đẩy) gửi SĐT trên máy VÀ tài khoản có SĐT phụ trùng số đó (`/api/stracking/nhap` `guiTin`, anh Long 05/11 "gửi đủ về").

### 0083 — SỔ ĐỒNG Ý ĐIỀU KHOẢN — migration [`0083_dong_y_dieu_khoan.sql`](../../supabase/migrations/0083_dong_y_dieu_khoan.sql) (2026-11-05) — ✅ **ĐÃ APPLY prod 2026-11-05** (anh Long: "Áp luôn"; Supabase MCP `apply_migration`, `schema_migrations` 20261105141841. Soi sau apply: RLS bật, 0 policy, anon không đọc được, authenticated không ghi được, 0 hàng)

Vì sao: Luật BVDLCN 91/2025/QH15 + NĐ 356/2025/NĐ-CP Điều 6 — sự đồng ý phải **kiểm chứng được** (ai · lúc nào · bản nào) và bên kiểm soát dữ liệu (SDVICO) chịu trách nhiệm chứng minh; NĐ 330/2026 phạt việc coi im lặng là đồng ý / không lưu được bằng chứng. Bản trong máy (`forfish.dongY.v1`) chỉ là bản sao để khỏi hỏi lại.

| Cột | Ý nghĩa |
|---|---|
| `phone` | SĐT từ chuỗi cứng (không nhận từ body) |
| `ban` | `DIEU_KHOAN_BAN` (`lib/dieu-khoan.ts`), route chỉ nhận bản hiện hành (bản cũ ⇒ 409 `ban_cu`) |
| `luc_may` / `luc_chu` | mốc bấm trên máy (bấm lúc mất sóng thì gửi bù) / mốc máy chủ nhận. `lucHopLe` chặn mốc trước 2026-01-01 hoặc vượt giờ máy chủ quá 1 ngày |
| `nguon` | `dang-ky` (tick ô ở /dang-ky) · `mo-app` (tờ Đồng ý lần đầu sau đăng nhập / tài khoản cũ) · `dang-nhap` (dự phòng) |
| `platform`, `user_agent` | soi khi tranh chấp |

Chỉ thêm, không sửa/xoá từ app. Bản hiện hành của một SĐT = hàng `luc_chu` mới nhất. Rút đồng ý / xoá tài khoản: qua hotline SDVICO (chưa có màn — nhân viên làm tay; thời hạn NĐ 356: phản hồi 2 ngày làm việc, rút đồng ý 15 ngày, xoá 20 ngày).

### 0082 — S-TRACKING: ĐÓNG CẢNH BÁO ĐÃ CLEAR — migration [`0082_stracking_dong_canh_bao.sql`](../../supabase/migrations/0082_stracking_dong_canh_bao.sql) (2026-11-05) — ✅ **ĐÃ APPLY prod 2026-11-05** (Supabase MCP, anh Long duyệt)

Anh Long: *"nếu cảnh báo đã được clear thì đóng cảnh báo cho họ"*. `stracking_canh_bao` thêm `da_dong_luc` (timestamptz, null = còn mở) + index một phần `(imei) where da_dong_luc is null`. S-Tracking chỉ liệt kê cảnh báo ĐANG MỞ ⇒ "đã clear" = khoá (imei, loai, luc) biến khỏi danh sách: máy GPU gửi `dangMo` (trọn bộ khoá đang mở, chỉ khi đọc đủ) ⇒ `POST /api/stracking/nhap` đặt `da_dong_luc` cho cảnh báo mở không còn trong bộ đó + gửi tin "Tàu X đã hết cảnh báo" (cùng tag, đè thông báo cũ) cho SĐT mà tin S-Tracking gần nhất hôm nay vẫn là cảnh báo và MỌI máy của họ hết cảnh báo mở. `cua-toi` lọc `da_dong_luc is null`. Cộng thêm cột, không đổi dữ liệu cũ.

---

### 0081 — S-TRACKING: 4 CỘT TRẠNG THÁI MÁY — migration [`0081_stracking_them_cot.sql`](../../supabase/migrations/0081_stracking_them_cot.sql) (2026-11-05) — ✅ **ĐÃ APPLY prod 2026-11-05** (Supabase MCP)

Anh Long: *"Trạng thái đồng bộ Tổng cục, nhóm, ngày tạo, ngày cập nhật, trong bờ hay ngoài khơi cái này quan trọng nhé"*. `stracking_thiet_bi` thêm `dong_bo_tcts` (text ≤60, "Thành công"/"Thất bại"), `nhom` (text ≤160), `tao_luc`, `cap_nhat_nguon` (timestamptz) — đều nullable, không đổi/xoá gì (`trong_bo` có từ 0080). Máy GPU gửi kèm qua `banGuiThietBi` (băm bản gửi đổi ⇒ lượt sau gửi lại mọi hồ sơ); máy chủ kiểm ở `kiemThietBi`; `GET /api/stracking/cua-toi` trả `dongBoTcts`, `nhom`, `taoLuc`, `capNhatNguon`. Báo cáo dịch vụ bù `nhom` (groupName) + `cap_nhat_nguon` (logDate ms) khi danh sách phương tiện thiếu.

### 0080 — HẠN CƯỚC + CẢNH BÁO S-TRACKING — migration [`0080_stracking.sql`](../../supabase/migrations/0080_stracking.sql) (2026-11-05) — ✅ **ĐÃ APPLY prod 2026-11-05** (anh Long: "Làm cả ba"; qua Supabase MCP `apply_migration`. Soi sau apply: 3 bảng RLS bật, 0 policy, anon/authenticated không đọc được. `app_config.stracking_key` đã đặt — cùng giá trị trong `~/.config/forlife/stracking.env` máy GPU)

Anh Long: *"chạy GPU, check 7h, 12h, 17h, 21h để cập nhật cái hạn mới nhất, tổ chức DB ở GPU lưu toàn bộ các thông tin liên quan tới user … dữ liệu tổ chức ở sdfish bảng riêng độc lập, để tránh conflict luồng sdwork"*. Ba bảng **độc lập** với DB chung CRM/SDWork (`stracking_renewal_*` không đụng tới, không trigger, không khoá ngoại); RLS bật + revoke anon/authenticated, 0 policy (chỉ service role):

| Bảng | Khoá | Cột chính | Ghi / đọc |
|---|---|---|---|
| `stracking_thiet_bi` | `serial` | imei, ten_tau, chu_tau, `sdt_chu_tau`, thuyen_truong, `sdt_thuyen_truong` (check `^0[1-9]\d{8}$`, index một phần), dang_ky_luc, **het_han**, tam_ngung_tu/den, trong_bo, dong_bo_luc | ghi: `POST /api/stracking/nhap` (khoá máy GPU) · đọc: `GET /api/stracking/cua-toi` theo SĐT phiên |
| `stracking_canh_bao` | (imei, loai, luc) | serial, ten_tau, muc (Báo động/Cảnh cáo), nhan_luc | thêm bỏ trùng; CHỈ cảnh báo TRONG NGÀY giờ VN (anh Long 05/11: "xóa đi, cái nào trong ngày thôi" — `kiemGoiNhap` bỏ cũ, máy GPU đánh dấu cũ `da_gui=2`; đã xoá tay 91 dòng cũ 05/11); route nhap xoá > 2 ngày; `da_dong_luc` (0082) = đã clear |
| `stracking_lan_dong_bo` | id | luc, trang_thai (ok/het-phien/loi), loi, tong jsonb, so_thiet_bi, so_canh_bao | một dòng mỗi lần máy GPU gửi; giữ 90 ngày |

Server CHỈ giữ trường bà con cần xem. Kho đầy đủ (địa chỉ, SĐT người thân, SĐT quản lý, niêm phong, nhóm, bản thô, **lịch sử đổi hạn** = các lần gia hạn) nằm ở máy GPU: SQLite `~/.local/forlife/stracking/stracking.db` (bảng `thiet_bi`, `han_lich_su`, `canh_bao`, `lan_chay`) — xem runbook › S-Tracking. Chưa apply ⇒ nhap trả 503 `store_down`, cua-toi 503 ⇒ giao diện giữ bản lưu / báo cần mạng, không vỡ.

### 0079 — VAI TÀI KHOẢN · VIỆC LÀM · HỒ SƠ VỰA — migration [`0079_vai_viec_lam.sql`](../../supabase/migrations/0079_vai_viec_lam.sql) (2026-11-03) — ✅ **ĐÃ APPLY prod 2026-11-03** (anh Long: "Chạy migration"; chạy qua `SUPABASE_DB_URL` trong một transaction — MCP Supabase không có quyền, `SUPABASE_ACCESS_TOKEN` hết hạn 401; `schema_migrations` 20261103071342. Soi sau apply: suy vai 510 `chu-tau` · 470 null · 0 vai khác; 4 bảng RLS bật, 0 policy, anon/authenticated không đọc được; thử thật qua route: `/api/viec` 200, `/api/me/vai` GET/PUT, Đi bạn đăng tin 403 `vai`, `/api/viec/nguoi` 403, vai rác 400)

Spec: [17-ba-spec-vai-tai-khoan.md](17-ba-spec-vai-tai-khoan.md).

| Đối tượng | Cột chính | Ghi / đọc |
|---|---|---|
| `customers.vai` | `ngu-dan` · `chu-tau` · `thu-mua` · `dai-ly` · null (check) | người dùng tự chọn — `PUT /api/me/vai` (SĐT từ chuỗi cứng); máy giữ chính ở `forfish.vai.v1` (`lib/vai-store.ts`); middleware `dataGate` đọc (đệm 5 phút) để chặn lớp bản đồ free của 3 vai cần gói (403 `goi`) |
| `customers.vai_doi_luc` | timestamptz | route ghi mỗi lần đổi |
| `customers.vai_xac_minh_at` | timestamptz | chỉ nhân viên — dấu "Xác minh" của thu mua |
| `job_posts` | owner_phone, nghe, port_id, vi_tri[], so_nguoi, ngay_di, so_ngay, cong (chữ ≤80), giay[], ghi_chu ≤300, boat_reg/show_boat, status mo/du/an, expires_at (+14 ngày) | tin tuyển của chủ tàu — route `/api/viec/**` |
| `job_seekers` | phone PK, nghe[], so_nam, vi_tri[], ports[1–3], giay[], san_sang, ghi_chu ≤150, dang_tim, bat_luc | hồ sơ tìm tàu, 1/SĐT; SĐT chỉ trả cho vai chu-tau |
| `job_reports` | reporter_phone, target_kind post/seeker, target_id, status | báo xấu — unique theo (người báo, đối tượng) |
| `vua_profiles` | phone PK, name, kind vua/nau/nha-may/cho, province, address, species[], hours, contact, status cho_duyet/hoat_dong/tu_choi/tam_khoa, status_note | hồ sơ vựa tự khai; `hoat_dong` mới lên Chợ cá › Đầu mối |

Suy vai lúc migrate (chỉ hàng `vai is null`, §3.2): có `shops` hoat_dong/cho_duyet ⇒ `dai-ly`; có `devices` hoặc `user_docs` kind `boats` mảng không rỗng ⇒ `chu-tau`; `kairos_profiles.nghe = 'thu-mua'` ⇒ `thu-mua`. RLS bật cả 4 bảng, KHÔNG policy, revoke anon/authenticated — mọi truy cập qua route service-role lọc theo SĐT (khuôn Kairos 0065). Trigger `updated_at` dùng `market_set_updated_at()` (0062).

**Việc làm — luật đã build** (`lib/viec.ts`, `lib/viec-server.ts`): id công khai của hồ sơ tìm tàu = `kairos_profiles.id` (không băm SĐT — SĐT 10 số băm ra là dò ngược được trong vài giây), tên = `kairos_profiles.handle`. Gia hạn = now + 14 ngày, mở lại tin `du`. Tự ẩn tin khi 5 người khác nhau báo xấu. Hồ sơ quá 30 ngày từ `bat_luc` coi như tắt lúc đọc. Kho máy: `forfish.viec.v1` (≤100 tin, ≤200 KB, KHÔNG SĐT — chỉ để vẽ ngay lúc mở màn; vai trên bờ có sóng, 17 §2), `forfish.viec.luu.v1` (≤50 tin đã lưu), `forfish.viec.nhap.v1` (một nháp). **Giấy tờ của tôi**: KHÔNG bảng mới — giấy riêng nằm trong `forfish.documents.v1` / `user_docs` kind documents với `boatId = "ca-nhan"`; loại mới `cccd` · `so_thuyen_vien` · `chung_chi_thuyen_vien` (chỉ tủ riêng); khoá nhắc hạn `doc-cn:<id>.<hạn>.<mốc>` mở `/viec/giay`; không bump, không chuyển giấy cũ.

**`vua_profiles` — luật trạng thái khi chủ lưu** (`lib/vua-profile.ts`, route `/api/me/vua`): chưa có ⇒ `cho_duyet` · `cho_duyet` giữ · `tu_choi` ⇒ `cho_duyet` (xoá lý do cũ) · `hoat_dong` đổi tên/loại/tỉnh/địa chỉ/SĐT liên hệ ⇒ `cho_duyet`, chỉ đổi loài/giờ ⇒ giữ · `tam_khoa` ⇒ 403 `locked`. Nhân viên (`/api/admin/vua-profiles`, quyền cho-ban): duyệt (mở khoá, ghi `approved_at`) · từ chối (lý do 3–300) · khoá; chỉ ghi khi trạng thái chưa đổi từ lúc tải (409 `changed`); log `sell.vua-status`. Loài: ≤40 ký tự mỗi mục (chỉ app kiểm). `customers.vai_xac_minh_at` chỉ ghi qua `/api/admin/accounts/xac-minh` (quyền tai-khoan, log `account.xac-minh-thu-mua`).

<!-- 0052 (đổi số từ 0038 base khi sync — 0038 đã là data_until_web ở sdvico) — `vms_zones.is_border` -->
### 0059 — MẪU CÂU NÓI SEN BIỂN (học thêm) — migration [`0059_sen_bien_mau.sql`](../../supabase/migrations/0059_sen_bien_mau.sql) (2026-10-18) — ✅ **ĐÃ APPLY prod 2026-10-18** (chủ dự án duyệt; qua Management API, `schema_migrations` 20261018070727. Soi sau apply: RLS bật, 0 policy, advisor chỉ `rls_enabled_no_policy` INFO — đúng thiết kế; thử thật: khách ghi 401 / đọc rỗng, service-role ghi 201, câu > 200 ký tự 400; hàng thử đã xoá)

- Bảng `public.sen_bien_mau`, mỗi hàng là một câu bà con nói với Sen Biển: `cau` (chữ bộ nghe ra, ≤ 200 ký tự) · `tra` (máy làm gì: go/pick/start/stop/cancel/mute/unmute/repeat/howfar/hoi/map/say · `cho` = lệnh sàn ở màn ngoài bản đồ, từ 2026-10-18 chiều — cột `text` không ràng buộc, không cần migration; khuôn kiểm ở `mau-hoc.lamSachMau`) · `ct` (ý n-gram / loại câu hỏi / việc bản đồ / số chỗ) · `gemma` (ý Gemma đoán, Android) · `xn`/`chay` (đang chờ "đi" / đang dẫn) · `phien` (một lần mở Sen Biển, dùng để ghép cặp câu NÓI LẠI = ca hiểu sai) · `noi_luc`/`nhan_luc` · `nen`/`ban` · `nguoi`.
- `id` text là khoá do máy sinh (uuid) ⇒ gửi lại không nhân đôi (`upsert … ignoreDuplicates`).
- Riêng tư: KHÔNG tiếng thu, KHÔNG vị trí, KHÔNG SĐT. `nguoi` = SHA-256(`CREW_CCCD_PEPPER` + `senbien:` + SĐT), thiếu pepper thì để null — chỉ dùng để gỡ mẫu của một người hoặc bỏ lô rác. RLS bật, KHÔNG policy ⇒ chỉ service-role (như `customer_devices`, advisor báo `rls_enabled_no_policy` mức INFO là đúng thiết kế).
- Ghi: `POST /api/sen-bien/mau` (cần chuỗi thiết bị, ≤ 100 mẫu/lô, 20 lô/giờ/SĐT). Đọc: `scripts/sen-bien-keo-mau.mjs` (service-role) ⇒ JSONL cho kho huấn luyện. Máy giữ ≤ 300 mẫu trong `forfish.senbien.mau.v1`, chỉ xoá mẫu khi máy chủ trả về id đã nhận (`lib/sen-bien/mau-hoc.ts`).
- Apply trước hay sau deploy đều an toàn: thiếu bảng ⇒ route trả 500 `insert_failed`, máy giữ mẫu lại, 10 phút sau thử tiếp (kho máy có trần 300 nên không phình).

### 0058 — KHO LƯU TRỮ DỰ BÁO THEO NGÀY — migration [`0058_forecast_archive.sql`](../../supabase/migrations/0058_forecast_archive.sql) (2026-10-10) — ✅ **ĐÃ APPLY prod 2026-10-10** (chủ dự án duyệt "chạy đi"; soi sau apply: bucket `public=false`, 0 policy trên `storage.objects` cho bucket này, advisor không cảnh báo mới)

- Bucket Storage **riêng tư** `forecast-archive` (`public=false`, KHÔNG policy anon/authenticated — chỉ service-role, như `user-docs` 0051). Không bảng mới.
- ⚠️ **2026-10-19 (đợt 2A)**: payload `fish_forecast_snapshot` thêm `baseMode` (cấp bản đồ) và `cells[].hint {sat, why[]}`; `s`/`sp` nay là điểm NỀN. Id hàng băm thêm `src/data/fish-base.v1.json` + `FISH_ALGO_REV` 2 ⇒ HÀNG MỚI (không migration: cột `id` là text). Hàng cũ (HSI) không bị đọc lại.
- Vì sao: `weather_snapshot`/`fish_forecast_snapshot` GHI ĐÈ mỗi ngày; `fish_forecast_daily` (0005) chỉ giữ ô ≥ 60, `sea_daily` chỉ 10 điểm cảng ⇒ lưới thời tiết đầy đủ, bản đồ cá đủ ô và lưới ĐẦU VÀO mô hình cá mất sau 24 h, không fit/kiểm định lại được trên đúng bản production (kiểm định DataLake 2026-10-10 phải dựng lại payload, thiếu HYCOM/Copernicus).
- Nội dung (file `.json.gz`, đường dẫn `<loại>/<YYYY>/<YYYY-MM-DD>/<tên>.json.gz` — `lib/forecast-archive.ts` `archivePath`, `:` trong id ⇒ `_`):
  - `weather/…/<id snapshot>` — MỌI hàng `weather_snapshot` (lưới gió/sóng d3·d16, `scalar:*`, `curdepth:*`, `salinity:*`, `seascalar:*`, `sea:<cảng>`, cả hàng thô `raw:*`), ghi bởi cron `/api/collect/archive`.
  - `fish/…/<id hàng>` — MỌI hàng `fish_forecast_snapshot` (payload đủ ô, đủ loài), cùng cron.
  - `fish-inputs/…/<trường>` — lưới đầu vào `computeFishForecast` (sst, chl, sla, anom, currents, hycom, sstFine, chlFine; bỏ bathy vì tĩnh) kèm `saved`/`targetDate`, ghi bởi `/api/cron/refresh-fish` mỗi lần tính được. ⚠ Đo 2026-10-19: chỉ có **1 ngày (10/10)** vì cron refresh-fish không chạy được trên prod từ 11/10 — đã thêm vào `cron-prod.yml` (02-architecture).
  - `drivers/<YYYY>/<YYYY-MM-DD>/chain.json.gz` (2026-10-23) — ĐẦU VÀO + MỨC ĐÃ ÁP của lớp chuỗi thức ăn (`lib/fish-chain.ts`): pha trăng, ONI, PDO, Kuroshio–Luzon ΔADT, phù du/nhiệt theo 4 hộp nước trồi, `dScore` theo nhóm/loài, thành phần đang áp/chưa áp, `phienBan` thông số; ghi bởi `/api/cron/refresh-fish` cùng `saved`/`targetDate`. Chuỗi này để học lại `src/data/fish-chain-params.json`. Không bảng mới, không migration.
  - `actual/<YYYY>/<ngày thực tế>/era5-ports.json.gz` (2026-10-19) — THỰC TẾ ERA5 theo ngày cho 10 cảng `{date, source:"open-meteo-archive-era5", fetchedAt, ports:{<id>: {windMaxKmh, gustMaxKmh, rainMm, waveMaxM} | null}}`, ghi bởi `/api/collect/archive` cho cửa sổ [hôm nay−9, hôm nay−5] (`lib/sea-actual.ts`). Khoá ngày = ngày THỰC TẾ (GMT, khớp ERA5), không phải ngày chạy. Ghép với `sea_daily` (dự báo, `date` + `lead_days`) để ra bảng skill theo tầm ngày mà không cần backtest tay (ops/forecast-accuracy.md). ~2 KB/ngày.
  - `storms/<YYYY>/<YYYY-MM-DD>/storms.json.gz` (2026-11-04) — bản tin bão ĐÚNG như `/api/storms` phát lúc cron lưu trữ chạy (NCHMF + GDACS gộp, đường đi, cảnh báo sớm, `sources`). Ngày KHÔNG có bão vẫn ghi (`storms: []`) — "không có bão" cũng là nhãn; cả hai nguồn hỏng (503) ⇒ không ghi, nghĩa là "không hỏi được". Lịch sử bản tin NCHMF chi tiết vẫn ở bảng `storm_bulletins`/`storm_forecast_points` (0048).
  - `nguon-ngay/<YYYY>/<NGÀY DỮ LIỆU>/<nguồn>.json.gz` (2026-11-04) — đầu vào vệ tinh theo NGÀY CỦA DỮ LIỆU, máy GPU quét mỗi ngày gửi lên (`POST /api/collect/nguon-ngay`, `scripts/nguon-ngay/quet.py`). 12 nguồn (`lib/nguon-ngay.ts NGUON_NGAY`): phù du 7 nguồn (Copernicus GlobColour L4 lấp mây, NOAA DINEOF ×2, OLCI S3A/S3B, VIIRS N20/NPP) + bản ghép `chl-ghep`, nhiệt độ nước ×2, dị thường nhiệt, mực nước. Lưới chung 0,05° (5–22°N × 102–118°E, 341 × 321), int16 base64 (phù du log10 mg/m³), kèm `phu` (tỉ lệ ô có số). Vì sao cần cạnh `fish-inputs/`: cron dự báo cá xin `(last)` nên `fish-inputs` có ngày trùng ảnh (02–04/11 cùng ảnh 30/10) và không lấy được ngày nguồn đắp bù muộn; đây là chuỗi sạch để fit. Đo 2026-11-04: ~150 KB/nguồn/ngày ⇒ ~1,8 MB/ngày.
- BẢN SAO DỰ PHÒNG (2026-11-04): máy GPU sao toàn bộ bucket về `~/.local/forlife/kho-du-bao/` mỗi lượt quét (`GET /api/collect/kho` liệt kê + URL ký 10 phút, byte đi thẳng Supabase → GPU). Bảng DB (`sea_daily`, `storm_*`…) KHÔNG nằm trong bản sao này.
- Mỗi ngày đúng một bản mỗi file (upsert — lượt sau trong ngày đè lượt trước). Ghi thử lại 3 lần (1 s, 3 s): chạy thật prod 2026-10-10 thấy mạng IIS → Supabase rớt `fetch failed` ngẫu nhiên một file mỗi lượt. Lượt đầu: 55 file thời tiết + 2 bản đồ cá ≈ 0,77 MB, lưới đầu vào ≈ 0,2 MB/lần ⇒ dưới 1 MB/ngày. Không route nào đọc kho cho app; đọc bằng script offline. Không có thông tin cá nhân.
- Dung lượng đo thật < 1 MB/ngày lúc đầu; 2026-11-04 đo lại ~4 MB/ngày (thời tiết thêm bản thô từng nguồn) + ~1,8 MB/ngày `nguon-ngay` ⇒ ~2 GB/năm — VƯỢT hạn mức Storage gói Free (1 GB) trong khoảng 5 tháng nếu project còn gói Free; khi chật thì gộp/xoá theo năm (bản sao GPU vẫn giữ đủ), chưa đặt tự xoá.
- Apply trước hay sau deploy code đều an toàn: thiếu bucket thì `putArchive` trả lỗi trong `parts`/`archive` của response cron, snapshot vẫn ghi bình thường.

### 0057 — ADMIN TỔNG TRONG DB — migration [`0057_staff_owner.sql`](../../supabase/migrations/0057_staff_owner.sql) (2026-10-02) — ✅ **ĐÃ APPLY prod 2026-10-02** (chủ dự án duyệt; soi sau apply: đúng 1 hàng `admin`/`owner` còn hiệu lực)

- `staff_accounts.role` mở thêm `owner` (check `owner|admin|manager`); index unique `staff_accounts_one_owner_idx` trên `(role) where role='owner'` ⇒ **một** admin tổng.
- Seed hàng `('admin','owner')` — định danh là TÊN đăng nhập, khớp auth user `admin@sdvico.local` (tạo bằng `scripts/owner-account.mjs`; mật khẩu KHÔNG nằm trong migration).
- Code: `loadActor` gắn `owner:true` khi hàng owner còn hiệu lực; `findOwner` (staff-store) = env `OWNER_LOGIN` (tương thích) HOẶC hàng owner; `/api/auth/token` chỉ cấp chuỗi cho định danh không-phải-SĐT khi DB xác nhận owner (`loginNameFromAuthEmail` chỉ là ứng viên). Thay việc sửa env server + khởi động lại.
- Apply trước hay sau deploy code đều an toàn: code cũ coi `owner` là vai lạ (không quyền).

### 0056 — TÁCH VAI · LOẠI · HẠN CHUỖI (RBAC) — migration [`0056_rbac_staff_accounts.sql`](../../supabase/migrations/0056_rbac_staff_accounts.sql) (2026-10-02) — ⚠️ **CHƯA APPLY prod** (deploy code TRƯỚC, apply SAU — [ops/rbac-runbook.md](ops/rbac-runbook.md))

Ba trục độc lập, mỗi trục một nguồn (trước: dồn chung hàng `customers` do webhook SDWork upsert/xoá; "ai là admin" tính ở 6 chỗ với 6 luật):

| Trục | Nguồn | Giá trị |
|---|---|---|
| **VAI** | bảng mới `staff_accounts` (phone PK · `role` admin\|manager · `permissions` jsonb · `scope` own\|all_premium · `created_by` · `disabled_at`) — RLS bật, 0 policy, revoke anon/authenticated | env `ADMIN_PHONES` chỉ còn là **cửa cứu hộ** |
| **LOẠI** | cột mới `customers.account_kind` (default `real`, check real\|test\|demo\|reviewer) | khác `real` ⇒ không bao giờ là staff, chuỗi có hạn, bỏ khỏi thông báo gửi tất cả |
| **HẠNG** | `customers.tier` (không đổi) | |

- **Hạn chuỗi** `device_tokens.expires_at` (NULL = không hạn — **khách thật giữ nguyên luật 0037**, bà con ngoài biển không văng). Staff 7 ngày · test 24 giờ · demo/reviewer 7 ngày (`tokenTtlMs`, `src/lib/admin.ts`). Quá hạn → cổng coi như `unknown_token`.
- **`current_phone()` vá**: email đuôi ≠ `@sdvico.local` mà phần trước @ là SĐT VN → NULL (khớp `phoneFromAuthEmail` ở `src/lib/phone.ts`). Trước đó `<SĐT nạn nhân>@gmail.com` đọc được hàng của SĐT đó qua RLS và nhận chuỗi của SĐT đó ở `/api/auth/token`.
- **Backfill**: chép `customers.role in (admin,manager)` (+ `staff_permissions` của manager) sang `staff_accounts`, `on conflict do nothing`.
- **Một cửa đọc/ghi**: `src/lib/staff-store.ts` (`loadActor`, `effectiveTier`, `listDbStaff`, `writeStaffRole`, `writeStaffPermissions`, `managerTargetCheck`, `nonRealPhones`); luật thuần `resolveStaffRole` / `managerTargetDenial` / `tokenTtlMs` ở `src/lib/admin.ts` (test `rbac.test.ts`).
- **Chạy được TRƯỚC khi apply**: bảng chưa có (`42P01`/`PGRST205`, `isMissingTableError`) → vai đọc từ `customers.role`; cột chưa có → mọi người `real`, chuỗi cấp không hạn. Ghi vai luôn **gương** sang `customers.role`/`staff_permissions` để lùi bản deploy không lệch quyền. Gỡ hai cột cũ = migration riêng, sau này.
- **Webhook SDWork KHÔNG đặt lại mật khẩu** tài khoản nhân sự (tra hỏng → coi là nhân sự).
- **ADMIN TỔNG** (2026-10-02, không cần migration): auth user `<OWNER_LOGIN>@sdvico.local` (tạo bằng `scripts/owner-account.mjs`, `user_metadata.owner=true`), KHÔNG có hàng `customers`/`staff_accounts`. Định danh = chính cái tên ⇒ `device_tokens.customer_phone` và `admin_activity_log.actor_phone` có thể mang giá trị `'admin'` (không phải SĐT) — mọi chỗ đọc hai cột này coi đó là chuỗi định danh, không chuẩn hoá SĐT. `current_phone()` trả `'admin'` cho phiên này ⇒ RLS không khớp hàng khách nào (đúng ý: admin tổng không dùng app ngư dân).

### 0052 — `vms_zones.is_border` · ⚠️ **CHƯA APPLY prod SDVICO** (đổi số từ 0038 base; "đã apply" trong log base là prod BASE)

```sql
alter table public.vms_zones
  add column if not exists is_border boolean not null default false;
create index if not exists vms_zones_is_border_idx
  on public.vms_zones (is_border) where is_border = true;
```

**Vì sao**: từ 2026-07-28 biên trên bản đồ = 3 vùng VMS do admin quản lý, nhưng cảnh báo IUU (`lib/geofence`) vẫn đo theo dữ liệu tĩnh kèm app. Muốn admin đổi được biên thì app phải biết **vùng nào là ranh giới** — hai vùng còn lại (Cần chú ý / Chỉ cá đáy) là lớp lưu ý; lấy hợp cả ba ra một vùng vô nghĩa và app sẽ báo "đã ngoài ranh giới" trên gần hết vùng biển VN.

**Ngữ nghĩa**: `is_border = true` ⇒ hình vùng này định nghĩa ranh giới cảnh báo.
- Vùng **KÍN** (Polygon/MultiPolygon) → dùng cho câu hỏi TRONG/NGOÀI.
- **ĐƯỜNG** (LineString) → dùng để ĐO khoảng cách. Chỉ có đường thì app **không** khẳng định trong/ngoài (đường hở không có "bên trong") — xem `bietTrongNgoai` trong `lib/geofence`.
- Không vùng nào bật ⇒ app dùng `src/data/vms-zones.json` như cũ. Đây là **đường lùi an toàn, không phải trạng thái lỗi**.

**Đọc/ghi đều có nhánh lùi bỏ cột lạ** (khuôn migration 0031): `fetchPublicVmsZones` thử `select` kèm `is_border`, lỗi thì hỏi lại không kèm; `/api/admin/vms-zones` tương tự. Nhờ vậy **deploy code mới trước khi apply migration vẫn chạy bình thường**.

**Đã apply** lên `znzgugvfhgmiszqgjulk` 2026-08-25 sau khi chủ dự án chốt ("migrate đi") — luật pre-flight 🔴 là *hỏi trước*, không phải cấm tuyệt đối. Kiểm chứng lại bằng truy vấn read-only:
- `information_schema.columns` → `is_border`, `boolean`, `NOT NULL`, default `false` ✓
- 3 vùng hiện có đều `is_border = false` ⇒ app vẫn dùng ranh giới tĩnh, **hành vi không đổi** cho tới khi admin bấm nút.
- Hình vùng "Ranh giới ngoài khơi (được phép)" trong DB **trùng khít** file tĩnh: LineString 200 điểm, đầu `[108.0873, 21.4843]`, cuối `[103.7918, 10.5054]` ⇒ bật cờ cho vùng đó sẽ không làm lệch cảnh báo.
- `get_advisors(security)` sau khi apply: **không phát sinh cảnh báo mới**; `vms_zones` không nằm trong nhóm "RLS enabled no policy" nên policy còn nguyên.

**CHƯA làm (cố ý)**: không tự `update` cờ `is_border` cho vùng nào. Sửa DỮ LIỆU bằng công cụ DDL, khoá theo id seed cứng, là đúng thứ tài liệu công cụ dặn tránh — và bật cờ là đổi nguồn hình của một cảnh báo IUU. Để admin bấm nút trong `/quan-tri`, cũng là phép thử nút vừa làm.

## 1. Supabase project

- Project ref: **`znzgugvfhgmiszqgjulk`** · Region: **ap-northeast-2**
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (xem `.env.local.example`)
- Env trống → client trả `null` → **demo mode** (localStorage). Chi tiết: [02-architecture.md](02-architecture.md)
- 🔴 **Pre-flight**: mọi thay đổi schema/RLS phải hỏi user trước, KHÔNG tự apply migration lên remote. Migration đã apply là bất biến — sửa bằng migration mới.
- ⚠️ **Sync base 2026-07-28 (đánh số lại migration)**: fork đã apply `0007_premium_grants` · `0008_fish_snapshot` · `0009_weather_snapshot` lên prod (bất biến). Khi kéo tính năng từ repo gốc (Long-Forfun), 6 migration base ĐỤNG SỐ được **đổi tên thành 0013–0018** (chừa khoảng 0010–0012): `0013_crew_reports` · `0014_market_listings` · `0015_crew_reports_phone` · `0016_product_catalog` · `0017_product_inquiries` · `0018_push_subscriptions`. **CẦN apply 0013–0018 lên Supabase prod** thì tính năng thuyền viên CCCD / chợ mua-bán / danh mục sản phẩm / Web Push mới chạy.

## 2. Tables — migration [`supabase/migrations/0001_init.sql`](../../supabase/migrations/0001_init.sql)

### `public.boats` — tàu của ngư dân
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `owner_id` | uuid → `auth.users` | cascade delete |
| `name` | text not null | tên tàu chủ đặt |
| `registration` | text | số đăng ký, vd "BV-1234-TS" |
| `length_m` | numeric | chiều dài (m) |
| `created_at` | timestamptz | default now() |

> **Bảng này app CHƯA dùng** — hồ sơ tàu thật nằm ở `forfish.boats.v1` (máy) + gương `user_docs` kind=`boats` (jsonb, giữ NGUYÊN shape `Boat` của `src/lib/boats.ts`). **HỒ SƠ THEO GIẤY (2026-10-06)**: `Boat` thêm 19 ô TUỲ CHỌN chép từ Giấy chứng nhận đăng ký · Giấy an toàn kỹ thuật · Giấy phép khai thác — `ownerName` · `callSign` (hô hiệu) · `regPort` (cảng đăng ký) · `gear` (nghề chính) · `fishingZone` (`khoi`/`long`/`ven_bo`) · `vesselClass` (`khong_han_che`/`han_che_1..3`) · `hullMaterial` (`go`/`thep`/`composite`/`khac`) · `builtYear` · `builtPlace` · `crewMax` · `grossTonnage` (GT) · `deadweightT` · `breadthM` (Bmax) · `depthM` (D) · `draughtM` (d) · `engineModel` · `engineSerial` · `engineKw` · `engineCount`. CHỈ CỘNG THÊM ⇒ không bump khoá, không migration (jsonb). CỐ Ý KHÔNG có CCCD/địa chỉ chủ tàu (danh sách tàu đi vào tệp sao lưu `lib/offline-backup`, CCCD thì không bao giờ); CCCD + chứng chỉ thuyền trưởng ở sổ thuyền viên (`crew.ts`, R2 của 08). Số đọc dấu phẩy Việt (`parseBoatNumber` — "55,60" ⇒ 55.6; bản cũ `parseFloat` ra 55).

### `public.documents` — giấy tờ (Trục 4)
| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | uuid PK | |
| `boat_id` | uuid → `boats` | cascade; index `documents_boat_id_idx` |
| `owner_id` | uuid → `auth.users` | denormalized cho RLS |
| `kind` | text not null | xem DocumentKind dưới |
| `label` | text not null | nhãn hiển thị tiếng Việt |
| `number` | text | số hiệu |
| `issued_on` / `expires_on` | date | `expires_on` null = không hết hạn; index theo `expires_on` |
| `note` | text | |
| `created_at` | timestamptz | |

### RLS — owner-only (cả 2 bảng)
```sql
for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id)
```
Invariant: mọi bảng user-data mới đều bật RLS owner-only theo pattern này. KHÔNG bypass RLS từ client.

### Bảng khách hàng SDFish — migration [`0002_customers.sql`](../../supabase/migrations/0002_customers.sql) (Đợt 1, 2026-06-16)

App khách hàng độc lập (tách SDWork): DB RIÊNG giữ KH · thiết bị · vật tư. Dữ liệu do **webhook SDWork nạp** (service-role, bypass RLS); KH chỉ **ĐỌC** hàng của mình.

| Bảng | Cột chính | RLS |
|---|---|---|
| `customers` | `phone` (unique, định danh), `name`, `sdwork_ref` (unique) | SELECT `using (phone = current_phone())` |
| `devices` | `customer_phone`, `name`, `serial`, `model`, `purchased_on`, `warranty_until`, `order_code`, `sdwork_ref` (unique) | SELECT `using (customer_phone = current_phone())` |
| `supplies` | `customer_phone`, `name`, `qty` (numeric, thập phân OK), `unit` (cái/cuộn/kg/m — migration [`0004`](../../supabase/migrations/0004_supplies_unit_column.sql) fix drift prod 2026-06-25), `order_code`, `sdwork_ref` (unique) | SELECT `using (customer_phone = current_phone())` |
| `support_requests` | `owner_id`→auth.users, `phone`, `summary`, `status` | owner-only `for all (auth.uid()=owner_id)` (KH tự tạo) |

- **`current_phone()`** (SQL stable, security definer): `split_part(auth.jwt()->>'email','@','1')` — SĐT từ email ảo `{SĐT}@sdvico.local`.
- Ghi customers/devices/supplies + **provision auth user** (SĐT+mật khẩu) CHỈ qua **admin client** (`src/lib/supabase/admin.ts`, service-role) trong route webhook — KHÔNG cho client ghi.
- Idempotent: upsert theo `sdwork_ref` (`onConflict`).
- 🔴 Migration AUTHOR sẵn, **CHƯA apply prod** — bước duyệt riêng. App degrade gracefully nếu bảng chưa có (`/api/me/sdvico` → `no_link` → UI local).

### Phân hạng tài khoản — migration [`0006_account_tier.sql`](../../supabase/migrations/0006_account_tier.sql) (2026-07-26)

Premium mở **dự báo cá** + **dự báo thời tiết quá 3 ngày** (basic/chưa đăng nhập bị khoá — xem [01-product](01-product.md)). KHÔNG có luồng thanh toán trong app.

| Cột mới trên `customers` | Nghĩa |
|---|---|
| `tier text not null default 'basic'` (check `basic\|premium`) | hạng tài khoản |
| `premium_until timestamptz` | hạn premium; `null` = không hạn; hết hạn → coi như basic |

- **Luật hạng hiệu lực** ở `src/lib/tier.ts` (`resolveTier` — thuần, có test): client (`use-tier.ts`), middleware (chặn `/api/fish-forecast`) và admin health dùng CHUNG; fail-closed (giá trị lạ/ngày hỏng/lỗi query → basic). DB **không cần cron** hạ hạng.
- **Nguồn gán hạng** (2 đường, không đè nhau): webhook SDWork (customer event kèm `tier`/`premiumUntil` — VẮNG field thì upsert KHÔNG đụng hạng hiện có) và web quản trị `/quan-tri` (PATCH `/api/admin/accounts`, service-role).
- KH đọc hạng của mình qua policy SELECT own-phone sẵn có (0002) — không cần policy mới.
- **Admin ≠ hạng trong DB**: quản trị viên (env `ADMIN_PHONES` cứu hộ **hoặc** `staff_accounts` role='admin', 0056) được vào `/quan-tri` + xem dự báo cá như premium — MỘT luật `effectiveTier` (`src/lib/staff-store.ts`) cho cả middleware lẫn `premiumDenied` (trước 2026-10-02: chỉ admin env, admin DB bị chặn oan). Quản lý KHÔNG được miễn.

### Tài khoản quản lý + log cấp premium — migration [`0007_premium_grants.sql`](../../supabase/migrations/0007_premium_grants.sql) (2026-07-26, đợt 2)

| Thay đổi | Nghĩa |
|---|---|
| `customers.role text default 'customer'` (check `customer\|manager\|admin` — **'admin' mở ở [0019](../../supabase/migrations/0019_admin_role.sql), 2026-07-28**) | **manager** = đại lý/sales (admin tạo ở `/quan-tri`): vào được `/quan-tri` với quyền THEO BẢNG PHÂN QUYỀN (migration `0028` — mặc định 5 tab: Tài khoản/Sản phẩm/Thuyền viên/Thông báo/Chỗ bán); KÍCH HOẠT/GIA HẠN premium. **admin** = FULL-ADMIN trong DB (ngang env `ADMIN_PHONES`): `requireStaff` coi `role='admin'` = toàn quyền. Bootstrap admin đầu (sau khi đăng ký ở `/dang-ky`): `insert into customers (phone,role) values ('<sđt>','admin') on conflict (phone) do update set role='admin';` |
| `customers.premium_activated_at timestamptz` | mốc kích hoạt gần nhất (hạn ở `premium_until`) |
| bảng `premium_grants` | LOG mỗi lần cấp: `customer_phone` · `granted_by` (SĐT người thao tác) · `action` (`activate\|renew\|downgrade\|trial` — `trial` từ 0088, dùng thử theo ngày, mỗi khách ≤1 lượt) · `activated_at` · `premium_until` (hạn SAU thao tác) — đếm được mỗi quản lý đang quản bao nhiêu premium. RLS bật, **KHÔNG policy** = chỉ service-role đọc/ghi |

- **KỲ HẠN: CHỌN ĐƯỢC, mặc định 1 NĂM 6 THÁNG** (`PREMIUM_TERM_MONTHS=18` + `PREMIUM_TERM_PRESETS`/`clampTermMonths`/`nextPremiumUntil(cur,now,months?)` trong `src/lib/tier.ts`, có test): còn hạn thì gia hạn CỘNG NỐI vào hạn cũ, hết hạn thì tính từ hiện tại. Kỳ hạn tính **tháng lịch** (trước 2026-08-10 là `PREMIUM_TERM_DAYS=548` ngày cứng). Admin chọn gói (`1 năm`/`1 năm 6 tháng`) hoặc nhập số tháng tuỳ ý ở `/quan-tri`; server nhận `termMonths` qua POST/PATCH grant và **tự clamp 1–120** (body bịa số không phá được hạn). **Ưu đãi 2026-08-04**: gói 500k nâng 1 năm → 1 năm 6 tháng. Ngoại lệ **300k = 1 năm** cho 2 SĐT cũ (`0384668304`, `0376002882`) — KHÔNG có luồng cấp 300k trong app. Migration [`0032_premium_uu_dai_6thang`](../../supabase/migrations/0032_premium_uu_dai_6thang.sql) là bản **đối soát** bản +6 tháng: cắt `0376002882` về 1 năm (chốt chặn >13 tháng, idempotent) + **xoá 12 dòng log dấu migration** để trả credit "người cấp" về staff thật — không đụng `premium_until` đã cộng.
- **Đối soát lẻ từng SĐT cấp nhầm kỳ hạn**: khi tài khoản được cấp premium với kỳ hạn sai (vd tạo TRƯỚC khi có ô chọn kỳ hạn → dính mặc định 18 tháng dù chỉ mua 1 năm), viết 1 migration cắt/nới cột `premium_until` theo mốc `premium_activated_at`, idempotent (guard theo kỳ hạn hiện có), KHÔNG ghi thêm `premium_grants`. Bản đầu: [`0044_premium_0971516459_cat_ve_1nam`](../../supabase/migrations/0044_premium_0971516459_cat_ve_1nam.sql) (2026-08-10) — cắt `0971516459` từ 18 → 12 tháng (trừ 6 tháng, guard `> premium_activated_at + 13 months`). ⚠️ CHƯA apply prod.
- **Phân quyền staff** (`lib/admin-auth.ts` + `lib/staff-permissions.ts`): admin (env) = toàn quyền; manager (DB) = **theo bảng phân quyền** (xem migration `0028` bên dưới). Log cấp premium hỏng KHÔNG chặn thao tác nhưng trả cờ `logged:false` — UI nói thật để đối soát.
- **TẠO TÀI KHOẢN KHÔNG HẠ VAI** (2026-10-02): `POST /api/admin/accounts` đọc hàng `customers` cũ trước khi upsert; vai sau khi tạo = `roleAfterCreate(cũ, yêu cầu)` (`src/lib/admin.ts`, có test) = **vai cao hơn** (customer < manager < admin). Hạ vai CHỈ qua `set-role` (3 chốt + nhật ký). Bỏ trống tên thì giữ tên cũ; đọc hàng cũ lỗi → 500 `lookup_failed`, không ghi mù. Trả kèm `existed`/`role`/`keptRole` để UI nói thật "đã có tài khoản, mật khẩu cũ giữ nguyên". Án lệ: 2026-09-30 form tạo KHÁCH (cấp premium) trên SĐT đã có tài khoản đã ghi đè `role` thành `customer` mà không có dòng `staff.set-role` nào.
- **Nguồn admin KÉP** (user chốt 2026-07-31): env `ADMIN_PHONES` **HOẶC** `customers.role='admin'` — nguồn DB để thêm/bớt quản trị viên ngay trên web (ăn ngay, không deploy), env giữ làm **CỬA CỨU HỘ** (web KHÔNG hạ được admin từ env, phòng khi DB bị hạ nhầm hết). Luật thuần `src/lib/admin.ts` (có test): `mergeAdmins(env,db)` (gộp không trùng, env thắng) · `checkDemoteAdmin` chặn 3 ca — `self` (tự hạ mình) · `env_admin` (web không sửa env) · `last_admin` (hạ mất người cuối = khoá cửa cả nhà) · `checkSetRole` (**NÂNG lên admin LUÔN được** kể cả SĐT đang lấy quyền từ env = đường di cư env→DB: ghi quyền, kiểm tra vào được, rồi mới xoá khỏi `ADMIN_PHONES`; chỉ HẠ mới qua 3 chốt). Nâng/hạ qua `PATCH /api/admin/staff` `{action:"set-role", phone, role}` (**`requireAdmin`**), ghi nhật ký `staff.set-role` (đánh dấu nhạy cảm); UI tab **Phân quyền** → khối "Quản trị viên · toàn quyền" (ghi rõ nguồn `từ env`/`từ tài khoản`, nút Hạ chỉ hiện với nguồn DB) + ô "Nâng lên quản trị viên", cả hai qua `ConfirmDialog`. ⚠️ Việc nới ràng buộc `customers_role_check` cho `'admin'` là của [`0019_admin_role`](../../supabase/migrations/0019_admin_role.sql) (prod đã sửa tay nhận `'admin'`, hàng `0900000001`; `0004` trong repo chỉ có 2 giá trị — `0019_admin_role` kéo repo về đúng prod, chạy trên prod là no-op).

### Snapshot dự báo cá (precompute) — migration [`0008_fish_snapshot.sql`](../../supabase/migrations/0008_fish_snapshot.sql) (2026-07-26)

| Thay đổi | Nghĩa |
|---|---|
| bảng `fish_forecast_snapshot` | **MỖI MÔ HÌNH CÁ MỘT DÒNG (2026-10-05)** `id='latest:<vân tay 12 hex>'` (`fishSnapshotRowId` ở `lib/fish-snapshot.ts` — sha256 chữ ký mô hình + khí hậu SST + mã lưới rạn); dòng cũ `id='latest'` chỉ còn bản deploy CŨ ghi (vô hại, code mới không đọc). Vì sao: bảng dùng chung giữa các deploy — bản Vercel cũ đè dòng chung bằng số mô hình cũ ⇒ prod mất ngừ ồ. KHÔNG cần migration (cột `id text`, 0008, không ràng buộc giá trị); mỗi lần đổi mô hình thêm 1 dòng ~180 KB. Mỗi dòng: `payload jsonb` (y hệt payload `/api/fish-forecast`) · `target_date` · `data_quality real` · `generated_at` · `updated_at`. **CRON tính sẵn** (`/api/cron/refresh-fish`, GitHub Actions 6h + Vercel cron) rồi ghi; `/api/fish-forecast` chỉ ĐỌC (nhanh, không phụ thuộc nguồn nặng/hay-treo ERDDAP/HYCOM/Copernicus). Chưa có snapshot → route tự tính fallback. RLS bật, **KHÔNG policy** = chỉ service-role đọc/ghi (`lib/fish-snapshot.ts`) |

- **KÍCH HOẠT (sau khi apply 0005)**: đặt env `CRON_SECRET` trên Vercel (Vercel Cron tự gắn `Authorization: Bearer` header đó) + GitHub Secret `CRON_SECRET` trùng + GitHub Variable `APP_BASE_URL` = URL prod. `SUPABASE_SERVICE_ROLE_KEY` đã có sẵn. Ghi đè snapshot theo `shouldReplaceSnapshot` (`lib/fish-snapshot-policy.ts`, thuần, có test): không lùi ngày, không thay bản tốt bằng bản hỏng.

### Snapshot thời tiết Open-Meteo (LƯỚI AN TOÀN) — migration [`0009_weather_snapshot.sql`](../../supabase/migrations/0009_weather_snapshot.sql) (2026-07-26)

| Thay đổi | Nghĩa |
|---|---|
| bảng `weather_snapshot` | Nhiều khoá 1 bảng: `id text pk` (`sea:<port>` 10 cảng đủ 16 ngày · `grid:d3` lưới Windy CHỈ khung miễn phí · **`tau-ais:latest`** (2026-10-26) bản vị trí tàu AIS quanh biển VN — máy thu GPU ghi đè ~10 phút qua `POST /api/tau-ais/nhap`, app đọc `GET /api/tau-ais`; KHÔNG phải thời tiết nhưng dùng chung bảng snapshot KV để khỏi thêm bảng) · `payload jsonb` · `updated_at`. **KHÁC snapshot cá**: đây chỉ là **fallback** — client vẫn gọi **LIVE Open-Meteo là chính** (nhanh, tải phân tán theo IP từng máy — tốt rate-limit); snapshot chỉ dùng khi live lỗi + máy chưa có localStorage. Cron `/api/cron/refresh-weather` ghi; client đọc qua `/api/weather-snapshot?id=` (`lib/weather-snapshot.ts`, service-role). RLS bật, **KHÔNG policy**. Khung lưới >3 ngày (premium) KHÔNG snapshot công khai kẻo lộ |
| id `routegrid:<0-5>:<0-5>` (2026-10-16, KHÔNG migration — chỉ thêm dạng id) | Ô lưới gió sóng DẪN ĐƯỜNG 8×8 mắt bước 0,35°, 96 giờ, số nguyên đã nhân hệ số (`lib/route-grid.ts` `RouteTile` v1: `start` ngày VN của giờ 0, `builtAt`, `cells[64]` null = đất). KHÁC các hàng trên: đây là NGUỒN CHÍNH của dẫn đường (máy không gọi Open-Meteo nữa), server ghi theo nhu cầu khi ô cũ >3h (`lib/route-grid-server.ts`). Miễn phí (không hậu tố `:dN`) |

- **KÍCH HOẠT**: dùng CHUNG `CRON_SECRET` với refresh-fish (đã có). Vercel cron `30 2 * * *` (lệch 30′ sau fish). Khoá whitelist ở `lib/weather-snapshot-id.ts` (thuần, có test) — chặn `/api/weather-snapshot` thành proxy đọc bảng tuỳ ý.

### Cảnh báo THUYỀN VIÊN chéo (CCCD HOẶC SĐT) — migration [`0013_crew_reports.sql`](../../supabase/migrations/0013_crew_reports.sql) + [`0015_crew_reports_phone.sql`](../../supabase/migrations/0015_crew_reports_phone.sql) (2026-07-27) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `crew_reports` | Chủ tàu **premium** báo cáo vấn đề của thuyền viên; chủ tàu khác tra trước khi thuê thấy cảnh báo **đã kiểm duyệt**. **Định danh = CCCD HOẶC SĐT (1 trong 2, 0009)**: khoá tra `subject_cccd_hash` = SHA-256(pepper+CCCD) và/hoặc `subject_phone_hash` = SHA-256(pepper+"phone:"+SĐT) — cả hai NULLABLE, check `crew_reports_identity_check` bắt buộc ≥1. Env `CREW_CCCD_PEPPER` (không dò/duyệt được danh sách). `subject_cccd`/`subject_phone`/`subject_name` (thô, CHỈ admin) · `reporter_phone`/`reporter_boat` (ẩn với người tra; ="SDVICO" khi staff tự thêm) · `category` (bo_tau/trom_cap/gay_roi/chat_kich_thich/no_ung/khac) · `detail` · `status` (pending→approved/rejected/withdrawn) · `moderated_by`/`at` · `subject_response`/`at` · `created_at`. RLS bật, **KHÔNG policy** = chỉ service-role (`lib/crew-report.ts` thuần + `lib/crew-report-hash.ts` server: `hashCccd`/`hashPhone`/`subjectIdentity`) |
| RLS + quyền | Client KHÔNG đọc/ghi trực tiếp. Qua route (gác **premium** + kiểm duyệt): `POST /api/crew-reports` (chủ tàu nộp→pending), `GET /api/crew-reports/lookup?cccd=&phone=` (chỉ approved, ẩn người báo, khớp CCCD **hoặc** SĐT), `/api/admin/crew-reports` **GET** (staff xem đủ) · **POST** (staff TỰ THÊM → thẳng `approved`) · **PATCH** (duyệt/từ chối/rút + phản hồi) · **DELETE** `?id=` (xóa hẳn khỏi danh sách). Premium chốt ở `lib/premium-guard.ts` |

- ✅ **ĐÃ APPLY prod 2026-07-27** (ref znzgugvfhgmiszqgjulk, qua Supabase MCP — cả 0007 và 0009; advisor chỉ INFO `rls_enabled_no_policy` = đúng thiết kế service-role). Env `CREW_CCCD_PEPPER` (≥16 ký tự) đã đặt trên Vercel → tính năng LIVE; thiếu pepper thì route trả 503 `cccd_pepper_missing` (fail-closed).
- **Pháp lý (NĐ 13/2023)**: CCCD/SĐT là dữ liệu cá nhân → chốt với chủ dự án: **kiểm duyệt bắt buộc** (trừ staff tự thêm = thẩm quyền SDVICO, duyệt luôn) + người bị ghi được phản hồi; khoá tra là hash (không lộ danh sách); người báo ẩn với người tra.

### Chợ TIN MUA/BÁN — migration [`0014_market_listings.sql`](../../supabase/migrations/0014_market_listings.sql) (2026-07-27) + [`0043_market_listings_owner_phone.sql`](../../supabase/migrations/0043_market_listings_owner_phone.sql) (2026-08-05)

| Thay đổi | Nghĩa |
|---|---|
| bảng `market_listings` | Chủ tàu tự đăng **tin bán** (`side='ban'`) / **tin mua** (`side='mua'`) trong `/tien` mục Tin mua/bán. Cột: `owner_phone` (SĐT chủ tin, ĐỊNH DANH từ 0043; NULL = tin webhook thu mua) · `owner_id`→auth.users (LEGACY, không đọc nữa) · `side` · `poster_kind` (ngu-dan/nau/vua/nha-may/cho) · `poster_name` · `species` · `quantity`/`price_text`/`province`/`phone`/`note` (chữ tự do) · `status` (open/closed) · `sdwork_ref` (unique, idempotent upsert). Ghi/đọc qua **ROUTE server** `/api/market-listings` (+`/[id]`), client `lib/market-listings.ts` gọi `authedFetch`; helper thuần `validateDraft`/`rowToListing` ở `lib/market-listings-core.ts` (có test) dùng chung client↔route |
| ⚠️ ĐỔI 0043 (định danh theo SĐT) | Sau bản chuỗi-cứng (0037) app **bỏ phiên Supabase** → `auth.uid()` NULL vĩnh viễn → RLS `auth.uid()=owner_id` chết CẢ đọc lẫn ghi: người ĐANG đăng nhập vẫn bị "Cần đăng nhập để đăng tin" + feed rỗng. Fix: thêm cột `owner_phone`, chuyển ghi/đọc sang route server bằng **service-role + chuỗi cứng** (`identityFromRequest`), quyền sở hữu chốt bằng `owner_phone == who.phone`. Cùng luật định-danh-theo-SĐT với devices/supplies/push_messages |
| RLS | Giữ nguyên policy 0014 (`auth.uid()`) làm **lá chắn tầng hai** — client ẩn danh không đọc/ghi thẳng được. Cổng THẬT nay ở route server (service-role bypass RLS, tự lọc theo `owner_phone`) |

- ✅ **0014 ĐÃ APPLY prod** (2026-07-27). ⚠️ **0043 CHƯA apply prod** — cần chạy để cột `owner_phone` tồn tại thì đăng/xem tin mới chạy thật (ref znzgugvfhgmiszqgjulk, KHÔNG tự apply). Máy chưa cấu hình env → `fetchListings` trả null → empty state, đăng tin báo lỗi mềm.
- **Lộ trình**: app riêng bên thu mua đăng tin cần mua đổ về qua webhook (`sdwork_ref`, `owner_phone`/`owner_id` NULL) — khi làm cần bổ sung [contract SDWork](../contracts/sdwork-assets.contract.md).

### KHO BẢN TIN BÃO (vẽ đường đi) — migration [`0048_storm_bulletins.sql`](../../supabase/migrations/0048_storm_bulletins.sql) (2026-08-18, đánh lại số 2026-08-19) — ⚠️ **CHƯA APPLY prod SDVICO**

**Vì sao** (chủ dự án): *"nên có DB lưu các bản tin để vẽ cho chuẩn — bão A có tin lúc nào, tâm bão thời gian nào, bán kính bao nhiêu, hướng di chuyển nào; lúc update thì update phần mới"* và *"cái bão đã đi qua và sắp tới, cứ mỗi lần update thì hiệu chỉnh phần sắp tới thôi"*. Trước bản này app chỉ giữ **bản tin mới nhất** (bộ nhớ + cache SW): mỗi lượt hỏi là ghi đè ⇒ **không bao giờ vẽ được đoạn cơn ĐÃ ĐI**.

| Bảng | Nghĩa |
|---|---|
| `storm_bulletins` | **MỘT HÀNG = MỘT BẢN TIN, BẤT BIẾN** (chỉ insert). Cột: `storm_key` (gom bản tin về cùng một cơn) · `issued_at` (giờ PHÁT) · `observed_at` (giờ QUAN TRẮC tâm, sớm hơn ~1h) · `la_bao`/`so_bao` · `lat`/`lon` · `cap`/`giat` · `dir`/`speed_kmh` · `radius_km` · `danger_box` jsonb · `risk` · `source`/`url`/`raw_text`. **`unique (storm_key, issued_at)`** là trọng tài chống ghi trùng — cron chạy 30 phút/lần trong khi nguồn phát 3–6 giờ/lần, nên phần lớn lượt trúng unique và trả `saved:0`. Đường **ĐÃ ĐI** = nối `lat/lon` các hàng cùng `storm_key` theo thời gian |
| `storm_forecast_points` | Các mốc dự báo **CỦA MỘT bản tin** (`bulletin_id` FK cascade, `seq` giữ thứ tự trong bảng 24/48/72 giờ). Đường **SẮP TỚI** = mốc của bản tin MỚI NHẤT ⇒ tin mới chỉ đụng phần này, phần đã đi giữ nguyên — đúng ý "hiệu chỉnh phần sắp tới thôi" |
| RLS | **Bật, KHÔNG policy** — client không đọc thẳng. Ghi qua `/api/cron/refresh-storms`, đọc qua `/api/storms` (cả hai service-role). Cùng khuôn `fish_forecast_snapshot`/`weather_snapshot` |

- ⚠️ **`radius_km` NULLABLE và thường NULL — có chủ ý.** Bản tin **áp thấp nhiệt đới** của NCHMF **không phát bán kính gió mạnh** (đã đo trên bản tin thật 18/8); chỉ bản tin **bão** mới ghi thẳng *"Bán kính gió mạnh cấp 6 khoảng 250km"*. Thứ nguồn LUÔN phát là **vùng nguy hiểm dạng khung toạ độ** (`danger_box`) — bản đồ vẽ cái đó. **Không mượn sai số dự báo của JMA/NHC vẽ vòng tròn quanh tâm**: đó là tự nhận một trách nhiệm mình không có, ở chỗ dính tính mạng. **Tin mới hụt số thì mượn của tin CŨ cùng cơn** (2026-09-02, `rowsToTracks`): `radius_km`/mốc dự báo lấy từ bản tin trước đó, TÂM vẫn của tin mới nhất — mượn số cơ quan ĐÃ TỪNG phát (đổi chậm giữa hai bản tin) khác hẳn với bịa số của cơ quan khác; track khai `buTuTinLuc` và màn in ra giờ tin đã mượn.
- **Khoá cơn** (`stormKeyFor`, `src/lib/storm-bulletin.ts`): bão có số → `bao-so-5-2026`. Áp thấp **không có tên/số nào** — gom theo LIÊN TỤC (cách bản tin trước ≤12 giờ **và** tâm cách ≤600 km) → giữ khoá cũ; không khớp thì cơn MỚI `atnd-20260818`. **ATNĐ mạnh lên thành bão**: cron `khoaCanDoiTen` đổi NHÃN các hàng cũ sang khoá bão (lần DUY NHẤT hàng cũ bị sửa, và chỉ sửa cột `storm_key`) — không làm thì đường đi đứt làm đôi đúng lúc cơn nguy hiểm nhất.
- ⚠️ **CHƯA APPLY prod SDVICO** (ref `znzgugvfhgmiszqgjulk`, KHÔNG tự apply) — dòng "đã apply" của base là prod BASE. Chưa apply thì `/api/storms` chỉ thiếu phần vẽ đường đi, tin bão vẫn chạy.
- **Chưa cấu hình Supabase → không lỗi**: `/api/storms` trả `tracks: []` và tin bão vẫn đi như cũ. Phần vẽ đẹp KHÔNG được phép làm mất phần cảnh báo.

### QUÉT TIN BÃO THEO MỨC ƯU TIÊN — migration [`0049_storm_scan_priority.sql`](../../supabase/migrations/0049_storm_scan_priority.sql) (2026-08-18, đánh lại số 2026-08-19) — ⚠️ **CHƯA APPLY prod SDVICO**

**Vì sao** (chủ dự án): *"quét theo mức độ ưu tiên, chứ không phải cứ quét 30 phút 1 lần mãi; thường 1 ngày 1 lần định kỳ là ok, rồi khi có bão thì theo dõi diễn biến mới tăng tần suất lên 1h/lần … tránh quét liên tục rồi bị treo lỗi và làm tốn tài nguyên"*. Bản 0036 quét 48 lượt/ngày × 2 lượt tải HTML = **96 request/ngày** vào trang cơ quan nhà nước, phần lớn để nhận lại đúng bản tin đã có. Luật nhịp: [ADR 0005](../adr/0005-nhip-quet-tin-bao-theo-muc-uu-tien.md), mã thuần + test ở `src/lib/storm-scan.ts`.

| Thay đổi | Nghĩa |
|---|---|
| `storm_bulletins.next_at timestamptz` | Giờ **NGUỒN TỰ HẸN** bản tin kế (*"Bản tin tiếp theo: 14h00 ngày 18/8"*, `parseGioBanTinTiepTheo`). Đây là nhịp THẬT do cơ quan phát tin công bố và nó **tự đổi theo mọi nấc leo thang** của QĐ 18/2021 (6 giờ/lần ngoài Biển Đông → 3 giờ/lần gần bờ → 1 giờ/lần khẩn cấp). Chép cứng bảng tần suất vào code thì sai đúng lúc nguy hiểm nhất. NULL = bản tin không ghi ⇒ đường lùi 6 giờ |
| bảng `storm_scan_log` | **Một hàng = một lượt THẬT SỰ hỏi nguồn.** Cổng nhịp cần biết "lần cuối hỏi lúc nào", mà `storm_bulletins` không trả lời được: ngày trời yên không có bản tin nào để ghi ⇒ kho đứng im ⇒ cổng tưởng chưa bao giờ quét ⇒ quét lại mỗi lượt. Cột: `scanned_at` · `muc` (`ngu`\|`xa`\|`gan`) · `ket_qua` (`saved`\|`da-co`\|`no-bulletin`\|`parse-failed`\|…) · `storm_key` · `vi` (câu lý do nguyên văn). Giữ CẢ lượt hỏng — đây cũng là **bằng chứng nhịp thật**, nghi app đập nguồn thì mở bảng ra đếm |
| RLS | Bật, KHÔNG policy — cùng khuôn 0036. Chỉ route server (service-role) đọc/ghi |

- **Ghi sổ TRƯỚC khi hỏi nguồn**, không phải sau: nguồn treo / route bị cắt giữa chừng mà chưa kịp ghi thì lượt sau lại thấy "chưa quét" và lao vào hỏi tiếp — đúng cảnh quét liên tục cần tránh.
- Kết quả đo: **96 → 2 request/ngày khi trời yên** (một lượt = index + bản tin). Bão còn xa → theo mốc nguồn hẹn (thường 6 giờ). Bão ≤500 km tới cảng hoặc từ cấp 10 → 1 giờ/lần.
- ⚠️ **CHƯA APPLY prod SDVICO** (ref `znzgugvfhgmiszqgjulk`, KHÔNG tự apply).

### ĐỒNG BỘ SỔ per-máy (cross-device) — migration [`0050_user_docs.sql`](../../supabase/migrations/0050_user_docs.sql) (2026-08-26, P1) — ✅ **ĐÃ CÓ ở prod `znzgugvfhgmiszqgjulk`** (đo 2026-10-06: bảng có dữ liệu 5 kind, bucket `user-docs` private có; ghi chú "apply nhầm project 2026-09-18" bên dưới là lịch sử)

Nguồn + thiết kế đầy đủ: [docs/specs/dong-bo-so-per-may.md](../specs/dong-bo-so-per-may.md). Trước nay hồ sơ tàu / bảo dưỡng / vật tư / sổ thuyền viên / tủ giấy tờ CHỈ nằm localStorage per-máy → nhập ở điện thoại không thấy trên PC. P1 đấu 3 sổ KHÔNG nhạy cảm; crew/documents (CCCD/giấy tờ) ở P2/P3.

| Mục | Chi tiết |
|---|---|
| bảng `user_docs` | "Gương" mỗi khoá `forfish.<kind>.v1` thành 1 dòng server. Cột: `owner_phone` (SĐT chủ, ĐỊNH DANH) · `kind` (`boats`/`crew`/`documents`/`maintenance`/`materials`, có `check`) · `data` (jsonb — giữ NGUYÊN shape localStorage) · `client_updated_at` (bigint ms — last-write-wins mức kind) · `updated_at`. PK `(owner_phone, kind)`. |
| Đọc/ghi | ROUTE server `GET/PUT /api/me/sync` (service-role + `identityFromRequest`, lọc `owner_phone`), client `lib/user-sync.ts` (`authedFetch`); helper thuần `lib/user-sync-core.ts` (`isSyncKind`/`invalidPut`, có test) dùng chung client↔route. |
| RLS | **ĐÓNG HẲN** — enable RLS, **0 policy** cho anon/authenticated (dữ liệu riêng tư, sẽ chứa CCCD/giấy tờ). Chỉ service-role (route đã kiểm owner) đụng được. Client ẩn danh không đọc được của ai. |
| Offline-first | localStorage vẫn là nguồn đọc chính; server chỉ để máy khác kéo. Ghi local → đẩy (dirty nếu mất sóng); kéo lúc mở app/online → bản mới hơn thắng (máy đang dirty thì KHÔNG nhận đè). Bookkeeping ở khoá `forfish.sync.v1` (NEVER_BACKUP) — shape xem [state-registry](ops/state-registry.md). |
| **GỘP THEO MỤC (2026-10-06)** | User: *"mỗi tài khoản lưu trữ và quản lý hồ sơ tàu của họ, đăng nhập ở thiết bị khác vẫn xem được, hiện tại thì không"*. Luật cũ LAST-WRITE-WINS **NGUYÊN CUỐN** làm mất đồ khi 2 máy (đo prod: giấy trỏ vào tàu mà cuốn tàu server không có — tàu tạo ở máy này bị cuốn của máy kia đè, không tombstone vì server chưa từng thấy). Nay PUT kèm `baseIds` (id máy thấy ở lần đồng bộ trước, giữ ở `forfish.sync.v1` mục `ids`) ⇒ route gộp 3 chiều `mergeById` (`lib/user-sync-core`, thuần, có test): máy thêm/xoá + máy khác thêm/xoá đều giữ; mục có ở cả hai ⇒ bên ghi sau thắng; `_deleted` trên server luôn là xoá; **không biết base ⇒ gộp HỢP, không suy ra xoá** (thà hiện lại còn hơn mất). Gộp xong khác server ⇒ ghi với mốc `max(client, server+1)` (máy khác thấy mới hơn mà kéo) rồi trả `server` để máy nhận; giống server ⇒ không ghi. Máy chỉ nhận cuốn gộp khi KHÔNG ghi thêm trong lúc chờ. App đời cũ (không gửi `baseIds`) ⇒ route giữ luật cũ. KHÔNG migration (jsonb + client_updated_at sẵn có) |
| **CHỦ SỔ (2026-10-06)** | `GET /api/me/sync` trả thêm `phone` (chính người gọi). Máy ghi `_owner` vào `forfish.sync.v1`; lần kéo sau thấy `_owner` ≠ SĐT server ⇒ sổ trong máy là của tài khoản TRƯỚC (nhánh "bị đá" giữ dữ liệu, rồi người khác đăng nhập) ⇒ `clearUserScopedData` + `clearSyncMeta` rồi kéo đúng sổ — trước đây người sau THẤY sổ người trước và sổ dirty của người trước bị ĐẨY vào tài khoản người sau. Đẩy lẻ (`markLocalWrite`) cũng dừng khi `_owner` ≠ `offlineIdentityPhone`. Chỉ dọn khi server xác nhận (có sóng) — mất sóng không bao giờ dọn. Máy đời cũ chưa có `_owner` ⇒ nhận người đang đăng nhập làm chủ (không đoán được hơn) |
| **SEED (đổi 2026-10-06)** | Server CHƯA có dòng của một kind mà máy có dữ liệu ⇒ đẩy lên, BẤT KỂ mốc (bản cũ chỉ seed khi mốc = 0). Đo prod: 2 chủ tàu có giấy tờ trên server nhưng KHÔNG có dòng `boats` ⇒ đăng nhập máy khác không có tàu, giấy gắn tàu bị ẩn; lần mở máy cũ kế tiếp sẽ tự đẩy tàu lên |
| **Mục "mồ côi" (2026-10-06)** | Giấy tờ/bảo dưỡng/đồ đã mua trỏ vào `boatId` KHÔNG còn trong danh sách tàu ⇒ hiện ở tàu đang xem như mục chưa gắn tàu (`showsUnderBoat`, `lib/boats.ts`) — trước đây không tàu nào nhận nên "biến mất" ở mọi máy. Sửa → Lưu một lần là tự gắn lại tàu đang xem |
| `forfish.places.v1` — loại + ghi chú (2026-11-04) | Điểm ghim `SavedPlace` thêm hai trường TUỲ CHỌN: `loai?: "ca" \| "ran" \| "xac" \| "neo" \| "khac"` và `ghiChu?: string` (≤ 200, cắt + trim) — đặt ở thẻ lưu điểm chế độ Hải đồ. Điểm cũ không có hai trường vẫn hợp lệ (`isValid` không đổi), KHÔNG bump phiên bản kho, không thêm khoá rỗng. `upsertPlace` GIỮ loại/ghi chú cũ khi chỗ gọi không truyền (bản đồ thường ghim lại cùng chỗ chỉ đổi tên) — không để màn này xoá dữ liệu bà con gõ ở màn kia. Không đồng bộ máy chủ (như cũ). |
| Ảnh điểm (2026-11-04) | `SavedPlace.anh?: string[]` (≤ 3): path Storage `<sđt>/diem_<id điểm>/<uuid>.jpg` ở bucket riêng tư `user-docs` (DÙNG LẠI route `/api/me/docs/photo`, luật chủ theo tiền tố SĐT — không bảng/migration mới) HOẶC khoá `cho:<id>` = ảnh còn trong kho chờ IndexedDB `forfish-anh-diem` (chụp lúc mất sóng; không tự xoá; đẩy xong mới gỡ; ảnh mồ côi > 10 phút bị gỡ). Ảnh nén ≤ 1280 px / ~900 KB. Xoá điểm ⇒ xoá ảnh (máy chủ + kho). Đăng xuất ⇒ xoá kho chờ (`signOutLocal`). |
| Reset khi ĐĂNG XUẤT | Đăng xuất/gỡ máy xoá `USER_SCOPED_KEYS` (boats/crew/documents/…) PHẢI kèm `clearSyncMeta()` (`lib/user-sync`, 2026-09-18) reset `forfish.sync.v1` về 0 **cả bản trong bộ nhớ `metaCache`**. Không reset thì lần đăng nhập lại `syncAll` so LWW `server.clientUpdatedAt > metaOf().at` = **false** (mốc cũ còn ngang server) ⇒ KHÔNG kéo bản server ⇒ chủ thật thấy TRỐNG. (Đã đúng prod — đo 2026-10-06, xem dòng ĐO LẠI bên dưới; câu "apply nhầm, chưa recoverable" ngày 2026-09-18 là lịch sử.) boats/crew/documents/maintenance/materials kéo lại được; RIÊNG buyers/places/routes/cart KHÔNG đồng bộ nên xoá là mất hẳn (copy "Gỡ máy" chỉ hứa "phần đã đồng bộ"). |
| Cascade | Xoá tài khoản (`/api/admin/accounts` DELETE) xoá luôn `user_docs` theo SĐT (riêng tư). Xoá 1 giấy tờ → dọn ảnh Storage của nó. |
| ẢNH giấy tờ (P3) | migration [`0051_user_docs_photos.sql`](../../supabase/migrations/0051_user_docs_photos.sql): bucket Storage **private** `user-docs` (public=false, KHÔNG policy → chỉ service-role). `BoatDocument.photos[]` giữ ĐƯỜNG DẪN (`<owner_phone>/<docId>/<uuid>.jpg`) — đồng bộ nhẹ qua user_docs (kind=documents); bytes đọc/ghi qua route `/api/me/docs/photo` (POST/GET signed-url/DELETE, owner theo tiền tố path=SĐT). Client nén ≤1600px/~1.8MB (`lib/doc-photos.ts`) + `DocPhotoStrip` (`components/document-photos.tsx`). **v1**: thêm/xem ảnh cần có sóng (nợ: hàng đợi offline). |

| GIỮ BẢN ĐÃ XOÁ | Chủ dự án 2026-09-01: *"đã xoá thì xoá ở máy còn trên server vẫn có"*. **KHÔNG bảng mới, KHÔNG migration** — `data` vốn là `jsonb`: bản ghi biến mất so với lần đẩy trước thì Ở LẠI trong chính cuốn sổ đó, chỉ thêm `_deleted: true` + `_deletedAt` (giờ server). Luật thuần ở [`lib/sync-tombstone.ts`](../../src/lib/sync-tombstone.ts): `keepDeleted` ghép lúc PUT, `stripDeleted` lọc lúc GET **và** ở nhánh trả `stale` — máy bà con KHÔNG BAO GIỜ nhận lại thứ mình đã bỏ. Phân tích thì đọc thẳng cột `data` (lọc `_deleted = true`). Chỉ áp cho sổ là MẢNG bản ghi có `id`; shape khác thì lấy nguyên bản mới, không đoán. **KHÔNG có gì thêm chạy qua đường truyền hay nằm lại máy**: GET trả bản đã lọc ⇒ localStorage không chứa bản xoá ⇒ lần đẩy sau cũng sạch. Chỉ CỘT `data` trên server lớn dần theo số lần xoá. **DẤU XOÁ THẮNG (2026-10-24)**: trước đây máy cũ chưa kéo tin xoá mà sửa sau thì nhánh LWW-cả-cuốn để bản ghi sống lại (chủ dự án từng bỏ qua 2026-09-01 vì "mỗi chủ tàu một máy") — anh Long gặp thật: giấy tờ + bạn thuyền đã xoá, mở lại app lại hiện. Nay nhánh đó lọc qua `dropDeleted` (cùng file): id server đã gắn `_deleted` thì bỏ khỏi cuốn máy gửi và trả cuốn đã lọc cho máy đó bỏ theo — cùng luật nhánh gộp theo mục. Chi tiết + 3 đường khác: [dong-bo-so-per-may §vá 2026-10-24](../specs/dong-bo-so-per-may.md). Đã chốt bằng test (`sync-tombstone.test.ts`, `sync-xoa-khong-hien-lai.test.ts`). Đã khai ở [/quyen-rieng-tu](../../src/app/quyen-rieng-tu/page.tsx) mục 4. |

- ✅ **ĐO LẠI 2026-10-06 (chỉ đọc)**: `public.user_docs` + bucket `user-docs` ĐÃ CÓ ở `znzgugvfhgmiszqgjulk`, có dòng thật (boats/documents/crew/maintenance/materials) ⇒ đồng bộ đang chạy; cron nhắc hạn `/api/cron/notify-docs` đọc từ đây. Mục dưới giữ làm lịch sử.
- ~~⚠️ **APPLY NHẦM PROJECT (2026-09-18)**~~ — chủ dự án apply 0050 + 0051 vào SAI Supabase project; đúng prod (ref `znzgugvfhgmiszqgjulk`) **CHƯA có**. Hệ quả: route `/api/me/sync` + `/api/me/docs/photo` ở prod thật vẫn trả 503/500, client giữ localStorage như cũ (không mất dữ liệu, chỉ CHƯA đồng bộ) ⇒ đăng xuất/gỡ máy xoá bản máy thì hồ sơ tay CHƯA kéo lại được tới khi apply LẠI đúng project. Cần: (1) apply 0050+0051 lên `znzgugvfhgmiszqgjulk`; (2) tuỳ chọn dọn bảng `public.user_docs` + bucket `user-docs` orphan ở project nhầm (cả hai idempotent, non-destructive — xem quy trình dọn ở lịch sử phiên/PR). Sau khi apply đúng: đổi mục này về ✅ + boats/crew/documents/maintenance/materials đồng bộ hai chiều.

### Danh mục sản phẩm ADMIN quản lý — migration [`0016_product_catalog.sql`](../../supabase/migrations/0016_product_catalog.sql) (2026-07-28) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `product_listings` | Thay mảng cứng `data/sdvico-showcase.ts` làm nguồn cho khu "Cửa hàng" tab Sản phẩm `/tau` (`sdvico-catalog.tsx`). Admin ẩn/hiện/xóa/thêm ở `/quan-tri` tab "Sản phẩm" — **áp dụng NGAY, không cần build/deploy lại app**. Cột: `vendor_kind` (`sdvico`\|`external`) · `vendor_name` (bắt buộc khi `external` — đơn vị NGOÀI SDWork) · `title`/`category`/`description`/`features` (jsonb mảng chuỗi)/`price_text`/`image_url` · `contact_phone`/`contact_note` (liên hệ riêng cho vendor ngoài) · `line` (nối nhóm SKU CRM để nhận diện "đang dùng", chỉ áp dụng sdvico) · `visible`/`sort_order` · `created_by`. Seed sẵn 6 sản phẩm showcase cũ (giữ nội dung khi apply, admin sửa/ẩn/thêm tiếp từ đó) |
| RLS | **ĐỌC**: công khai, chỉ hàng `visible = true` (tab Sản phẩm là nội dung public — xem §7). **GHI/SỬA/XÓA**: KHÔNG có policy — chỉ service-role qua `/api/admin/products` — **phân quyền** `requirePermission("san-pham", …)`: GET=view·POST=create·PATCH=edit·DELETE=delete (xem 0028) |

- ✅ **ĐÃ APPLY prod 2026-07-28** (ref `znzgugvfhgmiszqgjulk`, qua Supabase MCP — user xác nhận apply; advisor không cảnh báo gì mới cho bảng này). Trước khi apply, app chạy bằng `SDVICO_SHOWCASE` tĩnh (client `fetchProductListings()` trả `null` khi bảng chưa tồn tại/chưa cấu hình → fallback, không crash) — hành vi fallback này vẫn giữ nguyên cho các môi trường (vd local dev) chưa apply.

### CHI TIẾT sản phẩm + seed đủ danh mục — migration [`0054_product_catalog_seed_2026.sql`](../../supabase/migrations/0054_product_catalog_seed_2026.sql) (2026-09-24) — ⚠️ **CHƯA APPLY prod**

| Thay đổi | Nghĩa |
|---|---|
| cột `product_listings.detail jsonb` (nullable) | Nội dung TRANG CHI TIẾT sản phẩm: `{models, maker, forWho, benefits[], specs[{label,value}], variant}` — hiện trong sheet Chi tiết (`ProductDetailSheet` ở `sdvico-catalog.tsx`, mở bằng nút "Xem chi tiết"). NULL = thẻ đơn giản như cũ (backward-safe). Đọc qua `toDetail()` (`lib/product-catalog.ts`, khoan dung, có test) — thêm vào select công khai + `/api/admin/products` GET |
| SEED 11 sản phẩm chi tiết | Thay 6 seed cũ (0016, uuid `1111`-series) bằng **11 sản phẩm** từ tài liệu chính thức SDVICO ("Thong-tin-chi-tiet-san-pham-SDVICO.docx"), uuid `2222`-series. **BỎ "Điện thoại vệ tinh XT-Pro"** (không có trong tài liệu). `delete` 6 uuid seed cũ (admin tự thêm — uuid ngẫu nhiên — KHÔNG bị đụng) + `on conflict (id) do update` (idempotent, chạy lại refresh nội dung) |

- **NGUỒN ĐƠN + sinh tự động**: nội dung ở `src/data/sdvico-showcase.ts` (type `ShowcaseProduct.detail: ProductDetail`); migration SQL **sinh bằng** `node scripts/gen-product-seed.mjs` (Node ≥22 strip type) — **sửa sản phẩm ⇒ sửa file TS rồi chạy lại script**, đừng sửa SQL tay. Cùng mảng này là FALLBACK tĩnh khi Supabase chưa cấu hình.
- Ảnh: `/public/sdvico/*` (loc-dau.jpg · sea40.jpg · s-tracking.jpg · vifish.png · thuraya.jpg · nano-graphene.jpg · adnano.png · ac-quy.png · pv-paint.png · sdfish.png; 2 app: SDFish có ảnh, Ngư dân 247 để trống → thẻ fallback nhãn loại).
- Nhóm Cửa hàng (`group`): 9 thiết bị/vật tư gán `dien_tu`/`co_dien`/`nhu_yeu_pham`; 2 app để NULL → gom "Khác".
- ⚠️ **CHƯA APPLY prod** (ref `znzgugvfhgmiszqgjulk`, KHÔNG tự apply). Chưa apply thì prod giữ 6 seed cũ; local/demo đã thấy 11 sản phẩm qua fallback tĩnh.

### DỌN danh mục — chỉ giữ 11 sản phẩm tài liệu — migration [`0055_product_catalog_prune.sql`](../../supabase/migrations/0055_product_catalog_prune.sql) (2026-09-24) — ⚠️ **CHƯA APPLY prod**

`delete from product_listings where vendor_kind='sdvico' and id not in (<11 uuid seed>)` — xóa các sản phẩm SDVICO KHÔNG thuộc tài liệu còn sót trong bảng (bộ đàm, máy dò cá, hàng test…). **GIỮ nguyên sản phẩm đơn vị NGOÀI** (`vendor_kind='external'`). Idempotent. Sinh cùng `scripts/gen-product-seed.mjs` (danh sách uuid đồng bộ với 0054). Cần cho prod vì 0054 chỉ xóa 6 seed cũ (uuid 1111) chứ không đụng sản phẩm admin/nguồn khác đã thêm.

### Yêu cầu hỏi mua/tư vấn — migration [`0017_product_inquiries.sql`](../../supabase/migrations/0017_product_inquiries.sql) (2026-07-28, Phase 2) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `product_inquiries` | Bà con "Để lại yêu cầu" từ danh mục sản phẩm — bảng RIÊNG của SDFish, **KHÔNG dùng chung `consultation_requests` bên CRM SDWork** (user chốt). **Phạm vi (quyết định thiết kế)**: sản phẩm `vendor_kind='sdvico'` vẫn giữ nguyên nút "Hỏi mua" cũ → `/api/sdvico/request` → CRM (kênh bán hàng SDWork đang theo dõi thật — KHÔNG đụng để tránh rớt lead); bảng này phục vụ cái GAP thật là sản phẩm **đơn vị NGOÀI SDWork** (trước đây chỉ hiện SĐT, không nơi nào ghi lại). Cột: `listing_id`→`product_listings` (nullable, `on delete set null`) · `listing_title`/`vendor_kind` (chụp lại tại thời điểm hỏi, phòng listing bị xóa/sửa) · `customer_phone`(bắt buộc)/`customer_name`/`message` · `status` (`moi`→`da_lien_he`→`xong`) · `handled_by`/`handled_at`/`note` |
| RLS | **KHÔNG có policy nào** — client không đọc/ghi trực tiếp. GHI qua `POST /api/product-inquiries` (công khai, cho phép khách CHƯA đăng nhập, giống `/api/sdvico/request`) dùng service-role. ĐỌC/SỬA/XÓA qua `/api/admin/product-inquiries` (**`requireAdmin` — admin-only cứng**, xem 0028) — UI ở `/quan-tri` tab "Yêu cầu" |

- ✅ **ĐÃ APPLY prod 2026-07-28** (ref `znzgugvfhgmiszqgjulk`, qua Supabase MCP — advisor chỉ INFO `rls_enabled_no_policy` = đúng thiết kế service-role).

### Web Push — đăng ký nhận thông báo — migration [`0018_push_subscriptions.sql`](../../supabase/migrations/0018_push_subscriptions.sql) (2026-07-28, Phase 3) — ✅ ĐÃ APPLY prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `push_subscriptions` | Admin gửi thông báo cho TỪNG user (theo SĐT) hoặc TOÀN BỘ user đã bấm "Bật thông báo" trong app (sheet Tài khoản → `hero-account.tsx`) — qua PWA service worker (`public/sw.js`), **không cần app store update**, không SMS/Zalo. Cột: `customer_phone` (nullable — null = ẩn danh, chỉ nhận broadcast toàn bộ, KHÔNG nhận thông báo nhắm theo SĐT) · `endpoint` (unique, định danh máy đăng ký) · `p256dh`/`auth_key` (khoá mã hoá Web Push chuẩn) · `user_agent` · `created_at`/`last_seen_at` |
| RLS | **KHÔNG có policy nào** — client không đọc/ghi trực tiếp. Đăng ký/hủy qua `POST`/`DELETE /api/push/subscribe` (công khai, dùng service-role, gắn SĐT từ session nếu đã đăng nhập). Gửi qua `POST /api/admin/push` (**phân quyền** `requirePermission("thong-bao", …)`: GET=view·POST=create) — endpoint chết (404/410 khi gửi) tự xóa khỏi bảng, không cần cron dọn riêng |

- ✅ **ĐÃ APPLY prod 2026-07-28** (ref `znzgugvfhgmiszqgjulk`, qua Supabase MCP — advisor chỉ INFO `rls_enabled_no_policy` = đúng thiết kế service-role). ⚠️ **Tính năng CHƯA chạy được thật cho tới khi set đủ env VAPID** trên Vercel (xem dưới) rồi redeploy — thiếu thì nút "Bật thông báo" tự ẩn, `/api/admin/push` trả `503`.
- **Cần env** (server): `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT` (tạo 1 lần bằng `npx web-push generate-vapid-keys`) + `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (client, PHẢI TRÙNG `VAPID_PUBLIC_KEY`) — thiếu thì nút "Bật thông báo" tự ẩn (`hero-account.tsx` check `isPushSupported()` + biến env trước khi hiện) và `/api/admin/push` trả `503 vapid_not_configured`.
- **Gửi thật**: `src/lib/push-send.ts` (server-only, dùng npm `web-push`) — `sendPush()` trả `gone:true` khi endpoint 404/410, route admin tự xóa subscription đó.

### Vùng biển VMS — admin quản lý — migration [`0013_vms_zones.sql`](../../supabase/migrations/0013_vms_zones.sql) (2026-07-28) — 🔴 CHƯA apply prod

| Thay đổi | Nghĩa |
|---|---|
| bảng `vms_zones` | Vùng biển VMS hiện trên bản đồ Ra khơi (`/ngu-truong`) do admin **thêm/bớt/ẩn** + đặt **hiển thị mặc định trên app ngư dân** ngay trong `/quan-tri` tab "Vùng biển" — áp dụng NGAY, không build lại app. Thay dữ liệu tĩnh `data/vms-zones.json`. Cột: `name` · `color` (#rrggbb) · `style` (`fill`/`line`/`line-dashed`) · `default_on` (toggle app ngư dân mặc định bật — bà con vẫn tắt được, lưu override localStorage `forfish.mapPrefs.v1` → `vmsOverrides`) · `visible` (admin ẩn/hiện vùng) · `geojson` (jsonb, FeatureCollection **đã giản lược server-side** Douglas–Peucker ~1km khi tải lên) · `sort_order` · `created_by`. Nhập hình vùng bằng **TẢI FILE GeoJSON** (như 3 file SDVico) — client parse (`parseUploadedGeoJSON`) + server giản lược (`simplifyFeatureCollection` ≤200k điểm input). |
| RLS | ĐỌC công khai `visible=true` (vùng tham khảo là nội dung public — app đọc qua `lib/vms-zones.ts` `fetchPublicVmsZones`, lỗi/chưa cấu hình → fallback `STATIC_VMS_ZONES` = 3 vùng mặc định từ `data/vms-zones.json`). GHI/SỬA/XÓA **KHÔNG có policy** — chỉ service-role qua `/api/admin/vms-zones` (**`requireAdmin` — admin-only cứng**, xem 0028). |

- 🔴 **CHƯA apply prod** — chạy migration `0013_vms_zones.sql` (đã seed sẵn 3 vùng mặc định để app không mất vùng đang có). Trước khi apply app vẫn chạy bằng fallback tĩnh (không lỗi).
- Migration seed sinh bởi `scripts/gen-vms-zones-migration.py` từ `data/vms-zones.json`; cung ngoài khơi "được phép" tách bởi `scripts/derive-allowed-offshore.py` — KHÔNG sửa 2 file sinh ra (`vms-zones.json`, migration) bằng tay.

### Danh bạ "Bán ở đâu" — admin quản lý — migration [`0014_sell_contacts.sql`](../../supabase/migrations/0014_sell_contacts.sql) (2026-07-28) — ✅ ĐÃ APPLY prod (bảng rỗng)

| Thay đổi | Nghĩa |
|---|---|
| bảng `sell_contacts` | Danh bạ 3 mục CÔNG KHAI của trục Giao dịch (`/tien` → "Bán ở đâu"): **Nậu vựa · Chợ đầu mối · Nhà máy** — admin sửa/ẩn/hiện/xóa/thêm ngay trong `/quan-tri` tab "Chỗ bán", áp dụng NGAY cho app. Thay 3 bộ tĩnh (`data/wholesalers`, `market-channels`, `seafood-buyers`). Cột: `kind` (`vua`/`cho`/`nhamay`) · `name` · `sub_label` (nhãn phụ loại vựa) · `province`/`address`/`phone`/`hours` · `species`/`markets` (jsonb string[]) · `website` · `direct` (nhà máy mua trực tiếp) · `visible` · `sort_order` · `created_by`. **"Mối quen"** (mục thứ 4) vẫn là **localStorage `forfish.buyers.v1` RIÊNG của bà con — KHÔNG vào bảng này.** |
| RLS | ĐỌC công khai `visible=true` (app đọc qua `lib/sell-contacts.ts` `fetchPublicSellContacts`; lỗi/chưa cấu hình/**bảng rỗng** → fallback `STATIC_SELL_CONTACTS` = gộp 3 bộ tĩnh, giữ nguyên hành vi cũ). GHI/SỬA/XÓA **KHÔNG có policy** — chỉ service-role qua `/api/admin/sell-contacts` (**phân quyền** `requirePermission("cho-ban", …)`: GET=view·POST/seed=create·PATCH=edit·DELETE=delete). |

- ✅ **ĐÃ APPLY prod 2026-07-28** (ref `znzgugvfhgmiszqgjulk`) — bảng tạo RỖNG, **KHÔNG seed trong SQL** (~143 đầu mối nằm ở `data/*.ts`). App chạy bằng fallback tĩnh cho tới khi admin bấm **"Nạp danh bạ mặc định"** (`POST /api/admin/sell-contacts {action:"seed"}` — chỉ chạy khi bảng rỗng) để đổ dữ liệu tĩnh vào bảng rồi quản lý tiếp.
- **Lộ trình** (thứ tự user chốt 2026-07-28: danh mục → yêu cầu tư vấn → **thông báo** — ĐỦ 3 phần): mở rộng SMS/Zalo là việc SAU nếu cần (chưa yêu cầu).

### Cấu hình ứng dụng (thay env máy chủ) — migration [`0015_app_config.sql`](../../supabase/migrations/0015_app_config.sql) (2026-07-28) — ✅ ĐÃ APPLY prod (bảng rỗng)

| Thay đổi | Nghĩa |
|---|---|
| bảng `app_config` (`key` PK, `value`, `updated_by`, `updated_at`) | Cấu hình lưu DB để **KHÔNG lệ thuộc env máy chủ deploy** (Vercel): admin dán khoá trong `/quan-tri` tab **Hệ thống → Cấu hình ứng dụng**, áp dụng NGAY, không cần set env + redeploy. Khoá hiện có (`lib/app-config-keys.ts` `CONFIG_KEYS`): `vapid_public_key` · `vapid_private_key` (secret) · `vapid_subject` · `cron_secret` (secret) · **`data_key_current` / `data_key_prev`** (secret, 2026-09-17 — khoá AES mã 15 file dữ liệu biên tập SDF2; build `scripts/encode-data.mjs` đọc qua REST service-role và TỰ SINH nếu trống; `/api/data-key` phát cả hai cho tài khoản đã đăng nhập; PATCH `/api/admin/app-config` với `data_key_current` tự trượt khoá cũ xuống `_prev`). · **`data_key_premium`** (secret, 2026-10-27 — KHOÁ GÓI ngẫu nhiên, KHÔNG suy từ khoá chủ: mã các file `PREMIUM_SDF2` trong `lib/data-premium-files.mjs` — `ran-chi-tiet.v1.pmtiles`, `chat-day.v1.pmtiles`/`.json`, `reef-depth.v1.bin`, `fish-climatology.v1.json`; build đầu TỰ SINH như khoá chủ, env `SDFISH_DATA_KEY_PREMIUM` đè; `/api/data-key` chỉ nối khoá này cho tài khoản premium (`effectiveTier`); máy cất chung `forfish.datakey.v1`, trần 5 khoá). Thêm dòng = ghi dữ liệu, KHÔNG đổi schema. · **`kairos_ingest_key`** (secret, 2026-10-23 — khoá máy thu tin/agent kiểm duyệt trên GPU gửi ở header `x-kairos-key` lên `/api/kairos/nhap` + `/api/kairos/kiem`; ≥32 ký tự, nút Tạo ngẫu nhiên; **env `KAIROS_INGEST_KEY` ĐÈ ô DB** — `lib/kairos/ingest-key.ts`; thiếu cả hai ⇒ 503) · **`tau_ais_key`** (secret, 2026-10-26 — máy thu tàu AIS trên GPU gửi ở `x-tau-ais-key` lên `/api/tau-ais/nhap`; cùng luật env-thắng `TAU_AIS_KEY` — `lib/tau-ais/khoa.ts`). · **`tau_ais_xem`** (KHÔNG secret, 2026-10-29 — danh sách SĐT được xem chế độ AIS; chưa đặt ⇒ chỉ 0938635689; middleware chặn `/api/tau-ais` 403 `ais_off`, `/api/tau-ais/quyen` báo máy — `lib/tau-ais/quyen.ts`). Đọc **DB-TRƯỚC rồi rơi về env cùng tên** (`lib/app-config.ts` `getConfigValue`/`getVapidConfig`, cache 30s) — env cũ vẫn chạy, DB đè lên. `push-send.ts` (`isPushConfigured`/`sendPush`) đọc VAPID qua đây. |
| bảng `app_config` (`key` PK, `value`, `updated_by`, `updated_at`) | Cấu hình lưu DB để **KHÔNG lệ thuộc env máy chủ deploy** (Vercel): admin dán khoá trong `/quan-tri` tab **Hệ thống → Cấu hình ứng dụng**, áp dụng NGAY, không cần set env + redeploy. Khoá hiện có (`lib/app-config-keys.ts` `CONFIG_KEYS`): `vapid_public_key` · `vapid_private_key` (secret) · `vapid_subject` · `cron_secret` (secret) · **`anthropic_api_key` (secret, env `ANTHROPIC_API_KEY`) + `assistant_daily_limit` (mặc định 30, kẹp 1..500, env `ASSISTANT_DAILY_LIMIT`) — Trợ lý giọng nói (14 §6.2, 2026-09-06; KHÔNG migration, bảng là KV)** · `assistant_engine` / `qwen_base_url` / `qwen_model` / `qwen_api_key` (secret) — engine tầng mạng (2026-09-12) · **`assistant_online_enabled` (2026-09-30, env `ASSISTANT_ONLINE_ENABLED`; trống = BẬT, `tat`/0/false/off = tắt tầng mạng, kho trong máy vẫn chạy)**. Đọc **DB-TRƯỚC rồi rơi về env cùng tên** (`lib/app-config.ts` `getConfigValue`/`getVapidConfig`, cache 30s) — env cũ vẫn chạy, DB đè lên. `push-send.ts` (`isPushConfigured`/`sendPush`) đọc VAPID qua đây. |
| RLS | Bật, **KHÔNG policy** — chỉ service-role. Client KHÔNG đọc trực tiếp (bảng chứa secret). Xem/ghi qua `/api/admin/app-config` (**`requireAdmin`**, GET che giá trị secret). Khoá PUBLIC lộ riêng qua `GET /api/push/vapid-public-key` (client fetch runtime thay vì nhúng `NEXT_PUBLIC_VAPID_PUBLIC_KEY` lúc build). |

- ✅ **ĐÃ APPLY prod 2026-07-28** — bảng RỖNG (không seed). Chưa dán khoá → `getConfigValue` rơi về env; cả env lẫn DB đều trống → Web Push báo "chưa cấu hình". Helper thuần `resolveConfigCell`/`isConfigKey` (`app-config-keys.ts`) có test.
- **Vì sao đẻ ra**: env VAPID trên Vercel set rồi mà app vẫn báo thiếu (nhiều lần redeploy vẫn lỗi → gần như chắc env không gán đúng môi trường Production / sai tên). Bảng này gỡ hẳn phụ thuộc đó.

### Lịch sử giá cá TÍCH LUỸ — migration [`0016_price_history.sql`](../../supabase/migrations/0016_price_history.sql) (2026-07-29) — ✅ ĐÃ APPLY prod (bảng rỗng)

| Thay đổi | Nghĩa |
|---|---|
| bảng `price_history` (PK **`(week_end, species_id)`**; `min_vnd int` · `max_vnd int` · `province` · `source` default `'vasep'` · `created_at`) | KHO lịch sử giá tuần cho **biểu đồ giá kiểu chứng khoán** (Trục 2). Kho bản tin VASEP chỉ giữ ~13 tuần trên listing → muốn lịch sử dài dần phải LƯU. Cron `/api/cron/snapshot-prices` (**Vercel cron `vercel.json` `0 3 * * 6`, thứ Bảy**) gom các tuần VASEP rồi **UPSERT** (idempotent theo PK); tuần cũ rơi khỏi listing vẫn còn ở đây → lịch sử chỉ dài thêm. Ghi qua service-role (`lib/price-history-store.ts` `saveWeeksToDb`); gom nguồn `lib/port-price-archive.ts` `gatherArchiveWeeks` (dùng chung với route fallback). Transform thuần `rowsToWeeks`/`weeksToRows` (`lib/port-price-history.ts`) có test. |
| RLS | Bật + **policy SELECT `using(true)`** — giá THAM KHẢO công khai, ai cũng đọc (kể cả chưa đăng nhập); GHI chỉ service-role. `/api/port-prices/history` ĐỌC kho DB trước (`loadHistoryFromDb`, REST + revalidate 6h), **<2 điểm thì LÙI** về gom kho VASEP trực tiếp → demo mode / chưa apply vẫn có biểu đồ. |

- ✅ **ĐÃ APPLY prod 2026-07-29** (ref `znzgugvfhgmiszqgjulk`) — bảng RỖNG (chưa backfill). Chưa chạy cron → `loadHistoryFromDb` trả rỗng, route lùi về gom kho VASEP trực tiếp = hành vi trước khi có DB (biểu đồ vẫn chạy, chỉ không dài quá ~13 tuần).
- **KÍCH HOẠT còn thiếu**: cron dùng chung env `CRON_SECRET` với refresh-fish (đã có); `SUPABASE_SERVICE_ROLE_KEY` đã có. Chạy trên **Vercel cron** (`vercel.json`, thứ Bảy) — Vercel Cron tự gắn `Authorization: Bearer CRON_SECRET`. ⚠️ Đây là cron THỨ 3 → **Hobby chỉ cho 2 cron/dự án**, cần Pro (hoặc chờ đến thứ Bảy đầu tiên để backfill; muốn ngay thì gọi tay endpoint với header Bearer).

### Phân quyền tài khoản quản lý — migration [`0028_staff_permissions.sql`](../../supabase/migrations/0028_staff_permissions.sql) (2026-07-30) — ✅ ĐÃ APPLY prod 2026-08-01

| Thay đổi | Nghĩa |
|---|---|
| `customers.staff_permissions jsonb` (nullable) | Bảng quyền của một **QUẢN LÝ** (`role='manager'`): `{tab: {view,create,edit,delete}}` trên **5 tab được phép** — `tai-khoan · san-pham · canh-bao · thong-bao · cho-ban`. **NULL = preset mặc định** (quản lý mới: xem+tạo+sửa, KHÔNG xóa). Chỉ service-role (`/api/admin/staff`) ghi. **Thêm 2026-10-06**: khoá phẳng `resetPassword: boolean` (cờ riêng "Đặt lại mật khẩu khách của mình", mặc định/thiếu/rác ⇒ `false`) — cùng shape ở `staff_accounts.permissions` (0056); không migration. |

- **Vai trò nâng cấp** từ nhị phân → **tab × hành động**. Luật THUẦN (client-safe, có test) ở [`src/lib/staff-permissions.ts`](../../src/lib/staff-permissions.ts): `MANAGER_TABS`, `PERM_ACTIONS` (view/create/edit/delete), `DEFAULT_MANAGER_PERMISSIONS`, `normalizePermissions` (fail-closed: thiếu tab/cờ → false; null/rác → preset), `can`, `visibleTabs`.
- **4 tab admin-only CỨNG** (không nằm trong bảng quyền, không bao giờ hiện cho quản lý): `yeu-cau` (product-inquiries) · `vung-bien` (vms-zones) · `du-lieu` · `he-thong`. Hai route product-inquiries + vms-zones đổi `requireStaff`→`requireAdmin`.
- **Chốt thật SERVER**: mỗi route `/api/admin/*` gọi `requirePermission(tab, action)` (`lib/admin-auth.ts`) — admin bỏ qua, manager tra bảng. Map: accounts GET=view · POST(khách)=create · PATCH grant=edit · DELETE=delete (downgrade + reset-password + tạo tài khoản QUẢN LÝ vẫn **admin-only cứng**); products/crew-reports/sell-contacts GET=view·POST=create·PATCH=edit·DELETE=delete; push GET=view·POST=create.
- **Soạn quyền**: tab **Phân quyền** trong `/quan-tri` (admin-only) → `/api/admin/staff` **GET** (liệt kê quản lý + bảng quyền chuẩn hoá) · **PATCH** `{phone, permissions}` (ghi bảng). UI ẩn/hiện tab + nút theo `me.permissions` từ `/api/admin/health`.
- **Chưa apply cột thì AN TOÀN**: `requireStaff` tra `staff_permissions` trong try/catch riêng → cột chưa có ⇒ quản lý vẫn vào được với **preset mặc định** (không bị coi là "không phải staff"). Ghi quyền (`PATCH /api/admin/staff`) khi cột chưa có → trả `migration_needed`, UI báo cần apply 0028.
- ⚠️ **CHƯA APPLY prod** (ref `znzgugvfhgmiszqgjulk`). Chưa apply: quản lý cũ chạy theo preset mặc định; tab Phân quyền hiện cảnh báo `migrationNeeded`.

### Ghi chú theo dõi onboarding khách — migration [`0029_customer_staff_notes.sql`](../../supabase/migrations/0029_customer_staff_notes.sql) (2026-07-30) — ✅ ĐÃ APPLY prod 2026-08-01

| Thay đổi | Nghĩa |
|---|---|
| `customers.staff_used boolean default false` | Khách **ĐÃ SỬ DỤNG** app hay chưa (staff đánh dấu) |
| `customers.staff_guided boolean default false` | SDVICO đã **HƯỚNG DẪN TRỰC TIẾP** chưa |
| `customers.staff_note_by text` · `staff_note_at timestamptz` | SĐT staff + mốc cập nhật cờ gần nhất (đối soát) |

- Cờ theo dõi NỘI BỘ của SDVICO — **không đụng luồng khách/premium**. Đọc trong `GET /api/admin/accounts` (map `staffUsed`/`staffGuided`/`noteBy`/`noteAt`); ghi qua `PATCH action='set-flags'` (`{used?,guided?}`) cần cờ **`tai-khoan:edit`** — chỉ vá cờ được gửi, ghi kèm `staff_note_by`/`staff_note_at`, **KHÔNG đụng `updated_at`** (khỏi làm sai nhịp webhook). UI: 2 chip bật/tắt mỗi hàng khách trong tab Tài khoản (sửa được khi có edit; chỉ xem thì hiện badge trạng thái).
- Cột đọc được qua RLS bởi chính chủ (customers self-select) nhưng KHÔNG nhạy cảm (tình trạng onboarding của chính họ); app khách không hiển thị.

### Nhật ký hoạt động admin — migration [`0030_admin_activity_log.sql`](../../supabase/migrations/0030_admin_activity_log.sql) (2026-07-30) — ✅ ĐÃ APPLY prod 2026-08-01

| Thay đổi | Nghĩa |
|---|---|
| bảng `admin_activity_log` (`id` · `actor_phone` · `actor_role` · `action` · `target` · `detail jsonb` · `created_at`; index theo created_at desc / actor / action) | LOG **APPEND-ONLY** mọi thao tác GHI/XÓA của staff trên `/quan-tri` → soát "ai làm gì, lúc nào" (chống thao tác bậy). RLS bật, **KHÔNG policy** = chỉ service-role đọc/ghi |

- **Mã hành động + nhãn**: `src/lib/admin-activity.ts` (THUẦN, client-safe, có test) — `ADMIN_ACTIONS` (`account.create/grant/downgrade/reset-password/set-flags/delete` · `product.*` · `crew.*` · `sell.*` · `push.send` · `inquiry.*` · `zone.*` · `staff.set-permissions`), `ACTION_LABEL` (test bắt buộc mọi mã có nhãn), `isDangerAction` (xóa/reset/hạ hạng/đổi quyền → UI tô đỏ).
- **Ghi log**: helper `src/lib/admin-activity-log.ts` `logActivity(admin, {...})` — log hỏng KHÔNG chặn thao tác chính, nhưng **KHÔNG im lặng** (sửa 2026-07-31): đọc `{ error }` của supabase-js, `console.error("[activity-log] …")` (thấy ở Vercel Logs) và trả boolean. ⚠️ Bản đầu chỉ `await insert()` trong try/catch — supabase-js KHÔNG ném lỗi mà TRẢ error, nên mọi lần ghi hỏng biến mất không dấu vết (prod 31/7: 2 lượt cấp premium mà bảng vẫn 0 dòng; DB đã loại trừ — probe insert bằng service_role chạy được, grants/policy giống hệt `premium_grants`). Gọi ở MỌI mutation của `/api/admin/*` sau khi thành công. **KHÔNG log bí mật** (mật khẩu/token; crew: không log CCCD/SĐT — chỉ loại vấn đề).
- **Đọc**: `GET /api/admin/activity` (**`requireAdmin`** — chỉ quản trị viên) trả tối đa 300 dòng mới nhất, lọc `?actor=` (khớp SĐT) & `?action=`; đọc hỏng → rỗng + `migrationNeeded` + `error{code,message,hint}` THẬT. **`POST`** (requireAdmin) = GHI THỬ một dòng `system.log-probe` rồi đếm lại → nút "Kiểm tra ghi nhật ký" ở tab Nhật ký (biết log câm hay không mà không phải đợi thao tác thật). UI: tab **Nhật ký** (admin-only) — tìm theo SĐT/tên thao tác + chọn loại + nút "Chỉ xóa/nhạy cảm".
- ⚠️ **CHƯA APPLY prod** (ref `znzgugvfhgmiszqgjulk`).

### Hộp thư + biên nhận thông báo — migration [`0034_push_messages_receipts.sql`](../../supabase/migrations/0034_push_messages_receipts.sql) (2026-08-01) — ✅ ĐÃ APPLY prod (soi prod 2026-08-04)

| Bảng | Nghĩa |
|---|---|
| `push_messages` (`id` · `title` · `body` · `url` · `target` `all\|account` · `target_phone` · `sent_by` · `devices` · `sent` · `created_at`) | MỘT DÒNG mỗi lần gửi. Ghi **TRƯỚC khi đẩy** nên tin vẫn còn kể cả đẩy hụt |
| `push_receipts` (`message_id` × `endpoint` · `account_phone` · `delivered_at` · `opened_at`) | Biên nhận THẬT từ máy bà con |

- **Quy ước `sent_by` (chốt 2026-08-18, gói F — KHÔNG migration, cột sẵn có)**: SĐT admin = tin TAY (`/api/admin/push`) · **`system:order`** = đơn hàng (`/api/admin/orders/[id]`, url `/tau?tab=san-pham`; `da_nhan` CHỈ ghi hộp thư — `devices=0`, `pushOs:false`; `dang_giao`/`da_giao`/`da_huy` mới đẩy OS) · **`system:storm`** = bão (cron `/api/cron/notify-storms`, url `/ngu-truong?bao=<khoá>&cap=<watch|danger>&muc=<1..4>&lat=&lon=&t=<epoch s>` (2026-08-18b: thêm TÂM + giờ tin để lượt sau NỐI CƠN theo vị trí qua `lib/storm-identity.ts cungCon`; khoá cùng khuôn kho bản tin `bao-so-N-YYYY` / `atnd-YYYYMMDD-lat-lon` / `gdacs-<tên>`) — **URL chính là SỔ KHỬ TRÙNG 48h** (`STORM_RECENT_WINDOW_MS` + `parseStormPushUrl` trong `lib/storm-push.ts` đọc lại `url` của tin `system:storm` 48h gần nhất): đổi khuôn URL là phải sửa `storm-push.ts` cùng commit). Payload push thêm **`tag`** (`bao-<khoá>` / `don-<orderId>`; tin tay không tag) → `public/sw.js` `showNotification` `{tag, renotify:true}` để tin mới cùng cơn/cùng đơn ĐÈ tin cũ trên màn khoá thay vì xếp chồng.
- **Vì sao**: (a) thông báo vuốt tắt là MẤT — vuốt nhầm một cái là tin bão biến mất không dấu vết; (b) trước chỉ biết "đã đẩy tới Apple/Google", không biết máy có nhận không.
- **Biên nhận đo bằng gì**: service worker CHẠY THẬT trên máy — nhánh `push` gọi `POST /api/push/ack` (`delivered`), `notificationclick` gọi (`opened`, ghi cả hai mốc vì bấm được nghĩa là đã nhận). Không đòi đăng nhập (tin tới lúc app đóng, không chắc có phiên); khoá là cặp `(messageId, endpoint)`, biết endpoint máy khác cũng chỉ đánh dấu hộ, không đọc được nội dung.
- **Hộp thư**: `GET /api/me/messages` (lọc phía SERVER theo phiên) trả tin `target='all'` + tin nhắm đúng tài khoản, ≤50 tin mới nhất. **KHÔNG cho SW cache** (route gắn danh tính, không nằm trong `API_CACHE_ALLOW`); bản offline ở `localStorage forfish.inbox.v1` **mang theo SĐT chủ nhân**, SĐT lệch → coi như trống, và **xoá khi đăng xuất** — máy dùng chung trên tàu.
- **UI**: trang chủ mục **Thông báo** ngay dưới "Bốn việc chính" — 3 tin gần nhất, bấm mở tin cũ hơn; tự ẩn ~~khi chưa đăng nhập/~~ **chỉ khi không có tin** (đính chính 2026-08-18: từ 01n hiện cả khi chưa đăng nhập — tin gửi chung; không chặn theo đăng nhập). `/quan-tri` tab Thông báo có **10 tin gần nhất + cột máy · đẩy · nhận · đọc**.
- ✅ **ĐÃ APPLY prod 2026-08-01** (ref `znzgugvfhgmiszqgjulk`).

### Đọc trong app cũng là đọc — migration [`0035_push_reads.sql`](../../supabase/migrations/0035_push_reads.sql) (2026-08-01) — ✅ ĐÃ APPLY prod (soi prod 2026-08-04)

| Bảng | Nghĩa |
|---|---|
| `push_reads` (`message_id` × `reader` · `account_phone` · `read_at`) | Bà con đã ĐỌC tin, đếm theo **người** |

- **Vì sao**: 0023 chỉ ghi `opened_at` ở nhánh `notificationclick` ⇒ **chỉ** đếm khi bấm vào banner. Nhưng đường đọc phổ biến nhất là liếc trên màn khoá rồi vuốt tắt, hoặc mở app xem mục Thông báo — cả hai không ghi gì, nên `/quan-tri` hiện **"đọc 0" vĩnh viễn** dù tin đã tới mắt. Số dối hại hơn không có số: người gửi tin bão sẽ tưởng tin không tới mà gửi lại, hoặc kết luận sai là bà con không quan tâm.
- **Đơn vị đếm — cố ý khác nhau**: `push_receipts` đếm theo **MÁY** (đo việc *giao tin*), `push_reads` đếm theo **NGƯỜI** (đo việc *đọc*) — một người hai máy đọc một tin vẫn là một người đọc. Khoá `reader` = `sdt:<SĐT>` khi đã đăng nhập (máy chủ tự lấy từ phiên), `may:<endpoint>` khi chưa (hộp thư mở cho cả khách). `/api/admin/push` **GỘP** hai nguồn về cùng dạng khoá rồi đếm số khoá khác nhau, nên bấm banner xong lại mở app đọc chỉ tính một.
- **Mốc đọc đo ở đâu**: `POST /api/me/messages/read` — `InboxSection` quan sát bằng `IntersectionObserver`, thẻ tin lọt ≥50% vào màn hình thì tính là tới mắt (thẻ hiện sẵn cả nội dung, không có gì để "mở ra"; tin sau nút "Xem N tin cũ hơn" chưa vẽ nên không bị tính). Gom 1,2 s một cú. Ghi bằng `upsert ignoreDuplicates` — **lần đầu** đọc mới là mốc có nghĩa.
- **Lỗi kèm theo đã sửa**: `notificationclick` trong `public/sw.js` bắn ack **ngoài** `event.waitUntil` ⇒ trình duyệt được phép giết service worker ngay khi mở xong cửa sổ, cắt request đang bay (iOS giết SW rất mạnh lúc PWA lên foreground) — bà con CÓ bấm mà cột "đọc" vẫn không lên. Nay `waitUntil(Promise.all([focus, ack]))`, test đọc thẳng `sw.js` chống tái phát.
- **⚠️ ẢNH HƯỞNG OFFLINE**: biên nhận là **thống kê**, không phải dữ liệu bà con cần. Client bỏ qua hẳn khi `navigator.onLine === false`, timeout 8 s, nuốt mọi lỗi, và **chỉ ghi vào bản lưu khi máy chủ đã xác nhận** ⇒ hỏng thì lần mở app sau có sóng báo lại, không mất luôn. Không đụng `SHELL`/danh sách cache; route là POST nên SW vốn bỏ qua. Khoá mới `forfish.inbox.read.v1` mang theo SĐT chủ nhân và bị `clearInbox()` xoá lúc đăng xuất — cùng luật cách ly tài khoản với `forfish.inbox.v1`.
- **Đường lùi nếu bảng chưa có**: supabase-js **trả** `error` chứ không ném ⇒ `reads` về rỗng, cột "đọc" tụt về đúng nguồn bấm-banner như cũ; app phía bà con không hỏng gì (route read trả 500, client nuốt lỗi và báo lại lần sau).
- ⚠️ **CHƯA APPLY prod** (ref `znzgugvfhgmiszqgjulk`) — kiểm lại sau khi chạy: bảng có · `rls=true` · **0 policy** (chỉ service-role) · 0 dòng.

### Đo thật việc dùng app — migration [`0031_customer_app_usage.sql`](../../supabase/migrations/0031_customer_app_usage.sql) (2026-08-01) — ✅ ĐÃ APPLY prod 2026-08-01

| Cột mới trên `customers` | Nghĩa |
|---|---|
| `pwa_last_open_at` | Lần cuối mở ở **chế độ đã cài** (standalone). **NULL = chưa bao giờ mở bản cài** — đây là con số đáng nhìn nhất |
| `web_last_open_at` | Lần cuối mở trong tab trình duyệt thường |
| `offline_ready_at` | Lần cuối máy tự báo ĐỦ ĐỒ ĐI BIỂN = vỏ app cài đủ (`shell-ready`) **và** mọi lớp dữ liệu đã tải (`savedCoverage.allSaved`) |
| `data_until` (migration [`0036_customer_data_until.sql`](../../supabase/migrations/0036_customer_data_until.sql), 2026-08-02 — ✅ ĐÃ APPLY prod (soi prod 2026-08-04)) | **Dữ liệu đi biển trong máy phủ tới NGÀY NÀO** (`date`). Ba cột trên chỉ nói "đã từng mở / đã từng đủ"; cột này trả lời câu người trực tổng đài cần nhất: *máy này ra khơi ngày mai thì trong tay bà con có dự báo tới đâu*. NULL = chưa bao giờ báo được |

- **Vì sao**: chip "đã/chưa sử dụng" (0029) là nhân viên TỰ TICK — niềm tin, không phải số đo. Thứ cần biết là **ai đã cài mà chưa bao giờ mở BẢN CÀI**: trên iPhone kho của bản A2HS tách riêng với Safari, nhóm đó ra khơi với máy trắng tay (ca TC-13 trong [ops/qa-offline-acceptance.md](ops/qa-offline-acceptance.md)). Danh sách để GỌI ĐIỆN NHẮC.
- **Ghi**: `POST /api/me/heartbeat` (đăng nhập mới ghi; chưa đăng nhập → `recorded:false`, KHÔNG lỗi). Chỉ ghi MỐC + CHẾ ĐỘ — **không vị trí, không thao tác**. KHÔNG đụng `updated_at` (cột đó là mốc dữ liệu khách đổi; heartbeat ghi vào là mọi tài khoản trông như vừa sửa mỗi lần mở app).
- **Client** `src/lib/heartbeat.ts` + luật thuần dùng chung hai phía `src/lib/heartbeat-policy.ts` — hàng rào offline: mất sóng thì KHÔNG gọi · đồng hồ chặn 5 giây qua `timeoutSignal` (`lib/abort.ts` — **không** gọi thẳng `AbortSignal.timeout`: Safari 15 ném `TypeError` ngay trong `try`, nhịp chết câm mà vẫn trả đủ giá quét kho) + `.catch` nuốt sạch · gọi trong `useEffect` sau 3s, không `await` ở đường vẽ màn. Là POST nên service worker bỏ qua hẳn.
- ⚠️ **CỔNG RẺ TRƯỚC, QUÉT KHO SAU** (sửa 2026-08-02e): chỗ gọi phải dựng đủ payload trước khi hỏi `sendHeartbeat`, mà hai mảnh của payload (`isShellReady()` = 34 lượt `caches.match`; `savedCoverage()` = 11 lượt `loadAll` + 9 lượt `bytesUnder`, riêng `bytesUnder("")` dựng lại toàn bộ chuỗi) đều **quét sạch kho offline trên LUỒNG CHÍNH** — trong khi mọi hàng rào lại nằm BÊN TRONG `sendHeartbeat` và gần như luôn chặn. Kết quả: mỗi lần mở/quay lại app là ~33 MB `JSON.parse` rồi vứt đi, Android rẻ khoá màn 0,5–1,5 giây. Nay `heartbeatNeedsScan` (thuần, có test) trả lời trước bằng **ba mảnh RẺ của chữ ký** (tài khoản · web/bản cài · mã máy), `false` thì hẹn lại rồi thôi. **Đánh đổi chủ dự án chấp nhận**: sự kiện *"vừa đủ đồ đi biển"* (mảnh đắt) trễ tối đa 30 phút; ba sự kiện còn lại vẫn đi ngay. Cùng lúc: `visibilitychange`/`online` cũng đi qua độ trễ 3 giây (trước gọi thẳng, bỏ qua chính độ trễ file đó đặt ra — mà bản cài PWA không remount nên đó là đường vào phổ biến nhất), và có cờ `inFlight` chống hai lượt quét chạy chồng.
- ⚠️ **CẦU DAO KHI MÁY CHỦ NỔ 5xx** (thêm 2026-08-02e): 5xx không ghi chữ ký ⇒ `pending` mãi true ⇒ nhịp mãi là "sự kiện" ⇒ bám 5 phút/lần **vĩnh viễn**; và mỗi lần đổi khuôn chữ ký (gần nhất: thêm `|deviceId`) là TOÀN BỘ máy đang chạy vào trạng thái "có sự kiện chờ" ngay sau deploy ⇒ máy chủ nổ lần nữa = 717 máy × 12 request/giờ. Nay đếm riêng 5xx liên tiếp (`forfish.heartbeat.5xx.v1`); quá `EVENT_5XX_GIVEUP` = 5 thì `eventDegradedToState` hạ nhịp sự kiện về **nhịp định kỳ** (trần 30 phút). **Tin không mất** — chữ ký vẫn chưa ghi, chỉ chậm lại; máy chủ trả lời được một lần là nhả cầu dao.
- ⚠️ **ROUTE KHÔNG ĐƯỢC NUỐT LỖI CÂM** (sửa 2026-08-02e): route này từng có **0 dòng `console`** — `write_failed` trả HTTP 200, và `upsert` vào `customer_devices` vứt luôn `error` (supabase-js **không ném** với lỗi Postgres/RLS, nó *trả về* `{ error }`) ⇒ bảng chưa tồn tại / cột lạ / RLS chặn đều im lặng tuyệt đối, đường phát hiện duy nhất là chủ dự án tình cờ mở /quan-tri. Nay cả hai chỗ `console.error`. **Vẫn giữ HTTP 200** cho `write_failed`: client đọc `recorded`/`need` chứ không đọc status, đổi sang 5xx là đẩy chính client vào nhánh cầu dao ở trên. Cổng chặn khuôn: `src/lib/__tests__/api-silent-catch.test.ts` (cấm `catch {}` không có `console` trong mọi route).
- ⚠️ **HAI LOẠI NHỊP, KHÔNG PHẢI MỘT CỬA THỜI GIAN** (chủ dự án chốt 2026-08-02d). **Mất sóng → không có nhịp nào**: đây là luồng RIÊNG, chạy độc lập, KHÔNG cần heartbeat, KHÔNG cần máy chủ; có sóng lại thì nhịp mới bắt đầu. **Có sóng** thì tách đôi theo BẢN CHẤT: ① **nhịp SỰ KIỆN** (đổi tài khoản · web→bản cài · vừa đủ đồ đi biển · **đổi mã máy**) gửi NGAY rồi **bám 30 giây → 3 phút → 5 phút cho tới khi máy chủ xác nhận GÁN ĐƯỢC**; ② **nhịp ĐỊNH KỲ** 30 phút báo trạng thái hiện giờ (gồm `data_until`), lỡ lượt thì lượt sau bù, thang lùi 1→5→15→30 phút và không bao giờ thưa hơn nhịp khoẻ. Cửa 12 giờ cũ bỏ hẳn — nó sinh ra từ nỗi lo tốn sóng ngoài biển, mà nỗi lo đó nay do luồng offline gánh (*"4G 5G khắp nơi rồi, heartbeat thì nhẹ"*).
- ⚠️ **MÁY CHỦ PHẢI TRẢ LỜI CÓ THỂ HÀNH ĐỘNG ĐƯỢC** — chặn vòng lặp vô ích: `attached` (đã gán vào hàng khách chưa) + `need` (`retry` bám tiếp · `login` chưa có phiên nên DỪNG bám · `wait_admin` không có hàng khách mang SĐT này, việc của người ở bờ nên DỪNG bám · `none` xong) + `nextInMs` (máy chủ xếp lịch, máy **kẹp về [30 giây, 6 giờ]** trước khi nghe). `nextInMs` là chiều ngược DUY NHẤT của kênh này — một con số điều tiết, KHÔNG phải kênh lệnh.
- ⚠️ **`data_until` chỉ đi theo nhịp ĐỊNH KỲ, cố ý KHÔNG vào chữ ký sự kiện**: ngày này đổi sau mỗi lượt tải, đưa vào chữ ký là biến mọi lượt tải thành một "sự kiện" và máy bắn nhịp liên tục. Client khai gì máy chủ cũng ép qua `normalizeDataUntil` (thuần, có test) — chuỗi rác lọt xuống cột `date` là **cả lệnh update hỏng**, mất luôn 3 mốc đang chạy tốt (đúng khuôn lỗi cột 0022 đã dính một lần).
- ⚠️ **`data_until` đo HAI LỚP CỐT LÕI, không phải một** (sửa 2026-08-02e): client trước đây gửi lên `savedCoverage().untilIso`, mà trường đó chỉ duyệt lớp **điểm ghim**. Sai cả hai chiều và cả hai chiều đều sai về phía NGUY HIỂM — (a) lưới CẢ VÙNG bị dọn mà điểm ghim còn ⇒ /quan-tri báo "tới 18/08" trong khi thứ bà con mở ra giữa biển đã mất; (b) lớp `point` là **bậc hy sinh đầu tiên** khi máy hết chỗ nên nó bị dọn trước ⇒ `untilIso = null` ⇒ route bỏ qua (`if (savedUntil)`) ⇒ cột **giữ nguyên con số cũ đã lỗi thời**. Nay client gửi `coreSavedUntil(savedGridUntil(), cov.untilIso)` (`lib/heartbeat.ts`, thuần, có test): ngày **SỚM NHẤT** giữa lưới cả vùng và điểm ghim, `null` khi thiếu một trong hai. `cov.untilIso` KHÔNG đổi nghĩa — chip màn Ra khơi vẫn dùng nó đúng nghĩa "điểm ghim".
- ⚠️ **CỬA 12 GIỜ CHỈ ĐÓNG KHI GHI ĐƯỢC THẬT** (sửa 2026-08-01g): bản đầu ghi dấu TRƯỚC khi gửi và không ai đọc `recorded` ⇒ một lần hỏng là im nửa ngày, và hỏng vĩnh viễn cũng im lặng. Hai lỗi ghép lại: (a) client coi "gửi đi" = "ghi được"; (b) route coi `update().eq()` **khớp 0 hàng** = thành công (Supabase trả `error = null`) nên SĐT không khớp `customers.phone` là hỏng mãi mà vẫn báo ổn. Nay route `.select("phone")` để đếm hàng thật và trả `reason` (`no_session` · `no_customer_row` · `write_failed`, KHÔNG kèm SĐT); client chỉ ghi mốc thành công khi `recorded === true`. Mức hoãn tách sang `forfish.heartbeat.retry.v1` + bộ đếm `forfish.heartbeat.fails.v1`: mất sóng thì vẫn KHÔNG gửi gì; máy đang online mà không nghe được máy chủ trong **5 giây** → ~~thang lùi **30 giây → 3 phút → 5 phút → 12 giờ**~~ **HAI THANG** (đính chính 2026-08-18, khớp [state-registry §heartbeat.retry](ops/state-registry.md) + `lib/heartbeat-policy.ts`): nhịp SỰ KIỆN 30 giây → 3 phút → giữ 5 phút (`EVENT_RETRY_STEPS_MS`) · nhịp ĐỊNH KỲ 1 → 5 → 15 phút → trần **30 phút** (`STATE_BACKOFF_STEPS_MS`; cửa định kỳ `STATE_GAP_MS` = 30 phút thay cửa 12 giờ cũ) và `UsageHeartbeat` tự hẹn giờ thử lại theo thang; máy chủ có trả lời mà chưa ghi được → 30 phút.
- ⚠️ **TIN MỚI ĐI NGAY, KHÔNG CHỜ CỬA 12 GIỜ** (sửa 2026-08-01h): cửa 12 giờ gác theo *thời gian* nhưng thứ cần báo là *trạng thái đã đổi*, nên nó chặn nhầm đúng hai chuyển biến quan trọng — **web → bản cài** (trên Android bản cài dùng chung kho với Chrome ⇒ mở web rồi mở bản cài ngay sau đó thì `pwa_last_open_at` mãi `null`) và **chưa đủ đồ → đủ đồ đi biển** (tải xong lúc 15:00 thì `offline_ready_at` trống tới 03:00 sáng hôm sau — cột an toàn). Nay `beatSignature` (thuần, có test) rút nhịp thành `w-`/`wr`/`p-`/`pr`; khác chữ ký lần ghi được gần nhất thì gửi ngay. Mất sóng và mức hoãn-vì-mạng vẫn chặn trước — tin mới KHÔNG vượt được hai hàng rào đó.
- **Đọc**: `/quan-tri` tab Tài khoản, chip `AppUsage` cạnh chip staff: **"Bản cài · <giờ>"** (xanh) hoặc **"CHƯA mở bản cài"** (vàng, tooltip giải thích kho A2HS tách riêng), + **"Đủ đồ đi biển · <giờ>"**.
- ⚠️ **THANG MỘT CHIỀU: web → bản cài → tải đủ** (siết 2026-08-01j, chủ dự án chốt: *"1 chiều thôi… nếu không PWA thì nó cứ nằm ở Web để đảm bảo họ có PWA"*). `offline_ready_at` **chỉ ghi khi nhịp gửi TỪ BẢN CÀI, mọi nền** — luật ở `src/lib/app-usage.ts` `countsAsOfflineReady` (thuần, có test). Gốc: iOS cho bản A2HS kho RIÊNG tách Safari nên tải đủ trong Safari không chứng minh gì cho bản cài (2026-08-01f). Bản đó **miễn cho Android** vì bản cài ở Android dùng chung kho với Chrome — xét về DỮ LIỆU thì đúng, nhưng thang này là **danh sách GỌI ĐIỆN**: người Android tải đủ trong tab nhảy thẳng lên bậc cao nhất (`usageCallPriority` 3 "yên tâm nhất") và rơi khỏi danh sách nhắc cài, dù màn hình chưa có icon nào — mà tab Chrome dễ bị dọn hơn bản cài và `persist()` cũng khó được cấp hơn. Nay bậc "đủ đồ" **không có đường tắt**. Cờ `ios` đã BỎ khỏi payload (thừa — `platform` mang thông tin đó).
- **Đọc thành BẬC THANG**: `usageStage()` → `chua-ghi-nhan` (chưa gửi nhịp — KHÔNG có nghĩa chưa dùng app) → `moi-vo-web` (mở web, chưa mở bản cài — **nhóm gọi điện trước tiên**) → `da-mo-ban-cai` → `du-do-di-bien`. `usageCallPriority()` xếp ai gọi trước. Cột `staff_used` (0029) vẫn còn trong DB nhưng ĐÃ GỠ khỏi màn — máy đo thật thay cho nhân viên tự tick.
- ✅ **ĐÃ APPLY prod** (ref `znzgugvfhgmiszqgjulk`).

### Máy của khách + lịch sử đổi máy — migration [`0033_customer_device_platform.sql`](../../supabase/migrations/0033_customer_device_platform.sql) (2026-08-01) — ✅ ĐÃ APPLY prod (soi prod 2026-08-04) (advisor: `customer_devices` báo `rls_enabled_no_policy` mức INFO — ĐÚNG THIẾT KẾ, sổ nội bộ chỉ service-role, y như `premium_grants`/`admin_activity_log`)

| Cột/bảng | Nghĩa |
|---|---|
| `customers.device_platform` | Loại máy ĐANG dùng: `ios` \| `android` \| `khac`. Chip ở /quan-tri để nhân viên gọi điện chỉ ĐÚNG bước cài (iPhone: Chia sẻ → Thêm vào Màn hình chính; Android: Cài ứng dụng) |
| `customers.device_id` | Mã máy ĐANG dùng (app tự sinh, `forfish.device.v1`). Nhịp đến từ mã KHÁC ⇒ server **xoá `pwa/web/offline_ready`** rồi ghi lại theo máy mới |
| bảng `customer_devices` | **LỊCH SỬ**: mỗi `(customer_phone × device_id)` một hàng — `platform` · `first_seen_at` · `last_seen_at` + 3 mốc RIÊNG của máy đó. RLS bật, **KHÔNG policy** = chỉ service-role (y như `premium_grants` 0004) |
| `customer_devices.data_until` (0025) | Ngày phủ dữ liệu của **riêng máy đó**. ⚠️ **NÓI THẬT: cột này ĐƯỢC GHI (từ 2026-08-02e) nhưng CHƯA CÓ MÀN NÀO ĐỌC** — `GET /api/admin/accounts` chưa join `customer_devices`, nên lời hứa của migration 0025 (*"đổi điện thoại vẫn tra được máy cũ tải tới đâu"*) mới xong một nửa. Trước 2026-08-02e thì cột này **không ai ghi và cũng không ai đọc**: upsert trong route heartbeat quên hẳn trường đó, `grep data_until src/` chỉ ra 6 chỗ và đều đọc trên `customers`. Đừng để doc hứa một tính năng chưa có |

- **Vì sao `device_id`**: 3 cột mốc của 0031 nằm trên `customers` nên tích luỹ theo **TÀI KHOẢN, không theo MÁY**. Đổi từ iPhone (đã mở bản cài) sang Android (chỉ mở web) thì `pwa_last_open_at` cũ vẫn nằm đó ⇒ /quan-tri báo "Đã mở bản cài" cho cái máy **chưa bao giờ** mở bản cài.
- **KHÔNG phải dấu vân tay**: `device_id` do app sinh NGẪU NHIÊN rồi cất trong máy — không phải IMEI/serial, không suy từ user-agent/màn hình/phần cứng; xoá dữ liệu web là mất, và không nhận ra được máy đó ở trang nào khác. `device_platform` chỉ 3 giá trị thô — **không** user-agent, model, độ phân giải, RAM (ghép lại là nhận diện được từng máy). Vẫn không vị trí, không thao tác.
- **Đường lùi khi cột chưa có** (giữ lại, vẫn cần cho bản deploy cũ đang chạy dở và cho môi trường chưa migrate): route heartbeat thử ghi kèm cột mới, lỗi thì ghi lại **bộ cũ** (nhét cột chưa tồn tại vào là hỏng CẢ lệnh ⇒ mất luôn 3 mốc đang chạy tốt); `GET /api/admin/accounts` cũng thử `device_platform` rồi lùi về bộ cột cũ (hỏng câu select là mất trắng danh sách 700+ khách vì một chip phụ); ghi `customer_devices` bọc `try/catch` — sổ phụ hỏng KHÔNG được làm hỏng nhịp.
- `deviceId` rỗng (storage bị chặn / chế độ riêng tư) → **KHÔNG reset gì**: thà số liệu cũ còn hơn xoá mốc mỗi lần mở app. Kiểm hình dạng bằng `isValidDeviceId` (thuần, có test) trước khi cho xuống DB.
- ⚠️ **CHƯA APPLY prod** (ref `znzgugvfhgmiszqgjulk`).

## 3. Domain logic — `src/lib/documents.ts`

### DocumentKind (giữ sync với cột `kind`)
`dang_ky_tau` · `dang_kiem` · `giay_phep_khai_thac` · `an_toan_thuc_pham` · `bao_hiem` · `chung_chi_thuyen_truong` · `khac` — label tiếng Việt trong `DOCUMENT_KINDS`.
- **2026-10-06** (đối chiếu bộ giấy thật): thêm `dang_ky_tau` "Giấy chứng nhận đăng ký tàu cá" (đứng đầu; thường KHÔNG thời hạn — `kindUsuallyNoExpiry`, form gợi ý để trống hạn). `dang_kiem` GIỮ giá trị, đổi tên hiện "Giấy an toàn kỹ thuật (đăng kiểm)" theo tiêu đề in trên giấy (giấy cũ có `label` "Đăng kiểm tàu cá" nay thẻ in thêm dòng loại phía trên — đúng luật "loại khác tên gọi"). Form thêm **Ngày cấp** (`issuedOn` — trường đã có trong `BoatDocument` nhưng trước không có ô). Lưu khi SỬA giữ mọi trường không có trên form (`photos`…) — bản cũ dựng object mới làm rơi đường dẫn ảnh.
- Bảng `public.documents` (0001) có cột `kind` text KHÔNG check constraint và app CHƯA ghi bảng này (giấy tờ đi `user_docs` kind=documents) ⇒ thêm loại không cần migration.

### Mở form đúng loại giấy — `giayTuUrl(search)` (2026-10-26)
- Đọc `?giay=<loại>` trong URL ⇒ trả `DocumentKind` hợp lệ (so với `DOCUMENT_KINDS`), sai/thiếu ⇒ `null`. Tủ giấy tờ gọi lúc mở để bật form đúng loại (có rồi thì Sửa, chưa có thì Thêm chọn sẵn) rồi gỡ tham số khỏi URL. Link sinh từ khối hạn giấy dưới bài luật Sen Biển (`lib/kairos/han-giay.ts`, 14 §21f). Không đổi schema/RLS.

### Expiry status — `getExpiryStatus(doc, today)`
- ~~**`SOON_DAYS = 30`** — ngưỡng "sắp hết hạn"~~ → **`SOON_DAYS_DOCS = 30`** (bảng ngưỡng chung bên dưới, 2026-08-18)
- ~~Tính ngày theo **UTC** (`daysUntil`) để tránh lệch timezone~~ **Đính chính 2026-08-18** (audit N1): ngày UTC làm 00h–07h sáng VN "hôm nay" thành hôm qua (giấy hết hạn hôm nay hiện "Còn 1 ngày"); nay tính theo **giờ VN** (`Asia/Ho_Chi_Minh`) bằng **1 hàm `daysUntil` dùng chung** — **CHỐT 2026-08-18 (gói C)**: `src/lib/days.ts` (`daysUntil(isoDate, today)` · `todayIsoVN()` · `addDaysIso()` · `SOON_DAYS_DOCS` · `SOON_DAYS_SERVICE`; ngày VN **+07 cố định** qua `isoDateVN` của `day-labels.ts`, KHÔNG theo múi giờ máy — máy đặt sai giờ thì hạn giấy vẫn đúng lịch bà con nhìn; ngày hỏng → `NaN`, không giả vờ 0). 6 bản chép ở documents/crew/products/owned-assets/compliance/maintenance-reminders + urgent-strip ĐÃ gọi về đây; hook `src/lib/use-today.ts` `useTodayVN()` tính lại ngày khi `visibilitychange`/`focus` (app treo qua đêm không kẹt ngày cũ). Test `days.test.ts`
- Levels → màu UI (xem [03-design-system.md](03-design-system.md)):

| Level | Điều kiện | Màu | Label mẫu |
|---|---|---|---|
| `expired` | days < 0 | 🔴 đỏ | "Đã quá hạn N ngày" |
| `soon` | ~~0 ≤ days ≤ 30~~ **1 ≤ days ≤ SOON_DAYS** | 🟡 vàng | "Còn N ngày" |
| `expired` (KHÔNG level riêng — chốt 2026-08-18 theo code `getExpiryStatus`) | **days === 0 → ĐỎ** ("Hết hạn hôm nay" — chậm là bị phạt/không ra khơi được, xem 07 §12 màu = chữ; trước đây vàng) | 🔴 đỏ | "Hết hạn hôm nay" |
| `ok` | days > SOON_DAYS | 🟢 xanh (KHÔNG đeo băng — 07 §12) | "Còn N ngày" |
| `none` | không có `expiresOn` | — | "Không có hạn" |

**Bảng ngưỡng chung toàn app (2026-08-18, chủ dự án chốt theo audit `ops/audit-notify-2026-08-18.md`)** — thay cho 5 ngưỡng rời 30/30/30/14/7 chép ở từng module:

| Hằng | Giá trị | Áp cho | Ghi chú |
|---|---|---|---|
| `SOON_DAYS_DOCS` | **30** ngày | giấy tờ tàu · bảo hiểm · chứng chỉ thuyền viên · bảo hành đồ SDVICO | thay `SOON_DAYS` (documents.ts) + bản chép ở crew.ts/products.ts/owned-assets.ts |
| `SOON_DAYS_SERVICE` | **14** ngày | bảo dưỡng định kỳ + kỳ dịch vụ SDVICO | bảo dưỡng trước dùng 7 (báo muộn nhất dù cần đặt thợ) → nâng lên 14 |
| `daysUntil(dateISO, now)` | 1 hàm, **giờ VN** | mọi nơi tính "còn N ngày" (kể cả nợ, eCDT, badge tab) | **`src/lib/days.ts` (chốt 2026-08-18)**, test `days.test.ts`; cấm chép lại. Áp thật: `SOON_DAYS_DOCS` ← documents.ts · crew.ts (bảo hiểm/chứng chỉ) · products.ts (bảo hành); `SOON_DAYS_SERVICE` ← owned-assets.ts `getServiceDueStatus` · maintenance-reminders `getDueStatus`. `crewIssue` (crew.ts) thêm level **`neutral`** "Chưa ghi hạn bảo hiểm" + trường `days` (không BH = -1; neutral/ok = null); `requestStatusVN` (owned-assets.ts) chỉ còn `ok\|neutral` |
| `days === 0` | **ĐỎ** | mọi loại hạn | "hôm nay hết hạn" = đã chậm |
| nợ / việc chưa tới hạn | **neutral**, không băng màu | nợ SDVICO, kỳ dịch vụ còn xa | chỉ quá hạn mới đỏ, sắp tới hạn (≤ SOON_DAYS_SERVICE) mới vàng |
| mẫu (demo/sổ mẫu) | không sinh cảnh báo, không đếm badge | tủ/sổ/lịch mẫu | 07 §8 + §12 |

- `byUrgency(today)` — sort gấp nhất lên đầu (expired trước, rồi gần hạn nhất; không hạn xuống cuối)
- `giayTuUrl(search)` (2026-10-26) — đọc `?giay=<loại>` trên URL, trả `DocumentKind` hợp lệ hoặc `null`; tủ giấy tờ dùng để mở sẵn form đúng loại khi bấm từ khối hạn giấy dưới bài luật Sen Biển (14 §21f). Không đụng DB.
- Seed mẫu tủ giấy tờ **đã gỡ HẲN** (2026-07-29): `loadDocs()` trả rỗng khi chưa có data thật → màn "chưa có, bấm thêm". Hàm `demoDocuments` (từng seed rồi thành dead code) nay xoá khỏi `documents.ts`. Xem 02 §4.

### Camel ↔ snake mapping (khi nối Supabase)
TS dùng camelCase (`expiresOn`), DB dùng snake_case (`expires_on`) — khi wire vault lên Supabase phải map rõ ràng, không đổi shape của `BoatDocument`.

## 4. Demo mode storage

- localStorage key: **`forfish.documents.v1`** (versioned — đổi shape thì bump v2 + migrate/seed lại)
- Corrupt JSON / storage bị chặn → coi như RỖNG (không seed demo), không crash
- **`forfish.fab.v1`** (2026-09-07, `src/lib/float-pos.ts`): vị trí nút nổi bà con đã kéo — `{ [id]: { side: "left"|"right", dy: px, tucked: boolean } }`, id `sen-bien` / `gio-hang`. Của riêng máy (∈ `NEVER_BACKUP_PREFIXES`), hỏng/mất → nút về góc mặc định, KHÔNG báo lỗi (không phải sổ của bà con)

## 5. Việc sắp tới / Implementation status

| # | Item | Status |
|---|---|---|
| 1 | Schema boats + documents + RLS | ✅ Done (`0001_init.sql`) |
| 2 | Vault chạy demo mode (localStorage) | ✅ Done |
| 3 | Đăng nhập SĐT + mật khẩu (không email/OTP) | ✅ Done (2026-06-30): apply migration `0002+0003+0004` prod + Edge Function CRM `sdfish-password-in` + bulk provision 630 account (528 customer + 95 sub + 5 collab + 2 distributor) với mk khởi tạo `sd123456` + `must_change_password=true` |
| 3b | DB khách hàng riêng + webhook ingest | ✅ Done (2026-06-30): inbound + outbound 2 chiều verify end-to-end; còn lại = SDWork team dựng outbox + cron đối soát (Đợt 2) |
| 3c | Auth-scope localStorage (clear data KH khi user change/logout) | ✅ Done (2026-06-30, Đợt 1 vá leak; **vá thêm 2026-07-02**): `src/lib/auth-scope.ts` + hook `use-auth.ts`. Bug: clear xong nhưng state React đang mount vẫn cầm data cũ → save-effect ghi ngược (đăng xuất vẫn sửa được tàu của TK cũ). Vá: clear → đăng ký `pagehide` xoá LẦN CUỐI (chặn save-effect hồi sinh trong khe clear→reload) → `location.reload()` reset RAM. Idempotent, không loop. Xem 02 §4 |
| 3d | **Bịt nốt 3 lỗ rò chéo user** (audit 2026-07-29) | ✅ Done: (1) `USER_SCOPED_KEYS` thiếu `forfish.sdvico-boat.v1` (gán món→tàu) + `forfish.tier.premium.v1` (dấu premium) → user B thấy gán/quyền của A trên cùng máy → **thêm cả 2 vào wipe list**; (2) **service worker cache `/api/*` KHÔNG theo user** — endpoint riêng tư (`/api/me/*`, `/api/admin/*`, `/api/crew-reports/*`) dính chung khoá-URL → user B MẤT SÓNG nhận bản cache của A (tên/serial/mã đơn). Vá (bản đầu dùng hàm chặn-danh-sách-đen, nay đã thay): `sw.js` dùng ALLOWLIST `API_CACHE_ALLOW` + `isCacheableApiPath()` — /api ngoài danh sách (hồ sơ cá nhân, `/api/admin/*`, `/api/kairos/*`) để mạng lo, KHÔNG cache, KHÔNG cứu bằng bản trong kho; danh sách đồng bộ `src/lib/sw-cache-policy.ts` (test `sw-cache-policy.test.ts`), `SDFISH_API_V` bump v1→v2 (dọn cache riêng tư cũ khi activate), + message `forfish:purge-api-cache` do `auth-scope.purgeApiCache()` bắn khi đổi user/logout. Test: `auth-scope.test.ts` (15). Xem 02 §4 + [ops/external-services](ops/external-services.md) |
| 4 | ~~Chuyển vault localStorage → Supabase (boats/documents/products/maintenance/debts/trips/crew/buyers)~~ **ĐÃ THAY bằng `user_docs` (0050/0051, đồng bộ per-máy theo SĐT, gộp theo mục từ 2026-10-06) — KHÔNG dựng lại theo kế hoạch dưới đây (bảng `boats/documents` 0001 không dùng)** | 🔴 Đợt 2 (kế hoạch): wire vào `boats/documents` (schema đã có 0001) + tạo thêm bảng owner_id cho 7 vault còn lại. Multi-device sync BẮT BUỘC theo quyết user 2026-06-30. Sau hoàn tất, retire `USER_SCOPED_KEYS` ở `auth-scope.ts` |
| 4b | **Lịch sử Ra khơi để predict** (yêu cầu Long 2026-07-02) | 🟡 Code xong 2026-07-02, **CHỜ apply migration [`0005_sea_history.sql`](../../supabase/migrations/0005_sea_history.sql) + set `CRON_SECRET` trên Vercel**. 3 bảng: `sea_daily` (10 cảng × 10 ngày dự báo/lần thu, kèm `lead_days` để so dự báo↔thực tế), `fish_forecast_daily` (hotspot PFZ s≥60), `storm_events`. Cron Vercel 23:30 UTC (=6:30 VN) gọi `/api/collect/sea-daily` (Bearer `CRON_SECRET`, ghi service-role; RLS bật không policy — client không đọc/ghi). Lib thuần `src/lib/sea-history.ts` (test) + builder chung `src/lib/fish-forecast-server.ts` |
| 5 | Nhắc hạn push / Zalo | 🟡 **Push XONG phía mã 2026-10-06** (Zalo: chưa): cron `/api/cron/notify-docs` 07:00 VN đọc `user_docs` (documents + crew + boats) → luật `lib/doc-reminders.ts` (mốc 30/25/20/15/10 rồi hằng ngày 5→0 — đổi 2026-10-20, trước là 30/15/7/3/1/0; quá hạn nhắc lại mỗi 30 ngày ×3; 1 tin/chủ tàu/lượt) → `notifyAccount` ghi `push_messages` (`target='account'`, `target_phone`, `sent_by='system:docs'`, `url=/tau?tab=giay-to&nhac=<ref>.<hạn>.<mốc>~…` (toàn giấy thuyền viên ⇒ `/nguoi?nhac=…`, 2026-10-20) — URL LÀ SỔ KHỬ TRÙNG; hộp thư `/api/me/messages` đọc thêm `sent_by` để chỉ trả tin `system:docs` mới nhất (lọc khi trả, KHÔNG xoá dòng — sổ khử trùng vẫn đủ), cửa sổ 45 ngày, không migration) rồi đẩy Web Push `tag: giay-to`. Đo 2026-10-06: 6 chủ tàu có giấy tới mốc, 0 máy bật thông báo ⇒ thêm hàng "Bật chuông nhắc hạn" ở tab Giấy tờ. Chạy thật cần prod có `CRON_SECRET` + secret `PROD_CRON_SECRET` (ops/deploy-windows-iis) |

## 5b. Auth OTP riêng + webhook ingest (Đợt 1, 2026-06-16) — THAY mô hình §6

**Quyết định user (2026-06-16)**: SDFish thành **app khách hàng độc lập**, **tách SDWork** — KHÔNG đọc-live CRM lúc KH mở app. **Auth chỉ hướng TÀI KHOẢN: SĐT + MẬT KHẨU, KHÔNG email/OTP** (user quản cả 2 project). Mô hình §6 (gateway đọc-live) **chuyển tiếp**, retire sau.

- **Đăng nhập**: SĐT + mật khẩu — `supabase.auth.signInWithPassword({ email: {SĐT}@sdvico.local, password })` trên project SDFish (`/login`). Lần đầu (`user_metadata.must_change_password=true` do webhook đặt) → ép `/doi-mat-khau`. KHÔNG OTP, KHÔNG email confirm, KHÔNG SSO-CRM. SĐT helper thuần `src/lib/phone.ts` (tách `auth-form.tsx`). **1 TÀI KHOẢN = 1 MÁY (2026-07-29)**: đăng nhập xong gọi `signOut({ scope: 'others' })` thu hồi phiên mọi máy khác — máy cũ rớt ở lần `getUser()`/refresh kế (middleware + `use-auth` đều gọi getUser nên rớt ngay lần mở app sau); lỗi thu hồi KHÔNG chặn đăng nhập.
- **Đổi mật khẩu** (`/doi-mat-khau`, sửa 2026-07-29): 2 ngả — ÉP lần đầu (không hỏi mật khẩu hiện tại, khách vừa gõ ở /login) + TỰ NGUYỆN từ sheet Tài khoản (xác thực lại mật khẩu hiện tại bằng `signInWithPassword` rồi mới cho đổi). Đổi = `updateUser({ password, data: { must_change_password: false } })` — tắt cờ NGAY TRÊN user_metadata (fix bug cũ ghi vào bảng `profiles` KHÔNG TỒN TẠI → cờ không bao giờ tắt, bị ép đổi mãi). Đổi xong cũng `signOut({ scope: 'others' })`.
- **Provision tài khoản**: webhook customer event kèm `password` → `admin.auth.admin.createUser({email, password, email_confirm:true, user_metadata:{must_change_password:true}})`. ĐÃ tồn tại → bỏ qua (KHÔNG ghi đè mk KH đã đổi). Mật khẩu KHÔNG lưu bảng `customers` (chỉ set trên auth user, Supabase hash). **Reset mật khẩu (LÀM 2026-07-29; đổi 2026-10-06 — ADR 0008)**: `/api/admin/accounts` PATCH `action='reset-password'` — admin, hoặc quản lý có **cờ riêng `resetPassword`** trong bảng quyền (`canResetPassword`, jsonb `staff_accounts.permissions` 0056 + gương `customers.staff_permissions` — KHÔNG cột mới) và chỉ trên khách của mình (`managerTargetCheck`). `admin.auth.admin.updateUserById` về: **KHÁCH ⇒ `sd123456`** (`DEFAULT_CUSTOMER_PASSWORD`, `lib/temp-password.ts` — một nguồn với webhook + ô điền sẵn khi tạo khách) · **NHÂN SỰ ⇒ ngẫu nhiên** "sd"+6 số (`randomTempPassword`; tra vai hỏng ⇒ coi là nhân sự) + bật lại `must_change_password` (giữ nguyên metadata khác — updateUserById ghi đè cả object nên phải spread) + **thu hồi mọi chuỗi đang sống** (`revokeTokensOfPhone`). Mật khẩu mặc định lúc webhook provision vẫn là chính sách ADR 0007, không đổi ở đây.
- **Nạp dữ liệu**: `POST /api/sdwork/webhook` — verify **HMAC SHA-256** (header `x-sdwork-signature`, env `SDWORK_WEBHOOK_SECRET`) trên raw body → upsert customers/devices/supplies bằng admin client. Map thuần `src/lib/sdwork-webhook.ts` (`toCustomerRow/toDeviceRow/toSupplyRow`, chuẩn hoá SĐT, idempotent `sdwork_ref`) — có test. Response trả `results[]` per-event (`ref`, `ok`, `code?`, `provisioned?`) + `applied` count → SDWork đối soát chính xác từng event, không câm khi 1 hàng lỗi. **Khách TRÙNG SĐT (2026-10-31)**: `customers` có 2 khoá duy nhất (`phone`, `sdwork_ref`); upsert theo `sdwork_ref` đụng `customers_phone_key` (hàng tạo tay ở /quan-tri, chưa có mã) ⇒ route tra hàng theo SĐT: mã NULL ⇒ **nhận về** (UPDATE gắn `sdwork_ref`, điều kiện `sdwork_ref IS NULL`, tên rỗng từ CRM không xoá tên cũ) rồi provision như thường; đã mang mã KHÁC ⇒ `phone_conflict` (không ghi đè, xử tay). Luật thuần `isPhoneTaken`/`planPhoneClaim` có test. Trước bản vá: 865 event dead `upsert_failed`.
- **Đọc**: `/api/me/sdvico` đọc **bảng SDFish** (RLS theo `current_phone()`) thay `fetchOwnedAssets` gọi CRM. `use-sdvico-assets` giữ interface (4 nấc + `OwnedAssets`).
- **Hợp đồng webhook**: [sdwork-sso-contract.md](../integration/sdwork-sso-contract.md) (event types/payload/HMAC + password).
- **Ngoài Đợt 1**: apply migration prod 🔴 · bật webhook + cron đối soát · ~~reset mật khẩu~~ (ĐÃ LÀM 2026-07-29 qua `/quan-tri`, xem bullet Provision) · retire §6 (gateway live-read + `/api/auth/sso`).
- **DELTA SDVICO (giữ khi sync base Long-Forfun 2026-07-30)** — base bỏ đồng bộ mật khẩu OUTBOUND (SDFish→SDWork) theo hướng SDWork-master 1 chiều; sdvico GIỮ các nhánh sau vì cần cho vận hành + App Store:
  - **Quên mật khẩu tự phục vụ** (`/quen-mat-khau`, `src/lib/password-reset.ts`): KH gửi SĐT + họ tên → trình duyệt KH gọi thẳng Edge Function `request-password-reset` của CRM (gọi từ CLIENT để chống dội IP), nhân viên duyệt → CRM bắn `resetPassword:true` về webhook inbound. KHÔNG xây mới, tái dùng quy trình CRM.
  - **Tách câu lỗi đăng nhập** (`/api/auth/exists` + `src/lib/login-error.ts`): TÁI DÙNG RPC `auth_user_id_by_phone` (migration `0003_auth_password_sync.sql` GIỮ — webhook inbound + exists đều cần) trả boolean SĐT-đã-đăng-ký, chọn câu lỗi đúng.
  - **Lối thoát ép-đổi** (`/doi-mat-khau`): nút "Thoát ra, để đổi sau" (`signOut`→`/`) + hotline khi bị ép đổi (must_change) — KH khỏi kẹt cứng phải gỡ app (mất khách thật 02/07).
  - **Đã BỎ**: outbound `/api/sdwork/password-sync` + test + đồng bộ 2 chiều (theo base). Migration `0003` GIỮ nguyên (RPC còn dùng chỗ khác).
  - **Migration khi sync**: giữ nguyên `0001-0019` của origin (prod đã apply đúng số). 4 bảng MỚI của base đánh số nối tiếp: `0020_vms_zones`, `0021_sell_contacts`, `0022_app_config`, `0023_price_history` (base gốc đánh 0013-0016 — đổi để KHÔNG đụng số cũ prod). 🔴 4 migration này + `0024` CHƯA apply prod.
- **TRACE TIỀN + AUDIT (sdvico 2026-07-30, migration `0027_trace_and_audit.sql`, ba-spec [10](10-ba-spec-quan-tri-van-hanh.md) NV4/NV5/NV7)**: (a) `payments.traced_at` — đánh dấu đã BẮN mã CK sang SDWork (⚠️ cron bắn `/api/cron/trace-payments` CHƯA TỪNG CHẠY tới 2026-10-05: vercel.json gọi GET, route chỉ POST ⇒ 405; nay chạy mỗi giờ qua `.github/workflows/cron-prod.yml` — `traced_at` trống ở dữ liệu cũ là do đó, không phải lỗi bắn. Bảng `payments` lúc bật: 0 dòng); hàng chờ bắn = `reconciled_status='pending' AND traced_at IS NULL`; cron `/api/cron/trace-payments` (Bearer CRON_SECRET) bắn HMAC sang `SDWORK_TRACE_URL`, 2xx→set traced_at (NV4). ⚠️ Cadence: **Vercel Hobby chỉ 1 lần/ngày** (`vercel.json` `0 1 * * *` — Hobby chặn cron sub-daily); muốn hàng-giờ thì đẩy sang GitHub Actions hoặc systemd timer khi self-host (xem [ops/self-host-vps.md](ops/self-host-vps.md) §7). SDWork đối chiếu xong bắn webhook event `{entity:'payment', action:'reconciled', ref:code}` về `/api/sdwork/webhook` → set `reconciled_status='reconciled'` + `reconciled_at` (NV5). (b) bảng `admin_audit` (actor, action, target, detail, created_at) — mọi mutation /api/admin/accounts ghi 1 dòng qua writeAudit (grant/downgrade/reset/set_flag/record_payment/create/delete); xem qua GET `/api/admin/audit` (admin only) → tab "Nhật ký" (NV7). RLS bật, KHÔNG policy. 🔴 0027 CHƯA apply prod.
- **THU TIỀN bằng MÃ CK (sdvico 2026-07-30, migration `0026_payments.sql`, ba-spec [10](10-ba-spec-quan-tri-van-hanh.md) NV3)**: bảng `payments` (customer_phone, `code` = MÃ CK, agent_phone, `reconciled_status` pending|reconciled, created_at, reconciled_at) — **KHÔNG lưu số tiền** (R1/AC-4), tiền thật ở SDWork. Ghi qua PATCH `action='record_payment'` (staff; manager scoped R3). Hàng chờ trace = `reconciled_status='pending'` (NV4 bắn SDWork → NV5 webhook set 'reconciled'). RLS bật, KHÔNG policy (service-role). GET accounts đính trạng thái thu MỚI NHẤT mỗi khách, degrade nếu bảng chưa có. 🔴 0026 CHƯA apply prod.
- **CỜ CHĂM KHÁCH (sdvico 2026-07-30, migration `0025_customer_care_flags.sql`, ba-spec [10](10-ba-spec-quan-tri-van-hanh.md) NV2)**: 2 cột boolean trên `customers` — `premium_used` (khách đã thực sự dùng premium chưa) + `contacted` (đã liên hệ chưa), mặc định false, STAFF đặt tay qua `/api/admin/accounts` PATCH `action='set_flag'` (flag + value). Đại lý (manager) CHỈ đổi được khách MÌNH cấp (R3, chặn server bằng premium_grants.granted_by). GET accounts SELECT kèm 2 cờ, DEGRADE êm nếu cột chưa có. 🔴 0025 CHƯA apply prod.
- **TÀI KHOẢN ADMIN CHUNG (sdvico 2026-07-30, migration `0024_shared_admin.sql`)**: thay gán SĐT CÁ NHÂN vào env `ADMIN_PHONES`, lập 1 admin dùng chung `customers.role='admin'` (SĐT `0900000001`, tên "Quản trị SDVICO") = full-admin ngang env (`admin-auth.ts` requireStaff). Env `ADMIN_PHONES` giữ **1 SĐT bootstrap break-glass**. Tạo login: admin hiện tại vào `/quan-tri` → "Tạo tài khoản" → loại **"Admin — toàn quyền"** (POST `/api/admin/accounts` mở role='admin', gated requireAdmin) → provision auth + mật khẩu tạm do admin đặt (bắt đổi lần đầu). Migration chỉ seed hồ sơ; auth user provision qua form. ⚠️ **RBAC 2026-10-02: lộ trình GỠ admin chung** — mất dấu "ai làm gì" trong nhật ký + `allow_multi` ⇒ sống trên không giới hạn máy; mật khẩu khởi tạo từng nằm trong comment migration (đã gỡ, nhưng còn trong lịch sử git ⇒ phải đổi). Thay bằng admin CÓ TÊN từng người, xem [ops/rbac-runbook.md](ops/rbac-runbook.md) bước 4.

## 5d. Đơn SDVICO từ CRM — `crm_orders` (2026-11-02, migration [`0078_crm_orders.sql`](../../supabase/migrations/0078_crm_orders.sql), [ADR 0018](../adr/0018-crm-order-mirror.md))

- **Mục đích**: khách lẻ mua qua CRM/SDWork đăng nhập SDFish bằng SĐT ⇒ thấy đơn + trạng thái ở `/cho/don` (CHỈ XEM). CRM là nguồn thật; bảng này là bản sao.
- **Bảng `crm_orders`**: `sdwork_ref` UNIQUE (= id đơn CRM, khoá idempotent) · `code` (DH…/DS…) · `customer_phone` CHECK `^0[0-9]{9}$` · `customer_name` · `status` CHECK `dang_chuan_bi|dang_giao|da_giao|da_huy` (CRM chuẩn hoá trước khi gửi) · `ordered_at` · `items` jsonb `[{name, qty, unit, unitPriceVnd, lineTotalVnd}]` · `services` jsonb · `subtotal_vnd/discount_vnd/vat_vnd/service_vnd/total_vnd` bigint · `carrier_name` · `tracking_number` · `external_ref` (đơn sinh từ yêu cầu mua SDFish: `sdfish_order:SDF-…`) · `snapshot_at` (giờ CRM chụp) · `created_at/updated_at`. Index `(customer_phone, ordered_at desc)`. KHÔNG có dữ liệu nội bộ CRM (giá vốn, hoa hồng, NV bán, ghi chú, công nợ).
- **RLS**: bật, revoke anon/authenticated, **KHÔNG policy** (khuôn `market_orders` 0060) — chỉ route service-role đọc theo SĐT phiên (`lib/sdvico-orders/store.ts`).
- **Ghi**: webhook `entity:"order"` ⇒ `toCrmOrderRow` (`lib/sdwork-webhook.ts`, chỉ giữ field đã khai, làm tròn VND) ⇒ RPC **`crm_order_upsert(p jsonb)`** (security definer, chỉ `service_role`): `ON CONFLICT (sdwork_ref) DO UPDATE … WHERE snapshot_at <= excluded.snapshot_at` — bản cũ retry tới sau trả `stale` (webhook vẫn `ok`, code `stale_snapshot`). `action:"delete"` (KH của đơn không còn là khách lẻ / đơn bị xoá cứng ở CRM, kèm `data.snapshotAt`) ⇒ RPC **`crm_order_delete(p_ref, p_snapshot_at)`**: ghi/nâng **bia mộ** `crm_order_tombstones(sdwork_ref, snapshot_at)` (RLS bật, không policy) rồi xoá hàng không mới hơn; `crm_order_upsert` bỏ mọi bản `snapshot_at` ≤ bia mộ ⇒ upsert cũ retry tới sau KHÔNG làm đơn sống lại (bản mới hơn — đơn quay lại khách lẻ — vẫn qua). `toCrmOrderRow` cắt chuỗi theo CHECK (mã 40, tên 200, vận chuyển/mã vận đơn/external_ref 120) để không `upsert_failed` mãi. Tài khoản đăng nhập do event `customer` sẵn có lo (CRM bắn kèm lần đầu đơn sang) — event `order` KHÔNG tạo tài khoản.
- **Rollback**: [`docs/integration/go-live/rollback-0078_crm_orders.sql`](../integration/go-live/rollback-0078_crm_orders.sql) (tắt cờ CRM `order_sync` TRƯỚC). **Chưa apply prod** — thứ tự: 0078 + deploy web ⇒ CRM migration `20261102120000` ⇒ bật cờ CRM.

## 6. Đồng bộ đồ mua từ SDWork CRM (Trục 3, 2026-06-10) — ⚠️ ĐANG CHUYỂN TIẾP, thay bởi §5b

Bối cảnh (user chốt): khách mua hàng → SDWork tạo account + đơn + dịch vụ,
nhưng KHÔNG cấp quyền vào SDWork (app nội bộ/CTV/đại lý); tài khoản đó tách
thành tài khoản ForFish. ForFish hiển thị + nhắc: bảo hành, kỳ dịch vụ, cước.

### Chuỗi nối (đọc-chỉ, qua adapter)
```
SĐT đăng nhập ForFish (SSO) → profiles.sdwork_customer_ref (= auth.users.id phía CRM)
  → CRM accounts.owner_user_id (fallback: login_phone/phone = SĐT)  [type customer|sub]
  → warranty_cards (serial, activated_at, expires_at, products.name, orders.code)
  → service_instances (service_name, service_type, status, next_due_date)
  → orders có debt_amount > 0 (code, debt_amount, debt_due_date) — thu cước/công nợ
```

### Cách thực thi (2026-06-10, đổi sang GATEWAY — không cần phát key nào)
- **Edge Function `forfish-gateway` chạy BÊN TRONG project CRM** (`exueouggmbjtjvsvpfya`, deploy qua Supabase MCP): dùng service key TỰ CẤP của CRM (không key bí mật nào rời Supabase). Chỉ phục vụ 3 action: `assets` (lọc nghiêm theo account đúng khách) / `catalog` / `request`. Cổng vào: API key công khai của CRM (anon JWT cũ hoặc `sb_publishable_` mới — `verify_jwt` không nhận định dạng publishable nên function tự kiểm trong code).
- **ForFish gọi gateway** bằng `SDWORK_SUPABASE_URL` + `SDWORK_SUPABASE_ANON_KEY` — đúng 2 env SSO đang dùng sẵn (local + Vercel), KHÔNG cần thêm env nào.
- **Types trung lập vendor**: `src/lib/owned-assets.ts` (`OwnedProduct/OwnedService/OwedPayment` + `getServiceDueStatus`, SOON = 14 ngày) — UI chỉ biết types này.
- **Adapter**: `src/lib/sdwork-assets.ts` (server-only) — `callGateway` + mapping thuần `mapCrmAssets` test ở `__tests__/owned-assets.test.ts`. Đổi vendor = viết adapter mới, types không đổi.
- **Route**: `GET /api/me/sdvico` — account CRM SUY TỪ SESSION ForFish, không bao giờ nhận id từ client; chưa đăng nhập/chưa cấu hình/CRM lỗi → `ok:false`, UI quay về dữ liệu local. Cache `private, max-age=600`.
- ⚠️ Hardening sau: key công khai của CRM nằm trong tay người dùng nội bộ SDWork (vốn đã thấy dữ liệu khách trong app của họ) — muốn chặt hơn thì cấp secret riêng cho ForFish trong code gateway + env mới.
- 🔴 KHÔNG migration nào trên CRM — gateway chỉ ĐỌC các bảng sẵn có, TRỪ một bảng GHI duy nhất bên dưới. Đã kiểm chứng end-to-end 2026-06-10 (catalog 203 món / 9 dòng; request ghi vào `consultation_requests` rồi xóa bản test).

### Kênh CSKH 2 chiều (user chốt 2026-06-10: "ForFish = kênh CSKH của SDVICO")
- **Catalog gợi ý**: `GET /api/sdvico/catalog` đọc CRM `products` (is_active) → nhóm theo TIỀN TỐ SKU (`src/lib/sdvico-catalog.ts`: LN_=lọc nước, GS_=giám sát, WF_=wifi, LD_=lọc dầu, NHOT_/NG_=nhớt, SONPV_=sơn, AQ_/TL_=điện-lái; DV_=dịch vụ → loại khỏi gợi ý). Cache 1h trong process. CRM không có cột phân loại — SKU prefix là phân loại nội bộ (xác minh trên dữ liệu thật).
- **Yêu cầu từ khách → SDWork**: `POST /api/sdvico/request` → gateway INSERT `consultation_requests` (full_name, phone, message dạng `[ForFish] Chủ đề · sản phẩm — chi tiết`, `source_page='forfish'`, status mặc định `'pending'`). Bảng có policy "Service role manages consultation requests" — đúng cổng nhận yêu cầu kênh ngoài. Dùng được CẢ KHI CHƯA đăng nhập (khách mới = mối bán hàng) — bắt buộc SĐT VN hợp lệ; đăng nhập rồi thì route tự điền tên/SĐT từ profiles.
- **Catalog hiển thị theo DÒNG sản phẩm, KHÔNG phô model** (user chốt): 9 dòng — máy lọc nước biển (LN_) · xử lý dầu (LD_) · dầu nhớt (NHOT_) · phụ gia diesel (NG_) · giám sát hành trình (GS_) · điện thoại vệ tinh (GS_VSS_, ưu tiên tiền tố dài) · internet vệ tinh (WF_) · sơn tàu (SONPV_) · điện & lái (AQ_/TL_). Model cụ thể là chuyện lúc mua, nhân viên tư vấn.
- **Tab Sản phẩm TÁCH ĐÔI: "Đang dùng" / "Khuyến nghị" (user chốt 2026-06-11)**: Khuyến nghị = **thẻ kiểu app shop, CHỈ sản phẩm CHÍNH** — `data/sdvico-showcase.ts` (6 sản phẩm trích nguyên văn showcase sdvico.vn: SEA-40, S-Tracking, Thuraya MNB-01, XT-Pro, SF-50, Nano Graphene; ảnh tải về `public/sdvico/` vì asset site là hash Vite đổi theo build). Thẻ: ảnh 4:3 + chip loại + tên + mô tả + tính năng + nút Hỏi mua + **Gọi ngay hotline 0939 243 222** (lấy từ sdvico.vn). KHÔNG đổ phụ kiện/vật tư lẻ — CRM catalog chỉ còn để NHẬN DIỆN dòng đang dùng (thẻ gắn nhãn xanh, xếp lên đầu, nút thành "Mua thêm / vật tư thay"). Form Gọi SDVICO có thêm dòng "Gấp? Gọi ngay 0939 243 222". Test ép showcase nối đúng dòng SKU + đủ ảnh/mô tả.
- **Tối ưu "tức thì" (2026-06-10)**: (1) đăng nhập rồi thì form Gọi SDVICO TỰ ĐIỀN tên + SĐT (gửi = 1 chạm); (2) gateway `assets` trả thêm 5 `consultation_requests` gần nhất theo SĐT (`source_page='forfish'`) → tab Dịch vụ có mục "Yêu cầu đã gửi" kèm trạng thái lời thường (`requestStatusVN`: pending→"Đã nhận — chờ gọi lại", done/resolved→"Đã xử lý xong"); (3) nhắc SDVICO (nợ/cước, bảo hành sắp hết, kỳ dịch vụ) GỘP vào "Việc cần làm ngay" ở trang chủ (`urgent-strip.tsx`, tag SDVICO); (4) mỗi món đã mua có chip "Gọi bảo hành món này" (kèm serial); (5) chưa đăng nhập → nút "Đăng nhập để thấy đồ/dịch vụ của mình" trong cả 2 tab.
- ⚠️ Phía SDWork phải có người THEO DÕI `consultation_requests` (hiện 0 hàng — xác nhận với team SDWork quy trình xử lý + đổi status), kẻo yêu cầu của bà con rơi vào im lặng.

## 7. Phân quyền tính năng — public vs CẦN ĐĂNG NHẬP (user chốt 2026-06-10)

App yêu cầu đăng nhập (tài khoản đồng bộ SDWork) cho tính năng GIÁ TRỊ CAO; phần còn lại public để bà con dùng ngay không rào cản:

| Tính năng | Quyền | Chặn ở đâu |
|---|---|---|
| **Dự báo cá (PFZ)** | 🟢 teaser → 🔒 chi tiết | **TEASER (user chốt 2026-06-11)**: `GET /api/fish-forecast` CÔNG KHAI (bỏ gate 401) → lớp cá heatmap + điểm nóng HIỆN cho mọi người (thu hút). Xem CHI TIẾT một điểm (loài gì, khả năng bao nhiêu, đi hướng nào) mới khoá: `fishing-map-view` dùng `useAuthUser`+`isSupabaseConfigured` → `fishLocked` (đã cấu hình Supabase + chưa login) → thẻ cá trong sheet thành nút "Đăng nhập để xem chi tiết dự báo cá" (→/login) thay readout. Heatmap/chọn loài vẫn xem được (làm mồi). Demo mode = mở hết. (Lý do đổi từ "khoá API" cũ: lớp cá biến mất hẳn → không hấp dẫn được khách đăng ký) |
| **Tin mua/bán (đăng + xem tin thật)** | 🟢 xem tin thật công khai → 🔒 đăng/sửa/xoá | **ĐỔI 2026-08-16 (thẩm định P0)**: chốt quyền chuyển từ RLS `auth.uid()` sang route server `/api/market-listings` (+`[id]`) dùng `identityFromRequest` + service-role, chủ tin = `owner_phone` (0043). Lý do: sau 0026 app không giữ phiên nên `auth.uid()` luôn NULL ⇒ RLS chặn cả chiều ĐỌC ⇒ mọi người dùng thật chỉ thấy TIN MẪU và không ai đăng được. Nay: GET mở cho cả khách (`anonymous: true`, server lọc "đang mở + tin của mình"); POST/PATCH/DELETE đòi SĐT, và điều kiện chủ tin nằm TRONG câu lệnh ghi (`.eq("owner_phone", …).select()`) |
| **Đồ SDVICO của tôi / dịch vụ / cước / yêu cầu đã gửi** | 🔒 (bản chất) | `/api/me/sdvico` suy khách từ session — chưa đăng nhập tự ok:false. **Nguồn thiết bị (2026-06-11)**: gateway `forfish-gateway` v4 (CRM) gộp `warranty_cards` (theo account) + `vw_imported_serials` (import Excel, chủ yếu giám sát hành trình Viettel) khớp theo **SĐT chuẩn hoá 9 số cuối** (0xxx/84xxx/+84 — trước lệch định dạng nên thiết bị import không hiện) qua RPC CRM-side `forfish_imported_serials` (xem [contract](../contracts/sdwork-assets.contract.md)). Khách chỉ có serial import (chưa account) VẪN thấy đồ. Thiết bị import không có hạn BH → hiện tên+serial, không bịa bảo hành |
| Bản đồ + gió sóng + bão + hải đồ + cá MÙA VỤ · giá cá · bán ở đâu · catalog SDVICO + nút Gọi SDVICO · sổ tự ghi (giấy tờ/bảo dưỡng/thuyền viên) · mức phạt | 🌐 public | không chặn — gửi yêu cầu khi chưa đăng nhập = mối bán hàng mới |
| **Cảnh báo thuyền viên chéo** (tra/báo cáo theo CCCD) | 🔒 **premium** | chốt server `lib/premium-guard.ts` (route /api/crew-reports*) + khoá UI ở `crew-list.tsx`. **ĐỔI 2026-08-16 (thẩm định P0)**: guard nay nhận `req` và dựng trên `identityFromRequest` + `premiumDenied` (device token) thay cho `auth.getUser()` — bản cũ trả 401 cho MỌI người dùng thật vì app đã bỏ phiên từ 0026; client `crew-list.tsx` gửi chuỗi cứng qua `authedFetch` |

Quy ước: tính năng khóa MỚI → bọc `components/login-gate.tsx` (UI — sdvico VẪN DÙNG: `/nguoi` + tab Dịch vụ/Sản phẩm của `/tau`; base đã xoá file này 2026-08-18 nhưng ở sdvico nó còn importer nên GIỮ) hoặc `PremiumLock`/`premium-gate.tsx` tại điểm chạm khi cổng là hạng premium (07 §12 tầng 5; `PremiumLock` tự trả `null` khi `navigator.onLine === false`) **và** kiểm session ở API (thật). Hook trạng thái: `lib/use-auth.ts`. Khi Supabase chưa cấu hình (demo mode dev) thì KHÔNG khóa — giữ invariant demo mode §"Demo mode". Ngưỡng phân loại: data CÁ NHÂN (gắn tàu/user) → khóa; tham khảo dùng chung (giá, thời tiết, mức phạt) → public.

## 7c. Dữ liệu bản đồ tĩnh mới — Trục 1 (2026-09-03)

> Ba lớp hải đồ nối vào bản đồ Ra khơi. **Không phải bảng DB** — asset tĩnh `public/data/` phát qua CDN Vercel, giải mã bằng lib thuần có test. Đều **MIỄN PHÍ mọi tài khoản** (không phải premium — bản đồ cho không, xem [01-product.md](01-product.md) §Trục 1). Kiến trúc render: [02-architecture.md](02-architecture.md) 2026-09-03; màu: [03-design-system.md](03-design-system.md).

| File | Nguồn (giấy phép) | Số lượng | Lib · schema tóm tắt |
|---|---|---|---|
| `chat-day.v1.json` + `chat-day.v1.pmtiles` (8,1 MB) | **Allen Coral Atlas** layer `benthic_data_verbose` (**CC BY 4.0**) | 362.743 điểm | `chat-day.ts` → `ChatDayFile {v, nguon, nhan, layNgay, cellDeg, codes[], points[][]}`; điểm giải mã `ChatDayDiem {lon, lat, ma, tyLeThuanPhanTram, soManhGop}`, `ma ∈ S·R·Co·G·Sg·Ma·khac` (Cát/Đá/San hô/Vụn/Cỏ biển/Thảm rong/chưa rõ). Vẽ bằng **vector tile pmtiles** (360K điểm nhồi geojson giết máy yếu). GIỚI HẠN: ACA chỉ khảo sát vùng rạn/đảo nước trong ⇒ không phủ đáy bùn cửa sông |
| `dia-danh-ngam.v1.json` | **Thông tư 33/2024/TT-BTNMT Mục III** (văn bản nhà nước — `vn-official`, không share-alike, không chặn thương mại) | 184 tên | `dia-danh-ngam.ts` → `DiaDanhNgamFile {v, vanBan, nguon, banHanh, datum, loai[], ...}`; thực thể `DiaDanhNgam {lon, lat, ten, loai}`, `loai` = núi/đồi/hố/thung lũng/sống/hẻm/guyot/vách ngầm. Toạ độ VN-2000 |
| `khu-tru-bao.v1.json` | **QĐ 582/QĐ-TTg (2024)** (văn bản nhà nước) — toạ độ đối chiếu từ đèn biển + phao luồng, **KHÔNG geocode tự do** | 51 khu (20 vùng + 31 tỉnh, 21/28 tỉnh) | `khu-tru-bao.ts` → `KhuTruBaoFile {v, nguon, nhan, layNgay, giayPhep{...}, tinChiDan?}`; khu `KhuTruBao {lon, lat, ten, tinh, cap('vung'\|'tinh'), sucChua, coTauM, ghiChu, tin('cao'\|'vua'), nguonToaDo}`. ⚠️ **5 khu dùng toạ độ OSM (ODbL — share-alike lên CSDL)**, cờ ở `nguonToaDo` — thay nguồn trước khi vào gói bán |

Cả ba vào service worker để đọc được khi mất sóng (`chat-day.v1.pmtiles` → `PMTILES_ARCHIVES`; hai file JSON → `CRITICAL_SHELL`; xem [02-architecture.md](02-architecture.md) + [ops/qa-offline-acceptance.md](ops/qa-offline-acceptance.md)).

## 7d. Dữ liệu bản đồ tĩnh — lấp lỗ hải đồ vòng 2 (2026-09-03)

> Ba lớp hải đồ CŨ (đã có từ trước §7c) nay đầy thêm dữ liệu thật. Cùng luật §7c: asset tĩnh `public/data/`, giải mã bằng lib thuần có test, đều **MIỄN PHÍ mọi tài khoản** (bản đồ cho không — [01-product.md](01-product.md) §Trục 1). Render/hiển thị: [02-architecture.md](02-architecture.md) + [07-design-spec.md](07-design-spec.md).

| File | Nguồn (giấy phép) | Số lượng | Ghi chú số + hiển thị |
|---|---|---|---|
| `coral-reefs.v1.json` | **Thông tư 33/2024/TT-BTNMT** Mục A.I + B + C (văn bản nhà nước — `vn-official`, không share-alike, không chặn thương mại) | **13 → 1.374 tên** (→ **1.372** sau khử trùng 2026-09-03b, xem bảng dưới) | ven-bờ 1.225 (28 tỉnh) · Trường Sa 106 · Hoàng Sa 28 · thềm lục địa/DK1 15. Theo loại: bãi 650 · đá 390 · cồn 293 · rạn/san hô 41. Cộng 184 địa danh ngầm (§7c) ⇒ **~1.558 tên Việt** trên hải đồ. Đã sửa toạ độ "Bãi Vũng Mây" về TT33 `[7,897/111,607]` (bản cũ lệch ~103 km). Cổng `src/lib/reefs.ts` chặn CJK + tên nước ngoài. **HIỂN THỊ tách đôi** (1.374 chấm không collision nổi): ngoài khơi Trường Sa/Hoàng Sa/DK1 (`group != ven-bo`, 149 điểm — mốc chủ quyền, hiện MỌI zoom) qua `reef-dot`/`reef-label`; ven bờ (`group == ven-bo`, 1.225 điểm) qua `reef-dot-venbo`/`reef-label-venbo` **minzoom 8** để zoom cả nước không thành dải chấm dày (xem 02) |
| `tide-stations.v1.json` (5,6 KB → **57 KB**, 2026-09-04) | **4 trạm ĐO** (UHSLC gauge) + **79 trạm MÔ HÌNH EOT20** (DGFI-TUM, SEANOE **CC-BY 4.0** — thương mại được): 7 trạm VÙNG cửa lạch lớn + **72 trạm TẠI CẢNG** (`hang: "cang"`, toạ độ từ `FISHING_PORTS` đang hoạt động) | **4 → 11 → 83 trạm** | 4 trạm đo giữ nguyên; trạm mô hình gắn cờ `nguon=model` (RMSE trung vị 0,128 m so 4 trạm đo), phủ **bờ Tây (Rạch Giá/Cà Mau — vịnh Thái Lan)** và từ 2026-09-04 **mọi cảng cá cách trạm ≤ 40 km** (cổng `tides.test`; 5 cảng danh mục ghi sai toạ độ / cảng sông không sinh: Bến Đầm-Côn Đảo, Cồn Cỏ, Mỏ Ó, Lạch Bạng, Mỹ Tho). Nguồn EOT20 đọc từ bản gộp TMD `EOT20_ocean.nc` 287 MB (ngoài repo, `extract-eot20.py` hỗ trợ cả bản gộp lẫn từng-file). `tides.ts` thêm `isModelStation`/`tideModelCaveat`/`tideTrustText(distanceKm, station?)`; `fishing-map-view` gọi `tideTrustText(gan.distanceKm, gan.station)` để trạm mô hình **luôn hiện "ước tính"** kể cả khi gần (honesty — không đội bản đo lên bản mô hình) **2026-11-04: 106 trạm** — thêm 2 trạm `nguon:"bang"` (`hoang-sa`, `song-tu-tay`): bảng triều Transas rút gọn M2·S2·K1·O1 quy đổi bằng `consTuBangTrieu` (`lib/tides.ts`: pha giờ khu vực → UTC, K1 −90° / O1 +90°, suy P1 = K1/3, K2 = 0,27·S2), `rmseM: null`, `isModelStation` = true. Số gốc ghim trong `scripts/generate-tides.mjs` §6c; `--add-model-only` dựng lại cả nhóm này. |
| `vn-sea-lanes.v1.json` | tuyến/luồng OSM đã bỏ tên (ODbL) + trục luồng `vn-aids`/Cục Hàng hải + **cáp: TeleGeography (CC BY-NC-SA) chỉ MANH MỐI điểm cập bờ, KHÔNG copy hình tuyến** + tin công khai VN, verify ≥2 nguồn | **+10 tuyến cáp** | 10 cáp quang biển VN (`kind=cap`, `src=cap-vn`): AAG/AAE-1/Liên Á/VTS/MViSTA (Vũng Tàu) · APG/ALC/SMW-3 (Đà Nẵng) · ADC/SJC2 (Quy Nhơn). Vẽ dạng **điểm cập bờ** (LineString độ-dài-0) qua lớp `sea-lane-cap` sẵn có, cùng công tắc "Tuyến tàu, luồng lạch". Cổng chủ quyền: 0 tên Hán/CJK. Chi tiết render: [02-architecture.md](02-architecture.md) entry (18). **Đổi 2026-09-03b**: điểm cập bờ nay là **Point `kind=cap-bo`** riêng (bỏ mẹo LineString-0), xem bảng dưới |

Cả ba đều đã nằm trong service worker từ trước (CRITICAL_SHELL) nên số mới đọc được khi mất sóng mà không đụng danh sách cache.

**Sinh lại có chủ ý 2026-09-03b — tái thiết kế "Hải đồ chi tiết"** (theo [research/danh-gia-hai-do-2026-09.md](../research/danh-gia-hai-do-2026-09.md) §A.4–A.5; ba file, không thêm nguồn, không đụng cache):

| File | Đổi gì | Số sau |
|---|---|---|
| `vn-sea-lanes.v1.json` | `generate-sea-lanes.mjs` **tách `pipeline_submarine` → `kind: "ong"`** (trước gộp chung `cap` — cáp quang đứt là bồi thường, ống khí thủng là cháy nổ, không được một kiểu); **điểm cáp cập bờ → Point `kind: "cap-bo"`**; thêm property phụ **`loai`** (đọc từ tag OSM `substance`/`category`, KHÔNG copy name — chỉ cho `cap`/`ong`/`cap-bo`/`vungcam`: cáp `quang` 27 · `dien` 40 · `chua-ro` 11; ống `khi` 7 · `xa-thai` 12 · `nhien-lieu` 3 · `dau` 1 · `nuoc` 1 · `chua-ro` 1; vùng cấm `cam-neo` 8 (gồm 7 vòng 500 m quanh giàn) · `cam-vao` 6 · `cam-danh-bat` 1; cập bờ `quang` 10) và **`tram`** (chỉ `cap-bo`: tên trạm cập bờ Vũng Tàu/Đà Nẵng/Quy Nhơn). Mọi kind cũ giữ nguyên | **348** feature: `cap` 78 · `ong` 25 · `cap-bo` 10 · `vungcam` 15 · `giankhoan` 41 · `luong` 66 · `phanluong` 108 · `tuyen` 5. ⚠️ **Nói thật**: 25 `ong` đều ở Hồng Kông/Quảng Đông — OSM KHÔNG map ống dầu khí VN (Bạch Hổ–Nam Côn Sơn); cần nguồn PVN sau, bản đồ vùng đó vẫn TRẮNG |
| `coral-reefs.v1.json` | **Khử 31 cặp trùng** với `vn-islands` (khớp tên + khoảng cách <2,5 km, cả ca khác tên lõi "Đá Tây" ↔ "Bãi đá Tây"): quy ước **ngầm (`da`/`bai`) chỉ ở reefs; đảo/hòn/cồn cát NỔI chỉ ở islands** — trước cùng một Đá Lớn có hai chấm hai màu. `type` nay được LỚP ĐỌC (icon theo loại, xem 02 entry (19)) | **1.372**: ven bờ 1.225 · Trường Sa 106 · Hoàng Sa **26** (28 → 26) · DK1 15; theo loại bãi 650 · đá 390 · cồn **291** · rạn 41. Cổng `reefs.ts` giữ nguyên + 2 test mới trong `reefs.test.ts`: giao tên islands∩reefs = 0, và không đá/bãi ngầm nào còn cạnh bản sao khác tên |
| `vn-islands.v1.json` | Bỏ các điểm ngầm đã có bên reefs; **giữ** cồn cát nổi (4) và hòn/đá NỔI (1) vì lên được | **103 → 72**: `dao` 60 · `quan-dao` 7 · `con` 4 · `da` 1 |

Schema không đổi (`islands.ts`/`reefs.ts` đọc như cũ); chỉ thêm property tuỳ chọn `loai`/`tram` ở sea-lanes. Cả ba vẫn trong CRITICAL_SHELL, không bump.

## 7e. Lưới độ sâu tĩnh — 6 lớp, 4 bit/ô (Đợt 0 tuyến/dẫn đường, sinh lại 2026-09-04)

> `public/data/depth-grid.v1.bin` (**8,53 MB**, cùng đường dẫn — SW `addAll` + `cache:"reload"` ghi đè, KHÔNG bump vỏ). Sinh bởi `scripts/generate-depth-grid.mjs` (ngày chốt nguồn ghim trong file script), giải mã `src/lib/depth-grid.ts` (`DEPTH_META` không đổi: 15″ ≈ 450 m, 4.441 × 3.841 ô, gốc 5°B/102°Đ + nửa bước). Đọc O(1) `depthClassAt`; cỡ file lệch (kể cả bản 2 bit cũ 4,26 MB) → `decodeDepthGrid` ném → `depthChecked=false`. MIỄN PHÍ mọi tài khoản.

| Lớp | Nghĩa | Nguồn quyết định | Luật tuyến (`route-plan.ts`) |
|---|---|---|---|
| 0 | ĐẤT LIỀN | tâm ô TRONG đa giác `vn-coast.v1.json` (526 Polygon, scanline theo hàng) **HOẶC** cả ETOPO lẫn GEBCO cùng z > 0 | chặn ngoài vòng nới quanh hai đầu (5 km, tự giãn tới 12 km cho cảng sâu trong sông); trong vòng → cờ `hasNearLandLeg` + phạt 40 km nước/km đất (2026-10-16) |
| 1 | mặt nạ rạn/bãi cạn/đá ngầm/xác tàu (OSM `reef-shapes`, nở 1–1,5 km + lấp lòng hồ) | như 2026-08-29, "chỉ hạ không nâng" | chặn ngoài 12 km; trong → `hasVeryShallowLeg` |
| 2 | nước rất cạn, z ∈ (−2, 0] | min(ETOPO, GEBCO); một nguồn nói đất, nguồn kia nói nước → lớp này | như lớp 1 |
| 3 | nước cạn, z ∈ (−4, −2] | min hai nguồn | trong 12 km: như lớp 1; **ngoài 12 km: chỉ đi khi `boat.draftM` đã khai và `requiredDepthM = mớn + 0,5 + ½·min(Hs,3) ≤ 2,0 m`** → cờ `hasDraftShallowLeg`; chưa khai mớn → chặn |
| 4 | nước nông, z ∈ (−12, −4] | min hai nguồn | đi được, `hasShallowLeg` + phạt nhẹ |
| 5 | đủ sâu (z ≤ −12) + ô thiếu số liệu lẻ tẻ | | tự do |

`DEPTH_CLASS_LABEL` (câu đời thường 6 lớp) và `DEPTH_CLASS_MIN_M` (sàn mét: 2→0, 3→2, 4→4, 5→12, đất/mặt nạ → null) xuất từ `depth-grid.ts` để chỗ khác không đoán ngưỡng. `RoutePlan` thêm `hoursAt[]` (giờ cộng dồn tới từng waypoint — hậu kiểm triều/hiểm hoạ tại ETA), `nearPortOnly` (mọi mẫu lớp 0–3 đều trong bán kính nới hai đầu), `hasDraftShallowLeg`, và chỗ giữ `hazardChecked=false`/`hasHazardLeg`/`hasHazardNearPortLeg` (Đợt 2 nối). `mergeLegPlans` nối `hoursAt` cộng dồn, OR cờ, AND `depthChecked`/`hazardChecked`.

**Vì sao sinh lại** (briefing-03, 2026-09-04): bản 2 bit cũ định nghĩa "đất = z > −2 m" nên bãi bùn ven bờ ở mực nước trung bình thành đất — mẫu 0,1° có 257/19.865 ô NƯỚC theo đường bờ bị coi là đất; Rạch Giá không có tuyến nào ra khơi (null trong 2 ms). Đo thật khi sinh lại: 0→2 **74.904 ô** (nước <2 m từng bị gọi là đất), 0→1 24.017, cũ "rất cạn" tách thành 1 (101.930) và 3 (49.428); ngược lại 6.473 ô nước cũ → đất vì nằm TRONG đa giác bờ giản lược (cụm lớn nhất: phá Tam Giang, Huế — không vịnh sâu nào bị lấp). Phân bố: đất 5,66 M · mặt nạ 126 k (0,74 %) · <2 m 75 k · 2–4 m 49 k · 4–12 m 203 k · đủ sâu 10,94 M. Phát hiện thêm lúc sinh: điểm briefing 10,02°B/104,99°Đ có ETOPO −2 m nhưng GEBCO **+1 m** → luật "min" thuần vẫn cho ra đất; vì thế đất ngoài đa giác bờ đòi CẢ HAI nguồn z > 0 (một nguồn nói đất → lớp 2, vẫn chặn ngoài 12 km). Cổng test `depth-grid.test.ts`: cỡ 4 bit, 4 điểm briefing ≠ 0, dải ven bờ 102–110°Đ ô nước-theo-bờ mang lớp 0 ≤ 1,2 % (đo 0,79 %; phần dư là đảo vn-coast giản lược đã cắt + bờ Campuchia/Thái/Hải Nam — cổng 0,1 % của quyết định thiết kế không đạt được với vn-coast hiện tại), mặt nạ ≤ 2 %, 5 toạ độ sự cố 2026-08-29 + tâm 2.622 hình rạn không "đủ sâu".

## 7f. Độ sâu rạn xa bờ — Hoàng Sa / Trường Sa (2026-10-22)

> `public/data/reef-depth.v1.bin` (**0,66 MB**, ~0,5 MB qua Brotli; SDF2 khi phát ra như mọi file). **168 thực thể**, chỉ hai quần đảo của Việt Nam (bộ đóng gói bỏ Scarborough, Đông Sa, Luconia). Nguồn: HHU24SWDSCS (Hohai University, ESSD 2025, Zenodo 13852568) + SCSBathy10 (Zenodo 19148819, 2026-03-21), **CC BY 4.0**, độ sâu suy từ ảnh vệ tinh + laser ICESat-2, RMSE công bố 0,67–0,82 m, **datum mực nước trung bình**. Tên: theo danh mục Việt Nam, ghép bằng `scripts/dan-duong/ran-10m/ten-viet.mjs` + `quyet-dinh-ten.json` theo luật `LUAT-RA-SOAT-TEN.md` (không chắc ⇒ tên chung "… chưa định danh (cụm X)", toạ độ tên lệch chân hình ⇒ tên chung); không tên nước ngoài nào trong file (cổng `reef-depth.test.ts` chạy `scripts/audit-names.mjs` trên tên đã giải mã).
> Dựng: GPU `sinh-reef-depth.py` (lưới ~100 m, mỗi ô = độ sâu NÔNG NHẤT trong ô) → Mac `dong-goi-reef-depth.mjs` → file này. Ngày chốt nguồn ghim trong đầu file. Chỉ sinh lại khi nguồn đổi.

| Phần | Nội dung |
|---|---|
| Đầu | `"RDP1"` · u32 LE độ dài · JSON `{v:1, sinh, datum:"MSL", donVi, buocM:100, quyUoc, credit[], nguonChot, features[{ten, nhom, nguon, lat0, lon0, dLat, dLon, nLat, nLon, nongNhatM, trungViM, off, len}]}` |
| Thân | lưới từng thực thể nén RLE: byte 0–253 = 0,0–25,3 m · 254 = sâu hơn 25,3 m · 255 + varint n = n ô không số. Hàng i theo vĩ độ TĂNG |
| Đọc | `src/lib/reef-depth.ts`: `decodeReefDepth` (méo ⇒ ném) · `buildReefDepthIndex` (ô 0,05°) · `reefDepthAtM` (nông nhất mọi thực thể phủ điểm) · `nguongChanRanM` · `reefDepthInBBox` · `timRanChoThe` · `fetchReefDepth` (trần 30 s, hỏng xoá nhớ) |
| Luật dùng | **chỉ THÊM chặn**: ô có số nông hơn `nguongChanRanM` = nước tàu cần (mớn + 0,5 + ½·min(Hs,3) + lún đuôi; chưa khai mớn 4 m) + **1,0 m** sai số vệ tinh + **0,8 m** ròng xa bờ ⇒ chặn như lớp 1–2. Mặt nạ rạn cũ (lớp 1) KHÔNG bao giờ mở. Đo 2026-10-22: 99,93 % ô cạn dưới 2 m đã nằm trong mặt nạ cũ; phần thêm thật là cụm Song Tử |
| Offline | SW tier best-effort (cạnh `reef-shapes`); thiếu file ⇒ tuyến tính như cũ, `reefDepthChecked=false`, thẻ tuyến gọi tên "độ sâu rạn Hoàng Sa, Trường Sa" ở "chưa soi được" |

## 8. Cross-references

- Demo mode pattern: [02-architecture.md](02-architecture.md)
- Màu trạng thái: [03-design-system.md](03-design-system.md)
- Trục 4 trong bức tranh sản phẩm: [01-product.md](01-product.md)

---

**Last updated**: 2026-08-18
<!-- re-verified: 2026-07-28 — bảng `product_listings` (0010, 🔴 chưa apply prod) — danh mục sản phẩm/dịch vụ admin quản lý cho tab Sản phẩm /tau, đọc công khai (RLS visible=true), ghi chỉ qua /api/admin/products (requireStaff). Kế hoạch tiếp: product_inquiries riêng + push_subscriptions (Web Push) — chưa có migration. -->
<!-- re-verified: 2026-06-18 — 0002 supplies +unit; webhook route trả results[] per-event (ref/ok/code/provisioned) — khớp khảo sát SDWork -->
<!-- re-verified: 2026-06-16 — bảng customers/devices/supplies/support_requests (0002) + auth SĐT+mật khẩu (webhook provision, KHÔNG email/OTP) + webhook ingest (§5b); §6 gateway live-read chuyển tiếp -->

### Chuỗi cứng theo máy — migration [`0037_device_tokens.sql`](../../supabase/migrations/0037_device_tokens.sql) (2026-08-02) — ✅ ĐÃ APPLY prod (soi prod 2026-08-04)

Thay phiên Supabase làm danh tính của **app ngư dân** (`/quan-tri` giữ nguyên Supabase Auth — nhân viên ngồi ở bờ, sóng tốt, không có lý do kéo vào cùng rủi ro).

**Vì sao**: phiên Supabase = JWT ngắn hạn + refresh token tự xoay. Ngoài biển, một lượt xoay mà phản hồi không về là máy giữ token cũ; dùng lại quá `reuse interval` (10 giây) bị GoTrue coi là token bị lộ ⇒ **thu hồi cả phiên**. Bà con văng khỏi tài khoản mà không ai đăng nhập ở đâu. Đo trên prod trước khi sửa: 48/63 hàng `auth.refresh_tokens` đã revoked, mỗi phiên là chuỗi 5–12 token.

| Cột | Nghĩa |
|---|---|
| `token_hash` (PK) | SHA-256 hex của chuỗi thô. **KHÔNG lưu chuỗi thô** — bảng rò ra ngoài thì kẻ đọc được vẫn không đăng nhập thay bà con được |
| `customer_phone` | SĐT đã chuẩn hoá. Không có khoá ngoại (tài khoản có thể chưa về qua webhook) |
| `device_id` / `platform` | mã máy (0022) + loại máy, để `/quan-tri` tra cứu |
| `created_at` / `last_used_at` | `last_used_at` ghi THƯA (≥1 giờ/lượt) — ghi mỗi request là biến bảng chuỗi thành bảng log |
| `revoked_at` / `revoked_reason` | **NULL = đang hiệu lực**. `new_login` \| `user_signout` \| `admin` |

**RLS: bật, KHÔNG policy nào** ⇒ chỉ service key đụng được. Kèm `revoke all ... from anon, authenticated` làm lớp khoá thứ hai: Supabase cấp sẵn quyền bảng cho hai role đó khi tạo bảng trong `public`, nên nếu sau này ai lỡ tắt RLS thì bảng hở ngay. Máy khách không có đường đọc bảng chuỗi của bất kỳ ai, kể cả của chính mình.

**Luật 1 tài khoản 1 máy** nằm gọn ở một chỗ: `revokeTokensOfPhone(phone, 'new_login')` chạy **TRƯỚC** khi cấp chuỗi mới trong `POST /api/auth/token`. Đảo thứ tự là có khoảnh khắc hai chuỗi cùng hiệu lực; thu hồi hỏng thì **không cấp** chuỗi mới (503) chứ không đi tiếp.

⚠️ **MẤT RLS THÌ ROUTE PHẢI TỰ LỌC.** Trước đây `current_phone()` của Postgres chặn hộ kể cả khi route viết ẩu. Nay các route của app ngư dân dùng service key và tự lọc bằng ĐÚNG SĐT vừa xác thực từ chuỗi — không nhận SĐT từ body, query, hay bất cứ thứ gì máy khách nói ra. Cổng chung: [`src/lib/api-identity.ts`](../../src/lib/api-identity.ts).

⚠️ **OFFLINE**: bảng này không có đường nào chạy ngược về máy để tải/xoá/đổi dữ liệu. Máy bị thu hồi chỉ mất TÀI KHOẢN, giữ nguyên dự báo/bản đồ đã tải (chủ dự án chốt: *"máy nào tải rồi thì cứ dùng thôi"*).



### Dữ liệu tới ngày nào — TÁCH KHO BẢN CÀI / KHO WEB — migration [`0038_data_until_web.sql`](../../supabase/migrations/0038_data_until_web.sql) (2026-08-02) — ✅ ĐÃ APPLY prod (soi prod 2026-08-04)

**Lỗi đã sửa — /quan-tri đang mô tả NHẦM KHO.** Cột `data_until` (0025) được ghi từ MỌI nhịp. Trên iOS kho của bản Thêm-vào-Màn-hình-chính **tách riêng** với Safari, nên ca này có thật và hoàn toàn im lặng: bà con tải đủ trong bản cài (data_until = 17/08), mấy hôm sau mở app bằng Safari → nhịp web **ghi đè** bằng con số của kho Safari → bảng báo về cái kho sẽ KHÔNG ra khơi. Chiều ngược lại sai y hệt.

| Cột | Nghĩa |
|---|---|
| `customers.data_until` | kho **BẢN CÀI** — kho sẽ ra khơi. Giữ tên của 0036, nhưng từ 0038 **chỉ nhịp bản cài mới ghi** |
| `customers.data_until_web` | kho **WEB** |
| `customer_devices.data_until_web` | như trên, theo từng máy |

Android dùng chung kho nên hai cột trùng nhau — vô hại. iOS thì lệch, và chỗ lệch đó chính là thứ người trực tổng đài cần thấy.

**KHÔNG backfill**: giá trị `data_until` đang có là hỗn hợp hai kho, không tách ngược được. Để nguyên rồi nhịp sau ghi đúng.

**KHÔNG có cột `last_online_at`** — cố ý. "Lần cuối máy còn sóng" chính là `pwa_last_open_at` / `web_last_open_at`: nhịp chỉ gửi được khi có sóng. Thêm cột mới là chép lại dữ liệu đã có rồi phải giữ hai chỗ đồng bộ. Luật gộp chip ở [`src/lib/app-usage.ts`](../../src/lib/app-usage.ts) (`readinessChip`, thuần, có test).



### Một tài khoản một chuỗi sống — migration [`0039_device_tokens_one_live.sql`](../../supabase/migrations/0039_device_tokens_one_live.sql) (2026-08-02) — ✅ ĐÃ APPLY prod (soi prod 2026-08-04)

`POST /api/auth/token` thu hồi chuỗi cũ rồi cấp chuỗi mới bằng **hai truy vấn rời**. Hai lượt đăng nhập chạy sát nhau xen kẽ được:

```
A: revoke → B: revoke (no-op) → A: insert (sống) → B: insert (CŨNG sống)
```

⇒ hai máy cùng hiệu lực, tức luật "1 tài khoản 1 máy" thủng đúng ở ca nó sinh ra để chặn. Không hiếm: bà con bấm Đăng nhập hai lần vì mạng chậm.

Không vá bằng cách viết code cẩn thận hơn — đây là **ràng buộc**, phải nằm chỗ không ai lách được. `create unique index … on device_tokens (customer_phone) where revoked_at is null` thay index thường của 0037. Lượt insert thua cuộc ném `23505`; route thu hồi lại rồi cấp lại **đúng một lần** → người đăng nhập SAU thắng. Fail-closed: xấu nhất là một lượt đăng nhập phải bấm lại.

### ADMIN nhiều máy — migration [`0053_device_tokens_admin_multi.sql`](../../supabase/migrations/0053_device_tokens_admin_multi.sql) (2026-08-31) — ✅ **ĐÃ APPLY prod (2026-08-31, soi: cột `allow_multi` boolean có, index `where revoked_at is null and allow_multi=false`, 46 token sống giữ nguyên)**

Admin cần **app (điện thoại) + web /quan-tri cùng lúc** — luật "1 tài khoản 1 máy" (0039) đá phiên app khi admin đăng nhập web, phiền. Nới CHỈ cho admin; khách/đại lý giữ 1 máy (chống chia sẻ). Thêm cột `device_tokens.allow_multi boolean default false`; token admin cấp `allow_multi=true`. Index một-chuỗi-sống đổi thành `where revoked_at is null AND allow_multi = false` → hàng admin miễn ràng buộc (nhiều chuỗi sống), hàng khách/đại lý vẫn nhiều nhất một. Code `POST /api/auth/token`: admin (env `ADMIN_PHONES` HOẶC `customers.role='admin'`) → BỎ `revokeTokensOfPhone` + insert `allow_multi:true`.



### Máy bà con còn bao nhiêu chỗ — migration [`0040_device_storage.sql`](../../supabase/migrations/0040_device_storage.sql) (2026-08-02) — ✅ ĐÃ APPLY prod (soi prod 2026-08-04)

**Vì sao** (chủ dự án chốt): cả một ngày soát offline được xây trên con số *"localStorage 5 MB"* mà **không ai đo**. Đo thật trên Chromium: localStorage chạm trần **99,88 MB**, quota cả origin **1.425 MB** — sai hẳn về mức độ. Không thể quyết kiến trúc lưu trữ bằng phỏng đoán, mà cũng không đo được iOS từ máy dev.

⚠️ **BẢNG DƯỚI ĐÂY ĐÃ ĐÍNH CHÍNH 2026-08-02k** (tài liệu WebKit chủ dự án đưa). Bản đầu viết sai hai chỗ, và cả hai đều dẫn người sau đi nhầm đường: (a) IndexedDB **không có** hạn mức riêng "15–60% đĩa trống" — nó dùng **chung hạn ngạch origin**, tính theo **tổng dung lượng THIẾT BỊ**; (b) luật ITP 7 ngày **không** chỉ quét Cache API mà quét **mọi kho JavaScript ghi được**, kể cả IndexedDB và cả **đăng ký service worker** — nên dời sang IndexedDB **không** thoát được luật đó.

| Kho | Hạn mức trên iOS/WebKit | Rủi ro thật |
|---|---|---|
| localStorage | **~5 MB/origin** — hạn mức RIÊNG, nhỏ hơn hẳn hạn ngạch origin, không co giãn theo máy (UTF-16 ⇒ ~2,5 triệu ký tự là chạm) | **iOS 16: chạm hạn mức là XOÁ SẠCH localStorage** (WebKit #245479) ⇒ mất luôn chuỗi đăng nhập, dấu hạng, tủ giấy tờ |
| Cache Storage | chung hạn ngạch origin | bị chính `sw.js` (`reclaimRoom`, đổi tên kho lúc deploy) dọn |
| IndexedDB | chung hạn ngạch origin | như trên |
| **Hạn ngạch origin** | Safari/PWA màn hình chính: tối đa ~**60% tổng dung lượng thiết bị**/origin · tất cả origin cộng lại ~**80%** · WKWebView không phải trình duyệt mặc định: ~**15%** | mức TRẦN, không phải lời hứa |

**Miễn luật 7 ngày**: chỉ **PWA đã thêm vào màn hình chính** (domain chính). Đó là hàng rào duy nhất, và app đã làm (`components/install-prompt.tsx`).

⇒ Hệ quả cho mọi quyết định sau này: **dời dữ liệu giữa IndexedDB và Cache Storage KHÔNG làm origin nhẹ đi một byte nào** (cùng một túi), và **chép thêm bản "cho chắc" là ăn GẤP ĐÔI hạn ngạch** — đẩy origin tới gần vòng thu hồi LRU hơn, tức bản dự phòng đi gây ra đúng cái nó định phòng. Bản dự phòng THẬT phải nằm **ngoài** origin: tệp bà con tự xuất ra máy.

| Cột (trên cả `customers` và `customer_devices`) | Nghĩa |
|---|---|
| `storage_quota_mb` | `navigator.storage.estimate().quota` — TRẦN kho của cả origin. NULL = trình duyệt cũ không có Storage API |
| `storage_used_mb` | `.usage` — app đang chiếm bao nhiêu. Tiến sát quota = sắp không lưu thêm được ⇒ đáng gọi nhắc dọn bớt ảnh/video **trước khi ra khơi** |

Nhịp 30 phút chở hai số này lên; `/quan-tri` hiện `kho X/Y MB`. Sau một ngày là có số THẬT của cả đội tàu, **tách theo nền** (`device_platform`, 0022) — lúc đó mới quyết được có phải dời `forfish.fc.*` sang IndexedDB không.

⚠️ **KHÔNG đo bằng cách ghi thử.** Cách duy nhất biết trần chính xác là ghi tới lúc ném — trên máy bà con thì đó là đổ vài chục MB rác vào kho và có cửa đẩy chính dữ liệu đi biển ra. `estimate()` là số trình duyệt tự khai, không ghi một byte.

⚠️ Client khai sai chỉ hỏng thống kê của chính máy đó, KHÔNG mở được quyền gì — nhưng vẫn ép qua `normalizeStorageMb` (thuần, có test): một chuỗi lạ / số âm / `Infinity` xuống thẳng cột `integer` là **cả lệnh UPDATE hỏng**, mất luôn mấy mốc thời gian đang chạy tốt (đúng khuôn lỗi cột 0022 đã dính).

### Đã lưu ở đâu · đủ chỗ không · chắc chạy offline chưa — migration [`0041_storage_breakdown.sql`](../../supabase/migrations/0041_storage_breakdown.sql) (2026-08-02) — ✅ ĐÃ APPLY prod (soi prod 2026-08-04) (6 cột `customers` + 6 cột `customer_devices`, `storage_persisted` kiểu `boolean`)

**Vì sao** (chủ dự án chốt): *"heartbeat và web quản trị cần có các info này để nắm rõ đã lưu ở đâu, lưu bản dữ liệu tới ngày nào, dung lượng storage đủ không, có đảm bảo chạy tốt 100% offline chưa."*

0029 chở về **một con số tổng**. Số đó không trả lời được câu đang cần, vì theo bảng đã đính chính ở trên các kho **không bình đẳng**: localStorage có trần riêng ~5 MB (và iOS 16 chạm trần là xoá sạch nó), còn IndexedDB/Cache dùng chung hạn ngạch origin. Gộp lại là mất đúng thông tin để biết **kho nào sắp chật**.

| Câu hỏi | Cột trả lời |
|---|---|
| ① đã lưu ở đâu | `storage_backend` (`'idb'` = đã dời xong · `'ls'` = còn kẹt thùng 5 MB ⇒ **đáng gọi điện**) + `storage_ls_mb` / `storage_idb_mb` / `storage_cache_mb` |
| ② dữ liệu tới ngày nào | `data_until` (bản cài) / `data_until_web` — đã có từ 0036/0038 |
| ③ dung lượng đủ không | `storage_available_mb` (`quota − usage`); gần 0 = sắp không giữ nổi gói đi biển |
| ④ chắc chạy offline chưa | `offline_ready_at` (đã có) + `storage_persisted` |

`storage_persisted` = `navigator.storage.persisted()` — **hàng rào duy nhất** chống vòng thu hồi LRU khi máy đầy. App vẫn gọi `persist()` lúc mở app nhưng trước đây **vứt kết quả**, nên không ai biết máy bà con có được cấp hay không. Tổ hợp đáng lo nhất: `storage_available_mb` nhỏ **và** `storage_persisted = false`.

⚠️ `storage_cache_mb` là **ƯỚC LƯỢNG** (`tổng − ls − idb`), gộp cả mã service worker và phụ trội trình duyệt — chỉ dùng SO ĐỘ LỚN. Đo thật phải tải lại từng ô bản đồ: vài chục MB đọc đĩa mỗi nhịp, đắt hơn giá trị nó mang lại. Hai cột kia thì chính xác.

⚠️ Cột có thể CHƯA tồn tại (chủ dự án tự apply) ⇒ `/api/admin/accounts` thử **bốn nấc** select rộng → hẹp (0031 tách RIÊNG một nấc: máy đã apply 0030 mà chưa apply 0031 không được mất sáu chip tách kho đang chạy tốt); `/api/me/heartbeat` giữ nguyên khuôn "hỏng thì ghi lại bộ cũ". Một chip phụ không được làm mất trắng danh sách 700+ khách.


### Đã HỎI xin bộ nhớ bền chưa, và bị từ chối hay được gật — migration [`0042_storage_persist_asked.sql`](../../supabase/migrations/0042_storage_persist_asked.sql) (2026-08-03) — ✅ **ĐÃ APPLY prod (soi prod 2026-08-04)** (1 cột `customers` + 1 cột `customer_devices`, kiểu `boolean`)

**Vì sao** (chủ dự án hỏi 2026-08-03: *"đã có bản cài thì có bị từ chối không?"*): `storage_persisted` một mình **gộp hai ca cần hai cách xử lý khác hẳn nhau**.

| Tổ hợp | Nghĩa | Việc phải làm |
|---|---|---|
| `persisted=false` · `persist_asked=null` | app **chưa hỏi lại lần nào** | lỗi của app — sửa được (đã sửa: `ensurePersistentStorage`) |
| `persisted=false` · `persist_asked=false` | đã hỏi, **trình duyệt TỪ CHỐI** | giới hạn nền tảng — gọi điện nhắc bà con cũng vô ích; việc làm được là nhắc **dọn bớt chỗ** |
| `persisted=true` | được cấp | không phải làm gì |

**Ca thật dẫn tới cột này**: khách `0123456154` (iOS, **đã cài** ra màn hình chính, dữ liệu đủ tới 18/08, còn trống 39 GB) vẫn báo `storage_persisted = false` — mà /quan-tri thì hô "⚠️ chưa được cấp bộ nhớ bền", bắt nhân viên gọi điện nhắc một việc không tồn tại. Luật hiển thị mới ở `persistNote` (`lib/app-usage.ts`, có test): **chỉ nói khi CÒN LÀM ĐƯỢC GÌ** — tức chưa được cấp **và** máy sắp hết chỗ (`< 2000 MB`); bản cài vốn đã được miễn vòng xoá 7 ngày của ITP, thứ `persist()` cứu thêm chỉ là vòng thu hồi LRU khi máy đầy.

⚠️ App chạy được **trước khi apply**: cả hai đường ghi (`customers` và `customer_devices` trong `/api/me/heartbeat`) đều có nhánh lùi bỏ cột lạ, và `/api/admin/accounts` có nấc select riêng cho cột này.

### Danh mục ĐẶT HÀNG ĐƯỢC — migration [`0045_catalog_orderable.sql`](../../supabase/migrations/0045_catalog_orderable.sql) (2026-08-11, đánh lại số 2026-08-19) — ✅ **ĐÃ APPLY prod (soi 2026-09-07: cột có, dữ liệu thật)**

| Thay đổi | Nghĩa |
|---|---|
| MỞ RỘNG `product_listings` (0010) | Nâng khu "Cửa hàng" tab Sản phẩm `/tau` từ "hỏi mua/gọi lại" thành **CHỢ ĐẶT HÀNG THẬT** (1 nhà cung cấp — MVP; chủ tàu chọn số lượng → đặt → NCC giao). Thêm cột: `group` (check `dien_tu`\|`co_dien`\|`nhu_yeu_pham`, **nullable** — dòng cũ chưa gán nhóm vẫn hiện, gom "Khác") · `price_vnd int` (GIÁ SỐ để tính tổng; NULL = chưa niêm yết → không đặt được, giữ luồng hỏi mua) · `unit text` (đơn vị bán, bắt buộc khi orderable) · `orderable boolean default false` (có nút "Thêm vào giỏ"). **DEFAULT false ⇒ mọi dòng cũ GIỮ NGUYÊN hành vi** (backward-safe) |
| RLS | **KHÔNG đổi** — vẫn đọc công khai `visible=true`, ghi service-role qua `/api/admin/products` (`requirePermission("san-pham", …)`). Cột mới lộ ra client qua `fetchProductListings()`; admin nhập ở `/quan-tri` tab "Sản phẩm" (nhóm/giá/đơn vị/cho-đặt) |

- ⚠️ **CHƯA APPLY prod SDVICO** — dòng `20260811045204 0032_catalog_orderable` là prod BASE. Seed giá số gợi ý lấy từ `src/data/supplies.ts` (nhập tay qua /quan-tri).

### Đơn đặt hàng — migration [`0046_catalog_orders.sql`](../../supabase/migrations/0046_catalog_orders.sql) (2026-08-11, đánh lại số 2026-08-19) — ✅ **ĐÃ APPLY prod (soi 2026-09-07: cột có, dữ liệu thật)**

| Thay đổi | Nghĩa |
|---|---|
| bảng `catalog_orders` | Đơn chủ tàu đặt từ Cửa hàng. Cột: `customer_phone` (chủ tàu, từ device token — KHÔNG `auth.uid`, xem 0026/0028) · `boat_name`/`boat_ref` (gắn tàu, tuỳ chọn) · `items jsonb` (**SNAPSHOT** dòng hàng `[{listingId,title,unit,priceVnd,qty,lineTotalVnd}]` — giá đóng băng lúc đặt) · `total_vnd int` (**server tính lại** từ `product_listings`, không tin client) · `delivery_location`/`contact_name`/`contact_phone`/`note` · `status` (`moi`→`da_nhan`→`dang_giao`→`da_giao`, hoặc `da_huy` — một chiều, xem `canTransition` trong `lib/catalog-orders.ts`) · `handled_by`/`handled_at`/`dealer_note` |
| RLS | **KHÔNG có policy nào** (giống `product_inquiries`/`premium_grants`). Chủ tàu đọc/đặt/huỷ qua `/api/me/orders*` (`identityFromRequest` tự lọc theo SĐT device token); NCC/admin xem & chuyển trạng thái qua `/api/admin/orders*` (`requirePermission("don-hang", …)` — migration 0017 + tab mới). Đổi trạng thái → báo chủ tàu (push + hộp thư, `lib/account-notify.ts`, best-effort) |

- ⚠️ **CHƯA APPLY prod SDVICO** (dòng `20260811045214 0033_catalog_orders` là prod BASE). **Không thanh toán trong app** (chốt tiền lúc giao/COD — nhất quán "KHÔNG có luồng thanh toán"). **Online-only** (SW bỏ qua POST, không outbox; client báo trung thực khi mất mạng). Quyền mới `don-hang` thêm vào `lib/staff-permissions.ts` (6 tab manager).

### Chống ĐƠN TRÙNG — migration [`0047_catalog_orders_client_ref.sql`](../../supabase/migrations/0047_catalog_orders_client_ref.sql) (2026-08-16, đánh lại số 2026-08-19) — ✅ **ĐÃ APPLY prod (soi 2026-09-07: cột client_ref có)**

| Thay đổi | Nghĩa |
|---|---|
| cột `client_ref text` (nullable) | **Dấu vân tay của NỘI DUNG đơn** do máy khách tính (`orderClientRef` trong `lib/catalog-orders.ts`: món+số lượng đã sắp thứ tự, tàu, điểm giao, người nhận, SĐT, ghi chú → FNV-1a 64-bit). Gửi kèm `POST /api/me/orders`. ⚠️ **KHÔNG gắn với giỏ** (sửa 2026-08-18): bản đầu giữ mã trong `forfish.cart.v1` và giữ nguyên khi bà con sửa giỏ ⇒ đặt hụt → sửa giỏ → bấm lại bị nuốt thành "trùng", trả đơn cũ, **mất thay đổi**. Mã theo nội dung thì cùng nội dung = cùng mã, khác nội dung = đơn mới — không cần 409 "cùng mã khác thân" |
| unique index có điều kiện | `(customer_phone, client_ref) where client_ref is not null` — trọng tài ở tầng DB, không phải "đọc trước rồi ghi" (hai cú bấm sát nhau chạy trên hai instance vẫn lọt) |

- ✅ **ĐÃ APPLY prod 2026-08-18** (`catalog_orders_client_ref_uniq` = `UNIQUE (customer_phone, client_ref) WHERE client_ref IS NOT NULL`, đã đọc lại `pg_indexes` để xác nhận). **VÌ SAO** (thẩm định 2026-08-16, P1): ở cảng 3G, POST ghi được đơn nhưng phản hồi rơi mất ⇒ client hết 20 giây báo "chưa gửi được" ⇒ bà con bấm lại ⇒ **hai đơn thật, giao hai lần, thu tiền hai lần**. Nay trùng `client_ref` ⇒ route đọc lại đơn cũ và trả `ok:true, duplicate:true`. Trước khi apply: route bắt lỗi `42703/PGRST204` và ghi lại KHÔNG kèm cột ⇒ hành vi y hệt hôm nay (vẫn có thể trùng), không ai bị chặn đặt hàng.


### CHỢ VẬT TƯ TÀU CÁ — sàn đa người bán — migration [`0060_marketplace.sql`](../../supabase/migrations/0060_marketplace.sql) (2026-09-06, ADR 0013) — ✅ **ĐÃ APPLY prod 2026-09-07** (soi: 4 bảng + 7 hàm + bucket `market-media` có; RLS bật 0 policy đúng khuôn 0037; seed shop SDVICO 1 dòng)

> **ĐÁNH LẠI SỐ khi gộp vào main (2026-10-18)**: ba migration của sàn được apply lên prod ngày 2026-09-07 dưới tên **0054_marketplace / 0055_merge_catalog_into_market / 0056_market_functions_search_path** (nhánh feat/san-thuong-mai). Trong lúc đó `main` đã dùng 0054–0058 cho việc khác (0054 seed danh mục 2026, 0055 prune, 0056 RBAC, 0057, 0058) và nhánh Sen Biển giữ 0059 ⇒ khi gộp, file của sàn đổi tên thành **0060 / 0061 / 0062**, NỘI DUNG GIỮ NGUYÊN (đã chạy rồi, đừng chạy lại). Soi prod 2026-10-18 bằng service-role: `shops` 1 · `shop_products` 13 · `market_orders` 1 · `product_reviews` 0 — bảng có đủ, không cần apply gì thêm.
> **Lệch dữ liệu cần chủ dự án chốt**: danh mục cũ `product_listings` được làm lại 2026-09-24 (0054 seed 2026 của main — 11 sản phẩm SDVICO: Vifish.24, AdNANO, ắc quy Globe, PV Paint, Ngư dân 247…) SAU ngày gộp 07/09, nên gian hàng SDVICO trên chợ vẫn là 13 món bản cũ. 0061 viết kiểu "chưa có thì thêm" (chạy lại an toàn) nhưng khớp theo mã nguồn, có thể sinh món trùng tên gần giống.

Thiết kế đầy đủ: [12-kien-truc-san-thuong-mai.md §2](12-kien-truc-san-thuong-mai.md) (SQL nguyên văn) · nghiệp vụ: [11-ba-spec-san-thuong-mai.md](11-ba-spec-san-thuong-mai.md). Bốn bảng MỚI, **không đụng** `product_listings` (0016/0045) và `catalog_orders` (0046/0047) — luồng NCC nội bộ cũ giữ nguyên. SDVICO chỉ là MỘT shop seed sẵn, core không `if (shop === SDVICO)`.

| Thay đổi | Nghĩa |
|---|---|
| bảng `shops` | Gian hàng. `owner_phone` **unique** (1 SĐT = 1 shop; seed SDVICO = sentinel `sdvico:chua-gan`, admin gán chủ thật ở `/quan-tri`) · `name` 3–60 + `slug` **unique** (`toSlug(name)` — tên duy nhất không phân biệt hoa/thường/dấu) · `phone` (SĐT liên hệ hiện cho người mua) · `province`/`address`/`description`/`logo_url` · `bank_name`/`bank_account`/`bank_holder` (đủ 3 = nhận chuyển khoản) · `shipping_flat_vnd` 0..5.000.000 + `free_ship_from_vnd` · `status` (`cho_duyet`→`hoat_dong`/`tu_choi`, `tam_khoa`) + `status_note` (lý do admin ghi) · `paused` (seller tự "tạm nghỉ": món vẫn hiện, KHÔNG đặt được) · `rating_avg`/`rating_count` (cache từ đánh giá không ẩn) · `approved_at` (lần đầu duyệt) |
| bảng `shop_products` | Sản phẩm của shop. `title` 3–120 · `category` check 9 id gạch-ngang (`may-dong-co` … `khac`, cùng nguồn `lib/market/categories.ts`) · `price_vnd` 1.000..1 tỷ + `compare_at_vnd` (giá gạch, > price) · `unit` · `stock` 0..99.999 (**kho CHUNG theo sản phẩm**, biến thể chỉ nhãn + giá — nợ có trần) · `images` jsonb string[] ≤ 6 · `variants` jsonb `[{label, priceVnd|null}]` · `status` (`dang_ban`/`an`/`het_hang` — `het_hang` tự đặt khi kho về 0 trong RPC, tự về `dang_ban` khi hoàn kho; TS `normalizeProductStatus`) · `admin_hidden` + `admin_hidden_reason` (admin gỡ ≠ seller ẩn, seller không tự bật lại) · `deleted_at` (xoá mềm — không hiện với ai, đơn cũ giữ snapshot, ảnh giữ) · `sold_count` (**cộng lúc ĐẶT** trong RPC, trừ khi hoàn kho) · `search_text` (**ứng dụng ghi** = `foldVn(title + description)`, không generated column, để file-store lẫn supabase-store tìm cùng cách bằng `ilike`; index trigram `pg_trgm` tuỳ chọn). Index một phần theo `deleted_at is null`/`admin_hidden = false` |
| bảng `market_orders` | Đơn — **MỖI ĐƠN = MỘT SHOP**. `code` unique `SD`+yymmdd+4 ký tự (`lib/market/order-code.ts`) · `buyer_phone` (từ chuỗi cứng `identityFromRequest` — KHÔNG BAO GIỜ từ body) · `items` jsonb **SNAPSHOT** `[{productId, variantLabel, title, unit, priceVnd, qty, lineTotalVnd, image}]` ≤ 20 dòng · `subtotal_vnd`/`shipping_vnd`/`total_vnd` (**server tính** — `lib/market/pricing.ts`) · `payment_method` (`cod`/`chuyen_khoan`) + `payment_status` 3 nấc (`chua_thanh_toan`/`bao_da_chuyen`/`da_thanh_toan` — lời khai hai bên, app không xác minh tiền) · `bank_snapshot` (STK shop LÚC ĐẶT, chỉ CK — check: COD hoặc có snapshot) · `needs_refund` (huỷ đơn CK sau `bao_da_chuyen`/`da_thanh_toan` ⇒ true; app chỉ NHẮC) · `status` 6 nấc một chiều (`cho_xac_nhan`→`da_xac_nhan`→`dang_giao`→`da_giao`→`hoan_thanh`; `da_huy` — bảng `TRANSITIONS` trong `lib/market/order-state.ts`) · `cancel_by`/`cancel_reason` · `address` jsonb snapshot `{name, phone, province, detail, isPort}` · `buyer_note`/`seller_note`/`carrier`/`tracking_code` · `timeline` jsonb `[{status, at, by, note}]` (`by` ∈ buyer/seller/system/`admin:<sđt>`) · `client_ref` (vân tay nội dung `marketOrderClientRef`) + **unique `(buyer_phone, client_ref) where client_ref is not null`** · `restocked_at` (hoàn kho idempotent) · `delivered_at`/`completed_at` (tự hoàn thành LƯỜI khi đọc sau 7 ngày — `settleOverdue`, không cron) |
| bảng `product_reviews` | Đánh giá sau `hoan_thanh`: `order_id`/`product_id`/`shop_id`/`buyer_phone` (che 4 số giữa khi trả ra) · `rating` 1..5 · `comment` ≤ 500 · `hidden` (admin ẩn — không hiện, không tính điểm) · **unique `(order_id, product_id)`** (1 lần/món/đơn) |
| trigger `market_set_updated_at()` | Hàm chung `updated_at = now()` gắn cho 4 bảng (repo chưa có trigger updated_at nào trước đó) |
| RLS | **RLS bật, KHÔNG policy, `revoke all … from anon, authenticated`** (khuôn 0037). Mọi đọc/ghi qua route service-role: `/api/cho/*` (`identityFromRequest`, khách lạ xem được), `/api/ban-hang/*` (`requireShopOwner` — `lib/market/shop-auth.ts`), `/api/admin/cho/*` (`requireAdmin`). Client KHÔNG chạm bảng. Mọi hàm RPC cũng `revoke … from public, anon, authenticated` |
| RPC `market_place_order(…)` | **ĐẶT ĐƠN NGUYÊN TỬ một shop/một giao dịch**: (0) cùng `(buyer, client_ref)` ⇒ trả đơn cũ, không trừ kho lần 2 · (1) shop `hoat_dong` (không ⇒ `shop_not_active`), `paused` ⇒ `shop_paused` · (2) từng dòng `UPDATE … SET stock = stock − qty, sold_count = sold_count + qty WHERE … AND stock >= qty AND giá khớp (gốc HOẶC biến thể)` — 0 hàng ⇒ `line_unavailable:<productId>` (P0001) ⇒ rollback cả đơn shop đó · (3) ghi đơn `cho_xac_nhan` + timeline `by=buyer`. Adapter: `23505 market_orders_code_key` ⇒ sinh mã mới thử lại ≤ 3; `23505 market_orders_client_ref_uniq` ⇒ đọc lại, `duplicate:true` |
| RPC `market_restock_order(uuid)` | Hoàn kho SAU khi đơn sang `da_huy` — **idempotent qua `restocked_at`** (gọi lại trả 0). Cộng `stock`, trừ `sold_count` (≥ 0), `het_hang` → `dang_ban`. Không kiểm trần (nợ có trần, `// nợ:` trong file-store) |
| RPC `market_add_review(…)` / `market_recount_rating(…)` / `market_set_review_hidden(…)` | Ghi đánh giá + tính lại `rating_avg`/`rating_count` sản phẩm **và** shop từ đánh giá `hidden = false` trong một giao dịch; `market_recount_rating` là **nguồn DUY NHẤT** của phép tính điểm (file-store chép cùng luật ở `lib/market/rating.ts`). Lỗi `review_not_allowed` (P0001), `23505` = đã đánh giá |
| bucket `market-media` | Storage **public** (ảnh sản phẩm là nội dung sàn, ai xem cũng như nhau — khác `user-docs` private của giấy tờ), `file_size_limit` 512000 (client nén ≤ 400 KB), mime jpeg/png/webp. Ghi chỉ service-role; không policy ghi cho anon/authenticated |
| seed | 1 dòng `shops` SDVICO (`owner_phone = 'sdvico:chua-gan'`, `hoat_dong`, Khánh Hòa) `on conflict (slug) do nothing`. **Dữ liệu prod đã sửa 2026-10-23: `province = 'Thành phố Hồ Chí Minh'`** (anh Long: SDVICO ở HCM; migration seed giữ nguyên lịch sử, `on conflict do nothing` nên không ghi đè lại). Chưa gán chủ thì shop vẫn hiện + nhận đơn (admin xử lý thay, timeline `admin:<sđt>`) |

- ✅ **ĐÃ APPLY prod 2026-09-07** (ref `znzgugvfhgmiszqgjulk`, chủ dự án ra lệnh). `get_advisors` sau apply: 4 bảng mới nằm trong nhóm INFO `rls_enabled_no_policy` — **đúng thiết kế** (khuôn 0037: RLS bật, không policy, revoke anon/authenticated, mọi đường đi qua route service-role), không phải lỗ hổng. Hai hàm bị WARN thiếu `search_path` đã vá bằng [0056](#khoá-search_path-cho-hai-hàm-của-sàn--migration-0062_market_functions_search_pathsql-2026-09-07--đã-apply-prod-2026-09-07).
- **Dev không cần DB**: `MARKET_STORE=file npm run dev` (`npm run dev:cho`, cổng 3020) chạy kho file `.local/market-dev.json` + `.local/market-uploads/` (gitignore `/.local/`), seed persona/3 shop/25 món/6 đơn/3 đánh giá (`lib/market/dev-seed.ts`); `identityFromRequest`/`requireStaff` có nhánh dev tra chuỗi ở sổ persona — chỉ bật khi đủ ba điều kiện `isDevFileModeEnv` (MARKET_STORE=file ∧ không VERCEL ∧ NODE_ENV≠production). Chuỗi dev **không bao giờ** vào `device_tokens`.
- **Không thanh toán trong app** (COD + chuyển khoản tay; `payment_status` là lời khai). **Online-only** (SW không cache `/api/cho|ban-hang|admin/cho|dev`). 5 khoá máy khách `forfish.mcart/maddr/mfav/morders/mshop.v1` xếp loại `NEVER_BACKUP_PREFIXES` (state-registry: Admin+Docs).

### GỘP CỬA HÀNG CŨ VÀO CHỢ — migration [`0061_merge_catalog_into_market.sql`](../../supabase/migrations/0061_merge_catalog_into_market.sql) (2026-09-07, [ADR 0014](../adr/0014-gop-cua-hang-vao-cho.md)) — ✅ **ĐÃ APPLY prod 2026-09-07**

Nền: câu trên ("**không đụng** `product_listings`/`catalog_orders` — luồng cũ giữ nguyên") là đúng cho 0054 và **đã hết hiệu lực từ 0055**. Hai cửa hàng song song (LEAD §5 #11 để lại "gộp = ADR sau") nay gộp làm một: **chợ là cửa hàng duy nhất, SDVICO là một gian hàng**.

**Trạng thái prod đo thật 2026-09-07** (ref `znzgugvfhgmiszqgjulk`): `product_listings` **13 dòng, đều hiện, 7 dòng đặt được, 0 dòng vendor ngoài**; `catalog_orders` **1 đơn thật** (khách `role=customer`, trạng thái `moi`, đặt 28/08 — chưa ai xử lý). Nghĩa là **0045/0046/0047 ĐÃ apply prod** (mấy mục trên còn ghi "CHƯA APPLY" là **doc cũ, sai** — sửa ở dòng dưới), còn **0054 thì CHƯA** (`shops` chưa tồn tại). Vậy: Cửa hàng cũ đang chạy thật với bà con, chợ thì chưa lên.

| Thay đổi | Nghĩa |
|---|---|
| `shop_products.price_vnd` **bỏ NOT NULL** | `null` = **LIÊN HỆ BÁO GIÁ** — món bán qua tư vấn, chưa niêm yết giá (máy tàu, thiết bị lớn báo giá theo từng chiếc). CHECK `between 1000 and 1 tỷ` giữ nguyên và vẫn chặn giá 0/âm (`null` đi qua vì `null` là *unknown*, không phải *false*). Món kiểu này **không có giá gạch, không chia loại/cỡ** (`validateMarketProductDraft`), **không vào giỏ, không lên đơn** — chặn ở `isPurchasable`/`buildMarketLines` (lý do rơi mới `chua_co_gia`) **và** ở `market_place_order` (`price_vnd = (it->>'priceVnd')::integer` không bao giờ khớp `null`). Sắp xếp giá: null **xuống cuối cả hai chiều** (`nullsFirst:false` ở supabase-store, `cmpPrice` ở file-store) |
| hàm `market_fold_vn(text)` | Bản SQL của `foldVn()` (`lib/market/text.ts`) để migration ghi `search_text` **đúng cùng một phép** với app — không thì 13 món chuyển sang tìm không ra. Không dùng extension `unaccent` (prod chưa cài). Chuỗi đích dựng bằng `repeat()` chứ không gõ tay: lệch một ký tự là cả bảng dịch trượt (đã dính thật — "Đá" ra "ya") |
| `product_listings` → `shop_products` | 13 món đang hiện về gian hàng SDVICO. 7 món có giá giữ giá + đơn vị, **tồn kho đặt 99** (bảng cũ không có tồn kho, món đặt được thì luôn đặt được — 99 để GIỮ NGUYÊN hành vi, không phải SDVICO có đúng 99 cái). 6 món chưa từng niêm yết giá → **liên hệ báo giá**, `stock = 0`. `features` jsonb nối vào cuối `description` thành dòng `· …`. Loại: khớp theo TÊN cho 13 dòng đang có, rơi về `group` khi tên lạ. Chạy lại được (`not exists` theo `(shop, title)`) |
| `catalog_orders` → `market_orders` | Đơn của bà con **không được rơi**. Trạng thái: `moi`→`cho_xac_nhan`, `da_nhan`→`da_xac_nhan`, còn lại giữ tên. `productId` nối lại theo tên món; không thấy thì để rỗng (dòng hàng là snapshot nên đơn vẫn đọc được, chỉ mất đường bấm sang trang món). **Địa chỉ: KHÔNG bịa tỉnh** — bảng cũ không có cột tỉnh, nên `province` để rỗng và `detail` ghi thẳng "Đơn cũ từ Cửa hàng — chưa ghi địa chỉ nhận, gọi lại cho bà con". Thà trống thật còn hơn đúng giả |
| `product_listings` · `catalog_orders` | **ĐÃ NGHỈ** (`comment on table`). KHÔNG xoá bảng, KHÔNG xoá dòng nào — còn là đường lùi. App hết đọc; route `/api/sdvico/catalog`, `/api/me/orders`, `/api/admin/products`, `/api/admin/orders` và các file dựng màn cũ giữ lại có `// nợ:` ghi trần |

- ✅ **ĐÃ CHẠY 2026-09-07 theo đúng thứ tự 0060 → 0061 → 0062.** Số đo ngay sau apply: `shops` 1 · `shop_products` **13** (7 có giá + tồn 99, **6 liên hệ báo giá** tồn 0) · `market_orders` **1** (mã `SD260828CAC3`, `cho_xac_nhan`, nối được sang món "Dây curoa máy (bản B)") · `product_listings` **13** và `catalog_orders` **1** GIỮ NGUYÊN không mất dòng nào · `price_vnd` nullable = YES. `search_text` của 13 món khớp `foldVn()` từng chữ.
- 🔴 **CÒN LẠI: DEPLOY.** Prod DB đã là mô hình mới nhưng code trên `main` vẫn là bản cũ đọc `product_listings`/`catalog_orders` — hai bảng đó còn nguyên nên **app đang chạy KHÔNG hỏng**. Chợ chỉ tới tay bà con khi nhánh `feat/san-thuong-mai` lên. Trong khoảng giữa, đơn mới của bà con vẫn rơi vào `catalog_orders` (màn cũ) — **nhớ chuyển nốt sau khi deploy** bằng cách chạy lại mục 4 của 0055 (câu lệnh chạy lại được, `not exists` theo `id`).
- **Việc của SDVICO sau khi apply**: vào `/ban-hang` (a) đặt tồn kho thật cho 7 món, (b) đặt giá cho 6 món "Liên hệ báo giá" nếu muốn bán thẳng, (c) xử lý đơn cũ 28/08 đang treo.
- Khoá máy khách `forfish.orders.v1` (giỏ/đơn Cửa hàng cũ) thành **vô dụng** sau gộp — chưa gỡ, nằm cùng gói nợ với mã chết.


### Khoá `search_path` cho hai hàm của sàn — migration [`0062_market_functions_search_path.sql`](../../supabase/migrations/0062_market_functions_search_path.sql) (2026-09-07) — ✅ **ĐÃ APPLY prod 2026-09-07**

Sinh ra NGAY SAU khi apply 0060+0061 vì `get_advisors` báo WARN `function_search_path_mutable` cho đúng hai hàm: `market_set_updated_at` (0054) và `market_fold_vn` (0055). Mọi hàm còn lại của sàn đã ghim `search_path` sẵn trong 0054 — hai hàm này bị sót.

| Thay đổi | Nghĩa |
|---|---|
| `market_set_updated_at` · `market_fold_vn` → `set search_path = ''` | Hàm không ghim đường dẫn thì tra tên theo đường dẫn của NGƯỜI GỌI: ai tạo được một schema đứng trước `public` là chèn hàm/toán tử trùng tên rồi cướp quyền thực thi — mà `market_set_updated_at` là trigger chạy trên MỌI lần ghi của bốn bảng sàn. Đặt **rỗng** chứ không phải `public`: thân hai hàm chỉ gọi hàm dựng sẵn (`now`, `trim`, `lower`, `translate`, `repeat`, `regexp_replace`) vốn ở `pg_catalog`, luôn tra được kể cả khi đường dẫn rỗng |

- KHÔNG sửa thẳng vào 0054/0055 — hai file đó đã apply, lịch sử migration phải khớp thứ đã chạy. Vá bằng bước mới.
- Kiểm sau apply: `pg_proc.proconfig` của cả hai = `search_path=""`; ghi thử một dòng `shops` ⇒ trigger vẫn nhích `updated_at`; `market_fold_vn('Đá cây ướp cá')` vẫn ra `da cay uop ca`.
### HẸN GIAO + YÊU CẦU ĐẶT HÀNG — migration [`0063_market_requests_eta.sql`](../../supabase/migrations/0063_market_requests_eta.sql) (2026-10-18) — ✅ **ĐÃ APPLY prod 2026-10-18** (chủ dự án duyệt; soi sau apply: 3 cột mới có, `market_requests` 0 dòng, RLS bật 0 policy, anon không có quyền select; ghi `schema_migrations` 20261018070844)

Chủ dự án: *"cho phép chủ tàu đặt đơn bất kỳ cái gì, nó sẽ chuyển cho chủ sàn, làm luôn luồng giống shopee như xác nhận đơn, thời gian giao"*. Hành vi: [11 §4.3–§4.4, §5.9](11-ba-spec-san-thuong-mai.md); tên: [12 §13](12-kien-truc-san-thuong-mai.md).

| Thay đổi | Nghĩa |
|---|---|
| `market_orders.eta_from`, `eta_to` (`date`, null được, `eta_to ≥ eta_from`) | Hẹn giao shop đặt lúc xác nhận. Đơn cũ = null ⇒ màn không hiện dòng hẹn |
| `market_orders.request_id` (`uuid`, null được) | Đơn sinh từ yêu cầu; `items[0].productId` = id yêu cầu ⇒ `market_restock_order` không khớp món nào, hoàn kho vô hại |
| Bảng `market_requests` | `code` YC… unique · `buyer_phone` · `title` 3–120 · `qty` 1–9999 · `unit` · `description` ≤1000 · `images` jsonb ≤3 · `need_by` date · `address` jsonb · `payment_method` · `status` 6 giá trị · `quote` jsonb · `quote_shop_id` → shops · `reject_reason` ≤300 · `order_id` → market_orders · `timeline` jsonb · trigger `market_set_updated_at` · index (buyer, created) + (status, created) |
| RLS | khuôn 0037/0060: bật, KHÔNG policy, revoke anon/authenticated — mọi đường qua route service-role |

- Không cron: tự huỷ 72h, báo giá hết hạn 3 ngày, yêu cầu treo 7 ngày đều chạy LƯỜI khi đọc.
- Cột mới đều nullable + `add column if not exists` ⇒ code cũ đọc vẫn chạy; chạy lại an toàn.
- **Trước khi apply**: code mới đọc/ghi `eta_from` · `request_id` · `market_requests` ⇒ deploy code này lên prod mà CHƯA apply 0063 thì xác nhận đơn/ yêu cầu đặt hàng lỗi 500 (`market_orders vá` báo cột lạ). Thứ tự bắt buộc: **apply 0063 → deploy**.

### GHI NGUYÊN TỬ — migration [`0064_atomic_writes.sql`](../../supabase/migrations/0064_atomic_writes.sql) (2026-10-19, rà Codex) — ✅ **ĐÃ APPLY prod 2026-10-19** (chủ dự án duyệt "viết và apply luôn"; ghi `schema_migrations` 20261019061252)

Rà kiến trúc Codex 2026-10-18 chỉ ra ba cửa sổ ghi dở dang: đồng bộ sổ đọc→gộp→upsert không kiểm bản vừa đọc; huỷ đơn đổi status xong mới hoàn kho (lỗi chỉ ghi log); đồng ý báo giá là ba câu riêng. Cộng thêm timeline đọc-rồi-ghi cả mảng.

| Thay đổi | Nghĩa |
|---|---|
| `user_docs.rev` (`bigint`, default 0) | Phiên bản do SERVER cấp, +1 mỗi lần ghi. `/api/me/sync` ghi `update … where rev = <rev đã đọc>` (CAS); trượt ⇒ đọc lại, `decidePut` (lib/user-sync-core, thuần) quyết lại, thử ≤3; hết lượt ⇒ 503 `busy` (máy giữ sổ chưa đẩy, tự gửi lại). Cuốn > 5 000 mục hoặc > 2 000 000 ký tự ⇒ 400 `too_large` (đo prod 2026-10-19: lớn nhất 787 ký tự, 5 mục) |
| `market_transition_order(id, expect, patch, entry)` | MỘT câu UPDATE có điều kiện status + `timeline || entry` tại DB; sang `da_huy` ⇒ gọi `market_restock_order` trong cùng giao dịch — hoàn kho lỗi thì cả cú huỷ rollback |
| `market_patch_request(id, expect, patch, entry)` | Như trên cho `market_requests` |
| `market_accept_request(id, patch, entry, order)` | `da_bao_gia → da_dat` + insert đơn + ghi `order_id` một giao dịch. buyer/địa chỉ/cách trả lấy từ chính yêu cầu trong DB. Đã có `order_id` ⇒ trả đơn cũ. Mã đơn trùng ⇒ rollback cả gói, adapter sinh mã mới gọi lại |
| Lỗi | P0001 message = `not_found` / `bad_transition` ⇒ adapter map `MarketError` |
| Quyền | security definer, revoke public/anon/authenticated — chỉ route service-role |

- **Kiểm thật trên Postgres prod lúc apply** (khối DO kết thúc bằng RAISE ⇒ tự rollback, soi lại 0 dòng thử): huỷ ⇒ kho 99→97→99, `restocked_at` có, timeline 1→2; sai status mong đợi ⇒ `bad_transition`; id lạ ⇒ `not_found`; đồng ý báo giá ⇒ đơn `da_xac_nhan`, `order_id` khớp, `client_ref = yc:<id>`; bấm lại ⇒ cùng đơn, 1 đơn; mã trùng ⇒ 23505 và yêu cầu vẫn `da_bao_gia`.
- **Đối soát bản ghi dở dang trước đó** (đo 2026-10-19): 0 đơn `da_huy` chưa hoàn kho, 0 yêu cầu `da_dat` thiếu `order_id` ⇒ không cần dọn. Truy vấn đối soát giữ ở ops/runbook.md.
- Tương thích: cột có default + hàm mới ⇒ code cũ chạy nguyên trên DB đã apply. Thứ tự: **apply 0064 → deploy** (code mới gọi hàm 0064).
- file-store (dev) không đổi: một tiến trình, ghi cả tệp một lần nên vốn nguyên tử.

### KAIROS — Đo (CDP nội bộ) — migration [`0077_kairos_do.sql`](../../supabase/migrations/0077_kairos_do.sql) (2026-10-30) — ✅ **ĐÃ APPLY** 2026-10-30 qua connector Supabase (anh Long: "Áp và commit"). Kiểm sau áp: RLS bật; anon/authenticated KHÔNG gọi được `kairos_do`/`kairos_record_tai_tro`, không đọc được bảng; `kairos_do(30)` = 958 khách, 135 hoạt động (7 ngày: 102); ghi thử trong giao dịch rollback: 3 mục cùng bài + 1 mã sai ⇒ một dòng xem 4 bấm 1, mã sai bị bỏ. Code vẫn chịu được khi hàm hỏng: route /api/kairos/doc trả `tt:false`, màn Đo báo lỗi

Hành vi: [14 §22](14-ba-spec-kairos.md). Chỉ cộng thêm, chạy lại an toàn.
- Bảng `kairos_tai_tro_dem`: `ngay date` (mặc định hôm nay giờ VN) · `phone` · `ad_id` (mã bài tài trợ `^[a-z0-9-]{4,40}$`, khớp `quang-cao.ts`) · `xem` · `bam` (0–100 000); **PK `(ngay, phone, ad_id)`** — gộp theo ngày, không lưu từng cú bấm; idx `(ad_id, ngay desc)`. RLS bật, revoke anon/authenticated, không policy. Giữ 365 ngày (hàm ghi tự xoá dòng cũ của SĐT đó).
- Hàm `kairos_record_tai_tro(p_phone, p_items jsonb)` security definer — `[{id, xem, bam}]` ≤20, gộp theo id rồi upsert cộng dồn (khuôn `kairos_record_reads` 0066). Revoke public/anon/authenticated.
- Hàm `kairos_do(p_days)` security definer, stable — p_days kẹp 1–90; trả jsonb `{tong_khach, khach[], chu_de[], tai_tro[]}`. Khách = `customers` role `customer` + account_kind `real`; mỗi dòng khách: phone · name · tier · device_platform · lan_mo (max pwa/web/customer_devices) · que_tinh · home_port (kairos_profiles) · bai_xem · bai_mo · giay_doc · chu_de {topic: xem + 3×mở} · tt_xem · tt_bam · tt_bam_ids · don (market_orders + market_requests + catalog_orders + product_inquiries + sdvico_khach_hoi trong khoảng). Chỉ trả khách có hoạt động trong khoảng. Revoke public/anon/authenticated — chỉ route `/api/admin/kairos/do` (service role).
- Đã chạy thử thân hàm (chỉ đọc, thay bảng đếm bằng rỗng) trên prod 30/10: 958 khách thật, 135 có hoạt động trong 30 ngày.

### KAIROS — tra cứu danh sách đính kèm — migration [`0075_kairos_dinh_kem_dong.sql`](../../supabase/migrations/0075_kairos_dinh_kem_dong.sql) (2026-10-26) — ✅ **ĐÃ APPLY** 2026-10-26 qua connector Supabase (anh Long duyệt; code vẫn chịu bảng chưa có: 42P01 ⇒ rows rỗng)

Hành vi: [14 §21b](14-ba-spec-kairos.md). Bảng `kairos_dinh_kem_dong`: `id bigserial` · `post_id` → kairos_posts cascade · `url_hash` (băm link file) · `stt` · `ten`/`ten_norm` ≤80 · `reg`/`reg_norm` ≤20 · `noi_dung` 1–400 (cả dòng, CCCD đã che) · `page` · `created_at`; idx `(post_id, url_hash)` + `(post_id, reg_norm)`; RLS bật, không policy, revoke anon/authenticated (cả sequence). Ghi: chỉ route PUT /api/kairos/dinh-kem (khoá máy GPU) xoá-rồi-chèn theo (bài, file), chèn lô 500. Đọc: GET …/tra dùng `ilike` chứa trên `reg_norm`/`ten_norm`.

### KAIROS — tin chính sách — migration [`0074_kairos_chinh_sach.sql`](../../supabase/migrations/0074_kairos_chinh_sach.sql) (2026-10-26) — ✅ **ĐÃ APPLY** 2026-10-26 qua connector Supabase (áp TRƯỚC khi deploy vì `supabase-store` POST_COLS đã chọn cột `attachments`)

Hành vi: [14 §21](14-ba-spec-kairos.md). Chỉ cộng thêm, chạy lại an toàn, không đụng RLS.
- Check `kairos_sources.topic` + `kairos_posts.topic` (tên mặc định `<bảng>_topic_check` của 0065) thêm mã **`chinh-sach`** — thông báo nhà nước từ nguồn `*.gov.vn`, `kind` vẫn `bao`; chỉ máy thu gắn (bà con không chọn).
- `kairos_posts.attachments jsonb not null default '[]'`, check mảng ≤10. Phần tử `{title, url}`; máy chủ chỉ nhận link trên `*.gov.vn` (`lib/kairos/chinh-sach.mjs kiemDinhKem chiGov`), dto đọc lại qua `kiemDinhKem` (bản hỏng ⇒ không trường).

### SDVICO — hội thoại trực khách — migration [`0073_sdvico_hoi_thoai.sql`](../../supabase/migrations/0073_sdvico_hoi_thoai.sql) (2026-10-25) — ✅ **ĐÃ APPLY** 2026-10-25 qua connector Supabase

- `sdvico_hoi_thoai`: một người hỏi trên một bài (unique `post_id, asker_phone`; FK bài cascade). `goc_comment_id` (gốc luồng SDVICO trả lời), `asker_profile_id`, `san_pham` (id showcase), `so_tau`, `cang` (khách nói ra mới ghi), `trang_thai` (cho_tra_loi / da_tra_loi / dong), `lan_tra_loi` (≤8), `phieu_id` → `sdvico_khach_hoi` (set null). Chỉ mục hội thoại chờ theo `updated_at`.
- RLS bật + revoke all, KHÔNG policy — chỉ route server (service role).

### SDVICO — phiếu khách hỏi sản phẩm — migration [`0072_sdvico_khach_hoi.sql`](../../supabase/migrations/0072_sdvico_khach_hoi.sql) (2026-10-25) — ✅ **ĐÃ APPLY** 2026-10-25 qua connector Supabase (kiểm: 15 cột, RLS bật)

- `sdvico_khach_hoi` (từ 2026-10-26 còn là **phiếu đăng ký khuyến mãi**: `san_pham` = `data/khuyen-mai.ts tenPhieu`, `cang` = nơi nhận hàng, `loi_nhan` = số lượng · nơi nhận · ghi chú — nhận ra bằng `khuyenMaiCuaPhieu`, không cột mới): một dòng = một khách đủ thông tin để KD gọi lại — máy chủ TỰ LẬP khi hội thoại trực (0073) có đủ số tàu + cảng; SĐT = SĐT tài khoản (14 §3.14). Cột: `nguon` (kairos / san-pham / sen-bien), `san_pham` (tên SP SDVICO), `ten`, `phone` (`^0[0-9]{9}$`), `so_tau` (3–30), `cang` (2–80), `loi_nhan` (≤500), `kairos_post_id` + `kairos_comment_id` (dẫn về luồng khách đã hỏi), `nguoi_gui` (SĐT tài khoản gửi, null = khách chưa đăng nhập), `trang_thai` (moi / da_bao), `bao_luc`, `bao_lan`.
- Chỉ mục: phiếu `moi` theo giờ (AI Assistant lấy), theo SĐT.
- RLS bật + revoke all, KHÔNG policy — chỉ route server (service role). Khoá lấy phiếu `app_config.sdvico_lead_key` (sinh ngẫu nhiên 32 byte trong Postgres lúc áp; env `SDVICO_LEAD_KEY` đè được — DB thắng như khoá thường).

### KAIROS — nhắc tên "@Tên" — migration [`0071_kairos_nhac_ten.sql`](../../supabase/migrations/0071_kairos_nhac_ten.sql) (2026-10-24) — ✅ **ĐÃ APPLY** 2026-10-24 qua Management API (kiểm: cột `mentions` có ở kairos_posts + kairos_comments)

- `kairos_posts.mentions`, `kairos_comments.mentions` — `jsonb not null default '[]'`, check mảng ≤10. Phần tử `{id: profileId, ten: tên gọi lúc tag}`; chữ "@ten" vẫn trong `body`. Route server ghi (lọc ở `server.nhacTenHopLe`), dto đọc qua `nhac-ten.docNhacTen` (bản hỏng ⇒ bỏ).
- Tìm người: `kairos_profiles.handle_norm ilike '%q%'` (≤8, route `GET /api/kairos/users`) — nợ chỉ mục trigram khi bảng hồ sơ vượt ~50 nghìn.
- RLS: không đổi (revoke all, chỉ route server).

### KAIROS — bình luận có ảnh + xem trước link — migration [`0070_kairos_binh_luan_anh.sql`](../../supabase/migrations/0070_kairos_binh_luan_anh.sql) (2026-10-24) — ✅ **ĐÃ APPLY** 2026-10-24 qua Management API (kiểm: 2 cột có, ràng buộc `kairos_comments_body_chk` thay `kairos_comments_body_check`)

- `kairos_comments` CỘNG THÊM `image_path text` (≤1 ảnh, check đường kho `<uuid>/<uuid>.(jpg|png|webp)`; route kiểm ảnh nằm trong thư mục của chính người viết) + `link_preview jsonb` (`{url, site, title, image}` — máy chủ đọc trang lúc ghi, lỗi ⇒ null; dto đọc lại qua `xem-truoc-link.docXemTruoc`, bản hỏng ⇒ không thẻ).
- Ràng buộc chữ 1–1.000 cũ ⇒ `char_length(body) <= 1000 AND (btrim(body) ≥ 1 ký tự OR image_path is not null)` — bình luận chỉ có ảnh được phép.
- Chỉ mục `kairos_comments_image_idx (image_path) where not null` cho `mediaInUse` (dọn ảnh mồ côi / Huỷ không xoá ảnh bình luận). Xoá bình luận ⇒ route xoá ảnh khỏi kho (lỗi ⇒ agent dọn sau 24 giờ); ảnh của trả lời con bị cascade do agent dọn.
- RLS: không đổi (revoke all, chỉ route server).

### KAIROS — cảm xúc kiểu Facebook — migration [`0069_kairos_cam_xuc.sql`](../../supabase/migrations/0069_kairos_cam_xuc.sql) (2026-10-24)

- **CỘNG THÊM** cột `kind text not null default 'hay'` + check (`hay` 👍 · `thuong` ❤️ · `haha` 😆 · `wow` 😮 · `buon` 😢 · `gian` 😡) cho `kairos_post_hay` và `kairos_comment_hay`. Lượt Hay cũ = `hay`.
- PK `(post_id|comment_id, phone)` giữ nguyên ⇒ **một người một cảm xúc**; đổi cảm xúc = UPDATE `kind` (upsert), trigger đếm `hay_count` chỉ chạy insert/delete ⇒ tổng không đổi khi đổi loại. Đếm theo loại: route đọc `(id, kind)` của lô bài đang hiện rồi gộp (`lib/kairos/cam-xuc.xepDem`).
- RLS: không đổi (revoke all, chỉ route server). Code chịu được lúc cột CHƯA có (lỗi cột ⇒ coi như `hay`, ghi không kèm `kind`).

### KAIROS — hồ sơ Sen Biển — migration [`0068_kairos_sen_bien.sql`](../../supabase/migrations/0068_kairos_sen_bien.sql) (2026-10-24) — ✅ **ĐÃ APPLY** 2026-10-24 qua connector Supabase (anh Long: "áp đi")

- Chỉ DỮ LIỆU: thêm một dòng `kairos_profiles` (phone sentinel `sen-bien:tro-ly`, handle "Sen Biển", `official` true, đã đồng ý nội quy) — khuôn hồ sơ SDVICO ở 0065. Không đổi cấu trúc. Chạy lại an toàn (`on conflict do nothing`). Chưa áp ⇒ /api/kairos/sen-bien trả 503, app không ảnh hưởng.
### KAIROS — trang cá nhân kiểu Facebook — migration [`0067_kairos_ho_so.sql`](../../supabase/migrations/0067_kairos_ho_so.sql) (2026-10-24) — ✅ **ĐÃ APPLY** 2026-10-24 qua connector Supabase (anh Long: "áp đi chạy đi"); kiểm: 5 cột có, anon đọc bảng 401

- `kairos_profiles` thêm 5 cột (`add column if not exists`, mỗi cột kèm check — chạy lại an toàn): `cover_path` ≤200 (ảnh bìa, đường kho `kairos-media` `<profileId>/<uuid>.<ext>` như `avatar_path`) · `que_tinh` ∈ 34 mã tỉnh `lib/kairos/khu-vuc.mjs` · `nghe` ∈ mã `lib/kairos/ho-so.ts NGHE` (`cau-muc`,`luoi-vay`,`luoi-re`,`luoi-keo`,`cau-tay`,`lan`,`nuoi-trong`,`thu-mua`,`khac`) · `gioi_thieu` 1–150 ký tự · `home_port` 1–60 (mã `fishing-ports.ts`, route kiểm danh mục). Test `kairos-ho-so.test.ts` đỏ khi danh mục trong code lệch check.
- RLS: bật sẵn từ 0065 (nhắc lại + revoke anon/authenticated), **KHÔNG policy mới**. Số người theo dõi / đang theo dõi đếm từ `kairos_follows` — không cột. Cờ agent (`isAgent`) chưa có cột.
- **Deploy đi trước migration vẫn chạy**: `supabase-store.profileQuery` thấy cột thiếu (42703 / PGRST204) ⇒ đọc lại bằng cột gốc, nhớ 5 phút rồi thử lại; trường mới = trống. Ghi trường 0067 khi cột chưa có ⇒ `KairosError("fields_missing")` ⇒ 503, màn nói "Phần giới thiệu chưa mở trên máy chủ". `mediaInUse` coi `cover_path` là ảnh đang dùng (Huỷ khung soạn / dọn ảnh mồ côi không xoá ảnh bìa).
- Thứ tự an toàn: deploy (code chịu được cột thiếu) → apply 0067 → trong ≤5 phút mỗi instance tự nhận cột.

### KAIROS — phân phối dòng tin + nội quy một lần — migration [`0066_kairos_phan_phoi.sql`](../../supabase/migrations/0066_kairos_phan_phoi.sql) (2026-10-24) — ✅ **ĐÃ APPLY** 2026-10-24 qua connector Supabase (advisor: không cảnh báo mới; anon đọc bảng 401, gọi hàm 42501). Hàm gộp theo bài trước khi upsert (một lô hai dòng cùng bài không lỗi ON CONFLICT)

- `kairos_reads` (PK `phone, post_id`; FK bài cascade): `first_at`, `last_at`, `views`, `opened`, `dwell_ms` — tín hiệu đọc cho cỗ máy phân phối (14 §13). Chỉ mục `(phone, last_at desc)`. RLS bật, KHÔNG policy, revoke anon/authenticated.
- `kairos_record_reads(p_phone, p_items jsonb)` security definer, search_path rỗng: upsert cộng dồn (views/dwell cộng, opened chỉ bật), bỏ bài không tồn tại, xoá dòng > 90 ngày của chính người đó. Revoke khỏi public/anon/authenticated (chỉ service-role gọi).
- `kairos_profiles.rules_accepted_at` **default now()** + đánh dấu hồ sơ cũ = `created_at` — nội quy coi như đồng ý lúc đăng ký app (anh Long: "cho đồng ý 1 lần thôi"); hộp Nội quy không hiện nữa.
- Deploy trước khi apply vẫn chạy: đọc tín hiệu hỏng ⇒ xếp không cá nhân hoá; ghi hỏng ⇒ 503, app giữ hàng đợi.

### KAIROS — đọc báo + mạng xã hội của bà con — migration [`0065_kairos.sql`](../../supabase/migrations/0065_kairos.sql) (2026-10-23) — ⛔ **CHƯA APPLY** (chờ anh Long duyệt)

Hành vi: [14-ba-spec-kairos.md](14-ba-spec-kairos.md) §6. Khuôn 0037/0060/0063: mọi bảng RLS bật, **không policy**, revoke anon/authenticated (cả sequence + hàm trigger) — đọc/ghi chỉ qua route service-role (`identityFromRequest`, staff, khoá ingest). SĐT (`*_phone`) không bao giờ ra client: danh tính công khai là `kairos_profiles.id` (uuid); hàng ⇒ DTO qua `lib/kairos/dto.ts` (test soi JSON không có SĐT).

| Bảng | Cột chính | Ràng buộc / chỉ mục |
|---|---|---|
| `kairos_profiles` | `id uuid` công khai · `phone unique` · `handle` 2–20 · `handle_norm unique` · `handle_changed_at` · `avatar_path` · `show_boat` · `official` · `rules_accepted_at` · `banned_until` · `ban_reason` | `handle_norm` = `handleNorm()` (`lib/kairos/ten-goi.ts`: thường + bỏ dấu + gộp khoảng trắng) ⇒ không trùng tên khác dấu/hoa. Seed hồ sơ SDVICO, phone SENTINEL `sdvico:chinh-thuc` |
| `kairos_sources` | `id` · `outlet` · `feed_url` · `section` · `topic` · `enabled` · `last_ok_at` · `last_error` | nguồn RSS |
| `kairos_posts` | `kind` bao/chinh-thuc/ba-con · `author_phone` · `source_id` · `outlet` · `url` · `url_hash unique` · `title` · `title_norm` · `body` ≤2000 · `summary` · `summary_by` ai/rss · `cover_url` · `images jsonb` ≤5 (đường kho) · `topic` 8 mã (0074 thêm `chinh-sach`) · `attachments jsonb` ≤10 (0074, file đính kèm thông báo gov) · `regions[]` · `provinces[]` · `ports[]` · `reshare_of` (set null) · `pinned_until` (chỉ chinh-thuc) · `hidden` · `mod_state` · `mod_checked_at` · `hay_count` · `comment_count` · `published_at` (bài báo: giờ báo đăng) · `feed_at` (giờ lên dòng tin — bài báo: lúc được cho `dat` lần đầu; khoá xếp/cursor/new-count) · `edited_at` | check hình dạng theo `kind`; idx `(feed_at desc, id desc) where not hidden` (cursor `lib/kairos/cursor.ts`); GIN ports/provinces/regions; `(author_phone, created_at)` (đếm 10 bài/ngày); `(title_norm, published_at)`; hàng chờ kiểm `where mod_state='cho-kiem'` |
| `kairos_comments` | `post_id` cascade · `parent_id` cascade · `author_phone` · `body` 1–1000 · `hay_count` · `hidden` · `mod_state` · `mod_checked_at` | trigger `kairos_comment_one_level`: trả lời đúng 1 cấp, cùng bài; idx `(post_id, hay_count desc)` (top 2), `(post_id, created_at, id)` (cursor 30) |
| `kairos_post_hay` · `kairos_comment_hay` | `(post_id\|comment_id, phone)` | **PK cặp** ⇒ bấm trùng không đếm 2 (AC09); trigger đếm `hay_count` cùng giao dịch (khuôn 0064) |
| `kairos_follows` · `kairos_blocks` | cặp SĐT | PK cặp + check khác nhau; idx đếm 100/ngày |
| `kairos_reports` | `target_type` post/comment · `target_id` · `reporter_phone` · `reason` 6 mã · `note` ≤200 · `status` moi/da-an/bo-qua · `handled_by/at` | unique `(target_type, target_id, reporter_phone)` |
| `kairos_seen` | `url_hash pk` · `title_norm` · `source_id` · `outcome` nhan/trung-tieu-de/loai-chu-quyen/loi · `flag_term` | chặn trùng link VĨNH VIỄN; tiêu đề 7 ngày (`lib/kairos/lien-ket.mjs`); cờ chủ quyền cho tab quản trị |
| `kairos_mod_decisions` | `target_type/id` · `decided_by` agent/staff · `actor` · `verdict` dat/nghi/chan · `reason` ≤500 · `score` 0..1 · `rules_version` · `model` · `overrides` → dòng bị đảo | AC24: chỉ thêm; người trực đảo = dòng `staff` mới trỏ `overrides`. idx hàng chờ `where decided_by='agent' and verdict in (nghi,chan)` |
| `kairos_notify_marks` | `(post_id, phone)` · `last_at` | gộp thông báo 1 tin/bài/người/giờ |
| `kairos_audit` | `actor` · `actor_kind` ba-con/staff/he-thong · `action` · `target_*` · `detail jsonb` · `ip` · `at` | trigger `kairos_audit_guard`: CẤM sửa, CẤM xoá dòng < 2 năm (NĐ 147/2024). Cũng là sổ đếm trần ngày: upload 30 ảnh, và cùng bảng bài/bình luận cho `post_create`/`post_reshare`/`comment_create` (xoá bài không lách trần — 14 A68); sửa bài 30/ngày đếm `post_edit`. Ảnh: `media_discard` (bà con Huỷ khung soạn xoá ảnh vừa tải) · `media_gc` (agent soi ảnh tải 24 giờ–7 ngày trước, `detail.removed` true/false — đã soi thì không soi lại, 14 A76) · `agent_hide` ghi cả khi đích đã ẩn sẵn (`detail.alreadyHidden`, A80) |

- **`mod_state`** (`cho-kiem`/`dat`/`nghi`/`chan`, mặc định `cho-kiem`): bài **báo** chỉ lên dòng tin khi `dat` — dòng tin lọc `not hidden and (kind <> 'bao' or mod_state = 'dat')`; bài/bình luận bà con và Chính thức HIỆN NGAY (đã qua lọc chữ + chủ quyền ở route), agent quét sau, vi phạm rõ ⇒ `hidden=true` + `mod_state='chan'`.
- **Hàng chờ agent** (`/api/kairos/kiem` GET): bài/bình luận `cho-kiem` + đích có báo xấu `moi` MỚI HƠN `mod_checked_at` (14 A67) — đích agent đã chấm không gửi lại tới khi có báo mới.
- **Đọc chéo `market_listings`** (chỉ đọc, service-role): dòng phụ "tên cơ sở bên mua" = `poster_name` tin `side='mua'` mới nhất của SĐT, `poster_kind` ≠ `ngu-dan` (14 A23).
- **Bucket `kairos-media`**: public đọc (cần cho `/k/[id]`, A10), 512 KB, jpeg/png/webp, đường `<profileId>/<uuid>.<ext>` (không SĐT), không policy ghi — chỉ service-role. `images` lưu ĐƯỜNG kho (không URL) để xoá bài xoá được ảnh. Ảnh mồ côi (tải mà không thuộc bài nào / không là `avatar_path`): Huỷ khung soạn xoá ngay, sót thì agent dọn sau 24 giờ (14 A76).
- **`app_config`**: seed `kairos_enabled='true'`. Khoá nội dung **`kairos_ads`** (2026-10-24, 14 §20): JSON danh sách bài Tài trợ, không seed, ghi qua `/api/admin/kairos/ads`, đọc ở `lib/kairos/quang-cao-store.ts`. Khoá `kairos_ingest_key` **không seed** (secret không vào git) — admin đặt ở `/quan-tri` tab Hệ thống, env `KAIROS_INGEST_KEY` đè (khoá DUY NHẤT env thắng DB — `ConfigKeyMeta.envFirst`, tab Hệ thống cảnh báo khi env đang đè, 14 A79); thiếu cả hai ⇒ `/api/kairos/nhap` + route kiểm duyệt 503.
- Chạy lại an toàn (`if not exists`, `on conflict do nothing`, `drop trigger if exists`). Thứ tự: **apply 0065 → deploy** (route Kairos đọc các bảng này; chưa apply ⇒ tab Kairos lỗi, phần app khác không ảnh hưởng). Demo mode: kho file dev theo khuôn `MarketStore`.
- Luật thuần dùng chung (route + máy thu tin + app): `lib/kairos/` — `khu-vuc.mjs` (34 tỉnh + tên cũ, vùng biển, cảng), `chu-quyen.mjs`, `loc-chu.ts`, `ten-goi.ts`, `validate.ts`, `chu-de.mjs`, `lien-ket.mjs`, `cursor.ts`, `dto.ts`, `thoi-quen.ts` + `xep-bai.ts` (chỉ trong máy), `cache.ts` (`forfish.kairos.v1`, `forfish.kairos.nhap.v1`). Test: `src/lib/__tests__/kairos-*.test.ts`.

<!-- re-verified: 2026-09-07 — 0055 gộp Cửa hàng vào chợ; soi prod: product_listings 13/13 hiện, 7 đặt được, 0 vendor ngoài; catalog_orders 1 đơn thật trạng thái `moi` ngày 28/08; `shops` chưa tồn tại ⇒ 0054 chưa apply, 0045/0046/0047 ĐÃ apply (mục trên ghi "CHƯA APPLY" là doc cũ sai). market_fold_vn đối chiếu với foldVn() trên đủ 13 tên món: khớp từng chữ. -->

<!-- re-verified: 2026-06-14 — schema 0001 boats/documents + §6 gateway khớp code -->
<!-- re-verified earlier baseline -->

