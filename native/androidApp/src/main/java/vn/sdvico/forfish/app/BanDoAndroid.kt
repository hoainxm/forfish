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
import vn.sdvico.forfish.shared.dulieu.KhoTepFile
import vn.sdvico.forfish.shared.thoitiet.AnhTruong
import vn.sdvico.forfish.shared.thoitiet.ForecastGrid
import vn.sdvico.forfish.shared.thoitiet.ForecastKind
import vn.sdvico.forfish.shared.thoitiet.HatGio
import vn.sdvico.forfish.shared.thoitiet.LopDong
import vn.sdvico.forfish.shared.thoitiet.LuoiDuBao
import vn.sdvico.forfish.shared.thoitiet.LuoiTruong
import vn.sdvico.forfish.shared.thoitiet.NapDuBao
import vn.sdvico.forfish.shared.thoitiet.NapTruong
import vn.sdvico.forfish.shared.thoitiet.NapDiem
import vn.sdvico.forfish.shared.ca.BanDoCa
import vn.sdvico.forfish.shared.ca.BangPha
import vn.sdvico.forfish.shared.ca.DanhMucCa
import vn.sdvico.forfish.shared.ca.DuBaoCa
import vn.sdvico.forfish.shared.ca.KetQuaCa
import vn.sdvico.forfish.shared.ca.LoaiDanh
import vn.sdvico.forfish.shared.ca.NapCa
import vn.sdvico.forfish.shared.thoitiet.DiemBien
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.layout.onSizeChanged
import vn.sdvico.forfish.shared.thoitiet.TruongMau
import androidx.compose.runtime.mutableIntStateOf
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
    // ── lớp thời tiết động (đợt 2d): bản vẽ mới nhất — dựng lại style thì vẽ lại từ đây ──
    private val tepThoiTiet = KhoTepFile(File(filesDir, "thoi-tiet"))
    @Volatile private var coMangNhanh = true
    private val napGio = NapDuBao(ung.mayChu, tepThoiTiet, { System.currentTimeMillis() }) { !coMangNhanh }
    private val napTruong = NapTruong(ung.mayChu, tepThoiTiet, { System.currentTimeMillis() }) { !coMangNhanh }
    private val napDiem = NapDiem(ung.mayChu, tepThoiTiet, { System.currentTimeMillis() }) { !coMangNhanh }
    /** điểm đang chạm (vòng chọn) — dựng lại style thì vẽ lại */
    private var diemChon: LatLng? = null
    /** cú chạm bản đồ ⇒ màn Compose (gắn một lần trong getMapAsync) */
    private var khiCham: ((LatLng) -> Unit)? = null
    private val napCa = NapCa(ung.mayChu, KhoTepFile(File(filesDir, "ca")), { System.currentTimeMillis() })
    /** GeoJSON lưới cá đang vẽ (null = không vẽ) — dựng lại style thì vẽ lại */
    private var caGeo: String? = null
    private var anhDong: AnhTruong? = null
    private var muiDong: Pair<String, String?>? = null

    private fun apDong(st: Style) {
        VeThoiTiet.truong(st, anhDong)
        VeThoiTiet.muiTen(st, muiDong?.first, muiDong?.second)
        VeCa.luoi(st, caGeo)
        veDiemChon(st)
    }

    /** Vòng chọn tại chỗ chạm (web: marker điểm xem) — trên lớp động, dưới ghim tàu. */
    private fun veDiemChon(st: Style) {
        val p = diemChon
        val geo = if (p == null) FeatureCollection.fromFeatures(emptyList()) else FeatureCollection.fromFeature(org.maplibre.geojson.Feature.fromGeometry(Point.fromLngLat(p.longitude, p.latitude)))
        val src = st.getSourceAs<GeoJsonSource>("diem-chon")
        if (src != null) { src.setGeoJson(geo); return }
        st.addSource(GeoJsonSource("diem-chon", geo))
        val lop = CircleLayer("diem-chon", "diem-chon").withProperties(
            PropertyFactory.circleRadius(9f), PropertyFactory.circleColor("rgba(255,255,255,0.35)"),
            PropertyFactory.circleStrokeColor(Mau.navy.toArgb()), PropertyFactory.circleStrokeWidth(2.5f),
        )
        if (st.getLayer(LOP_QUANG) != null) st.addLayerBelow(lop, LOP_QUANG) else st.addLayer(lop)
    }
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
            apDong(st) // lớp động vẽ tay (không nằm trong style JSON)
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
        // ── THỜI TIẾT ĐỘNG (đợt 2d) ──
        var dong by remember { mutableStateOf<LopDongChon?>(null) }
        var luoiGio by remember { mutableStateOf<ForecastGrid?>(null) }
        var truongMau by remember { mutableStateOf<LuoiTruong?>(null) }
        var gio by remember { mutableIntStateOf(0) }
        var chay by remember { mutableStateOf(false) }
        var dangTai by remember { mutableStateOf(false) }
        var loiDong by remember { mutableStateOf<String?>(null) }
        var lanThu by remember { mutableIntStateOf(0) }
        val batTong = batPhien.copy(vungLong = tuyChon.vungLong, vungQuanLy = tuyChon.vungQuanLy, tramTrieu = tuyChon.tideStations, luoi = tuyChon.mapGrid, goi = goi, dong = dong != null)
        val soNgay = if (goi) 16 else 1 // = soNgayThoiTiet: gói 16 ngày, thường chỉ hôm nay

        // ── DỰ BÁO CÁ (đợt 2e): bật ⇒ bản lưu ngay, rồi mạng; cần gói (khoá ở panel); lớp động bật thì ẩn (web) ──
        var caBat by remember { mutableStateOf(false) }
        var banCa by remember { mutableStateOf<BanDoCa?>(null) }
        var loiCa by remember { mutableStateOf<String?>(null) }
        var lanCa by remember { mutableIntStateOf(0) }
        var picks by remember { mutableStateOf(LoaiDanh.doc(ung.kho)) }
        var loaiRieng by remember { mutableStateOf<String?>(null) }
        LaunchedEffect(caBat, goi, lanCa) {
            loiCa = null
            if (!caBat || !goi) return@LaunchedEffect
            withContext(Dispatchers.IO) { napCa.banLuu() }?.let { banCa = it.banDo }
            when (val r = withContext(Dispatchers.IO) { napCa.lay() }) {
                is KetQuaCa.Co -> banCa = r.banDo
                is KetQuaCa.Khong -> loiCa = DuBaoCa.fishFailNote(r.code)
            }
        }
        LaunchedEffect(caBat, goi, banCa, picks, loaiRieng, dong) {
            val b = banCa
            caGeo = if (!caBat || !goi || dong != null || b == null) null else withContext(Dispatchers.Default) {
                val bo = loaiRieng?.let { listOf(it) } ?: picks ?: emptyList()
                DuBaoCa.lopCa(b, bo, homNayVN(), 0, emptyList(), null, BangPha.RONG, chuaChon = loaiRieng == null && picks == null).geo
            }
            map?.style?.let { VeCa.luoi(it, caGeo) }
        }

        // ── THẺ CHẠM ĐIỂM (đợt 2d): chạm biển ⇒ gió sóng chỗ đó (bản lưu trước nếu mạng chậm) ──
        var cham by remember { mutableStateOf<LatLng?>(null) }
        var diem by remember { mutableStateOf<DiemBien?>(null) }
        var dangTaiDiem by remember { mutableStateOf(false) }
        var loiDiem by remember { mutableStateOf(false) }
        var ngayDiem by remember { mutableIntStateOf(0) }
        var caoThe by remember { mutableIntStateOf(0) } // chiều cao thẻ chạm (dp) — đẩy thanh giờ + nút về tàu lên trên
        val phamVi = rememberCoroutineScope()
        khiCham = { ll -> cham = ll; lop = null }
        LaunchedEffect(cham, soNgay) {
            diemChon = cham
            map?.style?.let { veDiemChon(it) }
            val p = cham ?: return@LaunchedEffect
            diem = null; loiDiem = false; ngayDiem = 0; dangTaiDiem = true
            coMangNhanh = coMang(ctx)
            try {
                diem = withContext(Dispatchers.IO) { napDiem.lay(p.latitude, p.longitude, soNgay, phamVi) { moi -> if (cham == p) diem = moi } }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                ghi("Điểm chạm: ${e.message}"); loiDiem = true
            } finally {
                dangTaiDiem = false
            }
        }

        // tải lớp động: bản trong máy hiện NGAY (peek), rồi mạng; lỗi mà không có bản nào ⇒ báo + nút Thử lại
        LaunchedEffect(dong, lanThu, soNgay) {
            coMangNhanh = coMang(ctx)
            gio = 0; chay = false; loiDong = null; luoiGio = null; truongMau = null
            val d = dong ?: return@LaunchedEffect
            dangTai = true
            val canDong = d is LopDongChon.LuoiChon && d.kind == ForecastKind.CURRENT
            withContext(Dispatchers.IO) { napGio.peek(soNgay, canDong) }?.let { luoiGio = it }
            if (d is LopDongChon.MauChon) withContext(Dispatchers.IO) { napTruong.peek(d.kind, soNgay) }?.let { truongMau = it }
            try {
                // lớp màu vẫn cần lưới gió cho vệt hạt nền (web: streak trên lớp màu) — hỏng thì bỏ qua, không chặn lớp màu
                luoiGio = runCatching { withContext(Dispatchers.IO) { napGio.lay(soNgay, canDong) } }
                    .getOrElse { e -> if (d is LopDongChon.LuoiChon) throw e else luoiGio }
                if (d is LopDongChon.MauChon) truongMau = withContext(Dispatchers.IO) { napTruong.lay(d.kind, soNgay) }
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (e: Exception) {
                ghi("Thời tiết: ${e.message}")
                if ((d is LopDongChon.LuoiChon && luoiGio == null) || (d is LopDongChon.MauChon && truongMau == null)) loiDong = "Có sóng thì thử lại."
            } finally {
                dangTai = false
            }
        }
        // vẽ: ảnh trường (nặng ⇒ Default) + mũi tên theo mốc giờ
        LaunchedEffect(dong, luoiGio, truongMau, gio) {
            val d = dong
            val g = luoiGio
            val t = truongMau
            val ve: Pair<AnhTruong?, Pair<String, String?>?> = withContext(Dispatchers.Default) {
                when {
                    d is LopDongChon.LuoiChon && g != null && g.times.isNotEmpty() -> {
                        val i = gio.coerceIn(0, g.times.size - 1)
                        LopDong.truongTuLuoi(g, d.kind)?.let { TruongMau.anhTruong(it, i, 8, moRong = true) } to
                            (LuoiDuBao.arrowFeatures(g, i, d.kind) to VeThoiTiet.mauMuiTen(d.kind))
                    }
                    d is LopDongChon.MauChon && t != null && t.times.isNotEmpty() ->
                        TruongMau.anhTruong(t, gio.coerceIn(0, t.times.size - 1), 8, moRong = true) to null
                    else -> null to null
                }
            }
            anhDong = ve.first; muiDong = ve.second
            map?.style?.let { apDong(it) }
        }
        // khung kéo khi có lớp động (= setMaxBounds(PAN_BOUNDS) + minZoom 4 + fitBounds(LOCKED_BOUNDS) của web)
        LaunchedEffect(dong != null) {
            val m = map ?: return@LaunchedEffect
            if (dong != null) {
                m.setLatLngBoundsForCameraTarget(VeThoiTiet.KHUNG_KEO)
                m.setMinZoomPreference(4.0)
                m.animateCamera(CameraUpdateFactory.newLatLngBounds(VeThoiTiet.KHUNG_MO, 0), 350)
            } else {
                m.setLatLngBoundsForCameraTarget(null)
                m.setMinZoomPreference(2.0)
            }
        }
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
                m.addOnMapClickListener { ll -> khiCham?.invoke(ll); true }
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
            // HẠT (WindParticles): lưới gió/sóng/dòng của lớp đang bật; lớp màu ⇒ vệt gió nền (ambient)
            val m0 = map
            val g0 = luoiGio
            val d0 = dong
            if (m0 != null && g0 != null && d0 != null && g0.times.isNotEmpty()) {
                val k = if (d0 is LopDongChon.LuoiChon) d0.kind else ForecastKind.WIND
                val f = remember(g0, gio, k) { HatGio.buildUVField(LopDong.hatTuLuoi(g0), gio.coerceIn(0, g0.times.size - 1), LopDong.loaiHat(k)) }
                if (f != null) LopHat(m0, f, if (d0 is LopDongChon.LuoiChon) KieuHat.cua(LopDong.loaiHat(k)) else KieuHat.AMBIENT, gio)
            }
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
                        soTram = nap.soTramConNuoc(), coMang = coMang(ctx), lopDong = dong, chonLopDong = { dong = it; lop = null },
                        nguTruong = {
                            val tam = map?.cameraPosition?.target
                            PanelNguTruong(
                                caBat, { bat -> caBat = bat; if (bat) dong = null }, if (goi) null else "upgrade", coMang(ctx),
                                banCa?.species ?: DanhMucCa.LOAI.map { it.short },
                                if (tam != null) DanhMucCa.dangVu(tam.latitude, tam.longitude, java.time.LocalDate.now().monthValue) else emptySet(),
                                picks, { moi -> picks = moi; LoaiDanh.ghi(ung.kho, moi) }, loaiRieng, { loaiRieng = it }, loiCa, { lanCa++ },
                            )
                        },
                        quayLai = { lop = "luoi" }, dong = { lop = null },
                    )
                }
            }
            // CHÚ GIẢI CÁ (web: khi lưới cá đang vẽ và không có panel mở)
            if (caBat && goi && dong == null && lop == null && (picks != null || loaiRieng != null) && banCa != null) {
                ChuGiaiCa(Modifier.align(Alignment.BottomStart).navigationBarsPadding().padding(start = 12.dp, bottom = (CoSinh.DockRow + CoSinh.DockGap + 48 + if (cham != null) caoThe else 0).dp))
            }
            // THANH GIỜ (lớp động bật)
            d0?.let { d ->
                val times = (if (d is LopDongChon.MauChon) truongMau?.times else luoiGio?.times) ?: emptyList()
                val tieuDe = when (d) {
                    is LopDongChon.LuoiChon -> when (d.kind) { ForecastKind.WIND -> "Sức gió"; ForecastKind.WAVE -> "Độ cao"; ForecastKind.CURRENT -> "Dòng chảy" }
                    is LopDongChon.MauChon -> TruongMau.SCALAR_META.getValue(d.kind).label
                }
                val chuGiai = when (d) {
                    is LopDongChon.LuoiChon -> LuoiDuBao.legendStops(d.kind).let { st ->
                        dai(st.map { it.value to android.graphics.Color.parseColor(it.color) }) to
                            ("${st.first().value.toInt()}" to "${st.last().value.toInt()}+ ${LuoiDuBao.legendUnit(d.kind)}")
                    }
                    is LopDongChon.MauChon -> TruongMau.SCALAR_RAMP.getValue(d.kind).let { st ->
                        dai(st.map { it.value to android.graphics.Color.argb((it.a * 255).toInt().coerceAtLeast(60), it.r, it.g, it.b) }) to
                            ("${st.first().value.toInt()}" to "${st.last().value.toInt()} ${TruongMau.SCALAR_META.getValue(d.kind).unit}")
                    }
                }
                Box(Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = (CoSinh.DockRow + CoSinh.DockGap + 8 + if (cham != null) caoThe + 8 else 0).dp)) {
                    ThanhGio(
                        tieuDe, times, gio, { gio = it }, chay, { chay = it },
                        cu = (if (d is LopDongChon.MauChon) truongMau?.stale else luoiGio?.stale) == true, dangTai = dangTai,
                        chuGiai = chuGiai, loi = loiDong, thuLai = { lanThu++ },
                    )
                }
            }
            if (cham != null) {
                val mat = LocalDensity.current
                Box(
                    Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(bottom = (CoSinh.DockRow + CoSinh.DockGap + 8).dp)
                        .onSizeChanged { caoThe = with(mat) { it.height.toDp().value.toInt() } },
                ) {
                    TheDiemBien(diem, dangTaiDiem, loiDiem, ngayDiem, { ngayDiem = it }) { cham = null }
                }
            }
            Box(
                Modifier.align(Alignment.BottomEnd).navigationBarsPadding()
                    // thanh giờ đang mở ⇒ nút về tàu lên trên khối thanh giờ (~220 dp) cho khỏi bị che
                    .padding(end = 12.dp, bottom = (CoSinh.DockRow + CoSinh.DockGap + 12 + (if (dong != null) 220 else 0) + (if (cham != null) caoThe + 8 else 0)).dp),
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
