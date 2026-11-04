package vn.sdvico.forfish.shared.bando

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import vn.sdvico.forfish.shared.bando.Js.Number
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt

/*
  LỚP HẢI ĐỒ đợt 2a (app-map 18 §3d): số đo sâu, đường độ sâu (tim tuyến + đoạn luồng), đèn biển, xác tàu.
  PORT Y bộ giải web — `soundings.ts` (decodeSoundings/decodeSoundingRoutes/soundingAgeDays), `soundings-verified.ts`
  (decodeVerdicts/isStale), `fairway-depth.ts` (decodeFairwayDepths), `den-bien.ts` (decodeDenBien/laTenDenBien),
  `xac-tau.ts`, `chart-symbols.ts` (lighthouseSymbolId/wreckSymbolId), `seamarks.ts` (lightAbbrev), `map-prefs.ts`
  (fmtDepthM) — rồi dựng GeoJSON y bốn useMemo của fishing-map-view (soundingGeo/depthLineGeo/denBienGeo/xacTauGeo).
  Cổng khớp: native/scripts/sinh-hai-do.mjs chạy chính code web ⇒ jvmTest/resources/hai-do/ (các file .json) ⇒ HaiDoVangTest.
  Hàng hỏng thì BỎ, không ném — một dòng lỗi không được làm mất cả lớp của chuyến biển (luật web).
  Đầu vào null = không có file (chưa tải / mất sóng lúc tải lần đầu) ⇒ không có lớp đó.
*/
object HaiDo {
    /* ── khung + dải (soundings.ts §1, den-bien.ts KHUNG_BIEN_VN — cùng số) ── */
    private fun trongKhung(lon: Double?, lat: Double?) =
        lon != null && lat != null && lat >= 4.0 && lat <= 24.0 && lon >= 102.0 && lon <= 118.0

    private const val SAU_MIN = 0.1
    private const val SAU_MAX = 200.0
    private const val LUONG_MIN = -2.0
    private const val LUONG_MAX = 30.0
    private const val DOAN_MIN_KM = 0.05
    private const val DOAN_MAX_KM = 25.0
    /** soundings-verified.ts SOUNDING_STALE_DAYS */
    private const val SO_CU_NGAY = 365
    private const val NGHI_LOI = "nghi-loi"

    /** = fmtDepthM của map-prefs: tròn 0,1 m; số nguyên in không phẩy; còn lại dấu phẩy. */
    fun fmtDepthM(m: Double): String {
        val k = Js.round(m * 10)
        val r = k / 10
        if (Js.laNguyen(r)) return Js.inSo(r)
        val a = if (k < 0) -k else k
        val nguyen = floorDiv(a, 10.0)
        return (if (k < 0) "-" else "") + Js.inSo(nguyen) + "," + Js.inSo(a - nguyen * 10)
    }

    private fun floorDiv(a: Double, b: Double) = kotlin.math.floor(a / b)

    /** = geo.ts haversineKm, bán kính 6.371 km. */
    internal fun haversineKm(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
        val rad = { d: Double -> d * kotlin.math.PI / 180 }
        val dLat = rad(lat2 - lat1)
        val dLon = rad(lon2 - lon1)
        val s = sin(dLat / 2).let { it * it } + cos(rad(lat1)) * cos(rad(lat2)) * sin(dLon / 2).let { it * it }
        return 2 * 6371 * asin(sqrt(s))
    }

    private fun mang(o: JsonElement?, khoa: String): JsonArray? = (o as? JsonObject)?.get(khoa) as? JsonArray
    private fun thongBaoDung(n: JsonElement?): String? {
        val o = n as? JsonObject ?: return null
        val ngay = Js.chuoi(o["ngay"]) ?: return null
        return if (Js.dung(o["prov"])) ngay else null
    }

    /* ── số đo sâu ── */
    internal data class DiemSau(val lon: Double, val lat: Double, val sauM: Double, val ngay: String)
    internal data class TuyenSau(val diem: List<Pair<Double, Double>>, val sauM: Double?)
    internal data class DoanLuong(val lon1: Double, val lat1: Double, val lon2: Double, val lat2: Double, val sauM: Double)

    internal fun giaiDiemSau(raw: JsonElement?): List<DiemSau> {
        val hang = mang(raw, "diem") ?: return emptyList()
        val tb = mang(raw, "thongBao")
        val ra = mutableListOf<DiemSau>()
        for (h in hang) {
            if (h !is JsonArray || h.size < 4) continue
            val lon = Js.so(h[0])
            val lat = Js.so(h[1])
            if (!trongKhung(lon, lat)) continue
            val sau = Number(h[2]) / 10
            if (!(sau.isFinite() && sau >= SAU_MIN && sau <= SAU_MAX)) continue
            val ngay = thongBaoDung(Js.tra(tb, h[3])) ?: continue
            ra += DiemSau(lon!!, lat!!, Js.round(sau * 10) / 10, ngay)
        }
        return ra
    }

    internal fun giaiTuyenSau(raw: JsonElement?): List<TuyenSau> {
        val hang = mang(raw, "tuyen") ?: return emptyList()
        val tb = mang(raw, "thongBao")
        val ra = mutableListOf<TuyenSau>()
        for (r in hang) {
            if (!Js.dung(r)) continue
            val o = r as? JsonObject
            val diem = o?.get("diem") as? JsonArray ?: continue
            if (diem.size < 2) continue
            thongBaoDung(Js.tra(tb, o["tb"])) ?: continue
            val pts = mutableListOf<Pair<Double, Double>>()
            for (c in diem) {
                if (c !is JsonArray || c.size < 2) continue
                val lon = Js.so(c[0])
                val lat = Js.so(c[1])
                if (!trongKhung(lon, lat)) continue
                pts += lon!! to lat!!
            }
            if (pts.size < 2) continue
            val sauTho = o["sau"]
            val sau = if (sauTho == null || sauTho is kotlinx.serialization.json.JsonNull) null else Js.round(Number(sauTho)) / 10
            ra += TuyenSau(pts, if (sau != null && sau.isFinite()) sau else null)
        }
        return ra
    }

    /** decodeVerdicts + verdictKey: khoá "tep:loai:i" ⇒ kq; mục sau đè mục trước. */
    internal fun giaiDoiChieu(raw: JsonElement?): Map<String, String> {
        val muc = mang(raw, "muc") ?: return emptyMap()
        val ra = LinkedHashMap<String, String>()
        for (m in muc) {
            val o = m as? JsonObject ?: continue
            val tep = Js.so(o["tep"]) ?: continue
            val i = Js.so(o["i"]) ?: continue
            val loai = Js.chuoi(o["loai"])
            if (loai != "diem" && loai != "tuyen" && loai != "doan") continue
            val kq = Js.chuoi(o["kq"]) ?: continue
            ra["${Js.inSo(tep)}:$loai:${Js.inSo(i)}"] = kq
        }
        return ra
    }

    internal fun giaiDoanLuong(raw: JsonElement?): List<DoanLuong> {
        val hang = mang(raw, "doan") ?: return emptyList()
        val tuyen = mang(raw, "tuyen")
        val tb = mang(raw, "thongBao")
        val ra = mutableListOf<DoanLuong>()
        for (h in hang) {
            if (h !is JsonArray || h.size < 9) continue
            if (!Js.dung(Js.tra(tuyen, h[0]))) continue
            thongBaoDung(Js.tra(tb, h[1])) ?: continue
            val lon1 = Js.so(h[4]) ?: continue
            val lat1 = Js.so(h[5]) ?: continue
            val lon2 = Js.so(h[6]) ?: continue
            val lat2 = Js.so(h[7]) ?: continue
            val sau = Number(h[2]) / 10
            if (!(sau.isFinite() && sau >= LUONG_MIN && sau <= LUONG_MAX)) continue
            val km = haversineKm(lat1, lon1, lat2, lon2)
            if (!(km.isFinite() && km >= DOAN_MIN_KM && km <= DOAN_MAX_KM)) continue
            ra += DoanLuong(lon1, lat1, lon2, lat2, Js.round(sau * 10) / 10)
        }
        return ra
    }

    /** soundingAgeDays — null khi một trong hai ngày không đọc được. */
    internal fun tuoiNgay(ngay: String, homNay: String): Double? {
        val a = Js.ngayMs(ngay) ?: return null
        val b = Js.ngayMs(homNay) ?: return null
        return Js.round((b - a) / 86_400_000)
    }

    /* ── đèn biển ── */
    internal data class Den(val lon: Double, val lat: Double, val loai: String, val ten: String, val dt: String)

    private fun traBang(bang: JsonArray?, i: JsonElement?): String? {
        if (bang == null) return null
        val d = Js.so(i) ?: return null
        if (d < 0 || d >= bang.size) return null
        val v = Js.tra(bang, i)
        return if (Js.dung(v)) Js.chuoiHoa(v) else null
    }

    private fun soDuong(v: JsonElement?): Double? = Js.so(v)?.takeIf { it > 0 }

    private val DAU_TOA_DO = "°\"'‘’“”"
    private val SO_TRON = Regex("[0-9]+([.,][0-9]+)?")
    private val MA_PHAO = Regex("[A-Za-z]{1,4}[-\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]?[0-9]{1,3}")

    /** = laTenDenBien (den-bien.ts) với ngữ nghĩa regex JS không cờ `u`: `\b` và `\d` chỉ ASCII, `\s` đủ bộ Unicode. */
    internal fun laTenDenBien(ten: String): Boolean {
        val t = Js.trim(ten)
        if (t.length < 2 || t.length > 40) return false
        if (t.any { it in DAU_TOA_DO }) return false
        var chuoiSo = 0
        for (c in t) { chuoiSo = if (c in '0'..'9') chuoiSo + 1 else 0; if (chuoiSo >= 3) return false }
        if (SO_TRON.matches(t)) return false
        if (coTuPhao(t)) return false
        if (MA_PHAO.matches(t)) return false
        if (t.none { it in 'A'..'Z' || it in 'a'..'z' || it in 'À'..'ỹ' }) return false
        if (Js.tachTrang(t).size > 6) return false
        return true
    }

    /** `/\b(phao|ti[êe]u|đ[ăa]ng ti[êe]u)\b/i`. Mỗi mẫu là dãy tập ký tự. */
    private val TU_PHAO: List<List<String>> = listOf(
        listOf("p", "h", "a", "o"),
        listOf("t", "i", "êe", "u"),
        listOf("đ", "ăa", "n", "g", " ", "t", "i", "êe", "u"),
    )

    private fun coTuPhao(t: String): Boolean {
        fun bien(k: Int): Boolean {
            val truoc = k > 0 && Js.laChuW(t[k - 1])
            val sau = k < t.length && Js.laChuW(t[k])
            return truoc != sau
        }
        for (i in t.indices) {
            if (!bien(i)) continue
            for (mau in TU_PHAO) {
                if (i + mau.size > t.length) continue
                val khop = mau.indices.all { j -> mau[j].any { Js.hoa(it) == Js.hoa(t[i + j]) } }
                if (khop && bien(i + mau.size)) return true
            }
        }
        return false
    }

    private val VIET_TAT_MAU = mapOf(
        "white" to "W", "red" to "R", "green" to "G", "yellow" to "Y",
        "blue" to "Bu", "violet" to "Vi", "amber" to "Am", "orange" to "Or",
    )

    /** = lightAbbrev (seamarks.ts): "Fl(2)WR 5s 21M"; thiếu đặc tính ⇒ "". */
    internal fun lightAbbrev(dacTinh: String?, nhom: String?, mau: String?, chuKy: Double?, tam: Double?): String {
        if (dacTinh.isNullOrEmpty()) return ""
        val g = nhom?.let { Js.trim(it) }
        val m = (mau ?: "").split(";").joinToString("") { VIET_TAT_MAU[Js.trim(it).lowercase()] ?: "" }
        val bits = mutableListOf(dacTinh + (if (!g.isNullOrEmpty()) "($g)" else "") + m)
        if (chuKy != null && chuKy > 0) bits += "${Js.inSo(chuKy)}s"
        if (tam != null && tam > 0) bits += "${Js.inSo(Js.round(tam))}M"
        return bits.joinToString(" ")
    }

    private val KY_HIEU_THUONG = mapOf(
        "buoy_safe_water" to "safe-water", "beacon_safe_water" to "bcn-safe-water",
        "buoy_special_purpose" to "special", "beacon_special_purpose" to "bcn-special",
        "buoy_isolated_danger" to "iso-danger", "beacon_isolated_danger" to "bcn-iso-danger",
        "buoy_installation" to "installation", "beacon" to "beacon", "light" to "light-minor",
        "light_minor" to "light-minor", "light_major" to "light-major", "light_vessel" to "light-vessel",
        "light_float" to "light-float", "virtual_aton" to "virtual-aton", "landmark" to "landmark",
        "anchorage" to "anchorage", "harbour" to "harbour", "mooring" to "mooring", "pile" to "pile",
        "platform" to "platform", "marine_farm" to "marine-farm", "gate" to "gate",
    )

    /** = lighthouseSymbolId (chart-symbols.ts). */
    internal fun kyHieuDen(loai: String) = if (loai == "light_major") "lighthouse" else KY_HIEU_THUONG[loai] ?: "aid-unknown"

    internal fun giaiDenBien(raw: JsonElement?): List<Den> {
        val f = raw as? JsonObject ?: return emptyList()
        val hang = f["lights"] as? JsonArray ?: return emptyList()
        val bang = { k: String -> f[k] as? JsonArray }
        val ra = mutableListOf<Den>()
        for (h in hang) {
            if (h !is JsonArray || h.size < 10) continue
            val lon = Js.so(h[0])
            val lat = Js.so(h[1])
            if (!trongKhung(lon, lat)) continue
            val khongTen = h.getOrNull(16)?.let { Js.so(it) == 1.0 } ?: false
            val ten = if (khongTen) "" else traBang(bang("names"), h[9])
            if (!khongTen && (ten.isNullOrEmpty() || !laTenDenBien(ten))) continue
            val loai = traBang(bang("types"), h[2]) ?: "light_major"
            val dt = lightAbbrev(
                traBang(bang("chars"), h[3]),
                traBang(bang("groups"), h[4]),
                traBang(bang("colours"), h[5]),
                soDuong(h[6]),
                soDuong(h[7]),
            )
            ra += Den(lon!!, lat!!, loai, ten ?: "", dt)
        }
        return ra
    }

    /* ── xác tàu ── */
    internal data class Xac(val lon: Double, val lat: Double, val loai: String, val sauVuot: Double?)

    private val LOAI_XAC = setOf("xac-tau", "chuong-ngai", "vat-chim")

    internal fun giaiXacTau(raw: JsonElement?): List<Xac> {
        val f = raw as? JsonObject ?: return emptyList()
        val hang = f["items"] as? JsonArray ?: return emptyList()
        val ra = mutableListOf<Xac>()
        for (h in hang) {
            if (h !is JsonArray || h.size < 7) continue
            val lon = Js.so(h[0])
            val lat = Js.so(h[1])
            if (!trongKhung(lon, lat)) continue
            val l = traBang(f["loais"] as? JsonArray, h[2])
            ra += Xac(lon!!, lat!!, if (l in LOAI_XAC) l!! else "chuong-ngai", soDuong(h[4]))
        }
        return ra
    }

    /** = wreckSymbolId (chart-symbols.ts). */
    internal fun kyHieuXac(loai: String, sauVuot: Double?) =
        if (loai == "xac-tau") (if (sauVuot != null && sauVuot > 0) "wreck-depth" else "wreck") else "obstruction"

    /* ── GeoJSON y bốn useMemo của fishing-map-view ── */
    private class Viet {
        val b = StringBuilder("{\"type\":\"FeatureCollection\",\"features\":[")
        var dem = 0
        fun diem(lon: Double, lat: Double, prop: StringBuilder.() -> Unit) = them("{\"type\":\"Point\",\"coordinates\":[${Js.inSo(lon)},${Js.inSo(lat)}]}", prop)
        fun duong(pts: List<Pair<Double, Double>>, prop: StringBuilder.() -> Unit) =
            them("{\"type\":\"LineString\",\"coordinates\":[" + pts.joinToString(",") { "[${Js.inSo(it.first)},${Js.inSo(it.second)}]" } + "]}", prop)
        private fun them(hinh: String, prop: StringBuilder.() -> Unit) {
            if (dem++ > 0) b.append(',')
            b.append("{\"type\":\"Feature\",\"geometry\":").append(hinh).append(",\"properties\":{")
            b.prop()
            b.append("}}")
        }
        fun xong(): String? = if (dem == 0) null else b.append("]}").toString()
    }

    private fun StringBuilder.so(k: String, v: Double, dau: Boolean = false) { if (!dau) append(','); append('"').append(k).append("\":").append(Js.inSo(v)) }
    private fun StringBuilder.chu(k: String, v: String, dau: Boolean = false) { if (!dau) append(','); append('"').append(k).append("\":"); Js.jsonChuoi(v, this) }

    /** soundingGeo: bỏ điểm bị chấm nghi lỗi; `cu` = số quá 365 ngày; `tuoi` −1 khi không đọc được ngày.
     *  `homNay` "YYYY-MM-DD" theo UTC (web: `new Date().toISOString().slice(0, 10)`). */
    fun doSauGeo(soundings: JsonElement?, doiChieu: JsonElement?, homNay: String): String? {
        if (soundings == null) return null
        val diem = giaiDiemSau(soundings)
        if (diem.isEmpty()) return null
        val v = if (doiChieu == null) emptyMap() else giaiDoiChieu(doiChieu)
        val w = Viet()
        diem.forEachIndexed { i, s ->
            if (v["0:diem:$i"] == NGHI_LOI) return@forEachIndexed
            val tuoi = tuoiNgay(s.ngay, homNay)
            w.diem(s.lon, s.lat) {
                so("i", i.toDouble(), dau = true); so("d", s.sauM); chu("nhan", fmtDepthM(s.sauM))
                so("cu", if (tuoi != null && tuoi > SO_CU_NGAY) 1.0 else 0.0); so("tuoi", tuoi ?: -1.0)
            }
        }
        return w.xong()
    }

    /** depthLineGeo: tim tuyến có độ sâu (`k` "tuyen") + đoạn luồng (`k` "luong"). */
    fun duongDoSauGeo(soundings: JsonElement?, luong: JsonElement?): String? {
        val w = Viet()
        // web chỉ nhận state soundings khi có điểm HOẶC tuyến — tuyến rỗng thì như không có
        giaiTuyenSau(soundings).forEachIndexed { i, r ->
            val d = r.sauM ?: return@forEachIndexed
            w.duong(r.diem) { chu("k", "tuyen", dau = true); so("i", i.toDouble()); so("d", d); chu("nhan", fmtDepthM(d)) }
        }
        giaiDoanLuong(luong).forEachIndexed { i, f ->
            w.duong(listOf(f.lon1 to f.lat1, f.lon2 to f.lat2)) { chu("k", "luong", dau = true); so("i", i.toDouble()); so("d", f.sauM); chu("nhan", fmtDepthM(f.sauM)) }
        }
        return w.xong()
    }

    fun denBienGeo(raw: JsonElement?): String? {
        val w = Viet()
        giaiDenBien(raw).forEachIndexed { i, d ->
            w.diem(d.lon, d.lat) { so("i", i.toDouble(), dau = true); chu("ic", kyHieuDen(d.loai)); chu("ten", d.ten); chu("dt", d.dt) }
        }
        return w.xong()
    }

    fun xacTauGeo(raw: JsonElement?): String? {
        val w = Viet()
        giaiXacTau(raw).forEachIndexed { i, x ->
            w.diem(x.lon, x.lat) {
                so("i", i.toDouble(), dau = true); chu("ic", kyHieuXac(x.loai, x.sauVuot))
                chu("nhan", if (x.sauVuot != null && x.sauVuot > 0) fmtDepthM(x.sauVuot) else "")
            }
        }
        return w.xong()
    }
}
