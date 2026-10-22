import { ON_PAPER } from '@/theme/semantic';
import { light } from '@/theme/tokens';

// The Google map's photo pins and the place card that grows out of one, written once for both
// maps: the website (GoogleMap.web.tsx) adds this script and style to its page, and the phone
// apps' map page (googleMapPage.ts) carries them inline. It's plain browser JavaScript in a string
// because the phone page is a web page, not React; one copy means the two maps can't drift apart.
//
// What it does:
// - Each pin is a postage stamp: the place's photo inside a perforated edge, its word ("Beach",
//   "Cafe") stamped under it like a postmark, and an ember dot on the exact spot. Our own family with
//   the passport stamp a planned city gets. The stamp grows with the zoom; its word shows at every
//   zoom, unless it would land on another's.
// - A finger on a pin swells it; letting go grows the place's ticket out of it, its tail on the stamp.
// - Tapping the ticket turns it over (in 3D, or a fade with reduced motion) to the place's details.
// - Tapping the map, the pin again or Escape folds the card back into its pin.
// - "Open place" hands the id back to the app (`onOpen`), which opens the place's page.
// Every string from the app goes in as text, never as markup: place names come from a model.
// The map is paper whichever look is on, so the pins take the paper colours.

/** What the card shows. Built from a Place by lib/pinCard.ts. */
export type PinCard = {
  /** The postmark word: what kind of place, in a word ("Cafe", "Beach", "Stay"). */
  kind: string;
  /** When to go, for the ticket's front ("Best at sunset"). */
  best: string;
  area: string;
  /** Time there and price, for the ticket's front ("1 hr 30 min · Free"). */
  meta: string;
  /** Why it's worth going, from the video. */
  line: string;
  /** The back of the card: a few facts, each with its icon. */
  facts: { icon: 'clock' | 'tag' | 'sun' | 'film' | 'pin'; text: string }[];
};

/** A pin as the script takes it. */
export type PinData = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  photo: string | null;
  number?: number;
  been?: boolean;
  card?: PinCard;
};

type Face = [family: string, weight: string];

/** The fonts the pins use, as each page has them: the app's own names on the web, Google Fonts' on phones. */
export type PinFonts = { extraBold: Face; bold: Face; regular: Face; medium: Face; semi: Face };

const font = ([family, weight]: Face, size: number, line: number) =>
  `font: ${weight} ${size}px/${line}px ${family}, -apple-system, system-ui, sans-serif;`;

export function pinCss(f: PinFonts): string {
  const white = light.panel;
  const ink = light.ink;
  return `
.xp-pin { --stamp: 38px; --h: 58px; width: 44px; height: var(--h); display: flex; align-items: flex-end; justify-content: center; cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.xp-pin[data-size="s"] { --stamp: 30px; --h: 50px; }
.xp-pin[data-size="l"] { --stamp: 48px; --h: 68px; }
.xp-body { position: relative; display: flex; flex-direction: column; align-items: center; transform-origin: 50% 100%; transition: transform 260ms cubic-bezier(0.23, 1, 0.32, 1); }
.xp-stamp { position: relative; width: var(--stamp); height: var(--stamp); padding: 4px; box-sizing: border-box; filter: drop-shadow(0 3px 4px rgba(17,17,17,0.26)); transition: width 240ms cubic-bezier(0.23, 1, 0.32, 1), height 240ms cubic-bezier(0.23, 1, 0.32, 1); }
.xp-pin[data-size="l"] .xp-stamp { padding: 5px; }
.xp-stamp::before { content: ''; position: absolute; inset: 0; background: ${white};
  -webkit-mask: radial-gradient(circle 2.4px, transparent 96%, #000 100%) -3.5px -3.5px / 7px 7px, linear-gradient(#000, #000) 3px 3px / calc(100% - 6px) calc(100% - 6px) no-repeat;
  mask: radial-gradient(circle 2.4px, transparent 96%, #000 100%) -3.5px -3.5px / 7px 7px, linear-gradient(#000, #000) 3px 3px / calc(100% - 6px) calc(100% - 6px) no-repeat; }
.xp-photo { position: relative; width: 100%; height: 100%; overflow: hidden; background: ${light.canvasTop}; }
.xp-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.xp-pin.xp-been .xp-photo img { filter: grayscale(1); opacity: 0.6; }
.xp-mark { position: relative; margin-top: -9px; padding: 2px 6px 1px; border: 1.5px solid ${ink}; border-radius: 999px; background: ${white}; color: ${ink}; white-space: nowrap; ${font(f.extraBold, 10, 12)} transition: opacity 160ms ease-out, transform 220ms cubic-bezier(0.23, 1, 0.32, 1); }
.xp-pin[data-size="s"] .xp-mark { margin-top: -7px; padding: 1px 5px 0; ${font(f.extraBold, 9, 11)} }
.xp-dot { width: 7px; height: 7px; margin-top: 3px; border-radius: 50%; background: ${ON_PAPER.accent}; box-shadow: 0 0 0 2px ${white}; }
.xp-num, .xp-tick { position: absolute; top: -6px; height: 20px; border-radius: 10px; border: 2px solid ${white}; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
.xp-num { left: -6px; min-width: 20px; padding: 0 5px; background: ${ink}; color: ${light.ctaInk}; ${font(f.semi, 10, 12)} }
.xp-tick { right: -6px; width: 20px; background: ${ink}; color: ${white}; }
.xp-pin.xp-active .xp-body { transform: scale(1.27); }
.xp-pin.xp-pressed .xp-body { transform: scale(1.14); }
.xp-pin.xp-active.xp-pressed .xp-body { transform: scale(1.38); }
.xp-pin.xp-open .xp-body { transform: scale(0.92); }
.xp-pin.xp-quiet .xp-mark, .xp-pin.xp-open .xp-mark { opacity: 0; transform: scale(0.7); }

.xp-card-wrap { position: relative; transform-origin: 50% 100%; transition: transform 440ms cubic-bezier(0.32, 0.72, 0, 1), opacity 160ms ease-out; cursor: default; }
.xp-card-wrap.xp-enter { transform: scale(0.14); opacity: 0; }
.xp-card-wrap.xp-leave { transform: scale(0.14); opacity: 0; transition: transform 220ms cubic-bezier(0.4, 0, 1, 1), opacity 160ms ease-in 60ms; }
.xp-card { position: relative; width: 248px; height: 300px; perspective: 1000px; filter: drop-shadow(0 12px 22px rgba(17,17,17,0.2)) drop-shadow(0 2px 4px rgba(17,17,17,0.08)); }
.xp-flip { position: relative; width: 100%; height: 100%; transform-style: preserve-3d; transition: transform 600ms cubic-bezier(0.2, 0.9, 0.25, 1); }
.xp-card.xp-flipped .xp-flip { transform: rotateY(180deg); }
.xp-face { position: absolute; inset: 0; display: flex; flex-direction: column; -webkit-backface-visibility: hidden; backface-visibility: hidden; cursor: pointer; }
.xp-back { transform: rotateY(180deg); }
.xp-ticket-top { flex: 1; min-height: 0; overflow: hidden; padding: 10px 10px 0; background: ${white}; border-radius: 20px 20px 0 0; }
.xp-back .xp-ticket-top { padding: 16px 16px 0; }
.xp-tear { position: relative; height: 18px; flex: none; background: radial-gradient(circle 9px at 0 50%, transparent 96%, ${white} 100%) left / 50% 100% no-repeat, radial-gradient(circle 9px at 100% 50%, transparent 96%, ${white} 100%) right / 50% 100% no-repeat; }
.xp-tear::after { content: ''; position: absolute; left: 14px; right: 14px; top: 50%; border-top: 1.5px dashed ${light.lineStrong}; }
.xp-stub { flex: none; display: flex; gap: 8px; align-items: center; padding: 4px 14px 14px; background: ${white}; border-radius: 0 0 20px 20px; }
.xp-reduced .xp-flip, .xp-reduced .xp-card.xp-flipped .xp-flip { transition: none; transform: none; }
.xp-reduced .xp-face { transition: opacity 200ms ease-out; }
.xp-reduced .xp-back { transform: none; opacity: 0; pointer-events: none; }
.xp-reduced .xp-card.xp-flipped .xp-back { opacity: 1; pointer-events: auto; }
.xp-reduced .xp-card.xp-flipped .xp-front { opacity: 0; pointer-events: none; }
.xp-card-wrap.xp-reduced { transition: opacity 180ms ease-out; }
.xp-card-wrap.xp-reduced.xp-enter, .xp-card-wrap.xp-reduced.xp-leave { transform: none; }
.xp-card-tail { position: absolute; left: 50%; width: 18px; height: 10px; margin-left: -9px; filter: drop-shadow(0 4px 3px rgba(17,17,17,0.12)); background: ${white}; clip-path: polygon(0 0, 100% 0, 50% 100%); }
.xp-card-photo { position: relative; height: 126px; border-radius: 12px; overflow: hidden; background: ${light.canvasTop}; }
.xp-card-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
.xp-row { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; padding: 10px 4px 6px; }
.xp-kind { color: ${ON_PAPER.accentText}; ${font(f.semi, 12, 16)} }
.xp-best { color: ${light.inkSoft}; ${font(f.medium, 12, 16)} white-space: nowrap; }
.xp-name { padding: 0 4px; color: ${ink}; ${font(f.extraBold, 16, 20)} letter-spacing: -0.25px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.xp-back .xp-name { padding: 0; }
.xp-area { margin-top: 2px; padding: 0 4px; color: ${light.inkSoft}; ${font(f.medium, 12, 16)} display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.xp-line { margin-top: 10px; color: ${light.inkSoft}; ${font(f.regular, 14, 20)} display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.xp-facts { margin: 10px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
.xp-facts li { display: flex; align-items: center; gap: 8px; color: ${ink}; ${font(f.regular, 14, 20)} }
.xp-facts svg { flex: none; color: ${light.inkSoft}; }
.xp-go, .xp-turn { height: 44px; border: 0; border-radius: 22px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; -webkit-tap-highlight-color: transparent; transition: transform 160ms cubic-bezier(0.23, 1, 0.32, 1); }
.xp-go { flex: 1; background: ${light.cta}; color: ${light.ctaInk}; ${font(f.semi, 14, 20)} }
.xp-turn { width: 44px; flex: none; background: ${ON_PAPER.fill.raised}; color: ${ink}; }
.xp-go:active, .xp-turn:active { transform: scale(0.96); }
.xp-go:focus-visible, .xp-turn:focus-visible { outline: 2px solid ${ink}; outline-offset: 2px; }
`;
}

// The script. ES2017 browser JavaScript; no backticks or dollar-braces inside it.
export const PIN_SCRIPT = `
(function () {
  if (window.XplorePins) return;
  var SVG = 'http://www.w3.org/2000/svg';
  var ICONS = {
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    film: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/>',
    pin: '<path d="M12 21s-7-6.1-7-11.5A7 7 0 0 1 19 9.5C19 14.9 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>',
    turn: '<path d="M3 12a9 9 0 0 1 15.5-6.2L21 8"/><polyline points="21 3 21 8 16 8"/><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16"/><polyline points="3 21 3 16 8 16"/>',
    check: '<polyline points="20 6 9 17 4 12"/>'
  };
  var CARD_H = 300, CARD_W = 248, TAIL = 10;
  // Focus follows the card only for someone on a keyboard; a finger shouldn't leave a focus ring.
  var keys = false;
  document.addEventListener('keydown', function () { keys = true; }, true);
  document.addEventListener('pointerdown', function () { keys = false; }, true);

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function icon(name, size, width) {
    var s = document.createElementNS(SVG, 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size);
    s.setAttribute('height', size);
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', width || 2);
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    s.innerHTML = ICONS[name];
    return s;
  }
  var sizeOf = function (zoom) { return zoom >= 14 ? 'l' : zoom >= 11 ? 'm' : 's'; };
  // Each size's whole pin, stamp to dot: what a card stands on, and what can't overlap.
  var PIN_H = { s: 50, m: 58, l: 68 };
  var pinHeight = function (size) { return PIN_H[size]; };

  function pinElement(p, size) {
    var root = el('div', 'xp-pin' + (p.been ? ' xp-been' : ''));
    root.dataset.size = size;
    var body = el('div', 'xp-body');
    var stamp = el('div', 'xp-stamp');
    var photo = el('div', 'xp-photo');
    if (p.photo) { var img = el('img'); img.alt = ''; img.src = p.photo; img.decoding = 'async'; photo.appendChild(img); }
    stamp.appendChild(photo);
    body.appendChild(stamp);
    if (p.card && p.card.kind) body.appendChild(el('div', 'xp-mark', p.card.kind));
    body.appendChild(el('div', 'xp-dot'));
    if (p.been) { var t = el('div', 'xp-tick'); t.appendChild(icon('check', 10, 3.5)); body.appendChild(t); }
    if (p.number) body.appendChild(el('div', 'xp-num', String(p.number)));
    root.appendChild(body);
    // The swell under a finger. Released, moved off or taken over by a drag, it settles back.
    var up = function () { root.classList.remove('xp-pressed'); };
    root.addEventListener('pointerdown', function () { root.classList.add('xp-pressed'); });
    root.addEventListener('pointerup', up);
    root.addEventListener('pointercancel', up);
    root.addEventListener('pointerleave', up);
    return root;
  }

  function button(cls, label, iconName, text) {
    var b = el('button', cls);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    if (text) b.appendChild(el('span', null, text));
    b.appendChild(icon(iconName, iconName === 'arrow' ? 16 : 18, 2.2));
    return b;
  }

  function cardElement(p, size, reduced, on) {
    var c = p.card;
    var pinH = pinHeight(size);
    var wrap = el('div', 'xp-card-wrap xp-enter' + (reduced ? ' xp-reduced' : ''));
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-label', p.name);
    // The ticket stands on its pin: its tail ends at the top of the stamp.
    wrap.style.paddingBottom = (pinH + TAIL - 2) + 'px';
    wrap.style.transformOrigin = '50% calc(100% - ' + Math.round(pinH / 2) + 'px)';
    var card = el('div', 'xp-card');
    var flip = el('div', 'xp-flip');

    // One of our tickets: the photo, its kind and best time, the name; a torn line; then the stub.
    var front = el('div', 'xp-face xp-front');
    var top = el('div', 'xp-ticket-top');
    var photo = el('div', 'xp-card-photo');
    if (p.photo) { var img = el('img'); img.alt = ''; img.src = p.photo; photo.appendChild(img); }
    top.appendChild(photo);
    var row = el('div', 'xp-row');
    row.appendChild(el('span', 'xp-kind', c.kind));
    if (c.best) row.appendChild(el('span', 'xp-best', c.best));
    top.appendChild(row);
    top.appendChild(el('div', 'xp-name', p.name));
    var where = [c.area, c.meta].filter(Boolean).join(' · ');
    if (where) top.appendChild(el('div', 'xp-area', where));
    front.appendChild(top);
    front.appendChild(el('div', 'xp-tear'));
    var fa = el('div', 'xp-stub');
    var go = button('xp-go', 'Open ' + p.name, 'arrow', 'Open place');
    var more = button('xp-turn', 'More about ' + p.name, 'turn');
    fa.appendChild(go);
    fa.appendChild(more);
    front.appendChild(fa);

    // The back of the ticket: the facts, and why it's worth going.
    var back = el('div', 'xp-face xp-back');
    var btop = el('div', 'xp-ticket-top');
    btop.appendChild(el('div', 'xp-name', p.name));
    var list = el('ul', 'xp-facts');
    (c.facts || []).forEach(function (f) {
      var li = el('li');
      li.appendChild(icon(f.icon, 16, 2));
      li.appendChild(el('span', null, f.text));
      list.appendChild(li);
    });
    btop.appendChild(list);
    if (c.line) btop.appendChild(el('div', 'xp-line', c.line));
    back.appendChild(btop);
    back.appendChild(el('div', 'xp-tear'));
    var ba = el('div', 'xp-stub');
    var go2 = button('xp-go', 'Open ' + p.name, 'arrow', 'Open place');
    var turnBack = button('xp-turn', 'Back to the photo', 'turn');
    ba.appendChild(go2);
    ba.appendChild(turnBack);
    back.appendChild(ba);
    back.setAttribute('aria-hidden', 'true');

    flip.appendChild(front);
    flip.appendChild(back);
    card.appendChild(flip);
    wrap.appendChild(card);
    var tail = el('div', 'xp-card-tail');
    tail.style.top = CARD_H + 'px';
    wrap.appendChild(tail);

    var turn = function () {
      var flipped = card.classList.toggle('xp-flipped');
      front.setAttribute('aria-hidden', flipped ? 'true' : 'false');
      back.setAttribute('aria-hidden', flipped ? 'false' : 'true');
      if (keys) (flipped ? turnBack : more).focus({ preventScroll: true });
    };
    // Its own taps stay its own: the map underneath neither pans nor closes the card.
    ['pointerdown', 'mousedown', 'touchstart', 'dblclick', 'wheel'].forEach(function (t) {
      wrap.addEventListener(t, function (e) { e.stopPropagation(); }, { passive: true });
    });
    wrap.addEventListener('click', function (e) {
      e.stopPropagation();
      on.touched();
      var t = e.target;
      if (t.closest && t.closest('.xp-go')) on.open(p.id);
      else turn();
    });
    return { el: wrap, focus: function () { if (keys) go.focus({ preventScroll: true }); } };
  }

  function create(o) {
    var map = o.map, Marker = o.Marker;
    var opts = { cards: o.cards !== false, reduced: !!o.reduced, padding: o.padding || { top: 0, bottom: 0, left: 0, right: 0 } };
    var markers = {}, data = {}, order = [], focusId = null;
    var size = sizeOf(map.getZoom() || 12);
    var open = null, lastTouch = 0;
    // Only to turn a place into a point on screen, to keep an opened card in view.
    var overlay = new google.maps.OverlayView();
    overlay.onAdd = overlay.draw = overlay.onRemove = function () {};
    overlay.setMap(map);

    function look(p) { return [p.photo, p.number, p.been, p.card ? p.card.kind : ''].join('|'); }

    function resize() {
      var next = sizeOf(map.getZoom() || 12);
      if (next === size) return;
      size = next;
      // The card stands on a pin of one size; zoomed to another, it folds away rather than float.
      close(false);
      Object.keys(markers).forEach(function (id) { markers[id].content.dataset.size = size; });
    }

    // Postmarks that would land on each other: the stop in focus keeps its word, then the rest in
    // order; one that has no room goes quiet (its stamp stays) until a zoom or a pan makes room.
    function declutter() {
      var pr = overlay.getProjection();
      if (!pr) return;
      var stampW = size === 'l' ? 48 : size === 'm' ? 38 : 30;
      var kept = [];
      var ids = order.slice();
      if (focusId && data[focusId]) ids = [focusId].concat(ids.filter(function (id) { return id !== focusId; }));
      ids.forEach(function (id) {
        var m = markers[id], p = data[id];
        if (!m || !p) return;
        var pt = pr.fromLatLngToContainerPixel(new google.maps.LatLng(p.lat, p.lng));
        if (!pt) return;
        var word = p.card && p.card.kind ? p.card.kind.length * 6.4 + 16 : 0;
        var half = Math.max(stampW, word) / 2 + 2;
        var box = { l: pt.x - half, r: pt.x + half, t: pt.y - pinHeight(size), b: pt.y };
        var clash = kept.some(function (k) { return box.l < k.r && box.r > k.l && box.t < k.b && box.b > k.t; });
        m.content.classList.toggle('xp-quiet', clash);
        if (!clash) kept.push(box);
        m.zIndex = stack(id, !clash);
      });
    }

    // In focus on top, then an opened pin, then pins wearing their word, then the quiet ones.
    function stack(id, worded) {
      return id === focusId ? 4 : open && open.id === id ? 3 : worded ? 2 : 1;
    }

    function close(fast) {
      if (!open) return;
      var o2 = open;
      open = null;
      var pm = markers[o2.id];
      if (pm) {
        pm.content.classList.remove('xp-open');
        pm.zIndex = stack(o2.id, !pm.content.classList.contains('xp-quiet'));
      }
      o2.card.el.classList.add('xp-leave');
      setTimeout(function () { o2.marker.map = null; }, fast ? 0 : 240);
    }

    // Slides the map just enough that the card and its pin sit in the part no panel covers.
    function keepInView(p) {
      var pr = overlay.getProjection();
      if (!pr) return;
      var pt = pr.fromLatLngToContainerPixel(new google.maps.LatLng(p.lat, p.lng));
      if (!pt) return;
      var div = map.getDiv(), w = div.clientWidth, h = div.clientHeight, pad = opts.padding;
      var top = pt.y - pinHeight(size) - TAIL - CARD_H;
      var dx = 0, dy = 0;
      if (top < pad.top + 12) dy = top - (pad.top + 12);
      else if (pt.y > h - pad.bottom - 12) dy = pt.y - (h - pad.bottom - 12);
      if (pt.x - CARD_W / 2 < 12) dx = pt.x - CARD_W / 2 - 12;
      else if (pt.x + CARD_W / 2 > w - 12) dx = pt.x + CARD_W / 2 - (w - 12);
      if (dx || dy) map.panBy(dx, dy);
    }

    function show(id) {
      var p = data[id];
      if (!p || !p.card) return;
      close(true);
      var card = cardElement(p, size, opts.reduced, {
        open: function (pid) { o.onOpen(pid); },
        touched: function () { lastTouch = Date.now(); }
      });
      // Clickable, or Google lets taps on the card fall through to the map below.
      var m = new Marker({ map: map, position: { lat: p.lat, lng: p.lng }, content: card.el, zIndex: 1000, gmpClickable: true });
      open = { id: id, marker: m, card: card };
      markers[id].content.classList.add('xp-open');
      markers[id].zIndex = stack(id, true);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { card.el.classList.remove('xp-enter'); });
      });
      keepInView(p);
      setTimeout(card.focus, 60);
    }

    function press(id) {
      lastTouch = Date.now();
      if (!opts.cards || !(data[id] && data[id].card)) { o.onOpen(id); return; }
      if (open && open.id === id) close(false);
      else show(id);
    }

    var listeners = [
      map.addListener('zoom_changed', resize),
      map.addListener('idle', declutter),
      map.addListener('click', function () { if (Date.now() - lastTouch > 350) close(false); })
    ];
    var onKey = function (e) { if (e.key === 'Escape') close(false); };
    document.addEventListener('keydown', onKey);

    return {
      setPins: function (pins, focus) {
        focusId = focus == null ? null : focus;
        order = pins.map(function (p) { return p.id; });
        var seen = {};
        pins.forEach(function (p) {
          seen[p.id] = true;
          data[p.id] = p;
          var m = markers[p.id];
          var now = look(p);
          if (!m) {
            m = markers[p.id] = new Marker({ map: map, gmpClickable: true });
            m.addListener('click', function () { press(p.id); });
          }
          m.position = { lat: p.lat, lng: p.lng };
          m.title = p.number ? 'Stop ' + p.number + ', ' + p.name : p.name;
          if (m.look !== now) {
            m.content = pinElement(p, size);
            m.look = now;
          }
          var active = p.id === focusId;
          m.content.classList.toggle('xp-active', active);
          m.content.classList.toggle('xp-open', !!open && open.id === p.id);
          m.zIndex = stack(p.id, !m.content.classList.contains('xp-quiet'));
        });
        Object.keys(markers).forEach(function (id) {
          if (seen[id]) return;
          if (open && open.id === id) close(true);
          markers[id].map = null;
          delete markers[id];
          delete data[id];
        });
        declutter();
      },
      setOptions: function (next) {
        if (next.padding) opts.padding = next.padding;
        if (next.cards != null) { opts.cards = next.cards; if (!opts.cards) close(true); }
        if (next.reduced != null) opts.reduced = next.reduced;
      },
      close: function () { close(false); },
      destroy: function () {
        close(true);
        listeners.forEach(function (l) { l.remove(); });
        document.removeEventListener('keydown', onKey);
        overlay.setMap(null);
        Object.keys(markers).forEach(function (id) { markers[id].map = null; });
        markers = {};
      }
    };
  }

  window.XplorePins = { create: create };
})();
`;
