# Contract — Gia hạn S-Tracking (SDFish → DB chung crm/hub)

> Single source of truth cho luồng ngư dân **tự gửi yêu cầu gia hạn thiết bị giám sát hành trình (S-Tracking/VMS)** từ SDFish. Yêu cầu vào ĐÚNG pipeline gia hạn dùng chung của **crm-sdvico-40** (Supabase project `exueouggmbjtjvsvpfya`); nhân viên đối soát + duyệt → DB trigger đổ sang bảng `extension_management` → trang **"Quản lý gia hạn"** của **cskh-tasker-hub**. Sửa ở đây, KHÔNG chép shape.

**Version**: v1 — 2026-08-21

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
| SDFish | `src/lib/renewal.ts` (adapter) | gọi edge fn, mọi lỗi → null |
| SDFish | `src/app/api/renewal/{price,request,mine}/route.ts` | cổng server, suy SĐT từ phiên |
| SDFish | `src/components/vms-renewal.tsx` | UI: thẻ VMS + guard mã tàu + wizard + màn trạng thái |

## Xác thực / an toàn

- **Shared secret** `SDFISH_RENEWAL_SECRET` (env cả hai phía) — header `x-sdfish-secret`. `verify_jwt=false` cho function (anon key crm bán công khai, không đủ gác).
- **SĐT lấy từ phiên đã xác thực** ở SDFish server (`identityFromRequest`), KHÔNG nhận từ body máy khách. Ngư dân chỉ gửi thông tin TÀU (mã/serial).
- **Tàu do ngư dân TỰ KHAI** trong SDFish (local `forfish.boats.v1`) → `vessel_code` CHƯA kiểm chứng với hệ S-Tracking. Nhân viên PHẢI xác minh trước khi bấm "đã gia hạn". Kỳ hạn chỉ **3/6/12 tháng**.

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

### `list` → yêu cầu của 1 SĐT
```jsonc
// req: { "action": "list", "phone": "0901234567" }
// res: { "ok": true, "requests": [ {
//   requestCode, status, totalAmount, transferNote, qrUrl, qrExpiresAt,
//   createdAt, paidAt, extendedAt, vesselCode, monthsCount, newExpiryDate } ] }
```
Lọc `requester_phone = <SĐT> AND origin='sdfish'`, mới trước, tối đa 20.

## Trạng thái (enum `stracking_renewal_status`, hiển thị ở SDFish)

`draft` → `pending_payment` (Chờ chuyển khoản) → `pending_extension` (Đã nhận tiền, chờ gia hạn) → `extended` (Đã gia hạn xong); nhánh `cancelled` (Đã hủy) · `expired` (Hết hạn mã QR). SDFish CHỈ tạo tới `pending_payment`; các bước sau do nhân viên crm.

## Migration kèm (DB chung)

`crm-sdvico-40/supabase/migrations/20260821140000_sdfish_renewal_origin.sql` — thêm `stracking_renewal_requests.origin text NOT NULL DEFAULT 'crm' CHECK (origin IN ('crm','sdfish'))` + index. Non-breaking (hàng cũ + luồng crm → 'crm'). `requester_user_id` đã nullable sẵn.

## Env cần đặt

| Nơi | Env | Ý nghĩa |
|---|---|---|
| SDFish (forfish) | `SDWORK_SUPABASE_URL` | URL DB chung (đã có, dùng chung với gateway assets) |
| SDFish | `SDFISH_RENEWAL_SECRET` | shared secret (server-only) — cổng gác THẬT (header `x-sdfish-secret`) |

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
| 2026-08-21 | v1 | Khởi tạo: edge fn `sdfish-renewal` (price/create/list) + cột `origin` + UI VMS renewal SDFish. Kỳ hạn 3/6/12. |
