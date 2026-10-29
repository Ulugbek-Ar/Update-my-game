package com.ulugbek.pikselqala;

import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Piksel Qal'a: to'liq ekran (immersive) — status va navigatsiya paneli yashirin,
 * o'yin ochiq turganda ekran o'chmaydi. Orientatsiya AndroidManifest'da (sensorLandscape).
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window window = getWindow();
        // ilova oldinda turganda ekran o'chmaydi (fonda bu bayroq ta'sir qilmaydi)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        // kamera kesigi (notch) tomonida ham chizish — bo'sh joylarni CSS safe-area to'ldiradi
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.getAttributes().layoutInDisplayCutoutMode =
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }
        if (bridge != null && bridge.getWebView() != null) {
            WebSettings s = bridge.getWebView().getSettings();
            // tizimdagi shrift kattaligi piksel matnni buzmasin
            s.setTextZoom(100);
            // ovoz foydalanuvchi bosishisiz ham ishlay oladi (pauzadan qaytganda)
            s.setMediaPlaybackRequiresUserGesture(false);
        }
        hideSystemBars();
    }

    @Override
    public void onResume() {
        super.onResume();
        hideSystemBars();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // tizim oynasi (klaviatura, bildirishnoma) yopilgach panellar yana yashiriladi
        if (hasFocus) hideSystemBars();
    }

    private void hideSystemBars() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(window, window.getDecorView());
        c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsetsCompat.Type.systemBars());
    }
}
