package com.dvntproject2.dangerroom.reservedregions

import android.app.Activity
import androidx.window.layout.FoldingFeature
import androidx.window.layout.WindowInfoTracker
import androidx.window.layout.WindowLayoutInfo
import io.github.expo.modules.v2.Event
import io.github.expo.modules.v2.ExpoModule
import io.github.expo.modules.v2.JS
import io.github.expo.modules.v2.Module
import io.github.expo.modules.v2.Record
import io.github.expo.modules.v2.react.currentActivity
import io.github.expo.modules.v2.react.reactContextOrNull
import com.facebook.react.bridge.LifecycleEventListener
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

@Record
data class RegionMarginsRecord(
  val top: Double,
  val left: Double,
  val bottom: Double,
  val right: Double,
)

@Record
data class ReservedRegionRecord(
  val kind: String,
  val x: Double,
  val y: Double,
  val width: Double,
  val height: Double,
  val margins: RegionMarginsRecord,
  val active: Boolean,
  val orientation: String?,
  val state: String?,
  val occlusionType: String?,
  val separating: Boolean?,
)

@ExpoModule(name = "ReservedRegions")
class ReservedRegionsModule : Module() {
  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)
  private var collectionJob: Job? = null
  private var observedActivity: Activity? = null
  private var lifecycleRegistered = false

  private val lifecycleListener = object : LifecycleEventListener {
    override fun onHostResume() {
      if (onChanged.isObserved) {
        currentActivity?.let(::observe)
      }
    }

    override fun onHostPause() {
      pauseCollection()
    }

    override fun onHostDestroy() {
      pauseCollection()
    }
  }

  @Event
  val onChanged = event<List<ReservedRegionRecord>>(
    onStartObserving = { startObserving() },
    onStopObserving = { stopObserving() },
  )

  @JS
  suspend fun query(): List<ReservedRegionRecord> {
    val activity = currentActivity ?: return emptyList()

    if (onChanged.isObserved) {
      observe(activity)
    }

    return WindowInfoTracker
      .getOrCreate(activity)
      .windowLayoutInfo(activity)
      .first()
      .toRecords(activity)
  }

  private fun startObserving() {
    val reactContext = reactContextOrNull
    if (reactContext != null && !lifecycleRegistered) {
      reactContext.addLifecycleEventListener(lifecycleListener)
      lifecycleRegistered = true
    }
    currentActivity?.let(::observe)
  }

  private fun observe(activity: Activity) {
    if (observedActivity === activity && collectionJob?.isActive == true) {
      return
    }

    collectionJob?.cancel()
    observedActivity = activity
    collectionJob = scope.launch {
      WindowInfoTracker
        .getOrCreate(activity)
        .windowLayoutInfo(activity)
        .map { info -> info.toRecords(activity) }
        .distinctUntilChanged()
        .collect { regions -> onChanged.emit(regions) }
    }
  }

  private fun pauseCollection() {
    collectionJob?.cancel()
    collectionJob = null
    observedActivity = null
  }

  private fun stopObserving() {
    pauseCollection()
    if (lifecycleRegistered) {
      reactContextOrNull?.removeLifecycleEventListener(lifecycleListener)
      lifecycleRegistered = false
    }
  }
}

private fun WindowLayoutInfo.toRecords(activity: Activity): List<ReservedRegionRecord> {
  val density = activity.resources.displayMetrics.density.toDouble()

  return displayFeatures
    .filterIsInstance<FoldingFeature>()
    .map { feature ->
      val bounds = feature.bounds

      ReservedRegionRecord(
        kind = "division",
        x = bounds.left / density,
        y = bounds.top / density,
        width = bounds.width() / density,
        height = bounds.height() / density,
        margins = RegionMarginsRecord(
          top = 0.0,
          left = 0.0,
          bottom = 0.0,
          right = 0.0,
        ),
        active = true,
        orientation = when (feature.orientation) {
          FoldingFeature.Orientation.HORIZONTAL -> "horizontal"
          FoldingFeature.Orientation.VERTICAL -> "vertical"
          else -> null
        },
        state = when (feature.state) {
          FoldingFeature.State.FLAT -> "flat"
          FoldingFeature.State.HALF_OPENED -> "halfOpened"
          else -> null
        },
        occlusionType = when (feature.occlusionType) {
          FoldingFeature.OcclusionType.NONE -> "none"
          FoldingFeature.OcclusionType.FULL -> "full"
          else -> null
        },
        separating = feature.isSeparating,
      )
    }
}
