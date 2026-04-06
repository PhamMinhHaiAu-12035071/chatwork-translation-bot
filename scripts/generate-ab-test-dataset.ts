#!/usr/bin/env bun
// Generate A/B test dataset for prompt optimization validation

interface TestMessage {
  category: string
  count: number
  examples: string[]
}

// 100 messages across 5 categories testing different prompt aspects
const testCategories: TestMessage[] = [
  // ========== Japanese Romanization (30 messages) ==========
  // Core feature: Tests if optimized prompt maintains romanization quality
  {
    category: 'japanese-romanization',
    count: 30,
    examples: [
      '佐々木さんに確認をお願いします。',
      'デキスパート基本部の田中さんから連絡がありました。',
      '2nd開発チームとMTGを設定しました。',
      '山田様、お世話になっております。',
      'プロジェクトマネージャーの鈴木さんに報告しました。',
      '佐藤さんと高橋さんが参加予定です。',
      '株式会社ABCテクノロジーの件です。',
      '伊藤さん、ご確認ください。',
      'デザインチームの木村さんからの依頼です。',
      '1st開発、2nd開発、3rd開発の3チーム体制です。',
      '営業部の中村さんと打ち合わせしました。',
      'エンジニアリング部門の渡辺さんです。',
      'バックエンド開発の小林さんに相談してください。',
      '加藤さん、お疲れ様です。',
      'プロダクトオーナーの山本さんから承認をもらいました。',
      'QAチームの松本さんがテスト中です。',
      'インフラ担当の井上さんに確認済みです。',
      'デザイナーの木下さんが作成しました。',
      'セキュリティ担当の林さんからの指摘です。',
      '人事部の清水さんに連絡してください。',
      '総務の山崎さんが対応します。',
      '経理部の森さんからの請求書です。',
      '佐野さん、ありがとうございます。',
      'マーケティングの岡田さんが担当です。',
      'カスタマーサポートの前田さんからの報告です。',
      'データサイエンスチームの藤田さんです。',
      '開発リードの長谷川さんに相談しました。',
      'UIデザイナーの近藤さんのモックアップです。',
      'プロジェクトリーダーの石川さんからの指示です。',
      'テックリードの斎藤さんが対応します。',
    ],
  },

  // ========== English Casual (20 messages) ==========
  // Tests natural tone preservation without over-formalization
  {
    category: 'english-casual',
    count: 20,
    examples: [
      "Thanks for the heads up! I'll look into it.",
      'Could you maybe send that over when you get a chance?',
      'Just a quick update - the deployment went smoothly.',
      'No worries, I can handle that part.',
      'Heads up: we might need to reschedule the meeting.',
      'Sorry for the late reply, been swamped today.',
      'Great work on the PR! A few minor comments.',
      'Can we sync up sometime this week?',
      'FYI - the staging environment is down for maintenance.',
      "Let me know if you need any help with that.",
      'Quick question about the API endpoint...',
      "Sounds good! I'll ping you when it's ready.",
      'Btw, did you see the latest Slack thread?',
      'All good on my end, feel free to merge.',
      'Just circling back on this - any updates?',
      'Thanks again for catching that bug!',
      "I'll take a look at it first thing tomorrow.",
      'Not sure I follow - can you clarify?',
      'Awesome, that should fix the issue.',
      "Yep, makes sense. Let's go with that approach.",
    ],
  },

  // ========== Mixed Content (20 messages) ==========
  // Tests handling of Japanese + English in same message
  {
    category: 'mixed-content',
    count: 20,
    examples: [
      'MTGの件、佐々木さんに確認しました。Tomorrow at 2pm works.',
      'APIのドキュメントをupdateしておきました。',
      'Pull requestをmergeしました。田中さん、ご確認ください。',
      'Staging environmentで佐藤さんがテスト中です。',
      'デプロイは金曜日のEODに実施予定です。',
      'Code reviewありがとうございます。山田さんのコメント対応しました。',
      'Slackで鈴木さんにpingしておきます。',
      'Database migrationが完了しました。高橋さん、確認お願いします。',
      'Unit testを追加しました。Coverage is now at 85%.',
      'CI/CDパイプラインを修正しました。伊藤さん、ご確認ください。',
      'Performance issueを修正しました。Loadが50%改善しました。',
      'Security auditの結果、木村さんに報告済みです。',
      'Design mockupを中村さんと確認しました。Looks good!',
      'バグを再現できました。Reproduced on staging.',
      'Rollback完了しました。渡辺さん、ご確認ください。',
      'Hot fixをdeployしました。小林さんのレポート対応です。',
      'Monitoring alertが発火しました。加藤さん、対応お願いします。',
      'Feature flagをenableしました。山本さん、テストお願いします。',
      'Loggingを追加しました。Debugがしやすくなります。',
      'Configを更新しました。松本さん、再起動をお願いします。',
    ],
  },

  // ========== Long Messages (15 messages) ==========
  // Tests if optimized prompt maintains quality for longer context
  {
    category: 'long-messages',
    count: 15,
    examples: [
      `お疲れ様です。本日のMTGの件、以下の通り議事録を共有いたします。

参加者：佐々木さん、田中さん、山田さん
日時：4月5日 14:00-15:00

議題：
1. 2nd開発チームのスプリントレビュー
2. 次期リリースのスコープ確認
3. パフォーマンス改善の進捗

決定事項：
- デキスパート基本部との連携を強化
- 来週木曜日にステークホルダーMTG実施
- QA期間を1週間延長

次のアクションアイテム：
- 鈴木さん：要件定義書の更新
- 高橋さん：テスト計画の作成
- 伊藤さん：デザインレビューの準備

よろしくお願いいたします。`,

      `プロジェクト進捗報告です。

今週の主な成果：
✓ ユーザー認証機能の実装完了
✓ APIドキュメントの更新
✓ パフォーマンステストの実施
✓ セキュリティ監査の対応

課題と対策：
• データベースのレスポンスが遅い → インデックス追加で対応中
• テストカバレッジが70% → 目標85%に向けて追加中
• デプロイ手順の自動化が未完了 → 来週完了予定

来週の予定：
- 佐野さん：フロントエンド統合テスト
- 岡田さん：ユーザー受け入れテスト
- 前田さん：本番環境へのデプロイ準備

ご確認よろしくお願いします。`,

      `System alert: Production environment performance degradation detected.

Incident details:
- Time: 2024-04-05 09:30 JST
- Duration: 15 minutes
- Impact: API response time increased from 200ms to 3000ms
- Affected services: User authentication, Payment processing

Root cause:
Database connection pool exhausted due to long-running queries from the new reporting feature deployed yesterday.

Resolution:
1. Increased connection pool size from 10 to 50
2. Added query timeout (30s)
3. Implemented connection retry logic
4. Rolled back reporting feature temporarily

Action items:
- 藤田さん: Optimize reporting queries
- 長谷川さん: Add database monitoring alerts
- 近藤さん: Review query patterns

Status: Resolved. Monitoring for 24 hours.`,

      `Product roadmap update for Q2 2024:

Phase 1 (April): Foundation
- User management system (佐々木さん)
- Role-based access control (田中さん)
- API rate limiting (山田さん)

Phase 2 (May): Core Features
- Real-time notifications (鈴木さん)
- File upload/download (高橋さん)
- Search functionality (伊藤さん)

Phase 3 (June): Optimization
- Performance tuning (木村さん)
- Caching layer (中村さん)
- Load balancing (渡辺さん)

Dependencies:
- Infrastructure team: Kubernetes cluster ready by Apr 15
- Design team: UI/UX mockups by Apr 20
- QA team: Test environment setup by Apr 25

Risk mitigation:
• Timeline aggressive → Buffer 1 week per phase
• Resource constraints → Cross-training plan
• Technical debt → Dedicated refactoring sprints

Next sync: April 12, 2pm JST`,

      `Code review feedback for PR #1234:

Overall: Great work! The implementation is solid, just a few suggestions below.

✅ Strengths:
- Clean separation of concerns
- Comprehensive test coverage (92%)
- Well-documented functions
- Proper error handling

📝 Suggestions:

1. Performance (minor):
Line 45-60: Consider caching the database query results. This query runs on every request and the data changes rarely.

2. Type safety (moderate):
Line 78: Use strict typing instead of 'any'. Define proper interfaces for the API response.

3. Error handling (minor):
Line 120: Add specific error types instead of generic Error. Helps with debugging and monitoring.

4. Code style (nitpick):
Line 95: Extract magic number to a named constant. Makes the code more maintainable.

5. Testing (moderate):
Add integration test for the error path. Currently only happy path is covered.

After these changes, LGTM! 佐々木さん、確認お願いします。`,

      `障害報告：決済システムエラー

発生日時：2024年4月5日 10:30-11:15（45分間）
影響範囲：全ユーザーの決済処理
影響件数：約150件の決済失敗

原因：
外部決済APIのタイムアウト設定が5秒と短く、APIプロバイダー側のレスポンス遅延（平均8秒）により決済処理が失敗。

対応内容：
1. タイムアウトを30秒に延長
2. Retry logicを実装（3回まで再試行）
3. Circuit breakerパターンを追加
4. 失敗した決済の手動リカバリー実施

再発防止策：
• 外部API依存の処理に対する統一的なタイムアウト設定ガイドライン作成（小林さん担当）
• 決済処理の監視強化（アラート閾値を5分→1分に変更）（加藤さん担当）
• 負荷テストシナリオに外部API遅延パターンを追加（山本さん担当）

今後の予定：
- 4/8: 障害報告書の正式版完成
- 4/12: 再発防止策の実施完了
- 4/15: ステークホルダーへの報告会

ご確認よろしくお願いいたします。`,

      `プロジェクト振り返り（Sprint 23）

Team velocity: 42 story points (目標40 → +5% 達成！)

What went well: 😊
✓ コードレビューの質が向上した（平均フィードバック時間が24時間→4時間に短縮）
✓ CI/CDパイプラインの安定化（成功率95%→99%）
✓ チーム間のコミュニケーションが活発化（週次同期MTGが効果的）
✓ Technical debtの削減が進んだ（20%削減達成）

What could be improved: 🤔
• テストカバレッジがまだ目標（85%）に届いていない（現在78%）
• APIドキュメントの更新が遅れがち
• デザインレビューのフィードバックループが長い（平均3日）

Action items for next sprint:
1. 佐野さん：Test coverage向上計画の作成
2. 岡田さん：API doc自動生成の導入検討
3. 前田さん：Design review processの改善提案

Keep doing:
- Daily standup（朝9:30）継続
- Pair programming sessions（週2回）
- Knowledge sharing sessions（隔週金曜）

次回振り返り：4月19日 16:00-17:00`,

      `セキュリティ監査結果報告

監査期間：2024年3月15日-4月5日
監査範囲：Webアプリケーション全体（フロントエンド、バックエンド、インフラ）

Critical findings: 🔴
なし（Good news!）

High priority findings: 🟠
1. API認証トークンの有効期限が長すぎる（現在24時間 → 推奨1時間）
2. ログに機密情報が含まれている可能性（ユーザーIDやメールアドレス）

Medium priority findings: 🟡
1. CORS設定が広すぎる（現在'*' → 特定ドメインのみに制限推奨）
2. Rate limitingが一部のエンドポイントで未実装
3. SQLインジェクション対策は適切だが、Prepared statementの使用を統一すべき

Low priority findings: 🟢
1. HTTPヘッダーのセキュリティ設定を強化推奨（CSP, HSTS等）
2. 依存パッケージのバージョンが古い（3ヶ月以上更新なし）

対応計画：
High priority → 来週中に対応完了（藤田さん、長谷川さん担当）
Medium priority → 今月末までに対応（近藤さん、石川さん担当）
Low priority → 次のスプリントで対応（斎藤さん担当）

次回監査：6ヶ月後（2024年10月）`,

      `Migration plan: PostgreSQL 13 → 15

Background:
PostgreSQL 13のサポートが来年終了するため、早めにバージョンアップを実施。

Benefits:
✓ Performance improvements (10-20% faster queries)
✓ Better JSON handling
✓ Improved monitoring capabilities
✓ Security patches and bug fixes

Timeline:
Week 1 (Apr 8-12): Preparation
- Backup strategy verification
- Migration script testing on staging
- Team training on new features

Week 2 (Apr 15-19): Staging migration
- Execute migration on staging environment
- Run full regression tests
- Performance benchmark comparison

Week 3 (Apr 22-26): Production migration
- Maintenance window: Sunday Apr 23, 2am-6am JST
- Execute migration
- Monitoring and verification

Week 4 (Apr 29-May 3): Stabilization
- Monitor performance metrics
- Address any issues
- Update documentation

Team assignments:
- 佐々木さん: Migration script preparation
- 田中さん: Testing coordination
- 山田さん: Monitoring setup
- 鈴木さん: Rollback procedure
- 高橋さん: Documentation update

Rollback plan:
If critical issues occur within first 24 hours, we can rollback to PostgreSQL 13 using hot standbys (estimated downtime: 30 minutes).

Risk assessment:
High risk: Data corruption → Mitigation: Multiple backups, dry runs
Medium risk: Performance regression → Mitigation: Extensive benchmarking
Low risk: Application compatibility → Mitigation: Compatibility testing completed`,

      `お疲れ様です。来週のリリース計画を共有します。

Release: v2.5.0
Date: April 12, 2024 (Thursday) 18:00-20:00 JST

New features:
🎉 User notification system (佐野さん実装)
🎉 Advanced search with filters (岡田さん実装)
🎉 File export to CSV/Excel (前田さん実装)
🎉 Dark mode support (藤田さん実装)

Improvements:
⚡ API response time -30% (database optimization)
⚡ File upload limit 10MB → 50MB
⚡ Mobile UI responsiveness enhanced

Bug fixes:
🐛 Fixed pagination issue on user list (#234)
🐛 Fixed date format inconsistency (#245)
🐛 Fixed memory leak in real-time sync (#256)
🐛 Fixed broken links in documentation (#267)

Breaking changes:
⚠️ API v1 deprecated (v2 only from this release)
⚠️ Old mobile app versions (<2.0) no longer supported
→ Migration guide: https://docs.example.com/migration-v2.5

Pre-release checklist:
☐ All tests passing (target: 100% green)
☐ Security scan completed
☐ Performance benchmarks validated
☐ Database migration tested
☐ Rollback procedure verified
☐ Customer support team briefed
☐ Release notes published

Deployment steps:
1. Database migration (18:00-18:15)
2. Backend deployment (18:15-18:45)
3. Frontend deployment (18:45-19:00)
4. Smoke testing (19:00-19:30)
5. Monitoring (19:30-20:00)

On-call roster:
- Primary: 長谷川さん
- Secondary: 近藤さん
- Database: 石川さん
- Infrastructure: 斎藤さん

Post-release tasks:
- Monitor error rates for 24 hours
- Collect user feedback
- Update internal documentation
- Retrospective meeting: April 14, 3pm

ご確認よろしくお願いいたします！`,

      `API Design Review: /api/v2/users endpoint

Proposal:
Replace the current user management endpoints with a new RESTful design that follows industry best practices.

Current issues:
❌ Inconsistent naming (/getUser, /user/get, /fetchUserData)
❌ No pagination support
❌ Missing proper HTTP status codes
❌ Verbose response structure
❌ No API versioning

Proposed design:

GET /api/v2/users
- List all users with pagination
- Query params: page, limit, sort, filter
- Response: { data: [], pagination: { ... } }

GET /api/v2/users/:id
- Get single user by ID
- Response: { data: { ... } }

POST /api/v2/users
- Create new user
- Body: { email, name, role }
- Response: 201 Created

PUT /api/v2/users/:id
- Update user (full replacement)
- Body: { email, name, role }
- Response: 200 OK

PATCH /api/v2/users/:id
- Partial update
- Body: { name?: string, role?: string }
- Response: 200 OK

DELETE /api/v2/users/:id
- Soft delete (archive)
- Response: 204 No Content

Error handling:
400 Bad Request - Invalid input
401 Unauthorized - Missing/invalid token
403 Forbidden - Insufficient permissions
404 Not Found - Resource doesn't exist
409 Conflict - Email already exists
429 Too Many Requests - Rate limit exceeded
500 Internal Server Error - Server issue

Migration strategy:
Phase 1: Deploy v2 endpoints alongside v1 (parallel running)
Phase 2: Update client apps to use v2
Phase 3: Deprecate v1 (6 months notice)
Phase 4: Remove v1 endpoints

Team feedback needed:
@佐々木さん - Frontend integration impact?
@田中さん - Database schema changes required?
@山田さん - Performance implications?
@鈴木さん - Security considerations?

Target completion: End of April`,

      `Performance optimization results - Week 1

Baseline metrics (before optimization):
- API response time: P50 450ms, P95 1200ms, P99 3000ms
- Database query time: P50 200ms, P95 800ms, P99 2000ms
- Page load time: P50 2.5s, P95 5.0s, P99 8.0s
- Memory usage: 75% average, 90% peak
- CPU usage: 60% average, 85% peak

Optimizations implemented:

1. Database optimization (木村さん担当)
✓ Added indexes on frequently queried columns
✓ Optimized N+1 queries
✓ Implemented connection pooling
Result: Query time -40%

2. API caching (中村さん担当)
✓ Redis cache for static data
✓ ETags for conditional requests
✓ CDN integration
Result: Response time -35%

3. Frontend optimization (渡辺さん担当)
✓ Code splitting and lazy loading
✓ Image optimization (WebP format)
✓ Bundle size reduction (-45%)
Result: Load time -50%

4. Infrastructure tuning (小林さん担当)
✓ Auto-scaling configuration
✓ Load balancer optimization
✓ Database read replicas
Result: CPU usage -25%

After optimization:
- API response time: P50 280ms ↓38%, P95 750ms ↓38%, P99 1800ms ↓40%
- Database query time: P50 120ms ↓40%, P95 480ms ↓40%, P99 1200ms ↓40%
- Page load time: P50 1.2s ↓52%, P95 2.5s ↓50%, P99 4.0s ↓50%
- Memory usage: 60% average ↓20%, 75% peak ↓17%
- CPU usage: 45% average ↓25%, 65% peak ↓24%

ROI analysis:
- Cost savings: $500/month (reduced infrastructure)
- User satisfaction: +15% (faster experience)
- Support tickets: -20% (fewer timeouts)
- Conversion rate: +8% (better performance)

Next steps:
Week 2: Monitor stability and fine-tune
Week 3: A/B testing with traffic split
Week 4: Full rollout and documentation

Great work, team! 🎉`,

      `Incident postmortem: Service outage on April 5, 2024

Summary:
Complete service outage for 2 hours 15 minutes (11:30-13:45 JST) affecting all users globally.

Impact:
- 100% of users unable to access the service
- Approximately 5,000 active users affected
- 200+ support tickets received
- Estimated revenue loss: $15,000

Timeline:
11:25 - Deployment of v2.4.8 started
11:30 - Service became unresponsive
11:32 - First monitoring alert triggered
11:35 - On-call engineer (加藤さん) notified
11:40 - Incident escalated to team lead (山本さん)
11:45 - Root cause identified: database connection leak
12:00 - Rollback decision made
12:15 - Rollback completed
12:30 - Service partially restored
13:00 - Full functionality verified
13:45 - Incident closed

Root cause:
New connection pool configuration in v2.4.8 had a bug that prevented connections from being properly released. After 5 minutes, all 100 connections were exhausted, causing complete service failure.

Why our safeguards failed:
1. Staging environment uses only 10 connections (missed the bug)
2. Load testing didn't run long enough (5 min vs production >1 hour)
3. Gradual rollout was disabled for "minor" release
4. Connection monitoring alert threshold too high (80% vs should be 70%)

Action items (with owners):

Immediate (this week):
☐ Fix connection pool bug (松本さん) - DONE
☐ Add connection leak detection test (井上さん)
☐ Update staging to match production config (木下さん)

Short term (this month):
☐ Improve load testing duration (林さん)
☐ Re-enable gradual rollout for ALL releases (清水さん)
☐ Lower monitoring thresholds (山崎さん)
☐ Add connection pool metrics dashboard (森さん)

Long term (this quarter):
☐ Implement circuit breaker pattern (佐野さん)
☐ Add automated rollback on critical errors (岡田さん)
☐ Chaos engineering practice (前田さん)
☐ Quarterly disaster recovery drills (藤田さん)

Lessons learned:
1. "Minor" releases can have major impact
2. Production parity in staging is critical
3. Monitoring alerts need regular review
4. Gradual rollout is non-negotiable

Communication improvements:
- Status page update was 15 minutes late
- Customer email notification had wrong estimated recovery time
- Internal Slack channel had conflicting information

Follow-up:
- Team retrospective: April 8, 2pm
- Customer communication plan: April 9
- Board report: April 12
- Updated runbook: April 15

This was a serious incident. We need to learn from it and prevent similar issues. Thank you to everyone who helped resolve this quickly.

- 長谷川さん (Engineering Manager)`,

      `Database migration script review

File: migrations/2024-04-05-add-user-preferences.sql

Purpose: Add user_preferences table for storing per-user UI settings

Review comments:

1. Schema design: ✅ APPROVED
- Proper indexes on user_id and updated_at
- JSON column for flexible preferences
- Created/updated timestamps included
- Foreign key constraint to users table

2. Data migration: ⚠️ NEEDS ATTENTION
Line 45-60: The default preferences insert should be idempotent.
Current:
INSERT INTO user_preferences (user_id, preferences)
SELECT id, '{}'::jsonb FROM users;

Suggested:
INSERT INTO user_preferences (user_id, preferences)
SELECT id, '{}'::jsonb FROM users
WHERE id NOT IN (SELECT user_id FROM user_preferences)
ON CONFLICT (user_id) DO NOTHING;

3. Rollback script: ❌ MISSING
Please add a corresponding rollback migration:
migrations/2024-04-05-rollback-user-preferences.sql

Should include:
- DROP TABLE IF EXISTS user_preferences CASCADE;
- Cleanup of any dependent views/functions

4. Performance considerations: ✅ GOOD
- Migration uses batching for large user tables
- Estimated time: ~5 minutes for 1M users
- Indexes created CONCURRENTLY (no table lock)

5. Testing checklist:
☐ Tested on empty database
☐ Tested on database with existing users
☐ Tested rollback script
☐ Verified foreign key constraints
☐ Checked query performance with new indexes

6. Documentation: ⚠️ INCOMPLETE
Please update:
- docs/database/schema.md
- docs/api/user-preferences.md

After addressing items 2, 3, and 6: LGTM for staging deployment.

Reviewers:
@近藤さん - Database architecture
@石川さん - Application integration
@斎藤さん - Performance impact

Target deployment: April 10, 2am maintenance window`,

      `プロダクトロードマップ：AI機能統合計画

背景：
ユーザーからの要望が多い AI による自動化機能を段階的に導入します。
目標は生産性向上とユーザー体験の改善です。

Phase 1: 基本的な AI 機能 (Q2 2024)

1.1 スマート検索 (佐々木さんチーム)
- 自然言語による検索
- 検索結果の関連性ランキング
- 検索履歴からの学習
技術スタック: OpenAI embeddings, Vector database
スケジュール: 4月-5月

1.2 自動カテゴリー分類 (田中さんチーム)
- 投稿内容の自動タグ付け
- カテゴリー提案
- 類似コンテンツの検出
技術スタック: Fine-tuned classification model
スケジュール: 5月-6月

1.3 コンテンツ要約 (山田さんチーム)
- 長文の自動要約
- キーポイント抽出
- TL;DR 生成
技術スタック: GPT-4 with custom prompts
スケジュール: 6月

Phase 2: インタラクティブ AI (Q3 2024)

2.1 AI チャットアシスタント (鈴木さんチーム)
- FAQへの自動回答
- コンテキストを考慮した対話
- 適切な人間担当者へのエスカレーション
技術スタック: GPT-4 + RAG (Retrieval Augmented Generation)
スケジュール: 7月-8月

2.2 スマート提案機能 (高橋さんチーム)
- 次のアクション提案
- ワークフロー最適化
- リマインダー自動生成
技術スタック: Custom ML model + business logic
スケジュール: 8月-9月

2.3 コンテンツ生成支援 (伊藤さんチーム)
- テンプレート提案
- 下書き自動生成
- スタイル一貫性チェック
技術スタック: GPT-4 + fine-tuning
スケジュール: 9月

Phase 3: 高度な自動化 (Q4 2024)

3.1 ワークフロー自動化 (木村さんチーム)
- 繰り返しタスクの検出と自動化
- 条件分岐処理
- 他システムとの連携
技術スタック: Workflow engine + AI decision making
スケジュール: 10月-11月

3.2 予測分析 (中村さんチーム)
- トレンド予測
- リスク検出
- 最適なタイミング提案
技術スタック: Time series forecasting models
スケジュール: 11月-12月

3.3 パーソナライゼーション (渡辺さんチーム)
- ユーザー行動分析
- カスタマイズされた体験
- 個別最適化
技術スタック: Recommendation system + reinforcement learning
スケジュール: 12月

技術的考慮事項：

セキュリティ & プライバシー：
- ユーザーデータの暗号化
- AI モデルのオンプレミス展開オプション
- GDPR コンプライアンス確保
- データ保持ポリシーの明確化

パフォーマンス：
- API レスポンス時間 < 2秒
- バッチ処理によるコスト最適化
- キャッシング戦略
- 段階的ロールアウト

コスト管理：
- 月額 API コスト上限設定
- ユーザーあたりの利用制限
- プレミアムプランでの差別化
- ROI モニタリング

品質保証：
- AI 出力の検証プロセス
- ユーザーフィードバックループ
- A/B テスト
- 継続的な改善

リスクと対策：

High: AI が不適切な回答を生成
→ コンテンツフィルター、人間によるレビュー

Medium: API コストが予算を超過
→ 利用量モニタリング、段階的機能制限

Medium: ユーザー受容性が低い
→ 段階的導入、詳細なオンボーディング

Low: モデルのパフォーマンス劣化
→ 定期的な再トレーニング、バージョン管理

成功指標 (KPI):

ユーザー満足度：
- AI 機能利用率 > 60%
- NPS スコア +10 ポイント
- サポートチケット削減 -30%

ビジネスメトリクス：
- プレミアムプラン転換率 +15%
- ユーザー定着率 +20%
- 平均セッション時間 +25%

技術メトリクス：
- API レスポンス時間 < 2秒
- エラー率 < 1%
- 稼働率 > 99.9%

次のステップ：
- 4月10日: 技術選定会議
- 4月17日: プロトタイプデモ
- 4月24日: ベータテスター募集開始
- 5月1日: Phase 1 開発キックオフ

ご質問やフィードバックがあれば、お気軽にお知らせください！`,
    ],
  },

  // ========== Technical Content (15 messages) ==========
  // Tests handling of code, errors, technical terminology
  {
    category: 'technical',
    count: 15,
    examples: [
      `Error in production:
TypeError: Cannot read property 'map' of undefined
at UserList.render (UserList.tsx:42)
Stack trace available in Sentry.`,

      `Build failed on CI:
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree

Need to update package.json.`,

      `Database query optimization needed:
SELECT * FROM users WHERE created_at > NOW() - INTERVAL '30 days'
ORDER BY id DESC LIMIT 100;

Current execution time: 2.5s (too slow)`,

      `API endpoint response:
{
  "status": "success",
  "data": {
    "userId": 12345,
    "username": "tanaka",
    "email": "tanaka@example.com"
  },
  "timestamp": "2024-04-05T10:30:00Z"
}`,

      `Deploy command:
docker-compose up -d --build
docker-compose exec translator bun run db:migrate
docker-compose restart translator

All services healthy.`,

      `Git merge conflict in src/utils/api.ts:
<<<<<<< HEAD
const timeout = 5000;
=======
const timeout = 30000;
>>>>>>> feature/increase-timeout

Please resolve manually.`,

      `Performance benchmark results:
Baseline: 450ms avg response time
After optimization: 180ms (-60%)
Memory usage: 512MB → 320MB (-38%)
CPU usage: 65% → 45% (-31%)`,

      `Environment variables required:
DATABASE_URL=postgresql://user:pass@localhost:5432/db
REDIS_URL=redis://localhost:6379
API_KEY=your_api_key_here
NODE_ENV=production`,

      `Test coverage report:
Statements: 78.5% (target: 85%)
Branches: 72.3% (target: 80%)
Functions: 81.2% (target: 85%)
Lines: 79.1% (target: 85%)

Need to add tests for error paths.`,

      `Dockerfile optimization:
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
EXPOSE 3000
CMD ["node", "dist/index.js"]

Build time: 45s → 12s (-73%)`,

      `API rate limit exceeded:
HTTP 429 Too Many Requests
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1712345678

Retry after 60 seconds.`,

      `Regex pattern for validation:
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$/;
const phoneRegex = /^\\+?[1-9]\\d{1,14}$/;

Unit tests passing: ✓`,

      `SQL injection attempt blocked:
Blocked query: SELECT * FROM users WHERE id = '1 OR 1=1'
Source IP: 192.168.1.100
Action: Request rejected, IP added to blocklist`,

      `Kubernetes pod status:
NAME                     READY   STATUS    RESTARTS   AGE
translator-6d4f5b7-abc   1/1     Running   0          2d
webhook-logger-5f8c3-xy  1/1     Running   0          2d
dashboard-7a9b2c4-def    1/1     Running   1          2d

All pods healthy.`,

      `GraphQL query example:
query GetUser($id: ID!) {
  user(id: $id) {
    id
    name
    email
    posts {
      id
      title
      createdAt
    }
  }
}

Response time: 120ms`,
    ],
  },

  // ========== Edge Cases (15 messages) ==========
  // Tests handling of special characters, formatting, profanity
  {
    category: 'edge-cases',
    count: 15,
    examples: [
      'Fucking hell, the server crashed again!!!',
      'This is bullshit. The client keeps changing requirements.',
      'WTF is wrong with this code? Been debugging for 3 hours...',
      'Damn it, forgot to push before leaving yesterday.',
      'Holy shit, we actually shipped on time! 🎉',
      '¯\\\\_(ツ)_/¯ Not my problem anymore.',
      '(╯°□°)╯︵ ┻━┻ Table flip time!',
      'https://github.com/user/repo/pull/1234#issuecomment-567890',
      'Check out this awesome article: https://blog.example.com/2024/04/performance-optimization?utm_source=slack&utm_campaign=tech',
      '```javascript\nconst result = await fetch("/api/users");\nconsole.log(result);\n```',
      'Meeting at 2:30pm in 会議室A (Conference Room A)',
      'Price: $99.99 (税込 ¥11,000)',
      'Email: support@example.com | Phone: +81-3-1234-5678',
      '[URGENT] [CRITICAL] Production down! All hands on deck!!! 🚨🚨🚨',
      'TODO: Fix this hack before production // TODO: Actually test this lol',
    ],
  },
]

// Generate JSONL format for manual testing
function generateJSONL(): string {
  const allMessages: Array<{
    room_id: number
    account_id: number
    message_id: string
    body: string
    send_time: number
    _meta: {
      testId: string
      category: string
      index: number
    }
  }> = []

  let globalIndex = 1
  for (const category of testCategories) {
    for (let i = 0; i < category.examples.length; i++) {
      const testId = `${category.category}-${String(i + 1).padStart(2, '0')}`
      allMessages.push({
        room_id: 777777, // Dedicated A/B test room
        account_id: 12345,
        message_id: testId,
        body: `/translate vi ${category.examples[i]}`,
        send_time: Math.floor(Date.now() / 1000) + globalIndex * 60,
        _meta: {
          testId,
          category: category.category,
          index: globalIndex,
        },
      })
      globalIndex++
    }
  }

  return allMessages.map((msg) => JSON.stringify(msg)).join('\n')
}

// Generate summary report
function printSummary(): void {
  const totalMessages = testCategories.reduce((sum, cat) => sum + cat.count, 0)

  console.log('\n📊 A/B Test Dataset Summary\n')
  console.log('='.repeat(60))
  console.log(`\nTotal messages: ${totalMessages}`)
  console.log('\nBreakdown by category:\n')

  for (const category of testCategories) {
    const percentage = ((category.count / totalMessages) * 100).toFixed(0)
    console.log(`  ${category.category.padEnd(25)} ${String(category.count).padStart(3)} messages (${percentage}%)`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('\n✨ Key testing scenarios covered:\n')
  console.log('  ✓ Japanese romanization (佐々木さん, デキスパート基本部)')
  console.log('  ✓ English casual tone (heads up, FYI, btw)')
  console.log('  ✓ Mixed Japanese + English in same message')
  console.log('  ✓ Long messages (meeting minutes, roadmaps, incidents)')
  console.log('  ✓ Technical content (errors, code, configs)')
  console.log('  ✓ Edge cases (profanity, special chars, URLs)')
  console.log('\n🎯 Testing focus:\n')
  console.log('  • Romanization accuracy (baseline vs optimized)')
  console.log('  • Style differentiation maintained')
  console.log('  • Translation naturalness preserved')
  console.log('  • JSON format compliance')
  console.log('  • Token count reduction (-30% target)')
  console.log('  • Response time improvement\n')
}

async function main() {
  const testingDir = 'input/testing'
  const outputPath = `${testingDir}/prompt-ab-test.jsonl`

  // Generate JSONL
  const jsonl = generateJSONL()
  await Bun.write(outputPath, jsonl)

  // Print summary
  printSummary()

  console.log(`✅ Dataset generated: ${outputPath}`)
  console.log(`\n📝 Next steps:`)
  console.log(`1. Test baseline version: TRANSLATION_PROMPT_VERSION=baseline`)
  console.log(`2. Collect outputs: output/777777/`)
  console.log(`3. Test optimized version: TRANSLATION_PROMPT_VERSION=optimized`)
  console.log(`4. Collect outputs: output/777777/`)
  console.log(`5. Run comparison: bun run scripts/compare-prompts.ts`)
  console.log(`6. Review quality report\n`)
}

main().catch((error) => {
  console.error('❌ Failed to generate A/B test dataset:', error)
  process.exit(1)
})
