package vn.sdvico.forfish.shared.danduong

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import vn.sdvico.forfish.shared.bando.Js
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min

/*
  HIỂM HOẠ CHO VẼ TUYẾN — port y `src/lib/hazards.ts` (buildHazardList, requiredDepthM/squatM, doSauLucT, hazardsInBBox,
  packHazards/unpackHazards, moTaHazard, banKinhText, noGoFromLanes) + ba bộ giải kho đầu vào: `decodeXacTau`
  (xac-tau.ts), `decodeSeamarks` (seamarks.ts), `decodeVnAids` (vn-aids.ts) và FeatureCollection của `fetchSeaLanes` /
  `fetchCoralReefs` (sea-lanes.ts) — giữ nguyên `properties` + hình JSON để luật đọc thuộc tính y web.
*/

/** = XacTau (phần thuật toán dùng). */
class XacTau(
    val lon: Double, val lat: Double, val loai: String,
    val ten: String? = null, val doSauVuotQua: Double? = null, val banKinhCamM: Double? = null,
    val nam: Double? = null, val thang: Double? = null, val ghi: String? = null,
)

/** Một GeoJSON Feature giữ thô: `properties` + `geometry.type` + `geometry.coordinates`. */
class DacTrung(val props: JsonObject?, val hinh: String?, val toaDo: JsonElement?) {
    fun chuoi(k: String): String? = Js.chuoi(props?.get(k))
}

/** = LightInfo */
class DenInfo(val character: String? = null, val group: String? = null, val colour: String? = null, val period: Double? = null, val range: Double? = null)

/** = Seamark (+ ba trường của VnAid khi là báo hiệu nhà nước). */
class BaoHieuTuyen(
    val lon: Double, val lat: Double, val type: String, val light: DenInfo? = null, val colour: String? = null,
    val ten: String? = null, val tacDung: String? = null, val tuyen: String? = null,
)

/** = Hazard */
data class HiemHoaDiem(
    val id: String, val lat: Double, val lon: Double,
    /** bán kính chặn km (đã ×2 nếu tin vừa) */
    val rKm: Double,
    val loai: String, val ten: String?, val nam: Double?,
    /** nước trên vật (m) nếu TBHH ghi */
    val doSauM: Double?, val tinVua: Boolean, val nguon: String,
)

/** = NoGoZone */
class VungCam(val id: String, val ten: String?, val ring: Vong, val bbox: Khung)

/** = NoGoLine */
class VungCamHo(val id: String, val ten: String?, val line: List<Diem>)

/** = HazardList */
class DanhSachHiemHoa(
    val hazards: List<HiemHoaDiem>, val passable: List<HiemHoaDiem>, val noGo: List<VungCam>,
    val missing: List<String>, val khongXacDinh: List<String>,
)

/** = HazardPacked — dạng phẳng như web (gói sang luồng tính). */
class HiemHoaGoi(val lat: DoubleArray, val lon: DoubleArray, val rKm: DoubleArray, val ids: List<String>)

object HiemHoa {
    const val R_XAC_TAU_MIN = 0.5
    const val R_GIAN_KHOAN = 1.0
    const val R_PHAO_NGUY_HIEM = 0.3
    const val R_LONG_BE = 0.2
    const val TIN_VUA_TUOI_NAM = 3
    const val TIN_VUA_NHAN = 2
    const val NO_GO_PAD_KM = 0.5
    const val SQUAT_CB = 0.6
    const val SQUAT_V0_KN = 6.0

    private fun huuHan(v: Double?) = v != null && v.isFinite()
    private fun okLatLon(lat: Double?, lon: Double?) = huuHan(lat) && huuHan(lon) && abs(lat!!) <= 90 && abs(lon!!) <= 180

    /** = squatM */
    fun squatM(speedKn: Double?): Double {
        if (!huuHan(speedKn) || speedKn!! <= SQUAT_V0_KN) return 0.0
        return (SQUAT_CB * (speedKn * speedKn - SQUAT_V0_KN * SQUAT_V0_KN)) / 100
    }

    /** = requiredDepthM: mớn + 0,5 + ½·min(Hs,3) + lún đuôi; chưa khai mớn ⇒ null. */
    fun requiredDepthM(draftM: Double?, waveM: Double?, speedKn: Double? = null): Double? {
        if (!huuHan(draftM) || draftM!! <= 0) return null
        val hs = if (huuHan(waveM) && waveM!! > 0) min(waveM, 3.0) else 0.0
        return Js.round((draftM + 0.5 + 0.5 * hs + squatM(speedKn)) * 100) / 100
    }

    /** = doSauLucT */
    fun doSauLucT(zMslM: Double, hTrieuM: Double, z0M: Double): Double {
        if (!zMslM.isFinite() || !hTrieuM.isFinite() || !z0M.isFinite()) return Double.NaN
        return -zMslM + (hTrieuM - z0M)
    }

    /* ── bộ giải kho ── */

    private val LOAI_XAC = setOf("xac-tau", "chuong-ngai", "vat-chim")

    /** = trongKhungBienVN (den-bien.ts KHUNG_BIEN_VN 4–24°B, 102–118°Đ) */
    internal fun trongKhungBienVN(lon: Double?, lat: Double?) =
        huuHan(lon) && huuHan(lat) && lat!! >= 4 && lat <= 24 && lon!! >= 102 && lon <= 118

    private fun traBang(bang: JsonElement?, i: JsonElement?): String? {
        val a = bang as? JsonArray ?: return null
        val d = Js.so(i) ?: return null
        if (!(d >= 0 && d < a.size) || !Js.laNguyen(d)) return null
        return Js.chuoi(a[d.toInt()])?.takeIf { it.isNotEmpty() }
    }

    private fun soDuong(e: JsonElement?): Double? = Js.so(e)?.takeIf { it.isFinite() && it > 0 }

    /** = decodeXacTau */
    fun giaiXacTau(raw: JsonElement?): List<XacTau> {
        val f = raw as? JsonObject ?: return emptyList()
        val items = f["items"] as? JsonArray ?: return emptyList()
        val notices = f["notices"] as? JsonArray
        val ra = mutableListOf<XacTau>()
        for (row in items) {
            if (row !is JsonArray || row.size < 7) continue
            val lon = Js.so(row[0])
            val lat = Js.so(row[1])
            if (!trongKhungBienVN(lon, lat)) continue
            val loaiRaw = traBang(f["loais"], row[2])
            val loai = if (loaiRaw in LOAI_XAC) loaiRaw!! else "chuong-ngai"
            val n = Js.tra(notices, row[6]) as? JsonObject
            ra += XacTau(
                lon!!, lat!!, loai,
                ten = traBang(f["names"], row[3]),
                doSauVuotQua = soDuong(row[4]),
                banKinhCamM = soDuong(row[5]),
                nam = Js.so(n?.get("nam")),
                thang = Js.so(n?.get("thang")),
                ghi = Js.chuoi(n?.get("ghi"))?.takeIf { it.isNotEmpty() },
            )
        }
        return ra
    }

    /** FeatureCollection → feature (= `fc.features` hoặc rỗng). */
    fun giaiDacTrung(raw: JsonElement?): List<DacTrung> {
        val feats = (raw as? JsonObject)?.get("features") as? JsonArray ?: return emptyList()
        return feats.map { f ->
            val o = f as? JsonObject
            val g = o?.get("geometry") as? JsonObject
            DacTrung(o?.get("properties") as? JsonObject, Js.chuoi(g?.get("type")), g?.get("coordinates"))
        }
    }

    private fun pickSo(bang: JsonArray, i: JsonElement?): String? {
        val d = Js.so(i) ?: return null
        if (!(d >= 0 && d < bang.size) || !Js.laNguyen(d)) return null
        return Js.chuoi(bang[d.toInt()])
    }

    private fun bangCua(f: JsonObject, k: String) = f[k] as? JsonArray ?: JsonArray(emptyList())

    /** = decodeSeamarks */
    fun giaiSeamarks(raw: JsonElement?): List<BaoHieuTuyen> {
        val f = raw as? JsonObject ?: return emptyList()
        val marks = f["marks"] as? JsonArray ?: return emptyList()
        val types = bangCua(f, "types"); val chars = bangCua(f, "chars"); val groups = bangCua(f, "groups"); val colours = bangCua(f, "colours")
        val ra = mutableListOf<BaoHieuTuyen>()
        for (row in marks) {
            if (row !is JsonArray || row.size < 3) continue
            val o = { k: Int -> row.getOrNull(k) }
            val lon = Js.so(row[0])?.takeIf { it.isFinite() } ?: continue
            val lat = Js.so(row[1])?.takeIf { it.isFinite() } ?: continue
            val type = pickSo(types, row[2])?.takeIf { it.isNotEmpty() } ?: continue
            val ch = pickSo(chars, o(3))?.takeIf { it.isNotEmpty() }
            val gr = pickSo(groups, o(4))?.takeIf { it.isNotEmpty() }
            val lc = pickSo(colours, o(5))?.takeIf { it.isNotEmpty() }
            val per = Js.so(o(6))?.takeIf { it.isFinite() && it > 0 }
            val rng = Js.so(o(7))?.takeIf { it.isFinite() && it > 0 }
            val light = if (ch != null || gr != null || lc != null || per != null || rng != null) DenInfo(ch, gr, lc, per, rng) else null
            ra += BaoHieuTuyen(lon, lat, type, light, pickSo(colours, o(8))?.takeIf { it.isNotEmpty() })
        }
        return ra
    }

    private fun traVn(bang: JsonElement?, i: JsonElement?): String? {
        val a = bang as? JsonArray ?: return null
        val d = Js.so(i) ?: return null
        if (!(d >= 0) || !Js.laNguyen(d) || d >= a.size) return null
        return Js.chuoi(a[d.toInt()])
    }

    /** = decodeVnAids */
    fun giaiVnAids(raw: JsonElement?): List<BaoHieuTuyen> {
        val f = raw as? JsonObject ?: return emptyList()
        val marks = f["marks"] as? JsonArray ?: return emptyList()
        val ra = mutableListOf<BaoHieuTuyen>()
        val routes = f["routes"] as? JsonArray
        for (r in marks) {
            if (r !is JsonArray || r.size < 3) continue
            val o = { k: Int -> r.getOrNull(k) }
            val lon = Js.so(r[0])?.takeIf { it.isFinite() } ?: continue
            val lat = Js.so(r[1])?.takeIf { it.isFinite() } ?: continue
            val type = traVn(f["types"], r[2])?.takeIf { it.isNotEmpty() } ?: continue
            val ch = traVn(f["chars"], o(3)); val gr = traVn(f["groups"], o(4)); val lc = traVn(f["colours"], o(5))
            val per = Js.Number(o(6)); val rng = Js.Number(o(7))
            val light = if (!ch.isNullOrEmpty() || !gr.isNullOrEmpty() || !lc.isNullOrEmpty() || per > 0 || rng > 0)
                DenInfo(ch, gr, lc, if (per > 0) per else null, if (rng > 0) rng else null) else null
            val rt = Js.so(o(9))
            val tuyen = if (rt != null && rt >= 0 && Js.laNguyen(rt) && routes != null && rt < routes.size)
                Js.chuoi((routes[rt.toInt()] as? JsonObject)?.get("ten"))?.takeIf { it.isNotEmpty() } else null
            ra += BaoHieuTuyen(lon, lat, type, light, traVn(f["colours"], o(8)), traVn(f["names"], o(10)), traVn(f["purposes"], o(11)), tuyen)
        }
        return ra
    }

    /* ── dựng danh sách ── */

    /** `/theo\s+phao/i` (\s của JS). */
    private fun theoPhao(s: String): Boolean {
        for (i in s.indices) {
            if (!s.regionMatches(i, "theo", 0, 4, ignoreCase = true)) continue
            var j = i + 4
            if (j < s.length && Js.laTrang(s[j])) {
                while (j < s.length && Js.laTrang(s[j])) j++
                if (s.regionMatches(j, "phao", 0, 4, ignoreCase = true)) return true
            }
        }
        return false
    }

    private fun tuXacTau(x: XacTau, i: Int, namNay: Int): HiemHoaDiem? {
        if (!okLatLon(x.lat, x.lon)) return null
        val nam = x.nam?.takeIf { it.isFinite() }
        val tp = x.ghi != null && theoPhao(x.ghi)
        val cu = nam == null || nam < namNay - TIN_VUA_TUOI_NAM
        val tinVua = tp || cu
        val baseKm = max(R_XAC_TAU_MIN, if (huuHan(x.banKinhCamM) && x.banKinhCamM!! > 0) x.banKinhCamM / 1000 else 0.0)
        return HiemHoaDiem(
            "xt:$i", x.lat, x.lon, if (tinVua) baseKm * TIN_VUA_NHAN else baseKm, x.loai, x.ten, nam,
            if (huuHan(x.doSauVuotQua) && x.doSauVuotQua!! > 0) x.doSauVuotQua else null, tinVua, "tbhh",
        )
    }

    private fun ringBBox(ring: Vong): Khung {
        var latMin = Double.POSITIVE_INFINITY; var latMax = Double.NEGATIVE_INFINITY
        var lonMin = Double.POSITIVE_INFINITY; var lonMax = Double.NEGATIVE_INFINITY
        for (c in ring) {
            val lon = c[0]; val lat = c[1]
            if (lat < latMin) latMin = lat
            if (lat > latMax) latMax = lat
            if (lon < lonMin) lonMin = lon
            if (lon > lonMax) lonMax = lon
        }
        return Khung(latMin, latMax, lonMin, lonMax)
    }

    private fun cap(c: JsonElement?): DoubleArray? {
        val a = c as? JsonArray ?: return null
        val lon = Js.so(a.getOrNull(0)); val lat = Js.so(a.getOrNull(1))
        return if (okLatLon(lat, lon)) doubleArrayOf(lon!!, lat!!) else null
    }

    private fun outerRing(f: DacTrung): Vong? {
        if (f.hinh != "Polygon") return null
        val r0 = (f.toaDo as? JsonArray)?.getOrNull(0) as? JsonArray ?: return null
        val ring = r0.mapNotNull { cap(it) }
        return if (ring.size >= 3) ring else null
    }

    private fun lineCoords(f: DacTrung): List<Diem>? {
        if (f.hinh != "LineString") return null
        val a = f.toaDo as? JsonArray ?: return null
        val out = a.mapNotNull { cap(it)?.let { c -> Diem(c[1], c[0]) } }
        return if (out.size >= 2) out else null
    }

    class KetQuaVungCam(val zones: List<VungCam>, val hoDang: List<VungCamHo>, val khongXacDinh: List<String>)

    /** = noGoFromLanes */
    fun noGoFromLanes(features: List<DacTrung>): KetQuaVungCam {
        val zones = mutableListOf<VungCam>()
        val hoDang = mutableListOf<VungCamHo>()
        val kxd = mutableListOf<String>()
        features.forEachIndexed { i, f ->
            if (f.chuoi("kind") != "vungcam" || f.chuoi("loai") != "cam-vao") return@forEachIndexed
            val ten = f.chuoi("ten")?.takeIf { it.isNotEmpty() }
            val ring = outerRing(f)
            if (ring != null) {
                zones += VungCam("cv:$i", ten, ring, ringBBox(ring))
                return@forEachIndexed
            }
            val line = lineCoords(f)
            if (line != null) {
                hoDang += VungCamHo("cvh:$i", ten, line)
                val nhan = ten ?: "khu cấm vào"
                if (nhan !in kxd) kxd += nhan
            }
        }
        return KetQuaVungCam(zones, hoDang, kxd)
    }

    /** = buildHazardList. Kho null = thiếu (ghi vào `missing`, không ném). */
    fun buildHazardList(
        xacTau: List<XacTau>?, laneFeatures: List<DacTrung>?, seamarks: List<BaoHieuTuyen>?, needM: Double?, namNay: Int,
    ): DanhSachHiemHoa {
        val hazards = mutableListOf<HiemHoaDiem>()
        val passable = mutableListOf<HiemHoaDiem>()
        val noGo = mutableListOf<VungCam>()
        val missing = mutableListOf<String>()
        val kxd = mutableListOf<String>()
        if (xacTau == null) missing += "xac-tau"
        else xacTau.forEachIndexed { i, x ->
            val h = tuXacTau(x, i, namNay) ?: return@forEachIndexed
            if (huuHan(needM) && h.doSauM != null && h.doSauM >= needM!!) passable += h else hazards += h
        }
        if (laneFeatures == null) missing += "sea-lanes"
        else {
            laneFeatures.forEachIndexed { i, f ->
                if (f.chuoi("kind") != "giankhoan" || f.hinh != "Point") return@forEachIndexed
                val c = f.toaDo as? JsonArray ?: return@forEachIndexed
                val lon = Js.so(c.getOrNull(0)); val lat = Js.so(c.getOrNull(1))
                if (!okLatLon(lat, lon)) return@forEachIndexed
                hazards += HiemHoaDiem("gk:$i", lat!!, lon!!, R_GIAN_KHOAN, "gian-khoan", f.chuoi("ten")?.takeIf { it.isNotEmpty() }, null, null, false, "sea-lanes")
            }
            val ng = noGoFromLanes(laneFeatures)
            noGo += ng.zones
            kxd += ng.khongXacDinh
        }
        if (seamarks == null) missing += "seamarks"
        else seamarks.forEachIndexed { i, m ->
            if (!okLatLon(m.lat, m.lon)) return@forEachIndexed
            val (loai, rKm) = when (m.type) {
                "buoy_isolated_danger", "beacon_isolated_danger" -> "phao-nguy-hiem" to R_PHAO_NGUY_HIEM
                "marine_farm" -> "long-be" to R_LONG_BE
                else -> return@forEachIndexed
            }
            hazards += HiemHoaDiem("sm:$i", m.lat, m.lon, rKm, loai, null, null, null, false, "osm")
        }
        return DanhSachHiemHoa(hazards, passable, noGo, missing, kxd)
    }

    private val KM_PER_DEG_LAT = (PI / 180) * 6371

    /** = hazardsInBBox */
    fun hazardsInBBox(h: List<HiemHoaDiem>, bbox: Khung, padKm: Double): List<HiemHoaDiem> {
        if (!bbox.latMin.isFinite() || !bbox.latMax.isFinite() || !bbox.lonMin.isFinite() || !bbox.lonMax.isFinite()) return emptyList()
        val pad = if (padKm.isFinite() && padKm > 0) padKm else 0.0
        val farLat = min(89.0, max(abs(bbox.latMin), abs(bbox.latMax)) + 1)
        val kmPerDegLon = max(1e-6, KM_PER_DEG_LAT * Tg.cos((farLat * PI) / 180))
        val out = mutableListOf<HiemHoaDiem>()
        for (x in h) {
            if (!x.lat.isFinite() || !x.lon.isFinite()) continue
            val reach = pad + (if (x.rKm.isFinite()) x.rKm else 0.0)
            val dLat = reach / KM_PER_DEG_LAT
            val dLon = reach / kmPerDegLon
            if (x.lat >= bbox.latMin - dLat && x.lat <= bbox.latMax + dLat && x.lon >= bbox.lonMin - dLon && x.lon <= bbox.lonMax + dLon) out += x
        }
        return out
    }

    /** = packHazards */
    fun packHazards(h: List<HiemHoaDiem>) =
        HiemHoaGoi(DoubleArray(h.size) { h[it].lat }, DoubleArray(h.size) { h[it].lon }, DoubleArray(h.size) { h[it].rKm }, h.map { it.id })

    /** = unpackHazards */
    fun unpackHazards(p: HiemHoaGoi, src: List<HiemHoaDiem>): List<HiemHoaDiem> {
        val byId = HashMap<String, HiemHoaDiem>()
        for (x in src) byId[x.id] = x
        return p.ids.mapNotNull { byId[it] }
    }

    /* ── câu chữ ── */

    internal fun soViet(v: Double): String = Js.inSo(Js.round(v * 10) / 10).replaceFirst(".", ",")

    /** = banKinhText */
    fun banKinhText(rKm: Double): String {
        if (!rKm.isFinite() || rKm <= 0) return ""
        return if (rKm < 1) "${Js.inSo(Js.round(rKm * 1000))} m" else "${soViet(rKm)} km"
    }

    /** = xacTauLabel */
    fun xacTauLabel(loai: String?) = when (loai) {
        "xac-tau" -> "Xác tàu chìm"
        "vat-chim" -> "Vật thể chìm"
        else -> "Chướng ngại vật"
    }

    /** = hazardLabel */
    fun hazardLabel(loai: String): String = when (loai) {
        "xac-tau", "chuong-ngai", "vat-chim" -> xacTauLabel(loai)
        "gian-khoan" -> "Giàn khoan"
        "phao-nguy-hiem" -> BaoHieuChu.seamarkLabel("buoy_isolated_danger")
        "long-be" -> BaoHieuChu.seamarkLabel("marine_farm")
        else -> xacTauLabel("chuong-ngai")
    }

    /** = moTaHazard */
    fun moTaHazard(h: HiemHoaDiem): String {
        var dau = hazardLabel(h.loai)
        if (h.ten != null && h.ten.isNotEmpty() && h.loai != "gian-khoan") dau += " ${h.ten}"
        if (h.nam != null && h.nam != 0.0 && !h.nam.isNaN()) dau += ", tin năm ${Js.inSo(h.nam)}"
        if (h.tinVua) dau += " (vị trí gần đúng)"
        val bits = mutableListOf(dau)
        if (h.doSauM != null && h.doSauM.isFinite()) bits += "nước trên vật ${soViet(h.doSauM)} m"
        val r = banKinhText(h.rKm)
        if (r.isNotEmpty()) bits += "tránh xa chừng $r"
        return bits.joinToString(" — ")
    }
}
