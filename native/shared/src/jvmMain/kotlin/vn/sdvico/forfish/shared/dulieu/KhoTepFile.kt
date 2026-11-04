package vn.sdvico.forfish.shared.dulieu

import java.io.File

/** Kho file JVM/Android: thư mục do app đưa (Android: filesDir/du-lieu). Ghi nguyên tử bằng file tạm + đổi tên. */
class KhoTepFile(private val goc: File) : KhoTep {
    init { goc.mkdirs() }

    override fun duong(ten: String): String = File(goc, ten).absolutePath
    override fun co(ten: String): Boolean = File(goc, ten).let { it.isFile && it.length() > 0 }
    override fun ghi(ten: String, byte: ByteArray): Boolean = try {
        val tam = File(goc, "$ten.tam")
        tam.parentFile?.mkdirs() // tên có thư mục con (fonts/<fontstack>/…)
        tam.writeBytes(byte)
        tam.renameTo(File(goc, ten)) || run { File(goc, ten).delete(); tam.renameTo(File(goc, ten)) }
    } catch (_: Exception) {
        false
    }
    override fun doc(ten: String): ByteArray? = File(goc, ten).takeIf { it.isFile }?.readBytes()
}
