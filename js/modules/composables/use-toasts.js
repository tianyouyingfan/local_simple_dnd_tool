/**
 * Toast 通知功能 Composable
 */
import { ui } from 'state';

export function useToasts() {
    function removeToast(id) {
        const i = ui.toasts.findIndex(t => t.id === id);
        if (i > -1) ui.toasts.splice(i, 1);
    }

    function toast(message) {
        const id = crypto.randomUUID();
        ui.toasts.push({ id, message });
        setTimeout(() => removeToast(id), 3000);
    }

    return { toast, removeToast };
}

