/*
  BENCH TÍNH TUYẾN — chọn tham gia bằng `BENCH=1 npm test -- src/lib/__tests__/route-bench.test.ts`.
  Mặc định SKIP (không làm chậm `npm test`). Mục đích: có SỐ NỀN (ms/lượt, tỉ lệ
  so chim bay, cờ) trên LƯỚI ĐỘ SÂU THẬT trước/sau mỗi lần đổi thuật toán —
  claim "không phá ngân sách 3–4 s máy yếu" phải có số, không nói suông.
  Thời tiết dựng GIẢ (biển êm, 72 h) để chỉ đo phần hình học + độ sâu + Dijkstra.

  Đợt 2 (2026-09-04) thêm LỚP HIỂM HOẠ: mỗi tuyến chạy HAI lượt — không kho và
  có kho thật (285 vật + 6 vùng cấm vào, đã lọc theo khung) — để đọc thẳng cái
  giá của lớp mới. Cổng: tổng ms trung vị CÓ kho ≤ +15 % so KHÔNG kho, đo trong
  CÙNG một phiên. Vì sao so trong phiên chứ không so với con số đã in trong tài
  liệu: 3 ms và 31 ms là số của một cái máy một buổi chiều; máy khác, tải khác
  thì lệch vài lần mà chẳng nói gì về lớp mới. Bảng Đợt 0 vẫn in kèm để soi mắt.
*/
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { decodeDepthGrid, type DepthGrid } from "../depth-grid";
import {
  bboxOfPoints,
  planRoute,
  type BBox,
  type HourSample,
  type LatLon,
  type WeatherField,
} from "../route-plan";
import {
  buildHazardList,
  hazardsInBBox,
  packHazards,
  type HazardList,
} from "../hazards";
import { decodeXacTau } from "../xac-tau";
import { decodeSeamarks } from "../seamarks";

const ROOT = path.resolve(__dirname, "../../..");
const VN: BBox = { latMin: 4, latMax: 24.5, lonMin: 99, lonMax: 119 };

function clampBBox(b: BBox): BBox {
  return {
    latMin: Math.max(VN.latMin, b.latMin),
    latMax: Math.min(VN.latMax, b.latMax),
    lonMin: Math.max(VN.lonMin, b.lonMin),
    lonMax: Math.min(VN.lonMax, b.lonMax),
  };
}

function calmField(bbox: BBox, n = 8, hours = 72): WeatherField {
  const dLat = (bbox.latMax - bbox.latMin) / (n - 1);
  const dLon = (bbox.lonMax - bbox.lonMin) / (n - 1);
  const h: HourSample = {
    waveM: 0.5,
    waveFromDeg: 90,
    wavePeriodS: 6,
    windKmh: 12,
    windFromDeg: 90,
    currentKmh: 0,
    currentToDeg: null,
  };
  const cells = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cells.push({ onSea: true, hours: Array.from({ length: hours }, () => h) });
  return { lat0: bbox.latMin, lon0: bbox.lonMin, dLat, dLon, nLat: n, nLon: n, cells };
}

function realDepth(): DepthGrid {
  const raw = fs.readFileSync(path.join(ROOT, "public/data/depth-grid.v1.bin"));
  return decodeDepthGrid(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer);
}

function realHazards(): HazardList {
  const rd = (f: string) => JSON.parse(fs.readFileSync(path.join(ROOT, "public/data", f), "utf8"));
  return buildHazardList(
    {
      xacTau: decodeXacTau(rd("xac-tau.v1.json")),
      laneFeatures: rd("vn-sea-lanes.v1.json").features as GeoJSON.Feature[],
      seamarks: decodeSeamarks(rd("seamarks.v1.json")),
    },
    null,
    2026,
  );
}

/** [tên, đi, tới, mớn nước (null = chưa khai — dải 2–4 m đóng)] */
const ROUTES: [string, LatLon, LatLon, number | null][] = [
  ["Rạch Giá → nam Côn Đảo", { lat: 10.02, lon: 105.08 }, { lat: 8.55, lon: 106.6 }, null],
  ["Rạch Giá → nam CĐ (mớn 1,2)", { lat: 10.02, lon: 105.08 }, { lat: 8.55, lon: 106.6 }, 1.2],
  ["Vũng Tàu → Côn Đảo", { lat: 10.33, lon: 107.08 }, { lat: 8.68, lon: 106.62 }, null],
  ["Quy Nhơn → khơi NTB", { lat: 13.77, lon: 109.25 }, { lat: 13.5, lon: 110.5 }, null],
  ["Nha Trang → Trường Sa Lớn", { lat: 12.2, lon: 109.25 }, { lat: 8.64, lon: 111.92 }, null],
  ["Cà Mau → Phú Quốc", { lat: 8.6, lon: 104.75 }, { lat: 10.2, lon: 103.95 }, null],
];

/** Bảng Đợt 0 (cùng máy, 2026-09-04) — in kèm để soi mắt, KHÔNG dùng làm cổng. */
const D0_MS: Record<string, number> = {
  "Rạch Giá → nam Côn Đảo": 3,
  "Rạch Giá → nam CĐ (mớn 1,2)": 31,
  "Vũng Tàu → Côn Đảo": 7,
  "Quy Nhơn → khơi NTB": 5,
  "Nha Trang → Trường Sa Lớn": 32,
  "Cà Mau → Phú Quốc": 10,
};

const LAN = 5;
const trungVi = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

describe.skipIf(!process.env.BENCH)("BENCH planRoute trên lưới độ sâu thật (BENCH=1)", () => {
  it("in bảng ms · km · tỉ lệ chim bay · cờ cho 6 tuyến, có và không có kho hiểm hoạ", () => {
    const depth = realDepth();
    const kho = realHazards();
    const rows: string[] = [];
    let tongKhong = 0;
    let tongCo = 0;

    for (const [ten, a, b, draftM] of ROUTES) {
      const dKm = Math.hypot((a.lat - b.lat) * 111.32, (a.lon - b.lon) * 111.32 * Math.cos(((a.lat + b.lat) / 2) * Math.PI / 180));
      // hai vòng nới khung y như route-planner.tsx (vòng 2 mới vòng được mũi Cà Mau)
      const margins = [Math.min(150, Math.max(45, dKm * 0.3)), Math.min(420, Math.max(200, dKm * 1.1))];

      /** một lượt tính đủ hai vòng margin; trả [plan, vòng, số vật trong khung] */
      const mot = (coKho: boolean) => {
        let plan = null;
        let vong = 0;
        let vat = 0;
        for (const margin of margins) {
          vong++;
          const bbox = clampBBox(bboxOfPoints([a, b], margin));
          const trongKhung = coKho ? hazardsInBBox(kho.hazards, bbox, 0) : [];
          vat = trongKhung.length;
          plan = planRoute({
            start: a,
            dest: b,
            boat: { speedKn: 7, litersPerHour: 20, draftM },
            departHourIdx: 6,
            field: calmField(bbox),
            depth,
            bbox,
            hazards: coKho ? packHazards(trongKhung) : null,
            noGo: coKho ? kho.noGo : null,
          });
          if (plan) break;
        }
        return { plan, vong, vat };
      };

      const do_ = (coKho: boolean) => {
        const ms: number[] = [];
        let cuoi = mot(coKho);
        for (let i = 0; i < LAN; i++) {
          const t0 = performance.now();
          cuoi = mot(coKho);
          ms.push(performance.now() - t0);
        }
        return { ms: trungVi(ms), ...cuoi };
      };

      const khong = do_(false);
      const co = do_(true);
      tongKhong += khong.ms;
      tongCo += co.ms;

      const nhan = `${ten} (vòng ${co.vong})`;
      if (!co.plan) {
        rows.push(`${nhan.padEnd(34)} ${co.ms.toFixed(0).padStart(5)} ms  KHÔNG TÌM ĐƯỢC`);
        continue;
      }
      const p = co.plan;
      const cờ = [
        p.hasVeryShallowLeg && "rấtCạn",
        p.hasDraftShallowLeg && "cạnMớn",
        p.hasShallowLeg && "nông",
        p.hasNearLandLeg && "sátBờ",
        p.hasHazardNearPortLeg && "vậtSátCảng",
        p.hasHazardLeg && "VẬTCHẶN",
        p.cappedToDirect && "trầnVòng",
        !p.depthChecked && "!depth",
      ]
        .filter(Boolean)
        .join(",");
      const km0 = khong.plan ? khong.plan.distKm : NaN;
      rows.push(
        `${nhan.padEnd(34)} ${khong.ms.toFixed(0).padStart(4)}→${co.ms.toFixed(0).padStart(4)} ms` +
          `  (Đợt0 ${String(D0_MS[ten] ?? "?").padStart(3)})  ${String(co.vat).padStart(3)} vật` +
          `  ${p.distKm.toFixed(0).padStart(4)} km (nền ${km0.toFixed(0)})  ×${(p.distKm / dKm).toFixed(2)} chim bay` +
          `  ${String(p.waypoints.length).padStart(3)} wp  ${p.hours.toFixed(1)} h  ${cờ || "-"}` +
          `  nearPortOnly=${p.nearPortOnly ? "có" : "không"}`,
      );
      expect(p.waypoints.length).toBeGreaterThan(1);
    }

    const tiLe = tongKhong > 0 ? tongCo / tongKhong : 1;
    const bang =
      "=== BENCH planRoute (biển êm giả, độ sâu thật, ms = trung vị 5 lượt) ===\n" +
      rows.join("\n") +
      `\nTỔNG ms trung vị: không kho ${tongKhong.toFixed(0)} → có kho ${tongCo.toFixed(0)} (×${tiLe.toFixed(2)})\n`;
    console.log("\n" + bang);
    // file bọc vitest không in stdout → ghi thêm ra file tạm để đọc được
    fs.writeFileSync(path.join(os.tmpdir(), "sdfish-route-bench.txt"), bang, "utf8");

    // CỔNG ĐO Đợt 2: lớp hiểm hoạ không được đội quá 15 % thời gian tính
    expect(tiLe).toBeLessThanOrEqual(1.15);
  });
});
