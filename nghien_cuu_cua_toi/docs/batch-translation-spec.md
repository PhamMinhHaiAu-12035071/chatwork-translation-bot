---
Version: 1.0
Date: 2026-04-16
Prepared by: AI-assisted (Claude Sonnet 4.6) — all decisions user-confirmed
Status: ACCEPTED
Feature: batch-message-translation
---

# Batch Message Translation — Design Spec

## Objective

Mở rộng từ single-message sang **multi-message batch translation**: đọc danh sách messages từ
file JSON, translate tuần tự, mỗi item chạy trong tab Chrome riêng (tab cũ bị đóng ngay sau
khi tab mới mở).

---

## Scope

**In-scope:**

- Đọc danh sách messages từ `inputs/messages.json` (hoặc path override qua `INPUT_FILE` env var)
- Sequential batch translation — từng item một, không parallel
- Tab lifecycle: reuse tab[0], open new tab + close prev cho item[1]+
- Auto-close browser sau khi batch xong
- Fail-fast: abort toàn bộ nếu bất kỳ item nào lỗi
- Docker: volume mount `./inputs:/app/inputs`
- Error guidance khi file input không tồn tại

**Out-of-scope:**

- Per-message translation options (reading level, formality khác nhau từng item)
- Parallel translation (nhiều tab cùng lúc)
- Output ghi ra file (chỉ console stdout)
- Delay giữa các messages
- Reading level sweep với nhiều levels (vẫn giữ config c2 global)

---

## Non-goals

- Không thay đổi `TranslationOptions` schema
- Không thêm retry logic cho từng item
- Không thêm progress bar hay fancy UI
- Không hỗ trợ stdin piping

---

## Definition of Done

```bash
bun test && bun run typecheck && bun run lint
```

Thêm vào:

- `bun run start:local` với `inputs/messages.json` chứa ≥2 items chạy thành công
- Console log rõ ràng từng item đang được xử lý
- Khi file không tồn tại: exit(1) với error message rõ ràng

---

## Actors & Environment

| Actor                 | Mô tả                                            |
| --------------------- | ------------------------------------------------ |
| Developer             | Chạy `bun run start:local` hoặc `bun run start`  |
| inputs/messages.json  | File input chứa danh sách messages cần translate |
| Chromium (patchright) | Browser instance, quản lý tabs                   |
| Kagi Translate        | Target service tại translate.kagi.com            |

---

## Core Flow

```
┌─────────────────────────────────────────────────┐
│ START: bun run start:local                       │
└──────────────────────────┬──────────────────────┘
                           │
                    readInputFile()
                           │ error if not found
                    validateMessages()
                           │ error if empty/invalid
                           │
                    browserService.launch()
                    browserService.setupSession()
                      ├── navigate kagi.com/signin
                      ├── inject cookies
                      └── verify kagi.com/settings
                           │
              ┌────────────▼────────────┐
              │   for each message[i]   │
              └────────────┬────────────┘
                           │
              ┌────────────▼────────────┐
              │  i === 0?               │
              │  YES → reuse current tab│
              │  NO  → openNewTab()     │
              │         translate()     │
              │         closePrevTab()  │
              └────────────┬────────────┘
                           │
                    log result to console
                           │
                    ┌──────▼──────┐
                    │ more items? │◄──── if error: throw, close browser, exit(1)
                    └──────┬──────┘
                           │ done
                    browserService.close()
                           │
                    print batch summary
                           │
                         END
```

---

## Tab Lifecycle

| Item       | Tab action                                                          | Note                       |
| ---------- | ------------------------------------------------------------------- | -------------------------- |
| Item[0]    | Navigate tab hiện tại (từ sau verify login) sang translate.kagi.com | Không mở tab mới           |
| Item[1]    | Mở tab mới → translate → đóng tab[0]                                | `page.context().newPage()` |
| Item[2]    | Mở tab mới → translate → đóng tab[1]                                |                            |
| Item[N]    | Mở tab mới → translate → đóng tab[N-1]                              |                            |
| After last | `browserService.close()` — đóng toàn bộ browser                     |                            |

**Không có delay** giữa các items (tab mới bắt đầu từ trạng thái sạch).

---

## Input File Format

**Default path:** `inputs/messages.json` (tính từ `process.cwd()`)
**Docker path:** `/app/inputs/messages.json`
**Override:** `INPUT_FILE` env var

```json
[
  "動画を一定時間（例：10秒ごと）のチャンクに分割し...",
  "2. 圧縮技術による最適化...",
  "プロキシ動画の生成..."
]
```

**Validation rules:**

- File phải tồn tại — nếu không: error + guidance + exit(1)
- Phải là JSON hợp lệ — nếu không: parse error + exit(1)
- Phải là array — nếu không: type error + exit(1)
- Array phải có ít nhất 1 item — nếu rỗng: error + exit(1)
- Mỗi item phải là string — nếu không: type error + item index + exit(1)
- Mỗi item được clamp qua `clampInputText()` (max 20,000 chars) — không error, silent truncation

**Error message mẫu (file không tồn tại):**

```
Error: Input file not found: /path/to/inputs/messages.json

Create the file with this format:
[
  "Message 1 to translate...",
  "Message 2 to translate..."
]

Or override the path:
  INPUT_FILE=./my-batch.json bun run start:local
```

---

## Output (Console)

Mỗi item log ra console theo format tương tự hiện tại:

```
🚀 Launching batch translation (3 messages)...

🔁 Message 1/3
[workflow] → STEP 4: navigating to translate URL: ...
Final translation output: Chia nhỏ video...
────────────────────────────────────────────────────
📝 Original: 動画を一定時間...
📝 Translated: Chia nhỏ video...
────────────────────────────────────────────────────

🔁 Message 2/3
...

✅ BATCH COMPLETE: 3/3 messages translated
```

---

## Error Handling

**Policy: Fail-fast (abort on first error)**

```
if (translateError) {
  log error with item index
  await browserService.close()
  process.exit(1)
}
```

Không retry, không continue, không skip.

---

## Configuration Changes

### `translation.config.ts` — thêm vào

```typescript
export const INPUT_FILE_ENV = 'INPUT_FILE'
export const INPUT_FILE_DEFAULT_PATH = 'inputs/messages.json'
export const INPUT_FILE_DOCKER_PATH = '/app/inputs/messages.json'
```

### `docker-compose.yml` — thêm volume

```yaml
volumes:
  - ./secrets:/app/secrets # hiện có
  - ./inputs:/app/inputs # thêm mới
```

### `.gitignore` — thêm vào `nghien_cuu_cua_toi/.gitignore`

```
# Input messages (may contain sensitive content)
inputs/
!inputs/*.example.json
```

---

## Files Affected

| File                                             | Thay đổi                                                                   |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| `src/config/translation.config.ts`               | Thêm `INPUT_FILE_ENV`, `INPUT_FILE_DEFAULT_PATH`                           |
| `src/config/translation.config.test.ts`          | Thêm tests cho constants mới                                               |
| `src/services/batch-translation.service.ts`      | **Tạo mới** — hàm `runBatchTranslation()`                                  |
| `src/services/batch-translation.service.test.ts` | **Tạo mới** — unit tests với mocked browserService                         |
| `src/services/interfaces/browser.interface.ts`   | Thêm `openNewTab(): Promise<Page>` (optional)                              |
| `src/services/browser.service.ts`                | Implement `openNewTab()`                                                   |
| `src/index.ts`                                   | Thay `runReadingLevelSweep` bằng `runBatchTranslation` + `readInputFile()` |
| `docker-compose.yml`                             | Thêm `./inputs:/app/inputs` volume mount                                   |
| `nghien_cuu_cua_toi/.gitignore`                  | Thêm `inputs/`                                                             |
| `inputs/messages.json.example`                   | **Tạo mới** — sample file                                                  |

---

## New Service: `runBatchTranslation`

```typescript
// src/services/batch-translation.service.ts

export interface BatchTranslationResult {
  index: number
  original: string
  translated: string
  finalUrl: string
}

export interface BatchTranslationDeps {
  browserService: IBrowserService
  urlBuilder: IUrlBuilder
  log?: (message: string) => void
}

export async function runBatchTranslation(
  messages: string[],
  options: TranslationOptions,
  deps: BatchTranslationDeps,
): Promise<BatchTranslationResult[]>
```

**Invariants:**

- `setupSession()` được gọi đúng 1 lần sau `launch()`, trước vòng lặp
- Tab management: lưu reference `prevPage` — sau `newPage.goto()` thành công thì close `prevPage`
- `close()` được gọi trong `finally` block để đảm bảo cleanup kể cả khi error

---

## Tab Management trong `IBrowserService`

Thêm optional method vào interface:

```typescript
interface IBrowserService {
  // ...existing methods...

  /**
   * Opens a new browser tab within the existing context.
   * Returns the new Page handle. Caller is responsible for closing
   * the previous page after navigating the new one.
   */
  openNewTab?(): Promise<Page>
}
```

Trong `KagiBrowserService`, implement bằng:

```typescript
async openNewTab(): Promise<Page> {
  return this.context.newPage()
}
```

---

## `translate()` Signature — No Change

`translate(url, options, sourceText)` không thay đổi. Thêm optional `page` parameter để
support multi-tab nếu cần, hoặc `openNewTab()` handle riêng ở service layer.

---

## Acceptance Criteria

### Happy path

- [ ] `inputs/messages.json` với 3 items → 3 translations in console, browser closes
- [ ] Tab 1 dùng cho item[0], tab 2 dùng cho item[1] (tab 1 đóng), tab 3 cho item[2] (tab 2 đóng)
- [ ] `INPUT_FILE=./other.json bun run start:local` → đọc từ `other.json`

### Edge cases

- [ ] Array có 1 item → translate bình thường, không mở tab mới
- [ ] Item text = 20,001 chars → silent truncate tại 20,000
- [ ] Mỗi item log rõ "Message X/N" trước khi translate

### Error cases

- [ ] File không tồn tại → error message + guidance + exit(1)
- [ ] File là `{}` (object, không phải array) → type error + exit(1)
- [ ] File là `[]` (empty array) → "no messages to translate" error + exit(1)
- [ ] Item không phải string (e.g. `[42, "hello"]`) → type error + index + exit(1)
- [ ] Translate thất bại ở item[1] → abort, browser closes, exit(1)

---

## Risks & Trade-offs

| Risk                                                               | Mitigation                                                           |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| Tab leak nếu `openNewTab()` thành công nhưng `closePrevTab()` fail | Dùng `finally` block + `browserService.close()` đóng toàn bộ context |
| Large messages.json file (>1000 items) blocking process            | Out of scope; fail-fast sẽ abort nhanh nếu có lỗi                    |
| Kagi rate limiting khi chạy nhiều items liên tiếp                  | User chịu trách nhiệm kiểm soát số lượng items; out of scope         |

---

## Future Scope (Deferred)

Các tính năng được xác nhận là ngoài scope hiện tại, chưa được estimate, chưa được commit:

- **Per-message options**: Mỗi item có reading level / formality riêng
- **Parallel processing**: Nhiều tabs chạy song song
- **Output file**: Ghi kết quả ra JSON file
- **Retry on error**: Continue batch sau khi 1 item fail
- **Progress file**: Ghi trạng thái để resume nếu crash giữa chừng
- **Reading level sweep per message**: Sweep nhiều reading levels cho mỗi message

---

## Explicit Decisions Made

| Decision                                      | Source         | Notes                                      |
| --------------------------------------------- | -------------- | ------------------------------------------ |
| Input từ file JSON                            | user-stated    | Flexible, không bị giới hạn bởi CLI escape |
| Global TranslationOptions (không per-message) | user-confirmed | Đơn giản hơn, fit pattern hiện tại         |
| Fail-fast (abort on error)                    | user-stated    | "muốn biết lỗi càng sớm càng tốt"          |
| Console stdout only                           | user-stated    | Không cần output file                      |
| Reuse tab[0], new tab từ item[1]              | user-confirmed | Ít bước hơn cho item đầu                   |
| Auto-close browser sau batch                  | user-confirmed | Nhất quán với behavior hiện tại            |
| Env var `INPUT_FILE` với default path         | user-confirmed | Nhất quán với KAGI_SESSION_FILE pattern    |
| Error + guidance khi file không tồn tại       | user-confirmed | Fail-fast với UX tốt                       |
| Docker: volume mount `./inputs:/app/inputs`   | user-confirmed | Nhất quán với secrets/ mount pattern       |
| Không delay giữa các items                    | user-confirmed | Tab mới sạch, không cần settle time        |
