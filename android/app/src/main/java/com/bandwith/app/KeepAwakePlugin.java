package com.bandwith.app;

import android.app.Activity;
import android.view.WindowManager;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Keep the screen on (Stage mode, floor wedge). The Android twin of the iOS
 * shell's keep-awake (BandWithBridgeViewController): the page sets
 * <html data-bw-keep-awake="1"> and, in the Android app, calls
 * BwKeepAwake.set({ on }) along with it (src/lib/posture.ts setKeepAwake).
 * FLAG_KEEP_SCREEN_ON only holds while the window is visible, so nothing
 * stays on once the app is in the background.
 */
@CapacitorPlugin(name = "BwKeepAwake")
public class KeepAwakePlugin extends Plugin {

    @PluginMethod
    public void set(PluginCall call) {
        final boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        final Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(() -> {
            if (on) {
                activity.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            } else {
                activity.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            }
            call.resolve();
        });
    }
}
