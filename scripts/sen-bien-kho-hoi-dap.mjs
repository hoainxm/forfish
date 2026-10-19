// DỰNG KHO HỎI–ĐÁP Sen Biển cho app — chạy lại mỗi lần chủ dự án duyệt thêm trên trang duyệt (claude.ai).
//   npx jiti scripts/sen-bien-kho-hoi-dap.mjs --meta <meta.json> --danh-muc <danh-muc.jsonl> [--quyet <thư mục quyet/*.json>]
//   ⇒ public/data/sen-bien-hoi-dap.v1.json (ĐÈ, một lớp một file)
// meta.json + danh-muc.jsonl: gpu-desktop ~/.local/forlife/train/{out/troly-ngram-v5b,sen-bien-hd/train/data/forfish-hoidap-v1}.
// quyet/: ArtifactData list collection "quyet" với out_dir (mỗi chủ đề một file {m: {id: {t, dap?}}}).
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { dungKho } from "../src/lib/sen-bien/hoi-dap.ts";

const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const meta = JSON.parse(readFileSync(arg("--meta"), "utf8"));
const dm = readFileSync(arg("--danh-muc"), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
const quyet = {};
const qd = arg("--quyet");
if (qd && existsSync(qd)) for (const f of readdirSync(qd, { recursive: true }).filter((f) => String(f).endsWith(".json"))) {
  const m = JSON.parse(readFileSync(path.join(qd, String(f)), "utf8")).m ?? {};
  Object.assign(quyet, m);
}
const kho = dungKho(meta.q, dm, quyet);
writeFileSync("public/data/sen-bien-hoi-dap.v1.json", JSON.stringify(kho));
console.log(`kho: ${kho.q.length} mã · đã duyệt ${Object.keys(kho.dap).length}`);
