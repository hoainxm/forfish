// VECTOR VÀNG CHO "ĐANG CHẠY" (đợt 2f: dẫn đường lúc chạy + giọng đọc) — chạy CHÍNH code web qua jiti:
//   use-nav-tracking (locFix/nhanFix/fixQuaCu) · nav-progress · nav-camera · nav-khuc-re · nav-vung · nav-phien ·
//   nav-hazards · nav-context · nav-voice/{phrases,announcer,events,nav-storm,sea-now,opening,prefs,cau-dan-duong,
//   ten-bao} · voice/ghep.mjs + voice/tts.ts speechParts (danh mục mảnh nạp thật).
//   node native/scripts/sinh-dang-chay.mjs
//     ⇒ native/shared/src/commonMain/kotlin/vn/sdvico/forfish/shared/dangchay/GiongSinh.kt (danh mục giọng)
//     ⇒ native/shared/src/jvmTest/resources/dang-chay/*.json ⇒ DangChayVangTest.kt
// Kịch bản tự dựng bằng mulberry32 (hạt cố định) + ca lấy từ src/lib/__tests__/nav-*.test.ts, giờ GHIM (không Date.now).
// Giờ máy GHIM về Asia/Ho_Chi_Minh: web tính mùa cấm / giờ phiên theo giờ máy, Kotlin theo UTC+7.
process.env.TZ = "Asia/Ho_Chi_Minh";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "../../node_modules/jiti/lib/jiti.mjs";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
const kho = new Map();
globalThis.localStorage = {
  getItem: (k) => (kho.has(k) ? kho.get(k) : null),
  setItem: (k, v) => void kho.set(k, String(v)),
  removeItem: (k) => void kho.delete(k),
  clear: () => kho.clear(),
  key: (i) => [...kho.keys()][i] ?? null,
  get length() {
    return kho.size;
  },
};
globalThis.window ??= globalThis;
const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") } });
const im = (p) => jiti.import(join(repo, p));
const trk = await im("src/lib/use-nav-tracking.ts");
const np = await im("src/lib/nav-progress.ts");
const cam = await im("src/lib/nav-camera.ts");
const kr = await im("src/lib/nav-khuc-re.ts");
const nv = await im("src/lib/nav-vung.ts");
const ph = await im("src/lib/nav-phien.ts");
const hz = await im("src/lib/nav-hazards.ts");
const ctxm = await im("src/lib/nav-context.ts");
const si = await im("src/lib/spatial-index.ts");
const rp = await im("src/lib/route-plan.ts");
const fr = await im("src/lib/nav-voice/phrases.ts");
const an = await im("src/lib/nav-voice/announcer.ts");
const ev = await im("src/lib/nav-voice/events.ts");
const ns = await im("src/lib/nav-voice/nav-storm.ts");
const sn = await im("src/lib/nav-voice/sea-now.ts");
const op = await im("src/lib/nav-voice/opening.ts");
const pf = await im("src/lib/nav-voice/prefs.ts");
const cd = await im("src/lib/nav-voice/cau-dan-duong.ts");
const tb = await im("src/lib/nav-voice/ten-bao.ts");
const gh = await im("src/lib/voice/ghep.mjs");
const tts = await im("src/lib/voice/tts.ts");
const { VOICE_TEST_TEXT } = await im("src/lib/nav-voice/use-nav-voice.ts");
await tts.napManhGiong();

const raDir = join(repo, "native/shared/src/jvmTest/resources/dang-chay");
mkdirSync(raDir, { recursive: true });
// số thực ĐẦU RA giữ 12 chữ số có nghĩa (test so sai lệch tương đối 1e-10); đầu vào đều ≤ 9 chữ số (r6) nên không đổi.
const ghi = (ten, v) =>
  writeFileSync(join(raDir, ten), JSON.stringify(v, (_, x) => (typeof x === "number" && !Number.isInteger(x) ? Number(x.toPrecision(12)) : x)));

/* ── mulberry32 — DangChayVangTest không dựng lại; vector giữ cả đầu vào ── */
function taoRnd(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = taoRnd(2026_11_04);
const r6 = (x) => Math.round(x * 1e6) / 1e6;

/* ════════ 0. DANH MỤC GIỌNG → GiongSinh.kt ════════ */
{
  const cau = JSON.parse(readFileSync(join(repo, "src/data/giong-sen-bien.json"), "utf8"));
  const manh = JSON.parse(readFileSync(join(repo, "src/data/giong-sen-bien-manh.json"), "utf8"));
  const sach = (s) => {
    if (/[\t\n\r\\"$]/.test(s)) throw new Error(`ký tự lạ trong danh mục: ${s}`);
    return s;
  };
  const dongCau = cau.items.map((it) => `${sach(it.id)}\t${sach(it.text)}`);
  const dongManh = [];
  for (const ds of Object.values(manh.nhom)) for (const [id, text] of ds) dongManh.push(`${sach(id)}\t${sach(text)}`);
  // hằng chuỗi JVM ≤ 65 535 byte UTF-8 ⇒ cắt khúc ~ 6 000 ký tự (tiếng Việt ≤ 3 byte/ký tự)
  const khuc = (dong) => {
    const ra = [];
    let cur = "";
    for (const d of dong) {
      if (cur.length + d.length + 1 > 6000) {
        ra.push(cur);
        cur = "";
      }
      cur += (cur ? "\n" : "") + d;
    }
    if (cur) ra.push(cur);
    return ra;
  };
  const kc = khuc(dongCau);
  const km = khuc(dongManh);
  const kt = (ten, ds) => ds.map((s, i) => `    private const val ${ten}_${i} = "${s.replace(/\n/g, "\\n").replace(/\t/g, "\\t")}"`).join("\n");
  const kt2 = `// SINH TỰ ĐỘNG bởi native/scripts/sinh-dang-chay.mjs từ src/data/giong-sen-bien.json + giong-sen-bien-manh.json — ĐỪNG SỬA TAY.
package vn.sdvico.forfish.shared.dangchay

/** Danh mục giọng Sen Biển (${cau.voice ?? "Mỹ Duyên"}): câu nguyên ${dongCau.length} · mảnh ${dongManh.length} (thứ tự nhóm giữ y web: mảnh trùng khoá thì mục ĐẦU thắng). */
internal object GiongSinh {
    const val CAU_DIR = "${cau.dir}"
    const val MANH_DIR = "${manh.dir}"
${kt("CAU", kc)}
${kt("MANH", km)}
    private fun tach(vararg khuc: String): List<Pair<String, String>> =
        khuc.flatMap { k -> k.split('\\n').map { d -> d.indexOf('\\t').let { i -> d.substring(0, i) to d.substring(i + 1) } } }

    private val cauDs by lazy { tach(${kc.map((_, i) => `CAU_${i}`).join(", ")}) }
    private val manhDs by lazy { tach(${km.map((_, i) => `MANH_${i}`).join(", ")}) }

    /** (id, chữ) — câu nguyên */
    fun cau(): List<Pair<String, String>> = cauDs

    /** (id, chữ) — mảnh, theo thứ tự nhóm của danh mục */
    fun manh(): List<Pair<String, String>> = manhDs
}
`;
  writeFileSync(join(repo, "native/shared/src/commonMain/kotlin/vn/sdvico/forfish/shared/dangchay/GiongSinh.kt"), kt2);
}

/* ════════ hình học thử: lưới km quanh gốc ════════ */
const LAT0 = 10;
const LON0 = 108;
const KM_PER_DEG = (Math.PI / 180) * 6371;
const at = (n, e) => ({
  lat: r6(LAT0 + n / KM_PER_DEG),
  lon: r6(LON0 + e / (KM_PER_DEG * Math.cos((LAT0 * Math.PI) / 180))),
});

/* ════════ 1. CÂU NÓI ════════ */
const toSpeechCases = [
  "Xác tàu phía trước chừng 600 m — nước trên vật 4,5 m (vị trí gần đúng).",
  "Phía trước chừng 1,2 hải lý nước chừng 2–4 m.",
  "Định vị lệch ±80 m. Chỉ tham khảo.",
  "Giàn khoan cách chừng 2 km — không vào trong 500 m.",
  "Gió 35 km/giờ, mũi 45°, ~ 3 hl",
  "Tàu  chạy  ,  nhanh , , rồi , .",
  "Đèn biển Kê Gà hướng Tây Nam, cách chừng 8 hải lý.",
  "mét m mờ 5m 5 m 5mm 5 km/h 2-4",
  "  (ghi chú) đầu câu  ",
];
const nums = [0, 0.04, 0.099, 0.1, 0.149, 0.15, 0.25, 0.5, 0.55, 0.95, 1.05, 1.25, 1.949, 1.95, 2, 2.05, 2.5, 2.75, 3.7, 9.94, 9.96, 10, 12.4, 18.52, 18.53, 37, 100.5, -1, 1e-7];
for (let i = 0; i < 12; i++) nums.push(r6(rnd() * 60));
const T0 = Date.UTC(2026, 10, 4, 0, 3, 0); // 07:03 giờ VN
const cauNoi = {
  so: nums.map((n) => ({
    n,
    num0: fr.numVN(n, 0),
    num1: fr.numVN(n, 1),
    num2: fr.numVN(n, 2),
    distNm: fr.distSpeech(n, "nm"),
    distKm: fr.distSpeech(n, "km"),
    wave: fr.waveSpeech(n),
    speedNm: fr.speedSpeech(n, "nm"),
    speedKm: fr.speedSpeech(n, "km"),
    gio: rp.formatHoursVN(n),
    fmtDist: hz.fmtDistDefault(n),
  })),
  gio: Array.from({ length: 30 }, (_, i) => {
    const ms = T0 + Math.floor(rnd() * 86_400_000 * 2);
    return { ms, clock: fr.clockSpeech(ms) };
  }).concat(
    [0, 2 * 60_000, 3 * 60_000, 57 * 60_000, 58 * 60_000, 17 * 3600_000 + 58 * 60_000, 23 * 3600_000 + 58 * 60_000].map((d) => {
      const ms = Date.UTC(2026, 10, 3, 17, 0, 0) + d; // 00:00 VN + d
      return { ms, clock: fr.clockSpeech(ms) };
    }),
  ),
  tuoi: [null, T0 - 30 * 60_000, T0 - 119 * 60_000, T0 - 2 * 3600_000, T0 - 5 * 3600_000, T0 - 47.4 * 3600_000, T0 - 48 * 3600_000, T0 - 100 * 3600_000].map((a) => ({
    at: a,
    now: T0,
    age: fr.ageSpeech(a, T0),
  })),
  noi: toSpeechCases.map((s) => ({ s, noi: fr.toSpeechVN(s), sach: fr.speechIsClean(s), tu: fr.wordCount(s) })),
  sach: ["Đi an toàn nhé", "Bẻ lái ngay", "GIẢM GA", "South China Sea", "Không có đá ngầm phía trước", "Không có gì phía trước", "Còn chừng 2 hải lý"].map((s) => ({ s, sach: fr.speechIsClean(s) })),
  bao: ["WUTIP", "yagi", "Co-May", "co may", "Son-Tinh", "SONTINH", "Unknown", "Ba-vi", ""].map((n) => ({ n, noi: tb.tenBaoNoi(n) })),
  soTen: tb.TEN_BAO_NOI.size,
  batDau: [
    [12.3, 1.5, 45, "nm"],
    [1.2, 0.2, null, "km"],
    [55, 7.98, 200.5, "km"],
  ].map(([d, h, hd, u]) => ({ d, h, hd, u, cau: cd.cauBatDau(d, h, hd, u) })),
  hang: { tatMan: cd.CAU_TAT_MAN, tuDung: cd.CAU_TU_DUNG, duHaiDo: cd.CAU_DU_HAI_DO, thu: VOICE_TEST_TEXT },
};

/* ════════ 2. ĐỊNH VỊ ════════ */
const dinhVi = (() => {
  const fixes = [];
  let t = T0;
  let p = at(0, 0);
  let hd = 30;
  for (let i = 0; i < 110; i++) {
    const dt = i % 37 === 5 ? 0 : 500 + Math.floor(rnd() * 4000);
    t += dt;
    const sp = i < 10 ? 0 : i < 60 ? 3 + rnd() * 2 : i < 100 ? 0.2 * rnd() : 4 + rnd();
    hd = (hd + (rnd() - 0.5) * 20 + 360) % 360;
    const dKm = (sp * 3.6 * dt) / 3600_000;
    p = { lat: p.lat + (dKm * Math.cos((hd * Math.PI) / 180)) / KM_PER_DEG, lon: p.lon + (dKm * Math.sin((hd * Math.PI) / 180)) / (KM_PER_DEG * Math.cos((p.lat * Math.PI) / 180)) };
    const nhay = i % 41 === 20 || i === 90 || i === 91 || i === 92 || i === 93;
    const pos = nhay ? { lat: r6(p.lat + 0.02), lon: r6(p.lon - 0.015) } : { lat: r6(p.lat + (rnd() - 0.5) * 0.00008), lon: r6(p.lon + (rnd() - 0.5) * 0.00008) };
    const may = rnd();
    fixes.push({
      pos,
      t,
      speedMps: may < 0.4 ? r6(sp) : may < 0.45 ? -1 : null,
      headingDeg: may < 0.5 ? r6(hd + (rnd() < 0.1 ? 720 : 0)) : rnd() < 0.05 ? -45 : null,
      accuracyM: i % 29 === 3 ? 1500 : i % 13 === 0 ? null : r6(5 + rnd() * 60),
    });
  }
  let st = null;
  let boLien = 0;
  let prevNhan = null;
  let muot = null;
  const ra = [];
  for (const f of fixes) {
    const n = trk.nhanFix(prevNhan, f, boLien);
    boLien = n.boLien;
    if (n.nhan) prevNhan = f;
    const r = trk.locFix(st, f);
    st = { pos: r.pos, t: r.t, smoothKmh: r.smoothKmh, headingDeg: r.headingDeg };
    muot = np.tocDoMuot(muot, r.speedKmh, f.t);
    // [nhận, bỏ liền, tốc độ mượt, tốc độ chạy, hướng, tốc độ ETA, fix cũ]
    ra.push([n.nhan, n.boLien, r.smoothKmh, r.speedKmh, r.headingDeg, muot ? muot.kmh : null, trk.fixQuaCu(f.t - 9000, r.speedKmh, f.t + 2000)]);
  }
  const camera = [null, NaN, 0, 45, 90, 135, 180, 225, 270, 315, 359.9, 12.5, -30, 720].map((h) => ({
    h: h == null ? null : Number.isNaN(h) ? "NaN" : h,
    w: 390,
    hh: 844,
    ra: cam.lechCamera(h, 390, 844),
  }));
  const muotLe = [
    [null, 5, 1000],
    [{ kmh: 5, t: 1000 }, 0.5, 2000],
    [{ kmh: 5, t: 1000 }, 7, 1000],
    [{ kmh: 5, t: 1000 }, 7, 182_000],
    [{ kmh: 5, t: 1000 }, 7, 31_000],
    [{ kmh: 5, t: 1000 }, null, 31_000],
  ].map(([p0, m, t]) => ({ p: p0, m, t, ra: np.tocDoMuot(p0, m, t) }));
  const cho = [[null, 0], [1000, 8999], [1000, 9000]].map(([c, n]) => ({ c, n, ra: trk.nenNhanDiemCho(c, n) }));
  return { fixes: fixes.map((f) => [f.pos.lat, f.pos.lon, f.t, f.speedMps, f.headingDeg, f.accuracyM]), ra, camera, muotLe, cho, mps: [null, NaN, -1, 0, 2.5].map((m) => ({ m: Number.isNaN(m) ? "NaN" : m, ra: np.mpsToKmh(m) })) };
})();

/* ════════ 3. TIẾN ĐỘ + KHÚC RẼ ════════ */
const route = [at(0, 0), at(3, 1), at(6, 1.2), at(8, 4), at(8.2, 9), at(5, 12), at(4.9, 12.05), at(2, 15), at(-1, 15.2)];
const tienDo = (() => {
  const steps = [];
  let seg = undefined;
  let offPrev = null;
  let nho = null;
  const tuyenKm = np.routeLengthKm(route);
  for (let i = 0; i <= 90; i++) {
    const s = (i / 90) * tuyenKm * 1.05;
    // chạy dọc tuyến + lệch dần ra rồi về
    let cum = 0;
    let p = route[route.length - 1];
    for (let k = 0; k < route.length - 1; k++) {
      const L = rp.haversineKm(route[k], route[k + 1]);
      if (cum + L >= s) {
        const tt = (s - cum) / L;
        p = { lat: route[k].lat + (route[k + 1].lat - route[k].lat) * tt, lon: route[k].lon + (route[k + 1].lon - route[k].lon) * tt };
        break;
      }
      cum += L;
    }
    const lech = i > 25 && i < 45 ? (i - 25) * 0.55 : i >= 64 && i < 67 ? 25 : 0;
    const pos = { lat: r6(p.lat + lech / KM_PER_DEG), lon: r6(p.lon + (rnd() - 0.5) * 0.0004) };
    const hd = i % 9 === 0 ? null : r6(rnd() * 360);
    const sp = i % 11 === 0 ? null : i % 7 === 0 ? 0.5 : r6(5 + rnd() * 15);
    const pr = np.computeNavProgress({ pos, headingDeg: hd, speedKmh: sp, waypoints: route, segHint: seg });
    seg = pr.segIdx;
    const crossed = np.offRouteStepCrossed(pr.offRouteKm, offPrev);
    offPrev = crossed ?? np.offRouteStepFor(pr.offRouteKm);
    const k = kr.khucReKeTiep(route, pr.alongKm, new Set([6]));
    const b = kr.baoKhucRe(nho, k, sp, (km) => fr.distSpeech(km, "nm"));
    nho = b.nho;
    const st = (g) => (g ? [g.side, g.label, g.turnDeg] : null);
    steps.push([
      pos.lat, pos.lon, hd, sp,
      [pr.remainingKm, pr.etaHours, route.indexOf(pr.nextWp), pr.bearingToNextDeg, pr.dirVN, st(pr.steer), pr.offRouteKm, pr.offRoute, pr.arrived, pr.vachBen, pr.huongVeVachDeg, pr.alongKm, pr.segIdx],
      crossed,
      k ? [k.idx, k.km, k.huongSau, k.huongVN, k.gocDeg] : null,
      b.bao ? [b.bao.key, b.bao.step, b.bao.text] : null,
      b.nho ? [b.nho.idx, b.nho.step] : null,
    ]);
  }
  const steer = [[null, 10], [10, 15], [10, 25], [350, 20], [20, 350], [0, 180], [90, 271.3], [33, 46]].map(([h, b]) => ({ h, b, ra: np.steerCue(h, b) }));
  const proj = [
    [at(1, 5), [], 0],
    [at(1, 5), [at(0, 0)], 0],
    [at(1, 5), [at(0, 0), at(0, 0)], 0],
    [at(4.95, 12.5), route, 5],
    [at(4.95, 12.5), route, 0],
  ].map(([p, w, h]) => ({ p, w, h, ra: np.projectOntoRoute(p, w, h) }));
  const ngan = [
    [at(0.1, 0.1), [], 5, 30],
    [at(0.1, 0.1), [at(0.2, 0.2)], null, 0],
  ].map(([p, w, sp, hd]) => ({ p, w, sp, hd, ra: np.computeNavProgress({ pos: p, headingDeg: hd, speedKmh: sp, waypoints: w }) }));
  const nguong = [[5, 1, null], [5, 1, 0], [5, 1, 6], [5, 1, 30], [1, 0.2, NaN]].map(([ph, san, v]) => ({
    ph, san, v: Number.isNaN(v) ? "NaN" : v, ra: kr.nguongKm(ph, san, v),
  }));
  return { route, steps, steer, proj, ngan, nguong };
})();

/* ════════ 4. VÙNG ════════ */
const vongVuong = (c, r) => {
  const a = at(c[0] - r, c[1] - r), b = at(c[0] + r, c[1] + r);
  return [[a.lon, a.lat], [b.lon, a.lat], [b.lon, b.lat], [a.lon, b.lat], [a.lon, a.lat]];
};
const bboxOf = (ring) => {
  const lats = ring.map((c) => c[1]), lons = ring.map((c) => c[0]);
  return { latMin: Math.min(...lats), latMax: Math.max(...lats), lonMin: Math.min(...lons), lonMax: Math.max(...lons) };
};
const noGo = [
  { id: "ng1", ten: "vùng cấm vào Hòn Mê", ring: vongVuong([2, 2], 0.6) },
  { id: "ng2", ten: null, ring: vongVuong([2, 3.5], 0.5) },
].map((z) => ({ ...z, bbox: bboxOf(z.ring) }));
const restricted = [
  { id: "r1", ten: "khu bảo tồn biển Cù Lao Chàm", loai: "bao-ton", ring: vongVuong([2, 6], 1) },
  { id: "r2", ten: "vùng cấm khai thác theo mùa (bãi Ấn)", loai: "cam-thoi-han", ring: vongVuong([2, 9], 1), mua: [{ tuThang: 11, tuNgay: 1, denThang: 2, denNgay: 28 }] },
  { id: "r3", ten: "Ánh sáng", loai: "cam-thoi-han", ring: vongVuong([2, 9.5], 1), mua: [{ tuThang: 4, tuNgay: 1, denThang: 6, denNgay: 30 }] },
  { id: "r4", ten: "ăn rỗng mùa", loai: "cam-thoi-han", ring: vongVuong([2, 6.3], 1), mua: [] },
  { id: "r5", ten: "an khánh", loai: "bao-ton", ring: vongVuong([2, 6.2], 1) },
].map((z) => ({ ...z, bbox: bboxOf(z.ring) }));
const vung = (() => {
  const ctx = { noGo, restricted };
  let st = nv.initVungTheoDoi();
  const steps = [];
  for (let i = 0; i < 56; i++) {
    const e = i * 0.25 + (i % 5 === 2 ? 1.5 : 0); // nhảy mép
    const pos = at(2 + (rnd() - 0.5) * 0.3, e);
    const nowMs = i < 28 ? Date.UTC(2026, 10, 4, 3) : Date.UTC(2026, 4, 10, 3);
    const tho = nv.vungDangTrong(ctx, pos, nowMs);
    const r = nv.theoDoiVung(st, tho);
    const cung = r.st === st;
    st = r.st;
    steps.push([pos.lat, pos.lon, nowMs, tho.map((v) => v.id), st.trong.map((v) => [v.id, v.ten, v.muc]), st.dem, Object.keys(st.cho), st.lan, cung, r.su.map((x) => [x.loai, x.id, x.ten, x.muc, x.lan, nv.cauVung(x)])]);
  }
  const ngay = [Date.UTC(2026, 9, 31, 16, 59), Date.UTC(2026, 9, 31, 17, 0), Date.UTC(2026, 1, 28, 16, 59), Date.UTC(2026, 1, 28, 17, 0)].map((ms) => ({
    ms, p: at(2, 9), ra: nv.vungDangTrong(ctx, at(2, 9), ms).map((v) => v.id),
  }));
  return { noGo, restricted, steps, ngay, rong: nv.vungDangTrong(null, at(2, 2), 0).length };
})();

/* ════════ 5. PHIÊN ════════ */
const phien = (() => {
  const now = Date.UTC(2026, 10, 4, 1, 5);
  const tuyen = { plan: { waypoints: [at(0, 0), at(1, 1)], km: 5 }, stops: [at(1, 1)], stopWpIdx: [1], legBoundsKm: [5], khac: "giữ" };
  const ok = ph.taoPhien(tuyen, "  Hòn Mê ", now - 3600_000);
  const ca = [
    ok,
    { ...ok, capNhat: now - ph.NAV_PHIEN_HAN_MS - 1 },
    { ...ok, capNhat: now - ph.NAV_PHIEN_HAN_MS },
    { ...ok, capNhat: now + 5 * 60_000 + 1 },
    { ...ok, capNhat: now + 5 * 60_000 },
    { ...ok, v: 2 },
    { ...ok, v: "1" },
    { ...ok, tenDich: "   " },
    { ...ok, tenDich: 5 },
    { ...ok, batDau: "x" },
    { ...ok, route: { ...tuyen, plan: { waypoints: [at(0, 0)] } } },
    { ...ok, route: { ...tuyen, plan: { waypoints: [at(0, 0), { lat: 91, lon: 0 }] } } },
    { ...ok, route: { ...tuyen, stops: [] } },
    { ...ok, route: { ...tuyen, stopWpIdx: [1, "2"] } },
    { ...ok, route: { ...tuyen, legBoundsKm: null } },
    null,
    [],
    "chuỗi",
  ];
  return {
    now,
    ca: ca.map((raw) => {
      const r = ph.docPhien(raw, now);
      return { raw, ra: r ? { tenDich: r.tenDich, batDau: r.batDau, capNhat: r.capNhat } : null };
    }),
    tao: ok,
    gio: [now, now + 9 * 3600_000 + 55 * 60_000, Date.UTC(2026, 10, 4, 16, 59, 59)].map((ms) => ({ ms, ra: ph.gioPhut(ms) })),
  };
})();

/* ════════ 6. HIỂM HOẠ ════════ */
const wreck = (id, n, e, extra = {}) => ({ id, ...at(n, e), rKm: 0.5, loai: "xac-tau", ten: null, doSauM: null, tinVua: false, ...extra });
const hazards = [
  wreck("w1", 4, 0.2),
  wreck("w2", 4.4, 0.5, { ten: "Hải Hà", doSauM: 12.5 }),
  wreck("w3", 4.6, -0.3, { tinVua: true, rKm: 1 }),
  wreck("g1", 9, 0.4, { loai: "gian-khoan", rKm: 1, ten: "Bạch Hổ" }),
  wreck("p1", 12, -1.5, { loai: "phao-nguy-hiem", rKm: 0.3 }),
  wreck("l1", 15, 0, { loai: "long-be", rKm: 0.2, doSauM: 1.25 }),
  wreck("v1", 18, 0.05, { loai: "vat-chim" }),
  wreck("x1", 18.3, 0.1, { loai: "khac" }),
];
const noGoHz = [{ id: "ng:a", ten: "vùng cấm vào quân sự", ring: vongVuong([22, 0], 0.4) }, { id: "ng:b", ten: null, ring: vongVuong([24, 2.5], 0.3) }].map((z) => ({ ...z, bbox: bboxOf(z.ring) }));
const NONG = at(27, 0);
const BO = 30.5; // km bắc: đất liền
function depthAt(lat, lon) {
  if (lat >= LAT0 + BO / KM_PER_DEG) return 0;
  const d = rp.haversineKm(NONG, { lat, lon });
  if (d < 0.35) return 1;
  if (d < 0.8) return 2;
  if (d < 1.3) return 3;
  if (d < 2.6) return 4;
  return lat < LAT0 + 26 / KM_PER_DEG ? null : 5;
}
const nameAt = (lat, lon, kind) => (kind === "ran" ? "Hòn Đá Bạc" : lat > LAT0 + 31 / KM_PER_DEG ? "đảo Lý Sơn" : null);
const hiemHoa = (() => {
  const ix = si.buildIndex(hazards, (h) => ({ lat: h.lat, lon: h.lon }));
  const out = [];
  for (const ca of [
    { ten: "chinh", needM: null, borderEvery: 0, accMode: 0, n: 250 },
    { ten: "mon", needM: 3, borderEvery: 7, accMode: 1, n: 80 },
  ]) {
    let st = hz.initNavHazardState();
    let t = T0;
    let n = 0;
    const steps = [];
    for (let i = 0; i < ca.n; i++) {
      t += 10_000;
      const lost = i >= 150 && i < 156;
      const dung = i >= 200 && i < 240;
      if (!dung) n += 0.14;
      const pos = { lat: at(n, 0).lat, lon: r6(LON0 + Math.round((rnd() - 0.5) * 300) / 1e6) };
      const acc = ca.accMode && i % 17 === 4 ? 220 : ca.accMode && i % 23 === 9 ? 700 : Math.round(5 + rnd() * 20);
      const inp = {
        pos,
        headingDeg: i % 31 === 0 ? null : Math.round((rnd() - 0.5) * 100) / 10,
        speedKmh: dung ? (i % 2 ? 0.2 : null) : i % 19 === 0 ? 4 : Math.round(120 + rnd() * 60) / 10,
        accuracyM: acc,
        nowMs: t,
        draftM: null,
        needM: ca.needM,
        status: lost ? "lost" : i === 157 ? "idle" : "tracking",
        ix,
        noGo: noGoHz,
        depthAt,
        nearestCableKm: i >= 60 && i < 64 ? 0.3 : i % 50 === 7 ? 0.45 : null,
        insideRestricted: i >= 80 && i < 82 ? "vùng cấm neo Vũng Tàu" : i === 170 ? "khu bảo tồn biển Hòn Cau" : null,
        borderNm: ca.borderEvery && i % ca.borderEvery === 0 ? 5 : null,
        nameAt,
      };
      const r = hz.evaluateNavHazards(st, inp);
      st = r.state;
      const v = (x) => (x === -Infinity ? null : x);
      steps.push([
        // đầu vào: lat, lon, hướng, tốc độ, sai số, giờ, trạng thái GPS, cáp, vùng cấm neo, ranh giới
        [inp.pos.lat, inp.pos.lon, inp.headingDeg, inp.speedKmh, inp.accuracyM, inp.nowMs, inp.status, inp.nearestCableKm, inp.insideRestricted, inp.borderNm],
        r.alerts.map((a) => [a.id, a.bac, a.muc, a.cau, a.chuong, a.rung, a.distKm, a.etaMin]),
        [v(st.lastChimeMs), v(st.lastRungMs), st.slowSinceMs, v(st.cableSaidMs), v(st.restrictedSaidMs), v(st.lastAlertMs), st.lastAlerts.length, st.said.size],
      ]);
    }
    out.push({ ten: ca.ten, needM: ca.needM, steps });
  }
  return {
    hazards,
    noGo: noGoHz,
    nong: NONG,
    boKm: BO,
    ca: out,
    nguong: [[null, null], [0, 0], [12, 30], [30, 150], [NaN, -5]].map(([v, a]) => ({ v: Number.isNaN(v) ? "NaN" : v, a, ra: hz.navThresholdsKm(v, a) })),
    query: [0, 2, 2.3, 5, NaN].map((x) => ({ x: Number.isNaN(x) ? "NaN" : x, ra: hz.navQueryKm(x) })),
    rel: [[null, 10], [0, 45], [0, 46], [0, 135], [0, 136], [0, 315], [350, 10], [NaN, 3]].map(([h, b]) => ({ h: Number.isNaN(h) ? "NaN" : h, b, ra: hz.relDir(h, b) })),
  };
})();

/* ════════ 7. KHO DẪN ĐƯỜNG (nav-context) ════════ */
const nguCanh = (() => {
  const seamarks = [
    { ...at(1, 1), type: "buoy_lateral", colour: "red" },
    { ...at(1.0005, 1.0005), type: "buoy_lateral", colour: "green" }, // trùng bản nhà nước ⇒ bỏ
    { ...at(1.5, 0.2), type: "buoy_cardinal", colour: "black;yellow" },
    { ...at(0.4, -0.6), type: "beacon_lateral", light: { colour: "green" } },
    { ...at(0.3, 0.3), type: "buoy_isolated_danger", colour: "black;red;black" },
    { ...at(-1.2, 0.1), type: "buoy_special_purpose", colour: "yellow" },
    { ...at(-0.5, 1.5), type: "light_minor" },
    { ...at(-1.8, -1.0), type: "beacon_safe_water", colour: "red;white" },
    { ...at(2.5, 2.5), type: "buoy_lateral", colour: "red;green;red" },
  ];
  const vnAids = [
    { ...at(1, 1), type: "buoy_lateral", colour: "red", ten: "Phao số 7", tacDung: "Báo hiệu giới hạn bên phải luồng", tuyen: null },
    { ...at(3.5, -0.5), type: "buoy_cardinal", ten: "  ", tacDung: "Báo hiệu phương vị phía Tây", tuyen: null },
    { ...at(-3, 3), type: "buoy_lateral", ten: "Phao 2", tacDung: "Báo hiệu chuyển hướng sang trái", tuyen: null },
  ];
  const denBien = [
    { ...at(20, 10), type: "light_major", ten: "Kê Gà", light: { range: 22 } },
    { ...at(-30, -10), type: "light_major", ten: "Hòn Khoai", light: { range: 10 } },
    { ...at(5, -5), type: "light_major", ten: "", light: { range: 8 } },
    { ...at(2, 2), type: "light_major", ten: "Không tầm" },
  ];
  const khuTruBao = [
    { ...at(10, 20), ten: "Lạch Hới", tinh: "QUẢNG NINH", coTauM: 24, tin: "tot" },
    { ...at(-50, 40), ten: "Đảo Nam Du", tinh: "KIÊN GIANG-PHÚ QUỐC", coTauM: null, tin: "vua" },
    { ...at(100, -20), ten: "Sông Dinh", tinh: "", coTauM: 15, tin: "tot" },
    { ...at(500, 0), ten: "Xa lắc", tinh: "HÀ TĨNH", coTauM: null, tin: "tot" },
  ];
  const line = (pts) => ({ type: "LineString", coordinates: pts.map((p) => [p.lon, p.lat]) });
  const laneFeatures = [
    { type: "Feature", properties: { kind: "cap", loai: "quang", ten: "APG" }, geometry: line([at(-2, -2), at(-2, 2), at(0, 4)]) },
    { type: "Feature", properties: { kind: "ong", ten: "" }, geometry: { type: "LineString", coordinates: [[at(5, 5).lon, at(5, 5).lat], ["x", 1], [at(5, 6).lon, at(5, 6).lat], [at(6, 6).lon, at(6, 6).lat]] } },
    { type: "Feature", properties: { kind: "vungcam", loai: "cam-neo", ten: " Vũng Tàu " }, geometry: { type: "Polygon", coordinates: [vongVuong([-2, 0], 0.5)] } },
    { type: "Feature", properties: { kind: "vungcam", loai: "han-che" }, geometry: { type: "Polygon", coordinates: [vongVuong([3, 3], 0.4)] } },
    { type: "Feature", properties: { kind: "vungcam", loai: "cam-vao" }, geometry: { type: "Polygon", coordinates: [vongVuong([6, 0], 0.4)] } },
    { type: "Feature", properties: { kind: "giankhoan", ten: "GK" }, geometry: { type: "Point", coordinates: [at(9, 9).lon, at(9, 9).lat] } },
  ];
  const vungQuanLy = [
    { ma: "BT1", loai: "bao-ton", ten: "Cù Lao Chàm", trangThai: "da_thanh_lap", polys: [[vongVuong([0, -3], 0.6)]], mua: [] },
    { ma: "BT2", loai: "bao-ton", ten: "Khu bảo tồn Hòn Mun", trangThai: "thanh_lap_moi", polys: [[vongVuong([0, -4], 0.6)]], mua: [] },
    { ma: "CT1", loai: "cam-thoi-han", ten: "Vùng biển Long Châu - Hạ Mai", trangThai: null, polys: [[vongVuong([-4, 0], 0.6)], [vongVuong([-4, 2], 0.3)]], mua: [{ tuThang: 4, tuNgay: 1, denThang: 6, denNgay: 30 }] },
    { ma: "CT2", loai: "cam-thoi-han", ten: "Không mùa", trangThai: null, polys: [[vongVuong([-6, 0], 0.6)]], mua: [] },
  ];
  const ctx = ctxm.buildNavContext({ xacTau: null, laneFeatures, seamarks, vnAids, denBien, khuTruBao, vungQuanLy }, null, 2026);
  const fmt = (km) => fr.distSpeech(km, "nm");
  const diem = [];
  for (let i = 0; i < 30; i++) {
    const pos = i < 5 ? [at(1, 1.2), at(-2, 0.1), at(-4, 0), at(-4, 2), at(0, -3)][i] : at((rnd() - 0.5) * 12, (rnd() - 0.5) * 12);
    const hd = i % 4 === 0 ? null : r6(rnd() * 360);
    const sp = i % 3 === 0 ? null : r6(rnd() * 20);
    const t = i % 2 ? Date.UTC(2026, 4, 1, 5) : Date.UTC(2026, 10, 1, 5);
    const tin = (x) => (x ? [x.id, x.cau] : null);
    diem.push([
      pos.lat, pos.lon, hd, sp, t,
      tin(ctxm.phaoKeTiep(ctx, pos, hd, fmt)),
      tin(ctxm.denBienTin(ctx, pos, fmt)),
      ctxm.khuTruBaoGan(ctx, pos, sp, fmt).map((k) => [k.id, k.ten, k.tinh, k.km, k.khoang, k.gio, k.tauDaiM, k.ganDung]),
      ctxm.restrictedAt(ctx, pos, t),
      ctxm.cableKmAt(ctx, pos),
    ]);
  }
  const A = (id, muc) => ({ id, bac: 1, muc, cau: `câu ${id}`, chuong: false, rung: false, distKm: 1, etaMin: null });
  const hud = [
    [[], false, null],
    [[], false, "tin phao"],
    [[A("a", "vang")], false, "tin"],
    [[A("a", "do")], false, "tin"],
    [[A("a", "vang")], true, "tin"],
    [[A("a", "do"), A("b", "do"), A("c", "vang")], false, "tin"],
    [[A("a", "tin")], false, ""],
  ].map(([a, b, i]) => ({ a, b, i, ra: ctxm.pickHudLines(a, b, i) }));
  return {
    seamarks, vnAids, denBien, khuTruBao, laneFeatures, vungQuanLy,
    missing: ctx.missing,
    counts: ctx.counts,
    restricted: ctx.restricted.map((z) => ({ id: z.id, ten: z.ten, loai: z.loai, n: z.ring.length, mua: z.mua ?? null })),
    diem,
    hud,
    tinh: ["QUẢNG NINH", "bà rịa-vũng tàu", "  kiên giang", "ĐÀ NẴNG"].map((s) => ({ s, ra: (ctxm.khuTruBaoGan({ khu: si.buildIndex([{ lat: 0, lon: 0, ten: "x", tinh: s, coTauM: null, tin: "tot" }], (k) => k) }, { lat: 0, lon: 0 }, null, fmt)[0] ?? {}).tinh })),
  };
})();

/* ════════ 8. BÃO · SÓNG GIÓ · BẢN TIN ════════ */
const storm = (id, name, kind, n, e, track = [], areas = []) => ({ id, name, kindLabel: kind, windKmh: 100, ...at(n, e), alert: "danger", updated: "", track, areas });
const tr = (pts) => pts.map(([n, e]) => [at(n, e).lon, at(n, e).lat]);
const bao = (() => {
  const storms = [
    storm("s1", "WUTIP", "Bão", 300, 300, tr([[500, 500], [400, 400], [300, 300], [250, 200], [150, 100], [100, 0]])),
    storm("s2", "YAGI", "", 900, -100, tr([[900, -100], [900.01, -100]])),
    storm("s3", "", "Áp thấp nhiệt đới", -150, -80, [], [[vongVuong([-150, -80], 120)]]),
    storm("s4", "NOTANAME", "Siêu bão", 1200, 1200, tr([[1200, 1200]])),
  ];
  const now = T0;
  const sts = [
    { kind: "dang-hoi" },
    { kind: "khong-hoi-duoc", checkedAt: null },
    { kind: "khong-hoi-duoc", checkedAt: now - 5 * 3600_000 },
    { kind: "khong-co", checkedAt: now - 40 * 60_000 },
    { kind: "co-bao", storms: [storms[0], storms[1]], checkedAt: now - 3 * 3600_000, cu: false },
    { kind: "co-bao", storms: [storms[2]], checkedAt: null, cu: true },
    { kind: "co-bao", storms: [storms[3]], checkedAt: now - 30 * 60_000, cu: false },
  ];
  const vt = [null, at(0, 0), at(100, 20), at(-50, -80), at(1000, 1000)];
  const quan = [];
  for (const s of sts)
    for (const p of vt)
      for (const khu of [null, { ten: "Lạch Hới", km: 42.5 }]) {
        if (khu && s.kind !== "co-bao") continue;
        const o = ns.stormObservation(s, p, now, "nm", khu);
        quan.push([sts.indexOf(s), p, khu, o ? [o.id, o.band, o.near, o.distCenterKm, o.distPathKm, o.text] : null, ns.stormBulletin(s, o, now)]);
      }
  const hdg = storms.map((s) => ns.stormHeadingDeg(s));
  // sóng gió: lưới 1×1 ô, tàu đúng ô ⇒ sampleField trả đúng giờ của ô
  const luoi = [
    { hours: Array.from({ length: 30 }, (_, h) => ({ waveM: h % 5 === 0 ? null : r6(0.4 + h * 0.12), windKmh: h % 7 === 3 ? 0 : r6(8 + h * 2.2) })), source: "grid", savedAt: now - 3 * 3600_000 },
    { hours: Array.from({ length: 30 }, () => ({ waveM: 0.6, windKmh: 9 })), source: "live", savedAt: now - 99 * 3600_000 },
    { hours: Array.from({ length: 30 }, () => ({ waveM: null, windKmh: 0 })), source: "grid", savedAt: null },
    { hours: Array.from({ length: 30 }, (_, h) => ({ waveM: h > 14 ? 4.2 : 1.1, windKmh: 30 })), source: "grid", savedAt: now - 30 * 3600_000 },
  ];
  const field = (l, p) => ({
    lat0: p.lat, lon0: p.lon, dLat: 1, dLon: 1, nLat: 1, nLon: 1,
    cells: [{ onSea: true, hours: l.hours.map((h) => ({ waveM: h.waveM, waveFromDeg: null, wavePeriodS: null, windKmh: h.windKmh, windFromDeg: 0, currentKmh: 0, currentToDeg: null })) }],
    source: l.source, savedAt: l.savedAt,
  });
  const p0 = at(0, 0);
  const bien = [];
  for (const l of luoi)
    for (const len of [null, 12, 15, 20])
      for (const dh of [0, 7, 13]) {
        const ms = now + dh * 3600_000;
        bien.push([luoi.indexOf(l), len, ms, sn.seaObservation(field(l, p0), p0, new Date(ms), len)]);
      }
  const bienRong = sn.seaObservation(null, p0, new Date(now), null);
  const muc = [[null, null, null], [1.9, 10, null], [2, 10, null], [3.4, 10, null], [3.5, 10, null], [0, 49, null], [0, 61, null], [0, 88, null], [2.9, 49, 15], [3, 10, 15], [4.5, 10, 15], [0, 74, 15], [0, 102, 15]].map(([w, k, l]) => ({ w, k, l, ra: sn.seaLevelOf(w, k, l) }));
  const luu = [null, now - 5 * 3600_000, now - 13 * 3600_000, now - 47 * 3600_000, now - 49 * 3600_000].map((s) => ({ s, ra: sn.seaSavedLine(s, now) }));
  const urgent = [
    { id: "a", label: "Đăng kiểm tàu", status: "", tone: "warn", pillar: 4, href: "", days: 3 },
    { id: "b", label: "Bảo hiểm thuyền viên", status: "", tone: "warn", pillar: 4, href: "", days: -2 },
    { id: "c", label: "Giấy phép khai thác", status: "", tone: "warn", pillar: 4, href: "", days: 7 },
    { id: "d", label: "Xa", status: "", tone: "warn", pillar: 4, href: "", days: 8 },
  ];
  const so = sn.seaObservation(field(luoi[0], p0), p0, new Date(now), null);
  const so2 = sn.seaObservation(field(luoi[1], p0), p0, new Date(now), null);
  // biển dùng cho bản tin / điểm tin: chỉ số vào `seas`
  const seas = [null, so, so2, { level: 0, summary: "", warn: null, savedAt: null }];
  const ugs = [[], urgent, urgent.slice(3)];
  const mo = [];
  for (const storm of ["", "Có bão."])
    for (let si = 0; si < seas.length; si++)
      for (let ui = 0; ui < ugs.length; ui++)
        for (const chart of ["du", "thieu", "chua-co"])
          for (const coViTri of [true, false]) {
            if ((si * 7 + ui * 3 + chart.length + (coViTri ? 1 : 0) + storm.length) % 4) continue;
            mo.push([storm, si, ui, chart, coViTri, op.openingBulletin({ storm, sea: seas[si], urgent: ugs[ui], chart, nowMs: now, coViTri })]);
          }
  const diem = [];
  for (const hd of [null, 100]) for (const sp of [null, 0.5, 13]) for (const unit of ["nm", "km"]) for (const d of [null, 0, 2, 5, 7]) for (const si of [0, 1, 3]) {
    if (hd == null && sp !== 13) continue;
    diem.push([hd, sp, unit, d, si, op.diemTin({ headingDeg: hd, speedKmh: sp, unit, depthHere: d, sea: seas[si] })]);
  }
  const due = [[-Infinity, -Infinity, 0, 30 * 60_000], [-Infinity, -Infinity, 0, 30 * 60_000 - 1], [0, 29 * 60_000, 0, 30 * 60_000], [0, 25 * 60_000, 0, 30 * 60_000], [10, -Infinity, 20, 30 * 60_000 + 15]].map(([a, b, c, d]) => ({ a: String(a), b: String(b), c, d, ra: op.diemTinDue(a, b, c, d) }));
  const prefs = [null, "", "{", "null", "5", '{"muc":"it"}', '{"muc":"tat","daXem":true,"tuDoc":false}', '{"muc":"x","daXem":"true","tuDoc":0}', '{"tuDoc":null}'].map((s) => ({ s, ra: pf.parseVoicePrefs(s) }));
  return { now, storms, sts, quan, hdg, luoi, bien, bienRong, muc, luu, urgent, seas, mo, diem, due, prefs, urgentLine: op.urgentLine(urgent), chartLines: ["du", "thieu", "chua-co"].map((c) => op.chartLine(c)), soNoi: { so, so2 } };
})();

/* ════════ 9. GIỌNG: gom sự kiện + bộ phát ngôn theo thời gian ảo ════════ */
const giong = (() => {
  const nguon = (over) => ({
    nowMs: 0, unit: "nm", alerts: [], border: null, offRoute: null, gps: "tracking", info: null, storm: null, sea: null,
    depthHere: null, moving: true, legsPassed: 0, legsTotal: 0, arrived: false, ...over,
  });
  const A = (id, muc, bac, cau) => ({ id, bac, muc, cau, chuong: false, rung: false, distKm: 0.5, etaMin: null });
  const obsBao = (near, band) => ({ id: "s1", band, near, distCenterKm: 150, distPathKm: 120, text: `Bão Vu típ cách tàu chừng ${band * 27} hải lý. Nghe đài duyên hải.` });
  // KỊCH BẢN: mỗi bước là nguồn ở thời điểm t (giây) + thao tác bộ phát (xong câu / đã nghe / im / đổi mức)
  const kb = [];
  const add = (s, o = {}) => kb.push({ t: s * 1000, ...o });
  add(0, { src: { gps: "idle" }, extra: [{ key: "bantin", group: "bantin", tier: "bantin", text: "Bản tin mở đầu. Máy đang canh." }] });
  add(1, { src: { depthHere: 5 } });
  add(2, { src: { depthHere: 5, alerts: [A("w1", "vang", 1, "Xác tàu phía trước chừng 1,5 hải lý.")] } });
  add(3, { src: { depthHere: 5, info: { id: "phao:1", cau: "Phao số 7 (thân đỏ) phía trước 600 m — Vào luồng: để phao này bên TRÁI tàu (ra biển thì bên phải)." } } });
  add(9, { op: "xong" });
  add(10, { src: { depthHere: 4, border: { step: 15, distanceNm: 14.6, level: "near" } } });
  add(11, { src: { depthHere: 4, border: { step: 10, distanceNm: 9.7, level: "near" } } });
  add(12, { op: "xong" });
  add(13, { src: { depthHere: 4, alerts: [A("w1", "do", 1, "Xác tàu phía trước chừng 400 m.")] } });
  add(14, { op: "xong" });
  add(20, { op: "pump" });
  add(28, { op: "xong" });
  add(40, { src: { depthHere: 4, alerts: [A("w1", "do", 1, "Xác tàu phía trước chừng 400 m.")] } });
  add(45, { src: { depthHere: 4, alerts: [A("w1", "do", 1, "Xác tàu phía trước chừng 400 m.")] } });
  add(46, { op: "xong" });
  add(47, { op: "ack" });
  add(80, { src: { depthHere: 3, alerts: [A("w1", "do", 1, "Xác tàu phía trước chừng 400 m.")] } });
  add(81, { src: { depthHere: 3, border: { step: 6, distanceNm: 5.85, level: "very_near" } } });
  add(82, { op: "xong" });
  add(83, { op: "xong" });
  add(95, { op: "pump" });
  add(115, { src: { border: { step: 6, distanceNm: 5.5, level: "very_near" }, gps: "lost" } });
  add(116, { op: "xong" });
  add(140, { src: { border: { step: 6, distanceNm: 5.2, level: "very_near" }, gps: "lost" } });
  add(141, { op: "xong" });
  add(150, { src: { gps: "tracking", saiSoM: 180, storm: obsBao(false, 99) } });
  add(151, { op: "xong" });
  add(160, { op: "pump" });
  add(170, { op: "xong" });
  add(171, { src: { saiSoM: 120, storm: obsBao(true, 3), sea: { level: 1, summary: "gió cấp 6", warn: "Bây giờ gió cấp 6. Số dự báo tải lúc 7 giờ sáng.", savedAt: 0 } } });
  add(172, { op: "mute" });
  add(173, { src: { saiSoM: 90, storm: obsBao(true, 2), offRoute: { step: 2, km: 2.4, ben: "trái", huongVeDeg: 250 }, coTuyen: true } });
  add(174, { op: "xong" });
  add(175, { src: { offRoute: { step: 5, km: 5.3, ben: null }, coTuyen: true, legsTotal: 3, legsPassed: 1, conLaiKm: 9, tocDoKmh: 20 } });
  add(176, { op: "xong" });
  add(190, { op: "unmute" });
  add(191, { src: { coTuyen: true, legsTotal: 3, legsPassed: 1, conLaiKm: 2.5, tocDoKmh: 12, vung: [{ loai: "vao", id: "r1", ten: "khu bảo tồn biển Cù Lao Chàm", muc: "vang", lan: 1 }, { loai: "vao", id: "ng1", ten: "vùng cấm vào X", muc: "do", lan: 2 }] } });
  add(192, { op: "xong" });
  add(205, { op: "xong" });
  add(206, { op: "mode", mode: "it" });
  add(207, { src: { coTuyen: true, legsTotal: 3, legsPassed: 2, conLaiKm: 1.2, khucRe: { key: "re:4:1", idx: 4, step: 1, text: "Còn chừng 1,1 hải lý, rồi đi về phía Đông, bên phải tàu." }, info: { id: "den:1", cau: "Đèn biển Kê Gà hướng Tây Nam, cách chừng 8 hải lý." } } });
  add(208, { op: "xong" });
  add(220, { op: "pump" });
  add(221, { src: { coTuyen: true, legsTotal: 3, legsPassed: 3, conLaiKm: 0.3, arrived: true, khucRe: { key: "re:4:2", idx: 4, step: 2, text: "Bây giờ đi về phía Đông, bên phải tàu." }, extra: [{ key: "sen:1", group: "sen:1", tier: "vang", text: "Còn chừng 300 mét.", reply: true }] } });
  add(222, { op: "xong" });
  add(223, { op: "xong" });
  add(224, { op: "mode", mode: "tat" });
  add(225, { src: { arrived: true, extra: [{ key: "sen:2", group: "sen:2", tier: "vang", text: "Dạ.", reply: true }], gps: "denied" } });
  add(226, { op: "xong" });
  add(227, { op: "mode", mode: "day-du" });
  add(228, { src: { arrived: false, moving: false, depthHere: 2 } });
  add(240, { src: { depthHere: 2 } });
  add(241, { src: { depthHere: 2 } });
  add(242, { op: "xong" });
  add(2100, { src: { depthHere: 2 } });
  add(2101, { src: { depthHere: 1, alerts: [A("w9", "tin", 4, "Phía trước chừng 600 m nước chừng 2–4 m.")] } });
  add(2102, { src: { depthHere: 1 } });
  add(2103, { op: "xong" });
  add(2115, { op: "pump" });
  add(2116, { op: "xong" });

  // sự kiện gọn: [key, group, tier, text, chart, persist, rank, reply]
  const evN = (e) => [e.key, e.group, e.tier, e.text, !!e.chart, !!e.persist, e.rank ?? null, !!e.reply];
  let mem = ev.initVoiceMemory();
  let st = an.initAnnouncer();
  let mode = "day-du";
  const ra = [];
  const tom = (s) => ({ cur: s.current?.key ?? null, q: s.queue.map((u) => [u.key, u.repeat]), lastEnd: s.lastEndMs === -Infinity ? null : s.lastEndMs, alarm: s.lastAlarmMs === -Infinity ? null : s.lastAlarmMs, red: s.lastRed, said: Object.keys(s.said).length, acked: Object.keys(s.acked).sort(), muted: s.mutedUntil === -Infinity ? null : s.mutedUntil });
  for (const b of kb) {
    let res = null;
    let evs = null;
    if (b.src || b.extra) {
      const src = nguon({ ...b.src, nowMs: b.t, extra: [...(b.extra ?? []), ...(b.src?.extra ?? [])] });
      const r = ev.collectVoiceEvents(mem, src);
      mem = r.mem;
      evs = r.events;
      res = an.announce(st, evs, b.t, mode);
    } else if (b.op === "xong") res = an.finished(st, b.t);
    else if (b.op === "pump") res = an.pump(st, b.t);
    else if (b.op === "ack") st = an.acknowledge(st, null);
    else if (b.op === "mute") st = an.muteFor(st, b.t);
    else if (b.op === "unmute") st = an.unmute(st);
    else if (b.op === "mode") mode = b.mode;
    if (res) st = res.state;
    ra.push({
      ev: evs ? evs.map(evN) : null,
      start: res?.start ? res.start.key : null,
      interrupt: res?.interrupt ?? null,
      wait: res?.waitMs ?? null,
      st: tom(st),
      mem: [mem.borderMin, mem.borderEp, mem.offMax, mem.offEp, mem.seaEp, mem.seaMax, mem.gpsEpisode, mem.prevGps, mem.legsSaid, mem.arriveSaid, mem.sapToiSaid, mem.gpsYeu, mem.gpsYeuEp, mem.zone.cand, mem.zone.n, mem.zone.said, mem.zone.seq, mem.stormBand],
    });
  }
  // gom sự kiện lẻ: ranh giới đợt mới, sóng hạ, lệch về, GPS yếu
  const le = [];
  let m2 = ev.initVoiceMemory();
  for (const [t, over] of [
    [0, { border: { step: 15, distanceNm: 14.2, level: "near" } }],
    [1, { border: { step: 15, distanceNm: 16, level: "ok" } }],
    [2, { border: { step: 15, distanceNm: 14.9, level: "near" } }],
    [3, { sea: { level: 2, summary: "x", warn: "Sóng lớn.", savedAt: null } }],
    [4, { sea: { level: 1, summary: "x", warn: "Sóng vừa.", savedAt: null } }],
    [5, { sea: { level: 0, summary: "x", warn: null, savedAt: null } }],
    [6, { sea: { level: 1, summary: "x", warn: "Sóng vừa.", savedAt: null } }],
    [7, { offRoute: { step: 10, km: 11.2 }, coTuyen: true }],
    [8, { offRoute: null, coTuyen: true, gps: "lost" }],
    [9, { offRoute: { step: 2, km: 2.2, ben: "phải", huongVeDeg: 10 }, coTuyen: true }],
    [10, { offRoute: null, coTuyen: false }],
    [11, { saiSoM: 151.4 }],
    [12, { saiSoM: 99 }],
    [13, { saiSoM: 160 }],
    [14, { conLaiKm: 3.4, tocDoKmh: null, unit: "km" }],
    [15, { conLaiKm: 0.9, tocDoKmh: null, unit: "km" }],
    [16, { conLaiKm: 2.1, tocDoKmh: null }],
    [17, { conLaiKm: 0.95, tocDoKmh: null }],
    [18, { conLaiKm: NaN }],
    [19, { legsTotal: 2, legsPassed: 1 }],
    [20, { legsTotal: 2, legsPassed: 2, arrived: true }],
    [21, { arrived: true }],
    [22, { vung: [{ loai: "ra", id: "r1", ten: "khu X", muc: "vang", lan: 3 }] }],
  ]) {
    const r = ev.collectVoiceEvents(m2, nguon({ ...over, nowMs: t * 1000 }));
    m2 = r.mem;
    le.push({ t: t * 1000, over: { ...over, conLaiKm: Number.isNaN(over.conLaiKm) ? "NaN" : over.conLaiKm }, ev: r.events.map(evN) });
  }
  const uu = [
    { tier: "do", chart: true }, { tier: "do" }, { tier: "vang", chart: true }, { tier: "vang" }, { tier: "bantin" }, { tier: "tin", chart: true }, { tier: "tin" }, { tier: "vang", reply: true }, { tier: "do", reply: true },
  ].map((u) => ({ u, p: an.priority(u) }));
  const cho = [];
  for (const u of [{ tier: "do" }, { tier: "vang" }, { tier: "tin" }, { tier: "vang", chart: true }, { tier: "tin", chart: true }, { tier: "bantin" }, { tier: "tin", reply: true }])
    for (const m of ["day-du", "it", "tat"]) for (const mu of [false, true]) cho.push({ u, m, mu, ra: an.allowed({ key: "k", group: "g", text: "x", ...u }, m, mu) });
  return { kb, ra, le, uu, cho };
})();

/* ════════ 10. GHÉP GIỌNG ════════ */
const ghep = (() => {
  const cauTu = new Set();
  for (const s of giong.ra) for (const e of s.ev ?? []) cauTu.add(e[3]);
  for (const s of giong.le) for (const e of s.ev) cauTu.add(e[3]);
  for (const c of hiemHoa.ca) for (const s of c.steps) for (const a of s[1]) cauTu.add(fr.toSpeechVN(a[3]));
  for (const s of tienDo.steps) if (s[7]) cauTu.add(s[7][2]);
  for (const d of nguCanh.diem) {
    if (d[5]) cauTu.add(fr.toSpeechVN(d[5][1]));
    if (d[6]) cauTu.add(fr.toSpeechVN(d[6][1]));
  }
  for (const q of bao.quan.slice(0, 20)) if (q[4]) cauTu.add(q[4]);
  for (const m of bao.mo.slice(0, 12)) cauTu.add(m[5]);
  for (const d of bao.diem.slice(0, 20)) if (d[5]) cauTu.add(d[5]);
  for (const c of cauNoi.batDau) cauTu.add(c.cau);
  const tay = [
    "Sen Biển chưa nghe rõ.",
    "Sen biển chưa nghe rõ",
    "Còn chừng 4,5 hải lý tới ranh giới. Giữ khoảng cách.",
    "Rạn có tên gần nhất là Đá Xyz, cách 3 hải lý.",
    "Tàu đang chạy hướng Đông Nam, 7 hải lý một giờ. Máy vẫn đang canh.",
    "Đèn biển Hòn Khoai hướng Tây, cách chừng 12 hải lý.",
    "Gió 35 km/giờ, mây che 80%, rộng 23.488 ha — sâu 2–4 m · nước 1,05 mét.",
    "Bão Da ghi cách tàu chừng 120 hải lý, đang đi hướng Tây Bắc.",
    "Đã tới gần điểm đến. Đã dừng dẫn đường.",
    VOICE_TEST_TEXT,
    "  ",
    "",
    "Tàu   cá   số 09 và 1005 người!  Thật…  Ừ?",
  ];
  const cau = [...new Set([...tay, ...[...cauTu].filter((_, i) => i < 30 || i % 3 === 0).slice(0, 100)])];
  const docSo = ["0", "5", "10", "15", "21", "24", "25", "30", "105", "110", "200", "1005", "23488", "1000000", "09", "999999999", "1000000000", "1001001", "12a", ""].map((s) => ({ s, ra: gh.docSo(s) }));
  const viet = [
    "Còn chừng 4,5 hải lý.", "sâu 2–4 m", "gió 35 km/giờ", "mây che 80%", "rộng 23.488 ha", "nước 1,05 mét", "Đảo Lý Sơn", "6h30 sáng", "KM/H và 7 Hải lý / giờ",
    "1.2345 và 12.345,5", "±5°", "1-2-3", "2,25 và 3,0", "Ừ thì… “ngoặc”",
  ].map((s) => ({ s, ra: gh.vietThanhNoi(s), k: gh.khoaManh(s) }));
  const dsT = ["còn chừng", "hải lý", "tới ranh giới", "bốn", "phẩy năm", "hướng", "Đông", "Nam", "Sa Huỳnh", "rạn có tên gần nhất là", "Đá", "Lớn"];
  const tuDien = Object.fromEntries(dsT.map((t) => [gh.khoaManh(t), t]));
  const ghepCa = ["Còn chừng 4,5 hải lý tới ranh giới", "Rạn có tên gần nhất là Đá Xyz", "Hướng Đông Nam Sa Huỳnh Mới", "Đá Lớn Xyz Đông", "xyz abc", "Còn chừng Đá Lớn Vui Đông Nam"].map((s) => ({ s, ra: gh.ghepManh(s, (k) => tuDien[k], 8) }));
  return {
    // [câu, các đoạn [chữ, id mp3 (bỏ thư mục) | null, nghỉ ms], mp3 câu nguyên, khoá]
    cau: cau.map((s) => [s, tts.speechParts(s).map((p) => [p.text, p.clips ? p.clips.map((u) => u.replace(/^.*\//, "").replace(/\.mp3$/, "")) : null, p.pauseMs]), tts.clipFor(s), tts.clipKey(s)]),
    tach: ["Một. Hai!  Ba?Bốn… năm", "  ", "a.b. c"].map((x) => [x, tts.splitSentences(x)]),
    docSo, viet, tuDien: dsT, ghepCa,
    soUrl: tts.allClipUrls().length,
    urlDau: tts.allClipUrls().slice(0, 3),
    urlCuoi: tts.allClipUrls().slice(-3),
  };
})();

ghi("cau-noi.json", cauNoi);
ghi("dinh-vi.json", dinhVi);
ghi("tien-do.json", tienDo);
ghi("vung.json", vung);
ghi("phien.json", phien);
ghi("hiem-hoa.json", hiemHoa);
ghi("ngu-canh.json", nguCanh);
ghi("bao-bien.json", bao);
ghi("giong.json", giong);
ghi("ghep.json", ghep);
console.log("xong — dang-chay/*.json + GiongSinh.kt");
