---
description: 架构与模块边界：模块职责、依赖方向、新增模块的步骤
globs:
  - "js/modules/**/*.js"
  - "js/main.js"
alwaysApply: false
---

# 架构与模块边界

## 模块职责划分

### 核心基础模块

#### constants.js
**职责：** 只存放常量定义，不包含业务逻辑。
**包含内容：** 怪物类型、伤害类型、状态目录、CR选项等。

#### db.js
**职责：** 数据库配置、版本管理、种子数据。
**包含内容：** Dexie实例配置、种子数据函数。

#### state.js
**职责：** 全局响应式状态管理。
**包含内容：** 全局 ref/reactive 状态 (`monsters`, `battle` 等)。

#### utils.js
**职责：** 纯函数工具。
**包含内容：** 骰子函数、属性计算、深拷贝等。

#### helpers.js
**职责：** 通用辅助函数。
**包含内容：** 验证、文件读取、JSON解析、DOM辅助。

#### data-loader.js
**职责：** 数据加载与初始化。
**包含内容：** `loadAll`, `seedDemo`。

#### use-toasts.js
**职责：** Toast 通知系统逻辑。

#### use-computed.js
**职责：** 集中管理 Vue 计算属性。

### 业务逻辑模块

#### entity-crud.js
**职责：** 实体（怪物、PC、能力、动作）的增删改查操作。
**包含内容：** 编辑器打开/关闭、保存、删除逻辑。

#### monster-groups.js
**职责：** 怪物组合管理。
**包含内容：** 组合的创建、编辑、批量应用。

#### import-export.js
**职责：** 数据导入导出。
**包含内容：** JSON 导出、文件导入处理。

#### cr-adjustment.js
**职责：** CR 自动调整逻辑。

### 战斗系统模块

#### battle-core.js
**职责：** 战斗核心流程控制。
**包含内容：** 参战、先攻、回合流转、移除单位。

#### action-execution.js
**职责：** 动作执行引擎。
**包含内容：** 攻击检定、伤害计算、豁免处理、日志生成。

#### hp-status.js
**职责：** HP 与状态管理。
**包含内容：** 扣血/治疗、状态施加/移除、快速伤害编辑器。

#### targeting.js
**职责：** 目标选择逻辑。

### UI 交互模块

#### image-cropper.js / use-image-cropper.js
**职责：** 图片裁剪功能。
**包含内容：** 裁剪器实例管理 (`image-cropper.js`) 和 核心逻辑 Composable (`use-image-cropper.js`)。

#### actor-viewer.js
**职责：** 角色查看器逻辑。

#### quick-dice.js
**职责：** 快速骰子工具逻辑。

#### ui-toggles.js
**职责：** 简单的 UI 状态切换与过滤器逻辑。

#### keyboard-shortcuts.js
**职责：** 全局键盘快捷键注册。

---

### main.js
**职责：** 应用入口与胶水层。
**包含内容：**
- Vue 应用初始化 (`createApp`)
- 导入并组合所有模块
- 注册全局 Watchers
- 模板使用的 Helper 函数暴露

**注意：** `main.js` 现在应保持精简，不包含具体业务逻辑。

---

## 依赖方向规则

### 允许的依赖方向

```
main.js
  ↓ (导入并组合)
各业务模块 (battle-core, entity-crud, ...)
  ↓ (相互借用，但避免循环依赖)
核心模块 (state, db, utils, helpers)
  ↓
constants.js
```

1. **High Level**: `main.js` 导入所有模块。
2. **Mid Level**: 业务模块（如 `battle-core`）可以导入核心模块（`state`, `utils`）。
3. **Low Level**: 核心模块（`utils`, `helpers`）通常只依赖 `constants.js` 或无依赖。

### 禁止的模式
- ❌ **循环依赖**：如 `state` 依赖 `battle-core`，而 `battle-core` 又依赖 `state`（注：`state.js` 仅定义数据结构，不应依赖业务逻辑模块）。
- ❌ **Main 反向依赖**：没有任何模块应该导入 `main.js`。

## 新增模块建议

1. **功能归类**：判断新功能属于 核心、业务、战斗 还是 UI。
2. **优先复用**：先检查 `utils.js` 和 `helpers.js`。
3. **保持单一职责**：如果一个文件变得过大（>300行），考虑继续拆分。

## 技术债务状态

- ✅ `main.js` 已完成模块化重构（2025-01）。
- ⏳ `index.html` 仍较大，未来可考虑组件化拆分。
