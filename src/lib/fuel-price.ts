// Giá dầu DO LIVE — hiện ở bảng giá /tien (dầu là chi phí lớn nhất mỗi chuyến).
// Nguồn: giaxanghomnay.com (scrape Petrolimex hộ, JSON sạch không key). Theo
// kỳ điều hành giá (thường thứ Năm). DO 0,05S là dầu tàu cá dùng phổ biến.
// Nguồn fail → null, UI ẩn (không bịa giá).

import { apiUrl } from "@/lib/api-base";
import { loadForecast, saveForecast } from "@/lib/forecast-cache";
import { forecastStoreReady } from "@/lib/forecast-store";
import { timeoutSignal } from "@/lib/abort";

export interface FuelPrice {
  /** đồng/lít, vùng 1 (gần kho) */
  do005Zone1: number;
  /** đồng/lít, vùng 2 (xa kho, cao hơn) */
  do005Zone2: number;
  /** ngày áp dụng YYYY-MM-DD */
  date: string;
}

interface FuelRow {
  title?: unknown;
  zone1_price?: unknown;
  zone2_price?: unknown;
  date?: unknown;
}

/** Tách giá DO 0,05S từ JSON giaxanghomnay (mảng lồng mảng). null nếu không thấy. */
export function parseDieselDo(json: unknown): FuelPrice | null {
  const flat: FuelRow[] = Array.isArray(json)
    ? (json.flat(2) as FuelRow[])
    : [];
  const norm = (s: string) => s.replace(/\s/g, "").toUpperCase();
  const row = flat.find(
    (x) =>
      x &&
      typeof x.title === "string" &&
      norm(x.title).startsWith("DO0,05S"),
  );
  if (!row) return null;
  const z1 = Number(row.zone1_price);
  const z2 = Number(row.zone2_price);
  if (!Number.isFinite(z1) || z1 <= 0) return null;
  return {
    do005Zone1: z1,
    do005Zone2: Number.isFinite(z2) && z2 > 0 ? z2 : z1,
    date: typeof row.date === "string" ? row.date.slice(0, 10) : "",
  };
}

/** Kho giá dầu trong máy — `forfish.fc.price.fuel` */
export const PRICE_NS = "price";
const FUEL_ID = "fuel";

/**
 * Lấy được thì LƯU VÀO MÁY; không lấy được thì trả bản đã lưu (2026-08-01).
 * Giá dầu điều hành theo KỲ (thứ Năm) nên bản cũ vẫn dùng được — UI in kèm
 * NGÀY của kỳ giá (price-board.tsx) nên không ai nhầm là giá hôm nay. Trước đây
 * giá chỉ sống trong kho service worker, không vào tệp sao lưu, không ai kiểm.
 */
export async function fetchFuelPrice(): Promise<FuelPrice | null> {
  /*  CHỜ KHO MỞ XONG RỒI MỚI ĐỌC BẢN LƯU (2026-08-02k — vòng đánh giá cuối).
      Mất sóng thì `fetch` hỏng TỨC THÌ (không có độ trễ mạng che cửa sổ đua),
      nên nhánh lùi chạy khi gương còn rỗng ⇒ trả `null` ⇒ màn hình nói "chưa
      có" trong khi kho còn nguyên. Từ phiên thứ hai localStorage đã bị dọn nên
      không còn lớp chắn nào. Hàm đã async; `forecastStoreReady()` có trần chờ. */
  await forecastStoreReady();

  try {
    const r = await fetch(apiUrl("/api/fuel-price"), {
      signal: timeoutSignal(15000),
    });
    if (r.ok) {
      const j = (await r.json()) as { ok: boolean; fuel?: FuelPrice };
      if (j.ok && j.fuel) {
        saveForecast(PRICE_NS, FUEL_ID, j.fuel);
        return j.fuel;
      }
    }
  } catch {
    /* mất sóng → xuống nhánh bản lưu */
  }
  return loadForecast<FuelPrice>(PRICE_NS, FUEL_ID)?.data ?? null;
}
