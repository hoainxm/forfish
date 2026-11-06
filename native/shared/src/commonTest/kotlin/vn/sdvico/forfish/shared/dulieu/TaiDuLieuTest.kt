package vn.sdvico.forfish.shared.dulieu

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import io.ktor.utils.io.ByteReadChannel
import kotlinx.coroutines.test.runTest
import vn.sdvico.forfish.shared.api.MayChu
import vn.sdvico.forfish.shared.kho.KhoTrongRam
import vn.sdvico.forfish.shared.kho.KhoaMay
import vn.sdvico.forfish.shared.taikhoan.KhoaDuLieu
import vn.sdvico.forfish.shared.taikhoan.PhienMay
import kotlin.io.encoding.Base64
import kotlin.test.Test
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertIs

class TaiDuLieuTest {
    private val G = GoldenDataCodec
    private fun b(s: String) = Base64.decode(s)

    class TepRam : KhoTep {
        val m = mutableMapOf<String, ByteArray>()
        override fun duong(ten: String) = "/ram/$ten"
        override fun co(ten: String) = m.containsKey(ten)
        override fun ghi(ten: String, byte: ByteArray): Boolean { m[ten] = byte; return true }
        override fun doc(ten: String) = m[ten]
    }

    private fun dung(cho: (etagGui: String?) -> Triple<Int, ByteArray, String?>?, coKhoa: Boolean = true): Pair<TaiDuLieu, TepRam> {
        val kho = KhoTrongRam()
        if (coKhoa) kho.ghi(KhoaMay.KHOA_DU_LIEU, """{"${G.KEY_ID_HEX}":"${DataCodec.hexOf(b(G.KHOA))}"}""")
        val phien = PhienMay(kho) { 0 }
        val http = HttpClient(MockEngine { req ->
            val p = req.url.encodedPath
            if (p == "/api/data-key") {
                return@MockEngine respond("""{"ok":true,"keys":[{"id":"${G.KEY_ID_HEX}","key":"${DataCodec.hexOf(b(G.KHOA))}"}]}""", HttpStatusCode.OK, headersOf("Content-Type", "application/json"))
            }
            val r = cho(req.headers["If-None-Match"]) ?: throw RuntimeException("mất sóng")
            respond(ByteReadChannel(r.second), HttpStatusCode.fromValue(r.first), if (r.third != null) headersOf("ETag", r.third!!) else headersOf())
        })
        val mc = MayChu("https://x", phien, http)
        val tep = TepRam()
        return TaiDuLieu(mc, KhoaDuLieu(kho, mc), tep, kho) to tep
    }

    @Test fun taiMoiGiaiSdf2VaCatBanRo() = runTest {
        val (t, tep) = dung({ Triple(200, b(G.SDF2_GZIP), "\"e1\"") })
        assertEquals(KetQuaTai.Co("/ram/a.json", true), t.lay("a.json"))
        assertContentEquals(b(G.RO), tep.m["a.json"])
    }

    @Test fun etagGuiLaiVa304GiuBanCu() = runTest {
        var guiEtag: String? = null
        var lan = 0
        val (t, tep) = dung({ e -> lan++; guiEtag = e; if (lan == 1) Triple(200, b(G.SDF1), "\"e1\"") else Triple(304, ByteArray(0), null) })
        t.lay("a.json")
        assertEquals(KetQuaTai.Co("/ram/a.json", false), t.lay("a.json"))
        assertEquals("\"e1\"", guiEtag)
        assertContentEquals(b(G.RO), tep.m["a.json"])
    }

    @Test fun matSongDungBanCuKhongXoa() = runTest {
        var song = true
        val (t, tep) = dung({ if (song) Triple(200, b(G.SDF1), null) else null })
        t.lay("a.json")
        song = false
        assertEquals(KetQuaTai.Co("/ram/a.json", false), t.lay("a.json"))
        assertContentEquals(b(G.RO), tep.m["a.json"])
    }

    @Test fun matSongChuaTungCo() = runTest {
        val (t) = dung({ null })
        assertIs<KetQuaTai.Khong>(t.lay("a.json"))
    }

    @Test fun thieuKhoaThiXinLaiRoiGiai() = runTest {
        val (t, tep) = dung({ Triple(200, b(G.SDF2_THO), null) }, coKhoa = false)
        assertEquals(KetQuaTai.Co("/ram/a.json", true), t.lay("a.json"))
        assertContentEquals(b(G.RO), tep.m["a.json"])
    }

    @Test fun loi401GiuBanCu() = runTest {
        var lan = 0
        val (t, tep) = dung({ lan++; if (lan == 1) Triple(200, b(G.SDF1), null) else Triple(403, "{}".encodeToByteArray(), null) })
        t.lay("a.json")
        assertEquals(KetQuaTai.Co("/ram/a.json", false), t.lay("a.json"))
        assertContentEquals(b(G.RO), tep.m["a.json"])
    }
}
