import { createApp, ref, computed, watch, nextTick, reactive } from 'vue';
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
createApp({
    setup() {
        // 1. 本地响应式状态 和 DOM引用
        const hpDelta = ref(5);
        const quickDamageInput = ref(null);
        const quickRollInput = ref(null);
        const participantTiles = ref(new Map());

        // 2. 计算属性
        const currentActor = computed(() => battle.participants[battle.currentIndex] || null);
        const filteredMonsters = computed(() => {
            return monsters.value.filter(m => !monsterFilters.keyword || m.name.includes(monsterFilters.keyword)).filter(m => !monsterFilters.cr || String(m.cr) === monsterFilters.cr).filter(m => monsterFilters.types.length === 0 || (m.type || []).some(t => monsterFilters.types.includes(t)));
        });
        const filteredAbilities = computed(() => {
            return abilities.value.filter(a => !ui.abilityPool.keyword || a.name.includes(ui.abilityPool.keyword));
        });
        const filteredActions = computed(() => {
            return actions.value.filter(a => !ui.actionPool.keyword || a.name.includes(ui.actionPool.keyword));
        });
        const groupedParticipants = computed(() => {
            const groups = {
                pcs: { groupName: '玩家角色 (PCs)', members: [] },
                monsters: { groupName: '怪物 (Monsters)', members: [] }
            };
            for (const p of battle.participants) {
                if (p.type === 'pc') {
                    groups.pcs.members.push(p);
                } else if (p.type === 'monster') {
                    groups.monsters.members.push(p);
                }
            }
            return Object.values(groups).filter(g => g.members.length > 0);
        });
        const filteredMonstersForGroup = computed(() => {
            const keyword = ui.monsterGroupEditor.keyword.toLowerCase();
            if (!keyword) return monsters.value;
            return monsters.value.filter(m => m.name.toLowerCase().includes(keyword));
        });
        // MODIFIED: 所有排序函数都使用了 utils.sortActionsByType
        const sortedCurrentActorActions = computed(() => utils.sortActionsByType(currentActor.value?.actions));
        const sortedActorViewerActions = computed(() => utils.sortActionsByType(ui.actorViewer.actor?.actions));
        const sortedMonsterDraftActions = computed(() => utils.sortActionsByType(uiState.monsterDraft?.actions));
        const sortedPcDraftActions = computed(() => utils.sortActionsByType(uiState.pcDraft?.actions));


        // 3. 监听器
        watch(battle, (newState) => {
            localStorage.setItem('dnd-battle-state', JSON.stringify(newState));
        }, { deep: true });
        watch(currentActor, (newActor) => {
            if (newActor) {
                nextTick(() => {
                    const tile = participantTiles.value.get(newActor.uid);
                    if (tile) {
                        tile.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest',
                            inline: 'center'
                        });
                    }
                });
            }
        });

        watch(() => ui.statusPicker.selectedName, (newName) => {
            const selectedStatus = statusCatalog.value.find(s => s.name === newName);
            if (selectedStatus) {
                ui.statusPicker.icon = selectedStatus.icon;
            }
        });
        watch(() => battle.currentIndex, () => {
            hpDelta.value = 5;
        });
        watch(() => battle.participants, () => {
            const existingUids = new Set(battle.participants.map(p => p.uid));
            for (const uid of participantTiles.value.keys()) {
                if (!existingUids.has(uid)) {
                    participantTiles.value.delete(uid);
                }
            }
        }, { deep: true });
        
        // 监听背景裁剪模态框
        watch(() => ui.imageCropper.open, (isOpen) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:95',message:'背景裁剪模态框watch触发',data:{isOpen,imageUrl:ui.imageCropper.imageUrl?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            if (isOpen) {
                // 使用多个nextTick确保DOM完全渲染
                nextTick(() => {
                    nextTick(() => {
                        // 添加重试机制，确保DOM元素可用
                        initCropperWithRetry();
                    });
                });
            } else {
                // 当模态框关闭时，安全地重置状态
                bgSourceImage.value = null;
                ui.imageCropper.imageUrl = null;
                console.log("背景裁剪器已关闭，状态已重置");
            }
        });

        // 监听头像裁剪模态框
        watch(() => ui.avatarCropper.open, (isOpen) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:113',message:'头像裁剪模态框watch触发',data:{isOpen,imageUrl:ui.avatarCropper.imageUrl?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            if (isOpen) {
                // 使用多个nextTick确保DOM完全渲染
                nextTick(() => {
                    nextTick(() => {
                        // 添加重试机制，确保DOM元素可用
                        initAvatarCropperWithRetry();
                    });
                });
            } else {
                // 当模态框关闭时，安全地重置状态
                avatarSourceImage.value = null;
                ui.avatarCropper.imageUrl = null;
                console.log("头像裁剪器已关闭，状态已重置");
            }
        });
        // Helper functions that are part of business logic
        const formatDamages = (damages) => {
            if (!damages || damages.length === 0) return '无伤害';
            return damages.map(d => `${d.dice} ${d.type}`).join(', ');
        };
        
        // 图片验证工具函数
        function validateImageFile(file, isAvatar = false) {
            // 检查文件是否存在
            if (!file) {
                return { valid: false, message: '没有选择文件' };
            }
            
            // 检查文件类型
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                return { valid: false, message: '不支持的文件格式。请使用 JPG、PNG、GIF 或 WebP 格式的图片。' };
            }
            
            // 检查文件大小
            const maxSize = isAvatar ? 5 * 1024 * 1024 : 10 * 1024 * 1024; // 头像5MB，背景10MB
            if (file.size > maxSize) {
                return { valid: false, message: `图片文件过大。请选择小于 ${isAvatar ? '5MB' : '10MB'} 的图片。` };
            }
            
            // 检查文件是否为空
            if (file.size === 0) {
                return { valid: false, message: '图片文件为空，请选择有效的图片文件。' };
            }
            
            return { valid: true };
        }
        function formatRolledDamages(rolledDamages) {
            if (!rolledDamages || rolledDamages.length === 0) return '0';
            return rolledDamages.map(d => `${d.amount} ${d.type}`).join(' + ');
        }
        function toast(msg) {
            const id = crypto.randomUUID();
            ui.toasts.push({ id, message: msg });
            setTimeout(() => {
                removeToast(id);
            }, 3000);
        }
        function removeToast(id) {
            const index = ui.toasts.findIndex(t => t.id === id);
            if (index > -1) {
                ui.toasts.splice(index, 1);
            }
        }

        // Data Loading
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

        // UI Toggles & Filters
        function toggleTypeFilter(t) {
            const idx = monsterFilters.types.indexOf(t);
            if (idx >= 0) monsterFilters.types.splice(idx, 1);
            else monsterFilters.types.push(t);
        }
        function toggleMonsterDraftType(typeKey) {
            const types = uiState.monsterDraft.type;
            const index = types.indexOf(typeKey);
            if (index > -1) {
                types.splice(index, 1);
            } else {
                types.push(typeKey);
            }
        }
        function toggleDamageModifier(property, damageType) {
            const draft = ui.activeEditor === 'pc' ? uiState.pcDraft : uiState.monsterDraft;
            if (!draft[property] || !draft[property].damage) return;
            const arr = draft[property].damage;
            const idx = arr.indexOf(damageType);
            if (idx > -1) {
                arr.splice(idx, 1);
            } else {
                arr.push(damageType);
            }
        }
        function toggleConditionImmunity(condition) {
            const draft = ui.activeEditor === 'pc' ? uiState.pcDraft : uiState.monsterDraft;
            if (!draft.immunities || !draft.immunities.conditions) return;
            const arr = draft.immunities.conditions;
            const idx = arr.indexOf(condition);
            if (idx > -1) {
                arr.splice(idx, 1);
            } else {
                arr.push(condition);
            }
        }

        // Actor Viewer
        function openActorViewer(actor) {
            ui.actorViewer.isEditing = false; // 新增：重置编辑状态
            ui.actorViewer.draft = null;      // 新增：清空旧草稿
            ui.actorViewer.actor = actor;     // 修改：移除 deepClone
            ui.actorViewer.open = true;
        }
        
        // 新增：开始编辑生物详情
        function startActorViewerEdit() {
            if (!ui.actorViewer.actor) return;
            ui.actorViewer.draft = utils.deepClone(ui.actorViewer.actor);
            ui.actorViewer.isEditing = true;
        }

        // 新增：取消编辑生物详情
        function cancelActorViewerEdit() {
            ui.actorViewer.isEditing = false;
            ui.actorViewer.draft = null;
        }

        // 新增：保存生物详情的更改
        function saveActorViewerChanges() {
            if (!ui.actorViewer.actor || !ui.actorViewer.draft) return;
            
            // 使用 Object.assign 高效合并更改
            Object.assign(ui.actorViewer.actor, ui.actorViewer.draft);

            // 确保当前HP不超过新的HP上限
            ui.actorViewer.actor.hpCurrent = Math.min(ui.actorViewer.actor.hpCurrent, ui.actorViewer.actor.hpMax);
            
            toast(`${ui.actorViewer.actor.name} 的临时数据已更新`);
            cancelActorViewerEdit(); // 保存后重置状态
        }

        // Monster CRUD
        function openMonsterEditor(m = null) {
            const draft = utils.deepClone(m || emptyMonster()); // MODIFIED
            draft.isCustom = !!draft.isCustom;
            uiState.monsterDraft = draft;
            uiState.targetCR = draft.cr;
            ui.monsterEditor.mode = m ? 'view' : 'edit';
            ui.activeEditor = 'monster';
            ui.monsterEditor.open = true;
        }
        async function updateMonster() {
            const draft = utils.deepClone(uiState.monsterDraft); // MODIFIED
            if (!draft.id) {
                toast('错误：该怪物没有ID，无法更新。请使用“另存为”');
                return;
            }
            if (draft.name) {
                await db.monsters.put(draft);
                await loadAll();
                ui.monsterEditor.open = false;
                toast('怪物数据已更新');
            } else {
                toast('名称不能为空');
            }
        }
        async function saveMonsterAsNew() {
            const draft = utils.deepClone(uiState.monsterDraft); // MODIFIED
            draft.isCustom = true;
            draft.id = undefined;
            if (draft.name) {
                await db.monsters.add(draft);
                await loadAll();
                ui.monsterEditor.open = false;
                toast('已保存为自定义怪物');
            } else {
                toast('名称不能为空');
            }
        }
        async function duplicateMonster(m) {
            const copy = utils.deepClone(m); // MODIFIED
            copy.id = undefined;
            copy.name = m.name + '（副本）';
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

        // PC CRUD
        function openPCEditor(pc = null) {
            if (pc) {
                const draft = utils.deepClone(pc); // MODIFIED
                draft.isDefault = pc.isDefault || false;
                if (!draft.actions) draft.actions = [];
                if (!draft.features) draft.features = '';
                if (!draft.resistances) draft.resistances = { damage: [], conditions: [] };
                if (!draft.vulnerabilities) draft.vulnerabilities = { damage: [], conditions: [] };
                if (!draft.immunities) draft.immunities = { damage: [], conditions: [] };
                uiState.pcDraft = draft;
                ui.pcEditor.mode = 'view';
            } else {
                uiState.pcDraft = {
                    name: '', avatar: '', ac: 14, hpMax: 20, hpCurrent: 20,
                    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                    actions: [], features: '',
                    resistances: { damage: [], conditions: [] }, vulnerabilities: { damage: [], conditions: [] }, immunities: { damage: [], conditions: [] },
                    isDefault: false,
                    backgroundImage: '',
                };
                ui.pcEditor.mode = 'edit';
            }
            ui.activeEditor = 'pc';
            ui.pcEditor.open = true;
        }
        async function savePC() {
            const draft = utils.deepClone(uiState.pcDraft); // MODIFIED
            if (!draft.name) {
                toast('请填写名称');
                return;
            }
            if (draft.id) {
                await db.pcs.put(draft);
            } else {
                draft.id = undefined;
                await db.pcs.add(draft);
            }
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

        // Ability & Action Libraries
        function openAbilityPool() {
            ui.abilityPool.nested = ui.monsterEditor.open || ui.pcEditor.open || ui.actionsViewer.open;
            ui.abilityPool.open = true;
        }
        function openAbilityEditor(ab = null) {
            ui.abilityEditor.nested = ui.abilityPool.open;
            uiState.abilityDraft = ab ? utils.deepClone(ab) : { name: '', description: '' }; // MODIFIED
            ui.abilityEditor.open = true;
        }
        async function saveAbility() {
            const ab = utils.deepClone(uiState.abilityDraft); // MODIFIED
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
            uiState.monsterDraft.actions = uiState.monsterDraft.actions || [];
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
            draft.actions = draft.actions || [];
            const actionCopy = utils.deepClone(action); // MODIFIED
            delete actionCopy.id;
            draft.actions.push(actionCopy);
            toast(`已将动作添加到当前${ui.activeEditor === 'pc' ? 'PC' : '怪物'}`);
            ui.actionPool.open = false;
        }
        function openActionsViewer(draft) {
            ui.actionsViewer.draft = draft;
            ui.actionsViewer.title = `管理 ${draft.name} 的动作`;
            ui.actionsViewer.open = true;
        }
        function openActionEditor(action = null) {
            ui.actionEditor.nested = false;
            if (action) {
                const draft = utils.deepClone(action); // MODIFIED
                if (draft.damageDice && !draft.damages) {
                    draft.damages = [{ dice: draft.damageDice, type: draft.damageType, id: crypto.randomUUID() }];
                    delete draft.damageDice;
                    delete draft.damageType;
                }
                if (!draft.damages || draft.damages.length === 0) {
                    draft.damages = [{ dice: '', type: '斩击', id: crypto.randomUUID() }];
                } else {
                    draft.damages.forEach(d => d.id = d.id || crypto.randomUUID());
                }
                uiState.actionDraft = draft;
            } else {
                uiState.actionDraft = {
                    name: '新动作', type: 'attack', attackBonus: 4, range: '近战',
                    damages: [{ dice: '1d6+2', type: '斩击', id: crypto.randomUUID() }],
                    recharge: 0, saveAbility: 'dex', saveDC: 13, onSuccess: 'half',
                    onHitStatus: '', onHitStatusRounds: 1, onHitSaveAbility: 'dex', onHitSaveDC: 13,
                };
            }
            ui.actionEditor.saveTarget = 'global';
            ui.actionEditor.open = true;
        }
        function openActionEditorForDraft(action = null) {
            ui.actionEditor.nested = true;
            if (action) {
                const draft = utils.deepClone(action); // MODIFIED
                if (!draft.damages || draft.damages.length === 0) {
                    draft.damages = [{ dice: '', type: '斩击', id: crypto.randomUUID() }];
                } else {
                    draft.damages.forEach(d => d.id = d.id || crypto.randomUUID());
                }
                uiState.actionDraft = draft;
            } else {
                uiState.actionDraft = {
                    id: crypto.randomUUID(), name: '新动作', type: 'attack', attackBonus: 4, range: '近战',
                    damages: [{ dice: '1d6+2', type: '斩击', id: crypto.randomUUID() }],
                    recharge: 0, saveAbility: 'dex', saveDC: 13, onSuccess: 'half',
                };
            }
            ui.actionEditor.saveTarget = 'private';
            ui.actionEditor.open = true;
        }
        async function saveAction() {
            const draft = utils.deepClone(uiState.actionDraft); // MODIFIED
            if (!draft.name) return toast('请填写名称');

            if (ui.actionEditor.saveTarget === 'private') {
                const creatureDraft = ui.actionsViewer.draft;
                if (creatureDraft && creatureDraft.actions) {
                    const actionIndex = creatureDraft.actions.findIndex(a => a.id === draft.id);
                    if (actionIndex > -1) {
                        creatureDraft.actions[actionIndex] = draft;
                    } else {
                        creatureDraft.actions.push(draft);
                    }
                    toast('私有动作已保存');
                }
            } else {
                if (draft.id && typeof draft.id === 'number') {
                    await db.actions.put(draft);
                } else {
                    delete draft.id;
                    await db.actions.add(draft);
                }
                await loadAll();
                toast('公共动作已保存');
            }
            ui.actionEditor.open = false;
        }
        function addDamageToActionDraft() {
            if (uiState.actionDraft && uiState.actionDraft.damages) {
                uiState.actionDraft.damages.push({
                    dice: '', type: '斩击', id: crypto.randomUUID()
                });
            }
        }
        async function deleteAction(id) {
            if (!confirm('确认删除该动作？')) return;
            await db.actions.delete(id);
            actions.value = await db.actions.toArray();
            toast('已删除');
        }

        // CR Adjustment
        function autoAdjustCR() {
            // NOTE: unbindProxy is replaced by utils.deepClone for consistency
            const adjusted = utils.adjustMonsterToCR(utils.deepClone(uiState.monsterDraft), uiState.targetCR); // MODIFIED
            uiState.monsterDraft = adjusted;
            toast('已按占位规则调整（TODO：替换为正式智能规则表）');
        }

        // Battle Management
        async function resetBattle() {
            if (!confirm('确定要初始化战斗吗？当前战场将被清空，并自动载入所有默认参战单位。')) return;
            battle.participants = [];
            battle.round = 1;
            battle.currentIndex = 0;
            localStorage.removeItem('dnd-battle-state');
            ui.log = '战斗已初始化。';
            const defaultMonsters = monsters.value.filter(m => m.isDefault);
            const defaultPcs = pcs.value.filter(pc => pc.isDefault);
            defaultMonsters.forEach(monster => {
                battle.participants.push(standardizeToParticipant(monster));
            });
            defaultPcs.forEach(pc => {
                battle.participants.push(standardizeToParticipant(pc));
            });
            toast(`初始化完成，已自动加入 ${battle.participants.length} 个默认单位。`);
        }
        function standardizeToParticipant(x) {
            const uid = crypto.randomUUID();
            const isPc = !!x.hpMax;
            return {
                uid, baseId: x.id || null, name: x.name, type: isPc ? 'pc' : 'monster',
                avatar: x.avatar || (x.type?.includes?.('dragon') ? '🐲' : (isPc ? '🧝' : '👾')),
                ac: x.ac || 12,
                hpMax: x.hpMax || x.hp?.average || 10,
                hpCurrent: x.hpCurrent || x.hp?.average || 10,
                abilities: x.abilities || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                resistances: utils.deepClone(x.resistances || { damage: [], conditions: [] }), // MODIFIED
                vulnerabilities: utils.deepClone(x.vulnerabilities || { damage: [], conditions: [] }), // MODIFIED
                immunities: utils.deepClone(x.immunities || { damage: [], conditions: [] }), // MODIFIED
                actions: utils.deepClone(x.actions || []).map(a => ({ ...a, cooldown: 0 })), // MODIFIED
                statuses: [], initiative: null, cr: x.cr, speed: x.speed,
                monsterType: x.type, features: x.features, backgroundImage: x.backgroundImage,
            };
        }
        
        // 核心修改点 1: 创建新的统一添加函数
        function addParticipantAndProcessInitiative(participant) {
            // 通过检查场上第一个单位是否有先攻值，来判断战斗是否已开始
            const isBattleInProgress = battle.participants.length > 0 && battle.participants[0].initiative !== null;

            if (isBattleInProgress) {
                // 战斗已开始：自动投骰并排序
                const init = utils.rollSingleInitiative(participant);
                Object.assign(participant, init); // 将投骰结果合并到 participant 对象

                // 添加一个用完即弃的临时标记，用于处理首回合跳过逻辑
                participant.justJoined = true;
                
                battle.participants.push(participant);

                // 采用 push + sort 的方式，保证排序的绝对可靠性
                battle.participants.sort((a, b) => {
                    const aNatural20 = a.initiativeRoll === 20;
                    const bNatural20 = b.initiativeRoll === 20;
                    if (aNatural20 && !bNatural20) return -1;
                    if (!aNatural20 && bNatural20) return 1;
                    if (aNatural20 && bNatural20) return (b.initiativeModifier || 0) - (a.initiativeModifier || 0);
                    return (b.initiative || 0) - (a.initiative || 0);
                });
                
                // 可选但推荐：更新当前行动者索引，防止排序后高亮目标错乱
                if (currentActor.value) {
                    const newIdx = battle.participants.findIndex(p => p.uid === currentActor.value.uid);
                    if (newIdx !== -1) battle.currentIndex = newIdx;
                }
            } else {
                // 战斗未开始：直接添加，等待手动掷先攻
                battle.participants.push(participant);
            }
        }
        
        function addToBattleFromEditor(entity, type) {
            const p = standardizeToParticipant(entity);
            addParticipantAndProcessInitiative(p); // <-- 调用新函数
            if (type === 'monster') ui.monsterEditor.open = false;
            else if (type === 'pc') ui.pcEditor.open = false;
            route.value = 'battle';
            toast(`${p.name} 已加入战斗`);
        }
        function addToBattleFromMonster(m) {
            addParticipantAndProcessInitiative(standardizeToParticipant(m)); // <-- 调用新函数
            route.value = 'battle';
            toast('已加入战斗');
        }
        function addToBattleFromPC(pc) {
            addParticipantAndProcessInitiative(standardizeToParticipant(pc)); // <-- 调用新函数
            route.value = 'battle';
            toast('已加入战斗');
        }
        function promptAddParticipants() {
            ui.addParticipants.open = true;
        }
        function addParticipantsFromMonster(m, count = 1) {
            for (let i = 0; i < count; i++) {
                const p = standardizeToParticipant(m);
                if (count > 1) p.name = `${m.name} #${i + 1}`;
                addParticipantAndProcessInitiative(p); // <-- 调用新函数
            }
            toast('怪物已加入');
        }
        function addParticipantsFromPC(pc) {
            addParticipantAndProcessInitiative(standardizeToParticipant(pc)); // <-- 调用新函数
            toast('PC已加入');
        }

        // Image Cropping (No changes needed here, as it's self-contained logic)
        // DOM 引用
        const cropperCanvas = ref(null);
        const cropperModal = ref(null);
        const avatarCropperCanvas = ref(null);
        const avatarCropperModal = ref(null);
        
        // 背景裁剪器 (Background Cropper) 状态
        let bgCropBox = reactive({ x: 50, y: 50, width: 200, height: 200 });
        let isBgDragging = false;
        let bgDragStart = { x: 0, y: 0 };
        const bgSourceImage = ref(null);
        
        // 头像裁剪器 (Avatar Cropper) 状态
        let avatarCropBox = reactive({ x: 50, y: 50, width: 200, height: 200 });
        let isAvatarDragging = false;
        let avatarDragStart = { x: 0, y: 0 };
        const avatarSourceImage = ref(null);
        function onBgImageSelect(e) {
            const file = e.target.files[0];
            if (!file) {
                return;
            }
            
            // 验证文件类型
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                toast('错误：不支持的文件格式。请使用 JPG、PNG、GIF 或 WebP 格式的图片。');
                e.target.value = '';
                return;
            }
            
            // 验证文件大小 (限制为10MB)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                toast('错误：图片文件过大。请选择小于 10MB 的图片。');
                e.target.value = '';
                return;
            }
            
            // 验证文件内容
            if (file.size === 0) {
                toast('错误：图片文件为空，请选择有效的图片文件。');
                e.target.value = '';
                return;
            }
            
            const reader = new FileReader();
            
            reader.onerror = () => {
                console.error("文件读取失败:", file.name);
                toast('错误：无法读取文件，请尝试其他图片。');
                e.target.value = '';
            };
            
            reader.onload = (event) => {
                try {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:681',message:'背景图片FileReader.onload触发',data:{hasResult:!!event.target?.result,resultLength:event.target?.result?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                    // #endregion
                    // 验证读取结果
                    if (!event.target?.result) {
                        // #region agent log
                        fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:686',message:'背景图片读取结果为空',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                        // #endregion
                        toast('错误：图片读取失败，请重试。');
                        e.target.value = '';
                        return;
                    }
                    
                    // 设置图片URL并打开裁剪器
                    ui.imageCropper.imageUrl = event.target.result;
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:692',message:'背景图片URL已设置，准备打开模态框',data:{imageUrlLength:ui.imageCropper.imageUrl?.length,imageUrlPrefix:ui.imageCropper.imageUrl?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                    // #endregion
                    console.log("背景图片URL已设置:", ui.imageCropper.imageUrl?.substring(0, 50) + "...");
                    ui.imageCropper.open = true;
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:693',message:'背景图片模态框已打开',data:{isOpen:ui.imageCropper.open},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                    // #endregion
                } catch (error) {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:695',message:'背景图片处理异常',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                    // #endregion
                    console.error("处理图片时发生错误:", error);
                    toast('错误：处理图片时发生错误，请重试。');
                    e.target.value = '';
                }
            };
            
            reader.readAsDataURL(file);
            e.target.value = '';
        }
        // 带重试机制的背景裁剪器初始化
        function initCropperWithRetry(retryCount = 0) {
            const maxRetries = 5;
            const retryDelay = 100; // 100ms
            
            const canvas = cropperCanvas.value;
            const modal = cropperModal.value;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:705',message:'背景裁剪器重试检查DOM',data:{retryCount,hasCanvas:!!canvas,hasModal:!!modal,imageUrl:ui.imageCropper.imageUrl?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            if (!canvas || !modal) {
                if (retryCount < maxRetries) {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:713',message:'背景裁剪器DOM未找到，准备重试',data:{retryCount,nextRetry:retryCount+1},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                    // #endregion
                    console.warn(`背景裁剪器DOM元素未找到，正在重试 (${retryCount + 1}/${maxRetries})`);
                    setTimeout(() => initCropperWithRetry(retryCount + 1), retryDelay * (retryCount + 1));
                } else {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:717',message:'背景裁剪器DOM未找到，达到最大重试次数',data:{retryCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                    // #endregion
                    console.error("背景裁剪器Canvas未找到，已达到最大重试次数");
                    toast("错误：裁剪器初始化失败，请刷新页面后重试。");
                    ui.imageCropper.open = false;
                }
                return;
            }
            
            // DOM元素已找到，继续正常初始化
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:725',message:'背景裁剪器DOM找到，调用initCropper',data:{retryCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            initCropper();
        }
        
        function initCropper() {
            const canvas = cropperCanvas.value;
            if (!canvas) {
                console.error("背景裁剪器Canvas未找到");
                toast("错误：裁剪器初始化失败，请重试。");
                return;
            }
            
            const ctx = canvas.getContext('2d');
            const img = new Image();
            bgSourceImage.value = img;
            
            img.onerror = (error) => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:740',message:'背景图片加载失败',data:{imageUrl:ui.imageCropper.imageUrl?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                console.error("背景图片加载失败:", ui.imageCropper.imageUrl, error);
                toast("图片加载失败，请检查文件格式或重试。");
                ui.imageCropper.open = false;
            };
            
            img.onabort = () => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:746',message:'背景图片加载被取消',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                console.warn("背景图片加载被取消:", ui.imageCropper.imageUrl);
                toast("图片加载被取消。");
                ui.imageCropper.open = false;
            };
            
            img.onload = () => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:752',message:'背景图片加载成功',data:{width:img.naturalWidth,height:img.naturalHeight,complete:img.complete},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                console.log("背景图片加载成功，尺寸:", img.naturalWidth, "x", img.naturalHeight);
                
                // 更严格的图片完整性检查
                if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
                    console.error("图片完整性检查失败:", { complete: img.complete, width: img.naturalWidth, height: img.naturalHeight });
                    toast('错误：图片文件无效或损坏，请尝试其他图片。');
                    ui.imageCropper.open = false;
                    return;
                }
                
                // 获取模态框宽度，添加更多安全检查
                const modalElement = cropperModal.value;
                const modalWidth = modalElement?.clientWidth || 680;
                
                // 确保Canvas有最小尺寸
                const minCanvasSize = 200;
                const maxCanvasWidth = Math.max(minCanvasSize, modalWidth - 24);
                const canvasWidth = Math.max(minCanvasSize, Math.min(img.naturalWidth, maxCanvasWidth));
                
                // 计算缩放比例和高度
                const scale = canvasWidth / img.naturalWidth;
                const canvasHeight = Math.max(minCanvasSize, img.naturalHeight * scale);
                
                // 设置Canvas尺寸
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                
                // 计算裁剪框尺寸和位置
                const boxWidth = canvasWidth * 0.8;
                const boxHeight = boxWidth / ui.imageCropper.aspectRatio;
                
                // 确保裁剪框不超出Canvas边界
                const maxBoxHeight = canvasHeight * 0.9;
                const finalBoxHeight = Math.min(boxHeight, maxBoxHeight);
                const finalBoxWidth = finalBoxHeight * ui.imageCropper.aspectRatio;
                
                bgCropBox.x = (canvasWidth - finalBoxWidth) / 2;
                bgCropBox.y = (canvasHeight - finalBoxHeight) / 2;
                bgCropBox.width = finalBoxWidth;
                bgCropBox.height = finalBoxHeight;
                
                // 绘制裁剪器
                console.log("开始绘制背景裁剪器");
                drawCropper(img);
            };
            
            // 设置图片源，确保URL有效
            if (!ui.imageCropper.imageUrl) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:800',message:'背景图片URL无效',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                toast("错误：没有有效的图片URL");
                ui.imageCropper.open = false;
                return;
            }
            
            console.log("开始加载背景图片，URL:", ui.imageCropper.imageUrl?.substring(0, 50) + "...");
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:807',message:'设置背景图片src',data:{imageUrlLength:ui.imageCropper.imageUrl?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            img.src = ui.imageCropper.imageUrl;
        }
        function drawCropper(img) {
            const canvas = cropperCanvas.value;
            if (!canvas) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:810',message:'drawCropper Canvas未找到',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                console.error("drawCropper: Canvas元素未找到");
                return;
            }
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:817',message:'drawCropper 无法获取Canvas上下文',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                console.error("drawCropper: 无法获取Canvas上下文");
                return;
            }
            
            console.log("drawCropper: Canvas尺寸:", canvas.width, "x", canvas.height);
            console.log("drawCropper: 裁剪框位置:", bgCropBox);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:822',message:'drawCropper 开始绘制',data:{canvasWidth:canvas.width,canvasHeight:canvas.height,cropBox:bgCropBox},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.clearRect(bgCropBox.x, bgCropBox.y, bgCropBox.width, bgCropBox.height);
            ctx.drawImage(img,
                (bgCropBox.x / canvas.width) * img.naturalWidth, (bgCropBox.y / canvas.height) * img.naturalHeight,
                (bgCropBox.width / canvas.width) * img.naturalWidth, (bgCropBox.height / canvas.height) * img.naturalHeight,
                bgCropBox.x, bgCropBox.y, bgCropBox.width, bgCropBox.height
            );
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2;
            ctx.strokeRect(bgCropBox.x, bgCropBox.y, bgCropBox.width, bgCropBox.height);
            
            console.log("drawCropper: 背景裁剪器绘制完成");
        }
        // 背景裁剪器拖动事件处理器
        function startBgDrag(e) {
            const canvas = e.target;
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            if (mouseX > bgCropBox.x && mouseX < bgCropBox.x + bgCropBox.width &&
                mouseY > bgCropBox.y && mouseY < bgCropBox.y + bgCropBox.height) {
                isBgDragging = true;
                bgDragStart.x = mouseX - bgCropBox.x;
                bgDragStart.y = mouseY - bgCropBox.y;
            }
        }
        function bgDrag(e) {
            if (isBgDragging) {
                const canvas = e.target;
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                bgCropBox.x = utils.clamp(mouseX - bgDragStart.x, 0, canvas.width - bgCropBox.width);
                bgCropBox.y = utils.clamp(mouseY - bgDragStart.y, 0, canvas.height - bgCropBox.height);
                drawCropper(bgSourceImage.value);
            }
        }
        function endBgDrag() {
            isBgDragging = false;
        }

        // 头像裁剪器拖动事件处理器
        function startAvatarDrag(e) {
            const canvas = e.target;
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            if (mouseX > avatarCropBox.x && mouseX < avatarCropBox.x + avatarCropBox.width &&
                mouseY > avatarCropBox.y && mouseY < avatarCropBox.y + avatarCropBox.height) {
                isAvatarDragging = true;
                avatarDragStart.x = mouseX - avatarCropBox.x;
                avatarDragStart.y = mouseY - avatarCropBox.y;
            }
        }
        function avatarDrag(e) {
            if (isAvatarDragging) {
                const canvas = e.target;
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                avatarCropBox.x = utils.clamp(mouseX - avatarDragStart.x, 0, canvas.width - avatarCropBox.width);
                avatarCropBox.y = utils.clamp(mouseY - avatarDragStart.y, 0, canvas.height - avatarCropBox.height);
                drawAvatarCropper(avatarSourceImage.value);
            }
        }
        function endAvatarDrag() {
            isAvatarDragging = false;
        }
        function confirmCrop() {
            // 更宽松的图片有效性检查
            if (!bgSourceImage.value) {
                toast('错误：没有选择图片，请重新上传。');
                ui.imageCropper.open = false;
                return;
            }
            
            if (!cropperCanvas.value) {
                toast('错误：裁剪器未初始化，请重试。');
                return;
            }
            
            // 检查图片是否加载完成
            if (!bgSourceImage.value.complete || bgSourceImage.value.naturalWidth === 0) {
                toast('错误：图片尚未加载完成，请稍后重试。');
                return;
            }
            
            try {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                // 修复缩放计算
                const scaleX = bgSourceImage.value.naturalWidth / cropperCanvas.value.width;
                const scaleY = bgSourceImage.value.naturalHeight / cropperCanvas.value.height;
                
                const sourceX = bgCropBox.x * scaleX;
                const sourceY = bgCropBox.y * scaleY;
                const sourceWidth = bgCropBox.width * scaleX;
                const sourceHeight = bgCropBox.height * scaleY;
                
                // 确保裁剪区域有效
                if (sourceWidth <= 0 || sourceHeight <= 0) {
                    toast('错误：裁剪区域无效，请调整裁剪框。');
                    return;
                }
                
                tempCanvas.width = sourceWidth;
                tempCanvas.height = sourceHeight;
                tempCtx.drawImage(bgSourceImage.value, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, sourceWidth, sourceHeight);
                
                // 根据当前编辑器类型设置背景图片
                const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.9);
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:939',message:'背景图片确认裁剪，数据URL生成',data:{dataUrlLength:dataUrl?.length,activeEditor:ui.activeEditor,dataUrlPrefix:dataUrl?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                // #endregion
                if (ui.activeEditor === 'monster') {
                    uiState.monsterDraft.backgroundImage = dataUrl;
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:941',message:'背景图片已赋值给monsterDraft',data:{hasBackgroundImage:!!uiState.monsterDraft.backgroundImage},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                    // #endregion
                } else if (ui.activeEditor === 'pc') {
                    uiState.pcDraft.backgroundImage = dataUrl;
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:943',message:'背景图片已赋值给pcDraft',data:{hasBackgroundImage:!!uiState.pcDraft.backgroundImage},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                    // #endregion
                }
                
                ui.imageCropper.open = false;
                toast('背景图片已更新');
            } catch (error) {
                console.error("裁剪过程中发生错误:", error);
                toast('错误：裁剪过程中发生错误，请重试。');
            }
        }
        function onAvatarImageSelect(e) {
            const file = e.target.files[0];
            if (!file) {
                return;
            }
            
            // 验证文件类型
            const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            if (!validTypes.includes(file.type)) {
                toast('错误：不支持的文件格式。请使用 JPG、PNG、GIF 或 WebP 格式的图片。');
                e.target.value = '';
                return;
            }
            
            // 验证文件大小 (限制为5MB，头像通常较小)
            const maxSize = 5 * 1024 * 1024; // 5MB
            if (file.size > maxSize) {
                toast('错误：头像图片文件过大。请选择小于 5MB 的图片。');
                e.target.value = '';
                return;
            }
            
            // 验证文件内容
            if (file.size === 0) {
                toast('错误：头像图片文件为空，请选择有效的图片文件。');
                e.target.value = '';
                return;
            }
            
            const reader = new FileReader();
            
            reader.onerror = () => {
                console.error("头像文件读取失败:", file.name);
                toast('错误：无法读取头像文件，请尝试其他图片。');
                e.target.value = '';
            };
            
            reader.onload = (event) => {
                try {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:990',message:'头像图片FileReader.onload触发',data:{hasResult:!!event.target?.result,resultLength:event.target?.result?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                    // #endregion
                    // 验证读取结果
                    if (!event.target?.result) {
                        // #region agent log
                        fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:993',message:'头像图片读取结果为空',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                        // #endregion
                        toast('错误：头像读取失败，请重试。');
                        e.target.value = '';
                        return;
                    }
                    
                    // 设置图片URL并打开裁剪器
                    ui.avatarCropper.imageUrl = event.target.result;
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1000',message:'头像图片URL已设置，准备打开模态框',data:{imageUrlLength:ui.avatarCropper.imageUrl?.length,imageUrlPrefix:ui.avatarCropper.imageUrl?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                    // #endregion
                    console.log("头像图片URL已设置:", ui.avatarCropper.imageUrl?.substring(0, 50) + "...");
                    ui.avatarCropper.open = true;
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1002',message:'头像图片模态框已打开',data:{isOpen:ui.avatarCropper.open},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                    // #endregion
                } catch (error) {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1004',message:'头像图片处理异常',data:{error:error.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                    // #endregion
                    console.error("处理头像时发生错误:", error);
                    toast('错误：处理头像时发生错误，请重试。');
                    e.target.value = '';
                }
            };
            
            reader.readAsDataURL(file);
            e.target.value = '';
        }
        // 带重试机制的头像裁剪器初始化
        function initAvatarCropperWithRetry(retryCount = 0) {
            const maxRetries = 5;
            const retryDelay = 100; // 100ms
            
            const canvas = avatarCropperCanvas.value;
            const modal = avatarCropperModal.value;
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1014',message:'头像裁剪器重试检查DOM',data:{retryCount,hasCanvas:!!canvas,hasModal:!!modal,imageUrl:ui.avatarCropper.imageUrl?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            if (!canvas || !modal) {
                if (retryCount < maxRetries) {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1022',message:'头像裁剪器DOM未找到，准备重试',data:{retryCount,nextRetry:retryCount+1},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                    // #endregion
                    console.warn(`头像裁剪器DOM元素未找到，正在重试 (${retryCount + 1}/${maxRetries})`);
                    setTimeout(() => initAvatarCropperWithRetry(retryCount + 1), retryDelay * (retryCount + 1));
                } else {
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1026',message:'头像裁剪器DOM未找到，达到最大重试次数',data:{retryCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
                    // #endregion
                    console.error("头像裁剪器Canvas未找到，已达到最大重试次数");
                    toast("错误：头像裁剪器初始化失败，请刷新页面后重试。");
                    ui.avatarCropper.open = false;
                }
                return;
            }
            
            // DOM元素已找到，继续正常初始化
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1034',message:'头像裁剪器DOM找到，调用initAvatarCropper',data:{retryCount},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            initAvatarCropper();
        }
        
        function initAvatarCropper() {
            const canvas = avatarCropperCanvas.value;
            if (!canvas) {
                console.error("头像裁剪器Canvas未找到");
                toast("错误：头像裁剪器初始化失败，请重试。");
                return;
            }
            
            const ctx = canvas.getContext('2d');
            const img = new Image();
            avatarSourceImage.value = img;
            
            img.onerror = (error) => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1049',message:'头像图片加载失败',data:{imageUrl:ui.avatarCropper.imageUrl?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                console.error("头像图片加载失败:", ui.avatarCropper.imageUrl, error);
                toast("头像图片加载失败，请检查文件格式或重试。");
                ui.avatarCropper.open = false;
            };
            
            img.onabort = () => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1055',message:'头像图片加载被取消',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                console.warn("头像图片加载被取消:", ui.avatarCropper.imageUrl);
                toast("头像图片加载被取消。");
                ui.avatarCropper.open = false;
            };
            
            img.onload = () => {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1061',message:'头像图片加载成功',data:{width:img.naturalWidth,height:img.naturalHeight,complete:img.complete},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
                // #endregion
                console.log("头像图片加载成功，尺寸:", img.naturalWidth, "x", img.naturalHeight);
                
                // 更严格的图片完整性检查
                if (!img.complete || img.naturalWidth <= 0 || img.naturalHeight <= 0) {
                    console.error("头像图片完整性检查失败:", { complete: img.complete, width: img.naturalWidth, height: img.naturalHeight });
                    toast('错误：头像图片文件无效或损坏，请尝试其他图片。');
                    ui.avatarCropper.open = false;
                    return;
                }
                
                // 获取模态框宽度，添加更多安全检查
                const modalElement = avatarCropperModal.value;
                const modalWidth = modalElement?.clientWidth || 680;
                
                // 确保Canvas有最小尺寸
                const minCanvasSize = 200;
                const maxCanvasWidth = Math.max(minCanvasSize, modalWidth - 24);
                const canvasWidth = Math.max(minCanvasSize, Math.min(img.naturalWidth, maxCanvasWidth));
                
                // 计算缩放比例和高度
                const scale = canvasWidth / img.naturalWidth;
                const canvasHeight = Math.max(minCanvasSize, img.naturalHeight * scale);
                
                // 设置Canvas尺寸
                canvas.width = canvasWidth;
                canvas.height = canvasHeight;
                
                // 计算圆形裁剪框尺寸 - 确保正方形
                const canvasMinDimension = Math.min(canvasWidth, canvasHeight);
                const boxSize = canvasMinDimension * 0.8;
                
                // 确保圆形裁剪框不超出边界
                const maxBoxSize = canvasMinDimension * 0.9;
                const finalBoxSize = Math.min(boxSize, maxBoxSize);
                
                avatarCropBox.x = (canvasWidth - finalBoxSize) / 2;
                avatarCropBox.y = (canvasHeight - finalBoxSize) / 2;
                avatarCropBox.width = finalBoxSize;
                avatarCropBox.height = finalBoxSize;
                
                // 绘制圆形裁剪器
                console.log("开始绘制头像裁剪器");
                drawAvatarCropper(img);
            };
            
            // 设置图片源，确保URL有效
            if (!ui.avatarCropper.imageUrl) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1108',message:'头像图片URL无效',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
                // #endregion
                toast("错误：没有有效的头像图片URL");
                ui.avatarCropper.open = false;
                return;
            }
            
            console.log("开始加载头像图片，URL:", ui.avatarCropper.imageUrl?.substring(0, 50) + "...");
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1115',message:'设置头像图片src',data:{imageUrlLength:ui.avatarCropper.imageUrl?.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
            // #endregion
            img.src = ui.avatarCropper.imageUrl;
        }
        function drawAvatarCropper(img) {
            const canvas = avatarCropperCanvas.value;
            if (!canvas) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1118',message:'drawAvatarCropper Canvas未找到',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                console.error("drawAvatarCropper: Canvas元素未找到");
                return;
            }
            
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1124',message:'drawAvatarCropper 无法获取Canvas上下文',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
                // #endregion
                console.error("drawAvatarCropper: 无法获取Canvas上下文");
                return;
            }
            
            console.log("drawAvatarCropper: Canvas尺寸:", canvas.width, "x", canvas.height);
            console.log("drawAvatarCropper: 裁剪框位置:", avatarCropBox);
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1130',message:'drawAvatarCropper 开始绘制',data:{canvasWidth:canvas.width,canvasHeight:canvas.height,cropBox:avatarCropBox},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
            // #endregion
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarCropBox.x + avatarCropBox.width / 2, avatarCropBox.y + avatarCropBox.height / 2, avatarCropBox.width / 2, 0, Math.PI * 2, true);
            ctx.clip();
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            ctx.restore();
            ctx.beginPath();
            ctx.arc(avatarCropBox.x + avatarCropBox.width / 2, avatarCropBox.y + avatarCropBox.height / 2, avatarCropBox.width / 2, 0, Math.PI * 2, true);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            console.log("drawAvatarCropper: 头像裁剪器绘制完成");
        }
        function confirmAvatarCrop() {
            // 更宽松的图片有效性检查
            if (!avatarSourceImage.value) {
                toast('错误：没有选择头像，请重新上传。');
                ui.avatarCropper.open = false;
                return;
            }
            
            if (!avatarCropperCanvas.value) {
                toast('错误：头像裁剪器未初始化，请重试。');
                return;
            }
            
            // 检查图片是否加载完成
            if (!avatarSourceImage.value.complete || avatarSourceImage.value.naturalWidth === 0) {
                toast('错误：头像图片尚未加载完成，请稍后重试。');
                return;
            }
            
            try {
                const tempCanvas = document.createElement('canvas');
                const tempCtx = tempCanvas.getContext('2d');
                
                // 修复缩放计算
                const scaleX = avatarSourceImage.value.naturalWidth / avatarCropperCanvas.value.width;
                const scaleY = avatarSourceImage.value.naturalHeight / avatarCropperCanvas.value.height;
                
                const sourceX = avatarCropBox.x * scaleX;
                const sourceY = avatarCropBox.y * scaleY;
                const sourceWidth = avatarCropBox.width * scaleX;
                const sourceHeight = avatarCropBox.height * scaleY;
                
                // 确保裁剪区域有效
                if (sourceWidth <= 0 || sourceHeight <= 0) {
                    toast('错误：头像裁剪区域无效，请调整裁剪框。');
                    return;
                }
                
                // 设置临时Canvas为正方形
                const size = Math.min(sourceWidth, sourceHeight);
                tempCanvas.width = size;
                tempCanvas.height = size;
                
                // 创建圆形裁剪
                tempCtx.beginPath();
                tempCtx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2, true);
                tempCtx.clip();
                
                // 计算居中位置
                const offsetX = (sourceWidth - size) / 2;
                const offsetY = (sourceHeight - size) / 2;
                
                // 绘制圆形头像
                tempCtx.drawImage(
                    avatarSourceImage.value,
                    sourceX + offsetX, sourceY + offsetY, size, size,
                    0, 0, size, size
                );
                
                const dataUrl = tempCanvas.toDataURL('image/png');
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1210',message:'头像确认裁剪，数据URL生成',data:{dataUrlLength:dataUrl?.length,activeEditor:ui.activeEditor,dataUrlPrefix:dataUrl?.substring(0,50)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                // #endregion
                
                // 根据当前编辑器类型设置头像
                if (ui.activeEditor === 'monster') {
                    uiState.monsterDraft.avatar = dataUrl;
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1214',message:'头像已赋值给monsterDraft',data:{hasAvatar:!!uiState.monsterDraft.avatar},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                    // #endregion
                } else if (ui.activeEditor === 'pc') {
                    uiState.pcDraft.avatar = dataUrl;
                    // #region agent log
                    fetch('http://127.0.0.1:7242/ingest/c6cc19f4-976a-48c1-88c6-e3531de35a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'main.js:1216',message:'头像已赋值给pcDraft',data:{hasAvatar:!!uiState.pcDraft.avatar},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
                    // #endregion
                }
                
                ui.avatarCropper.open = false;
                toast('头像已更新');
            } catch (error) {
                console.error("头像裁剪过程中发生错误:", error);
                toast('错误：头像裁剪过程中发生错误，请重试。');
            }
        }

        // Turn & Initiative
        function rollInitiative() {
            for (const p of battle.participants) {
                const initResult = utils.rollSingleInitiative(p);
                Object.assign(p, initResult);
                delete p.justJoined; // <-- 新增: 确保全体重投时清除所有临时标记
            }
            battle.participants.sort((a, b) => {
                const aNatural20 = a.initiativeRoll === 20;
                const bNatural20 = b.initiativeRoll === 20;
                if (aNatural20 && !bNatural20) return -1;
                else if (!aNatural20 && bNatural20) return 1;
                else if (aNatural20 && bNatural20) return (b.initiativeModifier || 0) - (a.initiativeModifier || 0);
                else return (b.initiative || 0) - (a.initiative || 0);
            });
            battle.currentIndex = 0;
            battle.round = 1;
            toast('已掷先攻并排序');
        }
        function setCurrentActor(uid) {
            const idx = battle.participants.findIndex(p => p.uid === uid);
            if (idx >= 0) battle.currentIndex = idx;
        }
        function nextTurn() {
            if (!battle.participants.length) return;
            
            // 新增逻辑：在所有操作前，检查当前行动者是否是刚加入的
            const actor = currentActor.value;
            if (actor && actor.justJoined) {
                delete actor.justJoined; // 移除标记，此逻辑只触发一次
                toast(`【${actor.name}】在本轮加入，其首个回合将被跳过。`);
                
                // 立即进入下一回合，实现跳过效果
                battle.currentIndex++;
                if (battle.currentIndex >= battle.participants.length) {
                    battle.currentIndex = 0;
                    battle.round++;
                }
                // 为新的当前行动者结算状态和冷却
                if (currentActor.value) {
                    decrementParticipantStatuses(currentActor.value);
                    decrementActionCooldowns(currentActor.value);
                }
                return; // 提前结束本次函数执行，因为已经处理了回合推进
            }

            // 原有的 nextTurn 逻辑
            const activeParticipant = currentActor.value;
            let participantWasRemoved = false;
            if (activeParticipant && activeParticipant.hpCurrent <= 0 && activeParticipant.type === 'monster') {
                const deadMonsterName = activeParticipant.name;
                removeParticipant(activeParticipant.uid);
                toast(`怪物【${deadMonsterName}】已在回合结束后移除。`);
                participantWasRemoved = true;
            }
            if (!participantWasRemoved) {
                battle.currentIndex++;
            }
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
        function decrementParticipantStatuses(participant) {
            participant.statuses = participant.statuses.map(s => ({ ...s, rounds: s.rounds - 1 })).filter(s => s.rounds > 0);
        }
        function decrementActionCooldowns(participant) {
            if (!participant.actions) return;
            participant.actions.forEach(a => {
                if (a.cooldown > 0) a.cooldown--;
            });
        }
        function removeParticipant(uid) {
            const i = battle.participants.findIndex(p => p.uid === uid);
            if (i >= 0) {
                battle.participants.splice(i, 1);
                if (battle.currentIndex >= battle.participants.length) battle.currentIndex = 0;
            }
        }
        function onDragStart(idx) {
            battle.dragIndex = idx;
        }
        function onDrop(idx) {
            const from = battle.dragIndex;
            if (from == null) return;
            const item = battle.participants.splice(from, 1)[0];
            battle.participants.splice(idx, 0, item);
            battle.dragIndex = null;
        }

        // HP & Status Management
        function applyHPDelta(p, delta) {
            delta = Number(delta) || 0;
            if (delta === 0) return;
            p.hpCurrent = utils.clamp(p.hpCurrent + delta, 0, p.hpMax); // MODIFIED
            if (p.hpCurrent <= 0 && p.type === 'monster') {
                p.isDefeated = true;
                toast(`怪物【${p.name}】血量归零，将在回合结束后移除。`);
            }
        }
        function closeQuickDamageEditor() {
            ui.quickDamage.open = false;
        }
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
            if (typeof damageAmount !== 'number' || damageAmount <= 0) {
                closeQuickDamageEditor();
                return;
            }
            const target = battle.participants.find(p => p.uid === targetUid);
            if (target) {
                applyHPDelta(target, -Math.abs(damageAmount));
            }
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

        // Targeting
        function toggleTarget(uid) {
            const i = ui.selectedTargets.indexOf(uid);
            if (i >= 0) ui.selectedTargets.splice(i, 1);
            else ui.selectedTargets.push(uid);
        }
        function toggleSelectGroup(g) {
            const ids = g.members.map(m => m.uid);
            const allIn = ids.every(id => ui.selectedTargets.includes(id));
            if (allIn) {
                ui.selectedTargets = ui.selectedTargets.filter(id => !ids.includes(id));
            } else {
                const set = new Set(ui.selectedTargets.concat(ids));
                ui.selectedTargets = Array.from(set);
            }
        }
        function selectNone() {
            ui.selectedTargets = [];
        }

        // Action Logic
        const promptSaveCheck = (target, action, onSaveFail) => {
            ui.saveCheck.targetName = target.name;
            ui.saveCheck.dc = action.onHitSaveDC;
            ui.saveCheck.ability = action.onHitSaveAbility;
            ui.saveCheck.callback = (saveSucceeded) => {
                if (!saveSucceeded) {
                    onSaveFail();
                }
                ui.log += `${target.name} 的 ${action.onHitSaveAbility.toUpperCase()} 豁免检定 (DC ${action.onHitSaveDC}) ${saveSucceeded ? '成功' : '失败'}.\n`;
                ui.saveCheck.open = false;
            };
            ui.saveCheck.open = true;
        };
        function selectAction(a) {
            ui.selectedAction = utils.deepClone(a); // MODIFIED
            ui.log = '已选择动作：' + a.name + '\n';
        }
        function calculateModifiedDamage(target, damageAmount, damageType) {
            if (target.immunities?.damage?.includes(damageType)) return 0;
            if (target.vulnerabilities?.damage?.includes(damageType)) return damageAmount * 2;
            if (target.resistances?.damage?.includes(damageType)) return Math.floor(damageAmount / 2);
            return damageAmount;
        }
        function runAction() {
            if (ui.actionOnCooldown) return;
            ui.actionOnCooldown = true;
            setTimeout(() => { ui.actionOnCooldown = false; }, 5000);

            const actor = currentActor.value;
            const action = ui.selectedAction;
            if (action.type === 'attack' && !action.damages && action.damageDice) {
                action.damages = [{ dice: action.damageDice, type: action.damageType || 'generic' }];
            } else if (action.type === 'save' && !action.damages && action.damageDice) {
                action.damages = [{ dice: action.damageDice, type: action.damageType || 'generic' }];
            }
            if (!actor || !action) return;
            const targets = battle.participants.filter(p => ui.selectedTargets.includes(p.uid));
            if (!targets.length) {
                toast('请先在右侧选择目标');
                return;
            }
            let log = `【${actor.name}】使用「${action.name}」对 ${targets.length} 个目标：\n`;
            if (action.type === 'attack') {
                for (const t of targets) {
                    const d20 = utils.rollD20(ui.rollMode); // MODIFIED
                    const toHit = d20.value + (action.attackBonus || 0);
                    const hit = (d20.value === 20) || (toHit >= t.ac);
                    log += `- 目标【${t.name}】 -> d20(${d20.raw.join(',')}) + ${action.attackBonus || 0} = ${toHit} vs AC ${t.ac} => ${d20.isCrit ? '重击' : (hit ? '命中' : '未命中')}\n`;
                    if (hit && !d20.isFumble) {
                        let allDamageDetails = [];
                        let totalFinalDamage = 0;

                        for (const damage of action.damages) {
                            if (!damage.dice) continue;
                            const dmgDetails = utils.rollDamageWithDetails(damage.dice, d20.isCrit, damage.type); // MODIFIED
                            const rawDmgAmount = dmgDetails.total;
                            const finalDmgAmount = calculateModifiedDamage(t, rawDmgAmount, damage.type);
                            totalFinalDamage += finalDmgAmount;

                            let modifier = '';
                            if (finalDmgAmount < rawDmgAmount) modifier = '抗性';
                            else if (finalDmgAmount > rawDmgAmount) modifier = '易伤';
                            else if (finalDmgAmount === 0 && rawDmgAmount > 0) modifier = '免疫';

                            allDamageDetails.push({
                                rawAmount: rawDmgAmount,
                                finalAmount: finalDmgAmount,
                                type: damage.type,
                                modifier: modifier
                            });
                        }

                        if (allDamageDetails.length > 0) {
                            if (d20.isCrit) {
                                ui.notificationQueue.push({
                                    type: 'crit',
                                    data: {
                                        type: 'success',
                                        attacker: actor.name, target: t.name,
                                        toHitRoll: `d20(${d20.raw.join(',')}) + ${action.attackBonus || 0}`,
                                        toHitResult: toHit, targetAC: t.ac,
                                        damages: allDamageDetails,
                                        totalFinalDamage: totalFinalDamage
                                    }
                                });
                            } else {
                                ui.notificationQueue.push({
                                    type: 'hit',
                                    data: {
                                        attacker: actor.name, target: t.name,
                                        toHitRoll: `d20(${d20.raw.join(',')}) + ${action.attackBonus || 0}`,
                                        toHitResult: toHit, targetAC: t.ac,
                                        damages: allDamageDetails,
                                        totalFinalDamage: totalFinalDamage
                                    }
                                });
                            }
                        }
                        
                        // 更新日志部分
                        let damageLogParts = [];
                        for (const detail of allDamageDetails) {
                            let partLog = `${detail.rawAmount} ${detail.type}`;
                            if (detail.finalAmount !== detail.rawAmount) partLog += ` (变为 ${detail.finalAmount})`;
                            damageLogParts.push(partLog);
                        }
                        log += ` 伤害: ${damageLogParts.join(' + ')} = 总计 ${totalFinalDamage} 伤害\n`;
                        if (ui.autoApplyDamage) {
                            t.hpCurrent = utils.clamp(t.hpCurrent - totalFinalDamage, 0, t.hpMax); // MODIFIED
                            log += ` 已自动扣血：-${totalFinalDamage}，剩余HP ${t.hpCurrent}\n`;
                        } else {
                            log += ` （未自动扣血）\n`;
                        }
                        if (action.onHitStatus) {
                            const applyStatus = () => {
                                const existingStatus = t.statuses.find(s => s.name === action.onHitStatus);
                                if (!existingStatus) {
                                    const statusInfo = statusCatalog.value.find(sc => sc.name === action.onHitStatus) || {};
                                    t.statuses.push({
                                        id: crypto.randomUUID(), name: action.onHitStatus,
                                        rounds: action.onHitStatusRounds || 1, icon: statusInfo.icon || '⏳'
                                    });
                                    log += `  -> ${t.name} 获得了状态: ${action.onHitStatus}.\n`;
                                }
                            };
                            if (action.onHitSaveAbility && action.onHitSaveDC) {
                                promptSaveCheck(t, action, applyStatus);
                            } else {
                                applyStatus();
                            }
                        }
                    } else if (!hit && !d20.isFumble) {
                        ui.notificationQueue.push({
                            type: 'miss',
                            data: {
                                attacker: actor.name, target: t.name, toHitRoll: `d20(${d20.raw.join(',')}) + ${action.attackBonus || 0}`,
                                toHitResult: toHit, targetAC: t.ac,
                            }
                        });
                    } else if (d20.isFumble) {
                        ui.notificationQueue.push({
                            type: 'crit',
                            data: {
                                type: 'failure',
                                attacker: actor.name,
                                target: t.name,
                                toHitRoll: `d20(${d20.raw.join(',')}) + ${action.attackBonus || 0}`,
                                toHitResult: toHit,
                                targetAC: t.ac,
                                damages: [],
                                totalFinalDamage: 0,
                            }
                        });
                    }
                }
                ui.log = log;
            } else if (action.type === 'save') {
                log += `发动范围效果: ${action.name} (DC ${action.saveDC} ${action.saveAbility?.toUpperCase()})\n`;
                const rolledDamages = [];
                for (const damage of action.damages) {
                    if (!damage.dice) continue;
                    const dmgResult = utils.rollDamage(damage.dice, false, damage.type); // MODIFIED
                    rolledDamages.push(...dmgResult);
                }
                log += `总潜在伤害: ${formatRolledDamages(rolledDamages)}\n`;
                ui.saveOutcomePicker.title = `处理 "${action.name}" 的豁免结果`;
                ui.saveOutcomePicker.action = utils.deepClone(action); // MODIFIED
                ui.saveOutcomePicker.targets = utils.deepClone(targets); // MODIFIED
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
                    log += `\n「${action.name}」进入冷却，${action.recharge}回合后可用。`;
                    ui.log = log;
                }
            }
            processNotificationQueue();
            selectNone();
        }
        function applySaveOutcomes() {
            const { targets, damages, outcomes, action } = ui.saveOutcomePicker;
            let log = `处理 "${action.name}" 的豁免结果：\n`;
            if (!targets.length) {
                ui.saveOutcomePicker.open = false;
                return;
            }
            const totalDamageByType = damages.reduce((acc, dmg) => {
                acc[dmg.type] = (acc[dmg.type] || 0) + dmg.amount;
                return acc;
            }, {});
            for (const tempTarget of targets) {
                const target = battle.participants.find(p => p.uid === tempTarget.uid);
                if (!target) continue;
                const outcome = outcomes[target.uid];
                let totalModifiedDamage = 0;
                let damageLogParts = [];
                for (const type in totalDamageByType) {
                    const rawAmount = totalDamageByType[type];
                    const modifiedAmount = calculateModifiedDamage(target, rawAmount, type);
                    if (modifiedAmount > 0) {
                        damageLogParts.push(`${modifiedAmount} ${type}`);
                    }
                    totalModifiedDamage += modifiedAmount;
                }
                let finalDamageToApply = 0;
                let outcomeText = '';
                switch (outcome) {
                    case 'fail': finalDamageToApply = totalModifiedDamage; outcomeText = '豁免失败'; break;
                    case 'half': finalDamageToApply = Math.ceil(totalModifiedDamage / 2); outcomeText = '伤害减半'; break;
                    case 'zero': finalDamageToApply = 0; outcomeText = '伤害全免'; break;
                }
                log += `- 目标【${target.name}】 -> ${outcomeText}，受到 ${finalDamageToApply} 点伤害 (${damageLogParts.join(' + ') || '无'}).\n`;
                if (ui.autoApplyDamage && finalDamageToApply > 0) {
                    applyHPDelta(target, -finalDamageToApply);
                    log += `  已自动扣血, 剩余 HP ${target.hpCurrent}.\n`;
                }
            }
            ui.log = log;
            ui.saveOutcomePicker.open = false;
            selectNone();
        }

        // Import / Export
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
            const text = await file.text();
            try {
                const data = JSON.parse(text);
                if (!data.monsters || !data.abilities || !data.pcs || !data.actions || !data.monsterGroups) throw new Error('格式不完整');
                if (!confirm('导入将清空并替换当前的怪物库、PC库、能力库、动作库和怪物组合。确定要继续吗？')) return;
                await db.transaction('rw', db.monsters, db.abilities, db.pcs, db.actions, db.monsterGroups, async () => {
                    await db.monsters.clear(); await db.abilities.clear(); await db.pcs.clear();
                    await db.actions.clear(); await db.monsterGroups.clear();
                    await db.monsters.bulkAdd(data.monsters); await db.abilities.bulkAdd(data.abilities);
                    await db.pcs.bulkAdd(data.pcs);
                    if (data.actions) await db.actions.bulkAdd(data.actions);
                    if (data.monsterGroups) await db.monsterGroups.bulkAdd(data.monsterGroups);
                });
                await loadAll();
                toast('导入成功');
            } catch (err) {
                alert('导入失败：' + err.message);
            } finally {
                e.target.value = '';
            }
        }

        // Monster Groups
        function openGroupManager() { ui.monsterGroupManager.open = true; }
        function openGroupEditor(group = null) {
            uiState.groupDraft = group ? utils.deepClone(group) : { name: '', monsters: [] }; // MODIFIED
            ui.monsterGroupEditor.keyword = '';
            ui.monsterGroupEditor.open = true;
        }
        function addMonsterToGroupDraft(monster) {
            const existing = uiState.groupDraft.monsters.find(m => m.monsterId === monster.id);
            if (existing) {
                existing.count++;
            } else {
                uiState.groupDraft.monsters.push({ monsterId: monster.id, name: monster.name, count: 1 });
            }
        }
        async function saveGroup() {
            const draft = utils.deepClone(uiState.groupDraft); // MODIFIED
            if (!draft.name || draft.monsters.length === 0) {
                toast('请填写组名并添加至少一个怪物');
                return;
            }
            draft.monsters = draft.monsters.filter(m => m.count >= 1);
            if (draft.id) {
                await db.monsterGroups.put(draft);
            } else {
                await db.monsterGroups.add(draft);
            }
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
            let addedCount = 0;
            for (const groupMonster of group.monsters) {
                const monsterTemplate = monsters.value.find(m => m.id === groupMonster.monsterId);
                if (monsterTemplate) {
                    for (let i = 0; i < groupMonster.count; i++) {
                        const p = standardizeToParticipant(monsterTemplate);
                        if (groupMonster.count > 1) {
                            p.name = `${monsterTemplate.name} #${i + 1}`;
                        }
                        addParticipantAndProcessInitiative(p); // <-- 调用新函数
                        addedCount++;
                    }
                }
            }
            toast(`已从组合 [${group.name}] 添加 ${addedCount} 个怪物`);
        }

        // Notifications & Quick Dice
        function dismissCurrentNotification() {
            ui.critNotification.open = false;
            ui.normalHitNotification.open = false;
            ui.missNotification.open = false;
            nextTick(() => { processNotificationQueue(); });
        }
        function processNotificationQueue() {
            if (ui.critNotification.open || ui.normalHitNotification.open || ui.missNotification.open || ui.notificationQueue.length === 0) {
                return;
            }
            const notification = ui.notificationQueue.shift();
            if (notification.type === 'crit') {
                Object.assign(ui.critNotification, notification.data);
                ui.critNotification.open = true;
            } else if (notification.type === 'hit') {
                Object.assign(ui.normalHitNotification, notification.data);
                ui.normalHitNotification.open = true;
            } else if (notification.type === 'miss') {
                Object.assign(ui.missNotification, notification.data);
                ui.missNotification.open = true;
            }
        }
        function openQuickDice() {
            ui.quickDice.expression = '';
            ui.quickDice.resultOpen = false;
            ui.quickDice.inputOpen = true;
            nextTick(() => { quickRollInput.value?.focus(); });
        }
        function executeQuickRoll() {
            if (!ui.quickDice.expression.trim()) return;
            const result = utils.rollExpression(ui.quickDice.expression); // MODIFIED
            ui.quickDice.result = result;
            ui.quickDice.inputOpen = false;
            ui.quickDice.resultOpen = true;
        }
        function selectActionFromViewer(action) {
            if (action.type !== 'attack' && action.type !== 'save') return;
            selectAction(action);
            ui.actorViewer.open = false;
        }

        // Global Event Listeners
        let lastDKeyPressTime = 0;
        let lastRightKeyPressTime = 0;
        let lastLeftKeyPressTime = 0;
        const handleGlobalKeyDown = (e) => {
            if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
            const now = Date.now();
            if (e.key.toLowerCase() === 'd') {
                if (now - lastDKeyPressTime < 400) { openQuickDice(); lastDKeyPressTime = 0; }
                else { lastDKeyPressTime = now; }
            } else if (e.key === 'ArrowRight') {
                if (now - lastRightKeyPressTime < 400) { nextTurn(); lastRightKeyPressTime = 0; }
                else { lastRightKeyPressTime = now; }
            } else if (e.key === 'ArrowLeft') {
                if (now - lastLeftKeyPressTime < 400) { prevTurn(); lastLeftKeyPressTime = 0; }
                else { lastLeftKeyPressTime = now; }
            }
        };
        window.addEventListener('keydown', handleGlobalKeyDown);

        // 5. 应用初始化逻辑
        async function initializeApp() {
            try {
                const savedState = localStorage.getItem('dnd-battle-state');
                if (savedState) {
                    const parsedState = JSON.parse(savedState);
                    Object.assign(battle, parsedState);
                }
            } catch (e) {
                console.error('Failed to load battle state from localStorage:', e);
                localStorage.removeItem('dnd-battle-state');
            }
            await seedIfEmpty();
            await loadAll();
        }
        initializeApp();

        // 6. 返回给模板的对象
        return {
            // State
            route, monsters, abilities, pcs, actions, monsterGroups, monsterFilters,
            battle, ui, uiState,
            // Constants
            monsterTypes, damageTypes, conditionTypes, crOptions, statusCatalog,
            // Local Refs & Computeds
            hpDelta, quickDamageInput, quickRollInput, participantTiles,
            currentActor, filteredMonsters, filteredAbilities, filteredActions, groupedParticipants,
            filteredMonstersForGroup, sortedCurrentActorActions, sortedActorViewerActions,
            sortedMonsterDraftActions, sortedPcDraftActions,
            // DOM Refs
            cropperCanvas, cropperModal, avatarCropperCanvas, avatarCropperModal,
            // Methods
            toast, removeToast, loadAll, seedDemo, toggleTypeFilter, toggleMonsterDraftType,
            toggleDamageModifier, toggleConditionImmunity, openActorViewer, startActorViewerEdit,
            cancelActorViewerEdit, saveActorViewerChanges, openMonsterEditor,
            updateMonster, saveMonsterAsNew, duplicateMonster, deleteMonster, openPCEditor,
            savePC, deletePC, openAbilityPool, openAbilityEditor, saveAbility, deleteAbility,
            attachAbilityToDraft, openActionPool, attachActionToDraft, openActionsViewer,
            openActionEditor, openActionEditorForDraft, saveAction, addDamageToActionDraft,
            deleteAction, autoAdjustCR, resetBattle, standardizeToParticipant, addToBattleFromEditor,
            addToBattleFromMonster, addToBattleFromPC, promptAddParticipants, addParticipantsFromMonster,
            addParticipantsFromPC, onBgImageSelect, initCropper, initCropperWithRetry, drawCropper, startBgDrag, bgDrag, endBgDrag,
            confirmCrop, onAvatarImageSelect, initAvatarCropper, initAvatarCropperWithRetry, drawAvatarCropper, startAvatarDrag, avatarDrag, endAvatarDrag, confirmAvatarCrop,
            rollInitiative, setCurrentActor, nextTurn, prevTurn, removeParticipant, onDragStart, onDrop,
            applyHPDelta, closeQuickDamageEditor, openQuickDamageEditor, applyQuickDamage, openHPEditor,
            openStatusPicker, applyStatus, removeStatus, toggleTarget, toggleSelectGroup, selectNone,
            promptSaveCheck, selectAction, calculateModifiedDamage, runAction, applySaveOutcomes,
            exportAll, importAll, openGroupManager, openGroupEditor, addMonsterToGroupDraft, saveGroup,
            deleteGroup, addParticipantsFromGroup, dismissCurrentNotification, processNotificationQueue,
            openQuickDice, executeQuickRoll, selectActionFromViewer,
            // Template Helpers
            formatDamages, formatRolledDamages,
            mod: (v) => utils.abilityMod(Number(v) || 10),
            translateType: (t) => monsterTypeTranslations[t] || t,
        }
    }
}).mount('#app');

document.body.classList.remove('loading');

