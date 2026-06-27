import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useSelectedStudentStore } from '@/stores/selectedStudentStore'
import type { Tables } from '@/types/database'

type Student = Tables<'students'>

// Carrega todos os cadastros do aluno logado e expõe o cadastro ativo para o app.
export function useStudent() {
  const { profile } = useAuthStore()
  const { selectedStudent, setSelectedStudent } = useSelectedStudentStore()
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    if (!profile?.id) {
      setAllStudents([])
      setSelectedStudent(null)
      setLoading(false)
      return
    }

    async function loadStudents() {
      setLoading(true)

      try {
        const { data, error } = await supabase
          .from('students')
          .select('*, tenants(*)')
          .eq('user_id', profile.id)
          .order('created_at', { ascending: false })

        if (error) {
          throw error
        }

        if (!isMounted) {
          return
        }

        const students = (data ?? []) as unknown as Student[]
        setAllStudents(students)

        if (students.length === 1 && !selectedStudent) {
          setSelectedStudent(students[0])
        } else if (selectedStudent && !students.find((s) => s.id === selectedStudent.id)) {
          setSelectedStudent(null)
        }
      } catch (error) {
        console.error('Error fetching students:', error)

        if (isMounted) {
          setAllStudents([])
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadStudents()

    return () => {
      isMounted = false
    }
  }, [profile?.id, selectedStudent?.id, setSelectedStudent])

  return { selectedStudent, allStudents, loading, setSelectedStudent }
}
