/**
 * HP 与 状态管理模块
 */
import { nextTick } from 'vue';
import { battle, currentActor, ui, statusCatalog, quickDamageInput } from 'state';
import { clamp } from 'utils';
import { useToasts } from 'use-toasts';
import { getConditionDefinition, getStatusIdentity, normalizeStatusInstance, getExhaustionLevel, CONDITION_KEYS } from 'conditions';

const { toast } = useToasts();

export function applyHPDelta(p, delta) {
    delta = Number(delta) || 0;
    if (delta === 0) return;

    if (delta < 0) {
        let damage = Math.abs(delta);
        if (p.tempHp && p.tempHp > 0) {
            if (p.tempHp >= damage) {
                p.tempHp -= damage;
                damage = 0;
            } else {
                damage -= p.tempHp;
                p.tempHp = 0;
            }
        }
        if (damage > 0) {
            p.hpCurrent = clamp(p.hpCurrent - damage, 0, p.hpMax);
        }
    } else {
        p.hpCurrent = clamp(p.hpCurrent + delta, 0, p.hpMax);
    }

    if (p.hpCurrent <= 0 && p.type === 'monster') {
        p.isDefeated = true;
        toast(`怪物【${p.name}】血量归零，将在回合结束后移除。`);
    }
}

export function setTempHp(p, amount) {
    amount = Number(amount);
    if (isNaN(amount) || amount < 0) return;
    p.tempHp = amount;
    toast(`${p.name} 获得虚假生命: ${amount}`);
}

export function applyExhaustionHpCap(participant) {
    const level = getExhaustionLevel(participant);
    if (level != null && level >= 4) {
        const newMax = Math.floor(participant.baseMaxHp / 2);
        participant.hpMax = newMax;
        if (participant.hpCurrent > newMax) {
            participant.hpCurrent = newMax;
        }
    } else {
        participant.hpMax = participant.baseMaxHp;
    }
}

export function checkExhaustion6Death(participant) {
    ui.exhaustionDeathConfirm.targetUid = participant.uid;
    ui.exhaustionDeathConfirm.targetName = participant.name;
    ui.exhaustionDeathConfirm.open = true;
}

export function confirmExhaustionDeath(confirmed) {
    const target = battle.participants.find(p => p.uid === ui.exhaustionDeathConfirm.targetUid);
    if (confirmed && target) {
        target.hpCurrent = 0;
        target.isDefeated = true;
        toast(`【${target.name}】因力竭6级而死亡。`);
    } else if (!confirmed && target) {
        // 取消则回退到5级
        const exStatus = target.statuses.find(s => s.key === CONDITION_KEYS.EXHAUSTION);
        if (exStatus) {
            exStatus.meta = { ...(exStatus.meta || {}) };
            exStatus.meta.level = 5;
            if (exStatus.meta.stepRounds == null) exStatus.meta.stepRounds = Math.max(1, Math.floor(Number(exStatus.rounds) || 1));
            exStatus.name = '力竭 5级';
        }
        toast(`已取消，【${target.name}】力竭等级保持在5级。`);
    }
    ui.exhaustionDeathConfirm.open = false;
}

export function closeQuickDamageEditor() { ui.quickDamage.open = false; }

export async function openQuickDamageEditor(participant) {
    ui.quickDamage.targetUid = participant.uid;
    ui.quickDamage.targetName = participant.name;
    ui.quickDamage.damageAmount = null;
    ui.quickDamage.open = true;
    await nextTick();
    quickDamageInput.value?.focus();
}

export function applyQuickDamage() {
    const { damageAmount, targetUid } = ui.quickDamage;
    if (typeof damageAmount !== 'number' || damageAmount <= 0) return closeQuickDamageEditor();
    const target = battle.participants.find(p => p.uid === targetUid);
    if (target) applyHPDelta(target, -Math.abs(damageAmount));
    closeQuickDamageEditor();
}

export function openHPEditor(participant) {
    ui.hpEditor.open = true;
    ui.hpEditor.targetUid = participant.uid;
    ui.hpEditor.delta = null;
    ui.hpEditor.tempHpInput = null;
}

export function openStatusPicker(target) {
    ui.statusPicker.open = true;
    ui.statusPicker.targetUid = target.uid;
    ui.statusPicker.blocked = false;
    const fallback = currentActor.value?.uid;
    ui.statusPicker.sourceUid = fallback && fallback !== target.uid ? fallback : null;
    if (statusCatalog.value.length > 0) {
        const firstNonSource = statusCatalog.value.find(s => {
            const inst = normalizeStatusInstance({ name: s.name, icon: s.icon, rounds: 1 });
            const def = getConditionDefinition(inst?.key);
            return !def?.requiresSource;
        });
        const picked = firstNonSource || statusCatalog.value[0];
        ui.statusPicker.selectedName = picked.name;
        ui.statusPicker.icon = picked.icon;
    }
}

export function applyStatus() {
    if (ui.statusPicker.blocked) return toast('不可直接添加有施加状态源的状态');
    const t = battle.participants.find(p => p.uid === ui.statusPicker.targetUid);
    if (!t) return;
    const instance = normalizeStatusInstance({
        name: ui.statusPicker.selectedName,
        icon: ui.statusPicker.icon,
        rounds: ui.statusPicker.rounds || 1,
        sourceUid: ui.statusPicker.sourceUid || null,
    });
    if (!instance?.key) return toast('该状态暂不支持（缺少状态定义）');
    const def = getConditionDefinition(instance.key);
    if (def?.requiresSource) return toast('不可直接添加有施加状态源的状态');

    if (instance.key === CONDITION_KEYS.EXHAUSTION) {
        const prevLevel = getExhaustionLevel(t) || 0;
        const existing = t.statuses.find(s => s.key === CONDITION_KEYS.EXHAUSTION);
        if (existing) {
            const nextLevel = Number(instance.meta?.level) || prevLevel;
            const appliedRounds = Math.max(1, Math.floor(Number(instance.rounds) || 1));
            existing.meta = { ...(existing.meta || {}) };
            existing.meta.level = Math.max(Number(existing.meta.level) || 0, nextLevel);
            if (existing.meta.stepRounds == null) {
                existing.meta.stepRounds = Math.max(Math.floor(Number(existing.rounds) || 1), appliedRounds);
            }
            existing.meta.stepRounds = Math.max(Math.floor(Number(existing.meta.stepRounds) || 1), appliedRounds);
            existing.rounds = Math.max(Math.floor(Number(existing.rounds) || 1), appliedRounds);
            existing.name = `力竭 ${existing.meta.level}级`;
            existing.icon = instance.icon;
            ui.statusPicker.open = false;
            applyExhaustionHpCap(t);
            if (prevLevel < 6 && existing.meta.level === 6) {
                checkExhaustion6Death(t);
            }
            return;
        }
    }

    const identity = getStatusIdentity(instance).identity;
    if (identity && t.statuses.some(s => getStatusIdentity(s).identity === identity)) {
        ui.statusPicker.open = false;
        return toast('该状态已存在');
    }

    t.statuses.push(instance);
    ui.statusPicker.open = false;

    // 力竭特殊处理
    if (instance.key === CONDITION_KEYS.EXHAUSTION) {
        instance.meta = { ...(instance.meta || {}) };
        instance.meta.stepRounds = Math.max(1, Math.floor(Number(instance.meta.stepRounds ?? instance.rounds) || 1));
        if (instance.meta.level) instance.name = `力竭 ${instance.meta.level}级`;
        applyExhaustionHpCap(t);
        // 力竭6级死亡确认
        if (instance.meta?.level === 6) {
            checkExhaustion6Death(t);
        }
    }
}

export function removeStatus(target, statusId) {
    const removedStatus = target.statuses.find(s => s.id === statusId);
    target.statuses = target.statuses.filter(s => s.id !== statusId);
    // 移除力竭后重新计算HP上限
    if (removedStatus?.key === CONDITION_KEYS.EXHAUSTION) {
        applyExhaustionHpCap(target);
    }
}

