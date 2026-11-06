package vn.sdvico.forfish.shared.dangchay

import vn.sdvico.forfish.shared.bando.Js
import kotlin.math.max
import kotlin.math.min

/*
  GOM NGUỒN THÀNH SỰ KIỆN ĐỌC — PORT Y src/lib/nav-voice/events.ts (alertToEvent, collectVoiceEvents, VoiceMemory,
  DEPTH_ZONE_SPEECH + hằng). Mỗi nguồn đã có bộ não riêng; ở đây chỉ dịch kết quả thành [SuKienGiong] có key ổn định,
  nhớ thứ nguồn gốc cập nhật trong im lặng để chỉ nói khi mốc TIẾN LÊN. Câu hải đồ mang cờ `chart`.
*/

/** = VoiceMemory.zone */
data class NhoVungNuoc(val cand: Int?, val n: Int, val sinceMs: Double, val said: Int?, val saidMs: Double, val seq: Int)

/** = VoiceMemory */
data class NhoGiong(
    val borderMin: Double?,
    val borderEp: Int,
    val offMax: Double?,
    val offEp: Int,
    val seaEp: Int,
    val stormBand: Map<String, Int>,
    val seaMax: Int,
    val gpsEpisode: Int,
    val prevGps: TrangThaiGps,
    val legsSaid: Int,
    val arriveSaid: Boolean,
    val sapToiSaid: Boolean,
    val gpsYeu: Boolean,
    val gpsYeuEp: Int,
    val zone: NhoVungNuoc,
)

/** = VoiceSources.border — level "ok" | "near" | "very_near" */
data class RanhGioiNguon(val step: Double, val distanceNm: Double, val level: String)

/** = VoiceSources.offRoute — ben "trái" | "phải" | null */
data class LechTuyenNguon(val step: Double, val km: Double, val ben: String? = null, val huongVeDeg: Double? = null)

/** = VoiceSources */
data class NguonGiong(
    val nowMs: Double,
    val unit: DonViNoi,
    val alerts: List<CanhBaoChay>,
    val border: RanhGioiNguon?,
    val offRoute: LechTuyenNguon?,
    val coTuyen: Boolean = false,
    val gps: TrangThaiGps,
    val info: DongTin?,
    val storm: QuanSatBao?,
    val sea: QuanSatBien?,
    val depthHere: Int?,
    val moving: Boolean,
    val legsPassed: Int,
    val legsTotal: Int,
    val arrived: Boolean,
    val conLaiKm: Double? = null,
    val tocDoKmh: Double? = null,
    val saiSoM: Double? = null,
    val vung: List<VungSuKien> = emptyList(),
    val khucRe: KhucReBao? = null,
    val extra: List<SuKienGiong> = emptyList(),
)

object GomSuKien {
    const val GPS_YEU_M = 150.0
    const val GPS_TOT_M = 100.0
    const val SAP_TOI_PHUT = 10.0
    const val SAP_TOI_SAN_KM = 1.0
    const val DEPTH_ZONE_STABLE = 2
    const val DEPTH_ZONE_TIN_STABLE_MS = 60_000.0
    const val DEPTH_ZONE_GAP_MS = 5 * 60_000.0

    /** (câu, câu lần đầu, mức) theo lớp độ sâu 1..5 */
    val DEPTH_ZONE_SPEECH: Map<Int, Triple<String, String?, MucCau>> = mapOf(
        1 to Triple("Tàu đang đi trên vùng rạn đá. Dò kỹ đáy.", null, MucCau.VANG),
        2 to Triple("Tàu đang ở chỗ nước rất cạn, dưới 2 mét.", null, MucCau.VANG),
        3 to Triple("Tàu đang ở vùng nước cạn, 2 đến 4 mét.", null, MucCau.VANG),
        4 to Triple("Vào vùng nước 4 đến 12 mét.", "Tàu đang ở vùng nước 4 đến 12 mét.", MucCau.TIN),
        5 to Triple("Ra vùng nước sâu, trên 12 mét.", "Tàu đang ở vùng nước sâu, trên 12 mét.", MucCau.TIN),
    )

    fun initVoiceMemory() = NhoGiong(
        null, 0, null, 0, 0, emptyMap(), 0, 0, TrangThaiGps.IDLE, 0, false, false, false, 0,
        NhoVungNuoc(null, 0, 0.0, null, Double.NEGATIVE_INFINITY, 0),
    )

    private fun muc(m: String) = when (m) { "do" -> MucCau.DO; "vang" -> MucCau.VANG; else -> MucCau.TIN }

    /** = alertToEvent — đỏ tính mạng cũng được nhắc lại. */
    fun alertToEvent(a: CanhBaoChay) = SuKienGiong(
        key = "hz:${a.id}:${a.muc}", group = "hz:${a.id}", tier = muc(a.muc), text = CauNoi.toSpeechVN(a.cau),
        chart = true, persist = a.muc == "do" && a.bac == 1, rank = a.bac,
    )

    private fun soKhoa(x: Double) = Js.inSo(x)

    /** = collectVoiceEvents */
    fun collectVoiceEvents(prev: NhoGiong, src: NguonGiong): Pair<NhoGiong, List<SuKienGiong>> {
        var m = prev
        val stormBand = LinkedHashMap(prev.stormBand)
        var zone = prev.zone
        val out = mutableListOf<SuKienGiong>()

        // 1. hiểm hoạ phía trước
        for (a in src.alerts) out += alertToEvent(a)

        // 2. vùng nước dưới tàu
        val z = src.depthHere
        if (z == null || z == 0 || !src.moving) {
            zone = zone.copy(cand = null, n = 0)
        } else {
            zone = if (z == zone.cand) zone.copy(n = zone.n + 1) else zone.copy(cand = z, n = 1, sinceMs = src.nowMs)
            val sp = DEPTH_ZONE_SPEECH[z]
            val first = zone.said == null
            if (sp != null && z != zone.said && zone.n >= DEPTH_ZONE_STABLE) {
                val canh = sp.third != MucCau.TIN
                val shallower = first || z < zone.said!!
                val ok = if (canh) shallower || src.nowMs - zone.saidMs >= DEPTH_ZONE_GAP_MS
                else first || (src.nowMs - zone.sinceMs >= DEPTH_ZONE_TIN_STABLE_MS && src.nowMs - zone.saidMs >= DEPTH_ZONE_GAP_MS)
                if (ok) {
                    zone = zone.copy(said = z, saidMs = src.nowMs, seq = zone.seq + 1)
                    out += SuKienGiong("zone:${zone.seq}:$z", "zone", sp.third, if (first && sp.second != null) sp.second!! else sp.first, chart = true, rank = 6)
                }
            }
        }

        // 3. ranh giới — chỉ tiến sang mốc GẦN hơn; ≤ 6 hl = đỏ còn hiệu lực
        val b = src.border
        if (b == null || b.level == "ok") {
            if (m.borderMin != null) m = m.copy(borderEp = m.borderEp + 1)
            m = m.copy(borderMin = null)
        } else {
            val bm = m.borderMin?.let { min(it, b.step) } ?: b.step
            m = m.copy(borderMin = bm)
            val red = b.level == "very_near"
            val d = b.distanceNm
            out += SuKienGiong(
                "border:${m.borderEp}:${soKhoa(bm)}", "border", if (red) MucCau.DO else MucCau.VANG,
                "Còn chừng ${if (red) CauNoi.numVN(d, 1) else Js.inSo(Js.round(d))} hải lý tới ranh giới. Giữ khoảng cách.",
                persist = red, rank = 2,
            )
        }

        // 4. bão — gần thêm mỗi 50 km mới nói lại
        val st = src.storm
        if (st != null) {
            val band = min(stormBand[st.id] ?: Int.MAX_VALUE, st.band)
            stormBand[st.id] = band
            out += SuKienGiong("storm:${st.id}:$band", "storm:${st.id}", if (st.near) MucCau.DO else MucCau.VANG, st.text, persist = st.near, rank = 3)
        }

        // 5. sóng gió — mức tăng mới nói
        val sea = src.sea
        if (sea == null || sea.level == 0) {
            if (m.seaMax > 0) m = m.copy(seaEp = m.seaEp + 1)
            m = m.copy(seaMax = 0)
        } else if (!sea.warn.isNullOrEmpty()) {
            m = m.copy(seaMax = max(m.seaMax, sea.level))
            out += SuKienGiong("sea:${m.seaEp}:${m.seaMax}", "sea", MucCau.VANG, sea.warn, rank = 4)
        }

        // 6. lệch tuyến — chỉ khi lệch XA hơn
        val off = src.offRoute
        if (off == null) {
            if (m.offMax != null && src.coTuyen && src.gps == TrangThaiGps.TRACKING) {
                out += SuKienGiong("off:ve:${m.offEp}", "off", MucCau.TIN, "Tàu đã về lại đường đã vẽ.", rank = 7)
            }
            if (m.offMax != null) m = m.copy(offEp = m.offEp + 1)
            m = m.copy(offMax = null)
        } else {
            val om = m.offMax?.let { max(it, off.step) } ?: off.step
            m = m.copy(offMax = om)
            val them = if (!off.ben.isNullOrEmpty() && off.huongVeDeg != null) " Đi về phía ${CauNoi.dirSpeech(off.huongVeDeg)}, bên ${off.ben} tàu." else ""
            out += SuKienGiong(
                "off:${m.offEp}:${soKhoa(om)}", "off", MucCau.VANG,
                "Đang đi khác đường đã vẽ chừng ${CauNoi.distSpeech(off.km, src.unit)}.$them", rank = 7,
            )
        }

        // 7. GPS — mất một lần nói một lần, có lại nói một lần
        if (src.gps == TrangThaiGps.LOST && m.prevGps != TrangThaiGps.LOST) m = m.copy(gpsEpisode = m.gpsEpisode + 1)
        when {
            src.gps == TrangThaiGps.LOST ->
                out += SuKienGiong("gps:lost:${m.gpsEpisode}", "gps", MucCau.VANG, "Mất định vị. Máy đang tìm lại.", rank = 5)
            src.gps == TrangThaiGps.DENIED ->
                out += SuKienGiong("gps:denied", "gps", MucCau.VANG, "Máy chưa bật định vị. Bật định vị rồi mở lại.", rank = 5)
            src.gps == TrangThaiGps.TRACKING && m.prevGps == TrangThaiGps.LOST ->
                out += SuKienGiong("gps:back:${m.gpsEpisode}", "gps", MucCau.TIN, "Đã có định vị lại.", rank = 5)
        }
        m = m.copy(prevGps = src.gps)
        val ss = src.saiSoM
        if (src.gps == TrangThaiGps.TRACKING && ss != null && ss.isFinite()) {
            if (!m.gpsYeu && ss > GPS_YEU_M) {
                m = m.copy(gpsYeu = true, gpsYeuEp = m.gpsYeuEp + 1)
                out += SuKienGiong(
                    "gps:yeu:${m.gpsYeuEp}", "gps", MucCau.VANG,
                    CauNoi.toSpeechVN("Định vị lệch ±${Js.inSo(Js.round(ss / 10) * 10)} m. Chỉ tham khảo."), rank = 5,
                )
            } else if (m.gpsYeu && ss < GPS_TOT_M) m = m.copy(gpsYeu = false)
        }

        // 8. chỗ ghé / đích
        if (src.legsTotal >= 2 && src.legsPassed > m.legsSaid && src.legsPassed < src.legsTotal) {
            m = m.copy(legsSaid = src.legsPassed)
            out += SuKienGiong("stop:${src.legsPassed}", "stop", MucCau.VANG, "Đã tới chỗ ghé số ${src.legsPassed}.", rank = 8)
        }
        val conLai = src.conLaiKm
        if (conLai == null || !conLai.isFinite()) m = m.copy(sapToiSaid = false)
        else {
            val moc = KhucReChay.nguongKm(SAP_TOI_PHUT, SAP_TOI_SAN_KM, src.tocDoKmh)
            if (!src.arrived && !m.sapToiSaid && conLai <= moc) {
                m = m.copy(sapToiSaid = true)
                out += SuKienGiong(
                    "saptoi:${Js.inSo(Js.round(moc * 10))}:${src.legsTotal}", "stop", MucCau.TIN,
                    "Còn chừng ${CauNoi.distSpeech(conLai, src.unit)} tới điểm đến.", rank = 8,
                )
            } else if (conLai > moc * 2) m = m.copy(sapToiSaid = false)
        }
        if (src.arrived && !m.arriveSaid) {
            m = m.copy(arriveSaid = true)
            out += SuKienGiong("arrive", "stop", MucCau.VANG, "Đã tới gần điểm đến.", rank = 8)
        } else if (!src.arrived) m = m.copy(arriveSaid = false)

        // 8b. vào / ra vùng
        for (e in src.vung) {
            val text = VungChay.cauVung(e) ?: continue
            out += SuKienGiong("vung:${e.loai}:${e.id}:${e.lan}", "vung:${e.id}", if (e.loai == "vao") MucCau.VANG else MucCau.TIN, text, chart = true, rank = 6)
        }

        // 8c. khúc rẽ — còn xa (tin) rồi tới nơi (vàng)
        src.khucRe?.let { out += SuKienGiong(it.key, "re", if (it.step == 2) MucCau.VANG else MucCau.TIN, it.text, rank = 7) }

        // 9. tin hải đồ: phao kế tiếp / đèn biển
        src.info?.let { out += SuKienGiong("info:${it.id}", "info", MucCau.TIN, CauNoi.toSpeechVN(it.cau), chart = true, rank = 9) }

        out += src.extra
        return m.copy(stormBand = stormBand, zone = zone) to out
    }
}
