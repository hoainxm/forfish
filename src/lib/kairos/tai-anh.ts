// TẢI MỘT ẢNH VỀ MÁY — dùng chung cho bảng Chia sẻ (share-sheet "Tải ảnh") và trình xem ảnh toàn màn
// (xem-anh). Chỉ chạy khi bà con BẤM; có đồng hồ 30 s, mọi lỗi (mất sóng, máy chủ ảnh từ chối, trình
// duyệt chặn) ⇒ trả false để bên gọi báo và mở ảnh ở tab mới. KHÔNG ném.

import { timeoutSignal } from "@/lib/abort";

export async function downloadOne(url: string, name: string): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: timeoutSignal(30_000) });
    if (!r.ok) return false;
    const blob = await r.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return true;
  } catch {
    return false;
  }
}
