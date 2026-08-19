# AITJ-M8-01 — Accessibility audit and WCAG 2.1 AA remediation

| Field | Value |
|---|---|
| Milestone | M8 — Hardening |
| Depends on | AITJ-M1-01, AITJ-M3-01, AITJ-M4-01, AITJ-M5-01, AITJ-M6-01, AITJ-M7-01 |
| Blocks | AITJ-M8-03 |
| PRD refs | NFR-4, FR-T9, FR-T7, FR-D4, FR-D6, FR-D7, FR-L2, §13 Manual row |
| Est. | 2 days |
| Phase | 🔴 RED |

## Context

AITJ Ledger must be usable by committee members with visual impairments, motor impairments, or cognitive differences, and by users who work under forced-motion constraints. NFR-4 commits to WCAG 2.1 AA: keyboard navigation, labelled form controls, visible focus rings, 4.5:1 contrast, and income/expense never distinguished by colour alone. The audit identifies violations programmatically on each of the 8 routes; remediation fixes them and embeds the check in CI as a regression guard.

## Acceptance criteria

- [ ] AC1 — Axe-core accessibility scan runs in Playwright suite against all 8 routes (login, dashboard, income, expenses, transactions, reports, categories, settings) in both light and dark themes
- [ ] AC2 — Every form control (input, select, textarea) has a programmatic `<label>` with `htmlFor` or `aria-label`; form submission errors are associated with inputs via `aria-describedby` and announced
- [ ] AC3 — Focus order (Tab key) follows visual order left-to-right, top-to-bottom; focus is never trapped unless intentional (delete confirmation modal FR-T9 traps focus, is dismissible by Escape, returns focus to Delete button)
- [ ] AC4 — Focus rings are visible at ≥3:1 contrast against their background in both light and dark; `outline-offset` is never negative
- [ ] AC5 — All interactive elements (buttons, links, form controls, row edit/delete) are reachable and operable by keyboard alone; no mouse-only interactions
- [ ] AC6 — Income rows have a non-colour indicator (icon or prefix text, e.g. "+") and expense rows have a distinct non-colour indicator (e.g. "−"); colour alone never conveys type (FR-L2)
- [ ] AC7 — Success toast (FR-T7) is announced to screen readers via `role="status"` live region without stealing focus; Undo link is keyboard-accessible
- [ ] AC8 — Delete confirmation dialog (FR-T9) reads "Are you sure you want to delete this transaction?" and shows amount, category, date; modal is focusable and dismissible by Escape
- [ ] AC9 — Dashboard balance cards including negative balance (FR-D4) are labelled so "-₹500.00" is announced as "minus five hundred" not just "red text"; all-time balance is similarly clear
- [ ] AC10 — Charts (Recharts FR-D6/D7) include `<text>` elements or an accessible data table alternative; SVG content is not read as "group" by default
- [ ] AC11 — Text and interactive elements have ≥4.5:1 contrast in both light and dark themes; verified in app UI and in print view (FR-R7, greyscale)
- [ ] AC12 — Page is usable at 200% and 400% browser zoom; text reflows and does not require horizontal scroll
- [ ] AC13 — Reduced motion (`prefers-reduced-motion: reduce`) hides animations; Recharts transitions are removed under this preference

## Edge cases

| # | Case | Expected behaviour |
|---|---|---|
| E1 | Keyboard-only flow to add income | User tabs through date input (date picker must not trap focus), category select, amount input, description textarea, Save button without using mouse; Undo link is keyboard-reachable |
| E2 | Screen reader + negative balance | "Current Balance: minus five hundred rupees zero paise" (not "red colour, negative sign"), conveyed via `aria-label` on the card |
| E3 | 200% zoom on 360px | Sidebar, tab bar, form inputs, and table/cards remain usable without horizontal scroll |
| E4 | Print view at 200% zoom and in greyscale | Income/expense rows remain visually distinct (icon or prefix text, not colour); report totals remain readable |
| E5 | Reduced motion + Recharts | Charts render without transitions; data is conveyed via the alternative accessible table |
| E6 | Long masjid name + long category name at 360px + 200% zoom | Labels and inputs do not overflow; text wraps predictably |
| E7 | Form validation error with long message | Error is associated to the input via `aria-describedby`, announced once, and a screen reader user can navigate to it |
| E8 | Delete modal with tab focus in a list of 50 rows | Tab is trapped within the modal; focus returns to the Delete button when dismissed; other rows are inert |

## Test plan (TDD)

### 🔴 RED — write these first, all must fail

| # | Level | Test name | Asserts |
|---|---|---|---|
| T1 | e2e | `accessibility > login route axe-core violations` | No WCAG AA violations reported on `/login` by axe-core |
| T2 | e2e | `accessibility > dashboard route axe-core violations` | No WCAG AA violations on `/` dashboard in light and dark themes |
| T3 | e2e | `accessibility > income form keyboard flow` | User can fill amount → date → category → description → save using Tab, Enter, Arrow keys, no mouse; form clears on submit |
| T4 | e2e | `accessibility > expense delete confirmation focus trap` | Delete modal receives focus, Tab cycles within it only, Escape dismisses it, focus returns to Delete button |
| T5 | e2e | `accessibility > income/expense rows colour plus indicator` | Income rows include visible "+" text/icon; expense rows include visible "−" text/icon; axe-core does not flag colour-only distinction |
| T6 | e2e | `accessibility > negative balance announcement` | Dashboard balance card with -₹500 reads as "minus five hundred" when announced; `aria-label` or text alternative present |
| T7 | e2e | `accessibility > toast live region` | Success toast is in `role="status"` region; screen reader hears "Transaction saved, undo" without focus moving; Undo link is Tab-reachable |
| T8 | e2e | `accessibility > form errors associated` | Amount field validation error is associated via `aria-describedby`; axe-core does not flag missing label or associated error |
| T9 | e2e | `accessibility > chart has data alternative` | Recharts chart has `<text>` labels or parent component renders an accessible data table; chart root is not announced as empty group |
| T10 | e2e | `accessibility > 200% zoom reflow` | Page at 200% zoom on 360px viewport reflows without horizontal scroll; form inputs and buttons remain usable |
| T11 | e2e | `accessibility > print view contrast greyscale` | Print stylesheet removes colour background; text remains ≥4.5:1 in greyscale; income/expense indication persists (icon/text) |
| T12 | e2e | `accessibility > reduced motion transactions` | `prefers-reduced-motion: reduce` hides toast slide-in animation; Recharts removes transition duration |

**Red gate:** every test above fails for the right reason — axe-core reports violations, keyboard navigation fails at a specific step, or a colour-only distinction is present. No test passes before remediation.

### 🟢 GREEN — implementation is done when

- [ ] Every RED test passes, unchanged
- [ ] `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` all clean
- [ ] No test is skipped, `.only`, or commented out

## Implementation notes

- **Axe-core integration:** Add `@axe-core/playwright` to the Playwright test suite. Create `e2e/accessibility.spec.ts` with a test for each of the 8 routes, checking both light and dark themes. The test must call `injectAxe()`, scan, and fail if violations are found (use `level: 'wcag2aa'`).
- **Form labels:** Audit `lib/validation/` schemas and form components (`components/forms/`). Every `<Input>`, `<Select>`, `<Textarea>` in the income, expense, category, and settings forms must have an associated `<label htmlFor>` or `aria-label`. Use shadcn `<Form.Item>` to pair label and control.
- **Focus order:** Use Chrome DevTools Accessibility tree to verify Tab order in each form. If needed, add `tabIndex={0}` or rearrange DOM order in components like the transaction list.
- **Focus rings:** Ensure Tailwind `ring` utility is applied on `:focus-visible`. Override `outline` to use `ring` and `ring-offset` for contrast. Test in light and dark by inspecting computed styles.
- **Keyboard-operable delete modal:** Enhance `components/ConfirmDeleteDialog.tsx` with `role="alertdialog"`, `aria-modal="true"`, initial focus on Cancel button, Escape handler, and focus trap using `focus-trap` library or manual management.
- **Income/expense indicators:** Modify transaction row components to render a prefix ("+" for income, "−" for expense) or icon (e.g. arrow-up/-down) in addition to the colour. Amounts in `<TransactionAmount>` component now include `aria-label="Income: ..."` or `aria-label="Expense: ..."`.
- **Toast accessibility:** Update `sonner` toast wrapper to use `role="status"` and `aria-live="polite"`. Ensure Undo link is in the tab order.
- **Form error association:** In `lib/validation/schemas.ts` and form components, add `aria-describedby={`error-${fieldName}`}` to inputs. Render error message with `id={`error-${fieldName}`}` below the field.
- **Chart alternatives:** In `components/IncomeExpenseTrendChart.tsx` and category breakdown charts, add an accessible table beneath or as a toggle. Test that chart root SVG is not announced as empty.
- **Zoom and reflow:** Test pages at 200%/400% zoom in Chrome. Ensure no `fixed` widths on containers; use `max-width` with `md:` breakpoints. Sidebar and bottom tab bar should collapse or reflow gracefully.
- **Print and greyscale:** Add print stylesheet to `globals.css` that removes background colours from balance cards, keeps income/expense prefix visible, and ensures ≥4.5:1 contrast. Test in Chrome Print preview with emulated greyscale.
- **Reduced motion:** Add `@media (prefers-reduced-motion: reduce)` in Tailwind config. Remove `transition` from elements and disable Recharts `animationDuration` when this preference is detected (pass via context or prop to chart components).

## Definition of done

- [ ] All ACs met and all RED tests green
- [ ] Axe-core scan integrated into CI and blocking on violations at WCAG AA level
- [ ] Every form has labels; every error has `aria-describedby`
- [ ] Focus rings visible at 3:1+ contrast; focus trap in delete modal; Escape dismissible
- [ ] Income/expense rows have non-colour indicator (prefix text or icon)
- [ ] Negative balance, toasts, and chart data are all announced correctly by screen readers
- [ ] No N+1 queries (no change to data layer)
- [ ] Responsive at 360px and 200% zoom; tap targets ≥44px (NFR-3)
- [ ] Print view contrast verified in greyscale and at zoom
- [ ] Reviewed by review-agent → passed to qa-agent → QA signed off
