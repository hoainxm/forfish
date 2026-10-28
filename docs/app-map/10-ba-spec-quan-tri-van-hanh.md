# 10 — ba-spec: Web quản trị vận hành SDFish + ranh giới SDWork

> Load khi: task chạm /quan-tri (vận hành), phân quyền đại lý, trạng thái premium (đã dùng/đã liên hệ), thu tiền + trace tiền đồng bộ SDWork, audit hoạt động admin, luồng đăng nhập admin.
covers: src/app/quan-tri, src/components/admin, src/app/api/admin, src/lib/admin-auth.ts, src/lib/admin.ts
last_verified: 2026-10-26
<!-- re-verified: 2026-10-28 14:30 — BUILD NV11 Báo cáo số liệu (R15, giả định I/J/K): tab "Báo cáo" admin-only, `GET /api/admin/reports` requireAdmin, luật đếm `lib/admin-reports.ts` (có test). Không đổi R3/R12–R14, không đổi MANAGER_TABS. -->
<!-- re-verified: 2026-10-26 20:30 - tab Yêu cầu hỗ trợ (tab-hoi-mua.tsx) thêm mục chỉ-xem "Khách hỏi / đăng ký khuyến mãi SDVICO" (GET /api/admin/sdvico-khach-hoi, requireAdmin) — phiếu sdvico_khach_hoi moi/da_bao đối chiếu tin Zalo Quân; luật phân quyền/tab không đổi (14 §3.14b) -->
ttl_days: 90
<!-- re-verified: 2026-10-26 — SPEC MỚI (CHƯA BUILD, chưa có code): NV9 người tạo thấy khách mình tạo (R13, AC-11..13) + NV10 hỗ trợ kỹ thuật tra đúng SĐT (R14, AC-14..19). Chủ dự án chốt hướng B + C sau phân tích: "khách của mình" trong code hôm nay = `premium_grants.granted_by` (accounts/route.ts GET + `managerTargetDenial`), tạo khách không tick premium ⇒ chính người tạo không thấy; quản lý không cứu được khách người khác/khách không chủ. Mục `last_verified` GIỮ NGUYÊN tới khi code khớp. -->
<!-- re-verified: 2026-10-24b — tab Hệ thống → Cấu hình ứng dụng: mỗi ô ghi rõ bên nào thắng (`configPrecedenceText`); khoá nhập tin Kairos là `envFirst` — env máy chủ ĐÈ DB (ngược các khoá khác), cả hai cùng có thì ô báo đỏ "Env … đang đè — giá trị trong ô này KHÔNG có hiệu lực". `configStatus` trả thêm `envFirst`/`envVar`/`overridden`. Quyền (requireAdmin) + kiểm dạng giá trị không đổi. -->
<!-- re-verified: 2026-10-23e — tab Kairos: nút Cấm người đăng đổi nhãn thành "Cấm đăng" (`NHAN.camDang`, luật nhãn ≤2 chữ); quyền (delete) + hộp lý do 7/30 ngày/vĩnh viễn KHÔNG đổi. -->
<!-- re-verified: 2026-10-23 — TAB KAIROS (nhóm Nội dung, 14 §3.11): `components/admin/tab-kairos.tsx` (Báo xấu · Hàng chờ agent · Bài · Chính thức · Cờ chủ quyền) + `/api/admin/kairos/{queue,reports,posts,official,action,flags}`; quản lý thấy tab qua `ManagerTab "kairos"` (preset view+edit, KHÔNG create/delete — đăng Chính thức/cấm SĐT admin tick riêng); mọi thao tác ghi `kairos_audit`; Đăng xuất /quan-tri xoá thêm bản lưu Kairos (`clearKairosLocal`). -->
<!-- re-verified: 2026-10-22c — rà bố cục: hộp "Ghi thu tiền" (tab-tai-khoan) và form mối bán (tab-cho-ban) đóng được bằng Escape, role=dialog aria-modal, cao tối đa 85dvh cuộn trong; hộp ghi thu z-40 nền 50% như hộp xác nhận chung — nghiệp vụ quản trị không đổi. -->
<!-- re-verified: 2026-10-19h — TÁCH src/app/quan-tri/page.tsx (6.718 → 454 dòng, rà Codex đợt 3 "tách trang quản trị theo chức năng và tải khi mở tab"): mỗi tab một file `src/components/admin/tab-*.tsx` (tai-khoan · thuyen-vien · san-pham · don-hang · hoi-mua · vung-vms · cho-ban · thong-bao · he-thong · phan-quyen · nhat-ky), dùng chung ở `admin/quan-tri-chung.tsx` (Me, Health, permsFor, ADMIN_ALL/NONE, fmtDT/fmtD, fold). Trang chính giữ QuanTriPage + AdminLogin, nạp tab bằng next/dynamic (loading = AdminSkeleton). Tách bằng AST TypeScript, mã DỜI NGUYÊN VĂN — không đổi hành vi, quyền, route; 5105 test (app-config-guard, app-usage nay đọc page + tab-*). -->
<!-- re-verified: 2026-10-19 — chỉ đổi CHỮ ở tab Danh bạ thu mua: câu dẫn "hiện trong app ngư dân (mục Giao dịch → Bán ở đâu)" → "(mục Chợ cá → Bán ở đâu)" theo dock 5 mục mới; không đổi route/API/quyền. -->
<!-- re-verified: 2026-10-18 — TAB CHỢ VẬT TƯ thêm mục "Yêu cầu đặt" (chủ sàn báo giá / báo không tìm được — 11 §7b): route `/api/admin/cho/yeu-cau` (+[id]) đều `requireMarketAdmin` (requireAdmin, như mọi /api/admin/cho/*), nhật ký action mới `market.request-quote` (admin-activity ADMIN_ACTIONS + ACTION_LABEL "Báo giá / từ chối yêu cầu đặt hàng"). Xác nhận đơn thay shop (`/api/admin/cho/don/[id]` status da_xac_nhan) nay BẮT BUỘC hẹn giao (etaPreset hoặc etaFrom/etaTo) + dời hẹn ở nhánh chỉ-ghi. Không đổi quyền, không route ngoài khu chợ. -->
<!-- re-verified: 2026-10-07 16:10 — THÔNG BÁO + CẶP VAPID: (1) Gửi thông báo (tab Thông báo): POST /api/admin/push trả thêm `failedByStatus`; màn nối "Lỗi theo mã — mã 403: N…", có 403 thì nói thẳng là khoá VAPID lệch. 403 KHÔNG thử lại, KHÔNG xoá đăng ký (dán nhầm khoá mà xoá theo 403 = mất sạch đăng ký). (2) Cấu hình ứng dụng: thêm lớp chặn thứ 4 — lưu ô VAPID lệch cặp với ô kia ⇒ 409 `vapid_pair_mismatch`, không ghi; đổi cả cặp = dán CẢ HAI ô rồi Lưu một ô (`pairValue`, hai ô một lệnh upsert). Phân quyền không đổi: app-config vẫn requireAdmin, push vẫn requirePermission("thong-bao"). R3/NV1–NV8 không đổi. -->
<!-- re-verified: 2026-10-02 15:50 — RBAC: vai tách sang `staff_accounts` (0056), loại tài khoản real/test/demo/reviewer, R3 siết ở server cho grant/delete/set-flags/push riêng + tạo-khách-trên-SĐT-đã-có; R3b thêm nguồn DB `scope`; R6 sửa theo 0053 (admin nhiều máy, đã chốt 2026-08-31); thêm R7–R10. -->
<!-- re-verified: 2026-10-02 12:00 — /quan-tri ĐIỀU HƯỚNG NHÓM (lib/admin-nav, chỉ XẾP chỗ): danh sách tab vẫn tính theo vai — admin đủ, quản lý `visibleTabs(staff_permissions)`; 4 tab admin-only cứng vẫn gác `isAdmin` lúc render + requireAdmin ở API. NV1–NV7 + R3/R3b/R3c hành vi không đổi. -->
<!-- re-verified: 2026-10-02 11:10 — TẠO TÀI KHOẢN KHÔNG HẠ VAI (thêm luật R3c): `POST /api/admin/accounts` đọc vai cũ, ghi `roleAfterCreate` (lib/admin.ts, có test) = vai cao hơn; hạ vai chỉ qua set-role (checkSetRole/checkDemoteAdmin không đổi). requireAdmin cho tạo nhân sự + requirePermission("tai-khoan","create") cho tạo khách giữ nguyên. Án lệ 2026-09-30: tạo khách cấp premium trên SĐT đã có tài khoản đã ghi đè role thành customer. -->
<!-- re-verified: 2026-09-17 — CẤU HÌNH ỨNG DỤNG: LƯU SAI LÀ CHẾT HỆ THỐNG, NAY CÓ BA LỚP CHẶN (ảnh prod cùng ngày: trình duyệt tự điền SĐT 0938… vào ô VAPID Public Key, mật khẩu vào Private Key, nút Lưu sáng; chủ dự án: "thao tác cái là chết hệ thống mà không cảnh báo"). (1) Input tắt tự điền: `autoComplete=new-password|off`, `name=cfg-<key>`, `spellCheck=false`, data-lpignore/1p-ignore. (2) Kiểm dạng NGAY KHI GÕ bằng `validateConfigValue` (lib/app-config-keys, thuần): sai thì dòng đỏ "Không đúng dạng… nếu ô tự hiện SĐT/mật khẩu là trình duyệt điền nhầm" + khoá nút Lưu; PATCH /api/admin/app-config kiểm lại lần nữa cho MỌI khoá ⇒ 400 `bad_value` (VAPID public 80–100 base64url, private 40–50, subject mailto:/https:, cron ≥16 ký tự, khoá dữ liệu 64 hex). (3) Bấm Lưu mở hộp xác nhận (role=alertdialog, nền danger) nói HẬU QUẢ của đúng khoá đó (`risk` khai trong registry, lời thường, có test cấm jargon) + "Áp dụng ngay cho mọi máy, không hoàn tác được ở đây"; "Lưu thật" mới ghi, "Huỷ" đóng. Registry thêm 2 ô khoá dữ liệu bản đồ `data_key_current` (secret, nút "Tạo ngẫu nhiên" sinh 64 hex trên máy admin) / `data_key_prev`; ghi khoá hiện hành mới thì khoá cũ tự trượt xuống prev (`dataKeyShift`). Cổng: `__tests__/app-config-guard.test.ts` (risk đủ + lời thường, validate từng khoá kể cả đúng chuỗi trong ảnh, shift, dây nối trang + route). -->
last_verified: 2026-09-14
<!-- re-verified: 2026-09-14b — sửa nợ copy sau đổi tên: băng cảnh báo /quan-tri tab Sản phẩm + Đơn hàng hết tự-tham-chiếu ("Cửa hàng … gộp vào Cửa hàng") — gọi cái cũ là "màn Cửa hàng cũ", chợ chung là "Cửa hàng (chợ chung)"; dọn 1 chỗ comment còn sót tên cũ "Chợ vật tư". Thuần câu chữ; requireAdmin/requirePermission/MANAGER_TABS + phân quyền + ranh giới SDWork KHÔNG đổi. -->
<!-- re-verified: 2026-09-14 — quan-tri/page.tsx ĐỔI NHÃN hiển thị tab "Chợ vật tư" → "Cửa hàng" (mảng TABS + hai băng cảnh báo tab Sản phẩm/Đơn hàng), thuần câu chữ. requireAdmin/requirePermission("san-pham"|"don-hang")/MANAGER_TABS + phân quyền đại lý + ranh giới SDWork KHÔNG đổi. ⚠️ Nợ copy: sau find-replace, băng cảnh báo thành tự-tham-chiếu ("Cửa hàng … đã gộp vào Cửa hàng") — chủ nhân rename sửa lại câu, không đụng hành vi. -->
<!-- re-verified: 2026-09-07b — TAB CHỢ VẬT TƯ, VÒNG 2 (07 §5a-bis). Thêm MỤC THỨ NĂM "Đánh giá": hàng đợi kiểm duyệt CẢ SÀN, mặc định lọc 1–2 sao, phân trang qua useAdminList, ẩn/hiện tại chỗ. Trước đó route bắt buộc productId nên việc "admin ẩn đánh giá vi phạm" (11 §7) không có lối đi thật. ẨN ĐÁNH GIÁ VẪN LÀ MỘT CHẠM, CỐ Ý — chủ dự án chốt 2026-09-07 "quản trị viên được quyền làm các kiểu", nên đây là NGOẠI LỆ có chủ ý của luật "không hành động 1 chạm"; bù lại bắt buộc báo kết quả bằng NoticeBar (bản trước ẩn xong im lặng). Mục Sản phẩm: thêm chip lọc trạng thái (kể cả "Đã gỡ") + dòng phạm vi giải thích vì sao tổng lớn hơn ô KPI "Món đang bán" (danh sách bật includeHidden). Ô lọc gian hàng gom ĐỦ TRANG (trước chỉ nạp 20 shop đầu ⇒ gian thứ 21 trở đi không lọc được) và hết nuốt lỗi mạng thành danh sách rỗng. Băng kết quả thao tác tự tắt khi đổi bộ lọc; Tổng quan có nhánh sàn-còn-trống. PHÂN QUYỀN KHÔNG ĐỔI: vẫn requireAdmin cho mọi /api/admin/cho/*, nợ MANAGER_TABS vẫn mở như ghi ở ADR 0014. KHÔNG LÀM (chủ dự án gạt): chặn người mua bom hàng. -->
<!-- re-verified: 2026-09-07 — GỘP CỬA HÀNG VÀO CHỢ (ADR 0014) chạm /quan-tri ở ĐÚNG HAI CHỖ, đều là câu chữ, KHÔNG đụng phân quyền: tab "Sản phẩm" và tab "Đơn hàng" mở đầu bằng băng cảnh báo viền vàng nói thẳng app ngư dân KHÔNG còn đọc `product_listings`/`catalog_orders` nữa (dữ liệu đã sang chợ bằng migration 0061), sửa ở đó bà con không thấy, muốn đổi hàng đang bán thì sang tab "Chợ vật tư". Nút Tạo/Sửa/Xoá và `requirePermission("san-pham"|"don-hang", …)` GIỮ NGUYÊN — cố ý: gỡ quyền là việc phải hỏi chủ dự án. NỢ ĐANG MỞ (🔴 Auth, ADR 0014 mục "Việc còn mở"): quản lý có `san-pham`+`don-hang` trong `MANAGER_TABS` nhưng `cho-vat-tu` là admin-only ⇒ sau đợt này quản lý không còn màn bán hàng nào thật sự dùng được. Cách sửa đúng là đưa `cho-vat-tu` vào `MANAGER_TABS` và chuyển quyền cũ sang, chờ chủ dự án chốt. -->
<!-- re-verified: 2026-09-06b - /quan-tri thêm tab "Chợ vật tư" (admin-only, requireAdmin) + route /api/admin/cho/* + 5 mã admin-activity market.*; phân quyền manager/tab hiện có KHÔNG đổi; ranh giới SDFish/SDWork giữ nguyên (tiền sàn không qua SDWork) -->
<!-- re-verified: 2026-09-06 - admin-auth.ts CHỈ thêm nhánh dev đầu requireStaff (isDevFileMode: tra persona file-store, chỉ sống khi MARKET_STORE=file && !VERCEL && NODE_ENV!=production); ranh giới SDFish/SDWork, phân quyền đại lý, luật 1-tài-khoản-1-máy KHÔNG đổi -->
<!-- re-verified: 2026-08-31 — DẢI 4 Ô SỐ ĐẦU TAB "Tài khoản" NAY ĐẾM THEO THỨ ĐANG XEM.
Báo từ hiện trường (Vss Quân Bình Định qua chủ dự án): *"cái con số pre nó ko nhảy theo"* — ảnh chụp
39 tổng / 39 premium đứng im khi đổi bộ lọc. KHÔNG phải lỗi dữ liệu, cũng không phải `resolveTier`:
bốn ô đếm trên `accounts` (toàn bộ bảng) trong khi MỌI thứ dưới chúng (ô tìm SĐT/tên, chip
Premium/Thường, chip Khách-dùng-app/Nhân-sự-quản-trị) đều lọc danh sách ⇒ danh sách đổi mà số đứng im.
Riêng chip vai còn sai cả nghĩa: màn MẶC ĐỊNH là "Khách dùng app" (đã trừ nhân sự) mà ô vẫn ghi
"Tổng tài khoản" gồm cả nhân sự — hai con số nói về hai tệp khác nhau đặt cạnh nhau.
Nay `stats` đếm trên `visible`; nhãn ô đầu "Tổng tài khoản" → "Đang xem" để không hứa một con số
toàn bảng. Muốn tổng thật thì bỏ hết bộ lọc, đúng như mọi màn danh sách khác.
KHÔNG đụng luật hạng: `resolveTier(tier, premium_until, now)` giữ nguyên, API `/api/admin/accounts`
giữ nguyên, quyền và log cấp premium giữ nguyên. AC quản trị không đổi một dòng. -->
<!-- re-verified: 2026-09-17 — /quan-tri tab Hệ thống → Cấu hình ứng dụng: thêm 2 ô `data_key_current` / `data_key_prev` (khoá AES mã file dữ liệu biên tập SDF2, secret); ô hiện hành có nút "Tạo ngẫu nhiên" (sinh 64 hex trên máy admin) rồi Lưu như mọi khoá. PATCH /api/admin/app-config: khoá phải 64 hex; ghi khoá hiện hành mới thì khoá cũ tự trượt xuống "trước đó". Build Vercel đầu TỰ SINH nếu trống — admin không bắt buộc làm gì; đổi khoá xong deploy lại. Nguồn: 02 re-verified 2026-09-17. CHỐNG TỰ ĐIỀN (ảnh prod cùng ngày: trình duyệt điền SĐT vào ô VAPID Public Key, mật khẩu vào Private Key): mọi ô cấu hình `autoComplete=new-password/off`, `name=cfg-<key>`, data-lpignore/1p-ignore; và PATCH kiểm dạng MỌI khoá (`validateConfigValue`: VAPID public 80–100 base64url, private 40–50, subject mailto:/https:, cron ≥16 ký tự, data key 64 hex) ⇒ 400 `bad_value`, không ghi. -->
<!-- re-verified: 2026-08-19 — SYNC BASE (Long-Forfun→sdvico, 41 commit). Đối chiếu 4 vùng covers: (1) `lib/admin.ts` KHÔNG đổi (nguồn admin kép env+DB giữ nguyên như ghi chú 2026-08-04b); `lib/admin-auth.ts` nhận bản SIẾT FAIL-OPEN của base: `requireStaff` tra `staff_permissions` cho manager nay chỉ rơi về preset mặc định khi CỘT CHƯA CÓ (`isMissingColumnError`), còn lỗi tra khác (Postgres nghẹt / schema cache hỏng / driver ném) → **503 `unavailable`** thay vì cấp preset view+create+edit cho người mà máy chủ vừa không tra nổi quyền. Mô hình quyền admin/manager tab×hành động KHÔNG đổi; đường chuỗi-cứng-trước-phiên của sdvico (2026-08-04c) giữ nguyên. (2) `src/app/api/admin` nhận THÊM route đơn hàng `/api/admin/orders` (+`[id]`) của base — chuyển trạng thái đơn `moi→da_nhan→dang_giao→da_giao|da_huy`, gác bằng `requirePermission("don-hang",…)`, push chủ tàu `sent_by=system:order`; `accounts`/`push`/`products` chỉ thêm cột/field, VẪN ghi 2 nhật ký song song (writeAudit→admin_audit + logActivity→admin_activity_log). (3) `src/app/quan-tri/page.tsx` thêm tab **Đơn hàng** + ô nhóm/giá số/đơn vị/cho-đặt ở tab Sản phẩm; KỲ HẠN PREMIUM GIỮ NGUYÊN của sdvico (PREMIUM_TERM_MONTHS=18 + chọn được), KHÔNG lấy "1 năm/lần" của base. (4) Migration đơn hàng của base đổi số 0032/0033/0034 → **0045/0046/0047** và ⚠️ CHƯA APPLY prod SDVICO — tab Đơn hàng chỉ chạy thật sau khi apply. NV1–NV7 hành vi không đổi. -->
<!-- re-verified: 2026-08-04c — FIX ĐĂNG NHẬP ADMIN dưới kiến trúc base (device-token): `requireStaff` nay xác thực CHUỖI CỨNG trước (tokenIdentity qua next/headers) rồi mới phiên Supabase (đường lùi) — base bỏ phiên nên admin/manager token-only trước bị 401, /quan-tri + nút Trang quản trị chết. Client /quan-tri: 41 call /api/admin/* nay gửi `tokenHeader()`. Phân quyền admin/manager KHÔNG đổi; KHÔNG-tra-được-sổ-chuỗi → 503 (không đá staff oan). -->
<!-- re-verified: 2026-08-04b — SYNC BASE (Long-Forfun→sdvico, 48 commit): vùng vận hành nhận kiến trúc base, GIỮ delta sdvico. (admin-auth.ts) requireStaff theo staff-permissions superset (admin permissions=null toàn quyền; manager tra bảng theo tab×hành động). (admin.ts) nguồn admin KÉP env+DB (mergeAdmins/checkDemoteAdmin/checkSetRole). (api/admin/accounts) GHI 2 NHẬT KÝ song song — writeAudit→admin_audit (NV7 sdvico, 0027) VÀ logActivity→admin_activity_log (base, 0030); GET union SELECT với tier từng nhóm cột optional (care-flags sdvico + data/storage base CHƯA apply prod) — degrade an toàn không mất danh sách 700+ khách. (quan-tri) thêm tab Phân quyền + Nhật ký + chip onboarding/đo-dùng-app; GIỮ NV2/NV3 chip chăm khách + ghi mã CK. Kỳ hạn premium giữ 1 năm 6 tháng (548). Migration base đổi số 0022-0031→0033-0042, ✅ ĐÃ APPLY prod (soi prod 2026-08-04 xác nhận đủ 10 cột/bảng). NV1-NV7 hành vi không đổi. -->
<!-- re-verified: 2026-08-04 — ƯU ĐÃI PREMIUM: kỳ hạn kích hoạt/gia hạn 1 năm → 1 năm 6 tháng (PREMIUM_TERM_DAYS 365→548, src/lib/tier.ts). Copy nút/xác nhận /quan-tri "1 năm" → "1 năm 6 tháng"; comment accounts/route.ts theo. Gói 300k=1 năm là ngoại lệ chỉ cho 2 SĐT cũ (0384668304, 0376002882) — KHÔNG luồng cấp 300k trong app. Hành vi grant/renew/log premium_grants KHÔNG đổi (chỉ số ngày). -->
<!-- re-verified: 2026-08-10 — KỲ HẠN PREMIUM CHỌN ĐƯỢC (sửa lỗi: chỉ có 1 mốc cứng 18 tháng, thiếu option 1 năm). lib/tier: bỏ PREMIUM_TERM_DAYS(548) cứng → `PREMIUM_TERM_MONTHS`(mặc định 18) + `PREMIUM_TERM_PRESETS`([12→"1 năm", 18→"1 năm 6 tháng"]) + `clampTermMonths` (1–120, số lạ→mặc định) + `premiumTermLabel`; `nextPremiumUntil(cur, now, months?)` cộng THÁNG LỊCH (addCalendarMonths qua setUTCMonth) thay vì 548 ngày. API `POST`/`PATCH action=grant` nhận `termMonths?` (server tự clamp — body bịa số không phá được hạn); `activate`/`renew`/log premium_grants KHÔNG đổi luồng. UI /quan-tri: `PremiumTermPicker` (gói dựng sẵn + ô "Khác") trong hộp cấp/gia hạn và form tạo tài khoản; ConfirmDialog thêm slot `children`. Thêm gói mới = sửa PREMIUM_TERM_PRESETS. Gói 300k=1 năm vẫn là ngoại lệ ngoài luồng app. -->
<!-- re-verified: 2026-08-01 — SYNC BASE (Long-Forfun→sdvico). Vùng vận hành nhận thêm mô hình quyền của base, KHÔNG mất năng lực sdvico: (admin-auth.ts) `requireStaff` nay theo staff-permissions — admin (env HOẶC role='admin') permissions=null toàn quyền, manager tra bảng `customers.staff_permissions` (jsonb, migration 0028 — ĐÃ ĐỔI SỐ từ 0017 base) theo TAB×HÀNH ĐỘNG, cột chưa apply thì preset mặc định; `requirePermission(tab,action)` + `requireAdmin` giữ nguyên. (admin.ts base) nguồn admin KÉP env+DB: `mergeAdmins`/`checkDemoteAdmin`/`checkSetRole` (chặn self/env_admin/last_admin, NÂNG luôn được = đường di cư env→DB). (api/admin) thêm route `/api/admin/activity` + `/api/admin/staff`; `accounts` GHI **2 nhật ký song song** — `writeAudit`→bảng `admin_audit` (NV7 sdvico, 0027) VÀ `logActivity`→`admin_activity_log` (base, 0030) — cùng cột onboarding (0029) + đo-dùng-app (0031). (quan-tri) thêm tab Phân quyền (PermissionsTab) + Nhật ký (ActivityLogTab base) + chip onboarding; GIỮ NV2/NV3 chip chăm khách + ghi mã CK. NV4/NV5/NV7 (H2/H3/§8) KHÔNG đổi hành vi. ⚠️ Migration 0028-0031 CHƯA apply prod (ref znzgugvfhgmiszqgjulk). -->
<!-- re-verified: 2026-08-01b — SYNC BASE tiếp (2 commit fix quan-tri): (1) hàng khách /quan-tri tách 2 dòng có nhãn "Hướng dẫn:"/"Máy khách:" — trước staff_note_by in sát chip, đọc dính. (2) chip "đủ đồ đi biển" đo trên ĐÚNG KHO (iOS A2HS tách Safari) qua src/lib/app-usage.ts, gộp 2 chip rời → 1 chip bậc thang, gỡ chip thủ công "đã/chưa sử dụng". THUẦN UI/hiển thị — KHÔNG đổi route/API/payload/AC. NV1-NV7 hành vi không đổi. -->
<!-- last_verified 2026-07-30 (giữ mốc cũ): xác lập NV1-NV7 + ranh giới SDWork. -->


> **Mục đích**: oracle HÀNH VI cho web quản trị VẬN HÀNH của SDFish — USER nào làm gì, vào/ra sao, đúng-sai đo bằng AC. Chốt RANH GIỚI với SDWork (CRM tiền/khách). KHÔNG mô tả giao diện (việc của [07-design-spec](07-design-spec.md)).

---

## 0. RANH GIỚI HAI HỆ (quyết định gốc — chủ dự án Long chốt 2026-07-30)

Hai web, hai mục đích KHÁC nhau — KHÔNG trộn:

| Hệ | Mục đích | Sở hữu dữ liệu |
|---|---|---|
| **SDFish `/quan-tri`** | **VẬN HÀNH HỆ THỐNG**: tài khoản, kích hoạt premium, trạng thái chăm khách (đã dùng/đã liên hệ), GHI NHẬN mã CK thu tiền | Thao tác vận hành trên tài khoản SDFish |
| **SDWork (CRM)** | **QUẢN TRỊ CÔNG TY**: sổ tiền, khách hàng, thuê bao, hạn dùng, ai tạo acc, đã thu/chưa, PHÂN CHIA DOANH THU cho đại lý | Nguồn CHÂN LÝ về tiền + khách |

**Nam chốt: KHÔNG dựng trang "dữ liệu SDWork" (thuê bao/tiền/khách/hạn dùng/ai tạo/đã thu) TRONG SDFish** — đó là việc của SDWork. SDFish chỉ **GHI NHẬN thao tác vận hành + BẮN mã tiền sang SDWork**; SDWork đối chiếu + xác nhận đã nhận.

→ **Scope IN của repo này = phần VẬN HÀNH**. Phần tiền/khách/thuê bao/doanh-thu = **OUT** (làm ở SDWork). Xem §7.

---

## 1. Vấn đề & JTBD
- **Job**: Khi bán premium SDFish cho ngư dân, **đại lý/nhân viên** muốn kích hoạt gói + theo dõi "khách đã dùng chưa, đã liên hệ chưa, đã thu tiền chưa" ngay tại chỗ, và **chủ công ty** muốn mọi khoản thu về đúng SDWork để đối soát + chia doanh thu — để không thất thoát tiền và biết đại lý nào chăm khách nào.
- **Vì sao bây giờ**: chuẩn bị đẩy iOS/Android (người dùng rời web Vercel) → phần vận hành phải gọn + tách được; tiền đang chưa có luồng đồng bộ về SDWork.
- **Đo thành công**: 100% khoản thu ghi ở SDFish có mã CK trace được sang SDWork; 0 khách premium "mồ côi" không rõ ai chăm (chi tiết §8).

## 2. User registry
| User (role/tier) | Là ai | Vòng đời | Bối cảnh chính |
|---|---|---|---|
| `admin tổng` (hàng `staff_accounts` role='owner' — 0057; env `OWNER_LOGIN` tương thích; đăng nhập bằng TÊN — 2026-10-02) | Chủ dự án — người DUY NHẤT nâng/hạ/tạo/xoá quản trị viên; thay cửa cứu hộ `ADMIN_PHONES` | power | web /quan-tri |
| `admin` (`staff_accounts` role='admin' — 0056) | Quản trị hệ thống toàn quyền — **mỗi người một tài khoản có tên** (tài khoản chung `0900000001` đang trong lộ trình gỡ, xem ops/rbac-runbook.md) | quen/power | web /quan-tri, desktop |
| `đại lý` (= `staff_accounts` role='manager', `scope` own; **đại lý tổng** = `scope` all_premium) | Bán premium + chăm khách của mình; sau nhận chia doanh thu | quen | web /quan-tri (1–2 tab), mobile/desktop |
| `nhân sự hỗ trợ` (quản lý/đại lý có **cờ riêng "hỗ trợ kỹ thuật"** — KHÔNG phải vai mới, 2026-10-26) | Nghe bà con báo quên mật khẩu / kẹt đăng nhập, gỡ giúp dù khách đó không phải khách mình | quen | web /quan-tri, điện thoại cầm tay khi nghe gọi |
| `tài khoản thử` (`customers.account_kind` = test / demo / reviewer) | Test nội bộ, demo bán hàng, tài khoản duyệt App Store | — | app SDFish; KHÔNG BAO GIỜ vào /quan-tri |
| `ngư dân` (customer basic/premium) | Người mua gói; KHÔNG vào /quan-tri | — | app SDFish |
| `SDWork` (hệ ngoài / webhook) | CRM nhận trace tiền, xác nhận đã nhận, giữ sổ tiền + chia doanh thu | — | server-to-server |
| `hệ thống` (audit logger) | Ghi vết mọi thao tác quản trị (actor tự động) | — | nền |

> `đại lý` khai = refinement của role `manager` sẵn có (đã làm việc cấp premium) — **giả định A**, xem §10.

## 3. User × Nghiệp vụ (mỗi nghiệp vụ 1 OWNER)
| # | Nghiệp vụ | Owner | Cross | Phụ thuộc | Ưu tiên |
|---|---|---|---|---|---|
| NV1 | Kích hoạt / gia hạn premium cho khách | đại lý | — | — | Must (đã có) |
| NV2 | Đánh dấu trạng thái chăm khách: "đã dùng premium?" + "đã liên hệ?" (chip trên acc) | đại lý | — | NV1 | Must |
| NV3 | Ghi nhận thu tiền: nhập MÃ CK + đánh dấu "đã thu?" trên acc | đại lý | SDWork (đối chiếu) | NV1 | Must |
| NV4 | Trace tiền → đồng bộ khoản thu sang SDWork | hệ thống | SDWork (nhận) | NV3 | Must |
| NV5 | SDWork xác nhận "đã nhận tiền" theo mã CK → cập nhật trạng thái ở SDFish | SDWork | đại lý (thấy kết quả) | NV4 | Must |
| NV6 | Phân quyền đại lý: chỉ thấy 1–2 tab (Tài khoản + chăm khách của mình) | admin | đại lý | — | Must |
| NV7 | Audit: ghi vết + xem hoạt động tài khoản quản trị | hệ thống / admin | — | — | Should |
| NV8 | Đăng nhập quản trị (tách luồng, 1 tài khoản 1 máy) | admin/đại lý | — | — | Should |
| NV9 | Người tạo khách thấy + chăm được khách mình tạo (kể cả chưa cấp premium) | đại lý | hệ thống (ghi người tạo) | — | Must (2026-10-26, CHƯA BUILD) |
| NV10 | Hỗ trợ kỹ thuật khách bất kỳ: tra đúng SĐT → đặt lại mật khẩu / đăng xuất mọi máy, bắt ghi lý do | nhân sự hỗ trợ | admin (tick cờ) · ngư dân (báo sự cố) | — | Must (2026-10-26, CHƯA BUILD) |
| NV11 | Báo cáo số liệu: đăng ký tài khoản theo ngày/tuần/tháng/năm, premium bán ra, dùng app, Kairos, đơn chợ vật tư | admin | — | — | Must (2026-10-28, ĐÃ BUILD) |

## 4. Cross-user handoff map
| Chặng | NV | Từ | → Nhận | Điều kiện | Điểm kết nếu treo |
|---|---|---|---|---|---|
| H1 | NV3→NV4 | đại lý (nhập mã CK) | hệ thống (bắn sang SDWork) | acc có mã CK + đánh dấu "đã thu" | mã chưa bắn được (SDWork lỗi) → hàng đợi retry, chip "chờ đồng bộ" |
| H2 | NV4→NV5 | hệ thống (đã bắn) | SDWork (đối chiếu mã) | SDWork nhận được mã CK | SDWork không thấy mã sau X ngày → chip "chưa đối chiếu", đại lý xem lại |
| H3 | NV5→NV2 | SDWork (xác nhận nhận) | đại lý (thấy "đã thu ✓") | SDWork trả trạng thái received | — |
| H4 | NV6→NV10 | admin (tick cờ "hỗ trợ kỹ thuật" cho một nhân sự) | nhân sự hỗ trợ | cờ bật, vai còn là quản lý | cờ tắt / bị hạ vai ⇒ mọi thao tác NV10 kế tiếp trả `403 no_permission` ngay (đọc quyền mỗi request) |
| H5 | ngư dân→NV10 | ngư dân (gọi báo quên mật khẩu / máy lạ đang đăng nhập) | nhân sự hỗ trợ | đọc được đủ SĐT đăng ký | SĐT không ra tài khoản ⇒ báo "không có tài khoản số này", khách tự đăng ký hoặc hỏi lại số |
| H6 | NV10→ngư dân | nhân sự hỗ trợ (đặt lại xong) | ngư dân (đăng nhập lại bằng `sd123456`) | đặt lại trả 200 | khách chưa có sóng ⇒ mật khẩu đã đổi, chuỗi cũ đã thu hồi; khách đăng nhập khi có sóng (đúng R9) |

> Tiền THẬT + chia doanh thu nằm ở SDWork (OUT). SDFish chỉ giữ **mã CK + cờ trạng thái vận hành** (đã liên hệ / đã thu / đã đối chiếu).

## 5. Flows (Input → Output)

### Flow NV2 — Đánh dấu trạng thái chăm khách · owner: đại lý
- **Start**: đại lý xem danh sách khách của mình ở /quan-tri
- **Input**: 1 tài khoản khách + trạng thái hiện tại 2 cờ (đã dùng premium?, đã liên hệ?)
- **Steps**: chạm chip trạng thái ngay trên dòng khách → cờ đảo giá trị → lưu ngay (ghi ai đổi + lúc nào)
- **Output**: cờ mới lưu bền + log "ai đổi lúc nào"; đại lý khác/admin thấy được
- **End**: chip phản ánh trạng thái mới
- **Cross**: —

### Flow NV3 — Ghi nhận thu tiền · owner: đại lý
- **Start**: khách đã chuyển khoản, đại lý cầm nội dung CK
- **Input**: tài khoản khách + **MÃ CK** (chuỗi mã, KHÔNG cần số tiền/nội dung dài — chỉ mã như thanh toán tên miền)
- **Steps**: nhập mã CK lên acc → đánh dấu "đã thu" → hệ thống xếp mã vào hàng bắn SDWork (NV4)
- **Output**: acc gắn mã CK + cờ "đã thu" (chưa đối chiếu); mã vào hàng đợi trace
- **End**: chip "đã thu · chờ đối chiếu"
- **Cross**: H1 → hệ thống → SDWork

### Flow NV4+NV5 — Trace tiền + xác nhận · owner: hệ thống → SDWork
- **Start**: có mã CK mới ở hàng đợi trace
- **Input**: mã CK + SĐT khách + đại lý ghi nhận
- **Steps**: bắn record {mã CK, khách, đại lý, thời điểm} sang SDWork (ký HMAC như webhook sẵn có) → SDWork tra mã trong sao kê → khớp thì trả "received" → SDFish cập nhật cờ "đã đối chiếu ✓"
- **Output**: trạng thái đồng bộ 2 đầu; SDWork có bản ghi để đối soát + chia doanh thu
- **End**: chip "đã thu · đã đối chiếu" HOẶC "chưa đối chiếu" (SDWork không thấy mã)
- **Cross**: H2, H3

### Flow NV6 — Phân quyền đại lý · owner: admin
- **Start**: admin lập/sửa tài khoản role='manager' (đại lý)
- **Input**: tài khoản + role
- **Steps**: role='manager' → khi đăng nhập /quan-tri chỉ thấy **tab được phép** (Tài khoản của khách mình + chăm khách); KHÔNG thấy tab hệ thống/dữ liệu/thông báo toàn cục
- **Output**: đại lý vào /quan-tri thấy đúng 1–2 tab, chỉ thao tác trên khách của mình
- **End**: phiên đại lý bị giới hạn phạm vi
- **Cross**: —

### Flow NV7 — Audit hoạt động quản trị · owner: hệ thống
- **Start**: bất kỳ thao tác quản trị nào (tạo/xoá acc, cấp premium, reset mk, ghi mã CK, đổi chip)
- **Input**: {actor SĐT, hành động, đối tượng, thời điểm}
- **Steps**: mọi mutation ở /api/admin/* ghi 1 dòng audit
- **Output**: sổ audit tra được theo actor + theo đối tượng
- **End**: dòng audit lưu bền
- **Cross**: —

### Flow NV9 — Người tạo thấy khách mình tạo · owner: đại lý
- **Start**: quản lý tạo một tài khoản khách cho bà con (có hay không cấp premium kèm)
- **Input**: SĐT + tên khách; người tạo = quản lý đang đăng nhập
- **Steps**: tạo thành công trên SĐT **chưa có tài khoản** ⇒ hệ thống ghi **người tạo** vào tài khoản (một lần, không đổi về sau) → danh sách khách của quản lý = khách mình **cấp premium** HỢP khách mình **tạo**
- **Output**: khách vừa tạo nằm trong danh sách của người tạo; người tạo làm được mọi việc R3 cho "khách của mình" (gồm đặt lại mật khẩu nếu có cờ `resetPassword`)
- **End**: khách có chủ chăm rõ ràng
- **Cross**: — (SĐT đã có tài khoản: KHÔNG ghi người tạo, xem R13)

### Flow NV10 — Hỗ trợ kỹ thuật khách bất kỳ · owner: nhân sự hỗ trợ
- **Start**: bà con gọi báo quên mật khẩu / nghi máy lạ đăng nhập (H5); nhân sự có cờ "hỗ trợ kỹ thuật"
- **Input**: SĐT đầy đủ khách đọc qua điện thoại + lý do hỗ trợ
- **Steps**: (1) tra **đúng SĐT** (chuẩn hoá `normalizeVnPhone`, không tra theo tên, không tra một phần) → ra tối đa 1 tài khoản với thông tin tối thiểu (SĐT, tên, có đăng nhập được không, số máy đang đăng nhập) → (2) chọn **đặt lại mật khẩu** hoặc **đăng xuất mọi máy** + ghi lý do → (3) máy chủ kiểm cờ + đối tượng (khách thật, không phải nhân sự, không phải chính mình) → thực hiện
- **Output**: khách về `sd123456` + nhắc đổi (R12) và/hoặc mọi chuỗi bị thu hồi (R9); 2 nhật ký ghi actor, vai thật, đối tượng, **lý do**; lượt tra cũng có nhật ký
- **End**: nhân sự báo khách mật khẩu `sd123456` qua điện thoại (H6)
- **Cross**: H4 (admin cấp cờ), H5, H6

## 6. Flow optimization log
| Flow | Candidate | Chọn/Loại | Lý do (rubric) |
|---|---|---|---|
| NV3 | A: SDFish giữ full sổ tiền · B: SDFish chỉ giữ MÃ CK + cờ, tiền thật ở SDWork | Chọn **B** | A phá ranh giới §0 (trộn quản trị vào vận hành); B tối thiểu cross + đúng chủ sở hữu dữ liệu (rubric: định hướng + cross tối thiểu) |
| NV3 | A: bắt nhập số tiền + nội dung · B: chỉ MÃ CK | Chọn **B** | NVHòa chốt "chỉ cần mã"; ít bước, mã đủ để SDWork tra sao kê (rubric: ít bước) |
| NV5 | A: SDFish tự đánh "đã nhận" · B: SDWork xác nhận rồi trả về | Chọn **B** | tiền là chân lý SDWork; A cho phép đánh dấu khống, sai chuẩn thu-chi (Domain: kế toán veto A) |
| NV1-máy | A: 1 máy áp CẢ admin/đại lý · B: staff được nhiều phiên (web + mobile) | Chọn **A** (D2 chốt) | Chống chia sẻ tài khoản admin > tiện đa thiết bị; đánh đổi có chủ đích (rubric: an toàn) — R6 |
| NV10 | A: mở rộng tầm nhìn mọi quản lý · B: cờ riêng "hỗ trợ kỹ thuật", chỉ 2 thao tác kỹ thuật · C (kèm): ghi người tạo | Chọn **B + C** (chủ dự án 2026-10-26) | A phá D1: đại lý thấy khách đại lý khác ⇒ giành khách, lệch chia doanh thu (Domain CSKH/bán hàng veto). B tách đúng hai vai trên cùng `manager` (bán hàng vs kỹ thuật) — cross tối thiểu. C vá lỗ "tạo mà không thấy" bất kể B |
| NV10-tra | A: duyệt cả danh sách · B: tìm theo tên/một phần SĐT · C: chỉ đúng SĐT đầy đủ | Chọn **C** | A/B lộ danh bạ khách và dò được hàng loạt (Domain bảo mật veto). Khách gọi tới luôn đọc được SĐT mình ⇒ C đủ cho việc thật, ít lộ nhất |
| NV10-thao tác | A: mọi thao tác R3 · B: chỉ đặt lại mật khẩu + đăng xuất mọi máy | Chọn **B** | Cấp premium/xoá/nhắn/ghi tiền là việc bán hàng, giữ trong "khách của mình" (R3). Hỗ trợ kỹ thuật chỉ cần gỡ đăng nhập |

## 7. Scope & Priority
- **IN (SDFish repo này)**: NV1 (có sẵn) · NV2 chip chăm khách · NV3 nhập mã CK + cờ đã thu · NV4/NV5 trace + đồng bộ SDWork · NV6 giới hạn tab đại lý · NV7 audit (Should) · NV8 đăng nhập (Should). · **NV9 ghi người tạo + NV10 hỗ trợ kỹ thuật (2026-10-26, CHƯA BUILD; NV9 cần migration 🔴 — chưa apply)**.
- **OUT (làm ở SDWork, KHÔNG dựng trong SDFish)**: trang sổ tiền/thuê bao/hạn dùng/ai tạo acc/doanh thu; **tính + chia doanh thu cho đại lý**; báo cáo tài chính. SDFish chỉ CUNG CẤP mã CK + metadata cho SDWork.
- **OUT (nền tảng)**: build iOS (cần Mac) — ưu tiên push store nhưng ngoài spec này.

## 8. Success metric
| NV | Metric | Ngưỡng |
|---|---|---|
| NV2 | khách premium không rõ trạng thái chăm | = 0 (mọi acc premium có 2 cờ) |
| NV3+NV4 | khoản "đã thu" chưa có mã CK trace | = 0 |
| NV4+NV5 | mã CK bắn SDWork thất bại không retry | = 0 (mọi mã vào hàng đợi đến khi đối chiếu) |
| NV6 | đại lý thấy dữ liệu ngoài phạm vi mình | = 0 |
| NV7 | mutation /api/admin/* không có dòng audit | = 0 |
| NV9 | khách do quản lý tạo (sau ngày build) mà người tạo không thấy trong danh sách | = 0 |
| NV10 | thao tác hỗ trợ kỹ thuật không có lý do trong nhật ký | = 0 |
| NV10 | yêu cầu đặt lại mật khẩu khách phải nhờ admin (khi ca trực có nhân sự hỗ trợ) | giảm về 0 trong 30 ngày sau build |

## 9. Rules & Invariants
| # | Rule | Edge case |
|---|---|---|
| R1 | SDFish KHÔNG lưu số tiền/sổ tiền — chỉ MÃ CK + cờ trạng thái | mã trùng → gắn mã mới nhất, giữ lịch sử mã |
| R2 | "đã đối chiếu" đặt bởi: (a) **ADMIN thủ công** sau khi xem trang biến động số dư SDWork thấy tiền vào (chốt 2026-07-30 — SDWork có sẵn trang này), HOẶC (b) webhook SDWork auto (nếu sau này SDWork bắn về). KHÔNG bao giờ tự đặt không có người/nguồn thật | mã CK = **SĐT khách** (khách ghi SĐT vào nội dung CK) → biến động số dư hiển thị SĐT, admin nhìn là khớp. Đại lý (manager) KHÔNG đối chiếu được — chỉ admin (tiền = quản trị công ty) |
| R3 | đại lý (manager) chỉ thao tác trên khách MÌNH cấp/chăm; admin toàn quyền. Siết 2026-10-02 (`managerTargetCheck`): áp cho **cấp premium, xoá, ghi cờ, ghi thu tiền, ghi chú onboarding, nhắn thông báo riêng, tạo khách trên SĐT đã có**; cấm đụng **chính mình** và **tài khoản nhân sự**; gửi thông báo TẤT CẢ = admin-only | đại lý xem acc người khác → chặn ở API (không chỉ ẩn UI); khách CHƯA ai cấp: đại lý được CẤP (nhận khách mới), không được xoá/nhắn |
| R3b | **ĐẠI LÝ TỔNG** (`staff_accounts.scope='all_premium'` — chọn ở tab Phân quyền, 2026-10-02; env `MASTER_AGENT_PHONES` giữ làm đường lùi tới khi chuyển hết, 2026-08-30) — biến thể của đại lý: `GET /api/admin/accounts` trả MỌI khách CÒN PREMIUM hiệu lực (`resolveTier`), **ẨN khách thường**. Gán qua env như `ADMIN_PHONES` (đổi env + redeploy, không migration); `isMasterAgentPhone` (`lib/admin.ts`). Vẫn phải là `role='manager'` trong DB để qua cửa staff — env chỉ MỞ RỘNG tầm nhìn, KHÔNG tự cấp quyền vào /quan-tri | env trống → không ai là đại lý tổng (mặc định an toàn); SĐT trong env nhưng không phải manager → vẫn bị cửa staff chặn; đại lý tổng KHÔNG thấy khách thường (kể cả khách mình từng chăm mà chưa premium) |
| R3c | **TẠO TÀI KHOẢN KHÔNG HẠ VAI** (2026-10-02): tạo khách (tab Tài khoản) hay tạo nhân sự (tab Phân quyền) trên SĐT ĐÃ có tài khoản ⇒ giữ vai cao hơn (khách < quản lý < quản trị viên), mật khẩu cũ giữ nguyên, bỏ trống tên giữ tên cũ; UI báo "đã có tài khoản từ trước". Hạ vai CHỈ qua nút Hạ ở tab Phân quyền (có chốt + nhật ký) | SĐT đang là quản trị viên được tạo lại làm khách để cấp premium → vẫn quản trị viên + có premium; đọc hàng cũ lỗi → 500 `lookup_failed`, không ghi |
| R4 | mọi mutation quản trị ghi audit {actor, hành động, đối tượng, giờ} | audit lỗi KHÔNG chặn thao tác, nhưng trả cờ logged=false |
| R5 | reset mật khẩu / đổi chip / cấp premium đều là mutation → vào audit + (cấp premium) log premium_grants sẵn có | — |
| R6 | 1 tài khoản = 1 máy cho KHÁCH + ĐẠI LÝ. **ADMIN được nhiều máy** (app + web cùng lúc — chủ dự án chốt 2026-08-31, migration 0053; thay D2 2026-07-30). Bù lại: **chuỗi của staff có hạn 7 ngày** (0056) | admin đổi vai/bị xoá → mọi chuỗi bị thu hồi ngay |
| R7 | **Ba trục độc lập** (2026-10-02): VAI (`staff_accounts`) · LOẠI (`customers.account_kind`) · HẠNG (`customers.tier`). Không trục nào suy ra trục khác; một luật `resolveStaffRole` cho "ai là admin" | `account_kind` ≠ real ⇒ không bao giờ là staff (kể cả có hàng staff_accounts); env cứu hộ thắng mọi thứ |
| R8 | **Hạn chuỗi**: khách thật KHÔNG hạn (bà con ngoài biển); staff 7 ngày; test 24 giờ; demo/reviewer 7 ngày | đổi loại/vai ⇒ thu hồi chuỗi để lần đăng nhập kế nhận đúng hạn |
| R9 | **Thu hồi chuỗi** khi: xoá tài khoản · đặt lại mật khẩu · đổi vai · đổi loại · admin bấm "Đăng xuất mọi máy" | thu hồi hỏng khi xoá ⇒ 503, KHÔNG xoá (xoá mà chuỗi còn sống thì máy vẫn qua cửa) |
| R11 | **ADMIN TỔNG** (chủ dự án chốt 2026-10-02): một tài khoản đăng nhập bằng tên (hàng owner trong `staff_accounts`, 0057 — trước đó env `OWNER_LOGIN`), CHỈ người này nâng/hạ/tạo/xoá quản trị viên; quản trị viên quản lý vai Quản lý. Web không hạ/xoá được admin tổng. Mật khẩu ≥12 ký tự do chủ dự án tự gõ qua script (không bao giờ `admin/admin`); phiên 12 giờ | chưa có admin tổng ⇒ luật cũ (mọi admin quản lý admin); có admin tổng ⇒ hạ quản trị viên DB cuối cùng KHÔNG còn bị chặn `last_admin` |
| R10 | Webhook SDWork **không đặt lại mật khẩu tài khoản nhân sự**; script test chỉ cấp cho tài khoản loại test, không bao giờ cho nhân sự, có ghi nhật ký | tra vai hỏng ⇒ coi là nhân sự (không đặt lại) |
| R12 | **ĐẶT LẠI MẬT KHẨU** (2026-10-06, ADR 0008): admin luôn được; quản lý chỉ khi admin tick **cờ riêng `resetPassword`** (tab Phân quyền, mặc định tắt) và chỉ trên **khách của mình** (cùng cửa R3: cấm nhân sự, cấm chính mình). Khách ⇒ `sd123456` (một nguồn `DEFAULT_CUSTOMER_PASSWORD`, cũng là ô điền sẵn khi tạo khách), nhân sự ⇒ ngẫu nhiên; app nhắc đổi (có "để sau"); thu hồi chuỗi (R9); ghi 2 nhật ký với vai thật người bấm | tra vai đối tượng hỏng ⇒ coi là nhân sự (ra mật khẩu ngẫu nhiên); quản lý không cờ ⇒ 403 `no_permission`; khách người khác ⇒ 403 `not_your_customer` |
| R13 | **NGƯỜI TẠO = CHỦ CHĂM** (2026-10-26, CHƯA BUILD): tạo tài khoản khách trên SĐT **chưa có tài khoản** ⇒ ghi người tạo (SĐT nhân sự) **một lần, không ghi đè**. "Khách của mình" ở R3/R12 = khách mình **cấp premium** (`premium_grants.granted_by`) HỢP khách mình **tạo**. Áp cả danh sách (GET) lẫn cửa thao tác (`managerTargetCheck`) — một luật, hai nơi dùng chung. Đại lý tổng (`all_premium`) thấy khách đang premium HỢP khách mình tạo | tạo trên SĐT ĐÃ có tài khoản (R3c) ⇒ KHÔNG ghi người tạo (chặn chiêu "tạo lại để nhận khách người khác"); khách từ webhook SDWork / tự đăng ký ⇒ người tạo trống (không chủ); admin tạo ⇒ vẫn ghi (tra được), admin vốn thấy hết; người tạo bị hạ vai/xoá ⇒ dấu người tạo giữ nguyên, không ai thừa hưởng tự động; ghi người tạo lỗi ⇒ huỷ cả lần tạo (500), không để khách mồ côi im lặng |
| R14 | **HỖ TRỢ KỸ THUẬT** (2026-10-26, CHƯA BUILD): **cờ riêng** trong jsonb `permissions` (cạnh `resetPassword`), admin tick từng quản lý, **mặc định TẮT**, đọc hỏng ⇒ tắt; admin/admin tổng ngầm có. Có cờ được: (a) **tra đúng SĐT** — khớp nguyên số sau chuẩn hoá, trả ≤1 tài khoản, chỉ SĐT · tên · có đăng nhập được · số máy đang đăng nhập (KHÔNG hạng, hạn, tiền, cờ chăm, người chăm, ghi chú); (b) **đặt lại mật khẩu** (luật mật khẩu R12) và (c) **đăng xuất mọi máy** (R9) cho khách tra được. **Bắt buộc lý do** 10–500 ký tự sau khi bỏ khoảng trắng, ghi vào CẢ hai nhật ký. Mỗi lượt tra cũng ghi nhật ký (ai tra số nào, lúc nào). Trần **30 lượt tra / giờ / nhân sự** ⇒ quá trần `429`. KHÔNG mở thêm gì khác: cấp premium, xoá, nhắn, ghi tiền, cờ chăm vẫn theo R3 | đối tượng là nhân sự ⇒ `403 staff_target`; chính mình ⇒ `403 self`; tài khoản loại test/demo/reviewer ⇒ `403 not_real_account` (đặt lại phá tài khoản duyệt App Store); thiếu/ngắn lý do ⇒ `400 reason_required`, không đổi gì; SĐT không có tài khoản ⇒ `404 not_found` (vẫn ghi lượt tra); tra một phần số ⇒ 0 kết quả; không có cờ ⇒ `403 no_permission`; tra vai đối tượng hỏng ⇒ coi là nhân sự (chặn) |
| R15 | **BÁO CÁO CHỈ ĐẾM KHÁCH THẬT, CHỈ ADMIN XEM** (2026-10-28): loại `account_kind` ≠ real và nhân sự (customers.role ≠ customer, `staff_accounts`); tài khoản tự đăng ký chưa có hàng customers vẫn tính; chia kỳ theo giờ VN (tuần bắt đầu thứ Hai); KHÔNG số tiền (OUT §7 — SDWork) | đọc danh sách loại trừ hỏng ⇒ không trả số nào (500), vì số lẫn tài khoản thử trông như đúng; một nguồn khác hỏng ⇒ chỉ thẻ đó trống + băng cảnh báo; quản lý gọi API ⇒ 403 `admin_only` |

## 10. Assumptions & Open decisions (elicitation)
**Giả định an toàn đã chọn (fail-closed):**
- **A**: `đại lý` = role `manager` sẵn có (đã cấp premium). Không tạo role mới.
- **B**: NV3 chỉ lưu mã CK + cờ; số tiền/đối soát ở SDWork.
- **C**: premium kích hoạt ĐỘC LẬP với thu tiền (đại lý có thể kích trước, thu sau) — cờ "đã thu" theo dõi riêng, KHÔNG chặn kích hoạt.
- **E** (R13): KHÔNG điền ngược người tạo cho khách cũ — khách tạo trước ngày build giữ trống, vẫn theo luật cấp premium như cũ. Muốn điền ngược từ `admin_activity_log` (`account.create`) là quyết định riêng, phải đối chiếu tay vì nhật ký không phải nguồn sở hữu.
- **F** (R14): ngưỡng lý do 10 ký tự và trần 30 lượt tra/giờ là mặc định an toàn tự chọn — chủ dự án chỉnh được, không đổi luật.
- **G** (R14): `revoke-sessions` hôm nay CHỈ admin; R14 mở thêm cho nhân sự có cờ, CHỈ trên khách thật.
- **H** (R13): lưu người tạo cần chỗ chứa mới trên tài khoản khách ⇒ **migration 🔴**, chưa viết, chưa apply; build phải hỏi chủ dự án trước khi apply (CLAUDE.md pre-flight).
- **I** (R15, 2026-10-28 — chủ dự án ĐÃ CHỐT giữ admin-only): tab Báo cáo **admin-only**. Quản lý theo R3 chỉ thấy khách mình, số toàn hệ thống là số kinh doanh. Muốn mở cho quản lý thì phải lọc theo "khách của mình" ở API, không chỉ thêm vào `MANAGER_TABS`.
- **J** (R15): "đăng ký" = tài khoản đăng nhập được tạo (auth.users) — gồm tự đăng ký, nhân viên tạo, SDWork gửi sang. Bảng `customers` không có cột ngày tạo nên không dùng.
- **K** (R15): "mở app" là ảnh chụp từ mốc mở gần nhất (DB chỉ giữ mốc mới nhất), không vẽ được chuỗi theo ngày trong quá khứ. Muốn có DAU theo ngày thì cần bảng nhịp mở app (migration 🔴, chưa làm).

**Đã chốt (2026-07-30):**
- **D1 → 1 khu "Khách của tôi"**: đại lý chỉ thấy DANH SÁCH KHÁCH của mình (scoped, chặn ở API — R3) gồm: kích/gia hạn premium + 2 cờ (đã dùng / đã liên hệ) + nhập mã CK + cờ đã thu. KHÔNG có Thuyền viên/Sản phẩm/Thông báo/Dữ liệu/Hệ thống. Chừa khu thứ 2 cho sau (bảng doanh thu — nhưng số liệu đó ở SDWork). Lý do: toàn bộ việc đại lý xoay quanh khách của họ; các khu kia là việc admin.
- **D2 → GIỮ NGUYÊN 1 tài khoản 1 máy CHO CẢ staff** (chủ dự án chốt). Admin/đại lý đăng nhập máy mới → đá phiên máy cũ (gồm web quản trị). Hệ quả: staff dùng 1 thiết bị 1 lúc; đổi máy phải đăng nhập lại. Đánh đổi: chống chia sẻ tài khoản admin (bảo mật) > tiện đa thiết bị. → thành **R6**.
- **D3 → WEBHOOK (SDWork→SDFish)**: tái dùng webhook inbound sẵn có (`/api/sdwork/webhook`, HMAC verify) — thêm event `payment_reconciled`. SDWork đối chiếu sao kê xong bắn về, SDFish set trạng-thái-đối-chiếu. Tức thì + ít hạ tầng mới. Poll bị loại (SDFish chưa có đường outbound-query; trễ). NV5 dùng cơ chế này.

> NV4 (bắn mã CK sang SDWork) là outbound MỚI của SDFish — KHÁC luồng password-sync đã bỏ (2026-07-30 SDWork-master); trace tiền là mục đích chính đáng riêng.

**Đã chốt (2026-10-26):**
- **D4 → B + C** (chủ dự án): thêm cờ "hỗ trợ kỹ thuật" (tra đúng SĐT, chỉ đặt lại mật khẩu + đăng xuất mọi máy, bắt ghi lý do) VÀ ghi người tạo khi tạo khách. Thu hẹp một phần ADR 0008 §4 ("chỉ khách của mình") cho nhân sự có cờ — ADR 0008 giữ nguyên cho cờ `resetPassword`.

---

## 11. Acceptance Criteria — ORACLE

### AC-1 — Đánh dấu khách đã được liên hệ · Maps to: NV2 · Test: e2e
- **Given** đại lý đã đăng nhập, có 1 khách premium với trạng thái đã-liên-hệ = false
- **When** đại lý đặt trạng thái đã-liên-hệ của khách đó thành true
- **Then** trạng thái đã-liên-hệ = true, lưu bền qua tải lại, kèm bản ghi ai đổi + thời điểm
- **Assert**: `customer.contacted==true` sau reload && `count(audit where action=='mark_contacted' and target==phone)` tăng đúng `1`

### AC-2 — Hai cờ trạng thái độc lập nhau · Maps to: NV2 · Test: unit
- **Given** khách có đã-dùng-premium = false và đã-liên-hệ = false
- **When** đại lý đặt đã-liên-hệ = true
- **Then** đã-dùng-premium KHÔNG đổi
- **Assert**: `customer.used_premium==false && customer.contacted==true`

### AC-3 — Ghi nhận thu tiền bằng mã CK · Maps to: NV3 · Test: e2e
- **Given** đại lý mở 1 khách đã kích hoạt premium
- **When** đại lý nhập mã chuyển khoản `"FT25073012345"` và đặt trạng thái đã-thu = true
- **Then** khách gắn đúng mã đó, đã-thu = true, trạng-thái-đối-chiếu = chờ, mã được xếp vào hàng đợi đồng bộ
- **Assert**: `payment.code=="FT25073012345" && payment.paid==true && payment.reconciled_status=="pending" && count(trace_queue)` tăng đúng `1`

### AC-4 — Không lưu số tiền, chỉ mã · Maps to: NV3 · Test: integration
- **Given** hệ ghi nhận thu tiền ở SDFish
- **When** đại lý ghi nhận 1 khoản thu
- **Then** bản ghi chỉ có mã, KHÔNG có số tiền hay nội dung dài (ranh giới R1)
- **Assert**: bản ghi thu tiền có field `code` và `count(field=='amount')==0`

### AC-5 — Trace bắn SDWork có chữ ký HMAC · Maps to: NV4 · Test: integration
- **Given** 1 mã ở hàng đợi đồng bộ
- **When** tiến trình đồng bộ chạy
- **Then** gửi bản ghi {code, phone, agent, ts} sang SDWork kèm chữ ký HMAC hợp lệ; mã chỉ rời hàng đợi khi SDWork nhận thành công
- **Assert**: request body có đúng `4` field && `signature==HMAC(body,secret)` && mã rời hàng đợi chỉ khi HTTP `>=200 && <300`

### AC-6 — SDWork lỗi thì giữ mã, thử lại · Maps to: NV4 · Test: integration
- **Given** SDWork trả HTTP 5xx
- **When** tiến trình đồng bộ bắn mã
- **Then** mã GIỮ trong hàng đợi để thử lại, trạng-thái-đối-chiếu vẫn chờ
- **Assert**: sau lỗi `count(trace_queue)` không giảm && `payment.reconciled_status=="pending"`

### AC-7 — Chỉ SDWork đặt trạng thái đã-đối-chiếu · Maps to: NV5 · Test: integration
- **Given** mã đã bắn, SDWork tra sao kê thấy khớp
- **When** SDWork xác nhận đã nhận (received)
- **Then** SDFish đặt trạng-thái-đối-chiếu = đã-đối-chiếu; không đường nội bộ nào của SDFish tự đặt giá trị này
- **Assert**: chỉ tín hiệu từ SDWork mới set `reconciled_status=="reconciled"` && `count(code path nội bộ set reconciled)==0`

### AC-8 — Đại lý bị giới hạn phạm vi ở tầng API · Maps to: NV6 · Test: e2e
- **Given** tài khoản role='manager' đã đăng nhập
- **When** gọi API đọc hoặc sửa tài khoản của đại lý khác
- **Then** bị chặn ở tầng máy chủ, không chỉ ẩn hiển thị
- **Assert**: GET/PATCH ngoài phạm vi trả HTTP `403` && số khu chức năng đại lý truy cập được `<=2`

### AC-9 — Mọi thao tác quản trị có 1 dòng audit · Maps to: NV7 · Test: integration
- **Given** admin thực hiện 1 thao tác thay đổi dữ liệu ở /api/admin/* (tạo/xoá/cấp premium/reset mật khẩu/đổi trạng thái/ghi mã)
- **When** thao tác thành công
- **Then** sinh đúng 1 dòng audit {actor, action, target, thời điểm}
- **Assert**: mỗi mutation làm `count(audit)` tăng đúng `1` && dòng có `actor!=null && action!=null && ts!=null`

### AC-10 — Staff cũng bị 1 tài khoản 1 máy · Maps to: NV8 · Test: e2e
- **Given** tài khoản admin hoặc đại lý đang có phiên hợp lệ trên máy A (kể cả phiên web quản trị)
- **When** cùng tài khoản đó đăng nhập trên máy B
- **Then** phiên máy A bị thu hồi; thao tác kế ở máy A bị đưa về đăng nhập (R6 — không miễn staff)
- **Assert**: sau đăng nhập máy B, request tiếp theo của máy A trả HTTP `401` && `count(phiên hợp lệ của tài khoản)==1`

### AC-11 — Người tạo thấy khách mình vừa tạo dù chưa cấp premium · Maps to: NV9 · Test: integration
- **Given** quản lý Q (tầm `own`) chưa từng cấp premium cho SĐT K; K chưa có tài khoản
- **When** Q tạo tài khoản K không kèm premium, rồi đọc danh sách khách
- **Then** K có trong danh sách của Q; quản lý khác không thấy K
- **Assert**: `GET /api/admin/accounts` của Q chứa K `==1` lần && của quản lý Q2 chứa K `==0` lần

### AC-12 — Tạo lại trên SĐT đã có không chiếm khách người khác · Maps to: NV9 · Test: integration
- **Given** K đã có tài khoản, người tạo là Q2 (hoặc trống)
- **When** quản lý Q tạo lại tài khoản trên SĐT K
- **Then** người tạo của K không đổi; Q vẫn không thấy và không thao tác được K
- **Assert**: người tạo K sau thao tác `==` trước thao tác && đặt lại mật khẩu K bởi Q (có `resetPassword`) trả HTTP `403` `not_your_customer`

### AC-13 — Người tạo đặt lại được mật khẩu khách mình tạo · Maps to: NV9 · Test: integration
- **Given** Q có cờ `resetPassword`, K do Q tạo, chưa ai cấp premium
- **When** Q đặt lại mật khẩu K
- **Then** thành công theo R12
- **Assert**: HTTP `200` && mật khẩu tạm `== "sd123456"` && `count(chuỗi sống của K)==0`

### AC-14 — Nhân sự hỗ trợ đặt lại mật khẩu khách người khác, có lý do · Maps to: NV10 · Test: integration
- **Given** S có cờ "hỗ trợ kỹ thuật"; K là khách thật do Q2 cấp premium
- **When** S tra đúng SĐT K rồi đặt lại mật khẩu kèm lý do "khách quên mật khẩu, gọi 9h"
- **Then** đặt lại thành công; mỗi nhật ký có lý do
- **Assert**: HTTP `200` && `count(admin_audit mới)==1` && `count(admin_activity_log mới có detail.reason)==1`

### AC-15 — Thiếu lý do thì không đổi gì · Maps to: NV10 · Test: unit
- **Given** S có cờ hỗ trợ
- **When** đặt lại mật khẩu / đăng xuất mọi máy với lý do rỗng hoặc dưới 10 ký tự sau khi bỏ khoảng trắng
- **Then** bị từ chối, mật khẩu và chuỗi giữ nguyên
- **Assert**: HTTP `400` `reason_required` && số chuỗi sống của K không đổi (`==` trước)

### AC-16 — Tra chỉ khớp nguyên SĐT, trả thông tin tối thiểu · Maps to: NV10 · Test: integration
- **Given** S có cờ hỗ trợ; tồn tại K = 0912345678
- **When** S tra "0912345678", "+84912345678", rồi "091234"
- **Then** hai lần đầu ra đúng K, lần ba không ra gì; kết quả không có hạng/hạn/tiền/người chăm
- **Assert**: số kết quả lần lượt `1, 1, 0` && khoá trả về `⊆ {phone, name, canLogin, activeDevices}`

### AC-17 — Cờ hỗ trợ không mở việc bán hàng · Maps to: NV10 · Test: integration
- **Given** S có cờ hỗ trợ (không phải người cấp/tạo K)
- **When** S gọi cấp premium, xoá, nhắn riêng, ghi thu tiền, đổi cờ chăm cho K
- **Then** tất cả bị chặn như R3
- **Assert**: cả `5` lệnh trả HTTP `403` `not_your_customer`

### AC-18 — Không đụng nhân sự, chính mình, tài khoản thử · Maps to: NV10 · Test: unit
- **Given** S có cờ hỗ trợ
- **When** S đặt lại mật khẩu cho một quản lý khác, cho chính S, cho tài khoản loại reviewer
- **Then** cả ba bị chặn
- **Assert**: mã lỗi lần lượt `staff_target`, `self`, `not_real_account` với HTTP `403`

### AC-19 — Không cờ hoặc vượt trần tra thì bị chặn · Maps to: NV10 · Test: integration
- **Given** quản lý Q không có cờ hỗ trợ; nhân sự S có cờ đã tra 30 lần trong 60 phút
- **When** Q tra một SĐT; S tra lần thứ 31
- **Then** Q bị từ chối quyền; S bị từ chối vì quá trần; mỗi lượt tra của S vẫn có nhật ký
- **Assert**: Q nhận HTTP `403` `no_permission` && S nhận HTTP `429` && `count(nhật ký lượt tra của S)>=30`

---

## History
- 2026-10-28 — **BUILD NV11 Báo cáo** (R15, giả định I/J/K): tab "Báo cáo" (nhóm Tổng quan, admin-only) — đăng ký/premium bán ra/Kairos/đơn chợ theo Ngày·Tuần·Tháng·Năm + ảnh chụp dùng app + top người cấp; chỉ khách thật; không migration.
- 2026-10-26 — **SPEC NV9 + NV10 (CHƯA BUILD)**: phân tích BA cho thấy "khách của mình" chỉ tính người CẤP premium ⇒ tạo khách không kèm premium thì người tạo mất dấu; quản lý không hỗ trợ được khách người khác. Chủ dự án chốt **B + C** (D4): R13 người tạo = chủ chăm (ghi một lần, không ghi đè trên SĐT đã có) + R14 cờ "hỗ trợ kỹ thuật" (tra đúng SĐT, chỉ đặt lại mật khẩu + đăng xuất mọi máy, bắt lý do, trần 30 lượt tra/giờ). +AC-11..19. R13 cần migration 🔴 (chưa viết/apply).
- 2026-10-06 — **R12 đặt lại mật khẩu** (ADR 0008): quyền tick riêng từng quản lý (chỉ khách mình), khách về `sd123456`, nhân sự ngẫu nhiên; ô mật khẩu khi tạo khách điền sẵn `sd123456`. Không migration (cờ trong jsonb 0056).
- 2026-10-07 — Gửi thông báo báo lỗi theo mã (403 = khoá VAPID lệch, không xoá đăng ký); Cấu hình ứng dụng chặn lưu cặp VAPID lệch (409), đổi cặp phải dán cả hai ô.
- 2026-07-30 — Tạo từ hội thoại team (Long/Nam/Hòa). Chốt ranh giới SDFish vận hành vs SDWork quản trị tiền; scope IN/OUT; NV1–NV8; AC-1..10.
- 2026-07-30 — Chốt D1 (đại lý 1 khu "Khách của tôi", scoped), D2 (staff cũng 1-máy — R6), D3 (webhook SDWork→SDFish, tái dùng inbound). +AC-10.
- 2026-07-30 — **BUILD đợt 1**: NV2 (2 cờ chăm khách premium_used/contacted, migration 0025, chip bấm đổi ở /quan-tri) + NV6 scope đại lý (GET accounts lọc theo premium_grants.granted_by, PATCH set_flag chặn khách người khác). AC-1/2/8 có mã.
- 2026-07-30 — **BUILD đợt 2 (NV3)**: bảng `payments` (0026, MÃ CK + reconciled_status, KHÔNG số tiền), PATCH `action='record_payment'` (staff, manager scoped R3), GET đính trạng thái thu mới nhất, UI chip trạng thái thu + dialog nhập mã CK ở /quan-tri. AC-3/4 có mã.
- 2026-07-30 — **BUILD đợt 3 (NV4/NV5/NV7)**: migration 0027 (payments.traced_at + bảng admin_audit). NV4 cron `/api/cron/trace-payments` bắn mã CK sang SDWORK_TRACE_URL ký HMAC (AC-5/6). NV5 webhook `/api/sdwork/webhook` xử event payment/reconciled → set reconciled (AC-7). NV7 writeAudit mọi mutation accounts route + GET /api/admin/audit + tab "Nhật ký" (AC-9). **SDFish-side XONG; cần SDWork**: (a) dựng endpoint nhận trace ở SDWORK_TRACE_URL (verify HMAC, tra sao kê theo mã); (b) bắn webhook event {entity:'payment',action:'reconciled',ref:code} về SDFish khi đã nhận. Xem contract SDWork. **CÒN**: instrument audit cho các route admin KHÁC (crew-reports/products/…) — đợt sau nếu cần AC-9 phủ toàn /api/admin/*.
- 2026-07-30 — **ĐỐI CHIẾU THỦ CÔNG (R2 nới)**: SDWork có sẵn trang biến động số dư → KHÔNG cần SDWork dev. Chốt: mã CK = **SĐT khách**; admin xem biến động số dư SDWork thấy tiền vào → bấm nút **"✓ Đối chiếu"** trên /quan-tri (PATCH `action='reconcile_payment'`, chỉ admin, audit) → set reconciled. Webhook auto (NV5) GIỮ cho sau. Dialog ghi thu tiền prefill mã = SĐT khách.
