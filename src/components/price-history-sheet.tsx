"use client";

/*
  Biểu đồ giá cá lịch sử (kiểu chứng khoán) cho MỘT loài. Mở khi chạm 1 dòng ở
  Bảng giá. Mỗi điểm = 1 TUẦN bản tin VASEP (Khánh Hòa) — GIÁ THẬT, không nội
  suy. Vẽ DẢI giá (thấp nhất–cao nhất) + đường giữa; trục thời gian ngày/tháng,
  trục giá theo nghìn đồng/kg. Thiếu lịch sử → báo thật, KHÔNG vẽ đường ma.

  Chữ to, dải màu rõ cho bà con: dải xanh biển, số tuần mới nhất in đậm, mũi tên
  xu hướng so với đầu kỳ.
*/

import { BottomSheet } from "@/components/ui/bottom-sheet";
import type { PricePoint } from "@/lib/port-price-history";
import { MinusIcon, TrendDownIcon, TrendUpIcon } from "@/components/icons";

/** dd/mm gọn cho nhãn trục (ISO yyyy-mm-dd). */
function ddmm(iso: string): string {
  const [, m, d] = iso.split("-");
  return d && m ? `${d}/${m}` : iso;
}

/** đồng → "nghìn" tròn cho nhãn trục giá. */
function toK(vnd: number): number {
  return Math.round(vnd / 1000);
}

// khung toạ độ SVG (đơn vị người dùng; SVG co giãn theo bề ngang)
const W = 360;
const H = 208;
const PAD = { left: 40, right: 14, top: 14, bottom: 30 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

function Chart({ points }: { points: PricePoint[] }) {
  const n = points.length;
  const mins = points.map((p) => p.minVnd);
  const maxes = points.map((p) => p.maxVnd);
  const mids = points.map((p) => (p.minVnd + p.maxVnd) / 2);

  let lo = Math.min(...mins);
  let hi = Math.max(...maxes);
  if (hi === lo) {
    // mọi tuần bằng giá → nới ±10% để có chiều cao vẽ
    lo *= 0.9;
    hi *= 1.1;
  }
  const padV = (hi - lo) * 0.12;
  lo -= padV;
  hi += padV;

  const x = (i: number) =>
    PAD.left + (n > 1 ? (i * PLOT_W) / (n - 1) : PLOT_W / 2);
  const y = (v: number) =>
    PAD.top + (1 - (v - lo) / (hi - lo)) * PLOT_H;

  // dải giá: mép trên (max) trái→phải, rồi mép dưới (min) phải→trái, khép kín
  const topEdge = points.map((p, i) => `${x(i)},${y(p.maxVnd)}`);
  const botEdge = points.map((p, i) => `${x(i)},${y(p.minVnd)}`).reverse();
  const bandPath = `M${topEdge.join("L")}L${botEdge.join("L")}Z`;
  const midLine = mids.map((v, i) => `${x(i)},${y(v)}`).join(" ");

  // 3 mốc giá trục Y (nghìn)
  const yTicks = [lo + padV, (lo + hi) / 2, hi - padV];
  // tối đa 4 nhãn ngày trục X, chia đều
  const xIdx = Array.from(
    new Set(
      n <= 4
        ? points.map((_, i) => i)
        : [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1],
    ),
  );

  const first = mids[0];
  const last = mids[n - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-auto w-full"
      role="img"
      aria-label={`Biểu đồ giá ${n} tuần, mới nhất ${toK(points[n - 1].minVnd)}–${toK(points[n - 1].maxVnd)} nghìn đồng mỗi ký`}
    >
      {/* lưới + nhãn giá trục Y */}
      {yTicks.map((v, i) => (
        <g key={i}>
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(v)}
            y2={y(v)}
            stroke="var(--line)"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 6}
            y={y(v) + 4}
            textAnchor="end"
            className="fill-foreground/60"
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            {toK(v).toLocaleString("vi-VN")}
          </text>
        </g>
      ))}

      {/* dải giá thấp–cao */}
      <path d={bandPath} fill="var(--sea)" fillOpacity={0.16} />
      {/* đường giá giữa */}
      <polyline
        points={midLine}
        fill="none"
        stroke="var(--sea)"
        strokeWidth={2.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* chấm từng tuần; tuần mới nhất to hơn */}
      {mids.map((v, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(v)}
          r={i === n - 1 ? 5 : 3}
          fill={i === n - 1 ? "var(--navy)" : "var(--sea)"}
        />
      ))}

      {/* nhãn ngày trục X */}
      {xIdx.map((i) => (
        <text
          key={i}
          x={x(i)}
          y={H - 8}
          textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
          className="fill-foreground/60"
          style={{ fontSize: 12, fontWeight: 600 }}
        >
          {ddmm(points[i].date)}
        </text>
      ))}
      {/* điểm đầu mờ để mắt bắt được điểm xuất phát khi so xu hướng */}
      <circle cx={x(0)} cy={y(first)} r={3} fill="var(--sea)" opacity={last === first ? 1 : 0.7} />
    </svg>
  );
}

export function PriceHistorySheet({
  species,
  unit,
  points,
  loading,
  onClose,
}: {
  species: string;
  unit: string;
  points: PricePoint[];
  loading: boolean;
  onClose: () => void;
}) {
  const n = points.length;
  const hasChart = !loading && n >= 2;

  // tóm tắt xu hướng: giữa kỳ mới so đầu kỳ
  let trend: { Icon: typeof MinusIcon; word: string; color: string } | null =
    null;
  let latest: PricePoint | null = null;
  if (hasChart) {
    latest = points[n - 1];
    const first = (points[0].minVnd + points[0].maxVnd) / 2;
    const last = (latest.minVnd + latest.maxVnd) / 2;
    const diff = (last - first) / first;
    if (diff > 0.03)
      trend = { Icon: TrendUpIcon, word: "cao hơn đầu kỳ", color: "var(--ok)" };
    else if (diff < -0.03)
      trend = {
        Icon: TrendDownIcon,
        word: "thấp hơn đầu kỳ",
        color: "var(--danger)",
      };
    else
      trend = {
        Icon: MinusIcon,
        word: "gần như đi ngang",
        color: "rgba(28,43,54,0.55)",
      };
  }

  return (
    <BottomSheet title={`Giá ${species}`} onClose={onClose}>
      {loading && (
        <div className="rounded-2xl bg-field/70 px-4 py-10 text-center">
          <p className="text-[1.125rem] text-foreground/70">
            Đang tải lịch sử giá…
          </p>
        </div>
      )}

      {!loading && n < 2 && (
        <div className="rounded-2xl bg-warn-bg px-4 py-8 text-center">
          <p className="text-[1.125rem] font-semibold text-warn">
            Chưa lấy được lịch sử giá cho loại này.
          </p>
          <p className="mt-1 text-[1rem] text-foreground/70">
            VASEP có tuần không đăng giá loại này. Bà con xem lại sau nhé.
          </p>
        </div>
      )}

      {hasChart && latest && (
        <>
          {/* tuần mới nhất — số to */}
          <div className="mb-3 surface px-4 py-3">
            <p className="text-[0.9375rem] font-semibold text-foreground/70">
              Tuần mới nhất · {ddmm(latest.date)}
            </p>
            <p className="mt-0.5 text-[1.375rem] font-bold text-foreground tabular-nums">
              {latest.minVnd.toLocaleString("vi-VN")} –{" "}
              {latest.maxVnd.toLocaleString("vi-VN")} {unit}
            </p>
            {trend && (
              <p
                className="mt-1 flex items-center gap-1.5 text-[1rem] font-bold"
                style={{ color: trend.color }}
              >
                <trend.Icon className="h-5 w-5" />
                {trend.word} ({n} tuần)
              </p>
            )}
          </div>

          <p className="mb-1 text-[0.9375rem] font-semibold text-foreground/70">
            Giá tại bến theo tuần (nghìn đồng/kg)
          </p>
          <div className="rounded-2xl bg-card p-2 ring-1 ring-line">
            <Chart points={points} />
          </div>
          <p className="mt-1 text-[0.8125rem] leading-snug text-foreground/60">
            Dải xanh là khoảng giá thấp–cao mỗi tuần; đường đậm là mức giữa.
          </p>

          {/* nguồn — trung thực, không hứa chính xác */}
          <p className="mt-3 rounded-xl bg-field px-3 py-2 text-[0.8125rem] leading-snug text-foreground/70">
            Nguồn: bản tin giá nguyên liệu hằng tuần của VASEP (Khánh Hòa). Giá
            tham khảo, giá thật tại cảng có thể khác.
          </p>
        </>
      )}

      <button
        type="button"
        onClick={onClose}
        className="mt-4 min-h-[3.5rem] w-full rounded-xl bg-navy text-[1.125rem] font-bold text-white transition active:scale-[0.99]"
      >
        Xong
      </button>
    </BottomSheet>
  );
}
