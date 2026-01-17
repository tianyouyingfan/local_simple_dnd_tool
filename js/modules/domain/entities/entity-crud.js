/**
 * 实体 CRUD 操作模块 (Monster, PC, Ability, Action)
 */
import { db } from 'db';
import { ui, uiState, emptyMonster, actions, abilities, pcs } from 'state';
import { deepClone } from 'utils';
import { ensureActionDamages } from 'helpers';
import { loadAll } from 'data-loader';
import { useToasts } from 'use-toasts';
import { openActionsViewer } from 'actor-viewer';

const { toast } = useToasts();

/** ---------- Monster CRUD ---------- */
export function openMonsterEditor(m = null) {
    const draft = deepClone(m || emptyMonster());
    draft.isCustom = !!draft.isCustom;
    uiState.monsterDraft = draft;
    uiState.targetCR = draft.cr;
    ui.monsterEditor.mode = m ? 'view' : 'edit';
    ui.activeEditor = 'monster';
    ui.monsterEditor.open = true;
}

export async function updateMonster() {
    const draft = deepClone(uiState.monsterDraft);
    if (!draft.id) return toast('错误：该怪物没有ID，无法更新。请使用“另存为”');
    if (!draft.name) return toast('名称不能为空');
    await db.monsters.put(draft);
    await loadAll();
    ui.monsterEditor.open = false;
    toast('怪物数据已更新');
}

export async function saveMonsterAsNew() {
    const draft = deepClone(uiState.monsterDraft);
    draft.isCustom = true;
    draft.id = undefined;
    if (!draft.name) return toast('名称不能为空');
    await db.monsters.add(draft);
    await loadAll();
    ui.monsterEditor.open = false;
    toast('已保存为自定义怪物');
}

export async function duplicateMonster(m) {
    const copy = deepClone(m);
    copy.id = undefined;
    copy.name = `${m.name}（副本）`;
    copy.isCustom = true;
    await db.monsters.add(copy);
    await loadAll();
    toast('已复制');
}

export async function deleteMonster(id) {
    if (!confirm('确认删除该怪物？')) return;
    await db.monsters.delete(id);
    await loadAll();
    toast('已删除');
}

/** ---------- PC CRUD ---------- */
export function openPCEditor(pc = null) {
    if (pc) {
        const draft = deepClone(pc);
        draft.isDefault = pc.isDefault || false;
        draft.actions ||= [];
        draft.features ||= '';
        draft.resistances ||= { damage: [], conditions: [] };
        draft.vulnerabilities ||= { damage: [], conditions: [] };
        draft.immunities ||= { damage: [], conditions: [] };
        draft.backgroundImage ||= '';
        uiState.pcDraft = draft;
        ui.pcEditor.mode = 'view';
    } else {
        uiState.pcDraft = {
            name: '', avatar: '', ac: 14, hpMax: 20, hpCurrent: 20,
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            actions: [], features: '',
            resistances: { damage: [], conditions: [] },
            vulnerabilities: { damage: [], conditions: [] },
            immunities: { damage: [], conditions: [] },
            isDefault: false,
            backgroundImage: '',
        };
        ui.pcEditor.mode = 'edit';
    }
    ui.activeEditor = 'pc';
    ui.pcEditor.open = true;
}

export async function savePC() {
    const draft = deepClone(uiState.pcDraft);
    if (!draft.name) return toast('请填写名称');
    if (draft.id) await db.pcs.put(draft);
    else { draft.id = undefined; await db.pcs.add(draft); }
    await loadAll();
    ui.pcEditor.open = false;
    toast('PC已保存');
}

export async function deletePC(id) {
    if (!confirm('确认删除该PC？')) return;
    await db.pcs.delete(id);
    pcs.value = await db.pcs.toArray();
    toast('已删除');
}

/** ---------- Ability & Action libraries ---------- */
export function openAbilityPool() {
    ui.abilityPool.nested = ui.monsterEditor.open || ui.pcEditor.open || ui.actionsViewer.open;
    ui.abilityPool.open = true;
}

export function openAbilityEditor(ab = null) {
    ui.abilityEditor.nested = ui.abilityPool.open;
    uiState.abilityDraft = ab ? deepClone(ab) : { name: '', description: '' };
    ui.abilityEditor.open = true;
}

export async function saveAbility() {
    const ab = deepClone(uiState.abilityDraft);
    if (!ab.name) return toast('请填写名称');
    if (ab.id) await db.abilities.put(ab);
    else await db.abilities.add(ab);
    await loadAll();
    ui.abilityEditor.open = false;
    toast('能力已保存');
}

export async function deleteAbility(id) {
    if (!confirm('确认删除该能力？')) return;
    await db.abilities.delete(id);
    abilities.value = await db.abilities.toArray();
    toast('已删除');
}

export function attachAbilityToDraft(ab) {
    uiState.monsterDraft.actions ||= [];
    uiState.monsterDraft.actions.push({
        id: crypto.randomUUID(),
        name: ab.name,
        type: 'utility',
        note: ab.description
    });
    toast('已添加到当前怪物动作/能力中');
    ui.abilityPool.open = false;
}

export function openActionPool() {
    ui.actionPool.nested = ui.pcEditor.open || ui.monsterEditor.open || ui.actionsViewer.open;
    ui.actionPool.open = true;
}

export function attachActionToDraft(action) {
    const draft = ui.activeEditor === 'pc' ? uiState.pcDraft : uiState.monsterDraft;
    if (!draft) return;
    draft.actions ||= [];
    const copy = deepClone(action);
    delete copy.id;
    draft.actions.push(copy);
    toast(`已将动作添加到当前${ui.activeEditor === 'pc' ? 'PC' : '怪物'}`);
    ui.actionPool.open = false;
}

function openActionEditorBase({ action = null, nested, saveTarget, ensurePrivateId }) {
    ui.actionEditor.nested = nested;

    if (action) {
        const draft = ensureActionDamages(deepClone(action));
        uiState.actionDraft = draft;
    } else {
        uiState.actionDraft = ensureActionDamages({
            ...(ensurePrivateId ? { id: crypto.randomUUID() } : {}),
            name: '新动作',
            type: 'attack',
            attackBonus: 4,
            range: '近战',
            damages: [{ dice: '1d6+2', type: '斩击', id: crypto.randomUUID() }],
            recharge: 0,
            saveAbility: 'dex',
            saveDC: 13,
            onSuccess: 'half',
            onHitStatus: '',
            onHitStatusRounds: 1,
            onHitSaveAbility: 'dex',
            onHitSaveDC: 13,
        });
    }

    ui.actionEditor.saveTarget = saveTarget;
    ui.actionEditor.open = true;
}

export function openActionEditor(action = null) {
    openActionEditorBase({ action, nested: false, saveTarget: 'global', ensurePrivateId: false });
}

export function openActionEditorForDraft(action = null) {
    openActionEditorBase({ action, nested: true, saveTarget: 'private', ensurePrivateId: true });
}

export async function saveAction() {
    const draft = deepClone(uiState.actionDraft);
    if (!draft.name) return toast('请填写名称');

    if (ui.actionEditor.saveTarget === 'private') {
        const creatureDraft = ui.actionsViewer.draft;
        if (creatureDraft?.actions) {
            const idx = creatureDraft.actions.findIndex(a => a.id === draft.id);
            if (idx > -1) creatureDraft.actions[idx] = draft;
            else creatureDraft.actions.push(draft);
            toast('私有动作已保存');
        }
    } else {
        if (draft.id && typeof draft.id === 'number') await db.actions.put(draft);
        else { delete draft.id; await db.actions.add(draft); }
        await loadAll();
        toast('公共动作已保存');
    }

    ui.actionEditor.open = false;
}

export function addDamageToActionDraft() {
    uiState.actionDraft?.damages?.push({ dice: '', type: '斩击', id: crypto.randomUUID() });
}

export async function deleteAction(id) {
    if (!confirm('确认删除该动作？')) return;
    await db.actions.delete(id);
    actions.value = await db.actions.toArray();
    toast('已删除');
}

