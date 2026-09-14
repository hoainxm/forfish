"use client";

/*
  TẤM CHE TRỢ LÝ — toàn màn (14 §7.2, chốt của lead ở TROLY-BRIEF §1).

  Vì sao KHÔNG dùng `BottomSheet` chung dù 13 §5.2 gọi tên nó: tấm che này cần
  trọn chiều cao cho MỘT thứ duy nhất — vòng mic to + câu trả lời chữ TO — và
  KHÔNG có nền sau để nhìn (bà con đang nói với máy, không đang xem màn). Sheet
  chung neo đáy, trần 85dvh, có scrim: cả ba đều thừa ở đây. Đổi lại tấm che tự
  làm đủ ba việc a11y mà sheet chung làm: bẫy focus, Esc đóng, khoá cuộn nền.

  Bố cục = 6 khối KEY của 13 §5.2, đúng thứ tự trên → dưới:
    1 tiêu đề + Tắt tiếng + X   2 vòng mic + chữ nghe được   3 câu trả lời chữ TO
    4 thẻ hành động (0 hoặc 1)   5 chip gợi ý   6 "Gõ thay vì nói" / ô gõ

  Ô GÕ KHÔNG PHẢI ĐƯỜNG PHỤ. Nhận giọng của trình duyệt chạy trên máy chủ
  Apple/Google ⇒ MẤT SÓNG LÀ MẤT MIC (14 §0 chốt #4). Ngoài biển đó là ca
  THƯỜNG, nên khi không nghe được thì chip + ô gõ lên làm hàng chính ngay,
  không đợi hết 8 giây im lặng.
*/

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { QtyStepper } from "@/components/cart-sheet";
import {
  KeyboardIcon,
  MicIcon,
  SendIcon,
  SpeakerIcon,
  SpeakerOffIcon,
} from "@/components/icons";
import { CloseButton } from "@/components/ui/close-button";
import { inputClass } from "@/components/ui/primitives";
import { StatusBanner } from "@/components/ui/status-banner";
import type { AssistantAction, AssistantReply, DeviceSnapshot, Suggestion } from "@/lib/assistant/types";
import { hasVietnameseVoice, speak, sttSupported, ttsSupported } from "@/lib/assistant/speech";
import { gomSnapshot } from "@/lib/assistant/device-snapshot";
import { loadAssistantPrefs } from "@/lib/assistant/history";
import { extractQty, normalizeUtterance } from "@/lib/assistant/normalize";
import { taskChip } from "@/lib/assistant/suggestions";
import { useAssistant } from "@/lib/assistant/use-assistant";
import { formatVnd } from "@/lib/format";
import { savedAgoLabel } from "@/lib/forecast-cache";
import { tapFeedback } from "@/lib/haptics";
import { useOnline } from "@/lib/use-online";
import { useAssistantActions, type ActionNote } from "./assistant-actions";
import { AssistantBubble } from "./assistant-bubble";

/*  ĐIỀU HƯỚNG KHÔNG ĐƯỢC TỰ NHẢY khi câu trả lời còn đang đọc dở.

    Gần như mọi ý định đều kèm một `navigate` để bà con đi tiếp (13 §3 cột
    Action): hỏi thời tiết kèm `/ngu-truong`, hỏi giấy tờ kèm `/tau?tab=giay-to`.
    Chạy thẳng cái đó là ĐÓNG tấm che ngay lúc câu trả lời vừa hiện — bà con
    không kịp đọc, TTS bị cắt, và P2 của 13 ("0 chạm để NGHE") vỡ.

    Nên chỉ hai ca tự chạy, là hai ca bà con ĐÃ NÓI RÕ muốn đi:
    · `mo_man` — "mở giấy tờ" (13 §10 việc 18 = 1 chạm);
    · `search` — "cần mua nhớt", câu trả lời tự nói "Tôi mở chợ tìm…" (việc 10).
    Còn lại thành MỘT nút để chạm khi đọc xong — đúng 13 §4.3 dòng "Điều hướng:
    không xác nhận, 1 nút hoặc chip, chạm rồi mới đóng tấm che". */
const NAV_LABEL: [string, string][] = [
  ["/tau?tab=giay-to", "Mở Giấy tờ"],
  ["/tau?tab=dich-vu", "Mở Bảo dưỡng"],
  ["/tau?tab=san-pham", "Mở Sản phẩm"],
  ["/cho/gio", "Mở Giỏ hàng"],
  ["/cho/don", "Mở Đơn của tôi"],
  ["/ngu-truong", "Mở Ra khơi"],
  ["/ban-hang", "Mở Bán hàng"],
  ["/nguoi", "Mở Bạn thuyền"],
  ["/huong-dan", "Mở Hướng dẫn"],
  ["/login", "Đăng nhập"],
  ["/tien", "Mở Giao dịch"],
  ["/cang", "Mở Cảng cá"],
  ["/tau", "Mở Tàu cá"],
  ["/cho", "Mở Chợ"],
];
/*  Đồng hồ của tấm che (13 §4.1 + §5.4). Ba mốc, ba lý do khác nhau:
    · 300 ms — dưới ngưỡng này bà con không kịp thấy chữ nháy, hiện "Đang nghĩ…"
      sớm hơn chỉ làm màn giật (tầng máy thường trả lời trong 500 ms);
    · 8 s — đổi câu để bà con biết máy còn sống, chưa treo;
    · 20 s — trạng thái "xong" mà không ai chạm gì thì tự đóng, trả màn về việc
      đang làm dở (AC-T48). Chạm bất kỳ đâu trong tấm che là huỷ đồng hồ này. */
const THINK_SHOW_MS = 300;
const THINK_SLOW_MS = 8000;
const AUTO_CLOSE_MS = 20_000;

function navLabel(href: string): string {
  return NAV_LABEL.find(([h]) => href.startsWith(h))?.[1] ?? (href === "/" ? "Về Trang chủ" : "Đi tới");
}

/*  MẤT SÓNG LÚC MỞ — câu chốt của lead (13 §5.4). Phải hiện NGAY lúc mở, không
    đợi mic báo lỗi: nhận giọng chạy trên máy chủ Apple/Google nên mất sóng là
    mất mic, mà màn chỉ có ô gõ trống thì bà con không biết vì sao mất vòng mic. */
const OFFLINE_LINE =
  "Mất sóng nên tôi không nghe được, bác chạm câu bên dưới. Tôi vẫn trả lời được việc trong máy.";

/** Chip "Con nước hôm nay" — bỏ khi máy chưa có bảng con nước (snapshot `tide` null). */
const TIDE_UTTERANCE = "con nước hôm nay";
/*  Chip đắp vào khi bỏ bớt chip ở trên: `/ngu-truong` mà bỏ "Con nước" thì chỉ
    còn MỘT chip (chip giờ trùng "Có bão không"), mà 13 §5.3 muốn 3–4 câu sẵn —
    một chip trơ trọi thì bà con mất luôn đường đi vòng khi mic hỏng. Hai câu
    này hỏi được ở mọi màn và trả lời được cả lúc mất sóng. */
const FILL_CHIPS: Suggestion[] = [
  { label: "Thời tiết hôm nay", utterance: "thời tiết hôm nay" },
  { label: "Giấy sắp hết hạn", utterance: "giấy tờ sắp hết hạn" },
];

/** Số lượng hợp lệ (13 INT-14: 1..999) hay `null`. */
function asQty(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 1 ? Math.min(999, Math.round(v)) : null;
}

/*  SỐ LƯỢNG BÀ CON VỪA NÓI — "bỏ 5 cây đá vô giỏ" phải là 5 trên bộ đếm, kể cả
    khi có 2–3 thẻ món (lúc đó `reply.action` rỗng vì máy chưa biết chọn thẻ nào).
    Nói số rồi mà nút vẫn nằm ở 1 là MUA HỤT — không phải chuyện thừa một chạm.

    Ba nguồn, tin cậy giảm dần:
    1. `reply.qty` — số bà con đã nói, tầng máy trả về kể cả khi có ≥2 thẻ;
    2. `action.qty` — ca một thẻ;
    3. bóc lại từ chính câu bà con nói (lưới an toàn cho câu trả lời không kèm
       số, vd bản giả lập). `extractQty` chỉ bắt số ở ĐẦU chuỗi ("2 thùng
       nhớt"), mà câu thường là "bỏ 5 cây đá vô giỏ" — nên cắt từ chữ số đầu
       tiên rồi mới đưa vào, dùng lại đúng bộ đếm số + đơn vị của tầng máy
       (`normalizeUtterance` đã đổi "hai" → 2). */
function spokenQty(reply: AssistantReply, said: string): number | null {
  const known =
    asQty(reply.qty) ??
    asQty(reply.action?.type === "addToCart" ? reply.action.qty : undefined);
  if (known) return known;
  if (reply.intent !== "them_gio" || !said) return null;
  const norm = normalizeUtterance(said);
  const at = norm.search(/\d/);
  return at < 0 ? null : (extractQty(norm.slice(at))?.qty ?? null);
}

/** Nhãn nút xác nhận theo việc sắp làm — bà con đọc nút là biết chuyện gì xảy ra. */
function confirmLabel(a: AssistantAction | undefined): string {
  switch (a?.type) {
    case "call":
      return "Gọi";
    case "addToCart":
      return "Thêm vào giỏ";
    case "navigate":
    case "search":
      return "Đi tới";
    default:
      return "Được";
  }
}

/*  HƯỚNG DẪN XÁC NHẬN (P1-7, chốt lead 2026-09-06 → 13 §4.3).
    Đi tới màn và thêm giỏ ĐẢO NGƯỢC ĐƯỢC nên nhận cả tiếng "ừ" — tay bà con
    đang cầm lái, bắt chạm là mất kênh chính. Gọi điện thì KHÔNG: nghe sai một
    chữ là máy tự bấm số, mất tiền và làm phiền người ta. */
function confirmHint(type: AssistantAction["type"] | undefined): string | null {
  if (type === "call") return "Bác chạm nút Gọi giúp.";
  if (type === "addToCart" || type === "navigate" || type === "search")
    return 'Bác nói "ừ" hoặc chạm nút.';
  return null;
}

export function AssistantSheet({ route, onClose }: { route: string; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  /*  NẤC SHEET (03 §Trợ lý trong app, luật 2): mặc định 55% — KHÔNG che hết app.
      Toàn màn chỉ dành cho việc dài nhiều bước (Apple HIG); hỏi–đáp thì bà con
      phải còn thấy mình đang đứng ở màn nào. Lên 92% khi chạm tay nắm hoặc khi
      bàn phím mở (luật 5) — 92% chứ không 100%, chừa một dải thấy màn nền. */
  const [nac, setNac] = useState<"nua" | "cao">("nua");

  /*  ĐANG XEM MÀN NÀO (03 §Trợ lý trong app, luật 10) — sheet chỉ cao 55% nên
      tên màn đi CHUNG HÀNG với tiêu đề, không chiếm thêm một dòng. Bà con mở trợ
      lý giữa lúc đang làm dở thì phải thấy ngay nó đang nói chuyện của màn nào. */
  const tenMan = useMemo(() => {
    const r = route.split("?")[0];
    const q = route.includes("tab=") ? route.split("tab=")[1].split("&")[0] : "";
    if (r.startsWith("/ngu-truong")) return "Ra khơi";
    if (r.startsWith("/cho/don")) return "Đơn hàng";
    if (r.startsWith("/cho/gio")) return "Giỏ hàng";
    if (r.startsWith("/cho")) return "Cửa hàng";
    if (r.startsWith("/ban-hang")) return "Bán hàng";
    if (r.startsWith("/nguoi")) return "Bạn thuyền";
    if (r.startsWith("/tien")) return "Giao dịch";
    if (r.startsWith("/cang")) return "Cảng cá";
    if (r.startsWith("/tau")) return q === "dich-vu" ? "Tàu cá · Dịch vụ" : q === "san-pham" ? "Tàu cá · Sản phẩm" : "Tàu cá · Giấy tờ";
    return "Trang chủ";
  }, [route]);
  const inputRef = useRef<HTMLInputElement>(null);
  const online = useOnline();
  const doAction = useAssistantActions(onClose);
  const [note, setNote] = useState<ActionNote | null>(null);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const [qty, setQty] = useState(1);
  const [variantOf, setVariantOf] = useState<string | null>(null);
  const [thinkPhase, setThinkPhase] = useState<0 | 1 | 2>(0);
  /** Bà con vừa chạm "Thôi đợi" — bỏ câu đang hỏi mà không đóng tấm che. */
  const [stopped, setStopped] = useState(false);
  /*  Món bà con vừa CHẠM trên thẻ (kèm số lượng + loại đã chọn). Bộ máy chỉ
      biết món nó đề nghị, không biết bà con đổi số hay đổi loại — nên UI gửi
      lựa chọn thật qua ref, rồi để bộ máy chạy hành động ĐÚNG MỘT LẦN. */
  const chosen = useRef<AssistantAction | null>(null);

  /*  Bộ máy CHỈ gọi `onAction(navigate)` khi việc đã chốt: "mở giấy tờ" (bà con
      nói rõ) hoặc sau tiếng "ừ" / chạm nút. Nút "Mở …" không dựng ở đây nữa mà
      đọc thẳng từ `reply.action` (xem `navHref`) — nhờ vậy một đường duy nhất
      dẫn tới điều hướng thật, và tiếng "ừ" đi được y như chạm (P1-N1). */
  const onAction = useCallback(
    (a: AssistantAction) => {
      const pick = a.type === "addToCart" && chosen.current ? chosen.current : a;
      chosen.current = null;
      setNote(doAction(pick));
    },
    [doAction],
  );
  const asst = useAssistant({ route, onAction });
  const { state, muted, setMuted, listen, ask, confirm, cancel, suggestions } = asst;

  /*  Máy này nói/nghe được không — hỏi MỘT lần lúc mở (feature-detect không đổi
      giữa chừng). `micDenied` nhớ từ lần trước để khỏi bắt bà con bị hỏi quyền
      rồi từ chối lại lần nữa (13 §5.4). */
  const cap = useMemo(() => {
    const prefs = loadAssistantPrefs();
    return { stt: sttSupported(), micDenied: prefs.micDenied };
  }, []);
  /*  Giọng Việt: `getVoices()` trên Chrome Android trả rỗng ở lần hỏi đầu rồi
      mới nạp xong (sự kiện `voiceschanged`). Hỏi lại vài nhịp — nói "máy không
      đọc được tiếng Việt" oan là cắt mất kênh chính của bà con. */
  const [canSpeak, setCanSpeak] = useState(() => ttsSupported() && hasVietnameseVoice());
  useEffect(() => {
    if (canSpeak || !ttsSupported()) return;
    const timers = [400, 1500].map((ms) =>
      setTimeout(() => {
        if (hasVietnameseVoice()) setCanSpeak(true);
      }, ms),
    );
    return () => timers.forEach(clearTimeout);
  }, [canSpeak]);
  const canListen = cap.stt && !cap.micDenied;
  const reply: AssistantReply | null = state.kind === "answered" ? state.reply : null;
  /*  Nút "Mở …" = lời mời đi tiếp, đọc thẳng từ câu trả lời đang hiện. Bộ máy
      giữ việc này TREO đúng lúc nút còn đây, nên lời mời 'Bác nói "ừ"' bên dưới
      không phải hứa suông (P1-N1). `mo_man` đã đi thẳng, `confirm` có cặp
      Thôi/Đi tới riêng — hai ca đó không dựng nút này. */
  const navHref =
    reply && !reply.confirm && reply.intent !== "mo_man" && reply.action?.type === "navigate"
      ? reply.action.href
      : null;
  const typeFallback = state.kind === "error" && state.typeFallback;
  /*  Ô gõ là HÀNG CHÍNH khi: máy không nghe được · bị từ chối mic · mic vừa lỗi ·
      mất sóng (nhận giọng cần mạng). Lúc đó vòng mic nhường chỗ cho chip + ô gõ. */
  const typeFirst = typing || !canListen || typeFallback || !online;

  /*  Mở tấm che = NGHE NGAY (13 P1: một chạm để nói).

      Ở chế độ nghiêm ngặt React chạy nguyên vòng gắn → dọn → gắn lại NGAY
      trong một nhịp. Trong nhịp "dọn" đó, `useAssistant` huỷ mic (đúng việc của
      nó khi tấm che đóng thật). Bản trước gọi `listen()` thẳng trong lần gắn
      đầu rồi khoá bằng ref: mic mở lúc 1305 ms, bị huỷ lúc 1306 ms, lần gắn thứ
      hai thấy ref đã khoá nên KHÔNG nghe lại — bà con mở ra đứng ở "Bấm để
      nói", mọi việc tốn thêm một chạm (đo thật 2026-09-06, P0-2).

      Nên KHÔNG nghe trong chính lần gắn: hẹn sang nhịp sau. Lần dọn (giả hay
      thật) đều huỷ cái hẹn, nên vòng nghiêm ngặt chỉ còn ĐÚNG MỘT lượt nghe, và
      lượt đó chạy sau khi mọi thứ đã yên — không có ai huỷ nó nữa. Đóng tấm che
      thật thì hẹn bị dọn, không có mic mồ côi.
      `started` giữ nguyên vai trò "đã nghe lượt mở rồi thì thôi", nên câu trả
      lời tới rồi mà React gắn lại vì lý do khác cũng không cướp mic. */
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    let alive = true;
    const t = setTimeout(() => {
      if (!alive) return;
      started.current = true;
      if (canListen && online) listen();
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
    // chỉ chạy một lần lúc mở; `listen` ổn định theo hook
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*  Gom dữ liệu máy NGAY LÚC MỞ (14 §7.3 cho phép) — chip theo việc ("Tin
      bão", "Giấy tờ cần lo") phải có mặt ngay ở màn đầu, chứ không phải chờ
      bà con hỏi xong câu đầu tiên mới hiện (P1-12/P1-8). Đọc sổ trong máy, đồng
      bộ, không gọi mạng: không phạm luật "không làm gì lúc mở app" vì tấm che
      chỉ tồn tại khi bà con đã chạm nút nổi. */
  const openSnap = useMemo<DeviceSnapshot | null>(() => {
    try {
      return gomSnapshot(route);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── a11y: bẫy focus + Esc đóng + khoá cuộn nền (không có sheet nào khác mở
  //    cùng lúc vì nút nổi đã tự ẩn khi thấy panel khác) ─────────────────────
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const saved = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () =>
      panelRef.current
        ? Array.from(
            panelRef.current.querySelectorAll<HTMLElement>(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((el) => !el.hasAttribute("disabled"))
        : [];
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = saved;
      opener?.focus?.();
    };
  }, [onClose]);

  // Ô gõ hiện ra vì máy không nghe được → đặt luôn con trỏ vào đó, đỡ một chạm
  useEffect(() => {
    if (typeFirst) inputRef.current?.focus({ preventScroll: true });
  }, [typeFirst]);

  /*  Bộ đếm mở sẵn ĐÚNG SỐ BÀ CON NÓI ("2 thùng nhớt" → 2), kể cả khi máy tìm
      được 2–3 thẻ món (lúc đó `action` rỗng — xem `spokenQty`). */
  useEffect(() => {
    if (!reply) return;
    const n = spokenQty(reply, state.kind === "answered" ? state.text : "");
    if (n) setQty(n);
  }, [reply, state]);

  /*  "Đang nghĩ…" chỉ hiện khi máy nghĩ LÂU (13 §4.1): tầng máy trả lời trong
      nửa giây, nháy một dòng chữ rồi mất ngay còn khó chịu hơn là không có. */
  useEffect(() => {
    if (state.kind !== "thinking") {
      setThinkPhase(0);
      setStopped(false);
      return;
    }
    const t1 = setTimeout(() => setThinkPhase(1), THINK_SHOW_MS);
    const t2 = setTimeout(() => setThinkPhase(2), THINK_SLOW_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [state]);

  /*  TỰ ĐÓNG sau 20 s ở trạng thái "xong" (AC-T48). Không tự đóng khi còn một
      việc chờ CHẠM (thẻ món, cặp Thôi/Gọi) — đóng ngay lúc bà con đang cân nhắc
      mua hay gọi là cướp việc khỏi tay. Chạm/gõ bất kỳ trong tấm che = huỷ hẳn
      đồng hồ (bà con đang dùng, không phải bỏ quên). */
  const idleClose = state.kind === "answered" && !state.awaitingConfirm && !reply?.candidates?.length;
  useEffect(() => {
    if (!idleClose) return;
    const el = panelRef.current;
    const t = setTimeout(onClose, AUTO_CLOSE_MS);
    const stop = () => clearTimeout(t);
    el?.addEventListener("pointerdown", stop);
    el?.addEventListener("keydown", stop);
    return () => {
      clearTimeout(t);
      el?.removeEventListener("pointerdown", stop);
      el?.removeEventListener("keydown", stop);
    };
  }, [idleClose, onClose]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t) return;
    tapFeedback();
    setNote(null);
    setStopped(false);
    setVariantOf(null);
    setQty(1); // câu mới, số lượng về 1 — không mang số của câu trước sang
    setDraft("");
    ask(t);
  };

  const close = () => {
    cancel();
    onClose();
  };

  /*  Thêm món vào giỏ từ THẺ MÓN: chạm thẻ CHÍNH LÀ xác nhận (14 §7.2 — không
      dựng thêm cặp Đồng ý/Thôi thứ hai, việc 11 của 13 §10 phải nằm trong 2
      chạm). `useAssistant.confirm()` chỉ nhận có/không nên không nói được là
      món NÀO — UI dựng hành động từ đúng thẻ bà con chạm. */
  /*  MỘT ĐƯỜNG DUY NHẤT để thêm giỏ. Khi bộ máy đang chờ xác nhận, phải đi qua
      `confirm(true)` chứ không tự gọi `doAction`: bộ máy còn giữ việc treo, và
      "ừ" nói sau đó sẽ thêm lần thứ hai. `confirm(true)` bảo bộ máy chạy việc
      đang treo (nó gọi ngược `onAction`, nơi `chosen` đổi sang đúng món + số
      lượng bà con vừa chạm) rồi xoá việc treo — thêm đúng MỘT lần. */
  const runAdd = (a: AssistantAction) => {
    if (state.kind === "answered" && state.awaitingConfirm) {
      chosen.current = a;
      confirm(true);
      return;
    }
    setNote(doAction(a));
  };

  const addCandidate = (
    c: NonNullable<AssistantReply["candidates"]>[number],
    variantLabel?: string,
  ) => {
    tapFeedback();
    const a: AssistantAction = {
      type: "addToCart",
      productId: c.productId,
      title: c.title,
      qty,
      shopName: c.shopName,
      priceVnd: c.priceVnd,
      ...(variantLabel ? { variantLabel } : {}),
    };
    runAdd(a);
  };

  /*  NGHE LẠI — iOS Safari chỉ phát tiếng trong một cử chỉ chạm THẬT. Câu trả
      lời tới sau khi cử chỉ mở tấm che đã hết hiệu lực thì máy im, chữ vẫn có
      nhưng bà con đang lái tàu, mắt không rảnh. Nút này là cử chỉ mới, đọc lại
      đúng câu đang hiện. Ẩn khi đã tắt tiếng hoặc máy không có giọng Việt. */
  const replay = () => {
    tapFeedback();
    if (reply) speak(reply.speak);
  };

  /*  Chip "Hỏi lại câu trước" (13 §5.2): chỉ ở lúc mới mở, khi sổ còn câu cũ —
      tấm che tự đóng sau 20 s, mở lại mà phải nói lại từ đầu là mất công. */
  /*  CHIP THEO VIỆC TRONG MÁY — ghép vào ngay từ màn đầu bằng snapshot vừa gom
      (`suggestions` của hook chỉ có việc sau câu hỏi đầu tiên). Và bỏ chip "Con
      nước hôm nay" khi máy CHƯA CÓ bảng con nước: mời bà con hỏi một câu mà
      máy chắc chắn trả lời "chưa tải được" là hứa suông. */
  const workChips: Suggestion[] = useMemo(() => {
    const base = suggestions.filter(
      (s) => !(openSnap && !openSnap.tide && s.utterance === TIDE_UTTERANCE),
    );
    // mốc so tuổi tin bão = lúc GOM (thuần, không đọc đồng hồ lúc vẽ)
    const task = taskChip(openSnap, openSnap?.takenAt ?? 0);
    const out = [...base];
    const them = (s: Suggestion) => {
      if (out.length < 4 && !out.some((x) => x.utterance === s.utterance)) out.push(s);
    };
    if (task) them({ label: task.label, utterance: task.utterance });
    for (const f of FILL_CHIPS) if (out.length < 3) them(f);
    return out;
  }, [suggestions, openSnap]);

  const lastQ = asst.turns[asst.turns.length - 1]?.q;
  const chipsRaw: Suggestion[] = reply?.clarify?.options?.length
    ? reply.clarify.options
    : lastQ && state.kind !== "answered" && state.kind !== "thinking"
      ? [{ label: "Hỏi lại câu trước", utterance: lastQ }, ...workChips].slice(0, 4)
      : workChips;
  /*  Nút của băng vừa làm xong ("Xem giỏ", "Chọn cảng khác") đã là
      một nút to ngay trên đầu — chip cùng nghĩa nằm dưới là hai nút giống hệt
      nhau cho cùng một việc (P2-2). */
  /*  Bàn phím ảo mở (`visualViewport` co) là lý do DUY NHẤT sheet tự lên nấc cao:
      chỗ gõ bị bàn phím ăn mất, không nâng thì ô gõ nằm dưới bàn phím. Đóng bàn
      phím KHÔNG tự hạ xuống — hạ giữa lúc bà con đang đọc là giật màn. */
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const soi = () => {
      if (window.innerHeight - vv.height > 150) setNac("cao");
    };
    soi();
    vv.addEventListener("resize", soi);
    return () => vv.removeEventListener("resize", soi);
  }, []);

  const chips = note?.link
    ? chipsRaw.filter((s) => s.label !== note.link?.label)
    : chipsRaw;

  return (
    /*  DỪNG TRÊN THANH ĐIỀU HƯỚNG (chủ dự án 2026-09-07: "cái dialog hiện ra
        không nên che cái bottom menu"). Cả sheet LẪN nền mờ đều chừa đúng chiều
        cao dock, nên bà con vẫn thấy mình đang ở tab nào và chạm đổi tab được
        ngay mà không phải đóng trợ lý trước. Neo theo --dock-total, không số cứng. */
    <div
      className="fixed inset-x-0 top-0 z-40 mx-auto flex max-w-[480px] items-end"
      style={{ bottom: "var(--dock-total)" }}
    >
      {/*  NỀN MỜ NHÌN XUYÊN (luật 4) — 32% đen, KHÔNG nền đục: bà con phải còn
          thấy mình đang đứng ở màn nào. Chạm nền = đóng (luật 3, đường thứ ba). */}
      <button
        type="button"
        aria-label="Đóng Sen Biển"
        tabIndex={-1}
        onClick={close}
        className="anim-scrim-in absolute inset-0 bg-black/30"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Sen Biển"
        className="assistant-panel anim-sheet-in relative flex w-full flex-col rounded-t-[1.25rem] bg-background shadow-xl transition-[height] duration-200"
        style={{ height: nac === "cao" ? "92%" : "65%" }}
      >
        {/*  TAY NẮM (luật 6): CHẠM để đổi nấc, không bắt buộc kéo — M3 đòi sheet
            đổi nấc và đóng được mà không cần thao tác kéo. Vùng chạm cả hàng
            ≥3.5rem, cao hơn sàn 48dp của M3 vì tay bà con ướt, tàu lắc. */}
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            setNac((n) => (n === "nua" ? "cao" : "nua"));
          }}
          aria-label={nac === "nua" ? "Mở rộng Sen Biển" : "Thu nhỏ Sen Biển"}
          className="flex h-14 w-full shrink-0 items-center justify-center"
        >
          <span className="flex items-center gap-3 text-[0.875rem] font-semibold text-navy"><span className="h-1 w-8 rounded-full bg-navy/25" />{nac === "nua" ? "Mở rộng" : "Thu gọn"}</span>
        </button>
      {/* ── 1. Hàng tiêu đề ──────────────────────────────────────────────── */}
      <header className="flex shrink-0 items-center gap-2 px-4 pb-3">
        {/*  Avatar: mẫu nào cũng để mặt trợ lý ngay cạnh tên — bà con nhìn một cái
            là biết đang nói chuyện với ai, không phải đọc chữ mới hiểu. */}
        <Image
          src="/icons/sen-bien.png"
          width={40}
          height={40}
          alt=""
          className="h-10 w-10 shrink-0 object-contain"
        />
        <div className="min-w-0 flex-1 px-1">
          <h2 className="display text-xl font-bold leading-tight text-navy">Sen Biển</h2>
          <p className="text-[0.875rem] leading-snug text-foreground/80">Đang xem {tenMan}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            tapFeedback();
            setMuted(!muted);
          }}
          aria-pressed={muted}
          aria-label={muted ? "Bật tiếng" : "Tắt tiếng"}
          disabled={!canSpeak}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-field text-navy transition active:bg-field disabled:opacity-40"
        >
          {muted || !canSpeak ? (
            <SpeakerOffIcon className="h-6 w-6" />
          ) : (
            <SpeakerIcon className="h-6 w-6" />
          )}
        </button>
        <CloseButton onClose={close} label="Đóng Sen Biển" />
      </header>
      {!canSpeak && (
        <p className="px-4 pb-1 text-[1.125rem] text-foreground/65">
          Máy này không đọc được tiếng Việt, tôi hiện chữ thôi.
        </p>
      )}

      <div className="flex-1 overflow-y-auto px-4 pb-4 [overscroll-behavior:contain]">
        {/*  MẤT SÓNG: nói NGAY vì sao không có vòng mic (13 §5.4). Trước đây màn
            mở ra chỉ có ô gõ trống + hai chip, bà con không hiểu chuyện gì. */}
        {!online && (state.kind === "idle" || state.kind === "listening") && (
          <div className="pt-3">
            <StatusBanner level="warn">{OFFLINE_LINE}</StatusBanner>
          </div>
        )}

        {/* ── 2. Vòng mic + chữ nghe được ────────────────────────────────── */}
        {!typeFirst && (
          <div className="flex items-center justify-center gap-4 py-3">
            {/*  Vòng nhịp là một lớp RIÊNG phía sau: nút giữ nguyên màu đặc.
                 Cho chính nút nhấp nháy (opacity) là làm nó nhạt đi giữa nắng
                 — đúng lúc bà con cần thấy rõ nhất. */}
            <span className="relative flex h-16 w-16 shrink-0 items-center justify-center">
              {state.kind === "listening" && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full bg-trim/40 motion-safe:animate-ping"
                />
              )}
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  listen();
                }}
                aria-label={state.kind === "listening" ? "Đang nghe — chạm để dừng" : "Bấm để nói"}
                className={`relative flex h-16 w-16 items-center justify-center rounded-full text-white transition active:scale-[0.96] ${
                  state.kind === "listening" ? "bg-trim" : "bg-sea"
                }`}
              >
                <MicIcon className="h-8 w-8" />
              </button>
            </span>
            <p className="text-[1.125rem] font-bold text-navy">
              {state.kind === "listening" ? "Đang nghe…" : "Bấm để nói"}
            </p>
            {state.kind === "listening" && (
              <p className="mt-1 min-h-[2rem] text-center text-[1.5rem] leading-snug text-foreground/70">
                {state.interim}
              </p>
            )}
          </div>
        )}

        {/* ── 3. Câu bà con + câu trả lời chữ TO ─────────────────────────── */}
        <div aria-live="polite" className="space-y-2.5">
          {state.kind === "thinking" && !stopped && (
            <>
              <AssistantBubble who="bacon" text={state.text} />
              {thinkPhase > 0 && (
                <div className="flex items-center gap-2">
                  <p role="status" className="flex-1 px-1 text-[1.25rem] font-bold text-navy">
                    {thinkPhase === 2 ? "Hơi lâu, bác chờ chút…" : "Đang nghĩ…"}
                  </p>
                  {/*  THÔI ĐỢI (14 §7.2): chờ 25 giây một câu hỏi lỡ miệng là
                      lâu, mà X thì đóng luôn cả tấm che — bà con mất chỗ hỏi
                      lại. Nút này chỉ bỏ câu đang hỏi, chip vẫn còn đó. */}
                  <button
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      cancel();
                      setStopped(true);
                    }}
                    className="flex min-h-[3.5rem] shrink-0 items-center rounded-full bg-field px-4 text-[1.125rem] font-bold text-navy transition active:scale-[0.98]"
                  >
                    Thôi đợi
                  </button>
                </div>
              )}
            </>
          )}
          {state.kind === "thinking" && stopped && (
            <p className="px-1 text-[1.125rem] font-bold text-navy">
              Thôi vậy. Bác hỏi lại hoặc chọn câu bên dưới.
            </p>
          )}
          {state.kind === "error" && (
            <StatusBanner level="warn">{state.message}</StatusBanner>
          )}
          {reply && (
            <>
              {/*  Câu bà con vừa nói lấy từ CHÍNH lượt này (`state.text`), không
                   lấy từ sổ 10 câu: sổ còn câu của phiên trước, in ra là bà con
                   thấy máy nhắc lại câu hôm qua ngay dưới vòng mic. Lượt máy tự
                   nói (không nghe được) có `text` rỗng → không in gì. */}
              {state.kind === "answered" && state.text && (
                <AssistantBubble who="bacon" text={state.text} />
              )}
              <AssistantBubble
                who="troly"
                text={reply.text}
                note={
                  reply.savedAt && !reply.text.toLowerCase().includes("lưu")
                    ? `Số ${savedAgoLabel(reply.savedAt)}`
                    : undefined
                }
              />
              {canSpeak && !muted && reply.speak && (
                <button
                  type="button"
                  onClick={replay}
                  className="flex min-h-[3.5rem] items-center gap-2 rounded-full px-3 text-[1.125rem] font-bold text-navy transition active:bg-field"
                >
                  <SpeakerIcon className="h-6 w-6" />
                  Nghe lại
                </button>
              )}
              {reply.source === "mock" && process.env.NODE_ENV !== "production" && (
                <p className="px-1 text-[0.875rem] font-bold text-foreground/65">
                  Đang trả lời thử
                </p>
              )}
            </>
          )}
          {note && (
            <StatusBanner level={note.level === "danger" ? "danger" : "ok"}>
              {note.text}
            </StatusBanner>
          )}
        </div>

        {navHref && (
          <>
            <button
              type="button"
              onClick={() => {
                tapFeedback();
                doAction({ type: "navigate", href: navHref });
              }}
              className="mt-3 flex min-h-[3.5rem] w-full items-center justify-center rounded-2xl bg-sea px-4 text-[1.125rem] font-bold text-white transition active:scale-[0.98]"
            >
              {navLabel(navHref)}
            </button>
            <p className="mt-1.5 px-1 text-[1.125rem] text-foreground/65">
              {confirmHint("navigate")}
            </p>
          </>
        )}

        {note?.link && (
          <button
            type="button"
            onClick={() => {
              const href = note.link?.href;
              if (href) doAction({ type: "navigate", href });
            }}
            className="mt-2.5 flex min-h-[3.5rem] w-full items-center justify-center rounded-2xl bg-field px-4 text-[1rem] font-bold text-navy transition active:scale-[0.98]"
          >
            {note.link.label}
          </button>
        )}

        {/* ── 4. Thẻ hành động — 0 hoặc 1 (13 §5.2 #4) ───────────────────── */}
        {reply?.candidates && reply.candidates.length > 0 && (
          /*  SỐ LƯỢNG ĐỨNG TRƯỚC, ngay trên các thẻ món: bà con nói "2 thùng"
              thì phải THẤY số 2 trước khi chạm, và sửa được ngay tại chỗ mà
              không tốn thêm chạm nào nếu số đã đúng (13 §5.2 #4). */
          <div className="mt-3 flex items-center justify-between gap-3 px-1">
            <span className="text-[1.125rem] font-bold text-navy">Số lượng</span>
            <QtyStepper qty={qty} onChange={(n) => setQty(Math.max(1, n))} label="số lượng" />
          </div>
        )}
        {reply?.candidates && reply.candidates.length > 0 && (
          <ul className="mt-2.5 space-y-2.5">
            {reply.candidates.map((c) => (
              <li key={c.productId} className="surface p-3.5">
                <p className="text-[1.125rem] font-bold leading-snug text-navy">{c.title}</p>
                <p className="mt-0.5 text-[1rem] text-foreground/65">
                  {formatVnd(c.priceVnd)} · {c.shopName}
                </p>
                {variantOf === c.productId && c.variants && c.variants.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {c.variants.slice(0, 4).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => addCandidate(c, v)}
                        className="flex min-h-[3.5rem] items-center rounded-full bg-field px-4 text-[1rem] font-bold text-navy transition active:scale-[0.98]"
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      c.variants && c.variants.length > 1
                        ? setVariantOf(c.productId)
                        : addCandidate(c, c.variants?.[0])
                    }
                    className="mt-2.5 flex min-h-[3.5rem] w-full items-center justify-center rounded-full bg-sea px-4 text-[1.125rem] font-bold text-white transition active:scale-[0.98]"
                  >
                    {c.variants && c.variants.length > 1 ? "Chọn loại" : `Thêm ${qty} vào giỏ`}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {/*  Chỉ mời nói "ừ" khi CÓ ĐÚNG MỘT món: nhiều thẻ thì "ừ" không nói được
            là món nào — hứa một đường bà con đi không tới. Nhiều thẻ đã có sẵn
            câu "Bác chạm món cần thêm" ở trên. */}
        {reply?.candidates?.length === 1 && (
          <p className="mt-2 px-1 text-[1.125rem] text-foreground/65">
            {confirmHint("addToCart")}
          </p>
        )}

        {reply?.confirm && !reply.candidates && (
          <div className="surface mt-3 p-3.5">
            <p className="text-[1.125rem] font-bold leading-snug text-navy">
              {reply.confirm.question}
            </p>
            {reply.action?.type === "addToCart" && (
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <span className="text-[1rem] text-foreground/65">Số lượng</span>
                <QtyStepper qty={qty} onChange={(n) => setQty(Math.max(1, n))} label="số lượng" />
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  confirm(false);
                }}
                className="flex min-h-[3.5rem] items-center justify-center rounded-2xl bg-field px-4 text-[1.125rem] font-bold text-navy transition active:scale-[0.98]"
              >
                Thôi
              </button>
              <button
                type="button"
                onClick={() => {
                  tapFeedback();
                  const a = reply.action;
                  if (a?.type === "addToCart") runAdd({ ...a, qty });
                  else confirm(true);
                }}
                className="flex min-h-[3.5rem] items-center justify-center rounded-2xl bg-sea px-4 text-[1.125rem] font-bold text-white transition active:scale-[0.98]"
              >
                {confirmLabel(reply.action)}
              </button>
            </div>
            {confirmHint(reply.action?.type) && (
              <p className="mt-2 text-[1.125rem] text-foreground/65">
                {confirmHint(reply.action?.type)}
              </p>
            )}
          </div>
        )}

        {/* ── 5. Chip gợi ý (hoặc chip hỏi lại) ──────────────────────────── */}
        {reply?.clarify && (
          <p className="mt-3 px-1 text-[1.125rem] font-bold text-navy">
            {reply.clarify.question}
          </p>
        )}
        {/*  LỜI CHÀO — chỉ ở lượt đầu, khi chưa hỏi gì. Nói thẳng giúp được việc
            gì thay vì "tôi có thể giúp gì cho bạn" trống rỗng: bà con ít dùng app
            cần biết PHẠM VI trước khi mở miệng (NN/g #3: nói rõ trợ lý làm được gì). */}
        {state.kind === "idle" && !reply && (
          <div className="mt-3 rounded-2xl rounded-tl-md bg-field px-4 py-3">
            <p className="text-[1.125rem] leading-snug text-navy">
              Chào bác, tôi là Sen Biển. Tôi coi giúp thời tiết, tin bão, giấy tờ,
              bảo dưỡng, giá cá và đơn hàng. Bác bấm một câu bên dưới hoặc nói cho tôi nghe.
            </p>
          </div>
        )}
        {chips.length > 0 && (
          <div role="group" aria-label="Câu hỏi sẵn" className="mt-3 flex flex-col gap-2">
            {chips.map((s) => (
              <button
                key={s.utterance}
                type="button"
                onClick={() => send(s.utterance)}
                className="flex min-h-[3.5rem] w-full items-center rounded-2xl bg-card px-4 py-2 text-left text-[1.125rem] font-semibold text-navy shadow-sm transition active:scale-[0.98]"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── 6. Hàng đáy: ô gõ (hàng chính khi không nghe được) / nút Gõ ──── */}
      <div
        className="shrink-0 border-t px-4 pt-3"
        style={{
          borderColor: "var(--line)",
          paddingBottom: "max(1rem, env(safe-area-inset-bottom))",
        }}
      >
        {typeFirst ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              enterKeyHint="send"
              maxLength={300}
              aria-label="Gõ câu muốn hỏi"
              placeholder={online ? "Gõ câu muốn hỏi…" : "Mất sóng — gõ việc trong máy…"}
              className={`${inputClass} flex-1`}
            />
            <button
              type="submit"
              aria-label="Gửi"
              disabled={!draft.trim()}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sea text-white transition active:scale-[0.95] disabled:opacity-40"
            >
              <SendIcon className="h-6 w-6" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              tapFeedback();
              setTyping(true);
            }}
            className="flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-full text-[1.0625rem] font-bold text-navy transition active:bg-field"
          >
            <KeyboardIcon className="h-6 w-6" />
            Gõ thay vì nói
          </button>
        )}
        {!canListen && cap.micDenied && (
          <p className="mt-1.5 text-center text-[1.125rem] text-foreground/65">
            Bật mic trong cài đặt máy để nói.
          </p>
        )}
        {!canListen && !cap.stt && (
          <p className="mt-1.5 text-center text-[1.125rem] text-foreground/65">
            Máy này chưa nói được với tôi — bác gõ hoặc chọn bên trên.
          </p>
        )}
      </div>
      </div>
    </div>
  );
}
