import { useAuth } from '@clerk/clerk-react'
import { type ReactNode, useEffect, useState } from 'react'
import { api } from './api'

export function AuthSync({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  const [tokenReady, setTokenReady] = useState(false)

  useEffect(() => {
    if (!isLoaded) return

    if (isSignedIn) {
      getToken().then((token) => {
        api.setToken(token)
        setTokenReady(true)
      })
    } else {
      api.setToken(null)
      setTokenReady(true)
    }
  }, [isLoaded, isSignedIn, getToken])

  // Wait for auth to load and token to sync before rendering children
  if (!isLoaded || !tokenReady) {
    return null
  }

  return <>{children}</>
}
