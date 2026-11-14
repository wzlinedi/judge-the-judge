// An explicit check of every text pair on the screen against 4.5:1 (FR-007, Principle VII). axe-core allows 3:1 for large text, so on its own
// it does not prove the rule of the spec; this walks the visible text of the page, or of one container, and reads the colors the browser used.
import type { Page } from '@playwright/test';

export interface ContrastFailure {
  where: string;
  text: string;
  ratio: number;
  foreground: string;
  background: string;
}

export const MINIMUM_RATIO = 4.5;

/**
 * The text pairs below 4.5:1 inside `scope` (the whole page by default). Disabled controls are left out: WCAG does not ask for contrast
 * from an inactive control. The background is the first opaque color found going up from the element, blended over what lies beneath.
 */
export async function contrastFailures(page: Page, scope = 'body'): Promise<ContrastFailure[]> {
  return page.evaluate(
    ({ scope: root, minimum }) => {
      type Rgba = [number, number, number, number];
      const parse = (value: string): Rgba | null => {
        const rgb = value.match(/^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
        if (rgb) {
          const alpha = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
          return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3]), alpha];
        }
        const srgb = value.match(/^color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/);
        if (srgb) {
          const alpha = srgb[4] === undefined ? 1 : srgb[4].endsWith('%') ? parseFloat(srgb[4]) / 100 : parseFloat(srgb[4]);
          return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255, alpha];
        }
        return null;
      };
      const over = (top: Rgba, below: Rgba): Rgba => {
        const alpha = top[3] + below[3] * (1 - top[3]);
        const mix = (i: 0 | 1 | 2) => (top[i] * top[3] + below[i] * below[3] * (1 - top[3])) / (alpha || 1);
        return [mix(0), mix(1), mix(2), alpha];
      };
      const luminance = ([r, g, b]: Rgba) => {
        const channel = (c: number) => {
          const s = c / 255;
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
      };
      const background = (element: Element): Rgba => {
        const layers: Rgba[] = [];
        for (let node: Element | null = element; node; node = node.parentElement) {
          const color = parse(getComputedStyle(node).backgroundColor);
          if (color && color[3] > 0) {
            layers.push(color);
            if (color[3] >= 1) break;
          }
        }
        return layers.reduceRight<Rgba>((below, layer) => over(layer, below), [255, 255, 255, 1]);
      };
      const describe = (element: Element) => {
        const id = element.id ? `#${element.id}` : '';
        const classes = element.className && typeof element.className === 'string' ? `.${element.className.trim().split(/\s+/).join('.')}` : '';
        return `${element.tagName.toLowerCase()}${id}${classes}`;
      };

      const failures: Array<{ where: string; text: string; ratio: number; foreground: string; background: string }> = [];
      const container = document.querySelector(root);
      if (!container) return failures;
      const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
      const seen = new Set<Element>();
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const element = node.parentElement;
        if (!element || seen.has(element) || !(node.textContent ?? '').trim()) continue;
        seen.add(element);
        if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'OPTION'].includes(element.tagName)) continue;
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        if (style.visibility === 'hidden' || style.display === 'none' || box.width === 0 || box.height === 0) continue;
        if (element.closest(':disabled, [aria-disabled="true"], .visually-hidden')) continue;
        const foreground = parse(style.color);
        if (!foreground) continue;
        const behind = background(element);
        const mixed = over(foreground, behind);
        const l1 = luminance(mixed);
        const l2 = luminance(behind);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        if (ratio < minimum) {
          failures.push({
            where: describe(element),
            text: (node.textContent ?? '').trim().slice(0, 40),
            ratio: Math.round(ratio * 100) / 100,
            foreground: style.color,
            background: `rgb(${Math.round(behind[0])} ${Math.round(behind[1])} ${Math.round(behind[2])})`,
          });
        }
      }
      return failures;
    },
    { scope, minimum: MINIMUM_RATIO },
  );
}
