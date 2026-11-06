package vn.sdvico.forfish.shared.ca

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.double

/*
  DANH MỤC LOÀI cho bộ chọn loài + vùng mùa vụ (đợt 2e) — đọc bảng SINH từ web (LoaiCaSinh, native/scripts/sinh-loai.mjs).
  `vungTai` = regionAt (fish-seasons.ts ~661, ray casting y web: điểm trên cạnh có thể ra ngoài như web);
  `dangVu` = regionShorts của fishing-map-view (~5984): loài khai mùa ở vùng đang xem trong tháng này.
*/
data class LoaiCa(val short: String, val full: String, val nhom: String, val mauHex: String)
data class NgheCa(val id: String, val nhan: String)
data class VungCa(val id: String, val ten: String, val da: List<Pair<Double, Double>>, val thang: Map<Int, List<String>>)

object DanhMucCa {
    val LOAI: List<LoaiCa> = Json.parseToJsonElement(LoaiCaSinh.LOAI).jsonArray.map {
        val o = it.jsonObject
        LoaiCa(o.getValue("short").jsonPrimitive.content, o.getValue("full").jsonPrimitive.content, o.getValue("nhom").jsonPrimitive.content, o.getValue("mau").jsonPrimitive.content)
    }
    val THEO_SHORT: Map<String, LoaiCa> = LOAI.associateBy { it.short }
    val NHOM_NHAN: Map<String, String> = Json.parseToJsonElement(LoaiCaSinh.NHOM_NHAN).jsonObject.mapValues { it.value.jsonPrimitive.content }
    val NHOM_THU_TU: List<String> = Json.parseToJsonElement(LoaiCaSinh.NHOM_THU_TU).jsonArray.map { it.jsonPrimitive.content }
    val NGHE: List<NgheCa> = Json.parseToJsonElement(LoaiCaSinh.NGHE).jsonArray.map {
        NgheCa(it.jsonObject.getValue("id").jsonPrimitive.content, it.jsonObject.getValue("nhan").jsonPrimitive.content)
    }
    const val GOI_Y_TOI_DA = LoaiCaSinh.GOI_Y_TOI_DA
    val VUNG: List<VungCa> = Json.parseToJsonElement(LoaiCaSinh.VUNG).jsonArray.map { e ->
        val o = e.jsonObject
        VungCa(
            o.getValue("id").jsonPrimitive.content, o.getValue("ten").jsonPrimitive.content,
            o.getValue("da").jsonArray.map { p -> (p as JsonArray).let { it[0].jsonPrimitive.double to it[1].jsonPrimitive.double } },
            o.getValue("thang").jsonObject.entries.associate { (k, v) -> k.toInt() to v.jsonArray.map { it.jsonPrimitive.content } },
        )
    }

    /** = pointInPolygon (x = lon, y = lat) — cùng phép so, cùng thứ tự. */
    private fun trongDa(x: Double, y: Double, da: List<Pair<Double, Double>>): Boolean {
        var trong = false
        var j = da.size - 1
        for (i in da.indices) {
            val (xi, yi) = da[i]
            val (xj, yj) = da[j]
            if ((yi > y) != (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) trong = !trong
            j = i
        }
        return trong
    }

    /** = regionAt: vùng đầu tiên chứa điểm, null nếu ngoài mọi vùng. */
    fun vungTai(lat: Double, lon: Double): VungCa? = VUNG.firstOrNull { trongDa(lon, lat, it.da) }

    /** = regionShorts: loài đang vụ ở vùng chứa điểm trong `thang` (1–12). */
    fun dangVu(lat: Double, lon: Double, thang: Int): Set<String> = vungTai(lat, lon)?.thang?.get(thang)?.toSet() ?: emptySet()

    /** = cap(): "ngừ vằn" ⇒ "Ngừ vằn" (chip hẹp). */
    fun hoaDau(t: String) = t.replaceFirstChar { it.uppercase() }
}
