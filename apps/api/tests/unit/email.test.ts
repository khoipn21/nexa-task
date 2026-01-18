import { describe, expect, it } from 'bun:test'
import { isValidEmail, sanitizeForEmail } from '../../src/lib/email'

describe('Email Validation', () => {
  describe('isValidEmail', () => {
    it('accepts valid email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true)
      expect(isValidEmail('test.user@domain.org')).toBe(true)
      expect(isValidEmail('name+tag@company.co.uk')).toBe(true)
    })

    it('rejects empty or non-string values', () => {
      expect(isValidEmail('')).toBe(false)
      expect(isValidEmail(null as unknown as string)).toBe(false)
      expect(isValidEmail(undefined as unknown as string)).toBe(false)
      expect(isValidEmail(123 as unknown as string)).toBe(false)
    })

    it('rejects emails longer than 254 characters', () => {
      const longEmail = `${'a'.repeat(250)}@b.com`
      expect(isValidEmail(longEmail)).toBe(false)
    })

    it('rejects emails with injection characters', () => {
      expect(isValidEmail('user@example.com\r\n')).toBe(false)
      expect(isValidEmail('user\r@example.com')).toBe(false)
      expect(isValidEmail('user\n@example.com')).toBe(false)
    })

    it('rejects emails with missing parts', () => {
      expect(isValidEmail('noatsign.com')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
      expect(isValidEmail('user@')).toBe(false)
      expect(isValidEmail('user@example')).toBe(false)
    })

    it('rejects emails with spaces', () => {
      expect(isValidEmail('user @example.com')).toBe(false)
      expect(isValidEmail('user@ example.com')).toBe(false)
    })
  })
})

describe('Email Sanitization', () => {
  describe('sanitizeForEmail', () => {
    it('returns empty string for undefined/null', () => {
      expect(sanitizeForEmail(undefined)).toBe('')
      expect(sanitizeForEmail(null as unknown as string)).toBe('')
    })

    it('returns empty string for empty input', () => {
      expect(sanitizeForEmail('')).toBe('')
    })

    it('escapes HTML special characters', () => {
      expect(sanitizeForEmail('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      )
    })

    it('escapes ampersands', () => {
      expect(sanitizeForEmail('Tom & Jerry')).toBe('Tom &amp; Jerry')
    })

    it('escapes single quotes', () => {
      expect(sanitizeForEmail("It's fine")).toBe('It&#x27;s fine')
    })

    it('escapes all HTML entities in combined input', () => {
      expect(sanitizeForEmail('<div class="test">Hello & Goodbye</div>')).toBe(
        '&lt;div class=&quot;test&quot;&gt;Hello &amp; Goodbye&lt;/div&gt;',
      )
    })

    it('preserves safe characters', () => {
      expect(sanitizeForEmail('Hello World 123!')).toBe('Hello World 123!')
    })
  })
})
