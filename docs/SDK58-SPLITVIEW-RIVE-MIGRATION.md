# SDK 58 + SplitView + Rive migration
This ports the foldable architecture from Moyo Learn PRs #81/#82 into Danger Room.

- Expo SDK 58 / RN 0.88
- Slot-only root navigation
- iOS native SplitView: host / showcase / guest detail
- Android Expo Modules 2 + WindowManager 1.5.1
- measured window-to-pane coordinate conversion before hinge placement
- single hinge and trifold physical-region layouts
- no hard-coded Surface Duo hinge gutter
- Rive-authored host/guest chrome over native Fishjam video
- private Viro fork pinned to b4cd6aaf62ecc5f004f53da6ef271654cd19d044
