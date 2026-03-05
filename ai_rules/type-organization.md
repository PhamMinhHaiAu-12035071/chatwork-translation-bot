# Type Organization Rules

## Layer Convention

| Folder        | Purpose                                                         | Prefix / Pattern |
| ------------- | --------------------------------------------------------------- | ---------------- |
| `interfaces/` | Behavioral contracts: injectable, mockable, DI boundaries.      | `I` prefix       |
| `types/`      | Data shapes: external API responses, webhook events, schemas.   | No prefix        |
| Co-located    | Only acceptable when the type is NOT exported outside the file. | —                |

## Rule: Supporting types belong in the same file as their interface

When an interface has supporting types (config, params, result), they live in the **same file**
as the interface — not in `types/`.

**Correct:**

```
interfaces/chatwork.ts → IChatworkClient, ChatworkClientConfig, SendMessageParams
interfaces/translation.ts → ITranslationService, TranslationResult, TranslationError
```

**Wrong:**

```
interfaces/chatwork.ts → IChatworkClient only
types/chatwork.ts → ChatworkClientConfig, SendMessageParams ← scattered
```

## Rule: `types/` is for external shapes only

`types/` holds data structures that model external system contracts:

- Webhook event payloads from Chatwork
- API response shapes
- Domain value objects (like `ParsedCommand`)

It does NOT hold client config or method parameter types.

## Rule: Never define exported interfaces inside implementation files

If an interface or type is exported from a file that also contains a class or function
implementation, move it to the appropriate layer (`interfaces/` or `types/`).

Exception: types used only internally within that file (no `export` keyword).

## Checklist when adding a new type

- [ ] Is it a behavioral contract (injectable, mockable)? → `interfaces/<domain>.ts`
- [ ] Is it a data shape from an external API? → `types/<domain>.ts`
- [ ] Is it a supporting type for an interface? → same file as that interface
- [ ] Is it only used inside one file and not exported? → co-locate, no move needed
