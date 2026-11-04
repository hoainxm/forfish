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

### 3d. Đợt 2 — bản đồ: kiểm kê web + chia đợt con (2026-11-04)

**Đã có**: `shared/dulieu/TaiDuLieu.kt` — tải `/data/<tên>` kèm chuỗi ⇒ giải SDF1/SDF2 bằng khoá tài khoản (thiếu khoá ⇒ xin lại một lần, cho ca admin xoay khoá) ⇒ cất BẢN RÕ vào thư mục riêng app (`KhoTepFile` Android, `KhoTepIos` Application Support — ghi nguyên tử). Hỏi lại bằng ETag (luật web "đổi nội dung thì đè cùng đường dẫn"); mất sóng / 401/403 / lỗi giải / ghi hỏng ⇒ dùng bản đã cất, KHÔNG xoá. MapLibre đọc thẳng file (`pmtiles://file://`, GeoJSON) — không cần cầu protocol như web. Test 6 ca (48/48 xanh).

**Kiểm kê web** (`ocean-map.ts` O, `fishing-map-view.tsx` V, `ra-khoi-controls.tsx` R):
- Nền: `buildMapStyle(layerId, {seamarks:false})` (O:984) — chạy được bằng jiti trong script sinh (đã thử: 17 lớp, `sea-bg` → hình học Protomaps light lọc → `sea-mask` → `base-top`); glyph `/fonts/{fontstack}/{range}.pbf`, sprite `https://…/icons/chart-sprite`. Lớp nền raster `/api/tiles/{chart|sst|chlorophyll}` = premium; `isobaths.v1.json` chỉ khi hải đồ độ sâu.
- Lớp hải đồ (free, mặc định bật, ba nhóm dưới công tắc "Hải đồ chi tiết"): Độ sâu & đáy (`soundings`, `fairway-depths`, `coral-reefs`; chất đáy + hình rạn pmtiles = premium) · Báo hiệu & nguy hiểm (`vn-sea-lanes`, `reef-shapes`, `seamarks` 3 tầng, `vn-aids`, `xac-tau`, `den-bien`, `khu-tru-bao`) · Tên địa danh ngầm. Luôn bật: nhãn chủ quyền (`SOVEREIGNTY_LABELS`), đảo `vn-islands`, bờ offline. Cài đặt: trạm con nước, vùng lộng, vùng quản lý, lưới toạ độ.
- Dữ liệu KHÔNG phải GeoJSON: V đổi trong `useMemo` (soundingGeo/depthLineGeo/denBienGeo/xacTauGeo/khuTruBaoGeo/vungQuanLyGeo… V:2970–3130) dùng hàm phụ lib (`fmtDepthM`, `soundingAgeDays`/`isStale`, `lighthouseSymbolId`, `lightAbbrev`, `wreckSymbolId`, `dangVung`, phán điểm nghi lỗi `verdicts`). Hằng lớp xuất sẵn: `SOUNDING_DOT/LABEL_LAYER`, `DEPTH_LINE_LAYER`, `LIGHTHOUSE(_LABEL)_LAYER`, `WRECK_LAYER`, `TIDE_STATION(_LABEL)_LAYER`; lớp còn lại viết thẳng trong JSX.
- Động (premium/theo ngày): gió/sóng/dòng chảy/mây/mưa… (lớp WebGL `scalar-gl-field`, `WindParticles`), dự báo cá `/api/fish-forecast`, AIS, mật độ tàu, độ mặn, SSHA.
- Rail `RaKhoiControls` (R:104): Hải đồ · Ngư trường · Thời tiết · Công cụ · Cài đặt; luật loại trừ (một nền raster, một lớp động, cá ↔ mật độ).
- GPS: `useNavTracking` + `NavBoatMarker` + `NutViTri` + `PlotterReadout`.

**Đợt con** (mỗi đợt build Android ở GPU + iOS ở Mac, đối chiếu web, commit):
- 2a nền sinh từ `buildMapStyle` + tải nền/lớp qua `TaiDuLieu` + lớp có hằng xuất sẵn (độ sâu, đường độ sâu, đèn biển, xác tàu, trạm con nước) + đảo + nhãn chủ quyền + GPS/vị trí tàu.
- 2b nhóm Báo hiệu còn lại + rạn + địa danh ngầm + vùng lộng/vùng quản lý + khu trú bão + rail Hải đồ/Cài đặt.
- 2c lớp nền premium (raster qua header chuỗi) + chất đáy/hình rạn pmtiles + đẳng sâu.
- 2d thời tiết động (trường GL + mũi tên + hạt gió) + thẻ chạm điểm.
- 2e dự báo cá + mật độ tàu + AIS.
- 2f dẫn đường + Đang chạy giọng nói.

### 3e. Chia việc hai máy (2026-11-04, anh Long)

- **PC GPU (Windows, `C:\Code\ForFish`) viết `shared` + Android**: `native/shared` (commonMain/commonTest/jvmMain/jvmTest), `native/androidApp`, `native/scripts`, doc. **WSL CHỈ để train** — không code, không build app ở WSL (bản clone `~/ForFish` của WSL không dùng cho native nữa).
- **Mac viết iOS**: `native/iosApp` (Swift) + build/kiểm `shared/iosMain`. PC chỉ sửa `iosMain` khi bắt buộc (expect/actual) và ghi "chưa build iOS — Mac kiểm".
- Hai máy cùng push `feat/app-native-kmp` ⇒ luôn `git pull --rebase` trước push. Mỗi đợt con PC ghi mục **"Cho Mac"** dưới đây: API `shared` Swift cần gọi + màn Android tương ứng.
- Công cụ Windows (ngoài repo, không cần admin): `C:\Users\admin\android-tools` — JDK 21 Temurin, SDK (platform 36, build-tools 36, emulator + AVD `senbien` android-35 x86_64, WHPX), `gemma.litertlm`; `native/local.properties` (gitignore) = `sdk.dir=C:/Users/admin/android-tools/sdk`. Build: Git Bash `JAVA_HOME=/c/Users/admin/android-tools/jdk sh ./gradlew :shared:jvmTest :androidApp:assembleDebug -Pforfish.gemma=…` (gradlew.bat trong Git Bash trả 127 — dùng `sh ./gradlew`).

### 3f. Kết quả đợt 2a — Android (2026-11-04)

**Đã làm** (`shared` + Android): `bando/HaiDo.kt` (port `decodeSoundings`/verdicts/`fmtDepthM`/`isStale`, `decodeFairwayDepths`, `decodeDenBien`+`lighthouseSymbolId`+`lightAbbrev`, `decodeXacTau`+`wreckSymbolId` ⇒ GeoJSON y `soundingGeo/depthLineGeo/denBienGeo/xacTauGeo`), `bando/ConNuoc.kt` (trạm con nước + ký hiệu lên/xuống, tính lại mỗi 5 phút), `bando/ViTriTau.kt` (fix GPS cũ ⇒ mờ ghim), `bando/NapBanDo.kt` (`daCat()` chỉ đọc máy · `capNhat()` hỏi ETag, hỏng file nào giữ bản cũ file đó; glyph + sprite cất trong máy), `UngDung.napBanDo(tep)`. Android `BanDoAndroid.kt`: ô Bản đồ vẽ bản đã cất ngay rồi cập nhật, ghim tàu (ảnh `boat_marker` như web + quầng nhấp nháy), xin quyền vị trí lúc vào bản đồ, nút về tàu; khách thấy thẻ "Cần tài khoản" (`TheCanDangNhap`) như web.

**Kiểm** (emulator Windows, acc test 0900000777):

| Ca | Kết quả |
|---|---|
| `:shared:jvmTest` | 71/71 xanh (mẫu hải đồ + con nước + vị trí tàu sinh từ code web: `sinh-hai-do.mjs`, `sinh-con-nuoc.mjs`, `sinh-vi-tri-tau.mjs`) |
| `:androidApp:assembleDebug` | xanh |
| Khách mở Bản đồ | thẻ khoá "Cần tài khoản để mở bản đồ ngư trường" + Đăng ký/Đăng nhập |
| Có chuỗi, toàn cảnh | nền + đảo + nhãn chủ quyền Hoàng Sa/Trường Sa, ghim tàu, nút về tàu |
| Vũng Tàu z11 so web | đường độ sâu, điểm đo sâu, đèn biển (Aval, Vũng Tàu), xác tàu, trạm "Vũng Tàu · đang xuống" cùng chỗ cùng ký hiệu; phần web có thêm (cụm báo hiệu +N, rạn, địa danh ngầm, vùng ven biển) thuộc 2b |
| Mất sóng (`--es webGoc https://127.0.0.1:9`) | vẽ đủ từ bản đã cất; tin bão "không hỏi được" giữ bản cũ |
| Chưa cấp quyền vị trí / từ chối | hỏi quyền, bản đồ vẫn vẽ, không ghim, không sập |

**Sửa trong lúc kiểm**: chưa có GPS mà gán `Geometry` null vào nguồn tàu ⇒ MapLibre SIGABRT qua JNI (`GeoJson.type()` on null) ⇒ nay gán FeatureCollection rỗng.

**Cho Mac (iOS 2a)**: gọi `ung.napBanDo(KhoTepIos(...))` ⇒ `daCat()` vẽ ngay, `capNhat()` (suspend, trả `Pair<Tep, List<String> thiếu>`) rồi vẽ lại; `KieuBanDo.dung(ung.mayChuGoc(), tep)` ra style JSON; con nước: `conNuocLucNay()` mỗi 5 phút đổi nguồn `tram-trieu`; ghim tàu: `ViTriTau.fixQuaCu(lastFixAt, speedKmh, now)` ⇒ mờ 0,45 + tắt quầng; ảnh ghim = `androidApp/src/main/res/drawable-nodpi/boat_marker.png` (@2x, 72×100 pt, neo đáy). `KhoTepIos.ghi` nay tạo thư mục con (glyph `fonts/<fontstack>/…`) — **chưa build iOS, Mac kiểm**.

**Kế tiếp**: 2b (§3g) → 2c–2f theo §3d, rồi đợt 3–7.

### 3g. Kết quả đợt 2b — Android (2026-11-04)

**Đã làm** (`shared` + Android):
- `bando/BaoHieu.kt`: phao/đèn OSM ba tầng xa/vừa/sát (`decodeSeamarks` + `chartSymbolId` + `denOsmTrungDenBien`, bỏ `SEAMARK_AN`) + báo hiệu Cục Hàng hải (`decodeVnAids`). `bando/VungDiaDanh.kt`: địa danh ngầm, khu trú bão, vùng quản lý (`dangVung` theo NGÀY giờ VN). `VungLongSinh.kt`: vùng lộng là dữ liệu tĩnh của web, được sinh thẳng ra. `bando/TuyChonBanDo.kt` = `map-prefs.ts`: cùng khoá `forfish.mapPrefs.v1`, cùng luật đọc/ghi.
- `sinh-ban-do.mjs` sinh `BanDoSinh.NHOM_2B`: mọi `<Source>` hải đồ theo THỨ TỰ JSX web (vùng lộng → vùng quản lý → lưới toạ độ → luồng/cáp/vùng cấm → địa danh ngầm → đảo → độ sâu → hiểm hoạ OSM → phao 3 tầng có gom "+N" → rạn → phao Cục HH → xác tàu → đèn biển → khu trú bão → trạm con nước). Lớp, hằng, cụm lấy từ `ocean-map` / `chart-symbols` / `ban-do/hai-do.tsx`. Ba file GeoJSON thẳng (`reef-shapes`, `coral-reefs`, `vn-sea-lanes`) MapLibre đọc nguyên.
- `KieuBanDo.Bat` = công tắc web: "Hải đồ chi tiết" và ba nhóm Độ sâu / Báo hiệu / Tên (state phiên, mặc định bật, web không lưu); vùng lộng / vùng quản lý / trạm / lưới đọc từ MapPrefs. Công tắc CHỈ đổi `visibility` (`hienLop`), không nạp lại style, không bỏ tải.
- Android `LopBanDo.kt`: nút "Lớp" ⇒ lưới ô (Hải đồ · Ngư trường · Thời tiết · Công cụ · Cài đặt) ⇒ panel Hải đồ (4 công tắc) và Cài đặt (đơn vị, hệ toạ độ, lưới, vùng lộng, vùng quản lý, trạm con nước). Chữ CHÉP Y web. Ô Ngư trường / Thời tiết / Công cụ ghi đợt sẽ làm (2e / 2d / 2f).
- Đồng bộ web: trạm con nước `nguon:"bang"` (Hoàng Sa, Song Tử — main 0055e678) là trạm ước tính như `"model"`.

**Kiểm** (emulator Windows, acc test 0900000777):

| Ca | Kết quả |
|---|---|
| `:shared:jvmTest` | 86/86 xanh. Mẫu mới: `sinh-bao-hieu.mjs` (OSM xa 193 · vừa 4228 · sát 1372; bỏ 17 đèn OSM trùng; Cục HH 1447), `sinh-vung-dia-danh.mjs` (184 địa danh · 51 khu · 115 vùng ở 10 mốc giờ VN, đủ 4 trạng thái), `sinh-tuy-chon.mjs` (12 ca lưu hỏng/lạ); test thứ tự lớp + cụm + công tắc |
| `:androidApp:assembleDebug` | xanh |
| Vũng Tàu z12 | phao luồng hai bên, phao đặc biệt, vùng neo, khu trú bão, tên bãi/rạn, đường luồng, vùng quản lý, trạm con nước — cùng ký hiệu web |
| Tắt "Báo hiệu & nguy hiểm" | phao, đèn, luồng, khu trú bão ẩn; độ sâu, rạn, vùng, trạm còn — như web |
| Bật "Lưới toạ độ" rồi mở lại app | lưới 1° + nhãn còn nguyên (đã lưu `forfish.mapPrefs.v1`); nhóm hải đồ trở về bật (state phiên như web) |
| Toàn vùng z7 | vùng lộng (cam đứt), vùng quản lý có tên, tuyến "Nhánh vào Vũng Tàu", xác tàu, đèn biển |

**Mẫu vàng gọn** (chống phình git): mẫu báo hiệu lưu dạng `[...properties, lon, lat]`; ca thiếu đèn biển chỉ lưu phần thêm (1,9 MB ⇒ 432 KB). Mẫu vùng quản lý giữ hình học ở một mốc ngày.

**Cho Mac (iOS 2b)**: dựng style bằng `KieuBanDo.dung(ung.mayChuGoc(), tep, bat)`. Đổi công tắc thì duyệt `KieuBanDo.hienLop(bat)` (id lớp ⇒ hiện/ẩn) để đặt `visible` từng lớp, không nạp lại style. Tuỳ chọn đọc/ghi bằng `TuyChonBanDo.doc(ung.kho)` / `TuyChonBanDo.ghi(ung.kho, t)`. Gộp công tắc: `bat.copy(vungLong = t.vungLong, vungQuanLy = t.vungQuanLy, tramTrieu = t.tideStations, luoi = t.mapGrid)`. Dòng phụ "Trạm con nước" lấy từ `nap.soTramConNuoc()`. Giao diện chép theo `androidApp/…/LopBanDo.kt` (chữ, thứ tự, ô chưa làm). `Tep` có 12 trường mới (khoá = `tep` của NHOM_2B), NapBanDo tự điền.

**Chưa làm trong 2b, sang đợt sau**: chạm ký hiệu ra thẻ (tên, đặc tính đèn, khu trú bão) cùng sheet "Ký hiệu là gì?" (chú giải) — làm cùng thẻ chạm điểm ở 2d. Vùng VMS (danh sách động từ máy chủ) và mục Giọng đọc của Cài đặt — 2f.

### 3h. Kết quả đợt 2c — Android (2026-11-04)

**Đã làm**:
- Nền theo gói, y web `buildMapStyle(premiumLocked ? null : chartDetailOn ? "bathymetry" : layerId)` (`KieuBanDo.Bat.nenChon`): `BanDoSinh.KIEU_NEN_LOP` sinh `buildMapStyle(id)` cho đủ ba lớp (Hải đồ độ sâu EMODnet · Nước nóng lạnh · Vùng nhiều mồi). Ô ảnh `/api/tiles/…` đi qua OkHttp của MapLibre (`HttpRequestUtil`), CHỈ gắn `x-sdfish-token` cho `/api/tiles/` của chính máy chủ. Đổi nền thì dựng lại style.
- Lớp gói (nhóm Độ sâu, `dk:"sauGoi"`): hình rạn ACA + chất đáy (pmtiles vector, `pmtiles://file://`, chữ "San hô/Cát/Đá" theo `CHAT_DAY_LABEL`). Đẳng sâu `isobaths.v1.json` đọc file trong máy; thiếu file thì bỏ lớp, ảnh nền vẫn còn. `NapBanDo.capNhat(goi)` CHỈ tải ba file gói khi có gói (~21 MB, trần 10 phút như nền). File đã tải thì giữ lại khi hết gói, chỉ ẩn.
- Bờ offline `vn-coast.v1.json`: chỉ vẽ khi nền chưa tải được, chèn trước `base-top` (beforeId web).
- Sửa thứ tự lớp: lớp JSX của web không có beforeId nên luôn nằm TRÊN mọi lớp của style. Native trước chèn sau `base-top`, dưới ảnh nền + đẳng sâu. Nay chèn ở đỉnh.
- Panel Hải đồ: danh sách "Lớp nền bản đồ · Chọn 1" (ô màu dải chú giải + dòng nhịp cập nhật `cadLine`), thẻ khoá gói (`PremiumLock` compact: "… nằm trong gói dự báo", nút Gọi SDVICO `tel:`, ẩn khi mất sóng). Chữ, tên gói, số hotline sinh từ web (`BanDoSinh.TEN_GOI/HOTLINE`). `BanDoSinh` nay public để Android/iOS đọc.

**Kiểm** (emulator Windows; acc 0900000779 gói, chuỗi cấp bằng `test-account.mjs` rồi đã thu hồi; acc 0900000777 thường):

| Ca | Kết quả |
|---|---|
| `:shared:jvmTest` | 87/87 xanh (thêm test luật chọn nền, ô ảnh đúng máy chủ, thiếu đẳng sâu, pmtiles, bờ offline, thứ tự trên ảnh nền) |
| Có gói, Vũng Tàu z8 | nền EMODnet có bóng địa hình, đẳng sâu xanh navy; mọi file kể cả pmtiles tải xong |
| Có gói, Côn Đảo z12.5 | hình rạn, chấm chất đáy + chữ, đẳng sâu "5 m / 20 m", khu bảo tồn |
| Có gói, tắt "Hải đồ chi tiết" + chọn Nước nóng lạnh | ảnh dị thường nhiệt NASA; hải đồ ẩn, vùng / trạm / lưới còn |
| Có gói, panel Hải đồ | không có thẻ khoá; ✓ ở lớp đang chọn |
| Không gói | nền vector thường, thẻ khoá ở lớp nền + dưới "Độ sâu & đáy" |

**Lỗ hổng ghi lại**: hạng gói ở native chỉ cập nhật lúc đăng nhập. Web làm mới bằng heartbeat (`lib/heartbeat.ts` → `writePremiumMark`), native chưa có heartbeat ⇒ admin nâng/hạ gói thì máy native chưa biết tới lần đăng nhập sau. Port heartbeat ở đợt 6 (push/đồng bộ), hoặc sớm hơn nếu phát hành trước đó. Debug: `--es tier premium` khi bơm chuỗi.

**Cho Mac (iOS 2c)**: style lấy bằng `KieuBanDo.dung(goc, tep, bat)` với `bat.goi = ung.phien.premium()`. Đổi `bat.nenChon` thì dựng lại style. Ô `/api/tiles/` cần header `x-sdfish-token` = `ung.phien.token()`: MapLibre iOS gắn qua `MLNNetworkConfiguration` (`sessionConfiguration.httpAdditionalHeaders`), hoặc delegate theo URL — chỉ cho máy chủ mình. Danh sách lớp nền: `BanDoSinh.LOP_NEN`. Thẻ khoá: `BanDoSinh.TEN_GOI/HOTLINE/HOTLINE_HIEN`. **Chưa build iOS.**

### 3i. Đợt 2d — thời tiết động: phần chung `shared/thoitiet` (2026-11-04)

**Đã làm (shared, chưa có màn)**: `LuoiDuBao.kt` (forecast-grid + om-url: lưới 12×13, bước giờ, giải 3 nguồn Open-Meteo, mũi tên, thang màu, nhãn giờ/ngày, cổng ghi kho) · `NhipNguon.kt` (source-cadence) · `NapDuBao.kt` (= fetchForecastGrid: lưu còn hạn → mất sóng → chụp sẵn → live 3 request → lùi lưu/chụp/khung dài-ngắn; kho file `forfish.fc.grid.d{N}`) · `TruongMau.kt` (scalar-field + scalar-gl; `anhTruong` = fragment shader của `scalar-gl-field` ra ảnh ARGB cho ImageSource) · `HatGio.kt` (particle-field) · `TheDiem.kt` (marine-weather + sea-cells + âm lịch/trăng/con nước chữ) · `LopDong.kt` (lưới gió ⇒ trường màu/hạt = windScalarGrid; `NapTruong` cho 5 lớp màu, kho `forfish.fc.scalar.{kind}.{id}`). `MayChu.goi(hanMs)` thêm trần NGỪNG CHẢY (= taiJsonCoNhip).

**Cổng khớp**: `sinh-du-bao.mjs` (81 KB) + `sinh-thoi-tiet.mjs` (116 KB) chạy chính code web; ảnh trường so với bản tham chiếu theo đặc tả GL (GPU không chạy trong node): kích thước/góc tuyệt đối, lệch điểm ảnh ≤1/255. jvmTest 130/130.

**Khác web có chủ ý**: gió 200 mà không có trục giờ ⇒ coi là hỏng, lùi bản lưu (web ghi đè lưới rỗng); thân không phải JSON ⇒ hỏng; kho file thay IndexedDB (dò khung [1,3,5,7,10,16]); bản chụp sẵn của lớp màu dùng luôn không xét hạn (web xét). Chưa port: độ mặn, nước xoáy (ssha), dòng chảy tầng sâu, `seaPointFromGrid`/`chonBanLui` của thẻ chạm.

**Android (2026-11-04)**: `ThoiTietAndroid.kt` — trường màu = `ImageSource` + `RasterLayer` (ảnh `anhTruong(…, 8, moRong = true)`), chèn DƯỚI `overlay-coast-fill`; mũi tên `forecast-arrows-line` (màu `*_COLOR_EXPR`, rộng 2.5); hạt = Canvas Compose (vệt DST_IN α .93, chiếu Mercator tuyến tính 2 mốc/khung, N 600–2000, xoá vệt khi đổi camera; lớp màu ⇒ vệt gió nền "ambient"); thanh giờ (tiêu đề · giờ "Hôm nay/Mai", Chạy/Dừng 800 ms, chú giải dải màu, thanh kéo); panel Thời tiết (Gió · Sóng · Dòng chảy · Mây · Mưa · Nhiệt độ · Dông · Áp suất, bật một tắt lớp kia). `KieuBanDo.Bat.dong` = anyExclusiveOverlay: ẩn hải đồ + đảo + vùng quản lý + trạm, hiện `overlay-coast` (sinh từ JSX ~7287), nền ép "bathymetry" khi có gói; khung kéo PAN_BOUNDS + minZoom 4 + mở khung LOCKED_BOUNDS. Số ngày = 16 có gói / 1 thường (soNgayThoiTiet).

**Kiểm Android** (emulator, acc thường): Gió — trường màu + mũi tên + hạt + bờ nổi + nhãn chủ quyền, khung khoá; Mưa — trường mưa + vệt nền; Mất sóng (`webGoc` chết) — Gió hiện từ bản lưu, Chạy chuyển 0h → 3h; nút về tàu dời lên trên thanh giờ. jvmTest 130/130.

**Thẻ chạm điểm (2026-11-04)**: `shared/thoitiet/NapDiem.kt` = fetchSeaPoint (3 request qua /api/om, 15 s; khoá chỗ = coordId 0,25° — `Js.round` vì Math.round khác round nửa-chẵn của Kotlin; thường lưu `.d1` riêng; mất sóng ⇒ bản lưu; mạng chậm quá 1,5 s mà có bản lưu ⇒ bản lưu trước, số mới về sau qua `onFresh`). Kho `forfish.native.diem.<id>` giữ nguyên 3 thân trả về. Android `TheDiemAndroid.kt`: đầu ngăn SEA_STATE + chấm mức, chip ngày (`chipLabel`), lưới 3 cột `buildSeaCells` (ô full/span2), "Bản lưu HH:MM", đất liền / đang tải / lỗi; vòng chọn tại chỗ chạm; thanh giờ + nút về tàu dời lên theo chiều cao thẻ. Kiểm: chạm biển Vũng Tàu (Gió · Đông Bắc cấp 4, Giật, Sóng 0,8 m, Dòng → Đông Nam, Trời, Âm lịch, Trăng); mất sóng ⇒ "Bản lưu 13:51". jvmTest 136/136. Chưa có ở thẻ: ô con nước (tideCardAt), cá/mùa/độ sâu, lùi về ô lưới đã lưu (`chonBanLui`), nút dẫn đường tới đây (2f).

**Chưa làm 2d**: lọc hạt theo mặt nước (`fillMissingUV` + lưới độ sâu), độ mặn / nước xoáy / dòng chảy tầng sâu, nhãn ô thời tiết của web (thanh giờ dùng Slider thay TimeScrubber — gần đúng).

**Cho Mac (iOS 2d)**: dữ liệu `NapDuBao(ung.mayChu, KhoTep, now, matSong).lay(days, canDongChay)` / `NapTruong.lay(kind, days)` (+ `peek` hiện ngay); vẽ: `LopDong.truongTuLuoi` + `TruongMau.anhTruong(…, 8, moRong = true)` ⇒ `MLNImageSource` 4 góc (bac/tay…), `LuoiDuBao.arrowFeatures` + `*_COLOR_EXPR` ⇒ line layer, hạt `HatGio.buildUVField/stepParticle` vẽ trên `CADisplayLink`; luật lớp: `KieuBanDo.Bat(dong = true)`. **Chưa build iOS.**

### 3j. Đợt 2e — dự báo cá · mật độ tàu · AIS: phần chung (2026-11-04)

**Đã làm (shared, chưa có màn)**:
- `shared/ca`: `DuBaoCa.kt` (giải /api/fish-forecast + lọc vùng biển VN, FISH_LEVEL_BANDS, fishFailNote, fishGridStep/fishLead/fishView pha mùa vụ, `luoiCaGeo` = fishGridGeo, `diemNong` = fishHotspots nhận neo) · `VungBienSinh.kt` (sinh từ vms-zones.json) · `LoaiDanh` (fish-picks, khoá `forfish.fishPicks.v1`) · `KhiHau`/`BangPha`/`PhaMuaVu` (fish-blend + climatology + model-params) · `NapCa.kt` (= fetchFishForecast, 35 s; 401/403 ⇒ mã, KHÔNG xoá bản lưu; lỗi khác/mất sóng ⇒ bản lưu; kho `forfish.fc.fish.latest`) · `MatDoTau.kt` (fleet-density: giải + forecastFleetDensity + fleetGridGeo + câu trạng thái BaiTauDuBao + canSeeDensity; gió do bên gọi đưa).
- `shared/ais`: `TauAis.kt` · `RadarCpa.kt` (ais-cpa: CPA/TCPA, mức nguy/cảnh, radar GeoJSON) · `QuanhTau.kt` (tau-ais-quanh) · `LopAis.kt` + `LopAisSinh.kt` (spec lớp chép JSX + icon tàu dạng lệnh Canvas do chính `dangKyIconTau` phát ra) · `ChuanTenSinh.kt` (bảng bỏ dấu) · `NapAis.kt` (bản tin/vết/quanh/quyền: trần, bản lưu, nhớ vết 10 phút ≤50 tàu, quyền thử lại 3 lượt cách 5 s).

**Cổng khớp**: `sinh-ca.mjs` (118 KB) + `sinh-ais.mjs` (136 KB) chạy chính code web. jvmTest 165/165. Số qua sin/cos/sqrt so sai số ≤8 ulp / 1e-9 (JVM ≠ V8 bit cuối); chuỗi, mức, thứ tự so tuyệt đối.

**Android — dự báo cá (2026-11-04)**: `CaAndroid.kt` — lớp `fish-grid` (fill step 3 mức + viền trắng, ô cắt ranh không viền), chèn dưới `overlay-coast-fill`/`chu-quyen`; panel Ngư trường: "Dự báo cá (vùng có khả năng tập trung)" · "Theo ngày · ảnh vệ tinh", thẻ khoá gói (thường), bộ chọn loài = FishPicker (Câu ngừ / Lưới vây / Lưới rê / Chụp mực, "Đang vụ quanh đây" theo vùng ở tâm bản đồ, "Loài khác" theo nhóm, "Đã chọn n/3", "Xong" mờ khi chưa chọn, chip mờ khi đủ 3), sau chọn: chip từng loài (chạm = chỉ loài đó) + "Đổi"; chú giải "Dự báo cá". Bật cá ⇒ tắt lớp động (onFish web); lớp động bật ⇒ lưới cá ẩn. Danh mục loài / nghề / vùng mùa vụ sinh bằng `sinh-loai.mjs` (`LoaiCaSinh.kt`, test regionAt + fishInRegion 132 điểm). Kiểm emulator: acc gói 0900000779 (chuỗi đã thu hồi) — Câu ngừ ⇒ 3 loài ngừ, lưới đủ 3 mức + chú giải; acc thường ⇒ thẻ khoá, không lưới. jvmTest 167/167. **Chưa**: hồng tâm (cần điểm đã lưu — đợt 4), pha mùa vụ ngày xa (chưa có chip ngày ở màn), AIS + mật độ tàu (commit sau).

**Android — AIS (2026-11-04)**: `AisAndroid.kt` — icon tàu = CHẠY LẠI chuỗi lệnh Canvas 2D của `dangKyIconTau` (LopAis.ICON) trên android.graphics.Canvas, đăng ký lại sau mỗi lần đổi style; nguồn `tau-ais` + lớp `tau-ais-dot` nằm sẵn trong style khi `Bat.ais` (KieuBanDo), đổi cờ ⇒ dựng lại style; quyền: `peekQuyen` rồi `hoiQuyenThuLai`; "Tàu xung quanh" · "Đang phát AIS · ~10 phút một bản" trong panel Ngư trường (chỉ khi được xem), dòng "{n} tàu · bản lúc HH:MM" (+ "chưa tải được bản mới, dùng bản lưu trong máy"); làm mới 5 phút; chạm trúng tàu (queryRenderedFeatures `tau-ais-dot`) ⇒ thẻ tàu (= TheTauAis: tên / "Tàu chưa rõ tên", moTaTau + "· đến …", định danh, toạ độ theo Cài đặt, "Tin …" + "· bản lưu trong máy"). `TuyChonBanDo.toaDo` = fmtCoordPair (vector web). Debug: `--es aisThu 1` (coi như được xem + bản thử `src/debug/assets/ais-thu.json` khi máy chủ chặn — tài khoản test không có quyền AIS). Kiểm emulator: 6 tàu thử, hình đúng loại/hướng, thẻ tàu. **Chưa**: chế độ AIS (Bán kính / Toàn biển, radar CPA, vòng 6 hl tàu quanh), đường đi 7 ngày.

**Android — mật độ tàu (2026-11-04)**: "Mật độ tàu dự kiến" · "16 ngày tới · trăng, gió, bão, mùa" trong panel Ngư trường (chỉ `canSeeDensity` — số xem trước; debug `--es aisThu 1`), khoá gói, câu trạng thái BaiTauDuBao, chip 16 ngày (`chipLabel`), chip nghề (DENSITY_GEARS); lớp `fleet-grid` (tím 3 mức), chú giải "Mật độ tàu"; bật mật độ tắt cá + lớp động (web). File `fleet-density.v1.json` tải qua `NapBanDo.layTho` CHỈ khi bật (không nằm trong NGUON). **Nợ**: gió theo cảng (fetchSeaForecast từng cảng) chưa nối ⇒ `wind = null` ⇒ câu "Chưa có gió ngày này — ước theo trăng, mùa." (đúng câu web cho ca thiếu gió); nâng khi port dự báo cảng. Kiểm emulator acc gói 0900000779 (chuỗi thu hồi): lưới quanh Vũng Tàu–Côn Đảo, chip ngày/nghề, chú giải.

**Khác web có chủ ý**: 200 mà bản lưu có `generatedAt` mới hơn ⇒ KHÔNG đè (web đè); 403 `ais_off` ⇒ vẫn lùi bản lưu nhưng báo `aisOff`; dữ liệu hỏng từng dòng ⇒ bỏ dòng. Chưa port: `fishForecastTuKhoSW` (không có SW), lịch sử mật độ, thẻ tàu / chạm chọn tàu / hẹn giờ làm mới (Android ở commit sau).

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

**Last updated**: 2026-11-04 — đợt 2e phần chung (§3j). Trước đó: đợt 2d Android: lớp thời tiết động (§3i). Trước đó: đợt 2d phần chung (§3i). Trước đó: đợt 2c Android xong (§3h). Trước đó: đợt 2b Android xong (§3g). Trước đó: đợt 2a Android xong + chia việc PC/Mac (§3e–3f). Trước đó: đợt 1 xong cả hai nền (§3b). Trước đó: đợt 0 xong cả Android lẫn iOS (§3a). Trước đó: 2026-11-04 — tạo doc theo ADR 0019.
