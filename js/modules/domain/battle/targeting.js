/**
 * 目标选择模块
 */
import { ui } from 'state';

export function toggleTarget(uid) {
    const i = ui.selectedTargets.indexOf(uid);
    if (i >= 0) ui.selectedTargets.splice(i, 1);
    else ui.selectedTargets.push(uid);
}

export function toggleSelectGroup(g) {
    const ids = g.members.map(m => m.uid);
    const allIn = ids.every(id => ui.selectedTargets.includes(id));
    if (allIn) ui.selectedTargets = ui.selectedTargets.filter(id => !ids.includes(id));
    else ui.selectedTargets = Array.from(new Set(ui.selectedTargets.concat(ids)));
}

export function selectNone() { ui.selectedTargets = []; }

