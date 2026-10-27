import type { CapacitorConfig } from "@capacitor/cli";

/*
  Cấu hình Capacitor để wrap SDFish thành app iOS/Android. CHƯA sinh project
  native (cần Mac+Xcode / Android Studio) — xem docs/app-map/ops/native-deploy.md.

  Hai chế độ wrap (chọn khi build native):
   (a) NHANH — server.url trỏ web đã deploy (Vercel). App là vỏ native tải web
       live; cần mạng, dễ bị store soi "chỉ là website". Bỏ comment server bên dưới.
   (b) CHUẨN — static-export phần web (webDir 'out') + NEXT_PUBLIC_API_BASE trỏ
       backend hosted (apiUrl trong src/lib/api-base.ts). Bundle nằm trong app.

  Storage người dùng vẫn là localStorage forfish.* (giữ nguyên, không đổi).
*/
const config: CapacitorConfig = {
  appId: "vn.sdvico.sdfish",
  appName: "SDFish",
  webDir: "out",
  // WEB CÔNG TY sdfish.sdvico.vn (2026-10-27, anh Long: "Đổi capacitor.config server.url sang
  // https://sdfish.sdvico.vn"). Build từ `main` của sdvico/forfish qua deploy.yml (runner Windows, chỉ khi
  // ci xanh) — cùng nguồn nhánh với bản cũ, có /quyen-rieng-tu. Trước đó trỏ forfish-alpha.vercel.app
  // (Vercel của sdvico, không nằm trong team Long) — 2026-10-27 đo trả 503 DEPLOYMENT_PAUSED ⇒ app mở ra lỗi.
  // ⚠️ Đổi origin ⇒ localStorage/IndexedDB của bản cũ KHÔNG theo sang (kho theo origin): sổ đã đồng bộ về lại khi
  // đăng nhập, phần chỉ nằm trong máy + bản đồ đã tải thì phải tải lại. Chỉ tới máy bà con sau khi phát hành
  // AAB mới (.github/workflows/android-release.yml — server.url nằm trong binary).
  server: { url: "https://sdfish.sdvico.vn/", cleartext: false },
};

export default config;
