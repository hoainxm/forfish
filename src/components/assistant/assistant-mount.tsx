"use client";

/*
  GỘP nút nổi + tấm che (14 §7.3). Đây là thứ `app-shell.tsx` nạp bằng
  `next/dynamic({ssr:false})` — một dòng duy nhất chạm vào khung app.

  Ba luật của file này:
  · KHÔNG làm gì lúc mở app. Không fetch, không đọc sổ, không dựng máy trạng
    thái — chỉ một nút. Snapshot chỉ gom khi bà con MỞ tấm che (CLAUDE.md 🟡 a).
  · Tấm che chỉ tồn tại khi mở, nên `useAssistant` (mic, TTS, đồng hồ) không
    chạy nền: đóng tấm che là mọi thứ tắt theo.
  · TTS trên iOS chỉ phát tiếng sau một cử chỉ chạm THẬT. Câu trả lời đến sau
    đó vài giây thì đã hết hiệu lực cử chỉ ⇒ "mở khoá" ngay trong handler chạm
    nút nổi bằng một lượt đọc rỗng (14 §5.2).
*/

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { speak } from "@/lib/assistant/speech";
import { AssistantFab, assistantHiddenOn } from "./assistant-fab";
import { AssistantSheet } from "./assistant-sheet";

/*  ROUTE PHẢI KÈM `?tab=` — `/tau` một mình không nói được bà con đang ở
    Giấy tờ hay Dịch vụ, mà bảng chip của 13 §5.3 tách ba tab của Tàu cá thành
    ba bộ chip khác nhau (`suggestions.ts` khớp `/^\/tau\?tab=dich-vu/`). Nên
    ngữ cảnh gửi cho hook là đường dẫn GHÉP query, không phải `usePathname()`.
    `useSearchParams` đòi ranh giới Suspense (Next dựng tĩnh) ⇒ bọc ngay đây. */
function useRouteWithTab(): string {
  const pathname = usePathname();
  const tab = useSearchParams().get("tab");
  return tab ? `${pathname}?tab=${tab}` : pathname;
}

export function AssistantMount() {
  return (
    <Suspense fallback={null}>
      <AssistantMountInner />
    </Suspense>
  );
}

function AssistantMountInner() {
  const pathname = usePathname();
  const route = useRouteWithTab();
  const [open, setOpen] = useState(false);

  /*  Nạp sẵn chunk của tấm che ngay khi nút nổi có mặt — 13 §8 đòi mở dưới
      300 ms, mà tải chunk lúc chạm thì mất chừng đó chỉ cho việc tải. Nhập
      động này không gọi mạng gì ngoài chính file JS đã nằm trong cache. */
  useEffect(() => {
    if (assistantHiddenOn(pathname)) return;
    void import("./assistant-sheet");
  }, [pathname]);

  const onOpen = useCallback(() => {
    try {
      // lượt đọc rỗng trong cử chỉ chạm = mở khoá loa cho iOS Safari
      speak("");
    } catch {
      /* máy không đọc được thì thôi — tấm che vẫn hiện chữ */
    }
    setOpen(true);
  }, []);

  return (
    <>
      <AssistantFab open={open} onOpen={onOpen} />
      {open && <AssistantSheet route={route} onClose={() => setOpen(false)} />}
    </>
  );
}
