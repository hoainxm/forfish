import {
  anomGridUrl,
  bathyGridUrl,
  buildFishForecast,
  chlGridUrl,
  currentGridUrl,
  ERDDAP_UA,
  parseBathyGrid,
  parseErddapGrid,
  slaGridUrl,
  sstGridUrl,
  type CurrentGrids,
  type ScalarGrid,
} from "@/lib/fish-predict";
import { fetchThermoclineGrid } from "@/lib/hycom";

/**
 * Dự báo cá (PFZ) — tính server: kéo lưới SST + phù du mới nhất từ nguồn
 * công khai (chậm, vài MB) rồi chấm điểm bằng lib thuần, trả về gọn cho app.
 * Cache 6 giờ — ảnh nguồn mỗi ngày một bản, không cần tươi hơn.
 * Nguồn fail → { ok:false }, client im lặng/fallback mùa vụ (không bịa).
 *
 * PHÂN QUYỀN kiểu TEASER (user chốt 2026-06-11): API CÔNG KHAI để lớp cá
 * (heatmap + điểm nóng) HIỆN cho mọi người — thu hút. Việc xem CHI TIẾT một
 * điểm (loài gì, khả năng bao nhiêu, đi hướng nào) mới cần đăng nhập, chặn ở
 * CLIENT (fishing-map-view). Trước đây chặn 401 ở API khiến lớp cá biến mất,
 * không hấp dẫn được khách đăng ký.
 */

// Lưới ERDDAP + tính PFZ nặng (14-30s lần lạnh) → KHÔNG để Vercel giết ở 10s
// mặc định (sẽ 504, cá không bao giờ load). Cho hàm tới 60s.
export const maxDuration = 60;
// Cache CẢ response ở tầng route (ISR stale-while-revalidate 6h): lần đầu/6h
// tính 1 lần, các lần sau trả tức thì (kể cả lúc revalidate nền) — user không
// phải chờ lưới chậm nữa. Ảnh nguồn ~ngày/bản nên 6h là đủ tươi.
export const revalidate = 21600;

export async function GET() {
  try {
    // SST + phù du là BẮT BUỘC; SSHA (xoáy), dị thường nhiệt (nước trồi),
    // dòng chảy u/v (hội tụ) là TUỲ CHỌN — fail thì vẫn dự báo, chia lại trọng số
    // Lưới ERDDAP vài MB nên timeout rộng hơn 15s mặc định nhưng PHẢI có (invariant
    // 02 §5): nguồn treo → fail-fast {ok:false} thay vì treo cả serverless function.
    const GRID_TIMEOUT_MS = 20000;
    // NOAA coastwatch ERDDAP CHẶN 403 nếu thiếu User-Agent "thật" (undici/node
    // mặc định bị chặn) — phải gửi UA, không thì lưới không tải được = cá không
    // chạy (chẩn 2026-06-23, trước tưởng do timeout/cache).
    const opt = () => ({
      next: { revalidate: 21600 },
      signal: AbortSignal.timeout(GRID_TIMEOUT_MS),
      headers: { "User-Agent": ERDDAP_UA },
    });
    // tầng nhiệt HYCOM (host khác, OPeNDAP) chạy SONG SONG với các lưới ERDDAP
    const thermoP = fetchThermoclineGrid().catch(() => null);
    const [sstRes, chlRes, slaRes, anomRes, uRes, vRes, bathyRes] =
      await Promise.all([
        fetch(sstGridUrl(), opt()),
        fetch(chlGridUrl(), opt()),
        fetch(slaGridUrl(), opt()).catch(() => null),
        fetch(anomGridUrl(), opt()).catch(() => null),
        fetch(currentGridUrl("u"), opt()).catch(() => null),
        fetch(currentGridUrl("v"), opt()).catch(() => null),
        // độ sâu đáy ETOPO (TĨNH) — chặn loài xa bờ khỏi ô cạn; fail thì bỏ gate
        fetch(bathyGridUrl(), opt()).catch(() => null),
      ]);
    if (!sstRes.ok || !chlRes.ok) return Response.json({ ok: false });

    const sst = parseErddapGrid(await sstRes.json(), {
      hasAltitude: false,
      kelvin: true,
    });
    const chl = parseErddapGrid(await chlRes.json(), { hasAltitude: true });
    if (sst.lats.length === 0 || chl.lats.length === 0) {
      return Response.json({ ok: false });
    }

    const optionalGrid = async (
      res: Response | null,
    ): Promise<ScalarGrid | null> => {
      if (!res?.ok) return null;
      try {
        const g = parseErddapGrid(await res.json(), { hasAltitude: false });
        return g.lats.length > 0 ? g : null;
      } catch {
        return null;
      }
    };
    const [sla, anom, u, v] = await Promise.all([
      optionalGrid(slaRes),
      optionalGrid(anomRes),
      optionalGrid(uRes),
      optionalGrid(vRes),
    ]);
    // u,v phải CÙNG có và cùng cỡ lưới mới tính hội tụ được
    const cur: CurrentGrids | null =
      u && v && u.lats.length === v.lats.length && u.lons.length === v.lons.length
        ? { u, v }
        : null;

    const thermo = await thermoP; // tầng nhiệt D20 (HYCOM) — tuỳ chọn

    // độ sâu đáy ETOPO (parser riêng: cột lat/lon/z, không time) — tuỳ chọn
    let depth: ScalarGrid | null = null;
    if (bathyRes?.ok) {
      try {
        const g = parseBathyGrid(await bathyRes.json());
        depth = g.lats.length > 0 ? g : null;
      } catch {
        depth = null;
      }
    }

    const month = new Date().getMonth() + 1;
    return Response.json(
      buildFishForecast(sst, chl, sla, month, { anom, cur, thermo, depth }),
    );
  } catch {
    return Response.json({ ok: false });
  }
}
