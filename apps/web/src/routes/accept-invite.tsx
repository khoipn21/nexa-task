import { useAuth } from '@clerk/clerk-react'
import {
  Alert,
  Button,
  Center,
  Loader,
  Paper,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

export default function AcceptInvite() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isSignedIn, isLoaded: authLoaded } = useAuth()

  // Clerk invitation params
  const ticket = searchParams.get('__clerk_ticket')
  const clerkStatus = searchParams.get('__clerk_status') // 'sign_in' or 'sign_up'

  const [redirecting, setRedirecting] = useState(false)

  // Redirect to Clerk sign-in/sign-up with ticket
  useEffect(() => {
    if (!authLoaded || !ticket || redirecting) return

    // If already signed in, redirect to dashboard
    // Clerk auto-adds user to org when they sign in with the ticket
    if (isSignedIn) {
      navigate('/dashboard')
      return
    }

    // Build Clerk auth URL with ticket
    setRedirecting(true)
    const baseUrl = window.location.origin
    const afterSignInUrl = `${baseUrl}/dashboard`
    const afterSignUpUrl = `${baseUrl}/dashboard`

    // Redirect to Clerk's hosted sign-in/sign-up page with ticket
    // The ticket will be automatically processed by Clerk
    if (clerkStatus === 'sign_up') {
      // New user - redirect to sign-up with ticket
      window.location.href = `/sign-up#/?__clerk_ticket=${encodeURIComponent(ticket)}&redirect_url=${encodeURIComponent(afterSignUpUrl)}`
    } else {
      // Existing user - redirect to sign-in with ticket
      window.location.href = `/sign-in#/?__clerk_ticket=${encodeURIComponent(ticket)}&redirect_url=${encodeURIComponent(afterSignInUrl)}`
    }
  }, [authLoaded, isSignedIn, ticket, clerkStatus, navigate, redirecting])

  // No ticket = invalid URL
  if (!ticket) {
    return (
      <Center h="100vh">
        <Paper p="xl" radius="md" withBorder maw={400} w="100%">
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            title="Invalid Link"
          >
            This invitation link is invalid or has expired. Please request a new
            invitation.
          </Alert>
          <Button mt="md" fullWidth onClick={() => navigate('/sign-in')}>
            Go to Sign In
          </Button>
        </Paper>
      </Center>
    )
  }

  // Redirecting to Clerk
  return (
    <Center h="100vh">
      <Paper p="xl" radius="md" withBorder maw={400} w="100%">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Title order={4}>Accepting Invitation</Title>
          <Text c="dimmed" ta="center">
            Redirecting to complete sign in...
          </Text>
        </Stack>
      </Paper>
    </Center>
  )
}
