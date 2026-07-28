// Build cho e2e quay video hướng dẫn — 2 biến thể, output thư mục riêng
// (không đè .next của dev server). Chạy: node scripts/e2e-build.mjs [demo|auth|all]
//
// · demo (.next-e2e):      KHÔNG env Supabase → isSupabaseConfigured=false,
//   gate premium "open", data localStorage — không đụng DB prod.
// · auth (.next-e2e-auth): env Supabase GIẢ (e2edemo.supabase.co) → UI coi như
//   "có máy chủ"; mọi request Supabase/API được page.route() MOCK trong test.
//   Không có secret thật, không request nào tới DB prod.
import { spawnSync } from "node:child_process";

const COMMON = {
  SDWORK_SUPABASE_URL: "",
  SDWORK_SUPABASE_ANON_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  ADMIN_PHONES: "",
};

const VARIANTS = {
  demo: {
    E2E_DEMO_BUILD: "1",
    NEXT_PUBLIC_SUPABASE_URL: "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
    ...COMMON,
  },
  auth: {
    E2E_AUTH_BUILD: "1",
    NEXT_PUBLIC_SUPABASE_URL: "https://e2edemo.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "e2e-demo-anon-key",
    ...COMMON,
  },
};

const arg = process.argv[2] || "demo";
const names = arg === "all" ? ["demo", "auth"] : [arg];

for (const name of names) {
  const env = VARIANTS[name];
  if (!env) {
    console.error(`Không có biến thể "${name}" — dùng demo | auth | all`);
    process.exit(1);
  }
  console.log(`\n=== e2e build: ${name} ===`);
  const r = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
