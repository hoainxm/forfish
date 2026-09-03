// Sinh LỚP ĐỘ SÂU KHỐNG CHẾ THEO ĐOẠN LUỒNG bằng cách GHÉP hai bộ dữ liệu mà
// đứng riêng thì cái nào cũng vô dụng — chạy CÓ CHỦ Ý, không phải phản xạ:
//
//   node scripts/link-fairway-depths.mjs
//   node scripts/link-fairway-depths.mjs --vung hai-phong-253 --max 40
//   node scripts/link-fairway-depths.mjs --vung thanh-hoa-256 --out /tmp/thu.json
//
// Đầu ra mặc định: public/data/fairway-depths.v1.json
//
// ── VÌ SAO CÓ FILE NÀY ────────────────────────────────────────────────────
// Đợt trước (`scripts/fetch-soundings.mjs`) bóc được 195 điểm đo sâu ở phía
// Nam nhưng Hải Phòng — vùng chiếm 32% cả kho thông báo (2.649/8.163) — ra
// ĐÚNG 0 ĐIỂM. Không phải lỗi bóc: các cảng vụ phía Bắc không đăng bảng toạ
// độ điểm cạn, họ viết theo ĐOẠN:
//
//     "Đoạn luồng từ cặp phao số 5, 6 đến cặp phao số 17, 18:
//      … độ sâu đạt: 2.3m"
//
// Có độ sâu, có vị trí chính xác — nhưng vị trí neo vào TÊN PHAO, không vào
// toạ độ. Mà toạ độ của chính những cái phao đó thì app ĐÃ CÓ:
// `public/data/vn-aids.v1.json` (437 báo hiệu, 21 tuyến luồng, cột `nm` là tên
// nhà nước đặt, cột `rt` là tuyến luồng). Ghép lại là mở khoá đúng khối lớn
// nhất của kho, và cho ra thứ bà con cần khi vào cửa lạch: độ sâu khống chế
// của TỪNG ĐOẠN luồng, không phải điểm rời.
//
// ── DÙNG LẠI, KHÔNG VIẾT LẠI ──────────────────────────────────────────────
// · Bộ TẢI + bộ BÓC PDF: lấy nguyên xi từ `scripts/fetch-soundings.mjs` bằng
//   cách CẮT đúng hai mục 2–3 của file đó ra một module tạm (xem `loadPdfLib`).
//   Không chép tay: hai bản lệch nhau là chuyện chỉ chờ ngày xảy ra, và bộ bóc
//   đó đã trả giá cho ba cái bẫy (object stream, bfrange mảng, dựng dòng theo
//   toạ độ vẽ).
// · Bộ NHẬN DẠNG KHUÔN + BA CỔNG: `src/lib/fairway-depth.ts`, nạp bằng cách
//   dịch TypeScript tại chỗ (cùng cách `fetch-soundings.mjs` làm với
//   `soundings.ts`). Logic nằm ở lib nên `npm test` canh được.
// · Lý lịch nguồn: schema `Provenance` của `src/lib/provenance.ts` — KHÔNG sửa
//   file đó.
//
// ── BA CỔNG (chi tiết + lý do ở đầu src/lib/fairway-depth.ts) ─────────────
//   1. khớp nhầm phao   → chiều dài đoạn + từ chối khi tên trùng trong tuyến
//   2. số hiệu phao đọc thành độ sâu → dải hợp lý + đối chiếu số hiệu cùng câu
//   3. thông báo cũ đè thông báo mới → cùng đoạn thì giữ bản mới nhất theo ngày
//
// ── TRẦN DUNG LƯỢNG (CLAUDE.md "Dữ liệu bản đồ trong git") ────────────────
// Đầu ra là JSON vài chục KB — một đoạn tốn khoảng 130 byte. Không cần dòng
// `data-budget:`, không cần đổi định dạng lưu. Nhưng vẫn chạy theo `--vung`
// và ghi ĐÈ một đường dẫn cố định: mỗi lần sinh là một khoản nợ vĩnh viễn
// trong lịch sử git.
//
// ── ẢNH HƯỞNG OFFLINE: KHÔNG ──────────────────────────────────────────────
// Script chạy LÚC PHÁT TRIỂN trên máy người viết mã, không chạy trong app của
// bà con. Không thêm request mạng nào lúc mở app, không đụng `public/sw.js`,
// không đụng khoá `forfish.*`, không đè dữ liệu đã tải. File sinh ra là asset
// tĩnh mới, chưa nối vào màn hình nào.
//
// ## Assumptions
// - `source: "tbhh"` (thông báo hàng hải) và `source: "vinamarine"` (bảng báo
//   hiệu) đều CHƯA có trong `SOURCES` của `src/lib/provenance.ts` — file đó
//   không thuộc phạm vi thay đổi này. Vì vậy dataset này KHÔNG được đưa vào
//   `cleanPackage()` cho tới khi có người đăng ký nguồn. `validateProvenance`
//   sẽ báo "nguồn lạ" — đúng như thiết kế, không phải lỗi im lặng.
// - Mặc định chỉ quét 13 vùng biển mà `vn-aids.v1.json` CÓ bảng báo hiệu.
//   Quét vùng không có bảng thì mọi đoạn đều rơi vào `boSot` với lý do
//   "không tra được toạ độ" — tốn mạng mà không thu được gì.

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";

const ROOT = process.cwd();
const CACHE = join(ROOT, "node_modules", ".cache", "sdfish-fairway");
/**
 * KHO CHỮ OCR (ngoài repo) do `scripts/ocr-soundings.mjs` sinh.
 *
 * Đây là chỗ OCR trả nhiều nhất, không phải bên `fetch-soundings.mjs`: các
 * cảng vụ phía Bắc KHÔNG đăng bảng toạ độ điểm cạn, họ viết theo ĐOẠN GIỮA
 * HAI PHAO — đúng khuôn mà file này đọc. Hải Phòng có 183 thông báo là ảnh
 * scan; không mở kho chữ ở đây thì OCR gần như không đổi được gì cho miền Bắc.
 */
const KHO_OCR = join(tmpdir(), "sdfish-ocr-cache");

/** Chữ OCR của một PDF ảnh scan → các trang dòng, hoặc `null` khi kho chưa có. */
function chuOcr(...diaChi) {
  for (const dc of diaChi) {
    if (!dc) continue;
    const f = join(KHO_OCR, createHash("sha1").update(dc).digest("hex") + ".dong.json");
    if (!existsSync(f)) continue;
    try {
      const d = JSON.parse(readFileSync(f, "utf8"));
      const trang = Array.isArray(d?.trang) ? d.trang : null;
      if (trang && trang.some((t) => Array.isArray(t) && t.length)) return trang;
    } catch {
      // kho hỏng một file thì bỏ file đó, không làm hỏng cả đợt
    }
  }
  return null;
}
const FETCHED_AT = new Date().toISOString().slice(0, 10);

const NHAN =
  "Độ sâu khống chế của cả đoạn luồng — chỗ NÔNG NHẤT trong đoạn, đo tại ngày " +
  "ghi kèm; luồng bồi lắng liên tục. Vị trí hai đầu đoạn lấy theo phao báo hiệu, " +
  "không phải đường luồng vẽ đúng. Không thay hải đồ.";

/* ══ 0. THAM SỐ DÒNG LỆNH ═══════════════════════════════════════════════ */

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** 13 vùng biển mà `vn-aids.v1.json` có bảng báo hiệu — xem Assumptions. */
const VUNG_MAC_DINH = [
  "hai-phong-253",
  "quang-ninh-252",
  "thai-binh-254",
  "nam-dinh-255",
  "thanh-hoa-256",
  "nghe-an-257",
  "ha-tinh-258",
  "quang-binh-259",
  "quang-tri-260",
  "thua-thien-hue-261",
  "da-nang-262",
  "quang-nam-263",
  "quang-ngai-264",
].join(",");

const VUNG = arg("vung", VUNG_MAC_DINH).split(",").filter(Boolean);
const MAX_PER_VUNG = Number(arg("max", "40"));
const OUT = arg("out", "public/data/fairway-depths.v1.json");
const AIDS = arg("aids", "public/data/vn-aids.v1.json");

/* ══ 1. NẠP LẠI MÃ ĐÃ CÓ ════════════════════════════════════════════════ */

/**
 * Bộ TẢI + bộ BÓC PDF của `scripts/fetch-soundings.mjs`.
 *
 * File đó là script chạy-ngay (có `await` ở thân file), nên `import` thẳng sẽ
 * khởi động cả đợt cào của nó. Cách duy nhất dùng lại mà KHÔNG chép tay là
 * cắt đúng hai mục 2–3 ra một module tạm. Mốc cắt là hai dòng tiêu đề mục
 * trong chính file gốc; mốc mất thì DỪNG HẲN chứ không âm thầm chạy tiếp với
 * một bộ bóc tự chế.
 */
async function loadPdfLib() {
  const src = readFileSync(join(ROOT, "scripts", "fetch-soundings.mjs"), "utf8");
  const bar = "══";
  const from = src.indexOf(`/* ${bar} 2.`);
  const to = src.indexOf(`/* ${bar} 4.`);
  if (from < 0 || to <= from) {
    throw new Error(
      "CHẶN: không tìm thấy mục 2–3 trong scripts/fetch-soundings.mjs — " +
        "file đó đã đổi cấu trúc. Sửa mốc cắt ở đây, ĐỪNG chép tay bộ bóc PDF.",
    );
  }
  const head =
    'import { inflateSync, inflateRawSync, unzipSync } from "node:zlib";\n' +
    'const HOST = "https://vmsa.vn";\n' +
    "const LIST = `${HOST}/thong-bao-hang-hai-247`;\n" +
    'const UA = "SDFish-build/1.0 (fisherman app; fairway controlling depths)";\n' +
    "const REQ_TIMEOUT_MS = 60000;\n";
  const tail =
    "\nexport { pdfPages, get, parseList, isDepthNotice, sleep, HOST, LIST };\n";
  mkdirSync(CACHE, { recursive: true });
  const file = join(CACHE, "pdf.mjs");
  writeFileSync(file, head + src.slice(from, to) + tail);
  return import(pathToFileURL(file).href);
}

/**
 * Nạp `src/lib/<name>.ts` (và mọi `@/lib/*` nó cần) bằng cách dịch TypeScript
 * tại chỗ — cùng cách `scripts/fetch-soundings.mjs` và `scripts/bench-render.mjs`
 * đã làm. Bộ nhận dạng khuôn và ba cổng phải là MỘT bản duy nhất, dùng chung
 * với app và với test.
 */
async function loadLib(name) {
  const ts = (await import("typescript")).default;
  const dir = join(CACHE, "lib");
  mkdirSync(dir, { recursive: true });
  const done = new Set();
  const conv = (n) => {
    if (done.has(n)) return;
    done.add(n);
    const p = join(ROOT, "src", "lib", `${n}.ts`);
    if (!existsSync(p)) throw new Error(`CHẶN: thiếu src/lib/${n}.ts`);
    const src = readFileSync(p, "utf8");
    for (const m of src.matchAll(/from\s+"@\/lib\/([\w-]+)"/g)) conv(m[1]);
    const js = ts
      .transpileModule(src, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          verbatimModuleSyntax: false,
        },
      })
      .outputText.replace(/from\s+"@\/lib\/([\w-]+)"/g, (_, x) => `from "./${x}.mjs"`);
    writeFileSync(join(dir, `${n}.mjs`), js);
  };
  conv(name);
  return import(pathToFileURL(join(dir, `${name}.mjs`)).href);
}

const net = await loadPdfLib();
const lib = await loadLib("fairway-depth");
const say = (...a) => console.log(...a);

/* ══ 2. BẢNG TRA BÁO HIỆU THEO TUYẾN LUỒNG ══════════════════════════════ */

const aidsRaw = JSON.parse(readFileSync(resolve(ROOT, AIDS), "utf8"));

/**
 * tuyến (đã chuẩn hoá tên) → { route, byName: Map<tên chuẩn hoá, LatLon[]> }.
 *
 * MỘT tên có thể ứng với NHIỀU vị trí ngay trong một tuyến: tuyến Hải Phòng
 * có hai dãy phao số trùng nhau (Nam Triệu và Lạch Huyện). Vì vậy giá trị là
 * MẢNG, và việc chọn cách ghép nào là của cổng 1 trong lib — không chọn ở đây.
 */
const fairways = new Map();
for (const [i, r] of aidsRaw.routes.entries()) {
  fairways.set(lib.normalizeFairwayName(r.ten), {
    idx: i,
    route: { ten: r.ten, noi: r.noi, prov: r.prov },
    byName: new Map(),
  });
}
for (const m of aidsRaw.marks) {
  const r = aidsRaw.routes[m[9]];
  if (!r) continue;
  const fw = fairways.get(lib.normalizeFairwayName(r.ten));
  const nm = aidsRaw.names[m[10]];
  if (!fw || typeof nm !== "string") continue;
  const key = lib.normalizeAidName(nm);
  if (!key) continue;
  if (!fw.byName.has(key)) fw.byName.set(key, []);
  fw.byName.get(key).push({ lat: m[1], lon: m[0] });
}

/** Tên tuyến dài trước — "hòngaicáilân" phải thắng "cáilân" khi dò trong văn xuôi. */
const FAIRWAY_KEYS = [...fairways.keys()].sort((a, b) => b.length - a.length);

/**
 * Thông báo này nói về tuyến luồng nào.
 *
 * Ưu tiên dòng thông báo TỰ KHAI ("Tên luồng: Phà Rừng") — đó là nguồn chắc
 * nhất. Không có thì dò tên tuyến trong toàn văn ("… luồng hàng hải Hòn Gai –
 * Cái Lân …"). Không ra thì trả `null`, KHÔNG đoán theo vùng biển: một vùng
 * biển có nhiều tuyến (Hải Phòng có cả Hải Phòng, Phà Rừng, Sông Chanh) và
 * đoán sai là ghép phao của tuyến khác.
 */
function whichFairway(flat) {
  const named = lib.readFairwayName(flat);
  if (named && fairways.has(named)) return fairways.get(named);
  for (const k of FAIRWAY_KEYS) {
    if (k.length >= 5 && flat.includes(k)) return fairways.get(k);
  }
  return null;
}

/** Mốc đầu đoạn → MỌI cách đọc toạ độ trong tuyến này (nhóm 1 hoặc 2 điểm). */
function candidatesFor(fw, ref) {
  const lists = ref.names.map((n) => fw.byName.get(n) ?? []);
  if (lists.some((l) => !l.length)) return [];
  let groups = [[]];
  for (const list of lists) {
    const next = [];
    for (const g of groups) for (const p of list) next.push([...g, p]);
    groups = next;
  }
  return groups;
}

/* ══ 3. CHẠY ════════════════════════════════════════════════════════════ */

const tuyen = [];
const tuyenIdx = new Map();
const thongBao = [];
const doanThuMot = []; // trước cổng 3
const boSot = [];
const stat = {
  danhMuc: 0,
  doSau: 0,
  pdfScan: 0,
  pdfOcr: 0,
  pdfRac: 0,
  khongRoTuyen: 0,
  khongCoDoan: 0,
  mucDocDuoc: 0,
  mucGhepDuoc: 0,
};
/** Vì sao một mục đọc được nhưng không ghép được — để báo cáo thật. */
const lyDoGhepHong = new Map();
const bumpFail = (why) => lyDoGhepHong.set(why, (lyDoGhepHong.get(why) ?? 0) + 1);

function chiSoTuyen(fw) {
  if (!tuyenIdx.has(fw.idx)) {
    tuyenIdx.set(fw.idx, tuyen.push(fw.route) - 1);
  }
  return tuyenIdx.get(fw.idx);
}

for (const ma of VUNG) {
  const rows = [];
  for (let off = 0; rows.length < MAX_PER_VUNG * 4; off += 20) {
    const url = off === 0 ? `${net.LIST}/${ma}` : `${net.LIST}/${ma}/${off}`;
    let html;
    try {
      html = await net.get(url);
    } catch (e) {
      say(`  ! danh mục ${url}: ${e.message}`);
      break;
    }
    const page = net.parseList(html);
    stat.danhMuc += page.length;
    rows.push(...page);
    if (page.length < 20) break;
    await net.sleep(250);
  }

  const depth = rows.filter((r) => net.isDepthNotice(r.tieuDe) && r.ngay).slice(0, MAX_PER_VUNG);
  stat.doSau += depth.length;
  say(`\n── ${ma}: ${rows.length} thông báo đọc được, ${depth.length} thông báo độ sâu lấy về`);

  for (const r of depth) {
    try {
      const html = await net.get(r.url);
      const href = html.match(/href="(\/baodam\/upload\/files\/TBHH\/[^"]+\.pdf)"/i)?.[1];
      if (!href) throw new Error("trang chi tiết không có link PDF");
      const pdfUrl = `${net.HOST}${href}`;
      await net.sleep(250);

      let lines = net.pdfPages(await net.get(pdfUrl, "buffer")).flat();
      let ocr = false;
      if (lines.length < 5) {
        // Không có lớp chữ. Kho OCR có bản của file này thì dùng; chưa có thì
        // ghi `boSot` như cũ — không bịa, và lý do nói đúng là CHƯA OCR.
        const tuOcr = chuOcr(pdfUrl, r.url);
        if (!tuOcr) {
          stat.pdfScan++;
          boSot.push({ so: r.so, ngay: r.ngay, url: r.url, lyDo: "PDF ảnh scan — không có lớp chữ, chưa OCR" });
          continue;
        }
        lines = tuOcr.flat();
        ocr = true;
        stat.pdfOcr++;
      }

      const flat = lib.flattenNoticeText(lines);
      // PDF có lớp chữ nhưng bảng mã hỏng thì ra rác mà vẫn "nhiều dòng" —
      // không chặn ở đây là im lặng bỏ qua một thông báo thật.
      if (!lib.isReadableNotice(flat)) {
        stat.pdfRac++;
        boSot.push({ so: r.so, ngay: r.ngay, url: r.url, lyDo: "PDF có lớp chữ nhưng bảng mã hỏng — chữ ra rác" });
        continue;
      }

      const segs = lib.findFairwaySegments(flat);
      if (!segs.length) {
        stat.khongCoDoan++;
        boSot.push({ so: r.so, ngay: r.ngay, url: r.url, lyDo: "không có mục theo khuôn 'đoạn từ … đến … độ sâu đạt'" });
        continue;
      }
      stat.mucDocDuoc += segs.length;

      const fw = whichFairway(flat);
      if (!fw) {
        stat.khongRoTuyen++;
        boSot.push({ so: r.so, ngay: r.ngay, url: r.url, lyDo: `${segs.length} đoạn đọc được nhưng không rõ tuyến luồng nào` });
        continue;
      }

      const got = [];
      for (const s of segs) {
        if (!lib.isPlausibleFairwayDepth(s.depthM, s.depthLiteral, [...s.a.numbers, ...s.b.numbers])) {
          bumpFail("độ sâu ngoài dải hợp lý hoặc trùng số hiệu phao cùng câu");
          continue;
        }
        const chosen = lib.chooseFairwaySegment(candidatesFor(fw, s.a), candidatesFor(fw, s.b));
        if (chosen.lyDo) {
          bumpFail(chosen.lyDo.replace(/\d+([.,]\d+)?/g, "N"));
          continue;
        }
        got.push({ s, chosen });
      }
      if (!got.length) {
        boSot.push({ so: r.so, ngay: r.ngay, url: r.url, lyDo: `${segs.length} đoạn đọc được nhưng không đoạn nào tra được toạ độ hai đầu` });
        continue;
      }

      const ti =
        thongBao.push({
          so: r.so,
          ngay: r.ngay,
          tieuDe: r.tieuDe,
          url: r.url,
          pdf: pdfUrl,
          vung: ma,
          prov: { origin: { source: "tbhh", at: FETCHED_AT, version: r.so, url: pdfUrl } },
          ...(ocr ? { ocr: true } : {}),
        }) - 1;
      const ri = chiSoTuyen(fw);

      for (const { s, chosen } of got) {
        /* Kiểm CHIỀU DÀI TRÊN TOẠ ĐỘ ĐÃ LÀM TRÒN — tức trên đúng con số sẽ nằm
           trong file. `chooseFairwaySegment` đã kiểm rồi, nhưng nó kiểm trên
           toạ độ CHƯA làm tròn; đoạn sát mép 0,05 km rơi xuống dưới mép sau khi
           làm tròn về 1e-5 độ (~1,1 m), rồi `decodeFairwayDepths` loại nó và cả
           đợt bị CHẶN mà không ghi được file. Đã dính thật: 398/TBHH-CVHHHT
           "Từ phao 5 và 6 đến phao 5" — hai đầu gần như trùng nhau. */
        const aR = { lat: round5(chosen.a.lat), lon: round5(chosen.a.lon) };
        const bR = { lat: round5(chosen.b.lat), lon: round5(chosen.b.lon) };
        if (!lib.isPlausibleSegmentKm(haversineKm(aR, bR))) {
          stat.boQua = (stat.boQua ?? 0) + 1;
          boSot.push({
            so: r.so,
            ngay: r.ngay,
            url: r.url,
            lyDo: `đoạn "${s.ten}" dài ${(haversineKm(aR, bR) * 1000).toFixed(0)} m sau khi làm tròn toạ độ — hai đầu gần như trùng nhau`,
          });
          continue;
        }
        doanThuMot.push({
          khoa: lib.segmentKey(fw.route.ten, s.a.names, s.b.names),
          ngay: r.ngay,
          sauM: s.depthM,
          row: [
            ri,
            ti,
            Math.round(s.depthM * 10),
            s.a.xapXi || s.b.xapXi ? 1 : 0,
            round5(chosen.a.lon),
            round5(chosen.a.lat),
            round5(chosen.b.lon),
            round5(chosen.b.lat),
            s.ten,
          ],
        });
      }
      stat.mucGhepDuoc += got.length;
      say(`  · ${r.so.padEnd(24)} ${String(got.length).padStart(2)}/${String(segs.length).padStart(2)} đoạn  ${fw.route.ten}  (${r.ngay})`);
    } catch (e) {
      boSot.push({ so: r.so, ngay: r.ngay, url: r.url, lyDo: `tải/đọc lỗi: ${e.message}` });
      say(`  ! ${r.so.padEnd(24)} ${e.message}`);
    }
    await net.sleep(250);
  }
}

function round5(n) {
  return Math.round(n * 1e5) / 1e5; // ~1 m
}

/* ══ 4. CỔNG 3 — CÙNG MỘT ĐOẠN THÌ GIỮ BẢN MỚI NHẤT ════════════════════ */

const giu = lib.keepNewestPerSegment(doanThuMot);
const boVIDaCu = doanThuMot.length - giu.length;

// Thông báo nào không còn đoạn nào sau cổng 3 thì bỏ khỏi bảng, và đánh lại
// chỉ số — file không được mang mục chết.
const dungTb = new Set(giu.map((d) => d.row[1]));
const mapTb = new Map();
const thongBaoGiu = [];
for (const [i, t] of thongBao.entries()) {
  if (!dungTb.has(i)) continue;
  mapTb.set(i, thongBaoGiu.push(t) - 1);
}
const doan = giu.map((d) => [d.row[0], mapTb.get(d.row[1]), ...d.row.slice(2)]);

/* ══ 5. BA CỔNG TỰ KIỂM — không qua thì KHÔNG ghi file ══════════════════ */

// (a) CHỦ QUYỀN: không cho lọt ký tự Hán/CJK vào bất kỳ chuỗi nào
const CJK = /[⺀-⿿　-〿぀-ヿ㐀-䶿一-鿿豈-﫿가-힯]/;
const strings = [
  NHAN,
  ...tuyen.flatMap((t) => [t.ten, t.noi]),
  ...thongBaoGiu.flatMap((t) => [t.so, t.tieuDe, t.url, t.pdf, t.vung]),
  ...doan.map((d) => String(d[8])),
  ...boSot.flatMap((b) => [b.so, b.url, b.lyDo]),
];
const dirty = strings.filter((s) => CJK.test(s));
if (dirty.length) {
  throw new Error(`CHẶN: ${dirty.length} chuỗi còn ký tự Hán/CJK — ${dirty.slice(0, 5).join(" | ")}`);
}

// (b) KHUNG BIỂN VN + DẢI ĐỘ SÂU + CHIỀU DÀI ĐOẠN
//     Chạy qua `decodeFairwayDepths` chứ không tự kiểm lại bằng tay: cổng phải
//     là CÙNG MỘT cổng mà app dùng lúc đọc file, không phải bản sao gần giống.
const decoded = lib.decodeFairwayDepths({ tuyen, thongBao: thongBaoGiu, doan });
if (decoded.length !== doan.length) {
  // Nói RÕ hàng nào hỏng và hỏng vì gì. Câu "1/23 đoạn không qua nổi" không
  // hành động được: phải chạy lại cả đợt 15 phút chỉ để biết đó là hàng nào.
  const con = new Set(decoded.map((d) => `${d.tu.lat},${d.tu.lon},${d.den.lat},${d.den.lon}`));
  const hong = doan.filter((r) => !con.has(`${r[5]},${r[4]},${r[7]},${r[6]}`));
  const taiSao = (r) => {
    const sauM = Number(r[2]) / 10;
    if (!lib.isPlausibleFairwayDepth(sauM, String(sauM))) return `độ sâu ${sauM} m ngoài dải`;
    const d = haversineKm({ lat: r[5], lon: r[4] }, { lat: r[7], lon: r[6] });
    if (!lib.isPlausibleSegmentKm(d)) return `đoạn dài ${d.toFixed(2)} km ngoài dải`;
    return "thiếu tham chiếu tuyến/thông báo";
  };
  for (const r of hong) {
    say(`  ✗ ${thongBaoGiu[r[1]]?.so ?? "?"} | ${r[8]} | ${taiSao(r)}`);
  }
  throw new Error(
    `CHẶN: ${doan.length - decoded.length}/${doan.length} đoạn không qua nổi decodeFairwayDepths — xem dòng ✗ ở trên`,
  );
}

const ngoaiKhung = decoded.filter(
  (d) =>
    !inVN(d.tu.lat, d.tu.lon) ||
    !inVN(d.den.lat, d.den.lon),
);
if (ngoaiKhung.length) {
  throw new Error(`CHẶN: ${ngoaiKhung.length} đoạn có đầu nằm ngoài khung biển VN`);
}
/** Dùng cho câu báo lỗi ở trên — bản thật vẫn là bản trong `route-plan.ts`. */
function haversineKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function inVN(lat, lon) {
  return lat >= 4 && lat <= 24 && lon >= 102 && lon <= 118;
}

// (c) MỌI ĐOẠN PHẢI CÓ NGÀY + LÝ LỊCH — hải đồ cũ là hải đồ nguy hiểm
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const thieu = thongBaoGiu.filter(
  (t) => !ISO.test(t.ngay) || !t.prov?.origin?.source || !ISO.test(t.prov.origin.at),
);
if (thieu.length) {
  throw new Error(`CHẶN: ${thieu.length} thông báo thiếu ngày hoặc lý lịch — ${thieu.slice(0, 3).map((t) => t.so).join(", ")}`);
}
const thieuTuyen = tuyen.filter((t) => !t.prov?.origin?.source || !ISO.test(t.prov.origin.at));
if (thieuTuyen.length) {
  throw new Error(`CHẶN: ${thieuTuyen.length} tuyến luồng thiếu lý lịch nguồn`);
}

/* ══ 6. GHI ═════════════════════════════════════════════════════════════ */

doan.sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[5] - b[5] || a[4] - b[4]);

const out = {
  v: 1,
  nguon:
    "Thông báo hàng hải (vmsa.vn) — Tổng công ty Bảo đảm an toàn hàng hải; " +
    "toạ độ báo hiệu từ bảng tuyến luồng của Cục Hàng hải Việt Nam",
  nhan: NHAN,
  layNgay: FETCHED_AT,
  tuyen,
  thongBao: thongBaoGiu,
  doan,
  boSot,
};

mkdirSync(dirname(resolve(ROOT, OUT)), { recursive: true });
const text = JSON.stringify(out);
writeFileSync(resolve(ROOT, OUT), text);

const ngay = thongBaoGiu.map((t) => t.ngay).sort();
const xapXi = doan.filter((d) => d[3] === 1).length;
say(`\n════ KẾT QUẢ ════`);
say(`danh mục đọc được         ${stat.danhMuc}`);
say(`thông báo độ sâu lấy về   ${stat.doSau}`);
say(`  · PDF ảnh scan CHƯA OCR ${stat.pdfScan}`);
say(`  · ảnh scan ĐỌC BẰNG OCR ${stat.pdfOcr}`);
{
  // Cờ nào không ai đếm là cờ sẽ chết lặng — in ra để còn thấy.
  const nOcr = thongBaoGiu.filter((t) => t.ocr).length;
  const doanOcr = doan.filter((d) => thongBaoGiu[d[1]]?.ocr).length;
  say(`  · đoạn từ thông báo OCR ${doanOcr} (trong ${nOcr} thông báo)`);
}
say(`  · PDF bảng mã hỏng      ${stat.pdfRac}`);
say(`  · không có mục "đoạn"   ${stat.khongCoDoan}`);
say(`  · không rõ tuyến luồng  ${stat.khongRoTuyen}`);
say(`mục "đoạn" đọc được       ${stat.mucDocDuoc}`);
say(`  · ghép được toạ độ      ${stat.mucGhepDuoc}`);
for (const [why, n] of [...lyDoGhepHong.entries()].sort((a, b) => b[1] - a[1])) {
  say(`  · bỏ (${String(n).padStart(3)}): ${why}`);
}
say(`cổng 3 loại bản cũ/trùng  ${boVIDaCu}`);
say(`ĐOẠN GIỮ LẠI              ${doan.length}  (${xapXi} đoạn có đầu neo xấp xỉ)`);
say(`tuyến luồng               ${tuyen.length}`);
say(`cũ nhất / mới nhất        ${ngay[0] ?? "-"} … ${ngay[ngay.length - 1] ?? "-"}`);
say(`bỏ sót                    ${boSot.length}`);
say(`\n${OUT} — ${(text.length / 1024).toFixed(1)} KB (${(text.length / Math.max(1, doan.length)).toFixed(0)} byte/đoạn)`);
