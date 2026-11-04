package vn.sdvico.forfish.shared.giaodien

import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.sin
import kotlin.math.sqrt
import kotlin.math.tan

/*
  ĐỌC PATH SVG ⇒ lệnh vẽ tuyệt đối tối giản (MoveTo / LineTo / CubicTo / Close) — cho iOS vẽ icon web bằng SwiftUI Path
  (iOS không có bộ đọc path SVG sẵn; Android dùng PathParser của Compose). Hỗ trợ đủ M L H V C S Q T A Z, hoa + thường.
  Cung (A) đổi sang Bézier bậc 3 theo SVG 1.1 phụ lục F.6.
*/
sealed class LenhVe {
    data class Den(val x: Float, val y: Float) : LenhVe()
    data class Ke(val x: Float, val y: Float) : LenhVe()
    data class Cong(val x1: Float, val y1: Float, val x2: Float, val y2: Float, val x: Float, val y: Float) : LenhVe()
    data object Dong : LenhVe()
}

object DuongVe {
    fun phanTich(d: String): List<LenhVe> {
        val tok = Regex("[MmLlHhVvCcSsQqTtAaZz]|-?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][-+]?\\d+)?").findAll(d).map { it.value }.toList()
        val ra = mutableListOf<LenhVe>()
        var i = 0
        var cx = 0f; var cy = 0f // điểm hiện tại
        var sx = 0f; var sy = 0f // điểm đầu nét con
        var lx = 0f; var ly = 0f // điểm điều khiển trước (cho S/T)
        var truoc = ' '
        var lenh = ' '
        fun so(): Float = tok[i++].toFloat()
        fun coSo() = i < tok.size && !tok[i][0].isLetter()
        while (i < tok.size) {
            if (tok[i][0].isLetter()) lenh = tok[i++][0]
            val tuongDoi = lenh.isLowerCase()
            val ox = if (tuongDoi) cx else 0f
            val oy = if (tuongDoi) cy else 0f
            when (lenh.uppercaseChar()) {
                'M' -> {
                    cx = ox + so(); cy = oy + so(); sx = cx; sy = cy
                    ra += LenhVe.Den(cx, cy)
                    lenh = if (tuongDoi) 'l' else 'L' // cặp số tiếp theo của M là L
                }
                'L' -> { cx = ox + so(); cy = oy + so(); ra += LenhVe.Ke(cx, cy) }
                'H' -> { cx = ox + so(); ra += LenhVe.Ke(cx, cy) }
                'V' -> { cy = oy + so(); ra += LenhVe.Ke(cx, cy) }
                'C' -> {
                    val x1 = ox + so(); val y1 = oy + so(); val x2 = ox + so(); val y2 = oy + so()
                    cx = ox + so(); cy = oy + so(); lx = x2; ly = y2
                    ra += LenhVe.Cong(x1, y1, x2, y2, cx, cy)
                }
                'S' -> {
                    val x1 = if (truoc.uppercaseChar() in "CS") 2 * cx - lx else cx
                    val y1 = if (truoc.uppercaseChar() in "CS") 2 * cy - ly else cy
                    val x2 = ox + so(); val y2 = oy + so()
                    cx = ox + so(); cy = oy + so(); lx = x2; ly = y2
                    ra += LenhVe.Cong(x1, y1, x2, y2, cx, cy)
                }
                'Q' -> {
                    val qx = ox + so(); val qy = oy + so()
                    val x = ox + so(); val y = oy + so()
                    ra += bacHaiSangBa(cx, cy, qx, qy, x, y)
                    cx = x; cy = y; lx = qx; ly = qy
                }
                'T' -> {
                    val qx = if (truoc.uppercaseChar() in "QT") 2 * cx - lx else cx
                    val qy = if (truoc.uppercaseChar() in "QT") 2 * cy - ly else cy
                    val x = ox + so(); val y = oy + so()
                    ra += bacHaiSangBa(cx, cy, qx, qy, x, y)
                    cx = x; cy = y; lx = qx; ly = qy
                }
                'A' -> {
                    val rx = so(); val ry = so(); val xoay = so(); val lon = so() != 0f; val chieu = so() != 0f
                    val x = ox + so(); val y = oy + so()
                    ra += cung(cx, cy, rx, ry, xoay, lon, chieu, x, y)
                    cx = x; cy = y
                }
                'Z' -> { ra += LenhVe.Dong; cx = sx; cy = sy; while (coSo()) i++ } // số thừa sau Z: bỏ, không lặp vô tận
                else -> i++
            }
            truoc = lenh
        }
        return ra
    }

    private fun bacHaiSangBa(x0: Float, y0: Float, qx: Float, qy: Float, x: Float, y: Float) =
        LenhVe.Cong(x0 + 2f / 3 * (qx - x0), y0 + 2f / 3 * (qy - y0), x + 2f / 3 * (qx - x), y + 2f / 3 * (qy - y), x, y)

    /** Cung elip ⇒ các đoạn Bézier ≤ 90° (SVG 1.1 F.6.5–F.6.6). */
    private fun cung(x1: Float, y1: Float, rx0: Float, ry0: Float, xoayDo: Float, lon: Boolean, chieu: Boolean, x2: Float, y2: Float): List<LenhVe> {
        if (x1 == x2 && y1 == y2) return emptyList()
        var rx = abs(rx0.toDouble()); var ry = abs(ry0.toDouble())
        if (rx == 0.0 || ry == 0.0) return listOf(LenhVe.Ke(x2, y2))
        val phi = xoayDo * PI / 180
        val cp = cos(phi); val sp = sin(phi)
        val dx = (x1 - x2) / 2.0; val dy = (y1 - y2) / 2.0
        val x1p = cp * dx + sp * dy; val y1p = -sp * dx + cp * dy
        val l = x1p * x1p / (rx * rx) + y1p * y1p / (ry * ry)
        if (l > 1) { rx *= sqrt(l); ry *= sqrt(l) }
        val tu = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p
        val mau = rx * rx * y1p * y1p + ry * ry * x1p * x1p
        var k = sqrt(maxOf(0.0, tu / mau))
        if (lon == chieu) k = -k
        val cxp = k * rx * y1p / ry; val cyp = -k * ry * x1p / rx
        val tamX = cp * cxp - sp * cyp + (x1 + x2) / 2.0
        val tamY = sp * cxp + cp * cyp + (y1 + y2) / 2.0
        fun goc(ux: Double, uy: Double, vx: Double, vy: Double): Double = atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        val th1 = goc(1.0, 0.0, (x1p - cxp) / rx, (y1p - cyp) / ry)
        var dth = goc((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
        if (!chieu && dth > 0) dth -= 2 * PI else if (chieu && dth < 0) dth += 2 * PI
        val n = ceil(abs(dth) / (PI / 2)).toInt().coerceAtLeast(1)
        val buoc = dth / n
        val t = 4.0 / 3 * tan(buoc / 4)
        val ra = mutableListOf<LenhVe>()
        var a = th1
        repeat(n) {
            val b = a + buoc
            val ca = cos(a); val sa = sin(a); val cb = cos(b); val sb = sin(b)
            fun diem(ex: Double, ey: Double) = Pair(cp * rx * ex - sp * ry * ey + tamX, sp * rx * ex + cp * ry * ey + tamY)
            val p1 = diem(ca - t * sa, sa + t * ca)
            val p2 = diem(cb + t * sb, sb - t * cb)
            val p3 = diem(cb, sb)
            ra += LenhVe.Cong(p1.first.toFloat(), p1.second.toFloat(), p2.first.toFloat(), p2.second.toFloat(), p3.first.toFloat(), p3.second.toFloat())
            a = b
        }
        return ra
    }
}
