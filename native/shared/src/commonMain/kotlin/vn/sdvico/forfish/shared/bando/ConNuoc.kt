package vn.sdvico.forfish.shared.bando

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.pow
import kotlin.math.sin

/*
  CON NƯỚC — PORT Y lõi `src/lib/tides.ts` (mục 1–3, 5, 7): đối số thiên văn V(t) + hệ số điều nút f/u (chu kỳ 18,6
  năm), mực nước điều hoà tại một thời điểm, nước lớn/ròng trong ngày (quét 6 phút + tìm tam phân + lọc độ nổi 5 cm),
  xu thế lên/xuống, chuỗi mực nước một ngày; giải file `tide-stations.v1.json`. Cộng `tideSymbolId` (chart-symbols.ts)
  và GeoJSON trạm y `tideGeo` của fishing-map-view. Giờ Việt Nam CỐ ĐỊNH +07:00 như web (không theo múi máy).
  Cổng khớp: native/scripts/sinh-con-nuoc.mjs chạy chính tides.ts ⇒ jvmTest/resources/con-nuoc ⇒ ConNuocVangTest.
*/
data class SongTrieu(val ten: String, val bienDo: Double, val pha: Double)

data class TramConNuoc(
    val id: String,
    val ten: String,
    val lat: Double,
    val lon: Double,
    val z0: Double,
    /** "gauge" | "model" | null */
    val nguon: String?,
    /** "vung" | "cang" | null (= vung) */
    val hang: String?,
    val song: List<SongTrieu>,
) {
    val laUocTinh get() = nguon == "model"
}

data class CucTri(val luc: Long, val caoM: Double, val lon: Boolean)

object ConNuoc {
    private const val DEG = PI / 180
    const val VN_OFFSET_MS = 7L * 60 * 60 * 1000

    private class Doodson(val d: IntArray, val nut: String)

    private val DOODSON: Map<String, Doodson> = mapOf(
        "SA" to Doodson(intArrayOf(0, 0, 1, 0, 0, -1), "one"),
        "SSA" to Doodson(intArrayOf(0, 0, 2, 0, 0, 0), "one"),
        "MM" to Doodson(intArrayOf(0, 1, 0, -1, 0, 0), "mm"),
        "MSF" to Doodson(intArrayOf(0, 2, -2, 0, 0, 0), "m2"),
        "MF" to Doodson(intArrayOf(0, 2, 0, 0, 0, 0), "mf"),
        "Q1" to Doodson(intArrayOf(1, -2, 0, 1, 0, 0), "o1"),
        "O1" to Doodson(intArrayOf(1, -1, 0, 0, 0, 0), "o1"),
        "P1" to Doodson(intArrayOf(1, 1, -2, 0, 0, 0), "one"),
        "S1" to Doodson(intArrayOf(1, 1, -1, 0, 0, 0), "one"),
        "K1" to Doodson(intArrayOf(1, 1, 0, 0, 0, 0), "k1"),
        "J1" to Doodson(intArrayOf(1, 2, 0, -1, 0, 0), "j1"),
        "OO1" to Doodson(intArrayOf(1, 3, 0, 0, 0, 0), "oo1"),
        "2N2" to Doodson(intArrayOf(2, -2, 0, 2, 0, 0), "m2"),
        "MU2" to Doodson(intArrayOf(2, -2, 2, 0, 0, 0), "m2"),
        "N2" to Doodson(intArrayOf(2, -1, 0, 1, 0, 0), "m2"),
        "NU2" to Doodson(intArrayOf(2, -1, 2, -1, 0, 0), "m2"),
        "M2" to Doodson(intArrayOf(2, 0, 0, 0, 0, 0), "m2"),
        "LDA2" to Doodson(intArrayOf(2, 1, -2, 1, 0, 0), "m2"),
        "T2" to Doodson(intArrayOf(2, 2, -3, 0, 0, 1), "one"),
        "S2" to Doodson(intArrayOf(2, 2, -2, 0, 0, 0), "one"),
        "K2" to Doodson(intArrayOf(2, 2, 0, 0, 0, 0), "k2"),
        "2SM2" to Doodson(intArrayOf(2, 4, -4, 0, 0, 0), "m2"),
        "MO3" to Doodson(intArrayOf(3, -1, 0, 0, 0, 0), "mo3"),
        "M3" to Doodson(intArrayOf(3, 0, 0, 0, 0, 0), "m3"),
        "MK3" to Doodson(intArrayOf(3, 1, 0, 0, 0, 0), "mk3"),
        "MN4" to Doodson(intArrayOf(4, -1, 0, 1, 0, 0), "m4"),
        "M4" to Doodson(intArrayOf(4, 0, 0, 0, 0, 0), "m4"),
        "MS4" to Doodson(intArrayOf(4, 2, -2, 0, 0, 0), "m2"),
        "MK4" to Doodson(intArrayOf(4, 2, 0, 0, 0, 0), "mk4"),
        "S4" to Doodson(intArrayOf(4, 4, -4, 0, 0, 0), "one"),
        "2MN6" to Doodson(intArrayOf(6, -1, 0, 1, 0, 0), "m6"),
        "M6" to Doodson(intArrayOf(6, 0, 0, 0, 0, 0), "m6"),
        "2MS6" to Doodson(intArrayOf(6, 2, -2, 0, 0, 0), "m4"),
    )

    private const val JD_EPOCH = 2440587.5

    private fun norm360(x: Double) = ((x % 360) + 360) % 360

    private class Astro(val a: DoubleArray, val n: Double)

    private fun astro(ms: Double): Astro {
        val jd = ms / 86400000 + JD_EPOCH
        val t = (jd - 2451545.0) / 36525
        val t2 = t * t
        val t3 = t2 * t
        val t4 = t3 * t
        val s = 218.3164477 + 481267.88123421 * t - 0.0015786 * t2 + t3 / 538841 - t4 / 65194000
        val h = 280.46646 + 36000.76983 * t + 0.0003032 * t2
        val p = 83.3532465 + 4069.0137287 * t - 0.010322 * t2 - t3 / 80053 + t4 / 18999000
        val nn = 125.0445479 - 1934.1362891 * t + 0.0020754 * t2 + t3 / 467441 - t4 / 60616000
        val ps = 282.937348 + 1.7195366 * t + 0.00045688 * t2
        val utHours = (((ms / 3600000) % 24) + 24) % 24
        val tau = 15 * utHours + h - s
        return Astro(doubleArrayOf(norm360(tau), norm360(s), norm360(h), norm360(p), norm360(-nn), norm360(ps)), norm360(nn))
    }

    private class Fu(val f: Double, val u: Double)

    private fun nut(kind: String, n: Double): Fu {
        val c1 = cos(n * DEG); val c2 = cos(2 * n * DEG); val c3 = cos(3 * n * DEG)
        val s1 = sin(n * DEG); val s2 = sin(2 * n * DEG); val s3 = sin(3 * n * DEG)
        val m2 = Fu(1.0004 - 0.0373 * c1 + 0.0002 * c2, -2.14 * s1)
        val o1 = Fu(1.0089 + 0.1871 * c1 - 0.0147 * c2 + 0.0014 * c3, 10.8 * s1 - 1.34 * s2 + 0.19 * s3)
        val k1 = Fu(1.006 + 0.115 * c1 - 0.0088 * c2 + 0.0006 * c3, -8.86 * s1 + 0.68 * s2 - 0.07 * s3)
        val k2 = Fu(1.0241 + 0.2863 * c1 + 0.0083 * c2 - 0.0015 * c3, -17.74 * s1 + 0.68 * s2 - 0.04 * s3)
        return when (kind) {
            "one" -> Fu(1.0, 0.0)
            "m2" -> m2
            "o1" -> o1
            "k1" -> k1
            "k2" -> k2
            "mm" -> Fu(1.0 - 0.13 * c1 + 0.0013 * c2, 0.0)
            "mf" -> Fu(1.0429 + 0.4135 * c1 - 0.004 * c2, -23.74 * s1 + 2.68 * s2 - 0.38 * s3)
            "j1" -> Fu(1.1029 + 0.1676 * c1 - 0.017 * c2 + 0.0016 * c3, -12.94 * s1 + 1.34 * s2 - 0.19 * s3)
            "oo1" -> Fu(1.1027 + 0.6504 * c1 + 0.0317 * c2 - 0.0014 * c3, -36.68 * s1 + 4.02 * s2 - 0.57 * s3)
            "m3" -> Fu(m2.f.pow(1.5), 1.5 * m2.u)
            "m4" -> Fu(m2.f * m2.f, 2 * m2.u)
            "m6" -> Fu(m2.f * m2.f * m2.f, 3 * m2.u)
            "mk3" -> Fu(m2.f * k1.f, m2.u + k1.u)
            "mo3" -> Fu(m2.f * o1.f, m2.u + o1.u)
            "mk4" -> Fu(m2.f * k2.f, m2.u + k2.u)
            else -> error("hệ số điều nút lạ: $kind")
        }
    }

    /** = tideHeightAt: z0 + Σ f·A·cos(V+u − g). */
    fun caoLuc(st: TramConNuoc, ms: Double): Double {
        val a = astro(ms)
        var sum = st.z0
        for (c in st.song) {
            val d = DOODSON.getValue(c.ten)
            var v = 0.0
            for (k in 0 until 6) v += d.d[k] * a.a[k]
            val fu = nut(d.nut, a.n)
            val vu = norm360(v + fu.u)
            sum += fu.f * c.bienDo * cos((vu - c.pha) * DEG)
        }
        return sum
    }

    private const val BUOC_QUET_MS = 6 * 60 * 1000
    private const val DO_NOI_MIN_M = 0.05
    private const val XU_THE_EPS_M = 0.02

    /** Mốc 00:00 giờ VN của ngày "YYYY-MM-DD" (ms UTC); hỏng ⇒ null. */
    private fun dauNgayVn(iso: String): Double? = Js.ngayMs(iso)?.let { it - VN_OFFSET_MS }

    private fun tinh(st: TramConNuoc, lo: Double, hi: Double, max: Boolean): Pair<Double, Double> {
        var a = lo
        var b = hi
        var i = 0
        while (i < 40 && b - a > 1000) {
            val m1 = a + (b - a) / 3
            val m2 = b - (b - a) / 3
            val h1 = caoLuc(st, m1)
            val h2 = caoLuc(st, m2)
            if (if (max) h1 < h2 else h1 > h2) a = m1 else b = m2
            i++
        }
        val at = Js.round((a + b) / 2)
        return at to caoLuc(st, at)
    }

    /** = tideExtremesForDay: nước lớn/ròng trong ngày giờ VN. */
    fun cucTriNgay(st: TramConNuoc, iso: String): List<CucTri> {
        val start = dauNgayVn(iso) ?: return emptyList()
        val end = start + 86400000
        val margin = 3 * 3600000.0
        val times = mutableListOf<Double>()
        val hs = mutableListOf<Double>()
        var t = start - margin
        while (t <= end + margin) { times += t; hs += caoLuc(st, t); t += BUOC_QUET_MS }
        var ex = mutableListOf<Triple<Double, Double, Boolean>>()
        for (i in 1 until hs.size - 1) {
            val isMax = hs[i] >= hs[i - 1] && hs[i] >= hs[i + 1]
            val isMin = hs[i] <= hs[i - 1] && hs[i] <= hs[i + 1]
            if (isMax == isMin) continue
            val (at, h) = tinh(st, times[i - 1], times[i + 1], isMax)
            ex += Triple(at, h, isMax)
        }
        fun gop(l: List<Triple<Double, Double, Boolean>>): MutableList<Triple<Double, Double, Boolean>> {
            val m = mutableListOf<Triple<Double, Double, Boolean>>()
            for (e in l) {
                val last = m.lastOrNull()
                if (last != null && last.third == e.third) {
                    val hon = if (e.third) e.second > last.second else e.second < last.second
                    if (hon) m[m.size - 1] = e
                } else m += e
            }
            return m
        }
        ex = gop(ex)
        while (true) {
            var te = -1
            var teD = DO_NOI_MIN_M
            for (i in 0 until ex.size - 1) {
                val d = abs(ex[i].second - ex[i + 1].second)
                if (d < teD) { teD = d; te = i }
            }
            if (te < 0) break
            ex.removeAt(te); ex.removeAt(te)
            ex = gop(ex)
        }
        return ex.filter { it.first >= start && it.first < end }.map { CucTri(it.first.toLong(), it.second, it.third) }
    }

    /** = tideTrendAt: "len" | "xuong" | "dung" (so với 30 phút sau, ngưỡng 2 cm). */
    fun xuThe(st: TramConNuoc, ms: Double): String {
        val now = caoLuc(st, ms)
        val next = caoLuc(st, ms + 30 * 60000)
        if (!now.isFinite() || !next.isFinite()) return "dung"
        val d = next - now
        return if (d > XU_THE_EPS_M) "len" else if (d < -XU_THE_EPS_M) "xuong" else "dung"
    }

    /** = tideDaySeries. */
    fun chuoiNgay(st: TramConNuoc, iso: String, buocPhut: Int = 30): List<Double> {
        val start = dauNgayVn(iso) ?: return emptyList()
        if (buocPhut <= 0) return emptyList()
        return (0..1440 step buocPhut).map { caoLuc(st, start + it * 60000.0) }
    }

    /** = vnIsoDate / isoDateVN: ngày giờ VN "YYYY-MM-DD". */
    fun ngayVn(ms: Long): String {
        val ngay = (ms + VN_OFFSET_MS).floorDiv(86_400_000L)
        // civil_from_days
        val z = ngay + 719468
        val era = (if (z >= 0) z else z - 146096) / 146097
        val doe = z - era * 146097
        val yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
        val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        val mp = (5 * doy + 2) / 153
        val d = doy - (153 * mp + 2) / 5 + 1
        val m = if (mp < 10) mp + 3 else mp - 9
        val y = yoe + era * 400 + (if (m <= 2) 1 else 0)
        return "${y.toString().padStart(4, '0')}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}"
    }

    /** = decodeTideStations: sai phiên bản ⇒ ném (web ném ⇒ không có lớp); trạm hỏng bỏ từng cái. */
    fun giai(raw: JsonElement?): List<TramConNuoc> {
        val f = raw as? JsonObject ?: error("tide-stations: sai định dạng hoặc sai phiên bản")
        if (Js.so(f["v"]) != 1.0) error("tide-stations: sai định dạng hoặc sai phiên bản")
        val ds = f["stations"] as? JsonArray ?: error("tide-stations: sai định dạng hoặc sai phiên bản")
        return ds.mapNotNull { e ->
            val s = e as? JsonObject ?: return@mapNotNull null
            val id = Js.chuoi(s["id"]) ?: return@mapNotNull null
            val ten = Js.chuoi(s["name"]) ?: return@mapNotNull null
            val lat = Js.so(s["lat"]) ?: return@mapNotNull null
            val lon = Js.so(s["lon"]) ?: return@mapNotNull null
            val z0 = Js.so(s["z0"]) ?: return@mapNotNull null
            val cons = s["cons"] as? JsonArray ?: return@mapNotNull null
            if (cons.isEmpty()) return@mapNotNull null
            val song = cons.map { c ->
                val o = c as? JsonObject ?: return@mapNotNull null
                val n = Js.chuoi(o["name"])?.takeIf { it in DOODSON } ?: return@mapNotNull null
                SongTrieu(n, Js.so(o["amp"]) ?: return@mapNotNull null, Js.so(o["phase"]) ?: return@mapNotNull null)
            }
            TramConNuoc(id, ten, lat, lon, z0, Js.chuoi(s["nguon"]), Js.chuoi(s["hang"]), song)
        }
    }

    /** = tideSymbolId (chart-symbols.ts). */
    fun kyHieu(xuThe: String, frac: Double, uocTinh: Boolean): String {
        val t = when (xuThe) { "len" -> "up"; "xuong" -> "down"; else -> "flat" }
        val muc = if (!frac.isFinite()) 2 else if (frac < 0.4) 1 else if (frac < 0.7) 2 else 3
        return "tide-$t-$muc${if (uocTinh) "-uoc" else ""}"
    }

    /** = tideGeo của fishing-map-view (mực lúc này so với biên độ NGÀY ĐÓ của trạm, chuỗi 60 phút). */
    fun geo(tram: List<TramConNuoc>, nowMs: Long): String? {
        if (tram.isEmpty()) return null
        val ngay = ngayVn(nowMs)
        val b = StringBuilder("{\"type\":\"FeatureCollection\",\"features\":[")
        tram.forEachIndexed { i, s ->
            val xt = xuThe(s, nowMs.toDouble())
            val ser = chuoiNgay(s, ngay, 60)
            val lo = ser.min()
            val hi = ser.max()
            val frac = if (hi > lo) (caoLuc(s, nowMs.toDouble()) - lo) / (hi - lo) else Double.NaN
            val chu = when (xt) { "len" -> "đang lên"; "xuong" -> "đang xuống"; else -> "nước đứng" }
            if (i > 0) b.append(',')
            b.append("{\"type\":\"Feature\",\"geometry\":{\"type\":\"Point\",\"coordinates\":[${Js.inSo(s.lon)},${Js.inSo(s.lat)}]},\"properties\":{")
            b.append("\"i\":$i,\"ten\":"); Js.jsonChuoi(s.ten, b)
            b.append(",\"model\":${if (s.laUocTinh) 1 else 0},\"hang\":"); Js.jsonChuoi(s.hang ?: "vung", b)
            b.append(",\"ic\":"); Js.jsonChuoi(kyHieu(xt, frac, s.laUocTinh), b)
            b.append(",\"nhan9\":"); Js.jsonChuoi("${s.ten} · $chu", b)
            b.append("}}")
        }
        return b.append("]}").toString()
    }
}
