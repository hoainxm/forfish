"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { readToken } from "@/lib/device-token-store";
import { useTodayVN } from "@/lib/use-today";
import { savedStormActive } from "@/lib/storms";
import { docPushMessage, reminderWhenText, type DueReminder } from "@/lib/doc-reminders";
import { localDueReminders, markSeenKeys } from "@/lib/doc-reminder-local";

/*
  NHẮC HẠN GIẤY TỜ KHI MỞ APP (2026-10-20, user: "làm cả thông báo khi mở app
  lên nữa"). Cùng lịch mốc với thông báo điện thoại (30·25·20·15·10 rồi hằng
  ngày 5→0) nhưng đọc KHO MÁY ⇒ chạy cả khi mất sóng, cả khi máy chưa bật
  chuông, cả giấy chưa đồng bộ lên máy chủ. Mỗi mốc hiện MỘT lần; "Để sau" hay
  "Xem giấy tờ" đều tính là đã báo (sổ `forfish.docRemindSeen.v1`). Dải khẩn
  bên dưới vẫn nằm đó suốt 30 ngày như cũ.

  Nhường tầng 1: bản tin bão trong máy đang có cơn ⇒ lần mở này KHÔNG hiện (tin
  bão không bị lớp nào che — 07 §12); lần mở sau hết bão thì hiện. Chưa đăng
  nhập ⇒ im, cùng cổng `readToken()` với dải khẩn (máy dùng chung ở bến).
*/

const MAX_ROWS = 4;

export function DocRemindOnOpen() {
  const { todayIso } = useTodayVN();
  const [due, setDue] = useState<DueReminder[]>([]);

  useEffect(() => {
    if (readToken() == null) return;
    const found = localDueReminders(todayIso);
    if (found.length === 0) return;
    let alive = true;
    savedStormActive(Date.now())
      .catch(() => false)
      .then((storm) => {
        if (alive && !storm) setDue(found);
      });
    return () => {
      alive = false;
    };
  }, [todayIso]);

  if (due.length === 0) return null;

  const close = () => {
    markSeenKeys(
      due.map((d) => d.key),
      todayIso,
    );
    setDue([]);
  };
  const { title } = docPushMessage(due);
  // Chỉ toàn giấy của thuyền viên ⇒ mở sổ thuyền viên; có giấy tàu ⇒ tab Giấy tờ
  const href = due.some((d) => d.item.ref.startsWith("doc:"))
    ? "/tau?tab=giay-to"
    : "/nguoi";
  const rest = due.length - MAX_ROWS;

  return (
    <BottomSheet title={title} onClose={close}>
      <ul className="overflow-hidden surface">
        {due.slice(0, MAX_ROWS).map((d, i) => (
          <li
            key={d.key}
            className={`px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}
          >
            <span className="block text-[1.125rem] font-semibold">{d.item.label}</span>
            <span
              className={`block text-[1rem] font-bold ${
                d.days <= 0 ? "text-danger" : "text-warn"
              }`}
            >
              {reminderWhenText(d.days, d.item.expiresOn)}
            </span>
          </li>
        ))}
      </ul>
      {rest > 0 && (
        <p className="mt-2 px-1 text-[1rem] text-foreground/70">Và {rest} giấy khác.</p>
      )}
      <p className="mt-3 px-1 text-[1rem] text-foreground/80">
        Bà con lo gia hạn sớm để khỏi bị phạt.
      </p>
      <div className="mt-4 space-y-2.5">
        <Link
          href={href}
          onClick={close}
          className="display flex min-h-[3.75rem] w-full items-center justify-center rounded-full bg-trim text-[1.125rem] font-bold text-white shadow-trim-cta transition active:scale-[0.98]"
        >
          Xem giấy tờ
        </Link>
        <button
          type="button"
          onClick={close}
          className="display flex min-h-[3.75rem] w-full items-center justify-center rounded-full bg-card text-[1.125rem] font-bold text-foreground/80 transition active:scale-[0.98]"
        >
          Để sau
        </button>
      </div>
    </BottomSheet>
  );
}
