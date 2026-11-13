# E2E Test Strategy

## Purpose

Playwright End2End coverage for Actual’s desktop-client critical paths, based on [testplan.md](testplan.md). The goal is to prove the highest-risk user journeys work end to end, not to exhaustively test every page in isolation.

## Strategy

- Prefer **journey tests** that walk real product flows across Configuration, Budget, Accounts, Rules, Schedules, Payees, Reports, and Settings.
- Focus on two risk areas: **cold-start onboarding** (empty budget) and **automation** (payee rules + schedules).
- **Reuse shared fixtures** from [`packages/desktop-client/e2e/fixtures.ts`](packages/desktop-client/e2e/fixtures.ts) (`import { expect, test } from '../fixtures'`) so both suites get animation-disable init scripts and the extended `expect`.
- **Reuse page models** under [`packages/desktop-client/e2e/page-models/`](packages/desktop-client/e2e/page-models/) for navigation and interactions.
- **Design for resilience:** stable locators (`getByRole`, `getByTestId`, page-model fields) and condition-based waits (`expect(...).toBeVisible()` / `toHaveText()` / `toHaveURL()`, `waitFor()`, `waitToLoad()`, `waitForEvent`). Avoid brittle CSS/XPath-only selectors and arbitrary `waitForTimeout` sleeps.
- Structure long flows with `test.step()` so failures map cleanly to plan steps.

## Chosen test cases

### 1. New User Onboarding and First Budget Setup

- **Plan:** [testplan.md](testplan.md) Scenario 1
- **Suite:** [`packages/desktop-client/e2e/End2EndNewUserEmptyBudget/End2EndNewUserEmptyBudget.test.ts`](packages/desktop-client/e2e/End2EndNewUserEmptyBudget/End2EndNewUserEmptyBudget.test.ts)
- **Why critical:** Only path that validates cold start — empty budget, first account, starting balance, first expense, first budget allocation, and export.
- **Covers:** `startFresh` → Budget table → Checking ($5,000) → Whole Foods expense → Groceries budget → rule → Monthly Rent schedule → Payees search → Net Worth / Cash Flow → Export data.

### 2. Payee rule and schedule automation chain

- **Plan:** [testplan.md](testplan.md) Scenario 2
- **Suite:** [`packages/desktop-client/e2e/End2EndPayeerule/End2EndPayeerule.test.ts`](packages/desktop-client/e2e/End2EndPayeerule/End2EndPayeerule.test.ts)
- **Why critical:** Proves the automation chain — create rule from payee, auto-categorize transactions, post a schedule that inherits the rule, then confirm reports and settings still work.
- **Covers:** `createTestFile` → Payees “Create rule” → auto-categorized txn → budget spent delta → schedule create/post → Cash Flow → switch to Tracking budgeting.

## Out of scope

- Performance testing
- Load / stress tests

## How to run

```bash
# Scenario 1 — new user empty budget
yarn workspace @actual-app/web run playwright test e2e/End2EndNewUserEmptyBudget/End2EndNewUserEmptyBudget.test.ts --browser=chromium

# Scenario 2 — payee rule automation
yarn workspace @actual-app/web run playwright test e2e/End2EndPayeerule/End2EndPayeerule.test.ts --browser=chromium
```
