module.exports = {
    env: {
        browser: true,
        es2021: true,
        node: true
    },
    extends: [
        'eslint:recommended'
    ],
    parserOptions: {
        ecmaVersion: 2021,
        sourceType: 'module'
    },
    rules: {
        // 代码风格
        'indent': ['error', 4, { SwitchCase: 1 }],
        'quotes': ['error', 'single', { avoidEscape: true }],
        'semi': ['error', 'always'],
        'comma-dangle': ['error', 'never'],
        
        // 最佳实践
        'no-var': 'error',
        'prefer-const': 'warn',
        'no-console': 'off', // 项目需要console用于调试
        'no-debugger': 'warn',
        'no-eval': 'error',
        'no-unused-vars': ['warn', { 
            argsIgnorePattern: '^_',
            varsIgnorePattern: '^_'
        }],
        
        // ES6+
        'prefer-arrow-callback': 'warn',
        'arrow-spacing': ['error', { before: true, after: true }],
        'prefer-template': 'warn',
        'template-curly-spacing': ['error', 'never'],
        
        // 代码质量
        'eqeqeq': ['error', 'always'],
        'curly': ['error', 'all'],
        'brace-style': ['error', '1tbs'],
        'no-trailing-spaces': 'error',
        'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
        'eol-last': ['error', 'always'],
        
        // 导入导出
        'no-duplicate-imports': 'error'
    },
    globals: {
        // 浏览器全局
        'window': 'readonly',
        'document': 'readonly',
        'navigator': 'readonly',
        'console': 'readonly',
        
        // Service Worker全局
        'self': 'readonly',
        'caches': 'readonly',
        'fetch': 'readonly',
        
        // 项目特定（通过import map）
        'db': 'readonly',
        'utils': 'readonly',
        'state': 'readonly',
        'constants': 'readonly',
        'vue': 'readonly',
        'dexie': 'readonly'
    }
};
