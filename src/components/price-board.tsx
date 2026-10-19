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
  up: { Icon: TrendUpIcon, word: "đang tăng", color: "var(--ok)" },
  down: { Icon: TrendDownIcon, word: "đang giảm", color: "var(--danger)" },
  flat: { Icon: MinusIcon, word: "bình ổn", color: "var(--foreground)" },
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

  /*  BỐ CỤC THEO RÀ DESIGN CODEX LẦN 2 (2026-10-19): ô tìm → MỘT dòng nguồn/tuần
      → MỘT danh sách kẻ mảnh (tên trái, giá + xu hướng phải, nơi/ghi chú dưới;
      chạm cả hàng mở biểu đồ, chevron nhỏ thay ô "Biểu đồ") → giá dầu thành hàng
      phụ cuối bảng. Trước: thẻ dầu + dải nguồn + ô tìm chiếm nửa màn đầu, rồi mỗi
      loài một hộp riêng cách 12px — dữ liệu dạng bảng thành chồng hộp. Giá giữ
      navy (đọc số), xu hướng là chữ nhỏ có màu, không đậm cả hàng. */
  return (
    <div>
      <label className="relative mb-2 block">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground/55" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm loại cá…"
          className="h-(--h-ctl) w-full rounded-xl border border-line bg-card pl-11 pr-4 text-[1rem] focus:outline-none focus:ring-2 focus:ring-sea"
        />
      </label>

      {/* nguồn + tuần — trung thực: live thì ghi VASEP (kèm "bản lưu" nếu đang
          đọc từ máy), không thì bảng tĩnh; MẤT SÓNG mà chưa có bản lưu → nói
          thẳng là chưa tải được, đừng để bảng tĩnh đội lốt giá tuần (audit G3).
          Lúc bình thường là MỘT dòng chữ phụ, không hộp; cảnh báo mới có nền vàng. */}
      {isLive ? (
        <p className="mb-2 px-1 text-[0.8125rem] leading-snug text-foreground/65">
          Giá tại bến {result.province}, tuần {result.week} · VASEP
          {result.savedAt != null
            ? ` · bản lưu (${savedAgoLabel(result.savedAt)})`
            : ""}
          . Giá thật tại cảng có thể khác.
        </p>
      ) : result.netFailed ? (
        <p className="mb-2 rounded-xl bg-warn-bg px-3 py-2 text-[0.875rem] leading-snug text-warn">
          Chưa tải được giá tuần này — máy đang không có sóng. Bên dưới là giá
          tham khảo ngày {formatVnDate(PRICE_DATE)}; có sóng lại là máy tự tải.
        </p>
      ) : (
        <p className="mb-2 rounded-xl bg-warn-bg px-3 py-2 text-[0.875rem] leading-snug text-warn">
          Giá tham khảo, tổng hợp ngày {formatVnDate(PRICE_DATE)}. Giá thật tại
          cảng có thể khác.
        </p>
      )}

      {shown.length === 0 && (
        <div className="rounded-xl border border-line px-4 py-8 text-center">
          <p className="text-[1rem] text-foreground/70">
            Không thấy loại cá này trong bảng.
            <br />
            Bà con thử gõ tên ngắn hơn, ví dụ “nục”.
          </p>
        </div>
      )}

      {shown.length > 0 && (
        <ul className="surface divide-y divide-line overflow-hidden">
          {shown.map((p) => {
            const t = TREND[p.trend];
            const tham = isLive && !(p as LivePortPrice).live;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => openChart(p.id)}
                  aria-label={`Xem biểu đồ giá ${p.species}`}
                  className="flex min-h-(--h-row) w-full items-center gap-3 px-4 py-3 text-left transition active:bg-field"
                >
                  {/*  Ba dòng trong MỘT cột (đo 360px: để giá sang cột phải thì
                      tên cá bị ép 3–4 dòng): tên + xu hướng nhỏ bên phải · giá ·
                      nơi/ghi chú. */}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="min-w-0 flex-1 text-[1rem] font-semibold leading-snug text-navy">
                        {p.species}
                      </span>
                      {/*  Bỏ style ghi đè rgba cứng (E1): TREND.flat đã khai
                          color: "var(--foreground)" sẵn. */}
                      <span
                        className="inline-flex shrink-0 items-center gap-1 text-[0.8125rem]"
                        style={{ color: t.color }}
                      >
                        <t.Icon className="h-4 w-4" />
                        {t.word}
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[0.9375rem] font-semibold tabular-nums text-foreground">
                      {formatRange(p)}
                    </span>
                    {(p.region || p.note || tham) && (
                      <span className="mt-0.5 block text-[0.8125rem] leading-snug text-foreground/65">
                        {[tham ? "tham khảo" : null, p.region, p.note]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    )}
                  </span>
                  <ChevronRightIcon className="h-4 w-4 shrink-0 text-foreground/35" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* giá dầu DO hôm nay — HÀNG PHỤ cuối bảng (Codex: không chiếm thẻ đầu
          màn). Không lấy được thì NÓI một dòng chứ không biến mất im (G3). */}
      {fuel === null && (
        <p className="mt-3 px-1 text-[0.8125rem] text-foreground/65">
          Chưa lấy được giá dầu hôm nay.
        </p>
      )}
      {fuel && (
        <p className="mt-3 px-1 text-[0.8125rem] leading-snug text-foreground/65">
          {/* bỏ jargon "vùng 1/vùng 2" của Petrolimex — nói tiếng người */}
          Dầu DO hôm nay
          {fuel.date ? ` (${formatVnDate(fuel.date)})` : ""}:{" "}
          <span className="font-semibold text-navy">
            {fuel.do005Zone1.toLocaleString("vi-VN")} đ/lít
          </span>{" "}
          gần kho · {fuel.do005Zone2.toLocaleString("vi-VN")} đ/lít xa kho, đảo ·
          Petrolimex
        </p>
      )}

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
