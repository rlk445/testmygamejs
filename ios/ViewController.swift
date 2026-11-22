import UIKit
import WebKit
import AVFoundation
import Network

final class ViewController: UIViewController, WKUIDelegate, WKNavigationDelegate {
    private var web: WKWebView!
    private let bridge = BrowserBridge()                 // navegador dentro do VR
    private var server: LocalServer?
    private var lanBrowser: NWBrowser?
    private let port: UInt16 = 38219                     // porta fixa: o localStorage (ajustes e recordes) fica sempre no mesmo endereço

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }

    override func loadView() {
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        cfg.userContentController.add(bridge, name: "vrbrowser")
        web = WKWebView(frame: .zero, configuration: cfg)
        web.uiDelegate = self
        web.navigationDelegate = self
        web.isOpaque = false
        web.backgroundColor = .black
        web.scrollView.backgroundColor = .black
        web.scrollView.isScrollEnabled = false
        web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { web.isInspectable = true }
        let box = UIView()
        box.backgroundColor = .black
        web.frame = box.bounds
        web.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        box.addSubview(web)
        view = box
        bridge.attach(main: web, host: box)
    }

    // Som no iPhone (fones Bluetooth): a câmera/WebRTC faz o WebKit trocar a sessão de áudio e o som cai no alto-falante do iPhone ou no fone de ouvido do topo.
    // playAndRecord + A2DP + alto-falante como padrão: se houver fone Bluetooth conectado, ele é a saída; senão, o alto-falante. Reaplicado sempre que o iOS mexer.
    private var audioTimer: Timer?
    private func configureAudio() {
        let s = AVAudioSession.sharedInstance()
        do {
            try s.setCategory(.playAndRecord, mode: .default, options: [.allowBluetoothA2DP, .defaultToSpeaker, .mixWithOthers])
            try s.setActive(true)
        } catch { }
    }
    private func startAudioGuard() {
        configureAudio()
        let nc = NotificationCenter.default
        [AVAudioSession.routeChangeNotification, AVAudioSession.interruptionNotification, AVAudioSession.mediaServicesWereResetNotification,
         UIApplication.didBecomeActiveNotification, UIApplication.willEnterForegroundNotification].forEach {
            nc.addObserver(forName: $0, object: nil, queue: .main) { [weak self] _ in self?.configureAudio() }
        }
        audioTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: true) { [weak self] _ in
            let s = AVAudioSession.sharedInstance()
            if s.category != .playAndRecord || !s.categoryOptions.contains(.allowBluetoothA2DP) { self?.configureAudio() }
        }
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        startAudioGuard()                                                         // som no iPhone / fone Bluetooth (ver abaixo)
        triggerLocalNetworkPrompt()
        guard let www = Bundle.main.url(forResource: "www", withExtension: nil) else { show("Pasta www não encontrada no app."); return }
        let s = LocalServer(root: www, port: port)
        server = s
        s.start(onReady: { [weak self] in
            DispatchQueue.main.async {
                guard let self = self, let url = URL(string: "http://localhost:\(self.port)/index.html") else { return }
                self.web.load(URLRequest(url: url))
            }
        }, onFail: { [weak self] msg in
            DispatchQueue.main.async { self?.show("Não foi possível iniciar o servidor local: \(msg)") }
        })
    }

    /// Faz o iOS mostrar já na abertura o pedido "SKZ VR quer encontrar dispositivos na rede local".
    /// Sem essa permissão o app não alcança o PC (fica em "Procurando o PC").
    private func triggerLocalNetworkPrompt() {
        let b = NWBrowser(for: .bonjour(type: "_skzvr._tcp", domain: nil), using: NWParameters())
        b.stateUpdateHandler = { _ in }
        b.browseResultsChangedHandler = { _, _ in }
        b.start(queue: .main)
        lanBrowser = b
    }

    private func show(_ msg: String) {
        web.loadHTMLString("<body style='background:#000;color:#fff;font:20px -apple-system;padding:30px'>\(msg)</body>", baseURL: nil)
    }

    // a câmera do app é liberada sem perguntar de novo (o iOS já pediu a permissão do app)
    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo,
                 type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(.grant) }

    @available(iOS 15.0, *)
    func webView(_ webView: WKWebView, requestDeviceOrientationAndMotionPermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(.grant) }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}
