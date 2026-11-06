package vn.sdvico.forfish.shared.dangchay

import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.thoitiet.TheDiem
import kotlin.math.floor
import kotlin.math.min

/*
  BÃO THEO GPS + SÓNG GIÓ TẠI CHỖ TÀU + BẢN TIN MỞ ĐẦU / ĐIỂM TIN — PORT Y:
    · nav-voice/nav-storm.ts (stormHeadingDeg, stormName, stormObservation, stormBulletin) + route-storm.ts
      (forecastTrack, sampleRoute, routeStormConflict) cho đúng phần một điểm tàu;
    · nav-voice/sea-now.ts (seaThresholds, seaLevelOf, seaObservation, seaSavedLine) — lưới gió/sóng ĐÃ LƯU đi vào
      qua [MauBien] (web: sampleField của route-plan trên WeatherField) — GHÉP SAU với lưới của `danduong`;
    · nav-voice/opening.ts (urgentLine, chartLine, openingBulletin, diemTin, diemTinDue, DEPTH_HERE_SHORT).
  Chỉ ĐỌC bản đã có trong máy — không gọi mạng. Câu LUÔN có tuổi tin; KHÔNG BAO GIỜ "an toàn".
*/

/** = StormAlert (phần dẫn đường đọc): track [lon, lat] quá khứ→dự báo; areas[poly][ring][đỉnh] = [lon, lat]. */
data class BaoChay(
    val id: String,
    val name: String,
    val kindLabel: String,
    val lat: Double,
    val lon: Double,
    val track: List<DoubleArray> = emptyList(),
    val areas: List<List<List<DoubleArray>>> = emptyList(),
)

/** = StormStatus */
sealed class TrangThaiBao {
    object DangHoi : TrangThaiBao()
    data class KhongHoiDuoc(val checkedAt: Double?) : TrangThaiBao()
    data class KhongCo(val checkedAt: Double) : TrangThaiBao()
    data class CoBao(val storms: List<BaoChay>, val checkedAt: Double?, val cu: Boolean) : TrangThaiBao()
}

/** = StormObservation */
data class QuanSatBao(val id: String, val band: Int, val near: Boolean, val distCenterKm: Double, val distPathKm: Double, val text: String)

/** Một giờ của lưới gió sóng tại một chỗ (= HourSample: waveM null riêng từng ô; windKmh 0 = không có). */
data class GioBien(val waveM: Double?, val windKmh: Double)

/** = sampleField(field, lat, lon, hourIdx) — null khi lưới không phủ chỗ này. */
fun interface MauBien {
    fun mau(lat: Double, lon: Double, hourIdx: Int): GioBien?
}

/** = WeatherField ĐÃ LƯU: `laLuoi` = source "grid" (khi đó mới có savedAt). */
data class LuoiBienLuu(val mau: MauBien, val laLuoi: Boolean, val savedAt: Double?)

/** = SeaObservation — level 0 | 1 | 2 */
data class QuanSatBien(val level: Int, val summary: String, val warn: String?, val savedAt: Double?)

/** = UrgentItem (phần bản tin đọc): days = số ngày tới hạn (âm = quá hạn). */
data class ViecGap(val label: String, val days: Double)

enum class SanSangHaiDo(val ma: String) { DU("du"), THIEU("thieu"), CHUA_CO("chua-co") }

object BaoBien {
    const val STORM_NEAR_KM = 200.0
    const val STORM_STEP_KM = 50.0
    const val STORM_FAR_BAND = 99
    private const val SAMPLE_STEP_KM = 25.0

    /* ── route-storm.ts ── */

    fun forecastTrack(s: BaoChay): List<ViTri> {
        val pts = s.track.filter { it.size >= 2 }.map { ViTri(it[1], it[0]) }
        if (pts.isEmpty()) return emptyList()
        val center = ViTri(s.lat, s.lon)
        var best = 0
        var bestD = Double.POSITIVE_INFINITY
        for (i in pts.indices) {
            val d = HinhHoc.haversineKm(pts[i], center)
            if (d < bestD) { bestD = d; best = i }
        }
        return pts.subList(best, pts.size)
    }

    fun sampleRoute(waypoints: List<ViTri>, stepKm: Double = SAMPLE_STEP_KM): List<ViTri> {
        val out = mutableListOf<ViTri>()
        for (i in waypoints.indices) {
            if (i > 0) {
                val a = waypoints[i - 1]
                val b = waypoints[i]
                val n = floor(HinhHoc.haversineKm(a, b) / stepKm).toInt()
                for (k in 1..n) {
                    val t = k.toDouble() / (n + 1)
                    out += ViTri(a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t)
                }
            }
            out += waypoints[i]
        }
        return out
    }

    /** = routeStormConflict ⇒ (bão vi phạm gần nhất, km) hoặc null. */
    fun routeStormConflict(waypoints: List<ViTri>, storms: List<BaoChay>, safeKm: Double = STORM_NEAR_KM): Pair<BaoChay, Double>? {
        if (waypoints.isEmpty() || storms.isEmpty()) return null
        val pts = sampleRoute(waypoints)
        var best: Pair<BaoChay, Double>? = null
        for (storm in storms) {
            val center = ViTri(storm.lat, storm.lon)
            val fc = forecastTrack(storm)
            var minD = Double.POSITIVE_INFINITY
            for (p in pts) {
                var d = HinhHoc.haversineKm(p, center)
                if (fc.size == 1) d = min(d, HinhHoc.haversineKm(p, fc[0]))
                for (i in 0 until fc.size - 1) d = min(d, HinhHoc.distToSegmentKmBao(p, fc[i], fc[i + 1]))
                if (d > 0 && storm.areas.any { it.isNotEmpty() && HinhHoc.pointInRing(p, it[0]) }) d = 0.0
                if (d < minD) minD = d
                if (minD == 0.0) break
            }
            if (minD <= safeKm && (best == null || minD < best.second)) best = storm to minD
        }
        return best
    }

    /* ── nav-storm.ts ── */

    fun stormHeadingDeg(s: BaoChay): Double? {
        val c = ViTri(s.lat, s.lon)
        for (p in forecastTrack(s)) if (HinhHoc.haversineKm(c, p) >= 20) return HinhHoc.bearingDeg(c, p)
        return null
    }

    fun stormName(s: BaoChay): String =
        listOf(s.kindLabel.ifEmpty { "Bão" }, if (s.name.isNotEmpty()) CauNoi.tenBaoNoi(s.name) else "").filter { it.isNotEmpty() }.joinToString(" ")

    /** = stormObservation — cơn GẦN TÀU NHẤT (theo đường đi) + câu đọc; `khu` = khu trú bão gần nhất. */
    fun stormObservation(status: TrangThaiBao, pos: ViTri?, nowMs: Double, unit: DonViNoi, khu: Pair<String, Double>? = null): QuanSatBao? {
        if (status !is TrangThaiBao.CoBao || pos == null || status.storms.isEmpty()) return null
        var best: Triple<BaoChay, Double, Double>? = null
        for (s in status.storms) {
            if (!s.lat.isFinite() || !s.lon.isFinite()) continue
            val center = HinhHoc.haversineKm(pos, ViTri(s.lat, s.lon))
            val hit = routeStormConflict(listOf(pos), listOf(s), Double.POSITIVE_INFINITY)
            val path = min(center, hit?.second ?: center)
            if (best == null || path < best.second) best = Triple(s, path, center)
        }
        val (s, path, center) = best ?: return null
        val near = path <= STORM_NEAR_KM
        val band = if (near) min(3, floor(path / STORM_STEP_KM).toInt()) else STORM_FAR_BAND
        val hdg = stormHeadingDeg(s)
        val parts = mutableListOf(
            "${stormName(s)} cách tàu chừng ${CauNoi.distSpeech(center, unit)}${if (hdg != null) ", đang đi hướng ${CauNoi.dirSpeech(hdg)}" else ""}.",
        )
        if (near && center - path > 30) parts += "Đường đi dự báo qua gần tàu."
        if (near && khu != null) parts += "Khu tránh trú bão gần nhất là ${khu.first}, còn chừng ${CauNoi.distSpeech(khu.second, unit)}."
        parts += "${HinhHoc.hoaDau(CauNoi.ageSpeech(status.checkedAt, nowMs))}."
        parts += "Nghe đài duyên hải."
        return QuanSatBao(s.id, band, near, center, path, parts.joinToString(" "))
    }

    /** = stormBulletin — "" = đang hỏi (chưa có trả lời). */
    fun stormBulletin(status: TrangThaiBao, obs: QuanSatBao?, nowMs: Double): String = when (status) {
        is TrangThaiBao.DangHoi -> ""
        is TrangThaiBao.CoBao -> obs?.text
            ?: "Có ${stormName(status.storms[0])} trên Biển Đông. ${HinhHoc.hoaDau(CauNoi.ageSpeech(status.checkedAt, nowMs))}. Nghe đài duyên hải."
        is TrangThaiBao.KhongCo -> "Bản ${CauNoi.ageSpeech(status.checkedAt, nowMs)} chưa thấy bão trên Biển Đông."
        is TrangThaiBao.KhongHoiDuoc -> if (status.checkedAt != null)
            "Chưa hỏi được tin bão mới, ${CauNoi.ageSpeech(status.checkedAt, nowMs)}. Nghe đài duyên hải."
        else "Máy chưa có tin bão. Nghe đài duyên hải."
    }

    /* ── sea-now.ts ── */

    const val SEA_LOOKAHEAD_H = 6
    const val SEA_BIG_BOAT_M = 15.0

    fun seaThresholds(lengthM: Double?): Pair<Double, Int> = if (lengthM != null && lengthM >= SEA_BIG_BOAT_M) 3.0 to 7 else 2.0 to 6

    fun seaLevelOf(waveM: Double?, windKmh: Double?, lengthM: Double?): Int {
        val (tWave, tCap) = seaThresholds(lengthM)
        val c = if (windKmh != null && windKmh.isFinite()) TheDiem.beaufort(windKmh) else 0
        val w = if (waveM != null && waveM.isFinite()) waveM else 0.0
        if (w >= tWave + 1.5 || c >= tCap + 2) return 2
        if (w >= tWave || c >= tCap) return 1
        return 0
    }

    /** = seaSavedLine */
    fun seaSavedLine(savedAt: Double?, nowMs: Double): String {
        if (savedAt == null || !savedAt.isFinite()) return "Số dự báo đã lưu trong máy."
        val age = nowMs - savedAt
        if (age < 12 * 3_600_000) return "Số dự báo tải lúc ${CauNoi.clockSpeech(savedAt)}."
        val h = Js.round(age / 3_600_000)
        return if (h < 48) "Số dự báo tải cách đây ${Js.inSo(h)} giờ." else "Số dự báo tải cách đây ${Js.inSo(Js.round(h / 24))} ngày."
    }

    /** Giờ VN 0–23 (= vnHourIndex). */
    fun vnHourIndex(nowMs: Double): Int {
        val t = nowMs + 7 * 3_600_000.0
        return floor((t - floor(t / 86_400_000.0) * 86_400_000.0) / 3_600_000.0).toInt()
    }

    /** = seaObservation — 6 giờ tới tại `pos`; null khi lưới không phủ (không bịa số). */
    fun seaObservation(field: LuoiBienLuu?, pos: ViTri?, nowMs: Double, lengthM: Double?): QuanSatBien? {
        if (field == null || pos == null) return null
        val h0 = vnHourIndex(nowMs)
        class Hang(val k: Int, val waveM: Double?, val windKmh: Double?)
        val rows = mutableListOf<Hang>()
        for (k in 0..SEA_LOOKAHEAD_H) {
            val smp = field.mau.mau(pos.lat, pos.lon, h0 + k) ?: continue
            val hasWave = smp.waveM != null && smp.waveM.isFinite()
            val hasWind = smp.windKmh.isFinite() && smp.windKmh > 0
            if (!hasWave && !hasWind) continue
            rows += Hang(k, if (hasWave) smp.waveM else null, if (hasWind) smp.windKmh else null)
        }
        if (rows.isEmpty()) return null
        val savedAt = if (field.laLuoi) field.savedAt else null
        fun mo(r: Hang) = listOfNotNull(
            r.windKmh?.let { "gió cấp ${TheDiem.beaufort(it)}" },
            r.waveM?.let { "sóng chừng ${CauNoi.waveSpeech(it)}" },
        ).joinToString(", ")
        val summary = mo(rows[0])
        var worst: Pair<Int, Hang>? = null
        for (r in rows) {
            val level = seaLevelOf(r.waveM, r.windKmh, lengthM)
            if (level > 0 && (worst == null || level > worst.first)) worst = level to r
        }
        if (worst == null) return QuanSatBien(0, summary, null, savedAt)
        val r = worst.second
        val khi = if (r.k == 0) "Bây giờ" else "${r.k} giờ nữa"
        return QuanSatBien(worst.first, summary, "$khi ${mo(r)}. ${seaSavedLine(savedAt, nowMs)}", savedAt)
    }

    /* ── opening.ts ── */

    const val OPENING_URGENT_DAYS = 7.0
    const val OPENING_URGENT_MAX = 2
    const val DIEM_TIN_MS = 30 * 60_000.0
    const val DIEM_TIN_QUIET_MS = 5 * 60_000.0
    const val CHUA_VI_TRI_LINE = "Chỉ tham khảo, bà con dò hải đồ và nghe đài."

    fun urgentLine(items: List<ViecGap>): String {
        val pick = items.filter { it.days <= OPENING_URGENT_DAYS }.sortedBy { it.days }.take(OPENING_URGENT_MAX)
        if (pick.isEmpty()) return ""
        return "Về bờ nhớ lo: ${pick.joinToString(", ") { HinhHoc.thuongDau(it.label) }}."
    }

    fun chartLine(chart: SanSangHaiDo): String = when (chart) {
        SanSangHaiDo.CHUA_CO -> "Máy chưa có hải đồ để canh. Bà con dò hải đồ và nghe đài."
        SanSangHaiDo.THIEU -> "Máy chỉ có một phần hải đồ, canh được một phần độ sâu và chướng ngại. Chỉ tham khảo, nghe đài duyên hải."
        SanSangHaiDo.DU -> "Máy đang canh độ sâu, rạn và chướng ngại phía trước. Chỉ tham khảo, bà con dò hải đồ và nghe đài."
    }

    /** = openingBulletin: ≤ 4 phần — bão · sóng gió · máy canh gì · nhắc việc về bờ. */
    fun openingBulletin(storm: String, sea: QuanSatBien?, urgent: List<ViecGap>, chart: SanSangHaiDo, nowMs: Double, coViTri: Boolean): String {
        val parts = mutableListOf<String>()
        if (storm.isNotEmpty()) parts += storm
        parts += if (sea != null && sea.summary.isNotEmpty()) {
            "Sáu giờ tới ${if (!sea.warn.isNullOrEmpty()) HinhHoc.thuongDau(sea.warn) else "${sea.summary}. ${seaSavedLine(sea.savedAt, nowMs)}"}"
        } else "Máy chưa lưu dự báo sóng gió vùng này."
        parts += if (coViTri) chartLine(chart) else CHUA_VI_TRI_LINE
        val u = urgentLine(urgent)
        if (u.isNotEmpty()) parts += u
        return parts.take(4).joinToString(" ")
    }

    val DEPTH_HERE_SHORT = mapOf(
        1 to "Dưới tàu là vùng rạn đá.",
        2 to "Nước dưới tàu dưới 2 mét.",
        3 to "Nước dưới tàu 2 đến 4 mét.",
        4 to "Nước dưới tàu 4 đến 12 mét.",
        5 to "Nước dưới tàu sâu trên 12 mét.",
    )

    /** = diemTin — null khi tàu đứng/neo hoặc chưa biết hướng. */
    fun diemTin(headingDeg: Double?, speedKmh: Double?, unit: DonViNoi, depthHere: Int?, sea: QuanSatBien?): String? {
        if (headingDeg == null || speedKmh == null || speedKmh < DinhVi.MIN_MOVING_KMH) return null
        val parts = mutableListOf("Tàu đang chạy hướng ${CauNoi.dirSpeech(headingDeg)}, ${CauNoi.speedSpeech(speedKmh, unit)}.")
        depthHere?.let { DEPTH_HERE_SHORT[it] }?.let { parts += it }
        if (sea != null && sea.summary.isNotEmpty()) parts += "${HinhHoc.hoaDau(sea.summary)}."
        parts += "Máy vẫn đang canh."
        return parts.joinToString(" ")
    }

    fun diemTinDue(lastDiemMs: Double, lastAlarmMs: Double, startMs: Double, nowMs: Double): Boolean {
        val base = maxOf(lastDiemMs, startMs)
        return nowMs - base >= DIEM_TIN_MS && nowMs - lastAlarmMs >= DIEM_TIN_QUIET_MS
    }
}
