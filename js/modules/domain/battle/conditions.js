export const CONDITION_KEYS = Object.freeze({
  BLINDED: 'blinded',
  CHARMED: 'charmed',
  DEAFENED: 'deafened',
  FRIGHTENED: 'frightened',
  GRAPPLED: 'grappled',
  INCAPACITATED: 'incapacitated',
  INVISIBLE: 'invisible',
  PARALYZED: 'paralyzed',
  PETRIFIED: 'petrified',
  POISONED: 'poisoned',
  PRONE: 'prone',
  RESTRAINED: 'restrained',
  STUNNED: 'stunned',
  UNCONSCIOUS: 'unconscious',
  EXHAUSTION: 'exhaustion',
});

export const EXHAUSTION_LEVELS = Object.freeze({
  MIN: 1,
  MAX: 6,
});

export const exhaustionTable = Object.freeze([
  { level: 1, effect: '属性检定具有劣势。' },
  { level: 2, effect: '速度减半。' },
  { level: 3, effect: '攻击检定和豁免检定具有劣势。' },
  { level: 4, effect: '生命值上限减半。' },
  { level: 5, effect: '速度降为0。' },
  { level: 6, effect: '死亡。' },
]);

const keyEffectsHtml = Object.freeze({
  [CONDITION_KEYS.BLINDED]: [
    '无法视物；',
    '依赖视觉的属性检定自动失败；',
    '针对你的攻击检定具有优势；',
    '你的攻击检定具有劣势；',
  ],
  [CONDITION_KEYS.CHARMED]: [
    '无法攻击魅惑者或以有害能力/魔法效应指定魅惑者；',
    '魅惑者对你进行的任何社交互动检定具有优势；',
  ],
  [CONDITION_KEYS.DEAFENED]: [
    '无法听见；',
    '依赖听觉的属性检定自动失败；',
  ],
  [CONDITION_KEYS.FRIGHTENED]: [
    '当恐惧源在视线内时，属性检定和攻击检定具有劣势；',
    '不能主动靠近恐惧源。',
  ],
  [CONDITION_KEYS.GRAPPLED]: [
    '速度降为0，且无法从任何速度加值中获益。',
  ],
  [CONDITION_KEYS.INCAPACITATED]: [
    '无法执行动作或反应。',
  ],
  [CONDITION_KEYS.INVISIBLE]: [
    '在没有魔法或特殊感官辅助的情况下无法被看见；',
    '被视为处于重度遮蔽区域；',
    '针对你的攻击检定具有劣势；',
    '你的攻击检定具有优势。',
  ],
  [CONDITION_KEYS.PARALYZED]: [
    '处于失能状态，无法移动或说话；',
    '力量和敏捷豁免自动失败；',
    '针对你的攻击检定具有优势；',
    '5尺内的攻击者若命中则为重击。',
  ],
  [CONDITION_KEYS.PETRIFIED]: [
    '变为固态无机物；',
    '处于失能状态，无法移动、说话且对周围环境无感知；',
    '力量和敏捷豁免自动失败；',
    '针对你的攻击检定具有优势；',
    '获得对所有伤害的抗性；',
    '免疫毒素和疾病。',
  ],
  [CONDITION_KEYS.POISONED]: [
    '攻击检定和属性检定具有劣势。',
  ],
  [CONDITION_KEYS.PRONE]: [
    '唯一的移动选项是爬行；',
    '攻击检定具有劣势；',
    '5尺内的攻击者对你的攻击检定具有优势，超过5尺的攻击者则具有劣势。',
  ],
  [CONDITION_KEYS.RESTRAINED]: [
    '速度降为0；',
    '针对你的攻击检定具有优势，你的攻击检定具有劣势；',
    '敏捷豁免具有劣势。',
  ],
  [CONDITION_KEYS.STUNNED]: [
    '处于失能状态，无法移动，只能结巴地说话；',
    '力量和敏捷豁免自动失败；',
    '针对你的攻击检定具有优势。',
  ],
  [CONDITION_KEYS.UNCONSCIOUS]: [
    '处于失能状态，无法移动、说话且对周围环境无感知；',
    '丢下手中物品并倒地；',
    '力量和敏捷豁免自动失败；',
    '针对你的攻击检定具有优势；',
    '5尺内的攻击者若命中则为重击。',
  ],
  [CONDITION_KEYS.EXHAUSTION]: [],
});

export const conditionDefinitions = Object.freeze({
  [CONDITION_KEYS.BLINDED]: {
    key: CONDITION_KEYS.BLINDED,
    displayName: '目盲 Blinded',
    icon: '🕶️',
    automationLevel: 'partial',
    requiresSource: false,
  },
  [CONDITION_KEYS.CHARMED]: {
    key: CONDITION_KEYS.CHARMED,
    displayName: '魅惑 Charmed',
    icon: '💞',
    automationLevel: 'partial',
    requiresSource: true,
  },
  [CONDITION_KEYS.DEAFENED]: {
    key: CONDITION_KEYS.DEAFENED,
    displayName: '耳聋 Deafened',
    icon: '🔇',
    automationLevel: 'tag',
    requiresSource: false,
  },
  [CONDITION_KEYS.FRIGHTENED]: {
    key: CONDITION_KEYS.FRIGHTENED,
    displayName: '恐慌 Frightened',
    icon: '😱',
    automationLevel: 'partial',
    requiresSource: true,
  },
  [CONDITION_KEYS.GRAPPLED]: {
    key: CONDITION_KEYS.GRAPPLED,
    displayName: '擒抱 Grappled',
    icon: '🤼',
    automationLevel: 'tag',
    requiresSource: false,
  },
  [CONDITION_KEYS.INCAPACITATED]: {
    key: CONDITION_KEYS.INCAPACITATED,
    displayName: '失能 Incapacitated',
    icon: '⛔',
    automationLevel: 'full',
    requiresSource: false,
  },
  [CONDITION_KEYS.INVISIBLE]: {
    key: CONDITION_KEYS.INVISIBLE,
    displayName: '隐形 Invisible',
    icon: '👻',
    automationLevel: 'partial',
    requiresSource: false,
  },
  [CONDITION_KEYS.PARALYZED]: {
    key: CONDITION_KEYS.PARALYZED,
    displayName: '麻痹 Paralyzed',
    icon: '🧊',
    automationLevel: 'full',
    requiresSource: false,
  },
  [CONDITION_KEYS.PETRIFIED]: {
    key: CONDITION_KEYS.PETRIFIED,
    displayName: '石化 Petrified',
    icon: '🗿',
    automationLevel: 'full',
    requiresSource: false,
  },
  [CONDITION_KEYS.POISONED]: {
    key: CONDITION_KEYS.POISONED,
    displayName: '中毒 Poisoned',
    icon: '☠️',
    automationLevel: 'full',
    requiresSource: false,
  },
  [CONDITION_KEYS.PRONE]: {
    key: CONDITION_KEYS.PRONE,
    displayName: '倒地 Prone',
    icon: '🛌',
    automationLevel: 'full',
    requiresSource: false,
  },
  [CONDITION_KEYS.RESTRAINED]: {
    key: CONDITION_KEYS.RESTRAINED,
    displayName: '束缚 Restrained',
    icon: '⛓️',
    automationLevel: 'partial',
    requiresSource: false,
  },
  [CONDITION_KEYS.STUNNED]: {
    key: CONDITION_KEYS.STUNNED,
    displayName: '震慑 Stunned',
    icon: '💫',
    automationLevel: 'full',
    requiresSource: false,
  },
  [CONDITION_KEYS.UNCONSCIOUS]: {
    key: CONDITION_KEYS.UNCONSCIOUS,
    displayName: '昏迷 Unconscious',
    icon: '😴',
    automationLevel: 'full',
    requiresSource: false,
  },
  [CONDITION_KEYS.EXHAUSTION]: {
    key: CONDITION_KEYS.EXHAUSTION,
    displayName: '力竭 Exhaustion',
    icon: '🥀',
    automationLevel: 'partial',
    requiresSource: false,
  },
});

const statusNameToKey = Object.freeze({
  '倒地 Prone': CONDITION_KEYS.PRONE,
  '束缚 Restrained': CONDITION_KEYS.RESTRAINED,
  '致盲 Blinded': CONDITION_KEYS.BLINDED,
  '目盲 Blinded': CONDITION_KEYS.BLINDED,
  '中毒 Poisoned': CONDITION_KEYS.POISONED,
  '魅惑 Charmed': CONDITION_KEYS.CHARMED,
  '恐慌 Frightened': CONDITION_KEYS.FRIGHTENED,
  '耳聋 Deafened': CONDITION_KEYS.DEAFENED,
  '擒抱 Grappled': CONDITION_KEYS.GRAPPLED,
  '失能 Incapacitated': CONDITION_KEYS.INCAPACITATED,
  '隐形 Invisible': CONDITION_KEYS.INVISIBLE,
  '麻痹 Paralyzed': CONDITION_KEYS.PARALYZED,
  '石化 Petrified': CONDITION_KEYS.PETRIFIED,
  '震慑 Stunned': CONDITION_KEYS.STUNNED,
  '昏迷 Unconscious': CONDITION_KEYS.UNCONSCIOUS,
});

function parseExhaustionFromName(name) {
  if (!name) return null;
  const m = String(name).match(/力竭\s*([1-6])\s*级/);
  if (!m) return null;
  return { key: CONDITION_KEYS.EXHAUSTION, level: Number(m[1]) };
}

export function getConditionKeyFromStatusName(name) {
  const parsedEx = parseExhaustionFromName(name);
  if (parsedEx) return parsedEx.key;
  return statusNameToKey[name] || null;
}

export function buildStatusDisplayName(status) {
  const key = normalizeConditionKey(status?.key) || getConditionKeyFromStatusName(status?.name);
  if (!key) return String(status?.name || '');
  if (key === CONDITION_KEYS.EXHAUSTION) {
    const level = normalizeExhaustionLevel(status?.meta?.level) || parseExhaustionFromName(status?.name)?.level;
    if (level) return `力竭 ${level}级`;
    return conditionDefinitions[key].displayName;
  }
  return conditionDefinitions[key]?.displayName || String(status?.name || '');
}

export function normalizeConditionKey(key) {
  if (!key) return null;
  const k = String(key).trim();
  return conditionDefinitions[k] ? k : null;
}

export function normalizeExhaustionLevel(level) {
  const n = Number(level);
  if (!Number.isFinite(n)) return null;
  if (n < EXHAUSTION_LEVELS.MIN || n > EXHAUSTION_LEVELS.MAX) return null;
  return n;
}

export function getConditionDefinition(key) {
  const normalized = normalizeConditionKey(key);
  return normalized ? conditionDefinitions[normalized] : null;
}

export function getConditionKeyEffectsHtml(key, meta) {
  const def = getConditionDefinition(key);
  if (!def) return '';
  if (def.key === CONDITION_KEYS.EXHAUSTION) {
    return `
      <div class="muted small" style="margin-bottom:8px">力竭效果会与更低等级效果累积。</div>
      <table class="table">
        <thead><tr><th style="width:90px">力竭等级</th><th>对应效果</th></tr></thead>
        <tbody>
          ${exhaustionTable.map(r => `<tr${meta?.level === r.level ? ' style="outline:1px solid var(--accent); outline-offset:-1px"' : ''}><td>${r.level}</td><td>${r.effect}</td></tr>`).join('')}
        </tbody>
      </table>
    `;
  }
  const lines = keyEffectsHtml[def.key] || [];
  return `<ul class="bullet-list">${lines.map(x => `<li>${x}</li>`).join('')}</ul>`;
}

export function isManualOrPartialCondition(key) {
  const def = getConditionDefinition(key);
  if (!def) return false;
  return def.automationLevel === 'partial' || def.automationLevel === 'tag';
}

export function isConditionStackableBySource(key) {
  const normalized = normalizeConditionKey(key);
  return normalized === CONDITION_KEYS.CHARMED || normalized === CONDITION_KEYS.FRIGHTENED;
}

export function getStatusIdentity(status) {
  const key = normalizeConditionKey(status?.key) || getConditionKeyFromStatusName(status?.name);
  const sourceUid = status?.sourceUid ?? null;
  if (!key) return { key: null, sourceUid: null, identity: null };
  if (isConditionStackableBySource(key)) return { key, sourceUid, identity: `${key}:${sourceUid || 'unknown'}` };
  return { key, sourceUid: null, identity: key };
}

export function normalizeStatusInstance(raw) {
  if (!raw) return null;
  const key = normalizeConditionKey(raw.key) || getConditionKeyFromStatusName(raw.name);
  const icon = raw.icon || (key ? conditionDefinitions[key]?.icon : null) || '⏳';
  const meta = { ...(raw.meta || {}) };
  if (key === CONDITION_KEYS.EXHAUSTION && meta.level == null) {
    const parsed = parseExhaustionFromName(raw.name);
    if (parsed?.level) meta.level = parsed.level;
  }
  return {
    id: raw.id || crypto.randomUUID(),
    key,
    name: raw.name || (key ? conditionDefinitions[key]?.displayName : ''),
    icon,
    rounds: raw.rounds ?? 1,
    sourceUid: raw.sourceUid ?? null,
    meta,
  };
}

function normalizedStatuses(participant) {
  const list = participant?.statuses;
  if (!Array.isArray(list)) return [];
  return list.map(normalizeStatusInstance).filter(Boolean);
}

export function hasCondition(participant, key, predicate) {
  const normalizedKey = normalizeConditionKey(key);
  if (!normalizedKey) return false;
  for (const s of normalizedStatuses(participant)) {
    if (s.key !== normalizedKey) continue;
    if (!predicate || predicate(s)) return true;
  }
  return false;
}

export function getExhaustionLevel(participant) {
  const list = normalizedStatuses(participant);
  let level = null;
  for (const s of list) {
    if (s.key !== CONDITION_KEYS.EXHAUSTION) continue;
    const n = normalizeExhaustionLevel(s.meta?.level);
    if (n != null) level = level == null ? n : Math.max(level, n);
  }
  return level;
}

export function isActorIncapacitated(participant) {
  return (
    hasCondition(participant, CONDITION_KEYS.INCAPACITATED) ||
    hasCondition(participant, CONDITION_KEYS.PARALYZED) ||
    hasCondition(participant, CONDITION_KEYS.PETRIFIED) ||
    hasCondition(participant, CONDITION_KEYS.STUNNED) ||
    hasCondition(participant, CONDITION_KEYS.UNCONSCIOUS)
  );
}

export function getTargetSelectability(actor, target, action) {
  if (!actor || !target || !action) return { selectable: true, reason: '' };
  if (action.type !== 'attack') return { selectable: true, reason: '' };
  const blocked = hasCondition(actor, CONDITION_KEYS.CHARMED, s => s.sourceUid && s.sourceUid === target.uid);
  if (blocked) return { selectable: false, reason: '不能将攻击检定的动作的攻击目标定为魅惑源头' };
  return { selectable: true, reason: '' };
}

function collectAttackRollFlagsFromStatuses(actor, target) {
  let hasAdv = false;
  let hasDis = false;

  if (hasCondition(actor, CONDITION_KEYS.INVISIBLE)) hasAdv = true;

  if (hasCondition(actor, CONDITION_KEYS.BLINDED)) hasDis = true;
  if (hasCondition(actor, CONDITION_KEYS.POISONED)) hasDis = true;
  if (hasCondition(actor, CONDITION_KEYS.RESTRAINED)) hasDis = true;
  if (hasCondition(actor, CONDITION_KEYS.PRONE)) hasDis = true;

  const ex = getExhaustionLevel(actor);
  if (ex != null && ex >= 3) hasDis = true;

  if (hasCondition(target, CONDITION_KEYS.INVISIBLE)) hasDis = true;

  if (hasCondition(target, CONDITION_KEYS.BLINDED)) hasAdv = true;
  if (hasCondition(target, CONDITION_KEYS.RESTRAINED)) hasAdv = true;
  if (hasCondition(target, CONDITION_KEYS.PARALYZED)) hasAdv = true;
  if (hasCondition(target, CONDITION_KEYS.PETRIFIED)) hasAdv = true;
  if (hasCondition(target, CONDITION_KEYS.STUNNED)) hasAdv = true;
  if (hasCondition(target, CONDITION_KEYS.UNCONSCIOUS)) hasAdv = true;

  return { hasAdv, hasDis };
}

export function getAttackRollFlags(actor, target) {
  return collectAttackRollFlagsFromStatuses(actor, target);
}

export function getAutoAttackRollMode(actor, target) {
  const { hasAdv, hasDis } = collectAttackRollFlagsFromStatuses(actor, target);
  if (hasAdv && hasDis) return 'normal';
  if (hasAdv) return 'adv';
  if (hasDis) return 'dis';
  return 'normal';
}

export function getTargetBadges(actor, target, action, dmRollMode) {
  const infoBadges = [];
  let suffix = null;

  if (hasCondition(target, CONDITION_KEYS.PARALYZED) || hasCondition(target, CONDITION_KEYS.UNCONSCIOUS)) {
    infoBadges.push({ kind: 'info', text: '5尺内重击', tone: 'ok' });
  }
  if (hasCondition(target, CONDITION_KEYS.PETRIFIED)) {
    infoBadges.push({ kind: 'info', text: '全抗性+免毒', tone: 'danger' });
  }
  if (hasCondition(target, CONDITION_KEYS.PRONE)) {
    infoBadges.push({ kind: 'info', text: '5尺优势/远程劣势', tone: 'neutral' });
  }

  if (action?.type === 'attack') {
    const { selectable } = getTargetSelectability(actor, target, action);
    if (!selectable) {
      suffix = { text: '无法选中', tone: 'danger' };
    } else {
      const mode = dmRollMode && dmRollMode !== 'normal' ? dmRollMode : getAutoAttackRollMode(actor, target);
      if (mode === 'adv') suffix = { text: '优势', tone: 'ok' };
      else if (mode === 'dis') suffix = { text: '劣势', tone: 'danger' };
    }
  } else if (action?.type === 'save') {
    const ability = String(action.saveAbility || '').toLowerCase();
    if (ability === 'str' || ability === 'dex') {
      const autoFail =
        hasCondition(target, CONDITION_KEYS.PARALYZED) ||
        hasCondition(target, CONDITION_KEYS.PETRIFIED) ||
        hasCondition(target, CONDITION_KEYS.STUNNED) ||
        hasCondition(target, CONDITION_KEYS.UNCONSCIOUS);
      if (autoFail) suffix = { text: '豁免自动失败', tone: 'ok' };
    }
  }

  return { suffix, infoBadges };
}

export function collectBeforeAttackPrompts(actor, target, action) {
  if (!actor || !target || !action) return [];
  if (action.type !== 'attack') return [];

  const prompts = [];

  if (hasCondition(target, CONDITION_KEYS.PRONE)) {
    prompts.push({
      type: 'proneDistance',
      targetUid: target.uid,
      title: '倒地判定',
      message: `目标【${target.name}】是否在 5 尺内？`,
      yesText: '是（优势）',
      noText: '否（劣势）',
    });
  }

  const frightenedSources = normalizedStatuses(actor)
    .filter(s => s.key === CONDITION_KEYS.FRIGHTENED && s.sourceUid)
    .map(s => s.sourceUid);
  if (frightenedSources.length) {
    prompts.push({
      type: 'frightenedLOS',
      sources: frightenedSources,
      title: '恐慌判定',
      message: '是否有任意恐惧源在视线内？',
      yesText: '是（劣势）',
      noText: '否（正常）',
    });
  }

  return prompts;
}

export function collectAfterHitBeforeDamagePrompts(actor, target, action) {
  if (!actor || !target || !action) return [];
  if (action.type !== 'attack') return [];

  if (hasCondition(target, CONDITION_KEYS.PARALYZED) || hasCondition(target, CONDITION_KEYS.UNCONSCIOUS)) {
    return [{
      type: 'meleeCritDistance',
      targetUid: target.uid,
      title: '重击判定',
      message: `是否在 5 尺内命中【${target.name}】？`,
      yesText: '是（重击）',
      noText: '否（正常伤害）',
    }];
  }
  return [];
}

export function isSaveAutoFailTarget(target, action) {
  if (!target || !action || action.type !== 'save') return false;
  const ability = String(action.saveAbility || '').toLowerCase();
  if (ability !== 'str' && ability !== 'dex') return false;
  return (
    hasCondition(target, CONDITION_KEYS.PARALYZED) ||
    hasCondition(target, CONDITION_KEYS.PETRIFIED) ||
    hasCondition(target, CONDITION_KEYS.STUNNED) ||
    hasCondition(target, CONDITION_KEYS.UNCONSCIOUS)
  );
}

export function isSaveDisadvantageTarget(target, action) {
  if (!target || !action || action.type !== 'save') return false;
  const ex = getExhaustionLevel(target);
  return ex != null && ex >= 3;
}
