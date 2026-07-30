"use client";

/*
  Trục 1 — HẠT BAY animated kiểu Windy (user 2026-07-29: "làm đúng mô hình
  windy"): hạt trắng trôi theo trường u/v (gió; lớp sóng theo hướng sóng),
  chuyển ô mượt nhờ bilinear (lib/particle-field). Vệt đuôi mờ dần bằng
  destination-in fade — đúng kỹ thuật leaflet-velocity/windy.

  HIỆU ỨNG NẰM TRÊN (front): canvas overlay phủ trên bản đồ + lớp màu, hạt
  trắng opacity ~0,75 để không bị nền màu che/mờ (user chốt). pointer-events
  none — không cản chạm bản đồ. reduced-motion do CHỖ GỌI quyết (field=null).

  Hiệu năng mobile: số hạt theo diện tích (~600–2000), một ctx.stroke()/frame.
  Kéo/zoom → xoá vệt (không smear). Đổi mốc giờ → effect chạy lại, gieo mới.

  BẪY ĐÃ DÍNH (2026-07-29): react-map-gl gán ref ASYNC — effect chạy lúc map
  chưa sẵn mà deps không đổi nữa → kẹt vĩnh viễn (canvas 300×150 trống). Phải
  CHỜ map bằng rAF rồi mới khởi động.
*/

import { useEffect, useRef } from "react";
import type { MapRef } from "react-map-gl/maplibre";
import type maplibregl from "maplibre-gl";
import { sampleUV, stepParticle, type UVField } from "@/lib/particle-field";

export function WindParticles({
  mapRef,
  field,
  variant = "wind",
}: {
  mapRef: React.RefObject<MapRef | null>;
  field: UVField | null;
  /** wind = trắng mảnh trên lớp màu · wave = trắng dày (hướng SÓNG) ·
      ambient = sẫm mảnh cho nền hải đồ/ngư trường SÁNG (chạy mặc định) */
  variant?: "wind" | "wave" | "ambient";
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !field) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const f = field;

    let alive = true;
    let raf = 0;
    let teardown: (() => void) | null = null;

    const start = (map: maplibregl.Map) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);

      const resize = () => {
        const c = map.getContainer();
        canvas.width = Math.max(1, Math.round(c.clientWidth * dpr));
        canvas.height = Math.max(1, Math.round(c.clientHeight * dpr));
        canvas.style.width = `${c.clientWidth}px`;
        canvas.style.height = `${c.clientHeight}px`;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      };
      resize();

      // vùng gieo hạt = tầm nhìn ∩ hộp lưới (lệch hẳn → rơi về hộp lưới)
      const box = {
        s: f.lat0,
        n: f.lat0 + f.dLat * (f.nLat - 1),
        w: f.lon0,
        e: f.lon0 + f.dLon * (f.nLon - 1),
      };
      type P = { lat: number; lon: number; age: number; px: number; py: number };
      const spawn = (p: P): P => {
        const b = map.getBounds();
        const s = Math.max(b.getSouth(), box.s);
        const n = Math.min(b.getNorth(), box.n);
        const w = Math.max(b.getWest(), box.w);
        const e = Math.min(b.getEast(), box.e);
        const ok = s < n && w < e;
        p.lat = (ok ? s : box.s) + Math.random() * ((ok ? n : box.n) - (ok ? s : box.s));
        p.lon = (ok ? w : box.w) + Math.random() * ((ok ? e : box.e) - (ok ? w : box.w));
        p.age = 40 + Math.random() * 120; // vòng đời so le — khỏi nháy đồng loạt
        const pt = map.project([p.lon, p.lat]);
        p.px = pt.x * dpr;
        p.py = pt.y * dpr;
        if (!sampleUV(f, p.lat, p.lon)) p.age = 0; // ô thiếu → respawn frame sau
        return p;
      };

      // mật độ: 1 hạt / ~900px² CSS, trần [600, 2000] (cỡ Windy mobile)
      const cssArea = (canvas.width * canvas.height) / (dpr * dpr);
      const N = Math.max(600, Math.min(2000, Math.round(cssArea / 900)));
      const ps: P[] = Array.from({ length: N }, () =>
        spawn({ lat: 0, lon: 0, age: 0, px: 0, py: 0 }),
      );

      const clearTrails = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
      map.on("move", clearTrails);
      map.on("resize", resize);

      const frame = () => {
        if (!alive) return;
        // mờ dần vệt cũ — đuôi hạt kiểu Windy
        ctx.globalCompositeOperation = "destination-in";
        ctx.fillStyle = "rgba(0,0,0,0.93)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = "source-over";
        // gió: vệt trắng mảnh · sóng: vệt trắng DÀY (trôi chậm sẵn vì tốc lấy
        // từ độ cao sóng — hướng đã khác nhau) · ambient: vệt SẪM dịu trên nền
        // hải đồ sáng (chạy nền ở mọi chế độ)
        ctx.strokeStyle =
          variant === "wave"
            ? "rgba(255,255,255,0.6)"
            : variant === "ambient"
              ? "rgba(30,60,95,0.45)"
              : "rgba(255,255,255,0.75)";
        ctx.lineWidth = (variant === "wave" ? 2.4 : 1.4) * dpr;
        ctx.lineCap = "round";
        ctx.beginPath();
        for (const p of ps) {
          p.age -= 1;
          const next = p.age > 0 ? stepParticle(f, p.lat, p.lon, 1 / 60) : null;
          if (!next) {
            spawn(p);
            continue;
          }
          const pt = map.project([next[1], next[0]]);
          const nx = pt.x * dpr;
          const ny = pt.y * dpr;
          // bước nhảy bất thường (project vòng thế giới) → gieo lại
          if (Math.abs(nx - p.px) > 40 * dpr || Math.abs(ny - p.py) > 40 * dpr) {
            spawn(p);
            continue;
          }
          ctx.moveTo(p.px, p.py);
          ctx.lineTo(nx, ny);
          p.lat = next[0];
          p.lon = next[1];
          p.px = nx;
          p.py = ny;
        }
        ctx.stroke();
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);

      teardown = () => {
        map.off("move", clearTrails);
        map.off("resize", resize);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      };
    };

    // chờ ref map sẵn (async) rồi khởi động
    const boot = () => {
      if (!alive) return;
      const map = mapRef.current?.getMap();
      if (map) start(map);
      else raf = requestAnimationFrame(boot);
    };
    boot();

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      teardown?.();
    };
  }, [mapRef, field, variant]);

  if (!field) return null;
  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 z-10"
      aria-hidden
    />
  );
}
