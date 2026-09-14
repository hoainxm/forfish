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
  // Ghim gốc workspace về thư mục dự án. Máy dev có lockfile lạc ở thư mục cha
  // (C:\Users\ACER\package-lock.json) khiến Next đoán nhầm gốc → sai manifest
  // module (lỗi 500 "Could not find module global-error.js"). Ghim rõ để hết.
  // Dùng process.cwd() (không __dirname): khi SWC gốc bị chặn (Windows Smart App
  // Control enforce), Next biên dịch file này ra ESM — nơi __dirname không tồn
  // tại → sập "next config error". process.cwd() = thư mục chạy npm run dev =
  // gốc dự án, chạy được cả bản CJS lẫn ESM.
  turbopack: {
    root: process.cwd(),
  },
  ...(e2eDistDir ? { distDir: e2eDistDir } : {}),
};

export default nextConfig;
