"use client";

/*
  KAIROS DỄ DÙNG HƠN FACEBOOK — đợt 1 (lib/kairos/de-dung.ts; 14 §15). Ba mảnh giao diện dùng chung:
   · NutNghe — icon loa trên thẻ bài: chạm ⇒ Sen Biển đọc to (ttsSpeak — giọng Mỹ Duyên/giọng máy, CHẠY KHI MẤT SÓNG),
     chạm lần nữa ⇒ dừng. Máy không đọc được tiếng Việt ⇒ ẩn nút. Một lúc một bài (ttsSpeak tự cắt bài trước).
   · useHoanAnh — Tiết kiệm dữ liệu / mạng 2G ⇒ ảnh chưa tải, hiện khung "Chạm xem ảnh" (kiểu FB Lite nhưng tự đoán).
   · NutMic — nói để viết (bình luận, bài): chữ nghe được ĐIỀN vào ô để sửa rồi mới gửi, không gửi thẳng.
*/

import { useEffect, useRef, useState } from "react";
import { MicIcon, SpeakerIcon, SpeakerOffIcon } from "@/components/icons";
import {
  chuDeDoc,
  nenHoanAnh,
  type BaiDoc,
  type KetNoi,
} from "@/lib/kairos/de-dung";
import type { ListenHandle } from "@/lib/sen-bien/nghe";

// tts / nghe kéo theo plugin Capacitor chạm `window` ngay lúc nạp ⇒ KHÔNG import tĩnh (thẻ bài prerender ở máy
// chủ — build Vercel từng đỏ "window is not defined" 2026-10-24). Nạp lúc chạy trong trình duyệt.
const napTts = () => import("@/lib/voice/tts");
const napNghe = () => import("@/lib/sen-bien/nghe");

let docDuoc: Promise<boolean> | null = null;
/** Máy đọc được tiếng Việt không — hỏi MỘT lần cho cả màn. */
function coGiong(): Promise<boolean> {
  docDuoc ??= napTts()
    .then((m) => m.ttsCheck())
    .then((a) => a.ok)
    .catch(() => false);
  return docDuoc;
}

export function NutNghe({ post }: { post: BaiDoc }) {
  const [co, setCo] = useState(false);
  const [dang, setDang] = useState(false);
  const huy = useRef<(() => void) | null>(null);
  useEffect(() => {
    let song = true;
    void coGiong().then((ok) => song && setCo(ok));
    return () => {
      song = false;
      huy.current?.();
    };
  }, []);
  const chu = chuDeDoc(post);
  if (!co || !chu) return null;
  const bam = () => {
    if (dang) {
      huy.current?.();
      void napTts().then((m) => m.ttsCancel());
      return;
    }
    setDang(true);
    void napTts()
      .then((m) => {
        huy.current = m.ttsSpeak(chu, {
          onEnd: () => {
            huy.current = null;
            setDang(false);
          },
        });
      })
      .catch(() => setDang(false));
  };
  return (
    <button
      type="button"
      onClick={bam}
      aria-pressed={dang}
      aria-label={dang ? "Dừng đọc" : "Nghe bài này"}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-[0.95] ${dang ? "bg-sea text-white" : "text-foreground/65"}`}
    >
      {dang ? (
        <SpeakerOffIcon className="h-5 w-5" />
      ) : (
        <SpeakerIcon className="h-5 w-5" />
      )}
    </button>
  );
}

/** true ⇒ hoãn tải ảnh (Tiết kiệm dữ liệu / 2G). Đổi mạng giữa chừng thì cập nhật. */
export function useHoanAnh(): boolean {
  const [hoan, setHoan] = useState(false);
  useEffect(() => {
    const c = (navigator as unknown as { connection?: KetNoi & EventTarget })
      .connection;
    const cap = () => setHoan(nenHoanAnh(c));
    cap();
    c?.addEventListener?.("change", cap);
    return () => c?.removeEventListener?.("change", cap);
  }, []);
  return hoan;
}

/** Khung thay ảnh khi hoãn tải — chạm ⇒ hiện ảnh thật. */
export function KhungAnh({
  soAnh,
  onXem,
  className = "",
}: {
  soAnh: number;
  onXem: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onXem}
      className={`flex w-full items-center justify-center bg-field text-[0.875rem] font-semibold text-foreground/65 ${className}`}
    >
      {soAnh > 1
        ? `Mạng yếu — chạm xem ${soAnh} ảnh`
        : "Mạng yếu — chạm xem ảnh"}
    </button>
  );
}

/**
 * Nói để viết: chạm ⇒ nghe một câu (listenOnce của Sen Biển) ⇒ `onChu(chữ)` để màn ĐIỀN vào ô (không gửi). Chạm lần
 * nữa khi đang nghe ⇒ dừng. Máy không nghe được ⇒ ẩn nút. Lỗi (mất sóng, chặn micro) ⇒ `onLoi(câu báo)`.
 */
export function NutMic({
  onChu,
  onLoi,
  disabled = false,
}: {
  onChu: (t: string) => void;
  onLoi?: (t: string) => void;
  disabled?: boolean;
}) {
  const [co, setCo] = useState(false);
  const [nghe, setNghe] = useState(false);
  const h = useRef<ListenHandle | null>(null);
  useEffect(() => {
    let song = true;
    void napNghe()
      .then((m) => song && setCo(m.sttSupported()))
      .catch(() => {});
    return () => {
      song = false;
      h.current?.abort();
    };
  }, []);
  if (!co) return null;
  const bam = () => {
    if (nghe) {
      h.current?.stop();
      return;
    }
    setNghe(true);
    void Promise.all([napTts(), napNghe()]).then(
      ([t, n]) => {
        t.ttsCancel(); // đang đọc bài thì im để micro không thu tiếng loa
        h.current = n.listenOnce({
          expect: "lenh",
          silenceMs: 4_000,
          onInterim: () => {},
          onFinal: (t) => {
            h.current = null;
            setNghe(false);
            if (t.trim()) onChu(t.trim());
          },
          onError: (code) => {
            h.current = null;
            setNghe(false);
            if (code === "aborted" || code === "no-speech") return;
            onLoi?.(
              code === "network"
                ? "Mất sóng nên máy chưa nghe được — bà con gõ chữ nhé."
                : code === "not-allowed" || code === "audio-capture"
                  ? "Máy chưa cho dùng micro."
                  : "Sen Biển chưa nghe rõ, bà con nói lại nhé.",
            );
          },
        });
      },
      () => setNghe(false),
    );
  };
  return (
    <button
      type="button"
      onClick={bam}
      disabled={disabled}
      aria-pressed={nghe}
      aria-label={nghe ? "Dừng nghe" : "Nói để viết"}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition active:scale-[0.95] disabled:opacity-40 ${nghe ? "bg-sea text-white" : "border border-line text-navy"}`}
    >
      <MicIcon className="h-5 w-5" />
    </button>
  );
}
