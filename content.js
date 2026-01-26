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
    transition: 'background-color 0.2s ease'
  });

  btn.onmouseenter = () => { btn.style.backgroundColor = '#1669c1'; };
  btn.onmouseleave = () => { btn.style.backgroundColor = '#1a73e8'; };
  btn.onclick = onClick;

  document.body.appendChild(btn);
  return btn;
}

function addButtons() {
  document.querySelectorAll('ytd-rich-item-renderer:not([data-buttons-added])')
    .forEach(thumbnail => {
      const menuButton = thumbnail.querySelector('#menu button');
      if (!menuButton) return;

      const wrapper = document.createElement('div');
      Object.assign(wrapper.style, {
        position: 'absolute',
        top: '8px',
        right: '8px',
        zIndex: '9999',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px'
      });

      function quickButton(label, actionText) {
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
          fontFamily: 'Roboto, sans-serif'
        });
        btn.onmouseenter = () => { btn.style.backgroundColor = '#e0e0e0'; };
        btn.onmouseleave = () => { btn.style.backgroundColor = '#f1f3f4'; };

        btn.onclick = () => {
          menuButton.click();
          setTimeout(() => {
            const match = [...document.querySelectorAll('ytd-menu-service-item-renderer')]
              .find(el => el.innerText.includes(actionText));
            match?.click();
          }, 100);
        };

        return btn;
      }

      wrapper.appendChild(quickButton('👎', 'Not interested'));
      wrapper.appendChild(quickButton('🚫', "Don't recommend channel"));
      thumbnail.style.position = 'relative';
      thumbnail.appendChild(wrapper);
      thumbnail.setAttribute('data-buttons-added', 'true');
    });
}

function createGlobalActionButton(id, label, matchText) {
  createStyledButton({
    id,
    label,
    position: 'fixed',
    onClick: () => {
      const thumbs = [...document.querySelectorAll('ytd-rich-item-renderer')];
      thumbs.forEach((thumb, i) => {
        const menuBtn = thumb.querySelector('#menu button');
        if (!menuBtn) return;

        setTimeout(() => {
          menuBtn.click();
          setTimeout(() => {
            const item = [...document.querySelectorAll('ytd-menu-service-item-renderer')]
              .find(el => el.innerText.includes(matchText));
            item?.click();
          }, 150);
        }, i * 300);
      });
    }
  });
}

const observer = new MutationObserver(() => {
  addButtons();
  createGlobalActionButton('yt-tools-notInterested-all', '👎', 'Not interested');
  createGlobalActionButton('yt-tools-dontRecommend-all', '🚫', "Don't recommend channel");
});

observer.observe(document.body, { childList: true, subtree: true });
