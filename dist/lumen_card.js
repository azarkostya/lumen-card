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













function baseEm() {
var w = 0;
var k = 1;
try {
w = Number(window.innerWidth) || 0;
} catch (e) { }
try {
if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') {
var size = Lampa.Storage.field('interface_size');
if (LAMPA_SIZES[size]) k = LAMPA_SIZES[size];
}
} catch (e2) { }
var px = w / 84.17 * k;
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









function vhPx(vh) {
var h = 0;
try {
h = Number(window.innerHeight) || 0;
} catch (e) { }
return Math.round(h * (Number(vh) || 0) / 100 * dprCapped());
}





var POSTERS = [185, 342, 500, 780];



function posterSize(px) {
var need = (Number(px) || 0) * FIT;
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

return {
esc: esc,
pad2: pad2,
plural: plural,
initials: initials,
fmtTime: fmtTime,
fmtRuntime: fmtRuntime,
daysUntil: daysUntil,
screenPx: screenPx,
baseEm: baseEm,
emPx: emPx,
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
smoke: '#7A6A5A',
good: '#8FBF7A',
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
text: C.text, muted: C.muted, smoke: C.smoke,
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
text: '#F2F2F3', muted: '#A7A6A8', smoke: '#7B7A7D',
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
p.textRgb = hexToRgb(p.text);
p.panelRgb = hexToRgb(p.panel);












p.chipBg = solid ? p.panel : 'rgba(' + p.textRgb + ',.12)';
p.buttonBg = solid ? p.panelHi : 'rgba(' + p.textRgb + ',.12)';



p.plate = solid ? p.bg : 'rgba(' + p.bgRgb + ',.85)';











p.glass = solid ? p.bg : 'rgba(' + p.bgRgb + ',.9)';
return p;
}


























function accentRules(P, t) {
return {
main: '.lumen-main{background-color:' + P.bg + '}',










veilL: '.lumen-hero .lumen-hero__veil--l{background:-webkit-linear-gradient(left,rgba(' + P.bgRgb + ',.85) 0%,rgba(' + P.bgRgb + ',.45) 30%,rgba(' + P.bgRgb + ',0) 65%);background:linear-gradient(90deg,rgba(' + P.bgRgb + ',.85) 0%,rgba(' + P.bgRgb + ',.45) 30%,rgba(' + P.bgRgb + ',0) 65%)}',
veilB: '.lumen-hero .lumen-hero__veil--b{background:-webkit-linear-gradient(bottom,' + P.bg + ' 0%,rgba(' + P.bgRgb + ',.92) 10%,rgba(' + P.bgRgb + ',.6) 24%,rgba(' + P.bgRgb + ',.25) 42%,rgba(' + P.bgRgb + ',0) 62%);background:linear-gradient(0deg,' + P.bg + ' 0%,rgba(' + P.bgRgb + ',.92) 10%,rgba(' + P.bgRgb + ',.6) 24%,rgba(' + P.bgRgb + ',.25) 42%,rgba(' + P.bgRgb + ',0) 62%)}',






fadeTop: '.lumen-main .scroll.layer--wheight:after{background:-webkit-linear-gradient(top,' + P.bg + ' 0,' + P.bg + ' 2em,rgba(' + P.bgRgb + ',0) 2.5em);background:linear-gradient(to bottom,' + P.bg + ' 0,' + P.bg + ' 2em,rgba(' + P.bgRgb + ',0) 2.5em)}',
fadeBot: '.lumen-main:after{background:-webkit-linear-gradient(bottom,' + P.bg + ' 0,rgba(' + P.bgRgb + ',0) 100%);background:linear-gradient(0deg,' + P.bg + ' 0,rgba(' + P.bgRgb + ',0) 100%)}',





















cardFocus: '.lumen-main .card.focus .card__view{-webkit-box-shadow:0 .2em 0 ' + t.glow + ';box-shadow:0 .2em 0 ' + t.glow + '}'
};
}








LC.accentCss = function () {
var R = accentRules(palette(), theme());
return R.main + '\n' + R.veilL + '\n' + R.veilB + '\n' + R.fadeTop + '\n' + R.fadeBot + '\n' + R.cardFocus;
};










var SCALES = { small: 0.9, normal: 1, large: 1.1, huge: 1.2 };
var SCALE_DEFAULT = 'normal';




function round2(value) {
return Math.round(value * 100) / 100;
}



































var ROW_CARD_W = 9.52;



var ROW_CARD_NARROW = 8.07;


var POSTER_RATIO = 1.5;










var ROW_HEAD_GAP = 1.5;
var CARD_VIEW_GAP = 0.5;
var CARD_TITLE_LH = 1.15;
var CARD_AGE_GAP = 0.25;
var LAMPA_MORE_EM = 1.8;




var ROW_EDGE_AIR = 0.7;
var LAMPA_ROW_PAD = 2.5;
var LAMPA_HEAD = 4;


















var HERO_VH = { large: 66.67, medium: 56, compact: 45 };
var ROWS_TOP_VH = { large: 50, medium: 42, compact: 34 };
var HERO_DEFAULT = 'large';































var ROWS_SHIFT_VH = 5.5;





var ROWS_AIR = 1.5;







var TEXT_AIR_VH = 1.33;
var TEXT_EDGE_VH = 3.4;



var CHIP_BOX = 2.99;
var CHIP_ZOOM = 0.88;
var MOODS_H = round2(CHIP_BOX * CHIP_ZOOM);
var MOODS_GAP = 0.8;



var MOODS_BAR = round2(MOODS_H + MOODS_GAP);



var MOODS_IN_GAP = 0.9;

















var HERO_HEAD_SAFE = 4.4;
var TEXT_META = 1.06;











var TEXT_LOGO = 5.6;
var TEXT_DESCR = 4.05;










var TEXT_STATUS = 1.98;
var TEXT_ZOOM = 1.1;








var MOODS_IN_EM = round2((MOODS_IN_GAP + MOODS_H) * TEXT_ZOOM);


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







function textNeedEm(withDescr) {
var inner = TEXT_STATUS + TEXT_LOGO + (heroSmallText() ? 0 : TEXT_META);
if (withDescr) inner += TEXT_DESCR;
return round2(HERO_HEAD_SAFE + MOODS_IN_EM + inner * TEXT_ZOOM);
}





function textRatio(key, needEm) {
return Math.round(84.17 * (HERO_VH[key] - textBottomVh(key)) / needEm);
}





function rowBlockEm(cardW, titleEm, gapEm, cardTitleEm, cardAgeEm) {
return Math.max(titleEm, LAMPA_MORE_EM) + gapEm + cardW * POSTER_RATIO +
CARD_VIEW_GAP + cardTitleEm * CARD_TITLE_LH + CARD_AGE_GAP * cardAgeEm + cardAgeEm;
}















function rowNarrowRatio(key, blockEm) {
return Math.floor(84.17 * (100 - ROWS_TOP_VH[key]) / (ROWS_AIR + blockEm + ROW_EDGE_AIR));
}




















var SCALE_ROOTS = '.lumen-card,.lumen-backdrop,.lumen-descr-row,.lumen-review-modal,.lumen-descr-modal,.lumen-hero .lumen-hero__text,.lumen-hub,.lumen-grid,.lumen-minimap,.lumen-jump,.lumen-ambient,.lumen-roulette';

function scaleFactor() {
return SCALES[LC.pref('lumen_scale', SCALE_DEFAULT)] || SCALES[SCALE_DEFAULT];
}











LC.uiScale = scaleFactor;




















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
bg: P.bg, panel: P.panel, line: P.line, text: P.text, muted: P.muted, smoke: P.smoke,
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


css.push('.lumen-backdrop{position:absolute;top:0;left:0;width:100%;height:100vh;z-index:-1;overflow:hidden;opacity:0;-webkit-transition:opacity .5s ease;transition:opacity .5s ease;pointer-events:none}');
css.push('.lumen-backdrop.loaded{opacity:1}');
css.push('.lumen-backdrop__img{position:absolute;top:0;left:0;right:0;bottom:0;background-position:72% 32%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover}');










css.push('.lumen-backdrop .lumen-bg__img{position:absolute;top:0;right:0;bottom:0;left:0;background-position:72% 32%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover;opacity:0;-webkit-transition:opacity 1.2s ease-in-out;transition:opacity 1.2s ease-in-out}');
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
css.push('.lumen-backdrop.lumen-theme--christmas .lumen-fx,.lumen-hero.lumen-theme--christmas .lumen-fx{background-image:' + garland + ';background-repeat:no-repeat;background-position:top center;background-size:100% 4em}');


css.push('.lumen-backdrop.lumen-theme--halloween .lumen-fx,.lumen-hero.lumen-theme--halloween .lumen-fx{background-image:linear-gradient(0deg,rgba(224,123,44,.20) 0%,rgba(224,123,44,.07) 14%,rgba(224,123,44,0) 34%)}');





css.push('.lumen-backdrop.lumen-trailer-live .lumen-backdrop__veil{opacity:.45}');
css.push('.lumen-backdrop__veil{position:absolute;top:0;left:0;right:0;bottom:0;-webkit-transition:opacity 1s ease;transition:opacity 1s ease}');
css.push('.lumen-backdrop__veil--l{background:linear-gradient(90deg,rgba(' + P.bgRgb + ',0.96) 0%,rgba(' + P.bgRgb + ',0.88) 30%,rgba(' + P.bgRgb + ',0.35) 58%,rgba(' + P.bgRgb + ',0) 82%)}');
css.push('.lumen-backdrop__veil--b{background:linear-gradient(0deg,rgba(' + P.bgRgb + ',0.98) 0%,rgba(' + P.bgRgb + ',0.60) 28%,rgba(' + P.bgRgb + ',0) 60%)}');
css.push('.lumen-backdrop__veil--t{background:linear-gradient(180deg,rgba(' + P.bgRgb + ',0.70) 0%,rgba(' + P.bgRgb + ',0) 22%)}');

css.push('.lumen-backdrop--proc0 .lumen-backdrop__img{background:radial-gradient(ellipse 56% 57% at 72% 58%,rgba(255,214,150,0.85) 0%,rgba(232,150,80,0.40) 28%,rgba(232,150,80,0) 70%),linear-gradient(180deg,#1A0D08 0%,#7A2E12 42%,#D9622B 60%,#E8B87A 78%,#3A2418 100%)}');
css.push('.lumen-backdrop--proc1 .lumen-backdrop__img{background:radial-gradient(ellipse 52% 52% at 74% 52%,rgba(238,214,120,0.78) 0%,rgba(200,170,70,0.35) 30%,rgba(200,170,70,0) 70%),linear-gradient(180deg,#0F1210 0%,#3A3E22 45%,#B99A3A 66%,#6E5A24 82%,#17140E 100%)}');
css.push('.lumen-backdrop--proc2 .lumen-backdrop__img{background:radial-gradient(ellipse 58% 55% at 68% 54%,rgba(190,214,236,0.70) 0%,rgba(120,150,190,0.32) 30%,rgba(120,150,190,0) 70%),linear-gradient(180deg,#07090E 0%,#1B2536 44%,#46617F 64%,#8FA6BC 80%,#181C22 100%)}');


























css.push('.lumen-backdrop.lumen-bg--blur{background:' + P.gradBlur + '}');
css.push('.lumen-backdrop.lumen-bg--blur .lumen-backdrop__img{background-position:50% 50%;opacity:.8}');
css.push('.lumen-backdrop.lumen-motion-full.lumen-bg--blur .lumen-backdrop__img{-webkit-transform:scale(1.1);transform:scale(1.1)}');
css.push('.full-start__background.lumen-off{display:none !important}');



css.push('.full-start-new.lumen-card{position:relative;padding:0 2.81em 2.81em;color:' + P.text + ';font-family:' + FB + '}');
css.push('.lumen-card .full-start-new__left{display:none !important}');








css.push('.lumen-card.lumen-card--poster .full-start-new__left{display:block !important;-webkit-box-ordinal-group:2;-webkit-order:1;order:1;-webkit-align-self:flex-start;-ms-flex-item-align:start;align-self:flex-start;-webkit-flex-shrink:0;flex-shrink:0;width:16.66em;margin:6.14em 0 0 2.63em}');
css.push('.lumen-card.lumen-card--poster .full-start-new__poster{border-radius:.61em;overflow:hidden;background:' + P.gradPoster + ';border:.04em solid ' + P.line + ';box-shadow:0 .35em .8em rgba(0,0,0,.6)}');
css.push('.lumen-card.lumen-card--poster .full-start-new__img{border-radius:.61em}');
css.push('.lumen-card.lumen-card--poster .lumen-poster-tmdb{position:absolute;left:0;right:0;bottom:0;padding:0 1.05em 1.05em;font-family:' + FB + ';font-weight:600;font-size:.88em;line-height:1.3;color:' + P.smoke + '}');
css.push('.lumen-card .full-start-new__body{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:end;-webkit-align-items:flex-end;align-items:flex-end;min-height:74vh}');
css.push('.lumen-card .full-start-new__right{-webkit-box-flex:1;-webkit-flex-grow:1;flex-grow:1;min-width:0}');












css.push('.lumen-card .lumen-content{display:block}');
css.push('.lumen-card .lumen-content > .lumen-in{max-width:52em}');


css.push('.lumen-card .full-start-new__tagline,.lumen-card .full-start-new__reactions,.lumen-card .lumen-keep{display:none !important}');
css.push('.lumen-card.lumen--meta .full-start-new__head,.lumen-card.lumen--meta .full-start-new__details{display:none !important}');
css.push('.lumen-card .full-start__pg{display:none !important}');





css.push('.lumen-card .lumen-meta{font-family:' + FB + ';font-size:.88em;color:' + P.muted + ';letter-spacing:.03em;line-height:1.3;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
css.push('.lumen-card .lumen-meta > *{margin:0 .53em .2em 0}');
css.push('.lumen-card .lumen-meta__sep{color:' + P.line + '}');











css.push('.lumen-card .full-start-new__title{font-family:' + FB + ';font-size:3.2em;font-weight:700;line-height:1.02;letter-spacing:-.02em;margin:.70em 0 0 -.02em}');


css.push('.lumen-card .full-start-new__title.lumen-title--long{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:2;line-clamp:2}');












css.push('.lumen-card .full-start-new__rate-line{margin:1.05em 0 0;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:stretch;-webkit-align-items:stretch;align-items:stretch;-webkit-flex-wrap:wrap;flex-wrap:wrap}');




css.push('.lumen-card .full-start-new__rate-line > *{margin:0 .53em .53em 0 !important}');
css.push('.lumen-card .full-start__rate{font-family:' + FB + ';background:' + P.chipBg + ';border-radius:.53em;padding:.44em .70em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
css.push('.lumen-card .full-start__rate > div:first-child{display:block;width:auto;height:auto;background:transparent;border-radius:0;font-size:1.23em;font-weight:600;line-height:1;color:' + P.text + '}');
css.push('.lumen-card .full-start__rate > div:last-child{font-size:.61em;letter-spacing:.1em;color:' + P.smoke + ';padding:.18em 0 0}');





css.push('.lumen-card .lumen-reactions-chip{font-family:' + FB + ';background:rgba(' + SPICE_RGB + ',.16);border-radius:.53em;padding:.44em .70em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
css.push('.lumen-card .lumen-reactions-chip__value{font-size:1.23em;font-weight:600;line-height:1;color:' + P.spice + '}');
css.push('.lumen-card .lumen-reactions-chip__label{font-size:.61em;letter-spacing:.1em;opacity:.8;color:' + P.spice + ';padding:.18em 0 0}');





css.push('.lumen-card .full-start-new__rate-line .tag--episode{display:none !important}');






css.push('.lumen-card .full-start-new__rate-line .full-start__status{display:none}');
css.push('.lumen-card .lumen-next-chip{font-family:' + FB + ';font-weight:500;font-size:.79em;line-height:1;color:' + P.text + ';background:' + P.chipBg + ';border-radius:.67em;padding:0 .89em;white-space:nowrap;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card .lumen-next-chip:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.22em;height:1.22em;margin-right:.56em;background-color:' + P.muted + ';-webkit-mask-image:' + LC.icons.maskUrl('clock') + ';mask-image:' + LC.icons.maskUrl('clock') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain}');



css.push('.lumen-card.lumen-card--serial .full-start-new__rate-line .full-start__status{font-family:' + FB + ';font-weight:500;font-size:.79em;line-height:1;letter-spacing:normal;text-transform:none;color:' + P.text + ';background:' + P.chipBg + ';border:0;border-radius:.67em;padding:0 .89em;white-space:nowrap;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card.lumen-card--serial .full-start-new__rate-line .full-start__status:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:.56em;height:.56em;border-radius:50%;background:currentColor;margin-right:.56em}');










css.push('.lumen-card .lumen-progress{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center;width:33.32em;max-width:100%;margin-top:1.05em;font-family:' + FB + ';font-size:1em;color:' + P.muted + ';letter-spacing:.04em}');
css.push('.lumen-card .lumen-progress__label{font-size:.79em;line-height:1;color:' + P.muted + '}');
css.push('.lumen-card .lumen-progress__time{font-size:.79em;line-height:1;color:' + P.muted + ';margin-left:.35em}');
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







css.push('.lumen-card .lumen-trailer-badge{display:none;position:absolute;top:4.91em;right:2.81em;z-index:6;font-family:' + FB + ';font-size:.79em;line-height:1;letter-spacing:.06em;color:' + P.text + ';background:' + P.glass + ';border:.05em solid rgba(' + P.textRgb + ',.2);border-radius:1.67em;padding:.56em 1em;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card.lumen-trailer-on .lumen-trailer-badge{display:-webkit-box;display:-webkit-flex;display:flex}');
css.push('.lumen-card .lumen-trailer-badge:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.22em;height:1.22em;margin-right:.67em;background-color:' + A + ';-webkit-mask-image:' + LC.icons.maskUrl('mute') + ';mask-image:' + LC.icons.maskUrl('mute') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');




css.push('.lumen-card.lumen-trailer-on .full-start-new__title{font-size:1.84em;opacity:.92}');


css.push('.lumen-card.lumen-trailer-on .full-start-new__rate-line,.lumen-card.lumen-trailer-on .lumen-episodes,.lumen-card.lumen-trailer-on .lumen-progress{display:none !important}');
css.push('.lumen-card.lumen-trailer-on .lumen-actions{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');



css.push('.lumen-card .lumen-status--good:before{color:' + P.good + '}');
css.push('.lumen-card .lumen-status--accent:before{color:' + A + '}');
css.push('.lumen-card .lumen-status--muted:before,.lumen-card .lumen-status--soon:before{color:' + P.smoke + '}');







css.push('.lumen-card .full-start-new__rate-line .lumen-tags{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card .lumen-tags .full-start__tag{display:none !important}');


css.push('.lumen-card .lumen-quality-chip{font-family:' + FB + ';font-weight:600;font-size:.66em;letter-spacing:.08em;color:' + P.text + ';background:' + P.chipBg + ';border-radius:.31em;padding:.31em .48em;margin:0 .35em .35em 0;white-space:nowrap}');







css.push('.lumen-card .lumen-episodes{margin-top:1.75em}');
css.push('.lumen-card .lumen-episodes__head{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline;margin-bottom:.79em}');
css.push('.lumen-card .lumen-episodes__title{font-family:' + FB + ';font-weight:700;font-size:1.23em;line-height:1;color:' + P.text + ';margin-right:.5em}');
css.push('.lumen-card .lumen-episodes__count{font-family:' + FB + ';font-size:.70em;line-height:1;letter-spacing:.12em;text-transform:uppercase;color:' + P.smoke + '}');
css.push('.lumen-card .lumen-episodes__viewport{position:relative;height:6.58em}');
css.push('.lumen-card .lumen-episodes__track{position:absolute;top:0;left:0;height:100%;display:-webkit-box;display:-webkit-flex;display:flex}');
css.push('.lumen-card .lumen-episode{position:relative;-webkit-box-sizing:border-box;box-sizing:border-box;width:14.9em;height:6.58em;margin-right:.70em;-webkit-box-flex:0;-webkit-flex:none;flex:none;border-radius:.61em;padding:.79em;overflow:hidden;background:' + P.gradSlate + ';border:.04em solid ' + P.line + ';color:' + P.text + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between}');
css.push('.lumen-card .lumen-episode__still{position:absolute;top:0;right:0;bottom:0;left:0;background-position:50% 50%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover;opacity:.28}');
css.push('.lumen-card .lumen-episode__top{position:relative;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between;-webkit-box-align:center;-webkit-align-items:center;align-items:center;min-height:1.40em}');
css.push('.lumen-card .lumen-episode__num{font-family:' + FB + ';font-weight:600;font-size:.75em;line-height:1;letter-spacing:.1em;color:' + P.smoke + '}');
css.push('.lumen-card .lumen-episode__check{width:.88em;height:.88em;background-color:' + P.good + ';-webkit-mask-image:' + LC.icons.maskUrl('check') + ';mask-image:' + LC.icons.maskUrl('check') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain}');
css.push('.lumen-card .lumen-episode__percent{font-family:' + FB + ';font-size:.66em;line-height:1;color:' + A + '}');
css.push('.lumen-card .lumen-episode__play{display:none;position:relative;width:1.40em;height:1.40em;border-radius:50%;background:' + A + '}');
css.push('.lumen-card .lumen-episode__play:before{content:"";position:absolute;top:50%;left:50%;width:.75em;height:.75em;margin:-.375em 0 0 -.33em;background-color:' + P.dark + ';-webkit-mask-image:' + LC.icons.maskUrl('play') + ';mask-image:' + LC.icons.maskUrl('play') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain}');
css.push('.lumen-card .lumen-episode__bottom{position:relative;min-width:0}');
css.push('.lumen-card .lumen-episode__name{font-family:' + FB + ';font-weight:500;font-size:.96em;line-height:1.2;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
css.push('.lumen-card .lumen-episode__caption{font-family:' + FB + ';font-size:.70em;line-height:1;color:' + P.smoke + ';margin-top:.44em;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
css.push('.lumen-card .lumen-episode__bar{height:.18em;border-radius:.09em;background:rgba(' + P.textRgb + ',.16);margin-top:.44em;overflow:hidden}');
css.push('.lumen-card .lumen-episode__bar > div{height:100%;border-radius:.09em;background:' + A + '}');


css.push('.lumen-card .lumen-episode--watched{opacity:.6}');
css.push('.lumen-card .lumen-episode--watching{background:' + P.gradWatching + ';border-color:#303552}');
css.push('.lumen-card .lumen-episode--watching .lumen-episode__num{color:' + A + '}');
css.push('.lumen-card .lumen-episode--watching .lumen-episode__caption{color:' + P.muted + '}');
css.push('.lumen-card .lumen-episode--soon{background:rgba(' + P.panelRgb + ',.35);border:.07em dashed ' + P.line + '}');
css.push('.lumen-card .lumen-episode--soon .lumen-episode__name{color:' + P.smoke + '}');
















css.push('.lumen-card .lumen-episode.focus{opacity:1;background:' + P.text + ';color:' + P.bg + ';border:.13em solid ' + P.text + ';padding:.70em;-webkit-transform:scale(1.03);transform:scale(1.03);-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__still{opacity:.12}');








css.push('.lumen-card .lumen-episode.focus .lumen-episode__num,.lumen-card .lumen-episode.focus .lumen-episode__name,.lumen-card .lumen-episode.focus .lumen-episode__caption,.lumen-card .lumen-episode.focus .lumen-episode__state,.lumen-card .lumen-episode.focus .lumen-episode__timecode{color:' + P.bg + '}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__bar{background:rgba(' + P.bgRgb + ',.2)}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__bar > div{background:' + P.bg + '}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__play{display:block;background:' + P.bg + '}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__play:before{background-color:' + P.text + '}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__check,.lumen-card .lumen-episode.focus .lumen-episode__percent{display:none}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__name{font-weight:600}');








css.push('.lumen-card .lumen-episode__state{display:none;font-family:' + FB + ';font-weight:600;font-size:.75em;line-height:1;letter-spacing:.1em;text-transform:uppercase;color:' + A + ';margin:0 auto 0 .35em}');
css.push('.lumen-card .lumen-episode__timecode{display:none;font-family:' + FB + ';font-size:.70em;line-height:1;color:' + P.muted + ';margin-top:.44em;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
css.push('.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__state,.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__timecode{display:block}');
css.push('.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__caption{display:none}');

css.push(LC.icons.NO_MASK + '{.lumen-card .lumen-next-chip:before,.lumen-card .lumen-episode__check,.lumen-card .lumen-episode__play:before{display:none}}');





































css.push('.lumen-descr-row > .items-line__head{display:none}');





















css.push('.lumen-descr-row .full-descr{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:start;-webkit-align-items:flex-start;align-items:flex-start;-webkit-flex-wrap:wrap;flex-wrap:wrap;padding-left:2.81em;padding-right:2.81em}');









css.push('.lumen-descr-row .full-descr__left{-webkit-box-flex:1;-webkit-flex:1 1 42.96em;flex:1 1 42.96em;max-width:42.96em;min-width:0;margin-right:3.51em}');























css.push('.lumen-descr-row .full-descr__text{-webkit-box-sizing:border-box;box-sizing:border-box;font-family:' + FB + ';font-weight:400;font-size:1.05em;line-height:1.45;color:' + P.text + ';max-width:42.96em;width:auto;max-height:70vh;padding:.75em 1em;border-radius:.58em;background:' + P.plate + ';-webkit-mask-image:none;mask-image:none}');
css.push('.lumen-descr-row .full-descr__details{display:none}');





















css.push('.lumen-descr-row .lumen-facts{-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-box-flex:1;-webkit-flex:1 1 19.73em;flex:1 1 19.73em;min-width:19.73em;max-width:100%;padding:.79em 1.05em;border-radius:.61em;background:' + P.plate + ';border:.04em solid ' + P.line + '}');

css.push('.lumen-descr-row .lumen-facts__title{font-family:' + FB + ';font-weight:600;font-size:.79em;line-height:1;letter-spacing:.14em;color:' + P.muted + ';margin-bottom:.79em}');












css.push('.lumen-descr-row .lumen-facts__grid{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;display:grid;grid-template-columns:auto 1fr;grid-row-gap:.35em;grid-column-gap:1.05em;row-gap:.35em;column-gap:1.05em}');






css.push('.lumen-descr-row .lumen-facts__label{font-family:' + FB + ';font-weight:400;font-size:.88em;line-height:1.3;color:' + P.muted + ';white-space:nowrap}');
css.push('.lumen-descr-row .lumen-facts__value{font-family:' + FB + ';font-weight:500;font-size:.88em;line-height:1.3;color:' + P.text + ';min-width:0;word-wrap:break-word;overflow-wrap:break-word}');




css.push('@supports not (display:grid){.lumen-descr-row .lumen-facts__label{width:6.3em;margin:0 1.2em .5em 0}.lumen-descr-row .lumen-facts__value{-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;min-width:0;margin-bottom:.5em}}');








css.push('.lumen-descr-row .lumen-reviews{width:100%;-webkit-flex-basis:100%;flex-basis:100%;margin-top:1.75em}');













css.push('.lumen-descr-row.lumen-descr-row--reviews .full-descr__text{display:-webkit-box;-webkit-line-clamp:8;-webkit-box-orient:vertical;overflow:hidden;max-height:70vh;-webkit-mask-image:-webkit-linear-gradient(top,#000 86%,rgba(0,0,0,0) 100%);-webkit-mask-image:linear-gradient(180deg,#000 86%,rgba(0,0,0,0) 100%);mask-image:linear-gradient(180deg,#000 86%,rgba(0,0,0,0) 100%)}');






css.push('.lumen-descr-row .lumen-descr-more{display:none}');
css.push('.lumen-descr-row.lumen-descr-row--reviews .lumen-descr-more{display:block;font-family:' + FB + ';font-weight:500;font-size:.88em;line-height:1.3;color:' + P.muted + ';margin:.44em 0 0 1em}');






css.push('.lumen-descr-row .lumen-reviews__head{display:-webkit-inline-box;display:-webkit-inline-flex;display:inline-flex;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-sizing:border-box;box-sizing:border-box;max-width:100%;margin:0 0 .79em -.7em;padding:.44em .7em;border-radius:.61em;background:' + P.plate + '}');


css.push('.lumen-descr-row .lumen-reviews__ico{width:1.05em;height:1.05em;-webkit-flex-shrink:0;flex-shrink:0;background-color:' + P.muted + ';-webkit-mask-image:' + LC.icons.maskUrl('comment') + ';mask-image:' + LC.icons.maskUrl('comment') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-right:.44em;-webkit-align-self:center;align-self:center}');
css.push('.lumen-descr-row .lumen-reviews__title{font-family:' + FB + ';font-weight:700;font-size:1.40em;line-height:1;color:' + P.text + ';margin-right:.61em}');

css.push('.lumen-descr-row .lumen-reviews__src{font-family:' + FB + ';font-weight:600;font-size:.70em;line-height:1;letter-spacing:.16em;color:' + A + ';margin-right:.61em}');




css.push('.lumen-descr-row .lumen-reviews__total{font-family:' + FB + ';font-weight:400;font-size:.88em;line-height:1;letter-spacing:.08em;color:' + P.muted + '}');



css.push('.lumen-descr-row .lumen-reviews__row{display:-webkit-box;display:-webkit-flex;display:flex;overflow:hidden;padding:.26em 0}');
css.push('.lumen-descr-row .lumen-review{position:relative;-webkit-box-sizing:border-box;box-sizing:border-box;width:21.04em;height:11.4em;-webkit-box-flex:0;-webkit-flex:none;flex:none;margin-right:.88em;border-radius:.61em;overflow:hidden;background:' + P.gradSlate + ';border:.04em solid ' + P.line + ';color:' + P.text + ';display:-webkit-box;display:-webkit-flex;display:flex}');


css.push('.lumen-descr-row .lumen-review__tone{width:.18em;-webkit-box-flex:0;-webkit-flex:none;flex:none;background:' + P.muted + '}');
css.push('.lumen-descr-row .lumen-review--good .lumen-review__tone{background:' + P.good + '}');
css.push('.lumen-descr-row .lumen-review--bad .lumen-review__tone{background:' + P.spice + '}');
css.push('.lumen-descr-row .lumen-review__body{-webkit-box-sizing:border-box;box-sizing:border-box;padding:.96em;min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column}');
css.push('.lumen-descr-row .lumen-review__top{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;margin-bottom:.53em}');


css.push('.lumen-descr-row .lumen-review__ava{-webkit-box-sizing:border-box;box-sizing:border-box;width:2.53em;height:2.53em;-webkit-box-flex:0;-webkit-flex:none;flex:none;border-radius:50%;background:' + P.panel + ';font-family:' + FB + ';font-weight:500;font-size:.83em;line-height:2.53em;text-align:center;color:' + P.muted + ';margin-right:.63em;overflow:hidden}');
css.push('.lumen-descr-row .lumen-review__who{min-width:0}');
css.push('.lumen-descr-row .lumen-review__author{font-family:' + FB + ';font-weight:600;font-size:.88em;line-height:1.1;color:' + P.text + ';margin-bottom:.25em;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;white-space:nowrap}');




css.push('.lumen-descr-row .lumen-review__meta{font-family:' + FB + ';font-weight:400;font-size:.66em;line-height:1.2;color:' + P.muted + '}');
css.push('.lumen-descr-row .lumen-review__meta > span{margin-right:.66em}');
css.push('.lumen-descr-row .lumen-review__tag{color:' + P.muted + '}');
css.push('.lumen-descr-row .lumen-review--good .lumen-review__tag{color:' + P.good + '}');
css.push('.lumen-descr-row .lumen-review--bad .lumen-review__tag{color:' + P.spice + '}');

css.push('.lumen-descr-row .lumen-review__likes:before{content:"";display:inline-block;vertical-align:-.1em;width:1em;height:1em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('star') + ';mask-image:' + LC.icons.maskUrl('star') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-right:.33em}');
css.push('.lumen-descr-row .lumen-review__title{font-family:' + FB + ';font-weight:600;font-size:1.05em;line-height:1.25;color:' + P.text + ';margin-bottom:.53em;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;white-space:nowrap}');



css.push('.lumen-descr-row .lumen-review__text{font-family:' + FB + ';font-weight:400;font-size:.83em;line-height:1.45;color:' + P.muted + ';display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}');
css.push('.lumen-descr-row .lumen-review.focus{border:.13em solid ' + A + ';-webkit-transform:scale(1.03);transform:scale(1.03);-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');
css.push('.lumen-descr-row .lumen-review.focus .lumen-review__title{white-space:normal}');



css.push('body.lumen-motion-full .lumen-descr-row .lumen-review{-webkit-transition:border-color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:border-color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('body.lumen-motion-lite .lumen-descr-row .lumen-review.focus,body.lumen-motion-off .lumen-descr-row .lumen-review.focus{-webkit-transform:none;transform:none}');


css.push('.lumen-descr-row .lumen-reviews__hint{-webkit-box-sizing:border-box;box-sizing:border-box;max-width:28.06em;border-radius:.61em;background:' + P.gradHint + ';border:.04em solid ' + P.line + ';padding:1.40em}');
css.push('.lumen-descr-row .lumen-reviews__hint-ico{width:2.10em;height:2.10em;background-color:' + A + ';-webkit-mask-image:' + LC.icons.maskUrl('comment') + ';mask-image:' + LC.icons.maskUrl('comment') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-bottom:.70em}');
css.push('.lumen-descr-row .lumen-reviews__hint-title{font-family:' + FB + ';font-weight:700;font-size:1.23em;line-height:1.15;color:' + P.text + ';margin-bottom:.44em}');
css.push('.lumen-descr-row .lumen-reviews__hint-text{font-family:' + FB + ';font-weight:400;font-size:.88em;line-height:1.4;color:' + P.muted + ';margin-bottom:.70em}');
css.push('.lumen-descr-row .lumen-reviews__hint-path{display:inline-block;padding:.61em .79em;border-radius:.53em;background:rgba(' + A_RGB + ',.1);border:.04em solid rgba(' + A_RGB + ',.4);font-family:' + FB + ';font-weight:500;font-size:.79em;line-height:1.3;color:' + A + '}');




css.push('.lumen-descr-row .lumen-reviews__hint-hide{display:inline-block;margin-left:.53em;padding:.61em .79em;border-radius:.53em;background:' + P.buttonBg + ';border:.04em solid ' + P.line + ';font-family:' + FB + ';font-weight:600;font-size:.79em;line-height:1.3;color:' + P.text + '}');

css.push('.lumen-descr-row .lumen-reviews__hint-hide.focus{background:' + P.text + ';color:' + P.bg + '}');






css.push('.lumen-review-modal{display:-webkit-box;display:-webkit-flex;display:flex;border-radius:.61em;overflow:hidden;background:' + P.gradPanel + ';border:.04em solid ' + P.line + ';color:' + P.text + '}');
css.push('.lumen-review-modal__tone{width:.18em;-webkit-box-flex:0;-webkit-flex:none;flex:none;background:' + P.muted + '}');
css.push('.lumen-review-modal--good .lumen-review-modal__tone{background:' + P.good + '}');
css.push('.lumen-review-modal--bad .lumen-review-modal__tone{background:' + P.spice + '}');
css.push('.lumen-review-modal__body{-webkit-box-sizing:border-box;box-sizing:border-box;padding:1.75em;min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto}');
css.push('.lumen-review-modal__top{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between}');

css.push('.lumen-review-modal__ava{-webkit-box-sizing:border-box;box-sizing:border-box;width:2.82em;height:2.82em;-webkit-box-flex:0;-webkit-flex:none;flex:none;border-radius:50%;background:' + P.bg + ';border:.05em solid ' + P.line + ';font-family:' + FB + ';font-weight:500;font-size:.96em;line-height:2.72em;text-align:center;color:' + P.muted + ';margin-right:.64em}');
css.push('.lumen-review-modal__who{min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto}');
css.push('.lumen-review-modal__author{font-family:' + FB + ';font-weight:600;font-size:1.14em;line-height:1.1;margin-bottom:.26em}');


css.push('.lumen-review-modal__meta{font-family:' + FB + ';font-weight:400;font-size:.70em;line-height:1.2;color:' + P.muted + '}');
css.push('.lumen-review-modal__meta > span{margin-right:.75em}');
css.push('.lumen-review-modal--good .lumen-review-modal__tag{color:' + P.good + '}');
css.push('.lumen-review-modal--bad .lumen-review-modal__tag{color:' + P.spice + '}');
css.push('.lumen-review-modal__likes:before{content:"";display:inline-block;vertical-align:-.1em;width:1em;height:1em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('star') + ';mask-image:' + LC.icons.maskUrl('star') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-right:.33em}');
css.push('.lumen-review-modal__src{font-family:' + FB + ';font-weight:600;font-size:.70em;line-height:1;letter-spacing:.16em;color:' + P.muted + ';-webkit-box-flex:0;-webkit-flex:none;flex:none;margin-left:.88em}');
css.push('.lumen-review-modal__line{height:.04em;background:' + P.line + ';margin:.88em 0}');
css.push('.lumen-review-modal__title{font-family:' + FB + ';font-weight:700;font-size:1.58em;line-height:1.18;margin-bottom:.88em}');


css.push('.lumen-review-modal__text{font-family:' + FB + ';font-weight:400;font-size:.96em;line-height:1.5;color:' + P.muted + ';max-height:50vh;overflow:auto}');





css.push('.lumen-descr-modal{-webkit-box-sizing:border-box;box-sizing:border-box;padding:1.75em;border-radius:.61em;background:' + P.gradPanel + ';border:.04em solid ' + P.line + ';color:' + P.text + '}');
css.push('.lumen-descr-modal__text{font-family:' + FB + ';font-weight:400;font-size:1.05em;line-height:1.45;color:' + P.text + '}');






css.push('.lumen-descr-row .lumen-reviews__mode{margin-left:auto;padding:.35em .61em;border-radius:.44em;background:' + P.buttonBg + ';border:.04em solid ' + P.line + ';font-family:' + FB + ';font-weight:600;font-size:.70em;line-height:1.2;color:' + P.muted + '}');
css.push('.lumen-descr-row .lumen-reviews__mode--on{color:' + A + ';border-color:rgba(' + A_RGB + ',.5)}');
















css.push('.lumen-descr-row .lumen-reviews__mode.focus{background:' + P.text + ';color:' + P.bg + '}');
css.push('.lumen-descr-row .lumen-reviews__mode--on.focus{outline:.19em solid ' + P.bg + ';outline-offset:-.19em}');


css.push('.lumen-descr-row .lumen-review__spoiler{margin-top:auto;font-family:' + FB + ';font-weight:600;font-size:.61em;line-height:1;letter-spacing:.12em;color:' + P.spice + '}');


css.push('.lumen-descr-row .lumen-reviews--headlines .lumen-review{height:8.33em}');
css.push('.lumen-descr-row .lumen-reviews--headlines .lumen-review__title{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}');




css.push('.lumen-review-modal .lumen-spoiler{border-radius:.26em;background:rgba(' + P.textRgb + ',.22);color:transparent}');
css.push('.lumen-review-modal--open .lumen-spoiler{background:rgba(' + A_RGB + ',.14);color:' + P.text + '}');
css.push('body.lumen-motion-full .lumen-review-modal .lumen-spoiler{-webkit-transition:color .2s,background-color .2s;transition:color .2s,background-color .2s}');


css.push('.lumen-review-modal__reveal{display:inline-block;margin-top:1.05em;padding:.61em .96em;border-radius:.53em;background:' + P.buttonBg + ';border:.04em solid ' + P.line + ';font-family:' + FB + ';font-weight:600;font-size:.83em;line-height:1.3;color:' + P.text + '}');

css.push('.lumen-review-modal__reveal.focus{background:' + P.text + ';color:' + P.bg + '}');






css.push('.lumen-descr-row .lumen-fr{width:100%;-webkit-flex-basis:100%;flex-basis:100%;margin-top:1.75em}');
css.push('.lumen-descr-row .lumen-fr__head{display:-webkit-inline-box;display:-webkit-inline-flex;display:inline-flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-sizing:border-box;box-sizing:border-box;max-width:100%;margin:0 0 .79em -.7em;padding:.44em .7em;border-radius:.61em;background:' + P.plate + '}');
css.push('.lumen-descr-row .lumen-fr__ico{width:1.05em;height:1.05em;-webkit-flex-shrink:0;flex-shrink:0;background-color:' + P.muted + ';-webkit-mask-image:' + LC.icons.maskUrl('list') + ';mask-image:' + LC.icons.maskUrl('list') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-right:.44em}');
css.push('.lumen-descr-row .lumen-fr__title{font-family:' + FB + ';font-weight:700;font-size:1.40em;line-height:1;color:' + P.text + ';margin-right:.61em}');
css.push('.lumen-descr-row .lumen-fr__name{font-family:' + FB + ';font-weight:400;font-size:.79em;line-height:1;letter-spacing:.06em;color:' + P.muted + ';margin-right:.88em}');
css.push('.lumen-descr-row .lumen-fr__modes{display:-webkit-box;display:-webkit-flex;display:flex}');
css.push('.lumen-descr-row .lumen-fr__mode{padding:.35em .61em;margin-right:.35em;border-radius:.44em;background:' + P.buttonBg + ';border:.04em solid ' + P.line + ';font-family:' + FB + ';font-weight:600;font-size:.70em;line-height:1.2;color:' + P.muted + '}');
css.push('.lumen-descr-row .lumen-fr__mode--on{color:' + A + ';border-color:rgba(' + A_RGB + ',.5)}');



css.push('.lumen-descr-row .lumen-fr__mode.focus{background:' + P.text + ';color:' + P.bg + '}');
css.push('.lumen-descr-row .lumen-fr__mode--on.focus{outline:.19em solid ' + P.bg + ';outline-offset:-.19em}');





css.push('.lumen-descr-row .lumen-fr__row{display:-webkit-box;display:-webkit-flex;display:flex;overflow:hidden;padding:.26em 0}');
css.push('.lumen-descr-row .lumen-fr-card{position:relative;-webkit-box-sizing:border-box;box-sizing:border-box;width:7.90em;-webkit-box-flex:0;-webkit-flex:none;flex:none;margin-right:.88em;color:' + P.text + '}');
css.push('.lumen-descr-row .lumen-fr-card__poster{position:relative;width:100%;height:11.84em;border-radius:.53em;overflow:hidden;background-color:' + P.panel + ';-webkit-background-size:cover;background-size:cover;background-position:center;background-repeat:no-repeat;border:.04em solid ' + P.line + '}');


css.push('.lumen-descr-row .lumen-fr-card--watched .lumen-fr-card__poster{opacity:.45}');
css.push('.lumen-descr-row .lumen-fr-card__mark{position:absolute;top:.35em;right:.35em;width:1.32em;height:1.32em;border-radius:50%;background:' + P.bg + ';opacity:0}');
css.push('.lumen-descr-row .lumen-fr-card--watched .lumen-fr-card__mark{opacity:1;background-color:' + P.good + ';-webkit-mask-image:' + LC.icons.maskUrl('check') + ';mask-image:' + LC.icons.maskUrl('check') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:.88em}');
css.push('.lumen-descr-row .lumen-fr-card__num{font-family:' + FB + ';font-weight:400;font-size:.61em;line-height:1.2;letter-spacing:.06em;color:' + P.muted + ';margin-top:.53em}');
css.push('.lumen-descr-row .lumen-fr-card__name{font-family:' + FB + ';font-weight:600;font-size:.79em;line-height:1.2;color:' + P.text + ';margin-top:.26em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}');
css.push('.lumen-descr-row .lumen-fr-card__year{font-family:' + FB + ';font-weight:400;font-size:.61em;line-height:1.2;color:' + P.smoke + ';margin-top:.18em}');
css.push('.lumen-descr-row .lumen-fr-card__flag{display:inline-block;margin-top:.26em;padding:.18em .44em;border-radius:.35em;font-family:' + FB + ';font-weight:600;font-size:.53em;line-height:1.3;letter-spacing:.08em;background:' + P.buttonBg + ';color:' + P.muted + '}');
css.push('.lumen-descr-row .lumen-fr-card__flag--current{background:' + A + ';color:' + t.onac + '}');
css.push('.lumen-descr-row .lumen-fr-card__flag--next{background:rgba(' + A_RGB + ',.18);color:' + A + '}');
css.push('.lumen-descr-row .lumen-fr-card__flag--soon{color:' + P.spice + '}');
css.push('.lumen-descr-row .lumen-fr-card__flag--watched{color:' + P.good + '}');
css.push('.lumen-descr-row .lumen-fr-card.focus .lumen-fr-card__poster{border:.13em solid ' + A + ';-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');
css.push('.lumen-descr-row .lumen-fr-card.focus .lumen-fr-card__name{color:' + A + '}');
css.push('body.lumen-motion-full .lumen-descr-row .lumen-fr-card__poster{-webkit-transition:border-color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:border-color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('body.lumen-motion-full .lumen-descr-row .lumen-fr-card.focus .lumen-fr-card__poster{-webkit-transform:scale(1.04);transform:scale(1.04)}');


css.push('.lumen-descr-row .lumen-fr-card--sk{height:11.84em;border-radius:.53em}');

css.push(LC.icons.NO_MASK + '{.lumen-descr-row .lumen-reviews__ico,.lumen-descr-row .lumen-reviews__hint-ico,.lumen-descr-row .lumen-review__likes:before,.lumen-review-modal__likes:before,.lumen-descr-row .lumen-fr__ico,.lumen-descr-row .lumen-fr-card__mark{display:none}}');





css.push('@media screen and (max-width:1000px){.lumen-card .full-start-new__title{font-size:2.43em}.lumen-card .full-start-new__body{min-height:0}}');







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

























css.push('body.lumen-fx-heavy .lumen-backdrop.lumen-motion-full .lumen-bg__img.is-active{-webkit-animation:lumen-kb 14s linear forwards;animation:lumen-kb 14s linear forwards}');
css.push('@-webkit-keyframes lumen-kb{from{-webkit-transform:scale(1)}to{-webkit-transform:scale(1.08)}}');
css.push('@keyframes lumen-kb{from{transform:scale(1)}to{transform:scale(1.08)}}');

















css.push('.lumen-card .full-start-new__title,.lumen-card .full-start-new__rate-line,.lumen-card .full-start-new__buttons{-webkit-transition:font-size .28s cubic-bezier(.2,.9,.3,1.25),margin-top .28s cubic-bezier(.2,.9,.3,1.25);transition:font-size .28s cubic-bezier(.2,.9,.3,1.25),margin-top .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('.lumen-card.lumen-compact .full-start-new__title{font-size:2.104em}');
css.push('.lumen-card.lumen-compact .full-start-new__rate-line{margin-top:.87em}');
css.push('.lumen-card.lumen-compact .full-start-new__buttons{margin-top:.95em}');










css.push('.lumen-card .lumen-next-chip__short{display:none}');
css.push('.lumen-card.lumen-compact .lumen-next-chip__text{display:none}');
css.push('.lumen-card.lumen-compact .lumen-next-chip__short{display:block}');
css.push('.lumen-card.lumen-compact .lumen-next-chip{border-top-left-radius:0;border-bottom-left-radius:0;padding-left:0}');
css.push('.lumen-card.lumen-compact .lumen-next-chip:before{display:none}');
css.push('.lumen-card.lumen-card--nextchip.lumen-compact .full-start-new__rate-line .full-start__status{margin-right:0 !important;border-top-right-radius:0;border-bottom-right-radius:0;padding-right:.45em}');
css.push('.lumen-card.lumen-motion-lite .full-start-new__title,.lumen-card.lumen-motion-lite .full-start-new__rate-line,.lumen-card.lumen-motion-lite .full-start-new__buttons,.lumen-card.lumen-motion-off .full-start-new__title,.lumen-card.lumen-motion-off .full-start-new__rate-line,.lumen-card.lumen-motion-off .full-start-new__buttons{-webkit-transition:none;transition:none}');








css.push('.lumen-card .lumen-franchise{display:none;font-family:' + FB + ';font-weight:600;font-size:1em;height:3.16em;padding:0 1.32em;margin:1.40em .70em .6em 0;border-radius:.79em;border:.04em solid ' + P.line + ';background:' + P.buttonBg + ';color:' + P.text + ';white-space:nowrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;-webkit-transition:background-color .2s,border-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,border-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');





css.push('.lumen-card.lumen-card--franchise .lumen-franchise{display:-webkit-box;display:-webkit-flex;display:flex}');
css.push('.lumen-card.lumen-card--franchise .lumen-actions{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card.lumen-card--franchise .full-start-new__reactions,.lumen-card.lumen-card--franchise .lumen-episodes{-webkit-flex-basis:100%;flex-basis:100%;width:100%}');
css.push('.lumen-card .lumen-franchise__ico{-webkit-flex-shrink:0;flex-shrink:0;width:1.14em;height:1.14em;margin-right:.53em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('film') + ';mask-image:' + LC.icons.maskUrl('film') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');
css.push('.lumen-card .lumen-franchise span{font-size:1.05em;line-height:1}');





css.push('.lumen-card .lumen-franchise.focus{background:' + P.text + ';color:' + P.bg + ';-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');




css.push('.lumen-card.lumen-motion-lite .lumen-franchise.focus,.lumen-card.lumen-motion-off .lumen-franchise.focus{-webkit-transform:none !important;transform:none !important}');


css.push(LC.icons.NO_MASK + '{.lumen-card .lumen-franchise__ico{display:none}}');




css.push('.lumen-hub{padding:2.81em 2.81em 3.5em 2.81em;color:' + P.text + '}');
css.push('.lumen-hub__head{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-bottom:1.4em}');



css.push('.lumen-hub__title{font-family:' + FB + ';font-weight:700;font-size:2.1em;line-height:1;margin-right:.6em}');
css.push('.lumen-hub__count{font-family:' + FB + ';font-size:1em;color:' + P.muted + '}');












css.push('.lumen-hub__search{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-align-self:center;align-self:center;height:2.2em;padding:0 1em;border-radius:1.1em;margin-left:auto;background:transparent;font-family:' + FB + ';font-weight:600;font-size:.92em;line-height:1;color:' + P.muted + ';white-space:nowrap;-webkit-transition:background-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('.lumen-hub__search .lumen-ico{-webkit-flex-shrink:0;flex-shrink:0;width:1.15em;height:1.15em;margin-right:.45em}');
css.push('.lumen-hub__search.focus{background:' + P.text + ';color:' + P.bg + ';-webkit-transform:scale(1.05);transform:scale(1.05)}');
css.push('.lumen-hub__empty{font-family:' + FB + ';font-size:1.05em;color:' + P.muted + ';padding:2em 0}');
css.push('.lumen-hub__chips{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-bottom:1.4em}');
css.push('.lumen-hub__tiles{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap}');







css.push('.lumen-hub .lumen-chip,.lumen-grid .lumen-chip{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:2.2em;padding:0 1em;margin:0 .3em .53em 0;border-radius:1.1em;background:transparent;font-family:' + FB + ';font-weight:600;font-size:.92em;line-height:1;color:' + P.muted + ';white-space:nowrap;-webkit-transition:background-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');



css.push('.lumen-hub .lumen-chip.lumen-chip--on,.lumen-grid .lumen-chip.lumen-chip--on{background:rgba(' + P.textRgb + ',.14);color:' + P.text + '}');
css.push('.lumen-hub .lumen-chip.focus,.lumen-grid .lumen-chip.focus{background:' + P.text + ';color:' + P.bg + ';-webkit-transform:scale(1.05);transform:scale(1.05)}');
css.push('.lumen-hub.lumen-motion-lite .lumen-chip.focus,.lumen-hub.lumen-motion-off .lumen-chip.focus,.lumen-grid.lumen-motion-lite .lumen-chip.focus,.lumen-grid.lumen-motion-off .lumen-chip.focus,.lumen-hub.lumen-motion-lite .lumen-hub__search.focus,.lumen-hub.lumen-motion-off .lumen-hub__search.focus{-webkit-transform:none;transform:none}');
css.push('.lumen-hub.lumen-motion-off .lumen-chip,.lumen-grid.lumen-motion-off .lumen-chip,.lumen-hub.lumen-motion-off .lumen-hub__search{-webkit-transition:none;transition:none}');





css.push('.lumen-hub__tiles .lumen-tile{position:relative;width:-webkit-calc((100% - 2.64em) / 4);width:calc((100% - 2.64em) / 4);margin:0 .88em .88em 0;border-radius:.6em;overflow:hidden;background:' + P.panel + ';-webkit-transition:-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:transform .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('.lumen-hub__tiles .lumen-tile:nth-child(4n){margin-right:0}');

css.push('.lumen-hub__tiles .lumen-tile:before{content:"";display:block;padding-top:56.25%}');









css.push('.lumen-hub .lumen-tile__media{position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden}');
css.push('.lumen-hub .lumen-tile__img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center 30%;opacity:0;-webkit-transition:opacity .25s;transition:opacity .25s}');


css.push('.lumen-hub .lumen-tile--filled .lumen-tile__img{opacity:1}');
css.push('.lumen-hub.lumen-motion-off .lumen-tile__img{-webkit-transition:none;transition:none}');


css.push('.lumen-hub .lumen-tile__scrim{position:absolute;top:0;left:0;right:0;bottom:0;background:-webkit-linear-gradient(bottom,rgba(' + P.bgRgb + ',.9) 0%,rgba(' + P.bgRgb + ',.35) 45%,rgba(' + P.bgRgb + ',0) 100%);background:linear-gradient(0deg,rgba(' + P.bgRgb + ',.9) 0%,rgba(' + P.bgRgb + ',.35) 45%,rgba(' + P.bgRgb + ',0) 100%)}');
css.push('.lumen-hub .lumen-tile__text{position:absolute;left:.88em;right:.88em;bottom:.7em}');


css.push('.lumen-hub .lumen-tile__title{font-family:' + FB + ';font-weight:700;font-size:1.15em;line-height:1.2;color:' + P.text + ';white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
css.push('.lumen-hub .lumen-tile__sub{font-family:' + FB + ';font-size:.85em;line-height:1;color:' + P.muted + ';margin-top:.35em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}');
css.push('.lumen-hub .lumen-tile__nokey{display:none;position:absolute;top:.7em;right:.7em;font-family:' + FB + ';font-size:.7em;letter-spacing:.04em;color:' + P.text + ';background:rgba(' + P.bgRgb + ',.8);border:.05em solid rgba(' + P.textRgb + ',.3);border-radius:.2em;padding:.25em .45em}');
css.push('.lumen-hub .lumen-tile--nokey .lumen-tile__nokey{display:block}');




css.push('.lumen-hub .lumen-tile__season{position:absolute;top:.7em;left:.7em;font-family:' + FB + ';font-size:.7em;letter-spacing:.04em;color:' + t.onac + ';background:' + A + ';border-radius:.2em;padding:.25em .45em}');











css.push('.lumen-hub__tiles .lumen-tile.focus{-webkit-transform:scale(1.05);transform:scale(1.05);z-index:3;-webkit-box-shadow:0 .2em 0 rgba(0,0,0,.45);box-shadow:0 .2em 0 rgba(0,0,0,.45)}');





css.push('.lumen-hub.lumen-motion-lite .lumen-tile.focus,.lumen-hub.lumen-motion-off .lumen-tile.focus{-webkit-transform:none;transform:none;outline:.13em solid ' + AL + ';outline-offset:-.13em}');
css.push('.lumen-hub.lumen-motion-off .lumen-tile{-webkit-transition:none;transition:none}');




css.push('.lumen-grid{padding:2.81em 2.81em 3.5em 2.81em;color:' + P.text + '}');
css.push('.lumen-grid__head{margin-bottom:1.05em}');
css.push('.lumen-grid__title{font-family:' + FB + ';font-weight:700;font-size:2.10em;line-height:1}');
css.push('.lumen-grid__sub{font-family:' + FB + ';font-size:.88em;color:' + P.smoke + ';margin-top:.5em}');
css.push('.lumen-grid__sorts{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-bottom:1.4em}');
css.push('.lumen-grid__items{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap}');




css.push('.lumen-grid__items .lumen-gcard{-webkit-flex-shrink:0;flex-shrink:0;width:-webkit-calc((100% - 4.4em) / 6);width:calc((100% - 4.4em) / 6);margin:0 .88em 1.4em 0;position:relative;-webkit-transition:-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:transform .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('.lumen-grid__items .lumen-gcard:nth-child(6n){margin-right:0}');
css.push('.lumen-grid .lumen-gcard .card__view{margin-bottom:.5em;border-radius:.31em;background-color:' + P.panel + '}');
css.push('.lumen-grid .lumen-gcard .card__img{border-radius:.31em;background-color:' + P.panelLo + '}');
css.push('.lumen-grid .lumen-gcard .card__title{font-family:' + FB + ';font-weight:700;font-size:.96em;line-height:1.15;color:' + P.text + '}');
css.push('.lumen-grid .lumen-gcard .card__age{font-family:' + FB + ';font-size:.88em;line-height:1;margin-top:.25em;color:' + P.muted + '}');















css.push('.lumen-grid .lumen-gcard.focus .card__view,.lumen-grid .lumen-gcard.hover .card__view{-webkit-animation:none !important;animation:none !important}');






css.push('.lumen-grid .card__quality,.lumen-grid .card__type{display:none}');
if (LC.pref('lumen_badges', true)) css.push('.lumen-grid .card__vote{display:none}');































css.push('.lumen-grid__items .lumen-gcard.focus{-webkit-transform:scale(1.08);transform:scale(1.08);z-index:3}');
css.push('.lumen-grid .lumen-gcard.focus .card__view:after,.lumen-grid .lumen-gcard.hover .card__view:after{display:none}');
css.push('.lumen-grid .lumen-gcard.focus .card__view{-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');
css.push('.lumen-grid.lumen-motion-lite .lumen-gcard.focus,.lumen-grid.lumen-motion-off .lumen-gcard.focus{-webkit-transform:none;transform:none}');
css.push('.lumen-grid.lumen-motion-off .lumen-gcard{-webkit-transition:none;transition:none}');


css.push('.lumen-grid .lumen-gcard__bar{position:absolute;left:.53em;right:.53em;bottom:.53em;height:.18em;border-radius:.09em;background:rgba(' + P.textRgb + ',.2);overflow:hidden}');
css.push('.lumen-grid .lumen-gcard__bar > div{height:100%;border-radius:.09em;background:' + A + '}');
css.push('.lumen-grid__empty{padding:2em 0}');
css.push('.lumen-grid .lumen-grid__empty-text{font-family:' + FB + ';font-size:1.05em;color:' + P.muted + ';margin-bottom:1.05em;max-width:42.96em}');
css.push('.lumen-grid .lumen-grid__back{display:-webkit-inline-box;display:-webkit-inline-flex;display:inline-flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:3.16em;padding:0 1.32em;border-radius:.79em;border:.04em solid ' + P.line + ';background:' + P.buttonBg + ';font-family:' + FB + ';font-weight:600;font-size:1em;color:' + P.text + '}');

css.push('.lumen-grid .lumen-grid__back.focus{background:' + P.text + ';color:' + P.bg + '}');

css.push('.lumen-grid .lumen-grid__hide{margin-right:.79em}');



























var heroSize = heroSizeKey();
var heroVh = HERO_VH[heroSize];
var rowsTopVh = ROWS_TOP_VH[heroSize];
var heroShift = heroShiftVh(heroSize);
var textBottom = textBottomVh(heroSize);
var textShift = textShiftVh(heroSize);
var smallText = heroSmallText();
var EASE = ' .42s cubic-bezier(.2,.8,.2,1)';











var AR = accentRules(P, t);
css.push(AR.main);
css.push('body.lumen-motion-full .lumen-main{-webkit-transition:background-color .6s ease-in-out;transition:background-color .6s ease-in-out}');
































css.push('body.lumen-main-on .background{display:none}');













































css.push('.lumen-hero{position:absolute;top:-4em;left:0;right:0;height:' + heroVh + 'vh;overflow:hidden;pointer-events:none;-webkit-transform:translateY(0) translateZ(0);transform:translateY(0) translateZ(0);-webkit-backface-visibility:hidden;backface-visibility:hidden}');
css.push('.lumen-hero.lumen-hero--compact{-webkit-transform:translateY(-' + heroShift + 'vh) translateZ(0);transform:translateY(-' + heroShift + 'vh) translateZ(0)}');
css.push('.lumen-hero.lumen-motion-full{-webkit-transition:-webkit-transform' + EASE + ';transition:transform' + EASE + '}');









css.push('.lumen-hero .lumen-hero__bg{position:absolute;top:0;left:0;right:0;bottom:0;-webkit-background-size:cover;background-size:cover;background-position:center 30%;background-repeat:no-repeat;opacity:0}');
css.push('.lumen-hero .lumen-hero__bg.is-active{opacity:1}');




css.push('body.lumen-fx-heavy .lumen-hero.lumen-motion-full .lumen-hero__bg{-webkit-transition:opacity .6s ease-in-out;transition:opacity .6s ease-in-out}');














css.push('.lumen-hero.lumen-motion-full .lumen-hero__bg--blur{-webkit-transform:scale(1.1);transform:scale(1.1)}');








css.push('.lumen-hero .lumen-hero__trailer{position:absolute;top:-10%;bottom:-10%;left:0;right:0;overflow:hidden;opacity:0;-webkit-transition:opacity 1s ease;transition:opacity 1s ease}');
css.push('.lumen-hero .lumen-hero__trailer.is-live{opacity:1}');
css.push('.lumen-hero .lumen-hero__trailer iframe{width:100%;height:100%;border:0;pointer-events:none}');




css.push('.lumen-hero.lumen-hero--trailer .lumen-hero__bg.is-active{opacity:.25}');
css.push('.lumen-hero.lumen-hero--trailer .lumen-hero__descr{display:none}');



css.push('.lumen-hero .lumen-hero__veil{position:absolute;top:0;left:0;right:0;bottom:0}');
css.push(AR.veilL);

















css.push(AR.veilB);


































css.push('.lumen-hero .lumen-hero__text{position:absolute;left:' + round2(2.81 / TEXT_ZOOM) + 'em;right:' + round2(2.81 / TEXT_ZOOM) + 'em;top:' + round2(HERO_HEAD_SAFE / TEXT_ZOOM) + 'em;bottom:' + textBottom + 'vh;font-size:' + TEXT_ZOOM + 'em;max-width:46em;overflow:hidden;' +
'display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-box-direction:normal;-webkit-flex-direction:column;flex-direction:column;' +
'-webkit-box-pack:end;-webkit-justify-content:flex-end;justify-content:flex-end;' +
'-webkit-transform-origin:left bottom;transform-origin:left bottom;-webkit-transform:translateY(0);transform:translateY(0)}');


















var textShiftCalc = textShift + 'vh + ' + MOODS_IN_EM + 'em';
var textScale = ') scale(' + TEXT_SCALE_COMPACT + ')';
css.push('.lumen-hero.lumen-hero--compact .lumen-hero__text{' +
'-webkit-transform:translateY(-webkit-calc(' + textShiftCalc + ')' + textScale + ';' +
'-webkit-transform:translateY(calc(' + textShiftCalc + ')' + textScale + ';' +
'transform:translateY(calc(' + textShiftCalc + ')' + textScale + '}');




css.push('.lumen-hero .lumen-hero__meta{font-family:' + FB + ';font-weight:400;font-size:1em;line-height:1.2;color:' + P.muted + '}');




























css.push('.lumen-hero .lumen-hero__logo{display:none;width:37.84em;max-width:100%;height:4.4em;margin-top:.4em;-webkit-background-size:contain;background-size:contain;background-position:left bottom;background-repeat:no-repeat;-webkit-transform-origin:left bottom;transform-origin:left bottom;-webkit-transform:scale(' + (smallText ? LOGO_COMPACT : 1) + ');transform:scale(' + (smallText ? LOGO_COMPACT : 1) + ')}');
css.push('.lumen-hero.lumen-hero--logo .lumen-hero__logo{display:block}');

















css.push('.lumen-hero .lumen-hero__title{font-family:' + FB + ';font-weight:700;font-size:3.4em;line-height:1.08;color:' + P.text + ';margin-top:.4em;height:1.29em;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1}');
css.push('.lumen-hero.lumen-hero--compact .lumen-hero__title{height:1.2em}');
css.push('.lumen-hero.lumen-hero--logo .lumen-hero__title{display:none}');
css.push('.lumen-hero .lumen-hero__descr{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-family:' + FB + ';font-weight:400;font-size:1.05em;line-height:1.45;color:' + P.muted + ';max-width:39.45em;margin-top:.5em}');




css.push('.lumen-hero .lumen-hero__sk{display:none;height:.75em;border-radius:.37em;background:-webkit-linear-gradient(left,rgba(' + P.textRgb + ',.14),rgba(' + P.textRgb + ',.06));background:linear-gradient(90deg,rgba(' + P.textRgb + ',.14),rgba(' + P.textRgb + ',.06))}');
css.push('.lumen-hero.lumen-hero--pending .lumen-hero__sk--meta{display:block;width:14em;max-width:60%;margin-top:.4em}');
css.push('.lumen-hero.lumen-hero--pending.lumen-hero--nodescr .lumen-hero__sk--descr{display:block;width:39.45em;max-width:100%;margin-top:.8em}');
css.push('.lumen-hero.lumen-hero--pending.lumen-hero--nodescr .lumen-hero__sk--short{display:block;width:26.3em;max-width:67%;margin-top:.4em}');








css.push('.lumen-hero .lumen-hero__chips{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
css.push('.lumen-hero .lumen-hero__status{display:none;font-family:' + FB + ';font-weight:600;font-size:.88em;line-height:1;color:' + A + ';background:rgba(' + A_RGB + ',.1);border-radius:.53em;padding:.4em .7em;margin-top:.45em}');
css.push('.lumen-hero.lumen-hero--status .lumen-hero__status{display:block}');













css.push('.lumen-hero.lumen-hero--compact .lumen-hero__logo{-webkit-transform:scale(' + LOGO_COMPACT + ');transform:scale(' + LOGO_COMPACT + ')}');
css.push('.lumen-hero.lumen-motion-full .lumen-hero__logo{-webkit-transition:-webkit-transform' + EASE + ';transition:transform' + EASE + '}');
css.push('.lumen-hero.lumen-hero--compact .lumen-hero__descr,.lumen-hero.lumen-hero--compact .lumen-hero__sk--descr,.lumen-hero.lumen-hero--compact .lumen-hero__sk--short{display:none}');
if (smallText) {
css.push('.lumen-hero .lumen-hero__meta,.lumen-hero .lumen-hero__sk--meta{display:none}');






css.push('.lumen-hero .lumen-hero__descr,.lumen-hero .lumen-hero__sk--descr,.lumen-hero .lumen-hero__sk--short{display:none}');
}











css.push('.lumen-hero.lumen-motion-full .lumen-hero__text{-webkit-transition:opacity .18s ease,-webkit-transform' + EASE + ';transition:opacity .18s ease,transform' + EASE + '}');
css.push('.lumen-hero.lumen-motion-full .lumen-hero__text.is-swapping{opacity:0}');
css.push('.lumen-hero.lumen-motion-full .lumen-hero__text.is-in{-webkit-animation:lumen-hero-in' + EASE + ';animation:lumen-hero-in' + EASE + '}');
css.push('@-webkit-keyframes lumen-hero-in{from{opacity:0}to{opacity:1}}');
css.push('@keyframes lumen-hero-in{from{opacity:0}to{opacity:1}}');
css.push('.lumen-hero.lumen-motion-lite .lumen-hero__text,.lumen-hero.lumen-motion-off .lumen-hero__text{opacity:1;-webkit-transition:none;transition:none;-webkit-animation:none;animation:none}');



















css.push('.lumen-moods{position:absolute;left:2.81em;right:2.81em;z-index:2;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap}');















css.push('.lumen-hero .lumen-hero__moods{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-top:' + MOODS_IN_GAP + 'em;pointer-events:auto}');



css.push('.lumen-hero .lumen-hero__moods:empty{display:none}');
css.push('.lumen-hero.lumen-hero--compact .lumen-hero__moods{opacity:0;visibility:hidden;pointer-events:none}');
css.push('.lumen-hero.lumen-motion-full .lumen-hero__moods{-webkit-transition:opacity .18s ease;transition:opacity .18s ease}');



css.push('.lumen-moods-on:not(.lumen-main) .lumen-moods{top:.53em}');
css.push('.lumen-moods-on:not(.lumen-main) .scroll.layer--wheight{margin-top:' + MOODS_BAR + 'em;height:-webkit-calc(100vh - ' + round2(LAMPA_HEAD + MOODS_BAR) + 'em) !important;height:calc(100vh - ' + round2(LAMPA_HEAD + MOODS_BAR) + 'em) !important}');






css.push('.lumen-mood-chip{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:2.46em;padding:0 1.05em;margin:0 .53em .53em 0;border-radius:.53em;background:' + P.chipBg + ';font-family:' + FB + ';font-weight:600;font-size:.88em;line-height:1;color:' + P.muted + ';white-space:nowrap;cursor:default;-webkit-transition:background-color .2s,color .2s;transition:background-color .2s,color .2s}');
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
var rowsFull = '{margin-top:0;height:-webkit-calc(100vh - ' + LAMPA_HEAD + 'em) !important;height:calc(100vh - ' + LAMPA_HEAD + 'em) !important;overflow:hidden;-webkit-transform:none;transform:none}';
css.push('@media screen and (min-aspect-ratio:' + heroMinRatio + '/100){' +
'.lumen-main .scroll.layer--wheight,.lumen-main.lumen-rows-up .scroll.layer--wheight' + rowsFull +
'.lumen-main .lumen-hero,.lumen-main .lumen-hero.lumen-hero--compact{top:0;height:auto;overflow:visible;-webkit-transform:none;transform:none}' +
'.lumen-hero .lumen-hero__bg,.lumen-hero .lumen-hero__veil,.lumen-hero .lumen-hero__trailer,.lumen-hero .lumen-fx{display:none}' +





'.lumen-hero .lumen-hero__text,.lumen-hero.lumen-hero--compact .lumen-hero__text{position:static;left:auto;right:auto;top:auto;bottom:auto;font-size:1em;max-width:none;overflow:visible;padding:.53em 2.81em 0;-webkit-transform:none;transform:none}' +
'.lumen-hero .lumen-hero__meta,.lumen-hero .lumen-hero__logo,.lumen-hero .lumen-hero__title,.lumen-hero .lumen-hero__descr,.lumen-hero .lumen-hero__sk,.lumen-hero .lumen-hero__chips{display:none}' +
'.lumen-hero.lumen-hero--compact .lumen-hero__moods,.lumen-main .lumen-hero .lumen-hero__moods{display:-webkit-box;display:-webkit-flex;display:flex;margin-top:0;opacity:1;visibility:visible;pointer-events:auto}' +
'.lumen-moods-on.lumen-main .scroll.layer--wheight,.lumen-moods-on.lumen-main.lumen-rows-up .scroll.layer--wheight{margin-top:' + MOODS_BAR + 'em;height:-webkit-calc(100vh - ' + round2(LAMPA_HEAD + MOODS_BAR) + 'em) !important;height:calc(100vh - ' + round2(LAMPA_HEAD + MOODS_BAR) + 'em) !important}}');























































































































var ROW_FOCUS = 1.10;




var cardWEm = round2(ROW_CARD_W * scale);
var cardTitleEm = round2(.96 * scale);
var cardAgeEm = round2(.88 * scale);
var rowTitleEm = round2(1.23 * scale);
var rowHeadGapEm = round2(ROW_HEAD_GAP * scale);
css.push('.lumen-main .card{width:' + cardWEm + 'em}');










var narrowRatio = rowNarrowRatio(heroSize, rowBlockEm(cardWEm, rowTitleEm, rowHeadGapEm, cardTitleEm, cardAgeEm));
if (narrowRatio < Math.max(HERO_MIN_RATIO, textRatio(heroSize, textNeedEm(false)))) {
css.push('@media screen and (min-aspect-ratio:' + narrowRatio + '/100){' +
'.lumen-main .card{width:' + round2(ROW_CARD_NARROW * scale) + 'em}}');
}



css.push('.lumen-main .card{will-change:auto}');
css.push('.lumen-main .card__view{margin-bottom:' + CARD_VIEW_GAP + 'em;border-radius:.31em;-webkit-transform:scale(1);transform:scale(1);-webkit-transform-origin:center bottom;transform-origin:center bottom}');
css.push('.lumen-main .card__img{border-radius:.31em}');
css.push('.lumen-main .card.focus .card__view:after,.lumen-main .card.hover .card__view:after{display:none}');
css.push('.lumen-main .card.focus .card__view,.lumen-main .card.hover .card__view{-webkit-animation:none !important;animation:none !important}');
css.push('.lumen-main .card.focus .card__view{-webkit-transform:scale(' + ROW_FOCUS + ');transform:scale(' + ROW_FOCUS + ')}');








css.push('.lumen-main .card.focus{z-index:3}');




css.push('body.lumen-motion-full .lumen-main .card__view{-webkit-transition:-webkit-transform .18s ease-out;transition:transform .18s ease-out}');
css.push('.lumen-main .card__quality,.lumen-main .card__type{display:none}');
if (LC.pref('lumen_badges', true)) css.push('.lumen-main .card__vote{display:none}');
css.push('.lumen-main .card__title{font-family:' + FB + ';font-weight:700;font-size:' + cardTitleEm + 'em;line-height:' + CARD_TITLE_LH + ';white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;color:' + P.muted + '}');
css.push('.lumen-main .card.focus .card__title{color:' + P.text + '}');
css.push('.lumen-main .card__age{font-family:' + FB + ';font-size:' + cardAgeEm + 'em;line-height:1;margin-top:' + CARD_AGE_GAP + 'em;color:' + P.muted + '}');




css.push('.lumen-main .card__title,.lumen-main .card__age{-webkit-transform:none;transform:none}');
css.push('.lumen-main .items-line__title{font-family:' + FB + ';font-weight:700;font-size:' + rowTitleEm + 'em}');
css.push('.lumen-main .items-line{padding-bottom:1.4em}');






css.push('.lumen-main .items-line__head{margin-bottom:' + rowHeadGapEm + 'em;padding-left:2.81em}');
css.push('.lumen-main .items-line .scroll__content{padding-left:2.81em}');













css.push('.lumen-main .items-cards > * + *{margin-left:1.75em}');
css.push(AR.cardFocus);










css.push('.lumen-main .lumen-badge,.lumen-grid .lumen-badge{position:absolute;top:.4em;left:.4em;max-width:-webkit-calc(100% - .8em);max-width:calc(100% - .8em);font-family:' + FB + ';font-weight:600;font-size:.61em;line-height:1;letter-spacing:.02em;padding:.4em .6em;border-radius:.4em;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;color:' + t.onac + ';background:' + A + ';z-index:2}');



css.push('.lumen-main .lumen-badge--progress,.lumen-grid .lumen-badge--progress,.lumen-main .lumen-badge--custom,.lumen-grid .lumen-badge--custom{color:' + P.text + ';background:' + P.chipBg + ';border:.04em solid ' + P.line + '}');
css.push('.lumen-main .lumen-badge-bar{position:absolute;left:.4em;right:.4em;bottom:.4em;height:.18em;border-radius:.09em;background:rgba(' + P.textRgb + ',.2);overflow:hidden;z-index:2}');
css.push('.lumen-main .lumen-badge-bar > div{height:100%;border-radius:.09em;background:' + A + '}');












css.push('.lumen-skeleton{background:rgba(' + P.textRgb + ',.10);-webkit-animation:lumen-sk 1.4s ease-in-out infinite;animation:lumen-sk 1.4s ease-in-out infinite}');
css.push('@-webkit-keyframes lumen-sk{0%,100%{opacity:.5}50%{opacity:1}}');
css.push('@keyframes lumen-sk{0%,100%{opacity:.5}50%{opacity:1}}');
css.push('body.lumen-motion-lite .lumen-skeleton,body.lumen-motion-off .lumen-skeleton{-webkit-animation:none;animation:none;opacity:1}');


css.push('.lumen-descr-row .lumen-review--sk{background-image:none}');


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
css.push('.lumen-roulette{position:relative;min-height:100%;padding:0 2.81em 2.81em}');



css.push('.lumen-roulette-screen.is-kadr .lumen-roulette{height:100%;overflow:hidden}');
css.push('.lumen-roulette-screen.is-kadr .lumen-roulette__head,.lumen-roulette-screen.is-kadr .lumen-roulette__chipbox,.lumen-roulette-screen.is-kadr .lumen-roulette__stage{opacity:0}');



css.push('.lumen-roulette .lumen-roulette__head{position:relative;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;padding-top:1.05em;margin-bottom:.88em}');
css.push('.lumen-roulette .lumen-roulette__title{font-family:' + FB + ';font-weight:700;font-size:2.1em;line-height:1.1;color:' + P.text + ';margin-right:1.05em}');
css.push('.lumen-roulette .lumen-roulette__media{display:-webkit-box;display:-webkit-flex;display:flex}');
css.push('.lumen-roulette .lumen-roulette__tab{height:2.1em;padding:0 .96em;margin-right:.53em;border-radius:.53em;background:' + P.chipBg + ';font-family:' + FB + ';font-weight:600;font-size:.96em;line-height:2.1em;color:' + P.smoke + '}');
css.push('.lumen-roulette .lumen-roulette__tab.is-on{color:' + P.text + ';background:rgba(' + P.textRgb + ',.22)}');
css.push('.lumen-roulette .lumen-roulette__tab.focus{background:' + P.text + ';color:' + P.bg + '}');
css.push('.lumen-roulette .lumen-roulette__filters{position:relative;display:-webkit-box;display:-webkit-flex;display:flex;margin-left:auto}');






css.push('.lumen-roulette .lumen-roulette__chipbox{position:relative;margin-bottom:.88em}');
css.push('.lumen-roulette .lumen-roulette__chips{position:relative;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:nowrap;flex-wrap:nowrap}');





css.push('.lumen-roulette .lumen-roulette__chip{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:2.1em;padding:0 .88em;margin:0 .53em 0 0;border-radius:.53em;background:' + P.chipBg + ';font-family:' + FB + ';font-weight:500;font-size:.96em;line-height:1;color:' + P.smoke + ';white-space:nowrap;-webkit-flex-shrink:0;flex-shrink:0}');
css.push('.lumen-roulette .lumen-roulette__chip.lumen-chip--on{color:' + P.text + ';background:rgba(' + A_RGB + ',.14)}');
css.push('.lumen-roulette .lumen-roulette__chip.focus{background:' + P.text + ';color:' + P.bg + '}');

css.push('.lumen-roulette .lumen-roulette__stage{position:relative;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-box-direction:normal;-webkit-flex-direction:column;flex-direction:column;-webkit-box-align:center;-webkit-align-items:center;align-items:center;margin-top:.88em}');


















css.push('.lumen-roulette .lumen-roulette__reel{width:28.67vh;height:43vh;border-radius:.53em;overflow:hidden;background:' + P.panel + ';border:.04em solid ' + P.line + ';-webkit-flex-shrink:0;flex-shrink:0}');
css.push('.lumen-roulette .lumen-roulette__frame{width:100%;height:100%;background-position:center;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover}');
css.push('body.lumen-motion-full .lumen-roulette .lumen-roulette__frame.is-step{-webkit-animation:lumen-roul-step .12s ease-out;animation:lumen-roul-step .12s ease-out}');
css.push('@-webkit-keyframes lumen-roul-step{from{-webkit-transform:translateY(12%)}to{-webkit-transform:translateY(0)}}');
css.push('@keyframes lumen-roul-step{from{transform:translateY(12%)}to{transform:translateY(0)}}');
css.push('.lumen-roulette .lumen-roulette__spin{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:3.16em;padding:0 1.75em;margin:.88em 0 0;border-radius:1.58em;background:' + A + ';color:' + t.onac + ';font-family:' + FB + ';font-weight:700;font-size:1.05em;border:.04em solid transparent}');
css.push('.lumen-roulette .lumen-roulette__spin.focus{border-color:' + AL + ';border-width:.11em;-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');
css.push('.lumen-roulette .lumen-roulette__spin.is-busy{opacity:.7}');
css.push('.lumen-roulette .lumen-roulette__hint{position:relative;margin:.53em 0 0;font-family:' + FB + ';font-size:.96em;color:' + P.muted + ';text-align:center}');




css.push('.lumen-roulette .lumen-roulette__result{position:relative;display:none;margin-top:1.05em;max-width:34em}');
css.push('.lumen-roulette .lumen-roulette__result.is-live{display:block}');
css.push('.lumen-roulette-screen.is-kadr .lumen-roulette__result{position:absolute;left:2.81em;bottom:1.4em;margin-top:0}');
css.push('.lumen-roulette .lumen-roulette__rtitle{font-family:' + FB + ';font-weight:700;font-size:2.4em;line-height:1.15;color:' + P.text + '}');
css.push('.lumen-roulette .lumen-roulette__rmeta{font-family:' + FB + ';font-size:.96em;line-height:1;margin-top:.44em;color:' + P.muted + '}');
css.push('.lumen-roulette .lumen-roulette__actions{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-top:1.05em}');
css.push('.lumen-roulette .lumen-roulette__btn{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:2.45em;padding:0 1.05em;margin:0 .53em .53em 0;border-radius:1.23em;background:' + P.buttonBg + ';font-family:' + FB + ';font-weight:600;font-size:.96em;color:' + P.text + '}');





css.push('.lumen-roulette .lumen-roulette__btn.focus{background:' + P.text + ';color:' + P.bg + ';-webkit-box-shadow:0 .2em 0 ' + AG + ';box-shadow:0 .2em 0 ' + AG + '}');
css.push('.lumen-roulette .lumen-roulette__empty{font-family:' + FB + ';font-size:1.05em;color:' + P.smoke + '}');


css.push('.lumen-menu-roulette .lumen-ico{width:1.5em;height:1.5em}');









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
css.push('.lumen-ambient .lumen-ambient__info{position:absolute;left:2.81em;bottom:2.81em;right:14em;max-width:36em}');
css.push('.lumen-ambient .lumen-ambient__title{font-family:' + FB + ';font-weight:700;font-size:1.75em;line-height:1.15;color:' + P.text + ';white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');


css.push('.lumen-ambient .lumen-ambient__dots{display:-webkit-box;display:-webkit-flex;display:flex;margin-top:.88em}');
css.push('.lumen-ambient .lumen-ambient__dot{width:.35em;height:.35em;border-radius:50%;margin-right:.44em;background:rgba(' + P.textRgb + ',.28)}');
css.push('.lumen-ambient .lumen-ambient__dot.is-on{background:' + A + '}');


css.push('.lumen-ambient .lumen-ambient__clock{position:absolute;right:2.81em;bottom:2.81em;font-family:' + FB + ';font-size:2.2em;line-height:1;letter-spacing:.04em;color:' + P.text + '}');









css.push('.lumen-hud{position:fixed;top:.3em;left:.3em;z-index:99999;padding:.2em .5em;font:.7em/1.4 Consolas,"Courier New",monospace;color:#0f0;background:rgba(0,0,0,.75);border-radius:.3em;pointer-events:none;white-space:nowrap}');














css.push('.lumen-minimap{position:fixed;right:2.81em;top:11.40em;width:13.15em;padding:1.05em .96em;border-radius:.53em;background:' + P.plate + ';border:.04em solid ' + P.line + ';z-index:80;pointer-events:none}');
css.push('.lumen-minimap .lumen-minimap__head{font-family:' + FB + ';font-size:.88em;line-height:1;letter-spacing:.14em;color:' + P.smoke + ';margin-bottom:.7em}');
css.push('.lumen-minimap .lumen-minimap__row{font-family:' + FB + ';font-weight:500;font-size:.88em;line-height:1.15;color:' + P.smoke + ';min-height:2.02em;padding:.31em .61em;border-radius:.35em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}');


css.push('.lumen-minimap .lumen-minimap__row--on{background:rgba(' + A_RGB + ',.14);border-left:.18em solid ' + A + ';color:' + A + ';font-weight:600;padding-left:.43em}');





css.push('.lumen-jump{position:fixed;left:50%;bottom:2.81em;-webkit-transform:translateX(-50%);transform:translateX(-50%);padding:.53em 1.05em;border-radius:.53em;background:' + P.plate + ';border:.04em solid ' + P.line + ';font-family:' + FB + ';font-size:.96em;line-height:1;letter-spacing:.06em;color:' + P.text + ';z-index:80;pointer-events:none;white-space:nowrap}');



css.push('.lumen-menu-hub .lumen-ico{width:1.5em;height:1.5em}');


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

var COUNTRY_RU = {
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
};

function trim(str) {
return ('' + (str || '')).replace(/^\s+|\s+$/g, '');
}






function country(headText, productionCountries) {
var text = trim(headText).replace(/^\d{4}\s*,?\s*/, '');
text = trim(text);
if (text) return text;

if (productionCountries && productionCountries.length) {
var first = productionCountries[0] || {};
var iso = first.iso_3166_1;
if (iso && COUNTRY_RU[iso]) return COUNTRY_RU[iso];
return first.name || iso || '';
}
return '';
}


function director(crew) {
if (!crew || !crew.length) return '';
for (var i = 0; i < crew.length; i++) {
if (crew[i] && crew[i].job === 'Director') return crew[i].name || '';
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
return { date: date, days: days, text: words.next + ' — ' + when };
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
director: director,
creator: creator,
network: network,
facts: facts,
nextEpisode: nextEpisode,
shortDate: shortDate,
titleClass: titleClass,
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
movie: { type: 'collection', id: 10 },
tv:    { type: 'discover',   params: { keywords: 379196, sort_by: 'popularity.desc' } }
}
},
{
id: 'harry-potter', title: 'Гарри Поттер', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 1241 } }
},
{
id: 'lotr', title: 'Властелин колец', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 119 } }
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
id: 'avengers', title: 'Мстители', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 86311 } }
},
{
id: 'xmen', title: 'Люди Икс', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 748 } }
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
id: 'suicide-squad', title: 'Отряд самоубийц', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 531242 } }
},
{
id: 'venom', title: 'Веном', group: 'franchise', icon: 'film',
sources: { movie: { type: 'collection', id: 558216 } }
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
id: 'marvel', title: 'Marvel Studios', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 420, sort_by: 'popularity.desc' } } }
},
{
id: 'a24', title: 'A24', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 41077, sort_by: 'popularity.desc' } } }
},
{
id: 'dc', title: 'DC Studios', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 128064, sort_by: 'popularity.desc' } } }
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
id: 'universal', title: 'Universal Pictures', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 33, sort_by: 'popularity.desc' } } }
},
{
id: 'paramount', title: 'Paramount Pictures', group: 'studio',
sources: { movie: { type: 'discover', params: { companies: 4, sort_by: 'popularity.desc' } } }
},
{
id: 'sony-pictures', title: 'Sony Pictures', group: 'studio',
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
id: 'netflix-series', title: 'Netflix: Сериалы', group: 'service', badge: 'NETFLIX',
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
id: 'xmas-comedy', title: 'Рождественские комедии', group: 'theme', icon: 'star', season: [12, 1],
sources: { movie: { type: 'discover', params: { genres: 35, keywords: 207317, sort_by: 'popularity.desc' } } }
},




{
id: 'christmas', title: 'Рождественское кино', group: 'theme', icon: 'star', season: [12, 1],
sources: { movie: { type: 'discover', params: { keywords: 207317, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
},
{
id: 'halloween', title: 'Хэллоуин', group: 'theme', icon: 'star', season: [9, 10, 11],
sources: { movie: { type: 'discover', params: { genres: 27, keywords: 3335, sort_by: 'popularity.desc' } } }
},
{
id: 'comedy', title: 'Комедии', group: 'theme',
sources: { movie: { type: 'discover', params: { genres: 35, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } } }
},
{
id: 'superhero', title: 'Супергерои', group: 'theme',
sources: {
movie: { type: 'discover', params: { genres: '28|12', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } },
tv:    { type: 'discover', params: { genres: '10759|10765', sort_by: 'popularity.desc' } }
}
},
{
id: 'horror-top', title: 'Хоррор', group: 'theme',
sources: { movie: { type: 'discover', params: { genres: 27, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 300 } } } }
},
{
id: 'documentary', title: 'Документальное', group: 'theme',
sources: { movie: { type: 'discover', params: { genres: 99, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'thriller', title: 'Триллеры', group: 'theme',
sources: { movie: { type: 'discover', params: { genres: 53, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } } }
},


{
id: 'space', title: 'Космос', group: 'theme',
sources: { movie: { type: 'discover', params: { keywords: 9882, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'post-apocalyptic', title: 'Постапокалипсис', group: 'theme',
sources: { movie: { type: 'discover', params: { keywords: 359337, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
},
{
id: 'zombie', title: 'Зомби', group: 'theme',
sources: {
movie: { type: 'discover', params: { keywords: 12377, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } },
tv:    { type: 'discover', params: { keywords: 12377, sort_by: 'popularity.desc' } }
}
},
{
id: 'vampire', title: 'Вампиры', group: 'theme',
sources: {
movie: { type: 'discover', params: { keywords: 3133, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } },
tv:    { type: 'discover', params: { keywords: 3133, sort_by: 'popularity.desc' } }
}
},
{
id: 'spy', title: 'Шпионы', group: 'theme',
sources: { movie: { type: 'discover', params: { keywords: 470, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'heist', title: 'Ограбления', group: 'theme',
sources: {
movie: { type: 'discover', params: { keywords: 10051, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } },
tv:    { type: 'discover', params: { keywords: 10051, sort_by: 'popularity.desc' } }
}
},
{
id: 'survival', title: 'Выживание', group: 'theme',
sources: { movie: { type: 'discover', params: { keywords: 10349, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'sport', title: 'Спорт', group: 'theme',
sources: { movie: { type: 'discover', params: { keywords: 333328, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
},
{
id: 'biopic', title: 'Байопики', group: 'theme',
sources: { movie: { type: 'discover', params: { keywords: 360939, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'noir', title: 'Нуар', group: 'theme',
sources: { movie: { type: 'discover', params: { keywords: 9807, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'slasher', title: 'Слэшеры', group: 'theme',
sources: { movie: { type: 'discover', params: { keywords: 12339, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
},
{
id: 'road-movie', title: 'Роуд-муви', group: 'theme',
sources: { movie: { type: 'discover', params: { keywords: 167043, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
},
{
id: 'romcom', title: 'Романтические комедии', group: 'theme',
sources: { movie: { type: 'discover', params: { genres: '35|10749', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'psycho-thriller', title: 'Психологические триллеры', group: 'theme',
sources: { movie: { type: 'discover', params: { genres: '9648|53', sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 200 } } } }
},
{
id: 'anime-movies', title: 'Аниме-фильмы', group: 'theme',
sources: { movie: { type: 'discover', params: { genres: 16, orig_lang: 'ja', sort_by: 'popularity.desc' } } }
},
{
id: 'fantasy', title: 'Фэнтези', group: 'theme',
sources: { movie: { type: 'discover', params: { genres: 14, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'scifi', title: 'Научная фантастика', group: 'theme',
sources: { movie: { type: 'discover', params: { genres: 878, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'western', title: 'Вестерны', group: 'theme',
sources: { movie: { type: 'discover', params: { genres: 37, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 200 } } } }
},
{
id: 'new-year', title: 'Новогоднее', group: 'theme', icon: 'star', season: [12, 1],
sources: { movie: { type: 'discover', params: { keywords: 252123, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
},
{
id: 'war-movies', title: 'Военные фильмы', group: 'theme',
sources: { movie: { type: 'discover', params: { genres: 10752, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 200 } } } }
},
{
id: 'musical', title: 'Мюзиклы', group: 'theme',
sources: { movie: { type: 'discover', params: { genres: 10402, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
},
{
id: 'crime', title: 'Криминал', group: 'theme',
sources: { movie: { type: 'discover', params: { genres: 80, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 300 } } } }
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
id: 'british', title: 'Британское ТВ', group: 'country',
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
id: 'scorsese', title: 'Мартин Скорсезе', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 1032 } } } }
},
{
id: 'villeneuve', title: 'Дени Вильнёв', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 137427 } } } }
},
{
id: 'miyazaki', title: 'Хаяо Миядзаки', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 608 } } } }
},


{
id: 'ridley-scott', title: 'Ридли Скотт', group: 'people',
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
id: 'tom-hanks', title: 'Том Хэнкс', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 31 } } } }
},
{
id: 'keanu-reeves', title: 'Киану Ривз', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 6384 } } } }
},
{
id: 'denzel', title: 'Дензел Вашингтон', group: 'people',
sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 5292 } } } }
},
{
id: 'brad-pitt', title: 'Брэд Питт', group: 'people',
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
{ id: 'halloween', preset: 'bats', accent: '#E07B2C', keywords: ['halloween', 'haunted house', 'slasher', 'witch', 'trick or treat'], genres: [27], months: [10], requireGenre: true },
{ id: 'christmas', preset: 'snow', accent: '#E8C170', keywords: ['christmas', 'santa claus', 'new year', 'christmas eve'], months: [12, 1] },
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
var seen = {};
var i, c;
for (i = 0; i < m.collections.length; i++) {
c = m.collections[i];
if (!c || !c.id) return { ok: false, reason: 'collection_no_id' };
if (typeof c.title !== 'string' || !c.title) {
return { ok: false, reason: 'collection_no_title: ' + c.id };
}
if (seen[c.id]) return { ok: false, reason: 'duplicate_id: ' + c.id };
seen[c.id] = 1;
if (!c.sources || (!c.sources.movie && !c.sources.tv)) {
return { ok: false, reason: 'no_sources: ' + c.id };
}
}
return { ok: true };
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
if (!url) { current = DEFAULT; cb(DEFAULT); return; }
var cached = null;
try { cached = Lampa.Storage.get('lumen_manifest', null); } catch (e) {}
if (isFresh(cached) && cached && validate(cached.data).ok) {
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
current = (cached && cached.data) || DEFAULT;
cb(current);
}
},
function () {
current = (cached && cached.data) || DEFAULT;
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






function buildRequest(spec, media, page) {
if (spec.type === 'collection') {
return { url: 'collection/' + spec.id, params: {}, life: LIFE_STATIC };
}
if (spec.type === 'list') {
return { url: 'list/' + spec.id, params: {}, life: LIFE_STATIC };
}
var params = {};
var k;
for (k in spec.params) {
if (spec.params.hasOwnProperty(k)) {
params[k] = spec.params[k];
}
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
if (p.hasOwnProperty(k) && k !== 'filter') {
q.push((MAP[k] || k) + '=' + encodeURIComponent(p[k]));
}
}
var f = p.filter || {};
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

var cacheKey = 'lumen_kp_' + spec.collection + '_' + (page || 1);
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
spec.collection + '&page=' + (page || 1),
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
var net = Lampa.Api.sources.tmdb.get(
r.url,
r.params,
function (json) { if (!dead()) ok(normalize(spec.type, json)); },
function (e) { if (!dead()) err(e); },
{ life: r.life }
);
return net;
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

var cacheKey = 'lumen_kpp_' + spec.collection;
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
spec.collection + '&page=1',
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



var api = {
buildRequest: buildRequest,
normalize: normalize,
discoverUrl: discoverUrl,
kpToFinds: kpToFinds,
mergeMedia: mergeMedia,
sortSignature: sortSignature,
fetchOne: fetchOne,
kpPosters: kpPosters,
bannerPath: bannerPath
};
api['fetch'] = fetchAll;
return api;
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.sources;


/* ---- 44_rows.js ---- */













































LC.rows = (function () {























var WATCHED = 95;



var _homeGen = 0;



var _addedRows = [];













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

























function dedupeAcross(rows, seen, min) {
if (!rows || !rows.length) return [];
seen = seen || {};
if (typeof min !== 'number') min = DEDUPE_MIN;

var kept = [];



var trimmed = [];
var i, j;
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
}











var full = [];
for (i = 0; i < kept.length; i++) {
var r = kept[i];
if (!trimmed[i] || r.lumen_keep || r.results.length >= min) full.push(r);
}




return full.length ? full : kept;
}






function homeRows(manifest, storedIds, month, limit) {
if (!manifest || !Array.isArray(manifest.collections)) return [];
if (typeof limit === 'number' && limit <= 0) return [];


var byId = {};
var i;
for (i = 0; i < manifest.collections.length; i++) {
byId[manifest.collections[i].id] = manifest.collections[i];
}


var ids = (storedIds && storedIds.length) ? storedIds : (manifest.home || []);


var seenIds = {};
var list = [];
for (i = 0; i < ids.length; i++) {
if (!seenIds[ids[i]]) {
seenIds[ids[i]] = 1;
var item = byId[ids[i]];
if (item) list.push(item);
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
if (!dedupeEnabled()) return _mainOriginal(params, oncomplite, onerror);
var seen = {};
var next = _mainOriginal(params, function (data) {
oncomplite(dedupeAcross(data, seen, DEDUPE_MIN));
}, onerror);
if (typeof next !== 'function') return next;
return function (resolve, reject) {
return next(function (more) {
resolve(dedupeAcross(more, seen, DEDUPE_MIN));
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







function doUnregister() {
if (!_addedRows.length) return;
for (var i = 0; i < _addedRows.length; i++) {
try {
if (window.Lampa && Lampa.ContentRows &&
typeof Lampa.ContentRows.remove === 'function') {
Lampa.ContentRows.remove(_addedRows[i]);
}
} catch (e) {}
}
_addedRows = [];
}









function register(manifest) {

doUnregister();


var picked = storedIds();

var limitRaw = 15;
try { limitRaw = LC.pref ? (parseInt(LC.pref('lumen_rows_limit', '15'), 10) || 15) : 15; } catch (e) {}


var month = new Date().getMonth() + 1;

var rows = homeRows(manifest, picked, month, limitRaw);







var pinned = !!(picked && picked.length);



var shift = registerAdvent(manifest) ? 1 : 0;

for (var i = 0; i < rows.length; i++) {
registerRow(rows[i], i + shift, pinned);
}
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



resolve({ results: days, title: adventTitle(today), lumen_keep: true });
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



function registerAdvent(manifest) {
try {
if (!window.Lampa || !Lampa.ContentRows) return false;
if (!LC.themes || typeof LC.themes.adventDays !== 'function') return false;
var today = adventToday();
if (!today || today.getMonth() !== 11) return false;
if (!adventSpecs(manifest).length) return false;
var descriptor = {
name: rowName('advent'),
title: adventTitle(today),
screen: 'main',
index: ROWS_OFFSET,
call: makeAdventCall(manifest)
};
Lampa.ContentRows.add(descriptor);
_addedRows.push(descriptor);
return true;
} catch (e) {
return false;
}
}







var ROWS_OFFSET = 4;
function registerRow(item, index, pinned) {
try {
if (!window.Lampa || !Lampa.ContentRows) return;


var rowTitle = item.title;
if (item.badge) rowTitle += ' · ' + item.badge;

var descriptor = {
name: rowName(item.id),
title: rowTitle,
screen: 'main',
index: index + ROWS_OFFSET,
call: makeCall(item, pinned)
};
Lampa.ContentRows.add(descriptor);
_addedRows.push(descriptor);
} catch (e) {}
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
resolve(payload);
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



function unregister() {
doUnregister();
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
installDedupe: installDedupe,
uninstallDedupe: uninstallDedupe,


served: served,


adventSpecs: adventSpecs,
adventPool: adventPool,
register: register,
unregister: unregister
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.rows;


/* ---- 45_personal.js ---- */

















































LC.personal = (function () {


var BECAUSE_LIMIT = 2;








var SHOWS_LIMIT = 6;













var ROW_TIMEOUT = 8000;


var SOON_DAYS = 30;


var RECENT_DAYS = 14;


var UPCOMING_DAYS = 7;

































































var CONTINUE_DONE = 95;


var _gen = 0;


var _addedRows = [];








function pickBecause(history, n) {
if (!history || !history.length || n <= 0) return [];
var seen = {};
var out = [];
for (var i = history.length - 1; i >= 0 && out.length < n; i--) {
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





function doUnregister() {
if (!_addedRows.length) return;
for (var i = 0; i < _addedRows.length; i++) {
try {
if (window.Lampa && Lampa.ContentRows &&
typeof Lampa.ContentRows.remove === 'function') {
Lampa.ContentRows.remove(_addedRows[i]);
}
} catch (e) {}
}
_addedRows = [];
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


function addRow(descriptor) {
try {
if (!window.Lampa || !Lampa.ContentRows) return;
Lampa.ContentRows.add(descriptor);
_addedRows.push(descriptor);
} catch (e) {}
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
resolve({ results: items, title: LC.lang ? LC.lang('lumen_row_continue') : 'Continue watching', lumen_personal: true });
return { cancel: function () {} };
};
};
}




function makeBecauseCall(picked, rowTitle) {
return function (params, screen) {
return function (call) {
var gen = _gen;
function alive() { return _gen === gen; }

var resolve = makeResolver(call);
if (!alive() || !picked || !picked.length) {
resolve({ results: [] }); return { cancel: function () {} };
}
var results = [];
var cancelled = false;
var handles = [];




var gate = LC.util.gate(picked.length, ROW_TIMEOUT, function () {
if (cancelled || !alive()) return;
resolve({ results: results, title: rowTitle, lumen_personal: true });
});

for (var i = 0; i < picked.length; i++) {
(function (card) {
var url = card.media + '/' + card.id + '/recommendations';
var net = null;
try {
net = Lampa.Api.sources.tmdb.get(
url,
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
if (net) handles.push(net);
})(picked[i]);
}

return {
cancel: function () {
cancelled = true;
gate.cancel();
for (var i = 0; i < handles.length; i++) {
try {
if (handles[i]) {
if (typeof handles[i].clear === 'function') handles[i].clear();
else if (typeof handles[i].abort === 'function') handles[i].abort();
}
} catch (e) {}
}
}
};
};
};
}




function makeNewEpisodesCall(shows) {
return function (params, screen) {
return function (call) {
var gen = _gen;
function alive() { return _gen === gen; }

var resolve = makeResolver(call);
if (!alive() || !shows || !shows.length) {
resolve({ results: [] }); return { cancel: function () {} };
}
var details = [];
var cancelled = false;
var handles = [];



var gate = LC.util.gate(shows.length, ROW_TIMEOUT, function () {
if (cancelled || !alive()) return;
var filtered = newEpisodes(details, null);
resolve({ results: filtered, title: LC.lang ? LC.lang('lumen_row_new_episodes') : 'New episodes', lumen_personal: true });
});

for (var i = 0; i < shows.length; i++) {
(function (card) {
var url = 'tv/' + card.id;
var net = null;
try {
net = Lampa.Api.sources.tmdb.get(
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
if (net) handles.push(net);
})(shows[i]);
}

return {
cancel: function () {
cancelled = true;
gate.cancel();
for (var i = 0; i < handles.length; i++) {
try {
if (handles[i]) {
if (typeof handles[i].clear === 'function') handles[i].clear();
else if (typeof handles[i].abort === 'function') handles[i].abort();
}
} catch (e) {}
}
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
var handles = [];



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
var net = null;
try {
net = Lampa.Api.sources.tmdb.get(
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
return net;
}

handles.push(fetchDiscover('movie', movies));
handles.push(fetchDiscover('tv', tvShows));

return {
cancel: function () {
cancelled = true;
gate.cancel();
for (var i = 0; i < handles.length; i++) {
try {
if (handles[i]) {
if (typeof handles[i].clear === 'function') handles[i].clear();
else if (typeof handles[i].abort === 'function') handles[i].abort();
}
} catch (e) {}
}
}
};
};
};
}









function register() {
doUnregister();


var enabled = true;
try { enabled = LC.pref ? LC.pref('lumen_personal_rows', true) : true; } catch (e) {}
if (!enabled) return;


try {
var cont = continuesList();
if (cont && cont.length) {
addRow({
name: 'lumen_continue',
title: LC.lang ? LC.lang('lumen_row_continue') : 'Continue watching',
screen: 'main',
index: 0,
call: makeContinueCall()
});
}
} catch (e) {}






try {
var history = getHistory();
var picked = pickBecause(history, BECAUSE_LIMIT);
if (picked && picked.length) {
var becauseTitle = LC.lang ? LC.lang('lumen_row_because') : 'Because you watched';
if (picked[0] && picked[0].title) {
becauseTitle += ': «' + picked[0].title + '»';
}
addRow({
name: 'lumen_because',
title: becauseTitle,
screen: 'main',
index: 1,
call: makeBecauseCall(picked, becauseTitle)
});
}
} catch (e) {}



try {
var shows = getShows(SHOWS_LIMIT);
if (shows && shows.length) {
addRow({
name: 'lumen_new_episodes',
title: LC.lang ? LC.lang('lumen_row_new_episodes') : 'New episodes of your shows',
screen: 'main',
index: 2,
call: makeNewEpisodesCall(shows)
});
}
} catch (e) {}


try {
addRow({
name: 'lumen_soon',
title: LC.lang ? LC.lang('lumen_row_soon') : 'Coming soon',
screen: 'main',
index: 3,
call: makeSoonCall()
});
} catch (e) {}
}


function unregister() {
doUnregister();
}

return {
pickBecause: pickBecause,
newEpisodes: newEpisodes,
soonRange: soonRange,

dropFinished: dropFinished,
bumpGen: bumpGen,
register: register,
unregister: unregister
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.personal;


/* ---- 46_hub.js ---- */





























































LC.hub = (function () {




var GRID_COLS = 6;




var POSTER_AHEAD = 14;









var BANNER_AHEAD = 8;









var TILE_EM = 18.98;
var GCARD_EM = 12.36;







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



function openTarget(item) {
var media = singleDiscover(item);
if (media) {
return {
url: LC.sources.discoverUrl(item.sources[media], media),
title: item.title,
component: 'category_full',
source: 'tmdb',
page: 1
};
}
return { url: '', title: (item && item.title) || '', component: 'lumen_grid', lumen: item, page: 1 };
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
var collection = fixed.concat(nodes.slice(navFrom, navTo));








if (keep && collection.indexOf(keep) < 0) collection.push(keep);
Navigator.setCollection(collection);




if (keep && typeof Navigator.focused === 'function') Navigator.focused(keep);
} catch (e) {
warn('hub: collection window failed', e);
}
}

















function screenController(recollect, afterMove, onUp) {
return {
toggle: function () {
recollect(null);
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
var lastFocus = null;
var started = false;

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
var fixed = searchNode ? [searchNode] : [];
limitCollection(fixed.concat(chipNodes), tileNodes, active);
}







function recollect(prefer) {
try {
var node = prefer || focusTarget();
limitHub(node);
Lampa.Controller.collectionFocus(node || false, root[0]);
} catch (e) {
warn('hub: collection failed', e);
}
}


function afterMove() {
limitHub(lastFocus);
}

















function keepVisible(el) {
try { scroll.update(el, true); } catch (e) { warn('hub: scroll.update failed', e); }
}













function bannerSize() {
return LC.util.emPx(TILE_EM) * 0.85 > 300 ? 'w780' : 'w300';
}









function paintBanner(node, path) {
var box = $(node).find('.lumen-tile__media');
if (!box || !box.length) return;
box.empty();
path = '' + (path || '');
if (!path) return;


var url = path.indexOf('http') === 0 ? path : imageUrl(path, bannerSize());
if (!url) return;






var img = $('<img class="lumen-tile__img" decoding="async">');
img[0].onload = function () { $(node).addClass('lumen-tile--filled'); };
img[0].src = url;
box.append(img);
}

function loadBanner(item, node) {
if (node.lumen_banner) return;
node.lumen_banner = true;
var captured = gen;






function skeleton(on) {
try {
var box = $(node).find('.lumen-tile__media');
if (!box || !box.length) return;
if (on) box.addClass('lumen-skeleton');
else box.removeClass('lumen-skeleton');
} catch (eSk) { }
}
skeleton(true);
var handle = LC.sources.bannerPath(item, function (path) {
skeleton(false);
if (gen !== captured) return;
paintBanner(node, path);
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
'<div class="lumen-tile__title">' + esc(item.title) + '</div>' +
'<div class="lumen-tile__sub">' + esc(sub) + '</div>' +
'</div>' +
'<div class="lumen-tile__nokey">' + esc(LC.lang('lumen_hub_nokey')) + '</div>' +
'</div>'
);
node.on('hover:focus', function () {
keepVisible(node[0]);
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
for (var c = 0; c < chipNodes.length; c++) {
$(chipNodes[c]).toggleClass('lumen-chip--on', chipNodes[c].lumen_group === groupId);
}
}

function chipNode(group) {



var node = $('<div class="lumen-chip selector">' + esc(group.title) + '</div>');
node[0].lumen_group = group.id;
node.on('hover:focus', function () { keepVisible(node[0]); lastFocus = node[0]; });
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
search.on('hover:focus', function () { keepVisible(search[0]); lastFocus = search[0]; });
search.on('hover:enter', function () { openSearch(); });
head.append(search);

searchNode = search[0];
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



if (started) recollect(null);





try { if (LC.perf && LC.perf.track) LC.perf.track('hub'); } catch (ePerf) {}
}

this.create = function () {
motionClass(root);
root.append(head);
root.append(chipsRow);
root.append(tilesRow);
scroll.append(root);











scroll.minus();
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
Lampa.Controller.add('content', screenController(recollect, afterMove, focusSearch));
Lampa.Controller.toggle('content');



if (manifest) loadVisibleBanners();
};

this.pause = function () {};








this.stop = function () {
started = false;
bump();



for (var i = 0; i < tileNodes.length; i++) {
if (!$(tileNodes[i]).hasClass('lumen-tile--filled')) tileNodes[i].lumen_banner = false;
}
};

this.destroy = function () {
bump();
chipNodes = [];
tileNodes = [];
searchNode = null;
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
var lastFocus = null;



var lastCardId = null;
var started = false;

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
limitCollection(sortNodes.concat(emptyNodes), cardNodes, active);
}








function recollect(prefer) {
try {
var node = prefer || focusTarget();
limitGrid(node);
Lampa.Controller.collectionFocus(node || false, root[0]);
} catch (e) {
warn('grid: collection failed', e);
}
}







function keepVisible(el) {
try { scroll.update(el, true); } catch (e) { warn('grid: scroll.update failed', e); }
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





function afterMove() {


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



el.lumen_poster = imageUrl(card.poster_path, LC.util.posterSize(LC.util.emPx(GCARD_EM)));

node.on('hover:focus', function () {
keepVisible(el);
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
if (LC.badges && LC.badges.decorate) LC.badges.decorate(node, card, { bar: false });
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
hide.on('hover:focus', function () { keepVisible(hide[0]); lastFocus = hide[0]; });
hide.on('hover:enter', function () {
try { Lampa.Storage.set('lumen_kp_hint', 'false'); } catch (e) {}
});
box.append(hide);
emptyNodes.push(hide[0]);
}
var back = $('<div class="lumen-grid__back selector">' + esc(LC.lang('lumen_grid_back')) + '</div>');
back.on('hover:focus', function () { keepVisible(back[0]); lastFocus = back[0]; });
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
if (started) recollect(null);
}



function loadPage(nextPage, reset) {
if (loading) return;
loading = true;
pending = { page: nextPage, reset: reset };
try { self.activity.loader(true); } catch (e) {}
var captured = gen;
var request = needsLocalSort(item) ? item : applySort(item, sortMode);
var handle = LC.sources['fetch'](request, nextPage, function (json) {
if (gen !== captured) return;
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
renderSub();
if (started) recollect(null);
}, function (err) {
if (gen !== captured) return;
loading = false;
pending = null;
try { self.activity.loader(false); } catch (e3) {}
if (!cardNodes.length) showEmpty(err && err.nokey ? 'nokey' : '');
renderSub();
if (started) recollect(null);
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
node.on('hover:focus', function () { keepVisible(node[0]); lastFocus = node[0]; });
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
head.append($('<div class="lumen-grid__title">' + esc(item.title || '') + '</div>'));
head.append(subtitle);
root.append(head);
var modes = sortModes();
for (var i = 0; i < modes.length; i++) {
var node = sortNode(modes[i]);
sortsRow.append(node);
sortNodes.push(node);
}
highlightSort();
root.append(sortsRow);
root.append(itemsRow);
scroll.append(root);



scroll.minus();
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
Lampa.Controller.add('content', screenController(recollect, afterMove));
Lampa.Controller.toggle('content');

if (resumeAfterStop) {
var again = resumeAfterStop;
resumeAfterStop = null;
loadPage(again.page, again.reset);
}
};

this.pause = function () {};






this.stop = function () {
started = false;
resumeAfterStop = loading ? pending : null;
bump();
loading = false;
pending = null;
};

this.destroy = function () {
bump();
cardNodes = [];
sortNodes = [];
emptyNodes = [];
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
groupsWithCounts: groupsWithCounts,
tilesFor: tilesFor,
inSeason: inSeason,
openTarget: openTarget,
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
franchise: franchise
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.hub;


/* ---- 48_hero.js ---- */





































LC.hero = (function () {


var DELAY = 350;








var ACCENT_DELAY = 3000;






var TRAILER_DELAY = 8000;


var VIDEOS_LIFE = 10080;

var SWAP_MS = 180;


var LOAD_TIMEOUT = 8000;



var DETAILS_LIFE = 1440;


var BIG_POSTER = 500;




var TEXT_ZOOM = 1.1;












var LOGO_EM = 37.84;































var LOGO_AREA = 65;
var LOGO_H_MAX = 5.2;
var LOGO_H_MIN = 2.4;
var LOGO_W_MAX = 37.84;

var MOTION_CLASSES = 'lumen-motion-full lumen-motion-lite lumen-motion-off';









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
return own || en || neutral || null;
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




function mediaOf(card) {
if (card && card.media_type) return card.media_type;
return (card && card.name) ? 'tv' : 'movie';
}

function yearOf(card) {
var date = '' + ((card && (card.release_date || card.first_air_date)) || '');
return date ? date.slice(0, 4) : '';
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
var genres = LC.cardinfo.genres(details.genres, words.cap);
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
backdrop: (details && details.backdrop_path) || card.backdrop_path || '',
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

























function trailerAllowed(pref, motion, trailer, heavy) {
if (pref === false) return false;
if (motion !== 'full') return false;
if (heavy === false) return false;
return trailer !== 'off';
}

function bigPoster(url) {
var src = '' + (url || '');
var m = /\/t\/p\/w(\d+)\//.exec(src);
if (!m) return null;
if ((parseInt(m[1], 10) || 0) >= BIG_POSTER) return null;
return src.replace(m[0], '/t/p/w' + BIG_POSTER + '/');
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





var last = null;

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







function buildNode() {
var node = $('<div class="lumen-hero">' +
'<div class="lumen-hero__bg lumen-hero__bg--a"></div>' +
'<div class="lumen-hero__bg lumen-hero__bg--b"></div>' +



'<div class="lumen-hero__trailer"></div>' +
'<div class="lumen-hero__veil lumen-hero__veil--l"></div>' +
'<div class="lumen-hero__veil lumen-hero__veil--b"></div>' +




'<div class="lumen-fx"></div>' +
'</div>');
var text = $('<div class="lumen-hero__text">' +
'<div class="lumen-hero__meta"></div>' +



'<div class="lumen-hero__sk lumen-hero__sk--meta lumen-skeleton"></div>' +
'<div class="lumen-hero__logo"></div>' +
'<div class="lumen-hero__title"></div>' +
'<div class="lumen-hero__descr"></div>' +
'<div class="lumen-hero__sk lumen-hero__sk--descr lumen-skeleton"></div>' +
'<div class="lumen-hero__sk lumen-hero__sk--short lumen-skeleton"></div>' +
'<div class="lumen-hero__chips">' +
'<div class="lumen-hero__status"></div>' +
'</div>' +







'<div class="lumen-hero__moods"></div>' +
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
state.node.removeClass(MOTION_CLASSES).addClass('lumen-motion-' + LC.motionMode());



applyTrailer();
} catch (e) {
warn('hero: motion failed', e);
}
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
if (state.loader) {
state.loader.onload = null;
state.loader.onerror = null;
state.loader = null;
}
if (state.net) {
try { if (state.net.clear) state.net.clear(); } catch (e) {}
state.net = null;
}
}





















function trailerPref() {
try { return LC.pref ? LC.pref('lumen_hero_trailer', true) !== false : true; } catch (e) { return true; }
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

function trailerReady() {
return trailerAllowed(trailerPref(), motionMode(), trailerMode(), fxHeavy());
}















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
if (!state.details || !LC.themes || !LC.fx) return;
var theme = null;
try { theme = LC.themes.forMovie(state.details); } catch (e) { warn('hero: fx theme failed', e); }
if (!theme) return;
try { state.node.addClass('lumen-theme--' + theme.id); } catch (e2) { }
var host = fxHost();
if (!host) return;
try {
LC.fx.mount(host, theme.preset, {
color: LC.themes.particleColor(theme),


paused: function () { return !!(state && state.trailer); }
});
} catch (e3) {
warn('hero: fx mount failed', e3);
}
}




function cancelTrailer() {
if (!state) return;
tgen++;
stopTimer('trailerTimer');
if (state.trailerNet) {
try { if (state.trailerNet.clear) state.trailerNet.clear(); } catch (e) { }
state.trailerNet = null;
}
state.trailerCard = null;
if (state.trailer) {
var control = state.trailer;
state.trailer = null;
try { if (control.destroy) control.destroy(); } catch (e2) {
warn('hero: trailer destroy failed', e2);
}
}
try { state.node.removeClass('lumen-hero--trailer'); } catch (e3) { }
}




function loadTrailer(card, captured) {
var media = mediaOf(card);
var lang = langCode();

function ask(code, next) {
try {
if (!window.Lampa || !Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb) return;
state.trailerNet = Lampa.Api.sources.tmdb.get(
media + '/' + card.id + '/videos',
{ langs: code },
function (json) {
if (tgen !== captured || !state || !isMounted()) return;
state.trailerNet = null;
var video = null;
try {
if (LC.trailer && typeof LC.trailer.pickTrailer === 'function') video = LC.trailer.pickTrailer(json && json.results);
} catch (ePick) {
warn('hero: trailer pick failed', ePick);
}
if (video && video.key) { startTrailer(video.key, captured); return; }
if (next) ask(next, '');
},
function () {
if (tgen !== captured || !state) return;
state.trailerNet = null;
if (next) ask(next, '');
},
{ life: VIDEOS_LIFE }
);
} catch (e) {
warn('hero: trailer request failed', e);
}
}

ask(lang, lang === 'en' ? '' : 'en');
}

function startTrailer(key, captured) {
try {
if (tgen !== captured || !state || !isMounted()) return;
if (!trailerReady()) return;
if (!LC.trailer || typeof LC.trailer.player !== 'function') return;
var host = state.node.find('.lumen-hero__trailer');
if (!host || !host.length) return;



state.trailer = LC.trailer.player(host, key, function () {
if (tgen !== captured || !state) return;
try { state.node.addClass('lumen-hero--trailer'); } catch (e) { }
}, function () {
if (tgen !== captured || !state) return;
state.trailer = null;
try { state.node.removeClass('lumen-hero--trailer'); } catch (e2) { }
});
} catch (err) {
warn('hero: trailer start failed', err);
}
}




function scheduleTrailer(card) {
if (!trailerReady()) return;
var captured = tgen;
state.trailerTimer = setTimeout(function () {
if (!state || tgen !== captured) return;
state.trailerTimer = null;
if (state.pending !== card) return;
if (!isMounted()) return;


if (!trailerReady()) return;
loadTrailer(card, captured);
}, TRAILER_DELAY);
}




function applyTrailer() {
if (!state) return;
if (trailerReady()) return;
cancelTrailer();
}

















function applyLogoBox() {
if (!state || !state.model) return;
var model = state.model;
var box = model.logo ? logoBox(model.logoRatio) : null;
var logo = state.node.find('.lumen-hero__logo');
logo.css('width', box ? box.w + 'em' : '');
logo.css('height', box ? box.h + 'em' : '');
}











function render(model, swap) {
if (!state || !model) return;
var node = state.node;
state.model = model;

function write() {
if (!state || !state.model) return;
var current = state.model;
var text = node.find('.lumen-hero__text');









var metaLine = current.rating ? current.meta.concat(['★ ' + current.rating]) : current.meta;
node.find('.lumen-hero__meta').text(metaLine.join(' · '));
node.find('.lumen-hero__title').text(current.title);
node.find('.lumen-hero__descr').text(current.overview);
node.find('.lumen-hero__status').text(current.status);
node.toggleClass('lumen-hero--status', !!current.status);
node.toggleClass('lumen-hero--pending', !!current.pending);



node.toggleClass('lumen-hero--nodescr', !current.overview);



var logoUrl = current.logo ? imageUrl(current.logo, logoSizeFor(LC.util.emPx(LOGO_EM * TEXT_ZOOM, 1))) : '';
var logo = node.find('.lumen-hero__logo');



logo.css('background-image', logoUrl ? 'url("' + encodeURI(logoUrl) + '")' : 'none');
node.toggleClass('lumen-hero--logo', !!logoUrl);
applyLogoBox();

text.removeClass('is-swapping');
if (motionMode() === 'full') text.addClass('is-in');
}

if (!swap || motionMode() !== 'full') {
write();
return;
}

var text = node.find('.lumen-hero__text');
text.removeClass('is-in').addClass('is-swapping');
var captured = gen;
stopTimer('swapTimer');
state.swapTimer = setTimeout(function () {
if (gen !== captured || !state) return;
state.swapTimer = null;
write();
}, SWAP_MS);
}












function swapFrame(url, blur) {
if (!state) return;
var node = state.node;
var a = node.find('.lumen-hero__bg--a');
var b = node.find('.lumen-hero__bg--b');
var activeIsA = a.hasClass('is-active');
if (!fxHeavy()) {


var only = activeIsA ? a : (b.hasClass('is-active') ? b : a);
only.css('background-image', 'url("' + encodeURI(url) + '")');
only.addClass('is-active');
only.toggleClass('lumen-hero__bg--blur', !!blur);
state.frameUrl = url;
return;
}
var next = activeIsA ? b : a;
var prev = activeIsA ? a : b;
next.css('background-image', 'url("' + encodeURI(url) + '")');
next.addClass('is-active');
prev.removeClass('is-active');









next.toggleClass('lumen-hero__bg--blur', !!blur);
state.frameUrl = url;
}












function loadFrame(model, captured) {
if (!state) return;
if (motionMode() === 'off') return;
var blur = false;
var path = model.backdrop;
if (!path) { path = model.poster; blur = true; }
if (!path) return;






var url = imageUrl(path, blur ? 'w92' : sizeFor(screenWidth()));
if (!url || url === state.frameUrl) return;

var loader = new Image();





loader.decoding = 'async';
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
stopTimer('loadTimer');
state.loader = null;


if (!ok) return;
try {
swapFrame(url, blur);
} catch (e) {
warn('hero: frame failed', e);
}
}

function shown() { finish(true); }

loader.onload = function () { if (!decoding) shown(); };
loader.onerror = function () { finish(false); };
state.loader = loader;







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
var req = detailsRequest(mediaOf(card), card.id, langCode());
state.net = Lampa.Api.sources.tmdb.get(
req.url,
req.params,
function (json) {
if (gen !== captured || !state || !isMounted()) return;
state.net = null;
state.details = json || null;
var model = heroModel(card, state.details, words());


if (!state.details) model.pending = false;
render(model, false);



applyFx();


if (!state.frameUrl && model.backdrop) loadFrame(model, captured);
},
function () {
if (gen !== captured || !state || !isMounted()) return;
state.net = null;




var fallback = heroModel(card, null, words());
fallback.pending = false;
render(fallback, false);
},
{ life: req.life }
);
} catch (e) {
warn('hero: details failed', e);
}
}



function show(card) {
if (!state || !card) return;
try {
var captured = ++gen;
cancelPending();
state.shownId = card.id;
state.details = null;
state.model = null;



clearFx();
var model = heroModel(card, null, words());
render(model, true);
loadFrame(model, captured);
loadDetails(card, captured);
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
state.node.toggleClass('lumen-hero--compact', on);
try { state.root.toggleClass('lumen-rows-up', on); } catch (e) {}
}


function updateCompact(el) {
if (!state || state.fixedCompact) return;
var index = rowIndex(el);
if (index < 0) return;
setCompact(index > 0);
}



function posterOf(el) {
try {
return $(el).find('.card__img').attr('src') || '';
} catch (e) {
return '';
}
}












function rememberFocus(el, card) {
var poster = posterOf(el);
if (!poster) { last = null; cancelBigPoster(); return; }
last = { id: card.id, poster: poster, node: el };
scheduleBigPoster(card.id, poster);
}









function refreshFocusSource(el, card) {
var poster = posterOf(el);
if (!poster) return;
if (last && String(last.id) === String(card.id) && last.poster === poster) return;
rememberFocus(el, card);
}




function bigPosterWanted() {
try {
if (LC.motionMode && LC.motionMode() !== 'full') return false;
return LC.pref ? LC.pref('lumen_transition', true) !== false : false;
} catch (e) {
return false;
}
}






function cancelBigPoster() {
if (!state) return;
stopTimer('bigTimer');
if (state.bigLoader) {
state.bigLoader.onload = null;
state.bigLoader.onerror = null;
state.bigLoader = null;
}
}








function scheduleBigPoster(id, poster) {
cancelBigPoster();



if (!bigPosterWanted()) return;
var url = bigPoster(poster);
if (!url) return;
state.bigTimer = setTimeout(function () {
if (!state) return;
state.bigTimer = null;
if (!last || String(last.id) !== String(id)) return;
var img = new Image();

img.decoding = 'async';
state.bigLoader = img;
img.onload = function () {
if (!state || state.bigLoader !== img) return;
state.bigLoader = null;
if (last && String(last.id) === String(id)) last.big = url;
};
img.onerror = function () {
if (!state || state.bigLoader !== img) return;
state.bigLoader = null;
};
img.src = url;
}, DELAY);
}









function scheduleAccent(card) {
stopTimer('accentTimer');
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

function onFocus(el) {
if (!state) return;
var card = el.card_data;
if (!card || card.id == null) return;










if (state.focusEl === el) { refreshFocusSource(el, card); return; }
state.focusEl = el;

updateCompact(el);
rememberFocus(el, card);

state.focusAt = Date.now();
state.pending = card;
stopTimer('timer');



scheduleAccent(card);





if (state.trailerCard !== card) {
cancelTrailer();
state.trailerCard = card;
scheduleTrailer(card);
}


if (state.shownId === card.id) return;

var captured = gen;
state.timer = setTimeout(function () {
if (gen !== captured || !state) return;
state.timer = null;
if (!isMounted()) return;
if (state.pending !== card) return;
if (!shouldUpdate(state.shownId, card.id, Date.now() - state.focusAt, DELAY)) return;
show(card);
}, DELAY);
}






function onFocusEvent(e) {
if (!state) return;
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
if (!node || typeof node.addEventListener !== 'function') return;
state.focusHandler = onFocusEvent;
node.addEventListener('hover:focus', state.focusHandler, true);
} catch (e) {
warn('hero: listen failed', e);
}
}




function unlistenFocus(s) {
if (!s || !s.focusHandler) return;
try {
var node = s.root && s.root[0];
if (node && typeof node.removeEventListener === 'function') {
node.removeEventListener('hover:focus', s.focusHandler, true);
}
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














rememberFocus(el[0], el[0].card_data);
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








if (state && state.root && state.root[0] === root[0]) return;
unmount();
opts = opts || {};

var node = buildNode();
root.prepend(node);
var hostClass = opts.hostClass || MAIN_HOST;
root.addClass(hostClass);

gen++;
state = {
root: root,
node: node,
hostClass: hostClass,


focusHandler: null,
focusEl: null,
timer: null,
swapTimer: null,
loadTimer: null,
accentTimer: null,
loader: null,
net: null,
shownId: null,
details: null,
model: null,
pending: null,
focusAt: 0,
frameUrl: '',


trailerTimer: null,
trailerNet: null,
trailer: null,
trailerCard: null,
fixedCompact: !!opts.compact
};
if (opts.compact) setCompact(true);







if (hostClass === MAIN_HOST) {
markBody(true);
guardBackground();
}
applyMotion();
listenFocus(root);
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
} catch (e) {
warn('hero: mountCurrent failed', e);
}
}



function unmount() {
if (!state) return;



cancelTrailer();



markBody(false);
unguardBackground();
var s = state;
state = null;


last = null;
gen++;
unlistenFocus(s);
var timers = ['timer', 'swapTimer', 'loadTimer', 'accentTimer', 'bigTimer', 'trailerTimer'];
for (var i = 0; i < timers.length; i++) {
try { if (s[timers[i]]) clearTimeout(s[timers[i]]); } catch (eT) {}
}
if (s.loader) {
s.loader.onload = null;
s.loader.onerror = null;
}


if (s.bigLoader) {
s.bigLoader.onload = null;
s.bigLoader.onerror = null;
}
try { if (s.net && s.net.clear) s.net.clear(); } catch (eN) {}




try {
var fxGone = s.node.find('.lumen-fx');
if (LC.fx && fxGone && fxGone.length) LC.fx.unmount(fxGone);
} catch (eFx) { warn('hero: fx unmount failed', eFx); }
try { s.node.remove(); } catch (eR) {}


try { s.root.removeClass(s.hostClass).removeClass('lumen-rows-up'); } catch (eC) {}
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






function detach(render) {
if (!state) return;
if (ownedBy(render)) return;
unmount();
}

function active() {
return !!state;
}




function owns(render) {
return ownedBy(render);
}

return {
pickLogo: pickLogo,
bigPoster: bigPoster,
mediaOf: mediaOf,
heroModel: heroModel,
shouldUpdate: shouldUpdate,
sizeFor: sizeFor,
logoSizeFor: logoSizeFor,
logoBox: logoBox,
detailsRequest: detailsRequest,


trailerAllowed: trailerAllowed,


applyTrailer: applyTrailer,



applyFx: applyFx,
mount: mount,
mountCurrent: mountCurrent,
detach: detach,
owns: owns,
unmount: unmount,
applyMotion: applyMotion,
active: active,


lastFocus: function () { return last; },





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

var inActive = root.closest('.activity--active').length > 0;
if (!inActive) return;
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
var slot = root.find('.lumen-hero__moods');
var inHero = slot.length > 0;













if (state && state.root && state.root[0] === root[0] && state.inHero === inHero) return;
unmount();
var moodList = moods();
if (!moodList.length) return;















var node = inHero ? slot : $('<div class="lumen-moods"></div>');
fillChips(node, moodList);
if (!inHero) root.append(node);
root.addClass('lumen-moods-on');
gen++;
state = { root: root, node: node, inHero: inHero };


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


try { if (s.inHero) s.node.empty(); else s.node.remove(); } catch (eN) {}


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






if (typeof LC.fxHeavy === 'function' && !LC.fxHeavy()) return false;
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

LC.backdrops = { apply: apply, cancel: cancel, pickBackdrops: pickBackdrops, revive: revive };






if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.backdrops;


/* ---- 51_slideshow.js ---- */





























LC.slideshow = (function () {















function isActivityForeground(activityEl) {
if (!activityEl || !activityEl.length) return true;
return !!activityEl.hasClass('activity--active');
}

function isLayerForeground(layer) {
try {
return isActivityForeground(layer.closest('.activity'));
} catch (e) {
return true;
}
}





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







var CROSSFADE_MS = 1200;
















































function create(layer, urls, opts) {
opts = opts || {};
var enabledFn = typeof opts.enabled === 'function' ? opts.enabled : function () { return true; };
var intervalFn = typeof opts.intervalMs === 'function' ? opts.intervalMs : function () { return 14000; };

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




if (!isLayerForeground(layer)) return;








if (covered()) return;
if (offset > urls.length) return;
var next = (idx + offset) % urls.length;
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


var DT_CAP = 50;



var IDLE_MS = 500;
var TWO_PI = Math.PI * 2;





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
ctx.globalAlpha = value < 0 ? 0 : (value > 1 ? 1 : value);
}





function dot(ctx, p, color, a) {
alpha(ctx, a);
ctx.fillStyle = color;
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
return value > DPR_MAX ? DPR_MAX : value;
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
if (node && typeof node.closest === 'function') {
var activity = node.closest('.activity');
if (activity && activity.classList && !activity.classList.contains('activity--active')) return true;
}
} catch (e) { }
return false;
}




function paused(inst) {
if (hidden()) return true;
if (covered()) return true;
try {
if (inst.paused && inst.paused()) return true;
} catch (e) { }
return archived(inst);
}

function render(inst, dt) {
var ctx = inst.ctx;
ctx.clearRect(0, 0, inst.w, inst.h);
step(inst.particles, dt, inst.w, inst.h);
stat_steps++;
var preset = presets[inst.name];
if (!preset) return;
for (var i = 0; i < inst.particles.length; i++) {
preset.draw(ctx, inst.particles[i], inst.w, inst.h, inst.color);
}
ctx.globalAlpha = 1;
}

function loop(ts) {
frame = 0;
var i;
for (i = instances.length - 1; i >= 0; i--) {
if (!attached(instances[i])) drop(instances[i]);
}
if (!instances.length) { last = 0; return; }
var time = typeof ts === 'number' ? ts : nowMs();
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
try {
if (inst.canvas.parentNode) inst.canvas.parentNode.removeChild(inst.canvas);
} catch (e) {
warn('fx: canvas remove failed', e);
}
try {
inst.canvas.width = 0;
inst.canvas.height = 0;
} catch (e2) { }
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
var canvas = d.createElement('canvas');
canvas.className = 'lumen-fx__canvas';
canvas.width = Math.round(w * ratio);
canvas.height = Math.round(h * ratio);
var ctx = canvas.getContext ? canvas.getContext('2d') : null;
if (!ctx) return null;

if (typeof ctx.setTransform === 'function') ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
node.appendChild(canvas);

var inst = {
node: node,
canvas: canvas,
ctx: ctx,
name: name,
w: w,
h: h,
color: opts.color || '#FFFFFF',
paused: typeof opts.paused === 'function' ? opts.paused : null,
particles: spawn(name, w, h, opts.count, Math.random)
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



function hasKeyword(names, keywords) {
if (!keywords || !keywords.length) return false;
for (var i = 0; i < keywords.length; i++) {
var want = ('' + keywords[i]).toLowerCase();
if (!want) continue;
for (var j = 0; j < names.length; j++) {
if (names[j].indexOf(want) >= 0) return true;
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




var PALE = { snow: 1, stars: 1, rain: 1, bubbles: 1 };



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



function curatedFrames() {
var list = null;
try {
var m = LC.manifest && typeof LC.manifest.get === 'function' ? LC.manifest.get() : null;
if (m && m.ambient && m.ambient.length) list = m.ambient;
if (!list && LC.manifest && LC.manifest.DEFAULT) list = LC.manifest.DEFAULT.ambient;
} catch (e) {
warn('ambient: manifest failed', e);
}
return normalizeFrames(list);
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
try {
if (window.Lampa && Lampa.Player && typeof Lampa.Player.opened === 'function') return !!Lampa.Player.opened();
} catch (e) { }
return false;
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
target.css('background-image', 'url("' + url + '")');
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
preloadNext(urlOf(reel[nextIndex(i, reel.length)], size));
}

function tick() {
slide_timer = 0;
if (!live) return;



if (!hidden()) {
try { show(nextIndex(index, reel.length)); } catch (e) { warn('ambient: slide failed', e); }
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
if (!live) { schedule(); return; }
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
var WAIT_MS = 6000;


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
if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') stored = Lampa.Storage.field('lumen_trailer');
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






function player($host, key, onStart, onEnd) {
var id = 'lumen-yt-' + (++seq);
var yt = null;
var dead = false;
var timeout = null;

$host.html('<div id="' + id + '"></div>');

function kill() {
if (dead) return;
dead = true;



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
try { ev.target.mute(); ev.target.playVideo(); } catch (e) { }
},
onStateChange: function (ev) {
if (dead || !ev) return;
if (ev.data === 1) {
if (timeout) { clearTimeout(timeout); timeout = null; }
try { $host.addClass('is-live'); } catch (e) { }
onStart();
}
if (ev.data === 0) kill();
},
onError: function () { kill(); }
}
});
} catch (e) {
kill();
}
}

timeout = setTimeout(kill, WAIT_MS);

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

return { destroy: kill };
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
if (!LC.slideshow.isLayerForeground(root)) return;
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
if (!video) return null;

var layer = body.children('.lumen-backdrop');
if (!layer || !layer.length) return null;

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
if (!LC.slideshow.isMounted(layer[0]) || !LC.slideshow.isLayerForeground(layer)) destroy();
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


if (!LC.slideshow.isMounted(layer[0])) { alive = false; return; }
if (!LC.slideshow.isLayerForeground(layer)) { alive = false; return; }

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
bind: bind
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








var REEL_VH = 28.67;







function cardMedia(card) {
if (card && card.media_type) return card.media_type === 'tv' ? 'tv' : 'movie';
return (card && (card.name || card.first_air_date)) ? 'tv' : 'movie';
}

function normalizeMedia(value) {
return value === 'tv' ? 'tv' : 'movie';
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






function spinPlan(total) {
var plan = [];
var n = Number(total) || 0;
if (n <= 0) return plan;
if (n === 1) return [{ index: 0, delay: 0 }];

var FAST = 40;
var index = 0;
var i;

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


plan[plan.length - 1].index = n - 1;
return plan;
}




function collectionsFor(manifest, media) {
var out = [];
if (!manifest || !Array.isArray(manifest.collections)) return out;
var want = normalizeMedia(media);
var home = {};
var homeList = manifest.home || [];
var i;
for (i = 0; i < homeList.length; i++) home[homeList[i]] = i + 1;
var first = [];
var rest = [];
for (i = 0; i < manifest.collections.length; i++) {
var c = manifest.collections[i];
if (!c || !c.sources || !c.sources[want]) continue;
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
var spinBtn = $('<div class="lumen-roulette__spin selector">' + esc(LC.lang('lumen_roulette_spin')) + '</div>');
var resultBox = $('<div class="lumen-roulette__result"></div>');
var hint = $('<div class="lumen-roulette__hint">' + esc(LC.lang('lumen_roulette_hint')) + '</div>');

var gen = 0;
var handles = [];
var detailsNet = null;
var spinTimer = 0;
var manifest = null;
var collections = [];
var chosen = storedIds(media);
var pool = [];
var poolKey = '';
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
var filters = { unseen: unseenDefault(), short: false };


if (object && object.preselect) chosen = [object.preselect];

function alive(captured) {
return function () { return gen === captured; };
}

function clearHandles() {
for (var i = 0; i < handles.length; i++) {
try { if (handles[i] && handles[i].clear) handles[i].clear(); } catch (e) { }
}
handles = [];
try { if (detailsNet && detailsNet.clear) detailsNet.clear(); } catch (e2) { }
detailsNet = null;
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
clearHandles();
stopSpin();
cancelResultLoader();
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

function recollect(prefer) {
try {
var box = scope();
Lampa.Controller.collectionSet(box);
Lampa.Controller.collectionFocus(prefer || focusTarget() || false, box);
} catch (e) {
warn('roulette: collection failed', e);
}
}











function keepVisible(el) {
try { scroll.update(el, true); } catch (e) { warn('roulette: scroll.update failed', e); }
}



function watchFocus(node) {
node.on('hover:focus', function () {
keepVisible(node[0]);
lastFocus = node[0];
});
return node;
}






function railChip(node) {
node.on('hover:focus', function () {
try { chipsScroll.update(node[0], true); } catch (e) { warn('roulette: chips scroll failed', e); }
});
return node;
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
media = value;
chosen = storedIds(media);
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
recollect(focusNode || null);
}

function chipNode(text, on) {
var node = watchFocus($('<div class="lumen-chip lumen-roulette__chip selector">' + esc(text) + '</div>'));
if (on) node.addClass('lumen-chip--on');
return node;
}

function buildChips() {
chipsRow.empty();
collections = collectionsFor(manifest, media);
var all = chipNode(LC.lang('lumen_roulette_all'), !chosen.length);
all.on('hover:enter', function () {
if (!chosen.length) return;
chosen = [];
saveIds(media, chosen);
poolKey = '';
buildChips();
recollect(chipsRow.find('.lumen-roulette__chip')[0]);
});
chipsRow.append(railChip(all));
var shown = chipList(collections, chosen, CHIP_LIMIT);
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
});
filtersRow.append(unseen);
var shortKey = media === 'tv' ? 'lumen_roulette_short_tv' : 'lumen_roulette_short_movie';
var short = chipNode(LC.lang(shortKey), filters.short);
short.on('hover:enter', function () {
filters.short = !filters.short;
short.toggleClass('lumen-chip--on', filters.short);
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
var list = sourcesFor(collectionsFor(manifest, media), chosen, manifest);
if (!list.length) { pool = []; poolKey = key; done(); return; }

var captured = gen;
var cards = [];
var gate = LC.util.gate(list.length * PAGES, POOL_TIMEOUT, function () {
if (gen !== captured) return;
pool = buildPool(cards, media, true);
poolKey = key;
seen = seenIndex(cards);
done();
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





function paintFrame(card) {





var url = imageUrl(card && card.poster_path, LC.util.posterSize(LC.util.vhPx(REEL_VH)));
var frameNode = reelBox.find('.lumen-roulette__frame');
if (url) frameNode.css('background-image', 'url("' + url + '")');
frameNode.addClass('is-step');


reelBox.addClass('is-live');
}







function frameUrl(card) {
return imageUrl(card && card.backdrop_path, LC.util.scrimSize(LC.util.screenPx()));
}





function showKadr(url) {
try { bg.css('background-image', 'url("' + url + '")'); } catch (e) { }
resultBgShown = true;
enterKadr();
}

function enterKadr() {
if (kadr) return;
kadr = true;



try { scroll.reset(); } catch (e) { }
screen.addClass('is-kadr');
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
try { bg.css('background-image', ''); } catch (e) { }
hint.show();
}




function showEmpty() {
resultBox.empty();
resultBox.addClass('is-live');
resultBox.append($('<div class="lumen-roulette__empty">' + esc(LC.lang('lumen_roulette_empty')) + '</div>'));
hint.hide();
recollect(spinBtn[0]);
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




function paintResult(card) {
resultBox.empty();
resultBox.addClass('is-live');
resultBox.append($('<div class="lumen-roulette__rtitle">' + esc(cardTitle(card)) + '</div>'));
resultBox.append($('<div class="lumen-roulette__rmeta">' + esc(cardMeta(card)) + '</div>'));
var actions = $('<div class="lumen-roulette__actions"></div>');
actions.append(actionNode('lumen_roulette_watch', function () { openCard(card); }));
actions.append(actionNode('lumen_roulette_again', function () { spin(); }));
actions.append(actionNode('lumen_roulette_book', function () { book(card); }));
resultBox.append(actions);
hint.hide();
recollect(actions.find('.lumen-roulette__btn')[0]);
}


















function showResult(card) {
var captured = gen;
result = card;
var live = frame && frame.card === card && frame.ready ? frame : null;
var rect = live ? reelRect() : null;
if (live) {
var started = false;
try {
started = !!(rect && LC.transition && typeof LC.transition.reveal === 'function' && LC.transition.reveal({
rect: rect,
poster: imageUrl(card.poster_path, LC.util.posterSize(LC.util.vhPx(REEL_VH))),
big: live.url
}, {
then: function () {
if (gen !== captured || result !== card) return;
showKadr(live.url);
paintResult(card);
try { LC.transition.stop(); } catch (eStop) { }
}
}));
} catch (e) {
warn('roulette: reveal failed', e);
}
if (started) return;
showKadr(live.url);
}
paintResult(card);
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
Lampa.Favorite.toggle('book', card);
if (Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(LC.lang('lumen_roulette_booked'));
} catch (e) {
warn('roulette: book failed', e);
}
}




function runReel(card, list) {
reel = list;
var plan = spinPlan(reel.length);
var mode = 'full';
try { mode = LC.motionMode(); } catch (e) { }
if (mode !== 'full' || plan.length < 2) {


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
detailsNet = Lampa.Api.sources.tmdb.get(
media + '/' + card.id,
{ langs: 'ru,en' },
function (details) {
if (gen !== captured) return;
detailsNet = null;
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
detailsNet = null;


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
if (started) recollect(null);
}

this.create = function () {
motionClass(root);





root.append(head);
chipsScroll.append(chipsRow);
chipsBox.append(chipsScroll.render());
root.append(chipsBox);
stage.append(reelBox);
stage.append(spinBtn);
stage.append(hint);
root.append(stage);


root.append(resultBox);
watchFocus(spinBtn);
spinBtn.on('hover:enter', function () { spin(); });
scroll.append(root);







scroll.minus();





screen.append(bg);
screen.append(veilL);
screen.append(veilB);
screen.append(scroll.render());
try { self.activity.loader(true); } catch (e) { }
var captured = gen;
LC.manifest.load(function (m) {
if (gen !== captured) return;
build(m);
});
};

this.render = function (js) {
return js ? screen[0] : screen;
};

this.start = function () {
var act = null;
try { act = Lampa.Activity.active(); } catch (eAct) { }
if (act && act.activity && act.activity !== this.activity) return;
started = true;











if (result && !resultBgShown && !resultLoader) prepareFrame(result);
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
right: function () { navMove('right'); },
up: function () {
if (navMove('up')) return;
Lampa.Controller.toggle('head');
},
down: function () { navMove('down'); },
back: function () { Lampa.Activity.backward(); }
});
Lampa.Controller.toggle('content');
};

this.pause = function () { };





this.stop = function () {
started = false;
bump();
};

this.destroy = function () {
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

function open(media) {
try {
Lampa.Activity.push({
url: '',
title: LC.lang('lumen_roulette_title'),
component: 'lumen_roulette',
media: normalizeMedia(media),
page: 1
});
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
sourcesFor: sourcesFor,
parseIds: parseIds,
joinIds: joinIds,
storageKey: storageKey,
normalizeMedia: normalizeMedia,
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
if (!img.naturalWidth || !img.naturalHeight) return null;
try {
var canvas = doc.createElement('canvas');
canvas.width = SAMPLE;
canvas.height = SAMPLE;




var ctx = canvas.getContext('2d', { willReadFrequently: true });
if (!ctx) return null;
ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
return dominant(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data);
} catch (e) {
warn('accent: poster pixels blocked ' + src, e);
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
pending_count++;
request_count++;

function detach() {
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

function fail(src) {
if (!live) return;
warn('accent: poster load failed ' + src);
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
el.onerror = function () { fail(src); };


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
tint: tint,
fromImage: fromImage,
cacheSize: function () { return cache_keys.length; },
pending: function () { return pending_count; },




requests: function () { return request_count; }
};
})();









LC.accent = (function () {

var AUTO_KEY = 'lumen_accent_auto';







var POSTER_SIZE = 't/p/w185';





var DIRECT_HOST = 'https://image.tmdb.org/';
var DIRECT_HOST_MARK = 'image.tmdb.org/';



var override = null;




var themeTokens = null;



var source = null;
var task = null;



function auto() {
var v = LC.pref(AUTO_KEY, false);
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

function sameRgb(a, b) {
if (!a || !b) return !a && !b;
return a.r === b.r && a.g === b.g && a.b === b.b;
}










var accent_css_text = null;

function writeAccentStyle(rules, last) {
if (typeof document === 'undefined') return;
try {
var node = document.getElementById('lumen-accent');
if (!rules) {
if (node && node.parentNode) node.parentNode.removeChild(node);
accent_css_text = null;
return;
}
var born = false;
if (!node) {
node = document.createElement('style');
node.id = 'lumen-accent';
node.type = 'text/css';




(document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(node);
born = true;
} else if (last && node !== document.head.lastChild) {





document.head.appendChild(node);
}





if (born || rules !== accent_css_text) {
node.textContent = rules;
accent_css_text = rules;
}
} catch (e) { warn('accent: style write failed', e); }
}






function paint(last) {
var rules = '';
if (source && LC.enabled() && motionOn() && typeof LC.accentCss === 'function') {
try {
rules = LC.accentCss();
} catch (e) {
warn('accent: rules failed', e);
rules = '';
}
}
writeAccentStyle(rules, last);
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
paint(false);
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
var sameTokens = next && override ? next.color === override.color : (!next && !override);
if (sameTokens && sameRgb(source, rgb || null) && !(deep && applied !== tokenColor())) return;
override = next || null;
source = rgb || null;



if (!LC.enabled()) { paint(); return; }
if (deep && applied !== tokenColor()) {


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
}, url.indexOf(DIRECT_HOST_MARK) === -1 ? DIRECT_HOST + POSTER_SIZE + path : '');
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


function destroy() {
cancel();
var had = !!(override || source || themeTokens);
override = null;
source = null;
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
tint: tint,
applyFor: applyFor,
reset: reset,


restyle: restyle,

repaint: repaint,




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

function cacheRead(imdbId, at) {
try {
var store = storage();
if (!store || !imdbId) return null;
var rec = store.get(cacheKey(imdbId), null);
if (!isFresh(rec, at)) return null;



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



function cardHtml(item, index, mode) {
var likes = item.likes ? '<span class="lumen-review__likes">' + item.likes + ' ' + esc(lang('lumen_card_review_useful')) + '</span>' : '';


var mark = item.spoiler ? '<div class="lumen-review__spoiler">' + esc(lang('lumen_reviews_spoiler')) + '</div>' : '';
var text = mode === 'full' ? '<div class="lumen-review__text">' + item.excerpt + '</div>' : '';
return '<div class="lumen-review selector lumen-review--' + item.tone + '" data-lumen-review="' + index + '">' +
'<div class="lumen-review__tone"></div>' +
'<div class="lumen-review__body">' +
'<div class="lumen-review__top">' +
'<div class="lumen-review__ava">' + item.initials + '</div>' +
'<div class="lumen-review__who">' +
'<div class="lumen-review__author">' + item.author + '</div>' +
'<div class="lumen-review__meta">' +
'<span class="lumen-review__date">' + item.date + '</span>' +
'<span class="lumen-review__tag">' + esc(toneLabel(item.tone)) + '</span>' +
likes +
'</div>' +
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
'<div class="lumen-review-modal__meta">' +
'<span>' + item.date + '</span>' +
'<span class="lumen-review-modal__tag">' + esc(toneLabel(item.tone)) + '</span>' +
(item.likes ? '<span class="lumen-review-modal__likes">' + item.likes + ' ' + esc(lang('lumen_card_review_useful')) + '</span>' : '') +
'</div>' +
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
if (LC.slideshow && typeof LC.slideshow.isLayerForeground === 'function') return !!LC.slideshow.isLayerForeground(node);
} catch (e) { }
return true;
}

function clearBlock(holder) {
try {
var old = holder.find('.lumen-reviews');
if (old && old.length) old.remove();
} catch (e) { }
}




function scrollToCard(block, card) {
try {
var row = block.find('.lumen-reviews__row');
if (!row || !row.length || !card || !card.length) return;
var box = row[0];
var node = card[0];
if (!box || !node || typeof node.offsetLeft !== 'number') return;
var target = node.offsetLeft - (box.clientWidth - node.offsetWidth) / 2;
var max = box.scrollWidth - box.clientWidth;
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

el.addEventListener('hover:focus', function (event) {
try {
var card = cardOf(event.target);
if (card) scrollToCard(block, card);
} catch (e) { warn('reviews focus failed', e); }
}, true);

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
block.html(headHtml(total, mode) + '<div class="lumen-reviews__row">' + cards.join('') + '</div>');
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
return { kind: 'progress', text: (words.cont || '') + ' · ' + whole + ' %', percent: whole };
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

function enabled() {
try { return LC.pref ? !!LC.pref('lumen_badges', true) : true; } catch (e) { return true; }
}



function words() {
return {
soon: LC.lang('lumen_badge_soon'),
fresh: LC.lang('lumen_badge_new'),
cont: LC.lang('lumen_card_continue'),
months: ('' + LC.lang('lumen_card_months_short')).split(',')
};
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
age[0].lumen_rated = true;
var was = '' + age.text();
age.text((was ? was + ' · ' : '') + '★ ' + vote.toFixed(1));
}









function decorate(node, card, opts) {
try {
if (!enabled()) return;
var el = node && node.length ? node[0] : node;
if (!el || el.lumen_badged) return;
var data = card || el.card_data;
if (!data) return;
el.lumen_badged = true;
rate(el, data);
var badge = badgeFor(data, new Date(), { progress: progressOf, words: words() });
if (!badge || !badge.text) return;
var view = $(el).find('.card__view');
if (!view || !view.length) return;
var box = $('<div class="lumen-badge lumen-badge--' + badge.kind + '"></div>');
box.text(badge.text);
view.append(box);
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
for (var i = 0; i < nodes.length; i++) decorate(nodes[i], null, null);
} catch (e) {
warn('badges: scan failed', e);
}
}


function decorateAdded(el) {
if (!el || el.nodeType !== 1) return;
if (el.classList && el.classList.contains('card')) {
decorate(el, null, null);
return;
}
if (typeof el.querySelectorAll !== 'function') return;
var inner = el.querySelectorAll('.card');
for (var i = 0; i < inner.length; i++) decorate(inner[i], null, null);
}

function onMutations(records) {
if (!state) return;
try {
for (var i = 0; i < records.length; i++) {
var added = records[i] && records[i].addedNodes;
if (!added) continue;
for (var k = 0; k < added.length; k++) decorateAdded(added[k]);
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
if (!enabled()) { unmount(); return; }
if (state && state.root && state.root[0] === root[0]) return;
unmount();
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
var nodes = root.find('.card');
for (var i = 0; i < nodes.length; i++) nodes[i].lumen_badged = false;
} catch (e) {
warn('badges: strip failed', e);
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
out.push({ title: w.franchise, subtitle: ctx.collection.name || '', lumen: 'franchise' });
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
var picked = LC.trailer && LC.trailer.pickTrailer ? LC.trailer.pickTrailer(json && json.results) : null;
if (picked && picked.key) play(picked);
else noty('lumen_menu_no_trailer');
});
} catch (e) {
warn('cardmenu: videos request failed', e);
noty('lumen_menu_no_trailer');
}
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
active: active
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
}

function hideMinimap() {
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
if (panel) { schedulePaint(false); return; }
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
items.push({ title: found[i].title || found[i].id, lumen_item: found[i] });
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
r.push(S(['.selectbox .selectbox-item__title']) + '{font-size:.877em;font-weight:600;line-height:1.2}');
















r.push(S(['.selectbox .settings-param-title']) + '{margin:1.052em 5.644em .35em 3.763em;padding:0;border:0;background:none;font-family:' + k.fontBody + ';font-size:.745em;font-weight:700;line-height:1.2;letter-spacing:.08em;text-transform:uppercase;color:' + k.muted + '}');


r.push(S(['.selectbox .settings-param-title > span']) + '{color:' + k.muted + '}');
r.push(S(['.selectbox .selectbox-item__subtitle']) + '{font-size:.877em;font-weight:400;line-height:1.2;margin-top:.2em;color:' + k.muted + ';opacity:1}');








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
r.push(A(['.explorer-card__head-create']) + '{font-family:' + k.fontBody + ';font-size:.877em;letter-spacing:.03em;color:' + k.muted + '}');
r.push(A(['.explorer-card__head-rate']) + '{margin:0 0 0 .614em;color:' + k.accent + '}');
r.push(A(['.explorer-card__head-rate > span']) + '{font-family:' + k.fontBody + ';font-size:.964em;font-weight:600}');
r.push(A(['.explorer-card__head-rate > svg']) + '{display:none !important}');
r.push(A(['.explorer-card__head-rate:before']) + '{content:"";display:block;width:.964em;height:.964em;margin-right:.307em;background-color:currentColor}');
useMask('star', A(['.explorer-card__head-rate:before']));
r.push(A(['.explorer-card__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.666em;line-height:1.06;margin-bottom:.316em}');
r.push(A(['.explorer-card__title.small']) + '{font-size:1.227em}');
r.push(A(['.explorer-card__genres']) + '{font-family:' + k.fontBody + ';font-size:.877em;color:' + k.smoke + ';margin-bottom:.8em}');
r.push(A(['.explorer-card__descr']) + '{font-size:.877em;font-weight:400;line-height:1.45;color:' + k.muted + ';display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}');


r.push(A(['.explorer__files-head']) + '{padding:1.052em 2.805em 0 1.403em}');
r.push(A(chips) + '{font-size:.877em;height:2.8em;padding:0 1em;margin-right:.6em;border-radius:.6em;border:.05em solid ' + k.line + ';background-color:' + k.panel + ';color:' + k.muted + ';font-family:' + k.fontBody + ';font-weight:600;-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-transition:background-color .2s,color .2s,border-color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,color .2s,border-color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
r.push(A(['.torrent-filter .simple-button > span', '.empty__footer .simple-button > span']) + '{margin-top:0}');











r.push(A(chipsFocus) + '{background-color:' + k.text + ';color:' + k.bg + ';-webkit-transform:scale(1.06) !important;transform:scale(1.06) !important;-webkit-box-shadow:0 .23em 0 ' + k.acglow + ';box-shadow:0 .23em 0 ' + k.acglow + '}');

r.push(A(['.torrent-filter .filter--back']) + '{width:2.8em;padding:0;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
r.push(A(['.torrent-filter .filter--back > svg', '.torrent-filter .filter--search > svg']) + '{display:none}');
r.push(A(['.torrent-filter .filter--back:before', '.torrent-filter .filter--search:before']) + '{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.3em;height:1.3em;background-color:currentColor}');
r.push(A(['.torrent-filter .filter--back:before']) + '{-webkit-transform:scaleX(-1);transform:scaleX(-1)}');
useMask('chevronR', A(['.torrent-filter .filter--back:before']));
useMask('search', A(['.torrent-filter .filter--search:before']));
r.push(A(['.torrent-filter .filter--search > div', '.torrent-filter .filter--sort > div']) + '{margin-left:.6em;padding:0;border-radius:0;background:transparent;font-family:' + k.fontBody + ';font-size:1em;font-weight:400;color:' + k.smoke + '}');
r.push(A(['.torrent-filter .filter--search > div']) + '{padding-left:.6em;border-left:.05em solid ' + k.line + ';max-width:15em}');
r.push(A(['.torrent-filter .filter--search.focus > div', '.torrent-filter .filter--sort.focus > div']) + '{color:' + k.bg + ';border-left-color:' + k.bg + '}');


r.push(A(['.torrent-filter .filter--filter > div:not(.hide)']) + '{display:block;-webkit-flex-shrink:0;flex-shrink:0;font-size:1em;width:.5em;height:.5em;margin-left:.5em;padding:0;border-radius:50%;background-color:' + k.accent + ';overflow:hidden;white-space:nowrap;text-indent:2em;color:transparent}');
r.push(A(['.torrent-filter .filter--filter.focus > div:not(.hide)']) + '{background-color:' + k.bg + '}');


r.push(A(['.torrent-list']) + '{padding:0 2.805em 1.403em 1.403em}');
r.push(T(['.torrent-item']) + '{background-color:' + k.panel + ';border:.044em solid ' + k.line + ';border-radius:.438em;padding:.789em;line-height:1.2;color:' + k.text + ';font-family:' + k.fontBody + ';-webkit-transition:border-color .2s,background-color .2s;transition:border-color .2s,background-color .2s}');
r.push(T(['.torrent-item + .torrent-item']) + '{margin-top:.701em}');




r.push(T(['.torrent-item.focus']) + '{background-color:' + k.panelHi + ';border-color:' + k.accent + ';border-width:.132em;padding:.701em;-webkit-box-shadow:0 .2em 0 ' + k.acglow + ';box-shadow:0 .2em 0 ' + k.acglow + '}');
r.push(T(['.torrent-item.focus::after']) + '{border-color:transparent}');
r.push(T(['.torrent-item__title']) + '{font-size:1.052em;font-weight:600;line-height:1.2;word-break:normal;word-wrap:break-word;overflow-wrap:break-word;padding-right:6.667em}');
r.push(T(['.torrent-item__details']) + '{margin-top:.45em;font-size:.877em;font-weight:400;color:' + k.muted + '}');
r.push(T(['.torrent-item__details > div']) + '{margin-right:0}');
r.push(T(['.torrent-item__tracker']) + '{-webkit-box-flex:0;-webkit-flex-grow:0;flex-grow:0}');
r.push(T(['.torrent-item__details > div + div:not(.torrent-item__size):before']) + '{content:"\\00B7";margin:0 .6em;color:' + k.smoke + '}');
r.push(T(['.torrent-item__bitrate > span', '.torrent-item__seeds > span', '.torrent-item__grabs > span']) + '{background:transparent;padding:0;min-width:0;border-radius:0;color:inherit}');

r.push(T(['.torrent-item__size']) + '{position:absolute;top:.9em;right:.9em;margin:0;padding:.35em .7em;border-radius:.35em;background-color:' + k.text + ';color:' + k.dark + ';font-size:1em;font-weight:600;line-height:1}');
r.push(T(['.torrent-item.focus .torrent-item__size']) + '{top:.8em;right:.8em}');

r.push(T(['.torrent-item__ffprobe']) + '{padding-top:.175em}');
r.push(T(['.torrent-item__ffprobe > div']) + '{font-size:.877em;font-family:' + k.fontBody + ';font-weight:400;letter-spacing:.06em;line-height:1;color:' + k.text + ';background:transparent;border:.05em solid rgba(' + k.textRgb + ',.24);border-radius:.35em;padding:.35em .55em;margin:.4em .4em 0 0;-webkit-box-shadow:none;box-shadow:none;outline:0}');
r.push(T(['.torrent-item__ffprobe > div::before']) + '{width:.9em;height:.9em;margin-right:.4em}');
r.push(T(['.torrent-item__ffprobe > div.m-general > div:nth-child(1)', '.torrent-item__ffprobe > div.m-general > div:nth-child(2)']) + '{font-size:1em;padding:0;background:transparent;border-radius:0}');
r.push(T(['.torrent-item__ffprobe > div.m-general > div:nth-child(2)']) + '{padding-left:.4em}');

r.push(T(['.torrent-item__viewed']) + '{top:-.482em;left:-.482em;width:1.578em;height:1.578em;padding:0;border-radius:50%;background-color:' + k.accent + ';color:' + k.onac + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
r.push(T(['.torrent-item__viewed > svg']) + '{display:none}');
r.push(T(['.torrent-item__viewed:before']) + '{content:"";display:block;width:.964em;height:.964em;background-color:currentColor}');
useMask('check', T(['.torrent-item__viewed:before']));


r.push(A(['.watched-history']) + '{background-color:' + k.panelLo + ';border:.044em solid ' + k.line + ';border-radius:.438em;padding:.701em .789em;margin-bottom:.701em;color:' + k.muted + ';font-family:' + k.fontBody + ';-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-transition:border-color .2s;transition:border-color .2s}');
r.push(A(['.watched-history__icon']) + '{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;width:1.578em;height:1.578em;border-radius:.175em;border:.044em solid ' + k.accent + ';background-color:rgba(' + k.accentRgb + ',.16);color:' + k.accent + '}');
r.push(A(['.watched-history__icon > svg']) + '{width:.964em !important;height:.964em !important}');
r.push(A(['.watched-history__body']) + '{padding-left:.614em;font-size:.877em;line-height:1.3}');
r.push(A(['.watched-history__body > span + span::before']) + '{color:' + k.smoke + '}');
r.push(A(['.watched-history.focus']) + '{color:' + k.text + ';border-color:' + k.accent + ';border-width:.132em;padding:.614em .701em;-webkit-box-shadow:0 .2em 0 ' + k.acglow + ';box-shadow:0 .2em 0 ' + k.acglow + '}');
r.push(A(['.watched-history.focus::after']) + '{border-color:transparent}');


r.push(A(['.empty', '.empty-filter']) + '{font-family:' + k.fontBody + ';color:' + k.text + '}');
r.push(A(['.empty__img']) + '{height:7.014em;margin-bottom:1.403em;opacity:.35}');
r.push(A(['.empty__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.227em;line-height:1.2}');
r.push(A(['.empty__descr']) + '{font-size:.877em;line-height:1.45;margin-top:.6em;color:' + k.muted + '}');
r.push(A(['.empty__footer']) + '{margin-top:1.2em}');
r.push(A(['.empty-filter__title']) + '{font-size:.964em;font-weight:600;line-height:1.2;margin-bottom:.3em}');
r.push(A(['.empty-filter__subtitle']) + '{font-size:.877em;font-weight:400;line-height:1.25;margin-bottom:1.2em;color:' + k.muted + '}');
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
r.push(S(['.modal .error__text']) + '{font-size:.964em;font-weight:400;line-height:1.4;margin-top:.35em;color:' + k.muted + '}');

r.push(T(['.torrent-error']) + '{margin-top:1.052em;padding-top:1.052em;border-top:.044em solid ' + k.line + ';font-family:' + k.fontBody + '}');
r.push(T(['.torrent-error > div > div']) + '{font-size:.877em;font-weight:600;line-height:1.2}');
r.push(T(['.torrent-error > div > ul']) + '{margin-top:.4em;font-size:.877em;font-weight:400;line-height:1.3;color:' + k.muted + '}');
r.push(T(['.torrent-error > div > ul > li + li']) + '{margin-top:.4em}');
r.push(T(['.torrent-error > div > ul > li::before']) + '{top:.55em;background-color:' + k.smoke + '}');
r.push(T(['.torrent-error code']) + '{display:block;margin-top:.4em;padding:.5em .7em;border-radius:.35em;background-color:' + k.raised + ';color:' + k.text + ';font-family:' + k.fontBody + ';font-size:1em;word-break:normal;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');

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
r.push(T(['.torrent-install__label']) + '{font-size:.877em;font-weight:600;margin-bottom:.6em}');
r.push(T(['.torrent-install__link']) + '{margin:0 .526em .526em 0;padding:.526em .789em;border-radius:.307em;background-color:' + k.raised + ';color:' + k.text + '}');
r.push(T(['.torrent-install__link > div:first-child']) + '{font-size:.877em;font-weight:500;margin-bottom:.2em}');
r.push(T(['.torrent-install__link > div:last-child']) + '{font-size:.877em;font-family:' + k.fontBody + ';color:' + k.muted + '}');


r.push(T(['.torrent-checklist']) + '{font-family:' + k.fontBody + ';color:' + k.text + '}');
r.push(T(['.torrent-checklist__descr']) + '{font-size:.964em;line-height:1.4;margin-bottom:.5em;color:' + k.muted + '}');
r.push(T(['.torrent-checklist__progress-steps']) + '{font-family:' + k.fontBody + ';font-size:.877em;margin-bottom:.55em;color:' + k.text + '}');
r.push(T(['.torrent-checklist__progress-bar']) + '{height:.175em;margin-bottom:1.403em;border-radius:.088em;background-color:rgba(' + k.textRgb + ',.16);overflow:hidden}');
r.push(T(['.torrent-checklist__progress-bar > div']) + '{height:100%;border-radius:.088em;background-color:' + k.accent + '}');
r.push(T(['.torrent-checklist__steps']) + '{width:44%;padding-right:1.403em}');
r.push(T(['.torrent-checklist__info']) + '{width:56%}');
r.push(T(['.torrent-checklist__list > li']) + '{font-size:.877em;font-weight:400;line-height:1.2;margin-bottom:.45em;color:' + k.smoke + '}');
r.push(T(['.torrent-checklist__list > li.wait']) + '{color:' + k.text + ';font-size:.964em;font-weight:600;margin-bottom:.41em}');
r.push(T(['.torrent-checklist__list > li.wait.check', '.torrent-checklist__list > li.check']) + '{color:' + k.muted + ';font-size:.877em;font-weight:400;margin-bottom:.45em;text-decoration:line-through}');
r.push(T(['.torrent-checklist__info > div']) + '{font-size:.877em;line-height:1.45;color:' + k.muted + '}');
r.push(T(['.torrent-checklist__footer']) + '{margin-top:1.052em;-webkit-box-pack:end;-webkit-justify-content:flex-end;justify-content:flex-end}');
r.push(T(['.torrent-checklist__next-step']) + '{margin-left:1.05em;font-size:.877em;color:' + k.muted + '}');





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
r.push(T(['.torrnet-folder-name']) + '{font-family:' + k.fontBody + ';font-size:.877em;line-height:1.2;padding:.8em 0;color:' + k.muted + ';opacity:.5}');
r.push(T(['.torrnet-folder-name.focus']) + '{opacity:1;color:' + k.accent + '}');
r.push(T(rows) + '{background-color:' + k.panelLo + ';border:.044em solid ' + k.line + ';border-radius:.438em;color:' + k.text + ';font-family:' + k.fontBody + ';-webkit-transition:border-color .2s,background-color .2s;transition:border-color .2s,background-color .2s}');



r.push(T(['.torrent-file.focus', '.torrent-serial.focus']) + '{background-color:' + k.panelHi + ';border-color:' + k.accent + ';border-width:.132em;-webkit-box-shadow:0 .2em 0 ' + k.acglow + ';box-shadow:0 .2em 0 ' + k.acglow + '}');

r.push(T(['.torrent-file']) + '{padding:.701em .789em;overflow:hidden}');
r.push(T(['.torrent-file.focus']) + '{padding:.614em .701em}');
r.push(T(['.torrent-file__title']) + '{font-size:.964em;font-weight:500;line-height:1.25;padding-right:.727em;color:' + k.muted + '}');
r.push(T(['.torrent-file__title .exe']) + '{display:inline;margin-left:.4em;padding:0;border-radius:0;background:transparent;font-family:' + k.fontBody + ';font-size:.909em;font-weight:400;color:' + k.smoke + '}');
r.push(T(['.torrent-file.focus .torrent-file__title']) + '{color:' + k.text + '}');
r.push(T(['.torrent-file.focus .torrent-file__title .exe']) + '{color:' + k.muted + '}');
r.push(T(['.torrent-file__size', '.torrent-serial__size']) + '{font-size:.877em;font-family:' + k.fontBody + ';font-weight:400;line-height:1;padding:.35em .7em;border-radius:.35em;border:.05em solid ' + k.line + ';background-color:' + k.panel + ';color:' + k.muted + '}');
r.push(T(['.torrent-file.focus .torrent-file__size', '.torrent-serial.focus .torrent-serial__size']) + '{color:' + k.text + '}');

r.push(T(['.torrent-file .time-line']) + '{left:0;right:0;bottom:0;margin:0;height:.175em;border-radius:0;background-color:rgba(' + k.textRgb + ',.16)}');
r.push(T(['.torrent-serial .time-line']) + '{margin-top:.35em;height:.175em;border-radius:.088em;background-color:rgba(' + k.textRgb + ',.16);overflow:hidden}');
r.push(T(['.torrent-file .time-line > div', '.torrent-serial .time-line > div']) + '{height:100%;border-radius:.088em;background-color:' + k.accent + '}');

r.push(T(['.torrent-serial']) + '{padding:.526em}');
r.push(T(['.torrent-serial.focus']) + '{padding:.439em}');
r.push(T(['.torrent-serial__img']) + '{width:8.768em;height:4.932em;border-radius:.307em;-webkit-align-self:center;-ms-flex-item-align:center;align-self:center}');
r.push(T(['.torrent-serial__content']) + '{padding:0 .175em 0 .701em}');
r.push(T(['.torrent-serial__title']) + '{font-size:.877em;font-weight:600;line-height:1.25;margin-top:0}');
r.push(T(['.torrent-serial__line']) + '{font-family:' + k.fontBody + ';font-size:.877em;font-weight:400;line-height:1.2;margin-top:.35em;color:' + k.muted + '}');
r.push(T(['.torrent-serial__line b']) + '{font-weight:400}');
r.push(T(['.torrent-serial__line span + span:before']) + '{content:"\\00B7";margin:0 .5em;color:' + k.smoke + '}');
r.push(T(['.torrent-serial__exe']) + '{font-family:' + k.fontBody + ';font-size:.877em;margin-top:.35em;color:' + k.smoke + '}');
r.push(T(['.torrent-serial__episode']) + '{top:1.176em;left:1.176em;padding:.235em .529em;border-radius:.235em;background-color:rgba(0,0,0,.7);font-family:' + k.fontBody + ';font-size:.745em;font-weight:600;line-height:1;color:' + k.text + '}');
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



r.push(T(['.media-loading__status']) + '{bottom:6.5em;padding:.8em 1.4em;border-radius:1.5em;border:.05em solid rgba(' + k.textRgb + ',.24);background-color:rgba(' + k.textRgb + ',.1);-webkit-box-shadow:0 .7em 2em rgba(0,0,0,.35);box-shadow:0 .7em 2em rgba(0,0,0,.35);color:' + k.muted + ';font-family:' + k.fontBody + ';font-size:.877em}');
r.push(T(['.media-loading__peers-value']) + '{color:' + k.muted + '}');
r.push(T(['.media-loading__peers-icon']) + '{display:none}');
r.push(T(['.media-loading__peers:before']) + '{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.3em;height:1.3em;margin-right:.5em;background-color:' + k.accent + '}');
useMask('torrent', T(['.media-loading__peers:before']));
r.push(T(['.media-loading__separator']) + '{width:.05em;height:1.2em;margin:0 1em;border-radius:0;background-color:rgba(' + k.textRgb + ',.2)}');
r.push(T(['.media-loading__percent']) + '{font-size:1.4em;font-weight:600;color:' + k.text + '}');
r.push(SUPPORTS_NO_MASK + T(['.media-loading__peers-icon']) + '{display:block !important;width:1.3em;height:1.3em;margin-right:.5em;color:' + k.accent + ';opacity:1}' + T(['.media-loading__peers:before']) + '{display:none !important}}');
return r;
}

function css() {
var k = LC.tokens();
maskUse = { order: [], by: {} };
return [].concat(selectRules(k), explorerRules(k), modalRules(k), filesRules(k), mediaRules(k), maskRules()).join('\n');
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
node.lumenFranchise = { sign: '', gen: 0, painted: false, net: null, parts: null, movie: null, row: null, list: null };
}
return node.lumenFranchise;
}

function dropNet(state) {
if (!state) return;
if (state.net && typeof state.net.clear === 'function') {
try { state.net.clear(); } catch (e) { }
}
state.net = null;
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
if (LC.slideshow && typeof LC.slideshow.isLayerForeground === 'function') return !!LC.slideshow.isLayerForeground(node);
} catch (e) { }
return true;
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
typeof Lampa.Api.sources.tmdb.get !== 'function') return null;
return Lampa.Api.sources.tmdb.get('collection/' + id, {}, ok, err, { life: LIFE });
} catch (e) {
warn('franchise request failed', e);
return null;
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
dropNet(state);
clearBlock(holder);
row.removeClass('lumen-descr-row--franchise');
state.parts = null;
state.list = null;

if (!collection || !collection.id) return;
state.movie = movie;
state.name = collection.name || '';
state.row = row;

paintSkeleton(holder);

state.net = requestCollection(collection.id, function (json) {
try {
var current = stateOf(holder);
if (current.gen !== gen) return;
current.net = null;
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
current.net = null;
clearBlock(holder);
} catch (e) {
warn('franchise error path failed', e);
}
});






if (!state.net) clearBlock(holder);
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
dropNet(state);
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
if (node && node.lumenFranchise) dropNet(node.lumenFranchise);
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

var FADE_SHARE = 0.4;










var LIFE = 2500;







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




function fade(duration, share) {
var ms = Math.round(duration * share);
return { ms: ms, delay: duration - ms };
}





function motion() {
try { return LC.motionMode(); } catch (e) { return 'full'; }
}

function enabled() {
try { return LC.pref('lumen_transition', true) !== false; } catch (e) { return false; }
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




function idOf(object) {
if (!object) return null;
if (object.id != null) return object.id;
if (object.card && object.card.id != null) return object.card.id;
return null;
}

function sameId(a, b) {
if (a == null || b == null) return false;
return String(a) === String(b);
}









function listen(el, live) {
if (!el || typeof el.addEventListener !== 'function') return;
function done(e) {
if (state !== live) return;
if (e && e.propertyName && e.propertyName !== 'opacity') return;
stop();
}
try {
el.addEventListener('transitionend', done, false);
el.addEventListener('webkitTransitionEnd', done, false);
} catch (err) { }
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



















function show(source, hold) {
var box = screenBox();
var g = geom(source.rect, box);
if (!g) return false;



stop();

var node = $('<div class="lumen-overlay"><div class="lumen-overlay__img"></div></div>');
var img = node.find('.lumen-overlay__img');
var f = fade(DURATION, FADE_SHARE);
var move = DURATION + 'ms ' + EASE;





var dim = 'opacity ' + f.ms + 'ms ease-in ' + f.delay + 'ms';










var webkitTrack = '-webkit-transform ' + move;
var track = 'transform ' + move;
if (!hold) {
webkitTrack += ', ' + dim;
track += ', ' + dim;
}

img.css({
left: Math.round(source.rect.left) + 'px',
top: Math.round(source.rect.top) + 'px',
width: Math.round(source.rect.width) + 'px',
height: Math.round(source.rect.height) + 'px',
'background-image': 'url("' + encodeURI(source.big || source.poster) + '")',




'background-position': '50% 38%',
'-webkit-transition': webkitTrack,
transition: track
});

$('body').append(node);
state = { node: node, img: img, timer: null, frame: 0, hold: !!hold, done: false };
var live = state;












live.frame = raf(function () {
if (state !== live) return;
live.frame = raf(function () {
if (state !== live) return;
live.frame = 0;
var tr = 'translate(' + g.tx + 'px, ' + g.ty + 'px) scale(' + g.scale + ')';
var run = { '-webkit-transform': tr, transform: tr };
if (!live.hold) run.opacity = 0;
img.addClass('is-run').css(run);
});
});





if (!live.hold) {
listen(img[0], live);
live.timer = setTimeout(function () {
if (state !== live) return;
live.timer = null;
stop();
}, LIFE);
}

return true;
}












function rectOf(node) {
try {
if (!node || typeof node.getBoundingClientRect !== 'function') return null;
var r = node.getBoundingClientRect();
if (!r) return null;
return { left: r.left, top: r.top, width: r.width, height: r.height };
} catch (e) {
return null;
}
}



function open(object) {
try {
if (motion() !== 'full') return false;
if (!enabled()) return false;
var last = null;
if (LC.hero && typeof LC.hero.lastFocus === 'function') last = LC.hero.lastFocus();
if (!last || !last.poster) return false;
if (!sameId(idOf(object), last.id)) return false;
var rect = rectOf(last.node);
if (!rect) return false;
return show({ id: last.id, poster: last.poster, big: last.big, rect: rect });
} catch (e) {
warn('transition: open failed', e);
return false;
}
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
if (!show(source, true)) return false;
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
fade: fade,
open: open,
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
var st = storage();
if (st && typeof st.field === 'function') return st.field('lumen_motion');
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

return {
decide: decide,
merge: merge,
normalize: normalize,
mode: mode,


weakHardware: weakHardware,
track: track,
stop: stop,
samples: function () { return samples.slice(); }
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.perf;


/* ---- 69_hud.js ---- */




















LC.hud = (function () {



var state = null;

function format(d) {
return d.fps + ' fps · ' + d.w + '×' + d.h + '@' + d.dpr + ' · ' + d.mode +
' · long ' + d.long + ' · layers ' + d.layers + ' · hw ' + d.hw;
}









function hardware() {
var cores = '?';
var mem = '?';
try {
var nav = window.navigator;
if (nav) {
if (Number(nav.hardwareConcurrency) > 0) cores = Math.round(Number(nav.hardwareConcurrency));
if (typeof nav.deviceMemory !== 'undefined' && nav.deviceMemory !== null && Number(nav.deviceMemory) > 0) {
mem = Number(nav.deviceMemory);
}
}
} catch (e) { }
return cores + 'c/' + (mem === '?' ? '?' : mem + 'gb');
}












var FULL = '.lumen-hero__bg,.lumen-hero__veil,.lumen-hero__trailer,.lumen-fx,' +
'.lumen-backdrop__img,.lumen-backdrop__veil,.lumen-backdrop .lumen-bg__img,' +
'.lumen-ambient,.lumen-ambient__img,.lumen-overlay__img,.lumen-roulette__bg';
function layers() {
try { return document.querySelectorAll(FULL).length; } catch (e) { return 0; }
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










function paint(t) {
if (!state) return;
if (!state.last) {
state.last = t;
state.raf = raf(paint);
return;
}
state.frames++;
var elapsed = t - state.last;
if (elapsed >= 1000) {
var mode = 'n/a';
try { mode = LC.motionMode(); } catch (e) { }





state.node.textContent = format({
fps: Math.round(state.frames * 1000 / elapsed), w: window.innerWidth, h: window.innerHeight,
dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
mode: mode, long: state.long, layers: layers(), hw: hardware()
});
state.frames = 0; state.last = t;
}
state.raf = raf(paint);
}

function start() {
if (state) return;
var node = document.createElement('div');
node.className = 'lumen-hud';
document.body.appendChild(node);
state = { node: node, frames: 0, last: 0, long: 0, raf: 0, obs: null };






try {
if (window.PerformanceObserver && window.PerformanceObserver.supportedEntryTypes &&
window.PerformanceObserver.supportedEntryTypes.indexOf('longtask') > -1) {
state.obs = new window.PerformanceObserver(function (list) {
if (state) state.long += list.getEntries().length;
});
state.obs.observe({ entryTypes: ['longtask'] });
}
} catch (e) { }
state.raf = raf(paint);
}

function stop() {
if (!state) return;
unraf(state.raf);
try { if (state.obs) state.obs.disconnect(); } catch (e2) { }
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
ru: 'В открытой карточке цвет кнопок, колец фокуса и подсветок берётся из постера фильма. На главной от постера под фокусом меняются фон страницы, кольцо вокруг карточки и чипы настроения — когда фокус постоял на карточке 3 секунды; при быстром листании ничего не считается. Тёмный цвет плагин высветляет, чтобы подписи читались; если постер не отдаёт пиксели, остаётся акцент, выбранный выше.',
en: 'Inside an open film card the colour of buttons, focus rings and highlights is taken from the poster. On the home screen the poster under focus changes the page background, the ring around the card and the mood chips — once focus has rested on a card for 3 seconds; fast browsing computes nothing. A dark colour is lightened so that labels stay readable; if the poster does not give up its pixels, the accent chosen above stays in place.',
uk: 'У відкритій картці колір кнопок, кілець фокуса та підсвічувань береться з постера фільму. На головній від постера під фокусом змінюються тло сторінки, кільце навколо картки та чипи настрою — коли фокус постояв на картці 3 секунди; при швидкому гортанні нічого не рахується. Темний колір плагін висвітлює, щоб підписи читалися; якщо постер не віддає пікселі, залишається акцент, вибраний вище.'
},


lumen_transition_name: { ru: 'Переход от постера', en: 'Poster transition', uk: 'Перехід від постера' },
lumen_transition_descr: {
ru: 'При открытии карточки постер, на котором стоял фокус, разворачивается во весь экран и растворяется в кадре фильма. Работает только при полных анимациях; открытие карточки не задерживает.',
en: 'When a card opens, the poster that had focus expands to full screen and dissolves into the film still. Works only with full animations and never delays the card.',
uk: 'Під час відкриття картки постер, на якому стояв фокус, розгортається на весь екран і розчиняється в кадрі фільму. Працює лише за повних анімацій і не затримує відкриття картки.'
},



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
lumen_roulette_unseen: { ru: 'Не смотрел', en: 'Not watched', uk: 'Не дивився' },
lumen_roulette_short_movie: { ru: 'Есть 90 минут', en: '90 minutes to spare', uk: 'Є 90 хвилин' },
lumen_roulette_short_tv: { ru: 'Серия до 30 минут', en: 'Episode under 30 min', uk: 'Серія до 30 хвилин' },
lumen_roulette_hint: {
ru: 'Отметьте подборки и нажмите «Крутить»',
en: 'Tick the collections and press "Spin"',
uk: 'Позначте підбірки і натисніть «Крутити»'
},
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

lumen_scale_name: { ru: 'Масштаб интерфейса', en: 'Interface scale', uk: 'Масштаб інтерфейсу' },
lumen_scale_descr: {
ru: 'Размер текста и блоков на экранах плагина: карточка, главная, подборки. Применяется сразу.',
en: 'The size of text and blocks on the plugin screens: card, home and collections. Applied immediately.',
uk: 'Розмір тексту та блоків на екранах плагіна: картка, головна, підбірки. Застосовується одразу.'
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
ru: '«Авто» — лёгкие анимации на Tizen/webOS, полные на остальных. «Выкл» отключает и появление блоков, и наезд на кадр.',
en: '"Auto" means light animations on Tizen/webOS and full ones elsewhere. "Off" disables both block reveal and the Ken Burns zoom.',
uk: '«Авто» — легкі анімації на Tizen/webOS, повні на інших. «Викл» вимикає і появу блоків, і наїзд на кадр.'
},
lumen_card_motion_auto: { ru: 'Авто', en: 'Auto', uk: 'Авто' },
lumen_card_motion_full: { ru: 'Полные', en: 'Full', uk: 'Повні' },
lumen_card_motion_lite: { ru: 'Лёгкие', en: 'Light', uk: 'Легкі' },
lumen_card_motion_off: { ru: 'Выкл', en: 'Off', uk: 'Викл' },



lumen_fx_heavy_name: { ru: 'Тяжёлые эффекты', en: 'Heavy effects', uk: 'Важкі ефекти' },
lumen_fx_heavy_descr: {
ru: 'Частицы, наезд на кадр, зум заставки, смена кадров в карточке, плавная смена кадра на главной и автотрейлер. На телевизоре выключены по умолчанию: они стоят кадров. Работают только при полных анимациях.',
en: 'Particles, Ken Burns zoom, screensaver zoom, backdrop slideshow, the crossfade on the home screen and the auto trailer. Off by default on a TV: they cost frames. Work only with full animations.',
uk: 'Частинки, наїзд на кадр, зум заставки, зміна кадрів у картці, плавна зміна кадру на головній та автотрейлер. На телевізорі вимкнені за замовчуванням: вони коштують кадрів. Працюють лише за повних анімацій.'
},




lumen_debug_hud_name: { ru: 'Отладка: показать FPS', en: 'Debug: show FPS', uk: 'Налагодження: показати FPS' },
lumen_debug_hud_descr: {
ru: 'Счётчик кадров, длинные задачи, разрешение и режим анимаций в углу экрана. Для проверки на телевизоре.',
en: 'Frame counter, long tasks, resolution and animation mode in the screen corner. For testing on a TV.',
uk: 'Лічильник кадрів, довгі задачі, роздільність та режим анімацій у кутку екрана. Для перевірки на телевізорі.'
},



lumen_card_continue: { ru: 'Продолжить', en: 'Continue', uk: 'Продовжити' },
lumen_card_serial: { ru: 'СЕРИАЛ', en: 'SERIES', uk: 'СЕРІАЛ' },
lumen_card_min: { ru: 'мин', en: 'min', uk: 'хв' },
lumen_card_director: { ru: 'реж.', en: 'dir.', uk: 'реж.' },
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
ru: 'Сколько секунд держится на экране один кадр фона карточки. Действует только при включённом слайдшоу. Применяется сразу.',
en: 'How many seconds a single card background still stays on screen. Works only with the slideshow on. Applied immediately.',
uk: 'Скільки секунд тримається на екрані один кадр тла картки. Діє лише з увімкненим слайдшоу. Застосовується одразу.'
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
lumen_card_reviews_src: { ru: 'КИНОПОИСК', en: 'KINOPOISK', uk: 'КІНОПОШУК' },
lumen_card_review_good: { ru: 'ПОЗИТИВНЫЙ', en: 'POSITIVE', uk: 'ПОЗИТИВНИЙ' },
lumen_card_review_mid: { ru: 'НЕЙТРАЛЬНЫЙ', en: 'NEUTRAL', uk: 'НЕЙТРАЛЬНИЙ' },
lumen_card_review_bad: { ru: 'НЕГАТИВНЫЙ', en: 'NEGATIVE', uk: 'НЕГАТИВНИЙ' },
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

lumen_reviews_spoiler: { ru: 'ЕСТЬ СПОЙЛЕР', en: 'HAS SPOILER', uk: 'Є СПОЙЛЕР' },

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
ru: 'Строка быстрых подборок под описанием на главной: «Вечер пятницы», «Семейный просмотр», «Страшное на ночь», «Есть 90 минут».',
en: 'A row of quick picks under the hero text: "Friday night", "Family time", "Scary at night", "90 minutes to spare".',
uk: 'Рядок швидких підбірок під описом на головній: «Вечір п\'ятниці», «Сімейний перегляд», «Страшне на ніч», «Є 90 хвилин».'
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
ru: 'Фильм показывается в первом ряду, где встретился, а из рядов ниже выпадает — чтобы одна и та же новинка не стояла и в «Сейчас смотрят», и в «В тренде». Ряд, от которого после этого осталась пара карточек, не показывается вовсе; ряды, выбранные вами вручную, и личные ряды остаются на месте.',
en: 'A movie is shown in the first row it appears in and drops out of the rows below, so the same new release does not sit in "Now playing" and "Trending" at once. A row left with just a couple of cards is hidden; rows you picked yourself and personal rows always stay.',
uk: 'Фільм показується в першому ряду, де трапився, а з рядів нижче зникає — щоб та сама новинка не стояла і в «Зараз дивляться», і в «У тренді». Ряд, від якого лишилася пара карток, не показується зовсім; ряди, обрані вами вручну, і особисті ряди лишаються на місці.'
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
ru: 'Какую часть экрана занимает большой кадр с описанием. «Выключен» — ряды на весь экран, чипы настроения остаются. Применяется сразу.',
en: 'How much of the screen the large hero frame takes. "Off" gives the rows the whole screen; the mood chips stay. Applied immediately.',
uk: 'Яку частину екрана займає великий кадр з описом. «Вимкнено» — ряди на весь екран, чипи настрою залишаються. Застосовується одразу.'
},
lumen_hero_size_large: { ru: 'Крупный', en: 'Large', uk: 'Великий' },
lumen_hero_size_medium: { ru: 'Средний', en: 'Medium', uk: 'Середній' },
lumen_hero_size_compact: { ru: 'Компактный', en: 'Compact', uk: 'Компактний' },
lumen_hero_size_off: { ru: 'Выключен', en: 'Off', uk: 'Вимкнено' },



















lumen_hero_trailer_name: { ru: 'Автотрейлер в кадре главной', en: 'Auto-trailer in the home hero', uk: 'Автотрейлер у кадрі головної' },
lumen_hero_trailer_descr: {
ru: 'Кадр над рядами сам сменяется беззвучным трейлером с YouTube, если фокус постоял на карточке 8 секунд. Выключите, если это мешает. Переход на другую карточку ролик снимает, при листании он не запускается вовсе. Нужны полные анимации, включённые тяжёлые эффекты и не выключенный «Трейлер в фоне карточки». Применяется сразу.',
en: 'The hero frame above the rows turns into a muted YouTube trailer by itself once focus has rested on a card for 8 seconds. Turn it off if it gets in the way. Moving to another card removes the clip, and it never starts while you are browsing. Needs full animations, heavy effects on and "Background trailer on the card" not set to Off. Applied immediately.',
uk: 'Кадр над рядами сам змінюється беззвучним трейлером з YouTube, якщо фокус постояв на картці 8 секунд. Вимкніть, якщо це заважає. Перехід на іншу картку ролик знімає, під час гортання він не запускається взагалі. Потрібні повні анімації, увімкнені важкі ефекти і не вимкнений «Трейлер у фоні картки». Застосовується одразу.'
},
lumen_badges_name: { ru: 'Метки на постерах', en: 'Poster badges', uk: 'Мітки на постерах' },
lumen_badges_descr: {
ru: '«Скоро», «Новинка», «Продолжить» и новые серии — прямо на постерах рядов главной и подборок. Применяется сразу.',
en: '"Soon", "New", "Continue" and new episodes right on the posters of home and collection rows. Applied immediately.',
uk: '«Скоро», «Новинка», «Продовжити» та нові серії — просто на постерах рядів головної та підбірок. Застосовується одразу.'
},




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




lumen_moods_no_sources: {
ru: 'Нет источника',
en: 'No source',
uk: 'Немає джерела'
},




lumen_hub_title: { ru: 'Подборки', en: 'Collections', uk: 'Підбірки' },



lumen_hub_search: { ru: 'ПОИСК ПО ПОДБОРКАМ', en: 'SEARCH COLLECTIONS', uk: 'ПОШУК ПО ПІДБІРКАХ' },

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
try { if (LC.accent && LC.accent.repaint) LC.accent.repaint(); } catch (eAccentMotion) { warn('accent repaint failed', eAccentMotion); }
return true;
}






if (name === 'lumen_fx_heavy') {
LC.applyMotionMode();
LC.applySlideshowPref();
return true;
}





if (name === 'lumen_debug_hud') {
try { if (LC.hud) LC.hud.sync(); } catch (eHud) {}
return true;
}
if (name === 'lumen_slideshow' || name === 'lumen_slide_interval') { LC.applySlideshowPref(); return true; }
if (name === 'lumen_menus') { LC.applyMenusPref(); return true; }
if (name === 'lumen_torrents') { LC.applyTorrentsPref(); return true; }
if (name === 'lumen_trailer') { LC.applyTrailerPref(); return true; }




if (name === 'lumen_font') { LC.injectFonts(); LC.injectCss(); return true; }





if (name === 'lumen_theme' || name === 'lumen_solid' || name === 'lumen_scale') { LC.injectCss(); return true; }



if (name === 'lumen_accent_auto') {
try { if (LC.applyAccentPref) LC.applyAccentPref(); } catch (eAccent) {}
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
name === 'lumen_rows_dedupe') {
try { if (LC.applyRowsPref) LC.applyRowsPref(); } catch (eRows) {}
return true;
}


if (name === 'lumen_personal_rows') {
try { if (LC.applyPersonalPref) LC.applyPersonalPref(); } catch (eP) {}
return true;
}



if (name === 'lumen_manifest_url') {
try { if (window.Lampa && Lampa.Storage) Lampa.Storage.set('lumen_manifest', null); } catch (e) {}
try { if (LC.applyRowsPref) LC.applyRowsPref(); } catch (eUrl) {}
return true;
}




if (name === 'lumen_transition') return true;




if (name === 'lumen_roulette_unseen') return true;




if (name === 'lumen_fx') {
try { if (LC.applyFxPref) LC.applyFxPref(); } catch (eFx) {}
return true;
}




if (name === 'lumen_ambient' || name === 'lumen_ambient_source' || name === 'lumen_ambient_delay') {
try { if (LC.applyAmbientPref) LC.applyAmbientPref(); } catch (eAmb) {}
return true;
}
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

var items = [];
var lastGroup = null;
for (var i = 0; i < choices.length; i++) {
var c = choices[i];


if (!c.checked && c.group !== lastGroup) {
lastGroup = c.group;
items.push({ title: groupTitle[c.group] || c.group, separator: true });
}
items.push({ title: c.title, lumen_id: c.id, checkbox: true, checked: c.checked });
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


function onButtonFor(name) {
return function () {
if (name === 'lumen_home_rows') openHomeRows();
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

{ name: 'lumen_group_look', type: 'title', label: 'lumen_card_group_look' },




{ name: 'lumen_card_accent', type: 'select', values: ['sand', 'copper', 'wine', 'garnet', 'mint', 'emerald', 'ice', 'lavender', 'graphite'], vprefix: 'lumen_card_accent_', 'default': 'sand', label: 'lumen_card_accent', descr: 'lumen_card_accent_descr' },








{ name: 'lumen_accent_auto', type: 'trigger', 'default': true, label: 'lumen_accent_auto_name', descr: 'lumen_accent_auto_descr' },






{ name: 'lumen_theme', type: 'select', values: ['warm', 'black'], vprefix: 'lumen_theme_', 'default': 'warm', label: 'lumen_theme_name', descr: 'lumen_theme_descr' },
{ name: 'lumen_solid', type: 'trigger', 'default': false, label: 'lumen_solid_name', descr: 'lumen_solid_descr' },



{ name: 'lumen_scale', type: 'select', values: ['small', 'normal', 'large', 'huge'], vprefix: 'lumen_scale_', 'default': 'normal', label: 'lumen_scale_name', descr: 'lumen_scale_descr' },
{ name: 'lumen_card_fonts', type: 'trigger', 'default': true, label: 'lumen_card_fonts_name', descr: 'lumen_card_fonts_descr' },





{ name: 'lumen_font', type: 'select', values: ['golos', 'onest', 'manrope', 'inter', 'plex'], vprefix: 'lumen_card_font_', 'default': 'golos', label: 'lumen_card_font_name', descr: 'lumen_card_font_descr' },






{ name: 'lumen_group_motion', type: 'title', label: 'lumen_group_motion' },
{ name: 'lumen_motion', type: 'select', values: ['auto', 'full', 'lite', 'off'], vprefix: 'lumen_card_motion_', 'default': 'auto', label: 'lumen_card_motion', descr: 'lumen_card_motion_descr' },






{ name: 'lumen_fx_heavy', type: 'trigger', 'default': function () { return fxHeavyDefault(LC.platformInfo()); }, label: 'lumen_fx_heavy_name', descr: 'lumen_fx_heavy_descr' },




{ name: 'lumen_debug_hud', type: 'trigger', 'default': false, label: 'lumen_debug_hud_name', descr: 'lumen_debug_hud_descr' },




{ name: 'lumen_transition', type: 'trigger', 'default': true, label: 'lumen_transition_name', descr: 'lumen_transition_descr' },










{ name: 'lumen_fx', type: 'select', values: ['all', 'seasonal', 'off'], vprefix: 'lumen_fx_', 'default': 'seasonal', label: 'lumen_fx_name', descr: 'lumen_fx_descr' },

{ name: 'lumen_group_backdrop', type: 'title', label: 'lumen_card_group_backdrop' },
{ name: 'lumen_slideshow', type: 'trigger', 'default': true, label: 'lumen_card_slideshow_name', descr: 'lumen_card_slideshow_descr' },
{ name: 'lumen_slide_interval', type: 'select', values: ['8', '14', '20'], vsuffix: 'lumen_card_seconds', 'default': '14', label: 'lumen_card_slide_interval', descr: 'lumen_card_slide_interval_descr' },
{ name: 'lumen_trailer', type: 'select', values: ['auto', 'on', 'off'], vprefix: 'lumen_card_trailer_', 'default': 'auto', label: 'lumen_card_trailer', descr: 'lumen_card_trailer_descr' },

{ name: 'lumen_group_blocks', type: 'title', label: 'lumen_card_group_blocks' },
{ name: 'lumen_card_progress', type: 'trigger', 'default': true, label: 'lumen_card_progress_name', descr: 'lumen_card_progress_descr' },



{ name: 'lumen_reviews', type: 'trigger', 'default': true, label: 'lumen_card_reviews_name', descr: 'lumen_card_reviews_descr' },




{ name: 'lumen_reviews_mode', type: 'select', values: ['headlines', 'full'], vprefix: 'lumen_reviews_mode_', 'default': 'headlines', label: 'lumen_reviews_mode_name', descr: 'lumen_reviews_mode_descr' },



{ name: 'lumen_kp_key', type: 'input', 'default': '', label: 'lumen_card_kp_key', descr: 'lumen_card_kp_key_descr', placeholder: 'lumen_pref_unset' },




{ name: 'lumen_kp_hint', type: 'trigger', 'default': true, label: 'lumen_kp_hint_name', descr: 'lumen_kp_hint_descr' },







{ name: 'lumen_group_home', type: 'title', label: 'lumen_group_home' },




{ name: 'lumen_hero_size', type: 'select', values: ['large', 'medium', 'compact', 'off'], vprefix: 'lumen_hero_size_', 'default': 'large', label: 'lumen_hero_size_name', descr: 'lumen_hero_size_descr' },












{ name: 'lumen_hero_trailer', type: 'trigger', 'default': true, label: 'lumen_hero_trailer_name', descr: 'lumen_hero_trailer_descr' },
{ name: 'lumen_moods', type: 'trigger', 'default': true, label: 'lumen_moods_name', descr: 'lumen_moods_descr' },
{ name: 'lumen_personal_rows', type: 'trigger', 'default': true, label: 'lumen_personal_rows_name', descr: 'lumen_personal_rows_descr' },







{ name: 'lumen_group_rows', type: 'title', label: 'lumen_group_rows' },




{ name: 'lumen_home_rows', type: 'button', label: 'lumen_home_rows_name', descr: 'lumen_home_rows_descr' },
{ name: 'lumen_rows_limit', type: 'select', values: ['10', '15', '25'], vsuffix: 'lumen_rows_limit_suffix', 'default': '15', label: 'lumen_rows_limit_name', descr: 'lumen_rows_limit_descr' },






{ name: 'lumen_rows_dedupe', type: 'trigger', 'default': true, label: 'lumen_rows_dedupe_name', descr: 'lumen_rows_dedupe_descr' },



{ name: 'lumen_badges', type: 'trigger', 'default': true, label: 'lumen_badges_name', descr: 'lumen_badges_descr' },
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

return { LIST: LIST, find: find, boolOf: boolOf, motionModeFor: motionModeFor, fxHeavyDefault: fxHeavyDefault };
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
var value;
try {
if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') {
value = Lampa.Storage.get(name, def);
}
} catch (e) {
warn('storage read failed: ' + name, e);
}
if (typeof value === 'undefined' || value === null || value === '') return def;
if (typeof def === 'boolean') return LC.prefs.boolOf(value, def);
return value;
};




LC.enabled = function () {
return LC.pref('lumen_enabled', true);
};

LC.motionModeFor = LC.prefs.motionModeFor;

LC.motionMode = function () {
var stored = 'auto';
try {
if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') stored = Lampa.Storage.field('lumen_motion');
} catch (e) { }
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











function renderMeta(root, movie, data) {
var parts = [];
var serial = isSerial(movie);

var release = (movie.release_date || movie.first_air_date || '') + '';
var year = release ? release.slice(0, 4) : '';
if (year) parts.push('<span>' + LC.util.esc(year) + '</span>');




var headText = root.find('.full-start-new__head').text();
var countryText = LC.cardinfo.country(headText, movie.production_countries);
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
} else {
var director = LC.cardinfo.director(data && data.persons && data.persons.crew);
if (director) parts.push('<span>' + LC.util.esc(LC.lang('lumen_card_director')) + ' ' + LC.util.esc(director) + '</span>');
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
node.removeClass('lumen-title--long');
var cls = LC.cardinfo.titleClass(title);
if (cls) node.addClass(cls);
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
root.removeClass('lumen-card--nextchip');

var serial = isSerial(movie);
var text = '';
var when = '';
if (serial) {
var next = LC.cardinfo.nextEpisode(movie.next_episode_to_air, new Date(), dateWords());
if (!next) return;
text = next.text;
when = LC.cardinfo.shortDate(movie.next_episode_to_air.air_date, monthsShort());
} else {
var soon = LC.badges.countdown(movie.release_date, new Date(), countdownWords());
if (!soon) return;
text = soon;
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
if (status.length && !status.hasClass('hide')) root.addClass('lumen-card--nextchip');
}

var EPISODE_STATES = 'lumen-episode--watched lumen-episode--watching lumen-episode--aired lumen-episode--soon';





var STILL_WINDOW = 6;



var EPISODE_EM = 14.9;










function stillSize() {
return LC.util.emPx(EPISODE_EM) * 0.85 > 185 ? 'w300' : 'w185';
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
if (!nodes[i][0].lumenStill) applyStill(nodes[i]);
}
}









function dropStills(nodes, center) {
var from = center - STILL_WINDOW * 2;
var to = center + STILL_WINDOW * 2;
for (var i = 0; i < nodes.length; i++) {
if ((i >= from && i <= to) || !nodes[i][0].lumenStill) continue;
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

function renderEpisodes(root, data) {
var row = root.find('.lumen-episodes');
if (!row.length) return;

var movie = (data && data.movie) || {};
var list = data && data.episodes && data.episodes.episodes;
var sign = episodesSign(list);
var previous = row[0].lumenEpisodes;
if (previous && list && previous.list === list && previous.sign === sign) return;

var track = row.find('.lumen-episodes__track');
row.addClass('hide');
track.empty();
setShift(track, 0);
row[0].lumenEpisodes = null;

if (!isSerial(movie) || !list || !list.length) return;

var season = parseInt(data.episodes.season_number, 10) || parseInt(list[0] && list[0].season_number, 10) || 0;
var key = movie.original_name || movie.original_title || '';
var months = monthsShort();
var now = new Date();
var nodes = [];
var current = -1;


var stillW = stillSize();

for (var i = 0; i < list.length; i++) {
var ep = list[i];
if (!ep || !(ep.episode_number > 0)) continue;
var hash = key && season ? '' + utilsHash([season, season > 10 ? ':' : '', ep.episode_number, key].join('')) : '';
if (hash === '0') hash = '';
var still = LC.cardinfo.imageUrl(ep.still_path, stillW, tmdbImageFn(), apiImgFn());
var node = $('<div class="lumen-episode selector"></div>');
node.attr('data-index', i);
if (hash) node.attr('data-hash', hash);
if (still) node.attr('data-still', still);
node[0].lumenPos = nodes.length;
var st = paintEpisode(node, ep, hash, now, months);
if (current < 0 && st.state === 'watching') current = nodes.length;
track.append(node);
nodes.push(node);
}
if (!nodes.length) return;

row[0].lumenEpisodes = { list: list, nodes: nodes, sign: sign };

loadStills(nodes, 0);
if (current > 0) loadStills(nodes, current);

row.find('.lumen-episodes__title').text(season ? LC.lang('lumen_card_season') + ' ' + season : (data.episodes.name || ''));
row.find('.lumen-episodes__count').text(nodes.length + ' ' + LC.episodesWord(nodes.length));
row.removeClass('hide');
}






function scrollToEpisode(root, node) {
var row = root.find('.lumen-episodes');
var viewport = root.find('.lumen-episodes__viewport')[0];
var track = row.find('.lumen-episodes__track');
if (!viewport || !track.length || !node) return;

var info = row.length ? row[0].lumenEpisodes : null;
if (info && typeof node.lumenPos === 'number') {
loadStills(info.nodes, node.lumenPos);
dropStills(info.nodes, node.lumenPos);
}

var screen = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
var view = screen - viewport.getBoundingClientRect().left;
if (view <= 0) return;

var current = track[0].lumenShift || 0;
var shift = current;
var left = node.offsetLeft;
var width = node.offsetWidth;
var reserve = Math.round(width / 2);

if (left - reserve < shift) shift = left - reserve;
else if (left + width + reserve > shift + view) shift = left + width + reserve - view;
shift = Math.max(0, Math.min(shift, track[0].scrollWidth - view));

if (shift !== current) setShift(track, shift);
}









function bindEpisodes(root) {
var el = root[0];
if (!el || typeof el.addEventListener !== 'function' || el.lumenEpisodesBound) return;
el.lumenEpisodesBound = true;

el.addEventListener('hover:focus', function (e) {
try {
var node = $(e.target).closest('.lumen-episode', el);
if (node.length) {
root.addClass('lumen-compact');
scrollToEpisode(root, node[0]);
} else if ($(e.target).closest('.full-start-new__buttons', el).length) {
root.removeClass('lumen-compact');
}
} catch (err) {
warn('episode focus failed', err);
}
}, true);



el.addEventListener('hover:enter', function (e) {
try {
if (!$(e.target).closest('.lumen-episode', el).length) return;

root.find('.full-start-new__buttons').find('.button--play').not('.hide').eq(0).trigger('hover:enter');
} catch (err) {
warn('episode enter failed', err);
}
}, true);
}




function refreshEpisode(hash) {
hash = '' + (hash || '');
if (!/^\d+$/.test(hash)) return;
var now = new Date();
var months = monthsShort();
$('.lumen-card .lumen-episodes').each(function () {
var info = this.lumenEpisodes;
if (!info) return;
for (var i = 0; i < info.nodes.length; i++) {
var node = info.nodes[i];
if (node.attr('data-hash') !== hash) continue;
var ep = info.list[parseInt(node.attr('data-index'), 10)];
if (ep) paintEpisode(node, ep, hash, now, months);
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
if (existing.length) return;
left.append($('<div class="lumen-descr-more">' + LC.util.esc(LC.lang('lumen_card_descr_more')) + '</div>'));
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

function decorate(root, data) {
if (!root || !root.length) return;
if (!root.hasClass('lumen-card')) return;

var movie = (data && data.movie) || {};

try { renderTitleClass(root, movie); } catch (e) { warn('title failed', e); }
try { renderMeta(root, movie, data); } catch (e) { warn('meta failed', e); }
try { renderStatus(root, movie); } catch (e) { warn('status failed', e); }
try { renderSerialMode(root, movie); } catch (e) { warn('serial mode failed', e); }
try { renderNextChip(root, movie); } catch (e) { warn('next episode chip failed', e); }
try { renderReactionsChip(root, data); } catch (e) { warn('reactions chip failed', e); }
try { renderQualityChips(root, movie); } catch (e) { warn('quality chips failed', e); }
try { renderProgress(root, movie, (data && data.episodes && data.episodes.episodes) || null); } catch (e) { warn('progress failed', e); }
try { renderEpisodes(root, data); } catch (e) { warn('episodes failed', e); }
try { bindEpisodes(root); } catch (e) { warn('episodes bind failed', e); }
}

LC.header = {
decorate: decorate,
descr: renderDescrRow,
refreshEpisode: refreshEpisode,
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
try { return $('.activity--active .lumen-card'); } catch (e) { return null; }
}











function activeBackdropLayer() {
try { return $('.activity--active .lumen-backdrop'); } catch (e) { return null; }
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




LC.applyMotionMode = function () {
applyMotionMode(activeCardRoot());
applyMotionMode(activeBackdropLayer());
if (ui_active) {
applyMotionMode(bodyRoot());


applyFxHeavy();
}



try { applyMotionMode($('.activity--active .lumen-hub')); } catch (eHub) {}
try { applyMotionMode($('.activity--active .lumen-grid')); } catch (eGrid) {}




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










try {
if (LC.transition) {
if (e.component === 'full') LC.transition.open(e.object);
else LC.transition.stop();
}
} catch (eTrans) {
warn('transition start failed', eTrans);
}
var startRender = null;
try {
if (e.object && e.object.activity && typeof e.object.activity.render === 'function') startRender = e.object.activity.render();
} catch (eRender) {}
try {
if (LC.hero) {
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
if (e.type === 'build' && e.name === 'start') {
LC.header.decorate(findRoot(e), e.data);
} else if (e.type === 'build' && e.name === 'description') {




var descrRow = findDescrRow(e);
LC.header.descr(descrRow, e.data);
LC.reviews.render(descrRow, e.data);


LC.franchise.render(descrRow, e.data);
} else if (e.type === 'complite') {
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
var row = $('.activity--active .lumen-descr-row');
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




if (!chip && !row) chip = $('.activity--active .lumen-card .rate--kp');
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
LC.menus.mode(Lampa.Storage.field('lumen_menus'));
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
LC.menus.mode(Lampa.Storage.field('lumen_menus'));
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
if (LC.rows && LC.rows.register && LC.manifest && LC.manifest.load) {
LC.manifest.load(function (m) {
if (!activated || !LC.rows || !LC.rows.register) return;
LC.rows.register(m);


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
if (LC.personal && LC.personal.register) LC.personal.register();
} catch (ePersonal) {
warn('personal rows register failed', ePersonal);
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


if (body && body.length) body.removeClass(MOTION_CLASSES).removeClass('lumen-fx-heavy');
} catch (e3) {
warn('motion class off failed', e3);
}
stripAllCards();



try { if (LC.rows && LC.rows.unregister) LC.rows.unregister(); } catch (eRows) {}


try { if (LC.rows && LC.rows.uninstallDedupe) LC.rows.uninstallDedupe(); } catch (eDedupeOff) {}


home_repaired = false;

try { if (LC.personal && LC.personal.unregister) LC.personal.unregister(); } catch (ePersonalOff) {}

try { if (LC.hub && LC.hub.uninstall) LC.hub.uninstall(); } catch (eHubOff) {}


try { if (LC.hero && LC.hero.unmount) LC.hero.unmount(); } catch (eHeroOff) {}

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
Lampa.Activity.replace();
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
if (LC.rows && LC.rows.register && LC.manifest && LC.manifest.load) {
LC.manifest.load(function (m) {
if (!activated || !LC.rows || !LC.rows.register) return;
LC.rows.register(m);


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
LC.injectCss();
if (LC.hero) {
if (LC.pref('lumen_hero_size', 'large') === 'off') {
if (LC.hero.unmount) LC.hero.unmount();
} else if (LC.hero.mountCurrent) {
LC.hero.mountCurrent();
}
}
if (LC.moods && LC.moods.mountCurrent) LC.moods.mountCurrent();
} catch (e) {
warn('hero size pref failed', e);
}
};













LC.applyBadgesPref = function () {
if (!activated) return;
try {
if (!LC.badges) return;
if (LC.pref('lumen_badges', true)) LC.badges.install();
else LC.badges.uninstall();
LC.injectCss();
} catch (e) {
warn('badges pref failed', e);
}
};













function fxLayerOf(body) {
if (!body || typeof body.children !== 'function') return null;
var layer = body.children('.lumen-backdrop');
if (!layer || !layer.length) return null;
return layer;
}




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
if (LC.personal && LC.personal.unregister) LC.personal.unregister();
if (LC.personal && LC.personal.register) LC.personal.register();


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
