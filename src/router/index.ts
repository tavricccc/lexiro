import { getActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { useSessionStore } from '@/stores/session'
import { useUIStore } from '@/stores/ui'

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
      redirect: to => ({ name: 'set-overview', params: { setId: to.params.setId } }),
    },
    {
      path: '/set/:setId',
      component: () => import('@/components/set/SetShell.vue'),
      props: true,
      children: [
        {
          path: 'overview',
          name: 'set-overview',
          component: () => import('@/components/set/SetOverviewPanel.vue'),
          props: true,
        },
        {
          path: 'words',
          name: 'set-words',
          component: () => import('@/components/set/SetWordsPanel.vue'),
          props: true,
          children: [
            {
              path: ':wordKey',
              name: 'set-word',
              component: () => import('@/components/set/SetWordDetail.vue'),
              props: true,
            },
          ],
        },
        {
          path: 'questions',
          name: 'set-questions',
          component: () => import('@/components/set/SetQuestionsPanel.vue'),
          props: true,
        },
      ],
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

let activePageLoadingToken: number | null = null

router.beforeEach(async (to) => {
  const pinia = getActivePinia()
  if (pinia) {
    const uiStore = useUIStore(pinia)
    if (uiStore.hasDirtyForms) {
      const decision = await uiStore.showDirtyFormPrompt()
      if (decision === 'cancel')
        return false
      if (decision === 'discard')
        uiStore.discardDirtyForms()
      if (decision === 'save' && !await uiStore.saveDirtyForms())
        return false
    }
  }
  if (!to.meta.requiresSession)
    return beginPageLoading(to)
  const sessionStore = useSessionStore()
  if (!sessionStore.hasValidSessionForRoute(to.name))
    return { name: 'home' }
  return beginPageLoading(to)
})

function beginPageLoading(to: { fullPath: string }) {
  const pinia = getActivePinia()
  if (!pinia)
    return true
  const uiStore = useUIStore(pinia)
  if (router.currentRoute.value.fullPath === to.fullPath)
    return true
  activePageLoadingToken = uiStore.beginPageLoading()
  return true
}

router.afterEach(() => {
  const pinia = getActivePinia()
  const token = activePageLoadingToken
  activePageLoadingToken = null
  if (!pinia)
    return
  void nextTick().then(() => useUIStore(pinia).endPageLoading(token ?? undefined))
})

router.onError((error) => {
  const pinia = getActivePinia()
  if (pinia) {
    useUIStore(pinia).endPageLoading()
    activePageLoadingToken = null
  }
  const isChunkError = error.message.includes('Failed to fetch dynamically imported module')
    || error.message.includes('Importing a module script failed')
  if (isChunkError) {
    window.location.reload()
  }
})

export default router
