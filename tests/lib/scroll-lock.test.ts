// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import { lockDocumentScroll } from '@/lib/scrollLock'

describe('lockDocumentScroll', () => {
  beforeEach(() => {
    document.body.style.overflow = 'auto'
    document.body.style.paddingRight = ''
    delete document.documentElement.dataset.scrollLocked
  })

  it('locks scrolling and restores the original styles', () => {
    const release = lockDocumentScroll()

    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.dataset.scrollLocked).toBe('true')

    release()

    expect(document.body.style.overflow).toBe('auto')
    expect(document.documentElement.dataset.scrollLocked).toBeUndefined()
  })

  it('keeps the lock active until all overlays release it', () => {
    const releaseFirst = lockDocumentScroll()
    const releaseSecond = lockDocumentScroll()

    releaseFirst()
    expect(document.body.style.overflow).toBe('hidden')

    releaseSecond()
    expect(document.body.style.overflow).toBe('auto')
  })
})
