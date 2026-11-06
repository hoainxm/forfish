// Dọn sổ đồng bộ (user_docs) của tài khoản TEST trước khi quay lại — chỉ số loại "test".
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(new URL("../../.env.local", import.meta.url), "utf8").split(/\r?\n/).map((l) => /^([A-Z0-9_]+)=(.*)$/.exec(l)).filter(Boolean).map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.SUPABASE_SERVICE_ROLE_KEY;
const h = { apikey: K, authorization: `Bearer ${K}`, "content-type": "application/json" };
for (const p of process.argv.slice(2)) {
  const g = await (await fetch(`${U}/rest/v1/customers?phone=eq.${p}&select=account_kind`, { headers: h })).json();
  if (g[0]?.account_kind !== "test") { console.log("bỏ", p, "không phải test"); continue; }
  const r = await fetch(`${U}/rest/v1/user_docs?owner_phone=eq.${p}`, { method: "DELETE", headers: h });
  console.log("dọn", p, r.status);
}
