package vn.sdvico.forfish.shared.ais

import kotlinx.serialization.json.JsonObject
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.thoitiet.TheDiem
import kotlin.math.PI
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

/*
  CHẾ ĐỘ AIS — RADAR + CPA/TCPA (đợt 2e). PORT Y src/lib/ais-cpa.ts: ước vị trí theo tuổi tin, CPA/TCPA trên mặt phẳng
  tiếp tuyến quanh tàu mình, xếp mức, câu tóm tắt, GeoJSON lớp `ais-radar` (vòng tầm) + `ais-radar-tau` (mục tiêu,
  vạch vận tốc, đường nối CPA). THAM KHẢO từ bản cập nhật chậm — không thay canh chừng bằng mắt và radar trên tàu.
  `vongTron` = storm-track.ts (64 đỉnh, R 6.371 km). Cổng khớp: jvmTest/resources/ais/cpa.json ⇒ AisVangTest.
*/

data class LatLon(val lat: Double, val lon: Double)

data class TauMinh(
    val pos: LatLon,
    /** km/h — null/0 = đứng */
    val speedKmh: Double?,
    /** 0–360, null = chưa rõ */
    val headingDeg: Double?,
)

/** "nguy" | "canh" | "an" | "dung" */
data class MucTieu(
    val tau: TauAis,
    /** vị trí đã ước tới hiện tại */
    val pos: LatLon,
    val cachNm: Double,
    val phuongVi: Double,
    val cpaNm: Double?,
    /** phút; âm = đã qua điểm gần nhất */
    val tcpaPhut: Double?,
    val muc: String,
    val tuoiPhut: Double,
    val tinCu: Boolean,
    val cpaMinh: LatLon?,
    val cpaTau: LatLon?,
)

/** muc: "nguy" | "canh" | "an" | "chua-gps" */
data class TomTatNguyCo(val muc: String, val cau: String)

object RadarCpa {
    const val KM_PER_NM = 1.852
    const val UOC_TOI_DA_PHUT = 30.0
    const val TIN_CU_PHUT = 30.0
    const val DUNG_KN = 0.5
    const val NGUY_CPA_NM = 0.5
    const val NGUY_TCPA_PHUT = 20.0
    const val CANH_CPA_NM = 1.5
    const val CANH_TCPA_PHUT = 30.0
    val TAM_RADAR_NM: List<Double> = listOf(2.0, 4.0, 6.0, 12.0, 24.0)
    /** vạch vận tốc = quãng đi trong chừng này phút (mặc định máy AIS) */
    const val VECTOR_PHUT = 6.0
    val MUC: List<String> = listOf("nguy", "canh", "an", "dung")
    val MAU_MUC: Map<String, String> get() = LopAisSinh.MAU_MUC
    val MUC_LABEL: Map<String, String> get() = LopAisSinh.MUC_LABEL

    private fun rad(d: Double) = d * PI / 180
    private fun deg(r: Double) = r * 180 / PI

    data class XY(val x: Double, val y: Double)
    data class VanToc(val vx: Double, val vy: Double)

    /** Độ lệch (đông, bắc) của `p` so với `goc`, hải lý. */
    fun lechNm(goc: LatLon, p: LatLon): XY {
        val y = (p.lat - goc.lat) * 60
        var dLon = p.lon - goc.lon
        if (dLon > 180) dLon -= 360
        if (dLon < -180) dLon += 360
        val x = dLon * 60 * cos(rad((p.lat + goc.lat) / 2))
        return XY(x, y)
    }

    /** Điểm cách `goc` một đoạn (đông, bắc) hải lý. */
    fun congNm(goc: LatLon, x: Double, y: Double): LatLon {
        val lat = goc.lat + y / 60
        val c = cos(rad((lat + goc.lat) / 2))
        return LatLon(lat, goc.lon + (if (c > 1e-6) x / (60 * c) else 0.0))
    }

    /** Vận tốc (đông, bắc) hải lý/giờ. Hướng không rõ ⇒ coi như đứng. */
    fun vanToc(kn: Double?, huong: Double?): VanToc {
        if (kn == null || !kn.isFinite() || kn < DUNG_KN || huong == null || !huong.isFinite()) return VanToc(0.0, 0.0)
        return VanToc(kn * sin(rad(huong)), kn * cos(rad(huong)))
    }

    /** CPA (hải lý) / TCPA (phút) từ vị trí + vận tốc tương đối; null khi đứng yên tương đối. */
    fun cpaTcpa(r: XY, v: VanToc): Pair<Double?, Double?> {
        val v2 = v.vx * v.vx + v.vy * v.vy
        if (v2 < 1e-6) return null to null
        val tGio = -(r.x * v.vx + r.y * v.vy) / v2
        val cx = r.x + v.vx * tGio
        val cy = r.y + v.vy * tGio
        return AisJs.hypot(cx, cy) to tGio * 60
    }

    /** Tin cũ không bao giờ lên "nguy"/"canh". */
    fun xepMuc(cpaNm: Double?, tcpaPhut: Double?, tauKn: Double?, tinCu: Boolean): String {
        if (!tinCu && cpaNm != null && tcpaPhut != null && tcpaPhut >= 0) {
            if (cpaNm <= NGUY_CPA_NM && tcpaPhut <= NGUY_TCPA_PHUT) return "nguy"
            if (cpaNm <= CANH_CPA_NM && tcpaPhut <= CANH_TCPA_PHUT) return "canh"
        }
        if (tauKn == null || tauKn < DUNG_KN) return "dung"
        return "an"
    }

    private fun tuoiBanPhut(luc: String, now: Long): Double {
        val d = (now - AisJs.dateParse(luc)) / 60_000
        return if (d.isFinite()) max(0.0, d) else 0.0
    }

    /** Quét tàu trong `banKinhNm` quanh tàu mình ⇒ mục tiêu xếp nguy → canh → an → dung, cùng mức gần trước. */
    fun quetQuanh(ban: TauAisBan, minh: TauMinh, banKinhNm: Double, now: Long): List<MucTieu> {
        val tuoiBan = tuoiBanPhut(ban.luc, now)
        val minhKn = minh.speedKmh?.let { it / KM_PER_NM }
        val vm = vanToc(minhKn, minh.headingDeg)
        val thoDo = (banKinhNm + 15) / 60
        val cosLat = max(0.2, cos(rad(minh.pos.lat)))
        val out = mutableListOf<MucTieu>()
        for (t in ban.tau) {
            if (kotlin.math.abs(t.lat - minh.pos.lat) > thoDo || kotlin.math.abs(t.lon - minh.pos.lon) > thoDo / cosLat) continue
            val tuoiPhut = t.phut + tuoiBan
            val tinCu = tuoiPhut > TIN_CU_PHUT
            val vt = vanToc(t.kn, t.huong)
            val uoc = min(tuoiPhut, UOC_TOI_DA_PHUT) / 60
            val g = lechNm(minh.pos, LatLon(t.lat, t.lon))
            val r = XY(g.x + vt.vx * uoc, g.y + vt.vy * uoc)
            val cachNm = AisJs.hypot(r.x, r.y)
            if (cachNm > banKinhNm) continue
            val (cpaNm, tcpaPhut) = cpaTcpa(r, VanToc(vt.vx - vm.vx, vt.vy - vm.vy))
            val tG = if (tcpaPhut != null && tcpaPhut >= 0) tcpaPhut / 60 else null
            out += MucTieu(
                tau = t,
                pos = congNm(minh.pos, r.x, r.y),
                cachNm = cachNm,
                phuongVi = (deg(atan2(r.x, r.y)) + 360) % 360,
                cpaNm = cpaNm,
                tcpaPhut = tcpaPhut,
                muc = xepMuc(cpaNm, tcpaPhut, t.kn, tinCu),
                tuoiPhut = Js.round(tuoiPhut),
                tinCu = tinCu,
                cpaMinh = tG?.let { congNm(minh.pos, vm.vx * it, vm.vy * it) },
                cpaTau = tG?.let { congNm(minh.pos, r.x + vt.vx * it, r.y + vt.vy * it) },
            )
        }
        // sort ổn định (như Array.prototype.sort của V8)
        return out.sortedWith { a, b ->
            val d = MUC.indexOf(a.muc) - MUC.indexOf(b.muc)
            if (d != 0) d else a.cachNm.compareTo(b.cachNm).let { if (a.cachNm == b.cachNm) 0 else it }
        }
    }

    fun demMuc(ds: List<MucTieu>): Map<String, Int> {
        val d = MUC.associateWith { 0 }.toMutableMap()
        for (m in ds) d[m.muc] = d.getValue(m.muc) + 1
        return d
    }

    /** Chip lọc: "tat" tất cả · "gan" nguy + cảnh báo · "ca" tàu cá. */
    fun locMucTieu(ds: List<MucTieu>, loc: String): List<MucTieu> = when (loc) {
        "tat" -> ds
        "gan" -> ds.filter { it.muc == "nguy" || it.muc == "canh" }
        else -> ds.filter { AisTau.nhomTau(it.tau.loai) == "ca" }
    }

    fun tomTatNguyCo(ds: List<MucTieu>, coGps: Boolean, tamNm: Double): TomTatNguyCo {
        if (!coGps) return TomTatNguyCo("chua-gps", "Bật định vị để biết tàu nào tới gần")
        val d = demMuc(ds)
        if (d.getValue("nguy") > 0) return TomTatNguyCo("nguy", "${d["nguy"]} tàu sắp đi sát dưới ${quangNgan(NGUY_CPA_NM)} · trong ${Js.inSo(NGUY_TCPA_PHUT)} phút")
        if (d.getValue("canh") > 0) return TomTatNguyCo("canh", "${d["canh"]} tàu đang tới gần · trong ${Js.inSo(CANH_TCPA_PHUT)} phút")
        return TomTatNguyCo("an", if (ds.isEmpty()) "Không có tàu nào trong ${Js.inSo(tamNm)} hải lý" else "Không tàu nào tới gần · ${ds.size} tàu trong tầm")
    }

    /** Hướng chữ 8 hướng ("Đông Bắc"). */
    fun huongChu(deg: Double): String = TheDiem.windDirectionVN(deg)

    /** Dưới 1 km nói mét (tròn 10 m, tối thiểu 10), còn lại km một số lẻ. */
    fun quangNgan(nm: Double): String {
        val km = nm * KM_PER_NM
        if (km < 1) return "${Js.inSo(max(10.0, Js.round(km * 1000 / 10) * 10))} m"
        return "${AisJs.soVi(km, 1)} km"
    }

    fun dongPhuTau(m: MucTieu, coGps: Boolean): String {
        if (coGps && !m.tinCu && (m.muc == "nguy" || m.muc == "canh") && m.cpaNm != null && m.tcpaPhut != null) {
            return "Đi sát ${quangNgan(m.cpaNm)} sau ${tcpaLabel(m.tcpaPhut)}"
        }
        val p = mutableListOf("Cách ${hlLabel(m.cachNm)} · phía ${huongChu(m.phuongVi)}")
        if (m.muc == "dung") p += "đang đứng"
        if (m.tinCu) p += "tin cũ"
        return p.joinToString(" · ")
    }

    /** "0,35 hải lý" (dưới 1) / "3,2 hải lý" */
    fun hlLabel(nm: Double): String = "${if (nm < 1) AisJs.soVi(nm, 2, 2) else AisJs.soVi(nm, 1, 1)} hải lý"

    /** "đã qua", "12 phút", "1 giờ 05"; null ⇒ "không đổi". */
    fun tcpaLabel(phut: Double?): String {
        if (phut == null) return "không đổi"
        if (phut < 0) return "đã qua"
        val p = Js.round(phut)
        if (p < 60) return "${Js.inSo(p)} phút"
        return "${Js.inSo(floor(p / 60))} giờ ${Js.inSo(p % 60).padStart(2, '0')}"
    }

    /** nguy đỏ, cảnh báo vàng, còn lại theo loại tàu. */
    fun mauMucTieu(m: MucTieu): String =
        if (m.muc == "nguy" || m.muc == "canh") MAU_MUC.getValue(m.muc) else AisTau.MAU_TAU.getValue(AisTau.nhomTau(m.tau.loai))

    /** = vongTron (storm-track.ts): `dinh` đỉnh + đỉnh đầu lặp lại cuối, [lon, lat]. */
    internal fun vongTron(lat: Double, lon: Double, km: Double, dinh: Int = 64): List<Pair<Double, Double>> {
        val p1 = rad(lat)
        val l1 = rad(lon)
        val d = km / 6371
        val ring = mutableListOf<Pair<Double, Double>>()
        for (i in 0 until dinh) {
            val huong = (2 * PI * i) / dinh
            val p2 = asin(sin(p1) * cos(d) + cos(p1) * sin(d) * cos(huong))
            val l2 = l1 + atan2(sin(huong) * sin(d) * cos(p1), cos(d) - sin(p1) * sin(p2))
            ring += deg(l2) to deg(p2)
        }
        ring += ring[0]
        return ring
    }

    /** Lớp `ais-radar`: ba vòng tầm (kind "vong", `ngoai` vòng 3) + nhãn "2 hl · 3,7 km" đỉnh Bắc + vạch mũi tàu. */
    fun radarGeoJson(tam: LatLon, tamNm: Double, huong: Double?): JsonObject {
        val f = mutableListOf<JsonObject>()
        for (i in 1..3) {
            val nm = (tamNm * i) / 3
            val ring = vongTron(tam.lat, tam.lon, nm * KM_PER_NM)
            f += Geo.duong(ring + ring[0], Geo.props("kind" to "vong", "ngoai" to (i == 3)))
            val dinh = congNm(tam, 0.0, nm)
            f += Geo.diem(dinh.lon, dinh.lat, Geo.props("kind" to "nhan", "nhan" to "${AisJs.soVi(nm, 1)} hl · ${AisJs.soVi(nm * KM_PER_NM, 1)} km"))
        }
        if (huong != null && huong.isFinite()) {
            val r = huong * PI / 180
            val mui = congNm(tam, tamNm * sin(r), tamNm * cos(r))
            f += Geo.duong(listOf(tam.lon to tam.lat, mui.lon to mui.lat), Geo.props("kind" to "mui"))
        }
        return Geo.tap(f)
    }

    /** Lớp `ais-radar-tau`: vạch quãng đi VECTOR_PHUT phút (vec) + chấm (tau) + đường nối CPA và số phút (cpa, cpa-nhan). */
    fun mucTieuGeoJson(ds: List<MucTieu>, chonId: String?): JsonObject {
        val f = mutableListOf<JsonObject>()
        for (m in ds) {
            val chon = if (m.tau.id == chonId) 1 else 0
            fun p(kind: String, nhan: String? = null): JsonObject {
                val ps = mutableListOf<Pair<String, Any?>>("kind" to kind)
                if (nhan != null) ps += "nhan" to nhan
                ps += listOf(
                    "id" to m.tau.id,
                    "mau" to mauMucTieu(m),
                    "mk" to (if (m.muc == "nguy" || m.muc == "canh") m.muc else AisTau.nhomTau(m.tau.loai)),
                    "huong" to (m.tau.mui ?: m.tau.huong ?: 0.0),
                    "chay" to (if (AisTau.tauDangChay(m.tau)) 1 else 0),
                    "muc" to m.muc,
                    "chon" to chon,
                    "cu" to (if (m.tinCu) 1 else 0),
                )
                return Geo.props(*ps.toTypedArray())
            }
            val v = vanToc(m.tau.kn, m.tau.huong)
            if (v.vx != 0.0 || v.vy != 0.0) {
                val den = congNm(m.pos, v.vx * VECTOR_PHUT / 60, v.vy * VECTOR_PHUT / 60)
                f += Geo.duong(listOf(m.pos.lon to m.pos.lat, den.lon to den.lat), p("vec"))
            }
            f += Geo.diem(m.pos.lon, m.pos.lat, p("tau"))
            val a = m.cpaMinh
            val b = m.cpaTau
            if (!m.tinCu && a != null && b != null && m.tcpaPhut != null && (m.muc == "nguy" || m.muc == "canh" || chon == 1)) {
                f += Geo.duong(listOf(a.lon to a.lat, b.lon to b.lat), p("cpa"))
                f += Geo.diem((a.lon + b.lon) / 2, (a.lat + b.lat) / 2, p("cpa-nhan", "${Js.inSo(Js.round(m.tcpaPhut))} phút"))
            }
        }
        return Geo.tap(f)
    }

    /** Khung bao vòng ngoài [[tây, nam], [đông, bắc]]. */
    fun khungRadar(tam: LatLon, tamNm: Double): Pair<LatLon, LatLon> = congNm(tam, -tamNm, -tamNm) to congNm(tam, tamNm, tamNm)
}
