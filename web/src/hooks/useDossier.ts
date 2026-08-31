import { useCallback, useEffect, useState } from 'react'
import {
  ApiError,
  addDocument as apiAddDocument,
  generatePlan as apiGeneratePlan,
  getDossier,
  putPlan,
  putText,
  removeDocument as apiRemoveDocument,
  researchCompany,
  researchSection,
  runAnalysis as apiRunAnalysis,
} from '../services/api.js'
import type { DossierBundle, Plan } from '../types.js'

export type BusyKey = 'research' | 'analysis' | 'plan' | 'save' | null

interface UseDossierResult {
  bundle: DossierBundle | null
  busy: BusyKey
  error: string | null
  saveText(name: 'offer' | 'resume' | 'company', text: string): Promise<void>
  addDocument(name: string, text: string): Promise<void>
  removeDocument(name: string): Promise<void>
  researchAll(): Promise<void>
  researchSection(section: string): Promise<void>
  runAnalysis(): Promise<void>
  generatePlan(): Promise<void>
  savePlan(plan: Plan): Promise<void>
  reload(): Promise<void>
}

export function useDossier(id: string): UseDossierResult {
  const [bundle, setBundle] = useState<DossierBundle | null>(null)
  const [busy, setBusy] = useState<BusyKey>(null)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const b = await getDossier(id)
      setBundle(b)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'error.generic')
    }
  }, [id])

  useEffect(() => {
    void reload()
  }, [reload])

  const run = useCallback(async (key: BusyKey, fn: () => Promise<void>) => {
    setBusy(key)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'error.generic')
    } finally {
      setBusy(null)
    }
  }, [])

  const saveText = useCallback(
    (name: 'offer' | 'resume' | 'company', text: string) =>
      run('save', async () => {
        await putText(id, name, text)
        setBundle((prev) => (prev ? { ...prev, [name]: text } : prev))
      }),
    [id, run]
  )

  const addDocument = useCallback(
    (name: string, text: string) =>
      run('save', async () => {
        await apiAddDocument(id, name, text)
        await reload()
      }),
    [id, run, reload]
  )

  const removeDocument = useCallback(
    (name: string) =>
      run('save', async () => {
        await apiRemoveDocument(id, name)
        await reload()
      }),
    [id, run, reload]
  )

  const researchAll = useCallback(
    () =>
      run('research', async () => {
        const res = await researchCompany(id)
        setBundle((prev) => (prev ? { ...prev, company: res.company } : prev))
      }),
    [id, run]
  )

  const researchSectionAction = useCallback(
    (section: string) =>
      run('research', async () => {
        const res = await researchSection(id, section)
        setBundle((prev) => (prev ? { ...prev, company: res.company } : prev))
      }),
    [id, run]
  )

  const runAnalysisAction = useCallback(
    () =>
      run('analysis', async () => {
        const analysis = await apiRunAnalysis(id)
        setBundle((prev) => (prev ? { ...prev, analysis } : prev))
      }),
    [id, run]
  )

  const generatePlanAction = useCallback(
    () =>
      run('plan', async () => {
        const plan = await apiGeneratePlan(id)
        setBundle((prev) => (prev ? { ...prev, plan } : prev))
      }),
    [id, run]
  )

  const savePlan = useCallback(
    (plan: Plan) =>
      run('save', async () => {
        await putPlan(id, plan)
        setBundle((prev) => (prev ? { ...prev, plan } : prev))
      }),
    [id, run]
  )

  return {
    bundle,
    busy,
    error,
    saveText,
    addDocument,
    removeDocument,
    researchAll,
    researchSection: researchSectionAction,
    runAnalysis: runAnalysisAction,
    generatePlan: generatePlanAction,
    savePlan,
    reload,
  }
}
