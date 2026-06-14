# Contract — SDWork owned-assets (đồ khách đã mua)

> Single source of truth cho dữ liệu đồng bộ giữa **CRM SDViCo** (producer) và **ForFish** (consumer). Hai hệ là 2 Supabase project tách biệt; KHÔNG copy shape, sửa ở đây.
> *(EN: shared shape between the CRM SDViCo project and the ForFish app. Edit here, never duplicate.)*

**Version**: v1 — 2026-06-11

---

## Producer

| Hệ | Nơi | Writer |
|---|---|---|
| CRM SDViCo (Supabase project `exueouggmbjtjvsvpfya`) | Edge Function `forfish-gateway` (action `assets`) | gateway gộp `warranty_cards` + `vw_imported_serials` + `service_instances` + `orders(debt>0)` + `consultation_requests`, chuẩn hoá SĐT 9 số cuối |
| CRM SDViCo | Edge Function `auth-gateway` (action `sso`/`signup`) | verify SĐT+mật khẩu với CRM rồi đồng bộ mật khẩu vào ForFish |

## Consumers

> Consumer mới: tự thêm dòng vào bảng này trong cùng PR bắt đầu đọc.

| Repo | File đọc | Field dùng |
|---|---|---|
| ForFish | `src/lib/sdwork-assets.ts` (adapter `callGateway` + `mapCrmAssets`) | toàn bộ shape dưới |
| ForFish | `src/lib/owned-assets.ts` (types trung lập vendor) | định nghĩa lại shape — phải khớp |
| ForFish | `src/app/api/me/sdvico/route.ts` | trả `{ok, assets}` cho client |
| ForFish | `src/lib/use-sdvico-assets.ts` | phân loại 4 nấc `guest/unlinked/error/ok` |

---

## Schema (OwnedAssets)

```jsonc
{
  "version": "1",                    // BẮT BUỘC — consumer check để fallback
  "customerName": "string?",         // optional — tên khách bên CRM
  "products": [{                     // sản phẩm đã mua (gồm thiết bị import)
    "id": "string", "name": "string",
    "serial": "string?",
    "purchasedOn": "ISO date?",      // null cho thiết bị import Excel
    "warrantyUntil": "ISO date?",    // null = không bịa hạn bảo hành
    "orderCode": "string?"
  }],
  "services": [{                     // dịch vụ đang dùng / kỳ cước
    "id": "string", "name": "string",
    "kind": "repair|maintenance|warranty|subscription|other",
    "startedOn": "ISO date?", "nextDueOn": "ISO date?",
    "endsOn": "ISO date?", "active": "boolean"
  }],
  "payments": [{                     // công nợ / cước chờ đóng
    "orderCode": "string", "amountVnd": "number", "dueOn": "ISO date?"
  }],
  "requests": [{                     // yêu cầu CSKH gần nhất (mới trước)
    "id": "string", "summary": "string", "status": "string", "sentAt": "ISO datetime?"
  }]
}
```

Tài khoản phía CRM suy từ **session ForFish** (`profiles.sdwork_customer_ref` / SĐT trong email ảo `{sdt}@sdvico.local`) — client KHÔNG gửi và không đổi được định danh.

---

## Compatibility rules

- **Non-breaking** (không bump): thêm field optional; thêm `service.kind` mới (consumer `serviceKindLabel` có nhánh default "Dịch vụ").
- **Breaking** (bump version + sửa MỌI consumer cùng đợt): đổi tên/xóa field, đổi type, đổi nghĩa `active`/`amountVnd`.
- Consumer gặp version lạ → `useSdvicoAssets` trả nấc `error` (nút Thử lại), KHÔNG crash; thiếu field optional → ẩn dòng tương ứng.
- `warrantyUntil`/`purchasedOn` = null là HỢP LỆ (thiết bị import) — consumer không được suy ra "hết hạn".

## Change log

| Ngày | Version | Thay đổi | Consumers đã update |
|---|---|---|---|
| 2026-06-11 | v1 | Khởi tạo contract (gateway v4: warranty_cards + vw_imported_serials) | ForFish (toàn bộ) |
