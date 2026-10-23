#!/usr/bin/env node
// Chạy bộ chấm dẫn đường (vitest config riêng) rồi in đường dẫn bảng điểm.
// Dùng: npm run dan-duong:cham   · kết quả: .dan-duong/bang-diem.{json,md} (DAN_DUONG_OUT để đổi chỗ)
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const major = Number(process.versions.node.split(".")[0]);
const env = { ...process.env };
if (major >= 22) env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --no-experimental-webstorage`.trim();
const r = spawnSync("vitest", ["run", "--config", "vitest.dan-duong.config.ts", ...process.argv.slice(2)], { stdio: "inherit", env, shell: true });
const out = path.join(process.env.DAN_DUONG_OUT ?? ".dan-duong", "bang-diem.json");
if (existsSync(out)) {
  const kq = JSON.parse(readFileSync(out, "utf8"));
  console.log(`\nbảng điểm: ${out} — ${kq.dat}/${kq.tong} = ${kq.tiLe} % · ${kq.quaCong ? "QUA CỔNG" : "CHƯA QUA"}`);
  process.exit(kq.quaCong ? 0 : 3);
}
process.exit(r.status ?? 1);
