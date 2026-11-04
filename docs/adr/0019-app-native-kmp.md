# ADR 0019 — App native iOS + Android bằng Kotlin Multiplatform (logic chung) + Compose / SwiftUI (UI riêng), thay vỏ Capacitor

**Status**: Accepted (2026-11-04) — lộ trình theo đợt ở [app-map 18](../app-map/18-native-kmp.md)
**Date**: 2026-11-04
**Deciders**: chủ dự án (anh Long: *"t muốn làm native trên ios, android, bản pwa độc lập, bản web độc lập"*; chọn KMP + UI riêng, đủ như web, trong repo ForFish, PWA/web giữ một bản)

---

## Context / Bối cảnh

Từ 06/2026 app trên CH Play / App Store là **vỏ Capacitor**: một WebView mở web đã deploy (`server.url`, nay `https://sdfish.sdvico.vn/`), chỗ web không làm được thì viết plugin native (GPS 26/8, đọc giọng 13/10, Gemma Sen Biển 17/10 Android + 03/11 iOS — ADR 0012).

Hệ quả đã gặp: app chết theo web (alpha 503 ngày 27/10 ⇒ app mở ra trang lỗi); dữ liệu trong máy gắn origin web (đổi domain ⇒ mất); thẻ "Cài app" của PWA hiện ngay trong app native (kiểm emulator 04/11) vì WebView không báo `standalone`; bản trên Play (1.0.3, 01/08/2026) vẫn mở `forfish.vercel.app` và thiếu mọi plugin sau đó. Chủ dự án muốn hai app **native thật** cho iOS và Android, còn web/PWA là bản riêng.

Quy mô web hiện tại (đo 04/11 trên `origin/main`): 56 trang, 223 component, 459 file `lib/`, ~274 nghìn dòng TS, 175 route API, 96 khoá `forfish.*` trong máy.

## Decision / Quyết định

Viết **hai app native** trong repo ForFish: **logic dùng chung bằng Kotlin Multiplatform** (module `shared/`), **UI Android bằng Jetpack Compose**, **UI iOS bằng SwiftUI**; làm **đủ như web**; **máy chủ giữ nguyên** (route `/api/*` Next.js + Supabase là backend chung của web và native). Web/PWA vẫn là **một bản** Next.js như nay.

## Alternatives considered / Phương án đã cân nhắc

### Option A: Giữ Capacitor, thêm plugin dần (khuyến nghị cũ)
- ✅ Một bộ code cho ba nền; tính năng mới làm một lần
- ❌ App vẫn là trang web: chết theo web, dữ liệu theo origin, cảm giác không "native"; chủ dự án không chọn

### Option B: KMP logic chung + Compose / SwiftUI ← chosen
- ✅ UI chuẩn từng nền; logic (dữ liệu, offline, Sen Biển, dự báo, dẫn đường, giải mã SDF2) viết MỘT lần bằng Kotlin, chạy cả iOS
- ✅ Gemma (LiteRT-LM), bản đồ (MapLibre Native), GPS, giọng đọc gọi thẳng SDK nền, không qua cầu JS
- ❌ Logic tồn tại hai bản: TypeScript (web) và Kotlin (native) ⇒ phải có **bộ kiểm khớp** (golden vectors, §Hệ quả)
- ❌ Mỗi màn có ba bản UI (web, Compose, SwiftUI)

### Option C: Hai bộ native thuần riêng (Kotlin + Swift, không chung)
- ✅ Thuần nhất
- ❌ Logic ba bản (TS, Kotlin, Swift); n-gram/dự báo/codec lệch nhau là chuyện sớm muộn

### Option D: Compose Multiplatform (chung cả UI)
- ✅ Ít code nhất
- ❌ UI iOS không hoàn toàn chuẩn iOS — trái ý "native" của chủ dự án

## Consequences / Hệ quả

- **Tích cực**: app chạy độc lập với web lúc mở (vỏ không còn tải trang), offline là dữ liệu native (SQLite) không bị trình duyệt dọn, Gemma/bản đồ/GPS nhanh hơn, hết lỗi PWA-trong-app.
- **Đánh đổi**:
  - **Khối lượng**: viết lại toàn bộ UI hai lần + logic một lần — tính bằng tháng; Capacitor vẫn là bản phát hành tới khi native ĐỦ (không phát hành nửa vời, chủ dự án chọn "đủ như web").
  - **Hai bản logic (TS ↔ Kotlin)**: mỗi `lib/` được port phải có test vector dùng chung (`shared/testdata/*.json` sinh từ test Vitest) — sửa logic một bên mà không sửa bên kia thì cổng đỏ. Thêm hàng vào bảng Doc + Test sync của CLAUDE.md.
  - **Luật doc**: mọi màn native ghi vào 07-design-spec (cột Android/iOS), 02 thêm cây `shared/ androidApp/ iosApp/`.
  - **Chuyển dữ liệu**: bản native cập nhật ĐÈ bản Capacitor (cùng package `vn.sdvico.forfish` / bundle `vn.sdvico.sdfish`) ⇒ lần mở đầu phải chuyển dữ liệu bà con từ localStorage của WebView cũ (origin sdfish.sdvico.vn) sang kho native — mất sổ là mất an toàn ngoài biển (CLAUDE.md nguyên tắc 4).
- **Trung tính**: backend, Supabase, RLS, route `/api/*`, cổng dữ liệu `dataGate`, mã hoá SDF1/SDF2 giữ nguyên — native là một máy khách nữa.

## References

- App-map: [18-native-kmp](../app-map/18-native-kmp.md) (lộ trình + kiểm kê), [ops/native-deploy](../app-map/ops/native-deploy.md)
- ADR liên quan: 0012 (Gemma trong máy — plugin Kotlin/Swift tái dùng cho native)

## History

- **2026-11-04**: Accepted — chủ dự án chọn KMP + UI riêng, đủ như web, trong repo ForFish, PWA/web giữ một bản
