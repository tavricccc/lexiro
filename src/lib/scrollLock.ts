let lockCount = 0
let previousOverflow = ''
let previousPaddingRight = ''

/**
 * Locks document scrolling without changing the visible page width.
 * Multiple overlays can share the lock safely; only the last release restores styles.
 */
export function lockDocumentScroll(): () => void {
  if (typeof document === 'undefined')
    return () => undefined

  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow
    previousPaddingRight = document.body.style.paddingRight

    document.body.style.overflow = 'hidden'
    // Reserve the gutter manually when `scrollbar-gutter` is unavailable.
    if (typeof CSS === 'undefined' || !CSS.supports('scrollbar-gutter: stable')) {
      const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth)
      if (scrollbarWidth > 0)
        document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    document.documentElement.dataset.scrollLocked = 'true'
  }

  lockCount += 1
  let released = false

  return () => {
    if (released)
      return
    released = true
    lockCount = Math.max(0, lockCount - 1)

    if (lockCount === 0) {
      document.body.style.overflow = previousOverflow
      document.body.style.paddingRight = previousPaddingRight
      delete document.documentElement.dataset.scrollLocked
    }
  }
}
