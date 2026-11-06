// VECTOR VÀNG CHO NGỮ CẢNH CANH ĐƯỜNG (đợt 2f Android — NapNguCanh): chạy CHÍNH buildNavContext + các hàm tra mỗi
// fix (phaoKeTiep/denBienTin/khuTruBaoGan/cableKmAt/restrictedAt) + evaluateNavHazards của web trên FILE THẬT trong
// public/data (bản rõ trong git), các điểm tra dựng tất định từ chính dữ liệu.
//   node native/scripts/sinh-ngu-canh.mjs  ⇒  native/shared/src/jvmTest/resources/ngu-canh/ngu-canh.json ⇒ NguCanhVangTest
// GỌN (chống phình git): chỉ ghi số đếm + kết quả tra, không chép dữ liệu.
process.env.TZ = "Asia/Ho_Chi_Minh";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "../../node_modules/jiti/lib/jiti.mjs";

const goc = dirname(fileURLToPath(import.meta.url));
const repo = join(goc, "../..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(repo, "src") } });
const im = (p) => jiti.import(join(repo, p));
const ctxm = await im("src/lib/nav-context.ts");
const hz = await im("src/lib/nav-hazards.ts");
const doc = (t) => JSON.parse(readFileSync(join(repo, "public/data", t), "utf8"));

const raw = {
  xacTau: doc("xac-tau.v1.json"),
  seaLanes: doc("vn-sea-lanes.v1.json"),
  seamarks: doc("seamarks.v1.json"),
  vnAids: doc("vn-aids.v1.json"),
  denBien: doc("den-bien.v1.json"),
  khuTruBao: doc("khu-tru-bao.v1.json"),
  vungQuanLy: doc("vung-quan-ly.v1.json"),
};
const kho = {
  xacTau: (await im("src/lib/xac-tau.ts")).decodeXacTau(raw.xacTau),
  laneFeatures: raw.seaLanes.features,
  seamarks: (await im("src/lib/seamarks.ts")).decodeSeamarks(raw.seamarks),
  vnAids: (await im("src/lib/vn-aids.ts")).decodeVnAids(raw.vnAids),
  denBien: (await im("src/lib/den-bien.ts")).decodeDenBien(raw.denBien),
  khuTruBao: (await im("src/lib/khu-tru-bao.ts")).decodeKhuTruBao(raw.khuTruBao),
  vungQuanLy: (await im("src/lib/vung-quan-ly.ts")).decodeVungQuanLy(raw.vungQuanLy),
};
const NAM = 2026;
const NOW = Date.parse("2026-06-15T03:00:00Z"); // giữa mùa cấm có thời hạn (tháng 4–6 nhiều vùng)
const fmt = (km) => `${km.toFixed(2)} km`;

const ca = [];
for (const [draft, ten] of [[null, "khong-mon"], [2.5, "mon-2-5"]]) {
  const ctx = ctxm.buildNavContext(kho, draft == null ? null : draft + 0.5, NAM);
  // điểm tra: lệch nhẹ quanh vật cản / phao / khu (tất định)
  const diem = [];
  const hzs = kho.xacTau.filter((_, i) => i % 23 === 0).map((x) => [x.lat + 0.004, x.lon - 0.003]);
  const ph = kho.vnAids.filter((_, i) => i % 37 === 0).map((x) => [x.lat - 0.006, x.lon + 0.005]);
  const kh = kho.khuTruBao.filter((_, i) => i % 9 === 0).map((x) => [x.lat + 0.05, x.lon + 0.05]);
  // điểm sát cáp/ống: đỉnh của feature dạng đường (cách 0,002°) — kiểm cableKmAt
  const cap = raw.seaLanes.features
    .filter((f) => f.geometry?.type === "LineString" && /cap|cable|ong|pipe/i.test(JSON.stringify(f.properties ?? {})))
    .filter((_, i) => i % 40 === 0)
    .map((f) => f.geometry.coordinates[Math.floor(f.geometry.coordinates.length / 2)])
    .map(([lo, la]) => [la + 0.002, lo]);
  diem.push(...hzs, ...ph, ...kh, ...cap, [10.33, 107.08], [20.8, 106.9], [16.1, 108.3]);
  const tra = diem.map(([lat, lon], i) => {
    const hd = (i * 47) % 360;
    const p = { lat, lon };
    return [
      lat, lon, hd,
      ctxm.phaoKeTiep(ctx, p, hd, fmt),
      ctxm.denBienTin(ctx, p, fmt),
      ctxm.khuTruBaoGan(ctx, p, 12, fmt).map((k) => [k.id, k.ten, k.km, k.khoang, k.gio, k.tauDaiM, k.ganDung]),
      ctxm.cableKmAt(ctx, p),
      ctxm.restrictedAt(ctx, p, NOW),
    ];
  });
  // một chuyến chạy thẳng qua chuỗi vật cản: evaluateNavHazards mỗi 20 s
  let st = hz.initNavHazardState();
  const chay = [];
  const goc0 = kho.xacTau[5];
  for (let k = 0; k < 60; k++) {
    const pos = { lat: goc0.lat - 0.06 + k * 0.002, lon: goc0.lon - 0.0005 };
    const r = hz.evaluateNavHazards(st, {
      pos, headingDeg: 0, speedKmh: 14, accuracyM: 15, nowMs: NOW + k * 20000, draftM: draft, needM: draft == null ? null : draft + 0.5,
      status: "tracking", ix: ctx.hazards, noGo: ctx.noGo, depthAt: null,
      nearestCableKm: ctxm.cableKmAt(ctx, pos), insideRestricted: ctxm.restrictedAt(ctx, pos, NOW + k * 20000), borderNm: null, fmtDist: fmt,
    });
    st = r.state;
    chay.push(r.alerts.map((a) => [a.id, a.bac, a.muc, a.cau, a.chuong, a.rung, a.distKm, a.etaMin]));
  }
  ca.push({
    ten, draft,
    dem: [ctx.hazards ? ctx.hazards.items?.length ?? ctx.counts.hazards : 0, ctx.noGo.length, ctx.counts, ctx.missing],
    tra, chay,
  });
}
const ra = join(repo, "native/shared/src/jvmTest/resources/ngu-canh");
mkdirSync(ra, { recursive: true });
writeFileSync(join(ra, "ngu-canh.json"), JSON.stringify({ nam: NAM, now: NOW, ca }));
console.log("ok", ca.map((c) => c.dem[2]));
