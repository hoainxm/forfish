"use client";

/*
  SƠ ĐỒ LỘ TRÌNH (2026-11-08, anh Long: "tính chuyến biển sao ko thấy trực quan bản đồ để biết vùng nào luôn?").
  Một hình SVG nhỏ: nền xanh = vùng biển Việt Nam được phép (ĐÚNG hình geofence `VN_SEA_POLYS` — không thêm dữ
  liệu nào), cảng xuất bến, các vùng đánh đánh số theo thứ tự ghé, đường thẳng nối (thứ tự, KHÔNG phải tuyến né
  sóng — tuyến thật là việc của Dẫn đường). Vẽ bằng dữ liệu trong bundle ⇒ mất sóng vẫn hiện; không MapLibre,
  không tải ô bản đồ. Màu qua token (fill-sea / stroke-navy…), không hex.
*/

import { useMemo } from "react";
import { VN_SEA_POLYS } from "@/lib/vung-bien-vn";
import type { LoTrinhKetQua } from "@/lib/lo-trinh/types";

const RONG = 320;
/** lề quanh các mốc (độ) — đủ thấy dáng bờ quanh cảng */
const LE_DO = 0.8;

export function SoDoLoTrinh({ kq }: { kq: LoTrinhKetQua }) {
  const ve = useMemo(() => {
    const moc = kq.moc.filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lon));
    if (moc.length < 2) return null;
    let s = 90, n = -90, w = 180, e = -180;
    for (const m of moc) {
      s = Math.min(s, m.lat); n = Math.max(n, m.lat);
      w = Math.min(w, m.lon); e = Math.max(e, m.lon);
    }
    s -= LE_DO; n += LE_DO; w -= LE_DO; e += LE_DO;
    const kx = Math.cos((((s + n) / 2) * Math.PI) / 180); // co kinh độ theo vĩ độ giữa — khỏi méo dáng bờ
    const rongDo = (e - w) * kx, caoDo = n - s;
    // khung không quá dẹt / quá cao: kẹp tỉ lệ 0,6–1,6
    const tiLe = Math.min(1.6, Math.max(0.6, caoDo / rongDo));
    const CAO = Math.round(RONG * tiLe);
    const k = Math.min(RONG / rongDo, CAO / caoDo);
    const ox = (RONG - rongDo * k) / 2, oy = (CAO - caoDo * k) / 2;
    const x = (lon: number) => ox + (lon - w) * kx * k;
    const y = (lat: number) => oy + (n - lat) * k;
    let bien = "";
    for (const poly of VN_SEA_POLYS)
      for (const ring of poly) {
        if (ring.length < 3) continue;
        bien += `M${ring.map(([lo, la]) => `${x(lo).toFixed(1)},${y(la).toFixed(1)}`).join("L")}Z`;
      }
    const tuyen = moc.map((m) => `${x(m.lon).toFixed(1)},${y(m.lat).toFixed(1)}`).join(" ");
    return { CAO, bien, tuyen, x, y, moc };
  }, [kq.moc]);

  if (!ve) return null;
  const cang = ve.moc[0];
  return (
    <figure className="surface mt-3 overflow-hidden">
      <svg
        viewBox={`0 0 ${RONG} ${ve.CAO}`}
        className="block h-auto w-full bg-field"
        role="img"
        aria-label={`Sơ đồ lộ trình: ${cang.ten} qua ${kq.vung.length} vùng đánh rồi về`}
      >
        <path d={ve.bien} fillRule="evenodd" className="fill-sea/15 stroke-sea/40" strokeWidth={0.6} />
        <polyline points={ve.tuyen} fill="none" className="stroke-navy" strokeWidth={1.6} strokeDasharray="5 4" />
        {ve.moc.slice(1, -1).map((m, i) => {
          return (
            <g key={i}>
              <circle cx={ve.x(m.lon)} cy={ve.y(m.lat)} r={9} className={m.loai === "diem-quen" ? "fill-sea" : "fill-navy"} />
              <text x={ve.x(m.lon)} y={ve.y(m.lat) + 3.5} textAnchor="middle" className="fill-white text-[0.625rem] font-semibold">
                {i + 1}
              </text>
            </g>
          );
        })}
        <rect x={ve.x(cang.lon) - 5} y={ve.y(cang.lat) - 5} width={10} height={10} rx={2} className="fill-warn" />
      </svg>
      <figcaption className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 py-1.5 text-[0.75rem] text-muted">
        <span>
          <span aria-hidden className="mr-1 inline-block h-2 w-2 rounded-sm bg-warn align-middle" />
          {cang.ten}
        </span>
        <span>Số = thứ tự vùng ghé</span>
        <span>Nét đứt = thứ tự đi, đường thật xem ở Dẫn đường</span>
      </figcaption>
    </figure>
  );
}
