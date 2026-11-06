package vn.sdvico.forfish.shared.danduong

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import vn.sdvico.forfish.shared.ais.AisJs
import vn.sdvico.forfish.shared.bando.BaoHieu
import vn.sdvico.forfish.shared.bando.ConNuoc
import vn.sdvico.forfish.shared.bando.HaiDo
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.bando.TramConNuoc
import vn.sdvico.forfish.shared.thoitiet.TheDiem
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/*
  HẬU KIỂM TUYẾN + CÂU CẢNH BÁO — port y:
    · route-hazards.ts auditRoute (~385) + khoangCachText: hiểm hoạ chặn / xác tàu qua được / cấm vào (đa giác + ranh hở) /
      cáp-ống / cấm neo-hạn chế / số đo sâu + luồng (khi biết mớn, kèm con nước tại ETA) / phao-tiêu-đèn hành lang 1 km /
      ranh giới VMS / con nước hai đầu — mỗi vật một dòng, sắp theo thứ tự gặp;
    · route-danger-items.ts (buildDangerItems, buildWillMeet, moTaThieu);
    · geofence.ts borderProximity (chỉ ba trường hậu kiểm đọc: applies/outside/distanceNm);
    · seamarks.ts seamarkLabel/colourLabel/describeLight/describeSeamark/huongDiQuaPhao (bên luồng dùng lại BaoHieu.kt);
    · tides.ts nearestTideStation/tideClockText/tideUpcoming/tideTrendText (mực nước dùng ConNuoc.kt);
    · bộ giải soundings.ts (qua HaiDo.giaiDiemSau) / soundings-verified.ts (HaiDo.giaiDoiChieu) / fairway-depth.ts.
*/

/** = Sounding (phần hậu kiểm dùng). */
class SoDoSau(val lat: Double, val lon: Double, val depthM: Double, val at: String)

/** = FairwayDepth (phần hậu kiểm dùng). */
class DoanLuongTuyen(val tu: Diem, val den: Diem, val sauM: Double, val xapXi: Boolean, val at: String, val ten: String, val tenTuyen: String?)

/** = RouteHit. `muc`: "do" | "vang" | "tin". */
data class VatTrenTuyen(
    val id: String, val loai: String, val ten: String?, val km: Double, val alongKm: Double, val muc: String, val cau: String, val etaH: Double?,
)

/** = RouteAuditStores — null = kho thiếu (ghi `missing`). `border`: true soi · false cố ý tắt · null thiếu. */
class KhoHauKiem(
    val hazards: List<HiemHoaDiem>? = null,
    val passable: List<HiemHoaDiem>? = null,
    val soundings: List<SoDoSau>? = null,
    val verdicts: Map<String, String>? = null,
    val fairways: List<DoanLuongTuyen>? = null,
    val lanes: List<DacTrung>? = null,
    val seamarks: List<BaoHieuTuyen>? = null,
    val vnAids: List<BaoHieuTuyen>? = null,
    val reefs: List<DacTrung>? = null,
    val tides: List<TramConNuoc>? = null,
    val border: Boolean? = null,
    val nguonBien: NguonBien = NguonBien.MAC_DINH,
)

/** = BorderSource: đường biên ngoài khơi [lon, lat] + đa giác vùng được phép. */
class NguonBien(val line: Vong, val polys: List<List<Vong>>) {
    companion object {
        /** = STATIC_BORDER_SOURCE (src/data/vms-zones.json qua BienSinh.kt) */
        val MAC_DINH: NguonBien by lazy {
            val line = (Json.parseToJsonElement(BienSinh.LINE) as JsonArray).map { c -> (c as JsonArray).let { doubleArrayOf(Js.so(it[0])!!, Js.so(it[1])!!) } }
            val polys = (Json.parseToJsonElement(BienSinh.POLYS) as JsonArray).map { p ->
                (p as JsonArray).map { r -> (r as JsonArray).map { c -> (c as JsonArray).let { doubleArrayOf(Js.so(it[0])!!, Js.so(it[1])!!) } } }
            }
            NguonBien(line, polys)
        }
    }
}

/** = DangerItem */
data class MucCanhBao(val key: String, val label: String, val text: String, val danger: Boolean)

object HauKiem {
    private const val HAZARD_DO_PAD_KM = 0.5
    private const val HAZARD_VANG_PAD_KM = 1.0
    private const val HAZARD_TIN_PAD_KM = 2.0
    private const val PASSABLE_TIN_KM = 1.0
    private const val NO_GO_LINE_KM = 0.5
    private const val RESTRICT_LINE_KM = 0.3
    private const val CABLE_CROSS_KM = 0.1
    private const val SOUNDING_KM = 0.5
    private const val FAIRWAY_KM = 0.5
    private const val REEF_NAME_KM = 3.0
    private const val AID_CORRIDOR_KM = 1.0
    private const val AID_MAX_LINES = 8
    private const val BORDER_STEP_KM = 5.0
    private const val BORDER_DO_NM = 6.0
    private const val TIDE_MAX_KM = 120.0
    private const val SAMPLE_KM = 0.5
    private const val NM_KM = 1.852

    private fun soViet(v: Double, le: Int = 1): String {
        var k = 1.0
        repeat(le) { k *= 10 }
        return Js.inSo(Js.round(v * k) / k).replaceFirst(".", ",")
    }

    /** = khoangCachText: < 1 km nói mét (tròn 50), xa hơn nói hải lý. */
    fun khoangCachText(km: Double): String {
        if (!km.isFinite() || km < 0) return ""
        if (km < 0.975) return "${Js.inSo(max(50.0, Js.round((km * 1000) / 50) * 50))} m"
        val nm = km / NM_KM
        return if (nm < 10) "${soViet(nm)} hải lý" else "${Js.inSo(Js.round(nm))} hải lý"
    }

    private val THANG_NAM = Regex("^([0-9]{4})-([0-9]{2})")
    private fun thangNam(iso: String?): String {
        val m = THANG_NAM.find(iso ?: "") ?: return ""
        return "${m.groupValues[2].toInt()}/${m.groupValues[1]}"
    }

    private fun rankMuc(m: String) = when (m) { "do" -> 3; "vang" -> 2; else -> 1 }

    /* ── bộ giải kho hậu kiểm ── */

    /** = decodeSoundings (qua HaiDo.giaiDiemSau — cùng thứ tự ⇒ cùng chỉ số `sd:i` / khoá đối chiếu). */
    fun giaiSoDoSau(raw: JsonElement?): List<SoDoSau> = HaiDo.giaiDiemSau(raw).map { SoDoSau(it.lat, it.lon, it.sauM, it.ngay) }

    /** = decodeVerdicts → khoá "tep:loai:i" ⇒ kq. */
    fun giaiDoiChieu(raw: JsonElement?): Map<String, String> = HaiDo.giaiDoiChieu(raw)

    private fun thongBaoNgay(n: JsonElement?): String? {
        val o = n as? JsonObject ?: return null
        val ngay = Js.chuoi(o["ngay"]) ?: return null
        return if (Js.dung(o["prov"])) ngay else null
    }

    /** = decodeFairwayDepths */
    fun giaiLuong(raw: JsonElement?): List<DoanLuongTuyen> {
        val f = raw as? JsonObject ?: return emptyList()
        val doan = f["doan"] as? JsonArray ?: return emptyList()
        val routes = f["tuyen"] as? JsonArray
        val notices = f["thongBao"] as? JsonArray
        val ra = mutableListOf<DoanLuongTuyen>()
        for (row in doan) {
            if (row !is JsonArray || row.size < 9) continue
            val route = Js.tra(routes, row[0])
            if (!Js.dung(route)) continue
            val ngay = thongBaoNgay(Js.tra(notices, row[1])) ?: continue
            val lon1 = Js.so(row[4])?.takeIf { it.isFinite() } ?: continue
            val lat1 = Js.so(row[5])?.takeIf { it.isFinite() } ?: continue
            val lon2 = Js.so(row[6])?.takeIf { it.isFinite() } ?: continue
            val lat2 = Js.so(row[7])?.takeIf { it.isFinite() } ?: continue
            val sauM = Js.Number(row[2]) / 10
            if (!sauM.isFinite() || sauM < -2 || sauM > 30) continue
            val tu = Diem(lat1, lon1)
            val den = Diem(lat2, lon2)
            val daiKm = HinhHoc.haversineKm(tu, den)
            if (!(daiKm.isFinite() && daiKm >= 0.05 && daiKm <= 25)) continue
            ra += DoanLuongTuyen(tu, den, Js.round(sauM * 10) / 10, Js.so(row[3]) == 1.0, ngay, Js.chuoi(row[8]) ?: "",
                Js.chuoi((route as? JsonObject)?.get("ten")))
        }
        return ra
    }

    /** = nearestNamedPoint (sea-lanes.ts) */
    fun nearestNamedPoint(features: List<DacTrung>?, p: Diem, maxKm: Double): Pair<String, String?>? {
        if (features == null) return null
        val pad = maxKm / 100
        val cosLat = Tg.cos((p.lat * PI) / 180)
        var best: Pair<String, String?>? = null
        var bestKm = maxKm
        for (f in features) {
            if (f.hinh != "Point") continue
            val c = f.toaDo as? JsonArray ?: continue
            val lon = Js.so(c.getOrNull(0))?.takeIf { it.isFinite() } ?: continue
            val lat = Js.so(c.getOrNull(1))?.takeIf { it.isFinite() } ?: continue
            if (abs(lat - p.lat) > pad || abs(lon - p.lon) > pad / max(cosLat, 0.1)) continue
            val name = f.chuoi("name")?.takeIf { it.isNotEmpty() } ?: continue
            val km = HinhHoc.haversineKm(p.lat, p.lon, lat, lon)
            if (km < bestKm) { bestKm = km; best = name to f.chuoi("type") }
        }
        return best
    }

    /* ── báo hiệu: câu chữ ── */

    private val SEAMARK_LABEL = mapOf(
        "buoy_lateral" to "Phao luồng", "buoy_cardinal" to "Phao báo hướng an toàn", "buoy_safe_water" to "Phao giữa luồng, nước sâu an toàn",
        "buoy_special_purpose" to "Phao chuyên dùng", "buoy_isolated_danger" to "Phao báo chỗ nguy hiểm", "buoy_installation" to "Phao neo công trình",
        "beacon" to "Tiêu báo hiệu", "beacon_lateral" to "Tiêu báo mép luồng", "beacon_cardinal" to "Tiêu báo hướng an toàn",
        "beacon_safe_water" to "Tiêu giữa luồng, nước sâu an toàn", "beacon_special_purpose" to "Tiêu chuyên dùng",
        "beacon_isolated_danger" to "Tiêu báo chỗ nguy hiểm", "light" to "Đèn báo hiệu", "light_major" to "Đèn biển lớn",
        "light_minor" to "Đèn báo hiệu nhỏ", "light_vessel" to "Tàu đèn neo cố định", "light_float" to "Phao đèn",
        "virtual_aton" to "Phao ảo, chỉ máy thấy", "landmark" to "Mốc trên bờ có đèn", "anchorage" to "Vùng neo đậu",
        "harbour" to "Cảng, bến", "mooring" to "Trụ, phao buộc tàu", "pile" to "Cọc báo hiệu", "platform" to "Giàn khoan, công trình biển",
        "marine_farm" to "Lồng bè nuôi", "gate" to "Cửa, âu tàu",
    )

    private val COLOUR_WORD = mapOf(
        "white" to "trắng", "red" to "đỏ", "green" to "xanh lá", "yellow" to "vàng", "black" to "đen", "blue" to "xanh dương",
        "grey" to "xám", "gray" to "xám", "orange" to "cam", "amber" to "hổ phách", "violet" to "tím", "magenta" to "hồng sen", "brown" to "nâu",
    )

    private val CHARACTER_PHRASE = mapOf(
        "Al.Oc" to "Sáng liên tục, ngắt từng nhịp, đổi màu", "Al.Fl" to "Chớp{n} đổi màu", "VQ+LFl" to "Chớp rất nhanh{n} rồi một chớp dài",
        "Q+LFl" to "Chớp nhanh{n} rồi một chớp dài", "FFl" to "Sáng liên tục kèm chớp{n}", "LFl" to "Chớp dài{n}",
        "Iso" to "Sáng và tắt đều nhau", "Oc" to "Sáng liên tục, ngắt{n}", "VQ" to "Chớp rất nhanh{n}", "UQ" to "Chớp cực nhanh{n}",
        "IQ" to "Chớp nhanh ngắt quãng{n}", "Mo" to "Chớp theo tín hiệu Morse", "Al" to "Đổi màu luân phiên", "Fl" to "Chớp{n}",
        "Q" to "Chớp nhanh{n}", "F" to "Sáng liên tục",
    )

    fun seamarkLabel(type: String) = SEAMARK_LABEL[type] ?: "Báo hiệu hàng hải"

    fun colourLabel(colour: String?): String {
        if (colour.isNullOrEmpty()) return ""
        return colour.split(";").mapNotNull { COLOUR_WORD[Js.trim(it).lowercase()] }.joinToString("–")
    }

    private val CHU_SO_DAU = Regex("^[0-9]")
    private val CHI_SO = Regex("^[0-9]+$")

    private fun groupPhrase(group: String?): String {
        val g = Js.trim(group ?: "")
        if (g.isEmpty() || !CHU_SO_DAU.containsMatchIn(g)) return ""
        val parts = g.split("+").filter { CHI_SO.matches(it) }
        if (parts.isEmpty()) return ""
        return " " + parts.joinToString(" rồi ") { "$it nhịp" }
    }

    /** = describeLight (dạng LightInfo). */
    fun describeLight(info: DenInfo?): String {
        if (info == null) return ""
        val bits = mutableListOf<String>()
        val template = info.character?.let { CHARACTER_PHRASE[it] }
        if (template != null) {
            var head = template.replaceFirst("{n}", groupPhrase(info.group))
            if (info.character == "Mo" && !info.group.isNullOrEmpty() && Js.trim(info.group).isNotEmpty()) head += " chữ ${Js.trim(info.group).uppercase()}"
            bits += head
        }
        val colour = colourLabel(info.colour)
        if (colour.isNotEmpty()) bits += "ánh $colour"
        if (info.period != null && info.period.isFinite() && info.period > 0) bits += "${Js.inSo(info.period)} giây một vòng"
        if (info.range != null && info.range.isFinite() && info.range > 0) bits += "xa ${Js.inSo(info.range)} hải lý"
        return bits.joinToString(", ")
    }

    /** = describeSeamark */
    fun describeSeamark(m: BaoHieuTuyen): String {
        val bits = mutableListOf(seamarkLabel(m.type))
        val body = colourLabel(m.colour)
        if (body.isNotEmpty()) bits += "thân $body"
        val light = describeLight(m.light)
        if (light.isNotEmpty()) bits += light
        return bits.joinToString(" · ")
    }

    private val LATERAL_PHRASE = mapOf(
        "port" to "Vào luồng: để {v} này bên TRÁI tàu (ra biển thì bên phải)",
        "stbd" to "Vào luồng: để {v} này bên PHẢI tàu (ra biển thì bên trái)",
        "pref-stbd" to "Luồng rẽ đôi: luồng chính nằm bên PHẢI {v} — đi luồng chính thì để {v} bên TRÁI tàu",
        "pref-port" to "Luồng rẽ đôi: luồng chính nằm bên TRÁI {v} — đi luồng chính thì để {v} bên PHẢI tàu",
    )
    private val CARDINAL_PHRASE = mapOf("n" to ("BẮC" to "NAM"), "s" to ("NAM" to "BẮC"), "e" to ("ĐÔNG" to "TÂY"), "w" to ("TÂY" to "ĐÔNG"))

    private fun jp(s: String?): JsonElement? = s?.let { JsonPrimitive(it) }

    /** = huongDiQuaPhao */
    fun huongDiQuaPhao(m: BaoHieuTuyen, purpose: String?): String? {
        val type = m.type
        val vat = if (type.startsWith("beacon")) "tiêu" else "phao"
        if (type == "buoy_lateral" || type == "beacon_lateral") {
            var side = BaoHieu.sideFromPurposeVN(jp(purpose))
            if (side == "unknown") side = BaoHieu.sideFromBodyColour(jp(m.colour))
            if (side == "unknown") side = BaoHieu.sideFromLightColour(jp(m.light?.colour))
            if (side == "unknown") return null
            return LATERAL_PHRASE.getValue(side).replace("{v}", vat)
        }
        if (type == "buoy_cardinal" || type == "beacon_cardinal") {
            var q = BaoHieu.cardinalFromPurposeVN(jp(purpose))
            if (q == "unknown") q = BaoHieu.quadrantFromBodyColour(jp(m.colour))
            if (q == "unknown") return null
            val (anToan, nguyHiem) = CARDINAL_PHRASE.getValue(q)
            return "Đi về phía $anToan của $vat (chỗ nguy hiểm nằm phía $nguyHiem)"
        }
        if (type == "buoy_isolated_danger" || type == "beacon_isolated_danger") return "Nguy hiểm ngay dưới $vat — tránh xa, đừng cắt qua"
        if (type == "buoy_safe_water" || type == "beacon_safe_water") return "Nước an toàn quanh $vat, đi qua hai bên đều được"
        return null
    }

    private val AID_TYPES = setOf(
        "buoy_lateral", "buoy_cardinal", "buoy_safe_water", "buoy_special_purpose", "buoy_installation", "beacon", "beacon_lateral",
        "beacon_cardinal", "beacon_safe_water", "beacon_special_purpose", "light", "light_major", "light_minor", "light_vessel", "light_float",
    )

    /* ── con nước ── */

    /** = nearestTideStation */
    fun nearestTideStation(stations: List<TramConNuoc>, lat: Double, lon: Double): Pair<TramConNuoc, Double>? {
        if (!lat.isFinite() || !lon.isFinite()) return null
        val deg = PI / 180
        var best: Pair<TramConNuoc, Double>? = null
        for (st in stations) {
            val dLat = (st.lat - lat) * deg
            val dLon = (st.lon - lon) * deg
            val s1 = Tg.sin(dLat / 2); val s2 = Tg.sin(dLon / 2)
            val a = s1 * s1 + Tg.cos(lat * deg) * Tg.cos(st.lat * deg) * s2 * s2
            val km = 2 * 6371 * Tg.asin(min(1.0, Tg.sqrt(a)))
            if (best == null || km < best.second) best = st to km
        }
        return best
    }

    /** = tideClockText: "5 giờ 15 sáng" (tròn 5 phút). */
    fun tideClockText(ms: Double): String {
        val g = AisJs.gioVN(Js.round(ms / 300000) * 300000 + ConNuoc.VN_OFFSET_MS)
        var hh = g.gio
        val mm = g.phut
        val buoi = if (hh == 0) "đêm" else if (hh < 4) "khuya" else if (hh < 11) "sáng" else if (hh < 13) "trưa" else if (hh < 18) "chiều" else if (hh < 23) "tối" else "đêm"
        if (hh == 0) hh = 12 else if (hh > 12) hh -= 12
        val phut = if (mm == 0) "" else if (mm == 30) " rưỡi" else " $mm"
        return "$hh giờ$phut $buoi"
    }

    private fun vnIsoDate(ms: Double) = ConNuoc.ngayVn(ms.toLong())

    private class SapToi(val atMs: Double, val heightM: Double, val lon: Boolean, val ngayMai: Boolean)

    private fun tideUpcoming(st: TramConNuoc, ms: Double, count: Int): List<SapToi> {
        if (!ms.isFinite()) return emptyList()
        val out = mutableListOf<SapToi>()
        var d = 0
        while (d < 2 && out.size < count) {
            for (e in ConNuoc.cucTriNgay(st, vnIsoDate(ms + d * 86400000))) {
                if (e.luc <= ms) continue
                out += SapToi(e.luc.toDouble(), e.caoM, e.lon, d == 1)
                if (out.size >= count) break
            }
            d++
        }
        return out
    }

    private fun tideTrendText(t: String) = if (t == "len") "Nước đang lên" else if (t == "xuong") "Nước đang xuống" else "Nước đứng"

    private class TrieuTai(val heightM: Double, val model: Boolean)

    private fun tideAt(tides: List<TramConNuoc>?, p: Diem, departMs: Double, etaH: Double?): TrieuTai? {
        if (tides == null || tides.isEmpty() || etaH == null || !departMs.isFinite()) return null
        val near = nearestTideStation(tides, p.lat, p.lon) ?: return null
        if (near.second > TIDE_MAX_KM) return null
        val h = ConNuoc.caoLuc(near.first, departMs + etaH * 3600_000)
        if (!h.isFinite()) return null
        return TrieuTai(h, near.first.laUocTinh)
    }

    private class CauSau(val thieu: Boolean, val cau: String)

    private fun soDoSau(chartM: Double, needM: Double, tide: TrieuTai?, ngay: String, ten: String?, chuDau: String = "Chỗ này"): CauSau? {
        val noiDo = if (ngay.isNotEmpty()) " (số đo $ngay)" else ""
        val oDau = if (!ten.isNullOrEmpty()) " gần $ten" else ""
        val can = "tàu cần ${soViet(needM)} m"
        if (tide != null) {
            val water = chartM + tide.heightM
            val uoc = if (tide.model) " (ước tính)" else ""
            if (water < needM) return CauSau(true, "$chuDau$oDau nước còn chừng ${soViet(water)} m$uoc lúc tàu tới$noiDo, $can — chờ nước lên hãy qua.")
            if (water < needM + 1) return CauSau(false, "$chuDau$oDau nước chừng ${soViet(water)} m$uoc lúc tàu tới$noiDo, $can — vừa đủ, canh con nước.")
            return null
        }
        if (chartM < needM) return CauSau(true, "$chuDau$oDau hải đồ ghi ${soViet(chartM)} m$noiDo, $can — chưa tính con nước chỗ này, canh nước lên hãy qua.")
        return null
    }

    /* ── ranh giới (geofence.ts) ── */

    private fun pointToSegmentKm(pLon: Double, pLat: Double, a: DoubleArray, b: DoubleArray): Double {
        val lat0 = (pLat + a[1] + b[1]) / 3
        val kx = Tg.cos((lat0 * PI) / 180) * 111.32
        val ky = 110.574
        val px = pLon * kx; val py = pLat * ky
        val ax = a[0] * kx; val ay = a[1] * ky
        val bx = b[0] * kx; val by = b[1] * ky
        val dx = bx - ax; val dy = by - ay
        val segLen2 = dx * dx + dy * dy
        var t = if (segLen2 == 0.0) 0.0 else ((px - ax) * dx + (py - ay) * dy) / segLen2
        t = max(0.0, min(1.0, t))
        return AisJs.hypot(px - (ax + t * dx), py - (ay + t * dy))
    }

    private fun pointInRingBien(lon: Double, lat: Double, ring: Vong): Boolean {
        var inside = false
        var j = ring.size - 1
        for (i in ring.indices) {
            val xi = ring[i][0]; val yi = ring[i][1]; val xj = ring[j][0]; val yj = ring[j][1]
            val mau = (yj - yi).let { if (it == 0.0 || it.isNaN()) EPS_JS else it }
            if ((yi > lat) != (yj > lat) && lon < ((xj - xi) * (lat - yi)) / mau + xi) inside = !inside
            j = i
        }
        return inside
    }

    private const val EPS_JS = 2.220446049250313E-16

    private fun minKmToPath(lon: Double, lat: Double, path: Vong): Double {
        var best = Double.POSITIVE_INFINITY
        for (i in 0 until path.size - 1) {
            val d = pointToSegmentKm(lon, lat, path[i], path[i + 1])
            if (d < best) best = d
        }
        return best
    }

    /** = borderProximity (ba trường): (applies, outside, distanceNm). */
    fun borderProximity(lat: Double, lng: Double, src: NguonBien = NguonBien.MAC_DINH): Triple<Boolean, Boolean, Double> {
        val nmPerKm = 1 / 1.852
        var bestKm = Double.POSITIVE_INFINITY
        for (i in 0 until src.line.size - 1) {
            val d = pointToSegmentKm(lng, lat, src.line[i], src.line[i + 1])
            if (d < bestKm) bestKm = d
        }
        val distanceNm = bestKm * nmPerKm
        val biet = src.polys.isNotEmpty()
        val kmToSea = minKmToPath(lng, lat, src.line)
        var kmToAnyEdge = Double.POSITIVE_INFINITY
        for (rings in src.polys) for (ring in rings) kmToAnyEdge = min(kmToAnyEdge, minKmToPath(lng, lat, ring))
        val raBangDuongBien = kmToSea <= kmToAnyEdge + 1 / nmPerKm
        val trong = biet && src.polys.any { rings ->
            var ins = false
            for (ring in rings) if (pointInRingBien(lng, lat, ring)) ins = !ins
            ins
        }
        val outside = biet && !trong && raBangDuongBien
        val applies = trong || raBangDuongBien || !biet
        return Triple(applies, outside, distanceNm)
    }

    /* ── hình học tuyến ── */

    private class Geom(val wps: List<Diem>, val cum: List<Double>, val totalKm: Double, val hoursAt: List<Double>?)

    private fun routeGeom(waypoints: List<Diem>, hoursAt: List<Double>): Geom? {
        val wps = waypoints.filter { it.lat.isFinite() && it.lon.isFinite() }
        if (wps.size < 2) return null
        val cum = ArrayList<Double>().apply { add(0.0) }
        for (i in 1 until wps.size) cum += cum[i - 1] + HinhHoc.haversineKm(wps[i - 1], wps[i])
        val ok = hoursAt.size == waypoints.size && wps.size == waypoints.size && hoursAt.all { it.isFinite() }
        return Geom(wps, cum, cum.last(), if (ok) hoursAt else null)
    }

    private fun etaAt(g: Geom, along: Double): Double? {
        val h = g.hoursAt ?: return null
        val k = max(0.0, min(g.totalKm, along))
        for (i in 1 until g.cum.size) {
            if (k <= g.cum[i] || i == g.cum.size - 1) {
                val len = g.cum[i] - g.cum[i - 1]
                val t = if (len > 0) max(0.0, min(1.0, (k - g.cum[i - 1]) / len)) else 0.0
                return h[i - 1] + (h[i] - h[i - 1]) * t
            }
        }
        return h.last()
    }

    private fun segAt(g: Geom, along: Double): Int {
        for (i in 1 until g.cum.size) if (along <= g.cum[i]) return i - 1
        return g.cum.size - 2
    }

    private class Near(val km: Double, val alongKm: Double, val seg: Int, val side: Int)

    private fun nearestOnRoute(g: Geom, lat: Double, lon: Double): Near {
        var best = Near(Double.POSITIVE_INFINITY, 0.0, 0, 0)
        val p = Diem(lat, lon)
        for (i in 0 until g.wps.size - 1) {
            val a = g.wps[i]; val b = g.wps[i + 1]
            val (km, al) = ChiMuc.distToSegment(p, a, b)
            if (km < best.km) {
                val cross = (b.lon - a.lon) * (p.lat - a.lat) - (b.lat - a.lat) * (p.lon - a.lon)
                best = Near(km, g.cum[i] + al, i, if (cross > 0) 1 else if (cross < 0) -1 else 0)
            }
        }
        return best
    }

    private class Mau(val p: Diem, val along: Double, val seg: Int)

    private fun samples(g: Geom, stepKm: Double): List<Mau> {
        val out = mutableListOf(Mau(g.wps[0], 0.0, 0))
        for (s in 0 until g.wps.size - 1) {
            val a = g.wps[s]; val b = g.wps[s + 1]
            val len = g.cum[s + 1] - g.cum[s]
            val n = max(1, kotlin.math.ceil(len / stepKm).toInt())
            for (i in 1..n) {
                val t = i.toDouble() / n
                out += Mau(Diem(a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t), g.cum[s] + len * t, s)
            }
        }
        return out
    }

    private class GanDuong(val along: Double, val km: Double)

    private fun nearLine(line: List<Diem>, pts: List<Mau>, km: Double): GanDuong? {
        var best: GanDuong? = null
        for (i in 0 until line.size - 1) for (s in pts) {
            val d = ChiMuc.distToSegment(s.p, line[i], line[i + 1]).first
            if (d <= km && (best == null || d < best.km)) best = GanDuong(s.along, d)
        }
        return best
    }

    private fun lineOf(f: DacTrung): List<Diem> {
        val out = mutableListOf<Diem>()
        val arr = when (f.hinh) {
            "LineString" -> f.toaDo as? JsonArray
            "Polygon" -> (f.toaDo as? JsonArray)?.getOrNull(0) as? JsonArray
            else -> null
        } ?: return out
        for (c in arr) {
            val a = c as? JsonArray ?: continue
            val lon = Js.so(a.getOrNull(0))?.takeIf { it.isFinite() } ?: continue
            val lat = Js.so(a.getOrNull(1))?.takeIf { it.isFinite() } ?: continue
            out += Diem(lat, lon)
        }
        return out
    }

    private val RESTRICT_LABEL = mapOf("cam-neo" to "khu cấm neo", "cam-danh-bat" to "khu cấm đánh bắt", "han-che" to "khu hạn chế")

    /**
     * = auditRoute: (hits sắp theo thứ tự gặp, missing). Thuần, không ném khi kho thiếu.
     * `waveMAt(i)` = sóng tại waypoint i lúc tàu tới (null = không biết).
     */
    fun auditRoute(
        waypoints: List<Diem>, hoursAt: List<Double>, departMs: Double, draftM0: Double?, waveMAt: ((Int) -> Double?)?, st: KhoHauKiem,
    ): Pair<List<VatTrenTuyen>, List<String>> {
        val missing = mutableListOf<String>()
        val hits = mutableListOf<VatTrenTuyen>()
        val g = routeGeom(waypoints, hoursAt) ?: return hits to listOf("tuyen")
        val draftM = if (draftM0 != null && draftM0.isFinite() && draftM0 > 0) draftM0 else null
        val wv = waveMAt ?: { null }
        fun needAt(seg: Int): Double? = if (draftM == null) null else HiemHoa.requiredDepthM(draftM, wv(seg))
        fun push(id: String, loai: String, ten: String?, km: Double, alongKm: Double, muc: String, cau: String) {
            hits += VatTrenTuyen(id, loai, ten, km, alongKm, muc, cau, etaAt(g, alongKm))
        }
        fun tenBaiGan(p: Diem) = nearestNamedPoint(st.reefs, p, REEF_NAME_KM)?.first

        // 1. hiểm hoạ chặn
        if (st.hazards == null) missing += "hiem-hoa"
        else for (h in st.hazards) {
            if (!h.lat.isFinite() || !h.lon.isFinite()) continue
            val n = nearestOnRoute(g, h.lat, h.lon)
            val r = if (h.rKm.isFinite() && h.rKm > 0) h.rKm else 0.0
            val muc = if (n.km <= r + HAZARD_DO_PAD_KM) "do" else if (n.km <= r + HAZARD_VANG_PAD_KM) "vang" else if (n.km <= r + HAZARD_TIN_PAD_KM) "tin" else continue
            val bai = if (!h.ten.isNullOrEmpty()) null else tenBaiGan(Diem(h.lat, h.lon))
            val mo = HiemHoa.moTaHazard(h) + (if (bai != null) " (gần $bai)" else "")
            val cach = khoangCachText(n.km)
            val cau = when (muc) {
                "do" -> "Tuyến đi sát $mo — cách tuyến chừng $cach."
                "vang" -> "$mo — cách tuyến chừng $cach."
                else -> "Gần tuyến có $mo — cách chừng $cach."
            }
            push(h.id, h.loai, h.ten, n.km, n.alongKm, muc, cau)
        }

        // 2. xác tàu qua được
        if (st.passable != null) for (h in st.passable) {
            if (!h.lat.isFinite() || !h.lon.isFinite()) continue
            if (h.doSauM == null || !h.doSauM.isFinite()) continue
            val n = nearestOnRoute(g, h.lat, h.lon)
            if (n.km > PASSABLE_TIN_KM) continue
            val need = needAt(n.seg)
            val ten = if (!h.ten.isNullOrEmpty()) "${HiemHoa.hazardLabel(h.loai)} ${h.ten}" else HiemHoa.hazardLabel(h.loai)
            val canM = if (need != null) ", tàu cần ${soViet(need)} m" else ""
            val gan = if (h.tinVua) " (vị trí gần đúng)" else ""
            push(h.id, h.loai, h.ten, n.km, n.alongKm, "tin", "$ten$gan cách tuyến chừng ${khoangCachText(n.km)} — nước trên vật ${soViet(h.doSauM)} m$canM, qua được.")
        }

        // 3. vùng cấm / cáp / ống
        if (st.lanes == null) missing += "sea-lanes"
        else {
            val pts = samples(g, SAMPLE_KM)
            val ng = HiemHoa.noGoFromLanes(st.lanes)
            for (z in ng.zones) {
                var first: Mau? = null
                var firstKm = Double.POSITIVE_INFINITY
                val ringPts = z.ring.map { Diem(it[1], it[0]) }
                val edges = mutableListOf<Pair<Diem, Diem>>()
                for (i in 0 until ringPts.size - 1) edges += ringPts[i] to ringPts[i + 1]
                edges += edges.last().second to edges.first().first
                val padDeg = (HiemHoa.NO_GO_PAD_KM / 111) * 1.01
                for (s in pts) {
                    if (s.p.lat < z.bbox.latMin - padDeg || s.p.lat > z.bbox.latMax + padDeg || s.p.lon < z.bbox.lonMin - padDeg || s.p.lon > z.bbox.lonMax + padDeg) continue
                    var km = Double.POSITIVE_INFINITY
                    if (HinhHoc.pointInRing(s.p, z.ring)) km = 0.0
                    else for (e in edges) km = min(km, ChiMuc.distToSegment(s.p, e.first, e.second).first)
                    if (km <= HiemHoa.NO_GO_PAD_KM && km < firstKm) {
                        first = s; firstKm = km
                        if (km == 0.0) break
                    }
                }
                if (first == null) continue
                val ten = z.ten ?: "khu cấm vào"
                push(z.id, "cam-vao", z.ten, firstKm, first.along, "do",
                    if (firstKm == 0.0) "Tuyến đi vào $ten — khu cấm vào, không được đi qua."
                    else "Tuyến chạy sát $ten (cách chừng ${khoangCachText(firstKm)}) — khu cấm vào.")
            }
            for (l in ng.hoDang) {
                val best = nearLine(l.line, pts, NO_GO_LINE_KM) ?: continue
                push(l.id, "cam-vao-ho", l.ten, best.km, best.along, "vang",
                    "Tuyến chạy gần ${l.ten ?: "khu cấm vào"} (cách chừng ${khoangCachText(best.km)}) — ranh khu này chưa rõ hết, giữ khoảng cách.")
            }
            val cableSegs = mutableListOf<ChiMuc.Doan<String>>()
            class HanChe(val ten: String, val line: List<Diem>, val polygon: Boolean)
            val restrict = mutableListOf<HanChe>()
            for (f in st.lanes) {
                val kind = f.chuoi("kind")
                val loai = f.chuoi("loai")
                if (kind == "cap" || kind == "ong") {
                    val line = lineOf(f)
                    for (i in 0 until line.size - 1) cableSegs += ChiMuc.Doan(line[i], line[i + 1], kind)
                } else if (kind == "vungcam" && !loai.isNullOrEmpty() && RESTRICT_LABEL[loai] != null) {
                    val line = lineOf(f)
                    if (line.size >= 2) restrict += HanChe(f.chuoi("ten")?.takeIf { it.isNotEmpty() } ?: RESTRICT_LABEL.getValue(loai),
                        line, f.hinh == "Polygon" && line.size >= 3)
                }
            }
            if (cableSegs.isNotEmpty()) {
                val sx = ChiMuc.buildSegmentIndex(cableSegs)
                val cross = ChiMuc.segmentsWithinCorridor(sx, g.wps, CABLE_CROSS_KM)
                if (cross.isNotEmpty()) {
                    fun kmOf(loai: String) = cross.filter { it.seg.ref == loai }.map { Js.round(it.alongKm) }.distinct().sortedWith(ChiMuc.theoSo { it })
                    val cap = kmOf("cap"); val ong = kmOf("ong")
                    val parts = mutableListOf<String>()
                    if (cap.isNotEmpty()) parts += "cáp ngầm ở km ${cap.joinToString(", ") { Js.inSo(it) }}"
                    if (ong.isNotEmpty()) parts += "ống dẫn ở km ${ong.joinToString(", ") { Js.inSo(it) }}"
                    push("cap-ong", "cap-ong", null, 0.0, cross[0].alongKm, "vang", "Tuyến cắt ${parts.joinToString(" và ")} — chạy qua được, đừng neo, đừng thả giã ở đó.")
                }
            }
            if (restrict.isNotEmpty()) {
                val ten = mutableListOf<String>()
                var along = Double.POSITIVE_INFINITY
                for (r in restrict) {
                    var hitAlong: Double? = null
                    if (r.polygon) {
                        val ring: Vong = r.line.map { doubleArrayOf(it.lon, it.lat) }
                        val latMin = r.line.minOf { it.lat }; val latMax = r.line.maxOf { it.lat }
                        val lonMin = r.line.minOf { it.lon }; val lonMax = r.line.maxOf { it.lon }
                        for (s in pts) {
                            if (s.p.lat < latMin || s.p.lat > latMax || s.p.lon < lonMin || s.p.lon > lonMax) continue
                            if (HinhHoc.pointInRing(s.p, ring)) { hitAlong = s.along; break }
                        }
                    } else hitAlong = nearLine(r.line, pts, RESTRICT_LINE_KM)?.along
                    if (hitAlong == null) continue
                    along = min(along, hitAlong)
                    if (r.ten !in ten) ten += r.ten
                }
                if (ten.isNotEmpty()) push("vung-han-che", "vung-han-che", null, 0.0, along, "vang",
                    "Tuyến chạy qua ${ten.joinToString("; ")} — chạy qua được, đừng dừng, đừng neo, đừng thả lưới ở đó.")
            }
        }

        // 4. số đo sâu ≤ 0,5 km — chỉ khi biết mớn
        if (st.soundings == null) missing += "so-do-sau"
        else if (draftM != null) {
            if (st.verdicts == null) missing += "doi-chieu"
            if (st.tides == null) missing += "thuy-trieu"
            class O(val hit: VatTrenTuyen, val rank: Double)
            val byKm = LinkedHashMap<Double, O>()
            st.soundings.forEachIndexed { i, s ->
                if (!s.lat.isFinite() || !s.lon.isFinite() || !s.depthM.isFinite()) return@forEachIndexed
                if (st.verdicts?.get("0:diem:$i") == "nghi-loi") return@forEachIndexed
                val n = nearestOnRoute(g, s.lat, s.lon)
                if (n.km > SOUNDING_KM) return@forEachIndexed
                val need = needAt(n.seg) ?: return@forEachIndexed
                val eta = etaAt(g, n.alongKm)
                val p = Diem(s.lat, s.lon)
                val r = soDoSau(s.depthM, need, tideAt(st.tides, p, departMs, eta), thangNam(s.at), tenBaiGan(p)) ?: return@forEachIndexed
                val rank = if (r.thieu) 3 + (need - s.depthM) else 1.0
                val bin = floor(n.alongKm)
                val cur = byKm[bin]
                if (cur != null && cur.rank >= rank) return@forEachIndexed
                byKm[bin] = O(VatTrenTuyen("sd:$i", "do-sau", null, n.km, n.alongKm, if (r.thieu) "do" else "tin", r.cau, null), rank)
            }
            for (v in byKm.values) push(v.hit.id, v.hit.loai, v.hit.ten, v.hit.km, v.hit.alongKm, v.hit.muc, v.hit.cau)
        }

        // 5. luồng
        if (st.fairways == null) missing += "luong"
        else {
            val segs = st.fairways.map { ChiMuc.Doan(it.tu, it.den, it) }
            val idx = HashMap<DoanLuongTuyen, Int>()
            st.fairways.forEachIndexed { i, f -> if (f !in idx) idx[f] = i }
            if (segs.isNotEmpty()) {
                val sx = ChiMuc.buildSegmentIndex(segs)
                for (h in ChiMuc.segmentsWithinCorridor(sx, g.wps, FAIRWAY_KM)) {
                    val f = h.seg.ref
                    val ngay = thangNam(f.at)
                    val ten = f.ten.ifEmpty { f.tenTuyen?.takeIf { it.isNotEmpty() } ?: "luồng" }
                    val need = needAt(segAt(g, h.alongKm))
                    val gan = if (f.xapXi) " (vị trí gần đúng)" else ""
                    var muc = "tin"
                    var cau = "Luồng $ten$gan: chỗ nông nhất ${soViet(f.sauM)} m${if (ngay.isNotEmpty()) " (đo $ngay)" else ""}."
                    if (need != null) {
                        val mid = Diem((f.tu.lat + f.den.lat) / 2, (f.tu.lon + f.den.lon) / 2)
                        val r = soDoSau(f.sauM, need, tideAt(st.tides, mid, departMs, etaAt(g, h.alongKm)), ngay, null, "Luồng $ten$gan, chỗ nông nhất")
                        if (r != null && r.thieu) { muc = "vang"; cau = r.cau }
                    }
                    push("lg:${idx[f]}", "luong", ten, h.km, h.alongKm, muc, cau)
                }
            }
        }

        // 6. phao / tiêu / đèn trong hành lang 1 km
        if (st.seamarks == null) missing += "seamarks"
        if (st.vnAids == null) missing += "vn-aids"
        run {
            class Aid(val m: BaoHieuTuyen, val ten: String?, val tacDung: String?, val chinhThuc: Boolean)
            val aids = mutableListOf<Aid>()
            for (a in st.vnAids ?: emptyList()) {
                if (a.type !in AID_TYPES) continue
                val ten = if (!a.ten.isNullOrEmpty() && !a.ten.contains("chưa rõ", ignoreCase = true)) a.ten else null
                aids += Aid(a, ten, a.tacDung, true)
            }
            for (m in st.seamarks ?: emptyList()) if (m.type in AID_TYPES) aids += Aid(m, null, null, false)
            if (aids.isNotEmpty()) {
                val ix = ChiMuc.buildIndex(aids) { Diem(it.m.lat, it.m.lon) }
                val aidIdx = HashMap<Aid, Int>().apply { aids.forEachIndexed { i, a -> put(a, i) } }
                val found = ChiMuc.queryCorridor(ix, g.wps, AID_CORRIDOR_KM)
                val kept = found.filter { h ->
                    h.item.chinhThuc || found.none { o -> o.item.chinhThuc && HinhHoc.haversineKm(o.item.m.lat, o.item.m.lon, h.item.m.lat, h.item.m.lon) < 0.05 }
                }
                val lines = if (kept.size > AID_MAX_LINES) kept.subList(0, AID_MAX_LINES - 1) else kept
                for (h in lines) {
                    val a = h.item
                    val n = nearestOnRoute(g, a.m.lat, a.m.lon)
                    val ben = if (n.side > 0) "bên trái" else if (n.side < 0) "bên phải" else "trên"
                    val dau = if (a.ten != null) "${a.ten} (${seamarkLabel(a.m.type)})" else describeSeamark(a.m)
                    val huong = huongDiQuaPhao(a.m, a.tacDung)
                    push("aid:${aidIdx[a]}", "phao", a.ten, h.km, h.alongKm, "tin",
                        "$dau — $ben tuyến chừng ${khoangCachText(h.km)}${if (!huong.isNullOrEmpty()) ". $huong" else ""}.")
                }
                if (kept.size > AID_MAX_LINES) {
                    val rest = kept.subList(AID_MAX_LINES - 1, kept.size)
                    push("aid:them", "phao", null, rest[0].km, rest[0].alongKm, "tin", "…và ${rest.size} phao, tiêu nữa dọc tuyến.")
                }
            }
        }

        // 7. ranh giới VMS
        if (st.border == null) missing += "ranh-gioi"
        else if (st.border) {
            var worst: Triple<Mau, Double, Boolean>? = null
            for (s in samples(g, BORDER_STEP_KM)) {
                val (applies, outside, nm) = borderProximity(s.p.lat, s.p.lon, st.nguonBien)
                if (!applies) continue
                if (outside) {
                    if (worst == null || !worst.third || nm > worst.second) worst = Triple(s, nm, true)
                } else if (nm <= BORDER_DO_NM && (worst == null || (!worst.third && nm < worst.second))) {
                    worst = Triple(s, nm, false)
                }
            }
            if (worst != null) push("ranh-gioi", "ranh-gioi", null, worst.second * NM_KM, worst.first.along, "do",
                if (worst.third) "Tuyến có đoạn nằm ngoài ranh giới biển theo vùng VMS (vào trong chừng ${soViet(worst.second)} hải lý) — xem lại điểm ghé."
                else "Tuyến chạy sát ranh giới biển (còn chừng ${soViet(worst.second)} hải lý) — canh vị trí khi tới đoạn này.")
        }

        if (st.reefs == null) missing += "bai-can"

        // 8. con nước hai đầu tuyến
        if (draftM != null && !st.tides.isNullOrEmpty()) {
            val last = g.wps.size - 1
            val etaDen = g.hoursAt?.get(last)
            class Dau(val p: Diem, val etaH: Double?, val den: Boolean, val along: Double)
            val dau = listOf(Dau(g.wps[0], 0.0, false, 0.0), Dau(g.wps[last], if (etaDen != null && etaDen.isFinite()) etaDen else null, true, g.totalKm))
            for (d in dau) {
                if (d.etaH == null) continue
                val near = nearestTideStation(st.tides, d.p.lat, d.p.lon) ?: continue
                if (near.second > TIDE_MAX_KM) continue
                val stn = near.first
                val ms = departMs + d.etaH * 3600_000
                val h = ConNuoc.caoLuc(stn, ms)
                if (!h.isFinite() || !ms.isFinite()) continue
                val uoc = if (stn.laUocTinh) " (ước tính)" else ""
                val ten = stn.ten
                val xuHuong = tideTrendText(ConNuoc.xuThe(stn, ms)).lowercase()
                val rong = ConNuoc.cucTriNgay(stn, vnIsoDate(ms)).firstOrNull { !it.lon && abs(it.luc - ms) <= 90 * 60_000 }
                val lon = tideUpcoming(stn, ms, 2).firstOrNull { it.lon }
                val lonSau = if (lon != null) " Nước lớn ${if (lon.ngayMai) "mai " else ""}lúc ${tideClockText(lon.atMs)} (${soViet(lon.heightM)} m)." else ""
                val mo = if (d.den) "Tới đích chừng ${tideClockText(ms)}, con nước ở $ten" else "Lúc xuất phát, con nước ở $ten"
                push(if (d.den) "trieu:den" else "trieu:di", "con-nuoc", ten, near.second, d.along, if (rong != null) "vang" else "tin",
                    if (rong != null) "$mo: đang là lúc nước ròng, còn chừng ${soViet(h)} m$uoc — ${if (d.den) "chờ nước lên hãy vào bến" else "ra cửa cạn thì chờ nước lên"}.$lonSau"
                    else "$mo: ${soViet(h)} m$uoc, $xuHuong.$lonSau")
            }
        }

        val byId = LinkedHashMap<String, VatTrenTuyen>()
        for (h in hits) {
            val cur = byId[h.id]
            if (cur == null || rankMuc(h.muc) > rankMuc(cur.muc) || (h.muc == cur.muc && h.km < cur.km)) byId[h.id] = h
        }
        return byId.values.sortedWith(ChiMuc.theoSo { it.alongKm }) to missing
    }

    /* ── route-danger-items ── */

    const val MAX_HIT_LINES = 3
    const val MAX_WILL_MEET = 8
    const val KHO_HAU_KIEM = "hau-kiem"

    private val VAT_CHAN = setOf("xac-tau", "chuong-ngai", "vat-chim", "phao-nguy-hiem", "long-be")

    private fun hangCua(loai: String): String? = when {
        loai == "ranh-gioi" -> "ranh-gioi"
        loai in VAT_CHAN -> "vat-chan"
        loai == "gian-khoan" -> "gian-khoan"
        loai == "cam-vao" || loai == "cam-vao-ho" -> "vung-cam"
        loai == "do-sau" || loai == "luong" -> "thieu-nuoc"
        loai == "cap-ong" -> "cap-ong"
        loai == "vung-han-che" -> "cam-neo"
        loai == "con-nuoc" -> "con-nuoc"
        loai == "phao" -> null
        else -> "khac"
    }

    private fun kmPrefix(h: VatTrenTuyen) = if (h.alongKm.isFinite() && h.alongKm >= 1) "Km ${Js.inSo(Js.round(h.alongKm))}: " else ""

    private val xepHit = Comparator<VatTrenTuyen> { a, b ->
        val d = rankMuc(b.muc) - rankMuc(a.muc)
        if (d != 0) d else ChiMuc.theoSo<VatTrenTuyen> { it.alongKm }.compare(a, b)
    }

    private fun gopCau(hits: List<VatTrenTuyen>): String {
        val xep = hits.sortedWith(xepHit)
        val dau = xep.take(MAX_HIT_LINES).map { "${kmPrefix(it)}${it.cau}" }.toMutableList()
        if (xep.size > MAX_HIT_LINES) dau += "…và ${xep.size - MAX_HIT_LINES} chỗ nữa cùng loại."
        return dau.joinToString(" ")
    }

    private val NHAN_HANG = mapOf(
        "ranh-gioi" to "Sát ranh giới", "vat-chan" to "Xác tàu", "gian-khoan" to "Giàn khoan", "vung-cam" to "Vùng cấm",
        "thieu-nuoc" to "Thiếu nước", "cap-ong" to "Cáp ngầm", "cam-neo" to "Cấm neo", "con-nuoc" to "Con nước", "khac" to "Lưu ý khác",
    )

    /** = buildDangerItems */
    fun buildDangerItems(plan: KetQuaDuong?, hits: List<VatTrenTuyen>?): List<MucCanhBao> {
        if (plan == null) return emptyList()
        val items = mutableListOf<MucCanhBao>()
        val theoHang = LinkedHashMap<String, MutableList<VatTrenTuyen>>()
        for (h in hits ?: emptyList()) {
            if (h.muc != "do" && h.muc != "vang") continue
            val hang = hangCua(h.loai) ?: continue
            theoHang.getOrPut(hang) { mutableListOf() } += h
        }
        fun hang(key: String): MucCanhBao? {
            val hs = theoHang[key]
            if (hs.isNullOrEmpty()) return null
            return MucCanhBao(key, NHAN_HANG[key] ?: "Lưu ý khác", gopCau(hs), hs.any { it.muc == "do" })
        }
        fun them(i: MucCanhBao?) { if (i != null) items += i }
        if (plan.hasRoughLeg) items += MucCanhBao("song-du", "Sóng quá lớn",
            "Có đoạn sóng tới ${TheDiem.formatNumberVN(plan.maxWaveM)} m, gió cấp ${TheDiem.beaufort(plan.maxWindKmh)} — mức KHÔNG NÊN ĐI với tàu nhỏ. Cân nhắc hoãn chuyến, nghe đài trước khi quyết.", true)
        if (plan.noWeatherKm >= 1) {
            val caTuyen = !plan.weatherSeen
            val hl = TheDiem.formatNumberVN(plan.noWeatherKm / 1.852, if (plan.noWeatherKm < 18.52) 1 else 0)
            items += MucCanhBao("khong-du-bao", "Thiếu dự báo sóng gió",
                if (caTuyen) "Cả tuyến KHÔNG có số dự báo sóng gió — máy chỉ né bờ, bãi cạn, chướng ngại và vùng cấm. Giờ chạy và dầu tính như biển êm. Nghe đài duyên hải trước khi chạy."
                else "Chừng $hl hải lý trên tuyến KHÔNG có số dự báo sóng gió — đoạn đó máy chỉ né bờ, bãi cạn và chướng ngại; giờ chạy và dầu tính như biển êm. Nghe đài duyên hải trước khi chạy.", true)
        }
        them(hang("ranh-gioi"))
        run {
            val hs = theoHang["vat-chan"] ?: emptyList()
            if (hs.isNotEmpty() || plan.hasHazardLeg) {
                val cau = if (hs.isNotEmpty()) gopCau(hs) else ""
                val them2 = if (plan.hasHazardLeg) "Tuyến còn đoạn đi vào vùng chặn quanh vật chìm / giàn khoan — máy KHÔNG né được chỗ đó, khúc này phải dò hải đồ." else ""
                items += MucCanhBao("vat-chan", NHAN_HANG.getValue("vat-chan"), listOf(cau, them2).filter { it.isNotEmpty() }.joinToString(" "),
                    plan.hasHazardLeg || hs.any { it.muc == "do" })
            }
        }
        them(hang("gian-khoan"))
        them(hang("vung-cam"))
        if (plan.hasVeryShallowLeg && !plan.nearPortOnly) items += MucCanhBao("rat-can", "Bãi rất cạn",
            "Có đoạn đè lên vùng RẤT CẠN / bãi nổi (dưới 4 m) — chỉ vào theo con nước lên, đi chậm, hỏi người rành luồng lạch chỗ đó.", true)
        if (plan.hasNearLandLeg && !plan.nearPortOnly) items += MucCanhBao("de-bo", "Đè lên bờ",
            "Tuyến có đoạn đè lên phần BỜ theo bản đồ độ sâu của máy — chỗ đó máy không vẽ chính xác được; đi theo luồng quen và hải đồ, đừng bám vạch trên màn hình.", true)
        them(hang("thieu-nuoc"))
        if (plan.hasFollowingSeaRisk && !plan.hasRoughLeg) items += MucCanhBao("song-duoi", "Sóng dồn đuôi",
            "Có đoạn sóng dồn từ phía đuôi (≥2 m, sóng ngắn) — dễ trượt sóng: tới đoạn đó giảm ga, đừng để sóng vỗ thẳng đuôi tàu.", false)
        if (plan.hasShallowLeg) items += MucCanhBao("nuoc-nong", "Nước nông", "Tuyến có đoạn nước nông (cỡ 4–12 m) — để ý con nước, hải đồ đoạn đó.", false)
        if (plan.hasDraftShallowLeg) items += MucCanhBao("can-mon", "Chỗ cạn 2–4 m",
            "Có đoạn nước chỉ cỡ 2–4 m — máy cho đi vì mớn tàu đã khai đủ nước. Sóng lên hoặc nước ròng thì thiếu nước; tới đoạn đó đi chậm, nhìn con nước.", false)
        if (plan.hasReefShoalLeg) items += MucCanhBao("ran-nong", "Rạn nông",
            "Đoạn cập vào điểm đến (hoặc rời điểm đi) đi trên rạn nông hơn mức an toàn cho tàu — máy chỉ nới để tàu tới được. Vào rạn đi thật chậm, có người đứng mũi nhìn mặt nước, chọn lúc nước lớn.", true)
        them(hang("cap-ong"))
        them(hang("cam-neo"))
        them(hang("con-nuoc"))
        them(hang("khac"))
        if (plan.nearPortOnly || plan.hasHazardNearPortLeg) {
            val canBo = if (plan.nearPortOnly) "Đoạn đầu/cuối tuyến sát bờ, cạn" else "Đoạn đầu/cuối tuyến"
            val vat = if (plan.hasHazardNearPortLeg) ", lại có vật chặn gần bến (lồng bè, đăng đáy, xác tàu cũ)" else ""
            items += MucCanhBao("sat-cang", "Sát cảng", "$canBo$vat — máy nới cho đi. Khúc đó tự dò luồng quen và hải đồ, đừng bám vạch trên màn hình.", false)
        }
        return items.sortedWith { a, b -> (if (b.danger) 1 else 0) - (if (a.danger) 1 else 0) }
    }

    /** = buildWillMeet */
    fun buildWillMeet(hits: List<VatTrenTuyen>?): List<String> {
        val tin = (hits ?: emptyList()).filter { it.muc == "tin" }.sortedWith(ChiMuc.theoSo { it.alongKm })
        if (tin.isEmpty()) return emptyList()
        val giu = if (tin.size > MAX_WILL_MEET) tin.take(MAX_WILL_MEET - 1) else tin
        val out = giu.map { "${kmPrefix(it)}${it.cau}" }.toMutableList()
        if (tin.size > MAX_WILL_MEET) out += "…và ${tin.size - giu.size} chỗ nữa dọc tuyến."
        return out
    }

    private val TEN_KHO = mapOf(
        KHO_HAU_KIEM to "vật cản, cáp ngầm, con nước trên tuyến (hậu kiểm lỗi)", "xac-tau" to "xác tàu, chướng ngại",
        "sea-lanes" to "giàn khoan, cáp ngầm, khu cấm", "seamarks" to "phao, lồng bè", "hiem-hoa" to "vật chặn trên đường",
        "so-do-sau" to "số đo sâu", "doi-chieu" to "đối chiếu số đo sâu", "thuy-trieu" to "con nước", "luong" to "độ sâu luồng",
        "vn-aids" to "báo hiệu hàng hải", "ranh-gioi" to "ranh giới biển", "bai-can" to "tên bãi cạn", "do-sau-ran" to "độ sâu rạn Hoàng Sa, Trường Sa",
    )

    /** = moTaThieu */
    fun moTaThieu(missing: List<String>?): String? {
        val ten = mutableListOf<String>()
        for (m in missing ?: emptyList()) {
            if (m.isEmpty() || m == "tuyen") continue
            val t = TEN_KHO[m] ?: m
            if (t !in ten) ten += t
        }
        if (ten.isEmpty()) return null
        return "Chưa soi được ${ten.joinToString(" · ")} — phần này tuyến chưa đối chiếu, bà con tự dò hải đồ."
    }
}

/** Nhãn báo hiệu dùng chung với HiemHoa.hazardLabel. */
internal object BaoHieuChu {
    fun seamarkLabel(type: String) = HauKiem.seamarkLabel(type)
}
