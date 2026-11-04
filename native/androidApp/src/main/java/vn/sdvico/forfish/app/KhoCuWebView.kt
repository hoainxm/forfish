package vn.sdvico.forfish.app

import android.annotation.SuppressLint
import android.content.Context
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject
import kotlin.coroutines.resume

/*
  ĐỌC KHO CỦA BẢN CAPACITOR CŨ (ADR 0019, app-map 18 §3 đợt 1). Bản Capacitor là WebView mở https://sdfish.sdvico.vn/
  ⇒ localStorage nằm trong kho WebView của CHÍNH app này, theo origin đó. Mở một WebView ẩn ở đúng origin với trang
  trống (chặn mọi request ⇒ KHÔNG cần mạng, không tải web thật) rồi đọc các khoá `forfish.*`.
  Chỉ có dữ liệu khi bản native cập nhật đè bản Capacitor (cùng package — đợt 7); bản thử id riêng đọc ra rỗng.
*/
object KhoCuWebView {
    const val GOC = "https://sdfish.sdvico.vn/"

    @SuppressLint("SetJavaScriptEnabled")
    private fun mo(ctx: Context, sauKhiNap: (WebView) -> Unit): WebView {
        val w = WebView(ctx)
        w.settings.javaScriptEnabled = true
        w.settings.domStorageEnabled = true
        w.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(v: WebView?, r: WebResourceRequest?): WebResourceResponse =
                WebResourceResponse("text/html", "utf-8", "<html></html>".byteInputStream())

            override fun onPageFinished(v: WebView, url: String?) = sauKhiNap(v)
        }
        w.loadDataWithBaseURL(GOC, "<html></html>", "text/html", "utf-8", null)
        return w
    }

    /** Dump `forfish.*` của origin cũ. Lỗi ⇒ map rỗng (lần mở sau thử lại vì chưa đánh dấu). */
    suspend fun doc(ctx: Context): Map<String, String> = suspendCancellableCoroutine { cont ->
        var w: WebView? = null
        w = mo(ctx) { v ->
            v.evaluateJavascript(
                "(function(){var o={};for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);" +
                    "if(k&&k.indexOf('forfish.')===0)o[k]=localStorage.getItem(k);}return JSON.stringify(o);})()",
            ) { kq ->
                val m = try {
                    // evaluateJavascript trả chuỗi JSON đã bọc ngoặc kép ⇒ giải hai lần
                    val chuoi = (Json.parseToJsonElement(kq) as JsonPrimitive).content
                    Json.parseToJsonElement(chuoi).jsonObject.mapValues { (it.value as JsonPrimitive).content }
                } catch (_: Exception) {
                    emptyMap()
                }
                w?.destroy()
                if (cont.isActive) cont.resume(m)
            }
        }
    }

    /** CHỈ bản debug: gieo kho giả ở origin cũ để thử đường chuyển trên emulator. */
    suspend fun gieoThu(ctx: Context, du: JsonObject) = suspendCancellableCoroutine { cont ->
        var w: WebView? = null
        w = mo(ctx) { v ->
            val js = du.entries.joinToString("") { (k, gt) ->
                "localStorage.setItem(${JsonPrimitive(k)},${JsonPrimitive((gt as JsonPrimitive).content)});"
            }
            v.evaluateJavascript("(function(){$js return 1;})()") { w?.destroy(); if (cont.isActive) cont.resume(Unit) }
        }
    }
}
