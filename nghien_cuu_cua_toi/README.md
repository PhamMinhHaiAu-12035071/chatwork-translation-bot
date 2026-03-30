# Kagi Translation PoC - Docker Version

## Prerequisites

- Docker Desktop
- Bun

## 🚀 Quick Start

**ONE COMMAND - Lần đầu hay lần sau đều giống nhau:**

```bash
cd nghien_cuu_cua_toi
bun run start
```

**Xong!** Không cần gì thêm! 🎉

Script tự động:

- ✅ Build Docker image (lần đầu hoặc khi có thay đổi)
- ✅ Start container
- ✅ Chạy translation
- ✅ Hiển thị kết quả

## Available Scripts

| Command                  | Description                                  |
| ------------------------ | -------------------------------------------- |
| `bun run start`          | **ONE COMMAND** - Auto build (nếu cần) + run |
| `bun run start:local`    | Chạy trực tiếp trên host (không qua Docker)  |
| `bun run docker:rebuild` | Force rebuild từ đầu (clear cache) + run     |
| `bun run docker:logs`    | Xem logs real-time                           |
| `bun run docker:clean`   | Xóa containers và volumes                    |

## Configuration

Edit `index.ts` để thay đổi:

### Basic Settings

- `INPUT_TEXT`: Text cần translate
- `SOURCE_LANG`: Ngôn ngữ nguồn (auto, en, vi, ja, ko, zh, etc.)
- `TARGET_LANG`: Ngôn ngữ đích (vi, en, ja, ko, zh, etc.)

### Advanced Translation Settings

**Reading Level** (`READING_LEVEL`):

- `standard` (default) - Không giới hạn độ phức tạp
- `a1`, `a2`, `b1`, `b2`, `c1`, `c2` - Điều chỉnh độ phức tạp văn bản

**Speaker Gender** (`SPEAKER_GENDER`):

- `unknown` (default) - Không xác định giới tính người nói
- `neutral` - Người nói giới tính trung tính
- `feminine` - Người nói nữ giới

**Addressee Gender** (`ADDRESSEE_GENDER`):

- `unknown` (default) - Không xác định giới tính người nghe
- `neutral` - Người nghe giới tính trung tính
- `feminine` - Người nghe nữ giới

**Translation Style** (`STYLE`):

- `natural` (default) - Dịch tự nhiên, dễ đọc
- `literal` - Dịch sát nghĩa gốc

**Formality** (`FORMALITY`):

- `standard` (default) - Không điều chỉnh formal/casual
- `vietnamese_formal` - Văn phong trang trọng tiếng Việt
- `vietnamese_casual` - Văn phong thân mật tiếng Việt

### Example Configurations

**Casual conversation (default):**

```typescript
const READING_LEVEL: ReadingLevel = 'standard'
const SPEAKER_GENDER: SpeakerGender = 'unknown'
const ADDRESSEE_GENDER: AddresseeGender = 'unknown'
const STYLE: TranslationStyle = 'natural'
const FORMALITY: Formality = 'standard'
```

→ URL chỉ có: `from=auto&to=vi&text=...` (baseline Kagi behavior)

**Professional document (C2 level):**

```typescript
const READING_LEVEL: ReadingLevel = 'c2'
const FORMALITY: Formality = 'vietnamese_formal'
```

→ URL có: `...&language_complexity=c2&formality=more&formality_context=vi_formal`

**Simple explanation (A1 level):**

```typescript
const READING_LEVEL: ReadingLevel = 'a1'
const STYLE: TranslationStyle = 'natural'
```

→ URL có: `...&language_complexity=a1`

Sau khi sửa config, chỉ cần:

```bash
bun run start
```

Tự động rebuild + run luôn! ⚡

Hoặc force rebuild (clear cache):

```bash
bun run docker:rebuild
```

## Troubleshooting

**Invalid configuration error:**

```
Error: Invalid readingLevel: "x99". Allowed values: standard, a1, a2, b1, b2, c1, c2
```

→ Kiểm tra lại giá trị config trong `index.ts`, phải match với enum type

**Container exits immediately:**

```bash
bun run docker:logs
```

**Chromium not found:**

```bash
bun run docker:rebuild
```

**Turnstile blocking:**

- Đảm bảo HEADLESS=false trong index.ts
- Script đã được config để bypass Turnstile với real browser fingerprint

**Timeout:**

- Tăng TIMEOUT trong index.ts từ 30000 lên 60000

## Architecture

- **Base Image:** oven/bun:latest (Debian-based)
- **Browser:** Chromium
- **Display:** Xvfb (virtual framebuffer, không hiện ra màn hình)
- **Runtime:** Bun
- **Anti-Detection:** HEADLESS=false + puppeteer-real-browser

## Development Notes

**Chạy local (không qua Docker):**

```bash
bun run start:local
```

**So sánh với Docker:**

- **Local:** Nhanh hơn, nhưng cần cài Chromium trên host
- **Docker:** Tách biệt môi trường, reproducible, nhưng chậm hơn
