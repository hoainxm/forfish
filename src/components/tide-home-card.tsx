"use client";

/*
  THẺ CON NƯỚC CẢNG NHÀ — Trang chủ (2026-09-04, chủ dự án chốt: "thẻ cảng nhà
  click có thể xem các ngày khác nhau").

  Cảng nhà lấy qua MỘT cửa `docCangNha` (lib/cang-nha — ghim "cảng nhà" → cảng
  Sen Biển đã đặt → hồ sơ tàu → Kairos) → KHÔNG có thì thẻ ẨN HẲN
  (màn hình chính không có khối trống, cùng luật với InboxSection). Không lấy
  GPS ở đây: trang chủ mở trong bờ, xin định vị chỉ để hiện con nước là phiền.

  OFFLINE: file trạm nằm trong CRITICAL_SHELL, `fetchTideStations` có timeout
  20 s + cache; hỏng thì thẻ ẩn, mở lại app tự thử. Mọi phép tính trong máy.
*/

import { useEffect, useState } from "react";
import { TideCard, TideStationSheet } from "@/components/tide-card";
import { CANG_NHA_EVENT, docCangNha, type CangNha } from "@/lib/cang-nha";
import { fetchTideStations, type TideStation } from "@/lib/tides";

export function TideHomeCard() {
  const [cang, setCang] = useState<CangNha | null>(null);
  const [stations, setStations] = useState<TideStation[] | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [open, setOpen] = useState<{ st: TideStation; km: number } | null>(null);

  // đọc localStorage SAU hydrate — SSR không có cảng nhà, tránh lệch markup
  useEffect(() => {
    const doc = () => setCang(docCangNha());
    doc();
    // cảng nhà tự gắn theo số tàu S-Tracking (lib/cang-theo-so-tau) có thể về SAU lúc thẻ vẽ
    window.addEventListener(CANG_NHA_EVENT, doc);
    return () => window.removeEventListener(CANG_NHA_EVENT, doc);
  }, []);

  useEffect(() => {
    if (!cang) return;
    let alive = true;
    fetchTideStations()
      .then((t) => {
        if (alive && t.length) setStations(t);
      })
      .catch(() => {
        // im lặng có chủ ý — thẻ ẩn, lần mở sau tự thử lại
      });
    return () => {
      alive = false;
    };
  }, [cang]);

  // đồng hồ 5 phút — "Lúc này" phải nhích theo, app hay để mở cả buổi
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (!cang || !stations) return null;

  return (
    <section aria-label={`Con nước cảng nhà ${cang.name}`}>
      <h2 className="display mb-2 text-[1rem] font-semibold text-navy">
        Con nước — {cang.name}
      </h2>
      <TideCard
        stations={stations}
        lat={cang.lat}
        lon={cang.lon}
        nowMs={nowMs}
        onMore={(st, km) => setOpen({ st, km })}
      />
      {open && (
        <TideStationSheet
          station={open.st}
          distanceKm={open.km}
          nowMs={nowMs}
          title={`Con nước — ${cang.name}`}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
