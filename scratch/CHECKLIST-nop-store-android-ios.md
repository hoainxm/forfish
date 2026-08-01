# Checklist nộp store — Android (#2) + iOS (#3)

Mọi thứ điền sẵn. App chạy chế độ `server.url` → app native tải web `forfish-alpha.vercel.app` (deploy Vercel mới nhất tự vào app, không cần build lại binary).

---

## Dùng chung cả 2 store

- **Bundle/appId**: iOS `vn.sdvico.sdfish` · Android package `vn.sdvico.forfish`
- **Privacy Policy URL**: `https://forfish-alpha.vercel.app/quyen-rieng-tu`
- **Support URL**: `https://forfish-alpha.vercel.app`
- **Danh mục**: Weather / Tiện ích (ngư dân). Không quảng cáo, không mua trong app.

### Nhãn quyền riêng tư (Data Safety Play + App Privacy Apple) — khai GIỐNG NHAU
| Loại dữ liệu | Thu ở đâu | Mục đích | Gắn user | **Tracking** |
|---|---|---|---|---|
| Phone Number | /login, /dang-ky, webhook SDWork | App Functionality | Yes | **No** |
| Name | đồng bộ CRM SDWork | App Functionality | Yes | **No** |
| User ID | uid Supabase Auth | App Functionality | Yes | **No** |
| Other User Content | sổ chuyến/giấy tờ (localStorage trên máy) | App Functionality | Yes | **No** |
| Precise Location | route-planner + fishing-map (canh bản đồ/gió sóng) | App Functionality | **Not Linked** | **No** |

→ **KHÔNG tracking, KHÔNG SDK quảng cáo/analytics, KHÔNG bán dữ liệu.** Vị trí không lưu, không gắn tài khoản.

### ⚠️ TÀI KHOẢN DEMO cho reviewer (BẮT BUỘC — làm TRƯỚC)
1. Vào `https://forfish-alpha.vercel.app/dang-ky` tạo 1 tài khoản: SĐT 10 số hợp lệ, mật khẩu ≥6 ký tự **không dấu cách, không viết hoa**.
2. Đăng nhập thử ở `/login` → OK (đổi mật khẩu lần đầu nếu bị hỏi, dùng mật khẩu cuối).
3. Ghi lại **SĐT + mật khẩu** → điền vào form store (Play "App access" / Apple "Sign-In required").
4. Review Notes (dán): *"Tài khoản demo: SĐT ..., mật khẩu .... Dữ liệu (tàu/giấy tờ) lưu cục bộ theo máy nên lần đầu đăng nhập màn trống — bấm 'Thêm tàu' để tạo dữ liệu mẫu. Màn công khai (Ra khơi/Giao dịch) xem không cần đăng nhập. App KHÔNG tracking, không SDK quảng cáo; vị trí chỉ dùng tại chỗ để canh bản đồ."*

---

## #2 ANDROID (làm được ngay, không cần Mac)

**File**: `app-release.aab` (v1.0.3, đã ký) — gửi kèm.
**Ảnh**: `store-assets/play/` — `phone-1-home.png`, `phone-2-ra-khoi.png`, `phone-3-cho.png`, `app-icon-512.png`, `feature-graphic.png`.

1. [Play Console](https://play.google.com/console) → tạo app **SDFish** (nếu chưa) → chọn **Internal testing** (nhanh, test trước) hoặc Production.
2. **Create release** → upload `app-release.aab`. ⚠️ Bản ĐẦU BẮT BUỘC upload TAY (Play chặn API cho app chưa có bản nào).
3. **Store listing**: tên "SDFish", mô tả ngắn/dài, 3 screenshot phone, icon 512, feature graphic.
4. **App content** (menu trái, điền HẾT mới rollout được): Privacy policy URL · Data safety (bảng trên) · App access (tài khoản demo) · Content rating (điền bảng câu hỏi) · Target audience · Ads = No.
5. **Review → Rollout**. Internal duyệt nhanh; Production vài giờ–vài ngày.

*(CI tự build bản sau: set secrets GitHub — xem docs/app-map/ops/build-publish-store.md §3b. Không bắt buộc cho bản đầu.)*

---

## #3 iOS (CẦN MÁY MAC + Xcode + tài khoản Apple Developer $99/năm)

**Ảnh**: `store-assets/ios/6.5/` + `6.7/` (đã có). iPad nếu cần: `node scripts/generate-ios-screenshots.mjs`.

Trên Mac, tại thư mục dự án:
```bash
npm i -D @capacitor/ios
npx cap add ios          # sinh ios/
npm run cap:sync
npm run icons            # đè icon mặc định
npm run cap:open:ios     # mở Xcode
```

**Trong Xcode:**
1. Target App → Signing & Capabilities: chọn Team, bundle `vn.sdvico.sdfish`, bật Automatically manage signing.
2. General → tăng **Build number** (mỗi lần nộp phải tăng), Version giữ 1.0.
3. **Info.plist — DÁN key này (BẮT BUỘC, thiếu → crash khi xin GPS + reject):**
```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>SDFish dùng vị trí để canh bản đồ ngư trường và xem gió sóng đúng chỗ bạn đang ở. Vị trí không được lưu lại hay gắn với tài khoản.</string>
```
4. Chọn **Any iOS Device (arm64)** → Product → **Archive** → Organizer → **Distribute App → App Store Connect → Upload**.

**Trong App Store Connect:**
1. App SDFish → chọn build vừa upload (chờ ~15–30 phút processing).
2. **App Privacy** → khai đúng bảng trên, **BỎ HẾT "Used to Track You"** (lần reject 17/07 khai nhầm tracking).
3. **App Information → Privacy Policy URL** = `forfish-alpha.vercel.app/quyen-rieng-tu`.
4. **App Review Information**: tài khoản demo + Notes (trên).
5. **Add for Review → Submit**.

---

## Thứ tự mai
1. Tạo + test **tài khoản demo** (chung cả 2 store).
2. **Android** (#2) — không cần Mac, làm trước.
3. **iOS** (#3) — khi ngồi máy Mac.

Runbook chi tiết + lịch sử reject: `docs/app-map/ops/build-publish-store.md`.
