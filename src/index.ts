import {clear, del, get, set} from './lib'

set('hello', 1).then(() => {
  get<string>('hello').then((value) => {
    console.log(value)
    // del('hello').then()
    clear()
  })
})
