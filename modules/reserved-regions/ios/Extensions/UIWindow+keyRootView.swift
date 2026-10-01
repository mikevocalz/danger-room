import UIKit

extension UIWindow {
  @MainActor
  static var keyRootView: UIView? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .flatMap { $0.windows }
      .first { $0.isKeyWindow }?
      .rootViewController?.view
  }
}
