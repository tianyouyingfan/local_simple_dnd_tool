/**
 * CR 调整模块
 */
import { uiState } from './state.js';
import { deepClone, adjustMonsterToCR } from './utils.js';
import { useToasts } from './use-toasts.js';

const { toast } = useToasts();

export function autoAdjustCR() {
    uiState.monsterDraft = adjustMonsterToCR(deepClone(uiState.monsterDraft), uiState.targetCR);
    toast('已按占位规则调整（TODO：替换为正式智能规则表）');
}
