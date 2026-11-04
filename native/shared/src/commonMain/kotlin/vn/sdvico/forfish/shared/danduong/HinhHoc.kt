package vn.sdvico.forfish.shared.danduong

import kotlin.math.PI

import kotlin.math.max
import kotlin.math.min

/*
  HÌNH HỌC DẪN ĐƯỜNG (đợt 2f) — port y `src/lib/geo.ts` (haversineKm R 6.371 km) + phần hình học đầu `route-plan.ts`
  (bearingDeg, angleDiffDeg, kmToNm, bboxOfPoints, lerp) + `pointInRing` của `spatial-index.ts`.
  Mọi phép lượng giác đi qua `Tg` — MỘT chỗ đổi nếu phải bám bit V8 hơn (cổng khớp DuongVangTest).
*/

/** = LatLon */
data class Diem(val lat: Double, val lon: Double)

/** = BBox */
data class Khung(val latMin: Double, val latMax: Double, val lonMin: Double, val lonMax: Double)

/** Vòng đa giác GeoJSON `[lon, lat][]` — mỗi phần tử một DoubleArray(2). */
typealias Vong = List<DoubleArray>

/** Lượng giác dùng chung cho cả gói (kotlin.math: JVM intrinsic / libm của nền). */
internal object Tg {
    fun sin(x: Double) = kotlin.math.sin(x)
    fun cos(x: Double) = kotlin.math.cos(x)
    fun asin(x: Double) = kotlin.math.asin(x)
    fun atan2(y: Double, x: Double) = kotlin.math.atan2(y, x)
    fun sqrt(x: Double) = kotlin.math.sqrt(x)
}

object HinhHoc {
    const val EARTH_R_KM = 6371.0
    const val KMH_PER_KNOT = 1.852

    internal fun rad(d: Double) = d * PI / 180
    internal fun deg(r: Double) = r * 180 / PI

    /** = haversineKm (geo.ts). */
    fun haversineKm(a: Diem, b: Diem): Double = haversineKm(a.lat, a.lon, b.lat, b.lon)

    fun haversineKm(aLat: Double, aLon: Double, bLat: Double, bLon: Double): Double {
        val dLat = rad(bLat - aLat)
        val dLon = rad(bLon - aLon)
        val s1 = Tg.sin(dLat / 2)
        val s2 = Tg.sin(dLon / 2)
        val s = s1 * s1 + Tg.cos(rad(aLat)) * Tg.cos(rad(bLat)) * s2 * s2
        return 2 * EARTH_R_KM * Tg.asin(Tg.sqrt(s))
    }

    /** Hướng chạy a → b, 0–360° (0 = Bắc). */
    fun bearingDeg(a: Diem, b: Diem): Double {
        val dLon = rad(b.lon - a.lon)
        val y = Tg.sin(dLon) * Tg.cos(rad(b.lat))
        val x = Tg.cos(rad(a.lat)) * Tg.sin(rad(b.lat)) - Tg.sin(rad(a.lat)) * Tg.cos(rad(b.lat)) * Tg.cos(dLon)
        return (deg(Tg.atan2(y, x)) + 360) % 360
    }

    fun kmToNm(km: Double) = km / KMH_PER_KNOT

    /** Góc lệch a − b về [−180, 180]. */
    fun angleDiffDeg(a: Double, b: Double) = ((a - b + 540) % 360) - 180

    internal fun lerp(a: Diem, b: Diem, t: Double) = Diem(a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t)

    /** = bboxOfPoints: khung bao trọn chuỗi điểm, nở `marginKm` mỗi phía. */
    fun bboxOfPoints(points: List<Diem>, marginKm: Double): Khung {
        var latMin = Double.POSITIVE_INFINITY
        var latMax = Double.NEGATIVE_INFINITY
        var lonMin = Double.POSITIVE_INFINITY
        var lonMax = Double.NEGATIVE_INFINITY
        for (p in points) {
            latMin = min(latMin, p.lat); latMax = max(latMax, p.lat)
            lonMin = min(lonMin, p.lon); lonMax = max(lonMax, p.lon)
        }
        val midLat = (latMin + latMax) / 2
        val dLat = marginKm / 111.32
        val dLon = marginKm / (111.32 * Tg.cos(rad(midLat)))
        return Khung(latMin - dLat, latMax + dLat, lonMin - dLon, lonMax + dLon)
    }

    fun bboxFor(start: Diem, dest: Diem, marginKm: Double) = bboxOfPoints(listOf(start, dest), marginKm)

    /** = pointInRing (spatial-index.ts): tia ngang, `ring` GeoJSON [lon, lat]. */
    fun pointInRing(lat: Double, lon: Double, ring: Vong): Boolean {
        var inside = false
        var j = ring.size - 1
        for (i in ring.indices) {
            val xi = ring[i][0]
            val yi = ring[i][1]
            val xj = ring[j][0]
            val yj = ring[j][1]
            if ((yi > lat) != (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
            j = i
        }
        return inside
    }

    fun pointInRing(p: Diem, ring: Vong) = pointInRing(p.lat, p.lon, ring)

}
