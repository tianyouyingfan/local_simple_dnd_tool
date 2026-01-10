/**
 * 键盘快捷键模块
 */
import { onBeforeUnmount } from 'vue';
import { isTypingInInput } from './helpers.js';
import { openQuickDice } from './quick-dice.js';
import { nextTurn, prevTurn } from './battle-core.js';

export function setupKeyboardShortcuts() {
    let lastD = 0, lastR = 0, lastL = 0;

    const onKeyDown = (e) => {
        if (isTypingInInput()) return;
        const now = Date.now();

        if (e.key.toLowerCase() === 'd') {
            if (now - lastD < 400) { openQuickDice(); lastD = 0; }
            else lastD = now;
        } else if (e.key === 'ArrowRight') {
            if (now - lastR < 400) { nextTurn(); lastR = 0; }
            else lastR = now;
        } else if (e.key === 'ArrowLeft') {
            if (now - lastL < 400) { prevTurn(); lastL = 0; }
            else lastL = now;
        }
    };

    window.addEventListener('keydown', onKeyDown);
    onBeforeUnmount(() => window.removeEventListener('keydown', onKeyDown));
}
