import type { CSSProperties } from 'vue'
import { nextTick, onBeforeUnmount, ref } from 'vue'

export type FloatingPlacement = 'bottom-start' | 'bottom-end'

interface FloatingPanelOptions {
  gap?: number
  viewportPadding?: number
  maxHeight?: number
  placement?: FloatingPlacement
  matchTriggerWidth?: boolean
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max))
}

/**
 * Positions a body-level floating panel against its trigger and keeps it
 * inside the viewport while the page or an ancestor scrolls.
 */
export function useFloatingPanel(options: FloatingPanelOptions = {}) {
  const triggerRef = ref<HTMLElement | null>(null)
  const panelRef = ref<HTMLElement | null>(null)
  const floatingStyle = ref<CSSProperties>({ position: 'fixed' })
  let active = false

  const gap = options.gap ?? 6
  const viewportPadding = options.viewportPadding ?? 8
  const maxHeight = options.maxHeight ?? 384
  const placement = options.placement ?? 'bottom-start'

  function updatePosition() {
    const trigger = triggerRef.value
    const panel = panelRef.value
    if (!trigger || !panel || typeof window === 'undefined')
      return

    const triggerRect = trigger.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const panelWidth = options.matchTriggerWidth
      ? triggerRect.width
      : Math.max(panelRect.width, triggerRect.width)
    const measuredHeight = panel.scrollHeight || panelRect.height || maxHeight
    const panelHeight = Math.min(measuredHeight, maxHeight)
    const availableBelow = Math.max(1, window.innerHeight - triggerRect.bottom - gap - viewportPadding)
    const availableAbove = Math.max(1, triggerRect.top - gap - viewportPadding)
    const opensAbove = availableBelow < panelHeight && availableAbove > availableBelow
    const availableHeight = opensAbove ? availableAbove : availableBelow
    const visibleHeight = Math.min(panelHeight, availableHeight)
    const rawTop = opensAbove
      ? triggerRect.top - gap - visibleHeight
      : triggerRect.bottom + gap
    const maxTop = window.innerHeight - viewportPadding - visibleHeight
    const rawLeft = placement === 'bottom-end'
      ? triggerRect.right - panelWidth
      : triggerRect.left
    const maxLeft = window.innerWidth - viewportPadding - panelWidth

    floatingStyle.value = {
      position: 'fixed',
      top: `${Math.round(clamp(rawTop, viewportPadding, maxTop))}px`,
      left: `${Math.round(clamp(rawLeft, viewportPadding, maxLeft))}px`,
      maxHeight: `${Math.round(availableHeight)}px`,
      ...(options.matchTriggerWidth && triggerRect.width > 0
        ? { width: `${Math.round(triggerRect.width)}px` }
        : {}),
    }
  }

  function activate() {
    if (active || typeof window === 'undefined')
      return
    active = true
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    updatePosition()
  }

  function deactivate() {
    if (!active || typeof window === 'undefined')
      return
    active = false
    window.removeEventListener('resize', updatePosition)
    window.removeEventListener('scroll', updatePosition, true)
    floatingStyle.value = { position: 'fixed' }
  }

  function refresh() {
    void nextTick(updatePosition)
  }

  onBeforeUnmount(deactivate)

  return {
    triggerRef,
    panelRef,
    floatingStyle,
    activate,
    deactivate,
    refresh,
    updatePosition,
  }
}
