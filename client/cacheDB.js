// cacheDB.js

const DB_NAME = 'cacheDB';
const STORE_NAME = 'cache';
const DB_VERSION = 1;
const DEFAULT_MAX_AGE = 3 * 24 * 60 * 60 * 1000; // 3天

// 调试日志封装
function logDebug(action, id, data) {
    if (typeof window !== 'undefined' && window.DEBUG_CACHE) {
        console.log(`[CacheDB][${new Date().toISOString()}] ${action}:`, id, data || '');
    }
}

// 打开数据库
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'key' });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

// 将 request 转 Promise
function promisifyRequest(req) {
    return new Promise((resolve, reject) => {
        if (!req || typeof req !== 'object') {
            reject(new Error('Invalid IndexedDB request'));
            return;
        }

        req.onsuccess = function () {
            resolve(req.result);
        };

        req.onerror = function () {
            reject(req.error);
        };
    });
}

/**
 * ✅ 设置缓存
 */
async function setCache(id, keyOrData, value) {
    if (!id) throw new Error('Cache item must have an id');

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // 获取已有记录
    const existing = await promisifyRequest(store.get(id));
    const data = existing && existing.data ? existing.data : {};

    // 合并数据
    if (typeof keyOrData === 'string') {
        data[keyOrData] = value;
    } else if (typeof keyOrData === 'object' && keyOrData !== null) {
        Object.assign(data, keyOrData);
    } else {
        throw new Error('Invalid cache data');
    }

    data.createdAt = Date.now();

    // 写入数据库
    const result = await promisifyRequest(store.put({ key: id, data }));
    logDebug('SET', id, data);
    return result;
}

/**
 * ✅ 获取缓存
 */
async function getCache(id, ...keys) {
    if (!id) throw new Error('Cache id is required');

    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const item = await promisifyRequest(store.get(id));

    if (!item || !item.data) {
        logDebug('GET_EMPTY', id);
        return {};
    }

    // 过期检查
    const now = Date.now();
    if (item.data.createdAt && item.data.createdAt + DEFAULT_MAX_AGE < now) {
        store.delete(id);
        logDebug('GET_EXPIRED', id);
        return {};
    }

    let result;
    if (keys.length === 0) {
        result = item.data || {};
    } else {
        result = {};
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            if (item.data.hasOwnProperty(k)) {
                result[k] = item.data[k];
            }
        }
    }

    logDebug('GET', id, result);
    return result;
}

/**
 * ✅ 删除缓存
 */
async function deleteCache(id) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const result = await promisifyRequest(store.delete(id));
    logDebug('DELETE', id);
    return result;
}

/**
 * ✅ 清理过期缓存
 */
async function clearExpiredCache(maxAge = DEFAULT_MAX_AGE) {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const allKeys = await promisifyRequest(store.getAllKeys());
    const now = Date.now();

    for (let i = 0; i < allKeys.length; i++) {
        const key = allKeys[i];
        const item = await promisifyRequest(store.get(key));
        if (item && item.data && item.data.createdAt + maxAge < now) {
            store.delete(key);
            logDebug('CLEAR_EXPIRED', key);
        }
    }
    return true;
}
/**
 * ✅ 清空所有缓存（只删除数据，不删除数据库）
 */
async function clearAllCache() {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    // 获取所有 key
    const keys = await promisifyRequest(store.getAllKeys());

    for (let i = 0; i < keys.length; i++) {
        store.delete(keys[i]);
        logDebug('DELETE', keys[i]);
    }

    logDebug('CLEAR_ALL_DATA', `共删除 ${keys.length} 条`);
    return true;
}


// CommonJS 导出
module.exports = {
    setCache,
    getCache,
    deleteCache,
    clearAllCache,
    clearExpiredCache
};
