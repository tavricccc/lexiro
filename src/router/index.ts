import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior: () => false,
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/components/HomeView.vue'),
    },
    {
      path: '/study',
      redirect: '/library',
    },
    {
      path: '/library',
      name: 'library',
      component: () => import('@/components/LibraryView.vue'),
    },
    {
      path: '/dictionary',
      name: 'dictionary',
      component: () => import('@/components/DictionaryView.vue'),
    },
    {
      path: '/stats',
      name: 'stats',
      component: () => import('@/components/StatsView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/components/SettingsView.vue'),
    },
    {
      path: '/set/:setId',
      name: 'set-study',
      component: () => import('@/components/SetStudyView.vue'),
      props: true,
    },
    {
      path: '/quiz/:setId',
      name: 'quiz',
      component: () => import('@/components/PracticeView.vue'),
      props: { mode: 'quiz' },
      meta: { requiresSession: true },
    },
    {
      path: '/spelling/:setId',
      name: 'spelling',
      component: () => import('@/components/PracticeView.vue'),
      props: { mode: 'spelling' },
      meta: { requiresSession: true },
    },
    {
      path: '/cloze/:setId',
      name: 'cloze',
      component: () => import('@/components/PracticeView.vue'),
      props: { mode: 'cloze' },
      meta: { requiresSession: true },
    },
    {
      path: '/reading/:setId',
      name: 'reading',
      component: () => import('@/components/PracticeView.vue'),
      props: { mode: 'reading' },
      meta: { requiresSession: true },
    },
    {
      path: '/review/:setId?',
      name: 'review',
      component: () => import('@/components/ReviewView.vue'),
      props: true,
    },
    {
      path: '/result',
      name: 'result',
      component: () => import('@/components/ResultView.vue'),
      meta: { requiresSession: true },
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

router.beforeEach((to) => {
  if (!to.meta.requiresSession)
    return true
  const sessionStore = useSessionStore()
  if (!sessionStore.hasValidSessionForRoute(to.name))
    return { name: 'home' }
  return true
})

router.onError((error) => {
  const isChunkError = error.message.includes('Failed to fetch dynamically imported module')
    || error.message.includes('Importing a module script failed')
  if (isChunkError) {
    window.location.reload()
  }
})

export default router
