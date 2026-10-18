import { describe, expect, it } from "vitest";

import {
  ageSpeech,
  clockSpeech,
  distSpeech,
  numVN,
  speechIsClean,
  toSpeechVN,
  waveSpeech,
} from "@/lib/nav-voice/phrases";
import {
  acknowledge,
  allowed,
  announce,
  finished,
  initAnnouncer,
  muteFor,
  priority,
  pump,
  VOICE_GAP_MS,
  VOICE_QUEUE_MAX,
  VOICE_REPEAT_MS,
  VOICE_STALE_MS,
  type AnnounceResult,
  type AnnouncerState,
  type VoiceEvent,
} from "@/lib/nav-voice/announcer";
import {
  collectVoiceEvents,
  DEPTH_ZONE_GAP_MS,
  initVoiceMemory,
  type VoiceMemory,
  type VoiceSources,
} from "@/lib/nav-voice/events";
import { stormBulletin, stormObservation, STORM_FAR_BAND } from "@/lib/nav-voice/nav-storm";
import { seaLevelOf, seaObservation, seaThresholds } from "@/lib/nav-voice/sea-now";
import { diemTin, diemTinDue, openingBulletin, urgentLine, DIEM_TIN_MS } from "@/lib/nav-voice/opening";
import { parseVoicePrefs } from "@/lib/nav-voice/prefs";
import type { StormAlert, StormStatus } from "@/lib/storms";
import type { WeatherField } from "@/lib/route-plan";
import type { UrgentItem } from "@/lib/urgent";

const ev = (o: Partial<VoiceEvent> & { key: string }): VoiceEvent => ({
  group: o.key,
  tier: "vang",
  text: `câu ${o.key}`,
  ...o,
});

// ── câu nói ────────────────────────────────────────────────────────────────
describe("phrases — câu hiển thị thành câu nói", () => {
  it("đơn vị đứng sau số đọc thành chữ, không đụng chữ thường", () => {
    expect(toSpeechVN("Xác tàu phía trước chừng 600 m.")).toBe("Xác tàu phía trước chừng 600 mét.");
    expect(toSpeechVN("Phía trước chừng 1,5 km nước chừng 2–4 m.")).toBe(
      "Phía trước chừng 1,5 cây số nước chừng 2 đến 4 mét.",
    );
    expect(toSpeechVN("Giàn khoan — không vào trong 500 m (vị trí gần đúng).")).toBe(
      "Giàn khoan, không vào trong 500 mét, vị trí gần đúng.",
    );
    expect(toSpeechVN("đỏ (định vị lệch ±180 m).")).toBe("đỏ, định vị lệch sai số 180 mét.");
    expect(toSpeechVN("mũi tàu, mạn trái")).toBe("mũi tàu, mạn trái");
  });
  it("quãng đường làm tròn cho tai nghe", () => {
    expect(distSpeech(0.05, "nm")).toBe("chưa tới 100 mét");
    expect(distSpeech(0.43, "nm")).toBe("400 mét");
    expect(distSpeech(1.96, "km")).toBe("2000 mét");
    expect(distSpeech(4.63, "km")).toBe("4,6 cây số");
    expect(distSpeech(46.3, "km")).toBe("46 cây số");
    expect(distSpeech(1.852 * 6.5, "nm")).toBe("6,5 hải lý");
    expect(distSpeech(1.852 * 15.2, "nm")).toBe("15 hải lý");
  });
  it("sóng đọc kiểu đài: rưỡi, nửa mét", () => {
    expect(waveSpeech(2.5)).toBe("2 mét rưỡi");
    expect(waveSpeech(2.04)).toBe("2 mét");
    expect(waveSpeech(0.5)).toBe("nửa mét");
    expect(waveSpeech(0.3)).toBe("dưới nửa mét");
    expect(waveSpeech(1.3)).toBe("1,3 mét");
  });
  it("giờ VN theo buổi, tuổi tin", () => {
    // 2026-10-13 00:00Z = 7:00 sáng VN
    const t = Date.UTC(2026, 9, 13, 0, 0);
    expect(clockSpeech(t)).toBe("7 giờ sáng");
    expect(clockSpeech(t + 8 * 3600_000 + 31 * 60_000)).toBe("3 giờ 30 chiều");
    expect(ageSpeech(t, t + 30 * 60_000)).toBe("tin lúc 7 giờ sáng");
    expect(ageSpeech(t, t + 5 * 3600_000)).toBe("tin cũ 5 giờ");
    expect(ageSpeech(t, t + 50 * 3600_000)).toBe("tin cũ 2 ngày");
    expect(ageSpeech(null, t)).toBe("chưa rõ giờ tin");
    expect(numVN(2.0)).toBe("2");
  });
  it("lọc từ cấm", () => {
    expect(speechIsClean("Vùng biển an toàn")).toBe(false);
    expect(speechIsClean("Không có đá ngầm phía trước")).toBe(false);
    expect(speechIsClean("Bẻ lái ngay")).toBe(false);
    expect(speechIsClean("Phía trước chừng 400 mét có xác tàu.")).toBe(true);
  });
});

// ── bộ phát ngôn ───────────────────────────────────────────────────────────
describe("announcer — hàng đợi, ưu tiên, chống lặp", () => {
  it("hải đồ đứng trước cùng mức; đỏ trước vàng trước bản tin trước tin", () => {
    expect(priority({ tier: "do", chart: true })).toBeLessThan(priority({ tier: "do" }));
    expect(priority({ tier: "do" })).toBeLessThan(priority({ tier: "vang", chart: true }));
    expect(priority({ tier: "vang", chart: true })).toBeLessThan(priority({ tier: "vang" }));
    expect(priority({ tier: "vang" })).toBeLessThan(priority({ tier: "bantin" }));
    expect(priority({ tier: "bantin" })).toBeLessThan(priority({ tier: "tin", chart: true }));
  });

  it("mỗi key đọc đúng một lần", () => {
    let s = initAnnouncer();
    const r1 = announce(s, [ev({ key: "a" })], 0, "day-du");
    expect(r1.start?.key).toBe("a");
    s = finished(r1.state, 3000).state;
    const r2 = announce(s, [ev({ key: "a" })], 60_000, "day-du");
    expect(r2.start).toBeNull();
    expect(r2.state.queue).toHaveLength(0);
  });

  it("câu không-đỏ cách nhau ≥ 8 giây; đỏ không phải chờ", () => {
    let r = announce(initAnnouncer(), [ev({ key: "a" })], 0, "day-du");
    let s = finished(r.state, 2000).state;
    r = announce(s, [ev({ key: "b" })], 3000, "day-du");
    expect(r.start).toBeNull();
    expect(r.waitMs).toBe(VOICE_GAP_MS - 1000);
    s = r.state;
    r = announce(s, [ev({ key: "c", tier: "do" })], 3500, "day-du");
    expect(r.start?.key).toBe("c");
    s = finished(r.state, 5000).state;
    r = pump(s, 5000 + VOICE_GAP_MS);
    expect(r.start?.key).toBe("b");
  });

  it("đỏ cắt ngang câu không-đỏ; đỏ không cắt đỏ", () => {
    let r = announce(initAnnouncer(), [ev({ key: "t", tier: "tin" })], 0, "day-du");
    expect(r.start?.key).toBe("t");
    r = announce(r.state, [ev({ key: "r", tier: "do", chart: true })], 500, "day-du");
    expect(r.interrupt).toBe(true);
    expect(r.start?.key).toBe("r");
    r = announce(r.state, [ev({ key: "r2", tier: "do" })], 700, "day-du");
    expect(r.interrupt).toBe(false);
    expect(r.start).toBeNull();
    expect(r.state.queue[0].key).toBe("r2");
  });

  it("hàng chờ ≤ 2, đỏ không bị đẩy ra, tràn thì bỏ câu thấp nhất", () => {
    let r = announce(initAnnouncer(), [ev({ key: "x", tier: "do" })], 0, "day-du");
    r = announce(
      r.state,
      [
        ev({ key: "t1", tier: "tin" }),
        ev({ key: "v1" }),
        ev({ key: "t2", tier: "tin" }),
        ev({ key: "d1", tier: "do" }),
      ],
      100,
      "day-du",
    );
    const keys = r.state.queue.map((u) => u.key);
    expect(keys.length).toBeLessThanOrEqual(VOICE_QUEUE_MAX);
    expect(keys).toContain("d1");
    expect(keys).not.toContain("t1");
  });

  it("câu chờ quá 20 giây KHI LOA RẢNH là chuyện cũ — bỏ; loa bận thì không già", () => {
    let r = announce(initAnnouncer(), [ev({ key: "x", tier: "do" })], 0, "day-du");
    r = announce(r.state, [ev({ key: "v" })], 100, "day-du");
    // loa còn đọc "x" suốt 40 giây: câu "v" vẫn giữ
    r = announce(r.state, [], 40_000, "day-du");
    expect(r.state.queue).toHaveLength(1);
    // đọc xong lúc 40 s, câu "v" chờ nhịp 8 s rồi được đọc — không bị bỏ
    r = finished(r.state, 40_000);
    expect(r.waitMs).toBe(VOICE_GAP_MS);
    r = pump(r.state, 40_000 + VOICE_GAP_MS);
    expect(r.start?.key).toBe("v");
    // loa rảnh mà câu nằm chờ quá 20 giây (ví dụ màn tắt rồi bật) ⇒ bỏ
    let s2 = finished(r.state, 50_000).state;
    s2 = { ...s2, queue: [{ ...ev({ key: "w" }), queuedMs: 50_000, repeat: 0 }] };
    const r2 = announce(s2, [], 50_000 + VOICE_STALE_MS + 1, "day-du");
    expect(r2.state.queue).toHaveLength(0);
  });

  it("mốc mới cùng vật thay câu cũ đang chờ", () => {
    let r = announce(initAnnouncer(), [ev({ key: "x", tier: "do" })], 0, "day-du");
    r = announce(r.state, [ev({ key: "hz:1:vang", group: "hz:1" })], 100, "day-du");
    r = announce(r.state, [ev({ key: "hz:1:do", group: "hz:1", tier: "do" })], 200, "day-du");
    expect(r.state.queue.map((u) => u.key)).toEqual(["hz:1:do"]);
  });

  it("đỏ còn hiệu lực nhắc lại sau 30 giây, tối đa 2 lần; 'Đã nghe' thì thôi", () => {
    const red = ev({ key: "border:6", group: "border", tier: "do", persist: true });
    let r: AnnounceResult = announce(initAnnouncer(), [red], 0, "day-du");
    let s: AnnouncerState = finished(r.state, 3000).state;
    let spoken = 1;
    for (let t = 5000; t <= 200_000; t += 5000) {
      r = announce(s, [red], t, "day-du");
      if (r.start) {
        spoken++;
        s = finished(r.state, t + 3000).state;
      } else s = r.state;
    }
    expect(spoken).toBe(3);

    // có "Đã nghe" ngay lần đầu: không nhắc
    r = announce(initAnnouncer(), [red], 0, "day-du");
    s = acknowledge(r.state, null);
    s = finished(s, 3000).state;
    let again = 0;
    for (let t = 5000; t <= 200_000; t += 5000) {
      r = announce(s, [red], t, "day-du");
      if (r.start) again++;
      s = r.start ? finished(r.state, t + 3000).state : r.state;
    }
    expect(again).toBe(0);
    expect(VOICE_REPEAT_MS).toBe(30_000);
  });

  it("chế độ: ít bỏ tin; im 30 phút chỉ còn đỏ + hải đồ; tắt im hết", () => {
    expect(allowed(ev({ key: "a", tier: "tin" }), "it", false)).toBe(false);
    expect(allowed(ev({ key: "a", tier: "tin", chart: true }), "it", false)).toBe(false);
    expect(allowed(ev({ key: "a", tier: "vang", chart: true }), "it", false)).toBe(true);
    expect(allowed(ev({ key: "a", tier: "vang" }), "it", false)).toBe(true);
    expect(allowed(ev({ key: "a", tier: "vang" }), "day-du", true)).toBe(false);
    expect(allowed(ev({ key: "a", tier: "vang", chart: true }), "day-du", true)).toBe(true);
    expect(allowed(ev({ key: "a", tier: "do" }), "day-du", true)).toBe(true);
    expect(allowed(ev({ key: "a", tier: "do", chart: true }), "tat", false)).toBe(false);
    // im 30 phút: câu bị chặn vẫn được đánh dấu đã nói — bật lại không xả câu cũ
    let s = muteFor(initAnnouncer(), 0);
    let r = announce(s, [ev({ key: "sea:1", group: "sea" })], 10, "day-du");
    expect(r.start).toBeNull();
    s = r.state;
    r = announce({ ...s, mutedUntil: -Infinity }, [ev({ key: "sea:1", group: "sea" })], 60_000, "day-du");
    expect(r.start).toBeNull();
  });
});

// ── gom nguồn ──────────────────────────────────────────────────────────────
function src(over: Partial<VoiceSources> = {}): VoiceSources {
  return {
    nowMs: 0,
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
  };
}

describe("events — gom nguồn thành câu đọc", () => {
  it("cảnh báo nav-hazards = câu HẢI ĐỒ, key theo vật + mức", () => {
    const { events } = collectVoiceEvents(initVoiceMemory(), src({
      alerts: [{ id: "w1", bac: 1, muc: "do", cau: "Xác tàu phía trước chừng 400 m.", chuong: true, rung: true, distKm: 0.4, etaMin: 2 }],
    }));
    expect(events[0]).toMatchObject({ key: "hz:w1:do", group: "hz:w1", tier: "do", chart: true });
    expect(events[0].text).toBe("Xác tàu phía trước chừng 400 mét.");
  });

  it("ranh giới chỉ tiến mốc khi lại GẦN; ≤6 hl là đỏ còn hiệu lực", () => {
    let mem: VoiceMemory = initVoiceMemory();
    const keyAt = (step: number, d: number, level: "near" | "very_near") => {
      const r = collectVoiceEvents(mem, src({ border: { step, distanceNm: d, level } }));
      mem = r.mem;
      return r.events.find((e) => e.group === "border")!;
    };
    expect(keyAt(15, 14, "near").key).toBe("border:0:15");
    expect(keyAt(10, 9, "near").key).toBe("border:0:10");
    expect(keyAt(15, 12, "near").key).toBe("border:0:10"); // đi ra xa: KHÔNG đổi key
    const red = keyAt(6, 5.4, "very_near");
    expect(red).toMatchObject({ key: "border:0:6", tier: "do", persist: true });
    expect(red.text).toBe("Còn chừng 5,4 hải lý tới ranh giới. Giữ khoảng cách.");
    // ra ngoài 15 hl rồi quay lại: ĐỢT MỚI, nhắc lại từ mốc 15
    mem = collectVoiceEvents(mem, src({ border: null })).mem;
    expect(keyAt(15, 14, "near").key).toBe("border:1:15");
  });

  it("lệch tuyến chỉ nói khi XA hơn", () => {
    let mem = initVoiceMemory();
    const k = (step: number) => {
      const r = collectVoiceEvents(mem, src({ offRoute: { step, km: step + 0.3 } }));
      mem = r.mem;
      return r.events.find((e) => e.group === "off")!.key;
    };
    expect([k(2), k(5), k(2), k(5), k(10)]).toEqual(["off:0:2", "off:0:5", "off:0:5", "off:0:5", "off:0:10"]);
  });

  it("GPS: mất nói một lần mỗi đợt, có lại nói một lần", () => {
    let mem = initVoiceMemory();
    const keys: string[] = [];
    for (const g of ["tracking", "lost", "lost", "tracking", "tracking", "lost"] as const) {
      const r = collectVoiceEvents(mem, src({ gps: g }));
      mem = r.mem;
      for (const e of r.events) if (e.group === "gps") keys.push(e.key);
    }
    expect([...new Set(keys)]).toEqual(["gps:lost:1", "gps:back:1", "gps:lost:2"]);
  });

  it("vùng nước dưới tàu: lần đầu đọc ngay; cạn/rạn đọc ngay; vùng thường phải ổn định 1 phút + cách 5 phút; mép lưới lật qua lại thì im; đứng thì im", () => {
    let mem = initVoiceMemory();
    const said: string[] = [];
    const step = (z: number | null, t: number, moving = true) => {
      const r = collectVoiceEvents(mem, src({ depthHere: z, nowMs: t, moving }));
      mem = r.mem;
      for (const e of r.events) if (e.group === "zone") said.push(e.text);
    };
    step(5, 0);
    step(5, 2000); // lần đầu: đọc ngay
    // mép lưới lật 4↔5 mỗi 20 giây trong 4 phút: không được đọc
    for (let t = 4000; t < 240_000; t += 20_000) {
      step(t % 40_000 < 20_000 ? 4 : 5, t);
      step(t % 40_000 < 20_000 ? 4 : 5, t + 2000);
    }
    // vào hẳn vùng 4–12 m: đọc khi đã ổn định ≥1 phút VÀ cách câu trước ≥5 phút
    for (let t = 240_000; t <= DEPTH_ZONE_GAP_MS + 60_000; t += 2000) step(4, t);
    step(3, 400_000);
    step(3, 402_000); // cạn: đọc ngay
    step(2, 404_000, false);
    step(2, 406_000, false); // đứng: im
    expect(said).toEqual([
      "Tàu đang ở vùng nước sâu, trên 12 mét.",
      "Vào vùng nước 4 đến 12 mét.",
      "Tàu đang ở vùng nước cạn, 2 đến 4 mét.",
    ]);
  });

  it("chỗ ghé và đích", () => {
    let mem = initVoiceMemory();
    const r1 = collectVoiceEvents(mem, src({ legsPassed: 1, legsTotal: 3 }));
    mem = r1.mem;
    expect(r1.events.some((e) => e.key === "stop:1" && e.text === "Đã tới chỗ ghé số 1.")).toBe(true);
    const r2 = collectVoiceEvents(mem, src({ legsPassed: 3, legsTotal: 3, arrived: true }));
    expect(r2.events.some((e) => e.key === "arrive")).toBe(true);
    expect(r2.events.some((e) => e.key === "stop:3")).toBe(false);
  });
});

// ── bão + sóng gió ─────────────────────────────────────────────────────────
const NOW = Date.UTC(2026, 9, 13, 0, 0); // 7 giờ sáng VN
const storm = (lat: number, lon: number, track: number[][] = []): StormAlert => ({
  id: "s1",
  name: "WUTIP",
  kindLabel: "Bão",
  windKmh: 118,
  lat,
  lon,
  alert: "danger",
  updated: new Date(NOW).toISOString(),
  track,
  areas: [],
});

describe("nav-storm — bão theo GPS", () => {
  const pos = { lat: 12, lon: 109.5 };
  it("trong 200 km: đỏ, có hướng đi, tuổi tin, nghe đài; không bao giờ 'an toàn'", () => {
    const st: StormStatus = {
      kind: "co-bao",
      storms: [storm(12.5, 111, [[111, 12.5], [110, 13.5], [109, 14.5]])],
      checkedAt: NOW,
      cu: false,
    };
    const o = stormObservation(st, pos, NOW + 30 * 60_000, "km")!;
    expect(o.near).toBe(true);
    expect(o.band).toBeLessThan(STORM_FAR_BAND);
    expect(o.text).toMatch(/^Bão Vu típ cách tàu chừng \d+ cây số, đang đi hướng Tây Bắc\./);
    expect(o.text).toContain("Tin lúc 7 giờ sáng.");
    expect(o.text).toContain("Nghe đài duyên hải.");
    expect(speechIsClean(o.text)).toBe(true);
  });
  it("xa hơn 200 km: vàng (băng xa)", () => {
    const st: StormStatus = { kind: "co-bao", storms: [storm(20, 118)], checkedAt: NOW, cu: false };
    const o = stormObservation(st, pos, NOW, "nm")!;
    expect(o.near).toBe(false);
    expect(o.band).toBe(STORM_FAR_BAND);
    expect(o.text).toContain("hải lý");
  });
  it("bản tin mở đầu: bốn trạng thái, KHÔNG nói 'không có bão' khi chưa hỏi được", () => {
    expect(stormBulletin({ kind: "dang-hoi" }, null, NOW)).toBe("");
    expect(stormBulletin({ kind: "khong-co", checkedAt: NOW }, null, NOW)).toBe(
      "Bản tin lúc 7 giờ sáng chưa thấy bão trên Biển Đông.",
    );
    const kh = stormBulletin({ kind: "khong-hoi-duoc", checkedAt: NOW - 5 * 3600_000 }, null, NOW);
    expect(kh).toContain("Chưa hỏi được tin bão mới");
    expect(kh).toContain("tin cũ 5 giờ");
    expect(kh).not.toMatch(/không có bão/i);
    expect(stormBulletin({ kind: "khong-hoi-duoc", checkedAt: null }, null, NOW)).toBe(
      "Máy chưa có tin bão. Nghe đài duyên hải.",
    );
  });
});

function fieldWith(waveM: number, windKmh: number, savedAt: number): WeatherField {
  const hours = Array.from({ length: 48 }, () => ({
    waveM,
    waveFromDeg: 90,
    wavePeriodS: null,
    windKmh,
    windFromDeg: 45,
    currentKmh: 0,
    currentToDeg: null,
  }));
  return {
    lat0: 5,
    lon0: 102,
    dLat: 2,
    dLon: 2,
    nLat: 10,
    nLon: 10,
    cells: Array.from({ length: 100 }, () => ({ onSea: true, hours })),
    source: "grid",
    savedAt,
  };
}

describe("sea-now — sóng gió giờ tới từ bản lưu", () => {
  it("ngưỡng theo cỡ tàu", () => {
    expect(seaThresholds(null)).toEqual({ waveM: 2, cap: 6 });
    expect(seaThresholds(18)).toEqual({ waveM: 3, cap: 7 });
    expect(seaLevelOf(2.1, 10, 12)).toBe(1);
    expect(seaLevelOf(2.1, 10, 20)).toBe(0);
    expect(seaLevelOf(3.6, 10, 12)).toBe(2);
    expect(seaLevelOf(0.5, 50, 12)).toBe(1); // cấp 6
  });
  it("biển xấu: câu có giờ, cấp gió, sóng, giờ tải số", () => {
    const o = seaObservation(fieldWith(2.5, 45, NOW - 3600_000), { lat: 10, lon: 108 }, new Date(NOW), null)!;
    expect(o.level).toBe(1);
    expect(o.warn).toBe("Bây giờ gió cấp 6, sóng chừng 2 mét rưỡi. Số dự báo tải lúc 6 giờ sáng.");
    expect(o.summary).toBe("gió cấp 6, sóng chừng 2 mét rưỡi");
  });
  it("biển êm: không có câu cảnh báo; không có lưới: null (không bịa số)", () => {
    const o = seaObservation(fieldWith(0.8, 15, NOW), { lat: 10, lon: 108 }, new Date(NOW), null)!;
    expect(o.level).toBe(0);
    expect(o.warn).toBeNull();
    expect(seaObservation(null, { lat: 10, lon: 108 }, new Date(NOW), null)).toBeNull();
  });
});

// ── bản tin + điểm tin + cài đặt ──────────────────────────────────────────
const item = (label: string, status: string, days: number): UrgentItem => ({
  id: label,
  label,
  status,
  tone: days < 0 ? "danger" : "warn",
  pillar: "giay_to",
  href: "/tau",
  days,
});

describe("opening — bản tin mở đầu + điểm tin", () => {
  it("≤ 4 phần, việc sắp hạn ≤ 7 ngày, tối đa 2 việc", () => {
    expect(
      urgentLine([item("Đăng kiểm", "Còn 3 ngày", 3), item("Bảo hiểm", "Còn 20 ngày", 20), item("Lọc dầu", "Quá hạn 2 ngày", -2), item("Phao", "Còn 6 ngày", 6)]),
    ).toBe("Về bờ nhớ lo: lọc dầu, đăng kiểm.");
    const b = openingBulletin({ storm: "Máy chưa có tin bão. Nghe đài duyên hải.", sea: null, urgent: [], chart: "du", nowMs: NOW, coViTri: true });
    expect(b).toBe(
      "Máy chưa có tin bão. Nghe đài duyên hải. Máy chưa lưu dự báo sóng gió vùng này. Máy đang canh độ sâu, rạn và chướng ngại phía trước. Chỉ tham khảo, bà con dò hải đồ và nghe đài.",
    );
    expect(openingBulletin({ storm: "", sea: null, urgent: [], chart: "thieu", nowMs: NOW, coViTri: true })).toContain("một phần hải đồ");
  });
  it("chưa có vị trí tàu thì KHÔNG nói 'máy đang canh'; nhắc việc về bờ đứng CUỐI", () => {
    const b = openingBulletin({
      storm: "Bản tin lúc 6 giờ chưa thấy bão trên Biển Đông.",
      sea: null,
      urgent: [item("Đăng kiểm tàu cá", "Quá hạn 141 ngày", -141), item("Giấy phép khai thác thủy sản", "Quá hạn 111 ngày", -111)],
      chart: "du",
      nowMs: NOW,
      coViTri: false,
    });
    expect(b).not.toMatch(/đang canh/);
    expect(b).not.toMatch(/\d+ ngày/);
    expect(b).toBe(
      "Bản tin lúc 6 giờ chưa thấy bão trên Biển Đông. Máy chưa lưu dự báo sóng gió vùng này. Chỉ tham khảo, bà con dò hải đồ và nghe đài. Về bờ nhớ lo: đăng kiểm tàu cá, giấy phép khai thác thủy sản.",
    );
  });
  it("điểm tin: có hướng, tốc độ, nước dưới tàu; đứng thì im; nhường cảnh báo 5 phút", () => {
    expect(diemTin({ headingDeg: 135, speedKmh: 13, unit: "nm", depthHere: 4, sea: null })).toBe(
      "Tàu đang chạy hướng Đông Nam, 7 hải lý một giờ. Nước dưới tàu 4 đến 12 mét. Máy vẫn đang canh.",
    );
    expect(diemTin({ headingDeg: 135, speedKmh: 0.2, unit: "nm", depthHere: 4, sea: null })).toBeNull();
    expect(diemTinDue(-Infinity, -Infinity, 0, DIEM_TIN_MS - 1)).toBe(false);
    expect(diemTinDue(-Infinity, -Infinity, 0, DIEM_TIN_MS)).toBe(true);
    expect(diemTinDue(-Infinity, DIEM_TIN_MS - 60_000, 0, DIEM_TIN_MS)).toBe(false);
  });
  it("cài đặt: thiếu/hỏng = đọc đầy đủ", () => {
    expect(parseVoicePrefs(null)).toEqual({ muc: "day-du", daXem: false, tuDoc: true });
    expect(parseVoicePrefs("{hỏng")).toEqual({ muc: "day-du", daXem: false, tuDoc: true });
    expect(parseVoicePrefs('{"muc":"it","daXem":true}')).toEqual({ muc: "it", daXem: true, tuDoc: true });
    // tự đọc khi mở bản đồ: chỉ TẮT khi bà con tắt rõ ràng
    expect(parseVoicePrefs('{"tuDoc":false}').tuDoc).toBe(false);
    expect(parseVoicePrefs('{"muc":"to-lon"}').muc).toBe("day-du");
  });
});

describe("trả lời Sen Biển — một giọng chung với cảnh báo (2026-10-16)", () => {
  const rep = (text: string, at = 0) => ({ key: `sen:${at}`, group: "sen", tier: "vang" as const, text, reply: true });
  it("đọc ngay, không chờ nhịp 8 giây, kể cả chế độ tắt", () => {
    let st = initAnnouncer();
    st = finished(st, 1000).state; // vừa đọc xong 1 câu
    const r = announce(st, [rep("Tới Sa Huỳnh 32 hải lý")], 2000, "tat");
    expect(r.start?.text).toBe("Tới Sa Huỳnh 32 hải lý");
  });
  it("đứng SAU câu đỏ, TRƯỚC câu vàng", () => {
    const st = initAnnouncer();
    const r = announce(
      st,
      [
        { key: "v", group: "v", tier: "vang", text: "vàng" },
        rep("đáp"),
        { key: "d", group: "d", tier: "do", text: "đỏ" },
      ],
      0,
      "day-du",
    );
    expect(r.start?.text).toBe("đỏ");
    // hàng chờ trần 2 câu (gồm câu đang đọc): câu vàng nhường chỗ cho câu trả lời
    expect(r.state.queue.map((u) => u.text)[0]).toBe("đáp");
  });
  it("cắt câu tin đang đọc, không cắt cảnh báo đỏ", () => {
    const a = announce(initAnnouncer(), [{ key: "t", group: "t", tier: "tin", text: "phao" }], 0, "day-du");
    expect(announce(a.state, [rep("đáp", 1)], 100, "day-du").interrupt).toBe(true);
    const b = announce(initAnnouncer(), [{ key: "d", group: "d", tier: "do", text: "rạn" }], 0, "day-du");
    const r = announce(b.state, [rep("đáp", 2)], 100, "day-du");
    expect(r.interrupt).toBe(false);
    expect(r.start).toBeNull();
  });
});
