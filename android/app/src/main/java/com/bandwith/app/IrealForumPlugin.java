package com.bandwith.app;

import android.annotation.SuppressLint;
import android.app.Dialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The public iReal Pro forum inside the app (see ios/App/App/IrealForumPlugin.swift
 * for the same plugin on iOS and src/lib/irealForum.ts for the JS side).
 *
 * The forum opens in its own full-screen WebView. A tap on an irealb:// or
 * irealbook:// link (one song or a playlist) closes it and hands the link to
 * the app instead of the iReal Pro app. Nothing is read from the forum's
 * pages; pages outside irealpro.com open in the browser.
 *
 * JS: IrealForum.open({ url, title }) resolves { link } (null when closed).
 */
@CapacitorPlugin(name = "IrealForum")
public class IrealForumPlugin extends Plugin {

    private Dialog dialog;

    static boolean isForum(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null) return false;
        String host = uri.getHost().toLowerCase();
        return host.equals("irealpro.com") || host.endsWith(".irealpro.com");
    }

    static boolean isIrealLink(Uri uri) {
        String scheme = uri == null ? null : uri.getScheme();
        return "irealb".equalsIgnoreCase(scheme) || "irealbook".equalsIgnoreCase(scheme);
    }

    @PluginMethod
    public void open(PluginCall call) {
        Uri start = Uri.parse(call.getString("url", ""));
        if (!isForum(start)) {
            call.reject("url must be an irealpro.com page");
            return;
        }
        String title = call.getString("title", "iReal Pro");
        getActivity().runOnUiThread(() -> show(call, start, title));
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getContext().getResources().getDisplayMetrics());
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void show(PluginCall call, Uri start, String title) {
        if (dialog != null && dialog.isShowing()) {
            JSObject none = new JSObject();
            none.put("link", JSObject.NULL);
            call.resolve(none);
            return;
        }
        final boolean[] finished = { false };
        final Dialog d = new Dialog(getActivity(), android.R.style.Theme_DeviceDefault_Light_NoActionBar);
        dialog = d;

        final WebView web = new WebView(getContext());
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setSupportMultipleWindows(false);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);

        final Runnable[] finish = new Runnable[1];
        final String[] result = { null };
        finish[0] = () -> {
            if (finished[0]) return;
            finished[0] = true;
            JSObject ret = new JSObject();
            ret.put("link", result[0] == null ? JSObject.NULL : result[0]);
            call.resolve(ret);
            web.stopLoading();
            if (d.isShowing()) d.dismiss();
            web.destroy();
            dialog = null;
        };

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isIrealLink(uri)) {
                    // A song or playlist: hand it to the app, not to iReal Pro.
                    result[0] = uri.toString();
                    finish[0].run();
                    return true;
                }
                if (request.isForMainFrame() && !isForum(uri)) {
                    // Anything else the forum links to opens outside the app.
                    if ("http".equalsIgnoreCase(uri.getScheme()) || "https".equalsIgnoreCase(uri.getScheme())) {
                        try {
                            getActivity().startActivity(new Intent(Intent.ACTION_VIEW, uri));
                        } catch (Exception ignored) {
                        }
                    }
                    return true;
                }
                return false;
            }
        });

        LinearLayout root = new LinearLayout(getContext());
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);

        LinearLayout bar = new LinearLayout(getContext());
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(8), dp(4), dp(8), dp(4));

        Button close = new Button(getContext(), null, android.R.attr.borderlessButtonStyle);
        close.setText("✕");
        close.setContentDescription("Close");
        close.setOnClickListener(v -> finish[0].run());
        Button back = new Button(getContext(), null, android.R.attr.borderlessButtonStyle);
        back.setText("‹");
        back.setContentDescription("Back");
        back.setOnClickListener(v -> {
            if (web.canGoBack()) web.goBack();
        });
        TextView label = new TextView(getContext());
        label.setText(title);
        label.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        label.setTextColor(Color.BLACK);
        label.setGravity(Gravity.CENTER);
        bar.addView(close, new LinearLayout.LayoutParams(dp(48), dp(48)));
        bar.addView(back, new LinearLayout.LayoutParams(dp(48), dp(48)));
        bar.addView(label, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        View spacer = new View(getContext());
        bar.addView(spacer, new LinearLayout.LayoutParams(dp(96), dp(1)));

        root.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        root.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        // Edge to edge: keep the bar and the page clear of the system bars.
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets i = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            v.setPadding(i.left, i.top, i.right, i.bottom);
            return WindowInsetsCompat.CONSUMED;
        });

        d.requestWindowFeature(Window.FEATURE_NO_TITLE);
        d.setContentView(root);
        d.setOnKeyListener((dlg, keyCode, event) -> {
            if (keyCode == KeyEvent.KEYCODE_BACK && event.getAction() == KeyEvent.ACTION_UP) {
                if (web.canGoBack()) web.goBack();
                else finish[0].run();
                return true;
            }
            return false;
        });
        d.setOnDismissListener(dlg -> finish[0].run());
        Window w = d.getWindow();
        if (w != null) w.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        d.show();
        web.loadUrl(start.toString());
    }
}
