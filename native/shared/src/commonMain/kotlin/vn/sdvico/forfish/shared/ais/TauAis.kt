package vn.sdvico.forfish.shared.ais

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import vn.sdvico.forfish.shared.bando.HaiDo
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.thoitiet.TheDiem
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.sqrt

/*
  TÀU XUNG QUANH (AIS) — đợt 2e (app-map 18 §3, §5). PORT Y phần thuần của src/lib/tau-ais.ts (+ idCoDinh/LOAI_TAU của
  lib/tau-ais/chuan-hoa.mjs): giải bản tin GET /api/tau-ais, nhãn/mô tả tàu, tìm tàu, vết 7 ngày, GeoJSON lớp `tau-ais`
  và `ais-vet`. Phần tải (mạng trước, bản lưu sau) ở NapAis.kt. Cổng khớp: native/scripts/sinh-ais.mjs chạy chính code
  web ⇒ jvmTest/resources/ais/tau.json ⇒ AisVangTest.
  Số: giữ Double như JS (mmsi/imo/dài in bằng `String(number)` của JS — Js.inSo).
*/

data class TauAis(
    val id: String,
    val ten: String?,
    /** mã loại 0–9 (2 = tàu cá); số lẻ/hỏng ⇒ −1 (= "Tàu khác"/nhóm khác như web tra không ra) */
    val loai: Int,
    val co: String?,
    val lat: Double,
    val lon: Double,
    /** hải lý/giờ */
    val kn: Double?,
    val huong: Double?,
    val mui: Double?,
    /** tin cách lúc `ban.luc` bao nhiêu phút */
    val phut: Double,
    val dai: Double?,
    val dich: String?,
    val mmsi: Double? = null,
    val imo: Double? = null,
    val hh: String? = null,
)

data class TauAisBan(val v: Int, val luc: String, val soTau: Double, val tau: List<TauAis>) {
    /** `Date.parse(luc)` — NaN khi hỏng */
    val lucMs: Double get() = AisJs.dateParse(luc)
}

data class DiemVet(val t: Double, val lat: Double, val lon: Double, val kn: Double?)

sealed class KetQuaVet {
    data class Co(val diem: List<DiemVet>) : KetQuaVet()
    /** `khong_theo_duoc` (mã đổi mỗi bản) | `mat_song` */
    data class Khong(val ly: String) : KetQuaVet()
}

object AisTau {
    const val SNAPSHOT_ID = "tau-ais:latest"
    const val KHOA_BAN = "forfish.tau-ais.v1"
    /** lớp đang bật thì xin lại bản mới mỗi 5 phút (máy thu đẩy ~10 phút, CDN giữ 2 phút) */
    const val LAM_MOI_MS = 5 * 60_000L

    /** Nhóm màu — thứ tự = MAU_TAU của web. */
    val NHOM: List<String> = listOf("ca", "hang", "dau", "khach", "khac")
    val MAU_TAU: Map<String, String> get() = LopAisSinh.MAU_TAU

    /* ── giải ── */

    /** = hopLe + ép kiểu. Tàu hỏng (thiếu id chuỗi / toạ độ số) bị BỎ — web để MapLibre tự vấp. */
    fun giaiBan(e: JsonElement?): TauAisBan? {
        val o = e as? JsonObject ?: return null
        if (Js.so(o["v"]) != 1.0) return null
        val luc = Js.chuoi(o["luc"]) ?: return null
        val tau = o["tau"] as? JsonArray ?: return null
        return TauAisBan(1, luc, Js.so(o["soTau"]) ?: tau.size.toDouble(), tau.mapNotNull { giaiTau(it) })
    }

    fun giaiTau(e: JsonElement?): TauAis? {
        val o = e as? JsonObject ?: return null
        val id = Js.chuoi(o["id"]) ?: return null
        val lat = Js.so(o["lat"]) ?: return null
        val lon = Js.so(o["lon"]) ?: return null
        val loai = Js.so(o["loai"])?.let { if (Js.laNguyen(it) && it >= 0 && it <= 99) it.toInt() else -1 } ?: -1
        return TauAis(
            id = id, ten = Js.chuoi(o["ten"]), loai = loai, co = Js.chuoi(o["co"]), lat = lat, lon = lon,
            kn = Js.so(o["kn"]), huong = Js.so(o["huong"]), mui = Js.so(o["mui"]), phut = Js.so(o["phut"]) ?: 0.0,
            dai = Js.so(o["dai"]), dich = Js.chuoi(o["dich"]), mmsi = Js.so(o["mmsi"]), imo = Js.so(o["imo"]), hh = Js.chuoi(o["hh"]),
        )
    }

    /** Thân `{ok, diem}` của /api/tau-ais/vet ⇒ điểm (điểm hỏng bỏ). null = không phải `ok: true` + mảng. */
    fun giaiVet(e: JsonElement?): List<DiemVet>? {
        val o = e as? JsonObject ?: return null
        if ((o["ok"] as? JsonPrimitive)?.let { !it.isString && it.content == "true" } != true) return null
        val d = o["diem"] as? JsonArray ?: return null
        return d.mapNotNull { p ->
            val q = p as? JsonObject ?: return@mapNotNull null
            val t = Js.so(q["t"]) ?: return@mapNotNull null
            val la = Js.so(q["lat"]) ?: return@mapNotNull null
            val lo = Js.so(q["lon"]) ?: return@mapNotNull null
            DiemVet(t, la, lo, Js.so(q["kn"]))
        }
    }

    /* ── nhãn ── */

    /** "MMSI 574090158 · IMO 9829643 · Hô hiệu HZAH" — chỉ phần có; không có gì ⇒ "". */
    fun dinhDanhTau(t: TauAis): String {
        val p = mutableListOf<String>()
        if (t.mmsi != null && t.mmsi != 0.0) p += "MMSI ${Js.inSo(t.mmsi)}"
        if (t.imo != null && t.imo != 0.0) p += "IMO ${Js.inSo(t.imo)}"
        if (!t.hh.isNullOrEmpty()) p += "Hô hiệu ${t.hh}"
        return p.joinToString(" · ")
    }

    fun loaiTauLabel(loai: Int): String = LopAisSinh.LOAI_TAU[loai] ?: LopAisSinh.LOAI_TAU.getValue(0)

    fun nhomTau(loai: Int): String = when (loai) {
        2 -> "ca"
        7 -> "hang"
        8 -> "dau"
        6, 4 -> "khach"
        else -> "khac"
    }

    /** = idCoDinh (chuan-hoa.mjs): mã nguồn giữ cố định ⇒ theo được đường đi. Regex web chỉ neo ĐẦU chuỗi. */
    fun idCoDinh(id: String): Boolean = id.length in 1..16 && !VE_TINH.containsMatchIn(id)
    private val VE_TINH = Regex("^v[0-9a-z]{3,}")

    fun coTheXemVet(t: TauAis): Boolean = idCoDinh(t.id)

    /** Tin cách hiện tại bao lâu, gộp tuổi tin trong nguồn + tuổi bản. */
    fun tuoiTinPhut(t: TauAis, banLuc: String, now: Long): Double {
        val banCu = max(0.0, Js.round((now - AisJs.dateParse(banLuc)) / 60_000))
        return t.phut + (if (banCu.isFinite()) banCu else 0.0)
    }

    fun tuoiTinLabel(phut: Double): String {
        if (phut < 2) return "vừa xong"
        if (phut < 60) return "${Js.inSo(phut)} phút trước"
        val h = Js.round(phut / 60)
        if (h < 48) return "${Js.inSo(h)} giờ trước"
        return "${Js.inSo(Js.round(h / 24))} ngày trước"
    }

    /** Tàu đang chạy (có hướng để chỉ) ⇒ icon tam giác; còn lại chấm tròn. */
    fun tauDangChay(t: TauAis): Boolean = t.kn != null && t.kn >= 0.5 && (t.mui ?: t.huong) != null

    /** "Tàu cá · VN · 4,1 hải lý/h về hướng Đông Nam · 17 m" */
    fun moTaTau(t: TauAis): String {
        val p = mutableListOf(loaiTauLabel(t.loai))
        if (!t.co.isNullOrEmpty()) p += t.co
        if (t.kn != null) p += if (t.kn < 0.5) "đang đứng" else
            "${AisJs.soVi(t.kn, 1)} hải lý/h${if (t.huong != null) " về hướng ${TheDiem.windDirectionVN(t.huong)}" else ""}"
        if (t.dai != null && t.dai != 0.0) p += "${Js.inSo(t.dai)} m"
        return p.joinToString(" · ")
    }

    /** Tàu gần điểm chạm nhất trong `kmMax` — null nếu không có. */
    fun tauGanDiem(tau: List<TauAis>, lat: Double, lon: Double, kmMax: Double = 3.0): Pair<TauAis, Double>? {
        var best: Pair<TauAis, Double>? = null
        for (t in tau) {
            if (abs(t.lat - lat) > kmMax / 100 || abs(t.lon - lon) > kmMax / 100) continue
            val km = HaiDo.haversineKm(lat, lon, t.lat, t.lon)
            if (km <= kmMax && (best == null || km < best.second)) best = t to km
        }
        return best
    }

    /** Bỏ dấu, bỏ khoảng trắng/gạch, viết hoa — "BV-92468 TS" khớp "bv92468". Bảng từng ký tự sinh từ web. */
    fun chuanTen(s: String): String {
        val b = StringBuilder()
        var i = 0
        while (i < s.length) {
            val c = s[i]
            val cp: Int
            if (c.isHighSurrogate() && i + 1 < s.length && s[i + 1].isLowSurrogate()) {
                cp = 0x10000 + ((c.code - 0xD800) shl 10) + (s[i + 1].code - 0xDC00)
                i += 2
            } else {
                cp = c.code
                i++
            }
            when (cp) {
                in 'a'.code..'z'.code -> b.append((cp - 32).toChar())
                in 'A'.code..'Z'.code, in '0'.code..'9'.code -> b.append(cp.toChar())
                else -> ChuanTenSinh.BANG[cp]?.let { b.append(it) }
            }
        }
        return b.toString()
    }

    /** Tìm tàu theo tên/số hiệu: bắt đầu bằng chuỗi tìm trước, rồi chứa; dưới 2 ký tự không tìm; toàn số 5–9 ⇒ đầu MMSI/IMO. */
    fun timTau(tau: List<TauAis>, q: String, toiDa: Int = 6): List<TauAis> {
        val k = chuanTen(q)
        if (k.length < 2) return emptyList()
        val so = q.filterNot { Js.laTrang(it) }
        if (SO_5_9.matches(so)) {
            val theoSo = tau.filter { t -> (t.mmsi?.let { Js.inSo(it) } ?: "").startsWith(so) || (t.imo?.let { Js.inSo(it) } ?: "").startsWith(so) }
                .take(max(0, toiDa))
            if (theoSo.isNotEmpty()) return theoSo
        }
        val dau = mutableListOf<TauAis>()
        val giua = mutableListOf<TauAis>()
        for (t in tau) {
            if (t.ten.isNullOrEmpty()) continue
            val n = chuanTen(t.ten)
            if (n.startsWith(k)) dau += t else if (n.contains(k)) giua += t
            if (dau.size >= toiDa) break
        }
        return (dau + giua).take(max(0, toiDa))
    }
    private val SO_5_9 = Regex("[0-9]{5,9}")

    /** Đếm tàu theo nhóm màu (thứ tự NHOM). */
    fun demTheoNhom(tau: List<TauAis>): Map<String, Int> {
        val d = NHOM.associateWith { 0 }.toMutableMap()
        for (t in tau) d[nhomTau(t.loai)] = d.getValue(nhomTau(t.loai)) + 1
        return d
    }

    /* ── vết 7 ngày ── */

    /** "Đường đi 2 ngày qua · 31 mốc · từ 08:00 29/10" */
    fun cauVet(diem: List<DiemVet>, now: Long): String {
        if (diem.size < 2) return "Chưa đủ mốc để vẽ đường đi — tàu mới vào vùng hoặc ít khi bật AIS."
        val dau = diem[0].t * 1000
        val ngay = max(1.0, ceil((now - dau) / 86_400_000))
        val vn = AisJs.gioVN(dau + 7 * 3_600_000)
        return "Đường đi ${Js.inSo(ngay)} ngày qua · ${diem.size} mốc · từ ${hai(vn.gio)}:00 ${vn.ngay}/${vn.thang}"
    }

    /** "07:00 29/10" giờ VN từ epoch giây. */
    fun gioNgayVN(t: Double): String {
        val vn = AisJs.gioVN(t * 1000 + 7 * 3_600_000)
        return "${hai(vn.gio)}:${hai(vn.phut)} ${vn.ngay}/${vn.thang}"
    }

    private fun hai(n: Int) = n.toString().padStart(2, '0')

    /** Lớp `ais-vet`: `duong` · `moc` giữa · `dau`/`cuoi` có nhãn. Một mốc ⇒ chỉ `cuoi`. */
    fun vetGeoJson(diem: List<DiemVet>): JsonObject {
        val n = diem.size
        fun diemF(p: DiemVet, k: String, nhan: String = "") = Geo.diem(p.lon, p.lat, Geo.props("k" to k, "nhan" to nhan))
        val f = mutableListOf<JsonObject>()
        if (n >= 2) f += Geo.duong(diem.map { it.lon to it.lat }, Geo.props("k" to "duong", "nhan" to ""))
        if (n > 2) diem.subList(1, n - 1).forEach { f += diemF(it, "moc") }
        if (n >= 2) f += diemF(diem[0], "dau", "Bắt đầu ${gioNgayVN(diem[0].t)}")
        if (n >= 1) f += diemF(diem[n - 1], "cuoi", "Mới nhất ${gioNgayVN(diem[n - 1].t)}")
        return Geo.tap(f)
    }

    /** Lớp `tau-ais`: mũi tàu trước, hướng đi sau (như máy AIS xoay ký hiệu theo mũi). */
    fun tauGeoJson(ban: TauAisBan): JsonObject = Geo.tap(ban.tau.map { t ->
        val nhom = nhomTau(t.loai)
        Geo.diem(t.lon, t.lat, Geo.props("id" to t.id, "nhom" to nhom, "mk" to nhom, "huong" to (t.mui ?: t.huong ?: 0.0), "chay" to if (tauDangChay(t)) 1 else 0))
    })
}

/** Dựng GeoJSON (JsonObject — nền đưa thẳng `toString()` cho MapLibre). */
internal object Geo {
    fun gt(v: Any?): JsonElement = when (v) {
        null -> JsonNull
        is JsonElement -> v
        is String -> JsonPrimitive(v)
        is Boolean -> JsonPrimitive(v)
        is Int -> JsonPrimitive(v)
        is Double -> JsonPrimitive(v)
        else -> error("kiểu lạ $v")
    }

    fun props(vararg p: Pair<String, Any?>): JsonObject = JsonObject(linkedMapOf(*p.map { it.first to gt(it.second) }.toTypedArray()))
    private fun toaDo(lon: Double, lat: Double) = JsonArray(listOf(JsonPrimitive(lon), JsonPrimitive(lat)))
    fun diem(lon: Double, lat: Double, p: JsonObject) = JsonObject(linkedMapOf(
        "type" to JsonPrimitive("Feature"),
        "geometry" to JsonObject(linkedMapOf("type" to JsonPrimitive("Point"), "coordinates" to toaDo(lon, lat))),
        "properties" to p,
    ))
    fun duong(pts: List<Pair<Double, Double>>, p: JsonObject) = JsonObject(linkedMapOf(
        "type" to JsonPrimitive("Feature"),
        "geometry" to JsonObject(linkedMapOf("type" to JsonPrimitive("LineString"), "coordinates" to JsonArray(pts.map { toaDo(it.first, it.second) }))),
        "properties" to p,
    ))
    fun tap(f: List<JsonObject>) = JsonObject(linkedMapOf("type" to JsonPrimitive("FeatureCollection"), "features" to JsonArray(f)))
}

/** Phép JS mà phần AIS cần thêm (ngoài bando.Js). */
internal object AisJs {
    /** `Date.parse` cho chuỗi giờ ISO của máy chủ (`toISOString()`); dạng chỉ ngày theo Js.ngayMs; hỏng ⇒ NaN. */
    fun dateParse(s: String): Double {
        runCatching { return kotlin.time.Instant.parse(s).toEpochMilliseconds().toDouble() }
        return Js.ngayMs(s) ?: Double.NaN
    }

    class GioVN(val gio: Int, val phut: Int, val ngay: Int, val thang: Int)

    /** getUTCHours/Minutes/Date/Month+1 của `new Date(ms)`. */
    fun gioVN(ms: Double): GioVN {
        val m = floor(ms).toLong()
        val ngayTuMoc = Math.floorDiv(m, 86_400_000L)
        val trongNgay = Math.floorMod(m, 86_400_000L)
        // civil_from_days
        val z = ngayTuMoc + 719468
        val era = (if (z >= 0) z else z - 146096) / 146097
        val doe = z - era * 146097
        val yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
        val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        val mp = (5 * doy + 2) / 153
        val d = (doy - (153 * mp + 2) / 5 + 1).toInt()
        val thang = (if (mp < 10) mp + 3 else mp - 9).toInt()
        return GioVN((trongNgay / 3_600_000).toInt(), ((trongNgay / 60_000) % 60).toInt(), d, thang)
    }

    private object Math {
        fun floorDiv(a: Long, b: Long): Long { val q = a / b; return if ((a % b != 0L) && ((a < 0) != (b < 0))) q - 1 else q }
        fun floorMod(a: Long, b: Long): Long = a - floorDiv(a, b) * b
    }

    /**
     * `n.toLocaleString("vi-VN", {maximumFractionDigits: maxLe, minimumFractionDigits: minLe})`: ICU làm tròn trên dạng
     * thập phân NGẮN NHẤT của số (2.05 ⇒ "2,1", khác toFixed ⇒ "2.0"), nửa xa 0; nhóm nghìn ".", thập phân ",", −0 ⇒ "-0".
     */
    fun soVi(x: Double, maxLe: Int, minLe: Int = 0): String {
        if (x.isNaN()) return "NaN"
        val am = x < 0 || (x == 0.0 && 1 / x < 0)
        val a = abs(x)
        if (a.isInfinite()) return if (am) "-∞" else "∞"
        val (nguyen0, le0) = lamTronThapPhan(a, maxLe)
        var nguyen = nguyen0
        var le = le0
        while (le.length > minLe && le.endsWith('0')) le = le.dropLast(1)
        nguyen = nguyen.reversed().chunked(3).joinToString(".").reversed()
        val s = nguyen + if (le.isEmpty()) "" else ",$le"
        // "-0" của Intl chỉ khi số âm (kể cả làm tròn về 0)
        return if (am) "-$s" else s
    }

    /** Dạng thập phân ngắn nhất của a ≥ 0 (Js.inSo) làm tròn nửa lên tới `le` chữ số ⇒ (phần nguyên, phần lẻ đủ `le` chữ số). */
    private fun lamTronThapPhan(a: Double, le: Int): Pair<String, String> {
        val t = Js.inSo(a)
        val e = t.indexOf('e')
        // dạng mũ: số rất nhỏ (< 1e-6, tròn về 0) hoặc ≥ 1e21 (không gặp) — lùi toFixed
        if (e >= 0) return TheDiem.toFixed(a, le).let { s -> s.substringBefore('.') to s.substringAfter('.', "") }
        val cham = t.indexOf('.')
        val nguyen = if (cham < 0) t else t.substring(0, cham)
        val phan = if (cham < 0) "" else t.substring(cham + 1)
        if (phan.length <= le) return nguyen to phan.padEnd(le, '0')
        val giu = (nguyen + phan.substring(0, le)).toCharArray()
        if (phan[le] >= '5') {
            var i = giu.size - 1
            while (i >= 0) {
                if (giu[i] == '9') { giu[i] = '0'; i-- } else { giu[i] = giu[i] + 1; break }
            }
            val s = (if (i < 0) "1" else "") + giu.concatToString()
            return s.substring(0, s.length - le) to s.substring(s.length - le)
        }
        val s = giu.concatToString()
        return s.substring(0, s.length - le) to s.substring(s.length - le)
    }

    /** `Math.hypot` của V8 (chia cho max, cộng bù Kahan, nhân lại) — để khớp bit với web. */
    fun hypot(a: Double, b: Double): Double {
        val x = abs(a)
        val y = abs(b)
        if (x.isInfinite() || y.isInfinite()) return Double.POSITIVE_INFINITY
        if (x.isNaN() || y.isNaN()) return Double.NaN
        val m = max(x, y)
        if (m == 0.0) return 0.0
        var sum = 0.0
        var bu = 0.0
        for (v in doubleArrayOf(x, y)) {
            val n = v / m
            val hang = n * n - bu
            val tam = sum + hang
            bu = (tam - sum) - hang
            sum = tam
        }
        return sqrt(sum) * m
    }
}
