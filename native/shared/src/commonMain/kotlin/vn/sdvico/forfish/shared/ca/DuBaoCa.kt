package vn.sdvico.forfish.shared.ca

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.kho.KhoMay
import kotlin.io.encoding.Base64
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/*
  DỰ BÁO CÁ — phần THUẦN (đợt 2e, app-map 18 §5). Bản Kotlin của:
   · src/lib/fish-predict.ts — FISH_LEVEL_BANDS, FishCell/FishForecast (giải phản hồi /api/fish-forecast);
   · src/lib/vung-bien-vn.ts — trongVungBienVN / locOTrongVung / locBanDoCaTrongVung / khungOTrongVung
     (hình vùng: VungBienSinh.kt SINH từ src/data/vms-zones.json qua native/scripts/sinh-ca.mjs);
   · src/lib/fish-picks.ts — loài bà con đánh (kho `forfish.fishPicks.v1`, cùng định dạng web);
   · src/lib/fish-blend.ts — tầm ngày, pha mùa vụ ngày xa (bảng w từ model-params `fishBlend`, bản mùa vụ
     public/data/fish-climatology.v1.json), độ rộng hồng tâm;
   · src/lib/source-registry.ts — fishFailNote;
   · src/components/fishing-map-view.tsx — fishGridStep ~1772, fishView ~5700, fishGridGeo ~5721, fishHotspots ~5847
     (web viết thẳng trong component ⇒ cổng khớp chép y, xem native/scripts/sinh-ca.mjs).
  Cổng khớp: jvmTest CaVangTest (mẫu ca/vang.json do CHÍNH code web in ra).
  KHÁC web có chủ ý: (1) trongVungBienVN không nhớ kết quả theo toạ độ làm tròn 1e-5° (web nhớ để nhanh; hai điểm
  cách nhau < 1 m có thể nhận kết quả của nhau — Kotlin tính thật từng điểm); (2) ô không phải object JSON bị bỏ
  (web ném TypeError ở bộ lọc rồi lùi về bản lưu).
*/

/** Một ô dự báo cá = FishCell. `goc` = nguyên object JSON (để ghi kho giữ mọi trường web gửi). */
data class OCa(
    val lat: Double,
    val lon: Double,
    /** điểm 0–100 (loài tốt nhất) — `Number(s)` của JS */
    val s: Double,
    val top: List<String>,
    /** điểm theo loài; giá trị null/chuỗi số ép như JS (`?? 0`, `Math.max`) */
    val sp: Map<String, Double>,
    val t: Double?,
    val c: Double?,
    /** ô do bản MÙA VỤ đẻ ra khi pha ngày xa */
    val fromClim: Boolean = false,
    val goc: JsonObject? = null,
)

/** = FishForecast (ok:true). `tho` = nguyên object phản hồi (đã thay `cells` bằng ô sau lọc). */
data class BanDoCa(
    val date: String?,
    val cells: List<OCa>,
    val species: List<String>,
    /** "catch-fleet-static" | "fleet-static" | null */
    val baseMode: String?,
    /** truthy của JS cho `baseMode` (component chỉ hỏi `if (fishCast.baseMode)`) */
    val coNen: Boolean,
    val generatedAt: String?,
    val targetDate: String?,
    val dateSkewDays: Double?,
    val dataQuality: Double?,
    val tho: JsonObject,
)

/** Mức khả năng có cá — màu CỐ ĐỊNH (Thấp xanh lá / TB vàng / Cao đỏ), `min` = ngưỡng dưới (%). */
data class MucCa(val key: String, val label: String, val min: Int, val color: String)

/** Hồng tâm cá = FishHotspot của component. */
data class DiemNong(val lat: Double, val lon: Double, val v: Double, val top: List<String>, val near: Boolean)

/** Một lượt dựng lớp cá cho màn hình (= chuỗi useMemo của fishing-map-view). */
data class LopCa(val lead: Int, val view: BanDoCa, val buoc: Double, val geo: String?, val diemNong: List<DiemNong>)

object DuBaoCa {
    /** = FISH_LEVEL_BANDS */
    val FISH_LEVEL_BANDS = listOf(
        MucCa("low", "Thấp", 40, "#22c55e"),
        MucCa("mid", "Trung bình", 60, "#eab308"),
        MucCa("high", "Cao", 75, "#ef4444"),
    )

    /* ── giải phản hồi ─────────────────────────────────────────────────────── */

    internal fun giaiO(e: JsonElement): OCa? {
        val o = e as? JsonObject ?: return null
        // bộ lọc vùng của web cần Number.isFinite(lat/lon) — không phải số ⇒ ô bị bỏ ở MỌI cửa
        val lat = Js.so(o["lat"]) ?: return null
        val lon = Js.so(o["lon"]) ?: return null
        val sp = LinkedHashMap<String, Double>()
        (o["sp"] as? JsonObject)?.forEach { (k, v) -> sp[k] = Js.Number(v) }
        return OCa(
            lat, lon, Js.Number(o["s"]),
            (o["top"] as? JsonArray)?.mapNotNull { Js.chuoi(it) } ?: emptyList(),
            sp, Js.so(o["t"]), Js.so(o["c"]), goc = o,
        )
    }

    /** Phản hồi / bản lưu ⇒ bản đồ cá ĐÃ LỌC vùng biển VN. null khi không phải `{ok:true,…}`. */
    fun giai(e: JsonElement?): BanDoCa? {
        val o = e as? JsonObject ?: return null
        val ok = o["ok"] as? JsonPrimitive
        if (ok == null || ok.isString || ok.booleanOrNull != true) return null
        val cells = (o["cells"] as? JsonArray)?.mapNotNull { giaiO(it) }
        val b = BanDoCa(
            date = Js.chuoi(o["date"]),
            cells = cells ?: emptyList(),
            species = (o["species"] as? JsonArray)?.mapNotNull { Js.chuoi(it) } ?: emptyList(),
            baseMode = Js.chuoi(o["baseMode"]),
            coNen = Js.dung(o["baseMode"]),
            generatedAt = Js.chuoi(o["generatedAt"]),
            targetDate = Js.chuoi(o["targetDate"]),
            dateSkewDays = Js.so(o["dateSkewDays"]),
            dataQuality = Js.so(o["dataQuality"]),
            tho = o,
        )
        return if (cells == null) b else locBanDo(b)
    }

    fun giai(s: String): BanDoCa? = runCatching { Json.parseToJsonElement(s) }.getOrNull()?.let { giai(it) }

    /** = locBanDoCaTrongVung: chỉ còn ô có TÂM trong vùng biển VN (cả trong `tho` để ghi kho). */
    fun locBanDo(b: BanDoCa): BanDoCa {
        val con = VungBien.locO(b.cells)
        val tho = JsonObject(b.tho + ("cells" to JsonArray(con.map { it.goc ?: oJson(it) })))
        return b.copy(cells = con, tho = tho)
    }

    private fun oJson(c: OCa): JsonObject = JsonObject(buildMap {
        put("lat", JsonPrimitive(c.lat)); put("lon", JsonPrimitive(c.lon)); put("s", JsonPrimitive(c.s))
        put("top", JsonArray(c.top.map { JsonPrimitive(it) }))
        put("sp", JsonObject(c.sp.mapValues { JsonPrimitive(it.value) }))
        put("t", c.t?.let { JsonPrimitive(it) } ?: JsonNull); put("c", c.c?.let { JsonPrimitive(it) } ?: JsonNull)
    })

    /** = fishFailNote: câu khi lớp cá không tải được; null = thẻ khoá quyền lo (đừng hiện "thử lại"). */
    fun fishFailNote(code: String?): String? = when (code) {
        "login_required", "no_token", "unknown_token", "token_revoked", "premium_required" -> null
        "unavailable" -> "Máy chủ đang bận — chạm thử lại sau ít phút"
        else -> "Dự báo cá chưa tải được — chạm để thử lại"
    }

    /** = isNewerGeneratedAt (sw-api-fresh.ts): `next` có MỚI HƠN `cur` không theo mốc máy chủ tính. */
    fun isNewerGeneratedAt(cur: String?, next: String?): Boolean {
        val n = isoMs(next) ?: return false
        val c = isoMs(cur) ?: return true
        return n > c
    }

    private val ISO_GIO = Regex("([0-9]{4}-[0-9]{2}-[0-9]{2})T([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\\.([0-9]{1,9}))?)?(Z|[+-][0-9]{2}:[0-9]{2})?")

    /** Date.parse cho dạng ISO máy chủ gửi (`toISOString()`); dạng khác ⇒ null. Thiếu múi ⇒ coi UTC. */
    internal fun isoMs(s: String?): Double? {
        if (s == null) return null
        val m = ISO_GIO.matchEntire(s) ?: return Js.ngayMs(s)
        val ngay = Js.ngayMs(m.groupValues[1]) ?: return null
        val h = m.groupValues[2].toInt(); val p = m.groupValues[3].toInt()
        val g = m.groupValues[4].ifEmpty { "0" }.toInt()
        if (h > 24 || p > 59 || g > 59) return null
        val ms = m.groupValues[5].let { if (it.isEmpty()) 0 else it.padEnd(3, '0').substring(0, 3).toInt() }
        val z = m.groupValues[6]
        val lech = if (z.isEmpty() || z == "Z") 0 else (if (z[0] == '-') -1 else 1) * (z.substring(1, 3).toInt() * 60 + z.substring(4, 6).toInt())
        return ngay + h * 3_600_000.0 + p * 60_000.0 + g * 1000.0 + ms - lech * 60_000.0
    }

    /* ── lớp màn hình (component) ──────────────────────────────────────────── */

    /** = fishGridStep: khoảng vĩ độ nhỏ nhất giữa các ô (mặc định 0,25°). */
    fun buocLuoi(b: BanDoCa?): Double {
        val cells = b?.cells
        if (cells.isNullOrEmpty()) return 0.25
        val lats = cells.map { it.lat }.distinct().sorted()
        var step = Double.POSITIVE_INFINITY
        for (i in 1 until lats.size) {
            val d = lats[i] - lats[i - 1]
            if (d > 1e-4 && d < step) step = d
        }
        return if (step.isFinite()) step else 0.25
    }

    /** = fishLead: tầm ngày ĐẾM TỪ NGÀY ẢNH (fishLeadDays). */
    fun tamNgay(b: BanDoCa?, ngayXemIso: String, daysAhead: Int): Int =
        if (b != null) PhaMuaVu.fishLeadDays(b.date, ngayXemIso, daysAhead) else daysAhead

    /** = fishView: bản nền (`baseMode`) / hôm nay / thiếu mùa vụ ⇒ nguyên bản; ngày xa ⇒ pha mùa vụ rồi lọc vùng lại. */
    fun xemCa(b: BanDoCa, lead: Int, ngayXemIso: String, clim: KhiHau?, bang: BangPha): BanDoCa {
        if (b.coNen) return b
        if (lead <= 0 || clim == null || !bang.usable) return b
        val month = Js.Number(JsonPrimitive(if (ngayXemIso.length > 5) ngayXemIso.substring(5, min(7, ngayXemIso.length)) else ""))
        if (!month.isFinite() || month < 1 || month > 12) return b
        return b.copy(cells = VungBien.locO(PhaMuaVu.blendFishCells(b.cells, clim, month.toInt(), lead, bang)))
    }

    /**
     * = fishGridGeo: GeoJSON FeatureCollection ô cá theo bộ loài (sàn 40), ô cắt theo vùng biển VN; mảnh cắt gắn
     * `m:1` (lớp viền bỏ qua). null = không vẽ (chưa có bản / chưa chọn loài). Paint: [LOP_CA_FILL], [LOP_CA_LINE].
     */
    fun luoiCaGeo(view: BanDoCa?, bo: List<String>, buoc: Double, chuaChon: Boolean = false): String? {
        if (view == null || chuaChon) return null
        val lo = FISH_LEVEL_BANDS[0].min
        val h = buoc / 2
        val sb = StringBuilder("{\"type\":\"FeatureCollection\",\"features\":[")
        var dau = true
        for (c in view.cells) {
            val v = LoaiDanh.diemTheoBo(c, bo)
            if (v < lo) continue
            val r = Js.round(v)
            val khung = VungBien.khungO(c.lat, c.lon, h)
            val cat = khung.size != 1 || khung[0][2] - khung[0][0] < 2 * h - 1e-9
            for (k in khung) {
                if (!dau) sb.append(',')
                dau = false
                sb.append("{\"type\":\"Feature\",\"properties\":{\"s\":").append(soJson(r))
                if (cat) sb.append(",\"m\":1")
                sb.append("},\"geometry\":{\"type\":\"Polygon\",\"coordinates\":[[")
                vong(sb, k[0], k[1], k[2], k[3])
                sb.append("]]}}")
            }
        }
        return sb.append("]}").toString()
    }

    internal fun soJson(x: Double) = if (x.isNaN() || x.isInfinite()) "null" else Js.inSo(x)

    internal fun vong(sb: StringBuilder, x0: Double, y0: Double, x1: Double, y1: Double) {
        fun p(x: Double, y: Double) = sb.append('[').append(soJson(x)).append(',').append(soJson(y)).append(']')
        p(x0, y0); sb.append(','); p(x1, y0); sb.append(','); p(x1, y1); sb.append(','); p(x0, y1); sb.append(','); p(x0, y0)
    }

    /** Paint lớp `fish-grid-fill` (MapLibre JSON): bậc màu theo ngưỡng dưới của 3 mức, đục 0,6. */
    val LOP_CA_FILL = "{\"fill-color\":[\"step\",[\"get\",\"s\"],\"#22c55e\",60,\"#eab308\",75,\"#ef4444\"],\"fill-opacity\":0.6}"
    /** Lớp `fish-grid-line`: filter `["!",["has","m"]]`, viền trắng mảnh. */
    val LOP_CA_LINE_FILTER = "[\"!\",[\"has\",\"m\"]]"
    val LOP_CA_LINE = "{\"line-color\":\"#ffffff\",\"line-width\":0.6,\"line-opacity\":0.5}"

    /** = haversineKm (geofence.ts). */
    fun haversineKm(lat1: Double, lng1: Double, lat2: Double, lng2: Double): Double {
        val r = 6371.0
        fun rad(d: Double) = (d * kotlin.math.PI) / 180
        val dLat = rad(lat2 - lat1)
        val dLng = rad(lng2 - lng1)
        val s1 = sin(dLat / 2)
        val s2 = sin(dLng / 2)
        val a = s1 * s1 + cos(rad(lat1)) * cos(rad(lat2)) * s2 * s2
        return 2 * r * asin(min(1.0, sqrt(a)))
    }

    /**
     * = fishHotspots: ô ≥ 75 theo bộ loài, thưởng tối đa +12 cho ô gần NEO (cảng nhà + điểm ghim — KHÔNG điểm vừa
     * chạm), giữ khoảng cách hotspotSpacingDeg(lead), tối đa hotspotMaxCount(lead). `neo` = (lat, lon).
     */
    fun diemNong(view: BanDoCa?, bo: List<String>, neo: List<Pair<Double, Double>>, lead: Int, chuaChon: Boolean = false): List<DiemNong> {
        if (view == null || chuaChon) return emptyList()
        class Cham(val d: DiemNong, val priority: Double)
        val scored = view.cells.map { c ->
            val v = LoaiDanh.diemTheoBo(c, bo)
            val km = if (neo.isEmpty()) Double.POSITIVE_INFINITY else neo.minOf { haversineKm(it.first, it.second, c.lat, c.lon) }
            val bonus = max(0.0, 1 - km / 220) * 12
            Cham(DiemNong(c.lat, c.lon, v, LoaiDanh.loaiNoiTheoBo(c, bo), km <= 74), v + bonus)
        }.filter { it.d.v >= 75 }.sortedWith { a, b -> b.priority.compareTo(a.priority) }
        val spacing = PhaMuaVu.hotspotSpacingDeg(lead.toDouble())
        val maxCount = PhaMuaVu.hotspotMaxCount(lead.toDouble())
        val picked = mutableListOf<DiemNong>()
        for (c in scored) {
            if (picked.size >= maxCount) break
            if (picked.none { p -> max(abs(p.lat - c.d.lat), abs(p.lon - c.d.lon)) < spacing }) picked += c.d
        }
        return picked
    }

    /** Cả chuỗi của màn bản đồ: tầm ngày → bản xem (pha ngày xa) → lưới GeoJSON + hồng tâm. */
    fun lopCa(
        b: BanDoCa, bo: List<String>, ngayXemIso: String, daysAhead: Int,
        neo: List<Pair<Double, Double>>, clim: KhiHau?, bang: BangPha, chuaChon: Boolean = false,
    ): LopCa {
        val lead = tamNgay(b, ngayXemIso, daysAhead)
        val view = xemCa(b, lead, ngayXemIso, clim, bang)
        val buoc = buocLuoi(b)
        return LopCa(lead, view, buoc, luoiCaGeo(view, bo, buoc, chuaChon), diemNong(view, bo, neo, lead, chuaChon))
    }
}

/* ── vùng biển VN (src/lib/vung-bien-vn.ts + insideAllowed của geofence.ts) ─────────────────────────────────── */

object VungBien {
    /** [polygon][vòng] = DoubleArray phẳng [lon0, lat0, lon1, lat1, …] */
    private val POLYS: List<List<DoubleArray>> by lazy {
        (Json.parseToJsonElement(VungBienSinh.POLYS) as JsonArray).map { p ->
            (p as JsonArray).map { r ->
                val ring = r as JsonArray
                DoubleArray(ring.size * 2) { k -> Js.so((ring[k / 2] as JsonArray)[k % 2])!! }
            }
        }
    }

    private val BBOX: DoubleArray by lazy {
        var s = 90.0; var n = -90.0; var w = 180.0; var e = -180.0
        for (p in POLYS) {
            val r = p[0]
            for (k in 0 until r.size / 2) {
                val lo = r[2 * k]; val la = r[2 * k + 1]
                if (la < s) s = la
                if (la > n) n = la
                if (lo < w) w = lo
                if (lo > e) e = lo
            }
        }
        doubleArrayOf(s, n, w, e)
    }

    private const val EPSILON = 2.220446049250313E-16 // Number.EPSILON

    private fun trongVong(px: Double, py: Double, r: DoubleArray): Boolean {
        var inside = false
        val n = r.size / 2
        var j = n - 1
        for (i in 0 until n) {
            val xi = r[2 * i]; val yi = r[2 * i + 1]
            val xj = r[2 * j]; val yj = r[2 * j + 1]
            val dy = (yj - yi).let { if (it == 0.0 || it.isNaN()) EPSILON else it } // `(yj - yi || Number.EPSILON)`
            if ((yi > py) != (yj > py) && px < ((xj - xi) * (py - yi)) / dy + xi) inside = !inside
            j = i
        }
        return inside
    }

    /** = trongVungBienVN: HOẶC giữa các polygon, chẵn-lẻ trong từng polygon (lỗ đảo tự lật). */
    fun trongVung(lat: Double, lon: Double): Boolean {
        if (!lat.isFinite() || !lon.isFinite()) return false
        val b = BBOX
        if (lat < b[0] || lat > b[1] || lon < b[2] || lon > b[3]) return false
        return POLYS.any { rings ->
            var inside = false
            for (r in rings) if (trongVong(lon, lat, r)) inside = !inside
            inside
        }
    }

    /** = locOTrongVung */
    fun locO(cells: List<OCa>): List<OCa> = cells.filter { trongVung(it.lat, it.lon) }

    private const val CHIA = 8

    /** = khungOTrongVung: khung [tây, nam, đông, bắc] của ô tâm (lat, lon) nửa cạnh `h`, cắt theo vùng. */
    fun khungO(lat: Double, lon: Double, h: Double): List<DoubleArray> {
        val x0 = lon - h; val x1 = lon + h; val y0 = lat - h; val y1 = lat + h
        if (trongVung(y0, x0) && trongVung(y0, x1) && trongVung(y1, x0) && trongVung(y1, x1) && trongVung(lat, lon))
            return listOf(doubleArrayOf(x0, y0, x1, y1))
        val d = (2 * h) / CHIA
        val out = mutableListOf<DoubleArray>()
        for (i in 0 until CHIA) for (j in 0 until CHIA) {
            val a = x0 + j * d; val b = y0 + i * d
            if (trongVung(b + d / 2, a + d / 2)) out += doubleArrayOf(a, b, a + d, b + d)
        }
        return out
    }
}

/* ── loài bà con đánh (src/lib/fish-picks.ts) ───────────────────────────────────────────────────────────────── */

object LoaiDanh {
    const val MAX_FISH_PICKS = 3
    /** khoá kho — y web (localStorage) */
    const val KHO = "forfish.fishPicks.v1"

    /** = LOAI_THEO_NGHE (khoá = Nghe của lo-trinh/types.ts), thứ tự = loài hay gặp nhất trước */
    val LOAI_THEO_NGHE: Map<String, List<String>> = linkedMapOf(
        "cau-ngu" to listOf("ngừ vây vàng", "ngừ mắt to", "ngừ vằn", "cá cờ", "nục heo"),
        "luoi-vay" to listOf("cá nục", "cá cơm", "cá trích", "bạc má", "cá tráo", "cá sòng", "ngừ vằn"),
        "luoi-re" to listOf("cá thu", "ngừ chù", "ngừ ồ", "ngừ chấm", "cá ngân", "cá chim"),
        "chup-muc" to listOf("mực xà", "mực ống", "cá cơm"),
    )

    fun goiYTheoNghe(nghe: String, available: Collection<String>, dangVu: Set<String>): List<String> {
        val co = available.toSet()
        val ds = (LOAI_THEO_NGHE[nghe] ?: emptyList()).filter { it in co }
        return (ds.filter { it in dangVu } + ds.filter { it !in dangVu }).take(MAX_FISH_PICKS)
    }

    fun ngheCuaBo(picks: List<String>, available: Collection<String>, dangVu: Set<String>): String? {
        if (picks.isEmpty()) return null
        val key = picks.sorted().joinToString("|")
        return LOAI_THEO_NGHE.keys.firstOrNull { goiYTheoNghe(it, available, dangVu).sorted().joinToString("|") == key }
    }

    fun togglePick(picks: List<String>, sp: String): List<String> = when {
        sp in picks -> picks.filter { it != sp }
        picks.size >= MAX_FISH_PICKS -> picks.toList()
        else -> picks + sp
    }

    /** `cell.sp?.[p] ?? 0` */
    private fun diemLoai(c: OCa, p: String) = c.sp[p] ?: 0.0

    /** Điểm ô theo bộ: cao nhất trong các loài đã chọn; bộ rỗng ⇒ `s`. */
    fun diemTheoBo(c: OCa, picks: List<String>): Double {
        if (picks.isEmpty()) return c.s
        var m = 0.0
        for (p in picks) m = max(m, diemLoai(c, p)) // Math.max: NaN lan ra như JS
        return m
    }

    fun loaiNoiTheoBo(c: OCa, picks: List<String>): List<String> {
        if (picks.isEmpty()) return c.top
        return picks.filter { diemLoai(c, it) > 0 }.sortedWith { a, b -> diemLoai(c, b).compareTo(diemLoai(c, a)) }
    }

    /** = loadFishPicks: null = CHƯA chọn lần nào (⇒ mở bước chọn) / hỏng. */
    fun doc(kho: KhoMay): List<String>? {
        val raw = runCatching { kho.doc(KHO) }.getOrNull()
        if (raw.isNullOrEmpty()) return null
        val v = runCatching { Json.parseToJsonElement(raw) }.getOrNull() as? JsonArray ?: return null
        val ds = v.mapNotNull { Js.chuoi(it) }.take(MAX_FISH_PICKS)
        return ds.ifEmpty { null }
    }

    /** = saveFishPicks: false khi kho từ chối — chỗ gọi vẫn dùng trong phiên. */
    fun ghi(kho: KhoMay, picks: List<String>): Boolean {
        val sb = StringBuilder("[")
        picks.take(MAX_FISH_PICKS).forEachIndexed { i, s -> if (i > 0) sb.append(','); Js.jsonChuoi(s, sb) }
        return runCatching { kho.ghi(KHO, sb.append(']').toString()) }.getOrDefault(false)
    }
}

/* ── bản mùa vụ + bảng w + pha ngày xa (src/lib/fish-blend.ts) ──────────────────────────────────────────────── */

/** = Climatology (decodeClimatology của public/data/fish-climatology.v1.json — file SDF2 ở bản phát hành). */
class KhiHau(
    val lat0: Double, val lon0: Double, val dLat: Double, val dLon: Double, val nLat: Int, val nLon: Int,
    /** tháng 1..12 → điểm 0..255 mỗi ô (Uint8, row-major theo lat) */
    val months: Map<Int, IntArray>,
) {
    companion object {
        private val B64 = Base64.Default.withPadding(Base64.PaddingOption.PRESENT_OPTIONAL)

        /** = decodeClimatology. Tháng thiếu / cỡ sai bị bỏ. Ném khi base64 hỏng (y `atob`). */
        fun giai(e: JsonElement): KhiHau {
            val o = e as JsonObject
            val nLat = Js.Number(o["nLat"]); val nLon = Js.Number(o["nLon"])
            val need = nLat * nLon
            val months = LinkedHashMap<Int, IntArray>()
            val ms = o["months"] as? JsonObject
            for (m in 1..12) {
                val b64 = Js.chuoi(ms?.get(m.toString())) ?: continue
                if (b64.isEmpty()) continue
                val bin = B64.decode(b64.filter { it != ' ' && it != '\t' && it != '\n' && it != '\u000C' && it != '\r' })
                if (bin.isEmpty()) continue
                if (bin.size.toDouble() != need) continue
                months[m] = IntArray(bin.size) { bin[it].toInt() and 0xFF }
            }
            return KhiHau(Js.Number(o["lat0"]), Js.Number(o["lon0"]), Js.Number(o["dLat"]), Js.Number(o["dLon"]), nLat.toInt(), nLon.toInt(), months)
        }

        fun giai(s: String): KhiHau = giai(Json.parseToJsonElement(s))
    }

    /** = climScoreAt: ngoài lưới / thiếu tháng ⇒ 0. */
    fun diem(lat: Double, lon: Double, month: Int): Int {
        val buf = months[month] ?: return 0
        val i = Js.round((lat - lat0) / dLat)
        val j = Js.round((lon - lon0) / dLon)
        if (i < 0 || i >= nLat || j < 0 || j >= nLon) return 0
        return buf.getOrElse((i * nLon + j).toInt()) { 0 }
    }
}

/** Bảng w(d) đo bằng backtest = `fishBlend` trong model-params.v1.json. RONG = chưa nạp ⇒ blend tắt (giữ dự báo). */
class BangPha(rows: List<Pair<Double, Double>>, val degenerate: Boolean) {
    /** (lead, w) tăng dần theo lead, w kẹp [0, 1] */
    val measured: List<Pair<Double, Double>> = rows.sortedWith { a, b -> a.first.compareTo(b.first) }
    val usable: Boolean get() = measured.isNotEmpty() && !degenerate

    companion object {
        val RONG = BangPha(emptyList(), false)

        /** Nhận CẢ object model-params (`{fishBlend:…}`) — hỏng / thiếu ⇒ RONG. */
        fun giai(modelParams: JsonElement?): BangPha {
            val w = (modelParams as? JsonObject)?.get("fishBlend") as? JsonObject ?: return RONG
            val rows = (w["perLead"] as? JsonArray)?.mapNotNull { r ->
                val o = r as? JsonObject ?: return@mapNotNull null
                val wv = Js.so(o["w"]) ?: return@mapNotNull null
                Js.Number(o["lead"]) to min(1.0, max(0.0, wv))
            } ?: emptyList()
            val g = (w["guard"] as? JsonObject)?.get("degenerate") as? JsonPrimitive
            return BangPha(rows, g != null && !g.isString && g.booleanOrNull == true)
        }

        fun giai(s: String): BangPha = runCatching { giai(Json.parseToJsonElement(s)) }.getOrDefault(RONG)
    }

    fun maxMeasuredLead(): Double = if (measured.isEmpty()) 0.0 else measured.last().first

    fun measuredWeight(dayIdx: Double): Double {
        if (!usable) return 1.0
        val d = max(0.0, dayIdx)
        if (d == 0.0) return 1.0
        val m0 = measured[0]
        if (d <= m0.first) {
            val t = d / m0.first
            return 1 + t * (m0.second - 1)
        }
        for (i in 0 until measured.size - 1) {
            val a = measured[i]; val b = measured[i + 1]
            if (d <= b.first) {
                val t = (d - a.first) / (b.first - a.first)
                return a.second + t * (b.second - a.second)
            }
        }
        return measured.last().second
    }

    fun climShare(dayIdx: Double): Double {
        val d = max(0.0, dayIdx)
        if (!usable || d == 0.0) return 0.0
        val raw = 1 - measuredWeight(d)
        val lo = 1 - measuredWeight(measured[0].first)
        val hi = 1 - measuredWeight(measured.last().first)
        if (!(hi > lo)) {
            val t = min(1.0, d / max(1.0, measured.last().first))
            return PhaMuaVu.PRODUCT_SHARE_FIRST + t * (PhaMuaVu.PRODUCT_SHARE_LAST - PhaMuaVu.PRODUCT_SHARE_FIRST)
        }
        val t = (raw - lo) / (hi - lo)
        val v = PhaMuaVu.PRODUCT_SHARE_FIRST +
            max(0.0, min(1.0, t)).pow(PhaMuaVu.PRODUCT_SHARE_GAMMA) * (PhaMuaVu.PRODUCT_SHARE_LAST - PhaMuaVu.PRODUCT_SHARE_FIRST)
        return max(0.0, min(1.0, v))
    }

    fun blendWeight(dayIdx: Double): Double {
        if (!usable) return 1.0
        if (max(0.0, dayIdx) == 0.0) return 1.0
        return 1 - climShare(dayIdx)
    }

    fun blendScore(persistS: Double, climS: Double, dayIdx: Double): Double {
        val w = blendWeight(dayIdx)
        return max(0.0, min(100.0, Js.round(w * persistS + (1 - w) * climS)))
    }
}

object PhaMuaVu {
    const val PRODUCT_SHARE_FIRST = 0.06
    const val PRODUCT_SHARE_LAST = 0.25
    const val PRODUCT_SHARE_GAMMA = 2.5
    const val ABSENT_PERSIST = 12.0
    const val HOTSPOT_SPACING_TODAY_DEG = 0.7

    /** = fishLeadDays: ngày đang xem − NGÀY ẢNH, không dưới tầm tính từ hôm nay. */
    fun fishLeadDays(imageDateIso: String?, viewDateIso: String, viewLead: Int): Int {
        if (imageDateIso.isNullOrEmpty() || viewDateIso.isEmpty()) return max(0, viewLead)
        val from = Js.ngayMs(imageDateIso) ?: return max(0, viewLead)
        val to = Js.ngayMs(viewDateIso) ?: return max(0, viewLead)
        val d = Js.round((to - from) / 86_400_000).toInt()
        return max(0, max(d, viewLead))
    }

    private val DRIFT_KM = listOf(1.0 to 62.0, 3.0 to 119.0, 5.0 to 150.0, 8.0 to 214.0, 12.0 to 233.0, 16.0 to 249.0)
    private const val KM_PER_DEG = 111.0

    fun hotspotSpacingDeg(dayIdx: Double): Double {
        val d = max(0.0, dayIdx)
        if (d == 0.0) return HOTSPOT_SPACING_TODAY_DEG
        var km = DRIFT_KM[0].second
        if (d >= DRIFT_KM.last().first) {
            km = DRIFT_KM.last().second
        } else {
            for (i in 0 until DRIFT_KM.size - 1) {
                val (d0, k0) = DRIFT_KM[i]
                val (d1, k1) = DRIFT_KM[i + 1]
                if (d <= d0) { km = k0; break }
                if (d <= d1) { km = k0 + ((d - d0) / (d1 - d0)) * (k1 - k0); break }
            }
        }
        return max(HOTSPOT_SPACING_TODAY_DEG, km / KM_PER_DEG)
    }

    fun hotspotMaxCount(dayIdx: Double): Int {
        val d = max(0.0, dayIdx)
        return if (d == 0.0 || d <= 3) 8 else if (d <= 8) 6 else 4
    }

    /** = buildClimScaleMap: điểm mùa vụ 0..100 → thang bản đồ ngày theo phân vị (thiếu ⇒ đồng nhất). */
    fun buildClimScaleMap(clim: KhiHau?, month: Int, dayScores: List<Double>): IntArray {
        val identity = IntArray(101) { it }
        val buf = clim?.months?.get(month)
        if (buf == null || dayScores.isEmpty()) return identity
        val climHist = IntArray(101)
        var nClim = 0
        for (v in buf) if (v > 0) { climHist[min(100, v)]++; nClim++ }
        val dayHist = IntArray(101)
        var nDay = 0
        for (v in dayScores) if (v > 0) { dayHist[max(0.0, min(100.0, Js.round(v))).toInt()]++; nDay++ }
        if (nClim == 0 || nDay == 0) return identity
        val dayAtPct = IntArray(1001)
        run {
            var acc = 0
            var s = 0
            for (step in 0..1000) {
                val p = step / 1000.0
                while (s <= 100 && (acc + dayHist[s]).toDouble() / nDay < p) { acc += dayHist[s]; s++ }
                dayAtPct[step] = min(100, s)
            }
        }
        val out = IntArray(101)
        var acc = 0
        for (v in 0..100) {
            if (v == 0) { out[0] = 0; continue }
            val p = (acc + climHist[v] / 2.0) / nClim
            acc += climHist[v]
            out[v] = if (climHist[v] == 0) out[v - 1] else dayAtPct[Js.round(p * 1000).toInt()]
        }
        for (v in 1..100) if (out[v] < out[v - 1]) out[v] = out[v - 1]
        return out
    }

    /** = blendFishCells (v2: phân vị + hợp hai tập ô + giãn về phân bố hôm nay). */
    fun blendFishCells(cells: List<OCa>, clim: KhiHau?, month: Int, dayIdx: Int, bang: BangPha, gridStep: Double? = null): List<OCa> {
        if (cells.isEmpty() || dayIdx <= 0 || clim == null || !bang.usable) return cells
        val buf = clim.months[month] ?: return cells
        val w = bang.blendWeight(dayIdx.toDouble())
        val scale = buildClimScaleMap(clim, month, cells.map { it.s })
        val step = gridStep ?: abs(clim.dLat).let { if (it == 0.0 || it.isNaN()) 0.25 else it }
        fun key(lat: Double, lon: Double) = Js.inSo(Js.round(lat / step)) + "," + Js.inSo(Js.round(lon / step))
        val seen = HashSet<String>()
        val out = ArrayList<OCa>()
        val rawBlend = ArrayList<Double>()
        val nLat = clim.nLat; val nLon = clim.nLon
        for (c in cells) {
            seen += key(c.lat, c.lon)
            val i = Js.round((c.lat - clim.lat0) / clim.dLat)
            val j = Js.round((c.lon - clim.lon0) / clim.dLon)
            val raw = if (i >= 0 && i < nLat && j >= 0 && j < nLon) buf.getOrElse((i * nLon + j).toInt()) { 0 } else 0
            val climS = scale.getOrElse(min(100, raw)) { 0 }
            rawBlend += w * c.s + (1 - w) * climS
            out += c
        }
        for (i in 0 until nLat) for (j in 0 until nLon) {
            val raw = buf.getOrElse(i * nLon + j) { 0 }
            if (raw == 0) continue
            val lat = Js.round((clim.lat0 + i * clim.dLat) * 100) / 100
            val lon = Js.round((clim.lon0 + j * clim.dLon) * 100) / 100
            if (key(lat, lon) in seen) continue
            val climS = scale.getOrElse(min(100, raw)) { 0 }
            val v = w * ABSENT_PERSIST + (1 - w) * climS
            if (v <= 0) continue
            rawBlend += v
            out += OCa(lat, lon, 0.0, emptyList(), emptyMap(), 0.0, null, fromClim = true)
        }
        val target = cells.map { it.s }.sortedWith { a, b -> a.compareTo(b) }
        val order = rawBlend.indices.sortedWith { a, b -> rawBlend[a].compareTo(rawBlend[b]) }
        val n = order.size
        for (k in 0 until n) {
            val i = order[k]
            val pos = if (n == 1) target.size - 1 else Js.round((k.toDouble() / (n - 1)) * (target.size - 1)).toInt()
            val s = max(0.0, min(100.0, Js.round(target.getOrElse(pos) { 0.0 })))
            val cell = out[i]
            var sp = cell.sp
            if (cell.s > 0 && s != cell.s) {
                val kk = s / cell.s
                sp = cell.sp.mapValuesTo(LinkedHashMap()) { max(0.0, min(100.0, Js.round(it.value * kk))) }
            }
            out[i] = cell.copy(s = s, sp = sp, goc = null)
        }
        return out
    }
}
