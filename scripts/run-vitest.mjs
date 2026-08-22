// Chạy `vitest run`, TỰ thêm cờ `--no-experimental-webstorage` CHỈ khi Node ≥ 22.
//
// VÌ SAO (2026-08-21, sửa CI đỏ):
//  · Từ Node 22, Node có localStorage NATIVE (experimental webstorage) che
//    localStorage của jsdom → test dùng nhầm bản native. Cờ này tắt nó đi.
//  · NHƯNG cờ chỉ tồn tại từ Node 22. Trên Node 20 (CI đang pin) truyền cờ qua
//    NODE_OPTIONS ⇒ Node báo "--no-experimental-webstorage is not allowed in
//    NODE_OPTIONS" và KHÔNG khởi động (exit 9) — đúng lỗi CI gặp.
//  · Bản cũ dùng tiền tố `NODE_OPTIONS=... vitest run` kiểu shell → còn hỏng cả
//    trên Windows cmd/PowerShell (không hiểu cú pháp gán biến kiểu bash).
//
// Bọc ở đây: Node 20 → bỏ cờ (không cần + không hỏng); Node ≥22 → bật cờ. Chạy
// được đồng nhất trên CI (Node 20), máy dev (Node 22/26), và Windows.
//
// Truyền tiếp mọi tham số: `npm test -- src/lib/__tests__/x.test.ts` vẫn chạy đúng.

import { spawn } from "node:child_process";

const major = Number(process.versions.node.split(".")[0]);
const env = { ...process.env };
if (Number.isFinite(major) && major >= 22) {
  env.NODE_OPTIONS = `${env.NODE_OPTIONS ?? ""} --no-experimental-webstorage`.trim();
}

const child = spawn("vitest", ["run", ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
  shell: true, // để tìm được bin `vitest`(.cmd) qua PATH trên cả Linux lẫn Windows
});

child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error("[run-vitest] không chạy được vitest:", err.message);
  process.exit(1);
});
