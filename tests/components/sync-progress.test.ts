// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SyncProgress from '@/components/ui/sync-progress/SyncProgress.vue'
import { i18n } from '@/lib/i18n'

describe('sync progress', () => {
  it('offers both local continuation and an explicit retry after offline mode', async () => {
    const wrapper = mount(SyncProgress, {
      global: { plugins: [i18n] },
      props: {
        allowOffline: true,
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
    expect(buttons.map(button => button.text())).toEqual(expect.arrayContaining(['使用本機資料', '重新連線']))

    await buttons.find(button => button.text().includes('使用本機資料'))?.trigger('click')
    await buttons.find(button => button.text().includes('重新連線'))?.trigger('click')
    expect(wrapper.emitted('continueOffline')).toHaveLength(1)
    expect(wrapper.emitted('retry')).toHaveLength(1)
    wrapper.unmount()
  })
})
