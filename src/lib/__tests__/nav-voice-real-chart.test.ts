import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/*
  NGHIỆM THU TRÊN HẢI ĐỒ THẬT (doc 15 §16, VM-23..VM-25).

  Chủ dự án 2026-10-13: "lưới độ sâu, rạn các kiểu, hải đồ là quan trọng nhất
  trong việc đọc lên và cảnh báo". Bài này KHÔNG dùng thế giới giả: nạp đúng
  các file trong public/data (lưới độ sâu 8,5 MB, xác tàu, giàn khoan, phao nhà
  nước + OSM, đèn biển) như app nạp lúc mất sóng, cho tàu chạy thẳng vào từng
  vật cản THẬT và nghe xem máy đọc gì. Không gọi mạng lần nào.
*/

import { buildNavContext, phaoKeTiep, cableKmAt, restrictedAt, type NavContext } from "@/lib/nav-context";
import { decodeVungQuanLy } from "@/lib/vung-quan-ly";
import { decodeXacTau } from "@/lib/xac-tau";
import { decodeSeamarks } from "@/lib/seamarks";
import { decodeVnAids } from "@/lib/vn-aids";
import { decodeDenBien } from "@/lib/den-bien";
import { decodeKhuTruBao } from "@/lib/khu-tru-bao";
import { decodeDepthGrid, depthClassAt, type DepthGrid } from "@/lib/depth-grid";
import { requiredDepthM } from "@/lib/hazards";
import { evaluateNavHazards, initNavHazardState } from "@/lib/nav-hazards";
import { fmtDist } from "@/lib/map-prefs";
import { bearingDeg, haversineKm } from "@/lib/route-plan";
import { announce, finished, initAnnouncer, pump, type AnnounceResult, type AnnouncerState } from "@/lib/nav-voice/announcer";
import { collectVoiceEvents, initVoiceMemory } from "@/lib/nav-voice/events";
import { speechIsClean, wordCount } from "@/lib/nav-voice/phrases";

const DATA = join(process.cwd(), "public", "data");
const readJson = (f: string) => JSON.parse(readFileSync(join(DATA, f), "utf8"));
const raw = new Uint8Array(readFileSync(join(DATA, "depth-grid.v1.bin")));
const GRID: DepthGrid = decodeDepthGrid(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer);

const fetchSpy = typeof globalThis.fetch === "function" ? vi.spyOn(globalThis, "fetch") : null;

const NEED = requiredDepthM(2.2, null); // tàu khai mớn 2,2 m
const CTX: NavContext = buildNavContext(
  {
    xacTau: decodeXacTau(readJson("xac-tau.v1.json")),
    laneFeatures: readJson("vn-sea-lanes.v1.json").features as GeoJSON.Feature[],
    seamarks: decodeSeamarks(readJson("seamarks.v1.json")),
    vnAids: decodeVnAids(readJson("vn-aids.v1.json")),
    denBien: decodeDenBien(readJson("den-bien.v1.json")),
    khuTruBao: decodeKhuTruBao(readJson("khu-tru-bao.v1.json")),
    vungQuanLy: decodeVungQuanLy(readJson("vung-quan-ly.v1.json")),
  },
  NEED,
  2026,
);
const fmt = (km: number) => fmtDist(km, "nm", km < 10 ? 1 : 0);
const depthAt = (la: number, lo: number) => depthClassAt(GRID, la, lo);

const KM_PER_DEG = (Math.PI / 180) * 6371;
function offset(p: { lat: number; lon: number }, northKm: number) {
  return { lat: p.lat + northKm / KM_PER_DEG, lon: p.lon };
}

type Line = { t: number; text: string; group: string; tier: string };

/** Chạy tàu 7 hải lý/giờ thẳng về BẮC từ `from` tới `to`, thu mọi câu ra loa. */
function cruiseReal(from: { lat: number; lon: number }, to: { lat: number; lon: number }) {
  const speed = 13;
  const fixMs = 2000;
  const totalKm = haversineKm(from, to);
  const hdg = bearingDeg(from, to);
  let hz = initNavHazardState();
  let mem = initVoiceMemory();
  let st: AnnouncerState = initAnnouncer();
  const log: Line[] = [];
  let endAt: number | null = null;
  let waitUntil: number | null = null;
  const handle = (r: AnnounceResult, t: number) => {
    st = r.state;
    if (r.start) {
      log.push({ t, text: r.start.text, group: r.start.group, tier: r.start.tier });
      endAt = t + wordCount(r.start.text) * 350;
    } else if (r.waitMs != null) waitUntil = t + r.waitMs;
  };
  const advance = (t: number) => {
    for (let g = 0; g < 20; g++) {
      if (endAt != null && t >= endAt) {
        const e = endAt;
        endAt = null;
        handle(finished(st, e), e);
      } else if (endAt == null && waitUntil != null && t >= waitUntil) {
        const w = waitUntil;
        waitUntil = null;
        handle(pump(st, w), w);
      } else break;
    }
  };
  const steps = Math.ceil(totalKm / ((speed * fixMs) / 3_600_000));
  let t = 0;
  for (let i = 0; i <= steps; i++, t += fixMs) {
    const f = i / steps;
    const pos = { lat: from.lat + (to.lat - from.lat) * f, lon: from.lon + (to.lon - from.lon) * f };
    const r = evaluateNavHazards(hz, {
      pos,
      headingDeg: hdg,
      speedKmh: speed,
      accuracyM: 10,
      nowMs: t,
      draftM: 2.2,
      needM: NEED,
      status: "tracking",
      ix: CTX.hazards,
      noGo: CTX.noGo,
      depthAt,
      nearestCableKm: cableKmAt(CTX, pos),
      insideRestricted: restrictedAt(CTX, pos),
      borderNm: null,
      fmtDist: fmt,
    });
    hz = r.state;
    const info = i % 5 === 0 ? phaoKeTiep(CTX, pos, hdg, fmt) : null;
    const c = collectVoiceEvents(mem, {
      nowMs: t,
      unit: "nm",
      alerts: r.alerts,
      border: null,
      offRoute: null,
      gps: "tracking",
      info,
      storm: null,
      sea: null,
      depthHere: depthAt(pos.lat, pos.lon),
      moving: true,
      legsPassed: 0,
      legsTotal: 0,
      arrived: false,
    });
    mem = c.mem;
    advance(t);
    handle(announce(st, c.events, t, "day-du"), t);
  }
  advance(t + 120_000);
  return log;
}

/** Xác tàu thật, đứng ở nước SÂU (lớp 5) và đường tiếp cận 5 km phía nam cũng là biển. */
function openWaterWrecks(n: number) {
  const out: { id: string; lat: number; lon: number; rKm: number }[] = [];
  for (const h of CTX.hazards?.items ?? []) {
    if (h.loai !== "xac-tau") continue;
    let ok = depthAt(h.lat, h.lon) != null;
    for (let k = 1; k <= 5 && ok; k++) {
      const c = depthAt(offset(h, -k).lat, h.lon);
      ok = c === 5;
    }
    if (ok) out.push({ id: h.id, lat: h.lat, lon: h.lon, rKm: h.rKm });
    if (out.length >= n) break;
  }
  return out;
}

describe("Hải đồ THẬT trong repo — máy đọc đúng vật cản thật, không mạng", () => {
  const wrecks = openWaterWrecks(6);

  it("VM-23 có đủ xác tàu thật ở nước sâu để thử (kho nạp được khi mất sóng)", () => {
    expect(CTX.missing).toEqual([]);
    expect(wrecks.length).toBeGreaterThanOrEqual(3);
  });

  it("VM-24 chạy thẳng vào từng xác tàu thật: đọc 'sắp tới' rồi 'rất gần', câu sạch, ≤ 2 lần mỗi vật", () => {
    for (const w of wrecks) {
      const from = offset(w, -6);
      const to = offset(w, -(w.rKm + 0.2));
      const log = cruiseReal(from, to);
      const mine = log.filter((l) => l.group.startsWith("hz:") && l.group.includes(w.id));
      expect(mine.map((l) => l.tier), `xác tàu ${w.id}`).toEqual(["vang", "do"]);
      expect(mine[0].text).toMatch(/xác tàu|chướng ngại/i);
      for (const l of log) {
        expect(speechIsClean(l.text)).toBe(true);
        expect(l.text).not.toMatch(/\d\s*(m|km)(?!\p{L})|–|±|—/u);
      }
      const per = new Map<string, number>();
      for (const l of log) if (l.group.startsWith("hz:")) per.set(l.group, (per.get(l.group) ?? 0) + 1);
      for (const v of per.values()) expect(v).toBeLessThanOrEqual(2);
    }
  });

  it("VM-25 vào bờ thật (cửa Vũng Tàu): đọc nước cạn/bờ phía trước và vùng nước dưới tàu từ lưới độ sâu thật", () => {
    // từ ngoài khơi Vũng Tàu chạy thẳng vào bãi Sau — đi qua 12 m → 4–12 m → cạn → bờ
    const log = cruiseReal({ lat: 10.2, lon: 107.25 }, { lat: 10.34, lon: 107.1 });
    const chart = log.filter((l) => l.group.startsWith("hz:day") || l.group === "zone");
    expect(chart.length).toBeGreaterThan(0);
    expect(log.some((l) => /cạn|bờ hoặc đảo|rạn/.test(l.text))).toBe(true);
    expect(log.some((l) => l.group === "zone")).toBe(true);
    // câu cạn/bờ là CẢNH BÁO (đỏ/vàng), không phải câu tin
    for (const l of log.filter((x) => x.group.startsWith("hz:day"))) expect(["do", "vang"]).toContain(l.tier);
  });

  it("VM-12b cả bài trên hải đồ thật không gọi mạng lần nào", () => {
    if (fetchSpy) expect(fetchSpy).not.toHaveBeenCalled();
  });
});
