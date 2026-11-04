package vn.sdvico.forfish.app

import android.graphics.Bitmap
import android.graphics.Paint
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.geometry.LatLngBounds
import org.maplibre.android.geometry.LatLngQuad
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.Style
import org.maplibre.android.style.expressions.Expression
import org.maplibre.android.style.layers.LineLayer
import org.maplibre.android.style.layers.Property
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.layers.RasterLayer
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.android.style.sources.ImageSource
import vn.sdvico.forfish.app.giaodien.BieuTuong
import vn.sdvico.forfish.app.giaodien.Chu
import vn.sdvico.forfish.app.giaodien.Mau
import vn.sdvico.forfish.shared.giaodien.CoSinh
import vn.sdvico.forfish.shared.thoitiet.AnhTruong
import vn.sdvico.forfish.shared.thoitiet.ForecastKind
import vn.sdvico.forfish.shared.thoitiet.HatGio
import vn.sdvico.forfish.shared.thoitiet.LoaiHat
import vn.sdvico.forfish.shared.thoitiet.LoaiTruong
import vn.sdvico.forfish.shared.thoitiet.LuoiDuBao
import vn.sdvico.forfish.shared.thoitiet.TruongMau
import vn.sdvico.forfish.shared.thoitiet.TruongUV
import kotlin.math.PI
import kotlin.math.ln
import kotlin.math.max
import kotlin.math.min
import kotlin.math.tan
import kotlin.random.Random

/*
  THỜI TIẾT ĐỘNG trên Android (đợt 2d, app-map 18 §3i) — hình vẽ cho dữ liệu của shared/thoitiet:
   · TRƯỜNG MÀU = lớp GL `scalar-gl-field` của web ⇒ ImageSource + RasterLayer (ảnh do TruongMau.anhTruong tính y fragment
     shader), chèn NGAY DƯỚI `overlay-coast-fill` (beforeId của web) ⇒ bờ + đất nổi trên màu;
   · MŨI TÊN = `forecast-arrows-line` (màu theo độ lớn, rộng 2.5);
   · HẠT = WindParticles: Canvas phủ bản đồ, vệt mờ dần (destination-in α 0.93), dời bản đồ thì xoá vệt.
  Một lớp động một lúc (= onForecast/onOverlayField xoá nhau). Khung kéo PAN_BOUNDS + minZoom 4 khi bật (web).
*/

/** Lớp động đang bật: gió/sóng/dòng (lưới) hoặc lớp màu (mây, mưa, nhiệt độ, dông, áp suất). */
sealed class LopDongChon {
    data class LuoiChon(val kind: ForecastKind) : LopDongChon()
    data class MauChon(val kind: LoaiTruong) : LopDongChon()
}

/** Dòng của panel Thời tiết — nhãn + dòng phụ khi bật CHÉP Y ThoiTietPanel (ra-khoi-controls ~1514). */
data class DongThoiTiet(val chon: LopDongChon, val nhan: String, val phu: String, val icon: String)

val DONG_THOI_TIET: List<DongThoiTiet> = listOf(
    DongThoiTiet(LopDongChon.LuoiChon(ForecastKind.WIND), "Gió", "Theo giờ", "Wind"),
    DongThoiTiet(LopDongChon.LuoiChon(ForecastKind.WAVE), "Sóng", "Theo giờ", "Waves"),
    DongThoiTiet(LopDongChon.LuoiChon(ForecastKind.CURRENT), "Dòng chảy", "Tới ~10 ngày", "Route"),
) + LoaiTruong.OM.map { k ->
    val m = TruongMau.SCALAR_META.getValue(k)
    DongThoiTiet(LopDongChon.MauChon(k), m.label, m.tomTat, when (k) {
        LoaiTruong.CLOUD -> "CloudSun"; LoaiTruong.RAIN -> "Drop"; LoaiTruong.AIRTEMP -> "Thermo"; LoaiTruong.STORM -> "Alert"; else -> "Target"
    })
}

object VeThoiTiet {
    const val NGUON_TRUONG = "truong-mau"
    const val LOP_TRUONG = "truong-mau"
    const val NGUON_MUI = "forecast-arrows"
    const val LOP_MUI = "forecast-arrows-line"
    /** = PAN_BOUNDS / LOCKED_BOUNDS (fishing-map-view ~685) */
    val KHUNG_KEO: LatLngBounds = LatLngBounds.from(28.0, 128.0, -9.0, 93.0)
    val KHUNG_MO: LatLngBounds = LatLngBounds.from(24.6, 123.7, 0.4, 97.3)

    private fun chenDuoi(st: Style, lop: org.maplibre.android.style.layers.Layer) {
        when {
            st.getLayer("overlay-coast-fill") != null -> st.addLayerBelow(lop, "overlay-coast-fill")
            st.getLayer("chu-quyen") != null -> st.addLayerBelow(lop, "chu-quyen")
            else -> st.addLayer(lop)
        }
    }

    /** Đặt/thay ảnh trường màu; null ⇒ gỡ. */
    fun truong(st: Style, a: AnhTruong?) {
        if (a == null) { st.removeLayer(LOP_TRUONG); st.removeSource(NGUON_TRUONG); return }
        val bmp = Bitmap.createBitmap(a.argb, a.rong, a.cao, Bitmap.Config.ARGB_8888)
        val quad = LatLngQuad(LatLng(a.bac, a.tay), LatLng(a.bac, a.dong), LatLng(a.nam, a.dong), LatLng(a.nam, a.tay))
        val cu = st.getSourceAs<ImageSource>(NGUON_TRUONG)
        if (cu != null) { cu.setCoordinates(quad); cu.setImage(bmp); return }
        st.addSource(ImageSource(NGUON_TRUONG, quad, bmp))
        chenDuoi(st, RasterLayer(LOP_TRUONG, NGUON_TRUONG).withProperties(
            PropertyFactory.rasterResampling(Property.RASTER_RESAMPLING_LINEAR),
            PropertyFactory.rasterFadeDuration(0f),
        ))
    }

    /** Mũi tên (null ⇒ gỡ). `mauJson` = WIND/WAVE/CURRENT_COLOR_EXPR, null ⇒ trắng dịu (streak trên lớp màu). */
    fun muiTen(st: Style, geo: String?, mauJson: String?) {
        if (geo == null) { st.removeLayer(LOP_MUI); st.removeSource(NGUON_MUI); return }
        val cu = st.getSourceAs<GeoJsonSource>(NGUON_MUI)
        if (cu != null) cu.setGeoJson(geo) else st.addSource(GeoJsonSource(NGUON_MUI, geo))
        st.getLayer(LOP_MUI)?.let { st.removeLayer(it) }
        chenDuoi(st, LineLayer(LOP_MUI, NGUON_MUI).withProperties(
            PropertyFactory.lineCap(Property.LINE_CAP_ROUND), PropertyFactory.lineJoin(Property.LINE_JOIN_ROUND),
            if (mauJson != null) PropertyFactory.lineColor(Expression.Converter.convert(mauJson)) else PropertyFactory.lineColor("rgba(255,255,255,0.6)"),
            PropertyFactory.lineWidth(if (mauJson != null) 2.5f else 1.6f),
        ))
    }

    fun mauMuiTen(k: ForecastKind) = when (k) {
        ForecastKind.WIND -> LuoiDuBao.WIND_COLOR_EXPR
        ForecastKind.WAVE -> LuoiDuBao.WAVE_COLOR_EXPR
        ForecastKind.CURRENT -> LuoiDuBao.CURRENT_COLOR_EXPR
    }
}

/** Kiểu vệt của WindParticles: "wind" trắng .75 rộng 1.4 · "wave" (sóng + dòng) trắng .6 rộng 2.4 · "ambient" xanh mực .45. */
enum class KieuHat(val mau: Int, val rongDp: Float) {
    WIND(0xBFFFFFFF.toInt(), 1.4f), WAVE(0x99FFFFFF.toInt(), 2.4f), AMBIENT(0x731E3C5F, 1.4f);
    companion object { fun cua(k: LoaiHat) = if (k == LoaiHat.WIND) WIND else WAVE }
}

/**
 * Lớp hạt = WindParticles: N = clamp(diện tích dp / 900, 600, 2000), sinh trong (khung nhìn ∩ lưới), tuổi 40–160 khung;
 * bước stepParticle(dt 1/60); nhảy > 40 px hoặc ra khỏi trường ⇒ sinh lại. Đổi camera ⇒ xoá vệt.
 * Toạ độ màn: Web Mercator tuyến tính trong một khung hình (lấy 2 điểm chiếu của MapLibre mỗi khung — tránh JNI mỗi hạt).
 */
@Composable
fun LopHat(map: MapLibreMap, truong: TruongUV, kieu: KieuHat, moc: Int) {
    val d = androidx.compose.ui.platform.LocalDensity.current.density
    var khung by remember { mutableIntStateOf(0) }
    val ve = remember(truong, kieu, moc) { VeHat(truong, kieu, d) }
    LaunchedEffect(ve) {
        while (true) { withFrameNanos { ve.buoc(map); khung++ } }
    }
    Canvas(Modifier.fillMaxSize()) {
        khung // đọc để vẽ lại mỗi khung
        ve.anh?.let { drawImage(it.asImageBitmap()) }
    }
}

private class VeHat(val f: TruongUV, val kieu: KieuHat, val d: Float) {
    var anh: Bitmap? = null
    private var cv: android.graphics.Canvas? = null
    private val but = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = kieu.mau; strokeWidth = kieu.rongDp * d; strokeCap = Paint.Cap.ROUND }
    private val mo = Paint().apply { color = 0xED000000.toInt(); xfermode = PorterDuffXfermode(PorterDuff.Mode.DST_IN) } // α 0.93
    private var lat = DoubleArray(0); private var lon = DoubleArray(0); private var tuoi = IntArray(0)
    private var camCu: String? = null
    private val rd = Random(7)

    private fun mercY(la: Double) = ln(tan(PI / 4 + la * PI / 360))

    fun buoc(map: MapLibreMap) {
        val w = map.width.toInt(); val h = map.height.toInt()
        if (w <= 0 || h <= 0) return
        if (anh?.width != w || anh?.height != h) { anh = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888); cv = android.graphics.Canvas(anh!!) }
        val c = cv ?: return
        // chiếu tuyến tính: 2 điểm mốc ⇒ x = ax·lon + bx, y = ay·mercY + by
        val p0 = map.projection.toScreenLocation(LatLng(10.0, 100.0))
        val p1 = map.projection.toScreenLocation(LatLng(20.0, 120.0))
        val ax = (p1.x - p0.x) / 20.0; val bx = p0.x - ax * 100.0
        val ay = (p1.y - p0.y) / (mercY(20.0) - mercY(10.0)); val by = p0.y - ay * mercY(10.0)
        val cam = "${p0.x},${p0.y},${p1.x},${p1.y}"
        if (cam != camCu) { c.drawColor(0, PorterDuff.Mode.CLEAR); camCu = cam }
        // khung nhìn ∩ lưới (độ)
        val lonA = max(f.lon0, -bx / ax); val lonB = min(f.lon0 + f.dLon * (f.nLon - 1), (w - bx) / ax)
        fun latTuY(y: Double) = Math.toDegrees(2 * kotlin.math.atan(kotlin.math.exp((y - by) / ay)) - PI / 2)
        val latA = max(f.lat0, latTuY(h.toDouble())); val latB = min(f.lat0 + f.dLat * (f.nLat - 1), latTuY(0.0))
        if (lonA >= lonB || latA >= latB) return
        val n = (w / d * h / d / 900f).toInt().coerceIn(600, 2000)
        if (lat.size != n) { lat = DoubleArray(n); lon = DoubleArray(n); tuoi = IntArray(n) }
        fun sinh(i: Int) {
            lat[i] = latA + rd.nextDouble() * (latB - latA); lon[i] = lonA + rd.nextDouble() * (lonB - lonA); tuoi[i] = 40 + rd.nextInt(121)
        }
        c.drawPaint(mo)
        for (i in 0 until n) {
            if (tuoi[i] <= 0) { sinh(i); continue }
            val moi = HatGio.stepParticle(f, lat[i], lon[i], 1.0 / 60)
            if (moi == null) { sinh(i); continue }
            val x0 = ax * lon[i] + bx; val y0 = ay * mercY(lat[i]) + by
            val x1 = ax * moi.second + bx; val y1 = ay * mercY(moi.first) + by
            if (kotlin.math.abs(x1 - x0) > 40 * d || kotlin.math.abs(y1 - y0) > 40 * d) { sinh(i); continue }
            c.drawLine(x0.toFloat(), y0.toFloat(), x1.toFloat(), y1.toFloat(), but)
            lat[i] = moi.first; lon[i] = moi.second; tuoi[i]--
        }
    }
}

/** "YYYY-MM-DD" giờ VN — nhãn "Hôm nay / Mai" của web so với ngày máy (bà con ở VN). */
fun homNayVN(): String = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh")).toString()

/** Ô màu chú giải (web: legendGradientCss / scalarGradientCss) từ các chặng. */
fun dai(mau: List<Pair<Double, Int>>): Brush =
    if (mau.size < 2) Brush.horizontalGradient(listOf(Color(mau.firstOrNull()?.second ?: 0), Color(mau.firstOrNull()?.second ?: 0)))
    else Brush.horizontalGradient(mau.map { Color(it.second) })

/**
 * THANH GIỜ = khối thanh giờ web (fishing-map-view ~10063): "{tiêu đề} · {giờ}" (+ "· số cũ, đang tải bản mới…"), chú giải
 * dải màu, nút Chạy/Dừng (800 ms/bước, quay vòng), thanh kéo theo mốc + nhãn ngày (Hôm nay / Mai / Th N d/m).
 */
@Composable
fun ThanhGio(
    tieuDe: String,
    times: List<String>,
    gio: Int,
    chonGio: (Int) -> Unit,
    chay: Boolean,
    doiChay: (Boolean) -> Unit,
    cu: Boolean,
    dangTai: Boolean,
    chuGiai: Pair<Brush, Pair<String, String>>?,
    loi: String?,
    thuLai: () -> Unit,
) {
    LaunchedEffect(chay, times.size) {
        while (chay && times.isNotEmpty()) { kotlinx.coroutines.delay(800); chonGio((gio + 1) % times.size) }
    }
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 12.dp)
            .shadow(8.dp, RoundedCornerShape(CoSinh.RCard.dp)).clip(RoundedCornerShape(CoSinh.RCard.dp)).background(Mau.the)
            .padding(12.dp),
    ) {
        if (loi != null) {
            Text("Chưa lấy được dự báo cả vùng biển. $loi", style = Chu.phu.copy(color = Mau.nguy))
            Text("Thử lại", style = Chu.nutPhu.copy(color = Mau.t1), modifier = Modifier.padding(top = 6.dp).clickable(onClick = thuLai))
            return@Column
        }
        if (times.isEmpty()) {
            Text(if (dangTai) "Đang tải dự báo cho cả vùng biển…" else "Chưa có dự báo", style = Chu.phu)
            return@Column
        }
        val g = gio.coerceIn(0, times.size - 1)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(CoSinh.HCtl.dp).clip(CircleShape).background(Mau.o).clickable { doiChay(!chay) }
                    .semantics { contentDescription = if (chay) "Dừng" else "Chạy" },
                contentAlignment = Alignment.Center,
            ) { BieuTuong(if (chay) "Pause" else "Play", Mau.navy, 18.dp) }
            Text(
                "$tieuDe · ${LuoiDuBao.timeLabelVN(times[g], homNayVN())}" + if (cu && dangTai) " · số cũ, đang tải bản mới…" else "",
                style = Chu.nutPhu.copy(color = Mau.navy), modifier = Modifier.padding(start = 10.dp).weight(1f),
            )
        }
        chuGiai?.let { (brush, dau) ->
            Box(Modifier.padding(top = 8.dp).fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(brush))
            Row(Modifier.fillMaxWidth()) {
                Text(dau.first, style = Chu.phu.copy(fontSize = 11.sp), modifier = Modifier.weight(1f))
                Text(dau.second, style = Chu.phu.copy(fontSize = 11.sp))
            }
        }
        Slider(
            value = g.toFloat(), onValueChange = { doiChay(false); chonGio(it.toInt()) },
            valueRange = 0f..max(1, times.size - 1).toFloat(), steps = max(0, times.size - 2),
            colors = SliderDefaults.colors(thumbColor = Mau.t1, activeTrackColor = Mau.t1, inactiveTrackColor = Mau.vien, activeTickColor = Color.Transparent, inactiveTickColor = Color.Transparent),
        )
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            LuoiDuBao.groupTimesByDay(times).take(5).forEach { ngay ->
                Text(LuoiDuBao.scrubDayLabel(ngay.iso, homNayVN()), style = Chu.phu.copy(fontSize = 11.sp))
            }
        }
    }
}

/** Panel "Thời tiết" (ra-khoi-controls ThoiTietPanel): công tắc từng lớp, bật một lớp thì tắt lớp kia. */
@Composable
fun PanelThoiTiet(dang: LopDongChon?, chon: (LopDongChon?) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        DONG_THOI_TIET.forEach { r ->
            val bat = r.chon == dang
            CongTac(r.nhan, if (bat) r.phu else null, bat, r.icon, Mau.t1) { chon(if (bat) null else r.chon) }
        }
        Text(
            "Độ mặn, nước xoáy, dòng chảy tầng sâu: bản app làm ở đợt sau.",
            style = Chu.phu.copy(fontSize = 12.sp, color = Mau.chu.copy(alpha = 0.7f)),
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(CoSinh.RCtl.dp)).background(Mau.o.copy(alpha = 0.7f)).padding(10.dp).heightIn(min = 0.dp),
        )
    }
}
