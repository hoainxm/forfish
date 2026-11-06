package vn.sdvico.forfish.shared.dangchay

import kotlin.math.floor

/*
  "ĐANG TRONG VÙNG" — PORT Y src/lib/nav-vung.ts (vungDangTrong, initVungTheoDoi, theoDoiVung, cauVung) + dangCam của
  vung-quan-ly.ts. Vào/ra phải giữ VUNG_XAC_NHAN lần đo liền; vùng theo mùa chỉ tính khi ĐANG mùa cấm; vùng cấm VÀO
  không đọc câu vào (nav-hazards đã đọc).
  KHÁC WEB (có chủ ý, ghi trong DangChayVangTest):
   · ngày tháng của mùa cấm tính theo GIỜ VIỆT NAM (UTC+7, không giờ mùa hè) — web dùng giờ máy (`new Date().getMonth()`),
     máy bà con đặt giờ VN nên trùng; Kotlin chung không có múi giờ máy.
   · `localeCompare(…, "vi")` thay bằng khoá xếp tiếng Việt tự dựng (chữ cái → dấu thanh → chữ gốc) — đủ cho tên vùng;
     ICU còn luật tertiary khác ở ký tự lạ.
*/

/** = MuaCam (vung-quan-ly) */
data class MuaCamChay(val tuThang: Int, val tuNgay: Int, val denThang: Int, val denNgay: Int)

/** = BBox */
data class KhungVung(val latMin: Double, val latMax: Double, val lonMin: Double, val lonMax: Double)

/** = NoGoZone / NoGoLike — vòng [lon, lat] */
data class VungCamVao(val id: String, val ten: String?, val ring: List<DoubleArray>, val bbox: KhungVung)

/** = NavRestricted — `mua` null = quanh năm; rỗng = không bao giờ tính (y web). */
data class VungHanChe(
    val id: String,
    val ten: String,
    val loai: String,
    val ring: List<DoubleArray>,
    val bbox: KhungVung,
    val mua: List<MuaCamChay>? = null,
)

/** muc: "do" (cấm vào) | "vang" */
data class VungTrong(val id: String, val ten: String, val muc: String)

/** loai: "vao" | "ra" */
data class VungSuKien(val loai: String, val id: String, val ten: String, val muc: String, val lan: Int)

data class VungTheoDoi(
    val trong: List<VungTrong>,
    val dem: Map<String, Int>,
    val cho: Map<String, VungTrong>,
    val lan: Int,
)

object VungChay {
    const val VUNG_XAC_NHAN = 2
    private const val VN_MS = 7 * 3_600_000.0
    private const val DAY_MS = 86_400_000.0

    /** (tháng, ngày) theo giờ VN của mốc ms. */
    internal fun thangNgayVN(ms: Double): Pair<Int, Int> {
        val z = floor((ms + VN_MS) / DAY_MS).toLong() + 719468
        val era = (if (z >= 0) z else z - 146096) / 146097
        val doe = z - era * 146097
        val yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365
        val doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        val mp = (5 * doy + 2) / 153
        val d = (doy - (153 * mp + 2) / 5 + 1).toInt()
        val m = (if (mp < 10) mp + 3 else mp - 9).toInt()
        return m to d
    }

    /** = dangCam: khoảng có đầu > cuối là vắt năm. */
    fun dangCam(mua: List<MuaCamChay>, nowMs: Double): Boolean {
        val (thang, ngay) = thangNgayVN(nowMs)
        val now = thang * 100 + ngay
        for (m in mua) {
            val tu = m.tuThang * 100 + m.tuNgay
            val den = m.denThang * 100 + m.denNgay
            if (if (tu <= den) now in tu..den else now >= tu || now <= den) return true
        }
        return false
    }

    private fun trongHop(p: ViTri, b: KhungVung) = p.lat >= b.latMin && p.lat <= b.latMax && p.lon >= b.lonMin && p.lon <= b.lonMax

    fun vungDangTrong(noGo: List<VungCamVao>?, restricted: List<VungHanChe>?, pos: ViTri?, nowMs: Double): List<VungTrong> {
        if ((noGo == null && restricted == null) || pos == null || !pos.lat.isFinite() || !pos.lon.isFinite()) return emptyList()
        val out = mutableListOf<VungTrong>()
        for (z in noGo.orEmpty()) {
            if (z.ring.size < 3 || !trongHop(pos, z.bbox)) continue
            if (HinhHoc.pointInRing(pos, z.ring)) out += VungTrong(z.id, z.ten ?: "vùng cấm vào", "do")
        }
        for (z in restricted.orEmpty()) {
            if (z.mua != null && (z.mua.isEmpty() || !dangCam(z.mua, nowMs))) continue
            if (z.ring.size < 3 || !trongHop(pos, z.bbox)) continue
            if (HinhHoc.pointInRing(pos, z.ring)) out += VungTrong(z.id, z.ten, "vang")
        }
        return out
    }

    fun initVungTheoDoi() = VungTheoDoi(emptyList(), emptyMap(), emptyMap(), 0)

    private val xep = Comparator<VungTrong> { a, b ->
        val m = if (a.muc == b.muc) 0 else if (a.muc == "do") -1 else 1
        if (m != 0) m else SapXepVi.so(a.ten, b.ten)
    }

    /** = theoDoiVung — không đổi gì thì trả ĐÚNG đối tượng cũ. */
    fun theoDoiVung(prev: VungTheoDoi, tho: List<VungTrong>): Pair<VungTheoDoi, List<VungSuKien>> {
        val thoIds = LinkedHashMap<String, VungTrong>().apply { for (v in tho) put(v.id, v) }
        val trongIds = prev.trong.associateBy { it.id }
        val dem = LinkedHashMap<String, Int>()
        val cho = LinkedHashMap<String, VungTrong>()
        val trong = mutableListOf<VungTrong>()
        val su = mutableListOf<VungSuKien>()
        var lan = prev.lan
        var doi = false
        for (v in prev.trong) {
            if (v.id in thoIds) {
                trong += v
                if ((prev.dem[v.id] ?: 0) != 0) doi = true
                continue
            }
            val n = (prev.dem[v.id] ?: 0) + 1
            doi = true
            if (n >= VUNG_XAC_NHAN) {
                lan += 1
                su += VungSuKien("ra", v.id, v.ten, v.muc, lan)
            } else {
                dem[v.id] = n
                trong += v
            }
        }
        for (v in tho) {
            if (v.id in trongIds) continue
            val n = (prev.dem[v.id] ?: 0) + 1
            doi = true
            if (n >= VUNG_XAC_NHAN) {
                lan += 1
                trong += v
                su += VungSuKien("vao", v.id, v.ten, v.muc, lan)
            } else {
                dem[v.id] = n
                cho[v.id] = v
            }
        }
        for (id in prev.cho.keys) if (id !in thoIds) doi = true
        if (!doi) return prev to su
        return VungTheoDoi(trong.sortedWith(xep), dem, cho, lan) to su
    }

    /** = cauVung */
    fun cauVung(e: VungSuKien): String? {
        if (e.loai == "ra") return "Tàu đã ở ngoài ${e.ten}."
        return if (e.muc == "do") null else "Đang trong ${e.ten}."
    }
}

/** Khoá xếp tên tiếng Việt (thay `localeCompare(…, "vi")`): bậc 1 chữ cái (ă â đ ê ô ơ ư là chữ riêng), bậc 2 dấu thanh. */
internal object SapXepVi {
    private const val CHU = "aăâbcdđeêfghijklmnoôơpqrstuưvwxyz"
    private val NGUYEN_AM = listOf(
        "aàáảãạ", "ăằắẳẵặ", "âầấẩẫậ", "eèéẻẽẹ", "êềếểễệ", "iìíỉĩị",
        "oòóỏõọ", "ôồốổỗộ", "ơờớởỡợ", "uùúủũụ", "ưừứửữự", "yỳýỷỹỵ",
    )
    private val TACH = HashMap<Char, Pair<Char, Int>>().apply {
        for (nhom in NGUYEN_AM) nhom.forEachIndexed { thanh, c -> put(c, nhom[0] to thanh) }
    }

    private fun khoa(s: String): Pair<List<Int>, List<Int>> {
        val c1 = mutableListOf<Int>()
        val c2 = mutableListOf<Int>()
        for (ch0 in s.lowercase()) {
            val (goc, thanh) = TACH[ch0] ?: (ch0 to 0)
            val i = CHU.indexOf(goc)
            c1 += if (i >= 0) 1000 + i else if (goc.code < 128) goc.code else 2000 + goc.code
            c2 += thanh
        }
        return c1 to c2
    }

    private fun soDay(a: List<Int>, b: List<Int>): Int {
        for (i in 0 until minOf(a.size, b.size)) if (a[i] != b[i]) return a[i].compareTo(b[i])
        return a.size.compareTo(b.size)
    }

    fun so(a: String, b: String): Int {
        val (a1, a2) = khoa(a)
        val (b1, b2) = khoa(b)
        return soDay(a1, b1).takeIf { it != 0 } ?: soDay(a2, b2).takeIf { it != 0 } ?: a.compareTo(b)
    }
}
