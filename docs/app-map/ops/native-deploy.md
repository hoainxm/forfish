# Ops — Deploy native iOS/Android (PWA + Capacitor)

> **Mục đích**: đường đưa SDFish lên điện thoại — PWA (cài được ngay) + Capacitor (lên App Store / Play). Hiện trạng + việc còn thiếu + cấu hình.

**Load khi**: làm gì liên quan cài đặt app, manifest, service worker, icon, hoặc wrap native.

---

## 1. Hiện trạng (đã có trong repo)

- **PWA cài được**: `src/app/manifest.ts` (→ `/manifest.webmanifest`), `public/sw.js` (service worker offline shell), `src/components/sw-register.tsx` (đăng ký SW, chỉ production), icon `public/logo-src.png` → `public/icons/*` (sinh bằng `npm run icons`, devDep `sharp`). `layout.tsx` khai `manifest` + `icons` + `appleWebApp` + `viewport.themeColor`.
- **Sẵn-sàng-Capacitor**: `src/lib/api-base.ts` (`apiUrl()`) — mọi fetch `/api/*` đi qua đây. Web để `NEXT_PUBLIC_API_BASE` trống = path tương đối (như cũ); native set = URL backend hosted. `capacitor.config.ts` (appId `vn.sdvico.sdfish`) + script `cap:sync`/`cap:open:*` trong package.json.

**Ràng buộc cốt lõi**: app có **12 API route động** (proxy nguồn ngoài + Supabase, CORS) → **KHÔNG static-export thuần**. Backend phải chạy ở đâu đó (Vercel hiện tại) cho cả PWA lẫn Capacitor chế độ chuẩn.

## 2. PWA (không cần Mac / tài khoản store)

1. `npm run icons` (sinh PNG nếu đổi `logo-src.png`) → commit `public/icons/*`.
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
- Splash screen + adaptive icon Android (sinh sau khi `cap add`).

## 5. KHÔNG đổi

- localStorage keys `forfish.*` (dữ liệu người dùng — giữ nguyên, xem 02 §4).
- Infra IDs: `forfish-gateway`, `source_page='forfish'`, Supabase project ref, GitHub repo.

---

**Last updated**: 2026-06-16
