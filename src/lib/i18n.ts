import { createI18n } from 'vue-i18n'
import zhTW from '@/locales/zh-TW'

export const i18n = createI18n({
  legacy: false,
  locale: 'zh-TW',
  messages: {
    'zh-TW': zhTW,
  },
  datetimeFormats: {
    'zh-TW': {
      short: {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      },
    },
  },
})
