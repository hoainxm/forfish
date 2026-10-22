#!/usr/bin/env node
// Chọn MỘT tiêu chí hỏng cho vòng sửa kế tiếp + viết brief cho thợ (claude -p).
//   node scripts/dan-duong/chon-tieu-chi.mjs <bang-diem.json> <lich-su.jsonl> <brief-ra.md>
// Ưu tiên: bậc A > B > C; trong bậc theo THỨ TỰ ở ops/dan-duong-khoa-hoc.md §3; bỏ tiêu chí đã
// trượt 3 lần liên tiếp gần nhất (để vòng không kẹt một chỗ — lead xem lại). In ra stdout: mã tiêu chí
// (rỗng = không còn gì chọn được).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [bangF, lichSuF, briefF] = process.argv.slice(2);
if (!bangF || !briefF) { console.error("thiếu tham số"); process.exit(2); }
const bang = JSON.parse(readFileSync(bangF, "utf8"));
const lichSu = existsSync(lichSuF ?? "") ? readFileSync(lichSuF, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];

/** thứ tự trong bậc — khớp §3 của doc (độ sâu–triều trước, rồi thời tiết, tàu, waypoint, live, oracle) */
const UU_TIEN = ["B4", "B6", "B5", "C3", "D6", "E1", "F5", "F3", "F4", "F6", "F9", "F10", "D4", "D5", "H5"];
const bac = { A: 0, B: 1, C: 2 };
const truotLienTiep = (id) => {
  let n = 0;
  for (let i = lichSu.length - 1; i >= 0; i--) {
    const r = lichSu[i];
    if (r.tieuChi !== id) continue;
    if (r.ketQua === "truot") n++; else break;
  }
  return n;
};
const hong = bang.tieuChi
  .filter((t) => !t.dat && !t.canNguoi)
  .sort((a, b) => bac[a.bac] - bac[b.bac] || (UU_TIEN.indexOf(a.id) + 1 || 99) - (UU_TIEN.indexOf(b.id) + 1 || 99));
const chon = hong.find((t) => truotLienTiep(t.id) < 3);
if (!chon) { process.stdout.write(""); process.exit(0); }

const here = path.dirname(fileURLToPath(import.meta.url));
const mau = readFileSync(path.join(here, "prompt-sua.md"), "utf8");
const lanTruoc = lichSu.filter((r) => r.tieuChi === chon.id).slice(-3).map((r) => `- ${r.luc}: ${r.ketQua} — ${r.ghi ?? ""}`).join("\n") || "- (chưa thử)";
const brief = mau
  .replaceAll("{{ID}}", chon.id)
  .replaceAll("{{TEN}}", chon.ten)
  .replaceAll("{{BAC}}", chon.bac)
  .replaceAll("{{GHI}}", chon.ghi || "(không)")
  .replaceAll("{{SO}}", JSON.stringify(chon.so))
  .replaceAll("{{TI_LE}}", String(bang.tiLe))
  .replaceAll("{{A_HONG}}", bang.aHong.join(", ") || "không")
  .replaceAll("{{LAN_TRUOC}}", lanTruoc)
  .replaceAll("{{HONG_KHAC}}", hong.filter((t) => t.id !== chon.id).map((t) => `${t.id} ${t.ten}`).join(" · "));
writeFileSync(briefF, brief);
process.stdout.write(chon.id);
