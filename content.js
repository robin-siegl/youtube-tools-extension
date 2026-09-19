(() => {
  'use strict';

  const EXTENSION_PREFIX = 'ytfc';

  const CARD_SELECTOR = [
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-compact-video-renderer',
  ].join(',');

  const LOCKUP_SELECTOR = 'yt-lockup-view-model';

  const MENU_ITEM_SELECTOR = [
    'yt-list-item-view-model',
    'ytd-menu-service-item-renderer',
    'ytd-menu-navigation-item-renderer',
    'tp-yt-paper-item[role="menuitem"]',
    '[role="menuitem"]',
  ].join(',');

  const ACTIONS = {
    notInterested: {
      label: 'Not interested',
      iconName: 'HIDE',
      textMatchers: [
        /^not interested$/i,
        /^nicht interessiert$/i,
        /^kein interesse$/i,
      ],
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

  const controlsByCard = new Map();

  let scanTimer = null;
  let positionFrame = null;
  let navigating = false;
  let actionInProgress = false;
  let mutationObserver = null;
  let resizeObserver = null;
  let overlayLayer = null;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  function normalizeText(value) {
    return String(value || '')
      .replace(/[’‘`]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isVisible(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;

    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (element.getAttribute('aria-hidden') === 'true') return false;

    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function stopCardInteraction(event) {
    event.stopPropagation();
  }

  function createIcon(pathData) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    svg.classList.add(`${EXTENSION_PREFIX}-action__icon`);

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    svg.appendChild(path);

    return svg;
  }

  function ensureOverlayLayer() {
    if (overlayLayer?.isConnected) return overlayLayer;

    overlayLayer = document.createElement('div');
    overlayLayer.id = `${EXTENSION_PREFIX}-overlay-layer`;
    overlayLayer.className = `${EXTENSION_PREFIX}-overlay-layer`;
    overlayLayer.setAttribute('aria-hidden', 'false');
    document.body.appendChild(overlayLayer);

    return overlayLayer;
  }

  function showToast(message) {
    let toast = document.getElementById(`${EXTENSION_PREFIX}-toast`);

    if (!toast) {
      toast = document.createElement('div');
      toast.id = `${EXTENSION_PREFIX}-toast`;
      toast.className = `${EXTENSION_PREFIX}-toast`;
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }

    toast.textContent = message;
    toast.classList.remove(`${EXTENSION_PREFIX}-toast--visible`);
    void toast.offsetWidth;
    toast.classList.add(`${EXTENSION_PREFIX}-toast--visible`);

    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast?.classList.remove(`${EXTENSION_PREFIX}-toast--visible`);
    }, 2800);
  }

  function findMenuButton(card) {
    const selectors = [
      '.ytLockupMetadataViewModelMenuButton button',
      '.yt-lockup-metadata-view-model__menu-button button',
      'ytd-menu-renderer tp-yt-paper-icon-button#button',
      'ytd-menu-renderer yt-icon-button#button',
      '#menu tp-yt-paper-icon-button#button',
      '#menu yt-icon-button#button',
      '#menu button[aria-label="More actions"]',
      '#menu button[aria-label="Aktionen"]',
      'button[aria-label="More actions"]',
      'button[aria-label="Aktionen"]',
    ];

    for (const selector of selectors) {
      const element = card.querySelector(selector);
      if (element) return element;
    }

    return null;
  }

  function findThumbnailTarget(card) {
    const selectors = [
      '.ytLockupViewModelContentImage',
      'a#thumbnail',
      'ytd-thumbnail',
      '#thumbnail',
      'yt-thumbnail-view-model',
    ];

    for (const selector of selectors) {
      const element = card.querySelector(selector);
      if (!(element instanceof Element)) continue;

      const rect = element.getBoundingClientRect();
      if (rect.width > 40 && rect.height > 40) return element;
    }

    return card;
  }

  function getCards() {
    const cards = new Set(document.querySelectorAll(CARD_SELECTOR));

    // YouTube is gradually moving more surfaces to view-model lockups. Support
    // those too, but only when there is no traditional renderer around them.
    document.querySelectorAll(LOCKUP_SELECTOR).forEach((lockup) => {
      if (!lockup.closest(CARD_SELECTOR)) cards.add(lockup);
    });

    return cards;
  }

  function getMenuItemText(element) {
    const preferredText = element.querySelector?.(
      [
        '.yt-list-item-view-model__title',
        '.ytListItemViewModelTitle',
        'yt-formatted-string',
        '[role="menuitem"]',
      ].join(',')
    );

    return normalizeText(preferredText?.textContent || element.textContent);
  }

  function getViewModelCandidates(element) {
    return [
      element.data,
      element.data?.listItemViewModel,
      element.__data?.data,
      element.__data?.listItemViewModel,
      element.__data?.viewModel,
      element.__dataHost?.data,
    ].filter(Boolean);
  }

  function getSemanticAction(element) {
    for (const candidate of getViewModelCandidates(element)) {
      const viewModel = candidate.listItemViewModel || candidate;
      const iconName = viewModel?.leadingImage?.sources?.find(
        (source) => source?.clientResource?.imageName
      )?.clientResource?.imageName;

      const command =
        viewModel?.rendererContext?.commandContext?.onTap?.innertubeCommand;

      // Both recommendation controls use YouTube's feedback endpoint. Requiring
      // it avoids confusing generic REMOVE/HIDE menu items with these actions.
      if (!command?.feedbackEndpoint) continue;

      if (iconName === ACTIONS.notInterested.iconName) return 'notInterested';
      if (iconName === ACTIONS.dontRecommend.iconName) return 'dontRecommend';
    }

    return null;
  }

  function menuItemMatchesAction(element, actionKey) {
    const action = ACTIONS[actionKey];
    if (!action) return false;

    if (getSemanticAction(element) === actionKey) return true;

    const text = getMenuItemText(element);
    return action.textMatchers.some((matcher) => matcher.test(text));
  }

  function getVisibleMenuItems() {
    return [...document.querySelectorAll(MENU_ITEM_SELECTOR)].filter(isVisible);
  }

  function findVisibleActionItem(actionKey) {
    return getVisibleMenuItems().find((item) =>
      menuItemMatchesAction(item, actionKey)
    );
  }

  function getClickableMenuTarget(item) {
    return (
      item.querySelector?.(
        [
          '.yt-list-item-view-model__container--tappable',
          '.ytListItemViewModelContainer',
          '[role="menuitem"]',
          'button',
          'a',
        ].join(',')
      ) || item
    );
  }

  function dispatchRealClick(element) {
    if (!(element instanceof Element)) return;

    element.focus?.({ preventScroll: true });

    const pointerOptions = {
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

    const mouseOptions = {
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
      element.dispatchEvent(
        new PointerEvent('pointerup', { ...pointerOptions, buttons: 0 })
      );
      element.dispatchEvent(
        new MouseEvent('mouseup', { ...mouseOptions, buttons: 0 })
      );
      element.dispatchEvent(
        new MouseEvent('click', { ...mouseOptions, buttons: 0 })
      );
    } catch {
      element.click?.();
    }
  }

  function dispatchEscape() {
    const target = document.activeElement || document.body;
    const options = {
      key: 'Escape',
      code: 'Escape',
      keyCode: 27,
      which: 27,
      bubbles: true,
      cancelable: true,
      composed: true,
    };

    target?.dispatchEvent(new KeyboardEvent('keydown', options));
    target?.dispatchEvent(new KeyboardEvent('keyup', options));
  }

  async function waitForActionItem(actionKey, timeout = 2200) {
    const existing = findVisibleActionItem(actionKey);
    if (existing) return existing;

    return new Promise((resolve) => {
      let settled = false;

      const finish = (value) => {
        if (settled) return;
        settled = true;
        observer.disconnect();
        clearTimeout(timeoutId);
        resolve(value);
      };

      const check = () => {
        const item = findVisibleActionItem(actionKey);
        if (item) finish(item);
      };

      const observer = new MutationObserver(check);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'hidden', 'aria-hidden'],
      });

      const timeoutId = setTimeout(() => finish(null), timeout);
      check();
    });
  }

  async function runRecommendationAction(card, actionKey) {
    const action = ACTIONS[actionKey];
    if (!action || actionInProgress || !card?.isConnected) return false;

    actionInProgress = true;

    try {
      // If a context menu is already open, close it first so we never select a
      // stale item from a different video.
      if (getVisibleMenuItems().length) {
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
        showToast(`Could not find “${action.label}” in this YouTube menu.`);
        return false;
      }

      const clickable = getClickableMenuTarget(item);
      dispatchRealClick(clickable);
      return true;
    } finally {
      actionInProgress = false;
    }
  }

  function createActionButton(card, actionKey) {
    const action = ACTIONS[actionKey];
    const button = document.createElement('button');

    button.type = 'button';
    button.className = `${EXTENSION_PREFIX}-action`;
    button.dataset.action = actionKey;
    button.setAttribute('aria-label', action.label);
    button.setAttribute('title', action.label);
    button.appendChild(createIcon(action.iconPath));

    button.addEventListener('pointerdown', stopCardInteraction);
    button.addEventListener('mousedown', stopCardInteraction);
    button.addEventListener('mouseup', stopCardInteraction);

    button.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (button.getAttribute('aria-busy') === 'true') return;

      button.setAttribute('aria-busy', 'true');
      button.disabled = true;

      try {
        await runRecommendationAction(card, actionKey);
      } finally {
        if (button.isConnected) {
          button.removeAttribute('aria-busy');
          button.disabled = false;
        }
      }
    });

    return button;
  }

  function createActionGroup(card) {
    const wrapper = document.createElement('div');
    wrapper.className = `${EXTENSION_PREFIX}-actions`;
    wrapper.setAttribute('data-ytfc-controls', 'true');
    wrapper.setAttribute('aria-label', 'Recommendation controls');

    wrapper.appendChild(createActionButton(card, 'notInterested'));
    wrapper.appendChild(createActionButton(card, 'dontRecommend'));

    return wrapper;
  }

  function positionControlsForCard(card, controls) {
    if (!card?.isConnected || !controls?.isConnected) return;

    const target = findThumbnailTarget(card);
    const rect = target.getBoundingClientRect();

    const outsideViewport =
      rect.width <= 0 ||
      rect.height <= 0 ||
      rect.bottom <= 0 ||
      rect.right <= 0 ||
      rect.top >= window.innerHeight ||
      rect.left >= window.innerWidth;

    if (outsideViewport) {
      controls.hidden = true;
      return;
    }

    controls.hidden = false;
    controls.style.left = `${Math.round(rect.left + 8)}px`;
    controls.style.top = `${Math.round(rect.top + 8)}px`;
  }

  function positionAllControls() {
    positionFrame = null;

    for (const [card, controls] of controlsByCard) {
      if (!card.isConnected || !controls.isConnected) continue;
      positionControlsForCard(card, controls);
    }
  }

  function schedulePosition() {
    if (positionFrame !== null) return;
    positionFrame = requestAnimationFrame(positionAllControls);
  }

  function enhanceCard(card) {
    if (!(card instanceof Element) || !card.isConnected) return;

    const existing = controlsByCard.get(card);
    if (existing?.isConnected) {
      positionControlsForCard(card, existing);
      return;
    }

    // Don't create controls until the card has its own YouTube menu. This also
    // filters out view-models that are not recommendation video cards.
    if (!findMenuButton(card)) return;

    const layer = ensureOverlayLayer();
    const controls = createActionGroup(card);

    layer.appendChild(controls);
    controlsByCard.set(card, controls);
    resizeObserver?.observe(card);
    positionControlsForCard(card, controls);
  }

  function cleanupControls() {
    for (const [card, controls] of controlsByCard) {
      if (card.isConnected && controls.isConnected) continue;

      resizeObserver?.unobserve(card);
      controls.remove();
      controlsByCard.delete(card);
    }
  }

  function scan() {
    scanTimer = null;
    if (navigating || !document.body) return;

    cleanupControls();
    ensureOverlayLayer();
    getCards().forEach(enhanceCard);
    schedulePosition();
  }

  function scheduleScan(delay = 70) {
    if (navigating || scanTimer !== null) return;
    scanTimer = window.setTimeout(scan, delay);
  }

  function removeInjectedControls() {
    for (const [card, controls] of controlsByCard) {
      resizeObserver?.unobserve(card);
      controls.remove();
    }

    controlsByCard.clear();
    overlayLayer?.remove();
    overlayLayer = null;
  }

  function onNavigationStart() {
    navigating = true;

    if (scanTimer !== null) {
      clearTimeout(scanTimer);
      scanTimer = null;
    }

    if (positionFrame !== null) {
      cancelAnimationFrame(positionFrame);
      positionFrame = null;
    }

    removeInjectedControls();
  }

  function onNavigationFinished() {
    navigating = false;
    scheduleScan(0);

    // YouTube can complete the route before every lockup/menu has been stamped.
    setTimeout(() => scheduleScan(0), 250);
    setTimeout(() => scheduleScan(0), 900);
  }

  function observePage() {
    mutationObserver?.disconnect();

    mutationObserver = new MutationObserver((mutations) => {
      if (navigating) return;

      let needsScan = false;

      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          // Inline preview is rendered in YouTube's global #video-preview node,
          // outside the card itself. Our controls live in a separate body-level
          // portal, so that preview can no longer cover or delete them.
          if (mutation.addedNodes.length || mutation.removedNodes.length) {
            needsScan = true;
            break;
          }
        }
      }

      if (needsScan) scheduleScan(50);
      schedulePosition();
    });

    mutationObserver.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }

  function boot() {
    resizeObserver = new ResizeObserver(() => schedulePosition());
    observePage();

    document.addEventListener('yt-navigate-start', onNavigationStart, true);
    document.addEventListener('yt-navigate-finish', onNavigationFinished, true);
    document.addEventListener('yt-page-data-updated', onNavigationFinished, true);
    document.addEventListener(
      'yt-rendererstamper-finished',
      () => scheduleScan(),
      true
    );

    // Capture scroll from YouTube's internal scrolling containers as well as
    // the window. Fixed portal controls are then kept glued to their thumbnail.
    document.addEventListener('scroll', schedulePosition, true);
    window.addEventListener('resize', schedulePosition, { passive: true });
    window.addEventListener('popstate', () => scheduleScan(0), true);
    window.addEventListener('pageshow', () => scheduleScan(0), true);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) scheduleScan(0);
    });

    scheduleScan(0);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
