---
description: 代码风格与约定：命名规范、导入导出、文件组织、错误处理
globs:
  - "js/**/*.js"
  - "*.js"
alwaysApply: false
---

# 代码风格与约定

## ESLint 配置

**项目已配置 ESLint**，代码风格以 `.eslintrc.js` 配置为准。

**主要规则：**
- 缩进：4个空格
- 引号：单引号
- 分号：必须使用
- 禁止使用 `var`，必须使用 `const` 或 `let`
- 必须使用严格相等 `===`
- 禁止使用 `eval()`
- 箭头函数间距、模板字符串等ES6+规范

**运行检查：**
```bash
npm run lint        # 检查代码
npm run lint:fix    # 自动修复
```

**重要：** 所有代码必须通过 ESLint 检查，提交前运行 `npm run lint`。

## 命名规范

### 变量与函数

**必须使用 camelCase：**
```javascript
// ✅ 正确
const monsterFilters = reactive({});
function openMonsterEditor(monster) {}
const currentActor = computed(() => {});

// ❌ 错误
const monster_filters = reactive({});
function open_monster_editor(monster) {}
const current_actor = computed(() => {});
```

### 常量

**必须使用 UPPER_CASE 或 camelCase（根据上下文）：**
```javascript
// ✅ 正确 - 全局常量
export const monsterTypes = ref([...]);
export const damageTypes = ref([...]);
const CACHE_NAME = 'dnd-assist-v0.5.0-modular';
const MAX_BG_BYTES = 10 * BYTES.MB;

// ✅ 正确 - 模块内常量
const IMAGE_TYPES = new Set(['image/jpeg', ...]);
```

### 文件命名

**必须使用 kebab-case：**
```javascript
// ✅ 正确
constants.js
state.js
db.js
utils.js

// ❌ 错误
Constants.js
State.js
```

## 导入导出规范

### ES6 模块导入

**必须使用明确的导入路径（相对路径或别名）：**
```javascript
// ✅ 正确 - 从modules导入
import { db, seedIfEmpty } from 'db';
import * as utils from 'utils';
import { route, monsters } from 'state';

// ✅ 正确 - 从vendor导入
import Dexie from 'dexie';
import { createApp, ref, computed } from 'vue';

// ❌ 错误 - 使用绝对路径（项目不支持）
import { db } from '/js/modules/db.js';
```

**注意**：项目使用浏览器原生ES6模块，导入路径依赖HTML中的`<script type="module">`配置。

### 导出规范

**优先使用命名导出：**
```javascript
// ✅ 正确 - 命名导出
export const db = new Dexie('dnd-assist-v2');
export function seedIfEmpty() {}
export const monsters = ref([]);

// ✅ 正确 - 默认导出（仅用于第三方库兼容）
export default Dexie;
```

## Vue Composition API 约定

### 响应式数据

**必须使用 ref() 或 reactive()：**
```javascript
// ✅ 正确 - 基本类型使用ref
export const route = ref('battle');
export const monsters = ref([]);

// ✅ 正确 - 对象使用reactive
export const battle = reactive({
    participants: [],
    currentIndex: 0,
    round: 1
});

// ❌ 错误 - 直接使用普通对象
export const battle = {
    participants: [],
    currentIndex: 0
};
```

### 计算属性

**必须使用 computed()：**
```javascript
// ✅ 正确
const filteredMonsters = computed(() => {
    return monsters.value.filter(m => {
        // 筛选逻辑
    });
});

// ❌ 错误 - 使用普通函数
function filteredMonsters() {
    return monsters.value.filter(...);
}
```

### 生命周期钩子

**必须从vue导入并使用：**
```javascript
// ✅ 正确
import { onBeforeUnmount, watch, nextTick } from 'vue';

onBeforeUnmount(() => {
    // 清理逻辑
});

// ❌ 错误 - 使用选项式API
export default {
    beforeUnmount() {}
}
```

## 错误处理

### 异步操作

**必须使用 try-catch 包裹异步操作：**
```javascript
// ✅ 正确
async function loadMonsters() {
    try {
        const data = await db.monsters.toArray();
        monsters.value = data;
    } catch (error) {
        console.error('加载怪物数据失败:', error);
        // 显示用户友好的错误提示
    }
}

// ❌ 错误 - 未处理错误
async function loadMonsters() {
    const data = await db.monsters.toArray();
    monsters.value = data;
}
```

### 数据验证

**必须在关键操作前验证数据：**
```javascript
// ✅ 正确
function deleteMonster(id) {
    if (!id) {
        console.warn('删除怪物：缺少ID');
        return;
    }
    // 删除逻辑
}

// ✅ 正确 - 使用可选链和空值合并
const hp = m.hp?.average ?? m.hp ?? '—';
```

## 代码组织

### 函数顺序

**推荐顺序：**
1. 导入语句
2. 常量定义
3. 工具函数（纯函数）
4. 业务逻辑函数
5. 事件处理函数
6. 导出/返回

### 注释规范

**必须为复杂逻辑添加注释：**
```javascript
// ✅ 正确 - 解释"为什么"
// 使用双骰取最大/最小值实现优势/劣势
const pick = mode === 'adv' ? Math.max(r1, r2) : Math.min(r1, r2);

// ✅ 正确 - 解释复杂算法
// 解析骰子表达式：支持 "1d6+2", "2d8-1" 等格式
function parseDiceExpr(expr) {
    // ...
}

// ❌ 错误 - 注释说明"是什么"（代码已表达）
// 计算属性调整值
function abilityMod(score) {
    return Math.floor((score - 10) / 2);
}
```

## 禁止事项

### 不要使用

- ❌ **var**：必须使用 `const` 或 `let`（ESLint规则：`no-var`）
- ❌ **==**：必须使用 `===` 进行严格相等比较（ESLint规则：`eqeqeq`）
- ❌ **eval()**：禁止使用eval执行动态代码（ESLint规则：`no-eval`）
- ❌ **全局变量污染**：避免在window上挂载变量（除非必要，如调试）
- ❌ **同步阻塞操作**：避免使用同步的IndexedDB操作（项目使用Dexie异步API）
- ❌ **未使用的变量**：使用 `_` 前缀标记（ESLint规则：`no-unused-vars`）

### 不要引入

- ❌ **新的构建工具**：项目是纯前端，无构建步骤
- ❌ **TypeScript**：当前项目使用纯JavaScript，不考虑迁移
- ❌ **状态管理库**：已有Vue响应式系统，不需要Vuex/Pinia
- ❌ **UI框架**：项目使用原生CSS，无UI组件库
- ❌ **测试框架**：不计划添加测试

## 推荐实践

### 数据克隆

**修改对象前先深拷贝：**
```javascript
// ✅ 正确
import { deepClone } from 'utils';
const editedMonster = deepClone(monster);

// ❌ 错误 - 直接修改可能影响原对象
const editedMonster = monster;
```

### 骰子计算

**使用utils中的工具函数：**
```javascript
// ✅ 正确
import { rollD20, rollDamage, parseDiceExpr } from 'utils';
const roll = rollD20('adv');
const damage = rollDamage('1d6+2', isCrit, '斩击');

// ❌ 错误 - 重复实现骰子逻辑
const roll = Math.floor(Math.random() * 20) + 1;
```

### 状态更新

**批量更新时使用nextTick：**
```javascript
// ✅ 正确
await db.monsters.bulkAdd(newMonsters);
await nextTick();
// DOM已更新，可以安全操作

// ❌ 错误 - 立即操作DOM可能未更新
await db.monsters.bulkAdd(newMonsters);
document.querySelector('.card').focus();
```
