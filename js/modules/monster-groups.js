/**
 * 怪物组合管理模块
 */
import { db } from './db.js';
import { ui, uiState, monsters } from './state.js';
import { deepClone } from './utils.js';
import { loadAll } from './data-loader.js';
import { useToasts } from './use-toasts.js';
import { standardizeToParticipant, addParticipantAndProcessInitiative } from './battle-core.js';

const { toast } = useToasts();

export function openGroupManager() { ui.monsterGroupManager.open = true; }

export function openGroupEditor(group = null) {
    uiState.groupDraft = group ? deepClone(group) : { name: '', monsters: [] };
    ui.monsterGroupEditor.keyword = '';
    ui.monsterGroupEditor.open = true;
}

export function addMonsterToGroupDraft(monster) {
    const existing = uiState.groupDraft.monsters.find(m => m.monsterId === monster.id);
    if (existing) existing.count++;
    else uiState.groupDraft.monsters.push({ monsterId: monster.id, name: monster.name, count: 1 });
}

export async function saveGroup() {
    const draft = deepClone(uiState.groupDraft);
    if (!draft.name || draft.monsters.length === 0) return toast('请填写组名并添加至少一个怪物');

    draft.monsters = draft.monsters.filter(m => m.count >= 1);
    if (draft.id) await db.monsterGroups.put(draft);
    else await db.monsterGroups.add(draft);

    await loadAll();
    ui.monsterGroupEditor.open = false;
    toast('怪物组合已保存');
}

export async function deleteGroup(id) {
    if (!confirm('确定要永久删除这个怪物组合吗？此操作不可撤销。')) return;
    await db.monsterGroups.delete(id);
    await loadAll();
    toast('组合已删除');
}

export function addParticipantsFromGroup(group) {
    let added = 0;
    for (const gm of group.monsters) {
        const tpl = monsters.value.find(m => m.id === gm.monsterId);
        if (!tpl) continue;
        for (let i = 0; i < gm.count; i++) {
            const p = standardizeToParticipant(tpl);
            if (gm.count > 1) p.name = `${tpl.name} #${i + 1}`;
            addParticipantAndProcessInitiative(p);
            added++;
        }
    }
    toast(`已从组合 [${group.name}] 添加 ${added} 个怪物`);
}
