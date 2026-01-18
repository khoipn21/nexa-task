import { api } from '@/lib/api'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'

export type ViewMode = 'kanban' | 'list' | 'calendar'

interface ViewPreference {
  viewMode: ViewMode
}

// localStorage key pattern
const getStorageKey = (projectId: string) => `view-pref:${projectId}`

// Read from localStorage (immediate)
function getLocalPreference(projectId: string): ViewMode | null {
  try {
    const stored = localStorage.getItem(getStorageKey(projectId))
    if (stored && ['kanban', 'list', 'calendar'].includes(stored)) {
      return stored as ViewMode
    }
  } catch {
    // localStorage not available
  }
  return null
}

// Write to localStorage
function setLocalPreference(projectId: string, mode: ViewMode) {
  try {
    localStorage.setItem(getStorageKey(projectId), mode)
  } catch {
    // localStorage not available
  }
}

// Hook for view preference with localStorage + API sync
export function useViewPreference(projectId: string | undefined) {
  const queryClient = useQueryClient()
  const [localMode, setLocalMode] = useState<ViewMode>(() => {
    if (!projectId) return 'kanban'
    return getLocalPreference(projectId) ?? 'kanban'
  })

  // Use refs to avoid stale closures and unstable callbacks
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSavedRef = useRef<ViewMode | null>(null)
  const pendingModeRef = useRef<ViewMode | null>(null)
  const projectIdRef = useRef<string | undefined>(projectId)

  // Update projectIdRef when projectId changes
  useEffect(() => {
    projectIdRef.current = projectId
  }, [projectId])

  // Reset state when project changes (prevents race condition)
  useEffect(() => {
    if (projectId) {
      const localPref = getLocalPreference(projectId)
      setLocalMode(localPref ?? 'kanban')
      lastSavedRef.current = null
      pendingModeRef.current = null
    }
  }, [projectId])

  // Fetch from API in background
  const { data: serverPref, isLoading } = useQuery<ViewPreference>({
    queryKey: ['view-preference', projectId],
    queryFn: () => api.get(`/user-settings/projects/${projectId}/preference`),
    enabled: !!projectId,
    staleTime: 60 * 1000, // 1 minute
    retry: 1,
  })

  // Sync server preference to local if different (on initial load)
  useEffect(() => {
    if (serverPref?.viewMode && projectId) {
      const local = getLocalPreference(projectId)
      // Only sync from server if local is empty or this is first load
      if (!local || lastSavedRef.current === null) {
        setLocalMode(serverPref.viewMode)
        setLocalPreference(projectId, serverPref.viewMode)
        lastSavedRef.current = serverPref.viewMode
      }
    }
  }, [serverPref?.viewMode, projectId])

  // Mutation for saving to server (stable reference via ref pattern)
  const saveMutation = useMutation({
    mutationFn: ({ pid, mode }: { pid: string; mode: ViewMode }) =>
      api.patch(`/user-settings/projects/${pid}/preference`, {
        viewMode: mode,
      }),
    onSuccess: (_, { pid, mode }) => {
      queryClient.setQueryData(['view-preference', pid], { viewMode: mode })
      lastSavedRef.current = mode
    },
    onError: (error) => {
      console.warn('[ViewPreference] Failed to save to server:', error)
      // Keep localStorage value as source of truth on error
    },
  })

  // Ref for mutation to avoid unstable callback deps
  const saveMutationRef = useRef(saveMutation)
  useEffect(() => {
    saveMutationRef.current = saveMutation
  }, [saveMutation])

  // Flush pending save (for unmount) - stable, no deps
  const flushPendingSave = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    const pid = projectIdRef.current
    const pending = pendingModeRef.current
    if (pid && pending && pending !== lastSavedRef.current) {
      // Fire and forget on unmount
      saveMutationRef.current.mutate({ pid, mode: pending })
    }
    pendingModeRef.current = null
  }, [])

  // Set view mode with debounced server sync (stable callback)
  const setViewMode = useCallback((mode: ViewMode) => {
    const pid = projectIdRef.current
    if (!pid) return

    // Immediate localStorage update
    setLocalMode(mode)
    setLocalPreference(pid, mode)
    pendingModeRef.current = mode

    // Debounced server save (500ms)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      if (mode !== lastSavedRef.current && projectIdRef.current === pid) {
        saveMutationRef.current.mutate({ pid, mode })
      }
      pendingModeRef.current = null
    }, 500)
  }, [])

  // Cleanup debounce and flush pending on unmount
  useEffect(() => {
    return () => {
      flushPendingSave()
    }
  }, [flushPendingSave])

  return {
    viewMode: localMode,
    setViewMode,
    isLoading,
    isSaving: saveMutation.isPending,
  }
}
