import { Button, Heading, Section, Text } from '@react-email/components'
import { BaseLayout } from './base-layout'

interface TaskAssignedEmailProps {
  taskTitle: string
  projectName: string
  assignerName: string
  taskUrl: string
  dueDate?: string
  unsubscribeUrl?: string
}

// Email sent when a user is assigned to a task
export function TaskAssignedEmail({
  taskTitle,
  projectName,
  assignerName,
  taskUrl,
  dueDate,
  unsubscribeUrl,
}: TaskAssignedEmailProps) {
  return (
    <BaseLayout preview={`You've been assigned to: ${taskTitle}`} unsubscribeUrl={unsubscribeUrl}>
      <Section style={content}>
        <Heading style={heading}>You've been assigned a new task</Heading>
        <Text style={paragraph}>
          <strong>{assignerName}</strong> assigned you to{' '}
          <strong>"{taskTitle}"</strong> in project <strong>{projectName}</strong>.
        </Text>
        {dueDate && (
          <Text style={paragraph}>
            Due date: <strong>{dueDate}</strong>
          </Text>
        )}
        <Button style={button} href={taskUrl}>
          View Task
        </Button>
      </Section>
    </BaseLayout>
  )
}

// Styles
const content = {
  padding: '20px 32px',
}

const heading = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  color: '#1f2937',
  margin: '0 0 16px',
}

const paragraph = {
  color: '#374151',
  fontSize: '14px',
  lineHeight: '24px',
  margin: '0 0 16px',
}

const button = {
  backgroundColor: '#7c3aed',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
}

export default TaskAssignedEmail
