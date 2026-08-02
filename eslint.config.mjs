import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Build của harness e2e quay video (scripts/e2e-build.mjs) — cùng loại với
    // .next nhưng khác tên nên KHÔNG lọt danh sách mặc định; để nguyên thì
    // `npm run lint` báo hàng nghìn lỗi trong mã sinh tự động, lấp mất lỗi thật.
    ".next-e2e/**",
    ".next-e2e-auth/**",
    // Build NẰM SÂU: worktree của agent (.claude/worktrees/*/.next/**) — mẫu
    // ".next/**" chỉ khớp ở gốc repo. Không chặn thì mỗi worktree bỏ lại thêm
    // ~1000 "lỗi" trong mã đã biên dịch.
    "**/.next/**",
    ".claude/**",
  ]),
  {
    rules: {
      // Pattern chuẩn của dự án: hydrate state từ localStorage trong useEffect
      // SAU khi mount (xem docs/app-map/02-architecture.md §4). SSR render trạng
      // thái rỗng/demo, client đọc storage rồi setState một lần — cố ý như vậy
      // để tránh SSR/CSR mismatch. Rule này (eslint-plugin-react-hooks v6) flag
      // mọi setState đồng bộ trong effect, kể cả pattern hợp lệ này, nên tắt.
      "react-hooks/set-state-in-effect": "off",
      /*  ═══ MÃ KHÔNG BAO GIỜ CHẠY = LỖI, KHÔNG PHẢI CẢNH BÁO ═══ (2026-08-03)

          Vì sao bật: vòng soát 6 của mạch kho offline tìm thấy một dòng
          `return "san-sang";` nằm SAU một `return` khác — không bao giờ chạy —
          mà **cả `tsc --noEmit` lẫn `npm run lint` đều để lọt**. Nó sống sót qua
          SÁU vòng soát và 1634 test xanh. Mã chết trong một hàm quyết định
          "trong máy có dữ liệu không" là thứ đọc-thì-tưởng-đúng: người sau đọc
          dòng cuối rồi tin đó là nhánh mặc định.

          `no-unreachable` là rule lõi của ESLint, không cần plugin, gần như
          không có dương tính giả. Để mức "error" cho nó chặn hẳn, đúng tinh thần
          các cổng chặn khuôn khác của dự án (nguyên tắc 8/12). */
      "no-unreachable": "error",
    },
  },
]);

export default eslintConfig;
