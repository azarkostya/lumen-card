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

var PLUGIN = 'lumen_card';


function warn(msg, err) {
try { if (typeof window !== 'undefined' && window.console && console.log) console.log('[lumen-card] ' + msg, err || ''); } catch (e) { }
}


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

return {
esc: esc,
pad2: pad2,
plural: plural,
initials: initials,
fmtTime: fmtTime,
fmtRuntime: fmtRuntime,
daysUntil: daysUntil,
each: each,
map: map,
filter: filter,
find: find
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

var NO_MASK = '@supports not ((-webkit-mask-image:none) or (mask-image:none))';
return { get: get, names: names, forButton: forButton, maskSvg: maskSvg, maskUrl: maskUrl, css: css, NO_MASK: NO_MASK };
})();





if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.icons;


/* ---- 30_css.js ---- */




var STYLE_ID = 'lumen-card-css';
var FONTS_ID = 'lumen-card-fonts';
var FONTS_URL = 'https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Golos+Text:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap';

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
chipBg: 'rgba(28,22,19,.78)',
buttonBg: 'rgba(28,22,19,.82)',


panelHi: '#221A13',
panelLo: '#17120F',
raised: '#241C17'
};



var ACCENTS = {
sand: { color: '#E8B87A', light: '#FFF2DC', glow: 'rgba(232,184,122,0.35)', onac: '#1A120A' },
ice: { color: '#7FB7C9', light: '#DCF1F8', glow: 'rgba(127,183,201,0.35)', onac: '#08171C' },
wine: { color: '#C46A8F', light: '#F8DCE7', glow: 'rgba(196,106,143,0.35)', onac: '#1C0A12' },
mint: { color: '#9FCF8A', light: '#E7F8DC', glow: 'rgba(159,207,138,0.35)', onac: '#0C1608' }
};



function hexToRgb(hex) {
hex = ('' + hex).replace('#', '');
var r = parseInt(hex.substring(0, 2), 16);
var g = parseInt(hex.substring(2, 4), 16);
var b = parseInt(hex.substring(4, 6), 16);
return r + ',' + g + ',' + b;
}



var SPICE_RGB = hexToRgb(C.spice);

var FONT_DISPLAY_ON = '"Unbounded","Arial Black",Impact,sans-serif';
var FONT_BODY_ON = '"Golos Text","Segoe UI",Roboto,Arial,sans-serif';
var FONT_MONO_ON = '"JetBrains Mono",Consolas,"Courier New",monospace';
var FONT_DISPLAY_OFF = '"Arial Black",Impact,sans-serif';
var FONT_BODY_OFF = 'inherit';
var FONT_MONO_OFF = 'Consolas,"Courier New",monospace';

function theme() {
var key = LC.pref(PLUGIN + '_accent', 'sand');
return ACCENTS[key] || ACCENTS.sand;
}

function useFonts() {
return LC.pref(PLUGIN + '_fonts', true);
}




LC.tokens = function () {
var t = theme();
var fonts = useFonts();
return {
bg: C.bg, panel: C.panel, line: C.line, text: C.text, muted: C.muted, smoke: C.smoke,
spice: C.spice, dark: C.dark,
panelHi: C.panelHi, panelLo: C.panelLo, raised: C.raised, textRgb: hexToRgb(C.text), bgRgb: hexToRgb(C.bg),
accent: t.color, accentRgb: hexToRgb(t.color), onac: t.onac, ring: t.light, acglow: t.glow,
fontDisplay: fonts ? FONT_DISPLAY_ON : FONT_DISPLAY_OFF,
fontBody: fonts ? FONT_BODY_ON : FONT_BODY_OFF,
fontMono: fonts ? FONT_MONO_ON : FONT_MONO_OFF
};
};

LC.buildCss = function () {
var t = theme();
var A = t.color;
var AL = t.light;
var AG = t.glow;
var A_RGB = hexToRgb(A);
var fonts = useFonts();
var FD = fonts ? FONT_DISPLAY_ON : FONT_DISPLAY_OFF;
var FB = fonts ? FONT_BODY_ON : FONT_BODY_OFF;
var FM = fonts ? FONT_MONO_ON : FONT_MONO_OFF;

var css = [];


css.push('.lumen-backdrop{position:absolute;top:0;left:0;width:100%;height:100vh;z-index:-1;overflow:hidden;opacity:0;-webkit-transition:opacity .5s ease;transition:opacity .5s ease;pointer-events:none}');
css.push('.lumen-backdrop.loaded{opacity:1}');
css.push('.lumen-backdrop__img{position:absolute;top:0;left:0;right:0;bottom:0;background-position:72% 32%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover}');










css.push('.lumen-backdrop .lumen-bg__img{position:absolute;top:0;right:0;bottom:0;left:0;background-position:72% 32%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover;opacity:0;-webkit-transition:opacity 1.2s ease-in-out;transition:opacity 1.2s ease-in-out}');
css.push('.lumen-backdrop .lumen-bg__img.is-active{opacity:1}');
css.push('.lumen-backdrop__veil{position:absolute;top:0;left:0;right:0;bottom:0}');
css.push('.lumen-backdrop__veil--l{background:linear-gradient(90deg,rgba(11,9,8,0.96) 0%,rgba(11,9,8,0.88) 30%,rgba(11,9,8,0.35) 58%,rgba(11,9,8,0) 82%)}');
css.push('.lumen-backdrop__veil--b{background:linear-gradient(0deg,rgba(11,9,8,0.98) 0%,rgba(11,9,8,0.60) 28%,rgba(11,9,8,0) 60%)}');
css.push('.lumen-backdrop__veil--t{background:linear-gradient(180deg,rgba(11,9,8,0.70) 0%,rgba(11,9,8,0) 22%)}');

css.push('.lumen-backdrop--proc0 .lumen-backdrop__img{background:radial-gradient(ellipse 56% 57% at 72% 58%,rgba(255,214,150,0.85) 0%,rgba(232,150,80,0.40) 28%,rgba(232,150,80,0) 70%),linear-gradient(180deg,#1A0D08 0%,#7A2E12 42%,#D9622B 60%,#E8B87A 78%,#3A2418 100%)}');
css.push('.lumen-backdrop--proc1 .lumen-backdrop__img{background:radial-gradient(ellipse 52% 52% at 74% 52%,rgba(238,214,120,0.78) 0%,rgba(200,170,70,0.35) 30%,rgba(200,170,70,0) 70%),linear-gradient(180deg,#0F1210 0%,#3A3E22 45%,#B99A3A 66%,#6E5A24 82%,#17140E 100%)}');
css.push('.lumen-backdrop--proc2 .lumen-backdrop__img{background:radial-gradient(ellipse 58% 55% at 68% 54%,rgba(190,214,236,0.70) 0%,rgba(120,150,190,0.32) 30%,rgba(120,150,190,0) 70%),linear-gradient(180deg,#07090E 0%,#1B2536 44%,#46617F 64%,#8FA6BC 80%,#181C22 100%)}');










css.push('.lumen-backdrop.lumen-bg--blur{background:linear-gradient(160deg,#2A1B10 0%,#1A110B 38%,#0B0908 72%)}');
css.push('.lumen-backdrop.lumen-bg--blur .lumen-backdrop__img{background-position:50% 50%;opacity:.8}');
css.push('.lumen-backdrop.lumen-motion-full.lumen-bg--blur .lumen-backdrop__img{-webkit-filter:blur(1.75em);filter:blur(1.75em);-webkit-transform:scale(1.1);transform:scale(1.1)}');
css.push('.lumen-backdrop.lumen-motion-lite.lumen-bg--blur .lumen-backdrop__img,.lumen-backdrop.lumen-motion-off.lumen-bg--blur .lumen-backdrop__img{-webkit-transform:none;transform:none}');
css.push('.full-start__background.lumen-off{display:none !important}');



css.push('.full-start-new.lumen-card{position:relative;padding:0 2.81em 2.81em;color:' + C.text + ';font-family:' + FB + '}');
css.push('.lumen-card .full-start-new__left{display:none !important}');








css.push('.lumen-card.lumen-card--poster .full-start-new__left{display:block !important;-webkit-box-ordinal-group:2;-webkit-order:1;order:1;-webkit-align-self:flex-start;-ms-flex-item-align:start;align-self:flex-start;-webkit-flex-shrink:0;flex-shrink:0;width:16.66em;margin:6.14em 0 0 2.63em}');
css.push('.lumen-card.lumen-card--poster .full-start-new__poster{border-radius:.61em;overflow:hidden;background:linear-gradient(180deg,' + C.panel + ',#0E0B09);border:.04em solid ' + C.line + ';box-shadow:0 .88em 2.63em rgba(0,0,0,.6)}');
css.push('.lumen-card.lumen-card--poster .full-start-new__img{border-radius:.61em}');
css.push('.lumen-card.lumen-card--poster .lumen-poster-tmdb{position:absolute;left:0;right:0;bottom:0;padding:0 1.05em 1.05em;font-family:' + FD + ';font-weight:600;font-size:.88em;line-height:1.3;color:' + C.smoke + '}');
css.push('.lumen-card .full-start-new__body{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:end;-webkit-align-items:flex-end;align-items:flex-end;min-height:74vh}');
css.push('.lumen-card .full-start-new__right{-webkit-box-flex:1;-webkit-flex-grow:1;flex-grow:1;min-width:0}');

















css.push('.lumen-card .lumen-content{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:end;-webkit-align-items:end;align-items:end;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-auto-rows:auto;grid-column-gap:2.63em;column-gap:2.63em}');
css.push('.lumen-card .lumen-content > .lumen-in{grid-column:1;max-width:52em}');


css.push('.lumen-card .lumen-content > .lumen-side{grid-column:2;grid-row:1 / 7;align-self:end;-webkit-flex-shrink:0;flex-shrink:0;text-align:right;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-align:end;-webkit-align-items:flex-end;align-items:flex-end}');









css.push('@supports not (display:grid){.lumen-card .lumen-content > .lumen-in{width:100%}.lumen-card .lumen-content > .lumen-in:nth-child(6){width:auto;-webkit-box-flex:0;-webkit-flex:0 1 auto;flex:0 1 auto}.lumen-card .lumen-content > .lumen-side{margin-left:auto}}');


css.push('.lumen-card .full-start-new__tagline,.lumen-card .full-start-new__reactions,.lumen-card .lumen-keep{display:none !important}');
css.push('.lumen-card.lumen--meta .full-start-new__head,.lumen-card.lumen--meta .full-start-new__details{display:none !important}');
css.push('.lumen-card .full-start__pg{display:none !important}');


css.push('.lumen-card .lumen-meta{font-family:' + FM + ';font-size:.88em;color:' + C.muted + ';letter-spacing:.03em;line-height:1.3;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
css.push('.lumen-card .lumen-meta > *{margin:0 .53em .2em 0}');
css.push('.lumen-card .lumen-meta__sep{color:' + C.line + '}');




css.push('.lumen-card .full-start-new__title{font-family:' + FD + ';font-size:3.86em;font-weight:800;line-height:1.02;letter-spacing:-.015em;margin:.70em 0 0 -.02em}');


css.push('.lumen-card .full-start-new__title.lumen-title--long{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:2;line-clamp:2}');
css.push('.lumen-card .lumen-original{font-family:' + FM + ';font-size:.88em;color:' + C.smoke + ';margin-top:.53em;overflow:hidden;white-space:nowrap;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
css.push('.lumen-card .lumen-original:empty{display:none}');


css.push('.lumen-card .lumen-descr{font-size:1.05em;line-height:1.45;color:' + C.muted + ';max-width:42.96em;margin-top:.88em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical}');


css.push('.lumen-card .full-start-new__rate-line{margin:1.05em 0 0;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:stretch;-webkit-align-items:stretch;align-items:stretch;-webkit-flex-wrap:wrap;flex-wrap:wrap}');




css.push('.lumen-card .full-start-new__rate-line > *{margin:0 .53em .53em 0 !important}');
css.push('.lumen-card .full-start__rate{font-family:' + FM + ';background:' + C.chipBg + ';border:.04em solid ' + C.line + ';border-radius:.53em;padding:.44em .70em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
css.push('.lumen-card .full-start__rate > div:first-child{display:block;width:auto;height:auto;background:transparent;border-radius:0;font-size:1.23em;font-weight:600;line-height:1;color:' + C.text + '}');
css.push('.lumen-card .full-start__rate > div:last-child{font-size:.61em;letter-spacing:.1em;color:' + C.smoke + ';padding:.18em 0 0}');

css.push('.lumen-card .lumen-reactions-chip{font-family:' + FM + ';background:rgba(' + SPICE_RGB + ',.12);border:.04em solid rgba(' + SPICE_RGB + ',.5);border-radius:.53em;padding:.44em .70em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
css.push('.lumen-card .lumen-reactions-chip__value{font-size:1.23em;font-weight:600;line-height:1;color:' + C.spice + '}');
css.push('.lumen-card .lumen-reactions-chip__label{font-size:.61em;letter-spacing:.1em;opacity:.8;color:' + C.spice + ';padding:.18em 0 0}');





css.push('.lumen-card .full-start-new__rate-line .tag--episode{display:none !important}');
css.push('.lumen-card .lumen-next-chip{font-family:' + FB + ';font-weight:500;font-size:.79em;line-height:1;color:' + C.text + ';background:' + C.chipBg + ';border:.05em solid ' + C.line + ';border-radius:.67em;padding:0 .89em;white-space:nowrap;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card .lumen-next-chip:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.22em;height:1.22em;margin-right:.56em;background-color:' + C.muted + ';-webkit-mask-image:' + LC.icons.maskUrl('clock') + ';mask-image:' + LC.icons.maskUrl('clock') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain}');



css.push('.lumen-card.lumen-card--serial .full-start-new__rate-line .full-start__status{font-family:' + FB + ';font-weight:500;font-size:.79em;line-height:1;letter-spacing:normal;text-transform:none;color:' + C.text + ';background:' + C.chipBg + ';border:.05em solid ' + C.line + ';border-radius:.67em;padding:0 .89em;white-space:nowrap;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card.lumen-card--serial .full-start-new__rate-line .full-start__status:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:.56em;height:.56em;border-radius:50%;background:currentColor;margin-right:.56em}');


css.push('.lumen-card .lumen-progress{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;width:33.32em;max-width:100%;margin-top:1.05em;font-family:' + FM + ';font-size:1em;color:' + C.muted + ';letter-spacing:.04em}');
css.push('.lumen-card .lumen-progress__label{-webkit-flex-shrink:0;flex-shrink:0;font-size:.79em;color:' + C.text + '}');
css.push('.lumen-card .lumen-progress__bar{-webkit-box-flex:1;-webkit-flex-grow:1;flex-grow:1;height:.18em;background:rgba(243,237,228,0.16);border-radius:.09em;overflow:hidden;margin:0 1.1em}');
css.push('.lumen-card .lumen-progress__bar > div{height:100%;width:0;background:' + A + '}');
css.push('.lumen-card .lumen-progress__time{-webkit-flex-shrink:0;flex-shrink:0;font-size:.79em}');




css.push('.lumen-card .full-start-new__buttons{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-top:1.40em;overflow:visible}');



css.push('.lumen-card .full-start-new__buttons .full-start__button{font-size:1em;font-weight:600;height:3.16em;min-width:3.16em;padding:0 1.32em;margin:0 .70em .6em 0;border-radius:.79em;border:.04em solid ' + C.line + ';background:' + C.buttonBg + ';-webkit-backdrop-filter:blur(.88em);backdrop-filter:blur(.88em);color:' + C.text + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;-webkit-transition:width .2s,padding .2s,background-color .2s,border-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),-webkit-box-shadow .28s;transition:width .2s,padding .2s,background-color .2s,border-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),box-shadow .28s}');
css.push('.lumen-card .full-start-new__buttons .full-start__button > svg{width:1.14em;height:1.14em;-webkit-flex-shrink:0;flex-shrink:0}');
css.push('.lumen-card .full-start-new__buttons .full-start__button > svg + span{font-size:1.05em;margin:0 0 0 .53em;line-height:1}');
css.push('.lumen-card .full-start-new__buttons .full-start__button span{display:none}');
css.push('.lumen-card .full-start-new__buttons .button--play span,.lumen-card .full-start-new__buttons .button--priority span{display:block}');






css.push('.lumen-card .full-start-new__buttons .full-start__button.active{background:rgba(' + A_RGB + ',.16);border-color:' + A + ';color:' + A + '}');


css.push('.lumen-card .full-start-new__buttons .button--book,.lumen-card .full-start-new__buttons .button--reaction,.lumen-card .full-start-new__buttons .button--subscribe,.lumen-card .full-start-new__buttons .button--options{padding:0;width:3.16em}');
css.push('.lumen-card .full-start-new__buttons .button--book.focus,.lumen-card .full-start-new__buttons .button--reaction.focus,.lumen-card .full-start-new__buttons .button--subscribe.focus,.lumen-card .full-start-new__buttons .button--options.focus{width:auto;padding:0 1.05em}');
css.push('.lumen-card .full-start-new__buttons .full-start__button.focus span{display:block}');



css.push('.lumen-card .full-start-new__buttons .full-start__button.focus{background:' + A + ';color:' + C.dark + ';border-color:' + AL + ';border-width:.11em;-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .614em 1.754em ' + AG + ';box-shadow:0 .614em 1.754em ' + AG + '}');


css.push('.lumen-card .full-start-new__buttons .full-start__button.focus.lumen-press{background:#C4924F !important;border-color:rgba(255,242,220,.6) !important;-webkit-transform:scale(1) !important;transform:scale(1) !important}');
css.push('.lumen-card .full-start-new__buttons .full-start__button.loading:before{filter:none}');








css.push('.lumen-card .lumen-side .full-start__status{font-family:' + FB + ';font-weight:500;font-size:.79em;letter-spacing:normal;text-transform:none;background:' + C.chipBg + ';border:.04em solid ' + C.line + ';border-radius:1.32em;padding:.35em .70em;margin-bottom:1.05em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;color:' + C.text + '}');
css.push('.lumen-card .lumen-side .full-start__status:before{content:"";display:block;width:.44em;height:.44em;border-radius:50%;background:currentColor;margin-right:.44em}');
css.push('.lumen-card .lumen-status--good:before{color:' + C.good + '}');
css.push('.lumen-card .lumen-status--accent:before{color:' + A + '}');
css.push('.lumen-card .lumen-status--muted:before,.lumen-card .lumen-status--soon:before{color:' + C.smoke + '}');
css.push('.lumen-card .lumen-tags{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-pack:end;-webkit-justify-content:flex-end;justify-content:flex-end}');
css.push('.lumen-card .lumen-tags .full-start__tag{display:none !important}');
css.push('.lumen-card .lumen-quality-chip{font-family:' + FM + ';font-size:.66em;letter-spacing:.08em;color:' + C.text + ';border:.04em solid rgba(243,237,228,.24);border-radius:.31em;padding:.31em .48em;margin:0 0 .35em .35em;white-space:nowrap}');
css.push('.lumen-card .lumen-cast{margin-top:1.05em}');
css.push('.lumen-card .lumen-cast__label{font-size:.79em;color:' + C.smoke + ';margin-bottom:.53em}');
css.push('.lumen-card .lumen-cast__row{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-pack:end;-webkit-justify-content:flex-end;justify-content:flex-end}');
css.push('.lumen-card .lumen-cast__item{font-family:' + FB + ';font-size:.88em;font-weight:500;width:2.72em;height:2.72em;border-radius:50%;background:' + C.panel + ';border:.13em solid ' + C.bg + ';margin-left:-.61em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;color:' + C.muted + ';overflow:hidden}');
css.push('.lumen-card .lumen-cast__row .lumen-cast__item:first-child{margin-left:0}');
css.push('.lumen-card .lumen-cast__more{font-family:' + FM + ';font-weight:600;font-size:.75em;color:' + C.smoke + '}');

css.push('.lumen-card.lumen-card--serial .lumen-cast{display:none}');







css.push('.lumen-card .lumen-episodes{margin-top:1.75em}');
css.push('.lumen-card .lumen-episodes__head{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline;margin-bottom:.79em}');
css.push('.lumen-card .lumen-episodes__title{font-family:' + FD + ';font-weight:700;font-size:1.23em;line-height:1;color:' + C.text + ';margin-right:.5em}');
css.push('.lumen-card .lumen-episodes__count{font-family:' + FM + ';font-size:.70em;line-height:1;letter-spacing:.12em;text-transform:uppercase;color:' + C.smoke + '}');
css.push('.lumen-card .lumen-episodes__viewport{position:relative;height:6.58em}');
css.push('.lumen-card .lumen-episodes__track{position:absolute;top:0;left:0;height:100%;display:-webkit-box;display:-webkit-flex;display:flex}');
css.push('.lumen-card .lumen-episode{position:relative;-webkit-box-sizing:border-box;box-sizing:border-box;width:14.9em;height:6.58em;margin-right:.70em;-webkit-box-flex:0;-webkit-flex:none;flex:none;border-radius:.61em;padding:.79em;overflow:hidden;background:linear-gradient(180deg,#0C0D0F,#161825);border:.04em solid ' + C.line + ';color:' + C.text + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between}');
css.push('.lumen-card .lumen-episode__still{position:absolute;top:0;right:0;bottom:0;left:0;background-position:50% 50%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover;opacity:.28}');
css.push('.lumen-card .lumen-episode__top{position:relative;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between;-webkit-box-align:center;-webkit-align-items:center;align-items:center;min-height:1.40em}');
css.push('.lumen-card .lumen-episode__num{font-family:' + FM + ';font-weight:600;font-size:.75em;line-height:1;letter-spacing:.1em;color:' + C.smoke + '}');
css.push('.lumen-card .lumen-episode__check{width:.88em;height:.88em;background-color:' + C.good + ';-webkit-mask-image:' + LC.icons.maskUrl('check') + ';mask-image:' + LC.icons.maskUrl('check') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain}');
css.push('.lumen-card .lumen-episode__percent{font-family:' + FM + ';font-size:.66em;line-height:1;color:' + A + '}');
css.push('.lumen-card .lumen-episode__play{display:none;position:relative;width:1.40em;height:1.40em;border-radius:50%;background:' + A + '}');
css.push('.lumen-card .lumen-episode__play:before{content:"";position:absolute;top:50%;left:50%;width:.75em;height:.75em;margin:-.375em 0 0 -.33em;background-color:' + C.dark + ';-webkit-mask-image:' + LC.icons.maskUrl('play') + ';mask-image:' + LC.icons.maskUrl('play') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain}');
css.push('.lumen-card .lumen-episode__bottom{position:relative;min-width:0}');
css.push('.lumen-card .lumen-episode__name{font-family:' + FB + ';font-weight:500;font-size:.96em;line-height:1.2;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
css.push('.lumen-card .lumen-episode__caption{font-family:' + FM + ';font-size:.70em;line-height:1;color:' + C.smoke + ';margin-top:.44em;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
css.push('.lumen-card .lumen-episode__bar{height:.18em;border-radius:.09em;background:rgba(243,237,228,.16);margin-top:.44em;overflow:hidden}');
css.push('.lumen-card .lumen-episode__bar > div{height:100%;border-radius:.09em;background:' + A + '}');


css.push('.lumen-card .lumen-episode--watched{opacity:.6}');
css.push('.lumen-card .lumen-episode--watching{background:linear-gradient(180deg,#171310,#221A13);border-color:#303552}');
css.push('.lumen-card .lumen-episode--watching .lumen-episode__num{color:' + A + '}');
css.push('.lumen-card .lumen-episode--watching .lumen-episode__caption{color:' + C.muted + '}');
css.push('.lumen-card .lumen-episode--soon{background:rgba(28,22,19,.35);border:.07em dashed ' + C.line + '}');
css.push('.lumen-card .lumen-episode--soon .lumen-episode__name{color:' + C.smoke + '}');





css.push('.lumen-card .lumen-episode.focus{opacity:1;background:linear-gradient(180deg,#221A13,#2C2318);border:.13em solid ' + A + ';padding:.70em;-webkit-transform:scale(1.03);transform:scale(1.03);-webkit-box-shadow:0 .614em 1.754em ' + AG + ';box-shadow:0 .614em 1.754em ' + AG + '}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__play{display:block}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__check,.lumen-card .lumen-episode.focus .lumen-episode__percent{display:none}');
css.push('.lumen-card .lumen-episode.focus .lumen-episode__name{font-weight:600}');

css.push(LC.icons.NO_MASK + '{.lumen-card .lumen-next-chip:before,.lumen-card .lumen-episode__check,.lumen-card .lumen-episode__play:before{display:none}}');























css.push('.lumen-descr-row > .items-line__head{display:none}');
css.push('.lumen-descr-row .full-descr{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:start;-webkit-align-items:flex-start;align-items:flex-start;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
css.push('.lumen-descr-row .full-descr__left{-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;min-width:0;margin-right:3.51em}');


















css.push('.lumen-descr-row .full-descr__text{font-family:' + FB + ';font-weight:400;font-size:1.05em;line-height:1.45;color:' + C.text + ';max-width:42.96em;width:auto;max-height:70vh;-webkit-mask-image:none;mask-image:none}');
css.push('.lumen-descr-row .full-descr__details{display:none}');
css.push('.lumen-descr-row .lumen-facts{-webkit-flex-shrink:0;flex-shrink:0;min-width:19.73em;max-width:100%}');
css.push('.lumen-descr-row .lumen-facts__title{font-family:' + FM + ';font-weight:600;font-size:.70em;line-height:1;letter-spacing:.14em;color:' + C.smoke + ';margin-bottom:.88em}');












css.push('.lumen-descr-row .lumen-facts__grid{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;display:grid;grid-template-columns:auto 1fr;grid-row-gap:.44em;grid-column-gap:1.05em;row-gap:.44em;column-gap:1.05em}');
css.push('.lumen-descr-row .lumen-facts__label{font-family:' + FB + ';font-weight:400;font-size:.79em;line-height:1.3;color:' + C.smoke + '}');
css.push('.lumen-descr-row .lumen-facts__value{font-family:' + FB + ';font-weight:500;font-size:.79em;line-height:1.3;color:' + C.text + '}');




css.push('@supports not (display:grid){.lumen-descr-row .lumen-facts__label{width:7em;margin:0 1.33em .56em 0}.lumen-descr-row .lumen-facts__value{-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;min-width:0;margin-bottom:.56em}}');


css.push('@media screen and (max-width:1000px){.lumen-card .lumen-content{display:block}.lumen-card .lumen-content > .lumen-side{text-align:left;-webkit-box-align:start;-webkit-align-items:flex-start;align-items:flex-start;margin-top:1.5em}.lumen-card .full-start-new__title{font-size:2.43em}.lumen-card .full-start-new__body{min-height:0}}');





css.push('.lumen-card.lumen-motion-full .lumen-in{opacity:0;-webkit-transform:translateY(1.05em);transform:translateY(1.05em);-webkit-animation:lumen-rise .7s cubic-bezier(.2,.8,.2,1) forwards;animation:lumen-rise .7s cubic-bezier(.2,.8,.2,1) forwards}');
css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(1){-webkit-animation-delay:.05s;animation-delay:.05s}');
css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(2){-webkit-animation-delay:.11s;animation-delay:.11s}');
css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(3){-webkit-animation-delay:.17s;animation-delay:.17s}');
css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(4){-webkit-animation-delay:.23s;animation-delay:.23s}');
css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(5){-webkit-animation-delay:.29s;animation-delay:.29s}');
css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(6){-webkit-animation-delay:.35s;animation-delay:.35s}');
css.push('@-webkit-keyframes lumen-rise{to{opacity:1;-webkit-transform:none}}');
css.push('@keyframes lumen-rise{to{opacity:1;transform:none}}');



css.push('.lumen-card.lumen-motion-lite .full-start__button{-webkit-transition:background-color .15s,color .15s;transition:background-color .15s,color .15s}');












css.push('.lumen-card.lumen-motion-lite .full-start-new__buttons .full-start__button.focus{-webkit-transform:none !important;transform:none !important}');





css.push('.lumen-card.lumen-motion-off .full-start__button,.lumen-card.lumen-motion-off .lumen-in{-webkit-transition:none !important;transition:none !important;-webkit-animation:none !important;animation:none !important;opacity:1 !important;-webkit-transform:none !important;transform:none !important}');





css.push('.lumen-card.lumen-motion-lite .full-start__button{-webkit-animation:none !important;animation:none !important}');




css.push('.lumen-card.lumen-motion-full .lumen-episode{-webkit-transition:border-color .2s,opacity .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),-webkit-box-shadow .28s;transition:border-color .2s,opacity .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),box-shadow .28s}');
css.push('.lumen-card.lumen-motion-full .lumen-episodes__track{-webkit-transition:-webkit-transform .4s cubic-bezier(.2,.8,.2,1);transition:transform .4s cubic-bezier(.2,.8,.2,1)}');
css.push('.lumen-card.lumen-motion-lite .lumen-episode.focus,.lumen-card.lumen-motion-off .lumen-episode.focus{-webkit-transform:none;transform:none}');






css.push('.lumen-backdrop.lumen-motion-full .lumen-bg__img.is-active{-webkit-animation:lumen-kb 14s linear forwards;animation:lumen-kb 14s linear forwards}');
css.push('@-webkit-keyframes lumen-kb{from{-webkit-transform:scale(1)}to{-webkit-transform:scale(1.08)}}');
css.push('@keyframes lumen-kb{from{transform:scale(1)}to{transform:scale(1.08)}}');

















css.push('.lumen-card .full-start-new__title,.lumen-card .full-start-new__rate-line,.lumen-card .full-start-new__buttons{-webkit-transition:font-size .28s cubic-bezier(.2,.9,.3,1.25),margin-top .28s cubic-bezier(.2,.9,.3,1.25);transition:font-size .28s cubic-bezier(.2,.9,.3,1.25),margin-top .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('.lumen-card.lumen-compact .full-start-new__title{font-size:2.104em}');
css.push('.lumen-card.lumen-compact .lumen-descr{display:none}');
css.push('.lumen-card.lumen-compact .full-start-new__rate-line{margin-top:.87em}');
css.push('.lumen-card.lumen-compact .full-start-new__buttons{margin-top:.95em}');
css.push('.lumen-card.lumen-motion-lite .full-start-new__title,.lumen-card.lumen-motion-lite .full-start-new__rate-line,.lumen-card.lumen-motion-lite .full-start-new__buttons,.lumen-card.lumen-motion-off .full-start-new__title,.lumen-card.lumen-motion-off .full-start-new__rate-line,.lumen-card.lumen-motion-off .full-start-new__buttons{-webkit-transition:none;transition:none}');


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
} catch (e) {
warn('css inject failed', e);
}
};

LC.injectFonts = function () {
try {
var existing = document.getElementById(FONTS_ID);
if (!useFonts()) {
if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
return;
}
if (existing) return;
var link = document.createElement('link');
link.id = FONTS_ID;
link.rel = 'stylesheet';
link.href = FONTS_URL;
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
















function facts(movie, persons, words) {
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



add(words.country, country('', movie.production_countries));

if (serial) add(words.creator, creator(movie));
else add(words.director, director(persons && persons.crew));

add(words.genre, genres(movie.genres, words.capitalize).join(', '));

if (serial) {
var counts = [];
if (movie.number_of_seasons > 0 && words.seasonsWord) counts.push(movie.number_of_seasons + ' ' + words.seasonsWord(movie.number_of_seasons));
if (movie.number_of_episodes > 0 && words.episodesWord) counts.push(movie.number_of_episodes + ' ' + words.episodesWord(movie.number_of_episodes));
add(words.time, counts.join(' · '));
} else {
add(words.time, LC.util.fmtRuntime(movie.runtime, words.min));
}

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
'<img class="full-start-new__img full--poster" />' +
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
'<div class="lumen-original">{original_title}</div>' +
'<div class="full-start-new__tagline full--tagline">{tagline}</div>' +
'</div>' +


'<div class="lumen-in lumen-descr">{descr}</div>' +




'<div class="lumen-in">' +
'<div class="full-start-new__rate-line">' +
'<div class="full-start__rate rate--tmdb"><div>{rating}</div><div class="source--name">TMDB</div></div>' +
'<div class="full-start__rate rate--imdb hide"><div></div><div>IMDB</div></div>' +
'<div class="full-start__rate rate--kp hide"><div></div><div>KP</div></div>' +
'<div class="full-start__tag tag--episode hide"><div></div></div>' +


'<div class="lumen-next-chip hide"><div class="lumen-next-chip__text"></div></div>' +
'<div class="lumen-reactions-chip hide"><div class="lumen-reactions-chip__value"></div><div class="lumen-reactions-chip__label"></div></div>' +
'</div>' +
'</div>' +


'<div class="lumen-in lumen-progress hide">' +
'<span class="lumen-progress__label"></span>' +
'<div class="lumen-progress__bar"><div></div></div>' +
'<span class="lumen-progress__time"></span>' +
'</div>' +


'<div class="lumen-in">' +
'<div class="full-start-new__reactions"><div>#{reactions_none}</div></div>' +


'<div class="full-start-new__buttons">' + buttons + '</div>' +





'<div class="lumen-episodes hide">' +
'<div class="lumen-episodes__head"><div class="lumen-episodes__title"></div><div class="lumen-episodes__count"></div></div>' +
'<div class="lumen-episodes__viewport"><div class="lumen-episodes__track"></div></div>' +
'</div>' +
'</div>' +



'<div class="lumen-side">' +
'<div class="full-start__status hide"></div>' +
'<div class="lumen-tags">' +
'<div class="full-start__tag tag--quality hide"><div></div></div>' +
'</div>' +
'<div class="lumen-cast hide">' +
'<div class="lumen-cast__label"></div>' +
'<div class="lumen-cast__row"></div>' +
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


'<div class="hide buttons--container">' + pool + '</div>' +
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
if (path) url = LC.cardinfo.imageUrl(path, 'w1280', tmdbImageFn(), apiImgFn());
} catch (e) {
warn('image url failed', e);
}
if (!url && movie.background_image) url = movie.background_image;
return url;
}





function posterUrl(movie) {
try {
if (movie.poster_path) return LC.cardinfo.imageUrl(movie.poster_path, 'w500', tmdbImageFn(), apiImgFn());
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
'<div class="lumen-backdrop__veil lumen-backdrop__veil--l"></div>' +
'<div class="lumen-backdrop__veil lumen-backdrop__veil--b"></div>' +
'<div class="lumen-backdrop__veil lumen-backdrop__veil--t"></div>' +
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
var urls = LC.util.map(paths, function (p) { return LC.cardinfo.imageUrl(p, 'w1280', tmdbImageFn(), apiImgFn()); });
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
var reviveCleanup = layer.data('lumenReviveCleanup');
if (reviveCleanup) { clearTimeout(reviveCleanup); layer.removeData('lumenReviveCleanup'); }
}























































































function revive(layer) {
try {
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
r.push(S(['.selectbox .selectbox__content']) + '{background:' + k.panel + ';border-left:.044em solid ' + k.line + ';color:' + k.text + ';font-family:' + k.fontBody + '}');
r.push(S(['.selectbox .selectbox__head']) + '{padding:2.805em 2.805em 1.052em 1.403em}');
r.push(S(['.selectbox .selectbox__title']) + '{font-family:' + k.fontDisplay + ';font-weight:700;font-size:1.227em;line-height:1.1}');


r.push(S(['.selectbox .selectbox-item']) + '{margin:0 2.805em .351em 1.403em;padding:.614em .701em;border-radius:.438em;color:' + k.text + ';-webkit-transition:background-color .2s,color .2s,-webkit-transform .2s;transition:background-color .2s,color .2s,transform .2s}');
r.push(S(['.selectbox .selectbox-item__title']) + '{font-size:.877em;font-weight:600;line-height:1.2}');
r.push(S(['.selectbox .selectbox-item__subtitle']) + '{font-size:.877em;font-weight:400;line-height:1.2;margin-top:.2em;color:' + k.muted + ';opacity:1}');
r.push(S(['.selectbox .selectbox-item.focus']) + '{background-color:' + k.accent + ';color:' + k.onac + ';-webkit-transform:scale(1.02);transform:scale(1.02)}');
r.push(S(['.selectbox .selectbox-item.focus .selectbox-item__subtitle']) + '{color:' + k.onac + ';opacity:.72}');




r.push(S(['.selectbox .selectbox-item__icon']) + '{margin-right:.701em;min-width:1.403em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
r.push(S(['.selectbox .selectbox-item__icon > svg:not([viewBox]):not([class]):not([width])']) + '{width:1.14em;height:1.14em}');

r.push(S(['.selectbox .selectbox-item--checkbox']) + '{padding-left:2.543em;padding-right:.701em}');
r.push(S(['.selectbox .selectbox-item__checkbox']) + '{top:50%;right:auto;left:.701em;width:1.227em;height:1.227em;margin-top:-.614em;border:.044em solid ' + k.line + ';border-radius:.307em;-webkit-box-sizing:border-box;box-sizing:border-box}');
r.push(S(['.selectbox .selectbox-item--checked .selectbox-item__checkbox']) + '{border-color:' + k.accent + '}');
r.push(S(['.selectbox .selectbox-item.focus .selectbox-item__checkbox']) + '{border-color:' + k.onac + '}');
r.push(S(['.selectbox .selectbox-item--checked.focus .selectbox-item__checkbox']) + '{background-color:' + k.onac + '}');
r.push(S(check) + '{top:50%;left:50%;right:auto;width:.877em;height:.877em;margin:-.439em 0 0 -.439em;border:0;-webkit-transform:none;transform:none;color:' + k.accent + ';background-color:currentColor}');
useMask('check', S(check));

r.push(S(['.selectbox .selectbox-item.selected:not(.nomark)', '.selectbox .selectbox-item.picked']) + '{padding-right:2.63em}');
r.push(S(sortCheck) + '{top:50%;right:.701em;width:.964em;height:.964em;margin-top:-.482em;border:0;-webkit-transform:none;transform:none;color:' + k.accent + ';background-color:currentColor}');
useMask('check', S(sortCheck));
r.push(S(['.selectbox .selectbox-item.selected.focus:not(.nomark)::after', '.selectbox .selectbox-item.picked.focus::after']) + '{color:' + k.onac + '}');

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
r.push(A(['.explorer-card__head-create']) + '{font-family:' + k.fontMono + ';font-size:.877em;letter-spacing:.03em;color:' + k.muted + '}');
r.push(A(['.explorer-card__head-rate']) + '{margin:0 0 0 .614em;color:' + k.accent + '}');
r.push(A(['.explorer-card__head-rate > span']) + '{font-family:' + k.fontMono + ';font-size:.964em;font-weight:600}');
r.push(A(['.explorer-card__head-rate > svg']) + '{display:none !important}');
r.push(A(['.explorer-card__head-rate:before']) + '{content:"";display:block;width:.964em;height:.964em;margin-right:.307em;background-color:currentColor}');
useMask('star', A(['.explorer-card__head-rate:before']));
r.push(A(['.explorer-card__title']) + '{font-family:' + k.fontDisplay + ';font-weight:800;font-size:1.666em;line-height:1.06;margin-bottom:.316em}');
r.push(A(['.explorer-card__title.small']) + '{font-size:1.227em}');
r.push(A(['.explorer-card__genres']) + '{font-family:' + k.fontMono + ';font-size:.877em;color:' + k.smoke + ';margin-bottom:.8em}');
r.push(A(['.explorer-card__descr']) + '{font-size:.877em;font-weight:400;line-height:1.45;color:' + k.muted + ';display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}');


r.push(A(['.explorer__files-head']) + '{padding:1.052em 2.805em 0 1.403em}');
r.push(A(chips) + '{font-size:.877em;height:2.8em;padding:0 1em;margin-right:.6em;border-radius:.6em;border:.05em solid ' + k.line + ';background-color:' + k.panel + ';color:' + k.muted + ';font-family:' + k.fontBody + ';font-weight:600;-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-transition:background-color .2s,color .2s,border-color .2s,-webkit-box-shadow .28s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,color .2s,border-color .2s,box-shadow .28s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
r.push(A(['.torrent-filter .simple-button > span', '.empty__footer .simple-button > span']) + '{margin-top:0}');


r.push(A(chipsFocus) + '{background-color:' + k.accent + ';color:' + k.onac + ';border-color:' + k.ring + ';border-width:.125em;-webkit-transform:scale(1.06) !important;transform:scale(1.06) !important;-webkit-box-shadow:0 .7em 2em ' + k.acglow + ';box-shadow:0 .7em 2em ' + k.acglow + '}');

r.push(A(['.torrent-filter .filter--back']) + '{width:2.8em;padding:0;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
r.push(A(['.torrent-filter .filter--back > svg', '.torrent-filter .filter--search > svg']) + '{display:none}');
r.push(A(['.torrent-filter .filter--back:before', '.torrent-filter .filter--search:before']) + '{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.3em;height:1.3em;background-color:currentColor}');
r.push(A(['.torrent-filter .filter--back:before']) + '{-webkit-transform:scaleX(-1);transform:scaleX(-1)}');
useMask('chevronR', A(['.torrent-filter .filter--back:before']));
useMask('search', A(['.torrent-filter .filter--search:before']));
r.push(A(['.torrent-filter .filter--search > div', '.torrent-filter .filter--sort > div']) + '{margin-left:.6em;padding:0;border-radius:0;background:transparent;font-family:' + k.fontMono + ';font-size:1em;font-weight:400;color:' + k.smoke + '}');
r.push(A(['.torrent-filter .filter--search > div']) + '{padding-left:.6em;border-left:.05em solid ' + k.line + ';max-width:15em}');
r.push(A(['.torrent-filter .filter--search.focus > div', '.torrent-filter .filter--sort.focus > div']) + '{color:' + k.onac + ';border-left-color:' + k.onac + '}');

r.push(A(['.torrent-filter .filter--filter > div:not(.hide)']) + '{display:block;-webkit-flex-shrink:0;flex-shrink:0;font-size:1em;width:.5em;height:.5em;margin-left:.5em;padding:0;border-radius:50%;background-color:' + k.accent + ';overflow:hidden;white-space:nowrap;text-indent:2em;color:transparent}');
r.push(A(['.torrent-filter .filter--filter.focus > div:not(.hide)']) + '{background-color:' + k.onac + '}');


r.push(A(['.torrent-list']) + '{padding:0 2.805em 1.403em 1.403em}');
r.push(T(['.torrent-item']) + '{background-color:' + k.panel + ';border:.044em solid ' + k.line + ';border-radius:.438em;padding:.789em;line-height:1.2;color:' + k.text + ';font-family:' + k.fontMono + ';-webkit-transition:border-color .2s,background-color .2s,-webkit-box-shadow .2s;transition:border-color .2s,background-color .2s,box-shadow .2s}');
r.push(T(['.torrent-item + .torrent-item']) + '{margin-top:.701em}');

r.push(T(['.torrent-item.focus']) + '{background-color:' + k.panelHi + ';border-color:' + k.accent + ';border-width:.132em;padding:.701em;-webkit-box-shadow:0 .614em 1.754em ' + k.acglow + ';box-shadow:0 .614em 1.754em ' + k.acglow + '}');
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
r.push(T(['.torrent-item__ffprobe > div']) + '{font-size:.877em;font-family:' + k.fontMono + ';font-weight:400;letter-spacing:.06em;line-height:1;color:' + k.text + ';background:transparent;border:.05em solid rgba(' + k.textRgb + ',.24);border-radius:.35em;padding:.35em .55em;margin:.4em .4em 0 0;-webkit-box-shadow:none;box-shadow:none;outline:0}');
r.push(T(['.torrent-item__ffprobe > div::before']) + '{width:.9em;height:.9em;margin-right:.4em}');
r.push(T(['.torrent-item__ffprobe > div.m-general > div:nth-child(1)', '.torrent-item__ffprobe > div.m-general > div:nth-child(2)']) + '{font-size:1em;padding:0;background:transparent;border-radius:0}');
r.push(T(['.torrent-item__ffprobe > div.m-general > div:nth-child(2)']) + '{padding-left:.4em}');

r.push(T(['.torrent-item__viewed']) + '{top:-.482em;left:-.482em;width:1.578em;height:1.578em;padding:0;border-radius:50%;background-color:' + k.accent + ';color:' + k.onac + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
r.push(T(['.torrent-item__viewed > svg']) + '{display:none}');
r.push(T(['.torrent-item__viewed:before']) + '{content:"";display:block;width:.964em;height:.964em;background-color:currentColor}');
useMask('check', T(['.torrent-item__viewed:before']));


r.push(A(['.watched-history']) + '{background-color:' + k.panelLo + ';border:.044em solid ' + k.line + ';border-radius:.438em;padding:.701em .789em;margin-bottom:.701em;color:' + k.muted + ';font-family:' + k.fontMono + ';-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-transition:border-color .2s,-webkit-box-shadow .2s;transition:border-color .2s,box-shadow .2s}');
r.push(A(['.watched-history__icon']) + '{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;width:1.578em;height:1.578em;border-radius:.175em;border:.044em solid ' + k.accent + ';background-color:rgba(' + k.accentRgb + ',.16);color:' + k.accent + '}');
r.push(A(['.watched-history__icon > svg']) + '{width:.964em !important;height:.964em !important}');
r.push(A(['.watched-history__body']) + '{padding-left:.614em;font-size:.877em;line-height:1.3}');
r.push(A(['.watched-history__body > span + span::before']) + '{color:' + k.smoke + '}');
r.push(A(['.watched-history.focus']) + '{color:' + k.text + ';border-color:' + k.accent + ';border-width:.132em;padding:.614em .701em;-webkit-box-shadow:0 .614em 1.754em ' + k.acglow + ';box-shadow:0 .614em 1.754em ' + k.acglow + '}');
r.push(A(['.watched-history.focus::after']) + '{border-color:transparent}');


r.push(A(['.empty', '.empty-filter']) + '{font-family:' + k.fontBody + ';color:' + k.text + '}');
r.push(A(['.empty__img']) + '{height:7.014em;margin-bottom:1.403em;opacity:.35}');
r.push(A(['.empty__title']) + '{font-family:' + k.fontDisplay + ';font-weight:700;font-size:1.227em;line-height:1.2}');
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
r.push(S(['.modal .modal__content']) + '{background-color:' + k.panel + ';border-radius:.614em;-webkit-box-shadow:0 1.315em 3.945em rgba(0,0,0,.7);box-shadow:0 1.315em 3.945em rgba(0,0,0,.7);color:' + k.text + ';font-family:' + k.fontBody + '}');
r.push(S(['.modal .modal__head']) + '{margin-bottom:.701em;padding-bottom:.701em;border-bottom:.044em solid ' + k.line + '}');

r.push(S(['.modal .modal__title', '.modal .error__title']) + '{font-family:' + k.fontDisplay + ';font-weight:700;font-size:1.227em;line-height:1.1}');

r.push(S(['.modal .error__ico']) + '{position:relative;width:2.455em;height:2.455em;margin-right:.701em;border-radius:50%;background:' + k.spice + '}');
r.push(S(['.modal .error__ico:before']) + '{content:"";position:absolute;top:50%;left:50%;width:1.227em;height:1.227em;margin:-.614em 0 0 -.614em;background-color:' + k.dark + '}');
useMask('close', S(['.modal .error__ico:before']));
r.push(S(['.modal .error__text']) + '{font-size:.964em;font-weight:400;line-height:1.4;margin-top:.35em;color:' + k.muted + '}');

r.push(T(['.torrent-error']) + '{margin-top:1.052em;padding-top:1.052em;border-top:.044em solid ' + k.line + ';font-family:' + k.fontBody + '}');
r.push(T(['.torrent-error > div > div']) + '{font-size:.877em;font-weight:600;line-height:1.2}');
r.push(T(['.torrent-error > div > ul']) + '{margin-top:.4em;font-size:.877em;font-weight:400;line-height:1.3;color:' + k.muted + '}');
r.push(T(['.torrent-error > div > ul > li + li']) + '{margin-top:.4em}');
r.push(T(['.torrent-error > div > ul > li::before']) + '{top:.55em;background-color:' + k.smoke + '}');
r.push(T(['.torrent-error code']) + '{display:block;margin-top:.4em;padding:.5em .7em;border-radius:.35em;background-color:' + k.raised + ';color:' + k.text + ';font-family:' + k.fontMono + ';font-size:1em;word-break:normal;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');

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
r.push(T(['.torrent-install__title']) + '{font-family:' + k.fontDisplay + ';font-weight:700;font-size:1.403em;line-height:1.1;margin-bottom:.563em}');
r.push(T(['.torrent-install__descr']) + '{font-size:1.052em;line-height:1.45;margin-bottom:.75em;color:' + k.muted + '}');
r.push(T(['.torrent-install__label']) + '{font-size:.877em;font-weight:600;margin-bottom:.6em}');
r.push(T(['.torrent-install__link']) + '{margin:0 .526em .526em 0;padding:.526em .789em;border-radius:.307em;background-color:' + k.raised + ';color:' + k.text + '}');
r.push(T(['.torrent-install__link > div:first-child']) + '{font-size:.877em;font-weight:500;margin-bottom:.2em}');
r.push(T(['.torrent-install__link > div:last-child']) + '{font-size:.877em;font-family:' + k.fontMono + ';color:' + k.muted + '}');


r.push(T(['.torrent-checklist']) + '{font-family:' + k.fontBody + ';color:' + k.text + '}');
r.push(T(['.torrent-checklist__descr']) + '{font-size:.964em;line-height:1.4;margin-bottom:.5em;color:' + k.muted + '}');
r.push(T(['.torrent-checklist__progress-steps']) + '{font-family:' + k.fontMono + ';font-size:.877em;margin-bottom:.55em;color:' + k.text + '}');
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

r.push(T(btn) + '{font-size:1.052em;height:3em;padding:0 1.25em;margin-right:0;border-radius:.75em;border:.042em solid ' + k.line + ';background-color:' + k.panel + ';color:' + k.text + ';font-family:' + k.fontBody + ';font-weight:600;-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-transition:background-color .2s,color .2s,border-color .2s,-webkit-box-shadow .28s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,color .2s,border-color .2s,box-shadow .28s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
r.push(T(btnFocus) + '{background-color:' + k.accent + ';color:' + k.onac + ';border-color:' + k.ring + ';border-width:.104em;-webkit-transform:scale(1.06) !important;transform:scale(1.06) !important;-webkit-box-shadow:0 .583em 1.667em ' + k.acglow + ';box-shadow:0 .583em 1.667em ' + k.acglow + '}');
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
r.push(T(['.torrnet-folder-name']) + '{font-family:' + k.fontMono + ';font-size:.877em;line-height:1.2;padding:.8em 0;color:' + k.muted + ';opacity:.5}');
r.push(T(['.torrnet-folder-name.focus']) + '{opacity:1;color:' + k.accent + '}');
r.push(T(rows) + '{background-color:' + k.panelLo + ';border:.044em solid ' + k.line + ';border-radius:.438em;color:' + k.text + ';font-family:' + k.fontBody + ';-webkit-transition:border-color .2s,background-color .2s,-webkit-box-shadow .2s;transition:border-color .2s,background-color .2s,box-shadow .2s}');
r.push(T(['.torrent-file.focus', '.torrent-serial.focus']) + '{background-color:' + k.panelHi + ';border-color:' + k.accent + ';border-width:.132em;-webkit-box-shadow:0 .526em 1.534em ' + k.acglow + ';box-shadow:0 .526em 1.534em ' + k.acglow + '}');

r.push(T(['.torrent-file']) + '{padding:.701em .789em;overflow:hidden}');
r.push(T(['.torrent-file.focus']) + '{padding:.614em .701em}');
r.push(T(['.torrent-file__title']) + '{font-size:.964em;font-weight:500;line-height:1.25;padding-right:.727em;color:' + k.muted + '}');
r.push(T(['.torrent-file__title .exe']) + '{display:inline;margin-left:.4em;padding:0;border-radius:0;background:transparent;font-family:' + k.fontMono + ';font-size:.909em;font-weight:400;color:' + k.smoke + '}');
r.push(T(['.torrent-file.focus .torrent-file__title']) + '{color:' + k.text + '}');
r.push(T(['.torrent-file.focus .torrent-file__title .exe']) + '{color:' + k.muted + '}');
r.push(T(['.torrent-file__size', '.torrent-serial__size']) + '{font-size:.877em;font-family:' + k.fontMono + ';font-weight:400;line-height:1;padding:.35em .7em;border-radius:.35em;border:.05em solid ' + k.line + ';background-color:' + k.panel + ';color:' + k.muted + '}');
r.push(T(['.torrent-file.focus .torrent-file__size', '.torrent-serial.focus .torrent-serial__size']) + '{color:' + k.text + '}');

r.push(T(['.torrent-file .time-line']) + '{left:0;right:0;bottom:0;margin:0;height:.175em;border-radius:0;background-color:rgba(' + k.textRgb + ',.16)}');
r.push(T(['.torrent-serial .time-line']) + '{margin-top:.35em;height:.175em;border-radius:.088em;background-color:rgba(' + k.textRgb + ',.16);overflow:hidden}');
r.push(T(['.torrent-file .time-line > div', '.torrent-serial .time-line > div']) + '{height:100%;border-radius:.088em;background-color:' + k.accent + '}');

r.push(T(['.torrent-serial']) + '{padding:.526em}');
r.push(T(['.torrent-serial.focus']) + '{padding:.439em}');
r.push(T(['.torrent-serial__img']) + '{width:8.768em;height:4.932em;border-radius:.307em;-webkit-align-self:center;-ms-flex-item-align:center;align-self:center}');
r.push(T(['.torrent-serial__content']) + '{padding:0 .175em 0 .701em}');
r.push(T(['.torrent-serial__title']) + '{font-size:.877em;font-weight:600;line-height:1.25;margin-top:0}');
r.push(T(['.torrent-serial__line']) + '{font-family:' + k.fontMono + ';font-size:.877em;font-weight:400;line-height:1.2;margin-top:.35em;color:' + k.muted + '}');
r.push(T(['.torrent-serial__line b']) + '{font-weight:400}');
r.push(T(['.torrent-serial__line span + span:before']) + '{content:"\\00B7";margin:0 .5em;color:' + k.smoke + '}');
r.push(T(['.torrent-serial__exe']) + '{font-family:' + k.fontMono + ';font-size:.877em;margin-top:.35em;color:' + k.smoke + '}');
r.push(T(['.torrent-serial__episode']) + '{top:1.176em;left:1.176em;padding:.235em .529em;border-radius:.235em;background-color:rgba(0,0,0,.7);font-family:' + k.fontMono + ';font-size:.745em;font-weight:600;line-height:1;color:' + k.text + '}');
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
r.push(T(['.media-loading__title']) + '{font-family:' + k.fontDisplay + ';font-weight:800;font-size:1.403em;line-height:1.1;letter-spacing:.06em;text-transform:uppercase;color:' + k.text + ';text-shadow:none}');
r.push(T(['.media-loading__mark-fill .media-loading__title']) + '{color:' + k.accent + ';text-shadow:0 0 .94em ' + k.acglow + '}');
r.push(T(['.media-loading__mark-fill .media-loading__logo']) + '{-webkit-filter:drop-shadow(0 0 .6em ' + k.acglow + ');filter:drop-shadow(0 0 .6em ' + k.acglow + ')}');

r.push(TM('full', markSel) + '{-webkit-animation:lumen-tp-soft 2s ease-in-out infinite;animation:lumen-tp-soft 2s ease-in-out infinite}');
r.push(TM('lite', markSel) + ',' + TM('off', markSel) + '{-webkit-animation:none !important;animation:none !important;-webkit-transform:none;transform:none}');
r.push('@-webkit-keyframes lumen-tp-soft{0%,100%{-webkit-transform:scale(1)}50%{-webkit-transform:scale(1.02)}}');
r.push('@keyframes lumen-tp-soft{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}');



r.push(T(['.media-loading__status']) + '{bottom:6.5em;padding:.8em 1.4em;border-radius:1.5em;border:.05em solid rgba(' + k.textRgb + ',.24);background-color:rgba(' + k.textRgb + ',.1);-webkit-box-shadow:0 .7em 2em rgba(0,0,0,.35);box-shadow:0 .7em 2em rgba(0,0,0,.35);color:' + k.muted + ';font-family:' + k.fontMono + ';font-size:.877em}');
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


/* ---- 70_progress.js ---- */







LC.progress = (function () {
function movieProgress(movie, view, hash) {
var key = movie.original_title || movie.original_name || movie.title || movie.name;
if (!key) return null;
var v = view(hash(key));
if (v && v.percent > 0) return { view: v, season: 0, episode: 0 };
return null;
}

function serialProgress(movie, view, hash) {
var key = movie.original_name || movie.original_title || movie.name || movie.title;
if (!key) return null;

var maxSeason = parseInt(movie.number_of_seasons, 10) || 1;
if (maxSeason > 10) maxSeason = 10;
if (maxSeason < 1) maxSeason = 1;

var best = null;
for (var s = 1; s <= maxSeason; s++) {
for (var ep = 1; ep <= 30; ep++) {
var h = hash([s, s > 10 ? ':' : '', ep, key].join(''));
var v = view(h);
if (v && v.percent > 0) {
if (!best || (v.updated || 0) >= (best.view.updated || 0)) {
best = { view: v, season: s, episode: ep };
}
}
}
}
return best;
}








function episodeState(view, airDate, now, runtimeMin) {
var percent = view ? Number(view.percent) || 0 : 0;
if (percent >= 95) return { state: 'watched' };
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
episodeState: episodeState
};
})();





if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.progress;


/* ---- 80_settings.js ---- */




LC.STRINGS = {
lumen_card_title: { ru: 'Lumen Card', en: 'Lumen Card', uk: 'Lumen Card' },
lumen_card_accent: { ru: 'Акцентный цвет', en: 'Accent color', uk: 'Акцентний колір' },
lumen_card_accent_sand: { ru: 'Песок', en: 'Sand', uk: 'Пісок' },
lumen_card_accent_ice: { ru: 'Лёд', en: 'Ice', uk: 'Лід' },
lumen_card_accent_wine: { ru: 'Вино', en: 'Wine', uk: 'Вино' },
lumen_card_accent_mint: { ru: 'Мята', en: 'Mint', uk: 'М\'ята' },
lumen_card_fonts_name: { ru: 'Фирменные шрифты', en: 'Custom fonts', uk: 'Фірмові шрифти' },
lumen_card_fonts_descr: {
ru: 'Unbounded / Golos Text / JetBrains Mono. Требуется интернет. Выключите, если шрифты не грузятся.',
en: 'Unbounded / Golos Text / JetBrains Mono. Requires internet access.',
uk: 'Unbounded / Golos Text / JetBrains Mono. Потрібен інтернет.'
},
lumen_card_progress_name: { ru: 'Показывать «Продолжить»', en: 'Show "Continue"', uk: 'Показувати «Продовжити»' },
lumen_card_cast_name: { ru: 'Показывать актёров', en: 'Show cast', uk: 'Показувати акторів' },
lumen_card_motion: { ru: 'Анимации', en: 'Animations', uk: 'Анімації' },
lumen_card_motion_auto: { ru: 'Авто', en: 'Auto', uk: 'Авто' },
lumen_card_motion_full: { ru: 'Полные', en: 'Full', uk: 'Повні' },
lumen_card_motion_lite: { ru: 'Лёгкие', en: 'Light', uk: 'Легкі' },
lumen_card_motion_off: { ru: 'Выкл', en: 'Off', uk: 'Викл' },
lumen_card_continue: { ru: 'ПРОДОЛЖИТЬ', en: 'CONTINUE', uk: 'ПРОДОВЖИТИ' },
lumen_card_cast: { ru: 'В ролях', en: 'Cast', uk: 'У ролях' },
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
lumen_card_fact_original: { ru: 'Оригинал', en: 'Original', uk: 'Оригінал' },
lumen_card_fact_premiere: { ru: 'Премьера', en: 'Premiere', uk: 'Прем\'єра' },
lumen_card_fact_country: { ru: 'Страна', en: 'Country', uk: 'Країна' },
lumen_card_fact_director: { ru: 'Режиссёр', en: 'Director', uk: 'Режисер' },
lumen_card_fact_creator: { ru: 'Создатель', en: 'Creator', uk: 'Творець' },
lumen_card_fact_genre: { ru: 'Жанр', en: 'Genre', uk: 'Жанр' },
lumen_card_fact_time: { ru: 'Время', en: 'Runtime', uk: 'Час' },




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
lumen_card_slide_interval: { ru: 'Интервал смены кадров', en: 'Frame interval', uk: 'Інтервал зміни кадрів' },
lumen_card_seconds: { ru: 'с', en: 's', uk: 'с' },
lumen_card_menus: { ru: 'Оформление меню и окон', en: 'Menus and dialogs style', uk: 'Оформлення меню і вікон' },
lumen_card_menus_all: { ru: 'Все меню и окна', en: 'All menus and dialogs', uk: 'Усі меню і вікна' },
lumen_card_menus_path: { ru: 'Только путь до плеера', en: 'Player path only', uk: 'Лише шлях до плеєра' },
lumen_card_menus_off: { ru: 'Выкл', en: 'Off', uk: 'Викл' },
lumen_card_torrents_name: { ru: 'Оформление экрана торрентов', en: 'Torrents screen style', uk: 'Оформлення екрана торентів' }
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
if (typeof def === 'boolean') {
if (value === 'true' || value === true || value === 1 || value === '1') return true;
if (value === 'false' || value === false || value === 0 || value === '0') return false;
return def;
}
return value;
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






function onlyWithoutStorage(fn) {
return function () {
if (!LC.storageFollowed) fn();
};
}

LC.addSettings = function () {
try {
if (!window.Lampa || !Lampa.SettingsApi || typeof Lampa.SettingsApi.addComponent !== 'function') return;

Lampa.SettingsApi.addComponent({
component: PLUGIN,
icon: ICON,
name: LC.lang('lumen_card_title')
});

var accentValues = {
sand: LC.lang('lumen_card_accent_sand'),
ice: LC.lang('lumen_card_accent_ice'),
wine: LC.lang('lumen_card_accent_wine'),
mint: LC.lang('lumen_card_accent_mint')
};

Lampa.SettingsApi.addParam({
component: PLUGIN,
param: { name: PLUGIN + '_accent', type: 'select', values: accentValues, 'default': 'sand' },
field: { name: LC.lang('lumen_card_accent') },
onChange: onlyWithoutStorage(function () { LC.injectCss(); })
});

Lampa.SettingsApi.addParam({
component: PLUGIN,
param: { name: PLUGIN + '_fonts', type: 'trigger', 'default': true },
field: { name: LC.lang('lumen_card_fonts_name'), description: LC.lang('lumen_card_fonts_descr') },
onChange: onlyWithoutStorage(function () { LC.injectFonts(); LC.injectCss(); })
});

Lampa.SettingsApi.addParam({
component: PLUGIN,
param: { name: PLUGIN + '_progress', type: 'trigger', 'default': true },
field: { name: LC.lang('lumen_card_progress_name') }
});

Lampa.SettingsApi.addParam({
component: PLUGIN,
param: { name: PLUGIN + '_cast', type: 'trigger', 'default': true },
field: { name: LC.lang('lumen_card_cast_name') }
});

var motionValues = {
auto: LC.lang('lumen_card_motion_auto'),
full: LC.lang('lumen_card_motion_full'),
lite: LC.lang('lumen_card_motion_lite'),
off: LC.lang('lumen_card_motion_off')
};




Lampa.SettingsApi.addParam({
component: PLUGIN,
param: { name: 'lumen_motion', type: 'select', values: motionValues, 'default': 'auto' },
field: { name: LC.lang('lumen_card_motion') },
onChange: onlyWithoutStorage(function () { LC.applyMotionMode(); })
});







Lampa.SettingsApi.addParam({
component: PLUGIN,
param: { name: 'lumen_slideshow', type: 'trigger', 'default': true },
field: { name: LC.lang('lumen_card_slideshow_name') },
onChange: onlyWithoutStorage(function () { LC.applySlideshowPref(); })
});

var seconds = LC.lang('lumen_card_seconds');
var intervalValues = { '8': '8 ' + seconds, '14': '14 ' + seconds, '20': '20 ' + seconds };

Lampa.SettingsApi.addParam({
component: PLUGIN,
param: { name: 'lumen_slide_interval', type: 'select', values: intervalValues, 'default': '14' },
field: { name: LC.lang('lumen_card_slide_interval') },
onChange: onlyWithoutStorage(function () { LC.applySlideshowPref(); })
});




var menusValues = {
all: LC.lang('lumen_card_menus_all'),
path: LC.lang('lumen_card_menus_path'),
off: LC.lang('lumen_card_menus_off')
};

Lampa.SettingsApi.addParam({
component: PLUGIN,
param: { name: 'lumen_menus', type: 'select', values: menusValues, 'default': 'all' },
field: { name: LC.lang('lumen_card_menus') },
onChange: onlyWithoutStorage(function () { LC.applyMenusPref(); })
});

Lampa.SettingsApi.addParam({
component: PLUGIN,
param: { name: 'lumen_torrents', type: 'trigger', 'default': true },
field: { name: LC.lang('lumen_card_torrents_name') },
onChange: onlyWithoutStorage(function () { LC.applyTorrentsPref(); })
});
} catch (e) {
warn('settings failed', e);
}
};

LC.followStorage = function () {
try {
if (!window.Lampa || !Lampa.Storage || !Lampa.Storage.listener) return;
Lampa.Storage.listener.follow('change', function (e) {
if (!e || !e.name) return;
if (e.name === 'lumen_motion') { LC.applyMotionMode(); return; }
if (e.name === 'lumen_slideshow' || e.name === 'lumen_slide_interval') { LC.applySlideshowPref(); return; }
if (e.name === 'lumen_menus') { LC.applyMenusPref(); return; }
if (e.name === 'lumen_torrents') { LC.applyTorrentsPref(); return; }
if (e.name.indexOf(PLUGIN + '_') !== 0) return;
if (e.name === PLUGIN + '_fonts') LC.injectFonts();
LC.injectCss();
});
LC.storageFollowed = true;
} catch (err) {
warn('storage listener failed', err);
}
};











LC.motionModeFor = function (stored, platform) {
if (stored !== 'full' && stored !== 'lite' && stored !== 'off') stored = 'auto';
if (stored !== 'auto') return stored;
platform = platform || {};
if (platform.tizen || platform.webos) return 'lite';
return 'full';
};

LC.motionMode = function () {
var stored = 'auto';
try {
if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') stored = Lampa.Storage.field('lumen_motion');
} catch (e) { }
var platform = { tizen: false, webos: false };
try {
if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.is === 'function') {
platform.tizen = !!Lampa.Platform.is('tizen');
platform.webos = !!Lampa.Platform.is('webos');
}
} catch (e2) { }
return LC.motionModeFor(stored, platform);
};





if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.motionModeFor;


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



function renderOriginal(root, movie) {
var title = movie.title || movie.name || '';
var original = movie.original_title || movie.original_name || '';
var node = root.find('.lumen-original');
if (!node.length) return;

var text = (!original || original === title) ? '' : original;

if (isSerial(movie)) {
var creator = LC.cardinfo.creator(movie);
if (creator) text = text ? (text + ' · ' + creator) : creator;
}

node.text(text);
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

function renderProgress(root, movie) {
var row = root.find('.lumen-progress');
if (!row.length) return;

row.addClass('hide');
if (!LC.pref(PLUGIN + '_progress', true)) return;

var found = isSerial(movie)
? LC.progress.serialProgress(movie, timelineView, utilsHash)
: LC.progress.movieProgress(movie, timelineView, utilsHash);
if (!found || !found.view || !(found.view.percent > 0)) return;

var percent = Math.max(0, Math.min(100, Math.round(found.view.percent)));
var label = LC.lang('lumen_card_continue');
if (found.season) label += ' · S' + found.season + ' E' + found.episode;

var time = '';
if (found.view.duration > 0) time = LC.util.fmtTime(found.view.time) + ' / ' + LC.util.fmtTime(found.view.duration);
else if (found.view.time > 0) time = LC.util.fmtTime(found.view.time);
else time = percent + '%';

row.find('.lumen-progress__label').text(label);
row.find('.lumen-progress__time').text(time);
row.find('.lumen-progress__bar > div').css('width', percent + '%');
row.removeClass('hide');
}

function renderCast(root, data) {
var block = root.find('.lumen-cast');
if (!block.length) return;

block.addClass('hide');
block.find('.lumen-cast__row').empty();

if (!LC.pref(PLUGIN + '_cast', true)) return;

var cast = data && data.persons && data.persons.cast;
if (!cast || !cast.length) return;

var html = [];
var limit = Math.min(5, cast.length);
for (var i = 0; i < limit; i++) {
html.push('<div class="lumen-cast__item">' + LC.util.esc(LC.util.initials(cast[i] && cast[i].name)) + '</div>');
}
if (cast.length > limit) {
html.push('<div class="lumen-cast__item lumen-cast__more">+' + (cast.length - limit) + '</div>');
}

block.find('.lumen-cast__label').text(LC.lang('lumen_card_cast'));
block.find('.lumen-cast__row').html(html.join(''));
block.removeClass('hide');
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



function renderNextChip(root, movie) {
var chip = root.find('.lumen-next-chip');
if (!chip.length) return;
chip.addClass('hide');
if (!isSerial(movie)) return;
var next = LC.cardinfo.nextEpisode(movie.next_episode_to_air, new Date(), dateWords());
if (!next) return;
chip.find('.lumen-next-chip__text').text(next.text);
chip.removeClass('hide');
}

var EPISODE_STATES = 'lumen-episode--watched lumen-episode--watching lumen-episode--aired lumen-episode--soon';





var STILL_WINDOW = 6;




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





function episodeInner(ep, st, months, hasStill) {
var esc = LC.util.esc;
var min = LC.lang('lumen_card_min');
var runtime = ep.runtime > 0 ? ep.runtime + ' ' + min : '';
var caption = runtime;
var badge = '';

if (st.state === 'watched') {
caption = (runtime ? runtime + ' · ' : '') + LC.lang('lumen_card_ep_watched');
badge = '<div class="lumen-episode__check"></div>';
} else if (st.state === 'watching') {
caption = LC.lang('lumen_card_ep_watching') + (st.leftMin ? ' · ' + LC.lang('lumen_card_ep_left') + ' ' + st.leftMin + ' ' + min : '');
badge = '<div class="lumen-episode__percent">' + st.percent + ' %</div>';
} else if (st.state === 'soon') {
var date = LC.cardinfo.shortDate(ep.air_date, months);
caption = (date ? date + ' · ' : '') + LC.lang('lumen_card_ep_soon');
}

return '' +
(hasStill ? '<div class="lumen-episode__still"></div>' : '') +
'<div class="lumen-episode__top">' +
'<div class="lumen-episode__num">E' + esc(ep.episode_number) + '</div>' + badge +
'<div class="lumen-episode__play"></div>' +
'</div>' +
'<div class="lumen-episode__bottom">' +
'<div class="lumen-episode__name">' + esc(ep.name || '') + '</div>' +
(caption ? '<div class="lumen-episode__caption">' + esc(caption) + '</div>' : '') +
(st.state === 'watching' ? '<div class="lumen-episode__bar"><div style="width:' + st.percent + '%"></div></div>' : '') +
'</div>';
}





function paintEpisode(node, ep, hash, now, months) {
var view = hash ? timelineView(hash) : null;
var st = LC.progress.episodeState(view, ep.air_date, now, ep.runtime);
var sign = st.state + '|' + (st.percent || '') + '|' + (st.leftMin || '');
if (node[0].lumenSign === sign) return st;

node[0].lumenSign = sign;
node.removeClass(EPISODE_STATES).addClass('lumen-episode--' + st.state).html(episodeInner(ep, st, months, !!node.attr('data-still')));
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

for (var i = 0; i < list.length; i++) {
var ep = list[i];
if (!ep || !(ep.episode_number > 0)) continue;
var hash = key && season ? '' + utilsHash([season, season > 10 ? ':' : '', ep.episode_number, key].join('')) : '';
if (hash === '0') hash = '';
var still = LC.cardinfo.imageUrl(ep.still_path, 'w300', tmdbImageFn(), apiImgFn());
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
country: LC.lang('lumen_card_fact_country'),
director: LC.lang('lumen_card_fact_director'),
creator: LC.lang('lumen_card_fact_creator'),
genre: LC.lang('lumen_card_fact_genre'),
time: LC.lang('lumen_card_fact_time'),
min: LC.lang('lumen_card_min'),
months: ('' + LC.lang('lumen_card_months_gen')).split(','),
capitalize: capitalize,
seasonsWord: LC.seasonsWord,
episodesWord: LC.episodesWord
};
}










function factsSign(data, lang) {
var movie = (data && data.movie) || {};
var persons = (data && data.persons) || null;
var crew = (persons && persons.crew) || null;
var genres = movie.genres || null;
var countries = movie.production_countries || null;
var firstCountry = (countries && countries.length && countries[0] && (countries[0].iso_3166_1 || countries[0].name)) || '';
return [movie.id, movie.title || movie.name, movie.original_title || movie.original_name,
movie.release_date || movie.first_air_date, movie.runtime,
movie.number_of_seasons, movie.number_of_episodes,
(genres && genres.length) || 0, (genres && genres.length && genres[0] && genres[0].name) || '',
(countries && countries.length) || 0, firstCountry,
(movie.created_by && movie.created_by.length && movie.created_by[0] && movie.created_by[0].name) || '',
(crew && crew.length) || 0, LC.cardinfo.director(crew), lang].join('|');
}





















function renderDescrRow(row, data) {
if (!row || !row.length) return;
var holder = row.find('.full-descr');
if (!holder.length) return;

row.addClass('lumen-descr-row');







var sign = factsSign(data, LC.lang('lumen_card_facts'));
var previous = holder[0].lumenFacts;
if (previous && previous.sign === sign && (!previous.count || holder.find('.lumen-facts').length)) return;

holder.find('.lumen-facts').remove();
holder[0].lumenFacts = { sign: sign, count: 0 };

var list = LC.cardinfo.facts((data && data.movie) || null, data && data.persons, factWords());
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
try { renderOriginal(root, movie); } catch (e) { warn('original failed', e); }
try { renderStatus(root, movie); } catch (e) { warn('status failed', e); }
try { renderSerialMode(root, movie); } catch (e) { warn('serial mode failed', e); }
try { renderNextChip(root, movie); } catch (e) { warn('next episode chip failed', e); }
try { renderReactionsChip(root, data); } catch (e) { warn('reactions chip failed', e); }
try { renderQualityChips(root, movie); } catch (e) { warn('quality chips failed', e); }
try { renderProgress(root, movie); } catch (e) { warn('progress failed', e); }
try { renderCast(root, data); } catch (e) { warn('cast failed', e); }
try { renderEpisodes(root, data); } catch (e) { warn('episodes failed', e); }
try { bindEpisodes(root); } catch (e) { warn('episodes bind failed', e); }
}

LC.header = { decorate: decorate, descr: renderDescrRow, refreshEpisode: refreshEpisode };


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




LC.applyMotionMode = function () {
applyMotionMode(activeCardRoot());
applyMotionMode(activeBackdropLayer());
if (ui_active) applyMotionMode(bodyRoot());
};

var toggle_followed = false;




function followToggle() {
if (toggle_followed) return;
toggle_followed = true;
try {
if (!window.Lampa || !Lampa.Controller || !Lampa.Controller.listener) return;
Lampa.Controller.listener.follow('toggle', function (e) {
try {
if (!e || !e.name) return;
var root = activeCardRoot();
if (!root || !root.length) return;
if (e.name === 'full_descr' || e.name === 'items_line') root.addClass('lumen-compact');
else if (e.name === 'full_start') root.removeClass('lumen-compact');
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
if (e && e.data) LC.header.refreshEpisode(e.data.hash);
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


















































LC.onActivityEvent = function (e) {
try {
if (!e) return;

if (LC.active && e.object === LC.active.object) {
if (e.type === 'destroy') {
LC.backdrops.cancel(LC.active.body);
LC.active = null;
} else if (e.type === 'archive' || e.type === 'start') {





LC.active.slideshow = liveSlideshow(layerOf(e.object), LC.active.slideshow);
if (LC.active.slideshow) LC.active.slideshow.resume();
}
return;
}

if (e.type === 'destroy') {
var orphanLayer = layerOf(e.object);
if (orphanLayer && orphanLayer.length) LC.backdrops.cancel(orphanLayer.parent());
return;
}








if (e.type === 'start' && e.component === 'full') {
var layer = layerOf(e.object);
if (layer && layer.length) {
var slideshow = liveSlideshow(layer, layer.data('lumenSlideshow'));
LC.active = { object: e.object, body: layer.parent(), slideshow: slideshow };
if (slideshow) slideshow.resume();
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









LC.applySlideshowPref = function () {
try {
if (!LC.active || !LC.active.slideshow) return;
LC.active.slideshow.pause();
if (LC.pref('lumen_slideshow', true)) LC.active.slideshow.resume();
} catch (e) {
warn('slideshow pref failed', e);
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

LC.init = function () {
try {
if (!window.Lampa || !Lampa.Template || !Lampa.Listener) return;

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
if (Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show('Lumen Card: версия Lampa не поддерживается');
} catch (e3) { }
return;
}
Lampa.Template.add('full_start_new', tpl);

LC.injectFonts();
LC.injectCss();

ui_active = true;
applyMotionMode(bodyRoot());
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

Lampa.Listener.follow('full', function (e) {
try {
if (!e) return;
if (e.type === 'build' && e.name === 'start') {
LC.header.decorate(findRoot(e), e.data);
} else if (e.type === 'build' && e.name === 'description') {

LC.header.descr(findDescrRow(e), e.data);
} else if (e.type === 'complite') {
var root = findRoot(e);
LC.header.decorate(root, e.data);



LC.header.descr(findDescrRow(e), e.data);
var slideshow = LC.backdrops.apply(root, e.body, (e.data && e.data.movie) || {});
applyMotionMode(root);
LC.active = { object: e.object, body: e.body, slideshow: slideshow };
}
} catch (err) {
warn('listener failed', err);
}
});

followToggle();
followActivityLifecycle();
LC.followTimeline();
} catch (e) {
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
