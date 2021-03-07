type Store = <T>(
  txMode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => T | PromiseLike<T>
) => Promise<T>

let defaultStore: Store | null = null

/**
 * 将 request 变为 Promise 对象
 * indexeddb 操作成功后会调用 onsuccess，因此绑定到 resolve
 * indexeddb 操作失败后会调用 onerror，因此绑定到 reject
 * @param request
 */
export function promisifyRequest<T = undefined>(request: IDBRequest<T> | IDBTransaction): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // @ts-ignore
    request.oncomplete = request.onsuccess = () => resolve(request.result)
    // @ts-ignore
    request.onabort = request.onerror = () => reject(request.error)
  });
}

/**
 * 创建数据库，并提供操作入口
 * @param dbName
 * @param storeName
 */
export function createStore(dbName: string, storeName: string): Store {
  // 打开/创建数据库
  const request = indexedDB.open(dbName)

  // 新建数据库与打开数据库是同一个操作。如果指定的数据库不存在，就会新建。
  request.onupgradeneeded = () => request.result.createObjectStore(storeName)

  // 将 request Promisify，解决回调地狱的问题
  const requestPromise = promisifyRequest(request);

  // 第一个参数为事务的模式，第二个参数为开发者的回调
  return (txMode, callback) =>
    // 成功后的回调
    requestPromise.then((db) =>
      // 增、删、改、查都用事务处理，需要的入参有：
      // storeName：操作对象，txMode：事务模式
      callback(db.transaction(storeName, txMode).objectStore(storeName))
    )
}

/**
 * 获取单例 default store
 */
export function getDefaultStore() {
  if (!defaultStore) {
    defaultStore = createStore('key-val', 'keyval')
  }

  return defaultStore
}

/**
 * 根据 key 获取对应 value
 * @param key 传入的 key
 * @param customStore 自定义 store 获取 defaultStore
 */
export function get<T>(key: IDBValidKey, customStore = getDefaultStore()): Promise<T | undefined> {
  return customStore('readonly', store => promisifyRequest(store.get(key)))
}

/**
 * 批量获取 values
 * @param keys 传入的 keys
 * @param customStore 自定义 store 获取 defaultStore
 */
export function getMany(keys: IDBValidKey[], customStore = getDefaultStore()): Promise<any[]> {
  return customStore('readonly', store => {
    return Promise.all(keys.map(k => promisifyRequest(store.get(k))))
  })
}

/**
 * 设置 key-value 对，key 不存在则创建，key 存在则覆盖
 * @param key 传入的 key
 * @param value 传入的 value
 * @param customStore 自定义 store 获取 defaultStore
 */
export function set(key: IDBValidKey, value: any, customStore = getDefaultStore()): Promise<IDBValidKey> {
  // 注意：这里参数的顺序：第一个是 value，第二个才是 key
  return customStore('readwrite', store => promisifyRequest(store.put(value, key)))
}

/**
 * 批量设置 key-value 对
 * @param entries 传入的键值对
 * @param customStore 自定义 store 获取 defaultStore
 */
export function setMany(entries: [IDBValidKey, any][], customStore = getDefaultStore()): Promise<void> {
  return customStore('readwrite', store => {
    entries.forEach(([k, v]) => store.put(v, k))
    return promisifyRequest(store.transaction)
  })
}

/**
 * 根据 key 删除对应的 key-value 对
 * @param key 传入的 key
 * @param customStore 自定义 store 获取 defaultStore
 */
export function del(key: IDBValidKey, customStore = getDefaultStore()) {
  return customStore('readwrite', store => promisifyRequest(store.delete(key)))
}

/**
 * 清除数据库内容
 * @param customStore 自定义 store 获取 defaultStore
 */
export function clear(customStore = getDefaultStore()) {
  return customStore('readwrite', store => promisifyRequest(store.clear()))
}

/**
 * 通过 cursor 获取 storeObject 里的所有 key-value
 * @param customStore
 * @param callback
 */
function eachCursor(customStore: Store, callback: (cursor: IDBCursorWithValue) => void): Promise<void> {
  return customStore('readonly', store => {
    store.openCursor().onsuccess = function(this) {
      if (!this.result) return
      callback(this.result)
      this.result.continue()
    }

    return promisifyRequest(store.transaction)
  })
}

/**
 * 获取数据库里所有 keys
 * @param customStore
 */
export function keys(customStore = getDefaultStore()): Promise<IDBValidKey[]> {
  const keys: IDBValidKey[] = []

  return eachCursor(
    customStore,
    cursor => keys.push(cursor.key)
  ).then(() => keys)
}

/**
 * 获取数据库里所有 values
 * @param customStore
 */
export function values(customStore = getDefaultStore()): Promise<any[]> {
  const values: any[] = []

  return eachCursor(
    customStore,
    cursor => values.push(cursor.value)
  ).then(() => values)
}

/**
 * 获取数据库里所有 entries
 * @param customStore
 */
export function entries(customStore = getDefaultStore()): Promise<[IDBValidKey, any][]> {
  const entries: [IDBValidKey, any][] = []

  return eachCursor(
    customStore,
    cursor => entries.push([cursor.key, cursor.value])
  ).then(() => entries)
}
