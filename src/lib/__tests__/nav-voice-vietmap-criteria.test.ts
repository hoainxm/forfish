import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/*
  NGHIỆM THU CHẾ ĐỘ ĐANG CHẠY THEO TIÊU CHÍ KIỂU VIETMAP (doc 15 §16).

  Mô phỏng chuyến chạy THẬT: bộ não hải đồ có sẵn (`evaluateNavHazards`, thế
  giới giả có xác tàu + lưới độ sâu có rạn/bãi cạn) → `collectVoiceEvents` →
  `announce`, với đồng hồ giả và một "loa" giả đọc mỗi từ ~350 ms. Mỗi tiêu chí
  VM-xx là một `it` — bảng đối chiếu ở doc 15 §16. Đạt khi 100 % xanh.
*/

import { buildIndex, type SpatialIndex } from "@/lib/spatial-index";
import {
  evaluateNavHazards,
  initNavHazardState,
  navThresholdsKm,
  type HazardLike,
  type NavAlert,
  type NavHazardState,
} from "@/lib/nav-hazards";
import {
  announce,
  acknowledge,
  finished,
  initAnnouncer,
  pump,
  VOICE_GAP_MS,
  type AnnounceResult,
  type AnnouncerState,
  type VoiceEvent,
  type VoiceMode,
  type VoiceTier,
} from "@/lib/nav-voice/announcer";
import { collectVoiceEvents, initVoiceMemory, type VoiceMemory, type VoiceSources } from "@/lib/nav-voice/events";
import { borderStepFor } from "@/lib/geofence";
import { stormObservation } from "@/lib/nav-voice/nav-storm";
import { diemTin, diemTinDue, openingBulletin } from "@/lib/nav-voice/opening";
import { speechIsClean, wordCount } from "@/lib/nav-voice/phrases";
import type { SeaObservation } from "@/lib/nav-voice/sea-now";
import type { StormAlert, StormStatus } from "@/lib/storms";
import type { NavStatus } from "@/lib/use-nav-tracking";

// ── thế giới giả ─────────────────────────────────────────────────────────
const LAT0 = 10;
const LON0 = 108;
const KM_PER_DEG = (Math.PI / 180) * 6371;
const at = (northKm: number, eastKm = 0) => ({
  lat: LAT0 + northKm / KM_PER_DEG,
  lon: LON0 + eastKm / (KM_PER_DEG * Math.cos((LAT0 * Math.PI) / 180)),
});
const northOf = (lat: number) => (lat - LAT0) * KM_PER_DEG;
const eastOf = (lon: number) => (lon - LON0) * KM_PER_DEG * Math.cos((LAT0 * Math.PI) / 180);

const WRECK: HazardLike = { id: "xac-1", ...at(3), rKm: 0.5, loai: "xac-tau", ten: null, doSauM: null, tinVua: false };
const IX: SpatialIndex<HazardLike> = buildIndex([WRECK], (h) => ({ lat: h.lat, lon: h.lon }));

/** Lưới độ sâu giả: sâu (5) · RẠN (1) ở 6–6,5 km bắc · nông 4–12 m (4) từ 9 km. */
function depthAt(lat: number, lon: number): number {
  const n = northOf(lat);
  const e = eastOf(lon);
  if (n >= 6 && n <= 6.5 && Math.abs(e) <= 0.6) return 1;
  if (n >= 9) return 4;
  return 5;
}

const SPEED = 13; // km/h ≈ 7 hải lý — tàu cá đang chạy
const FIX_MS = 2_000;

// ── loa giả + vòng mô phỏng ──────────────────────────────────────────────
type Spoken = { t: number; end: number; text: string; tier: VoiceTier; chart: boolean; key: string; group: string; cut: boolean };

class Sim {
  st: AnnouncerState = initAnnouncer();
  mem: VoiceMemory = initVoiceMemory();
  hz: NavHazardState = initNavHazardState();
  log: Spoken[] = [];
  mode: VoiceMode = "day-du";
  /** máy đọc được tiếng Việt không — không đọc được thì câu "xong" ngay */
  canSpeak = true;
  private endAt: number | null = null;
  private waitUntil: number | null = null;

  private handle(r: AnnounceResult, t: number) {
    this.st = r.state;
    if (r.interrupt && this.log.length) {
      const last = this.log[this.log.length - 1];
      if (last.end > t) {
        last.cut = true;
        last.end = t;
      }
    }
    if (r.start) {
      const dur = this.canSpeak ? wordCount(r.start.text) * 350 : 0;
      if (this.canSpeak) {
        this.log.push({ t, end: t + dur, text: r.start.text, tier: r.start.tier, chart: !!r.start.chart, key: r.start.key, group: r.start.group, cut: false });
      }
      this.endAt = t + dur;
      this.waitUntil = null;
    } else if (r.waitMs != null) this.waitUntil = t + r.waitMs;
  }

  advance(t: number) {
    for (let guard = 0; guard < 20; guard++) {
      if (this.endAt != null && t >= this.endAt) {
        const e = this.endAt;
        this.endAt = null;
        this.handle(finished(this.st, e), e);
        continue;
      }
      if (this.endAt == null && this.waitUntil != null && t >= this.waitUntil) {
        const w = this.waitUntil;
        this.waitUntil = null;
        this.handle(pump(this.st, w), w);
        continue;
      }
      break;
    }
  }

  feed(events: VoiceEvent[], t: number) {
    this.advance(t);
    this.handle(announce(this.st, events, t, this.mode), t);
  }

  collect(t: number, over: Partial<VoiceSources>) {
    const r = collectVoiceEvents(this.mem, {
      nowMs: t,
      unit: "nm",
      alerts: [],
      border: null,
      offRoute: null,
      gps: "tracking",
      info: null,
      storm: null,
      sea: null,
      depthHere: null,
      moving: true,
      legsPassed: 0,
      legsTotal: 0,
      arrived: false,
      ...over,
    });
    this.mem = r.mem;
    this.feed(r.events, t);
  }

  said(re: RegExp) {
    return this.log.filter((s) => re.test(s.text));
  }
}

/** Chạy tàu về bắc từ 0 tới `toKm` — chỉ GPS, KHÔNG có tuyến (chế độ Đang chạy). */
function cruise(toKm: number, opts: { mode?: VoiceMode; canSpeak?: boolean; info?: (n: number) => { id: string; cau: string } | null; withOpening?: boolean } = {}) {
  const sim = new Sim();
  sim.mode = opts.mode ?? "day-du";
  sim.canSpeak = opts.canSpeak ?? true;
  const stepKm = (SPEED * FIX_MS) / 3_600_000;
  let lastDiem = -Infinity;
  const alertsSeen: { t: number; n: number; a: NavAlert }[] = [];
  let t = 0;
  for (let n = 0; n <= toKm; n += stepKm, t += FIX_MS) {
    const pos = at(n);
    const { alerts, state } = evaluateNavHazards(sim.hz, {
      pos,
      headingDeg: 0,
      speedKmh: SPEED,
      accuracyM: 10,
      nowMs: t,
      draftM: null,
      needM: null,
      status: "tracking",
      ix: IX,
      noGo: null,
      depthAt,
      nearestCableKm: null,
      insideRestricted: null,
      borderNm: null,
    });
    sim.hz = state;
    for (const a of alerts) alertsSeen.push({ t, n, a });
    const extra: VoiceEvent[] = [];
    if (t === 0 && opts.withOpening) {
      extra.push({
        key: "bantin:0",
        group: "bantin",
        tier: "bantin",
        text: openingBulletin({ storm: "Máy chưa có tin bão. Nghe đài duyên hải.", sea: null, urgent: [], chart: "du", nowMs: 0, coViTri: true }),
      });
    }
    if (diemTinDue(lastDiem, sim.st.lastAlarmMs, 0, t)) {
      lastDiem = t;
      const text = diemTin({ headingDeg: 0, speedKmh: SPEED, unit: "nm", depthHere: depthAt(pos.lat, pos.lon), sea: null });
      if (text) extra.push({ key: `diem:${t}`, group: "diem", tier: "tin", rank: 9, text });
    }
    sim.collect(t, { alerts, depthHere: depthAt(pos.lat, pos.lon), info: opts.info?.(n) ?? null, extra });
  }
  sim.advance(t + 60_000);
  return { sim, alertsSeen, endMs: t };
}

let fetchSpy: ReturnType<typeof vi.spyOn> | null = null;
beforeAll(() => {
  if (typeof globalThis.fetch === "function") fetchSpy = vi.spyOn(globalThis, "fetch");
});
afterAll(() => fetchSpy?.mockRestore());

// ═════════════════════════════════════════════════════════════════════════
describe("Chế độ Đang chạy — tiêu chí kiểu VietMap (doc 15 §16)", () => {
  const run = cruise(12, { withOpening: true });
  const { sim } = run;

  it("VM-01 chỉ cần GPS: không có tuyến vẫn canh và đọc cảnh báo hải đồ", () => {
    expect(sim.said(/xác tàu/i).length).toBeGreaterThan(0);
    expect(sim.said(/rạn/i).length).toBeGreaterThan(0);
    expect(sim.log.some((s) => s.group === "off")).toBe(false);
  });

  it("VM-02 hai mốc như 'còn 500 m / còn 200 m': VÀNG sớm (~10 phút) rồi ĐỎ sát (~3 phút)", () => {
    const thr = navThresholdsKm(SPEED, 10);
    const w = run.alertsSeen.filter((x) => x.a.id === "xac-1");
    expect(w.map((x) => x.a.muc)).toEqual(["vang", "do"]);
    const edge = (n: number) => 3 - 0.5 - n;
    expect(edge(w[0].n)).toBeLessThanOrEqual(thr[0] + 1e-6);
    expect(edge(w[0].n)).toBeGreaterThan(thr[0] - 0.05);
    expect(edge(w[1].n)).toBeLessThanOrEqual(thr[1] + 1e-6);
    // đọc đúng hai câu đó ra loa
    expect(sim.log.filter((s) => s.group === "hz:xac-1").map((s) => s.tier)).toEqual(["vang", "do"]);
  });

  it("VM-03 mỗi vật hải đồ đọc tối đa 2 lần (sắp tới + rất gần), không lải nhải mỗi nhịp GPS", () => {
    const byGroup = new Map<string, number>();
    for (const s of sim.log) if (s.group.startsWith("hz:")) byGroup.set(s.group, (byGroup.get(s.group) ?? 0) + 1);
    expect(byGroup.size).toBeGreaterThanOrEqual(2); // xác tàu + rạn
    for (const n of byGroup.values()) expect(n).toBeLessThanOrEqual(2);
  });

  it("VM-04 HẢI ĐỒ là ưu tiên số một: rạn/xác tàu đỏ cắt ngang câu đang đọc thấp hơn", () => {
    const s2 = new Sim();
    s2.feed([{ key: "bantin", group: "bantin", tier: "bantin", text: "Bản tin mở đầu rất dài ".repeat(10) }], 0);
    s2.feed([{ key: "hz:r:do", group: "hz:r", tier: "do", chart: true, text: "Phía trước chừng 400 mét có rạn đá." }], 1000);
    expect(s2.log[0].cut).toBe(true);
    expect(s2.log[1].text).toContain("rạn đá");
    // cùng lượt: đỏ hải đồ đứng trước đỏ ranh giới
    const s3 = new Sim();
    s3.feed(
      [
        { key: "border:0:6", group: "border", tier: "do", text: "Còn chừng 6 hải lý tới ranh giới." },
        { key: "hz:r:do", group: "hz:r", tier: "do", chart: true, text: "Phía trước chừng 400 mét có rạn đá." },
      ],
      0,
    );
    expect(s3.log[0].group).toBe("hz:r");
  });

  it("VM-05 câu không-đỏ cách nhau ≥ 8 giây (tai nghỉ, không 'dòng âm liên tục')", () => {
    const nonRed = sim.log.filter((s) => s.tier !== "do");
    for (let i = 1; i < nonRed.length; i++) {
      const prevEnd = Math.max(...sim.log.filter((s) => s.t < nonRed[i].t).map((s) => s.end));
      expect(nonRed[i].t - prevEnd).toBeGreaterThanOrEqual(VOICE_GAP_MS - 1);
    }
  });

  it("VM-06 không đọc lặp một câu đã đọc", () => {
    const keys = sim.log.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("VM-07 đọc vùng nước dưới tàu khi đổi vùng (như VietMap đọc biển tốc độ khi vào đoạn mới)", () => {
    const zones = sim.log.filter((s) => s.group === "zone").map((s) => s.text);
    expect(zones).toEqual([
      "Tàu đang ở vùng nước sâu, trên 12 mét.",
      "Tàu đang đi trên vùng rạn đá. Dò kỹ đáy.",
      "Ra vùng nước sâu, trên 12 mét.",
      "Vào vùng nước 4 đến 12 mét.",
    ]);
    // vào vùng rạn: đọc NGAY (cạn hơn không phải chờ 2 phút)
  });

  it("VM-08 bản tin mở đầu đọc trước tiên, ≤ 4 phần, kết bằng câu tham khảo", () => {
    expect(sim.log[0].group).toBe("bantin");
    expect(sim.log[0].text).toMatch(/Chỉ tham khảo/);
    expect(sim.log[0].text.split(". ").length).toBeLessThanOrEqual(6);
  });

  it("VM-09 điểm tin 30 phút khi đang chạy — có hướng, tốc độ, nước dưới tàu", () => {
    const d = sim.log.filter((s) => s.group === "diem");
    expect(d.length).toBeGreaterThanOrEqual(1);
    expect(d[0].t).toBeGreaterThanOrEqual(30 * 60_000);
    expect(d[0].text).toMatch(/^Tàu đang chạy hướng Bắc, 7 hải lý một giờ\. Nước dưới tàu/);
    // nhường: không có cảnh báo đỏ/vàng trong 5 phút trước điểm tin
    const alarmsBefore = sim.log.filter((s) => (s.tier === "do" || s.tier === "vang") && s.t > d[0].t - 5 * 60_000 && s.t < d[0].t);
    expect(alarmsBefore).toHaveLength(0);
  });

  it("VM-10 câu ngắn, có số, không ra lệnh, không 'an toàn', không 'South China Sea'", () => {
    for (const s of sim.log) {
      expect(speechIsClean(s.text)).toBe(true);
      if (s.group !== "bantin") expect(wordCount(s.text)).toBeLessThanOrEqual(30);
    }
  });

  it("VM-11 đọc đơn vị bằng chữ — không còn 'm', 'km', '–', '±' thô", () => {
    for (const s of sim.log) expect(s.text).not.toMatch(/\d\s*(m|km)(?!\p{L})|–|±|—/u);
  });

  it("VM-12 chạy OFFLINE: cả chuyến không gọi mạng lần nào", () => {
    if (fetchSpy) expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("Ranh giới, bão, sóng gió, GPS, chỗ ghé", () => {
  it("VM-13 ranh giới đọc theo mốc 15/10/6/3 hải lý chỉ khi lại gần; ≤6 đỏ, nhắc lại ≤2 lần khi chưa 'Đã nghe'", () => {
    const sim = new Sim();
    let t = 0;
    const dists = [16, 14, 12, 9, 12, 8, 5.5, 5.4, 5.3, 5.2, 5.1, 5, 4.9, 4.8, 2.9, 2.8, 2.7, 2.6];
    for (const d of dists) {
      const step = borderStepFor(d);
      sim.collect(t, { border: step == null ? null : { step, distanceNm: d, level: d <= 6 ? "very_near" : "near" } });
      t += 20_000;
    }
    sim.advance(t + 60_000);
    const b = sim.log.filter((s) => s.group === "border");
    const firstOf = (k: string) => b.filter((s) => s.key === k).length;
    expect(firstOf("border:0:15")).toBe(1);
    expect(firstOf("border:0:10")).toBe(1);
    expect(firstOf("border:0:6")).toBe(3); // 1 lần + nhắc lại 2 lần
    expect(firstOf("border:0:3")).toBeGreaterThanOrEqual(1);
    expect(b.find((s) => s.key === "border:0:6")!.tier).toBe("do");

    // "Đã nghe" ngay khi đọc mốc 6 → không nhắc lại
    const s2 = new Sim();
    t = 0;
    for (const d of [5.5, 5.4, 5.3, 5.2, 5.1, 5.0, 4.9, 4.8]) {
      s2.collect(t, { border: { step: 6, distanceNm: d, level: "very_near" } });
      if (t === 0) s2.st = acknowledge(s2.st, "border");
      t += 20_000;
    }
    expect(s2.log.filter((s) => s.group === "border")).toHaveLength(1);
  });

  it("VM-14 bão: xa nói 1 lần; vào 200 km đỏ; gần thêm mỗi 50 km nói lại; luôn có tuổi tin + nghe đài", () => {
    const sim = new Sim();
    const now0 = Date.UTC(2026, 9, 13, 0, 0);
    const pos = { lat: 12, lon: 109.5 };
    const st = (lon: number): StormStatus => ({
      kind: "co-bao",
      storms: [{ id: "s1", name: "WUTIP", kindLabel: "Bão", windKmh: 118, lat: 12, lon, alert: "danger", updated: "", track: [], areas: [] } as StormAlert],
      checkedAt: now0,
      cu: false,
    });
    let t = 0;
    for (const lon of [113.5, 113.4, 111.2, 111.1, 110.9, 110.4, 110.3, 111.5]) {
      sim.collect(t, { storm: stormObservation(st(lon), pos, now0 + t, "km") });
      sim.st = acknowledge(sim.st, "storm:s1"); // bà con đã nghe — đo riêng chuyện "gần thêm mới nói"
      t += 60_000;
    }
    sim.advance(t + 60_000);
    const s = sim.log.filter((x) => x.group === "storm:s1");
    // 436 km (xa) → 185 km (băng 150–200) → 98 km (băng 50–100); đi ra xa lại: im
    expect(s.map((x) => x.key)).toEqual(["storm:s1:99", "storm:s1:3", "storm:s1:1"]);
    expect(s.map((x) => x.tier)).toEqual(["vang", "do", "do"]);
    for (const x of s) {
      expect(x.text).toMatch(/Tin lúc|Tin cũ/);
      expect(x.text).toContain("Nghe đài duyên hải.");
      expect(speechIsClean(x.text)).toBe(true);
    }
  });

  it("VM-15 sóng gió: mức tăng mới nói, về êm rồi xấu lại thì nói lại; luôn có giờ tải số", () => {
    const sim = new Sim();
    const sea = (level: 0 | 1 | 2): SeaObservation => ({
      level,
      summary: "gió cấp 6, sóng chừng 2 mét",
      warn: level ? `2 giờ nữa gió cấp ${5 + level}, sóng chừng 2 mét. Số dự báo tải lúc 6 giờ sáng.` : null,
      savedAt: 0,
    });
    let t = 0;
    for (const l of [1, 1, 2, 2, 1, 0, 1] as const) {
      sim.collect(t, { sea: sea(l) });
      t += 60_000;
    }
    sim.advance(t + 60_000);
    expect(sim.log.filter((s) => s.group === "sea").map((s) => s.key)).toEqual(["sea:0:1", "sea:0:2", "sea:1:1"]);
    for (const s of sim.log) expect(s.text).toContain("Số dự báo tải");
  });

  it("VM-16 mất GPS đọc 1 lần, có lại đọc 1 lần", () => {
    const sim = new Sim();
    let t = 0;
    for (const g of ["tracking", "lost", "lost", "lost", "tracking", "tracking"] as NavStatus[]) {
      sim.collect(t, { gps: g });
      t += 15_000;
    }
    sim.advance(t + 60_000);
    expect(sim.log.map((s) => s.text)).toEqual(["Mất định vị. Máy đang tìm lại.", "Đã có định vị lại."]);
  });

  it("VM-17 có tuyến: lệch tuyến chỉ khi xa hơn; báo tới từng chỗ ghé và tới đích", () => {
    const sim = new Sim();
    let t = 0;
    const steps: Partial<VoiceSources>[] = [
      { offRoute: { step: 2, km: 2.4 }, legsTotal: 3 },
      { offRoute: { step: 2, km: 2.1 }, legsTotal: 3 },
      { offRoute: { step: 5, km: 5.3 }, legsTotal: 3 },
      { offRoute: null, legsTotal: 3, legsPassed: 1 },
      { legsTotal: 3, legsPassed: 2 },
      { legsTotal: 3, legsPassed: 3, arrived: true },
    ];
    for (const s of steps) {
      sim.collect(t, s);
      t += 20_000;
    }
    sim.advance(t + 60_000);
    expect(sim.log.map((s) => s.text)).toEqual([
      "Đang đi khác đường đã vẽ chừng 1,3 hải lý.",
      "Đang đi khác đường đã vẽ chừng 2,9 hải lý.",
      "Đã tới chỗ ghé số 1.",
      "Đã tới chỗ ghé số 2.",
      "Đã tới gần điểm đến.",
    ]);
  });
});

// ═════════════════════════════════════════════════════════════════════════
describe("Mức nói + máy không có giọng Việt", () => {
  const info = (n: number) => (n > 0.5 && n < 0.6 ? { id: "phao:1", cau: "Phao số 7 (thân đỏ) phía trước 600 m." } : null);

  it("VM-18 'Đọc ít' bỏ câu tin (phao, điểm tin) nhưng VẪN đọc mọi cảnh báo hải đồ", () => {
    const full = cruise(12, { info }).sim;
    const it = cruise(12, { info, mode: "it" }).sim;
    expect(full.log.some((s) => s.group === "info")).toBe(true);
    expect(it.log.some((s) => s.group === "info")).toBe(false);
    expect(it.log.some((s) => s.group === "diem")).toBe(false);
    const chartFull = full.log.filter((s) => s.group.startsWith("hz:") || s.group === "zone" && s.tier !== "tin").map((s) => s.key);
    const chartIt = it.log.filter((s) => s.group.startsWith("hz:") || s.group === "zone" && s.tier !== "tin").map((s) => s.key);
    expect(chartIt).toEqual(chartFull);
  });

  it("VM-19 'Im 30 phút' vẫn đọc cảnh báo hải đồ + đỏ, im phần còn lại", () => {
    const sim = new Sim();
    sim.st = { ...sim.st, mutedUntil: 10 * 60_000 };
    sim.feed(
      [
        { key: "sea:1", group: "sea", tier: "vang", text: "Bây giờ gió cấp 6." },
        { key: "hz:x:vang", group: "hz:x", tier: "vang", chart: true, text: "Xác tàu phía trước chừng 2 cây số." },
        { key: "border:6", group: "border", tier: "do", text: "Còn chừng 6 hải lý tới ranh giới." },
      ],
      0,
    );
    sim.advance(5 * 60_000);
    expect(sim.log.map((s) => s.group).sort()).toEqual(["border", "hz:x"]);
  });

  it("VM-20 'Tắt giọng' không đọc gì (chuông, rung, chữ vẫn do màn bản đồ lo)", () => {
    expect(cruise(12, { mode: "tat" }).sim.log).toHaveLength(0);
  });

  it("VM-21 máy không có giọng Việt: không đọc, hàng đợi không kẹt, cảnh báo vẫn được tính", () => {
    const r = cruise(12, { canSpeak: false });
    expect(r.sim.log).toHaveLength(0);
    expect(r.sim.st.current).toBeNull();
    expect(r.alertsSeen.length).toBeGreaterThan(0);
  });

  it("VM-22 hàng chờ không phình: tối đa 2 câu chờ suốt chuyến", () => {
    const sim = new Sim();
    for (let i = 0; i < 30; i++) {
      sim.feed([{ key: `t${i}`, group: `g${i}`, tier: i % 3 ? "tin" : "vang", text: `Câu số ${i}.` }], i * 300);
      expect(sim.st.queue.length).toBeLessThanOrEqual(2);
    }
  });
});
