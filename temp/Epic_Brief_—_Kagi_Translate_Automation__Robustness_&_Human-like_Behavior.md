# Epic Brief — Kagi Translate Automation: Robustness & Human-like Behavior

## Summary

Dự án `nghien_cuu_cua_toi` là một Puppeteer Real Browser automation tool tự động hóa Kagi Translate — navigate, fill source text, configure Translation Settings (context, speaker, addressee, style, reading level, formality), chờ kết quả và scrape output. Hiện tại tool hoạt động nhưng tồn tại 3 vấn đề cốt lõi: (1) input text không có giới hạn max length khiến text cực dài gây timeout/crash không kiểm soát, (2) tất cả delay đều hardcoded cố định — không scale theo độ dài input text dẫn đến scrape quá sớm khi text dài hoặc chờ lãng phí khi text ngắn, và (3) mọi thao tác tương tác (click, type, slider) đều instant/máy móc — dễ bị phát hiện bởi hệ thống anti-bot và thiếu tự nhiên. Epic này nhắm đến việc giải quyết đồng thời cả 3 vấn đề để nâng automation lên mức production-grade, resilient, và human-indistinguishable.

## Context & Problem

**Ai bị ảnh hưởng**: Automation pipeline chạy `nghien_cuu_cua_toi` — bất kỳ ai dùng tool để dịch text qua Kagi Translate tự động (local hoặc Docker).

**Ở đâu trong product**: Toàn bộ flow automation từ lúc fill source text (`fillSourceTextInput` trong file:nghien_cuu_cua_toi/src/services/browser.service.ts) → configure settings → chờ output → scrape kết quả.

**Pain hiện tại**:

1. **Không có bảo vệ input text length** — `DEFAULT_TRANSLATION_CONFIG.INPUT_TEXT` và `fillSourceTextInput()` accept text bất kỳ độ dài. Text cực dài (>20k chars) gây Kagi API response cực chậm, timeout không lường trước, hoặc treo browser.
2. **Delay cứng không phản ánh thực tế** — Ví dụ: sau khi thay đổi formality, delay cố định 2,000ms. Với text 500 chars thì thừa; với text 18,000 chars thì thiếu trầm trọng → scrape output chưa hoàn tất. Các settings change (context, speaker, addressee, reading level, style, formality) đều trigger Kagi re-translate nhưng delay giống nhau bất kể text length.
3. **Tương tác 100% máy** — Click instant bằng `el.click()` / `btn.click()`, type text bằng `document.execCommand('insertText')` paste toàn bộ, slider set value trực tiếp bằng `evaluate()`. Không có mouse movement, không có typing delay, không có drag simulation. Hành vi này khác biệt hoàn toàn so với người dùng thật và dễ bị phát hiện bởi User Behavior Analytics (UBA) hoặc Cloudflare behavioral analysis.

## Success Criteria

1. Input text > 20,000 chars → bị truncate + log warning, pipeline không crash/hang
2. Dynamic delay đảm bảo scrape output không bao giờ xảy ra khi translation chưa stabilize (zero incomplete-scrape)
3. Mọi mouse movement, click, type, slider drag đều đi qua ghost-cursor / puppeteer-humanize — không còn `el.click()` / `evaluate()` trực tiếp cho user-facing interactions
