// ĐỐI CHIẾU NGUỒN BẢN ĐỒ — kéo CÙNG MỘT VÙNG từ nhiều nguồn ĐỘC LẬP rồi báo
// chỗ nào đồng ý, chỗ nào vênh, vênh bao nhiêu mét.
//
//   node scripts/compare-sources.mjs                     # cả 3 vùng
//   node scripts/compare-sources.mjs --region truong-sa  # một vùng
//   node scripts/compare-sources.mjs --json out.json     # ghi số liệu thô
//   node scripts/compare-sources.mjs --limit 40          # số rạn đem dò ACA
//
// KHÔNG ghi vào public/data/ — đây là công cụ ĐO, không phải công cụ sinh dữ
// liệu. Kết luận của nó đi vào docs/research/doi-chieu-nguon-2026-08.md và
// vào `crossChecks` của src/lib/provenance.ts.
//
// ── VÌ SAO ĐO KIỂU NÀY ──────────────────────────────────────────────────────
// "Nguồn nào đúng" không có trọng tài: vùng biển VN không có bộ chân lý thuỷ
// đạc mở. Thứ đo được là ĐỒNG THUẬN GIỮA CÁC PHÉP ĐO ĐỘC LẬP. Nên với mỗi lớp
// dữ liệu, script hỏi đúng ba câu:
//   (a) nguồn kia có vật ở đó không?   → agree / disagree
//   (b) nếu có thì lệch bao nhiêu mét? → offsetM
//   (c) nếu không thì bên nào thừa?    → chỉ-A / chỉ-B
// Ba con số đó là đầu vào của thang tin cậy trong src/lib/provenance.ts.
//
// ── NGUỒN ĐÃ DÒ THẬT (2026-08-29) ──────────────────────────────────────────
//  · OSM (ODbL)        — dùng bản ĐÃ ĐÓNG GÓI public/data/*.json (chỉ ĐỌC).
//                        Đây chính là dữ liệu đang chạy, tức thứ cần audit.
//  · Allen Coral Atlas — WFS GeoServer, CC-BY. ⚠️ Phải dùng WFS 1.0.0:
//                        bản 2.0.0 nhận bbox theo thứ tự lat,lon (trục EPSG:4326)
//                        và trả 0 feature khi truyền lon,lat — dò thật đã dính.
//  · UNEP-WCMC WCMC-008— ArcGIS FeatureServer, CC-BY. maxRecordCount 2000.
//  · GEBCO             — không có API điểm chính chủ (WMS chỉ ra ảnh,
//                        GetFeatureInfo trả rỗng). Dùng ODB FastAPI của
//                        NTU (api.odb.ntu.edu.tw/gebco) — phục vụ GEBCO Grid
//                        15" y hệt bước lưới ETOPO của mình ⇒ so được từng ô.
//  · ETOPO 2022        — ERDDAP PIFSC, public domain. CÙNG endpoint mà
//                        scripts/generate-depth-grid.mjs đang dùng.
//  · NGA MSI           — public domain. ⚠️ Dò 2026-08-29: cổng đang BẢO TRÌ,
//                        mọi endpoint hiểm hoạ trả 503 ("MSI IS CURRENTLY UNDER
//                        MAINTENANCE"). Chỉ World Port Index còn sống.
//
// Không thêm dependency: fetch + toán cầu tự viết (Node ≥ 20). Hàm haversine ở
// đây là bản RIÊNG của script vì scripts/*.mjs không nạp được alias "@/lib".

import { readFileSync, writeFileSync } from "node:fs";

// ── VÙNG ĐO ────────────────────────────────────────────────────────────────
// Ba vùng khác hẳn nhau về CÁCH nguồn hay sai, cố ý chọn vậy:
//   · Trường Sa   — rạn san hô ngoài khơi, vùng tranh chấp, OSM thưa và cũ.
//   · Cửa lạch    — ven bờ đông đúc, OSM dày, nhưng đáy đổi theo mùa/bồi lắng.
//   · Thềm lục địa— gần như không có vật thể, phép thử thuần về ĐỘ SÂU.
const REGIONS = {
  "truong-sa": {
    label: "Cụm Trường Sa (rạn ngoài khơi)",
    bbox: [111.5, 8.0, 115.5, 12.0], // [W, S, E, N]
    layers: ["reef", "depth"],
  },
  "cua-lach": {
    label: "Vịnh Nha Trang — cửa Bé / cửa Lớn (ven bờ)",
    bbox: [109.15, 12.1, 109.5, 12.45],
    layers: ["reef", "depth", "port"],
  },
  "them-luc-dia": {
    label: "Thềm lục địa Đông Nam Bộ (Nam Côn Sơn)",
    bbox: [107.5, 8.0, 109.5, 10.0],
    layers: ["depth"],
  },
  // Vùng thứ tư, CỐ Ý nhỏ: khung Trường Sa rộng 4° lấy mẫu độ sâu với bước
  // ~36 km nên chỉ chạm biển sâu — đúng chỗ mọi nguồn đều dễ đồng ý, và
  // TRƯỢT hết rạn. Mà rạn mới là chỗ sai một mét là chết người. Khung hẹp
  // này bám một cụm rạn thật để phép so rơi vào nước NÔNG.
  "ran-truong-sa": {
    label: "Một cụm rạn Trường Sa (khung hẹp — thử nước NÔNG)",
    bbox: [114.2, 10.2, 114.5, 10.5],
    layers: ["reef", "depth"],
  },
};

// ── HẰNG SỐ ĐO ─────────────────────────────────────────────────────────────
const R_EARTH_M = 6_371_008.8;
/** Sàn bán kính khớp: dưới mức này thì mọi nguồn ở đây đều không phân biệt nổi. */
const MATCH_FLOOR_M = 500;
/** Trần bán kính khớp — quá xa thì hai bên đang nói về hai vật khác nhau. */
const MATCH_CEIL_M = 8_000;
/** Số điểm lấy mẫu độ sâu mỗi chiều (12×12 = 144 điểm/vùng). */
const DEPTH_SAMPLES = 12;
/** ODB GEBCO nhận nhiều điểm/lần; chia lô cho nhẹ. */
const GEBCO_BATCH = 100;
const UA = "SDFish-compare/1.0 (+https://github.com/Long-Forfun/ForFish)";
const STEP_15S = 1 / 240;

// Ngưỡng phân lớp độ sâu — PHẢI KHỚP scripts/generate-depth-grid.mjs.
// Sai lệch mét là một chuyện; thứ THẬT SỰ vào tuyến đi của bà con là LỚP này.
// Thang 6 lớp từ 2026-09-04 (lớp 1 là mặt nạ rạn OSM, không sinh từ z nên
// không xuất hiện ở đây; đất theo z chỉ khi z > 0 — đường bờ dập thêm ở script).
function depthClass(z) {
  if (z > 0) return 0; // đất
  if (z > -2) return 2; // rất cạn <2 m — tuyến không đi qua
  if (z > -4) return 3; // cạn 2–4 m — chỉ tàu đã khai mớn, đủ nước
  if (z > -12) return 4; // nông — đi được, cảnh báo
  return 5; // đủ sâu
}
const CLASS_NAME = ["đất", "mặt nạ rạn", "rất cạn", "cạn 2–4 m", "nông", "đủ sâu"];

// ── TOÁN CẦU ───────────────────────────────────────────────────────────────
const rad = (d) => (d * Math.PI) / 180;

function haversineM(a, b) {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const la1 = rad(a[1]);
  const la2 = rad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Mọi đỉnh của một geometry GeoJSON, phẳng thành mảng [lng,lat]. */
function vertices(geom) {
  const out = [];
  const walk = (c) => {
    if (typeof c[0] === "number") out.push(c);
    else for (const x of c) walk(x);
  };
  if (geom?.coordinates) walk(geom.coordinates);
  return out;
}

/**
 * Tâm + BÁN KÍNH của một vật. Bán kính = khoảng xa nhất từ tâm tới đỉnh —
 * dùng làm thước khớp: hai nguồn cắt rạn thành mảnh khác nhau thì tâm lệch
 * tới cỡ tổng hai bán kính, so bằng một hằng số cứng là kết luận sai.
 */
function shapeOf(geom) {
  const pts = vertices(geom);
  if (!pts.length) return null;
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p[0];
    y += p[1];
  }
  const c = [x / pts.length, y / pts.length];
  let r = 0;
  for (const p of pts) r = Math.max(r, haversineM(c, p));
  return { c, r, pts };
}

function inBbox([w, s, e, n], [lng, lat]) {
  return lng >= w && lng <= e && lat >= s && lat <= n;
}

function stats(values) {
  if (!values.length) return null;
  const v = [...values].sort((a, b) => a - b);
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))];
  return {
    n: v.length,
    mean: v.reduce((a, b) => a + b, 0) / v.length,
    median: q(0.5),
    p90: q(0.9),
    max: v[v.length - 1],
  };
}

// ── MẠNG ───────────────────────────────────────────────────────────────────
/** fetch có trần thời gian + thử lại — nguồn công cộng hay 502/503 nhất thời. */
async function getText(url, { tries = 3, timeoutMs = 60_000, label = "" } = {}) {
  let last = "";
  // GIỮ mã + thân của lần cuối: cổng NGA trả 503 KÈM trang HTML nói rõ "đang
  // bảo trì". Vứt thân đi thì báo cáo chỉ còn "hỏng" — không phân biệt được
  // "nguồn chết" với "nguồn tạm nghỉ", mà hai thứ đó khác nhau về kết luận.
  let lastStatus = 0;
  let lastBody = "";
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json,*/*" },
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = await res.text();
      if (res.ok) return { ok: true, status: res.status, body };
      last = `HTTP ${res.status}`;
      lastStatus = res.status;
      lastBody = body;
      // 4xx là lỗi của mình (sai tham số) — thử lại vô nghĩa.
      if (res.status < 500) return { ok: false, status: res.status, body };
    } catch (e) {
      last = e.message;
    }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
  }
  return {
    ok: false,
    status: lastStatus,
    body: lastBody,
    error: `${label} ${last}`.trim(),
  };
}

async function getJson(url, opts) {
  const r = await getText(url, opts);
  if (!r.ok) return { ok: false, error: r.error ?? `HTTP ${r.status}`, status: r.status };
  try {
    return { ok: true, data: JSON.parse(r.body) };
  } catch {
    return { ok: false, error: `phản hồi không phải JSON (${r.body.slice(0, 80)})`, status: r.status };
  }
}

// ── NGUỒN 1: OSM (bản đã đóng gói, chỉ ĐỌC) ────────────────────────────────
function osmReefs(bbox) {
  const fc = JSON.parse(readFileSync("public/data/reef-shapes.v1.json", "utf8"));
  const out = [];
  for (const f of fc.features) {
    const kind = f.properties?.kind;
    if (kind !== "reef" && kind !== "shoal") continue;
    const sh = shapeOf(f.geometry);
    if (!sh || !inBbox(bbox, sh.c)) continue;
    out.push({ ...sh, kind });
  }
  return out;
}

function osmHazards(bbox) {
  const fc = JSON.parse(readFileSync("public/data/reef-shapes.v1.json", "utf8"));
  return fc.features
    .filter((f) => f.properties?.kind === "rock" || f.properties?.kind === "wreck")
    .map((f) => ({ c: f.geometry.coordinates, kind: f.properties.kind }))
    .filter((h) => inBbox(bbox, h.c));
}

/** Báo hiệu loại `harbour` từ seamarks.v1.json (định dạng gọn: bảng tra + số). */
function osmHarbours(bbox) {
  const j = JSON.parse(readFileSync("public/data/seamarks.v1.json", "utf8"));
  const ti = j.types.indexOf("harbour");
  return j.marks
    .filter((m) => m[2] === ti)
    .map((m) => ({ c: [m[0], m[1]] }))
    .filter((h) => inBbox(bbox, h.c));
}

// ── NGUỒN 2: UNEP-WCMC WCMC-008 (ArcGIS FeatureServer, CC-BY) ──────────────
const WCMC_URL =
  "https://data-gis.unep-wcmc.org/server/rest/services/HabitatsAndBiotopes/Global_Distribution_of_Coral_Reefs/FeatureServer/1/query";

async function wcmcReefs(bbox) {
  const [w, s, e, n] = bbox;
  const qs = new URLSearchParams({
    geometry: `${w},${s},${e},${n}`,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    where: "1=1",
    outFields: "*",
    returnGeometry: "true",
    f: "geojson",
  });
  const r = await getJson(`${WCMC_URL}?${qs}`, { label: "WCMC" });
  if (!r.ok) return { ok: false, error: r.error };
  const feats = r.data?.features ?? [];
  const shapes = [];
  for (const f of feats) {
    const sh = shapeOf(f.geometry);
    if (sh) shapes.push(sh);
  }
  // maxRecordCount 2000: chạm trần thì kết quả BỊ CẮT, phải nói ra chứ không
  // được lặng lẽ báo "nguồn kia ít vật hơn".
  return { ok: true, shapes, truncated: feats.length >= 2000 };
}

// ── NGUỒN 3: Allen Coral Atlas (WFS GeoServer, CC-BY) ──────────────────────
const ACA_URL = "https://allencoralatlas.org/geoserver/ows";

/** Có rạn ACA quanh điểm này không, và mép gần nhất cách bao nhiêu mét. */
async function acaProbe(center, radiusM) {
  // Nới khung dò bằng bán kính vật + biên MATCH_FLOOR_M.
  const padM = radiusM + MATCH_FLOOR_M;
  const dLat = (padM / R_EARTH_M) * (180 / Math.PI);
  const dLon = dLat / Math.max(0.2, Math.cos(rad(center[1])));
  const bbox = [
    center[0] - dLon,
    center[1] - dLat,
    center[0] + dLon,
    center[1] + dLat,
  ];
  const qs = new URLSearchParams({
    service: "WFS",
    version: "1.0.0", // ⚠️ 2.0.0 đảo trục lat/lon → 0 feature. Đã dò thật.
    request: "GetFeature",
    typeName: "coral-atlas:geomorphic_data_verbose",
    outputFormat: "application/json",
    srsName: "EPSG:4326",
    maxFeatures: "50",
    bbox: bbox.join(","),
  });
  const r = await getJson(`${ACA_URL}?${qs}`, { label: "ACA", timeoutMs: 90_000 });
  if (!r.ok) return { ok: false, error: r.error };
  const feats = r.data?.features ?? [];
  if (!feats.length) return { ok: true, found: false };
  let best = Infinity;
  for (const f of feats) {
    for (const p of vertices(f.geometry)) {
      const d = haversineM(center, p);
      if (d < best) best = d;
    }
  }
  return { ok: true, found: true, nearestM: best, features: feats.length };
}

// ── NGUỒN 4+5: ĐỘ SÂU — ETOPO (đang dùng) vs GEBCO ─────────────────────────
const ERDDAP =
  "https://oceanwatch.pifsc.noaa.gov/erddap/griddap/ETOPO_2022_v1_15s.json";
const ODB_GEBCO = "https://api.odb.ntu.edu.tw/gebco";

/**
 * Lấy lưới ETOPO thưa trong bbox. Trả về ĐÚNG toạ độ tâm ô mà nguồn dùng —
 * rồi hỏi GEBCO tại chính những toạ độ đó, nên phép so là ô-với-ô, không có
 * sai số nội suy chen vào.
 */
async function etopoLattice(bbox, samples) {
  const [w, s, e, n] = bbox;
  const nLat = Math.round((n - s) / STEP_15S);
  const stride = Math.max(1, Math.floor(nLat / samples));
  const url =
    `${ERDDAP}?z%5B(${s}):${stride}:(${n})%5D%5B(${w}):${stride}:(${e})%5D`;
  const r = await getJson(url, { label: "ETOPO", timeoutMs: 120_000 });
  if (!r.ok) return { ok: false, error: r.error };
  const rows = r.data?.table?.rows ?? [];
  return {
    ok: true,
    stride,
    points: rows.map(([lat, lon, z]) => ({ lat, lon, z })),
  };
}

async function gebcoAt(points) {
  const out = [];
  for (let i = 0; i < points.length; i += GEBCO_BATCH) {
    const lot = points.slice(i, i + GEBCO_BATCH);
    const qs = new URLSearchParams({
      lon: lot.map((p) => p.lon.toFixed(6)).join(","),
      lat: lot.map((p) => p.lat.toFixed(6)).join(","),
      mode: "point", // KHÔNG có mode=point thì API nội suy thành TRẮC DIỆN
    });
    const r = await getJson(`${ODB_GEBCO}?${qs}`, { label: "GEBCO", timeoutMs: 90_000 });
    if (!r.ok) return { ok: false, error: r.error };
    const z = r.data?.z ?? [];
    if (z.length !== lot.length) {
      return { ok: false, error: `GEBCO trả ${z.length} số cho ${lot.length} điểm` };
    }
    out.push(...z);
  }
  return { ok: true, z: out };
}

// ── NGUỒN 6: NGA Maritime Safety Information (public domain) ───────────────
const NGA_HAZARD_ENDPOINTS = [
  ["ngalol/lights-buoys", "https://msi.nga.mil/api/publications/ngalol/lights-buoys?output=json&volume=112"],
  ["asam", "https://msi.nga.mil/api/publications/asam?output=json"],
  ["navigational-warnings", "https://msi.nga.mil/api/publications/navigational-warnings?output=json"],
];
const NGA_WPI = "https://msi.nga.mil/api/publications/world-port-index?output=json";

let wpiCache = null;
async function ngaPorts(bbox) {
  if (!wpiCache) {
    const r = await getJson(NGA_WPI, { label: "NGA WPI", timeoutMs: 180_000 });
    wpiCache = r.ok ? r.data?.ports ?? [] : { error: r.error };
  }
  if (!Array.isArray(wpiCache)) return { ok: false, error: wpiCache.error };
  const pts = [];
  for (const p of wpiCache) {
    const lat = dmsToDeg(p.latitude);
    const lon = dmsToDeg(p.longitude);
    if (lat == null || lon == null) continue;
    if (!inBbox(bbox, [lon, lat])) continue;
    pts.push({ c: [lon, lat], name: p.portName });
  }
  return { ok: true, ports: pts };
}

/** WPI ghi toạ độ dạng `30°20'00"N` — đổi ra độ thập phân. */
function dmsToDeg(s) {
  const m = /^(\d+)°(\d+)'(\d+)"([NSEW])$/.exec(String(s ?? "").trim());
  if (!m) return null;
  const v = Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600;
  return m[4] === "S" || m[4] === "W" ? -v : v;
}

async function ngaHazardStatus() {
  const out = [];
  for (const [name, url] of NGA_HAZARD_ENDPOINTS) {
    const r = await getText(url, { tries: 1, timeoutMs: 45_000, label: name });
    const maintenance = /UNDER MAINTENANCE/i.test(r.body ?? "");
    out.push({
      name,
      status: r.status,
      ok: r.ok,
      note: maintenance ? "cổng MSI đang BẢO TRÌ" : r.ok ? "sống" : (r.error ?? `HTTP ${r.status}`),
    });
  }
  return out;
}

// ── SO KHỚP VẬT THỂ ────────────────────────────────────────────────────────
/**
 * Khớp danh sách A với B theo tâm gần nhất; bán kính khớp co giãn theo cỡ vật
 * (kẹp trong [MATCH_FLOOR_M, MATCH_CEIL_M]).
 */
function matchShapes(as, bs) {
  const matched = [];
  const onlyA = [];
  const usedB = new Set();
  // Khoảng cách tới vật GẦN NHẤT bên kia — ghi cho MỌI vật, kể cả vật không
  // khớp. "Không khớp" mà hàng xóm cách 900 m là chuyện khác hẳn "không khớp"
  // mà hàng xóm cách 40 km; chỉ đếm khớp/không khớp là giấu mất khác biệt đó.
  const nearestAll = [];
  for (const a of as) {
    let best = null;
    for (let i = 0; i < bs.length; i++) {
      const d = haversineM(a.c, bs[i].c);
      if (!best || d < best.d) best = { d, i };
    }
    if (!best) {
      onlyA.push(a);
      continue;
    }
    nearestAll.push(best.d);
    const tol = Math.min(
      MATCH_CEIL_M,
      Math.max(MATCH_FLOOR_M, a.r + (bs[best.i].r ?? 0)),
    );
    if (best.d <= tol) {
      matched.push({ a, b: bs[best.i], d: best.d, tol });
      usedB.add(best.i);
    } else {
      onlyA.push({ ...a, nearestM: best.d });
    }
  }
  const onlyB = bs.filter((_, i) => !usedB.has(i));
  return { matched, onlyA, onlyB, nearestAll };
}

// ── CHẠY MỘT VÙNG ──────────────────────────────────────────────────────────
async function runRegion(id, limit) {
  const reg = REGIONS[id];
  const out = { id, label: reg.label, bbox: reg.bbox };
  console.log(`\n${"═".repeat(74)}\n▌ ${id} — ${reg.label}`);
  console.log(`  khung ${reg.bbox.join(", ")}`);

  if (reg.layers.includes("reef")) out.reef = await compareReefs(reg, limit);
  if (reg.layers.includes("depth")) out.depth = await compareDepth(reg);
  if (reg.layers.includes("port")) out.port = await comparePorts(reg);
  return out;
}

async function compareReefs(reg, limit) {
  const osm = osmReefs(reg.bbox);
  console.log(`\n── RẠN / BÃI ──`);
  console.log(`  OSM (bản đang chạy): ${osm.length} hình`);

  const wcmc = await wcmcReefs(reg.bbox);
  if (!wcmc.ok) {
    console.log(`  UNEP-WCMC: LỖI — ${wcmc.error}`);
    return { osmCount: osm.length, wcmc: { error: wcmc.error } };
  }
  console.log(
    `  UNEP-WCMC WCMC-008: ${wcmc.shapes.length} hình` +
      (wcmc.truncated ? "  ⚠️ CHẠM TRẦN 2000 — số này bị cắt" : ""),
  );

  const m = matchShapes(osm, wcmc.shapes);
  const st = stats(m.matched.map((x) => x.d));
  const nearSt = stats(m.nearestAll);
  console.log(
    `  → KHỚP ${m.matched.length}/${osm.length} hình OSM` +
      `  · chỉ OSM có ${m.onlyA.length}` +
      `  · chỉ WCMC có ${m.onlyB.length}`,
  );
  if (st) {
    console.log(
      `  → vênh tâm (hình đã khớp): trung bình ${Math.round(st.mean)} m` +
        ` · trung vị ${Math.round(st.median)} m` +
        ` · p90 ${Math.round(st.p90)} m · lớn nhất ${Math.round(st.max)} m`,
    );
  }
  if (nearSt) {
    console.log(
      `  → tới hình WCMC gần nhất (KỂ CẢ hình không khớp): trung vị ` +
        `${Math.round(nearSt.median)} m · p90 ${Math.round(nearSt.p90)} m` +
        ` · xa nhất ${Math.round(nearSt.max)} m`,
    );
  }

  // ACA: dò từng vật (WFS trả mảnh 5 m, không đếm-đối-đếm được) — cắt theo
  // --limit để không nện server công cộng.
  const probes = osm.slice(0, limit);
  console.log(`  Allen Coral Atlas: dò ${probes.length}/${osm.length} hình…`);
  let found = 0;
  let miss = 0;
  let failed = 0;
  const nearest = [];
  for (const s of probes) {
    const p = await acaProbe(s.c, s.r);
    if (!p.ok) {
      failed++;
      continue;
    }
    if (p.found) {
      found++;
      nearest.push(p.nearestM);
    } else {
      miss++;
    }
  }
  const acaSt = stats(nearest);
  console.log(
    `  → ACA xác nhận ${found}/${probes.length - failed}` +
      ` · không thấy ${miss}` +
      (failed ? ` · ${failed} lượt hỏng mạng` : ""),
  );
  if (acaSt) {
    console.log(
      `  → tâm OSM tới mép rạn ACA gần nhất: trung vị ${Math.round(acaSt.median)} m` +
        ` · p90 ${Math.round(acaSt.p90)} m · lớn nhất ${Math.round(acaSt.max)} m`,
    );
  }

  return {
    osmCount: osm.length,
    wcmcCount: wcmc.shapes.length,
    wcmcTruncated: wcmc.truncated,
    matched: m.matched.length,
    onlyOsm: m.onlyA.length,
    onlyWcmc: m.onlyB.length,
    centroidOffsetM: st,
    nearestWcmcM: nearSt,
    aca: { probed: probes.length, found, miss, failed, nearestM: acaSt },
  };
}

async function compareDepth(reg) {
  console.log(`\n── ĐỘ SÂU: ETOPO 2022 (đang dùng) vs GEBCO Grid ──`);
  const lat = await etopoLattice(reg.bbox, DEPTH_SAMPLES);
  if (!lat.ok) {
    console.log(`  ETOPO: LỖI — ${lat.error}`);
    return { error: lat.error };
  }
  console.log(`  ETOPO: ${lat.points.length} ô (bước ${lat.stride}× ô gốc 15″)`);
  const g = await gebcoAt(lat.points);
  if (!g.ok) {
    console.log(`  GEBCO: LỖI — ${g.error}`);
    return { etopoCount: lat.points.length, error: g.error };
  }

  const diffs = [];
  let classAgree = 0;
  let landWaterFlip = 0;
  const worst = [];
  for (let i = 0; i < lat.points.length; i++) {
    const ze = lat.points[i].z;
    const zg = g.z[i];
    if (!Number.isFinite(ze) || !Number.isFinite(zg)) continue;
    const d = Math.abs(ze - zg);
    diffs.push(d);
    const ce = depthClass(ze);
    const cg = depthClass(zg);
    if (ce === cg) classAgree++;
    if ((ce === 0) !== (cg === 0)) landWaterFlip++;
    worst.push({ ...lat.points[i], zGebco: zg, diff: d, ce, cg });
  }
  const st = stats(diffs);
  worst.sort((a, b) => b.diff - a.diff);

  console.log(
    `  → so ${diffs.length} ô cùng toạ độ: lệch trung bình ${st.mean.toFixed(1)} m` +
      ` · trung vị ${st.median.toFixed(1)} m · p90 ${st.p90.toFixed(1)} m` +
      ` · lớn nhất ${st.max.toFixed(1)} m`,
  );
  console.log(
    `  → LỚP ĐI BIỂN khớp ${classAgree}/${diffs.length}` +
      ` (${((classAgree / diffs.length) * 100).toFixed(1)}%)` +
      ` · đảo đất↔nước ${landWaterFlip} ô`,
  );
  for (const w of worst.slice(0, 3)) {
    console.log(
      `     lệch nhất: ${w.lat.toFixed(4)},${w.lon.toFixed(4)}` +
        ` ETOPO ${w.z} m (${CLASS_NAME[w.ce]}) vs GEBCO ${w.zGebco} m (${CLASS_NAME[w.cg]})`,
    );
  }
  return {
    n: diffs.length,
    stride: lat.stride,
    diffM: st,
    classAgree,
    classAgreePct: (classAgree / diffs.length) * 100,
    landWaterFlip,
    worst: worst.slice(0, 5),
  };
}

async function comparePorts(reg) {
  console.log(`\n── CẢNG / BÁO HIỆU: OSM vs NGA ──`);
  const haz = await ngaHazardStatus();
  for (const h of haz) console.log(`  NGA ${h.name}: ${h.status} — ${h.note}`);

  const osm = osmHarbours(reg.bbox);
  const hazards = osmHazards(reg.bbox);
  console.log(`  OSM trong khung: ${osm.length} cảng · ${hazards.length} đá/xác tàu`);

  const nga = await ngaPorts(reg.bbox);
  if (!nga.ok) {
    console.log(`  NGA World Port Index: LỖI — ${nga.error}`);
    return { osmHarbours: osm.length, osmHazards: hazards.length, ngaEndpoints: haz, error: nga.error };
  }
  console.log(`  NGA World Port Index: ${nga.ports.length} cảng`);
  const m = matchShapes(
    nga.ports.map((p) => ({ ...p, r: 0 })),
    osm.map((p) => ({ ...p, r: 0 })),
  );
  const st = stats(m.matched.map((x) => x.d));
  const nearSt = stats(m.nearestAll);
  console.log(
    `  → khớp ${m.matched.length}/${nga.ports.length} cảng NGA với cảng OSM` +
      ` · chỉ NGA có ${m.onlyA.length} · chỉ OSM có ${m.onlyB.length}`,
  );
  if (nearSt) {
    console.log(
      `  → cảng NGA tới cảng OSM gần nhất (kể cả không khớp): trung vị ` +
        `${Math.round(nearSt.median)} m · xa nhất ${Math.round(nearSt.max)} m`,
    );
  }
  return {
    osmHarbours: osm.length,
    osmHazards: hazards.length,
    ngaEndpoints: haz,
    ngaPorts: nga.ports.length,
    matched: m.matched.length,
    onlyNga: m.onlyA.length,
    onlyOsm: m.onlyB.length,
    offsetM: st,
    nearestM: nearSt,
  };
}

// ── MAIN ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const wanted = argOf("--region", "all");
const limit = Number(argOf("--limit", "25"));
const jsonOut = argOf("--json", null);

const ids = wanted === "all" ? Object.keys(REGIONS) : [wanted];
for (const id of ids) {
  if (!REGIONS[id]) {
    console.error(`Không có vùng "${id}". Có: ${Object.keys(REGIONS).join(", ")}`);
    process.exit(1);
  }
}

console.log(`ĐỐI CHIẾU NGUỒN — ${new Date().toISOString().slice(0, 10)}`);
const report = { runAt: new Date().toISOString(), limit, regions: [] };
for (const id of ids) report.regions.push(await runRegion(id, limit));

if (jsonOut) {
  writeFileSync(jsonOut, JSON.stringify(report, null, 2));
  console.log(`\nSố liệu thô → ${jsonOut}`);
}
console.log("\nXong.");
