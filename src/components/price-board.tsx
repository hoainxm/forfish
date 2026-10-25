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
  TrendDownIcon,
  TrendUpIcon,
} from "@/components/icons";
import { SearchField } from "@/components/ui/search-field";
import { OfflineLine } from "@/components/ui/offline-line";
import { boDau, ghepTuanHienTai, weekEndIso } from "@/lib/cho-ca";
import { formatVnDate } from "@/lib/format";
import { useOnline } from "@/lib/use-online";
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
  const online = useOnline();
  const [query, setQuery] = useState("");
  // mặc định bảng tĩnh; thay bằng giá tuần khi tải xong (async → không lint effect)
  const [result, setResult] = useState<LivePriceResult>(STATIC_RESULT);
  /** chưa có kết quả tải đầu — vẽ khung chờ thay bảng tĩnh (CC-21: máy chưa có bản
   *  lưu từng thấy bảng 10/06 + băng vàng rồi 1–2 s sau nhảy sang giá tuần) */
  const [dangTaiLanDau, setDangTaiLanDau] = useState(true);
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
    /** lần tải giá gần nhất hỏng — bật lịch thử lại (rà Codex lần 4: câu "máy sẽ
     *  thử lại" phải là thật, không chỉ chờ sự kiện `online`) */
    let hong = false;
    const tai = () => {
      if (dangTai) return; // chống chạy chồng lúc sóng nhấp nháy ven bờ
      dangTai = true;
      Promise.all([
        fetchLivePrices().then((r) => {
          hong = !!r.netFailed;
          if (alive) {
            setResult(r);
            setDangTaiLanDau(false);
          }
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
    // thử lại mỗi phút CHỈ khi lần trước hỏng và máy đang có sóng — mất sóng thì
    // im, đã có giá thì im (không đốt pin/dữ liệu của bà con)
    const hen = window.setInterval(() => {
      if (hong && navigator.onLine) tai();
    }, 60_000);
    return () => {
      alive = false;
      window.clearInterval(hen);
      window.removeEventListener("online", tai);
    };
  }, []);

  const shown = useMemo(() => {
    const q = boDau(query.trim());
    if (!q) return result.prices;
    return result.prices.filter((p) => boDau(p.species).includes(q));
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
      {/* ô tìm chung khu Chợ cá — type=search + × xoá nhanh (CC-16) */}
      <SearchField
        className="mb-2"
        value={query}
        onChange={setQuery}
        placeholder="Tìm loại cá…"
        label="Tìm loại cá"
      />

      {/* nguồn + tuần — trung thực: live thì ghi VASEP (kèm "bản lưu" nếu đang
          đọc từ máy), không thì bảng tĩnh; MẤT SÓNG mà chưa có bản lưu → nói
          thẳng là chưa tải được, đừng để bảng tĩnh đội lốt giá tuần (audit G3).
          Lúc bình thường là MỘT dòng chữ phụ, không hộp; cảnh báo mới có nền vàng. */}
      {dangTaiLanDau ? (
        <p className="mb-2 px-1 text-[0.8125rem] leading-snug text-foreground/65">Đang tải giá tuần…</p>
      ) : isLive ? (
        <p className="mb-2 px-1 text-[0.8125rem] leading-snug text-foreground/65">
          Giá tại bến {result.province}, tuần {result.week} · VASEP
          {result.savedAt != null
            ? ` · bản lưu (${savedAgoLabel(result.savedAt)})`
            : ""}
          . Giá thật tại cảng có thể khác.
        </p>
      ) : result.netFailed ? (
        /*  PHÂN BIỆT MẤT SÓNG ↔ CÓ SÓNG MÀ CHƯA TẢI ĐƯỢC (rà Codex lần 3–4):
            `netFailed` bật cả khi máy chủ trả lỗi HTTP — lúc đó máy VẪN có sóng.
            `onLine=true` không chứng minh nguồn lỗi (có thể sóng yếu), nên câu
            có-sóng chỉ nói điều chắc chắn: chưa tải được + lịch thử lại thật. */
        online ? (
          <p className="mb-2 rounded-xl bg-warn-bg px-3 py-2 text-[0.875rem] leading-snug text-warn">
            Chưa tải được giá tuần này — máy tự thử lại mỗi phút. Bên dưới là giá tham khảo ngày{" "}
            {formatVnDate(PRICE_DATE)}.
          </p>
        ) : (
          /* một câu mất sóng chung toàn app (VO-APP-08) — vế thêm nói bảng đang xem là bản gì */
          <div className="mb-2 overflow-hidden rounded-xl">
            <OfflineLine extra={` · giá tham khảo ngày ${formatVnDate(PRICE_DATE)}`} />
          </div>
        )
      ) : (
        <p className="mb-2 rounded-xl bg-warn-bg px-3 py-2 text-[0.875rem] leading-snug text-warn">
          Giá tham khảo, tổng hợp ngày {formatVnDate(PRICE_DATE)}. Giá thật tại
          cảng có thể khác.
        </p>
      )}

      {/* lần mở đầu: 5 hàng khung chờ cùng khuôn bảng, không nhảy khi giá về (CC-21) */}
      {dangTaiLanDau && (
        <ul aria-busy="true" aria-label="Đang tải bảng giá" className="surface animate-pulse divide-y divide-line overflow-hidden">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="flex min-h-(--h-row) items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1">
                <span className="block h-4 w-2/5 rounded bg-field" />
                <span className="mt-1.5 block h-4 w-3/5 rounded bg-field" />
                <span className="mt-1.5 block h-3 w-1/3 rounded bg-field" />
              </span>
            </li>
          ))}
        </ul>
      )}

      {!dangTaiLanDau && shown.length === 0 && (
        <div className="rounded-xl border border-line px-4 py-8 text-center">
          <p className="text-[1rem] text-foreground/70">
            Không thấy loại cá này trong bảng.
            <br />
            Bà con thử gõ tên ngắn hơn, ví dụ “nục”.
          </p>
        </div>
      )}

      {!dangTaiLanDau && shown.length > 0 && (
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
          /*  GHÉP TUẦN HIỆN TẠI (CC-14): kho lịch sử (cron) có thể dừng ở tuần trước
              trong khi bảng đã là tuần này ⇒ hai "mới nhất" lệch nhau trên cùng màn.
              Chỉ ghép giá LIVE của tuần bảng, và chỉ khi mới hơn điểm cuối. */
          points={
            history
              ? ghepTuanHienTai(
                  seriesForSpecies(history.weeks, openId),
                  (() => {
                    const p = result.prices.find((x) => x.id === openId);
                    return isLive && p?.live
                      ? { date: weekEndIso(result.week), minVnd: p.minVnd, maxVnd: p.maxVnd }
                      : null;
                  })(),
                )
              : []
          }
          loading={historyLoading && !history}
          failed={!history && !historyLoading && historyFailed}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
