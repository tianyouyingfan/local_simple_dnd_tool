/**
 * 数据导入导出模块
 */
import { db } from 'db';
import { safeJsonParse } from 'helpers';
import { loadAll } from 'data-loader';
import { useToasts } from 'use-toasts';

const { toast } = useToasts();

export async function exportAll() {
    const data = {
        meta: { app: 'dnd-assist-v2', exportedAt: new Date().toISOString(), version: 1 },
        monsters: await db.monsters.toArray(),
        abilities: await db.abilities.toArray(),
        pcs: await db.pcs.toArray(),
        actions: await db.actions.toArray(),
        monsterGroups: await db.monsterGroups.toArray(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `dnd-local-v2-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
}

export async function importAll(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const data = safeJsonParse(await file.text());
        if (!data?.monsters || !data?.abilities || !data?.pcs || !data?.actions || !data?.monsterGroups) {
            throw new Error('格式不完整');
        }
        if (!confirm('导入将清空并替换当前的怪物库、PC库、能力库、动作库和怪物组合。确定要继续吗？')) return;

        await db.transaction('rw', db.monsters, db.abilities, db.pcs, db.actions, db.monsterGroups, async () => {
            await db.monsters.clear(); await db.abilities.clear(); await db.pcs.clear();
            await db.actions.clear(); await db.monsterGroups.clear();
            await db.monsters.bulkAdd(data.monsters);
            await db.abilities.bulkAdd(data.abilities);
            await db.pcs.bulkAdd(data.pcs);
            await db.actions.bulkAdd(data.actions);
            await db.monsterGroups.bulkAdd(data.monsterGroups);
        });

        await loadAll();
        toast('导入成功');
    } catch (err) {
        alert('导入失败：' + err.message);
    } finally {
        e.target.value = '';
    }
}

