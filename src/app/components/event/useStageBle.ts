import { useCallback, useEffect, useRef, useState } from 'react';
import { BleClient } from '@capacitor-community/bluetooth-le';
import type { PluginListenerHandle } from '@capacitor/core';
import { StageBle, stageBleAvailable, stageKey } from '@/lib/stageBleNative';
import { STAGE_BLE_CHARACTERISTIC, decodeStageState, encodeStageState, seqBytes, stageServiceUuid, toBase64 } from '@/lib/stageBle';
import type { StageLiveState } from '@/lib/stageLive';

/**
 * - off: not running (web, demo, closed, no key);
 * - leading: the admin's phone is advertising;
 * - searching / connected: a member's phone looking for / linked to the leader;
 * - unavailable: Bluetooth off, not allowed, or not supported.
 */
export type StageBleStatus = 'off' | 'leading' | 'searching' | 'connected' | 'unavailable';

interface Options {
  eventId?: string;
  /** Saved setlist row ids, in saved order (the bytes refer to these). */
  savedIds: string[];
  open: boolean;
  isLeader: boolean;
  /** A checked state from the leader (members only). */
  onState: (state: StageLiveState) => void;
}

const RETRY_MS = 2000;

/**
 * Stage mode over Bluetooth, the offline twin of the Realtime channel in
 * useStageLive: the admin's phone serves the latest state as a Bluetooth
 * peripheral; members' phones find it by the gig's service UUID, subscribe
 * and read. Every state is checked with the gig's key (migration 087).
 */
export function useStageBle({ eventId, savedIds, open, isLeader, onState }: Options) {
  const [status, setStatus] = useState<StageBleStatus>('off');
  const onStateRef = useRef(onState);
  onStateRef.current = onState;
  const savedRef = useRef(savedIds);
  savedRef.current = savedIds;
  const keyRef = useRef<string | null>(null);
  const startedRef = useRef(false);
  const pendingRef = useRef<StageLiveState | null>(null);

  const active = open && !!eventId && stageBleAvailable() && savedIds.length > 0;

  const push = useCallback(async (state: StageLiveState) => {
    const key = keyRef.current;
    if (!key || !startedRef.current) {
      pendingRef.current = state;
      return;
    }
    const bytes = await encodeStageState(state, savedRef.current, key);
    if (!bytes) return;
    try {
      await StageBle.update({ value: toBase64(bytes), notify: toBase64(seqBytes(state.seq)) });
    } catch {
      /* Bluetooth off: the next state goes out when it's back */
    }
  }, []);

  /** Leader: serve this state over Bluetooth too. */
  const publish = useCallback(
    (state: StageLiveState) => {
      if (!isLeader) return;
      void push(state);
    },
    [isLeader, push],
  );

  // Leader: advertise while Stage mode is open.
  useEffect(() => {
    if (!active || !isLeader || !eventId) return;
    let cancelled = false;
    let listener: PluginListenerHandle | null = null;
    (async () => {
      const key = await stageKey(eventId);
      if (cancelled || !key) return;
      keyRef.current = key;
      const serviceUuid = await stageServiceUuid(key);
      listener = await StageBle.addListener('stateChange', ({ state }) => {
        setStatus(state === 'on' ? 'leading' : state === 'unknown' ? 'off' : 'unavailable');
      });
      if (cancelled) return;
      try {
        // Empty until the first move; members ignore it. Asks for Bluetooth the first time.
        const { state } = await StageBle.start({ serviceUuid, characteristicUuid: STAGE_BLE_CHARACTERISTIC, value: '', notify: '' });
        if (cancelled) return;
        startedRef.current = true;
        setStatus(state === 'on' ? 'leading' : state === 'unknown' ? 'off' : 'unavailable');
        const pending = pendingRef.current;
        pendingRef.current = null;
        if (pending) void push(pending);
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();
    return () => {
      cancelled = true;
      startedRef.current = false;
      pendingRef.current = null;
      void listener?.remove();
      void StageBle.stop().catch(() => {});
      setStatus('off');
    };
  }, [active, isLeader, eventId, push]);

  // Member: find the leader, subscribe, read on every change.
  useEffect(() => {
    if (!active || isLeader || !eventId) return;
    let cancelled = false;
    let deviceId: string | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let serviceUuid = '';
    let key = '';

    const readNow = async () => {
      const id = deviceId;
      if (!id) return;
      try {
        const view = await BleClient.read(id, serviceUuid, STAGE_BLE_CHARACTERISTIC);
        const result = await decodeStageState(new Uint8Array(view.buffer, view.byteOffset, view.byteLength), savedRef.current, key);
        if (!cancelled && result.ok) onStateRef.current(result.state);
      } catch {
        /* a dropped link is handled by onDisconnect */
      }
    };

    const later = () => {
      clearTimeout(retry);
      if (!cancelled) retry = setTimeout(() => void scan(), RETRY_MS);
    };

    const onDisconnect = () => {
      deviceId = null;
      if (cancelled) return;
      setStatus('searching');
      later();
    };

    const scan = async () => {
      if (cancelled) return;
      setStatus('searching');
      try {
        await BleClient.requestLEScan({ services: [serviceUuid] }, (result) => {
          if (deviceId || cancelled) return;
          const id = result.device.deviceId;
          deviceId = id;
          void (async () => {
            try {
              await BleClient.stopLEScan();
              await BleClient.connect(id, onDisconnect, { timeout: 10000 });
              await BleClient.startNotifications(id, serviceUuid, STAGE_BLE_CHARACTERISTIC, () => void readNow());
              if (cancelled) return;
              setStatus('connected');
              await readNow();
            } catch {
              deviceId = null;
              void BleClient.disconnect(id).catch(() => {});
              later();
            }
          })();
        });
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    };

    // Bluetooth off or the key not fetched yet: try again a little later.
    const boot = async () => {
      if (cancelled) return;
      const k = key || (await stageKey(eventId));
      if (cancelled) return;
      if (!k) {
        retry = setTimeout(() => void boot(), 15000);
        return;
      }
      key = k;
      serviceUuid = await stageServiceUuid(k);
      try {
        // Asks for Bluetooth the first time; Android 12+ never uses it for location.
        await BleClient.initialize({ androidNeverForLocation: true });
        if (!(await BleClient.isEnabled())) throw new Error('off');
      } catch {
        if (cancelled) return;
        setStatus('unavailable');
        retry = setTimeout(() => void boot(), 5000);
        return;
      }
      await scan();
    };
    void boot();

    return () => {
      cancelled = true;
      clearTimeout(retry);
      void BleClient.stopLEScan().catch(() => {});
      if (deviceId) void BleClient.disconnect(deviceId).catch(() => {});
      setStatus('off');
    };
    // A reloaded setlist doesn't drop the link: reads use savedRef.
  }, [active, isLeader, eventId]);

  return { status, publish };
}
