"use client";

/*
  THẺ "BIỂN HÔM NAY" — Trang chủ (rà Taste 2026-10-22: màn đầu phải trả lời câu hỏi
  của nó bằng khối to nhất; câu của bà con mỗi sáng là "biển hôm nay thế nào").

  MÔ TẢ, KHÔNG PHÁN đi/không đi — cùng chữ với Bản đồ (`SEA_STATE`, lib/sea.ts).
  Cảng: cảng nhà (docCangNha — MỘT cửa đọc, lib/cang-nha) → cảng có dự báo gần nhất ≤150 km;
  chưa khai cảng nhà thì lấy cảng dự báo đã chọn trước (`forfish.port.v1`); không có
  gì ⇒ thẻ ẨN (màn chính không có khối trống).

  OFFLINE: hiện BẢN LƯU trong máy ngay (readSeaCache), rồi mới hỏi mạng qua
  fetchSeaForecast (có timeout + thứ tự snapshot/live/bản cũ sẵn); hỏng thì GIỮ bản
  lưu và ghi "Bản lưu HH:MM". Bản lưu không có ngày hôm nay ⇒ ẩn (không đưa tin ngày
  cũ thành tin hôm nay). Không xin GPS ở Trang chủ.
*/

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useFeatureAccess } from "@/lib/use-tier";
import { soNgayThoiTiet } from "@/lib/tier";
import Link from "next/link";
import { PORTS, type FishingPort } from "@/data/ports";
import { ChevronRightIcon } from "@/components/icons";
import { CANG_NHA_EVENT, docCangNha } from "@/lib/cang-nha";
import { docDauTuDong } from "@/lib/cang-theo-so-tau";
import { isoDateVN } from "@/lib/day-labels";
import { gioLuu } from "@/lib/offline-line";
import { beaufort, formatNumberVN } from "@/lib/marine-weather";
import {
  SEA_STATE,
  cangDuBaoGanNhat,
  fetchSeaForecast,
  readSeaCache,
  type ScoredSeaDay,
  type SeaLevel,
} from "@/lib/sea";

/*  Tách chunk (kéo theo bộ tải dự báo); chunk lỗi lúc mất sóng ⇒ không vẽ dòng, KHÔNG làm sập Trang chủ. */
const ReadyToSailLine = dynamic(
  () =>
    import("@/components/pretrip-auto-notify")
      .then((m) => m.ReadyToSailLine)
      .catch(() => () => null),
  { ssr: false },
);

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
  const nha = docCangNha();
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
  /** cảng nhà do app TỰ GẮN theo số tàu S-Tracking (lib/cang-theo-so-tau) — hiện một dòng "· Đổi" để bà con biết mà sửa */
  const [tuDong, setTuDong] = useState<{ ten: string; soTau: string } | null>(null);
  useEffect(() => {
    const doc = () => {
      setPort(cangBienHomNay());
      const d = docDauTuDong();
      const nha = docCangNha();
      setTuDong(d && nha?.portId === d.portId ? { ten: nha.name, soTau: d.soTau } : null);
    };
    doc();
    window.addEventListener(CANG_NHA_EVENT, doc);
    return () => window.removeEventListener(CANG_NHA_EVENT, doc);
  }, []);

  useEffect(() => {
    if (!port) return;
    let alive = true;
    const luu = readSeaCache(port.id, soNgay);
    if (luu) setDays(luu.days);
    /*  BẢN LƯU ĐÃ CŨ ⇒ NÓI NGAY, không đợi mạng (rà offline 2026-10-29, 07 §10.1): sóng chập chờn thì hỏi mạng mất
        15–45 giây, suốt lúc đó số của hôm kia đứng trên Trang chủ như số mới. Bản lưu còn trong 1 giờ thì im như cũ
        (không nháy dòng vàng lúc mạng tốt); số mới về thì `chotMoc` gỡ nhãn. */
    setBanLuu(luu && luu.savedAt > 0 && Date.now() - luu.savedAt > BAN_LUU_SAU_MS ? luu.savedAt : null);
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

  /* DÒNG "SẴN SÀNG RA KHƠI" ngay dưới thẻ (rà offline F3, 2026-10-29) — hiện cả khi thẻ ẩn (chưa khai cảng): máy đủ
     dự báo + vỏ + khoá + nền bản đồ chưa là câu hỏi của MỌI người sắp ra khơi, không riêng người đã khai cảng. */
  const ready = <ReadyToSailLine />;
  if (!port || !days) return ready;
  const today = days.find((d) => d.date === isoDateVN());
  if (!today) return ready;

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
          <span className="block text-[0.8125rem] leading-snug text-muted">
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
              {/* kèm NGÀY (07 §10.1C, rà offline 2026-10-29): ngày thứ ba ngoài khơi không được đọc như số chiều nay */}
              Bản lưu {gioLuu(banLuu)}
            </span>
          )}
        </span>
        <ChevronRightIcon className="h-5 w-5 shrink-0 text-foreground/50" />
      </Link>
      {tuDong && (
        <p className="mt-1 px-1 text-[0.8125rem] leading-snug text-muted">
          Cảng nhà {tuDong.ten} — app chọn theo số tàu {tuDong.soTau} ·{" "}
          <Link href="/cang" className="font-semibold text-t1 underline-offset-2 hover:underline">
            Đổi
          </Link>
        </p>
      )}
      {ready}
    </section>
  );
}
