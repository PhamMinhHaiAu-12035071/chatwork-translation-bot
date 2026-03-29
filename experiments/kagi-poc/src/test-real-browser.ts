import { translate } from './translator-real-browser'

console.log('Testing Kagi Translate with puppeteer-real-browser...')
console.log('Please wait...\n')

const result = await translate({
  text: 'こんにちは、今日はいい天気ですね',
  from: 'ja',
  to: 'vi',
})

console.log('\n✅ SUCCESS!')
console.log('Translation:', result)
