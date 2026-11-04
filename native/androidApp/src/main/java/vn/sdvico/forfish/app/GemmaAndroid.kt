package vn.sdvico.forfish.app

import com.google.ai.edge.litertlm.Backend
import com.google.ai.edge.litertlm.Contents
import com.google.ai.edge.litertlm.ConversationConfig
import com.google.ai.edge.litertlm.Engine
import com.google.ai.edge.litertlm.EngineConfig
import com.google.ai.edge.litertlm.SamplerConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import vn.sdvico.forfish.shared.senbien.MayGemma

/** Bộ chạy Gemma Android cho `shared` (= phần engine của SenBienGemmaPlugin.kt bản Capacitor). CPU, tham lam. */
class GemmaAndroid(private val duongMoHinh: String, private val thuMucCache: String) : MayGemma {
    private var engine: Engine? = null
    private val khoa = Mutex() // một câu chạy xong mới tới câu sau (engine dùng chung)

    private fun napNeuCan(): Engine = engine ?: Engine(
        EngineConfig(modelPath = duongMoHinh, backend = Backend.CPU(), cacheDir = thuMucCache),
    ).also { it.initialize(); engine = it }

    suspend fun nap() = withContext(Dispatchers.Default) { khoa.withLock { napNeuCan() } }

    override suspend fun hoi(he: String, nguoi: String): String = withContext(Dispatchers.Default) {
        khoa.withLock {
            val cfg = ConversationConfig(
                systemInstruction = Contents.of(he),
                samplerConfig = SamplerConfig(topK = 1, topP = 1.0, temperature = 0.0),
            )
            napNeuCan().createConversation(cfg).use { c -> c.sendMessage(Contents.of(nguoi)).toString() }
        }
    }

    fun dong() {
        engine?.close()
        engine = null
    }
}
