import { createApp, ref, computed, watch, nextTick, reactive, onBeforeUnmount } from 'vue';
import { db, seedIfEmpty } from 'db';
import * as utils from 'utils';
import {
  route, monsters, abilities, pcs, actions, monsterGroups, monsterFilters,
  battle, ui, uiState, emptyMonster
} from 'state';
import {
  monsterTypes, damageTypes, conditionTypes, monsterTypeTranslations,
  crOptions, statusCatalog
} from 'constants';

/** ---------- Small helpers ---------- */
const IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
const BYTES = { MB: 1024 * 1024 };
const MAX_BG_BYTES = 10 * BYTES.MB;
const MAX_AVATAR_BYTES = 5 * BYTES.MB;

function debugLog(_event) {
  // 默认关闭：把你原来的 agent log 全部收敛到这里
  // 想启用的话：window.__DND_DEBUG_INGEST__ = (event) => fetch(...)
  try {
    if (typeof window !== 'undefined' && typeof window.__DND_DEBUG_INGEST__ === 'function') {
      window.__DND_DEBUG_INGEST__(_event);
    }
  } catch (_) {}
}

function safeJsonParse(text, fallback = null) {
  try { return JSON.parse(text); } catch { return fallback; }
}

function validateImageFile(file, { maxBytes }) {
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

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('FileReader 读取失败'));
    reader.onload = (e) => resolve(e?.target?.result || null);
    reader.readAsDataURL(file);
  });
}

function sortParticipantsByInitiative(list) {
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

function ensureActionDamages(draft) {
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

function isTypingInInput() {
  const el = document.activeElement;
  const tag = el?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA';
}

/** ---------- Toasts ---------- */
function useToasts() {
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

/** ---------- Cropper composable (rect / circle) ---------- */
function useImageCropper({
  // refs
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

  function reset() {
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
    const maxRetries = 5;
    const delay = 100 * (retryCount + 1);
    const canvas = canvasRef.value;
    const modal = modalRef.value;

    if (!canvas || !modal) {
      if (retryCount < maxRetries) {
        setTimeout(() => initWithRetry(retryCount + 1), delay);
      } else {
        modalState.open = false;
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

    cropBox.x = utils.clamp(mouseX - dragStart.x, 0, canvas.width - cropBox.width);
    cropBox.y = utils.clamp(mouseY - dragStart.y, 0, canvas.height - cropBox.height);
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
createApp({
    setup() {
      const { toast, removeToast } = useToasts();
  
      // 1) local refs
      const hpDelta = ref(5);
      const quickDamageInput = ref(null);
      const quickRollInput = ref(null);
      const participantTiles = ref(new Map());
  
      // 2) computeds
      const currentActor = computed(() => battle.participants[battle.currentIndex] || null);
  
      const filteredMonsters = computed(() => {
        const kw = (monsterFilters.keyword || '').trim();
        const cr = monsterFilters.cr;
        const types = monsterFilters.types || [];
  
        return monsters.value.filter(m => {
          if (kw && !m.name?.includes(kw)) return false;
          if (cr && String(m.cr) !== cr) return false;
          if (types.length) {
            const mt = m.type || [];
            if (!mt.some(t => types.includes(t))) return false;
          }
          return true;
        });
      });
  
      const filteredAbilities = computed(() => {
        const kw = (ui.abilityPool.keyword || '').trim();
        return abilities.value.filter(a => !kw || a.name?.includes(kw));
      });
  
      const filteredActions = computed(() => {
        const kw = (ui.actionPool.keyword || '').trim();
        return actions.value.filter(a => !kw || a.name?.includes(kw));
      });
  
      const groupedParticipants = computed(() => {
        const pcsGroup = [];
        const monstersGroup = [];
        for (const p of battle.participants) {
          if (p.type === 'pc') pcsGroup.push(p);
          else if (p.type === 'monster') monstersGroup.push(p);
        }
        return [
          pcsGroup.length ? { groupName: '玩家角色 (PCs)', members: pcsGroup } : null,
          monstersGroup.length ? { groupName: '怪物 (Monsters)', members: monstersGroup } : null,
        ].filter(Boolean);
      });
  
      const filteredMonstersForGroup = computed(() => {
        const kw = (ui.monsterGroupEditor.keyword || '').trim().toLowerCase();
        if (!kw) return monsters.value;
        return monsters.value.filter(m => (m.name || '').toLowerCase().includes(kw));
      });
  
      const sortedCurrentActorActions = computed(() => utils.sortActionsByType(currentActor.value?.actions));
      const sortedActorViewerActions = computed(() => utils.sortActionsByType(ui.actorViewer.actor?.actions));
      const sortedMonsterDraftActions = computed(() => utils.sortActionsByType(uiState.monsterDraft?.actions));
      const sortedPcDraftActions = computed(() => utils.sortActionsByType(uiState.pcDraft?.actions));
  
      // 3) watchers
      // battle 持久化（加一个最简单的 throttle，避免疯狂 stringify）
      let persistTimer = null;
      watch(battle, (newState) => {
        if (persistTimer) return;
        persistTimer = setTimeout(() => {
          persistTimer = null;
          try {
            localStorage.setItem('dnd-battle-state', JSON.stringify(newState));
          } catch (e) {
            console.error('Failed to persist battle state:', e);
          }
        }, 200);
      }, { deep: true });
  
      watch(currentActor, (newActor) => {
        if (!newActor) return;
        nextTick(() => {
          const tile = participantTiles.value.get(newActor.uid);
          tile?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        });
      });
  
      watch(() => ui.statusPicker.selectedName, (newName) => {
        const selected = statusCatalog.value.find(s => s.name === newName);
        if (selected) ui.statusPicker.icon = selected.icon;
      });
  
      watch(() => battle.currentIndex, () => { hpDelta.value = 5; });
  
      // participantTiles 清理：只依赖 uid 列表变化就够了
      watch(() => battle.participants.map(p => p.uid), (uids) => {
        const set = new Set(uids);
        for (const uid of participantTiles.value.keys()) {
          if (!set.has(uid)) participantTiles.value.delete(uid);
        }
      });
  
      /** ---------- Data loading ---------- */
      async function loadAll() {
        monsters.value = await db.monsters.toArray();
        abilities.value = await db.abilities.toArray();
        pcs.value = await db.pcs.toArray();
        actions.value = await db.actions.toArray();
        monsterGroups.value = await db.monsterGroups.toArray();
      }
  
      async function seedDemo() {
        await seedIfEmpty();
        await loadAll();
        toast('已载入演示数据');
      }
  
      /** ---------- Cropper instances (keep same template API names) ---------- */
      const cropperCanvas = ref(null);
      const cropperModal = ref(null);
      const avatarCropperCanvas = ref(null);
      const avatarCropperModal = ref(null);
  
      // 背景裁剪器实例
      const bgCropper = useImageCropper({
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
      const avatarCropper = useImageCropper({
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
  
      // 向模板暴露：保持你原命名不变（wrapper）
      function onBgImageSelect(e) {
        bgCropper.onSelectFile(e).then(res => {
          if (res?.ok === false) toast(`错误：${res.message}`);
        });
      }
      function initCropper() { bgCropper.init(); }
      function initCropperWithRetry(retryCount = 0) { bgCropper.initWithRetry(retryCount); }
      function drawCropper(img) { bgCropper.draw(img); }
      function startBgDrag(e) { bgCropper.startDrag(e); }
      function bgDrag(e) { bgCropper.drag(e); }
      function endBgDrag() { bgCropper.endDrag(); }
      function confirmCrop() {
        const res = bgCropper.confirm();
        if (!res.ok) toast('错误：裁剪失败，请重试。');
        else toast('背景图片已更新');
      }
  
      function onAvatarImageSelect(e) {
        avatarCropper.onSelectFile(e).then(res => {
          if (res?.ok === false) toast(`错误：${res.message}`);
        });
      }
      function initAvatarCropper() { avatarCropper.init(); }
      function initAvatarCropperWithRetry(retryCount = 0) { avatarCropper.initWithRetry(retryCount); }
      function drawAvatarCropper(img) { avatarCropper.draw(img); }
      function startAvatarDrag(e) { avatarCropper.startDrag(e); }
      function avatarDrag(e) { avatarCropper.drag(e); }
      function endAvatarDrag() { avatarCropper.endDrag(); }
      function confirmAvatarCrop() {
        const res = avatarCropper.confirm();
        if (!res.ok) toast('错误：头像裁剪失败，请重试。');
        else toast('头像已更新');
      }
  
      /** ---------- Template helpers ---------- */
      const formatDamages = (damages) => {
        if (!damages || damages.length === 0) return '无伤害';
        return damages.map(d => `${d.dice} ${d.type}`).join(', ');
      };
      function formatRolledDamages(rolledDamages) {
        if (!rolledDamages || rolledDamages.length === 0) return '0';
        return rolledDamages.map(d => `${d.amount} ${d.type}`).join(' + ');
      }
  
          /** ---------- UI toggles & filters ---------- */
    function toggleTypeFilter(t) {
        const idx = monsterFilters.types.indexOf(t);
        if (idx >= 0) monsterFilters.types.splice(idx, 1);
        else monsterFilters.types.push(t);
      }
  
      function toggleMonsterDraftType(typeKey) {
        const types = uiState.monsterDraft.type;
        const i = types.indexOf(typeKey);
        if (i > -1) types.splice(i, 1);
        else types.push(typeKey);
      }
  
      function toggleDamageModifier(property, damageType) {
        const draft = ui.activeEditor === 'pc' ? uiState.pcDraft : uiState.monsterDraft;
        const arr = draft?.[property]?.damage;
        if (!arr) return;
        const i = arr.indexOf(damageType);
        if (i > -1) arr.splice(i, 1);
        else arr.push(damageType);
      }
  
      function toggleConditionImmunity(condition) {
        const draft = ui.activeEditor === 'pc' ? uiState.pcDraft : uiState.monsterDraft;
        const arr = draft?.immunities?.conditions;
        if (!arr) return;
        const i = arr.indexOf(condition);
        if (i > -1) arr.splice(i, 1);
        else arr.push(condition);
      }
  
      /** ---------- Actor viewer ---------- */
      function openActorViewer(actor) {
        ui.actorViewer.isEditing = false;
        ui.actorViewer.draft = null;
        ui.actorViewer.actor = actor;
        ui.actorViewer.open = true;
      }
      function startActorViewerEdit() {
        if (!ui.actorViewer.actor) return;
        ui.actorViewer.draft = utils.deepClone(ui.actorViewer.actor);
        ui.actorViewer.isEditing = true;
      }
      function cancelActorViewerEdit() {
        ui.actorViewer.isEditing = false;
        ui.actorViewer.draft = null;
      }
      function saveActorViewerChanges() {
        if (!ui.actorViewer.actor || !ui.actorViewer.draft) return;
        Object.assign(ui.actorViewer.actor, ui.actorViewer.draft);
        ui.actorViewer.actor.hpCurrent = Math.min(ui.actorViewer.actor.hpCurrent, ui.actorViewer.actor.hpMax);
        toast(`${ui.actorViewer.actor.name} 的临时数据已更新`);
        cancelActorViewerEdit();
      }
  
      /** ---------- Monster CRUD ---------- */
      function openMonsterEditor(m = null) {
        const draft = utils.deepClone(m || emptyMonster());
        draft.isCustom = !!draft.isCustom;
        uiState.monsterDraft = draft;
        uiState.targetCR = draft.cr;
        ui.monsterEditor.mode = m ? 'view' : 'edit';
        ui.activeEditor = 'monster';
        ui.monsterEditor.open = true;
      }
  
      async function updateMonster() {
        const draft = utils.deepClone(uiState.monsterDraft);
        if (!draft.id) return toast('错误：该怪物没有ID，无法更新。请使用“另存为”');
        if (!draft.name) return toast('名称不能为空');
        await db.monsters.put(draft);
        await loadAll();
        ui.monsterEditor.open = false;
        toast('怪物数据已更新');
      }
  
      async function saveMonsterAsNew() {
        const draft = utils.deepClone(uiState.monsterDraft);
        draft.isCustom = true;
        draft.id = undefined;
        if (!draft.name) return toast('名称不能为空');
        await db.monsters.add(draft);
        await loadAll();
        ui.monsterEditor.open = false;
        toast('已保存为自定义怪物');
      }
  
      async function duplicateMonster(m) {
        const copy = utils.deepClone(m);
        copy.id = undefined;
        copy.name = `${m.name}（副本）`;
        copy.isCustom = true;
        await db.monsters.add(copy);
        await loadAll();
        toast('已复制');
      }
  
      async function deleteMonster(id) {
        if (!confirm('确认删除该怪物？')) return;
        await db.monsters.delete(id);
        await loadAll();
        toast('已删除');
      }
  
      /** ---------- PC CRUD ---------- */
      function openPCEditor(pc = null) {
        if (pc) {
          const draft = utils.deepClone(pc);
          draft.isDefault = pc.isDefault || false;
          draft.actions ||= [];
          draft.features ||= '';
          draft.resistances ||= { damage: [], conditions: [] };
          draft.vulnerabilities ||= { damage: [], conditions: [] };
          draft.immunities ||= { damage: [], conditions: [] };
          draft.backgroundImage ||= '';
          uiState.pcDraft = draft;
          ui.pcEditor.mode = 'view';
        } else {
          uiState.pcDraft = {
            name: '', avatar: '', ac: 14, hpMax: 20, hpCurrent: 20,
            abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            actions: [], features: '',
            resistances: { damage: [], conditions: [] },
            vulnerabilities: { damage: [], conditions: [] },
            immunities: { damage: [], conditions: [] },
            isDefault: false,
            backgroundImage: '',
          };
          ui.pcEditor.mode = 'edit';
        }
        ui.activeEditor = 'pc';
        ui.pcEditor.open = true;
      }
  
      async function savePC() {
        const draft = utils.deepClone(uiState.pcDraft);
        if (!draft.name) return toast('请填写名称');
        if (draft.id) await db.pcs.put(draft);
        else { draft.id = undefined; await db.pcs.add(draft); }
        await loadAll();
        ui.pcEditor.open = false;
        toast('PC已保存');
      }
  
      async function deletePC(id) {
        if (!confirm('确认删除该PC？')) return;
        await db.pcs.delete(id);
        pcs.value = await db.pcs.toArray();
        toast('已删除');
      }
  
      /** ---------- Ability & Action libraries ---------- */
      function openAbilityPool() {
        ui.abilityPool.nested = ui.monsterEditor.open || ui.pcEditor.open || ui.actionsViewer.open;
        ui.abilityPool.open = true;
      }
  
      function openAbilityEditor(ab = null) {
        ui.abilityEditor.nested = ui.abilityPool.open;
        uiState.abilityDraft = ab ? utils.deepClone(ab) : { name: '', description: '' };
        ui.abilityEditor.open = true;
      }
  
      async function saveAbility() {
        const ab = utils.deepClone(uiState.abilityDraft);
        if (!ab.name) return toast('请填写名称');
        if (ab.id) await db.abilities.put(ab);
        else await db.abilities.add(ab);
        await loadAll();
        ui.abilityEditor.open = false;
        toast('能力已保存');
      }
  
      async function deleteAbility(id) {
        if (!confirm('确认删除该能力？')) return;
        await db.abilities.delete(id);
        abilities.value = await db.abilities.toArray();
        toast('已删除');
      }
  
      function attachAbilityToDraft(ab) {
        uiState.monsterDraft.actions ||= [];
        uiState.monsterDraft.actions.push({
          id: crypto.randomUUID(),
          name: ab.name,
          type: 'utility',
          note: ab.description
        });
        toast('已添加到当前怪物动作/能力中');
        ui.abilityPool.open = false;
      }
  
      function openActionPool() {
        ui.actionPool.nested = ui.pcEditor.open || ui.monsterEditor.open || ui.actionsViewer.open;
        ui.actionPool.open = true;
      }
  
      function attachActionToDraft(action) {
        const draft = ui.activeEditor === 'pc' ? uiState.pcDraft : uiState.monsterDraft;
        if (!draft) return;
        draft.actions ||= [];
        const copy = utils.deepClone(action);
        delete copy.id;
        draft.actions.push(copy);
        toast(`已将动作添加到当前${ui.activeEditor === 'pc' ? 'PC' : '怪物'}`);
        ui.actionPool.open = false;
      }
  
      function openActionsViewer(draft) {
        ui.actionsViewer.draft = draft;
        ui.actionsViewer.title = `管理 ${draft.name} 的动作`;
        ui.actionsViewer.open = true;
      }
  
      function openActionEditorBase({ action = null, nested, saveTarget, ensurePrivateId }) {
        ui.actionEditor.nested = nested;
  
        if (action) {
          const draft = ensureActionDamages(utils.deepClone(action));
          uiState.actionDraft = draft;
        } else {
          uiState.actionDraft = ensureActionDamages({
            ...(ensurePrivateId ? { id: crypto.randomUUID() } : {}),
            name: '新动作',
            type: 'attack',
            attackBonus: 4,
            range: '近战',
            damages: [{ dice: '1d6+2', type: '斩击', id: crypto.randomUUID() }],
            recharge: 0,
            saveAbility: 'dex',
            saveDC: 13,
            onSuccess: 'half',
            onHitStatus: '',
            onHitStatusRounds: 1,
            onHitSaveAbility: 'dex',
            onHitSaveDC: 13,
          });
        }
  
        ui.actionEditor.saveTarget = saveTarget;
        ui.actionEditor.open = true;
      }
  
      function openActionEditor(action = null) {
        openActionEditorBase({ action, nested: false, saveTarget: 'global', ensurePrivateId: false });
      }
  
      function openActionEditorForDraft(action = null) {
        openActionEditorBase({ action, nested: true, saveTarget: 'private', ensurePrivateId: true });
      }
  
      async function saveAction() {
        const draft = utils.deepClone(uiState.actionDraft);
        if (!draft.name) return toast('请填写名称');
  
        if (ui.actionEditor.saveTarget === 'private') {
          const creatureDraft = ui.actionsViewer.draft;
          if (creatureDraft?.actions) {
            const idx = creatureDraft.actions.findIndex(a => a.id === draft.id);
            if (idx > -1) creatureDraft.actions[idx] = draft;
            else creatureDraft.actions.push(draft);
            toast('私有动作已保存');
          }
        } else {
          if (draft.id && typeof draft.id === 'number') await db.actions.put(draft);
          else { delete draft.id; await db.actions.add(draft); }
          await loadAll();
          toast('公共动作已保存');
        }
  
        ui.actionEditor.open = false;
      }
  
      function addDamageToActionDraft() {
        uiState.actionDraft?.damages?.push({ dice: '', type: '斩击', id: crypto.randomUUID() });
      }
  
      async function deleteAction(id) {
        if (!confirm('确认删除该动作？')) return;
        await db.actions.delete(id);
        actions.value = await db.actions.toArray();
        toast('已删除');
      }
  
      /** ---------- CR Adjustment ---------- */
      function autoAdjustCR() {
        uiState.monsterDraft = utils.adjustMonsterToCR(utils.deepClone(uiState.monsterDraft), uiState.targetCR);
        toast('已按占位规则调整（TODO：替换为正式智能规则表）');
      }
  
      /** ---------- Battle ---------- */
      function standardizeToParticipant(x) {
        const uid = crypto.randomUUID();
        const isPc = !!x.hpMax;
        return {
          uid,
          baseId: x.id || null,
          name: x.name,
          type: isPc ? 'pc' : 'monster',
          avatar: x.avatar || (x.type?.includes?.('dragon') ? '🐲' : (isPc ? '🧝' : '👾')),
          ac: x.ac || 12,
          hpMax: x.hpMax || x.hp?.average || 10,
          hpCurrent: x.hpCurrent || x.hp?.average || 10,
          abilities: x.abilities || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
          resistances: utils.deepClone(x.resistances || { damage: [], conditions: [] }),
          vulnerabilities: utils.deepClone(x.vulnerabilities || { damage: [], conditions: [] }),
          immunities: utils.deepClone(x.immunities || { damage: [], conditions: [] }),
          actions: utils.deepClone(x.actions || []).map(a => ({ ...a, cooldown: 0 })),
          statuses: [],
          initiative: null,
          cr: x.cr,
          speed: x.speed,
          monsterType: x.type,
          features: x.features,
          backgroundImage: x.backgroundImage,
        };
      }
  
      function addParticipantAndProcessInitiative(participant) {
        const inProgress = battle.participants.length > 0 && battle.participants[0].initiative !== null;
  
        if (!inProgress) {
          battle.participants.push(participant);
          return;
        }
  
        const init = utils.rollSingleInitiative(participant);
        Object.assign(participant, init);
        participant.justJoined = true;
  
        battle.participants.push(participant);
        sortParticipantsByInitiative(battle.participants);
  
        // 防止排序后 currentIndex 高亮错乱
        if (currentActor.value) {
          const newIdx = battle.participants.findIndex(p => p.uid === currentActor.value.uid);
          if (newIdx !== -1) battle.currentIndex = newIdx;
        }
      }
  
      function addToBattleFromEditor(entity, type) {
        const p = standardizeToParticipant(entity);
        addParticipantAndProcessInitiative(p);
        if (type === 'monster') ui.monsterEditor.open = false;
        else if (type === 'pc') ui.pcEditor.open = false;
        route.value = 'battle';
        toast(`${p.name} 已加入战斗`);
      }
      function addToBattleFromMonster(m) {
        addParticipantAndProcessInitiative(standardizeToParticipant(m));
        route.value = 'battle';
        toast('已加入战斗');
      }
      function addToBattleFromPC(pc) {
        addParticipantAndProcessInitiative(standardizeToParticipant(pc));
        route.value = 'battle';
        toast('已加入战斗');
      }
  
      function promptAddParticipants() { ui.addParticipants.open = true; }
  
      function addParticipantsFromMonster(m, count = 1) {
        for (let i = 0; i < count; i++) {
          const p = standardizeToParticipant(m);
          if (count > 1) p.name = `${m.name} #${i + 1}`;
          addParticipantAndProcessInitiative(p);
        }
        toast('怪物已加入');
      }
  
      function addParticipantsFromPC(pc) {
        addParticipantAndProcessInitiative(standardizeToParticipant(pc));
        toast('PC已加入');
      }
  
      async function resetBattle() {
        if (!confirm('确定要初始化战斗吗？当前战场将被清空，并自动载入所有默认参战单位。')) return;
        battle.participants = [];
        battle.round = 1;
        battle.currentIndex = 0;
        localStorage.removeItem('dnd-battle-state');
        ui.log = '战斗已初始化。';
  
        monsters.value.filter(m => m.isDefault).forEach(m => battle.participants.push(standardizeToParticipant(m)));
        pcs.value.filter(pc => pc.isDefault).forEach(pc => battle.participants.push(standardizeToParticipant(pc)));
  
        toast(`初始化完成，已自动加入 ${battle.participants.length} 个默认单位。`);
      }
  
      function rollInitiative() {
        for (const p of battle.participants) {
          Object.assign(p, utils.rollSingleInitiative(p));
          delete p.justJoined;
        }
        sortParticipantsByInitiative(battle.participants);
        battle.currentIndex = 0;
        battle.round = 1;
        toast('已掷先攻并排序');
      }
  
      function setCurrentActor(uid) {
        const idx = battle.participants.findIndex(p => p.uid === uid);
        if (idx >= 0) battle.currentIndex = idx;
      }
  
      function decrementParticipantStatuses(participant) {
        participant.statuses = participant.statuses
          .map(s => ({ ...s, rounds: s.rounds - 1 }))
          .filter(s => s.rounds > 0);
      }
  
      function decrementActionCooldowns(participant) {
        participant.actions?.forEach(a => { if (a.cooldown > 0) a.cooldown--; });
      }
  
      function removeParticipant(uid) {
        const i = battle.participants.findIndex(p => p.uid === uid);
        if (i < 0) return;
        battle.participants.splice(i, 1);
        if (battle.currentIndex >= battle.participants.length) battle.currentIndex = 0;
      }
  
      function nextTurn() {
        if (!battle.participants.length) return;
  
        const actor = currentActor.value;
        if (actor?.justJoined) {
          delete actor.justJoined;
          toast(`【${actor.name}】在本轮加入，其首个回合将被跳过。`);
  
          battle.currentIndex++;
          if (battle.currentIndex >= battle.participants.length) {
            battle.currentIndex = 0;
            battle.round++;
          }
          if (currentActor.value) {
            decrementParticipantStatuses(currentActor.value);
            decrementActionCooldowns(currentActor.value);
          }
          return;
        }
  
        const active = currentActor.value;
        let removed = false;
        if (active && active.hpCurrent <= 0 && active.type === 'monster') {
          const deadName = active.name;
          removeParticipant(active.uid);
          toast(`怪物【${deadName}】已在回合结束后移除。`);
          removed = true;
        }
        if (!removed) battle.currentIndex++;
  
        if (battle.currentIndex >= battle.participants.length) {
          battle.currentIndex = 0;
          battle.round++;
        }
        if (currentActor.value) {
          decrementParticipantStatuses(currentActor.value);
          decrementActionCooldowns(currentActor.value);
        }
      }
  
      function prevTurn() {
        if (!battle.participants.length) return;
        battle.currentIndex--;
        if (battle.currentIndex < 0) {
          battle.currentIndex = battle.participants.length - 1;
          battle.round = Math.max(1, battle.round - 1);
        }
      }
  
      function onDragStart(idx) { battle.dragIndex = idx; }
      function onDrop(idx) {
        const from = battle.dragIndex;
        if (from == null) return;
        const item = battle.participants.splice(from, 1)[0];
        battle.participants.splice(idx, 0, item);
        battle.dragIndex = null;
      }
  
      /** ---------- HP & Status ---------- */
      function applyHPDelta(p, delta) {
        delta = Number(delta) || 0;
        if (delta === 0) return;
        p.hpCurrent = utils.clamp(p.hpCurrent + delta, 0, p.hpMax);
        if (p.hpCurrent <= 0 && p.type === 'monster') {
          p.isDefeated = true;
          toast(`怪物【${p.name}】血量归零，将在回合结束后移除。`);
        }
      }
  
      function closeQuickDamageEditor() { ui.quickDamage.open = false; }
  
      async function openQuickDamageEditor(participant) {
        ui.quickDamage.targetUid = participant.uid;
        ui.quickDamage.targetName = participant.name;
        ui.quickDamage.damageAmount = null;
        ui.quickDamage.open = true;
        await nextTick();
        quickDamageInput.value?.focus();
      }
  
      function applyQuickDamage() {
        const { damageAmount, targetUid } = ui.quickDamage;
        if (typeof damageAmount !== 'number' || damageAmount <= 0) return closeQuickDamageEditor();
        const target = battle.participants.find(p => p.uid === targetUid);
        if (target) applyHPDelta(target, -Math.abs(damageAmount));
        closeQuickDamageEditor();
      }
  
      function openHPEditor(participant) {
        ui.hpEditor.open = true;
        ui.hpEditor.targetUid = participant.uid;
        ui.hpEditor.delta = null;
      }
  
      function openStatusPicker(target) {
        ui.statusPicker.open = true;
        ui.statusPicker.targetUid = target.uid;
        if (statusCatalog.value.length > 0) {
          ui.statusPicker.selectedName = statusCatalog.value[0].name;
          ui.statusPicker.icon = statusCatalog.value[0].icon;
        }
      }
  
      function applyStatus() {
        const t = battle.participants.find(p => p.uid === ui.statusPicker.targetUid);
        if (!t) return;
        t.statuses.push({
          id: crypto.randomUUID(),
          name: ui.statusPicker.selectedName,
          icon: ui.statusPicker.icon || '⏳',
          rounds: ui.statusPicker.rounds || 1,
        });
        ui.statusPicker.open = false;
      }
  
      function removeStatus(target, statusId) {
        target.statuses = target.statuses.filter(s => s.id !== statusId);
      }
  
      /** ---------- Targeting ---------- */
      function toggleTarget(uid) {
        const i = ui.selectedTargets.indexOf(uid);
        if (i >= 0) ui.selectedTargets.splice(i, 1);
        else ui.selectedTargets.push(uid);
      }
  
      function toggleSelectGroup(g) {
        const ids = g.members.map(m => m.uid);
        const allIn = ids.every(id => ui.selectedTargets.includes(id));
        if (allIn) ui.selectedTargets = ui.selectedTargets.filter(id => !ids.includes(id));
        else ui.selectedTargets = Array.from(new Set(ui.selectedTargets.concat(ids)));
      }
  
      function selectNone() { ui.selectedTargets = []; }
  
      /** ---------- Actions ---------- */
      const promptSaveCheck = (target, action, onSaveFail) => {
        ui.saveCheck.targetName = target.name;
        ui.saveCheck.dc = action.onHitSaveDC;
        ui.saveCheck.ability = action.onHitSaveAbility;
        ui.saveCheck.callback = (saveSucceeded) => {
          if (!saveSucceeded) onSaveFail();
          ui.log += `${target.name} 的 ${action.onHitSaveAbility.toUpperCase()} 豁免检定 (DC ${action.onHitSaveDC}) ${saveSucceeded ? '成功' : '失败'}.\n`;
          ui.saveCheck.open = false;
        };
        ui.saveCheck.open = true;
      };
  
      function selectAction(a) {
        ui.selectedAction = utils.deepClone(a);
        ui.log = `已选择动作：${a.name}\n`;
      }
  
      function calculateModifiedDamage(target, damageAmount, damageType) {
        if (target.immunities?.damage?.includes(damageType)) return 0;
        if (target.vulnerabilities?.damage?.includes(damageType)) return damageAmount * 2;
        if (target.resistances?.damage?.includes(damageType)) return Math.floor(damageAmount / 2);
        return damageAmount;
      }
  
      function processNotificationQueue() {
        if (ui.critNotification.open || ui.normalHitNotification.open || ui.missNotification.open) return;
        if (ui.notificationQueue.length === 0) return;
  
        const n = ui.notificationQueue.shift();
        if (n.type === 'crit') { Object.assign(ui.critNotification, n.data); ui.critNotification.open = true; }
        else if (n.type === 'hit') { Object.assign(ui.normalHitNotification, n.data); ui.normalHitNotification.open = true; }
        else if (n.type === 'miss') { Object.assign(ui.missNotification, n.data); ui.missNotification.open = true; }
      }
  
      function dismissCurrentNotification() {
        ui.critNotification.open = false;
        ui.normalHitNotification.open = false;
        ui.missNotification.open = false;
        nextTick(() => processNotificationQueue());
      }
  
      function runAction() {
        if (ui.actionOnCooldown) return;
        ui.actionOnCooldown = true;
        setTimeout(() => { ui.actionOnCooldown = false; }, 5000);
  
        const actor = currentActor.value;
        const action = ui.selectedAction;
        if (!actor || !action) return;
  
        // 兼容旧结构：攻击/豁免动作可能还带 damageDice
        if ((action.type === 'attack' || action.type === 'save') && !action.damages && action.damageDice) {
          action.damages = [{ dice: action.damageDice, type: action.damageType || 'generic' }];
        }
  
        const targets = battle.participants.filter(p => ui.selectedTargets.includes(p.uid));
        if (!targets.length) return toast('请先在右侧选择目标');
  
        let log = `【${actor.name}】使用「${action.name}」对 ${targets.length} 个目标：\n`;
  
        if (action.type === 'attack') {
          for (const t of targets) {
            const d20 = utils.rollD20(ui.rollMode);
            const toHit = d20.value + (action.attackBonus || 0);
            const hit = (d20.value === 20) || (toHit >= t.ac);
  
            log += `- 目标【${t.name}】 -> d20(${d20.raw.join(',')}) + ${action.attackBonus || 0} = ${toHit} vs AC ${t.ac} => ${d20.isCrit ? '重击' : (hit ? '命中' : '未命中')}\n`;
  
            if (hit && !d20.isFumble) {
              const allDamageDetails = [];
              let totalFinalDamage = 0;
  
              for (const dmg of action.damages || []) {
                if (!dmg.dice) continue;
                const details = utils.rollDamageWithDetails(dmg.dice, d20.isCrit, dmg.type);
                const raw = details.total;
                const final = calculateModifiedDamage(t, raw, dmg.type);
                totalFinalDamage += final;
  
                let modifier = '';
                if (final < raw) modifier = '抗性';
                else if (final > raw) modifier = '易伤';
                else if (final === 0 && raw > 0) modifier = '免疫';
  
                allDamageDetails.push({ rawAmount: raw, finalAmount: final, type: dmg.type, modifier });
              }
  
              if (allDamageDetails.length > 0) {
                ui.notificationQueue.push({
                  type: d20.isCrit ? 'crit' : 'hit',
                  data: d20.isCrit
                    ? {
                        type: 'success',
                        attacker: actor.name, target: t.name,
                        toHitRoll: `d20(${d20.raw.join(',')}) + ${action.attackBonus || 0}`,
                        toHitResult: toHit, targetAC: t.ac,
                        damages: allDamageDetails,
                        totalFinalDamage,
                      }
                    : {
                        attacker: actor.name, target: t.name,
                        toHitRoll: `d20(${d20.raw.join(',')}) + ${action.attackBonus || 0}`,
                        toHitResult: toHit, targetAC: t.ac,
                        damages: allDamageDetails,
                        totalFinalDamage,
                      }
                });
              }
  
              const damageLogParts = allDamageDetails.map(d => {
                let part = `${d.rawAmount} ${d.type}`;
                if (d.finalAmount !== d.rawAmount) part += ` (变为 ${d.finalAmount})`;
                return part;
              });
  
              log += ` 伤害: ${damageLogParts.join(' + ')} = 总计 ${totalFinalDamage} 伤害\n`;
  
              if (ui.autoApplyDamage) {
                t.hpCurrent = utils.clamp(t.hpCurrent - totalFinalDamage, 0, t.hpMax);
                log += ` 已自动扣血：-${totalFinalDamage}，剩余HP ${t.hpCurrent}\n`;
              } else {
                log += ` （未自动扣血）\n`;
              }
  
              if (action.onHitStatus) {
                const apply = () => {
                  const exists = t.statuses.find(s => s.name === action.onHitStatus);
                  if (exists) return;
                  const info = statusCatalog.value.find(sc => sc.name === action.onHitStatus) || {};
                  t.statuses.push({
                    id: crypto.randomUUID(),
                    name: action.onHitStatus,
                    rounds: action.onHitStatusRounds || 1,
                    icon: info.icon || '⏳'
                  });
                  log += `  -> ${t.name} 获得了状态: ${action.onHitStatus}.\n`;
                };
  
                if (action.onHitSaveAbility && action.onHitSaveDC) promptSaveCheck(t, action, apply);
                else apply();
              }
            } else if (!hit && !d20.isFumble) {
              ui.notificationQueue.push({
                type: 'miss',
                data: {
                  attacker: actor.name, target: t.name,
                  toHitRoll: `d20(${d20.raw.join(',')}) + ${action.attackBonus || 0}`,
                  toHitResult: toHit, targetAC: t.ac,
                }
              });
            } else if (d20.isFumble) {
              ui.notificationQueue.push({
                type: 'crit',
                data: {
                  type: 'failure',
                  attacker: actor.name, target: t.name,
                  toHitRoll: `d20(${d20.raw.join(',')}) + ${action.attackBonus || 0}`,
                  toHitResult: toHit, targetAC: t.ac,
                  damages: [], totalFinalDamage: 0,
                }
              });
            }
          }
  
          ui.log = log;
        } else if (action.type === 'save') {
          log += `发动范围效果: ${action.name} (DC ${action.saveDC} ${action.saveAbility?.toUpperCase()})\n`;
          const rolledDamages = [];
  
          for (const dmg of action.damages || []) {
            if (!dmg.dice) continue;
            const dmgResult = utils.rollDamage(dmg.dice, false, dmg.type);
            rolledDamages.push(...dmgResult);
          }
  
          log += `总潜在伤害: ${formatRolledDamages(rolledDamages)}\n`;
  
          ui.saveOutcomePicker.title = `处理 "${action.name}" 的豁免结果`;
          ui.saveOutcomePicker.action = utils.deepClone(action);
          ui.saveOutcomePicker.targets = utils.deepClone(targets);
          ui.saveOutcomePicker.damages = rolledDamages;
          ui.saveOutcomePicker.outcomes = {};
          for (const t of targets) {
            ui.saveOutcomePicker.outcomes[t.uid] = action.onSuccess === 'half' ? 'half' : 'fail';
          }
          ui.log = log + '请在弹出的窗口中为每个目标选择豁免结果。';
          ui.saveOutcomePicker.open = true;
        } else {
          ui.log = '该动作不支持自动结算（utility）。';
        }
  
        if (action.recharge > 0) {
          const actorAction = actor.actions.find(a => a.name === action.name);
          if (actorAction) {
            actorAction.cooldown = action.recharge;
            ui.log += `\n「${action.name}」进入冷却，${action.recharge}回合后可用。`;
          }
        }
  
        processNotificationQueue();
        selectNone();
      }
  
      function applySaveOutcomes() {
        const { targets, damages, outcomes, action } = ui.saveOutcomePicker;
        let log = `处理 "${action.name}" 的豁免结果：\n`;
  
        if (!targets.length) { ui.saveOutcomePicker.open = false; return; }
  
        const totalDamageByType = damages.reduce((acc, dmg) => {
          acc[dmg.type] = (acc[dmg.type] || 0) + dmg.amount;
          return acc;
        }, {});
  
        for (const temp of targets) {
          const target = battle.participants.find(p => p.uid === temp.uid);
          if (!target) continue;
  
          const outcome = outcomes[target.uid];
          let totalModified = 0;
          const parts = [];
  
          for (const type in totalDamageByType) {
            const raw = totalDamageByType[type];
            const mod = calculateModifiedDamage(target, raw, type);
            if (mod > 0) parts.push(`${mod} ${type}`);
            totalModified += mod;
          }
  
          let final = 0;
          let text = '';
          if (outcome === 'fail') { final = totalModified; text = '豁免失败'; }
          else if (outcome === 'half') { final = Math.ceil(totalModified / 2); text = '伤害减半'; }
          else { final = 0; text = '伤害全免'; }
  
          log += `- 目标【${target.name}】 -> ${text}，受到 ${final} 点伤害 (${parts.join(' + ') || '无'}).\n`;
  
          if (ui.autoApplyDamage && final > 0) {
            applyHPDelta(target, -final);
            log += `  已自动扣血, 剩余 HP ${target.hpCurrent}.\n`;
          }
        }
  
        ui.log = log;
        ui.saveOutcomePicker.open = false;
        selectNone();
      }
  
      function selectActionFromViewer(action) {
        if (action.type !== 'attack' && action.type !== 'save') return;
        selectAction(action);
        ui.actorViewer.open = false;
      }
  
      /** ---------- Quick dice ---------- */
      function openQuickDice() {
        ui.quickDice.expression = '';
        ui.quickDice.resultOpen = false;
        ui.quickDice.inputOpen = true;
        nextTick(() => quickRollInput.value?.focus());
      }
  
      function executeQuickRoll() {
        if (!ui.quickDice.expression.trim()) return;
        ui.quickDice.result = utils.rollExpression(ui.quickDice.expression);
        ui.quickDice.inputOpen = false;
        ui.quickDice.resultOpen = true;
      }
  
      /** ---------- Import/Export ---------- */
      async function exportAll() {
        const data = {
          meta: { app: 'dnd-assist-v2', exportedAt: new Date().toISOString(), version: 1 },
          monsters: await db.monsters.toArray(),
          abilities: await db.abilities.toArray(),
          pcs: await db.pcs.toArray(),
          actions: await db.actions.toArray(),
          monsterGroups: await db.monsterGroups.toArray(),
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `dnd-local-v2-export-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      }
  
      async function importAll(e) {
        const file = e.target.files[0];
        if (!file) return;
  
        try {
          const data = safeJsonParse(await file.text());
          if (!data?.monsters || !data?.abilities || !data?.pcs || !data?.actions || !data?.monsterGroups) {
            throw new Error('格式不完整');
          }
          if (!confirm('导入将清空并替换当前的怪物库、PC库、能力库、动作库和怪物组合。确定要继续吗？')) return;
  
          await db.transaction('rw', db.monsters, db.abilities, db.pcs, db.actions, db.monsterGroups, async () => {
            await db.monsters.clear(); await db.abilities.clear(); await db.pcs.clear();
            await db.actions.clear(); await db.monsterGroups.clear();
            await db.monsters.bulkAdd(data.monsters);
            await db.abilities.bulkAdd(data.abilities);
            await db.pcs.bulkAdd(data.pcs);
            await db.actions.bulkAdd(data.actions);
            await db.monsterGroups.bulkAdd(data.monsterGroups);
          });
  
          await loadAll();
          toast('导入成功');
        } catch (err) {
          alert('导入失败：' + err.message);
        } finally {
          e.target.value = '';
        }
      }
  
      /** ---------- Monster groups ---------- */
      function openGroupManager() { ui.monsterGroupManager.open = true; }
  
      function openGroupEditor(group = null) {
        uiState.groupDraft = group ? utils.deepClone(group) : { name: '', monsters: [] };
        ui.monsterGroupEditor.keyword = '';
        ui.monsterGroupEditor.open = true;
      }
  
      function addMonsterToGroupDraft(monster) {
        const existing = uiState.groupDraft.monsters.find(m => m.monsterId === monster.id);
        if (existing) existing.count++;
        else uiState.groupDraft.monsters.push({ monsterId: monster.id, name: monster.name, count: 1 });
      }
  
      async function saveGroup() {
        const draft = utils.deepClone(uiState.groupDraft);
        if (!draft.name || draft.monsters.length === 0) return toast('请填写组名并添加至少一个怪物');
  
        draft.monsters = draft.monsters.filter(m => m.count >= 1);
        if (draft.id) await db.monsterGroups.put(draft);
        else await db.monsterGroups.add(draft);
  
        await loadAll();
        ui.monsterGroupEditor.open = false;
        toast('怪物组合已保存');
      }
  
      async function deleteGroup(id) {
        if (!confirm('确定要永久删除这个怪物组合吗？此操作不可撤销。')) return;
        await db.monsterGroups.delete(id);
        await loadAll();
        toast('组合已删除');
      }
  
      function addParticipantsFromGroup(group) {
        let added = 0;
        for (const gm of group.monsters) {
          const tpl = monsters.value.find(m => m.id === gm.monsterId);
          if (!tpl) continue;
          for (let i = 0; i < gm.count; i++) {
            const p = standardizeToParticipant(tpl);
            if (gm.count > 1) p.name = `${tpl.name} #${i + 1}`;
            addParticipantAndProcessInitiative(p);
            added++;
          }
        }
        toast(`已从组合 [${group.name}] 添加 ${added} 个怪物`);
      }
  
      /** ---------- Global keydown (double tap) ---------- */
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
  
      /** ---------- Initialize ---------- */
      (async function initializeApp() {
        try {
          const saved = localStorage.getItem('dnd-battle-state');
          if (saved) {
            const parsed = safeJsonParse(saved);
            if (parsed) Object.assign(battle, parsed);
          }
        } catch (e) {
          console.error('Failed to load battle state:', e);
          localStorage.removeItem('dnd-battle-state');
        }
        await seedIfEmpty();
        await loadAll();
      })();
  
      /** ---------- return (keep template API) ---------- */
      return {
        // State
        route, monsters, abilities, pcs, actions, monsterGroups, monsterFilters,
        battle, ui, uiState,
  
        // Constants
        monsterTypes, damageTypes, conditionTypes, crOptions, statusCatalog,
  
        // Local refs & computeds
        hpDelta, quickDamageInput, quickRollInput, participantTiles,
        currentActor, filteredMonsters, filteredAbilities, filteredActions, groupedParticipants,
        filteredMonstersForGroup, sortedCurrentActorActions, sortedActorViewerActions,
        sortedMonsterDraftActions, sortedPcDraftActions,
  
        // DOM refs
        cropperCanvas, cropperModal, avatarCropperCanvas, avatarCropperModal,
  
        // Methods
        toast, removeToast, loadAll, seedDemo,
  
        toggleTypeFilter, toggleMonsterDraftType, toggleDamageModifier, toggleConditionImmunity,
  
        openActorViewer, startActorViewerEdit, cancelActorViewerEdit, saveActorViewerChanges,
  
        openMonsterEditor, updateMonster, saveMonsterAsNew, duplicateMonster, deleteMonster,
        openPCEditor, savePC, deletePC,
  
        openAbilityPool, openAbilityEditor, saveAbility, deleteAbility, attachAbilityToDraft,
        openActionPool, attachActionToDraft, openActionsViewer,
        openActionEditor, openActionEditorForDraft, saveAction, addDamageToActionDraft, deleteAction,
  
        autoAdjustCR,
  
        resetBattle, standardizeToParticipant, addToBattleFromEditor, addToBattleFromMonster, addToBattleFromPC,
        promptAddParticipants, addParticipantsFromMonster, addParticipantsFromPC,
  
        // Cropper API (names preserved)
        onBgImageSelect, initCropper, initCropperWithRetry, drawCropper, startBgDrag, bgDrag, endBgDrag, confirmCrop,
        onAvatarImageSelect, initAvatarCropper, initAvatarCropperWithRetry, drawAvatarCropper,
        startAvatarDrag, avatarDrag, endAvatarDrag, confirmAvatarCrop,
  
        // Turns & drag
        rollInitiative, setCurrentActor, nextTurn, prevTurn, removeParticipant, onDragStart, onDrop,
  
        // HP & status
        applyHPDelta, closeQuickDamageEditor, openQuickDamageEditor, applyQuickDamage, openHPEditor,
        openStatusPicker, applyStatus, removeStatus,
  
        // Targeting
        toggleTarget, toggleSelectGroup, selectNone,
  
        // Action
        promptSaveCheck, selectAction, calculateModifiedDamage, runAction, applySaveOutcomes,
  
        // Import/export
        exportAll, importAll,
  
        // Groups
        openGroupManager, openGroupEditor, addMonsterToGroupDraft, saveGroup, deleteGroup, addParticipantsFromGroup,
  
        // Notifications
        dismissCurrentNotification, processNotificationQueue,
  
        // Quick dice
        openQuickDice, executeQuickRoll,
  
        selectActionFromViewer,
  
        // Template helpers
        formatDamages, formatRolledDamages,
        mod: (v) => utils.abilityMod(Number(v) || 10),
        translateType: (t) => monsterTypeTranslations[t] || t,
      };
    }
  }).mount('#app');
  
  document.body.classList.remove('loading');// 继续往下：业务方法（第3段）