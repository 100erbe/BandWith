import Foundation
import Capacitor
import CoreBluetooth

/// Stage mode over Bluetooth, leader side: the band admin's phone becomes a
/// Bluetooth LE peripheral with one service (UUID derived from the gig's
/// key, see `src/lib/stageBle.ts`) and one characteristic:
/// - read: the full state (long reads are served by offset);
/// - notify: a short value (the seq); subscribers then read the full state.
/// No encryption is required, so members connect without pairing; every
/// state carries an HMAC that only band members can make.
///
/// Members' phones use @capacitor-community/bluetooth-le (central role).
///
/// JS: `StageBle.start({ serviceUuid, characteristicUuid, value, notify })`,
/// `update({ value, notify })`, `stop()` (values base64), and the
/// `stateChange` event `{ state, subscribers }` with state on | off |
/// unauthorized | unsupported | unknown.
@objc(StageBlePlugin)
public class StageBlePlugin: CAPPlugin, CAPBridgedPlugin, CBPeripheralManagerDelegate {
    public let identifier = "StageBlePlugin"
    public let jsName = "StageBle"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise),
    ]

    private var manager: CBPeripheralManager?
    private var serviceUUID: CBUUID?
    private var characteristicUUID: CBUUID?
    private var characteristic: CBMutableCharacteristic?
    private var serviceAdded = false
    private var value = Data()
    private var notifyValue = Data()
    private var subscribers: [CBCentral] = []
    private var notifyPending = false

    @objc func start(_ call: CAPPluginCall) {
        guard let service = call.getString("serviceUuid"), let char = call.getString("characteristicUuid"),
              let value = Data(base64Encoded: call.getString("value") ?? ""),
              let notify = Data(base64Encoded: call.getString("notify") ?? "")
        else {
            call.reject("serviceUuid, characteristicUuid, value and notify are required")
            return
        }
        DispatchQueue.main.async {
            let newService = CBUUID(string: service)
            if self.serviceUUID != newService { self.teardown() }
            self.serviceUUID = newService
            self.characteristicUUID = CBUUID(string: char)
            self.value = value
            self.notifyValue = notify
            if self.manager == nil {
                // Creating the manager shows the Bluetooth permission prompt the first time.
                self.manager = CBPeripheralManager(delegate: self, queue: nil)
            } else {
                self.setUpIfReady()
            }
            call.resolve(["state": self.stateName()])
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        guard let value = Data(base64Encoded: call.getString("value") ?? ""),
              let notify = Data(base64Encoded: call.getString("notify") ?? "")
        else {
            call.reject("value and notify are required")
            return
        }
        DispatchQueue.main.async {
            self.value = value
            self.notifyValue = notify
            self.sendNotify()
            call.resolve()
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.teardown()
            self.serviceUUID = nil
            call.resolve()
        }
    }

    // MARK: - Peripheral

    private func stateName() -> String {
        switch manager?.state {
        case .poweredOn: return "on"
        case .poweredOff: return "off"
        case .unauthorized: return "unauthorized"
        case .unsupported: return "unsupported"
        default: return "unknown"
        }
    }

    private func emitState() {
        notifyListeners("stateChange", data: ["state": stateName(), "subscribers": subscribers.count])
    }

    private func teardown() {
        manager?.stopAdvertising()
        manager?.removeAllServices()
        characteristic = nil
        serviceAdded = false
        subscribers.removeAll()
        notifyPending = false
    }

    private func setUpIfReady() {
        guard let manager = manager, manager.state == .poweredOn, !serviceAdded,
              let serviceUUID = serviceUUID, let characteristicUUID = characteristicUUID
        else { return }
        // Value nil: reads come to the delegate, so they always get the latest state.
        let char = CBMutableCharacteristic(type: characteristicUUID, properties: [.read, .notify], value: nil, permissions: [.readable])
        let service = CBMutableService(type: serviceUUID, primary: true)
        service.characteristics = [char]
        characteristic = char
        serviceAdded = true
        manager.add(service)
    }

    private func sendNotify() {
        guard let manager = manager, let char = characteristic, !subscribers.isEmpty else { return }
        notifyPending = !manager.updateValue(notifyValue, for: char, onSubscribedCentrals: nil)
    }

    public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        if peripheral.state == .poweredOn {
            setUpIfReady()
        } else {
            // Services are dropped when Bluetooth goes off; add them again when it's back.
            serviceAdded = false
            characteristic = nil
            subscribers.removeAll()
        }
        emitState()
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, didAdd service: CBService, error: Error?) {
        if error != nil {
            serviceAdded = false
            emitState()
            return
        }
        // iOS advertises only service UUIDs and a local name (no data); in the
        // background the UUID moves to the overflow area.
        peripheral.startAdvertising([CBAdvertisementDataServiceUUIDsKey: [service.uuid]])
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveRead request: CBATTRequest) {
        guard request.characteristic.uuid == characteristicUUID else {
            peripheral.respond(to: request, withResult: .attributeNotFound)
            return
        }
        if request.offset > value.count {
            peripheral.respond(to: request, withResult: .invalidOffset)
            return
        }
        request.value = value.subdata(in: request.offset..<value.count)
        peripheral.respond(to: request, withResult: .success)
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didSubscribeTo characteristic: CBCharacteristic) {
        if !subscribers.contains(where: { $0.identifier == central.identifier }) { subscribers.append(central) }
        sendNotify()
        emitState()
    }

    public func peripheralManager(_ peripheral: CBPeripheralManager, central: CBCentral, didUnsubscribeFrom characteristic: CBCharacteristic) {
        subscribers.removeAll { $0.identifier == central.identifier }
        emitState()
    }

    public func peripheralManagerIsReady(toUpdateSubscribers peripheral: CBPeripheralManager) {
        if notifyPending { sendNotify() }
    }
}
