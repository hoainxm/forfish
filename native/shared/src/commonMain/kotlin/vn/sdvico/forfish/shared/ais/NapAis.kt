package vn.sdvico.forfish.shared.ais

import io.ktor.http.HttpMethod
import kotlinx.coroutines.delay
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.api.PhanHoi
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.dulieu.KhoTep
import vn.sdvico.forfish.shared.kho.KhoMay
import kotlin.math.floor

/*
  TẢI TÀU AIS (đợt 2e) — y luật web:
   · bản tin GET /api/tau-ais (= fetchTauAis): trần 12 s; 200 + hợp lệ ⇒ GHI kho rồi dùng; còn lại (mất sóng, 5xx,
     403 `ais_off`, thân hỏng) ⇒ bản lưu `forfish.tau-ais.v1` (`tuKho`). Bản ~700 KB ⇒ file KhoTep, không KhoMay.
     Khác web (có chủ ý): 403 `ais_off` được BÁO RA (`aisOff`) để UI nói "tài khoản chưa bật AIS" thay vì "mất sóng".
     Làm mới mỗi AisTau.LAM_MOI_MS khi lớp còn bật — nền hẹn giờ (web: setInterval ở fishing-map-view).
   · vết 7 ngày /api/tau-ais/vet?id= (= fetchVetTau): chỉ tàu mã cố định; nhớ tạm 10 phút trong RAM (≤ 50 tàu rồi xoá
     sạch — không ghi kho: xem lướt nhiều tàu là đầy kho); hỏng mà còn bản nhớ (kể cả quá 10 phút) ⇒ bản nhớ, không ⇒
     `mat_song`.
   · tàu quanh điểm /api/tau-ais/quanh?lat&lon (= fetchTauQuanh): toạ độ tròn 0,001°; hỏng ⇒ tự gộp từ bản lưu
     (`chiBan`, `tuMay`); không bản nào ⇒ null.
   · quyền /api/tau-ais/quyen (= fetchQuyenAis + effect fishing-map-view ~888): trần 8 s; trả lời được ⇒ nhớ theo SĐT ở
     `forfish.tau-ais.quyen.v1` (KhoMay, y định dạng web {phone, ais}); mất sóng/lỗi ⇒ null (giữ kết quả đã nhớ, không
     tự tắt nút giữa biển); `hoiQuyenThuLai` hỏi tối đa 3 lần cách 5 s.
  Trần giờ = `hanMs` của MayChu (trần NGỪNG CHẢY như NapDiem) — web là trần tổng (AbortSignal.timeout).
*/
sealed class KetQuaBanAis {
    data class Co(val ban: TauAisBan, val tuKho: Boolean, val aisOff: Boolean = false) : KetQuaBanAis()
    /** `chua_co_ban_tau` | `ais_off` (403, máy chưa có bản nào) */
    data class Khong(val ly: String) : KetQuaBanAis()
}

class NapAis(
    private val mayChu: MayChu,
    private val tep: KhoTep,
    private val kho: KhoMay,
    private val bayGio: () -> Long,
    /** chờ giữa hai lượt hỏi quyền — test thay bằng hàm không chờ */
    private val cho: suspend (Long) -> Unit = { delay(it) },
) {
    companion object {
        const val HET_GIO_MS = 12_000L
        const val QUYEN_HET_GIO_MS = 8_000L
        const val KHOA_QUYEN = "forfish.tau-ais.quyen.v1"
        const val VET_NHO_MS = 10 * 60_000L
        const val VET_NHO_TOI_DA = 50
        const val QUYEN_SO_LAN = 3
        const val QUYEN_CACH_MS = 5_000L

        /** = encodeURIComponent */
        fun maHoaUrl(s: String): String {
            val b = StringBuilder()
            for (byte in s.encodeToByteArray()) {
                val c = byte.toInt() and 0xff
                val ch = c.toChar()
                if (c < 0x80 && (ch.isLetterOrDigit() || ch in "-_.!~*'()")) b.append(ch)
                else b.append('%').append("0123456789ABCDEF"[c shr 4]).append("0123456789ABCDEF"[c and 15])
            }
            return b.toString()
        }
    }

    private fun docJson(s: String): JsonElement? = runCatching { Json.parseToJsonElement(s) }.getOrNull()

    /* ── bản tin ── */

    /** = peekTauAis: bản máy đã lưu, null khi chưa có/hỏng. */
    fun banLuu(): TauAisBan? = tep.doc(AisTau.KHOA_BAN)?.let { AisTau.giaiBan(docJson(it.decodeToString())) }

    /** = fetchTauAis: mạng trước, bản máy sau. */
    suspend fun layBan(): KetQuaBanAis {
        var aisOff = false
        val p = mayChu.goi(HttpMethod.Get, "/api/tau-ais", hanMs = HET_GIO_MS)
        if (p is PhanHoi.CoTraLoi) {
            if (p.ok) {
                val ban = AisTau.giaiBan(docJson(p.than))
                if (ban != null) {
                    tep.ghi(AisTau.KHOA_BAN, p.than.encodeToByteArray()) // kho đầy/hỏng: bản mới vẫn dùng, chỉ không giữ qua lần mở sau
                    return KetQuaBanAis.Co(ban, tuKho = false)
                }
            } else if (p.ma == 403 && (p.json()?.get("code") as? JsonPrimitive)?.content == "ais_off") {
                aisOff = true
            }
        }
        val cu = banLuu() ?: return KetQuaBanAis.Khong(if (aisOff) "ais_off" else "chua_co_ban_tau")
        return KetQuaBanAis.Co(cu, tuKho = true, aisOff = aisOff)
    }

    /* ── quyền ── */

    /** = peekQuyenAis: kết quả đã nhớ cho ĐÚNG SĐT này; null khi chưa từng hỏi được / của tài khoản khác. */
    fun peekQuyen(phone: String): Boolean? {
        val o = kho.doc(KHOA_QUYEN)?.let { docJson(it) } as? JsonObject ?: return null
        if (Js.chuoi(o["phone"]) != phone) return null
        val a = o["ais"] as? JsonPrimitive ?: return null
        return if (a.isString) null else a.booleanOrNull
    }

    /** = fetchQuyenAis: true/false khi máy chủ trả lời được (và nhớ); null khi mất sóng / lỗi / chưa đăng nhập. */
    suspend fun hoiQuyen(phone: String): Boolean? {
        val p = mayChu.goi(HttpMethod.Get, "/api/tau-ais/quyen", hanMs = QUYEN_HET_GIO_MS) as? PhanHoi.CoTraLoi ?: return null
        if (!p.ok) return null
        val j = p.json() ?: return null
        if (!QuanhTau.okTrue(j)) return null
        val a = (j["ais"] as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull ?: return null
        val s = StringBuilder("{\"phone\":")
        Js.jsonChuoi(phone, s)
        s.append(",\"ais\":").append(a).append('}')
        kho.ghi(KHOA_QUYEN, s.toString()) // kho từ chối: lần này vẫn đúng, chỉ không nhớ qua lần mở sau
        return a
    }

    /** Hỏi hỏng (vừa đăng nhập, mạng chậm) ⇒ hỏi lại, tối đa QUYEN_SO_LAN lượt cách QUYEN_CACH_MS. null = cả 3 hỏng. */
    suspend fun hoiQuyenThuLai(phone: String): Boolean? {
        repeat(QUYEN_SO_LAN) { i ->
            if (i > 0) cho(QUYEN_CACH_MS)
            hoiQuyen(phone)?.let { return it }
        }
        return null
    }

    /* ── vết 7 ngày ── */

    private class Nho(val luc: Long, val diem: List<DiemVet>)
    private val vetNho = LinkedHashMap<String, Nho>()

    /** = fetchVetTau */
    suspend fun layVet(id: String, now: Long = bayGio()): KetQuaVet {
        if (!AisTau.idCoDinh(id)) return KetQuaVet.Khong("khong_theo_duoc")
        val nho = vetNho[id]
        if (nho != null && now - nho.luc < VET_NHO_MS) return KetQuaVet.Co(nho.diem)
        val p = mayChu.goi(HttpMethod.Get, "/api/tau-ais/vet?id=${maHoaUrl(id)}", hanMs = HET_GIO_MS)
        if (p is PhanHoi.CoTraLoi && p.ok) {
            val diem = AisTau.giaiVet(docJson(p.than))
            if (diem != null) {
                if (vetNho.size > VET_NHO_TOI_DA) vetNho.clear()
                vetNho[id] = Nho(now, diem)
                return KetQuaVet.Co(diem)
            }
        }
        return if (nho != null) KetQuaVet.Co(nho.diem) else KetQuaVet.Khong("mat_song")
    }

    /* ── tàu quanh điểm ── */

    /** = fetchTauQuanh */
    suspend fun layQuanh(tam: LatLon, nowMs: Long = bayGio()): KetQuaQuanh? {
        val lat = Js.round(tam.lat * 1000) / 1000
        val lon = Js.round(tam.lon * 1000) / 1000
        val t = LatLon(lat, lon)
        val p = mayChu.goi(HttpMethod.Get, "/api/tau-ais/quanh?lat=${Js.inSo(lat)}&lon=${Js.inSo(lon)}", hanMs = HET_GIO_MS)
        if (p is PhanHoi.CoTraLoi && p.ok) {
            val j = docJson(p.than) as? JsonObject
            val ds = j?.get("tau") as? JsonArray
            if (QuanhTau.okTrue(j) && ds != null) {
                return KetQuaQuanh(t, Js.chuoi(j["luc"]), ds.mapNotNull { QuanhTau.giaiTauQuanh(it) }, (j["chiBan"] as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull == true, false)
            }
        }
        val ban = banLuu() ?: return null
        val tuGiay = floor(nowMs / 1000.0) - QuanhTau.QUANH_GIO * 3600
        return KetQuaQuanh(t, ban.luc, QuanhTau.gopTauQuanh(emptyList(), ban, t, tuGiay), chiBan = true, tuMay = true)
    }
}
