//
//  ViewController.swift
//  Shared (App)
//
//  Created by Stefan Magdalinski on 19/02/2026.
//

#if os(iOS)
import UIKit
import WebKit

class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler {

    @IBOutlet var webView: WKWebView!

    override func viewDidLoad() {
        super.viewDidLoad()
        self.webView.navigationDelegate = self
        self.webView.scrollView.isScrollEnabled = false
        self.webView.configuration.userContentController.add(self, name: "controller")
        self.webView.loadFileURL(Bundle.main.url(forResource: "Main", withExtension: "html")!, allowingReadAccessTo: Bundle.main.resourceURL!)
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript("show('ios')")
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
    }
}

#elseif os(macOS)
import Cocoa
import SafariServices

let extensionBundleIdentifier = "org.whitelabel.Wikilinker-safari.Extension"

class ViewController: NSViewController {

    private var stateLabel: NSTextField!

    override func loadView() {
        self.view = NSView(frame: NSRect(x: 0, y: 0, width: 425, height: 420))
    }

    override func viewDidLoad() {
        super.viewDidLoad()

        let container = NSStackView()
        container.orientation = .vertical
        container.alignment = .centerX
        container.spacing = 10
        container.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(container)

        NSLayoutConstraint.activate([
            container.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            container.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            container.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 40),
            container.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -40),
        ])

        // Icon
        let icon = NSImageView()
        icon.image = NSImage(named: "LargeIcon")
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.widthAnchor.constraint(equalToConstant: 128).isActive = true
        icon.heightAnchor.constraint(equalToConstant: 128).isActive = true
        container.addArrangedSubview(icon)

        // Title
        let title = makeLabel("Wikilinker", size: 18, bold: true)
        container.addArrangedSubview(title)

        // Tagline
        let tagline = makeLabel("Auto-links names to Wikipedia as you browse", size: 11)
        tagline.textColor = .secondaryLabelColor
        container.addArrangedSubview(tagline)
        container.setCustomSpacing(16, after: tagline)

        // Description
        let desc = makeLabel("Wikilinker finds people, places, and organizations on any webpage and links them to their Wikipedia articles.", size: 13)
        desc.widthAnchor.constraint(lessThanOrEqualToConstant: 340).isActive = true
        container.addArrangedSubview(desc)
        container.setCustomSpacing(16, after: desc)

        // State label
        stateLabel = makeLabel("You can turn on Wikilinker's extension in the Extensions section of Safari Settings.", size: 13)
        stateLabel.textColor = .secondaryLabelColor
        stateLabel.widthAnchor.constraint(lessThanOrEqualToConstant: 340).isActive = true
        container.addArrangedSubview(stateLabel)
        container.setCustomSpacing(16, after: stateLabel)

        // Button
        let button = NSButton(title: "Open Safari Extensions Settings\u{2026}", target: self, action: #selector(openSafariExtensionPreferences))
        button.bezelStyle = .rounded
        container.addArrangedSubview(button)

        // Check extension state
        SFSafariExtensionManager.getStateOfSafariExtension(withIdentifier: extensionBundleIdentifier) { (state, error) in
            guard let state = state, error == nil else { return }
            DispatchQueue.main.async {
                if state.isEnabled {
                    self.stateLabel.stringValue = "Wikilinker's extension is currently on. You can turn it off in the Extensions section of Safari Settings."
                } else {
                    self.stateLabel.stringValue = "Wikilinker's extension is currently off. You can turn it on in the Extensions section of Safari Settings."
                }
            }
        }
    }

    private func makeLabel(_ text: String, size: CGFloat, bold: Bool = false) -> NSTextField {
        let label = NSTextField(wrappingLabelWithString: text)
        label.font = bold ? NSFont.boldSystemFont(ofSize: size) : NSFont.systemFont(ofSize: size)
        label.alignment = .center
        label.isEditable = false
        label.isSelectable = false
        label.isBordered = false
        label.backgroundColor = .clear
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }

    @objc func openSafariExtensionPreferences() {
        SFSafariApplication.showPreferencesForExtension(withIdentifier: extensionBundleIdentifier) { error in
            if let error = error {
                NSLog("Wikilinker: showPreferences error: %@", error.localizedDescription)
            }
        }
    }
}

#endif
