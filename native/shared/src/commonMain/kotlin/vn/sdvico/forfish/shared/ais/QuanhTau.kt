package vn.sdvico.forfish.shared.ais

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import vn.sdvico.forfish.shared.bando.HaiDo
import vn.sdvico.forfish.shared.bando.Js
import kotlin.math.floor
import kotlin.math.max

/*
  TÀU QUANH MỘT ĐIỂM — 6 HẢI LÝ, 6 GIỜ QUA (đợt 2e). PORT Y src/lib/tau-ais-quanh.ts: gộp lộ trình theo giờ (hàng hàm SQL
  `tau_ais_quanh`, chỉ máy chủ có) + bản ~10 phút ⇒ danh sách tàu đang ở / đã qua, nhãn trạng thái, lọc bằng icon, lớp
  `ais-quanh`. Trên máy chỉ dùng nhánh lùi (mất sóng): `gopTauQuanh(vet = [], bản lưu)`. Cổng khớp: quanh.json.
*/

/** Mốc gần điểm nhất. `huong` = độ mũi/hướng đi khi đang chạy, null khi đứng/không rõ. */
data class MocGan(val t: Double, val lat: Double, val lon: Double, val nm: Double, val huong: Double?)
data class ViTriQuanh(val lat: Double, val lon: Double, val nm: Double, val huong: Double?)

data class TauQuanh(
    val id: String,
    val ten: String?,
    /** như TauAis; tàu chỉ có trong lộ trình ⇒ 0 */
    val loai: Int,
    val co: String?,
    val mmsi: Double?,
    val gan: MocGan,
    /** mốc cuối còn trong vòng (epoch giây) */
    val cuoi: Double,
    /** mốc đầu trong vòng; bản máy chủ cũ thiếu ⇒ null */
    val dau: Double?,
    val conPhat: Boolean,
    /** vị trí mới nhất còn trong vòng ⇒ tàu ĐANG ở đây */
    val oDay: Boolean,
    val hienTai: ViTriQuanh?,
)

data class KetQuaQuanh(
    val tam: LatLon,
    /** bản dùng để ghép tên — ISO */
    val luc: String?,
    val tau: List<TauQuanh>,
    /** chỉ có bản (không có lộ trình 6 giờ) */
    val chiBan: Boolean,
    /** dùng bản lưu trong máy (mất sóng) */
    val tuMay: Boolean,
)

/** null = không lọc chiều đó. `nhom` ∈ AisTau.NHOM. */
data class LocQuanh(val nhom: String? = null, val o: Boolean? = null)

data class DemLocQuanh(val o: Int, val qua: Int, val nhom: List<Pair<String, Int>>)

/** tham số hàm SQL `tau_ais_quanh` */
data class ThamSoQuanh(val pLat: Double, val pLon: Double, val pKm: Double, val pTu: Double)

data class TrangThaiQuanh(val oDay: Boolean, val chip: String, val cau: String)

object QuanhTau {
    const val QUANH_NM = 6.0
    const val QUANH_GIO = 6.0
    val LOC_TRONG = LocQuanh()

    /** Tham số hàm SQL (p_lat, p_lon, p_km, p_tu) — hộp lọc thô rộng hơn vòng 5 %. */
    fun thamSoQuanh(tam: LatLon, nowMs: Double, nm: Double = QUANH_NM, gio: Double = QUANH_GIO): ThamSoQuanh =
        ThamSoQuanh(tam.lat, tam.lon, nm * RadarCpa.KM_PER_NM * 1.05, floor(nowMs / 1000) - gio * 3600)

    fun tamHopLe(lat: Double, lon: Double): Boolean = lat.isFinite() && lon.isFinite() && lat >= -1 && lat <= 26 && lon >= 98 && lon <= 123

    private class Dang(
        val id: String, val ten: String?, val loai: Int, val co: String?, val mmsi: Double?,
        var gan: MocGan, var cuoi: Double, var dau: Double, val conPhat: Boolean, var oDay: Boolean, var hienTai: ViTriQuanh?,
    )

    /**
     * Gộp lộ trình + bản ⇒ tàu đã phát AIS trong `nm` hải lý quanh `tam` từ `tuGiay`. `vet` = hàng thô
     * `{tau_id, diem: [[epoch_s, lat, lon, kn, hướng], …]}` (ép số kiểu JS `Number`). ĐANG ở lên đầu (gần trước),
     * rồi đã qua — mới qua trước.
     */
    fun gopTauQuanh(vet: List<JsonElement?>, ban: TauAisBan?, tam: LatLon, tuGiay: Double, nm: Double = QUANH_NM): List<TauQuanh> {
        val out = LinkedHashMap<String, Dang>()
        val meta = HashMap<String, TauAis>()
        ban?.tau?.forEach { meta[it.id] = it } // Map của web: id trùng ⇒ tàu SAU thắng
        fun ghi(id: String, t: Double, lat: Double, lon: Double, huong: Double?, moiNhat: Boolean = false) {
            if (!(t >= tuGiay)) return
            val d = HaiDo.haversineKm(tam.lat, tam.lon, lat, lon) / RadarCpa.KM_PER_NM
            if (!(d <= nm)) return
            val cu = out[id]
            if (cu == null) {
                val m = meta[id]
                out[id] = Dang(
                    id, m?.ten, m?.loai ?: 0, m?.co, m?.mmsi, MocGan(t, lat, lon, d, huong), t, t, m != null, moiNhat,
                    if (moiNhat) ViTriQuanh(lat, lon, d, huong) else null,
                )
                return
            }
            if (d < cu.gan.nm) cu.gan = MocGan(t, lat, lon, d, huong)
            if (t > cu.cuoi) cu.cuoi = t
            if (t < cu.dau) cu.dau = t
            if (moiNhat) {
                cu.oDay = true
                cu.hienTai = ViTriQuanh(lat, lon, d, huong)
            }
        }
        for (r in vet) {
            val o = r as? JsonObject ?: continue
            val id = Js.chuoi(o["tau_id"]) ?: continue
            if (id.isEmpty()) continue
            val diem = o["diem"] as? JsonArray ?: continue
            for (p in diem) {
                if (p !is JsonArray) continue
                val s = p.map { x -> if (x is JsonNull) Double.NaN else Js.Number(x) }
                val t = s.getOrElse(0) { Double.NaN }
                val lat = s.getOrElse(1) { Double.NaN }
                val lon = s.getOrElse(2) { Double.NaN }
                val kn = s.getOrElse(3) { Double.NaN }
                val h = s.getOrElse(4) { Double.NaN }
                if (t.isFinite() && lat.isFinite() && lon.isFinite()) ghi(id, t, lat, lon, if (kn >= 0.5 && h.isFinite()) h else null)
            }
        }
        val banGiay = ban?.let { it.lucMs / 1000 } ?: Double.NaN
        if (ban != null && banGiay.isFinite()) for (t in ban.tau) {
            ghi(t.id, Js.round(banGiay - t.phut * 60), t.lat, t.lon, if (AisTau.tauDangChay(t)) (t.mui ?: t.huong) else null, true)
        }
        val ds = out.values.map { TauQuanh(it.id, it.ten, it.loai, it.co, it.mmsi, it.gan, it.cuoi, it.dau, it.conPhat, it.oDay, it.hienTai) }
        return ds.sortedWith { a, b ->
            val o = (if (b.oDay) 1 else 0) - (if (a.oDay) 1 else 0)
            if (o != 0) o
            else if (a.oDay) cmp(a.gan.nm - b.gan.nm)
            else cmp(b.cuoi - a.cuoi).let { if (it != 0) it else cmp(a.gan.nm - b.gan.nm) }
        }
    }

    /** dấu của hiệu (JS sort comparator) — NaN/0 ⇒ 0 */
    private fun cmp(d: Double) = if (d > 0) 1 else if (d < 0) -1 else 0

    private val NHOM_TEN = mapOf("ca" to "tàu cá", "hang" to "tàu hàng", "dau" to "tàu dầu", "khach" to "tàu khách", "khac" to "tàu khác")
    private fun nhomTen(loai: Int) = if (loai == 0) "tàu chưa rõ loại" else NHOM_TEN.getValue(AisTau.nhomTau(loai))
    private fun hoaDau(s: String) = if (s.isEmpty()) s else s[0].uppercase() + s.substring(1)

    /** "Tàu cá" — tên nhóm viết hoa chữ đầu; loại 0 ⇒ "Tàu chưa rõ loại". */
    fun tenNhomTau(loai: Int) = hoaDau(nhomTen(loai))

    /** "3 giờ trước" / "40 phút trước" / "vừa xong" (epoch giây). */
    fun cachDay(tGiay: Double, nowGiay: Double): String {
        val phut = max(0.0, Js.round((nowGiay - tGiay) / 60))
        if (phut < 15) return "vừa xong"
        if (phut < 60) return "${Js.inSo(phut)} phút trước"
        return "${Js.inSo(Js.round(phut / 60))} giờ trước"
    }

    private fun soNm(nm: Double) = AisJs.soVi(nm, 1, if (nm < 10) 1 else 0)

    /** Trạng thái một tàu so với điểm: đang ở / ở quanh ~N giờ / chạy qua. */
    fun trangThaiQuanh(t: TauQuanh, nowGiay: Double): TrangThaiQuanh {
        val nhom = tenNhomTau(t.loai)
        val o = Js.round((t.cuoi - (t.dau ?: t.cuoi)) / 3600)
        if (t.oDay) {
            val nm = (t.hienTai?.nm ?: t.gan.nm)
            return TrangThaiQuanh(true, "Đang ở", "$nhom · đang ở đây, cách ${soNm(nm)} hải lý${if (o >= 1) " · đã ~${Js.inSo(o)} giờ" else ""}")
        }
        val khi = cachDay(t.cuoi, nowGiay)
        return TrangThaiQuanh(
            false,
            if (khi == "vừa xong") "Vừa qua" else khi.replaceFirst(" trước", ""),
            if (o >= 1) "$nhom · ở quanh đây ~${Js.inSo(o)} giờ, rời $khi" else "$nhom · chạy qua $khi, gần nhất ${soNm(t.gan.nm)} hải lý",
        )
    }

    fun hopLoc(t: TauQuanh, loc: LocQuanh): Boolean =
        (loc.nhom == null || AisTau.nhomTau(t.loai) == loc.nhom) && (loc.o == null || t.oDay == loc.o)

    fun locTauQuanh(ds: List<TauQuanh>, loc: LocQuanh): List<TauQuanh> = ds.filter { hopLoc(it, loc) }

    /** Số trên từng icon lọc: trạng thái tính trong nhóm đang chọn, nhóm tính trong trạng thái đang chọn; nhóm đông trước. */
    fun demLocQuanh(ds: List<TauQuanh>, loc: LocQuanh): DemLocQuanh {
        var o = 0
        var qua = 0
        val m = LinkedHashMap<String, Int>()
        for (t in ds) {
            val nh = AisTau.nhomTau(t.loai)
            if (loc.nhom == null || nh == loc.nhom) {
                if (t.oDay) o++ else qua++
            }
            if (loc.o == null || t.oDay == loc.o) m[nh] = (m[nh] ?: 0) + 1
        }
        if (loc.nhom != null && !m.containsKey(loc.nhom)) m[loc.nhom] = 0
        return DemLocQuanh(o, qua, m.entries.map { it.key to it.value }.sortedWith { a, b -> b.second - a.second })
    }

    /** TauAis tối thiểu để mở đường đi cho tàu đã rời bản. */
    fun tauAisTuQuanh(t: TauQuanh) = TauAis(t.id, t.ten, t.loai, t.co, t.gan.lat, t.gan.lon, null, null, null, 0.0, null, null, t.mmsi)

    /** Lớp `ais-quanh`: vòng `nm` hải lý + nhãn đỉnh Bắc + icon mỗi tàu (đang ở ⇒ vị trí mới nhất; đã qua ⇒ chỗ gần nhất). */
    fun quanhGeoJson(tam: LatLon, ds: List<TauQuanh>, chonId: String?, nm: Double = QUANH_NM, nowGiay: Double): JsonObject {
        val ring = RadarCpa.vongTron(tam.lat, tam.lon, nm * RadarCpa.KM_PER_NM)
        val dinh = RadarCpa.congNm(tam, 0.0, nm)
        val f = mutableListOf(
            Geo.duong(ring + ring[0], Geo.props("kind" to "vong")),
            Geo.diem(dinh.lon, dinh.lat, Geo.props("kind" to "nhan", "nhan" to "${Js.inSo(nm)} hl · ${Js.inSo(QUANH_GIO)} giờ qua")),
        )
        for (t in ds) {
            val h = t.hienTai
            val (lat, lon, huong) = if (t.oDay && h != null) Triple(h.lat, h.lon, h.huong) else Triple(t.gan.lat, t.gan.lon, t.gan.huong)
            val tt = trangThaiQuanh(t, nowGiay)
            f += Geo.diem(lon, lat, Geo.props(
                "kind" to "tau",
                "id" to t.id,
                "mau" to AisTau.MAU_TAU.getValue(AisTau.nhomTau(t.loai)),
                "mk" to AisTau.nhomTau(t.loai),
                "huong" to (huong ?: 0.0),
                "chay" to if (huong != null) 1 else 0,
                "chon" to if (t.id == chonId) 1 else 0,
                "o" to if (tt.oDay) 1 else 0,
                "nhan" to "${hoaDau(nhomTen(t.loai).replaceFirst("tàu ", "").replaceFirst(" loại", ""))} · ${if (tt.oDay) "đang ở" else tt.chip}",
            ))
        }
        return Geo.tap(f)
    }

    /* ── giải thân máy chủ ── */

    private fun so(o: JsonObject?, k: String) = o?.let { Js.so(it[k]) }

    /** Một phần tử `tau` của GET /api/tau-ais/quanh (hỏng ⇒ null, bỏ). */
    fun giaiTauQuanh(e: JsonElement?): TauQuanh? {
        val o = e as? JsonObject ?: return null
        val id = Js.chuoi(o["id"]) ?: return null
        val g = o["gan"] as? JsonObject ?: return null
        val gan = MocGan(so(g, "t") ?: return null, so(g, "lat") ?: return null, so(g, "lon") ?: return null, so(g, "nm") ?: return null, so(g, "huong"))
        val ht = (o["hienTai"] as? JsonObject)?.let { h ->
            val la = so(h, "lat"); val lo = so(h, "lon"); val n = so(h, "nm")
            if (la != null && lo != null && n != null) ViTriQuanh(la, lo, n, so(h, "huong")) else null
        }
        val loai = Js.so(o["loai"])?.let { if (Js.laNguyen(it) && it >= 0 && it <= 99) it.toInt() else -1 } ?: 0
        return TauQuanh(
            id, Js.chuoi(o["ten"]), loai, Js.chuoi(o["co"]), Js.so(o["mmsi"]), gan, so(o, "cuoi") ?: gan.t, so(o, "dau"),
            Js.dung(o["conPhat"]), Js.dung(o["oDay"]), ht,
        )
    }

    internal fun okTrue(o: JsonObject?) = (o?.get("ok") as? JsonPrimitive)?.let { !it.isString && it.content == "true" } == true
}
