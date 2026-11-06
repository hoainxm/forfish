package vn.sdvico.forfish.shared.dangchay

import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.thoitiet.TheDiem
import kotlin.math.abs
import kotlin.math.floor

/*
  CÂU NÓI TIẾNG VIỆT — PORT Y src/lib/nav-voice/phrases.ts (numVN, distSpeech, waveSpeech, speedSpeech, dirSpeech,
  clockSpeech, ageSpeech, toSpeechVN, FORBIDDEN_SPEECH/speechIsClean, wordCount) + cau-dan-duong.ts (cauBatDau,
  CAU_TAT_MAN, CAU_TU_DUNG, CAU_DU_HAI_DO) + ten-bao.ts (tenBaoNoi, 140 tên bão + 10 tên vừa rút) + VOICE_TEST_TEXT.
  Regex web: `\s` của JS gồm khoảng trắng Unicode, `\b` chỉ ASCII ⇒ viết tường minh (Java `\s` chỉ ASCII).
*/

/** = SpeechUnit */
enum class DonViNoi(val ma: String) { NM("nm"), KM("km") }

object CauNoi {
    const val KM_PER_NM = 1.852
    internal const val WS = "[\\t\\n\\u000B\\u000C\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF]"
    private const val KHONG_CHU = "(?![A-Za-z0-9_])"

    const val VOICE_TEST_TEXT = "Đây là giọng đọc cảnh báo của SDFish. Bà con nghe rõ là được."
    const val CAU_TAT_MAN = "Tắt màn hình là máy ngừng đọc."
    const val CAU_TU_DUNG = "Đã tới gần điểm đến. Đã dừng dẫn đường."
    const val CAU_DU_HAI_DO = "Máy đang canh độ sâu, rạn và chướng ngại phía trước."

    /** = numVN: dấu phẩy thập phân, bỏ ",0" */
    fun numVN(n: Double, digits: Int = 1): String {
        var f = 1.0
        repeat(digits) { f *= 10 }
        val r = Js.round(n * f) / f
        if (Js.laNguyen(r)) return Js.inSo(r)
        return TheDiem.toFixed(r, digits).replace(Regex("0+$"), "").replaceFirst(".", ",")
    }

    /** = distSpeech */
    fun distSpeech(km: Double, unit: DonViNoi): String {
        if (!km.isFinite() || km < 0) return ""
        if (km < 0.1) return "chưa tới 100 mét"
        if (km < 2) return "${Js.inSo(Js.round(km * 10) * 100)} mét"
        if (unit == DonViNoi.KM) return "${numVN(km, if (km < 10) 1 else 0)} cây số"
        val nm = km / KM_PER_NM
        return "${numVN(nm, if (nm < 10) 1 else 0)} hải lý"
    }

    /** = waveSpeech: 2,5 → "2 mét rưỡi"; 0,4 → "dưới nửa mét" */
    fun waveSpeech(m: Double): String {
        if (!m.isFinite() || m < 0) return ""
        if (m < 0.5) return "dưới nửa mét"
        val half = Js.round(m * 2) / 2
        if (abs(half - m) <= 0.1) {
            val whole = floor(half)
            if (half == whole) return "${Js.inSo(whole)} mét"
            return if (whole == 0.0) "nửa mét" else "${Js.inSo(whole)} mét rưỡi"
        }
        return "${numVN(m, 1)} mét"
    }

    fun speedSpeech(kmh: Double, unit: DonViNoi): String =
        if (unit == DonViNoi.KM) "${Js.inSo(Js.round(kmh))} cây số một giờ" else "${Js.inSo(Js.round(kmh / KM_PER_NM))} hải lý một giờ"

    fun dirSpeech(deg: Double) = TheDiem.windDirectionVN(deg)

    /** = clockSpeech: "7 giờ sáng" / "3 giờ 30 chiều" (giờ VN, làm tròn 5 phút) */
    fun clockSpeech(ms: Double): String {
        val t = ms + 7 * 3_600_000.0
        val trongNgay = t - floor(t / 86_400_000.0) * 86_400_000.0
        val gio = floor(trongNgay / 3_600_000.0)
        val phut = floor((trongNgay - gio * 3_600_000.0) / 60_000.0)
        val total = (gio * 60 + Js.round(phut / 5) * 5) % 1440
        val h = floor(total / 60).toInt()
        val m = (total % 60).toInt()
        val buoi = if (h < 11) "sáng" else if (h < 13) "trưa" else if (h < 18) "chiều" else "tối"
        val h12 = if (h == 0) 12 else if (h > 12) h - 12 else h
        return "$h12 giờ${if (m != 0) " $m" else ""} $buoi"
    }

    /** = ageSpeech */
    fun ageSpeech(atMs: Double?, nowMs: Double): String {
        if (atMs == null || !atMs.isFinite()) return "chưa rõ giờ tin"
        val age = nowMs - atMs
        if (age < 2 * 3_600_000) return "tin lúc ${clockSpeech(atMs)}"
        val h = Js.round(age / 3_600_000)
        if (h < 48) return "tin cũ ${Js.inSo(h)} giờ"
        return "tin cũ ${Js.inSo(Js.round(h / 24))} ngày"
    }

    private val R_PM = Regex("±$WS*")
    private val R_KHOANG = Regex("([0-9])$WS*[–-]$WS*([0-9])")
    private val R_GACH = Regex("$WS*[—–]$WS*")
    private val R_NGOAC = Regex("$WS*\\(([^)]*)\\)")
    private val R_KM = Regex("([0-9])$WS*km$KHONG_CHU")
    private val R_M = Regex("([0-9])$WS*m$KHONG_CHU")
    private val R_HL = Regex("([0-9])$WS*hl$KHONG_CHU")
    private val R_DO = Regex("([0-9])$WS*°")
    private val R_NGA = Regex("~$WS*")
    private val R_CHEO = Regex("$WS*/$WS*")
    private val R_TRANG2 = Regex("$WS{2,}")
    private val R_TRUOC_DAU = Regex("$WS+([,.])")
    private val R_PHAY2 = Regex(",$WS*,")
    private val R_PHAY_CHAM = Regex(",$WS*\\.")

    /** = toSpeechVN: câu HIỂN THỊ → câu NÓI */
    fun toSpeechVN(text: String): String {
        var s = text
        s = R_PM.replace(s, "sai số ")
        s = R_KHOANG.replace(s, "$1 đến $2")
        s = R_GACH.replace(s, ", ")
        s = R_NGOAC.replace(s, ", $1")
        s = R_KM.replace(s, "$1 cây số")
        s = R_M.replace(s, "$1 mét")
        s = R_HL.replace(s, "$1 hải lý")
        s = R_DO.replace(s, "$1 độ")
        s = R_NGA.replace(s, "chừng ")
        s = R_CHEO.replace(s, " trên ")
        s = R_TRANG2.replace(s, " ")
        s = R_TRUOC_DAU.replace(s, "$1")
        s = R_PHAY2.replace(s, ",")
        s = R_PHAY_CHAM.replace(s, ".")
        return Js.trim(s)
    }

    val FORBIDDEN_SPEECH = listOf(
        Regex("an toàn", RegexOption.IGNORE_CASE),
        Regex("bẻ lái", RegexOption.IGNORE_CASE),
        Regex("giảm ga", RegexOption.IGNORE_CASE),
        Regex("south china sea", RegexOption.IGNORE_CASE),
        Regex("không có (đá|rạn|gì) (ngầm )?phía trước", RegexOption.IGNORE_CASE),
    )

    fun speechIsClean(s: String) = FORBIDDEN_SPEECH.none { it.containsMatchIn(s) }

    fun wordCount(s: String) = Js.tachTrang(s).count { it.isNotEmpty() }

    /** = cauBatDau: quãng · giờ · hướng đầu + lời dặn tắt màn. */
    fun cauBatDau(distKm: Double, hours: Double, huongDauDeg: Double?, unit: DonViNoi): String {
        val huong = if (huongDauDeg != null && huongDauDeg.isFinite()) " Đi về phía ${dirSpeech(huongDauDeg)}." else ""
        return "Bắt đầu dẫn đường. Còn chừng ${distSpeech(distKm, unit)}, chừng ${HinhHoc.formatHoursVN(hours)}.$huong $CAU_TAT_MAN"
    }

    /* ── ten-bao.ts ── */

    /** Khoá tra: chữ hoa, chỉ A–Z. */
    fun khoaTenBao(name: String) = name.uppercase().filter { it in 'A'..'Z' }

    private val BANG = listOf(
        "Damrey" to "Đam rây", "Tianma" to "Thiên Mã", "Kirogi" to "Ki rô ghi", "Yun-yeung" to "Uyên Ương",
        "Koinu" to "Côi nu", "Bolaven" to "Bô la ven", "Sanba" to "San ba", "Jelawat" to "Giê la oát",
        "Tirou" to "Ti râu", "Maliksi" to "Ma lích xi", "Gaemi" to "Ghe mi", "Prapiroon" to "Pa ra pi run",
        "Maria" to "Ma ri a", "Son-Tinh" to "Sơn Tinh", "Ampil" to "Am pin", "Wukong" to "Ngộ Không",
        "Jongdari" to "Chong đa ri", "Shanshan" to "San San", "Tomo" to "Tô mô", "Leepi" to "Li pi",
        "Bebinca" to "Bê bin ca", "Pulasan" to "Pu la xan", "Soulik" to "Xu lích", "Cimaron" to "Xi ma rôn",
        "Narae" to "Na re", "Burapha" to "Bu ra pha", "Barijat" to "Ba ri chát", "Hoaban" to "Hoa Ban",
        "Koki" to "Cô ki", "Yinxing" to "Ngân Hạnh", "Gaeguri" to "Ghe gu ri", "Dim-sum" to "Điểm Tâm",
        "Hebi" to "Hê bi", "Pabuk" to "Pa búc", "Wutip" to "Vu típ", "Sepat" to "Xê pát",
        "Mun" to "Mun", "Danas" to "Đa nát", "Nari" to "Na ri", "Wipha" to "Vi pha",
        "Francisco" to "Phơ ran xít cô", "Co-May" to "Cỏ May", "Krosa" to "Cơ rô xa", "Bailu" to "Bạch Lộc",
        "Podul" to "Pô đun", "Lingling" to "Linh linh", "Kajiki" to "Ca gi ki", "Nongfa" to "Nông pha",
        "Peipah" to "Pây pa", "Tapah" to "Ta pa", "Mitag" to "Mi tác", "Ragasa" to "Ra ga xa",
        "Neoguri" to "Nê ô gu ri", "Bualoi" to "Bua lôi", "Matmo" to "Mát mô", "Halong" to "Hạ Long",
        "Nakri" to "Nác ri", "Fengshen" to "Phong Thần", "Kalmaegi" to "Can me ghi", "Fung-wong" to "Phượng Hoàng",
        "Koto" to "Cô tô", "Nokaen" to "Nô ken", "Penha" to "Pen ha", "Nuri" to "Nu ri",
        "Sinlaku" to "Xin la cu", "Hagupit" to "Ha gu pít", "Jangmi" to "Chang mi", "Mekkhala" to "Mếch kha la",
        "Higos" to "Hi gốt", "Bavi" to "Ba Vì", "Maysak" to "Mây xắc", "Haishen" to "Hải Thần",
        "Noul" to "Nô un", "Dolphin" to "Đôn phin", "Kujira" to "Cu gi ra", "Chan-hom" to "Chan hôm",
        "Peilou" to "Pây lâu", "Nangka" to "Nang ca", "Saudel" to "Xau đen", "Narra" to "Na ra",
        "Gaenari" to "Ghe na ri", "Atsani" to "Át xa ni", "Etau" to "Ê tau", "Bang-Lang" to "Bằng Lăng",
        "Krovanh" to "Cơ rô vanh", "Dujuan" to "Đỗ Quyên", "Surigae" to "Xu ri ghe", "Choi-wan" to "Thái Vân",
        "Koguma" to "Cô gu ma", "Champi" to "Chăm pi", "In-fa" to "In pha", "Cempaka" to "Chem pa ca",
        "Nepartak" to "Nê pa tác", "Lupit" to "Lu pít", "Mirinae" to "Mi ri ne", "Nida" to "Ni đa",
        "Omais" to "Ô mai", "Luc-Binh" to "Lục Bình", "Chanthu" to "Chan thu", "Dianmu" to "Điện Mẫu",
        "Mindulle" to "Min đu le", "Lionrock" to "Lai ơn rốc", "Tokei" to "Tô kê", "Namtheun" to "Nam thơn",
        "Malou" to "Ma lâu", "Nyatoh" to "Nha tô", "Sarbul" to "Xa bun", "Amuyao" to "A mu dao",
        "Gosari" to "Gô xa ri", "Chaba" to "Cha ba", "Aere" to "Ê rê", "Songda" to "Sông Đà",
        "Trases" to "Tra xét", "Mulan" to "Mộc Lan", "Meari" to "Mê a ri", "Tsing-ma" to "Thanh Mã",
        "Tokage" to "Tô ca ghê", "Ong-mang" to "Ông mang", "Muifa" to "Mui pha", "Merbok" to "Mơ búc",
        "Nanmadol" to "Nan ma đôn", "Talas" to "Ta lát", "Hodu" to "Hô đu", "Kulap" to "Cu láp",
        "Roke" to "Rô kê", "Sonca" to "Sơn Ca", "Nesat" to "Nê xát", "Haitang" to "Hải Đường",
        "Jamjari" to "Cham cha ri", "Banyan" to "Ban dan", "Yamaneko" to "Da ma nê cô", "Pakhar" to "Pa kha",
        "Sanvu" to "San vu", "Mawar" to "Ma oa", "Guchol" to "Gu chôn", "Talim" to "Ta lim",
        "Bori" to "Bô ri", "Khanun" to "Kha nun", "Lan" to "Lan", "Saobien" to "Sao Biển",
        "Haikui" to "Hải Quỳ", "Ewiniar" to "Ê vi nia", "Yagi" to "Da ghi", "Jebi" to "Chê bi",
        "Krathon" to "Cơ ra thon", "Trami" to "Trà Mi", "Kong-rey" to "Công rây", "Toraji" to "Tô ra gi",
        "Man-yi" to "Man di", "Usagi" to "U xa ghi",
    )

    /** Khoá chuẩn hoá → bản đọc (150 tên). */
    val TEN_BAO_NOI: Map<String, String> = BANG.associate { (k, v) -> khoaTenBao(k) to v }
    const val SO_TEN_HIEN_HANH = 140

    /** = tenBaoNoi: "WUTIP" → "Vu típ"; không có ⇒ trả nguyên tên. */
    fun tenBaoNoi(name: String) = TEN_BAO_NOI[khoaTenBao(name)] ?: name
}
