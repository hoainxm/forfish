package vn.sdvico.forfish.shared.danduong

import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import vn.sdvico.forfish.shared.bando.TramConNuoc
import kotlin.math.max
import kotlin.math.min

/*
  DẪN ĐƯỜNG TRỌN MỘT LƯỢT BẤM "TÍNH ĐƯỜNG" — chép y khối `compute()` của src/components/route-planner.tsx (~727–1130):
  chặng < 5 km ⇒ báo; điểm ngoài khung VN_SEA ⇒ báo; khung nhỏ (margin 45–150 km) rồi khung rộng (200–420 km), MỘT
  trường thời tiết cho cả chuỗi điểm mỗi khung; hiểm hoạ lọc theo khung + đóng gói; từng chặng
  `planRouteWithDiagnostics` với giờ xuất phát cộng dồn (làm tròn); ghép `mergeLegPlans`; cổng bão (`stormGateForRoute`
  + `routeStormConflict` — chặn hẳn khi cắt vùng bão); hậu kiểm `auditRoute` trên ĐÚNG tuyến sẽ vẽ (sóng tại waypoint
  đọc cùng field); kèm câu cảnh báo (buildDangerItems/buildWillMeet/moTaThieu).
  Phần TỐN CPU chạy trên `nenTinh` (mặc định Dispatchers.Default) — không bao giờ khoá luồng giao diện.
  KHÔNG có ở đây (thuộc màn hình): chọn nơi xuất phát (GPS/cảng gần), kẹp ô nhập (TauMinh.tuForm), đường thẳng tham khảo
  `choVuongDuongThang` khi không ra tuyến, trần chờ kho 5 s (bên gọi tự chờ kho rồi đưa vào).
*/

/** Kho + nguồn cho một lượt tính. Kho null = không tải được (sẽ được gọi tên ở `chuaSoi`). */
class DauVaoDanDuong(
    val start: Diem,
    /** chuỗi điểm ghé theo thứ tự bà con chấm (điểm cuối = đích) */
    val stops: List<Diem>,
    val boat: TauMinh,
    /** epoch ms lúc bấm tính (giờ xuất phát) */
    val nowMs: Long,
    val depth: LuoiDoSau?,
    val xacTau: List<XacTau>? = null,
    val laneFeatures: List<DacTrung>? = null,
    val seamarks: List<BaoHieuTuyen>? = null,
    val soundings: List<SoDoSau>? = null,
    val verdicts: Map<String, String>? = null,
    val fairways: List<DoanLuongTuyen>? = null,
    val vnAids: List<BaoHieuTuyen>? = null,
    val reefs: List<DacTrung>? = null,
    val tides: List<TramConNuoc>? = null,
    val reefDepth: DoSauRan? = null,
    val stormStatus: TrangThaiBao = TrangThaiBao.DangHoi,
    val storms: List<BaoTuyen> = emptyList(),
    /** năm hiện tại (luật tin xác tàu > 3 năm) */
    val namNay: Int,
)

sealed class KetQuaDanDuong {
    /** chặng thứ `chang` (1-based) ngắn hơn 5 km */
    data class QuaGan(val chang: Int) : KetQuaDanDuong()
    /** điểm thứ `chiSo` (0 = nơi xuất phát) nằm ngoài khung máy tính được */
    data class NgoaiVung(val chiSo: Int) : KetQuaDanDuong()
    /** không ra tuyến ở chặng `chang` (1-based); `failure` "weather-coverage" | "no-route" */
    data class KhongRaTuyen(val chang: Int, val failure: String, val biTuChoi: Boolean, val biTuChoiNgay: Boolean) : KetQuaDanDuong()
    /** tuyến cắt vùng bão ⇒ KHÔNG vẽ */
    data class BaoChanTuyen(val conflict: BaoChan, val cong: CongBao) : KetQuaDanDuong()
    data class CoTuyen(
        val tuyen: TuyenGop,
        val legBoundsKm: List<Double>,
        val field: TruongThoiTiet,
        val cong: CongBao,
        val hits: List<VatTrenTuyen>,
        val missing: List<String>,
        val canhBao: List<MucCanhBao>,
        val seGap: List<String>,
        val chuaSoi: String?,
    ) : KetQuaDanDuong()
}

object DanDuong {
    /** = VN_SEA của route-planner */
    val VN_SEA = Khung(4.0, 24.5, 99.0, 119.0)

    fun clampBBox(b: Khung) = Khung(max(b.latMin, VN_SEA.latMin), min(b.latMax, VN_SEA.latMax), max(b.lonMin, VN_SEA.lonMin), min(b.lonMax, VN_SEA.lonMax))

    /** = margins của route-planner theo tổng quãng chuỗi điểm. */
    fun margins(dist: Double) = listOf(min(150.0, max(45.0, dist * 0.3)), min(420.0, max(200.0, dist * 1.1)))

    /**
     * Một lượt tính đường đầy đủ. `truongCho(bbox)` = lưới thời tiết cho khung (thường `NapThoiTietDuong.layHoacRong`)
     * — không được ném (tệ nhất là lưới rỗng ⇒ tuyến tính theo hải đồ).
     */
    suspend fun tinhDuong(
        dv: DauVaoDanDuong,
        truongCho: suspend (Khung) -> TruongThoiTiet,
        nenTinh: CoroutineDispatcher = Dispatchers.Default,
    ): KetQuaDanDuong {
        val legPts = listOf(dv.start) + dv.stops
        for (i in 1 until legPts.size) if (HinhHoc.haversineKm(legPts[i - 1], legPts[i]) < 5) return KetQuaDanDuong.QuaGan(i)
        val ngoai = legPts.indexOfFirst { it.lat < VN_SEA.latMin || it.lat > VN_SEA.latMax || it.lon < VN_SEA.lonMin || it.lon > VN_SEA.lonMax }
        if (ngoai >= 0) return KetQuaDanDuong.NgoaiVung(ngoai)

        val departHourIdx = TinhDuong.vnHourIndex(dv.nowMs)
        var dist = 0.0
        for (i in 1 until legPts.size) dist += HinhHoc.haversineKm(legPts[i - 1], legPts[i])
        val margins = margins(dist)
        val thieuDoSauRan = if (dv.reefDepth != null) emptyList() else listOf("do-sau-ran")
        val needM = HiemHoa.requiredDepthM(dv.boat.draftM, null)
        val kho = HiemHoa.buildHazardList(dv.xacTau, dv.laneFeatures, dv.seamarks, needM, dv.namNay)
        val soiHiemHoa = dv.xacTau != null || dv.laneFeatures != null || dv.seamarks != null

        var tuyen: TuyenGop? = null
        var chosenField: TruongThoiTiet? = null
        var failedLeg = 0
        var failure = "no-route"
        var biTuChoi = false
        var biTuChoiNgay = false
        for (m in margins) {
            val bbox = clampBBox(HinhHoc.bboxOfPoints(legPts, m))
            val field = truongCho(bbox)
            if (field.rateLimited == true) biTuChoi = true
            if (field.rateLimitDaily == true) biTuChoiNgay = true
            val hazards = if (soiHiemHoa) HiemHoa.packHazards(HiemHoa.hazardsInBBox(kho.hazards, bbox, 0.0)) else null
            val reefInBox = dv.reefDepth?.trongKhung(bbox)
            val legs = mutableListOf<KetQuaDuong>()
            var hoursSoFar = 0.0
            for (i in 1 until legPts.size) {
                val args = ThamSoTinh(
                    legPts[i - 1], legPts[i], dv.boat, departHourIdx + vn.sdvico.forfish.shared.bando.Js.round(hoursSoFar),
                    field, dv.depth, bbox, hazards, if (soiHiemHoa) kho.noGo else null, reefDepth = reefInBox,
                )
                val outcome = withContext(nenTinh) { TinhDuong.planRouteWithDiagnostics(args) }
                val leg = outcome.plan
                if (leg == null) {
                    failedLeg = i
                    failure = outcome.failure ?: "no-route"
                    break
                }
                legs += leg
                hoursSoFar += leg.hours
            }
            if (legs.size == legPts.size - 1) {
                val merged = ChangDuong.mergeLegPlans(legs)
                if (merged != null) {
                    tuyen = merged
                    chosenField = field
                    break
                }
            }
        }
        if (tuyen == null || chosenField == null) return KetQuaDanDuong.KhongRaTuyen(max(1, failedLeg), failure, biTuChoi, biTuChoiNgay)

        val cong = ChangDuong.stormGateForRoute(dv.stormStatus, dv.nowMs.toDouble())
        ChangDuong.routeStormConflict(tuyen.plan.waypoints, dv.storms)?.let { return KetQuaDanDuong.BaoChanTuyen(it, cong) }

        val plan = tuyen.plan
        val f = chosenField
        val (hits, missing) = try {
            val (h, m) = withContext(nenTinh) {
                HauKiem.auditRoute(
                    plan.waypoints, plan.hoursAt, dv.nowMs.toDouble(), dv.boat.draftM,
                    { i ->
                        plan.waypoints.getOrNull(i)?.let { wp ->
                            LuoiThoiTiet.sampleField(f, wp.lat, wp.lon, departHourIdx + (plan.hoursAt.getOrNull(i) ?: 0.0))
                                ?.let { it.waveM ?: vn.sdvico.forfish.shared.thoitiet.TheDiem.estimateWaveFromWind(it.windKmh) }
                        }
                    },
                    KhoHauKiem(
                        hazards = kho.hazards, passable = kho.passable, soundings = dv.soundings, verdicts = dv.verdicts,
                        fairways = dv.fairways, lanes = dv.laneFeatures, seamarks = dv.seamarks, vnAids = dv.vnAids,
                        reefs = dv.reefs, tides = dv.tides, border = true,
                    ),
                )
            }
            h to (kho.missing + m + thieuDoSauRan).distinct()
        } catch (e: kotlinx.coroutines.CancellationException) {
            throw e
        } catch (_: Exception) {
            emptyList<VatTrenTuyen>() to (kho.missing + HauKiem.KHO_HAU_KIEM + thieuDoSauRan).distinct()
        }
        return KetQuaDanDuong.CoTuyen(
            tuyen, ChangDuong.cumulativeKmAt(plan.waypoints, tuyen.stopWpIdx), f, cong, hits, missing,
            HauKiem.buildDangerItems(plan, hits), HauKiem.buildWillMeet(hits), HauKiem.moTaThieu(missing),
        )
    }
}
