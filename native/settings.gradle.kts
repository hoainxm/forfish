// App native ForFish (ADR 0019, app-map 18): KMP `shared` (logic chung) + `androidApp` (Compose).
// iOS (SwiftUI) ở `iosApp/`, dựng bằng XcodeGen, nhúng framework `Shared` của module này.
pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "forfish-native"
include(":shared")

// androidApp chỉ khi máy có Android SDK: Mac chỉ build iOS (không cài SDK), Android build ở gpu-desktop.
val coAndroidSdk = System.getenv("ANDROID_HOME") != null ||
    file("local.properties").let { it.exists() && it.readText().contains("sdk.dir") }
if (coAndroidSdk) include(":androidApp")
