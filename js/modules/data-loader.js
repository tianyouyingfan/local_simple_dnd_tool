/**
 * 数据加载与初始化模块
 */
import { db, seedIfEmpty } from './db.js';
export { seedIfEmpty };
import { monsters, abilities, pcs, actions, monsterGroups } from './state.js';
import { useToasts } from './use-toasts.js';

export async function loadAll() {
    monsters.value = await db.monsters.toArray();
    abilities.value = await db.abilities.toArray();
    pcs.value = await db.pcs.toArray();
    actions.value = await db.actions.toArray();
    monsterGroups.value = await db.monsterGroups.toArray();
}

export async function seedDemo() {
    const { toast } = useToasts();
    await seedIfEmpty();
    await loadAll();
    toast('已载入演示数据');
}
