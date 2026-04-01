bây giờ client họ có thêm một yêu cầu mới cho backend và frontend dashboard của chúng ta trong @packages cụ thể họ muốn thêm một advance settings nữa khi create per room or edit per room có thê danh sách các từ khoá sẽ được thay thế. Như bạn khám phá codebase sẽ hiểu hiện tại cơ chế dịch thuật của chúng ta đang sử dụng api openai và gemini thông qua api key tuy nhiên điều đó đồng nghĩa với việc toàn bộ nội dung gửi lên sẽ qua 2 nhà provider cung cấp này họ giữ, vì vậy client muốn một cơ chế secret siêu an toàn nơi mà họ không muốn tiết lộ các thông tin quan trọng, nhạy cảm của mình cho bất kỳ bên nào cả, tránh rò rĩ, ví dụ họ có 1 nơi để setting các từ khoá này như: Asia Vion đây là tên công ty của họ đi, thì trước khi chạy vào dịch ta sẽ có 1 bộ lọc bản dịch sẽ tự đi tìm các từ khoá liên quan này và thay bằng một tên khác XYZ gì đó tuỳ chúng ta rồi mới gửi bản dịch đi, điều này đảm bảo tên công ty của phía khách hàng sẽ không được tiết lộ trong quá trình dịch thuật, tương tự sẽ có các thông tin nhạy cảm khác nữa. ngoài ra việc xử lý check từ khoá và thay bằng từ khác nên áp dụng bộ lọc thông minh chắc sẽ dùng regular expression để vét cạn nhiều case có thể xảy ra. Còn về UI/UX thì hiểu style Neubrutalism 3D hiện tại của Dashboard rồi áp dụng thiết kế thêm field mới này phù hợp là được

<document>
<project_context>
# Chatwork Translation Bot - Existing Architecture

## Current Stack

- **Runtime**: Bun v1.1+ with TypeScript 5.4+ strict mode
- **Architecture**: Monorepo with packages (@chatwork-bot/\*)
- **Translation Providers**: OpenAI and Gemini via API keys
- **Frontend**: React dashboard with Neubrutalism 3D design style
- **Key Concern**: All translation content currently sent to third-party providers (OpenAI/Gemini) without privacy protection

## Current Translation Flow

1. User sends message to Chatwork
2. Webhook triggers translation bot
3. Bot calls OpenAI/Gemini API directly with full message content
4. Translation returned and posted back to Chatwork

## Problem Statement

Client has sensitive information (company names, product codes, internal terms) that should NOT be exposed to third-party AI providers during translation. Example: "Asia Vion" (company name) should be replaced with a placeholder before sending to OpenAI/Gemini, then restored after translation.
</project_context>

<security_requirement>
**Critical Security Constraint**: Zero sensitive data leakage to third-party APIs.

Example sensitive terms:

- Company name: "Asia Vion" → replace with "COMPANY_001" before translation
- Product codes, internal terminology, confidential project names
- Must support case-insensitive and partial matching (asia vion, ASIA VION, AsiaVion all match)
  </security_requirement>

<neubrutalism_ui_reference>
**Current Dashboard Design Style**: Neubrutalism 3D

- Bold, thick borders (4-8px)
- High contrast colors (black borders, bright accent colors)
- Layered shadows for 3D depth effect
- Brutalist typography (bold, geometric fonts)
- Playful but functional (buttons have exaggerated hover states)
- Examples: `.brutal-button`, `.brutal-input` classes in `packages/dashboard/src/styles/global.css`
  </neubrutalism_ui_reference>
  </document>

<instructions>
You are a full-stack TypeScript/React engineer with expertise in:
- Bun/Node.js backend development
- React frontend with modern UI design
- Security-focused architecture (data privacy, encryption)
- Clean Code principles and SOLID design patterns
- Performance optimization for real-time systems

# Task: Implement Secure Keyword Replacement Feature

Implement a complete end-to-end feature for the Chatwork Translation Bot that protects sensitive keywords from being exposed to third-party translation APIs (OpenAI/Gemini).

<requirements>
## Functional Requirements

1. **Advanced Settings UI (Frontend)**
   - Add a new section in the per-room configuration dashboard: "Sensitive Keywords Protection"
   - UI must follow existing Neubrutalism 3D design style
   - Allow users to:
     - Add/remove sensitive keywords (e.g., "Asia Vion", "Project Phoenix")
     - Optionally specify custom replacement placeholders
     - Enable/disable keyword protection per room
   - Provide visual feedback when keywords are active

2. **Keyword Replacement Engine (Backend)**
   - Intercept messages BEFORE sending to translation APIs
   - Replace sensitive keywords with safe placeholders using **smart matching**:
     - Case-insensitive: "asia vion", "ASIA VION", "Asia Vion" all match
     - Partial match: "Asia", "Vion", "AsiaVion" all match
     - Use NLP or fuzzy matching for variants
   - Track replacements to restore original keywords after translation
   - Reverse replacement AFTER receiving translation from API

3. **Data Storage**
   - Use existing database schema (no new tables, extend existing room settings)
   - Store keyword list securely per room
   - Consider encryption at rest for sensitive keyword storage

4. **Performance**
   - Keyword replacement must complete in < 100ms (non-blocking)
   - Use efficient regex or trie-based matching for multiple keywords

5. **Testing**
   - Write unit tests for:
     - Keyword matching logic (all case and partial match scenarios)
     - Replacement and restoration logic
     - Edge cases: overlapping keywords, special characters, emoji
   - Integration test: full translation flow with keyword protection enabled

## Non-Functional Requirements

- **Backward Compatibility**: Must not break existing rooms without keyword settings
- **Code Quality**: Follow existing codebase patterns, Clean Code/SOLID principles, add comments for complex logic
- **Security**: No sensitive data should ever appear in logs, API calls to OpenAI/Gemini, or error messages
- **Documentation**: Include README section explaining how to configure and use this feature
  </requirements>

<success_criteria>
Your implementation will be evaluated against these 8 criteria:

1. **Completeness**: Includes backend logic + frontend UI + unit tests + documentation
2. **Security**: Sensitive keywords are 100% replaced before API calls, verified by tests
3. **Performance**: Keyword replacement executes in < 100ms (include performance test)
4. **Backward Compatibility**: Existing rooms work without changes, no breaking API changes
5. **Code Quality**: Clean, maintainable code with comments explaining non-obvious logic
6. **Test Coverage**: Unit tests for keyword matching, replacement, restoration, and edge cases
7. **UI Match**: Frontend UI visually matches existing Neubrutalism 3D dashboard style
8. **Documentation**: Clear README explaining feature setup and usage

**Immediate Rejection Criteria** (if any of these are present, the implementation fails):

- Missing backend OR frontend code
- Causes breaking changes to existing room configurations
- Sensitive data still appears in API calls (security vulnerability)
- No unit tests for keyword replacement logic
- UI does not match Neubrutalism style
- Code quality is poor (no comments, hard to maintain)
  </success_criteria>

<output_format>
Provide your implementation in this structure:

## 1. Architecture Overview

- Data flow diagram (text-based or mermaid)
- Explain where keyword replacement happens in the pipeline
- Security analysis: prove no sensitive data leaks

## 2. Data Structure Design

```typescript
// TypeScript interfaces for keyword settings
// Include per-room configuration schema
```
