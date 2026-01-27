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
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = `dnd-local-v2-export-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importAll(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const raw = safeJsonParse(await file.text());
        const meta = raw?.meta;
        if (meta && meta.app && meta.app !== 'dnd-assist-v2') throw new Error('导入文件不属于本应用');
        if (meta && meta.version && Number(meta.version) > 1) throw new Error('导入文件版本过新，请升级应用后再导入');

        const normalizeId = (v) => {
            const n = Number(v);
            if (!Number.isFinite(n)) return null;
            return n;
        };
        const hasDuplicateIds = (list) => {
            const seen = new Set();
            for (const item of list) {
                const id = normalizeId(item?.id);
                if (id == null) continue;
                if (seen.has(id)) return true;
                seen.add(id);
            }
            return false;
        };
        const stripInvalidIds = (list) => list.map(x => {
            if (!x || typeof x !== 'object') return x;
            const copy = { ...x };
            const id = normalizeId(copy.id);
            if (id == null) delete copy.id;
            else copy.id = id;
            return copy;
        });

        const data = {
            monsters: Array.isArray(raw?.monsters) ? raw.monsters : [],
            abilities: Array.isArray(raw?.abilities) ? raw.abilities : [],
            pcs: Array.isArray(raw?.pcs) ? raw.pcs : [],
            actions: Array.isArray(raw?.actions) ? raw.actions : [],
            monsterGroups: Array.isArray(raw?.monsterGroups) ? raw.monsterGroups : [],
        };
        const hasAny = Object.values(data).some(list => Array.isArray(list) && list.length > 0);
        if (!hasAny) throw new Error('格式不完整');

        data.monsters = stripInvalidIds(data.monsters);
        data.abilities = stripInvalidIds(data.abilities);
        data.pcs = stripInvalidIds(data.pcs);
        data.actions = stripInvalidIds(data.actions);
        data.monsterGroups = stripInvalidIds(data.monsterGroups);

        const stripIds = (list) => list.map(x => {
            if (!x || typeof x !== 'object') return x;
            const copy = { ...x };
            delete copy.id;
            return copy;
        });
        if (hasDuplicateIds(data.abilities)) data.abilities = stripIds(data.abilities);
        if (hasDuplicateIds(data.pcs)) data.pcs = stripIds(data.pcs);
        if (hasDuplicateIds(data.actions)) data.actions = stripIds(data.actions);
        if (hasDuplicateIds(data.monsterGroups)) data.monsterGroups = stripIds(data.monsterGroups);

        const monsterIds = new Set();
        let monstersNeedRepair = false;
        for (const m of data.monsters) {
            const id = normalizeId(m?.id);
            if (id == null) monstersNeedRepair = true;
            else monsterIds.add(id);
        }
        if (hasDuplicateIds(data.monsters)) monstersNeedRepair = true;

        let groupsNeedRepair = false;
        for (const g of data.monsterGroups) {
            if (!Array.isArray(g?.monsters)) continue;
            for (const gm of g.monsters) {
                const mid = normalizeId(gm?.monsterId);
                if (mid == null || !monsterIds.has(mid)) groupsNeedRepair = true;
            }
        }

        if (monstersNeedRepair || groupsNeedRepair) {
            const nameCounts = new Map();
            for (const m of data.monsters) {
                const name = m?.name;
                if (!name) continue;
                nameCounts.set(name, (nameCounts.get(name) || 0) + 1);
            }
            const hasDuplicateNames = Array.from(nameCounts.values()).some(n => n > 1);
            const ok = confirm(
                hasDuplicateNames
                    ? '检测到导入数据的怪物ID/组合引用不一致，且存在同名怪物。是否自动修复后继续导入？（同名情况下仅按ID修复，无法匹配的组合项会被丢弃；不修复将取消导入）'
                    : '检测到导入数据的怪物ID/组合引用不一致。是否自动修复后继续导入？（不修复将取消导入）'
            );
            if (!ok) throw new Error('已取消导入');

            const mappings = [];
            const repairedMonsters = data.monsters.map((m, idx) => {
                if (!m || typeof m !== 'object') return m;
                const copy = { ...m };
                const oldId = normalizeId(copy.id);
                const newId = idx + 1;
                copy.id = newId;
                mappings.push({ oldId, newId, name: copy.name });
                return copy;
            });
            data.monsters = repairedMonsters;

            const byOldId = new Map(mappings.filter(x => x.oldId != null).map(x => [x.oldId, x]));
            const byName = new Map();
            for (const x of mappings) {
                if (!x.name) continue;
                if (nameCounts.get(x.name) !== 1) continue;
                byName.set(x.name, x);
            }

            data.monsterGroups = data.monsterGroups.map(g => {
                if (!g || typeof g !== 'object') return g;
                const group = { ...g };
                delete group.id;
                if (!Array.isArray(group.monsters)) group.monsters = [];
                group.monsters = group.monsters.map(gm => {
                    if (!gm || typeof gm !== 'object') return null;
                    const item = { ...gm };
                    const oldMid = normalizeId(item.monsterId);
                    const mapped = (oldMid != null && byOldId.get(oldMid)) || (item.name && byName.get(item.name));
                    if (!mapped) return null;
                    item.monsterId = mapped.newId;
                    item.name = mapped.name;
                    item.count = Math.max(1, Math.floor(Number(item.count) || 1));
                    return item;
                }).filter(Boolean);
                return group;
            });
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
        const message = (err && typeof err === 'object' && 'message' in err && err.message)
            ? err.message
            : String(err || '未知错误');
        alert('导入失败：' + message);
    } finally {
        e.target.value = '';
    }
}
