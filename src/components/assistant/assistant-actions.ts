"use client";

/*
  LÀM VIỆC MÀ TRỢ LÝ ĐỀ NGHỊ (14 §7.3). Tách khỏi `assistant-mount.tsx` vì hai
  lý do:

  1. `useMarketCart` đọc giỏ + gắn listener ngay lúc mount. `AssistantMount`
     sống ở MỌI màn app ngư dân — để nó ở đó là đọc localStorage mỗi lần đổi
     màn cho một việc chỉ xảy ra khi bà con mở tấm che. Hook này chỉ chạy khi
     tấm che mở (CLAUDE.md 🟡 (a): không làm gì lúc mở app).
  2. Việc thêm giỏ phải trả về KẾT QUẢ để tấm che nói đúng câu (đã thêm / giỏ
     đầy / máy hết chỗ) — `useAssistant` chỉ nhận `onAction` trả void.

  Tập hành động là ĐÓNG (14 §3.1 `AssistantAction`): không có đặt hàng, huỷ
  đơn, xoá. Thêm giỏ và gọi điện chỉ chạy sau MỘT chạm xác nhận trên tấm che.
*/

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useMarketCart } from "@/components/market/buyer/hooks";
import type { AssistantAction } from "@/lib/assistant/types";
import { saveCurrentBoatId } from "@/lib/boats";
import { saveHome } from "@/lib/region";
import { storageFullCopy } from "@/lib/user-store";

/** Câu báo inline sau khi làm xong — tấm che hiện băng, KHÔNG toast (07 §12). */
export interface ActionNote {
  text: string;
  level: "ok" | "danger";
  /** chip đi tiếp sau khi làm xong (vd "Xem giỏ") */
  link?: { label: string; href: string };
}

export function useAssistantActions(onClose: () => void) {
  const router = useRouter();
  const cart = useMarketCart();

  return useCallback(
    (a: AssistantAction): ActionNote | null => {
      switch (a.type) {
        case "navigate":
          onClose();
          router.push(a.href);
          return null;
        case "search":
          onClose();
          router.push(`/cho/tim?q=${encodeURIComponent(a.q)}`);
          return null;
        case "addToCart": {
          const r = cart.add(a.productId, a.variantLabel, a.qty);
          if (r === "gio_day")
            return { text: "Giỏ đầy rồi — bỏ bớt món cũ rồi thêm lại.", level: "danger" };
          // Ghi hỏng thì KHÔNG được nói "đã thêm" (CLAUDE.md quy tắc 4)
          if (r === "het_cho") return { text: storageFullCopy("giỏ hàng"), level: "danger" };
          return {
            text: `Đã thêm ${a.qty} ${a.title} vào giỏ.`,
            level: "ok",
            link: { label: "Xem giỏ", href: "/cho/gio" },
          };
        }
        case "call":
          // mất sóng vẫn gọi được — gọi là việc của sóng điện thoại, không phải mạng
          window.location.href = `tel:${a.tel}`;
          return { text: `Đang gọi ${a.label}.`, level: "ok" };
        case "setHomePort": {
          /*  TỈNH PHẢI ĐI THEO CẢNG. Bản trước giữ nguyên tỉnh cũ (`...loadHome()`)
              nên đặt cảng nhà Tắc Cậu mà tỉnh vẫn là tỉnh cũ — "Gần tôi", chỗ
              bán và giá cá đều tra theo tỉnh, sai tỉnh là sai cả ba (P1-3).
              Tỉnh lấy từ chính hành động (tầng máy đã tra danh sách cảng thật);
              cảng không rõ tỉnh thì BỎ tỉnh cũ đi, thà thiếu còn hơn chỉ bà con
              tới đúng một tỉnh sai. */
          saveHome({ portId: a.portId, ...(a.province ? { province: a.province } : {}) });
          return {
            text: `Đã đặt cảng nhà là ${a.portName}.`,
            level: "ok",
            /*  HAI ĐƯỜNG LÙI, HAI VIỆC KHÁC NHAU — chữ phải khác nhau rõ (audit
                P2-N2): nút này MỞ DANH SÁCH để chọn cảng khác, còn chip "Đổi
                lại" của câu trả lời đặt NGAY cảng cũ về. Cùng chữ "Đổi lại" thì
                bà con chạm nhầm, mất cảng vừa đặt mà không hiểu vì sao. */
            link: { label: "Chọn cảng khác", href: "/cang" },
          };
        }
        case "setBoat":
          saveCurrentBoatId(a.boatId);
          return {
            text: `Đang chọn tàu ${a.boatName}.`,
            level: "ok",
            link: { label: "Đổi lại ở Tàu cá", href: "/tau" },
          };
        case "mute":
          // `useAssistant` đã ghi vào prefs — ở đây chỉ báo lại cho bà con
          return { text: a.on ? "Đã tắt tiếng." : "Đã bật tiếng.", level: "ok" };
      }
    },
    [cart, router, onClose],
  );
}
