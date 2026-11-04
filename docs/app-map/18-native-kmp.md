# 18 — App native iOS + Android (KMP + Compose + SwiftUI): kiểm kê + lộ trình

> **Load khi**: làm bất cứ gì trong `shared/`, `androidApp/`, `iosApp/`; port một màn/logic web sang native; đổi logic `src/lib/` đã có bản Kotlin.
> Quyết định: [ADR 0019](../adr/0019-app-native-kmp.md) (2026-11-04). Web/PWA vẫn một bản Next.js — doc này KHÔNG đổi gì ở web.

## 1. Kiến trúc đích

```
ForFish/
  src/                 # web/PWA Next.js + API /api/* (BACKEND CHUNG — giữ nguyên)
  shared/              # KMP: commonMain + androidMain + iosMain
    model/             #   kiểu dữ liệu (= types TS), serialization
    api/               #   Ktor client gọi /api/*, Supabase-kt (auth + bảng RLS)
    kho/               #   SQLDelight — thay localStorage `forfish.*` + IndexedDB
    du-lieu/           #   data-codec SDF1/SDF2 (gzip + AES-256-CTR), khoá dữ liệu, tải có nhịp
    sen-bien/          #   n-gram, luật hiểu ý, kho hỏi–đáp, giao diện Gemma (expect/actual)
    bien/              #   dự báo cá, dẫn đường, con nước, điểm đi biển, thời tiết…
    testdata/          #   golden vectors sinh từ Vitest — cổng khớp TS ↔ Kotlin
  androidApp/          # Jetpack Compose + MapLibre Native Android + LiteRT-LM Kotlin
  iosApp/              # SwiftUI + MapLibre Native iOS + LiteRT-LM Swift
  android/ ios/        # vỏ Capacitor — GIỮ phát hành tới khi native đủ (§4), rồi gỡ
```

- Máy chủ không đổi: native là một máy khách nữa của `/api/*` (175 route) và Supabase (RLS owner-only).
- Định danh store giữ nguyên ⇒ bản native **cập nhật đè** bản Capacitor: Android `vn.sdvico.forfish`, iOS `vn.sdvico.sdfish`.
- Bản đồ: MapLibre Native đọc cùng style + pmtiles; lớp SDF2 giải mã trong `shared/du-lieu` rồi cấp qua nguồn tuỳ biến — **rủi ro kỹ thuật lớn nhất**, làm thử nghiệm ở đợt 0.

## 2. Kiểm kê web phải có bản native (origin/main 0055e678, 2026-11-04)

| Nhóm | Route web | Ghi chú native |
|---|---|---|
| Vỏ + tài khoản | `/login` `/dang-ky` `/quen-mat-khau` `/doi-mat-khau` `/chon-vai` · dock theo vai (17) | auth qua `/api/auth/*` + Supabase-kt |
| Trang chủ | `/` (3 vai, thẻ Hôm nay, bão, khuyến mãi) | |
| Bản đồ / ngư trường | `/ngu-truong` `/cang` `/lo-trinh` | MapLibre Native, lớp offline SDF2, AIS, dẫn đường, Đang chạy giọng nói (15), premium (`tier.ts`) |
| Sen Biển | toàn app (13, 15) | nghe trong máy (bộ nghe 34 MB), n-gram v8, kho hỏi–đáp, Gemma (ADR 0012), giọng Mỹ Duyên ghép mảnh, hỏi máy nhà (ADR 0016) |
| Tàu tôi | `/tau` `/giay-to` `/thuyen-vien` `/nguoi` `/van-hanh` | chụp giấy + đọc hạn (ADR 0017), Xuất trình offline, đa tàu (08) |
| Chợ / vật tư | `/cho/**` (giỏ, đơn, shop, sp, tìm, yêu cầu, thanh toán, đơn SDVICO) | 11, 12, ADR 0018 |
| Bán hàng | `/ban-hang/**` (đăng ký, sản phẩm, đơn, yêu cầu, cài đặt) | vai Đại lý (17) |
| Giao dịch | `/tien` `/tien/vua` `/gia-ca` | |
| Việc làm | `/viec/**` | 17 §6 |
| Kairos | `/kairos/**` `/k/[id]` | 14, 16 |
| Khác | `/quyen-rieng-tu` | trang tĩnh trong app |
| **Không làm native** | `/quan-tri` `/dev` | công cụ nội bộ — ở web (Assumption, §6) |

Khối lượng tham chiếu: 56 trang, 223 component, 459 file `lib/`, ~274k dòng TS, 96 khoá `forfish.*`.

## 3. Lộ trình theo đợt

Mỗi đợt = build nội bộ chạy được trên máy thật (Android build ở gpu-desktop, iOS ở Mac — ops/native-deploy §3e), có test, doc cùng commit. **Phát hành store chỉ ở đợt cuối** (chủ dự án chọn "đủ như web").

| Đợt | Nội dung | Xong khi |
|---|---|---|
| **0. Khung** | Gradle KMP + `shared/` + `androidApp/` + `iosApp/` (SPM/XCFramework); CI build hai nền; **thử nghiệm rủi ro**: MapLibre Native hiện một lớp SDF2 đã giải mã + LiteRT-LM gọi từ `shared/` | hai app trống mở được, bản đồ nền + một lớp offline hiện trên emulator/simulator |
| 1. Nền | model + Ktor/Supabase-kt + đăng nhập + vai + dock + Trang chủ; kho SQLDelight; codec SDF1/SDF2 + khoá dữ liệu; cổng golden vectors TS ↔ Kotlin; **chuyển dữ liệu từ WebView Capacitor cũ** | đăng nhập acc test, Trang chủ đúng 3 vai, mất sóng vẫn mở |
| 2. Bản đồ | ngư trường + mọi lớp + thời tiết/bão/con nước + điểm đi biển + dẫn đường + Đang chạy giọng nói + AIS + premium | đối chiếu từng lớp với web (QA offline bắt buộc) |
| 3. Sen Biển | nghe trong máy, n-gram, kho, Gemma, giọng ghép mảnh, TTS, máy nhà | chấm bộ câu thật ≥ bản web |
| 4. Tàu tôi | giấy tờ (chụp, đọc hạn, Xuất trình offline), thuyền viên, bảo dưỡng, đa tàu, chuyến biển | |
| 5. Giao dịch | chợ, giỏ, đơn, shop, bán hàng, giá cả, tiền/vựa | |
| 6. Cộng đồng | Kairos, việc làm, push, khuyến mãi | |
| 7. Phát hành | đối chiếu đủ bảng §2, store listing, gỡ `android/` `ios/` Capacitor + plugin cục bộ đã chuyển | bản native lên Play + App Store đè bản Capacitor |

## 4. Trong lúc chuyển

- Bản Capacitor vẫn là bản phát hành; sửa lỗi của nó vẫn làm (vd thẻ "Cài app" hiện trong app native — ẩn bằng `Capacitor.isNativePlatform()`).
- Tính năng mới của web từ nay phải ghi "native: chưa / đợt N" trong spec của nó để không rơi khỏi bảng §2.

## 5. Cổng khớp logic TS ↔ Kotlin

- Mỗi file `src/lib/` được port: test Vitest xuất `shared/testdata/<ten>.json` (vào/ra), test Kotlin đọc lại cùng file. Đổi logic một bên ⇒ test bên kia đỏ.
- Áp đầu tiên cho: `sen-bien/ngram`, `hieu-y`, `data-codec`, `fish-predict`, điểm đi biển, dẫn đường.

## 6. Assumptions

- `/quan-tri` và `/dev` KHÔNG làm native (công cụ nội bộ, mở web) — mặc định an toàn nhất, chờ chủ dự án xác nhận.
- Đăng nhập, RLS, quyền giữ nguyên phía máy chủ; native không có quyền nào web không có.
- Offline (CLAUDE.md, chỉ vai chủ tàu): bản native phải qua đủ bộ `ops/qa-offline-acceptance.md` trước khi phát hành.

**Last updated**: 2026-11-04 — tạo doc theo ADR 0019.
