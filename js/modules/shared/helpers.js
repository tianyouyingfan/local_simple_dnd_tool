/**
 * 辅助工具函数模块
 */

// 常量定义
const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
const BYTES = { MB: 1024 * 1024 };

export function debugLog(_event) {
    // 默认关闭：把你原来的 agent log 全部收敛到这里
    // 想启用的话：window.__DND_DEBUG_INGEST__ = (event) => fetch(...)
    try {
        if (typeof window !== 'undefined' && typeof window.__DND_DEBUG_INGEST__ === 'function') {
            window.__DND_DEBUG_INGEST__(_event);
        }
    } catch (_) { }
}

export function safeJsonParse(text, fallback = null) {
    try { return JSON.parse(text); } catch { return fallback; }
}

export function validateImageFile(file, { maxBytes }) {
    if (!file) return { valid: false, message: '没有选择文件' };

    if (!IMAGE_TYPES.has(file.type)) {
        return { valid: false, message: '不支持的文件格式。请使用 JPG、PNG、GIF 或 WebP 格式的图片。' };
    }

    if (file.size === 0) return { valid: false, message: '图片文件为空，请选择有效的图片文件。' };

    if (file.size > maxBytes) {
        const mb = (maxBytes / BYTES.MB).toFixed(0);
        return { valid: false, message: `图片文件过大。请选择小于 ${mb}MB 的图片。` };
    }

    return { valid: true };
}

export function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('FileReader 读取失败'));
        reader.onload = (e) => resolve(e?.target?.result || null);
        reader.readAsDataURL(file);
    });
}

export function sortParticipantsByInitiative(list) {
    // 规则保持你原来的：nat20 优先，其次 initiative，其次 modifier
    list.sort((a, b) => {
        const aNat20 = a.initiativeRoll === 20;
        const bNat20 = b.initiativeRoll === 20;
        if (aNat20 && !bNat20) return -1;
        if (!aNat20 && bNat20) return 1;
        if (aNat20 && bNat20) return (b.initiativeModifier || 0) - (a.initiativeModifier || 0);
        return (b.initiative || 0) - (a.initiative || 0);
    });
    return list;
}

export function ensureActionDamages(draft) {
    // 兼容旧字段 damageDice/damageType -> damages[]
    if (draft?.damageDice && (!draft.damages || draft.damages.length === 0)) {
        draft.damages = [{ dice: draft.damageDice, type: draft.damageType, id: crypto.randomUUID() }];
        delete draft.damageDice;
        delete draft.damageType;
    }
    if (!draft.damages || draft.damages.length === 0) {
        draft.damages = [{ dice: '', type: '斩击', id: crypto.randomUUID() }];
    } else {
        draft.damages.forEach(d => { d.id = d.id || crypto.randomUUID(); });
    }
    return draft;
}

export function isTypingInInput() {
    const el = document.activeElement;
    const tag = el?.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA';
}

// 导出常量以便其他模块需要时使用
export const HELPERS_CONSTANTS = {
    IMAGE_TYPES,
    BYTES
};
