// `npm run dev:cho` — chạy `next dev` ở CHẾ ĐỘ KHO FILE của Chợ vật tư
// (MARKET_STORE=file, xem docs/app-map/12-kien-truc-san-thuong-mai.md §5–§6).
//
// Vì sao là file .mjs chứ không phải `MARKET_STORE=file next dev` trong
// package.json: cú pháp gán biến kiểu bash hỏng trên Windows (cùng bài học
// scripts/run-vitest.mjs). Cổng mặc định 3020 để không đụng `npm run dev` (3000);
// đổi bằng `npm run dev:cho -- -p 3030`.
import { spawn } from "node:child_process";

const args = process.argv.slice(2);
const hasPort = args.includes("-p") || args.includes("--port");
const env = { ...process.env, MARKET_STORE: "file" };
delete env.VERCEL; // ba điều kiện của isDevFileModeEnv — không để biến lạ tắt file mode

const child = spawn("next", ["dev", ...(hasPort ? [] : ["-p", "3020"]), ...args], {
  stdio: "inherit",
  env,
  shell: true, // tìm bin `next`(.cmd) qua PATH trên cả Linux/macOS lẫn Windows
});

child.on("exit", (code) => process.exit(code ?? 1));
child.on("error", (err) => {
  console.error("[dev-market] không chạy được next dev:", err.message);
  process.exit(1);
});
