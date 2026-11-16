// 人が操作するのと同じ順番で、ボタンを押して流れ全体を確かめる。使い方: node tests/flow.js 400（画面の幅）
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
  const fb = async () => (await p.$$eval('[data-flash], .guide .fb.warn', els => els.map(e => e.textContent.replace(/\s+/g,' ').slice(0, 90)))).join(' || ');
  const code = async () => p.evaluate(() => { let h = 2166136261 >>> 0; for (const ch of "otp" + Math.floor(Date.now() / 30000)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return String(h % 1000000).padStart(6, "0"); });
  const st = () => p.evaluate(() => JSON.parse(localStorage.getItem('kasou-renshujo.v2')));
  const check = async (label, cond) => { if (!cond) process.exitCode = 1; log.push((cond ? 'OK  ' : 'NG  ') + label); };
  await c('#tab-exp');
  // step1 incl. wrong 2FA
  await p.fill('#pw', 'short'); await c('[data-act=signup]'); await check('短いパスワードを拒否', (await st()).acct === null);
  await p.fill('#pw', 'password123'); await c('[data-act=signup]'); await c('[data-act=kyc]');
  await p.fill('#otp', '000000'); await c('[data-act=twofa]'); await check('間違った2段階コードを拒否', !(await st()).acct.twofa);
  await p.fill('#otp', await code()); await c('[data-act=twofa]'); await check('口座開設', (await st()).acct.twofa === true);
  await c('[data-step="2"]'); await c('[data-act=deposit]'); await check('入金 10万', (await st()).jpy === 100000);
  await c('[data-step="3"]'); await p.fill('#otcamt', '40000'); await c('[data-act=otcbuy]'); let s1 = await st(); await check('販売所で仮ETH購入', s1.exb.ETH > 0 && s1.jpy === 60000);
  await c('[data-step="4"]'); await p.fill('#oq', '0.01'); await c('[data-act=order]'); s1 = await st(); await check('成行の約定', s1.fills.length === 1);
  await c('[data-otype=limit]'); await p.fill('#oq', '0.01'); await c('[data-act=order]'); s1 = await st(); await check('指値が注文中に', s1.orders.some(o => o.st === 'open'));
  for (let i = 0; i < 4; i++) await c('[data-act=advance]'); s1 = await st(); await check('指値の約定', s1.orders.every(o => o.st !== 'open') && s1.done[4] && s1.done[4][2]);
  // step5
  await c('[data-step="5"]'); await c('[data-act=wnew]'); await p.waitForTimeout(150);
  await p.fill('#wp1', 'walletpass'); await p.fill('#wp2', 'different'); await c('[data-act=wpw]'); await check('パスワード不一致を拒否', !(await st()).wal.pwSet);
  await p.fill('#wp1', 'walletpass'); await p.fill('#wp2', 'walletpass'); await c('[data-act=wpw]');
  await c('[data-act=reveal]'); await c('[data-act=tocheck]');
  const words = (await st()).wal.words;
  const pool = await p.$$eval('[data-fill]', els => els.map(e => e.dataset.fill));
  const wrong = pool.find(x => !words.includes(x)); await c(`[data-fill="${wrong}"]`); await c(`[data-fill="${words[6]}"]`); await c(`[data-fill="${words[10]}"]`); await c('[data-act=fillok]');
  await check('間違った英単語を拒否', !(await st()).wal.backed);
  for (const k of [2,6,10]) await c(`[data-fill="${words[k]}"]`); await c('[data-act=fillok]'); await check('ウォレット作成', (await st()).wal.backed);
  // step6 traps: wrong network, then poisoned, then correct
  await c('[data-step="6"]'); await c('[data-scr=wal]'); await c('[data-wscr=recv]'); await c('[data-act=copyfull]');
  await c('[data-scr=ex]'); await c('[data-act=regopen]'); await c('[data-act=pastewal]'); await p.selectOption('#dn', 'bnb'); await p.fill('#otp2', await code()); await c('[data-act=regdest]');
  await p.selectOption('#wd', '0'); await p.fill('#wq', '0.01'); await p.fill('#otp3', await code()); await c('[data-act=withdraw]');
  s1 = await st(); await check('ネットワーク違い→届かない', s1.wds.at(-1).st === 'lost' && (s1.wal.bal.ETH || 0) === 0); log.push('   メッセージ: ' + (await fb()).slice(0, 80));
  await c('[data-act=regopen]'); await c('[data-act=pastehist]'); await p.fill('#otp2', await code()); await c('[data-act=regdest]');
  await p.selectOption('#wd', '1'); await p.fill('#wq', '0.01'); await p.fill('#otp3', await code()); await c('[data-act=withdraw]');
  s1 = await st(); await check('似たアドレス→失う', s1.wds.at(-1).st === 'lost');
  await c('[data-act=regopen]'); await c('[data-act=pastewal]'); await p.fill('#otp2', await code()); await c('[data-act=regdest]');
  await p.selectOption('#wd', '2'); await p.fill('#wq', '0.05'); await p.fill('#otp3', await code()); await c('[data-act=withdraw]');
  s1 = await st(); await check('正しい出金→ウォレットに着金', s1.wds.at(-1).st === 'done' && s1.wal.bal.ETH > 0.04);
  await c("[data-scr=wal]"); await c("[data-act=confirmpending]"); await check('段階6完了', (await st()).done[6][2] === true);
  // step7: USDC send without ETH? use ETH; also friend
  await c('[data-step="7"]'); await c('[data-wscr=send]'); await p.fill('#st', '0x1234'); await c('[data-act=sendnext]'); await check('不正なアドレスを拒否', !((await st()).sendDraft || {}).confirm);
  await c('[data-act=pastefriend]'); await p.fill('#sa', '0.005'); await c('[data-act=sendnext]'); await c('[data-act=sendgo]'); s1 = await st(); await check('友人へ送金', s1.done[7] && s1.done[7][1]);
  // step8: type amount then click swap immediately (blur race)
  await c('[data-step="8"]'); await c('[data-act=connect]'); await c('[data-pop=yes]');
  await p.fill('#sw', '0.015'); await c('[data-act=swap]'); const popVisible = await p.$('[data-pop=yes]'); await check('金額入力直後の「交換する」が効く', !!popVisible);
  await c('[data-pop=yes]'); s1 = await st(); await check('仮ETH→仮USDC', s1.wal.bal.USDC > 0);
  await c('[data-act=flip]'); const amt = await p.inputValue('#sw'); log.push('   向きを変えたときの量: ' + amt + ' / USDC残高 ' + s1.wal.bal.USDC.toFixed(2));
  await c('[data-act=askallow]'); await p.selectOption('#capsel', 'max'); await c('[data-pop=yes]'); s1 = await st(); await check('上限なしの許可→取り消し', s1.dex.allow === 0);
  await c('[data-act=askallow]'); await p.selectOption('#capsel', 'exact'); await c('[data-pop=yes]'); await c('[data-act=swap]'); await c('[data-pop=yes]');
  s1 = await st(); await check('仮USDC→仮ETH（必要な分だけ許可）', s1.done[8] && s1.done[8][2]);
  // step9
  await c('[data-step="9"]'); await c('[data-sig=a][data-v=ok]'); await c('[data-sig=b][data-v=ok]'); s1 = await st(); await check('危険な許可を確定→不合格', !(s1.done[9] && s1.done[9][0]));
  await c('[data-act=sigreset]'); await c('[data-sig=a][data-v=ok]'); await c('[data-sig=b][data-v=no]'); await c('[data-sig=c][data-v=no]'); await c('[data-fake=y]'); s1 = await st(); await check('段階9', s1.done[9][0] && s1.done[9][1]);
  // step10
  await c('[data-step="10"]'); await c('[data-wscr=settings]'); await c('[data-act=lose]'); await c('[data-act=wrestore]');
  await p.fill('#rw', words.slice().reverse().join(' ')); await c('[data-act=restorego]'); await check('順番違いを拒否', (await st()).lost === true);
  await p.fill('#rw', words.join('  ').toUpperCase()); await c('[data-act=restorego]'); s1 = await st(); await check('英単語で復元（大文字・余分な空白も可）', s1.lost === false && s1.wal.bal.ETH > 0);
  await c('[data-step="11"]'); for (const k of ['where','list','howto']) { await p.check(`[data-inh=${k}]`); await p.waitForTimeout(60); }
  s1 = await st(); await check('全段階完了', [1,2,3,4,5,6,7,8,9,10,11].every(n => { const t = s1.done[n] || {}; return Object.keys(t).length >= 1; }));
  // lessons
  await c('#tab-learn'); const n = await p.$$eval('ol.list li', els => els.length); await check('基本の部屋 8＋慣れてきたら 1 = ' + n, n === 9);
  await c('[data-lesson=tax]'); await c('[data-ans="1"]'); await check('税金の部屋の確認問題', (await st()).lessons.tax === true);
  await c('#lang'); const en = await p.textContent('h2'); await check('英語切替: ' + en, /Taxes/.test(en)); await c('#lang');
  console.log(log.join('\n')); console.log('errors', JSON.stringify(errs)); if (errs.length) process.exitCode = 1;
  await b.close();
})();
