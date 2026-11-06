// MỨC CẢNH BÁO TÀU S-TRACKING — THUẦN (2026-11-06). Anh Long: "tăng cái logic cảnh báo lên để đúng và kịp thời".
//
// Luật cũ: mọi loại "Báo động" đẩy lên máy, chống lặp 6 giờ như nhau. Đo kho máy nhà 24 giờ (06/11):
//   · "Thiết bị không sử dụng nguồn ngoài" = 18 163/20 800 cảnh báo (87%), 1 203/1 577 máy là TRONG BỜ ⇒ rác chính;
//   · SOS ngoài khơi chỉ 13 máy nhưng mỗi máy bắn lại ~42 lần/ngày (≈30 phút/lần) ⇒ chống lặp 6 giờ là quá chậm cho
//     chuyện sống còn; Vượt biên ngoài khơi 54 máy, ~9,5 lần/ngày;
//   · trễ từ lúc xảy ra tới lúc thấy: trung bình 18 phút, có lúc 89–268 phút.
// Luật mới — theo LOẠI và VỊ TRÍ tàu (trong bờ / ngoài khơi; chưa rõ ⇒ coi như ngoài khơi, nghiêng về an toàn):
//   khẩn  — đẩy lên máy, nhắc lại sớm khi còn diễn ra (SOS, Vượt biên ngoài khơi);
//   cao   — đẩy lên máy, chống lặp vài giờ (sắp vượt biên, tắt máy, mất GPS, pin yếu ngoài khơi);
//   thường — CŨNG đẩy lên máy nhưng tối đa 1 lần/NGÀY cùng máy + cùng loại (anh Long 06/11: "đẩy lên máy đi, tần suất ngày");
//   bỏ    — không báo (chuyện bình thường khi tàu nằm bờ: tắt máy, không nguồn ngoài, sắp vượt biên do nhiễu GPS…).
// Dùng ở: máy chủ (lib/stracking/thong-bao — quyết đẩy/hộp thư/chống lặp) + máy GPU (lượt siêu nhanh chỉ đọc cảnh báo khẩn).

const GIO = 3600_000;

/** [ngoài khơi, trong bờ] cho từng loại. chongLap = khoảng tối thiểu giữa hai lần báo CÙNG máy + CÙNG loại. */
const BANG = {
  SOS: [{ bac: "khan", chongLap: 1 * GIO }, { bac: "thuong", chongLap: 24 * GIO }],
  "Vượt biên": [{ bac: "khan", chongLap: 1 * GIO }, { bac: "thuong", chongLap: 24 * GIO }],
  "Sắp vượt biên": [{ bac: "cao", chongLap: 3 * GIO }, { bac: "bo" }],
  "Tắt thiết bị": [{ bac: "cao", chongLap: 6 * GIO }, { bac: "bo" }],
  "Mất GPS": [{ bac: "cao", chongLap: 6 * GIO }, { bac: "thuong", chongLap: 24 * GIO }],
  "Pin dự phòng sắp hết": [{ bac: "cao", chongLap: 12 * GIO }, { bac: "thuong", chongLap: 24 * GIO }],
  "Thiết bị không sử dụng nguồn ngoài": [{ bac: "thuong", chongLap: 24 * GIO }, { bac: "bo" }],
  "Thiết bị Reset": [{ bac: "thuong", chongLap: 24 * GIO }, { bac: "bo" }],
  "Vùng chú ý đánh bắt": [{ bac: "thuong", chongLap: 24 * GIO }, { bac: "bo" }],
  "Sắp vượt biên tại vùng chú ý đánh bắt": [{ bac: "thuong", chongLap: 24 * GIO }, { bac: "bo" }],
  "Vùng chỉ được phép đánh bắt cá đáy": [{ bac: "thuong", chongLap: 24 * GIO }, { bac: "bo" }],
  "Sắp vượt biên tại vùng chỉ được phép đánh bắt cá đáy": [{ bac: "thuong", chongLap: 24 * GIO }, { bac: "bo" }],
  "Quá tốc độ": [{ bac: "thuong", chongLap: 24 * GIO }, { bac: "bo" }],
};

/** Thứ tự nặng (nhỏ = nặng) — gộp tin: tàu/loại nặng hơn đứng trước. */
const THU_TU_BAC = { khan: 0, cao: 1, thuong: 2, bo: 3 };
const THU_TU_LOAI = ["SOS", "Vượt biên", "Sắp vượt biên", "Tắt thiết bị", "Mất GPS", "Pin dự phòng sắp hết"];

/**
 * Mức của MỘT cảnh báo. `trongBo`: true = trong bờ, false = ngoài khơi, null/undefined = chưa rõ (⇒ như ngoài khơi).
 * Trả { bac, day, chongLapMs, hang } — `day` = đẩy lên máy (mọi bậc trừ "bo"); `hang` để xếp (nhỏ = nặng). Loại lạ: theo cột "Kiểu"
 * (Báo động ⇒ cao 6 giờ, khác ⇒ thường 24 giờ; trong bờ ⇒ thường).
 * @param {{ loai: string, muc?: string | null, trongBo?: boolean | null }} cb
 * @returns {{ bac: "khan" | "cao" | "thuong" | "bo", day: boolean, chongLapMs: number | null, hang: number }}
 */
export function mucCanhBao({ loai, muc, trongBo }) {
  const ngoaiKhoi = trongBo !== true;
  const dong = BANG[loai];
  let x;
  if (dong) x = dong[ngoaiKhoi ? 0 : 1];
  else if (muc === "Báo động") x = ngoaiKhoi ? { bac: "cao", chongLap: 6 * GIO } : { bac: "thuong", chongLap: 24 * GIO };
  else x = ngoaiKhoi ? { bac: "thuong", chongLap: 24 * GIO } : { bac: "bo" };
  const iLoai = THU_TU_LOAI.indexOf(loai);
  return {
    bac: x.bac,
    day: x.bac !== "bo", // mọi bậc còn báo đều đẩy lên máy — "thường" giới hạn 1 lần/ngày bằng chongLapMs
    chongLapMs: x.chongLap ?? null,
    hang: THU_TU_BAC[x.bac] * 100 + (iLoai < 0 ? THU_TU_LOAI.length : iLoai),
  };
}

/**
 * Có báo cảnh báo này không? `truocMs` = lần gần nhất đã BÁO cùng máy + cùng loại (null = chưa từng). Bậc "bo" ⇒ không.
 * @param {{ loai: string, muc?: string | null, trongBo?: boolean | null }} cb
 * @param {number} nowMs
 * @param {number | null | undefined} truocMs
 */
export function nenBao({ loai, muc, trongBo }, nowMs, truocMs) {
  const m = mucCanhBao({ loai, muc, trongBo });
  if (m.bac === "bo") return false;
  return truocMs == null || nowMs - truocMs >= m.chongLapMs;
}

/** Loại đáng đọc ở lượt SIÊU NHANH (máy GPU): chỉ những loại có thể là "khẩn" khi ngoài khơi. */
export const LOAI_SIEU_NHANH = Object.freeze(Object.keys(BANG).filter((k) => BANG[k][0].bac === "khan"));
