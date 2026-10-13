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

const TOTAL_WEIGHT = SYMBOLS.reduce((s, x) => s + x.weight, 0);

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
  { id: 'coin_magnet', icon: '🧲', name: 'Магнит монет', desc: '+25% монет за любую победу', price: 250, rarity: 'common', effect: { type: 'coin_bonus', value: 0.25 } }
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

function updateBalance() {
  balanceEl.textContent = state.balance;
  saveState();
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
  return SYMBOLS.find(s => s.name === name);
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
  const effects = { multiplier: 1, insurance: false, reroll: false, coinBonus: 0, consumed: true };
  let newSymbols = [...symbols];

  bonuses.forEach(bonus => {
    switch (bonus.type) {
      case 'multiplier':
        effects.multiplier *= bonus.value;
        break;
      case 'insurance':
        effects.insurance = true;
        break;
      case 'reroll':
        effects.reroll = true;
        break;
      case 'coin_bonus':
        effects.coinBonus += bonus.value;
        break;
      case 'force_diamond':
        newSymbols[0] = getSymbolByName('diamond');
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
  const rareBoost = jackpotHunt ? jackpotHunt.value : 1;

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

const loseOverlayEl = document.getElementById('lose-overlay');
const btnGrannyEl = document.getElementById('btn-granny');
const btnGoLoanEl = document.getElementById('btn-go-loan');

function checkBankruptcy() {
  if (state.balance <= 0 && (!state.inventory || Object.keys(state.inventory).length === 0)) {
    loseOverlayEl.classList.remove('hidden');
  } else {
    loseOverlayEl.classList.add('hidden');
  }
}

btnGrannyEl.addEventListener('click', () => {
  state.balance = DEFAULT_BALANCE;
  state.inventory = {};
  state.activeBonuses = [];
  saveState();
  updateBalance();
  loseOverlayEl.classList.add('hidden');
  showResult('Взяли у бабки! Но больше так не делай 🎁', 'win');
});

btnGoLoanEl.addEventListener('click', () => {
  loseOverlayEl.classList.add('hidden');
  const loanTab = document.querySelector('.tab[data-tab="loans"]');
  if (loanTab) loanTab.click();
});
function renderShop() {
  shopEl.innerHTML = '';
  SHOP_ITEMS.forEach(item => {
    const owned = state.inventory[item.id] || 0;
    const card = document.createElement('div');
    card.className = `card rarity-${item.rarity}`;
    
    let buttonText = 'Купить';
    if (owned > 0) {
      buttonText = 'Купить (у вас: ' + owned + ')';
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
    card.querySelector('button').addEventListener('click', () => buyItem(item));
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
    card.querySelector('button').addEventListener('click', () => useItem(item));
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
    return `${item.icon} <b>${item.name}</b>`;
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

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    if (tab.dataset.tab === 'shop') renderShop();
    if (tab.dataset.tab === 'inventory') renderInventory();
  });
});

document.querySelectorAll('.quick-bets button').forEach(btn => {
  btn.addEventListener('click', () => {
    betInput.value = btn.dataset.bet;
  });
});

spinBtn.addEventListener('click', spin);

document.getElementById('reset').addEventListener('click', () => {
  if (confirm('Сбросить баланс, инвентарь и бонусы?')) {
    state = { balance: DEFAULT_BALANCE, inventory: {}, activeBonuses: [], stats: { spins: 0, wins: 0, bestWin: 0 }, activeLoan: 0, loanTimeLeft: 0, underArrest: false };
    saveState();
    updateBalance();
    renderShop();
    renderInventory();
    renderActiveBonus();
    showResult('Всё сброшено! 🎁', 'win');
  }
});
let loanTimer = null;
const targetSymbols = ['🐔', '🚨', '⚠️', '🇷🇺', '⚖️', '💼'];
let currentTargetSymbol = '';

const loanStatusText = document.getElementById('loan-status-text');
const loanTimerDisplay = document.getElementById('loan-timer-display');
const loanTakeBlock = document.getElementById('loan-take-block');
const loanAmountInput = document.getElementById('loan-amount-input');
const loanTimeHint = document.getElementById('loan-time-hint');
const btnTakeLoan = document.getElementById('btn-take-loan');
const btnReturnLoan = document.getElementById('btn-return-loan');
const prosecutorOverlay = document.getElementById('prosecutor-overlay');
const prosecutorText = document.getElementById('prosecutor-text');
const btnProsecutorOk = document.getElementById('btn-prosecutor-ok');

loanAmountInput.addEventListener('input', () => {
  const amount = Number(loanAmountInput.value) || 0;
  let totalSeconds = 110;
  if (amount > 100) {
    totalSeconds += Math.floor((amount - 1) / 100) * 20;
  }
  const displayMin = Math.floor(totalSeconds / 60);
  const displaySec = totalSeconds % 60;
  loanTimeHint.textContent = 'Вам будет дано: ' + displayMin + ' мин ' + displaySec + ' сек';
});

btnTakeLoan.addEventListener('click', () => {
  const amount = Math.min(500, Math.max(10, Number(loanAmountInput.value) || 100));
  state.activeLoan = amount;
  state.balance += amount;
  
  let totalSeconds = 110;
  if (amount > 100) {
    totalSeconds += Math.floor((amount - 1) / 100) * 20;
  }
  state.loanTimeLeft = totalSeconds;
  
  saveState();
  updateBalance();
  startLoanCountdown();
});

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
    loanTimerDisplay.textContent = (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    loanStatusText.textContent = 'Долг висит! Нужно вернуть: ' + state.activeLoan + ' 🪙';
    loanStatusText.style.color = '#f59e0b';
  }, 1000);
}

btnReturnLoan.addEventListener('click', () => {
  if (state.balance < state.activeLoan) {
    alert('У тебя нет столько денег, нищий! Крути барабаны быстрее!');
    return;
  }
  state.balance -= state.activeLoan;
  clearInterval(loanTimer);
  clearLoanState();
  showResult('Ура! Долг выплачен, прокуратура уехала! 💼', 'win');
});

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
}

function triggerProsecution() {
  state.balance = -state.activeLoan;
  state.underArrest = true;
  saveState();
  updateBalance();
  
  prosecutorText.innerHTML = 'Ты просрочил таймер микрозайма! Баланс улетел в <b>' + state.balance + ' 🪙</b>. Все покупки и крутки заблокированы!';
  btnProsecutorOk.textContent = 'Принять судьбу 🐔💀';
  prosecutorOverlay.classList.remove('hidden');
}

btnProsecutorOk.addEventListener('click', () => {
  prosecutorOverlay.classList.add('hidden');
  spinBtn.disabled = true;
  document.querySelectorAll('.card button').forEach(b => b.disabled = true);
  showStreetBeggingInterface();
});

function showStreetBeggingInterface() {
  const slotContent = document.getElementById('tab-slot');
  slotContent.innerHTML = `
    <div class="slot-machine" style="text-align: center; padding: 32px 16px;">
      <h2 style="color: #ef4444; font-size: 22px;">ТЫ АРЕСТОВАН 🚨</h2>
      <p style="margin: 12px 0; color: #aaa;">Баланс: <span id="arrest-balance-text">${state.balance}</span> 🪙. Крутить нельзя.</p>
      <div id="street-no-text" style="color: #ef4444; font-size: 32px; font-weight: 900; min-height: 40px; margin: 10px 0;"></div>
      <button id="btn-beg-street" class="spin-btn" style="background: linear-gradient(135deg, #f59e0b, #d97706); width: 100%;">
        Попросить денег на улице 🧎‍♂️
      </button>
      <div id="mini-game-box" style="display: none; margin-top: 24px; background: rgba(0,0,0,0.3); padding: 16px; border-radius: 12px; border: 1px solid #444;">
        <p style="font-size: 14px; margin-bottom: 10px;"><b>ОТРАБОТКА ДОЛГА (+50 🪙 за клик)</b><br>Быстро лови правильные символы прокурора!</p>
        <div id="mini-game-target" style="font-size: 48px; margin: 16px 0; height: 60px; cursor: pointer; user-select: none;">🐔</div>
      </div>
    </div>
  `;
  
  document.getElementById('btn-beg-street').addEventListener('click', () => {
    const noText = document.getElementById('street-no-text');
    noText.textContent = 'НЕТ!';
    state.balance = -1000;
    saveState();
    document.getElementById('arrest-balance-text').textContent = state.balance;
    tg?.HapticFeedback?.notificationOccurred('error');
    
    setTimeout(() => {
      document.getElementById('mini-game-box').style.display = 'block';
      document.getElementById('btn-beg-street').style.display = 'none';
      startMiniGameRound();
    }, 1200);
  });
}

function startMiniGameRound() {
  const targetEl = document.getElementById('mini-game-target');
  if (!targetEl) return;
  currentTargetSymbol = targetSymbols[Math.floor(Math.random() * targetSymbols.length)];
  targetEl.textContent = currentTargetSymbol;
  
  targetEl.onclick = () => {
    state.balance += 50;
    saveState();
    document.getElementById('arrest-balance-text').textContent = state.balance;
    tg?.HapticFeedback?.impactOccurred('light');
    
    if (state.balance >= 0) {
      alert('Ты полностью отработал штраф на исправительных работах! Прокуратура уехала.');
      clearLoanState();
      location.reload();
    } else {
      startMiniGameRound();
    }
  };
}

function checkArrestOnLoad() {
  if (state.underArrest) {
    setTimeout(() => { showStreetBeggingInterface(); }, 100);
  } else if (state.activeLoan && state.loanTimeLeft > 0) {
    startLoanCountdown();
  }
}

const originalLoadState = loadState;
loadState = function() {
  const s = originalLoadState();
  if (s && s.activeLoan === undefined) s.activeLoan = 0;
  if (s && s.loanTimeLeft === undefined) s.loanTimeLeft = 0;
  if (s && s.underArrest === undefined) s.underArrest = false;
  return s;
};

const originalUpdateBalance = updateBalance;
updateBalance = function() {
  originalUpdateBalance();
  checkBankruptcy();
};

setTimeout(() => {
  updateBalance();
  checkArrestOnLoad();
}, 500);
