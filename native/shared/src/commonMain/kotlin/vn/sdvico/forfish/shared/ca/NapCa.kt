package vn.sdvico.forfish.shared.ca

import io.ktor.http.HttpMethod
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.api.PhanHoi
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.dulieu.KhoTep

/*
  NẠP BẢN ĐỒ CÁ (đợt 2e) = fetchFishForecast (src/lib/fish-predict.ts ~2267):
   · GET /api/fish-forecast (không tham số; middleware đòi tài khoản + gói), trần ngừng chảy 35 s (route lần lạnh ~30 s);
   · 401/403 ⇒ `Khong(code)` — mã từ thân hoặc mặc định login_required / premium_required. KHÔNG đụng bản lưu: có bản
     đã tải hợp lệ thì màn vẫn hiện được (`banLuu()`), chỉ khi không có gì mới mời đăng nhập/nâng cấp;
   · mã khác 2xx (500/503/429…) / mất sóng / thân hỏng ⇒ bản lưu gắn `tuKhoOffline` (web: lùi về banDoCaDaLuu), không
     có bản lưu ⇒ `Khong(null)` (fishFailNote(null) = "chưa tải được — chạm để thử lại");
   · 200 `{ok:true}` ⇒ lọc vùng biển VN (locBanDoCaTrongVung) rồi ghi kho; 200 mà `ok !== true` ⇒ `Khong(code thân)`.
  Kho: KhoTep, file tên = khoá web `forfish.fc.fish.latest` (FISH_NS/FISH_ID), nội dung `{"savedAt":…,"data":<bản đã
  lọc>}` y saveForecast. Đọc lại cũng lọc (bản lưu cũ trước 2026-10-29 có thể còn ô ngoài vùng).
  KHÁC web có chủ ý: web ghi đè MỌI lần nhận 200; native KHÔNG đè bản lưu MỚI HƠN bằng bản cũ hơn (isNewerGeneratedAt
  của bản lưu so với bản về — CDN/ISR trả bản cũ thì giữ bản mới, trả bản mới đó). Không có dấu `fishmark` riêng:
  `banLuu().savedAt` + `generatedAt` của bản là đủ cho bảng "trong máy có gì".
*/

/** Bản đồ cá trong máy + lúc ghi. */
data class BanLuuCa(val banDo: BanDoCa, val savedAt: Long)

sealed class KetQuaCa {
    /** `tuKhoOffline` = lấy từ kho (mạng hỏng), `savedAt` = lúc ghi bản đó (null = vừa tải) */
    data class Co(val banDo: BanDoCa, val tuKhoOffline: Boolean, val savedAt: Long? = null) : KetQuaCa()

    /** `ok:false` của web. code: login_required / no_token / premium_required / … ; null = lỗi tải chung */
    data class Khong(val code: String?) : KetQuaCa()
}

class NapCa(
    private val mayChu: MayChu,
    private val tep: KhoTep,
    /** epoch ms */
    private val bayGio: () -> Long,
) {
    companion object {
        const val DUONG = "/api/fish-forecast"
        const val HAN_MS = 35_000L
        /** = `forfish.fc.` + FISH_NS + "." + FISH_ID */
        const val TEN_TEP = "forfish.fc.fish.latest"
    }

    /** = banDoCaDaLuu: chỉ bản còn dùng được (`ok === true`), đã lọc vùng. */
    fun banLuu(): BanLuuCa? {
        val b = tep.doc(TEN_TEP) ?: return null
        val o = runCatching { Json.parseToJsonElement(b.decodeToString()) }.getOrNull() as? JsonObject ?: return null
        val at = Js.so(o["savedAt"])?.toLong() ?: 0L
        val d = DuBaoCa.giai(o["data"]) ?: return null
        return BanLuuCa(d, at)
    }

    private fun ghi(b: BanDoCa): Boolean =
        tep.ghi(TEN_TEP, "{\"savedAt\":${bayGio()},\"data\":${b.tho}}".encodeToByteArray())

    private fun lui(): KetQuaCa = banLuu()?.let { KetQuaCa.Co(it.banDo, tuKhoOffline = true, savedAt = it.savedAt) } ?: KetQuaCa.Khong(null)

    suspend fun lay(): KetQuaCa {
        val r = mayChu.goi(HttpMethod.Get, DUONG, hanMs = HAN_MS)
        if (r !is PhanHoi.CoTraLoi) return lui()
        if (r.ma == 401 || r.ma == 403) {
            val code = r.json()?.get("code")?.let { Js.chuoi(it) }
            return KetQuaCa.Khong(code ?: if (r.ma == 401) "login_required" else "premium_required")
        }
        if (!r.ok) return lui()
        // = `await r.json()` ném ⇒ lùi bản lưu. kotlinx nhận cả chữ trần (`<html>`) làm primitive — JSON.parse thì ném.
        val tho: JsonElement = runCatching { Json.parseToJsonElement(r.than) }.getOrNull()
            ?.takeIf { it !is JsonPrimitive || it.isString || it is JsonNull || it.booleanOrNull != null || it.doubleOrNull != null }
            ?: return lui()
        val d = DuBaoCa.giai(tho)
            ?: return KetQuaCa.Khong((tho as? JsonObject)?.get("code")?.takeIf { it !is JsonNull }?.let { Js.chuoi(it) })
        val cu = banLuu()
        if (cu != null && DuBaoCa.isNewerGeneratedAt(d.generatedAt, cu.banDo.generatedAt)) {
            return KetQuaCa.Co(cu.banDo, tuKhoOffline = false, savedAt = cu.savedAt)
        }
        ghi(d)
        return KetQuaCa.Co(d, tuKhoOffline = false)
    }
}
