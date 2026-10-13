"use client";

// CHẾ ĐỘ ĐANG CHẠY — NỐI BỘ PHÁT NGÔN VỚI LOA (doc 15 §4, §6, §8).
//
// Mọi quyết định "nói gì, lúc nào" nằm ở các file thuần cùng thư mục (có test).
// Hook này chỉ: gom nguồn → `collectVoiceEvents` → `announce` → `ttsSpeak`,
// cộng ba đồng hồ (điểm tin 30 phút · pin · sóng gió) và chuyện tắt/mở màn.
//
// OFFLINE (4 câu CLAUDE.md): (a) KHÔNG request mạng nào — bão/sóng gió đọc bản
// đã lưu, giọng đọc là engine của máy; (b) không đụng sw.js; khoá mới duy nhất
// `forfish.nav.voice.v1`; (c) chỉ đọc, không ghi đè dữ liệu nào; (d) nhánh mất
// sóng là nhánh duy nhất.

import { useCallback, useEffect, useRef, useState } from "react";

import type { NavAlert } from "@/lib/nav-hazards";
import type { NavStatus } from "@/lib/use-nav-tracking";
import type { LatLon, WeatherField } from "@/lib/route-plan";
import type { StormStatus } from "@/lib/storms";
import { loadLongestSavedGrid } from "@/lib/forecast-grid";
import { gridToWeatherField } from "@/lib/route-weather";
import { computeUrgent } from "@/lib/urgent";
import { readToken } from "@/lib/device-token-store";
import {
  acknowledge,
  announce,
  finished,
  initAnnouncer,
  muteFor,
  pump,
  unmute,
  type AnnounceResult,
  type AnnouncerState,
  type Utterance,
  type VoiceEvent,
  type VoiceMode,
} from "@/lib/nav-voice/announcer";
import { collectVoiceEvents, initVoiceMemory, type VoiceMemory } from "@/lib/nav-voice/events";
import { stormBulletin, stormObservation, type StormObservation } from "@/lib/nav-voice/nav-storm";
import { seaObservation, type SeaObservation } from "@/lib/nav-voice/sea-now";
import {
  diemTin,
  diemTinDue,
  openingBulletin,
  type ChartReadiness,
} from "@/lib/nav-voice/opening";
import type { SpeechUnit } from "@/lib/nav-voice/phrases";
import {
  NAV_VOICE_EVENT,
  readVoicePrefs,
  writeVoicePrefs,
  type NavVoicePrefs,
} from "@/lib/nav-voice/prefs";
import { ttsCancel, ttsCheck, ttsOpenInstall, ttsSpeak, ttsUnlock, type TtsAvail } from "@/lib/voice/tts";

const isHidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

/** Chuông (warning-sound) kêu cùng lúc với sự kiện — giọng vào sau ngần này. */
export const CHIME_LEAD_MS = 700;
/** Chờ kho hải đồ dựng xong tối đa ngần này rồi đọc bản tin mở đầu. */
const OPENING_WAIT_MS = 5_000;
const OPENING_MIN_MS = 1_200;
const SEA_REFRESH_MS = 10 * 60_000;
const FIELD_REFRESH_MS = 60 * 60_000;
const BATTERY_CHECK_MS = 5 * 60_000;
export const BATTERY_LOW = 0.15;
const TICK_MS = 60_000;

export const VOICE_TEST_TEXT = "Đây là giọng đọc cảnh báo của SDFish. Bà con nghe rõ là được.";

export type NavVoiceInput = {
  on: boolean;
  unit: SpeechUnit;
  pos: LatLon | null;
  headingDeg: number | null;
  speedKmh: number | null;
  moving: boolean;
  gps: NavStatus;
  alerts: readonly NavAlert[];
  border: { step: number; distanceNm: number; level: "ok" | "near" | "very_near" } | null;
  offRoute: { step: number; km: number } | null;
  info: { id: string; cau: string } | null;
  storm: StormStatus;
  depthHere: number | null;
  legsPassed: number;
  legsTotal: number;
  arrived: boolean;
  /** null = kho hải đồ đang dựng */
  chart: ChartReadiness | null;
  /** chiều dài tàu (m) — ngưỡng sóng gió; null = coi như tàu nhỏ */
  lengthM: number | null;
};

/** Nấc nút Giọng trên HUD: đầy đủ → ít → im 30 phút → đầy đủ. */
export type VoiceLevel = "day-du" | "it" | "im30" | "tat";

export type NavVoice = {
  level: VoiceLevel;
  cycleLevel: () => void;
  setMode: (m: VoiceMode) => void;
  avail: TtsAvail | null;
  /** câu ĐANG đọc (để HUD in ra cho người nghe kém) */
  speaking: { text: string; red: boolean } | null;
  ack: () => void;
  testSpeak: () => void;
  openInstall: () => void;
  prefs: NavVoicePrefs;
  markIntroSeen: () => void;
};

export function useNavVoice(inp: NavVoiceInput): NavVoice {
  const [prefs, setPrefs] = useState<NavVoicePrefs>({ muc: "day-du", daXem: true });
  const [muted, setMuted] = useState(false);
  const [avail, setAvail] = useState<TtsAvail | null>(null);
  const [speaking, setSpeaking] = useState<{ text: string; red: boolean } | null>(null);

  const stRef = useRef<AnnouncerState>(initAnnouncer());
  const memRef = useRef<VoiceMemory>(initVoiceMemory());
  const modeRef = useRef<VoiceMode>("day-du");
  const availRef = useRef<TtsAvail | null>(null);
  const tokRef = useRef(0);
  const cancelRef = useRef<(() => void) | null>(null);
  const waitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leadRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startMsRef = useRef<number | null>(null);
  const openingDoneRef = useRef(false);
  const extraRef = useRef<VoiceEvent[]>([]);
  /** câu không-đỏ tới TRƯỚC bản tin mở đầu — giữ lại để bản tin được đọc trước */
  const pendingRef = useRef<VoiceEvent[]>([]);
  const diemMsRef = useRef(-Infinity);
  const hiddenSinceRef = useRef<number | null>(null);
  const fieldRef = useRef<{ field: WeatherField | null; at: number }>({ field: null, at: -Infinity });
  const [sea, setSea] = useState<SeaObservation | null>(null);
  const [stormObs, setStormObs] = useState<StormObservation | null>(null);
  const [tick, setTick] = useState(0);

  // cài đặt đọc SAU hydrate (localStorage không có ở SSR)
  useEffect(() => {
    const load = () => {
      const p = readVoicePrefs();
      setPrefs(p);
      modeRef.current = p.muc;
    };
    load();
    // panel Cài đặt đổi mức giọng khi đang chạy → áp ngay
    window.addEventListener(NAV_VOICE_EVENT, load);
    return () => window.removeEventListener(NAV_VOICE_EVENT, load);
  }, []);

  /* ── phát ─────────────────────────────────────────────────────────────── */


  const runRef = useRef<(r: AnnounceResult) => void>(() => {});
  const run = useCallback((r: AnnounceResult) => {
    stRef.current = r.state;
    if (r.interrupt) {
      tokRef.current++; // câu cũ có gọi onEnd cũng bị bỏ qua
      if (leadRef.current) clearTimeout(leadRef.current);
      cancelRef.current?.();
      cancelRef.current = null;
    }
    if (r.start) {
      if (waitRef.current) {
        clearTimeout(waitRef.current);
        waitRef.current = null;
      }
      const u: Utterance = r.start;
      const tok = ++tokRef.current;
      const done = () => {
        if (tok !== tokRef.current) return;
        cancelRef.current = null;
        setSpeaking(null);
        runRef.current(finished(stRef.current, Date.now()));
      };
      const canSpeak = !!availRef.current?.ok && modeRef.current !== "tat" && !isHidden();
      if (!canSpeak) {
        if (availRef.current?.ok && modeRef.current !== "tat" && isHidden()) {
          // MÀN ĐANG TẮT: trả câu về đầu hàng, mở màn lại thì đọc (đỏ đã lỡ có
          // câu nhắc riêng — xem onVis). Không đánh dấu "đã đọc" một câu chưa ai nghe.
          stRef.current = { ...stRef.current, current: null, queue: [u, ...stRef.current.queue] };
          return;
        }
        // máy không đọc được tiếng Việt / tắt giọng: vẫn đi hết hàng để không dồn câu cũ
        queueMicrotask(done);
        return;
      }
      const go = () => {
        if (tok !== tokRef.current) return;
        setSpeaking({ text: u.text, red: u.tier === "do" });
        cancelRef.current = ttsSpeak(u.text, { onEnd: done });
      };
      const lead = (u.tier === "do" || u.tier === "vang") && u.repeat === 0 ? CHIME_LEAD_MS : 0;
      if (lead > 0) leadRef.current = setTimeout(go, lead);
      else go();
    } else if (r.waitMs != null && !waitRef.current) {
      waitRef.current = setTimeout(() => {
        waitRef.current = null;
        runRef.current(pump(stRef.current, Date.now()));
      }, r.waitMs + 20);
    }
  }, []);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  const push = useCallback(
    (events: VoiceEvent[]) => {
      run(announce(stRef.current, events, Date.now(), modeRef.current));
    },
    [run],
  );

  /* ── bật / tắt chế độ ─────────────────────────────────────────────────── */

  useEffect(() => {
    if (!inp.on) {
      tokRef.current++;
      ttsCancel();
      for (const t of [waitRef.current, leadRef.current]) if (t) clearTimeout(t);
      waitRef.current = null;
      leadRef.current = null;
      cancelRef.current = null;
      stRef.current = initAnnouncer();
      memRef.current = initVoiceMemory();
      startMsRef.current = null;
      openingDoneRef.current = false;
      extraRef.current = [];
      pendingRef.current = [];
      diemMsRef.current = -Infinity;
      fieldRef.current = { field: null, at: -Infinity };
      setSpeaking(null);
      setMuted(false);
      setSea(null);
      setStormObs(null);
      return;
    }
    startMsRef.current = Date.now();
    let alive = true;
    void ttsCheck().then((a) => {
      if (!alive) return;
      availRef.current = a;
      setAvail(a);
    });
    return () => {
      alive = false;
    };
  }, [inp.on]);

  /* ── nhịp đồng hồ 1 phút: điểm tin, pin, sóng gió, hết im ──────────────── */

  useEffect(() => {
    if (!inp.on) return;
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, [inp.on]);

  // SÓNG GIÓ từ lưới đã lưu — dựng field 1 giờ/lần, quan sát 10 phút/lần
  const seaAtRef = useRef(-Infinity);
  const posRef = useRef<LatLon | null>(null);
  useEffect(() => {
    posRef.current = inp.pos;
  }, [inp.pos]);
  useEffect(() => {
    if (!inp.on || !inp.pos) return;
    const now = Date.now();
    if (now - seaAtRef.current < SEA_REFRESH_MS && sea) return;
    seaAtRef.current = now;
    if (now - fieldRef.current.at >= FIELD_REFRESH_MS) {
      let field: WeatherField | null = null;
      try {
        const saved = loadLongestSavedGrid();
        field = saved ? gridToWeatherField(saved.grid, new Date(now), saved.savedAt) : null;
      } catch {
        field = null;
      }
      fieldRef.current = { field, at: now };
    }
    setSea(seaObservation(fieldRef.current.field, inp.pos, new Date(now), inp.lengthM));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nhịp theo tick + lần đầu có vị trí, không theo từng fix
  }, [inp.on, tick, inp.pos == null, inp.lengthM]);

  // BÃO theo GPS — tính lại khi tin bão đổi hoặc mỗi phút (bão đi chậm)
  useEffect(() => {
    if (!inp.on) return;
    setStormObs(stormObservation(inp.storm, posRef.current, Date.now(), inp.unit));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- vị trí đọc qua ref
  }, [inp.on, inp.storm, inp.unit, tick, inp.pos == null]);

  // PIN YẾU — một lần mỗi chuyến, chỉ khi không cắm sạc
  const pinSaidRef = useRef(false);
  const pinAtRef = useRef(-Infinity);
  useEffect(() => {
    if (!inp.on) {
      pinSaidRef.current = false;
      return;
    }
    const now = Date.now();
    if (pinSaidRef.current || now - pinAtRef.current < BATTERY_CHECK_MS) return;
    pinAtRef.current = now;
    const nav = typeof navigator !== "undefined" ? (navigator as Navigator & { getBattery?: () => Promise<{ level: number; charging: boolean }> }) : null;
    nav?.getBattery?.()
      .then((b) => {
        if (pinSaidRef.current || b.charging || !(b.level < BATTERY_LOW)) return;
        pinSaidRef.current = true;
        push([
          {
            key: "pin:thap",
            group: "pin",
            tier: "vang",
            rank: 9,
            text: `Pin còn ${Math.round(b.level * 100)} phần trăm. Cắm sạc để máy còn báo.`,
          },
        ]);
      })
      .catch(() => {});
  }, [inp.on, tick, push]);

  // HẾT IM 30 PHÚT
  useEffect(() => {
    if (muted && Date.now() >= stRef.current.mutedUntil) setMuted(false);
  }, [tick, muted]);

  /* ── BẢN TIN MỞ ĐẦU ───────────────────────────────────────────────────── */

  useEffect(() => {
    if (!inp.on || openingDoneRef.current || startMsRef.current == null || avail == null) return;
    const waited = Date.now() - startMsRef.current;
    // chờ kho hải đồ (tối đa 5 s) và ít nhất 1,2 s cho số bão/sóng gió kịp tính
    const need = inp.chart == null ? OPENING_WAIT_MS : OPENING_MIN_MS;
    if (waited < need) {
      const t = setTimeout(() => setTick((x) => x + 1), need - waited + 50);
      return () => clearTimeout(t);
    }
    openingDoneRef.current = true;
    const now = Date.now();
    let urgent: ReturnType<typeof computeUrgent> = [];
    try {
      // việc của chủ tàu chỉ đọc khi máy ĐÃ gắn tài khoản (cùng luật dải khẩn Trang chủ)
      if (readToken() != null) {
        urgent = computeUrgent(new Date(now), { multi: false, nameOf: () => undefined, assign: {} });
      }
    } catch {
      urgent = [];
    }
    const text = openingBulletin({
      storm: stormBulletin(inp.storm, stormObs, now),
      sea,
      urgent,
      chart: inp.chart ?? "chua-co",
      nowMs: now,
    });
    extraRef.current = [
      ...extraRef.current,
      { key: `bantin:${startMsRef.current}`, group: "bantin", tier: "bantin", text },
    ];
    setTick((x) => x + 1);
  }, [inp.on, inp.chart, inp.storm, avail, stormObs, sea, tick]);

  /* ── ĐIỂM TIN 30 PHÚT ─────────────────────────────────────────────────── */

  useEffect(() => {
    if (!inp.on || startMsRef.current == null || !openingDoneRef.current) return;
    const now = Date.now();
    if (!diemTinDue(diemMsRef.current, stRef.current.lastAlarmMs, startMsRef.current, now)) return;
    const text = diemTin({
      headingDeg: inp.headingDeg,
      speedKmh: inp.speedKmh,
      unit: inp.unit,
      depthHere: inp.depthHere,
      sea,
    });
    diemMsRef.current = now; // đứng/neo cũng tính là một lượt — 30 phút sau xét lại
    if (!text) return;
    extraRef.current = [
      ...extraRef.current,
      { key: `diem:${now}`, group: "diem", tier: "tin", rank: 9, text },
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ theo nhịp phút
  }, [inp.on, tick]);

  /* ── TẮT / MỞ MÀN ─────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!inp.on || typeof document === "undefined") return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        hiddenSinceRef.current = Date.now();
        tokRef.current++;
        ttsCancel();
        if (stRef.current.current) {
          stRef.current = { ...stRef.current, current: null, lastEndMs: Date.now() };
        }
        setSpeaking(null);
        return;
      }
      const since = hiddenSinceRef.current;
      hiddenSinceRef.current = null;
      // engine giọng có thể vừa được cài (openInstall) — hỏi lại
      void ttsCheck().then((a) => {
        availRef.current = a;
        setAvail(a);
      });
      const red = stRef.current.lastRed;
      if (since != null && red && red.atMs >= since) {
        push([
          {
            key: `recap:${since}`,
            group: "recap",
            tier: "do",
            text: `Lúc tắt màn có cảnh báo: ${red.text}`,
          },
        ]);
      } else {
        runRef.current(pump(stRef.current, Date.now()));
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [inp.on, push]);

  /* ── GOM NGUỒN → PHÁT ─────────────────────────────────────────────────── */

  useEffect(() => {
    if (!inp.on || avail == null) return;
    const extra = extraRef.current;
    extraRef.current = [];
    const { mem, events } = collectVoiceEvents(memRef.current, {
      nowMs: Date.now(),
      unit: inp.unit,
      alerts: inp.alerts,
      border: inp.border,
      offRoute: inp.offRoute,
      gps: inp.gps,
      info: inp.info,
      storm: stormObs,
      sea,
      depthHere: inp.depthHere,
      moving: inp.moving,
      legsPassed: inp.legsPassed,
      legsTotal: inp.legsTotal,
      arrived: inp.arrived,
      extra,
    });
    memRef.current = mem;
    if (!openingDoneRef.current) {
      // BẢN TIN MỞ ĐẦU ĐỌC TRƯỚC: câu không-đỏ chờ (đỏ thì không ai bắt chờ)
      pendingRef.current = [...pendingRef.current, ...events.filter((e) => e.tier !== "do")].slice(-40);
      push(events.filter((e) => e.tier === "do"));
      return;
    }
    const pend = pendingRef.current;
    pendingRef.current = [];
    push(pend.length ? [...events, ...pend] : events);
  }, [
    inp.on,
    avail,
    inp.unit,
    inp.alerts,
    inp.border,
    inp.offRoute,
    inp.gps,
    inp.info,
    stormObs,
    sea,
    inp.depthHere,
    inp.moving,
    inp.legsPassed,
    inp.legsTotal,
    inp.arrived,
    tick,
    push,
  ]);

  /* ── điều khiển từ HUD / Cài đặt ──────────────────────────────────────── */

  const setMode = useCallback((m: VoiceMode) => {
    modeRef.current = m;
    stRef.current = unmute(stRef.current);
    setMuted(false);
    setPrefs((p) => {
      const n = { ...p, muc: m };
      writeVoicePrefs(n);
      return n;
    });
    if (m === "tat") {
      tokRef.current++;
      ttsCancel();
      stRef.current = { ...stRef.current, current: null, queue: [] };
      setSpeaking(null);
    }
  }, []);

  const level: VoiceLevel = muted ? "im30" : prefs.muc;

  const cycleLevel = useCallback(() => {
    ttsUnlock(); // cử chỉ chạm thật — dịp mở khoá loa iOS
    if (muted) {
      // im 30 phút → đầy đủ
      stRef.current = unmute(stRef.current);
      setMuted(false);
      setMode("day-du");
      return;
    }
    if (prefs.muc === "day-du") setMode("it");
    else if (prefs.muc === "it") {
      stRef.current = muteFor(stRef.current, Date.now());
      setMuted(true);
      // câu không-đỏ đang đọc thì thôi
      if (stRef.current.current && stRef.current.current.tier !== "do" && !stRef.current.current.chart) {
        tokRef.current++;
        ttsCancel();
        stRef.current = { ...stRef.current, current: null };
        setSpeaking(null);
      }
    } else setMode("day-du");
  }, [muted, prefs.muc, setMode]);

  const ack = useCallback(() => {
    stRef.current = acknowledge(stRef.current, null);
  }, []);

  const testSpeak = useCallback(() => {
    ttsUnlock();
    void ttsCheck().then((a) => {
      availRef.current = a;
      setAvail(a);
      if (a.ok) ttsSpeak(VOICE_TEST_TEXT);
    });
  }, []);

  const openInstall = useCallback(() => {
    void ttsOpenInstall();
  }, []);

  const markIntroSeen = useCallback(() => {
    setPrefs((p) => {
      const n = { ...p, daXem: true };
      writeVoicePrefs(n);
      return n;
    });
  }, []);

  return {
    level,
    cycleLevel,
    setMode,
    avail,
    speaking,
    ack,
    testSpeak,
    openInstall,
    prefs,
    markIntroSeen,
  };
}
