package com.bandwith.app;

import android.Manifest;
import android.annotation.SuppressLint;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattServer;
import android.bluetooth.BluetoothGattServerCallback;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothManager;
import android.bluetooth.BluetoothProfile;
import android.bluetooth.le.AdvertiseCallback;
import android.bluetooth.le.AdvertiseData;
import android.bluetooth.le.AdvertiseSettings;
import android.bluetooth.le.BluetoothLeAdvertiser;
import android.content.Context;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.ParcelUuid;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.util.Arrays;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * Stage mode over Bluetooth, leader side (see ios/App/App/StageBlePlugin.swift
 * for the same plugin on iOS and src/lib/stageBle.ts for the bytes): the band
 * admin's phone advertises the gig's service and serves one characteristic,
 * read = full state (by offset), notify = short value (subscribers then read).
 * No encryption, so members connect without pairing.
 */
@CapacitorPlugin(
    name = "StageBle",
    permissions = {
        @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_ADVERTISE, Manifest.permission.BLUETOOTH_CONNECT })
    }
)
public class StageBlePlugin extends Plugin {

    private static final UUID CCCD = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb");

    private final Handler main = new Handler(Looper.getMainLooper());
    private BluetoothManager manager;
    private BluetoothGattServer server;
    private BluetoothLeAdvertiser advertiser;
    private BluetoothGattCharacteristic characteristic;
    private UUID serviceUuid;
    private UUID characteristicUuid;
    private volatile byte[] value = new byte[0];
    private volatile byte[] notifyValue = new byte[0];
    private final Set<BluetoothDevice> subscribers = new CopyOnWriteArraySet<>();
    private String state = "unknown";

    @PluginMethod
    public void start(PluginCall call) {
        String service = call.getString("serviceUuid");
        String chr = call.getString("characteristicUuid");
        String v = call.getString("value");
        String n = call.getString("notify");
        if (service == null || chr == null || v == null || n == null) {
            call.reject("serviceUuid, characteristicUuid, value and notify are required");
            return;
        }
        // Android 12+: advertising and serving need runtime permissions.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bluetooth") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetooth", call, "permissionCallback");
            return;
        }
        doStart(call);
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if (getPermissionState("bluetooth") != PermissionState.GRANTED) {
            setState("unauthorized");
            JSObject ret = new JSObject();
            ret.put("state", state);
            call.resolve(ret);
            return;
        }
        doStart(call);
    }

    @SuppressLint("MissingPermission")
    private void doStart(PluginCall call) {
        try {
            UUID newService = UUID.fromString(call.getString("serviceUuid"));
            characteristicUuid = UUID.fromString(call.getString("characteristicUuid"));
            value = Base64.decode(call.getString("value"), Base64.NO_WRAP);
            notifyValue = Base64.decode(call.getString("notify"), Base64.NO_WRAP);
            if (!newService.equals(serviceUuid)) teardown();
            serviceUuid = newService;
        } catch (IllegalArgumentException e) {
            call.reject("Bad UUID or base64");
            return;
        }
        manager = (BluetoothManager) getContext().getSystemService(Context.BLUETOOTH_SERVICE);
        BluetoothAdapter adapter = manager != null ? manager.getAdapter() : null;
        if (adapter == null) {
            setState("unsupported");
        } else if (!adapter.isEnabled()) {
            setState("off");
        } else if (!adapter.isMultipleAdvertisementSupported() || adapter.getBluetoothLeAdvertiser() == null) {
            // Some phones can't be a peripheral at all.
            setState("unsupported");
        } else if (server == null) {
            advertiser = adapter.getBluetoothLeAdvertiser();
            server = manager.openGattServer(getContext(), callback);
            if (server == null) {
                setState("unsupported");
            } else {
                characteristic = new BluetoothGattCharacteristic(
                    characteristicUuid,
                    BluetoothGattCharacteristic.PROPERTY_READ | BluetoothGattCharacteristic.PROPERTY_NOTIFY,
                    BluetoothGattCharacteristic.PERMISSION_READ
                );
                characteristic.addDescriptor(new BluetoothGattDescriptor(
                    CCCD, BluetoothGattDescriptor.PERMISSION_READ | BluetoothGattDescriptor.PERMISSION_WRITE));
                BluetoothGattService svc = new BluetoothGattService(serviceUuid, BluetoothGattService.SERVICE_TYPE_PRIMARY);
                svc.addCharacteristic(characteristic);
                server.addService(svc); // advertising starts in onServiceAdded
                setState("on");
            }
        } else {
            setState("on");
        }
        JSObject ret = new JSObject();
        ret.put("state", state);
        call.resolve(ret);
    }

    @PluginMethod
    public void update(PluginCall call) {
        String v = call.getString("value");
        String n = call.getString("notify");
        if (v == null || n == null) {
            call.reject("value and notify are required");
            return;
        }
        value = Base64.decode(v, Base64.NO_WRAP);
        notifyValue = Base64.decode(n, Base64.NO_WRAP);
        sendNotify();
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        teardown();
        serviceUuid = null;
        call.resolve();
    }

    @Override
    protected void handleOnDestroy() {
        teardown();
    }

    @SuppressLint("MissingPermission")
    private void teardown() {
        try {
            if (advertiser != null) advertiser.stopAdvertising(advertiseCallback);
        } catch (Exception ignored) {
            // Bluetooth off or permission revoked.
        }
        try {
            if (server != null) server.close();
        } catch (Exception ignored) {
            // idem
        }
        advertiser = null;
        server = null;
        characteristic = null;
        subscribers.clear();
    }

    @SuppressLint("MissingPermission")
    private void sendNotify() {
        BluetoothGattServer s = server;
        BluetoothGattCharacteristic c = characteristic;
        if (s == null || c == null) return;
        for (BluetoothDevice device : subscribers) {
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                    s.notifyCharacteristicChanged(device, c, false, notifyValue);
                } else {
                    c.setValue(notifyValue);
                    s.notifyCharacteristicChanged(device, c, false);
                }
            } catch (Exception ignored) {
                subscribers.remove(device);
            }
        }
    }

    private void setState(String next) {
        state = next;
        main.post(() -> {
            JSObject data = new JSObject();
            data.put("state", state);
            data.put("subscribers", subscribers.size());
            notifyListeners("stateChange", data);
        });
    }

    private final AdvertiseCallback advertiseCallback = new AdvertiseCallback() {
        @Override
        public void onStartFailure(int errorCode) {
            setState("unsupported");
        }
    };

    private final BluetoothGattServerCallback callback = new BluetoothGattServerCallback() {
        @SuppressLint("MissingPermission")
        @Override
        public void onServiceAdded(int status, BluetoothGattService service) {
            if (status != BluetoothGatt.GATT_SUCCESS || advertiser == null) {
                setState("unsupported");
                return;
            }
            AdvertiseSettings settings = new AdvertiseSettings.Builder()
                .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
                .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
                .setConnectable(true)
                .build();
            AdvertiseData data = new AdvertiseData.Builder()
                .setIncludeDeviceName(false)
                .addServiceUuid(new ParcelUuid(serviceUuid))
                .build();
            try {
                advertiser.startAdvertising(settings, data, advertiseCallback);
            } catch (Exception e) {
                setState("unsupported");
            }
        }

        @Override
        public void onConnectionStateChange(BluetoothDevice device, int status, int newState) {
            if (newState == BluetoothProfile.STATE_DISCONNECTED) {
                subscribers.remove(device);
                setState(state);
            }
        }

        @SuppressLint("MissingPermission")
        @Override
        public void onCharacteristicReadRequest(BluetoothDevice device, int requestId, int offset, BluetoothGattCharacteristic c) {
            BluetoothGattServer s = server;
            if (s == null) return;
            byte[] v = value;
            if (characteristicUuid == null || !characteristicUuid.equals(c.getUuid())) {
                s.sendResponse(device, requestId, BluetoothGatt.GATT_READ_NOT_PERMITTED, offset, null);
            } else if (offset > v.length) {
                s.sendResponse(device, requestId, BluetoothGatt.GATT_INVALID_OFFSET, offset, null);
            } else {
                s.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, offset, Arrays.copyOfRange(v, offset, v.length));
            }
        }

        @SuppressLint("MissingPermission")
        @Override
        public void onDescriptorReadRequest(BluetoothDevice device, int requestId, int offset, BluetoothGattDescriptor descriptor) {
            BluetoothGattServer s = server;
            if (s == null) return;
            byte[] v = subscribers.contains(device)
                ? BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                : BluetoothGattDescriptor.DISABLE_NOTIFICATION_VALUE;
            s.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, v);
        }

        @SuppressLint("MissingPermission")
        @Override
        public void onDescriptorWriteRequest(BluetoothDevice device, int requestId, BluetoothGattDescriptor descriptor,
                                             boolean preparedWrite, boolean responseNeeded, int offset, byte[] v) {
            if (CCCD.equals(descriptor.getUuid())) {
                if (v != null && Arrays.equals(v, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE)) {
                    subscribers.add(device);
                } else {
                    subscribers.remove(device);
                }
                setState(state);
            }
            BluetoothGattServer s = server;
            if (responseNeeded && s != null) s.sendResponse(device, requestId, BluetoothGatt.GATT_SUCCESS, 0, null);
            if (subscribers.contains(device)) sendNotify();
        }
    };
}
