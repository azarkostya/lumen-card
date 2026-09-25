// Lumen Card for Lampa v0.2.0

/* ---- 00_head.js ---- */
/*!
 * Lumen Card — плагин карточки фильма/сериала для Lampa. Строгий ES5.
 */
(function () {
'use strict';
if (typeof window !== 'undefined' && window.lumen_card_plugin) return;
if (typeof window !== 'undefined') window.lumen_card_plugin = true;

var LC = {};
if (typeof window !== 'undefined') window.lumen_card = LC;
LC.VERSION = '0.2.0';









LC.MANIFEST_URL = 'https://azarkostya.github.io/lumen-card/manifest.json';

var PLUGIN = 'lumen_card';


function warn(msg, err) {
try { if (typeof window !== 'undefined' && window.console && console.log) console.log('[lumen-card] ' + msg, err || ''); } catch (e) { }
}










var covered = false;
LC.covered = function () { return covered; };
LC.setCovered = function (value) { covered = !!value; };


/* ---- 10_util.js ---- */









LC.util = (function () {
function esc(str) {
if (str === null || typeof str === 'undefined') return '';
return String(str)
.replace(/&/g, '&amp;')
.replace(/</g, '&lt;')
.replace(/>/g, '&gt;')
.replace(/"/g, '&quot;')
.replace(/'/g, '&#39;');
}

function pad2(n) {
n = Math.floor(n);
return n < 10 ? '0' + n : '' + n;
}


function plural(n, forms) {
n = Math.abs(n) % 100;
var tail = n % 10;
if (n > 10 && n < 20) return forms[2];
if (tail > 1 && tail < 5) return forms[1];
if (tail === 1) return forms[0];
return forms[2];
}


function initials(name) {
var clean = ('' + (name || '')).replace(/[^\S]+/g, ' ');
clean = clean.replace(/^\s+|\s+$/g, '');
if (!clean) return '?';
var parts = clean.split(' ');
var out = '';
for (var i = 0; i < parts.length && out.length < 2; i++) {
if (parts[i]) out += parts[i].charAt(0).toUpperCase();
}
return out || '?';
}


function fmtTime(sec) {
sec = Math.max(0, Math.round(Number(sec) || 0));
var h = Math.floor(sec / 3600);
var m = Math.floor((sec % 3600) / 60);
var s = sec % 60;
if (h > 0) return pad2(h) + ':' + pad2(m);
return pad2(m) + ':' + pad2(s);
}



function fmtRuntime(minutes, unit) {
minutes = Math.max(0, Math.round(Number(minutes) || 0));
if (!minutes) return '';
var h = Math.floor(minutes / 60);
var m = minutes % 60;
if (h > 0) return h + ':' + pad2(m);
return m + ' ' + unit;
}







function daysUntil(ymd, now) {
var m = /^(\d{4})-(\d{2})-(\d{2})/.exec('' + (ymd || ''));
if (!m) return null;
var month = parseInt(m[2], 10);
var day = parseInt(m[3], 10);
if (month < 1 || month > 12 || day < 1 || day > 31) return null;
var d = now instanceof Date ? now : new Date(typeof now === 'number' ? now : Date.now());
var today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
var target = Date.UTC(parseInt(m[1], 10), month - 1, day);
return Math.round((target - today) / 86400000);
}























var FIT = 0.85;




function dprCapped() {
var dpr = 1;
try {
dpr = Number(window.devicePixelRatio) || 1;
} catch (e) {
dpr = 1;
}
if (!(dpr > 0)) dpr = 1;
return dpr > 2 ? 2 : dpr;
}












function screenPx() {
var w = 0;
try {
w = Number(window.innerWidth) || 0;
} catch (e) { }
return Math.round(w * dprCapped());
}




var LAMPA_SIZES = { normal: 1, small: 0.9, bigger: 1.05 };














function lampaSize() {
try {
if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') {
var size = Lampa.Storage.field('interface_size');
if (LAMPA_SIZES[size]) return size;
}
} catch (e) { }
return 'normal';
}

function lampaSizeK() {
return LAMPA_SIZES[lampaSize()];
}
















var LAMPA_CARD_SIZES = { bigger: 1.14 };

function lampaCardK() {
return LAMPA_CARD_SIZES[lampaSize()] || 1;
}













function baseEm() {
var w = 0;
try {
w = Number(window.innerWidth) || 0;
} catch (e) { }
var px = w / 84.17 * lampaSizeK();
return px > 10.6 ? px : 10.6;
}





function uiScale() {
try {
if (typeof LC.uiScale === 'function') return Number(LC.uiScale()) || 1;
} catch (e) { }
return 1;
}








function emPx(em, scale) {
var s = typeof scale === 'number' ? scale : uiScale();
if (!(s > 0)) s = 1;
return Math.round(baseEm() * (Number(em) || 0) * s * dprCapped());
}
















function emScreen() {
var w = 0;
try {
w = Number(window.innerWidth) || 0;
} catch (e) { }
var one = baseEm() * uiScale();
return one > 0 ? w / one : 0;
}












function screenBaseEm() {
var w = 0;
try {
w = Number(window.innerWidth) || 0;
} catch (e) { }
return w > 0 ? w / baseEm() : 84.17 / lampaSizeK();
}









function vhPx(vh) {
var h = 0;
try {
h = Number(window.innerHeight) || 0;
} catch (e) { }
return Math.round(h * (Number(vh) || 0) / 100 * dprCapped());
}





var POSTERS = [185, 342, 500, 780];










































var FIT_POSTER = 0.9;



function posterSize(px) {
var need = (Number(px) || 0) * FIT_POSTER;
for (var i = 0; i < POSTERS.length; i++) {
if (POSTERS[i] >= need) return 'w' + POSTERS[i];
}
return 'w' + POSTERS[POSTERS.length - 1];
}













function frameSize(px) {
return (Number(px) || 0) * FIT > 1920 ? 'original' : 'w1280';
}












function scrimSize(px) {
return (Number(px) || 0) * FIT > 780 ? 'w1280' : 'w780';
}

function each(arr, fn) {
if (!arr) return;
for (var i = 0; i < arr.length; i++) fn(arr[i], i);
}

function map(arr, fn) {
var out = [];
if (!arr) return out;
for (var i = 0; i < arr.length; i++) out.push(fn(arr[i], i));
return out;
}

function filter(arr, fn) {
var out = [];
if (!arr) return out;
for (var i = 0; i < arr.length; i++) {
if (fn(arr[i], i)) out.push(arr[i]);
}
return out;
}

function find(arr, fn) {
if (!arr) return null;
for (var i = 0; i < arr.length; i++) {
if (fn(arr[i], i)) return arr[i];
}
return null;
}






















function gate(total, timeout, finish) {
var left = total;
var closed = false;
var timer = null;

function close(partial) {
if (closed) return;
closed = true;
if (timer !== null) { clearTimeout(timer); timer = null; }
finish(partial);
}

if (total > 0 && timeout > 0) {
timer = setTimeout(function () { close(true); }, timeout);
}
if (total <= 0) close(false);

return {
tick: function () {
if (closed) return;
left--;
if (left <= 0) close(false);
},
cancel: function () {
if (closed) return false;
closed = true;
if (timer !== null) { clearTimeout(timer); timer = null; }
return true;
}
};
}



































var ON_SCREEN = 'activity--active';

function activityOnScreen(activity) {
if (!activity) return true;
if (typeof activity.length === 'number') {
if (!activity.length) return true;
return !!activity.hasClass(ON_SCREEN);
}
return !activity.classList || !!activity.classList.contains(ON_SCREEN);
}

function onScreen(node) {
try {
return activityOnScreen(node.closest('.activity'));
} catch (e) {
return true;
}
}








function playerOpen() {
try {
return !!(window.Lampa && Lampa.Player && typeof Lampa.Player.opened === 'function' && Lampa.Player.opened());
} catch (e) {
return false;
}
}

























var OVERLAY_CLASSES = ['settings--open', 'selectbox--open', 'search--open'];
var OVERLAY_NODES = ['.modal', '.youtube-player'];

function overlays() {
var out = [];
var i;
try {
var list = document.body && document.body.classList;
for (i = 0; list && i < OVERLAY_CLASSES.length; i++) {
if (list.contains(OVERLAY_CLASSES[i])) out.push(OVERLAY_CLASSES[i]);
}
if (typeof document.querySelector !== 'function') return out;
for (i = 0; i < OVERLAY_NODES.length; i++) {
if (document.querySelector(OVERLAY_NODES[i])) out.push(OVERLAY_NODES[i]);
}
} catch (e) {
return [];
}
return out;
}

function overlayOpen() {
return overlays().length > 0;
}

return {
ON_SCREEN_SEL: '.' + ON_SCREEN,
onScreen: onScreen,
playerOpen: playerOpen,
overlays: overlays,
overlayOpen: overlayOpen,
activityOnScreen: activityOnScreen,
esc: esc,
pad2: pad2,
plural: plural,
initials: initials,
fmtTime: fmtTime,
fmtRuntime: fmtRuntime,
daysUntil: daysUntil,
screenPx: screenPx,
lampaSizeK: lampaSizeK,
lampaCardK: lampaCardK,
baseEm: baseEm,
emPx: emPx,
emScreen: emScreen,
screenBaseEm: screenBaseEm,
vhPx: vhPx,
posterSize: posterSize,
frameSize: frameSize,
scrimSize: scrimSize,
each: each,
map: map,
filter: filter,
find: find,
gate: gate
};
})();





if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.util;


/* ---- 11_focus.js ---- */


























































LC.focus = (function () {
var EVENTS = ['hover:focus', 'hover:hover'];

function on(node, handler) {
if (!node || typeof node.on !== 'function') return node;
for (var i = 0; i < EVENTS.length; i++) node.on(EVENTS[i], handler);
return node;
}

function capture(el, handler) {
if (!el || typeof el.addEventListener !== 'function') return false;
for (var i = 0; i < EVENTS.length; i++) el.addEventListener(EVENTS[i], handler, true);
return true;
}

function release(el, handler) {
if (!el || typeof el.removeEventListener !== 'function') return false;
for (var i = 0; i < EVENTS.length; i++) el.removeEventListener(EVENTS[i], handler, true);
return true;
}






function remote(e) {
return !!(e && e.type === EVENTS[0]);
}

return {
EVENTS: EVENTS,
on: on,
capture: capture,
release: release,
remote: remote
};
})();





if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.focus;


/* ---- 20_icons.js ---- */








LC.icons = (function () {
var P = {

play:     '<path d="M8 5l11 7-11 7V5z"/>',
trailer:  '<path d="M3 7.5h18v11.5H3z"/><path d="M3 7.5L6.5 3h11L14 7.5"/><path d="M10 11.5l4.5 2.5-4.5 2.5v-5z"/>',
bookmark: '<path d="M7 3h10v18l-5-4-5 4V3z"/>',
torrent:  '<path d="M12 3v11"/><path d="M7.5 9.5L12 14l4.5-4.5"/><path d="M4 19h16"/>',
reaction: '<path d="M7 10.5V20H4v-9.5h3z"/><path d="M7 10.5l4-6.5a2 2 0 013 2.4l-.8 4.1h5a2 2 0 011.95 2.45l-1.3 5.6A2 2 0 0116.9 20H7"/>',
bell:     '<path d="M18 16v-5a6 6 0 10-12 0v5l-2 3h16l-2-3z"/><path d="M10 22h4"/>',
more:     '<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',
list:     '<path d="M9 6h11M9 12h11M9 18h7"/><circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
comment:  '<path d="M21 15a3 3 0 01-3 3H8l-5 4V6a3 3 0 013-3h12a3 3 0 013 3v9z"/>',
star:     '<path d="M12 4l2.4 5 5.6.8-4 4 1 5.6-5-2.8-5 2.8 1-5.6-4-4 5.6-.8L12 4z"/>',
clock:    '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 2"/>',
film:     '<path d="M3 4.5h18v15H3z"/><path d="M7.5 4.5v15M16.5 4.5v15M3 12h18"/>',
chevronR: '<path d="M9 6l6 6-6 6"/>',
close:    '<path d="M6 6l12 12M18 6L6 18"/>',


stop:     '<path d="M6 6h4v12H6zM14 6h4v12h-4z"/>',
mute:     '<path d="M4 9v6h3.5L13 19V5L7.5 9H4z"/><path d="M20 7.5L16 16.5"/>',

search:   '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
check:    '<path d="M4.5 12.5l5 5L20 6.5"/>'
};
var byButton = { 'button--play': 'play', 'button--book': 'bookmark', 'button--reaction': 'reaction', 'button--subscribe': 'bell', 'button--options': 'more', 'view--torrent': 'torrent', 'view--trailer': 'trailer' };
function get(name) {
var paint = (name === 'play' || name === 'more') ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
return '<svg viewBox="0 0 24 24" width="1em" height="1em" class="lumen-ico lumen-ico--' + name + '" ' + paint + '>' + P[name] + '</svg>';
}
function names() { var r = []; for (var k in P) if (P.hasOwnProperty(k)) r.push(k); return r; }
function forButton(cls) { return byButton[cls] || null; }

function maskSvg(name) {
var paint = (name === 'play' || name === 'more') ? 'fill="#000"' : 'fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ' + paint + '>' + P[name].replace(/currentColor/g, '#000') + '</svg>';
}
function maskUrl(name) {
return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(maskSvg(name)) + '")';
}





var NO_MASK = '@supports not ((-webkit-mask-image:none) or (mask-image:none))';



function css() {
var rules = [], fallback = [], sel, k, name;
var map = {};
for (k in byButton) if (byButton.hasOwnProperty(k)) map['.' + k] = byButton[k];
map['[class*="view--online"]'] = 'play';
for (sel in map) {
if (!map.hasOwnProperty(sel)) continue;
name = map[sel];
var btn = '.lumen-card .full-start__button' + sel;
rules.push(btn + ' > svg{display:none !important}');
rules.push(btn + ':before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.625em;height:1.625em;background-color:currentColor;-webkit-mask-image:' + maskUrl(name) + ';mask-image:' + maskUrl(name) + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');





fallback.push(btn + ' > svg{display:block !important}');
fallback.push(btn + ':before{display:none !important}');
}




rules.push(NO_MASK + '{' + fallback.join('') + '}');
return rules.join('\n');
}
return { get: get, names: names, forButton: forButton, maskSvg: maskSvg, maskUrl: maskUrl, css: css, NO_MASK: NO_MASK };
})();





if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.icons;


/* ---- 30_css.js ---- */




var STYLE_ID = 'lumen-card-css';
var FONTS_ID = 'lumen-card-fonts';

var C = {
bg: '#0B0908',
panel: '#1C1613',
spice: '#D9622B',
text: '#F3EDE4',
muted: '#A89A8A',









soft: '#DCD3C8',
smoke: '#7A6A5A',
good: '#8FBF7A',




goodDeep: '#5A764C',
dark: '#1A120A',




line: '#2C231D',


panelHi: '#221A13',
panelLo: '#17120F',
raised: '#241C17'
};

























var ACCENTS = {
sand: { color: '#E8B87A', light: '#FFF2DC', glow: 'rgba(232,184,122,0.35)', onac: '#1A120A' },
copper: { color: '#D0925F', light: '#FBE7D4', glow: 'rgba(208,146,95,0.35)', onac: '#1A0E06' },
wine: { color: '#C46A8F', light: '#FBEAF1', glow: 'rgba(196,106,143,0.35)', onac: '#1C0A12' },
garnet: { color: '#E08592', light: '#FBE6EA', glow: 'rgba(224,133,146,0.35)', onac: '#1A070B' },
mint: { color: '#9FCF8A', light: '#EEFBE7', glow: 'rgba(159,207,138,0.35)', onac: '#0C1608' },
emerald: { color: '#7ACCA0', light: '#E4FBEE', glow: 'rgba(122,204,160,0.35)', onac: '#06170F' },
ice: { color: '#7FB7C9', light: '#E9F7FB', glow: 'rgba(127,183,201,0.35)', onac: '#08171C' },
lavender: { color: '#B3A3E8', light: '#EFEAFB', glow: 'rgba(179,163,232,0.35)', onac: '#130E22' },
graphite: { color: '#BDB8B2', light: '#EFEDEA', glow: 'rgba(189,184,178,0.30)', onac: '#131211' }
};



function hexToRgb(hex) {
hex = ('' + hex).replace('#', '');
var r = parseInt(hex.substring(0, 2), 16);
var g = parseInt(hex.substring(2, 4), 16);
var b = parseInt(hex.substring(4, 6), 16);
return r + ',' + g + ',' + b;
}



var SPICE_RGB = hexToRgb(C.spice);













var THEMES = {
warm: {
bg: C.bg, panel: C.panel, line: C.line, dark: C.dark,
text: C.text, muted: C.muted, soft: C.soft, smoke: C.smoke,
panelHi: C.panelHi, panelLo: C.panelLo, raised: C.raised,
gradPoster: 'linear-gradient(180deg,#1C1613,#0E0B09)',
gradPanel: 'linear-gradient(180deg,#1C1613,#120E0B)',
gradHint: 'linear-gradient(180deg,#120E0B,#0B0908)',
gradSlate: 'linear-gradient(180deg,#0C0D0F,#161825)',
gradWatching: 'linear-gradient(180deg,#171310,#221A13)',
gradBlur: 'linear-gradient(160deg,#2A1B10 0%,#1A110B 38%,#0B0908 72%)'
},
black: {
bg: '#000000', panel: '#101012', line: '#26262B', dark: '#08080A',

text: '#F2F2F3', muted: '#A7A6A8', soft: '#D5D4D6', smoke: '#7B7A7D',
panelHi: '#17171A', panelLo: '#0A0A0C', raised: '#1D1D21',
gradPoster: 'linear-gradient(180deg,#101012,#08080A)',
gradPanel: 'linear-gradient(180deg,#101012,#08080A)',
gradHint: 'linear-gradient(180deg,#0E0E10,#000000)',
gradSlate: 'linear-gradient(180deg,#0A0A0C,#151519)',
gradWatching: 'linear-gradient(180deg,#121216,#1C1C21)',
gradBlur: 'linear-gradient(160deg,#17171B 0%,#0B0B0D 38%,#000000 72%)'
}
};











function palette() {
var base = THEMES[LC.pref('lumen_theme', 'warm')] || THEMES.warm;
var solid = LC.pref('lumen_solid', false);
var p = {};
for (var k in base) {
if (Object.prototype.hasOwnProperty.call(base, k)) p[k] = base[k];
}


p.good = C.good;
p.goodDeep = C.goodDeep;
p.spice = C.spice;













try {
if (LC.accent && typeof LC.accent.tint === 'function') {
var tinted = LC.accent.tint(p.bg, p.muted, 4.5);
if (tinted) p.bg = tinted;
}
} catch (eTint) {
warn('bg tint failed', eTint);
}
p.bgRgb = hexToRgb(p.bg);





p.shadeRgb = shadeRgb(p.bg);
p.textRgb = hexToRgb(p.text);
p.panelRgb = hexToRgb(p.panel);












p.chipBg = solid ? p.panel : 'rgba(' + p.textRgb + ',.12)';
p.buttonBg = solid ? p.panelHi : 'rgba(' + p.textRgb + ',.12)';



p.plate = solid ? p.bg : 'rgba(' + p.bgRgb + ',.85)';











p.glass = solid ? p.bg : 'rgba(' + p.bgRgb + ',.9)';
return p;
}





























function accentRules(P, t) {


var key = heroSizeKey();
return {
main: '.lumen-main{background-color:' + P.bg + '}',






screen: '.lumen-screen{background-color:' + P.bg + '}',
















scrim: '.lumen-hero-stage .lumen-hero__scrim{background:-webkit-linear-gradient(top,' + scrimTop(P) + '),-webkit-linear-gradient(bottom,' + scrimBottom(P, key) + ');' +
'background:linear-gradient(180deg,' + scrimTop(P) + '),linear-gradient(0deg,' + scrimBottom(P, key) + ')}',



scrimL: '.lumen-hero-stage .lumen-hero__scrim.lumen-hero__scrim--l{background:-webkit-radial-gradient(0 ' + scrimLeftY(key) + '%,' + SCRIM_L_RX + '% ' + SCRIM_L_RY + '%,' + scrimLeft(P) + ');' +
'background:radial-gradient(' + SCRIM_L_RX + '% ' + SCRIM_L_RY + '% at 0 ' + scrimLeftY(key) + '%,' + scrimLeft(P) + ')}',



floor: '.lumen-hero-stage .lumen-hero__floor{background:-webkit-linear-gradient(top,' + scrimFloor(P) + ');background:linear-gradient(180deg,' + scrimFloor(P) + ')}',






fadeTop: '.lumen-main .scroll.layer--wheight:after{background:-webkit-linear-gradient(top,' + P.bg + ' 0,' + P.bg + ' 2em,rgba(' + P.bgRgb + ',0) 2.5em);background:linear-gradient(to bottom,' + P.bg + ' 0,' + P.bg + ' 2em,rgba(' + P.bgRgb + ',0) 2.5em)}',
fadeBot: '.lumen-main:after{background:-webkit-linear-gradient(bottom,' + P.bg + ' 0,rgba(' + P.bgRgb + ',0) 100%);background:linear-gradient(0deg,' + P.bg + ' 0,rgba(' + P.bgRgb + ',0) 100%)}',





















cardFocus: '.lumen-main .card.focus .card__view{-webkit-box-shadow:0 .2em 0 ' + t.glow + ';box-shadow:0 .2em 0 ' + t.glow + '}'
};
}








LC.accentCss = function () {
var R = accentRules(palette(), theme());
return R.main + '\n' + R.screen + '\n' + R.scrim + '\n' + R.scrimL + '\n' + R.floor + '\n' + R.fadeTop + '\n' + R.fadeBot;
};



















LC.accentFocusCss = function () {




if (LC.accentScope() === 'veil') return '';
return accentRules(palette(), theme()).cardFocus;
};










var SCALES = { small: 0.9, normal: 1, large: 1.1, huge: 1.2 };
var SCALE_DEFAULT = 'normal';




function round2(value) {
return Math.round(value * 100) / 100;
}





function emCss(value) {
return ('' + round2(value)).replace(/^0\./, '.') + 'em';
}



































var ROW_CARD_W = 9.52;



var ROW_CARD_NARROW = 8.07;


var POSTER_RATIO = 1.5;















var ROW_HEAD_GAP = 1.5;






var ROW_TITLE_EM = 1.23;
var CARD_VIEW_GAP = 0.5;









































var POSTER_ANCHOR = 'center top';
var CARD_NOT_WIDE = ':not(.card--wide):not(.card--collection)';
var CARD_TITLE_LH = 1.15;
var CARD_AGE_GAP = 0.25;




var CARD_FOCUS_SHIFT = 0.35;
var LAMPA_MORE_EM = 1.8;




var ROW_EDGE_AIR = 0.7;






var PERSON_ZOOM = 1.1;
var PERSON_LEFT = 1.5;
var PERSON_GAP = round2(1 * PERSON_ZOOM);
var PERSON_PEEK = round2(7 * PERSON_ZOOM / 2);
var PERSON_TARGET = 23;









var CARD_BODY_VH = 74;
var SCRIM_FROM = CARD_BODY_VH;
var SCRIM_TO = 92;
var SCRIM_MAX = 0.8;
var LAMPA_ROW_PAD = 2.5;
var LAMPA_HEAD = 4;



















var ROW_GAP = LAMPA_ROW_PAD;















var EDGE = 3.51;
var EDGE_Y = 2.63;





var NARROW_PHYS = 1000;
function narrowWindowPx() {
var dpr = 1;
try {
if (typeof window !== 'undefined' && window.devicePixelRatio > 0) dpr = window.devicePixelRatio;
} catch (e) {
dpr = 1;
}
return Math.round(NARROW_PHYS / dpr);
}











var TV_MIN = 1.01;









var ROUL_REST_EM = round2(1.05 + Math.max(2.1 * 1.1, 2 * 1.01) + 0.88 + 2 * 1.01 + 0.88 +
0.70 + 1.58 * 1.1 + 1.01 * 1.2 + 0.88 + 3.16 * 1.05);









var ATV_REST_EM = round2(1.05 + 2.3 * 1.1 + 0.88 + 2 * 1.01 + 0.88 + 1.1 +
1.2 + 1.05 * 1.2 + 0.55 * 1.05 + 0.45 + 1.01 * 1.3);
var ATV_REEL_VH = 36;
var ATV_TILE_VH = 15.75;


















var HERO_VH = { large: 66.67, medium: 56, compact: 45 };
var ROWS_TOP_VH = { large: 50, medium: 42, compact: 34 };
var HERO_DEFAULT = 'large';







































var ROWS_SHIFT_VH = 5.5;





var ROWS_AIR = 1.5;







var TEXT_AIR_VH = 1.33;
var TEXT_EDGE_VH = 3.4;







var CHIP_BOX = 2.60;
var CHIP_ZOOM = 1.01;
var MOODS_H = round2(CHIP_BOX * CHIP_ZOOM);
var MOODS_GAP = 0.8;





var MOODS_BAR = round2(MOODS_H + MOODS_GAP);

















var HERO_HEAD_SAFE = 4.4;



















var TEXT_META = 1.48;





















var TEXT_LOGO = 6.9;







var TEXT_DESCR = 4.05;













var TEXT_STATUS = 2.07;
var TEXT_ZOOM = 1.1;





































































































var SCRIM_TOP_A = 0.5;
var SCRIM_TOP_FULL = 3.96;
var SCRIM_TOP_END = 9;
var SCRIM_FADE = [[0, 1], [0.15, 0.9], [0.4, 0.58], [0.7, 0.22], [1, 0]];
var SCRIM_FADE_K = 0.4;
var SCRIM_L_A = 0.85;
var SCRIM_L_R0 = 0.45;
var SCRIM_L_RX = 84;
var SCRIM_L_RY = 85.19;
var SCRIM_L_BELOW = 14.35;
var SCRIM_L_STEPS = 11;
var FLOOR_UP = 1.5;
var FLOOR_FADE = 22;
var FLOOR_STEPS = 10;
var SHADE_K = 0.5;

















var HERO_TEXT_SHADOW = '0 0 .5em rgba(0,0,0,.55),0 .06em .12em rgba(0,0,0,.7)';
var TEXT_MAX_W = 28;





var DESCR_MAX_W = 24;


var TEXT_SCALE_COMPACT = 0.95;



var LOGO_COMPACT = 0.65;



var HERO_MIN_RATIO = 220;













var DESCR_MIN_RATIO = 190;



function heroSizeKey() {
var key = LC.pref('lumen_hero_size', HERO_DEFAULT);
return HERO_VH[key] ? key : HERO_DEFAULT;
}



function heroShiftVh(key) {
return round2(HERO_VH[key] - ROWS_TOP_VH[key]);
}




function textBottomVh(key) {
return round2(HERO_VH[key] - ROWS_TOP_VH[key] - ROWS_SHIFT_VH + TEXT_AIR_VH);
}




function textShiftVh(key) {
return round2(heroShiftVh(key) - ROWS_SHIFT_VH + TEXT_AIR_VH - TEXT_EDGE_VH);
}




function heroSmallText() {
return heroSizeKey() === 'compact';
}





function alphaCss(a) {
return ('' + round2(a)).replace(/^0\./, '.');
}



function shadeRgb(hex) {
var rgb = hexToRgb(hex).split(',');
for (var i = 0; i < rgb.length; i++) rgb[i] = Math.round(rgb[i] * (1 - SHADE_K));
return rgb.join(',');
}



function shadeAt(P, a) {
return 'rgba(' + P.shadeRgb + ',' + alphaCss(a) + ')';
}





function edgeAt(P, a) {
if (a >= 1) return P.bg;
var bg = P.bgRgb.split(',');
var sh = P.shadeRgb.split(',');
var rgb = [];
for (var i = 0; i < bg.length; i++) rgb.push(Math.round(+sh[i] + (bg[i] - sh[i]) * a));
return 'rgba(' + rgb.join(',') + ',' + alphaCss(a) + ')';
}



function fadeStops(P, from, len) {
var out = from > 0 ? [P.bg + ' 0%'] : [];
for (var i = 0; i < SCRIM_FADE.length; i++) {
out.push(edgeAt(P, SCRIM_FADE[i][1]) + ' ' + round2(from + SCRIM_FADE[i][0] * len) + '%');
}
return out.join(',');
}

function scrimTop(P) {
var half = shadeAt(P, SCRIM_TOP_A);
return half + ' 0,' + half + ' ' + SCRIM_TOP_FULL + 'em,' + shadeAt(P, 0) + ' ' + SCRIM_TOP_END + 'em';
}

function scrimBottom(P, key) {
return fadeStops(P, round2(100 - HERO_VH[key]), HERO_VH[key] * SCRIM_FADE_K);
}




function smootherstep(t) {
t = t < 0 ? 0 : (t > 1 ? 1 : t);
return t * t * t * (t * (t * 6 - 15) + 10);
}




function scrimFloor(P) {
var out = [];
for (var i = 0; i <= FLOOR_STEPS; i++) {
var t = i / FLOOR_STEPS;
out.push(edgeAt(P, smootherstep(t)) + ' ' + round2(t * FLOOR_FADE) + 'vh');
}
return out.join(',');
}

function floorTop(key) {
return round2(ROWS_TOP_VH[key] - FLOOR_FADE) + 'vh - ' + FLOOR_UP + 'em';
}





function scrimLeft(P) {
var out = [shadeAt(P, SCRIM_L_A) + ' 0%'];
for (var i = 0; i <= SCRIM_L_STEPS; i++) {
var t = i / SCRIM_L_STEPS;
var a = ('' + Math.round(SCRIM_L_A * (1 - smootherstep(t)) * 1000) / 1000).replace(/^0\./, '.');
out.push('rgba(' + P.shadeRgb + ',' + a + ') ' + round2((SCRIM_L_R0 + (1 - SCRIM_L_R0) * t) * 100) + '%');
}
return out.join(',');
}



function scrimLeftY(key) {
return round2(HERO_VH[key] - textBottomVh(key) + SCRIM_L_BELOW);
}











function textNeedEm(withDescr) {
var inner = TEXT_STATUS + TEXT_LOGO + (heroSmallText() ? 0 : TEXT_META);
if (withDescr) inner += TEXT_DESCR;
return round2(HERO_HEAD_SAFE + inner * TEXT_ZOOM);
}



















function screenEm() {
try {
if (LC.util && typeof LC.util.screenBaseEm === 'function') return LC.util.screenBaseEm() || 84.17;
} catch (e) { }
return 84.17;
}





function textRatio(key, needEm) {
return Math.round(screenEm() * (HERO_VH[key] - textBottomVh(key)) / needEm);
}




















function cardK() {
var k = 1;
try {
if (LC.util && typeof LC.util.lampaCardK === 'function') k = LC.util.lampaCardK() || 1;
} catch (e) { }
return k;
}














function rowHeadGap(scale, cardW) {
return round2(ROW_HEAD_GAP * Math.max(scale, cardK() * cardW / ROW_CARD_W));
}








function rowCapAge(em) {
return heroSmallText() ? em : 0;
}

function rowBlockEm(cardW, titleEm, gapEm, cardTitleEm, cardAgeEm, flow) {
var k = cardK();






return titleEm + gapEm + k * (cardW * POSTER_RATIO +
CARD_VIEW_GAP + cardTitleEm * CARD_TITLE_LH + CARD_AGE_GAP * cardAgeEm + cardAgeEm +






(flow ? 0 : CARD_FOCUS_SHIFT * cardAgeEm));
}















function rowNarrowRatio(key, blockEm) {
return Math.floor(screenEm() * (100 - ROWS_TOP_VH[key]) / (ROWS_AIR + blockEm + ROW_EDGE_AIR));
}









var TV_RATIO = 178;






function rowNarrowBlockEm(scale) {
var w = round2(ROW_CARD_NARROW * scale);
return rowBlockEm(w, round2(ROW_TITLE_EM * scale), rowHeadGap(scale, w), TV_MIN, rowCapAge(TV_MIN));
}























































function rowScaleCap(key) {
var availEm = screenEm() * (100 - ROWS_TOP_VH[key]) / TV_RATIO - ROWS_AIR - ROW_EDGE_AIR;
var floor = SCALES.small;
var scale = scaleFactor();
while (scale > floor && rowNarrowBlockEm(scale) > availEm) scale = round2(scale - 0.01);
return scale;
}




















var SCALE_ROOTS = '.lumen-card,.lumen-backdrop,.lumen-descr-row,.lumen-review-modal,.lumen-descr-modal,.lumen-hero .lumen-hero__text,.lumen-hub,.lumen-grid,.lumen-minimap,.lumen-jump,.lumen-ambient,.lumen-roulette';

function scaleFactor() {
return SCALES[LC.pref('lumen_scale', SCALE_DEFAULT)] || SCALES[SCALE_DEFAULT];
}











LC.uiScale = scaleFactor;







var heroOffAt = 0;
LC.heroOffRatio = function () { return heroOffAt; };









var EPISODE_EM = { width: 14.9, gap: 0.70 };
LC.episodeEm = EPISODE_EM;















var GRID_GAP = 0.88;
var TILE_COLS = 4;
var GCARD_COLS = 6;
LC.hubEm = { edge: EDGE, gap: GRID_GAP, tileCols: TILE_COLS, gcardCols: GCARD_COLS };




















var FONT_SETS = {
golos: { body: 'Golos Text', weights: '400;500;600;700' },
onest: { body: 'Onest', weights: '400;500;600;700' },
manrope: { body: 'Manrope', weights: '400;500;600;700' },
inter: { body: 'Inter', weights: '400;500;600;700' },
plex: { body: 'IBM Plex Sans', weights: '400;500;600;700' }
};
var FONT_DEFAULT = 'golos';

var FONT_BODY_OFF = 'inherit';



function fontSet() {
return FONT_SETS[LC.pref('lumen_font', FONT_DEFAULT)] || FONT_SETS[FONT_DEFAULT];
}

function bodyStack(set) {
return '"' + set.body + '","Segoe UI",Roboto,Arial,sans-serif';
}



LC.fontsUrl = function () {
var set = fontSet();
return 'https://fonts.googleapis.com/css2?family=' + set.body.replace(/ /g, '+') +
':wght@' + set.weights + '&display=swap';
};






function theme() {
var auto = null;
try {
if (LC.accent && typeof LC.accent.current === 'function') auto = LC.accent.current();
} catch (e) {
warn('accent override failed', e);
}
if (auto) return auto;
var key = LC.pref(PLUGIN + '_accent', 'sand');
return ACCENTS[key] || ACCENTS.sand;
}





function useFonts() {
return LC.enabled() && LC.pref(PLUGIN + '_fonts', true);
}




LC.tokens = function () {
var t = theme();
var P = palette();
var fonts = useFonts();
var set = fontSet();
return {
bg: P.bg, panel: P.panel, line: P.line, text: P.text, muted: P.muted, soft: P.soft, smoke: P.smoke,
spice: P.spice, dark: P.dark,
panelHi: P.panelHi, panelLo: P.panelLo, raised: P.raised, textRgb: P.textRgb, bgRgb: P.bgRgb,
accent: t.color, accentRgb: hexToRgb(t.color), onac: t.onac, ring: t.light, acglow: t.glow,



fontBody: fonts ? bodyStack(set) : FONT_BODY_OFF
};
};

LC.buildCss = function () {
var t = theme();


var P = palette();
var A = t.color;
var AL = t.light;
var AG = t.glow;
var A_RGB = hexToRgb(A);
var fonts = useFonts();
var set = fontSet();
var FB = fonts ? bodyStack(set) : FONT_BODY_OFF;

var css = [];








var scale = scaleFactor();
if (scale !== SCALES[SCALE_DEFAULT]) css.push(SCALE_ROOTS + '{font-size:' + scale + 'em}');







css.push('.lumen-backdrop{position:absolute;top:0;left:0;width:100%;height:100vh;z-index:-1;overflow:hidden;opacity:0;pointer-events:none}');
css.push('.lumen-backdrop.loaded{opacity:1}');
css.push('.lumen-backdrop__img{position:absolute;top:0;left:0;right:0;bottom:0;background-position:72% 32%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover}');


















css.push('.lumen-backdrop .lumen-bg__img{position:absolute;top:0;right:0;bottom:0;left:0;background-position:72% 32%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover;opacity:0}');
css.push('body.lumen-fx-heavy .lumen-backdrop.lumen-motion-full .lumen-bg__img{-webkit-transition:opacity .6s ease-in-out;transition:opacity .6s ease-in-out}');
css.push('.lumen-backdrop .lumen-bg__img.is-active{opacity:1}');






css.push('.lumen-backdrop .lumen-bg__trailer{position:absolute;top:-10%;bottom:-10%;left:0;right:0;overflow:hidden;opacity:0;-webkit-transition:opacity 1s ease;transition:opacity 1s ease}');
css.push('.lumen-backdrop .lumen-bg__trailer.is-live{opacity:1}');
css.push('.lumen-backdrop .lumen-bg__trailer iframe{width:100%;height:100%;border:0;pointer-events:none}');






css.push('.lumen-backdrop .lumen-fx,.lumen-hero .lumen-fx{position:absolute;top:0;bottom:0;left:0;right:0;overflow:hidden;pointer-events:none}');
css.push('.lumen-backdrop .lumen-fx__canvas,.lumen-hero .lumen-fx__canvas{position:absolute;top:0;left:0;width:100%;height:100%;opacity:.82}');










var LIGHT = 'rgba(255,214,150,.42) 0%,rgba(255,182,72,.14) 45%,rgba(255,182,72,0) 72%';
var garland = [
'radial-gradient(circle 1.1em at 5% .59em,' + LIGHT + ')',
'radial-gradient(circle 1.1em at 15% 1.01em,' + LIGHT + ')',
'radial-gradient(circle 1.1em at 25% 1.33em,' + LIGHT + ')',
'radial-gradient(circle 1.1em at 35% 1.55em,' + LIGHT + ')',
'radial-gradient(circle 1.1em at 45% 1.65em,' + LIGHT + ')',
'radial-gradient(circle 1.1em at 55% 1.65em,' + LIGHT + ')',
'radial-gradient(circle 1.1em at 65% 1.55em,' + LIGHT + ')',
'radial-gradient(circle 1.1em at 75% 1.33em,' + LIGHT + ')',
'radial-gradient(circle 1.1em at 85% 1.01em,' + LIGHT + ')',
'radial-gradient(circle 1.1em at 95% .59em,' + LIGHT + ')'
].join(',');
css.push('.lumen-backdrop.lumen-theme--christmas .lumen-fx,.lumen-hero.lumen-theme--christmas .lumen-fx{background-image:' + garland + ';background-repeat:no-repeat;background-position:top center;-webkit-background-size:100% 4em;background-size:100% 4em}');


css.push('.lumen-backdrop.lumen-theme--halloween .lumen-fx,.lumen-hero.lumen-theme--halloween .lumen-fx{background-image:linear-gradient(0deg,rgba(224,123,44,.20) 0%,rgba(224,123,44,.07) 14%,rgba(224,123,44,0) 34%)}');







css.push('.lumen-backdrop .lumen-fx__canvas--scene,.lumen-hero .lumen-fx__canvas--scene{opacity:1}');





css.push('.lumen-backdrop.lumen-theme--christmas .lumen-fx.lumen-fx--scene,.lumen-hero.lumen-theme--christmas .lumen-fx.lumen-fx--scene{background-image:none}');






var MIST = '176,168,196';
css.push('.lumen-backdrop.lumen-theme--halloween .lumen-fx.lumen-fx--scene,.lumen-hero.lumen-theme--halloween .lumen-fx.lumen-fx--scene{background-image:' +
'radial-gradient(ellipse 38% 18% at 78% 100%,rgba(' + MIST + ',.3) 0%,rgba(' + MIST + ',.12) 55%,rgba(' + MIST + ',0) 100%),' +
'radial-gradient(ellipse 32% 13% at 46% 102%,rgba(' + MIST + ',.2) 0%,rgba(' + MIST + ',.07) 55%,rgba(' + MIST + ',0) 100%),' +
'radial-gradient(ellipse 26% 10% at 12% 103%,rgba(' + MIST + ',.07) 0%,rgba(' + MIST + ',0) 100%),' +
'linear-gradient(0deg,rgba(224,123,44,.26) 0%,rgba(224,123,44,.09) 16%,rgba(224,123,44,0) 38%)}');



css.push('.lumen-backdrop.lumen-trailer-live .lumen-backdrop__veil{opacity:.45}');
css.push('.lumen-backdrop__veil{position:absolute;top:0;left:0;right:0;bottom:0;-webkit-transition:opacity 1s ease;transition:opacity 1s ease}');
css.push('.lumen-backdrop__veil--l{background:linear-gradient(90deg,rgba(' + P.bgRgb + ',0.96) 0%,rgba(' + P.bgRgb + ',0.88) 30%,rgba(' + P.bgRgb + ',0.35) 58%,rgba(' + P.bgRgb + ',0) 82%)}');
css.push('.lumen-backdrop__veil--b{background:linear-gradient(0deg,rgba(' + P.bgRgb + ',0.98) 0%,rgba(' + P.bgRgb + ',0.60) 28%,rgba(' + P.bgRgb + ',0) 60%)}');
css.push('.lumen-backdrop__veil--t{background:linear-gradient(180deg,rgba(' + P.bgRgb + ',0.70) 0%,rgba(' + P.bgRgb + ',0) 22%)}');































var scrim = 'rgba(' + P.bgRgb + ',0) 0,rgba(' + P.bgRgb + ',0) ' + SCRIM_FROM + 'vh,rgba(' +
P.bgRgb + ',' + SCRIM_MAX + ') ' + SCRIM_TO + 'vh,rgba(' + P.bgRgb + ',' + SCRIM_MAX + ') 100%';
css.push('.lumen-scrim{background-image:-webkit-linear-gradient(top,' + scrim + ');background-image:linear-gradient(180deg,' + scrim + ')}');

css.push('.lumen-backdrop--proc0 .lumen-backdrop__img{background:radial-gradient(ellipse 56% 57% at 72% 58%,rgba(255,214,150,0.85) 0%,rgba(232,150,80,0.40) 28%,rgba(232,150,80,0) 70%),linear-gradient(180deg,#1A0D08 0%,#7A2E12 42%,#D9622B 60%,#E8B87A 78%,#3A2418 100%)}');
css.push('.lumen-backdrop--proc1 .lumen-backdrop__img{background:radial-gradient(ellipse 52% 52% at 74% 52%,rgba(238,214,120,0.78) 0%,rgba(200,170,70,0.35) 30%,rgba(200,170,70,0) 70%),linear-gradient(180deg,#0F1210 0%,#3A3E22 45%,#B99A3A 66%,#6E5A24 82%,#17140E 100%)}');
css.push('.lumen-backdrop--proc2 .lumen-backdrop__img{background:radial-gradient(ellipse 58% 55% at 68% 54%,rgba(190,214,236,0.70) 0%,rgba(120,150,190,0.32) 30%,rgba(120,150,190,0) 70%),linear-gradient(180deg,#07090E 0%,#1B2536 44%,#46617F 64%,#8FA6BC 80%,#181C22 100%)}');


























css.push('.lumen-backdrop.lumen-bg--blur{background:' + P.gradBlur + '}');
css.push('.lumen-backdrop.lumen-bg--blur .lumen-backdrop__img{background-position:50% 50%;opacity:.8}');
css.push('.lumen-backdrop.lumen-motion-full.lumen-bg--blur .lumen-backdrop__img{-webkit-transform:scale(1.1);transform:scale(1.1)}');
css.push('.full-start__background.lumen-off{display:none !important}');




































css.push('.full-start-new.lumen-card{position:relative;min-height:100vh;padding:0 ' + EDGE + 'em ' + EDGE_Y + 'em;color:' + P.text + ';font-family:' + FB + '}');
css.push('.lumen-card .full-start-new__left{display:none !important}');








css.push('.lumen-card.lumen-card--poster .full-start-new__left{display:block !important;-webkit-box-ordinal-group:2;-webkit-order:1;order:1;-webkit-align-self:flex-start;-ms-flex-item-align:start;align-self:flex-start;-webkit-flex-shrink:0;flex-shrink:0;width:16.66em;margin:6.14em 0 0 2.63em}');
css.push('.lumen-card.lumen-card--poster .full-start-new__poster{border-radius:.61em;overflow:hidden;background:' + P.gradPoster + ';border:.04em solid ' + P.line + ';-webkit-box-shadow:0 .35em .8em rgba(0,0,0,.6);box-shadow:0 .35em .8em rgba(0,0,0,.6)}');
css.push('.lumen-card.lumen-card--poster .full-start-new__img{border-radius:.61em}');
css.push('.lumen-card.lumen-card--poster .lumen-poster-tmdb{position:absolute;left:0;right:0;bottom:0;padding:0 1.05em 1.05em;font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1.3;color:' + P.smoke + '}');






























css.push('.lumen-card .full-start-new__body{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:end;-webkit-align-items:flex-end;align-items:flex-end;min-height:' + CARD_BODY_VH + 'vh}');
css.push('.lumen-card .full-start-new__right{-webkit-box-flex:1;-webkit-flex-grow:1;flex-grow:1;min-width:0}');












css.push('.lumen-card .lumen-content{display:block}');
css.push('.lumen-card .lumen-content > .lumen-in{max-width:52em}');


css.push('.lumen-card .full-start-new__tagline,.lumen-card .full-start-new__reactions,.lumen-card .lumen-keep{display:none !important}');
css.push('.lumen-card.lumen--meta .full-start-new__head,.lumen-card.lumen--meta .full-start-new__details{display:none !important}');
css.push('.lumen-card .full-start__pg{display:none !important}');





css.push('.lumen-card .lumen-meta{font-family:' + FB + ';font-size:1.01em;color:' + P.muted + ';letter-spacing:.03em;line-height:1.3;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
css.push('.lumen-card .lumen-meta > *{margin:0 .46em .17em 0}');
css.push('.lumen-card .lumen-meta__sep{color:' + P.line + '}');











css.push('.lumen-card .full-start-new__title{font-family:' + FB + ';font-size:3.33em;font-weight:700;line-height:1.26;letter-spacing:0;margin:.67em 0 0}');










css.push('.lumen-card .full-start-new__title.lumen-title--long{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:2;line-clamp:2;font-size:2.5em;line-height:1.16}');
















css.push('.lumen-card .full-start-new__title.lumen-title--split{display:block;overflow:visible}');
css.push('.lumen-card .lumen-title__lead{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:2;line-clamp:2}');
css.push('.lumen-card .lumen-title__sub{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:2;line-clamp:2;font-size:.63em;line-height:1.17;font-weight:600;color:' + P.muted + '}');













css.push('.lumen-card .lumen-logo{display:none;font-size:3.33em;width:7.13em;height:1.55em;margin:.67em 0 0;background-repeat:no-repeat;background-position:0 50%;-webkit-background-size:contain;background-size:contain}');
css.push('.lumen-card.lumen-logo-wait .full-start-new__title,.lumen-card.lumen-logo-on .full-start-new__title{display:none}');
css.push('.lumen-card.lumen-logo-wait .lumen-logo,.lumen-card.lumen-logo-on .lumen-logo{display:block}');
































var CHIP_FILM = 'rgba(' + P.textRgb + ',.12)';
var CARD_CHIP = P.chipBg.charAt(0) === '#'
? 'background:' + P.chipBg
: 'background:-webkit-linear-gradient(' + CHIP_FILM + ',' + CHIP_FILM + ');background:linear-gradient(' + CHIP_FILM + ',' + CHIP_FILM + ');background-color:rgba(' + P.bgRgb + ',.96)';


css.push('.lumen-card .full-start-new__rate-line{margin:1.05em 0 0;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:stretch;-webkit-align-items:stretch;align-items:stretch;-webkit-flex-wrap:wrap;flex-wrap:wrap}');




css.push('.lumen-card .full-start-new__rate-line > *{margin:0 .53em .53em 0 !important}');
css.push('.lumen-card .full-start__rate{font-family:' + FB + ';' + CARD_CHIP + ';border-radius:.53em;padding:.44em .70em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
















css.push('.lumen-card .full-start__rate > div:first-child{display:block;width:auto;height:auto;background:transparent;border-radius:0;font-size:1.23em;font-weight:600;line-height:1;color:' + P.text + '}');



css.push('.lumen-card .full-start__rate > div:last-child{font-size:1.01em;letter-spacing:.06em;color:' + P.muted + ';padding:.11em 0 0}');















css.push('.lumen-card .lumen-reactions-chip{font-family:' + FB + ';' + CARD_CHIP + ';border-radius:.53em;padding:.44em .70em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
css.push('.lumen-card .lumen-reactions-chip__value{font-size:1.23em;font-weight:600;line-height:1;color:' + P.text + '}');
css.push('.lumen-card .lumen-reactions-chip__label{font-size:1.01em;letter-spacing:.06em;color:' + P.muted + ';padding:.11em 0 0}');





css.push('.lumen-card .full-start-new__rate-line .tag--episode{display:none !important}');






css.push('.lumen-card .full-start-new__rate-line .full-start__status{display:none}');
css.push('.lumen-card .lumen-next-chip{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1;color:' + P.text + ';' + CARD_CHIP + ';border-radius:.53em;padding:0 .70em;white-space:nowrap;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card .lumen-next-chip:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:.95em;height:.95em;margin-right:.44em;background-color:' + P.muted + ';-webkit-mask-image:' + LC.icons.maskUrl('clock') + ';mask-image:' + LC.icons.maskUrl('clock') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain}');














css.push('.lumen-card.lumen-card--serial .full-start-new__rate-line .full-start__status{font-family:' + FB + ';font-weight:500;letter-spacing:normal;text-transform:none;color:' + P.text + ';' + CARD_CHIP + ';border:0;border-radius:.53em;padding:.44em .70em;white-space:nowrap;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
css.push('.lumen-card .lumen-status__value{font-size:1.23em;font-weight:600;line-height:1;color:' + P.text + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card .lumen-status__value:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:.44em;height:.44em;border-radius:50%;background:currentColor;margin-right:.44em}');
css.push('.lumen-card .lumen-status__label,.lumen-card .lumen-status__short{font-size:1.01em;letter-spacing:.06em;line-height:1;color:' + P.muted + ';padding:.11em 0 0}');


css.push('.lumen-card .lumen-status__label:empty,.lumen-card .lumen-status__short:empty{display:none}');
css.push('.lumen-card .lumen-status__short{display:none}');










css.push('.lumen-card .lumen-progress{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center;width:33.32em;max-width:100%;margin-top:1.05em;font-family:' + FB + ';font-size:1em;color:' + P.muted + ';letter-spacing:.04em}');
css.push('.lumen-card .lumen-progress__label{font-size:1.01em;line-height:1;color:' + P.muted + '}');
css.push('.lumen-card .lumen-progress__time{font-size:1.01em;line-height:1;color:' + P.muted + ';margin-left:.27em}');
css.push('.lumen-card .lumen-progress__label:empty,.lumen-card .lumen-progress__time:empty{display:none}');
css.push('.lumen-card .lumen-progress__bar{-webkit-box-flex:0;-webkit-flex:0 0 100%;flex:0 0 100%;width:100%;height:.18em;background:rgba(' + P.textRgb + ',0.16);border-radius:.09em;overflow:hidden;margin:.44em 0 0}');
css.push('.lumen-card .lumen-progress__bar > div{height:100%;width:0;border-radius:.09em;background:' + A + '}');









css.push('.lumen-card.lumen-continue:not(.lumen-trailer-on) .full-start-new__buttons .button--play:after{content:var(--lumen-play-label);font-size:1.05em;line-height:1;margin-left:.53em;white-space:nowrap}');
css.push('@supports (--lumen-probe:0){.lumen-card.lumen-continue:not(.lumen-trailer-on) .full-start-new__buttons .button--play span{display:none}}');






css.push('.lumen-card .full-start-new__buttons{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-top:1.40em;overflow:visible}');






css.push('.lumen-card .full-start-new__buttons .full-start__button{font-size:1em;font-weight:600;height:3.16em;min-width:3.16em;padding:0 1.32em;margin:0 .70em .6em 0;border-radius:.79em;background:' + P.buttonBg + ';color:' + P.text + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;-webkit-transition:width .2s,padding .2s,background-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:width .2s,padding .2s,background-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('.lumen-card .full-start-new__buttons .full-start__button > svg{width:1.14em;height:1.14em;-webkit-flex-shrink:0;flex-shrink:0}');
css.push('.lumen-card .full-start-new__buttons .full-start__button > svg + span{font-size:1.05em;margin:0 0 0 .53em;line-height:1}');
css.push('.lumen-card .full-start-new__buttons .full-start__button span{display:none}');
css.push('.lumen-card .full-start-new__buttons .button--play span,.lumen-card .full-start-new__buttons .button--priority span,.lumen-card .full-start-new__buttons .view--trailer span{display:block}');




















css.push('.lumen-card .full-start-new__buttons > .buttons--container{-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-order:1;order:1}');
css.push('.lumen-card .full-start-new__buttons > .buttons--container > .full-start__button{display:none}');
css.push('.lumen-card.lumen-card--trailer .full-start-new__buttons > .buttons--container{display:-webkit-box !important;display:-webkit-flex !important;display:flex !important}');
css.push('.lumen-card.lumen-card--trailer .full-start-new__buttons > .buttons--container > .view--trailer{display:-webkit-box;display:-webkit-flex;display:flex}');





css.push('.lumen-card .full-start-new__buttons > .button--book,.lumen-card .full-start-new__buttons > .button--reaction,.lumen-card .full-start-new__buttons > .button--subscribe,.lumen-card .full-start-new__buttons > .button--options{-webkit-order:2;order:2}');







css.push('.lumen-card .full-start-new__buttons .full-start__button.active{background:rgba(' + A_RGB + ',.16);color:' + A + '}');


css.push('.lumen-card .full-start-new__buttons .button--book,.lumen-card .full-start-new__buttons .button--reaction,.lumen-card .full-start-new__buttons .button--subscribe,.lumen-card .full-start-new__buttons .button--options{padding:0;width:3.16em}');
css.push('.lumen-card .full-start-new__buttons .button--book.focus,.lumen-card .full-start-new__buttons .button--reaction.focus,.lumen-card .full-start-new__buttons .button--subscribe.focus,.lumen-card .full-start-new__buttons .button--options.focus{width:auto;padding:0 1.05em}');
css.push('.lumen-card .full-start-new__buttons .full-start__button.focus span{display:block}');































css.push('.lumen-card .full-start-new__buttons .full-start__button.focus{background:' + P.text + ';color:' + P.bg + ';-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');



css.push('.lumen-card .full-start-new__buttons .full-start__button.focus.lumen-press{background:' + P.muted + ' !important;-webkit-transform:scale(1) !important;transform:scale(1) !important}');









css.push('.lumen-card .lumen-stop{display:none;font-family:' + FB + ';font-weight:600;font-size:1em;height:3.16em;padding:0 1.32em;margin:0 .70em .6em 0;border-radius:.79em;border:.04em solid rgba(' + P.textRgb + ',.2);background:' + P.glass + ';color:' + P.text + ';white-space:nowrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;-webkit-transition:background-color .2s,border-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,border-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');







css.push('.lumen-card.lumen-trailer-on .lumen-stop{display:-webkit-box;display:-webkit-flex;display:flex;margin-top:1.40em;margin-bottom:.6em}');
css.push('.lumen-card .lumen-stop__ico{-webkit-flex-shrink:0;flex-shrink:0;width:1.14em;height:1.14em;margin-right:.53em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('stop') + ';mask-image:' + LC.icons.maskUrl('stop') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');
css.push('.lumen-card .lumen-stop span{font-size:1.05em;line-height:1}');





css.push('.lumen-card .lumen-stop.focus{background:' + P.text + ';color:' + P.bg + ';-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');







css.push('.lumen-card .lumen-trailer-badge{display:none;position:absolute;top:4.91em;right:' + EDGE + 'em;z-index:6;font-family:' + FB + ';font-size:1.01em;line-height:1;letter-spacing:.05em;color:' + P.text + ';background:' + P.glass + ';border:.04em solid rgba(' + P.textRgb + ',.2);border-radius:1.31em;padding:.44em .78em;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card.lumen-trailer-on .lumen-trailer-badge{display:-webkit-box;display:-webkit-flex;display:flex}');
css.push('.lumen-card .lumen-trailer-badge:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:.95em;height:.95em;margin-right:.52em;background-color:' + A + ';-webkit-mask-image:' + LC.icons.maskUrl('mute') + ';mask-image:' + LC.icons.maskUrl('mute') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');




css.push('.lumen-card.lumen-trailer-on .full-start-new__title{font-size:1.84em;opacity:.92}');
css.push('.lumen-card.lumen-trailer-on .lumen-logo{font-size:1.84em;opacity:.92}');


css.push('.lumen-card.lumen-trailer-on .full-start-new__rate-line,.lumen-card.lumen-trailer-on .lumen-episodes,.lumen-card.lumen-trailer-on .lumen-progress{display:none !important}');
css.push('.lumen-card.lumen-trailer-on .lumen-actions{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');



css.push('.lumen-card .lumen-status--good:before{color:' + P.good + '}');
css.push('.lumen-card .lumen-status--accent:before{color:' + A + '}');
css.push('.lumen-card .lumen-status--muted:before,.lumen-card .lumen-status--soon:before{color:' + P.smoke + '}');







css.push('.lumen-card .full-start-new__rate-line .lumen-tags{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card .lumen-tags .full-start__tag{display:none !important}');


css.push('.lumen-card .lumen-quality-chip{font-family:' + FB + ';font-weight:600;font-size:1.01em;letter-spacing:.05em;color:' + P.text + ';background:' + P.chipBg + ';border-radius:.20em;padding:.20em .31em;margin:0 .23em .23em 0;white-space:nowrap}');



















css.push('.lumen-card .lumen-episodes{margin-top:1.75em}');
css.push('.lumen-card .lumen-episodes__head{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline;margin-bottom:.79em}');
css.push('.lumen-card .lumen-episodes__title{font-family:' + FB + ';font-weight:700;font-size:1.23em;line-height:1;color:' + P.text + ';margin-right:.5em}');
css.push('.lumen-card .lumen-episodes__count{font-family:' + FB + ';font-size:1.01em;line-height:1;letter-spacing:.08em;text-transform:uppercase;color:' + P.smoke + '}');























css.push('.lumen-card .lumen-episodes__viewport{position:relative;height:8.38em}');
css.push('.lumen-card .lumen-episodes__track{position:absolute;top:0;left:0;height:100%;display:-webkit-box;display:-webkit-flex;display:flex}');



css.push('.lumen-card .lumen-episode{position:relative;-webkit-box-sizing:border-box;box-sizing:border-box;width:' + EPISODE_EM.width + 'em;height:8.38em;margin-right:' + EPISODE_EM.gap + 'em;-webkit-box-flex:0;-webkit-flex:none;flex:none;border-radius:.61em;overflow:hidden;background:' + P.gradSlate + ';border:.04em solid ' + P.line + ';color:' + P.text + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between}');



css.push('.lumen-card .lumen-episode__still{position:absolute;top:0;right:0;bottom:0;left:0;background-position:50% 50%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover;opacity:1}');






css.push('.lumen-card .lumen-episode__top{position:relative;-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-box-flex:0;-webkit-flex:none;flex:none;padding:.44em .53em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between;-webkit-box-align:center;-webkit-align-items:center;align-items:center;min-height:1.40em;background:-webkit-linear-gradient(top,rgba(' + P.bgRgb + ',.72) 0%,rgba(' + P.bgRgb + ',.28) 55%,rgba(' + P.bgRgb + ',0) 100%);background:linear-gradient(180deg,rgba(' + P.bgRgb + ',.72) 0%,rgba(' + P.bgRgb + ',.28) 55%,rgba(' + P.bgRgb + ',0) 100%)}');





css.push('.lumen-card .lumen-episode__num{font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1;letter-spacing:.07em;color:' + P.text + '}');
css.push('.lumen-card .lumen-episode__check{width:.88em;height:.88em;background-color:' + P.good + ';-webkit-mask-image:' + LC.icons.maskUrl('check') + ';mask-image:' + LC.icons.maskUrl('check') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain}');
css.push('.lumen-card .lumen-episode__percent{font-family:' + FB + ';font-size:1.01em;line-height:1;color:' + A + '}');
css.push('.lumen-card .lumen-episode__play{display:none;position:relative;width:1.40em;height:1.40em;border-radius:50%;background:' + A + '}');
css.push('.lumen-card .lumen-episode__play:before{content:"";position:absolute;top:50%;left:50%;width:.75em;height:.75em;margin:-.375em 0 0 -.33em;background-color:' + P.dark + ';-webkit-mask-image:' + LC.icons.maskUrl('play') + ';mask-image:' + LC.icons.maskUrl('play') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain}');







css.push('.lumen-card .lumen-episode__bottom{position:relative;min-width:0;-webkit-box-sizing:border-box;box-sizing:border-box;padding:1.05em .53em .44em;background:-webkit-linear-gradient(bottom,rgba(' + P.bgRgb + ',.92) 0%,rgba(' + P.bgRgb + ',.62) 55%,rgba(' + P.bgRgb + ',0) 100%);background:linear-gradient(0deg,rgba(' + P.bgRgb + ',.92) 0%,rgba(' + P.bgRgb + ',.62) 55%,rgba(' + P.bgRgb + ',0) 100%)}');
css.push('.lumen-card .lumen-episode__name{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.2;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
css.push('.lumen-card .lumen-episode__caption{font-family:' + FB + ';font-size:1.01em;line-height:1;color:' + P.muted + ';margin-top:.31em;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
css.push('.lumen-card .lumen-episode__bar{height:.18em;border-radius:.09em;background:rgba(' + P.textRgb + ',.16);margin-top:.44em;overflow:hidden}');










css.push('.lumen-card .lumen-episode--cut .lumen-episode__top,.lumen-card .lumen-episode--cut .lumen-episode__bottom{background:none}');
css.push('.lumen-card .lumen-episode--cut .lumen-episode__top > *,.lumen-card .lumen-episode--cut .lumen-episode__bottom > *{display:none}');
css.push('.lumen-card .lumen-episode__bar > div{height:100%;border-radius:.09em;background:' + A + '}');


css.push('.lumen-card .lumen-episode--watched{opacity:.6}');
css.push('.lumen-card .lumen-episode--watching{background:' + P.gradWatching + ';border-color:#303552}');
css.push('.lumen-card .lumen-episode--watching .lumen-episode__num{color:' + A + '}');
css.push('.lumen-card .lumen-episode--watching .lumen-episode__caption{color:' + P.muted + '}');
css.push('.lumen-card .lumen-episode--soon{background:rgba(' + P.panelRgb + ',.35);border:.07em dashed ' + P.line + '}');
css.push('.lumen-card .lumen-episode--soon .lumen-episode__name{color:' + P.smoke + '}');
























css.push('.lumen-card .lumen-episode.focus{opacity:1;background:' + P.text + ';color:' + P.bg + ';border:.13em solid ' + P.text + ';-webkit-transform:scale(1.03);transform:scale(1.03);-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__still{opacity:1}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__bottom{background:' + P.text + '}');








css.push('.lumen-card .lumen-episode.focus .lumen-episode__name,.lumen-card .lumen-episode.focus .lumen-episode__caption,.lumen-card .lumen-episode.focus .lumen-episode__timecode{color:' + P.bg + '}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__bar{background:rgba(' + P.bgRgb + ',.2)}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__bar > div{background:' + P.bg + '}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__play{display:block;background:' + P.bg + '}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__play:before{background-color:' + P.text + '}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__check,.lumen-card .lumen-episode.focus .lumen-episode__percent{display:none}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__name{font-weight:600}');








css.push('.lumen-card .lumen-episode__state{display:none;font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1;letter-spacing:.07em;text-transform:uppercase;color:' + A + ';margin:0 auto 0 .26em}');
css.push('.lumen-card .lumen-episode__timecode{display:none;font-family:' + FB + ';font-size:1.01em;line-height:1;color:' + P.muted + ';margin-top:.31em;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
css.push('.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__state,.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__timecode{display:block}');
css.push('.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__caption{display:none}');

css.push(LC.icons.NO_MASK + '{.lumen-card .lumen-next-chip:before,.lumen-card .lumen-episode__check,.lumen-card .lumen-episode__play:before{display:none}}');





































css.push('.lumen-descr-row > .items-line__head{display:none}');




























css.push('.lumen-descr-row .full-descr{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:start;-webkit-align-items:flex-start;align-items:flex-start;-webkit-flex-wrap:wrap;flex-wrap:wrap;padding-left:' + EDGE + 'em;padding-right:' + EDGE + 'em}');









css.push('.lumen-descr-row .full-descr__left{-webkit-box-flex:1;-webkit-flex:1 1 42.96em;flex:1 1 42.96em;max-width:42.96em;min-width:0;margin-right:3.51em}');



































































css.push('.lumen-descr-row .full-descr__text{-webkit-box-sizing:border-box;box-sizing:border-box;font-family:' + FB + ';font-weight:500;font-size:1.27em;line-height:1.24;color:' + P.text + ';max-width:35.56em;width:auto;display:-webkit-box;-webkit-line-clamp:9;-webkit-box-orient:vertical;overflow:hidden;max-height:70vh;padding:.62em .83em 0;border-bottom:.62em solid transparent;border-radius:.48em;background:' + P.plate + ';-webkit-mask-image:none;mask-image:none}');
css.push('.lumen-descr-row .full-descr__details{display:none}');





















css.push('.lumen-descr-row .lumen-facts{-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-box-flex:1;-webkit-flex:1 1 19.73em;flex:1 1 19.73em;min-width:19.73em;max-width:100%;padding:.79em 1.05em;border-radius:.61em;background:' + P.plate + ';border:.04em solid ' + P.line + '}');

css.push('.lumen-descr-row .lumen-facts__title{font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1;letter-spacing:.11em;color:' + P.muted + ';margin-bottom:.62em}');












css.push('.lumen-descr-row .lumen-facts__grid{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;display:grid;grid-template-columns:auto 1fr;grid-row-gap:.35em;grid-column-gap:1.05em;row-gap:.35em;column-gap:1.05em}');






css.push('.lumen-descr-row .lumen-facts__label{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.3;color:' + P.muted + ';white-space:nowrap}');
css.push('.lumen-descr-row .lumen-facts__value{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.3;color:' + P.text + ';min-width:0;word-wrap:break-word;overflow-wrap:break-word}');




css.push('@supports not (display:grid){.lumen-descr-row .lumen-facts__label{width:6.3em;margin:0 1.2em .5em 0}.lumen-descr-row .lumen-facts__value{-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;min-width:0;margin-bottom:.5em}}');








css.push('.lumen-descr-row .lumen-reviews{width:100%;-webkit-flex-basis:100%;flex-basis:100%;margin-top:1.75em}');
















css.push('.lumen-descr-row.lumen-descr-row--reviews .full-descr__text{-webkit-mask-image:-webkit-linear-gradient(top,#000 86%,rgba(0,0,0,0) 100%);-webkit-mask-image:linear-gradient(180deg,#000 86%,rgba(0,0,0,0) 100%);mask-image:linear-gradient(180deg,#000 86%,rgba(0,0,0,0) 100%)}');























css.push('.lumen-descr-row .lumen-descr-more{display:block;font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.3;color:' + P.muted + ';margin:.38em 0 0 .83em}');

































var personStepEm = (screenEm() - PERSON_LEFT - PERSON_PEEK) /
Math.max(1, Math.round((screenEm() - PERSON_LEFT - PERSON_PEEK) / (PERSON_TARGET + PERSON_GAP)));
css.push('body .items-line .full-person{width:' + round2((personStepEm - PERSON_GAP) / PERSON_ZOOM) + 'em}');



css.push('body .items-line .full-person__body{-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;min-width:0;overflow:hidden}');
css.push('body .items-line .full-person__name,body .items-line .full-person__role{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');






css.push('.lumen-descr-row .lumen-reviews__head{display:-webkit-inline-box;display:-webkit-inline-flex;display:inline-flex;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-sizing:border-box;box-sizing:border-box;max-width:100%;margin:0 0 .79em -.7em;padding:.44em .7em;border-radius:.61em;background:' + P.plate + '}');


css.push('.lumen-descr-row .lumen-reviews__ico{width:1.05em;height:1.05em;-webkit-flex-shrink:0;flex-shrink:0;background-color:' + P.muted + ';-webkit-mask-image:' + LC.icons.maskUrl('comment') + ';mask-image:' + LC.icons.maskUrl('comment') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-right:.44em;-webkit-align-self:center;align-self:center}');
css.push('.lumen-descr-row .lumen-reviews__title{font-family:' + FB + ';font-weight:700;font-size:1.40em;line-height:1;color:' + P.text + ';margin-right:.61em}');







css.push('.lumen-descr-row .lumen-reviews__src{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1;color:' + P.muted + ';margin-right:.3em}');






css.push('.lumen-descr-row .lumen-reviews__total{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1;color:' + P.muted + '}');









css.push('.lumen-descr-row .lumen-reviews__row{display:-webkit-box;display:-webkit-flex;display:flex;overflow:hidden;padding:.3em .45em .5em;margin:0 -.45em}');




css.push('.lumen-descr-row .lumen-reviews__tail{-webkit-box-flex:0;-webkit-flex:none;flex:none;width:0}');























css.push('.lumen-descr-row .lumen-review{position:relative;-webkit-box-sizing:border-box;box-sizing:border-box;width:21.04em;height:13.3em;-webkit-box-flex:0;-webkit-flex:none;flex:none;margin-right:.88em;border-radius:.61em;overflow:hidden;background:' + P.plate + ';border:.04em solid ' + P.line + ';color:' + P.text + ';display:-webkit-box;display:-webkit-flex;display:flex}');


css.push('.lumen-descr-row .lumen-review__tone{width:.18em;-webkit-box-flex:0;-webkit-flex:none;flex:none;background:' + P.muted + '}');
css.push('.lumen-descr-row .lumen-review--good .lumen-review__tone{background:' + P.good + '}');
css.push('.lumen-descr-row .lumen-review--bad .lumen-review__tone{background:' + P.spice + '}');
css.push('.lumen-descr-row .lumen-review__body{-webkit-box-sizing:border-box;box-sizing:border-box;padding:.96em;min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column}');
css.push('.lumen-descr-row .lumen-review__top{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;margin-bottom:.53em}');







css.push('.lumen-descr-row .lumen-review__who{min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto}');



css.push('.lumen-descr-row .lumen-review__author{font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1.1;color:' + P.soft + ';margin-bottom:.22em;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;white-space:nowrap}');

















css.push('.lumen-descr-row .lumen-review__meta{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.2;color:' + P.muted + ';white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');




css.push('.lumen-descr-row .lumen-review__sep{margin:0 .32em}');

css.push('.lumen-descr-row .lumen-review__likes:before{content:"";display:inline-block;vertical-align:-.1em;width:1em;height:1em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('star') + ';mask-image:' + LC.icons.maskUrl('star') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-right:.26em}');
css.push('.lumen-descr-row .lumen-review__useful{display:none}');














css.push('.lumen-descr-row .lumen-review__title{-webkit-box-flex:0;-webkit-flex:none;flex:none;font-family:' + FB + ';font-weight:600;font-size:1.05em;line-height:1.25;max-height:1.25em;color:' + P.text + ';margin-bottom:.53em;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;white-space:nowrap}');






css.push('.lumen-descr-row .lumen-review__text{-webkit-box-flex:0;-webkit-flex:none;flex:none;font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.24;max-height:4.96em;color:' + P.soft + ';display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}');



css.push('.lumen-descr-row .lumen-review--spoiler .lumen-review__text{-webkit-line-clamp:3;max-height:3.72em}');







css.push('.lumen-descr-row .lumen-review.focus{background:' + P.text + ';color:' + P.bg + ';border-color:' + P.text + ';-webkit-transform:scale(1.03);transform:scale(1.03);-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');






css.push('.lumen-descr-row .lumen-review.focus .lumen-review__author,.lumen-descr-row .lumen-review.focus .lumen-review__title{color:' + P.bg + '}');
css.push('.lumen-descr-row .lumen-review.focus .lumen-review__text{color:rgba(' + P.bgRgb + ',.8)}');
css.push('.lumen-descr-row .lumen-review.focus .lumen-review__meta,.lumen-descr-row .lumen-review.focus .lumen-review__spoiler{color:rgba(' + P.bgRgb + ',.7)}');













css.push('.lumen-descr-row .lumen-review.focus .lumen-review__tone{background:rgba(' + P.bgRgb + ',.6)}');
css.push('.lumen-descr-row .lumen-review--good.focus .lumen-review__tone{background:' + P.goodDeep + '}');
css.push('.lumen-descr-row .lumen-review--bad.focus .lumen-review__tone{background:' + P.spice + '}');
















css.push('.lumen-card .full-review-add{border:.04em solid ' + P.line + ';border-radius:.61em;background:' + P.panel + '}');








css.push('body.lumen-motion-full .lumen-descr-row .lumen-review{-webkit-transition:-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:transform .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('body.lumen-motion-lite .lumen-descr-row .lumen-review.focus,body.lumen-motion-off .lumen-descr-row .lumen-review.focus{-webkit-transform:none;transform:none}');


css.push('.lumen-descr-row .lumen-reviews__hint{-webkit-box-sizing:border-box;box-sizing:border-box;max-width:28.06em;border-radius:.61em;background:' + P.gradHint + ';border:.04em solid ' + P.line + ';padding:1.40em}');
css.push('.lumen-descr-row .lumen-reviews__hint-ico{width:2.10em;height:2.10em;background-color:' + A + ';-webkit-mask-image:' + LC.icons.maskUrl('comment') + ';mask-image:' + LC.icons.maskUrl('comment') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-bottom:.70em}');
css.push('.lumen-descr-row .lumen-reviews__hint-title{font-family:' + FB + ';font-weight:700;font-size:1.23em;line-height:1.15;color:' + P.text + ';margin-bottom:.44em}');
css.push('.lumen-descr-row .lumen-reviews__hint-text{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.3;color:' + P.muted + ';margin-bottom:.70em}');



css.push('.lumen-descr-row .lumen-reviews__hint-path{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.3;color:' + A + '}');







css.push('.lumen-descr-row .lumen-reviews__hint-hide{display:-webkit-inline-box;display:-webkit-inline-flex;display:inline-flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:3.16em;padding:0 1.32em;margin-top:.70em;border-radius:.79em;border:.04em solid ' + P.line + ';background:' + P.buttonBg + ';font-family:' + FB + ';font-weight:600;font-size:1.01em;color:' + P.text + '}');

css.push('.lumen-descr-row .lumen-reviews__hint-hide.focus{background:' + P.text + ';color:' + P.bg + '}');






css.push('.lumen-review-modal{display:-webkit-box;display:-webkit-flex;display:flex;border-radius:.61em;overflow:hidden;background:' + P.gradPanel + ';border:.04em solid ' + P.line + ';color:' + P.text + '}');
css.push('.lumen-review-modal__tone{width:.18em;-webkit-box-flex:0;-webkit-flex:none;flex:none;background:' + P.muted + '}');
css.push('.lumen-review-modal--good .lumen-review-modal__tone{background:' + P.good + '}');
css.push('.lumen-review-modal--bad .lumen-review-modal__tone{background:' + P.spice + '}');
css.push('.lumen-review-modal__body{-webkit-box-sizing:border-box;box-sizing:border-box;padding:1.75em;min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto}');
css.push('.lumen-review-modal__top{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between}');

css.push('.lumen-review-modal__ava{-webkit-box-sizing:border-box;box-sizing:border-box;width:2.68em;height:2.68em;-webkit-box-flex:0;-webkit-flex:none;flex:none;border-radius:50%;background:' + P.bg + ';border:.05em solid ' + P.line + ';font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:2.59em;text-align:center;color:' + P.muted + ';margin-right:.61em}');
css.push('.lumen-review-modal__who{min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto}');
css.push('.lumen-review-modal__author{font-family:' + FB + ';font-weight:600;font-size:1.14em;line-height:1.1;margin-bottom:.26em}');


css.push('.lumen-review-modal__meta{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.2;color:' + P.muted + '}');




css.push('.lumen-review-modal__sep{margin:0 .4em}');
css.push('.lumen-review-modal__likes:before{content:"";display:inline-block;vertical-align:-.1em;width:1em;height:1em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('star') + ';mask-image:' + LC.icons.maskUrl('star') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-right:.33em}');

css.push('.lumen-review-modal__src{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1;color:' + P.muted + ';-webkit-box-flex:0;-webkit-flex:none;flex:none;margin-left:.61em}');
css.push('.lumen-review-modal__line{height:.04em;background:' + P.line + ';margin:.88em 0}');
css.push('.lumen-review-modal__title{font-family:' + FB + ';font-weight:700;font-size:1.58em;line-height:1.18;margin-bottom:.88em}');




css.push('.lumen-review-modal__text{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.4;color:' + P.soft + ';max-height:50vh;overflow:auto}');





css.push('.lumen-descr-modal{-webkit-box-sizing:border-box;box-sizing:border-box;padding:1.75em;border-radius:.61em;background:' + P.gradPanel + ';border:.04em solid ' + P.line + ';color:' + P.text + '}');
css.push('.lumen-descr-modal__text{font-family:' + FB + ';font-weight:500;font-size:1.27em;line-height:1.24;color:' + P.text + '}');










css.push('.lumen-descr-row .lumen-reviews__mode{display:inline-block;margin-left:.8em;padding:.34em .8em;border-radius:.5em;background:' + P.buttonBg + ';font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1.2;color:' + P.soft + ';white-space:nowrap}');








css.push('.lumen-descr-row .lumen-reviews__mode--on{color:' + P.text + '}');
css.push('.lumen-descr-row .lumen-reviews__mode--on:before{content:"";display:inline-block;vertical-align:-.14em;width:1em;height:1em;margin-right:.35em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('check') + ';mask-image:' + LC.icons.maskUrl('check') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');

css.push('.lumen-descr-row .lumen-reviews__mode.focus{background:' + P.text + ';color:' + P.bg + '}');





css.push('.lumen-descr-row .lumen-review__spoiler{-webkit-box-flex:0;-webkit-flex:none;flex:none;margin-top:auto;font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.2;color:' + P.muted + ';white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');









css.push('.lumen-descr-row .lumen-reviews--headlines .lumen-review{height:9.6em}');
css.push('.lumen-descr-row .lumen-reviews--headlines .lumen-review__title{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;max-height:2.5em}');




css.push('.lumen-review-modal .lumen-spoiler{border-radius:.26em;background:rgba(' + P.textRgb + ',.22);color:transparent}');
css.push('.lumen-review-modal--open .lumen-spoiler{background:rgba(' + A_RGB + ',.14);color:' + P.text + '}');
css.push('body.lumen-motion-full .lumen-review-modal .lumen-spoiler{-webkit-transition:color .2s,background-color .2s;transition:color .2s,background-color .2s}');


css.push('.lumen-review-modal__reveal{display:inline-block;margin-top:.86em;padding:.50em .79em;border-radius:.44em;background:' + P.buttonBg + ';border:.04em solid ' + P.line + ';font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1.3;color:' + P.text + '}');

css.push('.lumen-review-modal__reveal.focus{background:' + P.text + ';color:' + P.bg + '}');






css.push('.lumen-descr-row .lumen-fr{width:100%;-webkit-flex-basis:100%;flex-basis:100%;margin-top:1.75em}');
css.push('.lumen-descr-row .lumen-fr__head{display:-webkit-inline-box;display:-webkit-inline-flex;display:inline-flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-sizing:border-box;box-sizing:border-box;max-width:100%;margin:0 0 .79em -.7em;padding:.44em .7em;border-radius:.61em;background:' + P.plate + '}');
css.push('.lumen-descr-row .lumen-fr__ico{width:1.05em;height:1.05em;-webkit-flex-shrink:0;flex-shrink:0;background-color:' + P.muted + ';-webkit-mask-image:' + LC.icons.maskUrl('list') + ';mask-image:' + LC.icons.maskUrl('list') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-right:.44em}');
css.push('.lumen-descr-row .lumen-fr__title{font-family:' + FB + ';font-weight:700;font-size:1.40em;line-height:1;color:' + P.text + ';margin-right:.61em}');
css.push('.lumen-descr-row .lumen-fr__name{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1;letter-spacing:.05em;color:' + P.muted + ';margin-right:.69em}');
css.push('.lumen-descr-row .lumen-fr__modes{display:-webkit-box;display:-webkit-flex;display:flex}');












css.push('.lumen-descr-row .lumen-fr__mode{display:inline-block;padding:.34em .8em;margin-right:.44em;border-radius:.5em;background:' + P.buttonBg + ';font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1.2;color:' + P.soft + ';white-space:nowrap}');
css.push('.lumen-descr-row .lumen-fr__mode--on{color:' + P.text + '}');
css.push('.lumen-descr-row .lumen-fr__mode--on:before{content:"";display:inline-block;vertical-align:-.14em;width:1em;height:1em;margin-right:.35em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('check') + ';mask-image:' + LC.icons.maskUrl('check') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');
css.push('.lumen-descr-row .lumen-fr__mode.focus{background:' + P.text + ';color:' + P.bg + '}');





css.push('.lumen-descr-row .lumen-fr__row{display:-webkit-box;display:-webkit-flex;display:flex;overflow:hidden;padding:.26em 0}');
css.push('.lumen-descr-row .lumen-fr-card{position:relative;-webkit-box-sizing:border-box;box-sizing:border-box;width:7.90em;-webkit-box-flex:0;-webkit-flex:none;flex:none;margin-right:.88em;color:' + P.text + '}');
css.push('.lumen-descr-row .lumen-fr-card__poster{position:relative;width:100%;height:11.84em;border-radius:.53em;overflow:hidden;background-color:' + P.panel + ';-webkit-background-size:cover;background-size:cover;background-position:' + POSTER_ANCHOR + ';background-repeat:no-repeat;border:.04em solid ' + P.line + '}');


css.push('.lumen-descr-row .lumen-fr-card--watched .lumen-fr-card__poster{opacity:.45}');
css.push('.lumen-descr-row .lumen-fr-card__mark{position:absolute;top:.35em;right:.35em;width:1.32em;height:1.32em;border-radius:50%;background:' + P.bg + ';opacity:0}');
css.push('.lumen-descr-row .lumen-fr-card--watched .lumen-fr-card__mark{opacity:1;background-color:' + P.good + ';-webkit-mask-image:' + LC.icons.maskUrl('check') + ';mask-image:' + LC.icons.maskUrl('check') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:.88em}');
css.push('.lumen-descr-row .lumen-fr-card__num{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.2;letter-spacing:.04em;color:' + P.muted + ';margin-top:.32em}');
css.push('.lumen-descr-row .lumen-fr-card__name{font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1.2;color:' + P.text + ';margin-top:.20em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}');
css.push('.lumen-descr-row .lumen-fr-card__year{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.2;color:' + P.smoke + ';margin-top:.11em}');
css.push('.lumen-descr-row .lumen-fr-card__flag{display:inline-block;margin-top:.14em;padding:.09em .23em;border-radius:.18em;font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1.3;letter-spacing:.04em;background:' + P.buttonBg + ';color:' + P.muted + '}');
css.push('.lumen-descr-row .lumen-fr-card__flag--current{background:' + A + ';color:' + t.onac + '}');
css.push('.lumen-descr-row .lumen-fr-card__flag--next{background:rgba(' + A_RGB + ',.18);color:' + A + '}');
css.push('.lumen-descr-row .lumen-fr-card__flag--soon{color:' + P.spice + '}');
css.push('.lumen-descr-row .lumen-fr-card__flag--watched{color:' + P.good + '}');
css.push('.lumen-descr-row .lumen-fr-card.focus .lumen-fr-card__poster{border:.13em solid ' + A + ';-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');
css.push('.lumen-descr-row .lumen-fr-card.focus .lumen-fr-card__name{color:' + A + '}');
css.push('body.lumen-motion-full .lumen-descr-row .lumen-fr-card__poster{-webkit-transition:border-color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:border-color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('body.lumen-motion-full .lumen-descr-row .lumen-fr-card.focus .lumen-fr-card__poster{-webkit-transform:scale(1.04);transform:scale(1.04)}');


css.push('.lumen-descr-row .lumen-fr-card--sk{height:11.84em;border-radius:.53em}');

css.push(LC.icons.NO_MASK + '{.lumen-descr-row .lumen-reviews__ico,.lumen-descr-row .lumen-reviews__hint-ico,.lumen-descr-row .lumen-review__likes:before,.lumen-review-modal__likes:before,.lumen-descr-row .lumen-reviews__mode--on:before,.lumen-descr-row .lumen-fr__mode--on:before,.lumen-descr-row .lumen-fr__ico,.lumen-descr-row .lumen-fr-card__mark{display:none}}');




css.push(LC.icons.NO_MASK + '{.lumen-descr-row .lumen-review__useful{display:inline}.lumen-descr-row .lumen-reviews__mode--on,.lumen-descr-row .lumen-fr__mode--on{outline:.08em solid currentColor;outline-offset:-.2em}}');








































css.push('@media screen and (max-width:' + narrowWindowPx() + 'px){' +
'.lumen-card .full-start-new__title{font-size:2.5em;line-height:1.16}' +
'.lumen-card .full-start-new__title.lumen-title--long{font-size:2.11em;line-height:1.17}' +
'.lumen-card .lumen-logo{font-size:2.5em}' +
'.lumen-card .full-start-new__body{min-height:0}}');







css.push('.lumen-card.lumen-motion-full .lumen-in{opacity:0;-webkit-transform:translateY(1.05em);transform:translateY(1.05em);-webkit-animation:lumen-rise .7s cubic-bezier(.2,.8,.2,1) forwards;animation:lumen-rise .7s cubic-bezier(.2,.8,.2,1) forwards}');
css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(1){-webkit-animation-delay:.05s;animation-delay:.05s}');
css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(2){-webkit-animation-delay:.11s;animation-delay:.11s}');
css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(3){-webkit-animation-delay:.17s;animation-delay:.17s}');
css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(4){-webkit-animation-delay:.23s;animation-delay:.23s}');
css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(5){-webkit-animation-delay:.29s;animation-delay:.29s}');
css.push('@-webkit-keyframes lumen-rise{to{opacity:1;-webkit-transform:none}}');
css.push('@keyframes lumen-rise{to{opacity:1;transform:none}}');



css.push('.lumen-card.lumen-motion-lite .full-start__button{-webkit-transition:background-color .15s,color .15s;transition:background-color .15s,color .15s}');












css.push('.lumen-card.lumen-motion-lite .full-start-new__buttons .full-start__button.focus{-webkit-transform:none !important;transform:none !important}');





css.push('.lumen-card.lumen-motion-off .full-start__button,.lumen-card.lumen-motion-off .lumen-in{-webkit-transition:none !important;transition:none !important;-webkit-animation:none !important;animation:none !important;opacity:1 !important;-webkit-transform:none !important;transform:none !important}');





css.push('.lumen-card.lumen-motion-lite .full-start__button{-webkit-animation:none !important;animation:none !important}');




css.push('.lumen-card.lumen-motion-full .lumen-episode{-webkit-transition:border-color .2s,opacity .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:border-color .2s,opacity .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('.lumen-card.lumen-motion-full .lumen-episodes__track{-webkit-transition:-webkit-transform .4s cubic-bezier(.2,.8,.2,1);transition:transform .4s cubic-bezier(.2,.8,.2,1)}');
css.push('.lumen-card.lumen-motion-lite .lumen-episode.focus,.lumen-card.lumen-motion-off .lumen-episode.focus{-webkit-transform:none;transform:none}');









css.push('.lumen-card.lumen-motion-lite .lumen-stop.focus,.lumen-card.lumen-motion-off .lumen-stop.focus{-webkit-transform:none !important;transform:none !important}');





























css.push('body.lumen-fx-heavy .lumen-backdrop.lumen-motion-full .lumen-bg__img.is-active{-webkit-animation:lumen-kb 14s steps(280) forwards;animation:lumen-kb 14s steps(280) forwards}');
css.push('@-webkit-keyframes lumen-kb{from{-webkit-transform:scale(1)}to{-webkit-transform:scale(1.08)}}');
css.push('@keyframes lumen-kb{from{transform:scale(1)}to{transform:scale(1.08)}}');




















css.push('.lumen-card .full-start-new__title,.lumen-card .lumen-logo,.lumen-card .full-start-new__rate-line,.lumen-card .full-start-new__buttons{-webkit-transition:font-size .28s cubic-bezier(.2,.9,.3,1.25),margin-top .28s cubic-bezier(.2,.9,.3,1.25);transition:font-size .28s cubic-bezier(.2,.9,.3,1.25),margin-top .28s cubic-bezier(.2,.9,.3,1.25)}');




css.push('.lumen-card.lumen-compact .full-start-new__title{font-size:2.11em;line-height:1.17}');
css.push('.lumen-card.lumen-compact .lumen-logo{font-size:2.11em}');
css.push('.lumen-card.lumen-compact .full-start-new__rate-line{margin-top:.87em}');
css.push('.lumen-card.lumen-compact .full-start-new__buttons{margin-top:.95em}');


















css.push('.lumen-card .lumen-next-chip__short{display:none}');
css.push('.lumen-card.lumen-compact .lumen-next-chip__text{display:none}');
css.push('.lumen-card.lumen-compact .lumen-next-chip__short{display:block}');
css.push('.lumen-card.lumen-compact .lumen-status__label{display:none}');
css.push('.lumen-card.lumen-compact .lumen-status__short:not(:empty){display:block}');
css.push('.lumen-card.lumen-motion-lite .full-start-new__title,.lumen-card.lumen-motion-lite .lumen-logo,.lumen-card.lumen-motion-off .lumen-logo,.lumen-card.lumen-motion-lite .full-start-new__rate-line,.lumen-card.lumen-motion-lite .full-start-new__buttons,.lumen-card.lumen-motion-off .full-start-new__title,.lumen-card.lumen-motion-off .full-start-new__rate-line,.lumen-card.lumen-motion-off .full-start-new__buttons{-webkit-transition:none;transition:none}');





















css.push('.lumen-card .lumen-franchise{display:none;font-family:' + FB + ';font-weight:600;font-size:1em;height:3.16em;padding:0 1.32em;margin:1.40em .70em .6em 0;border-radius:.79em;border:.04em solid ' + P.line + ';background:' + P.buttonBg + ';color:' + P.text + ';white-space:nowrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;-webkit-transition:background-color .2s,border-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,border-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');





css.push('.lumen-card.lumen-card--franchise .lumen-franchise{display:-webkit-box;display:-webkit-flex;display:flex}');
css.push('.lumen-card.lumen-card--franchise .lumen-actions{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card.lumen-card--franchise .full-start-new__reactions,.lumen-card.lumen-card--franchise .lumen-episodes{-webkit-flex-basis:100%;flex-basis:100%;width:100%}');
css.push('.lumen-card .lumen-franchise__ico{-webkit-flex-shrink:0;flex-shrink:0;width:1.14em;height:1.14em;margin-right:.53em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('film') + ';mask-image:' + LC.icons.maskUrl('film') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');
css.push('.lumen-card .lumen-franchise span{font-size:1.05em;line-height:1}');





css.push('.lumen-card .lumen-franchise.focus{background:' + P.text + ';color:' + P.bg + ';-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');




css.push('.lumen-card.lumen-motion-lite .lumen-franchise.focus,.lumen-card.lumen-motion-off .lumen-franchise.focus{-webkit-transform:none !important;transform:none !important}');


css.push(LC.icons.NO_MASK + '{.lumen-card .lumen-franchise__ico{display:none}}');




css.push('.lumen-hub{padding:' + EDGE_Y + 'em ' + EDGE + 'em 3.5em ' + EDGE + 'em;color:' + P.text + '}');
css.push('.lumen-hub__head{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-bottom:1.4em}');



css.push('.lumen-hub__title{font-family:' + FB + ';font-weight:700;font-size:2.1em;line-height:1;margin-right:.6em}');
css.push('.lumen-hub__count{font-family:' + FB + ';font-weight:500;font-size:1.01em;color:' + P.muted + '}');












css.push('.lumen-hub__search{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-align-self:center;align-self:center;height:2.0em;padding:0 .91em;border-radius:1em;margin-left:auto;background:transparent;font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1;color:' + P.muted + ';white-space:nowrap;-webkit-transition:background-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('.lumen-hub__search .lumen-ico{-webkit-flex-shrink:0;flex-shrink:0;width:1.05em;height:1.05em;margin-right:.41em}');
css.push('.lumen-hub__search.focus{background:' + P.text + ';color:' + P.bg + ';-webkit-transform:scale(1.05);transform:scale(1.05)}');






css.push('.lumen-hub__roulette{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-align-self:center;align-self:center;height:2.0em;padding:0 .91em;border-radius:1em;margin-left:.27em;background:transparent;font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1;color:' + P.muted + ';white-space:nowrap;-webkit-transition:background-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('.lumen-hub__roulette .lumen-ico{-webkit-flex-shrink:0;flex-shrink:0;width:1.05em;height:1.05em;margin-right:.41em}');
css.push('.lumen-hub__roulette.focus{background:' + P.text + ';color:' + P.bg + ';-webkit-transform:scale(1.05);transform:scale(1.05)}');
css.push('.lumen-hub__empty{font-family:' + FB + ';font-size:1.05em;color:' + P.muted + ';padding:2em 0}');
css.push('.lumen-hub__chips{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-bottom:1.4em}');
css.push('.lumen-hub__tiles{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap}');







css.push('.lumen-hub .lumen-chip,.lumen-grid .lumen-chip{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:2.0em;padding:0 .91em;margin:0 .27em .48em 0;border-radius:1em;background:transparent;font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1;color:' + P.muted + ';white-space:nowrap;-webkit-transition:background-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');



css.push('.lumen-hub .lumen-chip.lumen-chip--on,.lumen-grid .lumen-chip.lumen-chip--on{background:rgba(' + P.textRgb + ',.14);color:' + P.text + '}');
css.push('.lumen-hub .lumen-chip.focus,.lumen-grid .lumen-chip.focus{background:' + P.text + ';color:' + P.bg + ';-webkit-transform:scale(1.05);transform:scale(1.05)}');
css.push('.lumen-hub.lumen-motion-lite .lumen-chip.focus,.lumen-hub.lumen-motion-off .lumen-chip.focus,.lumen-grid.lumen-motion-lite .lumen-chip.focus,.lumen-grid.lumen-motion-off .lumen-chip.focus,.lumen-hub.lumen-motion-lite .lumen-hub__search.focus,.lumen-hub.lumen-motion-off .lumen-hub__search.focus,.lumen-hub.lumen-motion-lite .lumen-hub__roulette.focus,.lumen-hub.lumen-motion-off .lumen-hub__roulette.focus{-webkit-transform:none;transform:none}');
css.push('.lumen-hub.lumen-motion-off .lumen-chip,.lumen-grid.lumen-motion-off .lumen-chip,.lumen-hub.lumen-motion-off .lumen-hub__search,.lumen-hub.lumen-motion-off .lumen-hub__roulette{-webkit-transition:none;transition:none}');





css.push('.lumen-hub__tiles .lumen-tile{position:relative;width:-webkit-calc((100% - ' + emCss(GRID_GAP * (TILE_COLS - 1)) + ') / ' + TILE_COLS + ');width:calc((100% - ' + emCss(GRID_GAP * (TILE_COLS - 1)) + ') / ' + TILE_COLS + ');margin:0 ' + emCss(GRID_GAP) + ' ' + emCss(GRID_GAP) + ' 0;border-radius:.6em;overflow:hidden;background:' + P.panel + ';-webkit-transition:-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:transform .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('.lumen-hub__tiles .lumen-tile:nth-child(4n){margin-right:0}');

css.push('.lumen-hub__tiles .lumen-tile:before{content:"";display:block;padding-top:56.25%}');









css.push('.lumen-hub .lumen-tile__media{position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden}');
css.push('.lumen-hub .lumen-tile__img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center 30%;opacity:0;-webkit-transition:opacity .25s;transition:opacity .25s}');


css.push('.lumen-hub .lumen-tile--filled .lumen-tile__img{opacity:1}');
css.push('.lumen-hub.lumen-motion-off .lumen-tile__img{-webkit-transition:none;transition:none}');


css.push('.lumen-hub .lumen-tile__scrim{position:absolute;top:0;left:0;right:0;bottom:0;background:-webkit-linear-gradient(bottom,rgba(' + P.bgRgb + ',.9) 0%,rgba(' + P.bgRgb + ',.35) 45%,rgba(' + P.bgRgb + ',0) 100%);background:linear-gradient(0deg,rgba(' + P.bgRgb + ',.9) 0%,rgba(' + P.bgRgb + ',.35) 45%,rgba(' + P.bgRgb + ',0) 100%)}');
css.push('.lumen-hub .lumen-tile__text{position:absolute;left:.88em;right:.88em;bottom:.7em}');


css.push('.lumen-hub .lumen-tile__title{font-family:' + FB + ';font-weight:700;font-size:1.15em;line-height:1.2;color:' + P.text + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
css.push('.lumen-hub .lumen-tile__sub{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1;color:' + P.muted + ';margin-top:.29em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
css.push('.lumen-hub .lumen-tile__nokey{display:none;position:absolute;top:.49em;right:.49em;font-family:' + FB + ';font-weight:500;font-size:1.01em;letter-spacing:.03em;color:' + P.text + ';background:rgba(' + P.bgRgb + ',.8);border:.04em solid rgba(' + P.textRgb + ',.3);border-radius:.14em;padding:.17em .31em}');
css.push('.lumen-hub .lumen-tile--nokey .lumen-tile__nokey{display:block}');




css.push('.lumen-hub .lumen-tile__season{position:absolute;top:.49em;left:.49em;font-family:' + FB + ';font-weight:500;font-size:1.01em;letter-spacing:.03em;color:' + t.onac + ';background:' + A + ';border-radius:.14em;padding:.17em .31em}');











css.push('.lumen-hub__tiles .lumen-tile.focus{-webkit-transform:scale(1.05);transform:scale(1.05);z-index:3;-webkit-box-shadow:0 .2em 0 rgba(0,0,0,.45);box-shadow:0 .2em 0 rgba(0,0,0,.45)}');





css.push('.lumen-hub.lumen-motion-lite .lumen-tile.focus,.lumen-hub.lumen-motion-off .lumen-tile.focus{-webkit-transform:none;transform:none;outline:.13em solid ' + AL + ';outline-offset:-.13em}');
css.push('.lumen-hub.lumen-motion-off .lumen-tile{-webkit-transition:none;transition:none}');




css.push('.lumen-grid{padding:' + EDGE_Y + 'em ' + EDGE + 'em 3.5em ' + EDGE + 'em;color:' + P.text + '}');
css.push('.lumen-grid__head{margin-bottom:1.05em}');
css.push('.lumen-grid__title{font-family:' + FB + ';font-weight:700;font-size:2.10em;line-height:1}');


css.push('.lumen-grid__sub{font-family:' + FB + ';font-weight:500;font-size:1.01em;color:' + P.muted + ';margin-top:.44em}');
css.push('.lumen-grid__sorts{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-bottom:1.4em}');






css.push('.lumen-grid .lumen-grid__roulette{margin-left:.91em}');
css.push('.lumen-grid .lumen-grid__roulette .lumen-ico{-webkit-flex-shrink:0;flex-shrink:0;width:1.05em;height:1.05em;margin-right:.41em}');
css.push('.lumen-grid__items{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap}');




css.push('.lumen-grid__items .lumen-gcard{-webkit-flex-shrink:0;flex-shrink:0;width:-webkit-calc((100% - ' + emCss(GRID_GAP * (GCARD_COLS - 1)) + ') / ' + GCARD_COLS + ');width:calc((100% - ' + emCss(GRID_GAP * (GCARD_COLS - 1)) + ') / ' + GCARD_COLS + ');margin:0 ' + emCss(GRID_GAP) + ' 1.4em 0;position:relative;-webkit-transition:-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:transform .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('.lumen-grid__items .lumen-gcard:nth-child(6n){margin-right:0}');
css.push('.lumen-grid .lumen-gcard .card__view{margin-bottom:.5em;border-radius:.31em;background-color:' + P.panel + '}');
css.push('.lumen-grid .lumen-gcard .card__img{border-radius:.31em;background-color:' + P.panelLo + '}');






css.push('.lumen-grid .lumen-gcard' + CARD_NOT_WIDE + ' .card__img{object-position:' + POSTER_ANCHOR + '}');
css.push('.lumen-grid .lumen-gcard .card__title{font-family:' + FB + ';font-weight:700;font-size:1.01em;line-height:1.15;color:' + P.text + '}');



css.push('.lumen-grid .lumen-gcard .card__age{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1;margin-top:.22em;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;color:' + P.muted + '}');















css.push('.lumen-grid .lumen-gcard.focus .card__view,.lumen-grid .lumen-gcard.hover .card__view{-webkit-animation:none !important;animation:none !important}');












css.push('.lumen-grid .card__quality,.lumen-grid .card__type{display:none}');
if (LC.badgesMode() !== 'off') css.push('.lumen-grid .card__vote{display:none}');































css.push('.lumen-grid__items .lumen-gcard.focus{-webkit-transform:scale(1.08);transform:scale(1.08);z-index:3}');
css.push('.lumen-grid .lumen-gcard.focus .card__view:after,.lumen-grid .lumen-gcard.hover .card__view:after{display:none}');
css.push('.lumen-grid .lumen-gcard.focus .card__view{-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');
css.push('.lumen-grid.lumen-motion-lite .lumen-gcard.focus,.lumen-grid.lumen-motion-off .lumen-gcard.focus{-webkit-transform:none;transform:none}');
css.push('.lumen-grid.lumen-motion-off .lumen-gcard{-webkit-transition:none;transition:none}');


css.push('.lumen-grid .lumen-gcard__bar{position:absolute;left:.53em;right:.53em;bottom:.53em;height:.18em;border-radius:.09em;background:rgba(' + P.textRgb + ',.2);overflow:hidden}');
css.push('.lumen-grid .lumen-gcard__bar > div{height:100%;border-radius:.09em;background:' + A + '}');
css.push('.lumen-grid__empty{padding:2em 0}');
css.push('.lumen-grid .lumen-grid__empty-text{font-family:' + FB + ';font-size:1.05em;color:' + P.muted + ';margin-bottom:1.05em;max-width:42.96em}');
css.push('.lumen-grid .lumen-grid__back{display:-webkit-inline-box;display:-webkit-inline-flex;display:inline-flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:3.16em;padding:0 1.32em;border-radius:.79em;border:.04em solid ' + P.line + ';background:' + P.buttonBg + ';font-family:' + FB + ';font-weight:600;font-size:1.01em;color:' + P.text + '}');

css.push('.lumen-grid .lumen-grid__back.focus{background:' + P.text + ';color:' + P.bg + '}');

css.push('.lumen-grid .lumen-grid__hide{margin-right:.79em}');





























var heroSize = heroSizeKey();
var heroVh = HERO_VH[heroSize];
var rowsTopVh = ROWS_TOP_VH[heroSize];
var heroShift = heroShiftVh(heroSize);
var textBottom = textBottomVh(heroSize);
var textShift = textShiftVh(heroSize);



var textPadL = round2(EDGE / TEXT_ZOOM);
var smallText = heroSmallText();
var EASE = ' .42s cubic-bezier(.2,.8,.2,1)';
















var AR = accentRules(P, t);
css.push(AR.main);
css.push(AR.screen);











































css.push('body.lumen-main-on:not(.ambience--enable) .background,body.lumen-card-on:not(.ambience--enable) .background{display:none}');













































css.push('.lumen-hero{position:absolute;top:-4em;left:0;right:0;height:' + heroVh + 'vh;overflow:hidden;pointer-events:none;-webkit-transform:translateY(0) translateZ(0);transform:translateY(0) translateZ(0);-webkit-backface-visibility:hidden;backface-visibility:hidden}');
css.push('.lumen-hero.lumen-hero--compact{-webkit-transform:translateY(-' + heroShift + 'vh) translateZ(0);transform:translateY(-' + heroShift + 'vh) translateZ(0)}');
css.push('.lumen-hero.lumen-motion-full{-webkit-transition:-webkit-transform' + EASE + ';transition:transform' + EASE + '}');




































css.push('.lumen-hero-stage{position:absolute;top:-4em;left:0;right:0;height:100vh;overflow:hidden;pointer-events:none}');
css.push('.lumen-hero-stage .lumen-hero__bg,.lumen-hero-stage .lumen-hero__lqip{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center 25%;opacity:0}');
css.push('.lumen-hero-stage .lumen-hero__bg.is-active,.lumen-hero-stage .lumen-hero__lqip.is-active{opacity:1}');






















css.push('.lumen-hero-stage.lumen-motion-full .lumen-hero__bg,.lumen-hero-stage.lumen-motion-full .lumen-hero__lqip{-webkit-transition:opacity .35s ease;transition:opacity .35s ease}');
css.push('body.lumen-fx-heavy .lumen-hero-stage.lumen-motion-full .lumen-hero__bg--b{-webkit-transition:opacity .4s ease-in-out;transition:opacity .4s ease-in-out}');
css.push('body.lumen-fx-heavy .lumen-hero-stage.lumen-motion-full .lumen-hero__bg--a{-webkit-transition:opacity 0s linear .4s;transition:opacity 0s linear .4s}');
css.push('body.lumen-fx-heavy .lumen-hero-stage.lumen-motion-full .lumen-hero__bg--a.is-active{-webkit-transition:none;transition:none}');





css.push('.lumen-hero-stage.lumen-motion-full .lumen-hero__bg--blur{-webkit-transform:scale(1.1);transform:scale(1.1)}');


































css.push('.lumen-hero-stage .lumen-hero__trailer{position:absolute;top:50%;left:50%;width:100vw;height:56.25vw;min-width:177.78vh;min-height:100vh;' +
'-webkit-transform:translate(-50%,-50%);transform:translate(-50%,-50%);overflow:hidden;opacity:0}');
css.push('.lumen-hero-stage.lumen-motion-full .lumen-hero__trailer{-webkit-transition:opacity 1s ease;transition:opacity 1s ease}');
css.push('.lumen-hero-stage .lumen-hero__trailer.is-live{opacity:1}');
css.push('.lumen-hero-stage .lumen-hero__trailer iframe{position:absolute;top:-10%;left:-10%;width:120%;height:120%;border:0;pointer-events:none}');
css.push('.lumen-hero-stage.lumen-hero-stage--trailer .lumen-hero__bg.is-active,.lumen-hero-stage.lumen-hero-stage--trailer .lumen-hero__lqip.is-active{opacity:.25}');





css.push('body .lumen-hero-stage.lumen-hero-stage--trailer.lumen-motion-full .lumen-hero__bg.is-active,body .lumen-hero-stage.lumen-hero-stage--trailer.lumen-motion-full .lumen-hero__lqip.is-active{-webkit-transition:none;transition:none}');
css.push('.lumen-hero.lumen-hero--trailer .lumen-hero__descr{display:none}');








css.push('.lumen-hero.lumen-hero--compact .lumen-fx{opacity:0}');
css.push('.lumen-hero.lumen-motion-full .lumen-fx{-webkit-transition:opacity .35s ease;transition:opacity .35s ease}');













css.push('.lumen-hero-stage .lumen-hero__scrim,.lumen-hero-stage .lumen-hero__floor{position:absolute;top:0;left:0;right:0;bottom:0}');
css.push(AR.scrim);
css.push(AR.scrimL);
css.push(AR.floor);
css.push('.lumen-hero-stage .lumen-hero__floor{top:-webkit-calc(' + floorTop(heroSize) + ');top:calc(' + floorTop(heroSize) + ');opacity:0}');
css.push('.lumen-main.lumen-rows-up .lumen-hero__floor{opacity:1}');
css.push('.lumen-hero-stage.lumen-motion-full .lumen-hero__floor{-webkit-transition:opacity' + EASE + ';transition:opacity' + EASE + '}');




















































var textPadR = round2(textPadL + TEXT_MAX_W);
var textOrigin = textPadL + 'em calc(100% - ' + textBottom + 'vh)';
css.push('.lumen-hero .lumen-hero__text{position:absolute;left:0;right:0;top:' + round2(HERO_HEAD_SAFE / TEXT_ZOOM) + 'em;bottom:0;' +
'padding:0 0 ' + textBottom + 'vh ' + textPadL + 'em;padding-right:-webkit-calc(100% - ' + textPadR + 'em);padding-right:calc(100% - ' + textPadR + 'em);' +
'font-size:' + TEXT_ZOOM + 'em;overflow:hidden;' +
'display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-box-direction:normal;-webkit-flex-direction:column;flex-direction:column;' +
'-webkit-box-pack:end;-webkit-justify-content:flex-end;justify-content:flex-end;' +
'-webkit-transform-origin:' + textPadL + 'em -webkit-calc(100% - ' + textBottom + 'vh);-webkit-transform-origin:' + textOrigin + ';transform-origin:' + textOrigin + ';' +
'-webkit-transform:translateY(0);transform:translateY(0)}');











var textScale = ') scale(' + TEXT_SCALE_COMPACT + ')';
css.push('.lumen-hero.lumen-hero--compact .lumen-hero__text{' +
'-webkit-transform:translateY(' + textShift + 'vh' + textScale + ';' +
'transform:translateY(' + textShift + 'vh' + textScale + '}');











css.push('.lumen-hero .lumen-hero__meta{font-family:' + FB + ';font-weight:500;font-size:.96em;line-height:1.24;color:' + P.soft + ';text-shadow:' + HERO_TEXT_SHADOW + ';margin-top:.3em}');




























css.push('.lumen-hero .lumen-hero__logo{display:none;width:37.84em;max-width:100%;height:4.4em;margin-top:.4em;-webkit-background-size:contain;background-size:contain;background-position:left bottom;background-repeat:no-repeat;-webkit-transform-origin:left bottom;transform-origin:left bottom;-webkit-transform:scale(' + (smallText ? LOGO_COMPACT : 1) + ');transform:scale(' + (smallText ? LOGO_COMPACT : 1) + ')}');
css.push('.lumen-hero.lumen-hero--logo .lumen-hero__logo{display:block}');








css.push('.lumen-hero .lumen-hero__logo.lumen-logo-white,.lumen-card .lumen-logo.lumen-logo-white{-webkit-filter:brightness(0) invert(1);filter:brightness(0) invert(1)}');























css.push('.lumen-hero .lumen-hero__title{font-family:' + FB + ';font-weight:700;font-size:3.4em;line-height:1.08;color:' + P.text + ';margin-top:.4em;height:1.29em;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;white-space:nowrap;text-overflow:ellipsis}');
css.push('.lumen-hero.lumen-hero--compact .lumen-hero__title{height:1.2em}');
css.push('.lumen-hero.lumen-hero--logo .lumen-hero__title{display:none}');
css.push('.lumen-hero .lumen-hero__descr{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-family:' + FB + ';font-weight:500;font-size:1.15em;line-height:1.24;color:' + P.soft + ';text-shadow:' + HERO_TEXT_SHADOW + ';max-width:' + DESCR_MAX_W + 'em;margin-top:.46em}');




css.push('.lumen-hero .lumen-hero__sk{display:none;height:.75em;border-radius:.37em;background:-webkit-linear-gradient(left,rgba(' + P.textRgb + ',.14),rgba(' + P.textRgb + ',.06));background:linear-gradient(90deg,rgba(' + P.textRgb + ',.14),rgba(' + P.textRgb + ',.06))}');
css.push('.lumen-hero.lumen-hero--pending .lumen-hero__sk--meta{display:block;width:14em;max-width:60%;margin-top:.4em}');



css.push('.lumen-hero.lumen-hero--pending.lumen-hero--nodescr .lumen-hero__sk--descr{display:block;width:' + round2(DESCR_MAX_W * 1.15) + 'em;max-width:100%;margin-top:.8em}');
css.push('.lumen-hero.lumen-hero--pending.lumen-hero--nodescr .lumen-hero__sk--short{display:block;width:26.3em;max-width:67%;margin-top:.4em}');








css.push('.lumen-hero .lumen-hero__chips{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
css.push('.lumen-hero .lumen-hero__status{display:none;font-family:' + FB + ';font-weight:600;font-size:.92em;line-height:1;color:' + A + ';background:rgba(' + A_RGB + ',.1);border-radius:.53em;padding:.4em .7em;margin-top:.45em}');
css.push('.lumen-hero.lumen-hero--status .lumen-hero__status{display:block}');













css.push('.lumen-hero.lumen-hero--compact .lumen-hero__logo{-webkit-transform:scale(' + LOGO_COMPACT + ');transform:scale(' + LOGO_COMPACT + ')}');


css.push('.lumen-hero.lumen-hero--compact .lumen-hero__descr,.lumen-hero.lumen-hero--compact .lumen-hero__sk--descr,.lumen-hero.lumen-hero--compact .lumen-hero__sk--short{display:none}');
if (smallText) {
css.push('.lumen-hero .lumen-hero__meta,.lumen-hero .lumen-hero__sk--meta{display:none}');






css.push('.lumen-hero .lumen-hero__descr,.lumen-hero .lumen-hero__sk--descr,.lumen-hero .lumen-hero__sk--short{display:none}');
}



















css.push('.lumen-hero.lumen-motion-full .lumen-hero__text{-webkit-transition:-webkit-transform' + EASE + ';transition:transform' + EASE + '}');
css.push('.lumen-hero.lumen-motion-full .lumen-hero__text > *{-webkit-transition:opacity .18s ease;transition:opacity .18s ease}');
css.push('.lumen-hero.lumen-motion-full .lumen-hero__text > .lumen-hero__logo{-webkit-transition:opacity .18s ease,-webkit-transform' + EASE + ';transition:opacity .18s ease,transform' + EASE + '}');
css.push('.lumen-hero.lumen-motion-full .lumen-hero__text.is-swapping > *{opacity:0}');






css.push('.lumen-hero.lumen-motion-full .lumen-hero__text.is-in > :not(.lumen-skeleton){-webkit-animation:lumen-hero-in' + EASE + ';animation:lumen-hero-in' + EASE + '}');
css.push('@-webkit-keyframes lumen-hero-in{from{opacity:0}to{opacity:1}}');
css.push('@keyframes lumen-hero-in{from{opacity:0}to{opacity:1}}');
css.push('.lumen-hero.lumen-motion-lite .lumen-hero__text,.lumen-hero.lumen-motion-off .lumen-hero__text{opacity:1;-webkit-transition:none;transition:none;-webkit-animation:none;animation:none}');















css.push('.lumen-moods{position:absolute;left:' + EDGE + 'em;right:' + EDGE + 'em;z-index:2;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap}');



css.push('.lumen-moods-on:not(.lumen-main) .lumen-moods{top:.53em}');
css.push('.lumen-moods-on:not(.lumen-main) .scroll.layer--wheight{margin-top:' + MOODS_BAR + 'em;height:-webkit-calc(100vh - ' + round2(LAMPA_HEAD + MOODS_BAR) + 'em) !important;height:calc(100vh - ' + round2(LAMPA_HEAD + MOODS_BAR) + 'em) !important}');






css.push('.lumen-mood-chip{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:2.14em;padding:0 .92em;margin:0 .46em .46em 0;border-radius:.46em;background:' + P.chipBg + ';font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1;color:' + P.muted + ';white-space:nowrap;cursor:default;-webkit-transition:background-color .2s,color .2s;transition:background-color .2s,color .2s}');
css.push('.lumen-mood-chip.focus{background:' + P.text + ';color:' + P.bg + '}');



css.push('body.lumen-motion-off .lumen-mood-chip,body.lumen-motion-lite .lumen-mood-chip{-webkit-transition:none;transition:none}');








































var rowsTop = round2(LAMPA_HEAD + LAMPA_ROW_PAD - ROWS_AIR);
var rowsArea = round2(LAMPA_ROW_PAD - ROWS_AIR);


































































var rowsMargin = rowsTopVh + 'vh - ' + rowsTop + 'em';
var rowsHeight = round2(100 - rowsTopVh) + 'vh + ' + rowsArea + 'em';
css.push('.lumen-main .scroll.layer--wheight{margin-top:-webkit-calc(' + rowsMargin + ');margin-top:calc(' + rowsMargin + ');' +
'height:-webkit-calc(' + rowsHeight + ') !important;height:calc(' + rowsHeight + ') !important;overflow:hidden;position:relative;' +
'-webkit-transform:translateY(' + ROWS_SHIFT_VH + 'vh) translateZ(0);transform:translateY(' + ROWS_SHIFT_VH + 'vh) translateZ(0);' +
'-webkit-backface-visibility:hidden;backface-visibility:hidden;' +
'-webkit-mask-image:none;mask-image:none}');
























css.push('.lumen-main .scroll.layer--wheight:after{content:"";position:absolute;top:0;left:0;right:0;height:2.5em;z-index:1;pointer-events:none;opacity:0}');
css.push(AR.fadeTop);
css.push('.lumen-main.lumen-rows-up .scroll.layer--wheight:after{opacity:1}');
css.push('body.lumen-motion-full .lumen-main .scroll.layer--wheight:after{-webkit-transition:opacity' + EASE + ';transition:opacity' + EASE + '}');














css.push('.lumen-main:after{content:"";position:absolute;left:0;right:0;bottom:0;height:2.5em;z-index:1;pointer-events:none}');
css.push(AR.fadeBot);





















css.push('.lumen-main.lumen-rows-up .scroll.layer--wheight{-webkit-transform:translateY(0) translateZ(0);transform:translateY(0) translateZ(0)}');
css.push('.lumen-main .lumen-hero.lumen-motion-full ~ .activity__body .scroll.layer--wheight{-webkit-transition:-webkit-transform' + EASE + ';transition:transform' + EASE + '}');





















if (!heroSmallText()) {
css.push('@media screen and (min-aspect-ratio:' + Math.max(DESCR_MIN_RATIO, textRatio(heroSize, textNeedEm(true))) + '/100){' +
'.lumen-hero .lumen-hero__descr,.lumen-hero .lumen-hero__sk--descr,.lumen-hero .lumen-hero__sk--short{display:none}}');
}


















var heroMinRatio = Math.max(HERO_MIN_RATIO, textRatio(heroSize, textNeedEm(false)));

heroOffAt = heroMinRatio;
var rowsFull ='{margin-top:0;height:-webkit-calc(100vh - ' + LAMPA_HEAD + 'em) !important;height:calc(100vh - ' + LAMPA_HEAD + 'em) !important;overflow:hidden;-webkit-transform:none;transform:none}';
css.push('@media screen and (min-aspect-ratio:' + heroMinRatio + '/100){' +
'.lumen-main .scroll.layer--wheight,.lumen-main.lumen-rows-up .scroll.layer--wheight' + rowsFull +
'.lumen-main .lumen-hero-stage,.lumen-main .lumen-hero{display:none}}');































































































































var ROW_FOCUS = 1.10;











var rowScale = rowScaleCap(heroSize);
var cardWEm = round2(ROW_CARD_W * rowScale);






var cardTitleEm = round2(TV_MIN * rowScale);
var cardAgeEm = round2(TV_MIN * rowScale);




var rowCapShort = !smallText;
var rowTitleEm = round2(ROW_TITLE_EM * rowScale);
var rowHeadGapEm = rowHeadGap(rowScale, cardWEm);
var narrowWEm = round2(ROW_CARD_NARROW * rowScale);
var narrowGapEm = rowHeadGap(rowScale, narrowWEm);
css.push('.lumen-main .card{width:' + cardWEm + 'em}');

























var narrowRatio = rowNarrowRatio(heroSize, rowBlockEm(cardWEm, rowTitleEm, rowHeadGapEm, cardTitleEm, rowCapAge(cardAgeEm)));
var narrowCss = narrowRatio < Math.max(HERO_MIN_RATIO, textRatio(heroSize, textNeedEm(false)))
? '@media screen and (min-aspect-ratio:' + narrowRatio + '/100){' +
'.lumen-main .card{width:' + narrowWEm + 'em}' +
'.lumen-main .card__title{font-size:' + TV_MIN + 'em}' +
'.lumen-main .card__age{font-size:' + TV_MIN + 'em}}'
: '';



css.push('.lumen-main .card{will-change:auto}');
css.push('.lumen-main .card__view{margin-bottom:' + CARD_VIEW_GAP + 'em;border-radius:.31em;-webkit-transform:scale(1);transform:scale(1);-webkit-transform-origin:center bottom;transform-origin:center bottom}');
css.push('.lumen-main .card__img{border-radius:.31em}');
css.push('.lumen-main .card' + CARD_NOT_WIDE + ' .card__img{object-position:' + POSTER_ANCHOR + '}');
css.push('.lumen-main .card.focus .card__view:after,.lumen-main .card.hover .card__view:after{display:none}');
css.push('.lumen-main .card.focus .card__view,.lumen-main .card.hover .card__view{-webkit-animation:none !important;animation:none !important}');
css.push('.lumen-main .card.focus .card__view{-webkit-transform:scale(' + ROW_FOCUS + ');transform:scale(' + ROW_FOCUS + ')}');








css.push('.lumen-main .card.focus{z-index:3}');











css.push('body.lumen-motion-full .lumen-main:not(.lumen-burst) .card__view{-webkit-transition:-webkit-transform .18s ease-out;transition:transform .18s ease-out}');
css.push('.lumen-main .card__quality,.lumen-main .card__type{display:none}');


















































css.push('.lumen-main .card.focus .card-watched{display:none}');












if (LC.badgesMode() !== 'off') css.push('.lumen-main .card__vote{display:none}');
css.push('.lumen-main .card__title{font-family:' + FB + ';font-weight:700;font-size:' + cardTitleEm + 'em;line-height:' + CARD_TITLE_LH + ';white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;color:' + P.muted + '}');
css.push('.lumen-main .card.focus .card__title{color:' + P.text + '}');






css.push('.lumen-main .card__age{font-family:' + FB + ';font-size:' + cardAgeEm + 'em;line-height:1;margin-top:' + CARD_AGE_GAP + 'em;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;color:' + P.muted + '}');
















if (rowCapShort) {
css.push('.lumen-main .card__age{display:none}');
css.push('@media screen and (min-aspect-ratio:' + heroMinRatio + '/100){.lumen-main .card__age{display:block}}');
}





















css.push('body.lumen-motion-full .lumen-main:not(.lumen-burst) .card__title,body.lumen-motion-full .lumen-main:not(.lumen-burst) .card__age{-webkit-transition:-webkit-transform .18s ease-out;transition:transform .18s ease-out}');





var focusShiftCss = 'body.lumen-motion-full .lumen-main .card.focus .card__title,body.lumen-motion-full .lumen-main .card.focus .card__age{-webkit-transform:translateY(' + CARD_FOCUS_SHIFT + 'em);transform:translateY(' + CARD_FOCUS_SHIFT + 'em)}';
css.push(rowCapShort ? '@media screen and (min-aspect-ratio:' + heroMinRatio + '/100){' + focusShiftCss + '}' : focusShiftCss);








css.push('.lumen-main .card__title,.lumen-main .card__age{-webkit-transform:none;transform:none}');




if (narrowCss) css.push(narrowCss);




































var fitW = narrowCss ? narrowWEm : cardWEm;
var fitGap = narrowCss ? narrowGapEm : rowHeadGapEm;
var fitCap = narrowCss ? TV_MIN : cardTitleEm;
var fitBlock = rowBlockEm(fitW, rowTitleEm, fitGap, fitCap, fitCap);


var fitCaptions = function (age) {
return CARD_VIEW_GAP + fitCap * CARD_TITLE_LH + CARD_AGE_GAP * age + age + CARD_FOCUS_SHIFT * age;
};
var rowFitCss = function (sel, lo, hi, tailVh, topEm, age) {
var x = Math.floor(tailVh / POSTER_RATIO * 100) / 100;
var y = Math.ceil(((topEm + rowTitleEm + fitGap + ROW_EDGE_AIR) / (POSTER_RATIO * cardK()) + fitCaptions(age) / POSTER_RATIO) * 100) / 100;
var w = x + 'vh - ' + y + 'em';
return '@media screen and (min-aspect-ratio:' + lo + '/1000)' + (hi ? ' and (max-aspect-ratio:' + hi + '/1000)' : '') + '{' +
sel + ' .card{width:-webkit-calc(' + w + ');width:calc(' + w + ')}}';
};
var fitHeroFrom = Math.floor(screenEm() * (100 - rowsTopVh) * 10 / (ROWS_AIR + rowBlockEm(fitW, rowTitleEm, fitGap, fitCap, rowCapAge(fitCap)) + ROW_EDGE_AIR));
if (fitHeroFrom < heroMinRatio * 10) {
css.push(rowFitCss('.lumen-main', fitHeroFrom, heroMinRatio * 10, 100 - rowsTopVh, ROWS_AIR, rowCapAge(fitCap)));
}
var fitOff = function (sel, topEm) {
var from = Math.max(heroMinRatio * 10, Math.floor(screenEm() * 1000 / (topEm + fitBlock + ROW_EDGE_AIR)));
css.push(rowFitCss(sel, from, 0, 100, topEm, fitCap));
};
fitOff('.lumen-main', LAMPA_HEAD + LAMPA_ROW_PAD);
css.push('.lumen-main .items-line__title{font-family:' + FB + ';font-weight:700;font-size:' + rowTitleEm + 'em}');








css.push('.lumen-main .items-line{padding-bottom:' + ROW_GAP + 'em}');


























































var rowTailVh = round2(100 - ROWS_TOP_VH[heroSize]);


var rowEdgeMedia = function (blockEm, lo, hi) {
var tailEm = round2(ROWS_AIR + blockEm);
var b = (tailEm + ROW_GAP) / screenEm();
var to = Math.min(hi * 10, Math.ceil(rowTailVh * 10 / b));
if (to <= lo * 10) return '';
var pad = rowTailVh + 'vh - ' + tailEm + 'em';
return '@media screen and ' + (lo > 0 ? '(min-aspect-ratio:' + lo + '/100) and ' : '') +
'(max-aspect-ratio:' + to + '/1000){' +
'.lumen-main .items-line{padding-bottom:-webkit-calc(' + pad + ');padding-bottom:calc(' + pad + ')}}';
};



var rowFlowWide = rowBlockEm(cardWEm, rowTitleEm, rowHeadGapEm, cardTitleEm, rowCapAge(cardAgeEm), true);
var rowFlowNarrow = rowBlockEm(narrowWEm, rowTitleEm, narrowGapEm, TV_MIN, rowCapAge(TV_MIN), true);
var rowEdgeWide = rowEdgeMedia(rowFlowWide, 0, narrowCss ? narrowRatio : heroMinRatio);
var rowEdgeNarrow = narrowCss ? rowEdgeMedia(rowFlowNarrow, narrowRatio, heroMinRatio) : '';
if (rowEdgeWide) css.push(rowEdgeWide);
if (rowEdgeNarrow) css.push(rowEdgeNarrow);









var rowOffBlock = round2(narrowCss ? rowBlockEm(narrowWEm, rowTitleEm, narrowGapEm, TV_MIN, TV_MIN, true) :
rowBlockEm(cardWEm, rowTitleEm, rowHeadGapEm, cardTitleEm, cardAgeEm, true));
var rowEdgeOff = function (sel, topEm) {
var headEm = round2(topEm + LAMPA_ROW_PAD + rowOffBlock);
var to = Math.ceil(screenEm() * 1000 / (headEm + ROW_GAP));
if (to <= heroMinRatio * 10) return '';
var pad = '100vh - ' + headEm + 'em';
return '@media screen and (min-aspect-ratio:' + heroMinRatio + '/100) and (max-aspect-ratio:' + to + '/1000){' +
sel + '{padding-bottom:-webkit-calc(' + pad + ');padding-bottom:calc(' + pad + ')}}';
};
var rowEdgeOffPlain = rowEdgeOff('.lumen-main .items-line', LAMPA_HEAD);
if (rowEdgeOffPlain) css.push(rowEdgeOffPlain);






css.push('.lumen-main .items-line__head{margin-bottom:' + rowHeadGapEm + 'em;padding-left:' + EDGE + 'em}');




if (narrowCss && narrowGapEm !== rowHeadGapEm) {
css.push('@media screen and (min-aspect-ratio:' + narrowRatio + '/100){.lumen-main .items-line__head{margin-bottom:' + narrowGapEm + 'em}}');
}























css.push('.lumen-main .items-line__more{display:none}');
css.push('.lumen-main .items-line .scroll__content{padding-left:' + EDGE + 'em}');



















css.push('.lumen-main .items-line .mapping--line > * + *{margin-left:1.75em}');




if (LC.accentScope() !== 'veil') css.push(AR.cardFocus);










css.push('.lumen-main .lumen-badge,.lumen-grid .lumen-badge{position:absolute;top:.24em;left:.24em;max-width:-webkit-calc(100% - .48em);max-width:calc(100% - .48em);font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1;letter-spacing:.01em;padding:.24em .36em;border-radius:.24em;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;color:' + t.onac + ';background:' + A + ';z-index:2}');



css.push('.lumen-main .lumen-badge--progress,.lumen-grid .lumen-badge--progress,.lumen-main .lumen-badge--custom,.lumen-grid .lumen-badge--custom{color:' + P.text + ';background:' + P.chipBg + ';border:.04em solid ' + P.line + '}');











css.push('.lumen-main .lumen-badge--custom,.lumen-grid .lumen-badge--custom{white-space:normal;line-height:1.15}');
css.push('.lumen-main .lumen-badge-bar{position:absolute;left:.4em;right:.4em;bottom:.4em;height:.18em;border-radius:.09em;background:rgba(' + P.textRgb + ',.2);overflow:hidden;z-index:2}');
css.push('.lumen-main .lumen-badge-bar > div{height:100%;border-radius:.09em;background:' + A + '}');






if (LC.badgesMode() === 'caption') {
css.push('.lumen-main .card__age .lumen-badge-cap,.lumen-grid .card__age .lumen-badge-cap{font-weight:600;color:' + A + '}');
}

















css.push('.lumen-skeleton{background:rgba(' + P.textRgb + ',.10);-webkit-animation:lumen-sk 1.4s ease-in-out 8.5;animation:lumen-sk 1.4s ease-in-out 8.5}');
css.push('@-webkit-keyframes lumen-sk{0%,100%{opacity:.5}50%{opacity:1}}');
css.push('@keyframes lumen-sk{0%,100%{opacity:.5}50%{opacity:1}}');
css.push('body.lumen-motion-lite .lumen-skeleton,body.lumen-motion-off .lumen-skeleton{-webkit-animation:none;animation:none;opacity:1}');







css.push('.lumen-descr-row .lumen-review.lumen-review--sk{background:rgba(' + P.textRgb + ',.10)}');


css.push('.lumen-hub .lumen-tile__media.lumen-skeleton{border-radius:.6em}');












css.push('.lumen-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:90;pointer-events:none;overflow:hidden}');
css.push('.lumen-overlay .lumen-overlay__img{position:absolute;-webkit-background-size:cover;background-size:cover;background-position:center;background-repeat:no-repeat;border-radius:.31em;-webkit-transform-origin:center center;transform-origin:center center;will-change:transform,opacity}');





css.push('.lumen-overlay .lumen-overlay__img.is-run{border-radius:0}');






































css.push('.lumen-roulette-screen{position:relative;height:100%;overflow:hidden}');




css.push('.lumen-roulette-screen>.scroll{position:relative}');



css.push('.lumen-roulette-screen.is-kadr>.scroll{-webkit-mask-image:none;mask-image:none}');
css.push('.lumen-roulette-screen .lumen-roulette__bg{position:absolute;top:-4em;right:0;bottom:0;left:0;background-position:center;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover;opacity:0;pointer-events:none}');







css.push('.lumen-roulette-screen .lumen-roulette__veil{position:absolute;top:-4em;right:0;bottom:0;left:0;opacity:0;pointer-events:none}');
css.push('.lumen-roulette-screen .lumen-roulette__veil--l{background:-webkit-linear-gradient(left,rgba(' + P.bgRgb + ',.85) 0%,rgba(' + P.bgRgb + ',.45) 30%,rgba(' + P.bgRgb + ',0) 65%);background:linear-gradient(90deg,rgba(' + P.bgRgb + ',.85) 0%,rgba(' + P.bgRgb + ',.45) 30%,rgba(' + P.bgRgb + ',0) 65%)}');
css.push('.lumen-roulette-screen .lumen-roulette__veil--b{background:-webkit-linear-gradient(bottom,' + P.bg + ' 0%,rgba(' + P.bgRgb + ',.92) 10%,rgba(' + P.bgRgb + ',.6) 24%,rgba(' + P.bgRgb + ',.25) 42%,rgba(' + P.bgRgb + ',0) 62%);background:linear-gradient(0deg,' + P.bg + ' 0%,rgba(' + P.bgRgb + ',.92) 10%,rgba(' + P.bgRgb + ',.6) 24%,rgba(' + P.bgRgb + ',.25) 42%,rgba(' + P.bgRgb + ',0) 62%)}');
css.push('.lumen-roulette-screen.is-kadr .lumen-roulette__bg,.lumen-roulette-screen.is-kadr .lumen-roulette__veil{opacity:1}');







css.push('.lumen-roulette{position:relative;min-height:100%;padding:0 ' + EDGE + 'em}');



css.push('.lumen-roulette-screen.is-kadr .lumen-roulette{height:100%;overflow:hidden}');
css.push('.lumen-roulette-screen.is-kadr .lumen-roulette__head,.lumen-roulette-screen.is-kadr .lumen-roulette__chipbox,.lumen-roulette-screen.is-kadr .lumen-roulette__stage,.lumen-roulette-screen.is-kadr .lumen-roulette__shelf{opacity:0}');





















css.push('.lumen-roulette .lumen-roulette__head{position:relative;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;padding-top:1.05em;margin-bottom:.88em}');
css.push('.lumen-roulette .lumen-roulette__title{font-family:' + FB + ';font-weight:700;font-size:2.1em;line-height:1.1;color:' + P.text + ';margin-right:1.05em}');
css.push('.lumen-roulette .lumen-roulette__media{display:-webkit-box;display:-webkit-flex;display:flex}');






var R_CHIP = P.chipBg.charAt(0) === '#' ? P.chipBg : 'rgba(' + P.textRgb + ',.08)';
css.push('.lumen-roulette .lumen-roulette__tab{height:2em;padding:0 .91em;margin-right:.50em;border-radius:.50em;background:' + R_CHIP + ';font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:2em;color:' + P.muted + '}');
css.push('.lumen-roulette .lumen-roulette__tab.is-on{color:' + P.text + ';background:rgba(' + P.textRgb + ',.22)}');
css.push('.lumen-roulette .lumen-roulette__tab.focus{background:' + P.text + ';color:' + P.bg + '}');
css.push('.lumen-roulette .lumen-roulette__filters{position:relative;display:-webkit-box;display:-webkit-flex;display:flex;margin-left:1.05em}');






css.push('.lumen-roulette .lumen-roulette__chipbox{position:relative;margin-bottom:.88em}');
css.push('.lumen-roulette .lumen-roulette__chips{position:relative;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:nowrap;flex-wrap:nowrap}');





css.push('.lumen-roulette .lumen-roulette__chip{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:2em;padding:0 .84em;margin:0 .50em 0 0;border-radius:.50em;background:' + R_CHIP + ';font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1;color:' + P.muted + ';white-space:nowrap;-webkit-flex-shrink:0;flex-shrink:0}');
css.push('.lumen-roulette .lumen-roulette__chip.lumen-chip--on{color:' + P.text + ';background:rgba(' + A_RGB + ',.14)}');
css.push('.lumen-roulette .lumen-roulette__chip.focus{background:' + P.text + ';color:' + P.bg + '}');

css.push('.lumen-roulette .lumen-roulette__stage{position:relative;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-box-direction:normal;-webkit-flex-direction:column;flex-direction:column;-webkit-box-align:center;-webkit-align-items:center;align-items:center;margin-top:.88em}');








































var roulRest = round2((LAMPA_HEAD + 2 * LAMPA_ROW_PAD) / scale + ROUL_REST_EM);
var reelMaxH = '100vh - ' + roulRest + 'em';
var reelMaxW = '66.67vh - ' + round2(roulRest * 2 / 3) + 'em';
var reelMax = 'max-height:-webkit-calc(' + reelMaxH + ');max-height:calc(' + reelMaxH + ');max-width:-webkit-calc(' + reelMaxW + ');max-width:calc(' + reelMaxW + ')';
css.push('.lumen-roulette .lumen-roulette__reel{width:28.67vh;height:43vh;' + reelMax + ';border-radius:.53em;overflow:hidden;background:' + P.panel + ';border:.04em solid ' + P.line + ';-webkit-flex-shrink:0;flex-shrink:0}');
css.push('.lumen-roulette .lumen-roulette__frame{width:100%;height:100%;background-position:' + POSTER_ANCHOR + ';background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover}');

















css.push('.lumen-roulette .lumen-roulette__reel{position:relative;z-index:1}');
css.push('.lumen-roulette .lumen-roulette__peek{display:none;position:absolute;top:0;left:50%;width:28.67vh;height:43vh;' + reelMax + ';border-radius:.53em;background-position:' + POSTER_ANCHOR + ';background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover;background-color:' + P.panel + '}');
css.push('.lumen-roulette .lumen-roulette__stage.is-stack .lumen-roulette__peek{display:block}');



css.push('.lumen-roulette .lumen-roulette__stage.is-stack .lumen-roulette__peek.is-off{display:none}');
css.push('.lumen-roulette .lumen-roulette__peek--1{opacity:.72;-webkit-transform:translate(-webkit-calc(-50% + .8em),.5em);-webkit-transform:translate(calc(-50% + .8em),.5em);transform:translate(calc(-50% + .8em),.5em)}');
css.push('.lumen-roulette .lumen-roulette__peek--2{opacity:.45;-webkit-transform:translate(-webkit-calc(-50% + 1.6em),1em);-webkit-transform:translate(calc(-50% + 1.6em),1em);transform:translate(calc(-50% + 1.6em),1em)}');






css.push('.lumen-roulette .lumen-roulette__count{display:none;margin:.70em 0 0;text-align:center}');
css.push('.lumen-roulette .lumen-roulette__stage.is-stack .lumen-roulette__count{display:block}');
css.push('.lumen-roulette .lumen-roulette__count-value{font-family:' + FB + ';font-weight:700;font-size:1.58em;line-height:1.1;color:' + P.text + '}');
css.push('.lumen-roulette .lumen-roulette__count-label{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.2;color:' + P.muted + '}');
css.push('body.lumen-motion-full .lumen-roulette .lumen-roulette__frame.is-step{-webkit-animation:lumen-roul-step .12s ease-out;animation:lumen-roul-step .12s ease-out}');
css.push('@-webkit-keyframes lumen-roul-step{from{-webkit-transform:translateY(12%)}to{-webkit-transform:translateY(0)}}');
css.push('@keyframes lumen-roul-step{from{transform:translateY(12%)}to{transform:translateY(0)}}');
css.push('.lumen-roulette .lumen-roulette__spin{position:relative;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:3.16em;padding:0 1.75em;margin:.88em 0 0;border-radius:1.58em;background:' + A + ';color:' + t.onac + ';font-family:' + FB + ';font-weight:700;font-size:1.05em;border:.04em solid transparent}');
css.push('.lumen-roulette .lumen-roulette__spin.focus{border-color:' + AL + ';border-width:.11em;-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');
css.push('.lumen-roulette .lumen-roulette__spin.is-busy{opacity:.7}');


























css.push('.lumen-roulette .lumen-roulette__result{position:relative;display:none;margin-top:1.05em;max-width:34em}');
css.push('.lumen-roulette .lumen-roulette__result.is-live{display:block}');
css.push('.lumen-roulette-screen.is-kadr .lumen-roulette__result{position:absolute;left:' + EDGE + 'em;bottom:' + EDGE_Y + 'em;margin-top:0}');
css.push('.lumen-roulette .lumen-roulette__rtitle{font-family:' + FB + ';font-weight:700;font-size:2.4em;line-height:1.15;color:' + P.text + '}');
css.push('.lumen-roulette .lumen-roulette__rmeta{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1;margin-top:.42em;color:' + P.muted + '}');
css.push('.lumen-roulette .lumen-roulette__actions{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-top:1.05em}');
css.push('.lumen-roulette .lumen-roulette__btn{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:2.33em;padding:0 1em;margin:0 .50em .50em 0;border-radius:1.17em;background:' + P.buttonBg + ';font-family:' + FB + ';font-weight:600;font-size:1.01em;color:' + P.text + '}');





css.push('.lumen-roulette .lumen-roulette__btn.focus{background:' + P.text + ';color:' + P.bg + ';-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');
css.push('.lumen-roulette .lumen-roulette__empty{font-family:' + FB + ';font-size:1.05em;color:' + P.muted + '}');


css.push('.lumen-menu-roulette .lumen-ico{width:1.5em;height:1.5em}');
















var ATV = '.lumen-roulette-screen.is-atv';
var atvRest = round2((LAMPA_HEAD + 2 * LAMPA_ROW_PAD) / scale + ATV_REST_EM);
var atvReelH = '100vh - ' + atvRest + 'em - ' + ATV_TILE_VH + 'vh';
var atvReelMax = 'max-height:-webkit-calc(' + atvReelH + ');max-height:calc(' + atvReelH + ');' +
'max-width:-webkit-calc((' + atvReelH + ') * 1.7778);max-width:calc((' + atvReelH + ') * 1.7778)';


css.push(ATV + '{background-color:' + P.bg + '}');
css.push(ATV + ' .lumen-roulette__bg{opacity:.6}');
css.push(ATV + ' .lumen-roulette__veil{opacity:1}');
css.push(ATV + '.is-kadr .lumen-roulette__bg{opacity:1}');



css.push(ATV + ':not(.is-kadr) .lumen-roulette__veil--l{background:-webkit-linear-gradient(left,rgba(' + P.bgRgb + ',.94) 0%,rgba(' + P.bgRgb + ',.78) 38%,rgba(' + P.bgRgb + ',.45) 70%,rgba(' + P.bgRgb + ',.3) 100%);background:linear-gradient(90deg,rgba(' + P.bgRgb + ',.94) 0%,rgba(' + P.bgRgb + ',.78) 38%,rgba(' + P.bgRgb + ',.45) 70%,rgba(' + P.bgRgb + ',.3) 100%)}');
css.push(ATV + ':not(.is-kadr) .lumen-roulette__veil--b{background:-webkit-linear-gradient(bottom,' + P.bg + ' 0%,rgba(' + P.bgRgb + ',.86) 26%,rgba(' + P.bgRgb + ',0) 58%);background:linear-gradient(0deg,' + P.bg + ' 0%,rgba(' + P.bgRgb + ',.86) 26%,rgba(' + P.bgRgb + ',0) 58%)}');



css.push(ATV + ' .lumen-roulette__title{font-size:2.3em;font-weight:700;letter-spacing:-.01em}');
css.push(ATV + ' .lumen-roulette__media{padding:.2em;border-radius:1.2em;background:' + R_CHIP + '}');
css.push(ATV + ' .lumen-roulette__tab{margin-right:0;border-radius:1em;background:transparent;color:' + P.muted + '}');
css.push(ATV + ' .lumen-roulette__tab.is-on{background:rgba(' + P.textRgb + ',.22);color:' + P.text + '}');
css.push(ATV + ' .lumen-roulette__tab.focus{background:' + P.text + ';color:' + P.bg + '}');
css.push(ATV + ' .lumen-roulette__chip{border-radius:1em;background:' + R_CHIP + ';color:' + P.muted + '}');
css.push(ATV + ' .lumen-roulette__chip.lumen-chip--on{background:rgba(' + P.textRgb + ',.22);color:' + P.text + '}');
css.push(ATV + ' .lumen-roulette__chip.focus{background:' + P.text + ';color:' + P.bg + '}');

css.push(ATV + ' .lumen-roulette__stage{-webkit-box-orient:horizontal;-webkit-flex-direction:row;flex-direction:row;-webkit-box-align:stretch;-webkit-align-items:stretch;align-items:stretch;margin-top:1.1em}');



css.push(ATV + ' .lumen-roulette__lead{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:end;-webkit-justify-content:flex-end;justify-content:flex-end;-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;min-width:0;margin-right:2.2em;overflow:hidden}');
css.push(ATV + ' .lumen-roulette__kicker{font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1.2;letter-spacing:.14em;text-transform:uppercase;color:' + P.muted + '}');
css.push(ATV + ' .lumen-roulette__kicker-n,' + ATV + ' .lumen-roulette__kicker-l{display:inline}');
css.push(ATV + ' .lumen-roulette__kicker-n{color:' + P.text + ';margin-right:.5em}');
css.push(ATV + ' .lumen-roulette__ltitle{font-family:' + FB + ';font-weight:700;font-size:2.5em;line-height:1.08;letter-spacing:-.01em;color:' + P.text + ';margin-top:.25em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}');
css.push(ATV + ' .lumen-roulette__lmeta{font-family:' + FB + ';font-weight:500;font-size:1.05em;line-height:1.2;color:' + P.muted + ';margin-top:.5em}');
css.push(ATV + ' .lumen-roulette__ldescr{font-family:' + FB + ';font-weight:400;font-size:1.05em;line-height:1.4;color:rgba(' + P.textRgb + ',.78);margin-top:.5em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}');
css.push(ATV + ' .lumen-roulette__ldescr:empty,' + ATV + ' .lumen-roulette__lmeta:empty{display:none}');





css.push(ATV + ' .lumen-roulette__spin{-webkit-align-self:flex-start;align-self:flex-start;-webkit-flex-shrink:0;flex-shrink:0;height:2.9em;padding:0 1.7em;margin:1.1em 0 0;border-radius:1.45em;border:0;background:' + P.buttonBg + ';color:' + P.text + ';font-weight:700}');
css.push(ATV + ' .lumen-roulette__spin.focus{border:0;background:' + P.text + ';color:' + P.bg + ';-webkit-transform:scale(1.06);transform:scale(1.06)}');



css.push(ATV + ' .lumen-roulette__reel{width:' + round2(ATV_REEL_VH * 16 / 9) + 'vh;height:' + ATV_REEL_VH + 'vh;' + atvReelMax + ';border-radius:.7em;border:.04em solid rgba(' + P.textRgb + ',.1)}');
css.push(ATV + ' .lumen-roulette__frame{background-position:center}');

css.push(ATV + ' .lumen-roulette__shelf{margin-top:1.2em}');
css.push(ATV + ' .lumen-roulette__shelf.is-empty{visibility:hidden}');
css.push(ATV + ' .lumen-roulette__shelf-title{font-family:' + FB + ';font-weight:700;font-size:1.05em;line-height:1.2;color:' + P.text + ';margin-bottom:.55em}');
css.push(ATV + ' .lumen-roulette__shelf-row{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:nowrap;flex-wrap:nowrap}');
css.push(ATV + ' .lumen-roulette__tile{-webkit-flex-shrink:0;flex-shrink:0;width:' + round2(ATV_TILE_VH * 16 / 9) + 'vh;margin-right:2.2vh}');
css.push(ATV + ' .lumen-roulette__tile-img{position:relative;width:100%;height:' + ATV_TILE_VH + 'vh;border-radius:.5em;overflow:hidden;background-color:' + P.panel + ';background-position:center;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover}');



css.push(ATV + ' .lumen-roulette__tile.has-logo .lumen-roulette__tile-img:after{content:"";position:absolute;left:0;right:0;bottom:0;height:62%;background:-webkit-linear-gradient(bottom,rgba(0,0,0,.62) 0%,rgba(0,0,0,0) 100%);background:linear-gradient(0deg,rgba(0,0,0,.62) 0%,rgba(0,0,0,0) 100%)}');
css.push(ATV + ' .lumen-roulette__tile-logo{position:absolute;z-index:1;left:7%;bottom:9%;width:62%;height:40%;background-position:left bottom;background-repeat:no-repeat;-webkit-background-size:contain;background-size:contain}');
css.push(ATV + ' .lumen-roulette__tile-name{font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1.3;color:' + P.muted + ';margin-top:.45em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');





css.push(ATV + ' .lumen-roulette__tile.focus .lumen-roulette__tile-img{outline:.14em solid ' + P.text + ';outline-offset:.1em;-webkit-box-shadow:0 .2em 0 rgba(0,0,0,.45);box-shadow:0 .2em 0 rgba(0,0,0,.45);-webkit-transform:scale(1.06);transform:scale(1.06)}');
css.push(ATV + ' .lumen-roulette__tile.focus .lumen-roulette__tile-name{color:' + P.text + '}');






css.push('.lumen-roulette.lumen-motion-full .lumen-roulette__tile-img{-webkit-transition:-webkit-transform .2s ease;transition:transform .2s ease}');
css.push(ATV + ' .lumen-roulette.lumen-motion-lite .lumen-roulette__tile.focus .lumen-roulette__tile-img,' + ATV + ' .lumen-roulette.lumen-motion-off .lumen-roulette__tile.focus .lumen-roulette__tile-img,' + ATV + ' .lumen-roulette.lumen-motion-lite .lumen-roulette__spin.focus,' + ATV + ' .lumen-roulette.lumen-motion-off .lumen-roulette__spin.focus{-webkit-transform:none;transform:none}');


css.push(ATV + ' .lumen-roulette__tile-logo.lumen-logo-white,' + ATV + ' .lumen-roulette__rlogo.lumen-logo-white{-webkit-filter:brightness(0) invert(1);filter:brightness(0) invert(1)}');

css.push(ATV + ' .lumen-roulette__result{max-width:40em}');
css.push(ATV + ' .lumen-roulette__rlogo{display:none;width:18em;height:5em;margin-bottom:.7em;background-position:left bottom;background-repeat:no-repeat;-webkit-background-size:contain;background-size:contain}');
css.push(ATV + ' .lumen-roulette__result.has-logo .lumen-roulette__rlogo{display:block}');
css.push(ATV + ' .lumen-roulette__result.has-logo .lumen-roulette__rtitle{display:none}');
css.push(ATV + ' .lumen-roulette__result.is-logo-wait .lumen-roulette__rtitle{visibility:hidden}');
css.push(ATV + ' .lumen-roulette__rtitle{font-weight:700;font-size:2.6em;line-height:1.08;letter-spacing:-.01em}');
css.push(ATV + ' .lumen-roulette__rmeta{font-size:1.05em}');
css.push(ATV + ' .lumen-roulette__rdescr{font-family:' + FB + ';font-weight:400;font-size:1.05em;line-height:1.4;color:rgba(' + P.textRgb + ',.82);margin-top:.55em;max-width:34em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}');
css.push(ATV + ' .lumen-roulette__btn{border-radius:1.2em;background:' + P.buttonBg + '}');
css.push(ATV + ' .lumen-roulette__btn.focus{background:' + P.text + ';color:' + P.bg + '}');









css.push('.lumen-ambient{position:fixed;top:0;left:0;right:0;bottom:0;z-index:95;overflow:hidden;pointer-events:none;background:' + P.bg + ';-webkit-animation:lumen-amb-in .8s ease both;animation:lumen-amb-in .8s ease both}');


css.push('.lumen-ambient.is-out{-webkit-animation:lumen-amb-out .4s ease both;animation:lumen-amb-out .4s ease both}');
css.push('@-webkit-keyframes lumen-amb-in{from{opacity:0}to{opacity:1}}');
css.push('@keyframes lumen-amb-in{from{opacity:0}to{opacity:1}}');
css.push('@-webkit-keyframes lumen-amb-out{from{opacity:1}to{opacity:0}}');
css.push('@keyframes lumen-amb-out{from{opacity:1}to{opacity:0}}');



css.push('.lumen-ambient .lumen-ambient__img{position:absolute;top:0;right:0;bottom:0;left:0;background-position:center;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover;opacity:0;-webkit-transition:opacity 2s ease-in-out;transition:opacity 2s ease-in-out}');
css.push('.lumen-ambient .lumen-ambient__img.is-active{opacity:1}');









css.push('body.lumen-fx-heavy.lumen-motion-full .lumen-ambient .lumen-ambient__img.is-active{-webkit-animation:lumen-amb-zoom 20s linear both;animation:lumen-amb-zoom 20s linear both}');
css.push('@-webkit-keyframes lumen-amb-zoom{from{-webkit-transform:scale(1)}to{-webkit-transform:scale(1.08)}}');
css.push('@keyframes lumen-amb-zoom{from{transform:scale(1)}to{transform:scale(1.08)}}');


css.push('.lumen-ambient .lumen-ambient__scrim{position:absolute;top:auto;right:0;bottom:0;left:0;height:40%;background:-webkit-linear-gradient(top,rgba(' + P.bgRgb + ',0) 0%,rgba(' + P.bgRgb + ',.82) 100%);background:linear-gradient(to bottom,rgba(' + P.bgRgb + ',0) 0%,rgba(' + P.bgRgb + ',.82) 100%)}');
css.push('.lumen-ambient .lumen-ambient__info{position:absolute;left:' + EDGE + 'em;bottom:' + EDGE_Y + 'em;right:14em;max-width:36em}');
css.push('.lumen-ambient .lumen-ambient__title{font-family:' + FB + ';font-weight:700;font-size:1.75em;line-height:1.15;color:' + P.text + ';white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');


css.push('.lumen-ambient .lumen-ambient__dots{display:-webkit-box;display:-webkit-flex;display:flex;margin-top:.88em}');
css.push('.lumen-ambient .lumen-ambient__dot{width:.35em;height:.35em;border-radius:50%;margin-right:.44em;background:rgba(' + P.textRgb + ',.28)}');
css.push('.lumen-ambient .lumen-ambient__dot.is-on{background:' + A + '}');


css.push('.lumen-ambient .lumen-ambient__clock{position:absolute;right:' + EDGE + 'em;bottom:' + EDGE_Y + 'em;font-family:' + FB + ';font-size:2.2em;line-height:1;letter-spacing:.04em;color:' + P.text + '}');






























css.push('.lumen-hud{position:fixed;top:.3em;left:.3em;z-index:99999;max-width:34em;padding:.2em .5em;font:.7em/1.4 Consolas,"Courier New",monospace;color:#0f0;background:rgba(0,0,0,.75);border-radius:.3em;pointer-events:none;white-space:normal;word-wrap:break-word;overflow-wrap:break-word}');














css.push('.lumen-minimap{position:fixed;right:' + EDGE + 'em;top:11.40em;width:13.15em;padding:1.05em .96em;border-radius:.53em;background:' + P.plate + ';border:.04em solid ' + P.line + ';z-index:80;pointer-events:none}');
css.push('.lumen-minimap .lumen-minimap__head{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1;letter-spacing:.12em;color:' + P.smoke + ';margin-bottom:.61em}');
css.push('.lumen-minimap .lumen-minimap__row{font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.15;color:' + P.smoke + ';min-height:1.76em;padding:.27em .53em;border-radius:.30em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}');


css.push('.lumen-minimap .lumen-minimap__row--on{background:rgba(' + A_RGB + ',.14);border-left:.16em solid ' + A + ';color:' + A + ';font-weight:600;padding-left:.37em}');





css.push('.lumen-jump{position:fixed;left:50%;bottom:' + EDGE_Y + 'em;-webkit-transform:translateX(-50%);transform:translateX(-50%);padding:.50em 1em;border-radius:.50em;background:' + P.plate + ';border:.04em solid ' + P.line + ';font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1;letter-spacing:.05em;color:' + P.text + ';z-index:80;pointer-events:none;white-space:nowrap}');



css.push('.lumen-menu-hub .lumen-ico{width:1.5em;height:1.5em}');
















if (LC.pref('lumen_flat', false)) {







css.push('.lumen-descr-row .lumen-facts{-webkit-flex-basis:100%;flex-basis:100%;max-width:100%;min-width:0;margin-top:.79em;padding:0;border-radius:0;background:none;border-color:transparent}');
css.push('.lumen-descr-row .lumen-facts__title{display:none}');
css.push('.lumen-descr-row .lumen-facts__grid{display:block}');
css.push('.lumen-descr-row .lumen-facts__label{display:inline;margin-right:.3em}');
css.push('.lumen-descr-row .lumen-facts__value{display:inline}');
css.push('.lumen-descr-row .lumen-facts__value + .lumen-facts__label:before{content:"\\00B7";margin-right:.3em;color:' + P.smoke + '}');









css.push('.lumen-descr-row .tag-count:not(.focus){background-color:transparent;padding-left:0;padding-right:0}');
css.push('.lumen-descr-row .tag-count:not(.focus) .tag-count__count{background-color:transparent;color:' + P.muted + ';padding-left:.3em;padding-right:0}');
























css.push('.lumen-card .lumen-episode{border-radius:.3em;background:none;background-color:' + P.panel + ';border-color:transparent}');







css.push('.lumen-descr-row .lumen-review{background:none;border-color:transparent;border-radius:.3em}');
css.push('.lumen-descr-row .lumen-reviews__head{background:none;padding-left:0;padding-right:0;margin-left:0}');





css.push('.lumen-grid .lumen-gcard .card__view{background-color:transparent}');
css.push('.lumen-grid .lumen-gcard .card__img{background-color:transparent}');
css.push('.lumen-hub__tiles .lumen-tile{background:none}');
}


css.push(LC.icons.css());

return css.join('\n');
};





var card_css_text = null;

LC.injectCss = function () {
try {
var el = document.getElementById(STYLE_ID);
if (!el) {
el = document.createElement('style');
el.id = STYLE_ID;
el.type = 'text/css';
(document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(el);
card_css_text = null;
}
var text = LC.buildCss();
if (text !== card_css_text) {
if ('styleSheet' in el && el.styleSheet) el.styleSheet.cssText = text;
else el.innerHTML = text;
card_css_text = text;
}


if (typeof LC.applyTorrentsPref === 'function') LC.applyTorrentsPref();







if (LC.accent && typeof LC.accent.restyle === 'function') LC.accent.restyle();
} catch (e) {
warn('css inject failed', e);
}
};






LC.removeCss = function () {
try {
var el = document.getElementById(STYLE_ID);
if (el && el.parentNode) el.parentNode.removeChild(el);
card_css_text = null;
} catch (e) {
warn('css remove failed', e);
}
};

LC.injectFonts = function () {
try {
var existing = document.getElementById(FONTS_ID);
if (!useFonts()) {
if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
return;
}





var href = LC.fontsUrl();
if (existing) {
if (existing.getAttribute('href') !== href) existing.setAttribute('href', href);
return;
}
var link = document.createElement('link');
link.id = FONTS_ID;
link.rel = 'stylesheet';
link.href = href;
(document.head || document.getElementsByTagName('head')[0]).appendChild(link);
} catch (e) {
warn('fonts inject failed', e);
}
};


/* ---- 35_cardinfo.js ---- */






LC.cardinfo = (function () {





var COUNTRY_NAMES = {
ru: {
US: 'США',
GB: 'Великобритания',
RU: 'Россия',
FR: 'Франция',
DE: 'Германия',
JP: 'Япония',
KR: 'Южная Корея',
CN: 'Китай',
CA: 'Канада',
AU: 'Австралия',
IT: 'Италия',
ES: 'Испания',
IN: 'Индия'
},
uk: {
US: 'США',
GB: 'Велика Британія',
RU: 'Росія',
FR: 'Франція',
DE: 'Німеччина',
JP: 'Японія',
KR: 'Південна Корея',
CN: 'Китай',
CA: 'Канада',
AU: 'Австралія',
IT: 'Італія',
ES: 'Іспанія',
IN: 'Індія'
}
};

function trim(str) {
return ('' + (str || '')).replace(/^\s+|\s+$/g, '');
}







function country(headText, productionCountries, lang) {
var text = trim(headText).replace(/^\d{4}\s*,?\s*/, '');
text = trim(text);
if (text) return text;

if (productionCountries && productionCountries.length) {
var first = productionCountries[0] || {};
var iso = first.iso_3166_1;
var names = COUNTRY_NAMES[lang || 'ru'];
if (iso && names && names[iso]) return names[iso];
return first.name || iso || '';
}
return '';
}


function creator(movie) {
if (movie && movie.created_by && movie.created_by.length && movie.created_by[0]) {
return movie.created_by[0].name || '';
}
return '';
}



function titleClass(title) {
return trim(title).length > 18 ? 'lumen-title--long' : '';
}











































var TITLE_SEP = /:\s|\s[—–-]\s/g;
var NUMBER_WORD = /^(\d+|[IVX]+)$/;


function wordCount(text) {
var parts = trim(text).split(/\s+/);
var n = 0;
for (var i = 0; i < parts.length; i++) {
if (parts[i] && !NUMBER_WORD.test(parts[i])) n++;
}
return n;
}

function titleParts(title) {
var t = trim(title);
if (t.length <= 18) return null;
var seps = [];
var m;
TITLE_SEP.lastIndex = 0;
while ((m = TITLE_SEP.exec(t))) {
seps.push({ at: m.index, len: m[0].length, colon: m[0].charAt(0) === ':' });
}
if (!seps.length) return null;
var cut = seps[0];
if (cut.colon && wordCount(t.slice(0, cut.at)) === 1) {
for (var i = 1; i < seps.length; i++) {
if (!seps[i].colon) { cut = seps[i]; break; }
}
}
var lead = trim(t.slice(0, cut.at));
var sub = trim(t.slice(cut.at + cut.len));
if (lead.length < 2 || !sub) return null;
if (wordCount(lead) === 1 && wordCount(sub) <= 1) return null;
return { lead: lead, sub: sub };
}




function statusKind(status) {
var s = trim(status).toLowerCase();
if (s === 'released') return 'good';
if (s === 'returning series') return 'accent';
if (s === 'planned' || s === 'in production' || s === 'post production') return 'soon';
return 'muted';
}




function qualityChips(q) {
q = trim(q);
if (!q) return [];
var raw = q.split(/[\s,\/]+/);
var out = [];
for (var i = 0; i < raw.length; i++) {
var tok = raw[i];
if (!tok) continue;
var up = tok.toUpperCase();
var mapped = up;
if (up.indexOf('BDRIP') !== -1 || up.indexOf('BLURAY') !== -1 || up.indexOf('BLU-RAY') !== -1) mapped = 'BD';
else if (up.indexOf('WEB-DL') !== -1 || up.indexOf('WEBDL') !== -1 || up.indexOf('WEBRIP') !== -1 || up === 'WEB') mapped = 'WEB';
var exists = false;
for (var j = 0; j < out.length; j++) { if (out[j] === mapped) { exists = true; break; } }
if (!exists) out.push(mapped);
}
return out;
}


function reactionsCount(reactions) {
if (!reactions || !reactions.length) return 0;
for (var i = 0; i < reactions.length; i++) {
if (reactions[i] && reactions[i].type === 'fire') return reactions[i].counter || 0;
}
return 0;
}











function imageUrl(path, size, tmdbImage, apiImg) {
path = '' + (path || '');
if (!path) return '';
var clean = path.charAt(0) === '/' ? path.slice(1) : path;
size = size || 'original';

if (typeof tmdbImage === 'function') {
try {
var url = tmdbImage('t/p/' + size + '/' + clean);
if (url) return url;
} catch (e) { }
}
if (typeof apiImg === 'function') {
try {
var url2 = apiImg(clean, size);
if (url2) return url2;
} catch (e2) { }
}
return '';
}




function isSerial(movie) {
return !!(movie.first_air_date || movie.number_of_seasons || movie.number_of_episodes || movie.name);
}




function genres(rawGenres, capitalizeFn) {
var out = [];
var cap = typeof capitalizeFn === 'function' ? capitalizeFn : function (s) { return s; };
try {
if (rawGenres && rawGenres.length) {
for (var i = 0; i < rawGenres.length && i < 3; i++) {
if (rawGenres[i] && rawGenres[i].name) out.push(cap(rawGenres[i].name));
}
}
} catch (e) { }
return out;
}




function pgText(parsed, domText) {
var pg = parsed ? ('' + parsed) : '';
if (!pg && domText) pg = '' + domText;
return pg;
}











function backdropPath(movie) {
movie = movie || {};
if (movie.backdrop_path) return movie.backdrop_path;

var backdrops = (movie.images && movie.images.backdrops) || [];
for (var i = 0; i < backdrops.length; i++) {
var b = backdrops[i];
if (b && b.file_path && !b.iso_639_1) return b.file_path;
}
return '';
}






function bgMode(movie) {
movie = movie || {};
if (backdropPath(movie)) return 'backdrop';
if (movie.poster_path) return 'poster';
return 'procedural';
}






function dayMonth(ymd, months) {
if (!months || months.length !== 12) return '';
var m = /^\d{4}-(\d{2})-(\d{2})/.exec('' + (ymd || ''));
if (!m) return '';
var month = parseInt(m[1], 10);
var day = parseInt(m[2], 10);
if (month < 1 || month > 12 || day < 1 || day > 31) return '';
return day + ' ' + months[month - 1];
}

function shortDate(ymd, months) {
return dayMonth(ymd, months);
}







function nextEpisode(nextToAir, now, words) {
if (!nextToAir || !words) return null;
var days = LC.util.daysUntil(nextToAir.air_date, now);
var date = dayMonth(nextToAir.air_date, words.months);
if (days === null || days < 0 || !date) return null;
var when;
if (days === 0) when = words.today;
else if (days === 1) when = words.tomorrow;
else when = date + ', ' + words.inDays + ' ' + days + ' ' + (words.daysWord ? words.daysWord(days) : '');





return { date: date, days: days, when: when, text: words.next + ' — ' + when };
}






function premiere(ymd, months) {
var m = /^(\d{4})/.exec('' + (ymd || ''));
if (!m) return '';
var day = dayMonth(ymd, months);
return day ? day + ' ' + m[1] : m[1];
}







function money(value) {
var n = Number(value);
if (!(n > 0)) return '';
var digits = '' + Math.floor(n);
var out = '';
for (var i = 0; i < digits.length; i++) {
if (i > 0 && (digits.length - i) % 3 === 0) out += ' ';
out += digits.charAt(i);
}
return '$ ' + out;
}
























function facts(movie, words) {
var out = [];
if (!movie || !words) return out;

function add(label, value) {
if (label && value) out.push({ label: label, value: value });
}

var serial = isSerial(movie);
var title = movie.title || movie.name || '';
var original = movie.original_title || movie.original_name || '';

add(words.original, original && original !== title ? original : '');
add(words.premiere, premiere(movie.release_date || movie.first_air_date, words.months));








if (serial) add(words.creator, creator(movie));
else add(words.budget, money(movie.budget));

return out;
}



function network(movie) {
if (!movie) return '';
var list = movie.networks && movie.networks.length ? movie.networks : movie.production_companies;
return (list && list.length && list[0] && list[0].name) || '';
}

return {
country: country,
creator: creator,
network: network,
facts: facts,
nextEpisode: nextEpisode,
shortDate: shortDate,
titleClass: titleClass,
titleParts: titleParts,
statusKind: statusKind,
qualityChips: qualityChips,
reactionsCount: reactionsCount,
imageUrl: imageUrl,
isSerial: isSerial,
genres: genres,
pgText: pgText,
bgMode: bgMode,
backdropPath: backdropPath
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.cardinfo;


/* ---- 40_template.js ---- */















LC.template = (function () {
function innerOf(html, cls) {
if (typeof html !== 'string' || !cls) return null;
var wordRe = new RegExp('(^|\\s)' + cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)');





function findTagClose(pos) {
var i = pos, quote = null, c;
for (; i < html.length; i++) {
c = html.charAt(i);
if (quote) { if (c === quote) quote = null; }
else if (c === '"' || c === '\'') quote = c;
else if (c === '>') return i;
}
return -1;
}

function classOf(tagText) {
var m = /class\s*=\s*"([^"]*)"/i.exec(tagText) || /class\s*=\s*'([^']*)'/i.exec(tagText);
return m ? m[1] : '';
}
















function readTag(i) {
var e, tagText, body, selfClosing;
if (html.slice(i, i + 4) === '<!--') {
e = html.indexOf('-->', i + 4);
return e === -1 ? null : { type: 'comment', next: e + 3 };
}
if (html.slice(i, i + 4) === '<div' && /[\s>\/]/.test(html.charAt(i + 4) || '>')) {
e = findTagClose(i);
if (e === -1) return null;
tagText = html.slice(i, e + 1);
body = tagText.slice(0, -1).replace(/\s+$/, '');
selfClosing = body.charAt(body.length - 1) === '/';
return { type: 'open', next: e + 1, cls: classOf(tagText), selfClosing: selfClosing };
}
if (html.slice(i, i + 5) === '</div' && /[\s>]/.test(html.charAt(i + 5) || '>')) {
e = findTagClose(i);
return e === -1 ? null : { type: 'close', next: e + 1 };
}
e = findTagClose(i);
return e === -1 ? null : { type: 'other', next: e + 1 };
}




var pos = html.indexOf('<'), tok, contentStart = -1;
while (pos !== -1) {
tok = readTag(pos);
if (!tok) return null;
if (tok.type === 'open' && wordRe.test(tok.cls)) {
if (tok.selfClosing) return '';
contentStart = tok.next;
break;
}
pos = html.indexOf('<', tok.next);
}
if (contentStart === -1) return null;










var depth = 1;
pos = html.indexOf('<', contentStart);
while (pos !== -1) {
tok = readTag(pos);
if (!tok) return null;
if (tok.type === 'open') {
if (!tok.selfClosing) depth++;
} else if (tok.type === 'close') {
depth--;
if (depth === 0) return html.slice(contentStart, pos);
}
pos = html.indexOf('<', tok.next);
}
return null;
}

function build(original) {
var buttons = innerOf(original, 'full-start-new__buttons');
var pool = innerOf(original, 'buttons--container');
if (buttons === null || pool === null) return null;
if (buttons.indexOf('button--play') === -1) return null;


















return '' +
'<div class="full-start-new lumen-card">' +
'<div class="full-start-new__body">' +
'<div class="full-start-new__left">' +
'<div class="full-start-new__poster">' +




'<img class="full-start-new__img full--poster" decoding="async" />' +
'</div>' +
'</div>' +
'<div class="full-start-new__right lumen-content">' +


'<div class="lumen-in">' +
'<div class="full-start-new__head"></div>' +
'<div class="lumen-meta"></div>' +
'<div class="full-start__pg hide"></div>' +
'</div>' +




'<div class="lumen-in">' +
'<div class="full-start-new__title">{title}</div>' +




'<div class="lumen-logo"></div>' +
'<div class="full-start-new__tagline full--tagline">{tagline}</div>' +
'</div>' +








'<div class="lumen-in">' +
'<div class="full-start-new__rate-line">' +
'<div class="full-start__rate rate--tmdb"><div>{rating}</div><div class="source--name">TMDB</div></div>' +
'<div class="full-start__rate rate--imdb hide"><div></div><div>IMDB</div></div>' +
'<div class="full-start__rate rate--kp hide"><div></div><div>KP</div></div>' +
'<div class="full-start__tag tag--episode hide"><div></div></div>' +
'<div class="full-start__status hide"></div>' +

'<div class="lumen-next-chip hide"><div class="lumen-next-chip__text"></div></div>' +
'<div class="lumen-reactions-chip hide"><div class="lumen-reactions-chip__value"></div><div class="lumen-reactions-chip__label"></div></div>' +
'<div class="lumen-tags">' +
'<div class="full-start__tag tag--quality hide"><div></div></div>' +
'</div>' +
'</div>' +
'</div>' +


'<div class="lumen-in lumen-progress hide">' +
'<span class="lumen-progress__label"></span>' +
'<div class="lumen-progress__bar"><div></div></div>' +
'<span class="lumen-progress__time"></span>' +
'</div>' +







'<div class="lumen-in lumen-actions">' +
'<div class="full-start-new__reactions"><div>#{reactions_none}</div></div>' +


'<div class="full-start-new__buttons">' + buttons +













'<div class="hide buttons--container">' + pool + '</div>' +
'</div>' +






'<div class="lumen-episodes hide">' +
'<div class="lumen-episodes__head"><div class="lumen-episodes__title"></div><div class="lumen-episodes__count"></div></div>' +
'<div class="lumen-episodes__viewport"><div class="lumen-episodes__track"></div></div>' +
'</div>' +
'</div>' +

'</div>' +
'<div class="lumen-keep">' +
'<div class="full-start__tag tag--year hide"><div></div></div>' +
'<div class="full-start__tag tag--time hide"><div></div></div>' +
'<div class="full-start-new__details"></div>' +
'<div class="is--serial hide"></div>' +
'</div>' +
'</div>' +
'</div>';
}





var REQUIRED = ['full-start-new__title', 'full-start-new__head', 'full--tagline', 'full-start-new__details',
'full-start-new__reactions', 'full-start-new__buttons', 'buttons--container', 'button--play', 'button--book',
'button--reaction', 'button--subscribe', 'button--options', 'rate--tmdb', 'rate--imdb', 'rate--kp',
'tag--year', 'tag--time', 'tag--quality', 'tag--episode', 'full-start__pg', 'full-start__status',
'is--serial', 'full--poster', 'full-start-new__poster'];

function assert(original, ours) {
var missingInOriginal = [], missingInOurs = [];
LC.util.each(REQUIRED, function (c) {
if (original.indexOf(c) === -1) missingInOriginal.push(c);
if (ours.indexOf(c) === -1) missingInOurs.push(c);
});
var keys = original.match(/#\{[a-z_]+\}/g) || [];
LC.util.each(keys, function (k) { if (ours.indexOf(k) === -1) missingInOurs.push(k); });
return { ok: missingInOurs.length === 0, missingInOurs: missingInOurs, missingInOriginal: missingInOriginal };
}

return { innerOf: innerOf, build: build, REQUIRED: REQUIRED, assert: assert };
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.template;


/* ---- 42_manifest.js ---- */




















LC.manifest = (function () {


var DEFAULT = {
version: 1,



groups: [
{ id: 'franchise', title: 'Франшизы',    i18n: { en: 'Franchises',  uk: 'Франшизи' } },
{ id: 'studio',    title: 'Студии',       i18n: { en: 'Studios',     uk: 'Студії' } },
{ id: 'service',   title: 'Сервисы',      i18n: { en: 'Services',    uk: 'Сервіси' } },
{ id: 'theme',     title: 'Темы',         i18n: { en: 'Themes',      uk: 'Теми' } },
{ id: 'country',   title: 'Страны',       i18n: { en: 'Countries',   uk: 'Країни' } },
{ id: 'era',       title: 'Эпохи',        i18n: { en: 'Eras',        uk: 'Епохи' } },
{ id: 'people',    title: 'Режиссёры',    i18n: { en: 'People',      uk: 'Режисери' } },
{ id: 'top',       title: 'Топ',          i18n: { en: 'Top',         uk: 'Топ' } },
{ id: 'kp',        title: 'Кинопоиск',   i18n: { en: 'Kinopoisk',   uk: 'Кінопошук' } },
{ id: 'mood',      title: 'Настроение',   i18n: { en: 'Mood',        uk: 'Настрій' } }
],



hubGroups: [
{ id: 'franchises', title: 'Франшизы',          i18n: { en: 'Franchises',        uk: 'Франшизи' },         groups: ['franchise'] },
{ id: 'studios',    title: 'Студии и сервисы',  i18n: { en: 'Studios & Services', uk: 'Студії та сервіси' }, groups: ['studio', 'service'] },
{ id: 'themes',     title: 'Темы',              i18n: { en: 'Themes',             uk: 'Теми' },              groups: ['theme'] },
{ id: 'countries',  title: 'Страны',            i18n: { en: 'Countries',          uk: 'Країни' },            groups: ['country'] },
{ id: 'eras',       title: 'Эпохи',             i18n: { en: 'Eras',               uk: 'Епохи' },             groups: ['era'] },
{ id: 'people',     title: 'Режиссёры',         i18n: { en: 'People',             uk: 'Режисери' },          groups: ['people'] },
{ id: 'tops',       title: 'Топ и Кинопоиск',  i18n: { en: 'Top & Kinopoisk',    uk: 'Топ та Кінопошук' }, groups: ['top', 'kp'] }
],



moods: [
{ id: 'friday', title: 'Пятничный вечер',  i18n: { en: 'Friday Evening',  uk: 'П\'ятничний вечір' },  sources: { movie: { type: 'discover', params: { genres: '28|12|35', sort_by: 'popularity.desc', filter: { 'vote_average.gte': 6.5, 'with_runtime.lte': 130 } } } } },
{ id: 'family', title: 'Семейный просмотр', i18n: { en: 'Family Viewing',  uk: 'Сімейний перегляд' }, sources: { movie: { type: 'discover', params: { genres: '10751|16', sort_by: 'popularity.desc', filter: { certification_country: 'US', 'certification.lte': 'PG' } } } } },
{ id: 'scary',  title: 'Страшное на ночь',  i18n: { en: 'Scary at Night',  uk: 'Страшне вночі' },    sources: { movie: { type: 'discover', params: { genres: 27, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 300 } } } } },
{ id: 'short',  title: '90 минут',           i18n: { en: '90 Minutes',      uk: '90 хвилин' },         sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { 'with_runtime.lte': 90, 'vote_count.gte': 200 } } } } }
],


home: [
'continue', 'because', 'new-episodes', 'soon',
'star-wars', 'xmas-comedy', 'netflix-comedy', 'apple-tv',
'kdrama', 'anime', 'kp-top250'
],
























collections: [






































































{
id: 'star-wars', title: 'Звёздные войны', group: 'franchise', icon: 'film',
sources: {
movie: { type: 'discover',   params: { companies: 1, genres: 878, sort_by: 'primary_release_date.asc', filter: { without_genres: '99,10770,35,10751', 'vote_count.gte': 200 } } },
tv:    { type: 'discover',   params: { companies: 1, genres: '10765|16', sort_by: 'popularity.desc', filter: { without_keywords: '211227,215470' } } }
}
},
{
id: 'harry-potter', title: 'Гарри Поттер', group: 'franchise', icon: 'film',
sources: {
movie: { type: 'collection', id: 1241 },
tv:    { type: 'discover',   params: { companies: '437,3268', sort_by: 'popularity.desc' } }
}
},
{
id: 'lotr', title: 'Властелин колец', group: 'franchise', icon: 'film',
sources: {
movie: { type: 'collection', id: 119 },
tv:    { type: 'discover',   params: { companies: '12,20580', sort_by: 'popularity.desc' } }
}
},
{
id: 'hobbit', title: 'Хоббит', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 121938 } }
},
{
id: 'john-wick', title: 'Джон Уик', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 404609 } }
},
{
id: 'mission-impossible', title: 'Миссия невыполнима', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 87359 } }
},
{
id: 'matrix', title: 'Матрица', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 2344 } }
},
{
id: 'terminator', title: 'Терминатор', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 528 } }
},





























{
id: 'mcu', title: 'Киновселенная Marvel', i18n: { en: 'Marvel Cinematic Universe', uk: 'Кіновсесвіт Marvel' }, group: 'franchise', icon: 'film',
sources: {
movie: { type: 'discover', params: { keywords: 180547, sort_by: 'primary_release_date.asc', filter: { without_genres: '99,16', 'with_runtime.gte': 40 } } },
tv:    { type: 'discover', params: { keywords: 180547, sort_by: 'popularity.desc', filter: { without_genres: '99,10763' } } }
}
},
{
id: 'avengers', title: 'Мстители', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 86311 } }
},
{
id: 'xmen', title: 'Люди Икс', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 748 } }
},





















{
id: 'dc-universe', title: 'Вселенная DC', i18n: { en: 'DC Universe', uk: 'Всесвіт DC' }, group: 'franchise', icon: 'film', cover: '/pcDc2WJAYGJTTvRSEIpRZwM3Ola.jpg',
sources: {
movie: { type: 'discover', params: { companies: '429|9993|128064|184898', sort_by: 'primary_release_date.asc', filter: { without_genres: '16,99,10770', 'vote_count.gte': 300 } } },
tv:    { type: 'discover', params: { companies: '429|9993|184898', sort_by: 'popularity.desc', filter: { without_genres: '99,10762,10751', 'vote_count.gte': 50 } } }
}
},
{
id: 'dark-knight', title: 'Тёмный рыцарь', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 263 } }
},
{
id: 'james-bond', title: 'Джеймс Бонд', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 645 } }
},
{
id: 'fast-furious', title: 'Форсаж', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 9485 } }
},
{
id: 'alien', title: 'Чужой', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 8091 } }
},
{
id: 'predator', title: 'Хищник', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 399 } }
},
{
id: 'jurassic-park', title: 'Парк Юрского периода', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 328 } }
},
{
id: 'indiana-jones', title: 'Индиана Джонс', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 84 } }
},
{
id: 'back-to-future', title: 'Назад в будущее', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 264 } }
},
{
id: 'rocky', title: 'Рокки', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 1575 } }
},
{
id: 'die-hard', title: 'Крепкий орешек', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 1570 } }
},
{
id: 'pirates-caribbean', title: 'Пираты Карибского моря', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 295 } }
},
{
id: 'transformers', title: 'Трансформеры', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 8650 } }
},
{
id: 'twilight', title: 'Сумерки. Сага', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 33514 } }
},
{
id: 'hunger-games', title: 'Голодные игры', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 131635 } }
},
{
id: 'dune', title: 'Дюна', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 726871 } }
},
{
id: 'shrek', title: 'Шрек', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 2150 } }
},
{
id: 'toy-story', title: 'История игрушек', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 10194 } }
},
{
id: 'despicable-me', title: 'Гадкий я', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 86066 } }
},
{
id: 'spiderman-mcu', title: 'Человек-паук', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 531241 } }
},
{
id: 'madagascar', title: 'Мадагаскар', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 14740 } }
},
{
id: 'ice-age', title: 'Ледниковый период', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 8354 } }
},
{
id: 'kingsman', title: 'Kingsman', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 391860 } }
},




{
id: 'pixar', title: 'Pixar', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 3, sort_by: 'popularity.desc' } } }
},
{
id: 'ghibli', title: 'Студия Гибли', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 10342, sort_by: 'popularity.desc' } } }
},
{
id: 'marvel', title: 'Marvel Studios', group: 'studio', cover: '/9wXPKruA6bWYk2co5ix6fH59Qr8.jpg',






sources: {
movie: { type: 'discover', params: { companies: 420, sort_by: 'popularity.desc' } },
tv:    { type: 'discover', params: { companies: 420, sort_by: 'popularity.desc', filter: { without_genres: '99' } } }
}
},
{
id: 'a24', title: 'A24', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 41077, sort_by: 'popularity.desc' } } }
},







{
id: 'dc', title: 'DC Studios', group: 'studio',
sources: {
movie: { type: 'discover', params: { companies: '128064|184898', sort_by: 'popularity.desc' } },
tv:    { type: 'discover', params: { companies: 184898, sort_by: 'popularity.desc', filter: { without_genres: '99', 'vote_count.gte': 10 } } }
}
},
{
id: 'lucasfilm', title: 'Lucasfilm', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 1, sort_by: 'popularity.desc' } } }
},


{
id: 'warner-bros', title: 'Warner Bros.', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 174, sort_by: 'popularity.desc' } } }
},
{
id: 'universal', title: 'Universal Pictures', group: 'studio', cover: '/kJMLPj5enrZti8udTVeULlM70mz.jpg',
sources: { movie: { type: 'discover', params: { companies: 33, sort_by: 'popularity.desc' } } }
},
{
id: 'paramount', title: 'Paramount Pictures', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 4, sort_by: 'popularity.desc' } } }
},
{
id: 'sony-pictures', title: 'Sony Pictures', group: 'studio', cover: '/rz3TAyd5kmiJmozp3GUbYeB5Kep.jpg',
sources: { movie: { type: 'discover', params: { companies: 5, sort_by: 'popularity.desc' } } }
},
{
id: 'dreamworks', title: 'DreamWorks Animation', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 521, sort_by: 'popularity.desc' } } }
},
{
id: 'illumination', title: 'Illumination', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 6704, sort_by: 'popularity.desc' } } }
},
{
id: 'blumhouse', title: 'Blumhouse', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 3172, sort_by: 'popularity.desc' } } }
},
{
id: 'legendary', title: 'Legendary Pictures', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 923, sort_by: 'popularity.desc' } } }
},
{
id: 'fox', title: '20th Century Studios', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 25, sort_by: 'popularity.desc' } } }
},
{
id: 'miramax', title: 'Miramax', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 14, sort_by: 'popularity.desc' } } }
},




{
id: 'netflix-comedy', title: 'Netflix: Комедии', group: 'service', badge: 'NETFLIX',
sources: {
tv:    { type: 'discover', params: { genres: 35, networks: 213, sort_by: 'popularity.desc' } },
movie: { type: 'discover', params: { genres: 35, watch_providers: 8, watch_region: 'US', sort_by: 'popularity.desc' } }
}
},
{
id: 'apple-tv', title: 'Apple TV+', group: 'service', badge: 'APPLE TV+',
sources: { tv: { type: 'discover', params: { networks: 2552, sort_by: 'popularity.desc' } } }
},
{
id: 'hbo-series', title: 'HBO', group: 'service', badge: 'HBO',
sources: { tv: { type: 'discover', params: { networks: 49, sort_by: 'popularity.desc' } } }
},
{
id: 'disney-series', title: 'Disney+', group: 'service', badge: 'DISNEY+',
sources: { tv: { type: 'discover', params: { networks: 2739, sort_by: 'popularity.desc' } } }
},
{
id: 'amazon-series', title: 'Amazon Prime', group: 'service', badge: 'PRIME',
sources: { tv: { type: 'discover', params: { networks: 1024, sort_by: 'popularity.desc' } } }
},
{
id: 'netflix-series', title: 'Netflix: Сериалы', group: 'service', badge: 'NETFLIX', cover: '/8zbAoryWbtH0DKdev8abFAjdufy.jpg',
sources: { tv: { type: 'discover', params: { networks: 213, sort_by: 'popularity.desc' } } }
},


{
id: 'hulu', title: 'Hulu', group: 'service', badge: 'HULU',
sources: { tv: { type: 'discover', params: { networks: 453, sort_by: 'popularity.desc' } } }
},
{
id: 'paramount-plus', title: 'Paramount+', group: 'service', badge: 'PARAMOUNT+',
sources: { tv: { type: 'discover', params: { networks: 4330, sort_by: 'popularity.desc' } } }
},




{
id: 'xmas-comedy', title: 'Рождественские комедии', group: 'theme', icon: 'star', season: [12, 1], cover: '/vaVaNrscmsG8CUKYxiwZGFNqGJo.jpg',
sources: { movie: { type: 'discover', params: { genres: 35, keywords: 207317, sort_by: 'popularity.desc' } } }
},




{
id: 'christmas', title: 'Рождественское кино', group: 'theme', icon: 'star', season: [12, 1], cover: '/y8Mabq84N0d5fm83CWb9Zkltkwr.jpg',
sources: { movie: { type: 'discover', params: { keywords: 207317, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
},
{
id: 'halloween', title: 'Хэллоуин', group: 'theme', icon: 'star', season: [9, 10, 11], cover: '/aRka9neADW1M0Zf9lF8kW2jEgXe.jpg',
sources: { movie: { type: 'discover', params: { genres: 27, keywords: 3335, sort_by: 'popularity.desc' } } }
},
{
id: 'comedy', title: 'Комедии', group: 'theme', cover: '/ubiu5Y7nP187ZFWUzjPj7Hgw6Go.jpg',
sources: { movie: { type: 'discover', params: { genres: 35, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } } }
},
{
id: 'superhero', title: 'Супергерои', group: 'theme', cover: '/IYUD7rAIXzBM91TT3Z5fILUS7n.jpg',
sources: {
movie: { type: 'discover', params: { keywords: 9715, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 300 } } },
tv:    { type: 'discover', params: { keywords: 9715, sort_by: 'popularity.desc', filter: { without_genres: '10762,10751', 'vote_count.gte': 200 } } }
}
},
{
id: 'horror-top', title: 'Хоррор', group: 'theme', cover: '/mmd1HnuvAzFc4iuVJcnBrhDNEKr.jpg',
sources: { movie: { type: 'discover', params: { genres: 27, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 300 } } } }
},
{
id: 'documentary', title: 'Документальное', group: 'theme', cover: '/e5NzCG9eoWTDABPIGeB362ztV9R.jpg',
sources: { movie: { type: 'discover', params: { genres: 99, sort_by: 'popularity.desc', filter: { without_genres: '35', 'vote_count.gte': 100 } } } }
},
{
id: 'thriller', title: 'Триллеры', group: 'theme', cover: '/lDJx0ZKbfYbGoe8mwWmVKSQr0ub.jpg',
sources: { movie: { type: 'discover', params: { genres: 53, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } } }
},



































{
id: 'space', title: 'Космос', group: 'theme', cover: '/vCkC4lHpJZNVUGzdWAF09UKK8by.jpg',
sources: { movie: { type: 'discover', params: { keywords: 9882, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'post-apocalyptic', title: 'Постапокалипсис', group: 'theme', cover: '/aTLq0TMKdsmIy1ZyFM1LfPs326d.jpg',
sources: {
movie: { type: 'discover', params: { keywords: '4458|359337', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } },
tv:    { type: 'discover', params: { keywords: '4458|359337', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } }
}
},
{
id: 'zombie', title: 'Зомби', group: 'theme', cover: '/qFKb25O9ROiGYt3GwtuXG5Lb2J.jpg',
sources: {
movie: { type: 'discover', params: { keywords: 12377, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } },
tv:    { type: 'discover', params: { keywords: 12377, sort_by: 'popularity.desc' } }
}
},
{
id: 'vampire', title: 'Вампиры', group: 'theme', cover: '/gmCqIGV0xcK7G47lj6OyVPcRelk.jpg',
sources: {
movie: { type: 'discover', params: { keywords: 3133, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } },
tv:    { type: 'discover', params: { keywords: 3133, sort_by: 'popularity.desc' } }
}
},
{
id: 'spy', title: 'Шпионы', group: 'theme', cover: '/mXFmGlMCgTIOyHaGmQG1Hb6Rv2m.jpg',
sources: { movie: { type: 'discover', params: { keywords: 470, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'heist', title: 'Ограбления', group: 'theme', cover: '/4CHlGJ9lUN97SsdUpMCA8pvvp1F.jpg',
sources: {
movie: { type: 'discover', params: { keywords: 10051, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } },
tv:    { type: 'discover', params: { keywords: 10051, sort_by: 'popularity.desc' } }
}
},
{
id: 'survival', title: 'Выживание', group: 'theme', cover: '/bdO24JwOiv1r0WV7VPyM1ZnI4Q.jpg',
sources: { movie: { type: 'discover', params: { keywords: 10349, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'sport', title: 'Спортивные драмы', group: 'theme', cover: '/n3UanIvmnBlH531pykuzNs4LbH6.jpg',
sources: { movie: { type: 'discover', params: { keywords: '6075|294708|333328', genres: 18, sort_by: 'popularity.desc', filter: { without_genres: '99,16', 'vote_count.gte': 200 } } } }
},
{
id: 'biopic', title: 'Байопики', group: 'theme', cover: '/9441r6izIG2t46C2W1XoKYVN1o.jpg',
sources: { movie: { type: 'discover', params: { keywords: '5565|360939', sort_by: 'popularity.desc', filter: { without_genres: '99', 'vote_count.gte': 200 } } } }
},
{
id: 'noir', title: 'Нуар', group: 'theme', cover: '/qlndzxlcXQj9scIwnN1hnQg9Uyg.jpg',
sources: { movie: { type: 'discover', params: { keywords: 9807, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'slasher', title: 'Слэшеры', group: 'theme', cover: '/vh7np635kDIcfO6x2Y9ElgLJsuI.jpg',
sources: { movie: { type: 'discover', params: { keywords: 12339, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
},
{
id: 'road-movie', title: 'Роуд-муви', group: 'theme', cover: '/lWXcaHFLmGrI9hl8uCCfIRiK4A4.jpg',
sources: { movie: { type: 'discover', params: { keywords: 167043, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
},
{
id: 'romcom', title: 'Романтические комедии', group: 'theme', cover: '/i8aIbji5vcPoHwcLBZYQSniGkAI.jpg',
sources: { movie: { type: 'discover', params: { genres: '35,10749', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } } }
},
{
id: 'psycho-thriller', title: 'Психологические триллеры', group: 'theme', cover: '/lavdyiJWciCJvyLG37ZOs6HJijg.jpg',
sources: { movie: { type: 'discover', params: { keywords: 12565, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 300 } } } }
},
{
id: 'anime-movies', title: 'Аниме-фильмы', group: 'theme', cover: '/jkwVCMIkN3j284EPIDIGnskTd69.jpg',
sources: { movie: { type: 'discover', params: { genres: 16, orig_lang: 'ja', sort_by: 'popularity.desc' } } }
},
{
id: 'fantasy', title: 'Фэнтези', group: 'theme', cover: '/amjiPGOiJVUCgddTgl4dVRauKgV.jpg',
sources: { movie: { type: 'discover', params: { genres: 14, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'scifi', title: 'Научная фантастика', group: 'theme', cover: '/qr7dUqleMRd0VgollazbmyP9XjI.jpg',
sources: { movie: { type: 'discover', params: { genres: 878, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'western', title: 'Вестерны', group: 'theme', cover: '/26SUDI2iKhZTIKcU4ZzezTH1G15.jpg',
sources: { movie: { type: 'discover', params: { genres: 37, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 200 } } } }
},
{
id: 'new-year', title: 'Новогоднее', group: 'theme', icon: 'star', season: [12, 1], cover: '/mTEYBOOnOJ6p5w9xsfMh39t7iPV.jpg',
sources: { movie: { type: 'discover', params: { keywords: '207317|252123|613', orig_lang: 'ru', sort_by: 'popularity.desc', filter: { without_genres: '27,53', 'vote_count.gte': 40 } } } }
},
{
id: 'war-movies', title: 'Военные фильмы', group: 'theme', cover: '/pNHv41t8Im8wlwgdzMK9I8WpuBZ.jpg',
sources: { movie: { type: 'discover', params: { genres: 10752, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 200 } } } }
},































{
id: 'war-may', title: 'Кино о войне', i18n: { en: 'War Films', uk: 'Кіно про війну' }, group: 'theme', icon: 'star', season: [5], cover: '/1uKHoFWyYJn060dpIXUCU7Wbc15.jpg',
sources: { movie: { type: 'discover', params: { genres: 10752, keywords: 1956, sort_by: 'popularity.desc', filter: { without_genres: '99', 'vote_count.gte': 300 } } } }
},
{
id: 'love-feb', title: 'Кино о любви', i18n: { en: 'Love Stories', uk: 'Кіно про кохання' }, group: 'theme', icon: 'star', season: [2], cover: '/xnHVX37XZEp33hhCbYlQFq7ux1J.jpg',
sources: { movie: { type: 'discover', params: { genres: '10749,18', sort_by: 'popularity.desc', filter: { without_genres: '99,16,27', 'vote_count.gte': 500 } } } }
},
{
id: 'musical', title: 'Мюзиклы', group: 'theme', cover: '/zpq404Sk7qQ7N4x3xOeNgp74GtU.jpg',
sources: { movie: { type: 'discover', params: { keywords: 4344, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'crime', title: 'Криминал', group: 'theme', cover: '/9pGM43a9VmXxwIxmhJoiDkcB2hT.jpg',
sources: { movie: { type: 'discover', params: { genres: 80, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 300 } } } }
},





























































{
id: 'action', title: 'Боевики', i18n: { en: 'Action', uk: 'Бойовики' }, group: 'theme', cover: '/3IzR3VhZAyhxVnuRRUHFLkfK4hT.jpg',
sources: { movie: { type: 'discover', params: { genres: 28, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 300 } } } }
},
{
id: 'animation', title: 'Мультфильмы', i18n: { en: 'Animated Films', uk: 'Мультфільми' }, group: 'theme', cover: '/pDMndR1yj7WHZmLTwzLxMu16xxD.jpg',
sources: { movie: { type: 'discover', params: { genres: '16,10751', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 300 } } } }
},
{
id: 'adult-animation', title: 'Мультфильмы для взрослых', i18n: { en: 'Adult Animation', uk: 'Мультфільми для дорослих' }, group: 'theme', cover: '/iFOkrSrJRwE27PwbyQeYLlMJXzw.jpg',
sources: {
movie: { type: 'discover', params: { keywords: 161919, sort_by: 'popularity.desc', filter: { without_keywords: '210024', 'vote_count.gte': 100 } } },
tv:    { type: 'discover', params: { keywords: 161919, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } }
}
},
{
id: 'true-story', title: 'По реальным событиям', i18n: { en: 'Based on a True Story', uk: 'За реальними подіями' }, group: 'theme', cover: '/dc8Sr1mCiyGXsdVcah3Ot9ff4w9.jpg',
sources: {
movie: { type: 'discover', params: { keywords: 9672, sort_by: 'popularity.desc', filter: { without_genres: '99,27', 'vote_count.gte': 300 } } },
tv:    { type: 'discover', params: { keywords: 9672, sort_by: 'popularity.desc', filter: { without_genres: '99', 'vote_count.gte': 100 } } }
}
},
{
id: 'time-travel', title: 'Путешествия во времени', i18n: { en: 'Time Travel', uk: 'Подорожі в часі' }, group: 'theme', cover: '/50mCQ4lhJFED6ugaSQsn78cC83f.jpg',
sources: {
movie: { type: 'discover', params: { keywords: '4379|10854', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } },
tv:    { type: 'discover', params: { keywords: '4379|10854', sort_by: 'popularity.desc', filter: { without_genres: '10762', 'vote_count.gte': 100 } } }
}
},
{
id: 'robots', title: 'Роботы и ИИ', i18n: { en: 'Robots & AI', uk: 'Роботи та ШІ' }, group: 'theme', cover: '/jFxxqdEQ9TkXQSytO7qM8wlwXL1.jpg',
sources: { movie: { type: 'discover', params: { keywords: '310|14544|803', genres: 878, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 300 } } } }
},
{
id: 'dystopia', title: 'Антиутопии', i18n: { en: 'Dystopias', uk: 'Антиутопії' }, group: 'theme', cover: '/gDLCap8mcJ32mNIZWTJyk2KyMLW.jpg',
sources: {
movie: { type: 'discover', params: { keywords: 4565, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } },
tv:    { type: 'discover', params: { keywords: 4565, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } }
}
},
{
id: 'disaster', title: 'Катастрофы', i18n: { en: 'Disaster Films', uk: 'Катастрофи' }, group: 'theme', cover: '/jCvkDqWWBrgxf9R3DrtJ6GpqXse.jpg',
sources: { movie: { type: 'discover', params: { keywords: '10617|5096', sort_by: 'popularity.desc', filter: { without_genres: '99,16', 'vote_count.gte': 300 } } } }
},
{
id: 'serial-killers', title: 'Маньяки', i18n: { en: 'Serial Killers', uk: 'Маніяки' }, group: 'theme', cover: '/p1PLSI5Nw2krGxD7X4ulul1tDAk.jpg',
sources: {
movie: { type: 'discover', params: { keywords: 10714, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 300 } } },
tv:    { type: 'discover', params: { keywords: 10714, sort_by: 'popularity.desc', filter: { without_genres: '16', 'vote_count.gte': 100 } } }
}
},
{
id: 'whodunit', title: 'Детективы', i18n: { en: 'Whodunits', uk: 'Детективи' }, group: 'theme', cover: '/fkdMSS93pFBzNW9OByNpi8i2UYg.jpg',
sources: {
movie: { type: 'discover', params: { keywords: '12570|207046', sort_by: 'popularity.desc', filter: { without_genres: '27', 'vote_count.gte': 200 } } },
tv:    { type: 'discover', params: { keywords: '12570|207046', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } }
}
},
{
id: 'mafia', title: 'Мафия и гангстеры', i18n: { en: 'Mafia & Gangsters', uk: 'Мафія та гангстери' }, group: 'theme', cover: '/ejdD20cdHNFAYAN2DlqPToXKyzx.jpg',
sources: {
movie: { type: 'discover', params: { keywords: '10391|3149|10291', genres: 80, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 300 } } },
tv:    { type: 'discover', params: { keywords: '10391|3149|10291', genres: 80, sort_by: 'popularity.desc', filter: { without_genres: '16', 'vote_count.gte': 50 } } }
}
},
{
id: 'prison', title: 'Тюрьма и побег', i18n: { en: 'Prison & Escape', uk: 'В\'язниця та втеча' }, group: 'theme', cover: '/zfbjgQE1uSd9wiPTX4VzsLi0rGG.jpg',
sources: {
movie: { type: 'discover', params: { keywords: '378|9777', genres: 18, sort_by: 'popularity.desc', filter: { without_genres: '16,35,10751,14', 'vote_count.gte': 300 } } },
tv:    { type: 'discover', params: { keywords: '378|9777', sort_by: 'popularity.desc', filter: { without_genres: '16,35', 'vote_count.gte': 100 } } }
}
},
{
id: 'martial-arts', title: 'Боевые искусства', i18n: { en: 'Martial Arts', uk: 'Бойові мистецтва' }, group: 'theme', cover: '/ylZ06kRUF2JKkrCG2E3qn5D9w8L.jpg',
sources: { movie: { type: 'discover', params: { keywords: '779|780', sort_by: 'popularity.desc', filter: { without_genres: '16', 'vote_count.gte': 300 } } } }
},
{
id: 'aliens', title: 'Инопланетяне', i18n: { en: 'Aliens', uk: 'Прибульці' }, group: 'theme', cover: '/2GzzMdmjWHxk4NG3MX36fEAE8He.jpg',
sources: {
movie: { type: 'discover', params: { keywords: '9951|14909', genres: 878, sort_by: 'popularity.desc', filter: { without_genres: '16,10751,35', without_keywords: '9715', 'vote_count.gte': 500 } } },
tv:    { type: 'discover', params: { keywords: '9951|14909', sort_by: 'popularity.desc', filter: { without_genres: '16,10762', without_keywords: '9715', 'vote_count.gte': 200 } } }
}
},
{
id: 'video-games', title: 'По мотивам игр', i18n: { en: 'Based on Video Games', uk: 'За мотивами ігор' }, group: 'theme', cover: '/q8eejQcg1bAqImEV8jh8RtBD4uH.jpg',
sources: {
movie: { type: 'discover', params: { keywords: 41645, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } },
tv:    { type: 'discover', params: { keywords: 41645, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 500 } } }
}
},




{
id: 'kdrama', title: 'Корейские дорамы', group: 'country',
sources: { tv: { type: 'discover', params: { genres: 18, sort_by: 'popularity.desc', filter: { with_origin_country: 'KR' } } } }
},
{
id: 'anime', title: 'Аниме', group: 'country',
sources: { tv: { type: 'discover', params: { genres: 16, orig_lang: 'ja', sort_by: 'popularity.desc' } } }
},
{
id: 'turkish', title: 'Турецкие сериалы', group: 'country',
sources: { tv: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'TR' } } } }
},
{
id: 'french', title: 'Французское кино', group: 'country',
sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { with_origin_country: 'FR', 'vote_count.gte': 100 } } } }
},
{
id: 'british', title: 'Британское ТВ', group: 'country', cover: '/hmLTIRtVyTHShJl2Wb8LHmvUgJm.jpg',
sources: {
tv:    { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'GB' } } },
movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'GB', 'vote_count.gte': 100 } } }
}
},
{
id: 'bollywood', title: 'Болливуд', group: 'country',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'IN', 'vote_count.gte': 50 } } } }
},
{
id: 'spanish', title: 'Испанские сериалы', group: 'country',
sources: { tv: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'ES' } } } }
},


{
id: 'japan-movies', title: 'Японское кино', group: 'country',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'JP', 'vote_count.gte': 100 } } } }
},
{
id: 'italy', title: 'Итальянское кино', group: 'country',
sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { with_origin_country: 'IT', 'vote_count.gte': 100 } } } }
},
{
id: 'russia', title: 'Российское кино', group: 'country',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'RU', 'vote_count.gte': 50 } } } }
},
{
id: 'nordic', title: 'Скандинавские сериалы', group: 'country',
sources: { tv: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'SE' } } } }
},
{
id: 'norway', title: 'Норвежские сериалы', group: 'country',
sources: { tv: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'NO' } } } }
},
{
id: 'germany', title: 'Немецкое кино', group: 'country',
sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { with_origin_country: 'DE', 'vote_count.gte': 100 } } } }
},
{
id: 'australia', title: 'Австралийское кино', group: 'country',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'AU', 'vote_count.gte': 50 } } } }
},




{
id: 'best-70s', title: 'Лучшее из 70-х', group: 'era',
sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '1970-01-01', 'primary_release_date.lte': '1979-12-31', 'vote_count.gte': 300 } } } }
},
{
id: 'best-80s', title: 'Лучшее из 80-х', group: 'era',
sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '1980-01-01', 'primary_release_date.lte': '1989-12-31', 'vote_count.gte': 500 } } } }
},
{
id: 'best-90s', title: 'Лучшее из 90-х', group: 'era',
sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '1990-01-01', 'primary_release_date.lte': '1999-12-31', 'vote_count.gte': 500 } } } }
},
{
id: 'best-2000s', title: 'Лучшее из 2000-х', group: 'era',
sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '2000-01-01', 'primary_release_date.lte': '2009-12-31', 'vote_count.gte': 500 } } } }
},
{
id: 'best-2010s', title: 'Лучшее из 2010-х', group: 'era',
sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '2010-01-01', 'primary_release_date.lte': '2019-12-31', 'vote_count.gte': 500 } } } }
},


{
id: 'best-50s', title: 'Лучшее из 50-х', group: 'era',
sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '1950-01-01', 'primary_release_date.lte': '1959-12-31', 'vote_count.gte': 200 } } } }
},
{
id: 'best-60s', title: 'Лучшее из 60-х', group: 'era',
sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '1960-01-01', 'primary_release_date.lte': '1969-12-31', 'vote_count.gte': 200 } } } }
},
{
id: 'best-2020s', title: 'Лучшее из 2020-х', group: 'era',
sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '2020-01-01', 'vote_count.gte': 300 } } } }
},
{
id: 'best-classics', title: 'Классика до 50-х', group: 'era',
sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.lte': '1949-12-31', 'vote_count.gte': 100 } } } }
},




{
id: 'nolan', title: 'Кристофер Нолан', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 525 } } } }
},
{
id: 'tarantino', title: 'Квентин Тарантино', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 138 } } } }
},
{
id: 'dicaprio', title: 'Леонардо ДиКаприо', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 6193 } } } }
},
{
id: 'spielberg', title: 'Стивен Спилберг', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 488 } } } }
},
{
id: 'fincher', title: 'Дэвид Финчер', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 7467 } } } }
},
{
id: 'scorsese', title: 'Мартин Скорсезе', group: 'people', cover: '/6aoyUbvu0419XLKLIMoH0TkEicH.jpg',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 1032 } } } }
},
{
id: 'villeneuve', title: 'Дени Вильнёв', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 137427 } } } }
},
{
id: 'miyazaki', title: 'Хаяо Миядзаки', group: 'people', cover: '/95ozIP0A2fKaAXxwDxUEVn74Iux.jpg',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 608 } } } }
},


{
id: 'ridley-scott', title: 'Ридли Скотт', group: 'people', cover: '/hND7xAaxxBgaIspp9iMsaEXOSTz.jpg',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 578 } } } }
},
{
id: 'cameron', title: 'Джеймс Кэмерон', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 2710 } } } }
},
{
id: 'del-toro', title: 'Гильермо дель Торо', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 10828 } } } }
},
{
id: 'wes-anderson', title: 'Уэс Андерсон', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 5655 } } } }
},
{
id: 'coen-brothers', title: 'Братья Коэн', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: '1223|1224' } } } }
},
{
id: 'tom-hanks', title: 'Том Хэнкс', group: 'people', cover: '/ghgfzbEV7kbpbi1O8eIILKVXEA8.jpg',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 31 } } } }
},
{
id: 'keanu-reeves', title: 'Киану Ривз', group: 'people', cover: '/26OvB15pqk3eiKJG8LrXDVzO7Mw.jpg',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 6384 } } } }
},
{
id: 'denzel', title: 'Дензел Вашингтон', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 5292 } } } }
},
{
id: 'brad-pitt', title: 'Брэд Питт', group: 'people', cover: '/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 287 } } } }
},
{
id: 'scarlett', title: 'Скарлетт Йоханссон', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 1245 } } } }
},
{
id: 'kubrick', title: 'Стэнли Кубрик', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 240 } } } }
},
{
id: 'de-niro', title: 'Роберт Де Ниро', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 380 } } } }
},
{
id: 'tom-cruise', title: 'Том Круз', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 500 } } } }
},




{
id: 'top-grossing', title: 'Кассовые хиты', group: 'top',
sources: { movie: { type: 'list', id: 10 } }
},
{
id: 'top-rated', title: 'Высокий рейтинг', group: 'top',
sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 1000, 'vote_average.gte': 8 } } } }
},
{
id: 'popular-all', title: 'Популярное сейчас', group: 'top',
sources: {
movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } },
tv:    { type: 'discover', params: { sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } }
}
},


{
id: 'top-tv', title: 'Лучшие сериалы', group: 'top',
sources: { tv: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 200, 'vote_average.gte': 8 } } } }
},


{
id: 'kp-top250', title: 'КП Топ-250 фильмов', group: 'kp', badge: 'KINOPOISK',
sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } }
},
{
id: 'kp-top250-tv', title: 'КП Топ-250 сериалов', group: 'kp', badge: 'KINOPOISK',
sources: { movie: { type: 'kp', collection: 'TOP_250_TV_SHOWS' } }
},
{
id: 'kp-popular-all', title: 'КП Популярное', group: 'kp', badge: 'KINOPOISK',
sources: { movie: { type: 'kp', collection: 'TOP_POPULAR_ALL' } }
},
{
id: 'kp-popular-series', title: 'КП Популярные сериалы', group: 'kp', badge: 'KINOPOISK',
sources: { movie: { type: 'kp', collection: 'POPULAR_SERIES' } }
},
{
id: 'kp-family', title: 'КП Семейные', group: 'kp', badge: 'KINOPOISK',
sources: { movie: { type: 'kp', collection: 'FAMILY' } }
},
{
id: 'kp-animation', title: 'КП Анимация', group: 'kp', badge: 'KINOPOISK',
sources: { movie: { type: 'kp', collection: 'KIDS_ANIMATION_THEME' } }
},
{
id: 'kp-comics', title: 'КП Комиксы', group: 'kp', badge: 'KINOPOISK',
sources: { movie: { type: 'kp', collection: 'COMICS_THEME' } }
},
{
id: 'kp-vampire', title: 'КП Вампиры', group: 'kp', badge: 'KINOPOISK',
sources: { movie: { type: 'kp', collection: 'VAMPIRE_THEME' } }
},
{
id: 'kp-zombie', title: 'КП Зомби', group: 'kp', badge: 'KINOPOISK',
sources: { movie: { type: 'kp', collection: 'ZOMBIE_THEME' } }
},
{
id: 'kp-love', title: 'КП Романтика', group: 'kp', badge: 'KINOPOISK',
sources: { movie: { type: 'kp', collection: 'LOVE_THEME' } }
},
{
id: 'kp-catastrophe', title: 'КП Катастрофы', group: 'kp', badge: 'KINOPOISK',
sources: { movie: { type: 'kp', collection: 'CATASTROPHE_THEME' } }
},
{
id: 'kp-oscars', title: 'КП Лауреаты Оскара', group: 'kp', badge: 'KINOPOISK',
sources: { movie: { type: 'kp', collection: 'OSKAR_WINNERS_2021' } }
}

],





























themes: [
{ id: 'halloween', preset: 'halloween', accent: '#E07B2C', keywords: ['halloween', 'haunted house', 'slasher', 'witch', 'trick or treat'], genres: [27], months: [10], requireGenre: true },
{ id: 'christmas', preset: 'winter', accent: '#E8C170', keywords: ['christmas', 'santa claus', 'new year', 'christmas eve'], months: [12, 1] },
{ id: 'valentine', preset: 'hearts', accent: '#E8607D', keywords: ["valentine's day", 'valentine'], months: [2] },
{ id: 'space', preset: 'stars', accent: '#8FB8D9', keywords: ['space', 'alien', 'spaceship', 'astronaut', 'outer space'] },
{ id: 'noir', preset: 'rain', accent: '#9AA7B5', keywords: ['film noir', 'detective', 'private detective', 'neo-noir'] },
{ id: 'desert', preset: 'sand', accent: '#E8B87A', keywords: ['desert', 'sand', 'dune'] },
{ id: 'ocean', preset: 'bubbles', accent: '#7FB7C9', keywords: ['ocean', 'underwater', 'shark', 'submarine', 'sea'] },
{ id: 'sakura', preset: 'petals', accent: '#E6A3B8', keywords: ['cherry blossom', 'anime', 'romance'], genres: [16], requireGenre: true },
{ id: 'war', preset: 'embers', accent: '#C97B4A', keywords: ['war', 'world war ii', 'explosion', 'battle'] },
{ id: 'zombie', preset: 'glitch', accent: '#9FCF8A', keywords: ['zombie', 'undead', 'zombie apocalypse'] }
],









ambient: [
{ media: 'movie', id: 438631, title: 'Дюна', path: '/zRKQW58MBEY078AxkHxEJzUskCl.jpg', width: 3840 },
{ media: 'movie', id: 438631, title: 'Дюна', path: '/jYEW5xZkZk2WTrdbMGAPFuBqbDc.jpg', width: 3840 },
{ media: 'movie', id: 693134, title: 'Дюна: Часть вторая', path: '/eZ239CUp1d6OryZEBPnO2n87gMG.jpg', width: 3840 },
{ media: 'movie', id: 693134, title: 'Дюна: Часть вторая', path: '/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg', width: 3840 },
{ media: 'movie', id: 335984, title: 'Бегущий по лезвию 2049', path: '/gNdLJU9TxrpGx4dkZidjys3fyy0.jpg', width: 3840 },
{ media: 'movie', id: 335984, title: 'Бегущий по лезвию 2049', path: '/mVr0UiqyltcfqxbAUcLl9zWL8ah.jpg', width: 3840 },
{ media: 'movie', id: 157336, title: 'Интерстеллар', path: '/8sNiAPPYU14PUepFNeSNGUTiHW.jpg', width: 3840 },
{ media: 'movie', id: 157336, title: 'Интерстеллар', path: '/vgnoBSVzWAV9sNQUORaDGvDp7wx.jpg', width: 3840 },
{ media: 'movie', id: 872585, title: 'Оппенгеймер', path: '/7CENyUim29IEsaJhUxIGymCRvPu.jpg', width: 3840 },
{ media: 'movie', id: 872585, title: 'Оппенгеймер', path: '/neeNHeXjMF5fXoCJRsOmkNGC7q.jpg', width: 3840 },
{ media: 'movie', id: 76600, title: 'Аватар: Путь воды', path: '/kJsPVzdyBrYHLomuNv5SJDXUQ2f.jpg', width: 3840 },
{ media: 'movie', id: 76600, title: 'Аватар: Путь воды', path: '/8rpDcsfLJypbO6vREc0547VKqEv.jpg', width: 3840 },
{ media: 'tv', id: 82856, title: 'Мандалорец', path: '/9zcbqSxdsRMZWHYtyCd1nXPr2xq.jpg', width: 3840 },
{ media: 'tv', id: 82856, title: 'Мандалорец', path: '/7dxnNNo8BI5Aguzf9N3OHRTI2g5.jpg', width: 3840 },
{ media: 'movie', id: 120, title: 'Властелин колец: Братство Кольца', path: '/x2RS3uTcsJJ9IfjNPcgDmukoEcQ.jpg', width: 3840 },
{ media: 'movie', id: 120, title: 'Властелин колец: Братство Кольца', path: '/ua5EHfleb44L5hfHPs2BPqRAove.jpg', width: 3840 },
{ media: 'movie', id: 76341, title: 'Безумный Макс: Дорога ярости', path: '/gqrnQA6Xppdl8vIb2eJc58VC1tW.jpg', width: 3840 },
{ media: 'movie', id: 76341, title: 'Безумный Макс: Дорога ярости', path: '/uT895WNwm0aIJRtGizcQhrejWUo.jpg', width: 3840 },
{ media: 'movie', id: 27205, title: 'Начало', path: '/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg', width: 3840 },
{ media: 'movie', id: 27205, title: 'Начало', path: '/28kKbSUvUz6P5RE1AuMJMO7IMfK.jpg', width: 3840 },
{ media: 'movie', id: 49047, title: 'Гравитация', path: '/a2n6bKD7qhCPCAEALgsAhWOAQcc.jpg', width: 3840 },
{ media: 'movie', id: 49047, title: 'Гравитация', path: '/NPQyzyVb0ezZJlrp5sN4YKkOvq.jpg', width: 3840 },
{ media: 'movie', id: 286217, title: 'Марсианин', path: '/lzMS0CI3FLQYC5EgJoWeIaEt0lm.jpg', width: 3840 },
{ media: 'movie', id: 286217, title: 'Марсианин', path: '/9pubUbDX3eKB6ZuKxbFgv4cBZrz.jpg', width: 3840 },
{ media: 'movie', id: 475557, title: 'Джокер', path: '/rlay2M5QYvi6igbGcFjq8jxeusY.jpg', width: 3840 },
{ media: 'movie', id: 475557, title: 'Джокер', path: '/hw1CwteUFGjcWXwjGhKk8UJpWeA.jpg', width: 3840 },
{ media: 'movie', id: 530915, title: '1917', path: '/2lBOQK06tltt8SQaswgb8d657Mv.jpg', width: 3840 },
{ media: 'movie', id: 530915, title: '1917', path: '/2WgieNR1tGHlpJUsolbVzbUbE1O.jpg', width: 3840 },
{ media: 'movie', id: 374720, title: 'Дюнкерк', path: '/ddIkmH3TpR6XSc47jj0BrGK5Rbz.jpg', width: 3840 },
{ media: 'movie', id: 374720, title: 'Дюнкерк', path: '/2bG3HXcUze0GyGAKnJSDF6gllzk.jpg', width: 3840 },
{ media: 'movie', id: 603, title: 'Матрица', path: '/tlm8UkiQsitc8rSuIAscQDCnP8d.jpg', width: 3840 },
{ media: 'movie', id: 603, title: 'Матрица', path: '/oMsxZEvz9a708d49b6UdZK1KAo5.jpg', width: 3840 },
{ media: 'movie', id: 155, title: 'Тёмный рыцарь', path: '/9FE5eD92WfVCiivM9Pq9GVSrlWk.jpg', width: 3840 },
{ media: 'movie', id: 155, title: 'Тёмный рыцарь', path: '/4ORaDgLekcxzHmJPeSncyOgZImR.jpg', width: 3840 },
{ media: 'movie', id: 603692, title: 'Джон Уик 4', path: '/7I6VUdPj6tQECNHdviJkUHD2u89.jpg', width: 3840 },
{ media: 'movie', id: 603692, title: 'Джон Уик 4', path: '/i8dshLvq4LE3s0v8PrkDdUyb1ae.jpg', width: 3840 },
{ media: 'movie', id: 361743, title: 'Топ Ган: Мэверик', path: '/AaV1YIdWKnjAIAOe8UUKBFm327v.jpg', width: 3840 },
{ media: 'movie', id: 361743, title: 'Топ Ган: Мэверик', path: '/5AcP07WJl1VZbnloLZrMVgYjR2s.jpg', width: 3840 },
{ media: 'movie', id: 399055, title: 'Форма воды', path: '/abirSHwWgKajV3hXhaIR5lcCIXe.jpg', width: 3840 },
{ media: 'movie', id: 399055, title: 'Форма воды', path: '/rgyhSn3mINvkuy9iswZK0VLqQO3.jpg', width: 3840 },
{ media: 'movie', id: 313369, title: 'Ла-Ла Ленд', path: '/nlPCdZlHtRNcF6C9hzUH4ebmV1w.jpg', width: 3840 },
{ media: 'movie', id: 313369, title: 'Ла-Ла Ленд', path: '/2wmDyHz4gvF6m51IQZJnJzlLsnz.jpg', width: 3840 },
{ media: 'movie', id: 496243, title: 'Паразиты', path: '/hiKmpZMGZsrkA3cdce8a7Dpos1j.jpg', width: 3840 },
{ media: 'movie', id: 496243, title: 'Паразиты', path: '/cI1RBfqXbWaITTjcKGYLhd9F083.jpg', width: 3840 },
{ media: 'movie', id: 64690, title: 'Драйв', path: '/hoyAALgfmjMEK7O1wZ4r8wT91RP.jpg', width: 3840 },
{ media: 'movie', id: 64690, title: 'Драйв', path: '/oeEiUwvqHxWT0XqD3YlViaiJOVD.jpg', width: 3840 },
{ media: 'movie', id: 329865, title: 'Прибытие', path: '/8MUZz7oPXQftFTslZpRP3CVMOoq.jpg', width: 3840 },
{ media: 'movie', id: 329865, title: 'Прибытие', path: '/r8FD6CC3GgjWaGVkZh00AcedfpA.jpg', width: 3840 },
{ media: 'movie', id: 194662, title: 'Бёрдмэн', path: '/5tDErYQ8Ne1N6dNAlxg8yYNUwRA.jpg', width: 3840 },
{ media: 'movie', id: 194662, title: 'Бёрдмэн', path: '/2y6jZRoM6arYpNXC2GZAjUV4bmW.jpg', width: 3840 },
{ media: 'movie', id: 120467, title: 'Отель «Гранд Будапешт»', path: '/9udCLTxTFl28RxnK8Q05E154ZGa.jpg', width: 3840 },
{ media: 'movie', id: 120467, title: 'Отель «Гранд Будапешт»', path: '/xHDynIimfsgj0ZOs0j5ma8v1vmM.jpg', width: 3840 },
{ media: 'movie', id: 466272, title: 'Однажды в Голливуде', path: '/xwgBHC2FgoIrQitl8jZwXXdsR9u.jpg', width: 3840 },
{ media: 'movie', id: 466272, title: 'Однажды в Голливуде', path: '/oRiUKwDpcqDdoLwPoA4FIRh3hqY.jpg', width: 3840 },
{ media: 'movie', id: 118340, title: 'Стражи Галактики', path: '/uLtVbjvS1O7gXL8lUOwsFOH4man.jpg', width: 3840 },
{ media: 'movie', id: 118340, title: 'Стражи Галактики', path: '/47S8qCA5EoUVyKGDwWKDTwsJFpY.jpg', width: 3840 },
{ media: 'movie', id: 324857, title: 'Человек-паук: Через вселенные', path: '/qGQf2OHIkoh89K8XeKQzhxczf96.jpg', width: 3840 },
{ media: 'movie', id: 324857, title: 'Человек-паук: Через вселенные', path: '/hlCq6Qh9GVtuNcGZF4mQYluaZix.jpg', width: 3840 },
{ media: 'movie', id: 129, title: 'Унесённые призраками', path: '/6oaL4DP75yABrd5EbC4H2zq5ghc.jpg', width: 3840 },
{ media: 'movie', id: 129, title: 'Унесённые призраками', path: '/zSWkLXXj26IQ3pFDH1rnXDQZxAu.jpg', width: 3840 },
{ media: 'movie', id: 372058, title: 'Твоё имя', path: '/mMtUybQ6hL24FXo0F3Z4j2KG7kZ.jpg', width: 3840 },
{ media: 'movie', id: 372058, title: 'Твоё имя', path: '/qeUIKwUfDnNWFA1WwTvTRF1FaYF.jpg', width: 3840 },
{ media: 'movie', id: 346698, title: 'Барби', path: '/1esAE8sLJRWWFsLLeh5r3g2WanI.jpg', width: 3840 },
{ media: 'movie', id: 346698, title: 'Барби', path: '/3N5QNUqS76GFYNoEayfkkJyAyTN.jpg', width: 3840 },
{ media: 'movie', id: 545611, title: 'Всё везде и сразу', path: '/ss0Os3uWJfQAENILHZUdX8Tt1OC.jpg', width: 3840 },
{ media: 'movie', id: 545611, title: 'Всё везде и сразу', path: '/tt79dbOPd9Z9ykEOpvckttgYXwH.jpg', width: 3840 },
{ media: 'movie', id: 466420, title: 'Убийцы цветочной луны', path: '/acvE3RWjDLgvbL2RtcyzkrsAyNV.jpg', width: 3840 },
{ media: 'movie', id: 466420, title: 'Убийцы цветочной луны', path: '/fnxQUdLAjmSRCdudbYClkSnrxVf.jpg', width: 3840 },
{ media: 'movie', id: 792307, title: 'Бедные-несчастные', path: '/zh6IdheEYinU4TPtorWsjx6qPQE.jpg', width: 3840 },
{ media: 'movie', id: 792307, title: 'Бедные-несчастные', path: '/h0oBqUpax591vOacpBsDJ8cynjk.jpg', width: 3840 },
{ media: 'tv', id: 106379, title: 'Фоллаут', path: '/coaPCIqQBPUZsOnJcWZxhaORcDT.jpg', width: 3840 },
{ media: 'tv', id: 106379, title: 'Фоллаут', path: '/cIgHBLTMbcIkS0yvIrUUVVKLdOz.jpg', width: 3840 },
{ media: 'tv', id: 95396, title: 'Разделение', path: '/ixgFmf1X59PUZam2qbAfskx2gQr.jpg', width: 3840 },
{ media: 'tv', id: 95396, title: 'Разделение', path: '/9xDCTGhEWpz206PCiimRGmK67rV.jpg', width: 3840 },
{ media: 'tv', id: 83867, title: 'Андор', path: '/quCeAmVQHfsdcYkicbxZWVauCVb.jpg', width: 3840 },
{ media: 'tv', id: 83867, title: 'Андор', path: '/AmUhBqsxcenA75T9hV49G6ouO9c.jpg', width: 3840 },
{ media: 'tv', id: 93405, title: 'Игра в кальмара', path: '/2meX1nMdScFOoV4370rqHWKmXhY.jpg', width: 3840 },
{ media: 'tv', id: 93405, title: 'Игра в кальмара', path: '/xYTnihl7qffiLSZ6yLMSpBkPdXC.jpg', width: 3840 },
{ media: 'tv', id: 100088, title: 'Одни из нас', path: '/lY2DhbA7Hy44fAKddr06UrXWWaQ.jpg', width: 3840 },
{ media: 'tv', id: 100088, title: 'Одни из нас', path: '/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg', width: 3840 },
{ media: 'movie', id: 37165, title: 'Шоу Трумана', path: '/rmiG2uwcNoGFmBKMoa1pIcf514L.jpg', width: 3840 },
{ media: 'movie', id: 37165, title: 'Шоу Трумана', path: '/aCHn2TXYJfzPXQKA6r9mKPbMlUB.jpg', width: 3840 }
]
};


















var ID_RE = /^[\w-]{1,64}$/;
var KP_RE = /^[A-Z0-9_]{1,64}$/;
var NUM_ID_RE = /^\d{1,12}$/;
var THEME_RE = /^[a-z0-9-]{1,64}$/;
var ACCENT_RE = /^#[0-9a-f]{6}$/i;
var FILTER_KEY_RE = /^[a-z_]{1,48}(\.(gte|lte))?$/;
var VALUE_RE = /^[\w.,|:-]{1,256}$/;



var PARAM_KEYS = {
genres: 1, keywords: 1, companies: 1, networks: 1, watch_providers: 1,
watch_region: 1, sort_by: 1, orig_lang: 1
};

function safeText(s) {
return typeof s === 'string' && s.length > 0 && s.length <= 200 && !/[<>]/.test(s);
}



function labelOk(o) {
if (typeof o.title !== 'undefined' && !safeText(o.title)) return false;
if (typeof o.i18n !== 'undefined') {
if (!o.i18n || typeof o.i18n !== 'object' || Array.isArray(o.i18n)) return false;
for (var k in o.i18n) {
if (o.i18n.hasOwnProperty(k) && !safeText(o.i18n[k])) return false;
}
}
if (typeof o.badge !== 'undefined' && !safeText(o.badge)) return false;
return true;
}

function valueOk(v) {
if (typeof v === 'number') return isFinite(v);
if (typeof v === 'boolean') return true;
return typeof v === 'string' && VALUE_RE.test(v);
}

function specOk(spec) {
if (!spec || typeof spec !== 'object') return false;
if (spec.type === 'kp') return typeof spec.collection === 'string' && KP_RE.test(spec.collection);
if (spec.type === 'collection' || spec.type === 'list') return NUM_ID_RE.test(String(spec.id));
if (spec.type !== 'discover') return false;
var p = spec.params;
if (typeof p === 'undefined') return true;
if (!p || typeof p !== 'object' || Array.isArray(p)) return false;
for (var k in p) {
if (!p.hasOwnProperty(k)) continue;
if (k === 'filter') {
var f = p.filter;
if (!f || typeof f !== 'object' || Array.isArray(f)) return false;
for (var fk in f) {
if (!f.hasOwnProperty(fk)) continue;
if (!FILTER_KEY_RE.test(fk) || !valueOk(f[fk])) return false;
}
continue;
}
if (!PARAM_KEYS.hasOwnProperty(k) || !valueOk(p[k])) return false;
}
return true;
}

function sourcesOk(src) {
if (!src || typeof src !== 'object') return false;
if (!src.movie && !src.tv) return false;
if (src.movie && !specOk(src.movie)) return false;
if (src.tv && !specOk(src.tv)) return false;
return true;
}


function labelsOk(list) {
for (var i = 0; i < list.length; i++) {
var g = list[i];
if (!g || typeof g.id !== 'string' || !ID_RE.test(g.id)) return false;
if (!labelOk(g)) return false;
}
return true;
}






function validate(m) {
if (!m || typeof m !== 'object' || Array.isArray(m)) {
return { ok: false, reason: 'not_object' };
}
if (!m.version) return { ok: false, reason: 'no_version' };
if (!Array.isArray(m.collections)) return { ok: false, reason: 'no_collections' };
if (!Array.isArray(m.groups) || m.groups.length === 0) return { ok: false, reason: 'no_groups' };
if (!Array.isArray(m.home)) return { ok: false, reason: 'no_home' };



if (typeof m.themes !== 'undefined' && !Array.isArray(m.themes)) {
return { ok: false, reason: 'themes_not_array' };
}




if (typeof m.ambient !== 'undefined' && !Array.isArray(m.ambient)) {
return { ok: false, reason: 'ambient_not_array' };
}
if (!labelsOk(m.groups)) return { ok: false, reason: 'bad_group' };
if (typeof m.hubGroups !== 'undefined') {
if (!Array.isArray(m.hubGroups) || !labelsOk(m.hubGroups)) return { ok: false, reason: 'bad_hub_group' };
for (var h = 0; h < m.hubGroups.length; h++) {
var hg = m.hubGroups[h].groups;
if (!Array.isArray(hg)) return { ok: false, reason: 'bad_hub_group' };
for (var hj = 0; hj < hg.length; hj++) {
if (typeof hg[hj] !== 'string' || !ID_RE.test(hg[hj])) return { ok: false, reason: 'bad_hub_group' };
}
}
}
if (typeof m.moods !== 'undefined') {
if (!Array.isArray(m.moods) || !labelsOk(m.moods)) return { ok: false, reason: 'bad_mood' };
for (var mi = 0; mi < m.moods.length; mi++) {
if (!sourcesOk(m.moods[mi].sources)) return { ok: false, reason: 'bad_mood: ' + m.moods[mi].id };
}
}
for (var hi = 0; hi < m.home.length; hi++) {
if (typeof m.home[hi] !== 'string' || !ID_RE.test(m.home[hi])) return { ok: false, reason: 'bad_home' };
}
var seen = {};
var i, c;
for (i = 0; i < m.collections.length; i++) {
c = m.collections[i];
if (!c || !c.id) return { ok: false, reason: 'collection_no_id' };
if (typeof c.id !== 'string' || !ID_RE.test(c.id)) return { ok: false, reason: 'bad_id' };
if (typeof c.title !== 'string' || !c.title) {
return { ok: false, reason: 'collection_no_title: ' + c.id };
}
if (!labelOk(c)) return { ok: false, reason: 'bad_title: ' + c.id };
if (typeof c.group !== 'undefined' && (typeof c.group !== 'string' || !ID_RE.test(c.group))) {
return { ok: false, reason: 'bad_group: ' + c.id };
}
if (seen[c.id]) return { ok: false, reason: 'duplicate_id: ' + c.id };
seen[c.id] = 1;
if (!c.sources || (!c.sources.movie && !c.sources.tv)) {
return { ok: false, reason: 'no_sources: ' + c.id };
}
if (!sourcesOk(c.sources)) return { ok: false, reason: 'bad_sources: ' + c.id };
}
var themes = m.themes || [];
for (i = 0; i < themes.length; i++) {
var t = themes[i];
if (!t || typeof t.id !== 'string' || !THEME_RE.test(t.id)) return { ok: false, reason: 'bad_theme' };
if (typeof t.preset !== 'undefined' && (typeof t.preset !== 'string' || !THEME_RE.test(t.preset))) {
return { ok: false, reason: 'bad_theme: ' + t.id };
}
if (typeof t.accent !== 'undefined' && (typeof t.accent !== 'string' || !ACCENT_RE.test(t.accent))) {
return { ok: false, reason: 'bad_theme: ' + t.id };
}
}
return { ok: true };
}




function httpsUrl(url) {
return typeof url === 'string' && /^https:\/\/[^\s\/?#]+/i.test(url);
}



function orderForMonth(list, month) {
var seasonal = [];
var rest = [];
var i;
for (i = 0; i < list.length; i++) {
var c = list[i];
var inSeason = false;
if (c.season && month) {
for (var j = 0; j < c.season.length; j++) {
if (c.season[j] === month) { inSeason = true; break; }
}
}
if (inSeason) { seasonal.push(c); } else { rest.push(c); }
}
return seasonal.concat(rest);
}


function isFresh(rec) {
if (!rec || !rec.at) return false;
return (Date.now() - rec.at) < 12 * 3600000;
}


var current = null;




function load(cb) {
var url = '';
try {
if (typeof LC.pref === 'function') url = LC.pref('lumen_manifest_url', '') || '';
} catch (e) {}
try {
if (!url && typeof LC.MANIFEST_URL === 'string') url = LC.MANIFEST_URL || '';
} catch (e) {}
if (!url || !httpsUrl(url)) { current = DEFAULT; cb(DEFAULT); return; }
var cached = null;
try { cached = Lampa.Storage.get('lumen_manifest', null); } catch (e) {}


var usable = !!(cached && validate(cached.data).ok);
if (usable && isFresh(cached)) {
current = cached.data;
cb(current);
return;
}
var sep = url.indexOf('?') >= 0 ? '&' : '?';
var reqUrl = url + sep + 't=' + Math.floor(Date.now() / 3600000);
var net = new Lampa.Reguest();
net.silent(
reqUrl,
function (json) {
if (validate(json).ok) {
try { Lampa.Storage.set('lumen_manifest', { at: Date.now(), data: json }); } catch (e) {}
current = json;
cb(json);
} else {
current = usable ? cached.data : DEFAULT;
cb(current);
}
},
function () {
current = usable ? cached.data : DEFAULT;
cb(current);
},
false,
{ dataType: 'json', timeout: 8000 }
);
}


function get() {
return current || DEFAULT;
}

return {
DEFAULT: DEFAULT,
validate: validate,
orderForMonth: orderForMonth,
isFresh: isFresh,
load: load,
get: get
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.manifest;


/* ---- 43_sources.js ---- */

















LC.sources = (function () {






var MAP = {
genres: 'with_genres',
keywords: 'with_keywords',
companies: 'with_companies',
networks: 'with_networks',
watch_providers: 'with_watch_providers',
watch_region: 'watch_region',
sort_by: 'sort_by',
orig_lang: 'with_original_language'
};






var LIFE_DISCOVER = 720;
var LIFE_STATIC = 10080;
var LIFE_KP = 43200;
var LIFE_KP_EMPTY = 10;


var FETCH_TIMEOUT = 15000;






var INDEX_KEY = 'lumen_sources_index';
var MAX_CACHED = 60;

function storage() {
try { return Lampa && Lampa.Storage; } catch (e) { return null; }
}

function readIndex(store) {
var raw = null;
try { raw = store.get(INDEX_KEY, null); } catch (e) {}
return Array.isArray(raw) ? raw : [];
}

function drop(store, key) {
try { store.set(key, '', { nolisten: true }); } catch (e) {}
try {
var ls = (typeof window !== 'undefined' && window.localStorage) ||
(typeof localStorage !== 'undefined' ? localStorage : null);
if (ls) ls.removeItem(key);
} catch (e) {}
}

function stored(key, value) {
try {
var ls = (typeof window !== 'undefined' && window.localStorage) ||
(typeof localStorage !== 'undefined' ? localStorage : null);
if (!ls) return true;
var s = JSON.stringify(value);
ls.setItem(key, s);
var got = ls.getItem(key);
return got !== null && got.length >= s.length;
} catch (e) { return false; }
}

function purge(store) {
var idx = readIndex(store);
LC.util.each(idx, function (k) { drop(store, k); });
try { store.set(INDEX_KEY, [], { nolisten: true }); } catch (e) {}
}

function put(store, key, value) {
var idx = readIndex(store);
if (idx.indexOf(key) < 0) { idx.push(key); }
while (idx.length > MAX_CACHED) { drop(store, idx.shift()); }
try { store.set(INDEX_KEY, idx, { nolisten: true }); } catch (e) {}
try { store.set(key, value, { nolisten: true }); } catch (e2) {}
if (!stored(key, value)) {
purge(store);
try { store.set(key, value, { nolisten: true }); } catch (e3) {}
}
}








































var TV_WITHOUT = '10767';
var GENRE_TALK = 10767;
var GENRE_REALITY = 10764;





function tvFilter(filter) {
var out = {};
var k;
for (k in filter) {
if (filter.hasOwnProperty(k)) out[k] = filter[k];
}
var own = out.without_genres ? String(out.without_genres) : '';
if ((',' + own + ',').indexOf(',' + TV_WITHOUT + ',') === -1) out.without_genres = own ? own + ',' + TV_WITHOUT : TV_WITHOUT;
return out;
}


function talkOnly(card) {
var g = (card && card.genre_ids) || [];
var talk = false;
for (var i = 0; i < g.length; i++) {
if (Number(g[i]) === GENRE_REALITY) return false;
if (Number(g[i]) === GENRE_TALK) talk = true;
}
return talk;
}



function dropTalk(data) {
var kept = [];
for (var i = 0; i < data.results.length; i++) {
if (!talkOnly(data.results[i])) kept.push(data.results[i]);
}
data.results = kept;
return data;
}








var FILTER_KEY = /^[a-z_]{1,48}(\.(gte|lte))?$/;
var SAFE_VALUE = /^[\w.,|:-]{1,256}$/;
var KP_COLLECTION = /^[A-Z0-9_]{1,64}$/;

function safeValue(v) {
if (typeof v === 'number') return isFinite(v);
if (typeof v === 'boolean') return true;
return typeof v === 'string' && SAFE_VALUE.test(v);
}


function cleanFilter(f) {
var out = {};
if (!f || typeof f !== 'object') return out;
for (var k in f) {
if (f.hasOwnProperty(k) && FILTER_KEY.test(k) && safeValue(f[k])) out[k] = f[k];
}
return out;
}

function kpCollection(spec) {
var c = spec && spec.collection;
return (typeof c === 'string' && KP_COLLECTION.test(c)) ? c : '';
}




function buildRequest(spec, media, page) {
if (spec.type === 'collection') {
return { url: 'collection/' + encodeURIComponent(spec.id), params: {}, life: LIFE_STATIC };
}
if (spec.type === 'list') {
return { url: 'list/' + encodeURIComponent(spec.id), params: {}, life: LIFE_STATIC };
}
var params = {};
var src = spec.params || {};
var k;
for (k in src) {
if (!src.hasOwnProperty(k)) continue;
if (k === 'filter') params.filter = cleanFilter(src.filter);
else if (MAP.hasOwnProperty(k) && safeValue(src[k])) params[k] = src[k];
}
params.page = page || 1;
return { url: 'discover/' + media, params: params, life: LIFE_DISCOVER };
}






function normalize(type, json) {
json = json || {};
var results;
if (type === 'collection') {
results = (json.parts || []).slice();
results.sort(function (a, b) {
var da = String(a.release_date || '9999');
var db = String(b.release_date || '9999');
if (da < db) return -1;
if (da > db) return 1;
return 0;
});
} else if (type === 'list') {
results = (json.items || []).slice();
} else {
results = (json.results || []).slice();
}
var out = {
results: results,
title: json.title || json.name || '',
page: json.page || 1
};
out.total_results = json.total_results || results.length;
out.total_pages = json.total_pages || 1;
return out;
}




function discoverUrl(spec, media) {
var q = [];
var p = spec.params || {};
var k;
for (k in p) {

if (p.hasOwnProperty(k) && k !== 'filter' && MAP.hasOwnProperty(k)) {
q.push(MAP[k] + '=' + encodeURIComponent(p[k]));
}
}
var own = cleanFilter(p.filter);
var f = media === 'tv' ? tvFilter(own) : own;
for (k in f) {
if (f.hasOwnProperty(k)) {
q.push(k + '=' + encodeURIComponent(f[k]));
}
}
return 'discover/' + media + (q.length ? '?' + q.join('&') : '');
}



function kpToFinds(json, limit) {
var ids = [];
LC.util.each((json && json.items) || [], function (it) {
if (it && it.imdbId && ids.length < limit) {
ids.push(it.imdbId);
}
});
return ids;
}





function mergeMedia(movies, tv) {
var out = [];
var seen = {};
var a = movies || [];
var b = tv || [];
var len = Math.max(a.length, b.length);
var i, km, kt;
for (i = 0; i < len; i++) {
if (a[i]) {
km = 'movie:' + a[i].id;
if (!seen[km]) { seen[km] = 1; out.push(a[i]); }
}
if (b[i]) {
kt = 'tv:' + b[i].id;
if (!seen[kt]) { seen[kt] = 1; out.push(b[i]); }
}
}
return out;
}









function fetchKp(spec, page, ok, err, alive) {
var gen = alive ? alive() : 0;
function dead() { return alive && alive() !== gen; }

var key = typeof LC.pref === 'function' ? LC.pref('lumen_kp_key', '') : '';
if (!key) { err({ nokey: true }); return null; }
var collection = kpCollection(spec);
if (!collection) { err({ kp_failed: true }); return null; }

var cacheKey = 'lumen_kp_' + collection + '_' + (page || 1);
var store = storage();
var cached = null;
try {
var raw = store ? store.get(cacheKey, null) : null;
if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.at) {
cached = raw;
}
} catch (e) {}
if (cached && (Date.now() - cached.at) < (cached.ttl || LIFE_KP * 60000)) {
if (!dead()) ok(cached.data);
return null;
}

var net = new Lampa.Reguest();
net.silent(
'https://kinopoiskapiunofficial.tech/api/v2.2/films/collections?type=' +
encodeURIComponent(collection) + '&page=' + (page || 1),
function (json) {
if (dead()) return;
var ids = kpToFinds(json, 20);
var results = [];
var i = 0;
function next() {
if (dead()) return;
if (i >= ids.length) {
var data = {
results: results,
page: page || 1,
total_pages: (json && json.totalPages) || 1,
total_results: (json && json.total) || results.length,
title: ''
};
var s = storage();
if (s) {
if (results.length > 0) {
put(s, cacheKey, { at: Date.now(), ttl: LIFE_KP * 60000, data: data });
} else {
try {
s.set(cacheKey, { at: Date.now(), ttl: LIFE_KP_EMPTY * 60000, data: data }, { nolisten: true });
} catch (e2) {}
}
}
if (!dead()) ok(data);
return;
}
var id = ids[i++];
Lampa.Api.sources.tmdb.get(
'find/' + id,
{ filter: { external_source: 'imdb_id' } },
function (f) {
var m = (f.movie_results && f.movie_results[0]) ||
(f.tv_results && f.tv_results[0]);
if (m) results.push(m);
next();
},
next,
{ life: LIFE_KP }
);
}
next();
},
function () {
var s = storage();
if (s) {
try {
var errData = { results: [], page: page || 1, total_pages: 1, total_results: 0, title: '' };
s.set(cacheKey, { at: Date.now(), ttl: LIFE_KP_EMPTY * 60000, data: errData }, { nolisten: true });
} catch (e2) {}
}
if (!dead()) err({ kp_failed: true });
},
false,
{ headers: { 'X-API-KEY': key }, dataType: 'json', timeout: 8000 }
);
return net;
}








function fetchOne(spec, media, page, ok, err, alive) {
if (spec.type === 'kp') { return fetchKp(spec, page, ok, err, alive); }
var gen = alive ? alive() : 0;
function dead() { return alive && alive() !== gen; }
var r = buildRequest(spec, media, page);
Lampa.Api.sources.tmdb.get(
r.url,
r.params,
function (json) {
if (dead()) return;
var data = normalize(spec.type, json);



ok(spec.type === 'discover' && media === 'tv' ? dropTalk(data) : data);
},
function (e) { if (!dead()) err(e); },
{ life: r.life }
);
return null;
}








function sortSignature(item) {
var src = (item && item.sources) || {};
var parts = [];
var k;
for (k in src) {
if (!src.hasOwnProperty(k) || !src[k]) continue;
if (src[k].type !== 'discover') continue;
parts.push(k + '=' + ((src[k].params && src[k].params.sort_by) || ''));
}
parts.sort();
return parts.join(',');
}







var inflight = {};









var _subSeq = 0;






function fetchAll(item, page, ok, err, alive) {
var gen = alive ? alive() : 0;

var inflightKey = (item.id || '') + ':' + (page || 1) + ':' + sortSignature(item);
var entry = inflight[inflightKey];
if (entry) {

var subId = ++_subSeq;
var subEntry = entry;
subEntry.subs[subId] = { ok: ok, err: err, alive: alive, gen: gen };
return {
clear: function () {


if (inflight[inflightKey] !== subEntry) return;
if (!subEntry.subs[subId]) return;
delete subEntry.subs[subId];

if (!Object.keys(subEntry.subs).length && subEntry._cancel) { subEntry._cancel(); }
}
};
}


entry = { subs: {}, _cancel: null };
var mySubId = ++_subSeq;
entry.subs[mySubId] = { ok: ok, err: err, alive: alive, gen: gen };
inflight[inflightKey] = entry;
var myEntry = entry;



function notifySubs(method, arg) {
if (inflight[inflightKey] === myEntry) delete inflight[inflightKey];
var ids = Object.keys(myEntry.subs);
for (var j = 0; j < ids.length; j++) {
var sub = myEntry.subs[ids[j]];
var subGen = sub.alive ? sub.alive() : 0;
if (sub.alive && subGen !== sub.gen) continue;
sub[method](arg);
}
}



var _reqAliveGen = 0;
function requestAlive() { return _reqAliveGen; }

var src = item.sources || {};
var want = [];
var got = {};


var nets = [];

if (src.movie) want.push('movie');
if (src.tv) want.push('tv');
if (!want.length) {
if (inflight[inflightKey] === myEntry) delete inflight[inflightKey];
if (alive && alive() !== gen) {   }
else { err({ no_sources: true }); }
return { clear: function () {} };
}

function buildResult() {
var m = got.movie || { results: [], total_pages: 1, total_results: 0 };
var t = got.tv || { results: [], total_pages: 1, total_results: 0 };
return {
results: mergeMedia(m.results, t.results),
title: item.title,
page: page || 1,
total_pages: Math.max(m.total_pages || 1, t.total_pages || 1),
total_results: (m.total_results || 0) + (t.total_results || 0)
};
}





var gate = LC.util.gate(want.length, FETCH_TIMEOUT, function (partial) {
var gotLen = Object.keys(got).length;


if (!partial && !gotLen) { notifySubs('err', { all_failed: true }); return; }
var r = buildResult();
if (partial) r.partial = true;
notifySubs('ok', r);
});

LC.util.each(want, function (media) {
var n = fetchOne(
src[media], media, page,
function (json) { got[media] = json; gate.tick(); },
function (e) {




if (e && e.nokey) {
if (!gate.cancel()) return;
notifySubs('err', e);
} else {
gate.tick();
}
},
requestAlive
);
if (n) nets.push(n);
});

function cancelRequest() {
_reqAliveGen++;


gate.cancel();

if (inflight[inflightKey] === myEntry) delete inflight[inflightKey];
LC.util.each(nets, function (n) {
try { if (n && n.clear) n.clear(); } catch (eIgnore) {}
});
}
entry._cancel = cancelRequest;

return {
clear: function () {
if (inflight[inflightKey] !== myEntry) return;
if (!myEntry.subs[mySubId]) return;
delete myEntry.subs[mySubId];
if (!Object.keys(myEntry.subs).length) { cancelRequest(); }
}
};
}







function kpPosters(spec, limit, ok, err, alive) {
var gen = alive ? alive() : 0;
function dead() { return alive && alive() !== gen; }

var key = typeof LC.pref === 'function' ? LC.pref('lumen_kp_key', '') : '';
if (!key) { err({ nokey: true }); return null; }
var collection = kpCollection(spec);
if (!collection) { err({ kp_failed: true }); return null; }

var cacheKey = 'lumen_kpp_' + collection;
var store = storage();
var cached = null;
try {
var raw = store ? store.get(cacheKey, null) : null;
if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.at && Array.isArray(raw.data)) cached = raw;
} catch (e) {}
if (cached && (Date.now() - cached.at) < (cached.ttl || LIFE_KP * 60000)) {
if (!dead()) ok(cached.data.slice(0, limit));
return null;
}

var net = new Lampa.Reguest();
net.silent(
'https://kinopoiskapiunofficial.tech/api/v2.2/films/collections?type=' +
encodeURIComponent(collection) + '&page=1',
function (json) {
if (dead()) return;
var urls = [];
LC.util.each((json && json.items) || [], function (it) {
var url = it && (it.posterUrlPreview || it.posterUrl);
if (url && urls.length < 20) urls.push(url);
});
var s = storage();
if (s) {
if (urls.length) {
put(s, cacheKey, { at: Date.now(), ttl: LIFE_KP * 60000, data: urls });
} else {
try { s.set(cacheKey, { at: Date.now(), ttl: LIFE_KP_EMPTY * 60000, data: [] }, { nolisten: true }); } catch (e2) {}
}
}
if (!dead()) ok(urls.slice(0, limit));
},
function () {
if (!dead()) err({ kp_failed: true });
},
false,
{ headers: { 'X-API-KEY': key }, dataType: 'json', timeout: 8000 }
);
return net;
}

























var COVER_PATH = /^\/[A-Za-z0-9_-]+\.(jpg|png)$/;

function bannerPath(item, ok, err, alive) {
var src = (item && item.sources) || {};
var media = src.movie ? 'movie' : (src.tv ? 'tv' : '');
var spec = media ? src[media] : null;
if (!spec) { err({ no_sources: true }); return { clear: function () {} }; }

if (spec.type === 'kp') {
var net = kpPosters(spec, 1, function (urls) {
ok((urls && urls[0]) || '');
}, err, alive);
return {
clear: function () {
try { if (net && net.clear) net.clear(); } catch (e) {}
}
};
}

if (typeof item.cover === 'string' && COVER_PATH.test(item.cover)) {
ok(item.cover);
return { clear: function () {} };
}

return fetchAll(item, 1, function (json) {
var cards = (json && json.results) || [];
var poster = '';
for (var i = 0; i < cards.length; i++) {
if (!cards[i]) continue;
if (cards[i].backdrop_path) { ok(cards[i].backdrop_path); return; }
if (!poster && cards[i].poster_path) poster = cards[i].poster_path;
}
ok(poster);
}, err, alive);
}





























var LIFE_IMAGES = 43200;






var POSTERS_TIMEOUT = 6000;






























var AR_MIN = 0.64;
var AR_MAX = 0.75;

function posterFits(ratio) {
var v = Number(ratio);
if (!v) return false;
return v >= AR_MIN && v <= AR_MAX;
}








function cleanPoster(json) {
var list = (json && json.posters) || [];
for (var i = 0; i < list.length; i++) {
var p = list[i];
if (!p || !p.file_path) continue;
if (p.iso_639_1 !== null) continue;
if (!posterFits(p.aspect_ratio)) continue;
return p.file_path;
}
return '';
}







function cardMedia(card) {
return card && card.title ? 'movie' : 'tv';
}

function cardKey(card) {
return cardMedia(card) + ':' + (card && card.id);
}




function posterIndex(cards, into) {
var map = into || {};
for (var i = 0; i < (cards || []).length; i++) {
var c = cards[i];
if (!c || !c.id || !c.poster_path) continue;
map[cardKey(c)] = c.poster_path;
}
return map;
}



function applyPosters(cards, map) {
var n = 0;
for (var i = 0; i < (cards || []).length; i++) {
var c = cards[i];
if (!c || !c.id) continue;
var path = map[cardKey(c)];
if (!path || path === c.poster_path) continue;
c.poster_path = path;
n++;
}
return n;
}

function postersMode() {
try {
if (typeof LC.postersMode === 'function') return LC.postersMode();
} catch (e) { }
return 'lampa';
}













function originalPosters(item, cards, done, alive, page) {
var gen = alive ? alive() : 0;
function dead() { return alive && alive() !== gen; }

var src = (item && item.sources) || {};
var want = [];
if (src.movie && src.movie.type !== 'kp') want.push('movie');
if (src.tv && src.tv.type !== 'kp') want.push('tv');
if (!want.length) { done(0); return; }

var map = {};
var gate = LC.util.gate(want.length, POSTERS_TIMEOUT, function () {
done(applyPosters(cards, map));
});

LC.util.each(want, function (media) {
var r = buildRequest(src[media], media, page || 1);
var params = {};
var k;
for (k in r.params) {
if (r.params.hasOwnProperty(k)) params[k] = r.params[k];
}
params.langs = 'en';
Lampa.Api.sources.tmdb.get(
r.url,
params,
function (json) {
if (!dead()) posterIndex(normalize(src[media].type, json).results, map);
gate.tick();
},
function () { gate.tick(); },
{ life: r.life }
);
});
}












function cleanPosters(cards, done, alive) {
var gen = alive ? alive() : 0;
function dead() { return alive && alive() !== gen; }

var list = [];
for (var i = 0; i < (cards || []).length; i++) {
if (cards[i] && cards[i].id) list.push(cards[i]);
}
if (!list.length) { done(0); return; }

var found = 0;
var gate = LC.util.gate(list.length, POSTERS_TIMEOUT, function () { done(found); });

LC.util.each(list, function (card) {
Lampa.Api.sources.tmdb.get(
cardMedia(card) + '/' + card.id + '/images',
{ filter: { include_image_language: 'null' } },
function (json) {
if (!dead()) {
var path = cleanPoster(json);
if (path && path !== card.poster_path) { card.poster_path = path; found++; }
}
gate.tick();
},
function () { gate.tick(); },
{ life: LIFE_IMAGES }
);
});
}









function posters(item, cards, done, alive, page) {
var mode = postersMode();
if (mode !== 'original' && mode !== 'clean') { done(0); return; }
if (!cards || !cards.length) { done(0); return; }
if (mode === 'original') { originalPosters(item, cards, done, alive, page); return; }
cleanPosters(cards, done, alive);
}



var api = {
buildRequest: buildRequest,
normalize: normalize,
discoverUrl: discoverUrl,
kpToFinds: kpToFinds,
mergeMedia: mergeMedia,
sortSignature: sortSignature,
fetchOne: fetchOne,
kpPosters: kpPosters,
bannerPath: bannerPath,


posterFits: posterFits,
cleanPoster: cleanPoster,
posterIndex: posterIndex,
applyPosters: applyPosters,
posters: posters
};
api['fetch'] = fetchAll;
return api;
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.sources;


/* ---- 44_rows.js ---- */
















































LC.rows = (function () {





























var WATCHED = 95;



var _homeGen = 0;













var _served = false;





var _waiting = [];


function makeResolver(call) {
var done = false;
function resolve(payload) {
if (done) return;
done = true;
var i = _waiting.indexOf(resolve);
if (i !== -1) _waiting.splice(i, 1);
try { call(payload); } catch (e) {}
}
_waiting.push(resolve);
return resolve;
}


function flushWaiting() {
var pending = _waiting;
_waiting = [];
for (var i = 0; i < pending.length; i++) {
pending[i]({ results: [] });
}
}







function rowName(id) {
return 'lumen_' + id;
}




function filterWatched(results, viewedIds, hide) {
if (!results || !results.length) return [];
if (!hide) return results;
var ids = viewedIds && viewedIds.length ? viewedIds : null;
if (!ids) return results;
var seen = {};
var i;
for (i = 0; i < ids.length; i++) {
if (ids[i] != null) seen[ids[i]] = 1;
}
var out = [];
for (i = 0; i < results.length; i++) {
if (!seen[results[i].id]) out.push(results[i]);
}
return out;
}
























































var DEDUPE_MIN = 4;



























var LAMPA_VIEW = 7;



function fitCount(viewRight, firstLeft, pitch) {
if (!(pitch > 0) || !(viewRight > firstLeft)) return 0;
return Math.ceil((viewRight - firstLeft) / pitch);
}











function heroOff() {
try { return LC.pref ? LC.pref('lumen_hero_size', 'large') === 'off' : false; } catch (e) { return false; }
}

function measureFit() {
var root = null;
try {
var doc = window.document;
root = doc.createElement('div');
root.className = heroOff() ? '' : 'lumen-main';
root.style.cssText = 'position:absolute;left:0;top:0;width:100%;height:0;overflow:hidden;visibility:hidden;pointer-events:none';
root.innerHTML = '<div class="items-line"><div class="items-line__body"><div class="scroll scroll--horizontal">' +
'<div class="scroll__content"><div class="scroll__body mapping--line"><div class="card"></div><div class="card"></div></div></div></div></div></div>';
doc.body.appendChild(root);
var cards = root.getElementsByClassName('card');
var view = root.getElementsByClassName('scroll')[0].getBoundingClientRect();
var a = cards[0].getBoundingClientRect();
var b = cards[1].getBoundingClientRect();
return fitCount(view.right, a.left, b.left - a.left);
} catch (e) {
return 0;
} finally {
try { if (root && root.parentNode) root.parentNode.removeChild(root); } catch (e2) {}
}
}





function withView(rows, fit) {
if (!rows || !rows.length || !(fit > 0)) return rows;
var out = [];
for (var i = 0; i < rows.length; i++) {
var row = rows[i];
var p = row && row.params;
var own = p && p.items && typeof p.items.view === 'number' ? p.items.view : LAMPA_VIEW;
if (!row || !row.results || row.results.length <= own || own >= fit) {
out.push(row);
continue;
}
var params = {};
var items = {};
var k;
if (p) for (k in p) if (Object.prototype.hasOwnProperty.call(p, k)) params[k] = p[k];
if (p && p.items) for (k in p.items) if (Object.prototype.hasOwnProperty.call(p.items, k)) items[k] = p.items[k];
items.view = fit;
params.items = items;
var copy = copyRow(row, row.results);
copy.params = params;
out.push(copy);
}
return out;
}






























function cardKey(card) {
if (!card || card.id === null || card.id === undefined || card.id === '') return null;
var ns = (!card.source || card.source === 'cub') ? 'tmdb' : '' + card.source;
return ns + ':' + card.id;
}







function copyRow(row, results) {
var copy = {};
for (var k in row) {
if (Object.prototype.hasOwnProperty.call(row, k)) copy[k] = row[k];
}
copy.results = results;
return copy;
}







































function dedupeAcross(rows, seen, min, fit) {
if (!rows || !rows.length) return [];
seen = seen || {};
if (typeof min !== 'number') min = DEDUPE_MIN;

var kept = [];



var trimmed = [];
var before = [];
var i, j;
for (i = 0; i < rows.length; i++) {
if (!rows[i] || !rows[i].lumen_personal || !rows[i].lumen_own || !rows[i].results) continue;
for (j = 0; j < rows[i].results.length; j++) {
var own = cardKey(rows[i].results[j]);
if (own) seen[own] = 1;
}
}
for (i = 0; i < rows.length; i++) {
var row = rows[i];
if (!row || !row.results || !row.results.length) continue;
var personal = !!row.lumen_personal;
var out = [];
for (j = 0; j < row.results.length; j++) {
var card = row.results[j];
var key = cardKey(card);
if (key && seen[key] && !personal) continue;
out.push(card);
if (key) seen[key] = 1;
}
if (!out.length) continue;
kept.push(copyRow(row, out));
trimmed.push(out.length < row.results.length);
before.push(row.results.length);
}










var full = [];
for (i = 0; i < kept.length; i++) {
var r = kept[i];
var n = r.results.length;
var stub = n < min || (fit > 0 && n < fit && n * 2 < before[i]);
if (!trimmed[i] || r.lumen_keep || !stub) full.push(r);
}




return full.length ? full : kept;
}



function offSeason(item, month) {
if (!month || !item || !item.season || !item.season.length) return false;
for (var i = 0; i < item.season.length; i++) if (item.season[i] === month) return false;
return true;
}










function homeRows(manifest, storedIds, month, limit) {
if (!manifest || !Array.isArray(manifest.collections)) return [];
if (typeof limit === 'number' && limit <= 0) return [];


var byId = {};
var i;
for (i = 0; i < manifest.collections.length; i++) {
byId[manifest.collections[i].id] = manifest.collections[i];
}


var own = !!(storedIds && storedIds.length);
var ids = own ? storedIds : (manifest.home || []);



var seenIds = {};
var list = [];
for (i = 0; i < ids.length; i++) {
if (!seenIds[ids[i]]) {
seenIds[ids[i]] = 1;
var item = byId[ids[i]];
if (item && (own || !offSeason(item, month))) list.push(item);
}
}




if (month) {
var seasonal = [];
var rest = [];
for (i = 0; i < list.length; i++) {
var inSeason = false;
if (list[i].season) {
for (var j = 0; j < list[i].season.length; j++) {
if (list[i].season[j] === month) { inSeason = true; break; }
}
}
if (inSeason) { seasonal.push(list[i]); } else { rest.push(list[i]); }
}
list = seasonal.concat(rest);
}


if (typeof limit === 'number' && limit < list.length) {
list = list.slice(0, limit);
}

return list;
}








function rowChoices(manifest, pickedIds) {
if (!manifest || !Array.isArray(manifest.collections)) return [];
var picked = (pickedIds && pickedIds.length) ? pickedIds : (manifest.home || []);
var checked = {};
var i;
for (i = 0; i < picked.length; i++) checked[picked[i]] = 1;

var byId = {};
for (i = 0; i < manifest.collections.length; i++) {
byId[manifest.collections[i].id] = manifest.collections[i];
}

var head = [];
var seen = {};
for (i = 0; i < picked.length; i++) {
var item = byId[picked[i]];
if (!item || seen[item.id]) continue;
seen[item.id] = 1;
head.push({ id: item.id, title: item.title, group: item.group, checked: true });
}

var tail = [];
for (i = 0; i < manifest.collections.length; i++) {
var c = manifest.collections[i];
if (seen[c.id]) continue;
tail.push({ id: c.id, title: c.title, group: c.group, checked: !!checked[c.id] });
}
return head.concat(tail);
}








function storedIds() {
var raw = '';
try { raw = LC.pref ? (LC.pref('lumen_home_rows', '') || '') : ''; } catch (e) {}
if (!raw) return null;
var parts = ('' + raw).split(',');
var out = [];
for (var i = 0; i < parts.length; i++) {
var id = parts[i].replace(/^\s+|\s+$/g, '');
if (id) out.push(id);
}
return out.length ? out : null;
}






function viewedIds(results) {
var ids = {};
try {
if (window.Lampa && Lampa.Favorite) {
var viewed = Lampa.Favorite.get({ type: 'viewed' });
if (Array.isArray(viewed)) {
for (var i = 0; i < viewed.length; i++) {
if (viewed[i] && viewed[i].id != null) ids[viewed[i].id] = 1;
}
}
}
} catch (e) {}
try {
if (results && results.length &&
window.Lampa && Lampa.Timeline &&
typeof Lampa.Timeline.view === 'function' &&
Lampa.Utils && typeof Lampa.Utils.hash === 'function') {
for (var j = 0; j < results.length; j++) {
var card = results[j];
if (!card || card.id == null || ids[card.id]) continue;
var key = card.original_title || card.original_name || card.title || card.name || '';
if (!key) continue;
var v = Lampa.Timeline.view(Lampa.Utils.hash(key));
if (v && (Number(v.percent) || 0) >= WATCHED) ids[card.id] = 1;
}
}
} catch (eT) {}
return Object.keys(ids).map(function (k) {
var n = parseInt(k, 10);
return isNaN(n) ? k : n;
});
}









function bumpGen() {
_homeGen++;
flushWaiting();
}


function served() {
return _served;
}







var _mainOriginal = null;
var _mainWrapped = null;





var _dedupeActive = false;

function dedupeEnabled() {
if (!_dedupeActive) return false;
try { return LC.pref ? !!LC.pref('lumen_rows_dedupe', true) : true; } catch (e) { return true; }
}
















function installDedupe() {
_dedupeActive = true;
if (_mainWrapped) return;
try {
if (!window.Lampa || !Lampa.Api || typeof Lampa.Api.main !== 'function') return;
} catch (e) { return; }
_mainOriginal = Lampa.Api.main;
_mainWrapped = function (params, oncomplite, onerror) {
if (!_dedupeActive) return _mainOriginal(params, oncomplite, onerror);
try {
if (LC.homeplan && typeof LC.homeplan.apply === 'function') LC.homeplan.apply({ fresh: true });
} catch (ePlan) {}
var dedupe = dedupeEnabled();


var fit = measureFit();
var seen = {};
var pass = function (rows) {
return withView(dedupe ? dedupeAcross(rows, seen, DEDUPE_MIN, fit) : rows, fit);
};
var next = _mainOriginal(params, function (data) {
oncomplite(pass(data));
}, onerror);
if (typeof next !== 'function') return next;
return function (resolve, reject) {
return next(function (more) {
resolve(pass(more));
}, reject);
};
};
try { Lampa.Api.main = _mainWrapped; } catch (eSet) { _mainWrapped = null; _mainOriginal = null; }
}








function uninstallDedupe() {
_dedupeActive = false;
if (!_mainWrapped) return;
try {
if (window.Lampa && Lampa.Api && Lampa.Api.main === _mainWrapped) {
Lampa.Api.main = _mainOriginal;
_mainWrapped = null;
_mainOriginal = null;
}
} catch (e) {}
}














var ADVENT_IDS = ['xmas-comedy', 'christmas'];
var ADVENT_PAGES = 2;

function adventWord(key, def) {
try {
if (typeof LC.lang === 'function') return LC.lang(key);
} catch (e) { }
return def;
}



function adventToday() {
try {
if (LC.themes && typeof LC.themes.today === 'function') return LC.themes.today();
} catch (e) { }
return null;
}



function adventSpecs(manifest) {
var out = [];
if (!manifest || !Array.isArray(manifest.collections)) return out;
var byId = {};
var i;
for (i = 0; i < manifest.collections.length; i++) byId[manifest.collections[i].id] = manifest.collections[i];
for (var j = 0; j < ADVENT_IDS.length; j++) {
var item = byId[ADVENT_IDS[j]];
if (!item) continue;
for (var page = 1; page <= ADVENT_PAGES; page++) out.push({ item: item, page: page });
}
return out;
}





function adventPool(slots) {
var pool = [];
var seen = {};
for (var i = 0; i < slots.length; i++) {
var list = slots[i] || [];
for (var j = 0; j < list.length; j++) {
var card = list[j];
if (!card || card.id == null || seen[card.id]) continue;
seen[card.id] = 1;
pool.push(card);
}
}
return pool;
}

function adventTitle(today) {
var day = today.getDate();
if (day > 24) day = 24;
return adventWord('lumen_advent_title', 'Advent calendar') + ' · ' +
adventWord('lumen_advent_day', 'Day').toLowerCase() + ' ' + day;
}




function makeAdventCall(manifest) {
return function (params, screen) {
_served = true;
return function (call) {
var gen = _homeGen;
function alive() { return _homeGen === gen; }
var resolve = makeResolver(call);
var specs = adventSpecs(manifest);
var today = adventToday();
if (!specs.length || !today) { resolve({ results: [] }); return { cancel: function () {} }; }

var slots = [];
var left = specs.length;
var handles = [];
var words = {
day: adventWord('lumen_advent_day', 'Day'),
today: adventWord('lumen_advent_today', 'Today')
};

function finish() {
left--;
if (left > 0) return;
var days = [];
try {
days = LC.themes.adventDays(adventPool(slots), today, words);
} catch (e) {
days = [];
}



var payload = { results: days, title: adventTitle(today), lumen_keep: true };







LC.sources.posters(null, days, function () { resolve(payload); }, alive);
}



function ask(index) {
var spec = specs[index];
return LC.sources['fetch'](
spec.item,
spec.page,
function (json) { slots[index] = (json && json.results) || []; finish(); },
function () { slots[index] = []; finish(); },
alive
);
}

for (var i = 0; i < specs.length; i++) handles.push(ask(i));

return {
cancel: function () {
for (var k = 0; k < handles.length; k++) {
try { if (handles[k] && handles[k].clear) handles[k].clear(); } catch (e) {}
}
}
};
};
};
}




function adventRow(manifest) {
try {
if (!LC.themes || typeof LC.themes.adventDays !== 'function') return null;
var today = adventToday();
if (!today || today.getMonth() !== 11) return null;
if (!adventSpecs(manifest).length) return null;
return {
name: rowName('advent'),
title: adventTitle(today),
screen: 'main',
call: makeAdventCall(manifest)
};
} catch (e) {
return null;
}
}










function describe(item, pinned) {

var rowTitle = item.title;
if (item.badge) rowTitle += ' · ' + item.badge;
return {
name: rowName(item.id),
title: rowTitle,
screen: 'main',
call: makeCall(item, !!pinned)
};
}







function makeCall(item, pinned) {
return function (params, screen) {
_served = true;
return function (call) {



var gen = _homeGen;
function alive() { return _homeGen === gen; }


var resolve = makeResolver(call);

var handle = LC.sources['fetch'](
item,
1,
function (json) {

var hide = false;
try { hide = LC.pref ? !!LC.pref('lumen_hide_watched', false) : false; } catch (eIgnore) {}
var filtered = filterWatched(json.results, viewedIds(json.results), hide);
var payload = { results: filtered, title: item.title };


if (pinned) payload.lumen_keep = true;








LC.sources.posters(item, filtered, function () { resolve(payload); }, alive);
},
function () {

resolve({ results: [] });
},
alive
);

return {
cancel: function () {
if (handle && handle.clear) handle.clear();
}
};
};
};
}

return {
rowName: rowName,
filterWatched: filterWatched,
homeRows: homeRows,
rowChoices: rowChoices,
storedIds: storedIds,
viewedIds: viewedIds,
bumpGen: bumpGen,


dedupeAcross: dedupeAcross,

fitCount: fitCount,
withView: withView,
installDedupe: installDedupe,
uninstallDedupe: uninstallDedupe,


served: served,

adventSpecs: adventSpecs,
adventPool: adventPool,

describe: describe,
adventRow: adventRow
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.rows;


/* ---- 45_personal.js ---- */






















































LC.personal = (function () {









var SHOWS_LIMIT = 6;













var ROW_TIMEOUT = 8000;


var SOON_DAYS = 30;


var RECENT_DAYS = 14;


var UPCOMING_DAYS = 7;














































































var CONTINUE_DONE = 90;


var _gen = 0;













function pickBecause(history, n) {
if (!history || !history.length || n <= 0) return [];
var seen = {};
var out = [];
for (var i = 0; i < history.length && out.length < n; i++) {
var c = history[i];
if (!c || c.id == null) continue;
if (seen[c.id]) continue;
seen[c.id] = 1;
out.push({
id: c.id,

media: c.name ? 'tv' : 'movie',
title: c.title || c.name || ''
});
}
return out;
}




function isSeries(card) {
return !!(card && (card.number_of_seasons || card.first_air_date));
}








function dropFinished(items, percentOf) {
if (!items || !items.length) return [];
if (typeof percentOf !== 'function') return items.slice();
var out = [];
for (var i = 0; i < items.length; i++) {
var card = items[i];
if (!card) continue;
if (isSeries(card)) { out.push(card); continue; }
var percent = Number(percentOf(card));




if (percent >= CONTINUE_DONE) continue;
out.push(card);
}
return out;
}


function dateFmt(d) {
var y = d.getUTCFullYear();
var m = d.getUTCMonth() + 1;
var day = d.getUTCDate();
return y + '-' + (m < 10 ? '0' + m : '' + m) + '-' + (day < 10 ? '0' + day : '' + day);
}




function soonRange(today) {
var d0;
if (today instanceof Date) {
d0 = today;
} else if (today && typeof today === 'string') {
var parts = today.match(/^(\d{4})-(\d{2})-(\d{2})$/);
d0 = parts ? new Date(Date.UTC(+parts[1], +parts[2] - 1, +parts[3])) : new Date();
} else {
d0 = new Date();
}
var d1 = new Date(d0.getTime() + SOON_DAYS * 86400000);
return { gte: dateFmt(d0), lte: dateFmt(d1) };
}


function parseDate(s) {
if (!s || typeof s !== 'string') return NaN;
var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
if (!m) return NaN;
return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}



function shortDate(ms) {
var d = new Date(ms);
var day = d.getUTCDate();
var monthIdx = d.getUTCMonth();
var monthsRaw = '';
try { monthsRaw = LC.lang ? LC.lang('lumen_card_months_short') : ''; } catch (e) {}
var months = monthsRaw ? monthsRaw.split(',') : [];
var mon = months[monthIdx] || (monthIdx + 1 < 10 ? '0' + (monthIdx + 1) : '' + (monthIdx + 1));
return day + ' ' + mon;
}






function newEpisodes(shows, today) {
var nowMs;
if (today instanceof Date) {
nowMs = today.getTime();
} else if (today && typeof today === 'string') {
var parsed = parseDate(today);
nowMs = isNaN(parsed) ? Date.now() : parsed;
} else {
nowMs = Date.now();
}

var out = [];
for (var i = 0; i < shows.length; i++) {
var s = shows[i];
if (!s) continue;
var lastAir = s.last_episode_to_air;
var nextAir = s.next_episode_to_air;
var lastMs = parseDate(lastAir && lastAir.air_date);
var nextMs = parseDate(nextAir && nextAir.air_date);
var badge = '';

if (!isNaN(lastMs) && lastMs <= nowMs && (nowMs - lastMs) <= RECENT_DAYS * 86400000) {
var badgeLabel = '';
try { badgeLabel = LC.lang ? LC.lang('lumen_badge_new_episode') : 'New episode'; } catch (e) { badgeLabel = 'New episode'; }
badge = badgeLabel + ' · ' + shortDate(lastMs);
} else if (!isNaN(nextMs) && nextMs > nowMs && (nextMs - nowMs) <= UPCOMING_DAYS * 86400000) {
var diffDays = Math.ceil((nextMs - nowMs) / 86400000);
var inLabel = '';
try { inLabel = LC.lang ? LC.lang('lumen_badge_coming_in') : 'In'; } catch (e) { inLabel = 'In'; }
var daysLabel = '';
try { daysLabel = LC.daysWord ? LC.daysWord(diffDays) : (diffDays === 1 ? 'day' : 'days'); } catch (e) { daysLabel = 'days'; }
badge = inLabel + ' ' + diffDays + ' ' + daysLabel;
}

if (badge) {

var copy = {};
for (var k in s) {
if (Object.prototype.hasOwnProperty.call(s, k)) copy[k] = s[k];
}
copy.lumen_badge = badge;
out.push(copy);
}
}



out.sort(function (a, b) {
var aMs = parseDate(a.last_episode_to_air && a.last_episode_to_air.air_date);
var bMs = parseDate(b.last_episode_to_air && b.last_episode_to_air.air_date);
if (!isNaN(aMs) && !isNaN(bMs)) return bMs - aMs;
if (!isNaN(aMs)) return -1;
if (!isNaN(bMs)) return 1;
return 0;
});
return out;
}






var _waiting = [];


function makeResolver(call) {
var done = false;
function resolve(payload) {
if (done) return;
done = true;
var i = _waiting.indexOf(resolve);
if (i !== -1) _waiting.splice(i, 1);
try { call(payload); } catch (e) {}
}
_waiting.push(resolve);
return resolve;
}


function flushWaiting() {
var pending = _waiting;
_waiting = [];
for (var i = 0; i < pending.length; i++) {
pending[i]({ results: [] });
}
}




function bumpGen() {
_gen++;
flushWaiting();
}



















function watchedPercent(card) {
try {
if (!window.Lampa || !Lampa.Timeline || typeof Lampa.Timeline.view !== 'function') return null;
if (!Lampa.Utils || typeof Lampa.Utils.hash !== 'function') return null;
var key = (card && (card.original_title || card.title)) || '';
if (!key) return null;
var view = Lampa.Timeline.view(Lampa.Utils.hash(key));
return view ? (Number(view.percent) || 0) : null;
} catch (e) {
return null;
}
}





function continuesList() {
var out = [];
var seen = {};
try {
if (!window.Lampa || !Lampa.Favorite) return out;
var medias = ['movie', 'tv'];
for (var m = 0; m < medias.length; m++) {
var arr = [];
try {
if (typeof Lampa.Favorite.continues === 'function') {
arr = Lampa.Favorite.continues(medias[m]);
}
} catch (e) {}
if (!Array.isArray(arr)) continue;
for (var j = 0; j < arr.length; j++) {
var c = arr[j];
if (!c || c.id == null || seen[c.id]) continue;
seen[c.id] = 1;
out.push(c);
}
}
} catch (e) {}
return dropFinished(out, watchedPercent);
}


function getHistory() {
try {
if (!window.Lampa || !Lampa.Favorite) return [];
var h = Lampa.Favorite.get({ type: 'history' });
return Array.isArray(h) ? h : [];
} catch (e) { return []; }
}



function getShows(limit) {
var out = [];
var seen = {};
try {
if (!window.Lampa || !Lampa.Favorite) return out;
var sources = ['book', 'history'];
for (var s = 0; s < sources.length; s++) {
var arr = [];
try { arr = Lampa.Favorite.get({ type: sources[s] }); } catch (e) {}
if (!Array.isArray(arr)) continue;
for (var j = 0; j < arr.length; j++) {
var c = arr[j];
if (!c || c.id == null || !c.name) continue;
if (seen[c.id]) continue;
seen[c.id] = 1;
out.push(c);
if (out.length >= limit) return out;
}
}
} catch (e) {}
return out;
}






function makeContinueCall() {
return function (params, screen) {
return function (call) {
var gen = _gen;
function alive() { return _gen === gen; }

var resolve = makeResolver(call);
if (!alive()) { resolve({ results: [] }); return { cancel: function () {} }; }
var items = continuesList();
if (!alive()) { resolve({ results: [] }); return { cancel: function () {} }; }
resolve({ results: items, title: LC.lang ? LC.lang('lumen_row_continue') : 'Continue watching', lumen_personal: true, lumen_own: true });
return { cancel: function () {} };
};
};
}






function becauseTitle(card) {
var title = LC.lang ? LC.lang('lumen_row_because') : 'Because you watched';
if (card && card.title) title += ': «' + card.title + '»';
return title;
}




function anchorOf(history, anchor) {
if (typeof anchor === 'function') return anchor(history) || null;
return pickBecause(history, 1)[0] || null;
}











function makeBecauseCall(anchor) {
return function (params, screen) {
return function (call) {
var gen = _gen;
function alive() { return _gen === gen; }

var resolve = makeResolver(call);
var card = alive() ? anchorOf(getHistory(), anchor) : null;
if (!alive() || !card) {
resolve({ results: [] }); return { cancel: function () {} };
}
var rowTitle = becauseTitle(card);
var results = [];
var cancelled = false;



var gate = LC.util.gate(1, ROW_TIMEOUT, function () {
if (cancelled || !alive()) return;
resolve({ results: results, title: rowTitle, lumen_personal: true });
});

try {
Lampa.Api.sources.tmdb.get(
card.media + '/' + card.id + '/recommendations',
{ filter: { page: 1 } },
function (json) {
if (!alive()) return;
var arr = (json && json.results) ? json.results : [];
for (var k = 0; k < arr.length; k++) results.push(arr[k]);
gate.tick();
},
function () {
if (!alive()) return;
gate.tick();
},
{ life: 1440 }
);
} catch (e) {
gate.tick();
}




return {
cancel: function () {
cancelled = true;
gate.cancel();
}
};
};
};
}





function makeNewEpisodesCall() {
return function (params, screen) {
return function (call) {
var gen = _gen;
function alive() { return _gen === gen; }

var resolve = makeResolver(call);
var shows = alive() ? getShows(SHOWS_LIMIT) : null;
if (!alive() || !shows || !shows.length) {
resolve({ results: [] }); return { cancel: function () {} };
}
var details = [];
var cancelled = false;



var gate = LC.util.gate(shows.length, ROW_TIMEOUT, function () {
if (cancelled || !alive()) return;
var filtered = newEpisodes(details, null);
resolve({ results: filtered, title: LC.lang ? LC.lang('lumen_row_new_episodes') : 'New episodes', lumen_personal: true, lumen_own: true });
});

for (var i = 0; i < shows.length; i++) {
(function (card) {
var url = 'tv/' + card.id;
try {
Lampa.Api.sources.tmdb.get(
url,
{},
function (json) {
if (!alive()) return;
if (json && json.id != null) details.push(json);
gate.tick();
},
function () {
if (!alive()) return;
gate.tick();
},
{ life: 720 }
);
} catch (e) {
gate.tick();
}
})(shows[i]);
}




return {
cancel: function () {
cancelled = true;
gate.cancel();
}
};
};
};
}




function makeSoonCall() {
return function (params, screen) {
return function (call) {
var gen = _gen;
function alive() { return _gen === gen; }

var resolve = makeResolver(call);
if (!alive()) { resolve({ results: [] }); return { cancel: function () {} }; }

var range = soonRange(null);
var movies = [];
var tvShows = [];
var cancelled = false;



var gate = LC.util.gate(2, ROW_TIMEOUT, function () {
if (cancelled || !alive()) return;

var all = movies.concat(tvShows);
all.sort(function (a, b) {
var da = a.release_date || a.first_air_date || '';
var db = b.release_date || b.first_air_date || '';
return da < db ? -1 : da > db ? 1 : 0;
});
resolve({ results: all, title: LC.lang ? LC.lang('lumen_row_soon') : 'Coming soon', lumen_personal: true });
});

function fetchDiscover(media, resultArr) {
var filterKey = media === 'movie' ? 'primary_release_date' : 'first_air_date';
var f = {};
f[filterKey + '.gte'] = range.gte;
f[filterKey + '.lte'] = range.lte;
try {
Lampa.Api.sources.tmdb.get(
'discover/' + media,
{ filter: f, sort_by: 'popularity.desc' },
function (json) {
if (!alive()) return;
var arr = (json && json.results) ? json.results : [];
for (var k = 0; k < arr.length; k++) resultArr.push(arr[k]);
gate.tick();
},
function () {
if (!alive()) return;
gate.tick();
},
{ life: 360 }
);
} catch (e) {
gate.tick();
}
}

fetchDiscover('movie', movies);
fetchDiscover('tv', tvShows);




return {
cancel: function () {
cancelled = true;
gate.cancel();
}
};
};
};
}














function describe(opts) {
opts = opts || {};
var out = [];
var enabled = true;
try { enabled = LC.pref ? LC.pref('lumen_personal_rows', true) : true; } catch (e) {}
if (!enabled) return out;


try {
var cont = continuesList();
if (cont && cont.length) {
out.push({
id: 'continue',
name: 'lumen_continue',
title: LC.lang ? LC.lang('lumen_row_continue') : 'Continue watching',
screen: 'main',
call: makeContinueCall()
});
}
} catch (e) {}





try {
var anchorCard = anchorOf(getHistory(), opts.anchor);
if (anchorCard) {
out.push({
id: 'because',
name: 'lumen_because',
title: becauseTitle(anchorCard),
screen: 'main',
call: makeBecauseCall(opts.anchor)
});
}
} catch (e) {}



try {
var shows = getShows(SHOWS_LIMIT);
if (shows && shows.length) {
out.push({
id: 'new_episodes',
name: 'lumen_new_episodes',
title: LC.lang ? LC.lang('lumen_row_new_episodes') : 'New episodes of your shows',
screen: 'main',
call: makeNewEpisodesCall()
});
}
} catch (e) {}


out.push({
id: 'soon',
name: 'lumen_soon',
title: LC.lang ? LC.lang('lumen_row_soon') : 'Coming soon',
screen: 'main',
call: makeSoonCall()
});
return out;
}

return {
pickBecause: pickBecause,
newEpisodes: newEpisodes,
soonRange: soonRange,

dropFinished: dropFinished,
bumpGen: bumpGen,
describe: describe
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.personal;


/* ---- 46_hub.js ---- */





























































LC.hub = (function () {




var GRID_COLS = 6;




var POSTER_AHEAD = 14;









var BANNER_AHEAD = 8;



































function tileEm() {
var m = LC.hubEm;
return (LC.util.emScreen() - 2 * m.edge - m.gap * (m.tileCols - 1)) / m.tileCols;
}

function gcardEm() {
var m = LC.hubEm;
var gap = m.gap * (m.gcardCols - 1) * LC.util.lampaCardK();
return (LC.util.emScreen() - 2 * m.edge - gap) / m.gcardCols;
}







function titleOf(obj, lang) {
if (!obj) return '';
if (lang && lang !== 'ru' && obj.i18n && obj.i18n[lang]) return obj.i18n[lang];
return obj.title || '';
}



function collectionsIn(manifest, groupIds) {
var out = [];
if (!manifest || !Array.isArray(manifest.collections)) return out;
var want = {};
var i;
for (i = 0; i < (groupIds || []).length; i++) want[groupIds[i]] = 1;
for (i = 0; i < manifest.collections.length; i++) {
var c = manifest.collections[i];
if (c && want[c.group]) out.push(c);
}
return out;
}





function groupsWithCounts(manifest, lang) {
var out = [];
if (!manifest || !Array.isArray(manifest.hubGroups)) return out;
for (var i = 0; i < manifest.hubGroups.length; i++) {
var g = manifest.hubGroups[i];
if (!g) continue;
var list = collectionsIn(manifest, g.groups);
if (!list.length) continue;
out.push({ id: g.id, title: titleOf(g, lang), count: list.length, groups: g.groups });
}
return out;
}





function tilesFor(manifest, hubGroupId, month) {
if (!manifest || !Array.isArray(manifest.hubGroups)) return [];
for (var i = 0; i < manifest.hubGroups.length; i++) {
var g = manifest.hubGroups[i];
if (g && g.id === hubGroupId) {
var list = collectionsIn(manifest, g.groups);
if (month && LC.manifest && typeof LC.manifest.orderForMonth === 'function') {
return LC.manifest.orderForMonth(list, month);
}
return list;
}
}
return [];
}




function inSeason(item, month) {
if (!item || !Array.isArray(item.season) || !month) return false;
for (var i = 0; i < item.season.length; i++) {
if (Number(item.season[i]) === Number(month)) return true;
}
return false;
}





function singleDiscover(item) {
var src = (item && item.sources) || {};
var media = '';
if (src.movie && !src.tv) media = 'movie';
else if (src.tv && !src.movie) media = 'tv';
if (!media) return null;
if (src[media].type !== 'discover') return null;
return media;
}













function rouletteMedia(item, manifest) {
if (!item || !item.id) return null;
if (!LC.roulette || typeof LC.roulette.collectionsFor !== 'function' || typeof LC.roulette.open !== 'function') return null;
if (manifest === undefined) {
try { manifest = LC.manifest && LC.manifest.get ? LC.manifest.get() : null; } catch (e) { manifest = null; }
}
var order = ['movie', 'tv'];
for (var m = 0; m < order.length; m++) {
var list = LC.roulette.collectionsFor(manifest, order[m]);
for (var i = 0; i < list.length; i++) {
if (list[i] && list[i].id === item.id) return order[m];
}
}
return null;
}





function openTarget(item) {
var media = singleDiscover(item);
if (media) {
return {
url: LC.sources.discoverUrl(item.sources[media], media),
title: titleOf(item, lang()),
component: 'category_full',
source: 'tmdb',
page: 1
};
}
return { url: '', title: titleOf(item, lang()), component: 'lumen_grid', lumen: item, page: 1 };
}




function franchiseItem(collection) {
if (!collection || !collection.id) return null;
return {
id: 'col-' + collection.id,
title: collection.name || '',
sources: { movie: { type: 'collection', id: collection.id } }
};
}



var SORT_BY = {
popular: { movie: 'popularity.desc', tv: 'popularity.desc' },
rating: { movie: 'vote_average.desc', tv: 'vote_average.desc' },
'new': { movie: 'primary_release_date.desc', tv: 'first_air_date.desc' }
};

function sortModes() {
return [
{ id: 'popular', key: 'lumen_sort_popular' },
{ id: 'rating', key: 'lumen_sort_rating' },
{ id: 'new', key: 'lumen_sort_new' }
];
}





function applySort(item, mode) {
var table = SORT_BY[mode];
if (!item || !table) return item;
var out = {};
var k;
for (k in item) {
if (item.hasOwnProperty(k)) out[k] = item[k];
}
out.sources = {};
for (k in (item.sources || {})) {
if (!item.sources.hasOwnProperty(k)) continue;
var spec = item.sources[k];
if (!spec || spec.type !== 'discover') { out.sources[k] = spec; continue; }
var copy = { type: 'discover', params: {} };
var p;
for (p in (spec.params || {})) {
if (spec.params.hasOwnProperty(p)) copy.params[p] = spec.params[p];
}
copy.params.sort_by = table[k] || table.movie;
if (spec.id != null) copy.id = spec.id;
out.sources[k] = copy;
}
return out;
}




function needsLocalSort(item) {
var src = (item && item.sources) || {};
var k;
for (k in src) {
if (src.hasOwnProperty(k) && src[k] && src[k].type !== 'discover') return true;
}
return false;
}


function cardDate(card) {
return '' + ((card && (card.release_date || card.first_air_date)) || '');
}



function sortLocal(results, mode) {
if (!results || !results.length) return [];
var list = results.slice();
if (mode === 'rating') {
list.sort(function (a, b) { return (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0); });
} else if (mode === 'popular') {
list.sort(function (a, b) { return (Number(b.popularity) || 0) - (Number(a.popularity) || 0); });
} else if (mode === 'new') {
list.sort(function (a, b) {
var da = cardDate(a);
var db = cardDate(b);
if (da > db) return -1;
if (da < db) return 1;
return 0;
});
}
return list;
}




function cardMedia(card) {
if (card && card.media_type) return card.media_type;
return (card && card.name) ? 'tv' : 'movie';
}


function hasMore(json) {
if (!json) return false;
return (json.page || 1) < (json.total_pages || 1);
}





function lang() {
try {
if (typeof LC.langCode === 'function') return LC.langCode();
} catch (e) {}
return 'ru';
}

function tmdbImageFn() {
if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function') {
return function (url) { return Lampa.TMDB.image(url); };
}
return null;
}

function apiImgFn() {
if (window.Lampa && Lampa.Api && typeof Lampa.Api.img === 'function') {
return function (path, size) { return Lampa.Api.img(path, size); };
}
return null;
}




function imageUrl(path, size) {
try {
return LC.cardinfo.imageUrl(path, size, tmdbImageFn(), apiImgFn());
} catch (e) {
return '';
}
}


function esc(text) {
return LC.util.esc('' + (text == null ? '' : text));
}



function kpHintEnabled() {
try { return LC.pref ? !!LC.pref('lumen_kp_hint', true) : true; } catch (e) { return true; }
}






function motionClass(node) {
try {
node.addClass('lumen-motion-' + LC.motionMode());
} catch (e) {}
}






function screenBg(activity) {
try {
var node = activity && typeof activity.render === 'function' ? activity.render() : null;
if (node && typeof node.addClass === 'function') node.addClass('lumen-screen');
} catch (e) { }
}


function cardYear(card) {
var d = cardDate(card);
return d ? d.slice(0, 4) : '';
}


function cardMeta(card) {
var parts = [];
var year = cardYear(card);
if (year) parts.push(year);
var vote = Number(card && card.vote_average) || 0;
if (vote > 0) parts.push(vote.toFixed(1));
return parts.join(' · ');
}



function openCard(card) {
try {
Lampa.Activity.push({
url: '',
component: 'full',
id: card.id,
method: cardMedia(card),
card: card,
source: 'tmdb'
});
} catch (e) {
warn('hub: open card failed', e);
}
}


function openCollection(item) {
try {
Lampa.Activity.push(openTarget(item));
} catch (e) {
warn('hub: open collection failed', e);
}
}



























function navMove(dir) {
try {
if (!window.Navigator || typeof Navigator.canmove !== 'function') return false;
var next = Navigator.canmove(dir);
if (!next) return false;
if (typeof Navigator.focus === 'function') Navigator.focus(next);
else Navigator.move(dir);
return true;
} catch (e) {
warn('hub: navigator failed', e);
}
return false;
}


































var VIEW_WINDOW = 12;
var NAV_WINDOW = 36;


var lastNodes = null;
var lastLen = -1;
var lastViewFrom = -1;
var lastViewTo = -1;
var lastNavFrom = -1;
var lastNavTo = -1;

function limitCollection(fixed, nodes, active) {
try {
var from = active > 0 ? active : 0;
var len = nodes.length;
var viewFrom = Math.max(0, from - VIEW_WINDOW);
var viewTo = Math.min(len, from + VIEW_WINDOW);
var navFrom = Math.max(0, from - NAV_WINDOW);
var navTo = Math.min(len, from + NAV_WINDOW);
var known = nodes === lastNodes && len === lastLen;
var i;







if (!known) {
for (i = 0; i < len; i++) {
if (i >= viewFrom && i < viewTo) nodes[i].classList.add('layer--render');
else nodes[i].classList.remove('layer--render');
}
} else if (viewFrom !== lastViewFrom || viewTo !== lastViewTo) {
for (i = lastViewFrom; i < lastViewTo; i++) {
if (i < viewFrom || i >= viewTo) nodes[i].classList.remove('layer--render');
}
for (i = viewFrom; i < viewTo; i++) {
if (i < lastViewFrom || i >= lastViewTo) nodes[i].classList.add('layer--render');
}
}
lastNodes = nodes;
lastLen = len;
lastViewFrom = viewFrom;
lastViewTo = viewTo;

if (!window.Navigator || typeof Navigator.setCollection !== 'function') return;



if (known && navFrom === lastNavFrom && navTo === lastNavTo) return;
lastNavFrom = navFrom;
lastNavTo = navTo;

var keep = typeof Navigator.getFocusedElement === 'function' ? Navigator.getFocusedElement() : null;












if (keep && fixed.indexOf(keep) < 0 && nodes.indexOf(keep) < 0) {
try { if (keep.classList) keep.classList.remove('focus'); } catch (eKeep) { }
keep = null;
}
var collection = fixed.concat(nodes.slice(navFrom, navTo));








if (keep && collection.indexOf(keep) < 0) collection.push(keep);
Navigator.setCollection(collection);




if (keep && typeof Navigator.focused === 'function') Navigator.focused(keep);
} catch (e) {
warn('hub: collection window failed', e);
}
}
































function forgetWindow() {
lastNodes = null;
lastLen = -1;
lastViewFrom = -1;
lastViewTo = -1;
lastNavFrom = -1;
lastNavTo = -1;
}






function forgetWindowOf(nodes) {
if (lastNodes && lastNodes === nodes) forgetWindow();
}










function ownsRemote(activity) {
try {
var act = Lampa.Activity.active();
if (act && act.activity && act.activity !== activity) return false;
} catch (eAct) { }
try {
var ctl = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
if (ctl && ctl.name !== 'content') return false;
} catch (eCtl) { }
return true;
}





function lastInView(nodes) {
var bottom = window.innerHeight || 0;
var lo = 0;
var hi = nodes.length - 1;
var found = -1;
if (hi < 0 || typeof nodes[0].getBoundingClientRect !== 'function') return -1;
if (!nodes[0].getBoundingClientRect().height) return -1;
while (lo <= hi) {
var mid = (lo + hi) >> 1;
if (nodes[mid].getBoundingClientRect().top < bottom) { found = mid; lo = mid + 1; }
else hi = mid - 1;
}
return found;
}






function tvScreen() {
try {
if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.screen === 'function') return Lampa.Platform.screen('tv') !== false;
} catch (e) { }
return true;
}













function clearSelects() {
try {
if (typeof Lampa.Controller.clear === 'function') Lampa.Controller.clear();
} catch (e) {
warn('hub: controller clear failed', e);
}
}



function screenController(enter, afterMove, onUp) {
return {
toggle: function () {
forgetWindow();
enter();
},
left: function () {
if (!navMove('left')) Lampa.Controller.toggle('menu');
else if (afterMove) afterMove();
},
right: function () {
if (navMove('right') && afterMove) afterMove();
},
up: function () {
if (navMove('up')) {
if (afterMove) afterMove();
return;
}
if (onUp && onUp()) return;
Lampa.Controller.toggle('head');
},
down: function () {
if (navMove('down') && afterMove) afterMove();
},
back: function () {
Lampa.Activity.backward();
}
};
}





function HubComponent(object) {
var self = this;
var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250 });
var root = $('<div class="lumen-hub"></div>');
var head = $('<div class="lumen-hub__head"></div>');
var chipsRow = $('<div class="lumen-hub__chips"></div>');
var tilesRow = $('<div class="lumen-hub__tiles"></div>');




var gen = 0;
var handles = [];
var manifest = null;
var groups = [];
var activeGroup = '';
var chipNodes = [];
var tileNodes = [];
var searchNode = null;


var rouletteNode = null;
var lastFocus = null;
var started = false;




var byMouse = false;
var quiet = false;
var remoteScroll = false;

function alive(captured) {
return function () { return gen === captured; };
}

function clearHandles() {
for (var i = 0; i < handles.length; i++) {
try { if (handles[i] && handles[i].clear) handles[i].clear(); } catch (e) {}
}
handles = [];
}



function bump() {
gen++;
clearHandles();
}






function focusTarget() {
if (lastFocus && root[0] && root[0].contains && root[0].contains(lastFocus)) return lastFocus;
if (chipNodes.length) return chipNodes[0];
return null;
}








function limitHub(target) {
var active = -1;
for (var i = 0; i < tileNodes.length; i++) {
if (tileNodes[i] === target) { active = i; break; }
}
var fixed = [];
if (searchNode) fixed.push(searchNode);
if (rouletteNode) fixed.push(rouletteNode);
limitCollection(fixed.concat(chipNodes), tileNodes, active);
}







function recollect(prefer, still) {
try {
var node = prefer || focusTarget();
limitHub(node);
quiet = !!still;
Lampa.Controller.collectionFocus(node || false, root[0]);
} catch (e) {
warn('hub: collection failed', e);
}
quiet = false;
}







function enter() {
try { scroll.restorePosition(); } catch (e) { }
if (!tvScreen()) {
clearSelects();
limitHub(focusTarget());
return;
}
recollect(null, byMouse);
}


function afterMove() {
byMouse = false;
limitHub(lastFocus);
}
























function keepVisible(el, ev) {
if (!LC.focus.remote(ev)) { byMouse = true; return; }
if (quiet) return;
try {
var from = scroll.position();
remoteScroll = true;
scroll.update(el, true);

if (scroll.position() === from) remoteScroll = false;
} catch (e) { warn('hub: scroll.update failed', e); }
}














function bannerSize() {
return LC.util.emPx(tileEm()) * 0.85 > 300 ? 'w780' : 'w300';
}









function paintBanner(node, path, onFail) {
var box = $(node).find('.lumen-tile__media');
if (!box || !box.length) return;
box.empty();
path = '' + (path || '');
if (!path) return;


var url = path.indexOf('http') === 0 ? path : imageUrl(path, bannerSize());
if (!url) return;








var img = $('<img class="lumen-tile__img" decoding="async">');
img[0].onload = function () { $(node).addClass('lumen-tile--filled'); };
if (onFail) img[0].onerror = onFail;
img[0].src = url;
box.append(img);
}


function liveItem(item) {
var out = {};
for (var k in item) {
if (item.hasOwnProperty(k) && k !== 'cover') out[k] = item[k];
}
return out;
}

function loadBanner(item, node) {
if (node.lumen_banner) return;
node.lumen_banner = true;
var captured = gen;





var src = node.lumen_live ? liveItem(item) : item;
function toLive() {
if (gen !== captured || node.lumen_live) return;
node.lumen_live = true;
node.lumen_banner = false;
loadBanner(item, node);
}






function skeleton(on) {
try {
var box = $(node).find('.lumen-tile__media');
if (!box || !box.length) return;
if (on) box.addClass('lumen-skeleton');
else box.removeClass('lumen-skeleton');
} catch (eSk) { }
}
skeleton(true);
var handle = LC.sources.bannerPath(src, function (path) {
skeleton(false);
if (gen !== captured) return;
paintBanner(node, path, src.cover && path === src.cover ? toLive : null);
}, function (err) {
skeleton(false);
if (gen !== captured) return;




node.lumen_banner = false;
if (err && err.nokey) $(node).addClass('lumen-tile--nokey');
}, alive(captured));
if (handle) handles.push(handle);
}




function month() {
try {
if (LC.themes && typeof LC.themes.month === 'function') return LC.themes.month();
} catch (e) { }
return 0;
}



function tileIndex(node) {
for (var i = 0; i < tileNodes.length; i++) {
if (tileNodes[i] === node) return i;
}
return -1;
}





function loadBanners(upTo) {
var list = tilesFor(manifest, activeGroup, month());
for (var i = 0; i < tileNodes.length && i <= upTo; i++) {
loadBanner(list[i], tileNodes[i]);
}
}




function loadVisibleBanners() {
var from = tileIndex(lastFocus);
loadBanners((from < 0 ? 0 : from) + BANNER_AHEAD);
}




function loadInView() {
loadBanners(lastInView(tileNodes) + LC.hubEm.tileCols);
}



function onScroll() {
if (remoteScroll) remoteScroll = false;
else byMouse = true;
loadInView();
try { Lampa.Layer.visible(scroll.render(true)); } catch (e) {}
}

function tileNode(item) {
var group = null;
var i;
for (i = 0; manifest && manifest.groups && i < manifest.groups.length; i++) {
if (manifest.groups[i].id === item.group) { group = manifest.groups[i]; break; }
}
var sub = item.badge || titleOf(group, lang());



var season = inSeason(item, month())
? '<div class="lumen-tile__season">' + esc(LC.lang('lumen_season_badge')) + '</div>'
: '';
var node = $(
'<div class="lumen-tile selector">' +
'<div class="lumen-tile__media"></div>' +
'<div class="lumen-tile__scrim"></div>' +
season +
'<div class="lumen-tile__text">' +
'<div class="lumen-tile__title">' + esc(titleOf(item, lang())) + '</div>' +
'<div class="lumen-tile__sub">' + esc(sub) + '</div>' +
'</div>' +
'<div class="lumen-tile__nokey">' + esc(LC.lang('lumen_hub_nokey')) + '</div>' +
'</div>'
);





LC.focus.on(node, function (e) {
keepVisible(node[0], e);
lastFocus = node[0];
loadVisibleBanners();
});
node.on('hover:enter', function () {
openCollection(item);
});
return node[0];
}

function buildTiles(groupId) {


bump();
activeGroup = groupId;
var list = tilesFor(manifest, groupId, month());
tilesRow.empty();
tileNodes = [];
for (var i = 0; i < list.length; i++) {
var node = tileNode(list[i]);
tilesRow.append(node);
tileNodes.push(node);
}
loadVisibleBanners();
loadInView();
for (var c = 0; c < chipNodes.length; c++) {
$(chipNodes[c]).toggleClass('lumen-chip--on', chipNodes[c].lumen_group === groupId);
}
}

function chipNode(group) {



var node = $('<div class="lumen-chip selector">' + esc(group.title) + '</div>');
node[0].lumen_group = group.id;
LC.focus.on(node, function (e) { keepVisible(node[0], e); lastFocus = node[0]; });
node.on('hover:enter', function () {
if (activeGroup === group.id) return;
buildTiles(group.id);
recollect(node[0]);
});
return node[0];
}






function searchItems() {
var list = (manifest && manifest.collections) || [];
var code = lang();
var out = [];
for (var i = 0; i < list.length; i++) {
out.push({ id: list[i].id, title: titleOf(list[i], code), source: list[i] });
}
return out;
}






function openSearch() {
if (!LC.nav || typeof LC.nav.openSearch !== 'function') return;
LC.nav.openSearch({
items: searchItems(),
words: {
title: LC.lang('lumen_hub_search_title'),
results: LC.lang('lumen_hub_search_results'),
empty: LC.lang('lumen_hub_search_empty')
},
onSelect: function (found) {
if (found && found.source) openCollection(found.source);
},
onDone: function () {
try { Lampa.Controller.toggle('content'); } catch (e) {
warn('hub: search return failed', e);
}
}
});
}





function focusSearch() {
var node = head.find('.lumen-hub__search')[0];
if (!node) return false;





if (lastFocus === node) return false;


if (rouletteNode && lastFocus === rouletteNode) return false;
recollect(node);
return true;
}

function buildHead() {
var total = 0;
for (var i = 0; i < groups.length; i++) total += groups[i].count;
head.empty();
head.append($('<div class="lumen-hub__title">' + esc(LC.lang('lumen_hub_title')) + '</div>'));
head.append($('<div class="lumen-hub__count">' + total + ' ' + esc(LC.collectionsWord(total)) + '</div>'));


var search = $('<div class="lumen-hub__search selector">' + LC.icons.get('search') + '<span>' + esc(LC.lang('lumen_hub_search')) + '</span></div>');
LC.focus.on(search, function (e) { keepVisible(search[0], e); lastFocus = search[0]; });
search.on('hover:enter', function () { openSearch(); });
head.append(search);

searchNode = search[0];










rouletteNode = null;
if (LC.roulette && typeof LC.roulette.open === 'function') {
var roulette = $('<div class="lumen-hub__roulette selector">' + LC.icons.get('star') + '<span>' + esc(LC.lang('lumen_hub_roulette')) + '</span></div>');
LC.focus.on(roulette, function (e) { keepVisible(roulette[0], e); lastFocus = roulette[0]; });
roulette.on('hover:enter', function () { LC.roulette.open('movie'); });
head.append(roulette);
rouletteNode = roulette[0];
}
}

function build(m) {
manifest = m;
groups = groupsWithCounts(manifest, lang());
buildHead();
chipsRow.empty();
chipNodes = [];
for (var i = 0; i < groups.length; i++) {
var node = chipNode(groups[i]);
chipsRow.append(node);
chipNodes.push(node);
}
if (groups.length) buildTiles(groups[0].id);
else tilesRow.append($('<div class="lumen-hub__empty">' + esc(LC.lang('lumen_hub_empty')) + '</div>'));
try { self.activity.loader(false); } catch (e) {}



if (started && ownsRemote(self.activity)) recollect(null);





try { if (LC.perf && LC.perf.track) LC.perf.track('hub'); } catch (ePerf) {}
}

this.create = function () {
motionClass(root);
screenBg(self.activity);
root.append(head);
root.append(chipsRow);
root.append(tilesRow);
scroll.append(root);











scroll.minus();
scroll.onScroll = onScroll;
try { self.activity.loader(true); } catch (e) {}
var captured = gen;
LC.manifest.load(function (m) {
if (gen !== captured) return;
build(m);
});
};

this.render = function (js) {
return js ? scroll.render(true) : scroll.render();
};

this.start = function () {


var act = null;
try { act = Lampa.Activity.active(); } catch (eAct) {}
if (act && act.activity && act.activity !== this.activity) return;
started = true;
motionClass(root);
Lampa.Controller.add('content', screenController(enter, afterMove, focusSearch));
Lampa.Controller.toggle('content');



if (manifest) {
loadVisibleBanners();
loadInView();
}
};





this.pause = function () {
started = false;
};








this.stop = function () {
started = false;
bump();
forgetWindowOf(tileNodes);



for (var i = 0; i < tileNodes.length; i++) {
if (!$(tileNodes[i]).hasClass('lumen-tile--filled')) tileNodes[i].lumen_banner = false;
}
};

this.destroy = function () {
bump();
forgetWindowOf(tileNodes);
chipNodes = [];
tileNodes = [];
searchNode = null;
rouletteNode = null;
lastFocus = null;
try { scroll.destroy(); } catch (e2) {}
try { root.remove(); } catch (e3) {}
};
}





function GridComponent(object) {
var self = this;
var item = (object && object.lumen) || { id: 'unknown', title: (object && object.title) || '', sources: {} };
var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250 });
var root = $('<div class="lumen-grid"></div>');
var head = $('<div class="lumen-grid__head"></div>');
var sortsRow = $('<div class="lumen-grid__sorts"></div>');
var itemsRow = $('<div class="lumen-grid__items"></div>');
var subtitle = $('<div class="lumen-grid__sub"></div>');

var gen = 0;
var handles = [];
var sortMode = 'popular';
var page = 1;
var totalPages = 1;
var totalResults = 0;
var loading = false;


var pending = null;
var resumeAfterStop = null;


var raw = [];
var cardNodes = [];
var sortNodes = [];





var emptyNodes = [];




var rouletteNode = null;
var lastFocus = null;



var lastCardId = null;
var started = false;





var byMouse = false;


var quiet = false;




var remoteScroll = false;

function alive(captured) {
return function () { return gen === captured; };
}

function clearHandles() {
for (var i = 0; i < handles.length; i++) {
try { if (handles[i] && handles[i].clear) handles[i].clear(); } catch (e) {}
}
handles = [];
}

function bump() {
gen++;
clearHandles();
}


function focusTarget() {
if (lastFocus && root[0] && root[0].contains && root[0].contains(lastFocus)) return lastFocus;
if (lastCardId != null) {
for (var i = 0; i < cardNodes.length; i++) {
if (cardNodes[i].card_data && cardNodes[i].card_data.id === lastCardId) return cardNodes[i];
}
}
return null;
}







function limitGrid(target) {
var active = -1;
for (var i = 0; i < cardNodes.length; i++) {
if (cardNodes[i] === target) { active = i; break; }
}
var fixed = sortNodes.concat(emptyNodes);
if (rouletteNode) fixed.push(rouletteNode);
limitCollection(fixed, cardNodes, active);
}













function recollect(prefer, still) {
try {
var node = prefer || focusTarget();
limitGrid(node);
quiet = !!still;
Lampa.Controller.collectionFocus(node || false, root[0]);
} catch (e) {
warn('grid: collection failed', e);
}
quiet = false;
}


function enter() {
try { scroll.restorePosition(); } catch (e) { }
if (!tvScreen()) {
clearSelects();
limitGrid(focusTarget());
return;
}
recollect(null, byMouse);
}









function keepVisible(el, ev) {
if (quiet || !LC.focus.remote(ev)) return;
try {
var from = scroll.position();
remoteScroll = true;
scroll.update(el, true);



if (scroll.position() === from) remoteScroll = false;
} catch (e) { warn('grid: scroll.update failed', e); }
}


function focusedIndex() {
for (var i = 0; i < cardNodes.length; i++) {
if (cardNodes[i] === lastFocus) return i;
}
return -1;
}




function loadPosters(upTo) {
for (var i = 0; i < cardNodes.length && i <= upTo; i++) {
var node = cardNodes[i];
if (!node.lumen_poster || node.lumen_posted) continue;
node.lumen_posted = true;
var img = node.querySelector ? node.querySelector('.card__img') : null;
if (!img) continue;
bindPoster(node, img, node.lumen_poster);
}
}

function bindPoster(node, img, url) {




img.decoding = 'async';
img.onload = function () { $(node).addClass('card--loaded'); };
img.onerror = function () { $(node).addClass('card--broken'); };
img.src = url;
}

















function onScroll() {
if (remoteScroll) remoteScroll = false;
else byMouse = true;
var last = loadInView();
if (last >= 0 && Math.floor(last / GRID_COLS) >= Math.floor((cardNodes.length - 1) / GRID_COLS) - 1) loadNext();
try { Lampa.Layer.visible(scroll.render(true)); } catch (e) {}
}







function loadInView() {
var last = lastInView(cardNodes);
if (last >= 0) loadPosters(last + GRID_COLS);
return last;
}




function onWheel(step) {
byMouse = true;
scroll.wheel(step);
}





function afterMove() {
byMouse = false;


limitGrid(lastFocus);
var i = focusedIndex();
if (i < 0) return;
loadPosters(i + POSTER_AHEAD);
if (i >= cardNodes.length - GRID_COLS) loadNext();
}








function cardNode(card) {
var year = cardYear(card);
var node = $(Lampa.Template.js('card', {
title: card.title || card.name || '',
release_year: year
}));
node.addClass('lumen-gcard');
var el = node[0];
el.card_data = card;

var view = node.find('.card__view');
if (card.name) {
node.addClass('card--tv');
view.append($('<div class="card__type"></div>').text('TV'));
}
var vote = Number(card.vote_average) || 0;
if (vote > 0) view.append($('<div class="card__vote"></div>').text(vote >= 10 ? 10 : vote.toFixed(1)));
var quality = card.quality || card.release_quality;
if (quality && !card.name) view.append($('<div class="card__quality"></div>').text(quality));

markCard(node, card);






var age = node.find('.card__age');
if (age.length && !('' + age.text())) age.remove();




el.lumen_poster = imageUrl(card.poster_path, LC.util.posterSize(LC.util.emPx(gcardEm())));

LC.focus.on(node, function (e) {
if (!LC.focus.remote(e)) byMouse = true;
keepVisible(el, e);
lastFocus = el;
lastCardId = card.id;
});
node.on('hover:enter', function () { openCard(card); });
return el;
}



function markCard(node, card) {
var marks = ['look', 'viewed', 'scheduled', 'continued', 'thrown'];
try {
if (!window.Lampa || !Lampa.Favorite || typeof Lampa.Favorite.check !== 'function') return;
var status = Lampa.Favorite.check(card) || {};
var icons = node.find('.card__icons-inner');
var names = ['book', 'like', 'wath'];
for (var i = 0; i < names.length; i++) {
if (status[names[i]]) icons.append($('<div class="card__icon icon--' + names[i] + '"></div>'));
}
if (status.history) icons.append($('<div class="card__icon icon--history"></div>'));
for (var m = 0; m < marks.length; m++) {
if (!status[marks[m]]) continue;
var text = marks[m];
try { text = Lampa.Lang.translate('title_' + marks[m]); } catch (eLang) {}
node.find('.card__view').append($('<div class="card__marker card__marker--' + marks[m] + '"><span></span></div>').find('span').text(text).end());
break;
}
} catch (e) {
warn('grid: card marks failed', e);
}
progressBar(node, card);














try {
if (LC.badges && LC.badges.decorate) LC.badges.decorate(node, card, { bar: false, wide: true });
} catch (eBadge) {
warn('grid: badge failed', eBadge);
}
}

function progressBar(node, card) {
try {
if (!window.Lampa || !Lampa.Timeline || typeof Lampa.Timeline.view !== 'function') return;
if (!Lampa.Utils || typeof Lampa.Utils.hash !== 'function') return;
var key = card.original_title || card.original_name || card.title || card.name || '';
if (!key) return;
var view = Lampa.Timeline.view(Lampa.Utils.hash(key));
var percent = view ? (Number(view.percent) || 0) : 0;
if (percent <= 0 || percent >= 100) return;
var bar = $('<div class="lumen-gcard__bar"><div></div></div>');
bar.find('div').css('width', percent + '%');
node.find('.card__view').append(bar);
} catch (e) {
warn('grid: progress failed', e);
}
}

function appendCards(list) {
for (var i = 0; i < list.length; i++) {
var node = cardNode(list[i]);
itemsRow.append(node);
cardNodes.push(node);
}
}

function renderSub() {
var mode = null;
var modes = sortModes();
for (var i = 0; i < modes.length; i++) if (modes[i].id === sortMode) mode = modes[i];
var parts = [];
if (totalResults) parts.push(LC.lang('lumen_grid_total') + ' ' + totalResults);
if (mode) parts.push(LC.lang(mode.key));
subtitle.html(esc(parts.join(' · ')));
}

function showEmpty(reason) {
itemsRow.empty();
cardNodes = [];
emptyNodes = [];


var nokey = reason === 'nokey' && kpHintEnabled();
var text = nokey ? LC.lang('lumen_hub_nokey_text') : LC.lang('lumen_hub_empty');
var box = $('<div class="lumen-grid__empty"><div class="lumen-grid__empty-text">' + esc(text) + '</div></div>');
if (nokey) {



var hide = $('<div class="lumen-grid__back lumen-grid__hide selector">' + esc(LC.lang('lumen_kp_hint_hide')) + '</div>');
LC.focus.on(hide, function (e) { keepVisible(hide[0], e); lastFocus = hide[0]; });
hide.on('hover:enter', function () {
try { Lampa.Storage.set('lumen_kp_hint', 'false'); } catch (e) {}
});
box.append(hide);
emptyNodes.push(hide[0]);
}
var back = $('<div class="lumen-grid__back selector">' + esc(LC.lang('lumen_grid_back')) + '</div>');
LC.focus.on(back, function (e) { keepVisible(back[0], e); lastFocus = back[0]; });
back.on('hover:enter', function () { Lampa.Activity.backward(); });
box.append(back);
emptyNodes.push(back[0]);
itemsRow.append(box);
}


function rebuild() {
itemsRow.empty();
cardNodes = [];
emptyNodes = [];
appendCards(sortLocal(raw, sortMode));
loadPosters(POSTER_AHEAD);
renderSub();
if (started && ownsRemote(self.activity)) recollect(null);
}



function loadPage(nextPage, reset) {
if (loading) return;
loading = true;
pending = { page: nextPage, reset: reset };
try { self.activity.loader(true); } catch (e) {}
var captured = gen;
var request = needsLocalSort(item) ? item : applySort(item, sortMode);




function fill(json) {
loading = false;
pending = null;
try { self.activity.loader(false); } catch (e2) {}
page = json.page || nextPage;
totalPages = json.total_pages || 1;
totalResults = json.total_results || (json.results || []).length;
if (reset) raw = [];
raw = raw.concat(json.results || []);





var localSort = needsLocalSort(item);
var list = localSort ? sortLocal(raw, sortMode) : (json.results || []);
if (reset || localSort) {
itemsRow.empty();
cardNodes = [];
emptyNodes = [];
}
if (!list.length && !cardNodes.length) showEmpty('');
else appendCards(list);
var from = focusedIndex();
loadPosters((from < 0 ? 0 : from) + POSTER_AHEAD);
loadInView();
renderSub();




if (started && ownsRemote(self.activity)) recollect(null, byMouse);
}

var handle = LC.sources['fetch'](request, nextPage, function (json) {
if (gen !== captured) return;










LC.sources.posters(request, json.results || [], function () {
if (gen !== captured) return;
fill(json);
}, alive(captured), nextPage);
}, function (err) {
if (gen !== captured) return;
loading = false;
pending = null;
try { self.activity.loader(false); } catch (e3) {}
if (!cardNodes.length) showEmpty(err && err.nokey ? 'nokey' : '');
renderSub();
if (started && ownsRemote(self.activity)) recollect(null, byMouse);
}, alive(captured));
if (handle) handles.push(handle);
}

function loadNext() {
if (loading) return;
if (!hasMore({ page: page, total_pages: totalPages })) return;
loadPage(page + 1, false);
}

function highlightSort() {
for (var i = 0; i < sortNodes.length; i++) {
$(sortNodes[i]).toggleClass('lumen-chip--on', sortNodes[i].lumen_sort === sortMode);
}
}

function sortNode(mode) {
var node = $('<div class="lumen-chip selector">' + esc(LC.lang(mode.key)) + '</div>');
node[0].lumen_sort = mode.id;
LC.focus.on(node, function (e) { keepVisible(node[0], e); lastFocus = node[0]; });
node.on('hover:enter', function () {
if (sortMode === mode.id) return;




if (loading) {
bump();
loading = false;
pending = null;
try { self.activity.loader(false); } catch (eL) {}
}
sortMode = mode.id;
highlightSort();




if (needsLocalSort(item) && raw.length) {
rebuild();
recollect(node[0]);
return;
}
page = 1;
loadPage(1, true);
recollect(node[0]);
});
return node[0];
}

this.create = function () {
motionClass(root);
screenBg(self.activity);

head.append($('<div class="lumen-grid__title">' + esc(titleOf(item, lang())) + '</div>'));
head.append(subtitle);
root.append(head);
var modes = sortModes();
for (var i = 0; i < modes.length; i++) {
var node = sortNode(modes[i]);
sortsRow.append(node);
sortNodes.push(node);
}
highlightSort();







var rmedia = rouletteMedia(item);
if (rmedia) {
var roulette = $('<div class="lumen-chip lumen-grid__roulette selector">' + LC.icons.get('star') + '<span>' + esc(LC.lang('lumen_grid_roulette')) + '</span></div>');
LC.focus.on(roulette, function (e) { keepVisible(roulette[0], e); lastFocus = roulette[0]; });
roulette.on('hover:enter', function () { LC.roulette.open(rmedia, item.id); });
sortsRow.append(roulette);
rouletteNode = roulette[0];
}
root.append(sortsRow);
root.append(itemsRow);
scroll.append(root);



scroll.minus();
scroll.onScroll = onScroll;
scroll.onWheel = onWheel;
loadPage(1, true);
};

this.render = function (js) {
return js ? scroll.render(true) : scroll.render();
};

this.start = function () {
var act = null;
try { act = Lampa.Activity.active(); } catch (eAct) {}
if (act && act.activity && act.activity !== this.activity) return;
started = true;
motionClass(root);
Lampa.Controller.add('content', screenController(enter, afterMove));
Lampa.Controller.toggle('content');


loadInView();

if (resumeAfterStop) {
var again = resumeAfterStop;
resumeAfterStop = null;
loadPage(again.page, again.reset);
}
};




this.pause = function () {
started = false;
};






this.stop = function () {
started = false;
resumeAfterStop = loading ? pending : null;
bump();
forgetWindowOf(cardNodes);
loading = false;
pending = null;
};

this.destroy = function () {
bump();
forgetWindowOf(cardNodes);
cardNodes = [];
sortNodes = [];
emptyNodes = [];
rouletteNode = null;
lastFocus = null;
resumeAfterStop = null;
try { scroll.destroy(); } catch (e2) {}
try { root.remove(); } catch (e3) {}
};
}





var components_added = false;
var menu_node = null;

function addComponents() {
if (components_added) return;
if (!window.Lampa || !Lampa.Component || typeof Lampa.Component.add !== 'function') return;
Lampa.Component.add('lumen_hub', HubComponent);
Lampa.Component.add('lumen_grid', GridComponent);
components_added = true;
}



function addMenu() {
try {
if (menu_node && menu_node.length && menu_node.closest('body').length) return;
if ($('.lumen-menu-hub').length) return;
if (!Lampa.Menu || typeof Lampa.Menu.addButton !== 'function') return;
var node = Lampa.Menu.addButton(LC.icons.get('list'), LC.lang('lumen_hub_title'), function () {
Lampa.Activity.push({
url: '',
title: LC.lang('lumen_hub_title'),
component: 'lumen_hub',
page: 1
});
});
if (node && node.addClass) node.addClass('lumen-menu-hub');
menu_node = node;
} catch (e) {
warn('hub: menu button failed', e);
}
}

function install() {
try {
addComponents();
addMenu();
} catch (e) {
warn('hub: install failed', e);
}
}





function uninstall() {
try {
if (menu_node && menu_node.remove) menu_node.remove();
} catch (e) {
warn('hub: menu remove failed', e);
}
menu_node = null;
try { $('.lumen-menu-hub').remove(); } catch (e2) {}
}

function menuNode() {
return menu_node;
}











function franchise(root, movie) {
try {
if (!root || !root.length) return;
var old = root.find('.lumen-franchise');
if (old.length) old.remove();
root.removeClass('lumen-card--franchise');
var collection = movie && movie.belongs_to_collection;
var item = franchiseItem(collection);
if (!item) return;
var row = root.find('.full-start-new__buttons');
if (!row.length) return;
var btn = $('<div class="lumen-franchise selector">' +
'<div class="lumen-franchise__ico"></div>' +
'<span>' + esc(LC.lang('lumen_card_franchise')) + '</span>' +
'</div>');
btn.on('hover:enter', function () {
openCollection(item);
});
row.parent().append(btn);


root.addClass('lumen-card--franchise');
} catch (e) {
warn('hub: franchise button failed', e);
}
}

return {
titleOf: titleOf,
tileEm: tileEm,
gcardEm: gcardEm,
groupsWithCounts: groupsWithCounts,
tilesFor: tilesFor,
inSeason: inSeason,
openTarget: openTarget,
rouletteMedia: rouletteMedia,
franchiseItem: franchiseItem,
sortModes: sortModes,
applySort: applySort,
sortLocal: sortLocal,
needsLocalSort: needsLocalSort,
cardMedia: cardMedia,
hasMore: hasMore,
install: install,
uninstall: uninstall,
menuNode: menuNode,
franchise: franchise,

_windowNodes: function () { return lastNodes; }
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.hub;


/* ---- 47_homeplan.js ---- */











































LC.homeplan = (function () {


var MOD = 2147483647;




var FIRST_GAP = 10 * 60000;
var EPOCH_MS = 3 * 3600000;



var ANCHOR_RECENT = 5;



var SALT_ROWS = 1;
var SALT_ANCHOR = 2;
var SALT_SEASON = 3;




var PLACES = { 'continue': 1, new_episodes: 3, because: 5, soon: 8 };
var LAMPA_PLACE = 2;



var HISTORY_PLACES = { 'continue': 0, because: 1, new_episodes: 2, soon: 3 };
var HISTORY_ROWS_FROM = 4;
var PERSONAL_ORDER = ['continue', 'because', 'new_episodes', 'soon'];





var SEASON_FROM = 3;
var SEASON_TOP = 7;


var GROUP_SHARE = 4;


var LEADS_AVOID = 2;
var LEADS_KEEP = 4;








function rng(seed) {
var s = Math.floor(Math.abs(Number(seed) || 0)) % MOD;
if (s <= 0) s = 1;
return function () {
s = s * 16807 % MOD;
return (s - 1) / (MOD - 1);
};
}



function mix(x) {
x = x | 0;
x ^= x << 13;
x ^= x >>> 17;
x ^= x << 5;
return x >>> 0;
}






function seedOf(n, salt) {
var x = mix(mix((Math.floor(Number(n) || 0) + 1) | 0) ^ (salt | 0));
return (x % (MOD - 1)) + 1;
}










function nextEpoch(rec, now, firstBuild) {
var ok = rec && typeof rec.n === 'number' && isFinite(rec.n) && rec.n >= 0 &&
typeof rec.at === 'number' && isFinite(rec.at);
if (!ok) return { n: 1 + Math.floor(Math.random() * 100000), at: now };
var gap = now - rec.at;
if (gap < 0 || gap >= EPOCH_MS || (firstBuild && gap >= FIRST_GAP)) {
return { n: Math.floor(rec.n) + 1, at: now };
}
return rec;
}




function pickAnchor(history, n, seed) {
var recent = (LC.personal && typeof LC.personal.pickBecause === 'function') ? LC.personal.pickBecause(history, n) : [];
if (!recent.length) return null;
return recent[Math.floor(rng(seed)() * recent.length)];
}

function inSeason(item, month) {
if (!month || !item || !item.season) return false;
for (var i = 0; i < item.season.length; i++) if (item.season[i] === month) return true;
return false;
}

function offSeason(item, month) {
return !!(month && item && item.season && item.season.length && !inSeason(item, month));
}


function kpOnly(item) {
if (!item) return false;
if (item.group === 'kp') return true;
var s = item.sources || {};
var any = false;
if (s.movie) { if (s.movie.type !== 'kp') return false; any = true; }
if (s.tv) { if (s.tv.type !== 'kp') return false; any = true; }
return any;
}




function weightedOrder(pool, weight, rand) {
var keyed = [];
for (var i = 0; i < pool.length; i++) {
keyed.push({ item: pool[i], i: i, key: Math.pow(rand(), 1 / weight[i]) });
}
keyed.sort(function (a, b) { return (b.key - a.key) || (a.i - b.i); });
var out = [];
for (var k = 0; k < keyed.length; k++) out.push(keyed[k].item);
return out;
}







function choose(o, month, limit) {
var manifest = o.manifest;
if (!manifest || !Array.isArray(manifest.collections) || limit <= 0) return [];
var off = typeof o.off === 'function' ? o.off : function () { return false; };
var i, c;
var pool = [];
var weight = [];
var picked = o.picked && o.picked.length ? o.picked : null;
if (picked) {
var byId = {};
for (i = 0; i < manifest.collections.length; i++) byId[manifest.collections[i].id] = manifest.collections[i];
var seen = {};
for (i = 0; i < picked.length; i++) {
c = byId[picked[i]];
if (!c || seen[c.id] || off(c.id)) continue;
seen[c.id] = 1;
pool.push(c);
weight.push(1);
}
} else {
var home = {};
var ids = manifest.home || [];
for (i = 0; i < ids.length; i++) home[ids[i]] = 1;
for (i = 0; i < manifest.collections.length; i++) {
c = manifest.collections[i];
if (!c || !c.id || off(c.id)) continue;
if (!o.kpKey && kpOnly(c)) continue;
if (offSeason(c, month)) continue;
pool.push(c);
weight.push(home[c.id] ? 2 : 1);
}
}
if (!pool.length) return [];

var order = weightedOrder(pool, weight, rng(seedOf(o.epoch, SALT_ROWS)));
var recent = o.recentLeads || [];



var seasonLed = false;
for (i = 0; i < manifest.collections.length; i++) {
c = manifest.collections[i];
if (c && recent.indexOf(c.id) !== -1 && inSeason(c, month)) seasonLed = true;
}





var lead = null;
for (i = 0; i < order.length && !lead; i++) {
if (recent.indexOf(order[i].id) !== -1) continue;
if (!o.kpKey && kpOnly(order[i])) continue;
if ((o.advent || seasonLed) && inSeason(order[i], month)) continue;
lead = order[i];
}
if (!lead) lead = order[0];
var chosen = [lead];
if (!o.advent && !inSeason(lead, month)) {
for (i = 0; i < order.length; i++) {
if (inSeason(order[i], month)) { chosen.push(order[i]); break; }
}
}





var cap = picked ? limit : Math.ceil(limit / GROUP_SHARE);
var count = {};
for (i = 0; i < chosen.length; i++) count[chosen[i].group] = (count[chosen[i].group] || 0) + 1;
for (var pass = 0; pass < 2 && chosen.length < limit; pass++) {
for (i = 0; i < order.length && chosen.length < limit; i++) {
c = order[i];
if (chosen.indexOf(c) !== -1) continue;
if (!pass && (count[c.group] || 0) >= cap) continue;
chosen.push(c);
count[c.group] = (count[c.group] || 0) + 1;
}
}
return chosen.slice(0, limit);
}




function crowded(remaining) {
var count = {};
var i;
for (i = 0; i < remaining.length; i++) {
var g = remaining[i].group || '';
count[g] = (count[g] || 0) + 1;
}
for (var key in count) {
if (Object.prototype.hasOwnProperty.call(count, key) && key && count[key] > remaining.length - count[key]) return key;
}
return null;
}





function seasonPlace(taken, epoch) {
var free = [];
var p;
for (p = SEASON_FROM; p <= SEASON_TOP; p++) if (!taken[p]) free.push(p);
if (free.length) return free[Math.floor(rng(seedOf(epoch, SALT_SEASON))() * free.length)];
for (p = SEASON_TOP + 1; taken[p]; p++) {}
return p;
}









function layout(chosen, taken, month, seasonDone, seasonAt) {
var remaining = chosen.slice();
var at = {};
var out = [];
var fixed = null;
var i;
if (!seasonDone && remaining.length && !inSeason(remaining[0], month)) {
for (i = 1; i < remaining.length && !fixed; i++) {
if (inSeason(remaining[i], month)) fixed = remaining.splice(i, 1)[0];
}
}
if (fixed) at[seasonAt] = fixed;
function groupOk(prev, c) { return !prev || !prev.group || prev.group !== c.group; }
function pickFor(place) {
var prev = at[place - 1] || null;
var next = at[place + 1] || null;
var top = place <= SEASON_TOP;
var k;
function fits(c) { return groupOk(prev, c) && groupOk(next, c); }
var busy = crowded(remaining);
if (busy && (!prev || prev.group !== busy) && (!next || next.group !== busy)) {
for (k = 0; k < remaining.length; k++) {
if (remaining[k].group !== busy) continue;
if (top && inSeason(remaining[k], month)) continue;
return k;
}
}
for (k = 0; k < remaining.length; k++) {
if (!fits(remaining[k])) continue;
if (top && inSeason(remaining[k], month)) continue;
return k;
}
for (k = 0; k < remaining.length; k++) if (fits(remaining[k])) return k;
return 0;
}
var season = fixed;
for (var place = 0; remaining.length || fixed; place++) {
if (taken[place]) continue;
var item;
if (fixed && place === seasonAt) {
item = fixed;
fixed = null;
} else if (remaining.length) {
item = remaining.splice(out.length ? pickFor(place) : 0, 1)[0];
} else {
continue;
}
at[place] = item;
out.push({ place: place, kind: 'collection', id: item.id, item: item });
}
repair(out, at, month, chosen[0], season);
return out;
}


function pairs(out, at) {
var n = 0;
for (var j = 0; j < out.length; j++) {
var up = at[out[j].place - 1];
if (up && up.group && up.group === out[j].item.group) n++;
}
return n;
}

function swap(out, at, a, b) {
var x = out[a].item;
out[a].item = out[b].item;
out[b].item = x;
out[a].id = out[a].item.id;
out[b].id = out[b].item.id;
at[out[a].place] = out[a].item;
at[out[b].place] = out[b].item;
}









function repair(out, at, month, lead, season) {
var bad = pairs(out, at);
function movable(j) { return out[j].item !== lead && out[j].item !== season; }
function allowed(j, item) { return !(out[j].place <= SEASON_TOP && inSeason(item, month)); }
function tryMove(a) {
if (!movable(a)) return false;
for (var b = 0; b < out.length; b++) {
if (b === a || !movable(b) || !allowed(b, out[a].item) || !allowed(a, out[b].item)) continue;
swap(out, at, a, b);
var now = pairs(out, at);
if (now < bad) { bad = now; return true; }
swap(out, at, a, b);
}
return false;
}
for (var i = 1; i < out.length && bad; i++) {
var up = at[out[i].place - 1];
if (!up || !up.group || up.group !== out[i].item.group) continue;
if (tryMove(i) || tryMove(i - 1)) i = 0;
}
}

function byPlace(a, b) { return a.place - b.place; }














function planHome(o) {
o = o || {};
var have = o.have || {};
var limit = typeof o.limit === 'number' ? o.limit : 15;
var month = o.month || null;
var slots = [];
var taken = {};
var i;
function put(place, kind, id) {
slots.push({ place: place, kind: kind, id: id, item: null });
taken[place] = true;
}

if (o.mode === 'history') {
for (i = 0; i < PERSONAL_ORDER.length; i++) {
if (have[PERSONAL_ORDER[i]]) put(HISTORY_PLACES[PERSONAL_ORDER[i]], 'personal', PERSONAL_ORDER[i]);
}
var next = HISTORY_ROWS_FROM;
if (o.advent) put(next++, 'advent', 'advent');
var list = (o.manifest && LC.rows && typeof LC.rows.homeRows === 'function')
? LC.rows.homeRows(o.manifest, o.picked, month, limit) : [];
for (i = 0; i < list.length; i++) {
slots.push({ place: next++, kind: 'collection', id: list[i].id, item: list[i] });
}
slots.sort(byPlace);
return { slots: slots, lead: null };
}

if (o.advent) put(0, 'advent', 'advent');
for (i = 0; i < PERSONAL_ORDER.length; i++) {
if (have[PERSONAL_ORDER[i]]) put(PLACES[PERSONAL_ORDER[i]], 'personal', PERSONAL_ORDER[i]);
}
taken[LAMPA_PLACE] = true;
var chosen = choose(o, month, limit);

var cols = layout(chosen, taken, month, !!o.advent, seasonPlace(taken, o.epoch));
slots = slots.concat(cols);
slots.sort(byPlace);
return { slots: slots, lead: chosen.length ? chosen[0].id : null };
}



function recentLeads(leads, n) {
var out = [];
if (!Array.isArray(leads)) return out;
for (var i = leads.length - 1; i >= 0 && out.length < LEADS_AVOID; i--) {
var r = leads[i];
if (r && typeof r.n === 'number' && r.n < n && r.id) out.push(r.id);
}
return out;
}



function rememberLead(leads, n, id) {
var out = [];
if (Array.isArray(leads)) {
for (var i = 0; i < leads.length; i++) if (leads[i] && leads[i].n !== n) out.push(leads[i]);
}
out.push({ n: n, id: id });
return out.length > LEADS_KEEP ? out.slice(out.length - LEADS_KEEP) : out;
}





var EPOCH_KEY = 'lumen_home_epoch';
var LEADS_KEY = 'lumen_home_leads';


var _added = [];



var _manifest = null;

var _first = false;

var _hold = false;

function storage() {
return (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') ? Lampa.Storage : null;
}

function read(key, def) {
try {
var st = storage();
return st ? st.get(key, def) : def;
} catch (e) {
return def;
}
}



function write(key, value) {
try {
if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.set === 'function') Lampa.Storage.set(key, value, true);
} catch (e) {}
}




function rowOn(name) {
return !!read('content_rows_' + name, 'true');
}

function monthNow() {
try {
if (LC.themes && typeof LC.themes.month === 'function') return LC.themes.month();
} catch (e) {}
return new Date().getMonth() + 1;
}

function unregister() {
for (var i = 0; i < _added.length; i++) {
try {
if (window.Lampa && Lampa.ContentRows && typeof Lampa.ContentRows.remove === 'function') Lampa.ContentRows.remove(_added[i]);
} catch (e) {}
}
_added = [];
}

function hold(on) {
_hold = !!on;
}









function apply(opts) {
opts = opts || {};
if (opts.manifest) _manifest = opts.manifest;
if (opts.start) _first = true;
var now = api._now();
var stored = read(EPOCH_KEY, '');
var epoch = stored && typeof stored === 'object' ? stored : null;
var next;
if (opts.fresh) {
var first = _first;
_first = false;
next = (first || !_hold) ? nextEpoch(epoch, now, first) : epoch;
} else {
next = epoch;
}
if (!next) next = nextEpoch(null, now, false);
if (next !== stored) write(EPOCH_KEY, next);
epoch = next;

var mode = LC.pref('lumen_home_start', 'rotate') === 'history' ? 'history' : 'rotate';
var picked = (LC.rows && typeof LC.rows.storedIds === 'function') ? LC.rows.storedIds() : null;
var limit = parseInt(LC.pref('lumen_rows_limit', '15'), 10) || 15;
var anchorSeed = seedOf(epoch.n, SALT_ANCHOR);
var own = {};
var have = {};


var offRows = [];
var i;
try {
var personal = (LC.personal && typeof LC.personal.describe === 'function')
? LC.personal.describe({ anchor: function (history) { return pickAnchor(history, ANCHOR_RECENT, anchorSeed); } })
: [];
for (i = 0; i < personal.length; i++) {
if (!rowOn(personal[i].name)) { offRows.push(personal[i]); continue; }
own[personal[i].id] = personal[i];
have[personal[i].id] = true;
}
} catch (ePersonal) {}
var advent = null;
try {
if (_manifest && LC.rows && typeof LC.rows.adventRow === 'function') advent = LC.rows.adventRow(_manifest);
} catch (eAdvent) {}
if (advent && !rowOn(advent.name)) { offRows.push(advent); advent = null; }
var leads = read(LEADS_KEY, '[]');
if (!Array.isArray(leads)) leads = [];

var plan = planHome({
manifest: _manifest,
picked: picked,
month: monthNow(),
epoch: epoch.n,
have: have,
recentLeads: recentLeads(leads, epoch.n),
kpKey: !!LC.pref('lumen_kp_key', ''),
limit: limit,
mode: mode,
advent: !!advent,
off: function (id) { return !rowOn('lumen_' + id); }
});

unregister();
var pinned = !!(picked && picked.length);
var named = {};
var place = 0;
function register(row) {
try {
if (window.Lampa && Lampa.ContentRows && typeof Lampa.ContentRows.add === 'function') {
Lampa.ContentRows.add(row);
_added.push(row);
named[row.name] = true;
}
} catch (eAdd) {}
}
for (i = 0; i < plan.slots.length; i++) {
var slot = plan.slots[i];
var row = null;
try {
if (slot.kind === 'personal') row = own[slot.id];
else if (slot.kind === 'advent') row = advent;
else if (LC.rows && typeof LC.rows.describe === 'function') row = LC.rows.describe(slot.item, pinned);
} catch (eRow) {}
if (!row) continue;
row.index = slot.place;
place = slot.place + 1;
register(row);
}











try {
var catalog = (_manifest && Array.isArray(_manifest.collections)) ? _manifest.collections : [];
for (i = 0; i < catalog.length; i++) {
if (catalog[i] && catalog[i].id && !rowOn('lumen_' + catalog[i].id) && LC.rows && typeof LC.rows.describe === 'function') {
offRows.push(LC.rows.describe(catalog[i], pinned));
}
}
} catch (eOff) {}
for (i = 0; i < offRows.length; i++) {
if (!offRows[i] || named[offRows[i].name]) continue;
offRows[i].index = place++;
register(offRows[i]);
}

if (plan.lead) {
var last = leads.length ? leads[leads.length - 1] : null;
if (!last || last.n !== epoch.n || last.id !== plan.lead) write(LEADS_KEY, rememberLead(leads, epoch.n, plan.lead));
}
return plan;
}

var api = {
rng: rng,
seedOf: seedOf,
nextEpoch: nextEpoch,
pickAnchor: pickAnchor,
planHome: planHome,
recentLeads: recentLeads,
rememberLead: rememberLead,
apply: apply,
unregister: unregister,
hold: hold,

_now: function () { return Date.now(); }
};
return api;
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.homeplan;


/* ---- 47_homerow.js ---- */





















































LC.homeRow = (function () {


var MAX_STEPS = 60;

var MAX_DEPTH = 40;

var bound = null;

var last = null;

var origin = null;





var armed = null;






var prevCtl = '';
var climb = null;

function lineOf(el) {
var node = el;
for (var i = 0; node && i < MAX_DEPTH; i++) {
if (node.classList && node.classList.contains('items-line')) return node;
node = node.parentNode;
}
return null;
}





function above(a, b) {
if (!a || !b || a === b || !a.parentNode || a.parentNode !== b.parentNode) return false;
try {

return !!(a.compareDocumentPosition(b) & 4);
} catch (e) {
return false;
}
}

function onMain() {
try {
var act = Lampa.Activity.active();
return !!(act && act.component === 'main');
} catch (e) {
return false;
}
}

function tvScreen() {
try {
if (Lampa.Platform && typeof Lampa.Platform.screen === 'function') return Lampa.Platform.screen('tv') !== false;
} catch (e) { }
return true;
}

function onFocus(e) {
try {
if (!LC.focus.remote(e)) return;
var el = e && e.target;
if (!el || !el.classList || !el.classList.contains('card')) return;
var line = lineOf(el);
if (!line || !onMain()) return;
var up = !!last && above(line, last.line);
last = { line: line, card: el };
if (!up) origin = last;
} catch (err) {
warn('homeRow: focus failed', err);
}
}

function install() {
if (bound) return;
try {
var body = typeof document !== 'undefined' ? document.body : null;
if (body && LC.focus.capture(body, onFocus)) bound = body;
} catch (e) {
warn('homeRow: install failed', e);
}
}

function uninstall() {
if (bound) {
try { LC.focus.release(bound, onFocus); } catch (e) { }
}
bound = null;
last = null;
origin = null;
armed = null;
prevCtl = '';
climb = null;
}

function arm() {
armed = onMain() ? (climb || last) : null;
}

function inDocument(node) {
try {
return !!(node && document.body && document.body.contains(node));
} catch (e) {
return false;
}
}

function goBack(target) {
try {
if (!target || !onMain() || !tvScreen() || !inDocument(target.line)) return;
var ctl = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
var name = ctl && ctl.name;
if (name === 'head') Lampa.Controller.toggle('content');
else if (name !== 'content' && name !== 'items_line') return;
for (var i = 0; i < MAX_STEPS; i++) {
var cur = last && last.line;
if (!cur || !above(cur, target.line)) break;
Lampa.Controller.move('down');
if ((last && last.line) === cur) break;
}
} catch (e) {
warn('homeRow: return failed', e);
}
}

function rows(name) {
return name === 'items_line' || name === 'content';
}

function onToggle(name) {
var from = prevCtl;
prevCtl = name;
if (rows(name)) climb = null;
else if (name === 'head' && rows(from)) climb = origin;
if (!armed) return;
if (name !== 'head' && name !== 'content' && name !== 'items_line') return;
var target = armed;
armed = null;
setTimeout(function () { goBack(target); }, 0);
}

return {
install: install,
uninstall: uninstall,
arm: arm,
onToggle: onToggle
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.homeRow;


/* ---- 48_hero.js ---- */






































LC.hero = (function () {


var DELAY = 350;













var BURST_GAP = 700;
var BURST_DELAY = 700;








var ACCENT_DELAY = 3000;






var TRAILER_DELAY = 8000;


var VIDEOS_LIFE = 10080;





var VIDEOS_LIMIT = 25000;

var SWAP_MS = 180;


var TITLE_WAIT = 600;


var LOAD_TIMEOUT = 8000;



var DETAILS_LIFE = 1440;




var TEXT_ZOOM = 1.1;












var LOGO_EM = 37.84;























































var LOGO_AREA = 101.56;
var LOGO_H_MAX = 6.5;
var LOGO_H_MIN = 3;
var LOGO_W_MAX = 37.84;




























var CARD_TITLE_EM = 3.33;
var CARD_LOGO_H_MAX = 2;

var MOTION_CLASSES = 'lumen-motion-full lumen-motion-lite lumen-motion-off';


var HERO_GENRES = 2;



var HERO_BD_MIN_W = 1280;
var HERO_BD_RATIO = 1.778;
var HERO_BD_RATIO_TOL = 0.05;


var HERO_BD_VOTE_K = 0.5;



var HERO_BD_REJECT = 1;




var FRAME_WAIT = 900;




var LOOK_WAIT = 300;



var HOLD_MS = 250;


var HOLD_DECODE = 150;









function pickLogoItem(logos, lang) {
lang = lang || 'ru';
var own = null;
var en = null;
var neutral = null;
for (var i = 0; logos && i < logos.length; i++) {
var item = logos[i];
if (!item || !item.file_path) continue;
var code = item.iso_639_1 || '';
if (code === lang) { if (!own) own = item; }
else if (code === 'en') { if (!en) en = item; }
else if (!code) { if (!neutral) neutral = item; }
}
var picked = own || en || neutral || null;
return picked ? lightLogo(logos, picked) : null;
}











var SIBLINGS_MAX = 2;
var logoSiblings = {};
var siblingKeys = 0;

function logoTone(path) {
try {
return path && LC.thumbs && typeof LC.thumbs.toneOf === 'function' ? LC.thumbs.toneOf(path) : undefined;
} catch (e) {
return undefined;
}
}

function lightLogo(logos, picked) {
var code = picked.iso_639_1 || '';
var sibs = [];
for (var i = 0; logos && i < logos.length; i++) {
var item = logos[i];
if (!item || !item.file_path || item.file_path === picked.file_path) continue;
if ((item.iso_639_1 || '') !== code) continue;
sibs.push(item);
}
if (!sibs.length) return picked;
if (!Object.prototype.hasOwnProperty.call(logoSiblings, picked.file_path)) {
if (siblingKeys >= 400) { logoSiblings = {}; siblingKeys = 0; }
siblingKeys++;
var paths = [];
for (var k = 0; k < sibs.length && paths.length < SIBLINGS_MAX; k++) paths.push(sibs[k].file_path);
logoSiblings[picked.file_path] = paths;
}
if (logoTone(picked.file_path) !== 'dark') return picked;
for (var j = 0; j < sibs.length; j++) {
if (logoTone(sibs[j].file_path) === 'light') return sibs[j];
}
return picked;
}

function pickLogo(logos, lang) {
var item = pickLogoItem(logos, lang);
return item ? item.file_path : null;
}





function logoRatioOf(item) {
if (!item) return 0;
var ratio = Number(item.aspect_ratio) || 0;
if (ratio > 0) return ratio;
var w = Number(item.width) || 0;
var h = Number(item.height) || 0;
return (w > 0 && h > 0) ? w / h : 0;
}

function round2(n) {
return Math.round(n * 100) / 100;
}





function logoBox(ratio) {
var r = Number(ratio) || 0;
if (!(r > 0)) return null;
var h = Math.sqrt(LOGO_AREA / r);
if (h > LOGO_H_MAX) h = LOGO_H_MAX;
if (h < LOGO_H_MIN) h = LOGO_H_MIN;
var w = h * r;
if (w > LOGO_W_MAX) {
w = LOGO_W_MAX;
h = w / r;
}
return { w: round2(w), h: round2(h) };
}










function cardLogoBox(ratio) {
var box = logoBox(ratio);
if (!box) return null;
var r = Number(ratio);
var k = TEXT_ZOOM / CARD_TITLE_EM;
var h = box.h * k;
var w = box.w * k;
if (h > CARD_LOGO_H_MAX) {
h = CARD_LOGO_H_MAX;
w = h * r;
}
return { w: round2(w), h: round2(h) };
}




function mediaOf(card) {
if (card && card.media_type) return card.media_type;
return (card && card.name) ? 'tv' : 'movie';
}

function yearOf(card) {
var date = '' + ((card && (card.release_date || card.first_air_date)) || '');
return date ? date.slice(0, 4) : '';
}




















function goodFrames(list, key) {
var floor = 0;
for (var k = 0; list && k < list.length; k++) {
if (list[k] && list[k].file_path === key && Number(list[k].vote_count) >= 1) {
floor = (Number(list[k].vote_average) || 0) * HERO_BD_VOTE_K;
break;
}
}
var out = [];
for (var i = 0; list && i < list.length; i++) {
var b = list[i];
if (b && Number(b.vote_count) >= 1 && Number(b.vote_average) >= floor && Number(b.vote_average) >= HERO_BD_REJECT) out.push(b);
}
return out;
}























function slideFrames(list) {
var out = [];
for (var i = 0; list && i < list.length; i++) {
var b = list[i];
if (!b) continue;
if (Number(b.vote_count) >= 1 && Number(b.vote_average) < HERO_BD_REJECT) continue;
out.push(b);
}
return out;
}
























function heroBackdrop(images, main) {
var list = goodFrames(images && images.backdrops, main);
for (var i = 0; i < list.length; i++) {
if (wideFrame(list[i], main)) return list[i].file_path;
}
return main || '';
}



function wideFrame(b, main) {
if (!b || !b.file_path || b.iso_639_1 || b.file_path === main) return false;
var w = Number(b.width) || 0;
var h = Number(b.height) || 0;
var ratio = Number(b.aspect_ratio) || (w > 0 && h > 0 ? w / h : 0);
return w >= HERO_BD_MIN_W && Math.abs(ratio - HERO_BD_RATIO) < HERO_BD_RATIO_TOL;
}











var LOOK_MAX = 3;

function frameCandidates(images, main) {
var list = images && images.backdrops;
var paths = [];
var good = goodFrames(list, main);
var i;
for (i = 0; i < good.length && paths.length < LOOK_MAX; i++) {
if (wideFrame(good[i], main)) paths.push(good[i].file_path);
}
var strong = paths.length;
var rest = slideFrames(list);
for (i = 0; i < rest.length && paths.length < LOOK_MAX; i++) {
if (wideFrame(rest[i], main) && paths.indexOf(rest[i].file_path) === -1) paths.push(rest[i].file_path);
}
return { paths: paths, strong: strong };
}













function pickFrame(cands, strong, verdictOf, fallback, late) {
for (var i = 0; i < cands.length; i++) {
var v = verdictOf(cands[i]);
if (v === false) return { path: cands[i], wait: '' };
if (v === true) continue;
if (v === null) break;
if (!late) return { path: '', wait: cands[i] };
for (var j = 0; j < strong && j < cands.length; j++) {
if (verdictOf(cands[j]) !== true) return { path: cands[j], wait: '' };
}
break;
}
return { path: fallback || '', wait: '' };
}








function heroModel(card, details, words) {
if (!card) return null;
words = words || {};
details = details || null;

var media = mediaOf(card);
var meta = [];
var year = yearOf(card);
if (year) meta.push(year);

if (details) {
if (media === 'tv') {
var seasons = Number(details.number_of_seasons) || 0;
if (seasons > 0) {
meta.push(seasons + ' ' + (words.seasonsWord ? words.seasonsWord(seasons) : ''));
}
} else {
var runtime = LC.util.fmtRuntime(Number(details.runtime) || 0, words.min || '');
if (runtime) meta.push(runtime);
}



var genres = LC.cardinfo.genres(details.genres, words.cap).slice(0, HERO_GENRES);
if (genres.length) meta.push(genres.join(', '));
}



var status = '';
var next = details && details.next_episode_to_air;
if (next && next.air_date) {
var when = LC.cardinfo.shortDate(next.air_date, words.months);
if (when) status = (words.airing || '') + ' · ' + when;
}

var vote = Number(card.vote_average) || 0;
var logoItem = details ? pickLogoItem(details.images && details.images.logos, words.lang) : null;

return {
id: card.id,
media: media,
title: card.title || card.name || '',


backdrop: heroBackdrop(details && details.images, (details && details.backdrop_path) || card.backdrop_path || ''),
poster: card.poster_path || (details && details.poster_path) || '',
logo: logoItem ? logoItem.file_path : null,



logoRatio: logoRatioOf(logoItem),
meta: meta,
overview: (details && details.overview) || card.overview || '',




rating: vote >= 1 ? vote.toFixed(1) : '',
status: status,
pending: !details
};
}




function shouldUpdate(prevId, nextId, elapsedMs, delay) {
if (nextId == null) return false;
if (prevId === nextId) return false;
return (elapsedMs || 0) >= (delay || 0);
}











function trailerAllowed(pref, motion, trailer) {
if (pref === false) return false;
if (motion === 'off') return false;
return trailer !== 'off';
}







function sizeFor(width) {
return LC.util.frameSize(width);
}

























function logoSizeFor(width) {
return (Number(width) || 0) * 0.85 > 500 ? 'w780' : 'w500';
}


function imageLanguages(lang) {
lang = lang || 'ru';
return lang === 'en' ? 'en,null' : lang + ',en,null';
}






function detailsRequest(media, id, lang) {
return {
url: media + '/' + id,




params: { filter: { append_to_response: 'images,keywords', include_image_language: imageLanguages(lang) } },
life: DETAILS_LIFE
};
}








var state = null;


var gen = 0;






var tgen = 0;













var logoSeen = {};






























var LOGO_KEEP = 24;
var LOGO_BYTES = 16 * 1024 * 1024;
var logoFlight = {};
var logoKept = [];
var logoBytes = 0;

function dropKept(path) {
for (var i = 0; i < logoKept.length; i++) {
if (logoKept[i].path === path) {
logoBytes -= logoKept[i].bytes;
return logoKept.splice(i, 1)[0];
}
}
return null;
}

function keepLogo(path, img) {
dropKept(path);
var bytes = (Number(img.naturalWidth) || 0) * (Number(img.naturalHeight) || 0) * 4;
logoKept.push({ path: path, img: img, bytes: bytes });
logoBytes += bytes;


while (logoKept.length > 1 && (logoKept.length > LOGO_KEEP || logoBytes > LOGO_BYTES)) {
var old = logoKept.shift();
logoBytes -= old.bytes;
if (logoSeen[old.path] === 'ok') delete logoSeen[old.path];
}
}





function touchLogo(path) {
var hit = dropKept(path);
if (!hit) return;
logoKept.push(hit);
logoBytes += hit.bytes;
}




function logoState(path) {
if (!path) return '';
if (logoFlight[path]) return 'load';
return logoSeen[path] || '';
}

function unhookLogo(fl) {
fl.img.onload = null;
fl.img.onerror = null;
if (fl.timer) {
clearTimeout(fl.timer);
fl.timer = null;
}
if (fl.linger) {
clearTimeout(fl.linger);
fl.linger = null;
}
}












var LOGO_LINGER = 1500;

function holdLogo(path) {
var fl = path ? logoFlight[path] : null;
if (fl) fl.keep = Date.now() + LOGO_LINGER;
}

function dropFlight(path, fl) {
if (fl.subs.length || logoFlight[path] !== fl) return;


delete logoFlight[path];
unhookLogo(fl);
if (fl.probe) {
fl.probe.cancel();
fl.probe = null;
if (Object.prototype.hasOwnProperty.call(toneProbes, path) && toneProbes[path].fl === fl) delete toneProbes[path];
}
try {
if (typeof fl.img.removeAttribute === 'function') fl.img.removeAttribute('src');
} catch (e) {}
}




function landLogo(path, fl, ok) {
if (logoFlight[path] !== fl) return;
delete logoFlight[path];
unhookLogo(fl);
logoSeen[path] = ok ? 'ok' : (logoSeen[path] === 'retry' ? 'fail' : 'retry');
if (ok) keepLogo(path, fl.img);




if (ok && fl.probe) {
fl.late = setTimeout(function () {
fl.late = null;
tellLogo(fl, true);
}, TONE_WAIT);
return;
}
tellLogo(fl, ok);
}

function tellLogo(fl, ok) {
if (fl.told) return;
fl.told = true;
if (fl.late) {
clearTimeout(fl.late);
fl.late = null;
}
var subs = fl.subs;
fl.subs = [];
for (var i = 0; i < subs.length; i++) {
try {
if (subs[i].done) subs[i].done(ok);
} catch (e) {
warn('hero: logo callback failed', e);
}
}
}


var TONE_WAIT = 250;














var toneProbes = {};

function probeTone(path, fl) {
if (!LC.thumbs || typeof LC.thumbs.tone !== 'function' || logoTone(path) !== undefined) return;
if (Object.prototype.hasOwnProperty.call(toneProbes, path)) return;
var entry = { job: null, fl: fl || null };
toneProbes[path] = entry;
var done = false;
var probe = LC.thumbs.tone(path, function (tone) {
done = true;
if (toneProbes[path] === entry) delete toneProbes[path];
if (entry.fl) entry.fl.probe = null;
if (tone === 'dark') probeSiblings(path);
if (entry.fl && entry.fl.late) tellLogo(entry.fl, true);
});
if (done) return;
entry.job = probe;
if (fl) fl.probe = probe;
}

function probeSiblings(path) {
if (!LC.thumbs || typeof LC.thumbs.tone !== 'function') return;
var sibs = Object.prototype.hasOwnProperty.call(logoSiblings, path) ? logoSiblings[path] : null;
for (var i = 0; sibs && i < sibs.length; i++) {
if (logoTone(sibs[i]) === undefined && !Object.prototype.hasOwnProperty.call(toneProbes, sibs[i])) probeSibling(path, sibs[i]);
}
}

function probeSibling(path, sib) {
var entry = { job: null, fl: null };
toneProbes[sib] = entry;
var done = false;
try {
var probe = LC.thumbs.tone(sib, function (tone) {
done = true;
if (toneProbes[sib] === entry) delete toneProbes[sib];
if (tone === 'light') preloadLight(path, sib);
});
if (!done) entry.job = probe;
} catch (e) {
if (toneProbes[sib] === entry) delete toneProbes[sib];
warn('hero: logo tone failed', e);
}
}








function preloadLight(path, sib) {
var sibs = Object.prototype.hasOwnProperty.call(logoSiblings, path) ? logoSiblings[path] : [];
for (var i = 0; i < sibs.length && sibs[i] !== sib; i++) {
if (logoTone(sibs[i]) === 'light') return;
}
if (!logoAllowed() || logoSeen[sib] === 'ok' || logoSeen[sib] === 'fail' || logoFlight[sib]) return;
var url = logoUrl(sib);
if (url) preloadLogo(sib, url, function () {});
}




function dropTones(path) {
if (!path) return;
var list = [path].concat(Object.prototype.hasOwnProperty.call(logoSiblings, path) ? logoSiblings[path] : []);
for (var i = 0; i < list.length; i++) {
if (!Object.prototype.hasOwnProperty.call(toneProbes, list[i])) continue;
var entry = toneProbes[list[i]];
delete toneProbes[list[i]];
try {
if (entry.job) entry.job.cancel();
} catch (e) {
warn('hero: logo tone cancel failed', e);
}
if (entry.fl) {
entry.fl.probe = null;
if (entry.fl.late) tellLogo(entry.fl, true);
}
}
}

function flyLogo(path, url) {
var img = new Image();
img.decoding = 'async';



var fl = { img: img, subs: [], timer: null, keep: 0, linger: null, probe: null, late: null, told: false };
logoFlight[path] = fl;
img.onload = function () { landLogo(path, fl, true); };
img.onerror = function () { landLogo(path, fl, false); };

fl.timer = setTimeout(function () {
fl.timer = null;
landLogo(path, fl, !!(img.complete && img.naturalWidth));
}, LOAD_TIMEOUT);
img.src = url;

probeTone(path, fl);
return fl;
}

function leaveLogo(path, fl, sub) {
var i = fl.subs.indexOf(sub);
if (i !== -1) fl.subs.splice(i, 1);
if (fl.subs.length || logoFlight[path] !== fl) return;

var wait = (fl.keep || 0) - Date.now();
if (wait > 0) {
if (!fl.linger) {
fl.linger = setTimeout(function () {
fl.linger = null;
dropFlight(path, fl);
}, wait);
}
return;
}
dropFlight(path, fl);
}






function preloadLogo(path, url, done) {
var fl = logoFlight[path] || flyLogo(path, url);

if (fl.linger) {
clearTimeout(fl.linger);
fl.linger = null;
}
var sub = { done: done };
fl.subs.push(sub);
return { cancel: function () { leaveLogo(path, fl, sub); } };
}






















function waitLogo(path, url, decide) {
if (!path || !url || logoSeen[path] === 'fail') {
decide(false);
return { cancel: function () {} };
}
if (logoSeen[path] === 'ok') {
touchLogo(path);
decide(true);
return { cancel: function () {} };
}
var decided = false;
var ceiling = null;
function once(show) {
if (decided) return;
decided = true;
if (ceiling) {
clearTimeout(ceiling);
ceiling = null;
}
decide(show);
}
var load = preloadLogo(path, url, function (ok) { once(ok); });





ceiling = setTimeout(function () {
ceiling = null;
once(logoSeen[path] === 'ok');
}, TITLE_WAIT);
return {
cancel: function () {
decided = true;
if (ceiling) {
clearTimeout(ceiling);
ceiling = null;
}



load.cancel();
}
};
}

function tmdbImageFn() {
if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function') {
return function (url) { return Lampa.TMDB.image(url); };
}
return null;
}

function apiImgFn() {
if (window.Lampa && Lampa.Api && typeof Lampa.Api.img === 'function') {
return function (path, size) { return Lampa.Api.img(path, size); };
}
return null;
}



function imageUrl(path, size) {
try {
return LC.cardinfo.imageUrl(path, size, tmdbImageFn(), apiImgFn());
} catch (e) {
return '';
}
}



function screenWidth() {
return LC.util.screenPx();
}

function langCode() {
try {
if (typeof LC.langCode === 'function') return LC.langCode();
} catch (e) {}
return 'ru';
}



function words() {
var months = [];
try { months = ('' + LC.lang('lumen_card_months_short')).split(','); } catch (e) {}
var cap = null;
try {
if (window.Lampa && Lampa.Utils && typeof Lampa.Utils.capitalizeFirstLetter === 'function') {
cap = function (s) { return Lampa.Utils.capitalizeFirstLetter(s); };
}
} catch (eCap) {}
return {
min: LC.lang('lumen_card_min'),
airing: LC.lang('lumen_hero_airing'),
months: months,
seasonsWord: LC.seasonsWord,
cap: cap,
lang: langCode()
};
}












































function buildStage() {
return $('<div class="lumen-hero-stage">' +
'<img class="lumen-hero__lqip" decoding="async" alt="">' +
'<img class="lumen-hero__bg lumen-hero__bg--a" decoding="async" fetchpriority="high" alt="">' +
'<img class="lumen-hero__bg lumen-hero__bg--b" decoding="async" fetchpriority="high" alt="">' +
'<div class="lumen-hero__trailer"></div>' +
'<div class="lumen-hero__scrim lumen-hero__scrim--l"></div>' +
'<div class="lumen-hero__scrim"></div>' +
'<div class="lumen-hero__floor"></div>' +
'</div>');
}

function buildNode() {




var node = $('<div class="lumen-hero">' +
'<div class="lumen-fx"></div>' +
'</div>');














var text = $('<div class="lumen-hero__text">' +
'<div class="lumen-hero__logo"></div>' +
'<div class="lumen-hero__title"></div>' +
'<div class="lumen-hero__meta"></div>' +



'<div class="lumen-hero__sk lumen-hero__sk--meta lumen-skeleton"></div>' +
'<div class="lumen-hero__descr"></div>' +
'<div class="lumen-hero__sk lumen-hero__sk--descr lumen-skeleton"></div>' +
'<div class="lumen-hero__sk lumen-hero__sk--short lumen-skeleton"></div>' +
'<div class="lumen-hero__chips">' +
'<div class="lumen-hero__status"></div>' +
'</div>' +




'</div>');
node.append(text);
return node;
}


function isMounted() {
try {
var el = state && state.node && state.node[0];
return !!(el && document.body && document.body.contains && document.body.contains(el));
} catch (e) {


return !!state;
}
}

function applyMotion() {
try {
if (!state) return;
var mode = LC.motionMode();
state.node.removeClass(MOTION_CLASSES).addClass('lumen-motion-' + mode);



state.stage.removeClass(MOTION_CLASSES).addClass('lumen-motion-' + mode);



applyTrailer();

applySlides();






var was = state.motion;
state.motion = mode;
if (mode === 'off') offFrame();
else if (was === 'off') onFrame();
} catch (e) {
warn('hero: motion failed', e);
}
}

function offFrame() {
stopTimer('loadTimer');
stopTimer('holdTimer');
state.holdDue = false;
if (state.loader) {
dropLoader(state.loader);
state.loader = null;
}
neutralFrame();


state.stage.find('.lumen-hero__bg').removeAttr('src');
}

function onFrame() {
if (state.parked || state.frameUrl || state.framePath === null || !state.model) return;
var captured = gen;
loadFrame({ backdrop: state.framePath, poster: state.model.poster }, captured, function (ok) {
if (ok && state && gen === captured) state.frameId = state.shownId;
});
}

function motionMode() {
try { return LC.motionMode(); } catch (e) { return 'full'; }
}





function stopTimer(name) {
if (!state || !state[name]) return;
try { clearTimeout(state[name]); } catch (e) {}
state[name] = null;
}










function cancelPending() {
if (!state) return;
stopTimer('loadTimer');
stopTimer('swapTimer');

stopTimer('titleTimer');


stopTimer('frameWait');
stopTimer('holdTimer');


stopTimer('lookTimer');
if (state.look) {
state.look.cancel();
state.look = null;
}



if (state.logoLoader) {
state.logoLoader.cancel();
state.logoLoader = null;
}
if (state.loader) {
dropLoader(state.loader);
state.loader = null;
}
state.detailsWait = false;
}







function dropLoader(loader) {
loader.onload = null;
loader.onerror = null;
try {
if (typeof loader.removeAttribute === 'function') loader.removeAttribute('src');
} catch (e) {}
}





















function trailerPref() {
try { return LC.pref ? LC.pref('lumen_hero_trailer', true) !== false : true; } catch (e) { return true; }
}



function trailerNote(st, ticket) {
try {
if (LC.trailer && typeof LC.trailer.note === 'function') return LC.trailer.note(st, ticket);
} catch (e) { }
return 0;
}











function planDone(st) {
if (!state || !state.trailerPlan) return;
var ticket = state.trailerPlan;
state.trailerPlan = 0;
if (st) trailerNote(st, ticket);
}

function trailerMode() {
try {
if (LC.trailer && typeof LC.trailer.mode === 'function') return LC.trailer.mode();
} catch (e) { }
return 'on';
}




function fxHeavy() {
try {
if (typeof LC.fxHeavy === 'function') return LC.fxHeavy();
} catch (e) { }
return true;
}










function heroMedia() {
try { return LC.pref ? LC.pref('lumen_hero_media', 'trailer') : 'trailer'; } catch (e) { return 'trailer'; }
}

function trailerReady() {
if (heroMedia() === 'frames') return false;
return trailerAllowed(trailerPref(), motionMode(), trailerMode());
}
















function trailerBlocked() {
return LC.util.playerOpen() || LC.util.overlayOpen() || homeHidden();
}

function homeHidden() {
try {
var list = document.body && document.body.classList;
if (list && list.contains('ambience--enable')) return true;
return !!(typeof document.querySelector === 'function' && document.querySelector('.search-box'));
} catch (e) {
return false;
}
}








function forgetTrailerFocus() {
if (!state) return;
state.focusEl = null;
state.trailerCard = null;
}
































function onToggle() {
if (!state || !(state.trailerTimer || state.trailer)) return;
setTimeout(function () {
if (!state) return;
if (state.trailer && homeHidden()) {
cancelTrailer();
forgetTrailerFocus();
return;
}
if (state.trailerTimer && trailerBlocked()) forgetTrailerFocus();
}, 0);
}






var playerHook = null;

function listenPlayer() {
if (playerHook) return;
try {
if (!window.Lampa || !Lampa.Player || !Lampa.Player.listener || typeof Lampa.Player.listener.follow !== 'function') return;
playerHook = function () {
cancelTrailer();
forgetTrailerFocus();
};
Lampa.Player.listener.follow('start', playerHook);
} catch (e) {
playerHook = null;
warn('hero: player listener failed', e);
}
}

function unlistenPlayer() {
var fn = playerHook;
playerHook = null;
if (!fn) return;
try {
if (window.Lampa && Lampa.Player && Lampa.Player.listener && typeof Lampa.Player.listener.remove === 'function') {
Lampa.Player.listener.remove('start', fn);
}
} catch (e) {
warn('hero: player unlisten failed', e);
}
}

















var FX_CALM_MS = 1500;

var FX_SAFE = { left: 0, top: 0.4, right: 0.5, bottom: 1, floor: 0.15, feather: 0.08 };






var benchPreset = null;
var benchHeld = false;

function fxHost() {
if (!state || !state.node) return null;
var node = state.node.find('.lumen-fx');
return node && node.length ? node : null;
}



function clearFx() {
var host = fxHost();
if (host) {
try { if (LC.fx) LC.fx.unmount(host); } catch (e) { warn('hero: fx unmount failed', e); }
}


if (state && state.node && LC.themes) {
try { state.node.removeClass(LC.themes.classNames()); } catch (e2) { warn('hero: fx class failed', e2); }
}
}



function applyFx() {
if (!state) return;
clearFx();
if (!LC.fx) return;
var theme = null;
if (benchPreset) {

theme = { id: '', preset: benchPreset };
} else {
if (!state.details || !LC.themes) return;
try { theme = LC.themes.forMovie(state.details); } catch (e) { warn('hero: fx theme failed', e); }
}
if (!theme) return;
if (theme.id) {
try { state.node.addClass('lumen-theme--' + theme.id); } catch (e2) { }
}
var host = fxHost();
if (!host) return;
try {
LC.fx.mount(host, theme.preset, {
color: theme.id && LC.themes ? LC.themes.particleColor(theme) : '#FFFFFF',






safe: FX_SAFE,
























paused: function () {
return !!(state && (state.trailer || state.compact || state.parked ||
Date.now() - state.focusAt < FX_CALM_MS));
}
});
} catch (e3) {
warn('hero: fx mount failed', e3);
}
}






function cancelTrailer() {
if (!state) return;
tgen++;
stopTimer('trailerTimer');
stopTimer('videosTimer');
planDone('stop');
state.trailerCard = null;
if (state.trailer) {
var control = state.trailer;
state.trailer = null;
try { if (control.destroy) control.destroy(); } catch (e2) {
warn('hero: trailer destroy failed', e2);
}
}
markTrailer(false);


trailerOff();
}



function markTrailer(on) {
if (!state) return;
try {
state.node.toggleClass('lumen-hero--trailer', !!on);
state.stage.toggleClass('lumen-hero-stage--trailer', !!on);
} catch (e) { }
}





function trailerOn() {
if (!state) return;
state.trailerOn = true;
if (state.slides) {
try { state.slides.pause(); } catch (e) { warn('hero: slides pause failed', e); }
}
}

function trailerOff() {
if (!state || !state.trailerOn) return;
state.trailerOn = false;
if (state.slides && !slidesHeld()) {
try { state.slides.resume(); } catch (e) { warn('hero: slides resume failed', e); }
}
}








function slidesHeld() {
return !!(state && (state.trailerOn || state.compact || state.parked || focusAway()));
}

















function loadTrailer(card, captured) {
var media = mediaOf(card);
var lang = langCode();

function ask(code, next) {
var over = false;
function fail() {
if (over) return;
over = true;
if (tgen !== captured || !state) return;
stopTimer('videosTimer');
if (next) ask(next, '');
else planDone('err req');
}
try {
if (!window.Lampa || !Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb) { planDone('stop'); return; }
stopTimer('videosTimer');
state.videosTimer = setTimeout(function () {
if (state && tgen === captured) state.videosTimer = null;
fail();
}, VIDEOS_LIMIT);
Lampa.Api.sources.tmdb.get(
media + '/' + card.id + '/videos',
{ langs: code },
function (json) {
if (over) return;
over = true;
if (tgen !== captured || !state) return;
stopTimer('videosTimer');
if (!isMounted()) { planDone('stop'); return; }
var video = null;
try {
if (LC.trailer && typeof LC.trailer.pickTrailer === 'function') video = LC.trailer.pickTrailer(json && json.results);
} catch (ePick) {
warn('hero: trailer pick failed', ePick);
}
if (video && video.key) { startTrailer(video.key, captured); return; }
if (next) ask(next, '');
else {
planDone('');
trailerNote('none');
}
},
fail,
{ life: VIDEOS_LIFE }
);
} catch (e) {
warn('hero: trailer request failed', e);
over = true;
if (tgen === captured) {
stopTimer('videosTimer');
planDone('err req');
}
}
}

ask(lang, lang === 'en' ? '' : 'en');
}

function startTrailer(key, captured) {
var handed = false;
try {
if (tgen !== captured || !state) return;
if (!isMounted()) { planDone('stop'); return; }
if (!trailerReady()) { planDone('stop'); return; }
if (trailerBlocked()) { planDone('stop'); forgetTrailerFocus(); return; }
if (!LC.trailer || typeof LC.trailer.player !== 'function') { planDone('stop'); return; }
var host = state.stage.find('.lumen-hero__trailer');
if (!host || !host.length) { planDone('stop'); return; }
planDone('');
handed = true;



state.trailer = LC.trailer.player(host, key, function () {
if (tgen !== captured || !state) return;
markTrailer(true);
trailerOn();
}, function () {
if (tgen !== captured || !state) return;
state.trailer = null;
markTrailer(false);
trailerOff();
});
} catch (err) {
warn('hero: trailer start failed', err);





if (handed) trailerNote('stop');
else planDone('stop');
}
}




function scheduleTrailer(card) {
if (!trailerReady()) return;
state.trailerPlan = trailerNote('plan');
var captured = tgen;
state.trailerTimer = setTimeout(function () {
if (!state || tgen !== captured) return;
state.trailerTimer = null;
if (state.pending !== card || !isMounted()) { planDone('stop'); return; }


if (!trailerReady()) { planDone('stop'); return; }
if (trailerBlocked()) { planDone('stop'); forgetTrailerFocus(); return; }
loadTrailer(card, captured);
}, TRAILER_DELAY);
}




function applyTrailer() {
if (!state) return;
if (trailerReady()) return;
cancelTrailer();
}












































var SLIDE_FREE = 700;




function slidesAllowed() {
return !benchHeld && motionMode() !== 'off';
}

function slideInterval() {
try {
if (LC.backdrops && typeof LC.backdrops.intervalMs === 'function') return LC.backdrops.intervalMs();
} catch (e) { }
return 14000;
}

function cancelSlides() {
if (!state) return;
stopTimer('slideFree');
if (state.slideLook) {
state.slideLook.cancel();
state.slideLook = null;
}
if (state.slides) {
var s = state.slides;
state.slides = null;
try { s.destroy(); } catch (e) { warn('hero: slides destroy failed', e); }
}
}




function freeHidden(captured) {
if (!state || !fxHeavy()) return;
stopTimer('slideFree');
state.slideFree = setTimeout(function () {
if (gen !== captured || !state) return;
state.slideFree = null;
try {
var layers = [state.stage.find('.lumen-hero__bg--a'), state.stage.find('.lumen-hero__bg--b')];
for (var i = 0; i < layers.length; i++) {
if (!layers[i].hasClass('is-active')) layers[i].removeAttr('src');
}
} catch (e) { }
}, SLIDE_FREE);
}

function startSlides(model, captured) {



if (!state || state.slides || gen !== captured || state.parked) return;
if (!slidesAllowed() || !state.details || !model || !model.backdrop) return;
if (!LC.slideshow || !LC.backdrops) return;
try {






var main = state.framePath || model.backdrop;
var keyArt = state.details.backdrop_path || (state.shownCard && state.shownCard.backdrop_path) || '';
var images = state.details.images;








var poster = model.poster || '';
var look = poster ? LC.thumbs : null;
var list = LC.util.filter(slideFrames(images && images.backdrops), function (b) {
if (look && b.file_path !== main && look.verdict(poster, b.file_path) === true) return false;
return !keyArt || keyArt === main || b.file_path !== keyArt;
});
var paths = LC.backdrops.pickBackdrops({ backdrops: list }, main, LC.slideshow.maxFramesFor(motionMode()));
if (!paths || paths.length <= 1) return;
var slideShow = function (path, done) {
loadFrame({ backdrop: path }, captured, function (ok) {
if (ok) freeHidden(captured);
done(ok);
}, true);
};
state.slides = LC.slideshow.create(state.node, paths, {
enabled: slidesAllowed,
intervalMs: slideInterval,
show: function (path, done) {







if (gen !== captured || !state || state.loader || state.slideLook || homeHidden()) return;







var v = look ? look.verdict(poster, path) : false;
if (v === true) { done(false); return; }
if (v !== undefined) { slideShow(path, done); return; }





var answered = false;
var job = look.compare(poster, path, function (similar) {
answered = true;
if (!state || gen !== captured) return;
state.slideLook = null;
if (state.loader || homeHidden() || slidesHeld()) return;
if (similar === true) { done(false); return; }
slideShow(path, done);
});
if (!answered) state.slideLook = job;
}
});
if (slidesHeld()) state.slides.pause();
state.slides.activate();
} catch (e) {
warn('hero: slides failed', e);
}
}




function applySlides() {
if (!state) return;
if (!slidesAllowed()) { cancelSlides(); return; }
if (!state.slides && state.model && state.details) startSlides(state.model, gen);
}






function applyInterval() {
if (!state || !state.slides) return;
if (slidesHeld()) return;
try {
state.slides.pause();
state.slides.resume();
} catch (e) {
warn('hero: slides interval failed', e);
}
}

























function applyLogoBox() {
if (!state || !state.model) return;
var model = state.model;
var box = model.logo ? logoBox(model.logoRatio) : null;
var w = box ? box.w + 'em' : '';
var h = box ? box.h + 'em' : '';
if (state.logoBox === w + ' ' + h) return;
state.logoBox = w + ' ' + h;
var logo = state.node.find('.lumen-hero__logo');
logo.css('width', w);
logo.css('height', h);
}



function logoAllowed() {
try { return LC.pref ? LC.pref('lumen_hero_logo', true) !== false : true; } catch (e) { return true; }
}





function showLogo(node, url, path) {
var logo = node.find('.lumen-hero__logo');
logo.css('background-image', 'url("' + encodeURI(url) + '")');





if (state.logoWhite === null) state.logoWhite = logoTone(path) === 'dark';
logo.toggleClass('lumen-logo-white', !!state.logoWhite);
node.addClass('lumen-hero--logo');



if (!focusAway()) {
var tone = logoTone(path);
if (tone === undefined) probeTone(path, null);
else if (tone === 'dark') probeSiblings(path);
}
}




function hideLogo(node) {
node.find('.lumen-hero__logo').css('background-image', 'none').removeClass('lumen-logo-white');
node.removeClass('lumen-hero--logo');
}


























function loadLogo(path, url) {
var captured = gen;
state.logoLoader = preloadLogo(path, url, function (ok) {
if (gen !== captured || !state || !isMounted()) return;
state.logoLoader = null;




if (!ok) {
if (state.model && state.model.logo === path) forceTitleText();
return;
}
stopTimer('titleTimer');



if (!state.model || state.model.logo !== path) return;
if (state.titleForced) return;
showLogo(state.node, url, path);
});
}













function logoUrl(path) {
return path ? imageUrl(path, logoSizeFor(LC.util.emPx(LOGO_EM * TEXT_ZOOM, 1))) : '';
}

















function applyLogo(node, model) {
var path = logoAllowed() ? model.logo : null;





var prev = state.logoLoader;
state.logoLoader = null;
var url = logoUrl(path);
var out = 'wait';
if (!url || logoSeen[path] === 'fail') {
hideLogo(node);
out = 'none';
} else if (logoSeen[path] === 'ok') {
touchLogo(path);
if (state.titleForced) {
hideLogo(node);
out = 'none';
} else {
showLogo(node, url, path);
out = 'logo';
}
} else {
hideLogo(node);
loadLogo(path, url);
}
if (prev) prev.cancel();
return out;
}






































function writeTitle(model, logoState) {



var waiting = logoState === 'wait' || (logoState === 'none' && model.pending && logoAllowed());
if (waiting && !state.titleForced) {
state.node.find('.lumen-hero__title').text('');
startTitleTimer();
return;
}
stopTimer('titleTimer');



state.node.find('.lumen-hero__title').text(logoState === 'logo' ? '' : model.title);
}



function startTitleTimer() {
if (state.titleTimer) return;
var captured = gen;
state.titleTimer = setTimeout(function () {
if (gen !== captured || !state) return;
state.titleTimer = null;
forceTitleText();
}, TITLE_WAIT);
}





function forceTitleText() {
if (!state) return;
stopTimer('titleTimer');






if (focusAway()) {
startTitleTimer();
return;
}





var path = state.model && logoAllowed() ? state.model.logo : null;
if (path && logoSeen[path] === 'ok') {
if (state.logoLoader) {
state.logoLoader.cancel();
state.logoLoader = null;
}
touchLogo(path);
showLogo(state.node, logoUrl(path), path);
return;
}
state.titleForced = true;
if (state.model) state.node.find('.lumen-hero__title').text(state.model.title);
}
























function render(model, swap) {
if (!state || !model) return;
var node = state.node;
state.model = model;

function write() {
if (!state || !state.model) return;


stopTimer('swapTimer');
var current = state.model;
var text = node.find('.lumen-hero__text');









var metaLine = current.rating ? current.meta.concat(['★ ' + current.rating]) : current.meta;
node.find('.lumen-hero__meta').text(metaLine.join(' · '));
node.find('.lumen-hero__descr').text(current.overview);
node.find('.lumen-hero__status').text(current.status);
node.toggleClass('lumen-hero--status', !!current.status);
node.toggleClass('lumen-hero--pending', !!current.pending);



node.toggleClass('lumen-hero--nodescr', !current.overview);





var logoState = applyLogo(node, current);
applyLogoBox();


writeTitle(current, logoState);

text.removeClass('is-swapping');
if (motionMode() === 'full') text.addClass('is-in');








if (state.holdDue && !focusAway()) {
state.holdDue = false;
armHold();
}
}

if (!swap) {
write();
return;
}





if (motionMode() === 'full') node.find('.lumen-hero__text').removeClass('is-in').addClass('is-swapping');
var captured = gen;
stopTimer('swapTimer');
state.swapTimer = setTimeout(function () {
if (gen !== captured || !state) return;
state.swapTimer = null;
write();
}, SWAP_MS);
}



































var CROSSFADE_CALM_MS = 1000;

function swapFrame(url, blur, slide) {
if (!state) return;
var a = state.stage.find('.lumen-hero__bg--a');
var b = state.stage.find('.lumen-hero__bg--b');
var activeIsA = a.hasClass('is-active');
if (!fxHeavy() || (!slide && Date.now() - state.focusAt < CROSSFADE_CALM_MS)) {


var only = activeIsA ? a : (b.hasClass('is-active') ? b : a);
only.attr('src', url);
only.addClass('is-active');
only.toggleClass('lumen-hero__bg--blur', !!blur);
state.frameUrl = url;
state.frameBlur = !!blur;
return;
}


var bActive = b.hasClass('is-active');
var next = bActive ? a : b;
var prev = bActive ? b : a;
next.attr('src', url);
next.addClass('is-active');
prev.removeClass('is-active');









next.toggleClass('lumen-hero__bg--blur', !!blur);
state.frameUrl = url;

state.frameBlur = !!blur;
}















var LQIP_FREE = 900;
function releaseLqip() {
if (!state || !state.lqipUrl) return;
var captured = gen;
stopTimer('lqipTimer');
state.lqipTimer = setTimeout(function () {
if (gen !== captured || !state) return;
state.lqipTimer = null;
state.lqipUrl = '';
try {
var lqip = state.stage.find('.lumen-hero__lqip');
lqip.removeClass('is-active');
lqip.removeAttr('src');
} catch (e) {}
}, LQIP_FREE);
}
















function loadFrame(model, captured, done, slide) {
if (!state) return;
if (motionMode() === 'off') return;
var blur = false;
var path = model.backdrop;
if (!path) { path = model.poster; blur = true; }
if (!path) return;






var url = imageUrl(path, blur ? 'w92' : sizeFor(screenWidth()));
if (url && url === state.frameUrl && done) { done(true); return; }
if (!url || url === state.frameUrl) return;






















if (!blur && !state.frameUrl) {
var small = imageUrl(path, 'w300');
if (small) {
var lqip = state.stage.find('.lumen-hero__lqip');
lqip.attr('src', small);
lqip.addClass('is-active');
state.lqipUrl = small;

state.frameId = state.shownId;
}
}

var report = typeof done === 'function' ? done : function () {};
var loader = new Image();





loader.decoding = 'async';





loader.fetchPriority = 'high';
var done = false;


var decoding = typeof loader.decode === 'function';





function loaded() {
return !!(loader.complete && loader.naturalWidth);
}






function finish(ok) {
if (done) return;
done = true;
loader.onload = null;
loader.onerror = null;
if (gen !== captured || !state || !isMounted()) return;





if (state.parked) return;
stopTimer('loadTimer');
state.loader = null;



if (motionMode() === 'off') return;




if (slide && focusAway()) return;



if (!ok) { report(false); return; }
try {
swapFrame(url, blur, slide);
} catch (e) {
warn('hero: frame failed', e);
}
releaseLqip();
report(true);
}

function shown() { finish(true); }

loader.onload = function () { if (!decoding) shown(); };
loader.onerror = function () { finish(false); };
state.loader = loader;


state.slideLoad = !!slide;







state.loadTimer = setTimeout(function () { finish(loaded()); }, LOAD_TIMEOUT);
loader.src = url;











if (decoding) {
try {
var decoded = loader.decode();
if (decoded && typeof decoded.then === 'function') decoded.then(shown, function () { finish(loaded()); });
else decoding = false;
} catch (e) {

decoding = false;
}
}
}











function loadDetails(card, captured) {
try {
if (!window.Lampa || !Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb) return;




state.detailsWait = true;
var onOk = function (json) {
if (gen !== captured || !state) return;
state.detailsWait = false;









if (state.parked) { state.stale = true; return; }
if (!isMounted()) return;
state.details = json || null;
var model = heroModel(card, state.details, words());


if (!state.details) model.pending = false;
render(model, false);



applyFx();





chooseFrame(model, captured);
};
var onErr = function () {
if (gen !== captured || !state) return;
state.detailsWait = false;
if (state.parked) { state.stale = true; return; }
if (!isMounted()) return;




var fallback = heroModel(card, null, words());
fallback.pending = false;
render(fallback, false);


startFrame(fallback, captured);
};
if (LC.prefetch && typeof LC.prefetch.details === 'function') {
LC.prefetch.details(card, onOk, onErr);
return;
}
var req = detailsRequest(mediaOf(card), card.id, langCode());
Lampa.Api.sources.tmdb.get(req.url, req.params, onOk, onErr, { life: req.life });
} catch (e) {
warn('hero: details failed', e);
}
}






























function chooseFrame(model, captured) {
if (!state || gen !== captured || !model) return;
if (state.framePath || state.lookTimer || state.look) {
startSlides(model, captured);
return;
}
var d = state.details;
var main = (d && d.backdrop_path) || (state.shownCard && state.shownCard.backdrop_path) || '';
var cands = frameCandidates(d && d.images, main);
var poster = model.poster;
var look = LC.thumbs;
var decided = false;
function verdictOf(path) { return look.verdict(poster, path); }
function finish(path) {
decided = true;
stopTimer('lookTimer');
var m = model;
if (path && path !== model.backdrop) {
m = {};
for (var k in model) if (Object.prototype.hasOwnProperty.call(model, k)) m[k] = model[k];
m.backdrop = path;
}
startFrame(m, captured);
startSlides(m, captured);
}
if (!look || !poster || !cands.paths.length || motionMode() === 'off') {
finish(model.backdrop);
return;
}

stopTimer('frameWait');







function ask(path) {
var answered = false;
var sync = true;
var job = look.compare(poster, path, function () {
answered = true;
if (sync || !state || gen !== captured) return;
state.look = null;




if (verdictOf(path) === undefined) {
finish(model.backdrop);
return;
}
step();
});
sync = false;
if (!answered) state.look = job;
return answered;
}
function step() {
while (!decided && state && gen === captured) {
var r = pickFrame(cands.paths, cands.strong, verdictOf, model.backdrop, false);
if (!r.wait) {
finish(r.path);
return;
}
if (!ask(r.wait)) return;
if (verdictOf(r.wait) === undefined) {
finish(model.backdrop);
return;
}
}
}





if (!focusAway()) step();
if (decided || !state || gen !== captured) return;
state.lookTimer = setTimeout(function () {
if (!state || gen !== captured) return;
state.lookTimer = null;
if (decided) return;





finish(pickFrame(cands.paths, cands.strong, verdictOf, model.backdrop, true).path);
}, LOOK_WAIT);
}

function startFrame(model, captured) {
if (!state || gen !== captured || !model) return;
if (state.framePath) return;
if (state.framePath === '' && !model.backdrop) return;
stopTimer('frameWait');
state.framePath = model.backdrop || '';
loadFrame(model, captured, function (ok) {
if (gen !== captured || !state) return;




if (!focusAway()) prefetch('warm', state.root);
if (!ok) { holdFrame(captured); return; }
state.frameId = state.shownId;
stopTimer('holdTimer');
});

if (motionMode() === 'off') prefetch('warm', state.root);
}









function prefetch(name, arg) {
try {
if (LC.prefetch && typeof LC.prefetch[name] === 'function') LC.prefetch[name](arg);
} catch (e) {
warn('hero: prefetch ' + name + ' failed', e);
}
}
























function holdFrame(captured, late) {
if (!state || gen !== captured) return;
stopTimer('holdTimer');
if (String(state.frameId) === String(state.shownId)) return;
if (!state.frameUrl && !state.lqipUrl) return;




if (focusAway()) {
state.holdDue = true;
return;
}






var loader = state.loader;
if (!late && loader && loader.complete && loader.naturalWidth) {
state.holdTimer = setTimeout(function () {
if (gen !== captured || !state) return;
state.holdTimer = null;
holdFrame(captured, true);
}, HOLD_DECODE);
return;
}






try {
neutralFrame();
} catch (e) {
warn('hero: hold failed', e);
}
}



function neutralFrame() {
state.stage.find('.lumen-hero__bg').removeClass('is-active');
state.frameUrl = '';
state.frameBlur = false;
if (state.lqipUrl) {
stopTimer('lqipTimer');
var lqip = state.stage.find('.lumen-hero__lqip');
lqip.removeClass('is-active');
lqip.removeAttr('src');
state.lqipUrl = '';
}

state.frameId = state.shownId;
}





function focusAway() {
return !!(state && state.pending && String(state.pending.id) !== String(state.shownId));
}




function armHold() {
if (!state || state.holdTimer) return;
if (String(state.frameId) === String(state.shownId)) return;
var held = gen;
state.holdTimer = setTimeout(function () {
if (gen !== held || !state) return;
state.holdTimer = null;
holdFrame(held);
}, HOLD_MS);
}




function show(card) {
if (!state || !card) return;
try {
var captured = ++gen;
cancelPending();

cancelSlides();
state.shownId = card.id;


state.shownCard = card;

if (state.hostClass === MAIN_HOST) lastShown = card;
state.details = null;
state.model = null;



state.titleForced = false;

state.logoWhite = null;



clearFx();



state.framePath = null;


state.holdDue = !!(state.frameUrl || state.lqipUrl) && motionMode() !== 'off';
var model = heroModel(card, null, words());
render(model, true);
loadDetails(card, captured);

if (gen === captured && state && state.framePath === null && motionMode() !== 'off') {
state.frameWait = setTimeout(function () {
if (gen !== captured || !state) return;
state.frameWait = null;
startFrame(heroModel(card, null, words()), captured);
}, FRAME_WAIT);
}
} catch (e) {
warn('hero: show failed', e);
}
}









function rowIndex(el) {
try {
var line = $(el).closest('.items-line');
if (!line || !line.length) return -1;
return line.index();
} catch (e) {
return -1;
}
}




















function setCompact(on) {
if (!state) return;


state.compact = !!on;


if (state.slides) {


try { if (on) state.slides.pause(); else if (!slidesHeld()) state.slides.resume(); } catch (eSl) { }
}
state.node.toggleClass('lumen-hero--compact', on);
try { state.root.toggleClass('lumen-rows-up', on); } catch (e) {}
}


function updateCompact(el) {
if (!state || state.fixedCompact) return;
var index = rowIndex(el);
if (index < 0) return;
setCompact(index > 0);
}









function scheduleAccent(card) {
stopTimer('accentTimer');










try {
if (LC.accent && typeof LC.accent.stopTween === 'function') LC.accent.stopTween();
} catch (eStop) {
warn('hero: accent stop failed', eStop);
}
state.accentTimer = setTimeout(function () {
if (!state) return;
state.accentTimer = null;
if (state.pending !== card) return;
if (!isMounted()) return;
try {
if (LC.accent && typeof LC.accent.applyFor === 'function') LC.accent.applyFor(card);
} catch (e) {
warn('hero: accent failed', e);
}
}, ACCENT_DELAY);
}









function markBurst(on) {
if (!state) return;
stopTimer('burstTimer');
if (on) {
state.burstTimer = setTimeout(function () {
if (!state) return;
state.burstTimer = null;
markBurst(false);
}, BURST_GAP);
}
if (state.burst === on) return;
state.burst = on;
try { state.root.toggleClass('lumen-burst', on); } catch (e) {}
}

function onFocus(el) {
if (!state) return;
var card = el.card_data;
if (!card || card.id == null) return;










if (state.focusEl === el) return;
state.focusEl = el;



prefetch('around', el);

updateCompact(el);




var now = Date.now();
var burst = !!state.focusAt && now - state.focusAt < BURST_GAP;
var wait = burst ? BURST_DELAY : DELAY;
state.focusAt = now;
markBurst(burst);
state.pending = card;
stopTimer('timer');



scheduleAccent(card);





if (state.trailerCard !== card) {
cancelTrailer();
state.trailerCard = card;
scheduleTrailer(card);
}





if (state.shownId === card.id) {
if (state.holdDue && !state.swapTimer) {
state.holdDue = false;
armHold();
}



if (state.slides && !slidesHeld()) {
try { state.slides.resume(); } catch (eRs) { warn('hero: slides resume failed', eRs); }
}
return;
}






if (state.holdTimer) {
stopTimer('holdTimer');
state.holdDue = true;
}


if (state.slides) {
try { state.slides.pause(); } catch (ePs) { warn('hero: slides pause failed', ePs); }
}





if (state.look) {
state.look.cancel();
state.look = null;
}
if (state.slideLook) {
state.slideLook.cancel();
state.slideLook = null;
}


dropTones(state.model && state.model.logo);

var captured = gen;
state.timer = setTimeout(function () {
if (gen !== captured || !state) return;
state.timer = null;
if (!isMounted()) return;
if (state.pending !== card) return;
if (!shouldUpdate(state.shownId, card.id, Date.now() - state.focusAt, wait)) return;
show(card);
}, wait);
}







function onFocusEvent(e) {



if (!state || state.parked) return;
try {
var el = e && e.target;
if (!el || !el.classList || !el.classList.contains('card')) return;
onFocus(el);
} catch (err) {
warn('hero: focus listener failed', err);
}
}







































function listenFocus(root) {
try {
var node = root && root[0];
if (!node) return;
state.focusHandler = onFocusEvent;
if (!LC.focus.capture(node, state.focusHandler)) state.focusHandler = null;
} catch (e) {
warn('hero: listen failed', e);
}
}




function unlistenFocus(s) {
if (!s || !s.focusHandler) return;
try {
LC.focus.release(s.root && s.root[0], s.focusHandler);
} catch (e) {
warn('hero: unlisten failed', e);
}
s.focusHandler = null;
}




function showFocused(root) {
try {
var el = root.find('.card.focus');
if (el && el.length && el[0] && el[0].card_data) {
updateCompact(el[0]);









show(el[0].card_data);
}
} catch (e) {}
}





















function sizeOff() {
try { return LC.pref ? LC.pref('lumen_hero_size', 'large') === 'off' : false; } catch (e) { return false; }
}


































var BODY_ON = 'lumen-main-on';


var MAIN_HOST = 'lumen-main';



var bgOrig = null;
var bgWrap = null;

function bodyClasses() {
try {
var body = document && document.body;
return body && body.classList ? body.classList : null;
} catch (e) {
return null;
}
}

function markBody(on) {
var list = bodyClasses();
if (!list) return;
try {
if (on) list.add(BODY_ON);
else list.remove(BODY_ON);
} catch (e) {
warn('hero: body mark failed', e);
}
}










function guardBackground() {
try {
var B = window.Lampa && Lampa.Background;
if (!B || typeof B.change !== 'function') return;
if (bgWrap && B.change === bgWrap) return;
var orig = B.change;
bgOrig = orig;
bgWrap = function () {
var list = bodyClasses();
if (list && list.contains(BODY_ON)) return;
return orig.apply(this, arguments);
};
B.change = bgWrap;
} catch (e) {
warn('hero: background guard failed', e);
}
}





function unguardBackground() {
try {
if (!bgWrap) return;
var B = window.Lampa && Lampa.Background;
if (B && B.change === bgWrap) B.change = bgOrig;
} catch (e) {
warn('hero: background unguard failed', e);
}
bgOrig = null;
bgWrap = null;
}

function mount(root, opts) {
try {
if (!root || !root.length) return;
if (sizeOff()) { unmount(); return; }









if (state && state.root && state.root[0] === root[0]) { resume(); return; }
unmount();
opts = opts || {};

var node = buildNode();
var stage = buildStage();



root.prepend(node);
root.prepend(stage);
var hostClass = opts.hostClass || MAIN_HOST;
root.addClass(hostClass);

gen++;
state = {
root: root,
node: node,


stage: stage,
hostClass: hostClass,


focusHandler: null,
focusEl: null,
timer: null,
swapTimer: null,
loadTimer: null,
accentTimer: null,
loader: null,

slideLoad: false,


logoLoader: null,



titleTimer: null,
titleForced: false,


logoWhite: null,


logoBox: null,


detailsWait: false,
shownId: null,
shownCard: null,
details: null,
model: null,
pending: null,
focusAt: 0,
frameUrl: '',

frameBlur: false,


framePath: null,
frameWait: null,



lookTimer: null,
look: null,
slideLook: null,



frameId: null,
holdTimer: null,
holdDue: false,


burst: false,
burstTimer: null,


lqipUrl: '',

lqipTimer: null,



trailerTimer: null,

videosTimer: null,
trailer: null,
trailerCard: null,

trailerPlan: 0,


slides: null,
slideFree: null,
fixedCompact: !!opts.compact,


compact: !!opts.compact
};
if (opts.compact) setCompact(true);







if (hostClass === MAIN_HOST) {
markBody(true);
guardBackground();
}
applyMotion();
listenFocus(root);
listenPlayer();
showFocused(root);






try { if (LC.perf && LC.perf.track) LC.perf.track('main'); } catch (ePerf) {}
} catch (e) {
warn('hero: mount failed', e);
}
}





function mountCurrent() {
try {
if (!window.Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return;
var act = Lampa.Activity.active();
if (!act || act.component !== 'main') return;
if (!act.activity || typeof act.activity.render !== 'function') return;
mount(act.activity.render());
showStill();
} catch (e) {
warn('hero: mountCurrent failed', e);
}
}

















var lastShown = null;

function showStill() {
if (!state || state.parked || state.fixedCompact || state.shownId != null) return;
var list = state.root.find('.card');
var first = null;
for (var i = 0; list && i < list.length; i++) {
var card = list[i] && list[i].card_data;
if (!card || card.id == null) continue;
if (!first) first = card;
if (lastShown && String(card.id) === String(lastShown.id)) {
first = card;
break;
}
}
if (first) show(first);
}





function unmount() {
if (!state) return;



cancelTrailer();
unlistenPlayer();

cancelSlides();



markBody(false);
unguardBackground();
var s = state;
state = null;
gen++;
unlistenFocus(s);


prefetch('stop');








try {
if (LC.accent && typeof LC.accent.stopTween === 'function') LC.accent.stopTween();
} catch (eTween) {
warn('hero: accent stop failed', eTween);
}
var timers = ['timer', 'swapTimer', 'loadTimer', 'accentTimer', 'trailerTimer', 'lqipTimer', 'titleTimer', 'frameWait', 'lookTimer', 'holdTimer', 'burstTimer'];
for (var i = 0; i < timers.length; i++) {
try { if (s[timers[i]]) clearTimeout(s[timers[i]]); } catch (eT) {}
}


try { if (s.look) s.look.cancel(); } catch (eL) {}
try { if (s.slideLook) s.slideLook.cancel(); } catch (eSL) {}
if (s.loader) dropLoader(s.loader);


if (s.logoLoader) s.logoLoader.cancel();




try {
var fxGone = s.node.find('.lumen-fx');
if (LC.fx && fxGone && fxGone.length) LC.fx.unmount(fxGone);
} catch (eFx) { warn('hero: fx unmount failed', eFx); }
try { s.node.remove(); } catch (eR) {}
try { s.stage.remove(); } catch (eS) {}



try { s.root.removeClass(s.hostClass).removeClass('lumen-rows-up').removeClass('lumen-burst'); } catch (eC) {}
}




function ownedBy(render) {
if (!state || !state.root || !state.root.length) return false;
if (!render || !render.length) return false;
if (state.root[0] === render[0]) return true;
try {
var act = state.root.closest('.activity');
return !!(act && act.length && act[0] === render[0]);
} catch (e) {
return false;
}
}














































function park() {
if (!state || state.parked) return;

















var holdLeft = state.holdDue && String(state.frameId) !== String(state.shownId);
var frameLeft = (state.loader || state.loadTimer) && !state.slideLoad;


if (state.detailsWait || frameLeft || state.logoLoader || state.swapTimer || state.titleTimer || state.frameWait || state.lookTimer || state.holdTimer || holdLeft) {
state.stale = true;
}
state.parked = true;
cancelTrailer();
stopTimer('timer');


markBurst(false);






state.focusEl = null;
state.pending = null;



holdLogo(state.model && state.model.logo);
cancelPending();


prefetch('stop');
stopTimer('accentTimer');
if (state.slides) {
try { state.slides.pause(); } catch (eSl) { warn('hero: slides pause failed', eSl); }
}
try {
if (LC.accent && typeof LC.accent.stopTween === 'function') LC.accent.stopTween();
} catch (eTween) {
warn('hero: accent stop failed', eTween);
}
if (state.hostClass === MAIN_HOST) {
markBody(false);
unguardBackground();
}
}
















function resume() {
if (!state || !state.parked) return;
state.parked = false;
if (state.hostClass === MAIN_HOST) {
markBody(true);
guardBackground();
}
applyMotion();
if (state.slides && !slidesHeld()) {
try { state.slides.resume(); } catch (eSl) { warn('hero: slides resume failed', eSl); }
}
try {
var el = state.root.find('.card.focus');
var node = el && el.length ? el[0] : null;
var card = node && node.card_data;




if (!card || card.id == null) {





if (state.stale && state.shownCard) {
state.stale = false;
show(state.shownCard);
} else {
applyFx();
}
return;
}
updateCompact(node);
state.pending = card;
state.focusEl = node;
if (trailerReady()) {
state.trailerCard = card;
scheduleTrailer(card);
}
if (state.stale || String(state.shownId) !== String(card.id)) {
state.stale = false;
show(card);
} else {
applyFx();
}
} catch (e) {
warn('hero: resume failed', e);
}
}











function accentBack() {
if (!state || state.parked) return;
var card = state.pending || state.shownCard;
if (!card) return;
try {
if (LC.accent && typeof LC.accent.applyFor === 'function') LC.accent.applyFor(card);
} catch (e) {
warn('hero: accent back failed', e);
}
}






function detach(render) {
if (!state) return;
if (ownedBy(render)) return;
park();
}

function active() {
return !!state;
}


function parked() {
return !!(state && state.parked);
}






function benchHold(on) {
benchHeld = !!on;
applySlides();
}



function benchFx(preset) {
benchPreset = preset || null;
applyFx();
}





function benchFlip() {
if (!state || !state.frameUrl) return false;
var a = state.stage.find('.lumen-hero__bg--a');
var b = state.stage.find('.lumen-hero__bg--b');
var bActive = b.hasClass('is-active');
var next = bActive ? a : b;
var prev = bActive ? b : a;
if (!next.attr('src')) next.attr('src', prev.attr('src') || state.frameUrl);
next.addClass('is-active');
prev.removeClass('is-active');
return true;
}









function benchRestore() {
if (!state || !state.frameUrl) return;
var a = state.stage.find('.lumen-hero__bg--a');
var b = state.stage.find('.lumen-hero__bg--b');
var bShown = b.hasClass('is-active');
var shown = bShown ? b : a;
if (shown.attr('src') !== state.frameUrl) shown.attr('src', state.frameUrl);
shown.toggleClass('lumen-hero__bg--blur', !!state.frameBlur);
shown.addClass('is-active');
(bShown ? a : b).removeClass('is-active');
}




function owns(render) {
return ownedBy(render);
}

return {
pickLogo: pickLogo,




pickLogoItem: pickLogoItem,
logoRatioOf: logoRatioOf,
cardLogoBox: cardLogoBox,
logoUrl: logoUrl,
waitLogo: waitLogo,
TITLE_WAIT: TITLE_WAIT,


preloadLogo: preloadLogo,
logoState: logoState,


logoTone: logoTone,
touchLogo: touchLogo,
CARD_TITLE_EM: CARD_TITLE_EM,
mediaOf: mediaOf,
heroModel: heroModel,


heroBackdrop: heroBackdrop,


frameCandidates: frameCandidates,
pickFrame: pickFrame,
shouldUpdate: shouldUpdate,
sizeFor: sizeFor,
logoSizeFor: logoSizeFor,
logoBox: logoBox,
detailsRequest: detailsRequest,


trailerAllowed: trailerAllowed,


applyTrailer: applyTrailer,





applyMedia: function () {
applyTrailer();
applySlides();
},


applyInterval: applyInterval,





applyLogoPref: function () {
try { if (state && state.model) render(state.model, false); } catch (e) { warn('hero: logo pref failed', e); }
},



applyFx: applyFx,
mount: mount,
mountCurrent: mountCurrent,
detach: detach,
parked: parked,
accentBack: accentBack,
owns: owns,
unmount: unmount,
applyMotion: applyMotion,


onToggle: onToggle,
active: active,



compact: function () { return !!(state && state.compact); },
focused: function () { return state ? state.focusEl : null; },
benchHold: benchHold,
benchFx: benchFx,
benchFlip: benchFlip,
benchRestore: benchRestore,





details: function (id) {
if (!state || !state.details) return null;
return state.details.id === id ? state.details : null;
}
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.hero;


/* ---- 49_moods.js ---- */














































LC.moods = (function () {



var gen = 0;


var state = null;

function warn() {
try { if (window.warn) window.warn.apply(window, arguments); } catch (e) {}
}




function moodTitle(mood, lang) {
if (!mood) return '';
if (mood.i18n && lang && mood.i18n[lang]) return mood.i18n[lang];

if (lang === 'ru') return mood.title || '';
if (mood.i18n && mood.i18n.en) return mood.i18n.en;
return mood.title || '';
}



function moodActivityObj(mood) {
var spec = mood.sources && mood.sources.movie;
var media = spec ? 'movie' : 'tv';
if (!spec) spec = mood.sources && mood.sources.tv;
if (!spec) return null;
var title = moodTitle(mood, '');
if (spec.type === 'discover') {
return {
url: LC.sources.discoverUrl(spec, media),
title: title,
component: 'category_full',
source: 'tmdb',
page: 1
};
}
return null;
}





function buildChip(mood) {





var lang = typeof LC.langCode === 'function' ? LC.langCode() : 'ru';
var title = moodTitle(mood, lang);
var node = $('<div class="lumen-mood-chip selector"></div>');
node.text(title);
node[0].lumen_mood = mood;
node.on('hover:enter', function () {
var m = this.lumen_mood;
if (!m) return;
var obj = moodActivityObj(m);
if (!obj) return;
try { Lampa.Activity.push(obj); } catch (e) { warn('moods: push failed', e); }
});
return node;
}







function moods() {
try {
if (LC.manifest && LC.manifest.get) {
var m = LC.manifest.get();
if (m && m.moods && m.moods.length) return m.moods;
}
if (LC.manifest && LC.manifest.DEFAULT && LC.manifest.DEFAULT.moods) {
return LC.manifest.DEFAULT.moods;
}
} catch (e) {
warn('moods: manifest read failed', e);
}
return [];
}


function fillChips(wrap, moodList) {
for (var i = 0; i < moodList.length; i++) {
wrap.append(buildChip(moodList[i]));
}
return wrap;
}





function recollect(root) {
try {
if (!window.Lampa || !Lampa.Controller) return;
if (typeof Lampa.Controller.collectionSet !== 'function') return;





if (!LC.util.onScreen(root)) return;
var focused = root.find('.focus');
Lampa.Controller.collectionSet(root[0]);
if (typeof Lampa.Controller.collectionFocus === 'function') {
Lampa.Controller.collectionFocus(focused && focused.length ? focused : false, root[0]);
}
} catch (e) {
warn('moods: recollect failed', e);
}
}



function mount(root) {
try {
if (!root || !root.length) return;



if (!enabled()) { unmount(); return; }






if (root.children('.lumen-hero').length) { unmount(); return; }


if (state && state.root && state.root[0] === root[0]) return;
unmount();
var moodList = moods();
if (!moodList.length) return;




var node = $('<div class="lumen-moods"></div>');
fillChips(node, moodList);
root.append(node);
root.addClass('lumen-moods-on');
gen++;
state = { root: root, node: node };


recollect(root);
} catch (e) {
warn('moods: mount failed', e);
}
}


function unmount() {
if (!state) return;
var s = state;
state = null;
gen++;
try { s.node.remove(); } catch (eN) {}


try { s.root.removeClass('lumen-moods-on'); } catch (eC) {}
}


function ownedBy(render) {
if (!state) return false;
if (!render || !render.length) return false;
if (state.root && state.root[0] === render[0]) return true;
try {
var act = state.root && state.root.closest ? state.root.closest('.activity') : null;
if (act && act.length && act[0] === render[0]) return true;
} catch (e) {}
return false;
}



function detach(render) {
if (!state) return;
if (!render || !render.length) { unmount(); return; }
if (ownedBy(render)) return;
unmount();
}




function owns(render) {
return ownedBy(render);
}

function active() {
return !!state;
}




function enabled() {
try { return LC.pref ? !!LC.pref('lumen_moods', true) : true; } catch (e) { return true; }
}




function mountCurrent() {
try {


if (!Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return;
var act = Lampa.Activity.active();
if (!act || act.component !== 'main') return;
if (!act.activity || typeof act.activity.render !== 'function') return;
mount(act.activity.render());
} catch (e) {
warn('moods: mountCurrent failed', e);
}
}
















function install() {
mountCurrent();
}

function uninstall() {
unmount();
}

return {
moodTitle: moodTitle,
mount: mount,
mountCurrent: mountCurrent,
unmount: unmount,
detach: detach,
owns: owns,
active: active,
install: install,
uninstall: uninstall
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.moods;


/* ---- 50_backdrops.js ---- */



















function tmdbImageFn() {
if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function') {
return function (url) { return Lampa.TMDB.image(url); };
}
return null;
}

function apiImgFn() {
if (window.Lampa && Lampa.Api && typeof Lampa.Api.img === 'function') {
return function (path, size) { return Lampa.Api.img(path, size); };
}
return null;
}






function backdropUrl(movie) {
var url = '';
try {
var path = LC.cardinfo.backdropPath(movie);





if (path) url = LC.cardinfo.imageUrl(path, LC.util.frameSize(LC.util.screenPx()), tmdbImageFn(), apiImgFn());
} catch (e) {
warn('image url failed', e);
}
if (!url && movie.background_image) url = movie.background_image;
return url;
}










function posterUrl(movie) {
try {
if (movie.poster_path) return LC.cardinfo.imageUrl(movie.poster_path, 'w92', tmdbImageFn(), apiImgFn());
} catch (e) {
warn('poster url failed', e);
}
return '';
}

function procClass(movie) {
var id = parseInt(movie && movie.id, 10);
if (isNaN(id)) id = 0;
return 'lumen-backdrop--proc' + (Math.abs(id) % 3);
}










function syncMotionClass(layer) {
try {
layer.removeClass('lumen-motion-full lumen-motion-lite lumen-motion-off').addClass('lumen-motion-' + LC.motionMode());
} catch (e) { }
}







function ensureLayer(body) {
var layer = body.children('.lumen-backdrop');
if (!layer.length) {
layer = $('<div class="lumen-backdrop">' +
'<div class="lumen-backdrop__img"></div>' +
'<div class="lumen-bg__slides"></div>' +




'<div class="lumen-bg__trailer"></div>' +
'<div class="lumen-backdrop__veil lumen-backdrop__veil--l"></div>' +
'<div class="lumen-backdrop__veil lumen-backdrop__veil--b"></div>' +
'<div class="lumen-backdrop__veil lumen-backdrop__veil--t"></div>' +






'<div class="lumen-fx"></div>' +
'</div>');
body.prepend(layer);
}
return layer;
}






function clearInlineStyleIfEmpty(el) {
try {
var node = el && el[0];
if (node && node.getAttribute && node.getAttribute('style') === '') node.removeAttribute('style');
} catch (e) { }
}












function clearLayer(layer) {
layer.removeClass('lumen-backdrop--proc0 lumen-backdrop--proc1 lumen-backdrop--proc2 lumen-bg--blur');
var img0 = layer.find('.lumen-backdrop__img');
img0.removeClass('lumen-bg__img is-active');
img0.css('transform', '');
clearInlineStyleIfEmpty(img0);
layer.find('.lumen-bg__slides').empty();
}











function cancelPending(layer) {
var pending = layer.data('lumenPending');
if (!pending) return;
if (pending.timer) clearTimeout(pending.timer);
if (pending.loader) { pending.loader.onload = null; pending.loader.onerror = null; }
layer.removeData('lumenPending');
}

function nextGen(layer) {
var gen = (layer.data('lumenGen') || 0) + 1;
layer.data('lumenGen', gen);
return gen;
}







function showNoFrame(layer, movie) {
var img = layer.find('.lumen-backdrop__img');
var url = posterUrl(movie);
if (url) {
img.css('background-image', 'url("' + encodeURI(url) + '")');
syncMotionClass(layer);
layer.addClass('lumen-bg--blur').addClass('loaded');
} else {
img.css('background-image', '');
layer.addClass(procClass(movie)).addClass('loaded');
}
}

















function loadBackdrop(layer, movie, gen, controller) {
var url = backdropUrl(movie);
var img = layer.find('.lumen-backdrop__img');

if (!url) { showNoFrame(layer, movie); return; }

img.css('background-image', '');
var node = layer[0];
var done = false;
var timer = null;
var loader = new Image();


loader.decoding = 'async';

function finish(ok) {
if (done) return;
done = true;
if (timer) { clearTimeout(timer); timer = null; }
loader.onload = null;
loader.onerror = null;
layer.removeData('lumenPending');



if (layer.data('lumenGen') !== gen) return;


if (!LC.slideshow.isMounted(node)) return;
try {
if (ok) {

img.css('background-image', 'url("' + encodeURI(url) + '")');
layer.addClass('loaded');






syncMotionClass(layer);
controller.activate();
} else {
showNoFrame(layer, movie);
}
} catch (e) {
warn('backdrop apply failed', e);
}
}

loader.onload = function () { finish(true); };
loader.onerror = function () { finish(false); };
timer = setTimeout(function () { finish(false); }, 8000);
loader.src = url;

layer.data('lumenPending', { timer: timer, loader: loader });
}








function ensurePosterLabel(root) {
var poster = root.find('.full-start-new__poster');
if (!poster.length) return;
if (!poster.children('.lumen-poster-tmdb').length) {
poster.append('<div class="lumen-poster-tmdb">TMDB</div>');
}
}













function apply(root, body, movie) {
try {
if (!body || !body.length) return;
movie = movie || {};

var mode = LC.cardinfo.bgMode(movie);

if (root && root.length) {
root.toggleClass('lumen-card--poster', mode === 'poster');
if (mode === 'poster') ensurePosterLabel(root);
}


body.find('.full-start__background').addClass('lumen-off');





















try {
body.find('.scroll__body').eq(0).addClass('lumen-scrim');
} catch (e) {
warn('scrim mark failed', e);
}

var layer = ensureLayer(body);



cancelPending(layer);
stopSlideshow(layer);
clearLayer(layer);
var gen = nextGen(layer);

var main = LC.cardinfo.backdropPath(movie);
var max = LC.slideshow.maxFramesFor(LC.motionMode());
var paths = pickBackdrops(movie.images, main, max);




var frameSize = LC.util.frameSize(LC.util.screenPx());
var urls = LC.util.map(paths, function (p) { return LC.cardinfo.imageUrl(p, frameSize, tmdbImageFn(), apiImgFn()); });
var slideshowOpts = { enabled: slideshowEnabled, intervalMs: slideIntervalMs };

var controller = LC.slideshow.create(layer, urls, slideshowOpts);
layer.data('lumenSlideshow', controller);





layer.data('lumenUrls', urls);
layer.data('lumenOpts', slideshowOpts);

if (mode === 'backdrop') loadBackdrop(layer, movie, gen, controller);
else showNoFrame(layer, movie);

return controller;
} catch (e) {
warn('backdrop failed', e);
}
}







function cancel(body) {
try {
if (!body || !body.length) return;
var layer = body.children('.lumen-backdrop');
if (!layer.length) return;
cancelPending(layer);
stopSlideshow(layer);
} catch (e) {
warn('backdrop cancel failed', e);
}
}














function pickBackdrops(images, main, max) {
var list = (images && images.backdrops) ? images.backdrops : [];
var clean = LC.util.filter(list, function (b) { return b && b.file_path && !b.iso_639_1 && b.file_path !== main; });
clean.sort(function (x, y) {
var wx = (x.width || 0) >= 1280 ? 1 : 0, wy = (y.width || 0) >= 1280 ? 1 : 0;
if (wx !== wy) return wy - wx;
return (y.vote_average || 0) - (x.vote_average || 0);
});
var r = main ? [main] : [];
LC.util.each(clean, function (b) { if (r.length < max) r.push(b.file_path); });
return r;
}




function slideshowEnabled() {








try { if (LC.motionMode() === 'off') return false; } catch (e) { }
return !!LC.pref('lumen_slideshow', true);
}

function slideIntervalMs() {
var n = parseInt(LC.pref('lumen_slide_interval', '14'), 10);
if (n !== 8 && n !== 14 && n !== 20) n = 14;
return n * 1000;
}








function stopSlideshow(layer) {
var s = layer.data('lumenSlideshow');
if (s) { try { s.destroy(); } catch (e) { } }
layer.removeData('lumenSlideshow');




var trailer = layer.data('lumenTrailer');
if (trailer) { try { trailer.destroy(); } catch (e2) { } }
layer.removeData('lumenTrailer');
var reviveCleanup = layer.data('lumenReviveCleanup');
if (reviveCleanup) { clearTimeout(reviveCleanup); layer.removeData('lumenReviveCleanup'); }
}























































































function revive(layer) {
try {









var trailer = layer.data('lumenTrailer');
if (trailer) { try { trailer.destroy(); } catch (e0) { } }
layer.removeData('lumenTrailer');

var urls = layer.data('lumenUrls');
if (!urls || !urls.length) return null;
var opts = layer.data('lumenOpts');

var img0 = layer.find('.lumen-backdrop__img');
if (!img0.hasClass('lumen-bg__img')) return null;

var pendingCleanup = layer.data('lumenReviveCleanup');
if (pendingCleanup) {
clearTimeout(pendingCleanup);
layer.removeData('lumenReviveCleanup');
}

var activeFrame = layer.find('.lumen-bg__img.is-active');
var isSlide = !!(activeFrame.length && activeFrame[0] !== img0[0]);
var activeBg = activeFrame.length ? activeFrame.css('background-image') : img0.css('background-image');
if (activeBg) img0.css('background-image', activeBg);




img0.css('transform', '');
clearInlineStyleIfEmpty(img0);
img0.addClass('lumen-bg__img is-active');

var slides = layer.find('.lumen-bg__slides');
if (isSlide) {


slides.empty();
activeFrame.removeClass('is-active');
slides.append(activeFrame);
var reviveTimer = setTimeout(function () {
layer.removeData('lumenReviveCleanup');
try { activeFrame.remove(); } catch (e) { }
}, LC.slideshow.CROSSFADE_MS);
layer.data('lumenReviveCleanup', reviveTimer);
} else {
slides.empty();
}

var controller = LC.slideshow.create(layer, urls, opts);
layer.data('lumenSlideshow', controller);
controller.activate();
return controller;
} catch (e) {
warn('slideshow revive failed', e);
return null;
}
}



LC.backdrops = { apply: apply, cancel: cancel, pickBackdrops: pickBackdrops, revive: revive, intervalMs: slideIntervalMs,


slideshowEnabled: slideshowEnabled };






if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.backdrops;


/* ---- 51_slideshow.js ---- */





























LC.slideshow = (function () {




















var isActivityForeground = LC.util.activityOnScreen;
var isLayerForeground = LC.util.onScreen;





function maxFramesFor(mode) {
if (mode === 'off') return 1;
if (mode === 'lite') return 4;
return 8;
}








function isMounted(node) {
try { return !!(node && document.documentElement && document.documentElement.contains(node)); } catch (e) { return false; }
}




function covered() {
try {
return typeof LC.covered === 'function' && LC.covered() === true;
} catch (e) {
return false;
}
}











var CROSSFADE_MS = 600;





























































function create(layer, urls, opts) {
opts = opts || {};
var enabledFn = typeof opts.enabled === 'function' ? opts.enabled : function () { return true; };
var intervalFn = typeof opts.intervalMs === 'function' ? opts.intervalMs : function () { return 14000; };
var show = typeof opts.show === 'function' ? opts.show : null;

var alive = true;
var paused = false;
var timer = null;
var pendingLoader = null;
var frames = null;
var warm = null;
var activeIdx = -1;
var idx = 0;
var cleanupTimer = null;
var cleanupPending = null;

function isLayerMounted() {
return isMounted(layer[0]);
}

function stopTimer() {
if (timer) { clearInterval(timer); timer = null; }
}

function stopCleanupTimer() {
if (cleanupTimer) { clearTimeout(cleanupTimer); cleanupTimer = null; }
}



function coolDown(i, el) {
try {
el.css('transform', '');
el.css('background-image', '');
} catch (e) { }
warm[i] = false;
}





function scheduleCoolDown(i, el) {
if (cleanupPending) {
stopCleanupTimer();
coolDown(cleanupPending.i, cleanupPending.el);
}
cleanupPending = { i: i, el: el };
cleanupTimer = setTimeout(function () {
cleanupTimer = null;
cleanupPending = null;
coolDown(i, el);
}, CROSSFADE_MS);
}

function setActive(i) {











if (cleanupPending && cleanupPending.i === i) {
stopCleanupTimer();
cleanupPending = null;
}

var prevIdx = activeIdx;
var prevEl = (prevIdx !== -1 && frames[prevIdx]) ? frames[prevIdx] : null;




if (prevEl && prevIdx !== i) {
try {
if (layer.hasClass('lumen-motion-full') && window.getComputedStyle) {
var cs = window.getComputedStyle(prevEl[0]);
var t = cs && (cs.transform || cs.webkitTransform);
if (t && t !== 'none') prevEl.css('transform', t);
}
} catch (e) { }
}

for (var k = 0; k < frames.length; k++) {
if (frames[k]) frames[k].toggleClass('is-active', k === i);
}

if (prevEl && prevIdx !== i) scheduleCoolDown(prevIdx, prevEl);
activeIdx = i;
}

function ensureFrame(i, cb) {
if (frames[i] === false) { cb(null); return; }
if (frames[i]) {


if (!warm[i]) {
try { frames[i].css('background-image', 'url("' + encodeURI(urls[i]) + '")'); warm[i] = true; } catch (e) { }
}
cb(frames[i]);
return;
}
var url = urls[i];
if (!url) { frames[i] = false; cb(null); return; }
var loader = new Image();


loader.decoding = 'async';
pendingLoader = loader;
loader.onload = function () {
if (pendingLoader !== loader) return;
pendingLoader = null;
if (!alive || !isLayerMounted()) return;
try {
var el = $('<div class="lumen-bg__img"></div>');
el.css('background-image', 'url("' + encodeURI(url) + '")');
layer.find('.lumen-bg__slides').append(el);
frames[i] = el;
warm[i] = true;
cb(el);
} catch (e) {
warn('slideshow frame failed', e);
frames[i] = false;
cb(null);
}
};
loader.onerror = function () {
if (pendingLoader !== loader) return;
pendingLoader = null;
frames[i] = false;
cb(null);
};
loader.src = url;
}





function tryFrom(offset) {
if (!alive || paused || !frames) return;
if (!isLayerMounted()) { destroy(); return; }




if (!LC.util.onScreen(layer)) return;








if (covered()) return;




if (LC.util.playerOpen()) return;
if (offset > urls.length) return;
var next = (idx + offset) % urls.length;
if (show) {
if (frames[next] === false) { tryFrom(offset + 1); return; }
show(urls[next], function (ok) {
if (!alive || !frames) return;
if (!ok) {
frames[next] = false;
if (!paused) tryFrom(offset + 1);
return;
}
idx = next;
});
return;
}
ensureFrame(next, function (el) {
if (!alive || paused || !frames) return;
if (!isLayerMounted()) { destroy(); return; }
if (!el) { tryFrom(offset + 1); return; }
idx = next;
setActive(idx);
});
}

function advance() { tryFrom(1); }

function startTimer() {
if (timer || !frames || urls.length <= 1) return;
timer = setInterval(advance, intervalFn());
}

function activate() {
if (!alive || frames) return;
if (show) {
frames = [];
idx = 0;
activeIdx = 0;
if (enabledFn() && !paused) startTimer();
return;
}
try {
frames = [];
warm = [];
var firstNode = layer.find('.lumen-backdrop__img');
firstNode.addClass('lumen-bg__img is-active');
frames[0] = firstNode;
warm[0] = true;
idx = 0;
activeIdx = 0;
if (enabledFn() && !paused) startTimer();
} catch (e) {
warn('slideshow activate failed', e);
}
}

function destroy() {
alive = false;
stopTimer();
stopCleanupTimer();
cleanupPending = null;
if (pendingLoader) { pendingLoader.onload = null; pendingLoader.onerror = null; pendingLoader = null; }
}

return {
activate: activate,





isAlive: function () { return alive; },



pause: function () { paused = true; stopTimer(); },





resume: function () {
paused = false;
if (alive && frames && enabledFn()) startTimer();
},
destroy: destroy
};
}

return {
create: create,
isActivityForeground: isActivityForeground,
isLayerForeground: isLayerForeground,
maxFramesFor: maxFramesFor,
isMounted: isMounted,



CROSSFADE_MS: CROSSFADE_MS
};
})();



if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.slideshow;


/* ---- 52_fx.js ---- */

























































LC.fx = (function () {


var MAX = 60;





var DPR_MAX = 1.5;
var DPR_MAX_ANDROID = 1;





var FRAME_MS = 1000 / 30;
var FRAME_SLACK = 8;


var DT_CAP = 50;



var IDLE_MS = 500;
var TWO_PI = Math.PI * 2;









var REF_W = 960;
var UNIT_MIN = 0.5;
var UNIT_MAX = 4;




var SPRITE_CACHE = 6;

var BAT_FRAMES = 8;

var BAT_PAD = 0.3;




var fadeK = 1;





var fillNow = null;
var tDirty = false;





function rand(rnd, from, to) {
return from + (to - from) * rnd();
}








function particle(x, y, vx, vy, size, life, rot, kind) {
return { x: x, y: y, vx: vx, vy: vy, size: size, life: life, rot: rot, kind: kind || 0, phase: 0, preset: '' };
}




function wrap(p, w, h) {
var m = p.size + 2;
if (p.x < -m) p.x = w + m;
else if (p.x > w + m) p.x = -m;
if (p.y < -m) p.y = h + m;
else if (p.y > h + m) p.y = -m;
}




function alpha(ctx, value) {
value = value * fadeK;
ctx.globalAlpha = value < 0 ? 0 : (value > 1 ? 1 : value);
}























function num(value, def) {
return typeof value === 'number' && !isNaN(value) ? value : def;
}


function rgbOf(hex) {
var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec('' + (hex || ''));
if (!m) return [255, 255, 255];
return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function rgba(rgb, a) {
return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
}


function mix(a, b, t) {
return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
}


function surface(wpx, hpx) {
var d = doc();
if (!d || typeof d.createElement !== 'function') return null;
var canvas = d.createElement('canvas');
canvas.width = Math.max(2, Math.ceil(wpx));
canvas.height = Math.max(2, Math.ceil(hpx));
var ctx = canvas.getContext ? canvas.getContext('2d') : null;
if (!ctx) return null;
return { canvas: canvas, ctx: ctx, w: canvas.width, h: canvas.height };
}




function unitGrad(maker, stops) {
var g = maker.createRadialGradient(0, 0, 0, 0, 0, 1);
for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
return g;
}





function glow(ctx, grad, S, x, y, rx, ry, a) {
alpha(ctx, a);
if (fillNow !== grad) {
ctx.fillStyle = grad;
fillNow = grad;
}
ctx.setTransform(S * rx, 0, 0, S * ry, S * x, S * y);
ctx.fillRect(-1, -1, 2, 2);
tDirty = true;
}



function flat(ctx, S) {
if (!tDirty) return;
ctx.setTransform(S, 0, 0, S, 0, 0);
tDirty = false;
}


function spot(ctx, p, color, a, S) {
flat(ctx, S);
alpha(ctx, a);
if (fillNow !== color) {
ctx.fillStyle = color;
fillNow = color;
}
ctx.beginPath();
ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
ctx['fill']();
}






function batNodes(a) {
var k = 1 - 0.14 * Math.abs(a);
var tip = [0.98 * k, -0.02 - 0.72 * a];
var f1 = [0.74 * k, 0.07 - 0.52 * a];
var f2 = [0.5, 0.11 - 0.3 * a];
var f3 = [0.27, 0.14 - 0.14 * a];
function notch(from, to) {
return [to[0], to[1], (from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 0.09];
}
return [
[0, -0.19],
[0.03, -0.2],
[0.058, -0.32],
[0.078, -0.18],
[0.1, -0.08, 0.1, -0.15],
[0.42, -0.15 - 0.42 * a],
[tip[0], tip[1], 0.72 * k, -0.14 - 0.64 * a],
notch(tip, f1),
notch(f1, f2),
notch(f2, f3),
notch(f3, [0.07, 0.2]),
[0, 0.29, 0.05, 0.28]
];
}

function traceBat(c, cx, cy, R, a) {
var n = batNodes(a);
var i, q;
c.beginPath();
c.moveTo(cx + n[0][0] * R, cy + n[0][1] * R);
for (i = 1; i < n.length; i++) {
q = n[i];
if (q.length > 2) c.quadraticCurveTo(cx + q[2] * R, cy + q[3] * R, cx + q[0] * R, cy + q[1] * R);
else c.lineTo(cx + q[0] * R, cy + q[1] * R);
}

for (i = n.length - 1; i >= 1; i--) {
q = n[i];
var prev = n[i - 1];
if (q.length > 2) c.quadraticCurveTo(cx - q[2] * R, cy + q[3] * R, cx - prev[0] * R, cy + prev[1] * R);
else c.lineTo(cx - prev[0] * R, cy + prev[1] * R);
}
c.closePath();
}




function batSheet(color, R) {
var rgb = rgbOf(color);
var pad = BAT_PAD * R;
var frames = [];
for (var f = 0; f < BAT_FRAMES; f++) {
var s = surface(2 * (R + pad), (0.8 + 0.35) * R + 2 * pad);
if (!s) return null;
var c = s.ctx;
c.shadowColor = rgba(rgb, 0.85);
c.shadowBlur = R * 0.26;
c.fillStyle = '#120806';



traceBat(c, R + pad, 0.8 * R + pad, R, 0.225 + 0.775 * Math.cos(TWO_PI * f / BAT_FRAMES));
c['fill']();

c.shadowBlur = 0;
c.shadowColor = 'rgba(0,0,0,0)';
c['fill']();
frames.push(s.canvas);
}
return frames;
}


function traceHeart(c, cx, cy, R) {
c.beginPath();
c.moveTo(cx, cy + 0.36 * R);
c.bezierCurveTo(cx - 0.06 * R, cy + 0.3 * R, cx - 0.5 * R, cy + 0.06 * R, cx - 0.5 * R, cy - 0.16 * R);
c.bezierCurveTo(cx - 0.5 * R, cy - 0.42 * R, cx - 0.2 * R, cy - 0.52 * R, cx, cy - 0.28 * R);
c.bezierCurveTo(cx + 0.2 * R, cy - 0.52 * R, cx + 0.5 * R, cy - 0.42 * R, cx + 0.5 * R, cy - 0.16 * R);
c.bezierCurveTo(cx + 0.5 * R, cy + 0.06 * R, cx + 0.06 * R, cy + 0.3 * R, cx, cy + 0.36 * R);
c.closePath();
}



function bokeh(maker, rgb) {
return unitGrad(maker, [
[0, rgba(rgb, 0.5)], [0.55, rgba(rgb, 0.56)], [0.8, rgba(rgb, 0.72)],
[0.9, rgba(rgb, 0.3)], [1, rgba(rgb, 0)]
]);
}


function bulb(maker, rgb) {
return unitGrad(maker, [
[0, 'rgba(255,250,235,1)'], [0.1, rgba(mix(rgb, [255, 250, 235], 0.45), 1)],
[0.22, rgba(rgb, 0.7)], [0.46, rgba(rgb, 0.24)], [1, rgba(rgb, 0)]
]);
}








function bitmapize(holder, key) {
try {
var src = holder[key];
if (!src || typeof window.createImageBitmap !== 'function') return;
var pending = window.createImageBitmap(src);
if (pending && typeof pending.then === 'function') {
pending.then(function (bmp) {
if (!bmp) return;

if (holder.closed) {
try { bmp.close(); } catch (e) { }
return;
}
holder[key] = bmp;
}, function () { });
}
} catch (e) { }
}


function maker() {
var s = surface(2, 2);
return s && typeof s.ctx.createRadialGradient === 'function' ? s.ctx : null;
}



var LIGHTS = [[255, 206, 120], [255, 160, 64], [255, 86, 72], [108, 214, 138], [150, 200, 255]];





function dot(ctx, p, color, a) {
alpha(ctx, a);
ctx.fillStyle = color;
fillNow = color;
ctx.beginPath();
ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
ctx['fill']();
}

var presets = {



bats: {
count: 12,
spawn: function (i, w, h, rnd) {
var p = particle(
rand(rnd, 0, w),
rand(rnd, -h * 0.15, h * 0.85),
0,
0,
rand(rnd, 7, 13),
rand(rnd, 0, TWO_PI),
0
);
p.phase = rand(rnd, 0, TWO_PI);


p.freq = rand(rnd, 0.0012, 0.0026);
p.amp = rand(rnd, 0.05, 0.11);
return p;
},
step: function (p, dt) {
p.phase += dt * p.freq;
if (p.phase > TWO_PI * 64) p.phase -= TWO_PI * 64;
p.vx = Math.cos(p.phase) * p.amp;
p.vy = Math.sin(p.phase * 0.6) * p.amp * 0.35;
p.x += p.vx * dt;
p.y += p.vy * dt;
p.life += dt * 0.012;
},
draw: function (ctx, p, w, h, color) {
var flap = Math.sin(p.life) * 0.5 + 0.5;
var s = p.size;
var lift = s * (0.25 + flap * 0.45);
alpha(ctx, 0.5);
ctx.fillStyle = color;
ctx.beginPath();
ctx.moveTo(p.x, p.y);
ctx.quadraticCurveTo(p.x - s * 0.5, p.y - lift, p.x - s, p.y);
ctx.quadraticCurveTo(p.x - s * 0.5, p.y + s * 0.18, p.x, p.y + s * 0.12);
ctx.quadraticCurveTo(p.x + s * 0.5, p.y + s * 0.18, p.x + s, p.y);
ctx.quadraticCurveTo(p.x + s * 0.5, p.y - lift, p.x, p.y);
ctx['fill']();
}
},




snow: {
count: 55,
spawn: function (i, w, h, rnd) {
var big = i >= 40;
var p = particle(
rand(rnd, 0, w),
rand(rnd, -h * 0.2, h),
rand(rnd, -0.004, 0.012),
big ? rand(rnd, 0.035, 0.06) : rand(rnd, 0.015, 0.032),
big ? rand(rnd, 2.6, 4.6) : rand(rnd, 1.1, 2.2),
rand(rnd, 0.35, 0.8),
0,
big ? 1 : 0
);
p.phase = rand(rnd, 0, TWO_PI);
p.freq = rand(rnd, 0.0008, 0.0018);
p.amp = rand(rnd, 0.004, 0.014);
return p;
},
step: function (p, dt) {
p.phase += dt * p.freq;
p.x += (p.vx + Math.sin(p.phase) * p.amp) * dt;
p.y += p.vy * dt;
},
draw: function (ctx, p, w, h, color) {
dot(ctx, p, color, p.life * (p.kind ? 0.62 : 0.4));
}
},



stars: {
count: 50,
spawn: function (i, w, h, rnd) {
var p = particle(
rand(rnd, 0, w),
rand(rnd, -h * 0.1, h),
rand(rnd, -0.002, 0.002),
rand(rnd, -0.002, 0.002),
rand(rnd, 0.7, 1.9),
rand(rnd, 0, TWO_PI),
0
);
p.freq = rand(rnd, 0.0009, 0.0035);
return p;
},
step: function (p, dt) {
p.x += p.vx * dt;
p.y += p.vy * dt;
p.life += dt * p.freq;
if (p.life > TWO_PI * 64) p.life -= TWO_PI * 64;
},
draw: function (ctx, p, w, h, color) {
dot(ctx, p, color, 0.22 + 0.33 * (Math.sin(p.life) * 0.5 + 0.5));
}
},



rain: {
count: 48,
spawn: function (i, w, h, rnd) {
var drop = i >= 40;
var p = particle(
rand(rnd, 0, w),
rand(rnd, -h * 0.2, h),
drop ? rand(rnd, -0.004, 0.004) : rand(rnd, -0.22, -0.12),
drop ? rand(rnd, 0.004, 0.012) : rand(rnd, 0.55, 0.95),
drop ? rand(rnd, 3, 7) : rand(rnd, 10, 22),
rand(rnd, 0.3, 0.7),
0,
drop ? 1 : 0
);
return p;
},
step: function (p, dt) {
p.x += p.vx * dt;
p.y += p.vy * dt;
},
draw: function (ctx, p, w, h, color) {
if (p.kind) {
dot(ctx, p, color, p.life * 0.3);
return;
}
alpha(ctx, p.life * 0.45);
ctx.strokeStyle = color;
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(p.x, p.y);
ctx.lineTo(p.x - p.size * 0.28, p.y + p.size);
ctx.stroke();
}
},




sand: {
count: 30,
spawn: function (i, w, h, rnd) {
var p = particle(
rand(rnd, 0, w),
rand(rnd, -h * 0.1, h),
rand(rnd, 0.02, 0.07),
0,
rand(rnd, 14, 46),
rand(rnd, 0.06, 0.16),
0
);
p.phase = rand(rnd, 0, TWO_PI);
p.freq = rand(rnd, 0.001, 0.003);
p.amp = rand(rnd, 0.006, 0.02);
return p;
},
step: function (p, dt) {
p.phase += dt * p.freq;
p.x += p.vx * dt;
p.vy = Math.sin(p.phase) * p.amp;
p.y += p.vy * dt;
},
draw: function (ctx, p, w, h, color) {
dot(ctx, p, color, p.life);
}
},



bubbles: {
count: 23,
spawn: function (i, w, h, rnd) {
var ray = i >= 20;
var p = particle(
ray ? rand(rnd, w * 0.1, w * 0.9) : rand(rnd, 0, w),
ray ? rand(rnd, 0, h * 0.2) : rand(rnd, 0, h),
0,
ray ? 0 : rand(rnd, -0.05, -0.018),
ray ? rand(rnd, 30, 70) : rand(rnd, 2, 7),
rand(rnd, 0.2, 0.5),
ray ? rand(rnd, -0.5, -0.2) : 0,
ray ? 1 : 0
);
p.phase = rand(rnd, 0, TWO_PI);
p.freq = rand(rnd, 0.0006, 0.0018);
p.amp = rand(rnd, 0.004, 0.012);
return p;
},
step: function (p, dt) {
p.phase += dt * p.freq;
if (p.kind) return;
p.vx = Math.sin(p.phase) * p.amp;
p.x += p.vx * dt;
p.y += p.vy * dt;
},
draw: function (ctx, p, w, h, color) {
if (p.kind) {
alpha(ctx, 0.06 + 0.05 * (Math.sin(p.phase) * 0.5 + 0.5));
ctx.fillStyle = color;
ctx.save();
ctx.translate(p.x, p.y);
ctx.rotate(p.rot);
ctx.beginPath();
ctx.moveTo(-p.size * 0.5, 0);
ctx.lineTo(p.size * 0.5, 0);
ctx.lineTo(p.size * 1.4, h);
ctx.lineTo(-p.size * 1.4, h);
ctx.closePath();
ctx['fill']();
ctx.restore();
return;
}
alpha(ctx, p.life);
ctx.strokeStyle = color;
ctx.lineWidth = 1;
ctx.beginPath();
ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
ctx.stroke();
}
},



petals: {
count: 18,
spawn: function (i, w, h, rnd) {
var p = particle(
rand(rnd, 0, w),
rand(rnd, -h * 0.2, h),
rand(rnd, -0.01, 0.02),
rand(rnd, 0.02, 0.05),
rand(rnd, 4, 9),
rand(rnd, 0.35, 0.7),
rand(rnd, 0, TWO_PI)
);
p.phase = rand(rnd, 0, TWO_PI);
p.freq = rand(rnd, 0.0008, 0.002);
p.amp = rand(rnd, 0.008, 0.022);
p.spin = rand(rnd, 0.0008, 0.0026);
return p;
},
step: function (p, dt) {
p.phase += dt * p.freq;
p.x += (p.vx + Math.sin(p.phase) * p.amp) * dt;
p.y += p.vy * dt;
p.rot += p.spin * dt;
if (p.rot > TWO_PI * 64) p.rot -= TWO_PI * 64;
},
draw: function (ctx, p, w, h, color) {
alpha(ctx, p.life * 0.62);
ctx.fillStyle = color;
ctx.save();
ctx.translate(p.x, p.y);
ctx.rotate(p.rot);
ctx.beginPath();

ctx.moveTo(0, -p.size);
ctx.quadraticCurveTo(p.size * 0.7 * Math.cos(p.rot), 0, 0, p.size);
ctx.quadraticCurveTo(-p.size * 0.7 * Math.cos(p.rot), 0, 0, -p.size);
ctx['fill']();
ctx.restore();
}
},




embers: {
count: 30,
spawn: function (i, w, h, rnd) {
var p = particle(
rand(rnd, 0, w),
rand(rnd, h * 0.4, h),
rand(rnd, -0.008, 0.008),
rand(rnd, -0.09, -0.03),
rand(rnd, 1.2, 3),
rand(rnd, 0.2, 1),
0
);
p.phase = rand(rnd, 0, TWO_PI);
p.freq = rand(rnd, 0.0012, 0.0032);
p.fade = rand(rnd, 0.00018, 0.00045);
return p;
},
step: function (p, dt, w, h) {
p.phase += dt * p.freq;
p.x += (p.vx + Math.sin(p.phase) * 0.01) * dt;
p.y += p.vy * dt;
p.life -= p.fade * dt;
if (p.life <= 0) {
p.life = 1;
p.x = Math.random() * w;
p.y = h * (0.75 + Math.random() * 0.25);
}
},
draw: function (ctx, p, w, h, color) {
dot(ctx, p, color, p.life * 0.6);
}
},





glitch: {
count: 2,
spawn: function (i, w, h, rnd) {
var p = particle(
0,
rand(rnd, 0, h),
0,
0,
rand(rnd, 6, 26),
rand(rnd, 600, 6000),
0
);
p.amp = rand(rnd, 0.1, 0.5);
return p;
},
step: function (p, dt, w, h) {
p.life -= dt;
if (p.life < -180) {
p.life = 3000 + Math.random() * 3000;
p.y = Math.random() * h;
p.size = 6 + Math.random() * 20;
p.amp = 0.1 + Math.random() * 0.4;
}
},
draw: function (ctx, p, w, h, color) {
if (p.life > 0) return;
alpha(ctx, 0.05 + p.amp * 0.08);
ctx.fillStyle = color;
ctx.fillRect(0, p.y, w, p.size);
}
},























halloween: {
count: 39,
scene: true,
spawn: function (i, w, h, rnd) {
var p;
if (i < 32) {
p = particle(
rand(rnd, 0, w),
rand(rnd, h * 0.3, h),
rand(rnd, -0.006, 0.006),
rand(rnd, -0.05, -0.02),
rand(rnd, 2, 3.8),
rand(rnd, 0.3, 1),


i >= 23 ? 1 : 0,
0
);
p.phase = rand(rnd, 0, TWO_PI);
p.freq = rand(rnd, 0.003, 0.007);
p.fade = rand(rnd, 0.00012, 0.00028);
p.amp = rand(rnd, 0.006, 0.016);
return p;
}
var depth = rand(rnd, 0.5, 1.25);
p = particle(
rand(rnd, 0, w),
rand(rnd, h * 0.08, h * 0.32),
(rnd() < 0.5 ? -1 : 1) * rand(rnd, 0.035, 0.065) * depth,
0,
24 * depth,
rand(rnd, 0, TWO_PI),
0,
1
);
p.depth = depth;
p.phase = rand(rnd, 0, TWO_PI);
p.freq = rand(rnd, 0.0008, 0.0016);
p.amp = rand(rnd, 0.01, 0.024);

p.flap = rand(rnd, 0.019, 0.026);
return p;
},
step: function (p, dt, w, h) {
p.phase += dt * p.freq;
if (p.phase > TWO_PI * 64) p.phase -= TWO_PI * 64;
if (p.kind === 1) {
p.vy = Math.sin(p.phase) * p.amp;
p.x += p.vx * dt;
p.y += p.vy * dt;
p.life += dt * p.flap;
if (p.life > TWO_PI * 64) p.life -= TWO_PI * 64;
return;
}
p.x += (p.vx + Math.sin(p.phase * 0.35) * p.amp) * dt;
p.y += p.vy * dt;
p.life -= p.fade * dt;
if (p.life <= 0 || p.y < h * 0.05) {
p.life = 1;
p.x = Math.random() * w;
p.y = h * (0.82 + Math.random() * 0.18);
}
},
draw: function (ctx, p, w, h, color, s) {
if (p.kind === 1) {
var a = 0.6 + 0.4 * (p.depth - 0.5) / 0.75;
if (s) {
var frame = Math.floor(p.life / TWO_PI * BAT_FRAMES) % BAT_FRAMES;
var r = p.size;
var pad = BAT_PAD * r;
flat(ctx, s.S);
alpha(ctx, a);
ctx.drawImage(s.bats[frame], p.x - r - pad, p.y - 0.8 * r - pad, 2 * (r + pad), 1.15 * r + 2 * pad);
return;
}
presets.bats.draw(ctx, p, w, h, color);
return;
}

var heat = p.life * (0.72 + 0.28 * Math.sin(p.phase * 2.3));
if (s) {
var r2 = p.size * (p.rot ? 7 : 5.5);
glow(ctx, p.rot ? s.hot : s.ember, s.S, p.x, p.y, r2, r2, heat);
return;
}
dot(ctx, p, color, heat * 0.8);
},
sprites: function (color, scale) {
var g = maker();
if (!g) return null;
var rgb = rgbOf(color);
var deep = mix(rgb, [150, 24, 8], 0.45);
var out = {
S: scale,
ember: unitGrad(g, [
[0, 'rgba(255,240,210,1)'], [0.12, 'rgba(255,200,120,.95)'], [0.26, rgba(rgb, 0.66)],
[0.52, rgba(deep, 0.24)], [1, rgba(deep, 0)]
]),
hot: unitGrad(g, [
[0, 'rgba(255,252,238,1)'], [0.12, 'rgba(255,222,150,1)'], [0.26, rgba(rgb, 0.78)],
[0.52, rgba(deep, 0.26)], [1, rgba(deep, 0)]
]),


bats: batSheet(color, 31 * scale)
};
if (!out.bats) return null;
for (var f = 0; f < out.bats.length; f++) bitmapize(out.bats, f);
return out;
}
},















winter: {
count: 58,
scene: true,
spawn: function (i, w, h, rnd) {
var p;
if (i < 6) {
p = particle(
rand(rnd, w * 0.48, w),
rand(rnd, h * 0.14, h * 0.72),
rand(rnd, -0.004, 0.004),
rand(rnd, -0.003, 0.003),
rand(rnd, 18, 38),
rand(rnd, 0.2, 0.38),
i % 5,
3
);
p.phase = rand(rnd, 0, TWO_PI);
p.freq = rand(rnd, 0.0004, 0.0009);
return p;
}
if (i < 16) {
var t = (i - 6) / 9;
var sag = 4 * t * (1 - t);
p = particle(
w * (0.04 + 0.92 * t),
Math.min(h * 0.28, 60 + 32 * sag),
0,
0,
rand(rnd, 6, 7.5),
1,
(i - 6) % 5,
4
);

p.phase = (i - 6) * 0.9;
p.freq = 0.0021;
return p;
}
var plane = i < 38 ? 0 : (i < 52 ? 1 : 2);
p = particle(
rand(rnd, 0, w),
rand(rnd, -h * 0.2, h),
plane === 2 ? rand(rnd, 0.004, 0.02) : rand(rnd, -0.004, 0.01),
plane === 0 ? rand(rnd, 0.011, 0.02) : (plane === 1 ? rand(rnd, 0.026, 0.045) : rand(rnd, 0.06, 0.095)),
plane === 0 ? rand(rnd, 1, 1.7) : (plane === 1 ? rand(rnd, 2.4, 3.8) : rand(rnd, 7, 13)),
plane === 0 ? rand(rnd, 0.5, 0.8) : (plane === 1 ? rand(rnd, 0.85, 1) : rand(rnd, 0.45, 0.65)),
0,
plane
);
p.phase = rand(rnd, 0, TWO_PI);
p.freq = rand(rnd, 0.0007, 0.0016);
p.amp = plane === 2 ? rand(rnd, 0.01, 0.024) : rand(rnd, 0.004, 0.014);
return p;
},
step: function (p, dt) {
p.phase += dt * p.freq;
if (p.phase > TWO_PI * 64) p.phase -= TWO_PI * 64;
if (p.kind === 4) return;
if (p.kind === 3) {
p.x += p.vx * dt;
p.y += p.vy * dt;
return;
}
p.x += (p.vx + Math.sin(p.phase) * p.amp) * dt;
p.y += p.vy * dt;
},
draw: function (ctx, p, w, h, color, s) {
if (p.kind === 3) {
if (s) glow(ctx, s.bokeh[p.rot], s.S, p.x, p.y, p.size, p.size, p.life * (0.6 + 0.4 * Math.sin(p.phase)));
return;
}
if (p.kind === 4) {
var tw = 0.5 + 0.5 * Math.sin(p.phase);
var a = 0.4 + 0.6 * tw * tw;
if (s) {
glow(ctx, s.bulb[p.rot], s.S, p.x, p.y, p.size * 4, p.size * 4, a);
return;
}
dot(ctx, p, rgba(LIGHTS[p.rot], 1), a);
return;
}
if (!s) {
dot(ctx, p, color, p.kind === 2 ? p.life * 0.5 : p.life);
return;
}
if (p.kind === 2) glow(ctx, s.blur, s.S, p.x, p.y, p.size * 1.15, p.size * 1.15, p.life);
else if (p.kind === 1) glow(ctx, s.flake, s.S, p.x, p.y, p.size * 2.3, p.size * 2.3, p.life);
else spot(ctx, p, color, p.life, s.S);
},
sprites: function (color, scale) {
var g = maker();
if (!g) return null;
var white = rgbOf(color);
var out = {
S: scale,



flake: unitGrad(g, [[0, rgba(white, 1)], [0.3, rgba(white, 1)], [0.42, rgba(white, 0.5)], [0.68, rgba(white, 0.14)], [1, rgba(white, 0)]]),
blur: unitGrad(g, [[0, rgba(white, 0.85)], [0.5, rgba(white, 0.7)], [0.8, rgba(white, 0.3)], [1, rgba(white, 0)]]),
bokeh: [],
bulb: []
};
for (var i = 0; i < LIGHTS.length; i++) {
out.bokeh.push(bokeh(g, LIGHTS[i]));
out.bulb.push(bulb(g, LIGHTS[i]));
}
return out;
}
},




hearts: {
count: 22,
scene: true,
spawn: function (i, w, h, rnd) {
var p;
if (i < 6) {
p = particle(
rand(rnd, w * 0.48, w),
rand(rnd, h * 0.1, h * 0.75),
rand(rnd, -0.004, 0.004),
rand(rnd, -0.004, 0.002),
rand(rnd, 16, 34),
rand(rnd, 0.16, 0.3),
i % 2,
1
);
p.phase = rand(rnd, 0, TWO_PI);
p.freq = rand(rnd, 0.0004, 0.0009);
return p;
}
p = particle(
rand(rnd, 0, w),
rand(rnd, 0, h),
rand(rnd, -0.004, 0.004),
rand(rnd, -0.042, -0.016),
rand(rnd, 6, 12),
rand(rnd, 0.55, 0.9),
0,
0
);
p.phase = rand(rnd, 0, TWO_PI);
p.freq = rand(rnd, 0.0008, 0.0016);
p.amp = rand(rnd, 0.008, 0.02);
return p;
},
step: function (p, dt) {
p.phase += dt * p.freq;
if (p.phase > TWO_PI * 64) p.phase -= TWO_PI * 64;
if (p.kind === 1) {
p.x += p.vx * dt;
p.y += p.vy * dt;
return;
}
p.x += (p.vx + Math.sin(p.phase) * p.amp) * dt;
p.y += p.vy * dt;
},
draw: function (ctx, p, w, h, color, s) {
if (p.kind === 1) {
if (s) glow(ctx, s.bokeh[p.rot], s.S, p.x, p.y, p.size, p.size, p.life * (0.6 + 0.4 * Math.sin(p.phase)));
return;
}
if (s) {
var d = p.size * 2.6;
flat(ctx, s.S);
alpha(ctx, p.life);
ctx.drawImage(s.heart, p.x - d * 0.5, p.y - d * 0.5, d, d);
return;
}
dot(ctx, p, color, p.life * 0.7);
},
sprites: function (color, scale) {
var g = maker();
if (!g) return null;
var rgb = rgbOf(color);

var R = 12 * scale;
var s = surface(2.6 * R, 2.6 * R);
if (!s) return null;
s.ctx.shadowColor = rgba(rgb, 0.9);
s.ctx.shadowBlur = R * 0.45;
s.ctx.fillStyle = rgba(mix(rgb, [255, 255, 255], 0.25), 1);
traceHeart(s.ctx, s.w / 2, s.h / 2, R * 1.9);
s.ctx['fill']();
var out = {
S: scale,
heart: s.canvas,
bokeh: [bokeh(g, rgb), bokeh(g, mix(rgb, [255, 214, 226], 0.6))]
};
bitmapize(out, 'heart');
return out;
}
}
};



function spawn(name, w, h, n, rnd) {
var preset = typeof name === 'string' ? presets[name] : name;
if (!preset || !(w > 0) || !(h > 0)) return [];
var count = typeof n === 'number' ? n : preset.count;
if (count > MAX) count = MAX;
if (!(count > 0)) return [];
var random = typeof rnd === 'function' ? rnd : Math.random;
var id = typeof name === 'string' ? name : '';
var out = [];
for (var i = 0; i < count; i++) {
var p = preset.spawn(i, w, h, random);
p.preset = id;
out.push(p);
}
return out;
}





function step(list, dt, w, h) {
if (!list || !list.length || !(dt > 0)) return list;
for (var i = 0; i < list.length; i++) {
var p = list[i];
var preset = presets[p.preset];
if (!preset) continue;
preset.step(p, dt, w, h);
wrap(p, w, h);
}
return list;
}





var instances = [];
var frame = 0;

var idle = 0;
var last = 0;
var stat_frames = 0;
var stat_steps = 0;
var stat_total = 0;
var stat_max = 0;

function doc() {
try {
if (typeof document !== 'undefined') return document;
} catch (e) { }
return null;
}

function nowMs() {
try {
if (window.performance && typeof window.performance.now === 'function') return window.performance.now();
} catch (e) { }
return Date.now();
}

function raf(fn) {
try {
if (window.requestAnimationFrame) return window.requestAnimationFrame(fn);
} catch (e) { }
return 0;
}

function unraf(id) {
try {
if (id && window.cancelAnimationFrame) window.cancelAnimationFrame(id);
} catch (e) { }
}




function setT(fn, ms) {
var hook = api._timers;
if (hook && typeof hook.set === 'function') return hook.set(fn, ms);
try {
return setTimeout(fn, ms);
} catch (e) {
return 0;
}
}

function clearT(id) {
if (!id) return;
var hook = api._timers;
if (hook && typeof hook.clear === 'function') { hook.clear(id); return; }
try { clearTimeout(id); } catch (e) { }
}

function clearIdle() {
if (!idle) return;
clearT(idle);
idle = 0;
}

function hidden() {
var d = doc();
try {
return !!(d && d.hidden);
} catch (e) {
return false;
}
}

function dpr() {
var value = 1;
try {
value = Number(window.devicePixelRatio) || 1;
} catch (e) { }
if (!(value > 0)) value = 1;
var cap = DPR_MAX;
try {
if (typeof LC.platformInfo === 'function' && LC.platformInfo().android) cap = DPR_MAX_ANDROID;
} catch (e2) { }
return value > cap ? cap : value;
}










function allowedNow() {
try {
if (!LC.enabled()) return false;
if (LC.motionMode() !== 'full') return false;
if (typeof LC.fxHeavy === 'function' && !LC.fxHeavy()) return false;
return true;
} catch (e) {
return false;
}
}

function nodeOf(layer) {
if (!layer) return null;
var node = layer[0] || layer;
return node && typeof node.appendChild === 'function' ? node : null;
}

function find(node) {
for (var i = 0; i < instances.length; i++) {
if (instances[i].node === node) return instances[i];
}
return null;
}




function attached(inst) {
var d = doc();
try {
if (d && d.body && typeof d.body.contains === 'function') return d.body.contains(inst.canvas);
} catch (e) { }
return !!inst.canvas.parentNode;
}






function covered() {
try {
return typeof LC.covered === 'function' && LC.covered() === true;
} catch (e) {
return false;
}
}







function archived(inst) {
try {
var node = inst.node;
if (node && typeof node.closest === 'function') return !LC.util.onScreen(node);
} catch (e) { }
return false;
}








function paused(inst) {
if (hidden()) return true;
if (covered()) return true;
if (LC.util.playerOpen()) return true;
try {
if (inst.paused && inst.paused()) return true;
} catch (e) { }
return archived(inst);
}







function safeZone(spec, w, h) {
if (!spec || typeof spec !== 'object') return null;
var l = num(spec.left, 0);
var t = num(spec.top, 0);
var r = num(spec.right, 1);
var b = num(spec.bottom, 1);
if (!(r > l) || !(b > t)) return null;
var floor = num(spec.floor, 0.2);
var feather = num(spec.feather, 0.08) * w;
return {
x0: l * w, y0: t * h, x1: r * w, y1: b * h,
floor: floor < 0 ? 0 : (floor > 1 ? 1 : floor),
feather: feather > 1 ? feather : 1
};
}

function shade(zone, x, y) {
var dx = x < zone.x0 ? zone.x0 - x : (x > zone.x1 ? x - zone.x1 : 0);
var dy = y < zone.y0 ? zone.y0 - y : (y > zone.y1 ? y - zone.y1 : 0);
var d = dx > dy ? dx : dy;
if (d >= zone.feather) return 1;
return zone.floor + (1 - zone.floor) * (d / zone.feather);
}

function render(inst, dt) {
var ctx = inst.ctx;
fadeK = 1;
fillNow = null;
tDirty = false;
ctx.clearRect(0, 0, inst.w, inst.h);
stat_steps++;
var preset = presets[inst.name];
if (!preset) return;
var zone = inst.safe;
var sprites = inst.sprites;






var list = inst.particles;
var w = inst.w;
var h = inst.h;
var color = inst.color;
var moving = dt > 0;
for (var i = 0; i < list.length; i++) {
var p = list[i];
if (moving) {
preset.step(p, dt, w, h);
wrap(p, w, h);
}
fadeK = zone ? shade(zone, p.x, p.y) : 1;
preset.draw(ctx, p, w, h, color, sprites);
}
fadeK = 1;


if (tDirty) flat(ctx, inst.S);
ctx.globalAlpha = 1;
}



function unitOf(w) {
var u = w / REF_W;
if (!(u > 0)) return 1;
return u < UNIT_MIN ? UNIT_MIN : (u > UNIT_MAX ? UNIT_MAX : u);
}




var sprite_cache = {};
var sprite_keys = [];

function spritesFor(name, color, scale) {
var preset = presets[name];
if (!preset || typeof preset.sprites !== 'function') return null;
var key = name + '|' + color + '|' + Math.round(scale * 100);
if (Object.prototype.hasOwnProperty.call(sprite_cache, key)) return sprite_cache[key];
var made = null;
try {
made = preset.sprites(color, scale) || null;
} catch (e) {
made = null;
}
sprite_cache[key] = made;
sprite_keys.push(key);
while (sprite_keys.length > SPRITE_CACHE) {
var old = sprite_cache[sprite_keys[0]];
delete sprite_cache[sprite_keys.shift()];
if (!spritesUsed(old)) closeSprites(old);
}
return made;
}









function spritesUsed(set) {
if (!set) return false;
for (var i = 0; i < instances.length; i++) if (instances[i].sprites === set) return true;
for (var k in sprite_cache) {
if (Object.prototype.hasOwnProperty.call(sprite_cache, k) && sprite_cache[k] === set) return true;
}
return false;
}

function shutHolder(holder) {
holder.closed = true;
for (var k in holder) {
if (!Object.prototype.hasOwnProperty.call(holder, k)) continue;
var v = holder[k];
if (v && typeof v.close === 'function') {
try { v.close(); } catch (e) { }
}
}
}

function closeSprites(set) {
if (!set || set.closed) return;
shutHolder(set);
for (var k in set) {
if (Object.prototype.hasOwnProperty.call(set, k) && Object.prototype.toString.call(set[k]) === '[object Array]') shutHolder(set[k]);
}
}



function toggleClass(node, name, on) {
try {
if (node.classList) {
if (on) node.classList.add(name);
else node.classList.remove(name);
return;
}
var list = ('' + (node.className || '')).split(/\s+/);
var out = [];
for (var i = 0; i < list.length; i++) if (list[i] && list[i] !== name) out.push(list[i]);
if (on) out.push(name);
node.className = out.join(' ');
} catch (e) { }
}

function loop(ts) {
frame = 0;
var i;
for (i = instances.length - 1; i >= 0; i--) {
if (!attached(instances[i])) drop(instances[i]);
}
if (!instances.length) { last = 0; return; }
var time = typeof ts === 'number' ? ts : nowMs();


if (last && time - last > 0 && time - last < FRAME_MS - FRAME_SLACK && !hidden()) {
frame = raf(loop);
return;
}
var dt = last ? time - last : 16;
last = time;
if (dt > DT_CAP) dt = DT_CAP;
if (!(dt > 0)) dt = 0;



var live = !hidden();
if (dt > 0 && !hidden()) {
var started = nowMs();
var drawn = 0;
for (i = 0; i < instances.length; i++) {
if (paused(instances[i])) continue;
try {
render(instances[i], dt);
drawn++;
} catch (e) {
warn('fx: render failed', e);


drop(instances[i]);
i--;
}
}
live = drawn > 0;
if (drawn) {
var spent = nowMs() - started;
stat_frames++;
stat_total += spent;
if (spent > stat_max) stat_max = spent;
}
}
schedule(live);
}







function schedule(live) {
if (!instances.length) { last = 0; return; }
if (live) { frame = raf(loop); return; }
last = 0;
idle = setT(idleCheck, IDLE_MS);
}

function idleCheck() {
idle = 0;
if (!instances.length) return;
frame = raf(loop);
}

function wake() {
if (frame || !instances.length) return;
clearIdle();
last = 0;
frame = raf(loop);
}






function drop(inst) {
var i = instances.indexOf(inst);
if (i !== -1) instances.splice(i, 1);


if (inst.sprites && !spritesUsed(inst.sprites)) closeSprites(inst.sprites);
try {
if (inst.canvas.parentNode) inst.canvas.parentNode.removeChild(inst.canvas);
} catch (e) {
warn('fx: canvas remove failed', e);
}
try {
inst.canvas.width = 0;
inst.canvas.height = 0;
} catch (e2) { }
if (inst.scene) toggleClass(inst.node, 'lumen-fx--scene', false);
if (!instances.length) {
unraf(frame);
frame = 0;
clearIdle();
last = 0;
}
}













function sweep() {
for (var i = instances.length - 1; i >= 0; i--) {
if (archived(instances[i])) drop(instances[i]);
}
return instances.length;
}




function handle(inst) {
return {
node: inst.node,
name: inst.name,
particles: inst.particles_of,
destroy: function () { drop(inst); }
};
}










function mount(layer, name, opts) {
try {
opts = opts || {};
var node = nodeOf(layer);
if (!node || !presets[name]) return null;
if (!allowedNow()) return null;
var exist = find(node);



if (exist) return handle(exist);
var d = doc();
if (!d || typeof d.createElement !== 'function') return null;

var w = opts.width || node.offsetWidth || 0;
var h = opts.height || node.offsetHeight || 0;
if (!(w > 0) || !(h > 0)) {
try {
w = w || window.innerWidth || 0;
h = h || window.innerHeight || 0;
} catch (e) { }
}
if (!(w > 0) || !(h > 0)) return null;

var ratio = dpr();
var preset = presets[name];
var canvas = d.createElement('canvas');
canvas.className = 'lumen-fx__canvas' + (preset.scene ? ' lumen-fx__canvas--scene' : '');
canvas.width = Math.round(w * ratio);
canvas.height = Math.round(h * ratio);
var ctx = canvas.getContext ? canvas.getContext('2d') : null;
if (!ctx) return null;




var unit = unitOf(w);
if (typeof ctx.setTransform === 'function') ctx.setTransform(ratio * unit, 0, 0, ratio * unit, 0, 0);
else unit = 1;
var lw = w / unit;
var lh = h / unit;
var color = opts.color || '#FFFFFF';
node.appendChild(canvas);
if (preset.scene) toggleClass(node, 'lumen-fx--scene', true);

var inst = {
node: node,
canvas: canvas,
ctx: ctx,
name: name,
w: lw,
h: lh,
unit: unit,
S: ratio * unit,
scene: !!preset.scene,
color: color,
safe: safeZone(opts.safe, lw, lh),
sprites: spritesFor(name, color, ratio * unit),
paused: typeof opts.paused === 'function' ? opts.paused : null,
particles: spawn(name, lw, lh, opts.count, Math.random)
};


inst.particles_of = function () { return inst.particles; };
instances.push(inst);
wake();
return handle(inst);
} catch (e) {
warn('fx: mount failed', e);
return null;
}
}

function unmount(layer) {
var node = nodeOf(layer);
if (!node) return;
var inst = find(node);
if (inst) drop(inst);
}

function unmountAll() {
while (instances.length) drop(instances[instances.length - 1]);
}

function stats() {
var count = 0;
for (var i = 0; i < instances.length; i++) count += instances[i].particles.length;
return {
frames: stat_frames,
steps: stat_steps,
avgMs: stat_frames ? stat_total / stat_frames : 0,
maxMs: stat_max,
particles: count,
layers: instances.length
};
}

var api = {
MAX: MAX,
presets: presets,
spawn: spawn,
step: step,
mount: mount,
unmount: unmount,
unmountAll: unmountAll,
sweep: sweep,
active: function () { return instances.length; },
stats: stats,
REF_W: REF_W,
unitOf: unitOf,

_timers: null
};
return api;
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.fx;


/* ---- 53_themes.js ---- */


























LC.themes = (function () {


var ADVENT_LAST = 24;





var ADVENT_STEP = 7919;







function keywordNames(source) {
var list = null;
if (Array.isArray(source)) list = source;
else if (source && Array.isArray(source.results)) list = source.results;
else if (source && Array.isArray(source.keywords)) list = source.keywords;
if (!list) return [];
var out = [];
for (var i = 0; i < list.length; i++) {
var item = list[i];
var name = item && typeof item === 'string' ? item : (item && item.name);
if (name) out.push(('' + name).toLowerCase());
}
return out;
}



function genreIds(movie) {
var list = (movie && movie.genres) || (movie && movie.genre_ids) || [];
if (!Array.isArray(list)) return [];
var out = [];
for (var i = 0; i < list.length; i++) {
var g = list[i];
var id = (g && typeof g === 'object') ? g.id : g;
if (id != null) out.push(Number(id));
}
return out;
}

function hasGenre(ids, want) {
if (!want || !want.length) return true;
for (var i = 0; i < want.length; i++) {
for (var j = 0; j < ids.length; j++) {
if (Number(want[i]) === ids[j]) return true;
}
}
return false;
}



var WORD_CHAR = /[a-z0-9À-ɏЀ-ӿ]/;









function pluralOf(want) {
return /(s|x|z|ch|sh)$/.test(want) ? 'es' : 's';
}

function hasWord(name, want) {
var tail = pluralOf(want);
var at = name.indexOf(want);
while (at >= 0) {
var before = at > 0 ? name.charAt(at - 1) : '';
var end = at + want.length;
var after = name.charAt(end);
if (after && name.substr(end, tail.length) === tail) {
var past = name.charAt(end + tail.length);
if (!(past && WORD_CHAR.test(past))) after = '';
}
if (!(before && WORD_CHAR.test(before)) && !(after && WORD_CHAR.test(after))) return true;
at = name.indexOf(want, at + 1);
}
return false;
}









function hasKeyword(names, keywords) {
if (!keywords || !keywords.length) return false;
for (var i = 0; i < keywords.length; i++) {
var want = ('' + keywords[i]).toLowerCase();
if (!want) continue;
for (var j = 0; j < names.length; j++) {
if (hasWord(names[j], want)) return true;
}
}
return false;
}




function matchTheme(rules, movie) {
if (!Array.isArray(rules) || !movie) return null;
var names = keywordNames(movie.keywords);
if (!names.length) return null;
var ids = genreIds(movie);
for (var i = 0; i < rules.length; i++) {
var rule = rules[i];
if (!rule || !rule.preset) continue;
if (!hasKeyword(names, rule.keywords)) continue;
if (rule.requireGenre && !hasGenre(ids, rule.genres)) continue;
return rule;
}
return null;
}





function allowed(theme, mode, month) {
if (!theme || mode === 'off') return false;
if (mode !== 'seasonal') return true;
var months = theme.months;
if (!Array.isArray(months) || !months.length) return false;
for (var i = 0; i < months.length; i++) {
if (Number(months[i]) === Number(month)) return true;
}
return false;
}



function seasonalIds(collections, month) {
var out = [];
if (!Array.isArray(collections) || !month) return out;
for (var i = 0; i < collections.length; i++) {
var c = collections[i];
if (!c || !Array.isArray(c.season)) continue;
for (var j = 0; j < c.season.length; j++) {
if (Number(c.season[j]) === Number(month)) { out.push(c.id); break; }
}
}
return out;
}


function monthOf(date) {
if (!date || typeof date.getMonth !== 'function') return 0;
return date.getMonth() + 1;
}



function adventCard(card, day, isToday, words) {
var copy = {};
for (var k in card) {
if (Object.prototype.hasOwnProperty.call(card, k)) copy[k] = card[k];
}
var dayWord = (words && words.day) || 'День';
var todayWord = (words && words.today) || 'Сегодня';
copy.day = day;
copy.lumen_badge = isToday
? todayWord + ' · ' + dayWord.toLowerCase() + ' ' + day
: dayWord + ' ' + day;


if (day === ADVENT_LAST) copy.lumen_final = true;
return copy;
}









function adventDays(pool, today, words) {
var out = [];
if (!Array.isArray(pool) || !pool.length) return out;
if (!today || typeof today.getMonth !== 'function') return out;
if (today.getMonth() !== 11) return out;
var last = today.getDate();
if (last > ADVENT_LAST) last = ADVENT_LAST;
var used = {};
for (var day = 1; day <= last; day++) {
if (out.length >= pool.length) break;
var index = (day * ADVENT_STEP) % pool.length;
var guard = 0;
while (used[index] && guard < pool.length) {
index = (index + 1) % pool.length;
guard++;
}
if (used[index]) break;
used[index] = 1;
out.push(adventCard(pool[index], day, day === today.getDate(), words));
}
return out;
}















function current() {
try {
var m = LC.manifest && typeof LC.manifest.get === 'function' ? LC.manifest.get() : null;
if (m && Array.isArray(m.themes) && m.themes.length) return m.themes;
var built = LC.manifest && LC.manifest.DEFAULT && LC.manifest.DEFAULT.themes;
if (Array.isArray(built)) return built;
} catch (e) {
warn('themes: manifest failed', e);
}
return [];
}




function mode() {
var value = 'seasonal';
try {
if (LC.pref) value = LC.pref('lumen_fx', 'seasonal');
} catch (e) { }
if (value !== 'all' && value !== 'seasonal' && value !== 'off') return 'seasonal';
return value;
}




function forMovie(movie) {
var current_mode = mode();
if (current_mode === 'off') return null;
var theme = matchTheme(current(), movie);
if (!allowed(theme, current_mode, api.month())) return null;
return theme;
}






var PALE = { snow: 1, stars: 1, rain: 1, bubbles: 1, winter: 1 };



function particleColor(theme) {
if (!theme) return '#FFFFFF';
if (PALE[theme.preset]) return '#FFFFFF';
return theme.accent || '#FFFFFF';
}




function classNames() {
var rules = current();
var out = [];
for (var i = 0; i < rules.length; i++) {
if (rules[i] && rules[i].id) out.push('lumen-theme--' + rules[i].id);
}
return out.join(' ');
}





function now() {
return new Date();
}

var api = {
matchTheme: matchTheme,
allowed: allowed,
seasonalIds: seasonalIds,
adventDays: adventDays,
monthOf: monthOf,
month: function () { return monthOf(api._now()); },
today: function () { return api._now(); },
current: current,
classNames: classNames,
particleColor: particleColor,
mode: mode,
forMovie: forMovie,
_now: now
};
return api;
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.themes;


/* ---- 54_ambient.js ---- */











































LC.ambient = (function () {




var SLIDE_MS = 20000;

var FADE_MS = 400;



var REEL = 8;

var DEFAULT_MIN = 3;





var POKE_MS = 1000;




var CONTROLLERS = { content: 1, full_start: 1, full_descr: 1, items_line: 1 };














function sizeFor(width) {
return LC.util.frameSize(width);
}



function nextIndex(index, len) {
var n = Number(len) || 0;
if (n <= 0) return -1;
var i = Number(index);
if (!(i >= 0)) return 0;
return (i + 1) % n;
}




function normalizeFrames(list) {
var out = [];
if (!list || !list.length) return out;
for (var i = 0; i < list.length; i++) {
var item = list[i];
if (!item) continue;
var path = item.path ? ('' + item.path) : '';
var url = item.url ? ('' + item.url) : '';
if (!path && !url) continue;
out.push({ title: item.title ? ('' + item.title) : '', path: path, url: url });
}
return out;
}




function playlist(frames, size, rnd) {
var pool = [];
var i;
if (!frames || !frames.length) return pool;
for (i = 0; i < frames.length; i++) pool.push(frames[i]);
var random = typeof rnd === 'function' ? rnd : Math.random;
for (i = pool.length - 1; i > 0; i--) {
var j = Math.floor(random() * (i + 1));
if (j < 0) j = 0;
if (j > i) j = i;
var tmp = pool[i];
pool[i] = pool[j];
pool[j] = tmp;
}
var limit = Number(size) || 0;
if (limit > 0 && pool.length > limit) pool = pool.slice(0, limit);
return pool;
}




function canStart(state) {
if (!state) return false;
if (!state.enabled) return false;















if (state.native) return false;



if (state.motion === 'off') return false;
if (state.hidden) return false;
if (state.modal || state.player || state.trailer) return false;
if (!state.frames) return false;
return !!CONTROLLERS[state.controller];
}


function clockText(date) {
if (!date || typeof date.getHours !== 'function') return '';
return LC.util.pad2(date.getHours()) + ':' + LC.util.pad2(date.getMinutes());
}





function doc() {
try { return typeof document !== 'undefined' ? document : null; } catch (e) { return null; }
}

function jq() {
try { if (typeof $ === 'function') return $; } catch (e) { }
return null;
}

function hidden() {
var d = doc();
return !!(d && d.hidden);
}



function setT(fn, ms) {
var hook = api._timers;
if (hook && typeof hook.set === 'function') return hook.set(fn, ms);
return setTimeout(fn, ms);
}

function clearT(id) {
if (!id) return;
var hook = api._timers;
if (hook && typeof hook.clear === 'function') { hook.clear(id); return; }
clearTimeout(id);
}

function tmdbImageFn() {
try {
if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function') {
return function (url) { return Lampa.TMDB.image(url); };
}
} catch (e) { }
return null;
}

function apiImgFn() {
try {
if (window.Lampa && Lampa.Api && typeof Lampa.Api.img === 'function') {
return function (path, size) { return Lampa.Api.img(path, size); };
}
} catch (e) { }
return null;
}







function screenWidth() {
return LC.util.screenPx();
}




function urlOf(frame, size) {
if (!frame) return '';
if (frame.url) return frame.url;
if (!frame.path) return '';
try {
if (LC.cardinfo && typeof LC.cardinfo.imageUrl === 'function') {
return LC.cardinfo.imageUrl(frame.path, size, tmdbImageFn(), apiImgFn());
}
} catch (e) { }
try {
var tmdb = tmdbImageFn();
var clean = frame.path.charAt(0) === '/' ? frame.path.slice(1) : frame.path;
if (tmdb) return tmdb('t/p/' + size + '/' + clean);
} catch (e2) { }
return '';
}



var FRAME_PATH = /^\/[A-Za-z0-9_-]+\.(jpg|png)$/;








function curatedFrames() {
var list = null;
try {
var m = LC.manifest && typeof LC.manifest.get === 'function' ? LC.manifest.get() : null;
if (m && m.ambient && m.ambient.length) list = m.ambient;
if (!list && LC.manifest && LC.manifest.DEFAULT) list = LC.manifest.DEFAULT.ambient;
} catch (e) {
warn('ambient: manifest failed', e);
}
var safe = [];
for (var i = 0; list && i < list.length; i++) {
var item = list[i];
if (!item || typeof item.path !== 'string' || !FRAME_PATH.test(item.path)) continue;
safe.push({ title: item.title, path: item.path });
}
return normalizeFrames(safe);
}




function currentFrames() {
var out = [];
try {
var active = LC.active;
if (!active || !active.body || typeof active.body.children !== 'function') return out;
var layer = active.body.children('.lumen-backdrop');
if (!layer || !layer.length) return out;
var urls = layer.data('lumenUrls');
if (!urls || !urls.length) return out;
var movie = (active.data && active.data.movie) || {};
var title = movie.title || movie.name || '';
for (var i = 0; i < urls.length; i++) {
if (urls[i]) out.push({ title: title, url: '' + urls[i], path: '' });
}
} catch (e) {
warn('ambient: current frames failed', e);
}
return normalizeFrames(out);
}




function frames() {
var source = 'curated';
try { source = LC.pref('lumen_ambient_source', 'curated'); } catch (e) { }
if (source === 'current') {
var own = currentFrames();
if (own.length) return own;
}
return curatedFrames();
}



function delayMs() {
var hook = Number(api._delayMs) || 0;
if (hook > 0) return hook;
var minutes = DEFAULT_MIN;
try { minutes = Number(LC.pref('lumen_ambient_delay', '' + DEFAULT_MIN)) || DEFAULT_MIN; } catch (e) { }
if (minutes <= 0) minutes = DEFAULT_MIN;
return minutes * 60000;
}

function enabledNow() {
try {
if (typeof LC.enabled === 'function' && !LC.enabled()) return false;


return !!LC.pref('lumen_ambient', false);
} catch (e) {
return false;
}
}




function trailerLive() {
var q = jq();
if (!q) return false;
try { return !!q('.lumen-trailer-live,.lumen-hero--trailer').length; } catch (e) { return false; }
}

function controllerName() {
try {
if (window.Lampa && Lampa.Controller && typeof Lampa.Controller.enabled === 'function') {
var c = Lampa.Controller.enabled();
return (c && c.name) || '';
}
} catch (e) { }
return '';
}

function modalOpen() {
try {
if (window.Lampa && Lampa.Modal && typeof Lampa.Modal.opened === 'function') return !!Lampa.Modal.opened();
} catch (e) { }
return false;
}

function playerOpen() {
return LC.util.playerOpen();
}













function nativeSaver() {
try {
if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') {
return Lampa.Storage.field('screensaver') === true;
}
} catch (e) { }
return false;
}

function motion() {
try {
if (typeof LC.motionMode === 'function') return LC.motionMode();
} catch (e) { }
return 'full';
}






function markCovered(value) {
try {
if (typeof LC.setCovered === 'function') LC.setCovered(value);
} catch (e) { }
}





var installed = false;
var bound = null;
var idle_timer = 0;
var slide_timer = 0;
var out_timer = 0;
var node = null;
var imgs = [];
var dots = [];
var reel = [];
var index = -1;
var slot = 0;
var live = false;
var preload = null;


var watch = null;
var bad = {};
var last_poke = 0;

function killWatch() {
if (!watch) return;
try {
watch.onload = null;
watch.onerror = null;
watch.src = '';
} catch (e) { }
watch = null;
}

function killPreload() {
if (!preload) return;
try {
preload.onload = null;
preload.onerror = null;
preload.src = '';
} catch (e) { }
preload = null;
}



function preloadNext(url) {
killPreload();
if (!url) return;
var Ctor = null;
try { Ctor = (window && typeof window.Image === 'function') ? window.Image : null; } catch (e) { }
if (!Ctor) return;
try {
var img = new Ctor();
preload = img;
var done = function () {
if (preload !== img) return;
try { img.onload = null; img.onerror = null; } catch (e2) { }
preload = null;
};
img.onload = done;
img.onerror = done;
img.src = url;
} catch (e3) {
warn('ambient: preload failed', e3);
preload = null;
}
}






function watchFrame(url, i) {
killWatch();
var Ctor = null;
try { Ctor = (window && typeof window.Image === 'function') ? window.Image : null; } catch (e) { }
if (!Ctor) return;
try {
var img = new Ctor();
watch = img;
img.onload = function () {
if (watch === img) killWatch();
};
img.onerror = function () {
if (watch !== img) return;
killWatch();
bad[url] = true;
if (!live || index !== i) return;
clearT(slide_timer);
slide_timer = 0;
tick();
};
img.src = url;
} catch (e2) {
warn('ambient: watch failed', e2);
watch = null;
}
}


function nextGood(from, size) {
var i = from;
for (var n = 0; n < reel.length; n++) {
i = nextIndex(i, reel.length);
if (i < 0) return -1;
if (!bad[urlOf(reel[i], size)]) return i;
}
return -1;
}

function paintClock() {
if (!node) return;
try { node.find('.lumen-ambient__clock').text(clockText(new Date())); } catch (e) { }
}



function show(i) {
if (!node || !reel.length) return;
var size = sizeFor(screenWidth());
var frame = reel[i];
var url = urlOf(frame, size);
if (!url) return;
var target = imgs[slot];
var other = imgs[slot ? 0 : 1];
try {


target.css('background-image', 'url("' + encodeURI(url) + '")');
target.addClass('is-active');
other.removeClass('is-active');
} catch (e) {
warn('ambient: paint failed', e);
return;
}
slot = slot ? 0 : 1;
index = i;
try { node.find('.lumen-ambient__title').text(frame.title || ''); } catch (e2) { }
for (var d = 0; d < dots.length; d++) {
try { dots[d].toggleClass('is-on', d === i); } catch (e3) { }
}
paintClock();
watchFrame(url, i);
var next = nextGood(i, size);
preloadNext(next >= 0 && next !== i ? urlOf(reel[next], size) : '');
}

function tick() {
slide_timer = 0;
if (!live) return;



if (!hidden()) {
try {
var next = nextGood(index, sizeFor(screenWidth()));
if (next >= 0) show(next);
} catch (e) { warn('ambient: slide failed', e); }
}
slide_timer = setT(tick, SLIDE_MS);
}

function build() {
var q = jq();
if (!q) return false;
var root = q(
'<div class="lumen-ambient">' +
'<div class="lumen-ambient__img"></div>' +
'<div class="lumen-ambient__img"></div>' +
'<div class="lumen-ambient__scrim"></div>' +
'<div class="lumen-ambient__info">' +
'<div class="lumen-ambient__title"></div>' +
'<div class="lumen-ambient__dots"></div>' +
'</div>' +
'<div class="lumen-ambient__clock"></div>' +
'</div>'
);
var found = root.find('.lumen-ambient__img');
imgs = [found.eq(0), found.eq(1)];
dots = [];
var box = root.find('.lumen-ambient__dots');
for (var i = 0; i < reel.length; i++) {
var dot = q('<div class="lumen-ambient__dot"></div>');
box.append(dot);
dots.push(dot);
}
q('body').append(root);
node = root;
return true;
}


function gather(count) {
return {
enabled: enabledNow(),
motion: motion(),
hidden: hidden(),
modal: modalOpen(),
player: playerOpen(),
trailer: trailerLive(),
native: nativeSaver(),
controller: controllerName(),
frames: count
};
}

function start() {
idle_timer = 0;
var list = [];
try { list = frames(); } catch (e) { warn('ambient: frames failed', e); }
if (!canStart(gather(list.length))) { schedule(); return; }
reel = playlist(list, REEL, Math.random);
if (!reel.length) { schedule(); return; }
bad = {};
index = -1;
slot = 0;
if (!build()) { schedule(); return; }
live = true;
markCovered(true);
try { show(0); } catch (e2) { warn('ambient: start failed', e2); }
slide_timer = setT(tick, SLIDE_MS);
}



function schedule() {
clearT(idle_timer);
idle_timer = 0;
if (!installed || live) return;
idle_timer = setT(start, delayMs());
}



function drop() {
clearT(slide_timer);
slide_timer = 0;
clearT(out_timer);
out_timer = 0;
killPreload();
killWatch();
live = false;
markCovered(false);
if (node) {
try { node.remove(); } catch (e) { warn('ambient: remove failed', e); }
}
node = null;
imgs = [];
dots = [];
reel = [];
index = -1;
slot = 0;
}




function hide() {
if (!node) { schedule(); return; }
clearT(slide_timer);
slide_timer = 0;
killPreload();
killWatch();
live = false;



markCovered(false);
var leaving = node;
try { leaving.addClass('is-out'); } catch (e) { }
clearT(out_timer);
out_timer = setT(function () {
out_timer = 0;
try { leaving.remove(); } catch (e2) { warn('ambient: remove failed', e2); }
if (node === leaving) {
node = null;
imgs = [];
dots = [];
reel = [];
index = -1;
slot = 0;
}
}, FADE_MS);
schedule();
}




function wake(event, swallow) {
if (!live) {
var t = Date.now();
if (t - last_poke < POKE_MS && idle_timer) return;
last_poke = t;
schedule();
return;
}
if (swallow && event) {
try { if (typeof event.preventDefault === 'function') event.preventDefault(); } catch (e) { }
try { if (typeof event.stopPropagation === 'function') event.stopPropagation(); } catch (e2) { }
}
hide();
}





function install() {
if (installed) { schedule(); return; }
var d = doc();
if (!d || typeof d.addEventListener !== 'function') return;
bound = {
keydown: function (event) { wake(event, true); },
mousemove: function (event) { wake(event, false); },
touchstart: function (event) { wake(event, false); }
};
try {
d.addEventListener('keydown', bound.keydown, true);
d.addEventListener('mousemove', bound.mousemove, true);
d.addEventListener('touchstart', bound.touchstart, true);
} catch (e) {
warn('ambient: listeners failed', e);
bound = null;
return;
}
installed = true;
schedule();
}

function uninstall() {
var d = doc();
if (bound && d && typeof d.removeEventListener === 'function') {
try {
d.removeEventListener('keydown', bound.keydown, true);
d.removeEventListener('mousemove', bound.mousemove, true);
d.removeEventListener('touchstart', bound.touchstart, true);
} catch (e) {
warn('ambient: unlisten failed', e);
}
}
bound = null;
installed = false;
clearT(idle_timer);
idle_timer = 0;
drop();
}


function apply() {
try {
if (!enabledNow()) { uninstall(); return; }
if (!installed) { install(); return; }

schedule();
} catch (e) {
warn('ambient: apply failed', e);
}
}

var api = {
sizeFor: sizeFor,
nextIndex: nextIndex,
normalizeFrames: normalizeFrames,
playlist: playlist,
canStart: canStart,
clockText: clockText,
frames: frames,
delayMs: delayMs,
install: install,
uninstall: uninstall,
apply: apply,
stop: drop,
active: function () { return live; },
_delayMs: 0,
_timers: null
};
return api;
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.ambient;


/* ---- 55_trailer.js ---- */
















































LC.trailer = (function () {

var API_ID = 'lumen-yt-api';
var API_SRC = 'https://www.youtube.com/iframe_api';









var START_DELAY_MS = 3000;
var LOAD_MS = 20000;
var WAIT_MS = 12000;


var WATCH_MS = 1000;







function typeScore(name) {
var s = ('' + (name || '')).toLowerCase();
if (s.indexOf('трейлер') !== -1 || s.indexOf('trailer') !== -1) return 40;
if (s.indexOf('тизер') !== -1 || s.indexOf('teaser') !== -1) return 20;
return 5;
}

function langScore(code) {
var c = ('' + (code || '')).toLowerCase();
if (c === 'ru') return 30;
if (c === 'en') return 10;
return 0;
}

function score(video) {
return typeScore(video.name) + langScore(video.iso_639_1) + (video.official ? 5 : 0);
}



function pickTrailer(list) {
if (!list || typeof list.length !== 'number') return null;
var best = null;
var bestScore = -1;
for (var i = 0; i < list.length; i++) {
var video = list[i];
if (!video || !video.key) continue;
var current = score(video);
if (current > bestScore) {
bestScore = current;
best = video;
}
}
return best;
}





function modeFor(stored, platform) {
if (stored !== 'on' && stored !== 'off') stored = 'auto';
if (stored !== 'auto') return stored;
platform = platform || {};
if (platform.tizen || platform.webos) return 'off';
return 'on';
}




function mode() {
var stored = 'auto';
try {
stored = LC.pref('lumen_trailer', 'auto');
} catch (e) { }
var platform = { tizen: false, webos: false };
try {
if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.is === 'function') {
platform.tizen = !!Lampa.Platform.is('tizen');
platform.webos = !!Lampa.Platform.is('webos');
}
} catch (e2) { }
return modeFor(stored, platform);
}














var pending = [];
var hooked = false;

function hook() {
if (hooked) return;
hooked = true;
var prev = window.onYouTubeIframeAPIReady;
window.onYouTubeIframeAPIReady = function () {
if (prev) { try { prev(); } catch (e) { } }
var list = pending;
pending = [];
for (var i = 0; i < list.length; i++) {
try { list[i](); } catch (e2) { }
}
};
}



var seq = 0;
























var last = 'n/a';
var owner = 0;

function note(st, ticket) {
if (ticket !== undefined && ticket !== owner) return 0;
last = st;
if (st !== 'plan') return 0;
owner = ++seq;
return owner;
}

function status() {
return last;
}






function player($host, key, onStart, onEnd) {
var mine = ++seq;
var id = 'lumen-yt-' + mine;
var yt = null;
var dead = false;
var timeout = null;




var started = false;

owner = mine;
mark('api');

$host.html('<div id="' + id + '"></div>');

function mark(st) {
if (owner === mine) last = st;
}


function kill(reason) {
if (dead) return;
dead = true;
mark(typeof reason === 'string' ? reason : 'stop');



for (var p = 0; p < pending.length; p++) {
if (pending[p] === create) { pending.splice(p, 1); break; }
}
if (timeout) { clearTimeout(timeout); timeout = null; }
try { if (yt && yt.destroy) yt.destroy(); } catch (e) { }
yt = null;
try { $host.empty().removeClass('is-live'); } catch (e2) { }
onEnd();
}

function create() {
if (dead) return;
try {
yt = new window.YT.Player(id, {
videoId: key,
width: '100%',
height: '100%',


host: 'https://www.youtube-nocookie.com',



playerVars: {
autoplay: 1, mute: 1, controls: 0, rel: 0, modestbranding: 1,
playsinline: 1, start: 4, iv_load_policy: 3, disablekb: 1, fs: 0
},
events: {






onReady: function (ev) {
if (dead) return;


if (!started) {
if (timeout) clearTimeout(timeout);
timeout = setTimeout(function () { kill('timeout ready'); }, WAIT_MS);
mark('ready');
}
try { ev.target.mute(); ev.target.playVideo(); } catch (e) { }
},
onStateChange: function (ev) {
if (dead || !ev) return;
if (ev.data === 1) {
started = true;
if (timeout) { clearTimeout(timeout); timeout = null; }
try { $host.addClass('is-live'); } catch (e) { }
mark('play');
onStart();
}
if (ev.data === 0) kill('end');
},
onError: function (ev) {
var code = ev && ev.data != null ? ev.data : '?';
kill('err ' + code);
}
}
});
} catch (e) {
kill('err ctor');
}
}

timeout = setTimeout(function () { kill('timeout api'); }, LOAD_MS);

if (window.YT && window.YT.Player) create();
else {


pending.push(create);
hook();
if (!document.getElementById(API_ID)) {
var script = document.createElement('script');
script.id = API_ID;
script.src = API_SRC;
(document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(script);
}
}

return { destroy: function () { kill(); } };
}









function ensureHost(layer) {
var host = layer.children('.lumen-bg__trailer');
if (!host.length) {
host = $('<div class="lumen-bg__trailer"></div>');
layer.append(host);
}
return host;
}








function isLive(layer) {
try {
return !!(layer && layer.length && typeof layer.hasClass === 'function' && layer.hasClass('lumen-trailer-live'));
} catch (e) {
return false;
}
}








function slideshowOf(layer) {
try { return layer.data('lumenSlideshow'); } catch (e) { return null; }
}

function pauseSlideshow(layer) {
try { var s = slideshowOf(layer); if (s) s.pause(); } catch (e) { }
}

function resumeSlideshow(layer) {
try { var s = slideshowOf(layer); if (s) s.resume(); } catch (e) { }
}

















function recollect(root, target) {
try {
if (!LC.util.onScreen(root)) return;
if (!window.Lampa || !Lampa.Controller) return;
if (typeof Lampa.Controller.collectionSet !== 'function') return;
var enabled = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
if (!enabled || enabled.name !== 'full_start') return;


var focused = (target && target.length) ? target : root.find('.focus');
Lampa.Controller.collectionSet(root);
if (typeof Lampa.Controller.collectionFocus === 'function') {
Lampa.Controller.collectionFocus(focused && focused.length ? focused : false, root);
}
} catch (e) {
warn('trailer collection failed', e);
}
}

function addStop(root) {
try {
if (root.find('.lumen-stop').length) return;
var row = root.find('.full-start-new__buttons');
if (!row.length) return;
var btn = $('<div class="lumen-stop selector">' +
'<div class="lumen-stop__ico"></div>' +
'<span>' + LC.util.esc(LC.lang('lumen_card_stop')) + '</span>' +
'</div>');


row.parent().append(btn);
recollect(root);
} catch (e) {
warn('trailer stop button failed', e);
}
}



function addBadge(root) {
try {
if (root.find('.lumen-trailer-badge').length) return;
root.append($('<div class="lumen-trailer-badge">' + LC.util.esc(LC.lang('lumen_card_trailer_badge')) + '</div>'));
} catch (e) {
warn('trailer badge failed', e);
}
}

function removeBadge(root) {
try {
var badge = root.find('.lumen-trailer-badge');
if (badge.length) badge.remove();
} catch (e) {
warn('trailer badge cleanup failed', e);
}
}

function removeStop(root) {
try {
var btn = root.find('.lumen-stop');
if (!btn.length) return;
var focused = btn.hasClass('focus');
btn.remove();



var play = focused ? root.find('.full-start-new__buttons').find('.full-start__button').not('.hide').eq(0) : null;
recollect(root, play);
} catch (e) {
warn('trailer stop button cleanup failed', e);
}
}

























function reveal(root, data) {
try {
if (!root || !root.length) return false;
var videos = data && data.videos && data.videos.results;



var node = root.find('.view--trailer');
var has = !!(node && node.length) && !!pickTrailer(videos);
root.toggleClass('lumen-card--trailer', has);
return has;
} catch (e) {
warn('trailer button failed', e);
return false;
}
}




function schedule(root, body, data) {
try {
if (!root || !root.length || !body || !body.length) return null;
if (mode() === 'off') return null;


try { if (LC.motionMode() === 'off') return null; } catch (e) { }

var videos = data && data.videos && data.videos.results;
var video = pickTrailer(videos);
if (!video) { note('none'); return null; }

var layer = body.children('.lumen-backdrop');
if (!layer || !layer.length) return null;
var ticket = note('plan');

var alive = true;
var control = null;
var timer = null;



var paused = false;
var watchdog = null;

function stopWatchdog() {
if (watchdog) { clearInterval(watchdog); watchdog = null; }
}










function startWatchdog() {
if (watchdog) return;
watchdog = setInterval(function () {
try {
if (!LC.slideshow.isMounted(layer[0]) || !LC.util.onScreen(layer)) destroy();
} catch (e) { }
}, WATCH_MS);
}

function cleanup() {
stopWatchdog();
try { root.removeClass('lumen-trailer-on'); } catch (e) { }
try { layer.removeClass('lumen-trailer-live'); } catch (e2) { }
removeBadge(root);
removeStop(root);
if (paused) {
paused = false;
resumeSlideshow(layer);
}
}

function begin() {
timer = null;
if (!alive) return;


if (!LC.slideshow.isMounted(layer[0]) || !LC.util.onScreen(layer)) {
alive = false;
note('stop', ticket);
return;
}

control = player(ensureHost(layer), video.key, function () {
if (!alive) return;


paused = true;
pauseSlideshow(layer);
startWatchdog();
try { root.addClass('lumen-trailer-on'); } catch (e) { }
try { layer.addClass('lumen-trailer-live'); } catch (e2) { }
addBadge(root);
addStop(root);
}, function () {
control = null;
if (!alive) return;
alive = false;
cleanup();
});
}

function destroy() {
if (timer) { clearTimeout(timer); timer = null; }


try { if (layer.data('lumenTrailer') === api) layer.removeData('lumenTrailer'); } catch (e) { }
if (!alive) return;
if (control) {


var current = control;
control = null;
current.destroy();
alive = false;
return;
}
alive = false;

note('stop', ticket);
cleanup();
}

timer = setTimeout(begin, START_DELAY_MS);

var api = { destroy: destroy, isAlive: function () { return alive; } };



layer.data('lumenTrailer', api);
return api;
} catch (e) {
warn('trailer schedule failed', e);
return null;
}
}



function stopActive() {
try {
if (LC.active && LC.active.trailer) {
LC.active.trailer.destroy();
LC.active.trailer = null;
}
} catch (e) {
warn('trailer stop failed', e);
}
}














function bind(root) {
try {
var el = root && root[0];
if (!el || typeof el.addEventListener !== 'function' || el.lumenTrailerBound) return;
el.lumenTrailerBound = true;
el.addEventListener('hover:enter', function () {
try { stopActive(); } catch (err) { warn('trailer enter failed', err); }
}, true);
} catch (e) {
warn('trailer bind failed', e);
}
}

return {
pickTrailer: pickTrailer,
modeFor: modeFor,
mode: mode,
player: player,
reveal: reveal,
schedule: schedule,
stopActive: stopActive,
isLive: isLive,
bind: bind,

status: status,
note: note
};
})();



if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.trailer;


/* ---- 56_roulette.js ---- */






































































LC.roulette = (function () {




var MAX_SOURCES = 5;


var PAGES = 2;



var POOL_TIMEOUT = 8000;


var PICK_TRIES = 5;


var REEL_SIZE = 10;


var CHIP_LIMIT = 14;













var PREVIEW_DELAY = 700;



var STACK_SIZE = 3;








var REEL_VH = 28.67;





var ATV_REEL_VH = 36;
var ATV_TILE_VH = 15.75;




var SHELF_SIZE = 5;







function cardMedia(card) {
if (card && card.media_type) return card.media_type === 'tv' ? 'tv' : 'movie';
return (card && (card.name || card.first_air_date)) ? 'tv' : 'movie';
}

function normalizeMedia(value) {
return value === 'tv' ? 'tv' : 'movie';
}








function atvLook() {
try {
return !!(LC.pref && LC.pref('lumen_flat', false));
} catch (e) {
return false;
}
}




function shelfCards(list, n) {
if (!Array.isArray(list) || !(n > 0)) return [];
return list.slice(1, 1 + n);
}



function backdropOf(card) {
return (card && (card.backdrop_path || card.poster_path)) || '';
}




function buildPool(results, media, needPoster) {
var out = [];
if (!results || !results.length) return out;
var want = normalizeMedia(media);
var seen = {};
for (var i = 0; i < results.length; i++) {
var card = results[i];
if (!card || card.id == null) continue;
if (cardMedia(card) !== want) continue;
if (needPoster && !card.poster_path) continue;
if (seen[card.id]) continue;
seen[card.id] = 1;
out.push(card);
}
return out;
}


function shortLimit(media) {
return normalizeMedia(media) === 'tv' ? 30 : 90;
}





function applyFilters(pool, opts, ctx, media) {
var out = [];
if (!pool || !pool.length) return out;
opts = opts || {};
var limit = shortLimit(media);
for (var i = 0; i < pool.length; i++) {
var card = pool[i];
if (opts.unseen && ctx && typeof ctx.isSeen === 'function' && ctx.isSeen(card.id)) continue;
if (opts.short && ctx && typeof ctx.runtime === 'function') {
var minutes = ctx.runtime(card.id);
if (minutes != null && Number(minutes) > limit) continue;
}
out.push(card);
}
return out;
}




function fitsShort(details, media) {
if (!details) return true;
var limit = shortLimit(media);
if (normalizeMedia(media) === 'tv') {
var list = details.episode_run_time;
if (!list || !list.length) return true;
var min = Number(list[0]) || 0;
for (var i = 1; i < list.length; i++) {
var v = Number(list[i]) || 0;
if (v && (!min || v < min)) min = v;
}
if (!min) return true;
return min <= limit;
}
var runtime = Number(details.runtime) || 0;
if (!runtime) return true;
return runtime <= limit;
}


function pick(pool, rnd) {
if (!pool || !pool.length) return null;
var random = typeof rnd === 'function' ? rnd : Math.random;
var i = Math.floor(random() * pool.length);
if (i < 0) i = 0;
if (i >= pool.length) i = pool.length - 1;
return pool[i];
}







var LITE_DELAYS = [120, 140, 170, 210, 260, 330, 420, 550];

































function land(plan, n) {
if (!plan.length) return plan;
var shift = (n - 1 - plan[plan.length - 1].index % n + n) % n;
if (shift) {
for (var i = 0; i < plan.length; i++) plan[i].index = (plan[i].index + shift) % n;
}
return plan;
}

function spinPlan(total, mode) {
var plan = [];
var n = Number(total) || 0;
if (mode === 'off') return plan;
if (n <= 0) return plan;
if (n === 1) return [{ index: 0, delay: 0 }];

var index = 0;
var i;
if (mode === 'lite') {




var delays = n < LITE_DELAYS.length ? LITE_DELAYS.slice(LITE_DELAYS.length - n) : LITE_DELAYS;
for (i = 0; i < delays.length; i++) {
index = (index + 1) % n;
plan.push({ index: index, delay: delays[i] });
}
return land(plan, n);
}

var FAST = 40;

var accel = [100, 90, 75, 60, 50, FAST];
for (i = 0; i < accel.length; i++) {
index = (index + 1) % n;
plan.push({ index: index, delay: accel[i] });
}

var spins = Math.round(1800 / FAST);
for (i = 0; i < spins; i++) {
index = (index + 1) % n;
plan.push({ index: index, delay: FAST });
}

var brake = [50, 60, 80, 100, 130, 170, 295];
for (i = 0; i < brake.length; i++) {
index = (index + 1) % n;
plan.push({ index: index, delay: brake[i] });
}


return land(plan, n);
}


function kpKeySet() {
try { return !!(typeof LC.pref === 'function' && LC.pref('lumen_kp_key', '')); } catch (e) { return false; }
}








function collectionsFor(manifest, media) {
var out = [];
if (!manifest || !Array.isArray(manifest.collections)) return out;
var want = normalizeMedia(media);
var kp = kpKeySet();
var home = {};
var homeList = manifest.home || [];
var i;
for (i = 0; i < homeList.length; i++) home[homeList[i]] = i + 1;
var first = [];
var rest = [];
for (i = 0; i < manifest.collections.length; i++) {
var c = manifest.collections[i];
if (!c || !c.sources || !c.sources[want]) continue;
if (!kp && c.sources[want].type === 'kp') continue;
if (home[c.id]) first.push(c);
else rest.push(c);
}
first.sort(function (a, b) { return home[a.id] - home[b.id]; });
return first.concat(rest);
}

function parseIds(text) {
var out = [];
if (!text) return out;
var parts = ('' + text).split(',');
for (var i = 0; i < parts.length; i++) {
var id = parts[i].replace(/^\s+|\s+$/g, '');
if (id) out.push(id);
}
return out;
}

function joinIds(ids) {
return (ids && ids.length) ? ids.join(',') : '';
}




function sourcesFor(list, ids, manifest) {
var out = [];
if (!list || !list.length) return out;
var picked = {};
var i;
for (i = 0; ids && i < ids.length; i++) picked[ids[i]] = 1;
for (i = 0; i < list.length && out.length < MAX_SOURCES; i++) {
if (picked[list[i].id]) out.push(list[i]);
}
if (out.length) return out;

var home = (manifest && manifest.home) || [];
var byId = {};
for (i = 0; i < list.length; i++) byId[list[i].id] = list[i];
for (i = 0; i < home.length && out.length < MAX_SOURCES; i++) {
if (byId[home[i]]) out.push(byId[home[i]]);
}
if (out.length) return out;


for (i = 0; i < list.length && out.length < MAX_SOURCES; i++) out.push(list[i]);
return out;
}

function storageKey(media) {
return 'lumen_roulette_' + normalizeMedia(media);
}





function knownIds(ids, list) {
var out = [];
var have = {};
var i;
for (i = 0; list && i < list.length; i++) if (list[i]) have[list[i].id] = 1;
for (i = 0; ids && i < ids.length; i++) if (have[ids[i]]) out.push(ids[i]);
return out;
}









function chipList(list, chosen, limit) {
var out = [];
if (!list || !list.length) return out;
var max = Number(limit) || CHIP_LIMIT;
var picked = {};
var i;
for (i = 0; chosen && i < chosen.length; i++) picked[chosen[i]] = 1;
var taken = {};
for (i = 0; i < list.length && out.length < max; i++) {
taken[list[i].id] = 1;
out.push(list[i]);
}


for (i = 0; i < list.length; i++) {
if (picked[list[i].id] && !taken[list[i].id]) out.push(list[i]);
}
return out;
}









function pinFirst(list, id) {
if (!list || !list.length || !id) return list || [];
var head = null;
var rest = [];
for (var i = 0; i < list.length; i++) {
if (!head && list[i] && list[i].id === id) head = list[i];
else rest.push(list[i]);
}
return head ? [head].concat(rest) : list;
}





function esc(text) {
return LC.util.esc('' + (text == null ? '' : text));
}

function unseenDefault() {
try {
if (typeof LC.pref === 'function') return !!LC.pref('lumen_roulette_unseen', true);
} catch (e) { }
return true;
}

function storedIds(media) {
try {
if (window.Lampa && Lampa.Storage) return parseIds(Lampa.Storage.get(storageKey(media), ''));
} catch (e) { }
return [];
}

function saveIds(media, ids) {
try {
if (window.Lampa && Lampa.Storage) Lampa.Storage.set(storageKey(media), joinIds(ids));
} catch (e) {
warn('roulette: save ids failed', e);
}
}

function lang() {
try {
if (typeof LC.langCode === 'function') return LC.langCode();
} catch (e) { }
return 'ru';
}

function titleOf(item) {
try {
if (LC.hub && typeof LC.hub.titleOf === 'function') return LC.hub.titleOf(item, lang());
} catch (e) { }
return (item && item.title) || (item && item.id) || '';
}

function imageUrl(path, size) {
try {
if (!path) return '';
var tmdb = null;
var img = null;
if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function') {
tmdb = function (url) { return Lampa.TMDB.image(url); };
}
if (window.Lampa && Lampa.Api && typeof Lampa.Api.img === 'function') {
img = function (p, s) { return Lampa.Api.img(p, s); };
}
return LC.cardinfo.imageUrl(path, size, tmdb, img);
} catch (e) {
return '';
}
}

function motionClass(node) {
try { node.addClass('lumen-motion-' + LC.motionMode()); } catch (e) { }
}

function navMove(dir) {
try {
if (window.Navigator && typeof Navigator.canmove === 'function' && Navigator.canmove(dir)) {
Navigator.move(dir);
return true;
}
} catch (e) {
warn('roulette: navigator failed', e);
}
return false;
}


function cardMeta(card) {
var parts = [];
var date = (card && (card.release_date || card.first_air_date)) || '';
if (date) parts.push(('' + date).slice(0, 4));
var vote = Number(card && card.vote_average) || 0;
if (vote > 0) parts.push(vote.toFixed(1));
return parts.join(' · ');
}

function cardTitle(card) {
return (card && (card.title || card.name)) || '';
}



function cardOverview(card) {
return (card && card.overview) ? ('' + card.overview) : '';
}



function logoAllowed() {
try {
return LC.pref ? LC.pref('lumen_hero_logo', true) !== false : true;
} catch (e) {
return true;
}
}








function textless(json, path) {
var list = json && json.images && json.images.backdrops;
if (!path || !Array.isArray(list)) return false;
for (var i = 0; i < list.length; i++) {
if (list[i] && list[i].file_path === path) return !list[i].iso_639_1;
}
return false;
}






function logoOf(card, done) {
if (!card || !logoAllowed() || !LC.prefetch || typeof LC.prefetch.details !== 'function' ||
!LC.hero || typeof LC.hero.pickLogoItem !== 'function') {
done(null);
return;
}
var once = false;
function finish(item, json) {
if (once) return;
once = true;
done(item, json || null);
}
try {
LC.prefetch.details(card, function (json) {
var item = null;
try { item = LC.hero.pickLogoItem(json && json.images && json.images.logos, lang()); } catch (e) { item = null; }
finish(item && item.file_path ? item : null, json);
}, function () { finish(null, null); });
} catch (e2) {
finish(null, null);
}
}





function RouletteComponent(object) {
var self = this;
var media = normalizeMedia(object && object.media);
var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250 });







var chipsScroll = new Lampa.Scroll({ horizontal: true, over: true, nopadding: true, step: 250 });




var screen = $('<div class="lumen-roulette-screen"></div>');
var root = $('<div class="lumen-roulette"></div>');
var bg = $('<div class="lumen-roulette__bg"></div>');
var veilL = $('<div class="lumen-roulette__veil lumen-roulette__veil--l"></div>');
var veilB = $('<div class="lumen-roulette__veil lumen-roulette__veil--b"></div>');
var head = $('<div class="lumen-roulette__head"></div>');
var chipsBox = $('<div class="lumen-roulette__chipbox"></div>');
var chipsRow = $('<div class="lumen-roulette__chips"></div>');
var filtersRow = $('<div class="lumen-roulette__filters"></div>');
var stage = $('<div class="lumen-roulette__stage"></div>');
var reelBox = $('<div class="lumen-roulette__reel"><div class="lumen-roulette__frame"></div></div>');




var peek1 = $('<div class="lumen-roulette__peek lumen-roulette__peek--1"></div>');
var peek2 = $('<div class="lumen-roulette__peek lumen-roulette__peek--2"></div>');
var countBox = $('<div class="lumen-roulette__count">' +
'<div class="lumen-roulette__count-value"></div>' +
'<div class="lumen-roulette__count-label"></div>' +
'</div>');
var spinBtn = $('<div class="lumen-roulette__spin selector">' + esc(LC.lang('lumen_roulette_spin')) + '</div>');
var resultBox = $('<div class="lumen-roulette__result"></div>');


var atv = atvLook();




var calmBg = '';
var lead = $('<div class="lumen-roulette__lead">' +
'<div class="lumen-roulette__kicker"><div class="lumen-roulette__kicker-n"></div><div class="lumen-roulette__kicker-l"></div></div>' +
'<div class="lumen-roulette__ltitle"></div>' +
'<div class="lumen-roulette__lmeta"></div>' +
'<div class="lumen-roulette__ldescr"></div>' +
'</div>');
var shelf = $('<div class="lumen-roulette__shelf">' +
'<div class="lumen-roulette__shelf-title"></div>' +
'<div class="lumen-roulette__shelf-row"></div>' +
'</div>');

var gen = 0;
var handles = [];
var spinTimer = 0;
var previewTimer = 0;
var manifest = null;
var collections = [];
var chosen = storedIds(media);
var pool = [];
var poolKey = '';

var poolWait = null;
var seen = {};
var runtimes = {};
var reel = [];
var spinning = false;
var result = null;
var resultLoader = null;




var resultBgShown = false;






var frame = null;


var kadr = false;
var lastFocus = null;
var started = false;





var destroyed = false;
var paused = false;


var shelfNodes = [];
var shelfList = [];
var manifestWait = false;
var filters = { unseen: unseenDefault(), short: false };


if (object && object.preselect) chosen = [object.preselect];



var pinned = (object && object.preselect) ? '' + object.preselect : '';

function alive(captured) {
return function () { return gen === captured; };
}

function clearHandles() {
for (var i = 0; i < handles.length; i++) {
try { if (handles[i] && handles[i].clear) handles[i].clear(); } catch (e) { }
}
handles = [];
}

function stopSpin() {
if (spinTimer) {
clearTimeout(spinTimer);
spinTimer = 0;
}
spinning = false;
try { spinBtn.removeClass('is-busy'); } catch (e) { }
}








function cancelResultLoader() {
if (resultLoader) {
resultLoader.onload = null;
resultLoader.onerror = null;
resultLoader = null;
}
}



function bump() {
gen++;


poolWait = null;
clearHandles();
stopSpin();
cancelResultLoader();


clearPreviewTimer();
}









function scope() {
return (kadr ? resultBox[0] : root[0]) || null;
}

function focusTarget() {
var box = scope();
if (lastFocus && box && box.contains && box.contains(lastFocus)) return lastFocus;
if (kadr) return resultBox.find('.lumen-roulette__btn')[0] || null;
return spinBtn[0] || null;
}





var quiet = false;

function recollect(prefer, still) {
try {
var box = scope();
Lampa.Controller.collectionSet(box);
quiet = !!still;
Lampa.Controller.collectionFocus(prefer || focusTarget() || false, box);
} catch (e) {
warn('roulette: collection failed', e);
}
quiet = false;
}











function keepVisible(el) {
try { scroll.update(el, true); } catch (e) { warn('roulette: scroll.update failed', e); }
}









function watchFocus(node) {
return LC.focus.on(node, function (e) {
if (LC.focus.remote(e) && !quiet) keepVisible(node[0]);
lastFocus = node[0];
});
}









function railChip(node) {
return LC.focus.on(node, function (e) {
if (!LC.focus.remote(e) || quiet) return;
try { chipsScroll.update(node[0], true); } catch (eS) { warn('roulette: chips scroll failed', eS); }
});
}





function buildHead() {
head.empty();
head.append($('<div class="lumen-roulette__title">' + esc(LC.lang('lumen_roulette_title')) + '</div>'));
var tabs = $('<div class="lumen-roulette__media"></div>');
var pairs = [['movie', 'lumen_roulette_movies'], ['tv', 'lumen_roulette_series']];
for (var i = 0; i < pairs.length; i++) {
(function (value, key) {
var tab = watchFocus($('<div class="lumen-roulette__tab selector">' + esc(LC.lang(key)) + '</div>'));
if (media === value) tab.addClass('is-on');
tab.on('hover:enter', function () { setMedia(value, tab[0]); });
tabs.append(tab);
})(pairs[i][0], pairs[i][1]);
}
head.append(tabs);





head.append(filtersRow);
}




function setMedia(value, focusNode) {
if (media === value) return;
bump();









try { self.activity.loader(false); } catch (e) { }
media = value;
chosen = storedIds(media);
pinned = '';
filters.short = false;
pool = [];
poolKey = '';
result = null;
head.find('.lumen-roulette__tab').removeClass('is-on');
head.find('.lumen-roulette__tab').each(function (index, node) {
if ((index === 0 && value === 'movie') || (index === 1 && value === 'tv')) $(node).addClass('is-on');
});
buildChips();
buildFilters();
clearResult();
clearPreview();
schedulePreview();
recollect(focusNode || null);
}

function chipNode(text, on) {
var node = watchFocus($('<div class="lumen-chip lumen-roulette__chip selector">' + esc(text) + '</div>'));
if (on) node.addClass('lumen-chip--on');
return node;
}

function buildChips() {
chipsRow.empty();





try { chipsScroll.reset(); } catch (eR) { warn('roulette: chips reset failed', eR); }
collections = collectionsFor(manifest, media);


chosen = knownIds(chosen, collections);
var all = chipNode(LC.lang('lumen_roulette_all'), !chosen.length);
all.on('hover:enter', function () {
if (!chosen.length) return;
chosen = [];
saveIds(media, chosen);
poolKey = '';
buildChips();
schedulePreview();
recollect(chipsRow.find('.lumen-roulette__chip')[0]);
});
chipsRow.append(railChip(all));
var shown = pinFirst(chipList(collections, chosen, CHIP_LIMIT), pinned);
for (var i = 0; i < shown.length; i++) {
(function (item) {
var node = railChip(chipNode(titleOf(item), chosen.indexOf(item.id) >= 0));
node.on('hover:enter', function () {
var at = chosen.indexOf(item.id);
if (at >= 0) chosen.splice(at, 1);
else chosen.push(item.id);
saveIds(media, chosen);
poolKey = '';
node.toggleClass('lumen-chip--on', at < 0);
chipsRow.find('.lumen-roulette__chip').eq(0).toggleClass('lumen-chip--on', !chosen.length);
schedulePreview();
});
chipsRow.append(node);
})(shown[i]);
}
}

function buildFilters() {
filtersRow.empty();
var unseen = chipNode(LC.lang('lumen_roulette_unseen'), filters.unseen);
unseen.on('hover:enter', function () {
filters.unseen = !filters.unseen;
unseen.toggleClass('lumen-chip--on', filters.unseen);
schedulePreview();
});
filtersRow.append(unseen);
var shortKey = media === 'tv' ? 'lumen_roulette_short_tv' : 'lumen_roulette_short_movie';
var short = chipNode(LC.lang(shortKey), filters.short);
short.on('hover:enter', function () {
filters.short = !filters.short;
short.toggleClass('lumen-chip--on', filters.short);
schedulePreview();
});
filtersRow.append(short);
}







function keyOf() {
return media + '|' + joinIds(chosen);
}

function seenIndex(cards) {
var map = {};
try {
if (LC.rows && typeof LC.rows.viewedIds === 'function') {
var ids = LC.rows.viewedIds(cards);
for (var i = 0; i < ids.length; i++) map[ids[i]] = 1;
}
} catch (e) {
warn('roulette: viewed failed', e);
}
return map;
}

function context() {
return {
isSeen: function (id) { return !!seen[id]; },
runtime: function (id) {
var value = runtimes[media + ':' + id];
return value == null ? null : value;
}
};
}

function filtered() {
return applyFilters(pool, filters, context(), media);
}



















function loadPool(done) {
var key = keyOf();
if (pool.length && poolKey === key) { done(); return; }
if (poolWait && poolWait.key === key && poolWait.gen === gen) {
poolWait.done.push(done);
return;
}
var list = sourcesFor(collectionsFor(manifest, media), chosen, manifest);
if (!list.length) { pool = []; poolKey = key; done(); return; }

var captured = gen;
var cards = [];
var wait = { key: key, gen: captured, done: [done] };
poolWait = wait;
var gate = LC.util.gate(list.length * PAGES, POOL_TIMEOUT, function () {
if (poolWait === wait) poolWait = null;
if (gen !== captured) return;
pool = buildPool(cards, media, true);
poolKey = key;
seen = seenIndex(cards);
for (var w = 0; w < wait.done.length; w++) wait.done[w]();
});

LC.util.each(list, function (item) {
for (var page = 1; page <= PAGES; page++) {
var handle = LC.sources['fetch'](item, page, function (json) {
var results = (json && json.results) || [];
for (var i = 0; i < results.length; i++) cards.push(results[i]);
gate.tick();
}, function () {
gate.tick();
}, alive(captured));
if (handle) handles.push(handle);
}
});
}





function clearPreviewTimer() {
if (previewTimer) {
clearTimeout(previewTimer);
previewTimer = 0;
}
}


function clearPreview() {
clearPreviewTimer();
try {
stage.removeClass('is-stack');
peek1.addClass('is-off');
peek2.addClass('is-off');
} catch (e) {
warn('roulette: preview clear failed', e);
}
}



function paintPeek(node, card) {
var url = card ? imageUrl(card.poster_path, LC.util.posterSize(LC.util.vhPx(REEL_VH))) : '';
if (!url) {
node.addClass('is-off');
return;
}
node.css('background-image', 'url("' + url + '")');
node.removeClass('is-off');
}








function paintLead(list) {
var head0 = list[0] || null;
lead.find('.lumen-roulette__kicker-n').text(String(list.length));
lead.find('.lumen-roulette__kicker-l').text(LC.lang('lumen_roulette_pick'));
lead.find('.lumen-roulette__ltitle').text(head0 ? cardTitle(head0) : LC.lang('lumen_roulette_empty'));
lead.find('.lumen-roulette__lmeta').text(head0 ? cardMeta(head0) : '');
lead.find('.lumen-roulette__ldescr').text(head0 ? cardOverview(head0) : '');



var soft = head0 ? imageUrl(backdropOf(head0), 'w300') : '';
calmBg = soft ? 'url("' + soft + '")' : '';
if (!kadr) {
try { bg.css('background-image', calmBg); } catch (e) { }
}
}



function shelfTile(card, size) {
var node = watchFocus($('<div class="lumen-roulette__tile selector">' +
'<div class="lumen-roulette__tile-img"><div class="lumen-roulette__tile-logo"></div></div>' +
'<div class="lumen-roulette__tile-name"></div>' +
'</div>'));
var url = imageUrl(backdropOf(card), size);
if (url) node.find('.lumen-roulette__tile-img').css('background-image', 'url("' + url + '")');
node.find('.lumen-roulette__tile-name').text(cardTitle(card));
node.on('hover:enter', function () { openCard(card); });
return node;
}










function shelfLogos(nodes, cards, captured, at) {
if (at >= cards.length || gen !== captured) return;
if (nodes[at] && nodes[at].hasClass('has-logo')) { shelfLogos(nodes, cards, captured, at + 1); return; }
logoOf(cards[at], function (item, json) {
if (gen !== captured || !nodes[at]) return;

try { if (typeof nodes[at].closest === 'function' && !nodes[at].closest('body').length) return; } catch (eC) { return; }
var next = function () { shelfLogos(nodes, cards, captured, at + 1); };

var path = item && textless(json, backdropOf(cards[at])) ? item.file_path : '';
var url = path && LC.hero && typeof LC.hero.logoUrl === 'function' ? LC.hero.logoUrl(path) : '';
if (!url || typeof LC.hero.preloadLogo !== 'function') { next(); return; }
LC.hero.preloadLogo(path, url, function (ok) {
if (gen === captured && ok) {
var holder = nodes[at].find('.lumen-roulette__tile-logo');
holder.css('background-image', 'url("' + encodeURI(url) + '")');
holder.toggleClass('lumen-logo-white', typeof LC.hero.logoTone === 'function' && LC.hero.logoTone(path) === 'dark');
nodes[at].addClass('has-logo');



var meta = cardMeta(cards[at]);
if (meta) nodes[at].find('.lumen-roulette__tile-name').text(meta);
}
next();
});
});
}

function paintShelf(list) {
var row = shelf.find('.lumen-roulette__shelf-row');
var had = !!(lastFocus && row[0] && row[0].contains && row[0].contains(lastFocus));
row.empty();
var cards = shelfCards(list, SHELF_SIZE);
shelf.find('.lumen-roulette__shelf-title').text(LC.lang('lumen_roulette_more'));
shelf.toggleClass('is-empty', !cards.length);



var size = LC.util.vhPx(ATV_TILE_VH * 16 / 9) * 0.85 > 300 ? 'w780' : 'w300';
var nodes = [];
for (var i = 0; i < cards.length; i++) {
var node = shelfTile(cards[i], size);
nodes.push(node);
row.append(node);
}




if (had) lastFocus = null;
refreshCollection();
shelfNodes = nodes;
shelfList = cards;
shelfLogos(nodes, cards, gen, 0);
}





function focusIn(box) {
try {
var node = root.find('.selector.focus')[0];
return !!(node && box && box[0] && box[0].contains(node));
} catch (e) {
return false;
}
}

function refreshCollection() {
if (kadr) return;



if (ownsRemote()) recollect(null, true);
}







function ownsRemote() {
if (!started) return false;
try {
var act = Lampa.Activity.active();
if (act && act.activity && act.activity !== self.activity) return false;
} catch (eAct) { }
try {
var ctl = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
if (ctl && ctl.name !== 'content') return false;
} catch (eCtl) { }
return true;
}



function recollectOwn(prefer) {
if (ownsRemote()) { recollect(prefer); return; }
if (prefer) lastFocus = prefer;
}

function paintPreview() {
var list = filtered();
if (atv) {
try {
var head1 = list[0] || null;
var big = head1 ? imageUrl(backdropOf(head1), LC.util.scrimSize(LC.util.vhPx(ATV_REEL_VH * 16 / 9))) : '';
reelBox.find('.lumen-roulette__frame').css('background-image', big ? 'url("' + big + '")' : 'none');
paintLead(list);
paintShelf(list);
stage.addClass('is-stack');
} catch (eA) {
warn('roulette: atv preview failed', eA);
}
return;
}
try {
countBox.find('.lumen-roulette__count-value').text(String(list.length));
countBox.find('.lumen-roulette__count-label').text(LC.lang('lumen_roulette_pick'));
var head0 = list[0] || null;
var url = head0 ? imageUrl(head0.poster_path, LC.util.posterSize(LC.util.vhPx(REEL_VH))) : '';
var frameNode = reelBox.find('.lumen-roulette__frame');
if (url) frameNode.css('background-image', 'url("' + url + '")');
else frameNode.css('background-image', 'none');
paintPeek(peek1, list[1] || null);
paintPeek(peek2, list[2] || null);
stage.addClass('is-stack');
} catch (e) {
warn('roulette: preview paint failed', e);
}
}







function schedulePreview() {
clearPreviewTimer();
if (spinning || kadr) return;
var captured = gen;
previewTimer = setTimeout(function () {
previewTimer = 0;
if (gen !== captured || spinning || kadr) return;
loadPool(function () {
if (gen !== captured || spinning || kadr) return;
paintPreview();
});
}, PREVIEW_DELAY);
}





function paintFrame(card) {










var url = atv ? imageUrl(backdropOf(card), 'w300') : imageUrl(card && card.poster_path, LC.util.posterSize(LC.util.vhPx(REEL_VH)));
var frameNode = reelBox.find('.lumen-roulette__frame');
if (url) frameNode.css('background-image', 'url("' + url + '")');
frameNode.addClass('is-step');


reelBox.addClass('is-live');
}







function frameUrl(card) {
return imageUrl(card && card.backdrop_path, LC.util.scrimSize(LC.util.screenPx()));
}






function resultShown() {
return resultBox.hasClass('is-live');
}















function showKadr(url) {
try { bg.css('background-image', 'url("' + url + '")'); } catch (e) { }
resultBgShown = true;
if (resultShown()) enterKadr();
}

function enterKadr() {
if (kadr) return;
kadr = true;



try { scroll.reset(); } catch (e) { }
screen.addClass('is-kadr');













recollectOwn(null);
}

function leaveKadr() {
kadr = false;
screen.removeClass('is-kadr');




try { if (LC.transition && LC.transition.stop) LC.transition.stop(); } catch (e) { }
}

























function prepareFrame(card) {
cancelResultLoader();
frame = { card: card, url: frameUrl(card), ready: false };
if (!frame.url) return;
var live = frame;
var captured = gen;
var img = new Image();


img.decoding = 'async';
var done = false;
function finish(ok) {
if (done) return;
done = true;
img.onload = null;
img.onerror = null;
if (resultLoader === img) resultLoader = null;
if (!ok || gen !== captured || frame !== live) return;
live.ready = true;



if (result === live.card) showKadr(live.url);
}
img.onload = function () { finish(true); };
img.onerror = function () { finish(false); };
resultLoader = img;
img.src = frame.url;
}

function clearResult() {









cancelResultLoader();
frame = null;
result = null;
resultBgShown = false;
resultBox.empty();
resultBox.removeClass('is-live');
leaveKadr();




try { bg.css('background-image', atv ? calmBg : ''); } catch (e) { }



schedulePreview();
}




function showEmpty() {
resultBox.empty();
resultBox.addClass('is-live');
resultBox.append($('<div class="lumen-roulette__empty">' + esc(LC.lang('lumen_roulette_empty')) + '</div>'));
recollectOwn(spinBtn[0]);
}

function actionNode(key, handler) {
var node = watchFocus($('<div class="lumen-roulette__btn selector">' + esc(LC.lang(key)) + '</div>'));
node.on('hover:enter', handler);
return node;
}






function reelRect() {
try {
var node = reelBox[0];
if (!node || typeof node.getBoundingClientRect !== 'function') return null;
var r = node.getBoundingClientRect();
if (!r || !(r.width > 0) || !(r.height > 0)) return null;
return { left: r.left, top: r.top, width: r.width, height: r.height };
} catch (e) {
return null;
}
}

















var LOGO_GUARD = 1500;

function paintResultLogo(card, holder) {
var settled = false;
function settle(url, white) {
if (settled) return;
settled = true;
if (result !== card || !resultBox[0].contains(holder[0])) return;
if (url) {
holder.css('background-image', 'url("' + encodeURI(url) + '")');
holder.toggleClass('lumen-logo-white', !!white);
resultBox.addClass('has-logo');
}
resultBox.removeClass('is-logo-wait');
}
resultBox.addClass('is-logo-wait');
setTimeout(function () { settle('', false); }, LOGO_GUARD);
logoOf(card, function (item) {
var path = item ? item.file_path : '';
var url = path && typeof LC.hero.logoUrl === 'function' ? LC.hero.logoUrl(path) : '';
if (!url || typeof LC.hero.waitLogo !== 'function') { settle('', false); return; }
LC.hero.waitLogo(path, url, function (show) {
settle(show ? url : '', show && typeof LC.hero.logoTone === 'function' && LC.hero.logoTone(path) === 'dark');
});
});
}




function warmLogo(card) {
logoOf(card, function (item) {
var path = item ? item.file_path : '';
var url = path && LC.hero && typeof LC.hero.logoUrl === 'function' ? LC.hero.logoUrl(path) : '';
if (url && typeof LC.hero.preloadLogo === 'function') LC.hero.preloadLogo(path, url, function () { });
});
}

function paintResult(card) {
resultBox.empty();
resultBox.addClass('is-live');
resultBox.removeClass('has-logo is-logo-wait');
if (atv) {
var logo = $('<div class="lumen-roulette__rlogo"></div>');
resultBox.append(logo);
paintResultLogo(card, logo);
}
resultBox.append($('<div class="lumen-roulette__rtitle">' + esc(cardTitle(card)) + '</div>'));
resultBox.append($('<div class="lumen-roulette__rmeta">' + esc(cardMeta(card)) + '</div>'));
if (atv && cardOverview(card)) resultBox.append($('<div class="lumen-roulette__rdescr">' + esc(cardOverview(card)) + '</div>'));
var actions = $('<div class="lumen-roulette__actions"></div>');
actions.append(actionNode('lumen_roulette_watch', function () { openCard(card); }));
actions.append(actionNode('lumen_roulette_again', function () { spin(); }));
actions.append(actionNode('lumen_roulette_book', function () { book(card); }));
resultBox.append(actions);
recollectOwn(actions.find('.lumen-roulette__btn')[0]);
}


















function showResult(card) {
var captured = gen;
result = card;
var live = frame && frame.card === card && frame.ready ? frame : null;
var rect = live ? reelRect() : null;
if (live) {



var revealed = false;
try {
revealed = !!(rect && LC.transition && typeof LC.transition.reveal === 'function' && LC.transition.reveal({
rect: rect,
poster: atv ? imageUrl(backdropOf(card), 'w300') : imageUrl(card.poster_path, LC.util.posterSize(LC.util.vhPx(REEL_VH))),
big: live.url
}, {




then: function () {
if (gen !== captured || result !== card) return;
paintResult(card);
showKadr(live.url);
try { LC.transition.stop(); } catch (eStop) { }
}
}));
} catch (e) {
warn('roulette: reveal failed', e);
}
if (revealed) return;
}
paintResult(card);
if (live) showKadr(live.url);
}
function openCard(card) {
try {
Lampa.Activity.push({
url: '',
component: 'full',
id: card.id,
method: cardMedia(card),
card: card,
source: 'tmdb'
});
} catch (e) {
warn('roulette: open card failed', e);
}
}





function book(card) {
try {
var already = false;
try {
if (typeof Lampa.Favorite.check === 'function') already = !!(Lampa.Favorite.check(card) || {}).book;
} catch (eCheck) { }
if (!already) Lampa.Favorite.toggle('book', card);
if (Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(LC.lang(already ? 'lumen_roulette_booked_already' : 'lumen_roulette_booked'));
} catch (e) {
warn('roulette: book failed', e);
}
}




function runReel(card, list) {
reel = list;
var mode = 'full';
try { mode = LC.motionMode(); } catch (e) { }
var plan = spinPlan(reel.length, mode);
if (plan.length < 2) {


paintFrame(card);
stopSpin();
showResult(card);
return;
}
var captured = gen;
var step = 0;
function next() {
spinTimer = 0;
if (gen !== captured) return;
if (step >= plan.length) {
stopSpin();
showResult(card);
return;
}
var item = plan[step++];
paintFrame(reel[item.index]);
spinTimer = setTimeout(next, item.delay);
}
next();
}







function verify(card, tries, done) {
if (!filters.short) { done(card); return; }
var cached = runtimes[media + ':' + card.id];
if (cached != null) {
if (Number(cached) <= shortLimit(media)) { done(card); return; }
retry(tries, done, card);
return;
}
var captured = gen;
try {
Lampa.Api.sources.tmdb.get(
media + '/' + card.id,
{ langs: 'ru,en' },
function (details) {
if (gen !== captured) return;
var minutes = null;
if (details) {
if (normalizeMedia(media) === 'tv') {
var list = details.episode_run_time || [];
minutes = list.length ? Number(list[0]) || null : null;
} else {
minutes = Number(details.runtime) || null;
}
}
if (minutes != null) runtimes[media + ':' + card.id] = minutes;
if (fitsShort(details, media)) { done(card); return; }
retry(tries, done, card);
},
function () {
if (gen !== captured) return;


done(card);
},
{ life: 10080 }
);
} catch (e) {
warn('roulette: details failed', e);
done(card);
}
}



function retry(tries, done, last) {
if (tries + 1 >= PICK_TRIES) { done(last); return; }
var list = filtered();
var next = pick(list, Math.random);
if (!next) { done(last); return; }
verify(next, tries + 1, done);
}

function spin() {
if (spinning) return;
spinning = true;




clearResult();






recollect(spinBtn[0]);


clearPreview();
try { spinBtn.addClass('is-busy'); } catch (e) { }
var captured = gen;
try { self.activity.loader(!pool.length); } catch (e) { }
loadPool(function () {
if (gen !== captured) return;
try { self.activity.loader(false); } catch (e2) { }
var list = filtered();
var card = pick(list, Math.random);
if (!card) {
stopSpin();
showEmpty();
return;
}
verify(card, 0, function (final) {
if (gen !== captured) return;





prepareFrame(final);
if (atv) warmLogo(final);
var strip = [];
var i;
for (i = 0; i < REEL_SIZE - 1; i++) {
var random = pick(list, Math.random);
strip.push(random || final);
}
strip.push(final);
runReel(final, strip);
});
});
}





function build(m) {
manifest = m;
buildHead();
buildChips();
buildFilters();
try { self.activity.loader(false); } catch (e) { }




if (!paused) schedulePreview();








var act = null;
try { act = Lampa.Activity.active(); } catch (eAct) { }
if (act && act.activity && act.activity !== self.activity) return;












var ctl = null;
try { ctl = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null; } catch (eCtl) { }
if (ctl && ctl.name !== 'content') return;
if (started) recollect(null);
}




function requestManifest() {
try { self.activity.loader(true); } catch (e) { }
if (manifestWait) return;
manifestWait = true;
LC.manifest.load(function (m) {
manifestWait = false;
if (destroyed) return;
build(m);
});
}

this.create = function () {
motionClass(root);



try {
var act = self.activity && typeof self.activity.render === 'function' ? self.activity.render() : null;
if (act && typeof act.addClass === 'function') act.addClass('lumen-screen');
} catch (eAct) { }





root.append(head);
chipsScroll.append(chipsRow);
chipsBox.append(chipsScroll.render());
root.append(chipsBox);



if (atv) {




screen.addClass('is-atv');
lead.append(spinBtn);
stage.append(lead);
stage.append(reelBox);
} else {
stage.append(peek2);
stage.append(peek1);
stage.append(reelBox);
stage.append(countBox);
stage.append(spinBtn);
}




root.append(stage);
if (atv) root.append(shelf);


root.append(resultBox);
watchFocus(spinBtn);
spinBtn.on('hover:enter', function () { spin(); });
scroll.append(root);







scroll.minus();





screen.append(bg);
screen.append(veilL);
screen.append(veilB);
screen.append(scroll.render());
requestManifest();
};

this.render = function (js) {
return js ? screen[0] : screen;
};

this.start = function () {
var act = null;
try { act = Lampa.Activity.active(); } catch (eAct) { }
if (act && act.activity && act.activity !== this.activity) return;
started = true;


if (paused && atv) shelfLogos(shelfNodes, shelfList, gen, 0);
paused = false;






if (!manifest) requestManifest();
else {
try { self.activity.loader(false); } catch (eL) { }
}





















if (result && !resultShown()) paintResult(result);
if (result && !resultBgShown && !resultLoader) prepareFrame(result);





if (manifest && !result && !stage.hasClass('is-stack')) schedulePreview();
motionClass(root);
Lampa.Controller.add('content', {
toggle: function () {
var box = scope();
Lampa.Controller.collectionSet(box);
Lampa.Controller.collectionFocus(focusTarget() || false, box);
},
left: function () {
if (!navMove('left')) Lampa.Controller.toggle('menu');
},


right: function () {
if (atv && !kadr && spinBtn.hasClass('focus')) return;
navMove('right');
},




up: function () {
if (atv && !kadr && focusIn(shelf)) { recollect(spinBtn[0]); return; }
if (navMove('up')) return;
Lampa.Controller.toggle('head');
},













down: function () {





if (atv && !kadr && focusIn(shelf)) { navMove('down'); return; }


if (atv && !kadr && focusIn(chipsBox)) { recollect(spinBtn[0]); return; }
if (navMove('down')) return;
if (kadr || !spinBtn.length || spinBtn.hasClass('focus')) return;
recollect(spinBtn[0]);
},
back: function () { Lampa.Activity.backward(); }
});
Lampa.Controller.toggle('content');
};










this.pause = function () {
started = false;
paused = true;
bump();
};




this.stop = function () {
started = false;
paused = true;
bump();
};

this.destroy = function () {
destroyed = true;
bump();
pool = [];
reel = [];
result = null;
frame = null;
lastFocus = null;




leaveKadr();
try { chipsScroll.destroy(); } catch (eC) { }
try { scroll.destroy(); } catch (e) { }
try { screen.remove(); } catch (e2) { }
};
}





var component_added = false;
var menu_node = null;






function open(media, preselect) {
try {
var params = {
url: '',
title: LC.lang('lumen_roulette_title'),
component: 'lumen_roulette',
media: normalizeMedia(media),
page: 1
};
if (preselect) params.preselect = '' + preselect;
Lampa.Activity.push(params);
} catch (e) {
warn('roulette: open failed', e);
}
}

function addComponent() {
if (component_added) return;
if (!window.Lampa || !Lampa.Component || typeof Lampa.Component.add !== 'function') return;
Lampa.Component.add('lumen_roulette', RouletteComponent);
component_added = true;
}




function addMenu() {
try {
if (menu_node && menu_node.length && menu_node.closest('body').length) return;
if ($('.lumen-menu-roulette').length) return;
if (!Lampa.Menu || typeof Lampa.Menu.addButton !== 'function') return;
var node = Lampa.Menu.addButton(LC.icons.get('star'), LC.lang('lumen_roulette_title'), function () {
open('movie');
});
if (node && node.addClass) node.addClass('lumen-menu-roulette');
menu_node = node;
} catch (e) {
warn('roulette: menu button failed', e);
}
}

function install() {
try {
addComponent();
addMenu();
} catch (e) {
warn('roulette: install failed', e);
}
}




function uninstall() {
try {
if (menu_node && menu_node.remove) menu_node.remove();
} catch (e) {
warn('roulette: menu remove failed', e);
}
menu_node = null;
try { $('.lumen-menu-roulette').remove(); } catch (e2) { }
}

function menuNode() {
return menu_node;
}

return {
MAX_SOURCES: MAX_SOURCES,
CHIP_LIMIT: CHIP_LIMIT,
buildPool: buildPool,
applyFilters: applyFilters,
shortLimit: shortLimit,
fitsShort: fitsShort,
pick: pick,
spinPlan: spinPlan,
collectionsFor: collectionsFor,
chipList: chipList,
pinFirst: pinFirst,
sourcesFor: sourcesFor,
parseIds: parseIds,
joinIds: joinIds,
storageKey: storageKey,
knownIds: knownIds,
normalizeMedia: normalizeMedia,
atvLook: atvLook,
shelfCards: shelfCards,
textless: textless,
SHELF_SIZE: SHELF_SIZE,
unseenDefault: unseenDefault,
install: install,
uninstall: uninstall,
open: open,
menuNode: menuNode
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.roulette;


/* ---- 57_color.js ---- */






































LC.color = (function () {




var MIN_RATIO = 4.5;






var GOOD_RATIO = 7;







var S_MIN = 0.45;
var S_MAX = 0.85;
var L_MIN = 0.55;
var L_MAX = 0.72;
var L_LIMIT = 0.92;
var L_STEP = 0.03;




var SAMPLE = 16;






var TINT_S = 0.28;
var TINT_MIX = 0.55;
var TINT_STEPS = 6;










var TINT_LIFT = 0.12;






var CACHE_LIMIT = 50;
var cache = {};
var cache_keys = [];
var pending_count = 0;
var request_count = 0;































var last_state = 'idle';
var last_url = '';











var LOAD_MS = 6000;







function shortUrl(u) {
var s = '' + (u || '');
if (!s) return '';
var cut = s.indexOf('?');
if (cut > -1) s = s.substring(0, cut);
cut = s.indexOf('#');
if (cut > -1) s = s.substring(0, cut);
return s.replace(/^[a-z]+:\/\//i, '');
}

function mark(state, url) {
last_state = state;
last_url = shortUrl(url);
}

function clamp(v, lo, hi) {
if (v < lo) return lo;
if (v > hi) return hi;
return v;
}

function normHue(h) {
h = Number(h) || 0;
h = h % 360;
return h < 0 ? h + 360 : h;
}

function parseHex(hex) {
var s = ('' + hex).replace('#', '');
return {
r: parseInt(s.substring(0, 2), 16),
g: parseInt(s.substring(2, 4), 16),
b: parseInt(s.substring(4, 6), 16)
};
}

function byte(v) {
v = Math.round(v);
if (v < 0) v = 0;
if (v > 255) v = 255;
var s = v.toString(16).toUpperCase();
return s.length < 2 ? '0' + s : s;
}

function hex(rgb) {
return '#' + byte(rgb.r) + byte(rgb.g) + byte(rgb.b);
}



function toRgb(c) {
if (!c) return { r: 0, g: 0, b: 0 };
if (typeof c === 'string') return parseHex(c);
return c;
}

function rgbToHsl(rgb) {
var r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
var max = Math.max(r, g, b), min = Math.min(r, g, b);
var d = max - min;
var l = (max + min) / 2;
var h = 0, s = 0;
if (d) {
s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
else if (max === g) h = (b - r) / d + 2;
else h = (r - g) / d + 4;
h *= 60;
}
return { h: h, s: s, l: l };
}

function hue2rgb(p, q, t) {
if (t < 0) t += 1;
if (t > 1) t -= 1;
if (t < 1 / 6) return p + (q - p) * 6 * t;
if (t < 1 / 2) return q;
if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
return p;
}

function hslToRgb(hsl) {
var h = normHue(hsl.h) / 360;
var s = clamp(Number(hsl.s) || 0, 0, 1);
var l = clamp(Number(hsl.l) || 0, 0, 1);
var r, g, b;
if (!s) {
r = g = b = l;
} else {
var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
var p = 2 * l - q;
r = hue2rgb(p, q, h + 1 / 3);
g = hue2rgb(p, q, h);
b = hue2rgb(p, q, h - 1 / 3);
}
return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}




function chan(v) {
v = v / 255;
return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function luminance(c) {
var rgb = toRgb(c);
return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
}

function contrast(a, b) {
var l1 = luminance(a);
var l2 = luminance(b);
var hi = Math.max(l1, l2);
var lo = Math.min(l1, l2);
return (hi + 0.05) / (lo + 0.05);
}




function usable(r, g, b, a) {
if (a < 128) return false;
var max = Math.max(r, g, b);
var min = Math.min(r, g, b);
if (max < 45) return false;
if (min > 225) return false;
return max - min >= 26;
}







function dominant(pixels) {
if (!pixels || !pixels.length) return null;
var bins = [];
var i;
for (i = 0; i < 12; i++) bins.push({ w: 0, r: 0, g: 0, b: 0, n: 0 });
for (i = 0; i + 3 < pixels.length; i += 4) {
var r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
if (!usable(r, g, b, a)) continue;
var hsl = rgbToHsl({ r: r, g: g, b: b });
var bin = bins[Math.floor(normHue(hsl.h) / 30) % 12];
bin.w += hsl.s;
bin.r += r;
bin.g += g;
bin.b += b;
bin.n++;
}
var best = null;
for (i = 0; i < bins.length; i++) {
if (bins[i].n && (!best || bins[i].w > best.w)) best = bins[i];
}
if (!best) return null;
return {
r: Math.round(best.r / best.n),
g: Math.round(best.g / best.n),
b: Math.round(best.b / best.n)
};
}





function onAccent(hsl) {
return { h: normHue(hsl.h), s: clamp(hsl.s * 0.5, 0.12, 0.6), l: 0.07 };
}



function ringOf(hsl) {
return { h: normHue(hsl.h), s: clamp(hsl.s * 0.85, 0.3, 0.9), l: 0.93 };
}

function glow(rgb) {
return 'rgba(' + Math.round(rgb.r) + ',' + Math.round(rgb.g) + ',' + Math.round(rgb.b) + ',0.35)';
}





function mixRgb(a, b, ratio) {
var k = clamp(ratio, 0, 1);
return {
r: Math.round(a.r + (b.r - a.r) * k),
g: Math.round(a.g + (b.g - a.g) * k),
b: Math.round(a.b + (b.b - a.b) * k)
};
}




















var HUE_FAR = 60;
var FAR_DIP = 0.75;




var HUE_MUTE = 0.04;

function hueGap(a, b) {
var d = Math.abs(normHue(a) - normHue(b));
return d > 180 ? 360 - d : d;
}



function hueLerp(a, b, t) {
var d = normHue(b) - normHue(a);
if (d > 180) d -= 360;
if (d < -180) d += 360;
return normHue(normHue(a) + d * t);
}






function copyRgb(c) {
var rgb = toRgb(c);
return { r: rgb.r, g: rgb.g, b: rgb.b };
}






function blend(a, b, t) {
var from = rgbToHsl(toRgb(a));
var to = rgbToHsl(toRgb(b));
var k = clamp(Number(t) || 0, 0, 1);
if (k <= 0) return copyRgb(a);
if (k >= 1) return copyRgb(b);
var h;
if (from.s < HUE_MUTE) h = to.h;
else if (to.s < HUE_MUTE) h = from.h;
else h = hueLerp(from.h, to.h, k);
var s = from.s + (to.s - from.s) * k;
var gap = from.s < HUE_MUTE || to.s < HUE_MUTE ? 0 : hueGap(from.h, to.h);
if (gap > HUE_FAR) {



var depth = FAR_DIP * (gap - HUE_FAR) / (180 - HUE_FAR);
s = s * (1 - depth * Math.sin(Math.PI * k));
}
return hslToRgb({ h: h, s: s, l: from.l + (to.l - from.l) * k });
}
















function tint(rgb, bg, guard, ratio, maxMix) {
if (!rgb) return null;
var base = toRgb(bg);
if (!base) return null;
var src = rgbToHsl(rgb);
var baseHsl = rgbToHsl(base);
var toned = hslToRgb({ h: src.h, s: Math.min(src.s, TINT_S), l: clamp(baseHsl.l + TINT_LIFT, 0, 1) });
var mix = typeof maxMix === 'number' ? maxMix : TINT_MIX;
var limit = typeof ratio === 'number' ? ratio : MIN_RATIO;
for (var i = 0; i < TINT_STEPS; i++) {
var out = mixRgb(base, toned, mix);
if (!guard || contrast(guard, out) >= limit) return hex(out);
mix *= 0.6;
}
return hex(base);
}






function adjust(hsl, bg) {
var h = normHue(hsl.h);
var s = clamp(hsl.s, S_MIN, S_MAX);
var start = clamp(hsl.l, L_MIN, L_MAX);
var bgRgb = toRgb(bg);



function search(ratio) {
var l = start;
while (l <= L_LIMIT + 0.0001) {
var cand = { h: h, s: s, l: l };
var rgb = hslToRgb(cand);
if (contrast(rgb, bgRgb) >= ratio &&
contrast(hslToRgb(onAccent(cand)), rgb) >= ratio) return cand;
l += L_STEP;
}
return null;
}

return search(GOOD_RATIO) || search(MIN_RATIO);
}



function tokens(rgb, bg) {
if (!rgb) return null;
var hsl = adjust(rgbToHsl(rgb), bg);
if (!hsl) return null;
var accent = hslToRgb(hsl);
return {
color: hex(accent),
light: hex(hslToRgb(ringOf(hsl))),
glow: glow(accent),
onac: hex(hslToRgb(onAccent(hsl)))
};
}











var FAIL_LIMIT = 3;

function cacheGet(url) {
return Object.prototype.hasOwnProperty.call(cache, url) ? cache[url] : null;
}

function cachePut(url, rgb, fails) {
if (!Object.prototype.hasOwnProperty.call(cache, url)) {
cache_keys.push(url);
while (cache_keys.length > CACHE_LIMIT) {
var old = cache_keys.shift();
delete cache[old];
}
}
cache[url] = { rgb: rgb || null, fails: fails || 0 };
}










function read(img, doc, src) {




if (!img.naturalWidth || !img.naturalHeight) {
mark('blank', src);
return null;
}
try {
var canvas = doc.createElement('canvas');
canvas.width = SAMPLE;
canvas.height = SAMPLE;




var ctx = canvas.getContext('2d', { willReadFrequently: true });
if (!ctx) return null;
ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
var rgb = dominant(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data);



mark(rgb ? 'ok' : 'dim', src);
return rgb;
} catch (e) {




mark(e && e.name === 'SecurityError' ? 'cors' : 'error', src);
warn('accent: poster pixels blocked ' + shortUrl(src), e);
return null;
}
}














function fromImage(url, cb, alt) {
if (!url) { cb(null); return null; }
var seen = cacheGet(url);



if (seen && (seen.rgb || seen.fails >= FAIL_LIMIT)) { cb(seen.rgb); return null; }
var doc = typeof document !== 'undefined' ? document : null;
if (!doc || typeof Image === 'undefined') { cb(null); return null; }

var img = null;
var live = true;
var retry = alt && alt !== url ? alt : '';
var watchdog = 0;
pending_count++;
request_count++;




function unwatch() {
if (!watchdog) return;
try { clearTimeout(watchdog); } catch (e) { }
watchdog = 0;
}

function detach() {
unwatch();
if (!img) return;
img.onload = null;
img.onerror = null;
img = null;
}

function release() {
live = false;
pending_count--;
detach();
}

function done(rgb) {
if (!live) return;
release();





if (rgb) cachePut(url, rgb, 0);
else {
var prev = cacheGet(url);
cachePut(url, null, (prev ? prev.fails : 0) + 1);
}
cb(rgb);
}

function fail(src, state) {
if (!live) return;
mark(state, src);
warn('accent: poster ' + (state === 'timer' ? 'timed out ' : 'load failed ') + shortUrl(src));
if (retry) {
var next = retry;
retry = '';
detach();
start(next);
return;
}
done(null);
}

function start(src) {
var el = new Image();
img = el;
el.onload = function () { done(read(el, doc, src)); };
el.onerror = function () { fail(src, 'load'); };
watchdog = setTimeout(function () {
watchdog = 0;
fail(src, 'timer');
}, LOAD_MS);


el.crossOrigin = 'anonymous';




el.src = src;
}

start(url);

return {
cancel: function () {
if (!live) return;
release();
}
};
}

return {
MIN_RATIO: MIN_RATIO,
rgbToHsl: rgbToHsl,
hslToRgb: hslToRgb,
hex: hex,
parseHex: parseHex,
luminance: luminance,
contrast: contrast,
dominant: dominant,
adjust: adjust,
onAccent: onAccent,
ring: ringOf,
glow: glow,
tokens: tokens,
mixRgb: mixRgb,
blend: blend,
tint: tint,
fromImage: fromImage,


status: function () { return { state: last_state, url: last_url }; },
LOAD_MS: LOAD_MS,
cacheSize: function () { return cache_keys.length; },
pending: function () { return pending_count; },




requests: function () { return request_count; }
};
})();









LC.accent = (function () {

var AUTO_KEY = 'lumen_accent_auto';







var POSTER_SIZE = 't/p/w185';









var override = null;




var themeTokens = null;






var source = null;
var target = null;
var task = null;


































var TWEEN_MS = 1600;
var TWEEN_STEP_MS = 400;
var tween = null;























function auto() {
var v = LC.pref(AUTO_KEY, true);
return v === true || v === 'true';
}
















function motionOn() {
try {
return LC.motionMode() !== 'off';
} catch (e) {
return false;
}
}

function on() {
if (!LC.enabled() || !auto()) return false;
return motionOn();
}









var QUANT = 16;

function quantChannel(v) {
var n = Math.floor(Number(v) / QUANT) * QUANT + QUANT / 2;
if (!(n > 0)) return 0;
return n > 255 ? 255 : n;
}

function quantize(rgb) {
if (!rgb) return null;
return { r: quantChannel(rgb.r), g: quantChannel(rgb.g), b: quantChannel(rgb.b) };
}

function bg() {
try {
var t = LC.tokens();
if (t && t.bg) return t.bg;
} catch (e) {
warn('accent: tokens failed', e);
}
return '#0B0908';
}

function posterUrl(path) {
try {
if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function') {
return Lampa.TMDB.image(POSTER_SIZE + path);
}
} catch (e) {
warn('accent: tmdb image failed', e);
}
return '';
}

function cancel() {
if (task) {
task.cancel();
task = null;
}
}





function stopTween() {
if (!tween) return;
try { clearTimeout(tween.timer); } catch (e) { }
tween = null;
}

function tweenStep() {
if (!tween) return;
tween.step++;
if (tween.step >= tween.steps) {
source = ownRgb(tween.to);
tween = null;
paint();
return;
}
source = LC.color.blend(tween.from, tween.to, tween.step / tween.steps);
paint();
tween.timer = setTimeout(tweenStep, TWEEN_STEP_MS);
}

function startTween(from, to) {
stopTween();
tween = {
from: from, to: to, step: 0,
steps: Math.round(TWEEN_MS / TWEEN_STEP_MS), timer: 0
};
tween.timer = setTimeout(tweenStep, TWEEN_STEP_MS);
}






function tweenWanted(deep, next) {
if (deep || !source || !next) return false;
if (sameRgb(source, next)) return false;
try {
return LC.motionMode() === 'full';
} catch (e) {
return false;
}
}

function sameRgb(a, b) {
if (!a || !b) return !a && !b;
return a.r === b.r && a.g === b.g && a.b === b.b;
}





function ownRgb(rgb) {
return rgb ? { r: rgb.r, g: rgb.g, b: rgb.b } : null;
}


























var accent_css_text = { 'lumen-accent': null, 'lumen-accent-focus': null };

function writeAccentStyle(id, rules, last) {
if (typeof document === 'undefined') return;
try {
var node = document.getElementById(id);
if (!rules) {
if (node && node.parentNode) node.parentNode.removeChild(node);
accent_css_text[id] = null;
return;
}
var born = false;
if (!node) {
node = document.createElement('style');
node.id = id;
node.type = 'text/css';




(document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(node);
born = true;
} else if (last && node !== document.head.lastChild) {





document.head.appendChild(node);
}





if (born || rules !== accent_css_text[id]) {
node.textContent = rules;
accent_css_text[id] = rules;
}
} catch (e) { warn('accent: style write failed', e); }
}






function paint(last) {
var rules = '';
var focus = '';
if (source && LC.enabled() && motionOn() && typeof LC.accentCss === 'function') {
try {
rules = LC.accentCss();
if (typeof LC.accentFocusCss === 'function') focus = LC.accentFocusCss();
} catch (e) {
warn('accent: rules failed', e);
rules = '';
focus = '';
}
}
writeAccentStyle('lumen-accent', rules, last);




writeAccentStyle('lumen-accent-focus', focus, last);
}






var applied = null;

function tokenColor() {
var t = override || themeTokens;
return t ? t.color : null;
}




function restyle() {
applied = tokenColor();
paint(true);
}











function repaint() {







var full = false;
try {
full = LC.motionMode() === 'full';
} catch (e) { }
if (!full && tween) {
stopTween();
source = ownRgb(target);
}
paint(false);
}





function drive(rgb, instant) {
target = ownRgb(rgb || null);
if (!instant && tweenWanted(false, target) && LC.enabled()) startTween(source, target);
else { stopTween(); source = ownRgb(target); }
paint();
}

function rebuild() {
if (!LC.enabled()) return;
try {
LC.injectCss();
} catch (e) {
warn('accent: css inject failed', e);
}
}









function apply(next, rgb, deep) {









var stopped = false;
if (deep && tween) {
stopTween();
source = ownRgb(target);
stopped = true;
}
var sameTokens = next && override ? next.color === override.color : (!next && !override);





if (!stopped && sameTokens && sameRgb(target, rgb || null) &&
sameRgb(source, target) && !(deep && applied !== tokenColor())) return;







var tweening = tweenWanted(deep, rgb || null) && LC.enabled();
override = next || null;
target = rgb || null;
if (tweening) startTween(source, target);
else { stopTween(); source = ownRgb(target); }



if (!LC.enabled()) { paint(); return; }
if (deep && (stopped || applied !== tokenColor())) {


rebuild();
return;
}
paint();
}

function reset() {
cancel();
apply(null, null, true);
}





function applyFor(movie, deep) {
cancel();
if (!on()) { apply(null, null, deep); return; }
var path = movie && movie.poster_path;
if (!path) { apply(null, null, deep); return; }
var url = posterUrl(path);
if (!url) { apply(null, null, deep); return; }


task = LC.color.fromImage(url, function (rgb) {
task = null;





var dom = quantize(rgb);
apply(dom ? LC.color.tokens(dom, bg()) : null, dom, deep);
}, '');
}













function tint(bg, guard, ratio) {
if (!source) return null;
try {
if (LC.motionMode() === 'off') return null;
} catch (e) {
return null;
}
return LC.color.tint(source, bg, guard, ratio);
}







function status() {
var off = { state: 'off', url: '', color: '' };
try {
if (!LC.enabled() || !auto() || !motionOn()) return off;
} catch (e) {
return off;
}
var st = LC.color.status();
return {
state: st.state,
url: st.url,
color: st.state === 'ok' && source ? LC.color.hex(source) : ''
};
}


function destroy() {
cancel();
stopTween();
var had = !!(override || source || themeTokens);
override = null;
source = null;
target = null;
themeTokens = null;



paint();
if (!had || !LC.enabled()) return;
try {
LC.injectCss();
} catch (e) {
warn('accent: css inject failed', e);
}
}





function setTheme(hex) {
var next = null;
if (hex) {
try {
next = LC.color.tokens(LC.color.parseHex(hex), bg());
} catch (e) {
warn('accent: theme color failed', e);
}
}
var same = next && themeTokens ? next.color === themeTokens.color : (!next && !themeTokens);
if (same) return;
themeTokens = next;


if (override) return;
if (!LC.enabled()) return;
try {
LC.injectCss();
} catch (eCss) {
warn('accent: css inject failed', eCss);
}
}

return {
current: function () { return override || themeTokens; },
theme: function () { return themeTokens; },
setTheme: setTheme,




dominant: function () { return source; },
target: function () { return target; },


timing: function () { return { total: TWEEN_MS, step: TWEEN_STEP_MS }; },








stopTween: stopTween,
status: status,
tint: tint,
applyFor: applyFor,
reset: reset,


restyle: restyle,

repaint: repaint,
drive: drive,




destroy: destroy
};
})();





LC.applyAccentPref = function () {
try {
var movie = LC.active && LC.active.data && LC.active.data.movie;



LC.accent.applyFor(movie || null, true);
} catch (e) {
warn('accent pref failed', e);
}
};

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.color;


/* ---- 57_thumbs.js ---- */















































LC.thumbs = (function () {

var SIZE = 'w92';

var FW = 48;
var FH = 27;


var CROP = 0.7;


var SCALES = [1, 0.8, 0.64];

var HIST_W = 30;



var HIST_SIM = 0.7;
var CORR_SIM = 0.75;
var BOTH_SIM = 0.6;


var LOGO_W = 64;
var LOGO_H_MAX = 64;
var ALPHA_MIN = 128;










var DARK_MED = 0.25;
var DARK_P75 = 0.35;
var LOAD_MS = 8000;


var IDLE_MS = 120;


var KEEP = 60;


var TABLE_MAX = 600;





function bytes(n) {
return typeof Uint8Array === 'function' ? new Uint8Array(n) : new Array(n);
}


function luma(data, n) {
var out = bytes(n);
for (var i = 0, j = 0; i < n; i++, j += 4) {
out[i] = Math.round(0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]);
}
return out;
}


function histogram(data, n) {
var h = [];
var k;
for (k = 0; k < 64; k++) h[k] = 0;
var count = 0;
for (var i = 0, j = 0; i < n; i++, j += 4) {
if (data[j + 3] < ALPHA_MIN) continue;
h[((data[j] >> 6) << 4) | ((data[j + 1] >> 6) << 2) | (data[j + 2] >> 6)]++;
count++;
}
if (count) for (k = 0; k < 64; k++) h[k] /= count;
return h;
}


function histMatch(a, b) {
var s = 0;
for (var k = 0; k < 64; k++) s += Math.min(a[k] || 0, b[k] || 0);
return s;
}



function corrAt(f, fw, t, tw, th, x, y, st, vt) {
var n = tw * th;
var sf = 0;
var sff = 0;
var sft = 0;
for (var r = 0; r < th; r++) {
var fo = (y + r) * fw + x;
var to = r * tw;
for (var c = 0; c < tw; c++) {
var a = f[fo + c];
sf += a;
sff += a * a;
sft += a * t[to + c];
}
}
var vf = sff - sf * sf / n;
if (vf <= 1e-6 || vt <= 1e-6) return 0;
return (sft - sf * st / n) / Math.sqrt(vf * vt);
}



function bestCorr(f, fw, fh, tmpl) {
if (!tmpl || tmpl.w > fw || tmpl.h > fh) return -1;
var n = tmpl.w * tmpl.h;
var st = 0;
var stt = 0;
for (var i = 0; i < n; i++) {
st += tmpl.g[i];
stt += tmpl.g[i] * tmpl.g[i];
}
var vt = stt - st * st / n;
var best = -1;
for (var y = 0; y + tmpl.h <= fh; y++) {
for (var x = 0; x + tmpl.w <= fw; x++) {
var v = corrAt(f, fw, tmpl.g, tmpl.w, tmpl.h, x, y, st, vt);
if (v > best) best = v;
}
}
return best;
}

function similar(hist, corr) {
return hist >= HIST_SIM || corr >= CORR_SIM || (hist >= BOTH_SIM && corr >= BOTH_SIM);
}



function judge(poster, frame) {
var hist = histMatch(poster.h, frame.hist);
var corr = -1;
for (var i = 0; i < poster.t.length; i++) {
var c = bestCorr(frame.g, frame.w, frame.h, poster.t[i]);
if (c > corr) corr = c;
}
return { hist: hist, corr: corr, similar: similar(hist, corr) };
}

function linear(v) {
v /= 255;
return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}


function lightness(y) {
return y > 0.008856 ? (116 * Math.pow(y, 1 / 3) - 16) / 100 : 9.033 * y;
}


function toneStats(data) {
var ls = [];
for (var j = 0; j < data.length; j += 4) {
if (data[j + 3] < ALPHA_MIN) continue;
ls.push(lightness(0.2126 * linear(data[j]) + 0.7152 * linear(data[j + 1]) + 0.0722 * linear(data[j + 2])));
}
ls.sort(function (a, b) { return a - b; });
var n = ls.length;
return { n: n, med: n ? ls[n >> 1] : 0, p75: n ? ls[Math.min(n - 1, Math.floor(n * 0.75))] : 0 };
}

function darkOf(stats) {
return !!(stats && stats.n > 0 && (stats.med < DARK_MED || stats.p75 < DARK_P75));
}





var idleQueue = [];
var idleArmed = false;

function idle(fn) {
idleQueue.push(fn);
arm();
}

function arm() {
if (idleArmed || !idleQueue.length) return;
idleArmed = true;
var run = function () {
idleArmed = false;
var fn = idleQueue.shift();
try {
if (fn) fn();
} catch (e) {
warn('thumbs: idle task failed', e);
}
arm();
};
try {
if (typeof window.requestIdleCallback === 'function') {
window.requestIdleCallback(run, { timeout: IDLE_MS });
return;
}
} catch (e) { }
setTimeout(run, 16);
}





function urlOf(path) {
try {
var tmdb = window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function' ?
function (u) { return Lampa.TMDB.image(u); } : null;
var api = window.Lampa && Lampa.Api && typeof Lampa.Api.img === 'function' ?
function (p, s) { return Lampa.Api.img(p, s); } : null;
return LC.cardinfo.imageUrl(path, SIZE, tmdb, api);
} catch (e) {
return '';
}
}


var flights = {};

function unhook(fl) {
if (fl.img) {
fl.img.onload = null;
fl.img.onerror = null;
}
if (fl.timer) {
clearTimeout(fl.timer);
fl.timer = null;
}
}

function land(path, fl, img) {
if (flights[path] !== fl) return;
delete flights[path];
unhook(fl);
var subs = fl.subs;
fl.subs = [];
for (var i = 0; i < subs.length; i++) {
try { subs[i](img); } catch (e) { warn('thumbs: callback failed', e); }
}
}

function start(path, fl, url) {
var img = new Image();
fl.img = img;
img.onload = function () { land(path, fl, img); };
img.onerror = function () { land(path, fl, null); };
fl.timer = setTimeout(function () {
fl.timer = null;
land(path, fl, img.complete && img.naturalWidth ? img : null);
}, LOAD_MS);




img.crossOrigin = 'anonymous';
img.src = url;
}



function fetchImage(path, cb) {
var fl = flights[path];
if (!fl) {
var url = urlOf(path);
if (!url) {
cb(null);
return { cancel: function () { } };
}
fl = { img: null, subs: [], timer: null };
flights[path] = fl;
start(path, fl, url);
}
fl.subs.push(cb);
return {
cancel: function () {
var i = fl.subs.indexOf(cb);
if (i !== -1) fl.subs.splice(i, 1);
if (fl.subs.length || flights[path] !== fl) return;
delete flights[path];
unhook(fl);
try {
if (fl.img && typeof fl.img.removeAttribute === 'function') fl.img.removeAttribute('src');
} catch (e) { }
}
};
}





function context(w, h) {
var canvas = document.createElement('canvas');
canvas.width = w;
canvas.height = h;


return canvas.getContext('2d', { willReadFrequently: true });
}

function framePixels(img) {
var ctx = context(FW, FH);
ctx.drawImage(img, 0, 0, FW, FH);
var data = ctx.getImageData(0, 0, FW, FH).data;
return { w: FW, h: FH, g: luma(data, FW * FH), hist: histogram(data, FW * FH) };
}

function posterPixels(img) {
var W = img.naturalWidth;
var H = img.naturalHeight;
var sy = H * (1 - CROP) / 2;
var sh = H * CROP;
var aspect = W / sh;
var t = [];
for (var i = 0; i < SCALES.length; i++) {
var th = Math.round(FH * SCALES[i]);
var tw = Math.round(th * aspect);
if (tw < 2 || th < 2 || tw > FW) continue;
var ctx = context(tw, th);
ctx.drawImage(img, 0, sy, W, sh, 0, 0, tw, th);
t.push({ w: tw, h: th, g: luma(ctx.getImageData(0, 0, tw, th).data, tw * th) });
}
var hh = Math.max(1, Math.round(HIST_W / aspect));
var hc = context(HIST_W, hh);
hc.drawImage(img, 0, sy, W, sh, 0, 0, HIST_W, hh);
return { t: t, h: histogram(hc.getImageData(0, 0, HIST_W, hh).data, HIST_W * hh) };
}

function logoPixels(img) {
var h = Math.max(1, Math.min(LOGO_H_MAX, Math.round(LOGO_W * img.naturalHeight / img.naturalWidth)));
var ctx = context(LOGO_W, h);
ctx.drawImage(img, 0, 0, LOGO_W, h);
return toneStats(ctx.getImageData(0, 0, LOGO_W, h).data);
}



var feats = {};
var featKeys = [];

function featGet(key) {
return Object.prototype.hasOwnProperty.call(feats, key) ? feats[key] : undefined;
}

function featPut(key, value) {
if (!Object.prototype.hasOwnProperty.call(feats, key)) {
featKeys.push(key);
while (featKeys.length > KEEP) delete feats[featKeys.shift()];
}
feats[key] = value;
}








function extract(kind, img) {



if (!img) { score(false); return null; }
if (!img.naturalWidth || !img.naturalHeight) return false;
try {
var out = kind === 'poster' ? posterPixels(img) : (kind === 'frame' ? framePixels(img) : logoPixels(img));
score(true);
return out;
} catch (e) {
warn('thumbs: pixels blocked', e);
score(false);
return false;
}
}

var verdicts = {};
var verdictCount = 0;
var tones = {};
var toneCount = 0;







var FAIL_LIMIT = 6;
var failRow = 0;

function blocked() {
return failRow >= FAIL_LIMIT;
}

function score(ok) {
failRow = ok ? 0 : failRow + 1;
}

function remember(table, key, value) {
if (table === verdicts) {
if (verdictCount >= TABLE_MAX) { verdicts = {}; verdictCount = 0; table = verdicts; }
if (!Object.prototype.hasOwnProperty.call(table, key)) verdictCount++;
} else {
if (toneCount >= TABLE_MAX) { tones = {}; toneCount = 0; table = tones; }
if (!Object.prototype.hasOwnProperty.call(table, key)) toneCount++;
}
table[key] = value;
}

function verdict(poster, frame) {
var key = poster + '|' + frame;
return Object.prototype.hasOwnProperty.call(verdicts, key) ? verdicts[key] : undefined;
}

function toneOf(path) {
return path && Object.prototype.hasOwnProperty.call(tones, path) ? tones[path] : undefined;
}



function need(kind, path, cb) {
var key = kind + ':' + path;
var got = featGet(key);
if (got !== undefined) {
cb(got);
return { cancel: function () { } };
}
var live = true;
var load = fetchImage(path, function (img) {
if (!live) return;
idle(function () {
if (!live) return;
var now = featGet(key);
if (now === undefined) {
now = extract(kind, img);
if (now !== null) featPut(key, now);
}
cb(now);
});
});
return {
cancel: function () {
if (!live) return;
live = false;
load.cancel();
}
};
}






function compare(poster, frame, cb) {
var known = verdict(poster, frame);
if (known !== undefined || blocked()) {






if (known === undefined) {
known = null;
remember(verdicts, poster + '|' + frame, known);
}
cb(known);
return { cancel: function () { } };
}
var live = true;
var pf;
var ff;
var jobs = [];




function settle() {
if (!live || pf === undefined || (pf && ff === undefined)) return;
live = false;
for (var i = 1; i < jobs.length; i++) jobs[i].cancel();
var value = pf && ff ? judge(pf, ff).similar : null;
if (pf !== null && ff !== null) remember(verdicts, poster + '|' + frame, value);
cb(value);
}
jobs.push(need('poster', poster, function (got) { pf = got; settle(); }));
if (live) jobs.push(need('frame', frame, function (got) { ff = got; settle(); }));
return {
cancel: function () {
if (!live) return;
live = false;
for (var i = 0; i < jobs.length; i++) jobs[i].cancel();
}
};
}



function tone(path, cb) {
var known = toneOf(path);
if (known !== undefined || blocked()) {
cb(known === undefined ? 'none' : known);
return { cancel: function () { } };
}
var live = true;
var job = need('logo', path, function (stats) {
if (!live) return;
live = false;
var value = stats ? (darkOf(stats) ? 'dark' : 'light') : 'none';

if (stats !== null) remember(tones, path, value);
cb(value);
});
return {
cancel: function () {
if (!live) return;
live = false;
job.cancel();
}
};
}

return {

luma: luma,
histogram: histogram,
histMatch: histMatch,
bestCorr: bestCorr,
similar: similar,
judge: judge,
toneStats: toneStats,
darkOf: darkOf,

compare: compare,
verdict: verdict,
tone: tone,
toneOf: toneOf,

stats: function () {
var fly = 0;
for (var k in flights) if (Object.prototype.hasOwnProperty.call(flights, k)) fly++;
return { fly: fly, idle: idleQueue.length, feats: featKeys.length, blocked: blocked() };
}
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.thumbs;


/* ---- 58_prefetch.js ---- */













































LC.prefetch = (function () {





var IDLE = 250;


var SLOTS = 2;


var AHEAD = { full: 3, lite: 2 };
var BEHIND = { full: 2, lite: 1 };

var NEXT_ROW = 3;


var WARM_FIRST = 7;
var WARM_SECOND = 3;


var DETAILS_KEEP = 40;








var SEND_LIMIT = 25000;




var gen = 0;
var idleTimer = null;
var focusEl = null;
var prevEl = null;

var dir = 1;

var queue = [];

var busy = 0;

var hits = 0;

var kept = [];

var flight = {};

var logoJobs = [];

var warmed = null;

function langCode() {
try {
if (typeof LC.langCode === 'function') return LC.langCode();
} catch (e) { }
return 'ru';
}

function logoAllowed() {
try { return LC.pref ? LC.pref('lumen_hero_logo', true) !== false : true; } catch (e) { return true; }
}

function windowMode() {
var m = 'lite';
try { m = LC.motionMode(); } catch (e) { }
return m === 'full' ? 'full' : 'lite';
}


function ready() {
try {
return !!(LC.hero && LC.hero.active() && !LC.hero.parked());
} catch (e) {
return false;
}
}

function lampaGet() {
return !!(window.Lampa && Lampa.Api && Lampa.Api.sources && Lampa.Api.sources.tmdb &&
typeof Lampa.Api.sources.tmdb.get === 'function');
}




function requestOf(card) {
if (!card || card.id == null || !LC.hero) return null;
var media = LC.hero.mediaOf(card);
var lang = langCode();
var req = LC.hero.detailsRequest(media, card.id, lang);
req.key = media + '/' + card.id + '/' + lang;
return req;
}

function recall(key) {
for (var i = kept.length - 1; i >= 0; i--) {
if (kept[i].key === key) {
var hit = kept.splice(i, 1)[0];
kept.push(hit);
return hit.json;
}
}
return null;
}

function remember(key, json) {
for (var i = 0; i < kept.length; i++) {
if (kept[i].key === key) {
kept.splice(i, 1);
break;
}
}
kept.push({ key: key, json: json });
while (kept.length > DETAILS_KEEP) kept.shift();
}














function send(req, sub) {
var key = req.key;
if (flight[key]) {
flight[key].push(sub);
return;
}
var mine = [sub];
flight[key] = mine;
var limit = setTimeout(function () {
limit = null;
settle(null, false);
}, SEND_LIMIT);
function settle(json, ok) {
if (flight[key] !== mine) return;
delete flight[key];
if (limit) {
clearTimeout(limit);
limit = null;
}
if (ok && json) remember(key, json);
for (var i = 0; i < mine.length; i++) {
try {
if (ok) mine[i].ok(json);
else mine[i].err();
} catch (e) {
warn('prefetch: callback failed', e);
}
}
}
try {
Lampa.Api.sources.tmdb.get(req.url, req.params,
function (json) { settle(json, true); },
function () { settle(null, false); },
{ life: req.life });
} catch (e) {
warn('prefetch: request failed', e);
settle(null, false);
}
}


function details(card, ok, err) {
var req = lampaGet() ? requestOf(card) : null;
if (!req) {
err();
return;
}
var json = recall(req.key);
if (json) {
hits++;
ok(json);
return;
}
send(req, { ok: ok, err: err });
}








function logoJob(json) {
if (!logoAllowed() || !json || !LC.hero) return null;
var path = LC.hero.pickLogo(json.images && json.images.logos, langCode());
if (!path) return null;
var state = LC.hero.logoState(path);
if (state === 'ok') LC.hero.touchLogo(path);
if (state && state !== 'retry') return null;
var url = LC.hero.logoUrl(path);
return url ? { path: path, url: url } : null;
}




function chainLogo(json) {
var job = logoJob(json);
if (job) queue.unshift(job);
}

function runLogo(job) {
var state = LC.hero.logoState(job.path);
if (state && state !== 'retry') return;
var entry = { handle: null, over: false };
entry.handle = LC.hero.preloadLogo(job.path, job.url, function () {
if (entry.over) return;
entry.over = true;
var i = logoJobs.indexOf(entry);
if (i !== -1) logoJobs.splice(i, 1);
busy--;
pump();
});
busy++;
logoJobs.push(entry);
}

function runDetails(job) {
var json = recall(job.req.key);
if (json) {
chainLogo(json);
return;
}


if (flight[job.req.key]) return;
var captured = gen;
busy++;
send(job.req, {
ok: function (j) {
busy--;
if (captured === gen) chainLogo(j);
pump();
},
err: function () {
busy--;
pump();
}
});
}

function pump() {
while (busy < SLOTS && queue.length) {
var job = queue.shift();
try {
if (job.path) runLogo(job);
else runDetails(job);
} catch (e) {
warn('prefetch: job failed', e);
}
}
}




function plan(cards) {
var seen = {};
var logos = [];
for (var i = 0; i < queue.length; i++) if (queue[i].req) seen[queue[i].req.key] = true;
for (var c = 0; c < cards.length; c++) {
var req = requestOf(cards[c]);
if (!req || seen[req.key]) continue;
seen[req.key] = true;
var json = recall(req.key);
if (json) {
var job = logoJob(json);
if (job) logos.push(job);
} else {
queue.push({ req: req });
}
}
queue = logos.concat(queue);
pump();
}


function cardsIn(line) {
var out = [];
var list = line.find('.card');
for (var i = 0; i < list.length; i++) {
if (list[i] && list[i].card_data && list[i].card_data.id != null) out.push(list[i]);
}
return out;
}


function nextLine(line) {
var next = line.next();
for (var guard = 0; next && next.length && guard < 4; guard++) {
if (next.hasClass('items-line')) return next;
next = next.next();
}
return null;
}

function dataOf(nodes, from, count, out) {
for (var i = from; i < nodes.length && i < from + count; i++) out.push(nodes[i].card_data);
}





function windowOf(el) {
var line = $(el).closest('.items-line');
if (!line || !line.length) return [];
var nodes = cardsIn(line);
var at = nodes.indexOf(el);
if (at === -1) return [];
var from = prevEl ? nodes.indexOf(prevEl) : -1;
if (from !== -1 && from !== at) dir = at > from ? 1 : -1;
var m = windowMode();
var out = [];
var k;
for (k = 1; k <= AHEAD[m]; k++) if (nodes[at + dir * k]) out.push(nodes[at + dir * k].card_data);
for (k = 1; k <= BEHIND[m]; k++) if (nodes[at - dir * k]) out.push(nodes[at - dir * k].card_data);
var next = nextLine(line);
if (next) dataOf(cardsIn(next), 0, NEXT_ROW, out);
return out;
}

function stopIdle() {
if (idleTimer) {
clearTimeout(idleTimer);
idleTimer = null;
}
}

function around(el) {
gen++;
queue.length = 0;
stopIdle();
if (!el) return;
prevEl = focusEl;
focusEl = el;
var captured = gen;
idleTimer = setTimeout(function () {
idleTimer = null;
if (captured !== gen || !ready()) return;
try {
plan(windowOf(el));
} catch (e) {
warn('prefetch: window failed', e);
}
}, IDLE);
}

function warm(root) {
if (!root || !root.length || !ready()) return;
if (warmed === root[0]) return;
warmed = root[0];
try {
var lines = root.find('.items-line');
var out = [];
if (lines.length > 0) dataOf(cardsIn($(lines[0])), 0, WARM_FIRST, out);
if (lines.length > 1) dataOf(cardsIn($(lines[1])), 0, WARM_SECOND, out);
plan(out);
} catch (e) {
warn('prefetch: warm failed', e);
}
}





function stop() {
gen++;
queue.length = 0;
stopIdle();
focusEl = null;
prevEl = null;



warmed = null;
var jobs = logoJobs;
logoJobs = [];
for (var i = 0; i < jobs.length; i++) {
if (jobs[i].over) continue;
jobs[i].over = true;
busy--;
try { if (jobs[i].handle) jobs[i].handle.cancel(); } catch (e) { warn('prefetch: stop failed', e); }
}
}



function stats() {
return { fly: busy, queue: queue.length, hits: hits };
}

return {
around: around,
details: details,
warm: warm,
stop: stop,
stats: stats
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.prefetch;


/* ---- 60_reviews.js ---- */


















LC.reviews = (function () {

var BASE = 'https://kinopoiskapiunofficial.tech/api/v2.2/films';
var TTL = 24 * 3600 * 1000;



var EMPTY_TTL = 2 * 3600 * 1000;







var MAX_FILMS = 8;
var MAX_FULL = 4000;
var MAX_EXCERPT = 300;
var MAX_ITEMS = 12;
var TIMEOUT_MS = 8000;
var INDEX_KEY = 'lumen_rv_index';
var ANON = 'Аноним';

var esc = LC.util.esc;





function cacheKey(imdbId) { return 'lumen_rv_' + imdbId; }

function now(value) { return typeof value === 'number' ? value : Date.now(); }




function ttlOf(rec) {
return (rec && rec.list && rec.list.length) ? TTL : EMPTY_TTL;
}

function isFresh(rec, at) {
return !!(rec && rec.at && (now(at) - rec.at) < ttlOf(rec));
}





function cut(text, limit) {
if (text.length <= limit) return text;
return text.slice(0, limit - 1) + '…';
}

function trim(str) {
return ('' + (str || '')).replace(/^\s+|\s+$/g, '');
}






function keyStamp(key) {
if (!key) return '0';
var h = 5381;
for (var i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
return key.length + ':' + (h >>> 0);
}



function firstSentence(text) {
var m = text.match(/^(.{10,80}?[.!?])\s/);
return m ? m[1] : text.slice(0, 60);
}


























var WRAP_RE = /\[(?:spoiler|спойлер)\]([\s\S]*?)\[\/(?:spoiler|спойлер)\]|<spoiler>([\s\S]*?)<\/spoiler>|<span[^>]*spoiler[^>]*>([\s\S]*?)<\/span>/gi;
var ALERT_RE = /(осторожно[\s,!:-]*спойлер|внимание[\s,!:-]*спойлер|далее\s+спойлер|спойлеры?\s+ниже|содержит\s+спойлер|spoiler\s*alert)/i;
var MARK_RE = /(спойлер|spoiler|концовк|развязк|в финале|в конце фильма|умирает|погибает|воскреса)/i;



function pushSeg(out, text, spoiler) {
if (!text) return;
var last = out.length ? out[out.length - 1] : null;
if (last && last.s === spoiler) { last.t += text; return; }
out.push({ t: text, s: !!spoiler });
}


function splitPlain(out, text) {
if (!text) return;
var alert = ALERT_RE.exec(text);
if (alert) {
pushSeg(out, text.slice(0, alert.index), false);
pushSeg(out, text.slice(alert.index), true);
return;
}
var sentences = text.match(/[^.!?…]*[.!?…]+\s*|[^.!?…]+$/g) || [text];
for (var i = 0; i < sentences.length; i++) {
pushSeg(out, sentences[i], MARK_RE.test(sentences[i]));
}
}



function splitSpoilers(text) {
var src = '' + (text || '');
var out = [];
if (!src) return out;
WRAP_RE.lastIndex = 0;
var at = 0;
var m;
while ((m = WRAP_RE.exec(src)) !== null) {
splitPlain(out, src.slice(at, m.index));
pushSeg(out, m[1] || m[2] || m[3] || '', true);
at = m.index + m[0].length;

if (m[0].length === 0) WRAP_RE.lastIndex++;
}
splitPlain(out, src.slice(at));
return out;
}

function hasSpoiler(segs) {
for (var i = 0; i < segs.length; i++) if (segs[i].s) return true;
return false;
}


function openText(segs) {
var out = '';
for (var i = 0; i < segs.length; i++) if (!segs[i].s) out += segs[i].t;
return trim(out.replace(/\s+/g, ' '));
}





function kpRateOf(item) {
var rate = parseFloat(item && item.ratingKinopoisk);
if (!rate || rate <= 0) return 0;
return rate > 10 ? 10 : rate;
}




function reportRate(rate, onRate) {
try {
if (!(rate > 0)) return;




if (typeof onRate === 'function') { onRate(rate); return; }
if (typeof LC.applyKpRate === 'function') LC.applyKpRate(rate);
} catch (e) {
warn('kp rate apply failed', e);
}
}




function normalize(resp, anon) {
var items = (resp && resp.items) || [];
var out = [];
if (!items || typeof items.length !== 'number') return out;
LC.util.each(items, function (it) {
if (!it) return;
var text = trim(('' + (it.description || '')).replace(/\s+/g, ' '));
if (!text) return;




var full = cut(text, MAX_FULL);
var segs = splitSpoilers(full);
var spoiler = hasSpoiler(segs);


var open = spoiler ? openText(segs) : full;

var title = trim(('' + (it.title || '')).replace(/\s+/g, ' '));



if (title && hasSpoiler(splitSpoilers(title))) title = open ? firstSentence(open) : '';
if (!title) title = open ? firstSentence(open) : '';




var parts = [];
if (spoiler) {
for (var i = 0; i < segs.length; i++) parts.push({ t: esc(segs[i].t), s: segs[i].s });
}

var author = trim(it.author) || anon || ANON;
var dm = ('' + (it.date || '')).match(/^(\d{4})-(\d{2})-(\d{2})/);
out.push({
tone: it.type === 'POSITIVE' ? 'good' : (it.type === 'NEGATIVE' ? 'bad' : 'mid'),
author: esc(author),
initials: esc(LC.util.initials(author)),
title: esc(title),
excerpt: esc(cut(open, MAX_EXCERPT)),
full: spoiler ? '' : esc(full),
parts: parts,
spoiler: spoiler,
date: dm ? dm[3] + '.' + dm[2] + '.' + dm[1] : '',
likes: parseInt(it.positiveRating, 10) || 0,
dislikes: parseInt(it.negativeRating, 10) || 0
});
});
return out;
}





function storage() {
try {
if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') return Lampa.Storage;
} catch (e) { }
return null;
}





function readIndex(store) {
var index = store.get(INDEX_KEY, []);
return Object.prototype.toString.call(index) === '[object Array]' ? index : [];
}









function drop(store, id) {
try { store.set(cacheKey(id), ''); } catch (e) { }
try {
if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(cacheKey(id));
} catch (e2) { }
}



function purge(store) {
try {
LC.util.each(readIndex(store), function (it) { if (it && it.id) drop(store, it.id); });
store.set(INDEX_KEY, []);
try {
if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(INDEX_KEY);
} catch (e2) { }
} catch (e) {
warn('reviews cache purge failed', e);
}
}









function stored(key, value) {
try {
if (typeof window === 'undefined' || !window.localStorage) return true;
var raw = window.localStorage.getItem(key);
if (raw === null || raw === '') return false;
var want;
try { want = JSON.stringify(value); } catch (e) { return true; }

return raw.length === want.length;
} catch (e2) {
return true;
}
}






function put(store, key, value) {
var failed = false;
try {
store.set(key, value, true, function (err) {
failed = true;
warn('reviews cache quota', err);
});
} catch (e) {
failed = true;
warn('reviews cache quota', e);
}
if (!failed && !stored(key, value)) {
failed = true;
warn('reviews cache not stored: ' + key);
}
if (failed) purge(store);
return !failed;
}










var TONES = { good: 1, bad: 1, mid: 1 };
var CACHE_DATE = /^\d{2}\.\d{2}\.\d{4}$/;

function cachedText(v) {
if (v === null || typeof v === 'undefined') return '';
var s = '' + v;
return /[<>"']/.test(s) ? esc(s) : s;
}

function cachedItem(it) {
if (!it || typeof it !== 'object') return null;
var parts = [];
if (Object.prototype.toString.call(it.parts) === '[object Array]') {
for (var i = 0; i < it.parts.length; i++) {
var p = it.parts[i];
if (p && typeof p === 'object') parts.push({ t: cachedText(p.t), s: !!p.s });
}
}
return {
tone: TONES.hasOwnProperty(it.tone) ? it.tone : 'mid',
author: cachedText(it.author),
initials: cachedText(it.initials),
title: cachedText(it.title),
excerpt: cachedText(it.excerpt),
full: cachedText(it.full),
parts: parts,
spoiler: !!it.spoiler,
date: CACHE_DATE.test('' + it.date) ? '' + it.date : '',
likes: parseInt(it.likes, 10) || 0,
dislikes: parseInt(it.dislikes, 10) || 0
};
}

function cachedList(list) {
var out = [];
if (Object.prototype.toString.call(list) !== '[object Array]') return out;
for (var i = 0; i < list.length; i++) {
var item = cachedItem(list[i]);
if (item) out.push(item);
}
return out;
}

function cacheRead(imdbId, at) {
try {
var store = storage();
if (!store || !imdbId) return null;
var rec = store.get(cacheKey(imdbId), null);
if (!isFresh(rec, at)) return null;
rec.list = cachedList(rec.list);



rec.total = parseInt(rec.total, 10) || 0;


rec.rate = parseFloat(rec.rate) || 0;
return rec;
} catch (e) {
warn('reviews cache read failed', e);
return null;
}
}

function cacheWrite(imdbId, list, total, at, kp, rate) {
try {
var store = storage();
if (!store || !imdbId) return;
var stamp = now(at);

var kept = [];
LC.util.each(readIndex(store), function (it) {
if (it && it.id && it.id !== imdbId) kept.push(it);
});
kept.push({ id: imdbId, at: stamp });



kept.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
while (kept.length > MAX_FILMS) drop(store, kept.shift().id);










if (!put(store, INDEX_KEY, kept)) return;
put(store, cacheKey(imdbId), { at: stamp, list: list, total: total, kp: kp || 0, rate: rate || 0 });
} catch (e) {
warn('reviews cache write failed', e);
}
}









function request(net, url, key, ok, err) {
net.timeout(TIMEOUT_MS);
net.silent(url, ok, err, false, {
headers: { 'X-API-KEY': key, 'accept': 'application/json' },
dataType: 'json',
timeout: TIMEOUT_MS
});
}











function load(imdbId, key, cb, alive, at, onRate) {
function dead() {
try { return typeof alive === 'function' && !alive(); } catch (e) { return false; }
}
try {
if (!key) { cb({ nokey: true }); return null; }
if (!imdbId) { cb(null); return null; }

var rec = cacheRead(imdbId, at);
if (rec) {


reportRate(rec.rate, onRate);
cb(rec.list && rec.list.length ? { list: rec.list, total: rec.total || rec.list.length } : null);
return null;
}

if (!window.Lampa || typeof Lampa.Reguest !== 'function') { cb(null); return null; }
var net = new Lampa.Reguest();

request(net, BASE + '?imdbId=' + encodeURIComponent(imdbId), key, function (found) {
if (dead()) return;
try {
var item = found && found.items && found.items[0];
var kp = item && item.kinopoiskId;


var rate = kpRateOf(item);
reportRate(rate, onRate);
if (!kp) { cb(null); return; }
request(net, BASE + '/' + kp + '/reviews?page=1&order=USER_POSITIVE_RATING_DESC', key, function (resp) {
if (dead()) return;
try {





var list = normalize(resp, anonWord()).slice(0, MAX_ITEMS);
if (!list.length) {



cacheWrite(imdbId, [], 0, at, kp, rate);
cb(null);
return;
}
var total = parseInt(resp && resp.total, 10) || list.length;
cacheWrite(imdbId, list, total, at, kp, rate);
cb({ list: list, total: total });
} catch (inner) {
warn('reviews parse failed', inner);
cb(null);
}
}, function () { if (!dead()) cb(null); });
} catch (e) {
warn('reviews search failed', e);
cb(null);
}
}, function () { if (!dead()) cb(null); });

return net;
} catch (e2) {
warn('reviews load failed', e2);
cb(null);
return null;
}
}





function lang(key) {
try {
if (typeof LC.lang === 'function') return LC.lang(key);
} catch (e) { }
return key;
}

function anonWord() {
var word = lang('lumen_card_anon');
return word === 'lumen_card_anon' ? ANON : word;
}

function toneLabel(tone) {
if (tone === 'good') return lang('lumen_card_review_good');
if (tone === 'bad') return lang('lumen_card_review_bad');
return lang('lumen_card_review_mid');
}

function totalWord(total) {
try {
if (typeof LC.reviewsWord === 'function') return LC.reviewsWord(total);
} catch (e) { }
return '';
}










function modeOf() {
var value = 'headlines';
try { if (LC.pref) value = LC.pref('lumen_reviews_mode', 'headlines'); } catch (e) { }
return value === 'full' ? 'full' : 'headlines';
}

function headHtml(total, mode) {
return '<div class="lumen-reviews__head">' +
'<span class="lumen-reviews__ico"></span>' +
'<span class="lumen-reviews__title">' + esc(lang('lumen_card_reviews_title')) + '</span>' +
'<span class="lumen-reviews__src">' + esc(lang('lumen_card_reviews_src')) + '</span>' +


'<span class="lumen-reviews__total">· ' + esc(String(total)) + ' ' + esc(totalWord(total)) + '</span>' +



'<div class="lumen-reviews__mode selector' + (mode === 'full' ? ' lumen-reviews__mode--on' : '') + '">' +
esc(lang('lumen_reviews_mode_toggle')) + '</div>' +
'</div>';
}















function metaHtml(item, prefix) {
var parts = [];
if (item.date) parts.push('<span class="' + prefix + '__date">' + item.date + '</span>');
parts.push('<span class="' + prefix + '__tag">' + esc(toneLabel(item.tone)) + '</span>');


if (item.likes) {
parts.push('<span class="' + prefix + '__likes">' + esc(String(item.likes)) +
'<span class="' + prefix + '__useful"> ' + esc(lang('lumen_card_review_useful')) + '</span></span>');
}
return parts.join('<span class="' + prefix + '__sep">\u00B7</span>');
}



function cardHtml(item, index, mode) {


var mark = item.spoiler ? '<div class="lumen-review__spoiler">' + esc(lang('lumen_reviews_spoiler')) + '</div>' : '';
var text = mode === 'full' ? '<div class="lumen-review__text">' + item.excerpt + '</div>' : '';









return '<div class="lumen-review selector lumen-review--' + item.tone + (item.spoiler ? ' lumen-review--spoiler' : '') + '" data-lumen-review="' + index + '">' +
'<div class="lumen-review__tone"></div>' +
'<div class="lumen-review__body">' +
'<div class="lumen-review__top">' +
'<div class="lumen-review__who">' +
'<div class="lumen-review__author">' + item.author + '</div>' +
'<div class="lumen-review__meta">' + metaHtml(item, 'lumen-review') + '</div>' +
'</div>' +
'</div>' +
'<div class="lumen-review__title">' + item.title + '</div>' +
text +
mark +
'</div>' +
'</div>';
}





function textHtml(item) {
var parts = item && item.parts;
if (!parts || !parts.length) return item.full || '';
var out = '';
for (var i = 0; i < parts.length; i++) {
var seg = parts[i];
out += seg.s ? '<span class="lumen-spoiler">' + seg.t + '</span>' : seg.t;
}
return out;
}

function hasParts(item) {
return !!(item && item.parts && item.parts.length);
}

function spoilerInParts(item) {
if (!hasParts(item)) return false;
for (var i = 0; i < item.parts.length; i++) if (item.parts[i].s) return true;
return false;
}

function modalHtml(item) {
return '<div class="lumen-review-modal__tone"></div>' +
'<div class="lumen-review-modal__body">' +
'<div class="lumen-review-modal__top">' +
'<div class="lumen-review-modal__ava">' + item.initials + '</div>' +
'<div class="lumen-review-modal__who">' +
'<div class="lumen-review-modal__author">' + item.author + '</div>' +
'<div class="lumen-review-modal__meta">' + metaHtml(item, 'lumen-review-modal') + '</div>' +
'</div>' +
'<div class="lumen-review-modal__src">' + esc(lang('lumen_card_reviews_src')) + '</div>' +
'</div>' +
'<div class="lumen-review-modal__line"></div>' +
'<div class="lumen-review-modal__title">' + item.title + '</div>' +
'<div class="lumen-review-modal__text">' + textHtml(item) + '</div>' +
(spoilerInParts(item) ? '<div class="lumen-review-modal__reveal selector">' + esc(lang('lumen_reviews_reveal')) + '</div>' : '') +
'</div>';
}






function hintHtml() {
return '<div class="lumen-reviews__hint">' +
'<div class="lumen-reviews__hint-ico"></div>' +
'<div class="lumen-reviews__hint-title">' + esc(lang('lumen_card_reviews_nokey_title')) + '</div>' +
'<div class="lumen-reviews__hint-text">' + esc(lang('lumen_card_reviews_nokey_text')) + '</div>' +
'<div class="lumen-reviews__hint-path">' + esc(lang('lumen_card_reviews_nokey_path')) + '</div>' +
'<div class="lumen-reviews__hint-hide selector">' + esc(lang('lumen_kp_hint_hide')) + '</div>' +
'</div>';
}




function hintEnabled() {
try { return LC.pref ? !!LC.pref('lumen_kp_hint', true) : true; } catch (e) { return true; }
}

















function openModal(item, card) {
try {
if (!item || !window.Lampa || !Lampa.Modal || typeof Lampa.Modal.open !== 'function') return;
var back = 'full_descr';
try {
var enabled = Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
if (enabled && enabled.name) back = enabled.name;
} catch (e) { }

var html = $('<div class="lumen-review-modal lumen-review-modal--' + item.tone + '"></div>');
html.html(modalHtml(item));
bindReveal(html);

Lampa.Modal.open({
title: '',
html: html,
size: 'medium',
onBack: function () {
try { Lampa.Modal.close(); } catch (e2) { }
try { Lampa.Controller.toggle(back); } catch (e3) { }
try {
if (card && card.length && typeof Lampa.Controller.collectionFocus === 'function') {
Lampa.Controller.collectionFocus(card, card.closest('.items-line'));
}
} catch (e4) { }
}
});
} catch (err) {
warn('reviews modal failed', err);
}
}







function bindReveal(html) {
try {
var el = html && html[0];
if (!el || typeof el.addEventListener !== 'function') return;
el.addEventListener('hover:enter', function (event) {
try {
var btn = $(event.target).closest('.lumen-review-modal__reveal');
if (!btn || !btn.length) return;
var open = !html.hasClass('lumen-review-modal--open');
html.toggleClass('lumen-review-modal--open', open);
btn.text(lang(open ? 'lumen_reviews_hide' : 'lumen_reviews_reveal'));
} catch (e) {
warn('reviews reveal failed', e);
}
}, true);
} catch (err) {
warn('reviews reveal bind failed', err);
}
}





function holderOf(row) {
if (!row || !row.length || typeof row.find !== 'function') return null;
var holder = row.find('.full-descr');
return holder && holder.length ? holder : null;
}

function stateOf(holder) {
var node = holder[0];
if (!node.lumenReviews) node.lumenReviews = { sign: '', gen: 0, painted: false, net: null };
return node.lumenReviews;
}









function isForeground(node) {
try {
if (LC.slideshow && typeof LC.slideshow.isMounted === 'function' && !LC.slideshow.isMounted(node[0])) return false;
} catch (e) { }
return LC.util.onScreen(node);
}

function clearBlock(holder) {
try {
var old = holder.find('.lumen-reviews');
if (old && old.length) old.remove();
} catch (e) { }
}











function fitTail(block, box, cards, origin) {
var max = box.scrollWidth - box.clientWidth;
var tail = block.find('.lumen-reviews__tail');
var node = tail && tail.length ? tail[0] : null;
if (!node || !node.style) return max;
var cur = parseFloat(node.style.width) || 0;
var base = max - cur;
var want = 0;
if (base > 0.5) {
for (var i = 0; i < cards.length; i++) {
var c = cards[i];
if (!c || typeof c.offsetLeft !== 'number') continue;
var edge = c.offsetLeft - origin;
if (edge >= base - 0.5) {
want = Math.max(0, edge - base);
break;
}
}
}
if (Math.abs(want - cur) > 0.5) node.style.width = Math.round(want) + 'px';
return base + want;
}













function scrollToCard(block, card) {
try {
var row = block.find('.lumen-reviews__row');
if (!row || !row.length || !card || !card.length) return;
var box = row[0];
var node = card[0];
if (!box || !node || typeof node.offsetLeft !== 'number') return;
var cards = block.find('.lumen-review');
var first = cards && cards.length ? cards[0] : node;
var origin = first && typeof first.offsetLeft === 'number' ? first.offsetLeft : node.offsetLeft;
var target = node.offsetLeft - origin;
var max = fitTail(block, box, cards || [], origin);
if (target > max) target = max;
if (target < 0) target = 0;
var motion = 'full';
try { motion = LC.motionMode(); } catch (e) { }
if (motion === 'full' && typeof row.animate === 'function') row.stop().animate({ scrollLeft: target }, 250);
else box.scrollLeft = target;
} catch (err) {
warn('reviews scroll failed', err);
}
}








function switchMode() {
try {
var next = modeOf() === 'full' ? 'headlines' : 'full';
if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.set === 'function') Lampa.Storage.set('lumen_reviews_mode', next);
var cur = window.Lampa && Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
if (cur && cur.name && typeof Lampa.Controller.toggle === 'function') Lampa.Controller.toggle(cur.name);
} catch (e) {
warn('reviews mode switch failed', e);
}
}





function bind(block, list) {
try {
var el = block[0];
if (!el || typeof el.addEventListener !== 'function' || el.lumenReviewsBound) return;
el.lumenReviewsBound = true;

function cardOf(target) {
try {
var $card = $(target).closest('.lumen-review');
return $card && $card.length ? $card : null;
} catch (e) { return null; }
}










LC.focus.capture(el, function (event) {
try {
var card = cardOf(event.target);
if (card && LC.focus.remote(event)) scrollToCard(block, card);
} catch (e) { warn('reviews focus failed', e); }
});







var onWheel = function (event) {
try {
if (!event || typeof event.clientX !== 'number') return;
var row = block.find('.lumen-reviews__row');
var box = row && row.length ? row[0] : null;
if (!box || typeof box.getBoundingClientRect !== 'function') return;
var left = box.getBoundingClientRect().left;
var screen = window.innerWidth || 0;
if (!(event.clientX - left > (screen - left) / 2)) return;
if (event.stopPropagation) event.stopPropagation();
if (event.cancelable && event.preventDefault) event.preventDefault();
var now = Date.now();
if (now - (box.lumenWheelAt || 0) < 200) return;
box.lumenWheelAt = now;
var forward = (typeof event.deltaY === 'number' && event.deltaY) ? event.deltaY > 0 : (Number(event.wheelDelta) || 0) < 0;
var from = box.scrollLeft || 0;
var view = box.clientWidth || 0;
var cards = block.find('.lumen-review');
var target = null;
for (var i = 0; i < cards.length; i++) {
var c = cards[i];
if (!c || typeof c.offsetLeft !== 'number') continue;
if (forward) {
if (c.offsetLeft + c.offsetWidth > from + view + 0.5) { target = c; break; }
} else if (c.offsetLeft < from - 0.5) {
target = c;
}
}
if (target) scrollToCard(block, $(target));
} catch (e) { warn('reviews wheel failed', e); }
};
el.addEventListener('wheel', onWheel);
el.addEventListener('mousewheel', onWheel);

el.addEventListener('hover:enter', function (event) {
try {


var toggle = $(event.target).closest('.lumen-reviews__mode');
if (toggle && toggle.length) { switchMode(); return; }
var card = cardOf(event.target);
if (!card) return;
var index = parseInt(card.attr('data-lumen-review'), 10);
if (isNaN(index)) return;
openModal(list[index], card);
} catch (e) { warn('reviews enter failed', e); }
}, true);
} catch (err) {
warn('reviews bind failed', err);
}
}





function appendSelectors(block) {
try {
if (!window.Lampa || !Lampa.Controller || typeof Lampa.Controller.collectionAppend !== 'function') return;
var enabled = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
if (!enabled || enabled.name !== 'full_descr') return;



if (!isForeground(block)) return;
var nodes = block.find('.lumen-review');
if (nodes && nodes.length) Lampa.Controller.collectionAppend(nodes);
} catch (e) {
warn('reviews collection failed', e);
}
}

function paintList(holder, list, total) {
var mode = modeOf();
var block = $('<div class="lumen-reviews' + (mode === 'full' ? '' : ' lumen-reviews--headlines') + '"></div>');
var cards = [];
LC.util.each(list, function (item, i) { cards.push(cardHtml(item, i, mode)); });

block.html(headHtml(total, mode) + '<div class="lumen-reviews__row">' + cards.join('') + '<div class="lumen-reviews__tail"></div></div>');
holder.append(block);
bind(block, list);
appendSelectors(block);
}








function paintSkeleton(holder) {
var block = $('<div class="lumen-reviews lumen-reviews--sk"></div>');
block.html('<div class="lumen-reviews__row">' +
'<div class="lumen-review lumen-review--sk lumen-skeleton"></div>' +
'<div class="lumen-review lumen-review--sk lumen-skeleton"></div>' +
'<div class="lumen-review lumen-review--sk lumen-skeleton"></div>' +
'</div>');
holder.append(block);
}

function paintHint(holder) {
if (!hintEnabled()) return;
var block = $('<div class="lumen-reviews lumen-reviews--hint"></div>');
block.html(hintHtml());
holder.append(block);
bindHint(block);
appendHintSelector(block);
}




function bindHint(block) {
try {
var el = block[0];
if (!el || typeof el.addEventListener !== 'function' || el.lumenHintBound) return;
el.lumenHintBound = true;
el.addEventListener('hover:enter', function (event) {
try {
var btn = $(event.target).closest('.lumen-reviews__hint-hide');
if (!btn || !btn.length) return;



Lampa.Storage.set('lumen_kp_hint', 'false');



var cur = Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
if (cur && cur.name && typeof Lampa.Controller.toggle === 'function') Lampa.Controller.toggle(cur.name);
} catch (e) {
warn('kp hint hide failed', e);
}
}, true);
} catch (err) {
warn('reviews hint bind failed', err);
}
}



function appendHintSelector(block) {
try {
if (!window.Lampa || !Lampa.Controller || typeof Lampa.Controller.collectionAppend !== 'function') return;
var enabled = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
if (!enabled || enabled.name !== 'full_descr') return;
if (!isForeground(block)) return;
var nodes = block.find('.lumen-reviews__hint-hide');
if (nodes && nodes.length) Lampa.Controller.collectionAppend(nodes);
} catch (e) {
warn('reviews hint collection failed', e);
}
}







function render(row, data) {
try {
var holder = holderOf(row);
if (!holder) return;
row.addClass('lumen-descr-row');

var movie = (data && data.movie) || {};
var imdb = movie.imdb_id || (movie.external_ids || {}).imdb_id || '';
var key = trim(LC.pref('lumen_kp_key', ''));
var on = LC.pref('lumen_reviews', true);







var sign = [on ? '1' : '0', imdb, keyStamp(key), lang('lumen_card_reviews_title'), hintEnabled() ? 'h1' : 'h0', modeOf()].join('|');

var state = stateOf(holder);
if (state.sign === sign && (!state.painted || holder.find('.lumen-reviews').length)) return;

state.sign = sign;
state.gen++;
state.painted = false;
var gen = state.gen;



dropNet(state);
clearBlock(holder);


row.removeClass('lumen-descr-row--reviews');

if (!on) return;
if (!key) { paintHint(holder); state.painted = true; return; }
if (!imdb) return;



paintSkeleton(holder);

state.net = load(imdb, key, function (res) {
try {
var current = stateOf(holder);
if (current.gen !== gen) return;
clearBlock(holder);
if (!res) return;
if (res.nokey) { paintHint(holder); current.painted = true; return; }
paintList(holder, res.list, res.total);



row.addClass('lumen-descr-row--reviews');
current.painted = true;
} catch (e) {
warn('reviews paint failed', e);
}
}, function () { return stateOf(holder).gen === gen; }, undefined, function (rate) {





if (stateOf(holder).gen !== gen) return;
if (!isForeground(holder)) return;
if (typeof LC.applyKpRate === 'function') LC.applyKpRate(rate, row);
});
} catch (err) {
warn('reviews render failed', err);
}
}




function dropNet(state) {
if (!state) return;
if (state.net && typeof state.net.clear === 'function') {
try { state.net.clear(); } catch (e) { }
}
state.net = null;
}


function clearRow(row) {
try {
var holder = holderOf(row);
if (!holder) return;
clearBlock(holder);
row.removeClass('lumen-descr-row--reviews');
var state = stateOf(holder);
state.sign = '';
state.painted = false;
state.gen++;


dropNet(state);
} catch (e) {
warn('reviews clear failed', e);
}
}




function cancel(body) {
try {
if (!body || typeof body.find !== 'function') return;
var holder = body.find('.full-descr');
if (!holder || !holder.length) return;
var node = holder[0];
if (node && node.lumenReviews) dropNet(node.lumenReviews);
} catch (e) {
warn('reviews cancel failed', e);
}
}

return {
TTL: TTL,
cacheKey: cacheKey,
isFresh: isFresh,
normalize: normalize,
splitSpoilers: splitSpoilers,
kpRateOf: kpRateOf,
cacheRead: cacheRead,
cacheWrite: cacheWrite,
load: load,
render: render,
clearRow: clearRow,
cancel: cancel,
openModal: openModal
};
})();





if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.reviews;


/* ---- 62_badges.js ---- */

















































LC.badges = (function () {


var NEW_DAYS = 30;

var PROGRESS_MIN = 5;
var PROGRESS_MAX = 95;

function releaseDate(card) {
if (!card) return '';
return card.release_date || card.first_air_date || '';
}









function badgeFor(card, today, ctx) {
if (!card) return null;
ctx = ctx || {};
var words = ctx.words || {};

if (card.lumen_badge) return { kind: 'custom', text: '' + card.lumen_badge, percent: 0 };

var percent = null;
if (typeof ctx.progress === 'function') percent = Number(ctx.progress(card));
if (percent !== null && !isNaN(percent) && percent >= PROGRESS_MIN && percent <= PROGRESS_MAX) {
var whole = Math.round(percent);










return { kind: 'progress', text: whole + ' %', percent: whole };
}

var ymd = releaseDate(card);
var days = LC.util.daysUntil(ymd, today);
if (days === null) return null;
if (days > 0) {
var when = LC.cardinfo.shortDate(ymd, words.months);
var soon = words.soon || '';
return { kind: 'soon', text: when ? soon + ' · ' + when : soon, percent: 0 };
}
if (days >= -NEW_DAYS) return { kind: 'new', text: words.fresh || '', percent: 0 };
return null;
}






function countdown(ymd, today, words) {
if (!words) return null;
var days = LC.util.daysUntil(ymd, today);
if (days === null || days < 0) return null;
if (days === 0) return words.today || null;
var premiere = words.premiere || '';
if (days === 1) return premiere + ' ' + (words.tomorrow || '');
var word = words.daysWord ? words.daysWord(days) : '';
var date = LC.cardinfo.shortDate(ymd, words.months);
var head = premiere + ' ' + (words.inDays || '') + ' ' + days + ' ' + word;
return date ? head + ' · ' + date : head;
}






var state = null;









var mounted_mode = null;







function mode() {
try { return LC.badgesMode ? LC.badgesMode() : 'poster'; } catch (e) { return 'poster'; }
}

function enabled() {
return mode() !== 'off';
}










function captionHidden() {
try {
if (!state || !state.root || typeof state.root.hasClass !== 'function' || !state.root.hasClass('lumen-main')) return false;
if (LC.pref && LC.pref('lumen_hero_size', 'large') === 'compact') return false;
return !frameGone();
} catch (e) {
return false;
}
}







function frameGone() {
var at = typeof LC.heroOffRatio === 'function' ? Number(LC.heroOffRatio()) || 0 : 0;
if (!at) return false;
if (typeof window.matchMedia === 'function') {
return !!window.matchMedia('screen and (min-aspect-ratio:' + at + '/100)').matches;
}
var w = Number(window.innerWidth) || 0;
var h = Number(window.innerHeight) || 0;
return w > 0 && h > 0 && w / h >= at / 100;
}







function words() {
return {
soon: LC.lang('lumen_badge_soon'),
fresh: LC.lang('lumen_badge_new'),
months: ('' + LC.lang('lumen_card_months_short')).split(',')
};
}






function batch() {
return { today: new Date(), words: words() };
}




function progressOf(card) {
try {
if (!window.Lampa || !Lampa.Timeline || typeof Lampa.Timeline.view !== 'function') return null;
if (!Lampa.Utils || typeof Lampa.Utils.hash !== 'function') return null;
var key = card.original_title || card.original_name || card.title || card.name || '';
if (!key) return null;
var view = Lampa.Timeline.view(Lampa.Utils.hash(key));
var percent = view ? (Number(view.percent) || 0) : 0;
return percent > 0 ? percent : null;
} catch (e) {
return null;
}
}















function rate(el, data) {
var age = $(el).find('.card__age');
if (!age || !age.length || age[0].lumen_rated) return;
var vote = Number(data.vote_average);
if (!(vote >= 1)) return;
var was = '' + age.text();
age[0].lumen_rated = true;
age[0].lumen_age_was = was;
age.text((was ? was + ' · ' : '') + '★ ' + vote.toFixed(1));
}




function unrate(el) {
var age = $(el).find('.card__age');
if (!age || !age.length || !age[0].lumen_rated) return;
age.text('' + (age[0].lumen_age_was || ''));
age[0].lumen_rated = false;
age[0].lumen_age_was = '';
}
























function captionText(badge) {
if (badge.kind !== 'custom') return badge.text;
var cut = badge.text.indexOf(' · ');
return cut > 0 ? badge.text.slice(0, cut) : badge.text;
}



function caption(el, badge) {
var age = $(el).find('.card__age');



if (!age || !age.length) return false;
var was = '' + age.text();
var text = captionText(badge);
var box = $('<span class="lumen-badge-cap lumen-badge-cap--' + badge.kind + '"></span>');
box.text(was ? text + ' · ' : text);
age.prepend(box);
return true;
}


















function decorate(node, card, opts, shared) {
try {
if (!enabled()) return;
var el = node && node.length ? node[0] : node;
if (!el || el.lumen_badged) return;
var data = card || el.card_data;
if (!data) return;
el.lumen_badged = true;
var ctx = shared || batch();
var badge = badgeFor(data, ctx.today, { progress: progressOf, words: ctx.words });
var view = $(el).find('.card__view');
var hasBadge = !!(badge && badge.text && view && view.length);
var view_mode = mode();



if (view_mode === 'caption' && !(opts && opts.wide) && captionHidden()) view_mode = 'poster';


var wantCaption = hasBadge && view_mode === 'caption';




































































if (!wantCaption || (opts && opts.wide)) rate(el, data);
var inCaption = wantCaption && caption(el, badge);
if (!hasBadge) return;
if (!inCaption && view_mode !== 'caption') {
var box = $('<div class="lumen-badge lumen-badge--' + badge.kind + '"></div>');
box.text(badge.text);
view.append(box);
}



var wantBar = !opts || opts.bar !== false;
if (wantBar && badge.kind === 'progress' && badge.percent > 0) {
var bar = $('<div class="lumen-badge-bar"><div></div></div>');
bar.find('div').css('width', badge.percent + '%');
view.append(bar);
}
} catch (e) {
warn('badges: decorate failed', e);
}
}



function scan(root) {
try {
var nodes = root.find('.card');
var shared = nodes.length ? batch() : null;
for (var i = 0; i < nodes.length; i++) decorate(nodes[i], null, null, shared);
} catch (e) {
warn('badges: scan failed', e);
}
}


function decorateAdded(el, shared) {
if (!el || el.nodeType !== 1) return;
if (el.classList && el.classList.contains('card')) {
decorate(el, null, null, shared);
return;
}
if (typeof el.querySelectorAll !== 'function') return;
var inner = el.querySelectorAll('.card');
for (var i = 0; i < inner.length; i++) decorate(inner[i], null, null, shared);
}

function onMutations(records) {
if (!state) return;
try {
var shared = null;
for (var i = 0; i < records.length; i++) {
var added = records[i] && records[i].addedNodes;
if (!added || !added.length) continue;
if (!shared) shared = batch();
for (var k = 0; k < added.length; k++) decorateAdded(added[k], shared);
}
} catch (e) {
warn('badges: observer failed', e);
}
}

function observe(root) {
try {
if (!window.MutationObserver) return;
var obs = new MutationObserver(onMutations);
obs.observe(root[0], { childList: true, subtree: true });
state.observer = obs;
} catch (e) {
warn('badges: observe failed', e);
}
}



function mount(root) {
try {
if (!root || !root.length) return;
var want = mode();


if (state && state.root && state.root[0] === root[0] && mounted_mode === want) return;
unmount();



if (mounted_mode !== null && mounted_mode !== want) strip(root);
mounted_mode = want;
if (want === 'off') return;
state = { root: root, observer: null };
scan(root);
observe(root);
} catch (e) {
warn('badges: mount failed', e);
}
}



function unmount() {
if (!state) return;
var s = state;
state = null;
try {
if (s.observer) s.observer.disconnect();
} catch (e) {
warn('badges: disconnect failed', e);
}
}





function strip(root) {
try {
if (!root || !root.length) return;
root.find('.lumen-badge').remove();
root.find('.lumen-badge-bar').remove();



root.find('.lumen-badge-cap').remove();
var nodes = root.find('.card');
for (var i = 0; i < nodes.length; i++) {
nodes[i].lumen_badged = false;





unrate(nodes[i]);
}
} catch (e) {
warn('badges: strip failed', e);
}
}






function redraw(root) {
try {
if (!root || !root.length) return;
strip(root);
if (mode() === 'off') return;
scan(root);
} catch (e) {
warn('badges: redraw failed', e);
}
}

function ownedBy(render) {
if (!state || !state.root || !state.root.length) return false;
if (!render || !render.length) return false;
if (state.root[0] === render[0]) return true;
try {
var act = state.root.closest('.activity');
return !!(act && act.length && act[0] === render[0]);
} catch (e) {
return false;
}
}

function owns(render) {
return ownedBy(render);
}



function detach(render) {
if (!state) return;
if (!render || !render.length) { unmount(); return; }
if (ownedBy(render)) return;
unmount();
}

function active() {
return !!state;
}

function currentMain() {
try {
if (!window.Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return null;
var act = Lampa.Activity.active();
if (!act || act.component !== 'main') return null;
if (!act.activity || typeof act.activity.render !== 'function') return null;
return act.activity.render();
} catch (e) {
return null;
}
}



function mountCurrent() {
var root = currentMain();
if (root && root.length) mount(root);
}

function install() {
mountCurrent();
}

function uninstall() {
var root = state && state.root ? state.root : currentMain();
unmount();
if (root && root.length) strip(root);
}

return {
badgeFor: badgeFor,
countdown: countdown,
decorate: decorate,
mount: mount,
mountCurrent: mountCurrent,
unmount: unmount,
strip: strip,
redraw: redraw,
detach: detach,
owns: owns,
active: active,
install: install,
uninstall: uninstall
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.badges;


/* ---- 63_cardmenu.js ---- */



















































LC.cardmenu = (function () {






var PENDING_MS = 1500;


var OWN_CARD_CLASS = 'lumen-gcard';





function mediaOf(card) {
if (!card) return 'movie';
return (card.name || card.first_air_date) ? 'tv' : 'movie';
}






function watchKey(card) {
if (!card) return '';
return card.original_title || card.original_name || card.title || card.name || '';
}







function isCardMenu(active, actionTitle) {
if (!active || !active.items || typeof active.items.length !== 'number') return false;
if (!active.items.length) return false;
if (actionTitle && active.title !== actionTitle) return false;
var book = false;
var i;
for (i = 0; i < active.items.length; i++) {
var it = active.items[i];
if (!it) continue;

if (it.lumen) return false;
if (it.timeclear || it.timefull) return false;
if (it.where === 'book' && it.checkbox) book = true;
}
return book;
}














function extraItems(card, ctx) {
if (!card || !ctx || !ctx.words) return [];
var w = ctx.words;
var out = [];
out.push({ title: w.trailer, lumen: 'trailer' });
if (ctx.collection && ctx.collection.id) {
out.push({ title: w.franchise, subtitle: LC.util.esc(ctx.collection.name || ''), lumen: 'franchise' });
}
out.push({ title: w.similar, lumen: 'similar' });
if (mediaOf(card) === 'movie') {
if (ctx.watched) out.push({ title: w.unwatched, lumen: 'unwatched' });
else out.push({ title: w.watched, lumen: 'watched' });
}
if (ctx.thrown) out.push({ title: w.unhide, lumen: 'unhide' });
else out.push({ title: w.hide, lumen: 'hide' });
return out;
}





function videosParams(card) {
if (!card || !card.id) return null;
return { method: mediaOf(card), id: card.id };
}


function similarTarget(card) {
if (!card || !card.id) return null;
return {
url: mediaOf(card) + '/' + card.id + '/similar',
title: card.title || card.name || '',
component: 'category_full',
source: card.source || 'tmdb',
page: 1
};
}





var installed = false;

var pending = null;
var longHandler = null;
var preshowHandler = null;

function enabled() {
try { return LC.pref ? !!LC.pref('lumen_context_menu', true) : true; } catch (e) { return true; }
}

function words() {
return {
section: LC.lang('lumen_menu_section'),
trailer: LC.lang('lumen_menu_trailer'),
franchise: LC.lang('lumen_menu_franchise'),
similar: LC.lang('lumen_menu_similar'),
watched: LC.lang('lumen_menu_watched'),
unwatched: LC.lang('lumen_menu_unwatched'),
hide: LC.lang('lumen_menu_hide'),
unhide: LC.lang('lumen_menu_unhide')
};
}

function noty(key) {
try {
if (window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(LC.lang(key));
} catch (e) {
warn('cardmenu: noty failed', e);
}
}

function hashOf(key) {
try {
if (!key || !window.Lampa || !Lampa.Utils || typeof Lampa.Utils.hash !== 'function') return 0;
return Lampa.Utils.hash(key);
} catch (e) {
return 0;
}
}


function isWatched(card) {
try {
var hash = hashOf(watchKey(card));
if (!hash || !window.Lampa || !Lampa.Timeline || typeof Lampa.Timeline.view !== 'function') return false;
var view = Lampa.Timeline.view(hash);
return !!(view && Number(view.percent) >= 95);
} catch (e) {
return false;
}
}

function isThrown(card) {
try {
if (!window.Lampa || !Lampa.Favorite || typeof Lampa.Favorite.check !== 'function') return false;
return !!(Lampa.Favorite.check(card) || {}).thrown;
} catch (e) {
return false;
}
}






function collectionOf(card) {
try {
if (!card) return null;
if (card.belongs_to_collection) return card.belongs_to_collection;
if (LC.hero && typeof LC.hero.details === 'function') {
var details = LC.hero.details(card.id);
if (details && details.belongs_to_collection) return details.belongs_to_collection;
}
} catch (e) {
warn('cardmenu: collection lookup failed', e);
}
return null;
}

function context(card) {
return {
words: words(),
collection: collectionOf(card),
watched: isWatched(card),
thrown: isThrown(card)
};
}




















function playTrailer(card) {
var ticket = { seq: ++trailerReq, at: Date.now(), activity: currentActivity(), overlays: overlaysNow() };

function play(video) {
try {
var item = {
title: video.name || (card.title || card.name || ''),
id: video.key,
url: 'https://www.youtube.com/watch?v=' + video.key,
youtube: true
};
var android = false;
try { android = !!(window.Lampa && Lampa.Platform && Lampa.Platform.is('android')); } catch (ePlat) {}
var launch = '';



try { launch = (window.Lampa && Lampa.Storage && Lampa.Storage.field('player_launch_trailers')) || ''; } catch (eSt) {}
if (android && launch === 'youtube' && Lampa.Android && typeof Lampa.Android.openYoutube === 'function') {
Lampa.Android.openYoutube(item.id);
return;
}
if (Lampa.Player && typeof Lampa.Player.play === 'function') {
Lampa.Player.play(item);
return;
}
noty('lumen_menu_no_trailer');
} catch (e) {
warn('cardmenu: trailer play failed', e);
noty('lumen_menu_no_trailer');
}
}

var params = videosParams(card);
try {
if (!params || !window.Lampa || !Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb ||
typeof Lampa.Api.sources.tmdb.videos !== 'function') {
noty('lumen_menu_no_trailer');
return;
}
Lampa.Api.sources.tmdb.videos(params, function (json) {
var v = verdict(ticket);
if (!v) return;

trailerReq++;
if (v === 'late') { noty('lumen_menu_trailer_late'); return; }
var picked = LC.trailer && LC.trailer.pickTrailer ? LC.trailer.pickTrailer(json && json.results) : null;
if (picked && picked.key) play(picked);
else noty('lumen_menu_no_trailer');
});
} catch (e) {
warn('cardmenu: videos request failed', e);
noty('lumen_menu_no_trailer');
}
}



var trailerReq = 0;


var TRAILER_WAIT_MS = 8000;

function currentActivity() {
try {
if (window.Lampa && Lampa.Activity && typeof Lampa.Activity.active === 'function') return Lampa.Activity.active();
} catch (e) { }
return null;
}








































function overlaysNow() {
var out = LC.util.overlays();
try {
var list = document.body && document.body.classList;
if (list && list.contains('ambience--enable')) out.push('ambience--enable');
} catch (e) { }
return out;
}

function overlaysChanged(ticket) {
var now = overlaysNow();
var i;
for (i = 0; i < now.length; i++) {
if (ticket.overlays.indexOf(now[i]) === -1) return true;
}
for (i = 0; i < ticket.overlays.length; i++) {
if (now.indexOf(ticket.overlays[i]) === -1) return true;
}
return false;
}

function verdict(ticket) {
if (ticket.seq !== trailerReq) return '';
if (currentActivity() !== ticket.activity) return '';
if (LC.util.playerOpen() || overlaysChanged(ticket)) return '';
try {
var list = document.body && document.body.classList;
if (list && list.contains('menu--open')) return '';
} catch (e) { }
if (Date.now() - ticket.at > TRAILER_WAIT_MS) return 'late';
return 'play';
}

function openFranchise(card) {
try {
var collection = collectionOf(card);
if (!LC.hub || !LC.hub.franchiseItem || !LC.hub.openTarget) return;
var item = LC.hub.franchiseItem(collection);
if (!item) return;
Lampa.Activity.push(LC.hub.openTarget(item));
} catch (e) {
warn('cardmenu: franchise failed', e);
}
}

function openSimilar(card) {
try {
var target = similarTarget(card);
if (target) Lampa.Activity.push(target);
} catch (e) {
warn('cardmenu: similar failed', e);
}
}




function setWatched(card, on) {
try {
var hash = hashOf(watchKey(card));
if (!hash || !window.Lampa || !Lampa.Timeline || typeof Lampa.Timeline.update !== 'function') return;
Lampa.Timeline.update({ hash: hash, percent: on ? 100 : 0, time: 0, duration: 0 });
noty(on ? 'lumen_menu_marked' : 'lumen_menu_unmarked');
} catch (e) {
warn('cardmenu: watched failed', e);
}
}





function setThrown(card, on) {
try {
if (!window.Lampa || !Lampa.Favorite || typeof Lampa.Favorite.toggle !== 'function') return;
if (isThrown(card) === on) return;
Lampa.Favorite.toggle('thrown', card);
noty(on ? 'lumen_menu_hidden' : 'lumen_menu_unhidden');
} catch (e) {
warn('cardmenu: thrown failed', e);
}
}

function run(kind, card) {
if (!kind || !card) return;
if (kind === 'trailer') { playTrailer(card); return; }
if (kind === 'franchise') { openFranchise(card); return; }
if (kind === 'similar') { openSimilar(card); return; }
if (kind === 'watched') { setWatched(card, true); return; }
if (kind === 'unwatched') { setWatched(card, false); return; }
if (kind === 'hide') { setThrown(card, true); return; }
if (kind === 'unhide') { setThrown(card, false); return; }
}







function translate(key, fallback) {
try {
if (window.Lampa && Lampa.Lang && typeof Lampa.Lang.translate === 'function') {
var t = Lampa.Lang.translate(key);
if (t && t !== key) return t;
}
} catch (e) {}
return fallback || '';
}

function actionTitle() {
return translate('title_action', '');
}

function fresh() {
if (!pending) return null;
if (Date.now() - pending.at > PENDING_MS) { pending = null; return null; }
return pending;
}






function onPreshow(e) {
try {
if (!enabled()) return;
var active = e && e.active;
if (!active || active.lumen_own) return;
if (!isCardMenu(active, actionTitle())) return;
var hit = fresh();
if (!hit || !hit.card) return;
var card = hit.card;
var items = extraItems(card, context(card));
if (!items.length) return;
active.items = active.items.concat([{ title: words().section, separator: true }]).concat(decorate(items, card, active));
} catch (err) {
warn('cardmenu: preshow failed', err);
}
}

function decorate(items, card, active) {
var out = [];
for (var i = 0; i < items.length; i++) {
out.push(bind(items[i], card, active));
}
return out;
}









function bind(item, card, active) {
item.onSelect = function (element, node) {
try {
if (active && !active.onBeforeClose && typeof active.onSelect === 'function') active.onSelect(element || item, node);
} catch (e) {
warn('cardmenu: native onSelect failed', e);
}
run(item.lumen, card);
};
return item;
}









function favoriteItems(card) {
var out = [];
var names = ['book', 'like', 'wath', 'history'];
var status = {};
try {
if (window.Lampa && Lampa.Favorite && typeof Lampa.Favorite.check === 'function') status = Lampa.Favorite.check(card) || {};
} catch (e) {
warn('cardmenu: favorite check failed', e);
}
for (var i = 0; i < names.length; i++) {
out.push({
title: translate('title_' + names[i], names[i]),
where: names[i],
checkbox: true,
checked: !!status[names[i]]
});
}
return out;
}



function open(el, card) {
try {
if (!enabled() || !card) return;
if (!window.Lampa || !Lampa.Select || typeof Lampa.Select.show !== 'function') return;
var back = 'content';
try { back = Lampa.Controller.enabled().name || 'content'; } catch (eCtrl) {}
var extra = extraItems(card, context(card));
var items = favoriteItems(card);
if (extra.length) items = items.concat([{ title: words().section, separator: true }]).concat(decorate(extra, card));
Lampa.Select.show({


lumen_own: true,
title: actionTitle() || words().section,
items: items,
onCheck: function (a) {
try {
if (a && a.where && Lampa.Favorite && typeof Lampa.Favorite.toggle === 'function') Lampa.Favorite.toggle(a.where, card);
} catch (eFav) {
warn('cardmenu: favorite toggle failed', eFav);
}
},
onBeforeClose: function () {
try { Lampa.Controller.toggle(back); } catch (eBack) {}
return true;
},
onBack: function () {
try { Lampa.Controller.toggle(back); } catch (eBack2) {}
}
});
} catch (e) {
warn('cardmenu: open failed', e);
}
}







function onLong(e) {
try {
var el = e && e.target;
if (!el || !el.card_data) { pending = null; return; }
pending = { el: el, card: el.card_data, at: Date.now() };
if (el.classList && el.classList.contains(OWN_CARD_CLASS)) open(el, el.card_data);
} catch (err) {
warn('cardmenu: long failed', err);
}
}

function install() {
if (installed) return;
if (!enabled()) return;
try {
if (typeof document === 'undefined' || !document.addEventListener) return;
if (!window.Lampa || !Lampa.Select || !Lampa.Select.listener) {
warn('cardmenu: Lampa.Select.listener not found');
return;
}
longHandler = onLong;
preshowHandler = onPreshow;
document.addEventListener('hover:long', longHandler, true);
Lampa.Select.listener.follow('preshow', preshowHandler);
installed = true;
} catch (e) {
warn('cardmenu: install failed', e);
}
}

function uninstall() {
if (!installed) return;
installed = false;
pending = null;
try {
if (longHandler) document.removeEventListener('hover:long', longHandler, true);
} catch (e) {
warn('cardmenu: remove listener failed', e);
}
try {
if (preshowHandler && window.Lampa && Lampa.Select && Lampa.Select.listener && typeof Lampa.Select.listener.remove === 'function') {
Lampa.Select.listener.remove('preshow', preshowHandler);
}
} catch (e2) {
warn('cardmenu: unfollow failed', e2);
}
longHandler = null;
preshowHandler = null;
}

function active() {
return installed;
}

return {
mediaOf: mediaOf,
watchKey: watchKey,
isCardMenu: isCardMenu,
extraItems: extraItems,
videosParams: videosParams,
similarTarget: similarTarget,
install: install,
uninstall: uninstall,
open: open,
active: active,


playTrailer: playTrailer
};
})();



if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.cardmenu;


/* ---- 64_menus.js ---- */







































LC.menus = (function () {
var MARK_SELECT = 'lumen-select';
var MARK_MODAL = 'lumen-modal';
var KIND_ATTR = 'data-lumen-kind';
var MODES = ['all', 'path', 'off'];



var current = 'off';
var installed = false;
var labels = { source: '', action: '' };

function hasFlag(items, names) {
var i, j;
for (i = 0; i < items.length; i++) {
for (j = 0; j < names.length; j++) {
if (items[i] && items[i][names[j]]) return true;
}
}
return false;
}






function kind(active, component, t) {
if (!active) return null;
var items = active.items || [];
if (t && active.title === t.source && hasFlag(items, ['btn'])) return 'source';
if (t && active.title === t.action) {
if (hasFlag(items, ['tomy', 'mark', 'unmark'])) return 'torrent';
if (hasFlag(items, ['timeclear', 'timefull'])) return 'file';
}
if (component === 'torrents') return 'filter';
return null;
}


function isPathModal(root) {
if (!root || !root.length || typeof root.find !== 'function') return false;
return !!(root.find('.modal-loading').length || root.find('.torrent-install').length);
}

function normalize(v) {
for (var i = 0; i < MODES.length; i++) if (v === MODES[i]) return v;
return 'all';
}

function unmarkSelect(root) {
if (root && root.length) root.removeClass(MARK_SELECT).removeAttr(KIND_ATTR);
}





function mode(v) {
current = normalize(v);
var body = $('body');
for (var i = 0; i < MODES.length; i++) body.removeClass('lumen-menus-' + MODES[i]);
if (current !== 'off') {
body.addClass('lumen-menus-' + current);
} else {
unmarkSelect($('.selectbox'));
$('.modal').removeClass(MARK_MODAL);
}
return current;
}





var FILTER_FLAGS = ['sort', 'stype', 'reset', 'global_search', 'query'];















function pathComponent(root, items) {
var act = Lampa.Activity.active();
var component = (act && act.component) || '';
if (component !== 'torrents') return component;
if (hasFlag(items, FILTER_FLAGS)) return component;
var enabled = Lampa.Controller.enabled();
var name = enabled ? '' + enabled.name : '';
if (name === 'content') return component;
if (name === 'select' && root.attr(KIND_ATTR) === 'filter') return component;
return '';
}




function selectKind(root, active) {
var k = kind(active, '', labels);
if (k || !active) return k;
var component = '';
try {
component = pathComponent(root, active.items || []);
} catch (err) {
warn('menus component failed', err);
}
return kind(active, component, labels);
}

function onSelectPreshow(e) {
try {
var root = $(Lampa.Select.render(true));
var k = current === 'off' ? null : selectKind(root, e && e.active);
if (k) root.addClass(MARK_SELECT).attr(KIND_ATTR, k);
else unmarkSelect(root);
} catch (err) {
warn('menus select preshow failed', err);
}
}

function onModalFullshow(e) {
try {
if (!e || !e.html) return;
var root = $(e.html);
if (current !== 'off' && isPathModal(root)) root.addClass(MARK_MODAL);
else root.removeClass(MARK_MODAL);
} catch (err) {
warn('menus modal fullshow failed', err);
}
}


function install() {
if (installed) return;
if (typeof Lampa === 'undefined' || !Lampa) {
warn('menus: Lampa not found');
return;
}
installed = true;
try {
labels = { source: Lampa.Lang.translate('settings_rest_source'), action: Lampa.Lang.translate('title_action') };
} catch (e) {
warn('menus: titles not translated, source/file/torrent menus will not be marked', e);
}
try {
if (Lampa.Select && Lampa.Select.listener) Lampa.Select.listener.follow('preshow', onSelectPreshow);
else warn('menus: Lampa.Select.listener not found');
} catch (e2) {
warn('menus select listener failed', e2);
}
try {
if (Lampa.Modal && Lampa.Modal.listener) Lampa.Modal.listener.follow('fullshow', onModalFullshow);
else warn('menus: Lampa.Modal.listener not found');
} catch (e3) {
warn('menus modal listener failed', e3);
}
}

return {
kind: kind,
mode: mode,
install: install,
isPathModal: isPathModal,
MARK_SELECT: MARK_SELECT,
MARK_MODAL: MARK_MODAL
};
})();



if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.menus;


/* ---- 64_nav.js ---- */




























































LC.nav = (function () {



var WINDOW = 7;
var FULL_LIST = 9;



var FAST_REPEATS = 6;
var FAST_WINDOW = 1200;





var FAST_GAP = 350;






var FAST_EXTRA = 1;


var JUMP_STEPS = 10;


var HOLD_MS = 500;
var HIDE_MS = 800;







var STALE_MS = 2000;

var JUMP_LIFE = 1200;



var SEARCH_LIMIT = 8;



var KEY_LEFT = [37, 4];
var KEY_RIGHT = [39, 5];
var KEY_UP = [38, 29460];
var KEY_DOWN = [40, 29461];
var KEY_PAGE_UP = [33, 427];
var KEY_PAGE_DOWN = [34, 428];

function esc(text) {
return LC.util.esc('' + (text == null ? '' : text));
}

function has(list, code) {
for (var i = 0; i < list.length; i++) if (list[i] === code) return true;
return false;
}














function holdTracker() {
var key = 0;
var holding = false;
var repeats = 0;
var since = 0;
var last = 0;
var fast = false;

function snapshot() {
return { key: key, holding: holding, repeats: repeats, since: since, fast: fast };
}

function reset() {
key = 0;
holding = false;
repeats = 0;
since = 0;
last = 0;
fast = false;
}

function start(code, t) {
key = code;
holding = true;
repeats = 1;
since = t;
last = t;
fast = false;
}

function feed(ev) {
if (!ev || !ev.type) return snapshot();
var code = Number(ev.key) || 0;
var t = Number(ev.t) || 0;
if (ev.type === 'up') {


if (holding && code && code !== key) return snapshot();
reset();
return snapshot();
}
if (ev.type !== 'down') return snapshot();
if (!holding || key !== code || (t - last) > FAST_GAP) {
start(code, t);
return snapshot();
}
repeats++;
last = t;
if (repeats >= FAST_REPEATS && (t - since) <= FAST_WINDOW) fast = true;
return snapshot();
}


function heldFor(t) {
if (!holding) return 0;
return Math.max(0, (Number(t) || 0) - since);
}

return { feed: feed, state: snapshot, reset: reset, heldFor: heldFor };
}









function minimapModel(titles, activeIndex, word) {
if (!titles || !titles.length) return null;
var total = titles.length;
var active = Math.floor(Number(activeIndex));
if (!(active >= 0) || active >= total) active = -1;
var name = word || 'Ряд';
var from = 0;
var to = total - 1;
if (total > FULL_LIST) {
var half = Math.floor(WINDOW / 2);
var center = active < 0 ? 0 : active;
from = Math.min(Math.max(0, center - half), total - WINDOW);
to = from + WINDOW - 1;
}
var items = [];
for (var i = from; i <= to; i++) {
var title = ('' + (titles[i] == null ? '' : titles[i])).replace(/^\s+|\s+$/g, '');
items.push({
index: i,
title: title || (name + ' ' + (i + 1)),
active: i === active
});
}
return { total: total, active: active, from: from, to: to, items: items };
}



function normalize(text) {
return ('' + (text == null ? '' : text))
.toLowerCase()
.replace(/ё/g, 'е')
.replace(/^\s+|\s+$/g, '');
}





function rankOf(title, id, query) {
if (title) {
var at = title.indexOf(query);
if (at === 0) return 0;
if (at > 0) {
var before = title.charAt(at - 1);
return /[0-9a-zа-я]/.test(before) ? 2 : 1;
}
}
if (id && id.indexOf(query) >= 0) return 3;
return -1;
}





function searchCollections(list, query) {
var q = normalize(query);
if (!list || !list.length || !q) return [];
var found = [];
for (var i = 0; i < list.length; i++) {
var item = list[i];
if (!item) continue;
var rank = rankOf(normalize(item.title), normalize(item.id), q);
if (rank < 0) continue;
found.push({ item: item, rank: rank, order: i });
}
found.sort(function (a, b) {
if (a.rank !== b.rank) return a.rank - b.rank;
return a.order - b.order;
});
var out = [];
for (var k = 0; k < found.length && out.length < SEARCH_LIMIT; k++) out.push(found[k].item);
return out;
}



function jumpLabel(index, total) {
var i = Math.floor(Number(index));
var n = Math.floor(Number(total));
if (!(n > 1)) return '';
if (!(i >= 0) || i >= n) return '';
return (i + 1) + ' / ' + n;
}





function minimapOn() {
try { return LC.pref('lumen_minimap', true) !== false; } catch (e) { return false; }
}

function fastOn() {
try { return LC.pref('lumen_fastscroll', true) !== false; } catch (e) { return false; }
}



function motionMode() {
try { return LC.motionMode(); } catch (e) { return 'full'; }
}

function lang(key) {
try { return LC.lang(key); } catch (e) { return ''; }
}

function keypad() {
try {
if (window.Lampa && Lampa.Keypad && Lampa.Keypad.listener) return Lampa.Keypad;
} catch (e) { }
return null;
}


function controllerName() {
try {
var c = Lampa.Controller.enabled();
return c && c.name ? c.name : '';
} catch (e) {
return '';
}
}






function onCards() {
var name = controllerName();
return name === 'content' || name === 'items_line';
}


function currentMain() {
try {
if (!window.Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return null;
var act = Lampa.Activity.active();
if (!act || act.component !== 'main') return null;
if (!act.activity || typeof act.activity.render !== 'function') return null;
return act.activity.render();
} catch (e) {
return null;
}
}

function move(dir) {
try {
if (window.Lampa && Lampa.Controller && typeof Lampa.Controller.move === 'function') {
Lampa.Controller.move(dir);
return true;
}
} catch (e) {
warn('nav: move failed', e);
}
return false;
}

function now() {
return Date.now();
}





var tracker = holdTracker();
var bound = null;
var panel = null;
var jumpNode = null;
var showTimer = null;
var hideTimer = null;
var staleTimer = null;
var paintTimer = null;
var jumpTimer = null;

function stopTimer(id) {
try { if (id) clearTimeout(id); } catch (e) { }
return null;
}












function readRows(root) {
var lines = $('.items-line', root);
var focus = $('.card.focus', root);
var focusNode = focus && focus.length ? focus[0] : null;
var titles = [];
var active = -1;
for (var i = 0; i < lines.length; i++) {
var head = $('.items-line__title', lines[i]);
titles.push(head && head.length ? head.eq(0).text() : '');
if (focusNode && lines[i].contains && lines[i].contains(focusNode)) active = i;
}
return { titles: titles, active: active };
}

function minimapHtml(model) {
var count = model.active >= 0
? (model.active + 1) + ' ' + lang('lumen_minimap_of') + ' ' + model.total
: '' + model.total;
var html = '<div class="lumen-minimap__head">' + esc(lang('lumen_minimap_rows')) + ' · ' + esc(count) + '</div>';
for (var i = 0; i < model.items.length; i++) {
var item = model.items[i];
html += '<div class="lumen-minimap__row' + (item.active ? ' lumen-minimap__row--on' : '') + '">' + esc(item.title) + '</div>';
}
return html;
}




function paintMinimap() {
if (!panel) return;
var root = currentMain();
if (!root || !root.length) { hideMinimap(); return; }
var rows = readRows(root);
var model = minimapModel(rows.titles, rows.active, lang('lumen_minimap_row'));
if (!model) { hideMinimap(); return; }
panel.html(minimapHtml(model));
}



function touchMinimap() {
staleTimer = stopTimer(staleTimer);
if (!panel) return;
staleTimer = setTimeout(function () {
staleTimer = null;
hideMinimap();
}, STALE_MS);
}

function showMinimap() {
if (panel) { paintMinimap(); return; }
var root = currentMain();
if (!root || !root.length) return;
try {
panel = $('<div class="lumen-minimap"></div>');
$('body').append(panel);
} catch (e) {
panel = null;
warn('nav: minimap show failed', e);
return;
}
paintMinimap();
touchMinimap();
}

function hideMinimap() {
staleTimer = stopTimer(staleTimer);
if (!panel) return;
var node = panel;
panel = null;
try { node.remove(); } catch (e) {
warn('nav: minimap remove failed', e);
}
}









function rowPosition() {
try {
var focus = $('.card.focus');
if (!focus || !focus.length) return null;
var box = focus.closest('.items-line');
if (!box || !box.length) box = focus.closest('.scroll__body');
if (!box || !box.length) return null;
var cards = $('.card', box[0]);
for (var i = 0; i < cards.length; i++) {
if (cards[i] === focus[0]) return { index: i, total: cards.length };
}
} catch (e) {
warn('nav: position failed', e);
}
return null;
}

function hideJump() {
jumpTimer = stopTimer(jumpTimer);
if (!jumpNode) return;
var node = jumpNode;
jumpNode = null;
try { node.remove(); } catch (e) {
warn('nav: jump remove failed', e);
}
}



function showJump() {
var pos = rowPosition();
var label = pos ? jumpLabel(pos.index, pos.total) : '';
if (!label) { hideJump(); return; }
try {
if (!jumpNode) {
jumpNode = $('<div class="lumen-jump"></div>');
$('body').append(jumpNode);
}
jumpNode.text(label);
} catch (e) {
jumpNode = null;
warn('nav: jump show failed', e);
return;
}
jumpTimer = stopTimer(jumpTimer);
jumpTimer = setTimeout(function () {
jumpTimer = null;
hideJump();
}, JUMP_LIFE);
}









function schedulePaint(withJump) {
if (paintTimer) return;
paintTimer = setTimeout(function () {
paintTimer = null;
if (panel) paintMinimap();
if (withJump) showJump();
}, 0);
}








function onVertical(state) {
if (!minimapOn()) return;
if (!onCards()) return;
if (!currentMain()) return;
hideTimer = stopTimer(hideTimer);
if (panel) { touchMinimap(); schedulePaint(false); return; }
if (showTimer) return;
showTimer = setTimeout(function () {
showTimer = null;

if (!tracker.state().holding) return;
showMinimap();
}, Math.max(0, HOLD_MS - (now() - state.since)));
}

function onHorizontal(state, dir) {
if (!state.fast) return;
if (!fastOn()) return;


if (motionMode() === 'off') return;
if (!onCards()) return;
for (var i = 0; i < FAST_EXTRA; i++) move(dir);
schedulePaint(true);
}

function onJump(dir) {
if (!fastOn()) return;
if (!onCards()) return;
for (var i = 0; i < JUMP_STEPS; i++) move(dir);
schedulePaint(true);
}

function handleDown(e) {
var code = e && e.code;
if (!code) return;


if (e.enabled === false) return;
var state = tracker.feed({ key: code, type: 'down', t: now() });
if (has(KEY_UP, code) || has(KEY_DOWN, code)) { onVertical(state); return; }
if (has(KEY_LEFT, code)) { onHorizontal(state, 'left'); return; }
if (has(KEY_RIGHT, code)) { onHorizontal(state, 'right'); return; }
if (has(KEY_PAGE_UP, code)) { onJump('left'); return; }
if (has(KEY_PAGE_DOWN, code)) onJump('right');
}

function handleUp(e) {
var code = e && e.code;
tracker.feed({ key: code, type: 'up', t: now() });
showTimer = stopTimer(showTimer);
if (!panel || hideTimer) return;
hideTimer = setTimeout(function () {
hideTimer = null;
hideMinimap();
}, HIDE_MS);
}

























function openSearch(opts) {
var o = opts || {};
var words = o.words || {};
function done() {
try { if (typeof o.onDone === 'function') o.onDone(); } catch (e) {
warn('nav: search done failed', e);
}
}
try {
if (!window.Lampa || !Lampa.Input || typeof Lampa.Input.edit !== 'function') return false;
Lampa.Input.edit({
free: true,
nosave: true,
value: '',
layout: 'search',
title: words.title || ''
}, function (query) {
var found = searchCollections(o.items, query);
if (!found.length) {
if (normalize(query)) {
try { Lampa.Noty.show(words.empty || ''); } catch (eN) { }
}
done();
return;
}



var items = [];
for (var i = 0; i < found.length; i++) {
items.push({ title: LC.util.esc(found[i].title || found[i].id), lumen_item: found[i] });
}
Lampa.Select.show({
title: words.results || '',
items: items,
onSelect: function (item) {
try { if (typeof o.onSelect === 'function') o.onSelect(item.lumen_item); } catch (eS) {
warn('nav: search select failed', eS);
}
},
onBack: done
});
});
return true;
} catch (err) {
warn('nav: search failed', err);
done();
return false;
}
}





function install() {
if (bound) return;
var kp = keypad();
if (!kp) return;
var handlers = { down: handleDown, up: handleUp };
try {
kp.listener.follow('keydown', handlers.down);
kp.listener.follow('keyup', handlers.up);
} catch (e) {
warn('nav: install failed', e);
return;
}
bound = handlers;
}












function detach() {
tracker.reset();
showTimer = stopTimer(showTimer);
hideTimer = stopTimer(hideTimer);
paintTimer = stopTimer(paintTimer);
hideJump();
hideMinimap();
}

function uninstall() {
var kp = keypad();
if (bound && kp) {
try {
kp.listener.remove('keydown', bound.down);
kp.listener.remove('keyup', bound.up);
} catch (e) {
warn('nav: uninstall failed', e);
}
}
bound = null;
detach();
}




function apply() {
if (minimapOn() || fastOn()) install();
else uninstall();
}

return {
holdTracker: holdTracker,
minimapModel: minimapModel,
searchCollections: searchCollections,
jumpLabel: jumpLabel,
openSearch: openSearch,
install: install,
uninstall: uninstall,
detach: detach,
apply: apply,
active: function () { return !!panel; }
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.nav;


/* ---- 65_torrents.js ---- */





































LC.torrents = (function () {
var STYLE_ID = 'lumen-torrents-css';
var BODY_ON = 'lumen-torrents-on';
var MARK = 'lumen-torrents';
var MARKS = { selectbox: LC.menus.MARK_SELECT, modal: LC.menus.MARK_MODAL };
var SUPPORTS_NO_MASK = LC.icons.NO_MASK + '{';
var installed = false;
var maskUse = null;
var lastText = null;


function marked(sel) {
return sel.replace(/^\.(selectbox|modal)(?![\w-])/, function (all, name) { return '.' + name + '.' + MARKS[name]; });
}

function scoped(sel) {
return 'body.lumen-menus-all ' + sel + ',' + marked(sel);
}


function scopedMotion(mode, sel) {
return 'body.lumen-motion-' + mode + '.lumen-menus-all ' + sel + ',body.lumen-motion-' + mode + ' ' + marked(sel);
}

function join(list, fn) {
var out = [];
for (var i = 0; i < list.length; i++) out.push(fn(list[i]));
return out.join(',');
}


function S(list) { return join(list, scoped); }
function SM(mode, list) { return join(list, function (s) { return scopedMotion(mode, s); }); }
function T(list) { return join(list, function (s) { return 'body.' + BODY_ON + ' ' + s; }); }
function TM(mode, list) { return join(list, function (s) { return 'body.' + BODY_ON + '.lumen-motion-' + mode + ' ' + s; }); }
function A(list) { return join(list, function (s) { return 'body.' + BODY_ON + ' .' + MARK + ' ' + s; }); }
function AM(mode, list) { return join(list, function (s) { return 'body.' + BODY_ON + '.lumen-motion-' + mode + ' .' + MARK + ' ' + s; }); }


function useMask(name, sel) {
if (!maskUse.by.hasOwnProperty(name)) {
maskUse.by[name] = [];
maskUse.order.push(name);
}
maskUse.by[name].push(sel);
}

function maskRules() {
var r = ['/* Маски иконок: data-URI один раз на иконку, repeat/position/size — одним правилом */'];
var all = [];
for (var i = 0; i < maskUse.order.length; i++) {
var name = maskUse.order[i];
var sel = maskUse.by[name].join(',');
var u = LC.icons.maskUrl(name);
all.push(sel);
r.push(sel + '{-webkit-mask-image:' + u + ';mask-image:' + u + '}');
}
r.push(all.join(',') + '{-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');
return r;
}


function selectRules(k) {
var r = [];
var check = ['.selectbox .selectbox-item--checked .selectbox-item__checkbox::after'];
var sortCheck = ['.selectbox .selectbox-item.selected:not(.nomark)::after', '.selectbox .selectbox-item.picked::after'];
r.push('/* 33 Источник · 35 Фильтр, Сортировать, Действие — панель Select (ширина штатная, 35 %) */');








r.push(S(['.selectbox .selectbox__content']) + '{background:' + k.panel + ';border-left:.044em solid ' + k.line + ';color:' + k.text + ';font-family:' + k.fontBody + ';-webkit-backdrop-filter:none;backdrop-filter:none}');
r.push(S(['.selectbox .selectbox__head']) + '{padding:2.805em 2.805em 1.052em 1.403em}');
r.push(S(['.selectbox .selectbox__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.227em;line-height:1.1}');








r.push(S(['.selectbox .selectbox-item']) + '{margin:0 2.805em .351em 1.403em;padding:.7em 1.4em;border-radius:.438em;color:' + k.text + ';will-change:auto;-webkit-transition:background-color .2s,color .2s,-webkit-transform .2s;transition:background-color .2s,color .2s,transform .2s}');
r.push(S(['.selectbox .selectbox-item__title']) + '{font-size:1.01em;font-weight:600;line-height:1.2}');
















r.push(S(['.selectbox .settings-param-title']) + '{margin:.776em 4.163em .258em 2.776em;padding:0;border:0;background:none;font-family:' + k.fontBody + ';font-size:1.01em;font-weight:700;line-height:1.2;letter-spacing:.059em;text-transform:uppercase;color:' + k.muted + '}');


r.push(S(['.selectbox .settings-param-title > span']) + '{color:' + k.muted + '}');
r.push(S(['.selectbox .selectbox-item__subtitle']) + '{font-size:1.01em;font-weight:400;line-height:1.2;margin-top:.174em;color:' + k.muted + ';opacity:1}');








r.push(S(['.selectbox .selectbox-item.focus']) + '{background-color:' + k.text + ';color:' + k.bg + ';-webkit-transform:scale(1.02);transform:scale(1.02)}');
r.push(S(['.selectbox .selectbox-item.focus .selectbox-item__subtitle']) + '{color:' + k.bg + ';opacity:.72}');









r.push(S(['.selectbox .selectbox-item__icon']) + '{margin-right:.701em;min-width:1.403em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
r.push(S(['.selectbox .selectbox-item__icon > svg:not([viewBox]):not([class]):not([width])']) + '{width:1.14em;height:1.14em}');





r.push(S(['.selectbox .selectbox-item--checkbox']) + '{padding-left:3.242em;padding-right:1.4em}');
r.push(S(['.selectbox .selectbox-item__checkbox']) + '{top:50%;right:auto;left:1.4em;width:1.227em;height:1.227em;margin-top:-.614em;border:.044em solid ' + k.line + ';border-radius:.307em;-webkit-box-sizing:border-box;box-sizing:border-box}');
r.push(S(['.selectbox .selectbox-item--checked .selectbox-item__checkbox']) + '{border-color:' + k.accent + '}');











r.push(S(['.selectbox .selectbox-item.focus .selectbox-item__checkbox']) + '{border-color:' + k.bg + ';-webkit-filter:none;filter:none}');
r.push(S(['.selectbox .selectbox-item--checked.focus .selectbox-item__checkbox']) + '{background-color:' + k.bg + '}');
r.push(S(check) + '{top:50%;left:50%;right:auto;width:.877em;height:.877em;margin:-.439em 0 0 -.439em;border:0;-webkit-transform:none;transform:none;color:' + k.accent + ';background-color:currentColor}');
useMask('check', S(check));




r.push(S(['.selectbox .selectbox-item.selected:not(.nomark)', '.selectbox .selectbox-item.picked']) + '{padding-right:3.329em}');
r.push(S(sortCheck) + '{top:50%;right:1.4em;width:.964em;height:.964em;margin-top:-.482em;border:0;-webkit-transform:none;transform:none;color:' + k.accent + ';background-color:currentColor}');
useMask('check', S(sortCheck));
r.push(S(['.selectbox .selectbox-item.selected.focus:not(.nomark)::after', '.selectbox .selectbox-item.picked.focus::after']) + '{color:' + k.bg + '}');

r.push(SUPPORTS_NO_MASK + S(check.concat(sortCheck)) + '{background-color:transparent;width:.3em;height:.6em;margin:-.4em 0 0 -.15em;border-right:.15em solid currentColor;border-bottom:.15em solid currentColor;-webkit-transform:rotate(45deg);transform:rotate(45deg)}}');

r.push(SM('lite', ['.selectbox .selectbox-item']) + '{-webkit-transition:background-color .2s,color .2s;transition:background-color .2s,color .2s}');
r.push(SM('off', ['.selectbox .selectbox-item']) + '{-webkit-transition:none;transition:none}');
r.push(SM('lite', ['.selectbox .selectbox-item.focus']) + ',' + SM('off', ['.selectbox .selectbox-item.focus']) + '{-webkit-transform:none;transform:none}');
return r;
}


function explorerRules(k) {
var r = [];
var chips = ['.torrent-filter .simple-button', '.empty__footer .simple-button', '.empty-filter__buttons .simple-button'];
var chipsFocus = [];
for (var i = 0; i < chips.length; i++) chipsFocus.push(chips[i] + '.focus');
r.push('/* 34 Торренты — Explorer, Filter, список раздач, пусто/ошибка */');
r.push(A(['.explorer']) + '{color:' + k.text + ';font-family:' + k.fontBody + '}');


r.push(A(['.explorer__left']) + '{width:25%}');
r.push(A(['.explorer__files']) + '{width:auto;min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 0%;flex:1 1 0%}');
r.push(A(['.explorer__card']) + '{padding-left:2.805em}');

r.push(A(['.explorer-card__head']) + '{-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-align:start;-webkit-align-items:flex-start;align-items:flex-start;margin-bottom:.614em}');
r.push(A(['.explorer-card__head-left']) + '{width:14.028em;max-width:100%;margin-right:0}');
r.push(A(['.explorer-card__head-img > img']) + '{border-radius:.438em;background-color:' + k.panel + '}');
r.push(A(['.explorer-card__head-img.focus::after']) + '{border-color:' + k.accent + ';border-width:.132em;border-radius:.7em}');
r.push(A(['.explorer-card__head-body']) + '{padding-top:.789em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
r.push(A(['.explorer-card__head-create']) + '{font-family:' + k.fontBody + ';font-size:1.01em;letter-spacing:.026em;color:' + k.muted + '}');
r.push(A(['.explorer-card__head-rate']) + '{margin:0 0 0 .614em;color:' + k.accent + '}');
r.push(A(['.explorer-card__head-rate > span']) + '{font-family:' + k.fontBody + ';font-size:1.1em;font-weight:600}');
r.push(A(['.explorer-card__head-rate > svg']) + '{display:none !important}');
r.push(A(['.explorer-card__head-rate:before']) + '{content:"";display:block;width:.964em;height:.964em;margin-right:.307em;background-color:currentColor}');
useMask('star', A(['.explorer-card__head-rate:before']));
r.push(A(['.explorer-card__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.666em;line-height:1.06;margin-bottom:.316em}');
r.push(A(['.explorer-card__title.small']) + '{font-size:1.227em}');
r.push(A(['.explorer-card__genres']) + '{font-family:' + k.fontBody + ';font-size:1.01em;color:' + k.smoke + ';margin-bottom:.695em}');
r.push(A(['.explorer-card__descr']) + '{font-size:1.01em;font-weight:400;line-height:1.45;color:' + k.muted + ';display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}');


r.push(A(['.explorer__files-head']) + '{padding:1.052em 2.805em 0 1.403em}');
r.push(A(chips) + '{font-size:1.01em;height:2.431em;padding:0 .868em;margin-right:.521em;border-radius:.521em;border:.043em solid ' + k.line + ';background-color:' + k.panel + ';color:' + k.muted + ';font-family:' + k.fontBody + ';font-weight:600;-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-transition:background-color .2s,color .2s,border-color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,color .2s,border-color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
r.push(A(['.torrent-filter .simple-button > span', '.empty__footer .simple-button > span']) + '{margin-top:0}');











r.push(A(chipsFocus) + '{background-color:' + k.text + ';color:' + k.bg + ';-webkit-transform:scale(1.06) !important;transform:scale(1.06) !important;-webkit-box-shadow:0 .23em 0 ' + k.acglow + ';box-shadow:0 .23em 0 ' + k.acglow + '}');

r.push(A(['.torrent-filter .filter--back']) + '{width:2.8em;padding:0;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
r.push(A(['.torrent-filter .filter--back > svg', '.torrent-filter .filter--search > svg']) + '{display:none}');
r.push(A(['.torrent-filter .filter--back:before', '.torrent-filter .filter--search:before']) + '{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.3em;height:1.3em;background-color:currentColor}');
r.push(A(['.torrent-filter .filter--back:before']) + '{-webkit-transform:scaleX(-1);transform:scaleX(-1)}');
useMask('chevronR', A(['.torrent-filter .filter--back:before']));
useMask('search', A(['.torrent-filter .filter--search:before']));
r.push(A(['.torrent-filter .filter--search > div', '.torrent-filter .filter--sort > div']) + '{margin-left:.594em;padding:0;border-radius:0;background:transparent;font-family:' + k.fontBody + ';font-size:1.01em;font-weight:400;color:' + k.smoke + '}');
r.push(A(['.torrent-filter .filter--search > div']) + '{padding-left:.6em;border-left:.05em solid ' + k.line + ';max-width:15em}');
r.push(A(['.torrent-filter .filter--search.focus > div', '.torrent-filter .filter--sort.focus > div']) + '{color:' + k.bg + ';border-left-color:' + k.bg + '}');


r.push(A(['.torrent-filter .filter--filter > div:not(.hide)']) + '{display:block;-webkit-flex-shrink:0;flex-shrink:0;font-size:1.01em;width:.495em;height:.495em;margin-left:.495em;padding:0;border-radius:50%;background-color:' + k.accent + ';overflow:hidden;white-space:nowrap;text-indent:1.98em;color:transparent}');
r.push(A(['.torrent-filter .filter--filter.focus > div:not(.hide)']) + '{background-color:' + k.bg + '}');


r.push(A(['.torrent-list']) + '{padding:0 2.805em 1.403em 1.403em}');
r.push(T(['.torrent-item']) + '{background-color:' + k.panel + ';border:.044em solid ' + k.line + ';border-radius:.438em;padding:.789em;line-height:1.2;color:' + k.text + ';font-family:' + k.fontBody + ';-webkit-transition:border-color .2s,background-color .2s;transition:border-color .2s,background-color .2s}');
r.push(T(['.torrent-item + .torrent-item']) + '{margin-top:.701em}');




r.push(T(['.torrent-item.focus']) + '{background-color:' + k.panelHi + ';border-color:' + k.accent + ';border-width:.132em;padding:.701em;-webkit-box-shadow:0 .2em 0 ' + k.acglow + ';box-shadow:0 .2em 0 ' + k.acglow + '}');
r.push(T(['.torrent-item.focus::after']) + '{border-color:transparent}');
r.push(T(['.torrent-item__title']) + '{font-size:1.052em;font-weight:600;line-height:1.2;word-break:normal;word-wrap:break-word;overflow-wrap:break-word;padding-right:6.667em}');
r.push(T(['.torrent-item__details']) + '{margin-top:.391em;font-size:1.01em;font-weight:400;color:' + k.muted + '}');
r.push(T(['.torrent-item__details > div']) + '{margin-right:0}');
r.push(T(['.torrent-item__tracker']) + '{-webkit-box-flex:0;-webkit-flex-grow:0;flex-grow:0}');
r.push(T(['.torrent-item__details > div + div:not(.torrent-item__size):before']) + '{content:"\\00B7";margin:0 .6em;color:' + k.smoke + '}');
r.push(T(['.torrent-item__bitrate > span', '.torrent-item__seeds > span', '.torrent-item__grabs > span']) + '{background:transparent;padding:0;min-width:0;border-radius:0;color:inherit}');

r.push(T(['.torrent-item__size']) + '{position:absolute;top:.891em;right:.891em;margin:0;padding:.347em .693em;border-radius:.347em;background-color:' + k.text + ';color:' + k.dark + ';font-size:1.01em;font-weight:600;line-height:1}');
r.push(T(['.torrent-item.focus .torrent-item__size']) + '{top:.8em;right:.8em}');

r.push(T(['.torrent-item__ffprobe']) + '{padding-top:.175em}');
r.push(T(['.torrent-item__ffprobe > div']) + '{font-size:1.01em;font-family:' + k.fontBody + ';font-weight:400;letter-spacing:.052em;line-height:1;color:' + k.text + ';background:transparent;border:.043em solid rgba(' + k.textRgb + ',.24);border-radius:.304em;padding:.304em .478em;margin:.347em .347em 0 0;-webkit-box-shadow:none;box-shadow:none;outline:0}');
r.push(T(['.torrent-item__ffprobe > div::before']) + '{width:.9em;height:.9em;margin-right:.4em}');
r.push(T(['.torrent-item__ffprobe > div.m-general > div:nth-child(1)', '.torrent-item__ffprobe > div.m-general > div:nth-child(2)']) + '{font-size:1.01em;padding:0;background:transparent;border-radius:0}');
r.push(T(['.torrent-item__ffprobe > div.m-general > div:nth-child(2)']) + '{padding-left:.4em}');

r.push(T(['.torrent-item__viewed']) + '{top:-.482em;left:-.482em;width:1.578em;height:1.578em;padding:0;border-radius:50%;background-color:' + k.accent + ';color:' + k.onac + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
r.push(T(['.torrent-item__viewed > svg']) + '{display:none}');
r.push(T(['.torrent-item__viewed:before']) + '{content:"";display:block;width:.964em;height:.964em;background-color:currentColor}');
useMask('check', T(['.torrent-item__viewed:before']));


r.push(A(['.watched-history']) + '{background-color:' + k.panelLo + ';border:.044em solid ' + k.line + ';border-radius:.438em;padding:.701em .789em;margin-bottom:.701em;color:' + k.muted + ';font-family:' + k.fontBody + ';-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-transition:border-color .2s;transition:border-color .2s}');
r.push(A(['.watched-history__icon']) + '{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;width:1.578em;height:1.578em;border-radius:.175em;border:.044em solid ' + k.accent + ';background-color:rgba(' + k.accentRgb + ',.16);color:' + k.accent + '}');
r.push(A(['.watched-history__icon > svg']) + '{width:.964em !important;height:.964em !important}');
r.push(A(['.watched-history__body']) + '{padding-left:.533em;font-size:1.01em;line-height:1.3}');
r.push(A(['.watched-history__body > span + span::before']) + '{color:' + k.smoke + '}');
r.push(A(['.watched-history.focus']) + '{color:' + k.text + ';border-color:' + k.accent + ';border-width:.132em;padding:.614em .701em;-webkit-box-shadow:0 .2em 0 ' + k.acglow + ';box-shadow:0 .2em 0 ' + k.acglow + '}');
r.push(A(['.watched-history.focus::after']) + '{border-color:transparent}');


r.push(A(['.empty', '.empty-filter']) + '{font-family:' + k.fontBody + ';color:' + k.text + '}');
r.push(A(['.empty__img']) + '{height:7.014em;margin-bottom:1.403em;opacity:.35}');
r.push(A(['.empty__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.227em;line-height:1.2}');
r.push(A(['.empty__descr']) + '{font-size:1.01em;line-height:1.45;margin-top:.521em;color:' + k.muted + '}');
r.push(A(['.empty__footer']) + '{margin-top:1.2em}');
r.push(A(['.empty-filter__title']) + '{font-size:1.1em;font-weight:600;line-height:1.2;margin-bottom:.263em}');
r.push(A(['.empty-filter__subtitle']) + '{font-size:1.01em;font-weight:400;line-height:1.25;margin-bottom:1.042em;color:' + k.muted + '}');
r.push(A(['.empty-template']) + '{background-color:' + k.panel + ';border:.044em solid ' + k.line + ';border-radius:.438em;padding:.701em}');
r.push(A(['.empty-template > *']) + '{background-color:rgba(' + k.textRgb + ',.06);border-radius:.307em}');


r.push(SUPPORTS_NO_MASK + A(['.explorer-card__head-rate > svg']) + '{display:block !important;width:.964em !important;height:.964em !important;margin-right:.307em}' +
A(['.torrent-filter .filter--back > svg', '.torrent-filter .filter--search > svg']) + '{display:block !important;width:1.3em;height:1.3em}' +
T(['.torrent-item__viewed > svg']) + '{display:block !important;width:.964em;height:.964em}' +
A(['.explorer-card__head-rate:before', '.torrent-filter .filter--back:before', '.torrent-filter .filter--search:before']) + ',' + T(['.torrent-item__viewed:before']) + '{display:none !important}}');


r.push(AM('lite', chipsFocus) + ',' + AM('off', chipsFocus) + '{-webkit-transform:none !important;transform:none !important}');
r.push(AM('lite', chips) + ',' + AM('off', chips) + ',' + TM('lite', ['.torrent-item']) + ',' + TM('off', ['.torrent-item']) + ',' + AM('lite', ['.explorer-card__head-img']) + ',' + AM('off', ['.explorer-card__head-img']) + '{-webkit-animation:none !important;animation:none !important}');
r.push(AM('lite', chips) + '{-webkit-transition:background-color .2s,color .2s,border-color .2s;transition:background-color .2s,color .2s,border-color .2s}');
r.push(TM('lite', ['.torrent-item']) + ',' + AM('lite', ['.watched-history']) + '{-webkit-transition:border-color .2s,background-color .2s;transition:border-color .2s,background-color .2s}');
r.push(AM('off', chips) + ',' + TM('off', ['.torrent-item']) + ',' + AM('off', ['.watched-history']) + '{-webkit-transition:none;transition:none}');
return r;
}


function modalRules(k) {
var r = [];
var btn = ['.torrent-checklist__footer .simple-button'];
var btnFocus = ['.torrent-checklist__footer .simple-button.focus'];
r.push('/* 36 Подключение · 37 Ошибки — оболочка Modal (размеры окна штатные), спиннер, install, чек-лист, nohash, таймаут */');
r.push(S(['.modal']) + '{background-color:rgba(' + k.bgRgb + ',.7)}');



r.push(S(['.modal .modal__content']) + '{background-color:' + k.panel + ';border-radius:.614em;-webkit-box-shadow:0 1.315em 3.945em rgba(0,0,0,.7);box-shadow:0 1.315em 3.945em rgba(0,0,0,.7);color:' + k.text + ';font-family:' + k.fontBody + ';-webkit-backdrop-filter:none;backdrop-filter:none}');
r.push(S(['.modal .modal__head']) + '{margin-bottom:.701em;padding-bottom:.701em;border-bottom:.044em solid ' + k.line + '}');

r.push(S(['.modal .modal__title', '.modal .error__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.227em;line-height:1.1}');

r.push(S(['.modal .error__ico']) + '{position:relative;width:2.455em;height:2.455em;margin-right:.701em;border-radius:50%;background:' + k.spice + '}');
r.push(S(['.modal .error__ico:before']) + '{content:"";position:absolute;top:50%;left:50%;width:1.227em;height:1.227em;margin:-.614em 0 0 -.614em;background-color:' + k.dark + '}');
useMask('close', S(['.modal .error__ico:before']));
r.push(S(['.modal .error__text']) + '{font-size:1.01em;font-weight:400;line-height:1.4;margin-top:.334em;color:' + k.muted + '}');

r.push(T(['.torrent-error']) + '{margin-top:1.052em;padding-top:1.052em;border-top:.044em solid ' + k.line + ';font-family:' + k.fontBody + '}');
r.push(T(['.torrent-error > div > div']) + '{font-size:1.01em;font-weight:600;line-height:1.2}');
r.push(T(['.torrent-error > div > ul']) + '{margin-top:.347em;font-size:1.01em;font-weight:400;line-height:1.3;color:' + k.muted + '}');
r.push(T(['.torrent-error > div > ul > li + li']) + '{margin-top:.4em}');
r.push(T(['.torrent-error > div > ul > li::before']) + '{top:.55em;background-color:' + k.smoke + '}');
r.push(T(['.torrent-error code']) + '{display:block;margin-top:.396em;padding:.495em .693em;border-radius:.347em;background-color:' + k.raised + ';color:' + k.text + ';font-family:' + k.fontBody + ';font-size:1.01em;word-break:normal;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');

r.push(T(['.modal-loading']) + '{position:relative;height:4.384em;background:none}');
r.push(T(['.modal-loading:before']) + '{content:"";position:absolute;top:50%;left:50%;width:4.384em;height:4.384em;margin:-2.192em 0 0 -2.192em;border-radius:50%;background:radial-gradient(circle,' + k.acglow + ' 0%,rgba(' + k.accentRgb + ',0) 70%)}');
r.push(T(['.modal-loading:after']) + '{content:"";position:absolute;top:50%;left:50%;width:2.104em;height:2.104em;margin:-1.052em 0 0 -1.052em;background-color:' + k.accent + '}');
useMask('torrent', T(['.modal-loading:after']));
r.push(TM('full', ['.modal-loading:after']) + '{-webkit-animation:lumen-tp-pulse 2s ease-in-out infinite;animation:lumen-tp-pulse 2s ease-in-out infinite}');
r.push('@-webkit-keyframes lumen-tp-pulse{0%,100%{-webkit-transform:scale(1)}50%{-webkit-transform:scale(1.08)}}');
r.push('@keyframes lumen-tp-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}');

r.push(T(['div.torrent-install']) + '{-webkit-box-align:center;-webkit-align-items:center;align-items:center;font-family:' + k.fontBody + ';color:' + k.text + '}');
r.push(T(['.torrent-install__left']) + '{width:47%;padding-right:1.754em}');
r.push(T(['.torrent-install__details']) + '{width:53%}');
r.push(T(['.torrent-install__left img']) + '{display:block;max-width:100%;border-radius:.438em}');
r.push(T(['.torrent-install__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.403em;line-height:1.1;margin-bottom:.563em}');
r.push(T(['.torrent-install__descr']) + '{font-size:1.052em;line-height:1.45;margin-bottom:.75em;color:' + k.muted + '}');
r.push(T(['.torrent-install__label']) + '{font-size:1.01em;font-weight:600;margin-bottom:.521em}');
r.push(T(['.torrent-install__link']) + '{margin:0 .526em .526em 0;padding:.526em .789em;border-radius:.307em;background-color:' + k.raised + ';color:' + k.text + '}');
r.push(T(['.torrent-install__link > div:first-child']) + '{font-size:1.01em;font-weight:500;margin-bottom:.174em}');
r.push(T(['.torrent-install__link > div:last-child']) + '{font-size:1.01em;font-family:' + k.fontBody + ';color:' + k.muted + '}');


r.push(T(['.torrent-checklist']) + '{font-family:' + k.fontBody + ';color:' + k.text + '}');
r.push(T(['.torrent-checklist__descr']) + '{font-size:1.1em;line-height:1.4;margin-bottom:.438em;color:' + k.muted + '}');
r.push(T(['.torrent-checklist__progress-steps']) + '{font-family:' + k.fontBody + ';font-size:1.01em;margin-bottom:.478em;color:' + k.text + '}');
r.push(T(['.torrent-checklist__progress-bar']) + '{height:.175em;margin-bottom:1.403em;border-radius:.088em;background-color:rgba(' + k.textRgb + ',.16);overflow:hidden}');
r.push(T(['.torrent-checklist__progress-bar > div']) + '{height:100%;border-radius:.088em;background-color:' + k.accent + '}');
r.push(T(['.torrent-checklist__steps']) + '{width:44%;padding-right:1.403em}');
r.push(T(['.torrent-checklist__info']) + '{width:56%}');
r.push(T(['.torrent-checklist__list > li']) + '{font-size:1.01em;font-weight:400;line-height:1.2;margin-bottom:.391em;color:' + k.smoke + '}');
r.push(T(['.torrent-checklist__list > li.wait']) + '{color:' + k.text + ';font-size:1.1em;font-weight:600;margin-bottom:.359em}');
r.push(T(['.torrent-checklist__list > li.wait.check', '.torrent-checklist__list > li.check']) + '{color:' + k.muted + ';font-size:1.01em;font-weight:400;margin-bottom:.391em;text-decoration:line-through}');
r.push(T(['.torrent-checklist__info > div']) + '{font-size:1.01em;line-height:1.45;color:' + k.muted + '}');
r.push(T(['.torrent-checklist__footer']) + '{margin-top:1.052em;-webkit-box-pack:end;-webkit-justify-content:flex-end;justify-content:flex-end}');
r.push(T(['.torrent-checklist__next-step']) + '{margin-left:.912em;font-size:1.01em;color:' + k.muted + '}');





r.push(T(btn) + '{font-size:1.052em;height:3em;padding:0 1.25em;margin-right:0;border-radius:.75em;border:.042em solid ' + k.line + ';background-color:' + k.panel + ';color:' + k.text + ';font-family:' + k.fontBody + ';font-weight:600;-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-transition:background-color .2s,color .2s,border-color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,color .2s,border-color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
r.push(T(btnFocus) + '{background-color:' + k.text + ';color:' + k.bg + ';-webkit-transform:scale(1.06) !important;transform:scale(1.06) !important;-webkit-box-shadow:0 .19em 0 ' + k.acglow + ';box-shadow:0 .19em 0 ' + k.acglow + '}');
r.push(TM('lite', btnFocus) + ',' + TM('off', btnFocus) + '{-webkit-transform:none !important;transform:none !important}');
r.push(TM('lite', btn) + ',' + TM('off', btn) + '{-webkit-animation:none !important;animation:none !important}');
r.push(TM('lite', btn) + '{-webkit-transition:background-color .2s,color .2s,border-color .2s;transition:background-color .2s,color .2s,border-color .2s}');
r.push(TM('off', btn) + '{-webkit-transition:none;transition:none}');

r.push(SUPPORTS_NO_MASK + S(['.modal .error__ico:before']) + '{display:none}' + T(['.modal-loading:after']) + '{background-color:transparent;border:.132em solid ' + k.accent + ';border-radius:50%}}');
return r;
}


function filesRules(k) {
var r = [];
var rows = ['.torrent-file', '.torrent-serial'];
r.push('/* 38 Файлы — фильм · 39 Файлы — сериал (+ полоска автостарта) */');
r.push(T(['.torrent-files .torrent-file + .torrent-file', '.torrent-files .torrent-file + .torrent-serial', '.torrent-files .torrent-serial + .torrent-file', '.torrent-files .torrent-serial + .torrent-serial']) + '{margin-top:.701em}');
r.push(T(['.torrnet-folder-name']) + '{font-family:' + k.fontBody + ';font-size:1.01em;line-height:1.2;padding:.695em 0;color:' + k.muted + ';opacity:.5}');
r.push(T(['.torrnet-folder-name.focus']) + '{opacity:1;color:' + k.accent + '}');
r.push(T(rows) + '{background-color:' + k.panelLo + ';border:.044em solid ' + k.line + ';border-radius:.438em;color:' + k.text + ';font-family:' + k.fontBody + ';-webkit-transition:border-color .2s,background-color .2s;transition:border-color .2s,background-color .2s}');



r.push(T(['.torrent-file.focus', '.torrent-serial.focus']) + '{background-color:' + k.panelHi + ';border-color:' + k.accent + ';border-width:.132em;-webkit-box-shadow:0 .2em 0 ' + k.acglow + ';box-shadow:0 .2em 0 ' + k.acglow + '}');

r.push(T(['.torrent-file']) + '{padding:.701em .789em;overflow:hidden}');
r.push(T(['.torrent-file.focus']) + '{padding:.614em .701em}');
r.push(T(['.torrent-file__title']) + '{font-size:1.1em;font-weight:500;line-height:1.25;padding-right:.637em;color:' + k.muted + '}');
r.push(T(['.torrent-file__title .exe']) + '{display:inline;margin-left:.36em;padding:0;border-radius:0;background:transparent;font-family:' + k.fontBody + ';font-size:1.01em;font-weight:400;color:' + k.smoke + '}');
r.push(T(['.torrent-file.focus .torrent-file__title']) + '{color:' + k.text + '}');
r.push(T(['.torrent-file.focus .torrent-file__title .exe']) + '{color:' + k.muted + '}');
r.push(T(['.torrent-file__size', '.torrent-serial__size']) + '{font-size:1.01em;font-family:' + k.fontBody + ';font-weight:400;line-height:1;padding:.304em .608em;border-radius:.304em;border:.043em solid ' + k.line + ';background-color:' + k.panel + ';color:' + k.muted + '}');
r.push(T(['.torrent-file.focus .torrent-file__size', '.torrent-serial.focus .torrent-serial__size']) + '{color:' + k.text + '}');

r.push(T(['.torrent-file .time-line']) + '{left:0;right:0;bottom:0;margin:0;height:.175em;border-radius:0;background-color:rgba(' + k.textRgb + ',.16)}');
r.push(T(['.torrent-serial .time-line']) + '{margin-top:.35em;height:.175em;border-radius:.088em;background-color:rgba(' + k.textRgb + ',.16);overflow:hidden}');
r.push(T(['.torrent-file .time-line > div', '.torrent-serial .time-line > div']) + '{height:100%;border-radius:.088em;background-color:' + k.accent + '}');

r.push(T(['.torrent-serial']) + '{padding:.526em}');
r.push(T(['.torrent-serial.focus']) + '{padding:.439em}');
r.push(T(['.torrent-serial__img']) + '{width:8.768em;height:4.932em;border-radius:.307em;-webkit-align-self:center;-ms-flex-item-align:center;align-self:center}');
r.push(T(['.torrent-serial__content']) + '{padding:0 .175em 0 .701em}');
r.push(T(['.torrent-serial__title']) + '{font-size:1.01em;font-weight:600;line-height:1.25;margin-top:0}');
r.push(T(['.torrent-serial__line']) + '{font-family:' + k.fontBody + ';font-size:1.01em;font-weight:400;line-height:1.2;margin-top:.304em;color:' + k.muted + '}');
r.push(T(['.torrent-serial__line b']) + '{font-weight:400}');
r.push(T(['.torrent-serial__line span + span:before']) + '{content:"\\00B7";margin:0 .5em;color:' + k.smoke + '}');
r.push(T(['.torrent-serial__exe']) + '{font-family:' + k.fontBody + ';font-size:1.01em;margin-top:.304em;color:' + k.smoke + '}');
r.push(T(['.torrent-serial__episode']) + '{top:.867em;left:.867em;padding:.173em .39em;border-radius:.173em;background-color:rgba(0,0,0,.7);font-family:' + k.fontBody + ';font-size:1.01em;font-weight:600;line-height:1;color:' + k.text + '}');
r.push(T(['.torrent-serial.focus .torrent-serial__episode']) + '{top:1.059em;left:1.059em}');

r.push(T(['.torrent-serial__progress']) + '{top:auto;bottom:.526em;right:.526em;width:.132em;max-height:-webkit-calc(100% - 1.052em);max-height:calc(100% - 1.052em);border-radius:.066em;background-color:' + k.accent + ';-webkit-box-shadow:0 0 .526em ' + k.acglow + ';box-shadow:0 0 .526em ' + k.acglow + ';-webkit-transform:none;transform:none}');
r.push(TM('lite', rows) + '{-webkit-transition:border-color .2s,background-color .2s;transition:border-color .2s,background-color .2s}');
r.push(TM('off', rows) + '{-webkit-transition:none;transition:none}');
return r;
}


function mediaRules(k) {
var r = [];
var markSel = ['.media-loading__mark'];
r.push('/* 40 Предзагрузка — media-loading: вуаль, название-фолбэк, пилюля статуса */');
r.push(T(['.media-loading']) + '{background-color:' + k.bg + ';font-family:' + k.fontBody + '}');
r.push(T(['.media-loading__shade']) + '{background:linear-gradient(0deg,rgba(' + k.bgRgb + ',.98) 0%,rgba(' + k.bgRgb + ',.72) 34%,rgba(' + k.bgRgb + ',.3) 100%)}');

r.push(T(['.media-loading__mark-background']) + '{opacity:.12}');
r.push(T(['.media-loading__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.403em;line-height:1.1;letter-spacing:.06em;text-transform:uppercase;color:' + k.text + ';text-shadow:none}');
r.push(T(['.media-loading__mark-fill .media-loading__title']) + '{color:' + k.accent + ';text-shadow:0 0 .94em ' + k.acglow + '}');
r.push(T(['.media-loading__mark-fill .media-loading__logo']) + '{-webkit-filter:drop-shadow(0 0 .6em ' + k.acglow + ');filter:drop-shadow(0 0 .6em ' + k.acglow + ')}');

r.push(TM('full', markSel) + '{-webkit-animation:lumen-tp-soft 2s ease-in-out infinite;animation:lumen-tp-soft 2s ease-in-out infinite}');
r.push(TM('lite', markSel) + ',' + TM('off', markSel) + '{-webkit-animation:none !important;animation:none !important;-webkit-transform:none;transform:none}');
r.push('@-webkit-keyframes lumen-tp-soft{0%,100%{-webkit-transform:scale(1)}50%{-webkit-transform:scale(1.02)}}');
r.push('@keyframes lumen-tp-soft{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}');



r.push(T(['.media-loading__status']) + '{bottom:5.644em;padding:.695em 1.216em;border-radius:1.302em;border:.043em solid rgba(' + k.textRgb + ',.24);background-color:rgba(' + k.textRgb + ',.1);-webkit-box-shadow:0 .608em 1.737em rgba(0,0,0,.35);box-shadow:0 .608em 1.737em rgba(0,0,0,.35);color:' + k.muted + ';font-family:' + k.fontBody + ';font-size:1.01em}');
r.push(T(['.media-loading__peers-value']) + '{color:' + k.muted + '}');
r.push(T(['.media-loading__peers-icon']) + '{display:none}');
r.push(T(['.media-loading__peers:before']) + '{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.3em;height:1.3em;margin-right:.5em;background-color:' + k.accent + '}');
useMask('torrent', T(['.media-loading__peers:before']));
r.push(T(['.media-loading__separator']) + '{width:.05em;height:1.2em;margin:0 1em;border-radius:0;background-color:rgba(' + k.textRgb + ',.2)}');
r.push(T(['.media-loading__percent']) + '{font-size:1.4em;font-weight:600;color:' + k.text + '}');
r.push(SUPPORTS_NO_MASK + T(['.media-loading__peers-icon']) + '{display:block !important;width:1.3em;height:1.3em;margin-right:.5em;color:' + k.accent + ';opacity:1}' + T(['.media-loading__peers:before']) + '{display:none !important}}');
return r;
}





























function flatRules(k) {
var r = [];
var rows = ['.torrent-file', '.torrent-serial'];
var next = ['.torrent-files .torrent-file + .torrent-file', '.torrent-files .torrent-file + .torrent-serial',
'.torrent-files .torrent-serial + .torrent-file', '.torrent-files .torrent-serial + .torrent-serial'];
var nextLine = [];
for (var i = 0; i < next.length; i++) nextLine.push(next[i] + ':not(.focus)');
r.push('/* 41 Плоский вид (lumen_flat): раздачи и файлы без карточек */');
r.push(T(['.torrent-item']) + '{background-color:transparent;border-color:transparent;border-radius:0}');
r.push(T(['.torrent-item + .torrent-item']) + '{margin-top:0}');
r.push(T(['.torrent-item + .torrent-item:not(.focus)']) + '{border-top-color:' + k.line + '}');
r.push(T(rows) + '{background-color:transparent;border-color:transparent;border-radius:0}');
r.push(T(next) + '{margin-top:0}');
r.push(T(nextLine) + '{border-top-color:' + k.line + '}');
return r;
}

function css() {
var k = LC.tokens();
maskUse = { order: [], by: {} };
var flat = LC.pref('lumen_flat', false) ? flatRules(k) : [];
return [].concat(selectRules(k), explorerRules(k), modalRules(k), filesRules(k), mediaRules(k), flat, maskRules()).join('\n');
}



function mark(object) {
if (!object || !object.activity || typeof object.activity.render !== 'function') return;
var root = object.activity.render();
if (root && root.length && typeof root.addClass === 'function') root.addClass(MARK);
}




function onActivity(e) {
try {
if (e && e.type === 'start' && e.component === 'torrents') mark(e.object);
} catch (err) {
warn('torrents activity failed', err);
}
}



function install() {
if (installed) return;
if (typeof Lampa === 'undefined' || !Lampa) {
warn('torrents: Lampa not found');
return;
}
installed = true;
try {
if (Lampa.Listener && typeof Lampa.Listener.follow === 'function') Lampa.Listener.follow('activity', onActivity);
} catch (e) {
warn('torrents listener failed', e);
}
try {
var act = Lampa.Activity && typeof Lampa.Activity.active === 'function' ? Lampa.Activity.active() : null;
if (act && act.component === 'torrents') mark(act);
} catch (e2) {
warn('torrents active mark failed', e2);
}
}





function toggle(on) {
try {
var el = document.getElementById(STYLE_ID);
if (on) {
if (!el) {
el = document.createElement('style');
el.id = STYLE_ID;
el.type = 'text/css';
(document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(el);
lastText = null;
}
var text = css();
if (text !== lastText) {
if ('styleSheet' in el && el.styleSheet) el.styleSheet.cssText = text;
else el.innerHTML = text;
lastText = text;
}
} else {
if (el && el.parentNode) el.parentNode.removeChild(el);
lastText = null;
}
$('body').toggleClass(BODY_ON, !!on);
} catch (e) {
warn('torrents toggle failed', e);
}
}

return { css: css, scoped: scoped, install: install, toggle: toggle };
})();



if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.torrents;


/* ---- 66_franchise.js ---- */






























LC.franchise = (function () {



var LIFE = 10080;

var WATCHED = 95;












var POSTER_EM = 7.90;
var ORDER_KEY = 'lumen_franchise_order';

var esc = LC.util.esc;





function dateOf(part) {
return '' + ((part && (part.release_date || part.first_air_date)) || '');
}



function orderFor(stored) {
if (stored === 'rating' || stored === 'chronology') return stored;
return 'release';
}




function itemOf(part, index) {
var date = dateOf(part);
return {
card: part,
index: index,
id: part && part.id,
title: (part && (part.title || part.name)) || '',
original: (part && (part.original_title || part.original_name)) || '',
date: date,
year: date ? date.slice(0, 4) : '',
poster: (part && part.poster_path) || '',
rating: Number(part && part.vote_average) || 0,
upcoming: false,
watched: false,
current: false,
next: false,
num: index + 1
};
}




function sortBy(list, key) {
list.sort(function (a, b) {
var d = key(a, b);
if (d) return d;
return a.index - b.index;
});
return list;
}

function cmpDate(a, b) {


var da = a.date || '9999';
var db = b.date || '9999';
if (da < db) return -1;
if (da > db) return 1;
return 0;
}


function orderParts(parts, mode, today) {
var list = [];
if (!parts || typeof parts.length !== 'number') return list;
for (var i = 0; i < parts.length; i++) {
if (!parts[i]) continue;
list.push(itemOf(parts[i], list.length));
}





var stamp = stampOf(today);
for (var u = 0; u < list.length; u++) {
if (list[u].date && list[u].date > stamp) list[u].upcoming = true;
}
if (mode === 'rating') {
sortBy(list, function (a, b) { return b.rating - a.rating; });
} else {
sortBy(list, cmpDate);
if (mode !== 'chronology') {
var out = [];
var later = [];
for (var k = 0; k < list.length; k++) {
if (list[k].upcoming) later.push(list[k]);
else out.push(list[k]);
}
list = out.concat(later);
}
}
for (var n = 0; n < list.length; n++) list[n].num = n + 1;
return list;
}



function stampOf(today) {
var d = (today && today.getFullYear) ? today : new Date();
return d.getFullYear() + '-' + LC.util.pad2(d.getMonth() + 1) + '-' + LC.util.pad2(d.getDate());
}




function markWatched(list, ctx) {
if (!list || typeof list.length !== 'number') return [];
ctx = ctx || {};
for (var i = 0; i < list.length; i++) {
var item = list[i];
var percent = 0;
if (typeof ctx.percent === 'function') {
try { percent = Number(ctx.percent(item)) || 0; } catch (e) { percent = 0; }
}
item.watched = percent >= WATCHED;
item.current = ctx.currentId != null && String(item.id) === String(ctx.currentId);
}
return list;
}





function nextToWatch(list) {
if (!list || typeof list.length !== 'number') return null;
var from = 0;
for (var i = 0; i < list.length; i++) {
if (list[i] && list[i].current) { from = i + 1; break; }
}
for (var k = from; k < list.length; k++) {
var item = list[k];
if (!item || item.watched || item.upcoming || item.current) continue;
item.next = true;
return item;
}
return null;
}





function lang(key) {
try {
if (typeof LC.lang === 'function') return LC.lang(key);
} catch (e) { }
return key;
}





function tmdbImageFn() {
if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function') {
return function (url) { return Lampa.TMDB.image(url); };
}
return null;
}

function apiImgFn() {
if (window.Lampa && Lampa.Api && typeof Lampa.Api.img === 'function') {
return function (path, size) { return Lampa.Api.img(path, size); };
}
return null;
}

function posterUrl(path) {
try {
return LC.cardinfo.imageUrl(path, LC.util.posterSize(LC.util.emPx(POSTER_EM)), tmdbImageFn(), apiImgFn());
} catch (e) {
return '';
}
}

function flagOf(item) {
if (item.current) return { cls: 'current', text: lang('lumen_fr_here') };
if (item.next) return { cls: 'next', text: lang('lumen_fr_next') };
if (item.upcoming) return { cls: 'soon', text: lang('lumen_badge_soon') };
if (item.watched) return { cls: 'watched', text: lang('lumen_fr_watched') };
return null;
}

function cardHtml(item, total) {
var url = posterUrl(item.poster);
var flag = flagOf(item);
var mods = '';
if (item.current) mods += ' lumen-fr-card--current';
if (item.watched) mods += ' lumen-fr-card--watched';
if (item.next) mods += ' lumen-fr-card--next';
if (item.upcoming) mods += ' lumen-fr-card--soon';


return '<div class="lumen-fr-card selector' + mods + '" data-lumen-fr="' + item.index + '">' +
'<div class="lumen-fr-card__poster" style="background-image:' + (url ? 'url(&quot;' + esc(encodeURI(url)) + '&quot;)' : 'none') + '">' +
'<div class="lumen-fr-card__mark"></div>' +
'</div>' +
'<div class="lumen-fr-card__num">' + esc('№ ' + item.num + ' ' + lang('lumen_fr_of') + ' ' + total) + '</div>' +
'<div class="lumen-fr-card__name">' + esc(item.title) + '</div>' +
'<div class="lumen-fr-card__year">' + esc(item.year) + '</div>' +
(flag ? '<div class="lumen-fr-card__flag lumen-fr-card__flag--' + flag.cls + '">' + esc(flag.text) + '</div>' : '') +
'</div>';
}

function modeHtml(id, label, active) {
return '<div class="lumen-fr__mode selector' + (active ? ' lumen-fr__mode--on' : '') +
'" data-lumen-fr-order="' + id + '">' + esc(label) + '</div>';
}

function headHtml(name, order) {
return '<div class="lumen-fr__head">' +
'<span class="lumen-fr__ico"></span>' +
'<span class="lumen-fr__title">' + esc(lang('lumen_fr_title')) + '</span>' +
(name ? '<span class="lumen-fr__name">' + esc(name) + '</span>' : '') +
'<div class="lumen-fr__modes">' +
modeHtml('release', lang('lumen_fr_order_release'), order !== 'rating') +
modeHtml('rating', lang('lumen_sort_rating'), order === 'rating') +
'</div>' +
'</div>';
}

function bodyHtml(list, name, order) {
var cards = [];
for (var i = 0; i < list.length; i++) cards.push(cardHtml(list[i], list.length));
return headHtml(name, order) + '<div class="lumen-fr__row">' + cards.join('') + '</div>';
}





function holderOf(row) {
if (!row || !row.length || typeof row.find !== 'function') return null;
var holder = row.find('.full-descr');
return holder && holder.length ? holder : null;
}

function stateOf(holder) {
var node = holder[0];
if (!node.lumenFranchise) {
node.lumenFranchise = { sign: '', gen: 0, painted: false, parts: null, movie: null, row: null, list: null };
}
return node.lumenFranchise;
}

function clearBlock(holder) {
try {
var old = holder.find('.lumen-fr');
if (old && old.length) old.remove();
} catch (e) { }
}






function isForeground(node) {
try {
if (LC.slideshow && typeof LC.slideshow.isMounted === 'function' && !LC.slideshow.isMounted(node[0])) return false;
} catch (e) { }
return LC.util.onScreen(node);
}





function hashOf(key) {
try {
if (!key || !window.Lampa || !Lampa.Utils || typeof Lampa.Utils.hash !== 'function') return 0;
return Lampa.Utils.hash(key);
} catch (e) {
return 0;
}
}




function watchKey(part) {
try {
if (LC.cardmenu && typeof LC.cardmenu.watchKey === 'function') return LC.cardmenu.watchKey(part);
} catch (e) { }
return (part && (part.original_title || part.original_name || part.title || part.name)) || '';
}

function percentOf(item) {
try {
var hash = hashOf(watchKey(item.card));
if (!hash || !window.Lampa || !Lampa.Timeline || typeof Lampa.Timeline.view !== 'function') return 0;
var view = Lampa.Timeline.view(hash);
return Number(view && view.percent) || 0;
} catch (e) {
return 0;
}
}





function storedOrder() {
try {
return orderFor(LC.pref ? LC.pref(ORDER_KEY, 'release') : 'release');
} catch (e) {
return 'release';
}
}

function paint(holder, state) {
var order = storedOrder();
var list = markWatched(orderParts(state.parts, order, new Date()), {
percent: percentOf,
currentId: state.movie && state.movie.id
});
nextToWatch(list);
state.list = list;

var block = holder.find('.lumen-fr');
if (!block || !block.length || block.hasClass('lumen-fr--sk')) {
clearBlock(holder);
block = $('<div class="lumen-fr"></div>');
holder.append(block);
bind(block, holder);
}
block.html(bodyHtml(list, state.name, order));
appendSelectors(block);
return block;
}






function paintSkeleton(holder) {
var block = $('<div class="lumen-fr lumen-fr--sk"></div>');
block.html('<div class="lumen-fr__row">' +
'<div class="lumen-fr-card lumen-fr-card--sk lumen-skeleton"></div>' +
'<div class="lumen-fr-card lumen-fr-card--sk lumen-skeleton"></div>' +
'<div class="lumen-fr-card lumen-fr-card--sk lumen-skeleton"></div>' +
'<div class="lumen-fr-card lumen-fr-card--sk lumen-skeleton"></div>' +
'</div>');
holder.append(block);
}




function appendSelectors(block) {
try {
if (!window.Lampa || !Lampa.Controller || typeof Lampa.Controller.collectionAppend !== 'function') return;
var enabled = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
if (!enabled || enabled.name !== 'full_descr') return;
if (!isForeground(block)) return;
var nodes = block.find('.lumen-fr-card');
if (nodes && nodes.length) Lampa.Controller.collectionAppend(nodes);
} catch (e) {
warn('franchise collection failed', e);
}
}

function openPart(item) {
try {
if (!item || !item.card || !window.Lampa || !Lampa.Activity || typeof Lampa.Activity.push !== 'function') return;
Lampa.Activity.push({
url: '',
title: item.title,
component: 'full',
id: item.id,
method: 'movie',
card: item.card,
source: 'tmdb'
});
} catch (e) {
warn('franchise open failed', e);
}
}




function setOrder(holder, value) {
try {
if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.set === 'function') {
Lampa.Storage.set(ORDER_KEY, orderFor(value), true);
}
var state = stateOf(holder);
if (state.parts) paint(holder, state);
} catch (e) {
warn('franchise order failed', e);
}
}





function bind(block, holder) {
try {
var el = block[0];
if (!el || typeof el.addEventListener !== 'function' || el.lumenFranchiseBound) return;
el.lumenFranchiseBound = true;
el.addEventListener('hover:enter', function (event) {
try {
var target = $(event.target);
var mode = target.closest('.lumen-fr__mode');
if (mode && mode.length) { setOrder(holder, mode.attr('data-lumen-fr-order')); return; }
var card = target.closest('.lumen-fr-card');
if (!card || !card.length) return;
var index = parseInt(card.attr('data-lumen-fr'), 10);
if (isNaN(index)) return;
var state = stateOf(holder);
var list = state.list || [];
for (var i = 0; i < list.length; i++) {
if (list[i].index === index) { openPart(list[i]); return; }
}
} catch (e) {
warn('franchise enter failed', e);
}
}, true);
} catch (err) {
warn('franchise bind failed', err);
}
}






function requestCollection(id, ok, err) {
try {
if (!window.Lampa || !Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb ||
typeof Lampa.Api.sources.tmdb.get !== 'function') return false;
Lampa.Api.sources.tmdb.get('collection/' + id, {}, ok, err, { life: LIFE });
return true;
} catch (e) {
warn('franchise request failed', e);
return false;
}
}






function render(row, data) {
try {
var holder = holderOf(row);
if (!holder) return;
row.addClass('lumen-descr-row');

var movie = (data && data.movie) || {};
var collection = movie.belongs_to_collection;
var sign = [collection && collection.id, movie.id, lang('lumen_fr_title')].join('|');

var state = stateOf(holder);
if (state.sign === sign && (!state.painted || holder.find('.lumen-fr').length)) return;

state.sign = sign;
state.gen++;
state.painted = false;
var gen = state.gen;
clearBlock(holder);
row.removeClass('lumen-descr-row--franchise');
state.parts = null;
state.list = null;

if (!collection || !collection.id) return;
state.movie = movie;
state.name = collection.name || '';
state.row = row;

paintSkeleton(holder);

var sent = requestCollection(collection.id, function (json) {
try {
var current = stateOf(holder);
if (current.gen !== gen) return;
clearBlock(holder);
var parts = (json && json.parts) || [];


if (parts.length < 2) return;
current.parts = parts;
paint(holder, current);
row.addClass('lumen-descr-row--franchise');
current.painted = true;
} catch (e) {
warn('franchise paint failed', e);
}
}, function () {
try {
var current = stateOf(holder);
if (current.gen !== gen) return;
clearBlock(holder);
} catch (e) {
warn('franchise error path failed', e);
}
});






if (!sent) clearBlock(holder);
} catch (err) {
warn('franchise render failed', err);
}
}


function clearRow(row) {
try {
var holder = holderOf(row);
if (!holder) return;
clearBlock(holder);
row.removeClass('lumen-descr-row--franchise');
var state = stateOf(holder);
state.sign = '';
state.painted = false;
state.parts = null;
state.list = null;
state.gen++;
} catch (e) {
warn('franchise clear failed', e);
}
}






function cancel(body) {
try {
if (!body || typeof body.find !== 'function') return;
var holder = body.find('.full-descr');
if (!holder || !holder.length) return;
var node = holder[0];
if (node && node.lumenFranchise) {
node.lumenFranchise.gen++;
node.lumenFranchise.sign = '';
}
} catch (e) {
warn('franchise cancel failed', e);
}
}

return {
orderFor: orderFor,
orderParts: orderParts,
markWatched: markWatched,
nextToWatch: nextToWatch,
render: render,
clearRow: clearRow,
cancel: cancel
};
})();



if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.franchise;


/* ---- 67_transition.js ---- */

























LC.transition = (function () {


var DURATION = 480;







var HOLD_WAIT = 960;
var EASE = 'cubic-bezier(.2,.8,.2,1)';






var OVERSCAN = 1.04;





var state = null;


























function geom(rect, screen) {
if (!rect || !screen) return null;
var w = Number(rect.width) || 0;
var h = Number(rect.height) || 0;
var sw = Number(screen.width) || 0;
var sh = Number(screen.height) || 0;
if (w <= 0 || h <= 0 || sw <= 0 || sh <= 0) return null;
return {
scale: Math.max(sw / w, sh / h) * OVERSCAN,
tx: Math.round(sw / 2 - ((Number(rect.left) || 0) + w / 2)),
ty: Math.round(sh / 2 - ((Number(rect.top) || 0) + h / 2))
};
}





function motion() {
try { return LC.motionMode(); } catch (e) { return 'full'; }
}

function screenBox() {
try {
return { width: window.innerWidth || 0, height: window.innerHeight || 0 };
} catch (e) {
return null;
}
}

function raf(fn) {
try {
if (window.requestAnimationFrame) return window.requestAnimationFrame(fn);
} catch (e) { }
return 0;
}

function unraf(id) {
try {
if (id && window.cancelAnimationFrame) window.cancelAnimationFrame(id);
} catch (e) { }
}






function stop() {
if (!state) return;
var s = state;
state = null;
unraf(s.frame);
try { if (s.timer) clearTimeout(s.timer); } catch (e) { }
try { s.node.remove(); } catch (eR) {
warn('transition: remove failed', eR);
}
}






function show(source) {
var box = screenBox();
var g = geom(source.rect, box);
if (!g) return false;



stop();

var node = $('<div class="lumen-overlay"><div class="lumen-overlay__img"></div></div>');
var img = node.find('.lumen-overlay__img');
var move = DURATION + 'ms ' + EASE;









img.css({
left: Math.round(source.rect.left) + 'px',
top: Math.round(source.rect.top) + 'px',
width: Math.round(source.rect.width) + 'px',
height: Math.round(source.rect.height) + 'px',
'background-image': 'url("' + encodeURI(source.big || source.poster) + '")',




'background-position': '50% 38%',
'-webkit-transition': '-webkit-transform ' + move,
transition: 'transform ' + move
});

$('body').append(node);
state = { node: node, img: img, timer: null, frame: 0, done: false };
var live = state;








live.frame = raf(function () {
if (state !== live) return;
live.frame = raf(function () {
if (state !== live) return;
live.frame = 0;
var tr = 'translate(' + g.tx + 'px, ' + g.ty + 'px) scale(' + g.scale + ')';
img.addClass('is-run').css({ '-webkit-transform': tr, transform: tr });
});
});

return true;
}







function held(el, call) {
if (!el || typeof el.addEventListener !== 'function') return;
function done(e) {
if (e && e.propertyName && ('' + e.propertyName).indexOf('transform') === -1) return;
call();
}
try {
el.addEventListener('transitionend', done, false);
el.addEventListener('webkitTransitionEnd', done, false);
} catch (err) { }
}




















function reveal(source, opts) {
try {
if (motion() === 'off') return false;
if (!source || !source.rect) return false;
if (!source.big && !source.poster) return false;
if (!show(source)) return false;
var live = state;
if (opts && typeof opts.then === 'function') {
var call = function () {
if (state !== live || live.done) return;
live.done = true;
opts.then();
};
held(live.img[0], call);
live.timer = setTimeout(call, HOLD_WAIT);
}
return true;
} catch (e) {
warn('transition: reveal failed', e);
return false;
}
}

return {
geom: geom,
reveal: reveal,
stop: stop,
active: function () { return !!state; }
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.transition;


/* ---- 68_perf.js ---- */














































LC.perf = (function () {


var KEY = 'lumen_motion_auto';

var NOTY_KEY = 'lumen_motion_noty';





var SLOW_MS = 400;
var FAST_MS = 250;



var SAMPLES = 3;


var GOOD_RUNS = 5;







var MAX_SAMPLE = 5000;
















var MAIN_LIMIT = 1;



var samples = [];

var fromMain = 0;


var frame = 0;


var done = false;



var cached;



var held = false;





function median(list) {
var sorted = list.slice().sort(function (a, b) { return a - b; });
return sorted[Math.floor(sorted.length / 2)];
}



function decide(list) {
if (!list || list.length < SAMPLES) return null;
var m = median(list);
if (m >= SLOW_MS) return 'lite';
if (m < FAST_MS) return 'full';
return null;
}




function normalize(raw) {
var value = raw;
if (typeof value === 'string') {
if (value === 'lite' || value === 'full') return { mode: value, good: 0 };
try { value = JSON.parse(value); } catch (e) { return { mode: null, good: 0 }; }
}
if (!value || typeof value !== 'object') return { mode: null, good: 0 };
var mode = (value.mode === 'lite' || value.mode === 'full') ? value.mode : null;
var good = Number(value.good);
if (!(good > 0)) good = 0;
return { mode: mode, good: Math.floor(good) };
}




function merge(stored, decision) {
var cur = normalize(stored);
if (decision === 'lite') return { mode: 'lite', good: 0 };
if (decision !== 'full') return cur;
if (cur.mode !== 'lite') return { mode: 'full', good: 0 };
var good = cur.good + 1;
if (good >= GOOD_RUNS) return { mode: 'full', good: 0 };
return { mode: 'lite', good: good };
}





function storage() {
try {
if (window.Lampa && Lampa.Storage) return Lampa.Storage;
} catch (e) { }
return null;
}

function readStored() {
if (typeof cached !== 'undefined') return cached;
var st = storage();


if (!st) return normalize(null);
var value = normalize(null);
try { value = normalize(st.get(KEY, '')); } catch (e) { warn('perf: storage read failed', e); }
cached = value;
return value;
}

function writeStored(value) {
cached = value;
var st = storage();
if (!st) return;
try { st.set(KEY, value); } catch (e) { warn('perf: storage write failed', e); }
}


function mode() {
return readStored().mode;
}

function now() {
try {
if (window.performance && typeof window.performance.now === 'function') return window.performance.now();
} catch (e) { }
return Date.now();
}

function raf(fn) {
try {
if (window.requestAnimationFrame) return window.requestAnimationFrame(fn);
} catch (e) { }
return 0;
}



function hidden() {
try {
return typeof document !== 'undefined' && !!document.hidden;
} catch (e) {
return false;
}
}

function unraf(id) {
try {
if (id && window.cancelAnimationFrame) window.cancelAnimationFrame(id);
} catch (e) { }
}




function motionRaw() {
try {
return LC.pref('lumen_motion', 'auto');
} catch (e) { }
return 'auto';
}

function platformIs(name) {
try {
if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.is === 'function') return !!Lampa.Platform.is(name);
} catch (e) { }
return false;
}

function tvPlatform() {
return platformIs('tizen') || platformIs('webos');
}






















function weakHardware() {
if (!platformIs('android')) return false;
try {



var nav = window.navigator;
if (!nav) return false;
var cores = Number(nav.hardwareConcurrency);
if (cores > 0 && cores <= 2) return true;
var mem = nav.deviceMemory;
if (typeof mem !== 'undefined' && mem !== null) {
var gb = Number(mem);
if (gb > 0 && gb <= 1) return true;
}
} catch (e) { }
return false;
}







function shouldMeasure(source) {
if (held) return false;
try {
if (!LC.enabled()) return false;
} catch (e) {
return false;
}

if (source === 'main' && fromMain >= MAIN_LIMIT) return false;
var raw = motionRaw();



if (raw === 'full' || raw === 'lite' || raw === 'off') return false;


if (tvPlatform()) return false;











if (hidden()) return false;
return true;
}



function notyOnce() {
var st = storage();
var shown = '';
try {
if (st) shown = st.get(NOTY_KEY, '');
} catch (e) { }



if (shown === 'true' || shown === true) return;
try {
if (window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function') {
Lampa.Noty.show(typeof LC.lang === 'function' ? LC.lang('lumen_motion_auto_noty') : 'Lumen Card');
}
} catch (eN) {
warn('perf: noty failed', eN);
}


try { if (st) st.set(NOTY_KEY, 'true'); } catch (eS) { }
}

function commit() {
var prev = readStored();
var next = merge(prev, decide(samples));
if (next.mode === prev.mode && next.good === prev.good) return;
writeStored(next);



var was = prev.mode === 'lite';
var is = next.mode === 'lite';
if (was === is) return;
if (is) notyOnce();
try {
if (typeof LC.applyMotionMode === 'function') LC.applyMotionMode();
} catch (e) {
warn('perf: apply failed', e);
}
}








function track(source) {
if (done || frame) return;


var src = (source === 'main' || source === 'hub') ? source : 'card';






if (!shouldMeasure(src)) return;
var started = now();
frame = raf(function () {
frame = raf(function () {
frame = 0;
var ms = now() - started;



if (ms > MAX_SAMPLE) return;
samples.push(ms);
if (src === 'main') fromMain++;
if (samples.length < SAMPLES) return;
done = true;
try { commit(); } catch (e) { warn('perf: commit failed', e); }
});
});
}



function stop() {
if (!frame) return;
unraf(frame);
frame = 0;
}



function hold(on) {
held = !!on;
if (held) stop();
}

return {
decide: decide,
merge: merge,
normalize: normalize,
mode: mode,


weakHardware: weakHardware,
track: track,
stop: stop,
hold: hold,
samples: function () { return samples.slice(); }
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.perf;


/* ---- 69_bench.js ---- */


































LC.bench = (function () {


var LEAVE_MS = 600;
var WARM_MS = 1000;
var MEASURE_MS = 5000;

var FLIP_MS = 1500;

var TINT_MS = 2000;

var MOVE_MS = 400;
var MOVES = 6;

var ANIM_MS = 500;

var UP_TRIES = 6;






var FONT_PX = 15;
var CHAR_EM = 0.6;
var LINE_EM = 1.45;
var PAD_PX = 24;
var SCREEN_W = 960;
var SCREEN_H = 540;
var MAX_COLS = Math.floor((SCREEN_W - 2 * PAD_PX) / (FONT_PX * CHAR_EM));
var MAX_LINES = Math.floor((SCREEN_H - 2 * PAD_PX) / (FONT_PX * LINE_EM));



var TINTS = [{ r: 168, g: 72, b: 56 }, { r: 56, g: 96, b: 168 }];

var STAGES = [
{ id: 'lite idle', motion: 'lite' },
{ id: 'full idle', motion: 'full' },
{ id: '+fx', motion: 'full', heavy: true, fx: true },
{ id: '+frames', motion: 'full', heavy: true, fx: true, flip: true },
{ id: '+tint', motion: 'full', heavy: true, fx: true, flip: true, tint: true },
{ id: 'lite scroll', motion: 'lite', scroll: true },
{ id: 'full scroll', motion: 'full', heavy: true, scroll: true },
{ id: 'all', motion: 'full', heavy: true, fx: true, flip: true, tint: true, scroll: true }
];









function overridesFor(stage) {
return {
lumen_motion: stage.motion,
lumen_fx_heavy: !!stage.heavy,
lumen_fx: 'off',
lumen_trailer: 'off',
lumen_hero_media: 'frames',
lumen_hero_trailer: false
};
}

function num(a, b) { return a - b; }

function r1(x) { return Math.round(x * 10) / 10; }


function pct(sorted, q) {
if (!sorted.length) return 0;
var i = Math.ceil(q * sorted.length) - 1;
return sorted[i < 0 ? 0 : (i >= sorted.length ? sorted.length - 1 : i)];
}


function period(deltas) {
if (!deltas.length) return 0;
var d = deltas.slice().sort(num);
return d[Math.floor(d.length / 2)];
}

function summarize(deltas, lats, P) {
var d = deltas.slice().sort(num);
var l = lats.slice().sort(num);
var sum = 0;
var miss1 = 0;
var miss2 = 0;
for (var i = 0; i < d.length; i++) {
sum += d[i];
if (P > 0 && d[i] > 2.5 * P) miss2++;
else if (P > 0 && d[i] > 1.5 * P) miss1++;
}
return {
frames: d.length, fps: sum > 0 ? r1(d.length * 1000 / sum) : 0,
p50: r1(pct(d, 0.5)), p95: r1(pct(d, 0.95)), miss1: miss1, miss2: miss2,
lat95: l.length ? r1(pct(l, 0.95)) : null
};
}

function cut(text, max) {
text = '' + text;
return text.length > max ? text.slice(0, max - 1) + '…' : text;
}

function pad(text, width, left) {
text = cut(text, width);
while (text.length < width) text = left ? text + ' ' : ' ' + text;
return text;
}

function hostOf(url) {
var m = /^[a-z][a-z0-9+.-]*:\/\/([^\/?#]+)/i.exec(url || '');
return m ? m[1] : '';
}

function na(v, fmt) {
return v === null || typeof v === 'undefined' || v < 0 ? 'n/a' : (fmt ? fmt(v) : '' + v);
}

function fixed(v) { return (Math.round(v * 10) / 10).toFixed(1); }

function fixed2(v) { return (Math.round(v * 100) / 100).toFixed(2); }


var COLS = [['#', 2], ['stage', 13, true], ['fps', 6], ['p50', 7], ['p95', 8], ['-1', 6], ['-2+', 5],
['loaf n/ms', 12], ['lat95', 7], ['anim', 6], ['fx ms', 7]];

function line(cells) {
var out = '';
for (var i = 0; i < COLS.length; i++) out += pad(cells[i], COLS[i][1], COLS[i][2]) + (i < COLS.length - 1 ? ' ' : '');
return out.replace(/\s+$/, '');
}



var COLS2 = [['#', 2], ['max', 5], ['blk', 5], ['js', 5], ['r+ev', 5], ['st+l', 5], ['frc', 5], ['other', 6]];


var SCRIPT_W = MAX_COLS;
for (var c2 = 0; c2 < COLS2.length; c2++) SCRIPT_W -= COLS2[c2][1] + 1;

var SCRIPT_MAX = 120;

function line2(cells) {
var out = '';
for (var i = 0; i < cells.length; i++) {
var last = i === cells.length - 1;
out += (i < COLS2.length ? pad(cells[i], COLS2[i][1]) : pad(cells[i], SCRIPT_W, true)) + (last ? '' : ' ');
}
return out.replace(/\s+$/, '');
}

function topLine(row) {
var tp = row.top;
if (!tp) return line2(['' + row.n, '-']);
return line2(['' + row.n, Math.round(tp.ms), Math.round(tp.block), Math.round(tp.js), Math.round(tp.rev),
Math.round(tp.sl), Math.round(tp.forced), Math.round(tp.other), tp.script || '-']);
}

function rowLine(row) {
return line([
'' + row.n, row.id + (row.partial ? '*' : ''),
row.frames ? fixed(row.fps) : '-', row.frames ? fixed(row.p50) : '-', row.frames ? fixed(row.p95) : '-',
'' + row.miss1, '' + row.miss2,
row.loafN === null || typeof row.loafN === 'undefined' ? 'n/a' : row.loafN + '/' + Math.round(row.loafMs),
na(row.lat95, fixed), na(row.anim), na(row.fxMs, fixed2)
]);
}

function lang(key, fallback) {
try {
if (typeof LC.lang === 'function') {
var s = LC.lang(key);
if (s && s !== key) return s;
}
} catch (e) { }
return fallback;
}









function table(result) {
var out = [];
out.push(cut('cr ' + result.cr + ' · hw ' + result.hw + ' · ' + result.w + '×' + result.h + '@' + result.dpr +
' · P ' + fixed(result.P || 0) + ' · ' + result.time + ' · v' + result.version, MAX_COLS));
out.push(line(COLS.map(function (c) { return c[0]; })));
var worst = null;
var loaf = false;
for (var i = 0; i < result.rows.length; i++) {
var row = result.rows[i];
out.push(rowLine(row));
if (row.worst && (!worst || row.worst.ms > worst.ms)) worst = { ms: row.worst.ms, host: row.worst.host, n: row.n, id: row.id };
if (row.loafN !== null && typeof row.loafN !== 'undefined') loaf = true;
}
out.push('');
if (loaf) {
out.push(line2(['#', 'max', 'blk', 'js', 'r+ev', 'st+l', 'frc', 'other', 'script']));
for (var j = 0; j < result.rows.length; j++) out.push(topLine(result.rows[j]));
}
if (worst) {
out.push(cut('loaf max: #' + worst.n + ' ' + worst.id + ' · ' + Math.round(worst.ms) + ' ms · ' + (worst.host || 'n/a'), MAX_COLS));
}
var back = lang('lumen_bench_back', 'Back — close');
if (result.reason && result.reason !== 'done') {
back = lang('lumen_bench_stopped', 'stopped') + ': ' + result.reason + ' · ' + result.stoppedAt + '/' + STAGES.length + ' · ' + back;
}
out.push(cut(back, MAX_COLS));
return out;
}





function setT(fn, ms) {
var hook = api._timers;
if (hook && typeof hook.set === 'function') return hook.set(fn, ms);
try { return setTimeout(fn, ms); } catch (e) { return 0; }
}

function clearT(id) {
if (!id) return;
var hook = api._timers;
if (hook && typeof hook.clear === 'function') { hook.clear(id); return; }
try { clearTimeout(id); } catch (e) { }
}

function raf(fn) {
try { if (window.requestAnimationFrame) return window.requestAnimationFrame(fn); } catch (e) { }
return 0;
}

function unraf(id) {
try { if (id && window.cancelAnimationFrame) window.cancelAnimationFrame(id); } catch (e) { }
}

function perfNow() {
try {
if (window.performance && typeof window.performance.now === 'function') return window.performance.now();
} catch (e) { }
return -1;
}

function lampa() {
try { return window.Lampa || null; } catch (e) { return null; }
}

function log(text) {
if (typeof api._log === 'function') { api._log(text); return; }
try { if (typeof console !== 'undefined' && console.log) console.log(text); } catch (e) { }
}

function safe(fn) {
try { fn(); } catch (e) { warn('bench: cleanup step failed', e); }
}

function hero() { return LC.hero || null; }






function onRows(name) {
return name === 'content' || name === 'items_line';
}

function heroCompact() {
try { return !!(hero() && hero().compact()); } catch (e) { return false; }
}

function heroFocused() {
try { return hero() ? hero().focused() : null; } catch (e) { return null; }
}





function blocked() {
try {
var h = hero();
if (!h || !h.active() || h.parked()) return 'home';
if (document.hidden) return 'hidden';
var cls = document.body.classList;
if (cls && (cls.contains('settings--open') || cls.contains('selectbox--open') || cls.contains('menu--open'))) return 'overlay';
if (document.querySelector('.modal,.youtube-player,.player,.search-box,.search')) return 'overlay';
} catch (e) {
return 'error';
}
return '';
}

function animCount() {
try {
if (typeof document.getAnimations === 'function') return document.getAnimations().length;
} catch (e) { }
return -1;
}

function fxStats() {
try { if (LC.fx && typeof LC.fx.stats === 'function') return LC.fx.stats(); } catch (e) { }
return null;
}



function fxAvg(from, to) {
if (!from || !to) return null;
var frames = to.frames - from.frames;
if (!(frames > 0)) return null;
return (to.avgMs * to.frames - from.avgMs * from.frames) / frames;
}




function scriptOf(entry) {
var list = entry && entry.scripts;
var best = null;
for (var i = 0; list && i < list.length; i++) {
if (!best || Number(list[i].duration) > Number(best.duration)) best = list[i];
}
if (!best) return '';
return cut((hostOf(best.sourceURL) || 'inline') + (best.invoker ? ' ' + best.invoker : ''), 48);
}
















function partsOf(e) {
var start = Number(e.startTime) || 0;
var dur = Number(e.duration) || 0;
var rs = Number(e.renderStart) || 0;
var sls = Number(e.styleAndLayoutStart) || 0;
var list = e.scripts || [];
var js = 0;
var forced = 0;
var top = null;
for (var i = 0; i < list.length; i++) {
var d = Number(list[i].duration) || 0;
forced += Number(list[i].forcedStyleAndLayoutDuration) || 0;
if (!rs || Number(list[i].startTime) < rs) js += d;
if (!top || d > Number(top.duration)) top = list[i];
}
var task = rs > 0 ? rs - start : dur;
var other = task - js;
var pos = top && Number(top.sourceCharPosition) >= 0 ? '' + top.sourceCharPosition : '';
return {
ms: dur, block: Number(e.blockingDuration) || 0, js: js, forced: forced,
rev: rs > 0 && sls > 0 ? sls - rs : 0,
sl: sls > 0 ? start + dur - sls : 0,
other: other > 0 ? other : 0,
script: top ? cut((hostOf(top.sourceURL) || 'inline') + ' ' + (top.sourceFunctionName || '') + '@' + pos +
(top.invoker ? ' ' + top.invoker : ''), SCRIPT_MAX) : ''
};
}





var run = null;
var pending = 0;
var last = null;
var screen = null;

function later(r, ms, fn) {
r.timers.push(setT(function () {
if (run !== r) return;
try { fn(); } catch (e) { warn('bench: stage failed', e); finish('error'); }
}, ms));
}

function every(r, ms, fn) {
later(r, ms, function tick() {
fn();
later(r, ms, tick);
});
}

function clearStage(r) {
for (var i = 0; i < r.timers.length; i++) clearT(r.timers[i]);
r.timers = [];
}

function frame(t) {
var r = run;
if (!r) return;
var n = perfNow();
if (r.phase === 'measure') {
if (r.prevT) r.deltas.push(t - r.prevT);
if (n >= 0) r.lats.push(n - t > 0 ? n - t : 0);
}
r.prevT = t;
r.raf = raf(frame);
}

function onLoaf(list) {
var r = run;
if (!r || r.phase !== 'measure') return;
var entries = list.getEntries();
for (var i = 0; i < entries.length; i++) {
var e = entries[i];
if (r.measureFrom >= 0 && e.startTime < r.measureFrom) continue;
var ms = Number(e.blockingDuration) || 0;
r.loaf.n++;
r.loaf.ms += ms;


if (ms > 0 && (!r.loaf.worst || ms > r.loaf.worst.ms)) r.loaf.worst = { ms: ms, host: scriptOf(e) };


if (!r.loaf.top || (Number(e.duration) || 0) > r.loaf.top.ms) r.loaf.top = partsOf(e);
}
}

function observeLoaf() {
try {
var PO = window.PerformanceObserver;
if (!PO || !PO.supportedEntryTypes || PO.supportedEntryTypes.indexOf('long-animation-frame') === -1) return null;
var obs = new PO(onLoaf);
obs.observe({ type: 'long-animation-frame' });
return obs;
} catch (e) { }
return null;
}

function listen(r) {
var L = lampa();
r.onKey = function (e) {
try {
if (e && e.stopPropagation) e.stopPropagation();
if (e && e.preventDefault) e.preventDefault();
} catch (x) { }
finish('key');
};
r.onVis = function () { if (document.hidden) finish('hidden'); };
r.onAct = function (e) { if (e && e.type === 'start') finish('activity'); };
r.onToggle = function (e) { if (e && !onRows(e.name)) finish('toggle'); };
try { window.addEventListener('keydown', r.onKey, true); } catch (e1) { }
try { document.addEventListener('visibilitychange', r.onVis); } catch (e2) { }
try { if (L && L.Listener) L.Listener.follow('activity', r.onAct); } catch (e3) { }
try { if (L && L.Controller && L.Controller.listener) L.Controller.listener.follow('toggle', r.onToggle); } catch (e4) { }
}

function unlisten(r) {
var L = lampa();
try { window.removeEventListener('keydown', r.onKey, true); } catch (e1) { }
try { document.removeEventListener('visibilitychange', r.onVis); } catch (e2) { }
try { if (L && L.Listener) L.Listener.remove('activity', r.onAct); } catch (e3) { }
try { if (L && L.Controller && L.Controller.listener) L.Controller.listener.remove('toggle', r.onToggle); } catch (e4) { }
}



function tag(r) {
try {
var n = document.createElement('div');
n.className = 'lumen-bench-tag';
n.style.cssText = 'position:fixed;top:8px;right:12px;z-index:10000;padding:4px 8px;background:rgba(0,0,0,.7);' +
'color:#EDE6DA;font:13px/1.3 monospace;pointer-events:none';
document.body.appendChild(n);
r.tag = n;
} catch (e) { }
}

function tagText(r) {
try {
if (r.tag) r.tag.textContent = (r.step + 1) + '/' + STAGES.length + ' ' + STAGES[r.step].id + ' · ' + lang('lumen_bench_running', 'test · any key stops');
} catch (e) { }
}



function apply() {
if (typeof LC.applyMotionMode === 'function') LC.applyMotionMode();
if (hero()) hero().applyMotion();
if (LC.accent && LC.accent.repaint) LC.accent.repaint();
}

function next(r) {
clearStage(r);
r.step++;
if (r.step >= STAGES.length) { finish('done'); return; }
if (blocked()) { finish('activity'); return; }
var st = STAGES[r.step];
r.phase = 'warm';
r.deltas = [];
r.lats = [];
r.loaf = { n: 0, ms: 0, worst: null, top: null };
r.anim = -1;
r.fx0 = null;
r.measureFrom = -1;
LC.prefs.override(overridesFor(st));
apply();



hero().benchFx(st.fx ? 'winter' : null);
tagText(r);
if (st.flip) every(r, FLIP_MS, function () { hero().benchFlip(); });
if (st.tint) {
var k = 0;
every(r, TINT_MS, function () { LC.accent.drive(TINTS[k++ % TINTS.length]); });
}
later(r, WARM_MS, function () { measure(r, st); });
later(r, WARM_MS + MEASURE_MS, function () {
r.rows.push(rowOf(r, false));
next(r);
});
}

function measure(r, st) {
r.phase = 'measure';
r.prevT = 0;
r.measureFrom = perfNow();
r.fx0 = fxStats();
r.anim = animCount();
every(r, ANIM_MS, function () {
var n = animCount();
if (n > r.anim) r.anim = n;
});
if (st.scroll) scroll(r);
}




function scroll(r) {
var L = lampa();
var rights = 0;
var k = 0;
function step() {
if (k < MOVES) {
var before = heroFocused();
L.Controller.move('right');
if (heroFocused() !== before) rights++;
} else if (rights > 0) {
L.Controller.move('left');
rights--;
} else {
return;
}
k++;
later(r, MOVE_MS, step);
}
step();
}

function rowOf(r, partial) {
var st = STAGES[r.step];


if (!r.P && r.deltas.length >= 10) r.P = period(r.deltas);
var s = summarize(r.deltas, r.lats, r.P || period(r.deltas));
return {
n: r.step + 1, id: st.id, partial: !!partial, frames: s.frames, fps: s.fps, p50: s.p50, p95: s.p95,
miss1: s.miss1, miss2: s.miss2, lat95: s.lat95,
loafN: r.obs ? r.loaf.n : null, loafMs: r.obs ? r.loaf.ms : 0, worst: r.loaf.worst, top: r.loaf.top,
anim: r.anim, fxMs: fxAvg(r.fx0, fxStats())
};
}

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function resultOf(r, reason) {
var hud = LC.hud || {};
var d = new Date();
var dpr = 1;
try { dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100; } catch (e) { }
return {
version: LC.VERSION || '', cr: typeof hud.chrome === 'function' ? hud.chrome() : 'n/a',
hw: typeof hud.hardware === 'function' ? hud.hardware() : 'n/a',
w: window.innerWidth, h: window.innerHeight, dpr: dpr, P: r1(r.P || 0),
time: pad2(d.getHours()) + ':' + pad2(d.getMinutes()),
reason: reason, stoppedAt: Math.min(r.step + 1, STAGES.length), rows: r.rows
};
}





function refocus(r) {
var el = r.startEl;
if (!el || heroFocused() === el) return;
var L = lampa();
if (!L || !L.Controller) return;
var on = L.Controller.enabled ? L.Controller.enabled() : null;
if (on && on.name && !onRows(on.name)) return;
L.Controller.collectionFocus(el, el.parentNode || document.body);
}




function finish(reason) {
var r = run;
if (!r) return;
if (reason !== 'done' && r.phase === 'measure') {
try { r.rows.push(rowOf(r, true)); } catch (e) { }
}
run = null;
clearStage(r);
unraf(r.raf);
try { if (r.obs) r.obs.disconnect(); } catch (e1) { }
unlisten(r);
try { if (r.tag && r.tag.parentNode) r.tag.parentNode.removeChild(r.tag); } catch (e2) { }
safe(function () { LC.prefs.clearOverride(); });
safe(function () { hero().benchFx(null); });
safe(function () { hero().benchHold(false); });
safe(function () { hero().benchRestore(); });
safe(function () { LC.applyMotionMode(); });
safe(function () { hero().applyMotion(); });
safe(function () { hero().applyFx(); });
safe(function () { LC.accent.drive(r.tintSaved, true); });
safe(function () { LC.accent.repaint(); });
safe(function () { LC.perf.hold(false); });
safe(function () { refocus(r); });
var result = resultOf(r, reason);
last = result;
safe(function () { log('[lumen-card] bench ' + JSON.stringify(result)); });
safe(function () { show(result); });
}





function show(result) {
close();
var node = document.createElement('div');
node.className = 'lumen-bench';
node.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10001;margin:0;padding:' + PAD_PX + 'px;' +
'box-sizing:border-box;background:#0B0908;color:#EDE6DA;font:' + FONT_PX + 'px/' + LINE_EM + ' monospace;' +
'white-space:pre;overflow:hidden';
node.textContent = table(result).join('\n');
node.onclick = close;
document.body.appendChild(node);
screen = node;
var L = lampa();
if (L && L.Controller) {
var noop = function () { };
L.Controller.add('lumen_bench', {
toggle: function () { try { L.Controller.collectionSet(node); } catch (e) { } },
back: close, up: noop, down: noop, left: noop, right: noop, enter: noop
});
L.Controller.toggle('lumen_bench');
}
}

function close() {
if (!screen) return;
var node = screen;
screen = null;
try { if (node.parentNode) node.parentNode.removeChild(node); } catch (e) { }
try { lampa().Controller.toggle('content'); } catch (e2) { }
}

function noty(text) {
try {
var L = lampa();
if (L && L.Noty && typeof L.Noty.show === 'function') L.Noty.show(text);
} catch (e) { }
}

function launch() {
var L = lampa();


for (var i = 0; i < UP_TRIES && heroCompact() && !blocked(); i++) {
try { L.Controller.move('up'); } catch (e) { break; }
}
if (blocked() || heroCompact()) {
noty(lang('lumen_bench_need_home', 'Lumen Card: open the home screen and start the test again'));
return;
}
var r = {
step: -1, rows: [], P: 0, timers: [], raf: 0, phase: 'idle', prevT: 0, deltas: [], lats: [],
loaf: { n: 0, ms: 0, worst: null, top: null }, anim: -1, fx0: null, measureFrom: -1, obs: null,
startEl: heroFocused(), tintSaved: null, tag: null
};
run = r;
try {
LC.perf.hold(true);
hero().benchHold(true);
r.tintSaved = LC.accent && LC.accent.target ? LC.accent.target() : null;
r.obs = observeLoaf();
listen(r);
tag(r);
r.raf = raf(frame);
next(r);
} catch (e) {
warn('bench: start failed', e);
finish('error');
}
}






function start() {
if (run || pending) return;
pending = setT(function () {
pending = 0;
var L = lampa();
try { if (L && L.Controller && L.Controller.toContent) L.Controller.toContent(); } catch (e) { }
try { if (L && L.Controller) L.Controller.toggle('content'); } catch (e2) { }
pending = setT(function () {
pending = 0;
launch();
}, LEAVE_MS);
}, 0);
}

var api = {
STAGES: STAGES, MAX_COLS: MAX_COLS, MAX_LINES: MAX_LINES, FONT_PX: FONT_PX, CHAR_EM: CHAR_EM, LINE_EM: LINE_EM, PAD_PX: PAD_PX,
overridesFor: overridesFor, summarize: summarize, period: period, table: table, partsOf: partsOf,
start: start,

stop: function () { finish('stop'); },
running: function () { return !!run; },

last: function () { return last; },

_timers: null,
_log: null
};
return api;
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.bench;


/* ---- 69_hud.js ---- */





















LC.hud = (function () {



var state = null;

























var SLOTS = 5;

function newSlot() { return { long: 0, loaf: 0, loafMs: 0, d: [], lat: [] }; }

function resetSlot(slot) {
slot.long = 0; slot.loaf = 0; slot.loafMs = 0;
slot.d.length = 0; slot.lat.length = 0;
}

function num(a, b) { return a - b; }

function r1(x) { return Math.round(x * 10) / 10; }


function pct(sorted, q) {
if (!sorted.length) return 0;
var i = Math.ceil(q * sorted.length) - 1;
return sorted[i < 0 ? 0 : (i >= sorted.length ? sorted.length - 1 : i)];
}








function bucket(ms, P) {
if (!(P > 0) || ms <= 1.5 * P) return 0;
if (ms <= 2.5 * P) return 1;
if (ms <= 3.5 * P) return 2;
return 3;
}




function windowStats(deltas, lats) {
var d = deltas.slice().sort(num);
var l = lats.slice().sort(num);
var P = d.length ? d[Math.floor(d.length / 2)] : 0;
var raf = [0, 0, 0, 0];
var sum = 0;
for (var i = 0; i < d.length; i++) {
sum += d[i];
raf[bucket(d[i], P)]++;
}
return {
raf: raf, P: r1(P), avg: sum > 0 ? Math.round(d.length * 1000 / sum) : 0,
p95: r1(pct(d, 0.95)), lat95: l.length ? r1(pct(l, 0.95)) : null
};
}


function totals() {
var d = [];
var lat = [];
var out = { long: 0, loaf: 0, loafMs: 0 };
for (var i = 0; i < state.slots.length; i++) {
var slot = state.slots[i];
out.long += slot.long;
out.loaf += slot.loaf;
out.loafMs += slot.loafMs;
d.push.apply(d, slot.d);
lat.push.apply(lat, slot.lat);
}
out.stats = windowStats(d, lat);
return out;
}





function longText(l) {
if (!l) return 'n/a';
return l.win + '/' + l.total;
}








function loafText(l) {
if (!l) return 'n/a';
return l.n + '/' + Math.round(l.ms);
}

function orNa(v) {
return v === null || typeof v === 'undefined' ? 'n/a' : v;
}










function tint(d) {
var t = d.tint;
if (!t || !t.state) return 'n/a';
return t.state + (t.color ? ' ' + t.color : '') + (t.url ? ' ' + t.url : '');
}























function format(d) {
return d.fps + ' fps · avg ' + orNa(d.avg) + ' · p95 ' + orNa(d.p95) +
' · raf ' + d.raf.join('/') + ' P' + orNa(d.P) + ' · lat95 ' + orNa(d.lat95) +
' · long ' + longText(d.long) + ' · loaf ' + loafText(d.loaf) +
' · eps ' + d.eps + ' · layers ' + d.layers + '+' + (d.hid || 0) +
' · ' + d.w + '×' + d.h + '@' + d.dpr + ' · cr ' + d.cr + ' · ' + d.mode +
' · hw ' + d.hw + ' · pf ' + pfText(d.pf) + ' · tr ' + (d.tr || 'n/a') + ' · tint ' + tint(d);
}

function pfText(p) {
if (!p) return 'n/a';
return p.fly + '/' + p.queue + '/' + p.hits;
}


function prefetchStats() {
try {
if (LC.prefetch && typeof LC.prefetch.stats === 'function') return LC.prefetch.stats();
} catch (e) { }
return null;
}


function trailerStatus() {
try {
if (LC.trailer && typeof LC.trailer.status === 'function') return LC.trailer.status();
} catch (e) { }
return null;
}




function accentStatus() {
try {
if (LC.accent && typeof LC.accent.status === 'function') return LC.accent.status();
} catch (e) { }
return null;
}











function hardware() {
var cores = 'n/a';
var mem = 'n/a';
try {
var nav = window.navigator;
if (nav) {
if (Number(nav.hardwareConcurrency) > 0) cores = Math.round(Number(nav.hardwareConcurrency)) + 'c';
if (typeof nav.deviceMemory !== 'undefined' && nav.deviceMemory !== null && Number(nav.deviceMemory) > 0) {
mem = Number(nav.deviceMemory) + 'gb';
}
}
} catch (e) { }
return cores + '/' + mem;
}





function chrome() {
try {
var nav = window.navigator;
var m = nav && nav.userAgent ? ('' + nav.userAgent).match(/Chrom(?:e|ium)\/(\d+)/) : null;
if (m) return m[1];
} catch (e) { }
return 'n/a';
}
























var FULL = '.lumen-hero__bg,.lumen-hero__lqip,.lumen-hero__scrim,.lumen-hero__floor,.lumen-hero__trailer,.lumen-fx,' +
'.lumen-backdrop__img,.lumen-backdrop__veil,.lumen-backdrop .lumen-bg__img,' +
'.lumen-ambient,.lumen-ambient__img,.lumen-overlay__img,.lumen-roulette__bg,' +
'.lumen-hero,.lumen-main .scroll.layer--wheight';












function layerCounts() {
var out = { on: 0, off: 0 };
try {
var list = document.querySelectorAll(FULL);
for (var i = 0; i < list.length; i++) {
if (LC.util.onScreen(list[i])) out.on++;
else out.off++;
}
} catch (e) { }
return out;
}

function layers() {
return layerCounts().on;
}














function eps() {
try { return document.querySelectorAll(LC.util.ON_SCREEN_SEL + ' .lumen-episode').length; } catch (e) { return 0; }
}





function raf(fn) {
try {
if (window.requestAnimationFrame) return window.requestAnimationFrame(fn);
} catch (e) { }
return 0;
}

function unraf(id) {
try {
if (id && window.cancelAnimationFrame) window.cancelAnimationFrame(id);
} catch (e) { }
}





function lateness(t) {
try {
if (window.performance && typeof window.performance.now === 'function') {
var late = window.performance.now() - t;
return late > 0 ? late : 0;
}
} catch (e) { }
return -1;
}



function observe(type, onEntries) {
try {
var PO = window.PerformanceObserver;
if (!PO || !PO.supportedEntryTypes || PO.supportedEntryTypes.indexOf(type) === -1) return null;
var obs = new PO(function (list) {
if (state) onEntries(list.getEntries());
});
if (type === 'longtask') obs.observe({ entryTypes: ['longtask'] });
else obs.observe({ type: type });
return obs;
} catch (e) { }
return null;
}










function paint(t) {
if (!state) return;

var late = lateness(t);
if (!state.last) {
state.last = t;


state.prev = t;
state.raf = raf(paint);
return;
}
state.frames++;






var slot = state.slots[state.at];
slot.d.push(t - state.prev);
if (late >= 0) slot.lat.push(late);
state.prev = t;
var elapsed = t - state.last;
if (elapsed >= 1000) {
var mode = 'n/a';
try { mode = LC.motionMode(); } catch (e) { }





var sums = totals();
var st = sums.stats;
var lay = layerCounts();
state.node.textContent = format({
fps: Math.round(state.frames * 1000 / elapsed), avg: st.avg, p95: st.p95, P: st.P, lat95: st.lat95,
w: window.innerWidth, h: window.innerHeight,
dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
cr: chrome(), mode: mode,
long: state.longSup ? { win: sums.long, total: state.longTotal } : null,
loaf: state.loafSup ? { n: sums.loaf, ms: sums.loafMs } : null,
raf: st.raf, eps: eps(), layers: lay.on, hid: lay.off, hw: hardware(), pf: prefetchStats(), tr: trailerStatus(), tint: accentStatus()
});
state.frames = 0; state.last = t;



state.at = (state.at + 1) % SLOTS;
resetSlot(state.slots[state.at]);
}
state.raf = raf(paint);
}

function start() {
if (state) return;
var node = document.createElement('div');
node.className = 'lumen-hud';
document.body.appendChild(node);
var slots = [];
for (var i = 0; i < SLOTS; i++) slots.push(newSlot());
state = { node: node, frames: 0, last: 0, prev: 0, longTotal: 0, longSup: false, loafSup: false,
slots: slots, at: 0, raf: 0, obs: null, loafObs: null };







state.obs = observe('longtask', function (entries) {
state.longTotal += entries.length;
state.slots[state.at].long += entries.length;
});



state.longSup = !!state.obs;



state.loafObs = observe('long-animation-frame', function (entries) {
var slot = state.slots[state.at];
for (var i = 0; i < entries.length; i++) {
slot.loaf++;
slot.loafMs += Number(entries[i].blockingDuration) || 0;
}
});
state.loafSup = !!state.loafObs;
state.raf = raf(paint);
}

function stop() {
if (!state) return;
unraf(state.raf);
try { if (state.obs) state.obs.disconnect(); } catch (e2) { }
try { if (state.loafObs) state.loafObs.disconnect(); } catch (e4) { }
try { state.node.parentNode.removeChild(state.node); } catch (e3) { }
state = null;
}








function sync() {
var on = false;
try {




on = LC.pref('lumen_debug_hud', false) && LC.enabled();
} catch (e) { on = false; }
if (on) start(); else stop();
}

return {
sync: sync, stop: stop, format: format, running: function () { return !!state; }, layers: layers,


windowStats: windowStats,

layerCounts: layerCounts,


eps: eps, chrome: chrome,



hardware: hardware
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.hud;


/* ---- 70_progress.js ---- */







LC.progress = (function () {



var WATCHED = 95;




function episodeHash(season, episode, key, hash) {
return hash([season, season > 10 ? ':' : '', episode, key].join(''));
}

function percentOf(v) {
return v ? Number(v.percent) || 0 : 0;
}

function movieProgress(movie, view, hash) {
var key = movie.original_title || movie.original_name || movie.title || movie.name;
if (!key) return null;
var v = view(hash(key));
if (v && v.percent > 0 && v.percent < WATCHED) return { view: v, season: 0, episode: 0 };
return null;
}

























function lastAiredIndex(episodes, now) {
var last = -1;
for (var i = 0; i < episodes.length; i++) {
var days = episodes[i] ? LC.util.daysUntil(episodes[i].air_date, now) : null;
if (days !== null && days <= 0) last = i;
}
return last;
}

function fromEpisodes(key, episodes, view, hash, now) {
var best = null, afterDone = null, done = false, touched = false;
var airedTo = lastAiredIndex(episodes, now);
for (var i = 0; i < episodes.length; i++) {
var ep = episodes[i];
if (!ep || !(ep.episode_number > 0)) continue;
var season = parseInt(ep.season_number, 10) || 0;
if (!season) continue;

var v = view(episodeHash(season, ep.episode_number, key, hash));
var percent = percentOf(v);

if (percent >= WATCHED) {


done = true;
touched = true;
afterDone = null;
} else if (percent > 0) {
touched = true;
if (!best || (v.updated || 0) >= (best.view.updated || 0)) {
best = { view: v, season: season, episode: ep.episode_number };
}
} else if (done && !afterDone && i <= airedTo) {
afterDone = { view: v || { percent: 0 }, season: season, episode: ep.episode_number };
}
}
return { found: best || afterDone, touched: touched };
}





function scanAll(key, movie, view, hash) {
var maxSeason = parseInt(movie.number_of_seasons, 10) || 1;
if (maxSeason > 10) maxSeason = 10;
if (maxSeason < 1) maxSeason = 1;

var best = null;
for (var s = 1; s <= maxSeason; s++) {
for (var ep = 1; ep <= 30; ep++) {
var v = view(episodeHash(s, ep, key, hash));
if (v && v.percent > 0 && v.percent < WATCHED) {
if (!best || (v.updated || 0) >= (best.view.updated || 0)) {
best = { view: v, season: s, episode: ep };
}
}
}
}
return best;
}




function serialProgress(movie, view, hash, episodes, now) {
var key = movie.original_name || movie.original_title || movie.name || movie.title;
if (!key) return null;

if (episodes && episodes.length) {
var last = fromEpisodes(key, episodes, view, hash, now);
if (last.found || last.touched) return last.found;
}
return scanAll(key, movie, view, hash);
}

function episodeOf(episodes, season, episode) {
if (!episodes) return null;
for (var i = 0; i < episodes.length; i++) {
var ep = episodes[i];
if (ep && (parseInt(ep.season_number, 10) || 0) === season && ep.episode_number === episode) return ep;
}
return null;
}










function label(found, episodes, words) {
if (!found || !found.season) return '';
var out = 'S' + found.season + ' E' + found.episode;
var ep = episodeOf(episodes, found.season, found.episode);
if (ep && ep.name) out += ' «' + ep.name + '»';
if (!percentOf(found.view) && ep && ep.runtime > 0 && words && words.min) {
out += ' · ' + ep.runtime + ' ' + words.min;
}
return out;
}








function episodeState(view, airDate, now, runtimeMin) {
var percent = view ? Number(view.percent) || 0 : 0;
if (percent >= WATCHED) return { state: 'watched' };
if (percent > 0) {
var leftMin = null;
if (view.duration > 0) leftMin = Math.max(1, Math.floor((view.duration - (view.time || 0)) / 60));
else if (runtimeMin > 0) leftMin = Math.max(1, Math.round(runtimeMin * (100 - percent) / 100));


return { state: 'watching', percent: Math.max(1, Math.round(percent)), leftMin: leftMin };
}
var days = LC.util.daysUntil(airDate, now);
return { state: days === null || days > 0 ? 'soon' : 'aired' };
}

return {
movieProgress: movieProgress,
serialProgress: serialProgress,
episodeState: episodeState,
label: label
};
})();





if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.progress;


/* ---- 80_settings.js ---- */










LC.STRINGS = {
lumen_card_title: { ru: 'Lumen Card', en: 'Lumen Card', uk: 'Lumen Card' },






lumen_card_unsupported: {
ru: 'Lumen Card: версия Lampa не поддерживается',
en: 'Lumen Card: this Lampa version is not supported',
uk: 'Lumen Card: версія Lampa не підтримується'
},





lumen_card_enabled_name: { ru: 'Включить Lumen Card', en: 'Enable Lumen Card', uk: 'Увімкнути Lumen Card' },
lumen_card_enabled_descr: {
ru: 'Выключите — вернётся штатная карточка Lampa. Открытая карточка перерисуется при следующем открытии.',
en: 'Turn off to get the stock Lampa card back. An open card is redrawn the next time you open it.',
uk: 'Вимкніть — повернеться штатна картка Lampa. Відкрита картка перемалюється при наступному відкритті.'
},




lumen_card_group_look: { ru: 'Оформление', en: 'Appearance', uk: 'Оформлення' },



lumen_group_preset: { ru: 'Готовый стиль', en: 'Ready-made style', uk: 'Готовий стиль' },















lumen_preset_appletv_name: { ru: 'Применить стиль Apple TV', en: 'Apply the Apple TV style', uk: 'Застосувати стиль Apple TV' },
lumen_preset_appletv_descr: {
ru: 'Нейтральный стиль вместо тёплого. Выставляет десять пунктов «Оформления» разом: тема «Глубокая чёрная», акцент «Графит», шрифт Inter, метки «В подписи», цвет постера «Только фон», плоский вид включён, блоки анализа Lampa скрыты, кадр над рядами «Крупный», логотип названия в кадре включён, акцент от постера включён. Последние три — значения по умолчанию плагина: если вы меняли их руками, кнопка вернёт их обратно. Ключ API, масштаб, анимации, заставку, состав рядов и настройки самой Lampa не трогает. После кнопки любой пункт правится по отдельности.',
en: 'A neutral style instead of the warm one. It sets ten items of "Appearance" at once: the "Deep black" theme, the "Graphite" accent, the Inter font, badges "In the caption", poster colour "Background only", flat look on, the Lampa analysis blocks hidden, hero "Large", the title logo in the hero on, accent from poster on. The last three are the plugin defaults: if you changed them by hand, the button changes them back. The API key, scale, animations, screensaver, row selection and Lampa own settings stay untouched. After the button every item can be adjusted one by one.',
uk: 'Нейтральний стиль замість теплого. Виставляє десять пунктів «Оформлення» разом: тема «Глибока чорна», акцент «Графіт», шрифт Inter, мітки «У підписі», колір постера «Лише тло», плаский вигляд увімкнено, блоки аналізу Lampa сховано, кадр над рядами «Великий», логотип назви в кадрі увімкнено, акцент від постера увімкнено. Останні три — значення за замовчуванням плагіна: якщо ви змінювали їх руками, кнопка поверне їх назад. Ключ API, масштаб, анімації, заставку, склад рядів і налаштування самої Lampa не чіпає. Після кнопки кожен пункт правиться окремо.'
},
lumen_preset_lumen_name: { ru: 'Вернуть стиль Lumen', en: 'Restore the Lumen style', uk: 'Повернути стиль Lumen' },
lumen_preset_lumen_descr: {
ru: 'Возвращает те же десять пунктов к значениям по умолчанию плагина: тёплая тёмная тема, песочный акцент, шрифт Golos Text, метки «На постере», полная подкраска от постера, плоский вид выключен, блоки анализа Lampa показаны, кадр над рядами «Крупный», логотип названия в кадре включён, акцент от постера включён. Настройки вне оформления остаются вашими.',
en: 'Returns the same ten items to the plugin defaults: warm dark theme, sand accent, the Golos Text font, badges "On the poster", full poster tinting, flat look off, the Lampa analysis blocks shown, hero "Large", the title logo in the hero on, accent from poster on. Everything outside the look stays yours.',
uk: 'Повертає ті самі десять пунктів до значень за замовчуванням плагіна: тепла темна тема, піщаний акцент, шрифт Golos Text, мітки «На постері», повне підфарбування від постера, плаский вигляд вимкнено, блоки аналізу Lampa показано, кадр над рядами «Великий», логотип назви в кадрі увімкнено, акцент від постера увімкнено. Налаштування поза оформленням лишаються вашими.'
},




lumen_preset_appletv_short: { ru: 'Стиль Apple TV', en: 'Apple TV style', uk: 'Стиль Apple TV' },
lumen_preset_lumen_short: { ru: 'Стиль Lumen', en: 'Lumen style', uk: 'Стиль Lumen' },
lumen_preset_same: { ru: 'уже применён', en: 'already applied', uk: 'вже застосовано' },
lumen_group_motion: { ru: 'Движение и эффекты', en: 'Motion and effects', uk: 'Рух і ефекти' },
lumen_card_group_backdrop: { ru: 'Фон карточки', en: 'Card background', uk: 'Фон картки' },
lumen_card_group_blocks: { ru: 'Блоки карточки', en: 'Card blocks', uk: 'Блоки картки' },
lumen_group_nav: { ru: 'Навигация и пульт', en: 'Navigation and remote', uk: 'Навігація та пульт' },
lumen_group_roulette: { ru: 'Рулетка «Что посмотреть»', en: 'The "What to watch" roulette', uk: 'Рулетка «Що подивитися»' },
lumen_card_group_path: { ru: 'Меню и экраны плеера', en: 'Menus and player screens', uk: 'Меню та екрани плеєра' },
lumen_card_accent: { ru: 'Акцентный цвет', en: 'Accent color', uk: 'Акцентний колір' },



lumen_card_accent_descr: {
ru: 'Цвет кнопок, колец фокуса, полос прогресса и подсветок на экранах плагина. Применяется сразу.',
en: 'The colour of buttons, focus rings, progress bars and highlights on the plugin screens. Applied immediately.',
uk: 'Колір кнопок, кілець фокуса, смуг прогресу та підсвічувань на екранах плагіна. Застосовується одразу.'
},
lumen_card_accent_sand: { ru: 'Песок', en: 'Sand', uk: 'Пісок' },
lumen_card_accent_ice: { ru: 'Лёд', en: 'Ice', uk: 'Лід' },
lumen_card_accent_wine: { ru: 'Вино', en: 'Wine', uk: 'Вино' },
lumen_card_accent_mint: { ru: 'Мята', en: 'Mint', uk: 'М\'ята' },


lumen_card_accent_copper: { ru: 'Медь', en: 'Copper', uk: 'Мідь' },
lumen_card_accent_garnet: { ru: 'Гранат', en: 'Garnet', uk: 'Гранат' },
lumen_card_accent_emerald: { ru: 'Изумруд', en: 'Emerald', uk: 'Смарагд' },
lumen_card_accent_lavender: { ru: 'Лаванда', en: 'Lavender', uk: 'Лаванда' },
lumen_card_accent_graphite: { ru: 'Графит', en: 'Graphite', uk: 'Графіт' },







lumen_accent_auto_name: { ru: 'Акцент от постера', en: 'Accent from poster', uk: 'Акцент від постера' },
lumen_accent_auto_descr: {
ru: 'В открытой карточке цвет кнопок, колец фокуса и подсветок берётся из постера фильма. На главной от постера под фокусом меняются фон страницы, вуаль кадра и подложка карточки под фокусом — когда фокус постоял на карточке 3 секунды; при быстром листании ничего не считается. Тёмный цвет плагин высветляет, чтобы подписи читались; если постер не отдаёт пиксели, остаётся акцент, выбранный выше.',
en: 'Inside an open film card the colour of buttons, focus rings and highlights is taken from the poster. On the home screen the poster under focus changes the page background, the hero veil and the plate under the focused card — once focus has rested on a card for 3 seconds; fast browsing computes nothing. A dark colour is lightened so that labels stay readable; if the poster does not give up its pixels, the accent chosen above stays in place.',
uk: 'У відкритій картці колір кнопок, кілець фокуса та підсвічувань береться з постера фільму. На головній від постера під фокусом змінюються тло сторінки, вуаль кадру та підкладка картки під фокусом — коли фокус постояв на картці 3 секунди; при швидкому гортанні нічого не рахується. Темний колір плагін висвітлює, щоб підписи читалися; якщо постер не віддає пікселі, залишається акцент, вибраний вище.'
},




lumen_accent_scope_name: { ru: 'Где виден цвет постера', en: 'Where the poster colour shows', uk: 'Де видно колір постера' },
lumen_accent_scope_descr: {
ru: '«Полная» — цветом постера подкрашиваются и фон с вуалью кадра, и подложка карточки под фокусом. «Только фон» оставляет цвет в фоне, а карточка под фокусом остаётся нейтральной и просто увеличивается. Действует при включённом «Акценте от постера». Применяется сразу.',
en: '"Everywhere" tints both the background with the hero veil and the plate under the focused card. "Background only" keeps the colour in the background, while the focused card stays neutral and simply grows. Works with "Accent from poster" on. Applied immediately.',
uk: '«Повна» — кольором постера підфарбовуються і тло з вуаллю кадру, і підкладка картки під фокусом. «Лише тло» лишає колір у тлі, а картка під фокусом залишається нейтральною і просто збільшується. Діє за увімкненого «Акценту від постера». Застосовується одразу.'
},
lumen_accent_scope_full: { ru: 'Полная', en: 'Everywhere', uk: 'Повна' },
lumen_accent_scope_veil: { ru: 'Только фон', en: 'Background only', uk: 'Лише тло' },






lumen_fx_name: { ru: 'Атмосферы', en: 'Atmospheres', uk: 'Атмосфери' },
lumen_fx_descr: {
ru: 'Лёгкий слой поверх кадра под тему фильма: снег у рождественского кино, летучие мыши у хоррора на Хэллоуин, звёзды у фантастики, дождь у нуара. Тема определяется по ключевым словам фильма. «Только сезонные» показывает лишь праздничные темы и лишь в свой месяц. Не запускается при лёгких и выключенных анимациях, а значит и на слабых телевизорах; под играющим трейлером встаёт на паузу.',
en: 'A light layer over the still matching the film: snow for Christmas films, bats for Halloween horror, stars for science fiction, rain for noir. The theme is chosen by the film keywords. "Seasonal only" shows holiday themes and only in their month. It never starts with light or disabled animations, and therefore not on weak TVs; it pauses while a trailer is playing.',
uk: 'Легкий шар поверх кадру під тему фільму: сніг для різдвяного кіно, кажани для горору на Гелловін, зорі для фантастики, дощ для нуару. Тема визначається за ключовими словами фільму. «Лише сезонні» показує тільки святкові теми і лише в їхній місяць. Не запускається за легких і вимкнених анімацій, а отже й на слабких телевізорах; під час трейлера стає на паузу.'
},


lumen_group_ambient: { ru: 'Экранная заставка', en: 'Screensaver', uk: 'Екранна заставка' },








lumen_ambient_name: { ru: 'Заставка из кадров', en: 'Frame screensaver', uk: 'Заставка з кадрів' },
lumen_ambient_descr: {
ru: 'Заменяет заставку Lampa: вместо её видео экран сменяется кадрами из фильмов в полный размер, с названием и часами. Работает, только когда собственная заставка Lampa выключена в её настройках — двух заставок разом не бывает. Любое нажатие возвращает экран мгновенно, и первое нажатие фокус не двигает. Не включается при играющем трейлере, открытом плеере, меню и в неактивной вкладке, а при выключенных анимациях не работает вовсе. Применяется сразу.',
en: 'Replaces the Lampa screensaver: instead of its video the screen turns into full-size film stills with the title and a clock. Works only while the Lampa screensaver itself is off in its own settings — there are never two screensavers at once. Any key brings the screen back at once, and that first press does not move focus. It never starts while a trailer is playing, while the player or a menu is open, or in a background tab, and it does not work at all with animations off. Applied immediately.',
uk: 'Замінює заставку Lampa: замість її відео екран змінюється кадрами з фільмів на весь розмір, з назвою та годинником. Працює, лише коли власну заставку Lampa вимкнено в її налаштуваннях — двох заставок водночас не буває. Будь-яке натискання миттєво повертає екран, і перше натискання не рухає фокус. Не вмикається під час трейлера, з відкритим плеєром чи меню та в неактивній вкладці, а з вимкненими анімаціями не працює зовсім. Застосовується одразу.'
},
lumen_ambient_source_name: { ru: 'Какие кадры', en: 'Which stills', uk: 'Які кадри' },
lumen_ambient_source_descr: {
ru: '«Известные фильмы» — отобранный список кадров из каталога плагина, он обновляется вместе с ним. «Кадры открытого фильма» показывает кадры той карточки, что осталась на экране, и падает на отобранный список, если карточки нет.',
en: '"Famous films" is a curated list of stills from the plugin catalog, updated together with it. "Stills of the open film" shows the frames of the card left on screen and falls back to the curated list when there is no card.',
uk: '«Відомі фільми» — дібраний список кадрів з каталогу плагіна, він оновлюється разом із ним. «Кадри відкритого фільму» показує кадри тієї картки, що лишилася на екрані, і падає на дібраний список, якщо картки немає.'
},
lumen_ambient_source_curated: { ru: 'Известные фильмы', en: 'Famous films', uk: 'Відомі фільми' },
lumen_ambient_source_current: { ru: 'Кадры открытого фильма', en: 'Stills of the open film', uk: 'Кадри відкритого фільму' },
lumen_ambient_delay_name: { ru: 'Через сколько включать', en: 'Idle time before start', uk: 'Через скільки вмикати' },
lumen_ambient_delay_descr: {
ru: 'Сколько пульт должен молчать, прежде чем включится заставка. Отсчёт начинается заново от любого нажатия. Применяется сразу.',
en: 'How long the remote has to stay silent before the screensaver starts. Any key press restarts the countdown. Applied immediately.',
uk: 'Скільки пульт має мовчати, перш ніж увімкнеться заставка. Відлік починається знову від будь-якого натискання. Застосовується одразу.'
},

lumen_ambient_minutes: { ru: 'мин', en: 'min', uk: 'хв' },



lumen_roulette_title: { ru: 'Что посмотреть', en: 'What to watch', uk: 'Що подивитися' },
lumen_roulette_movies: { ru: 'Фильмы', en: 'Movies', uk: 'Фільми' },
lumen_roulette_series: { ru: 'Сериалы', en: 'Series', uk: 'Серіали' },
lumen_roulette_all: { ru: 'Все подборки', en: 'All collections', uk: 'Усі підбірки' },
lumen_roulette_spin: { ru: 'Крутить', en: 'Spin', uk: 'Крутити' },
lumen_roulette_again: { ru: 'Ещё раз', en: 'Again', uk: 'Ще раз' },
lumen_roulette_watch: { ru: 'Смотреть', en: 'Watch', uk: 'Дивитися' },
lumen_roulette_book: { ru: 'В закладки', en: 'Bookmark', uk: 'У закладки' },
lumen_roulette_booked: { ru: 'Добавлено в закладки', en: 'Added to bookmarks', uk: 'Додано в закладки' },

lumen_roulette_booked_already: { ru: 'Уже в закладках', en: 'Already in bookmarks', uk: 'Вже в закладках' },
lumen_roulette_unseen: { ru: 'Не смотрел', en: 'Not watched', uk: 'Не дивився' },
lumen_roulette_short_movie: { ru: 'Есть 90 минут', en: '90 minutes to spare', uk: 'Є 90 хвилин' },
lumen_roulette_short_tv: { ru: 'Серия до 30 минут', en: 'Episode under 30 min', uk: 'Серія до 30 хвилин' },







lumen_roulette_pick: {
ru: 'в выборке',
en: 'in the pick',
uk: 'у вибірці'
},

lumen_roulette_more: { ru: 'Ещё в выборке', en: 'More in the pick', uk: 'Ще у вибірці' },
lumen_roulette_empty: {
ru: 'Под фильтры ничего не подошло',
en: 'Nothing matches the filters',
uk: 'Під фільтри нічого не підійшло'
},

lumen_roulette_unseen_name: { ru: 'Рулетка: только непросмотренное', en: 'Roulette: unwatched only', uk: 'Рулетка: лише непереглянуте' },
lumen_roulette_unseen_descr: {
ru: 'С чего начинается фильтр «Не смотрел» при входе в рулетку. Просмотренным считается то, что отмечено в Lampa или досмотрено до конца. Сам фильтр в рулетке можно снять и включить чипом.',
en: 'The starting state of the "Not watched" filter when the roulette opens. Watched means marked in Lampa or played to the end. The filter itself can be toggled by a chip on the roulette screen.',
uk: 'З чого починається фільтр «Не дивився» під час входу в рулетку. Переглянутим вважається те, що позначено в Lampa або додивлено до кінця. Сам фільтр у рулетці можна зняти й увімкнути чипом.'
},
lumen_fx_all: { ru: 'Все', en: 'All', uk: 'Усі' },
lumen_fx_seasonal: { ru: 'Только сезонные', en: 'Seasonal only', uk: 'Лише сезонні' },
lumen_fx_off: { ru: 'Выключены', en: 'Off', uk: 'Вимкнені' },

lumen_season_badge: { ru: 'Сезон', en: 'In season', uk: 'Сезон' },
lumen_advent_title: { ru: 'Адвент-календарь', en: 'Advent calendar', uk: 'Адвент-календар' },
lumen_advent_day: { ru: 'День', en: 'Day', uk: 'День' },
lumen_advent_today: { ru: 'Сегодня', en: 'Today', uk: 'Сьогодні' },
lumen_motion_auto_noty: {
ru: 'Lumen Card: включены лёгкие анимации — устройство не успевает рисовать полные',
en: 'Lumen Card: light animations enabled — this device cannot keep up with the full ones',
uk: 'Lumen Card: увімкнено легкі анімації — пристрій не встигає малювати повні'
},

lumen_theme_name: { ru: 'Тема', en: 'Theme', uk: 'Тема' },
lumen_theme_descr: {
ru: 'Цвет тёмного фона. «Глубокая чёрная» — настоящий чёрный без тёплого оттенка, для OLED-экранов. Применяется сразу.',
en: 'The colour of the dark background. "Deep black" is true black without the warm tint, for OLED screens. Applied immediately.',
uk: 'Колір темного тла. «Глибока чорна» — справжній чорний без теплого відтінку, для OLED-екранів. Застосовується одразу.'
},
lumen_theme_warm: { ru: 'Тёплая тёмная', en: 'Warm dark', uk: 'Тепла темна' },
lumen_theme_black: { ru: 'Глубокая чёрная', en: 'Deep black', uk: 'Глибока чорна' },

lumen_solid_name: { ru: 'Плотные подложки', en: 'Solid panels', uk: 'Щільні підкладки' },
lumen_solid_descr: {
ru: 'Кнопки, чипы и подложки текста становятся сплошными, без просвечивающего кадра и размытия. Включите, если на телевизоре картинка мылит или подтормаживает.',
en: 'Buttons, chips and text panels become opaque, with no show-through backdrop and no blur. Turn on if the picture looks smeared or stutters on your TV.',
uk: 'Кнопки, чипи та підкладки тексту стають суцільними, без просвічування кадру і розмиття. Увімкніть, якщо на телевізорі картинка мулиться або підгальмовує.'
},
















lumen_flat_name: { ru: 'Плоский вид', en: 'Flat look', uk: 'Плаский вигляд' },
lumen_flat_descr: {
ru: 'Содержимое лежит прямо на фоне, а не в коробках: в карточке панель «Подробно» становится строкой фактов под описанием, счётчики разделов теряют плашки, отзывы — рамки и подложки, а у плиток серий кадр встаёт сверху во всю ширину, название и подпись уходят под него (ряд серий из-за этого чуть выше); на пути TorrServer раздачи и файлы разделяются тонкими линиями вместо карточек. В сетке подборки и в хабе меняется немногое: снимается только подложка под плиткой, а её видно, пока не пришёл постер или кадр, и у карточек без картинки. Экран «Что посмотреть» собирается как «Смотреть» в Apple TV: кадр 16:9 вместо постера и полка карточек с логотипами названий — со следующего открытия экрана. Фокус и размер текста не меняются. Применяется сразу.',
en: 'Content sits on the background instead of inside boxes: on the card the "Details" panel becomes a line of facts under the description, section counters lose their plates, reviews lose frames and panels, and on episode tiles the still moves to the top across the full width with the name and caption below it (which makes the episode row a little taller); on the TorrServer path releases and files are separated by thin lines instead of cards. In the collection grid and the hub little changes: only the plate under a tile is removed, and it is visible only until the poster or still arrives, and on items without an image. The "What to watch" screen is laid out like Apple TV "Watch Now": a 16:9 still instead of a poster and a shelf of cards with title logos — from the next time the screen opens. Focus and text size stay as they are. Applied immediately.',
uk: 'Вміст лежить прямо на тлі, а не в коробках: у картці панель «Докладно» стає рядком фактів під описом, лічильники розділів втрачають плашки, відгуки — рамки й підкладки, а в плиток серій кадр стає зверху на всю ширину, назва та підпис ідуть під нього (через це ряд серій трохи вищий); на шляху TorrServer роздачі та файли розділяються тонкими лініями замість карток. У сітці підбірки та в хабі змінюється небагато: знімається лише підкладка під плиткою, а її видно, доки не прийшов постер або кадр, і в карток без зображення. Екран «Що подивитися» збирається як «Дивитися» в Apple TV: кадр 16:9 замість постера і полиця карток із логотипами назв — з наступного відкриття екрана. Фокус і розмір тексту не змінюються. Застосовується одразу.'
},




























lumen_scale_name: { ru: 'Масштаб интерфейса', en: 'Interface scale', uk: 'Масштаб інтерфейсу' },
lumen_scale_descr: {
ru: 'Размер текста и блоков на экранах плагина: карточка, главная, подборки. Применяется сразу. Одно исключение: если в самой Lampa выбран «Размер интерфейса: крупнее», она уже увеличила карточки рядов главной, и при настройке «Кадр над рядами» в значении «Крупный» наш масштаб там упирается в высоту экрана — «Ещё крупнее» даёт почти те же ряды, что «Крупнее», иначе подпись первого ряда не поместилась бы. При меньшем кадре и на других размерах интерфейса ограничения нет, и на остальных экранах плагина масштаб действует целиком.',
en: 'The size of text and blocks on the plugin screens: card, home and collections. Applied immediately. One exception: if Lampa\'s own "Interface size" is set to larger, it has already enlarged the home row cards, and with "Hero over the rows" set to "Large" our scale there runs into the screen height — "Largest" gives almost the same rows as "Larger", otherwise the first row caption would not fit. With a smaller frame and on the other interface sizes there is no cap, and on the other plugin screens the scale applies in full.',
uk: 'Розмір тексту та блоків на екранах плагіна: картка, головна, підбірки. Застосовується одразу. Один виняток: якщо в самій Lampa вибрано «Розмір інтерфейсу: більше», вона вже збільшила картки рядів головної, і з налаштуванням «Кадр над рядами» у значенні «Великий» наш масштаб там упирається у висоту екрана — «Ще більше» дає майже ті самі ряди, що «Більше», інакше підпис першого ряду не помістився б. З меншим кадром і на інших розмірах інтерфейсу обмеження немає, а на решті екранів плагіна масштаб діє повністю.'
},
lumen_scale_small: { ru: 'Мельче', en: 'Smaller', uk: 'Дрібніше' },
lumen_scale_normal: { ru: 'Обычный', en: 'Normal', uk: 'Звичайний' },
lumen_scale_large: { ru: 'Крупнее', en: 'Larger', uk: 'Більше' },
lumen_scale_huge: { ru: 'Ещё крупнее', en: 'Largest', uk: 'Ще більше' },
lumen_card_fonts_name: { ru: 'Фирменные шрифты', en: 'Custom fonts', uk: 'Фірмові шрифти' },
lumen_card_fonts_descr: {
ru: 'Шрифты с Google Fonts. Требуется интернет. Выключите, если шрифты не грузятся.',
en: 'Fonts from Google Fonts. Requires internet access.',
uk: 'Шрифти з Google Fonts. Потрібен інтернет.'
},




lumen_card_logo_name: { ru: 'Логотип названия в карточке', en: 'Title logo on the card', uk: 'Логотип назви в картці' },
lumen_card_logo_descr: {
ru: 'Вместо набранного названия — логотип фильма, как в кадре главной. Если логотипа на языке интерфейса нет, берётся английский. Выключите, чтобы в карточке всегда было название текстом. Применяется сразу.',
en: 'The film logo instead of the typed title, as in the home hero. If there is no logo in the interface language, the English one is used. Turn off to always see the title as text on the card. Applied immediately.',
uk: 'Замість набраної назви — логотип фільму, як у кадрі головної. Якщо логотипа мовою інтерфейсу немає, береться англійський. Вимкніть, щоб у картці завжди була назва текстом. Застосовується одразу.'
},
lumen_card_progress_name: { ru: 'Показывать «Продолжить»', en: 'Show "Continue"', uk: 'Показувати «Продовжити»' },



lumen_card_progress_descr: {
ru: 'Полоса с таймкодом и процентом в карточке того, что вы не досмотрели, подпись «Продолжить S2 E3» на кнопке «Смотреть» и отметки просмотра в карточках серий. Применяется сразу.',
en: 'The bar with the timecode and percentage on a card you have not finished, the "Continue S2 E3" label on the Watch button and the watched marks on episode cards. Applied immediately.',
uk: 'Смуга з таймкодом і відсотком у картці того, що ви не додивилися, підпис «Продовжити S2 E3» на кнопці «Дивитися» та позначки перегляду в картках серій. Застосовується одразу.'
},





lumen_card_font_name: { ru: 'Шрифт', en: 'Font', uk: 'Шрифт' },
lumen_card_font_descr: {
ru: 'Шрифт интерфейса: им набрано всё — заголовки, текст и цифры. Действует только при включённых фирменных шрифтах. Применяется сразу.',
en: 'The interface font: headings, text and figures all use it. Works only with custom fonts on. Applied immediately.',
uk: 'Шрифт інтерфейсу: ним набрано все — заголовки, текст і цифри. Діє лише з увімкненими фірмовими шрифтами. Застосовується одразу.'
},
lumen_card_font_golos: { ru: 'Golos Text', en: 'Golos Text', uk: 'Golos Text' },
lumen_card_font_onest: { ru: 'Onest', en: 'Onest', uk: 'Onest' },
lumen_card_font_manrope: { ru: 'Manrope', en: 'Manrope', uk: 'Manrope' },
lumen_card_font_inter: { ru: 'Inter', en: 'Inter', uk: 'Inter' },
lumen_card_font_plex: { ru: 'IBM Plex Sans', en: 'IBM Plex Sans', uk: 'IBM Plex Sans' },
lumen_card_motion: { ru: 'Анимации', en: 'Animations', uk: 'Анімації' },
lumen_card_motion_descr: {
ru: '«Авто» — лёгкие анимации на Tizen/webOS, полные на остальных. «Лёгкие» оставляют смену кадров и трейлеры (на Tizen/webOS трейлеры по умолчанию выключены — пункт «Трейлер в фоне карточки»), но кадр меняется резко, без перехода. «Выкл» отключает всё движение: появление блоков, наезд, смену кадров и фоновые трейлеры.',
en: '"Auto" means light animations on Tizen/webOS and full ones elsewhere. "Light" keeps the changing stills and trailers (on Tizen/webOS trailers are off by default — see "Background trailer on the card"), but a still changes with a hard cut. "Off" disables all motion: block reveal, Ken Burns zoom, changing stills and background trailers.',
uk: '«Авто» — легкі анімації на Tizen/webOS, повні на інших. «Легкі» залишають зміну кадрів і трейлери (на Tizen/webOS трейлери за замовчуванням вимкнені — пункт «Трейлер у фоні картки»), але кадр змінюється різко, без переходу. «Викл» вимикає весь рух: появу блоків, наїзд, зміну кадрів і фонові трейлери.'
},
lumen_card_motion_auto: { ru: 'Авто', en: 'Auto', uk: 'Авто' },
lumen_card_motion_full: { ru: 'Полные', en: 'Full', uk: 'Повні' },
lumen_card_motion_lite: { ru: 'Лёгкие', en: 'Light', uk: 'Легкі' },
lumen_card_motion_off: { ru: 'Выкл', en: 'Off', uk: 'Викл' },



lumen_fx_heavy_name: { ru: 'Тяжёлые эффекты', en: 'Heavy effects', uk: 'Важкі ефекти' },
lumen_fx_heavy_descr: {
ru: 'Частицы, наезд на кадр, зум заставки и плавная смена кадров в карточке и на главной. Сами кадры и трейлеры работают и без них — кадр тогда меняется резко. На телевизоре выключены по умолчанию: они стоят кадров. Работают только при полных анимациях.',
en: 'Particles, Ken Burns zoom, screensaver zoom and the crossfade between stills on the card and the home screen. The changing stills and trailers work without them too — a still then changes with a hard cut. Off by default on a TV: they cost frames. Work only with full animations.',
uk: 'Частинки, наїзд на кадр, зум заставки та плавна зміна кадрів у картці й на головній. Самі кадри й трейлери працюють і без них — кадр тоді змінюється різко. На телевізорі вимкнені за замовчуванням: вони коштують кадрів. Працюють лише за повних анімацій.'
},




lumen_debug_hud_name: { ru: 'Отладка: показать FPS', en: 'Debug: show FPS', uk: 'Налагодження: показати FPS' },
lumen_debug_hud_descr: {
ru: 'Счётчик кадров, длинные задачи, разрешение и режим анимаций в углу экрана. Для проверки на телевизоре.',
en: 'Frame counter, long tasks, resolution and animation mode in the screen corner. For testing on a TV.',
uk: 'Лічильник кадрів, довгі задачі, роздільність та режим анімацій у кутку екрана. Для перевірки на телевізорі.'
},



lumen_debug_bench_name: { ru: 'Отладка: тест производительности', en: 'Debug: performance test', uk: 'Налагодження: тест продуктивності' },
lumen_debug_bench_descr: {
ru: 'Около минуты гоняет главную в восьми режимах и показывает таблицу — сфотографируйте её целиком. Запускайте с главной, фокус на первом ряду. Ваши настройки не меняются; любая кнопка прерывает тест.',
en: 'Runs the home screen through eight modes for about a minute and shows a table — take one photo of it. Start from the home screen with focus on the first row. Your settings are not changed; any key stops the test.',
uk: 'Близько хвилини ганяє головну у восьми режимах і показує таблицю — сфотографуйте її цілком. Запускайте з головної, фокус на першому ряду. Ваші налаштування не змінюються; будь-яка кнопка перериває тест.'
},
lumen_bench_need_home: {
ru: 'Тест производительности запускается с главной: откройте главную и нажмите кнопку снова',
en: 'The performance test runs from the home screen: open it and press the button again',
uk: 'Тест продуктивності запускається з головної: відкрийте головну й натисніть кнопку знову'
},
lumen_bench_running: { ru: 'тест · любая кнопка — стоп', en: 'test · any key stops', uk: 'тест · будь-яка кнопка — стоп' },
lumen_bench_stopped: { ru: 'прервано', en: 'stopped', uk: 'перервано' },
lumen_bench_back: { ru: 'Назад — закрыть', en: 'Back — close', uk: 'Назад — закрити' },



lumen_card_continue: { ru: 'Продолжить', en: 'Continue', uk: 'Продовжити' },
lumen_card_serial: { ru: 'СЕРИАЛ', en: 'SERIES', uk: 'СЕРІАЛ' },
lumen_card_min: { ru: 'мин', en: 'min', uk: 'хв' },
lumen_card_status_soon: { ru: 'Анонс', en: 'Announced', uk: 'Анонс' },
lumen_card_reactions: { ru: 'РЕАКЦИЙ', en: 'REACTIONS', uk: 'РЕАКЦІЙ' },
lumen_card_season: { ru: 'Сезон', en: 'Season', uk: 'Сезон' },
lumen_card_ep_watched: { ru: 'просмотрена', en: 'watched', uk: 'переглянута' },
lumen_card_ep_watching: { ru: 'смотрите', en: 'watching', uk: 'дивитесь' },
lumen_card_ep_left: { ru: 'осталось', en: 'left', uk: 'залишилось' },
lumen_card_ep_soon: { ru: 'не вышла', en: 'not aired', uk: 'не вийшла' },










lumen_card_facts: { ru: 'ПОДРОБНО', en: 'DETAILS', uk: 'ДОКЛАДНО' },



lumen_card_descr_more: { ru: 'OK — весь текст', en: 'OK — full text', uk: 'OK — увесь текст' },
lumen_card_fact_original: { ru: 'Оригинал', en: 'Original', uk: 'Оригінал' },
lumen_card_fact_premiere: { ru: 'Премьера', en: 'Premiere', uk: 'Прем\'єра' },
lumen_card_fact_creator: { ru: 'Создатель', en: 'Creator', uk: 'Творець' },
lumen_card_fact_budget: { ru: 'Бюджет', en: 'Budget', uk: 'Бюджет' },




lumen_card_next_episode: { ru: 'Следующая серия', en: 'Next episode', uk: 'Наступна серія' },
lumen_card_today: { ru: 'сегодня', en: 'today', uk: 'сьогодні' },
lumen_card_tomorrow: { ru: 'завтра', en: 'tomorrow', uk: 'завтра' },
lumen_card_in_days: { ru: 'через', en: 'in', uk: 'через' },
lumen_card_months_gen: {
ru: 'января,февраля,марта,апреля,мая,июня,июля,августа,сентября,октября,ноября,декабря',
en: 'January,February,March,April,May,June,July,August,September,October,November,December',
uk: 'січня,лютого,березня,квітня,травня,червня,липня,серпня,вересня,жовтня,листопада,грудня'
},
lumen_card_months_short: {
ru: 'янв,фев,мар,апр,мая,июн,июл,авг,сен,окт,ноя,дек',
en: 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec',
uk: 'січ,лют,бер,кві,тра,чер,лип,сер,вер,жов,лис,гру'
},
lumen_card_slideshow_name: { ru: 'Слайдшоу кадров', en: 'Backdrop slideshow', uk: 'Слайдшоу кадрів' },


lumen_card_slideshow_descr: {
ru: 'Кадры из фильма за текстом карточки сменяют друг друга. Выключите — останется один, первый кадр. Слайдшоу встаёт на паузу под трейлером и на карточке, оставленной позади. Применяется сразу.',
en: 'The film stills behind the card text replace one another. Turn it off and only the first still stays. The slideshow pauses under a trailer and on a card left behind. Applied immediately.',
uk: 'Кадри з фільму за текстом картки змінюють один одного. Вимкніть — залишиться один, перший кадр. Слайдшоу стає на паузу під трейлером і на картці, залишеній позаду. Застосовується одразу.'
},
lumen_card_slide_interval: { ru: 'Интервал смены кадров', en: 'Frame interval', uk: 'Інтервал зміни кадрів' },
lumen_card_slide_interval_descr: {
ru: 'Сколько секунд держится на экране один кадр фона карточки и кадр главной. В карточке действует только при включённом слайдшоу. Применяется сразу.',
en: 'How many seconds a single card background still and the home hero still stay on screen. On the card it works only with the slideshow on. Applied immediately.',
uk: 'Скільки секунд тримається на екрані один кадр тла картки і кадр головної. У картці діє лише з увімкненим слайдшоу. Застосовується одразу.'
},
lumen_card_seconds: { ru: 'с', en: 's', uk: 'с' },
lumen_card_menus: { ru: 'Оформление меню и окон', en: 'Menus and dialogs style', uk: 'Оформлення меню і вікон' },


lumen_card_menus_descr: {
ru: '«Только путь до плеера» — окна выбора озвучки, качества, серии и раздачи. «Все меню и окна» — ещё и прочие списки и диалоги Lampa. Меняется только вид: пункты, порядок и поведение окон остаются штатными. Применяется сразу.',
en: '"Player path only" covers the dialogs for voice-over, quality, episode and torrent choice. "All menus and dialogs" adds the rest of Lampa lists and dialogs. Only the look changes: items, order and behaviour stay stock. Applied immediately.',
uk: '«Лише шлях до плеєра» — вікна вибору озвучення, якості, серії та роздачі. «Усі меню і вікна» — ще й інші списки та діалоги Lampa. Змінюється лише вигляд: пункти, порядок і поведінка вікон лишаються штатними. Застосовується одразу.'
},
lumen_card_menus_all: { ru: 'Все меню и окна', en: 'All menus and dialogs', uk: 'Усі меню і вікна' },
lumen_card_menus_path: { ru: 'Только путь до плеера', en: 'Player path only', uk: 'Лише шлях до плеєра' },
lumen_card_menus_off: { ru: 'Выкл', en: 'Off', uk: 'Викл' },
lumen_card_torrents_name: { ru: 'Оформление экрана торрентов', en: 'Torrents screen style', uk: 'Оформлення екрана торентів' },
lumen_card_torrents_descr: {
ru: 'Список раздач, окна подключения и ошибок, списки файлов и предзагрузка — в стиле карточки.',
en: 'Torrent list, connection and error dialogs, file lists and preloading in the card style.',
uk: 'Список роздач, вікна підключення та помилок, списки файлів і передзавантаження — у стилі картки.'
},








lumen_card_trailer: { ru: 'Трейлер в фоне карточки', en: 'Background trailer on the card', uk: 'Трейлер у фоні картки' },
lumen_card_trailer_descr: {
ru: 'Трейлер с YouTube без звука через 3 с после открытия карточки. «Авто» — выключено на Tizen/webOS.',
en: 'Muted YouTube trailer 3 s after the card opens. "Auto" is off on Tizen/webOS.',
uk: 'Трейлер з YouTube без звуку через 3 с після відкриття картки. «Авто» — вимкнено на Tizen/webOS.'
},
lumen_card_trailer_auto: { ru: 'Авто', en: 'Auto', uk: 'Авто' },
lumen_card_trailer_on: { ru: 'Вкл', en: 'On', uk: 'Увімк' },
lumen_card_trailer_off: { ru: 'Выкл', en: 'Off', uk: 'Викл' },

lumen_card_stop: { ru: 'Стоп', en: 'Stop', uk: 'Стоп' },
lumen_card_trailer_badge: { ru: 'ТРЕЙЛЕР · БЕЗ ЗВУКА', en: 'TRAILER · MUTED', uk: 'ТРЕЙЛЕР · БЕЗ ЗВУКУ' },




lumen_card_reviews_name: { ru: 'Отзывы Кинопоиска', en: 'Kinopoisk reviews', uk: 'Відгуки Кінопошуку' },
lumen_card_reviews_descr: {
ru: 'Ряд отзывов зрителей в блоке описания. Нужен ключ API — строка ниже.',
en: 'A row of viewer reviews in the description block. Requires the API key below.',
uk: 'Ряд відгуків глядачів у блоці опису. Потрібен ключ API — рядок нижче.'
},
lumen_card_kp_key: { ru: 'Ключ Kinopoisk API', en: 'Kinopoisk API key', uk: 'Ключ Kinopoisk API' },




lumen_pref_unset: { ru: 'Не задан', en: 'Not set', uk: 'Не задано' },
lumen_pref_default_catalog: { ru: 'Каталог плагина', en: 'Plugin catalog', uk: 'Каталог плагіна' },


lumen_card_kp_key_descr: {
ru: 'Нужен для отзывов и рейтинга КП. Бесплатно на kinopoiskapiunofficial.tech, 500 запросов/день',
en: 'Needed for reviews and the KP rating. Free at kinopoiskapiunofficial.tech, 500 requests a day',
uk: 'Потрібен для відгуків і рейтингу КП. Безкоштовно на kinopoiskapiunofficial.tech, 500 запитів на день'
},
lumen_card_reviews_title: { ru: 'Отзывы зрителей', en: 'Viewer reviews', uk: 'Відгуки глядачів' },



lumen_card_reviews_src: { ru: 'Кинопоиск', en: 'Kinopoisk', uk: 'Кінопошук' },
lumen_card_review_good: { ru: 'Позитивный', en: 'Positive', uk: 'Позитивний' },
lumen_card_review_mid: { ru: 'Нейтральный', en: 'Neutral', uk: 'Нейтральний' },
lumen_card_review_bad: { ru: 'Негативный', en: 'Negative', uk: 'Негативний' },
lumen_card_review_useful: { ru: 'полезно', en: 'helpful', uk: 'корисно' },



lumen_reviews_mode_name: { ru: 'Текст отзывов в ряду', en: 'Review text in the row', uk: 'Текст відгуків у ряду' },
lumen_reviews_mode_descr: {
ru: '«Только заголовки» — в ряду видны автор, оценка и заголовок, а текст открывается по OK: случайный спойлер не попадётся на глаза. «С выдержкой» показывает начало отзыва прямо в ряду. Спойлерные куски скрыты в обоих режимах и раскрываются кнопкой в окне отзыва. Применяется сразу.',
en: '"Headlines only" shows the author, tone and title in the row and opens the text on OK, so a stray spoiler never catches your eye. "With excerpt" shows the beginning of the review in the row. Spoiler fragments stay hidden in both modes and are revealed by a button in the review window. Applied immediately.',
uk: '«Лише заголовки» — у ряду видно автора, оцінку і заголовок, а текст відкривається по OK: випадковий спойлер не трапиться на очі. «З уривком» показує початок відгуку просто в ряду. Спойлерні шматки приховані в обох режимах і розкриваються кнопкою у вікні відгуку. Застосовується одразу.'
},
lumen_reviews_mode_headlines: { ru: 'Только заголовки', en: 'Headlines only', uk: 'Лише заголовки' },
lumen_reviews_mode_full: { ru: 'С выдержкой', en: 'With excerpt', uk: 'З уривком' },


lumen_reviews_mode_toggle: { ru: 'Показывать текст', en: 'Show text', uk: 'Показувати текст' },

lumen_reviews_spoiler: { ru: 'Есть спойлер', en: 'Has spoilers', uk: 'Є спойлер' },

lumen_reviews_reveal: { ru: 'Показать спойлеры', en: 'Reveal spoilers', uk: 'Показати спойлери' },
lumen_reviews_hide: { ru: 'Скрыть спойлеры', en: 'Hide spoilers', uk: 'Сховати спойлери' },
lumen_card_anon: { ru: 'Аноним', en: 'Anonymous', uk: 'Анонім' },

lumen_card_reviews_nokey_title: { ru: 'Ключ API не задан', en: 'API key is not set', uk: 'Ключ API не задано' },
lumen_card_reviews_nokey_text: {
ru: 'Рейтинг Кинопоиска и отзывы недоступны без ключа.',
en: 'Kinopoisk rating and reviews are unavailable without a key.',
uk: 'Рейтинг Кінопошуку та відгуки недоступні без ключа.'
},
lumen_card_reviews_nokey_path: {
ru: 'Настройки → Lumen Card → Ключ Kinopoisk API',
en: 'Settings → Lumen Card → Kinopoisk API key',
uk: 'Налаштування → Lumen Card → Ключ Kinopoisk API'
},




lumen_manifest_url: {
ru: 'Свой каталог подборок',
en: 'Custom collections catalog',
uk: 'Свій каталог підбірок'
},
lumen_manifest_url_descr: {
ru: 'Адрес JSON-каталога. Пусто — каталог плагина из интернета, он обновляется сам (кэш 12 ч). Без сети работает встроенный список.',
en: 'JSON catalog address. Empty — the plugin catalog from the internet, updated automatically (12 h cache). Offline the built-in list is used.',
uk: 'Адреса JSON-каталогу. Порожньо — каталог плагіна з інтернету, оновлюється сам (кеш 12 год). Без мережі працює вбудований список.'
},




lumen_kp_hint_name: {
ru: 'Подсказка про ключ',
en: 'API key hint',
uk: 'Підказка про ключ'
},
lumen_kp_hint_descr: {
ru: 'Напоминание «Ключ API не задан» в карточке и в подборках Кинопоиска. Его можно убрать кнопкой «Скрыть» прямо на экране.',
en: 'The "API key is not set" reminder in the card and in Kinopoisk collections. It can also be dismissed with the "Hide" button on screen.',
uk: 'Нагадування «Ключ API не задано» у картці та в підбірках Кінопошуку. Його можна прибрати кнопкою «Сховати» просто на екрані.'
},


lumen_kp_hint_hide: {
ru: 'Скрыть',
en: 'Hide',
uk: 'Сховати'
},















lumen_hide_meta_name: {
ru: 'Скрывать блоки анализа Lampa',
en: 'Hide the Lampa analysis blocks',
uk: 'Ховати блоки аналізу Lampa'
},
lumen_hide_meta_descr: {
ru: 'Убирает с карточки ряды «Метаданные» (Темп, Страх, Экшн…) и «Настроения» (проценты). Это блоки самой Lampa, не плагина: данные для них приходят от аккаунта CUB и только для фильмов, «Настроения» — ещё и только при языке интерфейса ru/uk/be. Ничего не удаляется: ряд просто не строится на экране, выключите — вернётся. Применяется при следующем открытии карточки.',
en: 'Removes the "Metadata" (Pace, Fear, Action…) and "Moods" (percentages) rows from the card. These are Lampa own blocks, not the plugin: their data comes from the CUB account and only for movies, and "Moods" only with the ru/uk/be interface language. Nothing is deleted: the row simply is not put on screen, turn it off and it comes back. Applied the next time you open a card.',
uk: 'Прибирає з картки ряди «Метадані» (Темп, Страх, Екшн…) і «Настрої» (відсотки). Це блоки самої Lampa, а не плагіна: дані для них приходять від акаунта CUB і лише для фільмів, «Настрої» — ще й лише за мови інтерфейсу ru/uk/be. Нічого не видаляється: ряд просто не будується на екрані, вимкніть — повернеться. Застосовується при наступному відкритті картки.'
},





lumen_group_home: {
ru: 'Главная',
en: 'Home screen',
uk: 'Головна'
},
lumen_group_rows: {
ru: 'Ряды подборок',
en: 'Collection rows',
uk: 'Ряди підбірок'
},

lumen_moods_name: {
ru: 'Профили настроения',
en: 'Mood profiles',
uk: 'Профілі настрою'
},



lumen_moods_descr: {
ru: 'Строка быстрых подборок над рядами главной, когда «Кадр над рядами» выключен: «Вечер пятницы», «Семейный просмотр», «Страшное на ночь», «Есть 90 минут».',
en: 'A row of quick picks above the home rows when "Hero over the rows" is off: "Friday night", "Family time", "Scary at night", "90 minutes to spare".',
uk: 'Рядок швидких підбірок над рядами головної, коли «Кадр над рядами» вимкнено: «Вечір п\'ятниці», «Сімейний перегляд», «Страшне на ніч», «Є 90 хвилин».'
},

lumen_home_rows_name: {
ru: 'Какие ряды показывать',
en: 'Which rows to show',
uk: 'Які ряди показувати'
},
lumen_home_rows_descr: {
ru: 'Отметьте подборки для главной. Если не отмечено ничего — показывается набор по умолчанию.',
en: 'Tick the collections for the home screen. With nothing ticked the default set is shown.',
uk: 'Позначте підбірки для головної. Якщо не позначено нічого — показується набір за замовчуванням.'
},

lumen_home_rows_select: {
ru: 'Ряды подборок на главной',
en: 'Collection rows on home',
uk: 'Ряди підбірок на головній'
},
lumen_hide_watched_name: {
ru: 'Скрывать досмотренное',
en: 'Hide watched',
uk: 'Приховувати переглянуте'
},
lumen_hide_watched_descr: {
ru: 'Убирает из рядов подборок фильмы и сериалы, которые вы уже смотрели.',
en: 'Removes already-watched movies and shows from collection rows.',
uk: 'Забирає з рядів підбірок фільми та серіали, які ви вже переглянули.'
},
lumen_rows_limit_name: {
ru: 'Количество рядов',
en: 'Number of rows',
uk: 'Кількість рядів'
},


lumen_rows_limit_descr: {
ru: 'Сколько рядов подборок строится на главной. Каждый ряд — отдельный запрос к каталогу, поэтому на слабом телевизоре меньшее число заметно ускоряет появление главной. Персональные ряды в это число не входят.',
en: 'How many collection rows the home screen builds. Each row is a separate catalog request, so on a weak TV a smaller number noticeably speeds the home screen up. Personal rows are not counted here.',
uk: 'Скільки рядів підбірок будується на головній. Кожен ряд — окремий запит до каталогу, тому на слабкому телевізорі менше число помітно пришвидшує появу головної. Персональні ряди в це число не входять.'
},

lumen_rows_limit_suffix: {
ru: 'рядов',
en: 'rows',
uk: 'рядів'
},

lumen_rows_dedupe_name: {
ru: 'Не повторять фильмы в рядах',
en: 'No repeats across rows',
uk: 'Не повторювати фільми в рядах'
},
lumen_rows_dedupe_descr: {
ru: 'Фильм показывается в первом ряду, где встретился, а из рядов ниже выпадает — чтобы одна и та же новинка не стояла и в «Сейчас смотрят», и в «В тренде». Ряд, который от этого укоротился и в котором осталось меньше четырёх карточек — или меньше половины прежнего, и они не заполняют ширину экрана, — не показывается вовсе; ряды, выбранные вами вручную, и личные ряды остаются на месте.',
en: 'A movie is shown in the first row it appears in and drops out of the rows below, so the same new release does not sit in "Now playing" and "Trending" at once. A row this shortens is hidden if it is left with fewer than four movies — or with less than half of them and not enough to fill the screen; rows you picked yourself and personal rows always stay.',
uk: 'Фільм показується в першому ряду, де трапився, а з рядів нижче зникає — щоб та сама новинка не стояла і в «Зараз дивляться», і в «У тренді». Ряд, який від цього вкоротився і в якому лишилося менше чотирьох карток — або менше половини колишніх, і вони не заповнюють ширину екрана, — не показується зовсім; ряди, обрані вами вручну, і особисті ряди лишаються на місці.'
},


lumen_row_continue: {
ru: 'Досмотреть',
en: 'Continue watching',
uk: 'Досивитися'
},


lumen_row_because: {
ru: 'Потому что вы смотрели',
en: 'Because you watched',
uk: 'Тому що ви дивилися'
},
lumen_row_new_episodes: {
ru: 'Новые серии ваших сериалов',
en: 'New episodes of your shows',
uk: 'Нові серії ваших серіалів'
},
lumen_row_soon: {
ru: 'Скоро на экранах',
en: 'Coming soon',
uk: 'Незабаром на екранах'
},

lumen_badge_new_episode: {
ru: 'Новая серия',
en: 'New episode',
uk: 'Нова серія'
},

lumen_badge_coming_in: {
ru: 'Через',
en: 'In',
uk: 'Через'
},



lumen_badge_soon: { ru: 'Скоро', en: 'Soon', uk: 'Скоро' },
lumen_badge_new: { ru: 'Новинка', en: 'New', uk: 'Новинка' },





lumen_badge_premiere: { ru: 'Премьера', en: 'Premiere', uk: 'Прем\'єра' },
lumen_badge_premiere_today: {
ru: 'Сегодня премьера',
en: 'Premiere today',
uk: 'Сьогодні прем\'єра'
},












lumen_hero_size_name: { ru: 'Кадр над рядами', en: 'Hero over the rows', uk: 'Кадр над рядами' },
lumen_hero_size_descr: {
ru: 'Какую часть экрана занимает большой кадр с описанием. «Выключен» — ряды на весь экран, над ними строка чипов настроения. Применяется сразу.',
en: 'How much of the screen the large hero frame takes. "Off" gives the rows the whole screen, with the mood chips above them. Applied immediately.',
uk: 'Яку частину екрана займає великий кадр з описом. «Вимкнено» — ряди на весь екран, над ними рядок чипів настрою. Застосовується одразу.'
},
lumen_hero_size_large: { ru: 'Крупный', en: 'Large', uk: 'Великий' },
lumen_hero_size_medium: { ru: 'Средний', en: 'Medium', uk: 'Середній' },
lumen_hero_size_compact: { ru: 'Компактный', en: 'Compact', uk: 'Компактний' },
lumen_hero_size_off: { ru: 'Выключен', en: 'Off', uk: 'Вимкнено' },




























lumen_hero_media_name: { ru: 'Что показывает кадр главной', en: 'What the home hero shows', uk: 'Що показує кадр головної' },
lumen_hero_media_trailer: { ru: 'Кадры и трейлер', en: 'Stills and trailer', uk: 'Кадри і трейлер' },
lumen_hero_media_frames: { ru: 'Только кадры', en: 'Stills only', uk: 'Лише кадри' },
lumen_hero_media_descr: {
ru: 'Кадры фильма сменяют друг друга, как в карточке, с тем же «Интервалом смены кадров». «Кадры и трейлер» — если фокус постоял на карточке, кадры сменяет беззвучный трейлер (пункт «Автотрейлер в кадре главной»; на Tizen/webOS по умолчанию трейлера нет), а когда он кончится, кадры пойдут дальше. «Только кадры» — трейлер не запускается. Пока фокус в рядах ниже первого, кадры не меняются; с выключенными анимациями кадр один. Применяется сразу.',
en: 'The film’s stills replace one another like on the card, at the same "Frame interval". "Stills and trailer": if focus rests on a card, a muted trailer takes over (see "Auto-trailer in the home hero"; on Tizen/webOS there is no trailer by default), and the stills carry on once it ends. "Stills only": no trailer is started. While focus is in the rows below the first one the stills do not change; with animations off there is a single still. Applied immediately.',
uk: 'Кадри фільму змінюють один одного, як у картці, з тим самим «Інтервалом зміни кадрів». «Кадри і трейлер» — якщо фокус постояв на картці, кадри змінює беззвучний трейлер (пункт «Автотрейлер у кадрі головної»; на Tizen/webOS за замовчуванням трейлера немає), а коли він закінчиться, кадри підуть далі. «Лише кадри» — трейлер не запускається. Поки фокус у рядах нижче першого, кадри не змінюються; з вимкненими анімаціями кадр один. Застосовується одразу.'
},
lumen_hero_trailer_name: { ru: 'Автотрейлер в кадре главной', en: 'Auto-trailer in the home hero', uk: 'Автотрейлер у кадрі головної' },
lumen_hero_trailer_descr: {
ru: 'Кадр над рядами сам сменяется беззвучным трейлером с YouTube, если фокус постоял на карточке 8 секунд. Выключите, если это мешает. Переход на другую карточку ролик снимает, при листании он не запускается вовсе. Не работает при выключенных анимациях, при «Трейлер в фоне карточки» — «Выкл» (на Tizen/webOS — и «Авто») и при «Только кадры». Применяется сразу.',
en: 'The hero frame above the rows turns into a muted YouTube trailer by itself once focus has rested on a card for 8 seconds. Turn it off if it gets in the way. Moving to another card removes the clip, and it never starts while you are browsing. Does not work with animations off, with "Background trailer on the card" set to Off (on Tizen/webOS also Auto) or with "Stills only". Applied immediately.',
uk: 'Кадр над рядами сам змінюється беззвучним трейлером з YouTube, якщо фокус постояв на картці 8 секунд. Вимкніть, якщо це заважає. Перехід на іншу картку ролик знімає, під час гортання він не запускається взагалі. Не працює з вимкненими анімаціями, з «Трейлер у фоні картки» — «Викл» (на Tizen/webOS — і «Авто») і з «Лише кадри». Застосовується одразу.'
},






lumen_hero_logo_name: { ru: 'Логотип названия в кадре', en: 'Title logo in the hero', uk: 'Логотип назви в кадрі' },
lumen_hero_logo_descr: {
ru: 'Название фильма в кадре над рядами показывается его фирменной надписью с TMDB, а не обычным заголовком. Надпись появляется, только когда картинка загрузилась: пока её нет — и если её нет вовсе — стоит обычный заголовок. Выключите, чтобы название всегда было набрано текстом. Применяется сразу.',
en: 'The title in the hero above the rows is shown as the film’s own logo from TMDB instead of plain text. The logo appears only once its image has loaded: until then — and if there is none — the plain title stays. Turn it off to always keep the title as text. Applied immediately.',
uk: 'Назва фільму в кадрі над рядами показується його фірмовим написом з TMDB, а не звичайним заголовком. Напис з’являється лише тоді, коли картинка завантажилась: доки її немає — і якщо її немає взагалі — лишається звичайний заголовок. Вимкніть, щоб назва завжди була набрана текстом. Застосовується одразу.'
},




lumen_badges_name: { ru: 'Метки на постерах', en: 'Poster badges', uk: 'Мітки на постерах' },
lumen_badges_descr: {
ru: '«Скоро», «Новинка», процент просмотра и новые серии в рядах главной и подборок. «На постере» — плашкой поверх обложки; «В подписи» — строкой под ней, рядом с годом и рейтингом: обложка остаётся чистой. Применяется сразу.',
en: '"Soon", "New", the watched percentage and new episodes in home and collection rows. "On the poster" draws a plate over the artwork; "In the caption" puts the same words under it, next to the year and the rating, leaving the artwork clean. Applied immediately.',
uk: '«Скоро», «Новинка», відсоток перегляду та нові серії в рядах головної та підбірок. «На постері» — плашкою поверх обкладинки; «У підписі» — рядком під нею, поряд із роком і рейтингом: обкладинка лишається чистою. Застосовується одразу.'
},
















lumen_posters_name: { ru: 'Постеры карточек', en: 'Card posters', uk: 'Постери карток' },
lumen_posters_descr: {
ru: 'Откуда берётся обложка в рядах главной и в сетках подборок. «Как в Lampa» — та, что приходит с карточкой: ни одного лишнего запроса. «Английские» — тот же список, запрошенный на английском: это английская обложка, а не обложка на языке оригинала — у аниме и дорам тоже английская, если она есть на TMDB; цена — запрос на каждую половину подборки, фильмы и сериалы отдельно, то есть один-два на ряд и на страницу сетки; подборки Кинопоиска остаются с обложками Lampa. «Без надписей» — постер, на котором нет текста ни на каком языке: по запросу на каждую карточку — двадцать на ряд из одного списка, до сорока у рядов с фильмами и сериалами, около 150 на набор главной по умолчанию. Эти ответы кладутся в кэш на месяц, если в настройках Lampa (раздел «Остальное») включено «Кэширование запросов»: тогда платят только первое открытие и новые фильмы, а выключено — платит каждое открытие. Обложка непривычной пропорции не подставляется — остаётся та, что в Lampa. Применяется сразу: главная собирается заново.',
en: 'Where the artwork in home rows and collection grids comes from. "As in Lampa" is the one that arrives with the card: not a single extra request. "English" is the same list requested in English: an English poster, not one in the original language — anime and K-dramas get the English one too, when TMDB has it; the cost is one request per half of a collection, movies and series separately, that is one or two per row and per grid page; Kinopoisk collections keep the Lampa artwork. "No lettering" is a poster with no text in any language: one request per card — twenty per single-list row, up to forty for rows with both movies and series, about 150 for the default home set. These answers are cached for a month if "Request Caching" is on in Lampa settings (the "Other" section): then only the first opening and new films pay; if it is off, every opening pays. Artwork with an unusual aspect ratio is not substituted — the Lampa one stays. Applied immediately: the home screen is rebuilt.',
uk: 'Звідки береться обкладинка в рядах головної та в сітках підбірок. «Як у Lampa» — та, що приходить із карткою: жодного зайвого запиту. «Англійські» — той самий список, запитаний англійською: це англійська обкладинка, а не обкладинка мовою оригіналу — в аніме й дорам теж англійська, якщо вона є на TMDB; ціна — запит на кожну половину підбірки, фільми й серіали окремо, тобто один-два на ряд і на сторінку сітки; підбірки Кінопошуку лишаються з обкладинками Lampa. «Без написів» — постер, на якому немає тексту жодною мовою: по запиту на кожну картку — двадцять на ряд з одного списку, до сорока в рядах із фільмами й серіалами, близько 150 на набір головної за замовчуванням. Ці відповіді кладуться в кеш на місяць, якщо в налаштуваннях Lampa (розділ «Інше») увімкнено «Кешування запитів»: тоді платять лише перше відкриття та нові фільми, а вимкнено — платить кожне відкриття. Обкладинка незвичної пропорції не підставляється — лишається та, що в Lampa. Застосовується одразу: головна збирається наново.'
},
lumen_posters_lampa: { ru: 'Как в Lampa', en: 'As in Lampa', uk: 'Як у Lampa' },
lumen_posters_original: { ru: 'Английские', en: 'English', uk: 'Англійські' },
lumen_posters_clean: { ru: 'Без надписей', en: 'No lettering', uk: 'Без написів' },
lumen_badges_poster: { ru: 'На постере', en: 'On the poster', uk: 'На постері' },
lumen_badges_caption: { ru: 'В подписи', en: 'In the caption', uk: 'У підписі' },
lumen_badges_off: { ru: 'Не показывать', en: 'Do not show', uk: 'Не показувати' },




lumen_context_menu_name: {
ru: 'Меню по удержанию OK',
en: 'Menu on holding OK',
uk: 'Меню за утриманням OK'
},
lumen_context_menu_descr: {
ru: 'Удержание OK на постере открывает штатное меню Lampa, а плагин дописывает в него «Трейлер», «Похожие», «Вся франшиза», отметку просмотра и «Скрыть из рекомендаций». Обычное нажатие по-прежнему открывает карточку. Применяется сразу.',
en: 'Holding OK on a poster opens the stock Lampa menu, and the plugin appends "Trailer", "Similar", "Whole franchise", the watched mark and "Hide from recommendations". A normal press still opens the card. Applied immediately.',
uk: 'Утримання OK на постері відкриває штатне меню Lampa, а плагін дописує до нього «Трейлер», «Схожі», «Вся франшиза», позначку перегляду та «Сховати з рекомендацій». Звичайне натискання, як і раніше, відкриває картку. Застосовується одразу.'
},

lumen_minimap_name: { ru: 'Мини-карта рядов', en: 'Rows minimap', uk: 'Міні-карта рядів' },
lumen_minimap_descr: {
ru: 'Удержание «вверх» или «вниз» на главной показывает справа список рядов с подсветкой того, в котором вы сейчас. Нажатия не перехватывает. Применяется сразу.',
en: 'Holding "up" or "down" on the home screen shows a list of rows on the right with the current one highlighted. It never intercepts key presses. Applied immediately.',
uk: 'Утримання «вгору» або «вниз» на головній показує праворуч список рядів із підсвіткою того, у якому ви зараз. Натискання не перехоплює. Застосовується одразу.'
},
lumen_fastscroll_name: { ru: 'Быстрое листание', en: 'Fast scrolling', uk: 'Швидке гортання' },
lumen_fastscroll_descr: {
ru: 'Удержание «влево» или «вправо» разгоняет листание ряда втрое, а кнопки каналов на пульте прыгают сразу на десять карточек. Позиция в ряду показывается внизу экрана. Применяется сразу.',
en: 'Holding "left" or "right" scrolls a row three times faster, and the channel buttons on the remote jump ten cards at once. The position in the row is shown at the bottom. Applied immediately.',
uk: 'Утримання «вліво» або «вправо» пришвидшує гортання ряду втричі, а кнопки каналів на пульті стрибають одразу на десять карток. Позиція в ряду показується внизу екрана. Застосовується одразу.'
},

lumen_minimap_rows: { ru: 'РЯДЫ', en: 'ROWS', uk: 'РЯДИ' },
lumen_minimap_of: { ru: 'ИЗ', en: 'OF', uk: 'З' },

lumen_minimap_row: { ru: 'Ряд', en: 'Row', uk: 'Ряд' },


lumen_menu_section: { ru: 'Lumen Card', en: 'Lumen Card', uk: 'Lumen Card' },
lumen_menu_trailer: { ru: 'Трейлер', en: 'Trailer', uk: 'Трейлер' },
lumen_menu_franchise: { ru: 'Вся франшиза', en: 'Whole franchise', uk: 'Вся франшиза' },
lumen_menu_similar: { ru: 'Похожие', en: 'Similar', uk: 'Схожі' },
lumen_menu_watched: { ru: 'Отметить просмотренным', en: 'Mark as watched', uk: 'Позначити переглянутим' },
lumen_menu_unwatched: { ru: 'Снять отметку о просмотре', en: 'Remove watched mark', uk: 'Зняти позначку перегляду' },
lumen_menu_hide: { ru: 'Скрыть из рекомендаций', en: 'Hide from recommendations', uk: 'Сховати з рекомендацій' },
lumen_menu_unhide: { ru: 'Вернуть в рекомендации', en: 'Return to recommendations', uk: 'Повернути в рекомендації' },
lumen_menu_no_trailer: {
ru: 'Трейлер не найден',
en: 'No trailer found',
uk: 'Трейлер не знайдено'
},


lumen_menu_trailer_late: {
ru: 'Трейлер не успел загрузиться — попробуйте ещё раз',
en: 'The trailer took too long to load — try again',
uk: 'Трейлер не встиг завантажитися — спробуйте ще раз'
},
lumen_menu_marked: {
ru: 'Отмечено просмотренным',
en: 'Marked as watched',
uk: 'Позначено переглянутим'
},
lumen_menu_unmarked: {
ru: 'Отметка о просмотре снята',
en: 'Watched mark removed',
uk: 'Позначку перегляду знято'
},
lumen_menu_hidden: {
ru: 'Скрыто — исчезнет из рядов при следующем обновлении',
en: 'Hidden — it will leave the rows on the next refresh',
uk: 'Сховано — зникне з рядів при наступному оновленні'
},
lumen_menu_unhidden: {
ru: 'Возвращено в рекомендации',
en: 'Returned to recommendations',
uk: 'Повернено в рекомендації'
},
lumen_personal_rows_name: {
ru: 'Персональные ряды',
en: 'Personal rows',
uk: 'Персональні ряди'
},
lumen_personal_rows_descr: {
ru: 'Показывать «Досмотреть», «Потому что вы смотрели», «Новые серии» и «Скоро на экранах».',
en: 'Show "Continue watching", "Because you watched", "New episodes" and "Coming soon" rows.',
uk: 'Показувати «Досивитися», «Тому що ви дивилися», «Нові серії» та «Незабаром».'
},


lumen_home_start_name: { ru: 'Начало главной', en: 'Top of the home screen', uk: 'Початок головної' },
lumen_home_start_rotate: { ru: 'Подборки по очереди', en: 'Rotating collections', uk: 'Підбірки по черзі' },
lumen_home_start_history: { ru: 'Сначала «Досмотреть»', en: '"Continue watching" first', uk: 'Спочатку «Досивитися»' },
lumen_home_start_descr: {
ru: 'Первые ряды меняются при каждом запуске Lampa и раз в несколько часов, «Досмотреть» стоит вторым. «Сначала «Досмотреть»» — ваша история сверху, как раньше.',
en: 'The top rows change every time Lampa starts and every few hours, with "Continue watching" second. "Continue watching" first keeps your history on top, as before.',
uk: 'Перші ряди змінюються під час кожного запуску Lampa і раз на кілька годин, «Досивитися» стоїть другим. «Спочатку «Досивитися»» — ваша історія вгорі, як раніше.'
},




lumen_moods_no_sources: {
ru: 'Нет источника',
en: 'No source',
uk: 'Немає джерела'
},




lumen_hub_title: { ru: 'Подборки', en: 'Collections', uk: 'Підбірки' },



lumen_hub_search: { ru: 'ПОИСК ПО ПОДБОРКАМ', en: 'SEARCH COLLECTIONS', uk: 'ПОШУК ПО ПІДБІРКАХ' },





lumen_hub_roulette: { ru: 'ЧТО ПОСМОТРЕТЬ', en: 'WHAT TO WATCH', uk: 'ЩО ПОДИВИТИСЯ' },
lumen_grid_roulette: { ru: 'Крутить по этой подборке', en: 'Spin this collection', uk: 'Крутити цю підбірку' },

lumen_hub_search_title: { ru: 'Название подборки', en: 'Collection name', uk: 'Назва підбірки' },
lumen_hub_search_results: { ru: 'Найденные подборки', en: 'Collections found', uk: 'Знайдені підбірки' },
lumen_hub_search_empty: {
ru: 'Подборки с таким названием нет',
en: 'No collection with that name',
uk: 'Підбірки з такою назвою немає'
},
lumen_hub_empty: { ru: 'Здесь пока пусто', en: 'Nothing here yet', uk: 'Тут поки порожньо' },

lumen_hub_nokey: { ru: 'НУЖЕН КЛЮЧ', en: 'KEY REQUIRED', uk: 'ПОТРІБЕН КЛЮЧ' },
lumen_hub_nokey_text: {
ru: 'Подборки Кинопоиска недоступны без ключа API. Настройки → Lumen Card → Ключ Kinopoisk API',
en: 'Kinopoisk collections are unavailable without an API key. Settings → Lumen Card → Kinopoisk API key',
uk: 'Підбірки Кінопошуку недоступні без ключа API. Налаштування → Lumen Card → Ключ Kinopoisk API'
},
lumen_grid_back: { ru: 'Назад', en: 'Back', uk: 'Назад' },

lumen_grid_total: { ru: 'Всего', en: 'Total', uk: 'Усього' },
lumen_sort_popular: { ru: 'По популярности', en: 'By popularity', uk: 'За популярністю' },
lumen_sort_rating: { ru: 'По рейтингу', en: 'By rating', uk: 'За рейтингом' },
lumen_sort_new: { ru: 'Новые', en: 'Newest', uk: 'Нові' },

lumen_card_franchise: { ru: 'Франшиза', en: 'Franchise', uk: 'Франшиза' },




lumen_fr_title: { ru: 'Смотреть по порядку', en: 'Watch in order', uk: 'Дивитися по порядку' },
lumen_fr_order_release: { ru: 'По годам', en: 'By year', uk: 'За роками' },

lumen_fr_of: { ru: 'из', en: 'of', uk: 'з' },
lumen_fr_here: { ru: 'Вы здесь', en: 'You are here', uk: 'Ви тут' },
lumen_fr_next: { ru: 'Дальше', en: 'Up next', uk: 'Далі' },
lumen_fr_watched: { ru: 'Просмотрено', en: 'Watched', uk: 'Переглянуто' },




lumen_hero_airing: { ru: 'Выходит', en: 'Airing', uk: 'Виходить' }
};

function langCode() {
var code = 'ru';
try {
if (window.Lampa && Lampa.Storage) {
code = Lampa.Storage.get('language', 'ru') || 'ru';
}
} catch (e) { }
return ('' + code).toLowerCase().slice(0, 2);
}

function isSlavic() {
var c = langCode();
return c === 'ru' || c === 'uk' || c === 'be' || c === 'bg';
}





LC.langCode = langCode;

LC.seasonsWord = function (n) {
if (isSlavic()) return LC.util.plural(n, ['сезон', 'сезона', 'сезонов']);
return n === 1 ? 'season' : 'seasons';
};

LC.episodesWord = function (n) {
if (isSlavic()) return LC.util.plural(n, ['серия', 'серии', 'серий']);
return n === 1 ? 'episode' : 'episodes';
};



LC.daysWord = function (n) {
if (isSlavic()) return LC.util.plural(n, ['день', 'дня', 'дней']);
return n === 1 ? 'day' : 'days';
};




LC.reviewsWord = function (n) {
if (isSlavic()) return LC.util.plural(n, ['отзыв', 'отзыва', 'отзывов']);
return n === 1 ? 'review' : 'reviews';
};



LC.collectionsWord = function (n) {
if (isSlavic()) return LC.util.plural(n, ['подборка', 'подборки', 'подборок']);
return n === 1 ? 'collection' : 'collections';
};

LC.lang = function (key) {
try {
if (window.Lampa && Lampa.Lang && typeof Lampa.Lang.translate === 'function') {
var out = Lampa.Lang.translate(key);
if (out && out !== key) return out;
}
} catch (e) { }
var pack = LC.STRINGS[key];
if (!pack) return key;
return pack[langCode()] || pack.ru || key;
};

var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 15h20"/><circle cx="7" cy="9" r="2"/></svg>';
























var pref_handled = '';


function applyPrefChange(name) {




pref_handled = '';
if (!name) return false;
if (name === 'lumen_enabled') { LC.applyEnabledPref(); return true; }








if (name === 'lumen_motion') {
LC.applyMotionMode();
if (LC.enabled()) LC.applySlideshowPref();
try { if (LC.accent && LC.accent.repaint) LC.accent.repaint(); } catch (eAccentMotion) { warn('accent repaint failed', eAccentMotion); }
return true;
}






if (name === 'lumen_fx_heavy') {
LC.applyMotionMode();
return true;
}





if (name === 'lumen_debug_hud') {
try { if (LC.hud) LC.hud.sync(); } catch (eHud) {}
return true;
}
if (name === 'lumen_slideshow') { LC.applySlideshowPref(); return true; }


if (name === 'lumen_slide_interval') {
LC.applySlideshowPref();
try { if (LC.hero && LC.hero.applyInterval) LC.hero.applyInterval(); } catch (eHeroInt) {}
return true;
}
if (name === 'lumen_menus') { LC.applyMenusPref(); return true; }
if (name === 'lumen_torrents') { LC.applyTorrentsPref(); return true; }
if (name === 'lumen_trailer') { LC.applyTrailerPref(); return true; }




if (name === 'lumen_font') { LC.injectFonts(); LC.injectCss(); return true; }













if (name === 'lumen_theme' || name === 'lumen_solid' || name === 'lumen_scale' ||
name === 'lumen_accent_scope' || name === 'lumen_flat') { LC.injectCss(); return true; }






if (name === 'lumen_hide_meta') return true;




if (name === 'lumen_card_logo') {
try { if (LC.header && LC.header.applyLogoPref) LC.header.applyLogoPref(); } catch (eCardLogo) {}
return true;
}



if (name === 'lumen_accent_auto') {
try { if (LC.applyAccentPref) LC.applyAccentPref(); } catch (eAccent) {}









if (LC.pref('lumen_accent_scope', 'full') === 'veil') LC.injectCss();
return true;
}




if (name === 'lumen_reviews' || name === 'lumen_kp_key' || name === 'lumen_reviews_mode') { LC.applyReviewsPref(); return true; }



if (name === 'lumen_kp_hint') {
LC.applyReviewsPref();
try { if (LC.applyKpHintPref) LC.applyKpHintPref(); } catch (eHint) {}
return true;
}




if (name === 'lumen_hero_size') {
try { if (LC.applyHeroSizePref) LC.applyHeroSizePref(); } catch (eHeroSize) {}
return true;
}



if (name === 'lumen_hero_trailer') {
try { if (LC.hero && LC.hero.applyTrailer) LC.hero.applyTrailer(); } catch (eHeroTr) {}
return true;
}



if (name === 'lumen_hero_media') {
try { if (LC.hero && LC.hero.applyMedia) LC.hero.applyMedia(); } catch (eHeroMedia) {}
return true;
}




if (name === 'lumen_hero_logo') {
try { if (LC.hero && LC.hero.applyLogoPref) LC.hero.applyLogoPref(); } catch (eHeroLogo) {}
return true;
}


if (name === 'lumen_badges') {
try { if (LC.applyBadgesPref) LC.applyBadgesPref(); } catch (eBadges) {}
return true;
}


if (name === 'lumen_context_menu') {
try { if (LC.applyCardmenuPref) LC.applyCardmenuPref(); } catch (eCardmenu) {}
return true;
}



if (name === 'lumen_minimap' || name === 'lumen_fastscroll') {
try { if (LC.applyNavPref) LC.applyNavPref(); } catch (eNav) {}
return true;
}

if (name === 'lumen_moods') {
try { if (LC.applyMoodsPref) LC.applyMoodsPref(); } catch (eMoods) {}
return true;
}










if (name === 'lumen_hide_watched' || name === 'lumen_rows_limit' || name === 'lumen_home_rows' ||
name === 'lumen_rows_dedupe' || name === 'lumen_posters') {
try { if (LC.applyRowsPref) LC.applyRowsPref(); } catch (eRows) {}
return true;
}




if (name === 'lumen_personal_rows' || name === 'lumen_home_start') {
try { if (LC.applyPersonalPref) LC.applyPersonalPref(); } catch (eP) {}
return true;
}



if (name === 'lumen_manifest_url') {
try { if (window.Lampa && Lampa.Storage) Lampa.Storage.set('lumen_manifest', null); } catch (e) {}
try { if (LC.applyRowsPref) LC.applyRowsPref(); } catch (eUrl) {}
return true;
}








if (name === 'lumen_preset_appletv' || name === 'lumen_preset_lumen') return true;


if (name === 'lumen_debug_bench') return true;




if (name === 'lumen_roulette_unseen') return true;




if (name === 'lumen_fx') {
try { if (LC.applyFxPref) LC.applyFxPref(); } catch (eFx) {}
return true;
}




if (name === 'lumen_ambient' || name === 'lumen_ambient_source' || name === 'lumen_ambient_delay') {
try { if (LC.applyAmbientPref) LC.applyAmbientPref(); } catch (eAmb) {}
return true;
}









if (name === 'interface_size') { LC.injectCss(); return false; }
if (name.indexOf(PLUGIN + '_') !== 0) return false;



if (name === PLUGIN + '_fonts') { LC.injectFonts(); LC.injectCss(); return true; }
if (name === PLUGIN + '_progress') { LC.applyProgressPref(); return true; }
LC.injectCss();
return true;
}

function onChangeFor(name) {
return function () {
if (pref_handled === name) { pref_handled = ''; return; }
applyPrefChange(name);
};
}













function openHomeRows() {
try {
if (!window.Lampa || !Lampa.Select || typeof Lampa.Select.show !== 'function') return;
if (!LC.rows || typeof LC.rows.rowChoices !== 'function') return;
if (!LC.manifest || typeof LC.manifest.get !== 'function') return;

var manifest = LC.manifest.get();
var choices = LC.rows.rowChoices(manifest, LC.rows.storedIds());
var lang = langCode();


var groupTitle = {};
var groups = (manifest && manifest.groups) || [];
for (var g = 0; g < groups.length; g++) {
groupTitle[groups[g].id] = (LC.hub && typeof LC.hub.titleOf === 'function')
? LC.hub.titleOf(groups[g], lang)
: (groups[g].title || groups[g].id);
}





var esc = LC.util.esc;
var items = [];
var lastGroup = null;
for (var i = 0; i < choices.length; i++) {
var c = choices[i];


if (!c.checked && c.group !== lastGroup) {
lastGroup = c.group;
items.push({ title: esc(groupTitle[c.group] || c.group), separator: true });
}
items.push({ title: esc(c.title), lumen_id: c.id, checkbox: true, checked: c.checked });
}

function save() {
var ids = [];
for (var k = 0; k < items.length; k++) {
if (items[k].checkbox && items[k].checked) ids.push(items[k].lumen_id);
}


try { Lampa.Storage.set('lumen_home_rows', ids.join(',')); } catch (e) { }
}

Lampa.Select.show({
title: LC.lang('lumen_home_rows_select'),
items: items,
onCheck: save,
onBack: function () {
try { if (Lampa.Controller && typeof Lampa.Controller.toggle === 'function') Lampa.Controller.toggle('settings_component'); } catch (e) { }
}
});
} catch (err) {
warn('home rows select failed', err);
}
}






























function presetCurrent(key) {
var entry = LC.prefs.find(key);
var def = entry ? entry['default'] : '';
if (typeof def === 'function') def = def();
var raw = Lampa.Storage.get(key, def);
if (key === 'lumen_badges') return LC.prefs.badgesMode(raw);
if (typeof def === 'boolean') return LC.prefs.boolOf(raw, def);
return raw;
}









function refreshParamRow(key) {
try {
if (typeof $ !== 'function') return;
if (!Lampa.Params || typeof Lampa.Params.update !== 'function') return;
var elem = $('.settings-param[data-name="' + key + '"]');
if (elem && elem.length) Lampa.Params.update(elem);
} catch (e) {
warn('preset row refresh failed', e);
}
}

function applyPreset(id) {
try {
if (!window.Lampa || !Lampa.Storage) return;
if (typeof Lampa.Storage.set !== 'function' || typeof Lampa.Storage.get !== 'function') return;
var values = LC.prefs.presetValues(id);
var keys = LC.prefs.PRESET_KEYS;
var changed = [];
var written = [];
for (var i = 0; i < keys.length; i++) {
var key = keys[i];
if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
var want = values[key];
if (presetCurrent(key) === want) continue;
Lampa.Storage.set(key, typeof want === 'boolean' ? (want ? 'true' : 'false') : want, true);
written.push(key);
refreshParamRow(key);
var entry = LC.prefs.find(key);
if (entry) changed.push(LC.lang(entry.label));
}

if (written.length && LC.applyPresetChanges) LC.applyPresetChanges(written);




var head = LC.lang(id === 'appletv' ? 'lumen_preset_appletv_short' : 'lumen_preset_lumen_short');
var text = head + ' · ' + (changed.length ? changed.join(', ') : LC.lang('lumen_preset_same'));
if (Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(text);
} catch (err) {
warn('preset failed', err);
}
}


function onButtonFor(name) {
return function () {
if (name === 'lumen_home_rows') openHomeRows();
else if (name === 'lumen_preset_appletv') applyPreset('appletv');
else if (name === 'lumen_preset_lumen') applyPreset('lumen');
else if (name === 'lumen_debug_bench') {
try { if (LC.bench) LC.bench.start(); } catch (e) { warn('bench start failed', e); }
}
};
}



function valuesOf(entry) {
var out = {};
for (var i = 0; i < entry.values.length; i++) {
var v = entry.values[i];
out[v] = entry.vprefix ? LC.lang(entry.vprefix + v) : v + ' ' + LC.lang(entry.vsuffix);
}
return out;
}

function addPrefParam(entry) {
var param = { name: entry.name, type: entry.type };
var field = { name: LC.lang(entry.label) };
if (entry.descr) field.description = LC.lang(entry.descr);

if (entry.type === 'title') {
Lampa.SettingsApi.addParam({ component: PLUGIN, param: param, field: field });
return;
}

if (entry.type === 'button') {
Lampa.SettingsApi.addParam({ component: PLUGIN, param: param, field: field, onChange: onButtonFor(entry.name) });
return;
}




param['default'] = typeof entry['default'] === 'function' ? entry['default']() : entry['default'];
if (entry.type === 'select') param.values = valuesOf(entry);
if (entry.type === 'input') {
param.values = '';





param.placeholder = LC.lang(entry.placeholder);
}
Lampa.SettingsApi.addParam({ component: PLUGIN, param: param, field: field, onChange: onChangeFor(entry.name) });
}

LC.addSettings = function () {




if (LC.settingsAdded) return;
try {
if (!window.Lampa || !Lampa.SettingsApi || typeof Lampa.SettingsApi.addComponent !== 'function') return;

Lampa.SettingsApi.addComponent({
component: PLUGIN,
icon: ICON,
name: LC.lang('lumen_card_title')
});


for (var i = 0; i < LC.prefs.LIST.length; i++) addPrefParam(LC.prefs.LIST[i]);
LC.settingsAdded = true;
} catch (e) {
warn('settings failed', e);
}
};

LC.followStorage = function () {






if (LC.storageFollowed) return;
try {
if (!window.Lampa || !Lampa.Storage || !Lampa.Storage.listener) return;
Lampa.Storage.listener.follow('change', function (e) {
if (!e || !e.name) return;




try {
if (applyPrefChange(e.name)) pref_handled = e.name;
} catch (err) {
warn('storage change failed: ' + e.name, err);
}
});
LC.storageFollowed = true;
} catch (err) {
warn('storage listener failed', err);
}
};


/* ---- 81_prefs.js ---- */
















LC.prefs = (function () {






function boolOf(value, def) {
if (typeof value === 'undefined' || value === null || value === '') return def;
if (value === 'true' || value === true || value === 1 || value === '1') return true;
if (value === 'false' || value === false || value === 0 || value === '0') return false;
return def;
}












function badgesMode(value) {
if (value === 'poster' || value === 'caption' || value === 'off') return value;
if (value === 'true' || value === true || value === 1 || value === '1') return 'poster';
if (value === 'false' || value === false || value === 0 || value === '0') return 'off';
return 'poster';
}



















function motionModeFor(stored, platform, auto) {
if (stored !== 'full' && stored !== 'lite' && stored !== 'off') stored = 'auto';
if (stored !== 'auto') return stored;
platform = platform || {};
if (platform.tizen || platform.webos || platform.weak) return 'lite';
if (auto === 'lite') return 'lite';
return 'full';
}








function fxHeavyDefault(platform) {
platform = platform || {};
return !(platform.android || platform.tizen || platform.webos);
}













































var LIST = [
{ name: 'lumen_enabled', type: 'trigger', 'default': true, label: 'lumen_card_enabled_name', descr: 'lumen_card_enabled_descr' },










{ name: 'lumen_group_preset', type: 'title', label: 'lumen_group_preset' },
{ name: 'lumen_preset_appletv', type: 'button', label: 'lumen_preset_appletv_name', descr: 'lumen_preset_appletv_descr' },
{ name: 'lumen_preset_lumen', type: 'button', label: 'lumen_preset_lumen_name', descr: 'lumen_preset_lumen_descr' },

{ name: 'lumen_group_look', type: 'title', label: 'lumen_card_group_look' },




{ name: 'lumen_card_accent', type: 'select', values: ['sand', 'copper', 'wine', 'garnet', 'mint', 'emerald', 'ice', 'lavender', 'graphite'], vprefix: 'lumen_card_accent_', 'default': 'sand', label: 'lumen_card_accent', descr: 'lumen_card_accent_descr' },








{ name: 'lumen_accent_auto', type: 'trigger', 'default': true, label: 'lumen_accent_auto_name', descr: 'lumen_accent_auto_descr' },









{ name: 'lumen_accent_scope', type: 'select', values: ['full', 'veil'], vprefix: 'lumen_accent_scope_', 'default': 'full', label: 'lumen_accent_scope_name', descr: 'lumen_accent_scope_descr' },






{ name: 'lumen_theme', type: 'select', values: ['warm', 'black'], vprefix: 'lumen_theme_', 'default': 'warm', label: 'lumen_theme_name', descr: 'lumen_theme_descr' },
{ name: 'lumen_solid', type: 'trigger', 'default': false, label: 'lumen_solid_name', descr: 'lumen_solid_descr' },















{ name: 'lumen_flat', type: 'trigger', 'default': false, label: 'lumen_flat_name', descr: 'lumen_flat_descr' },



{ name: 'lumen_scale', type: 'select', values: ['small', 'normal', 'large', 'huge'], vprefix: 'lumen_scale_', 'default': 'normal', label: 'lumen_scale_name', descr: 'lumen_scale_descr' },
{ name: 'lumen_card_fonts', type: 'trigger', 'default': true, label: 'lumen_card_fonts_name', descr: 'lumen_card_fonts_descr' },





{ name: 'lumen_font', type: 'select', values: ['golos', 'onest', 'manrope', 'inter', 'plex'], vprefix: 'lumen_card_font_', 'default': 'golos', label: 'lumen_card_font_name', descr: 'lumen_card_font_descr' },






{ name: 'lumen_group_motion', type: 'title', label: 'lumen_group_motion' },
{ name: 'lumen_motion', type: 'select', values: ['auto', 'full', 'lite', 'off'], vprefix: 'lumen_card_motion_', 'default': 'auto', label: 'lumen_card_motion', descr: 'lumen_card_motion_descr' },






{ name: 'lumen_fx_heavy', type: 'trigger', 'default': function () { return fxHeavyDefault(LC.platformInfo()); }, label: 'lumen_fx_heavy_name', descr: 'lumen_fx_heavy_descr' },




{ name: 'lumen_debug_hud', type: 'trigger', 'default': false, label: 'lumen_debug_hud_name', descr: 'lumen_debug_hud_descr' },





{ name: 'lumen_debug_bench', type: 'button', label: 'lumen_debug_bench_name', descr: 'lumen_debug_bench_descr' },














{ name: 'lumen_fx', type: 'select', values: ['all', 'seasonal', 'off'], vprefix: 'lumen_fx_', 'default': 'seasonal', label: 'lumen_fx_name', descr: 'lumen_fx_descr' },

{ name: 'lumen_group_backdrop', type: 'title', label: 'lumen_card_group_backdrop' },
{ name: 'lumen_slideshow', type: 'trigger', 'default': true, label: 'lumen_card_slideshow_name', descr: 'lumen_card_slideshow_descr' },
{ name: 'lumen_slide_interval', type: 'select', values: ['8', '14', '20'], vsuffix: 'lumen_card_seconds', 'default': '14', label: 'lumen_card_slide_interval', descr: 'lumen_card_slide_interval_descr' },
{ name: 'lumen_trailer', type: 'select', values: ['auto', 'on', 'off'], vprefix: 'lumen_card_trailer_', 'default': 'auto', label: 'lumen_card_trailer', descr: 'lumen_card_trailer_descr' },

{ name: 'lumen_group_blocks', type: 'title', label: 'lumen_card_group_blocks' },










{ name: 'lumen_card_logo', type: 'trigger', 'default': true, label: 'lumen_card_logo_name', descr: 'lumen_card_logo_descr' },
{ name: 'lumen_card_progress', type: 'trigger', 'default': true, label: 'lumen_card_progress_name', descr: 'lumen_card_progress_descr' },



{ name: 'lumen_reviews', type: 'trigger', 'default': true, label: 'lumen_card_reviews_name', descr: 'lumen_card_reviews_descr' },




{ name: 'lumen_reviews_mode', type: 'select', values: ['headlines', 'full'], vprefix: 'lumen_reviews_mode_', 'default': 'headlines', label: 'lumen_reviews_mode_name', descr: 'lumen_reviews_mode_descr' },



{ name: 'lumen_kp_key', type: 'input', 'default': '', label: 'lumen_card_kp_key', descr: 'lumen_card_kp_key_descr', placeholder: 'lumen_pref_unset' },




{ name: 'lumen_kp_hint', type: 'trigger', 'default': true, label: 'lumen_kp_hint_name', descr: 'lumen_kp_hint_descr' },


































{ name: 'lumen_hide_meta', type: 'trigger', 'default': false, label: 'lumen_hide_meta_name', descr: 'lumen_hide_meta_descr' },







{ name: 'lumen_group_home', type: 'title', label: 'lumen_group_home' },




{ name: 'lumen_hero_size', type: 'select', values: ['large', 'medium', 'compact', 'off'], vprefix: 'lumen_hero_size_', 'default': 'large', label: 'lumen_hero_size_name', descr: 'lumen_hero_size_descr' },



















{ name: 'lumen_hero_media', type: 'select', values: ['trailer', 'frames'], vprefix: 'lumen_hero_media_', 'default': 'trailer', label: 'lumen_hero_media_name', descr: 'lumen_hero_media_descr' },
{ name: 'lumen_hero_trailer', type: 'trigger', 'default': true, label: 'lumen_hero_trailer_name', descr: 'lumen_hero_trailer_descr' },






{ name: 'lumen_hero_logo', type: 'trigger', 'default': true, label: 'lumen_hero_logo_name', descr: 'lumen_hero_logo_descr' },
{ name: 'lumen_moods', type: 'trigger', 'default': true, label: 'lumen_moods_name', descr: 'lumen_moods_descr' },
{ name: 'lumen_personal_rows', type: 'trigger', 'default': true, label: 'lumen_personal_rows_name', descr: 'lumen_personal_rows_descr' },





{ name: 'lumen_home_start', type: 'select', values: ['rotate', 'history'], vprefix: 'lumen_home_start_', 'default': 'rotate', label: 'lumen_home_start_name', descr: 'lumen_home_start_descr' },







{ name: 'lumen_group_rows', type: 'title', label: 'lumen_group_rows' },




{ name: 'lumen_home_rows', type: 'button', label: 'lumen_home_rows_name', descr: 'lumen_home_rows_descr' },
{ name: 'lumen_rows_limit', type: 'select', values: ['10', '15', '25'], vsuffix: 'lumen_rows_limit_suffix', 'default': '15', label: 'lumen_rows_limit_name', descr: 'lumen_rows_limit_descr' },






{ name: 'lumen_rows_dedupe', type: 'trigger', 'default': true, label: 'lumen_rows_dedupe_name', descr: 'lumen_rows_dedupe_descr' },







{ name: 'lumen_posters', type: 'select', values: ['lampa', 'original', 'clean'], vprefix: 'lumen_posters_', 'default': 'lampa', label: 'lumen_posters_name', descr: 'lumen_posters_descr' },








{ name: 'lumen_badges', type: 'select', values: ['poster', 'caption', 'off'], vprefix: 'lumen_badges_', 'default': 'poster', label: 'lumen_badges_name', descr: 'lumen_badges_descr' },
{ name: 'lumen_hide_watched', type: 'trigger', 'default': false, label: 'lumen_hide_watched_name', descr: 'lumen_hide_watched_descr' },



{ name: 'lumen_manifest_url', type: 'input', 'default': '', label: 'lumen_manifest_url', descr: 'lumen_manifest_url_descr', placeholder: 'lumen_pref_default_catalog' },










{ name: 'lumen_group_nav', type: 'title', label: 'lumen_group_nav' },
{ name: 'lumen_context_menu', type: 'trigger', 'default': true, label: 'lumen_context_menu_name', descr: 'lumen_context_menu_descr' },
{ name: 'lumen_minimap', type: 'trigger', 'default': true, label: 'lumen_minimap_name', descr: 'lumen_minimap_descr' },
{ name: 'lumen_fastscroll', type: 'trigger', 'default': true, label: 'lumen_fastscroll_name', descr: 'lumen_fastscroll_descr' },







{ name: 'lumen_group_roulette', type: 'title', label: 'lumen_group_roulette' },
{ name: 'lumen_roulette_unseen', type: 'trigger', 'default': true, label: 'lumen_roulette_unseen_name', descr: 'lumen_roulette_unseen_descr' },



















{ name: 'lumen_group_ambient', type: 'title', label: 'lumen_group_ambient' },
{ name: 'lumen_ambient', type: 'trigger', 'default': false, label: 'lumen_ambient_name', descr: 'lumen_ambient_descr' },
{ name: 'lumen_ambient_source', type: 'select', values: ['curated', 'current'], vprefix: 'lumen_ambient_source_', 'default': 'curated', label: 'lumen_ambient_source_name', descr: 'lumen_ambient_source_descr' },
{ name: 'lumen_ambient_delay', type: 'select', values: ['3', '5', '10'], vsuffix: 'lumen_ambient_minutes', 'default': '3', label: 'lumen_ambient_delay_name', descr: 'lumen_ambient_delay_descr' },




{ name: 'lumen_group_path', type: 'title', label: 'lumen_card_group_path' },
{ name: 'lumen_menus', type: 'select', values: ['all', 'path', 'off'], vprefix: 'lumen_card_menus_', 'default': 'all', label: 'lumen_card_menus', descr: 'lumen_card_menus_descr' },
{ name: 'lumen_torrents', type: 'trigger', 'default': true, label: 'lumen_card_torrents_name', descr: 'lumen_card_torrents_descr' }
];

function find(name) {
if (!name) return null;
for (var i = 0; i < LIST.length; i++) if (LIST[i].name === name) return LIST[i];
return null;
}



































var PRESET_KEYS = ['lumen_theme', 'lumen_card_accent', 'lumen_font', 'lumen_accent_auto',
'lumen_accent_scope', 'lumen_hero_size', 'lumen_hero_logo', 'lumen_badges', 'lumen_flat',
'lumen_hide_meta'];







var PRESET_APPLETV = {
lumen_theme: 'black',
lumen_card_accent: 'graphite',
lumen_font: 'inter',
lumen_badges: 'caption',
lumen_accent_scope: 'veil',





lumen_flat: true,



lumen_hide_meta: true
};







function presetValues(id) {
var out = {};
if (id !== 'lumen' && id !== 'appletv') return out;
for (var i = 0; i < PRESET_KEYS.length; i++) {
var key = PRESET_KEYS[i];
var entry = find(key);
if (!entry) continue;
var value = entry['default'];


if (typeof value === 'function') value = value();
if (id === 'appletv' && Object.prototype.hasOwnProperty.call(PRESET_APPLETV, key)) value = PRESET_APPLETV[key];
out[key] = value;
}
return out;
}



function normalize(value, def) {
if (typeof value === 'undefined' || value === null || value === '') return def;
if (typeof def === 'boolean') return boolOf(value, def);
return value;
}







var overrides = null;

function override(map) {
overrides = null;
if (!map) return;
overrides = {};
for (var key in map) {
if (Object.prototype.hasOwnProperty.call(map, key)) overrides[key] = map[key];
}
}

function clearOverride() {
overrides = null;
}

function overridden(name) {
return !!overrides && Object.prototype.hasOwnProperty.call(overrides, name);
}

function overrideOf(name) {
return overrides ? overrides[name] : undefined;
}

return {
LIST: LIST, find: find, boolOf: boolOf, badgesMode: badgesMode,
motionModeFor: motionModeFor, fxHeavyDefault: fxHeavyDefault,
PRESET_KEYS: PRESET_KEYS, presetValues: presetValues,
normalize: normalize, override: override, clearOverride: clearOverride,
overridden: overridden, overrideOf: overrideOf
};
})();







LC.platformInfo = function () {
var platform = { tizen: false, webos: false, android: false, weak: false };
try {
if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.is === 'function') {
platform.tizen = !!Lampa.Platform.is('tizen');
platform.webos = !!Lampa.Platform.is('webos');
platform.android = !!Lampa.Platform.is('android');
}
} catch (e) { }
try {
if (LC.perf && typeof LC.perf.weakHardware === 'function') platform.weak = !!LC.perf.weakHardware();
} catch (e2) { }
return platform;
};


LC.pref = function (name, def) {
if (LC.prefs.overridden(name)) return LC.prefs.normalize(LC.prefs.overrideOf(name), def);
var value;
try {
if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') {
value = Lampa.Storage.get(name, def);
}
} catch (e) {
warn('storage read failed: ' + name, e);
}
return LC.prefs.normalize(value, def);
};




LC.enabled = function () {
return LC.pref('lumen_enabled', true);
};






LC.badgesMode = function () {
return LC.prefs.badgesMode(LC.pref('lumen_badges', 'poster'));
};







LC.postersMode = function () {
var value = LC.pref('lumen_posters', 'lampa');
return value === 'original' || value === 'clean' ? value : 'lampa';
};











LC.accentScope = function () {
if (!LC.pref('lumen_accent_auto', true)) return 'full';
return LC.pref('lumen_accent_scope', 'full') === 'veil' ? 'veil' : 'full';
};











LC.migratePrefs = function () {
try {
if (!window.Lampa || !Lampa.Storage || typeof Lampa.Storage.set !== 'function') return;
if (typeof Lampa.Storage.get !== 'function') return;
var badges = Lampa.Storage.get('lumen_badges', '');


if (badges === '' || badges === null || typeof badges === 'undefined') return;
if (badges === 'poster' || badges === 'caption' || badges === 'off') return;
Lampa.Storage.set('lumen_badges', LC.prefs.badgesMode(badges));
} catch (e) {
warn('prefs migrate failed', e);
}
};

LC.motionModeFor = LC.prefs.motionModeFor;



LC.motionMode = function () {
var stored = LC.pref('lumen_motion', 'auto');
var platform = LC.platformInfo();




var auto = null;
try {
if (LC.perf && typeof LC.perf.mode === 'function') auto = LC.perf.mode();
} catch (e3) { }
return LC.prefs.motionModeFor(stored, platform, auto);
};



















LC.fxHeavy = function () {
try {
if (LC.motionMode() !== 'full') return false;
return !!LC.pref('lumen_fx_heavy', LC.prefs.fxHeavyDefault(LC.platformInfo()));
} catch (e) {
return false;
}
};





if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.prefs;


/* ---- 85_header.js ---- */










var isSerial = LC.cardinfo.isSerial;

function capitalize(str) {
str = '' + (str || '');
try {
if (window.Lampa && Lampa.Utils && typeof Lampa.Utils.capitalizeFirstLetter === 'function') {
return Lampa.Utils.capitalizeFirstLetter(str);
}
} catch (e) { }
return str.charAt(0).toUpperCase() + str.slice(1);
}

function getGenres(movie) {
return LC.cardinfo.genres(movie && movie.genres, capitalize);
}

function getPG(movie, root) {
var parsed = '';
try {
if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.parsePG === 'function') parsed = Lampa.TMDB.parsePG(movie);
} catch (e) { }
var domText = '';
if (root) {
try {
var node = root.find('.full-start__pg');
if (node.length) domText = node.text();
} catch (e2) { }
}
return LC.cardinfo.pgText(parsed, domText);
}







function reactionsEnabled() {
try {
if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') {
return !!Lampa.Storage.field('card_interfice_reactions');
}
} catch (e) { }
return false;
}

function bigNumber(n) {
try {
if (window.Lampa && Lampa.Utils && typeof Lampa.Utils.bigNumberToShort === 'function') return Lampa.Utils.bigNumberToShort(n);
} catch (e) { }
return '' + n;
}






function timelineView(hash) {
try {
if (window.Lampa && Lampa.Timeline && typeof Lampa.Timeline.view === 'function') return Lampa.Timeline.view(hash);
} catch (e) { }
return null;
}

function utilsHash(str) {
try {
if (window.Lampa && Lampa.Utils && typeof Lampa.Utils.hash === 'function') return Lampa.Utils.hash(str);
} catch (e) { }
return 0;
}












function renderMeta(root, movie) {
var parts = [];
var serial = isSerial(movie);

var release = (movie.release_date || movie.first_air_date || '') + '';
var year = release ? release.slice(0, 4) : '';
if (year) parts.push('<span>' + LC.util.esc(year) + '</span>');




var headText = root.find('.full-start-new__head').text();
var countryText = LC.cardinfo.country(headText, movie.production_countries,
typeof LC.langCode === 'function' ? LC.langCode() : 'ru');
if (countryText) parts.push('<span>' + LC.util.esc(countryText) + '</span>');

if (serial) {
var counts = [];
if (movie.number_of_seasons) counts.push(movie.number_of_seasons + ' ' + LC.seasonsWord(movie.number_of_seasons));
if (movie.number_of_episodes) counts.push(movie.number_of_episodes + ' ' + LC.episodesWord(movie.number_of_episodes));
if (counts.length) parts.push('<span>' + LC.util.esc(counts.join(', ')) + '</span>');
} else if (movie.runtime > 0) {
parts.push('<span>' + LC.util.esc(LC.util.fmtRuntime(movie.runtime, LC.lang('lumen_card_min'))) + '</span>');
}

var genres = getGenres(movie);
if (genres.length) parts.push('<span>' + LC.util.esc(genres.join(', ')) + '</span>');

var pg = getPG(movie, root);
if (pg) parts.push('<span>' + LC.util.esc(pg) + '</span>');













if (serial) {
var studio = LC.cardinfo.network(movie);
if (studio) parts.push('<span>' + LC.util.esc(studio) + '</span>');
}

var html = [];
for (var i = 0; i < parts.length; i++) {
if (i) html.push('<span class="lumen-meta__sep">·</span>');
html.push(parts[i]);
}

root.find('.lumen-meta').html(html.join(''));
root.addClass('lumen--meta');
}








function renderTitleClass(root, movie) {
var node = root.find('.full-start-new__title');
if (!node.length) return;
var title = movie.title || movie.name || '';
node.removeClass('lumen-title--long lumen-title--split');










var parts = LC.cardinfo.titleParts(title);
if (parts) {
node.addClass('lumen-title--split');
node.html(
'<div class="lumen-title__lead">' + LC.util.esc(parts.lead) + '</div>' +
'<div class="lumen-title__sub">' + LC.util.esc(parts.sub) + '</div>'
);
return;
}
if (node.find('.lumen-title__lead').length) node.text(title);

var cls = LC.cardinfo.titleClass(title);
if (cls) node.addClass(cls);
}










































function cardLogoAllowed() {
try { return LC.pref ? LC.pref('lumen_card_logo', true) !== false : true; } catch (e) { return true; }
}

function logoLang() {
try {
if (typeof LC.langCode === 'function') return LC.langCode();
} catch (e) { }
return 'ru';
}

function setTitleMode(root, mode) {
root.removeClass('lumen-logo-wait lumen-logo-on');
if (mode === 'wait') root.addClass('lumen-logo-wait');
else if (mode === 'logo') root.addClass('lumen-logo-on');
}

function renderLogo(root, movie) {
var el = root[0];
if (!el) return;
var title = root.find('.full-start-new__title');
if (!title.length) return;


var holder = root.find('.lumen-logo');
if (!holder.length) return;



el.lumen_logo_movie = movie;

var hero = LC.hero;
var item = null;
if (cardLogoAllowed() && hero && typeof hero.pickLogoItem === 'function') {
item = hero.pickLogoItem(movie && movie.images && movie.images.logos, logoLang());
}
var path = item ? item.file_path : '';
var prev = el.lumen_logo;



if (prev && prev.path === path) return;
if (prev && prev.handle) prev.handle.cancel();
var st = { path: path, handle: null };
el.lumen_logo = st;

if (!path) {
holder.css('background-image', 'none');
holder.removeClass('lumen-logo-white');
setTitleMode(root, 'text');
return;
}
var box = hero.cardLogoBox(hero.logoRatioOf(item));
holder.css('width', box ? box.w + 'em' : '');
holder.css('height', box ? box.h + 'em' : '');



var url = hero.logoUrl(path);
setTitleMode(root, 'wait');
var handle = hero.waitLogo(path, url, function (show) {
if (el.lumen_logo !== st) return;
st.handle = null;
if (show) {
holder.css('background-image', 'url("' + encodeURI(url) + '")');



holder.toggleClass('lumen-logo-white', typeof hero.logoTone === 'function' && hero.logoTone(path) === 'dark');
setTitleMode(root, 'logo');
} else {
holder.css('background-image', 'none');
holder.removeClass('lumen-logo-white');
setTitleMode(root, 'text');
}
});

if (el.lumen_logo === st && root.hasClass('lumen-logo-wait')) st.handle = handle;
}





function applyLogoPref() {
$('.lumen-card').each(function () {
var el = this;
if (!el.lumen_logo_movie) return;
if (el.lumen_logo && el.lumen_logo.handle) el.lumen_logo.handle.cancel();
el.lumen_logo = null;
try { renderLogo($(el), el.lumen_logo_movie); } catch (e) { warn('logo pref failed', e); }
});
}




function renderStatus(root, movie) {
var node = root.find('.full-start__status');
if (!node.length) return;

node.removeClass('lumen-status--good lumen-status--accent lumen-status--muted lumen-status--soon');

var kind = LC.cardinfo.statusKind(movie.status);
node.addClass('lumen-status--' + kind);

if (kind === 'soon') node.text(LC.lang('lumen_card_status_soon'));
}



function renderReactionsChip(root, data) {
var chip = root.find('.lumen-reactions-chip');
if (!chip.length) return;

chip.addClass('hide');
var count = LC.cardinfo.reactionsCount(data && data.reactions && data.reactions.result);
if (!count || !reactionsEnabled()) return;

chip.find('.lumen-reactions-chip__value').text(bigNumber(count));
chip.find('.lumen-reactions-chip__label').text(LC.lang('lumen_card_reactions'));
chip.removeClass('hide');
}







function renderQualityChips(root, movie) {
var holder = root.find('.lumen-tags');
if (!holder.length) return;

holder.find('.lumen-quality-chip').remove();
if (isSerial(movie)) return;

var chips = LC.cardinfo.qualityChips(movie.release_quality || movie.quality);
var html = [];
for (var i = 0; i < chips.length; i++) html.push('<div class="lumen-quality-chip">' + LC.util.esc(chips[i]) + '</div>');
if (html.length) holder.append(html.join(''));
}











function cssString(text) {
return '"' + ('' + text).replace(/[\\"]/g, '\\$&').replace(/[\r\n\f]+/g, ' ') + '"';
}






function setPlayLabel(root, text) {
var node = root[0];
if (!node || !node.style || typeof node.style.setProperty !== 'function') return;
if (text) {
node.style.setProperty('--lumen-play-label', cssString(text));
root.addClass('lumen-continue');
return;
}
root.removeClass('lumen-continue');
if (typeof node.style.removeProperty === 'function') node.style.removeProperty('--lumen-play-label');
clearInlineStyleIfEmpty(root);
}











function renderProgress(root, movie, episodes) {



if (root[0]) root[0].lumenProgress = { movie: movie, episodes: episodes || null };

var on = LC.pref(PLUGIN + '_progress', true);



root.toggleClass('lumen-progress-on', on);

var row = root.find('.lumen-progress');
if (row.length) row.addClass('hide');

var found = null;
if (on) {





found = isSerial(movie)
? LC.progress.serialProgress(movie, timelineView, utilsHash, episodes, new Date())
: LC.progress.movieProgress(movie, timelineView, utilsHash);
}
if (!found || !found.view) {
setPlayLabel(root, '');
return;
}



setPlayLabel(root, found.season ? LC.lang('lumen_card_continue') + ' S' + found.season + ' E' + found.episode : '');
if (!row.length) return;

var percent = Math.max(0, Math.min(100, Math.round(found.view.percent || 0)));
var caption = LC.progress.label(found, episodes, { min: LC.lang('lumen_card_min') });

var time = '';
if (found.view.duration > 0) time = LC.util.fmtTime(found.view.time) + ' / ' + LC.util.fmtTime(found.view.duration);
else if (found.view.time > 0) time = LC.util.fmtTime(found.view.time);
if (percent > 0) time = time ? time + ' · ' + percent + ' %' : percent + ' %';

if (!caption && !time) return;

row.find('.lumen-progress__label').text(caption);
row.find('.lumen-progress__time').text(caption && time ? '· ' + time : time);
var fill = row.find('.lumen-progress__bar > div');
fill.css('width', percent ? percent + '%' : '');
clearInlineStyleIfEmpty(fill);
row.removeClass('hide');
}





function refreshProgress() {
$('.lumen-card').each(function () {
var info = this.lumenProgress;
if (info) renderProgress($(this), info.movie, info.episodes);
});
}














var PROGRESS_DEBOUNCE = 300;
var progress_timer = null;

function scheduleProgressRefresh() {
if (progress_timer) return;
progress_timer = setTimeout(function () {
progress_timer = null;
try {
refreshProgress();
} catch (e) {
warn('progress refresh failed', e);
}
}, PROGRESS_DEBOUNCE);
}




















function renderSerialMode(root, movie) {
var serial = isSerial(movie);
root.toggleClass('lumen-card--serial', serial);
if (!serial) return;
var status = root.find('.full-start__status');
var chip = root.find('.lumen-next-chip');
if (status.length && chip.length && status.next()[0] !== chip[0]) chip.before(status);
if (status.length) statusLevels(status);
}















function statusLevels(status) {
var value = status.find('.lumen-status__value');
if (value.length) return value;
var current = status.text();
status.html(
'<div class="lumen-status__value"></div>' +
'<div class="lumen-status__label"></div>' +
'<div class="lumen-status__short"></div>'
);
value = status.find('.lumen-status__value');
value.text(current);
return value;
}




function dateWords() {
return {
next: LC.lang('lumen_card_next_episode'),
today: LC.lang('lumen_card_today'),
tomorrow: LC.lang('lumen_card_tomorrow'),
inDays: LC.lang('lumen_card_in_days'),
months: ('' + LC.lang('lumen_card_months_gen')).split(','),
daysWord: LC.daysWord
};
}

function monthsShort() {
return ('' + LC.lang('lumen_card_months_short')).split(',');
}





function countdownWords() {
return {
premiere: LC.lang('lumen_badge_premiere'),
today: LC.lang('lumen_badge_premiere_today'),
tomorrow: LC.lang('lumen_card_tomorrow'),
inDays: LC.lang('lumen_card_in_days'),
months: monthsShort(),
daysWord: LC.daysWord
};
}









function renderNextChip(root, movie) {
var chip = root.find('.lumen-next-chip');
if (!chip.length) return;
chip.addClass('hide');

var serial = isSerial(movie);
var text = '';
var when = '';
var label = '';
if (serial) {
var next = LC.cardinfo.nextEpisode(movie.next_episode_to_air, new Date(), dateWords());
if (!next) return;
text = next.text;
label = next.when || next.text;
when = LC.cardinfo.shortDate(movie.next_episode_to_air.air_date, monthsShort());
} else {
var soon = LC.badges.countdown(movie.release_date, new Date(), countdownWords());
if (!soon) return;
text = soon;
label = soon;
when = LC.cardinfo.shortDate(movie.release_date, monthsShort());
}
chip.find('.lumen-next-chip__text').text(text);







var short = chip.find('.lumen-next-chip__short');
if (!short.length) {
chip.append('<div class="lumen-next-chip__short"></div>');
short = chip.find('.lumen-next-chip__short');
}

short.text(when ? '· ' + when : '');

chip.removeClass('hide');







if (!serial) return;








var status = root.find('.full-start__status');
if (!status.length || status.hasClass('hide')) return;
statusLevels(status);
status.find('.lumen-status__label').text(label);
status.find('.lumen-status__short').text(when || '');
chip.addClass('hide');
}

var EPISODE_STATES = 'lumen-episode--watched lumen-episode--watching lumen-episode--aired lumen-episode--soon';





var STILL_WINDOW = 6;





function episodeEm() {
return LC.episodeEm;
}



function episodeStepEm() {
var m = episodeEm();
return m.width + m.gap;
}



















function episodeHalf() {
var step = LC.util.emPx(episodeStepEm());
var visible = step > 0 ? Math.ceil(LC.util.screenPx() / step) : 0;
if (!(visible > 0)) visible = 1;
return visible + STILL_WINDOW;
}





















function stillSize() {
return LC.util.emPx(episodeEm().width) * 0.85 > 185 ? 'w300' : 'w185';
}




function applyStill(node) {
var url = node.attr('data-still');
if (!url) return;
node[0].lumenStill = true;
node.find('.lumen-episode__still').css('background-image', 'url("' + ('' + url).replace(/["\\]/g, '\\$&') + '")');
}




function loadStills(nodes, center) {
var from = Math.max(0, center - STILL_WINDOW);
var to = Math.min(nodes.length - 1, center + STILL_WINDOW);
for (var i = from; i <= to; i++) {
if (nodes[i] && !nodes[i][0].lumenStill) applyStill(nodes[i]);
}
}












function dropStills(nodes, center, scanFrom, scanTo) {
var from = center - STILL_WINDOW * 2;
var to = center + STILL_WINDOW * 2;
var last = scanTo < nodes.length - 1 ? scanTo : nodes.length - 1;
for (var i = scanFrom > 0 ? scanFrom : 0; i <= last; i++) {
if ((i >= from && i <= to) || !nodes[i] || !nodes[i][0].lumenStill) continue;
nodes[i][0].lumenStill = false;
var still = nodes[i].find('.lumen-episode__still');
still.css('background-image', '');
clearInlineStyleIfEmpty(still);
}
}





function episodeInner(ep, st, months, hasStill, view) {
var esc = LC.util.esc;
var min = LC.lang('lumen_card_min');
var runtime = ep.runtime > 0 ? ep.runtime + ' ' + min : '';
var caption = runtime;
var badge = '';
var state = '';
var timecode = '';

if (st.state === 'watched') {
caption = (runtime ? runtime + ' · ' : '') + LC.lang('lumen_card_ep_watched');
badge = '<div class="lumen-episode__check"></div>';
} else if (st.state === 'watching') {
caption = LC.lang('lumen_card_ep_watching') + (st.leftMin ? ' · ' + LC.lang('lumen_card_ep_left') + ' ' + st.leftMin + ' ' + min : '');
badge = '<div class="lumen-episode__percent">' + st.percent + ' %</div>';








state = '<div class="lumen-episode__state">· ' + esc(LC.lang('lumen_card_ep_watching')) + '</div>';
var played = view && view.time > 0 ? LC.util.fmtTime(view.time) : '';
var total = view && view.duration > 0 ? LC.util.fmtTime(view.duration) : '';
var stamp = played && total ? played + ' / ' + total : played;
timecode = '<div class="lumen-episode__timecode">' + esc(stamp ? stamp + ' · ' + st.percent + ' %' : st.percent + ' %') + '</div>';
} else if (st.state === 'soon') {
var date = LC.cardinfo.shortDate(ep.air_date, months);
caption = (date ? date + ' · ' : '') + LC.lang('lumen_card_ep_soon');
}

return '' +
(hasStill ? '<div class="lumen-episode__still"></div>' : '') +
'<div class="lumen-episode__top">' +
'<div class="lumen-episode__num">E' + esc(ep.episode_number) + '</div>' + state + badge +
'<div class="lumen-episode__play"></div>' +
'</div>' +
'<div class="lumen-episode__bottom">' +
'<div class="lumen-episode__name">' + esc(ep.name || '') + '</div>' +
(caption ? '<div class="lumen-episode__caption">' + esc(caption) + '</div>' : '') + timecode +
(st.state === 'watching' ? '<div class="lumen-episode__bar"><div style="width:' + st.percent + '%"></div></div>' : '') +
'</div>';
}











function paintEpisode(node, ep, hash, now, months) {
var view = hash ? timelineView(hash) : null;
var st = LC.progress.episodeState(view, ep.air_date, now, ep.runtime);
var sign = st.state + '|' + (st.percent || '') + '|' + (st.leftMin || '');
if (node[0].lumenSign === sign) return st;

node[0].lumenSign = sign;
node.removeClass(EPISODE_STATES).addClass('lumen-episode--' + st.state).html(episodeInner(ep, st, months, !!node.attr('data-still'), view));
if (node[0].lumenStill) applyStill(node);
return st;
}




function setShift(track, px) {
if (!track.length) return;
track[0].lumenShift = px;
var value = px ? 'translate3d(' + (-px) + 'px,0,0)' : '';
track.css({ '-webkit-transform': value, transform: value });
clearInlineStyleIfEmpty(track);
}





















function episodesSign(list) {
if (!list || !list.length) return '';
var first = list[0] || {};
var last = list[list.length - 1] || {};
return [list.length, first.season_number, first.episode_number, last.episode_number, last.air_date].join('|');
}








function makeEpisode(info, pos, now, months) {
var item = info.eps[pos];
var node = $('<div class="lumen-episode selector"></div>');
if (item.still) node.attr('data-still', item.still);
node[0].lumenPos = pos;
paintEpisode(node, item.ep, item.hash, now, months);
return node;
}









function setSpacer(track, before, after) {
if (!track.length) return;
var step = episodeStepEm();
track.css({
'padding-left': before > 0 ? (Math.round(before * step * 100) / 100) + 'em' : '',
'padding-right': after > 0 ? (Math.round(after * step * 100) / 100) + 'em' : ''
});
clearInlineStyleIfEmpty(track);
}






function mountWindow(info, from, to) {
var nodes = info.nodes;
var now = new Date();
var months = monthsShort();
var changed = false;
var i;

for (i = info.from; i <= info.to; i++) {
if (i >= from && i <= to) continue;
if (!nodes[i]) continue;
nodes[i].remove();
nodes[i] = null;
changed = true;
}
for (i = from > info.to + 1 ? from : info.to + 1; i <= to; i++) {
if (nodes[i]) continue;
nodes[i] = makeEpisode(info, i, now, months);
info.track.append(nodes[i]);
changed = true;
}
for (i = to < info.from - 1 ? to : info.from - 1; i >= from; i--) {
if (nodes[i]) continue;
nodes[i] = makeEpisode(info, i, now, months);
info.track.prepend(nodes[i]);
changed = true;
}

info.from = from;
info.to = to;
setSpacer(info.track, from, info.eps.length - 1 - to);
return changed;
}





function slideWindow(info, center) {
var last = info.eps.length - 1;
var half = info.half;
var needLeft = info.from > 0 && center - info.from < STILL_WINDOW;
var needRight = info.to < last && info.to - center < STILL_WINDOW;
if (!needLeft && !needRight) return false;

var from = center - half;
var to = center + half;
if (to > last) to = last;
from = to - half * 2;
if (from < 0) from = 0;
to = from + half * 2;
if (to > last) to = last;
if (from === info.from && to === info.to) return false;
return mountWindow(info, from, to);
}

















function recollectEpisodes(root, focused) {
try {
if (!window.Lampa || !Lampa.Controller) return;
if (typeof Lampa.Controller.collectionSet !== 'function') return;
if (!LC.util.onScreen(root)) return;
var enabled = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
if (!enabled || enabled.name !== 'full_start') return;
Lampa.Controller.collectionSet(root);
if (typeof Lampa.Controller.collectionFocus === 'function') {
Lampa.Controller.collectionFocus(focused || false, root);
}
} catch (e) {
warn('episodes collection failed', e);
}
}













function renderEpisodes(root, data) {
var row = root.find('.lumen-episodes');
var had = row.length ? !!row[0].lumenEpisodes : false;
var keep = null;
if (had) {
var cur = root.find('.selector.focus');
if (cur.length && !cur.hasClass('lumen-episode')) keep = cur[0];
}
if (buildEpisodes(root, data) && had) recollectEpisodes(root, keep);
}


function buildEpisodes(root, data) {
var row = root.find('.lumen-episodes');
if (!row.length) return false;

var movie = (data && data.movie) || {};
var list = data && data.episodes && data.episodes.episodes;
var sign = episodesSign(list);
var previous = row[0].lumenEpisodes;
if (previous && list && previous.list === list && previous.sign === sign) return false;

var track = row.find('.lumen-episodes__track');
row.addClass('hide');
track.empty();
setShift(track, 0);
setSpacer(track, 0, 0);
row[0].lumenEpisodes = null;

if (!isSerial(movie) || !list || !list.length) return true;

var season = parseInt(data.episodes.season_number, 10) || parseInt(list[0] && list[0].season_number, 10) || 0;
var key = movie.original_name || movie.original_title || '';


var stillW = stillSize();
var eps = [];




for (var i = 0; i < list.length; i++) {
var ep = list[i];
if (!ep || !(ep.episode_number > 0)) continue;
var hash = key && season ? '' + utilsHash([season, season > 10 ? ':' : '', ep.episode_number, key].join('')) : '';
if (hash === '0') hash = '';
eps.push({
ep: ep,
index: i,
hash: hash,
still: LC.cardinfo.imageUrl(ep.still_path, stillW, tmdbImageFn(), apiImgFn())
});
}
if (!eps.length) return true;

var nodes = [];
for (i = 0; i < eps.length; i++) nodes.push(null);




var info = { list: list, eps: eps, nodes: nodes, sign: sign, track: track, half: episodeHalf(), from: 0, to: -1 };
mountWindow(info, 0, Math.min(eps.length - 1, info.half * 2));
row[0].lumenEpisodes = info;





loadStills(nodes, 0);
for (i = info.from; i <= info.to; i++) {
if (nodes[i] && nodes[i].hasClass('lumen-episode--watching')) { loadStills(nodes, i); break; }
}

row.find('.lumen-episodes__title').text(season ? LC.lang('lumen_card_season') + ' ' + season : (data.episodes.name || ''));
row.find('.lumen-episodes__count').text(eps.length + ' ' + LC.episodesWord(eps.length));
row.removeClass('hide');




markClipped(info, track, viewWidth(row.find('.lumen-episodes__viewport')[0]));
scheduleClip(root);
return true;
}




























function viewWidth(viewport) {
if (!viewport) return 0;
var screen = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
return screen - viewport.getBoundingClientRect().left;
}

function markRow(root) {
var row = root.find('.lumen-episodes');
if (!row.length || !row[0].lumenEpisodes) return;
markClipped(row[0].lumenEpisodes, row.find('.lumen-episodes__track'), viewWidth(row.find('.lumen-episodes__viewport')[0]));
}








function scheduleClip(root) {
setTimeout(function () {
try {
markRow(root);
} catch (e) {
warn('episodes clip failed', e);
}
}, 0);
}

function markClipped(info, track, view) {
if (!info || !track.length || !(view > 0)) return;

var shift = track[0].lumenShift || 0;
var nodes = info.nodes;
var marks = [];
var i;
for (i = info.from; i <= info.to; i++) {
var node = nodes[i];
if (!node || !node.length) continue;
var left = node[0].offsetLeft;


marks.push([node, left < shift - 0.5 || left + node[0].offsetWidth > shift + view + 0.5]);
}
for (i = 0; i < marks.length; i++) {
if (marks[i][1]) marks[i][0].addClass('lumen-episode--cut');
else marks[i][0].removeClass('lumen-episode--cut');
}
}











function scrollToEpisode(root, node, still) {
var row = root.find('.lumen-episodes');
var viewport = root.find('.lumen-episodes__viewport')[0];
var track = row.find('.lumen-episodes__track');
if (!viewport || !track.length || !node) return;

var info = row.length ? row[0].lumenEpisodes : null;
if (info && typeof node.lumenPos === 'number') {




if (slideWindow(info, node.lumenPos)) recollectEpisodes(root, node);
loadStills(info.nodes, node.lumenPos);
dropStills(info.nodes, node.lumenPos, info.from, info.to);
}

var view = viewWidth(viewport);
if (view <= 0) return;

var current = track[0].lumenShift || 0;
var shift = current;
var left = node.offsetLeft;
var width = node.offsetWidth;
var reserve = Math.round(width / 2);

if (left - reserve < shift) shift = left - reserve;
else if (left + width + reserve > shift + view) shift = left + width + reserve - view;
shift = Math.max(0, Math.min(shift, track[0].scrollWidth - view));

if (shift !== current && !still) setShift(track, shift);



markClipped(info, track, view);
}











var WHEEL_MS = 200;

function wheelForward(e) {
if (typeof e.deltaY === 'number' && e.deltaY) return e.deltaY > 0;
return (Number(e.wheelDelta) || 0) < 0;
}

function wheelEpisodes(root, e) {
if (!e || typeof e.clientX !== 'number') return false;
if (!$(e.target).closest('.lumen-episodes__viewport').length) return false;
var row = root.find('.lumen-episodes');
var info = row.length ? row[0].lumenEpisodes : null;
var viewport = root.find('.lumen-episodes__viewport')[0];
var track = row.find('.lumen-episodes__track');
if (!info || !viewport || !track.length) return false;
var left = viewport.getBoundingClientRect().left;
var screen = window.innerWidth || 0;
if (!(e.clientX - left > (screen - left) / 2)) return false;
var now = Date.now();
if (now - (row[0].lumenWheelAt || 0) < WHEEL_MS) return true;
row[0].lumenWheelAt = now;
var view = viewWidth(viewport);
if (view <= 0) return true;
var forward = wheelForward(e);
var shift = track[0].lumenShift || 0;
var target = null;
for (var i = info.from; i <= info.to; i++) {
var node = info.nodes[i];
if (!node || !node.length) continue;
var l = node[0].offsetLeft;
if (forward) {
if (l + node[0].offsetWidth > shift + view + 0.5) { target = node[0]; break; }
} else if (l < shift - 0.5) {
target = node[0];
}
}
if (target) scrollToEpisode(root, target, false);
return true;
}









function bindEpisodes(root) {
var el = root[0];
if (!el || typeof el.addEventListener !== 'function' || el.lumenEpisodesBound) return;
el.lumenEpisodesBound = true;






LC.focus.capture(el, function (e) {
try {
var node = $(e.target).closest('.lumen-episode', el);
if (node.length) {
root.addClass('lumen-compact');









if (el.lumenEpisodesBusy) return;
el.lumenEpisodesBusy = true;
try {
scrollToEpisode(root, node[0], !LC.focus.remote(e));
} finally {
el.lumenEpisodesBusy = false;
}
} else if ($(e.target).closest('.full-start-new__buttons', el).length) {
root.removeClass('lumen-compact');
}
} catch (err) {
warn('episode focus failed', err);
}
});


var onWheel = function (e) {
try {
if (wheelEpisodes(root, e)) {
if (e.stopPropagation) e.stopPropagation();
if (e.cancelable && e.preventDefault) e.preventDefault();
}
} catch (err) {
warn('episode wheel failed', err);
}
};
el.addEventListener('wheel', onWheel);
el.addEventListener('mousewheel', onWheel);



el.addEventListener('hover:enter', function (e) {
try {
if (!$(e.target).closest('.lumen-episode', el).length) return;

root.find('.full-start-new__buttons').find('.button--play').not('.hide').eq(0).trigger('hover:enter');
} catch (err) {
warn('episode enter failed', err);
}
}, true);
}




























function upTarget(root) {
var nav = window.Navigator;
if (!nav || typeof nav.getFocusedElement !== 'function' || typeof nav.canmove !== 'function') return null;
var from = nav.getFocusedElement();
if (!from || !$(from).hasClass('lumen-episode')) return null;
if ($(from).closest('.full-start-new')[0] !== root[0]) return null;
if (nav.canmove('up')) return null;

var box = root.find('.full-start-new__buttons')[0];
if (!box || typeof box.querySelectorAll !== 'function') return null;
var list = box.querySelectorAll('.selector');
var src = from.getBoundingClientRect();
var mid = src.left + src.width / 2;
var best = null;
var bestGap = 0;
for (var i = 0; i < list.length; i++) {
var el = list[i];
if ($(el).hasClass('hide') || !el.offsetParent) continue;
var r = el.getBoundingClientRect();
if (!(r.width > 0)) continue;
var gap = mid < r.left ? r.left - mid : (mid > r.left + r.width ? mid - r.left - r.width : 0);
if (!best || gap < bestGap) {
best = el;
bestGap = gap;
}
}
return best;
}

function bindStart(item, root) {
if (!item || typeof item.use !== 'function' || !root || !root.length || item.lumenUpBound) return;
item.lumenUpBound = true;
item.use({
onController: function (controller) {
var up = controller && controller.up;
if (typeof up !== 'function') return;
controller.up = function () {
try {
var target = upTarget(root);
if (target && window.Lampa && Lampa.Controller && typeof Lampa.Controller.collectionFocus === 'function') {
Lampa.Controller.collectionFocus(target, root);
if (window.Navigator.getFocusedElement() === target) return;
}
} catch (e) {
warn('episode up failed', e);
}
return up.apply(this, arguments);
};
}
});
}








function refreshEpisode(hash) {
hash = '' + (hash || '');
if (!/^\d+$/.test(hash)) return;
var now = new Date();
var months = monthsShort();
$('.lumen-card .lumen-episodes').each(function () {
var info = this.lumenEpisodes;
if (!info) return;
for (var i = info.from; i <= info.to; i++) {
var node = info.nodes[i];
if (!node || info.eps[i].hash !== hash) continue;
paintEpisode(node, info.eps[i].ep, hash, now, months);
}
});
}








function factWords() {
return {
original: LC.lang('lumen_card_fact_original'),
premiere: LC.lang('lumen_card_fact_premiere'),
creator: LC.lang('lumen_card_fact_creator'),
budget: LC.lang('lumen_card_fact_budget'),
months: ('' + LC.lang('lumen_card_months_gen')).split(',')
};
}











function factsSign(data, lang) {
var movie = (data && data.movie) || {};
return [movie.id, movie.title || movie.name, movie.original_title || movie.original_name,
movie.release_date || movie.first_air_date,
(movie.created_by && movie.created_by.length && movie.created_by[0] && movie.created_by[0].name) || '',
movie.budget || 0, lang].join('|');
}















































function openDescrModal(text, title, node) {
try {
if (!text || !window.Lampa || !Lampa.Modal || typeof Lampa.Modal.open !== 'function') return;




var back = 'full_descr';
try {
var enabled = Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
if (enabled && enabled.name) back = enabled.name;
} catch (e) { }

var html = $('<div class="lumen-descr-modal"></div>');
html.html('<div class="lumen-descr-modal__text">' + LC.util.esc(text) + '</div>');

Lampa.Modal.open({
title: title || '',
html: html,
size: 'medium',
onBack: function () {
try { Lampa.Modal.close(); } catch (e2) { }
try { Lampa.Controller.toggle(back); } catch (e3) { }
try {
if (node && node.length && typeof Lampa.Controller.collectionFocus === 'function') {
Lampa.Controller.collectionFocus(node, node.closest('.items-line'));
}
} catch (e4) { }
}
});
} catch (err) {
warn('descr modal failed', err);
}
}

function bindDescrText(holder, movie) {
var el = holder[0];
if (!el || typeof el.addEventListener !== 'function') return;



el.lumenDescrText = movie || null;
if (el.lumenDescrBound) return;
el.lumenDescrBound = true;

el.addEventListener('hover:enter', function (event) {
try {
var node = $(event.target).closest('.full-descr__text', el);
if (!node || !node.length) return;
var card = el.lumenDescrText || {};
openDescrModal(card.overview, card.title || card.name || '', node);
} catch (err) {
warn('descr enter failed', err);
}
}, true);
}












function ensureDescrHint(holder, movie) {
var left = holder.find('.full-descr__left');
if (!left.length) return;
var existing = left.find('.lumen-descr-more');
if (!(movie && movie.overview)) {
if (existing.length) existing.remove();
return;
}
var text = left.find('.full-descr__text').eq(0);
var hint = existing.length ? existing.eq(0) : $('<div class="lumen-descr-more">' + LC.util.esc(LC.lang('lumen_card_descr_more')) + '</div>');
if (!text.length) {
if (!existing.length) left.append(hint);
return;
}
if (existing.length && text.next()[0] === hint[0]) return;
text.after(hint);
}

function renderDescrRow(row, data) {
if (!row || !row.length) return;
var holder = row.find('.full-descr');
if (!holder.length) return;

row.addClass('lumen-descr-row');

var card = (data && data.movie) || null;
try { bindDescrText(holder, card); } catch (eBind) { warn('descr bind failed', eBind); }
try { ensureDescrHint(holder, card); } catch (eHint) { warn('descr hint failed', eHint); }







var sign = factsSign(data, LC.lang('lumen_card_facts'));
var previous = holder[0].lumenFacts;
if (previous && previous.sign === sign && (!previous.count || holder.find('.lumen-facts').length)) return;

holder.find('.lumen-facts').remove();
holder[0].lumenFacts = { sign: sign, count: 0 };

var list = LC.cardinfo.facts((data && data.movie) || null, factWords());
if (!list.length) return;
holder[0].lumenFacts = { sign: sign, count: list.length };

var esc = LC.util.esc;
var cells = [];
for (var i = 0; i < list.length; i++) {
cells.push('<div class="lumen-facts__label">' + esc(list[i].label) + '</div>');
cells.push('<div class="lumen-facts__value">' + esc(list[i].value) + '</div>');
}

var block = $('<div class="lumen-facts"></div>');
block.html('<div class="lumen-facts__title">' + esc(LC.lang('lumen_card_facts')) + '</div>' +
'<div class="lumen-facts__grid">' + cells.join('') + '</div>');
holder.append(block);
}






































var DESCR_PAGES = ['lumen-reviews', 'lumen-fr'];

function isDescrPage(el) {
if (!el || !el.classList) return false;
for (var i = 0; i < DESCR_PAGES.length; i++) if (el.classList.contains(DESCR_PAGES[i])) return true;
return false;
}

function descrHolder(rowEl) {
var list = rowEl && typeof rowEl.querySelectorAll === 'function' ? rowEl.querySelectorAll('.full-descr') : null;
return list && list.length ? list[0] : null;
}



function descrPageOf(holder, node) {
for (var el = node; el; el = el.parentNode) {
if (el === holder) return null;
if (el.parentNode === holder) return isDescrPage(el) ? el : null;
}
return undefined;
}







function descrView(scroll) {
if (!scroll || typeof scroll.render !== 'function' || typeof scroll.body !== 'function' || typeof scroll.vieport !== 'function') return null;
var html = scroll.render(true);
var body = scroll.body(true);
if (!html || !body || typeof html.getBoundingClientRect !== 'function' || typeof body.getBoundingClientRect !== 'function') return null;
var box = html.getBoundingClientRect();
var content = typeof html.querySelector === 'function' ? html.querySelector('.scroll__content') : null;
var pad = 0;
if (content && typeof window.getComputedStyle === 'function') {
pad = parseFloat(window.getComputedStyle(content, null).getPropertyValue('padding-top')) || 0;
}
var bottom = box.top + box.height;
if (window.innerHeight && window.innerHeight < bottom) bottom = window.innerHeight;
var vp = scroll.vieport() || {};
return { top: box.top + pad, bottom: bottom, base: body.getBoundingClientRect().top, pos: Math.abs(vp.position || 0) };
}



function descrPlaced(view, node) {
var r = node.getBoundingClientRect();
var top = view.top + (r.top - view.base) - view.pos;
return { top: top, bottom: top + r.height };
}

function descrHidden(view, node) {
var p = descrPlaced(view, node);
return p.top < view.top - 0.5 || p.bottom > view.bottom + 0.5;
}

function descrFollow(rowEl, holder, scroll, node) {
var page = descrPageOf(holder, node);
if (page === undefined) return;
var view = descrView(scroll);
if (!view) return;
if (descrHidden(view, page || node)) scroll.update(page || rowEl);
}





function descrFocusable(el) {
return !!(el && el.classList && el.classList.contains('selector') && el.offsetParent !== null);
}











function descrTarget(holder, page, last) {
if (descrFocusable(last) && descrPageOf(holder, last) === page) return last;
var list = (page || holder).querySelectorAll('.selector');
var best = null;
var left = 0;
for (var i = 0; i < list.length; i++) {
if (!descrFocusable(list[i]) || descrPageOf(holder, list[i]) !== page) continue;
var x = list[i].getBoundingClientRect().left;
if (!best || x < left - 0.5) {
best = list[i];
left = x;
}
}
return best;
}







function descrFocus(rowEl, node) {
var C = window.Lampa && Lampa.Controller;
var nav = window.Navigator;
if (!node || !C || typeof C.collectionFocus !== 'function' || !nav || typeof nav.getFocusedElement !== 'function') return;
C.collectionFocus(node, rowEl);
if (nav.getFocusedElement() === node || typeof C.collectionSet !== 'function') return;
C.collectionSet(rowEl);
C.collectionFocus(node, rowEl);
}





function descrWheel(item, rowEl, holder, scroll, dir) {
var view = descrView(scroll);
if (!view) return false;
var blocks = [];
var kids = holder.children;
var i;
for (i = 0; i < kids.length; i++) {
if (isDescrPage(kids[i]) && kids[i].getBoundingClientRect().height > 0) blocks.push(kids[i]);
}
if (dir === 'down') {








var current = item.last ? descrPageOf(holder, item.last) : null;
for (i = 0; i < blocks.length; i++) {
var p = descrPlaced(view, blocks[i]);
if (!(p.top > view.top + 0.5)) continue;
if (blocks[i] === current && p.bottom <= view.bottom + 0.5) continue;
scroll.update(blocks[i]);
descrFocus(rowEl, descrTarget(holder, blocks[i], item.last));
return true;
}
return false;
}
if (descrPlaced(view, rowEl).top >= view.top - 0.5) return false;
var target = rowEl;
for (i = 0; i < blocks.length; i++) {
if (descrPlaced(view, blocks[i]).top < view.top - 0.5) target = blocks[i];
}
scroll.update(target);
descrFocus(rowEl, descrTarget(holder, target === rowEl ? null : target, item.last));
return true;
}

function descrActive(item) {
var C = window.Lampa && Lampa.Controller;
var en = C && typeof C.enabled === 'function' ? C.enabled() : null;
return !!(en && en.name === 'full_descr' && en.controller && en.controller.link === item);
}

function bindDescr(item, row, link) {
var rowEl = row && row[0];
if (!item || !rowEl || typeof rowEl.querySelectorAll !== 'function') return;
var holder = descrHolder(rowEl);
if (!holder) return;
var scroll = link && link.scroll;











if (!holder.lumenDescrFollow) {
holder.lumenDescrFollow = true;
LC.focus.capture(holder, function (e) {
try {
var node = e && e.target;
if (!node || descrPageOf(holder, node) === undefined) return;
if (node.classList && node.classList.contains('selector')) item.last = node;
if (LC.focus.remote(e)) descrFollow(rowEl, holder, scroll, node);
} catch (err) {
warn('descr focus failed', err);
}
});
}

if (typeof item.use === 'function' && !item.lumenDescrFollow) {
item.lumenDescrFollow = true;
item.use({
onToggle: function () {
try {
var last = item.last;
if (last && descrPageOf(holder, last)) descrFollow(rowEl, holder, scroll, last);
} catch (e) {
warn('descr toggle failed', e);
}
}
});
}





if (scroll && typeof scroll.onWheel === 'function' && !scroll.lumenDescrWheel) {
scroll.lumenDescrWheel = true;
var wheel = scroll.onWheel;
scroll.onWheel = function (step) {
try {
if (descrActive(item) && descrWheel(item, rowEl, holder, scroll, step > 0 ? 'down' : 'up')) return;
} catch (e) {
warn('descr wheel failed', e);
}
return wheel.apply(this, arguments);
};
}
}

function decorate(root, data) {
if (!root || !root.length) return;
if (!root.hasClass('lumen-card')) return;

var movie = (data && data.movie) || {};

try { renderTitleClass(root, movie); } catch (e) { warn('title failed', e); }
try { renderLogo(root, movie); } catch (e) { warn('logo failed', e); }
try { renderMeta(root, movie); } catch (e) { warn('meta failed', e); }
try { renderStatus(root, movie); } catch (e) { warn('status failed', e); }
try { renderSerialMode(root, movie); } catch (e) { warn('serial mode failed', e); }
try { renderNextChip(root, movie); } catch (e) { warn('next episode chip failed', e); }
try { renderReactionsChip(root, data); } catch (e) { warn('reactions chip failed', e); }
try { renderQualityChips(root, movie); } catch (e) { warn('quality chips failed', e); }
try { renderProgress(root, movie, (data && data.episodes && data.episodes.episodes) || null); } catch (e) { warn('progress failed', e); }
try { renderEpisodes(root, data); } catch (e) { warn('episodes failed', e); }
try { bindEpisodes(root); } catch (e) { warn('episodes bind failed', e); }
}





































var _fullOriginal = null;
var _fullWrapped = null;
var _peopleActive = false;

function mergePeople(data) {
if (!data || !data.persons) return data;
var persons = data.persons;
var cast = persons.cast;
var crew = persons.crew;


if (!cast || !cast.length || !crew || !crew.length) return data;

var role = '';
try {
if (window.Lampa && Lampa.Lang && typeof Lampa.Lang.translate === 'function') role = Lampa.Lang.translate('title_producer');
} catch (e) { }

var directors = [];
var rest = [];
for (var i = 0; i < crew.length; i++) {
var member = crew[i];
if (member && member.job === 'Director') directors.push(member);
else rest.push(member);
}
if (!directors.length) return data;

var head = [];
for (var j = 0; j < directors.length; j++) {
var one = directors[j];
var copy = {};
for (var key in one) {
if (Object.prototype.hasOwnProperty.call(one, key)) copy[key] = one[key];
}
copy.character = role || copy.job || '';
head.push(copy);
}

persons.crew = rest;
persons.cast = head.concat(cast);
return data;
}



function installPeople() {
_peopleActive = true;
if (_fullWrapped) return;
try {
if (!window.Lampa || !Lampa.Api || typeof Lampa.Api.full !== 'function') return;
} catch (e) { return; }
_fullOriginal = Lampa.Api.full;
_fullWrapped = function (object, oncomplite, onerror) {
if (!_peopleActive) return _fullOriginal(object, oncomplite, onerror);
return _fullOriginal(object, function (data) {
try {
mergePeople(data);
} catch (e) {
warn('people merge failed', e);
}
oncomplite(data);
}, onerror);
};
try {
Lampa.Api.full = _fullWrapped;
} catch (eSet) {
_fullWrapped = null;
_fullOriginal = null;
}
}




function uninstallPeople() {
_peopleActive = false;
if (!_fullWrapped) return;
try {
if (window.Lampa && Lampa.Api && Lampa.Api.full === _fullWrapped) {
Lampa.Api.full = _fullOriginal;
_fullWrapped = null;
_fullOriginal = null;
}
} catch (e) { }
}

LC.header = {
decorate: decorate,
applyLogoPref: applyLogoPref,
mergePeople: mergePeople,
installPeople: installPeople,
uninstallPeople: uninstallPeople,
descr: renderDescrRow,
refreshEpisode: refreshEpisode,
bindStart: bindStart,
bindDescr: bindDescr,
refreshProgress: refreshProgress,
scheduleProgressRefresh: scheduleProgressRefresh
};


/* ---- 90_runtime.js ---- */




function findRoot(e) {
var root = null;
try {
if (e.item && typeof e.item.render === 'function') {
var html = e.item.render();
if (html && html.hasClass && html.hasClass('full-start-new')) root = html;
}
} catch (err) { }
if ((!root || !root.length) && e.body && e.body.find) {
try { root = e.body.find('.full-start-new.lumen-card').eq(0); } catch (err2) { }
}
return root;
}








function findDescrRow(e) {
try {
if (e.item && typeof e.item.render === 'function') {
var html = e.item.render();
if (html && html.length) return html;
}
} catch (err) { }
if (e.body && e.body.find) {
try {
var found = e.body.find('.full-descr');
if (found && found.length) {




var line = found.closest('.items-line');
return line && line.length ? line : found.parent();
}
} catch (err2) { }
}
return null;
}












































var META_STASH = 'lumen_metadata';

function dropMetaData(e) {
try {
if (!LC.pref('lumen_hide_meta', false)) return false;
if (!e || !e.data || !e.data.metadata) return false;
e.data[META_STASH] = e.data.metadata;
e.data.metadata = null;
return true;
} catch (err) {
warn('meta drop failed', err);
return false;
}
}

function restoreMetaData(e) {
try {
if (!e || !e.data || !e.data[META_STASH]) return false;
e.data.metadata = e.data[META_STASH];
e.data[META_STASH] = null;
return true;
} catch (err) {
warn('meta restore failed', err);
return false;
}
}





function isWideLayout() {
var width = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
if (width && width <= 480) return false;
var tv = false;
try {
if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.screen === 'function') tv = !!Lampa.Platform.screen('tv');
} catch (e) { }
return tv || width > 480;
}





var MOTION_CLASSES = 'lumen-motion-full lumen-motion-lite lumen-motion-off';



function activeCardRoot() {
try { return $(LC.util.ON_SCREEN_SEL + ' .lumen-card'); } catch (e) { return null; }
}











function activeBackdropLayer() {
try { return $(LC.util.ON_SCREEN_SEL + ' .lumen-backdrop'); } catch (e) { return null; }
}

function applyMotionMode(root) {
if (!root || !root.length) return;
try {
root.removeClass(MOTION_CLASSES).addClass('lumen-motion-' + LC.motionMode());
} catch (e) {
warn('motion mode failed', e);
}
}



function bodyRoot() {
try { return $('body'); } catch (e) { return null; }
}







function applyFxHeavy() {
var body = bodyRoot();
if (!body || !body.length) return;
try {
body.toggleClass('lumen-fx-heavy', !!(typeof LC.fxHeavy === 'function' && LC.fxHeavy()));
} catch (e) {
warn('fx heavy class failed', e);
}
}






var CARD_ON = 'lumen-card-on';
function markCardBody(on) {
var body = bodyRoot();
if (!body || !body.length) return;
try {
body.toggleClass(CARD_ON, !!on);
} catch (e) {
warn('card body mark failed', e);
}
}




LC.applyMotionMode = function () {
applyMotionMode(activeCardRoot());
applyMotionMode(activeBackdropLayer());
if (ui_active) {
applyMotionMode(bodyRoot());


applyFxHeavy();
}



try { applyMotionMode($(LC.util.ON_SCREEN_SEL + ' .lumen-hub')); } catch (eHub) {}
try { applyMotionMode($(LC.util.ON_SCREEN_SEL + ' .lumen-grid')); } catch (eGrid) {}




try { if (LC.hero && LC.hero.applyMotion) LC.hero.applyMotion(); } catch (eHero) {}






try { if (LC.applyFxPref) LC.applyFxPref(); } catch (eFx) {}
};

var toggle_followed = false;























var focus_on_card = false;




function followToggle() {
if (toggle_followed) return;
toggle_followed = true;
try {
if (!window.Lampa || !Lampa.Controller || !Lampa.Controller.listener) return;
Lampa.Controller.listener.follow('toggle', function (e) {
try {
if (!e || !e.name) return;



if (!activated) return;




if (LC.hero && typeof LC.hero.onToggle === 'function') LC.hero.onToggle();



if (LC.homeRow && typeof LC.homeRow.onToggle === 'function') LC.homeRow.onToggle(e.name);
var root = activeCardRoot();
if (!root || !root.length) return;
if (e.name === 'full_descr' || e.name === 'items_line') root.addClass('lumen-compact');
else if (e.name === 'full_start') root.removeClass('lumen-compact');




if (e.name === 'full_start') focus_on_card = true;
else if (focus_on_card && e.name !== 'content') {
focus_on_card = false;
LC.trailer.stopActive();
}
} catch (err) {
warn('controller toggle failed', err);
}
});
} catch (e2) {
warn('controller listener failed', e2);
}
}

var timeline_followed = false;





LC.followTimeline = function () {
if (timeline_followed) return;
timeline_followed = true;
try {
if (!window.Lampa || !Lampa.Timeline || !Lampa.Timeline.listener) return;
Lampa.Timeline.listener.follow('update', function (e) {
try {



if (!activated) return;
if (e && e.data) LC.header.refreshEpisode(e.data.hash);






LC.header.scheduleProgressRefresh();
} catch (err) {
warn('timeline listener failed', err);
}
});
} catch (e2) {
warn('timeline listener failed', e2);
}
};












LC.active = null;

var activity_followed = false;















function layerOf(object) {
try {
if (!object || !object.activity || typeof object.activity.render !== 'function') return null;
var rendered = object.activity.render();
return rendered && rendered.find ? rendered.find('.lumen-backdrop') : null;
} catch (e) {
return null;
}
}



















function liveSlideshow(layer, s) {
if (!layer || !layer.length) return s;
var dead = !s || (typeof s.isAlive === 'function' && !s.isAlive());
if (!dead) return s;
return LC.backdrops.revive(layer) || s;
}


































function reapplyFx(active) {
try {
if (active) LC.applyFxFor(active.body, (active.data && active.data.movie) || null);
} catch (eFx) {
warn('fx reapply failed', eFx);
}
}

LC.destroyActive = function () {
var active = LC.active;
if (!active) return;
LC.active = null;
try {
LC.backdrops.cancel(active.body);
} catch (e) {
warn('destroy active: backdrop failed', e);
}
try {
LC.reviews.cancel(active.body);
} catch (e2) {
warn('destroy active: reviews failed', e2);
}


try {
LC.franchise.cancel(active.body);
} catch (eFr) {
warn('destroy active: franchise failed', eFr);
}




try {
var fxLayer = fxLayerOf(active.body);
if (fxLayer && LC.fx) LC.fx.unmount(fxLayer.find('.lumen-fx'));
} catch (eFxOff) {
warn('destroy active: fx failed', eFxOff);
}
try {
if (active.slideshow && typeof active.slideshow.destroy === 'function') active.slideshow.destroy();
} catch (e3) {
warn('destroy active: slideshow failed', e3);
}
try {
if (active.trailer && typeof active.trailer.destroy === 'function') active.trailer.destroy();
} catch (e4) {
warn('destroy active: trailer failed', e4);
}
};


















































LC.onActivityEvent = function (e) {
try {
if (!e) return;






if (!activated) return;












if (e.type === 'destroy' && e.component === 'main') {
try { if (LC.rows && LC.rows.bumpGen) LC.rows.bumpGen(); } catch (eBump) {}

try { if (LC.personal && LC.personal.bumpGen) LC.personal.bumpGen(); } catch (eBumpP) {}
}










if (e.type === 'start') {



try { if (LC.refreshPending) LC.refreshPending(e.component); } catch (eRefresh) {}
markCardBody(e.component === 'full');





try {
if (LC.transition) LC.transition.stop();
} catch (eTrans) {
warn('transition start failed', eTrans);
}
var startRender = null;
try {
if (e.object && e.object.activity && typeof e.object.activity.render === 'function') startRender = e.object.activity.render();
} catch (eRender) {}


var heroBack = false;
try {
if (LC.hero) {
heroBack = e.component === 'main' && typeof LC.hero.parked === 'function' && LC.hero.parked();
LC.hero.detach(startRender);
if (e.component === 'main' && startRender && startRender.length) LC.hero.mount(startRender);
}
} catch (eHeroStart) {
warn('hero start failed', eHeroStart);
}








try {
if (LC.moods) {
LC.moods.detach(startRender);
if (e.component === 'main' && startRender && startRender.length) LC.moods.mount(startRender);
}
} catch (eMoodsStart) {
warn('moods start failed', eMoodsStart);
}




try {
if (LC.badges) {
LC.badges.detach(startRender);
if (e.component === 'main' && startRender && startRender.length) LC.badges.mount(startRender);
}
} catch (eBadgesStart) {
warn('badges start failed', eBadgesStart);
}







try {
if (LC.nav && LC.nav.detach) LC.nav.detach();
} catch (eNavStart) {
warn('nav detach failed', eNavStart);
}













try {
if (LC.fx && LC.fx.sweep) LC.fx.sweep();
} catch (eFxSweep) {
warn('fx sweep failed', eFxSweep);
}






try {



if (LC.accent && e.component !== 'full') LC.accent.destroy();





if (heroBack && typeof LC.hero.accentBack === 'function') LC.hero.accentBack();
} catch (eAccentStart) {
warn('accent start failed', eAccentStart);
}
} else if (e.type === 'destroy') {





var deadRender = null;
try {
if (e.object && e.object.activity && typeof e.object.activity.render === 'function') deadRender = e.object.activity.render();
} catch (eDeadRender) {}
try {
if (LC.hero && LC.hero.active()) {
if (LC.hero.owns(deadRender)) LC.hero.unmount();
}
} catch (eHeroKill) {
warn('hero destroy failed', eHeroKill);
}


try {
if (LC.moods && LC.moods.active() && LC.moods.owns(deadRender)) LC.moods.unmount();
} catch (eMoodsKill) {
warn('moods destroy failed', eMoodsKill);
}


try {
if (LC.badges && LC.badges.active() && LC.badges.owns(deadRender)) LC.badges.unmount();
} catch (eBadgesKill) {
warn('badges destroy failed', eBadgesKill);
}
}

if (LC.active && e.object === LC.active.object) {
if (e.type === 'destroy') {




LC.destroyActive();
} else if (e.type === 'archive' || e.type === 'start') {





var ownLayer = layerOf(e.object);
LC.active.slideshow = liveSlideshow(ownLayer, LC.active.slideshow);





if (LC.active.slideshow && !LC.trailer.isLive(ownLayer)) LC.active.slideshow.resume();



if (ownLayer && ownLayer.length) LC.active.trailer = ownLayer.data('lumenTrailer') || null;




try { if (LC.applyAccentPref) LC.applyAccentPref(); } catch (eAccentOwn) {}





if (e.type === 'start') reapplyFx(LC.active);
}
return;
}

if (e.type === 'destroy') {
var orphanLayer = layerOf(e.object);
if (orphanLayer && orphanLayer.length) {







var orphanBody = orphanLayer.parent();





try {
LC.backdrops.cancel(orphanBody);
} catch (eBg) {
warn('destroy orphan: backdrop failed', eBg);
}
try {
LC.reviews.cancel(orphanBody);
} catch (eRv) {
warn('destroy orphan: reviews failed', eRv);
}
try {
LC.franchise.cancel(orphanBody);
} catch (eFrOrphan) {
warn('destroy orphan: franchise failed', eFrOrphan);
}







try {
if (LC.fx) LC.fx.unmount(orphanLayer.find('.lumen-fx'));
} catch (eFxOrphan) {
warn('destroy orphan: fx failed', eFxOrphan);
}
}
return;
}








if (e.type === 'start' && e.component === 'full') {
var layer = layerOf(e.object);
if (layer && layer.length) {





























if (LC.active && LC.active.object !== e.object) LC.destroyActive();
var slideshow = liveSlideshow(layer, layer.data('lumenSlideshow'));









LC.active = { object: e.object, body: layer.parent(), slideshow: slideshow, trailer: layer.data('lumenTrailer') || null, data: layer.data('lumenData') || null };



try { if (LC.applyAccentPref) LC.applyAccentPref(); } catch (eAccentBack) {}



reapplyFx(LC.active);




if (slideshow && !LC.trailer.isLive(layer)) slideshow.resume();
}
}
} catch (err) {
warn('activity listener failed', err);
}
};

function followActivityLifecycle() {
if (activity_followed) return;
activity_followed = true;
try {
if (!window.Lampa || !Lampa.Listener) return;
Lampa.Listener.follow('activity', LC.onActivityEvent);
} catch (e2) {
warn('activity listener failed', e2);
}
}

var full_followed = false;















function followFull() {
if (full_followed) return;
full_followed = true;
try {
if (!window.Lampa || !Lampa.Listener) return;
Lampa.Listener.follow('full', function (e) {
try {
if (!e || !activated) return;
if (e.type === 'start') {



dropMetaData(e);
} else if (e.type === 'build' && e.name === 'start') {
var startRoot = findRoot(e);
LC.header.decorate(startRoot, e.data);



LC.header.bindStart(e.item, startRoot);
} else if (e.type === 'build' && e.name === 'description') {




var descrRow = findDescrRow(e);
LC.header.descr(descrRow, e.data);
LC.reviews.render(descrRow, e.data);


LC.franchise.render(descrRow, e.data);




LC.header.bindDescr(e.item, descrRow, e.link);
} else if (e.type === 'complite') {


restoreMetaData(e);
var root = findRoot(e);
LC.header.decorate(root, e.data);





var doneRow = findDescrRow(e);
LC.header.descr(doneRow, e.data);
LC.reviews.render(doneRow, e.data);


LC.franchise.render(doneRow, e.data);
var slideshow = LC.backdrops.apply(root, e.body, (e.data && e.data.movie) || {});
applyMotionMode(root);




LC.active = { object: e.object, body: e.body, slideshow: slideshow, data: e.data };







try { if (LC.accent) LC.accent.applyFor((e.data && e.data.movie) || null, true); } catch (eAccent) {}



try { LC.applyFxFor(e.body, (e.data && e.data.movie) || null); } catch (eFx) { warn('fx apply failed', eFx); }









try {
var bgLayer = e.body && typeof e.body.children === 'function' ? e.body.children('.lumen-backdrop') : null;
if (bgLayer && bgLayer.length) bgLayer.data('lumenData', e.data);
} catch (eData) { warn('reviews data on layer failed', eData); }





focus_on_card = false;
LC.trailer.bind(root);








LC.trailer.reveal(root, e.data);
LC.active.trailer = LC.trailer.schedule(root, e.body, e.data);







LC.hub.franchise(root, (e.data && e.data.movie) || {});






try { if (LC.perf) LC.perf.track('card'); } catch (ePerf) {}
}
} catch (err) {
warn('listener failed', err);
}
});
} catch (e3) {
warn('full listener failed', e3);
}
}









LC.applySlideshowPref = function () {
try {
if (!LC.active || !LC.active.slideshow) return;
LC.active.slideshow.pause();




















var body = LC.active.body;
var layer = body && typeof body.children === 'function' ? body.children('.lumen-backdrop') : null;
if (LC.trailer.isLive(layer)) return;
if (LC.pref('lumen_slideshow', true)) LC.active.slideshow.resume();
} catch (e) {
warn('slideshow pref failed', e);
}
};





LC.applyTrailerPref = function () {
try {
if (LC.trailer.mode() === 'off') LC.trailer.stopActive();
} catch (e) {
warn('trailer pref failed', e);
}
};








LC.applyProgressPref = function () {
try {
LC.header.refreshProgress();
} catch (e) {
warn('progress pref failed', e);
}
};








LC.applyReviewsPref = function () {
try {
var row = $(LC.util.ON_SCREEN_SEL + ' .lumen-descr-row');
if (!row || !row.length) return;
if (!LC.pref('lumen_reviews', true)) { LC.reviews.clearRow(row); return; }
if (LC.active && LC.active.data) LC.reviews.render(row, LC.active.data);
} catch (e) {
warn('reviews pref failed', e);
}
};













LC.applyKpRate = function (rate, row) {
try {
var num = parseFloat(rate);
if (!num || num <= 0) return;
var chip = null;





if (row && row.length && typeof row.closest === 'function') {
var act = row.closest('.activity');
if (act && act.length && typeof act.find === 'function') chip = act.find('.lumen-card .rate--kp');
}




if (!chip && !row) chip = $(LC.util.ON_SCREEN_SEL + ' .lumen-card .rate--kp');
if (!chip || !chip.length || !chip.hasClass('hide')) return;
chip.children().eq(0).text(num > 10 ? 10 : num);
chip.removeClass('hide');
} catch (e) {
warn('kp rate failed', e);
}
};




var ui_active = false;

LC.applyMenusPref = function () {
if (!ui_active) return;
try {
LC.menus.mode(LC.pref('lumen_menus', 'all'));
} catch (e) {
warn('menus pref failed', e);
}
};




LC.applyTorrentsPref = function () {
if (!ui_active) return;
try {
if (LC.torrents && typeof LC.torrents.toggle === 'function') LC.torrents.toggle(LC.pref('lumen_torrents', true));
} catch (e) {
warn('torrents pref failed', e);
}
};





var original_template = '';



var our_template = '';



var activated = false;

function saveOriginalTemplate() {
try {
if (Lampa.Template && typeof Lampa.Template.all === 'function') {
var all = Lampa.Template.all();
if (all && all.full_start_new) {
original_template = all.full_start_new;
return;
}
}
} catch (e) { }
try {

original_template = Lampa.Template.get('full_start_new', {}, true) || '';
} catch (e2) {
warn('cannot save original template', e2);
}
}

function restoreOriginalTemplate() {
try {
if (original_template) Lampa.Template.add('full_start_new', original_template);
} catch (e) {
warn('cannot restore original template', e);
}
}
















var STRIP_NODES = ['.lumen-progress', '.lumen-episodes', '.lumen-facts', '.lumen-reviews', '.lumen-franchise', '.lumen-fr'];










function stripAllCards() {
var i, k, j;
for (i = 0; i < STRIP_NODES.length; i++) {
try {
$(STRIP_NODES[i]).remove();
} catch (e) {
warn('strip failed: ' + STRIP_NODES[i], e);
}
}
try {

















var rows = $('.lumen-descr-row');
for (i = 0; i < rows.length; i++) {
try {
LC.reviews.clearRow(rows.eq(i));
} catch (inner) {
warn('strip reviews row failed', inner);
}



try {
LC.franchise.clearRow(rows.eq(i));
} catch (innerFr) {
warn('strip franchise row failed', innerFr);
}
}
} catch (eRv) {
warn('strip reviews failed', eRv);
}
try {
$('.lumen-descr-row').removeClass('lumen-descr-row lumen-descr-row--reviews lumen-descr-row--franchise');
} catch (e1) {
warn('strip descr row failed', e1);
}
try {
var cards = $('.lumen-card');



cards.removeClass('lumen-continue lumen-compact lumen-card--franchise ' + MOTION_CLASSES);
for (j = 0; j < cards.length; j++) {
var node = cards[j];
if (node && node.style && typeof node.style.removeProperty === 'function') node.style.removeProperty('--lumen-play-label');
}
} catch (e2) {
warn('strip play label failed', e2);
}
try {




var layers = $('.lumen-backdrop');
for (k = 0; k < layers.length; k++) {
try {
LC.backdrops.cancel(layers.eq(k).parent());
} catch (inner) {
warn('strip backdrop failed', inner);
}
}
} catch (e3) {
warn('strip backdrops failed', e3);
}
LC.active = null;
}

function activate() {
if (activated) return;
activated = true;





try {
Lampa.Template.add('full_start_new', our_template);
} catch (eTpl) {
activated = false;
warn('template add failed', eTpl);
restoreOriginalTemplate();
return;
}
LC.injectFonts();
LC.injectCss();


try { if (LC.hud) LC.hud.sync(); } catch (eHudOn) {}
ui_active = true;
applyMotionMode(bodyRoot());

applyFxHeavy();
try {
LC.menus.mode(LC.pref('lumen_menus', 'all'));
LC.menus.install();
} catch (e4) {
warn('menus init failed', e4);
}
try {
if (LC.torrents && typeof LC.torrents.install === 'function') LC.torrents.install();
} catch (e5) {
warn('torrents init failed', e5);
}
LC.applyTorrentsPref();







try {
if (LC.homeplan && LC.homeplan.apply) LC.homeplan.apply({ start: true });
} catch (eHome) {
warn('home plan failed', eHome);
}



try {
if (LC.manifest && LC.manifest.load) {
LC.manifest.load(function (m) {
if (!activated) return;
try {
if (LC.homeplan && LC.homeplan.apply) LC.homeplan.apply({ manifest: m });
} catch (eHomeRows) {
warn('home plan failed', eHomeRows);
}


repairHomeRows();
});
}
} catch (eRows2) {
warn('rows register failed', eRows2);
}




try {
if (LC.rows && LC.rows.installDedupe) LC.rows.installDedupe();
} catch (eDedupe) {
warn('rows dedupe install failed', eDedupe);
}



try {
if (LC.header && LC.header.installPeople) LC.header.installPeople();
} catch (ePeople) {
warn('people merge install failed', ePeople);
}



try {
if (LC.hub && LC.hub.install) LC.hub.install();
} catch (eHub) {
warn('hub install failed', eHub);
}




try {
if (LC.hero && LC.hero.mountCurrent) LC.hero.mountCurrent();
} catch (eHero) {
warn('hero mount failed', eHero);
}



try {
if (LC.homeRow && LC.homeRow.install) LC.homeRow.install();
} catch (eHomeRow) {
warn('home row install failed', eHomeRow);
}


try {
if (LC.moods && LC.moods.install) LC.moods.install();
} catch (eMoods) {
warn('moods install failed', eMoods);
}


try {
if (LC.badges && LC.badges.install) LC.badges.install();
} catch (eBadges) {
warn('badges install failed', eBadges);
}



try {
if (LC.cardmenu && LC.cardmenu.install) LC.cardmenu.install();
} catch (eCardmenu) {
warn('cardmenu install failed', eCardmenu);
}



try {
if (LC.nav && LC.nav.apply) LC.nav.apply();
} catch (eNav) {
warn('nav install failed', eNav);
}



try {
if (LC.roulette && LC.roulette.install) LC.roulette.install();
} catch (eRoulette) {
warn('roulette install failed', eRoulette);
}



try {
if (LC.ambient && LC.ambient.apply) LC.ambient.apply();
} catch (eAmbient) {
warn('ambient install failed', eAmbient);
}
}

function deactivate() {
if (!activated) return;
activated = false;




try { if (LC.accent) LC.accent.destroy(); } catch (eAccentOff) {}



try { if (LC.perf) LC.perf.stop(); } catch (ePerfOff) {}


try { if (LC.hud) LC.hud.stop(); } catch (eHudOff) {}




try { if (LC.fx) LC.fx.unmountAll(); } catch (eFxOff) {}
try { if (LC.transition) LC.transition.stop(); } catch (eTransOff) {}


restoreOriginalTemplate();
ui_active = false;
LC.removeCss();


LC.injectFonts();
try {
if (LC.torrents && typeof LC.torrents.toggle === 'function') LC.torrents.toggle(false);
} catch (e) {
warn('torrents off failed', e);
}


try {
LC.menus.mode('off');
} catch (e2) {
warn('menus off failed', e2);
}
try {
var body = bodyRoot();



if (body && body.length) body.removeClass(MOTION_CLASSES).removeClass('lumen-fx-heavy').removeClass(CARD_ON);
} catch (e3) {
warn('motion class off failed', e3);
}
stripAllCards();


try { if (LC.homeplan && LC.homeplan.unregister) LC.homeplan.unregister(); } catch (eRows) {}


try { if (LC.rows && LC.rows.uninstallDedupe) LC.rows.uninstallDedupe(); } catch (eDedupeOff) {}


try { if (LC.header && LC.header.uninstallPeople) LC.header.uninstallPeople(); } catch (ePeopleOff) {}


home_repaired = false;

try { if (LC.hub && LC.hub.uninstall) LC.hub.uninstall(); } catch (eHubOff) {}


try { if (LC.hero && LC.hero.unmount) LC.hero.unmount(); } catch (eHeroOff) {}

try { if (LC.homeRow && LC.homeRow.uninstall) LC.homeRow.uninstall(); } catch (eHomeRowOff) {}

try { if (LC.moods && LC.moods.uninstall) LC.moods.uninstall(); } catch (eMoodsOff) {}

try { if (LC.badges && LC.badges.uninstall) LC.badges.uninstall(); } catch (eBadgesOff) {}


try { if (LC.cardmenu && LC.cardmenu.uninstall) LC.cardmenu.uninstall(); } catch (eCardmenuOff) {}


try { if (LC.nav && LC.nav.uninstall) LC.nav.uninstall(); } catch (eNavOff) {}

try { if (LC.roulette && LC.roulette.uninstall) LC.roulette.uninstall(); } catch (eRouletteOff) {}



try { if (LC.ambient && LC.ambient.uninstall) LC.ambient.uninstall(); } catch (eAmbientOff) {}
}


















var pending_refresh = null;

function activeComponentName() {
try {
if (!window.Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return null;
var act = Lampa.Activity.active();
return (act && act.component) || null;
} catch (e) {
return null;
}
}

function replaceSoon(component) {
setTimeout(function () {
try {
if (!activated) return;




if (layerOpen()) {
pending_refresh = component;
followSettingsClose();
return;
}
if (activeComponentName() !== component) return;
if (!Lampa.Activity || typeof Lampa.Activity.replace !== 'function') return;






var home = component === 'main' && LC.homeplan && typeof LC.homeplan.hold === 'function';
if (home) LC.homeplan.hold(true);
try {
Lampa.Activity.replace();
} finally {
if (home) LC.homeplan.hold(false);
}
} catch (e) {
warn('activity replace failed', e);
}
}, 0);
}






var settings_close_followed = false;




function settingsOpen() {
try {
var cur = window.Lampa && Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
var name = cur && cur.name;
return name === 'settings' || name === 'settings_component';
} catch (e) {
return false;
}
}









function layerOpen() {
try {
var body = bodyRoot();
if (body && body.length && typeof body.hasClass === 'function') {
if (body.hasClass('settings--open')) return true;
if (body.hasClass('selectbox--open')) return true;
}
} catch (eBody) {}
try {
if (window.Lampa && Lampa.Select && typeof Lampa.Select.opened === 'function' && Lampa.Select.opened()) return true;
} catch (eSelect) {}
try {
var modal = $('.modal');
if (modal && modal.length) return true;
} catch (eModal) {}
if (menuFocused()) return true;
return settingsOpen();
}






function menuFocused() {
try {
var cur = window.Lampa && Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
return !!(cur && cur.name === 'menu');
} catch (e) {
return false;
}
}




function followSettingsClose() {
if (settings_close_followed) return;
try {
if (!window.Lampa || !Lampa.Settings || !Lampa.Settings.listener || typeof Lampa.Settings.listener.follow !== 'function') return;
Lampa.Settings.listener.follow('close', function () {
try {
if (!pending_refresh) return;
var component = pending_refresh;
pending_refresh = null;
replaceSoon(component);
} catch (e) {
warn('settings close refresh failed', e);
}
});
settings_close_followed = true;
} catch (err) {
warn('settings close follow failed', err);
}
}





LC.refreshComponent = function (component) {
if (!activated || !component) return;
if (layerOpen()) {
pending_refresh = component;
followSettingsClose();
return;
}
if (activeComponentName() === component) {
pending_refresh = null;
replaceSoon(component);
return;
}
pending_refresh = component;
};



























var home_repaired = false;

function repairHomeRows() {
if (home_repaired) return;



home_repaired = true;
try {
if (!LC.rows || typeof LC.rows.served !== 'function') return;
if (LC.rows.served()) return;
if (activeComponentName() !== 'main') return;
LC.refreshComponent('main');
} catch (e) {
warn('home repair failed', e);
}
}



LC.refreshPending = function (component) {
if (!component || pending_refresh !== component) return;
pending_refresh = null;
replaceSoon(component);
};





LC.applyRowsPref = function () {
if (!activated) return;
try {
if (LC.manifest && LC.manifest.load) {
LC.manifest.load(function (m) {
if (!activated) return;
if (LC.homeplan && LC.homeplan.apply) LC.homeplan.apply({ manifest: m });


LC.refreshComponent('main');
});
}
} catch (e) {
warn('rows pref failed', e);
}
};


LC.applyMoodsPref = function () {
if (!activated) return;
try {
if (!LC.moods) return;
if (LC.pref('lumen_moods', true)) {
if (LC.moods.install) LC.moods.install();
if (LC.moods.mountCurrent) LC.moods.mountCurrent();
} else if (LC.moods.unmount) {
LC.moods.unmount();
}
} catch (e) {
warn('moods pref failed', e);
}
};



















LC.applyHeroSizePref = function () {
if (!activated) return;
try {
armRowBack();
LC.injectCss();
remountHero();
if (captionBadges()) remountBadges();
} catch (e) {
warn('hero size pref failed', e);
}
};






function armRowBack() {
try {
if (LC.homeRow && typeof LC.homeRow.arm === 'function') LC.homeRow.arm();
} catch (e) {
warn('home row arm failed', e);
}
}









function captionBadges() {
try { return LC.badgesMode() === 'caption'; } catch (e) { return false; }
}






function remountHero() {
if (LC.hero) {
if (LC.pref('lumen_hero_size', 'large') === 'off') {
if (LC.hero.unmount) LC.hero.unmount();
} else if (LC.hero.mountCurrent) {
LC.hero.mountCurrent();
}
}
if (LC.moods && LC.moods.mountCurrent) LC.moods.mountCurrent();
}


















LC.applyBadgesPref = function () {
if (!activated) return;
try {
remountBadges();
LC.injectCss();
} catch (e) {
warn('badges pref failed', e);
}
};









function remountBadges() {
if (!LC.badges) return;
LC.badges.uninstall();
if (LC.badgesMode() !== 'off') LC.badges.install();
redrawGridBadges();
}

function redrawGridBadges() {
try {
if (!LC.badges || typeof LC.badges.redraw !== 'function') return;
if (!window.Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return;
var act = Lampa.Activity.active();
if (!act || act.component !== 'lumen_grid') return;
if (!act.activity || typeof act.activity.render !== 'function') return;
LC.badges.redraw(act.activity.render());
} catch (e) {
warn('badges grid redraw failed', e);
}
}


















LC.applyPresetChanges = function (keys) {
if (!activated) return;
try {
if (!keys || !keys.length) return;
var changed = {};
for (var i = 0; i < keys.length; i++) changed[keys[i]] = true;
if (changed.lumen_hero_size) armRowBack();
if (changed.lumen_font) LC.injectFonts();
LC.injectCss();
if (changed.lumen_hero_size) remountHero();


if (changed.lumen_badges || (changed.lumen_hero_size && captionBadges())) remountBadges();





if (changed.lumen_accent_auto) {
try { if (LC.applyAccentPref) LC.applyAccentPref(); } catch (eAccent) { warn('preset accent failed', eAccent); }
}
} catch (e) {
warn('preset changes failed', e);
}
};













function fxLayerOf(body) {
if (!body || typeof body.children !== 'function') return null;
var layer = body.children('.lumen-backdrop');
if (!layer || !layer.length) return null;
return layer;
}




var CARD_FX_SAFE = { left: 0, top: 0.4, right: 0.57, bottom: 0.93, floor: 0.15, feather: 0.08 };

LC.applyFxFor = function (body, movie) {
var layer = fxLayerOf(body);
if (!layer) return null;
var node = layer.find('.lumen-fx');


try { if (LC.fx) LC.fx.unmount(node); } catch (eOff) { warn('fx unmount failed', eOff); }


if (!LC.themes || !LC.fx) return null;
try { layer.removeClass(LC.themes.classNames()); } catch (eCls) { warn('fx class failed', eCls); }

var theme = null;
try { theme = LC.themes.forMovie(movie || null); } catch (eTheme) { warn('fx theme failed', eTheme); }
if (!theme) {
try { if (LC.accent) LC.accent.setTheme(null); } catch (eAcc) {}
return null;
}
layer.addClass('lumen-theme--' + theme.id);


try { if (LC.accent) LC.accent.setTheme(theme.accent); } catch (eAcc2) {}
try {
return LC.fx.mount(node, theme.preset, {
color: LC.themes.particleColor(theme),





safe: CARD_FX_SAFE,


paused: function () {
try { return LC.trailer.isLive(layer); } catch (ePause) { return false; }
}
});
} catch (eMount) {
warn('fx mount failed', eMount);
return null;
}
};





LC.applyFxPref = function () {
if (!activated) return;
try {
if (!LC.active) {


if (LC.hero && typeof LC.hero.applyFx === 'function') LC.hero.applyFx();
return;
}
LC.applyFxFor(LC.active.body, (LC.active.data && LC.active.data.movie) || null);
} catch (e) {
warn('fx pref failed', e);
}
};




LC.applyCardmenuPref = function () {
if (!activated) return;
try {
if (!LC.cardmenu) return;
if (LC.pref('lumen_context_menu', true)) LC.cardmenu.install();
else LC.cardmenu.uninstall();
} catch (e) {
warn('cardmenu pref failed', e);
}
};




LC.applyNavPref = function () {
if (!activated) return;
try {
if (LC.nav && LC.nav.apply) LC.nav.apply();
} catch (e) {
warn('nav pref failed', e);
}
};





LC.applyAmbientPref = function () {
if (!activated) return;
try {
if (LC.ambient && LC.ambient.apply) LC.ambient.apply();
} catch (e) {
warn('ambient pref failed', e);
}
};





LC.applyKpHintPref = function () {
if (!activated) return;
if (activeComponentName() !== 'lumen_grid') return;
LC.refreshComponent('lumen_grid');
};




LC.applyPersonalPref = function () {
if (!activated) return;
try {
if (LC.homeplan && LC.homeplan.apply) LC.homeplan.apply();


LC.refreshComponent('main');
} catch (e) {
warn('personal pref failed', e);
}
};

LC.applyEnabledPref = function () {
try {


if (!our_template) return;
if (LC.enabled()) activate();
else deactivate();
} catch (e) {
warn('enabled pref failed', e);
}
};



















var inited = false;

LC.init = function () {
if (inited) return;
try {
if (!window.Lampa || !Lampa.Template || !Lampa.Listener) return;
inited = true;

try { if (Lampa.Lang && typeof Lampa.Lang.add === 'function') Lampa.Lang.add(LC.STRINGS); } catch (e) { }







LC.migratePrefs();

LC.addSettings();
LC.followStorage();

if (!isWideLayout()) return;

saveOriginalTemplate();




var tpl = LC.template.build(original_template);
var check = tpl ? LC.template.assert(original_template, tpl) : null;
if (!tpl || !check.ok) {
warn('template not supported' + (check ? ': missing ' + check.missingInOurs.join(', ') : ' (build failed)'));
try {
if (Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(LC.lang('lumen_card_unsupported'));
} catch (e3) { }
return;
}
our_template = tpl;

followFull();
followToggle();
followActivityLifecycle();
LC.followTimeline();




if (LC.enabled()) activate();
} catch (e) {






inited = false;
warn('init failed', e);
restoreOriginalTemplate();
}
};


LC.boot = function (attempt) {
attempt = attempt || 0;
if (typeof window.Lampa === 'undefined') {
if (attempt > 40) return;
setTimeout(function () { LC.boot(attempt + 1); }, 250);
return;
}
if (window.appready) LC.init();
else {
Lampa.Listener.follow('app', function (e) {
if (e.type === 'ready') LC.init();
});
}
};


/* ---- 99_tail.js ---- */
if (typeof window !== 'undefined') {
LC.boot(0);
}
})();
