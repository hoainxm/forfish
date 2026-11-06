import Capacitor
import UIKit

/// Vỏ Capacitor của SDFish: đăng ký plugin viết riêng trong app (không qua npm).
class SDFishViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(SenBienGemmaPlugin())
    }
}
