export type TargetSense = string | 'new'

export interface ExampleDraft {
  id: string
  text: string
  selected: boolean
  targetSenseId: TargetSense
}

export interface SenseDraft {
  id: string
  pos: string
  meaningZh: string
  selected: boolean
  examples: ExampleDraft[]
}
