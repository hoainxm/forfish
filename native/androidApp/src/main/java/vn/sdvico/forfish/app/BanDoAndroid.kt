package vn.sdvico.forfish.app

import android.Manifest
import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.BitmapFactory
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Looper
import android.util.DisplayMetrics
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.camera.CameraUpdateFactory
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapLibreMap
import org.maplibre.android.maps.MapView
import org.maplibre.android.module.http.HttpRequestUtil
import okhttp3.OkHttpClient
import vn.sdvico.forfish.shared.api.MayChu
import org.maplibre.android.maps.Style
import org.maplibre.android.style.layers.CircleLayer
import org.maplibre.android.style.layers.Property
import org.maplibre.android.style.layers.PropertyFactory
import org.maplibre.android.style.layers.SymbolLayer
import org.maplibre.android.style.sources.GeoJsonSource
import org.maplibre.geojson.FeatureCollection
import org.maplibre.geojson.Point
import vn.sdvico.forfish.app.giaodien.Mau
import vn.sdvico.forfish.app.giaodien.NutTron
import vn.sdvico.forfish.app.giaodien.TheTrangThai
import vn.sdvico.forfish.shared.UngDung
import vn.sdvico.forfish.shared.bando.KieuBanDo
import vn.sdvico.forfish.shared.bando.NapBanDo
import vn.sdvico.forfish.shared.bando.TuyChonBanDo
import vn.sdvico.forfish.shared.bando.ViTriTau
import vn.sdvico.forfish.shared.dulieu.KhoTepFile
import vn.sdvico.forfish.shared.giaodien.CoSinh
import java.io.File

/*
  Ô BẢN ĐỒ ANDROID (đợt 2a, app-map 18 §3e): nền + đảo + nhãn chủ quyền + số đo sâu / đường độ sâu / đèn biển / xác tàu
  (NapBanDo — vẽ NGAY bản đã cất, rồi hỏi lại máy chủ) + ghim tàu GPS (= NavBoatMarker: ảnh ghim, mũi ghim là toạ độ,
  quầng t1 nhấp nháy, GPS cũ ⇒ mờ 0.45 + tắt nháy) + NutViTri (= goToMyBoat ngoài chế độ chạy tàu: bay tới tàu ở mức 7,
  tàu nằm trên tâm 18% chiều cao, 650 ms; chưa có quyền ⇒ xin). Bám theo tàu chỉ có trong chế độ Đang chạy (đợt 2f).
*/
/** `cameraDebug` (CHỈ bản debug, `--es camera lat,lon,zoom`): đặt khung như link `/ngu-truong?lat=&lon=` của web
 *  (flyToPoint: điểm nằm trên tâm 18% chiều cao) để chụp đối chiếu cùng chỗ. */
class BanDoAndroid(private val ung: UngDung, private val mapView: MapView, filesDir: File, private val cameraDebug: String? = null) {
    init {
        // Ô ảnh nền (gói) đi qua /api/tiles của máy chủ — middleware đòi chuỗi + gói. MapLibre tự tải ô nên gắn chuỗi ở
        // tầng HTTP của nó, CHỈ cho đúng máy chủ mình (không lộ chuỗi sang nguồn khác).
        val goc = ung.mayChuGoc().trimEnd('/')
        HttpRequestUtil.setOkHttpClient(
            OkHttpClient.Builder().addInterceptor { ch ->
                val r = ch.request()
                val tok = ung.phien.token()
                ch.proceed(if (tok != null && r.url.toString().startsWith("$goc/api/tiles/")) r.newBuilder().header(MayChu.HEADER_CHUOI, tok).build() else r)
            }.build(),
        )
    }

    private val nap: NapBanDo = ung.napBanDo(KhoTepFile(File(filesDir, "du-lieu")))
    private var map: MapLibreMap? = null
    private var tepDangVe: KieuBanDo.Tep? = null
    /** công tắc đang áp — style dựng mới đặt visibility theo nó; đổi công tắc thì chỉ đổi visibility (hienLop) */
    private var batHienTai = KieuBanDo.Bat()
    private var viTri: Location? = null
    private var quang: ValueAnimator? = null

    /** chiều cao thanh điều hướng hệ thống (px) */
    private var dayHeThong = 0

    private fun ghi(s: String) = Log.i("ForFishNative", s)

    private var nenDangVe: String? = null

    /** Dựng lại style khi file đổi HOẶC đổi nền (gói / "Hải đồ chi tiết" / lớp nền ảnh) — nền khác là style khác. */
    private fun veKieu(m: MapLibreMap, tep: KieuBanDo.Tep, xong: (Style) -> Unit) {
        if (tep == tepDangVe && batHienTai.nenChon == nenDangVe && tepDangVe != null) return
        tepDangVe = tep
        nenDangVe = batHienTai.nenChon
        m.setStyle(Style.Builder().fromJson(KieuBanDo.dung(ung.mayChuGoc(), tep, batHienTai))) { st ->
            themLopTau(st)
            xong(st)
        }
    }

    /** Bật/tắt lớp theo công tắc — chỉ đổi `visibility`, không nạp lại style. Lớp chưa có (thiếu file) thì bỏ qua. */
    private fun apDungHien(st: Style, bat: KieuBanDo.Bat) {
        for ((id, hien) in KieuBanDo.hienLop(bat)) {
            st.getLayer(id)?.setProperties(PropertyFactory.visibility(if (hien) Property.VISIBLE else Property.NONE))
        }
    }

    private fun themLopTau(st: Style) {
        val ctx = mapView.context
        val anh = BitmapFactory.decodeResource(ctx.resources, R.drawable.boat_marker, BitmapFactory.Options().apply { inScaled = false })
        anh.density = DisplayMetrics.DENSITY_DEFAULT * 2 // ảnh @2x 144×200 ⇒ 72×100 dp
        st.addImage("tau-ghim", anh)
        st.addSource(GeoJsonSource(NGUON_TAU))
        st.addLayer(
            CircleLayer(LOP_QUANG, NGUON_TAU).withProperties(
                PropertyFactory.circleColor(Mau.t1.toArgb()),
                PropertyFactory.circleRadius(10.5f),
                PropertyFactory.circleOpacity(0.55f),
            ),
        )
        st.addLayer(
            SymbolLayer(LOP_TAU, NGUON_TAU).withProperties(
                PropertyFactory.iconImage("tau-ghim"),
                PropertyFactory.iconAnchor(Property.ICON_ANCHOR_BOTTOM),
                PropertyFactory.iconSize(0.48f), // cao 3rem như web
                PropertyFactory.iconAllowOverlap(true),
                PropertyFactory.iconIgnorePlacement(true),
            ),
        )
        capNhatTau(st, cu = false)
    }

    /** = animate-ping của Tailwind: phóng 1 → 2, mờ dần, lặp mỗi giây. */
    private fun batQuang(bat: Boolean) {
        if (!bat) { quang?.cancel(); quang = null; return }
        if (quang != null) return
        quang = ValueAnimator.ofFloat(0f, 1f).apply {
            duration = 1000
            repeatCount = ValueAnimator.INFINITE
            addUpdateListener { a ->
                val t = a.animatedValue as Float
                map?.style?.getLayer(LOP_QUANG)?.setProperties(
                    PropertyFactory.circleRadius(10.5f * (1 + t)),
                    PropertyFactory.circleOpacity(0.55f * (1 - t)),
                )
            }
            start()
        }
    }

    private fun capNhatTau(st: Style, cu: Boolean) {
        val v = viTri
        // Chưa có GPS ⇒ FeatureCollection rỗng. KHÔNG truyền Geometry null: MapLibre đọc type() của null qua JNI ⇒ SIGABRT.
        val nguon = st.getSourceAs<GeoJsonSource>(NGUON_TAU)
        if (v == null) nguon?.setGeoJson(FeatureCollection.fromFeatures(emptyList()))
        else nguon?.setGeoJson(Point.fromLngLat(v.longitude, v.latitude))
        st.getLayer(LOP_TAU)?.setProperties(PropertyFactory.iconOpacity(if (cu) 0.45f else 1f))
        st.getLayer(LOP_QUANG)?.setProperties(PropertyFactory.visibility(if (v == null || cu) Property.NONE else Property.VISIBLE))
        batQuang(v != null && !cu)
    }

    private fun tocDoKmh(l: Location): Double? = if (l.hasSpeed() && l.speed > 0.5f) l.speed * 3.6 else null

    @SuppressLint("MissingPermission")
    @Composable
    fun Man() {
        val ctx = LocalContext.current
        dayHeThong = WindowInsets.navigationBars.getBottom(LocalDensity.current)
        var coQuyen by remember { mutableStateOf(coQuyenViTri(ctx)) }
        var thieuNen by remember { mutableStateOf(false) }
        var cu by remember { mutableStateOf(false) }
        // Hải đồ chi tiết + ba nhóm = state phiên (web không lưu); vùng lộng/vùng quản lý/trạm/lưới = MapPrefs (lưu)
        var batPhien by remember { mutableStateOf(KieuBanDo.Bat()) }
        val goi = remember { ung.phien.premium() }
        var tuyChon by remember { mutableStateOf(TuyChonBanDo.doc(ung.kho)) }
        var lop by remember { mutableStateOf<String?>(null) } // null đóng · "luoi" lưới ô · id panel
        val batTong = batPhien.copy(vungLong = tuyChon.vungLong, vungQuanLy = tuyChon.vungQuanLy, tramTrieu = tuyChon.tideStations, luoi = tuyChon.mapGrid, goi = goi)
        LaunchedEffect(batTong) {
            val doiNen = batTong.nenChon != batHienTai.nenChon
            batHienTai = batTong
            val m = map
            if (doiNen && m != null && tepDangVe != null) veKieu(m, tepDangVe!!) {} // nền khác ⇒ style khác
            else m?.style?.let { apDungHien(it, batTong) }
        }
        val xin = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { kq ->
            coQuyen = kq.values.any { it }
            ghi("Quyền vị trí: $coQuyen")
        }

        LaunchedEffect(Unit) {
            if (!coQuyen) xin.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
            val daCat = withContext(Dispatchers.IO) { nap.daCat() }
            ghi("Bản đồ: bản đã cất $daCat")
            mapView.getMapAsync { m ->
                map = m
                if (tepDangVe == null) {
                    val dbg = cameraDebug?.split(",")?.mapNotNull { it.trim().toDoubleOrNull() }?.takeIf { it.size == 3 }
                    m.cameraPosition = if (dbg != null) {
                        val cao = mapView.height / mapView.resources.displayMetrics.density
                        CameraPosition.Builder().target(tamLech(dbg[0], dbg[1], dbg[2], cao * LECH_VE_TAU)).zoom(dbg[2]).build()
                    } else CameraPosition.Builder().target(LatLng(KieuBanDo.TAM_LAT, KieuBanDo.TAM_LON)).zoom(KieuBanDo.ZOOM_MO).build()
                }
                m.uiSettings.isRotateGesturesEnabled = false // web khoá xoay: bắc luôn lên trên
                m.uiSettings.isCompassEnabled = false
                // web: chỉ nút ⓘ ghi nguồn (attribution compact), không logo; đặt trên dock nổi
                m.uiSettings.isLogoEnabled = false
                val d = mapView.resources.displayMetrics.density
                m.uiSettings.setAttributionMargins((12 * d).toInt(), 0, 0, ((CoSinh.DockRow + CoSinh.DockGap + 16) * d).toInt() + dayHeThong)
                veKieu(m, daCat) {}
            }
            val (moi, thieu) = nap.capNhat(goi)
            ghi("Bản đồ: cập nhật $moi · chưa có: $thieu")
            thieuNen = moi.nen == null
            mapView.getMapAsync { m -> veKieu(m, moi) {} }
        }

        // GPS: GPS + mạng, mỗi giây; mất fix ⇒ ghim mờ theo luật fixQuaCu của web
        DisposableEffect(coQuyen) {
            val lm = ctx.getSystemService(Context.LOCATION_SERVICE) as LocationManager
            val nghe = LocationListener { l ->
                viTri = l
                cu = false
                map?.style?.let { capNhatTau(it, false) }
            }
            if (coQuyen) {
                for (p in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
                    if (runCatching { lm.isProviderEnabled(p) }.getOrDefault(false)) {
                        lm.requestLocationUpdates(p, 1000L, 0f, nghe, Looper.getMainLooper())
                        lm.getLastKnownLocation(p)?.let { l -> if (viTri == null || l.time > viTri!!.time) viTri = l }
                    }
                }
                map?.style?.let { capNhatTau(it, cu) }
            }
            onDispose { lm.removeUpdates(nghe); batQuang(false) }
        }
        LaunchedEffect(coQuyen) {
            while (true) {
                val v = viTri
                val moiCu = v != null && ViTriTau.fixQuaCu(v.time, tocDoKmh(v), System.currentTimeMillis())
                if (moiCu != cu) { cu = moiCu; map?.style?.let { capNhatTau(it, moiCu) } }
                delay(1000)
            }
        }

        // con nước: web tính lại mỗi 5 phút (nowMs) — đổi thẳng dữ liệu nguồn, không nạp lại style
        LaunchedEffect(Unit) {
            while (true) {
                delay(5 * 60 * 1000L)
                val g = withContext(Dispatchers.IO) { nap.conNuocLucNay() } ?: continue
                map?.style?.getSourceAs<GeoJsonSource>("tram-trieu")?.setGeoJson(g)
            }
        }

        Box(Modifier.fillMaxSize()) {
            AndroidView(factory = { (mapView.parent as? android.view.ViewGroup)?.removeView(mapView); mapView }, modifier = Modifier.fillMaxSize())
            if (thieuNen) {
                Column(Modifier.statusBarsPadding().padding(12.dp).fillMaxWidth()) {
                    TheTrangThai("Chưa tải được bản đồ nền", "Có sóng app sẽ tự tải. Đảo, độ sâu, đèn biển đã có thì vẫn hiện.", "Alert", Mau.warn, Mau.warnNen)
                }
            }
            // NÚT "LỚP" (rail web: cột phải, trên) + lưới ô / panel nổi ngay dưới
            Column(
                Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(top = 12.dp, end = 12.dp),
                horizontalAlignment = Alignment.End,
            ) {
                NutTron("Layers", if (lop == null) "Mở lớp bản đồ" else "Đóng lớp bản đồ", bat = lop != null) {
                    lop = if (lop == null) "luoi" else null
                }
                Spacer(Modifier.height(8.dp))
                when (val l = lop) {
                    null -> {}
                    "luoi" -> LuoiLop(mo = { lop = it }, dong = { lop = null })
                    else -> PanelLop(
                        // bảng thấy công tắc ĐÃ GỘP (có cờ gói, tuỳ chọn); đổi thì chỉ ghi phần của phiên
                        l, batTong, { batPhien = batPhien.copy(chiTiet = it.chiTiet, sau = it.sau, nav = it.nav, ten = it.ten, nenLop = it.nenLop) }, tuyChon,
                        { moi ->
                            tuyChon = moi
                            if (!TuyChonBanDo.ghi(ung.kho, moi)) ghi("Tuỳ chọn bản đồ: kho từ chối ghi — dùng trong RAM")
                        },
                        soTram = nap.soTramConNuoc(), coMang = coMang(ctx), quayLai = { lop = "luoi" }, dong = { lop = null },
                    )
                }
            }
            Box(
                Modifier.align(Alignment.BottomEnd).navigationBarsPadding()
                    .padding(end = 12.dp, bottom = (CoSinh.DockRow + CoSinh.DockGap + 12).dp),
            ) {
                NutTron("Crosshair", "Về chỗ tàu đang đứng") {
                    if (!coQuyen) {
                        xin.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                        return@NutTron
                    }
                    val v = viTri ?: return@NutTron
                    val m = map ?: return@NutTron
                    val cao = mapView.height / mapView.resources.displayMetrics.density
                    m.animateCamera(CameraUpdateFactory.newLatLngZoom(tamLech(v.latitude, v.longitude, ZOOM_VE_TAU, cao * LECH_VE_TAU), ZOOM_VE_TAU), 650)
                    ghi("Về tàu ${v.latitude},${v.longitude}")
                }
            }
        }
    }

    /** Tâm camera để điểm (lat, lon) hiện CAO hơn tâm `lechDp` (= offset [0, −k] của flyTo web): Web Mercator, ô 512. */
    private fun tamLech(lat: Double, lon: Double, zoom: Double, lechDp: Double): LatLng {
        val the = 512 * Math.pow(2.0, zoom)
        val phi = Math.toRadians(lat)
        val y = (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2 * the + lechDp
        val latMoi = Math.toDegrees(2 * Math.atan(Math.exp(Math.PI * (1 - 2 * y / the))) - Math.PI / 2)
        return LatLng(latMoi, lon)
    }

    /** = useOnline của web (thẻ khoá gói ẩn khi mất sóng: không mời việc không làm được). */
    private fun coMang(ctx: Context): Boolean {
        val cm = ctx.getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
        return cm.getNetworkCapabilities(cm.activeNetwork)?.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    }

    private fun coQuyenViTri(ctx: Context) = listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)
        .any { ContextCompat.checkSelfPermission(ctx, it) == PackageManager.PERMISSION_GRANTED }

    companion object {
        private const val NGUON_TAU = "vi-tri-tau"
        private const val LOP_TAU = "vi-tri-tau"
        private const val LOP_QUANG = "vi-tri-tau-quang"
        /** = flyToPoint(lon, lat, 7) + offset −0.18 × chiều cao của goToMyBoat */
        private const val ZOOM_VE_TAU = 7.0
        private const val LECH_VE_TAU = 0.18
    }
}
