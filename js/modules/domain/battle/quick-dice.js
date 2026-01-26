/**
 * 快速骰子模块
 */
import { nextTick } from 'vue';
import { ui, quickRollInput } from 'state';
import { rollExpression } from 'utils';

export function openQuickDice() {
    ui.quickDice.expression = '';
    ui.quickDice.resultOpen = false;
    ui.quickDice.inputOpen = true;
    nextTick(() => quickRollInput.value?.focus());
}

export function executeQuickRoll() {
    if (!ui.quickDice.expression.trim()) return;
    ui.quickDice.result = rollExpression(ui.quickDice.expression);
    ui.quickDice.inputOpen = false;
    ui.quickDice.resultOpen = true;
}

