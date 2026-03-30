'use client'

import { useEffect, useRef } from 'react'
import { useSurveyStore } from '@/store/surveyStore'
import { useProjectStore } from '@/store/projectStore'

const DEBOUNCE_MS = 500

/**
 * Syncs survey store (in-memory session) to project store (localStorage) when survey data changes.
 * Debounced to avoid race conditions when switching projects (loadProjectData triggers save).
 * Call once at app root (e.g. MainLayout).
 */
export function useAutoSave() {
  const saveCurrentProjectData = useProjectStore((s) => s.saveCurrentProjectData)
  const currentProjectId = useProjectStore((s) => s.currentProjectId)
  const parsedQuestions = useSurveyStore((s) => s.parsedQuestions)
  const oldVariableMapping = useSurveyStore((s) => s.oldVariableMapping)
  const pristineParsedQuestions = useSurveyStore((s) => s.pristineParsedQuestions)
  const pristineOldVariableMapping = useSurveyStore((s) => s.pristineOldVariableMapping)
  const qcLogicGraph = useSurveyStore((s) => s.qcLogicGraph)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const projectIdRef = useRef(currentProjectId)

  // Track the latest projectId so the debounced callback saves to the correct project
  useEffect(() => { projectIdRef.current = currentProjectId }, [currentProjectId])

  useEffect(() => {
    if (!currentProjectId) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      if (projectIdRef.current !== currentProjectId) return
      saveCurrentProjectData({
        parsedQuestions,
        oldVariableMapping,
        pristineParsedQuestions,
        pristineOldVariableMapping,
        qcLogicGraph,
      })
    }, DEBOUNCE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [currentProjectId, parsedQuestions, oldVariableMapping, pristineParsedQuestions, pristineOldVariableMapping, qcLogicGraph, saveCurrentProjectData])
}
