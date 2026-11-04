package vn.sdvico.forfish.shared.ca

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/* Cổng khớp regionAt + fishInRegion (tháng 11) với web — mẫu do native/scripts/sinh-loai.mjs chạy chính fish-seasons.ts. */
class LoaiCaVangTest {
    @Test fun vungVaLoaiDangVuYWeb() {
        val mau = Json.parseToJsonElement(javaClass.getResource("/ca/vung.json")!!.readText()).jsonArray
        assertTrue(mau.size > 100)
        var coVung = 0
        for (e in mau) {
            val a = e.jsonArray
            val lat = a[0].jsonPrimitive.double
            val lon = a[1].jsonPrimitive.double
            val id = a[2].takeIf { it !is JsonNull }?.jsonPrimitive?.content
            assertEquals(id, DanhMucCa.vungTai(lat, lon)?.id, "$lat,$lon")
            if (id != null) {
                coVung++
                assertEquals(a[3].jsonArray.map { it.jsonPrimitive.content }.toSet(), DanhMucCa.dangVu(lat, lon, 11), "$lat,$lon")
            }
        }
        assertTrue(coVung > 20, "mẫu phải có đủ điểm trong vùng")
    }

    @Test fun danhMucDu() {
        assertEquals(38, DanhMucCa.LOAI.size)
        assertTrue(DanhMucCa.LOAI.all { Regex("^#[0-9a-fA-F]{6}$").matches(it.mauHex) })
        assertEquals(DanhMucCa.NHOM_THU_TU.toSet(), DanhMucCa.NHOM_NHAN.keys)
        assertEquals(4, DanhMucCa.NGHE.size)
        assertEquals("Ngừ vằn", DanhMucCa.hoaDau("ngừ vằn"))
    }
}
