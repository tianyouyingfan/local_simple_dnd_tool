import { abilityMod } from 'utils';

const ABILITY_ORDER = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

function safeArray(value) {
    return Array.isArray(value) ? value : [];
}

function safeNumber(value, fallback = null) {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function formatSigned(n) {
    const v = safeNumber(n, 0);
    return `${v >= 0 ? '+' : ''}${v}`;
}

export function formatAbilityScore(score) {
    const v = safeNumber(score, 10);
    return `${v} (${formatSigned(abilityMod(v))})`;
}

export function normalizeDamageProfile(entity) {
    const resistances = entity?.resistances || {};
    const vulnerabilities = entity?.vulnerabilities || {};
    const immunities = entity?.immunities || {};
    return {
        resistances: {
            damage: safeArray(resistances.damage),
            conditions: safeArray(resistances.conditions)
        },
        vulnerabilities: {
            damage: safeArray(vulnerabilities.damage),
            conditions: safeArray(vulnerabilities.conditions)
        },
        immunities: {
            damage: safeArray(immunities.damage),
            conditions: safeArray(immunities.conditions)
        }
    };
}

export function formatListOrNone(list, noneText = '无') {
    const arr = safeArray(list).filter(Boolean);
    return arr.length ? arr.join('，') : noneText;
}

export function formatSpeedLine(speed) {
    if (!speed || typeof speed !== 'object') return '—';
    const parts = [];
    const labels = {
        walk: '步行',
        fly: '飞行',
        swim: '游泳',
        climb: '攀爬',
        burrow: '掘穴'
    };
    for (const key of Object.keys(labels)) {
        const v = speed[key];
        const n = safeNumber(v, null);
        if (n !== null) parts.push(parts.length === 0 && key === 'walk' ? `${n}尺` : `${labels[key]} ${n}尺`);
        else if (typeof v === 'string' && v.trim()) parts.push(parts.length === 0 && key === 'walk' ? v.trim() : `${labels[key]} ${v.trim()}`);
    }
    return parts.length ? parts.join('，') : '—';
}

export function formatHpLine(entity, { preferAverageAndRoll = false } = {}) {
    const hpObj = entity?.hp && typeof entity.hp === 'object' ? entity.hp : null;
    const average = safeNumber(hpObj?.average, null);
    const roll = typeof hpObj?.roll === 'string' && hpObj.roll.trim() ? hpObj.roll.trim() : null;
    const hpRoll = typeof entity?.hpRoll === 'string' && entity.hpRoll.trim() ? entity.hpRoll.trim() : null;
    const hpCurrent = safeNumber(entity?.hpCurrent, null);
    const hpMax = safeNumber(entity?.hpMax, null);

    if (preferAverageAndRoll && average !== null) {
        return `${average}${roll ? ` (${roll})` : ''}`;
    }

    if (hpCurrent !== null && hpMax !== null) {
        return `${hpCurrent}/${hpMax}${hpRoll ? ` (${hpRoll})` : ''}`;
    }

    if (hpMax !== null) {
        return `${hpMax}${hpRoll ? ` (${hpRoll})` : ''}`;
    }

    if (average !== null) {
        return `${average}${roll ? ` (${roll})` : ''}`;
    }

    return '—';
}

export function buildCreatureSubtitle(entity, { kind, translateType } = {}) {
    if (kind === 'pc') {
        const metaLine = typeof entity?.metaLine === 'string' ? entity.metaLine.trim() : '';
        return metaLine || '—';
    }

    const size = typeof entity?.size === 'string' ? entity.size.trim() : '';
    const creatureTypeText = typeof entity?.creatureTypeText === 'string' ? entity.creatureTypeText.trim() : '';
    const subtypeText = typeof entity?.subtypeText === 'string' ? entity.subtypeText.trim() : '';
    const alignment = typeof entity?.alignment === 'string' ? entity.alignment.trim() : '';

    const rawTypes = safeArray(entity?.monsterType || entity?.type);
    const typeText = creatureTypeText || (rawTypes.length ? rawTypes.map(t => (translateType ? translateType(t) : t)).join('，') : '');

    const left = `${size || '—'}${typeText || '生物'}${subtypeText ? `（${subtypeText}）` : ''}`;
    const right = alignment || '—';
    return `${left}，${right}`;
}

export function formatDamages(damages) {
    const arr = safeArray(damages);
    if (!arr.length) return '无伤害';
    return arr.map(d => `${d?.dice || ''} ${d?.type || ''}`.trim()).filter(Boolean).join('，');
}

export function formatActionBody(action) {
    if (!action || typeof action !== 'object') return '';
    const note = typeof action.note === 'string' ? action.note.trim() : '';
    if (action.type === 'attack') {
        const parts = [];
        const attackBonus = safeNumber(action.attackBonus, null);
        if (attackBonus !== null) parts.push(`攻击${formatSigned(attackBonus)}`);
        if (action.range) parts.push(`距离 ${action.range}`);
        if (action.damages) parts.push(`伤害 ${formatDamages(action.damages)}`);
        const base = parts.join('，');
        if (!note) return base;
        return base ? `${base}；${note}` : note;
    }
    if (action.type === 'save') {
        const parts = [];
        if (action.range) parts.push(`距离 ${action.range}`);
        const dc = safeNumber(action.saveDC, null);
        const ab = typeof action.saveAbility === 'string' ? action.saveAbility.trim().toUpperCase() : '';
        if (dc !== null) parts.push(`豁免 DC ${dc}${ab ? ` ${ab}` : ''}`);
        if (action.damages) parts.push(`伤害 ${formatDamages(action.damages)}`);
        if (action.onSuccess === 'half') parts.push('成功则半伤');
        const base = parts.join('，');
        if (!note) return base;
        return base ? `${base}；${note}` : note;
    }
    return note;
}

export function groupActionsForStatblock(actions) {
    const grouped = {
        trait: [],
        action: [],
        reaction: [],
        bonus: [],
        legendary: []
    };
    for (const a of safeArray(actions)) {
        const section = typeof a?.section === 'string' ? a.section : null;
        const resolved = section && grouped[section] ? section : (a?.type === 'utility' ? 'trait' : 'action');
        grouped[resolved].push(a);
    }
    return grouped;
}

export function buildStatblockViewModel(entity, { kind, translateType } = {}) {
    const abilities = entity?.abilities && typeof entity.abilities === 'object' ? entity.abilities : {};
    const damageProfile = normalizeDamageProfile(entity);
    const actionGroups = groupActionsForStatblock(entity?.actions);

    const sections = [];
    if (actionGroups.trait.length) {
        sections.push({
            key: 'traits',
            title: '特殊能力',
            entries: actionGroups.trait.map(a => ({
                name: a?.name || '未命名',
                body: formatActionBody(a)
            }))
        });
    }
    if (actionGroups.action.length) {
        sections.push({
            key: 'actions',
            title: '动作',
            entries: actionGroups.action.map(a => ({
                name: a?.name || '未命名',
                body: formatActionBody(a)
            }))
        });
    }
    if (actionGroups.reaction.length) {
        sections.push({
            key: 'reactions',
            title: '反应',
            entries: actionGroups.reaction.map(a => ({
                name: a?.name || '未命名',
                body: formatActionBody(a)
            }))
        });
    }
    if (actionGroups.bonus.length) {
        sections.push({
            key: 'bonus',
            title: '附赠动作',
            entries: actionGroups.bonus.map(a => ({
                name: a?.name || '未命名',
                body: formatActionBody(a)
            }))
        });
    }
    if (actionGroups.legendary.length) {
        sections.push({
            key: 'legendary',
            title: '传奇动作',
            entries: actionGroups.legendary.map(a => ({
                name: a?.name || '未命名',
                body: formatActionBody(a)
            }))
        });
    }

    if (kind === 'pc') {
        const featuresText = typeof entity?.features === 'string' ? entity.features.trim() : '';
        if (featuresText) {
            sections.push({
                key: 'pc-features',
                title: '特性',
                entries: [{ name: '', body: featuresText }]
            });
        }
    }

    return {
        header: {
            name: entity?.name || '未命名',
            avatar: entity?.avatar || ''
        },
        subtitle: buildCreatureSubtitle(entity, { kind, translateType }),
        kpis: {
            ac: safeNumber(entity?.ac, null),
            hpText: formatHpLine(entity, { preferAverageAndRoll: kind === 'monster' && !!entity?.hp }),
            speedText: formatSpeedLine(entity?.speed),
            cr: safeNumber(entity?.cr, null)
        },
        abilities: ABILITY_ORDER.map(k => ({
            key: k,
            label: k.toUpperCase(),
            score: safeNumber(abilities[k], 10),
            text: formatAbilityScore(abilities[k])
        })),
        damageLines: {
            resist: formatListOrNone(damageProfile.resistances.damage),
            vuln: formatListOrNone(damageProfile.vulnerabilities.damage),
            immune: formatListOrNone(damageProfile.immunities.damage),
            condImmune: formatListOrNone(damageProfile.immunities.conditions)
        },
        sections
    };
}
