"use client";

import { useEffect, useMemo, useState } from "react";
import { PORT_PRICES, PRICE_DATE, PortPrice } from "@/data/port-prices";
import {
  fetchLivePrices,
  type LivePortPrice,
  type LivePriceResult,
} from "@/lib/port-price-source";
import { fetchFuelPrice, type FuelPrice } from "@/lib/fuel-price";
import {
  ChevronRightIcon,
  MinusIcon,
  SearchIcon,
  TrendDownIcon,
  TrendUpIcon,
} from "@/components/icons";
import { SQ_BTN } from "@/components/ui/sq-btn";
import { formatVnDate } from "@/lib/format";
import { savedAgoLabel } from "@/lib/forecast-cache";
import { PriceHistorySheet } from "@/components/price-history-sheet";
import {
  fetchPriceHistory,
  seriesForSpecies,
  type PriceHistoryResult,
} from "@/lib/port-price-history";

/*
  Bảng giá — giá nguyên liệu tại bến TUẦN từ VASEP (live, fallback bảng tĩnh
  khi nguồn fail). Giá dầu DO hôm nay từ Petrolimex. Trend luôn icon + chữ.
*/

// "cá hố" -> "ca ho": diacritic-insensitive matching for careless typing.
function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

function formatRange(p: PortPrice): string {
  return `${p.minVnd.toLocaleString("vi-VN")} – ${p.maxVnd.toLocaleString("vi-VN")} ${p.unit}`;
}

const TREND = {
  up: { Icon: TrendUpIcon, word: "đang lên", color: "var(--ok)" },
  down: { Icon: TrendDownIcon, word: "đang xuống", color: "var(--danger)" },
  flat: { Icon: MinusIcon, word: "đứng giá", color: "var(--foreground)" },
} as const;

const STATIC_RESULT: LivePriceResult = {
  ok: false,
  source: "static",
  prices: PORT_PRICES.map((p) => ({ ...p, live: false })),
};

export function PriceBoard() {
  const [query, setQuery] = useState("");
  // mặc định bảng tĩnh; thay bằng giá tuần khi tải xong (async → không lint effect)
  const [result, setResult] = useState<LivePriceResult>(STATIC_RESULT);
  /** giá dầu: `undefined` = đang hỏi, `null` = không lấy được (nói ra, đừng biến mất) */
  const [fuel, setFuel] = useState<FuelPrice | null | undefined>(undefined);
  // biểu đồ lịch sử: mở theo id loài; lịch sử tải LƯỜI (1 lần, khi chạm thẻ đầu)
  const [openId, setOpenId] = useState<string | null>(null);
  const [history, setHistory] = useState<PriceHistoryResult | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  /** lần tải lịch sử gần nhất hỏng (mất sóng / máy chủ) — KHÔNG kẹt cả phiên,
   *  mở sheet lần sau là hỏi lại (audit 2026-08-18 G3) */
  const [historyFailed, setHistoryFailed] = useState(false);

  function openChart(id: string) {
    setOpenId(id);
    if (!history && !historyLoading) {
      setHistoryLoading(true);
      setHistoryFailed(false);
      fetchPriceHistory()
        .then((h) => {
          /*  CHỈ GIỮ KẾT QUẢ TỐT (audit G3): bản cũ `setHistory(h)` kể cả
              `ok:false` ⇒ mở sheet lần sau `!history` sai ⇒ không hỏi lại ⇒ mất
              sóng lúc chạm thẻ đầu là biểu đồ "chưa có" suốt phiên dù sóng đã về. */
          if (h.ok) setHistory(h);
          else setHistoryFailed(true);
        })
        .finally(() => setHistoryLoading(false));
    }
  }

  /*  TẢI LÚC MỞ + TẢI LẠI KHI SÓNG VỀ (audit 2026-08-18 G3 — khuôn từ
      market-board.tsx). Trước đây fetch đúng một lần lúc mount: vào màn lúc mất
      sóng là đứng ở bảng tĩnh ngày build suốt phiên, không một câu nào. Cả hai
      hàm đều có đồng hồ 15s + catch; mất sóng trả bản lưu / tĩnh, không treo. */
  useEffect(() => {
    let alive = true;
    let dangTai = false;
    const tai = () => {
      if (dangTai) return; // chống chạy chồng lúc sóng nhấp nháy ven bờ
      dangTai = true;
      Promise.all([
        fetchLivePrices().then((r) => {
          if (alive) setResult(r);
        }),
        fetchFuelPrice().then((f) => {
          if (alive) setFuel(f);
        }),
      ]).finally(() => {
        dangTai = false;
      });
    };
    tai();
    window.addEventListener("online", tai);
    return () => {
      alive = false;
      window.removeEventListener("online", tai);
    };
  }, []);

  const shown = useMemo(() => {
    const q = fold(query.trim());
    if (!q) return result.prices;
    return result.prices.filter((p) => fold(p.species).includes(q));
  }, [query, result]);

  const isLive = result.source === "vasep";

  return (
    <div>
      {/* giá dầu DO hôm nay — chi phí lớn nhất chuyến biển. Không lấy được thì
          NÓI một dòng nhỏ chứ không biến mất im (audit 2026-08-18 G3). */}
      {fuel === null && (
        <p className="mb-3 px-1 text-[0.9375rem] font-semibold text-foreground/65">
          Chưa lấy được giá dầu hôm nay.
        </p>
      )}
      {fuel && (
        <div className="mb-3 surface px-4 py-3">
          <p className="text-[0.875rem] font-semibold text-foreground/70">
            Dầu DO hôm nay (Petrolimex)
            {fuel.date ? ` · ${formatVnDate(fuel.date)}` : ""}
          </p>
          {/* bỏ jargon "vùng 1/vùng 2" của Petrolimex — nói tiếng người */}
          <p className="mt-0.5 text-[1.125rem] font-bold text-foreground">
            {fuel.do005Zone1.toLocaleString("vi-VN")} đ/lít
            <span className="text-[0.9375rem] font-semibold text-foreground/70">
              {" "}
              (gần kho) · {fuel.do005Zone2.toLocaleString("vi-VN")} đ/lít (xa
              kho, đảo)
            </span>
          </p>
        </div>
      )}

      {/* nguồn + tuần — trung thực: live thì ghi VASEP (kèm "bản lưu" nếu đang
          đọc từ máy), không thì bảng tĩnh; MẤT SÓNG mà chưa có bản lưu → nói
          thẳng là chưa tải được, đừng để bảng tĩnh đội lốt giá tuần (audit G3). */}
      {isLive ? (
        <p className="mb-3 rounded-xl bg-field px-3 py-2 text-[0.875rem] font-semibold text-foreground/70">
          Giá nguyên liệu tại bến <b>{result.province}</b>, tuần{" "}
          <b>{result.week}</b> · Nguồn: VASEP
          {result.savedAt != null
            ? ` · bản lưu trong máy (${savedAgoLabel(result.savedAt)})`
            : ""}
          . Giá thật tại cảng có thể khác.
        </p>
      ) : result.netFailed ? (
        <p className="mb-3 rounded-xl bg-warn-bg px-3 py-2 text-[0.9375rem] font-semibold text-warn">
          Chưa tải được giá tuần này — máy đang không có sóng. Bên dưới là giá
          tham khảo tổng hợp ngày {formatVnDate(PRICE_DATE)}; có sóng lại là máy
          tự tải bản mới.
        </p>
      ) : (
        <p className="mb-3 rounded-xl bg-warn-bg px-3 py-2 text-[0.875rem] font-semibold text-warn">
          Giá tham khảo, tổng hợp ngày {formatVnDate(PRICE_DATE)}. Giá thật tại
          cảng có thể khác.
        </p>
      )}

      <label className="relative mb-3 block">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/65" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm loại cá…"
          className="min-h-[3.25rem] w-full rounded-2xl border-0 bg-field pl-12 pr-4 text-[1.125rem] focus:bg-card focus:outline-none focus:ring-2 focus:ring-sea"
        />
      </label>

      {shown.length === 0 && (
        <div className="rounded-[1.25rem] bg-field/70 px-4 py-10 text-center">
          <p className="text-[1.125rem] text-foreground/70">
            Không thấy loại cá này trong bảng.
            <br />
            Bà con thử gõ tên ngắn hơn, ví dụ “nục”.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {shown.map((p) => {
          const t = TREND[p.trend];
          /*  Hàng giá theo khuôn B1: [thân flex-1 min-w-0 — chạm cả hàng vẫn mở
              biểu đồ như cũ] + [ô nút w-16]. Trước đây hàng thiếu ô nút nên mép
              phải không thẳng, mà cuối hàng lại có DÒNG CHỮ "Xem biểu đồ giá ›"
              nhắc lại đúng việc cả hàng đã làm (13 lần trên một trang, ~350px
              chữ thừa) — bỏ chữ, đưa việc vào đúng ô. */
          return (
            <li key={p.id} className="surface flex items-stretch overflow-hidden">
              <button
                type="button"
                onClick={() => openChart(p.id)}
                aria-label={`Xem biểu đồ giá ${p.species}`}
                className="block min-w-0 flex-1 px-4 py-3.5 text-left transition active:scale-[0.99]"
              >
              <div className="flex items-start justify-between gap-3">
                {/*  Badge INLINE trong dòng chữ (không flex items-center): tên cá
                    dài xuống 2 dòng thì badge chạy theo chữ như một cái tag ở
                    cuối tên, KHÔNG trôi ra giữa hai dòng đè lên tên (bug user
                    2026-09-24). min-w-0 flex-1 để nhường chỗ cho cụm xu hướng
                    bên phải. */}
                <p className="display min-w-0 flex-1 text-[1.125rem] font-bold leading-snug text-navy">
                  {p.species}
                  {isLive && (
                    <span
                      className={`ml-1.5 inline-block whitespace-nowrap rounded-full px-2 py-0.5 align-[0.08em] text-[0.75rem] ${
                        (p as LivePortPrice).live
                          ? "bg-ok-bg font-bold text-ok"
                          : "bg-field font-semibold text-foreground/65"
                      }`}
                    >
                      {(p as LivePortPrice).live ? "giá tuần" : "tham khảo"}
                    </span>
                  )}
                </p>
                {/*  Bỏ style ghi đè rgba cứng (E1): TREND.flat đã khai
                    color: "var(--foreground)" sẵn — ghi đè bằng rgba là màu
                    ngoài token, không đổi theo theme. */}
                <p
                  className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[0.9375rem] font-bold"
                  style={{ color: t.color }}
                >
                  <t.Icon className="h-5 w-5" />
                  {t.word}
                </p>
              </div>
              <p className="mt-0.5 text-[1.125rem] font-bold text-foreground tabular-nums">
                {formatRange(p)}
              </p>
              {(p.region || p.note) && (
                <p className="mt-1 text-[0.875rem] leading-snug text-foreground/70">
                  {[p.region, p.note].filter(Boolean).join(" · ")}
                </p>
              )}
              </button>
              {/*  Ô nút là AFFORDANCE NHÌN cho ngón tay; nút thân hàng ở trên đã
                  mang aria-label đầy đủ nên ô này ẩn khỏi trình đọc màn hình để
                  khỏi đọc hai lần cùng một việc. */}
              <button
                type="button"
                tabIndex={-1}
                aria-hidden
                onClick={() => openChart(p.id)}
                className={`${SQ_BTN} self-center text-sea`}
              >
                <ChevronRightIcon className="h-6 w-6" />
                Biểu đồ
              </button>
            </li>
          );
        })}
      </ul>

      {openId && (
        <PriceHistorySheet
          species={
            result.prices.find((p) => p.id === openId)?.species ?? "cá"
          }
          unit={result.prices.find((p) => p.id === openId)?.unit ?? "đ/kg"}
          points={history ? seriesForSpecies(history.weeks, openId) : []}
          loading={historyLoading && !history}
          failed={!history && !historyLoading && historyFailed}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
