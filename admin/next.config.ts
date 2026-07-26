import type { NextConfig } from "next";

// Web QUẢN TRỊ SDFish — app ĐỘC LẬP với app ngư dân (chủ dự án chốt
// 2026-07-26: "tách cái web quản trị là 1 cái riêng độc lập, đừng lẫn vô app").
// Deploy = Vercel project riêng, Root Directory = admin/. Dùng CHUNG Supabase
// với app chính; gọi API app chính qua proxy server-side (x-admin-key).
const nextConfig: NextConfig = {
  // repo có 2 lockfile (gốc + admin/) — chốt root tại admin/ cho Turbopack
  // khỏi đoán nhầm workspace
  turbopack: { root: __dirname },
};

export default nextConfig;
