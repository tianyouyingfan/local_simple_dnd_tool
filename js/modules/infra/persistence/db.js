import Dexie from 'dexie';

// Dexie 初始化
export const db = new Dexie('dnd-assist-v2');
db.version(3).stores({
    monsters: '++id, name, cr, isCustom',
    abilities: '++id, name',
    pcs: '++id, name',
    actions: '++id, name, type, onHitStatus, onHitStatusRounds, onHitSaveAbility, onHitSaveDC',
    monsterGroups: '++id, name',
});

// 导出种子数据函数
export async function seedIfEmpty() {
    const count = await db.monsters.count();
    if (count > 0) return;
    await db.abilities.bulkAdd([{
        name: '再生',
        description: '每回合开始时回复若干生命值。'
    }, {
        name: '敏捷闪避',
        description: '在可见来源的范围效果伤害上掷成功时不受伤，失败时只受半伤。'
    },]);
    const actionCount = await db.actions.count();
    if (actionCount === 0) {
        await db.actions.bulkAdd([
            { name: '弯刀 (attack)', type: 'attack', attackBonus: 4, damageDice: '1d6+2', damageType: '斩击' },
            { name: '短弓 (attack)', type: 'attack', attackBonus: 4, damageDice: '1d6+2', damageType: '穿刺' },
        ]);
    }
    await db.monsters.bulkAdd([{
        name: '哥布林',
        cr: 0.25,
        type: ['humanoid', 'goblinoid'],
        ac: 15,
        hp: {
            average: 7,
            roll: '2d6'
        },
        speed: {
            walk: 30
        },
        abilities: {
            str: 8,
            dex: 14,
            con: 10,
            int: 10,
            wis: 8,
            cha: 8
        },
        resistances: {
            damage: [],
            conditions: []
        },
        vulnerabilities: {
            damage: [],
            conditions: []
        },
        immunities: {
            damage: [],
            conditions: []
        },
        actions: [{
            id: crypto.randomUUID(),
            name: '弯刀',
            type: 'attack',
            attackBonus: 4,
            damageDice: '1d6+2',
            damageType: '斩击'
        }, {
            id: crypto.randomUUID(),
            name: '短弓',
            type: 'attack',
            attackBonus: 4,
            damageDice: '1d6+2',
            damageType: '穿刺'
        },],
        isCustom: false
    }, {
        name: '食人魔',
        cr: 2,
        type: ['giant'],
        ac: 11,
        hp: {
            average: 59,
            roll: '7d10+21'
        },
        speed: {
            walk: 40
        },
        abilities: {
            str: 19,
            dex: 8,
            con: 16,
            int: 5,
            wis: 7,
            cha: 7
        },
        resistances: {
            damage: [],
            conditions: []
        },
        vulnerabilities: {
            damage: [],
            conditions: []
        },
        immunities: {
            damage: [],
            conditions: []
        },
        actions: [{
            id: crypto.randomUUID(),
            name: '巨棍',
            type: 'attack',
            attackBonus: 6,
            damageDice: '2d8+4',
            damageType: '钝击'
        }, {
            id: crypto.randomUUID(),
            name: '标枪',
            type: 'attack',
            attackBonus: 6,
            damageDice: '2d6+4',
            damageType: '穿刺'
        },],
        isCustom: false
    }, {
        name: '成年红龙',
        cr: 17,
        type: ['dragon'],
        ac: 19,
        hp: {
            average: 256,
            roll: '19d12+133'
        },
        speed: {
            walk: 40,
            fly: 80
        },
        abilities: {
            str: 27,
            dex: 10,
            con: 25,
            int: 16,
            wis: 13,
            cha: 21
        },
        resistances: {
            damage: [],
            conditions: []
        },
        vulnerabilities: {
            damage: [],
            conditions: []
        },
        immunities: {
            damage: ['fire'],
            conditions: []
        },
        actions: [{
            id: crypto.randomUUID(),
            name: '咬击',
            type: 'attack',
            attackBonus: 14,
            damageDice: '2d10+8',
            damageType: '穿刺'
        }, {
            id: crypto.randomUUID(),
            name: '吐息武器',
            type: 'save',
            saveAbility: 'dex',
            saveDC: 21,
            damageDice: '18d6',
            damageType: '火焰',
            onSuccess: 'half',
            range: '60 ft.',
            recharge: 6,
        },],
        isCustom: false
    }]);
    await db.pcs.bulkAdd([{
        name: '艾瑞克',
        ac: 16,
        hpMax: 32,
        hpCurrent: 32,
        abilities: {
            str: 16,
            dex: 12,
            con: 14,
            int: 10,
            wis: 10,
            cha: 12
        },
        actions: [],
        features: '一名经验丰富的战士，忠诚可靠。',
        backgroundImage: ''
    }, {
        name: '琳',
        ac: 14,
        hpMax: 24,
        hpCurrent: 24,
        abilities: {
            str: 8,
            dex: 16,
            con: 12,
            int: 14,
            wis: 12,
            cha: 10
        },
        actions: [],
        features: '一位敏捷的游侠，擅长弓箭和野外生存。',
        backgroundImage: ''
    },]);
}