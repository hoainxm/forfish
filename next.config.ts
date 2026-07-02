import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ghim gốc workspace về thư mục dự án. Máy dev có lockfile lạc ở thư mục cha
  // (C:\Users\ACER\package-lock.json) khiến Next đoán nhầm gốc → sai manifest
  // module (lỗi 500 "Could not find module global-error.js"). Ghim rõ để hết.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
