"use client";

// SEN BIỂN trên bản đồ — CHỌN ĐIỂM ĐẾN BẰNG GIỌNG (doc 07 §Sen Biển).
// Bà con chạy thử 2026-10-16: "chỉ đường nói ok, thiếu cái chọn điểm đến bằng
// giọng nói". Chạm mic → nói "dẫn về cảng Sa Huỳnh" → máy đặt điểm đến + mở
// khung dẫn đường; bà con xem đường rồi tự bấm Bắt đầu (máy không tự chạy).
//
// Hiểu ý chạy TRONG MÁY (`lib/sen-bien`). Nghe giọng cần mạng (Web Speech) —
// mất sóng thì ô GÕ thay mic, chọn điểm đến vẫn được.

import { useEffect, useRef, useState } from "react";

import { BottomSheet } from "@/components/ui/bottom-sheet";
import { fetchDataBytes } from "@/lib/data-fetch";
import { senBienReply, type SenDest, type SenReply } from "@/lib/sen-bien/hieu-y";
import { listenOnce, sttSupported, type ListenHandle } from "@/lib/sen-bien/nghe";
import { loadNgram, NGRAM_PATH, type NgramModel } from "@/lib/sen-bien/ngram";
import { ttsSpeak, ttsUnlock } from "@/lib/voice/tts";

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

export function SenBienSheet({
  dests,
  seaLine,
  onGo,
  onClose,
}: {
  dests: SenDest[];
  seaLine: string | null;
  onGo: (d: SenDest) => void;
  onClose: () => void;
}) {
  const [heard, setHeard] = useState("");
  const [listening, setListening] = useState(false);
  const [reply, setReply] = useState<SenReply | null>(null);
  const [typing, setTyping] = useState(() => !sttSupported());
  const [typed, setTyped] = useState("");
  const live = useRef<ListenHandle | null>(null);

  useEffect(() => () => live.current?.abort(), []);

  const answer = async (text: string) => {
    setHeard(text);
    const r = senBienReply(text, await loadSenBienModel(), dests, seaLine);
    setReply(r);
    ttsSpeak(r.say);
    if (r.kind === "go") onGo(r.dest);
  };

  const listen = () => {
    ttsUnlock();
    setReply(null);
    setHeard("");
    setListening(true);
    live.current = listenOnce({
      onInterim: setHeard,
      onFinal: (t) => {
        setListening(false);
        void answer(t);
      },
      onError: (code) => {
        setListening(false);
        if (code === "network" || code === "unsupported" || code === "not-allowed") setTyping(true);
        setReply({
          kind: "say",
          say:
            code === "network"
              ? "Mất sóng nên máy chưa nghe được. Bà con gõ tên chỗ muốn tới."
              : code === "not-allowed"
                ? "Máy chưa cho dùng micro. Bà con gõ tên chỗ muốn tới."
                : "Sen Biển chưa nghe rõ. Chạm micro nói lại nhé.",
        });
      },
    });
  };

  return (
    <BottomSheet title="Sen Biển" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- ảnh tĩnh trong máy, cache SW */}
          <img src="/icons/sen-bien.png" alt="" className="h-16 w-16 shrink-0" />
          <p className="text-[1.125rem] font-semibold leading-snug text-navy">
            Nói chỗ muốn tới — tên cảng hoặc điểm đã ghim. Ví dụ: &quot;dẫn về cảng Sa Huỳnh&quot;.
          </p>
        </div>

        {!typing && (
          <button
            type="button"
            onClick={() => (listening ? live.current?.stop() : listen())}
            aria-pressed={listening}
            className={`flex min-h-[4.5rem] w-full items-center justify-center gap-2 rounded-2xl px-4 text-[1.25rem] font-bold text-white transition active:scale-[0.98] ${
              listening ? "animate-pulse bg-t1" : "bg-navy"
            }`}
          >
            {listening ? "Đang nghe… chạm để xong" : "Chạm rồi nói"}
          </button>
        )}

        {typing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (typed.trim()) void answer(typed.trim());
            }}
            className="flex gap-2"
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="Gõ tên cảng / điểm"
              aria-label="Tên chỗ muốn tới"
              className="min-h-[3.5rem] min-w-0 flex-1 rounded-xl bg-field px-3 text-[1.125rem] text-navy"
            />
            <button
              type="submit"
              className="min-h-[3.5rem] shrink-0 rounded-xl bg-navy px-4 text-[1.125rem] font-bold text-white transition active:scale-[0.98]"
            >
              Tìm
            </button>
          </form>
        )}

        {heard && (
          <p className="rounded-xl bg-field/70 px-3 py-2 text-[1rem] italic text-foreground/80">&ldquo;{heard}&rdquo;</p>
        )}
        {reply && (
          <p role="status" className="text-[1.125rem] font-bold leading-snug text-navy">
            {reply.say}
          </p>
        )}
        {reply?.kind === "pick" && (
          <div className="space-y-2">
            {reply.options.map((d) => (
              <button
                key={`${d.lat},${d.lon}`}
                type="button"
                onClick={() => onGo(d)}
                className="flex min-h-[3.5rem] w-full items-center rounded-xl bg-navy/10 px-3 text-left text-[1.125rem] font-bold text-navy transition active:scale-[0.98]"
              >
                {d.name}
                <span className="ml-2 text-[0.875rem] font-semibold text-foreground/60">
                  {d.kind === "cang" ? "cảng cá" : d.kind === "nha" ? "cảng nhà" : "điểm đã ghim"}
                </span>
              </button>
            ))}
          </div>
        )}

        {sttSupported() && (
          <button
            type="button"
            onClick={() => setTyping((v) => !v)}
            className="min-h-[3.5rem] w-full rounded-xl text-[1rem] font-bold text-navy/70"
          >
            {typing ? "Nói bằng giọng" : "Gõ chữ thay vì nói"}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
