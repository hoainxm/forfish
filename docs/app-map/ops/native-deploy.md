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

## 5. KHÔNG đổi

- localStorage keys `forfish.*` (dữ liệu người dùng — giữ nguyên, xem 02 §4).
- Infra IDs: `forfish-gateway`, `source_page='forfish'`, Supabase project ref, GitHub repo.

---

**Last updated**: 2026-06-16
