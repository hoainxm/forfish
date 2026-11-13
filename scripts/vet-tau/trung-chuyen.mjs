// TRUNG CHUYỂN — lượt gặp nhau trên biển, thời gian chuyển tải, tàu trung chuyển / hậu cần. CHỈ backend GPU (~/fish-vet).
// Anh Long 09/11: "tính toán luôn để xác định hoạt động trung chuyển, tàu trung chuyển, tàu hậu cần"; "tính cả thời gian
// trung chuyển, xem cả ecdt"; "đủ vết đủ nhật ký đánh bắt rồi thì làm thôi". Tài liệu: ~/fish-vet/docs/nhan-dien-tau-ais.md §5.
//
// Nền: cách dò "encounter" kiểu Global Fishing Watch đã chạy 11/10 trên VMS (AI-Assistant data-local/scripts/detect-encounters.mjs
// — giữ NGUYÊN ngưỡng để so được với lượt đó). Bản này thêm:
//   · VMS mới từ Data Lake (~/fish-vet/raw/dl-tracks, 06/10 → nay) nối sau kho cũ (tracks/2025-12 … 2026-10, tới 06/10).
//   · AIS (~/fish-vet/ais/ais.db, từ 29/10, ~10 phút/điểm):
//       – máy đã nhận là của tàu (nhan_dien vi_tri, vai tren_tau) ⇒ GỘP điểm vào vết tàu đó (VMS ~1 giờ/điểm, AIS lấp giữa);
//       – máy chưa nhận, không phải phao, có lúc chạy ≥ 2 kn (tàu VN chưa ghép + tàu cá MỌI CỜ) ⇒ thực thể riêng "A:<SHIP_ID>"
//         — bắt được lượt gặp với tàu KHÔNG có VMS Việt Nam (tàu nước ngoài, tàu hậu cần không lắp VMS).
//       – cặp (máy AIS chưa nhận, tàu VMS) từng là ứng viên so khớp (bang_chung, gap ≥ 3) = có thể chính là một tàu ⇒ không tính gặp.
// Ra ~/fish-vet/trung-chuyen/: events.ndjson (một dòng / lần gặp) · vessels.json (theo tàu) — trung_chuyen_nap.py nạp vào ais.db.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import readline from "node:readline";
import { DatabaseSync } from "node:sqlite";

const HOME = os.homedir();
const OLD = "/mnt/c/Code/AI-Assistant/sdvico-data/data-local/datalake-iuu/tracks";
const NEW = path.join(HOME, "fish-vet/raw/dl-tracks");
const DB = path.join(HOME, "fish-vet/ais/ais.db");
const PORTS = path.join(HOME, "fish-vet/datalake/moi-nhat/catalog-ports.json");
const OUT = path.join(HOME, "fish-vet/trung-chuyen");
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ngưỡng — giữ như lượt 11/10
const MAX_GAP_S = 3 * 3600, SLOW_KN = 2, MIN_PORT_KM = 10, NEAR_KM = 1, MIN_HOURS = 2;
const PAIR_REPEAT = 8, CARRIER_PARTNERS = 8, CARRIER_HIGH = 16, CROWD = 12;
const TS_KM = 0.5, ISOLATED_SHARE = 0.75, MAX_TS_HOURS = 24;
const CELL = 0.01;
// BẢN 2 (09/11): đơn vị thời gian = Ô 10 PHÚT. Trước kho AIS: mẫu mỗi 6 ô (= mỗi giờ, như lượt 11/10). Từ kho AIS trở đi
// (AIS ~10 phút/điểm): mẫu MỖI ô ⇒ đo thời gian chuyển tải chính xác ±10 phút và bắt lượt ghé NGẮN 30 phút – 2 giờ
// (loại SHORT_MEETING — riêng, không trộn vào SUSPECTED_TRANSSHIPMENT để các tháng còn so được với nhau).
const O_S = 600, MIN_SHORT_H = 0.5;

function hav(lat1, lng1, lat2, lng2) {
  const R = 6371, t = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * t) / 2) ** 2 + Math.cos(lat1 * t) * Math.cos(lat2 * t) * Math.sin(((lng2 - lng1) * t) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
const khoaReg = (reg) => { const m = /([A-Z]+)-?(\d+)/.exec((reg || "").toUpperCase().replace(/Đ/g, "D")); return m ? `${m[1]}-${m[2]}` : null; };

const cat = JSON.parse(fs.readFileSync(PORTS, "utf8"));
const ports = (cat.items || cat).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && !p.isTest);
const portGrid = new Map();
for (const p of ports) { const k = `${Math.floor(p.lat * 2)},${Math.floor(p.lng * 2)}`; (portGrid.get(k) || portGrid.set(k, []).get(k)).push(p); }
function nearPort(lat, lng) {
  const a = Math.floor(lat * 2), b = Math.floor(lng * 2);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++)
    for (const p of portGrid.get(`${a + i},${b + j}`) || []) if (hav(lat, lng, p.lat, p.lng) < MIN_PORT_KM) return true;
  return false;
}

// ---- AIS từ ais.db
const db = new DatabaseSync(DB, { readOnly: true });
const aisMin = db.prepare("SELECT min(t) AS a, max(t) AS b FROM vet").get();
const nhan = new Map(); // ship_id → reg_khoa (máy trên tàu)
for (const r of db.prepare("SELECT ship_id, reg FROM nhan_dien WHERE cach = 'vi_tri' AND vai = 'tren_tau'").all()) nhan.set(r.ship_id, r.reg);
const rieng = new Map(); // ship_id → {ten, co, loai}  (máy chưa nhận, không phao, có lúc chạy ≥ 2 kn)
for (const r of db.prepare(`SELECT m.ship_id, m.co, m.loai_ais, (SELECT ten_goc FROM ten t WHERE t.ship_id = m.ship_id ORDER BY den DESC LIMIT 1) AS ten
                            FROM may m WHERE m.la_phao = 0 AND m.toc_max >= 2
                              AND (m.co = 'VN' OR m.mmsi LIKE '574%' OR m.loai_ais = 2)`).all()) // nhóm gốc như trước 13/11 (kho nay có cả tàu buôn)
  if (!nhan.has(r.ship_id)) rieng.set(r.ship_id, { ten: r.ten, co: r.co, loai: r.loai_ais });
const ungVien = new Set(); // "ship_id|reg_khoa" từng là ứng viên so khớp ⇒ có thể là một tàu
for (const r of db.prepare("SELECT ship_id, reg FROM bang_chung GROUP BY ship_id, reg HAVING sum(gap) >= 3").all()) ungVien.add(r.ship_id + "|" + r.reg);
const qVet = db.prepare("SELECT ship_id, t, lat, lon FROM vet WHERE t >= ? AND t < ? ORDER BY ship_id, t");
const FINE_FROM = aisMin.a ? Math.ceil(aisMin.a / 3600) * 3600 : Infinity;
log("AIS:", nhan.size, "máy đã nhận ·", rieng.size, "máy riêng · kho", new Date(aisMin.a * 1e3).toISOString().slice(0, 10), "→", new Date(aisMin.b * 1e3).toISOString().slice(0, 10));

// ---- tháng cần tính
const oldFiles = fs.readdirSync(OLD).filter((f) => /^\d{4}-\d{2}\.ndjson\.gz$/.test(f)).sort();
const newFiles = fs.readdirSync(NEW).filter((f) => /^\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}\.ndjson\.gz$/.test(f)).sort();
const months = new Set(oldFiles.map((f) => f.slice(0, 7)));
for (const f of newFiles) {
  let d = new Date(f.slice(0, 7) + "-01T00:00:00Z"); const e = new Date(f.slice(11, 21) + "T00:00:00Z");
  while (d <= e) { months.add(d.toISOString().slice(0, 7)); d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)); }
}
const chiThang = process.argv.includes("--thang") ? process.argv[process.argv.indexOf("--thang") + 1].split(",") : null;
const monthList = [...months].sort().filter((m) => !chiThang || chiThang.includes(m));

const vIdx = new Map(), vId = [], vReg = [], vNguon = [];
const idx = (id, reg, nguon) => { let i = vIdx.get(id); if (i == null) { i = vId.length; vIdx.set(id, i); vId.push(id); vReg.push(reg); vNguon.push(nguon); } return i; };
const events = fs.createWriteStream(path.join(OUT, "events.ndjson"));
const perVessel = new Map();
let totalEvents = 0, crowdSkipped = 0, boCungTau = 0; const kindCount = {};

async function docTep(f, t0, t1, tracks) {
  const rl = readline.createInterface({ input: fs.createReadStream(f).pipe(zlib.createGunzip()), crlfDelay: Infinity });
  for await (const l of rl) {
    if (!l) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    if (!o.v || !Array.isArray(o.pts)) continue;
    let tr = tracks.get(o.v);
    for (const p of o.pts) {
      if (!(p[0] >= t0 && p[0] < t1)) continue;
      if (!tr) tracks.set(o.v, (tr = { reg: o.reg, khoa: khoaReg(o.reg), p: [] }));
      tr.p.push([p[0], p[1], p[2]]);
    }
  }
}

for (const month of monthList) {
  const mStart = Date.parse(month + "-01T00:00:00Z") / 1e3;
  const [yy, mm] = month.split("-").map(Number);
  const mEnd = Date.UTC(yy, mm, 1) / 1e3;
  const t0 = mStart - MAX_GAP_S, t1 = mEnd + MAX_GAP_S;
  const tracks = new Map(); // id → {reg, khoa, p: [[t, lat, lon]]}
  if (fs.existsSync(path.join(OLD, month + ".ndjson.gz"))) await docTep(path.join(OLD, month + ".ndjson.gz"), t0, t1, tracks);
  for (const f of newFiles) {
    const a = Date.parse(f.slice(0, 10) + "T00:00:00Z") / 1e3 - 86400, b = Date.parse(f.slice(11, 21) + "T00:00:00Z") / 1e3 + 2 * 86400;
    if (b > t0 && a < t1) await docTep(path.join(NEW, f), t0, t1, tracks);
  }
  // AIS
  let nAisGop = 0, nAisRieng = 0;
  if (aisMin.b && t1 > aisMin.a && t0 < aisMin.b) {
    const theoKhoa = new Map(); for (const [id, tr] of tracks) if (tr.khoa) theoKhoa.set(tr.khoa, id);
    for (const r of qVet.iterate(t0, t1)) {
      const k = nhan.get(r.ship_id);
      if (k) { const id = theoKhoa.get(k); if (id) { tracks.get(id).p.push([r.t, r.lat, r.lon]); nAisGop++; } continue; }
      const m = rieng.get(r.ship_id); if (!m) continue;
      const id = "A:" + r.ship_id; let tr = tracks.get(id);
      if (!tr) tracks.set(id, (tr = { reg: `${m.ten || "?"} [${m.co || "?"}]`, khoa: null, sid: r.ship_id, p: [] }));
      tr.p.push([r.t, r.lat, r.lon]); nAisRieng++;
    }
  }
  // mẫu theo giờ (chậm, xa cảng)
  let H = new Int32Array(1 << 22), V = new Int32Array(1 << 22), LA = new Float32Array(1 << 22), LO = new Float32Array(1 << 22), n = 0;
  const push = (h, v, la, lo) => {
    if (n === H.length) { const g = (A, C) => { const b = new C(A.length * 2); b.set(A); return b; }; H = g(H, Int32Array); V = g(V, Int32Array); LA = g(LA, Float32Array); LO = g(LO, Float32Array); }
    H[n] = h; V[n] = v; LA[n] = la; LO[n] = lo; n++;
  };
  for (const [id, tr] of tracks) {
    const pts = tr.p.sort((x, y) => x[0] - y[0]); if (pts.length < 2) continue;
    const vi = idx(id, tr.reg, id.startsWith("A:") ? "ais" : "vms");
    tr.vi = vi;
    let last = pts[0];
    for (let k = 1; k < pts.length; k++) {
      const cur = pts[k]; if (cur[0] - last[0] < 60) continue; // trùng giờ (VMS + AIS cùng lúc)
      const [ta, a0, o0] = last, [tb, a1, o1] = cur; last = cur;
      const dt = tb - ta; if (dt > MAX_GAP_S) continue;
      const kn = hav(a0, o0, a1, o1) / 1.852 / (dt / 3600);
      if (kn >= SLOW_KN) continue;
      for (let h = Math.ceil(ta / O_S); h * O_S < tb; h++) {
        if (h * O_S < mStart || h * O_S >= mEnd) continue;
        if (h * O_S < FINE_FROM && h % 6 !== 0) continue; // trước kho AIS: mỗi giờ tròn
        const w = (h * O_S - ta) / dt, la = a0 + (a1 - a0) * w, lo = o0 + (o1 - o0) * w;
        if (!nearPort(la, lo)) push(h, vi, la, lo);
      }
    }
  }
  const khoaCua = new Map(); const sidCua = new Map();
  for (const tr of tracks.values()) if (tr.vi != null) { if (tr.khoa) khoaCua.set(tr.vi, tr.khoa); if (tr.sid) sidCua.set(tr.vi, tr.sid); }
  tracks.clear();
  log(month, (n / 1e6).toFixed(1), "M mẫu giờ chậm-ngoài-khơi · AIS gộp", nAisGop, "· AIS riêng", nAisRieng);

  const order = new Uint32Array(n); for (let i = 0; i < n; i++) order[i] = i;
  order.sort((x, y) => H[x] - H[y]);
  const pairHours = new Map();
  for (let s = 0; s < n;) {
    let e = s; while (e < n && H[order[e]] === H[order[s]]) e++;
    const grid = new Map();
    for (let q = s; q < e; q++) { const i = order[q]; const k = `${Math.floor(LA[i] / CELL)},${Math.floor(LO[i] / CELL)}`; (grid.get(k) || grid.set(k, []).get(k)).push(i); }
    for (let q = s; q < e; q++) {
      const i = order[q]; const ca = Math.floor(LA[i] / CELL), cb = Math.floor(LO[i] / CELL);
      if ((grid.get(`${ca},${cb}`) || []).length > CROWD) { crowdSkipped++; continue; }
      let around = 0;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) around += (grid.get(`${ca + di},${cb + dj}`) || []).length;
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) for (const j of grid.get(`${ca + di},${cb + dj}`) || []) {
        if (V[j] <= V[i]) continue;
        const d = hav(LA[i], LO[i], LA[j], LO[j]); if (d >= NEAR_KM) continue;
        const pk = V[i] + "|" + V[j];
        (pairHours.get(pk) || pairHours.set(pk, []).get(pk)).push([H[i], (LA[i] + LA[j]) / 2, (LO[i] + LO[j]) / 2, d, around <= 2 ? 1 : 0]);
      }
    }
    s = e;
  }
  const monthEvents = [];
  for (const [pk, hs] of pairHours) {
    const [a, b] = pk.split("|").map(Number);
    // máy AIS riêng ↔ tàu VMS từng là ứng viên so khớp của nhau ⇒ có thể chính là một tàu, không phải gặp
    const sa = sidCua.get(a), sb = sidCua.get(b), ka = khoaCua.get(a), kb = khoaCua.get(b);
    if ((sa && kb && ungVien.has(sa + "|" + kb)) || (sb && ka && ungVien.has(sb + "|" + ka))) { boCungTau++; continue; }
    hs.sort((x, y) => x[0] - y[0]);
    let run = [hs[0]];
    const buoc = (h) => (h * O_S < FINE_FROM ? 6 : 1);
    const flush = () => {
      const s0 = run[0][0], s1 = run[run.length - 1][0];
      const hours = +((s1 - s0 + buoc(s1)) * O_S / 3600).toFixed(2); // thời gian = từ ô đầu tới hết ô cuối
      if (hours >= MIN_HOURS || (s0 * O_S >= FINE_FROM && hours >= MIN_SHORT_H)) monthEvents.push({ a, b, start: s0, end: s1, hours, short: hours < MIN_HOURS,
        lat: +(run.reduce((x, r) => x + r[1], 0) / run.length).toFixed(4), lng: +(run.reduce((x, r) => x + r[2], 0) / run.length).toFixed(4),
        distKmMin: +Math.min(...run.map((r) => r[3])).toFixed(3), distKmAvg: +(run.reduce((x, r) => x + r[3], 0) / run.length).toFixed(3),
        isolated: +(run.reduce((x, r) => x + r[4], 0) / run.length).toFixed(2) });
    };
    // nối khi hụt ≤ 1 giờ — cả trước AIS (giờ tròn cách ≤ 2) lẫn từ AIS (ô cách ≤ 7). Thử 20 phút (09/11): lượt dài bị cắt vụn
    // mỗi lần hai tàu dạt > 1 km ⇒ nghi chuyển tải tháng 11 tụt 1 726 → 1 004, không so được với các tháng trước.
    for (let k = 1; k < hs.length; k++) { const p = run[run.length - 1][0]; if (hs[k][0] - p <= (buoc(p) === 6 ? 12 : 7)) run.push(hs[k]); else { flush(); run = [hs[k]]; } }
    flush();
  }
  // lượt ngắn chỉ giữ khi GIỐNG chuyển tải (sát ≤ 500 m, cặp lẻ) — còn lại là tàu theo đám đi ngang (09/11: 103 nghìn lượt nhiễu)
  for (let k = monthEvents.length - 1; k >= 0; k--) { const ev = monthEvents[k]; if (ev.short && !(ev.distKmAvg <= TS_KM && ev.isolated >= ISOLATED_SHARE)) monthEvents.splice(k, 1); }
  const repeat = new Map(); for (const ev of monthEvents) if (!ev.short) { const k = ev.a + "|" + ev.b; repeat.set(k, (repeat.get(k) || 0) + 1); }
  // ngưỡng đi cặp co theo số ngày CÓ DỮ LIỆU của tháng (09/11: tháng 11 mới 8 ngày ⇒ 8 lần/tháng không bao giờ đạt, cặp kéo đôi
  // bị tính nhầm thành chuyển tải). Tháng đủ = 8 lần như lượt 11/10.
  let hMin = Infinity, hMax = -Infinity; for (let i = 0; i < n; i++) { if (H[i] < hMin) hMin = H[i]; if (H[i] > hMax) hMax = H[i]; }
  const ngayCo = n ? (hMax - hMin + 1) * O_S / 86400 : 30, ngayThang = (mEnd - mStart) / 86400;
  const pairRepeat = Math.max(3, Math.round(PAIR_REPEAT * Math.min(1, ngayCo / ngayThang)));
  log(month, "ngày có dữ liệu", ngayCo.toFixed(1), "· ngưỡng đi cặp", pairRepeat, "lần");
  for (const ev of monthEvents) {
    ev.kind = ev.short ? "SHORT_MEETING" : ev.hours > MAX_TS_HOURS ? "MOORED" : repeat.get(ev.a + "|" + ev.b) >= pairRepeat ? "PAIRED"
      : ev.distKmAvg <= TS_KM && ev.isolated >= ISOLATED_SHARE ? "SUSPECTED_TRANSSHIPMENT" : "GROUP_FISHING";
    for (const [x, y] of [[ev.a, ev.b], [ev.b, ev.a]]) {
      const pv = perVessel.get(x) || perVessel.set(x, { enc: 0, tsHours: 0, paired: 0, group: 0, moored: 0, partners: new Map() }).get(x);
      if (ev.kind === "SUSPECTED_TRANSSHIPMENT") { pv.enc++; pv.tsHours += ev.hours; pv.partners.set(y, (pv.partners.get(y) || 0) + 1); }
      else if (ev.kind === "SHORT_MEETING") pv.short = (pv.short || 0) + 1;
      else pv[{ PAIRED: "paired", GROUP_FISHING: "group", MOORED: "moored" }[ev.kind]]++;
    }
    kindCount[ev.kind] = (kindCount[ev.kind] || 0) + 1;
    events.write(JSON.stringify({ month, a: vId[ev.a], b: vId[ev.b], regA: vReg[ev.a], regB: vReg[ev.b], srcA: vNguon[ev.a], srcB: vNguon[ev.b],
      start: new Date(ev.start * O_S * 1e3).toISOString(), end: new Date(ev.start * O_S * 1e3 + ev.hours * 3600e3).toISOString(), hours: ev.hours,
      lat: ev.lat, lng: ev.lng, distKmMin: ev.distKmMin, distKmAvg: ev.distKmAvg, isolated: ev.isolated, kind: ev.kind }) + "\n");
  }
  totalEvents += monthEvents.length;
  log(month, monthEvents.length, "lần gặp", JSON.stringify(kindCount));
}
await new Promise((s) => events.end(s));
db.close();

const out = {};
for (const [i, pv] of perVessel) {
  const partners = [...pv.partners].sort((a, b) => b[1] - a[1]);
  out[vId[i]] = { reg: vReg[i], src: vNguon[i], suspectedTransshipments: pv.enc, tsHours: pv.tsHours, pairedEncounters: pv.paired, groupFishing: pv.group,
    mooredTogether: pv.moored, shortMeetings: pv.short || 0, distinctPartners: partners.length,
    carrierLevel: partners.length >= CARRIER_HIGH ? "CAO" : partners.length >= CARRIER_PARTNERS ? "VỪA" : null,
    topPartners: partners.slice(0, 10).map(([j, c]) => ({ v: vId[j], reg: vReg[j], times: c })) };
}
fs.writeFileSync(path.join(OUT, "vessels.json"), JSON.stringify({ rule: { tsKm: TS_KM, isolatedShare: ISOLATED_SHARE, maxTsHours: MAX_TS_HOURS, crowd: CROWD,
  maxGapH: MAX_GAP_S / 3600, slowKn: SLOW_KN, minPortKm: MIN_PORT_KM, nearKm: NEAR_KM, minHours: MIN_HOURS, pairRepeat: PAIR_REPEAT, carrierPartners: CARRIER_PARTNERS },
  months: monthList, vessels: out }));
log("bỏ", crowdSkipped, "mẫu ô đông ·", boCungTau, "cặp có thể là một tàu");
log("theo nhãn:", JSON.stringify(kindCount));
log("XONG:", totalEvents, "lần gặp ·", Object.keys(out).length, "tàu có gặp ·", Object.values(out).filter((x) => x.carrierLevel).length, "tàu nghi hậu cần");
