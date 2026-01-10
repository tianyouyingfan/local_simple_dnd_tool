---
description: 测试规范：当前项目无测试框架，但提供未来添加测试的指导原则
globs:
  - "**/*test*.js"
  - "**/*spec*.js"
  - "**/__tests__/**/*.js"
alwaysApply: false
---

# 测试规范

## 当前状态

**项目现状：**
- ❌ 无测试框架（无Jest、Vitest、Mocha等）
- ❌ 无测试文件
- ❌ 无测试配置
- ❌ 无CI/CD测试流程

**项目决策：不计划添加测试框架。** 这是项目的明确决定，不是技术债务。

## 测试框架选择（仅供参考，项目不计划添加）

**注意：** 以下内容仅供参考。项目已明确决定不添加测试框架。

### 如果未来需要（不推荐）

**推荐方案：Vitest**
- 与Vue 3生态兼容性好
- 支持ES6模块（项目使用原生ES6模块）
- 配置简单，无需构建工具
- 支持浏览器环境测试（适合IndexedDB测试）

## 测试文件组织（仅供参考）

### 目录结构建议

```
js/
├── modules/
│   ├── constants.js
│   ├── db.js
│   ├── state.js
│   └── utils.js
├── __tests__/
│   ├── modules/
│   │   ├── utils.test.js
│   │   ├── db.test.js
│   │   └── state.test.js
│   └── integration/
│       └── battle-flow.test.js
└── main.js
```

### 命名规范

**必须遵循：**
- 测试文件：`*.test.js` 或 `*.spec.js`
- 测试目录：`__tests__/`
- 测试函数：使用描述性名称

```javascript
// ✅ 正确
describe('rollD20', () => {
    test('应该返回1-20之间的值', () => {});
    test('优势模式应取两个骰子的最大值', () => {});
    test('投出20应标记为重击', () => {});
});

// ❌ 错误
test('test1', () => {});
test('roll', () => {});
```

## 测试覆盖范围（未来）

### 优先级1：工具函数（utils.js）

**必须测试：**
- `rollD20()` - 骰子投掷逻辑
- `rollDamage()` - 伤害计算
- `parseDiceExpr()` - 骰子表达式解析
- `abilityMod()` - 属性调整值计算
- `deepClone()` - 深拷贝功能

**测试重点：**
- 边界条件（如空值、无效输入）
- 重击/大失败判定
- 优势/劣势模式
- 伤害类型处理

**示例（未来）：**
```javascript
// utils.test.js
import { rollD20, rollDamage, abilityMod } from '../modules/utils';

describe('rollD20', () => {
    test('正常模式应返回1-20之间的值', () => {
        const result = rollD20('normal');
        expect(result.value).toBeGreaterThanOrEqual(1);
        expect(result.value).toBeLessThanOrEqual(20);
    });
    
    test('投出20应标记isCrit为true', () => {
        // 使用mock或多次运行确保覆盖
    });
});
```

### 优先级2：数据库操作（db.js）

**必须测试：**
- 数据库初始化
- 种子数据加载
- CRUD操作
- 数据迁移（如有）

**测试策略：**
- 使用测试专用的IndexedDB数据库名
- 每个测试前清理数据
- 测试后清理测试数据库

**示例（未来）：**
```javascript
// db.test.js
import { db } from '../modules/db';

describe('数据库操作', () => {
    beforeEach(async () => {
        await db.monsters.clear();
    });
    
    test('应该能添加怪物', async () => {
        const monster = { name: '测试怪物', cr: 1 };
        const id = await db.monsters.add(monster);
        expect(id).toBeDefined();
    });
});
```

### 优先级3：状态管理（state.js）

**必须测试：**
- 响应式状态更新
- 计算属性正确性
- 状态同步逻辑

### 优先级4：业务逻辑（main.js）

**必须测试：**
- 战斗流程（先攻、回合、动作执行）
- 伤害计算和应用
- 状态效果追踪
- 数据导入导出

## 当前开发中的测试替代方案

### 手动测试清单

**修改代码后必须手动测试：**

1. **工具函数修改：**
   - [ ] 在浏览器控制台测试函数
   - [ ] 测试边界条件（空值、无效输入）
   - [ ] 验证返回值类型和格式

2. **数据库操作修改：**
   - [ ] 测试CRUD操作
   - [ ] 检查IndexedDB数据是否正确
   - [ ] 验证数据迁移（如有）

3. **业务逻辑修改：**
   - [ ] 完整走一遍业务流程
   - [ ] 测试异常情况
   - [ ] 验证UI更新正确

### 浏览器控制台测试

**临时测试工具函数：**
```javascript
// 在浏览器控制台执行
import { rollD20, rollDamage } from './js/modules/utils.js';

// 测试rollD20
const results = Array.from({ length: 100 }, () => rollD20('normal'));
console.log('范围检查:', results.every(r => r.value >= 1 && r.value <= 20));
console.log('重击次数:', results.filter(r => r.isCrit).length);

// 测试rollDamage
const damage = rollDamage('1d6+2', false, '斩击');
console.log('伤害结果:', damage);
```

## 修Bug时的测试原则

### 必须遵循：先复现，再修复，再验证

1. **复现Bug：**
   - 记录复现步骤
   - 确定问题范围
   - 定位问题代码

2. **修复Bug：**
   - 最小化修改
   - 保持代码风格一致
   - 添加注释说明修复原因

3. **验证修复：**
   - 按复现步骤验证Bug已修复
   - 测试相关功能未受影响
   - 测试边界情况

### 示例：修复骰子计算Bug

**步骤：**
1. 复现：在控制台测试`rollD20('adv')`，发现返回值不正确
2. 修复：修改`utils.js`中的`rollD20`函数
3. 验证：
   ```javascript
   // 在控制台测试
   const results = Array.from({ length: 1000 }, () => rollD20('adv'));
   // 验证优势模式总是取较大值
   results.forEach(r => {
       if (r.raw.length === 2) {
           expect(r.value).toBe(Math.max(r.raw[0], r.raw[1]));
       }
   });
   ```

## 未来添加测试的步骤

### 1. 安装测试框架

```bash
npm init -y
npm install -D vitest @vue/test-utils
```

### 2. 创建测试配置

创建 `vitest.config.js`：
```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true
    }
});
```

### 3. 添加测试脚本

在 `package.json` 中添加：
```json
{
    "scripts": {
        "test": "vitest",
        "test:ui": "vitest --ui"
    }
}
```

### 4. 逐步添加测试

- 先从utils.js的工具函数开始
- 然后测试db.js的数据库操作
- 最后测试main.js的业务逻辑

## 测试最佳实践（未来参考）

### Do

- ✅ **测试行为，不测试实现**：测试函数输出，不测试内部变量
- ✅ **使用描述性测试名称**：清楚说明测试什么
- ✅ **一个测试一个断言**：每个测试只验证一件事
- ✅ **测试边界条件**：空值、无效输入、极端值
- ✅ **保持测试独立**：每个测试不应依赖其他测试

### Don't

- ❌ **不要测试第三方库**：不测试Vue、Dexie的内部实现
- ❌ **不要过度mock**：优先使用真实数据，必要时才mock
- ❌ **不要写脆弱的测试**：测试不应因无关代码变更而失败
- ❌ **不要忽略失败测试**：修复或删除，不要注释掉

## 当前项目的测试替代方案

**由于项目不计划添加测试框架，建议：**

1. **关键函数添加JSDoc注释**：说明输入输出和边界条件
2. **复杂逻辑添加注释**：解释算法和特殊处理
3. **手动测试清单**：为关键功能维护测试清单
4. **浏览器控制台测试**：修改代码后在控制台手动验证
5. **ESLint检查**：使用 `npm run lint` 确保代码质量
