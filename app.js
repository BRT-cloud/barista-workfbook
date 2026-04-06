/* ============================================================
   카페 바리스타 훈련 시뮬레이터 — 메인 로직
   ============================================================ */

// ── 상수 ──
const STAGES = [
  {
    id: 1, icon: '🧹', name: '매장 오픈 준비',
    desc: '카페 오픈 전 매장을 준비하세요',
    tasks: [
      { id: 'lights', icon: '💡', name: '조명 켜기', desc: '매장 조명을 켜주세요' },
      { id: 'sign', icon: '🪧', name: '간판 뒤집기', desc: 'CLOSED → OPEN 으로 변경' },
      { id: 'table', icon: '🧻', name: '테이블 세팅', desc: '냅킨과 설탕 배치' },
      { id: 'machine', icon: '☕', name: '머신 예열', desc: '에스프레소 머신 예열' }
    ]
  },
  {
    id: 2, icon: '📋', name: '음료 주문 받기',
    desc: '손님의 주문을 듣고 올바른 메뉴를 선택하세요',
    tasks: [
      { id: 'greet', icon: '👋', name: '인사하기', desc: '손님에게 인사' },
      { id: 'order', icon: '📝', name: '주문 확인', desc: '주문을 정확히 선택' },
      { id: 'confirm', icon: '✅', name: '주문 확정', desc: '최종 주문 확인' }
    ]
  },
  {
    id: 3, icon: '💰', name: '계산하기',
    desc: '주문 금액을 확인하고 결제를 처리하세요',
    tasks: [
      { id: 'total', icon: '🧾', name: '금액 확인', desc: '주문 금액 확인' },
      { id: 'payment', icon: '💳', name: '결제 처리', desc: '카드/현금 결제' }
    ]
  },
  {
    id: 4, icon: '🥛', name: '음료 제조하기',
    desc: '레시피에 맞게 음료를 만드세요',
    tasks: [
      { id: 'cup', icon: '🥤', name: '컵 준비', desc: '적합한 컵을 선택' },
      { id: 'espresso', icon: '☕', name: '에스프레소 추출', desc: '2샷 추출하기' },
      { id: 'ingredient', icon: '🥛', name: '재료 추가', desc: '우유/물/얼음 추가' },
      { id: 'finish', icon: '✨', name: '완성', desc: '음료 마무리' }
    ]
  },
  {
    id: 5, icon: '🫗', name: '음료 서빙 및 마무리',
    desc: '음료를 전달하고 마무리하세요',
    tasks: [
      { id: 'pickup', icon: '🤲', name: '음료 들기', desc: '완성된 음료를 집어 올리기' },
      { id: 'serve', icon: '🫗', name: '서빙하기', desc: '손님에게 전달' },
      { id: 'greeting', icon: '😊', name: '인사하기', desc: '"맛있게 드세요!"' },
      { id: 'goodbye', icon: '👋', name: '배웅 인사', desc: '"감사합니다, 또 오세요!"' },
      { id: 'cleanup', icon: '🧹', name: '정리하기', desc: '테이블 정리' }
    ]
  }
];

const MENU_ITEMS = [
  { id: 'americano', icon: '☕', name: '아메리카노', price: 4500 },
  { id: 'latte', icon: '🥛', name: '카페라떼', price: 5000 },
  { id: 'cappuccino', icon: '☕', name: '카푸치노', price: 5000 },
  { id: 'vanilla', icon: '🍦', name: '바닐라라떼', price: 5500 },
  { id: 'caramel', icon: '🍯', name: '카라멜마끼아또', price: 5500 },
  { id: 'choco', icon: '🍫', name: '초코라떼', price: 5000 }
];

const CUSTOMERS = [
  { emoji: '👩', name: '김미영' },
  { emoji: '👨', name: '이준호' },
  { emoji: '👧', name: '박서연' },
  { emoji: '🧑', name: '최민수' },
  { emoji: '👩‍🦰', name: '정하늘' }
];

// ── 상태 ──
let state = {
  screen: 'start',
  currentStageId: null,
  completedStages: new Set(),
  completedTasks: {},   // { stageId: Set([taskId, ...]) }
  score: 0,
  currentOrder: null,   // { customer, menuItem }
  stageStartTime: null,
  subStep: 0            // 단계 내 세부 진행
};

// ── DOM 헬퍼 ──
const $ = id => document.getElementById(id);

// ============================================================
//  TTS & 음성 인식 유틸리티
// ============================================================
function speak(text, rate = 0.9) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ko-KR'; u.rate = rate;
  const v = speechSynthesis.getVoices().find(v => v.lang.startsWith('ko'));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => {};
function autoSpeak(text, delay = 800) { setTimeout(() => speak(text), delay); }

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

function startMic(phrase, fb, btn) {
  if (!SpeechRec) { fb.textContent = '이 브라우저에서는 음성 인식이 지원되지 않습니다'; return; }
  const r = new SpeechRec(); r.lang = 'ko-KR'; r.interimResults = false;
  btn.classList.add('recording'); btn.textContent = '🔴 듣는 중...';
  fb.textContent = '말해보세요...';
  r.onresult = e => {
    const t = e.results[0][0].transcript;
    btn.classList.remove('recording'); btn.textContent = '🎤 따라하기';
    const clean = s => s.replace(/[^가-힣]/g, '');
    const sim = [...clean(t)].filter(c => clean(phrase).includes(c)).length / Math.max(clean(phrase).length, 1);
    fb.innerHTML = sim > 0.4
      ? `<span class="fb-ok">✅ 잘했어요! "${t}"</span>`
      : `<span class="fb-retry">🔄 "${t}" — 다시 해볼까요?</span>`;
  };
  r.onerror = () => { btn.classList.remove('recording'); btn.textContent = '🎤 따라하기'; fb.textContent = '다시 시도해주세요'; };
  r.start();
}

function practiceHTML(phrase) {
  return `<div class="practice-section pop-in">
    <div class="practice-label">💬 이렇게 말해보세요</div>
    <div class="practice-phrase">"${phrase}"</div>
    <div class="practice-btns">
      <button class="prac-listen">🔊 들어보기</button>
      <button class="prac-mic">🎤 따라하기</button>
    </div>
    <div class="practice-fb"></div>
  </div>`;
}

function bindPractice(container, phrase) {
  const s = container.querySelector('.practice-section');
  if (!s) return;
  s.querySelector('.prac-listen')?.addEventListener('click', () => speak(phrase));
  const mb = s.querySelector('.prac-mic'), fb = s.querySelector('.practice-fb');
  mb?.addEventListener('click', () => startMic(phrase, fb, mb));
}

// ── 초기화 ──
function init() {
  loadProgress();
  renderStartScreen();
  bindGlobalEvents();
}

// ── 글로벌 이벤트 ──
function bindGlobalEvents() {
  $('btn-start').addEventListener('click', () => showScreen('select'));
  $('btn-back-select').addEventListener('click', () => showScreen('start'));
  $('btn-back-game').addEventListener('click', () => showScreen('select'));
  $('btn-modal-next').addEventListener('click', onModalNext);
  $('btn-retry').addEventListener('click', onRetry);
  $('btn-final-close').addEventListener('click', () => showScreen('select'));
}

// ── 화면 전환 ──
function showScreen(name) {
  state.screen = name;
  ['start-screen', 'select-screen', 'game-screen'].forEach(id => {
    $(id).classList.add('hidden');
  });

  if (name === 'start') {
    $('start-screen').classList.remove('hidden');
  } else if (name === 'select') {
    $('select-screen').classList.remove('hidden');
    renderStageSelect();
  } else if (name === 'game') {
    $('game-screen').classList.remove('hidden');
  }
}

// ============================================================
//  시작 화면
// ============================================================
function renderStartScreen() {
  const container = $('start-stages');
  container.innerHTML = STAGES.map(s =>
    `<div class="start-stage-chip">
      <span class="chip-num">${s.id}</span>
      <span>${s.icon} ${s.name}</span>
    </div>`
  ).join('');
}

// ============================================================
//  과제 선택 화면
// ============================================================
function renderStageSelect() {
  const completed = state.completedStages.size;
  $('select-progress-label').textContent = `${completed} / 5 완료`;
  $('select-progress-fill').style.width = `${(completed / 5) * 100}%`;

  const list = $('stage-list');
  list.innerHTML = STAGES.map(s => {
    const isDone = state.completedStages.has(s.id);
    const isUnlocked = s.id === 1 || state.completedStages.has(s.id - 1);
    const isCurrent = isUnlocked && !isDone;
    let cls = '';
    if (isDone) cls = 'completed';
    else if (isCurrent) cls = 'current';
    else cls = 'locked';

    return `<div class="stage-card ${cls}" data-stage="${s.id}">
      <div class="stage-icon">${s.icon}</div>
      <div class="stage-info">
        <div class="stage-num">${s.id}단계</div>
        <div class="stage-name">${s.name}</div>
        <div class="stage-desc">${s.desc}</div>
      </div>
      ${!isUnlocked ? '<div class="stage-lock-icon">🔒</div>' : ''}
    </div>`;
  }).join('');

  list.querySelectorAll('.stage-card:not(.locked)').forEach(card => {
    card.addEventListener('click', () => {
      const sid = parseInt(card.dataset.stage);
      enterStage(sid);
    });
  });
}

// ============================================================
//  게임 화면 진입
// ============================================================
function enterStage(stageId) {
  state.currentStageId = stageId;
  state.stageStartTime = Date.now();
  state.subStep = 0;
  if (!state.completedTasks[stageId]) {
    state.completedTasks[stageId] = new Set();
  }

  const stage = STAGES.find(s => s.id === stageId);
  showScreen('game');

  // HUD 업데이트
  $('hud-icon').textContent = stage.icon;
  $('hud-name').textContent = `${stageId}단계: ${stage.name}`;
  $('hud-score').textContent = `⭐ ${state.score}`;
  updateHudProgress(stageId);

  // 주문 정보 생성 (2단계 이후용)
  if (!state.currentOrder) {
    const customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
    const menuItem = MENU_ITEMS[Math.floor(Math.random() * MENU_ITEMS.length)];
    state.currentOrder = { customer, menuItem };
  }

  // 단계별 렌더
  renderStageContent(stageId);
}

function updateHudProgress(stageId) {
  const stage = STAGES.find(s => s.id === stageId);
  const done = state.completedTasks[stageId] ? state.completedTasks[stageId].size : 0;
  const total = stage.tasks.length;
  $('hud-progress-fill').style.width = `${(done / total) * 100}%`;
}

// ============================================================
//  단계별 콘텐츠 렌더링
// ============================================================
function renderStageContent(stageId) {
  const scene = $('cafe-scene');
  const stage = STAGES.find(s => s.id === stageId);
  const doneTasks = state.completedTasks[stageId] || new Set();

  switch (stageId) {
    case 1: renderStageOpen(scene, stage, doneTasks); break;
    case 2: renderStageOrder(scene, stage, doneTasks); break;
    case 3: renderStagePayment(scene, stage, doneTasks); break;
    case 4: renderStageMake(scene, stage, doneTasks); break;
    case 5: renderStageServe(scene, stage, doneTasks); break;
  }

  renderChecklist(stage, doneTasks);
  updateGuide(stageId, doneTasks);
}

// ── 체크리스트 렌더 ──
function renderChecklist(stage, doneTasks) {
  const cl = $('task-checklist');
  const nextTask = stage.tasks.find(t => !doneTasks.has(t.id));
  cl.innerHTML = `<div class="checklist-title">📋 과제 목록</div>` +
    stage.tasks.map(t => {
      const isDone = doneTasks.has(t.id);
      const isActive = nextTask && nextTask.id === t.id;
      return `<div class="checklist-item ${isDone ? 'done' : ''} ${isActive ? 'active-task' : ''}">
        <span class="check-icon">${isDone ? '✅' : isActive ? '▶' : '⬜'}</span>
        <span>${t.name}</span>
      </div>`;
    }).join('');
}

// ── 가이드 업데이트 ──
function updateGuide(stageId, doneTasks) {
  const stage = STAGES.find(s => s.id === stageId);
  const nextTask = stage.tasks.find(t => !doneTasks.has(t.id));
  if (nextTask) {
    $('guide-icon').textContent = nextTask.icon;
    $('guide-text').textContent = nextTask.desc;
  } else {
    $('guide-icon').textContent = '🎉';
    $('guide-text').textContent = '모든 과제를 완료했어요!';
  }
  $('guide-panel').classList.remove('hidden');
}

// ── 과제 완료 처리 ──
function completeTask(stageId, taskId) {
  if (!state.completedTasks[stageId]) state.completedTasks[stageId] = new Set();
  if (state.completedTasks[stageId].has(taskId)) return;

  state.completedTasks[stageId].add(taskId);
  state.score += 10;
  $('hud-score').textContent = `⭐ ${state.score}`;

  showToast('✅', `${STAGES.find(s=>s.id===stageId).tasks.find(t=>t.id===taskId).name} 완료!`, 'success');

  const stage = STAGES.find(s => s.id === stageId);
  const allDone = stage.tasks.every(t => state.completedTasks[stageId].has(t.id));

  updateHudProgress(stageId);

  if (allDone) {
    setTimeout(() => onStageComplete(stageId), 600);
  } else {
    renderStageContent(stageId);
  }
}

// ── 단계 완료 ──
function onStageComplete(stageId) {
  state.completedStages.add(stageId);
  saveProgress();
  fireConfetti();

  const stage = STAGES.find(s => s.id === stageId);
  const elapsed = Math.round((Date.now() - state.stageStartTime) / 1000);

  $('modal-emoji').textContent = '🎉';
  $('modal-title').textContent = `${stage.name} 완료!`;
  $('modal-sub').textContent = `${stageId}단계를 성공적으로 마쳤습니다`;
  $('modal-stats').innerHTML = `
    <div class="stat-row"><span class="stat-label">완료한 과제</span><span class="stat-value">${stage.tasks.length}개</span></div>
    <div class="stat-row"><span class="stat-label">소요 시간</span><span class="stat-value">${elapsed}초</span></div>
    <div class="stat-row"><span class="stat-label">획득 점수</span><span class="stat-value">+${stage.tasks.length * 10}점</span></div>
  `;

  if (stageId >= 5) {
    $('btn-modal-next').textContent = '최종 결과 보기 🏆';
  } else {
    $('btn-modal-next').textContent = '다음 단계로 →';
  }

  $('stage-modal').classList.remove('hidden');
  $('guide-panel').classList.add('hidden');
}

function onModalNext() {
  $('stage-modal').classList.add('hidden');
  const sid = state.currentStageId;

  if (sid >= 5) {
    showFinalModal();
  } else {
    // 다음 단계 준비: 주문 데이터는 유지
    enterStage(sid + 1);
  }
}

function showFinalModal() {
  $('final-stats').innerHTML = `
    <div class="stat-row"><span class="stat-label">총 점수</span><span class="stat-value">⭐ ${state.score}점</span></div>
    <div class="stat-row"><span class="stat-label">완료 단계</span><span class="stat-value">${state.completedStages.size}/5</span></div>
    <div class="stat-row"><span class="stat-label">등급</span><span class="stat-value">${state.score >= 150 ? '🏅 마스터 바리스타' : state.score >= 100 ? '⭐ 숙련 바리스타' : '☕ 수습 바리스타'}</span></div>
  `;
  $('final-modal').classList.remove('hidden');
  fireConfetti();
  fireConfetti();
}

function onRetry() {
  state = {
    screen: 'start', currentStageId: null,
    completedStages: new Set(), completedTasks: {},
    score: 0, currentOrder: null, stageStartTime: null, subStep: 0
  };
  localStorage.removeItem('cafeSimProgress');
  $('final-modal').classList.add('hidden');
  showScreen('start');
}

// ============================================================
//  1단계: 매장 오픈 준비
// ============================================================
function renderStageOpen(scene, stage, doneTasks) {
  scene.innerHTML = `
    <div class="scene-header slide-up">
      <div class="scene-emoji">🏪</div>
      <div class="scene-title">매장 오픈 준비</div>
      <div class="scene-sub">아이템을 클릭하여 오픈 준비를 완료하세요</div>
    </div>
    <div class="items-grid">
      ${stage.tasks.map(t => `
        <div class="item-card ${doneTasks.has(t.id) ? 'done' : ''} pop-in" data-task="${t.id}">
          <div class="item-icon">${t.icon}</div>
          <div class="item-name">${t.name}</div>
          <div class="item-desc">${t.desc}</div>
        </div>
      `).join('')}
    </div>
  `;

  scene.querySelectorAll('.item-card:not(.done)').forEach(card => {
    card.addEventListener('click', () => {
      const tid = card.dataset.task;
      card.classList.add('done', 'item-complete-anim');
      completeTask(1, tid);
    });
  });
}

// ============================================================
//  2단계: 음료 주문 받기
// ============================================================
function renderStageOrder(scene, stage, doneTasks) {
  const { customer, menuItem } = state.currentOrder;
  const baristaGreet = '어서오세요! 무엇을 도와드릴까요?';
  const customerOrder = `${menuItem.name} 한 잔 주세요!`;
  const baristaConfirm = `${menuItem.name} 한 잔, ${menuItem.price.toLocaleString()}원입니다.`;

  if (!doneTasks.has('greet')) {
    scene.innerHTML = `
      <div class="customer-area slide-up">
        <div class="customer-emoji">${customer.emoji}</div>
        <div class="scene-title">${customer.name} 손님이 오셨습니다</div>
        <div class="scene-sub">손님에게 인사해주세요</div>
      </div>
      ${practiceHTML(baristaGreet)}
      <button class="btn-serve pop-in" id="btn-greet-customer">👋 인사하고 진행하기</button>
    `;
    bindPractice(scene, baristaGreet);
    $('btn-greet-customer').addEventListener('click', () => {
      speak(baristaGreet);
      completeTask(2, 'greet');
    });
  } else if (!doneTasks.has('order')) {
    scene.innerHTML = `
      <div class="customer-area slide-up">
        <div class="customer-emoji">${customer.emoji}</div>
        <div class="speech-bubble">"${customerOrder}"</div>
        <div class="customer-voice-tag">🔊 손님 음성 자동 재생</div>
      </div>
      ${practiceHTML('네, ' + menuItem.name + '요! 잠시만 기다려주세요.')}
      <div class="scene-sub" style="color:rgba(255,255,255,.6);margin:4px 0 8px">올바른 메뉴를 선택하세요</div>
      <div class="menu-grid">
        ${MENU_ITEMS.map(m => `
          <div class="menu-card pop-in" data-menu="${m.id}">
            <div class="menu-icon">${m.icon}</div>
            <div class="menu-name">${m.name}</div>
          </div>
        `).join('')}
      </div>
    `;
    autoSpeak(customerOrder);
    bindPractice(scene, '네, ' + menuItem.name + '요! 잠시만 기다려주세요.');
    scene.querySelectorAll('.menu-card').forEach(card => {
      card.addEventListener('click', () => {
        if (card.dataset.menu === menuItem.id) {
          card.classList.add('correct');
          setTimeout(() => completeTask(2, 'order'), 400);
        } else {
          card.classList.add('wrong');
          showToast('❌', '다시 확인해주세요!', 'error');
          setTimeout(() => card.classList.remove('wrong'), 600);
        }
      });
    });
  } else if (!doneTasks.has('confirm')) {
    const customerReply = '네, 맞아요!';
    scene.innerHTML = `
      <div class="customer-area slide-up">
        <div class="customer-emoji">${customer.emoji}</div>
        <div class="scene-title">주문 확인</div>
        <div class="speech-bubble" style="margin-top:12px">${menuItem.icon} ${menuItem.name} — ${menuItem.price.toLocaleString()}원</div>
      </div>
      ${practiceHTML(baristaConfirm)}
      <button class="btn-serve pop-in" id="btn-confirm-order">✅ 주문 확정하기</button>
    `;
    bindPractice(scene, baristaConfirm);
    $('btn-confirm-order').addEventListener('click', () => {
      speak(baristaConfirm);
      autoSpeak(customerReply, 2000);
      completeTask(2, 'confirm');
    });
  }
}

// ============================================================
//  3단계: 계산하기
// ============================================================
function renderStagePayment(scene, stage, doneTasks) {
  const { customer, menuItem } = state.currentOrder;
  const baristaTotal = `총 ${menuItem.price.toLocaleString()}원입니다.`;
  const baristaPayDone = '결제 완료되었습니다. 감사합니다!';

  if (!doneTasks.has('total')) {
    scene.innerHTML = `
      ${practiceHTML(baristaTotal)}
      <div class="pos-terminal slide-up">
        <div class="scene-sub" style="color:var(--text-dim);margin-bottom:12px">💰 POS 단말기</div>
        <div class="pos-screen">
          <div class="pos-item"><span>${menuItem.name}</span><span>${menuItem.price.toLocaleString()}원</span></div>
          <div class="pos-total"><span>합계</span><span>${menuItem.price.toLocaleString()}원</span></div>
        </div>
        <button class="btn-serve" id="btn-check-total">🧾 금액 확인 완료</button>
      </div>
    `;
    bindPractice(scene, baristaTotal);
    $('btn-check-total').addEventListener('click', () => {
      speak(baristaTotal);
      completeTask(3, 'total');
    });
  } else if (!doneTasks.has('payment')) {
    const customerPay = '카드로 할게요!';
    scene.innerHTML = `
      <div class="customer-area slide-up" style="padding:16px">
        <div class="customer-emoji" style="font-size:40px">${customer.emoji}</div>
        <div class="speech-bubble">"${customerPay}"</div>
        <div class="customer-voice-tag">🔊 손님 음성 자동 재생</div>
      </div>
      ${practiceHTML('네, 결제 도와드리겠습니다.')}
      <div class="pos-terminal slide-up">
        <div class="pos-screen">
          <div class="pos-total"><span>결제 금액</span><span>${menuItem.price.toLocaleString()}원</span></div>
        </div>
        <div class="payment-btns">
          <button class="pay-btn" data-pay="card"><span class="pay-icon">💳</span>카드 결제</button>
          <button class="pay-btn" data-pay="cash"><span class="pay-icon">💵</span>현금 결제</button>
        </div>
      </div>
    `;
    autoSpeak(customerPay);
    bindPractice(scene, '네, 결제 도와드리겠습니다.');
    scene.querySelectorAll('.pay-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        speak(baristaPayDone);
        showToast('💳', '결제가 완료되었습니다!', 'success');
        completeTask(3, 'payment');
      });
    });
  }
}

// ============================================================
//  4단계: 음료 제조하기
// ============================================================
function renderStageMake(scene, stage, doneTasks) {
  const { menuItem } = state.currentOrder;
  const steps = stage.tasks;
  const currentIdx = steps.findIndex(t => !doneTasks.has(t.id));

  const doneCount = doneTasks.size;
  const liquidPct = Math.min((doneCount / steps.length) * 100, 100);
  const liquidColors = ['transparent', '#3d1c00', '#8B4513', '#c4a882'];
  const liquidColor = liquidColors[Math.min(doneCount, liquidColors.length - 1)];

  scene.innerHTML = `
    <div class="scene-header slide-up">
      <div class="scene-emoji">${menuItem.icon}</div>
      <div class="scene-title">${menuItem.name} 제조</div>
      <div class="scene-sub">레시피 순서대로 클릭하세요</div>
    </div>
    <div class="cup-visual">
      <div class="cup">
        <div class="cup-handle"></div>
        <div class="cup-liquid" style="height:${liquidPct}%;background:${liquidColor}"></div>
      </div>
    </div>
    <div class="recipe-steps">
      ${steps.map((t, i) => {
        let cls = '';
        if (doneTasks.has(t.id)) cls = 'done';
        else if (i === currentIdx) cls = 'active';
        else cls = 'locked';
        return `<div class="recipe-step ${cls}" data-task="${t.id}">
          <div class="step-num">${doneTasks.has(t.id) ? '✓' : i + 1}</div>
          <div class="step-info">
            <div class="step-name">${t.name}</div>
            <div class="step-desc">${t.desc}</div>
          </div>
          <div class="step-action">${t.icon}</div>
        </div>`;
      }).join('')}
    </div>
  `;

  scene.querySelectorAll('.recipe-step.active').forEach(step => {
    step.addEventListener('click', () => {
      const tid = step.dataset.task;
      completeTask(4, tid);
    });
  });
}

// ============================================================
//  5단계: 음료 서빙 및 마무리
// ============================================================
function renderStageServe(scene, stage, doneTasks) {
  const { customer, menuItem } = state.currentOrder;
  const baristaServe = `주문하신 ${menuItem.name} 나왔습니다!`;
  const baristaEnjoy = '맛있게 드세요!';
  const baristaBye = '감사합니다, 또 오세요!';

  if (!doneTasks.has('pickup')) {
    scene.innerHTML = `
      <div class="serve-area slide-up">
        <div class="scene-header">
          <div class="scene-emoji">${menuItem.icon}</div>
          <div class="scene-title">${menuItem.name} 완성!</div>
          <div class="scene-sub">음료를 들어 올려주세요</div>
        </div>
        <button class="btn-serve pop-in" style="margin-top:20px" id="btn-pickup">🤲 음료 들기</button>
      </div>
    `;
    $('btn-pickup').addEventListener('click', () => completeTask(5, 'pickup'));
  } else if (!doneTasks.has('serve')) {
    scene.innerHTML = `
      <div class="serve-area slide-up">
        <div class="serve-drink">${menuItem.icon}</div>
        <div class="customer-emoji" style="font-size:48px;margin-bottom:12px">${customer.emoji}</div>
        <div class="scene-sub" style="color:var(--text-dim);margin-bottom:16px">${customer.name} 손님에게 전달해주세요</div>
      </div>
      ${practiceHTML(baristaServe)}
      <button class="btn-serve pop-in" id="btn-serve-drink">🫗 서빙하기</button>
    `;
    bindPractice(scene, baristaServe);
    $('btn-serve-drink').addEventListener('click', () => {
      speak(baristaServe);
      completeTask(5, 'serve');
    });
  } else if (!doneTasks.has('greeting')) {
    const customerThanks = '감사합니다! 맛있을 것 같아요!';
    scene.innerHTML = `
      <div class="serve-area slide-up">
        <div class="customer-reaction">
          <div class="reaction-emoji">😊</div>
          <div class="reaction-text">${customer.name}: "${customerThanks}"</div>
          <div class="customer-voice-tag">🔊 손님 음성 자동 재생</div>
        </div>
      </div>
      ${practiceHTML(baristaEnjoy)}
      <button class="btn-serve pop-in" style="margin-top:16px" id="btn-serve-greet">😊 인사하고 진행하기</button>
    `;
    autoSpeak(customerThanks);
    bindPractice(scene, baristaEnjoy);
    $('btn-serve-greet').addEventListener('click', () => {
      speak(baristaEnjoy);
      completeTask(5, 'greeting');
    });
  } else if (!doneTasks.has('goodbye')) {
    const customerBye = '네, 또 올게요! 맛있었어요!';
    scene.innerHTML = `
      <div class="serve-area slide-up">
        <div class="customer-emoji" style="font-size:60px;margin-bottom:12px">${customer.emoji}</div>
        <div class="scene-title">${customer.name} 손님에게 인사해주세요</div>
      </div>
      ${practiceHTML(baristaBye)}
      <button class="btn-serve pop-in" style="margin-top:16px" id="btn-goodbye">👋 인사하고 진행하기</button>
    `;
    bindPractice(scene, baristaBye);
    $('btn-goodbye').addEventListener('click', () => {
      speak(baristaBye);
      autoSpeak(customerBye, 2000);
      completeTask(5, 'goodbye');
    });
  } else if (!doneTasks.has('cleanup')) {
    scene.innerHTML = `
      <div class="scene-header slide-up">
        <div class="scene-emoji">🧹</div>
        <div class="scene-title">테이블 정리</div>
        <div class="scene-sub">사용한 자리를 깨끗이 정리해주세요</div>
      </div>
      <div class="items-grid">
        <div class="item-card pop-in" data-task="wipe">
          <div class="item-icon">🧽</div>
          <div class="item-name">테이블 닦기</div>
        </div>
        <div class="item-card pop-in" data-task="trash">
          <div class="item-icon">🗑️</div>
          <div class="item-name">쓰레기 버리기</div>
        </div>
      </div>
    `;
    let cleanupCount = 0;
    scene.querySelectorAll('.item-card').forEach(card => {
      card.addEventListener('click', () => {
        card.classList.add('done', 'item-complete-anim');
        cleanupCount++;
        if (cleanupCount >= 2) {
          setTimeout(() => completeTask(5, 'cleanup'), 400);
        }
      });
    });
  }
}

// ============================================================
//  유틸리티
// ============================================================
function showToast(icon, msg, type) {
  const toast = $('toast');
  $('toast-icon').textContent = icon;
  $('toast-msg').textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 1800);
}

function fireConfetti() {
  const colors = ['#f59e0b', '#ef4444', '#8b5cf6', '#22c55e', '#3b82f6', '#ec4899'];
  for (let i = 0; i < 40; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.animationDelay = Math.random() * 0.8 + 's';
    el.style.animationDuration = (2 + Math.random() * 1.5) + 's';
    el.style.width = (6 + Math.random() * 8) + 'px';
    el.style.height = (6 + Math.random() * 8) + 'px';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }
}

function saveProgress() {
  const data = {
    completedStages: [...state.completedStages],
    score: state.score
  };
  localStorage.setItem('cafeSimProgress', JSON.stringify(data));
}

function loadProgress() {
  try {
    const data = JSON.parse(localStorage.getItem('cafeSimProgress'));
    if (data) {
      state.completedStages = new Set(data.completedStages || []);
      state.score = data.score || 0;
    }
  } catch (e) { /* ignore */ }
}

// ── 시작 ──
init();
