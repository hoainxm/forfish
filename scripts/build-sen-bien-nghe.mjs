// Gói bộ NGHE offline của Sen Biển thành MỘT file public/data/sen-bien-nghe.v<N>.bin
// (CLAUDE.md "một lớp = một file"; đổi mô hình ⇒ tăng số bản vì SW giữ /data cache-first).
// v2 (2026-10-22, chủ dự án "thay bản zipformer đi", ADR 0015): zipformer 70.000 giờ của zzasdf (Apache-2.0)
// TINH CHỈNH vòng 2 trên gpu-desktop (~/.local/forlife/train/sen-bien-nghe/models/ft-ft2-e3) — được sửa, train tiếp.
//   node scripts/build-sen-bien-nghe.mjs <thư mục> <số bản> <tên mô hình> <nguồn/giấy phép>
// v1 (cũ, đã thay): zipformer-vi-30M-int8-2026-02-09 của
// k2-fsa/sherpa-onnx (Apache-2.0, train từ hynt/Zipformer-30M-RNNT-6000h ~6.000 giờ
// tiếng Việt). Chọn bản 30M thay bản 70.000 giờ (74 MB) vì đo 2026-10-16 trên 70 câu
// lệnh bản đồ × 4 kiểu thu nó ĐÚNG VIỆC hơn (66/70 vs 60/70) mà nhẹ hơn một nửa.
//
// Sinh lại là việc CÓ CHỦ Ý (git giữ vĩnh viễn từng bản 33 MB): chỉ khi đổi mô hình.
//   node scripts/build-sen-bien-nghe.mjs <thư mục mô hình đã giải nén>
// bpe.vocab (cần cho hotwords) xuất từ bpe.model bằng sentencepiece:
//   python -c "import sentencepiece as s; m=s.SentencePieceProcessor(model_file='bpe.model'); \
//     open('bpe.vocab','w').write(''.join(f'{m.id_to_piece(i)}\t{m.get_score(i)}\n' for i in range(m.get_piece_size())))"
//
// Định dạng: "SBN1" · u32 LE độ dài JSON · JSON {files:[{name,len}]} · các file nối liền.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [dir, ban = "1", model = "zipformer-vi-30M-int8-2026-02-09", nguon = ""] = process.argv.slice(2);
if (!dir) throw new Error("cần thư mục mô hình");
const FILES = [
  ["encoder.onnx", "encoder.int8.onnx"],
  ["decoder.onnx", "decoder.onnx"],
  ["joiner.onnx", "joiner.int8.onnx"],
  ["tokens.txt", "tokens.txt"],
  ["bpe.vocab", "bpe.vocab"],
];
const bufs = FILES.map(([, f]) => readFileSync(join(dir, f)));
// ghi công + giấy phép đi cùng file (Apache-2.0 §4: giữ ghi nguồn khi phân phối lại)
const head = Buffer.from(JSON.stringify({ model, ...(nguon ? { nguon } : {}), files: FILES.map(([name], i) => ({ name, len: bufs[i].length })) }));
const len = Buffer.alloc(4);
len.writeUInt32LE(head.length);
const out = Buffer.concat([Buffer.from("SBN1"), len, head, ...bufs]);
writeFileSync(join(import.meta.dirname, "..", "public", "data", `sen-bien-nghe.v${ban}.bin`), out);
console.log(`sen-bien-nghe.v${ban}.bin ${(out.length / 1e6).toFixed(1)} MB`);
