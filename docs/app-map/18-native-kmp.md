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
      kho/                #     KhoMay (KV: SharedPreferences | UserDefaults) — TÊN KHOÁ + ĐỊNH DẠNG Y WEB; ChuyenKhoCu
      api/                #     MayChu (Ktor: CIO | Darwin) — một cửa /api/…, gắn x-sdfish-token
      taikhoan/           #     PhienMay · DangNhap · KhoaDuLieu · SoDienThoai · CauLoi
      vai/                #     Vai · Dock · VaiMay (đồng bộ /api/me/vai)
      trangchu/           #     NguonTinBao
      sinh/NhanSinh.kt    #     SINH từ labels.ts + vai.ts (sinh-vai-dock.mjs) — không gõ lại nhãn
      UngDung.kt          #     hộp chung mỗi nền tạo một lần; CauHinh sinh lúc build từ .env.local (không vào git)
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
| **1. Nền** ✅ 2026-11-04 (§3b) | model + Ktor/Supabase-kt + đăng nhập + vai + dock + Trang chủ; kho SQLDelight; codec SDF1/SDF2 + khoá dữ liệu; cổng golden vectors TS ↔ Kotlin; **chuyển dữ liệu từ WebView Capacitor cũ** | đăng nhập acc test, Trang chủ đúng 3 vai, mất sóng vẫn mở |
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

### 3b. Kết quả đợt 1 (2026-11-04)

**Đã làm** (cả hai nền, logic chung ở `shared`): khách dùng ngay không cần đăng nhập (như web) · đăng nhập SĐT + mật khẩu · đặt mật khẩu lần đầu · đăng xuất · bị máy khác đá · chọn vai · dock theo vai · Trang chủ: tin bão thường trực + dòng tài khoản + thẻ bị đá + mời chọn vai · xin khoá SDF2 sau đăng nhập · chuyển kho bản Capacitor cũ. Ô dock chưa làm native ghi "đợt N"; ô Bản đồ vẫn là màn thử đợt 0.

**Kiểm** (Android emulator ở gpu-desktop + iOS simulator; acc test 0900000777, chuỗi do `scripts/test-account.mjs` cấp, đã thu hồi):

| Ca | Kết quả (cả hai nền) |
|---|---|
| Khách mở app | dock 6 ô, tin bão "Không có tin bão · Hỏi lúc" |
| Đăng nhập mật khẩu với acc test | Supabase trả `user_banned` (acc test cố ý chặn mật khẩu) ⇒ app nói đúng câu web — đường mật khẩu đi tới máy thật |
| Có chuỗi | xin được khoá dữ liệu, vai `chu-tau` đồng bộ từ máy chủ, ~5 s từ lúc mở (Android) |
| Chuyển kho cũ (gieo 3 khoá ở origin cũ) | chép 2, bỏ 1 (chuỗi native đang có KHÔNG bị đè) |
| Mất sóng (máy chủ trỏ địa chỉ chết) | vẫn đăng nhập, vẫn vai + dock; tin bão "Chưa hỏi được · Lần cuối hỏi lúc 09:22: không có bão" |
| Bị đá (iOS đăng xuất ⇒ Android gọi tiếp) | 401 `token_revoked` ⇒ gỡ chuỗi, GIỮ danh tính + hạng + khoá dữ liệu, thẻ đỏ "đăng nhập ở máy khác" |
| Test `shared` | 38/38 xanh JVM + iOS simulator (vector khớp web: dock, vai, SĐT, câu lỗi, codec) |

**Quyết định trong đợt** (mặc định an toàn nhất, không đổi máy chủ):
- Đăng nhập y luồng web: Supabase password grant từ máy (đếm chống dò theo IP thật) ⇒ `/api/auth/token` với cookie `@supabase/ssr` máy tự dựng ⇒ chuỗi cứng. Nợ đã ghi ở `DangNhap.kt` (bỏ khi route nhận Bearer — đổi máy chủ, phải hỏi).
- Kho = KV (`KhoMay`), không SQLDelight: tên khoá + định dạng y web ⇒ chuyển kho cũ là chép thẳng. SQLDelight khi một miền cần truy vấn (đợt 4).
- Ktor engine JVM/Android là CIO: `ktor-client-okhttp` 3.6 kéo OkHttp 5.5 đòi compileSdk 37 (AGP 8.13 trần 36).
- Dock iOS tự vẽ: `TabView` chỉ hiện 5 ô, ô thứ 6 gom vào "More" (chữ tiếng Anh).
- Chuyển kho cũ: WebView/WKWebView ẩn nạp trang trống đúng origin `https://sdfish.sdvico.vn/` (chặn mọi request — không cần mạng) rồi đọc `forfish.*`. Chỉ có dữ liệu khi bản native đè bản Capacitor (đợt 7); chép một lần, không đè khoá native, ghi hỏng thì lần sau thử lại.
- Bản debug có cờ thử: Android `--es chuoi/sdt/gieoKhoCu/webGoc`, iOS `SIMCTL_CHILD_*` cùng tên.

**Chưa làm — đi theo đợt của miền**: các khối còn lại của Trang chủ (biển hôm nay, việc cần làm, con nước → đợt 2; giấy tờ, nhắc hạn → 4; thông báo, khuyến mãi, Kairos → 6; tin tuyển, cá đang bán, giá → 5); màn Đăng ký / Quên mật khẩu (dẫn sang web tới đợt 7); giao diện theo design-spec (07) — đợt 1 dùng mặc định Material / SwiftUI.

### 3c. Hệ giao diện như web (2026-11-04, sau phản hồi "sao giao diện ko giống với web")

Đợt 1 để mặc định Material / SwiftUI ⇒ lệch web. Nay native DÙNG CHUNG nguồn giao diện của web, không gõ lại:
- `native/scripts/sinh-giao-dien.mjs` đọc `src/app/globals.css` (`:root`) + `src/components/icons.tsx` ⇒ `shared/giaodien/MauSinh.kt` (41 token màu ARGB, bỏ màu nội dung `--sp-*`), `CoSinh.kt` (bậc `--h-cta/ctl/chip/row`, `--r-card/ctl`, dock), `BieuTuongSinh.kt` (78 icon nét, circle/rect/line/polyline đổi sang path). Đổi token/icon ở web ⇒ chạy lại script.
- `DuongVe.kt` (shared): đọc path SVG ⇒ lệnh vẽ tuyệt đối (cung → Bézier) cho iOS vẽ icon bằng SwiftUI `Path`; Android dùng `PathParser` của Compose.
- Font = web (`layout.tsx`): Archivo 600/700 (tiêu đề) + Plus Jakarta Sans 400–700 (chữ), TTF Google Fonts (OFL) trong `androidApp/res/font` + `iosApp/ForFishNative/Fonts` (`UIAppFonts`).
- Mảnh chung cùng tên hai nền (`androidApp/…/giaodien/Manh.kt`, `iosApp/…/GiaoDien.swift`): `ManHeader`, `The` (.surface), `Hang`, `NutChinh` (cam, `--h-cta`), `NutPhu` (.sq-btn), `ONhap`, `NhanO`, `TheTrangThai` (nền ok/warn/danger chỉ khi có việc), `HangYen` (StormBanner yên), `DockNoi` (dock nổi kiểu Facebook, chỉ icon, pill sea/12, ô Kairos = ảnh cá).
- Đối chiếu web 375px (sdfish.sdvico.vn) với Android emulator + iOS simulator: tiêu đề, hàng tin bão, dock, màn đăng nhập cùng màu / chữ / khối.

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

**Last updated**: 2026-11-04 — đợt 1 xong cả hai nền (§3b). Trước đó: đợt 0 xong cả Android lẫn iOS (§3a). Trước đó: 2026-11-04 — tạo doc theo ADR 0019.
