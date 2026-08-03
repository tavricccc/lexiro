// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SyncProgress from '@/components/ui/sync-progress/SyncProgress.vue'
import { i18n } from '@/lib/i18n'

describe('sync progress', () => {
  it('offers cancel and retry after an offline commit', async () => {
    const wrapper = mount(SyncProgress, {
      global: { plugins: [i18n] },
      props: {
        allowCancel: true,
        state: {
          phase: 'offline',
          direction: 'idle',
          completed: 0,
          total: 0,
          percent: 0,
          message: '離線',
          retryable: true,
          currentBatch: 0,
          totalBatches: 0,
          pendingWrites: 1,
        },
      },
    })

    const buttons = wrapper.findAll('button')
    expect(buttons.map(button => button.text())).toEqual(expect.arrayContaining(['取消同步', '重新連線']))
    expect(wrapper.text()).not.toContain('離線模式')

    await buttons.find(button => button.text().includes('取消同步'))?.trigger('click')
    await buttons.find(button => button.text().includes('重新連線'))?.trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('retry')).toHaveLength(1)
    wrapper.unmount()
  })

  it('uses a fullscreen status overlay with real chunk progress for blocking sync', () => {
    const wrapper = mount(SyncProgress, {
      attachTo: document.body,
      global: { plugins: [i18n] },
      props: {
        fullscreen: true,
        state: {
          phase: 'downloading',
          direction: 'download',
          completed: 3,
          total: 10,
          percent: 30,
          message: '正在下載單字庫分片…',
          retryable: false,
          currentBatch: 1,
          totalBatches: 2,
          pendingWrites: 0,
        },
      },
    })

    const overlay = document.body.querySelector('[role="status"]')
    expect(overlay?.getAttribute('aria-busy')).toBe('true')
    expect(overlay?.textContent).toContain('正在下載單字庫分片…')
    expect(overlay?.textContent).toContain('第 1 / 2 批')
    expect(overlay?.textContent).toContain('3 / 10')
    expect(overlay?.textContent).toContain('30%')
    wrapper.unmount()
  })
})
