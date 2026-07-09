import { create } from 'zustand'

export interface PromptState {
  active: boolean
  text: string
  userResponse: string
  mistakes: number
  maxMistakes: number
  minLength: number
  maxLength: number
  onClose: (() => void) | null
  activate: (text: string, maxMistakes: number, minLength: number, maxLength: number, onClose: () => void) => void
  deactivate: () => void
  submit: (response: string) => void
  incrementMistakes: () => void
}

export const usePromptStore = create<PromptState>((set) => ({
  active: false,
  text: '',
  userResponse: '',
  mistakes: 0,
  maxMistakes: 3,
  minLength: 5,
  maxLength: 100,
  onClose: null,
  activate: (text, maxMistakes, minLength, maxLength, onClose) => set({
    active: true,
    text,
    maxMistakes,
    minLength,
    maxLength,
    onClose,
    userResponse: '',
    mistakes: 0,
  }),
  deactivate: () => set({
    active: false,
    userResponse: '',
    mistakes: 0,
  }),
  submit: (response) => set({ userResponse: response }),
  incrementMistakes: () => set((state) => ({
    mistakes: state.mistakes + 1,
  })),
}))
