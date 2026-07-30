# Ops — Build & phát hành SDFish lên CH Play + App Store (runbook chi tiết)

> **Mục đích**: cầm tay từng bước từ **chốt code** → **build binary** → **đẩy lên CH Play và App Store** cho lần cập nhật này, kèm cách **xử lý rejection 5.1.2 (Privacy)** và **chuyển domain về `sdfish.sdvico.vn`**.
>
> **Load khi**: chuẩn bị nộp/cập nhật app store, đụng version/signing/Capacitor, xử lý App Review.
> **Anh em ruột**: [native-deploy.md](native-deploy.md) (hiện trạng + PWA). File này là RUNBOOK thao tác.

---

## 0. Tiền đề bắt buộc — ĐỌC TRƯỚC KHI BUILD

### 0.1 Domain `sdfish.sdvico.vn` — HIỆN CHƯA SẴN SÀNG (đã kiểm 2026-07-27)

| Domain | DNS trỏ | TLS | Nội dung | Kết luận |
|---|---|---|---|---|
| `forfish.vercel.app` | Vercel (216.198.79.195 / 64.29.17.195) | hợp lệ | **App thật** | ✅ đang chạy |
| `sdfish.sdvico.vn` | 116.103.228.188 (host chung `*.sdhub.online`) | **SAI** (cert `*.sdhub.online`) | **404 Not Found** | ❌ chưa cấu hình |

→ **KHÔNG được trỏ app (`server.url`) hay Privacy Policy URL vào `sdfish.sdvico.vn` cho tới khi làm xong §6.** Trỏ vào bây giờ = WebView tải trang 404/lỗi TLS = app trắng, reviewer mở privacy policy ra 404 = reject tiếp. Xong §6 mới quay lại đây build.

### 0.2 Nguyên nhân reject 5.1.2 và cái đã sửa trong code

Apple 5.1.2 (Data Use and Sharing) đòi: app phải có **chính sách quyền riêng tư truy cập được** + nhãn App Privacy **khớp thực tế** + **không tracking**. Trước đây app **không có trang chính sách nào** → thiếu điều kiện cơ bản.

Đã bổ sung (commit này):
- Trang công khai **`/quyen-rieng-tu`** (`src/app/quyen-rieng-tu/page.tsx`) — VN + tóm tắt EN, khai đúng: SĐT/tên/uid/nội dung tự nhập + vị trí, mục đích chỉ để chạy app, **không quảng cáo, không analytics, không bán dữ liệu**.
- Link tới trang này ở **/login**, **/dang-ky** (dòng đồng ý) và **sheet Tài khoản**.

Còn lại phải làm **trong App Store Connect / Play Console** (không phải code): §5.

### 0.3 Chốt version cho lần nộp này

| Nền tảng | File | Hiện tại | Đổi thành |
|---|---|---|---|
| Android | `android/app/build.gradle` | `versionCode 3` / `versionName "1.0.2"` | **`versionCode 4`** / **`versionName "1.0.3"`** |
| iOS | Xcode target (General) hoặc `ios/App/App.xcodeproj` | build 1, ver 1.0 | giữ ver **1.0**, tăng **build → số kế tiếp** (mỗi lần nộp phải tăng) |

> Play **bắt buộc** `versionCode` tăng mỗi bản. App Store **bắt buộc** build number tăng mỗi lần upload (kể cả cùng version string).

---

## 1. Chuẩn bị môi trường (một lần)

| Cần gì | Dùng để | Ghi chú |
|---|---|---|
| **Máy Mac + Xcode** (mới nhất) | build iOS | bắt buộc — không có cách build iOS trên Windows |
| **Android Studio + SDK** | build Android | máy Windows hiện tại OK |
| **Tài khoản Apple Developer** ($99/năm) | App Store Connect | vai **Account Holder/Admin** để sửa nhãn Privacy |
| **Google Play Console** ($25 một lần) | CH Play | |
| **Node ≥ 20 + repo cài xong** | `npm i` | Capacitor v8 đã có trong `package.json` |
| **Chrome/Edge hệ thống** | `npm run guide`, screenshot | |

Android signing đã có sẵn cơ chế: `android/app/build.gradle` đọc `android/keystore.properties`. **Giữ file keystore + mật khẩu an toàn** — mất là không cập nhật được app trên Play nữa. (`keystore.properties` KHÔNG commit — chứa mật khẩu.)

---

## 2. Cấu hình chung trước khi build

### 2.1 `capacitor.config.ts`
- `appId: "vn.sdvico.sdfish"`, `appName: "SDFish"` — **giữ nguyên** (là bundle iOS).
- ⚠️ **Bundle ID khác nhau giữa 2 store là chấp nhận được**: iOS = `vn.sdvico.sdfish`, Android package = `vn.sdvico.forfish` (đã đăng ký, giữ theo [native-deploy §6](native-deploy.md)). Không đổi package Android sau khi đã tạo trên Play — sẽ thành app mới.
- `server.url`: **để `https://forfish.vercel.app/` cho tới khi xong §6**, rồi đổi sang `https://sdfish.sdvico.vn/`.

### 2.2 Icon + splash
```bash
npm run icons          # sinh lại icon từ brand/logo-sdfish.png
```
⚠️ Chạy lại **sau mỗi `npx cap add`** để đè icon mặc định của Capacitor (chữ X) — nếu không, icon app ≠ icon store listing → Google/Apple flag "misleading".

### 2.3 Sinh screenshot store (từ app thật, đúng pixel)
```bash
npm run build && npm start                 # server ở localhost:3000
node scripts/capture-app-screens.mjs       # Play (cần SHOT_PHONE/SHOT_PASSWORD trong .env.local)
node scripts/generate-ios-screenshots.mjs  # iPhone 6.5"/6.7" + iPad 12.9"/13"
```
⚠️ **Không dùng lại ảnh cũ** — màn login-gate đổi thì ảnh cũ khoe nội dung app đang chặn = rủi ro flag. Ảnh Play 9:16 KHÔNG resize thẳng sang iPhone/iPad.

---

## 3. Build & phát hành ANDROID (CH Play)

```bash
# 1. Đồng bộ web → native
npm run build                 # nếu chế độ (b) static bundle; chế độ (a) server.url thì web deploy Vercel là đủ
npm run cap:sync              # cap sync — copy web + plugin sang android/
npm run icons                 # đảm bảo icon đúng

# 2. Bump version: sửa android/app/build.gradle → versionCode 4, versionName "1.0.3"

# 3. Build AAB đã ký (Android App Bundle — Play yêu cầu .aab, không phải .apk)
cd android
./gradlew bundleRelease       # Windows: .\gradlew.bat bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

**Đẩy lên Play Console:**
1. [play.google.com/console](https://play.google.com/console) → app SDFish → **Production** (hoặc **Internal testing** để thử trước).
2. **Create new release** → upload `app-release.aab`.
3. Điền **Release notes** (tiếng Việt): nêu tính năng mới + "bổ sung chính sách quyền riêng tư".
4. **App content** (menu trái) — bắt buộc điền đủ trước khi phát hành:
   - **Privacy policy**: `https://sdfish.sdvico.vn/quyen-rieng-tu` (hoặc tạm `https://forfish.vercel.app/quyen-rieng-tu` cho tới khi xong §6).
   - **Data safety**: khai giống bảng §5.1 (Location, Personal info: phone/name, App activity — **không** dùng để tracking, **không** chia sẻ bên thứ ba quảng cáo).
   - **App access**: cung cấp **tài khoản demo** (SĐT + mật khẩu) để reviewer đăng nhập — xem §5.3.
5. **Review → Rollout**. Bản đầu duyệt vài giờ–vài ngày.

> App dùng **vị trí** → Play hỏi lý do trong Data safety; ghi đúng: "hiển thị bản đồ và thời tiết biển theo vị trí, không lưu trữ".

### 3b. TỰ ĐỘNG hoá build + upload (GitHub Actions)

Workflow `.github/workflows/android-release.yml` gộp §3 bước 1–3 + upload Play qua API. **Trigger: bấm tay** (Actions → *Android release* → Run workflow) **hoặc push tag `vX.Y.Z`**. KHÔNG chạy mỗi push — chế độ (a) `server.url` nên đa số cập nhật chỉ cần deploy Vercel, không cần binary.

**Cơ chế:**
- `versionCode = 10000 + run_number` → tự tăng, đơn điệu, khỏi sửa `build.gradle` tay. `versionName` lấy từ input hoặc tag (`v1.0.4` → `1.0.4`); `build.gradle` đọc qua `-PappVersionCode/-PappVersionName` (fallback giá trị chốt tay khi build local).
- Ký bằng keystore khôi phục từ secret → ghi `android/keystore.properties` runtime (không commit).
- Upload bằng plugin **Gradle Play Publisher** (`com.github.triplet.play`, classpath ở `android/build.gradle`, block `play{}` ở `android/app/build.gradle`) đọc credential từ env `ANDROID_PUBLISHER_CREDENTIALS`. Track mặc định `internal`.
- KHÔNG chạy `cap add`; chỉ `cap sync` + `npm run icons`. Web là **stub** (`out/index.html`) vì `server.url` load Vercel lúc chạy.

**Secrets phải set** (Settings → Secrets and variables → Actions):

| Secret | Lấy từ |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -w0 android/app/sdfish-release.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` / `ANDROID_KEY_ALIAS` / `ANDROID_KEY_PASSWORD` | `android/keystore.properties` (hiện `sdvico`/`sdfish`/`sdvico`) |
| `PLAY_SERVICE_ACCOUNT_JSON` | Play Console → **Setup → API access** → link GCP → tạo service account → grant **Release apps** → JSON key. Chỉ cần cho bước publish. |

**Điều kiện tiên quyết (một lần, làm TAY):** app SDFish phải **đã tạo + upload AAB đầu tiên bằng tay** lên Play — Play chặn upload API cho app chưa có bản phát hành nào. Sau đó CI đảm nhận các bản kế.

**CI KHÔNG làm** (vẫn tay trên Play, xem §5): App content, Data safety, Privacy Policy URL, screenshot, tài khoản demo, bấm "Send for review" bản production đầu. Đổi icon/splash/plugin native → chạy `npm run cap:sync` local + commit trước (CI không sync platform mới).

---

## 4. Build & phát hành iOS (App Store) — cần Mac

```bash
# 1. Thêm nền tảng iOS (lần đầu)
npm i -D @capacitor/ios
npx cap add ios               # sinh thư mục ios/  (cần Mac + Xcode)
npm run cap:sync
npm run icons

# 2. Mở Xcode
npm run cap:open:ios
```

**Trong Xcode:**
1. Target **App** → **Signing & Capabilities**: chọn Team (Apple Developer), bundle `vn.sdvico.sdfish`, bật **Automatically manage signing**.
2. **General** → tăng **Build** (số kế tiếp), Version giữ `1.0`.
3. **Info.plist — chuỗi mục đích (BẮT BUỘC, liên quan 5.1.2)**: app gọi vị trí nên phải có:
   - `NSLocationWhenInUseUsageDescription` = *"SDFish dùng vị trí để canh bản đồ và xem gió sóng đúng chỗ bạn đang ở. Vị trí không được lưu lại hay gắn với tài khoản."*
   - Thiếu chuỗi này → app **crash khi xin vị trí** và/hoặc bị reject.
4. Chọn thiết bị **Any iOS Device (arm64)** → menu **Product → Archive**.
5. Cửa sổ **Organizer** hiện ra → **Distribute App → App Store Connect → Upload**.

**Trong App Store Connect** ([appstoreconnect.apple.com](https://appstoreconnect.apple.com)):
1. App SDFish → **+ Version hoặc Platform** (nếu cần) → chọn build vừa upload (đợi ~15–30 phút "processing").
2. **App Privacy** → sửa nhãn cho khớp §5.1 (đây là chỗ sửa 5.1.2 — xem §5.2).
3. **App Information → Privacy Policy URL**: `https://sdfish.sdvico.vn/quyen-rieng-tu` (tạm `forfish.vercel.app` tới khi xong §6).
4. **App Review Information**: điền **tài khoản demo** + **Notes** (§5.3).
5. **Add for Review → Submit**.

---

## 5. Xử lý rejection 5.1.2 (Privacy — Data Use and Sharing)

Reject này **hầu như luôn ở phần hồ sơ + nhãn**, không phải code. Làm đủ 3 việc:

### 5.1 Bảng dữ liệu chuẩn (khai giống nhau ở cả 2 store)

| Loại dữ liệu | Thu ở đâu | Mục đích | Linked to user | Tracking |
|---|---|---|---|---|
| Phone Number | `/login`, `/dang-ky`, webhook SDWork | App Functionality | Yes | **No** |
| Name | đồng bộ từ CRM SDWork | App Functionality | Yes | **No** |
| User ID | uid Supabase Auth | App Functionality | Yes | **No** |
| Other User Content | sổ chuyến/giấy tờ/thuyền viên — phần lớn ở localStorage **trên máy** | App Functionality | Yes | **No** |
| Precise Location | `getCurrentPosition` (`route-planner.tsx`, `fishing-map-view.tsx`) — canh bản đồ, hỏi gió sóng | App Functionality | **Not Linked** | **No** |

> **Không tracking** là thật: repo **không có** SDK quảng cáo/analytics/attribution (AdMob, Firebase, Facebook, AppsFlyer, Adjust, Sentry, GA — xem [external-services.md](external-services.md)). Nguồn ngoài chỉ nhận **toạ độ trần**. Không đọc IDFA/AAID.

### 5.2 Sửa nhãn App Privacy (Apple)
- App Store Connect → **App Privacy** → khai đúng bảng trên. **Bỏ hết** mục "Used to Track You" (lần reject đầu 2026-07-17 khai nhầm tracking).
- Cần vai **Account Holder/Admin** mới sửa được nhãn.
- **Privacy Policy URL** phải mở được ra trang thật (`/quyen-rieng-tu`) — đã có (§0.2).

### 5.3 Tài khoản demo cho reviewer (tránh kèm 2.1)
- Tạo tài khoản thật trên Supabase prod bằng chính `/dang-ky`: SĐT 10 số hợp lệ, **mật khẩu ≥6 ký tự, không dấu cách, không viết hoa** (né bàn phím máy reviewer tự viết hoa).
- Tự đăng nhập thử ở `https://<domain>/login` **trước khi** nộp.
- **Review Notes** (mẫu — dán vào ASC / Play "App access"):

> Tài khoản demo: SĐT `09xxxxxxxx`, mật khẩu `xxxxxx`.
> Dữ liệu (tàu, giấy tờ, sổ) lưu cục bộ theo máy nên máy review đăng nhập lần đầu sẽ thấy màn trống — bấm **"Thêm tàu"** ở Trang chủ để tạo dữ liệu mẫu, hoặc xem các màn công khai (Ra khơi, Giá cả, Danh bạ cảng) không cần đăng nhập.
> App KHÔNG tracking trên mọi nền tảng; không có SDK quảng cáo/analytics. Vị trí chỉ dùng tại chỗ để canh bản đồ, không lưu. Chính sách: https://<domain>/quyen-rieng-tu

### 5.4 Trả lời App Review
Trong **Resolution Center**, trả lời ngắn gọn: đã cập nhật nhãn App Privacy cho khớp thực tế (không tracking), đã bổ sung trang chính sách quyền riêng tư truy cập trong app và qua Privacy Policy URL, đã thêm chuỗi mục đích vị trí. Đính kèm link `/quyen-rieng-tu`.

---

## 6. Chuyển domain `forfish.vercel.app` → `sdfish.sdvico.vn`

**Mục tiêu**: app và Privacy Policy URL chạy trên domain công ty. Hiện `sdfish.sdvico.vn` trỏ nhầm host + TLS sai (§0.1) → phải cấu hình lại.

**Bước (người có quyền Vercel + DNS SDVICO làm):**
1. **Vercel** → project ForFish → **Settings → Domains → Add** `sdfish.sdvico.vn`. Vercel hiện bản ghi DNS cần đặt.
2. **DNS của sdvico.vn** (nhà cung cấp domain): đổi `sdfish` từ IP `116.103.228.188` hiện tại sang bản ghi Vercel yêu cầu — thường **CNAME** `sdfish` → `cname.vercel-dns.com` (hoặc A record theo Vercel chỉ). **Gỡ** bản ghi cũ trỏ host `sdhub.online`.
3. Đợi DNS lan + **Vercel tự cấp TLS** (Let's Encrypt). Vào lại Settings → Domains thấy **Valid Configuration** + khoá xanh.
4. **Kiểm tra** (khớp cả 3 mới đúng):
   ```bash
   nslookup sdfish.sdvico.vn          # phải ra IP Vercel, không phải 116.103.228.188
   curl -I https://sdfish.sdvico.vn   # http 200, không lỗi cert
   curl -s https://sdfish.sdvico.vn/quyen-rieng-tu | grep "Chính sách quyền riêng tư"
   ```
5. **Sau khi §6 xanh**, mới cập nhật:
   - `capacitor.config.ts` → `server.url: "https://sdfish.sdvico.vn/"`.
   - `NEXT_PUBLIC_API_BASE` (nếu dùng chế độ (b)) → `https://sdfish.sdvico.vn`.
   - Privacy Policy URL + Support URL trên cả 2 store → `sdfish.sdvico.vn`.
   - Tài khoản demo test lại ở domain mới.
   - `npm run cap:sync` → build lại binary → nộp lại.

> **Vì sao không làm luôn**: nếu trỏ `server.url` sang domain chưa xanh, WebView tải trang 404/cert lỗi → app trắng. Đây là lý do **không** đổi domain trong lần build này trừ khi §6 đã hoàn tất.

---

## 7. Checklist nộp lại (in ra tick từng dòng)

**Code (đã xong trong repo — verify):**
- [ ] `/quyen-rieng-tu` mở được (200), link từ login/đăng ký/tài khoản.
- [ ] `npm run build` + `npm test` + `npm run lint` sạch.
- [ ] Bump `versionCode`/`versionName` (Android) và build number (iOS).

**Hồ sơ store:**
- [ ] Privacy Policy URL trỏ trang thật, mở được.
- [ ] Nhãn App Privacy (Apple) + Data safety (Play) khớp bảng §5.1, **không** tracking.
- [ ] `NSLocationWhenInUseUsageDescription` có trong Info.plist.
- [ ] Tài khoản demo tồn tại thật + tự đăng nhập thử được + Review Notes đầy đủ.
- [ ] Screenshot mới (không dùng ảnh cũ), icon = listing.
- [ ] (Nếu đã xong §6) mọi URL đổi sang `sdfish.sdvico.vn`; nếu chưa, dùng `forfish.vercel.app` nhất quán.

---

**Last updated**: 2026-07-27
