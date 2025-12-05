waitBy(() => window.document).then(() => {
  event()
})

// 给与一个回调，持续调用，直到结果返回 true
function waitBy(condition, delay = 500, times = 10) {
  const loopEntity = (resolve, itimes) => {
    const expection = condition()
    if (!!expection || itimes < 0) {
      return resolve(expection)
    } else {
      return setTimeout(() => {
        itimes--
        return loopEntity(resolve, itimes)
      }, delay)
    }
  }
  return new Promise((resolve) => {
    return loopEntity(resolve, times)
  })
}

// And we can listen to zoom changes? Actually, the zoom level can be changed by the user (with Ctrl+/-, or programmatically). We can try to override the zoom in and out commands?

// We can set a minimum zoom factor by checking and resetting if below threshold.
// But note: this might be a bit late and cause flickering.

// Alternatively, we can set the zoom level every time the user tries to zoom? We can override the `webFrame.setZoomFactor` and `webFrame.setZoomLevel` functions? Not sure.

// Another idea: in the main process, we can handle the 'zoom-changed' event? But without access to the main process in Nativefier, we are limited.

// So, if we are building the app with Nativefier, we can use the `--inject` option to inject a script that runs in the renderer and uses the `webFrame` module to set a minimum zoom.

// Steps for the injected script:

// 1. Require the `webFrame` module.
// 2. Check the current zoom factor and set it to the minimum if it's below.
// 3. Maybe override the `webFrame.setZoomFactor` to enforce the minimum.

// However, note that the user can zoom using keyboard shortcuts, and we cannot easily prevent the default behavior of those shortcuts? We can try to prevent the zoom in and out commands by listening to the 'before-input-event' event? But that is in the main process.

// Alternatively, we can use the `webFrame` to set the zoom level on every change? We can hook into the `webFrame` and set a minimum.

// Example injected script (renderer process):

// Let's assume we want a minimum zoom of 0.8 (80%).
function event() {
  const { webFrame } = require('electron')

  const minZoom = 0.5
  const maxZoom = 2.0

  // Set the initial zoom to at least minZoom
  let currentZoom = webFrame.getZoomFactor()
  if (currentZoom < minZoom) {
    webFrame.setZoomFactor(minZoom)
  }

  // Override the setZoomFactor function to enforce minZoom
  const originalSetZoomFactor = webFrame.setZoomFactor
  webFrame.setZoomFactor = function (factor) {
    factor = Math.max(factor, minZoom)
    return originalSetZoomFactor.call(webFrame, factor)
  }

  // Also, we can override the setZoomLevel function because zooming is often done by level.
  const originalSetZoomLevel = webFrame.setZoomLevel
  webFrame.setZoomLevel = function (level) {
    // Note: zoom level is log-based, so we might need to convert?
    // But let's assume we want to set a minimum factor, so we can convert the minZoom to level?
    // Alternatively, we can check the factor after setting? But that would be too late.

    // Instead, let's convert the level to factor and then check?
    // But the relationship is: factor = base ^ level, where base is usually 1.2 (or 1.0?).
    // Actually, the level is the log base 1.2 of the factor: level = log(factor) / log(1.2)
    // So, we can compute the minimum level: minLevel = Math.log(minZoom) / Math.log(1.2)

    const minLevel = Math.log(minZoom) / Math.log(1.2)
    const maxLevel = Math.log(maxZoom) / Math.log(1.2)
    if (level < minLevel) {
      level = minLevel
    } else if (level > maxLevel) {
      level = maxLevel
    }
    return originalSetZoomLevel.call(webFrame, level)
  }

  // Also, we can listen to the 'zoom-changed' event? But I don't see such an event in webFrame.

  // Alternatively, we can use a MutationObserver on the document element's style? Not reliable.

  // Another approach: we can set an interval to check the zoom level and adjust if necessary? Not efficient.

  // We can also try to override the `webFrame._setZoomLevel` (if exists) but it's private.

  // However, note that the user can use Ctrl+/- to zoom, which will change the zoom level. We can prevent the default of these shortcuts in the renderer?
  document.body.click()
  document.addEventListener('keydown', function (event) {
    // alert('测试444！！！')
    if (event.ctrlKey && ['+', '-', '=', '_'].includes(event.key)) {
      // We can prevent the default and set our own zoom?
      event.preventDefault()
      let currentLevel = webFrame.getZoomLevel()
      if (['+', '='].includes(event.key)) {
        currentLevel += 1
      } else if (['-', '_'].includes(event.key)) {
        currentLevel -= 1
      }
      // Now set the zoom level with our override
      webFrame.setZoomLevel(currentLevel)
    }
  })

  // Also, we can handle the mouse wheel with ctrl key?
  document.addEventListener(
    'wheel',
    function (event) {
      //   alert('测试555！！！')
      if (event.ctrlKey) {
        event.preventDefault()
        let currentLevel = webFrame.getZoomLevel()
        currentLevel += event.deltaY > 0 ? -1 : 1
        webFrame.setZoomLevel(currentLevel)
      }
    },
    { passive: false }
  )
}
