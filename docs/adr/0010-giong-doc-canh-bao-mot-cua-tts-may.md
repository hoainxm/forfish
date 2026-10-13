# ADR 0010 — Giọng đọc cảnh báo khi chạy: MỘT cửa TTS của máy, hải đồ ưu tiên số một, không có giọng Việt thì im

**Status**: Accepted
**Date**: 2026-10-13
**Deciders**: chủ dự án ("làm luôn, thêm dependency, ngưỡng nghiệp vụ ok" — 2026-10-13)

> Số 0009 đã dùng ở nhánh `feat/san-thuong-mai` (Trợ lý giọng nói, chưa gộp) — đánh 0010 để hai nhánh gộp không trùng.

---

## Context / Bối cảnh

Chủ dự án muốn chế độ "đang chạy" kiểu VietMap: chỉ cần vị trí là máy ĐỌC TO cảnh báo biển cho thuyền trưởng, chạy offline với dữ liệu bản đồ; và chốt thêm *"lưới độ sâu, rạn các kiểu, hải đồ là quan trọng nhất trong việc đọc lên và cảnh báo"*. App đã có bộ não cảnh báo (nav-hazards, geofence, nav-progress) nhưng chỉ in chữ + chuông. Ba sự thật kỹ thuật (doc 15 §11, tra nguồn 2026-10-12):

1. **Android WebView không có `speechSynthesis`** — bản app bọc Capacitor trên Android (đa số ngư dân) không đọc được bằng Web Speech.
2. Không có giọng Việt, iOS cũ **đánh vần từng chữ** thay vì im — đọc bằng giọng khác còn tệ hơn im.
3. Đọc khi khoá màn cần background location + audio nền ⇒ xét lại hồ sơ App Store (đã bị từ chối 2 lần, 5.1.2).

## Decision / Quyết định

Một cửa `lib/voice/tts.ts` dùng **engine TTS của máy** (native ⇒ plugin `@capacitor-community/text-to-speech`, web ⇒ Web Speech giọng `vi*`); **không có giọng Việt thì im** (chuông + chữ vẫn chạy); mọi câu đi qua **một bộ phát ngôn thuần** (`lib/nav-voice/announcer.ts`) trong đó **cảnh báo hải đồ đứng đầu và chỉ "Tắt giọng" mới chặn được**; chỉ đọc khi màn sáng (Wake Lock), chạy nền là nợ có trần.

## Alternatives considered / Phương án đã cân nhắc

### Option A: Web Speech thuần (không dep mới)
- ✅ Không thêm gói, chạy ngay trên PWA.
- ❌ **Android app câm** — đúng nhóm người dùng đông nhất. Loại.

### Option B: Bản ghi âm sẵn ghép câu
- ✅ Giọng người thật, chạy mọi máy.
- ❌ Chỉ đọc được câu cố định — không đọc được tên xác tàu, khoảng cách, giờ tải số; thêm asset vào SW (đụng `sw.js`). Để dành làm dự phòng ~10 câu cốt lõi (doc 15 §11), không làm đường chính.

### Option C: Engine TTS của máy qua một cửa + bộ phát ngôn thuần ← đã chọn
- ✅ Android + iOS + web cùng một API; offline (gói giọng tải về máy); câu động đầy đủ; mọi luật (ưu tiên, chống lặp, nhịp, mức nói) test được không cần loa.
- ❌ Chất lượng giọng tuỳ máy; máy chưa có gói tiếng Việt phải tải (có nút Tải giọng); 1 dep mới.

### Option D: Chạy nền (background-geolocation + audio nền)
- ✅ Khoá màn vẫn đọc.
- ❌ Quyền "luôn luôn", tờ khai Play, rủi ro App Store, Xiaomi/Oppo vẫn giết app. **Nợ có trần**: làm khi cảnh báo IUU được ghi là tính năng chính trong hồ sơ store VÀ ≥30 % người dùng báo "tắt màn mất cảnh báo".

## Consequences / Hệ quả

- **Tích cực**: cảnh báo hải đồ (độ sâu, rạn, xác tàu, chướng ngại, vùng cấm) được đọc to ở cả hai mốc "sắp tới / rất gần", có nghiệm thu 25 tiêu chí trên thế giới giả + hải đồ thật; không thêm request mạng nào; không đụng `sw.js`.
- **Đánh đổi**: khoá màn là im (nói thật trong tấm "Bắt đầu chạy"); máy không có giọng Việt chỉ còn chuông + chữ; thêm khoá `forfish.nav.voice.v1`.

## References

- [docs/app-map/15-flow-dang-chay-giong-noi.md](../app-map/15-flow-dang-chay-giong-noi.md) — flow + §16 bảng tiêu chí
- [07-design-spec §10.7 S](../app-map/07-design-spec.md) · [ops/native-deploy §3b](../app-map/ops/native-deploy.md) · [ops/qa-offline-acceptance N-14](../app-map/ops/qa-offline-acceptance.md)
