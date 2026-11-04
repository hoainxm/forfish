package vn.sdvico.forfish.shared.dangchay

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import vn.sdvico.forfish.shared.kho.KhoMay

/*
  BỘ PHÁT NGÔN — PORT Y src/lib/nav-voice/announcer.ts (announce, pump, finished, acknowledge, muteFor, unmute,
  priority, allowed + hằng) và prefs.ts (khoá `forfish.nav.voice.v1`, thiếu/hỏng = đọc đầy đủ) + nấc nút Giọng của
  use-nav-voice (đầy đủ → ít → im 30 phút → đầy đủ). Thuần: không âm thanh, không đồng hồ — nền gọi `announce` khi có
  sự kiện, `finished` khi câu đọc xong, `pump` khi hết `waitMs`.
  Luật: một câu một lúc · đỏ cắt ngang câu không-đỏ · hải đồ trước cùng mức · mỗi key một lần (nhớ 30 phút) · câu
  không-đỏ cách nhau 8 s · hàng chờ ≤ 2 · đỏ còn hiệu lực nhắc lại 30 s, ≤ 2 lần · bị chặn vẫn đánh dấu đã nói.
*/

/** = VoiceTier */
enum class MucCau(val ma: String) { DO("do"), VANG("vang"), BANTIN("bantin"), TIN("tin") }

/** = VoiceMode */
enum class CheDoGiong(val ma: String) { DAY_DU("day-du"), IT("it"), TAT("tat") }

/** = VoiceLevel (nấc nút Giọng trên HUD) */
enum class NacGiong(val ma: String) { DAY_DU("day-du"), IT("it"), IM30("im30"), TAT("tat") }

/** = VoiceEvent */
data class SuKienGiong(
    val key: String,
    val group: String,
    val tier: MucCau,
    val text: String,
    val chart: Boolean = false,
    val persist: Boolean = false,
    val rank: Int? = null,
    val reply: Boolean = false,
)

/** = Utterance */
data class CauDoc(val ev: SuKienGiong, val queuedMs: Double, val repeat: Int) {
    val key get() = ev.key
    val group get() = ev.group
    val tier get() = ev.tier
    val text get() = ev.text
}

data class LuotNhac(val lastMs: Double, val n: Int)

/** = AnnouncerState */
data class TrangThaiPhatNgon(
    val said: Map<String, Double>,
    val repeats: Map<String, LuotNhac>,
    val acked: Set<String>,
    val queue: List<CauDoc>,
    val current: CauDoc?,
    val lastEndMs: Double,
    val lastAlarmMs: Double,
    val lastRed: Pair<String, Double>?,
    val mutedUntil: Double,
)

/** = AnnounceResult — start: câu đọc NGAY; interrupt: cắt câu đang đọc trước; waitMs: còn câu chờ nhịp 8 s. */
data class KetQuaPhat(val state: TrangThaiPhatNgon, val start: CauDoc?, val interrupt: Boolean, val waitMs: Double?)

/** = NavVoicePrefs */
data class CaiDatGiong(val muc: CheDoGiong = CheDoGiong.DAY_DU, val daXem: Boolean = false, val tuDoc: Boolean = true)

object BoPhatNgon {
    const val VOICE_GAP_MS = 8_000.0
    const val VOICE_STALE_MS = 20_000.0
    const val VOICE_QUEUE_MAX = 2
    const val VOICE_REPEAT_MS = 30_000.0
    const val VOICE_REPEAT_MAX = 2
    const val VOICE_FORGET_MS = 30 * 60_000.0
    const val VOICE_MUTE_MS = 30 * 60_000.0
    /** chuông kêu cùng lúc sự kiện — giọng vào sau ngần này (use-nav-voice CHIME_LEAD_MS) */
    const val CHIME_LEAD_MS = 700L

    fun initAnnouncer() = TrangThaiPhatNgon(
        emptyMap(), emptyMap(), emptySet(), emptyList(), null,
        Double.NEGATIVE_INFINITY, Double.NEGATIVE_INFINITY, null, Double.NEGATIVE_INFINITY,
    )

    /** Độ ưu tiên: nhỏ = trước. */
    fun priority(u: SuKienGiong): Double {
        if (u.reply && u.tier != MucCau.DO) return 1.5
        return when (u.tier) {
            MucCau.DO -> if (u.chart) 0.0 else 1.0
            MucCau.VANG -> if (u.chart) 2.0 else 3.0
            MucCau.BANTIN -> 4.0
            MucCau.TIN -> if (u.chart) 5.0 else 6.0
        }
    }

    private val thuTu = compareBy<CauDoc>({ priority(it.ev) }, { it.ev.rank ?: 5 }, { it.queuedMs })

    /** Chế độ có cho câu này ra loa không. */
    fun allowed(ev: SuKienGiong, mode: CheDoGiong, muted: Boolean): Boolean {
        if (ev.reply) return true
        if (mode == CheDoGiong.TAT) return false
        if (ev.chart && ev.tier != MucCau.TIN) return true
        if (muted) return ev.tier == MucCau.DO
        if (mode == CheDoGiong.IT) return ev.tier != MucCau.TIN
        return true
    }

    /** Đổ sự kiện mới vào; trả câu cần đọc ngay (nếu có). `prev` không bị sửa. */
    fun announce(prev: TrangThaiPhatNgon, events: List<SuKienGiong>, nowMs: Double, mode: CheDoGiong): KetQuaPhat {
        val said = LinkedHashMap(prev.said)
        val repeats = LinkedHashMap(prev.repeats)
        val acked = LinkedHashSet(prev.acked)
        val muted = nowMs < prev.mutedUntil
        val current = prev.current

        said.entries.removeAll { nowMs - it.value > VOICE_FORGET_MS }
        var queue = prev.queue.filter { u ->
            if (!allowed(u.ev, mode, muted)) false
            else if (u.tier == MucCau.BANTIN || current != null) true
            else nowMs - maxOf(u.queuedMs, prev.lastEndMs) <= VOICE_STALE_MS
        }.toMutableList()

        var enqueuedRed = false
        var enqueuedReply = false
        for (ev in events) {
            if (ev.key.isEmpty() || ev.text.isEmpty()) continue
            fun busy(g: String) = current?.group == g || queue.any { it.group == g }
            val da = said[ev.key]
            if (da != null) {
                if (ev.persist && ev.tier == MucCau.DO && ev.group !in acked && !busy(ev.group)) {
                    val r = repeats[ev.group] ?: LuotNhac(da, 0)
                    if (r.n < VOICE_REPEAT_MAX && nowMs - r.lastMs >= VOICE_REPEAT_MS) {
                        repeats[ev.group] = LuotNhac(nowMs, r.n + 1)
                        if (allowed(ev, mode, muted)) {
                            queue += CauDoc(ev, nowMs, r.n + 1)
                            enqueuedRed = true
                        }
                    }
                }
                continue
            }
            said[ev.key] = nowMs
            repeats[ev.group] = LuotNhac(nowMs, 0)
            acked -= ev.group
            queue = queue.filter { it.group != ev.group }.toMutableList()
            if (!allowed(ev, mode, muted)) continue
            queue += CauDoc(ev, nowMs, 0)
            if (ev.tier == MucCau.DO) enqueuedRed = true
            if (ev.reply) enqueuedReply = true
        }

        queue = queue.sortedWith(thuTu).toMutableList()
        while (queue.size > VOICE_QUEUE_MAX) {
            val drop = queue.indexOfLast { it.tier != MucCau.DO }
            if (drop < 0) break
            queue.removeAt(drop)
        }

        val s = TrangThaiPhatNgon(said, repeats, acked, queue, current, prev.lastEndMs, prev.lastAlarmMs, prev.lastRed, prev.mutedUntil)
        val head = queue.firstOrNull()
        if (enqueuedRed && current != null && head != null && head.tier == MucCau.DO && current.tier != MucCau.DO) {
            return KetQuaPhat(started(s.copy(queue = queue.drop(1)), head, nowMs), head, true, null)
        }
        if (enqueuedReply && current != null && head != null && head.ev.reply && (current.tier == MucCau.TIN || current.tier == MucCau.BANTIN)) {
            return KetQuaPhat(started(s.copy(queue = queue.drop(1)), head, nowMs), head, true, null)
        }
        return pump(s, nowMs)
    }

    private fun started(s: TrangThaiPhatNgon, u: CauDoc, nowMs: Double) = s.copy(
        current = u,
        lastAlarmMs = if (u.tier == MucCau.DO || u.tier == MucCau.VANG) nowMs else s.lastAlarmMs,
        lastRed = if (u.tier == MucCau.DO) u.text to nowMs else s.lastRed,
    )

    /** Không có câu đang đọc ⇒ lấy câu đầu hàng (tôn trọng nhịp 8 giây). */
    fun pump(prev: TrangThaiPhatNgon, nowMs: Double): KetQuaPhat {
        if (prev.current != null || prev.queue.isEmpty()) return KetQuaPhat(prev, null, false, null)
        val head = prev.queue[0]
        val since = nowMs - prev.lastEndMs
        if (head.tier != MucCau.DO && !head.ev.reply && since < VOICE_GAP_MS) return KetQuaPhat(prev, null, false, VOICE_GAP_MS - since)
        return KetQuaPhat(started(prev.copy(queue = prev.queue.drop(1)), head, nowMs), head, false, null)
    }

    /** Câu đang đọc đã xong (hoặc máy không đọc được) ⇒ sang câu kế. */
    fun finished(prev: TrangThaiPhatNgon, nowMs: Double) = pump(prev.copy(current = null, lastEndMs = nowMs), nowMs)

    /** "Đã nghe": thôi nhắc lại câu đỏ đang đọc / vừa đọc. */
    fun acknowledge(prev: TrangThaiPhatNgon, group: String?): TrangThaiPhatNgon {
        val g = group ?: prev.current?.group ?: return prev
        return prev.copy(acked = prev.acked + g)
    }

    /** "Im 30 phút" — đỏ và cảnh báo hải đồ vẫn đọc. */
    fun muteFor(prev: TrangThaiPhatNgon, nowMs: Double, ms: Double = VOICE_MUTE_MS) = prev.copy(mutedUntil = nowMs + ms)

    fun unmute(prev: TrangThaiPhatNgon) = prev.copy(mutedUntil = Double.NEGATIVE_INFINITY)

    /* ── prefs.ts ── */

    const val NAV_VOICE_KEY = "forfish.nav.voice.v1"
    val DEFAULT_VOICE_PREFS = CaiDatGiong()
    val VOICE_MODE_LABEL = mapOf(CheDoGiong.DAY_DU to "đầy đủ", CheDoGiong.IT to "ít", CheDoGiong.TAT to "tắt")

    /** = parseVoicePrefs: thiếu / hỏng ⇒ đọc đầy đủ, tự đọc BẬT. */
    fun parseVoicePrefs(raw: String?): CaiDatGiong {
        if (raw.isNullOrEmpty()) return DEFAULT_VOICE_PREFS
        val j = try { Json.parseToJsonElement(raw) } catch (_: Exception) { return DEFAULT_VOICE_PREFS }
        val o = j as? JsonObject
        fun chu(k: String) = (o?.get(k) as? JsonPrimitive)?.takeIf { it.isString }?.content
        fun bool(k: String) = (o?.get(k) as? JsonPrimitive)?.takeIf { !it.isString }?.booleanOrNull
        val muc = when (chu("muc")) { "it" -> CheDoGiong.IT; "tat" -> CheDoGiong.TAT; else -> CheDoGiong.DAY_DU }
        return CaiDatGiong(muc, bool("daXem") == true, bool("tuDoc") != false)
    }

    fun readVoicePrefs(kho: KhoMay): CaiDatGiong = try { parseVoicePrefs(kho.doc(NAV_VOICE_KEY)) } catch (_: Exception) { DEFAULT_VOICE_PREFS }

    /** Ghi không được thì lựa chọn chỉ sống tới khi đóng app — không phá gì. */
    fun writeVoicePrefs(kho: KhoMay, p: CaiDatGiong) {
        val s = "{\"muc\":\"${p.muc.ma}\",\"daXem\":${p.daXem},\"tuDoc\":${p.tuDoc}}"
        try { kho.ghi(NAV_VOICE_KEY, s) } catch (_: Exception) {}
    }

    /** Nấc đang hiện trên nút Giọng. */
    fun nac(muc: CheDoGiong, muted: Boolean): NacGiong = if (muted) NacGiong.IM30 else when (muc) {
        CheDoGiong.DAY_DU -> NacGiong.DAY_DU
        CheDoGiong.IT -> NacGiong.IT
        CheDoGiong.TAT -> NacGiong.TAT
    }

    /**
     * = cycleLevel của use-nav-voice: đầy đủ → ít → im 30 phút → đầy đủ; tắt → đầy đủ. Trả (mức mới, có im không,
     * trạng thái mới). Sang "im 30" mà câu đang đọc không đỏ, không hải đồ ⇒ bỏ câu đó (nền cắt tiếng: `catCau`).
     * Đổi mức (setMode) luôn gỡ im; sang "tắt" xoá hàng chờ.
     */
    fun cycleLevel(muc: CheDoGiong, muted: Boolean, st: TrangThaiPhatNgon, nowMs: Double): ChuyenNac {
        if (muted) return ChuyenNac(CheDoGiong.DAY_DU, false, unmute(st), false)
        return when (muc) {
            CheDoGiong.DAY_DU -> ChuyenNac(CheDoGiong.IT, false, unmute(st), false)
            CheDoGiong.IT -> {
                var s = muteFor(st, nowMs)
                val cur = s.current
                val cat = cur != null && cur.tier != MucCau.DO && !cur.ev.chart
                if (cat) s = s.copy(current = null)
                ChuyenNac(CheDoGiong.IT, true, s, cat)
            }
            CheDoGiong.TAT -> ChuyenNac(CheDoGiong.DAY_DU, false, unmute(st), false)
        }
    }

    /** = setMode: gỡ im; "tắt" ⇒ xoá câu đang đọc + hàng chờ (nền cắt tiếng). */
    fun setMode(m: CheDoGiong, st: TrangThaiPhatNgon): TrangThaiPhatNgon {
        val s = unmute(st)
        return if (m == CheDoGiong.TAT) s.copy(current = null, queue = emptyList()) else s
    }
}

/** Kết quả một lần chạm nút Giọng — `catCau` = nền phải cắt câu đang đọc. */
data class ChuyenNac(val muc: CheDoGiong, val muted: Boolean, val state: TrangThaiPhatNgon, val catCau: Boolean) {
    val nac get() = BoPhatNgon.nac(muc, muted)
}
