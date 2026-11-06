package vn.sdvico.forfish.app

import android.content.Context
import vn.sdvico.forfish.shared.kho.KhoMay

/** Kho trong máy Android: SharedPreferences riêng của app, ghi đồng bộ (commit) rồi đọc lại — như saveToken của web. */
class KhoAndroid(ctx: Context) : KhoMay {
    private val sp = ctx.getSharedPreferences("forfish", Context.MODE_PRIVATE)

    override fun doc(khoa: String): String? = sp.getString(khoa, null)

    override fun ghi(khoa: String, giaTri: String): Boolean =
        sp.edit().putString(khoa, giaTri).commit() && sp.getString(khoa, null) == giaTri

    override fun xoa(khoa: String) {
        sp.edit().remove(khoa).commit()
    }

    override fun cacKhoa(): Set<String> = sp.all.keys
}
