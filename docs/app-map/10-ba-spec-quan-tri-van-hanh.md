# 10 — ba-spec: Web quản trị vận hành SDFish + ranh giới SDWork

> Load khi: task chạm /quan-tri (vận hành), phân quyền đại lý, trạng thái premium (đã dùng/đã liên hệ), thu tiền + trace tiền đồng bộ SDWork, audit hoạt động admin, luồng đăng nhập admin.
covers: src/app/quan-tri, src/app/api/admin, src/lib/admin-auth.ts, src/lib/admin.ts
last_verified: 2026-08-01
ttl_days: 90
<!-- re-verified: 2026-08-01 — SYNC BASE (Long-Forfun→sdvico). Vùng vận hành nhận thêm mô hình quyền của base, KHÔNG mất năng lực sdvico: (admin-auth.ts) `requireStaff` nay theo staff-permissions — admin (env HOẶC role='admin') permissions=null toàn quyền, manager tra bảng `customers.staff_permissions` (jsonb, migration 0028 — ĐÃ ĐỔI SỐ từ 0017 base) theo TAB×HÀNH ĐỘNG, cột chưa apply thì preset mặc định; `requirePermission(tab,action)` + `requireAdmin` giữ nguyên. (admin.ts base) nguồn admin KÉP env+DB: `mergeAdmins`/`checkDemoteAdmin`/`checkSetRole` (chặn self/env_admin/last_admin, NÂNG luôn được = đường di cư env→DB). (api/admin) thêm route `/api/admin/activity` + `/api/admin/staff`; `accounts` GHI **2 nhật ký song song** — `writeAudit`→bảng `admin_audit` (NV7 sdvico, 0027) VÀ `logActivity`→`admin_activity_log` (base, 0030) — cùng cột onboarding (0029) + đo-dùng-app (0031). (quan-tri) thêm tab Phân quyền (PermissionsTab) + Nhật ký (ActivityLogTab base) + chip onboarding; GIỮ NV2/NV3 chip chăm khách + ghi mã CK. NV4/NV5/NV7 (H2/H3/§8) KHÔNG đổi hành vi. ⚠️ Migration 0028-0031 CHƯA apply prod (ref znzgugvfhgmiszqgjulk). -->
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
| `admin` (env HOẶC customers.role='admin') | Quản trị hệ thống toàn quyền (tài khoản chung `0900000001`) | quen/power | web /quan-tri, desktop |
| `đại lý` (= role `manager` trong DB) | Bán premium + chăm khách của mình; sau nhận chia doanh thu | quen | web /quan-tri (1–2 tab), mobile/desktop |
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

## 4. Cross-user handoff map
| Chặng | NV | Từ | → Nhận | Điều kiện | Điểm kết nếu treo |
|---|---|---|---|---|---|
| H1 | NV3→NV4 | đại lý (nhập mã CK) | hệ thống (bắn sang SDWork) | acc có mã CK + đánh dấu "đã thu" | mã chưa bắn được (SDWork lỗi) → hàng đợi retry, chip "chờ đồng bộ" |
| H2 | NV4→NV5 | hệ thống (đã bắn) | SDWork (đối chiếu mã) | SDWork nhận được mã CK | SDWork không thấy mã sau X ngày → chip "chưa đối chiếu", đại lý xem lại |
| H3 | NV5→NV2 | SDWork (xác nhận nhận) | đại lý (thấy "đã thu ✓") | SDWork trả trạng thái received | — |

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

## 6. Flow optimization log
| Flow | Candidate | Chọn/Loại | Lý do (rubric) |
|---|---|---|---|
| NV3 | A: SDFish giữ full sổ tiền · B: SDFish chỉ giữ MÃ CK + cờ, tiền thật ở SDWork | Chọn **B** | A phá ranh giới §0 (trộn quản trị vào vận hành); B tối thiểu cross + đúng chủ sở hữu dữ liệu (rubric: định hướng + cross tối thiểu) |
| NV3 | A: bắt nhập số tiền + nội dung · B: chỉ MÃ CK | Chọn **B** | NVHòa chốt "chỉ cần mã"; ít bước, mã đủ để SDWork tra sao kê (rubric: ít bước) |
| NV5 | A: SDFish tự đánh "đã nhận" · B: SDWork xác nhận rồi trả về | Chọn **B** | tiền là chân lý SDWork; A cho phép đánh dấu khống, sai chuẩn thu-chi (Domain: kế toán veto A) |
| NV1-máy | A: 1 máy áp CẢ admin/đại lý · B: staff được nhiều phiên (web + mobile) | Chọn **A** (D2 chốt) | Chống chia sẻ tài khoản admin > tiện đa thiết bị; đánh đổi có chủ đích (rubric: an toàn) — R6 |

## 7. Scope & Priority
- **IN (SDFish repo này)**: NV1 (có sẵn) · NV2 chip chăm khách · NV3 nhập mã CK + cờ đã thu · NV4/NV5 trace + đồng bộ SDWork · NV6 giới hạn tab đại lý · NV7 audit (Should) · NV8 đăng nhập (Should).
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

## 9. Rules & Invariants
| # | Rule | Edge case |
|---|---|---|
| R1 | SDFish KHÔNG lưu số tiền/sổ tiền — chỉ MÃ CK + cờ trạng thái | mã trùng → gắn mã mới nhất, giữ lịch sử mã |
| R2 | "đã đối chiếu" đặt bởi: (a) **ADMIN thủ công** sau khi xem trang biến động số dư SDWork thấy tiền vào (chốt 2026-07-30 — SDWork có sẵn trang này), HOẶC (b) webhook SDWork auto (nếu sau này SDWork bắn về). KHÔNG bao giờ tự đặt không có người/nguồn thật | mã CK = **SĐT khách** (khách ghi SĐT vào nội dung CK) → biến động số dư hiển thị SĐT, admin nhìn là khớp. Đại lý (manager) KHÔNG đối chiếu được — chỉ admin (tiền = quản trị công ty) |
| R3 | đại lý (manager) chỉ thao tác trên khách MÌNH cấp/chăm; admin toàn quyền | đại lý xem acc người khác → chặn ở API (không chỉ ẩn UI) |
| R4 | mọi mutation quản trị ghi audit {actor, hành động, đối tượng, giờ} | audit lỗi KHÔNG chặn thao tác, nhưng trả cờ logged=false |
| R5 | reset mật khẩu / đổi chip / cấp premium đều là mutation → vào audit + (cấp premium) log premium_grants sẵn có | — |
| R6 | 1 tài khoản = 1 máy áp CHO CẢ staff (admin/đại lý) — đăng nhập máy mới thu hồi phiên mọi máy khác kể cả web quản trị (D2 chốt 2026-07-30) | staff đổi máy → đăng nhập lại; chấp nhận để chống chia sẻ acc admin |

## 10. Assumptions & Open decisions (elicitation)
**Giả định an toàn đã chọn (fail-closed):**
- **A**: `đại lý` = role `manager` sẵn có (đã cấp premium). Không tạo role mới.
- **B**: NV3 chỉ lưu mã CK + cờ; số tiền/đối soát ở SDWork.
- **C**: premium kích hoạt ĐỘC LẬP với thu tiền (đại lý có thể kích trước, thu sau) — cờ "đã thu" theo dõi riêng, KHÔNG chặn kích hoạt.

**Đã chốt (2026-07-30):**
- **D1 → 1 khu "Khách của tôi"**: đại lý chỉ thấy DANH SÁCH KHÁCH của mình (scoped, chặn ở API — R3) gồm: kích/gia hạn premium + 2 cờ (đã dùng / đã liên hệ) + nhập mã CK + cờ đã thu. KHÔNG có Thuyền viên/Sản phẩm/Thông báo/Dữ liệu/Hệ thống. Chừa khu thứ 2 cho sau (bảng doanh thu — nhưng số liệu đó ở SDWork). Lý do: toàn bộ việc đại lý xoay quanh khách của họ; các khu kia là việc admin.
- **D2 → GIỮ NGUYÊN 1 tài khoản 1 máy CHO CẢ staff** (chủ dự án chốt). Admin/đại lý đăng nhập máy mới → đá phiên máy cũ (gồm web quản trị). Hệ quả: staff dùng 1 thiết bị 1 lúc; đổi máy phải đăng nhập lại. Đánh đổi: chống chia sẻ tài khoản admin (bảo mật) > tiện đa thiết bị. → thành **R6**.
- **D3 → WEBHOOK (SDWork→SDFish)**: tái dùng webhook inbound sẵn có (`/api/sdwork/webhook`, HMAC verify) — thêm event `payment_reconciled`. SDWork đối chiếu sao kê xong bắn về, SDFish set trạng-thái-đối-chiếu. Tức thì + ít hạ tầng mới. Poll bị loại (SDFish chưa có đường outbound-query; trễ). NV5 dùng cơ chế này.

> NV4 (bắn mã CK sang SDWork) là outbound MỚI của SDFish — KHÁC luồng password-sync đã bỏ (2026-07-30 SDWork-master); trace tiền là mục đích chính đáng riêng.

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

---

## History
- 2026-07-30 — Tạo từ hội thoại team (Long/Nam/Hòa). Chốt ranh giới SDFish vận hành vs SDWork quản trị tiền; scope IN/OUT; NV1–NV8; AC-1..10.
- 2026-07-30 — Chốt D1 (đại lý 1 khu "Khách của tôi", scoped), D2 (staff cũng 1-máy — R6), D3 (webhook SDWork→SDFish, tái dùng inbound). +AC-10.
- 2026-07-30 — **BUILD đợt 1**: NV2 (2 cờ chăm khách premium_used/contacted, migration 0025, chip bấm đổi ở /quan-tri) + NV6 scope đại lý (GET accounts lọc theo premium_grants.granted_by, PATCH set_flag chặn khách người khác). AC-1/2/8 có mã.
- 2026-07-30 — **BUILD đợt 2 (NV3)**: bảng `payments` (0026, MÃ CK + reconciled_status, KHÔNG số tiền), PATCH `action='record_payment'` (staff, manager scoped R3), GET đính trạng thái thu mới nhất, UI chip trạng thái thu + dialog nhập mã CK ở /quan-tri. AC-3/4 có mã.
- 2026-07-30 — **BUILD đợt 3 (NV4/NV5/NV7)**: migration 0027 (payments.traced_at + bảng admin_audit). NV4 cron `/api/cron/trace-payments` bắn mã CK sang SDWORK_TRACE_URL ký HMAC (AC-5/6). NV5 webhook `/api/sdwork/webhook` xử event payment/reconciled → set reconciled (AC-7). NV7 writeAudit mọi mutation accounts route + GET /api/admin/audit + tab "Nhật ký" (AC-9). **SDFish-side XONG; cần SDWork**: (a) dựng endpoint nhận trace ở SDWORK_TRACE_URL (verify HMAC, tra sao kê theo mã); (b) bắn webhook event {entity:'payment',action:'reconciled',ref:code} về SDFish khi đã nhận. Xem contract SDWork. **CÒN**: instrument audit cho các route admin KHÁC (crew-reports/products/…) — đợt sau nếu cần AC-9 phủ toàn /api/admin/*.
- 2026-07-30 — **ĐỐI CHIẾU THỦ CÔNG (R2 nới)**: SDWork có sẵn trang biến động số dư → KHÔNG cần SDWork dev. Chốt: mã CK = **SĐT khách**; admin xem biến động số dư SDWork thấy tiền vào → bấm nút **"✓ Đối chiếu"** trên /quan-tri (PATCH `action='reconcile_payment'`, chỉ admin, audit) → set reconciled. Webhook auto (NV5) GIỮ cho sau. Dialog ghi thu tiền prefill mã = SĐT khách.
