//
//  ViewController.swift
//  Shared (App)
//
//  Created by Stefan Magdalinski on 19/02/2026.
//

#if os(iOS)
import UIKit

class ViewController: UIViewController {

    override func viewDidLoad() {
        super.viewDidLoad()

        view.backgroundColor = .systemBackground

        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stack.leadingAnchor.constraint(greaterThanOrEqualTo: view.leadingAnchor, constant: 40),
            stack.trailingAnchor.constraint(lessThanOrEqualTo: view.trailingAnchor, constant: -40),
        ])

        // Icon
        let icon = UIImageView(image: UIImage(named: "LargeIcon"))
        icon.translatesAutoresizingMaskIntoConstraints = false
        icon.widthAnchor.constraint(equalToConstant: 128).isActive = true
        icon.heightAnchor.constraint(equalToConstant: 128).isActive = true
        stack.addArrangedSubview(icon)

        // Title
        let title = makeLabel("Wikilinker", size: 22, bold: true)
        stack.addArrangedSubview(title)

        // Tagline
        let tagline = makeLabel("Auto-links names to Wikipedia as you browse", size: 13)
        tagline.textColor = .secondaryLabel
        stack.addArrangedSubview(tagline)
        stack.setCustomSpacing(20, after: tagline)

        // Description
        let desc = makeLabel("Wikilinker finds people, places, and organizations on any webpage and links them to their Wikipedia articles.", size: 15)
        desc.widthAnchor.constraint(lessThanOrEqualToConstant: 340).isActive = true
        stack.addArrangedSubview(desc)
        stack.setCustomSpacing(20, after: desc)

        // Instructions
        let instructions = makeLabel("You can turn on Wikilinker's Safari extension in Settings.", size: 15)
        instructions.textColor = .secondaryLabel
        instructions.widthAnchor.constraint(lessThanOrEqualToConstant: 340).isActive = true
        stack.addArrangedSubview(instructions)
    }

    private func makeLabel(_ text: String, size: CGFloat, bold: Bool = false) -> UILabel {
        let label = UILabel()
        label.text = text
        label.font = bold ? UIFont.boldSystemFont(ofSize: size) : UIFont.systemFont(ofSize: size)
        label.textAlignment = .center
        label.numberOfLines = 0
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
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
