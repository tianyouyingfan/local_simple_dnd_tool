export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
// 工具函数
export function abilityMod(score) {
    return Math.floor((score - 10) / 2);
}
export function rollD20(mode = 'normal') {
    const r1 = Math.floor(Math.random() * 20) + 1;
    if (mode === 'normal') return {
        value: r1,
        isCrit: r1 === 20,
        isFumble: r1 === 1,
        raw: [r1]
    };
    const r2 = Math.floor(Math.random() * 20) + 1;
    const pick = mode === 'adv' ? Math.max(r1, r2) : Math.min(r1, r2);
    return {
        value: pick,
        isCrit: pick === 20,
        isFumble: pick === 1,
        raw: [r1, r2]
    };
}
export function parseDiceExpr(expr) {
    if (!expr) return { dice: [], flat: 0 };
    const dice = [];
    let flat = 0;
    const parts = expr.replace(/-/g, '+-').split('+');
    for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.includes('d')) {
            dice.push(trimmed);
        } else if (trimmed) {
            flat += parseInt(trimmed, 10) || 0;
        }
    }
    return { dice, flat };
}
export function rollDamage(expr, isCrit = false, damageType = 'generic') {
    if (!expr) return [{ amount: 0, type: damageType }];

    const { dice, flat } = parseDiceExpr(expr);
    let total = flat;
    for (const d of dice) {
        const [countStr, facesStr] = d.toLowerCase().split('d');
        const count = isCrit ? (parseInt(countStr, 10) || 1) * 2 : (parseInt(countStr, 10) || 1);
        const faces = parseInt(facesStr, 10);
        if (isNaN(faces)) continue;
        for (let i = 0; i < count; i++) {
            total += Math.floor(Math.random() * faces) + 1;
        }
    }

    return [{ amount: Math.max(0, total), type: damageType }];
}
export function rollDamageWithDetails(expr, isCrit = false, damageType = 'generic') {
    if (!expr) return { total: 0, rolls: [], flat: 0, type: damageType };

    const { dice, flat } = parseDiceExpr(expr);
    let total = flat;
    const rolls = [];
    for (const d of dice) {
        const [countStr, facesStr] = d.toLowerCase().split('d');
        const count = isCrit ? (parseInt(countStr, 10) || 1) * 2 : (parseInt(countStr, 10) || 1);
        const faces = parseInt(facesStr, 10);
        if (isNaN(faces)) continue;
        for (let i = 0; i < count; i++) {
            const roll = Math.floor(Math.random() * faces) + 1;
            rolls.push(roll);
            total += roll;
        }
    }

    return { total: Math.max(0, total), rolls, flat, type: damageType };
}
export function rollExpression(expr) {
    if (!expr) return { total: 0, breakdown: '无效表达式', rolls: [] };

    const { dice, flat } = parseDiceExpr(expr);
    let total = flat;
    const allRolls = [];
    for (const d of dice) {
        const [countStr, facesStr] = d.toLowerCase().split('d');
        const count = parseInt(countStr, 10) || 1;
        const faces = parseInt(facesStr, 10);
        if (isNaN(faces)) continue;
        const currentDieRolls = [];
        for (let i = 0; i < count; i++) {
            const roll = Math.floor(Math.random() * faces) + 1;
            total += roll;
            currentDieRolls.push(roll);
        }
        allRolls.push({ die: `d${faces}`, results: currentDieRolls });
    }
    return {
        total: total,
        rolls: allRolls,
        modifier: flat
    };
}
export function formatDamageList(dl) {
    return dl.map(x => `${x.amount} ${x.type}`).join(' + ') || '0';
}
export function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
}
export function sortActionsByType(actions) {
    if (!actions || !Array.isArray(actions)) return [];
    return [...actions].sort((a, b) => {
        const aIsUtil = a.type === 'utility';
        const bIsUtil = b.type === 'utility';
        if (aIsUtil && !bIsUtil) return -1; // a comes first
        if (!aIsUtil && bIsUtil) return 1;  // b comes first
        return 0; // maintain original order for same types
    });
}
// 简化的 CR 自动调整占位（TODO：替换为正式规则表）
export function adjustMonsterToCR(mon, targetCR) {
    const out = deepClone(mon);
    const cr = Number(targetCR) || mon.cr || 1;
    // 非正式：以 CR 线性近似，作为占位
    const scale = (cr) / (mon.cr || 1);
    out.cr = cr;
    out.ac = Math.round(clamp((mon.ac || 12) + (scale - 1) * 2, 8, 25));
    const baseHP = mon.hp?.average ?? mon.hp ?? 10;
    out.hp = {
        average: Math.round(clamp(baseHP * scale, 5, 600)),
        roll: mon.hp?.roll || ''
    };
    // 调整动作攻击加值与伤害骰（仅把伤害/轮提升为近似；骰子智能反算 TODO）
    (out.actions || []).forEach(a => {
        if (a.type === 'attack') {
            a.attackBonus = Math.round((a.attackBonus || 3) + (scale - 1) * 2);
            // 粗略伤害上调：额外 +Xd6
            a.damageDice = a.damageDice ? `${a.damageDice}+${Math.max(1, Math.round(scale))}d6` : `${Math.max(1, Math.round(1 * scale))}d6`;
        }
        if (a.type === 'save') {
            a.saveDC = Math.round((a.saveDC || 12) + (scale - 1) * 2);
            a.damageDice = a.damageDice ? `${a.damageDice}+${Math.max(1, Math.round(scale))}d6` : `${Math.max(2, Math.round(2 * scale))}d6`;
        }
    });
    return out;
}

// <-- 新增: 为单个参与者计算先攻的工具函数
export function rollSingleInitiative(participant) {
    const dexModifier = abilityMod(participant.abilities.dex || 10);
    const d20Roll = Math.floor(Math.random() * 20) + 1;
    return {
        initiative: d20Roll + dexModifier,
        initiativeRoll: d20Roll,
        initiativeModifier: dexModifier,
    };
}