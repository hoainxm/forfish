"use client";

/*
  THẺ CON NƯỚC CẢNG NHÀ — Trang chủ (2026-09-04, chủ dự án chốt: "thẻ cảng nhà
  click có thể xem các ngày khác nhau").

  Cảng nhà lấy theo thứ tự: điểm ghim "cảng nhà" (lib/places) → cảng hay cập
  trong hồ sơ tàu (`homePortId` → danh mục cảng) → KHÔNG có thì thẻ ẨN HẲN
  (màn hình chính không có khối trống, cùng luật với InboxSection). Không lấy
  GPS ở đây: trang chủ mở trong bờ, xin định vị chỉ để hiện con nước là phiền.

  OFFLINE: file trạm nằm trong CRITICAL_SHELL, `fetchTideStations` có timeout
  20 s + cache; hỏng thì thẻ ẩn, mở lại app tự thử. Mọi phép tính trong máy.
*/

import { useEffect, useState } from "react";
import { TideCard, TideStationSheet } from "@/components/tide-card";
import { FISHING_PORTS } from "@/data/fishing-ports";
import { loadBoats, loadCurrentBoatId } from "@/lib/boats";
import { homeOf, loadPlaces } from "@/lib/places";
import { fetchTideStations, type TideStation } from "@/lib/tides";

type CangNha = { name: string; lat: number; lon: number };

/** Cảng nhà theo thứ tự ưu tiên ở đầu file; null = chưa khai gì. */
export function cangNhaCuaToi(): CangNha | null {
  const home = homeOf(loadPlaces());
  if (home) return { name: home.name, lat: home.lat, lon: home.lon };
  // tàu đang chọn (đa tàu) → cảng hay cập trong hồ sơ tàu
  const boats = loadBoats();
  const cur = loadCurrentBoatId();
  const boat = boats.find((b) => b.id === cur) ?? boats[0];
  const id = boat?.homePortId;
  if (!id) return null;
  const p = FISHING_PORTS.find((x) => x.id === id);
  if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return null;
  return { name: p.name, lat: p.lat as number, lon: p.lng as number };
}

export function TideHomeCard() {
  const [cang, setCang] = useState<CangNha | null>(null);
  const [stations, setStations] = useState<TideStation[] | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [open, setOpen] = useState<{ st: TideStation; km: number } | null>(null);

  // đọc localStorage SAU hydrate — SSR không có cảng nhà, tránh lệch markup
  useEffect(() => {
    setCang(cangNhaCuaToi());
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
      <h2 className="display mb-2 text-[1.125rem] font-bold text-navy">
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
