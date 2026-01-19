/**
 * 键盘快捷键模块
 */
import { onBeforeUnmount } from 'vue';
import { isTypingInInput } from 'helpers';
import { openQuickDice } from 'quick-dice';
import { nextTurn, prevTurn } from 'battle-core';
import { ui, uiState } from 'state';
import { cancelActorViewerEdit, saveActorViewerChanges } from 'actor-viewer';
import { closeMonsterEditor, closePCEditor, saveAbility, saveAction, saveMonsterAsNew, savePC, updateMonster } from 'entity-crud';

export function setupKeyboardShortcuts() {
    let lastD = 0, lastR = 0, lastL = 0;
    let lastSpace = 0;
    let lastQ = 0;
    let lastQKey = 'q';
    const DOUBLE_TAP_MS = 400;

    const isTextInputEl = (el) => {
        const tag = el?.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA';
    };

    const rollbackLastCharIfMatches = (expectedChar) => {
        const el = document.activeElement;
        if (!isTextInputEl(el)) return;
        const start = el.selectionStart;
        const end = el.selectionEnd;
        if (typeof start !== 'number' || typeof end !== 'number') return;
        if (start !== end) return;
        if (start <= 0) return;
        const value = el.value ?? '';
        if (value[start - 1] !== expectedChar) return;
        el.value = value.slice(0, start - 1) + value.slice(start);
        el.setSelectionRange(start - 1, start - 1);
    };

    const isEditorContextOpen = () => (
        ui.actorViewer.open ||
        ui.monsterEditor.open ||
        ui.pcEditor.open ||
        ui.actionEditor.open ||
        ui.abilityEditor.open
    );

    const saveAndCloseEditorContext = () => {
        if (ui.actionEditor.open) return void saveAction();
        if (ui.abilityEditor.open) return void saveAbility();
        if (ui.monsterEditor.open) {
            if (uiState.monsterDraft?.id) return void updateMonster();
            return void saveMonsterAsNew();
        }
        if (ui.pcEditor.open) return void savePC();
        if (ui.actorViewer.open) {
            if (ui.actorViewer.isEditing) saveActorViewerChanges();
            ui.actorViewer.open = false;
        }
    };

    const closeEditorContextNoSave = () => {
        if (ui.actionEditor.open) { ui.actionEditor.open = false; return; }
        if (ui.abilityEditor.open) { ui.abilityEditor.open = false; return; }
        if (ui.monsterEditor.open) { closeMonsterEditor(); return; }
        if (ui.pcEditor.open) { closePCEditor(); return; }
        if (ui.actorViewer.open) {
            cancelActorViewerEdit();
            ui.actorViewer.open = false;
        }
    };

    const tryHandleEditorDoubleTap = (e, now) => {
        if (!isEditorContextOpen()) return false;
        if (e.repeat) return false;

        const isSpace = e.code === 'Space' || e.key === ' ';
        const isQ = e.key?.toLowerCase?.() === 'q';

        if (!isSpace && !isQ) return false;

        if (isSpace) {
            if (now - lastSpace < DOUBLE_TAP_MS) {
                e.preventDefault();
                rollbackLastCharIfMatches(' ');
                lastSpace = 0;
                lastQ = 0;
                saveAndCloseEditorContext();
                return true;
            }
            lastSpace = now;
            lastQ = 0;
            return false;
        }

        if (isQ) {
            if (now - lastQ < DOUBLE_TAP_MS) {
                e.preventDefault();
                rollbackLastCharIfMatches(lastQKey);
                lastQ = 0;
                lastSpace = 0;
                closeEditorContextNoSave();
                return true;
            }
            lastQ = now;
            lastQKey = e.key;
            lastSpace = 0;
            return false;
        }

        return false;
    };

    const onKeyDown = (e) => {
        const now = Date.now();
        if (tryHandleEditorDoubleTap(e, now)) return;
        if (isTypingInInput()) return;

        if (e.key.toLowerCase() === 'd') {
            if (now - lastD < DOUBLE_TAP_MS) { openQuickDice(); lastD = 0; }
            else lastD = now;
        } else if (e.key === 'ArrowRight') {
            if (now - lastR < DOUBLE_TAP_MS) { nextTurn(); lastR = 0; }
            else lastR = now;
        } else if (e.key === 'ArrowLeft') {
            if (now - lastL < DOUBLE_TAP_MS) { prevTurn(); lastL = 0; }
            else lastL = now;
        }
    };

    window.addEventListener('keydown', onKeyDown);
    onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown));
}

