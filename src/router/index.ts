import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '@/stores/session'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => false,
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/components/HomeView.vue'),
    },
    {
      path: '/flashcard/:setId',
      name: 'flashcard',
      component: () => import('@/components/FlashcardsView.vue'),
      props: true,
      meta: { requiresSession: true },
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
