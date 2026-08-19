# ADR 0002 — Service worker VẪN cứu 401/403 bằng bản trong kho

**Status**: Accepted
**Date**: 2026-08-16
**Deciders**: chủ dự án (chốt 2026-08-01, tái xác nhận 2026-08-16 sau bản thẩm định)

---

## Context / Bối cảnh

`public/sw.js` (`isRescuableStatus`, `:690`; nhánh `/api/*`, `:1230`) coi **401 và
403** là lỗi "cứu được": máy chủ từ chối thì service worker trả lại bản `200` đã
nằm trong kho `sdfish-api-v1`.

Bản thẩm định 2026-08-16 xếp đây là P1 và đề nghị bỏ hẳn, với lý do: trên máy
dùng chung (chủ tàu + bạn thuyền chung một điện thoại), người sau đăng nhập vẫn
xem được bản đồ cá premium mà người trước đã tải. Vòng audit offline 2026-08-02
(T4) đã nêu đúng lỗ này và ghi "cần chủ dự án chốt".

Điều làm quyết định không hiển nhiên: chốt của chủ dự án 2026-08-01 — *"premium
gác cửa TẢI, không gác cửa XEM: đã tải được, lưu trong máy rồi thì cứ dùng"* —
sinh ra chính nhánh cứu này, và nó đang che một ca nguy hiểm hơn: `middleware.ts`
fail-closed, nên **một cú 403 thoáng qua giữa biển** (Supabase nghẹt, tra hạng
hỏng) sẽ khiến `/api/fish-forecast` trả lỗi; nếu service worker không cứu thì
màn hình mất lớp cá cho tới khi tàu về bờ. Payload bản đồ cá ~1 MB, giữa biển
không tải lại được.

## Decision / Quyết định

**Giữ nguyên** hành vi cứu 401/403 bằng bản trong kho. Không đổi code trong đợt
vá 2026-08-16; ghi ADR này để quyết định có chỗ đứng, có ranh giới và có điều
kiện xét lại.

## Alternatives considered / Phương án đã cân nhắc

### Option A: Bỏ hẳn rescue 401/403
- ✅ Ưu: đóng kín lỗ máy dùng chung; đúng lý thuyết "mã lỗi quyền không được cache".
- ❌ Nhược: một sự cố hạ tầng 10 phút ở bờ, hoặc một cú 403 thoáng qua giữa biển,
  là mất lớp cá **cả chuyến**. Đây là hỏng NẶNG hơn, xảy ra với người đã trả tiền,
  và không có đường tự phục hồi ngoài khơi.

### Option B: Giữ rescue, xoá kho `sdfish-api-v1` khi ĐỔI NGƯỜI
- ✅ Ưu: giữ lời hứa offline cho cùng một người; đóng lỗ máy dùng chung.
- ❌ Nhược: thêm một đường xoá kho mới ở `offline-identity`, mà mọi đường xoá kho
  trong dự án này đều đã từng đẻ lỗi mất dữ liệu (xem `audit-offline-vong2`,
  mục C-2/T1). Chưa có bằng chứng máy dùng chung là ca phổ biến.

### Option C: Giữ nguyên, ghi ADR ← **đã chọn**
- ✅ Ưu: không đánh đổi lời hứa offline; không thêm đường xoá kho mới.
- ❌ Nhược: lỗ máy dùng chung còn đó, chỉ được khoanh vùng chứ chưa đóng.

## Consequences / Hệ quả

- **Tích cực**: đường "đã tải thì cứ dùng" giữa biển còn nguyên; không có bản vá
  nào có thể vô tình xoá bản đồ cá đã tải.
- **Đánh đổi**: trên máy dùng chung, người đăng nhập sau có thể xem lại bản đồ cá
  và dự báo dài ngày mà người trước đã tải, cho tới khi bản trong kho hết giá trị
  (≤16 ngày) hoặc kho bị dọn.
- **Ranh giới đã đóng, đừng nới**:
  - `API_CACHE_ALLOW` (`sw.js:78`, khoá đồng bộ với `lib/sw-cache-policy.ts` và có
    cổng test) chỉ gồm DỰ BÁO/GIÁ — thứ ai xem cũng như nhau. **Không được thêm**
    route mang hồ sơ cá nhân (`/api/me/*`, `/api/crew-reports`, `/api/admin/*`).
  - `purgeLegacyEntries` (`sw.js:646`) dọn mọi thứ ngoài allowlist đã lỡ cất.
  - `rememberIdentity` vẫn xoá **dấu** premium khi đổi người (`offline-identity.ts`).
- **Xét lại khi**: có số đo cho thấy máy dùng chung là phổ biến (nhịp
  `customer_devices` có thể đo), hoặc khi thêm bất kỳ dữ liệu **theo người** nào
  vào allowlist — lúc đó Option B thành bắt buộc.

## References

- `public/sw.js:677-698` (`isRescuableStatus`), `:1222-1233` (nhánh `/api/*`)
- `docs/app-map/ops/audit-offline-vong2-2026-08-02.md` §T4
- `docs/app-map/01-product.md` — luật premium trục 1

## History

- **2026-08-01**: chủ dự án chốt luật "premium gác cửa TẢI, không gác cửa XEM".
- **2026-08-16**: Accepted — tái xác nhận sau bản thẩm định, ghi thành ADR.
