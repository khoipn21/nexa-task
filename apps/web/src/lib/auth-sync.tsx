import { useAuth } from '@clerk/clerk-react'
import { type ReactNode, useEffect, useState } from 'react'
import { api } from './api'

export function AuthSync({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [tokenReady, setTokenReady] = useState(false)

  useEffect(() => {
    if (!isLoaded) return

    if (isSignedIn) {
      // Set token getter that fetches fresh token on each request
      api.setTokenGetter(() => getToken())
      setTokenReady(true)
    } else {
      api.setTokenGetter(null)
      setTokenReady(true)
    }
  }, [isLoaded, isSignedIn, getToken])

  // Wait for auth to load and token getter to be set before rendering children
  if (!isLoaded || !tokenReady) {
    return null
  }

  return <>{children}</>
}
