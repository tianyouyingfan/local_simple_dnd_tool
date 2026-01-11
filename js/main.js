import { createApp, watch, nextTick } from 'vue';
import * as utils from 'utils';
import {
  route, monsters, abilities, pcs, actions, monsterGroups, monsterFilters,
  battle, ui, uiState, currentActor, participantTiles, hpDelta, quickDamageInput, quickRollInput
} from 'state';
import {
  monsterTypes, damageTypes, conditionTypes, monsterTypeTranslations,
  crOptions, statusCatalog
} from 'constants';

// 导入新模块
import { safeJsonParse } from './modules/helpers.js';
import { useToasts } from './modules/use-toasts.js';
import { loadAll, seedDemo, seedIfEmpty } from './modules/data-loader.js';
import {
  toggleTypeFilter, toggleMonsterDraftType, toggleDamageModifier, toggleConditionImmunity
} from './modules/ui-toggles.js';
import {
  cropperCanvas, cropperModal, avatarCropperCanvas, avatarCropperModal,
  onBgImageSelect, initCropper, initCropperWithRetry, drawCropper, startBgDrag, bgDrag, endBgDrag, confirmCrop,
  onAvatarImageSelect, initAvatarCropper, initAvatarCropperWithRetry, drawAvatarCropper, startAvatarDrag, avatarDrag, endAvatarDrag, confirmAvatarCrop
} from './modules/image-cropper.js';
import {
  openActorViewer, startActorViewerEdit, cancelActorViewerEdit, saveActorViewerChanges,
  openActionsViewer, selectActionFromViewer
} from './modules/actor-viewer.js';
import {
  openMonsterEditor, updateMonster, saveMonsterAsNew, duplicateMonster, deleteMonster,
  openPCEditor, savePC, deletePC,
  openAbilityPool, openAbilityEditor, saveAbility, deleteAbility, attachAbilityToDraft,
  openActionPool, attachActionToDraft,
  openActionEditor, openActionEditorForDraft, saveAction, addDamageToActionDraft, deleteAction
} from './modules/entity-crud.js';
import { autoAdjustCR } from './modules/cr-adjustment.js';
import {
  standardizeToParticipant, addParticipantAndProcessInitiative, addToBattleFromEditor, addToBattleFromMonster, addToBattleFromPC,
  promptAddParticipants, addParticipantsFromMonster, addParticipantsFromPC,
  resetBattle, rollInitiative, setCurrentActor, removeParticipant, nextTurn, prevTurn, onDragStart, onDrop
} from './modules/battle-core.js';
import {
  applyHPDelta, setTempHp, closeQuickDamageEditor, openQuickDamageEditor, applyQuickDamage, openHPEditor,
  openStatusPicker, applyStatus, removeStatus
} from './modules/hp-status.js';
import {
  toggleTarget, toggleSelectGroup, selectNone
} from './modules/targeting.js';
import {
  promptSaveCheck, selectAction, calculateModifiedDamage, runAction, applySaveOutcomes,
  dismissCurrentNotification, processNotificationQueue
} from './modules/action-execution.js';
import {
  openQuickDice, executeQuickRoll
} from './modules/quick-dice.js';
// 注意: quickRollInput 从 state.js 导入，quick-dice.js 仅导出逻辑
import { exportAll, importAll } from './modules/import-export.js';
import {
  openGroupManager, openGroupEditor, addMonsterToGroupDraft, saveGroup, deleteGroup, addParticipantsFromGroup
} from './modules/monster-groups.js';
import { setupKeyboardShortcuts } from './modules/keyboard-shortcuts.js';
import { useComputed } from './modules/use-computed.js';

createApp({
  setup() {
    const { toast, removeToast } = useToasts();

    // 1. 计算属性
    const computeds = useComputed();

    // 2. Watchers
    // battle 持久化
    let persistTimer = null;
    watch(battle, (newState) => {
      if (persistTimer) return;
      persistTimer = setTimeout(() => {
        persistTimer = null;
        try {
          localStorage.setItem('dnd-battle-state', JSON.stringify(newState));
        } catch (e) {
          console.error('Failed to persist battle state:', e);
        }
      }, 200);
    }, { deep: true });

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
      try {
        const saved = localStorage.getItem('dnd-battle-state');
        if (saved) {
          const parsed = safeJsonParse(saved);
          if (parsed) Object.assign(battle, parsed);
        }
      } catch (e) {
        console.error('Failed to load battle state:', e);
        localStorage.removeItem('dnd-battle-state');
      }
      await seedIfEmpty();
      await loadAll();
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

      toggleTypeFilter, toggleMonsterDraftType, toggleDamageModifier, toggleConditionImmunity,

      openActorViewer, startActorViewerEdit, cancelActorViewerEdit, saveActorViewerChanges,

      openMonsterEditor, updateMonster, saveMonsterAsNew, duplicateMonster, deleteMonster,
      openPCEditor, savePC, deletePC,

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
      openStatusPicker, applyStatus, removeStatus,

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
      translateType: (t) => monsterTypeTranslations[t] || t,
    };
  }
}).mount('#app');

document.body.classList.remove('loading');
