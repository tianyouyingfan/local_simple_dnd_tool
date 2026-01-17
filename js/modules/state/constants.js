import { reactive, ref, computed, watch } from 'vue';


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
},]);