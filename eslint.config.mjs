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
  ]),
  {
    rules: {
      // Pattern chuẩn của dự án: hydrate state từ localStorage trong useEffect
      // SAU khi mount (xem docs/app-map/02-architecture.md §4). SSR render trạng
      // thái rỗng/demo, client đọc storage rồi setState một lần — cố ý như vậy
      // để tránh SSR/CSR mismatch. Rule này (eslint-plugin-react-hooks v6) flag
      // mọi setState đồng bộ trong effect, kể cả pattern hợp lệ này, nên tắt.
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
