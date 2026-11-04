package vn.sdvico.forfish.shared.vai

import io.ktor.http.HttpMethod
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.api.PhanHoi
import vn.sdvico.forfish.shared.kho.KhoMay
import vn.sdvico.forfish.shared.kho.KhoaMay
import vn.sdvico.forfish.shared.sinh.NhanSinh

/*
  VAI + DOCK (= src/lib/vai.ts + dock-nav.ts, spec 17). Vai lưu MÁY (`forfish.vai.v1` {sdt, vai, cho, luc} — định dạng
  web), máy chủ là bản sao: dock vẽ đúng ngay lúc mở app kể cả mất sóng. Vector khớp web ở GoldenVaiDock.
*/
object Vai {
    val IDS: List<String> = NhanSinh.VAI.map { it.id }
    private val CAN_GOI_BAN_DO = setOf("ngu-dan", "thu-mua", "dai-ly")

    fun laVai(v: String?): Boolean = v != null && v in IDS

    fun coBanDo(vai: String?, premium: Boolean): Boolean = if (vai == null || vai !in CAN_GOI_BAN_DO) true else premium
}

data class OTaiDock(val id: String, val duong: String, val nhan: String)

object Dock {
    private val MUC = mapOf(
        "trang-chu" to OTaiDock("trang-chu", "/", NhanSinh.nhan("trangChu")),
        "kairos" to OTaiDock("kairos", "/kairos", NhanSinh.nhan("kairos")),
        "ban-do" to OTaiDock("ban-do", "/ngu-truong", NhanSinh.nhan("banDo")),
        "tau-toi" to OTaiDock("tau-toi", "/tau", NhanSinh.nhan("tauToi")),
        "viec-lam" to OTaiDock("viec-lam", "/viec", NhanSinh.nhan("viecLam")),
        "cho-ca" to OTaiDock("cho-ca", "/tien", NhanSinh.nhan("choCa")),
        "vat-tu" to OTaiDock("vat-tu", "/cho", NhanSinh.nhan("vatTu")),
        "ban-hang" to OTaiDock("ban-hang", "/ban-hang", NhanSinh.nhan("banHang")),
    )

    fun theoVai(vai: String?, banDo: Boolean): List<OTaiDock> {
        val ids = when (vai) {
            "ngu-dan" -> listOf("trang-chu", "kairos", "ban-do", "viec-lam", "cho-ca", "vat-tu")
            "thu-mua" -> listOf("trang-chu", "kairos", "ban-do", "cho-ca", "vat-tu")
            "dai-ly" -> listOf("trang-chu", "kairos", "ban-do", "ban-hang", "vat-tu")
            else -> listOf("trang-chu", "kairos", "ban-do", "tau-toi", "cho-ca", "vat-tu")
        }
        return ids.filter { it != "ban-do" || banDo }.map { id ->
            val m = MUC.getValue(id)
            if (vai == "thu-mua" && id == "cho-ca") m.copy(duong = "/tien?muc=tin") else m
        }
    }
}

/** Vai trong máy + đồng bộ máy chủ (/api/me/vai). */
class VaiMay(private val kho: KhoMay, private val mayChu: MayChu, private val dongHo: () -> Long) {
    data class Ban(val sdt: String, val vai: String?, val cho: Boolean, val luc: Long)

    fun doc(sdt: String?): Ban? {
        if (sdt == null) return null
        val o = try { Json.parseToJsonElement(kho.doc(KhoaMay.VAI) ?: return null).jsonObject } catch (_: Exception) { return null }
        if ((o["sdt"] as? JsonPrimitive)?.content != sdt) return null
        val v = (o["vai"] as? JsonPrimitive)?.takeIf { it.isString }?.content
        if (v != null && !Vai.laVai(v)) return null
        return Ban(sdt, v, (o["cho"] as? JsonPrimitive)?.content == "true", (o["luc"] as? JsonPrimitive)?.content?.toLongOrNull() ?: 0)
    }

    private fun ghi(b: Ban) = kho.ghi(KhoaMay.VAI, buildJsonObject {
        put("sdt", b.sdt)
        if (b.vai == null) put("vai", JsonNull) else put("vai", b.vai)
        put("cho", b.cho)
        put("luc", b.luc)
    }.toString())

    /** Hỏi máy chủ; bản máy đang chờ gửi (`cho`) thì KHÔNG đè (= nenNhanVaiMayChu) mà gửi lại. */
    suspend fun dongBo(sdt: String) {
        val may = doc(sdt)
        if (may?.cho == true && may.vai != null) { chon(sdt, may.vai); return }
        val r = mayChu.goi(HttpMethod.Get, "/api/me/vai") as? PhanHoi.CoTraLoi ?: return
        val o = r.json() ?: return
        if (o["ok"] != JsonPrimitive(true)) return
        val tuMayChu = (o["vai"] as? JsonPrimitive)?.takeIf { it.isString }?.content
        if (tuMayChu != null && !Vai.laVai(tuMayChu)) return
        if (may == null || may.vai != tuMayChu) ghi(Ban(sdt, tuMayChu, false, dongHo()))
    }

    /** Chọn vai: ghi máy NGAY (cho=true), gửi máy chủ; mất sóng thì nhịp sau gửi lại. 409 ⇒ trả mã lý do. */
    suspend fun chon(sdt: String, vai: String): String? {
        if (!Vai.laVai(vai)) return "vai_la"
        ghi(Ban(sdt, vai, true, dongHo()))
        val r = mayChu.goi(HttpMethod.Put, "/api/me/vai", buildJsonObject { put("vai", vai) }.toString()) as? PhanHoi.CoTraLoi
            ?: return null
        val o = r.json()
        if (r.ok && o?.get("ok") == JsonPrimitive(true)) {
            ghi(Ban(sdt, (o["vai"] as? JsonPrimitive)?.content ?: vai, false, dongHo()))
            return null
        }
        if (r.ma == 409) {
            // máy chủ giữ vai cũ (khoá vai) ⇒ bỏ lựa chọn chờ, hỏi lại vai thật
            kho.xoa(KhoaMay.VAI)
            dongBo(sdt)
            return (o?.get("code") as? JsonPrimitive)?.content ?: "da_co_vai"
        }
        return null
    }
}
