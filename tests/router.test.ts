// @vitest-environment happy-dom

import { describe, expect, it } from 'vitest'
import router from '@/router'

describe('set routes', () => {
  it('redirects the set root to the overview and exposes nested sections', async () => {
    await router.push('/set/example')

    expect(router.currentRoute.value.name).toBe('set-overview')
    expect(router.currentRoute.value.fullPath).toBe('/set/example/overview')
    expect(router.resolve('/set/example/words').name).toBe('set-words')
    expect(router.resolve('/set/example/words/hello').name).toBe('set-word')
    expect(router.resolve('/set/example/questions').name).toBe('set-questions')
  })
})
