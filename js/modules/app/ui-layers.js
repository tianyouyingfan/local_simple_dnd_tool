import { route, ui } from 'state';
import { dismissCurrentNotification } from 'action-execution';
import { cancelActorViewerEdit } from 'actor-viewer';
import { closeMonsterEditor, closePCEditor } from 'entity-crud';
import { closeQuickDamageEditor, confirmExhaustionDeath } from 'hp-status';

const clampZ = (z) => (typeof z === 'number' && Number.isFinite(z) ? z : 0);

const compareLayers = (a, b) => {
    const za = clampZ(a.zIndex());
    const zb = clampZ(b.zIndex());
    if (za !== zb) return za - zb;
    return (a.order ?? 0) - (b.order ?? 0);
};

const buildLayers = () => ([
    {
        id: 'actionEditorActionsRoute',
        order: 5,
        isVisible: () => (
            !!ui.actionEditor.open &&
            !(ui.monsterEditor.open || ui.pcEditor.open) &&
            route.value === 'actions'
        ),
        zIndex: () => 1,
        closable: true,
        close: () => { ui.actionEditor.open = false; },
    },
    {
        id: 'actorViewer',
        order: 10,
        isVisible: () => !!ui.actorViewer.open && !!ui.actorViewer.actor,
        zIndex: () => 80,
        closable: true,
        close: () => {
            cancelActorViewerEdit();
            ui.actorViewer.open = false;
        },
    },
    {
        id: 'monsterEditor',
        order: 20,
        isVisible: () => !!ui.monsterEditor.open,
        zIndex: () => 80,
        closable: true,
        close: () => closeMonsterEditor(),
    },
    {
        id: 'abilityPoolModal',
        order: 30,
        isVisible: () => (
            !!ui.abilityPool.open &&
            !ui.abilityPool.nested &&
            !(ui.monsterEditor.open || ui.pcEditor.open)
        ),
        zIndex: () => (ui.actionsViewer.open ? 60 : 50),
        closable: true,
        close: () => { ui.abilityPool.open = false; },
    },
    {
        id: 'actionPoolModal',
        order: 40,
        isVisible: () => (
            !!ui.actionPool.open &&
            !ui.actionPool.nested &&
            !(ui.monsterEditor.open || ui.pcEditor.open)
        ),
        zIndex: () => (ui.actionsViewer.open ? 60 : 50),
        closable: true,
        close: () => { ui.actionPool.open = false; },
    },
    {
        id: 'abilityEditorModal',
        order: 50,
        isVisible: () => !!ui.abilityEditor.open,
        zIndex: () => (ui.abilityEditor.nested ? 95 : 50),
        closable: true,
        close: () => { ui.abilityEditor.open = false; },
    },
    {
        id: 'pcEditor',
        order: 60,
        isVisible: () => !!ui.pcEditor.open,
        zIndex: () => 80,
        closable: true,
        close: () => closePCEditor(),
    },
    {
        id: 'actionEditorModal',
        order: 70,
        isVisible: () => (
            !!ui.actionEditor.open &&
            !(ui.monsterEditor.open || ui.pcEditor.open) &&
            route.value !== 'actions'
        ),
        zIndex: () => (ui.actionEditor.nested ? 65 : 50),
        closable: true,
        close: () => { ui.actionEditor.open = false; },
    },
    {
        id: 'statusPicker',
        order: 80,
        isVisible: () => !!ui.statusPicker.open,
        zIndex: () => 50,
        closable: true,
        close: () => { ui.statusPicker.open = false; },
    },
    {
        id: 'conditionInfo',
        order: 90,
        isVisible: () => !!ui.conditionInfo.open,
        zIndex: () => 50,
        closable: true,
        close: () => { ui.conditionInfo.open = false; },
    },
    {
        id: 'imageCropper',
        order: 100,
        isVisible: () => !!ui.imageCropper.open,
        zIndex: () => 60,
        closable: true,
        close: () => { ui.imageCropper.open = false; },
    },
    {
        id: 'avatarCropper',
        order: 110,
        isVisible: () => !!ui.avatarCropper.open,
        zIndex: () => 60,
        closable: true,
        close: () => { ui.avatarCropper.open = false; },
    },
    {
        id: 'hpEditor',
        order: 120,
        isVisible: () => !!ui.hpEditor.open,
        zIndex: () => 50,
        closable: true,
        close: () => { ui.hpEditor.open = false; },
    },
    {
        id: 'quickDamage',
        order: 130,
        isVisible: () => !!ui.quickDamage.open,
        zIndex: () => 50,
        closable: true,
        close: () => closeQuickDamageEditor(),
    },
    {
        id: 'monsterGroupManager',
        order: 140,
        isVisible: () => !!ui.monsterGroupManager.open,
        zIndex: () => 50,
        closable: true,
        close: () => { ui.monsterGroupManager.open = false; },
    },
    {
        id: 'monsterGroupEditor',
        order: 150,
        isVisible: () => !!ui.monsterGroupEditor.open,
        zIndex: () => 55,
        closable: true,
        close: () => { ui.monsterGroupEditor.open = false; },
    },
    {
        id: 'addParticipants',
        order: 160,
        isVisible: () => !!ui.addParticipants.open,
        zIndex: () => 50,
        closable: true,
        close: () => { ui.addParticipants.open = false; },
    },
    {
        id: 'saveCheck',
        order: 170,
        isVisible: () => !!ui.saveCheck.open,
        zIndex: () => 50,
        closable: false,
        close: () => {},
    },
    {
        id: 'binaryPrompt',
        order: 180,
        isVisible: () => !!ui.binaryPrompt.open,
        zIndex: () => 50,
        closable: true,
        close: () => ui.binaryPrompt.callback?.(false),
    },
    {
        id: 'saveOutcomePicker',
        order: 190,
        isVisible: () => !!ui.saveOutcomePicker.open,
        zIndex: () => 50,
        closable: true,
        close: () => { ui.saveOutcomePicker.open = false; },
    },
    {
        id: 'exhaustionDeathConfirm',
        order: 200,
        isVisible: () => !!ui.exhaustionDeathConfirm.open,
        zIndex: () => 60,
        closable: true,
        close: () => confirmExhaustionDeath(false),
    },
    {
        id: 'actionsViewer',
        order: 210,
        isVisible: () => !!ui.actionsViewer.open,
        zIndex: () => 55,
        closable: true,
        close: () => { ui.actionsViewer.open = false; },
    },
    {
        id: 'quickDiceInput',
        order: 220,
        isVisible: () => !!ui.quickDice.inputOpen,
        zIndex: () => 50,
        closable: true,
        close: () => { ui.quickDice.inputOpen = false; },
    },
    {
        id: 'quickDiceResult',
        order: 230,
        isVisible: () => !!ui.quickDice.resultOpen,
        zIndex: () => 50,
        closable: true,
        close: () => { ui.quickDice.resultOpen = false; },
    },
    {
        id: 'notificationOverlay',
        order: 240,
        isVisible: () => !!ui.critNotification.open || !!ui.normalHitNotification.open || !!ui.missNotification.open,
        zIndex: () => 100,
        closable: true,
        close: () => dismissCurrentNotification(),
    },
    {
        id: 'editorAbilityPoolNested',
        order: 1000,
        isVisible: () => (
            !!ui.abilityPool.open &&
            !!ui.abilityPool.nested &&
            (ui.monsterEditor.open || ui.pcEditor.open)
        ),
        zIndex: () => 82,
        closable: true,
        close: () => { ui.abilityPool.open = false; },
    },
    {
        id: 'editorActionPoolNested',
        order: 1010,
        isVisible: () => (
            !!ui.actionPool.open &&
            !!ui.actionPool.nested &&
            (ui.monsterEditor.open || ui.pcEditor.open)
        ),
        zIndex: () => 83,
        closable: true,
        close: () => { ui.actionPool.open = false; },
    },
    {
        id: 'editorActionEditorNested',
        order: 1020,
        isVisible: () => (
            !!ui.actionEditor.open &&
            !!ui.actionEditor.nested &&
            (ui.monsterEditor.open || ui.pcEditor.open)
        ),
        zIndex: () => 85,
        closable: true,
        close: () => { ui.actionEditor.open = false; },
    },
]);

export function closeTopLayerIfClosable() {
    const layers = buildLayers().filter(l => l.isVisible());
    if (!layers.length) return false;
    layers.sort(compareLayers);
    const top = layers[layers.length - 1];
    if (!top?.closable) return false;
    top.close();
    return true;
}
