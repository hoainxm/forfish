package vn.sdvico.forfish.shared.dulieu

import kotlin.io.encoding.Base64
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertSame

// Khớp từng byte với code web (vector sinh từ src/lib/data-codec.mjs — native/scripts/sinh-testdata.mjs).
class DataCodecTest {
    private fun b(s: String) = Base64.decode(s)
    private val G = GoldenDataCodec
    private val khoa = b(G.KHOA)
    private val layKhoa: (String) -> ByteArray? = { id -> if (id == G.KEY_ID_HEX) khoa else null }

    @Test fun bangHoanViKhopWeb() = assertEquals(G.ENC_TABLE_HEX, DataCodec.hexOf(DataCodec.ENC_TABLE))

    @Test fun sdf1MaVaGiaiKhopWeb() {
        assertContentEquals(b(G.SDF1), DataCodec.encodeData(b(G.RO)))
        assertContentEquals(b(G.RO), DataCodec.decodeData(b(G.SDF1)))
    }

    @Test fun banRoTraNguyen() {
        val ro = b(G.RO)
        assertSame(ro, DataCodec.decodeData(ro))
        assertSame(ro, DataCrypt.moFile(ro, layKhoa))
    }

    @Test fun keyIdKhopWeb() = assertEquals(G.KEY_ID_HEX, DataCrypt.keyIdOf(khoa))

    @Test fun boDemKhopWeb() = assertContentEquals(b(G.DEM_70000), DataCodec.counterAt(b(G.NONCE), 70000))

    @Test fun sdf2GzipGiaiDung() = assertContentEquals(b(G.RO), DataCrypt.moFile(b(G.SDF2_GZIP), layKhoa))

    @Test fun sdf2KhongGzipGiaiDung() = assertContentEquals(b(G.RO), DataCrypt.moFile(b(G.SDF2_THO), layKhoa))

    @Test fun latCatGiuaKhoiGiaiDung() =
        assertContentEquals(b(G.LAT_RO), DataCrypt.decryptAt(khoa, b(G.NONCE), b(G.LAT_MA), G.LAT_TU.toLong()))

    @Test fun thieuKhoaNemKhongCoKhoa() {
        val e = assertFailsWith<KhongCoKhoa> { DataCrypt.moFile(b(G.SDF2_GZIP)) { null } }
        assertEquals(G.KEY_ID_HEX, e.keyId)
    }
}
