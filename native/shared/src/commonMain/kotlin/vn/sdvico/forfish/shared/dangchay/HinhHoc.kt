package vn.sdvico.forfish.shared.dangchay

import vn.sdvico.forfish.shared.bando.Js
import kotlin.math.PI
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.sin
import kotlin.math.sqrt

/*
  HÌNH HỌC LÁ cho "Đang chạy" — chép Y các hàm web mà dẫn đường lúc chạy gọi:
    · geo.ts haversineKm (R = 6371) · route-plan.ts bearingDeg / angleDiffDeg / KMH_PER_KNOT / formatHoursVN
    · spatial-index.ts pointInRing + segDistKm (distToSegment) · route-storm.ts distToSegmentKm (111,32 km/độ)
  GHÉP SAU: agent port PHẦN TÍNH LỘ TRÌNH (package `danduong`) cũng có các hàm này — khi gộp, một bên gọi bên kia,
  đừng để hai bản trôi nhau (án lệ haversineKm/nearestIndex hai bản của web).
*/

/** = LatLon của web. */
data class ViTri(val lat: Double, val lon: Double)

object HinhHoc {
    const val EARTH_R_KM = 6371.0
    const val KMH_PER_KNOT = 1.852

    private fun rad(d: Double) = (d * PI) / 180
    private fun deg(r: Double) = (r * 180) / PI

    /** = geo.ts haversineKm */
    fun haversineKm(a: ViTri, b: ViTri): Double {
        val dLat = rad(b.lat - a.lat)
        val dLon = rad(b.lon - a.lon)
        val s1 = sin(dLat / 2)
        val s2 = sin(dLon / 2)
        val s = s1 * s1 + cos(rad(a.lat)) * cos(rad(b.lat)) * (s2 * s2)
        return 2 * EARTH_R_KM * asin(sqrt(s))
    }

    /** = route-plan bearingDeg: 0–360°, 0 = Bắc */
    fun bearingDeg(a: ViTri, b: ViTri): Double {
        val dLon = rad(b.lon - a.lon)
        val y = sin(dLon) * cos(rad(b.lat))
        val x = cos(rad(a.lat)) * sin(rad(b.lat)) - sin(rad(a.lat)) * cos(rad(b.lat)) * cos(dLon)
        return (deg(atan2(y, x)) + 360) % 360
    }

    /** = angleDiffDeg: a − b chuẩn hoá về [−180, 180] */
    fun angleDiffDeg(a: Double, b: Double): Double = ((a - b + 540) % 360) - 180

    /** = formatHoursVN: làm tròn 5 phút — "45 phút" / "2 giờ" / "2 giờ 15 phút" */
    fun formatHoursVN(h: Double): String {
        val totalMin = Js.round((h * 60) / 5) * 5
        val hh = floor(totalMin / 60)
        val mm = totalMin % 60
        if (hh == 0.0) return "${Js.inSo(mm)} phút"
        return if (mm == 0.0) "${Js.inSo(hh)} giờ" else "${Js.inSo(hh)} giờ ${Js.inSo(mm)} phút"
    }

    /** = spatial-index pointInRing — ray-casting, `ring` theo GeoJSON [lon, lat]. */
    fun pointInRing(p: ViTri, ring: List<DoubleArray>): Boolean {
        var inside = false
        var j = ring.size - 1
        for (i in ring.indices) {
            val xi = ring[i][0]
            val yi = ring[i][1]
            val xj = ring[j][0]
            val yj = ring[j][1]
            if ((yi > p.lat) != (yj > p.lat) && p.lon < ((xj - xi) * (p.lat - yi)) / (yj - yi) + xi) inside = !inside
            j = i
        }
        return inside
    }

    private const val KM_PER_DEG_LAT = (PI / 180) * 6371
    private fun kmPerDegLon(lat: Double) = max(1e-6, KM_PER_DEG_LAT * cos(rad(lat)))

    /** = spatial-index distToSegment: (km tới đoạn, đã đi bao xa dọc đoạn). */
    fun distToSegment(p: ViTri, a: ViTri, b: ViTri): Pair<Double, Double> {
        val kx = kmPerDegLon((a.lat + b.lat) / 2)
        val ax = a.lon * kx
        val ay = a.lat * KM_PER_DEG_LAT
        val bx = b.lon * kx
        val by = b.lat * KM_PER_DEG_LAT
        val px = p.lon * kx
        val py = p.lat * KM_PER_DEG_LAT
        val dx = bx - ax
        val dy = by - ay
        val den = dx * dx + dy * dy
        var t = if (den == 0.0) 0.0 else ((px - ax) * dx + (py - ay) * dy) / den
        t = if (t < 0) 0.0 else if (t > 1) 1.0 else t
        val cx = ax + t * dx
        val cy = ay + t * dy
        return hypot(px - cx, py - cy) to t * sqrt(den)
    }

    /** = route-storm distToSegmentKm (111,32 km/độ, vĩ độ giữa đoạn). */
    fun distToSegmentKmBao(p: ViTri, a: ViTri, b: ViTri): Double {
        val midLat = ((a.lat + b.lat) / 2) * (PI / 180)
        val kx = 111.32 * cos(midLat)
        val ky = 111.32
        val ax = a.lon * kx
        val ay = a.lat * ky
        val bx = b.lon * kx
        val by = b.lat * ky
        val px = p.lon * kx
        val py = p.lat * ky
        val dx = bx - ax
        val dy = by - ay
        val len2 = dx * dx + dy * dy
        val t = if (len2 == 0.0) 0.0 else max(0.0, kotlin.math.min(1.0, ((px - ax) * dx + (py - ay) * dy) / len2))
        return hypot(px - (ax + t * dx), py - (ay + t * dy))
    }

    /** `String(x)` có dấu phẩy thập phân (fmtM của nav-hazards: `String(r).replace(".", ",")`). */
    internal fun soPhay(x: Double) = Js.inSo(x).replaceFirst(".", ",")

    /** Chữ cái đầu viết HOA (`s.charAt(0).toUpperCase() + s.slice(1)`). */
    internal fun hoaDau(s: String) = if (s.isEmpty()) s else s.substring(0, 1).uppercase() + s.substring(1)

    /** Chữ cái đầu viết thường. */
    internal fun thuongDau(s: String) = if (s.isEmpty()) s else s.substring(0, 1).lowercase() + s.substring(1)
}
