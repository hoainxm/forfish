package vn.sdvico.sdfish;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // plugin cục bộ phải đăng ký TRƯỚC super.onCreate (Capacitor dựng bridge ở đó)
        registerPlugin(SenBienGemmaPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
