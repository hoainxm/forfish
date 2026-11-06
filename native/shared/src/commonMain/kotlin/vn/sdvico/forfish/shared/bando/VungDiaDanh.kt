package vn.sdvico.forfish.shared.bando

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlin.math.floor

/*
  LỚP ĐỊA DANH NGẦM · KHU NEO ĐẬU TRÁNH TRÚ BÃO · VÙNG QUẢN LÝ · VÙNG LỘNG — đợt 2b (app-map 18 §3d).
  PORT Y bộ giải web — `dia-danh-ngam.ts` (decodeDiaDanhNgam), `khu-tru-bao.ts` (decodeKhuTruBao), `vung-quan-ly.ts`
  (decodeVungQuanLy/docPolys/vongHopLe/tenThay/parseMuaCam/hopMuaCam/dangCam/dangVung) — rồi dựng GeoJSON y ba useMemo
  của fishing-map-view (diaDanhNgamGeo/khuTruBaoGeo/vungQuanLyGeo). Vùng lộng là hằng web ⇒ VungLongSinh.kt (sinh).
  Cổng khớp: native/scripts/sinh-vung-dia-danh.mjs chạy chính code web ⇒ jvmTest/resources/vung-dia-danh/ ⇒
  VungDiaDanhVangTest. Hàng hỏng thì BỎ, không ném. Đầu vào null = không có file ⇒ không có lớp.
*/
object VungDiaDanh {
    /** = trongKhungBienVN (den-bien.ts KHUNG_BIEN_VN): số thật (không ép kiểu), trong 4–24°N, 102–118°E. */
    private fun trongKhung(lon: Double?, lat: Double?) =
        lon != null && lat != null && lon.isFinite() && lat.isFinite() && lat >= 4.0 && lat <= 24.0 && lon >= 102.0 && lon <= 118.0

    private fun mang(o: JsonElement?, khoa: String): JsonArray? = (o as? JsonObject)?.get(khoa) as? JsonArray

    /* ── 1. địa danh ngầm ── */
    private val MA_DIA_DANH = setOf("nui", "doi", "song", "day", "guyot", "ho", "thunglung", "hem", "vach", "doc", "deo", "kenh", "baivenbo")

    /** diaDanhNgamGeo: Point {ten, loai}; không địa danh nào ⇒ null. */
    fun diaDanhNgam(raw: JsonElement?): String? {
        val hang = mang(raw, "diaDanh") ?: return null
        val bang = mang(raw, "loai") ?: JsonArray(emptyList())
        val w = Viet()
        for (r in hang) {
            if (r !is JsonArray || r.size < 4) continue
            val lon = Js.so(r[0])
            val lat = Js.so(r[1])
            if (!trongKhung(lon, lat)) continue
            val ten = Js.chuoi(r[3])?.let { Js.trim(it) }
            if (ten.isNullOrEmpty()) continue
            // `typeof li === "number" && li >= 0 ? bang[li] : undefined` — chỉ số lẻ/ngoài bảng ⇒ undefined
            val li = Js.so(r[2])
            val code = if (li != null && li >= 0) Js.tra(bang, r[2])?.let { Js.chuoi(it) } else null
            if (code == null || code !in MA_DIA_DANH) continue
            w.diem(lon!!, lat!!) { chu("ten", ten, dau = true); chu("loai", code) }
        }
        return w.xong()
    }

    /* ── 2. khu trú bão ── */
    /** khuTruBaoGeo: Point {i, cap}; cấp lạ/thiếu ⇒ "tinh"; không khu nào ⇒ null. */
    fun khuTruBao(raw: JsonElement?): String? {
        val hang = mang(raw, "khu") ?: return null
        val w = Viet()
        var i = 0
        for (k in hang) {
            val o = k as? JsonObject ?: continue // mảng/nguyên thuỷ: k.lon undefined ⇒ trongKhung bỏ
            val lon = Js.so(o["lon"])
            val lat = Js.so(o["lat"])
            if (!trongKhung(lon, lat)) continue
            val ten = Js.chuoi(o["ten"])?.let { Js.trim(it) } ?: ""
            if (ten.isEmpty()) continue
            val cap = Js.chuoi(o["cap"]).takeIf { it == "vung" || it == "tinh" } ?: "tinh"
            w.diem(lon!!, lat!!) { so("i", (i++).toDouble(), dau = true); chu("cap", cap) }
        }
        return w.xong()
    }

    /* ── 3. vùng quản lý ── */
    internal data class MuaCam(val tuThang: Int, val tuNgay: Int, val denThang: Int, val denNgay: Int)

    internal class Vung(
        val loai: String,
        val ma: String = "",
        val ten: String,
        val trangThai: String?,
        val lon: Double,
        val lat: Double,
        /** các mảnh hợp lệ — giữ NGUYÊN phần tử JSON thô (đỉnh dư cột vẫn in ra y web) */
        val polys: List<List<JsonArray>>?,
        val mua: List<MuaCam>,
    )

    private val LOAI_VUNG = setOf("bao-ton", "cam-thoi-han", "bao-ve-nguon-loi")
    private val TRANG_THAI = setOf("da_thanh_lap", "chuyen_tiep", "thanh_lap_moi")

    /** str(): chuỗi khác rỗng sau trim ⇒ bản đã trim; còn lại null. */
    private fun str(e: JsonElement?): String? = Js.chuoi(e)?.let { Js.trim(it) }?.takeIf { it.isNotEmpty() }

    /** vongHopLe: ≥ 4 đỉnh, mỗi đỉnh mảng ≥ 2 phần tử với [0], [1] là số hữu hạn (Number.isFinite không ép kiểu). */
    private fun vongHopLe(r: JsonElement?): Boolean =
        r is JsonArray && r.size >= 4 && r.all { p ->
            p is JsonArray && p.size >= 2 && Js.so(p[0])?.isFinite() == true && Js.so(p[1])?.isFinite() == true
        }

    /** docPolys: mảnh mất vòng ngoài thì bỏ; giữ các vòng hợp lệ của mảnh; không còn mảnh ⇒ null. */
    private fun docPolys(raw: JsonElement?): List<List<JsonArray>>? {
        if (raw !is JsonArray) return null
        val ra = mutableListOf<List<JsonArray>>()
        for (poly in raw) {
            if (poly !is JsonArray || !vongHopLe(poly.getOrNull(0))) continue
            ra += poly.filter { vongHopLe(it) }.map { it as JsonArray }
        }
        return ra.ifEmpty { null }
    }

    /** `.` của regex JS: mọi ký tự trừ LineTerminator. */
    private fun laXuongDong(c: Char) = c == '\n' || c == '\r' || c == ' ' || c == ' '

    /** `s.replace(/\s*\(.*$/, "")`: cắt từ khoảng trắng trước dấu "(" ĐẦU TIÊN mà sau nó không còn xuống dòng. */
    private fun catNgoac(s: String): String {
        for (q in s.indices) {
            if (s[q] != '(') continue
            if ((q + 1 until s.length).any { laXuongDong(s[it]) }) continue
            var p = q
            while (p > 0 && Js.laTrang(s[p - 1])) p--
            return s.substring(0, p)
        }
        return s
    }

    /** tenThay: tên hiển thị khi nguồn không có tên. */
    private fun tenThay(loai: String, doiTuong: String?, ma: String): String {
        if (loai == "bao-ve-nguon-loi") {
            val dt = doiTuong?.let { Js.trim(catNgoac(it)) }
            return if (!dt.isNullOrEmpty()) "Khu bảo vệ ${dt.lowercase()}" else "Khu bảo vệ nguồn lợi (chưa rõ tên)"
        }
        if (loai == "cam-thoi-han") return "Vùng cấm khai thác có thời hạn (chưa rõ tên, mã $ma)"
        return "Khu bảo tồn biển (chưa rõ tên, mã $ma)"
    }

    private fun ngayHopLe(ng: Int, th: Int) = th in 1..12 && ng in 1..31

    /** `\d{1,2}` (ASCII, tham lam) từ vị trí i ⇒ (số, vị trí sau) hoặc null. */
    private fun soDoc(s: String, i: Int): Pair<Int, Int>? {
        var j = i
        while (j < s.length && j - i < 2 && s[j] in '0'..'9') j++
        return if (j == i) null else s.substring(i, j).toInt() to j
    }

    private fun boTrang(s: String, i: Int): Int { var j = i; while (j < s.length && Js.laTrang(s[j])) j++; return j }

    /** Khớp `(\d{1,2})\s*\/\s*(\d{1,2})\s*[-–—]\s*(\d{1,2})\s*\/\s*(\d{1,2})` tại đúng vị trí i (không cần lùi:
     *  sau mỗi nhóm số là \s hoặc ký tự không phải số, nên lấy 1 chữ số khi có 2 không bao giờ cứu được). */
    private fun khopTai(s: String, i: Int): IntArray? {
        val ra = IntArray(4)
        var j = i
        for (k in 0 until 4) {
            val (v, sau) = soDoc(s, j) ?: return null
            ra[k] = v
            j = sau
            if (k == 3) break
            j = boTrang(s, j)
            val can = if (k == 1) "-–—" else "/"
            if (j >= s.length || s[j] !in can) return null
            j = boTrang(s, j + 1)
        }
        return ra
    }

    /** parseMuaCam: tách theo ";" hoặc ","; mỗi phần lấy khớp ĐẦU TIÊN; ngày/tháng sai thì bỏ phần đó. */
    internal fun parseMuaCam(s: String?): List<MuaCam> {
        if (s.isNullOrEmpty()) return emptyList()
        val ra = mutableListOf<MuaCam>()
        for (phan in s.split(';', ',')) {
            val m = phan.indices.firstNotNullOfOrNull { khopTai(phan, it) } ?: continue
            val (tuNgay, tuThang, denNgay, denThang) = m.toList()
            if (!ngayHopLe(tuNgay, tuThang) || !ngayHopLe(denNgay, denThang)) continue
            ra += MuaCam(tuThang, tuNgay, denThang, denNgay)
        }
        return ra
    }

    /** hopMuaCam: hợp hai bảng, bỏ khoảng trùng, xếp (ổn định) theo ngày đầu trong năm. */
    internal fun hopMuaCam(a: String?, b: String?): List<MuaCam> =
        (parseMuaCam(a) + parseMuaCam(b)).distinct().sortedBy { it.tuThang * 100 + it.tuNgay }

    /** dangCam: `now` = tháng*100 + ngày; khoảng có đầu > cuối là vắt năm. */
    internal fun dangCam(mua: List<MuaCam>, thang: Int, ngay: Int): Boolean {
        val now = thang * 100 + ngay
        return mua.any { m ->
            val tu = m.tuThang * 100 + m.tuNgay
            val den = m.denThang * 100 + m.denNgay
            if (tu <= den) now in tu..den else now >= tu || now <= den
        }
    }

    internal fun dangVung(v: Vung, thang: Int, ngay: Int): String = when (v.loai) {
        "cam-thoi-han" -> if (v.mua.isNotEmpty() && dangCam(v.mua, thang, ngay)) "dang-cam" else "ngoai-mua"
        "bao-ton" -> if (v.trangThai == "thanh_lap_moi") "quy-hoach" else "hieu-luc"
        else -> "quy-hoach"
    }

    internal fun giaiVung(raw: JsonElement?): List<Vung> {
        val hang = mang(raw, "vung") ?: return emptyList()
        val ra = mutableListOf<Vung>()
        for (r in hang) {
            val o = r as? JsonObject ?: continue // mảng: r.ma undefined ⇒ bỏ
            val ma = str(o["ma"]) ?: continue
            val loai = Js.chuoi(o["loai"])?.takeIf { it in LOAI_VUNG } ?: continue
            val lon = Js.so(o["lon"])
            val lat = Js.so(o["lat"])
            if (!trongKhung(lon, lat)) continue
            val polys = docPolys(o["polys"])
            val doiTuong = str(o["doiTuong"])
            val thoiGian = str(o["thoiGian"])
            val thoiGianKhac = str(o["thoiGianKhac"])
            ra += Vung(
                loai = loai,
                ma = ma,
                ten = str(o["ten"]) ?: tenThay(loai, doiTuong, ma),
                trangThai = Js.chuoi(o["trangThai"])?.takeIf { it in TRANG_THAI },
                lon = lon!!,
                lat = lat!!,
                polys = polys,
                mua = if (loai == "cam-thoi-han") hopMuaCam(thoiGian, thoiGianKhac) else emptyList(),
            )
        }
        return ra
    }

    /**
     * vungQuanLyGeo ⇒ (vung, diem): `vung` MultiPolygon {i, dang, loai} cho vùng có ranh giới (có thể rỗng),
     * `diem` Point {i, dang, loai, ten, diem} cho MỌI vùng. Không vùng nào ⇒ null.
     *
     * `nowMs` = epoch ms; ngày xét mùa cấm lấy theo GIỜ VN (UTC+7, không đổi giờ) — web dùng `new Date()` +
     * getMonth/getDate là giờ máy bà con, mặc định coi là giờ VN. Mở màn sang ngày khác thì gọi lại (như useMemo web).
     */
    fun vungQuanLy(raw: JsonElement?, nowMs: Long): Pair<String, String>? {
        val ds = giaiVung(raw)
        if (ds.isEmpty()) return null
        val iso = ConNuoc.ngayVn(nowMs) // "YYYY-MM-DD"
        val thang = iso.substring(iso.length - 5, iso.length - 3).toInt()
        val ngay = iso.substring(iso.length - 2).toInt()
        val vung = Viet()
        val diem = Viet()
        ds.forEachIndexed { i, v ->
            val dang = dangVung(v, thang, ngay)
            if (v.polys != null) {
                vung.them(hinhDaGiac(v.polys)) { so("i", i.toDouble(), dau = true); chu("dang", dang); chu("loai", v.loai) }
            }
            diem.diem(v.lon, v.lat) {
                so("i", i.toDouble(), dau = true); chu("dang", dang); chu("loai", v.loai); chu("ten", v.ten)
                append(",\"diem\":").append(v.polys == null)
            }
        }
        return vung.xong(rongVanIn = true)!! to diem.xong()!!
    }

    private fun hinhDaGiac(polys: List<List<JsonArray>>): String {
        val b = StringBuilder("{\"type\":\"MultiPolygon\",\"coordinates\":[")
        polys.forEachIndexed { k, poly ->
            if (k > 0) b.append(',')
            b.append('[')
            poly.forEachIndexed { j, ring -> if (j > 0) b.append(','); jsonJs(ring, b) }
            b.append(']')
        }
        return b.append("]}").toString()
    }

    /* ── 4. vùng lộng ── */
    /** = vungLongGeoJSON() của web: Feature Polygon (vòng khép), properties {}. Hằng sinh — VungLongSinh.kt. */
    val vungLong: String get() = VungLongSinh.GEO

    /* ── viết GeoJSON kiểu JSON.stringify ── */
    private class Viet {
        val b = StringBuilder("{\"type\":\"FeatureCollection\",\"features\":[")
        var dem = 0
        fun diem(lon: Double, lat: Double, prop: StringBuilder.() -> Unit) =
            them("{\"type\":\"Point\",\"coordinates\":[${Js.inSo(lon)},${Js.inSo(lat)}]}", prop)
        fun them(hinh: String, prop: StringBuilder.() -> Unit) {
            if (dem++ > 0) b.append(',')
            b.append("{\"type\":\"Feature\",\"geometry\":").append(hinh).append(",\"properties\":{")
            b.prop()
            b.append("}}")
        }
        fun xong(rongVanIn: Boolean = false): String? = if (dem == 0 && !rongVanIn) null else b.append("]}").toString()
    }

    private fun StringBuilder.so(k: String, v: Double, dau: Boolean = false) {
        if (!dau) append(','); append('"').append(k).append("\":").append(Js.inSo(v))
    }

    private fun StringBuilder.chu(k: String, v: String, dau: Boolean = false) {
        if (!dau) append(','); append('"').append(k).append("\":"); Js.jsonChuoi(v, this)
    }

    /** `JSON.stringify` cho phần tử JSON thô: số in kiểu JS (không hữu hạn ⇒ null), khoá chỉ số nguyên lên trước. */
    private fun jsonJs(e: JsonElement, b: StringBuilder) {
        when (e) {
            is JsonNull -> b.append("null")
            is JsonPrimitive -> when {
                e.isString -> Js.jsonChuoi(e.content, b)
                e.booleanOrNull != null -> b.append(e.booleanOrNull)
                else -> Js.so(e)?.takeIf { it.isFinite() }?.let { b.append(Js.inSo(it)) } ?: b.append("null")
            }
            is JsonArray -> {
                b.append('[')
                e.forEachIndexed { i, x -> if (i > 0) b.append(','); jsonJs(x, b) }
                b.append(']')
            }
            is JsonObject -> {
                val (so, chu) = e.keys.partition { laKhoaChiSo(it) }
                b.append('{')
                (so.sortedBy { it.toLong() } + chu).forEachIndexed { i, k ->
                    if (i > 0) b.append(',')
                    Js.jsonChuoi(k, b); b.append(':'); jsonJs(e.getValue(k), b)
                }
                b.append('}')
            }
        }
    }

    private fun laKhoaChiSo(k: String) =
        (k == "0" || (k.isNotEmpty() && k[0] in '1'..'9' && k.all { it in '0'..'9' } && k.length <= 10)) &&
            k.toLong() < 4294967295L && floor(k.toDouble()) == k.toDouble()
}
