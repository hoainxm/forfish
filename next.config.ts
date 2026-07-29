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
  ...(e2eDistDir ? { distDir: e2eDistDir } : {}),
};

export default nextConfig;
