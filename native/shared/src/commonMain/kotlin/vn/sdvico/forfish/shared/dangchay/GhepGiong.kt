package vn.sdvico.forfish.shared.dangchay

import vn.sdvico.forfish.shared.bando.Js
import kotlin.math.min

/*
  GHÉP GIỌNG SEN BIỂN — PORT Y src/lib/voice/ghep.mjs (docSo, vietThanhNoi, khoaAmTiet, khoaManh, ghepManh) + phần
  thuần của src/lib/voice/tts.ts (clipKey, clipFor, splitSentences, speechParts, PAUSE_*). Danh mục câu nguyên
  (src/data/giong-sen-bien.json) + mảnh (src/data/giong-sen-bien-manh.json) SINH thành GiongSinh.kt
  (native/scripts/sinh-dang-chay.mjs) — nền phát `public/giong/sen-bien/<id>.mp3` và `/giong/sen-bien/m/<id>.mp3`.
  Luật "MỘT CÂU MỘT GIỌNG": câu phủ ĐỦ mảnh mới ghép mp3; thiếu dù một khúc ⇒ CẢ CÂU giọng máy.
  KHÁC WEB: không `normalize("NFC")` (Kotlin chung không có Normalizer) — chữ của app vốn NFC; tên bà con gõ bằng bàn
  phím tổ hợp (NFD) sẽ không khớp mảnh ⇒ đọc giọng máy (phía an toàn). nợ: thêm expect/actual NFC nếu gặp máy gõ NFD.
*/

/** = SpeechPart — clips null ⇒ đọc giọng máy; pauseMs = nghỉ SAU đoạn này. */
data class DoanPhat(val text: String, val clips: List<String>?, val pauseMs: Int)

/** Khúc ghép: chữ + id mảnh (null = giọng máy). */
data class KhucGhep(val text: String, val ids: List<String>?)

/** Cách phát MỘT lượt nói. */
sealed class KeHoachPhat {
    /** Cả lượt là một câu thu sẵn ⇒ phát đúng một file. */
    data class MotFile(val file: String) : KeHoachPhat()

    /** Mọi đoạn có mp3 (câu nguyên và/hoặc mảnh) ⇒ phát NỐI ĐUÔI, nghỉ sau mỗi đoạn (0 / 120 / 180 ms). */
    data class NhieuFile(val doan: List<DoanPhat>) : KeHoachPhat()

    /** Không đoạn nào có mp3 ⇒ giọng hệ thống đọc cả lượt (nền vẫn có thể ngắt theo `doan`). */
    data class GiongMay(val text: String, val doan: List<DoanPhat>) : KeHoachPhat()

    /** Lượt nhiều câu: câu có mp3, câu giọng máy — phát lần lượt từng đoạn. */
    data class Tron(val doan: List<DoanPhat>) : KeHoachPhat()
}

object GhepGiong {
    const val PAUSE_COMMA_MS = 120
    const val PAUSE_SENTENCE_MS = 180
    const val TTS_RATE = 1.0
    const val TTS_RATE_SHORT = 1.12
    const val SHORT_REPLY_MAX_CHARS = 80

    /** = speechRate: câu đáp ngắn đọc nhanh hơn chút. */
    fun speechRate(reply: Boolean, text: String) = if (reply && text.length <= SHORT_REPLY_MAX_CHARS) TTS_RATE_SHORT else TTS_RATE

    private val SO = listOf("không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín")

    private fun duoiTram(n: Int, sauTram: Boolean): List<String> {
        if (n == 0) return emptyList()
        if (n < 10) return if (sauTram) listOf("lẻ", SO[n]) else listOf(SO[n])
        val c = n / 10
        val u = n % 10
        val dv = if (u == 0) emptyList() else if (u == 5) listOf("lăm") else listOf(SO[u])
        if (c == 1) return listOf("mười") + dv
        val dvMuoi = if (u == 1) listOf("mốt") else if (u == 4) listOf("tư") else dv
        return listOf(SO[c], "mươi") + dvMuoi
    }

    private fun duoiNghin(n: Int, du: Boolean): List<String> {
        val h = n / 100
        val r = n % 100
        if (h == 0 && !du) return duoiTram(r, false)
        return listOf(SO[h], "trăm") + duoiTram(r, true)
    }

    private val CHI_SO = Regex("^[0-9]+$")

    /** = docSo: "05" / quá 9 chữ số ⇒ đọc từng chữ số. */
    fun docSo(s: String): List<String> {
        if (!CHI_SO.matches(s)) return emptyList()
        if ((s.length > 1 && s[0] == '0') || s.length > 9) return s.map { SO[it - '0'] }
        val n = s.toInt()
        if (n == 0) return listOf("không")
        val tr = n / 1_000_000
        val ng = (n % 1_000_000) / 1000
        val r = n % 1000
        val out = mutableListOf<String>()
        if (tr != 0) { out += duoiNghin(tr, false); out += "triệu" }
        if (ng != 0) { out += duoiNghin(ng, tr > 0); out += "nghìn" }
        if (r != 0) out += duoiNghin(r, tr > 0 || ng > 0)
        return out
    }

    private fun docThapPhan(nguyen: String, le: String): List<String> {
        val sau = if (le.length == 1 || le[0] == '0') le.map { SO[it - '0'] } else docSo(le)
        return docSo(nguyen) + "phẩy" + sau
    }

    private const val WS = CauNoi.WS
    private val R_KMH = Regex("km$WS*/$WS*(?:giờ|h)", RegexOption.IGNORE_CASE)
    private val R_HLG = Regex("hải lý$WS*/$WS*giờ", RegexOption.IGNORE_CASE)
    private val R_NGHIN = Regex("[0-9]{1,3}(?:\\.[0-9]{3})+(?![0-9,])")
    private val R_KHOANG = Regex("([0-9])$WS*[–—-]$WS*(?=[0-9])")
    private val R_KM = Regex("([0-9])$WS*km(?!\\p{L})")
    private val R_M = Regex("([0-9])$WS*m(?!\\p{L})")
    private val R_HA = Regex("([0-9])$WS*ha(?!\\p{L})")
    private val R_H = Regex("([0-9])$WS*h(?!\\p{L})")
    private val R_THAP_PHAN = Regex("([0-9]+),([0-9]+)")
    private val R_SO = Regex("[0-9]+")
    private val R_KHAC = Regex("[^\\p{L}\\p{N}]+")
    private val R_TRANG = Regex("$WS+")

    /** = vietThanhNoi: chữ viết → câu NÓI (giữ hoa/thường để nhận tên riêng). */
    fun vietThanhNoi(text: String): String {
        var s = " $text "
        s = R_KMH.replace(s, " cây số một giờ ")
        s = R_HLG.replace(s, " hải lý một giờ ")
        s = s.replace("%", " phần trăm ").replace("°", " độ ").replace("±", " sai số ")
        s = R_NGHIN.replace(s) { it.value.replace(".", "") }
        s = R_KHOANG.replace(s, "$1 đến ")
        s = R_KM.replace(s, "$1 cây số")
        s = R_M.replace(s, "$1 mét")
        s = R_HA.replace(s, "$1 héc ta")
        s = R_H.replace(s, "$1 giờ")
        s = R_THAP_PHAN.replace(s) { " ${docThapPhan(it.groupValues[1], it.groupValues[2]).joinToString(" ")} " }
        s = R_SO.replace(s) { " ${docSo(it.value).joinToString(" ")} " }
        return Js.trim(R_TRANG.replace(R_KHAC.replace(s, " "), " "))
    }

    fun khoaAmTiet(w: String) = w.lowercase()

    private fun amTiet(s: String) = vietThanhNoi(s).split(" ").filter { it.isNotEmpty() }

    /** = khoaManh: khoá tra MỘT mảnh. */
    fun khoaManh(text: String) = amTiet(text).joinToString(" ") { khoaAmTiet(it) }

    private class Seg(var a: Int, var b: Int, val id: String?)

    /** = ghepManh: lấy cụm âm tiết DÀI NHẤT có mảnh; tên riêng không bị xé. */
    fun ghepManh(doan: String, tra: (String) -> String?, dai: Int): List<KhucGhep> {
        val w = amTiet(doan)
        val k = w.map { khoaAmTiet(it) }
        val seg = mutableListOf<Seg>()
        var i = 0
        while (i < w.size) {
            var hit: Seg? = null
            var n = min(dai, w.size - i)
            while (n >= 1) {
                val id = tra(k.subList(i, i + n).joinToString(" "))
                if (id != null) { hit = Seg(i, i + n, id); break }
                n--
            }
            if (hit != null) {
                seg += hit
                i = hit.b
            } else {
                val last = seg.lastOrNull()
                if (last != null && last.id == null) last.b = i + 1 else seg += Seg(i, i + 1, null)
                i++
            }
        }
        fun hoa(j: Int) = w[j] != w[j].lowercase()
        fun toanHoa(s: Seg): Boolean {
            for (j in s.a until s.b) if (!hoa(j) || j == 0) return false
            return true
        }
        var x = 0
        while (x < seg.size) {
            val s = seg[x]
            if (s.id == null && (s.a until s.b).any { hoa(it) }) {
                while (x > 0 && seg[x - 1].id != null && toanHoa(seg[x - 1])) {
                    s.a = seg[x - 1].a
                    seg.removeAt(x - 1)
                    x--
                }
                while (x + 1 < seg.size && toanHoa(seg[x + 1])) {
                    s.b = seg[x + 1].b
                    seg.removeAt(x + 1)
                }
            }
            x++
        }
        val out = mutableListOf<Pair<StringBuilder, MutableList<String>?>>()
        for (s in seg) {
            val text = w.subList(s.a, s.b).joinToString(" ")
            val prev = out.lastOrNull()
            if (s.id == null) {
                if (prev != null && prev.second == null) prev.first.append(' ').append(text) else out += StringBuilder(text) to null
            } else if (prev != null && prev.second != null) {
                prev.first.append(' ').append(text)
                prev.second!! += s.id
            } else out += StringBuilder(text) to mutableListOf(s.id)
        }
        return out.map { KhucGhep(it.first.toString(), it.second?.toList()) }
    }

    /* ── danh mục ── */

    private val R_TRANG_KEY = Regex("$WS+")
    private val R_DAU_CUOI = Regex("[.!?…]+$")

    /** = clipKey: chữ thường, gộp khoảng trắng, bỏ dấu câu cuối. */
    fun clipKey(s: String): String = Js.trim(R_DAU_CUOI.replace(Js.trim(R_TRANG_KEY.replace(s.lowercase(), " ")), ""))

    private class DanhMuc(val cau: Map<String, String>, val manh: Map<String, String>, val dai: Int)

    private val danhMuc: DanhMuc by lazy {
        val cau = LinkedHashMap<String, String>()
        for ((id, text) in GiongSinh.cau()) cau[clipKey(text)] = "${GiongSinh.CAU_DIR}/$id.mp3"
        val manh = LinkedHashMap<String, String>()
        var dai = 1
        for ((id, text) in GiongSinh.manh()) {
            val k = khoaManh(text)
            if (k.isEmpty() || k in manh) continue
            manh[k] = "${GiongSinh.MANH_DIR}/$id.mp3"
            dai = maxOf(dai, k.split(" ").size)
        }
        DanhMuc(cau, manh, dai)
    }

    /** = clipFor: mp3 câu nguyên cho đúng câu này, hoặc null. */
    fun clipFor(sentence: String): String? = danhMuc.cau[clipKey(sentence)]

    /** Mảnh cho một khoá (chữ nói, thường). */
    fun manhFor(khoa: String): String? = danhMuc.manh[khoa]

    /** Số âm tiết mảnh dài nhất. */
    val manhDai: Int get() = danhMuc.dai

    /** = allClipUrls: câu nguyên trước, rồi mảnh — để tải trước khi còn sóng. */
    fun allClipUrls(): List<String> = (danhMuc.cau.values + danhMuc.manh.values).distinct()

    private val R_TACH_CAU = Regex("([.!?…])$WS+")

    /** = splitSentences */
    fun splitSentences(text: String): List<String> =
        R_TACH_CAU.replace(Js.trim(R_TRANG_KEY.replace(text, " ")), "$1\u0000").split('\u0000').filter { Js.trim(it).isNotEmpty() }

    private val R_TACH_DOAN = Regex("(?:[,;:]$WS+|$WS+[—–·-]$WS+)")

    /** = speechParts: một lượt nói → các đoạn đọc. */
    fun speechParts(text: String): List<DoanPhat> {
        val out = mutableListOf<DoanPhat>()
        for (sen in splitSentences(text)) {
            val clip = clipFor(sen)
            if (clip != null) {
                out += DoanPhat(sen, listOf(clip), PAUSE_SENTENCE_MS)
                continue
            }
            val chunks = sen.split(R_TACH_DOAN).map { Js.trim(it) }.filter { it.isNotEmpty() }
            val theoDoan = chunks.map { ghepManh(it, ::manhFor, manhDai) }
            val duManh = theoDoan.all { segs -> segs.all { it.ids != null } }
            if (!duManh) {
                out += DoanPhat(sen, null, PAUSE_SENTENCE_MS)
                continue
            }
            theoDoan.forEachIndexed { i, segs ->
                if (segs.isEmpty()) return@forEachIndexed
                for (g in segs) out += DoanPhat(g.text, g.ids, 0)
                out[out.size - 1] = out.last().copy(pauseMs = if (i == chunks.size - 1) PAUSE_SENTENCE_MS else PAUSE_COMMA_MS)
            }
        }
        if (out.isNotEmpty()) out[out.size - 1] = out.last().copy(pauseMs = 0)
        return out
    }

    /** Cách phát một lượt nói: câu nguyên ⇒ 1 file · đủ mảnh ⇒ danh sách file + nghỉ · thiếu ⇒ giọng hệ thống. */
    fun keHoachPhat(cau: String): KeHoachPhat {
        val doan = speechParts(cau)
        if (doan.isEmpty()) return KeHoachPhat.GiongMay(cau, doan)
        if (doan.size == 1 && doan[0].clips?.size == 1 && clipFor(doan[0].text) != null) return KeHoachPhat.MotFile(doan[0].clips!![0])
        if (doan.all { it.clips != null }) return KeHoachPhat.NhieuFile(doan)
        if (doan.all { it.clips == null }) return KeHoachPhat.GiongMay(cau, doan)
        return KeHoachPhat.Tron(doan)
    }
}
