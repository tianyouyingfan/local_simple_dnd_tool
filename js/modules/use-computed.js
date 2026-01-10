/**
 * 计算属性集合模块
 */
import { computed } from 'vue';
import { ui, monsters, monsterFilters, abilities, actions, battle, uiState, currentActor } from './state.js';
import { sortActionsByType } from './utils.js';

export function useComputed() {
    const filteredMonsters = computed(() => {
        const kw = (monsterFilters.keyword || '').trim();
        const cr = monsterFilters.cr;
        const types = monsterFilters.types || [];

        return monsters.value.filter(m => {
            if (kw && !m.name?.includes(kw)) return false;
            if (cr && String(m.cr) !== cr) return false;
            if (types.length) {
                const mt = m.type || [];
                if (!mt.some(t => types.includes(t))) return false;
            }
            return true;
        });
    });

    const filteredAbilities = computed(() => {
        const kw = (ui.abilityPool.keyword || '').trim();
        return abilities.value.filter(a => !kw || a.name?.includes(kw));
    });

    const filteredActions = computed(() => {
        const kw = (ui.actionPool.keyword || '').trim();
        return actions.value.filter(a => !kw || a.name?.includes(kw));
    });

    const groupedParticipants = computed(() => {
        const pcsGroup = [];
        const monstersGroup = [];
        for (const p of battle.participants) {
            if (p.type === 'pc') pcsGroup.push(p);
            else if (p.type === 'monster') monstersGroup.push(p);
        }
        return [
            pcsGroup.length ? { groupName: '玩家角色 (PCs)', members: pcsGroup } : null,
            monstersGroup.length ? { groupName: '怪物 (Monsters)', members: monstersGroup } : null,
        ].filter(Boolean);
    });

    const filteredMonstersForGroup = computed(() => {
        const kw = (ui.monsterGroupEditor.keyword || '').trim().toLowerCase();
        if (!kw) return monsters.value;
        return monsters.value.filter(m => (m.name || '').toLowerCase().includes(kw));
    });

    const sortedCurrentActorActions = computed(() => sortActionsByType(currentActor.value?.actions));
    const sortedActorViewerActions = computed(() => sortActionsByType(ui.actorViewer.actor?.actions));
    const sortedMonsterDraftActions = computed(() => sortActionsByType(uiState.monsterDraft?.actions));
    const sortedPcDraftActions = computed(() => sortActionsByType(uiState.pcDraft?.actions));

    return {
        filteredMonsters,
        filteredAbilities,
        filteredActions,
        groupedParticipants,
        filteredMonstersForGroup,
        sortedCurrentActorActions,
        sortedActorViewerActions,
        sortedMonsterDraftActions,
        sortedPcDraftActions
    };
}
