import UIKit
import WebKit
import Capacitor
import UserNotifications

/// Capacitor's bridge, plus the display regions iOS reserves on this device,
/// exposed to the web app.
///
/// On iPhone Duo (iOS 27.1+) the camera, clock, battery and Wi-Fi sit in a
/// column along one edge of each display, and the inner display has a fold
/// (a "division" region). The web view stays full screen; the web app reads
/// these regions to keep its controls clear of the system column, to split
/// into two panes at a vertical fold, and to switch to Laptop pose at a
/// horizontal one. On other devices the regions are absent.
///
/// Web contract (see `src/lib/deviceRegions.ts` and `src/lib/posture.ts`):
/// - CSS vars on :root: `--bw-status-clear-x` (width of a trailing system
///   column, from the trailing edge), `--bw-status-clear-left` (width of a
///   leading one) and `--bw-status-clear-y` (the column's bottom).
/// - Attributes on :root: `data-bw-status-column`, `data-bw-status-edge`
///   (left | right | top | bottom) and `data-bw-fold`.
/// - `window.__bwRegions` with `status` (rect + `edge`), `division`,
///   `viewport`, `window` (the app window in screen coordinates), `screen`
///   (screen size, for Split View) and `hinge` (`status`: closed | partial |
///   open | unknown, `angle` in degrees), and a `bwregions` event on window
///   whenever they change.
/// - Keep awake: the page sets `data-bw-keep-awake="1"` on :root (or posts
///   to `webkit.messageHandlers.bwKeepAwake`) and the idle timer stays off
///   until it is removed.
/// - App badge: the page posts the unread count to
///   `webkit.messageHandlers.bwBadge`; the icon shows it, and 0 also clears
///   the delivered notifications from Notification Center.
final class BandWithBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {

    private static let readyMessage = "bwRegionsReady"
    private static let keepAwakeMessage = "bwKeepAwake"
    private static let badgeMessage = "bwBadge"
    private var lastPayload: String?
    /// UIHingeInteraction (iOS 27.1+), typed as its protocol so the stored
    /// property needs no availability annotation.
    private var hingeInteraction: UIInteraction?
    /// Last hinge reading as a JSON fragment, or "null" when none.
    private var hingeJSON = "null"

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // Capacitor installs its own user content controller while building
        // the web view, so ours is added here, once that is done.
        guard let controller = webView?.configuration.userContentController else { return }
        controller.add(WeakScriptMessageHandler(self), name: Self.readyMessage)
        controller.add(WeakScriptMessageHandler(self), name: Self.keepAwakeMessage)
        controller.add(WeakScriptMessageHandler(self), name: Self.badgeMessage)
        controller.addUserScript(WKUserScript(source: Self.bootstrapScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        installHingeObserver()
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        publishRegions(force: false)
    }

    override func viewWillTransition(to size: CGSize, with coordinator: UIViewControllerTransitionCoordinator) {
        super.viewWillTransition(to: size, with: coordinator)
        // Split View resizes and rotations change the window frame.
        coordinator.animate(alongsideTransition: nil) { [weak self] _ in
            self?.publishRegions(force: false)
        }
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        switch message.name {
        case Self.readyMessage:
            // The page (re)loaded and installed its receiver: send current
            // state, and drop any keep-awake left by the previous page.
            UIApplication.shared.isIdleTimerDisabled = false
            publishRegions(force: true)
        case Self.keepAwakeMessage:
            UIApplication.shared.isIdleTimerDisabled = Self.flag(message.body)
        case Self.badgeMessage:
            Self.setBadge((message.body as? NSNumber)?.intValue ?? 0)
        default:
            break
        }
    }

    /// The number on the app icon. Pushes set it from the server; the app
    /// brings it back in line once notifications are read or deleted.
    private static func setBadge(_ count: Int) {
        let center = UNUserNotificationCenter.current()
        let n = max(0, count)
        if #available(iOS 16.0, *) {
            center.setBadgeCount(n) { _ in }
        } else {
            DispatchQueue.main.async { UIApplication.shared.applicationIconBadgeNumber = n }
        }
        if n == 0 { center.removeAllDeliveredNotifications() }
    }

    private static func flag(_ body: Any) -> Bool {
        if let n = body as? NSNumber { return n.boolValue }
        if let s = body as? String { return s == "1" || s == "true" || s == "on" }
        return false
    }

    // MARK: - Hinge

    private func installHingeObserver() {
        guard hingeInteraction == nil else { return }
        if #available(iOS 27.1, *) {
            let interaction = UIHingeInteraction { [weak self] _, update in
                guard let self else { return }
                if let hinge = update.hinge {
                    let status: String
                    switch hinge.status {
                    case .closed: status = "closed"
                    case .partiallyOpen: status = "partial"
                    case .fullyOpen: status = "open"
                    case .unknown: status = "unknown"
                    @unknown default: status = "unknown"
                    }
                    let degrees = hinge.angle * 180 / .pi
                    let angle = degrees.isFinite ? String(Int(degrees.rounded())) : "null"
                    self.hingeJSON = "{\"status\":\"\(status)\",\"angle\":\(angle)}"
                } else {
                    // Left a hierarchy that provides hinge updates.
                    self.hingeJSON = "null"
                }
                self.publishRegions(force: false)
            }
            view.addInteraction(interaction)
            hingeInteraction = interaction
        }
    }

    // MARK: - Regions

    private enum Edge: String { case left, right, top, bottom }

    private func publishRegions(force: Bool) {
        let bounds = view.bounds
        var status: CGRect?
        var statusEdge: Edge?
        var division: CGRect?

        if #available(iOS 27.1, *) {
            // Union the occlusion regions per edge, then keep the largest:
            // that is the system column. A centred camera cutout matches no
            // edge (the safe area already covers it).
            // An iPad has no side system column: in landscape iPadOS reports
            // its status strip as a narrow full-height band on the left,
            // which must not turn into the Duo rail. Only a top/bottom strip
            // counts there.
            let isPad = traitCollection.userInterfaceIdiom == .pad
            var byEdge: [Edge: CGRect] = [:]
            for region in view.reservedRegions(kind: .occlusion) where region.isActive {
                guard let edge = Self.edge(of: region.frame, in: bounds) else { continue }
                if isPad && (edge == .left || edge == .right) { continue }
                byEdge[edge] = byEdge[edge].map { $0.union(region.frame) } ?? region.frame
            }
            if let best = byEdge.max(by: { $0.value.width * $0.value.height < $1.value.width * $1.value.height }) {
                status = best.value
                statusEdge = best.key
            }
            for region in view.reservedRegions(kind: .division) where region.isActive {
                division = division.map { $0.union(region.frame) } ?? region.frame
            }
        }

        func rect(_ r: CGRect?) -> String {
            guard let r, r.minX.isFinite, r.minY.isFinite, r.width.isFinite, r.height.isFinite else { return "null" }
            return "{\"x\":\(Int(r.minX.rounded(.down))),\"y\":\(Int(r.minY.rounded(.down))),\"w\":\(Int(r.width.rounded(.up))),\"h\":\(Int(r.height.rounded(.up)))}"
        }
        var statusJSON = rect(status)
        if let edge = statusEdge, statusJSON != "null" {
            statusJSON = String(statusJSON.dropLast()) + ",\"edge\":\"\(edge.rawValue)\"}"
        }

        // The app window against the screen: narrower means Split View.
        var windowJSON = "null"
        var screenJSON = "null"
        if let window = view.window, let screen = window.windowScene?.screen {
            let frame = window.convert(window.bounds, to: screen.coordinateSpace)
            windowJSON = rect(frame)
            let sb = screen.bounds
            screenJSON = "{\"w\":\(Int(sb.width.rounded())),\"h\":\(Int(sb.height.rounded()))}"
        }

        let payload = "{\"status\":\(statusJSON),\"division\":\(rect(division)),\"viewport\":{\"w\":\(Int(bounds.width)),\"h\":\(Int(bounds.height))},\"window\":\(windowJSON),\"screen\":\(screenJSON),\"hinge\":\(hingeJSON)}"

        guard force || payload != lastPayload else { return }
        lastPayload = payload
        webView?.evaluateJavaScript("window.__bwApplyRegions && window.__bwApplyRegions(\(payload));", completionHandler: nil)
    }

    /// The edge a reserved region hugs, or nil when it hugs none (or sits
    /// centred on it, like a camera cutout).
    private static func edge(of frame: CGRect, in bounds: CGRect) -> Edge? {
        // The trailing column, exactly as before: touches the right edge and
        // lies wholly in the right half.
        if frame.maxX >= bounds.maxX - 1 && frame.minX > bounds.midX { return .right }
        if frame.minX <= bounds.minX + 1 && frame.maxX < bounds.midX && frame.height >= frame.width { return .left }
        // Top and bottom bands must also start in a corner, so a centred
        // cutout along the top is never taken for a column.
        let inCorner = frame.minX <= bounds.minX + 1 || frame.maxX >= bounds.maxX - 1
        if frame.minY <= bounds.minY + 1 && frame.maxY < bounds.midY && frame.width > frame.height && inCorner { return .top }
        if frame.maxY >= bounds.maxY - 1 && frame.minY > bounds.midY && frame.width > frame.height && inCorner { return .bottom }
        return nil
    }

    /// Installs the receiver before the app's own scripts run, with neutral
    /// defaults, then asks native for the real values once the DOM exists.
    private static let bootstrapScript = """
    (function () {
      var root = document.documentElement;
      function apply(r) {
        window.__bwRegions = r;
        var vw = (r.viewport && r.viewport.w) || window.innerWidth;
        var s = r.status;
        var edge = s ? (s.edge || 'right') : null;
        root.style.setProperty('--bw-status-clear-x', s && edge === 'right' ? Math.max(0, vw - s.x) + 'px' : '0px');
        root.style.setProperty('--bw-status-clear-left', s && edge === 'left' ? Math.max(0, s.x + s.w) + 'px' : '0px');
        root.style.setProperty('--bw-status-clear-y', s && edge !== 'bottom' ? (s.y + s.h) + 'px' : '0px');
        root.toggleAttribute('data-bw-status-column', !!s);
        if (edge) root.setAttribute('data-bw-status-edge', edge); else root.removeAttribute('data-bw-status-edge');
        root.toggleAttribute('data-bw-fold', !!r.division);
        window.dispatchEvent(new CustomEvent('bwregions', { detail: r }));
      }
      window.__bwApplyRegions = apply;
      root.style.setProperty('--bw-status-clear-x', '0px');
      root.style.setProperty('--bw-status-clear-left', '0px');
      root.style.setProperty('--bw-status-clear-y', '0px');
      function postKeepAwake() {
        try {
          window.webkit.messageHandlers.\(BandWithBridgeViewController.keepAwakeMessage).postMessage(root.getAttribute('data-bw-keep-awake') === '1');
        } catch (e) {}
      }
      new MutationObserver(postKeepAwake).observe(root, { attributes: true, attributeFilter: ['data-bw-keep-awake'] });
      document.addEventListener('DOMContentLoaded', function () {
        window.webkit.messageHandlers.\(BandWithBridgeViewController.readyMessage).postMessage('ready');
        // Native clears keep-awake on ready; restate it in case the app
        // already asked before this point (messages arrive in order).
        postKeepAwake();
      });
    })();
    """
}

/// WKUserContentController retains its handlers; this breaks the cycle.
private final class WeakScriptMessageHandler: NSObject, WKScriptMessageHandler {
    weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
