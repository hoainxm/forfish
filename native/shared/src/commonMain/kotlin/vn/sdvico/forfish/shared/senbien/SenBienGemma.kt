package vn.sdvico.forfish.shared.senbien

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject

/*
  SEN BIỂN — Gemma 3 270M trong máy, phần CHUNG (= src/lib/sen-bien/gemma.ts: SYSTEM, userMsg, docDap).
  Bộ chạy mô hình nằm ở từng nền (LiteRT-LM Kotlin ở androidApp, LiteRT-LM Swift ở iosApp) và bơm vào
  qua `MayGemma` — Kotlin/Native không gọi thẳng API Swift được (ADR 0019).
  Prompt phải KHỚP TỪNG CHỮ với lúc train (repo AI Assistant train/tro-ly/chung.mjs).
*/
interface MayGemma {
    /** { he: system, nguoi: user } → chữ mô hình trả. Lỗi ⇒ ném. */
    suspend fun hoi(he: String, nguoi: String): String
}

data class GemmaCtx(
    val xn: Boolean = false,
    val cang: List<String> = emptyList(),
    val diem: List<String> = emptyList(),
    val tau: List<String> = emptyList(),
)

data class GemmaDap(val y: String, val s: JsonObject)

object SenBienGemma {
    const val SYSTEM =
        "Bộ hiểu ý Trợ lý Forfish. Đọc câu ngư dân nói, trả đúng một dòng JSON {\"y\":ý định,\"s\":tham số,\"f\":ý thứ hai,\"r\":lý do chặn}."

    /** = userMsg của web: câu HẠ CHỮ THƯỜNG (bộ nghe trả CHỮ HOA; không hạ thì Gemma tụt 95 → 61 %). */
    fun userMsg(cau: String, ctx: GemmaCtx): String {
        fun l(a: List<String>) = if (a.isEmpty()) "-" else a.joinToString(";")
        return "xn=${if (ctx.xn) 1 else 0} | cang=${l(ctx.cang)} | diem=${l(ctx.diem)} | tau=${l(ctx.tau)}\ncau: ${cau.lowercase()}"
    }

    /**
     * Đọc một dòng JSON của Gemma (chịu rác quanh, thiếu ngoặc cuối); hỏng hoặc `y` không thuộc `yHopLe` ⇒ null.
     * `yHopLe` = INTENTS của bộ n-gram đang chạy (web: `ngram.ts`) — đợt 3 port n-gram thì truyền từ đó.
     */
    fun docDap(txt: String, yHopLe: Set<String>): GemmaDap? {
        val m = Regex("\\{[\\s\\S]*\\}").find(txt) ?: return null
        val o = docJson(m.value) ?: run {
            var d = 0
            var end = -1
            for (i in m.value.indices) {
                val ch = m.value[i]
                if (ch == '{') d++ else if (ch == '}' && --d == 0) { end = i; break }
            }
            if (end < 0) null else docJson(m.value.substring(0, end + 1))
        } ?: return null
        val y = (o["y"] as? JsonPrimitive)?.takeIf { it.isString }?.content ?: return null
        if (y !in yHopLe) return null
        return GemmaDap(y, o["s"] as? JsonObject ?: JsonObject(emptyMap()))
    }

    private fun docJson(s: String): JsonObject? = try {
        Json.parseToJsonElement(s).jsonObject
    } catch (_: Exception) {
        null
    }

    /** Một lượt: dựng prompt, hỏi máy, đọc đáp. Lỗi máy ⇒ null (chỗ gọi giữ câu của luật, như web). */
    suspend fun hieu(may: MayGemma, cau: String, ctx: GemmaCtx, yHopLe: Set<String>): GemmaDap? = try {
        docDap(may.hoi(SYSTEM, userMsg(cau, ctx)), yHopLe)
    } catch (_: Exception) {
        null
    }
}
