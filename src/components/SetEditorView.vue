<script setup lang="ts">
import type { EditorItem, WordDraft } from '@/types'
import { Plus, Sparkles } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDirtyForm } from '@/lib/dirty-form'
import { UNCATEGORIZED_FOLDER_ID } from '@/lib/folders'
import { createEditorItem } from '@/lib/validation'
import { useSetsStore } from '@/stores/sets'
import AiWordImportPanel from './dialogs/AiWordImportPanel.vue'
import EditorItemCard from './dialogs/EditorItemCard.vue'
import FolderPicker from './dialogs/FolderPicker.vue'
import Button from './ui/button/Button.vue'
import Card from './ui/card/Card.vue'
import Input from './ui/input/Input.vue'
import StatusMessage from './ui/status-message/StatusMessage.vue'

const route = useRoute()
const router = useRouter()
const setsStore = useSetsStore()
const { setEditorName, setEditorFolderId, setEditorDraftItems, setEditorError } = storeToRefs(setsStore)
const { prepareSetEditor, closeSetEditor, removeEditorItem, addEditorItem, saveSetEditor, openImport, setSetEditorFolderId, setSetEditorName, updateSetEditorItem } = setsStore

type EditorInputMode = 'manual' | 'ai'

const mode = computed(() => route.name === 'set-create' ? 'create' : 'edit')
const setId = computed(() => typeof route.params.setId === 'string' ? route.params.setId : '')
const editorInputMode = ref<EditorInputMode>('manual')
const initialEditorSnapshot = ref('')
const selectedFolderId = computed({
  get: () => setEditorFolderId.value ?? UNCATEGORIZED_FOLDER_ID,
  set: (value: string) => setSetEditorFolderId(value),
})
const editorName = computed({
  get: () => setEditorName.value,
  set: (value: string) => setSetEditorName(value),
})
const isValidEditRoute = computed(() => mode.value === 'create' || setsStore.sets.some(set => set.id === setId.value))

function prepare() {
  const set = setsStore.sets.find(item => item.id === setId.value) ?? null
  prepareSetEditor(mode.value, set)
  editorInputMode.value = 'manual'
  initialEditorSnapshot.value = editorSnapshot()
}

watch([mode, setId], prepare, { immediate: true })
onMounted(prepare)

function updateEditorItem(itemIndex: number, item: EditorItem) {
  updateSetEditorItem(itemIndex, item)
}

function applyAiItems(items: WordDraft[]) {
  setEditorDraftItems.value = items.map(item => createEditorItem(item))
  setEditorError.value = ''
  editorInputMode.value = 'manual'
}

function close() {
  closeSetEditor()
}

function editorSnapshot(): string {
  return JSON.stringify({
    name: setEditorName.value,
    folderId: setEditorFolderId.value,
    items: setEditorDraftItems.value,
  })
}

const editorDirty = computed(() => initialEditorSnapshot.value !== editorSnapshot())

function save(): boolean {
  const saved = saveSetEditor()
  if (saved)
    initialEditorSnapshot.value = editorSnapshot()
  return saved
}

useDirtyForm({
  id: 'set-editor',
  isDirty: () => editorDirty.value,
  save,
  discard: close,
})
</script>

<template>
  <section v-if="isValidEditRoute" class="space-y-6 text-left">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <Button variant="ghost" class="mb-3 -ml-3" @click="close">
          {{ $t('vocabulary.back') }}
        </Button>
        <h1 class="text-3xl font-black tracking-tight">
          {{ mode === 'create' ? $t('editor.create') : $t('editor.edit') }}
        </h1>
        <p class="mt-1 text-sm font-semibold text-ink-500">
          {{ mode === 'create' ? $t('editor.createDescription') : $t('editor.editDescription') }}
        </p>
      </div>
      <Button v-if="mode === 'create'" variant="outline" @click="openImport()">
        {{ $t('editor.importOutput') }}
      </Button>
    </div>

    <Card class="space-y-5 p-5 sm:p-6">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="space-y-1.5">
          <label class="text-xs font-bold uppercase tracking-wider text-ink-500 dark:text-ink-400">{{ $t('editor.setName') }}</label>
          <Input v-model="editorName" :placeholder="$t('editor.setName')" />
        </div>
        <FolderPicker v-model="selectedFolderId" :title="$t('editor.folder')" />
      </div>
    </Card>

    <Card class="space-y-4 p-5 sm:p-6">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h2 class="text-lg font-black">
            {{ $t('editor.wordsTitle') }}
          </h2>
          <p class="mt-1 text-xs font-semibold text-ink-500">
            {{ $t('editor.wordsDescription') }}
          </p>
        </div>
        <div class="flex flex-wrap justify-end gap-2">
          <Button v-if="mode === 'create' && editorInputMode === 'manual'" variant="outline" class="gap-2" @click="editorInputMode = 'ai'">
            <Sparkles class="h-4 w-4" />{{ $t('editor.switchToAiImport') }}
          </Button>
          <Button v-if="mode === 'create' && editorInputMode === 'ai'" variant="ghost" class="gap-2" @click="editorInputMode = 'manual'">
            {{ $t('editor.switchToManual') }}
          </Button>
          <Button v-if="editorInputMode === 'manual'" variant="outline" class="gap-2" @click="addEditorItem">
            <Plus class="h-4 w-4" />{{ $t('editor.addWord') }}
          </Button>
        </div>
      </div>
      <AiWordImportPanel v-if="editorInputMode === 'ai'" @apply="applyAiItems" />
      <div v-else class="space-y-4">
        <EditorItemCard
          v-for="(item, itemIndex) in setEditorDraftItems"
          :key="item.id"
          :item="item"
          :item-index="itemIndex"
          @remove="removeEditorItem(itemIndex)"
          @update:item="updateEditorItem(itemIndex, $event)"
        />
      </div>
    </Card>

    <StatusMessage v-if="setEditorError" tone="error">
      {{ setEditorError }}
    </StatusMessage>
    <div class="flex justify-end gap-2">
      <Button variant="outline" @click="close">
        {{ $t('editor.cancel') }}
      </Button>
      <Button @click="save">
        {{ $t('editor.save') }}
      </Button>
    </div>
  </section>
  <div v-else class="py-20 text-center text-sm font-semibold text-ink-400">
    {{ $t('editor.notFound') }}
    <Button variant="ghost" class="mt-3" @click="router.push({ name: 'library' })">
      {{ $t('vocabulary.back') }}
    </Button>
  </div>
</template>
