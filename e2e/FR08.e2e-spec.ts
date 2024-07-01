const { test, expect } = require('@playwright/test');

import { goToHome, clearBrowserCache } from './utils/app.utils';

test.describe('Zonemaster test FR08 - [Presence of a default fallback language - English]', () => {
  test.beforeEach(async ({ page }) => {
    await goToHome(page);
    await clearBrowserCache(page);
  });

  test('should have a fallback language - English', async ({ page }) => {
    await expect(page.locator('label[for="domain-input"]')).toHaveText('Domain name');
  });
});
