import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useAccountStore = defineStore('account', () => {
  const label = ref('')
  const photoUrl = ref('')

  function setProfile(nextLabel: string, nextPhotoUrl: string) {
    label.value = nextLabel
    photoUrl.value = nextPhotoUrl
  }

  function clearProfile() {
    label.value = ''
    photoUrl.value = ''
  }

  return { label, photoUrl, setProfile, clearProfile }
})
