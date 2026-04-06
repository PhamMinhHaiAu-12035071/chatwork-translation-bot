#!/usr/bin/env bun
// Generate provider benchmark dataset for manual testing

interface BenchmarkMessage {
  id: string
  category: 'short' | 'medium' | 'long' | 'technical'
  length: number
  sourceLang: 'ja' | 'en'
  text: string
  expectedRomanization?: string[]
  notes?: string
}

const benchmarkMessages: BenchmarkMessage[] = [
  // ========== SHORT MESSAGES (<100 chars) ==========
  {
    id: 'short-ja-1',
    category: 'short',
    length: 42,
    sourceLang: 'ja',
    text: 'お疲れ様です。明日のMTGは10時からです。',
    expectedRomanization: ['MTG'],
    notes: 'Simple greeting + meeting notification',
  },
  {
    id: 'short-ja-2',
    category: 'short',
    length: 38,
    sourceLang: 'ja',
    text: '了解しました。資料を準備しておきます。',
    notes: 'Acknowledgment + simple action',
  },
  {
    id: 'short-en-1',
    category: 'short',
    length: 38,
    sourceLang: 'en',
    text: 'Thanks for the update. See you tomorrow.',
    notes: 'Casual workplace thanks',
  },
  {
    id: 'short-en-2',
    category: 'short',
    length: 45,
    sourceLang: 'en',
    text: 'Could you please review the PR when you can?',
    notes: 'Polite request with technical term',
  },
  {
    id: 'short-ja-3',
    category: 'short',
    length: 35,
    sourceLang: 'ja',
    text: '佐々木さんに確認をお願いします。',
    expectedRomanization: ['Sasaki-san'],
    notes: 'Request with person name + honorific',
  },

  // ========== MEDIUM MESSAGES (100-500 chars) ==========
  {
    id: 'medium-ja-1',
    category: 'medium',
    length: 145,
    sourceLang: 'ja',
    text: '佐々木さんにご確認いただいた件ですが、デキスパート基本部の方で進めていただくことになりました。2nd開発チームと連携して進めます。',
    expectedRomanization: ['Sasaki-san', 'DExpert Kihon-bu', '2nd'],
    notes: 'Complex sentence with multiple proper nouns',
  },
  {
    id: 'medium-ja-2',
    category: 'medium',
    length: 168,
    sourceLang: 'ja',
    text: 'プロジェクトの進捗について報告します。フェーズ1は完了し、現在フェーズ2を進行中です。来週末までに完成予定です。ご不明な点がございましたら、お気軽にお声がけください。',
    notes: 'Progress report with phases and timeline',
  },
  {
    id: 'medium-en-1',
    category: 'medium',
    length: 185,
    sourceLang: 'en',
    text: 'I wanted to follow up on our discussion yesterday. Could we schedule a quick sync to align on the implementation approach? I have some concerns about the database schema changes.',
    notes: 'Follow-up request with technical context',
  },
  {
    id: 'medium-en-2',
    category: 'medium',
    length: 210,
    sourceLang: 'en',
    text: 'The deployment was successful, but we noticed some performance issues in production. The API response time increased from 200ms to 800ms. I\'ve attached the monitoring dashboard for your review.',
    notes: 'Issue report with metrics',
  },
  {
    id: 'medium-ja-3',
    category: 'medium',
    length: 132,
    sourceLang: 'ja',
    text: '田中さんと鈴木さんにレビューをお願いしました。修正箇所はdocs/README.mdとsrc/utils/helper.tsです。よろしくお願いいたします。',
    expectedRomanization: ['Tanaka-san', 'Suzuki-san'],
    notes: 'Code review request with file paths',
  },

  // ========== LONG MESSAGES (>500 chars) ==========
  {
    id: 'long-ja-1',
    category: 'long',
    length: 398,
    sourceLang: 'ja',
    text: `会議の議事録を共有します。

プロジェクト進捗について
- フェーズ1: 完了（佐々木さん担当）
- フェーズ2: 進行中（田中さん担当、来週末完了予定）
- フェーズ3: 未着手（鈴木さんアサイン予定）

デキスパート基本部との連携について、次回MTGで詳細を詰めます。APIの仕様書は添付ファイルをご確認ください。

ご不明な点がございましたら、お気軽にお声がけください。

よろしくお願いいたします。`,
    expectedRomanization: ['Sasaki-san', 'Tanaka-san', 'Suzuki-san', 'DExpert Kihon-bu', 'MTG', 'API'],
    notes: 'Meeting minutes with structure, multiple names',
  },
  {
    id: 'long-ja-2',
    category: 'long',
    length: 456,
    sourceLang: 'ja',
    text: `お疲れ様です。本日のデプロイ作業についてご報告します。

実施内容:
1. アプリケーションサーバーのバージョンアップ (v2.3.1 → v2.4.0)
2. データベースマイグレーション実行
3. キャッシュサーバーの再起動
4. ヘルスチェック確認

結果:
- すべての手順が正常に完了しました
- レスポンスタイムは平均200msから150msに改善
- エラー率は0.1%以下を維持

次回作業予定:
- 来週火曜日: ログ監視システムの更新
- 来週木曜日: バックアップシステムの点検

引き続きよろしくお願いいたします。`,
    notes: 'Deployment report with versioning and metrics',
  },
  {
    id: 'long-en-1',
    category: 'long',
    length: 512,
    sourceLang: 'en',
    text: `Hi team,

I wanted to share some updates on the Q1 roadmap planning:

Technical Infrastructure:
- Migrate from monolith to microservices architecture (Q1-Q2)
- Implement distributed tracing with OpenTelemetry
- Set up automated performance regression testing

Product Features:
- User authentication with SSO support (Priority: High)
- Real-time collaboration features (Priority: Medium)
- Advanced analytics dashboard (Priority: Low)

We'll need to coordinate with the DevOps team for the infrastructure changes. I've scheduled a kick-off meeting for next Monday at 2 PM.

Please review the attached RFC document and share your feedback by end of week.

Thanks,
John`,
    notes: 'Roadmap planning with priorities and action items',
  },

  // ========== TECHNICAL MESSAGES ==========
  {
    id: 'technical-en-1',
    category: 'technical',
    length: 285,
    sourceLang: 'en',
    text: `The API rate limit has been exceeded. Current usage: 1500 requests/hour.

Recommended solutions:
1. Implement exponential backoff with jitter
2. Add request queuing with priority
3. Consider upgrading to Business tier (5000 req/hr)

See docs: https://api.example.com/docs/rate-limits`,
    notes: 'Error message with technical recommendations',
  },
  {
    id: 'technical-ja-1',
    category: 'technical',
    length: 245,
    sourceLang: 'ja',
    text: `エラーが発生しています。

エラーコード: ERR_CONNECTION_TIMEOUT
エラーメッセージ: Connection to database timed out after 30 seconds

対処方法:
1. データベース接続の設定を確認してください
2. ネットワークの状態を確認してください
3. データベースサーバーのログを確認してください

詳細はhttps://docs.example.com/troubleshootingをご覧ください。`,
    notes: 'Error message with code and troubleshooting steps',
  },
  {
    id: 'technical-en-2',
    category: 'technical',
    length: 298,
    sourceLang: 'en',
    text: `Build failed: TypeScript compilation error

src/utils/validator.ts:45:12 - error TS2345: Argument of type 'string | undefined' is not assignable to parameter of type 'string'.

Possible fixes:
1. Add null check before calling the function
2. Use optional chaining: value?.trim()
3. Provide default value: value ?? ''`,
    notes: 'Build error with code location and fixes',
  },
  {
    id: 'technical-ja-2',
    category: 'technical',
    length: 312,
    sourceLang: 'ja',
    text: `パフォーマンス問題を検出しました。

問題箇所: src/services/data-processor.ts
実行時間: 2.5秒 (目標: 500ms以下)

最適化案:
1. データベースクエリをバッチ処理に変更
2. 不要なN+1クエリを削減
3. キャッシュレイヤーを追加 (Redis推奨)
4. インデックスの追加を検討

ベンチマーク結果: output/benchmarks/2024-03-15.json`,
    expectedRomanization: ['Redis'],
    notes: 'Performance issue with optimization suggestions',
  },
]

// Generate JSONL format for dataset-runner
function generateDatasetJSONL(): string {
  return benchmarkMessages
    .map((msg, index) => {
      const roomId = 999999 // Test room ID
      const accountId = 12345 // Test account ID
      const timestamp = Math.floor(Date.now() / 1000) + index * 60 // Stagger by 1 minute

      return JSON.stringify({
        room_id: roomId,
        account_id: accountId,
        message_id: `${timestamp}-${msg.id}`,
        body: `/translate vi ${msg.text}`,
        send_time: timestamp,
        _meta: {
          benchmarkId: msg.id,
          category: msg.category,
          sourceLang: msg.sourceLang,
          textLength: msg.length,
          expectedRomanization: msg.expectedRomanization,
          notes: msg.notes,
        },
      })
    })
    .join('\n')
}

// Generate summary report
function generateSummary(): void {
  const byCategory = {
    short: benchmarkMessages.filter(m => m.category === 'short'),
    medium: benchmarkMessages.filter(m => m.category === 'medium'),
    long: benchmarkMessages.filter(m => m.category === 'long'),
    technical: benchmarkMessages.filter(m => m.category === 'technical'),
  }

  const byLang = {
    ja: benchmarkMessages.filter(m => m.sourceLang === 'ja'),
    en: benchmarkMessages.filter(m => m.sourceLang === 'en'),
  }

  console.log('📊 Provider Benchmark Dataset Summary')
  console.log('='.repeat(60))
  console.log(`\nTotal messages: ${benchmarkMessages.length}`)
  console.log('\nBy Category:')
  console.log(`  Short (<100 chars):     ${byCategory.short.length} messages`)
  console.log(`  Medium (100-500 chars): ${byCategory.medium.length} messages`)
  console.log(`  Long (>500 chars):      ${byCategory.long.length} messages`)
  console.log(`  Technical:              ${byCategory.technical.length} messages`)
  console.log('\nBy Language:')
  console.log(`  Japanese: ${byLang.ja.length} messages`)
  console.log(`  English:  ${byLang.en.length} messages`)
  console.log('\nWith Romanization:')
  const withRoman = benchmarkMessages.filter(m => m.expectedRomanization && m.expectedRomanization.length > 0)
  console.log(`  ${withRoman.length} messages contain names/terms requiring romanization`)
  console.log('\n' + '='.repeat(60))
}

async function main() {
  // Create input/testing directory if it doesn't exist
  const testingDir = 'input/testing'
  await Bun.write(`${testingDir}/.gitkeep`, '')

  // Generate JSONL dataset
  const jsonl = generateDatasetJSONL()
  const outputPath = `${testingDir}/provider-benchmark.jsonl`
  await Bun.write(outputPath, jsonl)

  // Print summary
  generateSummary()

  console.log(`\n✅ Dataset generated: ${outputPath}`)
  console.log(`\n📝 Next steps:`)
  console.log(`1. Review the dataset in ${outputPath}`)
  console.log(`2. Read manual testing guide: docs/testing/provider-benchmark-guide.md`)
  console.log(`3. Start translator: docker-compose up`)
  console.log(`4. Send test messages via Chatwork or dataset-runner`)
  console.log(`5. Collect output traces for analysis\n`)
}

main().catch((error) => {
  console.error('❌ Failed to generate dataset:', error)
  process.exit(1)
})
