"use client";

import { useEffect, useRef, useState } from "react";
import { MicIcon } from "@/components/icons";
import { CloseButton } from "@/components/ui/close-button";
import { laTiengVong, listenOnce, NGHE_SAU_DOC_MS } from "@/lib/sen-bien/nghe";
import { cauTomTat, laBoQua, laCo, laDung, type BuocHoi } from "@/lib/sen-bien/nhap-giong";
import { cauVuaNoi, ttsCancel, ttsSpeak } from "@/lib/voice/tts";

/*
  SEN BIỂN HỎI TỪNG CÂU ĐỂ NHẬP (2026-10-26 — anh Long: "cho bà con nhập bằng giọng nói cũng được, ví dụ trao đổi
  Sen Biển để thiết lập, Sen Biển hỏi từng câu rồi lưu lại, tàu, giấy tờ, chứng nhận").

  Thẻ nằm TRONG form (giấy tờ, tàu), không phải màn riêng: ô nào Sen Biển hiểu thì điền NGAY trước mắt bà con —
  nghe sai là thấy liền, sửa tay được. Mỗi bước: Sen Biển đọc câu hỏi (ttsSpeak, giọng chung của app) → chờ
  NGHE_SAU_DOC_MS cho loa im (không thu tiếng vọng) → nghe một câu (listenOnce: bộ nghe trong máy nếu đã nạp, không
  thì Web Speech) → hiểu (lib/sen-bien/nhap-giong) → "Dạ, …" + điền ô + câu kế. Không rõ ⇒ hỏi lại MỘT lần; lần hai
  vẫn không rõ ⇒ ô được bỏ qua thì bỏ qua, ô bắt buộc thì dừng để bà con gõ. "bỏ qua" ⇒ qua ô; "thôi/dừng" ⇒ dừng.
  Hết ⇒ đọc tóm tắt + "Lưu nhé?" ⇒ "có/lưu/đúng" ⇒ gọi `onLuu` (CHÍNH nút Lưu của form — cùng kiểm lỗi, cùng hỏi
  trùng loại); khác ⇒ để bà con sửa rồi tự bấm Lưu.
  Thẻ theo 03 §6 mục 8: chấm × nhỏ góc trên-phải để dừng; không nút chữ; chữ trong thẻ là câu Sen Biển đang nói +
  chữ vừa nghe (thông tin thật). Micro bị chặn / máy không nghe được ⇒ nói rõ một câu rồi dừng.
*/

type TrangThai = "noi" | "nghe" | "xong";

export function HoiTungCau<K extends string>({
  kichBan,
  onDien,
  onLuu,
  onXong,
}: {
  kichBan: readonly BuocHoi<K>[];
  /** điền một ô (gọi qua ref ở phía form — tránh closure cũ) */
  onDien: (o: K, gt: string) => void;
  /** bà con đồng ý lưu ⇒ bấm Lưu của form */
  onLuu: () => void;
  /** đóng thẻ (dừng / xong) */
  onXong: () => void;
}) {
  const [cau, setCau] = useState("");
  const [nghe, setNghe] = useState("");
  const [tt, setTt] = useState<TrangThai>("noi");
  const huy = useRef<() => void>(() => {});
  const dung = useRef(false);
  const daNoi = useRef<string[]>([]);
  // props mới nhất qua ref — chuỗi hỏi chạy qua nhiều lượt vẽ
  const p = useRef({ kichBan, onDien, onLuu, onXong });
  useEffect(() => {
    p.current = { kichBan, onDien, onLuu, onXong };
  });

  useEffect(() => {
    dung.current = false;
    const noi = (text: string, sau: () => void) => {
      if (dung.current) return;
      setCau(text);
      setTt("noi");
      huy.current = ttsSpeak(text, {
        onEnd: () => {
          if (dung.current) return;
          const t = setTimeout(() => !dung.current && sau(), NGHE_SAU_DOC_MS);
          huy.current = () => clearTimeout(t);
        },
      });
    };
    const ketThuc = (text: string, sau?: () => void) => {
      noi(text, () => {
        setTt("xong");
        sau?.();
        p.current.onXong();
      });
    };
    const ngheMot = (xuLy: (t: string) => void, khongNghe: () => void) => {
      if (dung.current) return;
      setTt("nghe");
      setNghe("");
      const h = listenOnce({
        expect: "ten",
        onInterim: (t) => !dung.current && setNghe(t),
        onFinal: (t) => {
          if (dung.current) return;
          const vua = cauVuaNoi();
          // thu nhầm đuôi giọng Sen Biển ⇒ coi như chưa nghe gì
          if (vua && laTiengVong(t, vua.text, Date.now() - vua.xong)) return khongNghe();
          setNghe(t);
          xuLy(t);
        },
        onError: (code) => {
          if (dung.current) return;
          if (code === "not-allowed" || code === "unsupported" || code === "audio-capture")
            return ketThuc("Máy chưa cho Sen Biển nghe. Bác gõ tay giúp nhé.");
          khongNghe();
        },
      });
      huy.current = () => h.abort();
    };
    const hoi = (i: number, lan: number, mo: string) => {
      const kb = p.current.kichBan;
      if (i >= kb.length) return tomTat();
      const b = kb[i];
      const lai = (cauLai: string) => {
        if (lan >= 1) return b.boQuaDuoc ? hoi(i + 1, 0, "Để bác ghi tay sau. ") : ketThuc("Sen Biển chưa nghe rõ. Bác gõ tay giúp nhé.");
        hoi(i, lan + 1, cauLai);
      };
      noi(`${mo}${b.hoi}`, () =>
        ngheMot(
          (t) => {
            if (laDung(t)) return ketThuc("Dạ. Bác sửa rồi bấm Lưu nhé.");
            if (b.boQuaDuoc && laBoQua(t)) return hoi(i + 1, 0, "Dạ. ");
            const r = b.hieu(t);
            if (!r.ok) return lai("Sen Biển chưa nghe rõ. ");
            p.current.onDien(b.o, r.gt);
            daNoi.current.push(r.noi);
            hoi(i + 1, 0, `Dạ, ${r.noi}. `);
          },
          () => lai("Bác nói lại giúp. "),
        ),
      );
    };
    const tomTat = () => {
      if (!daNoi.current.length) return ketThuc("Chưa ghi được gì. Bác gõ tay giúp nhé.");
      noi(cauTomTat(daNoi.current), () =>
        ngheMot(
          (t) => {
            const c = laCo(t);
            if (c) return ketThuc("Dạ, Sen Biển lưu rồi.", () => p.current.onLuu());
            ketThuc("Dạ. Bác sửa rồi bấm Lưu nhé.");
          },
          () => ketThuc("Bác xem lại rồi bấm Lưu nhé."),
        ),
      );
    };
    hoi(0, 0, "");
    return () => {
      dung.current = true;
      huy.current();
      ttsCancel();
    };
  }, []);

  return (
    <div className="relative mb-3.5 rounded-xl border border-sea/30 bg-sea/10 px-3 py-2.5" role="status" aria-live="polite">
      <CloseButton
        variant="goc"
        label="Dừng nhập bằng giọng"
        onClose={() => {
          dung.current = true;
          huy.current();
          ttsCancel();
          p.current.onXong();
        }}
      />
      <p className="flex items-center gap-1.5 text-[0.8125rem] text-sea">
        <MicIcon className={`h-4 w-4 ${tt === "nghe" ? "animate-pulse" : ""}`} />
        {tt === "nghe" ? "Đang nghe…" : "Sen Biển"}
      </p>
      <p className="mt-0.5 pr-6 text-[1rem] leading-snug text-navy">{cau}</p>
      {nghe && <p className="mt-1 text-[0.875rem] italic leading-snug text-foreground/70">“{nghe}”</p>}
    </div>
  );
}
