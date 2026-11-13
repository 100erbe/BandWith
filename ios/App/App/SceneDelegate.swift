import UIKit
import Capacitor

// iOS 27 terminates apps that don't adopt the UIScene lifecycle, and
// Capacitor 8.1 doesn't ship a scene delegate. This one loads Main.storyboard
// (via Info.plist) and forwards URL opens and universal links to Capacitor,
// which the scene lifecycle no longer routes through the AppDelegate.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        // Keep AppDelegate.window pointing at the real window for plugins
        // that still look it up there.
        (UIApplication.shared.delegate as? AppDelegate)?.window = window

        // Cold launch from a URL or universal link.
        if let urlContext = connectionOptions.urlContexts.first {
            openURL(urlContext)
        }
        if let activity = connectionOptions.userActivities.first {
            continueActivity(activity)
        }
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        if let urlContext = URLContexts.first {
            openURL(urlContext)
        }
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        continueActivity(userActivity)
    }

    private func openURL(_ context: UIOpenURLContext) {
        var options: [UIApplication.OpenURLOptionsKey: Any] = [:]
        options[.sourceApplication] = context.options.sourceApplication
        options[.annotation] = context.options.annotation
        var url = context.url
        if url.isFileURL, let copy = Self.copyOpenedFile(url) { url = copy }
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: options)
    }

    /// A document opened with the app ("Open in BandWith", e.g. a MusicXML
    /// chord chart) may sit outside the sandbox, readable only while its
    /// security scope is open (documents open in place). The web app reads a
    /// private copy instead (src/lib/chartInbox.ts).
    private static func copyOpenedFile(_ url: URL) -> URL? {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let fm = FileManager.default
        let dir = fm.temporaryDirectory.appendingPathComponent("Opened", isDirectory: true)
        try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
        let dest = dir.appendingPathComponent(url.lastPathComponent)
        try? fm.removeItem(at: dest)
        do {
            try fm.copyItem(at: url, to: dest)
            return dest
        } catch {
            return nil
        }
    }

    private func continueActivity(_ activity: NSUserActivity) {
        _ = ApplicationDelegateProxy.shared.application(UIApplication.shared, continue: activity, restorationHandler: { _ in })
    }
}
