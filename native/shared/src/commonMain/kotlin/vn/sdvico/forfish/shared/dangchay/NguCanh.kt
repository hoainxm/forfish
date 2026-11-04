package vn.sdvico.forfish.shared.dangchay

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import vn.sdvico.forfish.shared.bando.BaoHieu
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.kho.KhoMay
import vn.sdvico.forfish.shared.thoitiet.TheDiem
import kotlin.math.abs

/*
  KHO TRA CỨU CỦA DẪN ĐƯỜNG LIVE — PORT Y src/lib/nav-context.ts: dựng MỘT LẦN lúc bấm Bắt đầu, rồi mỗi fix tra rẻ.
  Có: cableSegments, restrictedZones, restrictedFromVung, buildNavContext, cableKmAt, restrictedAt, phaoKeTiep,
  denBienTin, khuTruBaoGan, pickHudLines, sameAlerts, cờ rung / rảnh tay (KhoMay) + lá chữ nó gọi: seamarks.ts
  seamarkLabel / colourLabel / huongDiQuaPhao (bên luồng dùng bando/BaoHieu.side*), den-bien tenDayDu,
  khu-tru-bao tenTinhDep, vung-quan-ly canhBaoDanDuong / tenNoi.
  GHÉP SAU (agent `danduong`): danh sách vật cản điểm + vùng cấm vào (hazards.ts buildHazardList) — ở đây nhận SẴN
  (`hazards`, `noGo`, `hazardMissing`); chỉ mục lưới ô thay quét thẳng.
  Đầu vào báo hiệu / đèn / khu trú là kiểu tối giản — nơi gọi đổi từ bộ giải bando (BaoHieu, HaiDo, VungDiaDanh).
*/

/** Báo hiệu (seamarks OSM + vn-aids Cục Hàng hải). */
data class PhaoNav(
    val lat: Double,
    val lon: Double,
    val type: String,
    val colour: String? = null,
    val lightColour: String? = null,
    val ten: String? = null,
    val tacDung: String? = null,
)

/** Đèn biển có tên (den-bien.v1.json) — `tamNm` = light.range (hải lý). */
data class DenNav(val lat: Double, val lon: Double, val ten: String, val tamNm: Double?)

/** Khu neo đậu tránh trú bão — tin: "tot" | "vua" … */
data class KhuNav(val lat: Double, val lon: Double, val ten: String, val tinh: String, val coTauM: Double?, val tin: String)

/** Vùng quản lý (khu bảo tồn / cấm khai thác có thời hạn) — polys[mảnh][vòng][đỉnh] = [lon, lat]. */
data class VungQuanLyNav(
    val ma: String,
    val loai: String,
    val ten: String,
    val trangThai: String?,
    val polys: List<List<List<DoubleArray>>>?,
    val mua: List<MuaCamChay>,
)

data class CapRef(val id: String, val kind: String, val loai: String, val ten: String?)
data class DoanCap(val a: ViTri, val b: ViTri, val ref: CapRef)

data class NguCanhChay(
    val hazards: ChiMucDiem?,
    val noGo: List<VungCamVao>,
    val cables: List<DoanCap>,
    val restricted: List<VungHanChe>,
    val aids: List<PhaoNav>,
    val den: List<DenNav>,
    val khu: List<KhuNav>,
    val missing: List<String>,
)

/** = NavInfoLine */
data class DongTin(val id: String, val cau: String)

/** = KhuGan */
data class KhuGan(
    val id: String,
    val ten: String,
    val tinh: String,
    val lat: Double,
    val lon: Double,
    val km: Double,
    val khoang: String,
    val gio: String?,
    val tauDaiM: Double?,
    val ganDung: Boolean,
)

/** = HudLine — muc "do" | "vang" | "tin"; khoa = dòng ĐỎ không thu được. */
data class DongHud(val id: String, val cau: String, val muc: String, val khoa: Boolean)

object NguCanh {
    const val NAV_CABLE_QUERY_KM = 0.6
    const val NAV_PHAO_KM = 2.0
    const val NAV_DEN_MAX_NM = 25.0
    const val NAV_KHU_MAX_KM = 400.0
    const val NAV_AID_TRUNG_KM = 0.1
    const val NAV_RUNG_KEY = "forfish.nav.rung.v1"
    const val NAV_RANH_TAY_KEY = "forfish.nav.ranhtay.v1"
    private const val KM_PER_NM = 1.852

    /* ── lá chữ ── */

    private val SEAMARK_LABEL = mapOf(
        "buoy_lateral" to "Phao luồng", "buoy_cardinal" to "Phao báo hướng an toàn",
        "buoy_safe_water" to "Phao giữa luồng, nước sâu an toàn", "buoy_special_purpose" to "Phao chuyên dùng",
        "buoy_isolated_danger" to "Phao báo chỗ nguy hiểm", "buoy_installation" to "Phao neo công trình",
        "beacon" to "Tiêu báo hiệu", "beacon_lateral" to "Tiêu báo mép luồng", "beacon_cardinal" to "Tiêu báo hướng an toàn",
        "beacon_safe_water" to "Tiêu giữa luồng, nước sâu an toàn", "beacon_special_purpose" to "Tiêu chuyên dùng",
        "beacon_isolated_danger" to "Tiêu báo chỗ nguy hiểm", "light" to "Đèn báo hiệu", "light_major" to "Đèn biển lớn",
        "light_minor" to "Đèn báo hiệu nhỏ", "light_vessel" to "Tàu đèn neo cố định", "light_float" to "Phao đèn",
        "virtual_aton" to "Phao ảo, chỉ máy thấy", "landmark" to "Mốc trên bờ có đèn", "anchorage" to "Vùng neo đậu",
        "harbour" to "Cảng, bến", "mooring" to "Trụ, phao buộc tàu", "pile" to "Cọc báo hiệu",
        "platform" to "Giàn khoan, công trình biển", "marine_farm" to "Lồng bè nuôi", "gate" to "Cửa, âu tàu",
    )

    /** = seamarkLabel */
    fun seamarkLabel(type: String) = SEAMARK_LABEL[type] ?: "Báo hiệu hàng hải"

    private val COLOUR_WORD = mapOf(
        "white" to "trắng", "red" to "đỏ", "green" to "xanh lá", "yellow" to "vàng", "black" to "đen",
        "blue" to "xanh dương", "grey" to "xám", "gray" to "xám", "orange" to "cam", "amber" to "hổ phách",
        "violet" to "tím", "magenta" to "hồng sen", "brown" to "nâu",
    )

    /** = colourLabel: "black;red;black" → "đen–đỏ–đen"; lạ ⇒ "" */
    fun colourLabel(colour: String?): String {
        if (colour.isNullOrEmpty()) return ""
        return colour.split(";").mapNotNull { COLOUR_WORD[Js.trim(it).lowercase()] }.joinToString("–")
    }

    private val LATERAL_PHRASE = mapOf(
        "port" to "Vào luồng: để {v} này bên TRÁI tàu (ra biển thì bên phải)",
        "stbd" to "Vào luồng: để {v} này bên PHẢI tàu (ra biển thì bên trái)",
        "pref-stbd" to "Luồng rẽ đôi: luồng chính nằm bên PHẢI {v} — đi luồng chính thì để {v} bên TRÁI tàu",
        "pref-port" to "Luồng rẽ đôi: luồng chính nằm bên TRÁI {v} — đi luồng chính thì để {v} bên PHẢI tàu",
    )
    private val CARDINAL_PHRASE = mapOf("n" to ("BẮC" to "NAM"), "s" to ("NAM" to "BẮC"), "e" to ("ĐÔNG" to "TÂY"), "w" to ("TÂY" to "ĐÔNG"))

    private fun js(s: String?): JsonElement? = s?.let { JsonPrimitive(it) }

    /** = huongDiQuaPhao — null khi KHÔNG BIẾT bên (thà im còn hơn bịa). */
    fun huongDiQuaPhao(m: PhaoNav, purpose: String?): String? {
        val type = m.type
        val vat = if (type.startsWith("beacon")) "tiêu" else "phao"
        if (type == "buoy_lateral" || type == "beacon_lateral") {
            var side = BaoHieu.sideFromPurposeVN(js(purpose))
            if (side == "unknown") side = BaoHieu.sideFromBodyColour(js(m.colour))
            if (side == "unknown") side = BaoHieu.sideFromLightColour(js(m.lightColour))
            if (side == "unknown") return null
            return LATERAL_PHRASE.getValue(side).replace("{v}", vat)
        }
        if (type == "buoy_cardinal" || type == "beacon_cardinal") {
            var q = BaoHieu.cardinalFromPurposeVN(js(purpose))
            if (q == "unknown") q = BaoHieu.quadrantFromBodyColour(js(m.colour))
            if (q == "unknown") return null
            val (anToan, nguyHiem) = CARDINAL_PHRASE.getValue(q)
            return "Đi về phía $anToan của $vat (chỗ nguy hiểm nằm phía $nguyHiem)"
        }
        if (type == "buoy_isolated_danger" || type == "beacon_isolated_danger") return "Nguy hiểm ngay dưới $vat — tránh xa, đừng cắt qua"
        if (type == "buoy_safe_water" || type == "beacon_safe_water") return "Nước an toàn quanh $vat, đi qua hai bên đều được"
        return null
    }

    /** = den-bien tenDayDu */
    fun tenDayDu(ten: String) = if (ten.isNotEmpty()) "Đèn biển $ten" else "Đèn biển"

    private val CHU_DAU = Regex("(^|[\\t\\n\\u000B\\u000C\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF-])(\\p{L})")

    /** = khu-tru-bao tenTinhDep: "QUẢNG NINH" → "Quảng Ninh" */
    fun tenTinhDep(tinh: String) = CHU_DAU.replace(tinh.lowercase()) { it.groupValues[1] + it.groupValues[2].uppercase() }

    /** = vung-quan-ly canhBaoDanDuong */
    fun canhBaoDanDuong(v: VungQuanLyNav): Boolean {
        if (v.polys.isNullOrEmpty()) return false
        if (v.loai == "bao-ton") return v.trangThai != "thanh_lap_moi"
        if (v.loai == "cam-thoi-han") return v.mua.isNotEmpty()
        return false
    }

    private val KHU_BAO_TON = Regex("^khu bảo tồn", RegexOption.IGNORE_CASE)
    private val KHU_BAO_VE = Regex("^khu bảo vệ", RegexOption.IGNORE_CASE)

    /** = vung-quan-ly tenNoi */
    fun tenNoi(v: VungQuanLyNav): String {
        if (v.loai == "cam-thoi-han") return "vùng cấm khai thác theo mùa (${HinhHoc.thuongDau(v.ten)})"
        if (v.loai == "bao-ton") return if (KHU_BAO_TON.containsMatchIn(v.ten)) HinhHoc.thuongDau(v.ten) else "khu bảo tồn biển ${v.ten}"
        return if (KHU_BAO_VE.containsMatchIn(v.ten)) HinhHoc.thuongDau(v.ten) else "khu bảo vệ nguồn lợi ${v.ten}"
    }

    /* ── đọc feature vn-sea-lanes ── */

    private fun okLatLon(lat: Double?, lon: Double?) = lat != null && lon != null && lat.isFinite() && lon.isFinite() && abs(lat) <= 90 && abs(lon) <= 180

    private fun ringBBox(ring: List<DoubleArray>): KhungVung {
        var latMin = Double.POSITIVE_INFINITY
        var latMax = Double.NEGATIVE_INFINITY
        var lonMin = Double.POSITIVE_INFINITY
        var lonMax = Double.NEGATIVE_INFINITY
        for (c in ring) {
            val lon = c[0]
            val lat = c[1]
            if (lat < latMin) latMin = lat
            if (lat > latMax) latMax = lat
            if (lon < lonMin) lonMin = lon
            if (lon > lonMax) lonMax = lon
        }
        return KhungVung(latMin, latMax, lonMin, lonMax)
    }

    private val RESTRICTED_LABEL = mapOf("cam-neo" to "vùng cấm neo", "cam-danh-bat" to "vùng cấm đánh bắt", "han-che" to "vùng hạn chế")

    private fun props(f: JsonElement?) = ((f as? JsonObject)?.get("properties") as? JsonObject) ?: JsonObject(emptyMap())
    private fun hinh(f: JsonElement?) = (f as? JsonObject)?.get("geometry") as? JsonObject

    private fun diem(c: JsonElement?): ViTri? {
        val a = c as? JsonArray ?: return null
        val lon = Js.so(a.getOrNull(0))
        val lat = Js.so(a.getOrNull(1))
        return if (okLatLon(lat, lon)) ViTri(lat!!, lon!!) else null
    }

    /** = cableSegments: cáp/ống (LineString) → đoạn; toạ độ hỏng thì cắt chuỗi. */
    fun cableSegments(features: JsonArray): List<DoanCap> {
        val out = mutableListOf<DoanCap>()
        features.forEachIndexed { i, f ->
            val p = props(f)
            val kind = Js.chuoi(p["kind"])
            if (kind != "cap" && kind != "ong") return@forEachIndexed
            val g = hinh(f) ?: return@forEachIndexed
            if (Js.chuoi(g["type"]) != "LineString") return@forEachIndexed
            val coords = g["coordinates"] as? JsonArray ?: return@forEachIndexed
            val ref = CapRef("$kind:$i", kind, Js.chuoi(p["loai"]) ?: "chua-ro", Js.chuoi(p["ten"])?.takeIf { it.isNotEmpty() })
            var prev: ViTri? = null
            for (c in coords) {
                val cur = diem(c)
                if (cur == null) { prev = null; continue }
                if (prev != null) out += DoanCap(prev, cur, ref)
                prev = cur
            }
        }
        return out
    }

    /** = restrictedZones: vùng cấm neo / cấm đánh bắt / hạn chế dạng đa giác. */
    fun restrictedZones(features: JsonArray): List<VungHanChe> {
        val out = mutableListOf<VungHanChe>()
        features.forEachIndexed { i, f ->
            val p = props(f)
            if (Js.chuoi(p["kind"]) != "vungcam") return@forEachIndexed
            val loai = Js.chuoi(p["loai"]) ?: ""
            val nhan = RESTRICTED_LABEL[loai] ?: return@forEachIndexed
            val g = hinh(f) ?: return@forEachIndexed
            if (Js.chuoi(g["type"]) != "Polygon") return@forEachIndexed
            val vong = (g["coordinates"] as? JsonArray)?.getOrNull(0) as? JsonArray ?: return@forEachIndexed
            val ring = vong.mapNotNull { c -> diem(c)?.let { doubleArrayOf(it.lon, it.lat) } }
            if (ring.size < 3) return@forEachIndexed
            val tenGoc = Js.chuoi(p["ten"])?.let { Js.trim(it) }?.takeIf { it.isNotEmpty() }
            out += VungHanChe("vc:$i", if (tenGoc != null) "$nhan $tenGoc" else nhan, loai, ring, ringBBox(ring))
        }
        return out
    }

    /** = restrictedFromVung: mỗi MẢNH một vùng (vòng ngoài), cấm theo mùa mang `mua`. */
    fun restrictedFromVung(vung: List<VungQuanLyNav>): List<VungHanChe> {
        val out = mutableListOf<VungHanChe>()
        for (v in vung) {
            if (!canhBaoDanDuong(v) || v.polys == null) continue
            val ten = tenNoi(v)
            v.polys.forEachIndexed { i, poly ->
                val ring = poly[0].filter { okLatLon(it.getOrNull(1), it.getOrNull(0)) }.map { doubleArrayOf(it[0], it[1]) }
                if (ring.size < 3) return@forEachIndexed
                out += VungHanChe("vq:${v.ma}:$i", ten, v.loai, ring, ringBBox(ring), if (v.loai == "cam-thoi-han") v.mua else null)
            }
        }
        return out
    }

    /**
     * = buildNavContext. `hazards`/`noGo`/`hazardMissing` = đầu ra buildHazardList (GHÉP SAU với `danduong`);
     * kho null = không có ⇒ ghi vào `missing`, không ném.
     */
    fun buildNavContext(
        hazards: List<VatCan>?,
        noGo: List<VungCamVao>?,
        hazardMissing: List<String> = emptyList(),
        laneFeatures: JsonArray? = null,
        seamarks: List<PhaoNav>? = null,
        vnAids: List<PhaoNav>? = null,
        denBien: List<DenNav>? = null,
        khuTruBao: List<KhuNav>? = null,
        vungQuanLy: List<VungQuanLyNav>? = null,
    ): NguCanhChay {
        val missing = hazardMissing.toMutableList()
        val hz = hazards?.takeIf { it.isNotEmpty() }?.let { ChiMucDiem.quet(it) }
        val segs = laneFeatures?.let { cableSegments(it) } ?: emptyList()
        val restricted = (laneFeatures?.let { restrictedZones(it) } ?: emptyList()).toMutableList()
        if (vungQuanLy == null) missing += "vung-quan-ly" else restricted += restrictedFromVung(vungQuanLy)
        if (vnAids == null) missing += "vn-aids"
        val aidList = vnAids.orEmpty().toMutableList()
        val vn = aidList.toList()
        for (m in seamarks.orEmpty()) {
            if (!okLatLon(m.lat, m.lon)) continue
            if (vn.any { HinhHoc.haversineKm(ViTri(m.lat, m.lon), ViTri(it.lat, it.lon)) <= NAV_AID_TRUNG_KM }) continue
            aidList += m
        }
        if (denBien == null) missing += "den-bien"
        if (khuTruBao == null) missing += "khu-tru-bao"
        return NguCanhChay(
            hz, noGo.orEmpty(), segs, restricted,
            aidList.filter { okLatLon(it.lat, it.lon) },
            denBien.orEmpty().filter { okLatLon(it.lat, it.lon) },
            khuTruBao.orEmpty().filter { okLatLon(it.lat, it.lon) },
            missing,
        )
    }

    /* ── tra mỗi fix ── */

    /** = cableKmAt — cách cáp/ống gần nhất trong tầm hỏi, null khi không có. */
    fun cableKmAt(ctx: NguCanhChay?, pos: ViTri, maxKm: Double = NAV_CABLE_QUERY_KM): Double? {
        if (ctx == null || ctx.cables.isEmpty() || !maxKm.isFinite() || maxKm <= 0 || !pos.lat.isFinite() || !pos.lon.isFinite()) return null
        var best = maxKm
        var co = false
        for (s in ctx.cables) {
            val km = HinhHoc.distToSegment(pos, s.a, s.b).first
            if (km <= best) { best = km; co = true }
        }
        return if (co) best else null
    }

    /** = restrictedAt — tên vùng cấm neo/hạn chế đang đứng trong; vùng theo mùa chỉ khi đang mùa cấm. */
    fun restrictedAt(ctx: NguCanhChay?, pos: ViTri, nowMs: Double): String? {
        if (ctx == null || ctx.restricted.isEmpty()) return null
        if (!pos.lat.isFinite() || !pos.lon.isFinite()) return null
        for (z in ctx.restricted) {
            if (z.mua != null && (z.mua.isEmpty() || !VungChay.dangCam(z.mua, nowMs))) continue
            if (pos.lat < z.bbox.latMin || pos.lat > z.bbox.latMax || pos.lon < z.bbox.lonMin || pos.lon > z.bbox.lonMax) continue
            if (HinhHoc.pointInRing(pos, z.ring)) return z.ten
        }
        return null
    }

    private val PHAO_BO = setOf("buoy_isolated_danger", "beacon_isolated_danger", "marine_farm")
    private fun laPhao(m: PhaoNav) = (m.type.startsWith("buoy") || m.type.startsWith("beacon")) && m.type !in PHAO_BO
    private fun tenAid(m: PhaoNav) = m.ten?.let { Js.trim(it) }?.takeIf { it.isNotEmpty() } ?: seamarkLabel(m.type)
    private fun aidId(lat: Double, lon: Double) = "${TheDiem.toFixed(lat, 4)},${TheDiem.toFixed(lon, 4)}"

    private fun <T> ganNhat(ds: List<T>, pos: ViTri, k: Int, maxKm: Double, toaDo: (T) -> ViTri, loc: (T) -> Boolean = { true }): List<Pair<T, Double>> {
        if (k <= 0 || !pos.lat.isFinite() || !pos.lon.isFinite()) return emptyList()
        return ds.filter(loc).map { it to HinhHoc.haversineKm(pos, toaDo(it)) }.filter { it.second <= maxKm }.sortedBy { it.second }.take(k)
    }

    /** = phaoKeTiep — dòng TIN phao/tiêu gần nhất trong 2 km + đi qua phía nào (nếu biết). */
    fun phaoKeTiep(ctx: NguCanhChay?, pos: ViTri, headingDeg: Double?, fmt: (Double) -> String, maxKm: Double = NAV_PHAO_KM): DongTin? {
        if (ctx == null || ctx.aids.isEmpty()) return null
        val (m, km) = ganNhat(ctx.aids, pos, 1, maxKm, { ViTri(it.lat, it.lon) }, ::laPhao).firstOrNull() ?: return null
        val mau = colourLabel(m.colour)
        val dau = "${tenAid(m)}${if (mau.isNotEmpty()) " (thân $mau)" else ""}"
        val dir = HiemHoa.relDir(headingDeg, HinhHoc.bearingDeg(pos, ViTri(m.lat, m.lon)))
        val cho = if (dir != null) "$dir ${fmt(km)}" else "cách ${fmt(km)}"
        val huong = huongDiQuaPhao(m, m.tacDung)
        return DongTin("phao:${aidId(m.lat, m.lon)}", "$dau $cho${if (huong != null) " — $huong" else ""}.")
    }

    /** = denBienTin — đèn biển gần nhất trong 25 hải lý mà tầm đèn còn với tới. */
    fun denBienTin(ctx: NguCanhChay?, pos: ViTri, fmt: (Double) -> String): DongTin? {
        if (ctx == null || ctx.den.isEmpty()) return null
        val (d, km) = ganNhat(ctx.den, pos, 1, NAV_DEN_MAX_NM * KM_PER_NM, { ViTri(it.lat, it.lon) }, { it.tamNm != null && it.tamNm.isFinite() && it.tamNm > 0 })
            .firstOrNull() ?: return null
        val tamKm = (d.tamNm ?: 0.0) * KM_PER_NM
        if (km > tamKm) return null
        val huong = TheDiem.windDirectionVN(HinhHoc.bearingDeg(pos, ViTri(d.lat, d.lon)))
        return DongTin("den:${aidId(d.lat, d.lon)}", "${tenDayDu(d.ten)} hướng $huong, cách chừng ${fmt(km)}.")
    }

    /** = khuTruBaoGan — 3 khu gần nhất; giờ chạy theo tốc độ GPS, tàu chưa chạy ⇒ gio null. */
    fun khuTruBaoGan(ctx: NguCanhChay?, pos: ViTri, speedKmh: Double?, fmt: (Double) -> String, k: Int = 3, maxKm: Double = NAV_KHU_MAX_KM): List<KhuGan> {
        if (ctx == null || ctx.khu.isEmpty()) return emptyList()
        val chay = speedKmh?.takeIf { it.isFinite() && it >= DinhVi.MIN_MOVING_KMH }
        return ganNhat(ctx.khu, pos, k, maxKm, { ViTri(it.lat, it.lon) }).map { (item, km) ->
            KhuGan(
                "${item.ten}|${item.tinh}", item.ten, if (item.tinh.isNotEmpty()) tenTinhDep(item.tinh) else "",
                item.lat, item.lon, km, fmt(km), chay?.let { HinhHoc.formatHoursVN(km / it) }, item.coTauM, item.tin == "vua",
            )
        }
    }

    /** = pickHudLines */
    fun pickHudLines(alerts: List<CanhBaoChay>?, borderRed: Boolean, info: String?): List<DongHud> {
        val out = mutableListOf<DongHud>()
        for (a in alerts.orEmpty()) {
            if (out.size >= 2) break
            out += DongHud(a.id, a.cau, a.muc, a.muc == "do")
        }
        if (out.size < 2 && !info.isNullOrEmpty() && !borderRed && out.none { it.khoa }) out += DongHud("tin:live", info, "tin", false)
        return out
    }

    /** = sameAlerts */
    fun sameAlerts(a: List<CanhBaoChay>, b: List<CanhBaoChay>): Boolean =
        a.size == b.size && a.indices.all { a[it].id == b[it].id && a[it].muc == b[it].muc && a[it].cau == b[it].cau }

    /* ── cờ của MÁY NÀY ── */

    fun navRungOn(kho: KhoMay): Boolean = try { kho.doc(NAV_RUNG_KEY) != "0" } catch (_: Exception) { true }
    fun setNavRungOn(kho: KhoMay, on: Boolean) { try { kho.ghi(NAV_RUNG_KEY, if (on) "1" else "0") } catch (_: Exception) {} }
    fun navRanhTayOn(kho: KhoMay): Boolean = try { kho.doc(NAV_RANH_TAY_KEY) == "1" } catch (_: Exception) { false }
    fun setNavRanhTayOn(kho: KhoMay, on: Boolean) { try { kho.ghi(NAV_RANH_TAY_KEY, if (on) "1" else "0") } catch (_: Exception) {} }
}
