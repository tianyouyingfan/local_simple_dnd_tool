import { reactive, ref, computed } from 'vue';


export const route = ref('battle'); // 默认跳到战斗页便于看布局
export const monsters = ref([]);
export const abilities = ref([]);
export const pcs = ref([]);
export const actions = ref([]);
export const monsterGroups = ref([]);
export const monsterFilters = reactive({
    keyword: '',
    cr: '',
    types: []
});
export const monsterTypes = ref(['aberration', 'beast', 'celestial', 'construct', 'dragon', 'elemental', 'fey', 'fiend', 'giant', 'humanoid', 'monstrosity', 'ooze', 'plant', 'undead', 'goblinoid']);
export const damageTypes = ref(['钝击', '穿刺', '斩击', '火焰', '寒冷', '力场', '毒素', '酸性', '闪电', '心灵', '光耀', '死灵', '雷鸣']);
export const conditionTypes = ref(['charmed', 'frightened', 'poisoned', 'prone', 'restrained', 'blinded']);
export const monsterTypeTranslations = {
    'aberration': '异怪',
    'beast': '野兽',
    'celestial': '天界生物',
    'construct': '构装体',
    'dragon': '龙',
    'elemental': '元素',
    'fey': '精类',
    'fiend': '邪魔',
    'giant': '巨人',
    'humanoid': '人形生物',
    'monstrosity': '怪兽',
    'ooze': '泥怪',
    'plant': '植物',
    'undead': '不死生物',
    'goblinoid': '类哥布林'
};
export const translateType = (t) => monsterTypeTranslations[t] || t;
export const crOptions = ref(['0', '0.125', '0.25', '0.5', ...Array.from({
    length: 30
}, (_, i) => (i + 1).toString())]);
export const battle = reactive({
    participants: [],
    currentIndex: 0,
    round: 1,
    dragIndex: null,
});
// 状态
export const statusCatalog = ref([{
    name: '倒地 Prone',
    icon: '🛌'
}, {
    name: '束缚 Restrained',
    icon: '⛓️'
}, {
    name: '致盲 Blinded',
    icon: '🕶️'
}, {
    name: '中毒 Poisoned',
    icon: '☠️'
}, {
    name: '魅惑 Charmed',
    icon: '💞'
}, {
    name: '恐慌 Frightened',
    icon: '😱'
}, {
    name: '耳聋 Deafened',
    icon: '🔇'
}, {
    name: '擒抱 Grappled',
    icon: '🤼'
}, {
    name: '失能 Incapacitated',
    icon: '⛔'
}, {
    name: '隐形 Invisible',
    icon: '👻'
}, {
    name: '麻痹 Paralyzed',
    icon: '🧊'
}, {
    name: '石化 Petrified',
    icon: '🗿'
}, {
    name: '震慑 Stunned',
    icon: '💫'
}, {
    name: '昏迷 Unconscious',
    icon: '😴'
}, {
    name: '力竭 1级',
    icon: '🥀'
}, {
    name: '力竭 2级',
    icon: '🥀'
}, {
    name: '力竭 3级',
    icon: '🥀'
}, {
    name: '力竭 4级',
    icon: '🥀'
}, {
    name: '力竭 5级',
    icon: '🥀'
}, {
    name: '力竭 6级',
    icon: '🥀'
},]);
// 注意：battle 状态的持久化在 main.js 中处理（带节流和错误处理）
export const ui = reactive({
    actorViewer: {
        open: false,
        actor: null,
        isEditing: false, // 新增：编辑状态标志
        draft: null,      // 新增：编辑时的数据草稿
    },
    monsterEditor: {
        open: false,
        mode: 'edit', // 'view' or 'edit'
    },
    abilityPool: {
        open: false,
        keyword: '',
        nested: false
    },
    imageCropper: {
        open: false,
        imageUrl: null,
        aspectRatio: 720 / 480, // 模态框大致宽高比
    },
    avatarCropper: {
        open: false,
        imageUrl: null,
        aspectRatio: 1, // 1:1 for circular avatar
    },
    actionPool: {
        open: false,
        keyword: '',
        nested: false
    },
    actionsViewer: {
        open: false,
        draft: null,
        title: ''
    },
    saveCheck: {
        open: false,
        targetName: '',
        dc: 0,
        ability: '',
        callback: null
    },
    binaryPrompt: {
        open: false,
        title: '',
        message: '',
        yesText: '是',
        noText: '否',
        callback: null
    },
    // 在这里添加新的对象
    saveOutcomePicker: {
        open: false,
        title: '',
        targets: [], // 存储目标对象
        action: null, // 存储动作详情
        damages: [], // 存储已掷骰的伤害结果 [{ amount: 15, type: '火焰' }]
        outcomes: {}, // 存储每个目标的豁免结果 { targetUid: 'fail' | 'half' | 'zero' }
        autoFailTargets: {} // { targetUid: true }
    },
    abilityEditor: {
        open: false,
        nested: false
    },
    pcEditor: {
        open: false,
        mode: 'edit',
    },
    activeEditor: null, // 'monster' or 'pc'
    actionEditor: {
        open: false,
        saveTarget: 'global',
        nested: false,
    },
    statusPicker: {
        open: false,
        targetUid: null,
        selectedName: '束缚 Restrained',
        rounds: 3,
        icon: '⛓️',
        sourceUid: null,
        blocked: false
    },
    conditionInfo: {
        open: false,
        targetUid: null,
        statusId: null,
        key: null,
        title: '',
        icon: '',
        html: '',
        automationLevel: 'full',
        sourceName: ''
    },
    addParticipants: {
        open: false,
        keywordM: '',
        keywordP: ''
    },
    hpEditor: {
        open: false,
        targetUid: null,
        delta: null,
        tempHpInput: null
    },
    monsterGroupManager: { open: false },
    monsterGroupEditor: { open: false, keyword: '' },
    quickDamage: {
        open: false,
        targetUid: null,
        damageAmount: null,
        targetName: ''
    },
    exhaustionDeathConfirm: {
        open: false,
        targetUid: null,
        targetName: ''
    },
    actionOnCooldown: false,
    selectedAction: null,
    rollMode: 'auto',
    autoApplyDamage: true,
    selectedTargets: [],
    log: '',
    isEditingInitiative: false, // 新增: 用于切换先攻序列的查看/编辑模式
    notificationQueue: [],
    critNotification: {
        open: false,
        type: 'success', // 'success' or 'failure'
        attacker: '',
        target: '',
        toHitRoll: '',
        toHitResult: 0,
        targetAC: 0,
        damages: [], // 存储每段伤害的详情对象 { rawAmount, finalAmount, type, modifier }
        totalFinalDamage: 0, // 存储所有伤害段落的最终总和
    },
    normalHitNotification: {
        open: false,
        attacker: '',
        target: '',
        toHitRoll: '',
        toHitResult: 0,
        targetAC: 0,
        damages: [], // 存储每段伤害的详情对象 { rawAmount, finalAmount, type, modifier }
        totalFinalDamage: 0, // 存储所有伤害段落的最终总和
    },
    missNotification: {
        open: false,
        attacker: '',
        target: '',
        toHitRoll: '',
        toHitResult: 0,
        targetAC: 0,
    },
    quickDice: {
        inputOpen: false,
        resultOpen: false,
        expression: '',
        result: null
    },
    toasts: [],
});
export const hpDelta = ref(5);
export const quickDamageInput = ref(null);
export const quickRollInput = ref(null);
export const participantTiles = ref(new Map());
export const currentActor = computed(() => battle.participants[battle.currentIndex] || null);
export const sortedCurrentActorActions = computed(() => []);
export const sortedActorViewerActions = computed(() => []);
export const sortedMonsterDraftActions = computed(() => []);
export const sortedPcDraftActions = computed(() => []);

// 怪物编辑器草稿
export const emptyMonster = () => ({
    name: '',
    avatar: '',
    size: '',
    creatureTypeText: '',
    subtypeText: '',
    alignment: '',
    cr: 1,
    backgroundImage: '',
    type: [],
    ac: 12,
    hp: {
        average: 10,
        roll: '1d8+2'
    },
    speed: {
        walk: 30
    },
    abilities: {
        str: 10,
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10
    },
    resistances: { damage: [], conditions: [] },
    vulnerabilities: { damage: [], conditions: [] },
    immunities: { damage: [], conditions: [] },
    actions: [],
    isDefault: false
});
export const emptyGroup = () => ({
    name: '',
    monsters: []
});
export const uiState = reactive({
    monsterDraft: emptyMonster(),
    targetCR: null,
    abilityDraft: {
        name: '',
        description: ''
    },
    pcDraft: {
        name: '',
        avatar: '',
        metaLine: '',
        ac: 14,
        hpMax: 20,
        hpCurrent: 20,
        abilities: {
            str: 10,
            dex: 10,
            con: 10,
            int: 10,
            wis: 10,
            cha: 10
        },
        actions: [],
        features: '',
        resistances: { damage: [], conditions: [] },
        vulnerabilities: { damage: [], conditions: [] },
        immunities: { damage: [], conditions: [] },
        backgroundImage: ''
    },
    actionDraft: { name: '', type: 'attack', damages: [], recharge: 0, section: '', note: '' },
    groupDraft: {
        name: '',
        monsters: [] // 格式: [{ monsterId: number, name: string, count: number }]
    },
});
