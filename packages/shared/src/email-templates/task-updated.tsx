import { Button, Heading, Section, Text } from '@react-email/components'
import { BaseLayout } from './base-layout'

interface TaskUpdatedEmailProps {
  taskTitle: string
  projectName: string
  updaterName: string
  taskUrl: string
  changeType: 'status' | 'priority' | 'due_date' | 'description'
  oldValue?: string
  newValue?: string
  unsubscribeUrl?: string
}

// Email sent when a task is updated (status change, priority, etc.)
export function TaskUpdatedEmail({
  taskTitle,
  projectName,
  updaterName,
  taskUrl,
  changeType,
  oldValue,
  newValue,
  unsubscribeUrl,
}: TaskUpdatedEmailProps) {
  const changeLabels: Record<string, string> = {
    status: 'Status',
    priority: 'Priority',
    due_date: 'Due date',
    description: 'Description',
  }

  return (
    <BaseLayout
      preview={`Task updated: ${taskTitle}`}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Section style={content}>
        <Heading style={heading}>Task Updated</Heading>
        <Text style={paragraph}>
          <strong>{updaterName}</strong> updated <strong>"{taskTitle}"</strong>{' '}
          in project <strong>{projectName}</strong>.
        </Text>
        <Section style={changeBox}>
          <Text style={changeLabel}>{changeLabels[changeType]} changed:</Text>
          {oldValue && (
            <Text style={changeValue}>
              <span style={oldValueStyle}>{oldValue}</span>
              <span style={arrow}> → </span>
              <span style={newValueStyle}>{newValue}</span>
            </Text>
          )}
          {!oldValue && newValue && (
            <Text style={newValueStyle}>{newValue}</Text>
          )}
        </Section>
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

const changeBox = {
  backgroundColor: '#f3f4f6',
  borderRadius: '6px',
  padding: '16px',
  marginBottom: '16px',
}

const changeLabel = {
  color: '#6b7280',
  fontSize: '12px',
  fontWeight: 'bold' as const,
  margin: '0 0 8px',
  textTransform: 'uppercase' as const,
}

const changeValue = {
  color: '#1f2937',
  fontSize: '14px',
  margin: '0',
}

const oldValueStyle = {
  color: '#9ca3af',
  textDecoration: 'line-through',
}

const arrow = {
  color: '#6b7280',
}

const newValueStyle = {
  color: '#059669',
  fontWeight: 'bold' as const,
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

export default TaskUpdatedEmail
