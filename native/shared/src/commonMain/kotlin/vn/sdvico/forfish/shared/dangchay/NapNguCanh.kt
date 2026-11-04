package vn.sdvico.forfish.shared.dangchay

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import vn.sdvico.forfish.shared.bando.HaiDo
import vn.sdvico.forfish.shared.bando.VungDiaDanh
import vn.sdvico.forfish.shared.bando.Js
import vn.sdvico.forfish.shared.danduong.BaoHieuTuyen
import vn.sdvico.forfish.shared.danduong.HiemHoa as HiemHoaTuyen

/*
  KHO HẢI ĐỒ ⇒ NGỮ CẢNH CANH ĐƯỜNG LÚC CHẠY (= khối nạp kho của fishing-map-view ~4170 + buildNavContext của
  nav-context.ts). Cầu "GHÉP SAU" giữa `danduong` (buildHazardList, giải seamarks/vn-aids/xác tàu/luồng) và `dangchay`
  (NguCanh.buildNavContext): vật cản điểm + vùng cấm vào từ danh sách hiểm hoạ, phao từ báo hiệu tuyến, đèn biển / khu
  trú bão / vùng quản lý từ bộ giải bản đồ (bando). Kho null = không có file ⇒ `missing`, không ném.
  Cổng khớp: native/scripts/sinh-ngu-canh.mjs chạy CHÍNH buildNavContext + evaluateNavHazards của web trên file thật.
*/
class KhoNguCanh(
    val xacTau: JsonElement? = null,
    val seaLanes: JsonElement? = null,
    val seamarks: JsonElement? = null,
    val vnAids: JsonElement? = null,
    val denBien: JsonElement? = null,
    val khuTruBao: JsonElement? = null,
    val vungQuanLy: JsonElement? = null,
)

object NapNguCanh {
    private fun phao(b: BaoHieuTuyen) = PhaoNav(b.lat, b.lon, b.type, b.colour, b.light?.colour, b.ten, b.tacDung)

    /** = decodeKhuTruBao (phần nav đọc): ten trim ≠ rỗng, tin lạ ⇒ "vua", coTauM số nguyên dương. */
    internal fun giaiKhu(raw: JsonElement?): List<KhuNav>? {
        val hang = (raw as? JsonObject)?.get("khu") as? JsonArray ?: return if (raw == null) null else emptyList()
        val ra = mutableListOf<KhuNav>()
        for (k in hang) {
            val o = k as? JsonObject ?: continue
            val lon = Js.so(o["lon"]) ?: continue
            val lat = Js.so(o["lat"]) ?: continue
            if (!(lat.isFinite() && lon.isFinite() && lat in 4.0..24.0 && lon in 102.0..118.0)) continue // = trongKhungBienVN
            val ten = Js.chuoi(o["ten"])?.let { Js.trim(it) } ?: ""
            if (ten.isEmpty()) continue
            val tinh = Js.chuoi(o["tinh"])?.let { Js.trim(it) } ?: ""
            val tin = Js.chuoi(o["tin"]).takeIf { it == "cao" || it == "vua" } ?: "vua"
            val coTau = (o["coTauM"] as? kotlinx.serialization.json.JsonPrimitive)?.takeIf { !it.isString }?.let { Js.so(it) }?.takeIf { it.isFinite() && it > 0 }?.let { Js.round(it).toDouble() }
            ra += KhuNav(lat, lon, ten, tinh, coTau, tin)
        }
        return ra
    }

    fun dung(kho: KhoNguCanh, draftM: Double?, namNay: Int): NguCanhChay {
        val needM = HiemHoaTuyen.requiredDepthM(draftM, null)
        val xac = kho.xacTau?.let { HiemHoaTuyen.giaiXacTau(it) }
        val lane = kho.seaLanes?.let { HiemHoaTuyen.giaiDacTrung(it) }
        val sm = kho.seamarks?.let { HiemHoaTuyen.giaiSeamarks(it) }
        val list = HiemHoaTuyen.buildHazardList(xac, lane, sm, needM, namNay)
        val vat = list.hazards.map { VatCan(it.id, it.lat, it.lon, it.rKm, it.loai, it.ten, it.doSauM, it.tinVua) }
        val noGo = list.noGo.map { z ->
            VungCamVao(z.id, z.ten, z.ring, KhungVung(z.bbox.latMin, z.bbox.latMax, z.bbox.lonMin, z.bbox.lonMax))
        }
        val vn = kho.vnAids?.let { HiemHoaTuyen.giaiVnAids(it) }
        val den = kho.denBien?.let { r -> HaiDo.giaiDenBien(r).map { DenNav(it.lat, it.lon, it.ten, it.tamNm) } }
        val vung = kho.vungQuanLy?.let { r ->
            VungDiaDanh.giaiVung(r).map { v ->
                VungQuanLyNav(
                    v.ma, v.loai, v.ten, v.trangThai,
                    v.polys?.map { poly -> poly.map { ring -> ring.mapNotNull { p -> (p as? JsonArray)?.let { doubleArrayOf(Js.so(it[0])!!, Js.so(it[1])!!) } } } },
                    v.mua.map { MuaCamChay(it.tuThang, it.tuNgay, it.denThang, it.denNgay) },
                )
            }
        }
        return NguCanh.buildNavContext(
            vat, noGo, list.missing,
            laneFeatures = (kho.seaLanes as? JsonObject)?.get("features") as? JsonArray,
            seamarks = sm?.map(::phao),
            vnAids = vn?.map(::phao),
            denBien = den,
            khuTruBao = giaiKhu(kho.khuTruBao),
            vungQuanLy = vung,
        )
    }
}
