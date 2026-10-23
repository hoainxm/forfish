"use client";

// SEN BIỂN trên bản đồ — làm lại toàn bộ thao tác 2026-10-17 (chủ dự án: "theo
// đúng cách Claude và ChatGPT đang làm với nút mic", "gọi và chat phải khác nhau").
//
// HAI THAO TÁC TÁCH BẠCH:
//  · GỌI (chạm icon Sen Biển nổi) — như chế độ gọi giọng: Sen Biển CHÀO + đọc
//    việc làm được, đọc xong TỰ NGHE; icon Sen Biển có vòng lan + sóng âm thật khi
//    đang ghi; chạm icon = ghi / dừng (đang chào thì cắt lời, ghi luôn). Không nói
//    gì 5 s ⇒ tự thu về. Xong câu đáp, rảnh 5 s ⇒ tự thu về. KHÔNG có nút ×.
//  · CHAT (icon bong bóng) — thanh nhập kiểu Claude: ô gõ + micro ĐỌC-RA-CHỮ
//    (ô hiện "Đang nghe…", sóng âm, nút dừng; chữ điền vào ô để xem lại rồi gửi)
//    + mũi tên gửi. Không tự gửi, không tự đọc chào.
// Làm gì với câu là việc của màn bản đồ (`onHeard`); nói gì đi qua MỘT giọng chung
// (useNavVoice.say). Hiểu ý chạy TRONG MÁY (`lib/sen-bien`).

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchDataBytes, fetchDataJson } from "@/lib/data-fetch";
import type { SenDest } from "@/lib/sen-bien/hieu-y";
import {
  autoListenOk,
  laTiengVong,
  listenOnce,
  micDenied,
  micGranted,
  NGHE_SAU_DOC_MS,
  setMicDenied,
  sttSupported,
  type ListenHandle,
} from "@/lib/sen-bien/nghe";
import { boNgheSan } from "@/lib/sen-bien/nghe-may";
import { DAU_KHO_PATH, loadDauKho } from "@/lib/sen-bien/dau-kho";
import { docKho, HOI_DAP_PATH } from "@/lib/sen-bien/hoi-dap";
import type { BoKho } from "@/lib/sen-bien/hoi-kho";
import { loadLoc, LOC_PATH } from "@/lib/sen-bien/loc";
import { loadNgram, NGRAM_PATH, type NgramModel } from "@/lib/sen-bien/ngram";
import { docViTri, ghiViTri, huongBongBong, ICON_PX, kepViTri, laKeo, VI_TRI_GOC, viTriGocApp, type ViTriIcon } from "@/lib/sen-bien/vi-tri";
import { cauVuaNoi, ttsSpeak, ttsUnlock } from "@/lib/voice/tts";
import { SenBienIcon, useSenAria } from "@/components/sen-bien-icon";
import { lyDoMicro, setSenSignal } from "@/lib/sen-bien-state";
import { useEscape } from "@/lib/use-escape";

let modelP: Promise<NgramModel | null> | null = null;
/** Tải trọng số một lần / phiên. Lỗi ⇒ null (lùi về dò tên), lần sau thử lại. */
export function loadSenBienModel(): Promise<NgramModel | null> {
  if (!modelP) {
    modelP = fetchDataBytes(NGRAM_PATH, 20000, "sen-bien ngram")
      .then(loadNgram)
      .catch(() => null)
      .then((m) => {
        if (!m) modelP = null;
        return m;
      });
  }
  return modelP;
}

let khoP: Promise<BoKho | null> | null = null;
let daChoKho = false;
let boKho: BoKho | null = null;
/** Ba file kho hỏi–đáp (đầu kho v5b 4,6 MB + kho ⚠ chưa duyệt + bộ lọc 64 KB) — song song, mỗi file trần 20 s. */
function napBoKho(): Promise<BoKho | null> {
  if (!khoP) {
    khoP = Promise.all([
      fetchDataBytes(DAU_KHO_PATH, 20000, "sen-bien dau-kho").then(loadDauKho),
      fetchDataJson(HOI_DAP_PATH, 20000, "sen-bien hoi-dap"),
      fetchDataBytes(LOC_PATH, 20000, "sen-bien loc").then(loadLoc).catch(() => null), // thiếu lọc vẫn chạy: chỉ ý hoi_mo/khong_hieu vào kho
    ])
      .then(([dk, raw, loc]) => {
        const kho = dk ? docKho(raw, dk.nq) : null;
        return dk && kho ? { dk, kho, loc } : null;
      })
      .catch(() => null)
      .then((b) => {
        if (b) boKho = b;
        else khoP = null; // hỏng ⇒ lần sau thử lại
        return b;
      });
  }
  return khoP;
}
/**
 * Kho hỏi–đáp trong máy (lib/sen-bien/hoi-kho.ts). Lần đầu CHỜ tải (câu hỏi đầu đã có câu trả lời); hỏng thì các lần sau
 * thử lại NGẦM và trả null ngay — không bắt câu đang nói chờ thêm tới 20 s khi sóng chập chờn. Lỗi ⇒ null, không ném.
 */
export function boKhoSan(): BoKho | null {
  if (!boKho) void napBoKho();
  return boKho;
}
/** Kho đã tải sẵn (không chờ); chưa có thì bắt đầu tải ngầm cho lần sau. */
export async function loadBoKho(): Promise<BoKho | null> {
  if (boKho) return boKho;
  const p = napBoKho();
  if (daChoKho) return null;
  daChoKho = true;
  return p;
}

/** Màn cha xử lý câu nghe được: trả câu hiện ra + (nếu có) danh sách chọn. */
export type SenHeard = {
  show: string;
  options?: SenDest[];
  /** việc GHI có hậu quả (sàn: huỷ / xác nhận / giao / đồng ý giá…) — một chạm xác nhận mới làm (13 §4.3) */
  xacNhan?: { nhan: string; lam: () => Promise<SenHeard> };
} | null;

/**
 * KÉO ICON SEN BIỂN (chủ dự án 2026-10-17: "cái float sen biển gốc phải cho phép kéo đi được").
 * Giữ rồi kéo = dời chỗ (nhớ trong máy, `forfish.senbien.vitri.v1`); chạm nhẹ = bấm như thường.
 * Dùng chung cho icon nổi (màn bản đồ, thẻ đóng) và icon trong thẻ (thẻ mở) — cùng một chỗ.
 */
export function useSenKeo(gocApp = false) {
  const [pos, setPos] = useState<ViTriIcon>(VI_TRI_GOC);
  const [khung, setKhung] = useState({ w: 0, h: 0 });
  const ref = useRef<HTMLButtonElement | null>(null);
  const keo = useRef<{ x: number; y: number; l: number; b: number; dang: boolean; w: number; h: number } | null>(null);
  const boClick = useRef(false);
  const cuoi = useRef(pos);

  const doKhung = () => {
    const r = (ref.current?.offsetParent as HTMLElement | null)?.getBoundingClientRect();
    return r ? { w: r.width, h: r.height } : { w: 0, h: 0 };
  };
  useEffect(() => {
    const k = doKhung();
    // màn ngoài bản đồ: chưa kéo lần nào ⇒ mép phải (viTriGocApp), không phải chỗ gốc bản đồ
    const p = kepViTri(gocApp ? docViTri(viTriGocApp(k.w)) : docViTri(), k.w, k.h);
    cuoi.current = p;
    // đọc kho trong máy SAU khi gắn (tránh lệch SSR)
    setKhung(k);
    setPos(p);
  }, [gocApp]);

  const props = {
    ref,
    style: { left: pos.left, bottom: pos.bottom, touchAction: "none" as const },
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      const k = doKhung();
      setKhung(k);
      keo.current = { x: e.clientX, y: e.clientY, l: pos.left, b: pos.bottom, dang: false, w: k.w, h: k.h };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent<HTMLButtonElement>) => {
      const k = keo.current;
      if (!k) return;
      const dx = e.clientX - k.x;
      const dy = e.clientY - k.y;
      if (!k.dang && laKeo(dx, dy)) k.dang = true;
      if (!k.dang) return;
      const p = kepViTri({ left: k.l + dx, bottom: k.b - dy }, k.w, k.h);
      cuoi.current = p;
      setPos(p);
    },
    onPointerUp: () => {
      if (keo.current?.dang) {
        ghiViTri(cuoi.current);
        boClick.current = true; // vừa kéo xong — click theo sau KHÔNG tính là bấm
      }
      keo.current = null;
    },
    onPointerCancel: () => {
      keo.current = null;
    },
    onClickCapture: (e: React.MouseEvent) => {
      if (!boClick.current) return;
      boClick.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
  };
  return { pos, khung, props };
}

/** Icon Sen Biển nổi khi thẻ ĐÓNG — kéo đi được; chạm = gọi. */
export function SenBienNoi({ onOpen, gocApp = false }: { onOpen: () => void; gocApp?: boolean }) {
  const { props } = useSenKeo(gocApp);
  const aria = useSenAria();
  return (
    <button
      type="button"
      {...props}
      onClick={onOpen}
      aria-label={aria}
      className="absolute z-20 h-14 w-14 select-none rounded-full transition-transform active:scale-[0.97]"
    >
      <SenBienIcon className="fab-mascot block h-full w-full" />
    </button>
  );
}

/** Không nói gì sau ngần này thì thẻ GỌI tự thu về (chủ dự án 2026-10-17). */
export const SEN_IM_MS = 5000;
/** Thẻ CHAT để trống, không gõ — tự thu về sau ngần này. */
const CHAT_RANH_MS = 10000;
/** Còn danh sách chọn — cho thêm thời gian chạm. */
const CHON_MS = 15000;
const SO_VACH = 14;

export function SenBienSheet({
  awaitingGo,
  title,
  chao,
  listenOnOpen = false,
  hoiNgay,
  autoListen = 0,
  speakerBusy = false,
  onMissed,
  onHeard,
  onPick,
  onStart,
  onCancel,
  onClose,
  gocApp = false,
}: {
  /** màn ngoài bản đồ — chỗ gốc của icon là mép phải (viTriGocApp) */
  gocApp?: boolean;
  /** vừa đọc tóm tắt đường — hiện nút Đi / Thôi */
  awaitingGo: boolean;
  /** dòng thông tin (tóm tắt đường, lỗi vẽ đường) — trống thì không hiện */
  title: string;
  /** câu chào + việc làm được, đọc khi mở bằng GỌI */
  chao: string;
  /** mở bằng GỌI (chạm icon Sen Biển) ⇒ chào rồi nghe */
  listenOnOpen?: boolean;
  /** câu đã nghe ở màn khác (?sen=) — mở thẻ là trả lời câu này luôn, không chào */
  hoiNgay?: string;
  /** số tăng = Sen Biển vừa đọc XONG một câu hỏi ⇒ tự nghe một lượt (main 2026-10-16, `autoListenOk`) */
  autoListen?: number;
  /** loa đang đọc câu khác — lượt tự nghe phải dừng, kẻo micro thu tiếng loa */
  speakerBusy?: boolean;
  /** nghe được tiếng mà không ra chữ ⇒ màn bản đồ hỏi lại (rồi tự nghe tiếp) */
  onMissed?: () => void;
  onHeard: (text: string) => SenHeard | Promise<SenHeard>;
  onPick: (d: SenDest) => void;
  onStart: () => void;
  onCancel: () => void;
  /** thu thẻ về (tự động — không có nút ×) */
  onClose: () => void;
}) {
  const canVoice = sttSupported();
  const [mode, setMode] = useState<"goi" | "chat">(canVoice ? "goi" : "chat");
  const [phase, setPhase] = useState<"chao" | "nghe" | "nghi" | "ranh">("ranh");
  /*  Báo trạng thái cho MỌI icon Sen Biển (lib/sen-bien-state, 2026-10-19): thẻ là
      nguồn của "đang nghe"/"đang nghĩ"; "đang chào" = loa đọc nên tính là đang nói
      (tts.ts tự báo speaking). Thẻ đóng ⇒ trả về rảnh. */
  useEffect(() => {
    setSenSignal({ listening: phase === "nghe", thinking: phase === "nghi" });
    return () => setSenSignal({ listening: false, thinking: false, level: null });
  }, [phase]);
  /*  "Không nghe được" CHỈ khi chặn thật: máy không có bộ nghe, hoặc quyền micro bị
      từ chối (Permissions API / lượt nghe vừa bị từ chối) — CHƯA XIN thì không báo. */
  useEffect(() => {
    setSenSignal({ micBlocked: !canVoice });
  }, [canVoice]);
  const [heard, setHeard] = useState("");
  const [shown, setShown] = useState<SenHeard>(null);
  const [typed, setTyped] = useState("");
  const [doc, setDoc] = useState(false); // chat: micro đọc-ra-chữ đang nghe
  const [muc, setMuc] = useState<number[] | null>(null); // mức âm thật (null = vẽ giả)
  const live = useRef<ListenHandle | null>(null);
  const huyChao = useRef<(() => void) | null>(null);
  const imRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bongRef = useRef<HTMLDivElement | null>(null);
  const { pos, khung, props: keoProps } = useSenKeo(gocApp);
  const coNoi = useRef(false);

  const dungNghe = () => {
    live.current?.abort();
    live.current = null;
  };
  const catChao = () => {
    // xoá mốc TRƯỚC rồi mới huỷ — huỷ đọc có thể gọi onEnd ngay, onEnd thấy mốc rỗng thì không ghi lần hai
    const f = huyChao.current;
    huyChao.current = null;
    f?.();
  };

  /*  HẸN MỞ MICRO sau khi loa im NGHE_SAU_DOC_MS (nghe.ts) — mở ngay là thu đuôi giọng Sen Biển. Một hẹn một lúc;
      loa nói câu khác / thẻ đóng thì huỷ. */
  const henNgheRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const huyHenNghe = () => {
    if (henNgheRef.current) clearTimeout(henNgheRef.current);
    henNgheRef.current = null;
  };

  useEffect(
    () => () => {
      dungNghe();
      catChao();
      huyHenNghe();
      if (imRef.current) clearTimeout(imRef.current);
    },
    [],
  );

  const daMuc = (v: number) => {
    setSenSignal({ level: Math.max(0, Math.min(1, v)) });
    setMuc((m) => [...(m ?? []).slice(-(SO_VACH - 1)), v]);
  };

  const answer = useCallback(
    async (text: string) => {
      setHeard(text);
      setShown(null);
      setPhase("nghi");
      try {
        setShown(await onHeard(text));
      } finally {
        setPhase("ranh");
      }
    },
    [onHeard],
  );

  /** GỌI: một lượt nghe; không nói gì 5 s ⇒ thu thẻ về. */
  /** lượt nghe đang chạy là lượt TỰ bật sau câu hỏi: im thì chỉ tắt mic, KHÔNG thu thẻ (nút Đi/Thôi còn) */
  const tuRef = useRef(false);
  const ghi = useCallback((tu = false) => {
    tuRef.current = tu;
    catChao();
    ttsUnlock();
    dungNghe();
    coNoi.current = false;
    setShown(null);
    setHeard("");
    setMuc(null);
    setPhase("nghe");
    /*  5 S IM ⇒ THU VỀ — thẻ TỰ ĐẾM, không trông vào bộ nghe báo im (bộ nghe trong máy không có
        hẹn giờ đó; micro chưa được cấp quyền thì nó chờ mãi ⇒ thẻ "dính luôn", chủ dự án bắt 2026-10-17). */
    if (imRef.current) clearTimeout(imRef.current);
    imRef.current = setTimeout(() => {
      imRef.current = null;
      if (coNoi.current || !live.current) return;
      dungNghe();
      setPhase("ranh");
      if (!tu) onClose();
    }, SEN_IM_MS);
    const xongIm = () => {
      if (imRef.current) clearTimeout(imRef.current);
      imRef.current = null;
    };
    live.current = listenOnce({
      silenceMs: SEN_IM_MS,
      onLevel: daMuc,
      onInterim: (t) => {
        coNoi.current = true;
        setHeard(t === "…" ? "" : t);
      },
      onFinal: (t) => {
        xongIm();
        live.current = null;
        // micro thu lại chính giọng Sen Biển ⇒ bỏ, không trả lời (khỏi vòng nói–nghe mình–nói)
        const c = cauVuaNoi();
        if (laTiengVong(t, c?.text, c ? (c.xong ? Date.now() - c.xong : null) : null)) {
          setHeard("");
          setPhase("ranh");
          return;
        }
        void answer(t);
      },
      onError: (code) => {
        xongIm();
        live.current = null;
        setPhase("ranh");
        if (code === "aborted") return;
        if (code === "no-speech" && !coNoi.current) return tu ? undefined : onClose(); // im 5 s ⇒ thu về (tự nghe: chỉ tắt mic)
        // có tiếng mà không ra chữ ⇒ để màn bản đồ hỏi lại bằng giọng (rồi tự nghe tiếp)
        if (code === "no-speech" && onMissed) return onMissed();
        // máy không nghe được giọng ⇒ sang chat; micro bị chặn / mất sóng ⇒ báo MỘT dòng rồi tự thu về
        // (KHÔNG tự nhảy sang chat — nằm đó là "dính"); muốn gõ thì chạm bong bóng chat
        if (code === "unsupported") setMode("chat");
        if (code === "not-allowed") setMicDenied(true);
        setShown({
          show:
            code === "network"
              ? "Mất sóng nên máy chưa nghe được. Bà con chạm ô chat để gõ."
              : code === "not-allowed" || code === "audio-capture"
                ? lyDoMicro({
                    code,
                    secure: typeof window === "undefined" || window.isSecureContext !== false,
                    denied: micDenied(),
                  })
                : "Sen Biển chưa nghe rõ.",
        });
      },
    });
  }, [answer, onClose, onMissed]);

  // câu hỏi đọc XONG ⇒ tự nghe một lượt (luật `autoListenOk`; bộ nghe trong máy thì không cần sóng)
  const autoSeen = useRef(autoListen);
  // luật kiểm LẠI lúc hẹn tới (sau NGHE_SAU_DOC_MS) — đọc ref, không đọc giá trị đóng băng lúc hẹn
  const busyRef = useRef(speakerBusy);
  const modeRef = useRef(mode);
  useEffect(() => {
    busyRef.current = speakerBusy;
    modeRef.current = mode;
  }, [speakerBusy, mode]);
  useEffect(() => {
    if (autoListen === autoSeen.current) return;
    autoSeen.current = autoListen;
    huyHenNghe();
    henNgheRef.current = setTimeout(() => {
      henNgheRef.current = null;
      const ok = autoListenOk({
        stt: canVoice,
        typing: modeRef.current === "chat",
        granted: micGranted(),
        hidden: typeof document !== "undefined" && document.visibilityState === "hidden",
        online: typeof navigator === "undefined" || navigator.onLine !== false || boNgheSan(),
        busy: busyRef.current,
        listening: live.current != null,
      });
      if (ok) ghi(true);
    }, NGHE_SAU_DOC_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ theo tín hiệu "đọc xong"
  }, [autoListen]);
  // loa đọc câu khác (cảnh báo chen, câu giờ) ⇒ huỷ hẹn mở micro; đang tự nghe thì tắt micro
  useEffect(() => {
    if (!speakerBusy) return;
    huyHenNghe();
    if (tuRef.current && live.current) {
      dungNghe();
      setPhase("ranh");
    }
  }, [speakerBusy]);

  /** CHAT: micro đọc-ra-chữ — chữ điền vào ô, KHÔNG tự gửi. */
  const docRaChu = () => {
    if (doc) {
      live.current?.stop();
      return;
    }
    ttsUnlock();
    dungNghe();
    const truoc = typed.trim();
    setMuc(null);
    setDoc(true);
    live.current = listenOnce({
      onLevel: daMuc,
      onInterim: (t) => t !== "…" && setTyped(truoc ? `${truoc} ${t}` : t),
      onFinal: (t) => {
        live.current = null;
        setDoc(false);
        setTyped(truoc ? `${truoc} ${t}` : t);
      },
      onError: () => {
        live.current = null;
        setDoc(false);
      },
    });
  };

  const oRef = useRef<HTMLTextAreaElement | null>(null);
  // cao theo chữ (không dùng field-sizing: iOS 15 chưa có), trần ~4 dòng rồi cuộn
  useEffect(() => {
    const o = oRef.current;
    if (!o) return;
    o.style.height = "auto";
    o.style.height = `${Math.min(o.scrollHeight, 8 * 16)}px`;
  }, [typed, mode]);
  // hai tầng khi chữ đã nhiều dòng; giữ hai tầng tới khi ô trống (không nhảy qua lại lúc đang gõ)
  const [haiTang, setHaiTang] = useState(false);
  useEffect(() => {
    if (!typed) setHaiTang(false);
    const o = oRef.current;
    if (!o || !typed) return;
    const dong = parseFloat(getComputedStyle(o).lineHeight) || 25;
    const dem = parseFloat(getComputedStyle(o).paddingTop) + parseFloat(getComputedStyle(o).paddingBottom);
    if (o.scrollHeight - dem > dong * 1.5) setHaiTang(true);
  }, [typed]);
  const gui = () => {
    const t = typed.trim();
    if (!t || doc) return;
    setTyped("");
    void answer(t);
  };

  const sangChat = () => {
    catChao();
    dungNghe();
    setPhase("ranh");
    setMode("chat");
  };
  const nutChat = (
    <>
      {canVoice && (
        <IconNut label={doc ? "Dừng nghe" : "Đọc ra chữ"} onClick={docRaChu} nen={doc ? "bg-navy text-white" : "text-navy"}>
          {doc ? <IconDung /> : <IconMic />}
        </IconNut>
      )}
      {!doc && typed.trim() && (
        <IconNut label="Gửi" submit nen="bg-navy text-white">
          <IconGui />
        </IconNut>
      )}
    </>
  );

  // câu chuyển từ màn khác (?sen=) ⇒ trả lời ngay một lần
  const hoiRef = useRef(hoiNgay);
  useEffect(() => {
    const t = hoiRef.current;
    hoiRef.current = undefined;
    if (t) void answer(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ lúc mở
  }, []);

  // mở bằng GỌI ⇒ chào + nói việc làm được, đọc xong thì nghe (chạm icon là cắt lời, ghi luôn)
  /*  CHẠY LẠI ĐƯỢC, không cờ "một lần" (lỗi 2026-10-20, anh Long: "sao ko lấy được micro"):
      bản cũ dùng moRef một lần — React dev (StrictMode) gắn → GỠ THỬ → gắn lại; lần gỡ thử
      chạy dọn dẹp `catChao()` huỷ câu chào (mốc rỗng ⇒ không `ghi()`), lần gắn lại thấy cờ đã
      tắt ⇒ bỏ qua ⇒ thẻ kẹt ở "chào", KHÔNG BAO GIỜ bật micro, trình duyệt không hỏi quyền.
      Nay: mỗi lần gắn thì chào rồi nghe; dọn dẹp huỷ đúng lượt chào của chính nó. */
  const moKhiMo = listenOnOpen && canVoice && !hoiNgay;
  useEffect(() => {
    if (!moKhiMo) return;
    let conSong = true;
    ttsUnlock();
    setPhase("chao");
    let xongNgay = false;
    let huy: () => void = () => {};
    huy = ttsSpeak(chao, {
      onEnd: () => {
        // câu chào rỗng ⇒ ttsSpeak báo xong NGAY (trước khi gán `huy`) — vẫn sang nghe
        if (!conSong) return;
        if (huyChao.current !== huy) {
          xongNgay = true;
          return;
        }
        huyChao.current = null;
        // câu chào đọc xong ⇒ nghỉ cho loa im hẳn rồi mới mở micro (khỏi thu "…cho bạn?" thành câu hỏi)
        huyHenNghe();
        henNgheRef.current = setTimeout(() => {
          henNgheRef.current = null;
          if (conSong) ghi();
        }, NGHE_SAU_DOC_MS);
      },
    });
    if (xongNgay) ghi();
    else huyChao.current = huy;
    return () => {
      conSong = false;
      huyHenNghe();
      if (huyChao.current === huy) huyChao.current = null;
      huy();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ lúc mở thẻ
  }, []);

  // CHẠM RA NGOÀI (bản đồ, nút khác) ⇒ thu về, như mọi khung bật lên — trừ lúc chờ "Đi/Thôi"
  useEffect(() => {
    if (awaitingGo) return;
    const ngoai = (e: PointerEvent) => {
      const t = e.target as Node | null;
      if (!t || bongRef.current?.contains(t) || keoProps.ref.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("pointerdown", ngoai, true);
    return () => document.removeEventListener("pointerdown", ngoai, true);
  }, [awaitingGo, onClose, keoProps.ref]);

  // PHÍM ESCAPE đóng như mọi hộp (rà bố cục 2026-10-22 — bong bóng có role=dialog mà
  // không đóng được bằng bàn phím). Lúc chờ "Đi/Thôi" vẫn giữ — cùng luật chạm ra ngoài.
  useEscape(!awaitingGo, onClose);

  // TỰ THU VỀ khi rảnh — không có nút ×. Loa còn đọc câu trả lời thì CHƯA rảnh (2026-10-18: câu dài > 5 s
  // làm thẻ thu giữa chừng, mất lượt tự nghe tiếp — "giao tiếp 2 chiều"); đếm lại từ lúc đọc xong.
  useEffect(() => {
    if (awaitingGo || phase !== "ranh" || doc || speakerBusy) return;
    if (mode === "chat" && typed.trim()) return;
    // đang chờ bấm xác nhận việc sàn ⇒ giữ lâu như lúc chọn điểm (đọc câu hỏi xong mới kịp bấm)
    const ms = mode === "chat" ? CHAT_RANH_MS : shown?.options?.length || shown?.xacNhan ? CHON_MS : SEN_IM_MS;
    const t = setTimeout(onClose, ms);
    return () => clearTimeout(t);
  }, [awaitingGo, phase, doc, speakerBusy, mode, typed, shown, onClose]);

  const huong = huongBongBong(pos, khung.w, khung.h);
  const dangGhi = mode === "goi" && phase === "nghe";
  const dangChao = mode === "goi" && phase === "chao";
  // icon Sen Biển là nút BẬT/TẮT (chủ dự án 2026-10-17: "click icon sen thì mở ra, click tiếp thì thu lại
  // chứ không phải treo"): thẻ đang mở thì chạm là THU VỀ — dừng nghe, dừng đọc (dọn ở cleanup khi gỡ)
  const bamSen = () => onClose();

  return (
    <>
      {/*  ICON SEN BIỂN CỐ ĐỊNH — đúng chỗ icon nổi trên bản đồ, không chạy vào khung (chủ dự án
           2026-10-17: "icon sen biển cố định, click vào thì hiện trên đầu con sen biển cái dialog kiểu
           liquid, chứ không phải kéo icon vô dialog"). Nó là NÚT GỌI: vòng lan + viền cam khi đang ghi. */}
      <button
        type="button"
        {...keoProps}
        onClick={bamSen}
        aria-label="Thu Sen Biển lại"
        aria-expanded={true}
        className="pointer-events-auto absolute z-40 h-14 w-14 select-none rounded-full transition-transform active:scale-[0.97]"
      >
        {/* hiệu ứng nghe/nghĩ/nói lấy từ một nguồn (lib/sen-bien-state) — không vẽ riêng ở đây nữa */}
        <SenBienIcon className="fab-mascot block h-full w-full" />
      </button>

      {/*  BONG BÓNG KÍNH (liquid) TRÊN ĐẦU SEN BIỂN — trồi lên từ icon như giọt nước nở ra; nền mờ
           xuyên thấu + viền sáng + đuôi chỉ xuống icon. Nền giữ đủ đặc (card/75) cho chữ đọc được ngoài nắng. */}
      <div
        ref={bongRef}
        role="dialog"
        aria-label="Sen Biển"
        // BÁM THEO ICON: icon nửa dưới ⇒ mở lên trên đầu, nửa trên ⇒ mở xuống dưới; icon nửa phải ⇒ canh mép phải
        style={{
          ...(huong.len ? { bottom: pos.bottom + ICON_PX + 12 } : { top: khung.h - pos.bottom + 12 }),
          ...(huong.phai ? { right: Math.max(8, khung.w - pos.left - ICON_PX) } : { left: pos.left }),
          transformOrigin: `${huong.phai ? "calc(100% - 2rem)" : "2rem"} ${huong.len ? "100%" : "0%"}`,
        }}
        className={`anim-giot pointer-events-auto absolute z-40 space-y-1.5 max-h-[70dvh] overflow-y-auto rounded-2xl bg-card p-1.5 shadow-float [overscroll-behavior:contain] ${
          // chat: ~2/3 bề ngang (chủ dự án: "bong bóng chỉ chiếm 2/3 thôi, không phải full")
          mode === "chat" ? "w-[66%] min-w-[15rem]" : "w-max max-w-[min(22rem,calc(100%-1rem))]"
        }`}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-card/70 via-transparent to-transparent" />
        {/* đuôi chỉ về icon (chat kéo hết bề ngang thì đuôi canh theo tâm icon) */}
        <span
          aria-hidden="true"
          className={`absolute h-3 w-3 rotate-45 border-card/70 bg-card/75 ${huong.len ? "-bottom-1.5 border-b border-r" : "-top-1.5 border-l border-t"} ${
            huong.phai ? "right-6" : "left-6"
          }`}
        />
        <div className="relative space-y-1.5">
      {mode === "goi" ? (
        // GỌI: chỉ sóng âm / ba chấm + bong bóng chat — icon Sen Biển ở dưới, không nằm trong khung
        <div className="flex items-center gap-1">
          {(dangGhi || dangChao) && <SongAm muc={dangGhi ? muc : null} gia={dangChao} />}
          {phase === "nghi" && <Cham />}
          {canVoice && (
            <IconNut label="Nhắn chữ" onClick={sangChat}>
              <IconChat />
            </IconNut>
          )}
        </div>
      ) : (
        // CHAT: thanh nhập kiểu ChatGPT/Claude. MỘT dòng ⇒ [Sen Biển · ô gõ · micro · gửi] cùng hàng, canh giữa.
        // NHIỀU dòng ⇒ hai tầng: chữ trải hết bề ngang ở trên, hàng icon ở dưới (Sen Biển trái · micro, gửi
        // phải) — chủ dự án 2026-10-17: "lúc phình ra vẫn phải cân đối, icon không dồn xuống dưới lệch".
        <form
          onSubmit={(e) => {
            e.preventDefault();
            gui();
          }}
          className={`rounded-2xl bg-field/80 focus-within:ring-2 focus-within:ring-sea ${
            haiTang ? "flex flex-col px-1 pt-1" : "flex items-center gap-1 pl-1"
          }`}
        >
          {/* ô gõ TỰ PHÌNH theo chữ (trần ~4 dòng rồi cuộn); Enter gửi, Shift+Enter xuống dòng */}
          <textarea
            ref={oRef}
            rows={1}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                gui();
              }
            }}
            placeholder={doc ? "Đang nghe…" : "Nhắn Sen Biển"}
            aria-label="Nhắn Sen Biển"
            className={`min-w-0 resize-none bg-transparent text-[1.125rem] leading-snug text-navy outline-none placeholder:text-foreground/50 focus-visible:outline-none! ${
              haiTang ? "w-full px-2 py-2" : "flex-1 px-1 py-[0.875rem]"
            }`}
          />
          {haiTang ? (
            <div className="flex items-center justify-end gap-1">
              {doc && <SongAm muc={muc} />}
              {nutChat}
            </div>
          ) : (
            <>
              {doc && <SongAm muc={muc} />}
              {nutChat}
            </>
          )}
        </form>
      )}

      {title && <p className="px-2 text-[1rem] font-semibold leading-snug text-navy">{title}</p>}

      {awaitingGo && (
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={onStart}
            className="min-h-[3.5rem] rounded-xl bg-t1 text-[1.25rem] font-semibold text-white transition active:scale-[0.98]"
          >
            Đi
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[3.5rem] rounded-xl bg-navy/10 text-[1.125rem] font-semibold text-navy transition active:scale-[0.98]"
          >
            Thôi
          </button>
        </div>
      )}

      {/* câu nghe được — chỉ ở GỌI (chat thì ô nhập đã có câu đó) */}
      {mode === "goi" && heard && <p className="px-2 text-[0.9375rem] italic text-foreground/75">&ldquo;{heard}&rdquo;</p>}
      {mode === "chat" && phase === "nghi" && <Cham />}
      {shown && (
        <p role="status" className="px-2 text-[1rem] font-semibold leading-snug text-navy">
          {shown.show}
        </p>
      )}
      {shown?.xacNhan && (
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            disabled={phase === "nghi"}
            onClick={() => {
              const x = shown.xacNhan!;
              setShown({ show: "Đang gửi…" });
              setPhase("nghi");
              void x
                .lam()
                .then(setShown, () => setShown({ show: "Chưa làm được — thử lại giúp." }))
                .finally(() => setPhase("ranh"));
            }}
            className="min-h-[3.5rem] rounded-xl bg-t1 text-[1.125rem] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
          >
            {shown.xacNhan.nhan}
          </button>
          <button
            type="button"
            onClick={() => setShown({ show: "Thôi, không làm." })}
            className="min-h-[3.5rem] rounded-xl bg-navy/10 text-[1.125rem] font-semibold text-navy transition active:scale-[0.98]"
          >
            Thôi
          </button>
        </div>
      )}
      {shown?.options && (
        <div className="space-y-1.5">
          {shown.options.map((d) => (
            <button
              key={`${d.lat},${d.lon}`}
              type="button"
              onClick={() => onPick(d)}
              className="flex min-h-[3.5rem] w-full items-center rounded-xl bg-navy/10 px-3 text-left text-[1rem] font-semibold text-navy transition active:scale-[0.98]"
            >
              {d.name}
              <span className="ml-2 text-[0.875rem] font-semibold text-foreground/60">
                {d.kind === "cang" ? "cảng cá" : d.kind === "nha" ? "cảng nhà" : "điểm đã ghim"}
              </span>
            </button>
          ))}
        </div>
      )}
        </div>
      </div>
    </>
  );
}

/** Sóng âm kiểu Claude/ChatGPT: mức âm thật nếu có, không thì vạch chạy giả. */
function SongAm({ muc, gia = false }: { muc: number[] | null; gia?: boolean }) {
  const vach = Array.from({ length: SO_VACH }, (_, i) => (muc ? (muc[muc.length - SO_VACH + i] ?? 0) : null));
  return (
    <div className="flex h-8 items-center gap-[0.1875rem] px-1" aria-hidden="true">
      {vach.map((v, i) => (
        <span
          key={i}
          className={`w-[0.1875rem] rounded-full ${gia ? "bg-navy/40" : "bg-navy"} ${v === null ? "anim-song" : ""}`}
          style={v === null ? { height: "100%", animationDelay: `${(i % 7) * 110}ms` } : { height: `${Math.max(12, Math.round(v * 100))}%` }}
        />
      ))}
    </div>
  );
}

/** Đang nghĩ — ba chấm, không chữ. */
function Cham() {
  return (
    <div className="flex h-8 items-center gap-1 px-2" aria-label="Sen Biển đang nghĩ" role="status">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 animate-pulse rounded-full bg-navy/60" style={{ animationDelay: `${i * 200}ms` }} />
      ))}
    </div>
  );
}

/** Ô màu 44px trong vùng chạm 56px (CLAUDE.md: tap ≥ 56px) — icon không kèm chữ. */
function IconNut({
  label,
  onClick,
  nen = "bg-navy/10 text-navy",
  submit,
  children,
}: {
  label: string;
  onClick?: () => void;
  nen?: string;
  submit?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type={submit ? "submit" : "button"}
      onClick={onClick}
      aria-label={label}
      className="group flex h-14 w-12 shrink-0 items-center justify-center"
    >
      <span className={`flex h-11 w-11 items-center justify-center rounded-full transition group-active:scale-95 ${nen}`}>{children}</span>
    </button>
  );
}

const SVG = { viewBox: "0 0 24 24", "aria-hidden": true, className: "h-5 w-5", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function IconMic() {
  return (
    <svg {...SVG}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg {...SVG}>
      <path d="M4 5h16v11H9l-5 4z" />
    </svg>
  );
}

function IconDung() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function IconGui() {
  return (
    <svg {...SVG}>
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}
