package vn.sdvico.forfish.shared.dulieu

import java.security.MessageDigest
import java.util.zip.GZIPInputStream
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec

// Android + JVM: thư viện chuẩn Java. CTR của Java tăng cả 128 bit, web tăng 64 bit thấp — file < 2^64 khối
// nên không bao giờ khác nhau (ghi chú SDF2 ở data-codec.mjs).
actual object NenTang {
    actual fun aesCtr(key: ByteArray, counter: ByteArray, input: ByteArray): ByteArray {
        val c = Cipher.getInstance("AES/CTR/NoPadding")
        c.init(Cipher.DECRYPT_MODE, SecretKeySpec(key, "AES"), IvParameterSpec(counter))
        return c.doFinal(input)
    }

    actual fun gunzip(data: ByteArray): ByteArray = GZIPInputStream(data.inputStream()).use { it.readBytes() }

    actual fun sha256(data: ByteArray): ByteArray = MessageDigest.getInstance("SHA-256").digest(data)
}
