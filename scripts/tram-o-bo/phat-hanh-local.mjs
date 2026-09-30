// scripts/tram-o-bo/phat-hanh-local.mjs
//   node scripts/tram-o-bo/phat-hanh-local.mjs [--giong <thư-mục-mp3>] [--dry-run]
// ─────────────────────────────────────────────────────────────────────────────
// PHÁT HÀNH GÓI NÃO "Sen Biển" RA public/tro-ly/ (chủ dự án 2026-09-30: gói đi
// theo bản deploy — "local thôi", không Supabase Storage).
//
// Nguồn (đều trong repo, trừ mp3):
//   · scripts/tram-o-bo/kho/kho-nhap.json — kho kiến thức. CHỈ mục có
//     `duyet: { nguoi, ngay }` mới vào gói; `ngay` thành `ngaySoat`. Nháp AI
//     soạn mà chưa ai duyệt KHÔNG BAO GIỜ tới máy bà con.
//   · scripts/tro-ly-giong/catalog.json — câu cố định có giọng Sen Biển.
//   · mp3 giọng (ngoài repo, gen_pack.py sinh): --giong, mặc định ~/sdfish-tram/giong-out.
//     Thiếu thư mục mp3 → GIỮ mp3 đang có trong public/tro-ly/audio (không xoá oan).
//
// Ra: public/tro-ly/{manifest.json, brain/knowledge.v1.json, brain/answers.v1.json, audio/<giọng>/<id>.mp3}
//   → manifest.version tự tăng khi nội dung đổi (so sha256), giữ nguyên khi y hệt.
//   → chạy validate-brain-pack.mjs làm cổng; lỗi chặn = không ghi gì.
//
// Luật git (CLAUDE.md "chống phình"): ĐÈ file cũ, không đẻ -v2; mp3 không trong
// catalog bị xoá khỏi public/tro-ly/audio.
// ─────────────────────────────────────────────────────────────────────────────

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, sep } from "node:path";
import { buildManifest } from "./export-brain-pack.mjs";
import { validatePack } from "./validate-brain-pack.mjs";

const ROOT = process.cwd();
const KHO = join(ROOT, "scripts", "tram-o-bo", "kho", "kho-nhap.json");
const CATALOG = join(ROOT, "scripts", "tro-ly-giong", "catalog.json");
const OUT = join(ROOT, "public", "tro-ly");
/** Phiên bản BỘ ĐỌC tối thiểu — khớp BRAIN_READER_VERSION (src/lib/assistant/brain-pack.ts). */
const MIN_APP = "1.0.0";
const VOICES = ["bac", "nam"];

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const readJson = (p) => JSON.parse(readFileSync(p, "utf8"));
const writeJson = (p, v) => {
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, JSON.stringify(v, null, 2) + "\n", "utf8");
};

/** Mục đã duyệt → shape contract (bỏ trường nháp). */
export function approvedKnowledge(kho) {
  const out = [];
  for (const m of kho.muc ?? []) {
    const d = m.duyet;
    if (!d || typeof d.nguoi !== "string" || !d.nguoi.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(d.ngay ?? "")) continue;
    out.push({
      id: m.id,
      cauHoiMau: m.cauHoiMau,
      tuKhoa: m.tuKhoa,
      traLoi: m.traLoi,
      nguon: m.nguon,
      ngaySoat: d.ngay,
      ...(m.chipMoMan ? { chipMoMan: m.chipMoMan } : {}),
    });
  }
  return out;
}

function main() {
  const dry = process.argv.includes("--dry-run");
  const giong = arg("--giong", join(homedir(), "sdfish-tram", "giong-out"));
  const kho = readJson(KHO);
  const catalog = readJson(CATALOG);

  // dựng gói vào thư mục tạm → kiểm → mới chép đè public/tro-ly
  const stage = mkdtempSync(join(tmpdir(), "senbien-phat-hanh-"));
  try {
    const knowledge = approvedKnowledge(kho);
    writeJson(join(stage, "brain", "knowledge.v1.json"), { version: "1", muc: knowledge });

    const answers = [];
    let mp3Count = 0;
    const haveGiong = existsSync(giong);
    for (const it of catalog.items) {
      const mp3 = {};
      for (const v of VOICES) {
        const rel = `audio/${v}/${it.id}.mp3`;
        const src = haveGiong ? join(giong, v, `${it.id}.mp3`) : join(OUT, ...rel.split("/"));
        if (existsSync(src)) {
          mkdirSync(join(stage, "audio", v), { recursive: true });
          copyFileSync(src, join(stage, ...rel.split("/")));
          mp3[v] = rel;
          mp3Count++;
        }
      }
      answers.push({ id: it.id, intentId: it.intent, text: it.text, ...(Object.keys(mp3).length ? { mp3 } : {}) });
    }
    writeJson(join(stage, "brain", "answers.v1.json"), {
      version: "1",
      answers,
      cauAnToan: {
        khongHieu: "Việc này tôi chưa có trong máy. Bác hỏi tôi thời tiết, bão, giấy tờ, giá cá, hay mở màn.",
        daiDuyenHai: "Bác nghe thêm đài duyên hải.",
      },
    });

    // phiên bản: giữ nếu nội dung y hệt bản đang phát, không thì +1
    const prev = existsSync(join(OUT, "manifest.json")) ? readJson(join(OUT, "manifest.json")) : null;
    const probe = buildManifest(stage, { version: "0", minAppVersion: MIN_APP }).manifest;
    const sig = (m) => JSON.stringify(m.files.map((f) => [f.path, f.sha256]));
    const same = prev && sig(prev) === sig(probe) && prev.minAppVersion === MIN_APP;
    const version = same ? prev.version : String((Number.parseInt(prev?.version ?? "0", 10) || 0) + 1);
    const notes = `${knowledge.length} mục kho đã duyệt · ${answers.length} câu cố định · ${mp3Count} mp3`;
    const { manifest, totalBytes } = buildManifest(stage, { version, minAppVersion: MIN_APP, notes });
    if (same) manifest.createdAt = prev.createdAt;
    writeJson(join(stage, "manifest.json"), manifest);

    const res = validatePack(stage, { budgetMb: 70 });
    for (const w of res.warns) process.stdout.write(`  ⚠️  ${w}\n`);
    if (res.fails.length) {
      for (const f of res.fails) process.stdout.write(`  ✖  ${f}\n`);
      process.stdout.write("→ Gói có lỗi chặn, KHÔNG phát hành.\n");
      process.exit(1);
    }

    const nhap = (kho.muc ?? []).length - knowledge.length;
    process.stdout.write(
      `Gói v${version}${same ? " (không đổi)" : ""}: ${notes} · ${(totalBytes / 1048576).toFixed(2)} MB\n` +
        `Kho nháp chưa duyệt (KHÔNG vào gói): ${nhap} mục\n` +
        (haveGiong ? "" : `(không thấy ${giong} — giữ mp3 đang có)\n`),
    );
    if (dry) return process.stdout.write("(--dry-run: không ghi public/tro-ly)\n");
    if (same) return;

    // chép đè: xoá cây cũ rồi đặt cây mới (mp3 thôi dùng không còn nằm lại)
    rmSync(OUT, { recursive: true, force: true });
    mkdirSync(OUT, { recursive: true });
    for (const f of manifest.files) {
      const dst = join(OUT, ...f.path.split("/"));
      mkdirSync(join(dst, ".."), { recursive: true });
      copyFileSync(join(stage, ...f.path.split("/")), dst);
    }
    writeJson(join(OUT, "manifest.json"), manifest);
    process.stdout.write(`Đã ghi ${OUT.replace(ROOT + sep, "")} (${readdirSync(OUT).length} mục gốc).\n`);
  } finally {
    rmSync(stage, { recursive: true, force: true });
  }
}

main();
