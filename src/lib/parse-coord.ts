/*
  Đọc TOẠ ĐỘ bà con GÕ TAY (nút "Đến điểm" trên rail bản đồ) → số độ thập phân.
  Bà con gõ theo máy định vị / hải đồ đang cầm: có thể là độ thập phân (8,5),
  độ-phút (8 30), độ-phút-giây (8 30 15), kèm hoặc không kèm hướng (N/S/E/W hay
  Bắc/Nam/Đông/Tây). Vùng biển VN luôn Bắc + Đông nên BỎ TRỐNG hướng thì mặc
  định Bắc (vĩ) / Đông (kinh) — gõ ít nhất, đúng nhất.

  Tách theo TỪNG TRỤC (một ô vĩ, một ô kinh) nên dấu phẩy = dấu thập phân, KHÔNG
  nhập nhằng với dấu phẩy ngăn cặp toạ độ. Không có mạng vẫn chạy — thuần tính.
*/

export type CoordAxis = "lat" | "lon";

const MAX_ABS: Record<CoordAxis, number> = { lat: 90, lon: 180 };

// hướng theo trục: dương (Bắc/Đông) vs âm (Nam/Tây). Nhận cả chữ quốc tế lẫn
// chữ Việt — TRỪ "N" nhập nhằng (North quốc tế vs Nam tiếng Việt): trong ô vĩ
// độ "N" = North (dương), khớp máy định vị/hải đồ bà con đang dùng.
const NEG_LETTER: Record<CoordAxis, RegExp> = {
  lat: /^S$|^NAM$/, // Nam
  lon: /^W$|^T$|^TAY$/, // Tây
};
const POS_LETTER: Record<CoordAxis, RegExp> = {
  lat: /^N$|^B$|^BAC$/, // North / Bắc
  lon: /^E$|^D$|^Đ$|^DONG$|^ĐONG$/, // East / Đông
};

/**
 * Đọc một giá trị toạ độ bà con gõ. Trả về số độ thập phân (dương = Bắc/Đông,
 * âm = Nam/Tây), hoặc `null` nếu không hiểu / vượt khung (|vĩ|≤90, |kinh|≤180).
 */
export function parseOneCoord(raw: string, axis: CoordAxis): number | null {
  if (typeof raw !== "string") return null;
  // bỏ dấu tiếng Việt ở chữ hướng (Đông→DONG) để so khớp cho gọn
  const s = raw
    .trim()
    .toUpperCase()
    .replace(/Ô|Ơ/g, "O")
    .replace(/Ă|Â/g, "A");
  if (!s) return null;

  // dấu âm rõ ràng (người gõ "-8" thay vì "8 S")
  let sign = 1;
  let body = s;
  if (body.startsWith("-")) {
    sign = -1;
    body = body.slice(1).trim();
  } else if (body.startsWith("+")) {
    body = body.slice(1).trim();
  }

  // tách chữ hướng ở ĐẦU hoặc CUỐI (N 8 30 · 8 30 N)
  const letters = body.match(/[A-ZĐ]+/g) ?? [];
  if (letters.length > 1) return null; // 2 chữ hướng = mập mờ, không đoán
  const dir = letters[0];
  if (dir) {
    if (POS_LETTER[axis].test(dir)) {
      /* dương — giữ nguyên */
    } else if (NEG_LETTER[axis].test(dir)) {
      sign = -1;
    } else {
      return null; // chữ lạ (vd "E" trong ô vĩ độ) — không đoán bừa
    }
  }

  // còn lại chỉ là số: độ [phút [giây]], phẩy = dấu thập phân
  const nums = (body.replace(/,/g, ".").match(/\d+(?:\.\d+)?/g) ?? []).map(
    Number,
  );
  if (nums.length === 0 || nums.length > 3) return null;
  if (nums.some((n) => !Number.isFinite(n))) return null;

  const [deg, min = 0, sec = 0] = nums;
  // phút/giây phải < 60 (trừ khi chỉ có 1 số = độ thập phân thuần)
  if (nums.length >= 2 && (min >= 60 || sec >= 60)) return null;

  const val = sign * (deg + min / 60 + sec / 3600);
  if (!Number.isFinite(val) || Math.abs(val) > MAX_ABS[axis]) return null;
  return val;
}

/**
 * Đọc CẶP vĩ + kinh (mỗi ô một chuỗi). Trả `{ lat, lon }` hoặc `null` nếu một
 * trong hai ô không hợp lệ — để nút "Đến điểm" báo ô nào sai.
 */
export function parseCoordPair(
  latRaw: string,
  lonRaw: string,
): { lat: number; lon: number } | null {
  const lat = parseOneCoord(latRaw, "lat");
  const lon = parseOneCoord(lonRaw, "lon");
  if (lat == null || lon == null) return null;
  return { lat, lon };
}

/*
  TOẠ ĐỘ NÓI BẰNG GIỌNG (Sen Biển, 2026-10-16 — "thiếu cái nhập toạ độ bằng giọng
  nói"). Máy nghe trả chữ kiểu: "vĩ độ 14 độ 34 phút bắc kinh độ 109 độ 4 phút
  đông" · "14 34 109 04" · "14 phẩy 58, 109 phẩy 45". Tách thành hai trục rồi
  đọc từng trục bằng `parseOneCoord` (một luật đọc số cho cả gõ lẫn nói).
  Chỉ nhận trong khung biển Việt Nam và lân cận (vĩ -5…30, kinh 95…125): nghe
  nhầm một chữ số là ra chỗ cách hàng trăm hải lý — thà hỏi lại.
*/
const SPOKEN_BOX = { latMin: -5, latMax: 30, lonMin: 95, lonMax: 125 };

function foldSpoken(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
}

/*  SỐ ĐỌC BẰNG CHỮ → CHỮ SỐ (chạy thử 2026-10-16: "mười bốn độ ba mươi tư phút
    bắc một trăm lẻ chín độ bốn phút đông" không hiểu — bộ nghe giọng đôi khi
    trả chữ chứ không trả số). Nhận số 0–999 kiểu đọc Việt: mười bốn · ba mươi
    tư · hai mươi mốt · mười lăm · một trăm lẻ chín · một trăm hai mươi.
    Chữ NƯỚC ĐÔI sau khi bỏ dấu ("nam" = năm/Nam, "tu" = tư/từ, "sau" = sáu/sau,
    "khong" = không/số 0, "lam" = lăm/làm) chỉ là số khi đứng cạnh số khác hoặc
    ngay trước "độ/phút" — "34 phút nam" vẫn là hướng Nam. */
const SO_CHU: Record<string, number> = {
  khong: 0, mot: 1, hai: 2, ba: 3, bon: 4, tu: 4, nam: 5, lam: 5, sau: 6, bay: 7, tam: 8, chin: 9,
};
const NUOC_DOI = new Set(["nam", "sau", "tu", "khong", "lam"]);
const lopSo = (w: string) =>
  w === "muoi" ? "M" : w === "tram" ? "T" : w === "le" || w === "linh" ? "L" : w in SO_CHU ? "D" : "";

function giaTriSo(w: string[], c: string[]): number {
  let v = 0;
  let i = 0;
  const t = c.indexOf("T");
  if (t >= 0) {
    v += (t > 0 ? SO_CHU[w[0]] : 1) * 100;
    i = t + 1;
  }
  if (c[i] === "L") return v + SO_CHU[w[i + 1]];
  const m = c.indexOf("M", i);
  if (m >= 0) {
    v += (m > i ? SO_CHU[w[i]] : 1) * 10;
    return m + 1 < w.length ? v + SO_CHU[w[m + 1]] : v;
  }
  return i < w.length ? v + SO_CHU[w[i]] : v;
}

/*  Chữ có DẤU nói chắc nó là số hay không — chỉ dùng được khi câu còn dấu
    (bộ nghe trong máy luôn trả có dấu): "năm" là số, "nam" là hướng Nam. */
const CHAC_SO = new Set(["năm", "tư", "sáu", "lăm"]);
const CHAC_KHONG = new Set(["nam", "từ", "sau", "làm"]);

/**
 * LÕI đổi số bằng chữ — MỘT luật cho cả câu bỏ dấu lẫn câu có dấu (gộp 2026-10-18:
 * main có `soChuThanhSo` trên chữ bỏ dấu, nhánh Sen Biển có `soBangChu` trên chữ có
 * dấu — hai bản trôi nhau là đúng kiểu lỗi CLAUDE.md cảnh báo). `raw` = chữ gốc
 * (giữ nguyên khi không phải số), `w` = cùng chữ đã bỏ dấu, `co` = có dấu để tra.
 */
function doiSo(raw: string[], w: string[], co: boolean): string {
  const c = w.map(lopSo);
  const laSo = c.map((k, i) => {
    if (!k) return false;
    if (!NUOC_DOI.has(w[i])) return true;
    if (co) {
      const r = raw[i].toLowerCase().normalize("NFC");
      if (CHAC_SO.has(r)) return true;
      if (CHAC_KHONG.has(r)) return false;
    }
    const truoc = c[i - 1] ?? "";
    const sau = c[i + 1] ?? "";
    const chuSau = w[i + 1] ?? "";
    const truocDoPhut = chuSau === "do" || chuSau === "phut" || chuSau === "giay";
    // ngay sau "phẩy/chấm" là chữ số thập phân ("mười ba phẩy không năm")
    const sauPhay = w[i - 1] === "phay" || w[i - 1] === "cham";
    // "lăm"/"tư" chỉ đứng sau "mươi"/"lẻ" (ba mươi tư, một trăm lẻ tư)
    if (w[i] === "lam" || w[i] === "tu") return truoc === "M" || truoc === "L" || truoc === "D" || truocDoPhut || sauPhay;
    // đứng TRƯỚC thì chỉ khi sau nó là "mươi"/"trăm" (năm mươi) — "phút nam một trăm…" là hướng Nam
    return truoc !== "" || sau === "M" || sau === "T" || truocDoPhut || sauPhay;
  });
  const out: string[] = [];
  for (let i = 0; i < w.length; ) {
    if (!laSo[i]) {
      out.push(raw[i]);
      i++;
      continue;
    }
    let j = i;
    while (j < w.length && laSo[j]) j++;
    // một dãy chữ số có thể là NHIỀU số liền nhau ("mười bốn ba mươi tư") — cắt theo khuôn
    for (let k = i; k < j; ) {
      const m = c.slice(k, j).join("").match(/^(?:D?T(?:LD|D?MD?|D)?|D?MD?|D)/);
      if (!m) {
        out.push(raw[k]);
        k++;
        continue;
      }
      const n = m[0].length;
      out.push(String(giaTriSo(w.slice(k, k + n), c.slice(k, k + n))));
      k += n;
    }
    i = j;
  }
  // "14 phẩy 0 5" → "14 phẩy 05": các chữ số rời sau phẩy dính lại thành phần lẻ
  return out
    .join(" ")
    .replace(/(phẩy|phay|chấm|cham) ((?:\d \d)+(?: \d)?)(?=\s|$)/gi, (_, p: string, ds: string) => `${p} ${ds.replace(/ /g, "")}`);
}

/** Đổi số đọc bằng chữ trong câu ĐÃ BỎ DẤU ra chữ số; chữ khác giữ nguyên. */
export function soChuThanhSo(s: string): string {
  const raw = s.split(/\s+/).filter(Boolean);
  return doiSo(raw, raw.map((x) => x.replace(/[^a-z0-9]/g, "")), false);
}

/** Như `soChuThanhSo` cho câu CÒN DẤU (bộ nghe trong máy, lệnh bản đồ): chữ không phải số giữ nguyên dấu. */
export function soBangChu(text: string): string {
  const raw = String(text ?? "").split(/\s+/).filter(Boolean);
  return doiSo(raw, raw.map((x) => foldSpoken(x).replace(/[^a-z0-9]/g, "")), true);
}

export function parseSpokenCoordPair(text: string): { lat: number; lon: number } | null {
  if (typeof text !== "string") return null;
  // đổi số TRƯỚC khi bỏ dấu: còn dấu thì "năm" (5) khác chắc "nam" (hướng)
  let s = ` ${foldSpoken(soBangChu(text))} `
    // "14 phẩy 58" / "14 chấm 58" → 14.58 ; "14,58" → 14.58
    .replace(/(\d+)\s*(?:phay|cham)\s*(\d+)/g, "$1.$2")
    .replace(/(\d+),(\d+)/g, "$1.$2");
  // nhãn trục: tách theo "kinh do" nếu có
  s = s.replace(/\b(toa do|vi do|vi tuyen)\b/g, " ");
  let latPart: string;
  let lonPart: string;
  const kinh = s.search(/\bkinh( do| tuyen)?\b/);
  const bacNam = s.search(/\b(bac|nam)\b/);
  if (kinh >= 0) {
    latPart = s.slice(0, kinh);
    lonPart = s.slice(kinh).replace(/\bkinh( do| tuyen)?\b/, " ");
  } else if (bacNam >= 0) {
    const m = s.slice(bacNam).match(/^(bac|nam)/)![0];
    latPart = s.slice(0, bacNam + m.length);
    lonPart = s.slice(bacNam + m.length);
  } else {
    // không nhãn: chia đôi dãy số (2 · 4 · 6 số)
    const nums = s.match(/\d+(?:\.\d+)?/g) ?? [];
    if (nums.length !== 2 && nums.length !== 4 && nums.length !== 6) return null;
    // hai số NGUYÊN trơn ("tháng 2 … bd 95") không phải toạ độ — cần số lẻ hoặc nhãn
    if (nums.length === 2 && !nums.every((x) => x.includes("."))) return null;
    const h = nums.length / 2;
    latPart = nums.slice(0, h).join(" ");
    lonPart = nums.slice(h).join(" ");
  }
  const clean = (p: string) =>
    p
      .replace(/\b(do|phut|giay|va|la)\b/g, " ")
      .replace(/\bbac\b/g, " B ")
      .replace(/\bnam\b/g, " NAM ")
      .replace(/\bdong\b/g, " D ")
      .replace(/\btay\b/g, " T ")
      .replace(/[^0-9a-zA-Z. ]+/g, " ")
      .replace(/\b[a-z]+\b/g, " ") // chữ thừa khác ("o", "tai"…) bỏ, chỉ giữ chữ hướng viết hoa
      .trim();
  const lat = parseOneCoord(clean(latPart), "lat");
  const lon = parseOneCoord(clean(lonPart), "lon");
  if (lat == null || lon == null) return null;
  if (lat < SPOKEN_BOX.latMin || lat > SPOKEN_BOX.latMax) return null;
  if (lon < SPOKEN_BOX.lonMin || lon > SPOKEN_BOX.lonMax) return null;
  return { lat, lon };
}
