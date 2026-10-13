// CHẾ ĐỘ ĐANG CHẠY — GOM NGUỒN THÀNH SỰ KIỆN ĐỌC (thuần).
//
// Mỗi nguồn đã có bộ não riêng (nav-hazards, geofence, nav-progress, …); file
// này chỉ dịch kết quả của chúng thành `VoiceEvent` có `key` ổn định để bộ phát
// ngôn biết câu nào đã nói. Bộ nhớ nhỏ `VoiceMemory` giữ những thứ mà nguồn
// gốc cập nhật trong im lặng (ranh giới đi ra xa, lệch tuyến lái về gần…) để
// chỉ nói khi mốc TIẾN LÊN — đúng khuôn `borderStepCrossed`.
//
// HẢI ĐỒ LÀ ƯU TIÊN SỐ MỘT (chủ dự án 2026-10-13): mọi câu của nav-hazards
// (độ sâu, rạn, bờ/đảo, xác tàu, giàn khoan, chướng ngại, vùng cấm, cáp ngầm)
// và câu "vùng nước dưới tàu" mang cờ `chart`.

import type { NavAlert } from "@/lib/nav-hazards";
import type { NavStatus } from "@/lib/use-nav-tracking";
import type { VoiceEvent } from "@/lib/nav-voice/announcer";
import type { StormObservation } from "@/lib/nav-voice/nav-storm";
import type { SeaObservation } from "@/lib/nav-voice/sea-now";
import { distSpeech, numVN, toSpeechVN, type SpeechUnit } from "@/lib/nav-voice/phrases";

/* ── VÙNG NƯỚC DƯỚI TÀU (đọc hải đồ như VietMap đọc biển tốc độ) ─────────── */

/** Lớp độ sâu `depthClassAt`: 0 đất · 1 rạn/đá · 2 <2 m · 3 2–4 m · 4 4–12 m · 5 ≥12 m */
export const DEPTH_ZONE_SPEECH: Record<
  number,
  { text: string; first?: string; tier: VoiceEvent["tier"] } | undefined
> = {
  1: { text: "Tàu đang đi trên vùng rạn đá. Dò kỹ đáy.", tier: "vang" },
  2: { text: "Tàu đang ở chỗ nước rất cạn, dưới 2 mét.", tier: "vang" },
  3: { text: "Tàu đang ở vùng nước cạn, 2 đến 4 mét.", tier: "vang" },
  4: { text: "Vào vùng nước 4 đến 12 mét.", first: "Tàu đang ở vùng nước 4 đến 12 mét.", tier: "tin" },
  5: { text: "Ra vùng nước sâu, trên 12 mét.", first: "Tàu đang ở vùng nước sâu, trên 12 mét.", tier: "tin" },
};
/** Vùng CẠN/RẠN (≤3) phải giữ ngần này lần đo liền mới đọc (chống nhảy ô ở mép lưới). */
export const DEPTH_ZONE_STABLE = 2;
/**
 * Câu TIN về vùng nước (4–12 m / sâu) phải ổn định ngần này mới đọc. Đo trên
 * hải đồ thật 2026-10-13 (ngoài khơi Vũng Tàu): mép lưới 4↔5 lật qua lại, chỉ
 * chờ 2 lần đo thì máy đọc "vào 4–12 m / ra vùng sâu" 5 lần trong 13 phút.
 */
export const DEPTH_ZONE_TIN_STABLE_MS = 60_000;
/** Hai câu TIN về vùng nước cách nhau ít nhất ngần này (cạn/rạn thì không chờ). */
export const DEPTH_ZONE_GAP_MS = 5 * 60_000;

export type VoiceMemory = {
  borderMin: number | null;
  /** "đợt" lại gần ranh giới — ra xa >15 hl rồi quay lại là đợt mới, nhắc lại từ đầu (07 §10.7 F) */
  borderEp: number;
  offMax: number | null;
  offEp: number;
  seaEp: number;
  stormBand: Record<string, number>;
  seaMax: number;
  gpsEpisode: number;
  prevGps: NavStatus;
  legsSaid: number;
  zone: { cand: number | null; n: number; sinceMs: number; said: number | null; saidMs: number; seq: number };
};

export function initVoiceMemory(): VoiceMemory {
  return {
    borderMin: null,
    borderEp: 0,
    offMax: null,
    offEp: 0,
    seaEp: 0,
    stormBand: {},
    seaMax: 0,
    gpsEpisode: 0,
    prevGps: "idle",
    legsSaid: 0,
    zone: { cand: null, n: 0, sinceMs: 0, said: null, saidMs: -Infinity, seq: 0 },
  };
}

export type VoiceSources = {
  nowMs: number;
  unit: SpeechUnit;
  /** kết quả `evaluateNavHazards` lần gần nhất */
  alerts: readonly NavAlert[];
  border: { step: number; distanceNm: number; level: "ok" | "near" | "very_near" } | null;
  /** lệch tuyến hiện tại (chỉ khi có tuyến) */
  offRoute: { step: number; km: number } | null;
  gps: NavStatus;
  /** dòng tin phao/đèn */
  info: { id: string; cau: string } | null;
  storm: StormObservation | null;
  sea: SeaObservation | null;
  /** lớp độ sâu dưới tàu (null = ngoài lưới / lưới chưa nạp) */
  depthHere: number | null;
  /** tàu đang chạy (≥ ngưỡng tốc độ) — đứng/neo thì không đọc vùng nước */
  moving: boolean;
  legsPassed: number;
  legsTotal: number;
  arrived: boolean;
  /** bản tin, điểm tin, pin, nhắc lại sau khi mở màn… */
  extra?: readonly VoiceEvent[];
};

export function alertToEvent(a: NavAlert): VoiceEvent {
  return {
    key: `hz:${a.id}:${a.muc}`,
    group: `hz:${a.id}`,
    tier: a.muc,
    text: toSpeechVN(a.cau),
    chart: true,
    rank: a.bac,
  };
}

export function collectVoiceEvents(
  prev: VoiceMemory,
  src: VoiceSources,
): { mem: VoiceMemory; events: VoiceEvent[] } {
  const mem: VoiceMemory = {
    ...prev,
    stormBand: { ...prev.stormBand },
    zone: { ...prev.zone },
  };
  const out: VoiceEvent[] = [];

  // 1. HẢI ĐỒ — hiểm hoạ phía trước (nav-hazards đã lo mốc vàng/đỏ, ≤2 lần mỗi vật)
  for (const a of src.alerts) out.push(alertToEvent(a));

  // 2. HẢI ĐỒ — vùng nước dưới tàu
  const z = src.depthHere;
  if (z == null || z === 0 || !src.moving) {
    mem.zone.cand = null;
    mem.zone.n = 0;
  } else {
    if (z === mem.zone.cand) mem.zone.n += 1;
    else {
      mem.zone.cand = z;
      mem.zone.n = 1;
      mem.zone.sinceMs = src.nowMs;
    }
    const sp = DEPTH_ZONE_SPEECH[z];
    const first = mem.zone.said == null;
    if (sp && z !== mem.zone.said && mem.zone.n >= DEPTH_ZONE_STABLE) {
      const canh = sp.tier !== "tin"; // cạn / rạn: cảnh báo
      const shallower = first || z < (mem.zone.said as number);
      const ok = canh
        ? shallower || src.nowMs - mem.zone.saidMs >= DEPTH_ZONE_GAP_MS
        : first ||
          (src.nowMs - mem.zone.sinceMs >= DEPTH_ZONE_TIN_STABLE_MS &&
            src.nowMs - mem.zone.saidMs >= DEPTH_ZONE_GAP_MS);
      if (ok) {
        mem.zone.said = z;
        mem.zone.saidMs = src.nowMs;
        mem.zone.seq += 1;
        out.push({
          key: `zone:${mem.zone.seq}:${z}`,
          group: "zone",
          tier: sp.tier,
          text: first && sp.first ? sp.first : sp.text,
          chart: true,
          rank: 6,
        });
      }
    }
  }

  // 3. RANH GIỚI — chỉ nói khi tiến sang mốc GẦN hơn; ≤6 hl = đỏ còn hiệu lực
  if (!src.border || src.border.level === "ok") {
    if (mem.borderMin != null) mem.borderEp += 1;
    mem.borderMin = null;
  } else {
    const st = src.border.step;
    mem.borderMin = mem.borderMin == null ? st : Math.min(mem.borderMin, st);
    const red = src.border.level === "very_near";
    const d = src.border.distanceNm;
    out.push({
      key: `border:${mem.borderEp}:${mem.borderMin}`,
      group: "border",
      tier: red ? "do" : "vang",
      persist: red,
      rank: 2,
      text: `Còn chừng ${red ? numVN(d, 1) : Math.round(d)} hải lý tới ranh giới. Giữ khoảng cách.`,
    });
  }

  // 4. BÃO — gần thêm mỗi 50 km mới nói lại
  if (src.storm) {
    const id = src.storm.id;
    const band = Math.min(mem.stormBand[id] ?? Infinity, src.storm.band);
    mem.stormBand[id] = band;
    out.push({
      key: `storm:${id}:${band}`,
      group: `storm:${id}`,
      tier: src.storm.near ? "do" : "vang",
      persist: src.storm.near,
      rank: 3,
      text: src.storm.text,
    });
  }

  // 5. SÓNG GIÓ — mức tăng mới nói; về bình thường thì quên
  if (!src.sea || src.sea.level === 0) {
    if (mem.seaMax > 0) mem.seaEp += 1;
    mem.seaMax = 0;
  } else if (src.sea.warn) {
    mem.seaMax = Math.max(mem.seaMax, src.sea.level);
    out.push({
      key: `sea:${mem.seaEp}:${mem.seaMax}`,
      group: "sea",
      tier: "vang",
      rank: 4,
      text: src.sea.warn,
    });
  }

  // 6. LỆCH TUYẾN — chỉ khi lệch XA hơn
  if (!src.offRoute) {
    if (mem.offMax != null) mem.offEp += 1;
    mem.offMax = null;
  } else {
    mem.offMax = mem.offMax == null ? src.offRoute.step : Math.max(mem.offMax, src.offRoute.step);
    out.push({
      key: `off:${mem.offEp}:${mem.offMax}`,
      group: "off",
      tier: "vang",
      rank: 7,
      text: `Đang đi khác đường đã vẽ chừng ${distSpeech(src.offRoute.km, src.unit)}.`,
    });
  }

  // 7. GPS — mất một lần nói một lần, có lại nói một lần
  if (src.gps === "lost" && mem.prevGps !== "lost") mem.gpsEpisode += 1;
  if (src.gps === "lost") {
    out.push({ key: `gps:lost:${mem.gpsEpisode}`, group: "gps", tier: "vang", rank: 5, text: "Mất định vị. Máy đang tìm lại." });
  } else if (src.gps === "denied") {
    out.push({ key: "gps:denied", group: "gps", tier: "vang", rank: 5, text: "Máy chưa bật định vị. Bật định vị rồi mở lại." });
  } else if (src.gps === "tracking" && mem.prevGps === "lost") {
    out.push({ key: `gps:back:${mem.gpsEpisode}`, group: "gps", tier: "tin", rank: 5, text: "Đã có định vị lại." });
  }
  mem.prevGps = src.gps;

  // 8. CHỖ GHÉ / ĐÍCH
  if (src.legsTotal >= 2 && src.legsPassed > mem.legsSaid && src.legsPassed < src.legsTotal) {
    mem.legsSaid = src.legsPassed;
    out.push({ key: `stop:${src.legsPassed}`, group: "stop", tier: "vang", rank: 8, text: `Đã tới chỗ ghé số ${src.legsPassed}.` });
  }
  if (src.arrived) {
    out.push({ key: "arrive", group: "stop", tier: "vang", rank: 8, text: "Đã tới gần điểm đến." });
  }

  // 9. TIN hải đồ: phao kế tiếp / đèn biển
  if (src.info) {
    out.push({ key: `info:${src.info.id}`, group: "info", tier: "tin", chart: true, rank: 9, text: toSpeechVN(src.info.cau) });
  }

  for (const e of src.extra ?? []) out.push(e);
  return { mem, events: out };
}
