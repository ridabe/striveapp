import { useEffect, useState } from 'react'
import { Linking } from 'react-native'
import { supabase } from '@/lib/supabase'
import { APP_VERSION_CODE } from '@/lib/appVersion'

interface AppVersionRow {
  current_version: string
  current_version_code: number
  min_version_code: number
  force_update: boolean
  store_url: string | null
  release_notes: string | null
}

export type UpdateStatus = 'up-to-date' | 'optional' | 'required'

interface UseAppVersionResult {
  status: UpdateStatus
  latestVersion: string | null
  releaseNotes: string | null
  storeUrl: string | null
  openStore: () => void
}

export function useAppVersion(): UseAppVersionResult {
  const [row, setRow] = useState<AppVersionRow | null>(null)

  useEffect(() => {
    supabase
      .from('app_versions')
      .select('current_version, current_version_code, min_version_code, force_update, store_url, release_notes')
      .eq('platform', 'android')
      .single()
      .then(({ data }) => { if (data) setRow(data as AppVersionRow) })
  }, [])

  function openStore() {
    const url = row?.store_url
    if (url) Linking.openURL(url)
  }

  if (!row) return { status: 'up-to-date', latestVersion: null, releaseNotes: null, storeUrl: null, openStore }

  let status: UpdateStatus = 'up-to-date'
  if (APP_VERSION_CODE < row.min_version_code) {
    status = row.force_update ? 'required' : 'optional'
  } else if (APP_VERSION_CODE < row.current_version_code) {
    status = 'optional'
  }

  return {
    status,
    latestVersion: row.current_version,
    releaseNotes: row.release_notes,
    storeUrl: row.store_url,
    openStore,
  }
}
