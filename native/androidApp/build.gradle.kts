plugins {
    id("com.android.application")
    kotlin("android")
    kotlin("plugin.compose")
}

android {
    namespace = "vn.sdvico.forfish.app"
    compileSdk = 36

    defaultConfig {
        // Đợt 0: id RIÊNG để cài cạnh bản Capacitor `vn.sdvico.forfish` mà không đè dữ liệu bà con.
        // Đợt 7 (phát hành) đổi về `vn.sdvico.forfish` để cập nhật đè bản Capacitor (ADR 0019).
        applicationId = "vn.sdvico.forfish.native"
        minSdk = 24
        targetSdk = 36
        versionCode = 1
        versionName = "0.0.1-dot0"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    // Mô hình + nền đọc bằng đường dẫn file (chép ra filesDir) — không nén để chép nhanh.
    androidResources { noCompress += listOf("litertlm", "pmtiles") }
}

kotlin {
    compilerOptions { jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17) }
}

dependencies {
    implementation(project(":shared"))
    implementation(platform("androidx.compose:compose-bom:2025.10.00"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-core")
    implementation("androidx.activity:activity-compose:1.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.12.0")
    implementation("org.maplibre.gl:android-sdk:13.7.1")
    // Gemma Sen Biển (ADR 0012) — cùng bản với plugin Capacitor
    implementation("com.google.ai.edge.litertlm:litertlm-android:0.18.0")
}

// ĐỢT 0: nền bản đồ BẢN RÕ trong git (public/data) chép vào assets lúc build; Gemma chép nếu truyền
// -Pforfish.gemma=<đường dẫn .litertlm>. Cả hai gitignore. Đợt 1 thay bằng tải + giải SDF2 theo tài khoản.
val chepDuLieu = tasks.register<Copy>("chepDuLieuDot0") {
    from(rootProject.file("../public/data/vn-basemap.pmtiles"))
    providers.gradleProperty("forfish.gemma").orNull?.let { p -> from(p) { rename { "gemma.litertlm" } } }
    into(layout.projectDirectory.dir("src/main/assets/du-lieu"))
}
tasks.named("preBuild") { dependsOn(chepDuLieu) }
