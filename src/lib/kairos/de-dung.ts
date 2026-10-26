// KAIROS DỄ DÙNG HƠN FACEBOOK — đợt 1 từ nghiên cứu hành vi FB (anh Long 2026-10-24: "thống kê các hành vi của user thường
// dùng trên facebook … rồi tổ chức áp vào làm tuần tự cho phía kairos đảm bảo phải đơn giản hơn hoặc thông minh hơn").
// THUẦN, có test (kairos-de-dung.test.ts). Báo cáo: docs/app-map/14-ba-spec-kairos.md §15.
//   · Nghe bài (việc 1): FB không đọc bài cho ai — tay ướt, nắng chói, mắt kém thì một chạm là nghe.
//   · Tự tắt ảnh khi mạng yếu (việc 3): FB bắt vào Cài đặt / cài FB Lite — Kairos tự đoán.
//   · Bình luận nhanh (việc 8): một chạm gửi câu có sẵn thay vì gõ bằng tay ướt.

/** Bài tối thiểu để đọc to. */
export interface BaiDoc {
  kind: string;
  outlet?: string | null;
  title?: string | null;
  summary?: string | null;
  body?: string | null;
  author?: { handle?: string } | null;
  topic?: string | null;
  publishedAt?: string | null;
}

/** Ngày ban hành đọc thành lời (giờ Việt Nam): "ban hành ngày 7 tháng 9 năm 2026". Hỏng ⇒ "". */
export function ngayBanHanhDoc(iso: string | null | undefined): string {
  const t = iso ? Date.parse(iso) : NaN;
  if (!Number.isFinite(t)) return "";
  const d = new Date(t + 7 * 3_600_000);
  return `ban hành ngày ${d.getUTCDate()} tháng ${d.getUTCMonth() + 1} năm ${d.getUTCFullYear()}`;
}

/** Đọc tối đa chừng này ký tự (bài dài thì đọc phần đầu — bấm Đọc bài gốc để đọc đủ). */
export const DOC_TOI_DA = 700;

/** Chữ để Sen Biển đọc to một bài: báo ⇒ tên báo + tiêu đề + tóm tắt; bài người ⇒ tên + nội dung. Rỗng ⇒ "". */
export function chuDeDoc(p: BaiDoc): string {
  const cat = (s: string) => {
    const t = s.replace(/\s+/g, " ").trim();
    if ([...t].length <= DOC_TOI_DA) return t;
    const cut = [...t].slice(0, DOC_TOI_DA).join("");
    const dau = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    return (dau > DOC_TOI_DA / 2 ? cut.slice(0, dau + 1) : cut).trim();
  };
  if (p.kind === "bao") {
    const tieuDe = p.title?.trim() ?? "";
    // tin chính sách: đọc NGÀY BAN HÀNH có năm — tiêu đề "đợt 05 năm 2025" mà không nghe năm ký thì tưởng tin cũ (2026-10-26)
    const ngay = p.topic === "chinh-sach" ? ngayBanHanhDoc(p.publishedAt) : "";
    const phan = [p.outlet ? `Tin ${p.outlet}${ngay ? `, ${ngay}` : ""}.` : ngay ? `${ngay[0].toUpperCase()}${ngay.slice(1)}.` : "", tieuDe && !/[.!?]$/.test(tieuDe) ? `${tieuDe}.` : tieuDe, p.summary ?? p.body ?? ""];
    return cat(phan.filter(Boolean).join(" "));
  }
  const body = (p.body ?? "").trim();
  if (!body) return "";
  const ten = p.author?.handle?.trim();
  return cat(ten ? `${ten} viết: ${body}` : body);
}

/** Một câu gửi máy nhà đọc tối đa chừng này ký tự (route /api/sen-bien/doc nhận ≤200). */
export const CAU_TOI_DA = 180;

/**
 * Chia chữ đọc thành từng câu cho giọng Mỹ Duyên online (mỗi câu một mp3). Cắt ở . ! ? … xuống dòng; câu quá dài cắt ở
 * dấu phẩy/chấm phẩy rồi khoảng trắng gần nhất trước trần. Không câu rỗng, giữ nguyên thứ tự và chữ.
 */
export function chiaCau(text: string, max = CAU_TOI_DA): string[] {
  const out: string[] = [];
  const tho = text.replace(/\s+/g, " ").trim().match(/[^.!?…]+[.!?…]+["”)]*\s*|[^.!?…]+$/g) ?? [];
  for (let c of tho) {
    c = c.trim();
    while ([...c].length > max) {
      const dau = [...c].slice(0, max).join("");
      let cat = Math.max(dau.lastIndexOf(", "), dau.lastIndexOf("; "), dau.lastIndexOf(": "));
      if (cat < max / 3) cat = dau.lastIndexOf(" ");
      if (cat < max / 3) cat = dau.length - 1;
      out.push(c.slice(0, cat + 1).trim());
      c = c.slice(cat + 1).trim();
    }
    if (c) out.push(c);
  }
  return out;
}

/** Thông tin mạng (navigator.connection — Chrome/Android; Safari không có ⇒ undefined). */
export interface KetNoi {
  saveData?: boolean;
  effectiveType?: string;
}

/**
 * Có nên HOÃN tải ảnh không (hiện khung "Chạm xem ảnh"): bật Tiết kiệm dữ liệu, hoặc mạng 2G/chậm hơn. Không biết
 * (trình duyệt không báo) ⇒ tải bình thường. 3G vẫn tải — ảnh kho đã nén ≤ 512 KB.
 */
export function nenHoanAnh(c: KetNoi | null | undefined): boolean {
  if (!c) return false;
  if (c.saveData === true) return true;
  return c.effectiveType === "slow-2g" || c.effectiveType === "2g";
}

/** Câu bình luận nhanh (≤ 2 chữ — luật nhãn nút) — một chạm là gửi. */
export const BL_NHANH = ["Cảm ơn", "Đúng rồi", "Hay quá", "Ở đâu?"] as const;
