import { AppShellLayout } from '@/components/layouts/app-shell'
import { SignIn, SignUp, SignedIn, SignedOut } from '@clerk/clerk-react'
import { Navigate, createBrowserRouter } from 'react-router'
import AcceptInvite from './accept-invite'
import Dashboard from './dashboard'
import ProjectDetail from './project-detail'
import Projects from './projects'
import Settings from './settings'
import TaskDetail from './task-detail'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <Navigate to="/sign-in" replace />
      </SignedOut>
    </>
  )
}

export const router = createBrowserRouter([
  {
    path: '/sign-in/*',
    element: (
      <div className="flex min-h-screen items-center justify-center">
        <SignIn routing="path" path="/sign-in" />
      </div>
    ),
  },
  {
    path: '/sign-up/*',
    element: (
      <div className="flex min-h-screen items-center justify-center">
        <SignUp routing="path" path="/sign-up" />
      </div>
    ),
  },
  {
    path: '/accept-invite',
    element: <AcceptInvite />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShellLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: 'projects', element: <Projects /> },
      { path: 'projects/:id', element: <ProjectDetail /> },
      { path: 'tasks/:id', element: <TaskDetail /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
])
