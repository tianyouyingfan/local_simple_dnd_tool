/**
 * 图片裁剪器实例管理模块
 */
import { ref } from 'vue';
import { useImageCropper } from 'use-image-cropper';
import { ui, uiState } from 'state';
import { useToasts } from 'use-toasts';
import { HELPERS_CONSTANTS } from 'helpers';

// DOM refs
export const cropperCanvas = ref(null);
export const cropperModal = ref(null);
export const avatarCropperCanvas = ref(null);
export const avatarCropperModal = ref(null);

const { MAX_BG_BYTES, MAX_AVATAR_BYTES } = {
    MAX_BG_BYTES: 10 * HELPERS_CONSTANTS.BYTES.MB,
    MAX_AVATAR_BYTES: 5 * HELPERS_CONSTANTS.BYTES.MB
};

const toast = useToasts().toast;

// 背景裁剪器实例
export const bgCropper = useImageCropper({
    canvasRef: cropperCanvas,
    modalRef: cropperModal,
    modalState: ui.imageCropper,
    maxBytes: MAX_BG_BYTES,
    shape: 'rect',
    getAspectRatio: () => ui.imageCropper.aspectRatio,
    assignDataUrlToDraft: (dataUrl) => {
        if (ui.activeEditor === 'monster') uiState.monsterDraft.backgroundImage = dataUrl;
        else if (ui.activeEditor === 'pc') uiState.pcDraft.backgroundImage = dataUrl;
    },
    toDataUrl: (tempCanvas) => tempCanvas.toDataURL('image/jpeg', 0.9),
});

// 头像裁剪器实例
export const avatarCropper = useImageCropper({
    canvasRef: avatarCropperCanvas,
    modalRef: avatarCropperModal,
    modalState: ui.avatarCropper,
    maxBytes: MAX_AVATAR_BYTES,
    shape: 'circle',
    getAspectRatio: () => 1,
    assignDataUrlToDraft: (dataUrl) => {
        if (ui.activeEditor === 'monster') uiState.monsterDraft.avatar = dataUrl;
        else if (ui.activeEditor === 'pc') uiState.pcDraft.avatar = dataUrl;
    },
    toDataUrl: (tempCanvas) => tempCanvas.toDataURL('image/png'),
});

// Background Image Methods
export function onBgImageSelect(e) {
    bgCropper.onSelectFile(e).then(res => {
        if (res?.ok === false) toast(`错误：${res.message}`);
    });
}
export function initCropper() { bgCropper.init(); }
export function initCropperWithRetry(retryCount = 0) { bgCropper.initWithRetry(retryCount); }
export function drawCropper(img) { bgCropper.draw(img); }
export function startBgDrag(e) { bgCropper.startDrag(e); }
export function bgDrag(e) { bgCropper.drag(e); }
export function endBgDrag() { bgCropper.endDrag(); }
export function confirmCrop() {
    const res = bgCropper.confirm();
    if (!res.ok) toast('错误：裁剪失败，请重试。');
    else toast('背景图片已更新');
}

// Avatar Methods
export function onAvatarImageSelect(e) {
    avatarCropper.onSelectFile(e).then(res => {
        if (res?.ok === false) toast(`错误：${res.message}`);
    });
}
export function initAvatarCropper() { avatarCropper.init(); }
export function initAvatarCropperWithRetry(retryCount = 0) { avatarCropper.initWithRetry(retryCount); }
export function drawAvatarCropper(img) { avatarCropper.draw(img); }
export function startAvatarDrag(e) { avatarCropper.startDrag(e); }
export function avatarDrag(e) { avatarCropper.drag(e); }
export function endAvatarDrag() { avatarCropper.endDrag(); }
export function confirmAvatarCrop() {
    const res = avatarCropper.confirm();
    if (!res.ok) toast('错误：头像裁剪失败，请重试。');
    else toast('头像已更新');
}

