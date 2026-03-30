# Prompt Iteration Log

## Revision 1 — One-Step Humanized Redesign

- Date: 2026-03-30
- Model used: Pending manual run; first validation target is `gpt-5.4`
- Workflow: drafted with TCREI-style task/context/reference tightening, then compressed with Lyra anti-pattern reduction to cut over-instruction and token waste

### Prompt Diff

- Removed the shared `elite professional translator` persona.
- Removed the long HUMANIZER and internal self-critique stack.
- Removed the runtime polish pass, polish schemas, and polish exports.
- Replaced the old shared mega-prompt with:
  - compact shared rules
  - compact Japanese-specific guidance
  - fully separate per-style voice blocks
  - micro few-shot examples per style
  - tagged user prompts with `<TRANSLATE_TEXT>` / `<TRANSLATE_SEGMENTS>`

### Approximate Prompt Size

| Style                 | System chars | User chars | Rough total tokens |
| --------------------- | -----------: | ---------: | -----------------: |
| NATURAL_CASUAL        |         2837 |        406 |                811 |
| PROFESSIONAL_BUSINESS |         2664 |        408 |                768 |
| TECHNICAL             |         2721 |        412 |                784 |

Reference point from the previous implementation:

- `PROFESSIONAL_BUSINESS` system prompt was `12521` chars before the redesign.

### Manual Verdict vs Kagi

- Status: Reviewed against the acceptance samples already captured in `nghiencuu/analyze.txt`; fresh runtime sample is still pending provider access.
- Acceptance demo: `nghiencuu/analyze.txt`
- Expected review focus:
  - `NATURAL_CASUAL` must feel more human and less document-like than Kagi on the demo case.
  - `PROFESSIONAL_BUSINESS` and `TECHNICAL` must stay semantically faithful and clearly distinct.

### Acceptance Snapshot

| Criterion                      |  Score | Verdict                                                                                                             |
| ------------------------------ | -----: | ------------------------------------------------------------------------------------------------------------------- |
| Beat Kagi on the demo case     |   4/10 | Not met. `NATURAL_CASUAL` still loses on flow and spoken rhythm.                                                    |
| Natural / humanized Vietnamese |   5/10 | Not met. The wording is cleaner than before but still reads like careful translation.                               |
| All styles near 10/10          |   6/10 | Not met. Fidelity is decent, but style separation and naturalness are not yet elite.                                |
| Token effectiveness            | 8.5/10 | Mostly met architecturally. The prompt is much shorter and single-call now, but quality-per-token still needs work. |

### Concrete Findings From `analyze.txt`

- `NATURAL_CASUAL` still sounds document-shaped in places such as "theo khoảng thời gian cố định", "Không nhất thiết phải gửi toàn bộ", and the half-English hybrids `AI detect` / `độ chính xác detect`.
- Kagi wins by rewriting more aggressively into spoken Vietnamese: "mấy đoạn tầm 10 giây", "Đâu cần gửi hết làm gì", "cho nhẹ", "Cơ mà ... hơi bị khoai".
- `PROFESSIONAL_BUSINESS` is acceptable on fidelity but still slightly stiff for internal Vietnamese business prose.
- `TECHNICAL` is precise enough, but the cadence is too close to `PROFESSIONAL_BUSINESS`; it mostly swaps terminology instead of sounding like a different author.

## Revision 2 — Natural / Technical Refinement

- Date: 2026-03-30
- Trigger: manual review of the acceptance samples showed that the one-step redesign still underperformed Kagi on casual naturalness.

### Prompt Diff

- Strengthened `NATURAL_CASUAL` to explicitly allow spoken compression: `đâu cần...`, `cứ ... thôi`, `cho nhẹ`, `cơ mà...`
- Added a hard negative guard against half-English casual hybrids such as `AI detect` and `độ chính xác detect`
- Replaced the weak casual example `Chắc không cần gửi hết đâu.` with `Đâu cần gửi hết làm gì.`
- Added one domain-shaped casual example for explanatory prose: `Hạ chất lượng xuống cho nhẹ rồi gửi đi.`
- Strengthened `TECHNICAL` with explanatory-prose anchors: `proxy video`, `frame rate`, `object detection`
- Added a negative guard to keep `TECHNICAL` out of business-email cadence

### Approximate Prompt Size

| Style                 | System chars | User chars | Rough total tokens |
| --------------------- | -----------: | ---------: | -----------------: |
| NATURAL_CASUAL        |         3152 |        409 |                891 |
| PROFESSIONAL_BUSINESS |         2664 |        392 |                764 |
| TECHNICAL             |         3028 |        396 |                856 |

### Next Hypothesis If Demo Still Loses

- Add one short contrastive example for long explanatory sentence reflow, not just chat-style questions.
- Let `NATURAL_CASUAL` translate headings like `Frame sampling` into more native Vietnamese when that reads better.
- If `TECHNICAL` still reads too close to business prose, add one example that explicitly favors terse spec wording over full-sentence business cadence.

## Revision 3 — Mixed-Tech Casual Reflow

- Date: 2026-03-30
- Trigger: the revised one-step prompt still lacked explicit anchors for mixed technical prose that should read like casual Vietnamese instead of softened document language.

### Prompt Diff

- Added a direct preference for spoken anchors such as `tầm 10 giây`
- Added a direct negative guard against scaffolding like `theo khoảng thời gian cố định` and `phần dùng cho`
- Added an explicit rule to localize semi-technical headings when Vietnamese reads better, using `Frame sampling -> Lấy mẫu khung hình`
- Replaced the third casual micro-example with a chunking example: `Chia thành từng đoạn tầm 10 giây.`

### Approximate Prompt Size

| Style                 | System chars | User chars | Rough total tokens |
| --------------------- | -----------: | ---------: | -----------------: |
| NATURAL_CASUAL        |         3520 |        409 |                983 |
| PROFESSIONAL_BUSINESS |         2664 |        392 |                764 |
| TECHNICAL             |         3028 |        396 |                856 |

### Tradeoff Note

- `NATURAL_CASUAL` gained roughly `+92` tokens versus Revision 2.
- The added cost is intentional and narrowly targeted at the exact acceptance failure mode in `analyze.txt`.
- If a fresh runtime sample still does not beat Kagi, the next step should be quality-first once more; if it does win, this revision should be compressed.

### Next Hypothesis If Demo Still Loses

- Add one contrastive example for `phần dùng cho AI detect` -> a cleaner casual Vietnamese rendering without hybrid jargon.
- Tighten the shared rule about English retention so `NATURAL_CASUAL` does not inherit technical English labels too aggressively.
- If Kagi still wins on rhythm, cut one generic casual bullet and spend those tokens on one stronger long-sentence reflow example instead.
