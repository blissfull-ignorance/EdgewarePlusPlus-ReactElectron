# Task: Test Improvement — Next Session

## Goal
Improve test coverage and quality for existing test files.

## Priority
**Highest** — This is the next task per HANDOVER.md priority order.

## Steps

1. **Add component-level tests for hypno overlay spawn decision logic in `hypno.runtime.test.ts`**
   - Currently only store accessors are tested
   - Add tests that verify the actual component-level decision logic

2. **Add edge case tests for very large popup dimensions relative to screen size in `movement.test.ts`**
   - Test behavior when popups are larger than the screen

3. **Add test for popup removal mid-simulation (mitosis close flow) in `movement.flow.test.ts`**
   - Verify correct behavior when popups are removed during movement simulation

4. **Consider adding stress tests for rapid add/remove cycles across all test files**
   - Test performance and correctness under rapid state changes

5. **Improve comments in test files for better documentation**
   - Add descriptive comments explaining test logic and edge cases

6. **Commit changes**
   - Run `npm run check`, `npm run lint`, `npm run test` to verify
   - Commit with descriptive message following conventional commit format

7. **Update HANDOVER.md**
   - Update "Last Session" description
   - Update "Recent Commits" section
   - Update test count if changed
   - Update "Next Session Priority Order" if needed
