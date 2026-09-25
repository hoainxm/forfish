# Contract — SDWork owned-assets (đồ khách đã mua)

> Single source of truth cho dữ liệu đồng bộ giữa **CRM SDViCo** (producer) và **ForFish** (consumer). Hai hệ là 2 Supabase project tách biệt; KHÔNG copy shape, sửa ở đây.
> *(EN: shared shape between the CRM SDViCo project and the ForFish app. Edit here, never duplicate.)*

**Version**: v1 — 2026-06-11

---

## Producer

| Hệ | Nơi | Writer |
|---|---|---|
| CRM SDViCo (Supabase project `exueouggmbjtjvsvpfya`) | Edge Function `forfish-gateway` (action `assets`) | gateway gộp `warranty_cards` + `vw_imported_serials` + `service_instances` + `orders(debt>0)` + `consultation_requests`, chuẩn hoá SĐT 9 số cuối |
| CRM SDViCo | Edge Function `forfish-gateway` (action **`request`**) | **NHẬN yêu cầu mua/tư vấn** từ app SDFish → INSERT vào `consultation_requests` để **phòng kinh doanh SDWork tiếp nhận xử lý** (xem §"Yêu cầu mua → SDWork" dưới) |
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

## Yêu cầu mua → SDWork (action `request`) — 2026-09-24

> Khách bấm "Hỏi mua / Gửi yêu cầu mua" trên SDFish → yêu cầu về thẳng CRM SDWork
> cho **phòng kinh doanh tiếp nhận**. Đây là kênh bán hàng SDWork đang theo dõi thật.

**Luồng đầy đủ (ForFish → CRM):**
```
SdvicoRequestButton / ProductDetailSheet (hàng vendor_kind='sdvico')
  → POST /api/sdvico/request            {name?, phone?, topic, productName?, detail?}
  → lib/sdwork-request.buildRequestMessage()   (ráp câu, có test)
  → lib/sdwork-assets.createConsultationRequest()
  → callGateway { action:"request", fullName, phone, message }
  → POST {SDWORK_SUPABASE_URL}/functions/v1/forfish-gateway   (Bearer SDWORK_SUPABASE_ANON_KEY)
  → CRM INSERT consultation_requests { full_name, phone (9 số cuối), message }
```

**Payload gửi gateway (request body):**
```jsonc
{ "action": "request",
  "fullName": "string (≤120)",   // tên khách; thiếu → "Khách SDFish"
  "phone":    "string",          // đã chuẩn hoá 0xxxxxxxxx (normalizeVnPhone)
  "message":  "string" }         // "[ForFish] <chủ đề> · <sản phẩm> — <ghi chú>"
```
- **Tiền tố `[ForFish]`** (`REQUEST_SOURCE_TAG`) là DẤU NHẬN DIỆN — phòng kinh doanh lọc `consultation_requests.message LIKE '[ForFish]%'` để biết yêu cầu đến từ app ngư dân. **Đổi tiền tố = đổi bộ lọc phía CRM, phải báo hai bên.**
- `<chủ đề>` = `topicLabel(topic)`: `mua`→"Hỏi mua sản phẩm", `cuoc`→"Hỏi cước / gia hạn", `sua-chua`→"Gọi sửa chữa", `bao-duong`→"Đặt lịch bảo dưỡng", khác→"Việc khác".
- Gửi được CẢ khi khách **chưa đăng nhập** (khách vãng lai = mối bán hàng); đăng nhập rồi thì tên/SĐT tự điền từ `customers`.
- Gateway trả `{ok:true}` → route trả 200. Lỗi CRM → 502 `crm_error`; thiếu env → 503 `not_configured`; SĐT sai → 400 `invalid_phone`.

**Cách phòng kinh doanh CHECK từ phía SDWork:**
1. Mở CRM SDViCo (project `exueouggmbjtjvsvpfya`) → bảng/màn **`consultation_requests`**.
2. Lọc `message` bắt đầu bằng `[ForFish]` → đây là yêu cầu từ app ngư dân.
3. Mỗi dòng có: tên khách · SĐT (gọi lại) · message (chủ đề + sản phẩm + ghi chú) · thời điểm. Xử lý như lead CSKH bình thường.

**CHUẨN BỊ DEPLOY (checklist):**
- [ ] **Env trên Vercel** (prod): `SDWORK_SUPABASE_URL=https://exueouggmbjtjvsvpfya.supabase.co` + `SDWORK_SUPABASE_ANON_KEY=<publishable/anon, KHÔNG service-role>`. Thiếu → `/api/sdvico/request` trả 503, app báo "chưa gửi được".
- [x] **Edge Function `forfish-gateway` phía CRM** nhận `action:"request"` và INSERT `consultation_requests` — ✅ **ĐÃ XÁC NHẬN 2026-09-24**: có dòng thật `[ForFish] Hỏi cước / gia hạn — hỏi cước tàu` (2026-08-15, test nội bộ SĐT 0939243222) trong `consultation_requests`, định dạng khớp `buildRequestMessage`. Không cần sửa phía CRM.
- [ ] **Verify sau deploy**: bấm "Gửi yêu cầu mua" 1 sản phẩm trên prod → kiểm `consultation_requests` bên CRM thấy dòng `[ForFish]` mới. Hoặc `curl -X POST https://<prod>/api/sdvico/request -H 'content-type: application/json' -d '{"name":"Test","phone":"0901234567","topic":"mua","productName":"Máy lọc dầu"}'` → `{ok:true}`.
- [ ] RLS/quyền: gateway dùng `SDWORK_SUPABASE_ANON_KEY` (anon) — Edge Function phía CRM tự chèn bằng service-role của nó; ForFish KHÔNG cầm service-role của CRM.

## ĐƠN MUA SDFish → SDWork (function `sdfish-order`, phase 1) — 2026-09-25

> KHÁC `consultation_requests`: đây là **ĐƠN MUA THẬT** vào bảng `orders`/`order_items`
> của CRM, có mã hiển thị + luồng kinh doanh DUYỆT. Chỉ dùng cho **hỏi MUA một sản
> phẩm** (topic=`mua` + có sản phẩm); các topic khác (cước/sửa chữa…) vẫn đi
> `action:"request"` → `consultation_requests` như cũ.

**Luồng:** SdvicoRequestButton/ProductDetailSheet (topic=mua + sản phẩm) → `/api/sdvico/order` → `lib/sdwork-order.createSdfishOrder()` → `POST {SDFISH_ORDER_URL}` header `x-sdfish-secret` → CRM tạo đơn nguồn `sdfish`.

**Payload gửi (`sdfish-order`):**
```jsonc
{ "action": "create", "source": "sdfish",
  "externalRef": "sdf-<uuid>",              // BẮT BUỘC, idempotent (gửi trùng → đơn cũ)
  "customer": { "fullName": "string", "phone": "0xxxxxxxxx" },  // CRM tự tạo/khớp KH theo SĐT
  "items": [ { "productName": "string", "sku": null, "qty": 1, "unitPriceVnd": null } ],
  "note": "string?", "deliveryAddress": null }
```
**Response phase 1:**
```jsonc
{ "ok": true, "displayRef": "SDF-xxxxxx", "status": "pending" }
```
- **Phase 1**: gửi TÊN sản phẩm (text), `qty:1`, giá trống → kinh doanh gán SKU + báo giá lúc duyệt. **Chưa có mã `DH…`** — mã đơn thật sinh khi kinh doanh DUYỆT (về SDFish ở **phase 2** qua webhook trạng thái, cần thống nhất endpoint+payload).
- **Auth**: shared secret header `x-sdfish-secret` (function `verify_jwt=false`; KHÔNG gửi apikey/Authorization — bài học renewal). Env: `SDFISH_ORDER_SECRET` + `SDFISH_ORDER_URL` (trống → suy từ `SDWORK_SUPABASE_URL`).
- **Lỗi route**: 503 `not_configured` (thiếu env) · 400 `missing_ref`/`missing_product`/`invalid_phone` · 502 `crm_error`.
- **Cần cho phase 2**: SDWork đẩy webhook về SDFish khi đổi trạng thái (`pending → xác nhận → …`) + gửi mã `DH…` để SDFish hiện cho ngư dân.

## Compatibility rules

- **Non-breaking** (không bump): thêm field optional; thêm `service.kind` mới (consumer `serviceKindLabel` có nhánh default "Dịch vụ").
- **Breaking** (bump version + sửa MỌI consumer cùng đợt): đổi tên/xóa field, đổi type, đổi nghĩa `active`/`amountVnd`.
- Consumer gặp version lạ → `useSdvicoAssets` trả nấc `error` (nút Thử lại), KHÔNG crash; thiếu field optional → ẩn dòng tương ứng.
- `warrantyUntil`/`purchasedOn` = null là HỢP LỆ (thiết bị import) — consumer không được suy ra "hết hạn".

## Change log

| Ngày | Version | Thay đổi | Consumers đã update |
|---|---|---|---|
| 2026-06-11 | v1 | Khởi tạo contract (gateway v4: warranty_cards + vw_imported_serials) | ForFish (toàn bộ) |
| 2026-08-02 | v1 (**KHÔNG bump**) | **Shape KHÔNG đổi một field nào.** Adapter `src/lib/sdwork-assets.ts` chỉ đổi đúng một dòng ở tầng vận chuyển: `AbortSignal.timeout(15000)` → `timeoutSignal(15000)` (`src/lib/abort.ts`). Lý do: `AbortSignal.timeout` chỉ có từ Safari 16 / Chrome 103, iPhone kẹt iOS 15.8 ném `TypeError` ngay tại lời gọi ⇒ nhóm máy đó gọi gateway hỏng vì lý do KHÔNG phải mạng nhưng lại đội lốt "mất sóng", và `useSdvicoAssets` rơi nhầm về nấc `error`. Trần 15 s giữ nguyên; `undefined` chỉ xảy ra khi môi trường thiếu cả `AbortController`. Không cần đổi gì phía producer. | ForFish — không consumer nào phải sửa |
| 2026-09-25 | v1 (**KHÔNG bump**) | **THÊM luồng ĐƠN MUA phase 1** (function `sdfish-order`, action `create`) — SDFish side sẵn sàng chờ SDWork trả sandbox URL+secret. Code: `lib/sdwork-order.ts` (`buildOrderPayload`, có test) · route `/api/sdvico/order` · `sdvico-request.tsx` nhánh topic=mua+sản phẩm → tạo đơn (externalRef ổn định, hiện `SDF-xxxxxx`). Env mới: `SDFISH_ORDER_SECRET`/`SDFISH_ORDER_URL`. Consultation (`request`) giữ nguyên cho topic khác. | ForFish (sẵn sàng đấu nối) |
| 2026-09-24 | v1 (**KHÔNG bump**) | **Tài liệu hoá action `request`** (yêu cầu mua → SDWork) vốn đã chạy nhưng chưa ghi contract — thêm §"Yêu cầu mua → SDWork" + payload + checklist deploy + cách kinh doanh check. Code: tách `lib/sdwork-request.ts` (`buildRequestMessage`, có test), route `/api/sdvico/request` dùng lại `lib/phone` (bỏ dupe `normalizePhone`/`isValidVnPhone`). Hành vi KHÔNG đổi. | ForFish — không consumer nào phải sửa |
