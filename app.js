const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor?.('#1a1a2e');
}

const SYMBOLS = [
  { icon: '🍒', weight: 20, payout: 4,   name: 'cherry'  },
  { icon: '🍋', weight: 20, payout: 4,   name: 'lemon'   },
  { icon: '🍊', weight: 18, payout: 5,   name: 'orange'  },
  { icon: '🍇', weight: 16, payout: 6,   name: 'grape'   },
  { icon: '🍉', weight: 14, payout: 8,   name: 'melon'   },
  { icon: '🔔', weight: 10, payout: 12,  name: 'bell'    },
  { icon: '⭐', weight: 8,  payout: 20,  name: 'star'    },
  { icon: '💎', weight: 5,  payout: 40,  name: 'diamond' },
  { icon: '👑', weight: 3,  payout: 60,  name: 'crown'   },
  { icon: '7️⃣', weight: 2,  payout: 100, name: 'seven'   },
  { icon: '🎰', weight: 1,  payout: 250, name: 'jackpot' },
];

const STORAGE_KEY = 'casino_state_v2';
const DEFAULT_BALANCE = 1000;

const SHOP_ITEMS = [
  { id: 'lucky_charm', icon: '🍀', name: 'Клевер удачи', desc: '+50% к следующему выигрышу', price: 150, rarity: 'rare', effect: { type: 'multiplier', value: 1.5 } },
  { id: 'double_win', icon: '✖️', name: 'Двойной куш', desc: 'Удваивает следующий выигрыш', price: 400, rarity: 'epic', effect: { type: 'multiplier', value: 2 } },
  { id: 'triple_win', icon: '🔱', name: 'Тройной куш', desc: 'Утраивает следующий выигрыш', price: 900, rarity: 'legendary', effect: { type: 'multiplier', value: 3 } },
  { id: 'insurance', icon: '🛡️', name: 'Страховка', desc: 'Возврат ставки при проигрыше', price: 200, rarity: 'rare', effect: { type: 'insurance' } },
  { id: 'reroll', icon: '🔄', name: 'Переброс', desc: 'Автоповтор при проигрыше', price: 300, rarity: 'epic', effect: { type: 'reroll' } },
  { id: 'diamond_boost', icon: '💠', name: 'Алмазный буст', desc: 'Заменяет первый символ на 💎', price: 500, rarity: 'epic', effect: { type: 'force_diamond' } },
  { id: 'jackpot_hunt', icon: '🎯', name: 'Охота за джекпотом', desc: 'Повышает шанс редких символов ×3', price: 700, rarity: 'legendary', effect: { type: 'rare_boost', value: 3 } },
  { id: 'coin_magnet', icon: '🧲', name: 'Магнит монет', desc: '+25% монет за любую победу', price: 250, rarity: 'common', effect: { type: 'coin_bonus', value: 0.25 } },
  { id: 'banana_boost', icon: '🍌', name: 'Банановый Бум', desc: 'Добавляет +15% шанс на выигрышную пару', price: 180, rarity: 'common', effect: { type: 'pair_boost', value: 1.15 } },
  { id: 'prosecutor_bribe', icon: '💸', name: 'Взятка прокурору', desc: 'Удлиняет таймер текущего/нового займа на +60 сек', price: 350, rarity: 'rare', effect: { type: 'extend_timer', value: 60 } }
];
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.activeBonuses) {
        parsed.activeBonuses = parsed.activeBonus ? [parsed.activeBonus] : [];
        delete parsed.activeBonus;
      }
      if (parsed.activeLoan === undefined) parsed.activeLoan = 0;
      if (parsed.loanTimeLeft === undefined) parsed.loanTimeLeft = 0;
      if (parsed.underArrest === undefined) parsed.underArrest = false;
      return parsed;
    }
  } catch (e) {}
  return {
    balance: DEFAULT_BALANCE,
    inventory: {},
    activeBonuses: [],
    stats: { spins: 0, wins: 0, bestWin: 0 },
    activeLoan: 0,
    loanTimeLeft: 0,
    underArrest: false
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const balanceEl = document.getElementById('balance');
const resultEl = document.getElementById('result');
const spinBtn = document.getElementById('spin');
const betInput = document.getElementById('bet');
const reels = [
  document.getElementById('reel1'),
  document.getElementById('reel2'),
  document.getElementById('reel3'),
];
const shopEl = document.getElementById('shop-items');
const invEl = document.getElementById('inventory-items');
const activeBonusEl = document.getElementById('active-bonus');

const loanStatusText = document.getElementById('loan-status-text');
const loanTimerDisplay = document.getElementById('loan-timer-display');
const loanTakeBlock = document.getElementById('loan-take-block');
const loanAmountInput = document.getElementById('loan-amount-input');
const loanTimeHint = document.getElementById('loan-time-hint');
const btnTakeLoan = document.getElementById('btn-take-loan');
const btnReturnLoan = document.getElementById('btn-return-loan');
const prosecutorOverlay = document.getElementById('prosecutor-overlay');
const prosecutorText = document.getElementById('prosecutor-text');

const loseOverlayEl = document.getElementById('lose-overlay');
const btnGrannyEl = document.getElementById('btn-granny');
const btnGoLoanEl = document.getElementById('btn-go-loan');
const copsOverlay = document.getElementById('cops-overlay');

function updateBalance() {
  balanceEl.textContent = state.balance.toString();
  saveState();
  checkBankruptcy();
}

function checkBankruptcy() {
  const hasInventory = Object.keys(state.inventory).some(key => state.inventory[key] > 0);
  if (state.balance <= 0 && !hasInventory && state.activeLoan === 0 && !state.underArrest) {
    loseOverlayEl.classList.remove('hidden');
  } else {
    loseOverlayEl.classList.add('hidden');
  }
}


function pickSymbol(rareBoost = 1) {
  const weighted = SYMBOLS.map(s => {
    const isRare = ['💎', '👑', '7️⃣', '🎰'].includes(s.icon);
    return { ...s, weight: s.weight * (isRare ? rareBoost : 1) };
  });
  const total = weighted.reduce((sum, s) => sum + s.weight, 0);
  let rand = Math.random() * total;
  for (const s of weighted) {
    rand -= s.weight;
    if (rand <= 0) return s;
  }
  return weighted[0];
}

function getSymbolByName(name) {
  return SYMBOLS.find(s => s.name === name) || SYMBOLS[0];
}

function calculateWin(symbols, bet) {
  const [a, b, c] = symbols;
  const icons = symbols.map(s => s.icon);

  if (a.name === b.name && b.name === c.name) {
    let payout = a.payout;
    let label = `${icons.join('')} Три в ряд!`;
    if (a.name === 'jackpot') label = `${icons.join('')} 🎉 ДЖЕКПОТ!`;
    else if (a.name === 'seven') label = `${icons.join('')} 🔥 Счастливая семёрка!`;
    else if (a.name === 'crown') label = `${icons.join('')} 👑 Королевский куш!`;
    else if (a.name === 'diamond') label = `${icons.join('')} 💎 Алмазный куш!`;
    return { win: bet * payout, text: label, multiplier: payout };
  }

  if (a.name === b.name || b.name === c.name || a.name === c.name) {
    const matched = a.name === b.name ? a : (b.name === c.name ? b : a);
    const payout = Math.max(2, Math.floor(matched.payout / 2));
    return { win: bet * payout, text: `${matched.icon}${matched.icon} Пара!`, multiplier: payout };
  }

  return { win: 0, text: 'Увы, не повезло 😢', multiplier: 0 };
}
function animateSpin(finalSymbols, callback) {
  reels.forEach(r => r.classList.add('spinning'));
  const startTime = Date.now();
  const duration = 800;

  const interval = setInterval(() => {
    reels.forEach(r => r.textContent = pickSymbol().icon);
    if (Date.now() - startTime > duration) {
      clearInterval(interval);
      finalSymbols.forEach((sym, i) => {
        setTimeout(() => {
          reels[i].textContent = sym.icon;
          reels[i].classList.remove('spinning');
          if (i === finalSymbols.length - 1) callback();
        }, i * 200);
      });
    }
  }, 60);
}

function applyBonusOnSpin(symbols, bet) {
  const bonuses = state.activeBonuses || [];
  const effects = { multiplier: 1, insurance: false, reroll: false, coinBonus: 0 };
  let newSymbols = [...symbols];

  bonuses.forEach(bonus => {
    switch (bonus.type) {
      case 'multiplier':
        effects.multiplier *= bonus.value || 1;
        break;
      case 'insurance':
        effects.insurance = true;
        break;
      case 'reroll':
        effects.reroll = true;
        break;
      case 'coin_bonus':
        effects.coinBonus += bonus.value || 0;
        break;
      case 'force_diamond':
        newSymbols = getSymbolByName('diamond');
        break;
    }
  });

  return { symbols: newSymbols, bonusEffects: effects };
}
async function spin() {
  if (spinBtn.disabled) return;

  const bet = Number(betInput.value);
  if (!bet || bet < 1) return showResult('Введите корректную ставку', 'lose');
  if (bet > state.balance) return showResult('Недостаточно монет! 💸', 'lose');

  spinBtn.disabled = true;

  const jackpotHunt = state.activeBonuses?.find(b => b.type === 'rare_boost');
  const rareBoost = jackpotHunt ? (jackpotHunt.value || 1) : 1;

  let symbols = [pickSymbol(rareBoost), pickSymbol(rareBoost), pickSymbol(rareBoost)];
  const applied = applyBonusOnSpin(symbols, bet);
  symbols = applied.symbols;

  state.balance -= bet;
  updateBalance();
  state.stats.spins++;

  animateSpin(symbols, async () => {
    let result = calculateWin(symbols, bet);

    if (result.win === 0 && applied.bonusEffects?.reroll) {
      symbols = [pickSymbol(rareBoost), pickSymbol(rareBoost), pickSymbol(rareBoost)];
      reels.forEach((r, i) => r.textContent = symbols[i].icon);
      result = calculateWin(symbols, bet);
    }

    let finalWin = result.win;

    if (applied.bonusEffects) {
      if (applied.bonusEffects.multiplier > 1) finalWin *= applied.bonusEffects.multiplier;
      if (applied.bonusEffects.coinBonus > 0) finalWin = Math.floor(finalWin * (1 + applied.bonusEffects.coinBonus));
    }

    if (finalWin === 0 && applied.bonusEffects?.insurance) {
      finalWin = bet;
      showResult(`🛡️ Страховка вернула ставку: ${bet} 🪙`, 'win');
      state.balance += finalWin;
      updateBalance();
    } else if (finalWin > 0) {
      state.balance += finalWin;
      updateBalance();
      state.stats.wins++;
      if (finalWin > state.stats.bestWin) state.stats.bestWin = finalWin;
      showResult(`${result.text} +${finalWin} 🪙`, 'win');
      tg?.HapticFeedback?.notificationOccurred('success');
    } else {
      showResult(result.text, 'lose');
      tg?.HapticFeedback?.notificationOccurred('error');
    }

    if (state.activeBonuses && state.activeBonuses.length > 0) {
      state.activeBonuses = [];
      renderActiveBonus();
      saveState();
    }

    spinBtn.disabled = false;
  });
}

function showResult(text, type) {
  resultEl.textContent = text;
  resultEl.className = 'result ' + type;
}

function renderShop() {
  shopEl.innerHTML = '';
  SHOP_ITEMS.forEach(item => {
    const owned = state.inventory[item.id] || 0;
    const card = document.createElement('div');
    card.className = `card rarity-${item.rarity}`;
    
    let buttonText = 'Купить';
    if (owned > 0) {
      buttonText = `Купить (у вас: ${owned})`;
    }

    card.innerHTML = `
      <div class="icon">${item.icon}</div>
      <div class="name">${item.name}</div>
      <div class="desc">${item.desc}</div>
      <div class="price">${item.price} 🪙</div>
      <button class="buy" ${state.balance < item.price ? 'disabled' : ''}>
        ${buttonText}
      </button>
    `;
    shopEl.appendChild(card);
  });
}
function renderInventory() {
  const entries = Object.entries(state.inventory).filter(([, qty]) => qty > 0);

  if (entries.length === 0) {
    invEl.innerHTML = '<p class="hint">Инвентарь пуст. Загляните в магазин!</p>';
    return;
  }

  invEl.innerHTML = '';
  entries.forEach(([id, qty]) => {
    const item = SHOP_ITEMS.find(i => i.id === id);
    if (!item) return;
    const card = document.createElement('div');
    card.className = `card owned rarity-${item.rarity}`;
    card.innerHTML = `
      <div class="icon">${item.icon}</div>
      <div class="name">${item.name} ×${qty}</div>
      <div class="desc">${item.desc}</div>
      <button class="use">Активировать</button>
    `;
    invEl.appendChild(card);
  });
}

function renderActiveBonus() {
  if (!state.activeBonuses || state.activeBonuses.length === 0) {
    activeBonusEl.classList.add('hidden');
    return;
  }
  activeBonusEl.classList.remove('hidden');
  const activeItemsText = state.activeBonuses.map(activeBonus => {
    const item = SHOP_ITEMS.find(i => i.id === activeBonus.id);
    return `${item?.icon} <b>${item?.name}</b>`;
  }).join(', ');
  activeBonusEl.innerHTML = `Активно комбо: ${activeItemsText}`;
}

function buyItem(item) {
  if (state.balance < item.price) return;
  state.balance -= item.price;
  state.inventory[item.id] = (state.inventory[item.id] || 0) + 1;
  updateBalance();
  renderShop();
  renderInventory();
  tg?.HapticFeedback?.impactOccurred('medium');
}

function useItem(item) {
  if (!state.inventory[item.id]) return;

  if (item.effect.type === 'extend_timer') {
    if (state.activeLoan > 0) {
      state.loanTimeLeft += item.effect.value || 60;
      state.inventory[item.id]--;
      if (state.inventory[item.id] === 0) delete state.inventory[item.id];
      saveState();
      renderInventory();
      renderShop();
      alert(`⏱️ Таймер займа успешно увеличен на +${item.effect.value} секунд!`);
    } else {
      alert('У вас нет активных займов для продления!');
    }
    return;
  }

  if (state.activeBonuses.some(b => b.id === item.id)) {
    alert('Этот буст уже активирован на следующий спин!');
    return;
  }
  state.inventory[item.id]--;
  if (state.inventory[item.id] === 0) delete state.inventory[item.id];

  state.activeBonuses.push({ id: item.id, ...item.effect });
  saveState();
  renderInventory();
  renderShop();
  renderActiveBonus();
  tg?.HapticFeedback?.impactOccurred('light');
  document.querySelector('.tab[data-tab="slot"]').click();
}
function calculateLoanTime(amount) {
  let baseSeconds = 110;
  if (amount > 100) {
    baseSeconds += Math.floor((amount - 100) / 100) * 20;
  }
  return baseSeconds;
}

loanAmountInput.addEventListener('input', () => {
  const amount = Number(loanAmountInput.value) || 0;
  const totalSeconds = calculateLoanTime(amount);
  const displayMin = Math.floor(totalSeconds / 60);
  const displaySec = totalSeconds % 60;
  loanTimeHint.textContent = `Вам будет дано: ${displayMin} мин ${displaySec} сек`;
});

let loanTimer = null;

function startLoanCountdown() {
  loanTakeBlock.style.display = 'none';
  btnReturnLoan.style.display = 'block';
  loanTimerDisplay.style.display = 'block';
  
  if (loanTimer) clearInterval(loanTimer);
  
  loanTimer = setInterval(() => {
    state.loanTimeLeft--;
    saveState();
    
    if (state.loanTimeLeft <= 0) {
      clearInterval(loanTimer);
      triggerProsecution();
      return;
    }
    
    const m = Math.floor(state.loanTimeLeft / 60);
    const s = state.loanTimeLeft % 60;
    loanTimerDisplay.textContent = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    loanStatusText.textContent = `Долг висит! Нужно вернуть: ${state.activeLoan} 🪙`;
    loanStatusText.style.color = '#f59e0b';
  }, 1000);
}

function clearLoanState() {
  state.activeLoan = 0;
  state.loanTimeLeft = 0;
  state.underArrest = false;
  saveState();
  updateBalance();
  
  loanTakeBlock.style.display = 'block';
  btnReturnLoan.style.display = 'none';
  loanTimerDisplay.style.display = 'none';
  loanStatusText.textContent = 'Вы чисты перед законом. Пока что...';
  loanStatusText.style.color = '#4ade80';
  spinBtn.disabled = false;
  
  const originalSlot = document.getElementById('tab-slot');
  if (originalSlot && originalSlot.getAttribute('data-begging') === 'true') {
    location.reload();
  }
}
let snake = [];
let snakeDir = {x: 1, y: 0};
let gameFood = {x: 5, y: 5};
let snakeTimer = null;
const gridSize = 15;

const targetSymbols = ['🐔', '🚨', '⚠️', '🇷🇺', '⚖️', '💼'];
let currentTargetSymbol = '';

function spawnSnakeFood() {
  gameFood = {
    x: Math.floor(Math.random() * gridSize),
    y: Math.floor(Math.random() * gridSize)
  };
}

function handleSnakeCrash() {
  tg?.HapticFeedback?.notificationOccurred('error');
  state.balance = -1000;
  saveState();
  const balanceText = document.getElementById('arrest-balance-text');
  if (balanceText) balanceText.textContent = state.balance.toString();
  alert('💥 Ты врезался! Прокурор выписал новый штраф, баланс снова -1000 🪙. Соберись!');
  initSnakeGame();
}

function tickSnake() {
  const canvas = document.getElementById('snakeCanvas');
  if (!canvas) { clearInterval(snakeTimer); return; }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const head = {x: snake[0].x + snakeDir.x, y: snake[0].y + snakeDir.y};

  if (head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize) {
    handleSnakeCrash();
    return;
  }
  for (let cell of snake) {
    if (head.x === cell.x && head.y === cell.y) {
      handleSnakeCrash();
      return;
    }
  }

  snake.unshift(head);

  if (head.x === gameFood.x && head.y === gameFood.y) {
    state.balance += 100;
    saveState();
    const balanceText = document.getElementById('arrest-balance-text');
    if (balanceText) balanceText.textContent = state.balance.toString();
    tg?.HapticFeedback?.impactOccurred('medium');
    
    if (state.balance >= 0) {
      clearInterval(snakeTimer);
      alert('Ты полностью отработал штраф в Змейке! Прокуратура уехала.');
      clearLoanState();
      return;
    }
    spawnSnakeFood();
  } else {
    snake.pop();
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  ctx.fillStyle = '#ef4444';
  ctx.font = '12px serif';
  ctx.fillText('💼', gameFood.x * 15 + 1, gameFood.y * 15 + 12);

  snake.forEach((cell, idx) => {
    if (idx === 0) {
      ctx.fillStyle = '#22c55e';
      ctx.font = '12px serif';
      ctx.fillText('🐍', cell.x * 15 + 1, cell.y * 15 + 12);
    } else {
      ctx.fillStyle = '#4ade80';
      ctx.fillRect(cell.x * 15 + 1, cell.y * 15 + 1, 13, 13);
    }
  });
}

function initSnakeGame() {
  snake = [{x: 7, y: 7}, {x: 6, y: 7}, {x: 5, y: 7}];
  snakeDir = {x: 1, y: 0};
  spawnSnakeFood();
  
  window.onkeydown = (e) => {
    if (e.key === 'ArrowUp' && snakeDir.y === 0) snakeDir = {x: 0, y: -1};
    if (e.key === 'ArrowDown' && snakeDir.y === 0) snakeDir = {x: 0, y: 1};
    if (e.key === 'ArrowLeft' && snakeDir.x === 0) snakeDir = {x: -1, y: 0};
    if (e.key === 'ArrowRight' && snakeDir.x === 0) snakeDir = {x: 1, y: 0};
  };

  document.getElementById('sk-up')?.addEventListener('click', () => { if(snakeDir.y === 0) snakeDir = {x: 0, y: -1}; });
  document.getElementById('sk-down')?.addEventListener('click', () => { if(snakeDir.y === 0) snakeDir = {x: 0, y: 1}; });
  document.getElementById('sk-left')?.addEventListener('click', () => { if(snakeDir.x === 0) snakeDir = {x: -1, y: 0}; });
  document.getElementById('sk-right')?.addEventListener('click', () => { if(snakeDir.x === 0) snakeDir = {x: 1, y: 0}; });

  if (snakeTimer) clearInterval(snakeTimer);
  snakeTimer = setInterval(tickSnake, 200);
}

function showStreetBeggingInterface() {
  const slotContent = document.getElementById('tab-slot');
  slotContent.setAttribute('data-begging', 'true');
  slotContent.innerHTML = `
    <div class="slot-machine" style="text-align: center; padding: 16px;">
      <h2 style="color: #ef4444; font-size: 20px; margin-bottom: 4px;">ТЫ АРЕСТОВАН 🚨</h2>
      <p style="margin-bottom: 8px; color: #aaa; font-size: 14px;">Баланс: <span id="arrest-balance-text">${state.balance}</span> 🪙</p>
      <div id="street-no-text" style="color: #ef4444; font-size: 28px; font-weight: 900; min-height: 34px;"></div>
      <button id="btn-beg-street" class="spin-btn" style="background: linear-gradient(135deg, #f59e0b, #d97706); width: 100%; padding: 12px;">
        Попросить денег на улице 🧎‍♂️
      </button>
      <div id="mini-game-box" style="display: none; margin-top: 12px; background: #000; padding: 8px; border-radius: 12px; border: 2px solid #ef4444;">
        <p style="font-size: 11px; margin-bottom: 6px; color: #f87171;"><b>ОТРАБОТКА ДОЛГА: СЪЕШЬ ПОВЕСТКИ (💼) ДО БАЛАНСА >= 0</b><br>Врезался — баланс сбрасывается в -1000!</p>
        <canvas id="snakeCanvas" width="225" height="225" style="background: #111; display: block; margin: 0 auto; border: 1px solid #333;"></canvas>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; width: 150px; margin: 10px auto 0;">
          <div></div><button class="quick-bets button" id="sk-up" style="padding:8px;">▲</button><div></div>
          <button class="quick-bets button" id="sk-left" style="padding:8px;">◀</button><div></div><button class="quick-bets button" id="sk-right" style="padding:8px;">▶</button>
          <div></div><button class="quick-bets button" id="sk-down" style="padding:8px;">▼</button><div></div>
        </div>
      </div>
    </div>
  `;
  
  const btnBegStreet = document.getElementById('btn-beg-street');
  btnBegStreet.addEventListener('click', () => {
    const noText = document.getElementById('street-no-text');
    noText.textContent = 'НЕТ!';
    state.balance = -1000;
    saveState();
    const balanceText = document.getElementById('arrest-balance-text');
    if (balanceText) balanceText.textContent = state.balance.toString();
    tg?.HapticFeedback?.notificationOccurred('error');
    
    setTimeout(() => {
      const box = document.getElementById('mini-game-box');
      if(box) box.style.display = 'block';
      btnBegStreet.style.display = 'none';
      initSnakeGame();
    }, 1200);
  });
}

function triggerProsecution() {
  state.balance = -state.activeLoan;
  state.underArrest = true;
  saveState();
  updateBalance();
  
  prosecutorOverlay.classList.remove('hidden');
  spinBtn.disabled = true;
  document.querySelectorAll('.card button').forEach(b => b.disabled = true);
  
  setTimeout(() => {
    prosecutorOverlay.classList.add('hidden');
    showStreetBeggingInterface();
  }, 2500);
}
document.addEventListener('click', (e) => {
  const target = e.target;
  
  if (target && target.id === 'spin') {
    spin();
    return;
  }
  
  const tab = target.closest('.tab');
  if (tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    tab.classList.add('active');
    const targetId = `tab-${tab.dataset.tab}`;
    document.getElementById(targetId)?.classList.add('active');
    
    if (tab.dataset.tab === 'shop') renderShop();
    if (tab.dataset.tab === 'inventory') renderInventory();
    return;
  }
  
  const betBtn = target.closest('.quick-bets button');
  if (betBtn && !betBtn.id.startsWith('sk-')) {
    betInput.value = betBtn.dataset.bet || '10';
    return;
  }

  if (target.classList.contains('buy') && !target.hasAttribute('disabled')) {
    const card = target.closest('.card');
    const nameText = card?.querySelector('.name')?.textContent;
    const item = SHOP_ITEMS.find(i => i.name === nameText);
    if (item) buyItem(item);
    return;
  }

  if (target.classList.contains('use')) {
    const card = target.closest('.card');
    const nameText = card?.querySelector('.name')?.textContent?.split(' ×')[0];
    const item = SHOP_ITEMS.find(i => i.name === nameText);
    if (item) useItem(item);
    return;
  }

  if (target.id === 'btn-take-loan') {
    const amount = Number(loanAmountInput.value);
    if (amount > 0 && state.activeLoan === 0) {
      state.activeLoan = amount;
      state.balance += amount;
      state.loanTimeLeft = calculateLoanTime(amount);
      updateBalance();
      startLoanCountdown();
    }
    return;
  }

  if (target.id === 'btn-return-loan') {
    if (state.balance >= state.activeLoan) {
      state.balance -= state.activeLoan;
      clearLoanState();
      if (loanTimer) clearInterval(loanTimer);
    } else {
      alert('Недостаточно денег для возврата займа!');
    }
    return;
  }
});

document.getElementById('reset')?.addEventListener('click', () => {
  if (confirm('Сбросить баланс, инвентарь и бонусы?')) {
    let wasArrested = state.underArrest;
    
    if (loanTimer) clearInterval(loanTimer);
    if (snakeTimer) clearInterval(snakeTimer);

    state = { 
      balance: DEFAULT_BALANCE, 
      inventory: {}, 
      activeBonuses: [], 
      stats: { spins: 0, wins: 0, bestWin: 0 }, 
      activeLoan: 0, 
      loanTimeLeft: 0, 
      underArrest: false,
      prosecutorEscaped: wasArrested
    };
    
    saveState();
    location.reload();
  }
});


function checkArrestOnLoad() {
  if (state.prosecutorEscaped) {
    state.balance = 50;
    state.prosecutorEscaped = false;
    saveState();
    updateBalance();
    
    copsOverlay.classList.remove('hidden');
    document.getElementById('btn-cops-ok')?.addEventListener('click', () => {
      copsOverlay.classList.add('hidden');
    });
    return;
  }

  if (state.underArrest) {
    showStreetBeggingInterface();
  } else if (state.activeLoan > 0 && state.loanTimeLeft > 0) {
    startLoanCountdown();
  }
}


updateBalance();
renderShop();
renderInventory();
renderActiveBonus();
checkArrestOnLoad();
