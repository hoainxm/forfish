package vn.sdvico.forfish.shared.bando

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import vn.sdvico.forfish.shared.bando.Js.Number

/*
  LỚP BÁO HIỆU đợt 2b (app-map 18 §3d): báo hiệu OSM (`seamarks.v1.json`) + báo hiệu Cục Hàng hải (`vn-aids.v1.json`).
  PORT Y bộ giải web — `seamarks.ts` (decodeSeamarks), `vn-aids.ts` (decodeVnAids), `chart-symbols.ts` (chartSymbolId +
  sideFromPurposeVN/sideFromBodyColour/sideFromLightColour/cardinalFromPurposeVN/quadrantFromBodyColour/PLAIN_ICON/
  NO_LIT_VARIANT), `den-bien.ts` (denOsmTrungDenBien), `ban-do/hai-do.tsx` (SEAMARK_FAR/MID/AN) — rồi dựng GeoJSON y
  useMemo `seamarkGeo` + `seamarkTiers` + `vnAidGeo` của fishing-map-view.
  Cổng khớp: native/scripts/sinh-bao-hieu.mjs chạy chính code web ⇒ jvmTest/resources/bao-hieu/ ⇒ BaoHieuVangTest.
  Giá trị lấy từ bảng tra giữ NGUYÊN KIỂU JSON (web không ép chuỗi: `t` có thể là số) — `String(x)` chỉ ở chỗ web gọi.
  Hàng hỏng thì BỎ, không ném. Đầu vào null = không có file.
*/
object BaoHieu {
    /* ── ban-do/hai-do.tsx ── */
    private val SEAMARK_FAR = listOf("light_major", "light_vessel", "landmark")
    private val SEAMARK_MID = listOf(
        "light_minor", "light_float", "light", "virtual_aton", "buoy_cardinal", "buoy_isolated_danger",
        "buoy_safe_water", "buoy_lateral", "beacon", "beacon_lateral", "beacon_cardinal", "beacon_isolated_danger",
        "beacon_safe_water", "anchorage", "harbour",
    )
    private val SEAMARK_AN = listOf("platform")

    /** Một báo hiệu đã giải. `mauDen`/`mauThan`/`tacDung`: null Kotlin = `undefined` JS; giá trị giữ kiểu JSON. */
    internal class Moc(
        val lon: Double,
        val lat: Double,
        val loai: JsonElement,
        val coDen: Boolean,
        val mauDen: JsonElement?,
        val mauThan: JsonElement?,
        val tacDung: JsonElement? = null,
    )

    private fun huuHan(e: JsonElement?): Double? = Js.so(e)?.takeIf { it.isFinite() }

    /* ── seamarks.ts decodeSeamarks ── */
    /** `pick`: typeof i === "number" && i >= 0 && i < length ? table[i] : undefined (i lẻ ⇒ undefined). */
    private fun pick(bang: JsonArray, i: JsonElement?): JsonElement? {
        val d = Js.so(i) ?: return null
        if (!(d >= 0 && d < bang.size)) return null
        return if (Js.laNguyen(d)) bang[d.toInt()] else null
    }

    internal fun giaiSeamarks(raw: JsonElement?): List<Moc> {
        val f = raw as? JsonObject ?: return emptyList()
        val marks = f["marks"] as? JsonArray ?: return emptyList()
        val bang = { k: String -> f[k] as? JsonArray ?: JsonArray(emptyList()) }
        val types = bang("types")
        val chars = bang("chars")
        val groups = bang("groups")
        val colours = bang("colours")
        val ra = mutableListOf<Moc>()
        for (row in marks) {
            if (row !is JsonArray || row.size < 3) continue
            val lon = huuHan(row[0]) ?: continue
            val lat = huuHan(row[1]) ?: continue
            val type = pick(types, row[2])
            if (!Js.dung(type)) continue
            val o = { k: Int -> row.getOrNull(k) }
            var den = false
            if (Js.dung(pick(chars, o(3)))) den = true
            if (Js.dung(pick(groups, o(4)))) den = true
            val mauDen = pick(colours, o(5)).takeIf { Js.dung(it) }
            if (mauDen != null) den = true
            if ((huuHan(o(6)) ?: 0.0) > 0) den = true
            if ((huuHan(o(7)) ?: 0.0) > 0) den = true
            val than = pick(colours, o(8)).takeIf { Js.dung(it) }
            ra += Moc(lon, lat, type!!, den, if (den) mauDen else null, than)
        }
        return ra
    }

    /* ── vn-aids.ts decodeVnAids ── */
    /** `tra`: typeof i === "number" && i >= 0 ? bang[i] : undefined — `bang` là `f.x ?? []`, KHÔNG kiểm mảng:
     *  chuỗi thì ra ký tự, object thì tra khoá `String(i)`. */
    private fun traVn(bang: JsonElement?, i: JsonElement?): JsonElement? {
        val d = Js.so(i) ?: return null
        if (!(d >= 0)) return null
        return when (bang) {
            null, JsonNull -> null
            is JsonArray -> if (Js.laNguyen(d) && d < bang.size) bang[d.toInt()] else null
            is JsonObject -> bang[Js.inSo(d)]
            is JsonPrimitive ->
                if (bang.isString && Js.laNguyen(d) && d < bang.content.length) JsonPrimitive(bang.content[d.toInt()].toString()) else null
        }
    }

    internal fun giaiVnAids(raw: JsonElement?): List<Moc> {
        val f = raw as? JsonObject ?: return emptyList()
        val marks = f["marks"] as? JsonArray ?: return emptyList()
        val types = f["types"]
        val chars = f["chars"]
        val groups = f["groups"]
        val colours = f["colours"]
        val purposes = f["purposes"]
        val ra = mutableListOf<Moc>()
        for (r in marks) {
            if (r !is JsonArray || r.size < 3) continue
            val o = { k: Int -> r.getOrNull(k) }
            val lon = huuHan(r[0]) ?: continue
            val lat = huuHan(r[1]) ?: continue
            val type = traVn(types, r[2])
            if (!Js.dung(type)) continue
            val mauDen = traVn(colours, o(5))
            // `per > 0` / `rng > 0`: so sánh JS ép Number (chuỗi "5", true, [5] đều qua)
            val den = Js.dung(traVn(chars, o(3))) || Js.dung(traVn(groups, o(4))) || Js.dung(mauDen) ||
                Number(o(6)) > 0 || Number(o(7)) > 0
            val tacDung = traVn(purposes, o(11)).takeIf { it != null && it !is JsonNull }
            ra += Moc(lon, lat, type!!, den, if (den) mauDen else null, traVn(colours, o(8)), tacDung)
        }
        return ra
    }

    /* ── chart-symbols.ts ── */
    /** `String(x ?? "")` */
    private fun chu(e: JsonElement?): String = if (e == null || e is JsonNull) "" else Js.chuoiHoa(e)

    private fun phan(mau: JsonElement?): List<String> =
        chu(mau).lowercase().split(";").map { Js.trim(it) }.filter { it.isNotEmpty() }

    internal fun sideFromBodyColour(mau: JsonElement?): String {
        val p = phan(mau)
        if (p.size == 1) return when (p[0]) { "red" -> "port"; "green" -> "stbd"; else -> "unknown" }
        return when (p.joinToString(";")) { "red;green;red" -> "pref-stbd"; "green;red;green" -> "pref-port"; else -> "unknown" }
    }

    internal fun sideFromLightColour(mau: JsonElement?): String {
        val p = phan(mau)
        if (p.size != 1) return "unknown"
        return when (p[0]) { "red" -> "port"; "green" -> "stbd"; else -> "unknown" }
    }

    internal fun sideFromPurposeVN(purpose: JsonElement?): String {
        val t = chu(purpose).lowercase()
        if (t.isEmpty()) return "unknown"
        if (t.contains("chuyển sang phải") || t.contains("chuyển hướng sang phải")) return "pref-stbd"
        if (t.contains("chuyển sang trái") || t.contains("chuyển hướng sang trái")) return "pref-port"
        val phai = t.contains("phải")
        val trai = t.contains("trái")
        if (phai && trai) return "unknown"
        if (phai) return "stbd"
        if (trai) return "port"
        return "unknown"
    }

    internal fun quadrantFromBodyColour(mau: JsonElement?): String = when (phan(mau).joinToString(";")) {
        "black;yellow" -> "n"
        "yellow;black" -> "s"
        "black;yellow;black" -> "e"
        "yellow;black;yellow" -> "w"
        else -> "unknown"
    }

    private val HUONG = listOf("bắc" to "n", "nam" to "s", "đông" to "e", "tây" to "w")

    /** `matchAll(/(bắc|nam|đông|tây)/g)` lấy cái CUỐI — bốn từ không chồng lên nhau được nên quét trái→phải y JS. */
    internal fun cardinalFromPurposeVN(purpose: JsonElement?): String {
        val t = chu(purpose).lowercase()
        var cuoi = "unknown"
        var i = 0
        while (i < t.length) {
            val h = HUONG.firstOrNull { t.startsWith(it.first, i) }
            if (h != null) { cuoi = h.second; i += h.first.length } else i++
        }
        return cuoi
    }

    private val PLAIN_ICON = mapOf(
        "buoy_safe_water" to "safe-water", "beacon_safe_water" to "bcn-safe-water",
        "buoy_special_purpose" to "special", "beacon_special_purpose" to "bcn-special",
        "buoy_isolated_danger" to "iso-danger", "beacon_isolated_danger" to "bcn-iso-danger",
        "buoy_installation" to "installation", "beacon" to "beacon", "light" to "light-minor",
        "light_minor" to "light-minor", "light_major" to "light-major", "light_vessel" to "light-vessel",
        "light_float" to "light-float", "virtual_aton" to "virtual-aton", "landmark" to "landmark",
        "anchorage" to "anchorage", "harbour" to "harbour", "mooring" to "mooring", "pile" to "pile",
        "platform" to "platform", "marine_farm" to "marine-farm", "gate" to "gate",
    )

    private val NO_LIT_VARIANT = setOf(
        "light-minor", "light-major", "light-vessel", "light-float", "landmark", "virtual-aton",
        "anchorage", "harbour", "gate", "marine-farm",
    )

    private val BEACON_TYPES = setOf("beacon_lateral", "beacon_cardinal")

    /** = chartSymbolId(mark, purpose). */
    internal fun chartSymbolId(m: Moc, purpose: JsonElement?): String {
        val type = Js.chuoiHoa(m.loai)
        val base = if (type == "buoy_lateral" || type == "beacon_lateral") {
            var side = sideFromPurposeVN(purpose)
            if (side == "unknown") side = sideFromBodyColour(m.mauThan)
            if (side == "unknown") side = sideFromLightColour(m.mauDen)
            val beacon = type in BEACON_TYPES
            val flat = if (beacon && side == "pref-stbd") "port" else if (beacon && side == "pref-port") "stbd" else side
            if (beacon) "bcn-lat-$flat" else "lat-$flat"
        } else if (type == "buoy_cardinal" || type == "beacon_cardinal") {
            var q = cardinalFromPurposeVN(purpose)
            if (q == "unknown") q = quadrantFromBodyColour(m.mauThan)
            if (type in BEACON_TYPES) "bcn-card-$q" else "card-$q"
        } else {
            PLAIN_ICON[type] ?: "aid-unknown"
        }
        return if (m.coDen && base !in NO_LIT_VARIANT) "$base-lit" else base
    }

    /* ── den-bien.ts denOsmTrungDenBien (bán kính 300 m) ── */
    internal fun denOsmTrungDenBien(moc: List<Moc>, denBien: List<HaiDo.Den>): Set<Int> {
        val bo = mutableSetOf<Int>()
        if (denBien.isEmpty()) return bo
        val km = 300.0 / 1000
        val pad = km / 100
        moc.forEachIndexed { i, m ->
            val loai = Js.chuoi(m.loai)
            if (loai != "light_major" && loai != "light_minor") return@forEachIndexed
            for (d in denBien) {
                if (kotlin.math.abs(d.lat - m.lat) > pad || kotlin.math.abs(d.lon - m.lon) > pad * 2) continue
                if (HaiDo.haversineKm(d.lat, d.lon, m.lat, m.lon) <= km) {
                    bo += i
                    return@forEachIndexed
                }
            }
        }
        return bo
    }

    /* ── GeoJSON ── */
    private class Viet {
        val b = StringBuilder("{\"type\":\"FeatureCollection\",\"features\":[")
        var dem = 0
        fun diem(lon: Double, lat: Double, prop: StringBuilder.() -> Unit) {
            if (dem++ > 0) b.append(',')
            b.append("{\"type\":\"Feature\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[")
                .append(Js.inSo(lon)).append(',').append(Js.inSo(lat)).append("]},\"properties\":{")
            b.prop()
            b.append("}}")
        }
        fun xong(): String = b.append("]}").toString()
    }

    private val CHI_SO_MANG = Regex("0|[1-9][0-9]*")

    /** `JSON.stringify` cho giá trị JSON đã parse: khoá chỉ-số-mảng của object lên trước theo số (thứ tự V8). */
    private fun jsonHoa(e: JsonElement, ra: StringBuilder) {
        when (e) {
            is JsonNull -> ra.append("null")
            is JsonPrimitive -> when {
                e.isString -> Js.jsonChuoi(e.content, ra)
                e.booleanOrNull != null -> ra.append(e.booleanOrNull.toString())
                else -> e.doubleOrNull?.takeIf { it.isFinite() }?.let { ra.append(Js.inSo(it)) } ?: ra.append("null")
            }
            is JsonArray -> {
                ra.append('[')
                e.forEachIndexed { k, v -> if (k > 0) ra.append(','); jsonHoa(v, ra) }
                ra.append(']')
            }
            is JsonObject -> {
                val (so, chu) = e.keys.partition { CHI_SO_MANG.matches(it) && (it.toLongOrNull() ?: Long.MAX_VALUE) < 4294967295L }
                ra.append('{')
                (so.sortedBy { it.toLong() } + chu).forEachIndexed { k, khoa ->
                    if (k > 0) ra.append(',')
                    Js.jsonChuoi(khoa, ra); ra.append(':'); jsonHoa(e.getValue(khoa), ra)
                }
                ra.append('}')
            }
        }
    }

    /**
     * Báo hiệu OSM ba tầng (far, mid, near) — y `seamarkGeo` + `seamarkTiers`. Không có file / giải ra rỗng ⇒ cả ba
     * null (web không nhận state); có báo hiệu ⇒ cả ba là FeatureCollection (có thể rỗng), properties {i, t, ic}.
     * Đèn OSM `light_major`/`light_minor` trong 300 m một ngọn đèn biển nhà nước thì bỏ.
     */
    fun moc(seamarksRaw: JsonElement?, denBienRaw: JsonElement?): Triple<String?, String?, String?> {
        val ds = giaiSeamarks(seamarksRaw)
        if (ds.isEmpty()) return Triple(null, null, null)
        val den = if (denBienRaw == null) emptyList() else HaiDo.giaiDenBien(denBienRaw)
        val trung = denOsmTrungDenBien(ds, den)
        val far = Viet()
        val mid = Viet()
        val near = Viet()
        ds.forEachIndexed { i, m ->
            val t = Js.chuoiHoa(m.loai)
            if (t in SEAMARK_AN || i in trung) return@forEachIndexed
            val w = if (t in SEAMARK_FAR) far else if (t in SEAMARK_MID) mid else near
            w.diem(m.lon, m.lat) {
                append("\"i\":").append(i)
                append(",\"t\":"); jsonHoa(m.loai, this)
                append(",\"ic\":"); Js.jsonChuoi(chartSymbolId(m, null), this)
            }
        }
        return Triple(far.xong(), mid.xong(), near.xong())
    }

    /** Báo hiệu Cục Hàng hải — y `vnAidGeo`: properties {i, ic = chartSymbolId(m, tacDung)}; rỗng/không file ⇒ null. */
    fun vnAids(raw: JsonElement?): String? {
        val ds = giaiVnAids(raw)
        if (ds.isEmpty()) return null
        val w = Viet()
        ds.forEachIndexed { i, m ->
            w.diem(m.lon, m.lat) {
                append("\"i\":").append(i)
                append(",\"ic\":"); Js.jsonChuoi(chartSymbolId(m, m.tacDung), this)
            }
        }
        return w.xong()
    }
}
