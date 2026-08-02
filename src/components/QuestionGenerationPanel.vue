<script setup lang="ts">
import { FileQuestion } from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import Button from './ui/button/Button.vue'

const props = defineProps<{ setId: string }>()
const router = useRouter()

function open() {
  void router.push({ name: 'question-generation', params: { setId: props.setId } })
}
</script>

<template>
  <Button variant="outline" class="gap-2" @click="open">
    <FileQuestion class="h-4 w-4" />
    {{ $t('library.generateQuestions') }}
  </Button>
</template>
