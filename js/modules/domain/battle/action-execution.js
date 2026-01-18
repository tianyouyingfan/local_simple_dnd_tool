/**
 * 动作执行核心模块
 */
import { nextTick } from 'vue';
import { battle, ui, uiState, currentActor, statusCatalog } from 'state'; // 导入 currentActor
import { deepClone, rollD20, rollDamage, rollDamageWithDetails, clamp } from 'utils';
import { useToasts } from 'use-toasts';
import { applyHPDelta } from 'hp-status';
import { selectNone } from 'targeting';
import {
    CONDITION_KEYS,
    collectAfterHitBeforeDamagePrompts,
    collectBeforeAttackPrompts,
    getAttackRollFlags,
    getConditionDefinition,
    getStatusIdentity,
    hasCondition,
    isActorIncapacitated,
    isSaveAutoFailTarget,
    normalizeStatusInstance
} from 'conditions';

const { toast } = useToasts();

export const promptSaveCheck = (target, action, onSaveFail) => {
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

export const promptBinary = ({ title, message, yesText, noText }) => new Promise((resolve) => {
    ui.binaryPrompt.title = title || '确认';
    ui.binaryPrompt.message = message || '';
    ui.binaryPrompt.yesText = yesText || '是';
    ui.binaryPrompt.noText = noText || '否';
    ui.binaryPrompt.callback = (result) => {
        ui.binaryPrompt.open = false;
        ui.binaryPrompt.callback = null;
        resolve(!!result);
    };
    ui.binaryPrompt.open = true;
});

export function selectAction(a) {
    ui.selectedAction = deepClone(a);
    ui.log = `已选择动作：${a.name}\n`;
}

export function calculateModifiedDamage(target, damageAmount, damageType) {
    if (target.immunities?.damage?.includes(damageType)) return 0;
    let result = damageAmount;
    if (target.vulnerabilities?.damage?.includes(damageType)) result *= 2;
    const petrifiedAllResist = hasCondition(target, CONDITION_KEYS.PETRIFIED);
    const hasResist = petrifiedAllResist || target.resistances?.damage?.includes(damageType);
    if (hasResist) result = Math.floor(result / 2);
    return result;
}

export function processNotificationQueue() {
    if (ui.critNotification.open || ui.normalHitNotification.open || ui.missNotification.open) return;
    if (ui.notificationQueue.length === 0) return;

    const n = ui.notificationQueue.shift();
    if (n.type === 'crit') { Object.assign(ui.critNotification, n.data); ui.critNotification.open = true; }
    else if (n.type === 'hit') { Object.assign(ui.normalHitNotification, n.data); ui.normalHitNotification.open = true; }
    else if (n.type === 'miss') { Object.assign(ui.missNotification, n.data); ui.missNotification.open = true; }
}

export function dismissCurrentNotification() {
    ui.critNotification.open = false;
    ui.normalHitNotification.open = false;
    ui.missNotification.open = false;
    nextTick(() => processNotificationQueue());
}

export function formatRolledDamages(rolledDamages) {
    if (!rolledDamages || rolledDamages.length === 0) return '0';
    return rolledDamages.map(d => `${d.amount} ${d.type}`).join(' + ');
}

export async function runAction() {
    if (ui.actionOnCooldown) return;
    ui.actionOnCooldown = true;
    setTimeout(() => { ui.actionOnCooldown = false; }, 5000);

    const actor = currentActor.value;
    const action = ui.selectedAction;
    if (!actor || !action) return;
    if (isActorIncapacitated(actor)) return toast(`【${actor.name}】处于失能状态，无法执行动作或反应。`);

    // 兼容旧结构：攻击/豁免动作可能还带 damageDice
    if ((action.type === 'attack' || action.type === 'save') && !action.damages && action.damageDice) {
        action.damages = [{ dice: action.damageDice, type: action.damageType || 'generic' }];
    }

    const targets = battle.participants.filter(p => ui.selectedTargets.includes(p.uid));
    if (!targets.length) return toast('请先在右侧选择目标');

    let log = `【${actor.name}】使用「${action.name}」对 ${targets.length} 个目标：\n`;

    if (action.type === 'attack') {
        for (const t of targets) {
            if (hasCondition(actor, CONDITION_KEYS.CHARMED, s => s.sourceUid && s.sourceUid === t.uid)) {
                log += `- 目标【${t.name}】 -> 无法选中（魅惑禁选）\n`;
                continue;
            }

            let rollMode = ui.rollMode;
            if (rollMode === 'auto') {
                const flags = getAttackRollFlags(actor, t);
                let { hasAdv, hasDis } = flags;

                for (const p of collectBeforeAttackPrompts(actor, t, action)) {
                    const answer = await promptBinary(p);
                    if (p.type === 'proneDistance') {
                        if (answer) hasAdv = true;
                        else hasDis = true;
                    } else if (p.type === 'frightenedLOS') {
                        if (answer) hasDis = true;
                    }
                }

                if (hasAdv && hasDis) rollMode = 'normal';
                else if (hasAdv) rollMode = 'adv';
                else if (hasDis) rollMode = 'dis';
                else rollMode = 'normal';
            }

            const d20 = rollD20(rollMode);
            const toHit = d20.value + (action.attackBonus || 0);
            const hit = (d20.value === 20) || (toHit >= t.ac);

            log += `- 目标【${t.name}】 -> d20(${d20.raw.join(',')}) + ${action.attackBonus || 0} = ${toHit} vs AC ${t.ac} => ${d20.isCrit ? '重击' : (hit ? '命中' : '未命中')}\n`;

            if (hit && !d20.isFumble) {
                const allDamageDetails = [];
                let totalFinalDamage = 0;
                let isCrit = d20.isCrit;

                if (!isCrit) {
                    for (const p of collectAfterHitBeforeDamagePrompts(actor, t, action)) {
                        const answer = await promptBinary(p);
                        if (p.type === 'meleeCritDistance' && answer) isCrit = true;
                    }
                }
                if (isCrit && !d20.isCrit) log += `  -> 5尺内命中，视为重击\n`;

                for (const dmg of action.damages || []) {
                    if (!dmg.dice) continue;
                    const details = rollDamageWithDetails(dmg.dice, isCrit, dmg.type);
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
                        type: isCrit ? 'crit' : 'hit',
                        data: isCrit
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
                    t.hpCurrent = clamp(t.hpCurrent - totalFinalDamage, 0, t.hpMax);
                    log += ` 已自动扣血：-${totalFinalDamage}，剩余HP ${t.hpCurrent}\n`;
                } else {
                    log += ` （未自动扣血）\n`;
                }

                if (action.onHitStatus) {
                    const apply = () => {
                        const info = statusCatalog.value.find(sc => sc.name === action.onHitStatus) || {};
                        const instance = normalizeStatusInstance({
                            name: action.onHitStatus,
                            rounds: action.onHitStatusRounds || 1,
                            icon: info.icon || '⏳',
                        });
                        const def = getConditionDefinition(instance?.key);
                        if (def?.requiresSource && !instance.sourceUid) instance.sourceUid = actor.uid;

                        const identity = getStatusIdentity(instance).identity;
                        if (identity && t.statuses.some(s => getStatusIdentity(s).identity === identity)) return;

                        t.statuses.push(instance);
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
            const dmgResult = rollDamage(dmg.dice, false, dmg.type);
            rolledDamages.push(...dmgResult);
        }

        log += `总潜在伤害: ${formatRolledDamages(rolledDamages)}\n`;

        ui.saveOutcomePicker.title = `处理 "${action.name}" 的豁免结果`;
        ui.saveOutcomePicker.action = deepClone(action);
        ui.saveOutcomePicker.targets = deepClone(targets);
        ui.saveOutcomePicker.damages = rolledDamages;
        ui.saveOutcomePicker.outcomes = {};
        ui.saveOutcomePicker.autoFailTargets = {};
        for (const t of targets) {
            if (isSaveAutoFailTarget(t, action)) {
                ui.saveOutcomePicker.outcomes[t.uid] = 'fail';
                ui.saveOutcomePicker.autoFailTargets[t.uid] = true;
            } else {
                ui.saveOutcomePicker.outcomes[t.uid] = action.onSuccess === 'half' ? 'half' : 'fail';
            }
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

export function applySaveOutcomes() {
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

