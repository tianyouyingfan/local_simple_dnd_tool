---
description: 安全与数据处理：本地存储安全、输入验证、数据导入导出、隐私保护
globs:
  - "js/**/*.js"
  - "sw.js"
alwaysApply: false
---

# 安全与数据处理

## 数据存储安全

### IndexedDB 数据安全

**项目特点：**
- 所有数据存储在浏览器本地IndexedDB
- 无后端服务器，无数据传输
- 数据完全由用户控制

**安全原则：**

1. **数据隔离：**
   ```javascript
   // ✅ 正确 - 使用唯一数据库名
   export const db = new Dexie('dnd-assist-v2');
   
   // ❌ 错误 - 使用通用名称可能冲突
   export const db = new Dexie('app');
   ```

2. **版本管理：**
   ```javascript
   // ✅ 正确 - 明确版本号，支持迁移
   db.version(3).stores({
       monsters: '++id, name, cr, isCustom',
       // ...
   });
   
   // 未来添加迁移
   db.version(4).stores({...}).upgrade(tx => {
       // 数据迁移逻辑
   });
   ```

3. **数据清理：**
   - 删除操作应确认用户意图
   - 批量删除前应提示用户
   - 提供数据导出功能（备份）

### 敏感数据处理

**当前项目无敏感数据，但需遵循原则：**

1. **不存储用户凭证：** 项目无登录系统，无需存储密码
2. **不记录用户行为：** 不记录用户操作日志到服务器
3. **本地数据加密（如需要）：** 如需加密，使用Web Crypto API

## 输入验证

### 用户输入验证

**必须验证所有用户输入：**

```javascript
// ✅ 正确 - 验证文件上传
function validateImageFile(file, { maxBytes }) {
    if (!file) return { valid: false, message: '没有选择文件' };
    if (!IMAGE_TYPES.has(file.type)) {
        return { valid: false, message: '不支持的文件格式' };
    }
    if (file.size > maxBytes) {
        return { valid: false, message: `图片文件过大，请选择小于 ${mb}MB 的图片` };
    }
    return { valid: true };
}

// ✅ 正确 - 验证数值输入
function validateCR(cr) {
    const num = parseFloat(cr);
    if (isNaN(num) || num < 0 || num > 30) {
        return { valid: false, message: 'CR必须在0-30之间' };
    }
    return { valid: true, value: num };
}
```

### 数据导入验证

**导入JSON数据时必须验证：**

```javascript
// ✅ 正确 - 验证导入数据格式
async function importAll(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const text = await readFileAsText(file);
    const data = safeJsonParse(text, null);
    
    // 验证数据结构
    if (!data || !data.meta || data.meta.app !== 'dnd-assist-v2') {
        alert('无效的导入文件格式');
        return;
    }
    
    // 验证数据完整性
    if (!Array.isArray(data.monsters)) {
        alert('导入数据格式错误：缺少monsters数组');
        return;
    }
    
    // 清理并导入
    await db.monsters.clear();
    await db.monsters.bulkAdd(data.monsters);
}
```

### 骰子表达式验证

**必须验证骰子表达式，防止代码注入：**

```javascript
// ✅ 正确 - 严格验证骰子表达式
function parseDiceExpr(expr) {
    if (!expr) return { dice: [], flat: 0 };
    
    // 只允许数字、d、+、-、空格
    if (!/^[\d\sd+\- ]+$/i.test(expr)) {
        console.warn('无效的骰子表达式:', expr);
        return { dice: [], flat: 0 };
    }
    
    // 解析逻辑...
}

// ❌ 错误 - 使用eval（绝对禁止）
function parseDiceExpr(expr) {
    return eval(expr); // 危险！可能执行恶意代码
}
```

## 数据导入导出安全

### 导出数据

**导出时应包含元数据：**

```javascript
// ✅ 正确 - 包含版本和元数据
async function exportAll() {
    const data = {
        meta: {
            app: 'dnd-assist-v2',
            exportedAt: new Date().toISOString(),
            version: 1
        },
        monsters: await db.monsters.toArray(),
        pcs: await db.pcs.toArray(),
        // ...
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    // 下载逻辑...
}
```

### 导入数据

**导入前必须验证：**

1. **文件格式验证：** 必须是JSON
2. **数据结构验证：** 必须包含预期的表和字段
3. **数据完整性验证：** 检查必需字段
4. **版本兼容性：** 检查导入数据版本

```javascript
// ✅ 正确 - 完整的导入验证
async function importAll(e) {
    const file = e.target.files[0];
    const text = await readFileAsText(file);
    const data = safeJsonParse(text, null);
    
    // 1. 基本验证
    if (!data || typeof data !== 'object') {
        throw new Error('无效的JSON文件');
    }
    
    // 2. 元数据验证
    if (!data.meta || data.meta.app !== 'dnd-assist-v2') {
        throw new Error('不是有效的D&D助手导出文件');
    }
    
    // 3. 数据结构验证
    const requiredTables = ['monsters', 'pcs', 'actions'];
    for (const table of requiredTables) {
        if (!Array.isArray(data[table])) {
            throw new Error(`缺少必需的数据表: ${table}`);
        }
    }
    
    // 4. 数据清理和导入
    // ...
}
```

## Service Worker 安全

### 缓存策略

**必须使用版本化的缓存名称：**

```javascript
// ✅ 正确 - 版本化缓存名
const CACHE_NAME = 'dnd-assist-v0.5.0-modular';

// ❌ 错误 - 固定缓存名，更新困难
const CACHE_NAME = 'dnd-cache';
```

**必须清理旧缓存：**

```javascript
// ✅ 正确 - 激活时清理旧缓存
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
});
```

### 资源加载安全

**必须验证缓存的资源：**

```javascript
// ✅ 正确 - 验证响应
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            // 验证响应有效性
            if (response && response.status === 200) {
                return response;
            }
            return fetch(event.request);
        })
    );
});
```

## 隐私保护

### 本地数据隐私

**项目特点：**
- 所有数据存储在本地，不上传服务器
- 无用户追踪
- 无数据分析

**必须遵循：**

1. **不记录用户行为：**
   ```javascript
   // ✅ 正确 - 调试日志可选
   function debugLog(event) {
       // 默认关闭，用户可选择性启用
       if (typeof window.__DND_DEBUG_INGEST__ === 'function') {
           window.__DND_DEBUG_INGEST__(event);
       }
   }
   
   // ❌ 错误 - 自动发送日志到服务器
   function logUserAction(action) {
       fetch('/api/log', { method: 'POST', body: JSON.stringify(action) });
   }
   ```

2. **不收集用户信息：** 项目无用户注册，不收集任何个人信息

3. **数据导出透明：** 导出数据格式清晰，用户可查看所有内容

## 常见安全风险防护

### XSS 防护

**虽然项目主要是本地应用，但仍需注意：**

1. **用户输入转义：** Vue自动转义模板中的内容
   ```vue
   <!-- ✅ 正确 - Vue自动转义 -->
   <div>{{ userInput }}</div>
   
   <!-- ❌ 错误 - 使用v-html可能XSS -->
   <div v-html="userInput"></div>
   ```

2. **避免innerHTML：** 使用Vue的响应式绑定，避免直接操作DOM

### 数据注入防护

**必须验证所有外部数据：**

```javascript
// ✅ 正确 - 验证导入的怪物数据
function validateMonster(monster) {
    if (!monster.name || typeof monster.name !== 'string') {
        throw new Error('怪物名称无效');
    }
    if (typeof monster.cr !== 'number' || monster.cr < 0) {
        throw new Error('CR无效');
    }
    // 更多验证...
    return true;
}

// 导入时验证
async function importMonsters(monstersData) {
    for (const monster of monstersData) {
        validateMonster(monster);
    }
    await db.monsters.bulkAdd(monstersData);
}
```

## 最佳实践

### Do

- ✅ **验证所有用户输入**：文件、数值、文本
- ✅ **使用安全的JSON解析**：使用try-catch包裹JSON.parse
- ✅ **版本化数据库和缓存**：支持数据迁移
- ✅ **提供数据备份功能**：导出/导入
- ✅ **清理旧数据**：Service Worker清理旧缓存

### Don't

- ❌ **不要使用eval()**：绝对禁止执行动态代码
- ❌ **不要信任外部数据**：导入数据必须验证
- ❌ **不要记录敏感信息**：不记录用户操作到服务器
- ❌ **不要硬编码密钥**：项目无后端，但如有API调用需使用环境变量
- ❌ **不要忽略错误**：所有异步操作应有错误处理

## 数据迁移规范

### 数据库版本升级

**添加新版本时必须：**

1. **定义新版本：**
   ```javascript
   db.version(4).stores({
       monsters: '++id, name, cr, isCustom, newField',
       // 新增或修改索引
   });
   ```

2. **编写迁移逻辑：**
   ```javascript
   db.version(4).stores({...}).upgrade(async tx => {
       // 迁移现有数据
       const monsters = await tx.table('monsters').toArray();
       for (const monster of monsters) {
           if (!monster.newField) {
               monster.newField = defaultValue;
               await tx.table('monsters').put(monster);
           }
       }
   });
   ```

3. **测试迁移：** 在开发环境测试数据迁移

## 安全检查清单

**修改数据相关代码后检查：**

- [ ] 所有用户输入是否验证？
- [ ] 导入数据是否验证格式和完整性？
- [ ] 异步操作是否有错误处理？
- [ ] 是否使用了eval()或类似危险函数？
- [ ] 数据库版本是否更新（如需要）？
- [ ] Service Worker缓存版本是否更新？
