/**
 * UI 切换与过滤器控制模块
 */
import { monsterFilters, uiState, ui } from 'state';

export function toggleTypeFilter(t) {
    const idx = monsterFilters.types.indexOf(t);
    if (idx >= 0) monsterFilters.types.splice(idx, 1);
    else monsterFilters.types.push(t);
}

export function toggleMonsterDraftType(typeKey) {
    const types = uiState.monsterDraft.type;
    const i = types.indexOf(typeKey);
    if (i > -1) types.splice(i, 1);
    else types.push(typeKey);
}

export function toggleDamageModifier(property, damageType) {
    const draft = ui.activeEditor === 'pc' ? uiState.pcDraft : uiState.monsterDraft;
    const arr = draft?.[property]?.damage;
    if (!arr) return;
    const i = arr.indexOf(damageType);
    if (i > -1) arr.splice(i, 1);
    else arr.push(damageType);
}

export function toggleConditionImmunity(condition) {
    const draft = ui.activeEditor === 'pc' ? uiState.pcDraft : uiState.monsterDraft;
    const arr = draft?.immunities?.conditions;
    if (!arr) return;
    const i = arr.indexOf(condition);
    if (i > -1) arr.splice(i, 1);
    else arr.push(condition);
}

