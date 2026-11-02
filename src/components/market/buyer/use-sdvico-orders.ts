"use client";

// Tải ĐƠN SDVICO của tôi (GET /api/cho/don-sdvico) — có bản lưu khi mất sóng.
// Lỗi KHÔNG chặn màn đơn chợ: hỏng thì trả danh sách rỗng/bản lưu, màn vẫn chạy.
import { useCallback, useEffect, useState } from "react";
import { marketGet } from "@/lib/market/client";
import { useOnlineRefetch } from "@/lib/market/use-online";
import { loadCachedSdvicoOrders, saveCachedSdvicoOrders } from "@/lib/sdvico-orders/cache";
import type { SdvicoOrder } from "@/lib/sdvico-orders/types";
import { useAuthUser } from "@/lib/use-auth";

export function useSdvicoOrders() {
  const { phone } = useAuthUser();
  const [orders, setOrders] = useState<SdvicoOrder[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    const res = await marketGet<{ items: SdvicoOrder[] }>("/api/cho/don-sdvico");
    if (res.ok) {
      setOrders(res.data.items);
      saveCachedSdvicoOrders(phone, res.data.items);
    } else {
      // không có bản lưu của SĐT NÀY ⇒ rỗng (không giữ đơn của tài khoản trước trên máy dùng chung)
      setOrders(loadCachedSdvicoOrders(phone)?.orders ?? []);
    }
    setLoaded(true);
  }, [phone]);

  useEffect(() => {
    void reload();
  }, [reload]);
  useOnlineRefetch(() => void reload());

  return { orders, loaded, reload };
}
