// KHO CÂU NÓI CÓ DUYÊN của Sen Biển (anh Long 2026-10-22: "train và tổ chức những câu hài hước những câu vui những câu nói
// lảng nói tránh khi mà ngram ko trả lời được khi offline, rồi câu giờ nếu online để đợi câu trả lời").
//
//   CAU_LANG  — không có câu trả lời: nói lảng có duyên theo ĐÚNG lý do (mất sóng / chưa đăng nhập / máy chủ chậm / bí),
//               câu mất sóng luôn chỉ sang việc làm được KHÔNG cần sóng (bản đồ, gió sóng, đường về).
//   CAU_GIO   — có sóng, đang chờ máy nhà: bốn nhịp (1,2 s · 4 s · 7 s · 10 s); câu trả lời về thì đợi câu giờ đang đọc nói xong (henCauGio).
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

/** Bốn nhịp câu giờ khi đang chờ máy nhà — nói theo MOC_GIO_MS. */
export const CAU_GIO: readonly (readonly string[])[] = [
  ["Để Sen Biển hỏi thêm.", "Câu hay đó, để Sen Biển hỏi coi.", "Chờ Sen Biển chút xíu nghen.", "Để Sen Biển lục lại coi."],
  ["Sen Biển đang lục sổ, bác chờ chút.", "Đang hỏi rồi, sắp có bác ơi.", "Đợi xíu, câu này Sen Biển phải hỏi kỹ."],
  ["Sóng hơi yếu, chờ thêm xíu nữa nghen.", "Gần xong rồi, bác đừng đi đâu nha.", "Sắp có câu trả lời rồi bác."],
  ["Máy chủ đang nghĩ kỹ, bác chờ chút nữa thôi.", "Câu này khó nên lâu, Sen Biển vẫn đang đợi.", "Ráng chờ chút, sắp xong rồi bác."],
];
/*  Mốc nói từng nhịp (ms sau lúc bắt đầu hỏi). NHỊP ĐẦU KHÔNG NÓI NGAY (anh Long 2026-10-23: "chồng lấn giữa 2 câu,
    vừa nghe vừa nói ko mượt"): máy nhà thường trả lời < 1 s, nói câu giờ ngay rồi câu trả lời về CẮT ngang nó giữa chữ
    là đúng cái tiếng chồng bà con nghe. Nay chỉ mở lời khi đã chờ 1,2 s; các nhịp cách ~3 s cho câu giờ nói trọn.
    Trần chờ máy nhà là HOI_HAN_MS 12 s — nhịp cuối phải trước mốc đó. */
export const MOC_GIO_MS = [1_200, 4_000, 7_000, 10_000] as const;
/** Câu trả lời về khi câu giờ đang đọc ⇒ đợi nó nói XONG (không cắt giữa chữ), tối đa chừng này. */
export const DOI_CAU_GIO_MS = 2_500;

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
 * Hẹn câu giờ trong lúc chờ máy nhà. `noi(cau, xong)` đọc câu và gọi `xong` khi đọc hết / bị cắt (không gọi cũng
 * được — có trần DOI_CAU_GIO_MS). `conCho()` false (lượt mới) thì không nói.
 * Trả hàm KẾT THÚC: gọi khi có kết quả (kể cả trượt) — huỷ các nhịp chưa tới, rồi Promise xong khi câu giờ ĐANG ĐỌC
 * (nếu có) đọc hết, để câu trả lời nói tiếp sau nó chứ không đè lên nó.
 */
export function henCauGio(
  noi: (cau: string, xong: () => void) => void,
  conCho: () => boolean,
  doiToiDa: number = DOI_CAU_GIO_MS,
): () => Promise<void> {
  let dangDoc: Promise<void> | null = null;
  const hen = MOC_GIO_MS.map((ms, k) =>
    setTimeout(() => {
      if (!conCho()) return;
      dangDoc = new Promise<void>((xong) => noi(chonCau(CAU_GIO[k], `gio-${k}`), xong));
    }, ms),
  );
  return () => {
    hen.forEach(clearTimeout);
    if (!dangDoc) return Promise.resolve();
    let t: ReturnType<typeof setTimeout> | undefined;
    return Promise.race([dangDoc, new Promise<void>((r) => (t = setTimeout(r, doiToiDa)))]).finally(() => clearTimeout(t));
  };
}
