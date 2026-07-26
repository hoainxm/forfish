"use client";

import { useCallback, useEffect, useState } from "react";
import { PORTS, type FishingPort } from "@/data/ports";
import {
  fetchSeaForecast,
  LEVEL_LABEL,
  type ScoredSeaDay,
  type SeaLevel,
} from "@/lib/sea";
import { fetchEnsembleUncertainty } from "@/lib/forecast-ensemble";
import {
  assessForecast,
  applyBiasCorrection,
  type DayQuality,
} from "@/lib/forecast-quality";
import { loadForecastSkill } from "@/lib/forecast-skill";
import { isoDateVN } from "@/lib/day-labels";
import { weatherFromCode } from "@/lib/weather-codes";
import { FREE_FORECAST_DAYS } from "@/lib/tier";
import { useFeatureAccess } from "@/lib/use-tier";
import { PremiumLock } from "@/components/premium-gate";
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

// Bảng skill backtest nạp 1 lần (offline, không gọi mạng) — nắn bias điểm số
// + gán độ tin trung thực theo tầm ngày.
const SKILL = loadForecastSkill();

export function SeaForecast() {
  // Phân hạng (2026-07-26): miễn phí đúng 3 ngày (hôm nay + 2 ngày kế);
  // ngày 4 trở đi là premium. Đang "checking" thì chỉ hiện phần miễn phí,
  // KHÔNG hiện thẻ khoá (tránh nháy khoá↔mở).
  const { access } = useFeatureAccess();
  const [port, setPort] = useState<FishingPort | null>(null);
  const [days, setDays] = useState<ScoredSeaDay[] | null>(null);
  const [quality, setQuality] = useState<DayQuality[] | null>(null);
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
    setQuality(null);
    // Tầm ngày tính từ HÔM NAY tới ngày dự báo (không theo vị trí mảng) — nếu
    // sau này dãy ngày đến từ bản lưu trong máy thì độ tin vẫn đúng.
    const todayIso = isoDateVN();
    fetchSeaForecast(p)
      .then((raw) => {
        // Nắn bias thô theo backtest rồi mới hiển thị điểm số.
        const corrected = applyBiasCorrection(raw, SKILL, todayIso);
        setDays(corrected);
        // Độ tin: ngay lập tức từ horizon+skill; tinh chỉnh khi ensemble về.
        setQuality(assessForecast(corrected, null, SKILL, todayIso));
        fetchEnsembleUncertainty(p.lat, p.lon, corrected.length)
          .then((ens) => {
            if (ens) setQuality(assessForecast(corrected, ens, SKILL, todayIso));
          })
          .catch(() => {
            /* ensemble lỗi thì giữ độ tin horizon+skill — không sao */
          });
      })
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
  const todayQ = quality?.[0];

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
              {todayQ && (
                <p
                  className={`mt-1 text-[0.9375rem] font-semibold ${
                    todayQ.conf.tone === "ok" ? "text-ok" : "text-warn"
                  }`}
                >
                  {todayQ.conf.label}
                </p>
              )}
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
              {(access === "open"
                ? days.slice(1)
                : days.slice(1, FREE_FORECAST_DAYS)
              ).map((d, k) => {
                const w = weatherFromCode(d.wmoCode);
                const q = quality?.[k + 1];
                return (
                  <li
                    key={d.date}
                    className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0"
                  >
                    <span
                      aria-hidden
                      className="shrink-0 text-[0.75rem] leading-none"
                      style={{ color: confColor(q) }}
                      title={q ? confWord(q.confidence) : undefined}
                    >
                      ●
                    </span>
                    <span className="w-[80px] shrink-0 text-[1rem] font-semibold capitalize">
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
                      sóng {d.waveMaxM.toFixed(1)} m
                      {d.waveEstimated && (
                        <span className="text-foreground/45"> (ước)</span>
                      )}{" "}
                      · gió {Math.round(d.windMaxKmh)} km/h
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
            {/* ngày 4 trở đi là premium — thẻ khoá thay cho danh sách bị cắt */}
            <div className="mt-3">
              <PremiumLock
                access={access}
                feature={`dự báo ${days.length} ngày`}
                blurb={
                  access === "login"
                    ? "Đăng nhập bằng tài khoản nâng cao để xem cả nửa tháng tới — tính chuyến dài ngày dễ hơn."
                    : "Tài khoản của bà con đang là hạng thường — gọi SDVICO nâng cấp để xem cả nửa tháng tới."
                }
              />
            </div>
          </section>
        </>
      )}

      <p className="mt-4 rounded-xl bg-t1-bg px-3 py-2.5 text-[0.875rem] font-semibold leading-snug text-t1">
        {/* đừng hứa "16 ngày" với người đang bị khoá còn 3 ngày */}
        {access === "open" ? "Dự báo 16 ngày" : "Dự báo"} từ mô hình thời tiết
        quốc tế, chỉ để tham khảo — chấm màu là độ tin (xanh: khá chắc · cam:
        vừa · đỏ: kém chắc, xem lại sát ngày). Ngày càng xa càng kém chắc.
        Trước khi ra khơi, bà con nghe thêm thông báo của đài duyên hải và Bộ
        đội Biên phòng.
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

/** Màu chấm độ tin: cao = xanh, vừa = cam, thấp = đỏ; xám khi chưa có số. */
function confColor(q?: DayQuality): string {
  if (!q) return "var(--line)";
  if (q.confidence >= 0.66) return "var(--ok)";
  if (q.confidence >= 0.45) return "var(--warn)";
  return "var(--danger)";
}

function confWord(c: number): string {
  if (c >= 0.66) return "Độ tin cao";
  if (c >= 0.45) return "Độ tin vừa";
  return "Độ tin thấp — xem lại sát ngày";
}
