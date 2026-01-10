/**
 * HP 与 状态管理模块
 */
import { nextTick } from 'vue';
import { battle, ui, statusCatalog, quickDamageInput } from './state.js';
import { clamp } from './utils.js';
import { useToasts } from './use-toasts.js';

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
    if (statusCatalog.value.length > 0) {
        ui.statusPicker.selectedName = statusCatalog.value[0].name;
        ui.statusPicker.icon = statusCatalog.value[0].icon;
    }
}

export function applyStatus() {
    const t = battle.participants.find(p => p.uid === ui.statusPicker.targetUid);
    if (!t) return;
    t.statuses.push({
        id: crypto.randomUUID(),
        name: ui.statusPicker.selectedName,
        icon: ui.statusPicker.icon || '⏳',
        rounds: ui.statusPicker.rounds || 1,
    });
    ui.statusPicker.open = false;
}

export function removeStatus(target, statusId) {
    target.statuses = target.statuses.filter(s => s.id !== statusId);
}
