'use strict';

(function () {
  const SLOTS = 3;

  const TEXT = {
    buttonReady: 'Положить в корзину',
    buttonBuild: 'Собери мороженое',
    currency: ' ₽',
    removeLabel: 'Удалить шарик: '
  };

  /* Russian plural for "шарик" so the hint stays correct for any count/SLOTS. */
  function scoopWord(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return 'шарик';
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'шарика';
    return 'шариков';
  }

  /* The button label carries the progressive hint:
     0 -> "Собери мороженое", then "Добавь ещё N шарик(а/ов)",
     full -> ready action label. Derived from count + SLOTS, never out of range. */
  function buttonLabel(count) {
    if (count >= SLOTS) return TEXT.buttonReady;
    if (count === 0) return TEXT.buttonBuild;
    const left = SLOTS - count;
    return `Добавь ещё ${left} ${scoopWord(left)}`;
  }

  const listEl = document.querySelector('[data-flavors]');
  const slotsEl = document.querySelector('[data-slots]');
  const priceEl = document.querySelector('[data-builder-price]');
  const statusEl = document.querySelector('[data-status]');
  const buttonEl = document.querySelector('[data-add]');
  const visualEl = document.querySelector('[data-builder-visual]');
  const cartCountEl = document.querySelector('[data-cart-count]');
  const scoopTemplate = document.querySelector('#tmpl-scoop');

  /* Guard every element the script touches, not just a subset. */
  if (!listEl || !slotsEl || !buttonEl || !priceEl ||
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
  const state = { scoops: new Array(SLOTS).fill(null), cart: 0 };
  let hasInteracted = false;
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

  /* Slots are numbered 1, 2, 3 in the CSS (bottom-right, bottom-left, top),
     but those are DOM children 2, 1, 0. FILL_ORDER maps the Nth added scoop
     to the DOM slot that carries the matching number, so scoops fill in the
     order the user sees: 1 -> 2 -> 3. */
  const FILL_ORDER = [];
  for (let i = 0; i < SLOTS; i++) FILL_ORDER.push(SLOTS - 1 - i);

  function renderSlots() {
    const nodes = slotsEl.children;
    for (let i = 0; i < SLOTS; i++) {
      const slot = nodes[i];
      if (!slot) continue;
      /* DOM slot i holds the scoop whose ORDER index maps to it via FILL_ORDER.
         state.scoops is position-stable: a removed scoop leaves a null hole, so
         the remaining scoops never jump to another slot. */
      const scoopIndex = FILL_ORDER.indexOf(i);
      const scoop = state.scoops[scoopIndex];
      slot.replaceChildren();
      const filled = Boolean(scoop && FLAVORS[scoop.id]);
      slot.classList.toggle('builder__slot--filled', filled);
      slot.classList.toggle('builder__slot--empty', !filled);
      if (filled) {
        slot.append(buildScoop(scoop));
      }
    }
  }

  /* Number of scoops actually placed (ignores the null holes). */
  function scoopCount() {
    return state.scoops.reduce((n, s) => n + (s ? 1 : 0), 0);
  }

  function totalPrice() {
    return state.scoops.reduce((sum, s) => sum + (s ? (FLAVORS[s.id]?.price || 0) : 0), 0);
  }

  function render() {
    renderSlots();
    const count = scoopCount();
    priceEl.textContent = totalPrice() + TEXT.currency;

    const ready = count >= SLOTS;
    const label = buttonLabel(count);

    /* The button itself carries the progressive hint now. Keep the (visually
       hidden on mobile) status text in sync for screen readers. */
    if (statusEl) statusEl.textContent = label;

    buttonEl.disabled = !ready;
    buttonEl.textContent = label;
    buttonEl.classList.toggle('builder__button--ready', ready);
    buttonEl.classList.toggle('builder__button--disabled', !ready);
  }

  function addScoop(id) {
    if (!FLAVORS[id]) return;
    const free = state.scoops.indexOf(null);
    if (free === -1) return; /* all slots taken */
    state.scoops[free] = { id, uid: nextUid++ };
    hasInteracted = true;
    render();
  }

  function removeScoop(uid) {
    const idx = state.scoops.findIndex((s) => s && s.uid === uid);
    if (idx === -1) return;
    state.scoops[idx] = null;
    hasInteracted = true;
    render();
  }

  function checkout() {
    if (isCheckingOut || scoopCount() !== SLOTS) return;
    isCheckingOut = true;

    visualEl.classList.add('builder__visual--leaving');

    window.setTimeout(() => {
      state.scoops = new Array(SLOTS).fill(null);
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
