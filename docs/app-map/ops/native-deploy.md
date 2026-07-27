# Ops — Deploy native iOS/Android (PWA + Capacitor)

> **Mục đích**: đường đưa SDFish lên điện thoại — PWA (cài được ngay) + Capacitor (lên App Store / Play). Hiện trạng + việc còn thiếu + cấu hình.

**Load khi**: làm gì liên quan cài đặt app, manifest, service worker, icon, hoặc wrap native.

---

## 1. Hiện trạng (đã có trong repo)

- **PWA cài được**: `src/app/manifest.ts` (→ `/manifest.webmanifest`), `public/sw.js` (service worker offline shell), `src/components/sw-register.tsx` (đăng ký SW, chỉ production), icon `brand/logo-sdfish.png` (bộ logo gốc — không commit SVG tay) → `public/icons/*` **và Android launcher `android/.../mipmap-*/ic_launcher{,_round,_foreground}.png`** (sinh bằng `npm run icons`, devDep `sharp`; auto crop bỏ chữ "SDFish", pad mark vào nền trắng bo 22%). ⚠️ Bắt buộc chạy lại `npm run icons` sau `cap add android` để đè icon Capacitor mặc định (chữ X) — nếu không app cài về khác store listing → Google flag "Misleading Claims / listing mismatch". `layout.tsx` khai `manifest` + `icons` + `appleWebApp` + `viewport.themeColor`.
- **Store assets**: `store-assets/` (xem README trong đó). **Screenshot CHỤP TỪ APP ĐANG CHẠY**: `node scripts/capture-app-screens.mjs` — dev/prod server ở `localhost:3000`, đăng nhập bằng `SHOT_PHONE`/`SHOT_PASSWORD` trong `.env.local` (KHÔNG hardcode), chụp tại **đúng viewport từng store** nên ra đúng pixel, khỏi resize: Play phone 360×640@3=1080×1920 · iPhone 6.5" 414×896@3=1242×2688 · 6.7" 428×926@3=1284×2778. Script tự ẩn `nextjs-portal` (badge "N" dev overlay đè lên dock — từng lọt vào ảnh). ⚠️ **KHÔNG dùng lại ảnh cũ**: bộ chụp 2026-07-01 lệch vì login-gate lên 2026-07-02 → ảnh khoe nội dung mà app chặn bằng thẻ khóa = rủi ro store flag. Màn login-gate (Tàu/Tiền/Bạn thuyền) phải có tài khoản test mới chụp ra data. **Screenshot iOS** (App Store bắt ĐÚNG pixel: iPhone 6.5"=1242×2688, 6.7"=1284×2778; iPad 12.9"=2048×2732, 13"=2064×2752) sinh bằng `node scripts/generate-ios-screenshots.mjs` → `store-assets/ios/{6.5,6.7,ipad-12.9,ipad-13}/*.png` — đặt ảnh app thật vào khung marketing (nền brand + tiêu đề), render puppeteer + Chrome hệ thống; ảnh giới hạn theo chiều cao nên vừa cả canvas 9:19.5 lẫn 3:4. Ảnh Play 9:16 KHÔNG resize thẳng sang iPhone/iPad được. Thêm cỡ mới → thêm vào `SIZES[]`.
- **Sẵn-sàng-Capacitor**: `src/lib/api-base.ts` (`apiUrl()`) — mọi fetch `/api/*` đi qua đây. Web để `NEXT_PUBLIC_API_BASE` trống = path tương đối (như cũ); native set = URL backend hosted. `capacitor.config.ts` (appId `vn.sdvico.sdfish`) + script `cap:sync`/`cap:open:*` trong package.json.

**Ràng buộc cốt lõi**: app có **12 API route động** (proxy nguồn ngoài + Supabase, CORS) → **KHÔNG static-export thuần**. Backend phải chạy ở đâu đó (Vercel hiện tại) cho cả PWA lẫn Capacitor chế độ chuẩn.

## 2. PWA (không cần Mac / tài khoản store)

1. `npm run icons` (sinh PNG nếu đổi `brand/logo-sdfish.png`) → commit `public/icons/*`.
2. `npm run build && npm start` (hoặc deploy Vercel) — SW chỉ chạy ở production.
3. Kiểm: DevTools → Application → Manifest (name SDFish, icons) + Service Worker (activated). Lighthouse → Installable.
4. iOS: Safari → Share → Add to Home Screen. Android: Chrome → Install app.

Offline: sau lần mở đầu, mất mạng vẫn mở được vỏ app (`/` cache); dữ liệu sổ vẫn ở localStorage `forfish.*`. Bão/giá/cá là network-first → mất mạng hiện bản cache gần nhất.

## 3. Capacitor (lên App Store / Play)

Hai chế độ (chọn trong `capacitor.config.ts`):
- **(a) Nhanh — `server.url`**: trỏ web đã deploy (Vercel). Vỏ native tải web live. Cần mạng; store có thể soi "chỉ là website".
- **(b) Chuẩn — static bundle + API remote**: `webDir:"out"` + set `NEXT_PUBLIC_API_BASE=https://<web>.vercel.app` khi build. Bundle web nằm trong app, API gọi tuyệt đối về backend.

Bước (cần môi trường, CHƯA chạy trong repo):
```bash
npm i -D @capacitor/ios @capacitor/android @capacitor/app @capacitor/status-bar @capacitor/keyboard
npx cap add ios        # cần Mac + Xcode
npx cap add android    # cần Android Studio + SDK
npm run cap:sync
npm run cap:open:ios   # / cap:open:android
```

## 4. Còn thiếu (cần user / môi trường)

- **Mac + Xcode** (build iOS) · **Android Studio/SDK** (build Android).
- **Tài khoản Apple Developer** ($99/năm) + **Google Play Console** ($25 một lần).
- Chốt **hosting URL** backend cho `NEXT_PUBLIC_API_BASE` (giữ Vercel hiện tại hợp lý).
- Map tile/source trong `lib/nautical-layers.ts` đã qua `apiUrl`; các tile NGOÀI (NASA GIBS, OpenSeaMap) là origin ngoài — SW bỏ qua, native gọi trực tiếp (cần mạng).
- Splash screen Android (adaptive icon đã sinh qua `npm run icons` — 2026-07-14).

> **RUNBOOK build & phát hành chi tiết (Android + iOS từ chốt code → store)**: [build-publish-store.md](build-publish-store.md). File này chỉ giữ hiện trạng + lịch sử reject.

## 5c. Reject lần 2 — 5.1.2 Data Use and Sharing (2026-07-27)

Nguyên nhân gốc: **app KHÔNG có trang chính sách quyền riêng tư nào** → thiếu điều kiện cơ bản của 5.1.2 (privacy policy truy cập được + nhãn khớp thực tế). **Domain KHÔNG phải nguyên nhân trực tiếp**, nhưng Privacy Policy URL phải mở được — không dùng `sdfish.sdvico.vn` được vì domain đó hiện trỏ nhầm host + TLS sai + 404 (kiểm 2026-07-27; xem [build-publish-store.md §0.1](build-publish-store.md)).

Đã sửa trong code (commit 2026-07-27):
- Trang công khai **`/quyen-rieng-tu`** (`src/app/quyen-rieng-tu/page.tsx`, xem [02 §2](../02-architecture.md)) — khai đúng bảng §5a, không tracking.
- Link từ `/login`, `/dang-ky`, sheet Tài khoản.

Còn phải làm ở store (không phải code): nhãn App Privacy khớp §5a + Privacy Policy URL trỏ `/quyen-rieng-tu` + `NSLocationWhenInUseUsageDescription` trong Info.plist + tài khoản demo. Chi tiết [build-publish-store.md §5](build-publish-store.md).

## 5. App Store review — hồ sơ nộp (lần 1 bị từ chối 2026-07-17)

Submission `4300b669-820b-404a-b2f5-fe3c72a84ca6`, bản 1.0 (1), máy review **iPad Air 11" (M3)**. Hai lỗi:

### 5a. Guideline 5.1.2(i) — ATT (nhãn quyền riêng tư khai SAI, KHÔNG phải lỗi code)

Nhãn App Privacy trong App Store Connect đang khai 5 loại dữ liệu **"Used to Track You"**. SDFish **KHÔNG tracking** theo định nghĩa Apple (không nối dữ liệu app với dữ liệu bên thứ ba để quảng cáo, không bán cho data broker): repo **không có** SDK quảng cáo/analytics/attribution nào (không AdMob, Firebase, Facebook, AppsFlyer, Adjust, Sentry, GA) — xem [external-services.md](external-services.md), toàn bộ nguồn ngoài là API thời tiết/hải văn công cộng nhận **toạ độ trần**, không định danh. Không đọc IDFA.

→ Sửa **nhãn** (App Store Connect → App Privacy), KHÔNG thêm framework ATT:

| Loại dữ liệu | Thu ở đâu | Mục đích khai | Linked to user | Used for Tracking |
|---|---|---|---|---|
| Phone Number | SĐT = tên đăng nhập (`/login`, `/dang-ky`), webhook SDWork | App Functionality | Yes | **No** |
| Name | tên KH đồng bộ từ CRM SDWork (hiện ở thẻ tài khoản) | App Functionality | Yes | **No** |
| User ID | uid Supabase Auth | App Functionality | Yes | **No** |
| Other User Content | sổ chuyến/giấy tờ/thuyền viên — phần lớn nằm localStorage **trên máy** | App Functionality | Yes | **No** |
| Precise Location | `getCurrentPosition` ở `route-planner.tsx` + `fishing-map-view.tsx` — chỉ để canh bản đồ và hỏi gió sóng theo toạ độ | App Functionality | **Not Linked** (không lưu DB, không gắn tài khoản) | **No** |

Cần vai **Account Holder / Admin** mới sửa được nhãn. Sửa xong trả lời App Review nói rõ: app không tracking trên mọi nền tảng, nhãn đã cập nhật.

### 5b. Guideline 2.1 — tài khoản demo không đăng nhập được

Nguyên nhân code (đã sửa 2026-07-24): `PasswordField` bấm **Hiện** đổi `type="text"` mà **thiếu** `autoCapitalize="none" autoCorrect="off" spellCheck={false}` → iOS/iPadOS tự viết hoa chữ đầu, mật khẩu demo `nam nguyen` gõ ra `Nam nguyen` = sai. Xem [07-design-spec §6](../07-design-spec.md).

Nguyên nhân hồ sơ: tài khoản demo khai trong ASC phải **tồn tại thật** trên Supabase prod (`znzgugvfhgmiszqgjulk`) và tự đăng nhập thử được ở `https://forfish.vercel.app/login` TRƯỚC khi nộp. Quy ước hồ sơ demo:

- SĐT 10 số hợp lệ (`isValidVnPhone`), mật khẩu ≥6 ký tự, **không dấu cách, không viết hoa** (né bàn phím máy reviewer).
- Tạo bằng chính `/dang-ky` (route `/api/auth/signup` → Edge Function `auth-gateway`, email ảo confirm sẵn).
- Dữ liệu tàu/giấy tờ/sổ nằm **localStorage theo máy** và bị `clearUserScopedData()` xoá khi đổi user → máy reviewer đăng nhập vào sẽ thấy **màn trống**. Review Notes phải hướng dẫn bấm "Thêm tàu của bạn" trước, hoặc nộp kèm chế độ dữ liệu mẫu.

⚠️ `capacitor.config.ts` đang chạy chế độ (a) `server.url` → **sửa web + deploy Vercel là app native ăn ngay**, không cần build lại binary; vẫn phải nộp lại bản build để đóng lỗi rejection.

## 6. KHÔNG đổi

- localStorage keys `forfish.*` (dữ liệu người dùng — giữ nguyên, xem 02 §4).
- Infra IDs: `forfish-gateway`, `source_page='forfish'`, Supabase project ref, GitHub repo.

---

**Last updated**: 2026-07-27
