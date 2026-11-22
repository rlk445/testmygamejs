import UIKit
import WebKit

/// Navegador dentro do VR no modo iPhone (sem PC).
/// Um segundo WKWebView (motor do Safari) fica escondido atrás do jogo. Este código:
///  - recebe os comandos do jogo (clique, rolagem, texto, navegar...) por webkit.messageHandlers.vrbrowser
///  - tira fotos da página ~12x por segundo e entrega para o jogo em /__br/frame.jpg (servido pelo LocalServer)
///  - avisa o jogo do endereço/título e de quando um campo de texto está em foco
final class BrowserBridge: NSObject, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate {
    private static let lock = NSLock()
    private static var frameData = Data()
    static func latestFrame() -> Data { lock.lock(); defer { lock.unlock() }; return frameData }
    private static func setFrame(_ d: Data) { lock.lock(); frameData = d; lock.unlock() }

    weak var main: WKWebView?
    weak var host: UIView?
    private var page: WKWebView?
    private var vw: CGFloat = 960
    private let outW: CGFloat = 1120
    private var timer: Timer?
    private var infoTimer: Timer?
    private var busy = false
    private var lastInfo = ""
    private let encQueue = DispatchQueue(label: "br.encode")

    func attach(main: WKWebView, host: UIView) { self.main = main; self.host = host }

    // ---------- a página escondida ----------
    private func makePage() -> WKWebView {
        if let p = page { return p }
        let cfg = WKWebViewConfiguration()
        cfg.allowsInlineMediaPlayback = true
        cfg.mediaTypesRequiringUserActionForPlayback = []
        let prefs = WKWebpagePreferences()
        prefs.preferredContentMode = .desktop
        cfg.defaultWebpagePreferences = prefs
        cfg.userContentController.addUserScript(WKUserScript(source: BrowserBridge.helperJS, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let w = WKWebView(frame: CGRect(x: 0, y: 0, width: vw, height: (vw * 9 / 16).rounded()), configuration: cfg)
        w.uiDelegate = self
        w.navigationDelegate = self
        w.allowsBackForwardNavigationGestures = false
        host?.insertSubview(w, at: 0)          // atrás do jogo (o jogo cobre a tela inteira)
        page = w
        return w
    }

    private func setView(_ v: CGFloat) {
        vw = max(480, min(1600, v))
        guard let w = page else { return }
        w.frame = CGRect(x: 0, y: 0, width: vw, height: (vw * 9 / 16).rounded())
    }

    private func start(url: String?, width: CGFloat?) {
        let w = makePage()
        if let v = width { setView(v) }
        if w.url == nil, let u = url, let uu = URL(string: u) { w.load(URLRequest(url: uu)) }
        post(["t": "ready"])
        startLoops()
    }

    // ---------- fotos da página ----------
    private func startLoops() {
        if timer == nil { timer = Timer.scheduledTimer(withTimeInterval: 1.0 / 12.0, repeats: true) { [weak self] _ in self?.snap() } }
        if infoTimer == nil { infoTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in self?.poll() } }
        lastInfo = ""
    }

    private func stopLoops() {
        timer?.invalidate(); timer = nil
        infoTimer?.invalidate(); infoTimer = nil
    }

    private func snap() {
        guard !busy, let w = page else { return }
        busy = true
        let c = WKSnapshotConfiguration()
        c.rect = w.bounds
        c.snapshotWidth = NSNumber(value: Double(outW / UIScreen.main.scale))     // largura final em pixels = outW
        w.takeSnapshot(with: c) { [weak self] img, _ in
            guard let self = self else { return }
            guard let img = img else { self.busy = false; return }
            self.encQueue.async {
                if let d = img.jpegData(compressionQuality: 0.6) {
                    BrowserBridge.setFrame(d)
                    DispatchQueue.main.async {
                        self.main?.evaluateJavaScript("window.VR&&VR.browser&&VR.browser.nativeTick&&VR.browser.nativeTick()", completionHandler: nil)
                    }
                }
                DispatchQueue.main.async { self.busy = false }
            }
        }
    }

    private func poll() {
        guard let w = page else { return }
        w.evaluateJavaScript("window.__vr ? window.__vr.ed() : 0") { [weak self, weak w] r, _ in
            guard let self = self, let w = w else { return }
            let ed = ((r as? NSNumber)?.intValue ?? 0) != 0
            let url = w.url?.absoluteString ?? ""
            let title = w.title ?? ""
            let key = url + "\u{1}" + title + "\u{1}" + (ed ? "1" : "0")
            if key == self.lastInfo { return }
            self.lastInfo = key
            self.post(["t": "info", "url": url, "title": title, "ed": ed])
        }
    }

    // ---------- conversa com o jogo ----------
    private func post(_ o: [String: Any]) {
        guard let d = try? JSONSerialization.data(withJSONObject: [o]), let s = String(data: d, encoding: .utf8) else { return }
        main?.evaluateJavaScript("window.VR&&VR.browser&&VR.browser.nativeMsg&&VR.browser.nativeMsg(" + s + "[0])", completionHandler: nil)
    }

    private func run(_ code: String) { page?.evaluateJavaScript(code, completionHandler: nil) }

    private func lit(_ s: String) -> String {
        if let d = try? JSONSerialization.data(withJSONObject: [s]), let t = String(data: d, encoding: .utf8) { return String(t.dropFirst().dropLast()) }
        return "\"\""
    }

    func userContentController(_ uc: WKUserContentController, didReceive m: WKScriptMessage) {
        guard let s = m.body as? String, let d = s.data(using: .utf8),
              let o = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any],
              let t = o["t"] as? String else { return }
        func num(_ k: String) -> Double { return (o[k] as? NSNumber)?.doubleValue ?? 0 }
        let x = String(format: "%.1f", num("x") * Double(vw))
        let y = String(format: "%.1f", num("y") * Double(vw) * 9.0 / 16.0)
        switch t {
        case "open":
            let width: CGFloat? = (o["vw"] as? NSNumber).map { CGFloat($0.doubleValue) }
            start(url: o["url"] as? String, width: width)
        case "stop":
            stopLoops()
        case "view":
            if let n = o["w"] as? NSNumber { setView(CGFloat(n.doubleValue)) }
        case "nav":
            if let u = o["url"] as? String, let url = URL(string: u), ["http", "https", "about"].contains(url.scheme ?? "") { page?.load(URLRequest(url: url)) }
        case "cmd":
            let c = (o["c"] as? String) ?? ""
            if c == "back" { page?.goBack() } else if c == "forward" { page?.goForward() } else if c == "reload" { page?.reload() }
        case "m":
            let k = (o["k"] as? String) ?? ""
            let dragging = ((o["d"] as? NSNumber)?.intValue ?? 0) != 0
            if k == "down" { run("window.__vr&&__vr.mdown(" + x + "," + y + ")") }
            else if k == "up" { run("window.__vr&&__vr.mup(" + x + "," + y + ")") }
            else if dragging { run("window.__vr&&__vr.mmove(" + x + "," + y + ")") }
        case "wheel":
            let dx = String(format: "%.1f", num("dx"))
            let dy = String(format: "%.1f", num("dy"))
            run("window.__vr&&__vr.wheel(" + x + "," + y + "," + dx + "," + dy + ")")
        case "text":
            if let s = o["s"] as? String { run("window.__vr&&__vr.type(" + lit(s) + ")") }
        case "key":
            if let k = o["k"] as? String { run("window.__vr&&__vr.key(" + lit(k) + ")") }
        default:
            break
        }
    }

    // links com target=_blank abrem na mesma página
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil { webView.load(navigationAction.request) }
        return nil
    }

    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }

    // ---------- script injetado em todas as páginas: simula mouse e teclado ----------
    static let helperJS = #"""
(function(){
if(window.__vr)return;
var D=document,down=null;
function at(x,y){return D.elementFromPoint(x,y)}
function mev(el,t,x,y,b){try{el.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,button:0,buttons:b}))}catch(e){}}
function pev(el,t,x,y,b){try{el.dispatchEvent(new PointerEvent(t,{bubbles:true,cancelable:true,view:window,clientX:x,clientY:y,pointerId:1,pointerType:'mouse',isPrimary:true,button:0,buttons:b}))}catch(e){}}
function ed(a){if(!a)return 0;if(a.isContentEditable||a.tagName==='TEXTAREA')return 1;if(a.tagName==='INPUT')return /^(checkbox|radio|button|submit|range|color|file|image|reset|hidden)$/i.test(a.type)?0:1;return 0}
function setVal(a,v){var p=a.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,d=Object.getOwnPropertyDescriptor(p,'value');if(d&&d.set)d.set.call(a,v);else a.value=v}
function fireInput(a,type,data){try{a.dispatchEvent(new InputEvent('input',{bubbles:true,data:data||null,inputType:type}))}catch(e){a.dispatchEvent(new Event('input',{bubbles:true}))}}
function ins(s){var a=D.activeElement;if(!a)return;
 if(a.isContentEditable){D.execCommand('insertText',false,s);return}
 if(a.tagName!=='INPUT'&&a.tagName!=='TEXTAREA')return;
 var v=a.value,st=a.selectionStart,en=a.selectionEnd;if(st==null){st=en=v.length}
 setVal(a,v.slice(0,st)+s+v.slice(en));try{a.setSelectionRange(st+s.length,st+s.length)}catch(e){}
 fireInput(a,'insertText',s)}
function back(){var a=D.activeElement;if(!a)return;
 if(a.isContentEditable){D.execCommand('delete');return}
 if(a.tagName!=='INPUT'&&a.tagName!=='TEXTAREA')return;
 var v=a.value,st=a.selectionStart,en=a.selectionEnd;if(st==null){st=en=v.length}
 if(st===en&&st>0)st--;
 setVal(a,v.slice(0,st)+v.slice(en));try{a.setSelectionRange(st,st)}catch(e){}
 fireInput(a,'deleteContentBackward')}
var KC={Enter:13,Backspace:8,Tab:9,Escape:27,ArrowUp:38,ArrowDown:40,ArrowLeft:37,ArrowRight:39};
window.__vr={
 ed:function(){return ed(D.activeElement)},
 mdown:function(x,y){var el=at(x,y);down=el;if(!el)return;pev(el,'pointerdown',x,y,1);mev(el,'mousedown',x,y,1);
  var f=el.closest&&el.closest('input,textarea,[contenteditable=""],[contenteditable="true"]');
  if(f){try{f.focus()}catch(e){}}else{var ae=D.activeElement;if(ae&&ed(ae)){try{ae.blur()}catch(e){}}}},
 mmove:function(x,y){var el=at(x,y)||down;if(el){pev(el,'pointermove',x,y,1);mev(el,'mousemove',x,y,1)}},
 mup:function(x,y){var el=at(x,y)||down;if(!el){down=null;return}pev(el,'pointerup',x,y,0);mev(el,'mouseup',x,y,0);
  if(down&&(el===down||(el.contains&&el.contains(down))||(down.contains&&down.contains(el))))mev(el,'click',x,y,0);down=null},
 wheel:function(x,y,dx,dy){var el=at(x,y);
  while(el&&el!==D.body&&el!==D.documentElement){var cs=getComputedStyle(el),oy=cs.overflowY,ox=cs.overflowX,
   cy=dy&&(oy==='auto'||oy==='scroll')&&el.scrollHeight>el.clientHeight+1,cx=dx&&(ox==='auto'||ox==='scroll')&&el.scrollWidth>el.clientWidth+1;
   if(cy||cx){el.scrollBy(cx?dx:0,cy?dy:0);return}el=el.parentElement}
  window.scrollBy(dx,dy)},
 type:function(s){ins(s)},
 key:function(k){var a=D.activeElement||D.body,o={key:k,code:k,keyCode:KC[k],which:KC[k],bubbles:true,cancelable:true};
  var ok=a.dispatchEvent(new KeyboardEvent('keydown',o));
  if(k==='Backspace'){if(ok)back()}
  else if(k==='Enter'){a.dispatchEvent(new KeyboardEvent('keypress',o));
   if(ok){if(a.tagName==='TEXTAREA'||a.isContentEditable)ins('\n');else if(a.tagName==='INPUT'&&a.form){if(a.form.requestSubmit)a.form.requestSubmit();else a.form.submit()}}}
  a.dispatchEvent(new KeyboardEvent('keyup',o))}
};
})();
"""#
}
