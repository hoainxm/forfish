package vn.sdvico.forfish.shared.dangchay

import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.thoitiet.TheDiem
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/*
  CẢNH BÁO HIỂM HOẠ KHI ĐANG CHẠY — PORT Y src/lib/nav-hazards.ts (evaluateNavHazards, navThresholdsKm, navQueryKm,
  relDir, fmtDistDefault + mọi hằng). Thuần: mỗi fix gọi một lần, nhận ≤ 2 câu + cờ chuông/rung.
  Chỉ mục điểm: web dùng `SpatialIndex` (lưới ô) — ở đây là giao diện [ChiMucDiem]; bản quét thẳng [ChiMucDiem.quet]
  cho kết quả CÙNG TẬP + cùng thứ tự gần trước (hai vật cách tàu BẰNG NHAU tuyệt đối thì thứ tự có thể khác lưới ô).
  GHÉP SAU: chỉ mục lưới ô của `danduong` (spatial-index) cài [ChiMucDiem] là thay được, không đổi luật ở đây.
*/

/** = HazardLike (hazards.ts Hazard): rKm = bán kính chặn (đã ×2 nếu tin vừa). */
data class VatCan(
    val id: String,
    val lat: Double,
    val lon: Double,
    val rKm: Double,
    val loai: String,
    val ten: String?,
    val doSauM: Double?,
    val tinVua: Boolean,
)

/** Chỉ mục điểm: mọi vật trong bán kính, GẦN TRƯỚC (= queryRadius). */
interface ChiMucDiem {
    val count: Int
    fun quanh(center: ViTri, radiusKm: Double): List<Pair<VatCan, Double>>

    companion object {
        /** Quét thẳng — đủ cho vài nghìn vật; bỏ toạ độ hỏng như buildIndex. */
        fun quet(ds: List<VatCan>): ChiMucDiem = object : ChiMucDiem {
            private val ok = ds.filter { it.lat.isFinite() && it.lon.isFinite() && abs(it.lat) <= 90 && abs(it.lon) <= 180 }
            override val count = ok.size
            override fun quanh(center: ViTri, radiusKm: Double): List<Pair<VatCan, Double>> {
                if (ok.isEmpty() || !radiusKm.isFinite() || radiusKm <= 0 || !center.lat.isFinite() || !center.lon.isFinite()) return emptyList()
                return ok.mapNotNull { h -> HinhHoc.haversineKm(center, ViTri(h.lat, h.lon)).takeIf { it <= radiusKm }?.let { h to it } }
                    .sortedBy { it.second }
            }
        }
    }
}

/** = NavAlert — bac 1 tính mạng · 2 ranh giới · 3 tài sản/lưới · 4 tin; muc "do" | "vang" | "tin". */
data class CanhBaoChay(
    val id: String,
    val bac: Int,
    val muc: String,
    val cau: String,
    val chuong: Boolean,
    val rung: Boolean,
    val distKm: Double,
    val etaMin: Double?,
)

/** = NavHazardInput — depthAt: lớp 0 đất · 1 rạn · 2 <2 m · 3 2–4 m · 4 4–12 m · 5 sâu; nameAt kind "bo" | "ran". */
data class DauVaoHiemHoa(
    val pos: ViTri,
    val headingDeg: Double?,
    val speedKmh: Double?,
    val accuracyM: Double?,
    val nowMs: Double,
    val draftM: Double? = null,
    val needM: Double?,
    val status: TrangThaiGps,
    val ix: ChiMucDiem?,
    val noGo: List<VungCamVao>?,
    val depthAt: ((Double, Double) -> Int?)?,
    val nearestCableKm: Double?,
    val insideRestricted: String?,
    val borderNm: Double?,
    val fmtDist: ((Double) -> String)? = null,
    val nameAt: ((Double, Double, String) -> String?)? = null,
)

/** = SaidEntry */
data class DaNoi(val step: Int, val lastMs: Double, val lat: Double, val lon: Double, val lastKm: Double, val away: Int)

/** = NavHazardState */
data class TrangThaiHiemHoa(
    val said: Map<String, DaNoi>,
    val lastChimeMs: Double,
    val lastRungMs: Double,
    val slowSinceMs: Double?,
    val cableSaidMs: Double,
    val restrictedSaidMs: Double,
    val lastAlerts: List<CanhBaoChay>,
    val lastAlertMs: Double,
)

object HiemHoa {
    val NAV_HAZARD_STEPS_MIN = doubleArrayOf(10.0, 3.0)
    val NAV_HAZARD_FLOOR_KM = doubleArrayOf(2.0, 0.5)
    const val NAV_CHIME_COOLDOWN_MS = 20_000.0
    const val NAV_RUNG_COOLDOWN_MS = 30_000.0
    const val NAV_ANCHOR_MS = 5 * 60 * 1000.0
    const val NAV_SLOW_KMH = 5.6
    const val NAV_SLOW_REPEAT_MS = 10 * 60 * 1000.0
    const val NAV_FORGET_MS = 30 * 60 * 1000.0
    const val NAV_QUERY_KM = 3.7
    const val NAV_QUERY_PAD_KM = 1.5
    const val NAV_CONE_HALF_DEG = 15.0
    const val NAV_CONE_STEP_KM = 0.4
    const val NAV_NOGO_RED_KM = 0.5
    const val NAV_NOGO_YELLOW_KM = 1.852
    const val NAV_CABLE_KM = 0.5
    const val NAV_ACC_DOWNGRADE_M = 150.0
    const val NAV_ACC_MUTE_M = 500.0
    const val NAV_CLUSTER_KM = 1.0
    private const val AWAY_FIXES = 3
    private const val AWAY_EPS_KM = 0.02
    const val NAV_LOST_KEEP_MS = 10 * 60 * 1000.0
    const val NAV_LOST_TICK_MS = 30 * 1000.0
    private const val KM_PER_NM = 1.852
    private const val KM_PER_DEG = (PI / 180) * 6371

    fun navQueryKm(thrVangKm: Double) = if (thrVangKm.isFinite()) max(NAV_QUERY_KM, thrVangKm + NAV_QUERY_PAD_KM) else NAV_QUERY_KM

    fun initNavHazardState() = TrangThaiHiemHoa(
        emptyMap(), Double.NEGATIVE_INFINITY, Double.NEGATIVE_INFINITY, null,
        Double.NEGATIVE_INFINITY, Double.NEGATIVE_INFINITY, emptyList(), Double.NEGATIVE_INFINITY,
    )

    /** "600 m" dưới 1 km, "1,5 hải lý" từ 1 km */
    fun fmtDistDefault(km: Double): String {
        if (km < 1) return "${Js.inSo(max(50.0, Js.round((km * 1000) / 50) * 50))} m"
        val nm = km / KM_PER_NM
        val s = TheDiem.toFixed(Js.round(nm * 10) / 10, 1).replace(Regex("\\.0$"), "")
        return "${s.replaceFirst(".", ",")} hải lý"
    }

    private fun tenVat(h: VatCan): String {
        val ten = if (!h.ten.isNullOrEmpty()) " ${h.ten}" else ""
        return when (h.loai) {
            "xac-tau" -> "Xác tàu$ten"
            "gian-khoan" -> "Giàn khoan$ten"
            "vat-chim" -> "Vật chìm$ten"
            "phao-nguy-hiem" -> "Phao báo nguy hiểm$ten"
            "long-be" -> "Lồng bè$ten"
            else -> "Chướng ngại$ten"
        }
    }

    /** = relDir: "phía trước" | "bên trái" | "bên phải" | "phía sau" | null */
    fun relDir(headingDeg: Double?, bearingToDeg: Double): String? {
        if (headingDeg == null || !headingDeg.isFinite()) return null
        val d = HinhHoc.angleDiffDeg(bearingToDeg, headingDeg)
        val m = abs(d)
        if (m <= 45) return "phía trước"
        if (m <= 135) return if (d > 0) "bên phải" else "bên trái"
        return "phía sau"
    }

    private fun fmtM(m: Double) = HinhHoc.soPhay(Js.round(m * 10) / 10)

    private class Cand(
        val id: String,
        val bac: Int,
        val step: Int,
        val edgeKm: Double,
        val dir: String?,
        val etaMin: Double?,
        var cau: String,
        val point: Boolean,
        val lat: Double,
        val lon: Double,
        var members: List<String> = emptyList(),
    )

    private class Seen(val id: String, val bac: Int, val edgeKm: Double, val dir: String?, val lat: Double, val lon: Double)

    /** = navThresholdsKm ⇒ [vàng, đỏ] */
    fun navThresholdsKm(speedKmh: Double?, accuracyM: Double?): DoubleArray {
        val v = if (speedKmh != null && speedKmh.isFinite() && speedKmh > 0) speedKmh else 0.0
        val acc = if (accuracyM != null && accuracyM.isFinite() && accuracyM > 0) accuracyM / 1000 else 0.0
        return doubleArrayOf(
            max(NAV_HAZARD_FLOOR_KM[0], (v * NAV_HAZARD_STEPS_MIN[0]) / 60) + acc,
            max(NAV_HAZARD_FLOOR_KM[1], (v * NAV_HAZARD_STEPS_MIN[1]) / 60) + acc,
        )
    }

    private fun stepFor(edgeKm: Double, thr: DoubleArray) = if (edgeKm <= thr[1]) 2 else if (edgeKm <= thr[0]) 1 else 0

    private fun offsetKm(p: ViTri, bDeg: Double, dKm: Double): ViTri {
        val b = (bDeg * PI) / 180
        return ViTri(p.lat + (dKm * cos(b)) / KM_PER_DEG, p.lon + (dKm * sin(b)) / (KM_PER_DEG * cos((p.lat * PI) / 180)))
    }

    private fun noGoDistance(pos: ViTri, z: VungCamVao, padKm: Double): Pair<Boolean, Double>? {
        val padLat = padKm / KM_PER_DEG
        val padLon = padKm / (KM_PER_DEG * cos((pos.lat * PI) / 180))
        if (pos.lat < z.bbox.latMin - padLat || pos.lat > z.bbox.latMax + padLat ||
            pos.lon < z.bbox.lonMin - padLon || pos.lon > z.bbox.lonMax + padLon
        ) return null
        val ring = z.ring
        if (ring.size < 3) return null
        val inside = HinhHoc.pointInRing(pos, ring)
        var best = Double.POSITIVE_INFINITY
        var j = ring.size - 1
        for (i in ring.indices) {
            val d = HinhHoc.distToSegment(pos, ViTri(ring[j][1], ring[j][0]), ViTri(ring[i][1], ring[i][0])).first
            if (d < best) best = d
            j = i
        }
        return inside to best
    }

    /** = evaluateNavHazards ⇒ (≤ 2 câu nặng nhất trước, trạng thái mới). `prev` không bị sửa. */
    fun evaluateNavHazards(prev: TrangThaiHiemHoa, input: DauVaoHiemHoa): Pair<List<CanhBaoChay>, TrangThaiHiemHoa> {
        val nowMs = input.nowMs
        if (input.status == TrangThaiGps.LOST) {
            val fresh = nowMs.isFinite() && nowMs - prev.lastAlertMs <= NAV_LOST_KEEP_MS
            return (if (fresh) prev.lastAlerts.map { it.copy(chuong = false, rung = false) } else emptyList()) to prev
        }
        if (input.status != TrangThaiGps.TRACKING) return emptyList<CanhBaoChay>() to prev.copy(lastAlerts = emptyList(), lastAlertMs = Double.NEGATIVE_INFINITY)
        val pos = input.pos
        if (!pos.lat.isFinite() || !pos.lon.isFinite() || !nowMs.isFinite()) return emptyList<CanhBaoChay>() to prev

        val speed = input.speedKmh?.takeIf { it.isFinite() && it >= 0 }
        val acc = input.accuracyM?.takeIf { it.isFinite() && it > 0 } ?: 0.0
        val moving = speed != null && speed >= DinhVi.MIN_MOVING_KMH
        val heading = input.headingDeg?.takeIf { it.isFinite() }
        val fmt = input.fmtDist ?: ::fmtDistDefault

        val slowSinceMs = if (moving) null else (prev.slowSinceMs ?: nowMs)
        val anchored = slowSinceMs != null && nowMs - slowSinceMs > NAV_ANCHOR_MS

        val said = LinkedHashMap(prev.said)
        var lastChimeMs = prev.lastChimeMs
        var lastRungMs = prev.lastRungMs
        var cableSaidMs = prev.cableSaidMs
        var restrictedSaidMs = prev.restrictedSaidMs
        fun trangThai(alerts: List<CanhBaoChay>, lastAlertMs: Double) =
            TrangThaiHiemHoa(said, lastChimeMs, lastRungMs, slowSinceMs, cableSaidMs, restrictedSaidMs, alerts, lastAlertMs)

        if (acc > NAV_ACC_MUTE_M) return emptyList<CanhBaoChay>() to trangThai(prev.lastAlerts, prev.lastAlertMs)

        val thr = navThresholdsKm(speed, acc)
        val degraded = acc > NAV_ACC_DOWNGRADE_M
        val accSuffix = if (degraded) " (định vị lệch ±${Js.inSo(Js.round(acc))} m)" else ""

        val it0 = said.entries.iterator()
        while (it0.hasNext()) {
            val (_, e) = it0.next()
            if (nowMs - e.lastMs > NAV_FORGET_MS) { it0.remove(); continue }
            if (HinhHoc.haversineKm(pos, ViTri(e.lat, e.lon)) > 2 * thr[0]) it0.remove()
        }

        val cands = mutableListOf<Cand>()
        val seen = mutableListOf<Seen>()

        fun observe(id: String, edgeKm: Double, at: ViTri): Int? {
            val step = stepFor(edgeKm, thr)
            var e = said[id]
            if (e == null) {
                e = DaNoi(0, nowMs, at.lat, at.lon, edgeKm, 0)
            } else {
                e = e.copy(away = if (edgeKm > e.lastKm + AWAY_EPS_KM) e.away + 1 else 0, lastKm = edgeKm)
            }
            said[id] = e
            if (step == 0 || step <= e.step) return null
            if (e.away >= AWAY_FIXES) return null
            return step
        }

        // (1) vật cản điểm
        val ix = input.ix
        if (ix != null && ix.count > 0) {
            for ((h, km) in ix.quanh(pos, navQueryKm(thr[0]))) {
                val edge = max(0.0, km - (if (h.rKm.isFinite()) h.rKm else 0.0))
                val r = observe(h.id, edge, ViTri(h.lat, h.lon))
                if (anchored) continue
                val bac = if (h.doSauM != null && input.needM != null && h.doSauM >= input.needM) 3 else 1
                val dir = relDir(heading, HinhHoc.bearingDeg(pos, ViTri(h.lat, h.lon)))
                seen += Seen(h.id, bac, edge, dir, h.lat, h.lon)
                if (r == null) continue
                val eta = if (dir == "phía trước" && moving && speed != null && speed != 0.0) Js.round((edge / speed) * 60) else null
                val where = if (dir != null) "$dir chừng ${fmt(edge)}" else "cách chừng ${fmt(edge)}"
                val nuoc = if (h.doSauM != null) " — nước trên vật ${fmtM(h.doSauM)} m" else ""
                val gian = if (h.loai == "gian-khoan") " — không vào trong 500 m" else ""
                val vua = if (h.tinVua) " (vị trí gần đúng)" else ""
                cands += Cand(
                    h.id, bac, r, edge, dir, eta,
                    if (edge <= 0.05) "${tenVat(h)} ngay sát tàu$nuoc$vua." else "${tenVat(h)} $where$nuoc$gian$vua.",
                    true, h.lat, h.lon,
                )
            }
        }

        // (2) nón phía trước
        val depthAt = input.depthAt
        if (depthAt != null && heading != null && !anchored) {
            val l = max(NAV_HAZARD_FLOOR_KM[0], if (speed != null) (speed * NAV_HAZARD_STEPS_MIN[0]) / 60 else 0.0)
            val n = ceil(l / NAV_CONE_STEP_KM).toInt()
            var dBo = Double.POSITIVE_INFINITY
            var dRan = Double.POSITIVE_INFINITY
            var dCan2 = Double.POSITIVE_INFINITY
            var dCan4 = Double.POSITIVE_INFINITY
            var pBo: ViTri? = null
            var pRan: ViTri? = null
            for (k in 1..n) {
                val d = k * NAV_CONE_STEP_KM
                for (t in -1..1) {
                    val p = offsetKm(pos, heading + t * NAV_CONE_HALF_DEG, d)
                    val c = depthAt(p.lat, p.lon) ?: continue
                    when (c) {
                        0 -> { if (d < dBo || (d == dBo && t == 0)) pBo = p; dBo = min(dBo, d) }
                        1 -> { if (d < dRan || (d == dRan && t == 0)) pRan = p; dRan = min(dRan, d) }
                        2 -> dCan2 = min(dCan2, d)
                        3 -> dCan4 = min(dCan4, d)
                    }
                }
            }
            fun pushDepth(id: String, d: Double, bac: Int, cau: (String) -> String) {
                if (!d.isFinite()) return
                val r = observe(id, d, pos) ?: return
                cands += Cand(
                    id, bac, r, d, "phía trước",
                    if (moving && speed != null && speed != 0.0) Js.round((d / speed) * 60) else null,
                    cau(fmt(d)), false, pos.lat, pos.lon,
                )
            }
            val nameAt = input.nameAt
            val tenBo = if (pBo != null && nameAt != null) nameAt(pBo.lat, pBo.lon, "bo") else null
            val tenRan = if (pRan != null && nameAt != null) nameAt(pRan.lat, pRan.lon, "ran") else null
            pushDepth("day:bo", dBo, 1) { s -> if (!tenBo.isNullOrEmpty()) "Phía trước chừng $s là $tenBo." else "Phía trước chừng $s là bờ hoặc đảo." }
            pushDepth("day:ran", dRan, 1) { s -> if (!tenRan.isNullOrEmpty()) "Phía trước chừng $s có rạn đá — $tenRan." else "Phía trước chừng $s có rạn đá." }
            pushDepth("day:can2", dCan2, 1) { s -> "Phía trước chừng $s nước rất cạn — chưa tới 2 m." }
            if (input.needM == null || input.needM > 2) {
                pushDepth("day:can4", dCan4, 1) { s -> "Phía trước chừng $s nước cạn — chưa tới 4 m." }
            } else {
                pushDepth("day:can4", dCan4, 4) { s -> "Phía trước chừng $s nước chừng 2–4 m." }
            }
        }

        // (3) vùng cấm vào
        val noGo = input.noGo
        if (!noGo.isNullOrEmpty() && !anchored) {
            for (z in noGo) {
                val (inside, km) = noGoDistance(pos, z, NAV_NOGO_YELLOW_KM) ?: continue
                val edge = if (inside) 0.0 else km
                if (edge > NAV_NOGO_YELLOW_KM) continue
                val step = if (inside || edge <= NAV_NOGO_RED_KM) 2 else 1
                val e = said[z.id]
                if (e != null && step <= e.step) continue
                said[z.id] = DaNoi(e?.step ?: 0, e?.lastMs ?: nowMs, pos.lat, pos.lon, edge, 0)
                val ten = z.ten ?: "vùng cấm vào"
                cands += Cand(
                    z.id, 1, step, edge, null, null,
                    if (inside) "Đang trong $ten." else "${HinhHoc.hoaDau(ten)} cách chừng ${fmt(edge)}.",
                    false, pos.lat, pos.lon,
                )
            }
        }

        // (4) cáp ngầm / vùng cấm neo
        val slow = speed == null || speed < NAV_SLOW_KMH
        if (slow && !anchored) {
            val cap = input.nearestCableKm
            if (cap != null && cap <= NAV_CABLE_KM && nowMs - prev.cableSaidMs >= NAV_SLOW_REPEAT_MS) {
                cands += Cand("cap-ngam", 3, 1, max(0.0, cap), null, null, "Đang trên cáp ngầm — đừng neo, đừng thả giã.", false, pos.lat, pos.lon)
            }
            val ir = input.insideRestricted
            if (!ir.isNullOrEmpty() && nowMs - prev.restrictedSaidMs >= NAV_SLOW_REPEAT_MS) {
                cands += Cand("cam-neo", 3, 1, 0.0, null, null, "Đang trong $ir — đừng neo, đừng thả lưới ở đây.", false, pos.lat, pos.lon)
            }
        }

        if (cands.isEmpty()) return emptyList<CanhBaoChay>() to trangThai(prev.lastAlerts, prev.lastAlertMs)

        // (5) gom cụm
        val sorted = cands.sortedWith(compareBy<Cand> { it.bac }.thenByDescending { it.step }.thenBy { it.edgeKm })
        val merged = mutableListOf<Cand>()
        val used = HashSet<String>()
        for (a in sorted) {
            if (a.id in used) continue
            used += a.id
            val members = mutableListOf(a.id)
            var sameDir = true
            if (a.point) {
                for (b in seen) {
                    if (b.id == a.id || b.id in used || b.bac != a.bac) continue
                    if ((said[b.id]?.step ?: 0) >= a.step) continue
                    if (HinhHoc.haversineKm(ViTri(a.lat, a.lon), ViTri(b.lat, b.lon)) > NAV_CLUSTER_KM) continue
                    used += b.id
                    members += b.id
                    if (b.dir != a.dir) sameDir = false
                }
            }
            val c = Cand(a.id, a.bac, a.step, a.edgeKm, a.dir, a.etaMin, a.cau, a.point, a.lat, a.lon, members)
            if (members.size >= 2) {
                val where = if (sameDir && a.dir != null) a.dir else "quanh tàu"
                c.cau = "${members.size} chướng ngại $where, gần nhất chừng ${fmt(a.edgeKm)}."
            }
            merged += c
        }

        // (6) trần: 1 đỏ + 1 vàng/tin
        fun toMuc(c: Cand) = if (c.bac == 4) "tin" else if (c.bac == 1 && c.step == 2 && !degraded) "do" else "vang"
        var red: Cand? = null
        var other: Cand? = null
        for (c in merged) {
            if (toMuc(c) == "do") { if (red == null) red = c } else if (other == null) other = c
        }
        val borderRedActive = input.borderNm != null && input.borderNm <= 6
        val alerts = mutableListOf<CanhBaoChay>()
        fun emit(c: Cand) {
            val muc = toMuc(c)
            val newRed = muc == "do"
            var chuong = false
            var rung = false
            if (c.bac == 1) {
                chuong = (newRed || nowMs - lastChimeMs >= NAV_CHIME_COOLDOWN_MS) && (newRed || !borderRedActive)
                rung = newRed || nowMs - lastRungMs >= NAV_RUNG_COOLDOWN_MS
            } else if (c.bac == 3) {
                rung = nowMs - lastRungMs >= NAV_RUNG_COOLDOWN_MS
            }
            if (chuong) lastChimeMs = nowMs
            if (rung) lastRungMs = nowMs
            val cau = if (degraded && c.bac == 1 && c.step == 2) c.cau.replace(Regex("\\.$"), "") + accSuffix + "." else c.cau
            alerts += CanhBaoChay(if (c.members.size > 1) c.members.joinToString("+") else c.id, c.bac, muc, cau, chuong, rung, c.edgeKm, c.etaMin)
            for (id in c.members) {
                when (id) {
                    "cap-ngam" -> cableSaidMs = nowMs
                    "cam-neo" -> restrictedSaidMs = nowMs
                    else -> said[id]?.let { said[id] = it.copy(step = c.step, lastMs = nowMs) }
                }
            }
        }
        red?.let { emit(it) }
        other?.let { emit(it) }
        return alerts to trangThai(alerts, nowMs)
    }
}
