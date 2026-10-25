"use client";

/*
  CHUÔNG KAIROS GỌN (14 §16). Đầu /kairos, cạnh nút Tuỳ chọn. Chỉ 2 loại tin: có người bình luận bài mình /
  trả lời bình luận mình — lấy từ HỘP THƯ đã có (lib/inbox.ts), lọc bằng lib/kairos/chuong.ts.
  OFFLINE: mở màn CHỈ đọc bản lưu hộp thư (forfish.inbox.v2) — không request. Chạm chuông (bà con tự bấm) mới
  làm mới hộp thư + báo đã đọc qua ĐÚNG hai đường của hộp thư (refreshInbox 10 s, markRead 8 s, mất sóng tự bỏ,
  không ném). Mất sóng: ngăn vẫn hiện đủ tin đã lưu; chấm đếm tắt trong phiên này, sổ "đã đọc" chỉ ghi khi máy
  chủ xác nhận (cùng luật mục Thông báo trang chủ) nên mở lại lúc chưa có sóng có thể thấy chấm lại.
*/

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BellIcon } from "@/components/icons";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { acceptRefresh, loadInbox, markRead, refreshInbox, unreportedIds, type InboxMessage } from "@/lib/inbox";
import { nhanDem, tinChuongKairos, type TinChuong } from "@/lib/kairos/chuong";
import { postTimeLabel } from "@/lib/kairos/feed-client";
import { NHAN } from "@/lib/labels";
import { useAuthUser } from "@/lib/use-auth";

export function ChuongKairos() {
  const { phone } = useAuthUser();
  const [list, setList] = useState<TinChuong[]>([]);
  /** id đã hiện trong ngăn ở phiên này — chấm đếm tắt ngay, kể cả khi chưa báo về được */
  const [daXem, setDaXem] = useState<Set<string>>(new Set());
  const [mo, setMo] = useState(false);
  const [now, setNow] = useState(0);

  const tinh = useCallback(
    (msgs: InboxMessage[]): TinChuong[] => {
      const l = tinChuongKairos(msgs, new Set(unreportedIds(phone, msgs.map((m) => m.id))));
      setList(l);
      return l;
    },
    [phone],
  );

  // bản lưu hộp thư, đọc lại khi quay lại app (không mạng)
  useEffect(() => {
    tinh(loadInbox(phone));
    setDaXem(new Set());
    const f = () => {
      if (document.visibilityState === "visible") tinh(loadInbox(phone));
    };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [phone, tinh]);

  const baoDoc = useCallback(
    (l: TinChuong[]) => {
      const ids = l.filter((t) => t.chuaDoc).map((t) => t.id);
      if (!ids.length) return;
      setDaXem((s) => new Set([...s, ...ids]));
      void markRead(phone, ids).then(() => tinh(loadInbox(phone)));
    },
    [phone, tinh],
  );

  const moNgan = () => {
    setNow(Date.now());
    setMo(true);
    baoDoc(list);
    void refreshInbox().then((r) => {
      if (!r || !acceptRefresh(phone, r.phone)) return; // mất sóng / ngăn khác — giữ bản đang hiện
      baoDoc(tinh(r.messages));
    });
  };

  const soMoi = list.filter((t) => t.chuaDoc && !daXem.has(t.id)).length;
  const nhan = soMoi ? `${NHAN.thongBao}: ${soMoi} tin mới` : NHAN.thongBao;

  return (
    <>
      <button
        type="button"
        aria-label={nhan}
        title={nhan}
        onClick={moNgan}
        className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-line text-sea transition active:scale-[0.97]"
      >
        <BellIcon className="h-5 w-5" />
        {soMoi > 0 && (
          <span
            aria-hidden
            className="absolute -right-1.5 -top-1.5 h-5 min-w-5 rounded-full bg-trim px-1 text-center text-[0.6875rem] font-semibold leading-5 text-white"
          >
            {nhanDem(soMoi)}
          </span>
        )}
      </button>
      {mo && (
        <BottomSheet title="Thông báo Kairos" onClose={() => setMo(false)}>
          <p className="mb-3 text-[0.9375rem] text-foreground/75">Chỉ báo khi có người bình luận bài của bạn hoặc trả lời bạn.</p>
          {list.length === 0 ? (
            <p className="rounded-xl bg-field px-4 py-5 text-center text-[1rem] text-foreground/75">
              {phone ? "Chưa có ai bình luận hay trả lời bạn." : "Đăng nhập để biết khi có người bình luận bài của bạn."}
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden surface">
              {list.map((t) => (
                <li key={t.id}>
                  <Link href={t.url} onClick={() => setMo(false)} className="block min-h-(--h-row) px-4 py-3 active:bg-field">
                    <span className="flex items-start gap-2">
                      {t.chuaDoc && <span className="mt-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-trim" aria-label="Chưa đọc" />}
                      <span className="min-w-0 flex-1 text-[1rem] font-semibold leading-snug text-navy">{t.title}</span>
                    </span>
                    <span className="mt-1 block text-[1rem] leading-snug text-foreground/85">{t.body}</span>
                    <span className="mt-1 block text-[0.8125rem] text-foreground/65">{now ? postTimeLabel(t.sentAt, now) : ""}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </BottomSheet>
      )}
    </>
  );
}
