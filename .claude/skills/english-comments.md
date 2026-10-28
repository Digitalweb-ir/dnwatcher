---
name: english-comments
description: Enforce English comments in all code files - translate any non-English comments to English
---

# English Comments Skill

This skill ensures all code comments are written in English. When working with code files, you must:

1. **Read files first** to identify any non-English comments
2. **Translate all comments to English** - including inline comments, block comments, JSDoc, and documentation comments
3. **Preserve code functionality** - only change comments, not code logic
4. **Use clear, professional English** - technical terminology should be standard English

## Rules

- All comments must be in English (American spelling preferred)
- Translate Persian/Farsi comments to English
- Translate any other non-English comments to English
- Keep variable names, strings, and user-facing text as-is (only comments)
- For JSDoc/docstrings: translate description but keep @param, @returns, @throws tags in English format

## When to apply

Apply this skill when:
- Reading any code file (TypeScript, JavaScript, Python, Go, Rust, etc.)
- Editing any code file
- Creating new code files
- Reviewing code changes

## How to apply

When you see a file with non-English comments:
1. Read the full file
2. Identify all comments that are not in English
3. Translate them to clear, professional English
4. Write the updated file

## Example translations

```typescript
// ❌ Before (Persian)
// این تابع کاربر را احراز هویت می‌کند
// @param username نام کاربری
// @returns توکن دسترسی

// ✅ After (English)
// This function authenticates the user
// @param username - The username
// @returns Access token
```

```typescript
// ❌ Before (mixed)
// Check if user exists // بررسی وجود کاربر
const user = await db.findUser(id);

// ✅ After
// Check if user exists
const user = await db.findUser(id);
```

## Installation

This skill is automatically available when placed in `.claude/skills/`. To use it:

1. The skill loads automatically when you read/edit files in this project
2. Or explicitly invoke with: `/english-comments` (if configured as a slash command)
3. Or reference it in your prompt: "Use the english-comments skill"

## Verification

After applying, verify:
- No Persian/Arabic/non-English characters in comments (except in string literals)
- All comments read naturally in English
- Technical terms are correct
- No comment was missed