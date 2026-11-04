"use client";

/**
 * Bà con đã chọn CHẾ ĐỘ HẢI ĐỒ (`forfish.haiDo.v1` (trường moHaiDo)) ⇒ bấm "Bản đồ" trên dock
 * mở thẳng `/hai-do` thay vì màn bản đồ thường. Đang chuyển thì KHÔNG dựng màn cũ
 * (bản đồ nặng, dựng xong lại bỏ là phí pin). Nút "Về bản đồ thường" bên màn hải đồ
 * tắt cờ này.
 */
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useHaiDoPrefs } from "@/lib/hai-do/prefs";

export function ChuyenHaiDo({ children }: { children: React.ReactNode }) {
  const { moHaiDo } = useHaiDoPrefs();
  const router = useRouter();
  useEffect(() => {
    if (moHaiDo) router.replace("/hai-do");
  }, [moHaiDo, router]);
  return moHaiDo ? null : <>{children}</>;
}
