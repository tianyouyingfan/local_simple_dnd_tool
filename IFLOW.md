# iFlow CLI 项目上下文

## 项目概述

**D&D战斗助手 (D&D Combat Assistant)** 是一个纯本地化的D&D战斗辅助工具，专为DM设计。项目采用Vue 3 + IndexedDB技术栈，支持PWA离线使用，所有数据存储在浏览器本地。

### 核心功能
- 📦 怪物库、PC角色库、动作库管理
- ⚔️ 自动化战斗流程（先攻、攻击、豁免、状态追踪）
- 🎨 深度定制（生物编辑器、头像上传、战斗特效）
- 🔒 本地优先，完全离线可用
- 🚀 高效操作（快捷键、怪物组合、便捷交互）

## 技术架构

### 前端框架
- **Vue 3**: 使用Composition API和响应式状态管理
- **Dexie.js**: IndexedDB封装，实现本地数据持久化
- **PWA**: Service Worker实现离线功能
- **纯前端**: 无需后端服务器，可直接通过file://协议运行

### 项目结构
```
重构版D&D_Tool/
├── index.html              # 主入口文件（1870行Vue应用）
├── style.css               # 全局样式
├── manifest.json           # PWA配置文件
├── sw.js                   # Service Worker
├── js/
│   ├── main.js             # Vue应用主逻辑（1860行）
│   ├── modules/
│   │   ├── constants.js    # 常量定义（怪物类型、伤害类型等）
│   │   ├── db.js           # Dexie数据库配置和种子数据
│   │   ├── state.js        # 全局状态管理
│   │   └── utils.js        # 工具函数
│   └── vendor/
│       ├── dexie.js        # Dexie库
│       └── vue.js          # Vue 3库
└── icon-*.png              # PWA图标
```

### 数据模型

**IndexedDB表结构:**
- `monsters`: 怪物数据（id, name, cr, isCustom）
- `abilities`: 能力/特性（id, name, description）
- `pcs`: PC角色（id, name, ac, hp, abilities等）
- `actions`: 动作/攻击（id, name, type, attackBonus, damageDice等）
- `monsterGroups`: 怪物组合（id, name）

## 开发指南

### 运行项目

**方式1：本地服务器**
```bash
# 使用http-server
npx http-server

# 或使用Python
python -m http.server 8000

# 或使用VS Code Live Server插件
```

**方式2：直接打开**
由于项目使用相对路径和CDN资源，可直接双击`index.html`运行（部分功能可能受限）

**方式3：PWA安装**
- PC端：Chrome/Edge点击地址栏"安装"图标
- 移动端：浏览器"添加到主屏幕"

### 核心开发文件

**状态管理** (`js/modules/state.js`):
- 全局响应式状态：monsters, pcs, actions, battle等
- battle对象包含participants, currentIndex, round
- UI状态：ui, uiState, monsterFilters等

**数据库** (`js/modules/db.js`):
- Dexie实例配置和版本管理
- seedIfEmpty()函数初始化演示数据
- 包含怪物、能力、动作的默认数据

**工具函数** (`js/modules/utils.js`):
- 骰子模拟：d20(), diceRoll(), rollDiceExpression()
- 属性调整值计算：mod()
- 动作排序：sortActionsByType()
- 伤害计算：applyDamage(), applyHealing()

**主逻辑** (`js/main.js`):
- Vue应用创建和setup函数
- 所有业务逻辑：战斗流程、编辑器、导入导出
- 计算属性：filteredMonsters, currentActor, groupedParticipants等
- 方法：addToBattle(), rollInitiative(), runAction()等

### 开发约定

**代码风格:**
- 使用ES6模块导入导出
- Vue Composition API风格（setup函数）
- 响应式数据使用ref()和reactive()
- 计算属性使用computed()

**命名规范:**
- 组件/函数：camelCase（如openMonsterEditor）
- 常量：UPPER_CASE（如monsterTypes）
- 文件：kebab-case（如monster-editor.vue，但本项目使用.js）

**状态管理:**
- 全局状态集中在state.js
- 组件内部状态在setup中定义
- 使用watch监听重要状态变化

### 常用命令

由于项目是纯前端，没有构建过程，主要命令：

**启动开发服务器:**
```bash
# 推荐：使用http-server
npx http-server -p 8080 -o

# 或：使用live-server
npx live-server --port=8080
```

**数据备份/恢复:**
- 通过UI的"导入/导出"页面操作
- 导出为JSON格式，包含所有表数据

**调试技巧:**
- 浏览器开发者工具 → Application → IndexedDB查看数据
- Vue DevTools查看组件状态
- 在控制台访问db对象：db.monsters.toArray()

### 功能扩展建议

**添加新状态效果:**
1. 在`constants.js`的statusCatalog中添加新状态
2. 在状态选择器组件中添加对应UI
3. 在战斗逻辑中处理状态效果

**添加新伤害类型:**
1. 在`constants.js`的damageTypes中添加新类型
2. 更新抗性/易伤/免疫配置界面
3. 在伤害计算逻辑中处理新类型

**添加新怪物类型:**
1. 在`constants.js`的monsterTypes中添加新类型
2. 更新monsterTypeTranslations翻译
3. 筛选逻辑会自动支持新类型

### 已知问题和TODO

**代码中的TODO:**
- 完整的《怪物图鉴》样式排版
- CR一键调整算法完善
- 法术库与法术位追踪
- 战役与地图管理
- 移动端布局优化
- 完整主题系统（光明/黑暗模式）

**技术债务:**
- main.js文件过大（1860行），建议按功能模块拆分
- 部分重复代码可提取为可复用组件
- 缺少单元测试和集成测试

### PWA配置

**manifest.json:**
- 应用名称：DND助手
- 显示模式：standalone（独立应用）
- 主题色：#0F1012（深色主题）
- 图标：192x192和512x512 PNG

**Service Worker (sw.js):**
- 缓存策略：CacheFirst
- 缓存资源：HTML、CSS、JS、图片
- 支持离线访问

### 部署建议

**静态托管:**
项目可部署到任何静态托管服务：
- GitHub Pages
- Cloudflare Pages（当前线上地址）
- Netlify
- Vercel
- 阿里云OSS/腾讯云COS

**CDN资源:**
- Vue 3: https://unpkg.com/vue@3/dist/vue.esm-browser.js
- Dexie: https://unpkg.com/dexie@4/dist/dexie.mjs
- 建议：生产环境使用锁定版本号

### 浏览器兼容性

**支持:**
- Chrome/Edge 90+
- Firefox 90+
- Safari 14+

**必需特性:**
- ES6模块支持
- IndexedDB
- ES2020+语法（可选链、空值合并等）

## 相关资源

- **线上地址**: https://tyyf-dnd-helper.pages.dev/
- **GitHub仓库**: https://github.com/tianyouyingfan/dqy_webAPP.git
- **当前分支**: main
- **许可证**: MIT
