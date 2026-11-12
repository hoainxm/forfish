# 20 — ba-spec: Dùng thử premium theo ngày (3–5 ngày)

> Load khi: task chạm việc cấp premium **dùng thử** (kỳ hạn tính bằng NGÀY), luật "mỗi khách một lần", lượt dùng thử trong nhật ký cấp `premium_grants`, báo cáo dùng thử → mua, hoặc chữ "đang dùng thử" phía khách. Việc cấp/gia hạn gói trả tiền (tính THÁNG) vẫn ở [10-ba-spec §NV1](10-ba-spec-quan-tri-van-hanh.md).
covers: src/lib/tier.ts, src/app/api/admin/accounts, src/components/admin/tab-tai-khoan.tsx, src/components/admin/tab-bao-cao.tsx, src/lib/admin-reports.ts, src/app/api/me/heartbeat, src/app/api/admin/reports
last_verified: 2026-11-12
ttl_days: 90
<!-- re-verified: 2026-11-12c — 0088 ✅ ĐÃ APPLY prod 2026-11-12 (Supabase MCP) — cấp dùng thử chạy thật; AC integration (2, 4, 5, 6, 8, 11, 12, 13) vẫn chờ chạy tay trên /quan-tri. -->
<!-- re-verified: 2026-11-12b — ĐÃ BUILD (code khớp spec; 0088 🔴 CHƯA APPLY prod — chưa apply thì cấp dùng thử trả 503 `trial_unavailable`, không mở premium). Luật thuần ở `lib/tier.ts` (`trialUntil`, `parseTrialDays`, `trialDenial`, `premiumKindFromGrants`, `paidGrantAction`) + `lib/admin-reports.ts` (`trialStats`); test `premium-dung-thu.test.ts` phủ AC-1, 3, 4/5 (luật), 7, 9 (luật + hạn), 10, 13 (câu hạng), 14. AC integration (2, 4, 5, 6, 8, 11, 12, 13 phía máy chủ) CHƯA có test tự động — repo chưa có khung giả Supabase cho route; chạy tay sau khi apply 0088. Thêm so với bản spec: chỉ mục duy nhất 0088 chặn hai lượt bấm cùng lúc (R4); UI chỉ dựng sẵn 3/5 ngày, khoảng 1–14 là luật máy chủ. -->
<!-- SPEC MỚI 2026-11-12 — CHƯA BUILD. Đối chiếu code `main` 3f829c7f: kỳ hạn nhỏ nhất hôm nay = `PREMIUM_TERM_MIN_MONTHS = 1` (tier.ts), gói dựng sẵn 12/18 tháng, `nextPremiumUntil` cộng tháng lịch; `premium_grants.action` chỉ nhận activate/renew/downgrade (0007); `isSaleGrant` đếm activate+renew là LƯỢT BÁN. `last_verified` giữ ngày rà, tới khi code khớp mới đổi nghĩa thành "đã khớp code". -->

> **Mục đích**: oracle HÀNH VI cho "cho bà con dùng thử premium vài ngày". KHÔNG mô tả giao diện (→ 07-design-spec qua ui-design-logic), KHÔNG viết code.

---

## 1. Vấn đề & JTBD

- **Hôm nay**: nhân sự muốn cho bà con xem thử dự báo cá / dẫn đường trước khi mua chỉ có cách cấp **tối thiểu 1 tháng** (`PREMIUM_TERM_MIN_MONTHS = 1`). Một tháng là quá dài để "thử" — gần bằng cho không một phần gói, và lượt đó bị đếm là **lượt bán** (`isSaleGrant`), làm sai báo cáo bán + số "đang quản" của người cấp (đại lý sau này chia doanh thu theo số đó — 10 §2).
- **JTBD nhân sự**: *"Khi bà con còn lưỡng lự, tôi muốn mở premium cho họ 3–5 ngày để họ ra một chuyến biển thấy dự báo đúng, rồi tôi gọi lại chốt mua — mà không bị tính là đã bán, và không ai lợi dụng cho mãi được."*
- **JTBD chủ tàu**: *"Tôi muốn biết mình đang dùng thử, tới ngày nào thì hết, để kịp mua nếu thấy được."*

## 2. User registry

| User | Là ai | Bối cảnh |
|---|---|---|
| `nhân sự cấp` (admin, admin tổng, quản lý có quyền **Sửa** khu Tài khoản — `tai-khoan:edit`, theo R3′ của 10) | Người tư vấn bán gói | web `/quan-tri`, máy tính hoặc điện thoại |
| `chủ tàu` (khách thật `account_kind = real`, hạng thường) | Người được cho dùng thử | app SDFish, ngoài biển nhiều ngày mất sóng |
| `admin` (xem báo cáo) | Đo dùng thử có ra đơn không | web `/quan-tri` khu Báo cáo |
| `hệ thống` | Tự hết hạn (resolveTier), ghi 2 nhật ký | nền |

Ngoài phạm vi: `tài khoản thử` (test/demo/reviewer) — không bao giờ nhận dùng thử (vốn đã bị chặn `not_real_account`); `SDWork` — không có dạng dùng thử (R12).

## 3. User × Nghiệp vụ

| # | Nghiệp vụ | Owner | Cross | Ưu tiên |
|---|---|---|---|---|
| NV1 | Cấp dùng thử N ngày cho khách đã có tài khoản | nhân sự cấp | chủ tàu (nhận hạng) | Must |
| NV2 | Tạo tài khoản mới kèm dùng thử | nhân sự cấp | chủ tàu | Must |
| NV3 | Chuyển từ dùng thử sang gói trả tiền | nhân sự cấp | chủ tàu (gọi mua) | Must |
| NV4 | Khách biết mình đang dùng thử + ngày hết | chủ tàu | hệ thống (trả loại hạng) | Should |
| NV5 | Đo dùng thử: số lượt, số khách mua sau dùng thử | admin | — | Should |

## 4. Cross-user handoff map

| Chặng | Từ | → Nhận | Điều kiện | Điểm kết nếu treo |
|---|---|---|---|---|
| H1 | nhân sự cấp (NV1/NV2 trả 200) | chủ tàu (máy nhận hạng premium) | app có sóng — dùng đúng đường "hạng đổi sau khi đăng nhập" đang có (tier.ts, nghe từ máy chủ) | máy đang mất sóng ⇒ hạng đã ghi ở DB, máy nhận khi có sóng lại; dùng thử vẫn chạy đồng hồ từ lúc cấp (R2) — nhân sự được báo điều này trước khi cấp |
| H2 | chủ tàu (hết dùng thử / muốn mua) | nhân sự cấp | khách gọi SDVICO (đường "Tài khoản thường · gọi SDVICO" sẵn có) | không ai gọi ⇒ khách ở hạng thường, dữ liệu đã tải giữ theo luật cũ — không treo, chỉ là không ra đơn (đo ở NV5) |
| H3 | nhân sự cấp (NV3) | chủ tàu | lượt cấp gói tháng trả 200 | như H1 |

## 5. Flows

### Flow NV1 — Cấp dùng thử · owner: nhân sự cấp
- **Input**: SĐT khách thật có tài khoản · số ngày N (1–14; dựng sẵn 3 và 5, mặc định 3) · phiên nhân sự có `tai-khoan:edit`
- **Steps**: (1) chọn "dùng thử" và N → (2) máy chủ kiểm: quyền + khách thật + **khách KHÔNG đang premium hiệu lực** + **khách CHƯA từng có lượt dùng thử** → (3) đặt `tier = premium`, hạn theo R2 → (4) ghi `premium_grants` action `trial` + 2 nhật ký quản trị
- **Output**: khách premium tới cuối ngày VN thứ N kể từ hôm cấp; 1 dòng `trial` trong nhật ký cấp; 0 lượt bán mới
- **Kết thúc sai**: thiếu quyền 403 · số ngày lạ 400 `invalid_days` · đang premium 409 `already_premium` · đã dùng thử 409 `trial_used` · không đọc được lịch sử cấp 503 `lookup_failed` — mọi nhánh sai **không đổi gì**

### Flow NV2 — Tạo tài khoản kèm dùng thử · owner: nhân sự cấp
- **Input**: SĐT chưa có tài khoản + tên + mật khẩu (luật tạo khách sẵn có) + N
- **Steps**: tạo khách → áp đúng bước (2)–(4) của NV1 trong cùng lượt
- **Output**: tài khoản mới, premium dùng thử; nhật ký cấp có 1 `trial`, 0 `activate`
- **Kết thúc sai**: SĐT đã có tài khoản ⇒ theo R3c của 10 (giữ vai, không hạ), rồi xét dùng thử như NV1 (có thể ra `already_premium`/`trial_used`; tài khoản vẫn tạo/giữ, chỉ phần dùng thử không áp — trả rõ phần nào không áp)

### Flow NV3 — Dùng thử → mua gói · owner: nhân sự cấp
- **Input**: khách đang dùng thử (hoặc đã hết) + kỳ hạn tháng như cấp gói thường
- **Steps**: cấp gói tháng theo NV1 của 10 → đang còn dùng thử thì hạn gói **cộng nối** sau hạn dùng thử; lượt này ghi `activate` (lượt mua ĐẦU), không ghi `renew`
- **Output**: hạn = hạn dùng thử + M tháng lịch (còn dùng thử) hoặc bây giờ + M tháng (đã hết); 1 lượt bán `activate`

### Flow NV4 — Khách biết đang dùng thử · owner: chủ tàu
- **Input**: phiên khách có sóng
- **Steps**: máy chủ trả hạng kèm **loại** (`trial` | `paid`) + hạn; máy cất cùng dấu hạng để mất sóng vẫn nói được
- **Output**: khách đọc được "đang dùng thử, tới ngày D"; hết hạn thì về đúng câu hạng thường sẵn có
- **Mất sóng**: dùng loại + hạn đã cất; không có thì nói như premium thường (không đoán)

### Flow NV5 — Đo dùng thử · owner: admin
- **Input**: `premium_grants` + danh sách loại trừ (R15 của 10)
- **Output**: theo kỳ báo cáo — số lượt dùng thử; số khách có `activate` trong vòng 30 ngày sau ngày hết dùng thử; theo người cấp

## 6. Flow optimization log

Chạy tuần tự (Orchestrator), không spawn team: 1 nghiệp vụ chính, cross-user đơn giản. Góc chuyên gia gói thuê bao (trial) được soi theo chuẩn thường gặp: một lần / một danh tính, không chồng lên gói trả tiền, không tính doanh thu, có ngày hết nói rõ, đo chuyển đổi.

| Biến thể | Kết quả | Lý do |
|---|---|---|
| A. Cho kỳ hạn tính ngày với **mọi** lượt cấp (mở `termMonths` xuống ngày) | Loại | Trượt "Định hướng" + "Cross tối thiểu": lượt thử lẫn vào lượt bán, đại lý được tính bán / chia doanh thu oan; cấp 5 ngày lặp mãi = cho không vô hạn |
| B. **Dùng thử là loại cấp riêng** (`trial`), 1 lần/khách, chỉ khách chưa premium, 1–14 ngày | **Chọn** | Đạt 6/6: một owner, input/output đo được, mọi nhánh sai có mã + không đổi gì, không cross mới (dùng đường hạng sẵn có), ít bước nhất, có metric chuyển đổi |
| C. Khách tự bấm dùng thử trong app | Loại (để sau) | App chưa xác minh SĐT bằng OTP (10 §NV10) ⇒ tạo tài khoản ảo lấy dùng thử liên tục; mất điểm chạm tư vấn — chính lý do dùng thử ra đơn |
| D. Không thêm loại cấp, suy "dùng thử" từ `premium_until − activated_at < 30 ngày` | Loại | Suy luận mong manh: gia hạn/hạ hạng làm sai, báo cáo bán sai lặng lẽ (vi phạm luật "khoá nhầm còn hơn mở nhầm" — tier.ts) |
| B′. Như B nhưng hạn = bây giờ + N×24 giờ | Loại | Khách chỉ thấy NGÀY (`formatPremiumUntil`) — hết lúc 15 giờ ngày D mà ghi "tới D" là nói sai nửa ngày. Hết cuối ngày VN thì ngày hiện ra đúng nghĩa đen |

## 7. Scope & Priority

- **IN**: NV1–NV3 (Must), NV4–NV5 (Should).
- **OUT**: khách tự kích hoạt dùng thử (C); dùng thử qua webhook SDWork; nhắc "sắp hết dùng thử" bằng thông báo đẩy (Could — tách spec khi cần); đổi kỳ hạn gói trả tiền (vẫn tính tháng, 10 §NV1).

## 8. Success metric

- **Chuyển đổi**: ≥ **20 %** khách dùng thử có lượt `activate` trong 30 ngày sau ngày hết dùng thử (mục tiêu đầu — xem lại sau 60 ngày có số thật).
- **Báo cáo sạch**: lượt `trial` lọt vào số lượt bán / "đang quản" == **0**.
- **Không lạm dụng**: số khách có > 1 lượt `trial` == **0**.

## 9. Rules & Invariants

| # | Luật | Biên / ca lạ |
|---|---|---|
| R1 | Kỳ hạn tính NGÀY **chỉ** dành cho dùng thử. Gói trả tiền giữ nguyên tính tháng (`PREMIUM_TERM_MIN_MONTHS = 1` không đổi) | — |
| R2 | Số ngày N nguyên 1–14 (luật máy chủ); nhân sự chọn trong mức dựng sẵn 3 và 5; mặc định 3. Hạn = **23:59:59 giờ VN của ngày (ngày cấp theo giờ VN + N)** | N ngoài khoảng / không phải số nguyên / chữ ⇒ `400 invalid_days`, KHÔNG ép về khoảng (đây là cho không — gõ nhầm 50 không được thành 14 im lặng). Cấp 23:50 VN ngày 12/11, N=3 ⇒ hết 15/11 23:59:59 VN |
| R3 | Chỉ cấp cho khách **không đang premium hiệu lực** (`resolveTier` ≠ premium) | đang premium (trả tiền hoặc dùng thử) ⇒ `409 already_premium`, hạn không đổi |
| R4 | **Mỗi khách tối đa 1 lượt dùng thử** suốt đời tài khoản (tính theo SĐT trong `premium_grants`; chỉ mục duy nhất 0088 chặn cả hai lượt bấm cùng lúc) | đã có `trial` (kể cả đã bị hạ giữa chừng) ⇒ `409 trial_used`; đọc lịch sử lỗi ⇒ `503 lookup_failed`, không cấp (fail-closed) |
| R5 | Lượt dùng thử ghi `premium_grants.action = 'trial'` — **không phải lượt bán**: không vào `isSaleGrant`, `topGranters`, số "đang quản"/tổng lượt cấp của người cấp | — |
| R6 | Đang dùng thử mà cấp gói tháng ⇒ lượt đó là `activate` (mua đầu), hạn cộng nối sau hạn dùng thử (khách không mất ngày) | đã hết dùng thử ⇒ `activate` từ bây giờ (luật cũ) |
| R7 | Hết dùng thử = hết premium như mọi lượt khác (`resolveTier`); dữ liệu đã tải trong máy giữ theo luật hiện có (biên lệch đồng hồ `TIER_MARK_GRACE_DAYS = 7` **không đổi**, không rút riêng cho dùng thử) | — |
| R8 | Quyền + chặn như cấp premium: `tai-khoan:edit`, cấm chính mình, nhân sự, tài khoản thử (`not_real_account`) | — |
| R9 | Mỗi lượt cấp dùng thử ghi đủ 2 nhật ký quản trị (R4/R5 của 10), chi tiết có `grant = trial` và `days = N` | nhật ký lỗi không chặn thao tác (luật R4 của 10) |
| R10 | Máy chủ trả cho khách **loại hạng** `trial` \| `paid` kèm hạn; loại = lượt cấp còn hiệu lực gần nhất | không xác định được ⇒ `paid` (không gắn nhãn dùng thử bừa) |
| R11 | `premium_activated_at` ghi như một lượt cấp (dùng thử cũng là "đã bật premium") | — |
| R12 | SDWork không cấp dùng thử; webhook `premiumUntil` giữ nguyên; contract không đổi | — |

## 10. Acceptance Criteria — ORACLE

### AC-1 — Hạn dùng thử rơi đúng cuối ngày giờ VN · Maps to: NV1 · Test: unit
- **Given** giờ cấp 2026-11-12 23:50 giờ VN, N = 3
- **When** tính hạn dùng thử
- **Then** hạn là cuối ngày 15/11 giờ VN
- **Assert**: hạn `==` `2026-11-15T16:59:59.000Z` && cùng ngày cấp lúc 08:00 VN, N = 5 ⇒ `==` `2026-11-17T16:59:59.000Z`

### AC-2 — Cấp dùng thử cho khách thường · Maps to: NV1 · Test: integration
- **Given** khách thật K hạng thường, chưa từng dùng thử; nhân sự có `tai-khoan:edit`
- **When** cấp dùng thử N = 5
- **Then** K thành premium tới cuối ngày thứ 5; nhật ký cấp có đúng một lượt dùng thử
- **Assert**: HTTP `200` && `customers.tier == 'premium'` && `premium_grants` của K có action `trial` `==1` && action `activate`/`renew` mới `==0`

### AC-3 — Số ngày lạ bị từ chối, không ép · Maps to: NV1 · Test: unit
- **Given** khách thường K
- **When** cấp dùng thử với N = 0, 15, 2.5, "ba"
- **Then** từ chối, không đổi gì
- **Assert**: mỗi ca trả `400 invalid_days` && `customers.tier` của K `== 'basic'` && số dòng `premium_grants` của K không đổi (`==` trước)

### AC-4 — Khách đang premium không nhận dùng thử · Maps to: NV1 · Test: integration
- **Given** K đang premium trả tiền tới 2027-05-01
- **When** cấp dùng thử N = 3
- **Then** từ chối, hạn giữ nguyên
- **Assert**: `409 already_premium` && `premium_until` của K `==` `2027-05-01` như trước

### AC-5 — Mỗi khách chỉ một lần dùng thử · Maps to: NV1 · Test: integration
- **Given** K đã có một lượt `trial` (đã hết hạn, hoặc bị hạ hạng giữa chừng)
- **When** cấp dùng thử lần nữa
- **Then** từ chối
- **Assert**: `409 trial_used` && số lượt `trial` của K `==1`

### AC-6 — Không đọc được lịch sử cấp thì không cấp · Maps to: NV1 · Test: integration
- **Given** đọc `premium_grants` của K lỗi
- **When** cấp dùng thử
- **Then** dừng, không ghi
- **Assert**: `503 lookup_failed` && `customers.tier` của K `== 'basic'`

### AC-7 — Lượt dùng thử không tính là bán · Maps to: NV1 · Test: unit
- **Given** nhật ký cấp có 2 lượt `trial` + 1 lượt `activate` của cùng người cấp P
- **When** tính lượt bán và xếp hạng người cấp
- **Then** chỉ lượt `activate` được đếm
- **Assert**: `isSaleGrant({action:'trial'}) === false` && `topGranters` cho P `count == 1`

### AC-8 — Tạo tài khoản kèm dùng thử · Maps to: NV2 · Test: integration
- **Given** SĐT S chưa có tài khoản
- **When** tạo tài khoản S kèm dùng thử N = 3
- **Then** S có tài khoản, đang premium dùng thử
- **Assert**: HTTP `200` && `customers.tier == 'premium'` && `premium_grants` của S: `trial == 1`, `activate == 0`

### AC-9 — Mua gói khi đang dùng thử không mất ngày · Maps to: NV3 · Test: integration
- **Given** K đang dùng thử tới 2026-11-15 23:59:59 VN
- **When** ngày 13/11 cấp gói 18 tháng
- **Then** hạn gói nối sau hạn dùng thử; lượt này là lượt mua đầu
- **Assert**: `premium_until == 2028-05-15T16:59:59.000Z` && action lượt mới `== 'activate'` (không phải `renew`)

### AC-10 — Hết dùng thử về hạng thường · Maps to: NV1 · Test: unit
- **Given** hạn dùng thử `2026-11-15T16:59:59.000Z`
- **When** xét hạng lúc hạn + 1 giây
- **Then** hạng thường
- **Assert**: `resolveTier('premium', hạn, hạn+1000) == 'basic'` && `TIER_MARK_GRACE_DAYS == 7` (không đổi)

### AC-11 — Quyền và đối tượng bị chặn · Maps to: NV1 · Test: integration
- **Given** quản lý Q không có `tai-khoan:edit`; tài khoản R loại reviewer
- **When** Q cấp dùng thử cho khách K; admin cấp dùng thử cho R
- **Then** cả hai bị chặn, không đổi gì
- **Assert**: Q ⇒ `403 no_permission` && R ⇒ `403 not_real_account` && số dòng `premium_grants` mới `==0`

### AC-12 — Mỗi lượt dùng thử có nhật ký · Maps to: NV1 · Test: integration
- **Given** cấp dùng thử thành công cho K, N = 5
- **When** đọc nhật ký quản trị
- **Then** có một dòng cho lượt này với loại và số ngày
- **Assert**: `admin_audit` mới `==1` dòng có `detail.grant == 'trial'` && `detail.days == 5`

### AC-13 — Khách biết mình đang dùng thử · Maps to: NV4 · Test: integration
- **Given** K đang dùng thử; sau đó được cấp gói 12 tháng
- **When** máy của K hỏi hạng trước và sau lượt mua
- **Then** trước là dùng thử, sau là trả tiền
- **Assert**: trước: loại `== 'trial'` kèm hạn `== 2026-11-15T16:59:59.000Z` && sau: loại `== 'paid'`

### AC-14 — Báo cáo đo dùng thử ra đơn · Maps to: NV5 · Test: unit
- **Given** 3 khách thật dùng thử hết hạn trong kỳ; 1 khách có `activate` 10 ngày sau hết hạn, 1 khách `activate` 40 ngày sau
- **When** tính báo cáo dùng thử
- **Then** đếm 3 lượt, 1 khách chuyển đổi (cửa sổ 30 ngày)
- **Assert**: số lượt dùng thử `== 3` && số chuyển đổi `== 1`

## 11. Assumptions (fail-closed) / Open questions

**Assumptions** (an toàn nhất khi chưa có lời chốt — sửa được, GREEN/YELLOW):
- A1. "Kích hoạt theo ngày" = **dùng thử**, không mở kỳ hạn ngày cho gói trả tiền (biến thể A bị loại — §6).
- A2. Khoảng 1–14 ngày, dựng sẵn 3/5 (anh nói 3–5; trần 14 chừa ca bão giữ tàu trong bờ cả tuần).
- A3. Một lần mỗi khách, không ngoại lệ trong app; cần thêm thì cấp gói tháng.
- A4. Mất sóng lúc nhận dùng thử vẫn tính ngày từ lúc cấp — nhân sự nên cấp khi bà con chuẩn bị ra khơi, đang có sóng.
- A5. Không thêm request mạng mới lúc mở app: loại hạng (NV4) đi cùng đường hạng sẵn có; không đụng `sw.js`, cache, khoá `forfish.*` ngoài dấu hạng (`forfish.tier.*`) — offline không hỏng.

**Open — 🔴 RED (cần chủ dự án chốt trước khi build)**:
- Q1. **Migration**: `premium_grants.action` hiện chỉ nhận `activate/renew/downgrade` (0007) ⇒ phải nới ràng buộc thêm `'trial'`. Không có nó thì không tách được lượt thử khỏi lượt bán (biến thể D bị loại). Không tự apply lên remote.

## History
- 2026-11-12 — Tạo spec (CHƯA BUILD). Nguồn: yêu cầu "kích hoạt premium theo ngày 3–5 ngày cho người dùng trải nghiệm, hiện tối thiểu 1 tháng".
- 2026-11-12b — BUILD theo spec (chủ dự án duyệt migration 0088). Chưa apply 0088 lên prod; AC integration chạy tay sau apply.
- 2026-11-12c — Apply 0088 lên prod (chủ dự án duyệt).
