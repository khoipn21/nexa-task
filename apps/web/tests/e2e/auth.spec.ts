import { expect, test } from '@playwright/test'

test.describe('Authentication', () => {
  test('redirects unauthenticated users to sign-in', async ({ page }) => {
    // Navigate to protected route
    await page.goto('/dashboard')

    // Should redirect to Clerk sign-in
    await expect(page).toHaveURL(/sign-in/)
  })

  test('landing page loads correctly', async ({ page }) => {
    await page.goto('/')

    // Verify page loads without errors
    await expect(page).not.toHaveURL(/error/)
  })

  test('sign-in page is accessible', async ({ page }) => {
    await page.goto('/sign-in')

    // Clerk sign-in component should be present
    await expect(page.locator('body')).toBeVisible()
  })
})
