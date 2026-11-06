package vn.sdvico.forfish.shared.danduong

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import vn.sdvico.forfish.shared.bando.Js
import kotlin.math.floor

/*
  ĐỘ SÂU CHO DẪN ĐƯỜNG — port y `src/lib/depth-grid.ts` (lưới 6 lớp 4 bit/ô, bước 15", file `depth-grid.v1.bin`) và
  `src/lib/reef-depth.ts` (file `RDP1` độ sâu rạn Hoàng Sa/Trường Sa, chỉ mục ô 0,05°, ngưỡng chặn).
  File hỏng ⇒ NÉM (chỗ gọi rơi về "chưa kiểm độ sâu" — y web, không đọc sai mà không ai biết).
*/

/** = DepthGrid. `data` = nguyên file (2 ô/byte, ô chẵn 4 bit thấp). */
class LuoiDoSau(val data: ByteArray) {
    companion object {
        private const val STEP = 1.0 / 240
        const val LAT0 = 5 + STEP / 2
        const val LON0 = 102 + STEP / 2
        const val N_LAT = 4441
        const val N_LON = 3841
        /** = DEPTH_GRID_BYTES */
        const val SO_BYTE = (N_LAT * N_LON + 1) / 2
        /** = DEPTH_CLASS_DEEP */
        const val LOP_SAU = 5

        /** = decodeDepthGrid: sai cỡ ⇒ ném. */
        fun giai(buf: ByteArray): LuoiDoSau {
            require(buf.size == SO_BYTE) { "depth grid sai cỡ: ${buf.size} ≠ $SO_BYTE" }
            return LuoiDoSau(buf)
        }

        /** = DEPTH_CLASS_LABEL */
        val NHAN = mapOf(
            0 to "Trên bờ", 1 to "Rạn, đá ngầm, xác tàu — tránh xa", 2 to "Rất cạn, chưa tới 2 m nước",
            3 to "Cạn, cỡ 2–4 m nước", 4 to "Nước nông, cỡ 4–12 m", 5 to "Nước đủ sâu, trên 12 m",
        )

        /** = DEPTH_CLASS_MIN_M */
        val SAN_M: Map<Int, Double?> = mapOf(0 to null, 1 to null, 2 to 0.0, 3 to 2.0, 4 to 4.0, 5 to 12.0)
    }

    /** = depthClassAt: 0 đất · 1 mặt nạ rạn · 2 <2 m · 3 2–4 m · 4 4–12 m · 5 đủ sâu; null = ngoài lưới / số lạ. */
    fun lop(lat: Double, lon: Double): Int? {
        val i = Js.round((lat - LAT0) / STEP)
        val j = Js.round((lon - LON0) / STEP)
        if (!(i >= 0 && i < N_LAT && j >= 0 && j < N_LON)) return null
        val k = i.toLong() * N_LON + j.toLong()
        val v = ((data[(k shr 1).toInt()].toInt() and 0xff) shr ((k and 1).toInt() * 4)) and 15
        return if (v <= LOP_SAU) v else null
    }
}

/** = ReefDepthFeature */
class RanCoSo(
    val ten: String, val nhom: String, val nguon: String,
    val lat0: Double, val lon0: Double, val dLat: Double, val dLon: Double, val nLat: Int, val nLon: Int,
    val nongNhatM: Double?, val trungViM: Double?,
    /** 0–253 = 0,0–25,3 m · 254 = sâu hơn 25,3 m · 255 = không số; hàng theo vĩ độ TĂNG */
    val grid: ByteArray,
)

/** = ReefDepth */
class DoSauRan(val sinh: String, val datum: String, val credit: List<String>, val features: List<RanCoSo>) {
    companion object {
        const val DU_PHONG_SDB_M = 1.0
        const val RONG_XA_BO_M = 0.8
        const val CAN_KHI_CHUA_KHAI_MON_M = 4.0
        private const val O_DEG = 0.05

        /** = decodeReefDepth (RDP1): méo ⇒ ném. */
        fun giai(u8: ByteArray): DoSauRan {
            require(u8.size >= 8 && u8.copyOfRange(0, 4).decodeToString() == "RDP1") { "reef-depth: sai định dạng" }
            val b = { i: Int -> u8[i].toInt() and 0xff }
            val headLen = b(4) or (b(5) shl 8) or (b(6) shl 16) or (b(7) shl 24)
            require(headLen > 0 && 8 + headLen <= u8.size) { "reef-depth: đầu file hỏng" }
            val head = Json.parseToJsonElement(u8.copyOfRange(8, 8 + headLen).decodeToString()) as? JsonObject
            val feats = head?.get("features") as? JsonArray
            require(head != null && Js.so(head["v"]) == 1.0 && feats != null) { "reef-depth: sai phiên bản" }
            val bodyOff = 8 + headLen
            val bodyLen = u8.size - bodyOff
            val features = feats!!.map { fe ->
                val f = fe as? JsonObject ?: JsonObject(emptyMap())
                val nLat = Js.Number(f["nLat"]); val nLon = Js.Number(f["nLon"])
                val off = Js.Number(f["off"]); val len = Js.Number(f["len"])
                require(nLat > 0 && nLon > 0 && off >= 0 && len > 0 && off + len <= bodyLen) { "reef-depth: thực thể hỏng ${Js.chuoiHoa(f["ten"])}" }
                val grid = ByteArray((nLat * nLon).toInt())
                var k = 0
                var i = bodyOff + off.toInt()
                val het = i + len.toInt()
                while (i < het) {
                    val v = b(i++)
                    if (v != 255) { grid[k++] = v.toByte(); continue }
                    var n = 0; var sh = 0
                    do { val c = b(i++); n = n or ((c and 0x7f) shl sh); sh += 7 } while (c and 0x80 != 0)
                    grid.fill(255.toByte(), k, k + n); k += n
                }
                require(k == grid.size) { "reef-depth: lưới lệch cỡ ${Js.chuoiHoa(f["ten"])}" }
                fun soHoacNull(e: JsonElement?) = if (e == null || e is JsonNull) null else Js.Number(e)
                RanCoSo(
                    Js.chuoiHoa(f["ten"]), Js.chuoiHoa(f["nhom"]), Js.chuoiHoa(f["nguon"]),
                    Js.Number(f["lat0"]), Js.Number(f["lon0"]), Js.Number(f["dLat"]), Js.Number(f["dLon"]), nLat.toInt(), nLon.toInt(),
                    soHoacNull(f["nongNhatM"]), soHoacNull(f["trungViM"]), grid,
                )
            }
            val credit = (head["credit"] as? JsonArray)?.map { Js.chuoiHoa(it) } ?: emptyList()
            return DoSauRan(Js.chuoiHoa(head["sinh"]), Js.chuoiHoa(head["datum"]), credit, features)
        }

        /** = oSangMet */
        fun oSangMet(b: Int): Double? = if (b == 255) null else if (b == 254) 25.4 else b / 10.0

        /** = nguongChanRanM */
        fun nguongChanRanM(draftM: Double?, waveM: Double?, speedKn: Double? = null): Double {
            val can = HiemHoa.requiredDepthM(draftM, waveM, speedKn) ?: CAN_KHI_CHUA_KHAI_MON_M
            return Js.round((can + DU_PHONG_SDB_M + RONG_XA_BO_M) * 100) / 100
        }

        private fun oKey(lat: Double, lon: Double): Long = floor(lat / O_DEG).toLong() * 100000 + floor(lon / O_DEG).toLong()
    }

    /** = reefDepthInBBox */
    fun trongKhung(k: Khung) = DoSauRan(sinh, datum, credit, features.filter { f ->
        f.lat0 <= k.latMax && f.lat0 + f.dLat * f.nLat >= k.latMin && f.lon0 <= k.lonMax && f.lon0 + f.dLon * f.nLon >= k.lonMin
    })

    /** = ReefDepthIndex (buildReefDepthIndex) */
    class ChiMucRan(val rd: DoSauRan) {
        internal val o = HashMap<Long, MutableList<Int>>()

        init {
            rd.features.forEachIndexed { idx, f ->
                val la1 = f.lat0 + f.dLat * f.nLat
                val lo1 = f.lon0 + f.dLon * f.nLon
                var la = floor(f.lat0 / O_DEG).toLong()
                while (la <= floor(la1 / O_DEG).toLong()) {
                    var lo = floor(f.lon0 / O_DEG).toLong()
                    while (lo <= floor(lo1 / O_DEG).toLong()) {
                        o.getOrPut(la * 100000 + lo) { mutableListOf() } += idx
                        lo++
                    }
                    la++
                }
            }
        }

        /** = reefDepthAtM: nông nhất (m, mực TB) tại điểm; null = không thực thể nào có số. */
        fun sauTai(lat: Double, lon: Double): Double? {
            val ds = o[oKey(lat, lon)] ?: return null
            var best: Double? = null
            for (idx in ds) {
                val f = rd.features[idx]
                val i = floor((lat - f.lat0) / f.dLat)
                val j = floor((lon - f.lon0) / f.dLon)
                if (i < 0 || i >= f.nLat || j < 0 || j >= f.nLon) continue
                val m = oSangMet(f.grid[i.toInt() * f.nLon + j.toInt()].toInt() and 0xff)
                if (m != null && (best == null || m < best)) best = m
            }
            return best
        }

        /** = reefAt */
        fun ranTai(lat: Double, lon: Double): RanCoSo? {
            val ds = o[oKey(lat, lon)] ?: return null
            for (idx in ds) {
                val f = rd.features[idx]
                val i = floor((lat - f.lat0) / f.dLat)
                val j = floor((lon - f.lon0) / f.dLon)
                if (i >= 0 && i < f.nLat && j >= 0 && j < f.nLon && (f.grid[i.toInt() * f.nLon + j.toInt()].toInt() and 0xff) != 255) return f
            }
            return null
        }
    }
}
