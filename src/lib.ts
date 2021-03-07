type Api = <T>(
  txMode: IDBTransactionMode,
  callback: (store: IDBObjectStore) => T | PromiseLike<T>
) => Promise<T>

/**
 * 将 request 变为 Promise 对象
 * indexeddb 操作成功后会调用 onsuccess，因此绑定到 resolve
 * indexeddb 操作失败后会调用 onerror，因此绑定到 reject
 * @param request
 */
export function promisifyRequest<T = undefined>(request: IDBRequest<T> | IDBTransaction): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // @ts-ignore
    request.onsuccess = () => resolve(request.result)

    request.onerror = () => reject(request.error)
  });
}

/**
 * 创建数据库，并提供操作入口
 * @param dbName
 * @param storeName
 */
export function createStore(dbName: string, storeName: string): Api {
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


