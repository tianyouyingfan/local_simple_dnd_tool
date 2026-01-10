## 根因
- 模板里点击按钮调用了 `setTempHp(...)`，但它没有在 `main.js` 的 `setup()` return 中暴露，所以 Vue 模板拿到的是 `undefined`，点击时报错。

## 修复方案（最小改动）
1. 在 [main.js](file:///c:/Users/ASUS/Desktop/study's/dqy_web/%E9%87%8D%E6%9E%84%E7%89%88D%26D_Tool/js/main.js) 把 `setTempHp` 加入从 `hp-status.js` 的导入列表（参考 [main.js:L43-L46](file:///c:/Users/ASUS/Desktop/study's/dqy_web/%E9%87%8D%E6%9E%84%E7%89%88D%26D_Tool/js/main.js#L43-L46)）。
2. 在 `setup()` 的 return 对象中，把 `setTempHp` 一并返回给模板（参考 [main.js:L183-L186](file:///c:/Users/ASUS/Desktop/study's/dqy_web/%E9%87%8D%E6%9E%84%E7%89%88D%26D_Tool/js/main.js#L183-L186)）。

## 验证方式
- 刷新页面后，在“HP 编辑”模态里输入虚假生命并点击“刷新”，确认控制台不再报 `setTempHp is not a function`，并且先攻队列能显示/更新“剩余虚假生命”。