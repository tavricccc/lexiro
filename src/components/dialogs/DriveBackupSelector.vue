<script setup lang="ts">
import { ChevronDown } from 'lucide-vue-next'
import { storeToRefs } from 'pinia'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useBackupStore } from '@/stores/backup'

const { t } = useI18n()

const backupStore = useBackupStore()
const { driveBackups, driveSelectedFileId } = storeToRefs(backupStore)
const { selectDriveBackup } = backupStore

const dropdownOpen = ref(false)
const triggerRef = ref<HTMLButtonElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

const selectedBackupLabel = computed(() => {
  const selected = driveBackups.value.find(file => file.id === driveSelectedFileId.value)
  if (!selected)
    return t('backup.selectBackupPlaceholder')
  return `${selected.name} · ${new Date(selected.createdTime).toLocaleString()}`
})

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value
  if (dropdownOpen.value) {
    nextTick(() => {
      if (triggerRef.value) {
        const rect = triggerRef.value.getBoundingClientRect()
        dropdownStyle.value = {
          position: 'fixed',
          top: `${rect.bottom + 6}px`,
          left: `${rect.left}px`,
          width: `${rect.width}px`,
          zIndex: '9999',
        }
      }
    })
  }
}

function selectOption(id: string) {
  selectDriveBackup(id)
  dropdownOpen.value = false
}
</script>

<template>
  <div v-if="driveBackups.length" class="mt-4 space-y-2">
    <label class="text-xs font-bold text-ink-500 dark:text-ink-400">{{ $t('backup.selectDriveBackup') }}</label>

    <!-- Custom Dropdown Selector -->
    <div class="relative">
      <button
        ref="triggerRef"
        type="button"
        class="w-full flex items-center justify-between rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 px-4 py-2.5 text-sm text-ink-900 dark:text-ink-100 outline-none focus:border-emerald-500 text-left transition-all hover:bg-ink-50 dark:hover:bg-ink-850"
        aria-haspopup="listbox"
        :aria-expanded="dropdownOpen"
        @click="toggleDropdown"
      >
        <span class="truncate pr-4">{{ selectedBackupLabel }}</span>
        <ChevronDown class="h-4 w-4 text-ink-400 dark:text-ink-500 transition-transform duration-200 shrink-0" :class="{ 'rotate-180': dropdownOpen }" />
      </button>

      <!-- Custom Options List (Teleported to body for highest z-index and no layout squeezing!) -->
      <Teleport to="body">
        <!-- Custom Click-Outside Overlay Catcher -->
        <div v-if="dropdownOpen" class="fixed inset-0 z-[9998] bg-transparent" @click="dropdownOpen = false" />

        <Transition
          enter-active-class="transition duration-100 ease-out"
          enter-from-class="opacity-0 scale-95 -translate-y-2"
          enter-to-class="opacity-100 scale-100 translate-y-0"
          leave-active-class="transition duration-75 ease-in"
          leave-from-class="opacity-100 scale-100 translate-y-0"
          leave-to-class="opacity-0 scale-95 -translate-y-2"
        >
          <div
            v-if="dropdownOpen"
            :style="dropdownStyle"
            class="max-h-60 overflow-y-auto rounded-xl border border-ink-200 dark:border-ink-800 bg-white dark:bg-ink-900 shadow-2xl p-1.5 space-y-0.5 text-left"
            role="listbox"
          >
            <!-- Default Placeholder Option -->
            <button
              type="button"
              class="w-full text-left px-3 py-2 text-xs font-semibold rounded-lg transition-colors"
              :class="!driveSelectedFileId ? 'bg-ink-100 dark:bg-ink-800 text-emerald-600 dark:text-emerald-400' : 'text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-850'"
              role="option"
              :aria-selected="!driveSelectedFileId"
              @click="selectOption('')"
            >
              {{ $t('backup.selectBackupPlaceholder') }}
            </button>

            <!-- Drive Backup Options -->
            <button
              v-for="file in driveBackups"
              :key="file.id"
              type="button"
              class="w-full text-left px-3 py-2.5 rounded-lg transition-colors flex flex-col gap-0.5 border-l-2"
              :class="driveSelectedFileId === file.id ? 'bg-ink-100 dark:bg-ink-800 text-ink-950 dark:text-ink-50 border-emerald-500' : 'border-transparent text-ink-700 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-850'"
              role="option"
              :aria-selected="driveSelectedFileId === file.id"
              @click="selectOption(file.id)"
            >
              <span class="font-bold text-ink-900 dark:text-ink-100 text-xs sm:text-sm">{{ file.name }}</span>
              <span class="text-[10px] text-ink-400 dark:text-ink-500 font-semibold">{{ new Date(file.createdTime).toLocaleString() }}</span>
            </button>
          </div>
        </Transition>
      </Teleport>
    </div>
  </div>
</template>
