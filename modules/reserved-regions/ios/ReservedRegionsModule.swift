import ExpoModulesCore
import UIKit

@ExpoModule("ReservedRegions")
public final class ReservedRegionsModule: Module {
  @JS
  func query() async -> [ReservedRegionRecord] {
#if os(iOS) && DANGERROOM_HAS_UIKIT_RESERVED_REGIONS
    return await MainActor.run {
      guard #available(iOS 27.1, *), let view = UIWindow.keyRootView else { return [] }
      let regions =
        view.reservedRegions(kind: .division, options: [.includeInactive])
        + view.reservedRegions(kind: .occlusion, options: [.includeInactive])
      return regions.map { ReservedRegionRecord(region: $0) }
    }
#else
    return []
#endif
  }
}
