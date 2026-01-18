import { useInvitationByToken } from '@/hooks/use-invitations'
import { useAuth, useSignIn, useSignUp } from '@clerk/clerk-react'
import {
  Alert,
  Button,
  Center,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconAlertCircle, IconCheck } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

export default function AcceptInvite() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { isSignedIn, isLoaded: authLoaded } = useAuth()
  const {
    signIn,
    setActive: setSignInActive,
    isLoaded: signInLoaded,
  } = useSignIn()
  const {
    signUp,
    setActive: setSignUpActive,
    isLoaded: signUpLoaded,
  } = useSignUp()

  // Clerk invitation params
  const ticket = searchParams.get('__clerk_ticket')
  const clerkStatus = searchParams.get('__clerk_status') // 'sign_in' or 'sign_up'

  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showSignUpForm, setShowSignUpForm] = useState(false)
  const [success, setSuccess] = useState(false)

  // Signup form
  const form = useForm({
    initialValues: {
      firstName: '',
      lastName: '',
      password: '',
    },
    validate: {
      firstName: (v) => (v.length < 1 ? 'First name is required' : null),
      lastName: (v) => (v.length < 1 ? 'Last name is required' : null),
      password: (v) =>
        v.length < 8 ? 'Password must be at least 8 characters' : null,
    },
  })

  // Auto sign-in for existing users
  useEffect(() => {
    if (
      !signInLoaded ||
      !signIn ||
      !ticket ||
      clerkStatus !== 'sign_in' ||
      isSignedIn
    ) {
      return
    }

    const acceptInvite = async () => {
      setIsProcessing(true)
      setError(null)

      try {
        const result = await signIn.create({
          strategy: 'ticket',
          ticket,
        })

        if (result.status === 'complete' && result.createdSessionId) {
          await setSignInActive({ session: result.createdSessionId })
          setSuccess(true)
          // Short delay to show success before redirect
          setTimeout(() => navigate('/dashboard'), 1000)
        }
      } catch (err) {
        console.error('Sign-in error:', err)
        const clerkError = err as { errors?: Array<{ message: string }> }
        setError(
          clerkError.errors?.[0]?.message || 'Failed to accept invitation',
        )
      } finally {
        setIsProcessing(false)
      }
    }

    acceptInvite()
  }, [
    signIn,
    signInLoaded,
    ticket,
    clerkStatus,
    isSignedIn,
    setSignInActive,
    navigate,
  ])

  // Show signup form for new users
  useEffect(() => {
    if (clerkStatus === 'sign_up' && ticket && !isSignedIn && signUpLoaded) {
      setShowSignUpForm(true)
    }
  }, [clerkStatus, ticket, isSignedIn, signUpLoaded])

  // Redirect if already signed in
  useEffect(() => {
    if (authLoaded && isSignedIn && !isProcessing && !success) {
      navigate('/dashboard')
    }
  }, [authLoaded, isSignedIn, isProcessing, success, navigate])

  // Handle signup form submission
  const handleSignUp = form.onSubmit(async (values) => {
    if (!signUp || !ticket) return

    setIsProcessing(true)
    setError(null)

    try {
      const result = await signUp.create({
        strategy: 'ticket',
        ticket,
        firstName: values.firstName,
        lastName: values.lastName,
        password: values.password,
      })

      if (result.status === 'complete' && result.createdSessionId) {
        await setSignUpActive({ session: result.createdSessionId })
        setSuccess(true)
        setTimeout(() => navigate('/dashboard'), 1000)
      }
    } catch (err) {
      console.error('Sign-up error:', err)
      const clerkError = err as { errors?: Array<{ message: string }> }
      setError(clerkError.errors?.[0]?.message || 'Failed to create account')
    } finally {
      setIsProcessing(false)
    }
  })

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

  // Success state
  if (success) {
    return (
      <Center h="100vh">
        <Paper p="xl" radius="md" withBorder maw={400} w="100%">
          <Stack align="center" gap="md">
            <IconCheck size={48} color="var(--mantine-color-green-6)" />
            <Title order={3}>Welcome to the team!</Title>
            <Text c="dimmed" ta="center">
              You've successfully joined the workspace. Redirecting...
            </Text>
            <Loader size="sm" />
          </Stack>
        </Paper>
      </Center>
    )
  }

  // Signup form for new users
  if (showSignUpForm) {
    return (
      <Center h="100vh">
        <Paper p="xl" radius="md" withBorder maw={400} w="100%">
          <Stack>
            <Title order={3}>Complete Your Account</Title>
            <Text c="dimmed" size="sm">
              Create your account to join the workspace
            </Text>

            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red">
                {error}
              </Alert>
            )}

            <form onSubmit={handleSignUp}>
              <Stack>
                <TextInput
                  label="First Name"
                  placeholder="John"
                  required
                  {...form.getInputProps('firstName')}
                />
                <TextInput
                  label="Last Name"
                  placeholder="Doe"
                  required
                  {...form.getInputProps('lastName')}
                />
                <PasswordInput
                  label="Password"
                  placeholder="Min 8 characters"
                  required
                  {...form.getInputProps('password')}
                />
                <Button type="submit" loading={isProcessing} fullWidth>
                  Create Account & Join
                </Button>
              </Stack>
            </form>
          </Stack>
        </Paper>
      </Center>
    )
  }

  // Processing / Error state
  return (
    <Center h="100vh">
      <Paper p="xl" radius="md" withBorder maw={400} w="100%">
        <Stack align="center" gap="md">
          {error ? (
            <>
              <Alert
                icon={<IconAlertCircle size={16} />}
                color="red"
                title="Error"
                w="100%"
              >
                {error}
              </Alert>
              <Button fullWidth onClick={() => navigate('/sign-in')}>
                Go to Sign In
              </Button>
            </>
          ) : (
            <>
              <Loader size="lg" />
              <Text>Processing invitation...</Text>
            </>
          )}
        </Stack>
      </Paper>
    </Center>
  )
}
