import { describe, expect, it } from 'bun:test'
import { JOB_PRIORITY, QUEUE_NAMES } from '../../src/lib/queue'

describe('Queue Configuration', () => {
  describe('QUEUE_NAMES', () => {
    it('has email queue name defined', () => {
      expect(QUEUE_NAMES.email).toBe('email-notifications')
    })
  })

  describe('JOB_PRIORITY', () => {
    it('has correct priority levels', () => {
      expect(JOB_PRIORITY.critical).toBe(1)
      expect(JOB_PRIORITY.high).toBe(2)
      expect(JOB_PRIORITY.normal).toBe(3)
      expect(JOB_PRIORITY.low).toBe(4)
    })

    it('lower number means higher priority', () => {
      expect(JOB_PRIORITY.critical).toBeLessThan(JOB_PRIORITY.high)
      expect(JOB_PRIORITY.high).toBeLessThan(JOB_PRIORITY.normal)
      expect(JOB_PRIORITY.normal).toBeLessThan(JOB_PRIORITY.low)
    })
  })
})
