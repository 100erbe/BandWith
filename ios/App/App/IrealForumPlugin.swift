import UIKit
import WebKit
import Capacitor

/// The public iReal Pro forum inside the app, to import chord charts on
/// phones and tablets, where the forum's long-press "Copy Link" is not
/// offered for irealb:// links.
///
/// The forum opens in its own web view (it never shares cookies or scripts
/// with the app). A tap on an `irealb://` / `irealbook://` link (one song or a
/// playlist) closes it and hands the link to the app instead of the iReal Pro
/// app. Nothing is read from the forum's pages: the link the user taps is the
/// only thing passed back. Pages outside irealpro.com open in Safari.
///
/// JS (src/lib/irealForum.ts): `IrealForum.open({ url })` resolves
/// `{ link: string | null }` (null when the user closes the forum).
@objc(IrealForumPlugin)
public class IrealForumPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "IrealForumPlugin"
    public let jsName = "IrealForum"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise),
    ]

    private weak var browser: IrealForumViewController?

    @objc func open(_ call: CAPPluginCall) {
        guard let url = URL(string: call.getString("url") ?? ""), IrealForumViewController.isForum(url) else {
            call.reject("url must be an irealpro.com page")
            return
        }
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController, self.browser == nil else {
                call.resolve(["link": NSNull()])
                return
            }
            let vc = IrealForumViewController(url: url, title: call.getString("title")) { link in
                call.resolve(["link": link ?? NSNull()])
            }
            let nav = UINavigationController(rootViewController: vc)
            nav.modalPresentationStyle = .pageSheet
            nav.presentationController?.delegate = vc
            self.browser = vc
            presenter.present(nav, animated: true)
        }
    }
}

final class IrealForumViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, UIAdaptivePresentationControllerDelegate {
    private let startURL: URL
    private let onFinish: (String?) -> Void
    private var finished = false
    private let webView: WKWebView = {
        let config = WKWebViewConfiguration()
        // Its own data store: the forum never sees the app's storage.
        config.websiteDataStore = .nonPersistent()
        return WKWebView(frame: .zero, configuration: config)
    }()
    private let progress = UIProgressView(progressViewStyle: .bar)
    private var observation: NSKeyValueObservation?
    private var backItem: UIBarButtonItem?

    init(url: URL, title: String?, onFinish: @escaping (String?) -> Void) {
        startURL = url
        self.onFinish = onFinish
        super.init(nibName: nil, bundle: nil)
        self.title = title ?? "iReal Pro"
    }

    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    static func isForum(_ url: URL) -> Bool {
        guard url.scheme == "https", let host = url.host?.lowercased() else { return false }
        return host == "irealpro.com" || host.hasSuffix(".irealpro.com")
    }

    static func isIrealLink(_ url: URL) -> Bool {
        let scheme = url.scheme?.lowercased()
        return scheme == "irealb" || scheme == "irealbook"
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.translatesAutoresizingMaskIntoConstraints = false
        progress.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(webView)
        view.addSubview(progress)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            progress.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            progress.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            progress.trailingAnchor.constraint(equalTo: view.trailingAnchor),
        ])
        let close = UIBarButtonItem(systemItem: .close, primaryAction: UIAction { [weak self] _ in self?.finish(nil) })
        backItem = UIBarButtonItem(
            image: UIImage(systemName: "chevron.backward"),
            primaryAction: UIAction { [weak self] _ in self?.webView.goBack() }
        )
        backItem?.isEnabled = false
        navigationItem.leftBarButtonItems = [close, backItem].compactMap { $0 }
        observation = webView.observe(\.estimatedProgress, options: [.new]) { [weak self] web, _ in
            guard let self else { return }
            self.progress.progress = Float(web.estimatedProgress)
            self.progress.isHidden = web.estimatedProgress >= 1
            self.backItem?.isEnabled = web.canGoBack
        }
        webView.load(URLRequest(url: startURL))
    }

    private func finish(_ link: String?) {
        guard !finished else { return }
        finished = true
        webView.stopLoading()
        onFinish(link)
        dismiss(animated: true)
    }

    // A tap on an iReal link: hand it to the app, not to iReal Pro.
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.cancel) }
        if Self.isIrealLink(url) {
            decisionHandler(.cancel)
            finish(url.absoluteString)
            return
        }
        let mainFrame = navigationAction.targetFrame?.isMainFrame ?? true
        if mainFrame && !Self.isForum(url) && url.scheme != "about" {
            // Anything else the forum links to opens outside the app.
            decisionHandler(.cancel)
            if url.scheme == "http" || url.scheme == "https" { UIApplication.shared.open(url) }
            return
        }
        decisionHandler(.allow)
    }

    // target=_blank links load here instead of a new window.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
            if Self.isIrealLink(url) { finish(url.absoluteString) } else { webView.load(URLRequest(url: url)) }
        }
        return nil
    }

    // Swiped down: same as Close.
    func presentationControllerDidDismiss(_ presentationController: UIPresentationController) {
        guard !finished else { return }
        finished = true
        onFinish(nil)
    }
}
