"use client";

/*
  TRA CỨU DANH SÁCH TRONG FILE ĐÍNH KÈM THÔNG BÁO (14 §21b, 0075 — anh Long 2026-10-26: "các tin dạng này cho click tra
  cứu tên tàu hoặc chủ tàu để show luôn đoạn đó cho nhanh").

  Nằm dưới hàng file đính kèm của bài topic chinh-sach. Hai lối:
   · TỰ SO: mở thẻ có sóng ⇒ gửi MÃ số đăng ký các tàu trong sổ (`loadBoats().maTau`, ≤5, chỉ mã — không tên/chủ)
     ⇒ có dòng ⇒ khối "Có tên" hiện luôn đoạn đó (không phải gõ gì). Không tàu / không khớp ⇒ im.
   · GÕ TRA: ô "Tên chủ tàu hoặc số đăng ký" + nút Tra cứu (Enter cũng được) ⇒ ≤20 dòng; không thấy ⇒ "Không thấy
     trong danh sách này"; file chưa đọc được (máy thu chưa đọc PDF) ⇒ "Chưa đọc được danh sách, bà con mở file".
  Mất sóng ⇒ ô mờ + "Cần sóng để tra". Mọi request qua kairosSend (đồng hồ, không ném). Không request lúc mở app —
  chỉ khi thẻ có đính kèm hiện trên tab Chính sách.
*/

import { useEffect, useRef, useState } from "react";
import { SearchField } from "@/components/ui/search-field";
import { loadBoats } from "@/lib/boats";
import { chuanReg } from "@/lib/kairos/chinh-sach.mjs";
import type { KairosPost } from "@/lib/kairos/types";
import { kairosSend } from "@/lib/kairos/write-client";
import { NHAN } from "@/lib/labels";
import { useOnline } from "@/lib/use-online";

type Dong = { stt: number; ten: string; reg: string; noiDung: string; page: number };
type KetQua = { ok: true; co: boolean; rows: Dong[] };

/** số đăng ký các tàu trong sổ (chỉ mã, ≤5) — rỗng khi chưa có tàu/chưa ghi mã */
function regsTrongSo(): string[] {
  try {
    return [...new Set(loadBoats().map((b) => chuanReg(b.maTau ?? "")).filter((x) => x.length >= 6))].slice(0, 5);
  } catch {
    return [];
  }
}

function HangDong({ d, dam }: { d: Dong; dam?: boolean }) {
  // đoạn in ra = cả dòng trong danh sách (STT · tên · địa chỉ · số đăng ký · CV · nghề · tiền · lần) — đúng "show luôn đoạn đó"
  return (
    <li className={`rounded-xl px-3 py-2 ${dam ? "bg-ok-bg" : "bg-field"}`}>
      <p className="text-[0.9375rem] font-bold text-navy">
        {d.reg}
        {d.ten && <span className="font-semibold text-foreground"> · {d.ten}</span>}
      </p>
      <p className="break-words text-[0.875rem] text-foreground/80">
        {d.noiDung}
        <span className="text-foreground/55"> · trang {d.page}</span>
      </p>
    </li>
  );
}

export function TraCuuDanhSach({ post, notify }: { post: KairosPost; notify?: (text: string, bad?: boolean) => void }) {
  const online = useOnline();
  const [q, setQ] = useState("");
  const [tau, setTau] = useState<Dong[] | null>(null);
  const [kq, setKq] = useState<{ q: string; co: boolean; rows: Dong[] } | null>(null);
  const [dang, setDang] = useState(false);
  const daSo = useRef(false);

  // TỰ SO tàu trong sổ — một lần mỗi lần thẻ hiện, chỉ khi có sóng và có mã tàu
  useEffect(() => {
    if (!online || daSo.current) return;
    const regs = regsTrongSo();
    if (!regs.length) return;
    daSo.current = true;
    void kairosSend<KetQua>("GET", `/api/kairos/posts/${post.id}/tra?tau=${encodeURIComponent(regs.join(","))}`).then((r) => {
      if (r.ok && r.data.rows.length) setTau(r.data.rows);
    });
  }, [online, post.id]);

  const tra = async () => {
    const s = q.trim();
    if ([...s].length < 2) return;
    if (!online) {
      notify?.("Cần sóng để tra.", true);
      return;
    }
    setDang(true);
    const r = await kairosSend<KetQua>("GET", `/api/kairos/posts/${post.id}/tra?q=${encodeURIComponent(s)}`);
    setDang(false);
    if (!r.ok) {
      notify?.(r.offline ? "Cần sóng để tra." : "Chưa tra được, thử lại sau.", true);
      return;
    }
    setKq({ q: s, co: r.data.co, rows: r.data.rows });
  };

  return (
    <div className="mb-2 border-b border-line px-4 pb-3" aria-label={NHAN.traCuu}>
      {tau && tau.length > 0 && (
        <div className="mb-2">
          <p className="mb-1 text-[0.875rem] font-bold text-ok">{NHAN.coTen}: tàu trong sổ của bà con</p>
          <ul className="space-y-1.5">
            {tau.map((d) => (
              <HangDong key={`${d.reg}-${d.stt}`} d={d} dam />
            ))}
          </ul>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void tra();
        }}
        className="flex items-center gap-2"
      >
        <div className="min-w-0 flex-1">
          <SearchField value={q} onChange={setQ} placeholder="Tên chủ tàu hoặc số đăng ký" label={NHAN.traCuu} />
        </div>
        <button
          type="submit"
          disabled={dang || [...q.trim()].length < 2}
          className="h-(--h-ctl) shrink-0 rounded-xl bg-navy px-4 text-[0.9375rem] font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
        >
          {dang ? "Đang tra…" : NHAN.traCuu}
        </button>
      </form>
      {!online && <p className="mt-1.5 text-[0.875rem] text-foreground/65">Cần sóng để tra.</p>}
      {kq && (
        <div className="mt-2">
          {kq.rows.length > 0 ? (
            <ul className="space-y-1.5">
              {kq.rows.map((d) => (
                <HangDong key={`${d.reg}-${d.stt}`} d={d} />
              ))}
            </ul>
          ) : (
            <p className="text-[0.875rem] text-foreground/65">
              {kq.co ? `Không thấy "${kq.q}" trong danh sách này.` : "Chưa đọc được danh sách, bà con mở file bên trên xem."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
