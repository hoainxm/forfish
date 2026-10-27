"use client";

/*
  THẺ "BIỂN HÔM NAY" — Trang chủ (rà Taste 2026-10-22: màn đầu phải trả lời câu hỏi
  của nó bằng khối to nhất; câu của bà con mỗi sáng là "biển hôm nay thế nào").

  MÔ TẢ, KHÔNG PHÁN đi/không đi — cùng chữ với Bản đồ (`SEA_STATE`, lib/sea.ts).
  Cảng: cảng nhà (cangNhaCuaToi — ghim/hồ sơ tàu) → cảng có dự báo gần nhất ≤150 km;
  chưa khai cảng nhà thì lấy cảng dự báo đã chọn trước (`forfish.port.v1`); không có
  gì ⇒ thẻ ẨN (màn chính không có khối trống).

  OFFLINE: hiện BẢN LƯU trong máy ngay (readSeaCache), rồi mới hỏi mạng qua
  fetchSeaForecast (có timeout + thứ tự snapshot/live/bản cũ sẵn); hỏng thì GIỮ bản
  lưu và ghi "Bản lưu HH:MM". Bản lưu không có ngày hôm nay ⇒ ẩn (không đưa tin ngày
  cũ thành tin hôm nay). Không xin GPS ở Trang chủ.
*/

import { useEffect, useState } from "react";
import { useFeatureAccess } from "@/lib/use-tier";
import { soNgayThoiTiet } from "@/lib/tier";
import Link from "next/link";
import { PORTS, type FishingPort } from "@/data/ports";
import { ChevronRightIcon } from "@/components/icons";
import { cangNhaCuaToi } from "@/components/tide-home-card";
import { clockVN, isoDateVN } from "@/lib/day-labels";
import { beaufort, formatNumberVN } from "@/lib/marine-weather";
import {
  SEA_STATE,
  cangDuBaoGanNhat,
  fetchSeaForecast,
  readSeaCache,
  type ScoredSeaDay,
  type SeaLevel,
} from "@/lib/sea";

/** Bản dự báo cũ hơn mốc này thì ghi rõ "Bản lưu" — trùng TTL bản trong máy (sea.ts, 1 giờ). */
const BAN_LUU_SAU_MS = 60 * 60 * 1000;

/** Cùng khoá với bộ chọn cảng dự báo (sea-forecast.tsx) — chỉ ĐỌC ở đây. */
const PORT_KEY = "forfish.port.v1";

const LEVEL_TEXT: Record<SeaLevel, string> = {
  good: "text-ok",
  caution: "text-warn",
  bad: "text-danger",
};

/** Cảng để vẽ Biển hôm nay; null = chưa khai gì ⇒ tầng 5 mời "Chọn cảng nhà" (lib/tang-5, TC-11). */
export function cangBienHomNay(): FishingPort | null {
  const nha = cangNhaCuaToi();
  if (nha) return cangDuBaoGanNhat({ lat: nha.lat, lon: nha.lon });
  try {
    const saved = window.localStorage.getItem(PORT_KEY);
    return PORTS.find((p) => p.id === saved) ?? null;
  } catch {
    return null;
  }
}

export function SeaTodayCard() {
  const [port, setPort] = useState<FishingPort | null>(null);
  const [days, setDays] = useState<ScoredSeaDay[] | null>(null);
  /** mốc lưu của bản đang hiện khi nó là BẢN LƯU (mạng chưa/không trả) — null = bản mới */
  const [banLuu, setBanLuu] = useState<number | null>(null);
  // thẻ chỉ hiện HÔM NAY ⇒ khách/thường xin đúng 1 ngày (2026-10-27 — máy chủ gác ngày, tier.ts soNgayThoiTiet)
  const soNgay = soNgayThoiTiet(useFeatureAccess().access);

  // đọc localStorage SAU hydrate — SSR không có cảng nhà
  useEffect(() => {
    setPort(cangBienHomNay());
  }, []);

  useEffect(() => {
    if (!port) return;
    let alive = true;
    const luu = readSeaCache(port.id, soNgay);
    if (luu) setDays(luu.days);
    /*  Mốc lưu THẬT sau khi hỏi xong — `fetchSeaForecast` tự lùi về bản cũ trong máy mà
        KHÔNG ném lỗi, nên không thể suy "mới" từ việc nó trả về. Quá BAN_LUU_SAU_MS ⇒ nói
        ra "Bản lưu HH:MM". Chỉ ghi SAU khi hỏi xong — không nháy dòng vàng lúc mạng đang trả. */
    // nợ: snapshot server CŨ trả về khi live hỏng mà máy chưa từng lưu ⇒ moc=0, thẻ không ghi
    // "Bản lưu"; nâng khi fetchSeaForecast trả kèm mốc của chính bản nó đưa ra.
    const chotMoc = () => {
      if (!alive) return;
      const sau = readSeaCache(port.id, soNgay);
      const moc = sau?.savedAt ?? luu?.savedAt ?? 0;
      setBanLuu(moc > 0 && Date.now() - moc > BAN_LUU_SAU_MS ? moc : null);
    };
    fetchSeaForecast(port, soNgay)
      .then((d) => {
        if (alive && d.length > 0) setDays(d);
        chotMoc();
      })
      .catch(chotMoc); // hỏng: giữ bản lưu đang hiện (chưa từng có ⇒ thẻ ẩn)
    return () => {
      alive = false;
    };
  }, [port, soNgay]);

  if (!port || !days) return null;
  const today = days.find((d) => d.date === isoDateVN());
  if (!today) return null;

  const song = `Sóng tới ${formatNumberVN(today.waveMaxM)} m${today.waveEstimated ? " (ước)" : ""}`;
  const gio = `gió cấp ${beaufort(today.windMaxKmh)}`;
  const giat = today.gustMaxKmh > today.windMaxKmh ? ` · giật cấp ${beaufort(today.gustMaxKmh)}` : "";

  return (
    <section aria-label={`Biển hôm nay ở ${port.name}`}>
      <Link
        href="/ngu-truong"
        className="surface flex min-h-(--h-row) items-center gap-3 px-4 py-3 transition active:bg-field"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[0.8125rem] leading-snug text-foreground/65">
            Biển hôm nay · {port.name}
          </span>
          <span className={`display block text-[1.5rem] font-semibold leading-tight ${LEVEL_TEXT[today.level]}`}>
            {SEA_STATE[today.level]}
          </span>
          <span className="mt-0.5 block text-[1rem] leading-snug text-foreground/80">
            {song} · {gio}
            {giat}
          </span>
          {banLuu != null && (
            <span className="mt-0.5 block text-[0.8125rem] font-semibold leading-snug text-warn">
              Bản lưu {clockVN(banLuu)}
            </span>
          )}
        </span>
        <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/50" />
      </Link>
    </section>
  );
}
