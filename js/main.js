'use strict';

(function () {
  var SLOTS = 3;

  var FLAVORS = [
    { id: 'vanilla',    name: 'Ваниль Бурбон', price: 180, color: '#ecdcc0', badge: null,  slug: 'ice-cream-vanilla' },
    { id: 'pistachio',  name: 'Фисташка',      price: 240, color: '#bcc89a', badge: 'HIT', slug: 'ice-cream-pistachio' },
    { id: 'strawberry', name: 'Клубника',      price: 210, color: '#e3a9a4', badge: null,  slug: 'ice-cream-strawberry' },
    { id: 'chocolate',  name: 'Тёмный шоколад', price: 230, color: '#9c6b52', badge: 'NEW', slug: 'ice-cream-chocolate' },
    { id: 'matcha',     name: 'Матча',          price: 250, color: '#a7bf91', badge: null,  slug: 'ice-cream-matcha' },
    { id: 'caramel',    name: 'Солёная карамель', price: 220, color: '#d8a86a', badge: 'HIT', slug: 'ice-cream-caramel' }
  ];

  var STATUS = [
    'Выбери 3 шарика',
    'Добавь ещё 2 шарика',
    'Добавь ещё один шарик',
    'Ваше мороженое готово'
  ];

  var state = { scoops: [], cart: 0 };

  var listEl = document.querySelector('[data-flavors]');
  var slotsEl = document.querySelector('[data-slots]');
  var priceEl = document.querySelector('[data-builder-price]');
  var statusEl = document.querySelector('[data-status]');
  var buttonEl = document.querySelector('[data-add]');
  var visualEl = document.querySelector('[data-builder-visual]');
  var cartCountEl = document.querySelector('[data-cart-count]');

  function flavorById(id) {
    for (var i = 0; i < FLAVORS.length; i++) {
      if (FLAVORS[i].id === id) return FLAVORS[i];
    }
    return null;
  }

  function renderCatalog() {
    var html = '';
    for (var i = 0; i < FLAVORS.length; i++) {
      var f = FLAVORS[i];
      var badge = f.badge
        ? '<span class="card__badge">' + f.badge + '</span>'
        : '';
      html +=
        '<li class="catalog__card card" data-flavor="' + f.id + '">' +
          '<button class="card__button" type="button" aria-label="Добавить шарик: ' + f.name + ', ' + f.price + ' рублей">' +
            '<span class="card__visual" style="--card-color:' + f.color + '">' +
              badge +
              '<span class="card__price">' + f.price + ' ₽</span>' +
            '</span>' +
            '<span class="card__title">' + f.name + '</span>' +
          '</button>' +
        '</li>';
    }
    listEl.innerHTML = html;
  }

  function renderSlots() {
    var nodes = slotsEl.children;
    for (var i = 0; i < SLOTS; i++) {
      var slot = nodes[i];
      var scoopId = state.scoops[i];
      slot.innerHTML = '';
      if (scoopId) {
        var f = flavorById(scoopId);
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
      sum += flavorById(state.scoops[i]).price;
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
    if (state.scoops.length >= SLOTS) return;
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

  buttonEl.addEventListener('click', checkout);

  renderCatalog();
  render();
})();
