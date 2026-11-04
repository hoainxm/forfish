package vn.sdvico.forfish.app

import android.os.Bundle
import android.os.SystemClock
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.maplibre.android.MapLibre
import org.maplibre.android.camera.CameraPosition
import org.maplibre.android.geometry.LatLng
import org.maplibre.android.maps.MapView
import org.maplibre.android.maps.Style
import vn.sdvico.forfish.shared.bando.DuLieuTramTrieu
import vn.sdvico.forfish.shared.bando.KieuBanDo
import vn.sdvico.forfish.shared.senbien.GemmaCtx
import vn.sdvico.forfish.shared.senbien.SenBienGemma
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/*
  ĐỢT 0 (app-map 18 §3): màn thử đường ống native — KHÔNG phải UI thật.
  1. Bản đồ MapLibre Native đọc nền `vn-basemap.pmtiles` từ file trong máy.
  2. Tải trạm con nước (SDF1) từ web công ty, `shared` giải mã + dựng GeoJSON, vẽ lên bản đồ.
  3. `shared` gọi Gemma qua LiteRT-LM Android (nếu bản build có mô hình).
  Mọi kết quả ghi lên màn + Logcat tag "ForFishNative" để kiểm bằng adb.
*/
class MainActivity : ComponentActivity() {
    private val dong = mutableStateListOf<String>()
    private lateinit var mapView: MapView
    private var gemma: GemmaAndroid? = null

    private fun ghi(s: String) {
        Log.i("ForFishNative", s)
        dong.add(s)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        MapLibre.getInstance(this)
        mapView = MapView(this).also { it.onCreate(savedInstanceState) }

        setContent {
            MaterialTheme {
                Column(Modifier.fillMaxSize().statusBarsPadding()) {
                    Column(Modifier.fillMaxWidth().padding(12.dp)) {
                        for (d in dong) Text(d, style = MaterialTheme.typography.bodySmall)
                    }
                    AndroidView(factory = { mapView }, modifier = Modifier.fillMaxSize())
                }
            }
        }
        lifecycleScope.launch { chay() }
    }

    private suspend fun chay() {
        val nen = chepTuAssets("vn-basemap.pmtiles")
        val tramGeo = try {
            val t0 = SystemClock.elapsedRealtime()
            val byte = withContext(Dispatchers.IO) { tai("https://sdfish.sdvico.vn" + DuLieuTramTrieu.DUONG_DAN) }
            val tram = DuLieuTramTrieu.doc(byte)
            ghi("Trạm con nước: ${tram.size} trạm (${String(byte, 0, 4, Charsets.ISO_8859_1)} ${byte.size} B, ${SystemClock.elapsedRealtime() - t0} ms)")
            DuLieuTramTrieu.geoJson(tram)
        } catch (e: Exception) {
            ghi("Trạm con nước LỖI: ${e.message}")
            null
        }
        if (nen == null) ghi("Thiếu nền bản đồ trong bản build")
        mapView.getMapAsync { map ->
            map.cameraPosition = CameraPosition.Builder().target(LatLng(KieuBanDo.TAM_LAT, KieuBanDo.TAM_LON)).zoom(KieuBanDo.ZOOM_MO).build()
            val url = if (nen != null) "pmtiles://file://${nen.absolutePath}" else ""
            map.setStyle(Style.Builder().fromJson(KieuBanDo.nen(url, tramGeo))) { ghi("Bản đồ: style đã nạp") }
        }
        thuGemma()
    }

    private suspend fun thuGemma() {
        val f = chepTuAssets("gemma.litertlm") ?: return ghi("Gemma: bản build không có mô hình")
        val may = GemmaAndroid(f.absolutePath, cacheDir.path).also { gemma = it }
        val t0 = SystemClock.elapsedRealtime()
        try {
            may.nap()
        } catch (e: Throwable) {
            return ghi("Gemma nạp LỖI: ${e.message}")
        }
        ghi("Gemma nạp ${SystemClock.elapsedRealtime() - t0} ms")
        val yHopLe = setOf("mo_lop", "hoi_ca", "hoi_o_dau", "dan_duong", "doc_gia_tri", "gia_ca", "hoi_phia_truoc")
        val ctx = GemmaCtx(cang = listOf("sa huynh", "ly son"), diem = listOf("hon mu"))
        for (cau in listOf("XEM BẢN ĐỒ SÓNG CHIỀU MAI", "tui đang ở mô rứa", "giá cá thu hôm nay")) {
            val t = SystemClock.elapsedRealtime()
            val d = SenBienGemma.hieu(may, cau, ctx, yHopLe)
            ghi("Gemma ${SystemClock.elapsedRealtime() - t} ms | $cau → ${d?.y} ${d?.s ?: ""}")
        }
    }

    /** assets/du-lieu/<ten> → filesDir (một lần; MapLibre/LiteRT cần đường dẫn file thật). Không có ⇒ null. */
    private suspend fun chepTuAssets(ten: String): File? = withContext(Dispatchers.IO) {
        val dich = File(filesDir, ten)
        if (dich.exists() && dich.length() > 0) return@withContext dich
        try {
            assets.open("du-lieu/$ten").use { i -> dich.outputStream().use { o -> i.copyTo(o) } }
            dich
        } catch (_: java.io.IOException) {
            null
        }
    }

    private fun tai(url: String): ByteArray {
        val c = URL(url).openConnection() as HttpURLConnection
        c.connectTimeout = 15000
        c.readTimeout = 20000
        try {
            if (c.responseCode != 200) error("HTTP ${c.responseCode}")
            return c.inputStream.use { it.readBytes() }
        } finally {
            c.disconnect()
        }
    }

    override fun onStart() { super.onStart(); mapView.onStart() }
    override fun onResume() { super.onResume(); mapView.onResume() }
    override fun onPause() { mapView.onPause(); super.onPause() }
    override fun onStop() { mapView.onStop(); super.onStop() }
    override fun onLowMemory() { super.onLowMemory(); mapView.onLowMemory() }
    override fun onDestroy() { gemma?.dong(); mapView.onDestroy(); super.onDestroy() }
    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); mapView.onSaveInstanceState(outState) }
}
