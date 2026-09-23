import type { NextConfig } from "next";

/* Build riêng cho e2e quay video (scripts/e2e-build.mjs + playwright.config.ts):
   để mỗi biến thể ra THƯ MỤC RIÊNG. Nếu không tách, hai build demo/auth (khác
   env NEXT_PUBLIC_* nhúng lúc build) đè lên nhau trong `.next` — và còn đè cả
   bản dev đang chạy. Chạy thường (dev/Vercel) không set hai biến này → distDir
   mặc định `.next`, không đổi gì. */
const e2eDistDir = process.env.E2E_DEMO_BUILD
  ? ".next-e2e"
  : process.env.E2E_AUTH_BUILD
    ? ".next-e2e-auth"
    : undefined;

const nextConfig: NextConfig = {
  // Deploy server nội bộ (IIS + NSSM, xem docs/app-map/ops/deploy-windows-iis.md):
  // cần bundle Node TỰ CHỨA → build ra `.next/standalone/server.js` + node_modules
  // tối thiểu, copy gọn sang server, KHÔNG cần `npm install` lúc chạy. Vercel BỎ QUA
  // field này nên deploy Vercel hiện tại không đổi.
  output: "standalone",
  // Ghim gốc workspace về thư mục dự án. Máy dev có lockfile lạc ở thư mục cha
  // (C:\Users\ACER\package-lock.json) khiến Next đoán nhầm gốc → sai manifest
  // module (lỗi 500 "Could not find module global-error.js"). Ghim rõ để hết.
  turbopack: {
    root: __dirname,
  },
  ...(e2eDistDir ? { distDir: e2eDistDir } : {}),
};

export default nextConfig;
