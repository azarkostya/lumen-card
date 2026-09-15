// scripts/es5check.mjs — грубый ES5-линт по регуляркам поверх собранного dist/lumen_card.js.
// Правило для ".find(" намеренно не добавлено — в коде много легитимного jQuery ".find(".
import { readFileSync } from 'node:fs';

const file = process.argv[2] || 'dist/lumen_card.js';
const src = readFileSync(file, 'utf8');
const lines = src.split('\n');

const RULES = [
  { name: '=>', re: /=>/ },
  { name: 'let', re: /\blet\b/ },
  { name: 'const', re: /\bconst\b/ },
  { name: 'template literal (backtick)', re: /`/ },
  { name: 'class', re: /\bclass\s+[A-Za-z]/ },
  { name: 'Object.assign', re: /Object\.assign/ },
  { name: '.includes(', re: /\.includes\(/ },
  { name: 'Promise', re: /\bPromise\b/ },
  { name: 'spread/rest (...)', re: /\.\.\./ },
  { name: 'for...of', re: /\bfor\s*\(\s*(var\s+)?\w+\s+of\b/ },
  { name: 'async', re: /\basync\b/ },
  { name: 'await', re: /\bawait\b/ },
  { name: '.startsWith(', re: /\.startsWith\(/ },
  { name: '.endsWith(', re: /\.endsWith\(/ },
  { name: 'Array.from', re: /Array\.from/ },
  { name: 'Symbol', re: /\bSymbol\b/ },
  { name: '.findIndex(', re: /\.findIndex\(/ }
];

let findings = 0;

lines.forEach(function (line, idx) {
  RULES.forEach(function (rule) {
    if (rule.re.test(line)) {
      findings++;
      console.log(rule.name + ' at line ' + (idx + 1));
    }
  });
});

if (findings) {
  console.log('ES5 check: ' + findings + ' findings');
  process.exit(1);
} else {
  console.log('ES5 check: ok');
}
