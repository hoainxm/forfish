package vn.sdvico.forfish.app

import android.content.Context
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import vn.sdvico.forfish.app.giaodien.BieuTuong
import vn.sdvico.forfish.app.giaodien.Chu
import vn.sdvico.forfish.app.giaodien.Mau
import vn.sdvico.forfish.shared.dangchay.BoChay
import vn.sdvico.forfish.shared.dangchay.BoPhatNgon
import vn.sdvico.forfish.shared.dangchay.CheDoGiong
import vn.sdvico.forfish.shared.dangchay.GhepGiong
import vn.sdvico.forfish.shared.dangchay.KeHoachPhat
import vn.sdvico.forfish.shared.dangchay.KetQuaPhat
import vn.sdvico.forfish.shared.dangchay.MucCau
import vn.sdvico.forfish.shared.dangchay.NhipChay
import vn.sdvico.forfish.shared.dangchay.SuKienGiong
import vn.sdvico.forfish.shared.dangchay.TrangThaiGps
import vn.sdvico.forfish.shared.danduong.TinhDuong
import vn.sdvico.forfish.shared.giaodien.CoSinh
import java.util.Locale

/*
  ĐANG CHẠY trên Android (đợt 2f, app-map 18 §3k) = NavHud + NavThanhDay (nav-mode.tsx) + use-nav-voice (phần phát):
   · bộ máy một nhịp ở shared `BoChay` (tiến độ, lệch tuyến, khúc rẽ, hiểm hoạ, gom câu) — ở đây chỉ vẽ + phát tiếng;
   · GIỌNG: hàng đợi `BoPhatNgon` (announce/pump/finished, nhịp chờ waitMs) + chuông 700 ms trước câu đỏ/vàng lần đầu
     (CHIME_LEAD_MS) + TextToSpeech tiếng Việt của máy. Máy không có giọng Việt ⇒ vẫn đi hết hàng (không dồn câu cũ),
     cảnh báo HÌNH vẫn hiện.
  nợ: chưa phát mp3 thu sẵn giọng Mỹ Duyên (public/giong, ~16 MB) — `GhepGiong.keHoachPhat` có sẵn, đọc bằng giọng máy
  toàn bộ; nâng khi đóng gói giọng vào app (đợt 7 phát hành: asset pack / tải theo yêu cầu).
*/
class GiongAndroid(ctx: Context) {
    private var tts: TextToSpeech? = null
    /** null = chưa biết; false = máy không đọc được tiếng Việt */
    @Volatile var docDuoc: Boolean? = null
        private set
    private val xong = HashMap<String, (Boolean) -> Unit>()
    private val chinh = Handler(Looper.getMainLooper())
    private var seq = 0
    private val chuong = runCatching { ToneGenerator(AudioManager.STREAM_NOTIFICATION, 90) }.getOrNull()

    init {
        tts = TextToSpeech(ctx.applicationContext) { st ->
            val t = tts
            docDuoc = if (st != TextToSpeech.SUCCESS || t == null) false else {
                val r = t.setLanguage(Locale.forLanguageTag("vi-VN"))
                r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED
            }
            Log.i("ForFishNative", "Giọng: đọc tiếng Việt = $docDuoc")
            t?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(id: String?) {}
                override fun onDone(id: String?) { bao(id, true) }
                @Deprecated("API cũ") override fun onError(id: String?) { bao(id, false) }
                override fun onStop(id: String?, interrupted: Boolean) { bao(id, false) }
            })
        }
    }

    private fun bao(id: String?, ok: Boolean) {
        val f = synchronized(xong) { id?.let { xong.remove(it) } } ?: return
        chinh.post { f(ok) }
    }

    fun keuChuong(gap: Boolean) {
        chuong?.startTone(if (gap) ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD else ToneGenerator.TONE_PROP_BEEP2, if (gap) 600 else 300)
    }

    /** Đọc một câu; `xong(true)` = đọc trọn, false = bị cắt / lỗi. */
    fun noi(text: String, rate: Double, xong: (Boolean) -> Unit) {
        val t = tts
        if (t == null || docDuoc != true) { chinh.post { xong(false) }; return }
        // kế hoạch phát của web: mảnh mp3 chưa đóng gói ⇒ đọc giọng máy cả câu (nợ ở đầu file)
        val chu = when (val k = GhepGiong.keHoachPhat(text)) {
            is KeHoachPhat.GiongMay -> k.text
            else -> text
        }
        val id = "c${++seq}"
        synchronized(this.xong) { this.xong[id] = xong }
        t.setSpeechRate(rate.toFloat())
        t.speak(chu, TextToSpeech.QUEUE_FLUSH, null, id)
    }

    fun cat() { tts?.stop() }

    fun dong() { tts?.shutdown(); chuong?.release() }
}

/** Hàng đợi câu đọc = phần `run`/`push` của use-nav-voice (không có chế độ tắt-màn của web: Android giữ sáng màn khi dẫn). */
class PhatNgonAndroid(private val giong: GiongAndroid) {
    private var st = BoPhatNgon.initAnnouncer()
    private var tok = 0
    private val chinh = Handler(Looper.getMainLooper())
    private var cho: Runnable? = null
    var cheDo = CheDoGiong.DAY_DU

    fun day(ev: List<SuKienGiong>) { if (ev.isNotEmpty()) chay(BoPhatNgon.announce(st, ev, now(), cheDo)) }

    private fun now() = System.currentTimeMillis().toDouble()

    private fun chay(r: KetQuaPhat) {
        st = r.state
        if (r.interrupt) { tok++; giong.cat() }
        val u = r.start
        if (u != null) {
            cho?.let { chinh.removeCallbacks(it) }; cho = null
            val t = ++tok
            val xong = { _: Boolean -> if (t == tok) chay(BoPhatNgon.finished(st, now())) }
            val duocDoc = cheDo != CheDoGiong.TAT || u.ev.reply
            if (!duocDoc || giong.docDuoc == false) { chinh.post { xong(false) }; return }
            val di = { giong.noi(u.text, GhepGiong.speechRate(u.ev.reply, u.text), xong) }
            val lead = (u.tier == MucCau.DO || u.tier == MucCau.VANG) && u.repeat == 0 && !u.ev.reply
            if (lead) { giong.keuChuong(u.tier == MucCau.DO); chinh.postDelayed({ if (t == tok) di() }, BoPhatNgon.CHIME_LEAD_MS) } else di()
        } else if (r.waitMs != null && cho == null) {
            val c = Runnable { cho = null; chay(BoPhatNgon.pump(st, now())) }
            cho = c
            chinh.postDelayed(c, r.waitMs!!.toLong() + 20)
        }
    }

    fun dung() { tok++; cho?.let { chinh.removeCallbacks(it) }; cho = null; giong.cat(); st = BoPhatNgon.initAnnouncer() }
}

/** Khung nổi NUỐT chạm (= pointer-events-auto của web): chạm chỗ không phải nút không lọt xuống bản đồ. */
fun Modifier.chanCham(): Modifier = this.pointerInput(Unit) { awaitPointerEventScope { while (true) awaitPointerEvent().changes.forEach { it.consume() } } }

private fun gioToi(nowMs: Long, hours: Double): String =
    java.time.Instant.ofEpochMilli(nowMs + (hours * 3_600_000).toLong()).atZone(java.time.ZoneId.of("Asia/Ho_Chi_Minh"))
        .let { "%02d:%02d".format(it.hour, it.minute) }

/** = kc(km, unit) của nav-mode: dưới 10 hải lý một số lẻ. */
private fun kc(km: Double, donVi: String) = fmtDist(km, donVi, if (km < 10 * 1.852) 1 else 0)

/** Khung trên (NavHud): lệnh lái hàng đầu + mất định vị + khúc rẽ + dòng cảnh báo + lệch tuyến + nút Xong khi tới. */
@Composable
fun HudChay(n: NhipChay?, donVi: String, boQuaLech: () -> Unit, xong: () -> Unit, modifier: Modifier = Modifier) {
    val lost = n?.gps == TrangThaiGps.LOST
    val td = n?.tienDo
    Column(
        modifier.fillMaxWidth().padding(horizontal = 12.dp).shadow(8.dp, RoundedCornerShape(CoSinh.RCard.dp))
            .clip(RoundedCornerShape(CoSinh.RCard.dp)).background(Mau.the).chanCham().padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.heightIn(min = 44.dp)) {
            if (td != null && td.steer != null && !td.arrived) BieuTuong("NavArrow", Mau.t1, 28.dp, Modifier.rotate(td.steer!!.turnDeg.toFloat()))
            else BieuTuong("Route", Mau.t1, 24.dp)
            Text(
                when {
                    td == null -> "Đang tìm vị trí tàu…"
                    td.arrived -> "Đã tới gần điểm đến"
                    td.steer != null -> td.steer!!.label
                    else -> "Đang xác định hướng…"
                },
                style = Chu.h2.copy(fontSize = 20.sp), maxLines = 1,
                modifier = Modifier.padding(start = 8.dp).alpha(if (lost) 0.5f else 1f),
            )
        }
        if (lost) DongMau("Mất định vị — số dưới là lần bắt gần nhất.", Mau.warnNen, Mau.warn)
        n?.hud?.forEach { l ->
            DongMau(l.cau, if (l.muc == "do") Mau.nguyNen else if (l.muc == "vang") Mau.warnNen else Mau.o, if (l.muc == "do") Mau.nguy else if (l.muc == "vang") Mau.warn else Mau.navy)
        }
        val kr = n?.khucRe
        if (kr != null && td?.arrived == false) Row(verticalAlignment = Alignment.CenterVertically) {
            BieuTuong("NavArrow", Mau.t1, 16.dp, Modifier.rotate(kr.gocDeg.toFloat()))
            Text("Còn ${kc(kr.km, donVi)} tới khúc rẽ · rồi đi ${kr.huongVN}", style = Chu.nutPhu.copy(color = Mau.navy), modifier = Modifier.padding(start = 6.dp))
        }
        val l = n?.lech
        if (l != null && !l.dismissed && td?.arrived == false) Row(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(Mau.warnNen).clickable(onClick = boQuaLech).padding(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Lệch đường đã vẽ ~${kc(l.km, donVi)}${l.ben?.let { " — vạch ở bên $it tàu" } ?: ""}.",
                style = Chu.nutPhu.copy(color = Mau.warn), modifier = Modifier.weight(1f),
            )
            BieuTuong("Minus", Mau.warn, 16.dp)
        }
        if (td?.arrived == true) Row(
            Modifier.fillMaxWidth().heightIn(min = CoSinh.HCtl.dp).clip(RoundedCornerShape(12.dp)).background(Mau.ok).clickable(onClick = xong),
            horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
        ) {
            BieuTuong("Check", Color.White, 20.dp)
            Text(vn.sdvico.forfish.shared.sinh.NhanSinh.nhan("xong"), style = Chu.nutPhu.copy(fontSize = 16.sp, color = Color.White), modifier = Modifier.padding(start = 6.dp))
        }
    }
}

@Composable
private fun DongMau(chu: String, nen: Color, mau: Color) {
    Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(nen).padding(horizontal = 10.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        BieuTuong("Alert", mau, 16.dp)
        Text(chu, style = Chu.nutPhu.copy(color = mau), modifier = Modifier.padding(start = 6.dp))
    }
}

/** Thanh đáy (NavThanhDay): quãng còn · giờ chạy · tới lúc · tốc độ · hướng + Dừng. */
@Composable
fun ThanhDayChay(n: NhipChay?, donVi: String, nowMs: Long, dung: () -> Unit, modifier: Modifier = Modifier) {
    val td = n?.tienDo ?: return
    val nm = donVi != "km"
    val tocDo = n.speedKmh?.let { if (nm) "${TheDiemSo.mot(it / 1.852)} hải lý/giờ" else "${Math.round(it)} km/giờ" }
    Row(
        modifier.fillMaxWidth().padding(horizontal = 12.dp).shadow(8.dp, RoundedCornerShape(CoSinh.RCard.dp))
            .clip(RoundedCornerShape(CoSinh.RCard.dp)).background(Mau.the).chanCham().padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                if (td.arrived) "Đã tới nơi" else "còn ${kc(td.remainingKm, donVi)}" + (td.etaHours?.let { " · ${TinhDuong.formatHoursVN(it)}" } ?: ""),
                style = Chu.nutPhu.copy(fontSize = 16.sp, color = Mau.navy), maxLines = 1,
            )
            Text(
                listOfNotNull(
                    if (!td.arrived && td.etaHours != null) "tới lúc ${gioToi(nowMs, td.etaHours!!)}" else if (!td.arrived) "tàu chưa chạy" else null,
                    tocDo,
                    td.dirVN.takeIf { it.isNotEmpty() }?.let { "hướng $it" },
                ).joinToString(" · "),
                style = Chu.phu.copy(fontSize = 13.sp), maxLines = 1,
            )
        }
        Box(
            Modifier.heightIn(min = CoSinh.HCtl.dp).clip(CircleShape).background(Mau.navy.copy(alpha = 0.1f)).clickable(onClick = dung).padding(horizontal = 16.dp, vertical = 10.dp),
            contentAlignment = Alignment.Center,
        ) { Text(vn.sdvico.forfish.shared.sinh.NhanSinh.nhan("dung"), style = Chu.nutPhu.copy(color = Mau.navy)) }
    }
}

/** `(x/1.852).toFixed(1).replace(".", ",").replace(/,0$/, "")` */
private object TheDiemSo {
    fun mot(x: Double) = vn.sdvico.forfish.shared.thoitiet.TheDiem.toFixed(x, 1).replace(".", ",").removeSuffix(",0")
}

/** Một chuyến đang dẫn trên màn: bộ máy + câu đã đọc. */
class ChuyenChay(val bo: BoChay, val tenDich: String)

/** Gắn bộ phát + bộ máy: mỗi nhịp đẩy câu, kêu chuông lệch tuyến. */
fun phatNhip(n: NhipChay, phat: PhatNgonAndroid, giong: GiongAndroid) {
    if (n.chuongLech) giong.keuChuong(false)
    phat.day(n.suKien)
}

/** Câu "đã thôi dẫn" sau khi tự dừng (= CAU_TU_DUNG, đọc như câu đáp). */
fun cauTuDung() = SuKienGiong("tudung", "tudung", MucCau.VANG, BoChay.CAU_TU_DUNG, reply = true)
