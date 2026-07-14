# TASK — Test Assessment & Improvement

## Goal
Assess all existing Vitest tests for viability, runtime detection capability, and improvement opportunities.

## Steps

1. **Run existing tests** — `npm run test` to confirm all 54 tests pass

2. **Review test files** — Read through all `*.test.ts` files in `src/features/popup/`

3. **Assess each test** — For each test, evaluate:
   - Can the test realistically fail in production?
   - Does it catch real runtime issues?
   - Is the assertion meaningful?

4. **Improve weak tests** — Strengthen tests with better assertions or more realistic scenarios

5. **Remove dead tests** — Identify tests that can't meaningfully fail and remove them

6. **Add missing tests** — Identify untested critical paths and add new tests

7. **Improve comments for documentation** — Add/update comments in test files for clarity

8. **Commit changes** — `git add -A && git commit -m "test: improve test viability and documentation"`

9. **Update HANDOVER.md** — Update:
   - "Last Session" line
   - "What's Working" section
   - "Recent Commits" section
   - "Next Session Priority Order" with list of tests needing further improvement
