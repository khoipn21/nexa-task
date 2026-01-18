import { api } from '@/lib/api'
import {
  useAuth as useClerkAuth,
  useOrganization,
  useUser,
} from '@clerk/clerk-react'
import { useEffect } from 'react'

export function useAuth() {
  const { isLoaded, isSignedIn, getToken, signOut } = useClerkAuth()
  const { user } = useUser()
  const { organization } = useOrganization()

  // Sync token to API client
  useEffect(() => {
    if (isSignedIn) {
      getToken().then((token) => api.setToken(token))
    } else {
      api.setToken(null)
    }
  }, [isSignedIn, getToken])

  return {
    isLoaded,
    isSignedIn,
    user,
    organization,
    signOut,
    getToken,
  }
}
