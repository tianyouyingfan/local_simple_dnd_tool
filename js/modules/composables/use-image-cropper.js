/**
 * 图片裁剪 Composable
 */
import { ref, reactive, watch, nextTick } from 'vue';
import { debugLog, validateImageFile, readFileAsDataURL } from 'helpers';
import { clamp } from 'utils';

export function useImageCropper({
    // refs (passed from outside)
    canvasRef,
    modalRef,
    // ui modal state: ui.imageCropper / ui.avatarCropper
    modalState,
    // config
    maxBytes,
    shape, // 'rect' | 'circle'
    getAspectRatio, // () => number, for rect
    // assignment (write back to draft)
    assignDataUrlToDraft, // (dataUrl) => void
    // output
    toDataUrl, // (tempCanvas) => string
}) {
    const sourceImage = ref(null);
    const cropBox = reactive({ x: 50, y: 50, width: 200, height: 200 });
    let dragging = false;
    const dragStart = { x: 0, y: 0 };
    let retryTimer = null;

    function reset() {
        if (retryTimer) {
            clearTimeout(retryTimer);
            retryTimer = null;
        }
        sourceImage.value = null;
        modalState.imageUrl = null;
    }

    async function onSelectFile(e) {
        const file = e?.target?.files?.[0];
        if (!file) return;

        const { valid, message } = validateImageFile(file, { maxBytes });
        if (!valid) {
            e.target.value = '';
            return { ok: false, message };
        }

        try {
            const url = await readFileAsDataURL(file);
            if (!url) throw new Error('读取结果为空');
            modalState.imageUrl = url;
            modalState.open = true;
            debugLog({ type: 'cropper.fileSelected', shape, urlPrefix: String(url).slice(0, 50) });
            return { ok: true };
        } catch (err) {
            console.error(err);
            return { ok: false, message: '读取图片失败，请尝试其他图片。' };
        } finally {
            e.target.value = '';
        }
    }

    function initWithRetry(retryCount = 0) {
        if (!modalState.open) return;
        const maxRetries = 5;
        const delay = 100 * (retryCount + 1);
        const canvas = canvasRef.value;
        const modal = modalRef.value;

        if (!canvas || !modal) {
            if (retryCount < maxRetries) {
                if (retryTimer) clearTimeout(retryTimer);
                retryTimer = setTimeout(() => initWithRetry(retryCount + 1), delay);
            } else {
                if (modalState.open) modalState.open = false;
            }
            return;
        }
        init();
    }

    function init() {
        const canvas = canvasRef.value;
        if (!canvas) return;

        const img = new Image();
        sourceImage.value = img;

        img.onerror = () => {
            console.error('图片加载失败');
            modalState.open = false;
        };
        img.onabort = () => {
            console.warn('图片加载取消');
            modalState.open = false;
        };
        img.onload = () => {
            if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
                console.error('图片无效/损坏');
                modalState.open = false;
                return;
            }

            const modalWidth = modalRef.value?.clientWidth || 680;
            const minCanvas = 200;
            const maxCanvasWidth = Math.max(minCanvas, modalWidth - 24);
            const canvasWidth = Math.max(minCanvas, Math.min(img.naturalWidth, maxCanvasWidth));
            const scale = canvasWidth / img.naturalWidth;
            const canvasHeight = Math.max(minCanvas, img.naturalHeight * scale);

            canvas.width = canvasWidth;
            canvas.height = canvasHeight;

            if (shape === 'rect') {
                const ar = Number(getAspectRatio?.()) || 16 / 9;
                const boxW = canvasWidth * 0.8;
                const boxH = boxW / ar;

                const maxBoxH = canvasHeight * 0.9;
                const finalH = Math.min(boxH, maxBoxH);
                const finalW = finalH * ar;

                cropBox.x = (canvasWidth - finalW) / 2;
                cropBox.y = (canvasHeight - finalH) / 2;
                cropBox.width = finalW;
                cropBox.height = finalH;
            } else {
                const minDim = Math.min(canvasWidth, canvasHeight);
                const size = Math.min(minDim * 0.8, minDim * 0.9);
                cropBox.x = (canvasWidth - size) / 2;
                cropBox.y = (canvasHeight - size) / 2;
                cropBox.width = size;
                cropBox.height = size;
            }

            draw(img);
        };

        if (!modalState.imageUrl) {
            modalState.open = false;
            return;
        }
        img.src = modalState.imageUrl;
    }

    function getCtx() {
        const canvas = canvasRef.value;
        if (!canvas) return null;
        return canvas.getContext('2d');
    }

    function draw(img) {
        const canvas = canvasRef.value;
        const ctx = getCtx();
        if (!canvas || !ctx || !img) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // overlay
        ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        if (shape === 'rect') {
            ctx.clearRect(cropBox.x, cropBox.y, cropBox.width, cropBox.height);
            ctx.drawImage(
                img,
                (cropBox.x / canvas.width) * img.naturalWidth,
                (cropBox.y / canvas.height) * img.naturalHeight,
                (cropBox.width / canvas.width) * img.naturalWidth,
                (cropBox.height / canvas.height) * img.naturalHeight,
                cropBox.x, cropBox.y, cropBox.width, cropBox.height
            );
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(cropBox.x, cropBox.y, cropBox.width, cropBox.height);
            return;
        }

        // circle
        ctx.save();
        ctx.beginPath();
        ctx.arc(
            cropBox.x + cropBox.width / 2,
            cropBox.y + cropBox.height / 2,
            cropBox.width / 2,
            0, Math.PI * 2, true
        );
        ctx.clip();
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(
            cropBox.x + cropBox.width / 2,
            cropBox.y + cropBox.height / 2,
            cropBox.width / 2,
            0, Math.PI * 2, true
        );
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    function startDrag(e) {
        const canvas = e.target;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const inside =
            mouseX > cropBox.x && mouseX < cropBox.x + cropBox.width &&
            mouseY > cropBox.y && mouseY < cropBox.y + cropBox.height;

        if (!inside) return;
        dragging = true;
        dragStart.x = mouseX - cropBox.x;
        dragStart.y = mouseY - cropBox.y;
    }

    function drag(e) {
        if (!dragging) return;
        const canvas = e.target;
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        cropBox.x = clamp(mouseX - dragStart.x, 0, canvas.width - cropBox.width);
        cropBox.y = clamp(mouseY - dragStart.y, 0, canvas.height - cropBox.height);
        draw(sourceImage.value);
    }

    function endDrag() {
        dragging = false;
    }

    function confirm() {
        const img = sourceImage.value;
        const canvas = canvasRef.value;
        if (!img || !canvas || !img.complete || img.naturalWidth === 0) return { ok: false };

        const scaleX = img.naturalWidth / canvas.width;
        const scaleY = img.naturalHeight / canvas.height;

        const sourceX = cropBox.x * scaleX;
        const sourceY = cropBox.y * scaleY;
        const sourceW = cropBox.width * scaleX;
        const sourceH = cropBox.height * scaleY;

        if (sourceW <= 0 || sourceH <= 0) return { ok: false };

        const temp = document.createElement('canvas');
        const tctx = temp.getContext('2d');
        if (!tctx) return { ok: false };

        if (shape === 'rect') {
            temp.width = sourceW;
            temp.height = sourceH;
            tctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH);
        } else {
            const size = Math.min(sourceW, sourceH);
            temp.width = size;
            temp.height = size;

            tctx.beginPath();
            tctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, true);
            tctx.clip();

            const offsetX = (sourceW - size) / 2;
            const offsetY = (sourceH - size) / 2;

            tctx.drawImage(
                img,
                sourceX + offsetX, sourceY + offsetY, size, size,
                0, 0, size, size
            );
        }

        const dataUrl = toDataUrl(temp);
        assignDataUrlToDraft(dataUrl);
        modalState.open = false;
        return { ok: true, dataUrl };
    }

    // modal open watcher（内聚：避免 setup 里写两坨几乎相同 watcher）
    watch(() => modalState.open, async (isOpen) => {
        debugLog({ type: 'cropper.openChanged', shape, isOpen });
        if (isOpen) {
            await nextTick();
            initWithRetry();
        } else {
            reset();
        }
    });

    return {
        // state
        cropBox,
        sourceImage,
        // methods
        onSelectFile,
        init,
        initWithRetry,
        draw,
        startDrag,
        drag,
        endDrag,
        confirm,
        reset,
    };
}

