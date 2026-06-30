'use strict';

(function () {
  const SLOTS = 3;

  /* Status text is derived from count + SLOTS, so it never goes out of range
     if SLOTS changes (replaces the fixed-length STATUS array). */
  function statusText(count) {
    if (count >= SLOTS) return 'Ваше мороженое готово';
    if (count === 0) return `Выбери ${SLOTS} шарика`;
    const left = SLOTS - count;
    return left === 1 ? 'Добавь ещё один шарик' : `Добавь ещё ${left} шарика`;
  }

  const TEXT = {
    buttonReady: 'Положить в корзину',
    buttonBuild: 'Собери мороженое',
    currency: ' ₽',
    removeLabel: 'Удалить шарик: '
  };

  const listEl = document.querySelector('[data-flavors]');
  const slotsEl = document.querySelector('[data-slots]');
  const priceEl = document.querySelector('[data-builder-price]');
  const statusEl = document.querySelector('[data-status]');
  const buttonEl = document.querySelector('[data-add]');
  const visualEl = document.querySelector('[data-builder-visual]');
  const cartCountEl = document.querySelector('[data-cart-count]');
  const scoopTemplate = document.querySelector('#tmpl-scoop');

  /* Guard every element the script touches, not just a subset. */
  if (!listEl || !slotsEl || !buttonEl || !priceEl || !statusEl ||
      !visualEl || !cartCountEl || !scoopTemplate) return;

  /* Read the checkout delay from CSS so JS timing and the CSS transition
     stay in sync from a single source of truth. */
  function readCheckoutDelay() {
    const raw = window.getComputedStyle(document.documentElement)
      .getPropertyValue('--builder-checkout-delay').trim();
    if (raw.endsWith('ms')) return parseFloat(raw);
    if (raw.endsWith('s')) return parseFloat(raw) * 1000;
    return 360;
  }
  const CHECKOUT_DELAY = readCheckoutDelay();

  function parsePrice(text) {
    const digits = (text || '').replace(/[^\d]/g, '');
    return digits ? parseInt(digits, 10) : 0;
  }

  /* Shared image-state helper: avoids duplicating the complete/naturalWidth
     logic between card scoops and builder scoops. */
  function onImageState(img, { onReveal, onFail }) {
    const reveal = () => onReveal && onReveal();
    const fail = () => onFail && onFail();
    if (img.complete) {
      if (img.naturalWidth > 0) { reveal(); } else { fail(); }
    } else {
      img.addEventListener('load', reveal, { once: true });
      img.addEventListener('error', fail, { once: true });
    }
  }

  /* Flavor lookup from markup; keep a reference to the real <picture> to clone. */
  const FLAVORS = {};
  for (const card of listEl.querySelectorAll('[data-flavor]')) {
    const id = card.getAttribute('data-flavor');
    const titleEl = card.querySelector('.card__title');
    const cardPriceEl = card.querySelector('.card__price');
    const pictureEl = card.querySelector('.card__media');

    const color = window.getComputedStyle(card)
      .getPropertyValue('--card-color').trim();

    FLAVORS[id] = {
      id,
      name: titleEl ? titleEl.textContent.trim() : id,
      price: cardPriceEl ? parsePrice(cardPriceEl.textContent) : 0,
      color,
      pictureEl: pictureEl || null
    };
  }

  for (const img of listEl.querySelectorAll('.card__img')) {
    onImageState(img, {
      onReveal: () => {
        img.classList.add('card__img--loaded');
        img.classList.remove('card__img--failed');
      },
      onFail: () => img.classList.add('card__img--failed')
    });
  }

  /* Each scoop is { id, uid }; uid identifies it stably regardless of position,
     so removal never depends on a stale index. */
  let nextUid = 0;
  const state = { scoops: [], cart: 0 };
  let isCheckingOut = false;

  function cloneScoopPicture(flavor) {
    if (!flavor.pictureEl) return null;

    const picture = flavor.pictureEl.cloneNode(true);
    picture.classList.remove('card__media');
    picture.classList.add('builder__scoop-media');

    const img = picture.querySelector('img');
    if (img) {
      img.classList.remove('card__img', 'card__img--loaded', 'card__img--failed');
      img.classList.add('builder__scoop-img');
      img.setAttribute('alt', '');
      img.removeAttribute('loading');
      onImageState(img, {
        onReveal: () => img.classList.add('builder__scoop-img--loaded'),
        onFail: () => { picture.style.display = 'none'; }
      });
    }
    return picture;
  }

  function buildScoop(scoop) {
    const flavor = FLAVORS[scoop.id];
    const fragment = scoopTemplate.content.cloneNode(true);
    const scoopEl = fragment.querySelector('.builder__scoop');
    const remove = fragment.querySelector('.builder__remove');

    scoopEl.style.setProperty('--scoop-color', flavor.color);

    const picture = cloneScoopPicture(flavor);
    if (picture) scoopEl.insertBefore(picture, remove);

    remove.setAttribute('aria-label', TEXT.removeLabel + flavor.name);
    remove.setAttribute('data-remove', String(scoop.uid));

    return scoopEl;
  }

  function renderSlots() {
    const nodes = slotsEl.children;
    for (let i = 0; i < SLOTS; i++) {
      const slot = nodes[i];
      if (!slot) continue;
      const scoop = state.scoops[i];
      slot.replaceChildren();
      const filled = Boolean(scoop && FLAVORS[scoop.id]);
      slot.classList.toggle('builder__slot--filled', filled);
      slot.classList.toggle('builder__slot--empty', !filled);
      if (filled) slot.append(buildScoop(scoop));
    }
  }

  function totalPrice() {
    return state.scoops.reduce((sum, s) => sum + (FLAVORS[s.id]?.price || 0), 0);
  }

  function render() {
    renderSlots();
    const count = state.scoops.length;
    priceEl.textContent = totalPrice() + TEXT.currency;
    statusEl.textContent = statusText(count);

    const ready = count === SLOTS;
    buttonEl.disabled = !ready;
    buttonEl.textContent = ready ? TEXT.buttonReady : TEXT.buttonBuild;
    buttonEl.classList.toggle('builder__button--ready', ready);
    buttonEl.classList.toggle('builder__button--disabled', !ready);
  }

  function addScoop(id) {
    if (!FLAVORS[id] || state.scoops.length >= SLOTS) return;
    state.scoops.push({ id, uid: nextUid++ });
    render();
  }

  function removeScoop(uid) {
    state.scoops = state.scoops.filter((s) => s.uid !== uid);
    render();
  }

  function checkout() {
    if (isCheckingOut || state.scoops.length !== SLOTS) return;
    isCheckingOut = true;

    visualEl.classList.add('builder__visual--leaving');

    window.setTimeout(() => {
      state.scoops = [];
      state.cart += 1;
      cartCountEl.textContent = String(state.cart);
      render();

      visualEl.classList.remove('builder__visual--leaving');
      visualEl.classList.add('builder__visual--entering');

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          visualEl.classList.remove('builder__visual--entering');
          isCheckingOut = false;
        });
      });
    }, CHECKOUT_DELAY);
  }

  listEl.addEventListener('click', (e) => {
    const card = e.target.closest('[data-flavor]');
    if (card) addScoop(card.getAttribute('data-flavor'));
  });

  slotsEl.addEventListener('click', (e) => {
    const rm = e.target.closest('[data-remove]');
    if (!rm) return;
    const uid = Number(rm.getAttribute('data-remove'));
    if (Number.isInteger(uid)) removeScoop(uid);
  });

  buttonEl.addEventListener('click', (e) => {
    e.preventDefault();
    checkout();
  });

  const builderEl = document.querySelector('[data-builder]');
  if (builderEl) builderEl.classList.add('builder--ready');

  render();
})();
