// Cấu hình RIÊNG cho bộ chấm dẫn đường (scripts/dan-duong/) — KHÔNG lẫn vào `npm test`.
// Chạy: npm run dan-duong:cham   (hoặc npx vitest run --config vitest.dan-duong.config.ts)
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["scripts/dan-duong/**/*.cham.ts"],
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
