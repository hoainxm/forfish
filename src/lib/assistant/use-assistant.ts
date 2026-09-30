"use client";

// TRỢ LÝ — MÁY TRẠNG THÁI (14 §5.4, 13 §4.1/§4.2/§7.1).
//
// Một lượt = đúng 1 câu vào → 1 câu ra. Tầng máy chạy TRƯỚC và luôn chạy
// (`parseUtterance` + `answerOffline`); chỉ khi tầng máy không đủ (câu hỏi mở,
// hoặc không hiểu câu dài) VÀ đủ ba điều kiện (có sóng · đã đăng nhập · còn
// lượt) mới gọi `/api/tro-ly`. `ngoai_pham_vi` KHÔNG BAO GIỜ lên máy chủ.
// Không bao giờ kẹt ở `thinking`: mọi nhánh kết thúc bằng `answered` hoặc `error`.
//
// KHÔNG làm gì lúc mount: snapshot chỉ gom khi bà con hỏi (CLAUDE.md 🟡 a).
// Đăng nhập hỏi `useAuthUser().signedIn` — không cầm `user` (identity-gate).
//
// Cấu trúc: toàn bộ logic nằm trong MỘT "bộ máy" (`createEngine`) tạo một lần,
// giữ trạng thái mutable (mic, AbortController, câu đang chờ xác nhận) và đẩy
// React state qua `setState`. Hook chỉ là lớp vỏ — tránh chuỗi useCallback phụ
// thuộc vòng nhau (react-hooks lint) và tránh đọc ref lúc render.
//
// nợ: tự đóng tấm che sau 20 s không tương tác chưa làm ở hook (hợp đồng §5.4 không có onClose), UI tự đo theo `state` — nâng cấp khi QA AC-T48 đỏ

import { useEffect, useMemo, useState } from "react";
import { loadBoats } from "@/lib/boats";
import { todayIsoVN } from "@/lib/days";
import { authedFetch } from "@/lib/device-token-store";
import { marketGet } from "@/lib/market/client";
import { foldVn } from "@/lib/market/text";
import type { ProductCard } from "@/lib/market/types";
import { useAuthUser } from "@/lib/use-auth";
import { isOffline } from "@/lib/use-online";
import { answerOffline, onlineErrorReply } from "./answer";
import { knowledgeReply, searchKnowledge, voiceRegion, type VoiceRegion } from "./brain";
import { audioUrlFor, loadBrain, refreshBrainPack, type LoadedBrain } from "./brain-pack";
import { gomSnapshot, stripForServer } from "./device-snapshot";
import { loadAssistantPrefs, pushAssistantTurn, saveAssistantPrefs, type AssistantPrefs } from "./history";
import { wordCount } from "./normalize";
import { CONFIDENCE_OFFLINE, parseUtterance } from "./parse";
import { ALL_PORT_NAMES, portById, portByKey } from "./ports";
import { cancelSpeak, listenOnce, setPackVoice, speak, sttSupported, type ListenErrorCode, type ListenHandle } from "./speech";
import { suggestionsFor } from "./suggestions";
import type {
  AssistantAction, AssistantErrorCode, AssistantReply, AssistantResponse, DeviceSnapshot, ParsedIntent, Suggestion,
} from "./types";
import { NEVER_ONLINE, ONLINE_FIRST } from "./types";

export type AssistantState =
  | { kind: "idle" }
  | { kind: "listening"; interim: string }
  | { kind: "thinking"; text: string; online: boolean }
  | { kind: "answered"; text: string; reply: AssistantReply; awaitingConfirm: boolean }
  | { kind: "error"; message: string; typeFallback: boolean };

const CLIENT_TIMEOUT_MS = 25_000; // > 20 s máy chủ để nhận 504 thật (14 §8)
const SHORT_WORDS = 6;
/** Im lặng lần 1: đọc "chưa nghe rõ" xong mới mở mic lại (đủ cho một câu 5 chữ). */
const RELISTEN_MS = 1600;
/** Hành động làm NGAY, không cần chạm xác nhận (14 §5.4). */
const IMMEDIATE: AssistantAction["type"][] = ["navigate", "search", "mute", "setHomePort", "setBoat"];

const COPY = {
  micDenied: "Máy chưa cho dùng mic. Bác gõ hoặc chọn bên dưới.",
  network: "Mất sóng nên tôi không nghe được, bác chạm câu bên dưới. Tôi vẫn trả lời được việc trong máy.",
  noStt: "Máy này chưa nói được với tôi — bác gõ hoặc chọn bên dưới.",
  pickChip: "Bác thử chọn một trong mấy cái này:",
  // im lặng lần 1 (P1-18): phải NÓI ra, không chỉ mở mic lại — bà con đang lái tàu, mắt không nhìn màn
  noSpeech: "Tôi chưa nghe rõ, bác nói lại giúp.",
  noPort: "Không thấy cảng tên đó trong danh sách. Bác chọn trong danh sách cảng giúp.",
  // P1-7 (chốt lead 2026-09-06): "ừ" bằng giọng chỉ chạy việc hoàn tác được; gọi điện vẫn PHẢI chạm
  tapCall: "Gọi điện thì bác chạm nút Gọi giúp tôi.",
};

function hourVN(now = Date.now()): number {
  return new Date(now + 7 * 3600_000).getUTCHours();
}

/*  Cùng luật với `isPurchasable` (lib/market/pricing.ts) nhưng đọc `shopPaused`
    của THẺ (trợ lý chỉ có ProductCard, không có Shop). Trả về type guard để
    món LIÊN HỆ BÁO GIÁ (priceVnd null) bị loại khỏi luồng "thêm vào giỏ" ngay ở
    tầng kiểu — trợ lý mà mời bà con đặt món chưa có giá là hứa suông. */
function purchasable(p: ProductCard): p is ProductCard & { priceVnd: number } {
  return (
    p.status === "dang_ban" && !p.adminHidden && !p.deletedAt && p.stock >= 1 &&
    !p.shopPaused && p.priceVnd != null
  );
}

/** Điền `portId` thật cho setHomePort / `boatId` thật cho setBoat (answer thuần chỉ có tên đã fold). */
function enrichAction(reply: AssistantReply): AssistantReply {
  const a = reply.action;
  if (!a) return reply;
  if (a.type === "setHomePort") {
    // answer đã tra danh sách thật (ports.ts) — chỉ kiểm lại id còn tồn tại; không có thì tra theo khoá tên
    const p = portById(a.portId) ?? portByKey(a.portName);
    if (!p) return { ...reply, action: undefined, text: COPY.noPort, speak: COPY.noPort };
    return { ...reply, action: { type: "setHomePort", portId: p.id, portName: p.name, ...(p.province ? { province: p.province } : {}) } };
  }
  if (a.type === "setBoat") {
    const want = foldVn(a.boatName);
    const b = loadBoats().find((x) => foldVn(x.name) === want);
    if (!b) return { ...reply, action: undefined };
    return { ...reply, action: { type: "setBoat", boatId: b.id, boatName: b.name } };
  }
  return reply;
}

function quotaExhausted(prefs: AssistantPrefs, limitGuess = 30): boolean {
  const q = prefs.quota;
  return !!q && q.day === todayIsoVN(Date.now()) && q.used >= limitGuess;
}

/** them_gio ONLINE (brief §4 #1): tìm top 3 trên chợ, chạm thẻ = xác nhận. */
async function fillCandidates(reply: AssistantReply, p: ParsedIntent): Promise<AssistantReply> {
  const q = p.slots.q ?? "";
  const qty = p.slots.qty ?? 1;
  const r = await marketGet<{ ok: boolean; items: ProductCard[] }>(`/api/cho/san-pham?q=${encodeURIComponent(q)}&pageSize=3`, 12_000);
  if (!r.ok) return reply; // mất sóng/lỗi → giữ câu offline
  const items = (r.data.items ?? []).filter(purchasable).slice(0, 3);
  if (items.length === 0) {
    const text = "Chợ chưa có món tên đó. Bác nói tên khác, hoặc mở chợ coi theo nhóm.";
    return { ...reply, text, speak: text, clarify: { question: "", options: [{ label: "Mở chợ", utterance: "mở chợ" }] } };
  }
  const candidates = items.map((it) => ({
    productId: it.id, title: it.title, priceVnd: it.priceVnd, shopName: it.shopName,
    ...(it.variants?.length ? { variants: it.variants.map((v) => v.label) } : {}),
  }));
  if (items.length === 1) {
    const it = items[0];
    const text = `Thêm ${qty} ${it.title}, ${it.shopName} vào giỏ nhé?`;
    const base: AssistantReply = {
      ...reply, text, speak: text, candidates, qty,
      action: { type: "addToCart", productId: it.id, title: it.title, qty, shopName: it.shopName, priceVnd: it.priceVnd },
      confirm: { question: text },
    };
    if (it.variants?.length && !p.slots.unit) {
      return { ...base, clarify: { question: "Loại nào?", options: it.variants.slice(0, 4).map((v) => ({ label: v.label, utterance: `thêm ${qty} ${it.title} ${v.label} vào giỏ` })) } };
    }
    return base;
  }
  const text = `Tìm được ${items.length} món. Bác chạm món cần thêm.`;
  // `reply.qty` = số bà con đã nói — UI mở sẵn bộ đếm đúng số trên MỌI thẻ (14 §3.1; audit P0-3)
  return { ...reply, text, speak: text, candidates, qty };
}

interface EngineCtx {
  route: string;
  signedIn: boolean;
  onAction(a: AssistantAction): void;
}

interface Engine {
  setCtx(c: EngineCtx): void;
  ask(text: string): Promise<void>;
  listen(): void;
  confirm(yes: boolean, said?: string): void;
  cancel(): void;
  /** effect mount: bỏ lệnh huỷ đang hẹn (StrictMode dev chạy cleanup rồi mount lại ngay) */
  mounted(): void;
  /** effect cleanup: hẹn huỷ ở tick sau — unmount thật mới huỷ mic/đọc, mount lại ngay thì không */
  scheduleCancel(): void;
  setMuted(v: boolean): void;
  lastSnapshot(): DeviceSnapshot | null;
  onHidden(): void;
  /** có sóng: kiểm gói não mới (≤1 lần/6 giờ, có đồng hồ) rồi nạp lại nếu đổi */
  refreshBrain(): void;
  /** hỏi lại quyền mic của trình duyệt: không còn bị chặn → bỏ cờ `micDenied` */
  recheckMic(): void;
  /** bà con chạm "Thử nói lại" sau khi đã bật mic trong cài đặt */
  retryMic(): void;
}

function createEngine(
  ctx0: EngineCtx,
  setState: (s: AssistantState) => void,
  setPrefs: (p: AssistantPrefs) => void,
  setSnap: (s: DeviceSnapshot | null) => void,
): Engine {
  const ctxRef = { current: ctx0 };
  let prefs = loadAssistantPrefs();
  let snapshot: DeviceSnapshot | null = null;
  let pending: AssistantReply | null = null;
  let lastReply: AssistantReply | null = null;
  let listenHandle: ListenHandle | null = null;
  let ac: AbortController | null = null;
  let stopSpeak: (() => void) | null = null;
  let misheard = 0;
  let noSpeech = 0;
  let seq = 0;
  let stateKind: AssistantState["kind"] = "idle";
  let cancelTimer: ReturnType<typeof setTimeout> | null = null;
  let reListen: ReturnType<typeof setTimeout> | null = null;
  /*  GÓI NÃO (ADR 0010 P1): kho kiến thức + mp3 giọng Sen Biển, đọc từ kho riêng
      trong máy — không cần sóng. Chưa có gói → `null`, hành vi y như trước. */
  let brain: LoadedBrain | null = null;
  let region: VoiceRegion = "bac";
  const applyBrain = (b: LoadedBrain | null) => {
    brain = b;
    setPackVoice(b ? (text) => audioUrlFor(brain, text, region) : null);
  };
  void loadBrain().then(applyBrain);

  const push = (s: AssistantState) => {
    stateKind = s.kind;
    setState(s);
  };
  const savePrefs = (next: AssistantPrefs) => {
    prefs = next;
    saveAssistantPrefs(next);
    setPrefs(next);
  };
  const doAction = (a: AssistantAction) => {
    try {
      ctxRef.current.onAction(a);
    } catch (e) {
      console.error("[tro-ly] onAction hỏng:", (e as Error)?.message);
    }
  };
  const say = (text: string) => {
    stopSpeak?.();
    stopSpeak = prefs.muted || !text ? null : speak(text);
  };

  const cancel = () => {
    seq += 1;
    if (reListen) clearTimeout(reListen);
    reListen = null;
    listenHandle?.abort();
    listenHandle = null;
    ac?.abort();
    ac = null;
    stopSpeak?.();
    stopSpeak = null;
    cancelSpeak();
  };

  const finish = (reply0: AssistantReply, said: string) => {
    const reply = enrichAction(reply0);
    lastReply = reply;
    const needsTap = !!reply.confirm || reply.action?.type === "addToCart" || reply.action?.type === "call";
    /*  P1-N1 (audit vòng 2): nút "Mở Giấy tờ" hiện kèm lời mời 'Bác nói "ừ"',
        mà "ừ" lại rơi vào "chưa nghe rõ" vì navigate chạy ngay rồi, không còn
        việc treo. Đi tới màn là việc ĐẢO NGƯỢC ĐƯỢC (13 §4.3) — giữ treo để
        tiếng "ừ" đi thật. Trừ `mo_man` ("mở giấy tờ"): bà con đã nói rõ muốn
        đi, hỏi lại là thừa một chạm (13 §10 việc 18). */
    const navAsk = !needsTap && reply.action?.type === "navigate" && reply.intent !== "mo_man";
    pending = (needsTap || navAsk) && reply.action ? reply : null;
    if (reply.action && !needsTap && !navAsk && IMMEDIATE.includes(reply.action.type)) doAction(reply.action);
    push({ kind: "answered", text: said, reply, awaitingConfirm: needsTap });
    say(reply.speak);
    if (reply.text) {
      pushAssistantTurn({ q: said, a: reply.text, at: Date.now(), intent: reply.intent, source: reply.source });
      prefs = loadAssistantPrefs();
      setPrefs(prefs);
    }
  };

  /** `said` = câu bà con NÓI ("ừ"/"thôi"); chạm nút thì rỗng — màn không in "Bác vừa nói: ừ" giả (audit P2-1). */
  const confirm = (yes: boolean, said = "") => {
    const p = pending;
    pending = null;
    if (!p) return;
    if (yes && p.action) doAction(p.action);
    const text = yes ? "Rồi." : "Thôi vậy.";
    const reply: AssistantReply = { ...p, action: undefined, confirm: undefined, candidates: undefined, clarify: undefined, text, speak: text };
    push({ kind: "answered", text: said, reply, awaitingConfirm: false });
  };

  const ask = async (raw: string) => {
    const said = raw.trim();
    if (!said) return;
    cancel();
    const mySeq = seq;
    const alive = () => seq === mySeq;
    const route = ctxRef.current.route;
    snapshot = gomSnapshot(route);
    setSnap(snapshot);
    region = voiceRegion(snapshot.home?.province);
    const parsed = parseUtterance(said, {
      route,
      awaitingConfirm: !!pending,
      boatNames: snapshot.boat?.names ?? [],
      portNames: ALL_PORT_NAMES,
      placeNames: snapshot.placeNames,
    });

    // ── điều khiển ──
    if (parsed.intent === "xac_nhan" && pending) {
      // P1-7 (chốt lead): "ừ/đồng ý" bằng giọng chạy việc HOÀN TÁC ĐƯỢC (thêm giỏ, mở màn);
      // gọi điện vẫn phải CHẠM — nghe sai một chữ là gọi nhầm người
      if (pending.action?.type === "call") {
        const keep = pending;
        push({ kind: "answered", text: said, reply: { ...keep, text: COPY.tapCall, speak: COPY.tapCall }, awaitingConfirm: true });
        say(COPY.tapCall);
        return;
      }
      return confirm(true, said);
    }
    if (parsed.intent === "tu_choi" && pending) return confirm(false, said);
    // câu mới = bỏ việc đang chờ xác nhận (UI có thể đã làm qua thẻ món mà không gọi confirm) — không để "ừ" sau này làm lại
    pending = null;
    // nói đúng chữ trên chip ("đổi lại", "gọi SDVICO") = chạm chip đó — cách "đổi lại" hoạt động bằng giọng (audit P1-4)
    if (parsed.confidence < CONFIDENCE_OFFLINE) {
      const chipHit = lastReply?.clarify?.options.find((o) => foldVn(o.label) === parsed.normalized);
      if (chipHit && foldVn(chipHit.utterance) !== parsed.normalized) return ask(chipHit.utterance);
    }
    if (parsed.intent === "lap_lai") {
      if (lastReply) {
        push({ kind: "answered", text: said, reply: lastReply, awaitingConfirm: false });
        say(lastReply.speak);
      } else {
        finish(answerOffline({ ...parsed, intent: "khong_hieu" }, snapshot, Date.now()), said);
      }
      return;
    }
    if (parsed.intent === "huy") {
      pending = null;
      push({ kind: "idle" });
      return;
    }
    if (parsed.intent === "tat_tieng" || parsed.intent === "bat_tieng") {
      savePrefs({ ...prefs, muted: parsed.intent === "tat_tieng" });
      return finish(answerOffline(parsed, snapshot, Date.now()), said);
    }

    // ── tầng máy trước ──
    const short = wordCount(parsed.normalized) <= SHORT_WORDS;
    const explicitClarify = parsed.intent === "dat_cang_nha" || parsed.intent === "dan_duong" || parsed.intent === "tau_cua_toi";
    const offlineEnough =
      (NEVER_ONLINE as readonly string[]).includes(parsed.intent) ||
      (parsed.confidence >= CONFIDENCE_OFFLINE && !(ONLINE_FIRST as readonly string[]).includes(parsed.intent)) ||
      explicitClarify ||
      (parsed.intent === "khong_hieu" && (!!parsed.reason || !!parsed.followUp || !!parsed.slots.q));

    if (offlineEnough) {
      misheard = 0;
      push({ kind: "thinking", text: said, online: false });
      let reply = answerOffline(parsed, snapshot, Date.now());
      if (parsed.intent === "them_gio" && snapshot.online) {
        reply = await fillCandidates(reply, parsed).catch(() => reply);
        if (!alive()) return;
      }
      return finish(reply, said);
    }

    // ── kho kiến thức trong máy (T1): câu hỏi mở tìm trong kho ĐÃ DUYỆT trước khi tốn sóng/lượt ──
    if (parsed.intent === "hoi_mo" || parsed.intent === "khong_hieu") {
      const b = brain ?? (await loadBrain());
      if (!alive()) return;
      if (b !== brain) applyBrain(b);
      const hit = b ? searchKnowledge(b.knowledge, said) : null;
      if (hit) {
        misheard = 0;
        return finish(knowledgeReply(hit), said);
      }
    }

    // câu ngắn không hiểu → hỏi lại lần 1 trước, không tốn lượt (13 §11 #13)
    if (parsed.intent === "khong_hieu" && short && misheard === 0) {
      misheard = 1;
      return finish(answerOffline(parsed, snapshot, Date.now()), said);
    }

    // ── online: cả ba điều kiện (13 §7.1) ──
    if (!snapshot.online) return finish(onlineErrorReply("offline", snapshot), said);
    if (!ctxRef.current.signedIn) return finish(onlineErrorReply("no_token", snapshot), said);
    if (quotaExhausted(prefs)) return finish(onlineErrorReply("quota", snapshot), said);

    push({ kind: "thinking", text: said, online: true });
    ac = new AbortController();
    const body = { text: said, route, snapshot: stripForServer(snapshot) };
    const { res } = await authedFetch("/api/tro-ly", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: ac.signal,
    }, CLIENT_TIMEOUT_MS).catch(() => ({ res: null }));
    if (!alive()) return;
    if (!res) return finish(onlineErrorReply(isOffline() ? "offline" : "timeout", snapshot), said);
    let json: AssistantResponse | null = null;
    try {
      json = (await res.json()) as AssistantResponse;
    } catch {
      json = null;
    }
    if (!alive()) return;
    if (!json || !json.ok) {
      const code = (json && !json.ok ? json.code : res.status === 401 ? "no_token" : "upstream") as AssistantErrorCode;
      if (code === "quota") savePrefs({ ...prefs, quota: { day: todayIsoVN(Date.now()), used: 9999 } });
      return finish(onlineErrorReply(code, snapshot), said);
    }
    const day = todayIsoVN(Date.now());
    const used = (prefs.quota?.day === day ? prefs.quota.used : 0) + 1;
    savePrefs({ ...prefs, quota: { day, used } });
    let reply = json.reply;
    if (json.remaining === 5 || json.remaining === 1) {
      reply = { ...reply, text: `${reply.text}\nCòn ${json.remaining} câu cần sóng hôm nay.` };
    }
    misheard = 0;
    return finish(reply, said);
  };

  const onListenError = (code: ListenErrorCode) => {
    listenHandle = null;
    const snap = snapshot ?? gomSnapshot(ctxRef.current.route);
    switch (code) {
      case "not-allowed":
        savePrefs({ ...prefs, micDenied: true, micAsked: true });
        push({ kind: "error", message: COPY.micDenied, typeFallback: true });
        return;
      case "network":
        push({ kind: "error", message: COPY.network, typeFallback: true });
        return;
      case "unsupported":
      case "audio-capture":
      case "other":
        push({ kind: "error", message: COPY.noStt, typeFallback: true });
        return;
      case "aborted":
        if (stateKind === "listening") push({ kind: "idle" });
        return;
      case "no-speech": {
        noSpeech += 1;
        const reply = answerOffline({ intent: "khong_hieu", confidence: 0, slots: {}, normalized: "" }, snap, Date.now());
        if (noSpeech === 1) {
          push({ kind: "answered", text: "", reply: { ...reply, text: COPY.noSpeech, speak: COPY.noSpeech, clarify: undefined }, awaitingConfirm: false });
          say(COPY.noSpeech);
          /*  Mở mic lại SAU khi đọc xong: `listenImpl()` gọi thẳng ở đây thì màn
              "Đang nghe…" đè mất câu vừa hiện và chính lệnh mở mic cắt tiếng
              đang đọc — bà con không thấy chữ, không nghe tiếng (audit P1-18). */
          if (reListen) clearTimeout(reListen);
          reListen = setTimeout(() => {
            reListen = null;
            listenImpl();
          }, RELISTEN_MS);
        } else {
          // lần 2 vẫn im: thôi mở mic nữa, đưa chip để bà con chạm (13 §5.4)
          push({ kind: "answered", text: "", reply: { ...reply, text: COPY.pickChip, speak: COPY.pickChip }, awaitingConfirm: false });
          say(COPY.pickChip);
        }
        return;
      }
    }
  };

  const listenImpl = () => {
    if (reListen) clearTimeout(reListen);
    reListen = null;
    if (!sttSupported()) {
      push({ kind: "error", message: COPY.noStt, typeFallback: true });
      return;
    }
    stopSpeak?.();
    stopSpeak = null;
    cancelSpeak();
    if (!prefs.micAsked) savePrefs({ ...prefs, micAsked: true });
    push({ kind: "listening", interim: "" });
    listenHandle = listenOnce({
      onInterim: (t) => {
        if (stateKind === "listening") push({ kind: "listening", interim: t });
      },
      onFinal: (t) => {
        listenHandle = null;
        noSpeech = 0;
        void ask(t);
      },
      onError: onListenError,
    });
  };

  const mounted = () => {
    if (cancelTimer) clearTimeout(cancelTimer);
    cancelTimer = null;
  };
  const scheduleCancel = () => {
    if (cancelTimer) clearTimeout(cancelTimer);
    // StrictMode (dev) chạy cleanup → mount lại trong CÙNG tick: `mounted()` kịp bỏ hẹn, mic không bị huỷ sau 1 ms (audit P0-2)
    cancelTimer = setTimeout(() => {
      cancelTimer = null;
      cancel();
    }, 0);
  };

  const listen = () => {
    if (listenHandle) {
      listenHandle.stop(); // đang nghe → chạm lần nữa = dừng
      return;
    }
    listenImpl();
  };

  const setMuted = (v: boolean) => {
    if (v) {
      stopSpeak?.();
      stopSpeak = null;
      cancelSpeak();
    }
    savePrefs({ ...prefs, muted: v });
  };

  const onHidden = () => {
    if (reListen) clearTimeout(reListen);
    reListen = null;
    listenHandle?.abort();
    listenHandle = null;
    stopSpeak?.();
    stopSpeak = null;
    cancelSpeak();
    if (stateKind === "listening" || stateKind === "thinking") push({ kind: "idle" });
  };

  return {
    setCtx: (c) => {
      ctxRef.current = c;
    },
    ask, listen, confirm, cancel, mounted, scheduleCancel, setMuted, lastSnapshot: () => snapshot, onHidden,
    refreshBrain: () => {
      if (isOffline()) return;
      void refreshBrainPack().then((r) => {
        if (r === "moi") void loadBrain().then(applyBrain);
      });
    },
    /*  `micDenied` từng là cờ MỘT CHIỀU: bị từ chối một lần là vòng mic biến mất
        mãi, kể cả khi bà con đã vào cài đặt bật lại (bug 2026-09-30). Nay mỗi lần
        mở trợ lý hỏi lại trình duyệt; máy không hỗ trợ hỏi (Safari cũ) thì còn
        nút "Thử nói lại" ở tấm che. */
    recheckMic: () => {
      if (!prefs.micDenied) return;
      const perms = typeof navigator !== "undefined" ? navigator.permissions : undefined;
      if (!perms?.query) return;
      perms
        .query({ name: "microphone" as PermissionName })
        .then((st) => {
          if (st.state !== "denied" && prefs.micDenied) savePrefs({ ...prefs, micDenied: false });
        })
        .catch(() => {});
    },
    retryMic: () => {
      savePrefs({ ...prefs, micDenied: false });
      listenImpl();
    },
  };
}

export function useAssistant(opts: { route: string; onAction(a: AssistantAction): void }) {
  const { route, onAction } = opts;
  const { signedIn } = useAuthUser();
  const [state, setState] = useState<AssistantState>({ kind: "idle" });
  const [prefs, setPrefs] = useState<AssistantPrefs>(() => loadAssistantPrefs());
  const [snap, setSnap] = useState<DeviceSnapshot | null>(null);
  const [engine] = useState(() => createEngine({ route, onAction, signedIn }, setState, setPrefs, setSnap));

  // ngữ cảnh mới nhất cho bộ máy — cập nhật trong effect, không đụng ref lúc render (react-hooks/refs)
  useEffect(() => {
    engine.setCtx({ route, onAction, signedIn });
  }, [engine, route, onAction, signedIn]);

  // app vào nền → dừng nghe/nói (13 §4.1); tấm che đóng (unmount THẬT) → huỷ mọi thứ.
  // Huỷ được HẸN sang tick sau: StrictMode dev cleanup rồi mount lại ngay, `mounted()` bỏ hẹn — mic mở lúc chạm FAB không bị abort (P0-2)
  useEffect(() => {
    engine.mounted();
    // mở trợ lý (bà con chủ động chạm — không phải lúc mở app) + có sóng → kiểm gói não mới
    engine.refreshBrain();
    engine.recheckMic();
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") engine.onHidden();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      engine.scheduleCancel();
    };
  }, [engine]);

  const suggestions: Suggestion[] = useMemo(() => suggestionsFor(route, hourVN(), snap), [route, snap]);

  return {
    state,
    muted: prefs.muted,
    setMuted: engine.setMuted,
    listen: engine.listen,
    ask: (text: string) => {
      void engine.ask(text);
    },
    confirm: (yes: boolean) => engine.confirm(yes),
    cancel: engine.cancel,
    suggestions,
    turns: prefs.last,
    micDenied: prefs.micDenied,
    retryMic: engine.retryMic,
  };
}
