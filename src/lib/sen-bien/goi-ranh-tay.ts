// SEN BIỂN — GỌI RẢNH TAY "Sen Biển ơi" (thuần, có test).
//
// Anh Long 2026-11-02 ("vượt qua Mimi"): Mimi gọi được bằng câu "Hey Mimi" nhưng nhận giọng
// cần mạng. Ngoài biển hai tay bận lái, mất sóng nhiều ngày ⇒ Sen Biển nghe liên tục bằng BỘ
// NGHE TRONG MÁY (nghe-may.ngheRanhTay — không gửi tiếng đi đâu), mỗi câu nghe được qua đây:
// mở đầu bằng "Sen Biển (ơi)" thì là gọi, phần còn lại (nếu có) là việc cần làm.
// Bộ nghe hay viết lệch tên gọi theo giọng miền ("Xen Biển", "Sen Biên", "Sên Biển") — nhận
// cả, nhưng CHỈ ở đầu câu: chuyện trò trong cabin có chữ "biển" không được thành lệnh.

import { foldVn } from "./ngram";

/** chữ chào/gọi có thể đứng trước tên */
const TRUOC = "(?:(?:e|nay|alo|a lo|oi|hey|hay|ay|ne) )?";
/** tên gọi + chữ gọi theo sau (đã bỏ dấu) */
const GOI = new RegExp(`^${TRUOC}(?:sen|xen|senh|xenh) (?:bien|bieng)(?: (?:oi|ai|a|ah|em|nhe|nha|o))*(?: |$)`);

/**
 * Câu nghe được → phần lệnh sau tên gọi ("" = chỉ gọi tên, chờ câu tiếp); null = không gọi Sen Biển.
 * Trả phần lệnh trên CHỮ GỐC (còn dấu) để hiểu ý so được có dấu.
 */
export function tachCauGoi(text: string): string | null {
  const goc = text.normalize("NFC").trim();
  const f = foldVn(goc);
  const m = GOI.exec(f);
  if (!m) return null;
  // số chữ của phần gọi ⇒ cắt đúng ngần ấy chữ khỏi câu gốc
  const soChu = m[0].trim().split(" ").length;
  const tuGoc = goc.split(/\s+/);
  return tuGoc
    .slice(soChu)
    .join(" ")
    .replace(/^[\s,.!?…:;-]+/, "")
    .trim();
}
