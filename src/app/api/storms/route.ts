import { parseStorms, type StormAlert } from "@/lib/storms";
import {
  NCHMF_INDEX_URL,
  htmlToText,
  parseNchmfBulletin,
  pickLatestNchmfBulletin,
} from "@/lib/storms-vn";
import { timeoutSignal } from "@/lib/abort";
import { gopNguonBao } from "@/lib/storm-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  rowsToTracks,
  TRACK_SONG_GIO,
  type BulletinRow,
  type ForecastRow,
  type StormTrack,
} from "@/lib/storm-track";

/**
 * Proxy cảnh báo bão: server gọi nguồn (tránh CORS phía trình duyệt), cache 30
 * phút — tin bão không cần tươi hơn mức đó, đỡ đập nguồn miễn phí.
 *
 * HAI NGUỒN, ƯU TIÊN VIỆT NAM (2026-08-18):
 *   · **NCHMF** (`lib/storms-vn.ts`) — bản tin bà con nghe trên đài duyên hải.
 *     Phủ CẢ áp thấp nhiệt đới, là thứ GDACS bỏ sót.
 *   · **GDACS** (EU/UN) — JSON ổn định, có đường đi + vùng ảnh hưởng dạng
 *     polygon để vẽ bản đồ; giữ làm nguồn thứ hai và cho các cơn ngoài vùng
 *     NCHMF đang ra tin.
 * Hỏng MỘT nguồn thì vẫn trả tin của nguồn kia (`ok: true`); chỉ khi CẢ HAI
 * hỏng mới 503 — lúc đó client nói "chưa hỏi được", KHÔNG bao giờ nói "không
 * có bão".
 *
 * NGUỒN HỎNG PHẢI TRẢ 503, KHÔNG PHẢI 200 (sửa 2026-07-31): service worker chỉ
 * cất phản hồi `res.ok` (public/sw.js), mà `Response.json({ok:false})` mặc định
 * là 200 ⇒ một lúc nguồn bảo trì trong khi tàu còn sóng ở cảng là ĐÈ MẤT bản
 * tin bão bà con đã tải — ra khơi không còn đường đi/vùng ảnh hưởng, và cổng
 * chặn tuyến cắt vùng bão cũng tắt theo. Client đã có nhánh `!r.ok → {ok:false}`
 * (lib/storms.ts) nên màn hình KHÔNG đổi: vẫn banner vàng "Chưa hỏi được".
 */
/*  ⚠️ THAM SỐ LÀ `eventtype`, SỐ ÍT — ĐỪNG ĐỔI (sửa 2026-08-18).
    LỖI ĐÃ SỬA, bắt được từ hiện trường: người của SDVICO báo *"đài dự báo áp
    thấp nhiệt đới trên Biển Đông mà app chưa cập nhật"* (18/8). Đo thẳng vào
    nguồn thì URL cũ dùng `?eventtypes=TC` (số nhiều) và GDACS trả **HTTP 400
    `{"message":"Eventtype is required."}`**, còn `?eventtype=TC` trả 200 với
    565 KB dữ liệu. Nghĩa là `/api/storms` đã KHÔNG lấy được gì suốt từ lúc
    GDACS siết tham số — mọi máy chỉ thấy "Chưa hỏi được tin bão".
    Nhánh `!r.ok` bên dưới xử đúng (503, không nói dối "không có bão"), nên lỗi
    này IM LẶNG: app không sập, không báo đỏ, chỉ là **không bao giờ có tin bão
    nào**. Đúng thứ nguy hiểm nhất với trục 1. Nay log rõ mã lỗi để lần sau có
    dấu vết, và có cổng test canh tham số (`storms-source.test.ts`). */
const GDACS_TC_URL =
  "https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtype=TC";

/** Trần chờ mỗi nguồn. NCHMF là trang HTML ~60 KB, GDACS JSON ~565 KB. */
const NGUON_TIMEOUT_MS = 15000;

async function layGdacs(now: Date): Promise<StormAlert[] | null> {
  try {
    const r = await fetch(GDACS_TC_URL, {
      next: { revalidate: 1800 },
      headers: { accept: "application/json" },
      signal: timeoutSignal(NGUON_TIMEOUT_MS),
    });
    if (!r.ok) {
      // ĐỪNG NUỐT IM: nguồn đổi hợp đồng (400/404) trông y hệt nguồn bảo trì
      // (5xx) ở phía client — chỉ log này phân biệt được, và nó là thứ đáng lẽ
      // đã cho biết lỗi `eventtypes` từ ngày đầu.
      console.error("[storms] GDACS trả", r.status, r.statusText, GDACS_TC_URL);
      return null;
    }
    return parseStorms(await r.json(), now);
  } catch (e) {
    console.error("[storms] GDACS hỏng:", (e as Error)?.message);
    return null;
  }
}

/*  NCHMF = HAI LƯỢT TẢI: trang liệt kê → bản tin mới nhất. Cố ý KHÔNG gộp vào
    một lượt: trang liệt kê đổi liên tục (mọi loại bản tin), còn URL bản tin thì
    không đoán được theo ngày (NCHMF đánh số `postNNNNN` tăng dần).
    Trả `[]` (mảng rỗng) khi trang liệt kê KHÔNG có bản tin bão nào — đó là câu
    trả lời THẬT "hiện không có tin", khác hẳn `null` = không hỏi được. */
async function layNchmf(now: Date): Promise<StormAlert[] | null> {
  try {
    const rIndex = await fetch(NCHMF_INDEX_URL, {
      next: { revalidate: 1800 },
      headers: {
        accept: "text/html",
        // NCHMF chặn client không khai UA (đã đo)
        "user-agent": "Mozilla/5.0 (compatible; SDFish/1.0; +https://sdvico.vn)",
      },
      signal: timeoutSignal(NGUON_TIMEOUT_MS),
    });
    if (!rIndex.ok) {
      console.error("[storms] NCHMF index trả", rIndex.status);
      return null;
    }
    const url = pickLatestNchmfBulletin(await rIndex.text());
    if (!url) return []; // trang liệt kê không có bản tin bão/ATNĐ nào

    const rTin = await fetch(url, {
      next: { revalidate: 1800 },
      headers: {
        accept: "text/html",
        "user-agent": "Mozilla/5.0 (compatible; SDFish/1.0; +https://sdvico.vn)",
      },
      signal: timeoutSignal(NGUON_TIMEOUT_MS),
    });
    if (!rTin.ok) {
      console.error("[storms] NCHMF bản tin trả", rTin.status, url);
      return null;
    }
    const s = parseNchmfBulletin(htmlToText(await rTin.text()), now, url);
    /*  Parse KHÔNG ra gì ⇒ coi như KHÔNG HỎI ĐƯỢC (`null`), không phải "không
        có bão": trang có bản tin mà mình đọc không nổi thì đó là mình hỏng, và
        nói "không có bão" trong ca đó là nói dối chuyện tính mạng. */
    return s ? [s] : null;
  } catch (e) {
    console.error("[storms] NCHMF hỏng:", (e as Error)?.message);
    return null;
  }
}

/**
 * Gộp hai nguồn: **tin VN đứng trước**, rồi thêm cơn GDACS nào KHÔNG phải bản
 * trùng của tin VN. Luật "cùng cơn" (tâm + thời gian, không nhìn tên) và việc
 * VN MƯỢN polygon/track của GDACS khi cùng cơn nằm ở `lib/storm-identity.ts`
 * (2026-08-18b) — DÙNG CHUNG với push bão và cùng khuôn khoá với kho bản tin,
 * để ba chỗ không mỗi nơi một ngưỡng.
 *
 * Vì sao ưu tiên VN: bà con đối chiếu với đài duyên hải; hai bản tin cùng một
 * cơn mà lệch tên/cấp thì phải theo bản tin trong nước. Vì sao vẫn giữ GDACS:
 * nó có polygon vùng ảnh hưởng + track dài để vẽ, và phủ cơn ngoài vùng NCHMF
 * đang ra tin.
 */
export function gopNguon(vn: StormAlert[], gdacs: StormAlert[]): StormAlert[] {
  return gopNguonBao(vn, gdacs);
}

/**
 * Đường đi các cơn còn sống, dựng từ kho bản tin (`/api/cron/refresh-storms`
 * ghi vào, migration 0036). ĐỘC LẬP với hai nguồn trên: kho hỏng thì trả `[]`
 * và tin bão vẫn đi — thêm phần vẽ đẹp KHÔNG được phép làm mất phần cảnh báo.
 */
async function layDuongDi(now: Date): Promise<StormTrack[]> {
  const admin = createAdminClient();
  if (!admin) return []; // demo mode / chưa cấu hình — không phải lỗi
  try {
    const tuMs = new Date(now.getTime() - TRACK_SONG_GIO * 3600_000).toISOString();
    /*  Lấy KHOÁ của các cơn còn ra tin trong 48 giờ, rồi lấy TOÀN BỘ bản tin của
        những khoá đó — nếu chỉ lấy bản tin trong 48 giờ thì đoạn đường cơn đã đi
        từ mấy hôm trước biến mất, đúng thứ chủ dự án muốn thấy. */
    const { data: gan, error: eGan } = await admin
      .from("storm_bulletins")
      .select("storm_key")
      .gte("issued_at", tuMs);
    if (eGan) throw eGan;
    const khoa = [...new Set((gan ?? []).map((r) => r.storm_key as string))];
    if (khoa.length === 0) return [];

    const { data: rows, error: eRows } = await admin
      .from("storm_bulletins")
      .select("id,storm_key,issued_at,observed_at,la_bao,so_bao,lat,lon,cap,giat")
      .in("storm_key", khoa)
      .order("issued_at", { ascending: true })
      .limit(500);
    if (eRows) throw eRows;

    /*  Mốc dự báo CHỈ của bản tin mới nhất mỗi cơn — phần "sắp tới" được hiệu
        chỉnh mỗi lần có tin, các bản dự báo cũ nằm lại trong kho để soi sau chứ
        không vẽ (vẽ hết thì bản đồ thành mớ chỉ rối). */
    const moiNhat = new Map<string, string>();
    for (const r of (rows ?? []) as BulletinRow[]) moiNhat.set(r.storm_key, r.id);
    const ids = [...moiNhat.values()];
    const { data: pts, error: ePts } = await admin
      .from("storm_forecast_points")
      .select("bulletin_id,valid_at,lat,lon,cap,giat,danger_box,seq")
      .in("bulletin_id", ids);
    if (ePts) throw ePts;

    return rowsToTracks((rows ?? []) as BulletinRow[], (pts ?? []) as ForecastRow[]);
  } catch (e) {
    console.error("[storms] đọc kho đường đi HỎNG:", (e as Error)?.message);
    return [];
  }
}

export async function GET() {
  const now = new Date();
  const [vn, gdacs, tracks] = await Promise.all([
    layNchmf(now),
    layGdacs(now),
    layDuongDi(now),
  ]);

  // CẢ HAI nguồn không hỏi được → 503 (xem ghi chú đầu file). Một bên rỗng
  // (`[]`) vẫn là câu trả lời hợp lệ.
  if (vn === null && gdacs === null) {
    return Response.json({ ok: false }, { status: 503 });
  }

  return Response.json({
    ok: true,
    storms: gopNguon(vn ?? [], gdacs ?? []),
    checkedAt: now.toISOString(),
    /*  Đường đi đã qua + dự báo sắp tới (kho 0036). Client cũ KHÔNG đọc trường
        này và vẫn chạy đúng — thêm trường là thêm, không phá hợp đồng. */
    tracks,
    /*  Nguồn nào trả lời được lượt này — để /quan-tri và người soát sau biết
        app đang sống bằng nguồn nào, thay vì đoán. Client hiện KHÔNG đọc trường
        này; thêm trường mới không phá `stormStatus` (nó chỉ đọc ok/storms/checkedAt). */
    sources: {
      nchmf: vn === null ? "hong" : "ok",
      gdacs: gdacs === null ? "hong" : "ok",
    },
  });
}
