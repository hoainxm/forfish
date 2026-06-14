"use client";

import { useCallback, useEffect, useState } from "react";
import { PORTS, type FishingPort } from "@/data/ports";
import {
  fetchSeaForecast,
  LEVEL_LABEL,
  type ScoredSeaDay,
  type SeaLevel,
} from "@/lib/sea";
import { weatherFromCode } from "@/lib/weather-codes";
import { AnchorIcon, WavesIcon, WindIcon } from "@/components/icons";

/*
  Dự báo biển — màn hình "mở app là biết hôm nay đi hay ở":
  · chọn cảng một lần, app nhớ
  · điểm hôm nay TO, màu rõ; các ngày tới là dãy gọn để chọn ngày ra khơi
  · dữ liệu thật (Open-Meteo) nhưng luôn kèm lời nhắc nghe đài chính thống
*/

const PORT_KEY = "forfish.port.v1";

const levelColor: Record<SeaLevel, { fg: string; bg: string }> = {
  good: { fg: "var(--ok)", bg: "var(--ok-bg)" },
  caution: { fg: "var(--warn)", bg: "var(--warn-bg)" },
  bad: { fg: "var(--danger)", bg: "var(--danger-bg)" },
};

export function SeaForecast() {
  const [port, setPort] = useState<FishingPort | null>(null);
  const [days, setDays] = useState<ScoredSeaDay[] | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  // Nhớ cảng đã chọn; mặc định Vũng Tàu nếu lần đầu.
  useEffect(() => {
    const saved = window.localStorage.getItem(PORT_KEY);
    const found = PORTS.find((p) => p.id === saved);
    setPort(found ?? PORTS.find((p) => p.id === "vung-tau") ?? PORTS[0]);
  }, []);

  const load = useCallback((p: FishingPort) => {
    setLoading(true);
    setError(false);
    fetchSeaForecast(p)
      .then(setDays)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (port) load(port);
  }, [port, load]);

  function choosePort(id: string) {
    const p = PORTS.find((x) => x.id === id);
    if (!p) return;
    window.localStorage.setItem(PORT_KEY, p.id);
    setPort(p);
  }

  const today = days?.[0];

  return (
    <div className="px-4 pt-1">
      {/* chọn cảng */}
      <label className="mb-4 block">
        <span className="mb-1.5 flex items-center gap-2 text-[1rem] font-bold text-navy">
          <AnchorIcon className="h-5 w-5" />
          Vùng biển gần cảng
        </span>
        <select
          value={port?.id ?? ""}
          onChange={(e) => choosePort(e.target.value)}
          className="min-h-[3.25rem] w-full rounded-2xl border-0 bg-field px-4 text-[1.125rem] font-semibold focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        >
          {PORTS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.province})
            </option>
          ))}
        </select>
      </label>

      {loading && (
        <div className="surface px-4 py-12 text-center text-[1.125rem] text-foreground/65">
          Đang lấy dự báo sóng gió…
        </div>
      )}

      {error && !loading && (
        <div className="surface px-4 py-10 text-center">
          <p className="text-[1.125rem] text-foreground/70">
            Chưa lấy được dự báo. Kiểm tra mạng rồi thử lại.
          </p>
          <button
            onClick={() => port && load(port)}
            className="mt-4 min-h-[3.25rem] rounded-xl bg-sea px-8 text-[1.125rem] font-bold text-white"
          >
            Thử lại
          </button>
        </div>
      )}

      {today && !loading && !error && (
        <>
          {/* điểm hôm nay — to, một màu, một câu */}
          <section
            aria-label="Điểm đi biển hôm nay"
            className="overflow-hidden rounded-xl"
            style={{ backgroundColor: levelColor[today.level].bg }}
          >
            <div className="px-5 pb-4 pt-4 text-center">
              <p className="text-[0.9375rem] font-bold uppercase tracking-wide text-foreground/65">
                Điểm đi biển hôm nay
              </p>
              <p
                className="display text-[4.5rem] font-bold leading-none"
                style={{ color: levelColor[today.level].fg }}
              >
                {today.score}
              </p>
              <p
                className="display mt-1 text-[1.375rem] font-bold"
                style={{ color: levelColor[today.level].fg }}
              >
                {LEVEL_LABEL[today.level]}
              </p>
              {(() => {
                const w = weatherFromCode(today.wmoCode);
                return (
                  w && (
                    <p
                      className={`mt-0.5 text-[1rem] font-bold ${
                        w.danger ? "text-danger" : "text-foreground/70"
                      }`}
                    >
                      {w.label}
                    </p>
                  )
                );
              })()}
            </div>
            <div className="grid grid-cols-2 border-t border-black/5 bg-card">
              <p className="flex min-h-[3.5rem] items-center justify-center gap-2 text-[1rem]">
                <WavesIcon className="h-5 w-5 text-sea" />
                Sóng <strong>{today.waveMaxM.toFixed(1)} m</strong>
              </p>
              <p className="flex min-h-[3.5rem] items-center justify-center gap-2 border-l border-line text-[1rem]">
                <WindIcon className="h-5 w-5 text-sea" />
                Gió <strong>{Math.round(today.windMaxKmh)} km/h</strong>
              </p>
            </div>
          </section>

          {/* các ngày tới */}
          <section aria-label="Những ngày tới" className="mt-5">
            <h2 className="display mb-2 px-1 text-[1.125rem] font-bold text-navy">
              Những ngày tới
            </h2>
            <ul className="overflow-hidden surface">
              {days.slice(1).map((d) => {
                const w = weatherFromCode(d.wmoCode);
                return (
                  <li
                    key={d.date}
                    className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                  >
                    <span className="w-[86px] shrink-0 text-[1rem] font-semibold capitalize">
                      {formatDay(d.date)}
                    </span>
                    <span
                      className="display w-[52px] shrink-0 rounded-xl py-1 text-center text-[1.125rem] font-bold tabular-nums"
                      style={{
                        color: levelColor[d.level].fg,
                        backgroundColor: levelColor[d.level].bg,
                      }}
                    >
                      {d.score}
                    </span>
                    <span className="flex-1 text-right text-[0.9375rem] leading-snug text-foreground/70 tabular-nums">
                      sóng {d.waveMaxM.toFixed(1)} m · gió{" "}
                      {Math.round(d.windMaxKmh)} km/h
                      {w && (
                        <span
                          className={
                            w.danger ? "font-bold text-danger" : undefined
                          }
                        >
                          {" "}
                          · {w.label}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}

      <p className="mt-4 rounded-xl bg-t1-bg px-3 py-2.5 text-[0.875rem] font-semibold leading-snug text-t1">
        Dự báo từ mô hình thời tiết quốc tế, chỉ để tham khảo. Trước khi ra
        khơi, bà con nghe thêm thông báo của đài duyên hải và Bộ đội Biên
        phòng.
      </p>
    </div>
  );
}

function formatDay(iso: string): string {
  const d = new Date(iso + "T00:00:00+07:00");
  return new Intl.DateTimeFormat("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}
