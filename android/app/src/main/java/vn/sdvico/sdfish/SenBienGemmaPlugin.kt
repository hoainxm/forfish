package vn.sdvico.sdfish

import android.os.SystemClock
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.SamplerConfig
import com.google.android.play.core.assetpacks.AssetPackManager
import com.google.android.play.core.assetpacks.AssetPackManagerFactory
import com.google.android.play.core.assetpacks.AssetPackState
import com.google.android.play.core.assetpacks.AssetPackStateUpdateListener
import com.google.android.play.core.assetpacks.model.AssetPackStatus
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/*
 * SEN BIỂN — Gemma 3 270M chạy TRONG MÁY (ADR 0012, doc 15 §20).
 *
 * Mô hình 62 MB nằm trong gói Play Asset Delivery on-demand "senbiengemma": bản cài
 * không phình; app xin tải MỘT lần, Play giữ trong máy, ngoài biển không cần mạng.
 * Chạy bằng LiteRT-LM (đường on-device chính thức của Google) trên CPU.
 *
 * Plugin chỉ làm ba việc: báo trạng thái gói · xin tải gói · sinh MỘT dòng JSON cho
 * một câu (prompt dựng sẵn ở TS — src/lib/sen-bien/gemma.ts — để khớp từng chữ với
 * lúc train). Mọi lỗi trả reject có mã; phía TS lùi về n-gram + luật, không treo.
 */
@CapacitorPlugin(name = "SenBienGemma")
class SenBienGemmaPlugin : Plugin() {
    private val pack = "senbiengemma"
    private val tep = "sen-bien/gemma.litertlm"
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val khoa = Mutex()
    private var engine: Engine? = null
    private var listener: AssetPackStateUpdateListener? = null

    private val apm: AssetPackManager by lazy { AssetPackManagerFactory.getInstance(context) }

    /** Đường file mô hình nếu gói đã nằm trong máy, không thì null. */
    private fun duongMoHinh(): String? {
        val loc = apm.getPackLocation(pack) ?: return null
        val f = File(loc.assetsPath() ?: return null, tep)
        return if (f.isFile) f.absolutePath else null
    }

    private fun tenTrangThai(s: Int): String = when (s) {
        AssetPackStatus.COMPLETED -> "co"
        AssetPackStatus.DOWNLOADING, AssetPackStatus.TRANSFERRING -> "dang_tai"
        AssetPackStatus.PENDING -> "cho"
        AssetPackStatus.WAITING_FOR_WIFI -> "cho_wifi"
        AssetPackStatus.REQUIRES_USER_CONFIRMATION -> "can_dong_y"
        AssetPackStatus.FAILED -> "loi"
        AssetPackStatus.CANCELED -> "huy"
        AssetPackStatus.NOT_INSTALLED -> "chua_co"
        else -> "khong_ro"
    }

    private fun jsTrangThai(st: AssetPackState?): JSObject {
        val o = JSObject()
        val co = duongMoHinh() != null
        o.put("trangThai", if (co) "co" else st?.let { tenTrangThai(it.status()) } ?: "chua_co")
        o.put("daNap", engine != null)
        if (st != null && st.totalBytesToDownload() > 0) {
            o.put("phanTram", (100 * st.bytesDownloaded() / st.totalBytesToDownload()).toInt())
            o.put("tongMB", st.totalBytesToDownload() / 1_000_000)
        }
        if (st != null && st.errorCode() != 0) o.put("maLoi", st.errorCode())
        return o
    }

    @PluginMethod
    fun trangThai(call: PluginCall) {
        if (duongMoHinh() != null) {
            call.resolve(jsTrangThai(null))
            return
        }
        apm.getPackStates(listOf(pack))
            .addOnSuccessListener { s -> call.resolve(jsTrangThai(s.packStates()[pack])) }
            .addOnFailureListener { e -> call.reject("Không hỏi được Play: ${e.message}", "play") }
    }

    /** Xin Play tải gói. Tiến độ phát sự kiện "tien" (cùng dạng trangThai). */
    @PluginMethod
    fun taiVe(call: PluginCall) {
        if (duongMoHinh() != null) {
            call.resolve(jsTrangThai(null))
            return
        }
        if (listener == null) {
            val l = AssetPackStateUpdateListener { st ->
                if (st.name() != pack) return@AssetPackStateUpdateListener
                // gói lớn qua 4G: Play đòi bà con đồng ý — hiện hộp thoại của Play
                if (st.status() == AssetPackStatus.WAITING_FOR_WIFI || st.status() == AssetPackStatus.REQUIRES_USER_CONFIRMATION) {
                    activity?.let { a -> @Suppress("DEPRECATION") apm.showConfirmationDialog(a) }
                }
                notifyListeners("tien", jsTrangThai(st))
            }
            listener = l
            apm.registerListener(l)
        }
        apm.fetch(listOf(pack))
            .addOnSuccessListener { s -> call.resolve(jsTrangThai(s.packStates()[pack])) }
            .addOnFailureListener { e -> call.reject("Không xin tải được: ${e.message}", "play") }
    }

    private fun napNeuCan(): Engine {
        engine?.let { return it }
        val p = duongMoHinh() ?: throw IllegalStateException("chua_co")
        // CPU: ổn định trên mọi máy; GPU của LiteRT-LM cho Gemma 270M Google còn ghi "đang làm"
        val e = Engine(EngineConfig(modelPath = p, backend = Backend.CPU(), cacheDir = context.cacheDir.path))
        e.initialize()
        engine = e
        return e
    }

    /** Nạp trước (lúc mở bản đồ) để câu đầu khỏi chờ ~1–2 s. */
    @PluginMethod
    fun nap(call: PluginCall) {
        scope.launch {
            try {
                khoa.withLock { napNeuCan() }
                call.resolve(jsTrangThai(null))
            } catch (e: IllegalStateException) {
                call.reject("Máy chưa có mô hình", "chua_co")
            } catch (e: Throwable) {
                call.reject("Nạp mô hình lỗi: ${e.message}", "nap")
            }
        }
    }

    /** { he: system, nguoi: user } → { txt, ms } — giải mã tham lam, một hội thoại mới mỗi câu (như lúc chấm). */
    @PluginMethod
    fun hoi(call: PluginCall) {
        val he = call.getString("he") ?: return call.reject("thiếu he", "tham_so")
        val nguoi = call.getString("nguoi") ?: return call.reject("thiếu nguoi", "tham_so")
        scope.launch {
            try {
                val txt = khoa.withLock {
                    val e = napNeuCan()
                    val t0 = SystemClock.elapsedRealtime()
                    val cfg = ConversationConfig(
                        systemInstruction = Contents.of(he),
                        samplerConfig = SamplerConfig(topK = 1, topP = 1.0, temperature = 0.0),
                    )
                    val kq = e.createConversation(cfg).use { c -> c.sendMessage(Contents.of(nguoi)).toString() }
                    kq to (SystemClock.elapsedRealtime() - t0)
                }
                val o = JSObject()
                o.put("txt", txt.first)
                o.put("ms", txt.second)
                call.resolve(o)
            } catch (e: IllegalStateException) {
                call.reject("Máy chưa có mô hình", "chua_co")
            } catch (e: Throwable) {
                call.reject("Gemma lỗi: ${e.message}", "chay")
            }
        }
    }

    /** Nhả RAM (~200 MB) khi rời bản đồ. */
    @PluginMethod
    fun dong(call: PluginCall) {
        scope.launch {
            khoa.withLock {
                engine?.close()
                engine = null
            }
            call.resolve()
        }
    }

    override fun handleOnDestroy() {
        listener?.let { apm.unregisterListener(it) }
        engine?.close()
        engine = null
        super.handleOnDestroy()
    }
}
