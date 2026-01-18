import { render } from '@react-email/components'
import {
  CommentAddedEmail,
  TaskAssignedEmail,
  TaskUpdatedEmail,
} from '@repo/shared'
import type { Job } from 'bullmq'
import { sanitizeForEmail, sendEmail } from '../lib/email'
import { type EmailJobData, createEmailWorker } from '../lib/queue'

// Sanitize all template data to prevent XSS
function sanitizeTemplateData(data: EmailJobData['templateData']) {
  return {
    taskTitle: sanitizeForEmail(data.taskTitle),
    projectName: sanitizeForEmail(data.projectName),
    actorName: sanitizeForEmail(data.actorName),
    taskUrl: data.taskUrl || '#', // URLs are validated elsewhere, don't sanitize
    dueDate: sanitizeForEmail(data.dueDate),
    changeType: data.changeType,
    oldValue: sanitizeForEmail(data.oldValue),
    newValue: sanitizeForEmail(data.newValue),
    commentPreview: sanitizeForEmail(data.commentPreview),
    isMention: data.isMention,
    unsubscribeUrl:
      data.unsubscribeUrl ||
      `${process.env.FRONTEND_URL || ''}/settings/notifications`,
  }
}

// Render email template based on notification type
async function renderEmailTemplate(job: EmailJobData): Promise<string> {
  const { type } = job
  const data = sanitizeTemplateData(job.templateData)

  switch (type) {
    case 'task_assigned':
      return await render(
        TaskAssignedEmail({
          taskTitle: data.taskTitle || 'Untitled Task',
          projectName: data.projectName || 'Unknown Project',
          assignerName: data.actorName || 'Someone',
          taskUrl: data.taskUrl,
          dueDate: data.dueDate || undefined,
          unsubscribeUrl: data.unsubscribeUrl,
        }),
      )

    case 'task_status_changed':
      return await render(
        TaskUpdatedEmail({
          taskTitle: data.taskTitle || 'Untitled Task',
          projectName: data.projectName || 'Unknown Project',
          updaterName: data.actorName || 'Someone',
          taskUrl: data.taskUrl,
          changeType: data.changeType || 'status',
          oldValue: data.oldValue || undefined,
          newValue: data.newValue || undefined,
          unsubscribeUrl: data.unsubscribeUrl,
        }),
      )

    case 'task_comment_added':
    case 'task_mentioned':
      return await render(
        CommentAddedEmail({
          taskTitle: data.taskTitle || 'Untitled Task',
          projectName: data.projectName || 'Unknown Project',
          commenterName: data.actorName || 'Someone',
          commentPreview: data.commentPreview || '',
          taskUrl: data.taskUrl,
          isMention: type === 'task_mentioned',
          unsubscribeUrl: data.unsubscribeUrl,
        }),
      )

    case 'task_due_soon':
      return await render(
        TaskUpdatedEmail({
          taskTitle: data.taskTitle || 'Untitled Task',
          projectName: data.projectName || 'Unknown Project',
          updaterName: 'System',
          taskUrl: data.taskUrl,
          changeType: 'due_date',
          newValue: `Due soon: ${data.dueDate || 'today'}`,
          unsubscribeUrl: data.unsubscribeUrl,
        }),
      )

    case 'task_dependency_completed':
      return await render(
        TaskUpdatedEmail({
          taskTitle: data.taskTitle || 'Untitled Task',
          projectName: data.projectName || 'Unknown Project',
          updaterName: 'System',
          taskUrl: data.taskUrl,
          changeType: 'status',
          newValue: 'Blocking task completed - you can now proceed',
          unsubscribeUrl: data.unsubscribeUrl,
        }),
      )

    case 'watcher_added':
      return await render(
        TaskAssignedEmail({
          taskTitle: data.taskTitle || 'Untitled Task',
          projectName: data.projectName || 'Unknown Project',
          assignerName: data.actorName || 'Someone',
          taskUrl: data.taskUrl,
          unsubscribeUrl: data.unsubscribeUrl,
        }),
      )

    default:
      throw new Error(`Unknown notification type: ${type}`)
  }
}

// Email job processor function
async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { recipientEmail, subject } = job.data

  console.log(`[EmailWorker] Processing job ${job.id} for ${recipientEmail}`)

  // Render email HTML from React template
  const html = await renderEmailTemplate(job.data)

  // Send email via Nodemailer
  const result = await sendEmail({
    to: recipientEmail,
    subject,
    html,
  })

  if (!result.success) {
    throw new Error(result.error || 'Email send failed')
  }

  console.log(`[EmailWorker] Email sent successfully: ${result.messageId}`)
}

// Start the email worker (call this in app startup or separate worker process)
export function startEmailWorker() {
  const worker = createEmailWorker(processEmailJob)

  console.log('[EmailWorker] Started and listening for jobs')

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('[EmailWorker] Shutting down...')
    await worker.close()
  })

  return worker
}

// For running as standalone worker process
if (import.meta.main) {
  startEmailWorker()
}
