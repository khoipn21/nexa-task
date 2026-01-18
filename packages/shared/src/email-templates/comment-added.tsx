import { Button, Heading, Section, Text } from '@react-email/components'
import { BaseLayout } from './base-layout'

interface CommentAddedEmailProps {
  taskTitle: string
  projectName: string
  commenterName: string
  commentPreview: string
  taskUrl: string
  isMention?: boolean
  unsubscribeUrl?: string
}

// Email sent when a comment is added to a watched task or user is mentioned
export function CommentAddedEmail({
  taskTitle,
  projectName,
  commenterName,
  commentPreview,
  taskUrl,
  isMention = false,
  unsubscribeUrl,
}: CommentAddedEmailProps) {
  const previewText = isMention
    ? `${commenterName} mentioned you in: ${taskTitle}`
    : `New comment on: ${taskTitle}`

  return (
    <BaseLayout preview={previewText} unsubscribeUrl={unsubscribeUrl}>
      <Section style={content}>
        <Heading style={heading}>
          {isMention ? 'You were mentioned' : 'New Comment'}
        </Heading>
        <Text style={paragraph}>
          <strong>{commenterName}</strong>{' '}
          {isMention ? 'mentioned you in' : 'commented on'}{' '}
          <strong>"{taskTitle}"</strong> in project{' '}
          <strong>{projectName}</strong>.
        </Text>
        <Section style={commentBox}>
          <Text style={commentText}>"{commentPreview}"</Text>
        </Section>
        <Button style={button} href={taskUrl}>
          View Comment
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

const commentBox = {
  backgroundColor: '#f3f4f6',
  borderLeft: '4px solid #7c3aed',
  borderRadius: '0 6px 6px 0',
  padding: '16px',
  marginBottom: '16px',
}

const commentText = {
  color: '#374151',
  fontSize: '14px',
  fontStyle: 'italic' as const,
  lineHeight: '20px',
  margin: '0',
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

export default CommentAddedEmail
