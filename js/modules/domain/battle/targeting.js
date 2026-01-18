/**
 * 目标选择模块
 */
import { battle, currentActor, ui } from 'state';
import { useToasts } from 'use-toasts';
import { getTargetSelectability } from 'conditions';

const { toast } = useToasts();

export function toggleTarget(uid) {
    const actor = currentActor.value;
    const action = ui.selectedAction;
    const target = battle.participants.find(p => p.uid === uid);
    if (actor && action && target) {
        const { selectable, reason } = getTargetSelectability(actor, target, action);
        if (!selectable) return void toast(reason || '该目标不可选');
    }
    const i = ui.selectedTargets.indexOf(uid);
    if (i >= 0) ui.selectedTargets.splice(i, 1);
    else ui.selectedTargets.push(uid);
}

export function toggleSelectGroup(g) {
    const ids = g.members.map(m => m.uid);
    const allIn = ids.every(id => ui.selectedTargets.includes(id));
    if (allIn) ui.selectedTargets = ui.selectedTargets.filter(id => !ids.includes(id));
    else {
        const actor = currentActor.value;
        const action = ui.selectedAction;
        const selectableIds = [];
        let blockedCount = 0;
        for (const id of ids) {
            const target = battle.participants.find(p => p.uid === id);
            if (actor && action && target) {
                const { selectable } = getTargetSelectability(actor, target, action);
                if (!selectable) { blockedCount++; continue; }
            }
            selectableIds.push(id);
        }
        if (blockedCount) toast(`有 ${blockedCount} 个目标不可选，已跳过。`);
        ui.selectedTargets = Array.from(new Set(ui.selectedTargets.concat(selectableIds)));
    }
}

export function selectNone() { ui.selectedTargets = []; }

