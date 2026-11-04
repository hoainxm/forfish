package vn.sdvico.forfish.app

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonPrimitive
import org.maplibre.android.maps.Style
import vn.sdvico.forfish.app.giaodien.BieuTuong
import vn.sdvico.forfish.app.giaodien.Chu
import vn.sdvico.forfish.app.giaodien.Mau
import vn.sdvico.forfish.shared.ais.AisTau
import vn.sdvico.forfish.shared.ais.LopAis
import vn.sdvico.forfish.shared.ais.TauAis
import vn.sdvico.forfish.shared.giaodien.CoSinh

/*
  AIS trên Android (đợt 2e, app-map 18 §3j):
   · ICON TÀU: web vẽ bằng Canvas 2D lúc chạy (icon-tau.ts `dangKyIconTau`); script sinh đã GHI LẠI chuỗi lệnh đó
     (LopAis.ICON) ⇒ ở đây CHẠY LẠI đúng chuỗi lệnh trên android.graphics.Canvas — không vẽ tay lại hình;
   · lớp `tau-ais-dot` nằm sẵn trong style (KieuBanDo, Bat.ais), nền đổ GeoJSON `AisTau.tauGeoJson`;
   · thẻ tàu = TheTauAis (the-thong-tin.tsx ~400): chấm màu · tên / "Tàu chưa rõ tên" · moTaTau (+ đến …) · định danh ·
     toạ độ · "Tin …" (+ "· bản lưu trong máy").
  Chưa có: chế độ AIS (Bán kính / Toàn biển, radar CPA), đường đi 7 ngày, tàu quanh — commit sau.
*/
object VeAis {
    private fun mau(s: String): Int = when {
        s == "transparent" -> 0
        s.startsWith("rgba") -> Regex("[\\d.]+").findAll(s).map { it.value.toDouble() }.toList().let { (r, g, b, a) ->
            android.graphics.Color.argb((a * 255).toInt(), r.toInt(), g.toInt(), b.toInt())
        }
        else -> android.graphics.Color.parseColor(s)
    }

    /** Chạy lại chuỗi lệnh Canvas 2D của web ra Bitmap (pixelRatio của web ⇒ ảnh @2x, addImage báo sdf=false). */
    fun anh(ic: LopAis.AnhIcon): Bitmap {
        val bmp = Bitmap.createBitmap(ic.rong, ic.cao, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val net = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
        val to = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
        var p = Path()
        var bong = 0; var mo = 0f; var dy = 0f; var dx = 0f
        fun apBong(pt: Paint) { if (bong != 0 && mo > 0f) pt.setShadowLayer(mo, dx, dy, bong) else pt.clearShadowLayer() }
        for (l in ic.lenh) {
            val ten = (l[0] as JsonPrimitive).content
            fun so(i: Int) = l[i].jsonPrimitive.double.toFloat()
            when (ten) {
                "scale" -> c.scale(so(1), so(2))
                "beginPath" -> p = Path()
                "moveTo" -> p.moveTo(so(1), so(2))
                "lineTo" -> p.lineTo(so(1), so(2))
                "closePath" -> p.close()
                "arc" -> {
                    val x = so(1); val y = so(2); val r = so(3)
                    val a0 = Math.toDegrees(so(4).toDouble()).toFloat(); val a1 = Math.toDegrees(so(5).toDouble()).toFloat()
                    p.addArc(RectF(x - r, y - r, x + r, y + r), a0, a1 - a0)
                }
                "stroke" -> { apBong(net); c.drawPath(p, net) }
                "fill" -> { apBong(to); c.drawPath(p, to) }
                "dat" -> {
                    val k = (l[1] as JsonPrimitive).content
                    val v = l[2] as JsonPrimitive
                    when (k) {
                        "lineWidth" -> net.strokeWidth = v.double.toFloat()
                        "strokeStyle" -> net.color = mau(v.content)
                        "fillStyle" -> to.color = mau(v.content)
                        "lineCap" -> net.strokeCap = when (v.content) { "round" -> Paint.Cap.ROUND; "square" -> Paint.Cap.SQUARE; else -> Paint.Cap.BUTT }
                        "lineJoin" -> net.strokeJoin = when (v.content) { "round" -> Paint.Join.ROUND; "bevel" -> Paint.Join.BEVEL; else -> Paint.Join.MITER }
                        "shadowColor" -> bong = mau(v.content)
                        "shadowBlur" -> mo = v.double.toFloat()
                        "shadowOffsetY" -> dy = v.double.toFloat()
                        "shadowOffsetX" -> dx = v.double.toFloat()
                    }
                }
            }
        }
        return bmp
    }

    /** = dangKyIconTau: đăng ký lại SAU MỖI lần đổi style (web cũng vậy). */
    fun dangKyIcon(st: Style) {
        LopAis.ICON.forEach { ic -> if (st.getImage(ic.ten) == null) st.addImage(ic.ten, anh(ic).also { it.density = (160 * ic.pixelRatio).toInt() }) }
    }
}

/** Thẻ một tàu AIS (= TheTauAis). */
@Composable
fun TheTauAis(t: TauAis, banLuc: String, tuKho: Boolean, kieuToaDo: String, modifier: Modifier = Modifier, dong: () -> Unit) {
    val phut = AisTau.tuoiTinPhut(t, banLuc, System.currentTimeMillis())
    Column(
        modifier.fillMaxWidth().padding(horizontal = 12.dp).shadow(8.dp, RoundedCornerShape(CoSinh.RCard.dp))
            .clip(RoundedCornerShape(CoSinh.RCard.dp)).background(Mau.the).padding(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(10.dp).clip(CircleShape).background(Color(android.graphics.Color.parseColor(AisTau.MAU_TAU[AisTau.nhomTau(t.loai)] ?: "#94a3b8"))))
            Text(t.ten?.takeIf { it.isNotBlank() } ?: "Tàu chưa rõ tên", style = Chu.nutPhu.copy(fontSize = 15.sp, color = Mau.navy), modifier = Modifier.padding(start = 6.dp).weight(1f))
            Box(
                Modifier.size(CoSinh.HCtl.dp).clip(CircleShape).clickable(onClick = dong).semantics { contentDescription = "Đóng" },
                contentAlignment = Alignment.Center,
            ) { BieuTuong("Close", Mau.navy, 18.dp) }
        }
        Text(AisTau.moTaTau(t) + (t.dich?.takeIf { it.isNotBlank() }?.let { " · đến $it" } ?: ""), style = Chu.phu)
        AisTau.dinhDanhTau(t).takeIf { it.isNotBlank() }?.let { Text(it, style = Chu.phu.copy(fontSize = 12.sp)) }
        Text(vn.sdvico.forfish.shared.bando.TuyChonBanDo.toaDo(t.lat, t.lon, kieuToaDo), style = Chu.phu.copy(fontSize = 12.sp))
        Text("Tin ${AisTau.tuoiTinLabel(phut)}" + if (tuKho) " · bản lưu trong máy" else "", style = Chu.phu.copy(fontSize = 12.sp, color = if (tuKho) Mau.warn else Mau.mo))
    }
}
