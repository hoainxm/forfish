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
  // server: { url: "https://<sdfish-web>.vercel.app", cleartext: false },
};

export default config;
