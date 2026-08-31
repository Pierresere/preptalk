import { useCallback, useEffect, useState } from 'react'
import { ApiError, createDossier, deleteDossier, getProviders, listDossiers, type CreateDossierInput } from '../services/api.js'
import type { Dossier, ProviderInfo } from '../types.js'

interface UseDossiersResult {
  dossiers: Dossier[]
  providers: ProviderInfo[]
  loading: boolean
  error: string | null
  create(input: CreateDossierInput): Promise<Dossier>
  remove(id: string): Promise<void>
  reload(): Promise<void>
}

export function useDossiers(): UseDossiersResult {
  const [dossiers, setDossiers] = useState<Dossier[]>([])
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [d, p] = await Promise.all([listDossiers(), getProviders()])
      setDossiers(d)
      setProviders(p)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'error.generic')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const create = useCallback(
    async (input: CreateDossierInput) => {
      const created = await createDossier(input)
      await reload()
      return created
    },
    [reload]
  )

  const remove = useCallback(
    async (id: string) => {
      await deleteDossier(id)
      await reload()
    },
    [reload]
  )

  return { dossiers, providers, loading, error, create, remove, reload }
}
