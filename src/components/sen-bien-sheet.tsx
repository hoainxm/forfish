"use client";

// SEN BIỂN trên bản đồ — CỬA NÓI DUY NHẤT (doc 07 §Sen Biển): chọn điểm đến
// bằng tên / toạ độ, chờ "đi", lệnh khi đang chạy. Khung này CHỈ nghe/gõ và
// hiện câu đáp; làm gì là việc của màn bản đồ (`onHeard`), nói gì đi qua
// MỘT giọng chung với cảnh báo (useNavVoice.say).
// Bà con chạy thử 2026-10-16: "chỉ đường nói ok, thiếu cái chọn điểm đến bằng
// giọng nói". Chạm mic → nói "dẫn về cảng Sa Huỳnh" → máy đặt điểm đến + mở
// khung dẫn đường; bà con xem đường rồi tự bấm Bắt đầu (máy không tự chạy).
//
// Hiểu ý chạy TRONG MÁY (`lib/sen-bien`). Nghe giọng cần mạng (Web Speech) —
// mất sóng thì ô GÕ thay mic, chọn điểm đến vẫn được.

import { useEffect, useRef, useState } from "react";

import { fetchDataBytes } from "@/lib/data-fetch";
import type { SenDest } from "@/lib/sen-bien/hieu-y";
import { listenOnce, sttSupported, type ListenHandle } from "@/lib/sen-bien/nghe";
import { loadNgram, NGRAM_PATH, type NgramModel } from "@/lib/sen-bien/ngram";
import { ttsUnlock } from "@/lib/voice/tts";

let modelP: Promise<NgramModel | null> | null = null;
/*  NHỚ "ĐANG GÕ" QUA CÁC LẦN MỞ (chạy thử 2026-10-16): Sen Biển đóng thẻ sau
    mỗi lệnh ("đi Sa Huỳnh" → vẽ đường), mở lại là về mic — bà con đang gõ
    (mic hỏng / chỗ ồn / không cho micro) phải bấm "Gõ thay vì nói" lại mỗi câu.
    Nhớ trong phiên (biến mô-đun), tải lại app thì về mặc định nói. */
let thichGo = false;
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

/** Màn cha xử lý câu nghe được: trả câu hiện ra + (nếu có) danh sách chọn. */
export type SenHeard = { show: string; options?: SenDest[] } | null;

export function SenBienSheet({
  awaitingGo,
  title,
  listenOnOpen = false,
  onHeard,
  onPick,
  onStart,
  onCancel,
  onClose,
}: {
  /** vừa đọc tóm tắt đường — hiện nút Đi / Thôi */
  awaitingGo: boolean;
  /** dòng trên cùng (tóm tắt đường khi chờ "đi") */
  title: string;
  /** mở ra là nghe luôn (chạm cá) */
  listenOnOpen?: boolean;
  onHeard: (text: string) => SenHeard | Promise<SenHeard>;
  onPick: (d: SenDest) => void;
  onStart: () => void;
  onCancel: () => void;
  onClose: () => void;
}) {
  const [heard, setHeard] = useState("");
  const [listening, setListening] = useState(false);
  const [shown, setShown] = useState<SenHeard>(null);
  const [typing, setTypingState] = useState(() => thichGo || !sttSupported());
  const setTyping = (v: boolean) => {
    thichGo = v;
    setTypingState(v);
  };
  const [typed, setTyped] = useState("");
  const live = useRef<ListenHandle | null>(null);

  useEffect(() => () => live.current?.abort(), []);

  const answer = async (text: string) => {
    /*  Mic còn đang nghe (mở thẻ là tự nghe) mà bà con GÕ: dừng mic trước, không
        thì lỗi "không nghe thấy gì" của nó về sau ĐÈ lên câu trả lời (bắt được
        khi chạy thử 2026-10-16: gõ "nhắc lại" mà thẻ hiện "chưa nghe rõ"). */
    if (live.current) {
      live.current.abort();
      live.current = null;
      setListening(false);
    }
    setHeard(text);
    setShown(await onHeard(text));
  };

  const listen = () => {
    ttsUnlock();
    setShown(null);
    setHeard("");
    setListening(true);
    live.current = listenOnce({
      onInterim: setHeard,
      onFinal: (t) => {
        setListening(false);
        live.current = null;
        void answer(t);
      },
      onError: (code) => {
        setListening(false);
        if (code === "aborted") return; // chính mình dừng (gõ thay, đóng thẻ) — không phải lỗi
        if (code === "network" || code === "unsupported" || code === "not-allowed") setTyping(true);
        setShown({
          show:
            code === "network"
              ? "Mất sóng nên máy chưa nghe được. Bà con gõ, hoặc chạm nút."
              : code === "not-allowed"
                ? "Máy chưa cho dùng micro. Bà con gõ, hoặc chạm nút."
                : "Sen Biển chưa nghe rõ. Chạm micro nói lại nhé.",
        });
      },
    });
  };

  // chạm cá ⇒ mở là nghe (một lần, sau khi khung dựng xong)
  const autoRef = useRef(listenOnOpen);
  useEffect(() => {
    if (autoRef.current && sttSupported() && !thichGo) {
      autoRef.current = false;
      listen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ lúc mở
  }, []);

  /*  GỌN (chủ dự án 2026-10-16: "đừng có làm rối, che bản đồ quá"): thẻ
      nhỏ nổi góc trái dưới, không phủ màn, không tấm đáy. Hàng đầu cá + câu
      ngắn, một hàng nút to, câu nghe/đáp, hàng cuối "gõ/nói" + đóng.
      Nền ĐẶC (bỏ /95, rà soát 2026-10-16): thẻ hay nằm đè khung dẫn đường,
      chữ khung lộ qua thành bóng mờ — nắng chói đọc lẫn. */
  return (
    <div
      role="dialog"
      aria-label="Sen Biển"
      className="pointer-events-auto absolute bottom-24 left-2 z-40 w-[min(20rem,calc(100%-6rem))] space-y-2 rounded-2xl bg-card p-2.5 shadow-xl"
    >
      {/*  Nút đóng ở HÀNG DƯỚI (2026-10-16): đặt ở hàng đầu thì cột chữ còn
           ~150px, tóm tắt "Tới Sa Huỳnh: 34 hải lý, chừng 4 giờ 55 phút." vỡ
           3 dòng; chủ dự án đòi ≤2 dòng. */}
      <div className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh trong máy, cache SW */}
        <img src="/icons/sen-bien.png" alt="" className="h-10 w-10 shrink-0" />
        <p className="min-w-0 flex-1 text-[1rem] font-semibold leading-snug text-navy">{title}</p>
      </div>

      {awaitingGo ? (
        <div className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
          <button
            type="button"
            onClick={onStart}
            className="min-h-[3.5rem] rounded-xl bg-t1 text-[1.25rem] font-bold text-white transition active:scale-[0.98]"
          >
            Đi
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[3.5rem] rounded-xl bg-navy/10 text-[1.125rem] font-bold text-navy transition active:scale-[0.98]"
          >
            Thôi
          </button>
          {!typing && (
            <button
              type="button"
              onClick={() => (listening ? live.current?.stop() : listen())}
              aria-label={listening ? "Đang nghe — chạm để xong" : "Nói"}
              className={`min-h-[3.5rem] rounded-xl px-3 text-[1rem] font-bold text-white transition active:scale-[0.98] ${
                listening ? "animate-pulse bg-t1" : "bg-navy"
              }`}
            >
              {listening ? "Nghe…" : "Nói"}
            </button>
          )}
        </div>
      ) : (
        !typing && (
          <button
            type="button"
            onClick={() => (listening ? live.current?.stop() : listen())}
            aria-pressed={listening}
            className={`flex min-h-[3.5rem] w-full items-center justify-center rounded-xl px-3 text-[1.125rem] font-bold text-white transition active:scale-[0.98] ${
              listening ? "animate-pulse bg-t1" : "bg-navy"
            }`}
          >
            {listening ? "Đang nghe… chạm để xong" : "Chạm rồi nói"}
          </button>
        )
      )}

      {typing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!typed.trim()) return;
            void answer(typed.trim());
            setTyped(""); // câu đã gửi vẫn hiện ở dòng nghiêng bên dưới; ô trống cho câu kế
          }}
          className="flex gap-1.5"
        >
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Tên chỗ, toạ độ, lệnh"
            aria-label="Gõ cho Sen Biển"
            className="min-h-[3.5rem] min-w-0 flex-1 rounded-xl bg-field px-3 text-[1.125rem] text-navy"
          />
          <button
            type="submit"
            className="min-h-[3.5rem] shrink-0 rounded-xl bg-navy px-3 text-[1rem] font-bold text-white transition active:scale-[0.98]"
          >
            Gửi
          </button>
        </form>
      )}

      {heard && <p className="truncate text-[0.9375rem] italic text-foreground/75">&ldquo;{heard}&rdquo;</p>}
      {shown && (
        <p role="status" className="text-[1rem] font-bold leading-snug text-navy">
          {shown.show}
        </p>
      )}
      {shown?.options && (
        <div className="space-y-1.5">
          {shown.options.map((d) => (
            <button
              key={`${d.lat},${d.lon}`}
              type="button"
              onClick={() => onPick(d)}
              className="flex min-h-[3.5rem] w-full items-center rounded-xl bg-navy/10 px-3 text-left text-[1rem] font-bold text-navy transition active:scale-[0.98]"
            >
              {d.name}
              <span className="ml-2 text-[0.875rem] font-semibold text-foreground/60">
                {d.kind === "cang" ? "cảng cá" : d.kind === "nha" ? "cảng nhà" : "điểm đã ghim"}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        {sttSupported() ? (
          <button
            type="button"
            onClick={() => setTyping(!typing)}
            className="min-h-[3.5rem] flex-1 text-left text-[1rem] font-bold text-navy/70"
          >
            {typing ? "Nói bằng giọng" : "Gõ thay vì nói"}
          </button>
        ) : (
          <span className="flex-1" />
        )}
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng Sen Biển"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-navy/10 text-[1.5rem] font-bold text-navy transition active:scale-95"
        >
          ×
        </button>
      </div>
    </div>
  );
}
