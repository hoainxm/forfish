package vn.sdvico.forfish.shared.kho

/*
  CHUYỂN DỮ LIỆU TỪ BẢN CAPACITOR CŨ (ADR 0019 — mất sổ là mất an toàn ngoài biển, CLAUDE.md nguyên tắc 4).
  Bản native cập nhật ĐÈ bản Capacitor (cùng package / bundle id ở đợt 7). Lần mở đầu, mỗi nền đọc localStorage của
  WebView cũ (origin sdfish.sdvico.vn — mở trang trống ở origin đó, không cần mạng) rồi đưa dump vào đây.
  · Chỉ khoá `forfish.*` (đúng không gian tên của app), bỏ `forfish.native.*` (không thể có ở bản cũ).
  · KHÔNG đè khoá native đã có (native ghi sau = mới hơn).
  · Chạy MỘT lần: đánh dấu xong ⇒ lần sau bỏ qua. Ghi hỏng một khoá ⇒ KHÔNG đánh dấu, lần mở sau thử lại.
*/
object ChuyenKhoCu {
    data class KetQua(val daChep: Int, val boQua: Int, val loi: Int)

    fun canChuyen(kho: KhoMay): Boolean = kho.doc(KhoaMay.DA_CHUYEN_KHO_CU) == null

    fun chuyen(kho: KhoMay, dump: Map<String, String>, bayGio: Long): KetQua {
        var chep = 0
        var bo = 0
        var loi = 0
        for ((k, v) in dump) {
            if (!k.startsWith("forfish.") || k.startsWith("forfish.native.")) { bo++; continue }
            if (kho.doc(k) != null) { bo++; continue }
            if (kho.ghi(k, v)) chep++ else loi++
        }
        if (loi == 0) kho.ghi(KhoaMay.DA_CHUYEN_KHO_CU, "$bayGio:$chep")
        return KetQua(chep, bo, loi)
    }
}
