package vn.sdvico.forfish.shared.dulieu

/*
  MÃ HOÁ FILE DỮ LIỆU — BẢN KOTLIN của `src/lib/data-codec.mjs` + `data-crypt.ts` (ADR 0019).

  Hai bản phải khớp TỪNG BYTE: lệch là bản đồ trắng câm ngoài biển. Cổng: test commonTest đọc vector do
  `native/scripts/sinh-testdata.mjs` sinh từ chính code web (app-map 18 §5). Sửa code web ⇒ chạy lại script.

  SDF1: 4 byte "SDF1" + thân hoán vị byte (bảng 256 phần tử, xorshift32 + Fisher–Yates, hạt 0x53444649).
  SDF2: 29 byte header ("SDF2", cờ gzip, key id 8 byte, nonce 16 byte) + AES-256-CTR(gzip?(bản rõ)).
  Không có header nào ⇒ bản rõ (dev/test) ⇒ trả nguyên.
*/
object DataCodec {
    val MAGIC1: ByteArray = byteArrayOf(0x53, 0x44, 0x46, 0x31)
    const val HEADER1_LEN = 4
    val MAGIC2: ByteArray = byteArrayOf(0x53, 0x44, 0x46, 0x32)
    const val HEADER2_LEN = 29
    const val FLAG_GZIP = 1
    const val AES_BLOCK = 16

    private const val SEED = 0x53444649u

    /** Bảng mã hoá: byte rõ → byte mã. = ENC_TABLE của web. */
    val ENC_TABLE: ByteArray = buildTable(SEED)

    /** Bảng giải mã: byte mã → byte rõ. */
    val DEC_TABLE: ByteArray = ByteArray(256).also { d ->
        for (i in 0 until 256) d[ENC_TABLE[i].toInt() and 0xff] = i.toByte()
    }

    private fun buildTable(seed: UInt): ByteArray {
        val t = IntArray(256) { it }
        var s = if (seed == 0u) 1u else seed
        fun next(): UInt {
            s = s xor (s shl 13)
            s = s xor (s shr 17)
            s = s xor (s shl 5)
            return s
        }
        for (i in 255 downTo 1) {
            val j = (next() % (i + 1).toUInt()).toInt()
            val tmp = t[i]
            t[i] = t[j]
            t[j] = tmp
        }
        return ByteArray(256) { t[it].toByte() }
    }

    private fun batDau(u8: ByteArray, magic: ByteArray, toiThieu: Int): Boolean {
        if (u8.size < toiThieu) return false
        for (i in magic.indices) if (u8[i] != magic[i]) return false
        return true
    }

    fun hasHeader1(u8: ByteArray): Boolean = batDau(u8, MAGIC1, HEADER1_LEN)

    fun hasHeader2(u8: ByteArray): Boolean = batDau(u8, MAGIC2, HEADER2_LEN)

    /** Hoán vị ngược một đoạn đã mã (không header) — lát Range hoặc thân file. Trả mảng mới. */
    fun unsubstitute(u8: ByteArray, tu: Int = 0, den: Int = u8.size): ByteArray =
        ByteArray(den - tu) { DEC_TABLE[u8[tu + it].toInt() and 0xff] }

    /** Mã hoá SDF1 trọn file; đã có header thì trả nguyên (như web). */
    fun encodeData(u8: ByteArray): ByteArray {
        if (hasHeader1(u8)) return u8
        val out = ByteArray(HEADER1_LEN + u8.size)
        MAGIC1.copyInto(out)
        for (i in u8.indices) out[HEADER1_LEN + i] = ENC_TABLE[u8[i].toInt() and 0xff]
        return out
    }

    /** Giải SDF1; không header ⇒ bản rõ ⇒ trả nguyên. */
    fun decodeData(u8: ByteArray): ByteArray =
        if (!hasHeader1(u8)) u8 else unsubstitute(u8, HEADER1_LEN)

    data class Header2(val gzip: Boolean, val keyId: String, val nonce: ByteArray)

    fun parseHeader2(u8: ByteArray): Header2? {
        if (!hasHeader2(u8)) return null
        return Header2(
            gzip = (u8[4].toInt() and FLAG_GZIP) != 0,
            keyId = hexOf(u8.copyOfRange(5, 13)),
            nonce = u8.copyOfRange(13, 29),
        )
    }

    /** Khối bộ đếm cho khối thứ `block`: 8 byte đầu nonce giữ nguyên, 8 byte thấp = block (big-endian). */
    fun counterAt(nonce: ByteArray, block: Long): ByteArray {
        val c = nonce.copyOf(16)
        var b = block
        for (i in 15 downTo 8) {
            c[i] = (b and 0xff).toByte()
            b = b ushr 8
        }
        return c
    }

    fun hexOf(u8: ByteArray): String {
        val sb = StringBuilder(u8.size * 2)
        for (b in u8) {
            val v = b.toInt() and 0xff
            sb.append("0123456789abcdef"[v shr 4]).append("0123456789abcdef"[v and 0xf])
        }
        return sb.toString()
    }
}

/** Phép nền tảng: Android/JVM dùng javax.crypto + java.util.zip, iOS dùng CommonCrypto + zlib của hệ điều hành. */
expect object NenTang {
    /** AES-256-CTR, bộ đếm bắt đầu ở `counter` (16 byte, tăng big-endian). Mã và giải là một phép. */
    fun aesCtr(key: ByteArray, counter: ByteArray, input: ByteArray): ByteArray

    fun gunzip(data: ByteArray): ByteArray

    fun sha256(data: ByteArray): ByteArray
}

class KhongCoKhoa(val keyId: String) : Exception("no_key")

object DataCrypt {
    /** key id = 8 byte đầu SHA-256(khoá), hex 16 ký tự — cùng công thức script build. */
    fun keyIdOf(raw: ByteArray): String = DataCodec.hexOf(NenTang.sha256(raw).copyOf(8))

    /** Giải một đoạn thân mã bắt đầu ở `payloadOffset` (tính từ đầu THÂN, sau header) — nhảy thẳng tới khối. */
    fun decryptAt(key: ByteArray, nonce: ByteArray, cipher: ByteArray, payloadOffset: Long): ByteArray {
        require(key.size == 32) { "khoá phải 32 byte" }
        val lead = (payloadOffset % DataCodec.AES_BLOCK).toInt()
        val block = (payloadOffset - lead) / DataCodec.AES_BLOCK
        val input = ByteArray(lead + cipher.size)
        cipher.copyInto(input, lead)
        val out = NenTang.aesCtr(key, DataCodec.counterAt(nonce, block), input)
        return out.copyOfRange(lead, out.size)
    }

    /** Trọn file SDF2 → bản rõ. Không có khoá ⇒ KhongCoKhoa (chỗ gọi xin khoá khi có sóng rồi thử lại). */
    fun decryptFile(u8: ByteArray, layKhoa: (keyId: String) -> ByteArray?): ByteArray {
        val h = DataCodec.parseHeader2(u8) ?: throw IllegalArgumentException("not_sdf2")
        val key = layKhoa(h.keyId) ?: throw KhongCoKhoa(h.keyId)
        val body = decryptAt(key, h.nonce, u8.copyOfRange(DataCodec.HEADER2_LEN, u8.size), 0)
        return if (h.gzip) NenTang.gunzip(body) else body
    }

    /** Một cửa đọc file dữ liệu (= fetchDataBytes của web, phần sau khi tải): SDF2 / SDF1 / bản rõ. */
    fun moFile(u8: ByteArray, layKhoa: (keyId: String) -> ByteArray?): ByteArray =
        if (DataCodec.hasHeader2(u8)) decryptFile(u8, layKhoa) else DataCodec.decodeData(u8)
}
