export function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function isVisible(element: Element): boolean {
  if (!element.isConnected) return false;

  const style = getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function readPath(root: unknown, path: readonly (string | number)[]): unknown {
  let current = root;

  for (const key of path) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object' && typeof current !== 'function') return undefined;
    current = (current as Record<string | number, unknown>)[key];
  }

  return current;
}

export function createSvgIcon(pathData: string, className: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add(className);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  svg.appendChild(path);

  return svg;
}
