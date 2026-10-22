// BỘ TIÊU CHÍ CHẤM DẪN ĐƯỜNG (2026-10-22) — chạy: npm run dan-duong:cham
// Mỗi `it` = một tiêu chí, luôn PASS ở mức vitest (không ném) và ghi điểm vào `bang`;
// afterAll xuất .dan-duong/bang-diem.{json,md}. Bậc A = cổng cứng an toàn.
// Thiết kế + lý do từng tiêu chí: docs/app-map/ops/dan-duong-khoa-hoc.md §5.
import { afterAll, describe, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  planRoute,
  planRouteWithDiagnostics,
  requiredDepthM,
  waveDirFactor,
  speedFactor,
  currentAlongKmh,
  currentCrossKmh,
  sampleField,
  haversineKm,
  type LatLon,
  type RoutePlan,
  type PlanArgs,
} from "@/lib/route-plan";
import { computeNavProgress, projectOntoRoute, steerCue, etaHours } from "@/lib/nav-progress";
import { navThresholdsKm } from "@/lib/nav-hazards";
import { fixQuaCu } from "@/lib/use-nav-tracking";
import { legRisk } from "@/lib/route-legs";
import { routePointRows } from "@/lib/route-points";
import { decodeTideStations, tideExtremesForDay, tideDraftWarning, tideHeightAt, nearestTideStation } from "@/lib/tides";
import { buildHazardList, hazardsInBBox, packHazards } from "@/lib/hazards";
import { decodeXacTau } from "@/lib/xac-tau";
import { decodeSeamarks } from "@/lib/seamarks";
import { estimateWaveFromWind } from "@/lib/sea";
import {
  ROOT, GIO_EM, TAU_7KN, TAU_MON_1_2, TAU_MON_3,
  bang, datLop, diemTuyenTinh, ghi, goi, gocRe, khung, khoangToiTuyen, luoiSauHet, luoiThat,
  mauDocTuyen, toChuNhat, toTron, tomTat, tongKm, truong, truongRong, vat, xuatBang,
} from "./khung";

// Vùng thử tổng hợp: biển khơi (trong lưới), tuyến ~150 km đông–tây
const A: LatLon = { lat: 10.0, lon: 110.0 };
const B: LatLon = { lat: 10.0, lon: 111.4 };
const GIUA: LatLon = { lat: 10.0, lon: 110.7 };
const BB = khung([A, B], 80);

function args(o: Partial<PlanArgs> = {}): PlanArgs {
  return {
    start: A, dest: B, boat: TAU_7KN, departHourIdx: 6,
    field: truong(BB), depth: o.depth === undefined ? luoiSauHet() : o.depth, bbox: BB,
    ...o,
  };
}

const L = luoiSauHet();
const CO = { cl: 0 as const, ran: 1 as const, l2: 2 as const, l3: 3 as const, l4: 4 as const };

describe("A — an toàn tĩnh (cổng cứng)", () => {
  it("A1 không cắt đảo giữa đường (đảo 6 km chắn đường thẳng)", () => {
    const g = luoiSauHet();
    toTron(g, GIUA, 6, CO.cl);
    const p = planRoute(args({ depth: g }));
    const mau = p ? mauDocTuyen(p.waypoints, 0.2) : [];
    const chamDat = mau.filter((m) => haversineKm(m, GIUA) <= 6).length;
    ghi({ id: "A1", nhom: "A an toàn tĩnh", ten: "Không cắt đất ngoài vòng nới", bac: "A",
      diem: p && chamDat === 0 ? 100 : 0, so: { coTuyen: !!p, mauTrenDat: chamDat, ...tomTat(p) }, ghi: "mẫu 0,2 km dọc tuyến không được rơi vào ô đất" });
  });

  it("A2 rạn (lớp 1) giữa đường: tuyến cách mép rạn ≥ 0,5 km", () => {
    const g = luoiSauHet();
    toTron(g, GIUA, 2, CO.ran);
    const p = planRoute(args({ depth: g }));
    const d = p ? Math.min(...mauDocTuyen(p.waypoints, 0.2).map((m) => haversineKm(m, GIUA))) - 2 : -99;
    ghi({ id: "A2", nhom: "A an toàn tĩnh", ten: "Né rạn có đệm ≥ 0,5 km", bac: "A",
      diem: d >= 0.5 ? 100 : d >= 0 ? 50 : 0, so: { demKm: Math.round(d * 100) / 100, ...tomTat(p) }, ghi: "đệm thật ngoài mặt nạ (mặt nạ đã nở 1 km khi build, nhưng lưới tổng hợp không nở)" });
  });

  it("A3 vật chặn điểm (xác tàu r=0,5) ngoài 5 km cảng: tuyến không vào vòng", () => {
    const hz = goi([vat("xt1", GIUA, 0.5)]);
    const p = planRoute(args({ hazards: hz }));
    const d = p ? khoangToiTuyen(GIUA, p.waypoints) : -1;
    ghi({ id: "A3", nhom: "A an toàn tĩnh", ten: "Không vào vòng chặn vật điểm", bac: "A",
      diem: p && d >= 0.5 && p.hazardChecked && !p.hasHazardLeg ? 100 : 0, so: { khoangKm: Math.round(d * 1000) / 1000, ...tomTat(p) }, ghi: "" });
  });

  it("A4 dải cấm hẹp-mà-dài (0,3 × 30 km) không lọt khe mẫu", () => {
    // đa giác cấm vào chắn ngang đường, hẹp 0,3 km, dài 30 km (bắc–nam)
    const w = 0.15 / (111.32 * Math.cos((10 * Math.PI) / 180));
    const h = 15 / 111.32;
    const ring: [number, number][] = [
      [GIUA.lon - w, GIUA.lat - h], [GIUA.lon + w, GIUA.lat - h], [GIUA.lon + w, GIUA.lat + h], [GIUA.lon - w, GIUA.lat + h], [GIUA.lon - w, GIUA.lat - h],
    ];
    const z = { id: "cam1", ten: "dải cấm", ring, bbox: { latMin: GIUA.lat - h, latMax: GIUA.lat + h, lonMin: GIUA.lon - w, lonMax: GIUA.lon + w } };
    const p = planRoute(args({ noGo: [z] }));
    const vao = p ? mauDocTuyen(p.waypoints, 0.05).filter((m) => Math.abs(m.lat - GIUA.lat) <= h && Math.abs(m.lon - GIUA.lon) <= w).length : -1;
    ghi({ id: "A4", nhom: "A an toàn tĩnh", ten: "Vùng cấm hẹp-dài không lọt khe", bac: "A",
      diem: p && vao === 0 ? 100 : 0, so: { mauTrongVung: vao, ...tomTat(p) }, ghi: "nợ đã ghi đầu route-plan.ts: cần chỉ mục CẠNH vùng" });
  });

  it("A5 cạnh start→nút đầu và nút cuối→dest cũng được kiểm (vật cách start 7 km)", () => {
    const g7: LatLon = { lat: A.lat, lon: A.lon + 7 / (111.32 * Math.cos((10 * Math.PI) / 180)) };
    const p = planRoute(args({ hazards: goi([vat("xt2", g7, 0.6)]) }));
    const d = p ? khoangToiTuyen(g7, p.waypoints) : -1;
    ghi({ id: "A5", nhom: "A an toàn tĩnh", ten: "Hai đầu thật được kiểm nghiêm", bac: "A",
      diem: p && d >= 0.6 ? 100 : 0, so: { khoangKm: Math.round(d * 1000) / 1000, ...tomTat(p) }, ghi: "vật ngoài 5 km nên phải chặn, dù nằm trên cạnh nối toạ độ thật" });
  });

  it("A6 bão/biển ≥4 m chắn ngang: lượt nghiêm né, không ra best-effort khi còn đường", () => {
    const f = truong(BB, (lat, lon) => (Math.abs(lon - GIUA.lon) < 0.2 && lat > 9.6 ? { ...GIO_EM, waveM: 4.5, windKmh: 70 } : GIO_EM));
    const p = planRoute(args({ field: f }));
    ghi({ id: "A6", nhom: "A an toàn tĩnh", ten: "Né dải sóng ≥4 m khi còn lối", bac: "A",
      diem: p && !p.bestEffortSeas && p.maxWaveM < 4 && p.distKm > haversineKm(A, B) * 1.03 ? 100 : 0, so: { ...tomTat(p), tiLe: p ? Math.round((p.distKm / haversineKm(A, B)) * 100) / 100 : 0 }, ghi: "dải hở ở phía nam (lat<9,6) nên phải vòng qua" });
  });
});

describe("B — độ sâu · mớn · triều", () => {
  it("B1 nước cần: chưa khai mớn → im; mớn 1,2 + Hs 1 → 2,2 m", () => {
    const a = requiredDepthM(null, 1), b = requiredDepthM(1.2, 1), c = requiredDepthM(1.2, 5);
    const ok = a === null && b === 2.2 && c === 3.2;
    ghi({ id: "B1", nhom: "B độ sâu", ten: "requiredDepthM đúng luật", bac: "B", diem: ok ? 100 : 0, so: { a, b, c }, ghi: "mớn + 0,5 + ½·min(Hs,3)" });
  });

  it("B2 dải 2–4 m giữa đường: chưa khai mớn → chặn; mớn 1,2 → qua có cờ; mớn 3 → chặn", () => {
    const g = luoiSauHet();
    toChuNhat(g, { latMin: 9.2, latMax: 10.8, lonMin: GIUA.lon - 0.05, lonMax: GIUA.lon + 0.05 }, CO.l3);
    const p0 = planRoute(args({ depth: g }));
    const p1 = planRoute(args({ depth: g, boat: TAU_MON_1_2 }));
    const p3 = planRoute(args({ depth: g, boat: TAU_MON_3 }));
    const qua = (p: RoutePlan | null) => !!p && mauDocTuyen(p.waypoints, 0.2).some((m) => Math.abs(m.lon - GIUA.lon) <= 0.05 && m.lat > 9.2 && m.lat < 10.8);
    const ok = !qua(p0) && qua(p1) && p1!.hasDraftShallowLeg && !qua(p3);
    ghi({ id: "B2", nhom: "B độ sâu", ten: "Lớp 2–4 m theo mớn đã khai", bac: "A", diem: ok ? 100 : 0,
      so: { chuaKhaiQua: qua(p0), mon12Qua: qua(p1), mon12Co: p1?.hasDraftShallowLeg ?? null, mon3Qua: qua(p3) }, ghi: "" });
  });

  it("B3 triều: bãi 0,2 m trên số 0 hải đồ, mớn 2 m — ròng phải cảnh báo, lớn thì không", () => {
    const st = decodeTideStations(JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/tide-stations.v1.json"), "utf8")));
    const vt = st.find((s) => s.id === "vung-tau") ?? st[0];
    const ex = tideExtremesForDay(vt, "2026-11-05");
    const low = ex.filter((e) => e.kind === "low").sort((a, b) => a.heightM - b.heightM)[0];
    const high = ex.filter((e) => e.kind === "high").sort((a, b) => b.heightM - a.heightM)[0];
    const canhBao = tideDraftWarning(ex, { draftM: 2, chartDepthM: 0.2 });
    const chiLuc = high ? tideDraftWarning([high], { draftM: 2, chartDepthM: 0.2 }) : "x";
    const ok = !!low && !!canhBao && chiLuc === null && low.heightM < high!.heightM;
    ghi({ id: "B3", nhom: "B độ sâu", ten: "tideDraftWarning đúng theo con nước", bac: "B", diem: ok ? 100 : 0,
      so: { tram: vt.id, rong: low?.heightM ?? null, lon: high?.heightM ?? null, canhBao: !!canhBao }, ghi: "" });
  });

  it("B4 triều NỐI VÀO ĐỘ SÂU LÚC LẬP TUYẾN tại ETA (lớp 3, mớn 1,8: ròng −0,5 chặn, lớn +1,5 mở)", () => {
    // Hiện tại luật lớp 3 KHÔNG cộng triều ⇒ cùng một tàu ra cùng một kết quả bất kể giờ.
    const g = luoiSauHet();
    toChuNhat(g, { latMin: 9.2, latMax: 10.8, lonMin: GIUA.lon - 0.05, lonMax: GIUA.lon + 0.05 }, CO.l3);
    const tau = { ...TAU_7KN, draftM: 1.8 }; // cần 2,3 m > trần 2,0 ⇒ chặn tĩnh
    const p = planRoute(args({ depth: g, boat: tau }));
    const qua = !!p && mauDocTuyen(p.waypoints, 0.2).some((m) => Math.abs(m.lon - GIUA.lon) <= 0.05 && m.lat > 9.2 && m.lat < 10.8);
    ghi({ id: "B4", nhom: "B độ sâu", ten: "Triều vào luật độ sâu lúc lập tuyến (tại ETA)", bac: "B", diem: 0, dat: false, trangThai: "chua-do",
      so: { quaKhiKhongTrieu: qua, hoursAtCo: !!p?.hoursAt?.length }, ghi: "PlanArgs chưa có đầu vào triều; quyết định 2026-09-04 'triều không vào Dijkstra' chỉ cấm đưa vào CHI PHÍ, không cấm hiệu chỉnh ĐỘ SÂU tại ETA" });
  });

  it("B5 squat theo tốc độ trong nước nông (Barrass) có trong nước cần", () => {
    const n7 = requiredDepthM(2, 0), n12 = requiredDepthM(2, 0);
    ghi({ id: "B5", nhom: "B độ sâu", ten: "Squat (lún đuôi theo tốc độ) trong UKC", bac: "C", diem: 0, dat: false, trangThai: "chua-do",
      so: { can7kn: n7, can12kn: n12 }, ghi: "requiredDepthM không nhận tốc độ; tàu cá 10 kn ở nước 5 m lún thêm ~0,2–0,4 m" });
  });

  it("B6 datum: lưới MSL ↔ triều số 0 hải đồ có phép quy đổi (z0)", () => {
    const st = decodeTideStations(JSON.parse(fs.readFileSync(path.join(ROOT, "public/data/tide-stations.v1.json"), "utf8")));
    const coZ0 = st.every((s) => Number.isFinite(s.z0));
    ghi({ id: "B6", nhom: "B độ sâu", ten: "Quy đổi datum MSL ↔ số 0 hải đồ khi cộng triều vào lưới", bac: "B", diem: 0, dat: false, trangThai: "chua-do",
      so: { tramCoZ0: coZ0, soTram: st.length }, ghi: "lưới độ sâu là MSL (ETOPO/GEBCO); mực triều so số 0 ⇒ độ sâu lúc t = z_MSL + (h(t) − z0). Chưa có hàm nào làm phép này" });
  });

  it("B7 lớp 4 (4–12 m) + sóng 2,6 m → nâng mức 'không nên đi' (sóng vỡ nước nông)", () => {
    const g = luoiSauHet();
    toChuNhat(g, { latMin: 9.0, latMax: 11.0, lonMin: 110.3, lonMax: 111.1 }, CO.l4);
    const f = truong(BB, () => ({ ...GIO_EM, waveM: 2.6 }));
    const p = planRoute(args({ depth: g, field: f }));
    ghi({ id: "B7", nhom: "B độ sâu", ten: "Sóng vỡ trên nước nông nâng mức nguy", bac: "B", diem: p?.hasRoughLeg && p.hasShallowLeg ? 100 : 0, so: tomTat(p), ghi: "" });
  });
});

describe("C — thời tiết đọc được / không đọc được", () => {
  it("C1 lưới RỖNG (nguồn none): vẫn ra tuyến theo hải đồ, noWeatherKm > 0, weatherSeen=false", () => {
    const o = planRouteWithDiagnostics(args({ field: truongRong(BB) }));
    const p = o.plan;
    const ok = !!p && p.noWeatherKm > p.distKm * 0.5 && !p.weatherSeen && p.maxWaveM === 0;
    ghi({ id: "C1", nhom: "C thời tiết", ten: "Không có dự báo → tuyến theo hải đồ có cờ", bac: "A", diem: ok ? 100 : 0, so: { failure: o.failure, ...tomTat(p) }, ghi: "UI không được in 'sóng 0 m'" });
  });

  it("C2 lưới THỦNG một mảng giữa biển: ra tuyến, noWeatherKm ≈ phần thủng, phần còn lại có số", () => {
    const f = truong(BB, (lat, lon) => (Math.abs(lon - GIUA.lon) < 0.2 ? null : GIO_EM));
    const o = planRouteWithDiagnostics(args({ field: f }));
    const p = o.plan;
    const ok = !!p && p.weatherSeen && p.noWeatherKm > 10 && p.noWeatherKm < 90;
    ghi({ id: "C2", nhom: "C thời tiết", ten: "Lưới thủng một phần → đếm đúng quãng mù", bac: "B", diem: ok ? 100 : 0, so: { failure: o.failure, ...tomTat(p) }, ghi: "phần thủng rộng ~0,4° ≈ 44 km, nội suy song tuyến nở thêm" });
  });

  it("C3 lưới offline 'grid' (thô, không dòng chảy) → cờ nguồn đi ra tới kết quả tuyến", () => {
    const f = truong(BB, () => GIO_EM, 4, 72, { source: "grid", savedAt: Date.now() - 36e5 });
    const p = planRoute(args({ field: f })) as (RoutePlan & { fieldSource?: string }) | null;
    const mang = p != null && "fieldSource" in p;
    ghi({ id: "C3", nhom: "C thời tiết", ten: "RoutePlan tự mang nguồn dự báo đã dùng", bac: "C", diem: mang ? 100 : 0, dat: mang,
      so: { coTuyen: !!p, mangNguon: mang }, ghi: "hiện UI tự nhớ chosenField; tuyến đã LƯU mất dấu 'tính bằng lưới cũ' — tuyến lưu phải nói thật tuổi dữ liệu" });
  });

  it("C4 chạy quá cửa sổ dự báo (24 giờ số, chuyến ~12 giờ, xuất phát giờ 20) → beyondForecastH > 0", () => {
    const f = truong(BB, () => GIO_EM, 10, 24);
    const p = planRoute(args({ field: f, departHourIdx: 20 }));
    ghi({ id: "C4", nhom: "C thời tiết", ten: "Báo phần đuôi tuyến quá cửa sổ dự báo", bac: "B", diem: p && p.beyondForecastH >= 6 ? 100 : 0, so: tomTat(p), ghi: "" });
  });

  it("C5 sóng null nhưng gió 45 km/h → ước sóng từ gió, tàu chậm lại (không coi 0 = êm)", () => {
    const f = truong(BB, () => ({ ...GIO_EM, waveM: null, windKmh: 45, windFromDeg: 90 }));
    const p = planRoute(args({ field: f }));
    const pEm = planRoute(args());
    const chamHon = !!p && !!pEm && p.hours > pEm.hours * 1.08;
    ghi({ id: "C5", nhom: "C thời tiết", ten: "Thiếu số sóng → ước từ gió", bac: "B", diem: chamHon && (p?.maxWaveM ?? 0) > 0.5 ? 100 : 0,
      so: { gioEm: pEm?.hours, gioGio: p?.hours, uocSong: estimateWaveFromWind(45), maxWave: p?.maxWaveM }, ghi: "" });
  });

  it("C6 dự báo đổi theo giờ: dải sóng 4 m chỉ từ giờ 6–12 — xuất phát giờ 0 đi thẳng, giờ 6 phải né", () => {
    const f = truong(BB, (lat, lon, h) => (Math.abs(lon - GIUA.lon) < 0.2 && lat > 9.6 && h >= 6 && h < 12 ? { ...GIO_EM, waveM: 4.5 } : GIO_EM));
    // 7 kn ≈ 13 km/h: tới GIUA (~77 km) sau ~6 giờ ⇒ xuất phát giờ 0 chạm dải đúng lúc nó dâng
    const p0 = planRoute(args({ field: f, departHourIdx: 0 }));
    const p13 = planRoute(args({ field: f, departHourIdx: 13 }));
    const vong0 = p0 ? p0.distKm / haversineKm(A, B) : 0;
    const vong13 = p13 ? p13.distKm / haversineKm(A, B) : 0;
    const ok = !!p0 && !!p13 && vong13 < 1.02 && vong0 > 1.03 && p0.maxWaveM < 4;
    ghi({ id: "C6", nhom: "C thời tiết", ten: "Chi phí theo GIỜ ĐẾN, không theo giờ xuất phát", bac: "B", diem: ok ? 100 : 0,
      so: { vong0: Math.round(vong0 * 100) / 100, vong13: Math.round(vong13 * 100) / 100, maxWave0: p0?.maxWaveM, maxWave13: p13?.maxWaveM }, ghi: "" });
  });

  it("C7 không còn đường sạch (toàn vùng 4,2 m) → best-effort có cờ bestEffortSeas, không null", () => {
    const f = truong(BB, () => ({ ...GIO_EM, waveM: 4.2 }));
    const o = planRouteWithDiagnostics(args({ field: f }));
    ghi({ id: "C7", nhom: "C thời tiết", ten: "Biển quá động → 'đường ít dữ nhất' có cờ đỏ", bac: "B", diem: o.plan?.bestEffortSeas ? 100 : 0, so: { failure: o.failure, ...tomTat(o.plan) }, ghi: "" });
  });
});

describe("D — mô hình tàu · tốc độ · dầu", () => {
  it("D1 Kwon: sóng mũi 2 m giảm tốc 15 %, sóng đuôi ~2 %", () => {
    const mui = speedFactor(2, waveDirFactor(90, 90)), duoi = speedFactor(2, waveDirFactor(270, 90));
    const ok = Math.abs(mui - 0.85) < 0.01 && duoi > 0.97;
    ghi({ id: "D1", nhom: "D mô hình tàu", ten: "Giảm tốc theo hướng sóng (Kwon 4 bậc)", bac: "B", diem: ok ? 100 : 0, so: { mui, duoi }, ghi: "" });
  });

  it("D2 dòng chảy 2 km/h xuôi/ngược đổi giờ chạy đúng chiều; ngang không cộng thẳng", () => {
    const h = { currentKmh: 2, currentToDeg: 90 };
    const doc = currentAlongKmh(h, 90), nguoc = currentAlongKmh(h, 270), ngang = currentCrossKmh(h, 0);
    const pX = planRoute(args({ field: truong(BB, () => ({ ...GIO_EM, currentKmh: 2, currentToDeg: 90 })) }));
    const pN = planRoute(args({ field: truong(BB, () => ({ ...GIO_EM, currentKmh: 2, currentToDeg: 270 })) }));
    const ok = doc === 2 && nguoc === -2 && Math.abs(ngang) === 2 && !!pX && !!pN && pN.hours > pX.hours * 1.2;
    ghi({ id: "D2", nhom: "D mô hình tàu", ten: "Dòng chảy cộng vector (VISIR-2)", bac: "B", diem: ok ? 100 : 0, so: { doc, nguoc, ngang, gioXuoi: pX?.hours, gioNguoc: pN?.hours }, ghi: "" });
  });

  it("D3 trần đường vòng 1,3 + chênh dầu có dấu", () => {
    const f = truong(BB, (lat, lon) => (Math.abs(lon - GIUA.lon) < 0.3 && lat > 9.3 ? { ...GIO_EM, waveM: 3.2 } : GIO_EM));
    const p = planRoute(args({ field: f }));
    const ti = p ? p.distKm / haversineKm(A, B) : 0;
    const ok = !!p && (p.cappedToDirect || ti <= 1.3) && p.fuelDeltaL != null;
    ghi({ id: "D3", nhom: "D mô hình tàu", ten: "Không bán đường vòng > 30 %", bac: "B", diem: ok ? 100 : 0, so: { tiLe: Math.round(ti * 100) / 100, capped: p?.cappedToDirect, fuelDelta: p?.fuelDeltaL }, ghi: "" });
  });

  it("D4 oracle lưới mịn: chênh dầu Dijkstra 4 km vs lưới 1 km ≤ 5 %", () => {
    ghi({ id: "D4", nhom: "D mô hình tàu", ten: "Sai số rời rạc hoá lưới (oracle lưới mịn)", bac: "C", diem: 0, dat: false, trangThai: "chua-do",
      so: {}, ghi: "cần scripts/dan-duong/oracle-luoi-min.ts: cùng legCost, MAX_NODES nới, chạy trên GPU/PC — không chạy trên điện thoại" });
  });

  it("D5 oracle (nút, khung giờ): chênh dầu so Dijkstra một nhãn ≤ 5 % trên bộ 18 tuyến × 3 mùa", () => {
    ghi({ id: "D5", nhom: "D mô hình tàu", ten: "Sai số một-nhãn/nút (ADR 0003 — xét lại khi có số)", bac: "C", diem: 0, dat: false, trangThai: "chua-do",
      so: {}, ghi: "cần oracle time-expanded + lưới thời tiết THẬT lưu lại (routegrid snapshot) — việc GPU" });
  });

  it("D6 hồ sơ tàu đủ cho dẫn đường: tốc độ, lít/giờ, mớn, chiều dài, két dầu — một nguồn", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/lib/route-plan.ts"), "utf8");
    const coKet = /fuelTankL|ketDauL|tankL/.test(src);
    const coDai = /lengthM/.test(src);
    ghi({ id: "D6", nhom: "D mô hình tàu", ten: "BoatProfile có két dầu + chiều dài", bac: "C", diem: coKet && coDai ? 100 : coKet || coDai ? 50 : 0, dat: coKet && coDai,
      so: { coKetDau: coKet, coChieuDai: coDai }, ghi: "forfish.boat.v1 tách rời hồ sơ tàu boats.ts; không có két ⇒ không kiểm 'đủ dầu đi về'" });
  });
});

describe("E — waypoint & hình học", () => {
  const p = planRoute(args({ field: truong(BB, (lat, lon) => (Math.abs(lon - GIUA.lon) < 0.15 && lat > 9.7 ? { ...GIO_EM, waveM: 3.3 } : GIO_EM)) }));
  it("E1 không waypoint thừa (góc rẽ < 3°) và không zigzag (góc > 120°)", () => {
    const g = p ? gocRe(p.waypoints) : [];
    const thua = g.filter((x) => x < 3).length, gay = g.filter((x) => x > 120).length;
    ghi({ id: "E1", nhom: "E waypoint", ten: "Waypoint sạch: không thừa, không gãy", bac: "B", diem: p ? Math.max(0, 100 - 25 * thua - 50 * gay) : 0, so: { wp: p?.waypoints.length, thua, gay, goc: g.map((x) => Math.round(x)) }, ghi: "" });
  });
  it("E2 hoursAt cùng độ dài, tăng đơn điệu, cuối = hours", () => {
    const ok = !!p && p.hoursAt.length === p.waypoints.length && p.hoursAt.every((h, i) => i === 0 || h >= p.hoursAt[i - 1]) && Math.abs(p.hoursAt.at(-1)! - p.hours) < 1e-6;
    ghi({ id: "E2", nhom: "E waypoint", ten: "Giờ cộng dồn tới từng điểm nhất quán", bac: "B", diem: ok ? 100 : 0, so: { n: p?.hoursAt.length, wp: p?.waypoints.length }, ghi: "" });
  });
  it("E3 bảng điểm cho máy định vị: số liền mạch, km/giờ từng điểm", () => {
    const rows = p ? routePointRows(p.waypoints, [p.waypoints.length - 1], p.hoursAt) : [];
    const turns = rows.filter((r) => r.kind === "turn").map((r) => r.turnNo);
    const ok = rows.length > 0 && turns.every((t, i) => t === i + 1) && rows.every((r) => r.hours != null);
    ghi({ id: "E3", nhom: "E waypoint", ten: "Danh sách điểm đọc được sang máy định vị", bac: "C", diem: ok ? 100 : 0, so: { rows: rows.length, turns: turns.length }, ghi: "" });
  });
  it("E4 chặng ngắn nhất ≥ 1 km (trừ hai đầu) — tránh điểm rẽ dính nhau", () => {
    const legs = p ? p.waypoints.slice(1).map((w, i) => haversineKm(p.waypoints[i], w)) : [];
    const ngan = legs.slice(1, -1).filter((l) => l < 1).length;
    ghi({ id: "E4", nhom: "E waypoint", ten: "Không có chặng vụn < 1 km", bac: "C", diem: p ? (ngan === 0 ? 100 : 0) : 0, so: { ngan, legs: legs.map((l) => Math.round(l)) }, ghi: "" });
  });
  it("E5 góc rẽ tối đa trong vùng tàu cá quay được (≤ 90° mỗi điểm)", () => {
    const g = p ? gocRe(p.waypoints) : [];
    const max = g.length ? Math.max(...g) : 0;
    ghi({ id: "E5", nhom: "E waypoint", ten: "Góc rẽ ≤ 90°", bac: "C", diem: p ? diemTuyenTinh(max, 90, 150) : 0, so: { maxGoc: Math.round(max) }, ghi: "" });
  });
});

describe("F — dẫn đường trực tiếp", () => {
  const wps: LatLon[] = [{ lat: 10, lon: 110 }, { lat: 10, lon: 110.5 }, { lat: 10.3, lon: 110.9 }, { lat: 10.3, lon: 111.4 }];
  it("F1 còn 0,3 km tới đích → arrived; còn 0,6 km → chưa", () => {
    const gan = computeNavProgress({ pos: { lat: 10.3, lon: 111.4 - 0.3 / (111.32 * Math.cos(10.3 * Math.PI / 180)) }, headingDeg: 90, speedKmh: 12, waypoints: wps });
    const xa = computeNavProgress({ pos: { lat: 10.3, lon: 111.4 - 0.6 / (111.32 * Math.cos(10.3 * Math.PI / 180)) }, headingDeg: 90, speedKmh: 12, waypoints: wps });
    ghi({ id: "F1", nhom: "F dẫn đường", ten: "Bán kính tới đích 0,4 km", bac: "B", diem: gan.arrived && !xa.arrived ? 100 : 0, so: { gan: gan.arrived, xa: xa.arrived }, ghi: "" });
  });
  it("F2 vượt qua khúc rẽ (pass-by) → nextWp tiến; đi tắt bỏ qua điểm đã vượt", () => {
    const truoc = computeNavProgress({ pos: { lat: 10.0, lon: 110.49 }, headingDeg: 90, speedKmh: 12, waypoints: wps });
    const sau = computeNavProgress({ pos: { lat: 10.02, lon: 110.53 }, headingDeg: 50, speedKmh: 12, waypoints: wps });
    const tat = computeNavProgress({ pos: { lat: 10.25, lon: 110.95 }, headingDeg: 90, speedKmh: 12, waypoints: wps });
    const ok = truoc.nextWp === wps[1] && sau.nextWp === wps[2] && tat.nextWp === wps[3];
    ghi({ id: "F2", nhom: "F dẫn đường", ten: "Pass-by khúc rẽ + đi tắt", bac: "B", diem: ok ? 100 : 0, so: { truoc: wps.indexOf(truoc.nextWp), sau: wps.indexOf(sau.nextWp), tat: wps.indexOf(tat.nextWp) }, ghi: "" });
  });
  it("F3 lệch tuyến có DẤU trái/phải (XTE ký hiệu) để nói 'lái sang phải 1,2 km'", () => {
    const pr = projectOntoRoute({ lat: 10.02, lon: 110.25 }, wps) as { offRouteKm: number; side?: string; signedKm?: number };
    const coDau = "side" in pr || "signedKm" in pr;
    ghi({ id: "F3", nhom: "F dẫn đường", ten: "XTE có dấu", bac: "B", diem: coDau ? 100 : 0, dat: coDau, so: { offRouteKm: Math.round(pr.offRouteKm * 100) / 100, coDau }, ghi: "steerCue chỉ so hướng tới nextWp, không biết tàu đang ở bên nào của vạch" });
  });
  it("F4 tuyến gập (hairpin) — đứng giữa hai nhánh cách 1 km không nhảy sang nhánh về", () => {
    const gap: LatLon[] = [{ lat: 10, lon: 110 }, { lat: 10, lon: 110.6 }, { lat: 10.009, lon: 110.6 }, { lat: 10.009, lon: 110 }];
    const pr = projectOntoRoute({ lat: 10.0046, lon: 110.2 }, gap); // sát nhánh đi (lệch 0,5 km) nhưng cũng cách nhánh về 0,5 km
    const prRoiXa = projectOntoRoute({ lat: 10.006, lon: 110.2 }, gap); // gần nhánh về hơn một chút
    ghi({ id: "F4", nhom: "F dẫn đường", ten: "Chiếu tuyến có trễ/ưu tiên đoạn hiện tại", bac: "C", diem: pr.segIdx === 0 && prRoiXa.segIdx === 0 ? 100 : 0, dat: pr.segIdx === 0 && prRoiXa.segIdx === 0,
      so: { seg: pr.segIdx, segRoiXa: prRoiXa.segIdx }, ghi: "projectOntoRoute không nhớ đoạn trước ⇒ tuyến vòng về gần chính nó là nhảy đoạn, 'còn X km' tụt đột ngột" });
  });
  it("F5 có hàm THUẦN lọc tốc độ/hướng GPS (fix dịch 5 m/1 s không được ra 18 km/h)", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/lib/use-nav-tracking.ts"), "utf8");
    const coThuan = /export function (locFix|suyTocDo|smoothSpeed|filterFix|locGps)/.test(src);
    ghi({ id: "F5", nhom: "F dẫn đường", ten: "Lọc nhiễu tốc độ/hướng tách thành hàm thuần có test", bac: "B", diem: coThuan ? 100 : 0, dat: coThuan,
      so: { coThuan }, ghi: "onFix nằm trong hook React, không test được; tốc độ suy từ 2 fix không có ngưỡng quãng; heading GPS nhận cả khi speed null" });
  });
  it("F6 ETA làm mượt (trung vị/EMA 60 s) thay vì tốc độ tức thời", () => {
    const e = etaHours(26, 13);
    const src = fs.readFileSync(path.join(ROOT, "src/lib/nav-progress.ts"), "utf8");
    const coMuot = /export function (etaMuot|smoothEta|tocDoMuot|smoothSpeed)/.test(src);
    ghi({ id: "F6", nhom: "F dẫn đường", ten: "ETA mượt", bac: "C", diem: coMuot ? 100 : 0, dat: coMuot, so: { etaGio: e, coMuot }, ghi: "ETA nhảy theo từng fix khi sóng làm tốc độ GPS dao động" });
  });
  it("F7 ngưỡng cảnh báo theo tốc độ + sai số GPS; >150 m hạ mức", () => {
    const [v7, d7] = navThresholdsKm(13, 20), [v20] = navThresholdsKm(37, 20), [vAcc] = navThresholdsKm(13, 300);
    const ok = v7 > 2 && d7 >= 0.5 && v20 > v7 && vAcc > v7;
    ghi({ id: "F7", nhom: "F dẫn đường", ten: "Ngưỡng hiểm hoạ live theo tốc độ + GPS", bac: "B", diem: ok ? 100 : 0, so: { v7, d7, v20, vAcc }, ghi: "" });
  });
  it("F8 mất GPS: 10 s khi chạy, 60 s khi đứng", () => {
    const ok = fixQuaCu(0, 12, 10_001) && !fixQuaCu(0, 12, 9_000) && !fixQuaCu(0, null, 50_000) && fixQuaCu(0, null, 61_000);
    ghi({ id: "F8", nhom: "F dẫn đường", ten: "Phát hiện mất định vị đúng ngưỡng", bac: "B", diem: ok ? 100 : 0, so: {}, ghi: "" });
  });
  it("F9 dead-reckoning ngắn khi mất GPS (≤ 2 phút theo hướng + tốc độ cuối)", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/lib/nav-progress.ts"), "utf8") + fs.readFileSync(path.join(ROOT, "src/lib/use-nav-tracking.ts"), "utf8");
    const co = /deadReckon|uocViTri|suyViTri/.test(src);
    ghi({ id: "F9", nhom: "F dẫn đường", ten: "Ước vị trí ngắn hạn khi mất GPS", bac: "C", diem: co ? 100 : 0, dat: co, so: { co }, ghi: "hiện tàu đứng yên ở fix cuối, cảnh báo hiểm hoạ phía trước ngừng cập nhật" });
  });
  it("F10 giọng đọc có lệnh rẽ trước khúc rẽ (≥ 1 phút chạy)", () => {
    const dir = path.join(ROOT, "src/lib/nav-voice");
    const txt = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
    const co = /nextWp|bearingToNext|sapRe|khucRe/.test(txt);
    ghi({ id: "F10", nhom: "F dẫn đường", ten: "Đọc 'sắp rẽ trái/phải' trước khúc rẽ", bac: "C", diem: co ? 100 : 0, dat: co, so: { co }, ghi: "nav-voice không đọc steer/nextWp/eta" });
  });
});

describe("G — cờ trung thực", () => {
  it("G1 hazards null → hazardChecked=false; depth null → depthChecked=false", () => {
    const p = planRoute(args({ depth: null }));
    const ok = !!p && !p.hazardChecked && !p.depthChecked;
    ghi({ id: "G1", nhom: "G trung thực", ten: "Chưa soi ≠ đã soi và sạch", bac: "A", diem: ok ? 100 : 0, so: tomTat(p), ghi: "" });
  });
  it("G2 gói hiểm hoạ méo → hazardChecked=false", () => {
    const hz = goi([vat("x", GIUA, 0.5)]);
    const meo = { ...hz, lat: new Float64Array(0) };
    const p = planRoute(args({ hazards: meo }));
    ghi({ id: "G2", nhom: "G trung thực", ten: "Gói méo không giả vờ đã đối chiếu", bac: "A", diem: p && !p.hazardChecked ? 100 : 0, so: tomTat(p), ghi: "" });
  });
  it("G3 legRisk ưu tiên đúng: vật chặn > rất cạn > sát bờ > sóng", () => {
    const p = planRoute(args())!;
    const r1 = legRisk({ ...p, hasHazardLeg: true, hasVeryShallowLeg: true, maxWaveM: 3.5 }).risk;
    const r2 = legRisk({ ...p, hasShallowLeg: true, maxWaveM: 2.2 }).risk;
    const r3 = legRisk(p).risk;
    ghi({ id: "G3", nhom: "G trung thực", ten: "Mức chặng đúng thứ tự", bac: "B", diem: r1 === "red" && r2 === "amber" && r3 === "blue" ? 100 : 0, so: { r1, r2, r3 }, ghi: "" });
  });
  it("G4 sát cảng: đất trong 5 km → đi được nhưng cắm cờ nearLand + nearPortOnly", () => {
    const g = luoiSauHet();
    toTron(g, A, 2, CO.cl); // "cảng" nằm trong đất
    const p = planRoute(args({ depth: g }));
    ghi({ id: "G4", nhom: "G trung thực", ten: "Nới cho đi, không nới cho im", bac: "A", diem: p?.hasNearLandLeg && p.nearPortOnly ? 100 : 0, so: tomTat(p), ghi: "" });
  });
});

describe("H — hiệu năng + hồi quy tuyến thật", () => {
  const TUYEN: [string, LatLon, LatLon, number | null][] = [
    ["Rạch Giá → nam Côn Đảo (mớn 1,2)", { lat: 10.02, lon: 105.08 }, { lat: 8.55, lon: 106.6 }, 1.2],
    ["Vũng Tàu → Côn Đảo", { lat: 10.33, lon: 107.08 }, { lat: 8.68, lon: 106.62 }, null],
    ["Quy Nhơn → khơi NTB", { lat: 13.77, lon: 109.25 }, { lat: 13.5, lon: 110.5 }, null],
    ["Nha Trang → Trường Sa Lớn", { lat: 12.2, lon: 109.25 }, { lat: 8.64, lon: 111.92 }, null],
    ["Cà Mau → Phú Quốc", { lat: 8.6, lon: 104.75 }, { lat: 10.2, lon: 103.95 }, null],
    ["Thọ Quang → đông Sơn Trà", { lat: 16.12, lon: 108.22 }, { lat: 16.2, lon: 109.0 }, null],
    ["Sa Kỳ → Lý Sơn", { lat: 15.22, lon: 108.9 }, { lat: 15.38, lon: 109.1 }, null],
    ["Phan Thiết → Phú Quý", { lat: 10.92, lon: 108.1 }, { lat: 10.52, lon: 108.93 }, null],
    ["Hải Phòng → Bạch Long Vĩ", { lat: 20.75, lon: 106.78 }, { lat: 20.13, lon: 107.73 }, null],
    ["Cửa Lò → khơi", { lat: 18.8, lon: 105.72 }, { lat: 18.5, lon: 107.0 }, null],
    ["Hòn Rớ → khơi đông", { lat: 12.2, lon: 109.2 }, { lat: 12.0, lon: 110.5 }, null],
    ["Rạch Giá → Phú Quốc", { lat: 10.02, lon: 105.08 }, { lat: 10.2, lon: 103.95 }, 1.2],
  ];
  const VN = { latMin: 4, latMax: 24.5, lonMin: 99, lonMax: 119 };
  const clamp = (b: typeof VN) => ({ latMin: Math.max(VN.latMin, b.latMin), latMax: Math.min(VN.latMax, b.latMax), lonMin: Math.max(VN.lonMin, b.lonMin), lonMax: Math.min(VN.lonMax, b.lonMax) });
  const rd = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, "public/data", f), "utf8"));
  const kho = buildHazardList({ xacTau: decodeXacTau(rd("xac-tau.v1.json")), laneFeatures: rd("vn-sea-lanes.v1.json").features, seamarks: decodeSeamarks(rd("seamarks.v1.json")) }, null, 2026);
  const depth = luoiThat();
  const ketQua: { ten: string; ms: number; ok: boolean; tiLe: number; landFar: boolean; p: RoutePlan | null }[] = [];
  for (const [ten, a, b, draftM] of TUYEN) {
    const dist = haversineKm(a, b);
    let plan: RoutePlan | null = null;
    const t0 = performance.now();
    for (const m of [Math.min(150, Math.max(45, dist * 0.3)), Math.min(420, Math.max(200, dist * 1.1))]) {
      const bbox = clamp(khung([a, b], m));
      plan = planRouteWithDiagnostics({ start: a, dest: b, boat: { ...TAU_7KN, draftM }, departHourIdx: 6, field: truong(bbox, () => GIO_EM, 8), depth, bbox, hazards: packHazards(hazardsInBBox(kho.hazards, bbox, 0)), noGo: kho.noGo }).plan;
      if (plan) break;
    }
    const ms = performance.now() - t0;
    // đất ngoài vòng nới: mẫu lớp 0 cách cả hai đầu > 12 km
    const landFar = !!plan && mauDocTuyen(plan.waypoints, 0.3).some((m) => {
      const i = Math.round((m.lat - 5 - 1 / 480) * 240), j = Math.round((m.lon - 102 - 1 / 480) * 240);
      const k = i * 3841 + j; const cls = (depth.data[k >> 1] >> ((k & 1) * 4)) & 15;
      return cls === 0 && haversineKm(m, a) > 12 && haversineKm(m, b) > 12;
    });
    ketQua.push({ ten, ms, ok: !!plan, tiLe: plan ? plan.distKm / dist : 0, landFar, p: plan });
  }
  it("H1 12 tuyến thật từ cảng đều ra tuyến", () => {
    const n = ketQua.filter((k) => k.ok).length;
    ghi({ id: "H1", nhom: "H tuyến thật", ten: "Ra tuyến cho mọi cảng thử", bac: "A", diem: Math.round((100 * n) / ketQua.length), so: Object.fromEntries(ketQua.map((k) => [k.ten, k.ok])), ghi: "" });
  });
  it("H2 không tuyến thật nào đè đất ngoài 12 km hai đầu", () => {
    const hong = ketQua.filter((k) => k.landFar).map((k) => k.ten);
    ghi({ id: "H2", nhom: "H tuyến thật", ten: "Tuyến thật không xuyên đảo/bán đảo", bac: "A", diem: hong.length ? 0 : 100, so: { hong }, ghi: "" });
  });
  it("H3 tỉ lệ vòng so chim bay ≤ 1,3 (trừ ca vòng mũi đất có cờ)", () => {
    const vuot = ketQua.filter((k) => k.ok && k.tiLe > 1.3 && !k.p?.hasNearLandLeg).map((k) => `${k.ten} ×${k.tiLe.toFixed(2)}`);
    ghi({ id: "H3", nhom: "H tuyến thật", ten: "Đường vòng hợp lý trên tuyến thật", bac: "B", diem: vuot.length === 0 ? 100 : Math.max(0, 100 - 25 * vuot.length), so: { vuot, tiLe: Object.fromEntries(ketQua.map((k) => [k.ten, Math.round(k.tiLe * 100) / 100])) }, ghi: "" });
  });
  it("H4 thời gian tính trung vị ≤ 300 ms (Node máy dev; máy yếu ×3–4)", () => {
    const ms = ketQua.map((k) => k.ms).sort((x, y) => x - y);
    const med = ms[ms.length >> 1];
    ghi({ id: "H4", nhom: "H tuyến thật", ten: "Hiệu năng một lượt tính", bac: "B", diem: diemTuyenTinh(med, 300, 1500), so: { trungViMs: Math.round(med), maxMs: Math.round(ms.at(-1)!) }, ghi: "" });
  });
  it("H5 có bộ tuyến thật kèm NHÃN kỳ vọng do người đi biển duyệt (oracle nghiệp vụ)", () => {
    const co = fs.existsSync(path.join(ROOT, "scripts/dan-duong/tuyen-chuan.json"));
    ghi({ id: "H5", nhom: "H tuyến thật", ten: "Bộ tuyến chuẩn có nhãn người duyệt", bac: "B", diem: co ? 100 : 0, dat: co, trangThai: co ? "do" : "chua-do", so: { co }, ghi: "cần anh Long / thuyền trưởng duyệt 10–20 tuyến quen: vẽ tay → so Fréchet/Hausdorff với tuyến máy" });
  });
});

afterAll(() => {
  const kq = xuatBang();
  const dong = `\n=== BẢNG ĐIỂM DẪN ĐƯỜNG: đạt ${kq.dat}/${kq.tong} = ${kq.tiLe} % · cổng A hỏng: ${kq.aHong.join(", ") || "không"} · ${kq.quaCong ? "QUA CỔNG" : "CHƯA QUA"} ===\n` +
    bang.map((b) => `${b.dat ? "✅" : b.trangThai === "chua-do" ? "⬜" : "❌"} ${b.id.padEnd(4)} ${String(b.diem).padStart(3)}  ${b.ten}`).join("\n");
  console.log(dong);
});
