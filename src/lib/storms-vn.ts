// Trục 1 — TIN BÃO / ÁP THẤP NHIỆT ĐỚI **NGUỒN VIỆT NAM** (NCHMF, 2026-08-18).
//
// ═══ VÌ SAO CÓ FILE NÀY ═══
//
// Nguồn duy nhất tới nay là GDACS (EU/UN). Ngày 18/8 người của SDVICO báo từ
// hiện trường: *"đài dự báo áp thấp nhiệt đới trên Biển Đông mà app chưa cập
// nhật"*. Hai nguyên nhân, đã đo:
//   1. Route gọi sai tham số ⇒ GDACS trả 400 (đã vá cùng ngày);
//   2. **GDACS KHÔNG PHỦ áp thấp nhiệt đới mới hình thành.** Đo lại sau khi vá:
//      feed 122 feature, 3 tâm bão, gần nhất ở Đông Thái Bình Dương — KHÔNG một
//      sự kiện nào trong khung Biển Đông. Trong khi NCHMF đã phát bản tin
//      "TIN ÁP THẤP NHIỆT ĐỚI TRÊN BIỂN ĐÔNG", tâm 19,8°N–117,6°E, cấp 6.
// Sửa tham số không cứu được nguyên nhân 2. Bà con nghe đài duyên hải đọc bản
// tin NCHMF, nên app phải nói CÙNG MỘT THỨ với cái họ nghe.
//
// ═══ NGUỒN LÀ TRANG HTML, KHÔNG PHẢI API ═══
//
// NCHMF không có API máy-đọc-được (đã dò: trang chính ASP.NET không lộ endpoint;
// thoitietnguyhiem.net chạy WordPress nhưng `/wp-json/wp/v2/posts` rỗng). Nên
// đây là PARSE BẢN TIN CHỮ — dễ vỡ hơn JSON, và file này được viết với giả định
// đó:
//   · mọi hàm THUẦN, nhận chuỗi, không tự fetch → test bằng bản tin thật;
//   · parse hỏng ⇒ trả `null`, KHÔNG ném, KHÔNG bịa nửa vời;
//   · route giữ GDACS làm nguồn thứ hai, hỏng một bên vẫn còn bên kia.
//
// ⚠️ TUYỆT ĐỐI KHÔNG suy diễn thêm số nào ngoài thứ bản tin viết ra. Thiếu toạ
// độ thì bỏ cả bản tin — thà không có tin còn hơn tin sai chỗ.

import type { StormAlert } from "@/lib/storms";

/** Trang liệt kê bản tin của NCHMF (bản tin mới nằm ở đây, có link theo slug) */
export const NCHMF_INDEX_URL = "https://www.nchmf.gov.vn/kttv/";

/*  Slug bản tin bão/ATNĐ. NCHMF đặt tên theo loại tin:
      tin-ap-thap-nhiet-doi-tren-bien-dong / -gan-bien-dong / -tren-dat-lien
      tin-bao-tren-bien-dong / tin-bao-khan-cap / tin-con-bao-so-N …
    Bắt cả hai họ, và CỐ Ý bỏ "tin-cuoi-cung" (bản tin kết thúc — không còn bão). */
const SLUG_RE =
  /https?:\/\/[^"']*\/(?:kttv|kttvsite)\/vi-VN\/1\/(tin-(?:ap-thap-nhiet-doi|bao|con-bao)[^"']*?)-post(\d+)\.html/gi;

/**
 * URL bản tin bão/ATNĐ MỚI NHẤT trong trang liệt kê của NCHMF.
 *
 * ⚠️ TÊN CÓ HẬU TỐ `Nchmf` là CỐ Ý: `port-price-source.ts` đã có
 * `pickLatestBulletinUrl` cho bản tin giá VASEP. Cùng một việc ("lấy bản tin mới
 * nhất từ trang liệt kê") nhưng LUẬT CHỌN khác hẳn — VASEP theo thứ tự trong
 * listing, NCHMF theo số `postNNNNN` lớn nhất — nên không gộp được, và để trùng
 * tên là mời người sau import nhầm (hook NT15 §3 bắt được ngay lần đầu). `null` = trang không có
 * bản tin nào (trời yên — đúng và phải nói được, khác hẳn "không đọc được").
 *
 * "Mới nhất" = số `post` LỚN NHẤT: NCHMF đánh số tăng dần, tin cuối trong ngày
 * luôn có số lớn hơn. KHÔNG dựa vào thứ tự xuất hiện trong HTML (trang xáo theo
 * khối "tin nổi bật" / "tin mới").
 */
export function pickLatestNchmfBulletin(indexHtml: string): string | null {
  let best: { url: string; id: number } | null = null;
  for (const m of indexHtml.matchAll(SLUG_RE)) {
    const slug = m[1].toLowerCase();
    if (slug.includes("tin-cuoi-cung")) continue; // bản tin KẾT THÚC, không phải bão đang có
    const id = Number(m[2]);
    if (!Number.isFinite(id)) continue;
    if (!best || id > best.id) best = { url: m[0], id };
  }
  return best?.url ?? null;
}

/**
 * HTML → chữ thuần một dòng (bỏ script/style, giải mã thực thể cơ bản).
 *
 * ⚠️ CHUẨN HOÁ NFC LÀ BẮT BUỘC, KHÔNG PHẢI CHO ĐẸP (lỗi thật, 2026-08-18d).
 * Trang NCHMF **trộn hai kiểu mã Unicode ngay trong một từ**. Đo trên bản tin
 * 14h00 ngày 18/8: chữ "hướng" là `h ư ơ U+0301 n g` — tức "ơ" cộng DẤU SẮC RỜI,
 * không phải "ớ" dựng sẵn (U+1EDB) như mọi chuỗi trong mã nguồn này; nhưng
 * "Tây" ngay cạnh lại dựng sẵn. Hệ quả: `parseHuongTocDo` trả `dir: null` cho
 * một bản tin ghi rõ "Di chuyển theo hướng Tây" — và cùng lỗi đó rình MỌI regex
 * tiếng Việt ở đây (`cấp`, `độ Vĩ Bắc`, `Tin phát lúc`, `Hồi … giờ`, `bán kính`,
 * `rủi ro`). Trượt chỗ nào là tuỳ bản tin, nên nó không bao giờ đỏ đều — đúng
 * kiểu lỗi im lặng tệ nhất.
 * Một dòng `normalize("NFC")` ở CỬA DUY NHẤT mọi parser đi qua là đủ, và phải
 * nằm ở đây chứ không phải rải ở từng hàm.
 */
export function htmlToText(html: string): string {
  return html
    .normalize("NFC")
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * CẮT BỎ MENU TRANG, chỉ giữ THÂN BẢN TIN.
 *
 * ⚠️ LỖI THẬT ĐÃ SỬA (2026-08-18, bắt được khi soi bản tin trực tiếp): trang
 * NCHMF có thanh điều hướng với các mục *"Thời tiết nguy hiểm · **Bão - Áp thấp
 * nhiệt đới** · Rủi ro thiên tai…"*, và `htmlToText` bóc cả menu đó vào chữ.
 * Nghĩa là **mọi** bản tin — kể cả TIN BÃO KHẨN CẤP — đều chứa chuỗi "áp thấp
 * nhiệt đới", nên phép `có "bão" && không có "áp thấp nhiệt đới"` LUÔN ra
 * `laBao = false`: giữa cơn bão cấp 12, màn hình bà con vẫn ghi *"Áp thấp nhiệt
 * đới"*. Lỗi im lặng — không sập, không log, chỉ nói nhẹ đi một cấp thiên tai.
 *
 * Cắt từ TIÊU ĐỀ bản tin gần thân nhất ("TIN ÁP THẤP NHIỆT ĐỚI TRÊN BIỂN ĐÔNG",
 * "TIN BÃO KHẨN CẤP") — giữ tiêu đề vì "bão số N" nằm ở đó. Không tìm thấy tiêu
 * đề thì cắt ngay tại mốc thân ("Hồi 07 giờ"); không có cả mốc đó thì trả
 * nguyên văn (thà đọc thừa còn hơn cắt mất bản tin).
 */
export function catThanBanTin(text: string): string {
  const than = text.search(/hồi\s+\d{1,2}\s*giờ/iu);
  if (than < 0) return text;
  const tieuDe = [
    ...text.slice(0, than).matchAll(/tin\s+(?:áp\s+thấp\s+nhiệt\s+đới|bão)/giu),
  ];
  const bd = tieuDe.length ? (tieuDe[tieuDe.length - 1].index ?? than) : than;
  return text.slice(bd);
}

/** "19,8" → 19.8 (bản tin VN dùng dấu PHẨY thập phân) */
const soVn = (s: string) => Number(s.replace(",", "."));

/*  Toạ độ trong bản tin có hai lối viết, cùng một ý:
      "19,8°N; 117,6°E"        (dòng hiện trạng)
      "19,9N-115,3E"           (bảng dự báo)
      "19,8 độ Vĩ Bắc; 117,6 độ Kinh Đông"  (lối cũ, vẫn gặp ở bản tin dài)
    Một regex phủ cả ba, KHÔNG cho khớp lỏng lẻo hơn (số trần không đơn vị thì
    bỏ — bản tin đầy số cấp gió, tốc độ, sóng). */
const TOA_DO_RE =
  /(\d{1,2},\d|\d{1,2})\s*(?:°\s*N|N\b|độ\s+vĩ\s+bắc)\s*[;,\-–]?\s*(\d{2,3},\d|\d{2,3})\s*(?:°\s*E|E\b|độ\s+kinh\s+đông)/giu;

export type ToaDo = { lat: number; lon: number };

/** Mọi cặp toạ độ trong bản tin, theo thứ tự xuất hiện (tâm hiện tại đứng đầu). */
export function parseToaDo(text: string): ToaDo[] {
  const out: ToaDo[] = [];
  for (const m of text.matchAll(TOA_DO_RE)) {
    const lat = soVn(m[1]);
    const lon = soVn(m[2]);
    // Khung Biển Đông + vùng tiếp cận. Ngoài khung = đọc nhầm số khác trong câu.
    if (lat >= 0 && lat <= 30 && lon >= 95 && lon <= 140) out.push({ lat, lon });
  }
  return out;
}

/*  CẤP GIÓ → KM/H. Bản tin viết "cấp 6 (39–49km/h)"; app lại hiện gió bằng km/h
    rồi TỰ QUY NGƯỢC ra cấp bằng `beaufort()` (marine-weather.ts) ở nhiều chỗ.

    ⚠️ PHẢI KHỚP HAI CHIỀU — LỖI ĐÃ SỬA NGAY TRONG NGÀY (2026-08-18): bản đầu
    lấy cận TRÊN của cấp ("thà nói mạnh hơn"), tức cấp 6 → 49 km/h. Nhưng thang
    của app cắt cấp 7 tại **≥49**, nên banner in ra *"49 km/giờ (cấp 7)"* trong
    khi đài đọc **cấp 6**. Sai một cấp ở bản tin bão là bà con hết tin app —
    và đó đúng là thứ tính năng này sinh ra để tránh.

    Nay lấy GIỮA dải của chính thang `beaufort()`: quy ngược luôn ra đúng cấp
    bản tin nói. Cổng test khoá bất biến hai chiều (`beaufort(capKmh(c)) === c`)
    cho mọi cấp 6..17 — thang có đổi thì test đỏ, không ai đổi lén được. */
const BEAUFORT_LIMITS = [1, 5, 11, 19, 28, 38, 49, 61, 74, 88, 102, 117];

/*  Thang `beaufort()` của app dừng ở cấp 12 (mọi giá trị ≥117 đều là 12), nhưng
    bản tin VN có cấp 13–17. Dải KTTV cho các cấp đó ghi ở đây để lấy giá trị
    ĐẠI DIỆN — vẫn phải nằm TRÊN 118 km/h, vì đó là ngưỡng `stormKindLabel` gọi
    "Bão mạnh" (cấp 12 mà trả đúng 117 thì app in "Bão" trong khi đài đọc cấp 12). */
const CAP_KMH_TREN_12: Record<number, number> = {
  12: 125, 13: 141, 14: 158, 15: 175, 16: 192, 17: 211,
};

export function capGioSangKmh(cap: number): number | null {
  if (!Number.isFinite(cap) || cap < 6 || cap > 17) return null;
  if (cap >= 12) return CAP_KMH_TREN_12[cap] ?? null;
  const duoi = BEAUFORT_LIMITS[cap - 1];
  const tren = BEAUFORT_LIMITS[cap];
  return Math.round((duoi + tren - 1) / 2);
}

/** Cấp gió mạnh nhất nêu trong bản tin (bỏ "giật cấp N" — giật không phải cấp bão). */
export function parseCapGio(text: string): number | null {
  const t = text.replace(/giật\s+cấp\s+\d+/giu, " ");
  let max: number | null = null;
  for (const m of t.matchAll(/cấp\s+(\d{1,2})/giu)) {
    const c = Number(m[1]);
    if (c >= 6 && c <= 17 && (max === null || c > max)) max = c;
  }
  return max;
}

/**
 * Ngày/tháng của bản tin, lấy từ mốc quan trắc "Hồi 13 giờ ngày 18/8".
 * Dùng khi câu "Tin phát lúc" KHÔNG ghi ngày (xem `parseGioPhatTin`).
 */
function ngayThangTuThan(text: string): { ngay: number; thang: number } | null {
  const m = /hồi\s*\d{1,2}\s*giờ\s*ngày\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2})/iu.exec(text);
  if (!m) return null;
  const ngay = Number(m[1]);
  const thang = Number(m[2]);
  return ngay > 31 || thang > 12 ? null : { ngay, thang };
}

/**
 * "Tin phát lúc: 08h00 ngày 18/8" → epoch ms (giờ VN, UTC+7).
 *
 * ⚠️ NGÀY LÀ TUỲ CHỌN (lỗi thật, 2026-08-18d): cùng một cơn, cùng một trang,
 * bản 08h00 ghi *"Tin phát lúc: 08h00 ngày 18/8"* còn bản 14h00 chỉ ghi
 * *"Tin phát lúc: 14h00"*. Bản đầu đòi phải có ngày ⇒ trả `null` ⇒ cron ghi kho
 * trả 503 và **không bao giờ ghi được bản tin nào nữa** — im lặng, vì 503 trông
 * y hệt "nguồn đang bảo trì".
 * Thiếu ngày thì lấy ngày của mốc QUAN TRẮC trong chính bản tin ("Hồi 13 giờ
 * ngày 18/8"); không có nốt thì lấy ngày VN hôm nay và lùi một ngày nếu mốc
 * dựng ra rơi quá 2 giờ về tương lai (bản tin phát sát nửa đêm, đọc sau đó).
 */
export function parseGioPhatTin(text: string, now: Date): number | null {
  const m =
    /tin\s+phát\s+lúc\s*:?\s*(\d{1,2})\s*[h:]\s*(\d{2})(?:\s*ngày\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2}))?/iu.exec(
      text,
    );
  if (!m) return null;
  const gio = Number(m[1]);
  const phut = Number(m[2]);
  let ngay = m[3] ? Number(m[3]) : NaN;
  let thang = m[4] ? Number(m[4]) : NaN;
  if (!Number.isFinite(ngay) || !Number.isFinite(thang)) {
    const tuThan = ngayThangTuThan(text);
    if (tuThan) {
      ngay = tuThan.ngay;
      thang = tuThan.thang;
    } else {
      // ngày VN hôm nay
      const vn = new Date(now.getTime() + 7 * 3600_000);
      ngay = vn.getUTCDate();
      thang = vn.getUTCMonth() + 1;
    }
  }
  if (gio > 23 || phut > 59 || ngay > 31 || thang > 12) return null;
  /*  Bản tin KHÔNG ghi năm. Lấy năm hiện tại, và nếu mốc dựng ra lại ở TƯƠNG LAI
      quá 2 ngày thì đó là bản tin cuối tháng 12 đọc vào đầu tháng 1 ⇒ lùi 1 năm.
      Đừng để một bản tin cũ đội lốt tin mới vì lỗi năm. */
  const nam = now.getUTCFullYear();
  const dung = (y: number) => Date.UTC(y, thang - 1, ngay, gio - 7, phut);
  let ms = dung(nam);
  if (ms - now.getTime() > 2 * 86400_000) ms = dung(nam - 1);
  // ngày suy ra từ đồng hồ máy mà rơi quá 2 giờ về tương lai ⇒ là bản tin hôm qua
  if (!m[3] && !ngayThangTuThan(text) && ms - now.getTime() > 2 * 3600_000) {
    ms -= 86400_000;
  }
  return ms;
}

/**
 * "Bản tin tiếp theo: 14h00 ngày 18/8" → epoch ms.
 *
 * ⚠️ ĐÂY LÀ MỎ VÀNG CHO NHỊP QUÉT (2026-08-18): **nguồn tự khai khi nào có bản
 * tin kế tiếp**, ngay trong mỗi bản tin. Nghĩa là app KHÔNG cần chép cứng bảng
 * tần suất của QĐ 18/2021 (6 giờ/lần khi bão còn trên Biển Đông, 3 giờ/lần khi
 * gần bờ, 1 giờ/lần khi khẩn cấp) — chép cứng thì sai ngay lúc cơ quan dự báo
 * đổi nhịp, mà đó đúng là lúc nguy hiểm nhất. Đọc con số nguồn tự ghi thì mọi
 * nấc leo thang đều tự khớp.
 *
 * Neo theo GIỜ PHÁT (`phatLucMs`), không theo đồng hồ máy: bản tin không ghi
 * năm, và mốc kế tiếp LUÔN ở sau giờ phát trong vòng ~1 ngày. Trả `null` khi
 * bản tin không ghi (có bản tin cuối cùng không ghi mốc kế) — chỗ gọi phải có
 * đường lùi, đừng coi `null` là "không bao giờ có tin nữa".
 */
export function parseGioBanTinTiepTheo(
  text: string,
  phatLucMs: number | null,
  now: Date,
): number | null {
  const m =
    /bản\s+tin\s+tiếp\s+theo[^0-9]{0,24}?(\d{1,2})\s*[h:]\s*(\d{2})(?:\s*ngày\s*(\d{1,2})\s*[\/.-]\s*(\d{1,2}))?/iu.exec(
      text,
    );
  if (!m) return null;
  const gio = Number(m[1]);
  const phut = Number(m[2]);
  const neo = phatLucMs ?? now.getTime();
  /*  Thiếu ngày ⇒ lấy ngày của GIỜ PHÁT, và nếu mốc rơi trước giờ phát thì đó
      là tin của ngày hôm sau (bản tin 20h00 hẹn tin kế 02h00). */
  const dNeo = new Date(neo);
  const ngay = m[3] ? Number(m[3]) : dNeo.getUTCDate();
  const thang = m[4] ? Number(m[4]) : dNeo.getUTCMonth() + 1;
  if (gio > 23 || phut > 59 || ngay > 31 || thang > 12) return null;
  const nam = new Date(neo).getUTCFullYear();
  const dung = (y: number) => Date.UTC(y, thang - 1, ngay, gio - 7, phut);
  let ms = dung(nam);
  // bản tin 31/12 hẹn tin kế 01/01: mốc tính ra lùi gần một năm ⇒ cộng một năm
  if (neo - ms > 300 * 86400_000) ms = dung(nam + 1);
  // ngày suy ra từ giờ phát mà mốc rơi trước đó ⇒ tin kế thuộc ngày hôm sau
  if (!m[3] && ms <= neo) ms += 86400_000;
  /*  Mốc kế mà vẫn rơi TRƯỚC giờ phát thì bản tin ghi lạ (hoặc mình đọc trượt)
      — trả null để chỗ gọi dùng đường lùi, thay vì cầm một mốc đã quá hạn rồi
      quét liên tục vì "tới giờ rồi". */
  return ms <= neo ? null : ms;
}

/**
 * Bản tin NCHMF (chữ thuần) → một `StormAlert`, hoặc `null` khi bản tin không
 * đủ dữ kiện (thiếu toạ độ tâm) — thà không có tin còn hơn tin sai chỗ.
 *
 * `track` = các vị trí DỰ BÁO trong bảng 24/48 giờ, nối sau tâm hiện tại; đúng
 * cái `routeStormConflict` cần để chặn tuyến cắt hành lang bão. `areas` để rỗng:
 * bản tin VN cho "vùng nguy hiểm" dạng khung toạ độ, KHÔNG phải polygon — quy
 * nó thành polygon là tự vẽ thêm thứ nguồn không nói.
 */
export function parseNchmfBulletin(
  thoText: string,
  now: Date,
  url?: string,
): StormAlert | null {
  // BỎ MENU TRANG TRƯỚC MỌI PHÉP ĐỌC — xem `catThanBanTin`
  const text = catThanBanTin(thoText);
  const diems = parseToaDo(text);
  if (diems.length === 0) return null;

  const cap = parseCapGio(text);
  const windKmh = cap != null ? capGioSangKmh(cap) : null;
  const phatLuc = parseGioPhatTin(text, now);

  const laBao = /\bbão\b/iu.test(text) && !/áp\s+thấp\s+nhiệt\s+đới/iu.test(text);
  const tam = diems[0];

  /*  TÊN HIỂN THỊ: bản tin ATNĐ không có tên quốc tế; bão thì có "bão số N" —
      lấy đúng chữ bà con nghe trên đài, không bịa tên tiếng Anh. */
  const soBao = /bão\s+số\s+(\d{1,2})/iu.exec(text)?.[1];
  /*  TÊN RỖNG KHI BẢN TIN KHÔNG ĐẶT TÊN (sửa 2026-08-18, thấy trên màn thật).
      Bản đầu trả "trên Biển Đông" làm tên ⇒ banner ghép thành *"Áp thấp nhiệt
      đới trên Biển Đông đang trên vùng Biển Đông"* — lặp, đọc như máy nói. Bản
      tin ATNĐ của NCHMF vốn KHÔNG có tên riêng (chỉ bão mới có "số N"), nên
      chỗ đó phải để trống và giao diện tự lo phần còn lại của câu. */
  const name = soBao ? `số ${soBao}` : "";

  return {
    /*  Id ổn định theo BẢN TIN, không theo giờ đọc: cùng một bản tin đọc lại
        nhiều lần vẫn là một sự kiện (client khử trùng theo id). */
    id: `nchmf-${url?.match(/post(\d+)/)?.[1] ?? phatLuc ?? "0"}`,
    name,
    kindLabel: laBao ? (windKmh != null && windKmh >= 118 ? "Bão mạnh" : "Bão") : "Áp thấp nhiệt đới",
    windKmh,
    lat: tam.lat,
    lon: tam.lon,
    // Cấp 8 trở lên (≥74 km/h) mới là bão thật sự — dưới đó vẫn CẢNH BÁO, và
    // luật chặn tuyến của app chặn cả `watch` (chốt 2026-07-26).
    alert: windKmh != null && windKmh >= 74 ? "danger" : "watch",
    updated: new Date(phatLuc ?? now.getTime()).toISOString(),
    // tâm hiện tại + các vị trí dự báo (bỏ trùng liên tiếp)
    track: diems
      .map((d) => [d.lon, d.lat] as number[])
      .filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]),
    areas: [],
  };
}
