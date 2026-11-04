package vn.sdvico.forfish.shared.dangchay

import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.thoitiet.TheDiem
import kotlin.math.abs

/*
  BỘ MÁY MỘT NHỊP "ĐANG CHẠY" — gom các effect theo nhịp GPS của fishing-map-view (~3625–4560) thành một hàm thuần để
  Android + iOS dùng chung và test được:
   · nhận fix (nhanFix lọc nhảy, locFix tốc độ/hướng), trạng thái GPS (fixQuaCu ⇒ lost; chưa fix ⇒ idle);
   · tiến độ (computeNavProgress, tốc độ ETA mượt 60 s, segHint đoạn trước), CHỐT "đã tới" theo tuyến (daToiCho);
   · lệch tuyến có VÙNG ĐỆM về (OFF_ROUTE_VE_KM 1,5) + mốc vượt ⇒ chuông; thu gọn được;
   · khúc rẽ hai nhịp (im khi lệch / mất định vị / đã tới);
   · hiểm hoạ (evaluateNavHazards) TIẾT CHẾ ≥2 s HOẶC dời ≥30 m HOẶC xoay ≥15°; mất GPS thì nhịp đồng hồ vẫn gọi;
     GIỮ dòng cảnh báo 30 s (đỏ 75 s); phao 10 s / đèn 30 s; vùng nước dưới tàu; vào/ra vùng (chỉ khi tracking);
   · gom sự kiện giọng (collectVoiceEvents) — câu mở đầu `cauBatDau` một lần lúc bắt đầu;
   · tới nơi + đứng yên 5 phút ⇒ `tuDung` (màn dọn chuyến như bấm Xong rồi đọc CAU_TU_DUNG).
  Không có ở đây (việc nền tảng): GPS thật, giữ sáng màn, phát tiếng/chuông/rung, camera.
  KHÁC WEB (nợ): ranh giới IUU (borderProximity) chưa port ⇒ border = null; bão/biển lúc chạy (QuanSatBao/QuanSatBien)
  chưa nối ⇒ null; một đích (legsTotal = 1) — nâng khi có nhiều điểm ghé.
*/

/** Dòng lệch tuyến đang hiện (= navOffRoute). */
data class LechTuyenHud(val step: Double, val km: Double, val dismissed: Boolean, val ben: String?, val huongVeDeg: Double?)

/** Kết quả một nhịp — đủ để vẽ HUD + đẩy câu vào bộ phát ngôn. */
data class NhipChay(
    val pos: ViTri?,
    val gps: TrangThaiGps,
    val speedKmh: Double?,
    val headingDeg: Double?,
    val accuracyM: Double?,
    val tienDo: TienDoChay?,
    val khucRe: KhucRe?,
    val lech: LechTuyenHud?,
    val canhBao: List<CanhBaoChay>,
    val hud: List<DongHud>,
    val vung: List<VungTrong>,
    val suKien: List<SuKienGiong>,
    /** có câu cảnh báo vừa vượt mốc cần chuông (urgent = đỏ) — null = im */
    val chuong: Boolean?,
    val rung: Boolean,
    /** lệch tuyến vừa vượt mốc ⇒ chuông lệch tuyến */
    val chuongLech: Boolean,
    /** tới nơi + đứng yên ≥ TOI_DUNG_YEN_MS ⇒ màn tự thôi dẫn */
    val tuDung: Boolean,
)

class BoChay(
    private val waypoints: List<ViTri>,
    /** tổng quãng + giờ của tuyến (câu mở đầu khi chưa có vị trí) */
    private val distKm: Double,
    private val hours: Double,
    private val ctx: NguCanhChay?,
    /** lớp độ sâu tại chỗ (LuoiDoSau.lop) — null = chưa có lưới */
    private val doSau: ((Double, Double) -> Int?)?,
    private val draftM: Double?,
    /** "nm" | "km" */
    private val donVi: String,
) {
    companion object {
        const val OFF_ROUTE_VE_KM = 1.5
        const val TOI_DUNG_YEN_MS = 5 * 60_000L
        const val NAV_ALERT_HOLD_MS = 30_000L
        const val NAV_ALERT_HOLD_DO_MS = 75_000L
        const val CAU_TU_DUNG = "Đã tới gần điểm đến. Đã dừng dẫn đường."

        /** = fmtDist(km, unit, km < 10 ? 1 : 0) (navFmtDist) */
        fun fmtNav(km: Double, donVi: String): String {
            val v = if (donVi == "km") km else km / 1.852
            return "${TheDiem.formatNumberVN(v, if (km < 10) 1 else 0)} ${if (donVi == "km") "km" else "hải lý"}"
        }
    }

    private val unit = if (donVi == "km") DonViNoi.KM else DonViNoi.NM
    private val fmt: (Double) -> String = { fmtNav(it, donVi) }
    private val needM = vn.sdvico.forfish.shared.danduong.HiemHoa.requiredDepthM(draftM, null)

    private var loc: LocState? = null
    private var speedKmh: Double? = null
    private var accuracyM: Double? = null
    private var lastFixAt: Long? = null
    private var boLien = 0
    private var eta: TocDoMuot? = null
    private var seg = 0
    private var daToi = false
    private var toiDungTu: Long? = null

    private var lechStep: Double? = null
    private var lech: LechTuyenHud? = null
    private var khucNho: KhucReNho? = null
    private var khucSeq = 0

    private var hz = HiemHoa.initNavHazardState()
    private var evMs = Long.MIN_VALUE / 2
    private var evPos: ViTri? = null
    private var evHdg: Double? = null
    private var phaoMs = Long.MIN_VALUE / 2
    private var denMs = Long.MIN_VALUE / 2
    private var den: DongTin? = null
    private var info: DongTin? = null
    private var depthHere: Int? = null
    private var alerts: List<CanhBaoChay> = emptyList()
    private var alertsAt = Long.MIN_VALUE / 2
    private var alertsDo = false
    private var vungSt = VungChay.initVungTheoDoi()

    private var vungSu: List<VungSuKien> = emptyList()
    private var mem = GomSuKien.initVoiceMemory()
    /** nguồn giọng lượt trước (nowMs = 0) — web gom lại CHỈ khi deps của effect đổi */
    private var nguonCu: NguonGiong? = null
    private var moDau = false

    /** Một fix GPS mới (Android Location / iOS CLLocation). false = bị lọc (nhảy / sai số quá lớn). */
    fun fix(f: LocIn): Boolean {
        val (nhan, bo) = DinhVi.nhanFix(loc?.pos, loc?.t ?: 0, f.pos, f.t, f.accuracyM, boLien)
        boLien = bo
        if (!nhan) return false
        val r = DinhVi.locFix(loc, f)
        loc = r.state
        speedKmh = r.speedKmh
        accuracyM = f.accuracyM
        lastFixAt = f.t
        eta = DinhVi.tocDoMuot(eta, r.speedKmh, f.t)
        return true
    }

    fun boQuaLech() { lech = lech?.copy(dismissed = true) }

    /** Gọi sau mỗi fix VÀ theo nhịp đồng hồ (≤ 30 s) để trạng thái mất GPS / hạn giữ dòng cảnh báo tự tới. */
    fun nhip(now: Long): NhipChay {
        val p = loc?.pos
        val gps = when {
            p == null -> TrangThaiGps.IDLE
            DinhVi.fixQuaCu(lastFixAt, speedKmh, now) -> TrangThaiGps.LOST
            else -> TrangThaiGps.TRACKING
        }
        val su = mutableListOf<SuKienGiong>()
        val hdg = loc?.headingDeg

        // tiến độ + chốt đã tới
        var td = if (p == null) null else TienDo.computeNavProgress(p, hdg, eta?.kmh, waypoints, seg)
        if (td != null) {
            seg = td.segIdx
            if (td.arrived) daToi = true
            if (daToi && !td.arrived) td = td.copy(arrived = true)
        }

        // câu mở đầu (một lần): quãng CÒN LẠI thật nếu có vị trí
        if (!moDau) {
            moDau = true
            val tien = p?.let { TienDo.computeNavProgress(it, null, null, waypoints) }
            if (tien?.arrived != true) {
                val conKm = tien?.remainingKm ?: distKm
                val conGio = if (distKm > 0) hours * conKm / distKm else hours
                val huong = tien?.bearingToNextDeg ?: if (waypoints.size >= 2) HinhHoc.bearingDeg(waypoints[0], waypoints[1]) else null
                su += SuKienGiong("batdau", "batdau", MucCau.VANG, CauNoi.cauBatDau(conKm, conGio, huong, unit), reply = true)
            }
        }

        // lệch tuyến (vùng đệm khi về)
        var chuongLech = false
        val off = td?.offRouteKm
        if (off == null) { lechStep = null; lech = null }
        else if (!(lechStep != null && off >= OFF_ROUTE_VE_KM && TienDo.offRouteStepFor(off) == null)) {
            val crossed = TienDo.offRouteStepCrossed(off, lechStep)
            val step = TienDo.offRouteStepFor(off)
            lechStep = step
            if (step == null) lech = null
            else if (crossed != null) { chuongLech = true; lech = LechTuyenHud(crossed, off, false, td!!.vachBen, td.huongVeVachDeg) }
            else lech = (lech ?: LechTuyenHud(step, off, false, td!!.vachBen, td.huongVeVachDeg)).copy(step = step, km = off, ben = td!!.vachBen, huongVeDeg = td.huongVeVachDeg)
        }

        // khúc rẽ
        var kr: KhucRe? = null
        var krBao: KhucReBao? = null
        if (td == null || td.arrived || td.offRoute || gps != TrangThaiGps.TRACKING) khucNho = null
        else {
            kr = KhucReChay.khucReKeTiep(waypoints, td.alongKm)
            val r = KhucReChay.baoKhucRe(khucNho, kr, speedKmh) { CauNoi.distSpeech(it, unit) }
            khucNho = r.first
            krBao = r.second?.let { it.copy(key = "re:${khucSeq}:${it.idx}:${it.step}") }
        }

        // hiểm hoạ (tiết chế)
        var chuong: Boolean? = null
        var rung = false
        if (p != null) {
            val moiM = evPos?.let { HinhHoc.haversineKm(it, p) * 1000 } ?: Double.POSITIVE_INFINITY
            val xoay = if (evHdg != null && hdg != null) abs(((hdg - evHdg!! + 540) % 360) - 180) else if (hdg != null) 999.0 else 0.0
            val tietChe = now - evMs < 2000 && moiM < 30 && xoay < 15
            if (!tietChe || gps != TrangThaiGps.TRACKING) {
                val (moi, st) = HiemHoa.evaluateNavHazards(
                    hz,
                    DauVaoHiemHoa(
                        p, hdg, speedKmh, accuracyM, now.toDouble(), draftM, needM, gps, ctx?.hazards, ctx?.noGo, doSau,
                        NguCanh.cableKmAt(ctx, p), NguCanh.restrictedAt(ctx, p, now.toDouble()), null, fmt,
                    ),
                )
                hz = st
                if (gps == TrangThaiGps.TRACKING) {
                    val v = VungChay.theoDoiVung(vungSt, VungChay.vungDangTrong(ctx?.noGo, ctx?.restricted, p, now.toDouble()))
                    vungSt = v.first
                    if (v.second.isNotEmpty()) vungSu = v.second
                }
                if (gps != TrangThaiGps.TRACKING) info = null
                else if (ctx != null && now - phaoMs >= 10_000) {
                    phaoMs = now
                    if (now - denMs >= 30_000) { denMs = now; den = NguCanh.denBienTin(ctx, p, fmt) }
                    info = NguCanh.phaoKeTiep(ctx, p, hdg, fmt) ?: den
                }
                depthHere = if (gps == TrangThaiGps.TRACKING && doSau != null) doSau.invoke(p.lat, p.lon) else null
                evMs = now; evPos = p; evHdg = hdg
                if (moi.isNotEmpty()) { alertsAt = now; alertsDo = moi.any { it.muc == "do" } }
                val tran = if (alertsDo) NAV_ALERT_HOLD_DO_MS else NAV_ALERT_HOLD_MS
                val giu = moi.isEmpty() && gps == TrangThaiGps.TRACKING && now - alertsAt < tran
                if (!giu) alerts = moi
                for (a in moi) {
                    if (a.chuong) chuong = (chuong == true) || a.muc == "do"
                    if (a.rung) rung = true
                }
            }
        }

        // tới nơi + đứng yên
        val moving = speedKmh != null && speedKmh!! >= DinhVi.MIN_MOVING_KMH
        val toiYen = td?.arrived == true && !moving
        if (!toiYen) toiDungTu = null else if (toiDungTu == null) toiDungTu = now
        val tuDung = toiDungTu?.let { now - it >= TOI_DUNG_YEN_MS } ?: false

        // giọng
        val nguon = NguonGiong(
            nowMs = 0.0, unit = unit, alerts = alerts,
            border = null,
            offRoute = lech?.let { LechTuyenNguon(it.step, it.km, it.ben, it.huongVeDeg) },
            coTuyen = true, gps = gps, info = info, storm = null, sea = null, depthHere = depthHere, moving = moving,
            legsPassed = 0, legsTotal = 1, arrived = td?.arrived ?: false,
            conLaiKm = td?.let { Js.round(it.remainingKm * 10) / 10 },
            tocDoKmh = speedKmh,
            saiSoM = accuracyM?.let { Js.round(it / 10) * 10 },
            vung = vungSu,
            khucRe = krBao,
        )
        if (nguon != nguonCu) {
            nguonCu = nguon
            val (m2, ev) = GomSuKien.collectVoiceEvents(mem, nguon.copy(nowMs = now.toDouble()))
            mem = m2
            su += ev
        }
        if (krBao != null) khucSeq++

        return NhipChay(
            p, gps, speedKmh, hdg, accuracyM, td, kr, lech, alerts,
            NguCanh.pickHudLines(alerts, false, info?.cau), vungSt.trong,
            su, chuong, rung, chuongLech, tuDung,
        )
    }
}
