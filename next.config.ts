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
  // `output: "standalone"` CHỈ cho deploy SELF-HOST (PM2 + IIS/NSSM, xem
  // ops/deploy-windows-iis.md): build ra `.next/standalone/server.js` + node_modules
  // tối thiểu, copy gọn sang server, KHÔNG cần `npm install` lúc chạy.
  // ⚠️ TẮT TRÊN VERCEL: standalone đổi cấu trúc output ⇒ Vercel thiếu
  // `.next/next-server.js.nft.json` → build FAIL (ENOENT, dính prod 2026-09-24).
  // Vercel tự lo output/trace nên để MẶC ĐỊNH. `VERCEL=1` do Vercel tự đặt lúc build.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  // Ghim gốc workspace về thư mục dự án. Máy dev có lockfile lạc ở thư mục cha
  // (C:\Users\ACER\package-lock.json) khiến Next đoán nhầm gốc → sai manifest
  // module (lỗi 500 "Could not find module global-error.js"). Ghim rõ để hết.
  turbopack: {
    root: __dirname,
  },
  ...(e2eDistDir ? { distDir: e2eDistDir } : {}),
  // Mã bản cho "Có bản mới — chạm để cập nhật" (lib/app-version.ts). Vercel tự
  // đặt VERCEL_GIT_COMMIT_SHA; bản tự host sdfish.sdvico.vn build trên GitHub
  // Actions (.github/workflows/deploy.yml) nên có GITHUB_SHA — thiếu nhánh này
  // thì máy chủ trả mã rỗng và thẻ không bao giờ hiện (dính 2026-09-29).
  // Máy dev: cả hai rỗng ⇒ tính năng tự tắt.
  env: {
    NEXT_PUBLIC_BUILD_ID: (
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GITHUB_SHA ||
      ""
    ).slice(0, 12),
  },
};
export default nextConfig;
