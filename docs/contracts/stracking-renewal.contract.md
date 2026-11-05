# Contract — Gia hạn S-Tracking (SDFish → DB chung crm/hub)

> Single source of truth cho luồng ngư dân **tự gửi yêu cầu gia hạn thiết bị giám sát hành trình (S-Tracking/VMS)** từ SDFish. Yêu cầu vào ĐÚNG pipeline gia hạn dùng chung của **crm-sdvico-40** (Supabase project `exueouggmbjtjvsvpfya`); nhân viên đối soát + duyệt → DB trigger đổ sang bảng `extension_management` → trang **"Quản lý gia hạn"** của **cskh-tasker-hub**. Sửa ở đây, KHÔNG chép shape.

**Version**: v1.1 — 2026-11-05 (thêm, không phá: serial, `pending`, `confirm`)

---

## Kiến trúc

- SDFish có DB Supabase RIÊNG (`znzgugvfhgmiszqgjulk`), KHÔNG chung với crm/hub.
- crm-sdvico-40 + cskh-tasker-hub DÙNG CHUNG DB `exueouggmbjtjvsvpfya`; "contract" gia hạn giữa chúng ở tầng DB (bảng `extension_management` + trigger `trg_renewal_to_extension_management`).
- SDFish nối vào DB chung qua **edge function `sdfish-renewal`** (chạy TRONG project crm, service role). SDFish server gọi server-to-server, gác bằng shared secret.

```
SDFish app (ngư dân)
  → SDFish server (Next route /api/renewal/*)        [xác thực phiên → có SĐT]
    → edge fn sdfish-renewal (DB chung, service role) [tạo request + QR]
      → stracking_renewal_requests / _items (origin='sdfish', source_table='vnf_data')
        → [nhân viên crm đối soát + duyệt: status → 'extended']
          → trigger → extension_management → trang "Quản lý gia hạn" (hub)
```

## Producer / Consumer

| Hệ | Nơi | Vai trò |
|---|---|---|
| DB chung crm/hub (`exueouggmbjtjvsvpfya`) | Edge fn `supabase/functions/sdfish-renewal` (crm repo) | nhận yêu cầu SDFish, tạo request + QR, tra trạng thái |
| DB chung | pipeline S-Tracking sẵn có (`stracking_renewal_*`, `generate-renewal-qr`, `confirm-renewal-done`, trigger bridge) | đối soát, duyệt, đổ sang hub — TÁI DÙNG, không sửa |
| SDFish | `src/lib/renewal-server.ts` (adapter, server-only, 2026-11-05) | gọi edge fn, mọi lỗi → null; đọc khoá + URL từ `/quan-tri` (app_config) |
| SDFish | `src/lib/renewal.ts` | phần thuần + kiểu (3 bước, đối chiếu S-Tracking) — dùng chung client/server |
| SDFish | `src/app/api/renewal/{price,request,mine}/route.ts` | cổng server, suy SĐT từ phiên |
| SDFish | `src/components/vms-renewal.tsx` | UI: thẻ VMS + guard mã tàu + wizard + màn trạng thái |

## Xác thực / an toàn

- **Shared secret** `SDFISH_RENEWAL_SECRET` (env cả hai phía) — header `x-sdfish-secret`. `verify_jwt=false` cho function (anon key crm bán công khai, không đủ gác).
- **SĐT lấy từ phiên đã xác thực** ở SDFish server (`identityFromRequest`), KHÔNG nhận từ body máy khách. Ngư dân chỉ gửi thông tin TÀU (mã/serial).
- **Tàu do ngư dân TỰ KHAI** trong SDFish (local `forfish.boats.v1`) → `vessel_code` CHƯA kiểm chứng với hệ S-Tracking. Nhân viên PHẢI xác minh trước khi bấm "đã gia hạn". Kỳ hạn chỉ **3/6/12 tháng**.
- **Tàu có trên S-Tracking** (2026-11-05): SDFish server khớp tàu với bảng `stracking_thiet_bi` (máy GPU đồng bộ từ stracking.viettel.io, lọc theo SĐT phiên là CHỦ TÀU (06/11: thuyền trưởng không gia hạn/xem giám sát)) ⇒ `vessel.maTau`/`serial`/`ownerName` gửi đi là dữ liệu S-Tracking, không phải chữ máy khách. Nhân viên vẫn duyệt như cũ.
- **Chống trùng phía SDFish** (2026-11-05): trước `create`, SDFish gọi `list` — tàu đã có yêu cầu `pending_payment` (QR còn hạn) hoặc `pending_extension` ⇒ SDFish trả 409 `da_co_yeu_cau`, KHÔNG gọi `create`. `list` lỗi ⇒ bỏ qua chống trùng (không chặn bà con).

## Actions (POST edge fn, body JSON, header `x-sdfish-secret`)

### `price` → đơn giá/tháng hiện hành
```jsonc
// req:  { "action": "price" }
// res:  { "ok": true, "monthlyPrice": 385000 }   // hoặc { ok:false, code:"no_pricing" }
```

### `create` → tạo yêu cầu + sinh QR
```jsonc
// req:
{
  "action": "create",
  "phone": "0901234567",           // SĐT đã xác thực (server điền)
  "name": "anh Hai",               // tên khách (server điền hộ, có thể rỗng)
  "monthsCount": 6,                // CHỈ 3 | 6 | 12
  "vessel": { "maTau": "BV-1234-TS", "ownerName": "…?", "serial": "…?" }
}
// res (ok):
{
  "ok": true,
  "requestCode": "GH-20260821-0001",
  "status": "pending_payment",
  "vesselCode": "BV-1234-TS",
  "monthsCount": 6, "monthlyPrice": 385000, "totalAmount": 2310000,
  "transferNote": "GH GH-20260821-0001 6T BV-1234-TS",   // ≤96 ký tự VietQR
  "qrUrl": "https://img.vietqr.io/image/…",
  "qrExpiresAt": "ISO", "currentExpiry": "YYYY-MM-DD | null",
  "bank": { "bankName": "…", "accountNumber": "…", "accountName": "…", "binCode": "…" }
}
// res (lỗi): { ok:false, code } — invalid_phone|missing_vessel_code|invalid_months|no_pricing|no_bank
```
Ghi DB: `stracking_renewal_requests` (`origin='sdfish'`, `requester_user_id=NULL`, `status` draft→pending_payment) + 1 `stracking_renewal_items` (`source_table='vnf_data'`, `connection_record_id=NULL`, `vessel_code`, `months_count`, `monthly_price`, `subtotal` generated). QR VietQR + `qr_payment_logs` như `generate-renewal-qr`.

### `create` — thêm từ v1.1
`vessel.imei` (≤40) và `vessel.currentExpiry` (YYYY-MM-DD, hạn hiện tại trên S-Tracking) — **SDFish server điền từ `stracking_thiet_bi`**, không phải chữ ngư dân. `vessel.serial` từ v1.1 là KHOÁ (SDFish luôn gửi). `currentExpiry` có thì dùng thay cho tra `extension_management`.

### `list` → yêu cầu của 1 SĐT
```jsonc
// req: { "action": "list", "phone": "0901234567" }
// res: { "ok": true, "requests": [ {
//   requestCode, status, totalAmount, transferNote, qrUrl, qrExpiresAt,
//   createdAt, paidAt, extendedAt, vesselCode, monthsCount, newExpiryDate } ] }
```
Lọc `requester_phone = <SĐT> AND origin='sdfish'`, mới trước, tối đa 20.

Từ v1.1 mỗi phần tử thêm `serialNumber`, `currentExpiryDate` (của item đầu). SDFish ghép đơn ↔ máy theo `serialNumber`; đơn cũ không có thì theo tên tàu, trừ khi tên trùng trong máy của SĐT.

### `pending` → đơn SDFish đã nhận tiền, chờ đổi hạn (v1.1)
```jsonc
// req: { "action": "pending" }
// res: { "ok": true, "requests": [ { requestCode, phone, serialNumber, vesselCode, monthsCount, currentExpiryDate, paidAt } ] }
```
Lọc `origin='sdfish' AND status='pending_extension'`, cũ trước, tối đa 200.

### `confirm` → SDFish tự đóng đơn khi hạn S-Tracking đã đổi (v1.1)
```jsonc
// req: { "action": "confirm", "requestCode": "GH-…", "serialNumber": "…", "newExpiryDate": "YYYY-MM-DD" }
// res: { "ok": true, requestCode, newExpiryDate, extendedAt }
// lỗi: bad_request | not_found(404) | not_pending(409) | serial_mismatch(409) | expiry_not_advanced(409)
```
Chỉ `pending_extension → extended` (UPDATE có điều kiện trạng thái); item phải đúng 1 và mang đúng serial; `newExpiryDate` > `current_expiry_date`. Ghi `item.new_expiry_date`, `applied_at`; request `extended_at`, `extended_by=NULL`, `extension_notes='Tự xác nhận: hạn trên S-Tracking đã đổi sang … (SDFish đối chiếu serial …)'` ⇒ trigger sẵn có đổ sang `extension_management`. Gọi từ SDFish `/api/cron/xac-nhan-gia-han` 4 lần/ngày khi `daDoiHan` (hạn S-Tracking vượt hạn cũ VÀ ≥ mốc mong đợi − 3 ngày; mốc = max(hạn cũ, ngày nhận tiền giờ VN) + số tháng). Nhân viên vẫn đóng tay được qua `confirm-renewal-done`.

## Trạng thái (enum `stracking_renewal_status`, hiển thị ở SDFish)

`draft` → `pending_payment` (Chờ chuyển khoản) → `pending_extension` (Đã nhận tiền, chờ gia hạn) → `extended` (SDFish hiện **"SDVICO báo đã gia hạn"** — CHƯA phải xong: SDFish đối chiếu hạn S-Tracking, xem dưới); nhánh `cancelled` (Đã hủy) · `expired` (Hết hạn mã QR). SDFish CHỈ tạo tới `pending_payment`; các bước sau do nhân viên crm.

**Đối chiếu S-Tracking (SDFish, 2026-11-05)**: `extended` chỉ thành "Đã gia hạn · S-Tracking đã xác nhận" khi hạn cước máy GPU kéo từ stracking.viettel.io ≥ `newExpiryDate` (thiếu thì ngày `extendedAt` giờ VN + `monthsCount`) − 3 ngày. Chưa tới ⇒ "chờ S-Tracking"; quá 48 giờ ⇒ "gọi SDVICO". Vì vậy nhân viên crm nên ghi `new_expiry_date` đúng hạn mới khi duyệt. Edge fn không đổi.

## Migration kèm (DB chung)

`crm-sdvico-40/supabase/migrations/20260821140000_sdfish_renewal_origin.sql` — thêm `stracking_renewal_requests.origin text NOT NULL DEFAULT 'crm' CHECK (origin IN ('crm','sdfish'))` + index. Non-breaking (hàng cũ + luồng crm → 'crm'). `requester_user_id` đã nullable sẵn.

## Env cần đặt

| Nơi | Env | Ý nghĩa |
|---|---|---|
| SDFish (forfish) | **/quan-tri → Hệ thống → "Địa chỉ DB chung CRM (gia hạn)"** (`app_config.sdwork_crm_url`; env dự phòng `SDWORK_SUPABASE_URL`) | URL DB chung, dạng `https://<ref>.supabase.co` |
| SDFish | **/quan-tri → Hệ thống → "Khoá gia hạn giám sát hành trình"** (`app_config.sdfish_renewal_secret`; env dự phòng `SDFISH_RENEWAL_SECRET`) | shared secret — cổng gác THẬT (header `x-sdfish-secret`). Ô quản trị THẮNG env, đổi có hiệu lực sau ≤30 s, không cần deploy lại (2026-11-05) |

> ⚠️ **KHÔNG gửi `apikey`/`Authorization`**: function `verify_jwt=false`, mà anon key project là định dạng mới `sb_publishable_…` — cổng Kong từ chối nó khi gửi làm apikey (401 "Invalid API key") TRƯỚC khi tới function (đo thật 2026-08-21). Chỉ gửi `x-sdfish-secret`.
| DB chung (crm) | `SDFISH_RENEWAL_SECRET` | KHỚP với phía SDFish |
| DB chung | `SUPABASE_SERVICE_ROLE_KEY`, `RENEWAL_QR_EXPIRE_HOURS` | chuẩn Supabase (đã có) |

Chưa đặt đủ env → adapter `isRenewalConfigured()` false → route trả 503/`not_configured`, UI ẩn/độ lùi êm (offline-safe).

## Compatibility rules

- Non-breaking: thêm field optional vào res; thêm action mới.
- Breaking (bump version + sửa cả 2 phía): đổi tên/xóa field, đổi nghĩa status, đổi shape `create`/`list`.
- Đổi `ALLOWED_MONTHS` (3/6/12) phải đổi ĐỒNG THỜI `RENEWAL_MONTH_OPTIONS` (SDFish `src/lib/renewal.ts`) — hai nơi khoá cùng một luật.

## Change log

| Ngày | Version | Thay đổi |
|---|---|---|
| 2026-11-05 | v1.1 | KHOÁ serial: SDFish chỉ cho gia hạn máy có trên S-Tracking của SĐT (bỏ tàu tự khai), `create` gửi `imei`/`currentExpiry` thật; `list` trả `serialNumber`/`currentExpiryDate`; thêm `pending` + `confirm` — hệ thống tự đóng đơn khi hạn S-Tracking đổi. Edge fn sửa ở crm-sdvico-40 nhánh `feat/sdfish-renewal-serial-tu-dong-dong`. |
| 2026-11-05 | v1 (không đổi shape) | SDFish: thay tàu bằng dữ liệu S-Tracking khi khớp SĐT phiên; chống trùng qua `list` trước `create`; thẻ "máy của tôi" đọc `list` để hiện yêu cầu đang chạy. Edge fn KHÔNG đổi. |
| 2026-08-21 | v1 | Khởi tạo: edge fn `sdfish-renewal` (price/create/list) + cột `origin` + UI VMS renewal SDFish. Kỳ hạn 3/6/12. |
