import { isVisible, normalizeText, readPath } from '../shared/dom';
import { findMenuButton } from './cards';
import { MENU_ITEM_SELECTOR } from './selectors';

export type RecommendationActionKey = 'notInterested' | 'dontRecommend';

interface RecommendationActionDefinition {
  label: string;
  iconName: string;
  textMatchers: RegExp[];
  iconPath: string;
}

export const RECOMMENDATION_ACTIONS: Record<
  RecommendationActionKey,
  RecommendationActionDefinition
> = {
  notInterested: {
    label: 'Not interested',
    iconName: 'HIDE',
    textMatchers: [/^not interested$/i, /^nicht interessiert$/i, /^kein interesse$/i],
    iconPath:
      'M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05A2.01 2.01 0 0 0 3 14h5.63l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.17 21 16 14.17V5c0-1.1-.9-2-2-2h-1Zm-1 10.34-4.34 4.34L10.89 12H3l3-7h8v8.34ZM18 3h4v12h-4V3Z',
  },
  dontRecommend: {
    label: "Don't recommend channel",
    iconName: 'REMOVE',
    textMatchers: [
      /^don't recommend channel$/i,
      /^do not recommend channel$/i,
      /^kanal nicht empfehlen$/i,
      /^diesen kanal nicht empfehlen$/i,
      /^diesen kanal nicht mehr empfehlen$/i,
      /^keine videos von diesem kanal$/i,
    ],
    iconPath:
      'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2Zm0 2c1.85 0 3.55.63 4.9 1.69L5.69 16.9A7.95 7.95 0 0 1 4 12c0-4.41 3.59-8 8-8Zm0 16a7.95 7.95 0 0 1-4.9-1.69L18.31 7.1A7.95 7.95 0 0 1 20 12c0 4.41-3.59 8-8 8Z',
  },
};

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function getMenuItemText(element: Element): string {
  const preferredText = element.querySelector(
    [
      '.yt-list-item-view-model__title',
      '.ytListItemViewModelTitle',
      'yt-formatted-string',
      '[role="menuitem"]',
    ].join(','),
  );

  return normalizeText(preferredText?.textContent ?? element.textContent);
}

function getViewModelCandidates(element: Element): unknown[] {
  return [
    readPath(element, ['data']),
    readPath(element, ['data', 'listItemViewModel']),
    readPath(element, ['__data', 'data']),
    readPath(element, ['__data', 'listItemViewModel']),
    readPath(element, ['__data', 'viewModel']),
    readPath(element, ['__dataHost', 'data']),
  ].filter((value) => value !== undefined && value !== null);
}

function getSemanticAction(element: Element): RecommendationActionKey | null {
  for (const candidate of getViewModelCandidates(element)) {
    const viewModel = readPath(candidate, ['listItemViewModel']) ?? candidate;
    const sources = readPath(viewModel, ['leadingImage', 'sources']);
    const command = readPath(viewModel, [
      'rendererContext',
      'commandContext',
      'onTap',
      'innertubeCommand',
    ]);

    if (!Array.isArray(sources) || !readPath(command, ['feedbackEndpoint'])) continue;

    const iconName = sources
      .map((source) => readPath(source, ['clientResource', 'imageName']))
      .find((value): value is string => typeof value === 'string');

    if (iconName === RECOMMENDATION_ACTIONS.notInterested.iconName) return 'notInterested';
    if (iconName === RECOMMENDATION_ACTIONS.dontRecommend.iconName) return 'dontRecommend';
  }

  return null;
}

function menuItemMatchesAction(element: Element, actionKey: RecommendationActionKey): boolean {
  if (getSemanticAction(element) === actionKey) return true;
  const text = getMenuItemText(element);
  return RECOMMENDATION_ACTIONS[actionKey].textMatchers.some((matcher) => matcher.test(text));
}

function getVisibleMenuItems(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR)].filter(isVisible);
}

function findVisibleActionItem(actionKey: RecommendationActionKey): HTMLElement | null {
  return getVisibleMenuItems().find((item) => menuItemMatchesAction(item, actionKey)) ?? null;
}

function getClickableMenuTarget(item: HTMLElement): HTMLElement {
  return (
    item.querySelector<HTMLElement>(
      [
        '.yt-list-item-view-model__container--tappable',
        '.ytListItemViewModelContainer',
        '[role="menuitem"]',
        'button',
        'a',
      ].join(','),
    ) ?? item
  );
}

function dispatchRealClick(element: HTMLElement): void {
  element.focus({ preventScroll: true });

  const pointerOptions: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    buttons: 1,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    view: window,
  };

  const mouseOptions: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    button: 0,
    buttons: 1,
    view: window,
  };

  try {
    element.dispatchEvent(new PointerEvent('pointerdown', pointerOptions));
    element.dispatchEvent(new MouseEvent('mousedown', mouseOptions));
    element.dispatchEvent(new PointerEvent('pointerup', { ...pointerOptions, buttons: 0 }));
    element.dispatchEvent(new MouseEvent('mouseup', { ...mouseOptions, buttons: 0 }));
    element.dispatchEvent(new MouseEvent('click', { ...mouseOptions, buttons: 0 }));
  } catch {
    element.click();
  }
}

function dispatchEscape(): void {
  const target = document.activeElement ?? document.body;
  const options: KeyboardEventInit = {
    key: 'Escape',
    code: 'Escape',
    keyCode: 27,
    which: 27,
    bubbles: true,
    cancelable: true,
    composed: true,
  };

  target.dispatchEvent(new KeyboardEvent('keydown', options));
  target.dispatchEvent(new KeyboardEvent('keyup', options));
}

function waitForActionItem(
  actionKey: RecommendationActionKey,
  timeout = 2200,
): Promise<HTMLElement | null> {
  const existing = findVisibleActionItem(actionKey);
  if (existing) return Promise.resolve(existing);

  return new Promise((resolve) => {
    let settled = false;

    const observer = new MutationObserver(() => {
      const item = findVisibleActionItem(actionKey);
      if (item) finish(item);
    });

    const timeoutId = window.setTimeout(() => finish(null), timeout);

    const finish = (value: HTMLElement | null): void => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      window.clearTimeout(timeoutId);
      resolve(value);
    };

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'hidden', 'aria-hidden'],
    });
  });
}

export class FeedbackActions {
  private actionInProgress = false;

  async run(
    card: HTMLElement,
    actionKey: RecommendationActionKey,
    showToast: (message: string) => void,
  ): Promise<boolean> {
    if (this.actionInProgress || !card.isConnected) return false;
    this.actionInProgress = true;

    try {
      if (getVisibleMenuItems().length > 0) {
        dispatchEscape();
        await sleep(70);
      }

      const menuButton = findMenuButton(card);
      if (!menuButton?.isConnected) {
        showToast('YouTube changed this video menu before the action could run.');
        return false;
      }

      dispatchRealClick(menuButton);
      const item = await waitForActionItem(actionKey);

      if (!item) {
        if (menuButton.isConnected) dispatchRealClick(menuButton);
        showToast(`Could not find “${RECOMMENDATION_ACTIONS[actionKey].label}” in this menu.`);
        return false;
      }

      dispatchRealClick(getClickableMenuTarget(item));
      return true;
    } finally {
      this.actionInProgress = false;
    }
  }
}
