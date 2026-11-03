// swift-tools-version: 5.9
import PackageDescription

// LiteRT-LM v0.18.0 (Google, Apache-2.0) cho Sen Biển Gemma trên iOS — doc 15 §25.
// Chép nguyên lớp Swift ở swift/ của tag v0.18.0 (commit b2f686e) + lõi C dựng sẵn
// tải theo URL có checksum. KHÔNG trỏ thẳng repo google-ai-edge/LiteRT-LM: repo đó
// dùng Git LFS (SPM báo "Git LFS is not installed" trên máy thiếu git-lfs) và
// clone ~190 MB chỉ để lấy 320 KB mã Swift.
// Nâng bản: chép lại swift/*.swift (bỏ *Tests.swift, apple_fm) + đổi url/checksum
// theo Package.swift của tag mới — CÙNG bản với litertlm-android trong build.gradle.
let package = Package(
    name: "LiteRTLM",
    platforms: [.iOS(.v15)],
    products: [.library(name: "LiteRTLM", targets: ["LiteRTLM"])],
    targets: [
        .binaryTarget(
            name: "CLiteRTLM",
            url: "https://github.com/google-ai-edge/LiteRT-LM/releases/download/v0.18.0/CLiteRTLM.xcframework.zip",
            checksum: "d765b99592d4ec3d0c9e2bd69469454af06c834861340672da1891c0c121c347"
        ),
        .target(name: "LiteRTLM", dependencies: ["CLiteRTLM"]),
    ]
)
