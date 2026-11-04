# 18 — App native iOS + Android (KMP + Compose + SwiftUI): kiểm kê + lộ trình

> **Load khi**: làm bất cứ gì trong `shared/`, `androidApp/`, `iosApp/`; port một màn/logic web sang native; đổi logic `src/lib/` đã có bản Kotlin.
> Quyết định: [ADR 0019](../adr/0019-app-native-kmp.md) (2026-11-04). Web/PWA vẫn một bản Next.js — doc này KHÔNG đổi gì ở web.

## 1. Kiến trúc đích

```
ForFish/
  src/                    # web/PWA Next.js + API /api/* (BACKEND CHUNG — giữ nguyên)
  native/                 # toàn bộ app native (một Gradle build riêng — gốc repo không thêm file)
    settings.gradle.kts   #   androidApp chỉ được include khi máy có Android SDK (Mac build iOS không cần SDK)
    shared/               #   KMP: commonMain · jvmMain (Android dùng biến thể JVM) · iosMain (iosArm64 + iosSimulatorArm64)
      dulieu/             #     DataCodec (SDF1/SDF2) + NenTang (AES-CTR/gunzip/SHA-256: javax.crypto | CommonCrypto + zlib)
      bando/              #     KieuBanDo (style MapLibre chung), TramTrieu
      senbien/            #     SenBienGemma (SYSTEM, userMsg, docDap) + interface MayGemma (mỗi nền cài bộ chạy)
      ios/                #     CauNoiIos — cầu Swift ↔ Kotlin (NSData)
      commonTest/         #     golden vectors sinh từ code web (§5)
    androidApp/           #   Jetpack Compose + MapLibre Android 13.7.1 + LiteRT-LM Android 0.18.0
    iosApp/               #   SwiftUI + MapLibre iOS 7.0.0 + LiteRT-LM Swift 0.18.0; project sinh từ project.yml (XcodeGen)
    scripts/sinh-testdata.mjs
  android/ ios/           # vỏ Capacitor — GIỮ phát hành tới khi native đủ (§4), rồi gỡ
```

- Phiên bản ghim theo bản Capacitor đang chạy: Gradle 8.14.3, AGP 8.13.0, Kotlin 2.4.0, JDK 21 (Mac: `~/.local/jdk-21`, GPU: `~/android-tools/jdk`).
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
| **0. Khung** ✅ 2026-11-04 (§3a) | Gradle KMP + `shared/` + `androidApp/` + `iosApp/` (SPM/XCFramework); CI build hai nền; **thử nghiệm rủi ro**: MapLibre Native hiện một lớp SDF2 đã giải mã + LiteRT-LM gọi từ `shared/` | hai app trống mở được, bản đồ nền + một lớp offline hiện trên emulator/simulator |
| 1. Nền | model + Ktor/Supabase-kt + đăng nhập + vai + dock + Trang chủ; kho SQLDelight; codec SDF1/SDF2 + khoá dữ liệu; cổng golden vectors TS ↔ Kotlin; **chuyển dữ liệu từ WebView Capacitor cũ** | đăng nhập acc test, Trang chủ đúng 3 vai, mất sóng vẫn mở |
| 2. Bản đồ | ngư trường + mọi lớp + thời tiết/bão/con nước + điểm đi biển + dẫn đường + Đang chạy giọng nói + AIS + premium | đối chiếu từng lớp với web (QA offline bắt buộc) |
| 3. Sen Biển | nghe trong máy, n-gram, kho, Gemma, giọng ghép mảnh, TTS, máy nhà | chấm bộ câu thật ≥ bản web |
| 4. Tàu tôi | giấy tờ (chụp, đọc hạn, Xuất trình offline), thuyền viên, bảo dưỡng, đa tàu, chuyến biển | |
| 5. Giao dịch | chợ, giỏ, đơn, shop, bán hàng, giá cả, tiền/vựa | |
| 6. Cộng đồng | Kairos, việc làm, push, khuyến mãi | |
| 7. Phát hành | đối chiếu đủ bảng §2, store listing, gỡ `android/` `ios/` Capacitor + plugin cục bộ đã chuyển | bản native lên Play + App Store đè bản Capacitor |

### 3a. Kết quả đợt 0 (2026-11-04)

| Kiểm | Android (emulator Android 15 x86_64, gpu-desktop) | iOS (simulator iPhone 18 Pro iOS 27, Mac) |
|---|---|---|
| Test `shared` (codec khớp web từng byte, Gemma, trạm triều) | `jvmTest` 18/18 xanh (Mac + GPU) | `iosSimulatorArm64Test` 18/18 xanh (CommonCrypto + zlib khớp web) |
| Nền `vn-basemap.pmtiles` qua `pmtiles://file://` | vẽ đúng đất/nước | vẽ đúng đất/nước |
| Trạm con nước SDF1 tải từ sdfish.sdvico.vn, `shared` giải + GeoJSON | 106 trạm, 80.730 B | 106 trạm, 80.730 B |
| Gemma g270v5r gọi qua `shared` (`MayGemma`) | nạp 2,7 s; 0,58–1,35 s/câu, đúng ý 3/3 | nạp 0,52 s; 0,47–0,95 s/câu, đúng ý 3/3 (qua cầu Swift `MayGemma`) |

- Đợt 0 dùng id RIÊNG `vn.sdvico.forfish.native` (cả hai nền) để cài cạnh bản Capacitor; nền + Gemma chép vào bản build (bản rõ từ `public/data`, gitignore) — đợt 1 thay bằng tải + giải SDF2 theo tài khoản.
- APK debug 190 MB vì mang nền 14 MB + Gemma 62 MB + lõi LiteRT/MapLibre đủ ABI; bản phát hành tách ABI + gói on-demand như §3c ops/native-deploy.
- Bẫy Mac: IPv6 hỏng ⇒ Gradle không tải được Kotlin/Native — `gradle.properties` ép `-Djava.net.preferIPv4Stack=true`.

## 4. Trong lúc chuyển

- Bản Capacitor vẫn là bản phát hành; sửa lỗi của nó vẫn làm (vd thẻ "Cài app" hiện trong app native — ẩn bằng `Capacitor.isNativePlatform()`).
- Tính năng mới của web từ nay phải ghi "native: chưa / đợt N" trong spec của nó để không rơi khỏi bảng §2.

## 5. Cổng khớp logic TS ↔ Kotlin

- Mỗi file `src/lib/` được port có một script ở `native/scripts/` CHẠY CHÍNH CODE WEB sinh vector vào/ra thành file Kotlin trong `commonTest` (vd `sinh-testdata.mjs` → `GoldenDataCodec.kt`). Đổi code web ⇒ chạy lại script ⇒ test Kotlin đỏ nếu bản Kotlin chưa theo.
- **Luật đồng bộ (thay hàng trong bảng Doc + Test sync của CLAUDE.md — file đó đã chạm trần hook)**: đổi `native/**` ⇒ cập nhật doc này cùng commit; đổi một file `src/lib/` đã có bản Kotlin ⇒ chạy lại `native/scripts/sinh-*.mjs` và sửa bản Kotlin cùng commit.
- Áp đầu tiên cho: `sen-bien/ngram`, `hieu-y`, `data-codec`, `fish-predict`, điểm đi biển, dẫn đường.

## 6. Assumptions

- `/quan-tri` và `/dev` KHÔNG làm native (công cụ nội bộ, mở web) — mặc định an toàn nhất, chờ chủ dự án xác nhận.
- Đăng nhập, RLS, quyền giữ nguyên phía máy chủ; native không có quyền nào web không có.
- Offline (CLAUDE.md, chỉ vai chủ tàu): bản native phải qua đủ bộ `ops/qa-offline-acceptance.md` trước khi phát hành.

**Last updated**: 2026-11-04 — đợt 0 xong cả Android lẫn iOS (§3a). Trước đó: 2026-11-04 — tạo doc theo ADR 0019.
