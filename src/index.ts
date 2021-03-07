import {set, get, setMany, getMany, clear, del, keys, values, entries} from './lib'
import {uglyGet} from './ugly'

const key = 'name'
const value = '帅哥'

const inputKeys = ['age', 'gender']
const inputKeyvals: [IDBValidKey, any][] = [['age', 11], ['gender', '男人']]

// 绑定对应 idb-keyval 的方法
document.querySelector('#set').addEventListener('click', async () => {
  await set(key, value)
});
document.querySelector('#get').addEventListener('click', async () => {
  const value = await get(key);
  console.log('value: ' + value)
});
document.querySelector('#del').addEventListener('click', async () => {
  await del(key)
});
document.querySelector('#clear').addEventListener('click', async () => {
  await clear()
});
document.querySelector('#getMany').addEventListener('click', async () => {
  const values = await getMany(inputKeys)
  console.log('values: ' + values.join(', '))
});
document.querySelector('#setMany').addEventListener('click', async () => {
  await setMany(inputKeyvals)
});
document.querySelector('#keys').addEventListener('click', async () => {
  const resultKeys = await keys();
  console.log('keys: ' + resultKeys.join(', '))
});
document.querySelector('#values').addEventListener('click', async () => {
  const resultValues = await values();
  console.log('values: ' + resultValues.join(', '))
});
document.querySelector('#entries').addEventListener('click', async () => {
  const resultEntries = await entries();
  console.log('entries: ' + resultEntries.join(', '))
});
document.querySelector('#uglyGet').addEventListener('click', async () => {
  const value = uglyGet('hello')
  console.log('value: ' + value)
});
