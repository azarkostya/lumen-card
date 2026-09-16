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




LC.MANIFEST_URL = '';

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
chipBg: 'rgba(28,22,19,.78)',
buttonBg: 'rgba(28,22,19,.82)',


panelHi: '#221A13',
panelLo: '#17120F',
raised: '#241C17'
};









var ACCENTS = {
sand: { color: '#E8B87A', light: '#FFF2DC', glow: 'rgba(232,184,122,0.35)', onac: '#1A120A' },
ice: { color: '#7FB7C9', light: '#E9F7FB', glow: 'rgba(127,183,201,0.35)', onac: '#08171C' },
wine: { color: '#C46A8F', light: '#FBEAF1', glow: 'rgba(196,106,143,0.35)', onac: '#1C0A12' },
mint: { color: '#9FCF8A', light: '#EEFBE7', glow: 'rgba(159,207,138,0.35)', onac: '#0C1608' }
};



function hexToRgb(hex) {
hex = ('' + hex).replace('#', '');
var r = parseInt(hex.substring(0, 2), 16);
var g = parseInt(hex.substring(2, 4), 16);
var b = parseInt(hex.substring(4, 6), 16);
return r + ',' + g + ',' + b;
}



var SPICE_RGB = hexToRgb(C.spice);





var BG_RGB = hexToRgb(C.bg);











var FONT_SETS = {
golos: { body: 'Golos Text', bodyW: '400;500;600', mono: 'JetBrains Mono', monoW: '400;600' },
onest: { body: 'Onest', bodyW: '400;500;600', mono: 'JetBrains Mono', monoW: '400;600' },
manrope: { body: 'Manrope', bodyW: '400;500;600', mono: 'JetBrains Mono', monoW: '400;600' },
inter: { body: 'Inter', bodyW: '400;500;600', mono: 'JetBrains Mono', monoW: '400;600' },
plex: { body: 'IBM Plex Sans', bodyW: '400;500;600', mono: 'IBM Plex Mono', monoW: '400;600' }
};
var FONT_DEFAULT = 'golos';

var FONT_DISPLAY_ON = '"Unbounded","Arial Black",Impact,sans-serif';
var FONT_DISPLAY_OFF = '"Arial Black",Impact,sans-serif';
var FONT_BODY_OFF = 'inherit';
var FONT_MONO_OFF = 'Consolas,"Courier New",monospace';



function fontSet() {
return FONT_SETS[LC.pref('lumen_font', FONT_DEFAULT)] || FONT_SETS[FONT_DEFAULT];
}

function bodyStack(set) {
return '"' + set.body + '","Segoe UI",Roboto,Arial,sans-serif';
}

function monoStack(set) {
return '"' + set.mono + '",Consolas,"Courier New",monospace';
}



LC.fontsUrl = function () {
var set = fontSet();
return 'https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800' +
'&family=' + set.body.replace(/ /g, '+') + ':wght@' + set.bodyW +
'&family=' + set.mono.replace(/ /g, '+') + ':wght@' + set.monoW +
'&display=swap';
};

function theme() {
var key = LC.pref(PLUGIN + '_accent', 'sand');
return ACCENTS[key] || ACCENTS.sand;
}





function useFonts() {
return LC.enabled() && LC.pref(PLUGIN + '_fonts', true);
}




LC.tokens = function () {
var t = theme();
var fonts = useFonts();
var set = fontSet();
return {
bg: C.bg, panel: C.panel, line: C.line, text: C.text, muted: C.muted, smoke: C.smoke,
spice: C.spice, dark: C.dark,
panelHi: C.panelHi, panelLo: C.panelLo, raised: C.raised, textRgb: hexToRgb(C.text), bgRgb: hexToRgb(C.bg),
accent: t.color, accentRgb: hexToRgb(t.color), onac: t.onac, ring: t.light, acglow: t.glow,
fontDisplay: fonts ? FONT_DISPLAY_ON : FONT_DISPLAY_OFF,
fontBody: fonts ? bodyStack(set) : FONT_BODY_OFF,
fontMono: fonts ? monoStack(set) : FONT_MONO_OFF
};
};

LC.buildCss = function () {
var t = theme();
var A = t.color;
var AL = t.light;
var AG = t.glow;
var A_RGB = hexToRgb(A);
var fonts = useFonts();
var set = fontSet();
var FD = fonts ? FONT_DISPLAY_ON : FONT_DISPLAY_OFF;
var FB = fonts ? bodyStack(set) : FONT_BODY_OFF;
var FM = fonts ? monoStack(set) : FONT_MONO_OFF;

var css = [];


css.push('.lumen-backdrop{position:absolute;top:0;left:0;width:100%;height:100vh;z-index:-1;overflow:hidden;opacity:0;-webkit-transition:opacity .5s ease;transition:opacity .5s ease;pointer-events:none}');
css.push('.lumen-backdrop.loaded{opacity:1}');
css.push('.lumen-backdrop__img{position:absolute;top:0;left:0;right:0;bottom:0;background-position:72% 32%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover}');










css.push('.lumen-backdrop .lumen-bg__img{position:absolute;top:0;right:0;bottom:0;left:0;background-position:72% 32%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover;opacity:0;-webkit-transition:opacity 1.2s ease-in-out;transition:opacity 1.2s ease-in-out}');
css.push('.lumen-backdrop .lumen-bg__img.is-active{opacity:1}');






css.push('.lumen-backdrop .lumen-bg__trailer{position:absolute;top:-10%;bottom:-10%;left:0;right:0;overflow:hidden;opacity:0;-webkit-transition:opacity 1s ease;transition:opacity 1s ease}');
css.push('.lumen-backdrop .lumen-bg__trailer.is-live{opacity:1}');
css.push('.lumen-backdrop .lumen-bg__trailer iframe{width:100%;height:100%;border:0;pointer-events:none}');



css.push('.lumen-backdrop.lumen-trailer-live .lumen-backdrop__veil{opacity:.45}');
css.push('.lumen-backdrop__veil{position:absolute;top:0;left:0;right:0;bottom:0;-webkit-transition:opacity 1s ease;transition:opacity 1s ease}');
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












css.push('.lumen-card .lumen-content{display:block}');
css.push('.lumen-card .lumen-content > .lumen-in{max-width:52em}');


css.push('.lumen-card .full-start-new__tagline,.lumen-card .full-start-new__reactions,.lumen-card .lumen-keep{display:none !important}');
css.push('.lumen-card.lumen--meta .full-start-new__head,.lumen-card.lumen--meta .full-start-new__details{display:none !important}');
css.push('.lumen-card .full-start__pg{display:none !important}');





css.push('.lumen-card .lumen-meta{font-family:' + FB + ';font-size:.88em;color:' + C.muted + ';letter-spacing:.03em;line-height:1.3;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
css.push('.lumen-card .lumen-meta > *{margin:0 .53em .2em 0}');
css.push('.lumen-card .lumen-meta__sep{color:' + C.line + '}');




css.push('.lumen-card .full-start-new__title{font-family:' + FD + ';font-size:3.86em;font-weight:800;line-height:1.02;letter-spacing:-.015em;margin:.70em 0 0 -.02em}');


css.push('.lumen-card .full-start-new__title.lumen-title--long{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:2;line-clamp:2}');





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






css.push('.lumen-card .full-start-new__rate-line .full-start__status{display:none}');
css.push('.lumen-card .lumen-next-chip{font-family:' + FB + ';font-weight:500;font-size:.79em;line-height:1;color:' + C.text + ';background:' + C.chipBg + ';border:.05em solid ' + C.line + ';border-radius:.67em;padding:0 .89em;white-space:nowrap;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card .lumen-next-chip:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.22em;height:1.22em;margin-right:.56em;background-color:' + C.muted + ';-webkit-mask-image:' + LC.icons.maskUrl('clock') + ';mask-image:' + LC.icons.maskUrl('clock') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain}');



css.push('.lumen-card.lumen-card--serial .full-start-new__rate-line .full-start__status{font-family:' + FB + ';font-weight:500;font-size:.79em;line-height:1;letter-spacing:normal;text-transform:none;color:' + C.text + ';background:' + C.chipBg + ';border:.05em solid ' + C.line + ';border-radius:.67em;padding:0 .89em;white-space:nowrap;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card.lumen-card--serial .full-start-new__rate-line .full-start__status:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:.56em;height:.56em;border-radius:50%;background:currentColor;margin-right:.56em}');










css.push('.lumen-card .lumen-progress{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center;width:33.32em;max-width:100%;margin-top:1.05em;font-family:' + FM + ';font-size:1em;color:' + C.muted + ';letter-spacing:.04em}');
css.push('.lumen-card .lumen-progress__label{font-size:.79em;line-height:1;color:' + C.muted + '}');
css.push('.lumen-card .lumen-progress__time{font-size:.79em;line-height:1;color:' + C.muted + ';margin-left:.35em}');
css.push('.lumen-card .lumen-progress__label:empty,.lumen-card .lumen-progress__time:empty{display:none}');
css.push('.lumen-card .lumen-progress__bar{-webkit-box-flex:0;-webkit-flex:0 0 100%;flex:0 0 100%;width:100%;height:.18em;background:rgba(243,237,228,0.16);border-radius:.09em;overflow:hidden;margin:.44em 0 0}');
css.push('.lumen-card .lumen-progress__bar > div{height:100%;width:0;border-radius:.09em;background:' + A + '}');









css.push('.lumen-card.lumen-continue:not(.lumen-trailer-on) .full-start-new__buttons .button--play:after{content:var(--lumen-play-label);font-size:1.05em;line-height:1;margin-left:.53em;white-space:nowrap}');
css.push('@supports (--lumen-probe:0){.lumen-card.lumen-continue:not(.lumen-trailer-on) .full-start-new__buttons .button--play span{display:none}}');




css.push('.lumen-card .full-start-new__buttons{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-top:1.40em;overflow:visible}');



css.push('.lumen-card .full-start-new__buttons .full-start__button{font-size:1em;font-weight:600;height:3.16em;min-width:3.16em;padding:0 1.32em;margin:0 .70em .6em 0;border-radius:.79em;border:.04em solid ' + C.line + ';background:' + C.buttonBg + ';-webkit-backdrop-filter:blur(.88em);backdrop-filter:blur(.88em);color:' + C.text + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;-webkit-transition:width .2s,padding .2s,background-color .2s,border-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),-webkit-box-shadow .28s;transition:width .2s,padding .2s,background-color .2s,border-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),box-shadow .28s}');
css.push('.lumen-card .full-start-new__buttons .full-start__button > svg{width:1.14em;height:1.14em;-webkit-flex-shrink:0;flex-shrink:0}');
css.push('.lumen-card .full-start-new__buttons .full-start__button > svg + span{font-size:1.05em;margin:0 0 0 .53em;line-height:1}');
css.push('.lumen-card .full-start-new__buttons .full-start__button span{display:none}');
css.push('.lumen-card .full-start-new__buttons .button--play span,.lumen-card .full-start-new__buttons .button--priority span,.lumen-card .full-start-new__buttons .view--trailer span{display:block}');




















css.push('.lumen-card .full-start-new__buttons > .buttons--container{-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-order:1;order:1}');
css.push('.lumen-card .full-start-new__buttons > .buttons--container > .full-start__button{display:none}');
css.push('.lumen-card.lumen-card--trailer .full-start-new__buttons > .buttons--container{display:-webkit-box !important;display:-webkit-flex !important;display:flex !important}');
css.push('.lumen-card.lumen-card--trailer .full-start-new__buttons > .buttons--container > .view--trailer{display:-webkit-box;display:-webkit-flex;display:flex}');





css.push('.lumen-card .full-start-new__buttons > .button--book,.lumen-card .full-start-new__buttons > .button--reaction,.lumen-card .full-start-new__buttons > .button--subscribe,.lumen-card .full-start-new__buttons > .button--options{-webkit-order:2;order:2}');







css.push('.lumen-card .full-start-new__buttons .full-start__button.active{background:rgba(' + A_RGB + ',.16);border-color:' + A + ';color:' + A + '}');


css.push('.lumen-card .full-start-new__buttons .button--book,.lumen-card .full-start-new__buttons .button--reaction,.lumen-card .full-start-new__buttons .button--subscribe,.lumen-card .full-start-new__buttons .button--options{padding:0;width:3.16em}');
css.push('.lumen-card .full-start-new__buttons .button--book.focus,.lumen-card .full-start-new__buttons .button--reaction.focus,.lumen-card .full-start-new__buttons .button--subscribe.focus,.lumen-card .full-start-new__buttons .button--options.focus{width:auto;padding:0 1.05em}');
css.push('.lumen-card .full-start-new__buttons .full-start__button.focus span{display:block}');



css.push('.lumen-card .full-start-new__buttons .full-start__button.focus{background:' + A + ';color:' + C.dark + ';border-color:' + AL + ';border-width:.11em;-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .614em 1.754em ' + AG + ';box-shadow:0 .614em 1.754em ' + AG + '}');


css.push('.lumen-card .full-start-new__buttons .full-start__button.focus.lumen-press{background:#C4924F !important;border-color:rgba(255,242,220,.6) !important;-webkit-transform:scale(1) !important;transform:scale(1) !important}');
css.push('.lumen-card .full-start-new__buttons .full-start__button.loading:before{filter:none}');







css.push('.lumen-card .lumen-stop{display:none;font-family:' + FB + ';font-weight:600;font-size:1em;height:3.16em;padding:0 1.32em;margin:0 .70em .6em 0;border-radius:.79em;border:.04em solid rgba(243,237,228,.2);background:rgba(11,9,8,.5);-webkit-backdrop-filter:blur(.88em);backdrop-filter:blur(.88em);color:' + C.text + ';white-space:nowrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;-webkit-transition:background-color .2s,border-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),-webkit-box-shadow .28s;transition:background-color .2s,border-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),box-shadow .28s}');







css.push('.lumen-card.lumen-trailer-on .lumen-stop{display:-webkit-box;display:-webkit-flex;display:flex;margin-top:1.40em;margin-bottom:.6em}');
css.push('.lumen-card .lumen-stop__ico{-webkit-flex-shrink:0;flex-shrink:0;width:1.14em;height:1.14em;margin-right:.53em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('stop') + ';mask-image:' + LC.icons.maskUrl('stop') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');
css.push('.lumen-card .lumen-stop span{font-size:1.05em;line-height:1}');
css.push('.lumen-card .lumen-stop.focus{background:' + A + ';color:' + C.dark + ';border-color:' + AL + ';border-width:.11em;-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .614em 1.754em ' + AG + ';box-shadow:0 .614em 1.754em ' + AG + '}');



css.push('.lumen-card .lumen-trailer-badge{display:none;position:absolute;top:4.91em;right:2.81em;z-index:6;font-family:' + FB + ';font-size:.79em;line-height:1;letter-spacing:.06em;color:' + C.text + ';background:rgba(11,9,8,.62);border:.05em solid rgba(243,237,228,.2);border-radius:1.67em;padding:.56em 1em;-webkit-backdrop-filter:blur(1.1em);backdrop-filter:blur(1.1em);-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card.lumen-trailer-on .lumen-trailer-badge{display:-webkit-box;display:-webkit-flex;display:flex}');
css.push('.lumen-card .lumen-trailer-badge:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.22em;height:1.22em;margin-right:.67em;background-color:' + A + ';-webkit-mask-image:' + LC.icons.maskUrl('mute') + ';mask-image:' + LC.icons.maskUrl('mute') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');




css.push('.lumen-card.lumen-trailer-on .full-start-new__title{font-size:1.84em;opacity:.92}');


css.push('.lumen-card.lumen-trailer-on .lumen-descr,.lumen-card.lumen-trailer-on .full-start-new__rate-line,.lumen-card.lumen-trailer-on .lumen-episodes,.lumen-card.lumen-trailer-on .lumen-progress{display:none !important}');
css.push('.lumen-card.lumen-trailer-on .lumen-actions{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');



css.push('.lumen-card .lumen-status--good:before{color:' + C.good + '}');
css.push('.lumen-card .lumen-status--accent:before{color:' + A + '}');
css.push('.lumen-card .lumen-status--muted:before,.lumen-card .lumen-status--soon:before{color:' + C.smoke + '}');







css.push('.lumen-card .full-start-new__rate-line .lumen-tags{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card .lumen-tags .full-start__tag{display:none !important}');


css.push('.lumen-card .lumen-quality-chip{font-family:' + FB + ';font-weight:600;font-size:.66em;letter-spacing:.08em;color:' + C.text + ';border:.04em solid rgba(243,237,228,.24);border-radius:.31em;padding:.31em .48em;margin:0 .35em .35em 0;white-space:nowrap}');







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








css.push('.lumen-card .lumen-episode__state{display:none;font-family:' + FM + ';font-weight:600;font-size:.75em;line-height:1;letter-spacing:.1em;text-transform:uppercase;color:' + A + ';margin:0 auto 0 .35em}');
css.push('.lumen-card .lumen-episode__timecode{display:none;font-family:' + FM + ';font-size:.70em;line-height:1;color:' + C.muted + ';margin-top:.44em;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
css.push('.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__state,.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__timecode{display:block}');
css.push('.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__caption{display:none}');

css.push(LC.icons.NO_MASK + '{.lumen-card .lumen-next-chip:before,.lumen-card .lumen-episode__check,.lumen-card .lumen-episode__play:before{display:none}}');























css.push('.lumen-descr-row > .items-line__head{display:none}');





















css.push('.lumen-descr-row .full-descr{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:start;-webkit-align-items:flex-start;align-items:flex-start;-webkit-flex-wrap:wrap;flex-wrap:wrap;padding-left:2.81em;padding-right:2.81em}');









css.push('.lumen-descr-row .full-descr__left{-webkit-box-flex:1;-webkit-flex:1 1 42.96em;flex:1 1 42.96em;max-width:42.96em;min-width:0;margin-right:3.51em}');























css.push('.lumen-descr-row .full-descr__text{-webkit-box-sizing:border-box;box-sizing:border-box;font-family:' + FB + ';font-weight:400;font-size:1.05em;line-height:1.45;color:' + C.text + ';max-width:42.96em;width:auto;max-height:70vh;padding:.75em 1em;border-radius:.58em;background:rgba(' + BG_RGB + ',.85);-webkit-mask-image:none;mask-image:none}');
css.push('.lumen-descr-row .full-descr__details{display:none}');





















css.push('.lumen-descr-row .lumen-facts{-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-box-flex:1;-webkit-flex:1 1 19.73em;flex:1 1 19.73em;min-width:19.73em;max-width:100%;padding:.79em 1.05em;border-radius:.61em;background:rgba(' + BG_RGB + ',.85);border:.04em solid ' + C.line + '}');

css.push('.lumen-descr-row .lumen-facts__title{font-family:' + FB + ';font-weight:600;font-size:.79em;line-height:1;letter-spacing:.14em;color:' + C.muted + ';margin-bottom:.79em}');












css.push('.lumen-descr-row .lumen-facts__grid{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;display:grid;grid-template-columns:auto 1fr;grid-row-gap:.35em;grid-column-gap:1.05em;row-gap:.35em;column-gap:1.05em}');




css.push('.lumen-descr-row .lumen-facts__label{font-family:' + FB + ';font-weight:400;font-size:.88em;line-height:1.3;color:' + C.muted + ';white-space:nowrap}');
css.push('.lumen-descr-row .lumen-facts__value{font-family:' + FB + ';font-weight:500;font-size:.88em;line-height:1.3;color:' + C.text + ';min-width:0;word-wrap:break-word;overflow-wrap:break-word}');




css.push('@supports not (display:grid){.lumen-descr-row .lumen-facts__label{width:6.3em;margin:0 1.2em .5em 0}.lumen-descr-row .lumen-facts__value{-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;min-width:0;margin-bottom:.5em}}');








css.push('.lumen-descr-row .lumen-reviews{width:100%;-webkit-flex-basis:100%;flex-basis:100%;margin-top:1.75em}');













css.push('.lumen-descr-row.lumen-descr-row--reviews .full-descr__text{display:-webkit-box;-webkit-line-clamp:8;-webkit-box-orient:vertical;overflow:hidden;max-height:70vh;-webkit-mask-image:-webkit-linear-gradient(top,#000 86%,rgba(0,0,0,0) 100%);-webkit-mask-image:linear-gradient(180deg,#000 86%,rgba(0,0,0,0) 100%);mask-image:linear-gradient(180deg,#000 86%,rgba(0,0,0,0) 100%)}');






css.push('.lumen-descr-row .lumen-reviews__head{display:-webkit-inline-box;display:-webkit-inline-flex;display:inline-flex;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-sizing:border-box;box-sizing:border-box;max-width:100%;margin:0 0 .79em -.7em;padding:.44em .7em;border-radius:.61em;background:rgba(' + BG_RGB + ',.85)}');


css.push('.lumen-descr-row .lumen-reviews__ico{width:1.05em;height:1.05em;-webkit-flex-shrink:0;flex-shrink:0;background-color:' + C.muted + ';-webkit-mask-image:' + LC.icons.maskUrl('comment') + ';mask-image:' + LC.icons.maskUrl('comment') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-right:.44em;-webkit-align-self:center;align-self:center}');
css.push('.lumen-descr-row .lumen-reviews__title{font-family:' + FD + ';font-weight:700;font-size:1.40em;line-height:1;color:' + C.text + ';margin-right:.61em}');

css.push('.lumen-descr-row .lumen-reviews__src{font-family:' + FB + ';font-weight:600;font-size:.70em;line-height:1;letter-spacing:.16em;color:' + A + ';margin-right:.61em}');




css.push('.lumen-descr-row .lumen-reviews__total{font-family:' + FM + ';font-weight:400;font-size:.88em;line-height:1;letter-spacing:.08em;color:' + C.muted + '}');



css.push('.lumen-descr-row .lumen-reviews__row{display:-webkit-box;display:-webkit-flex;display:flex;overflow:hidden;padding:.26em 0}');
css.push('.lumen-descr-row .lumen-review{position:relative;-webkit-box-sizing:border-box;box-sizing:border-box;width:21.04em;height:11.4em;-webkit-box-flex:0;-webkit-flex:none;flex:none;margin-right:.88em;border-radius:.61em;overflow:hidden;background:linear-gradient(180deg,#0C0D0F,#161825);border:.04em solid ' + C.line + ';color:' + C.text + ';display:-webkit-box;display:-webkit-flex;display:flex}');


css.push('.lumen-descr-row .lumen-review__tone{width:.18em;-webkit-box-flex:0;-webkit-flex:none;flex:none;background:' + C.muted + '}');
css.push('.lumen-descr-row .lumen-review--good .lumen-review__tone{background:' + C.good + '}');
css.push('.lumen-descr-row .lumen-review--bad .lumen-review__tone{background:' + C.spice + '}');
css.push('.lumen-descr-row .lumen-review__body{-webkit-box-sizing:border-box;box-sizing:border-box;padding:.96em;min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column}');
css.push('.lumen-descr-row .lumen-review__top{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;margin-bottom:.53em}');


css.push('.lumen-descr-row .lumen-review__ava{-webkit-box-sizing:border-box;box-sizing:border-box;width:2.53em;height:2.53em;-webkit-box-flex:0;-webkit-flex:none;flex:none;border-radius:50%;background:' + C.panel + ';font-family:' + FB + ';font-weight:500;font-size:.83em;line-height:2.53em;text-align:center;color:' + C.muted + ';margin-right:.63em;overflow:hidden}');
css.push('.lumen-descr-row .lumen-review__who{min-width:0}');
css.push('.lumen-descr-row .lumen-review__author{font-family:' + FB + ';font-weight:600;font-size:.88em;line-height:1.1;color:' + C.text + ';margin-bottom:.25em;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;white-space:nowrap}');




css.push('.lumen-descr-row .lumen-review__meta{font-family:' + FM + ';font-weight:400;font-size:.66em;line-height:1.2;color:' + C.muted + '}');
css.push('.lumen-descr-row .lumen-review__meta > span{margin-right:.66em}');
css.push('.lumen-descr-row .lumen-review__tag{color:' + C.muted + '}');
css.push('.lumen-descr-row .lumen-review--good .lumen-review__tag{color:' + C.good + '}');
css.push('.lumen-descr-row .lumen-review--bad .lumen-review__tag{color:' + C.spice + '}');

css.push('.lumen-descr-row .lumen-review__likes:before{content:"";display:inline-block;vertical-align:-.1em;width:1em;height:1em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('star') + ';mask-image:' + LC.icons.maskUrl('star') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-right:.33em}');
css.push('.lumen-descr-row .lumen-review__title{font-family:' + FB + ';font-weight:600;font-size:1.05em;line-height:1.25;color:' + C.text + ';margin-bottom:.53em;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;white-space:nowrap}');



css.push('.lumen-descr-row .lumen-review__text{font-family:' + FB + ';font-weight:400;font-size:.83em;line-height:1.45;color:' + C.muted + ';display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}');
css.push('.lumen-descr-row .lumen-review.focus{border:.13em solid ' + A + ';-webkit-transform:scale(1.03);transform:scale(1.03);-webkit-box-shadow:0 .614em 1.754em ' + AG + ';box-shadow:0 .614em 1.754em ' + AG + '}');
css.push('.lumen-descr-row .lumen-review.focus .lumen-review__title{white-space:normal}');



css.push('body.lumen-motion-full .lumen-descr-row .lumen-review{-webkit-transition:border-color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),-webkit-box-shadow .28s;transition:border-color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),box-shadow .28s}');
css.push('body.lumen-motion-lite .lumen-descr-row .lumen-review.focus,body.lumen-motion-off .lumen-descr-row .lumen-review.focus{-webkit-transform:none;transform:none}');


css.push('.lumen-descr-row .lumen-reviews__hint{-webkit-box-sizing:border-box;box-sizing:border-box;max-width:28.06em;border-radius:.61em;background:linear-gradient(180deg,#120E0B,' + C.bg + ');border:.04em solid ' + C.line + ';padding:1.40em}');
css.push('.lumen-descr-row .lumen-reviews__hint-ico{width:2.10em;height:2.10em;background-color:' + A + ';-webkit-mask-image:' + LC.icons.maskUrl('comment') + ';mask-image:' + LC.icons.maskUrl('comment') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-bottom:.70em}');
css.push('.lumen-descr-row .lumen-reviews__hint-title{font-family:' + FD + ';font-weight:700;font-size:1.23em;line-height:1.15;color:' + C.text + ';margin-bottom:.44em}');
css.push('.lumen-descr-row .lumen-reviews__hint-text{font-family:' + FB + ';font-weight:400;font-size:.88em;line-height:1.4;color:' + C.muted + ';margin-bottom:.70em}');
css.push('.lumen-descr-row .lumen-reviews__hint-path{display:inline-block;padding:.61em .79em;border-radius:.53em;background:rgba(' + A_RGB + ',.1);border:.04em solid rgba(' + A_RGB + ',.4);font-family:' + FB + ';font-weight:500;font-size:.79em;line-height:1.3;color:' + A + '}');






css.push('.lumen-review-modal{display:-webkit-box;display:-webkit-flex;display:flex;border-radius:.61em;overflow:hidden;background:linear-gradient(180deg,' + C.panel + ',#120E0B);border:.04em solid ' + C.line + ';color:' + C.text + '}');
css.push('.lumen-review-modal__tone{width:.18em;-webkit-box-flex:0;-webkit-flex:none;flex:none;background:' + C.muted + '}');
css.push('.lumen-review-modal--good .lumen-review-modal__tone{background:' + C.good + '}');
css.push('.lumen-review-modal--bad .lumen-review-modal__tone{background:' + C.spice + '}');
css.push('.lumen-review-modal__body{-webkit-box-sizing:border-box;box-sizing:border-box;padding:1.75em;min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto}');
css.push('.lumen-review-modal__top{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between}');

css.push('.lumen-review-modal__ava{-webkit-box-sizing:border-box;box-sizing:border-box;width:2.82em;height:2.82em;-webkit-box-flex:0;-webkit-flex:none;flex:none;border-radius:50%;background:' + C.bg + ';border:.05em solid ' + C.line + ';font-family:' + FB + ';font-weight:500;font-size:.96em;line-height:2.72em;text-align:center;color:' + C.muted + ';margin-right:.64em}');
css.push('.lumen-review-modal__who{min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto}');
css.push('.lumen-review-modal__author{font-family:' + FB + ';font-weight:600;font-size:1.14em;line-height:1.1;margin-bottom:.26em}');


css.push('.lumen-review-modal__meta{font-family:' + FM + ';font-weight:400;font-size:.70em;line-height:1.2;color:' + C.muted + '}');
css.push('.lumen-review-modal__meta > span{margin-right:.75em}');
css.push('.lumen-review-modal--good .lumen-review-modal__tag{color:' + C.good + '}');
css.push('.lumen-review-modal--bad .lumen-review-modal__tag{color:' + C.spice + '}');
css.push('.lumen-review-modal__likes:before{content:"";display:inline-block;vertical-align:-.1em;width:1em;height:1em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('star') + ';mask-image:' + LC.icons.maskUrl('star') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-right:.33em}');
css.push('.lumen-review-modal__src{font-family:' + FM + ';font-weight:600;font-size:.70em;line-height:1;letter-spacing:.16em;color:' + C.muted + ';-webkit-box-flex:0;-webkit-flex:none;flex:none;margin-left:.88em}');
css.push('.lumen-review-modal__line{height:.04em;background:' + C.line + ';margin:.88em 0}');
css.push('.lumen-review-modal__title{font-family:' + FD + ';font-weight:700;font-size:1.58em;line-height:1.18;margin-bottom:.88em}');


css.push('.lumen-review-modal__text{font-family:' + FB + ';font-weight:400;font-size:.96em;line-height:1.5;color:' + C.muted + ';max-height:50vh;overflow:auto}');

css.push(LC.icons.NO_MASK + '{.lumen-descr-row .lumen-reviews__ico,.lumen-descr-row .lumen-reviews__hint-ico,.lumen-descr-row .lumen-review__likes:before,.lumen-review-modal__likes:before{display:none}}');





css.push('@media screen and (max-width:1000px){.lumen-card .full-start-new__title{font-size:2.43em}.lumen-card .full-start-new__body{min-height:0}}');





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







css.push('.lumen-card.lumen-motion-lite .lumen-stop.focus,.lumen-card.lumen-motion-off .lumen-stop.focus{background:' + A + ';-webkit-transform:none !important;transform:none !important}');

































css.push('.lumen-card.lumen-motion-lite .full-start-new__buttons .full-start__button,.lumen-card.lumen-motion-off .full-start-new__buttons .full-start__button{-webkit-backdrop-filter:none;backdrop-filter:none}');
css.push('.lumen-card.lumen-motion-lite .lumen-stop,.lumen-card.lumen-motion-off .lumen-stop{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgba(' + BG_RGB + ',.9)}');
css.push('.lumen-card.lumen-motion-lite .lumen-trailer-badge,.lumen-card.lumen-motion-off .lumen-trailer-badge{-webkit-backdrop-filter:none;backdrop-filter:none;background:rgba(' + BG_RGB + ',.9)}');






css.push('.lumen-backdrop.lumen-motion-full .lumen-bg__img.is-active{-webkit-animation:lumen-kb 14s linear forwards;animation:lumen-kb 14s linear forwards}');
css.push('@-webkit-keyframes lumen-kb{from{-webkit-transform:scale(1)}to{-webkit-transform:scale(1.08)}}');
css.push('@keyframes lumen-kb{from{transform:scale(1)}to{transform:scale(1.08)}}');

















css.push('.lumen-card .full-start-new__title,.lumen-card .full-start-new__rate-line,.lumen-card .full-start-new__buttons{-webkit-transition:font-size .28s cubic-bezier(.2,.9,.3,1.25),margin-top .28s cubic-bezier(.2,.9,.3,1.25);transition:font-size .28s cubic-bezier(.2,.9,.3,1.25),margin-top .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('.lumen-card.lumen-compact .full-start-new__title{font-size:2.104em}');
css.push('.lumen-card.lumen-compact .lumen-descr{display:none}');
css.push('.lumen-card.lumen-compact .full-start-new__rate-line{margin-top:.87em}');
css.push('.lumen-card.lumen-compact .full-start-new__buttons{margin-top:.95em}');







css.push('.lumen-card .lumen-next-chip__short{display:none}');
css.push('.lumen-card.lumen-compact .lumen-next-chip__text{display:none}');
css.push('.lumen-card.lumen-compact .lumen-next-chip__short{display:block}');
css.push('.lumen-card.lumen-compact .lumen-next-chip{border-left:0;border-top-left-radius:0;border-bottom-left-radius:0;padding-left:0}');
css.push('.lumen-card.lumen-compact .lumen-next-chip:before{display:none}');
css.push('.lumen-card.lumen-card--nextchip.lumen-compact .full-start-new__rate-line .full-start__status{margin-right:0 !important;border-right:0;border-top-right-radius:0;border-bottom-right-radius:0;padding-right:.45em}');
css.push('.lumen-card.lumen-motion-lite .full-start-new__title,.lumen-card.lumen-motion-lite .full-start-new__rate-line,.lumen-card.lumen-motion-lite .full-start-new__buttons,.lumen-card.lumen-motion-off .full-start-new__title,.lumen-card.lumen-motion-off .full-start-new__rate-line,.lumen-card.lumen-motion-off .full-start-new__buttons{-webkit-transition:none;transition:none}');








css.push('.lumen-card .lumen-franchise{display:none;font-family:' + FB + ';font-weight:600;font-size:1em;height:3.16em;padding:0 1.32em;margin:1.40em .70em .6em 0;border-radius:.79em;border:.04em solid ' + C.line + ';background:' + C.buttonBg + ';color:' + C.text + ';white-space:nowrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;-webkit-transition:background-color .2s,border-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),-webkit-box-shadow .28s;transition:background-color .2s,border-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),box-shadow .28s}');





css.push('.lumen-card.lumen-card--franchise .lumen-franchise{display:-webkit-box;display:-webkit-flex;display:flex}');
css.push('.lumen-card.lumen-card--franchise .lumen-actions{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
css.push('.lumen-card.lumen-card--franchise .full-start-new__reactions,.lumen-card.lumen-card--franchise .lumen-episodes{-webkit-flex-basis:100%;flex-basis:100%;width:100%}');
css.push('.lumen-card .lumen-franchise__ico{-webkit-flex-shrink:0;flex-shrink:0;width:1.14em;height:1.14em;margin-right:.53em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('film') + ';mask-image:' + LC.icons.maskUrl('film') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');
css.push('.lumen-card .lumen-franchise span{font-size:1.05em;line-height:1}');
css.push('.lumen-card .lumen-franchise.focus{background:' + A + ';color:' + C.dark + ';border-color:' + AL + ';border-width:.11em;-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .614em 1.754em ' + AG + ';box-shadow:0 .614em 1.754em ' + AG + '}');
css.push('.lumen-card.lumen-motion-lite .lumen-franchise.focus,.lumen-card.lumen-motion-off .lumen-franchise.focus{background:' + A + ';-webkit-transform:none !important;transform:none !important}');


css.push(LC.icons.NO_MASK + '{.lumen-card .lumen-franchise__ico{display:none}}');




css.push('.lumen-hub{padding:2.81em 2.81em 3.5em 2.81em;color:' + C.text + '}');
css.push('.lumen-hub__head{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-bottom:1.4em}');
css.push('.lumen-hub__title{font-family:' + FD + ';font-weight:700;font-size:2.28em;line-height:1;margin-right:.6em}');
css.push('.lumen-hub__count{font-family:' + FM + ';font-size:.88em;color:' + C.smoke + '}');
css.push('.lumen-hub__search{font-family:' + FM + ';font-size:.88em;letter-spacing:.06em;color:' + C.smoke + ';margin-left:auto}');
css.push('.lumen-hub__empty{font-family:' + FB + ';font-size:1.05em;color:' + C.muted + ';padding:2em 0}');
css.push('.lumen-hub__chips{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-bottom:1.4em}');
css.push('.lumen-hub__tiles{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap}');




css.push('.lumen-hub .lumen-chip,.lumen-grid .lumen-chip{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:2.46em;padding:0 1.05em;margin:0 .53em .53em 0;border-radius:.53em;border:.04em solid ' + C.line + ';background:' + C.buttonBg + ';font-family:' + FB + ';font-weight:600;font-size:.92em;line-height:1;color:' + C.muted + ';white-space:nowrap;-webkit-transition:background-color .2s,border-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,border-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('.lumen-hub .lumen-chip__count{font-family:' + FM + ';font-size:.8em;margin-left:.6em;color:' + C.smoke + '}');


css.push('.lumen-hub .lumen-chip.lumen-chip--on,.lumen-grid .lumen-chip.lumen-chip--on{color:' + A + ';border-color:' + A + ';background:rgba(' + A_RGB + ',.14)}');
css.push('.lumen-hub .lumen-chip.focus,.lumen-grid .lumen-chip.focus{background:' + A + ';color:' + t.onac + ';border-color:' + AL + ';border-width:.11em;-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .53em 1.53em ' + AG + ';box-shadow:0 .53em 1.53em ' + AG + '}');
css.push('.lumen-hub.lumen-motion-lite .lumen-chip.focus,.lumen-hub.lumen-motion-off .lumen-chip.focus,.lumen-grid.lumen-motion-lite .lumen-chip.focus,.lumen-grid.lumen-motion-off .lumen-chip.focus{-webkit-transform:none;transform:none}');
css.push('.lumen-hub.lumen-motion-off .lumen-chip,.lumen-grid.lumen-motion-off .lumen-chip{-webkit-transition:none;transition:none}');



css.push('.lumen-hub__tiles .lumen-tile{position:relative;width:-webkit-calc((100% - 2.64em) / 4);width:calc((100% - 2.64em) / 4);margin:0 .88em .88em 0;border-radius:.44em;overflow:hidden;background:' + C.panel + ';border:.04em solid ' + C.line + ';-webkit-transition:border-color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),-webkit-box-shadow .28s;transition:border-color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),box-shadow .28s}');
css.push('.lumen-hub__tiles .lumen-tile:nth-child(4n){margin-right:0}');

css.push('.lumen-hub__tiles .lumen-tile:before{content:"";display:block;padding-top:56.25%}');
css.push('.lumen-hub .lumen-tile__collage{position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden}');
css.push('.lumen-hub .lumen-tile__poster{position:absolute;width:5.70em;height:8.55em;border-radius:.31em;-webkit-background-size:cover;background-size:cover;background-position:center;-webkit-box-shadow:0 .4em 1.2em rgba(0,0,0,.5);box-shadow:0 .4em 1.2em rgba(0,0,0,.5)}');
css.push('.lumen-hub .lumen-tile__poster--1{left:1.1em;top:-.88em;-webkit-transform:rotate(-6deg);transform:rotate(-6deg)}');
css.push('.lumen-hub .lumen-tile__poster--2{left:6.2em;top:-.44em;-webkit-transform:rotate(2deg);transform:rotate(2deg)}');
css.push('.lumen-hub .lumen-tile__poster--3{left:11.3em;top:-1.1em;-webkit-transform:rotate(8deg);transform:rotate(8deg)}');
css.push('.lumen-hub .lumen-tile__scrim{position:absolute;top:0;left:0;right:0;bottom:0;background:-webkit-linear-gradient(bottom,rgba(' + BG_RGB + ',.98) 0%,rgba(' + BG_RGB + ',.7) 40%,rgba(' + BG_RGB + ',.2) 100%);background:linear-gradient(0deg,rgba(' + BG_RGB + ',.98) 0%,rgba(' + BG_RGB + ',.7) 40%,rgba(' + BG_RGB + ',.2) 100%)}');
css.push('.lumen-hub .lumen-tile__text{position:absolute;left:.88em;right:.88em;bottom:.7em}');
css.push('.lumen-hub .lumen-tile__title{font-family:' + FD + ';font-weight:700;font-size:1.27em;line-height:1.06;color:' + C.text + ';overflow:hidden}');
css.push('.lumen-hub .lumen-tile__sub{font-family:' + FM + ';font-size:.88em;line-height:1;color:' + C.muted + ';margin-top:.35em;overflow:hidden}');
css.push('.lumen-hub .lumen-tile__nokey{display:none;position:absolute;top:.7em;right:.7em;font-family:' + FM + ';font-size:.7em;letter-spacing:.04em;color:' + C.text + ';background:rgba(' + BG_RGB + ',.8);border:.05em solid rgba(' + hexToRgb(C.text) + ',.3);border-radius:.2em;padding:.25em .45em}');
css.push('.lumen-hub .lumen-tile--nokey .lumen-tile__nokey{display:block}');
css.push('.lumen-hub__tiles .lumen-tile.focus{border-color:' + AL + ';border-width:.13em;-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .7em 1.97em ' + AG + ';box-shadow:0 .7em 1.97em ' + AG + '}');
css.push('.lumen-hub.lumen-motion-lite .lumen-tile.focus,.lumen-hub.lumen-motion-off .lumen-tile.focus{-webkit-transform:none;transform:none}');
css.push('.lumen-hub.lumen-motion-off .lumen-tile{-webkit-transition:none;transition:none}');




css.push('.lumen-grid{padding:2.81em 2.81em 3.5em 2.81em;color:' + C.text + '}');
css.push('.lumen-grid__head{margin-bottom:1.05em}');
css.push('.lumen-grid__title{font-family:' + FD + ';font-weight:700;font-size:2.10em;line-height:1}');
css.push('.lumen-grid__sub{font-family:' + FM + ';font-size:.88em;color:' + C.smoke + ';margin-top:.5em}');
css.push('.lumen-grid__sorts{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-bottom:1.4em}');
css.push('.lumen-grid__items{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap}');




css.push('.lumen-grid__items .lumen-gcard{-webkit-flex-shrink:0;flex-shrink:0;width:-webkit-calc((100% - 4.4em) / 6);width:calc((100% - 4.4em) / 6);margin:0 .88em 1.4em 0;position:relative;-webkit-transition:-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:transform .28s cubic-bezier(.2,.9,.3,1.25)}');
css.push('.lumen-grid__items .lumen-gcard:nth-child(6n){margin-right:0}');
css.push('.lumen-grid .lumen-gcard .card__view{margin-bottom:.5em;border-radius:.31em;background-color:' + C.panel + '}');
css.push('.lumen-grid .lumen-gcard .card__img{border-radius:.31em;background-color:' + C.panelLo + '}');
css.push('.lumen-grid .lumen-gcard .card__title{font-family:' + FD + ';font-weight:700;font-size:.96em;line-height:1.15;color:' + C.text + '}');
css.push('.lumen-grid .lumen-gcard .card__age{font-family:' + FM + ';font-size:.88em;line-height:1;margin-top:.25em;color:' + C.muted + '}');



css.push('.lumen-grid__items .lumen-gcard.focus{-webkit-transform:scale(1.08);transform:scale(1.08);z-index:3}');
css.push('.lumen-grid .lumen-gcard.focus .card__view:after{border-width:.13em;border-color:' + AL + ';border-radius:.44em;-webkit-box-shadow:0 .7em 1.97em ' + AG + ';box-shadow:0 .7em 1.97em ' + AG + '}');
css.push('.lumen-grid.lumen-motion-lite .lumen-gcard.focus,.lumen-grid.lumen-motion-off .lumen-gcard.focus{-webkit-transform:none;transform:none}');
css.push('.lumen-grid.lumen-motion-off .lumen-gcard{-webkit-transition:none;transition:none}');


css.push('.lumen-grid .lumen-gcard__bar{position:absolute;left:.53em;right:.53em;bottom:.53em;height:.18em;border-radius:.09em;background:rgba(' + hexToRgb(C.text) + ',.2);overflow:hidden}');
css.push('.lumen-grid .lumen-gcard__bar > div{height:100%;border-radius:.09em;background:' + A + '}');
css.push('.lumen-grid__empty{padding:2em 0}');
css.push('.lumen-grid .lumen-grid__empty-text{font-family:' + FB + ';font-size:1.05em;color:' + C.muted + ';margin-bottom:1.05em;max-width:42.96em}');
css.push('.lumen-grid .lumen-grid__back{display:-webkit-inline-box;display:-webkit-inline-flex;display:inline-flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:3.16em;padding:0 1.32em;border-radius:.79em;border:.04em solid ' + C.line + ';background:' + C.buttonBg + ';font-family:' + FB + ';font-weight:600;font-size:1em;color:' + C.text + '}');
css.push('.lumen-grid .lumen-grid__back.focus{background:' + A + ';color:' + t.onac + ';border-color:' + AL + ';border-width:.11em}');











css.push('.lumen-hero{position:absolute;top:-4em;left:0;right:0;height:58vh;overflow:hidden;pointer-events:none}');

css.push('.lumen-hero.lumen-hero--compact{height:42vh}');
css.push('.lumen-hero.lumen-motion-full{-webkit-transition:height .42s cubic-bezier(.2,.8,.2,1);transition:height .42s cubic-bezier(.2,.8,.2,1)}');




css.push('.lumen-hero .lumen-hero__bg{position:absolute;top:0;left:0;right:0;bottom:0;-webkit-background-size:cover;background-size:cover;background-position:center top;background-repeat:no-repeat;opacity:0}');
css.push('.lumen-hero .lumen-hero__bg.is-active{opacity:1}');
css.push('.lumen-hero.lumen-motion-full .lumen-hero__bg{-webkit-transition:opacity .6s ease-in-out;transition:opacity .6s ease-in-out}');



css.push('.lumen-hero.lumen-motion-full.lumen-hero--blur .lumen-hero__bg{-webkit-filter:blur(1.75em);filter:blur(1.75em);-webkit-transform:scale(1.1);transform:scale(1.1)}');



css.push('.lumen-hero .lumen-hero__veil{position:absolute;top:0;left:0;right:0;bottom:0}');
css.push('.lumen-hero .lumen-hero__veil--l{background:-webkit-linear-gradient(left,rgba(' + BG_RGB + ',.94) 0%,rgba(' + BG_RGB + ',.6) 38%,rgba(' + BG_RGB + ',0) 72%);background:linear-gradient(90deg,rgba(' + BG_RGB + ',.94) 0%,rgba(' + BG_RGB + ',.6) 38%,rgba(' + BG_RGB + ',0) 72%)}');
css.push('.lumen-hero .lumen-hero__veil--b{background:-webkit-linear-gradient(bottom,' + C.bg + ' 0%,rgba(' + BG_RGB + ',.86) 16%,rgba(' + BG_RGB + ',0) 62%);background:linear-gradient(0deg,' + C.bg + ' 0%,rgba(' + BG_RGB + ',.86) 16%,rgba(' + BG_RGB + ',0) 62%)}');






css.push('.lumen-hero .lumen-hero__text{position:absolute;left:2.81em;right:2.81em;top:4.8em;max-width:46em}');
css.push('.lumen-hero .lumen-hero__meta{font-family:' + FM + ';font-weight:400;font-size:.88em;line-height:1.2;letter-spacing:.03em;color:' + C.muted + '}');


css.push('.lumen-hero .lumen-hero__logo{display:none;width:30.69em;max-width:100%;height:4.4em;margin-top:.4em;-webkit-background-size:contain;background-size:contain;background-position:left bottom;background-repeat:no-repeat}');
css.push('.lumen-hero.lumen-hero--logo .lumen-hero__logo{display:block}');


css.push('.lumen-hero .lumen-hero__title{font-family:' + FD + ';font-weight:800;font-size:3.33em;line-height:1.02;color:' + C.text + ';margin-top:.14em;overflow:hidden}');
css.push('.lumen-hero.lumen-hero--logo .lumen-hero__title{display:none}');
css.push('.lumen-hero .lumen-hero__descr{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-family:' + FB + ';font-weight:400;font-size:1.05em;line-height:1.45;color:' + C.muted + ';max-width:39.45em;margin-top:.5em}');




css.push('.lumen-hero .lumen-hero__sk{display:none;height:.75em;border-radius:.37em;background:-webkit-linear-gradient(left,rgba(' + hexToRgb(C.text) + ',.14),rgba(' + hexToRgb(C.text) + ',.06));background:linear-gradient(90deg,rgba(' + hexToRgb(C.text) + ',.14),rgba(' + hexToRgb(C.text) + ',.06))}');
css.push('.lumen-hero.lumen-hero--pending .lumen-hero__sk--meta{display:block;width:14em;max-width:60%;margin-top:.4em}');
css.push('.lumen-hero.lumen-hero--pending.lumen-hero--nodescr .lumen-hero__sk--descr{display:block;width:39.45em;max-width:100%;margin-top:.8em}');
css.push('.lumen-hero.lumen-hero--pending.lumen-hero--nodescr .lumen-hero__sk--short{display:block;width:26.3em;max-width:67%;margin-top:.4em}');



css.push('.lumen-hero .lumen-hero__chips{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-top:.45em}');
css.push('.lumen-hero .lumen-hero__rate{display:none;font-family:' + FM + ';font-weight:600;font-size:1.05em;line-height:1;color:' + C.text + ';background:rgba(' + hexToRgb(C.panel) + ',.78);border:.04em solid ' + C.line + ';border-radius:.53em;padding:.32em .7em;margin-right:.53em}');
css.push('.lumen-hero.lumen-hero--rated .lumen-hero__rate{display:block}');
css.push('.lumen-hero .lumen-hero__rate:after{content:"TMDB";font-size:.5em;letter-spacing:.1em;color:' + C.smoke + ';margin-left:.7em}');
css.push('.lumen-hero .lumen-hero__status{display:none;font-family:' + FB + ';font-weight:600;font-size:.88em;line-height:1;color:' + A + ';background:rgba(' + A_RGB + ',.1);border:.04em solid rgba(' + A_RGB + ',.4);border-radius:.53em;padding:.4em .7em}');
css.push('.lumen-hero.lumen-hero--status .lumen-hero__status{display:block}');


css.push('.lumen-hero.lumen-hero--compact .lumen-hero__descr,.lumen-hero.lumen-hero--compact .lumen-hero__sk--descr,.lumen-hero.lumen-hero--compact .lumen-hero__sk--short{display:none}');




css.push('.lumen-hero.lumen-motion-full .lumen-hero__text{-webkit-transition:opacity .18s ease,-webkit-transform .18s ease;transition:opacity .18s ease,transform .18s ease}');
css.push('.lumen-hero.lumen-motion-full .lumen-hero__text.is-swapping{opacity:0;-webkit-transform:translateY(.53em);transform:translateY(.53em)}');
css.push('.lumen-hero.lumen-motion-full .lumen-hero__text.is-in{-webkit-animation:lumen-hero-in .42s cubic-bezier(.2,.8,.2,1);animation:lumen-hero-in .42s cubic-bezier(.2,.8,.2,1)}');
css.push('@-webkit-keyframes lumen-hero-in{from{opacity:0;-webkit-transform:translateY(.53em)}to{opacity:1;-webkit-transform:none}}');
css.push('@keyframes lumen-hero-in{from{opacity:0;transform:translateY(.53em)}to{opacity:1;transform:none}}');
css.push('.lumen-hero.lumen-motion-lite .lumen-hero__text,.lumen-hero.lumen-motion-off .lumen-hero__text{opacity:1;-webkit-transform:none;transform:none;-webkit-transition:none;transition:none;-webkit-animation:none;animation:none}');





















css.push('.lumen-main .scroll.layer--wheight{margin-top:22vh;height:-webkit-calc(78vh - 4em) !important;height:calc(78vh - 4em) !important}');



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
'<div class="full-start-new__tagline full--tagline">{tagline}</div>' +
'</div>' +


'<div class="lumen-in lumen-descr">{descr}</div>' +








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
id: 'xmas-comedy', title: 'Рождественские комедии', group: 'theme', icon: 'star', season: [12, 1],
sources: { movie: { type: 'discover', params: { genres: 35, keywords: 207317, sort_by: 'popularity.desc' } } }
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






function fetchAll(item, page, ok, err, alive) {
var gen = alive ? alive() : 0;

var inflightKey = (item.id || '') + ':' + (page || 1) + ':' + sortSignature(item);
var entry = inflight[inflightKey];
if (entry) {

var subId = ++entry._nextId;
entry.subs[subId] = { ok: ok, err: err, alive: alive, gen: gen };
return {
clear: function () {
var e = inflight[inflightKey];
if (!e || !e.subs[subId]) return;
delete e.subs[subId];

if (!Object.keys(e.subs).length && e._cancel) { e._cancel(); }
}
};
}


entry = { subs: {}, _nextId: 1, _cancel: null };
entry.subs[1] = { ok: ok, err: err, alive: alive, gen: gen };
inflight[inflightKey] = entry;
var mySubId = 1;


function notifySubs(method, arg) {
var e = inflight[inflightKey];
delete inflight[inflightKey];
if (!e) return;
var ids = Object.keys(e.subs);
for (var j = 0; j < ids.length; j++) {
var sub = e.subs[ids[j]];
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
var failed = 0;
var done_called = false;
var nets = [];

if (src.movie) want.push('movie');
if (src.tv) want.push('tv');
if (!want.length) {
delete inflight[inflightKey];
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

var deadline;

function done() {
var gotLen = Object.keys(got).length;
if (gotLen + failed < want.length) return;
if (done_called) return;
done_called = true;
clearTimeout(deadline);
if (!gotLen) { notifySubs('err', { all_failed: true }); return; }
notifySubs('ok', buildResult());
}

deadline = setTimeout(function () {
if (done_called) return;
done_called = true;
var r = buildResult();
r.partial = true;
notifySubs('ok', r);
}, FETCH_TIMEOUT);

LC.util.each(want, function (media) {
var n = fetchOne(
src[media], media, page,
function (json) { got[media] = json; done(); },
function (e) {


if (e && e.nokey) {
if (done_called) return;
done_called = true;
clearTimeout(deadline);
notifySubs('err', e);
} else {
failed++;
done();
}
},
requestAlive
);
if (n) nets.push(n);
});

function cancelRequest() {
_reqAliveGen++;
clearTimeout(deadline);
done_called = true;
delete inflight[inflightKey];
LC.util.each(nets, function (n) {
try { if (n && n.clear) n.clear(); } catch (eIgnore) {}
});
}
entry._cancel = cancelRequest;

return {
clear: function () {
var e = inflight[inflightKey];
if (!e || !e.subs[mySubId]) return;
delete e.subs[mySubId];
if (!Object.keys(e.subs).length) { cancelRequest(); }
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









function collagePaths(item, count, ok, err, alive) {
var src = (item && item.sources) || {};
var media = src.movie ? 'movie' : (src.tv ? 'tv' : '');
var spec = media ? src[media] : null;
if (!spec) { err({ no_sources: true }); return { clear: function () {} }; }

if (spec.type === 'kp') {
var net = kpPosters(spec, count, ok, err, alive);
return {
clear: function () {
try { if (net && net.clear) net.clear(); } catch (e) {}
}
};
}

return fetchAll(item, 1, function (json) {
var out = [];
LC.util.each((json && json.results) || [], function (card) {
if (card && card.poster_path && out.length < count) out.push(card.poster_path);
});
ok(out);
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
collagePaths: collagePaths
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


var storedRaw = '';
try { storedRaw = LC.pref ? (LC.pref('lumen_home_rows', '') || '') : ''; } catch (e) {}
var storedIds = storedRaw ? storedRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : null;

var limitRaw = 15;
try { limitRaw = LC.pref ? (parseInt(LC.pref('lumen_rows_limit', '15'), 10) || 15) : 15; } catch (e) {}


var month = new Date().getMonth() + 1;

var rows = homeRows(manifest, storedIds, month, limitRaw);

for (var i = 0; i < rows.length; i++) {
registerRow(rows[i], i);
}
}







var ROWS_OFFSET = 4;
function registerRow(item, index) {
try {
if (!window.Lampa || !Lampa.ContentRows) return;


var rowTitle = item.title;
if (item.badge) rowTitle += ' · ' + item.badge;

var descriptor = {
name: rowName(item.id),
title: rowTitle,
screen: 'main',
index: index + ROWS_OFFSET,
call: makeCall(item)
};
Lampa.ContentRows.add(descriptor);
_addedRows.push(descriptor);
} catch (e) {}
}







function makeCall(item) {
return function (params, screen) {
return function (call) {



var gen = _homeGen;
function alive() { return _homeGen === gen; }

var handle = LC.sources['fetch'](
item,
1,
function (json) {

var hide = false;
try { hide = LC.pref ? !!LC.pref('lumen_hide_watched', false) : false; } catch (eIgnore) {}
var filtered = filterWatched(json.results, viewedIds(json.results), hide);
call({ results: filtered, title: item.title });
},
function () {

call({ results: [] });
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
viewedIds: viewedIds,
bumpGen: bumpGen,
register: register,
unregister: unregister
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.rows;


/* ---- 45_personal.js ---- */
































LC.personal = (function () {


var BECAUSE_LIMIT = 2;


var SHOWS_LIMIT = 12;


var SOON_DAYS = 30;


var RECENT_DAYS = 14;


var UPCOMING_DAYS = 7;


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







function bumpGen() {
_gen++;
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
return out;
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
if (!alive()) { call({ results: [] }); return { cancel: function () {} }; }
var items = continuesList();
if (!alive()) { call({ results: [] }); return { cancel: function () {} }; }
call({ results: items, title: LC.lang ? LC.lang('lumen_row_continue') : 'Continue watching' });
return { cancel: function () {} };
};
};
}




function makeBecauseCall(picked, rowTitle) {
return function (params, screen) {
return function (call) {
var gen = _gen;
function alive() { return _gen === gen; }
if (!alive() || !picked || !picked.length) {
call({ results: [] }); return { cancel: function () {} };
}
var results = [];
var pending = picked.length;
var cancelled = false;
var handles = [];

function done() {
if (cancelled || !alive()) return;
call({ results: results, title: rowTitle });
}

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
pending--;
if (pending === 0) done();
},
function () {
if (!alive()) return;
pending--;
if (pending === 0) done();
},
{ life: 1440 }
);
} catch (e) {
pending--;
if (pending === 0 && alive() && !cancelled) done();
}
if (net) handles.push(net);
})(picked[i]);
}

return {
cancel: function () {
cancelled = true;
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
if (!alive() || !shows || !shows.length) {
call({ results: [] }); return { cancel: function () {} };
}
var details = [];
var pending = shows.length;
var cancelled = false;
var handles = [];

function done() {
if (cancelled || !alive()) return;
var filtered = newEpisodes(details, null);
call({ results: filtered, title: LC.lang ? LC.lang('lumen_row_new_episodes') : 'New episodes' });
}

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
pending--;
if (pending === 0) done();
},
function () {
if (!alive()) return;
pending--;
if (pending === 0) done();
},
{ life: 720 }
);
} catch (e) {
pending--;
if (pending === 0 && alive() && !cancelled) done();
}
if (net) handles.push(net);
})(shows[i]);
}

return {
cancel: function () {
cancelled = true;
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
if (!alive()) { call({ results: [] }); return { cancel: function () {} }; }

var range = soonRange(null);
var movies = [];
var tvShows = [];
var pending = 2;
var cancelled = false;
var handles = [];

function done() {
if (cancelled || !alive()) return;

var all = movies.concat(tvShows);
all.sort(function (a, b) {
var da = a.release_date || a.first_air_date || '';
var db = b.release_date || b.first_air_date || '';
return da < db ? -1 : da > db ? 1 : 0;
});
call({ results: all, title: LC.lang ? LC.lang('lumen_row_soon') : 'Coming soon' });
}

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
pending--;
if (pending === 0) done();
},
function () {
if (!alive()) return;
pending--;
if (pending === 0) done();
},
{ life: 360 }
);
} catch (e) {
pending--;
if (pending === 0 && alive() && !cancelled) done();
}
return net;
}

handles.push(fetchDiscover('movie', movies));
handles.push(fetchDiscover('tv', tvShows));

return {
cancel: function () {
cancelled = true;
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







var COLLAGE_EAGER = 8;


var COLLAGE_SIZE = 3;







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


function tilesFor(manifest, hubGroupId) {
if (!manifest || !Array.isArray(manifest.hubGroups)) return [];
for (var i = 0; i < manifest.hubGroups.length; i++) {
var g = manifest.hubGroups[i];
if (g && g.id === hubGroupId) return collectionsIn(manifest, g.groups);
}
return [];
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


function collage(results, n) {
var out = [];
if (!results || !results.length) return out;
for (var i = 0; i < results.length && out.length < n; i++) {
if (results[i] && results[i].poster_path) out.push(results[i].poster_path);
}
return out;
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
if (window.Navigator && typeof Navigator.canmove === 'function' && Navigator.canmove(dir)) {
Navigator.move(dir);
return true;
}
} catch (e) {
warn('hub: navigator failed', e);
}
return false;
}





function screenController(root, focusTarget, afterMove) {
return {
toggle: function () {
Lampa.Controller.collectionSet(root[0]);
Lampa.Controller.collectionFocus(focusTarget() || false, root[0]);
},
left: function () {
if (!navMove('left')) Lampa.Controller.toggle('menu');
},
right: function () {
if (navMove('right') && afterMove) afterMove();
},
up: function () {
if (!navMove('up')) Lampa.Controller.toggle('head');
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
return null;
}

function recollect(prefer) {
try {
Lampa.Controller.collectionSet(root[0]);
var node = prefer || focusTarget();
Lampa.Controller.collectionFocus(node || false, root[0]);
} catch (e) {
warn('hub: collection failed', e);
}
}





function paintCollage(node, paths) {
var box = $(node).find('.lumen-tile__collage');
box.empty();
var painted = 0;
for (var i = 0; i < paths.length; i++) {
var path = '' + paths[i];
var url = path.indexOf('http') === 0 ? path : imageUrl(path, 'w342');
if (!url) continue;
var poster = $('<div class="lumen-tile__poster lumen-tile__poster--' + (painted + 1) + '"></div>');
poster.css('background-image', 'url("' + url + '")');
box.append(poster);
painted++;
}
if (painted) $(node).addClass('lumen-tile--filled');
}

function loadCollage(item, node) {
if (node.lumen_collage) return;
node.lumen_collage = true;
var captured = gen;
var handle = LC.sources.collagePaths(item, COLLAGE_SIZE, function (paths) {
if (gen !== captured) return;
paintCollage(node, paths);
}, function (err) {
if (gen !== captured) return;




node.lumen_collage = false;
if (err && err.nokey) $(node).addClass('lumen-tile--nokey');
}, alive(captured));
if (handle) handles.push(handle);
}



function loadVisibleCollages() {
var list = tilesFor(manifest, activeGroup);
for (var i = 0; i < tileNodes.length && i < COLLAGE_EAGER; i++) {
loadCollage(list[i], tileNodes[i]);
}
}

function tileNode(item) {
var group = null;
var i;
for (i = 0; manifest && manifest.groups && i < manifest.groups.length; i++) {
if (manifest.groups[i].id === item.group) { group = manifest.groups[i]; break; }
}
var sub = item.badge || titleOf(group, lang());
var node = $(
'<div class="lumen-tile selector">' +
'<div class="lumen-tile__collage"></div>' +
'<div class="lumen-tile__scrim"></div>' +
'<div class="lumen-tile__text">' +
'<div class="lumen-tile__title">' + esc(item.title) + '</div>' +
'<div class="lumen-tile__sub">' + esc(sub) + '</div>' +
'</div>' +
'<div class="lumen-tile__nokey">' + esc(LC.lang('lumen_hub_nokey')) + '</div>' +
'</div>'
);
node.on('hover:focus', function () {
lastFocus = node[0];
loadCollage(item, node[0]);
});
node.on('hover:enter', function () {
openCollection(item);
});
return node[0];
}

function buildTiles(groupId) {


bump();
activeGroup = groupId;
var list = tilesFor(manifest, groupId);
tilesRow.empty();
tileNodes = [];
for (var i = 0; i < list.length; i++) {
var node = tileNode(list[i]);
tilesRow.append(node);
tileNodes.push(node);
}
loadVisibleCollages();
for (var c = 0; c < chipNodes.length; c++) {
$(chipNodes[c]).toggleClass('lumen-chip--on', chipNodes[c].lumen_group === groupId);
}
}

function chipNode(group) {
var node = $('<div class="lumen-chip selector">' + esc(group.title) + '<span class="lumen-chip__count">' + group.count + '</span></div>');
node[0].lumen_group = group.id;
node.on('hover:focus', function () { lastFocus = node[0]; });
node.on('hover:enter', function () {
if (activeGroup === group.id) return;
buildTiles(group.id);
recollect(node[0]);
});
return node[0];
}

function buildHead() {
var total = 0;
for (var i = 0; i < groups.length; i++) total += groups[i].count;
head.empty();
head.append($('<div class="lumen-hub__title">' + esc(LC.lang('lumen_hub_title')) + '</div>'));
head.append($('<div class="lumen-hub__count">' + total + ' ' + esc(LC.collectionsWord(total)) + '</div>'));



head.append($('<div class="lumen-hub__search hide">' + esc(LC.lang('lumen_hub_search')) + '</div>'));
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
}

this.create = function () {
motionClass(root);
root.append(head);
root.append(chipsRow);
root.append(tilesRow);
scroll.append(root);
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
Lampa.Controller.add('content', screenController(root, focusTarget, null));
Lampa.Controller.toggle('content');



if (manifest) loadVisibleCollages();
};

this.pause = function () {};








this.stop = function () {
started = false;
bump();



for (var i = 0; i < tileNodes.length; i++) {
if (!$(tileNodes[i]).hasClass('lumen-tile--filled')) tileNodes[i].lumen_collage = false;
}
};

this.destroy = function () {
bump();
chipNodes = [];
tileNodes = [];
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

function recollect(prefer) {
try {
Lampa.Controller.collectionSet(root[0]);
var node = prefer || focusTarget();
Lampa.Controller.collectionFocus(node || false, root[0]);
} catch (e) {
warn('grid: collection failed', e);
}
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
img.onload = function () { $(node).addClass('card--loaded'); };
img.onerror = function () { $(node).addClass('card--broken'); };
img.src = url;
}





function afterMove() {
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
if (!year) node.find('.card__age').remove();

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
el.lumen_poster = imageUrl(card.poster_path, 'w342');

node.on('hover:focus', function () {
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
var text = reason === 'nokey' ? LC.lang('lumen_hub_nokey_text') : LC.lang('lumen_hub_empty');
var box = $('<div class="lumen-grid__empty"><div class="lumen-grid__empty-text">' + esc(text) + '</div></div>');
var back = $('<div class="lumen-grid__back selector">' + esc(LC.lang('lumen_grid_back')) + '</div>');
back.on('hover:focus', function () { lastFocus = back[0]; });
back.on('hover:enter', function () { Lampa.Activity.backward(); });
box.append(back);
itemsRow.append(box);
}


function rebuild() {
itemsRow.empty();
cardNodes = [];
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
node.on('hover:focus', function () { lastFocus = node[0]; });
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
Lampa.Controller.add('content', screenController(root, focusTarget, afterMove));
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
openTarget: openTarget,
franchiseItem: franchiseItem,
sortModes: sortModes,
applySort: applySort,
sortLocal: sortLocal,
needsLocalSort: needsLocalSort,
collage: collage,
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

var SWAP_MS = 180;


var LOAD_TIMEOUT = 8000;



var DETAILS_LIFE = 1440;


var WIDE_PX = 1366;

var MOTION_CLASSES = 'lumen-motion-full lumen-motion-lite lumen-motion-off';









function pickLogo(logos, lang) {
lang = lang || 'ru';
var own = null;
var en = null;
var neutral = null;
for (var i = 0; logos && i < logos.length; i++) {
var item = logos[i];
if (!item || !item.file_path) continue;
var code = item.iso_639_1 || '';
if (code === lang) { if (!own) own = item.file_path; }
else if (code === 'en') { if (!en) en = item.file_path; }
else if (!code) { if (!neutral) neutral = item.file_path; }
}
return own || en || neutral || null;
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

return {
id: card.id,
media: media,
title: card.title || card.name || '',
backdrop: (details && details.backdrop_path) || card.backdrop_path || '',
poster: card.poster_path || (details && details.poster_path) || '',
logo: details ? pickLogo(details.images && details.images.logos, words.lang) : null,
meta: meta,
overview: (details && details.overview) || card.overview || '',
rating: vote > 0 ? vote.toFixed(1) : '',
status: status,
pending: !details
};
}




function shouldUpdate(prevId, nextId, elapsedMs, delay) {
if (nextId == null) return false;
if (prevId === nextId) return false;
return (elapsedMs || 0) >= (delay || 0);
}



function sizeFor(width) {
return (Number(width) || 0) > WIDE_PX ? 'original' : 'w1280';
}



function logoSizeFor(width) {
return (Number(width) || 0) > WIDE_PX ? 'w780' : 'w500';
}


function imageLanguages(lang) {
lang = lang || 'ru';
return lang === 'en' ? 'en,null' : lang + ',en,null';
}






function detailsRequest(media, id, lang) {
return {
url: media + '/' + id,
params: { filter: { append_to_response: 'images', include_image_language: imageLanguages(lang) } },
life: DETAILS_LIFE
};
}








var state = null;


var gen = 0;

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
try {
return window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
} catch (e) {
return 0;
}
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
'<div class="lumen-hero__veil lumen-hero__veil--l"></div>' +
'<div class="lumen-hero__veil lumen-hero__veil--b"></div>' +
'</div>');
var text = $('<div class="lumen-hero__text">' +
'<div class="lumen-hero__meta"></div>' +
'<div class="lumen-hero__sk lumen-hero__sk--meta"></div>' +
'<div class="lumen-hero__logo"></div>' +
'<div class="lumen-hero__title"></div>' +
'<div class="lumen-hero__descr"></div>' +
'<div class="lumen-hero__sk lumen-hero__sk--descr"></div>' +
'<div class="lumen-hero__sk lumen-hero__sk--short"></div>' +
'<div class="lumen-hero__chips">' +
'<div class="lumen-hero__rate"></div>' +
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
state.node.removeClass(MOTION_CLASSES).addClass('lumen-motion-' + LC.motionMode());
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















function render(model, swap) {
if (!state || !model) return;
var node = state.node;
state.model = model;

function write() {
if (!state || !state.model) return;
var current = state.model;
var text = node.find('.lumen-hero__text');
node.find('.lumen-hero__meta').text(current.meta.join(' · '));
node.find('.lumen-hero__title').text(current.title);
node.find('.lumen-hero__descr').text(current.overview);
node.find('.lumen-hero__rate').text(current.rating);
node.find('.lumen-hero__status').text(current.status);
node.toggleClass('lumen-hero--rated', !!current.rating);
node.toggleClass('lumen-hero--status', !!current.status);
node.toggleClass('lumen-hero--pending', !!current.pending);



node.toggleClass('lumen-hero--nodescr', !current.overview);

var logoUrl = current.logo ? imageUrl(current.logo, logoSizeFor(screenWidth())) : '';
var logo = node.find('.lumen-hero__logo');



logo.css('background-image', logoUrl ? 'url("' + encodeURI(logoUrl) + '")' : 'none');
node.toggleClass('lumen-hero--logo', !!logoUrl);

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
var next = activeIsA ? b : a;
var prev = activeIsA ? a : b;
next.css('background-image', 'url("' + encodeURI(url) + '")');
next.addClass('is-active');
prev.removeClass('is-active');
node.toggleClass('lumen-hero--blur', !!blur);
state.frameUrl = url;
}




function loadFrame(model, captured) {
if (!state) return;
var blur = false;
var path = model.backdrop;
if (!path) { path = model.poster; blur = true; }
if (!path) return;

var url = imageUrl(path, blur ? 'w500' : sizeFor(screenWidth()));
if (!url || url === state.frameUrl) return;

var loader = new Image();
var done = false;

function finish(ok) {
if (done) return;
done = true;
stopTimer('loadTimer');
loader.onload = null;
loader.onerror = null;
if (gen !== captured || !state || !isMounted()) return;
state.loader = null;


if (!ok) return;
try {
swapFrame(url, blur);
} catch (e) {
warn('hero: frame failed', e);
}
}

loader.onload = function () { finish(true); };
loader.onerror = function () { finish(false); };
state.loader = loader;
state.loadTimer = setTimeout(function () { finish(false); }, LOAD_TIMEOUT);
loader.src = url;
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
state.card = card;
state.details = null;
state.model = null;
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



function updateCompact(el) {
if (!state || state.fixedCompact) return;
var index = rowIndex(el);
if (index < 0) return;
state.node.toggleClass('lumen-hero--compact', index > 0);
}

function onFocus(el) {
if (!state) return;
var card = el.card_data;
if (!card || card.id == null) return;

updateCompact(el);

state.focusAt = Date.now();
state.pending = card;
stopTimer('timer');


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

function onMutations(records) {
if (!state) return;
try {
for (var i = 0; i < records.length; i++) {
var target = records[i] && records[i].target;
if (!target || !target.classList) continue;
if (target.classList.contains('card') && target.classList.contains('focus')) {
onFocus(target);
return;
}
}
} catch (e) {
warn('hero: observer failed', e);
}
}

function observe(root) {
try {
if (!window.MutationObserver) return;
var obs = new MutationObserver(onMutations);
obs.observe(root[0], { attributes: true, attributeFilter: ['class'], subtree: true });
state.observer = obs;
} catch (e) {
warn('hero: observe failed', e);
}
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











function mount(root, opts) {
try {
if (!root || !root.length) return;



if (state && state.root && state.root[0] === root[0]) return;
unmount();
opts = opts || {};

var node = buildNode();
root.prepend(node);
var hostClass = opts.hostClass || 'lumen-main';
root.addClass(hostClass);

gen++;
state = {
root: root,
node: node,
hostClass: hostClass,
observer: null,
timer: null,
swapTimer: null,
loadTimer: null,
loader: null,
net: null,
shownId: null,
card: null,
details: null,
model: null,
pending: null,
focusAt: 0,
frameUrl: '',
fixedCompact: !!opts.compact
};
if (opts.compact) node.addClass('lumen-hero--compact');
applyMotion();
observe(root);
showFocused(root);
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
var s = state;
state = null;
gen++;
try {
if (s.observer) s.observer.disconnect();
} catch (e) {
warn('hero: disconnect failed', e);
}
var timers = ['timer', 'swapTimer', 'loadTimer'];
for (var i = 0; i < timers.length; i++) {
try { if (s[timers[i]]) clearTimeout(s[timers[i]]); } catch (eT) {}
}
if (s.loader) {
s.loader.onload = null;
s.loader.onerror = null;
}
try { if (s.net && s.net.clear) s.net.clear(); } catch (eN) {}
try { s.node.remove(); } catch (eR) {}
try { s.root.removeClass(s.hostClass); } catch (eC) {}
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
mediaOf: mediaOf,
heroModel: heroModel,
shouldUpdate: shouldUpdate,
sizeFor: sizeFor,
logoSizeFor: logoSizeFor,
detailsRequest: detailsRequest,
mount: mount,
mountCurrent: mountCurrent,
detach: detach,
owns: owns,
unmount: unmount,
applyMotion: applyMotion,
active: active
};
})();

if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.hero;


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




'<div class="lumen-bg__trailer"></div>' +
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
var title = trim(('' + (it.title || '')).replace(/\s+/g, ' '));
if (!title) title = firstSentence(text);
var author = trim(it.author) || anon || ANON;
var dm = ('' + (it.date || '')).match(/^(\d{4})-(\d{2})-(\d{2})/);
out.push({
tone: it.type === 'POSITIVE' ? 'good' : (it.type === 'NEGATIVE' ? 'bad' : 'mid'),
author: esc(author),
initials: esc(LC.util.initials(author)),
title: esc(title),
excerpt: esc(cut(text, MAX_EXCERPT)),
full: esc(cut(text, MAX_FULL)),
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





function headHtml(total) {
return '<div class="lumen-reviews__head">' +
'<span class="lumen-reviews__ico"></span>' +
'<span class="lumen-reviews__title">' + esc(lang('lumen_card_reviews_title')) + '</span>' +
'<span class="lumen-reviews__src">' + esc(lang('lumen_card_reviews_src')) + '</span>' +


'<span class="lumen-reviews__total">· ' + esc(String(total)) + ' ' + esc(totalWord(total)) + '</span>' +
'</div>';
}



function cardHtml(item, index) {
var likes = item.likes ? '<span class="lumen-review__likes">' + item.likes + ' ' + esc(lang('lumen_card_review_useful')) + '</span>' : '';
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
'<div class="lumen-review__text">' + item.excerpt + '</div>' +
'</div>' +
'</div>';
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
'<div class="lumen-review-modal__text">' + item.full + '</div>' +
'</div>';
}




function hintHtml() {
return '<div class="lumen-reviews__hint">' +
'<div class="lumen-reviews__hint-ico"></div>' +
'<div class="lumen-reviews__hint-title">' + esc(lang('lumen_card_reviews_nokey_title')) + '</div>' +
'<div class="lumen-reviews__hint-text">' + esc(lang('lumen_card_reviews_nokey_text')) + '</div>' +
'<div class="lumen-reviews__hint-path">' + esc(lang('lumen_card_reviews_nokey_path')) + '</div>' +
'</div>';
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
var block = $('<div class="lumen-reviews"></div>');
var cards = [];
LC.util.each(list, function (item, i) { cards.push(cardHtml(item, i)); });
block.html(headHtml(total) + '<div class="lumen-reviews__row">' + cards.join('') + '</div>');
holder.append(block);
bind(block, list);
appendSelectors(block);
}

function paintHint(holder) {
var block = $('<div class="lumen-reviews lumen-reviews--hint"></div>');
block.html(hintHtml());
holder.append(block);
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




var sign = [on ? '1' : '0', imdb, keyStamp(key), lang('lumen_card_reviews_title')].join('|');

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

state.net = load(imdb, key, function (res) {
try {
var current = stateOf(holder);
if (current.gen !== gen) return;
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
lumen_card_group_backdrop: { ru: 'Фон карточки', en: 'Card background', uk: 'Фон картки' },
lumen_card_group_blocks: { ru: 'Блоки карточки', en: 'Card blocks', uk: 'Блоки картки' },
lumen_card_group_path: { ru: 'Меню и экраны плеера', en: 'Menus and player screens', uk: 'Меню та екрани плеєра' },
lumen_card_accent: { ru: 'Акцентный цвет', en: 'Accent color', uk: 'Акцентний колір' },
lumen_card_accent_sand: { ru: 'Песок', en: 'Sand', uk: 'Пісок' },
lumen_card_accent_ice: { ru: 'Лёд', en: 'Ice', uk: 'Лід' },
lumen_card_accent_wine: { ru: 'Вино', en: 'Wine', uk: 'Вино' },
lumen_card_accent_mint: { ru: 'Мята', en: 'Mint', uk: 'М\'ята' },
lumen_card_fonts_name: { ru: 'Фирменные шрифты', en: 'Custom fonts', uk: 'Фірмові шрифти' },
lumen_card_fonts_descr: {
ru: 'Шрифты с Google Fonts. Требуется интернет. Выключите, если шрифты не грузятся.',
en: 'Fonts from Google Fonts. Requires internet access.',
uk: 'Шрифти з Google Fonts. Потрібен інтернет.'
},
lumen_card_progress_name: { ru: 'Показывать «Продолжить»', en: 'Show "Continue"', uk: 'Показувати «Продовжити»' },



lumen_card_font_name: { ru: 'Шрифт', en: 'Font', uk: 'Шрифт' },
lumen_card_font_descr: {
ru: 'Гарнитура текста и цифр. Действует только при включённых фирменных шрифтах. Применяется сразу.',
en: 'Typeface for text and figures. Works only with custom fonts on. Applied immediately.',
uk: 'Гарнітура тексту й цифр. Діє лише з увімкненими фірмовими шрифтами. Застосовується одразу.'
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
lumen_card_torrents_name: { ru: 'Оформление экрана торрентов', en: 'Torrents screen style', uk: 'Оформлення екрана торентів' },
lumen_card_torrents_descr: {
ru: 'Список раздач, окна подключения и ошибок, списки файлов и предзагрузка — в стиле карточки.',
en: 'Torrent list, connection and error dialogs, file lists and preloading in the card style.',
uk: 'Список роздач, вікна підключення та помилок, списки файлів і передзавантаження — у стилі картки.'
},



lumen_card_trailer: { ru: 'Трейлер в фоне', en: 'Background trailer', uk: 'Трейлер у фоні' },
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
ru: 'URL манифеста подборок',
en: 'Collections manifest URL',
uk: 'URL маніфесту підбірок'
},
lumen_manifest_url_descr: {
ru: 'Внешний JSON-манифест подборок. Пусто — встроенный список (62 подборки). Кэш 12 ч.',
en: 'External JSON manifest for collections. Empty — built-in list (62 collections). Cached 12 h.',
uk: 'Зовнішній JSON-маніфест підбірок. Порожньо — вбудований список (62 підбірки). Кеш 12 год.'
},


lumen_group_home: {
ru: 'Ряды на главной',
en: 'Home rows',
uk: 'Ряди на головній'
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

lumen_rows_limit_suffix: {
ru: 'рядов',
en: 'rows',
uk: 'рядів'
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




lumen_hub_title: { ru: 'Подборки', en: 'Collections', uk: 'Підбірки' },


lumen_hub_search: { ru: 'ПОИСК ПО ПОДБОРКАМ', en: 'SEARCH COLLECTIONS', uk: 'ПОШУК ПО ПІДБІРКАХ' },
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
if (name === 'lumen_motion') { LC.applyMotionMode(); return true; }
if (name === 'lumen_slideshow' || name === 'lumen_slide_interval') { LC.applySlideshowPref(); return true; }
if (name === 'lumen_menus') { LC.applyMenusPref(); return true; }
if (name === 'lumen_torrents') { LC.applyTorrentsPref(); return true; }
if (name === 'lumen_trailer') { LC.applyTrailerPref(); return true; }




if (name === 'lumen_font') { LC.injectFonts(); LC.injectCss(); return true; }
if (name === 'lumen_reviews' || name === 'lumen_kp_key') { LC.applyReviewsPref(); return true; }


if (name === 'lumen_hide_watched') { return true; }

if (name === 'lumen_rows_limit') {
try { if (LC.applyRowsPref) LC.applyRowsPref(); } catch (eRows) {}
return true;
}


if (name === 'lumen_personal_rows') {
try { if (LC.applyPersonalPref) LC.applyPersonalPref(); } catch (eP) {}
return true;
}


if (name === 'lumen_manifest_url') {
try { if (window.Lampa && Lampa.Storage) Lampa.Storage.set('lumen_manifest', null); } catch (e) {}
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
param['default'] = entry['default'];
if (entry.type === 'select') param.values = valuesOf(entry);
if (entry.type === 'input') param.values = '';
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






function motionModeFor(stored, platform) {
if (stored !== 'full' && stored !== 'lite' && stored !== 'off') stored = 'auto';
if (stored !== 'auto') return stored;
platform = platform || {};
if (platform.tizen || platform.webos) return 'lite';
return 'full';
}





















var LIST = [
{ name: 'lumen_enabled', type: 'trigger', 'default': true, label: 'lumen_card_enabled_name', descr: 'lumen_card_enabled_descr' },

{ name: 'lumen_group_look', type: 'title', label: 'lumen_card_group_look' },
{ name: 'lumen_card_accent', type: 'select', values: ['sand', 'ice', 'wine', 'mint'], vprefix: 'lumen_card_accent_', 'default': 'sand', label: 'lumen_card_accent' },
{ name: 'lumen_card_fonts', type: 'trigger', 'default': true, label: 'lumen_card_fonts_name', descr: 'lumen_card_fonts_descr' },





{ name: 'lumen_font', type: 'select', values: ['golos', 'onest', 'manrope', 'inter', 'plex'], vprefix: 'lumen_card_font_', 'default': 'golos', label: 'lumen_card_font_name', descr: 'lumen_card_font_descr' },
{ name: 'lumen_motion', type: 'select', values: ['auto', 'full', 'lite', 'off'], vprefix: 'lumen_card_motion_', 'default': 'auto', label: 'lumen_card_motion', descr: 'lumen_card_motion_descr' },

{ name: 'lumen_group_backdrop', type: 'title', label: 'lumen_card_group_backdrop' },
{ name: 'lumen_slideshow', type: 'trigger', 'default': true, label: 'lumen_card_slideshow_name' },
{ name: 'lumen_slide_interval', type: 'select', values: ['8', '14', '20'], vsuffix: 'lumen_card_seconds', 'default': '14', label: 'lumen_card_slide_interval' },
{ name: 'lumen_trailer', type: 'select', values: ['auto', 'on', 'off'], vprefix: 'lumen_card_trailer_', 'default': 'auto', label: 'lumen_card_trailer', descr: 'lumen_card_trailer_descr' },

{ name: 'lumen_group_blocks', type: 'title', label: 'lumen_card_group_blocks' },
{ name: 'lumen_card_progress', type: 'trigger', 'default': true, label: 'lumen_card_progress_name' },



{ name: 'lumen_reviews', type: 'trigger', 'default': true, label: 'lumen_card_reviews_name', descr: 'lumen_card_reviews_descr' },
{ name: 'lumen_kp_key', type: 'input', 'default': '', label: 'lumen_card_kp_key', descr: 'lumen_card_kp_key_descr' },

{ name: 'lumen_group_path', type: 'title', label: 'lumen_card_group_path' },
{ name: 'lumen_menus', type: 'select', values: ['all', 'path', 'off'], vprefix: 'lumen_card_menus_', 'default': 'all', label: 'lumen_card_menus' },
{ name: 'lumen_torrents', type: 'trigger', 'default': true, label: 'lumen_card_torrents_name', descr: 'lumen_card_torrents_descr' },



{ name: 'lumen_manifest_url', type: 'input', 'default': '', label: 'lumen_manifest_url', descr: 'lumen_manifest_url_descr' },


{ name: 'lumen_group_home', type: 'title', label: 'lumen_group_home' },
{ name: 'lumen_hide_watched', type: 'trigger', 'default': false, label: 'lumen_hide_watched_name', descr: 'lumen_hide_watched_descr' },
{ name: 'lumen_rows_limit', type: 'select', values: ['10', '15', '25'], vsuffix: 'lumen_rows_limit_suffix', 'default': '15', label: 'lumen_rows_limit_name' },


{ name: 'lumen_personal_rows', type: 'trigger', 'default': true, label: 'lumen_personal_rows_name', descr: 'lumen_personal_rows_descr' }
];

function find(name) {
if (!name) return null;
for (var i = 0; i < LIST.length; i++) if (LIST[i].name === name) return LIST[i];
return null;
}

return { LIST: LIST, find: find, boolOf: boolOf, motionModeFor: motionModeFor };
})();


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
var platform = { tizen: false, webos: false };
try {
if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.is === 'function') {
platform.tizen = !!Lampa.Platform.is('tizen');
platform.webos = !!Lampa.Platform.is('webos');
}
} catch (e2) { }
return LC.prefs.motionModeFor(stored, platform);
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



function renderNextChip(root, movie) {
var chip = root.find('.lumen-next-chip');
if (!chip.length) return;
chip.addClass('hide');
root.removeClass('lumen-card--nextchip');
if (!isSerial(movie)) return;
var next = LC.cardinfo.nextEpisode(movie.next_episode_to_air, new Date(), dateWords());
if (!next) return;
chip.find('.lumen-next-chip__text').text(next.text);







var short = chip.find('.lumen-next-chip__short');
if (!short.length) {
chip.append('<div class="lumen-next-chip__short"></div>');
short = chip.find('.lumen-next-chip__short');
}

var date = LC.cardinfo.shortDate(movie.next_episode_to_air.air_date, monthsShort());
short.text(date ? '· ' + date : '');

chip.removeClass('hide');




var status = root.find('.full-start__status');
if (status.length && !status.hasClass('hide')) root.addClass('lumen-card--nextchip');
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




LC.applyMotionMode = function () {
applyMotionMode(activeCardRoot());
applyMotionMode(activeBackdropLayer());
if (ui_active) applyMotionMode(bodyRoot());



try { applyMotionMode($('.activity--active .lumen-hub')); } catch (eHub) {}
try { applyMotionMode($('.activity--active .lumen-grid')); } catch (eGrid) {}




try { if (LC.hero && LC.hero.applyMotion) LC.hero.applyMotion(); } catch (eHero) {}
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




if ((e.type === 'archive' || e.type === 'destroy') && e.component === 'main') {
try { if (LC.rows && LC.rows.bumpGen) LC.rows.bumpGen(); } catch (eBump) {}

try { if (LC.personal && LC.personal.bumpGen) LC.personal.bumpGen(); } catch (eBumpP) {}
}








if (e.type === 'start') {
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
} else if (e.type === 'destroy') {





try {
if (LC.hero && LC.hero.active()) {
var deadRender = null;
try {
if (e.object && e.object.activity && typeof e.object.activity.render === 'function') deadRender = e.object.activity.render();
} catch (eDeadRender) {}
if (LC.hero.owns(deadRender)) LC.hero.unmount();
}
} catch (eHeroKill) {
warn('hero destroy failed', eHeroKill);
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
}
return;
}








if (e.type === 'start' && e.component === 'full') {
var layer = layerOf(e.object);
if (layer && layer.length) {





























if (LC.active && LC.active.object !== e.object) LC.destroyActive();
var slideshow = liveSlideshow(layer, layer.data('lumenSlideshow'));









LC.active = { object: e.object, body: layer.parent(), slideshow: slideshow, trailer: layer.data('lumenTrailer') || null, data: layer.data('lumenData') || null };




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
} else if (e.type === 'complite') {
var root = findRoot(e);
LC.header.decorate(root, e.data);





var doneRow = findDescrRow(e);
LC.header.descr(doneRow, e.data);
LC.reviews.render(doneRow, e.data);
var slideshow = LC.backdrops.apply(root, e.body, (e.data && e.data.movie) || {});
applyMotionMode(root);




LC.active = { object: e.object, body: e.body, slideshow: slideshow, data: e.data };









try {
var bgLayer = e.body && typeof e.body.children === 'function' ? e.body.children('.lumen-backdrop') : null;
if (bgLayer && bgLayer.length) bgLayer.data('lumenData', e.data);
} catch (eData) { warn('reviews data on layer failed', eData); }





focus_on_card = false;
LC.trailer.bind(root);








LC.trailer.reveal(root, e.data);
LC.active.trailer = LC.trailer.schedule(root, e.body, e.data);







LC.hub.franchise(root, (e.data && e.data.movie) || {});
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













var STRIP_NODES = ['.lumen-progress', '.lumen-episodes', '.lumen-facts', '.lumen-reviews', '.lumen-franchise'];










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
}
} catch (eRv) {
warn('strip reviews failed', eRv);
}
try {
$('.lumen-descr-row').removeClass('lumen-descr-row lumen-descr-row--reviews');
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




try {
if (LC.rows && LC.rows.register && LC.manifest && LC.manifest.load) {
LC.manifest.load(function (m) {
if (activated && LC.rows && LC.rows.register) LC.rows.register(m);
});
}
} catch (eRows2) {
warn('rows register failed', eRows2);
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
}

function deactivate() {
if (!activated) return;
activated = false;


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
if (body && body.length) body.removeClass(MOTION_CLASSES);
} catch (e3) {
warn('motion class off failed', e3);
}
stripAllCards();



try { if (LC.rows && LC.rows.unregister) LC.rows.unregister(); } catch (eRows) {}

try { if (LC.personal && LC.personal.unregister) LC.personal.unregister(); } catch (ePersonalOff) {}

try { if (LC.hub && LC.hub.uninstall) LC.hub.uninstall(); } catch (eHubOff) {}


try { if (LC.hero && LC.hero.unmount) LC.hero.unmount(); } catch (eHeroOff) {}
}




LC.applyRowsPref = function () {
if (!activated) return;
try {
if (LC.rows && LC.rows.register && LC.manifest && LC.manifest.load) {
LC.manifest.load(function (m) {
if (activated && LC.rows && LC.rows.register) LC.rows.register(m);
});
}
} catch (e) {
warn('rows pref failed', e);
}
};




LC.applyPersonalPref = function () {
if (!activated) return;
try {
if (LC.personal && LC.personal.unregister) LC.personal.unregister();
if (LC.personal && LC.personal.register) LC.personal.register();
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
