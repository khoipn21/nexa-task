import { expect, test } from '@playwright/test'

// Note: These tests require a logged-in user session
// In CI, you would use Clerk's test mode or session tokens
test.describe('Task Management', () => {
  test.skip('creates a new task in kanban board', async ({ page }) => {
    // This test requires authentication
    // Implement with Clerk test mode in production

    await page.goto('/projects/test-project')

    // Click add task button
    await page.getByRole('button', { name: /add task/i }).click()

    // Fill in task title
    await page.getByPlaceholder(/task title/i).fill('E2E Test Task')
    await page.keyboard.press('Enter')

    // Verify task appears in the column
    await expect(page.getByText('E2E Test Task')).toBeVisible()
  })

  test.skip('drags task between columns', async ({ page }) => {
    // This test requires authentication and existing data
    await page.goto('/projects/test-project')

    // Get the task card
    const taskCard = page.getByText('E2E Test Task')

    // Get the target column
    const doneColumn = page.locator('[data-status="done"]')

    // Perform drag and drop
    await taskCard.dragTo(doneColumn)

    // Verify task moved
    await expect(doneColumn.getByText('E2E Test Task')).toBeVisible()
  })

  test.skip('opens task detail drawer', async ({ page }) => {
    await page.goto('/projects/test-project')

    // Click on a task
    await page.getByText('E2E Test Task').click()

    // Verify drawer opens
    await expect(page.getByRole('dialog')).toBeVisible()

    // Verify task title is shown
    await expect(
      page.getByRole('heading', { name: 'E2E Test Task' }),
    ).toBeVisible()
  })

  test.skip('updates task priority', async ({ page }) => {
    await page.goto('/projects/test-project')

    // Open task detail
    await page.getByText('E2E Test Task').click()

    // Change priority
    await page.getByLabel('Priority').click()
    await page.getByRole('option', { name: 'High' }).click()

    // Verify priority changed
    await expect(page.getByLabel('Priority')).toHaveValue('high')
  })

  test.skip('adds a comment to task', async ({ page }) => {
    await page.goto('/projects/test-project')

    // Open task detail
    await page.getByText('E2E Test Task').click()

    // Navigate to comments
    await page.getByRole('tab', { name: 'Comments' }).click()

    // Add comment
    await page
      .getByPlaceholder(/write a comment/i)
      .fill('This is an E2E test comment')
    await page.getByRole('button', { name: /submit|send/i }).click()

    // Verify comment appears
    await expect(page.getByText('This is an E2E test comment')).toBeVisible()
  })

  test.skip('deletes a task', async ({ page }) => {
    await page.goto('/projects/test-project')

    // Open task detail
    await page.getByText('E2E Test Task').click()

    // Click delete button
    await page.getByRole('button', { name: /delete/i }).click()

    // Confirm deletion
    await page.getByRole('button', { name: /confirm|yes/i }).click()

    // Verify task is removed
    await expect(page.getByText('E2E Test Task')).not.toBeVisible()
  })
})
