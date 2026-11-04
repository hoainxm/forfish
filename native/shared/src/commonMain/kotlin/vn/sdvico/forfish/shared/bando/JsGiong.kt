package vn.sdvico.forfish.shared.bando

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlin.math.floor

/*
  NGỮ NGHĨA JS cho bộ giải file dữ liệu web (app-map 18 §5). Bộ giải web nhận `unknown` rồi dựa vào cách JS ép kiểu:
  `Number("58")` = 58, `arr["0"]` tra được, `typeof x === "number"` không ép, `Math.round` làm tròn lên ở .5,
  `Date.parse` nhận ngày 31 của tháng 2. Bản Kotlin phải ra Y HỆT trên cả hàng hỏng — vector `bien.json` chọc vào
  đúng những mép này — nên gom các phép đó vào đây thay vì rải `toDoubleOrNull()` (sai ở `true`, `null`, " 5 ").
*/
internal object Js {
    /** `typeof e === "number"` (JSON không có NaN/Infinity ⇒ luôn hữu hạn). */
    fun so(e: JsonElement?): Double? =
        if (e is JsonPrimitive && e !is JsonNull && !e.isString && e.booleanOrNull == null) e.doubleOrNull else null

    fun chuoi(e: JsonElement?): String? = if (e is JsonPrimitive && e.isString) e.content else null

    /** `Number(e)`; `undefined` (null Kotlin) ⇒ NaN, `null` JSON ⇒ 0. */
    fun Number(e: JsonElement?): Double = when {
        e == null -> Double.NaN
        e is JsonNull -> 0.0
        e is JsonPrimitive && e.isString -> soTuChuoi(e.content)
        e is JsonPrimitive -> e.booleanOrNull?.let { if (it) 1.0 else 0.0 } ?: e.doubleOrNull ?: Double.NaN
        e is JsonArray -> when (e.size) {
            0 -> 0.0
            1 -> if (e[0] is JsonArray || e[0] is JsonObject) Number(e[0]) else soTuChuoi(chuoiHoa(e[0]))
            else -> Double.NaN
        }
        else -> Double.NaN
    }

    /** StringToNumber của JS cho dạng thập phân (đủ cho dữ liệu; "0x…" / "Infinity" cũng theo luật JS). */
    private fun soTuChuoi(s0: String): Double {
        val s = trim(s0)
        if (s.isEmpty()) return 0.0
        when (s) {
            "Infinity", "+Infinity" -> return Double.POSITIVE_INFINITY
            "-Infinity" -> return Double.NEGATIVE_INFINITY
        }
        if (s.length > 2 && s[0] == '0' && s[1] in "xXoObB") {
            val coSo = when (s[1]) { 'x', 'X' -> 16; 'o', 'O' -> 8; else -> 2 }
            return s.substring(2).toLongOrNull(coSo)?.toDouble() ?: Double.NaN
        }
        if (!THAP_PHAN.matches(s)) return Double.NaN
        return s.toDoubleOrNull() ?: Double.NaN
    }

    private val THAP_PHAN = Regex("[+-]?([0-9]+\\.?[0-9]*|\\.[0-9]+)([eE][+-]?[0-9]+)?")

    /** Truthy của JS. */
    fun dung(e: JsonElement?): Boolean = when {
        e == null || e is JsonNull -> false
        e is JsonPrimitive && e.isString -> e.content.isNotEmpty()
        e is JsonPrimitive -> e.booleanOrNull ?: (e.doubleOrNull?.let { it != 0.0 && !it.isNaN() } ?: false)
        else -> true
    }

    /** `arr[k]` của JS: khoá số nguyên ≥ 0, hoặc chuỗi chỉ số chuẩn ("0", "12" — không "00", "1.0"). */
    fun tra(arr: JsonArray?, k: JsonElement?): JsonElement? {
        if (arr == null || k == null) return null
        val i: Int = so(k)?.let { d -> if (d >= 0 && d == floor(d) && d < arr.size) d.toInt() else null }
            ?: chuoi(k)?.let { s -> if (CHI_SO.matches(s)) s.toIntOrNull() else null }
            ?: return null
        return if (i < arr.size) arr[i] else null
    }

    private val CHI_SO = Regex("0|[1-9][0-9]{0,9}")

    /** `Math.round` — lên ở .5 (cả số âm: −1,5 ⇒ −1), giữ −0. */
    fun round(x: Double): Double {
        if (x.isNaN() || x.isInfinite()) return x
        val f = floor(x)
        val r = if (x - f >= 0.5) f + 1 else f
        return if (r == 0.0 && (x < 0 || (x == 0.0 && 1 / x < 0))) -0.0 else r
    }

    /** `Number.isInteger`. */
    fun laNguyen(x: Double) = !x.isNaN() && !x.isInfinite() && x == floor(x)

    /** `String(x)` cho số — y JS (12 ⇒ "12", −0 ⇒ "0", 1e-7 ⇒ "1e-7", 1e21 ⇒ "1e+21"). */
    fun inSo(x: Double): String {
        if (x.isNaN()) return "NaN"
        if (x.isInfinite()) return if (x > 0) "Infinity" else "-Infinity"
        if (x == 0.0) return "0"
        val am = x < 0
        // chữ số ngắn nhất từ toString của nền (JVM ≥ 19 + Kotlin/Native đều cho bản ngắn nhất), rồi viết lại kiểu JS
        val t = (if (am) -x else x).toString()
        val eIdx = t.indexOfFirst { it == 'E' || it == 'e' }
        val than = if (eIdx < 0) t else t.substring(0, eIdx)
        var mu = if (eIdx < 0) 0 else t.substring(eIdx + 1).toInt()
        val cham = than.indexOf('.')
        var so = if (cham < 0) than else than.substring(0, cham) + than.substring(cham + 1)
        mu += (if (cham < 0) than.length else cham)
        val dau = so.indexOfFirst { it != '0' }
        mu -= dau
        so = so.substring(dau).trimEnd('0')
        // giá trị = 0.so × 10^mu ; JS: n = mu, k = so.length
        val k = so.length
        val n = mu
        val ra = when {
            n in k..21 -> so + "0".repeat(n - k)
            n in 1..21 -> so.substring(0, n) + "." + so.substring(n)
            n in -5..0 -> "0." + "0".repeat(-n) + so
            else -> {
                val e = n - 1
                val dauE = if (e >= 0) "+" else "-"
                (if (k == 1) so else so[0] + "." + so.substring(1)) + "e" + dauE + (if (e < 0) -e else e)
            }
        }
        return if (am) "-$ra" else ra
    }

    /** `String(e)` cho phần tử JSON nguyên thuỷ. */
    fun chuoiHoa(e: JsonElement?): String = when {
        e == null -> "undefined"
        e is JsonNull -> "null"
        e is JsonPrimitive && e.isString -> e.content
        e is JsonPrimitive -> e.booleanOrNull?.toString() ?: inSo(e.doubleOrNull ?: Double.NaN)
        e is JsonArray -> e.joinToString(",") { if (it is JsonNull) "" else chuoiHoa(it) }
        else -> "[object Object]"
    }

    /** WhiteSpace + LineTerminator của JS — `\s`, `trim()`. */
    fun laTrang(c: Char): Boolean = c == '\t' || c == '\n' || c == '\u000B' || c == '\u000C' || c == '\r' || c == ' ' ||
        c == ' ' || c == ' ' || c in ' '..' ' || c == ' ' || c == ' ' ||
        c == ' ' || c == ' ' || c == '　' || c == '﻿'

    fun trim(s: String): String = s.trim { laTrang(it) }

    /** `s.split(/\s+/)`. */
    fun tachTrang(s: String): List<String> {
        val ra = mutableListOf<String>()
        val b = StringBuilder()
        var i = 0
        while (i < s.length) {
            if (laTrang(s[i])) {
                ra += b.toString(); b.clear()
                while (i < s.length && laTrang(s[i])) i++
            } else {
                b.append(s[i]); i++
            }
        }
        ra += b.toString()
        return ra
    }

    /** Ký tự chữ của `\b` / `\w` JS không cờ `u`: chỉ ASCII. */
    fun laChuW(c: Char) = c in 'a'..'z' || c in 'A'..'Z' || c in '0'..'9' || c == '_'

    /** Canonicalize của cờ `i` không `u`: viết hoa, trừ khi ký tự ngoài ASCII hoá thành ASCII. */
    fun hoa(c: Char): Char {
        val u = c.uppercase()
        if (u.length != 1) return c
        val h = u[0]
        return if (c.code >= 128 && h.code < 128) c else h
    }

    /** `Date.parse("<iso>T00:00:00Z")` của V8 — dạng ngày ES (YYYY, YYYY-MM, YYYY-MM-DD, năm ±YYYYYY); ngày 01–31
     *  nhận ở MỌI tháng rồi tràn sang tháng sau (V8: 2026-02-31 = 03-03). Ngoài dạng đó ⇒ null (NaN). */
    fun ngayMs(iso: String): Double? {
        val m = NGAY.matchEntire(iso) ?: return null
        val nam = m.groupValues[1].let { if (it.length == 7) { if (it == "-000000") return null; it.toLong() } else it.toLong() }
        val thang = m.groupValues[3].ifEmpty { "01" }.toInt()
        val ngay = m.groupValues[5].ifEmpty { "01" }.toInt()
        if (thang !in 1..12 || ngay !in 1..31) return null
        return (soNgay(nam, thang) + ngay - 1) * 86_400_000.0
    }

    private val NGAY = Regex("([+-][0-9]{6}|[0-9]{4})(-([0-9]{2})(-([0-9]{2}))?)?")

    /** Số ngày từ 1970-01-01 tới ngày 1 của (năm, tháng) — days_from_civil. */
    private fun soNgay(nam: Long, thang: Int): Long {
        val y = if (thang <= 2) nam - 1 else nam
        val era = (if (y >= 0) y else y - 399) / 400
        val yoe = y - era * 400
        val mp = (thang + 9) % 12
        val doy = (153 * mp + 2) / 5
        val doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146097 + doe - 719468
    }

    /** Chuỗi JSON kiểu `JSON.stringify`. */
    fun jsonChuoi(s: String, ra: StringBuilder) {
        ra.append('"')
        for (c in s) when {
            c == '"' -> ra.append("\\\"")
            c == '\\' -> ra.append("\\\\")
            c == '\n' -> ra.append("\\n")
            c == '\r' -> ra.append("\\r")
            c == '\t' -> ra.append("\\t")
            c == '\b' -> ra.append("\\b")
            c == '\u000C' -> ra.append("\\f")
            c.code < 0x20 -> ra.append("\\u").append(c.code.toString(16).padStart(4, '0'))
            else -> ra.append(c)
        }
        ra.append('"')
    }
}
