// Gói KHO HỎI–ĐÁP của Sen Biển thành BA file (CLAUDE.md "một lớp = một file"; hiểu LỆNH vẫn là sen-bien-ngram.v4.bin):
//   public/data/sen-bien-ngram.v5.bin     — w.sbn5 chép nguyên byte, app CHỈ dùng đầu kho (lib/sen-bien/dau-kho.ts)
//   public/data/sen-bien-hoi-dap.v1.json  — kho: mã câu theo đúng thứ tự đầu kho + câu hỏi chuẩn (cho Gemma chọn) + câu trả lời
//   public/data/sen-bien-loc.v1.bin       — bộ lọc "câu hỏi hay câu lệnh": "SBL1" · f32 thang · f32 b · i8 w[65536] (lib/sen-bien/loc.ts)
// Nguồn: repo AI Assistant `train/tro-ly/ngram-ft.mjs` (bản v5b, H=64) + `hoi-dap.mjs` (danh-muc.jsonl, trung.json)
// + bộ lọc `tro-ly-v5r/sp/loc.mjs` (out/troly-loc-v1/{w.loc, meta.json}).
//
// ⚠ KHO CHƯA DUYỆT — CHỈ BẢN TEST, CHƯA ĐƯỢC LÊN MAIN (chủ dự án 2026-10-19).
// Cả 2000 câu Opus soạn đều `duyet: null`. Bản test chỉ mang câu `can_kiem: false`;
// câu `can_kiem: true` (con số, điều luật, số điện thoại) KHÔNG mang câu trả lời —
// chỉ ghi mã, app đọc câu an toàn "hỏi Chi cục Thuỷ sản / SDVICO" (lib/sen-bien/hoi-dap.ts).
// Câu trùng ý đã gộp (trung.json) không có lớp riêng trong mô hình ⇒ không vào kho.
//
// Sinh lại là việc CÓ CHỦ Ý (git giữ vĩnh viễn từng bản): chỉ khi train lại hoặc duyệt kho.
//   node scripts/build-sen-bien-hoi-dap.mjs <thư mục out/troly-ngram-v5b> <thư mục data/forfish-hoidap-v1> <thư mục out/troly-loc-v1>
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [outDir, hdDir, locDir] = process.argv.slice(2);
if (!outDir || !hdDir || !locDir) throw new Error("cần: <thư mục trọng số v5b> <thư mục kho hỏi–đáp> <thư mục bộ lọc>");

const meta = JSON.parse(readFileSync(join(outDir, "meta.json"), "utf8"));
const trung = JSON.parse(readFileSync(join(hdDir, "trung.json"), "utf8"));
const dm = readFileSync(join(hdDir, "danh-muc.jsonl"), "utf8")
  .split("\n")
  .filter((l) => l.trim())
  .map((l) => JSON.parse(l));

// cùng luật napTrung của hoi-dap.mjs: lần theo chuỗi gộp tối đa 5 bước
const giu = (id) => {
  let x = id;
  for (let k = 0; k < 5 && trung[x] && !String(x).startsWith("_"); k++) x = trung[x];
  return x;
};

const byId = new Map(dm.map((r) => [r.id, r]));
const dap = {};
const canKiem = [];
const cauHoi = [];
for (const id of meta.q) {
  const r = byId.get(id);
  if (!r) throw new Error(`mã ${id} trong meta.q không có trong danh-muc`);
  if (giu(id) !== id) throw new Error(`mã ${id} là câu đã gộp nhưng vẫn có lớp trong mô hình`);
  if (r.duyet !== null && r.duyet !== undefined) throw new Error(`câu ${id} đã có dấu duyệt — bản này chỉ dành cho kho CHƯA duyệt`);
  cauHoi.push(String(r.hoi).trim()); // câu hỏi CHUẨN của câu giữ — đúng chữ Gemma thấy lúc train (dung-chon.mjs HOI)
  if (r.can_kiem === true) canKiem.push(id);
  else dap[id] = r.dap;
}
const gop = dm.filter((r) => giu(r.id) !== r.id).length;

const kho = {
  ban: "v5b",
  trangThai: "chua-duyet-chi-ban-test",
  ghiChu:
    "Kho hỏi–đáp Opus soạn 19/10/2026, CHƯA người duyệt — chỉ bản test, chưa được lên main. Câu có số liệu/điều luật không mang câu trả lời.",
  q: meta.q,
  cauHoi,
  dap,
  canKiem,
};
const ra = join(import.meta.dirname, "..", "public", "data");
writeFileSync(join(ra, "sen-bien-hoi-dap.v1.json"), JSON.stringify(kho) + "\n");
copyFileSync(join(outDir, "w.sbn5"), join(ra, "sen-bien-ngram.v5.bin"));

const lm = JSON.parse(readFileSync(join(locDir, "meta.json"), "utf8"));
const lw = readFileSync(join(locDir, "w.loc"));
if (lm.dim !== 65536 || lw.length !== 65536) throw new Error("bộ lọc sai cỡ");
const dau = Buffer.alloc(12);
dau.write("SBL1", 0, "ascii");
dau.writeFloatLE(lm.thang, 4);
dau.writeFloatLE(lm.b, 8);
writeFileSync(join(ra, "sen-bien-loc.v1.bin"), Buffer.concat([dau, lw]));
console.log(
  `kho: ${meta.q.length} lớp · ${Object.keys(dap).length} câu có trả lời · ${canKiem.length} câu cần kiểm (đọc câu an toàn) · ${gop} câu đã gộp (không có lớp)`,
);
