// 人が操作するのと同じ順番で、ボタンを押して流れ全体を確かめる。使い方: node tests/help.js 400（画面の幅）
const { chromium } = require('playwright');
const path = require('path');
const PAGE = 'file://' + path.resolve(__dirname, '..', 'index.html');
const W = parseInt(process.argv[2] || '400');
(async () => {
  const b = await chromium.launch(); const errs = []; const log = [];
  const ctx = await b.newContext({viewport:{width:W,height:860}});
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto(PAGE); await p.waitForTimeout(300);
  const c = async (sel) => { await p.click(sel); await p.waitForTimeout(60); };
  const step = async n => { if (W <= 880) { const open = await p.$eval('details.card', d => d.open); if (!open) await c('details.card summary'); } await c(`[data-step="${n}"]`); };
  const code = async () => p.evaluate(() => { let h = 2166136261 >>> 0; for (const ch of "otp" + Math.floor(Date.now() / 30000)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return String(h % 1000000).padStart(6, "0"); });
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('kasou-renshujo.v2')));
  const check = (label, cond) => { if (!cond) process.exitCode = 1; return log.push((cond ? 'OK  ' : 'NG  ') + label); };
  check('名前が仮想資産', (await p.textContent('#t-title')) === '仮想資産 練習所' && (await p.title()).includes('仮想資産'));
  // glossary
  await c('#gloss'); let n = await p.$$eval('#help .glist button', e => e.length); check('用語集が開く（' + n + '語）', n >= 25);
  await c('#help .glist button[data-help="book"]'); let t = await p.textContent('#hp-ttl'); check('用語集→板の見方', t === '板の見方');
  await c('#help [data-help="__all"]'); check('用語集に戻る', !!(await p.$('#help .glist')));
  await c('#help [data-hx]'); check('閉じる', !(await p.$('#help .overlay')));
  await c('#gloss'); await p.keyboard.press('Escape'); check('Escで閉じる', !(await p.$('#help .overlay')));
  await c('#gloss'); await p.mouse.click(5, 5); check('外側を押して閉じる', !(await p.$('#help .overlay')));
  await c('#tab-exp');
  await p.fill('#pw', 'password123'); await c('[data-act=signup]');
  await c('[data-help="kyc"]'); check('?：本人確認', (await p.textContent('#hp-ttl')) === '本人確認'); await c('#help [data-hx]');
  await c('[data-act=kyc]'); await p.fill('#otp', await code()); await c('[data-act=twofa]');
  await step(2); await c('[data-act=deposit]');
  await step(3); await c('[data-coin=BTC]'); await p.fill('#otcamt', '10000'); await c('[data-act=otcbuy]');
  let s = await st(); check('段階3：仮BTCでは「仮ETHを買う」が済にならない', !(s.done[3] && s.done[3][0]));
  check('段階3：仮ETHを買うよう案内', (await p.textContent('[data-flash]')).includes('仮ETH'));
  await c('[data-help="spread"]'); check('?：スプレッド', (await p.textContent('#hp-ttl')) === 'スプレッド'); await c('#help [data-hx]');
  await c('[data-help="chart"]'); check('?：チャート', !!(await p.$('#hp-ttl'))); await c('#help [data-hx]');
  await c('[data-coin=ETH]'); await p.fill('#otcamt', '30000'); await c('[data-act=otcbuy]'); s = await st(); check('段階3 完了', s.done[3][0] && s.done[3][1]);
  await step(4); await c('.panel h3 [data-help="book"]'); const bt = await p.textContent('#help .popup'); check('?：板の見方（赤・緑の説明）', bt.includes('赤') && bt.includes('緑')); await c('#help [data-hx]');
  for (const k of ['market','limit','fill','open','fills','advance']) { await c(`[data-help="${k}"]`); const ok = !!(await p.$('#hp-ttl')); await c('#help [data-hx]'); check('?：' + k, ok); }
  await c('[data-mode=assets]');
  const at = await p.textContent('#main'); check('資産表に「この練習では不可」', at.includes('送り出し') && at.includes('不可'));
  check('出金欄に「仮ETHだけ」', at.includes('送り出せる銘柄は仮ETHだけ'));
  await c('.hterm[data-help="onlyeth"]'); check('?：なぜ仮ETHだけ', (await p.textContent('#hp-ttl')).includes('仮ETH')); await c('#help [data-hx]');
  // help must not wipe typed input
  await c('[data-act=regopen]'); await p.fill('#da', '0xabc'); await c('.hterm[data-help="network"]'); await c('#help [data-hx]'); check('ヘルプを開いても入力が消えない', (await p.inputValue('#da')) === '0xabc');
  check('登録の銘柄は仮ETHのみ', (await p.$$eval('#dc option', o => o.length)) === 1);
  await c('[data-act=regclose]');
  // step5 skip
  await step(5); await c('[data-act=wnew]'); await p.waitForTimeout(150);
  await p.fill('#wp1', 'walletpass'); await p.fill('#wp2', 'walletpass'); await c('[data-act=wpw]');
  check('飛ばすボタンがある（表示前）', !!(await p.$('[data-act=skipseed]')));
  await c('[data-act=skipseed]'); s = await st(); check('段階5を飛ばして完了', s.wal.backed && s.done[5][1] && s.done[5][2]);
  check('飛ばしたときの警告', (await p.textContent('[data-flash]')).includes('本物では'));
  // step 6 quick
  await step(6); await c('[data-scr=wal]'); await c('[data-wscr=recv]');
  check('受け取る画面に「仮BTCや仮SOLは受け取れません」', (await p.textContent('.phone')).includes('仮BTCや仮SOLは'));
  await c('[data-act=copyfull]'); await c('[data-scr=ex]'); await c('[data-act=regopen]'); await c('[data-act=pastewal]'); await p.fill('#otp2', await code()); await c('[data-act=regdest]');
  await p.fill('#wq', '0.03'); await p.fill('#otp3', await code()); await c('[data-act=withdraw]'); s = await st(); check('出金→着金', s.wal.bal.ETH > 0.02);
  await c('[data-scr=wal]'); await c('[data-help="pending"]'); check('?：確認中', (await p.textContent('#hp-ttl')) === '確認中'); await c('#help [data-hx]'); await c('[data-act=confirmpending]');
  // dex help
  await step(8); for (const k of ['dex','connect','slip','allow','stable','rate','gas']) { await c(`[data-help="${k}"]`); const ok = !!(await p.$('#hp-ttl')); await c('#help [data-hx]'); check('?：' + k, ok); }
  await step(9); await c('[data-help="contract"]'); check('?：契約アドレス', (await p.textContent('#hp-ttl')) === '契約アドレス'); await c('#help [data-hx]');
  // step10 autofill
  await step(10); await c('[data-wscr=settings]'); await c('[data-act=lose]'); await c('[data-act=wrestore]');
  await c('[data-act=autofill]'); const v = await p.inputValue('#rw'); check('英単語の自動入力', v.split(' ').length === 12);
  await c('[data-act=restorego]'); s = await st(); check('自動入力で復元', !s.lost && s.done[10][1]);
  // English toggle with help open
  await c('#lang'); await c('#gloss'); check('英語の用語集', (await p.textContent('#hp-ttl')) === 'Glossary'); await c('#help [data-hx]');
  check('英語の名前', (await p.textContent('#t-title')) === 'Kasou Shisan Practice Hall');
  // overflow
  const ov = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1); check('横にはみ出さない', !ov);
  await c('#lang');
    await c('[data-step="4"]').catch(()=>{});
  console.log(log.join('\n')); console.log('errors', JSON.stringify(errs)); if (errs.length) process.exitCode = 1;
  await b.close();
})();
