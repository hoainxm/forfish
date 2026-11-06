package vn.sdvico.forfish.shared.dangchay

import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.thoitiet.TheDiem
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/*
  TIẾN ĐỘ BÁM TUYẾN — PORT Y src/lib/nav-progress.ts (projectOntoRoute, routeLengthKm, steerCue, etaHours,
  computeNavProgress, offRouteStepFor/Crossed + hằng ARRIVE_KM / OFF_ROUTE_*). Tuyến vào là danh sách waypoint
  lat/lon (= route.plan.waypoints) — GHÉP SAU với kiểu PlannedRoute của package `danduong`.
*/

enum class BenLai(val ma: String) { STRAIGHT("straight"), LEFT("left"), RIGHT("right") }

/** = SteerCue */
data class GoiYLai(val side: BenLai, val label: String, val turnDeg: Double)

/** = RouteProjection — side: "left" | "right" | "on" */
data class ChieuTuyen(
    val segIdx: Int,
    val tOnSeg: Double,
    val snapped: ViTri,
    val offRouteKm: Double,
    val alongKm: Double,
    val signedKm: Double,
    val side: String,
)

/** = NavProgress — vachBen: "trái" | "phải" | null */
data class TienDoChay(
    val remainingKm: Double,
    val etaHours: Double?,
    val nextWp: ViTri,
    val bearingToNextDeg: Double,
    val dirVN: String,
    val steer: GoiYLai?,
    val offRouteKm: Double,
    val offRoute: Boolean,
    val arrived: Boolean,
    val vachBen: String?,
    val huongVeVachDeg: Double?,
    val alongKm: Double,
    val segIdx: Int,
)

object TienDo {
    const val ARRIVE_KM = 0.4
    const val OFF_ROUTE_WARN_KM = 2.0
    val OFF_ROUTE_STEPS_KM = listOf(OFF_ROUTE_WARN_KM, 5.0, 10.0, 20.0)
    const val SEG_JUMP_RATIO = 0.4
    const val SIDE_EPS_KM = 0.01
    private const val STRAIGHT_DEG = 12.0
    private const val KM_PER_LAT = 111.32

    fun offRouteStepFor(offRouteKm: Double): Double? {
        if (!offRouteKm.isFinite()) return null
        var step: Double? = null
        for (s in OFF_ROUTE_STEPS_KM) if (offRouteKm >= s) step = s
        return step
    }

    fun offRouteStepCrossed(offRouteKm: Double, prev: Double?): Double? {
        val step = offRouteStepFor(offRouteKm) ?: return null
        if (prev == null || step > prev) return step
        return null
    }

    private fun kmPerLon(lat: Double) = 111.32 * cos((lat * PI) / 180)
    private fun sideOf(signedKm: Double) = if (abs(signedKm) < SIDE_EPS_KM) "on" else if (signedKm > 0) "right" else "left"

    fun projectOntoRoute(pos: ViTri, waypoints: List<ViTri>, hintSeg: Int = 0): ChieuTuyen {
        if (waypoints.isEmpty()) return ChieuTuyen(0, 0.0, pos, 0.0, 0.0, 0.0, "on")
        if (waypoints.size == 1) return ChieuTuyen(0, 0.0, waypoints[0], HinhHoc.haversineKm(pos, waypoints[0]), 0.0, 0.0, "on")
        val ref = pos
        val kx = kmPerLon(ref.lat)
        fun xy(p: ViTri) = (p.lon - ref.lon) * kx to (p.lat - ref.lat) * KM_PER_LAT
        val (px, py) = xy(pos)
        var best: ChieuTuyen? = null
        var nearHint: ChieuTuyen? = null
        var cum = 0.0
        for (i in 0 until waypoints.size - 1) {
            val a = waypoints[i]
            val b = waypoints[i + 1]
            val (ax, ay) = xy(a)
            val (bx, by) = xy(b)
            val segLenKm = HinhHoc.haversineKm(a, b)
            val dx = bx - ax
            val dy = by - ay
            val len2 = dx * dx + dy * dy
            var t = 0.0
            if (len2 > 1e-12) {
                t = ((px - ax) * dx + (py - ay) * dy) / len2
                t = max(0.0, min(1.0, t))
            }
            val cx = ax + t * dx
            val cy = ay + t * dy
            val dist = hypot(px - cx, py - cy)
            val c0 = cum
            val cand = {
                val signed = if (dist > 0) (dx * cy - dy * cx) / hypot(dx, dy) else 0.0
                ChieuTuyen(
                    i, t, ViTri(ref.lat + cy / KM_PER_LAT, ref.lon + cx / kmPerLon(ref.lat)),
                    dist, c0 + t * segLenKm, signed, sideOf(signed),
                )
            }
            if (best == null || dist < best.offRouteKm) best = cand()
            if (abs(i - hintSeg) <= 1 && (nearHint == null || dist < nearHint.offRouteKm)) nearHint = cand()
            cum += segLenKm
        }
        val b = best!!
        if (nearHint != null && b.segIdx != nearHint.segIdx && b.offRouteKm >= nearHint.offRouteKm * SEG_JUMP_RATIO) return nearHint
        return b
    }

    fun routeLengthKm(waypoints: List<ViTri>): Double {
        var sum = 0.0
        for (i in 0 until waypoints.size - 1) sum += HinhHoc.haversineKm(waypoints[i], waypoints[i + 1])
        return sum
    }

    fun steerCue(headingDeg: Double?, bearingToNextDeg: Double): GoiYLai? {
        if (headingDeg == null) return null
        val d = HinhHoc.angleDiffDeg(bearingToNextDeg, headingDeg)
        val mag = abs(d)
        if (mag <= STRAIGHT_DEG) return GoiYLai(BenLai.STRAIGHT, "Đi thẳng", d)
        val side = if (d > 0) BenLai.RIGHT else BenLai.LEFT
        val dir = if (d > 0) "phải" else "trái"
        val goc = max(5.0, Js.round(mag / 5) * 5)
        return GoiYLai(side, "Chếch $dir ${Js.inSo(goc)}°", d)
    }

    fun etaHours(remainingKm: Double, speedKmh: Double?): Double? =
        if (speedKmh == null || speedKmh < DinhVi.MIN_MOVING_KMH) null else remainingKm / speedKmh

    /** = computeNavProgress */
    fun computeNavProgress(pos: ViTri, headingDeg: Double?, speedKmh: Double?, waypoints: List<ViTri>, segHint: Int? = null): TienDoChay {
        if (waypoints.size < 2) {
            val dest = waypoints.getOrNull(0) ?: pos
            val remainingKm = HinhHoc.haversineKm(pos, dest)
            val brg = HinhHoc.bearingDeg(pos, dest)
            return TienDoChay(
                remainingKm, etaHours(remainingKm, speedKmh), dest, brg, TheDiem.windDirectionVN(brg),
                steerCue(headingDeg, brg), 0.0, false, remainingKm <= ARRIVE_KM, null, null, 0.0, 0,
            )
        }
        val proj = projectOntoRoute(pos, waypoints, segHint ?: 0)
        val totalKm = routeLengthKm(waypoints)
        val remainingKm = max(max(0.0, totalKm - proj.alongKm), HinhHoc.haversineKm(pos, waypoints.last()))
        val epsKm = 0.02
        var cum = 0.0
        var nextIdx = waypoints.size - 1
        for (i in 0 until waypoints.size - 1) {
            cum += HinhHoc.haversineKm(waypoints[i], waypoints[i + 1])
            if (cum > proj.alongKm + epsKm) {
                nextIdx = i + 1
                break
            }
        }
        val nextWp = waypoints[nextIdx]
        val brg = HinhHoc.bearingDeg(pos, nextWp)
        return TienDoChay(
            remainingKm = remainingKm,
            etaHours = etaHours(remainingKm, speedKmh),
            nextWp = nextWp,
            bearingToNextDeg = brg,
            dirVN = TheDiem.windDirectionVN(brg),
            steer = steerCue(headingDeg, brg),
            offRouteKm = proj.offRouteKm,
            offRoute = proj.offRouteKm > OFF_ROUTE_WARN_KM,
            arrived = remainingKm <= ARRIVE_KM,
            vachBen = when (proj.side) { "right" -> "trái"; "left" -> "phải"; else -> null },
            huongVeVachDeg = if (proj.side == "on") null else HinhHoc.bearingDeg(pos, proj.snapped),
            alongKm = proj.alongKm,
            segIdx = proj.segIdx,
        )
    }
}
