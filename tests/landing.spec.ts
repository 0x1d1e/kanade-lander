import AxeBuilder from '@axe-core/playwright';
import { expect, type Page, test } from '@playwright/test';

async function scrollTo(page: Page, y: number) {
  await page.evaluate(async (top) => {
    window.scrollTo({ top, behavior: 'instant' });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
  }, y);
}
async function islandBox(page: Page) {
  const rect = await page.locator('#island').boundingBox();
  if (!rect) throw new Error('The persistent island is not visible');
  return rect;
}
async function openDemo(page: Page) {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/enhanced/);
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
  const y = await page
    .locator('#experience')
    .evaluate((el) => el.getBoundingClientRect().top + window.scrollY);
  await scrollTo(page, y + (await page.evaluate(() => (innerWidth < 760 ? 170 : 230))));
  await expect(page.locator('#island')).toHaveClass(/interactive-mode/);
}
async function choose(page: Page, scenario: string) {
  await page.locator(`[data-scenario="${scenario}"]`).click();
  await expect(page.locator(`[data-scenario="${scenario}"]`)).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.locator('#scenario-presentation')).toContainText(scenario.toUpperCase());
  await page.locator('#island').evaluate(async (el) => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await Promise.allSettled(el.getAnimations().map((animation) => animation.finished));
  });
}

for (const [timezoneId, before, after] of [
  ['UTC', '07:59', '08:00'],
  ['America/Los_Angeles', '23:59', '00:00'],
]) {
  test.describe(`local clock in ${timezoneId}`, () => {
    test.use({ timezoneId });
    test('shows visitor time and updates across minute boundaries', async ({ page }) => {
      await page.clock.install({ time: new Date('2026-01-15T07:59:59Z') });
      await page.goto('/');
      await expect(page.locator('.rest-clock')).toHaveText(before);
      await page.clock.runFor(2000);
      await expect(page.locator('.rest-clock')).toHaveText(after);
      const clocks = page.locator('[data-local-time]');
      await expect(clocks).toHaveCount(2);
      expect(await clocks.allTextContents()).toEqual([after, after]);
    });
  });
}

test('scroll geometry reverses and the single island survives the whole page', async ({
  page,
}, info) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/enhanced/);
  await page.evaluate(() => {
    (window as unknown as { originalIsland: Element | null }).originalIsland =
      document.querySelector('#island');
  });
  const end = await page
    .locator('.hero')
    .evaluate((el) => (el as HTMLElement).offsetHeight - innerHeight);
  const stops = [0.0, 0.24, 0.44, 0.7, 1].map((p) => p * end);
  const rects: { x: number; y: number; width: number; height: number }[] = [];
  for (const y of stops) {
    await scrollTo(page, y);
    rects.push(await islandBox(page));
  }
  for (let i = stops.length - 1; i >= 0; i--) {
    await scrollTo(page, stops[i]);
    const rect = await islandBox(page);
    for (const key of ['x', 'y', 'width', 'height'] as const)
      expect(rect[key]).toBeCloseTo(rects[i][key], 1);
  }
  await scrollTo(page, Math.min(700, end));
  const translation = await page
    .locator('.panel-left')
    .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).m41);
  expect(Math.abs(translation)).toBeGreaterThan(100);
  for (const target of [
    '.philosophy',
    '#experience',
    '#modules',
    '.split-section',
    '#architecture',
    '.footer',
  ]) {
    const y = await page
      .locator(target)
      .evaluate((el) => el.getBoundingClientRect().top + scrollY + 180);
    await scrollTo(page, y);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    expect(
      await page.evaluate(
        () =>
          document.querySelector('#island') ===
          (window as unknown as { originalIsland: Element }).originalIsland,
      ),
    ).toBeTruthy();
  }
  const maxScroll = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  for (let y = 0; y <= maxScroll; y += 180) {
    await scrollTo(page, y);
    const rect = await islandBox(page);
    const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(58);
    expect(rect.x + rect.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(rect.y + rect.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(
      await page.locator('#island').evaluate((el) => {
        const box = el.getBoundingClientRect();
        const previous = el.style.pointerEvents;
        el.style.pointerEvents = 'auto';
        const visible =
          document
            .elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)
            ?.closest('#island') === el;
        el.style.pointerEvents = previous;
        return visible;
      }),
    ).toBeTruthy();
  }
  await scrollTo(page, 0);
  await page.screenshot({ path: `test-results/${info.project.name}-hero.png`, timeout: 30000 });
});

test('the Island becomes the footer wordmark with a reversible morph', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const range = await page.locator('.footer-wordmark-wrap').evaluate((el) => {
    const end = document.documentElement.scrollHeight - innerHeight;
    return {
      start: Math.min(el.getBoundingClientRect().top + scrollY - innerHeight + 100, end - 1),
      end,
    };
  });
  const measure = () =>
    page.locator('#island').evaluate((el) => {
      const style = getComputedStyle(el);
      const wordmark = el.querySelector('.footer-morph-wordmark');
      if (!wordmark) throw new Error('Morph wordmark is missing');
      return {
        box: el.getBoundingClientRect().toJSON(),
        background: style.backgroundColor,
        radius: style.borderRadius,
        fontSize: getComputedStyle(wordmark).fontSize,
        opacity: getComputedStyle(wordmark).opacity,
      };
    });
  const stops = [0, 0.25, 0.5, 0.75, 1].map((p) => range.start + (range.end - range.start) * p);
  const frames = [];
  for (const y of stops) {
    await scrollTo(page, Math.ceil(y));
    frames.push(await measure());
  }
  await expect(page.locator('.footer-wordmark')).toBeHidden();
  await expect(page.locator('.footer-morph-wordmark')).toHaveText('KANADE');
  await expect(page.locator('.rest-layer')).toHaveCSS('opacity', '0');
  expect(frames[4].background).toBe('rgba(3, 4, 6, 0)');
  expect(frames[4].radius).toBe('0px');
  expect(frames[4].opacity).toBe('1');
  const target = await page.locator('.footer-wordmark').boundingBox();
  if (!target) throw new Error('Wordmark layout target is missing');
  for (const key of ['x', 'y', 'width'] as const)
    expect(frames[4].box[key]).toBeCloseTo(target[key], 1);
  expect(frames[4].box.height).toBeCloseTo(
    Math.min(target.height, (await page.evaluate(() => innerHeight)) - target.y),
    1,
  );
  expect(frames[4].box.width).toBeGreaterThan(frames[0].box.width);
  for (let i = stops.length - 1; i >= 0; i--) {
    await scrollTo(page, Math.ceil(stops[i]));
    expect(await measure()).toEqual(frames[i]);
  }
  await scrollTo(page, range.start - 180);
  await expect(page.locator('#island')).not.toHaveClass(/footer-morph/);
});

test('media, timers, notifications and controls actually respond', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openDemo(page);
  await page.getByRole('button', { name: 'Pause playback', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play playback', exact: true })).toBeVisible();
  await page.locator('#media-progress').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#elapsed')).toHaveText('1:24');
  await page.getByRole('button', { name: 'Next track', exact: true }).click();
  await expect(page.locator('#island-content h3')).toHaveText('Still here');
  await choose(page, 'timer');
  await page.getByRole('button', { name: '5 min', exact: true }).click();
  await expect(page.locator('#timer-value')).toHaveText('5:00');
  await page.getByRole('button', { name: 'Start timer', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause timer', exact: true })).toBeVisible();
  await expect(page.locator('#timer-value')).not.toHaveText('5:00', { timeout: 4000 });
  await page.getByRole('button', { name: 'Pause timer', exact: true }).click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('#timer-value')).toHaveText('5:00');
  await choose(page, 'notifications');
  await page.getByRole('switch', { name: 'Do Not Disturb', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Do Not Disturb', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('button', { name: 'Dismiss A moment to step back' }).click();
  await page.getByRole('button', { name: 'Dismiss The quiet hours' }).click();
  await expect(page.locator('#island-content')).toContainText('All clear.');
  await page.getByRole('button', { name: 'Restore sample notifications' }).click();
  await expect(page.locator('.notification-row')).toHaveCount(2);
  await choose(page, 'controls');
  await expect(page.getByRole('switch', { name: 'Do Not Disturb', exact: true })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await page.getByRole('slider', { name: 'Volume' }).focus();
  await page.keyboard.press('End');
  await expect(page.locator('#volume-value')).toHaveText('100%');
  expect(errors).toEqual([]);
});

test('search, privacy, networking and split focus work with sample data', async ({ page }) => {
  await openDemo(page);
  await choose(page, 'launcher');
  await page.getByRole('searchbox', { name: 'Find an application' }).fill('nothing');
  await expect(page.locator('#launcher-results')).toContainText('No matching apps.');
  await page.getByRole('searchbox', { name: 'Find an application' }).fill('files');
  await expect(page.locator('[data-app]')).toHaveCount(1);
  await page.getByRole('searchbox', { name: 'Find an application' }).press('Enter');
  await expect(page.locator('#demo-status')).toContainText('does not launch desktop apps');
  await choose(page, 'privacy');
  await page.getByRole('switch', { name: 'Simulate microphone capture' }).click();
  await expect(page.locator('#privacy-overlay')).toBeVisible();
  await choose(page, 'wifi');
  await page.locator('[data-network="Guest"]').click();
  await expect(page.locator('[data-network="Guest"]')).toBeDisabled();
  await page.getByRole('switch', { name: 'Wi-Fi', exact: true }).click();
  await expect(page.locator('#island-content')).toContainText('Wi-Fi is off.');
  await choose(page, 'bluetooth');
  await page.locator('[data-device="Keyboard"]').click();
  await expect(page.locator('[data-device="Keyboard"]')).toHaveText('Disconnect');
  const splitEnd = await page
    .locator('.split-section')
    .evaluate(
      (el) =>
        el.getBoundingClientRect().top +
        scrollY +
        (el as HTMLElement).offsetHeight -
        innerHeight -
        20,
    );
  await scrollTo(page, splitEnd);
  await page.getByRole('button', { name: 'Focus timer segment' }).click();
  await expect(page.getByRole('button', { name: 'Focus timer segment' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('Split grows the satellite with its body, without an empty reserved segment', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  const range = await page.locator('.split-section').evaluate((el) => ({
    start: Math.ceil(el.getBoundingClientRect().top + scrollY),
    distance: (el as HTMLElement).offsetHeight - innerHeight,
  }));
  const measure = () =>
    page.locator('#island').evaluate((el) => {
      const body = el.getBoundingClientRect();
      const mediaButton = el.querySelector('[data-focus="media"]');
      const timerButton = el.querySelector('[data-focus="timer"]');
      if (!mediaButton || !timerButton) throw new Error('Split segments are missing');
      const media = mediaButton.getBoundingClientRect();
      const timer = timerButton.getBoundingClientRect();
      return {
        bodyWidth: body.width,
        mediaWidth: media.width,
        timerWidth: timer.width,
        mediaCenterOffset: media.y + media.height / 2 - (body.y + body.height / 2),
        timerRight: timer.right - body.right,
        overflow: el.scrollWidth - el.clientWidth,
      };
    });
  await scrollTo(page, range.start + 1);
  const compact = await measure();
  expect(compact.timerWidth).toBeLessThan(1);
  expect(compact.mediaWidth).toBeGreaterThan(compact.bodyWidth - 36);
  expect(Math.abs(compact.mediaCenterOffset)).toBeLessThanOrEqual(1);
  const widths: number[] = [];
  for (const progress of [0.25, 0.5, 0.75, 0.99]) {
    await scrollTo(page, range.start + range.distance * progress);
    const dimensions = await measure();
    widths.push(dimensions.timerWidth);
    expect(dimensions.timerRight).toBeLessThanOrEqual(-10);
    expect(dimensions.overflow).toBeLessThanOrEqual(1);
    expect(Math.abs(dimensions.mediaCenterOffset)).toBeLessThanOrEqual(1);
  }
  expect(widths).toEqual([...widths].sort((a, b) => a - b));
  expect(widths[3]).toBeGreaterThan(80);
  await scrollTo(page, range.start + 1);
  expect(await measure()).toEqual(compact);
});

test('keyboard selection, focus retention and accessibility', async ({ page }) => {
  await openDemo(page);
  const button = page.locator('[data-scenario="controls"]');
  await button.focus();
  await page.keyboard.press('Enter');
  await expect(button).toBeFocused();
  const dnd = page.getByRole('switch', { name: 'Do Not Disturb', exact: true });
  await dnd.focus();
  await page.keyboard.press('Space');
  await expect(dnd).toBeFocused();
  await expect(dnd).toHaveAttribute('aria-checked', 'true');
  for (const scenario of [
    'media',
    'timer',
    'notifications',
    'controls',
    'launcher',
    'privacy',
    'wifi',
    'bluetooth',
  ]) {
    await choose(page, scenario);
    const results = await new AxeBuilder({ page })
      // Decorative ghost lettering is exempt from text contrast, not usable content.
      .exclude('.split-annotation')
      .exclude('.footer-wordmark')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations,
      JSON.stringify(
        results.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
      ),
    ).toEqual([]);
  }
});

test('reduced motion stays static and still interactive', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/reduced-motion/);
  expect(
    await page.locator('.hero').evaluate((el) => (el as HTMLElement).offsetHeight),
  ).toBeLessThanOrEqual(await page.evaluate(() => Math.max(innerHeight, 650)));
  await page.locator('#experience').scrollIntoViewIfNeeded();
  await choose(page, 'timer');
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible();
  expect(await page.locator('#island').evaluate((el) => getComputedStyle(el).position)).toBe(
    'relative',
  );
  await page.locator('.footer').scrollIntoViewIfNeeded();
  await expect(page.locator('.footer-wordmark')).toBeVisible();
  await expect(page.locator('.footer-morph-wordmark')).toBeHidden();
});

test('the document remains complete and readable without JavaScript', async ({ browser }, info) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport:
      info.project.name === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:5173');
  await expect(page.getByRole('heading', { name: 'Kanade', exact: true })).toBeVisible();
  await expect(page.getByText('JavaScript is off.')).toBeVisible();
  await expect(page.locator('.footer-wordmark')).toBeVisible();
  await expect(page.locator('.footer-static')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Small surface. Large system.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View on GitHub', exact: true })).toHaveAttribute(
    'href',
    'https://github.com/0x1d1e/kanade',
  );
  await context.close();
});

test('scenarios fit narrow, tablet and wide viewports', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop');
  for (const width of [320, 768, 1024, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await openDemo(page);
    for (const scenario of [
      'media',
      'timer',
      'notifications',
      'controls',
      'launcher',
      'privacy',
      'wifi',
      'bluetooth',
    ]) {
      await choose(page, scenario);
      const dimensions = await page.locator('#island').evaluate((el) => ({
        contentHeight: el.scrollHeight,
        height: el.clientHeight,
        contentWidth: el.scrollWidth,
        width: el.clientWidth,
      }));
      expect(dimensions.contentHeight, `${scenario} at ${width}px`).toBeLessThanOrEqual(
        dimensions.height + 1,
      );
      expect(dimensions.contentWidth, `${scenario} at ${width}px`).toBeLessThanOrEqual(
        dimensions.width + 1,
      );
    }
    await page.screenshot({ path: `test-results/demo-${width}.png` });
  }
});

test('mobile navigation is accessible and dismissible', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile');
  await page.goto('/');
  const menu = page.locator('.menu-button');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await menu.click();
  await page.locator('#nav-links').getByRole('link', { name: 'Modules', exact: true }).click();
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
});
