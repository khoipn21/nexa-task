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

  // Sync token getter to API client
  useEffect(() => {
    if (isSignedIn) {
      api.setTokenGetter(() => getToken())
    } else {
      api.setTokenGetter(null)
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
