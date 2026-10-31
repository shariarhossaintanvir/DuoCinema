import { test, expect } from '@playwright/test';

test.describe('DuoCinema Private Watch-Together', () => {
  test('renders dashboard with setup instructions when unconfigured', async ({ page }) => {
    await page.goto('/');

    // Check brand header
    await expect(page.locator('header')).toContainText('DuoCinema');

    // Check SetupRequiredBanner is present
    await expect(page.getByText(/Supabase Configuration Required/i)).toBeVisible();

    // Check Create Room and Join tabs
    await expect(page.getByRole('button', { name: /Create Room/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Join with Code/i })).toBeVisible();
  });

  test('navigates to settings and displays privacy manifesto & format guide', async ({ page }) => {
    await page.goto('/settings');

    // Check heading
    await expect(page.getByRole('heading', { name: /Help & Local File Privacy/i })).toBeVisible();

    // Verify zero upload assurance
    await expect(page.getByText(/Zero-Upload Architecture & Privacy Manifesto/i)).toBeVisible();
    await expect(page.getByText(/Never Leaves Your Machine/i)).toBeVisible();

    // Verify recommended format
    await expect(page.getByText(/MP4 \(H\.264 \+ AAC\)/i)).toBeVisible();

    // Verify Bengali subtitles note
    await expect(page.getByText(/বাংলা সাবটাইটেল/i)).toBeVisible();
  });

  test('displays cinema 404 page for unknown routes and allows return home', async ({ page }) => {
    await page.goto('/non-existent-route-xyz');

    await expect(page.getByRole('heading', { name: '404' })).toBeVisible();
    await expect(page.getByText(/Screenplay Not Found/i)).toBeVisible();

    const returnBtn = page.getByRole('link', { name: /Return to Dashboard/i });
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();

    await expect(page).toHaveURL('/');
  });

  test('verifies responsive layouts without horizontal overflow', async ({ page }) => {
    // 1. Mobile viewport (360px)
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto('/');
    let scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    let clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // 2. Tablet viewport (768px)
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // 3. Desktop viewport (1280px)
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
