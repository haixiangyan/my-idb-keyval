import {clear, del, entries, get, keys, set, values} from './lib'

keys().then((keys) => {
  console.log('keys', keys)
})

values().then((values) => {
  console.log('values', values)
})

entries().then((entries) => {
  console.log('entries', entries)
})
