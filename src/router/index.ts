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
      path: '/library',
      name: 'library',
      component: () => import('@/components/LibraryView.vue'),
    },
    {
      path: '/sets/new',
      name: 'set-create',
      component: () => import('@/components/SetEditorView.vue'),
    },
    {
      path: '/sets/:setId/edit',
      name: 'set-edit',
      component: () => import('@/components/SetEditorView.vue'),
      props: true,
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
      path: '/set/:setId/questions/generate',
      name: 'question-generation',
      component: () => import('@/components/QuestionGenerationView.vue'),
      props: true,
    },
    {
      path: '/vocabulary/:wordKey/questions',
      name: 'question-editor',
      component: () => import('@/components/QuestionEditorView.vue'),
      props: true,
    },
    {
      path: '/vocabulary/:wordKey',
      name: 'vocabulary',
      component: () => import('@/components/VocabularyView.vue'),
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
      path: '/fill-blank/:setId',
      name: 'fillBlank',
      component: () => import('@/components/PracticeView.vue'),
      props: { mode: 'fillBlank' },
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
