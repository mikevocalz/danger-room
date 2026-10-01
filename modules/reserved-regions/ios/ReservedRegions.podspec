sdk_version = `xcrun --sdk iphoneos --show-sdk-version 2>/dev/null`.strip
sdk_parts = sdk_version.split('.').map(&:to_i)
has_reserved_regions =
  sdk_parts[0].to_i > 27 ||
  (sdk_parts[0].to_i == 27 && sdk_parts[1].to_i >= 1)

Pod::Spec.new do |s|
  s.name           = 'ReservedRegions'
  s.version        = '0.2.0'
  s.summary        = 'UIKit reserved regions for the app window'
  s.description    = 'Fold division and camera occlusion rects from UIView.reservedRegions(kind:), iOS 27.1+.'
  s.author         = 'Danger Room'
  s.homepage       = 'https://github.com/mikevocalz/danger-room'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '6.0'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  swift_conditions = '$(inherited)'
  swift_conditions += ' DANGERROOM_HAS_UIKIT_RESERVED_REGIONS' if has_reserved_regions

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_ACTIVE_COMPILATION_CONDITIONS' => swift_conditions,
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
