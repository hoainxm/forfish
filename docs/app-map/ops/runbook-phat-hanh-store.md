# RUNBOOK NHANH — Phát hành bản mới lên CH Play + App Store (thẻ thao tác)

> **Mục đích**: mở ra là làm theo được ngay, không phải nhớ gì. Đây là **thứ tự các bước**;
> phần "vì sao" + xử lý reject chi tiết ở [build-publish-store.md](build-publish-store.md),
> hiện trạng + PWA ở [native-deploy.md](native-deploy.md).
>
> **Môi trường giả định**: **macOS** + **Android Studio** + **Xcode** (build được CẢ hai nền
> tảng ngay trên máy). Node **20** (không dùng 26 — vỡ test jsdom).

---

## ⚡ TRIGGER — nhắn **"build android"** / **"build ios"** thì Claude làm sẵn phần tự động

Bạn chỉ cần nhắn **"build android"** hoặc **"build ios"**. Claude chạy trước các bước 🤖, rồi
**DỪNG** giao lại các bước 👤 (ký binary + đẩy store — bắt buộc thủ công: cần GUI Xcode/Android
Studio, mật khẩu keystore, tài khoản Apple/Google, thao tác store console).

**"build android" → 🤖 Claude chạy:**
1. `git fetch` + `git pull --ff-only` (đồng bộ nền)
2. `npm ci`
3. `npm run build` + `npm run lint` (+ `npm test` — báo rõ nếu Node 26 local làm vỡ test jsdom, không phải hồi quy)
4. Tạo `out/` stub → `npx cap sync android` → `npm run icons`
5. *(nếu build tay)* bump `versionCode`/`versionName` trong `android/app/build.gradle`
6. Báo "prep xong" + trạng thái build/test/lint.

→ 👤 **Bạn làm tiếp**: `npm run cap:open:android` → Android Studio → *Generate Signed Bundle* →
chọn keystore → upload Play. **HOẶC** Actions → *Android release* → Run workflow (CI tự build + ký).

**"build ios" → 🤖 Claude chạy:**
1–3. như trên. 4. Tạo `out/` stub → `npx cap sync ios` → `npm run icons`
   *(nếu `ios/` chưa có → Claude dừng, nhắc bạn chạy one-time `npm i -D @capacitor/ios && npx cap add ios` — cần Xcode + CocoaPods)*
5. Báo "prep xong" + trạng thái.

→ 👤 **Bạn làm tiếp**: `npm run cap:open:ios` → Xcode: ký + `NSLocationWhenInUseUsageDescription`
→ bump **Build** → **Product → Archive** → **Distribute → App Store Connect → Upload**.

> **🤖 Claude KHÔNG làm được (chắc chắn cần bạn)**: thao tác GUI Xcode/Android Studio, nhập mật
> khẩu keystore, ký binary, trigger CI (cần `gh` CLI đăng nhập — máy chưa cài), và MỌI thao tác
> trên **Play Console / App Store Connect** (nhãn privacy, tài khoản demo, screenshot, bấm Submit).
> Claude cũng có thể **commit + push** hộ khi bạn yêu cầu.

Bên dưới là runbook đầy đủ; các bước 🤖/👤 ở trên tương ứng mục 2–4.

---

## 0. Sự thật cố định (tra nhanh — không phải nhớ)

| Thứ | Giá trị |
|---|---|
| Repo (đẩy + chạy Actions) | `github.com/hoainxm/forfish` |
| Web deploy app native tải (chế độ (a)) | **`https://forfish-alpha.vercel.app`** — KHÔNG phải `forfish.vercel.app` |
| Trang chính sách (bắt buộc cho store) | `https://forfish-alpha.vercel.app/quyen-rieng-tu` |
| Bundle iOS | `vn.sdvico.sdfish` |
| Package Android | `vn.sdvico.forfish` |
| Tên app | SDFish |

> **Chế độ wrap hiện tại = (a) `server.url`** (xem `capacitor.config.ts`): app native chỉ là **vỏ
> WebView tải web live trên Vercel**. Hệ quả quan trọng: **đa số cập nhật CHỈ cần deploy web
> (đẩy git → Vercel tự build), KHÔNG cần build lại binary.** Chỉ build lại app khi: đổi vỏ native
> (icon/splash/plugin), bump version, hoặc **đóng một lần bị reject**.

---

## 1. CHUẨN BỊ MỘT LẦN (mỗi máy / mỗi tài khoản)

Làm một lần, sau này bỏ qua mục này.

### 1a. Công cụ trên máy
```bash
# Node 20 (khuyến nghị dùng nvm; Node 26 làm vỡ 11 test jsdom local)
nvm install 20 && nvm use 20
node -v                       # v20.x

# Xcode phải là bản ĐẦY ĐỦ, không phải Command Line Tools
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -version           # phải in "Xcode xx.x"; nếu báo lỗi CLT là chưa trỏ đúng

# CocoaPods (cap add/sync ios cần)
sudo gem install cocoapods    # hoặc: brew install cocoapods
pod --version

# Android Studio: mở 1 lần, cài Android SDK + build-tools (Xcode/AS tự lo phần còn lại)
```

### 1b. Tài khoản
- **Apple Developer** ($99/năm) — vai **Account Holder/Admin** để sửa nhãn App Privacy.
- **Google Play Console** ($25 một lần).

### 1c. Chữ ký Android (keystore) — GIỮ KỸ, mất là hết cập nhật được app
- `android/app/build.gradle` đọc `android/keystore.properties` (KHÔNG commit — chứa mật khẩu).
- File `keystore.properties` cần: `storeFile`, `storePassword`, `keyAlias`, `keyPassword`.
- Sao lưu file keystore + mật khẩu ra nơi an toàn.

### 1d. iOS: thêm nền tảng lần đầu (chỉ chạy 1 lần)
```bash
npm i -D @capacitor/ios
mkdir -p out && echo '<!doctype html><meta charset="utf-8"><title>SDFish</title><body>Đang tải SDFish…' > out/index.html
npx cap add ios               # sinh thư mục ios/ (cần Xcode + CocoaPods ở 1a)
npm run icons                 # BẮT BUỘC sau cap add — đè icon "X" mặc định của Capacitor
```

### 1e. Backend cron (một lần — để dữ liệu cá/thời tiết/bão tự tươi)
Ở **`hoainxm/forfish` → Settings → Secrets and variables → Actions**:
- **Variable** `APP_BASE_URL` = `https://forfish-alpha.vercel.app` (tab *Variables*).
- **Secret** `CRON_SECRET` = *(chuỗi bí mật, TRÙNG env `CRON_SECRET` trên Vercel)* (tab *Secrets*).
- Trên **Vercel** (Project → Settings → Environment Variables): đặt `CRON_SECRET` cùng giá trị.

> Thiếu 2 biến này thì workflow `storms.yml` báo đỏ mỗi giờ và cron không chạy — không chặn
> build store, nhưng nên set. Chi tiết bẫy "Variable vs Secret" ở [build-publish-store.md](build-publish-store.md).

---

## 2. MỖI LẦN CÓ BẢN MỚI — bước chung (làm TRƯỚC, cả 2 nền tảng)

```bash
# 1) Đồng bộ code (tránh phân kỳ — CLAUDE.md yêu cầu)
git fetch origin && git status -sb
git pull --ff-only            # nếu nhánh sau remote

# 2) Cài + kiểm code sạch
npm ci
npm run build                 # phải exit 0
npm test                      # dùng Node 20 (Node 26 làm vỡ test localStorage/jsdom)
npm run lint                  # 0 error (warning không chặn)
```

**3) Deploy WEB (đây mới là thứ app native thực sự tải):**
- Đẩy code lên `hoainxm/forfish` → Vercel tự build. Đợi xong, **kiểm**:
```bash
curl -I https://forfish-alpha.vercel.app                       # 200
curl -s https://forfish-alpha.vercel.app/quyen-rieng-tu | grep "quyền riêng tư"
```
> Nếu chỉ sửa nội dung web (không đổi vỏ native/version): **DỪNG Ở ĐÂY** — app đã cập nhật.
> Chỉ đi tiếp mục 3/4 khi cần binary mới (đổi icon/plugin, bump version, đóng reject).

**4) Bump version** (mỗi lần nộp store BẮT BUỘC tăng):
- **Android**: nếu build bằng CI thì **tự tăng** (`versionCode = 10000 + run_number`), khỏi sửa.
  Build tay thì sửa `android/app/build.gradle` (`versionCode` tăng, `versionName` mới).
- **iOS**: trong Xcode → target App → General → **Build** tăng lên số lớn hơn lần upload gần nhất
  (bản `1.0 (1)` đã dùng → nộp lần sau dùng **build ≥ 2**), giữ **Version = 1.0**.

---

## 3. ANDROID → CH Play

Chọn **1 trong 2 cách**. Khuyến nghị **Cách A (CI)** cho các bản sau; **Cách B (local)** khi muốn tự tay.

### Cách A — Tự động bằng GitHub Actions (khuyến nghị)
1. GitHub → repo `hoainxm/forfish` → **Actions** → **"Android release (build + publish CH Play)"** → **Run workflow**.
2. Điền: `versionName` (vd `1.0.4`) · `track` (`internal` để thử, `production` để phát hành) · `publish` (tick = đẩy luôn lên Play).
   - Hoặc: `git tag v1.0.4 && git push origin v1.0.4` → workflow tự chạy.
3. Xong: AAB nằm ở artifact `app-release-aab`; nếu tick publish thì đã lên Play track đã chọn.

> **Điều kiện một lần** trước khi CI publish được:
> - Secrets đã set: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
>   `ANDROID_KEY_PASSWORD`, `PLAY_SERVICE_ACCOUNT_JSON` (xem đầu file `android-release.yml`).
> - **AAB ĐẦU TIÊN phải upload TAY** một lần lên Play (Play chặn API cho app chưa có bản nào) → làm Cách B cho lần đầu.

### Cách B — Build tay trên máy (Android Studio / Gradle)
```bash
mkdir -p out && echo '<!doctype html><meta charset="utf-8"><title>SDFish</title><body>Đang tải SDFish…' > out/index.html
npx cap sync android          # copy web(stub) + plugin sang android/
npm run icons                 # icon đúng listing
```
Rồi **một trong hai**:
- **Android Studio**: `npm run cap:open:android` → Build → *Generate Signed Bundle / APK* → **Android App Bundle** → chọn keystore → Release. File `.aab` ra ở `android/app/build/outputs/bundle/release/`.
- **Dòng lệnh**:
  ```bash
  cd android && ./gradlew bundleRelease
  # → android/app/build/outputs/bundle/release/app-release.aab
  ```
Upload lên [play.google.com/console](https://play.google.com/console) → app SDFish → **Production** (hoặc **Internal testing**) → **Create new release** → upload `.aab`.

### Trên Play Console (không phải code — làm cả 2 cách):
- **Release notes** (tiếng Việt): tính năng mới + "bổ sung chính sách quyền riêng tư".
- **App content**: **Privacy policy** = `https://forfish-alpha.vercel.app/quyen-rieng-tu` ·
  **Data safety** khai theo bảng §5.1 build-publish-store (Location + Phone/Name + App activity, **không** tracking, **không** chia sẻ quảng cáo) · **App access** = tài khoản demo (§5 dưới).
- **Review → Rollout**.

---

## 4. iOS → App Store (Xcode)

> Lần đầu đã `cap add ios` ở §1d. Các lần sau bắt đầu từ đây.

```bash
mkdir -p out && echo '<!doctype html><meta charset="utf-8"><title>SDFish</title><body>Đang tải SDFish…' > out/index.html
npx cap sync ios              # copy web(stub) + plugin + pod install
npm run icons
npm run cap:open:ios          # mở Xcode
```

**Trong Xcode:**
1. Target **App → Signing & Capabilities**: chọn **Team** (Apple Developer), bundle `vn.sdvico.sdfish`, bật **Automatically manage signing**.
2. **General**: **Build** tăng (≥2), **Version** giữ `1.0`.
3. **Info.plist** — thêm (thiếu là app crash khi xin vị trí + bị reject 5.1.2):
   - `NSLocationWhenInUseUsageDescription` =
     *"SDFish dùng vị trí để canh bản đồ và xem gió sóng đúng chỗ bạn đang ở. Vị trí không được lưu lại hay gắn với tài khoản."*
4. Chọn thiết bị **Any iOS Device (arm64)** → **Product → Archive**.
5. **Organizer** hiện ra → **Distribute App → App Store Connect → Upload**.

**Trong App Store Connect** ([appstoreconnect.apple.com](https://appstoreconnect.apple.com)):
1. Chọn build vừa upload (đợi ~15–30′ "processing").
2. **App Privacy** → khai đúng bảng §5.1 build-publish-store, **BỎ HẾT** mục "Used to Track You".
3. **App Information → Privacy Policy URL** = `https://forfish-alpha.vercel.app/quyen-rieng-tu`.
4. **App Review Information** → tài khoản demo + Notes (§5 dưới).
5. **Add for Review → Submit**.

> iOS **chưa có CI tự động** (cần Mac/Xcode) — luôn làm tay ở đây.

---

## 5. Tài khoản demo cho người duyệt (bắt buộc cả 2 store)

- Tạo bằng chính `/dang-ky`: SĐT 10 số hợp lệ, **mật khẩu ≥6 ký tự, KHÔNG dấu cách, KHÔNG viết hoa**
  (bàn phím máy reviewer tự viết hoa chữ đầu → sai mật khẩu).
- **Tự đăng nhập thử ở `https://forfish-alpha.vercel.app/login` TRƯỚC khi nộp.**
- Review Notes (dán vào ASC / Play "App access"):
  > Tài khoản demo: SĐT `09xxxxxxxx`, mật khẩu `xxxxxx`.
  > Dữ liệu (tàu, giấy tờ, sổ) lưu cục bộ theo máy nên lần đầu đăng nhập sẽ thấy màn trống —
  > bấm **"Thêm tàu"** ở Trang chủ để tạo dữ liệu mẫu, hoặc xem các màn công khai (Ra khơi,
  > Giá cả, Danh bạ cảng) không cần đăng nhập.
  > App KHÔNG tracking; không có SDK quảng cáo/analytics. Vị trí chỉ dùng tại chỗ để canh bản
  > đồ, không lưu. Chính sách: https://forfish-alpha.vercel.app/quyen-rieng-tu

---

## 6. Screenshot store (chỉ khi listing đổi — đừng dùng ảnh cũ)

```bash
npm run build && npm start                 # server localhost:3000
node scripts/capture-app-screens.mjs       # Play (cần SHOT_PHONE/SHOT_PASSWORD trong .env.local)
node scripts/generate-ios-screenshots.mjs  # iPhone 6.5"/6.7" + iPad 12.9"/13"
```
> Cần tạo `.env.local` với `SHOT_PHONE`/`SHOT_PASSWORD` (tài khoản test) — **hiện repo chưa có file này**.
> Ảnh Play 9:16 KHÔNG resize thẳng sang iPhone/iPad. Màn login-gate phải có tài khoản test mới chụp ra data.

---

## 7. Checklist nộp (tick từng dòng)

**Code:**
- [ ] `npm run build` + `npm test` (Node 20) + `npm run lint` sạch.
- [ ] Web deploy live: `forfish-alpha.vercel.app` 200 + `/quyen-rieng-tu` mở được.
- [ ] Bump version: Android `versionCode` (CI tự / build.gradle tay) · iOS **Build** trong Xcode.

**Hồ sơ store:**
- [ ] Privacy Policy URL = `https://forfish-alpha.vercel.app/quyen-rieng-tu` (mở được).
- [ ] Nhãn App Privacy (Apple) + Data safety (Play) khớp bảng §5.1, **KHÔNG** tracking.
- [ ] `NSLocationWhenInUseUsageDescription` có trong Info.plist (iOS).
- [ ] Tài khoản demo tồn tại thật + tự đăng nhập thử được + Review Notes đầy đủ.
- [ ] Screenshot mới (nếu listing đổi), icon = listing (đã `npm run icons`).

---

## 8. Kẹt thì xem đâu

| Triệu chứng | Xem |
|---|---|
| Reject 5.1.2 (Privacy / tracking) hoặc 2.1 (demo không đăng nhập được) | [build-publish-store.md §5](build-publish-store.md) |
| Vercel deploy "đứng" không có bản mới | [ADR 0006](../adr/0006-cron-day-hon-mot-ngay-khong-vao-vercel-json.md) — cron sub-daily trong `vercel.json` chặn deploy |
| Đổi domain sang `sdfish.sdvico.vn` | [build-publish-store.md §6](build-publish-store.md) |
| Hiện trạng PWA / còn thiếu gì | [native-deploy.md](native-deploy.md) |
| GitHub Actions cron báo đỏ (thiếu `APP_BASE_URL`/`CRON_SECRET`) | §1e file này |

---

**Last updated**: 2026-08-20
