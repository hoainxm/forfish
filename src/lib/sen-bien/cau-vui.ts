// KHO CÂU NÓI CÓ DUYÊN của Sen Biển (anh Long 2026-10-22: "train và tổ chức những câu hài hước những câu vui những câu nói
// lảng nói tránh khi mà ngram ko trả lời được khi offline, rồi câu giờ nếu online để đợi câu trả lời").
//
//   CAU_LANG  — không có câu trả lời: nói lảng có duyên theo ĐÚNG lý do (mất sóng / chưa đăng nhập / máy chủ chậm / bí),
//               câu mất sóng luôn chỉ sang việc làm được KHÔNG cần sóng (bản đồ, gió sóng, đường về).
//   CAU_GIO   — có sóng, đang chờ máy nhà: ba nhịp (mở lời ngay · ~2,5 s · ~5 s); câu trả lời về là cắt (henCauGio).
// Luật chữ: gọi đủ "Sen Biển", xưng bà con / bác, không chê người hỏi, không hứa điều máy không làm được, câu ngắn để đọc.
// Mỗi nhóm xoay vòng, không lặp liền câu vừa nói (chonCau).

import type { LyDoTruot } from "@/lib/sen-bien/luong-tra-loi";

export const CAU_LANG: Record<LyDoTruot, readonly string[]> = {
  mat_song: [
    "Ngoài này sóng điện thoại còn yếu hơn sóng biển, Sen Biển chưa tra được câu này. Có sóng bác hỏi lại nghen.",
    "Câu này khó, Sen Biển phải vô bờ hỏi thầy đã. Có sóng bác hỏi lại giúp nha.",
    "Mất sóng rồi bác ơi, Sen Biển đang lặn chưa ngoi lên được. Giờ hỏi gió sóng, đường về thì Sen Biển trả lời liền.",
    "Câu này phải có sóng Sen Biển mới hỏi giùm được. Trong lúc chờ, bác hỏi chuyện bản đồ, dẫn đường là có ngay.",
    "Không có sóng thì Sen Biển cũng như cá mắc cạn. Bác để dành câu này, có sóng hỏi lại nghen.",
    "Câu hay mà khó, để có sóng Sen Biển trả lời cho đàng hoàng. Giờ bác cần đường về hay gió sóng thì cứ nói.",
    "Sen Biển cũng đang ngoài vùng phủ sóng như bác. Hỏi cảng gần, rạn, gió sóng thì Sen Biển trả lời được liền.",
    "Câu này Sen Biển xin khất tới lúc có sóng. Còn chuyện trên bản đồ thì Sen Biển lo được ngay.",
  ],
  chua_dang_nhap: [
    "Câu này bác đăng nhập thì Sen Biển mới hỏi thêm được. Đăng nhập xong là Sen Biển chạy hết công suất.",
    "Sen Biển chưa biết bác là ai nên chưa hỏi thêm được. Bác đăng nhập giúp, xong hỏi lại nghen.",
    "Đăng nhập cái đã bác ơi, rồi câu khó cỡ nào Sen Biển cũng đi hỏi giùm.",
  ],
  het_gio: [
    "Máy chủ hôm nay chậm như tàu ngược gió, Sen Biển chưa có câu trả lời. Bác hỏi lại chút nữa nghen.",
    "Sen Biển chờ hoài chưa thấy trả lời về, chắc sóng yếu. Bác hỏi lại sau ít phút giúp.",
    "Câu trả lời đang kẹt giữa đường, Sen Biển xin lỗi bác. Hỏi lại chút nữa là có.",
  ],
  may_nha: [
    "Câu này làm Sen Biển bí rồi. Bác thử hỏi cách khác coi.",
    "Sen Biển nghĩ hoài chưa ra, bác nói cách khác giùm nghen.",
    "Câu này khó hơn kéo lưới đêm gió. Bác hỏi lại kiểu khác, Sen Biển ráng lần nữa.",
  ],
};

/** Bốn nhịp câu giờ khi đang chờ máy nhà: [mở lời ngay, ~2,5 s, ~5 s, ~8 s]. */
export const CAU_GIO: readonly (readonly string[])[] = [
  ["Để Sen Biển hỏi thêm.", "Câu hay đó, để Sen Biển hỏi coi.", "Chờ Sen Biển chút xíu nghen.", "Để Sen Biển lục lại coi."],
  ["Sen Biển đang lục sổ, bác chờ chút.", "Đang hỏi rồi, sắp có bác ơi.", "Đợi xíu, câu này Sen Biển phải hỏi kỹ."],
  ["Sóng hơi yếu, chờ thêm xíu nữa nghen.", "Gần xong rồi, bác đừng đi đâu nha.", "Sắp có câu trả lời rồi bác."],
  ["Máy chủ đang nghĩ kỹ, bác chờ chút nữa thôi.", "Câu này khó nên lâu, Sen Biển vẫn đang đợi.", "Ráng chờ chút, sắp xong rồi bác."],
];
/** Mốc nói nhịp 2, 3, 4 (ms sau lúc bắt đầu hỏi). Trần chờ máy nhà là HOI_HAN_MS 12 s — nhịp cuối phải trước mốc đó. */
export const MOC_GIO_MS = [2_500, 5_000, 8_000] as const;

const cuoi = new Map<string, number>();

/** Chọn một câu trong nhóm, KHÔNG lặp liền câu vừa nói ở cùng nhóm (`khoa`). */
export function chonCau(bo: readonly string[], khoa: string, rnd: () => number = Math.random): string {
  if (bo.length === 0) return "";
  if (bo.length === 1) return bo[0];
  const truoc = cuoi.get(khoa);
  let i = Math.floor(rnd() * bo.length) % bo.length;
  if (i === truoc) i = (i + 1) % bo.length;
  cuoi.set(khoa, i);
  return bo[i];
}

/**
 * Hẹn câu giờ nhịp 2, 3 trong lúc chờ máy nhà. `conCho()` false (đã có câu trả lời / lượt mới) thì không nói.
 * Trả hàm huỷ — gọi ngay khi có kết quả (kể cả trượt) để câu giờ không chen vào câu trả lời.
 */
export function henCauGio(noi: (cau: string) => void, conCho: () => boolean): () => void {
  const hen = MOC_GIO_MS.map((ms, k) =>
    setTimeout(() => {
      if (conCho()) noi(chonCau(CAU_GIO[k + 1], `gio-${k + 1}`));
    }, ms),
  );
  return () => hen.forEach(clearTimeout);
}
