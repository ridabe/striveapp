import { create } from 'zustand'
import type { Tables } from '@/types/database'

interface SelectedStudentState {
  selectedStudent: Tables<'students'> | null
  setSelectedStudent: (student: Tables<'students'> | null) => void
}

export const useSelectedStudentStore = create<SelectedStudentState>((set) => ({
  selectedStudent: null,
  setSelectedStudent: (student) => set({ selectedStudent: student }),
}))
