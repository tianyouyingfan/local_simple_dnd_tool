/**
 * 角色查看器 (Actor Viewer) 模块
 */
import { ui, uiState } from './state.js';
import { deepClone } from './utils.js';
import { useToasts } from './use-toasts.js';
import { selectAction } from './action-execution.js'; // 注意：此模块将在后续步骤创建

const { toast } = useToasts();

export function openActorViewer(actor) {
    ui.actorViewer.isEditing = false;
    ui.actorViewer.draft = null;
    ui.actorViewer.actor = actor;
    ui.actorViewer.open = true;
}

export function startActorViewerEdit() {
    if (!ui.actorViewer.actor) return;
    ui.actorViewer.draft = deepClone(ui.actorViewer.actor);
    ui.actorViewer.isEditing = true;
}

export function cancelActorViewerEdit() {
    ui.actorViewer.isEditing = false;
    ui.actorViewer.draft = null;
}

export function saveActorViewerChanges() {
    if (!ui.actorViewer.actor || !ui.actorViewer.draft) return;
    Object.assign(ui.actorViewer.actor, ui.actorViewer.draft);
    ui.actorViewer.actor.hpCurrent = Math.min(ui.actorViewer.actor.hpCurrent, ui.actorViewer.actor.hpMax);
    toast(`${ui.actorViewer.actor.name} 的临时数据已更新`);
    cancelActorViewerEdit();
}

export function openActionsViewer(draft) {
    ui.actionsViewer.draft = draft;
    ui.actionsViewer.title = `管理 ${draft.name} 的动作`;
    ui.actionsViewer.open = true;
}

export function selectActionFromViewer(action) {
    if (action.type !== 'attack' && action.type !== 'save') return;
    selectAction(action);
    ui.actorViewer.open = false;
}
