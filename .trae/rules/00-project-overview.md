---
description: 项目概览：D&D战斗助手的技术栈、目录结构、运行方式和核心约定
globs:
  - "**/*"
alwaysApply: true
---

# 项目概览

## 项目简介

**D&D战斗助手**是一个纯本地化的D&D战斗辅助工具，专为DM设计。采用Vue 3 + IndexedDB技术栈，支持PWA离线使用，所有数据存储在浏览器本地IndexedDB中。

## 技术栈

- **前端框架**: Vue 3 (Composition API)
- **数据持久化**: Dexie.js (IndexedDB封装)
- **模块系统**: ES6 原生模块（import/export）
- **PWA支持**: Service Worker + manifest.json
- **构建工具**: 无（纯前端，直接运行）
- **包管理**: npm（仅用于开发工具，如ESLint）
- **代码检查**: ESLint（`.eslintrc.js`）
- **测试框架**: 无（不计划添加）

## 目录结构

```
重构版D&D_Tool/
├── index.html              # 主入口HTML（包含所有Vue模板）
├── style.css               # 全局样式文件
├── manifest.json           # PWA配置文件
├── sw.js                   # Service Worker（缓存策略）
├── package.json            # npm配置（ESLint依赖）
├── .eslintrc.js            # ESLint配置
├── js/
│   ├── main.js             # Vue应用入口（已轻量化，负责胶水逻辑）
│   ├── modules/
│   │   ├── battle-core.js  # 战斗核心逻辑
│   │   ├── entity-crud.js  # 实体管理逻辑
│   │   ├── ...             # 其他 18+ 个功能模块
│   │   ├── constants.js    # 常量定义
│   │   ├── db.js           # 数据库配置
│   │   ├── state.js        # 全局响应式状态
│   │   └── utils.js        # 基础工具函数
│   └── vendor/
│       ├── dexie.js        # Dexie库
│       └── vue.js          # Vue 3库
└── icon-*.png              # PWA图标资源
```

## 运行方式

**开发环境：**
```bash
# 方式1：使用http-server
npx http-server -p 8080 -o

# 方式2：使用live-server
npx live-server --port=8080

# 方式3：使用VS Code Live Server插件
# 方式4：直接打开index.html（部分功能可能受限）
```

**生产部署：**
- 静态托管：GitHub Pages、Cloudflare Pages、Netlify等
- 当前线上地址：https://tyyf-dnd-helper.pages.dev/

## 核心约定

### 修改代码前的检查清单

1. **先查找既有模式**：在`js/modules/`中查找是否有可复用的函数或模式
2. **优先复用现有工具**：使用`utils.js`中的工具函数（如`rollD20`, `rollDamage`, `abilityMod`）
3. **避免重复造轮子**：检查`state.js`中是否已有相关状态管理
4. **遵循模块边界**：
   - 见 `.cursor/rules/20-architecture-and-boundaries.mdc` 的详细说明

### 数据模型

**IndexedDB表结构（db.js中定义）：**
- `monsters`: 怪物数据（索引：id, name, cr, isCustom）
- `abilities`: 能力/特性（索引：id, name）
- `pcs`: PC角色（索引：id, name）
- `actions`: 动作/攻击（索引：id, name, type等）
- `monsterGroups`: 怪物组合（索引：id, name）

**战斗状态（state.js / localStorage）：**
- `battle.participants` 的参战单位对象可能包含 `tempHp`（虚假生命），用于扣血时优先消耗
- 战斗状态会写入 `localStorage['dnd-battle-state']`，因此 `tempHp` 也会随战斗状态持久化

### 状态管理原则

- **全局状态**：集中在`state.js`，使用Vue的`ref()`和`reactive()`
- **组件状态**：在`main.js`的setup函数中定义
- **数据同步**：使用`watch`监听数据库变化，自动同步到状态

## 常用命令

```bash
# 启动开发服务器
npx http-server -p 8080 -o

# 代码检查
npm run lint              # 检查代码
npm run lint:fix          # 自动修复可修复的问题

# 查看IndexedDB数据（浏览器控制台）
db.monsters.toArray()
db.pcs.toArray()
```

## 调试技巧

- **查看IndexedDB**：浏览器开发者工具 → Application → IndexedDB → `dnd-assist-v2`
- **Vue状态**：使用Vue DevTools扩展
- **Service Worker**：Application → Service Workers

## 已知技术债务

- `index.html`文件过大，计划未来拆分组件（目前不着急）
- 无单元测试和集成测试（不计划添加）
- 无TypeScript类型检查（不考虑迁移）
