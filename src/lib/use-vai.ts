"use client";

import { useEffect, useState } from "react";
import { useAuthUser } from "@/lib/use-auth";
import { effectivePremiumMark, readPremiumMark, readTierMarkRaw, readTierUntilRaw } from "@/lib/tier";
import { useFeatureAccess } from "@/lib/use-tier";
import { coBanDo, VAI_EVENT, type Vai, type VaiMay } from "@/lib/vai";
import { docVaiMay, dongBoVai } from "@/lib/vai-store";

/**
 * Vai của tài khoản đang đăng nhập (spec 17). `vai` null = chưa chọn hoặc chưa đăng nhập; `biet` = máy đã có bản vai
 * của tài khoản này (chưa có thì đừng vội mời chọn — có thể máy chủ đang trả lời). `banDo` = ô Bản đồ có hiện không (§11).
 * `san` = đã đọc kho máy (trước đó đừng quyết chặn/mở màn nặng như bản đồ).
 */
export function useVai(): { phone: string | null; vai: Vai | null; biet: boolean; banDo: boolean; san: boolean } {
  const { phone, ready } = useAuthUser();
  const { access } = useFeatureAccess();
  // đọc trong effect, không lúc render — bản dựng máy chủ và bản vẽ đầu ở máy phải khớp nhau
  const [may, setMay] = useState<VaiMay | null>(null);
  /** đã đọc kho máy lần đầu chưa — trước đó vai luôn null (bản dựng máy chủ) */
  const [san, setSan] = useState(false);

  useEffect(() => {
    setMay(docVaiMay(phone));
    setSan(true);
    if (!phone) return;
    const doc = () => setMay(docVaiMay(phone));
    window.addEventListener(VAI_EVENT, doc);
    window.addEventListener("storage", doc);
    const coSong = () => void dongBoVai(phone);
    window.addEventListener("online", coSong);
    void dongBoVai(phone);
    return () => {
      window.removeEventListener(VAI_EVENT, doc);
      window.removeEventListener("storage", doc);
      window.removeEventListener("online", coSong);
    };
  }, [phone]);

  const vai = phone ? (may?.vai ?? null) : null;
  return { phone, vai, biet: !!may, banDo: coBanDo(vai, coGoi(access)), san: san && ready };
}

/** "open" = có gói. Đang tra ("checking") thì dùng dấu hạng đã lưu — không để ô Bản đồ nháy mất rồi hiện lại. */
function coGoi(access: string): boolean {
  if (access === "open") return true;
  if (access !== "checking" || typeof window === "undefined") return false;
  try {
    return effectivePremiumMark(readPremiumMark(readTierMarkRaw()), readTierUntilRaw(), Date.now()) === "premium";
  } catch {
    return false;
  }
}
