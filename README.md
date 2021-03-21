# 造一个 idb-keyval 轮子

> 项目源码：https://github.com/Haixiang6123/my-idb-keyval
> 
> 预览链接：[http://yanhaixiang.com/learn-idb-keyval/](http://yanhaixiang.com/learn-idb-keyval/)
> 
> 参考轮子：https://github.com/jakearchibald/idb-keyval


## 你真的会使用 indexdb 么

相信不少人看过阮一峰的 [《浏览器数据库 IndexedDB 入门教程》](https://www.ruanyifeng.com/blog/2018/07/indexeddb.html)。我自己的感觉是依然不会使用 indexedDB，感觉每一步操作都很简单但是就是不会把整个流程跑通。

正好最近用到了 [idb-keyval](https://www.npmjs.com/package/idb-keyval) 这个库，阅读了一下源码后终于是有点感觉了。下来就从一个简单的例子开始，一步步来造一个 idb-keyval 库吧。

## 一个简单的需求

我们都知道 localStorage 的用法，现在就用 indexedDB 来实现 localStorage 的用法。

## 丑陋的实现

根据阮一峰老师的教程，假如我们要实现 `getItem` 方法，用最最最原生的方法就是：

```ts
const dbName = 'key-val'
const storeName = 'keyval'

export function uglyGet(key: string) {
  // 打开数据库
  const openDBRequest = indexedDB.open(dbName)

  // 创建表
  openDBRequest.onupgradeneeded = function () {
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
```

上面做了以下操作：
* 打开 key-val 数据库
* 添加 keyval 对象仓库（如果没有的话）
* 获取 key 对应的 value 值，并显示 `this.result`

看看看看，现在取个 value 还有没有点规矩了？

![](https://upload-images.jianshu.io/upload_images/2979799-05f76273f5d50aaf.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240)

咱们的诉求是什么呀？是通过一个简单的 API 来获取一个 value，里面的逻辑应该只要调几个接口就够了。你让我造这么多个回调和监听，只为拿一个 value 值。丢不丢人？恶不恶心？难看不难看呐？

下面就来一步一步改造上面的代码。

## promisify

看到回调，很容易就想到了利用 Promise 来进行封装，封装之后就可以用 await-async 来写代码了，避免回调地狱。上面主要是 request 来执行一些操作，所以我们应该将这些操作进行 promisify：

```ts
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
    // @ts-ignore
    request.onerror = () => reject(request.error)
  });
}
```

然后可以改写成 promise.then 的写法：

```ts
export async function uglyGet(key) {
  // 打开数据库
  const openDBRequest = indexedDB.open(dbName)

  // 创建表
  openDBRequest.onupgradeneeded = () => openDBRequest.result.createObjectStore(storeName)

  // 失败回调
  return promisifyRequest(openDBRequest)
    .then(db => {
      // 获取数据库里的 store
      const store = db.transaction(storeName, 'readonly').objectStore(storeName)

      // 获取值操作
      const getRequest = store.get(key);

      return promisifyRequest(getRequest)
    })
    .then((value) => {
      console.log(`获取 ${key} 成功`, value)
      return value;
    })
    .catch(() => {
      console.log('出错啦')
    })
}
```

目前这个函数已经可以做到：
1. 返回 value，你会说：哦，原来刚刚那样写还很难返回值呢
2. 减少了一层回调

再优化一下，使用 async-await 的写法：

```ts
export async function uglyGet(key) {
  // 打开数据库
  const openDBRequest = indexedDB.open(dbName)

  // 创建表
  openDBRequest.onupgradeneeded = () => openDBRequest.result.createObjectStore(storeName)

  const db = await promisifyRequest(openDBRequest).catch(() => console.log('出错啦'))

  // 获取不到数据库的情况
  if (!db) {
    return console.log('出错啦');
  }

  // 获取数据库里的 store
  const store = db.transaction(storeName, 'readonly').objectStore(storeName)

  // 获取值操作
  const value = await promisifyRequest(store.get(key));

  console.log(`获取 ${key} 成功`, value)

  return value;
}
```

是不是感觉一下子就清爽了呢？

## 封装公共逻辑

OK，我们不妨再写个 uglySet 函数，你会发现从打开数据库到获取数据库里的对象仓库这里又要抄一遍。我与重复不共戴天，所以这里应该把公共的部分抽离出来。

```ts
/**
 * 创建/获取数据库
 * @param dbName
 * @param storeName
 */
export async function getDB(dbName: string, storeName: string) {
  // 打开/创建数据库
  const request = indexedDB.open(dbName)

  // 新建数据库与打开数据库是同一个操作。如果指定的数据库不存在，就会新建。
  request.onupgradeneeded = () => request.result.createObjectStore(storeName)
  
  // 将 request Promisify，解决回调地狱的问题
  const db = await promisifyRequest(request)
  
  if (!db) {
    throw new Error('出错啦')
  }
  
  return db;
}
```

使用的时候就可以这样了：

```ts
export async function uglyGet(key) {
  const db = await getDB(dbName, storeName)

  // 获取数据库里的 store
  const store = db.transaction(storeName, 'readonly').objectStore(storeName)

  // 获取值操作
  return await promisifyRequest(store.get(key));
}
```

但是我们发现`getDB()`和`db.transaction` 这两步还是很冗余，因为不管以后的 `set`，`del`，`clear` 都需要这两步，需要改的只是创建 transaction 时的 mode 和调用的 API `store.xxx()`，所以还要以再抽取逻辑：

```ts
/**
 * 创建数据库，并提供操作入口
 * @param dbName
 * @param storeName
 */
export async function createStore(dbName: string, storeName: string) {
  // 打开/创建数据库
  const request = indexedDB.open(dbName)

  // 新建数据库与打开数据库是同一个操作。如果指定的数据库不存在，就会新建。
  request.onupgradeneeded = () => request.result.createObjectStore(storeName)

  // 将 request Promisify，解决回调地狱的问题
  const db = await promisifyRequest(request);

  // 第一个参数为事务的模式，第二个参数为开发者的回调
  return async (txMode, callback) => {
    // 增、删、改、查都用事务处理，需要的入参有：
    // storeName：操作对象，txMode：事务模式
    return callback(db.transaction(storeName, txMode).objectStore(storeName))
  }
}
```

这个时候更简洁了，来看看调用 get() 的时候是怎么样的：

```ts
export async function uglyGet(key) {
  // 获取数据库里的 store
  const store = await createStore(dbName, storeName);
  // 执行获取 value
  return await store('readonly', store => promisifyRequest(store.get(key)))
}
```

看起来好爽呀，两行代码就OK了。

## 单例 Store

现在尝试把 set() 函数也写出来**(注意：这里的 put 函数第一个参数要为 value，第二个才是 key，理解上有点反人类)**：

```ts
export async function uglySet(key, value) {
  // 获取数据库里的 store
  const store = await createStore(dbName, storeName);
  // 执行获取 value
  return await store('readonly', store => promisifyRequest(store.put(value, key)))
}
```

我们又发现有重复了：`createStore`，难道我们每次都要打开数据库，创建事务？显然不科学。这里最好将 store 变成单例，只在第一次的时候就造好，以后一直用这个 store 就好了。

```ts
// 单例
let defaultStore: Store | null = null

/**
 * 获取单例 default store
 */
export async function getDefaultStore() {
  if (!defaultStore) {
    defaultStore = await createStore('key-val', 'keyval')
  }

  return defaultStore
}
```

再来改造 `uglyGet` 和 `uglySet`：

```ts
export async function uglyGet(key) {
  // 获取数据库里的 store
  const store = await getDefaultStore()
  // 执行获取 value
  return await store('readonly', store => promisifyRequest(store.get(key)))
}

export async function uglySet(key, value) {
  // 获取数据库里的 store
  const store = await getDefaultStore()
  // 执行获取 value
  return await store('readonly', store => promisifyRequest(store.put(value, key)))
}
```

还是有重复，我连 `getDefaultStore()` 都不想要了，所以最好的方法是在函数里加一个默认参数：

```ts
export async function get<T>(key: IDBValidKey, customStore = getDefaultStore()): Promise<T | undefined> {
  return (await customStore)('readonly', store => promisifyRequest(store.get(key)))
}
```

需要注意的是，这里的 customStore 的类型其实是一个 Promise<async function>，所以要先 `(await customStore)` 才能正常调用函数。

## 增、删、改、查

现在所有重复代码都优化完了，直接写增、删、改、查吧：

```ts
export async function get<T>(key: IDBValidKey, customStore = getDefaultStore()): Promise<T | undefined> {
  return (await customStore)('readonly', store => promisifyRequest(store.get(key)))
}

export async function set(key: IDBValidKey, value: any, customStore = getDefaultStore()): Promise<IDBValidKey> {
  // 注意：这里参数的顺序：第一个是 value，第二个才是 key
  return (await customStore)('readwrite', store => promisifyRequest(store.put(value, key)))
}

export async function del(key: IDBValidKey, customStore = getDefaultStore()) {
  return (await customStore)('readwrite', store => promisifyRequest(store.delete(key)))
}

export async function clear(customStore = getDefaultStore()) {
  return (await customStore)('readwrite', store => promisifyRequest(store.clear()))
}
```

有时候，我们可能会一次获取和设置一堆的 key-val，所以要提供批量操作的接口：

```ts
export async function getMany(keys: IDBValidKey[], customStore = getDefaultStore()): Promise<any[]> {
  return (await customStore)('readonly', store => {
    return Promise.all(keys.map(k => promisifyRequest(store.get(k))))
  })
}

export async function setMany(entries: [IDBValidKey, any][], customStore = getDefaultStore()): Promise<void> {
  return (await customStore)('readwrite', store => {
    entries.forEach(([k, v]) => store.put(v, k))
    return promisifyRequest(store.transaction)
  })
}
```

## 遍历所有 key-val

现在回过头来看我们的数据库，本质上我们把它当成了一个大 Object 而已，对于 Object 最重要的 API 莫过于 `keys()`，`values()` 和 `entries()` 了。

对于 `keys()` 的实现，可以用 `getAllKeys()` 来获取，但是这个 API 在 IE 和 Safari 上有兼容性的问题。这里我们使用遍历 cursor 的方法来实现，而且 cursor 天生就有 key 和 value，对这三个 API 的实现有很大的帮助。

获取所有 cursor 很简单：

```ts
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
```

只要不 continue 就说明已经读取完所有的 cursor 了。这里还有个小坑，当读完所有的 cursor 时候会调用 oncomplete 回调，其实 indexedDB 里的 transaction 还有 onabort 和 oncomplete 两个回调，所以当 promisify 的时候还要把这两个回调绑定到 reject 和 resolve：

```ts
export function promisifyRequest<T = undefined>(request: IDBRequest<T> | IDBTransaction): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    // @ts-ignore
    request.oncomplete = request.onsuccess = () => resolve(request.result)
    // @ts-ignore
    request.onabort = request.onerror = () => reject(request.error)
  });
}
```

这样 promisify 终于完美了。获取所有 cursor 后，实现这 3 个 API 就太简单了，下面直接给出实现：

```ts
export async function keys(customStore = getDefaultStore()): Promise<IDBValidKey[]> {
  const keys: IDBValidKey[] = []

  return eachCursor(
    (await customStore),
    cursor => keys.push(cursor.key)
  ).then(() => keys)
}

export async function values(customStore = getDefaultStore()): Promise<any[]> {
  const values: any[] = []

  return eachCursor(
    (await customStore),
    cursor => values.push(cursor.value)
  ).then(() => values)
}

export async function entries(customStore = getDefaultStore()): Promise<[IDBValidKey, any][]> {
  const entries: [IDBValidKey, any][] = []

  return eachCursor(
    (await customStore),
    cursor => entries.push([cursor.key, cursor.value])
  ).then(() => entries)
}
```

## 总结

1. 数据库里的所有操作本质上都是 request，而 requeset 又有对应的 `onsuccess`、`onerror`、`oncomplete`、`onabort` 回调
2. 将 request promisify 可以避免回调地狱的问题，上面 4 个回调每对回调都完美对应 Promise `resolve` 和 `reject`，所以 promisify 过程基本是无痛的
3. indexedDB 的公共逻辑是：打开数据库、创建对象仓库（如果没有的话）、创建事务，这里用 `createStore` 进行封装
4. indexedDB 每个操作不同地方在于 transaction 的 mode 和 API 的调用 `store.xxx()`，所以 createStore 不再返回 store 页是一个函数，参数就是 mode 和提供 store 的回调
5. `getAllKeys()` 在 Safari、IE 会有兼容性问题，因此，要遍历所有 cursor 的方法来获取 keys, values, entries
6. 遍历完 cursor 后会调用 oncomplete

## 感想

呼 ~ 写完觉得好累呀。

其实，一直都知道 indexedDB 的存在和它的 API。但是如果要我马上实现类似 `localStorage.getItem` 的 API 属实很难。今天看了 [idb-keyval](https://www.npmjs.com/package/idb-keyval) 的源码，真的觉得写得太好了（不过 async-await 语法是我自己加的），真正做到了小而美。

学习这些小库对自己收益是十分巨大的。每次一遍看下来，对API 设计、逻辑封装、工程组织、TS类型规范、注释这些东西会有重新的认识。

对于已经厌倦了写玩具项目的同学，真的十分推荐去看、抄、改进这些小库，比在公司写业务提高不知多少倍！
