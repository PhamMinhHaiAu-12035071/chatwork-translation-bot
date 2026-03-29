# Kagi Translate PoC — Design Document

**Version:** 1.0
**Date:** 2026-03-29
**Prepared by (AI-assisted):** Claude Sonnet 4.6
**Status:** Approved

---

## Objective

Xây dựng PoC thử nghiệm tích hợp [Kagi Translate](https://translate.kagi.com/) miễn phí (anonymous, không cần tài khoản) thông qua Playwright browser automation. PoC gồm 3 phase độc lập, tăng dần độ phức tạp, chạy được trong Docker.

---

## Scope

- **Phase 1 (đã hoàn thành trong session này):** Khám phá URL parameters của translate.kagi.com, phân tích toàn bộ translation settings và giải thích từng giá trị.
- **Phase 2:** Script Bun đơn giản, hardcode JP→VI, log kết quả ra terminal.
- **Phase 3:** Script nâng cấp với source/dest language và tất cả translation settings tuỳ biến qua env vars.

---

## Non-goals

- Không tích hợp vào `@chatwork-bot/translator` hay các packages monorepo hiện có.
- Không có retry logic, queue, batch processing.
- Không cần Kagi account hay session cookie.
- Không xử lý Document/Website/Proofread/Dictionary mode — chỉ Text mode.
- Không deploy production, chỉ là experiment.

---

## Phase 1 Findings — Kagi Translate URL Parameters

Translate.kagi.com là SvelteKit app với URL parameters được document chính thức.

### Translation Mode (`/`) — Full Parameter Reference

| Parameter             | Giá trị hợp lệ                                             | Default        | Mô tả                                                                                       |
| --------------------- | ---------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| `text`                | string                                                     | —              | Văn bản cần dịch                                                                            |
| `from`                | ISO 639-1 / `auto`                                         | `auto`         | Ngôn ngữ nguồn                                                                              |
| `to`                  | ISO 639-1                                                  | browser locale | Ngôn ngữ đích                                                                               |
| `style`               | `natural` \| `literal`                                     | `natural`      | **Translation Style**: `natural`=dịch tự nhiên, thoải mái; `literal`=dịch sát nghĩa từng từ |
| `formality`           | `default` \| `more` \| `less`                              | `default`      | **Formality**: `more`=kính trọng/lịch sự; `less`=thân mật/bỏ kính ngữ                       |
| `quality`             | `standard` \| `best`                                       | `standard`     | `best`=dùng model mạnh hơn                                                                  |
| `language_complexity` | `standard` \| `a1` \| `a2` \| `b1` \| `b2` \| `c1` \| `c2` | `standard`     | **Reading Level** (chuẩn CEFR): `a1`=mới bắt đầu → `c2`=thành thạo                          |
| `speaker_gender`      | `unknown` \| `masculine` \| `feminine` \| `neutral`        | `unknown`      | **Giới tính người nói** — ảnh hưởng ngữ pháp (tiếng Nhật keigo, Tây Ban Nha, v.v.)          |
| `addressee_gender`    | `unknown` \| `masculine` \| `feminine` \| `neutral`        | `unknown`      | **Giới tính người nghe** — ảnh hưởng cách xưng hô                                           |
| `context`             | string (≤150 ký tự)                                        | —              | Ngữ cảnh bổ sung giúp AI dịch chính xác hơn                                                 |
| `preserveFormatting`  | `true` \| `false`                                          | `false`        | Giữ nguyên định dạng gốc (xuống dòng, tab)                                                  |

### Ví dụ URL đầy đủ

```
https://translate.kagi.com/?from=ja&to=vi&text=こんにちは&style=natural&formality=default&quality=standard&language_complexity=standard&speaker_gender=unknown&addressee_gender=unknown&context=&preserveFormatting=false
```

---

## Architecture

### Folder Structure

```
experiments/kagi-poc/
  package.json              ← name: "@chatwork-bot/kagi-poc", NOT a workspace package
  tsconfig.json             ← extends ../../tsconfig.base.json
  Dockerfile                ← FROM mcr.microsoft.com/playwright:v1.52-jammy
  .env.example              ← tất cả env vars cho Phase 3
  src/
    types.ts                ← KagiTranslateOptions interface
    url-builder.ts          ← buildKagiUrl(options) → string
    extractor.ts            ← extractTranslation(page) → string
    translator.ts           ← translate(options) → string [core orchestrator]
    phase2-basic.ts         ← entry point Phase 2
    phase3-advanced.ts      ← entry point Phase 3
```

### Data Flow

```
KagiTranslateOptions
        │
        ▼
url-builder.ts: buildKagiUrl()
  → "https://translate.kagi.com/?from=ja&to=vi&text=..."
        │
        ▼
translator.ts: translate()
  1. chromium.launch({ headless: true, args: ['--no-sandbox'] })
  2. page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
  3. extractTranslation(page)
  4. browser.close()  [in finally]
  5. return translatedText
        │
        ▼
extractor.ts: extractTranslation()
  page.waitForSelector('.translation-output', { timeout: 15_000 })
  return page.locator('.translation-output').innerText()
```

---

## Types

### `src/types.ts`

```typescript
export interface KagiTranslateOptions {
  text: string
  from: string // ISO 639-1 hoặc 'auto'
  to: string // ISO 639-1
  style?: 'natural' | 'literal'
  formality?: 'default' | 'more' | 'less'
  quality?: 'standard' | 'best'
  languageComplexity?: 'standard' | 'a1' | 'a2' | 'b1' | 'b2' | 'c1' | 'c2'
  speakerGender?: 'unknown' | 'masculine' | 'feminine' | 'neutral'
  addresseeGender?: 'unknown' | 'masculine' | 'feminine' | 'neutral'
  context?: string
  preserveFormatting?: boolean
}
```

---

## Phase 2 — Basic Script

**Entry point:** `src/phase2-basic.ts`
**Command:** `bun start`
**Expected output:**

```
Translation: こんにちは、今日はいい天気ですね
→ Xin chào, hôm nay thời tiết đẹp nhỉ
```

Hardcode `from=ja`, `to=vi`, default settings.

---

## Phase 3 — Advanced Script

**Entry point:** `src/phase3-advanced.ts`
**Command:** `bun start:advanced` hoặc via Docker env vars

### Env vars

```
TEXT=           (required)
SOURCE_LANG=    (default: auto)
TARGET_LANG=    (default: vi)
STYLE=          (default: natural)     → natural | literal
FORMALITY=      (default: default)     → default | more | less
QUALITY=        (default: standard)    → standard | best
READING_LEVEL=  (default: standard)    → standard | a1..c2
SPEAKER_GENDER= (default: unknown)     → unknown | masculine | feminine | neutral
ADDRESSEE_GENDER=(default: unknown)    → unknown | masculine | feminine | neutral
CONTEXT=        (default: empty)
PRESERVE_FORMATTING=(default: false)
```

**Expected output (JSON):**

```json
{
  "input": "会議は明日の午後3時です",
  "output": "Cuộc họp là lúc 3 giờ chiều ngày mai",
  "options": {
    "from": "ja",
    "to": "vi",
    "style": "natural",
    "formality": "more"
  }
}
```

---

## Docker

### `Dockerfile`

```dockerfile
FROM mcr.microsoft.com/playwright:v1.52-jammy

RUN npm install -g bun

WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
RUN bunx playwright install chromium

COPY . .

CMD ["bun", "src/phase2-basic.ts"]
```

### Chạy Phase 2

```bash
docker build -t kagi-poc .
docker run --rm kagi-poc
```

### Chạy Phase 3

```bash
docker run --rm \
  -e TEXT="会議は明日の午後3時です" \
  -e SOURCE_LANG=ja \
  -e TARGET_LANG=vi \
  -e STYLE=natural \
  -e FORMALITY=more \
  -e READING_LEVEL=b2 \
  kagi-poc bun src/phase3-advanced.ts
```

---

## Error Handling

| Tình huống                  | Xử lý                                                   |
| --------------------------- | ------------------------------------------------------- |
| `text` rỗng                 | Validate trước launch, throw `InvalidInputError`        |
| DOM selector không tìm thấy | Timeout 15s → screenshot `debug-screenshot.png` → throw |
| `page.goto` timeout         | Timeout 30s → throw với URL                             |
| Browser crash               | `finally` block đảm bảo `browser.close()`               |
| Rate limit / 429            | Throw error với HTTP status code                        |

```typescript
// Pattern trong translator.ts
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})
const page = await browser.newPage()
try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
  return await extractTranslation(page)
} catch (err) {
  await page.screenshot({ path: 'debug-screenshot.png' }).catch(() => {})
  throw err
} finally {
  await browser.close()
}
```

---

## Acceptance Criteria

### Phase 2

- [ ] `bun start` chạy được không lỗi
- [ ] Output log ra terminal kết quả dịch tiếng Nhật → tiếng Việt
- [ ] `docker build` và `docker run` thành công

### Phase 3

- [ ] `bun start:advanced` với env vars khác nhau cho output khác nhau
- [ ] `style=literal` vs `style=natural` tạo ra kết quả khác nhau
- [ ] `formality=more` vs `formality=less` tạo ra kết quả khác nhau (đặc biệt với tiếng Nhật)
- [ ] `language_complexity=a1` vs `c2` cho output đơn giản/phức tạp khác nhau
- [ ] Output JSON đầy đủ với `input`, `output`, `options`
- [ ] Docker run với env vars hoạt động

---

## Risks & Trade-offs

| Risk                                     | Mức độ | Mitigation                                |
| ---------------------------------------- | ------ | ----------------------------------------- |
| Kagi thay CSS selector                   | Medium | Tách `extractor.ts` riêng, dễ update      |
| Kagi block headless browser (User-Agent) | Medium | Set realistic User-Agent trong Playwright |
| Anonymous rate limit                     | Low    | PoC không cần high throughput             |
| `quality=best` cần login                 | Low    | Chỉ dùng `standard` trong PoC             |

---

## Out of Scope

- Integration với `@chatwork-bot/translator` provider pattern
- Retry logic, queue, batch processing
- Document/Website/Proofread/Dictionary mode
- Kagi account / session management
- Production deployment

## Future Scope / Deferred Features

> Các mục dưới đây đã được xác nhận là ngoài scope hiện tại, chưa được estimate, và chưa được commit.

- `packages/provider-kagi/` — implement `ILLMExecutor` để tích hợp vào translator chính
- Network request interception thay vì DOM scraping (Approach B)
- Retry với exponential backoff
- Batch translation từ file input
