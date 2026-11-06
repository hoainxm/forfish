package vn.sdvico.forfish.app.giaodien

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import vn.sdvico.forfish.shared.giaodien.BieuTuongSinh

/** Icon nét của web (icons.tsx) — tên bỏ đuôi "Icon", vd "Home", "Pin", "ChevronRight". */
@Composable
fun BieuTuong(ten: String, mau: Color, co: Dp = 20.dp, modifier: Modifier = Modifier) {
    val v = remember(ten, mau) { dungIcon(ten, mau) }
    Image(rememberVectorPainter(v), contentDescription = null, modifier = modifier.size(co))
}

private fun dungIcon(ten: String, mau: Color): ImageVector {
    val ds = BieuTuongSinh.ICON[ten] ?: error("Không có icon \"$ten\" trong icons.tsx")
    val b = ImageVector.Builder(ten, 24.dp, 24.dp, BieuTuongSinh.VIEWBOX, BieuTuongSinh.VIEWBOX)
    for (d in ds) {
        val dac = d.startsWith("F:")
        val nodes = PathParser().parsePathString(d.removePrefix("F:")).toNodes()
        if (dac) b.addPath(nodes, fill = SolidColor(mau))
        else b.addPath(
            nodes, stroke = SolidColor(mau), strokeLineWidth = BieuTuongSinh.NET,
            strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round,
        )
    }
    return b.build()
}
