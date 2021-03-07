const dbName = 'key-val'
const storeName = 'keyval'

export function uglyGet(key) {
  // 打开数据库
  const openDBRequest = indexedDB.open(dbName)

  // 创建表
  openDBRequest.onupgradeneeded = function (event) {
    openDBRequest.result.createObjectStore(storeName)
  }

  // 失败回调
  openDBRequest.onerror = () => console.log('出错啦')

  // 成功回调
  openDBRequest.onsuccess = () => {
    // 获取数据库
    const db = openDBRequest.result

    // 获取数据库里的 store
    const store = db.transaction(storeName, 'readonly').objectStore(storeName)

    // 获取值操作
    const getRequest = store.get(key);

    getRequest.onsuccess = function() {
      // 获取到值
      console.log(`获取 ${key} 成功`, this.result)
    }
    getRequest.onerror = function() {
      console.log(`获取 ${key} 失败`)
    }
  }
}
