import { createApp, watch, nextTick, computed } from 'vue';
import * as utils from 'utils';
import {
  route, monsters, abilities, pcs, actions, monsterGroups, monsterFilters,
  battle, ui, uiState, currentActor, participantTiles, hpDelta, quickDamageInput, quickRollInput, statusCatalog, app
} from 'state';
import {
  monsterTypes, damageTypes, conditionTypes, monsterTypeTranslations,
  crOptions
} from 'constants';

// 导入新模块
import { safeJsonParse } from 'helpers';
import { useToasts } from 'use-toasts';
import { loadAll, seedDemo, seedIfEmpty } from 'data-loader';
import {
  toggleTypeFilter, toggleMonsterDraftType, toggleDamageModifier, toggleConditionImmunity
} from 'ui-toggles';
import {
  cropperCanvas, cropperModal, avatarCropperCanvas, avatarCropperModal,
  onBgImageSelect, initCropper, initCropperWithRetry, drawCropper, startBgDrag, bgDrag, endBgDrag, confirmCrop,
  onAvatarImageSelect, initAvatarCropper, initAvatarCropperWithRetry, drawAvatarCropper, startAvatarDrag, avatarDrag, endAvatarDrag, confirmAvatarCrop
} from 'image-cropper';
import {
  openActorViewer, startActorViewerEdit, cancelActorViewerEdit, saveActorViewerChanges,
  openActionsViewer, selectActionFromViewer
} from 'actor-viewer';
import {
  openMonsterEditor, closeMonsterEditor, updateMonster, saveMonsterAsNew, duplicateMonster, deleteMonster,
  openPCEditor, closePCEditor, savePC, deletePC,
  openAbilityPool, openAbilityEditor, saveAbility, deleteAbility, attachAbilityToDraft,
  openActionPool, attachActionToDraft,
  openActionEditor, openActionEditorForDraft, saveAction, addDamageToActionDraft, deleteAction
} from 'entity-crud';
import { autoAdjustCR } from 'cr-adjustment';
import {
  standardizeToParticipant, addParticipantAndProcessInitiative, addToBattleFromEditor, addToBattleFromMonster, addToBattleFromPC,
  promptAddParticipants, addParticipantsFromMonster, addParticipantsFromPC,
  resetBattle, rollInitiative, setCurrentActor, removeParticipant, nextTurn, prevTurn, onDragStart, onDrop
} from 'battle-core';
import {
  applyHPDelta, setTempHp, closeQuickDamageEditor, openQuickDamageEditor, applyQuickDamage, openHPEditor,
  applyExhaustionHpCap, openStatusPicker, applyStatus, removeStatus, confirmExhaustionDeath
} from 'hp-status';
import {
  toggleTarget, toggleSelectGroup, selectNone
} from 'targeting';
import {
  promptSaveCheck, selectAction, calculateModifiedDamage, runAction, applySaveOutcomes,
  dismissCurrentNotification, processNotificationQueue
} from 'action-execution';
import {
  openQuickDice, executeQuickRoll
} from 'quick-dice';
// 注意: quickRollInput 从 state.js 导入，quick-dice.js 仅导出逻辑
import { exportAll, importAll } from 'import-export';
import {
  openGroupManager, openGroupEditor, addMonsterToGroupDraft, saveGroup, deleteGroup, addParticipantsFromGroup
} from 'monster-groups';
import { setupKeyboardShortcuts } from 'keyboard-shortcuts';
import { useComputed } from 'use-computed';
import { buildStatblockViewModel } from 'statblock';
import {
  CONDITION_KEYS,
  buildStatusDisplayName,
  getConditionDefinition,
  getConditionKeyEffectsHtml,
  getTargetBadges as getConditionTargetBadges,
  isActorIncapacitated,
  isManualOrPartialCondition,
  isSaveDisadvantageTarget,
  getExhaustionLevel,
  normalizeStatusInstance
} from 'conditions';

createApp({
  setup() {
    const { toast, removeToast } = useToasts();

    // 1. 计算属性
    const computeds = useComputed();

    // 2. Watchers
    // battle 持久化
    let persistTimer = null;
    const persistBattleNow = () => {
      try {
        localStorage.setItem('dnd-battle-state', JSON.stringify(battle));
      } catch (e) {
        console.error('Failed to persist battle state:', e);
      }
    };
    const flushBattlePersist = () => {
      if (persistTimer) {
        clearTimeout(persistTimer);
        persistTimer = null;
      }
      persistBattleNow();
    };
    watch(battle, () => {
      if (persistTimer) return;
      persistTimer = setTimeout(() => {
        persistTimer = null;
        persistBattleNow();
      }, 200);
    }, { deep: true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushBattlePersist();
    });
    window.addEventListener('pagehide', flushBattlePersist);

    watch(currentActor, (newActor) => {
      if (!newActor) return;
      nextTick(() => {
        const tile = participantTiles.value.get(newActor.uid);
        tile?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      });
    });

    watch(() => ui.statusPicker.selectedName, (newName) => {
      const selected = statusCatalog.value.find(s => s.name === newName);
      if (selected) ui.statusPicker.icon = selected.icon;
      const normalized = normalizeStatusInstance({ name: newName, icon: ui.statusPicker.icon, rounds: ui.statusPicker.rounds });
      const def = getConditionDefinition(normalized?.key);
      if (def?.requiresSource) {
        toast('不可直接添加有施加状态源的状态');
        ui.statusPicker.blocked = true;
        return;
      }
      ui.statusPicker.blocked = false;
      ui.statusPicker.sourceUid = null;
    });

    watch(route, (newRoute, oldRoute) => {
      if (oldRoute !== 'actions') return;
      if (newRoute === 'actions') return;
      if (!ui.actionEditor.open) return;
      if (ui.actionEditor.nested) return;
      ui.actionEditor.open = false;
    });

    watch(() => battle.currentIndex, () => { hpDelta.value = 5; });

    // participantTiles 清理
    watch(() => battle.participants.map(p => p.uid), (uids) => {
      const set = new Set(uids);
      for (const uid of participantTiles.value.keys()) {
        if (!set.has(uid)) participantTiles.value.delete(uid);
      }
    });

    // 3. Initialize
    (async function initializeApp() {
      const pendingBaseMaxHpFixUids = [];
      try {
        const saved = localStorage.getItem('dnd-battle-state');
        if (saved) {
          const parsed = safeJsonParse(saved);
          if (parsed) Object.assign(battle, parsed);
          for (const p of battle.participants || []) {
            if (!Array.isArray(p.statuses)) p.statuses = [];
            p.statuses = p.statuses.map(normalizeStatusInstance).filter(Boolean);
            for (const s of p.statuses) {
              if (s?.key !== CONDITION_KEYS.EXHAUSTION) continue;
              s.meta = { ...(s.meta || {}) };
              if (s.meta.stepRounds == null) {
                s.meta.stepRounds = Math.max(1, Math.floor(Number(s.rounds) || 1));
              }
              if (s.meta.level) s.name = `力竭 ${s.meta.level}级`;
            }
            // M1迁移: 为旧存档补充baseMaxHp字段
            const ex = getExhaustionLevel(p);
            const hpMax = Number(p.hpMax);
            const baseMaxHp = Number(p.baseMaxHp);
            if (ex != null && ex >= 4 && Number.isFinite(hpMax) && hpMax > 0) {
              if (!Number.isFinite(baseMaxHp) || baseMaxHp <= hpMax) {
                p.baseMaxHp = hpMax * 2;
                pendingBaseMaxHpFixUids.push(p.uid);
              }
            }
            if (p.baseMaxHp == null) {
              if (Number.isFinite(hpMax) && hpMax > 0) {
                p.baseMaxHp = (ex != null && ex >= 4) ? (hpMax * 2) : hpMax;
              } else {
                p.baseMaxHp = 10;
              }
              pendingBaseMaxHpFixUids.push(p.uid);
            }
            applyExhaustionHpCap(p);
          }
        }
      } catch (e) {
        console.error('Failed to load battle state:', e);
        localStorage.removeItem('dnd-battle-state');
      }
      try {
        await seedIfEmpty();
        await loadAll();
        app.dataLoaded = true;
      } catch (e) {
        console.error('Failed to load IndexedDB data:', e);
        toast('数据加载失败：请检查浏览器存储权限或退出无痕模式');
        app.dataLoaded = false;
      }

      if (pendingBaseMaxHpFixUids.length) {
        for (const uid of pendingBaseMaxHpFixUids) {
          const p = battle.participants.find(x => x.uid === uid);
          if (!p || !p.baseId) continue;
          const source = p.type === 'pc'
            ? pcs.value.find(x => x.id === p.baseId)
            : monsters.value.find(x => x.id === p.baseId);
          if (!source) continue;
          const candidate = source.hpMax ?? source.hp?.average;
          if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
            p.baseMaxHp = candidate;
            applyExhaustionHpCap(p);
          }
        }
      }
    })();

    // 4. Keyboard Shortcuts
    setupKeyboardShortcuts();

    // 5. Template Helpers
    const formatDamages = (damages) => {
      if (!damages || damages.length === 0) return '无伤害';
      return damages.map(d => `${d.dice} ${d.type}`).join(', ');
    };
    function formatRolledDamages(rolledDamages) {
      if (!rolledDamages || rolledDamages.length === 0) return '0';
      return rolledDamages.map(d => `${d.amount} ${d.type}`).join(' + ');
    }

    const translateType = (t) => monsterTypeTranslations[t] || t;

    const actorViewerEntity = computed(() => {
      if (!ui.actorViewer.open) return null;
      if (!ui.actorViewer.actor) return null;
      return ui.actorViewer.isEditing ? ui.actorViewer.draft : ui.actorViewer.actor;
    });

    const actorViewerStatblock = computed(() => {
      const entity = actorViewerEntity.value;
      const kind = ui.actorViewer.actor?.type === 'pc' ? 'pc' : 'monster';
      if (!entity) return null;
      return buildStatblockViewModel(entity, { kind, translateType });
    });

    const monsterDraftStatblock = computed(() => buildStatblockViewModel(uiState.monsterDraft, { kind: 'monster', translateType }));
    const pcDraftStatblock = computed(() => buildStatblockViewModel(uiState.pcDraft, { kind: 'pc', translateType }));

    // 6. Return
    return {
      // State
      route, monsters, abilities, pcs, actions, monsterGroups, monsterFilters,
      battle, ui, uiState,

      // Constants
      monsterTypes, damageTypes, conditionTypes, crOptions, statusCatalog,

      // Local refs & computeds (imported from state/useComputed)
      hpDelta, quickDamageInput, quickRollInput, participantTiles,
      currentActor,
      ...computeds,

      // DOM refs
      cropperCanvas, cropperModal, avatarCropperCanvas, avatarCropperModal,

      // Methods
      toast, removeToast, loadAll, seedDemo,
      actorViewerEntity, actorViewerStatblock, monsterDraftStatblock, pcDraftStatblock,

      toggleTypeFilter, toggleMonsterDraftType, toggleDamageModifier, toggleConditionImmunity,

      openActorViewer, startActorViewerEdit, cancelActorViewerEdit, saveActorViewerChanges,

      openMonsterEditor, closeMonsterEditor, updateMonster, saveMonsterAsNew, duplicateMonster, deleteMonster,
      openPCEditor, closePCEditor, savePC, deletePC,

      openAbilityPool, openAbilityEditor, saveAbility, deleteAbility, attachAbilityToDraft,
      openActionPool, attachActionToDraft, openActionsViewer,
      openActionEditor, openActionEditorForDraft, saveAction, addDamageToActionDraft, deleteAction,

      autoAdjustCR,

      resetBattle, standardizeToParticipant, addToBattleFromEditor, addToBattleFromMonster, addToBattleFromPC,
      promptAddParticipants, addParticipantsFromMonster, addParticipantsFromPC,

      // Cropper API
      onBgImageSelect, initCropper, initCropperWithRetry, drawCropper, startBgDrag, bgDrag, endBgDrag, confirmCrop,
      onAvatarImageSelect, initAvatarCropper, initAvatarCropperWithRetry, drawAvatarCropper,
      startAvatarDrag, avatarDrag, endAvatarDrag, confirmAvatarCrop,

      // Turns & drag
      rollInitiative, setCurrentActor, nextTurn, prevTurn, removeParticipant, onDragStart, onDrop,

      // HP & status
      applyHPDelta, setTempHp, closeQuickDamageEditor, openQuickDamageEditor, applyQuickDamage, openHPEditor,
      openStatusPicker, applyStatus, removeStatus, confirmExhaustionDeath,

      // Targeting
      toggleTarget, toggleSelectGroup, selectNone,

      // Action
      promptSaveCheck, selectAction, calculateModifiedDamage, runAction, applySaveOutcomes,

      // Import/export
      exportAll, importAll,

      // Groups
      openGroupManager, openGroupEditor, addMonsterToGroupDraft, saveGroup, deleteGroup, addParticipantsFromGroup,

      // Notifications
      dismissCurrentNotification, processNotificationQueue,

      // Quick dice
      openQuickDice, executeQuickRoll,

      selectActionFromViewer,

      // Template helpers
      formatDamages, formatRolledDamages,
      mod: (v) => utils.abilityMod(Number(v) || 10),
      translateType,
      getConditionTargetBadges: (target) => getConditionTargetBadges(currentActor.value, target, ui.selectedAction, ui.rollMode),
      isActorIncapacitated: (p) => isActorIncapacitated(p),
      isSaveDisadvantageTarget: (target, action) => isSaveDisadvantageTarget(target, action),
      formatStatusLabel: (s) => buildStatusDisplayName(s),
      formatConditionKey: (key) => getConditionDefinition(key)?.displayName || String(key ?? ''),
      isStatusManual: (s) => {
        const normalized = normalizeStatusInstance(s);
        return isManualOrPartialCondition(normalized?.key);
      },
      openConditionInfo: (participant, status) => {
        const normalized = normalizeStatusInstance(status);
        const def = getConditionDefinition(normalized?.key);
        ui.conditionInfo.targetUid = participant?.uid || null;
        ui.conditionInfo.statusId = normalized?.id || null;
        ui.conditionInfo.key = normalized?.key || null;
        ui.conditionInfo.icon = normalized?.icon || '';
        ui.conditionInfo.title = buildStatusDisplayName(normalized);
        ui.conditionInfo.automationLevel = def?.automationLevel || 'full';
        ui.conditionInfo.sourceName = '';
        if (normalized?.sourceUid) {
          const source = battle.participants.find(p => p.uid === normalized.sourceUid);
          if (source) ui.conditionInfo.sourceName = source.name;
        }
        ui.conditionInfo.html = normalized?.key ? getConditionKeyEffectsHtml(normalized.key, normalized.meta) : '';
        ui.conditionInfo.open = true;
      },
      statusPickerRequiresSource: () => {
        const normalized = normalizeStatusInstance({ name: ui.statusPicker.selectedName, icon: ui.statusPicker.icon, rounds: ui.statusPicker.rounds });
        return !!getConditionDefinition(normalized?.key)?.requiresSource;
      },
    };
  }
}).mount('#app');

document.body.classList.remove('loading');

