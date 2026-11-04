package vn.sdvico.forfish.shared.dulieu

import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.kho.KhoMay
import vn.sdvico.forfish.shared.taikhoan.KhoaDuLieu

/*
  TẢI FILE DỮ LIỆU BẢN ĐỒ (= fetchDataBytes + service worker của web, bản native — ADR 0019, app-map 18 đợt 2).
  · Tải `/data/<tên>` kèm chuỗi (dataGate: lớp bản đồ cần chuỗi, lớp gói cần premium) ⇒ giải SDF1/SDF2 bằng khoá đã xin
    ⇒ cất BẢN RÕ vào thư mục riêng của app. MapLibre đọc thẳng file (pmtiles://file://, GeoJSON) — không cầu protocol.
  · Web có luật "đổi nội dung thì ĐÈ cùng đường dẫn" (CLAUDE.md dữ liệu bản đồ #1) ⇒ hỏi lại bằng ETag (If-None-Match).
  · MẤT SÓNG / LỖI / THIẾU KHOÁ ⇒ dùng bản đã cất nếu có; KHÔNG BAO GIỜ xoá bản cũ vì một lượt tải hỏng (CLAUDE.md offline (c)).
*/
interface KhoTep {
    /** Đường dẫn tuyệt đối của file trong thư mục dữ liệu app. */
    fun duong(ten: String): String
    fun co(ten: String): Boolean
    /** Ghi NGUYÊN TỬ (file tạm rồi đổi tên) — ghi hỏng giữa chừng không làm hỏng bản cũ. */
    fun ghi(ten: String, byte: ByteArray): Boolean
    fun doc(ten: String): ByteArray?
}

sealed class KetQuaTai {
    /** `moi` = vừa tải bản mới; false = dùng bản đã cất (304 hoặc mất sóng). */
    data class Co(val duong: String, val moi: Boolean) : KetQuaTai()
    /** chưa từng có bản nào trong máy + lượt này không tải được */
    data class Khong(val lyDo: String) : KetQuaTai()
}

class TaiDuLieu(
    private val mayChu: MayChu,
    private val khoa: KhoaDuLieu,
    private val tep: KhoTep,
    private val kho: KhoMay,
) {
    private fun khoaEtag(ten: String) = "forfish.native.tep.$ten"

    fun daCo(ten: String): String? = if (tep.co(ten)) tep.duong(ten) else null

    /** `ten` = tên file trong /data (vd "vn-basemap.pmtiles"). */
    suspend fun lay(ten: String): KetQuaTai {
        val cu = daCo(ten)
        val r = mayChu.taiByte("/data/$ten", if (cu != null) kho.doc(khoaEtag(ten)) else null)
        if (r !is MayChu.TaiByte.Co) return cu?.let { KetQuaTai.Co(it, false) } ?: KetQuaTai.Khong("mat_song")
        if (r.ma == 304 && cu != null) return KetQuaTai.Co(cu, false)
        if (r.ma != 200) return cu?.let { KetQuaTai.Co(it, false) } ?: KetQuaTai.Khong("http_${r.ma}")
        val ro = try {
            DataCrypt.moFile(r.than) { id -> khoa.layKhoa(id) }
        } catch (e: KhongCoKhoa) {
            // khoá đổi (admin xoay khoá) ⇒ xin lại một lần rồi giải lại
            if (khoa.xin()) runCatching { DataCrypt.moFile(r.than) { id -> khoa.layKhoa(id) } }.getOrNull() else null
        } catch (_: Exception) {
            null
        } ?: return cu?.let { KetQuaTai.Co(it, false) } ?: KetQuaTai.Khong("khong_giai_duoc")
        if (!tep.ghi(ten, ro)) return cu?.let { KetQuaTai.Co(it, false) } ?: KetQuaTai.Khong("ghi_hong")
        r.etag?.let { kho.ghi(khoaEtag(ten), it) }
        return KetQuaTai.Co(tep.duong(ten), true)
    }
}
