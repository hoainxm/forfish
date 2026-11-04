plugins {
    kotlin("multiplatform")
    kotlin("plugin.serialization")
}

/*  CẤU HÌNH CÔNG KHAI sinh lúc build (ADR 0019): địa chỉ + anon key Supabase (công khai theo thiết kế, nhưng KHÔNG
    gõ vào git — CLAUDE.md "không hardcode key") đọc từ env hoặc `.env.local` ở gốc repo, giống NEXT_PUBLIC_* của web. */
val sinhCauHinh = tasks.register("sinhCauHinh") {
    val ra = layout.buildDirectory.dir("generated/cauhinh")
    val envFile = rootProject.file("../.env.local")
    inputs.property("env", providers.environmentVariable("NEXT_PUBLIC_SUPABASE_URL").orElse(""))
    if (envFile.exists()) inputs.file(envFile)
    outputs.dir(ra)
    doLast {
        val env = if (envFile.exists()) envFile.readLines().mapNotNull { l ->
            val i = l.indexOf('=')
            if (i <= 0 || l.trimStart().startsWith("#")) null else l.substring(0, i).trim() to l.substring(i + 1).trim().trim('"')
        }.toMap() else emptyMap()
        fun lay(k: String) = System.getenv(k) ?: env[k] ?: error("Thiếu $k (env hoặc .env.local) — app native cần như web")
        val f = ra.get().file("vn/sdvico/forfish/shared/CauHinh.kt").asFile
        f.parentFile.mkdirs()
        f.writeText(
            "// SINH LÚC BUILD từ NEXT_PUBLIC_* (env / .env.local) — không vào git.\n" +
                "package vn.sdvico.forfish.shared\n\nobject CauHinh {\n" +
                "    const val SUPABASE_URL = \"${lay("NEXT_PUBLIC_SUPABASE_URL")}\"\n" +
                "    const val SUPABASE_ANON_KEY = \"${lay("NEXT_PUBLIC_SUPABASE_ANON_KEY")}\"\n" +
                "    const val WEB_GOC = \"${System.getenv("FORFISH_WEB_GOC") ?: "https://sdfish.sdvico.vn"}\"\n}\n",
        )
    }
}

kotlin {
    // Android dùng biến thể JVM (KMP cho androidJvm nhận jvm) ⇒ module này không cần Android SDK,
    // Mac build iOS được mà không cài SDK (ADR 0019).
    jvm {
        compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
    }
    listOf(iosArm64(), iosSimulatorArm64()).forEach {
        it.binaries.framework {
            baseName = "Shared"
            isStatic = true
        }
    }

    compilerOptions { freeCompilerArgs.addAll("-Xexpect-actual-classes", "-opt-in=kotlin.time.ExperimentalTime") }

    sourceSets {
        commonMain {
            kotlin.srcDir(sinhCauHinh)
            dependencies {
                implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.12.0")
                implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.11.0")
                api("io.ktor:ktor-client-core:3.6.1")
            }
        }
        jvmMain.dependencies {
            implementation("io.ktor:ktor-client-okhttp:3.6.1")
        }
        iosMain.dependencies {
            implementation("io.ktor:ktor-client-darwin:3.6.1")
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
            implementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.11.0")
            implementation("io.ktor:ktor-client-mock:3.6.1")
        }
    }
}
