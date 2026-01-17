import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import type { ReactNode } from 'react'

interface BaseLayoutProps {
  preview: string
  children: ReactNode
  unsubscribeUrl?: string
}

// Base email layout with consistent branding and unsubscribe footer
export function BaseLayout({ preview, children, unsubscribeUrl }: BaseLayoutProps) {
  // Use provided URL or settings page as fallback
  const unsubscribeLink = unsubscribeUrl || '#'

  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>NexaTask</Text>
          </Section>
          {children}
          <Section style={footer}>
            <Text style={footerText}>
              You received this email because you are watching a task on NexaTask.
            </Text>
            <Link href={unsubscribeLink} style={unsubscribeLinkStyle}>
              Unsubscribe from these notifications
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
}

const header = {
  padding: '20px 32px',
  borderBottom: '1px solid #e6ebf1',
}

const logo = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: '#7c3aed',
  margin: '0',
}

const footer = {
  padding: '20px 32px',
  borderTop: '1px solid #e6ebf1',
}

const footerText = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '0 0 8px',
}

const unsubscribeLinkStyle = {
  color: '#8898aa',
  fontSize: '12px',
  textDecoration: 'underline',
}
