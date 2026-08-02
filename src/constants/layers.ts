import type { InjectionKey, Ref } from 'vue'

/**
 * Application-wide stacking order. Floating content is kept below dialogs,
 * while dialog-owned popovers are provided with a local layer above the panel.
 */
export const LAYERS = {
  navigation: 20,
  popover: 40,
  dialog: 50,
  dialogContent: 51,
  nestedDialog: 60,
  nestedDialogContent: 61,
  toast: 70,
} as const

export const DIALOG_CONTENT_LAYER_KEY: InjectionKey<Readonly<Ref<number>>> = Symbol('dialog-content-layer')
