import { test, expect } from "@playwright/test";

// Helper: sign in and get to authenticated state
async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/auth/signin");
  await page.fill('input[type="email"]', "admin@admin.local");
  await page.fill('input[type="password"]', "adminpass123");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/);
}

test.describe("New Event Type page", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("back button navigates to previous page, not hardcoded route", async ({ page }) => {
    // Navigate: dashboard -> event types -> new event type
    await page.goto("/settings/events");
    await page.waitForSelector("h1");

    await page.goto("/settings/booking/new");
    await page.waitForSelector("h1");
    await expect(page.locator("h1")).toContainText("New Event Type");

    // Click back button (the arrow icon button)
    await page.click('button:has(svg path[d="M11 4L6 9l5 5"])');

    // Should go back to event types (previous page), not /settings/booking
    await page.waitForURL(/\/settings\/events/);
  });

  test("back button from dashboard -> new event goes back to dashboard", async ({ page }) => {
    // Navigate directly from dashboard via Getting Started link
    await page.goto("/dashboard");
    await page.waitForSelector("h1");

    // Click "Event-Typ anlegen" link if visible
    const link = page.locator('a[href="/settings/booking/new"]');
    if (await link.isVisible()) {
      await link.click();
    } else {
      await page.goto("/settings/booking/new");
    }
    await page.waitForSelector("h1");
    await expect(page.locator("h1")).toContainText("New Event Type");

    // Click back
    await page.click('button:has(svg path[d="M11 4L6 9l5 5"])');

    // Should go back to dashboard
    await page.waitForURL(/\/dashboard/);
  });

  test("branding section exists with color pickers and upload buttons", async ({ page }) => {
    await page.goto("/settings/booking/new");
    await page.waitForSelector("h1");

    // Branding card should exist
    const brandingHeader = page.locator("h2", { hasText: "Branding" });
    await expect(brandingHeader).toBeVisible();

    // Color pickers
    const colorInputs = page.locator('input[type="color"]');
    await expect(colorInputs).toHaveCount(2);

    // Upload buttons for avatar and background
    const uploadButtons = page.locator("button", { hasText: "Upload" });
    await expect(uploadButtons).toHaveCount(2);

    // Profile Photo and Background Image labels
    await expect(page.locator("label", { hasText: "Profile Photo" }).or(page.locator('[data-slot="label"]', { hasText: "Profile Photo" }))).toBeVisible();
    await expect(page.locator("label", { hasText: "Background Image" }).or(page.locator('[data-slot="label"]', { hasText: "Background Image" }))).toBeVisible();
  });

  test("branding color pickers have correct default values", async ({ page }) => {
    await page.goto("/settings/booking/new");
    await page.waitForSelector("h1");

    const colorInputs = page.locator('input[type="color"]');
    // Brand color defaults to rose
    await expect(colorInputs.nth(0)).toHaveValue("#9f1239");
    // Accent color defaults to amber
    await expect(colorInputs.nth(1)).toHaveValue("#d97706");
  });

  test("background opacity slider appears when background URL is set", async ({ page }) => {
    await page.goto("/settings/booking/new");
    await page.waitForSelector("h1");

    // No overlay slider initially
    await expect(page.locator("text=Overlay")).not.toBeVisible();

    // Type a background URL
    const bgInput = page.locator('input[placeholder="Use default"]').nth(3); // Background Image input
    await bgInput.fill("https://example.com/bg.jpg");

    // Overlay slider should appear
    await expect(page.locator("text=Overlay")).toBeVisible();
    await expect(page.locator('input[type="range"]')).toBeVisible();
  });
});

test.describe("Edit Event Type page", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("back button uses browser history", async ({ page }) => {
    // Navigate: dashboard -> settings/events -> first event type edit
    await page.goto("/settings/events");
    await page.waitForSelector("h1");

    // Find an edit button (if event types exist)
    const editLink = page.locator('a[href*="/settings/booking/"][href*="/edit"]').first();
    if (await editLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editLink.click();
      await page.waitForSelector("h1");
      await expect(page.locator("h1")).toContainText("Edit Event Type");

      // Click back
      await page.click('button:has(svg path[d="M11 4L6 9l5 5"])');

      // Should go back to event types list
      await page.waitForURL(/\/settings\/events/);
    }
  });
});
