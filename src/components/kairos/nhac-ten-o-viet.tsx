"use client";

/*
  GÕ "@" ĐỂ NHẮC TÊN kiểu Facebook (14 §3.12, 0071) — dùng chung ô bình luận + khung soạn bài.

  Gõ "@" (đầu chữ hoặc sau khoảng trắng) + vài chữ ⇒ danh sách ≤5 người ngay trên ô viết: người TRONG BÀI trước
  (chủ bài, người đã bình luận — có sẵn, không mạng), rồi người tìm trên máy chủ (`/api/kairos/users?q=`, chờ 250 ms
  sau phím cuối, chỉ khi có sóng). Chạm một người ⇒ đoạn "@chữ" thành "@Tên " và con trỏ đứng sau. Xoá chữ "@Tên"
  ⇒ hết tag (`locNhacTen`). Escape đóng danh sách. Tag KHÔNG vào nháp — nháp chỉ giữ chữ.
*/

import { useEffect, useRef, useState, type RefObject } from "react";
import { chenTen, dangGo, goiY, locNhacTen, type NhacTen } from "@/lib/kairos/nhac-ten";
import { kairosSend } from "@/lib/kairos/write-client";
import { useOnline } from "@/lib/use-online";
import { KairosAvatar } from "./kairos-avatar";

export interface NguoiNhac {
  id: string;
  ten: string;
  avatarUrl?: string | null;
  isAgent?: boolean;
}

export function useNhacTen({
  text,
  setText,
  box,
  quen = [],
  dau = [],
}: {
  text: string;
  /** đổi chữ ô viết (bên gọi lo lưu nháp) */
  setText: (v: string) => void;
  box: RefObject<HTMLTextAreaElement | null>;
  /** người trong bài — gợi ý trước, không cần mạng */
  quen?: readonly NguoiNhac[];
  /** người đã tag sẵn (sửa bài) */
  dau?: readonly NhacTen[];
}) {
  const online = useOnline();
  const [chon, setChon] = useState<NhacTen[]>(() => [...dau]);
  const [go, setGo] = useState<{ start: number; q: string } | null>(null);
  const [xa, setXa] = useState<NguoiNhac[]>([]);
  const lan = useRef(0);

  // tìm trên máy chủ — chỉ khi đang gõ ≥1 chữ sau "@" và có sóng
  useEffect(() => {
    const q = go?.q.trim() ?? "";
    if (!q || !online) {
      setXa([]);
      return;
    }
    const so = ++lan.current;
    const t = setTimeout(async () => {
      const r = await kairosSend<{ users: NguoiNhac[] }>("GET", `/api/kairos/users?q=${encodeURIComponent(q)}`);
      if (so === lan.current) setXa(r.ok ? r.data.users : []);
    }, 250);
    return () => clearTimeout(t);
  }, [go?.q, online]);

  const theoDoi = (v: string, caret: number) => setGo(dangGo(v, caret));

  const ds = go
    ? [...goiY(go.q, quen, 5), ...xa].filter((n, i, all) => all.findIndex((x) => x.id === n.id) === i).slice(0, 5)
    : [];

  const pick = (n: NguoiNhac) => {
    const el = box.current;
    if (!go || !el) return;
    const r = chenTen(text, go.start, el.selectionStart ?? text.length, n.ten);
    setText(r.text);
    setChon((cur) => (cur.some((m) => m.id === n.id) ? cur : [...cur, { id: n.id, ten: n.ten }]));
    setGo(null);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(r.caret, r.caret);
    }, 0);
  };

  const danhSach =
    go && ds.length > 0 ? (
      <ul role="listbox" aria-label="Nhắc tên" className="mb-2 overflow-hidden rounded-2xl border border-line bg-card shadow-float">
        {ds.map((n) => (
          <li key={n.id} role="option" aria-selected={false}>
            <button
              type="button"
              // giữ con trỏ trong ô viết (không mất chỗ đang gõ) — chọn bằng click
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => pick(n)}
              className="flex h-12 w-full items-center gap-2 px-3 text-left active:bg-field"
            >
              <KairosAvatar id={n.id} name={n.ten} url={n.avatarUrl ?? null} small />
              <span className="min-w-0 truncate text-[0.9375rem] font-semibold text-navy">{n.ten}</span>
              {n.isAgent && <span className="rounded-full bg-navy/10 px-1.5 text-[0.6875rem] font-bold text-navy">AI</span>}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return {
    /** người được tag còn "@Tên" trong chữ — gửi kèm `mentions` */
    nhac: locNhacTen(text, chon),
    theoDoi,
    danhSach,
    /** danh sách đang mở — Escape đóng danh sách trước, không đóng khung chứa */
    mo: !!danhSach,
    dong: () => setGo(null),
    /** sau khi gửi xong */
    xoa: () => {
      setChon([]);
      setGo(null);
    },
  };
}
