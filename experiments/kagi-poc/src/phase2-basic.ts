import { translate } from './translator'

const TEXT = 'こんにちは、今日はいい天気ですね'

console.log(`Translating: ${TEXT}`)
console.log('From: Japanese → To: Vietnamese')
console.log('Please wait...\n')

const result = await translate({
  text: TEXT,
  from: 'ja',
  to: 'vi',
})

console.log(`Translation: ${TEXT}`)
console.log(`→ ${result}`)
