import { BarChart3, BookMarked, BookOpen, Brain, Library } from 'lucide-vue-next'

export const APP_NAV_ITEMS = [
  { key: 'home', to: '/', label: 'nav.home', icon: Brain },
  { key: 'study', to: '/study', label: 'nav.study', icon: BookOpen },
  { key: 'library', to: '/library', label: 'nav.library', icon: Library },
  { key: 'dictionary', to: '/dictionary', label: 'nav.dictionary', icon: BookMarked },
  { key: 'stats', to: '/stats', label: 'nav.stats', icon: BarChart3 },
] as const
