---
name: english-comments
description: Enforce English comments in all code files - translate any non-English comments to English
---

# English Comments Skill

**Rule**: All code comments must be written in English. If you encounter a file with non-English (e.g., Persian) comments, translate them to English.

## When to Apply

- Writing new code: write all comments in English
- Editing existing files: translate any non-English comments you see
- Code reviews: flag non-English comments for translation

## Comment Style Guidelines

1. **Use English for all comments** — doc comments, inline comments, JSDoc blocks
2. **Keep variable names, string literals, and UI text as-is** — only translate comments
3. **Preserve JSDoc tag format** — `@param`, `@returns`, `@example`, etc. stay in standard English format
4. **Be concise** — prefer one-line summaries for functions/types

## Example Translations

| Persian Comment | English Translation |
|---|---|
| `// بررسی وضعیت سرور` | `// Check server status` |
| `/** دریافت تنظیمات */` | `/** Get settings */` |
| `// اگر خطا داشت ریشه کن` | `// If error, throw` |
| `/* تست اتصال */` | `/* Test connection */` |

## Installation

1. Save this file as `.claude/skills/english-comments/SKILL.md` in your project root
2. Run `/reload-skills` in Claude Code, or restart the session
3. The skill will auto-load for this project

## Usage

Once loaded, invoke with:
```
/english-comments
```

Or it will apply automatically when you work on code files in this project.