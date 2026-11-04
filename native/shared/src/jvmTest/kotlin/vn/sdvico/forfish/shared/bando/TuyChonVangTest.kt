package vn.sdvico.forfish.shared.bando

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import vn.sdvico.forfish.shared.kho.KhoTrongRam
import kotlin.test.Test
import kotlin.test.assertEquals

/*
  CỔNG KHỚP TuyChonBanDo ↔ map-prefs.ts (app-map 18 §5): mẫu do native/scripts/sinh-tuy-chon.mjs sinh bằng CHÍNH
  load() + setMapPrefs() của web — mỗi ca: giá trị đã lưu ⇒ chuỗi web ghi lại. Native phải ghi ra ĐÚNG chuỗi đó
  (cùng khoá, cùng thứ tự, cùng luật đọc) — lệch là bản Capacitor cũ chuyển sang mất lựa chọn của bà con.
*/
class TuyChonVangTest {
    @Test fun khopWebTungCa() {
        val ca = Json.parseToJsonElement(javaClass.getResource("/tuy-chon/vang.json")!!.readText()).jsonArray
        for (c in ca) {
            val o = c.jsonObject
            val vao = o.getValue("vao").let { if (it is JsonNull) null else it.jsonPrimitive.content }
            val mong = o.getValue("ghi").jsonPrimitive.content
            val kho = KhoTrongRam()
            vao?.let { kho.ghi(TuyChonBanDo.KHOA, it) }
            TuyChonBanDo.ghi(kho, TuyChonBanDo.doc(kho))
            assertEquals(mong, kho.doc(TuyChonBanDo.KHOA), "vào: $vao")
        }
    }
}
