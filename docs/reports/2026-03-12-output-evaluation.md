# Dataset Output Evaluation Report

Date: 2026-03-12
Dataset input: `input/samples/001-vfa-thinhntt-2026-03-10.jsonl`
Dataset output: `output/2026-03-11/*.json`
Scope: 36 input cases mapped to 36 output files by `origin.datasetItemId`

## Method

I evaluated each case on two separate axes:

1. Test-case alignment

Pass / Partial / Fail against `expectedText` or `expectedRule` in the input dataset. 2. Human translation quality
Good / Acceptable / Poor based on semantic accuracy, register, naturalness, and rule adherence.

This separation matters because the dataset contains both:

- closed expectations (`expectedText`)
- open constraints (`expectedRule`)

Several outputs differ from the reference wording but are still valid Vietnamese translations.

## Executive Summary

| Dimension                    | Result |
| ---------------------------- | ------ |
| Input cases read             | 36     |
| Output files read            | 36     |
| Missing mappings             | 0      |
| Test-case alignment: Pass    | 29     |
| Test-case alignment: Partial | 4      |
| Test-case alignment: Fail    | 3      |
| Human quality: Good          | 29     |
| Human quality: Acceptable    | 5      |
| Human quality: Poor          | 2      |

## Neutral Assessment

### Expected set quality

- Good as a functional regression set, especially for formatting, proper nouns, code, URL, and email-formula cases.
- Not a single gold standard for every sentence. Some `expectedText` values are only one acceptable rendering among many.
- Slightly narrower than the prompt policy in a few tech/business cases. Example: the prompt explicitly keeps terms like `project`, `release`, `meeting`, `deploy` in English.

### Service output quality

- Strong on straightforward semantic transfer, formatting preservation, and tech/business vocabulary.
- Weakest on fixed Japanese email formulas and some rule-heavy edge cases.
- Tends to over-polite or over-expand in keigo/email contexts.

## Most Important Findings

### Clear misses

| Case      | Why it missed                                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `vfa-011` | `お世話になっております` was translated as a concrete thank-you to customers, which is not the function of the source greeting. |
| `vfa-013` | `以上、よろしくお願いいたします` was turned into a request to review, adding meaning not present in the source.                 |
| `vfa-017` | Explicit rule said keep the technical unit unchanged, but `/giây` became `mỗi giây`.                                            |

### Partial misses worth attention

| Case      | Why it is only partial                                                                           |
| --------- | ------------------------------------------------------------------------------------------------ |
| `vfa-002` | `すみません` is ambiguous without context; output selected apology only.                         |
| `vfa-010` | Too formal and adds `Trân trọng`, which overstates the source.                                   |
| `vfa-020` | Japanese personal name was romanized and gendered instead of being kept as-is.                   |
| `vfa-035` | `整備` is closer to organizing/improving documentation; `tổ chức lại documentation` is narrower. |

### Where the service did well

- Formatting cases were generally good: multiline, brackets, code, URL.
- Tech/business register was mostly good and often better aligned with repo prompt rules than the reference wording.
- Many outputs were more natural than the literal `expectedText` while still preserving meaning.

## Pipeline Self-Review Mismatches

The pipeline's own `passed` flag did not fully align with dataset expectations:

| Case      | Pipeline | My verdict | Observation                                                              |
| --------- | -------- | ---------- | ------------------------------------------------------------------------ |
| `vfa-002` | Pass     | Partial    | Review accepted a narrow interpretation of an ambiguous source.          |
| `vfa-017` | Pass     | Fail       | Review did not enforce dataset-specific rule to keep the unit unchanged. |
| `vfa-019` | Fail     | Pass       | Review over-criticized a perfectly valid fixed proper noun.              |
| `vfa-021` | Fail     | Pass       | Review penalized a concise but still correct technical phrasing.         |

## Root Cause Analysis

Two code-level causes explain most of the mismatch:

1. The review prompt does not know the dataset's expected rules.
   In [packages/translation-prompt/src/sections/review.ts](/Users/phamau/Desktop/projects/research/chatwork-translation-bot/packages/translation-prompt/src/sections/review.ts#L64), the reviewer only receives:

- Skopos context
- original text
- current draft
  It does not receive `expectedRule` or any evaluation harness metadata, so it cannot reliably enforce case-specific constraints like:
- preserve ambiguity
- keep units unchanged
- keep names in original form

2. The review prompt is intentionally adversarial and the pass bar is high.
   [packages/translation-prompt/src/sections/review.ts](/Users/phamau/Desktop/projects/research/chatwork-translation-bot/packages/translation-prompt/src/sections/review.ts#L22) forces every persona to criticize even excellent drafts, and [packages/translation-prompt/src/sections/review.ts](/Users/phamau/Desktop/projects/research/chatwork-translation-bot/packages/translation-prompt/src/sections/review.ts#L34) makes `passed=true` only at `>= 9/10`. This creates false negatives on outputs that are actually acceptable in production.

There is also one prompt-level contributor:

- In [packages/translation-prompt/src/sections/language-layers.ts](/Users/phamau/Desktop/projects/research/chatwork-translation-bot/packages/translation-prompt/src/sections/language-layers.ts#L26), `よろしくお願いいたします` is mapped to `"Trân trọng cảm ơn" or "Mong nhận được sự hợp tác"`. That mapping helps explain the over-expanded keigo/email endings seen in `vfa-010` and `vfa-013`.

And one pipeline behavior to keep in mind:

- In [packages/translator/src/pipeline/pipeline.ts](/Users/phamau/Desktop/projects/research/chatwork-translation-bot/packages/translator/src/pipeline/pipeline.ts#L156), the final output is the first passing review or otherwise the best-scoring reviewed draft. That means reviewer bias directly shapes shipped text.

## Detailed Comparison

| Case           | Source                                                                          | Expected                                                                       | Output                                                                              | Test case | Human quality | Note                                                                      |
| -------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------- | ------------- | ------------------------------------------------------------------------- |
| 1 (`vfa-001`)  | ありがとう                                                                      | Cảm ơn                                                                         | Cảm ơn nhiều                                                                        | Pass      | Good          | Output tự nhiên hơn expected.                                             |
| 2 (`vfa-002`)  | すみません                                                                      | Xin lỗi / Xin phép                                                             | Xin lỗi ạ                                                                           | Partial   | Acceptable    | Mất tính mơ hồ của `すみません`; chọn một nghĩa cụ thể.                   |
| 3 (`vfa-003`)  | おはようございます                                                              | Chào buổi sáng                                                                 | Chào buổi sáng!                                                                     | Pass      | Good          | Đúng nghĩa, dấu `!` không ảnh hưởng.                                      |
| 4 (`vfa-004`)  | 箸で食べる                                                                      | Dịch đúng ngữ cảnh: Ăn bằng đũa                                                | Ăn bằng đũa                                                                         | Pass      | Good          | Đúng ngữ cảnh homonym.                                                    |
| 5 (`vfa-005`)  | 日本語を勉強しています                                                          | Tôi đang học tiếng Nhật                                                        | Mình đang học tiếng Nhật.                                                           | Pass      | Good          | Tự nhiên, hơi casual hơn expected với `Mình`.                             |
| 6 (`vfa-006`)  | 会議は3時に始まります                                                           | Cuộc họp bắt đầu lúc 3 giờ                                                     | Cuộc họp bắt đầu lúc 3 giờ.                                                         | Pass      | Good          | Đúng nghĩa và lịch trình.                                                 |
| 7 (`vfa-007`)  | この製品の品質は非常に高いです                                                  | Chất lượng sản phẩm này rất cao                                                | Sản phẩm này có chất lượng rất cao.                                                 | Pass      | Good          | Paraphrase tự nhiên, giữ nghĩa tốt.                                       |
| 8 (`vfa-008`)  | プロジェクトの進捗はいかがですか？                                              | Tiến độ dự án như thế nào rồi?                                                 | Tiến độ project thế nào ạ?                                                          | Pass      | Good          | `project` phù hợp prompt rule giữ IT/business terms bằng English.         |
| 9 (`vfa-009`)  | 納期は来週の金曜日です                                                          | Thời hạn giao hàng là thứ Sáu tuần sau                                         | Thứ Sáu tuần sau là hạn giao hàng.                                                  | Pass      | Good          | Đúng nghĩa deadline giao hàng.                                            |
| 10 (`vfa-010`) | ご確認のほどよろしくお願いいたします                                            | Dịch lịch sự: Kính nhờ anh/chị xác nhận                                        | Kính mong quý vị vui lòng xác nhận giúp. Trân trọng.                                | Partial   | Acceptable    | Quá trang trọng, thêm `Trân trọng` không có trong gốc.                    |
| 11 (`vfa-011`) | お世話になっております                                                          | Câu chào mở đầu email, dịch tự nhiên theo ngữ cảnh                             | Chân thành cảm ơn quý khách đã luôn hợp tác và hỗ trợ chúng tôi.                    | Fail      | Poor          | Sai lệch nghĩa câu chào email; chuyển thành lời cảm ơn cụ thể.            |
| 12 (`vfa-012`) | 添付ファイルをご確認ください                                                    | Vui lòng xem file đính kèm                                                     | Anh/chị vui lòng xem file đính kèm.                                                 | Pass      | Good          | Đúng và tự nhiên.                                                         |
| 13 (`vfa-013`) | 以上、よろしくお願いいたします                                                  | Câu kết thúc email lịch sự                                                     | Trên đây, kính mong quý vị xem xét. Trân trọng.                                     | Fail      | Poor          | Thêm ý `xem xét` không có trong gốc; kết thư chưa đúng chức năng.         |
| 14 (`vfa-014`) | できれば年内に！ 実装してみてください。                                         | Giữ nguyên cấu trúc xuống dòng trong bản dịch                                  | Nếu được, ưu tiên hoàn thành trong năm nay nhé! Anh/chị thử implement giúp nhé.     | Pass      | Good          | Giữ xuống dòng; nghĩa cơ bản ổn.                                          |
| 15 (`vfa-015`) | 【緊急】サーバーがダウンしています                                              | Giữ nguyên dấu【】trong bản dịch                                               | 【Khẩn cấp】Server đang down                                                        | Pass      | Good          | Giữ nguyên dấu `【】`; hợp ngữ cảnh tech chat.                            |
| 16 (`vfa-016`) | 売上が前年比120%増加しました                                                    | Doanh thu tăng 120% so với năm ngoái                                           | Doanh thu đã tăng 120% so với năm trước.                                            | Pass      | Good          | Đúng số liệu và ý nghĩa.                                                  |
| 17 (`vfa-017`) | 100 requests/giây                                                               | Giữ nguyên số liệu kỹ thuật, không dịch đơn vị                                 | 100 requests mỗi giây                                                               | Fail      | Acceptable    | Đổi `/giây` thành `mỗi giây`, vi phạm rule giữ nguyên đơn vị.             |
| 18 (`vfa-018`) | データベースのバックアップを毎日実行してください                                | Hãy thực hiện backup database hàng ngày                                        | Hãy chạy backup database mỗi ngày.                                                  | Pass      | Good          | Đúng technical command, tự nhiên trong môi trường tech.                   |
| 19 (`vfa-019`) | 東京スカイツリー                                                                | Tokyo Skytree                                                                  | Tokyo Skytree                                                                       | Pass      | Good          | Đúng hoàn toàn; internal reviewer ở đây chấm quá tay.                     |
| 20 (`vfa-020`) | 山田太郎さんに連絡してください                                                  | Giữ nguyên tên người Nhật, không dịch                                          | Anh/Chị vui lòng liên hệ anh Yamada Taro.                                           | Partial   | Acceptable    | Tên bị romanize và thêm giới tính/honorific; chưa thật sự `giữ nguyên`.   |
| 21 (`vfa-021`) | APIのエンドポイントは[https://api.example.comです](https://api.example.comです) | Giữ nguyên URL, không dịch                                                     | API endpoint: [https://api.example.com](https://api.example.com)                    | Pass      | Good          | Giữ nguyên URL và thông tin chính; lược câu cho gọn.                      |
| 22 (`vfa-022`) | const x = 10; // 変数の宣言                                                     | Giữ nguyên code, chỉ dịch comment nếu có                                       | const x = 10; // Khai báo biến                                                      | Pass      | Good          | Giữ nguyên code, dịch đúng comment.                                       |
| 23 (`vfa-023`) | このバグは修正済みです。次のリリースで反映されます。                            | Bug này đã được sửa. Sẽ được áp dụng trong bản phát hành tiếp theo.            | Bug này đã được sửa và sẽ có trong bản release tiếp theo.                           | Pass      | Good          | Đúng nghĩa, dùng `release` hợp tech context.                              |
| 24 (`vfa-024`) | お客様のご要望に応じて、カスタマイズが可能です                                  | Chúng tôi có thể tùy chỉnh theo yêu cầu của quý khách                          | Chúng tôi có thể tùy chỉnh theo yêu cầu của quý khách.                              | Pass      | Good          | Đúng và lịch sự.                                                          |
| 25 (`vfa-025`) | 品質管理部門からの指摘事項を共有します                                          | Tôi sẽ chia sẻ các điểm được chỉ ra từ bộ phận kiểm soát chất lượng            | Xin chia sẻ với anh/chị các mục được chỉ ra từ bộ phận Quản lý chất lượng.          | Pass      | Good          | Đúng nghĩa; hơi trang trọng nhưng chấp nhận được.                         |
| 26 (`vfa-026`) | 先ほどのミーティングの議事録を送ります                                          | Tôi gửi biên bản cuộc họp vừa rồi                                              | Em xin gửi anh/chị biên bản meeting vừa rồi.                                        | Pass      | Good          | Đúng nghĩa; dùng `meeting` phù hợp rule thuật ngữ.                        |
| 27 (`vfa-027`) | ご不明な点がございましたら、いつでもご連絡ください                              | Nếu có điều gì chưa rõ, xin vui lòng liên hệ với chúng tôi bất cứ lúc nào      | Nếu còn điều gì chưa rõ, quý khách cứ liên hệ chúng tôi bất cứ lúc nào.             | Pass      | Good          | Đúng nghĩa và tự nhiên.                                                   |
| 28 (`vfa-028`) | システムのメンテナンスのため、明日午前2時から4時まで停止します                  | Hệ thống sẽ ngừng hoạt động từ 2 giờ đến 4 giờ sáng ngày mai để bảo trì        | Hệ thống sẽ tạm ngừng hoạt động từ 2 giờ đến 4 giờ sáng ngày mai để bảo trì.        | Pass      | Good          | Đúng thông báo bảo trì.                                                   |
| 29 (`vfa-029`) | 新しい機能のリリースノートを確認してください                                    | Vui lòng xem release notes của tính năng mới                                   | Vui lòng xem release notes cho tính năng mới.                                       | Pass      | Good          | Đúng nghĩa; dùng `release notes` hợp context.                             |
| 30 (`vfa-030`) | セキュリティの観点から、パスワードの定期的な変更を推奨します                    | Từ góc độ bảo mật, chúng tôi khuyến nghị thay đổi mật khẩu định kỳ             | Để đảm bảo bảo mật, chúng tôi khuyến nghị quý khách thay đổi mật khẩu theo định kỳ. | Pass      | Good          | Đúng nghĩa và giọng điệu.                                                 |
| 31 (`vfa-031`) | コードレビューのコメントに返信してください                                      | Vui lòng trả lời các comment trong code review                                 | Vui lòng phản hồi các comment trong code review.                                    | Pass      | Good          | Đúng nghĩa và natural.                                                    |
| 32 (`vfa-032`) | このPRをマージする前にテストを通過させてください                                | Vui lòng để test pass trước khi merge PR này                                   | Trước khi merge PR này, vui lòng đảm bảo mọi test đều pass.                         | Pass      | Good          | Đúng nghĩa, natural cho dev workflow.                                     |
| 33 (`vfa-033`) | 本番環境へのデプロイは承認後に行ってください                                    | Việc deploy lên môi trường production phải được thực hiện sau khi có phê duyệt | Chỉ deploy lên môi trường production sau khi đã được phê duyệt.                     | Pass      | Good          | Đúng constraint về approval trước production deploy.                      |
| 35 (`vfa-035`) | チームの生産性向上のために、ドキュメントを整備しましょう                        | Hãy cải thiện tài liệu để nâng cao năng suất của nhóm                          | Để nâng cao năng suất của team, chúng ta hãy cùng tổ chức lại documentation.        | Partial   | Acceptable    | `整備` thiên về chỉnh đốn/hoàn thiện; output thành `tổ chức lại` hơi hẹp. |
| 36 (`vfa-036`) | 障害発生時の対応手順をフローチャートで作成してください                          | Vui lòng tạo flowchart cho quy trình xử lý sự cố                               | Vui lòng lập flowchart về thủ tục ứng phó khi xảy ra sự cố.                         | Pass      | Good          | Đúng nghĩa, đúng domain.                                                  |
| 37 (`vfa-037`) | 定期的なコードリファクタリングにより、技術的負債を解消しましょう                | Hãy giải quyết nợ kỹ thuật thông qua việc refactor code định kỳ                | Hãy refactor code định kỳ để giải quyết technical debt.                             | Pass      | Good          | Đúng nghĩa; `technical debt` và `refactor code` phù hợp tech register.    |
