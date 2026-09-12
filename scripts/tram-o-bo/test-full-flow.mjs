// scripts/tram-o-bo/test-full-flow.mjs
//   node scripts/tram-o-bo/test-full-flow.mjs [--llm=mock] [--keep] [--help]
// ─────────────────────────────────────────────────────────────────────────────
// TEST FULL LUỒNG vòng đời "gói não" Sen Biển (ADR 0010) — chạy tuần tự các chặng
// của vòng đêm soạn gói (03-vong-dem-soan-goi.md) + nhận gói ở máy bà con
// (02-quan-tri-va-update.md), MOCK rõ ràng chỗ cần phần cứng/dịch vụ ngoài.
//
// Chặng thật gọi 2 công cụ gốc như CLI (không import để tránh chạy main() của chúng):
//   export-brain-pack.mjs   → sinh manifest.json (sha256/bytes từng file)
//   validate-brain-pack.mjs → cổng kiểm gói theo contract
// Chỗ cần Ollama / VieNeu / phần cứng thì MOCK/SKIP có ghi chú (nêu rõ trạm thật làm gì).
//
// Không phụ thuộc ngoài (chỉ node core) — nguyên tắc 15 §5. Dùng thư mục tạm os.tmpdir
// cho mọi bản sao/gói sinh ra; KHÔNG ghi rác vào cây làm việc (CLAUDE.md §dữ liệu tạm).
// In bảng PASS/FAIL, exit ≠ 0 nếu có FAIL. Ca ÂM: "fail/phát-hiện đúng" = PASS.
// ─────────────────────────────────────────────────────────────────────────────

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { join, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPORT_SCRIPT = join(HERE, "export-brain-pack.mjs");
const VALIDATE_SCRIPT = join(HERE, "validate-brain-pack.mjs");
const FIXTURE = join(HERE, "__fixtures__", "brain-pack-sample");
const UNANSWERED = join(HERE, "__fixtures__", "unanswered-sample.json");
const TODAY = new Date().toISOString().slice(0, 10);

function printHelp() {
  process.stdout.write(
    [
      "Test full luồng gói não Sen Biển — chạy các chặng vòng đêm + nhận gói, mock chỗ cần phần cứng.",
      "",
      "Dùng:",
      "  node scripts/tram-o-bo/test-full-flow.mjs [tuỳ chọn]",
      "",
      "Tuỳ chọn:",
      "  --llm=mock     (mặc định) soạn nháp bằng hàm mock cố định, KHÔNG gọi Ollama.",
      "  --llm=ollama   Chỗ cắm qwen3.5:9b thật ở trạm — chưa nối ở máy này, sẽ cảnh báo rồi chạy mock.",
      "  --keep         Giữ lại thư mục tạm (để soi), mặc định dọn sau khi chạy.",
      "  --help         In trợ giúp này.",
      "",
      "Các chặng: 1 kéo câu · 2 LLM soạn nháp (MOCK) · 3 người duyệt (mock) · 4 giọng VieNeu (SKIP)",
      "           · 5 đóng gói (export) · 6 cổng kiểm (validate) · 7 bump version + đổi 1 file",
      "           · 8 app nhận gói (kiểm hash) · ca ÂM (thiếu nguon / số sống / hỏng 1 byte).",
      "Mã thoát: 0 nếu tất cả PASS; 1 nếu có FAIL.",
    ].join("\n") + "\n"
  );
}

// ── tiện ích ────────────────────────────────────────────────────────────────
function sha256File(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
function runNode(scriptPath, args) {
  const r = spawnSync(process.execPath, [scriptPath, ...args], {
    encoding: "utf8",
  });
  return { status: r.status, stdout: r.stdout || "", stderr: r.stderr || "" };
}
function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
function writeJson(path, obj) {
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n", "utf8");
}
function knowledgePath(dir) {
  return join(dir, "brain", "knowledge.v1.json");
}

// Gom cụm outbox đơn giản theo chủ đề đã gắn (chặng thật dùng foldVn + tương đồng từ khoá).
function gomCum(unanswered) {
  const cum = new Map();
  for (const o of unanswered.outbox || []) {
    const k = o.chuNhat || "khac";
    if (!cum.has(k)) cum.set(k, []);
    cum.get(k).push(o.cauHoi);
  }
  // ưu tiên: tổng đếm hash (bà con hỏi nhiều = soạn trước) — chỉ để minh hoạ xếp thứ tự
  const uuTien = Object.values(unanswered.unansweredHashes || {}).reduce((s, n) => s + n, 0);
  return { cum, uuTien };
}

// MOCK LLM: từ cụm → nháp knowledge cố định (deterministic). Trạm thật gọi Ollama qwen3.5:9b.
// Theo prompt vòng đêm (§4.1): model để "nguon" rỗng khi không chắc → người duyệt tự tra.
function mockLlmSoanNhap(cum) {
  const banMau = {
    "bao-quan": {
      id: "bao-quan-ca-ngu-bo-sung",
      tuKhoa: ["bảo quản", "cá ngừ", "ướp đá", "lạnh đều"],
      traLoi:
        "Cá ướp đá càng sớm thì thịt càng săn và giữ được lâu. Sắp lớp cá xen lớp đá cho lạnh đều khắp hầm. Tránh chất cá quá đầy làm dập thân cá lớp dưới. Che nắng miệng hầm mỗi khi mở ra lấy cá.",
    },
    "giay-to": {
      id: "giay-to-gia-han-som",
      tuKhoa: ["giấy tờ", "gia hạn", "đăng kiểm", "cảng cá"],
      traLoi:
        "Giấy tờ tàu nên lo gia hạn trước khi hết hạn để khỏi lỡ chuyến. Chuẩn bị hồ sơ theo hướng dẫn của cảng cá nơi đăng ký. Giữ một bản chụp trong app phòng khi cần trình nhanh. Hỏi cán bộ cảng nếu chưa rõ thủ tục.",
    },
    "an-toan": {
      id: "an-toan-truoc-ben-bo-sung",
      tuKhoa: ["an toàn", "áo phao", "bộ đàm", "trước bến"],
      traLoi:
        "Kiểm tra áo phao đủ cho số người trên tàu trước khi rời bến. Thử đèn, còi và bộ đàm xem còn hoạt động tốt. Báo người nhà lịch trình và giờ dự kiến quay về. Nghe đài duyên hải để cập nhật thời tiết vùng đi.",
    },
  };
  const naps = [];
  for (const [chuDe, cauHoi] of cum) {
    const mau = banMau[chuDe];
    if (!mau) continue;
    naps.push({
      ...mau,
      cauHoiMau: cauHoi.slice(0, 4),
      nguon: "", // model KHÔNG bịa nguồn — để trống, người duyệt tra
      ngaySoat: "",
      canNguoiTra: true,
    });
  }
  return naps;
}

// MOCK người duyệt: điền nguon + ngaySoat thật, bỏ cờ nháp. Trạm thật: người bấm Duyệt ở /quan-tri.
function mockNguoiDuyet(naps) {
  return naps.map((n) => ({
    id: n.id,
    cauHoiMau: n.cauHoiMau,
    tuKhoa: n.tuKhoa,
    traLoi: n.traLoi,
    nguon: "Người duyệt SDVICO soát và bổ sung nguồn — vòng đêm " + TODAY,
    ngaySoat: TODAY,
  }));
}

// ── khung chấm ───────────────────────────────────────────────────────────────
const rows = [];
function check(stage, name, ok, detail) {
  rows.push({ stage, name, ok: !!ok, detail: detail || "" });
  const mark = ok ? "✓" : "✗";
  process.stdout.write("  [" + mark + "] " + name + (detail ? " — " + detail : "") + "\n");
}
function stageHead(n, title) {
  process.stdout.write("\n── Chặng " + n + " — " + title + "\n");
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const keep = argv.includes("--keep");
  const llmArg = (argv.find((a) => a.startsWith("--llm=")) || "--llm=mock").split("=")[1];
  if (llmArg !== "mock") {
    process.stdout.write(
      "⚠️  --llm=" + llmArg + ": máy này KHÔNG có Ollama/qwen3.5:9b (trạm ở bờ mới có). Chạy MOCK thay thế.\n"
    );
  }

  process.stdout.write("== TEST FULL LUỒNG — gói não Sen Biển ==\n");
  process.stdout.write("Fixture : " + FIXTURE + "\n");

  const work = mkdtempSync(join(tmpdir(), "senbien-fullflow-"));
  process.stdout.write("Tmp     : " + work + "\n");

  let manifestV1 = null; // chụp manifest sau chặng 5 để so ở chặng 7
  const packDir = join(work, "pack"); // thư mục nội dung đã duyệt (bản sao fixture + nháp gộp)

  try {
    // ── Chặng 1 — Kéo câu (mock đọc file, gom cụm) ────────────────────────────
    stageHead(1, "Kéo câu chưa trả lời + hộp chờ sóng (mock đọc Supabase)");
    let cumInfo;
    {
      const unanswered = readJson(UNANSWERED);
      cumInfo = gomCum(unanswered);
      const soCum = cumInfo.cum.size;
      check(1, "Đọc unanswered-sample.json + gom cụm", soCum >= 1,
        soCum + " cụm (ưu tiên theo tổng đếm hash = " + cumInfo.uuTien + ")");
    }

    // ── Chặng 2 — LLM soạn nháp (MOCK) ───────────────────────────────────────
    stageHead(2, "qwen3.5:9b soạn nháp (MOCK LLM — trạm thật gọi Ollama qwen3.5:9b)");
    let naps;
    {
      naps = mockLlmSoanNhap(cumInfo.cum);
      const nguonTrong = naps.every((n) => n.nguon === "" && n.canNguoiTra === true);
      check(2, "Sinh nháp knowledge từ cụm (deterministic)", naps.length >= 1,
        naps.length + " nháp");
      check(2, "Nháp để nguon TRỐNG + canNguoiTra (không bịa nguồn)", nguonTrong,
        "đúng luật prompt §4.1 (03-vong-dem)");
    }

    // ── Chặng 3 — Người duyệt (mock) + gộp vào bản sao fixture ────────────────
    stageHead(3, "Người duyệt (mock) → gộp mục đã duyệt vào bản sao gói");
    {
      cpSync(FIXTURE, packDir, { recursive: true });
      const daDuyet = mockNguoiDuyet(naps);
      const coNguonNgay = daDuyet.every((m) => m.nguon.trim() && m.ngaySoat.trim());
      check(3, "Người duyệt điền nguon + ngaySoat cho mọi nháp", coNguonNgay,
        daDuyet.length + " mục approved");
      const know = readJson(knowledgePath(packDir));
      know.muc = know.muc.concat(daDuyet);
      writeJson(knowledgePath(packDir), know);
      check(3, "Gộp mục đã duyệt vào knowledge.v1.json (bản sao tmp)", true,
        "kho: " + know.muc.length + " mục");
    }

    // ── Chặng 4 — Giọng VieNeu (SKIP có ghi chú) ─────────────────────────────
    stageHead(4, "Sinh giọng VieNeu");
    check(4, "SKIP — không sinh mp3 ở đây", true,
      "trạm thật chạy gen_pack.py; mp3 gắn theo đường dẫn contract (audio/<bac|nam>/<intentId>.mp3)");

    // ── Chặng 5 — Đóng gói (export thật) ─────────────────────────────────────
    stageHead(5, "Đóng gói (export-brain-pack.mjs → manifest.json)");
    {
      const r = runNode(EXPORT_SCRIPT, [packDir, "--version", "2", "--min-app-version", "1.8.0",
        "--notes", "Gói sau vòng đêm — gộp 3 mục kho đã duyệt."]);
      check(5, "export-brain-pack.mjs chạy được", r.status === 0, "exit " + r.status);
      manifestV1 = readJson(join(packDir, "manifest.json"));
      const okShape = manifestV1.version === "2" &&
        Array.isArray(manifestV1.files) && manifestV1.files.length > 0 &&
        manifestV1.files.every((f) => f.path && typeof f.sha256 === "string" && f.sha256.length === 64 && typeof f.bytes === "number");
      check(5, "manifest có version/sha256(64hex)/bytes/files", okShape,
        "version=" + manifestV1.version + ", " + manifestV1.files.length + " file");
    }

    // ── Chặng 6 — Cổng kiểm (validate thật) ──────────────────────────────────
    stageHead(6, "Cổng kiểm (validate-brain-pack.mjs)");
    {
      const r = runNode(VALIDATE_SCRIPT, [packDir]);
      check(6, "validate-brain-pack.mjs PASS (0 lỗi chặn)", r.status === 0,
        "exit " + r.status);
    }

    // ── Chặng 7 — Bump version + đổi 1 file ──────────────────────────────────
    stageHead(7, "Bump version + đổi 1 mục knowledge → re-export → so sha256 từng file");
    {
      const know = readJson(knowledgePath(packDir));
      know.muc[0].traLoi =
        "Ướp đá ngay khi cá vừa lên, đừng để cá phơi nắng trên boong tàu. " +
        "Giữ hầm thật kín gió để hơi lạnh không thoát ra ngoài. " +
        "Cá lớn nên moi ruột và làm sạch trước khi cho vào hầm. " +
        "Mỗi ngày kiểm tra rồi bù thêm đá cho cá luôn đủ lạnh.";
      writeJson(knowledgePath(packDir), know);
      const r = runNode(EXPORT_SCRIPT, [packDir, "--version", "3", "--min-app-version", "1.8.0"]);
      check(7, "re-export version mới chạy được", r.status === 0, "exit " + r.status);
      const manifestV2 = readJson(join(packDir, "manifest.json"));
      const rv = runNode(VALIDATE_SCRIPT, [packDir]);
      check(7, "validate PASS sau khi đổi nội dung", rv.status === 0, "exit " + rv.status);
      check(7, "manifest.version đổi (2 → 3)", manifestV1.version === "2" && manifestV2.version === "3",
        manifestV1.version + " → " + manifestV2.version);
      // so sha256 từng path: CHỈ file đã sửa đổi sha, còn lại giữ nguyên
      const sha1 = new Map(manifestV1.files.map((f) => [f.path, f.sha256]));
      const doiPaths = manifestV2.files.filter((f) => sha1.get(f.path) !== f.sha256).map((f) => f.path);
      const giuPaths = manifestV2.files.filter((f) => sha1.get(f.path) === f.sha256).map((f) => f.path);
      const chiKnowledgeDoi = doiPaths.length === 1 && doiPaths[0] === "brain/knowledge.v1.json";
      check(7, "CHỈ file đã sửa đổi sha256", chiKnowledgeDoi, "đổi: [" + doiPaths.join(", ") + "]");
      const modelsGiu = ["models/vad.onnx", "models/stt-vi.wasm", "models/stt-vi.data",
        "models/tts-vi.wasm", "models/tts-vi.data"].every((p) => giuPaths.includes(p));
      check(7, "models/* + các file khác GIỮ nguyên sha256", modelsGiu,
        giuPaths.length + " file giữ nguyên (app bỏ qua, không tải lại)");
    }

    // ── Chặng 8 — App nhận gói (mock kiểm hash trước khi đổi khối) ────────────
    stageHead(8, "App nhận gói: tự tính sha256 từng file, so manifest (đổi khối chỉ khi khớp hết)");
    {
      const manifest = readJson(join(packDir, "manifest.json"));
      const lech = manifest.files.filter((f) => sha256File(join(packDir, f.path.split("/").join(sep))) !== f.sha256);
      check(8, "Mọi file khớp sha256 manifest → cho ĐỔI KHỐI", lech.length === 0,
        manifest.files.length + "/" + manifest.files.length + " khớp");

      // tráo hỏng 1 byte 1 file trên bản sao → phải phát hiện lệch
      const recv = join(work, "recv-corrupt");
      cpSync(packDir, recv, { recursive: true });
      const target = join(recv, "brain", "knowledge.v1.json");
      const buf = Buffer.from(readFileSync(target));
      buf[0] = buf[0] ^ 0xff; // lật 1 byte
      writeFileSync(target, buf);
      const manifest2 = readJson(join(recv, "manifest.json"));
      const lech2 = manifest2.files.filter((f) => sha256File(join(recv, f.path.split("/").join(sep))) !== f.sha256);
      check(8, "Hỏng 1 byte → phát hiện lệch → GIỮ gói cũ", lech2.length === 1,
        "phát hiện " + lech2.length + " file lệch (" + (lech2[0] ? lech2[0].path : "-") + ")");
    }

    // ── Ca ÂM — validate/hash PHẢI bắt lỗi (bắt đúng = PASS) ──────────────────
    stageHead("ÂM", "Ca âm — cổng kiểm PHẢI chặn / phát hiện đúng");
    {
      // (a) thiếu nguon → re-export cho manifest khớp → validate FAIL vì luật nội dung
      const a = join(work, "am-thieu-nguon");
      cpSync(packDir, a, { recursive: true });
      {
        const know = readJson(knowledgePath(a));
        delete know.muc[0].nguon;
        writeJson(knowledgePath(a), know);
        runNode(EXPORT_SCRIPT, [a, "--version", "9"]); // manifest khớp file (cô lập lỗi về đúng luật nguồn)
        const r = runNode(VALIDATE_SCRIPT, [a]);
        const batDung = r.status !== 0 && /thiếu nguon/.test(r.stdout);
        check("ÂM", "(a) thiếu nguon → validate FAIL", batDung, "exit " + r.status);
      }

      // (b) số sống trong traLoi → validate cảnh báo (WARN) — theo thiết kế validator KHÔNG hard-fail
      const b = join(work, "am-so-song");
      cpSync(packDir, b, { recursive: true });
      {
        const know = readJson(knowledgePath(b));
        know.muc[0].traLoi = "Giá cá ngừ hôm nay khoảng 90.000 đồng một ký và gió ngoài khơi giật 40 km/h.";
        writeJson(knowledgePath(b), know);
        runNode(EXPORT_SCRIPT, [b, "--version", "9"]);
        const r = runNode(VALIDATE_SCRIPT, [b]);
        const phatHien = /SỐ SỐNG/.test(r.stdout);
        check("ÂM", "(b) số sống → validate CẢNH BÁO (WARN, không hard-fail)", phatHien,
          "phát hiện WARN 'SỐ SỐNG' (contract cấm; validator để người soát — 03-vong-dem §4.2)");
      }

      // (c) hỏng 1 byte SAU khi có manifest (không re-export) → validate FAIL sha256
      const c = join(work, "am-hong-byte");
      cpSync(packDir, c, { recursive: true });
      {
        const target = join(c, "brain", "answers.v1.json");
        const buf = Buffer.from(readFileSync(target));
        buf[buf.length - 2] = buf[buf.length - 2] ^ 0xff;
        writeFileSync(target, buf);
        const r = runNode(VALIDATE_SCRIPT, [c]);
        const batDung = r.status !== 0 && /Sai sha256/.test(r.stdout);
        check("ÂM", "(c) hỏng 1 byte sau manifest → validate FAIL sha256", batDung, "exit " + r.status);
      }
    }
  } catch (e) {
    check("!", "Lỗi không mong đợi khi chạy orchestrator", false, e && e.message);
  } finally {
    if (keep) process.stdout.write("\n(--keep: giữ tmp " + work + ")\n");
    else rmSync(work, { recursive: true, force: true });
  }

  // ── tổng kết ─────────────────────────────────────────────────────────────
  const fails = rows.filter((r) => !r.ok);
  process.stdout.write("\n================= TỔNG KẾT =================\n");
  for (const r of rows) {
    process.stdout.write(
      (r.ok ? "  ✓ " : "  ✗ ") + "[" + String(r.stage).padStart(2, " ") + "] " + r.name + "\n"
    );
  }
  process.stdout.write("--------------------------------------------\n");
  process.stdout.write("  " + rows.length + " kiểm · " + (rows.length - fails.length) + " PASS · " + fails.length + " FAIL\n");
  if (fails.length === 0) {
    process.stdout.write("  KẾT LUẬN: TOÀN BỘ PASS — luồng gói não thông suốt (mock LLM/giọng).\n");
    process.exit(0);
  } else {
    process.stdout.write("  KẾT LUẬN: CÓ FAIL — xem dấu ✗ ở trên.\n");
    process.exit(1);
  }
}

main();
