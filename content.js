(() => {
  'use strict';

  // ---------------------------
  // Styling helpers
  // ---------------------------
  function createStyledButton({ id, label, position, onClick }) {
    if (id && document.getElementById(id)) return null;

    const btn = document.createElement('button');
    if (id) btn.id = id;
    btn.textContent = label;

    Object.assign(btn.style, {
      position,
      bottom: '24px',
      right: id?.includes('dont') ? '24px' : '84px',
      zIndex: '99999',
      padding: '10px 16px',
      border: 'none',
      borderRadius: '8px',
      backgroundColor: '#1a73e8',
      color: '#fff',
      fontSize: '14px',
      fontWeight: '500',
      boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
      cursor: 'pointer',
      fontFamily: 'Roboto, sans-serif',
      transition: 'background-color 0.2s ease',
    });

    btn.onmouseenter = () => {
      btn.style.backgroundColor = '#1669c1';
    };
    btn.onmouseleave = () => {
      btn.style.backgroundColor = '#1a73e8';
    };
    btn.onclick = onClick;

    document.body.appendChild(btn);
    return btn;
  }

  function createOverlayWrapper() {
    const wrapper = document.createElement('div');
    Object.assign(wrapper.style, {
      position: 'absolute',
      top: '8px',
      right: '8px',
      zIndex: '9999',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      pointerEvents: 'auto',
    });
    return wrapper;
  }

  function createQuickButton(label) {
    const btn = document.createElement('button');
    btn.textContent = label;
    Object.assign(btn.style, {
      padding: '8px 12px',
      border: 'none',
      borderRadius: '6px',
      backgroundColor: '#f1f3f4',
      color: '#202124',
      fontSize: '13px',
      fontWeight: '500',
      boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
      cursor: 'pointer',
      transition: 'background-color 0.2s ease',
      fontFamily: 'Roboto, sans-serif',
    });
    btn.onmouseenter = () => {
      btn.style.backgroundColor = '#e0e0e0';
    };
    btn.onmouseleave = () => {
      btn.style.backgroundColor = '#f1f3f4';
    };
    return btn;
  }

  // ---------------------------
  // YouTube DOM helpers
  // ---------------------------
  function findVideoCards() {
    // Your snippet shows ytd-rich-item-renderer. We'll keep it targeted + add a couple safe fallbacks.
    return document.querySelectorAll(
      [
        'ytd-rich-item-renderer',
        'ytd-rich-grid-media',
        'ytd-video-renderer',
      ].join(',')
    );
  }

  function findMenuButton(card) {
    // Based on your snippet: .yt-lockup-metadata-view-model__menu-button button[aria-label="More actions"]
    return (
      card.querySelector('.yt-lockup-metadata-view-model__menu-button button[aria-label="More actions"]') ||
      card.querySelector('button[aria-label="More actions"]') ||
      // older fallbacks
      card.querySelector('ytd-menu-renderer tp-yt-paper-icon-button#button') ||
      card.querySelector('#menu button')
    );
  }

  function getMenuItems() {
    // New UI in your dropdown snippet
    const vmItems = [
      ...document.querySelectorAll(
        'tp-yt-iron-dropdown yt-list-item-view-model[role="menuitem"]'
      ),
    ];
    if (vmItems.length) return vmItems;

    // Older UI fallback
    return [...document.querySelectorAll('ytd-menu-service-item-renderer')];
  }

  function getMenuItemLabel(el) {
    const title = el.querySelector?.('.yt-list-item-view-model__title');
    if (title?.textContent) return title.textContent.trim();
    return (el.textContent || '').trim();
  }

  function dispatchRealClick(el) {
    // Some of YouTube's handlers don't respond to .click() reliably; this usually does.
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }

  function waitForMenuItems({ timeout = 1500, interval = 50 } = {}) {
    return new Promise((resolve) => {
      const start = Date.now();
      const t = setInterval(() => {
        const items = getMenuItems();
        if (items.length) {
          clearInterval(t);
          resolve(items);
          return;
        }
        if (Date.now() - start > timeout) {
          clearInterval(t);
          resolve([]);
        }
      }, interval);
    });
  }

  async function clickMenuAction(menuBtn, matchTextOrRegex) {
    if (!menuBtn) return false;

    // open menu
    menuBtn.click();

    const items = await waitForMenuItems();
    if (!items.length) return false;

    const matcher =
      matchTextOrRegex instanceof RegExp
        ? (t) => matchTextOrRegex.test(t)
        : (t) => t.toLowerCase().includes(String(matchTextOrRegex).toLowerCase());

    const target = items.find((el) => matcher(getMenuItemLabel(el)));
    if (!target) return false;

    // Click the "tappable" container if present (often the real click target)
    const clickable =
      target.querySelector?.('.yt-list-item-view-model__container--tappable') || target;

    clickable.focus?.();
    dispatchRealClick(clickable);
    return true;
  }

  // ---------------------------
  // Per-card overlay buttons
  // ---------------------------
  function addButtons() {
    findVideoCards().forEach((card) => {
      if (card.hasAttribute('data-buttons-added')) return;

      const menuBtn = findMenuButton(card);
      if (!menuBtn) return;

      const wrapper = createOverlayWrapper();

      // English + German matching (safe even if you're on English)
      const notInterestedRegex = /not interested|nicht interessiert|kein interesse/i;
      const dontRecommendRegex =
        /don't recommend channel|kanal nicht empfehlen|nicht.*kanal.*empfehlen|keine videos von diesem kanal/i;

      const btn1 = createQuickButton('👎');
      btn1.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await clickMenuAction(menuBtn, notInterestedRegex);
      };

      const btn2 = createQuickButton('🚫');
      btn2.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await clickMenuAction(menuBtn, dontRecommendRegex);
      };

      wrapper.appendChild(btn1);
      wrapper.appendChild(btn2);

      const anchor = card.querySelector('#content') || card;
      if (getComputedStyle(anchor).position === 'static') {
        anchor.style.position = 'relative';
      }

      anchor.appendChild(wrapper);
      card.setAttribute('data-buttons-added', 'true');
    });
  }

  // ---------------------------
  // Global action buttons
  // ---------------------------
  function createGlobalActionButton(id, label, matchRegex) {
    createStyledButton({
      id,
      label,
      position: 'fixed',
      onClick: async () => {
        const cards = [...findVideoCards()];

        for (let i = 0; i < cards.length; i++) {
          const card = cards[i];
          const menuBtn = findMenuButton(card);
          if (!menuBtn) continue;

          // slight delay between items to avoid UI race conditions
          // (and to let menus open/close properly)
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 250));

          // eslint-disable-next-line no-await-in-loop
          await clickMenuAction(menuBtn, matchRegex);

          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 250));
        }
      },
    });
  }

  // ---------------------------
  // Boot
  // ---------------------------
  function boot() {
    addButtons();

    // Global buttons
    createGlobalActionButton(
      'yt-tools-notInterested-all',
      '👎',
      /not interested|nicht interessiert|kein interesse/i
    );

    createGlobalActionButton(
      'yt-tools-dontRecommend-all',
      '🚫',
      /don't recommend channel|kanal nicht empfehlen|nicht.*kanal.*empfehlen|keine videos von diesem kanal/i
    );
  }

  const observer = new MutationObserver(boot);
  observer.observe(document.body, { childList: true, subtree: true });

  boot();
})();
