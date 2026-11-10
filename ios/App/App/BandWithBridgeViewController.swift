import UIKit
import WebKit
import Capacitor

/// Capacitor's bridge, plus the display regions iOS reserves on this device,
/// exposed to the web app.
///
/// On iPhone Duo (iOS 27.1+) the camera, clock, battery and Wi-Fi sit in a
/// column at the top-right of each display, and the inner display has a fold
/// (a "division" region). The web view stays full screen; the web app reads
/// these regions to keep its top-right controls clear of the system column and
/// to split into two panes at the fold. On other devices both are absent.
///
/// Web contract (see `src/lib/deviceRegions.ts`):
/// - CSS vars on :root: `--bw-status-clear-x` (width of the system column
///   measured from the trailing edge) and `--bw-status-clear-y` (its bottom).
/// - `window.__bwRegions` with `status`, `division` and `viewport` rects, and
///   a `bwregions` event on window whenever they change.
final class BandWithBridgeViewController: CAPBridgeViewController, WKScriptMessageHandler {

    private static let readyMessage = "bwRegionsReady"
    private var lastPayload: String?

    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        // Capacitor installs its own user content controller while building
        // the web view, so ours is added here, once that is done.
        guard let controller = webView?.configuration.userContentController else { return }
        controller.add(WeakScriptMessageHandler(self), name: Self.readyMessage)
        controller.addUserScript(WKUserScript(source: Self.bootstrapScript, injectionTime: .atDocumentStart, forMainFrameOnly: true))
    }

    override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        publishRegions(force: false)
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        // The page (re)loaded and installed its receiver: send current state.
        if message.name == Self.readyMessage { publishRegions(force: true) }
    }

    // MARK: - Regions

    private func publishRegions(force: Bool) {
        let bounds = view.bounds
        var status: CGRect?
        var division: CGRect?

        if #available(iOS 27.1, *) {
            for region in view.reservedRegions(kind: .occlusion) where region.isActive {
                let frame = region.frame
                // Only the column hugging the trailing edge: a centred camera
                // cutout is already covered by the safe area.
                if frame.maxX >= bounds.maxX - 1 && frame.minX > bounds.midX {
                    status = status.map { $0.union(frame) } ?? frame
                }
            }
            for region in view.reservedRegions(kind: .division) where region.isActive {
                division = division.map { $0.union(region.frame) } ?? region.frame
            }
        }

        func rect(_ r: CGRect?) -> String {
            guard let r else { return "null" }
            return "{\"x\":\(Int(r.minX.rounded(.down))),\"y\":\(Int(r.minY.rounded(.down))),\"w\":\(Int(r.width.rounded(.up))),\"h\":\(Int(r.height.rounded(.up)))}"
        }
        let payload = "{\"status\":\(rect(status)),\"division\":\(rect(division)),\"viewport\":{\"w\":\(Int(bounds.width)),\"h\":\(Int(bounds.height))}}"

        guard force || payload != lastPayload else { return }
        lastPayload = payload
        webView?.evaluateJavaScript("window.__bwApplyRegions && window.__bwApplyRegions(\(payload));", completionHandler: nil)
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
        root.style.setProperty('--bw-status-clear-x', s ? Math.max(0, vw - s.x) + 'px' : '0px');
        root.style.setProperty('--bw-status-clear-y', s ? (s.y + s.h) + 'px' : '0px');
        root.toggleAttribute('data-bw-status-column', !!s);
        root.toggleAttribute('data-bw-fold', !!r.division);
        window.dispatchEvent(new CustomEvent('bwregions', { detail: r }));
      }
      window.__bwApplyRegions = apply;
      root.style.setProperty('--bw-status-clear-x', '0px');
      root.style.setProperty('--bw-status-clear-y', '0px');
      document.addEventListener('DOMContentLoaded', function () {
        window.webkit.messageHandlers.\(BandWithBridgeViewController.readyMessage).postMessage('ready');
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
