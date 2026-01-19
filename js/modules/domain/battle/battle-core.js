/**
 * 战斗核心逻辑模块
 */
import { battle, currentActor, route, ui, monsters, pcs, statusCatalog } from 'state';
import { deepClone, rollSingleInitiative } from 'utils';
import { sortParticipantsByInitiative } from 'helpers';
import { useToasts } from 'use-toasts';
import { applyExhaustionHpCap } from 'hp-status';
import { CONDITION_KEYS, getExhaustionLevel } from 'conditions';

const { toast } = useToasts();

function ensureUniqueParticipantName(participant) {
    const desiredName = (participant?.name || '').trim();
    if (!desiredName) return;

    const existingNames = new Set((battle.participants || []).map(p => p?.name).filter(Boolean));
    if (!existingNames.has(desiredName)) return;

    const match = desiredName.match(/^(.*)\s+#(\d+)$/);
    const baseName = (match ? match[1] : desiredName).trim();
    if (!baseName) return;

    let nextIndex = match ? (Number(match[2]) + 1) : 1;
    if (!Number.isFinite(nextIndex) || nextIndex < 1) nextIndex = 1;

    let candidate = `${baseName} #${nextIndex}`;
    while (existingNames.has(candidate)) {
        nextIndex++;
        candidate = `${baseName} #${nextIndex}`;
    }

    participant.name = candidate;
}

export function standardizeToParticipant(x) {
    const uid = crypto.randomUUID();
    const isPc = !!x.hpMax;
    const resolvedHpMax = x.hpMax ?? x.hp?.average ?? 10;
    return {
        uid,
        baseId: x.id || null,
        name: x.name,
        type: isPc ? 'pc' : 'monster',
        avatar: x.avatar || (x.type?.includes?.('dragon') ? '🐲' : (isPc ? '🧝' : '👾')),
        ac: x.ac || 12,
        baseMaxHp: x.baseMaxHp ?? resolvedHpMax,
        hpMax: resolvedHpMax,
        hpCurrent: x.hpCurrent ?? x.hp?.average ?? 10,
        abilities: x.abilities || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        resistances: deepClone(x.resistances || { damage: [], conditions: [] }),
        vulnerabilities: deepClone(x.vulnerabilities || { damage: [], conditions: [] }),
        immunities: deepClone(x.immunities || { damage: [], conditions: [] }),
        actions: deepClone(x.actions || []).map(a => ({ ...a, cooldown: 0 })),
        statuses: [],
        initiative: null,
        cr: x.cr,
        speed: x.speed,
        monsterType: x.type,
        features: x.features,
        backgroundImage: x.backgroundImage,
    };
}

export function addParticipantAndProcessInitiative(participant) {
    ensureUniqueParticipantName(participant);
    const inProgress = battle.participants.length > 0 && battle.participants[0].initiative !== null;

    if (!inProgress) {
        battle.participants.push(participant);
        return;
    }

    const init = rollSingleInitiative(participant);
    Object.assign(participant, init);
    participant.justJoined = true;

    battle.participants.push(participant);
    sortParticipantsByInitiative(battle.participants);

    // 防止排序后 currentIndex 高亮错乱
    if (currentActor.value) {
        const newIdx = battle.participants.findIndex(p => p.uid === currentActor.value.uid);
        if (newIdx !== -1) battle.currentIndex = newIdx;
    }
}

export function addToBattleFromEditor(entity, type) {
    const p = standardizeToParticipant(entity);
    addParticipantAndProcessInitiative(p);
    if (type === 'monster') ui.monsterEditor.open = false;
    else if (type === 'pc') ui.pcEditor.open = false;
    route.value = 'battle';
    toast(`${p.name} 已加入战斗`);
}

export function addToBattleFromMonster(m) {
    addParticipantAndProcessInitiative(standardizeToParticipant(m));
    route.value = 'battle';
    toast('已加入战斗');
}

export function addToBattleFromPC(pc) {
    addParticipantAndProcessInitiative(standardizeToParticipant(pc));
    route.value = 'battle';
    toast('已加入战斗');
}

export function promptAddParticipants() { ui.addParticipants.open = true; }

export function addParticipantsFromMonster(m, count = 1) {
    for (let i = 0; i < count; i++) {
        const p = standardizeToParticipant(m);
        if (count > 1) p.name = `${m.name} #${i + 1}`;
        addParticipantAndProcessInitiative(p);
    }
    toast('怪物已加入');
}

export function addParticipantsFromPC(pc) {
    addParticipantAndProcessInitiative(standardizeToParticipant(pc));
    toast('PC已加入');
}

export async function resetBattle() {
    if (!confirm('确定要初始化战斗吗？当前战场将被清空，并自动载入所有默认参战单位。')) return;
    battle.participants = [];
    battle.round = 1;
    battle.currentIndex = 0;
    localStorage.removeItem('dnd-battle-state');
    ui.log = '战斗已初始化。';

    monsters.value.filter(m => m.isDefault).forEach(m => addParticipantAndProcessInitiative(standardizeToParticipant(m)));
    pcs.value.filter(pc => pc.isDefault).forEach(pc => addParticipantAndProcessInitiative(standardizeToParticipant(pc)));

    toast(`初始化完成，已自动加入 ${battle.participants.length} 个默认单位。`);
}

export function rollInitiative() {
    for (const p of battle.participants) {
        Object.assign(p, rollSingleInitiative(p));
        delete p.justJoined;
    }
    sortParticipantsByInitiative(battle.participants);
    battle.currentIndex = 0;
    battle.round = 1;
    toast('已掷先攻并排序');
}

export function setCurrentActor(uid) {
    const idx = battle.participants.findIndex(p => p.uid === uid);
    if (idx >= 0) battle.currentIndex = idx;
}

export function decrementParticipantStatuses(participant) {
    const prevExhaustion = getExhaustionLevel(participant);
    participant.statuses = (participant.statuses || [])
        .map((s) => {
            if (!s) return null;

            const rawRounds = Number(s.rounds);
            const rounds = Number.isFinite(rawRounds) ? Math.floor(rawRounds) : 1;
            const nextRounds = rounds - 1;

            if (s.key === CONDITION_KEYS.EXHAUSTION) {
                const rawLevel = Number(s.meta?.level);
                const level = Number.isFinite(rawLevel) ? Math.floor(rawLevel) : 1;

                if (nextRounds > 0) return { ...s, rounds: nextRounds };

                if (level > 1) {
                    const rawStepRounds = Number(s.meta?.stepRounds);
                    const stepRounds = Number.isFinite(rawStepRounds) ? Math.floor(rawStepRounds) : 1;
                    const resetRounds = Math.max(1, stepRounds);
                    const nextLevel = level - 1;
                    return {
                        ...s,
                        rounds: resetRounds,
                        meta: { ...(s.meta || {}), level: nextLevel, stepRounds: resetRounds },
                        name: `力竭 ${nextLevel}级`,
                    };
                }

                return null;
            }

            if (nextRounds > 0) return { ...s, rounds: nextRounds };
            return null;
        })
        .filter(Boolean);
    const nextExhaustion = getExhaustionLevel(participant);
    if (prevExhaustion !== nextExhaustion) {
        applyExhaustionHpCap(participant);
    }
}

export function decrementActionCooldowns(participant) {
    participant.actions?.forEach(a => { if (a.cooldown > 0) a.cooldown--; });
}

export function removeParticipant(uid) {
    const i = battle.participants.findIndex(p => p.uid === uid);
    if (i < 0) return;
    battle.participants.splice(i, 1);
    if (battle.currentIndex >= battle.participants.length) battle.currentIndex = 0;
}

export function nextTurn() {
    if (!battle.participants.length) return;

    // Handle end-of-turn logic for the *current* actor before moving
    const active = currentActor.value;
    let removed = false;
    if (active && active.hpCurrent <= 0 && active.type === 'monster') {
        const deadName = active.name;
        removeParticipant(active.uid);
        toast(`怪物【${deadName}】已在回合结束后移除。`);
        removed = true;
    }

    // If current actor was removed, the next actor is already at currentIndex (array shifted left).
    // So we usually wouldn't increment.
    // However, if we just removed someone, the "next" person is now at the *same* index.
    // BUT, we want to start the turn for the "next" person.
    // If we don't increment, we stay at the same index, which is correct for the "next" person.
    // But we still need to check if *that* person is `justJoined`.
    
    if (!removed) {
        battle.currentIndex++;
    }

    // Loop to find the next valid actor (skipping `justJoined` units)
    // We limit the loop to avoid infinite loops (though with round increment it shouldn't happen)
    let checks = 0;
    const maxChecks = battle.participants.length * 2; // Safe upper bound

    while (checks < maxChecks) {
        // Handle wrap-around (New Round)
        if (battle.currentIndex >= battle.participants.length) {
            battle.currentIndex = 0;
            battle.round++;
            
            // New round started: clear ALL `justJoined` flags
            // This allows units added in the previous round to finally act
            let clearedCount = 0;
            battle.participants.forEach(p => {
                if (p.justJoined) {
                    delete p.justJoined;
                    clearedCount++;
                }
            });
            
            toast(`第 ${battle.round} 回合开始` + (clearedCount ? ` (${clearedCount} 个新单位加入战斗)` : ''));
        }

        const candidate = battle.participants[battle.currentIndex];
        if (!candidate) break; // Should not happen if length > 0

        // If candidate is NOT new, they can act. Break loop.
        if (!candidate.justJoined) {
            break;
        }

        // If candidate IS new, skip them
        // toast(`跳过新加入单位: ${candidate.name}`); // Optional
        battle.currentIndex++;
        checks++;
    }

    if (currentActor.value) {
        decrementParticipantStatuses(currentActor.value);
        decrementActionCooldowns(currentActor.value);
    }
}

export function prevTurn() {
    if (!battle.participants.length) return;
    battle.currentIndex--;
    if (battle.currentIndex < 0) {
        battle.currentIndex = battle.participants.length - 1;
        battle.round = Math.max(1, battle.round - 1);
    }
}

export function onDragStart(idx) { battle.dragIndex = idx; }

export function onDrop(idx) {
    const from = battle.dragIndex;
    if (from == null) return;
    const item = battle.participants.splice(from, 1)[0];
    battle.participants.splice(idx, 0, item);
    battle.dragIndex = null;
}

