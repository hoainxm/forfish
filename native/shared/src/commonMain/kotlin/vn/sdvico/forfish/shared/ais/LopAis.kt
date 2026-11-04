package vn.sdvico.forfish.shared.ais

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject

/*
  LỚP MAPLIBRE + ICON TÀU AIS cho nền (đợt 2e). Dữ liệu SINH từ web (native/scripts/sinh-ais.mjs ⇒ LopAisSinh.kt):
  spec lớp CHÉP Y JSX fishing-map-view.tsx, icon = lệnh Canvas 2D do CHÍNH dangKyIconTau (icon-tau.ts) phát ra — nền
  (Android Canvas / iOS CoreGraphics) phát lại y lệnh rồi addImage với pixelRatio kèm theo. Vẽ lúc chạy, không cần mạng.
  Phần ĐỘNG theo trạng thái màn hình (lọc nhóm "Toàn biển", làm mờ tàu khác khi xem vết) dựng ở đây, y biểu thức web.
  Thứ tự Source = thứ tự vẽ (sau cùng, trên mọi lớp hải đồ): ais-man → tau-ais → ais-vet → ais-radar → ais-quanh → ais-radar-tau.
*/
object LopAis {
    /** id Source theo thứ tự vẽ */
    val NGUON: List<String> = LopAisSinh.NGUON.map { it.first }

    /** Mảng lớp MapLibre (JSON) của một Source — lớp `tau-ais` dùng `lopTauAis` để có phần động. */
    fun lop(nguon: String): JsonArray = Json.parseToJsonElement(LopAisSinh.NGUON.first { it.first == nguon }.second).jsonArray

    /** Màn trắng mờ phủ cả thế giới khi bật chế độ AIS (Source `ais-man`, dữ liệu Feature Polygon). */
    const val AIS_MAN_GEO = LopAisSinh.AIS_MAN_GEO

    /**
     * Lớp `tau-ais-dot`: `nhom` (chế độ Toàn biển đang lọc một nhóm) ⇒ filter `["==",["get","nhom"],nhom]`;
     * `vetId` (đang xem đường đi một tàu) ⇒ tàu khác mờ 0,3.
     */
    fun lopTauAis(nhom: String?, vetId: String?): JsonArray {
        val goc = lop("tau-ais")[0].jsonObject
        val m = goc.toMutableMap()
        if (nhom != null) m["filter"] = mang("==", mang("get", "nhom"), nhom)
        if (vetId != null) {
            val paint = goc.getValue("paint").jsonObject.toMutableMap()
            paint["icon-opacity"] = mang("case", mang("==", mang("get", "id"), vetId), 1, 0.3)
            m["paint"] = JsonObject(paint)
        }
        return JsonArray(listOf(JsonObject(m)))
    }

    private fun mang(vararg x: Any): JsonArray = JsonArray(x.map {
        when (it) {
            is JsonElement -> it
            is String -> JsonPrimitive(it)
            is Number -> JsonPrimitive(it)
            else -> error("kiểu lạ")
        }
    })

    /** Một ảnh icon: tên (ais-<mk>-chay|dung, ais-chon), cỡ PIXEL thật (đã nhân pixelRatio), lệnh Canvas 2D. */
    data class AnhIcon(val ten: String, val pixelRatio: Double, val rong: Int, val cao: Int, val lenh: List<List<JsonElement>>)

    val ICON: List<AnhIcon> by lazy {
        Json.parseToJsonElement(LopAisSinh.ICON).jsonArray.map { e ->
            val o = e.jsonObject
            AnhIcon(
                (o.getValue("ten") as JsonPrimitive).content,
                (o.getValue("pixelRatio") as JsonPrimitive).content.toDouble(),
                (o.getValue("rong") as JsonPrimitive).content.toInt(),
                (o.getValue("cao") as JsonPrimitive).content.toInt(),
                o.getValue("lenh").jsonArray.map { it.jsonArray.toList() },
            )
        }
    }

    /** Khoá màu icon (MAU_ICON_TAU web = MAU_TAU + MAU_MUC) */
    val MAU_ICON_TAU: Map<String, String> get() = LopAisSinh.MAU_TAU + LopAisSinh.MAU_MUC

    /** Tên ảnh icon cho một feature: `ais-<mk>-chay|dung` (= biểu thức icon-image của lớp). */
    fun tenIcon(mk: String, chay: Boolean) = "ais-$mk-${if (chay) "chay" else "dung"}"
}
