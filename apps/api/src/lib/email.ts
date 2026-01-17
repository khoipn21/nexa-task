import nodemailer from 'nodemailer'
import type { Transporter } from 'nodemailer'

// Singleton transporter instance
let transporter: Transporter | null = null

// Circuit breaker state
let circuitOpen = false
let failureCount = 0
let lastFailureTime = 0
const FAILURE_THRESHOLD = 5
const RECOVERY_TIME_MS = 60000 // 1 minute

// Email configuration from environment variables
interface EmailConfig {
  host: string
  port: number
  secure: boolean
  requireTLS: boolean
  user: string
  pass: string
  from: string
  poolSize: number
}

function getEmailConfig(): EmailConfig {
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM

  if (!user || !pass) {
    throw new Error('SMTP_USER and SMTP_PASS environment variables are required')
  }

  if (!from) {
    throw new Error('SMTP_FROM environment variable is required')
  }

  return {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    requireTLS: process.env.SMTP_REQUIRE_TLS !== 'false', // Default true
    user,
    pass,
    from,
    poolSize: Number(process.env.SMTP_POOL_SIZE) || 5,
  }
}

// Email address validation regex (RFC 5322 simplified)
const EMAIL_REGEX = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/

// Validate email address to prevent injection attacks
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false
  if (email.length > 254) return false
  // Check for injection characters
  if (/[\r\n]/.test(email)) return false
  return EMAIL_REGEX.test(email)
}

// Sanitize string for use in email content (prevent XSS)
export function sanitizeForEmail(str: string | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

// Get or create Nodemailer transporter (singleton pattern with connection pooling)
export function getEmailTransporter(): Transporter {
  if (transporter) {
    return transporter
  }

  const config = getEmailConfig()

  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    requireTLS: config.requireTLS,
    pool: true,
    maxConnections: config.poolSize,
    maxMessages: 100,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })

  return transporter
}

// Email send options
export interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  text?: string
  priority?: 'high' | 'normal' | 'low'
}

// Check circuit breaker state
function checkCircuitBreaker(): boolean {
  if (!circuitOpen) return false

  // Check if recovery time has passed
  if (Date.now() - lastFailureTime > RECOVERY_TIME_MS) {
    circuitOpen = false
    failureCount = 0
    console.log('[Email] Circuit breaker closed, resuming operations')
    return false
  }

  return true
}

// Record failure for circuit breaker
function recordFailure(): void {
  failureCount++
  lastFailureTime = Date.now()

  if (failureCount >= FAILURE_THRESHOLD) {
    circuitOpen = true
    console.error('[Email] Circuit breaker opened after', failureCount, 'failures')
  }
}

// Record success (reset failure count)
function recordSuccess(): void {
  failureCount = 0
}

// Send email with error handling, validation, and circuit breaker
export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Check circuit breaker
  if (checkCircuitBreaker()) {
    return {
      success: false,
      error: 'Email service temporarily unavailable (circuit breaker open)',
    }
  }

  // Validate recipient emails
  const recipients = Array.isArray(options.to) ? options.to : [options.to]
  for (const email of recipients) {
    if (!isValidEmail(email)) {
      return {
        success: false,
        error: `Invalid email address: ${email}`,
      }
    }
  }

  try {
    const config = getEmailConfig()
    const transport = getEmailTransporter()

    const info = await transport.sendMail({
      from: config.from,
      to: recipients.join(', '),
      subject: options.subject,
      html: options.html,
      text: options.text,
      priority: options.priority,
    })

    recordSuccess()

    return {
      success: true,
      messageId: info.messageId,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[Email] Send failed:', errorMessage)

    recordFailure()

    return {
      success: false,
      error: errorMessage,
    }
  }
}

// Verify transporter connection (used for health checks)
export async function verifyEmailConnection(): Promise<boolean> {
  if (checkCircuitBreaker()) {
    return false
  }

  try {
    const transport = getEmailTransporter()
    await transport.verify()
    return true
  } catch (error) {
    console.error('[Email] Connection verification failed:', error)
    return false
  }
}

// Close transporter (cleanup on shutdown)
export function closeEmailTransporter(): void {
  if (transporter) {
    transporter.close()
    transporter = null
  }
}

// Get circuit breaker status (for health checks)
export function getCircuitBreakerStatus(): { isOpen: boolean; failureCount: number } {
  return {
    isOpen: circuitOpen,
    failureCount,
  }
}
