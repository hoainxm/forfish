import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    // khớp alias "@/*" trong tsconfig.json
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    // Trần 5 s mặc định đỏ CHẬP CHỜN khi máy bận (30/10: load 13, mỗi lượt cả bộ đỏ một ca khác — fish-fit,
    // route-plan-strict, spatial-index — ca nào chạy riêng cũng ~1 s và xanh). Các ca nặng CPU (bootstrap, dò
    // tuyến, quét 2 000 tâm) cần chỗ thở; ca treo thật vẫn bị bắt ở 20 s.
    testTimeout: 20_000,
  },
});
