package vn.sdvico.forfish.app.giaodien

import androidx.compose.foundation.text.selection.LocalTextSelectionColors
import androidx.compose.foundation.text.selection.TextSelectionColors
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import vn.sdvico.forfish.app.R
import vn.sdvico.forfish.shared.giaodien.MauSinh

/*
  HỆ GIAO DIỆN ANDROID = HỆ CỦA WEB (03-design-system §0/§0b). Màu + cỡ + icon SINH từ globals.css/icons.tsx
  (native/scripts/sinh-giao-dien.mjs) — không gõ hex ở đây. Font: Archivo (tiêu đề, 600/700) + Plus Jakarta Sans
  (chữ, 400–700) như layout.tsx. Cỡ chữ theo thang Codex, gốc 16px (1rem = 16sp).
*/
object Mau {
    val nen = Color(MauSinh.Background)
    val chu = Color(MauSinh.Foreground)
    val mo = Color(MauSinh.Muted)
    val the = Color(MauSinh.Card)
    val vien = Color(MauSinh.Line)
    val o = Color(MauSinh.Field)
    val navy = Color(MauSinh.Navy)
    val sea = Color(MauSinh.Sea)
    val trim = Color(MauSinh.Trim)
    val ok = Color(MauSinh.Ok)
    val okNen = Color(MauSinh.OkBg)
    val warn = Color(MauSinh.Warn)
    val warnNen = Color(MauSinh.WarnBg)
    val nguy = Color(MauSinh.Danger)
    val nguyNen = Color(MauSinh.DangerBg)
    val t1 = Color(MauSinh.T1)
    val t1Nen = Color(MauSinh.T1Bg)
    val muc = Color(MauSinh.InkRgb) // kênh bóng đổ (--ink-rgb)
}

val FontTieuDe = FontFamily(Font(R.font.archivo_600, FontWeight.SemiBold), Font(R.font.archivo_700, FontWeight.Bold))
val FontChu = FontFamily(
    Font(R.font.jakarta_400, FontWeight.Normal),
    Font(R.font.jakarta_500, FontWeight.Medium),
    Font(R.font.jakarta_600, FontWeight.SemiBold),
    Font(R.font.jakarta_700, FontWeight.Bold),
)

/** Thang chữ (03 §0). */
object Chu {
    /** Tiêu đề màn h1 — 1.5rem đậm, display, navy */
    val h1 = TextStyle(fontFamily = FontTieuDe, fontWeight = FontWeight.Bold, fontSize = 24.sp, lineHeight = 30.sp, color = Mau.navy)
    /** Tiêu đề nhóm h2 — 1.125rem 600 */
    val h2 = TextStyle(fontFamily = FontTieuDe, fontWeight = FontWeight.SemiBold, fontSize = 18.sp, lineHeight = 24.sp, color = Mau.navy)
    /** Tên đối tượng / tiêu đề hàng — 1rem 600 */
    val ten = TextStyle(fontFamily = FontChu, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 22.sp, color = Mau.navy)
    /** Nội dung — 1rem thường */
    val noiDung = TextStyle(fontFamily = FontChu, fontWeight = FontWeight.Normal, fontSize = 16.sp, lineHeight = 22.sp, color = Mau.chu)
    /** Chữ phụ — 0.8125rem, màu mờ */
    val phu = TextStyle(fontFamily = FontChu, fontWeight = FontWeight.Normal, fontSize = 13.sp, lineHeight = 18.sp, color = Mau.mo)
    /** Chữ nút — 1rem 600 (nút chính) / 0.875rem 600 (nút phụ) */
    val nut = TextStyle(fontFamily = FontChu, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
    val nutPhu = TextStyle(fontFamily = FontChu, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
}

@Composable
fun ChuDeForFish(noiDung: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Mau.sea, onPrimary = Mau.the, background = Mau.nen, onBackground = Mau.chu,
            surface = Mau.the, onSurface = Mau.chu, error = Mau.nguy, outline = Mau.vien,
        ),
    ) {
        CompositionLocalProvider(
            LocalTextSelectionColors provides TextSelectionColors(Mau.sea, Mau.sea.copy(alpha = 0.3f)),
            content = noiDung,
        )
    }
}
