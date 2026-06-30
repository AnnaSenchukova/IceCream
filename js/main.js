'use strict';

(function () {
  var SLOTS = 3;

  var STATUS = [
    'Выбери 3 шарика',
    'Добавь ещё 2 шарика',
    'Добавь ещё один шарик',
    'Ваше мороженое готово'
  ];

  var listEl = document.querySelector('[data-flavors]');
  var slotsEl = document.querySelector('[data-slots]');
  var priceEl = document.querySelector('[data-builder-price]');
  var statusEl = document.querySelector('[data-status]');
  var buttonEl = document.querySelector('[data-add]');
  var visualEl = document.querySelector('[data-builder-visual]');
  var cartCountEl = document.querySelector('[data-cart-count]');

  if (!listEl || !slotsEl || !buttonEl) return;

  /* Build the flavor lookup by reading the static HTML markup (DOM is the
     single source of truth — prices and names stay visible without JS). */
  var FLAVORS = {};
  var cards = listEl.querySelectorAll('[data-flavor]');
  for (var c = 0; c < cards.length; c++) {
    var card = cards[c];
    var id = card.getAttribute('data-flavor');
    /* Color is defined only in CSS via .card--<flavor> { --card-color }.
       Read the resolved value so markup stays free of color data. */
    var color = window.getComputedStyle(card)
      .getPropertyValue('--card-color').trim();
    FLAVORS[id] = {
      id: id,
      name: card.getAttribute('data-name'),
      price: parseInt(card.getAttribute('data-price'), 10),
      color: color,
      modifier: id
    };
  }

  /* Ghost skeleton: keep a placeholder scoop under every image.
     Reveal the image on load; on error hide it so the ghost stays. */
  function setupScoopImage(img) {
    var card = img.closest('.card');
    function reveal() {
      img.classList.add('card__img--loaded');
      img.classList.remove('card__img--failed');
      if (card) card.classList.remove('card--ghost');
    }
    function fail() {
      img.classList.add('card__img--failed');
      if (card) card.classList.add('card--ghost');
    }
    if (img.complete) {
      if (img.naturalWidth > 0) { reveal(); } else { fail(); }
    } else {
      img.addEventListener('load', reveal);
      img.addEventListener('error', fail);
    }
  }

  var scoopImages = listEl.querySelectorAll('.card__img');
  for (var s = 0; s < scoopImages.length; s++) {
    setupScoopImage(scoopImages[s]);
  }

  var state = { scoops: [], cart: 0 };

  function renderSlots() {
    var nodes = slotsEl.children;
    for (var i = 0; i < SLOTS; i++) {
      var slot = nodes[i];
      if (!slot) continue;
      var scoopId = state.scoops[i];
      slot.innerHTML = '';
      if (scoopId && FLAVORS[scoopId]) {
        var f = FLAVORS[scoopId];
        slot.className = 'builder__slot builder__slot--filled';
        slot.innerHTML =
          '<span class="builder__scoop" style="--scoop-color:' + f.color + '"></span>' +
          '<button class="builder__remove" type="button" aria-label="Удалить шарик: ' + f.name + '" data-remove="' + i + '">' +
            '<svg class="builder__remove-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">' +
              '<path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>' +
            '</svg>' +
          '</button>';
      } else {
        slot.className = 'builder__slot builder__slot--empty';
      }
    }
  }

  function totalPrice() {
    var sum = 0;
    for (var i = 0; i < state.scoops.length; i++) {
      sum += FLAVORS[state.scoops[i]].price;
    }
    return sum;
  }

  function render() {
    renderSlots();
    var count = state.scoops.length;
    priceEl.textContent = totalPrice() + ' ₽';
    statusEl.textContent = STATUS[count];

    if (count === SLOTS) {
      buttonEl.disabled = false;
      buttonEl.textContent = 'Положить в корзину';
      buttonEl.className = 'builder__button builder__button--ready';
    } else {
      buttonEl.disabled = true;
      buttonEl.textContent = 'Собери мороженое';
      buttonEl.className = 'builder__button builder__button--disabled';
    }
  }

  function addScoop(id) {
    if (!FLAVORS[id] || state.scoops.length >= SLOTS) return;
    state.scoops.push(id);
    render();
  }

  function removeScoop(index) {
    state.scoops.splice(index, 1);
    render();
  }

  function checkout() {
    if (state.scoops.length !== SLOTS) return;

    visualEl.classList.add('builder__visual--leaving');

    window.setTimeout(function () {
      state.scoops = [];
      state.cart += 1;
      cartCountEl.textContent = String(state.cart);
      render();

      visualEl.classList.remove('builder__visual--leaving');
      visualEl.classList.add('builder__visual--entering');

      window.requestAnimationFrame(function () {
        window.requestAnimationFrame(function () {
          visualEl.classList.remove('builder__visual--entering');
        });
      });
    }, 360);
  }

  listEl.addEventListener('click', function (e) {
    var card = e.target.closest('[data-flavor]');
    if (card) addScoop(card.getAttribute('data-flavor'));
  });

  slotsEl.addEventListener('click', function (e) {
    var rm = e.target.closest('[data-remove]');
    if (rm) removeScoop(parseInt(rm.getAttribute('data-remove'), 10));
  });

  buttonEl.addEventListener('click', function (e) {
    if (e && e.preventDefault) e.preventDefault();
    checkout();
  });

  /* Mark builder as JS-enhanced — enables interactive styling hooks. */
  var builderEl = document.querySelector('[data-builder]');
  if (builderEl) builderEl.classList.add('builder--ready');

  render();
})();
