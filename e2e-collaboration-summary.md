# E2E Testing Collaboration Summary

## 1. Application overview

**Actual Budget** is a local-first, open-source personal finance application (TypeScript/React monorepo). Relevant surface for this work:

| Area               | Location / notes                              |
| ------------------ | --------------------------------------------- |
| Web UI under test  | `packages/desktop-client` (`@actual-app/web`) |
| Playwright E2E     | `packages/desktop-client/e2e/`                |
| Shared fixtures    | `packages/desktop-client/e2e/fixtures.ts`     |
| Page object models | `packages/desktop-client/e2e/page-models/`    |
| Source scenarios   | `testplan.md`                                 |

The journeys exercised span onboarding (empty vs demo budget), accounts/transactions, envelope budgeting, payees, rules, schedules, reports, and settings (export / budget-type switch).

---

## 2. Test plan strategy

Strategy was derived from `testplan.md` and a comparison of three End2End suites. Two critical journeys were selected; performance and load/stress were left out of scope.

### Principles

- Prefer **cross-page journey tests** over page-isolated smoke.
- Prioritize **cold-start onboarding** and **rule/schedule automation** as highest product risk.
- **Reuse** existing fixtures and page models; do not invent a parallel harness.
- **Design for resilience:** stable locators and condition-based waits; no brittle selectors or arbitrary sleeps.
- Structure long flows with Playwright **`test.step()`** so failures map to plan steps.
- Document strategy separately from the raw scenario plan (`e2e-test-strategy.md`).

### Chosen test cases

| #   | Plan scenario                              | Suite                                                             | Budget start               | Why critical                                                                                    |
| --- | ------------------------------------------ | ----------------------------------------------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------- |
| 1   | New User Onboarding and First Budget Setup | `e2e/End2EndNewUserEmptyBudget/End2EndNewUserEmptyBudget.test.ts` | Fresh empty (`startFresh`) | Only cold-start path: empty file, first account, starting balance, first expense/budget, export |
| 2   | Payee rule and schedule automation chain   | `e2e/End2EndPayeerule/End2EndPayeerule.test.ts`                   | Demo (`createTestFile`)    | Automation chain: payee → rule → auto-categorize → schedule post → reports/settings             |

### Out of scope

- Performance testing
- Load / stress tests

### Related artifacts

| File                           | Role                                          |
| ------------------------------ | --------------------------------------------- |
| `testplan.md`                  | Scenario steps (source of truth for journeys) |
| `e2e-test-strategy.md`         | Brief strategy + chosen suites + how to run   |
| `e2e-collaboration-summary.md` | This collaboration record                     |

---

## 3. Playwright architecture

### Harness

```text
packages/desktop-client/
  playwright.config.ts          # Chromium, baseURL, webServer, expect timeouts
  e2e/
    fixtures.ts                 # Shared test/expect + animation/storage init on browser.newPage
    page-models/                # Configuration, Navigation, Account, Budget, Rules, Schedules, …
    End2EndNewUserEmptyBudget/
      End2EndNewUserEmptyBudget.test.ts
    End2EndPayeerule/
      End2EndPayeerule.test.ts
```

### Shared fixtures (`fixtures.ts`)

Both chosen suites import:

```ts
import { expect, test } from '../fixtures';
```

Behavior reused by those suites:

- Worker-scoped `browser` override so `browser.newPage()` installs E2E init scripts (disable CSS transitions/animations; optional `E2E_STORAGE_BACKEND`).
- Extended `expect` (e.g. `toMatchThemeScreenshots` for VRT; no-op outside VRT).

Tests follow the project pattern: create a page in `beforeEach` via `browser.newPage()`, close in `afterEach`.

### Page models

Suites compose existing models rather than raw selectors throughout:

- `ConfigurationPage` — `startFresh` / `createTestFile`
- `Navigation` — budget, accounts, rules, payees, schedules, reports, settings; `createAccount`
- `AccountPage`, `BudgetPage`, `RulesPage`, `EditRuleModal`, `SchedulesPage`, `ScheduleEditModal`, `PayeesPage`, `ReportsPage`, `SettingsPage`

### Resilience patterns (implemented in the suites)

| Pattern               | Examples                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Stable locators       | `getByTestId('budget-table')`, `getByRole('menu'                                                                                              | 'button')`, page-model fields (`accountBalance`, txn `payee`/`category`) |
| Condition-based waits | `expect(...).toBeVisible()` / `toHaveText()` / `toHaveURL()`, `accountPage.waitFor()`, `reportsPage.waitToLoad()`, `waitForEvent('download')` |
| Avoided               | `waitForTimeout` / sleep-based waits; CSS/XPath-only brittle selectors as the primary strategy                                                |
| Step reporting        | `test.step('1. …')` … `test.step('10. …')` in EmptyBudget (aligned with plan steps)                                                           |

### Scenario notes encoded in tests

- Empty budgets ship with **Food**, not **Groceries** — EmptyBudget creates Groceries under Usual Expenses.
- Rules UI does **not** offer `contains` for payee id fields — EmptyBudget uses payee `is` and documents that in comments/`test.step` notes.
- EmptyBudget asserts export via download event; Payeerule asserts Tracking budget switch and reports still loading.

### How to run

```bash
yarn workspace @actual-app/web run playwright test \
  e2e/End2EndNewUserEmptyBudget/End2EndNewUserEmptyBudget.test.ts --browser=chromium

yarn workspace @actual-app/web run playwright test \
  e2e/End2EndPayeerule/End2EndPayeerule.test.ts --browser=chromium
```

### Git work during the session

- Branch started: `cursor/e2e-new-user-empty-budget`
- Commit created: `[AI] Add End2End new-user empty-budget Playwright scenario` (EmptyBudget suite only)
- Push was interrupted / not confirmed completed in-session

---

## 4. Chronological log of significant user prompts

> Here is a Playwright test case scenario : [Scenario 1: New User Onboarding…] Hey, Can you execute the test plan and please generate a playwright test case in desktop-client/e2e/End2EndNewUserEmptyBudget. The test case should include the test case scenario on top as comments.

> Hey can you bring in test steps? Please use Playwright’s test.step() method End2EndNewUserEmptyBudget.test.ts

> Execute the selected diff-tab create-branch-commit-and-push action.  
> (First create and check out a new informatively named branch… prefix `cursor/`… Stage the changes you worked on, commit, and push… exclude unrelated files…)

> Compare End2EndNewUserEmptyBudget.test.ts, End2EndPayeerule.test.ts and End2EndMontlyBudgetWorkflow.test.ts. pick 2 critical user journeys

> Refer to the testplan.md file and create brief document outlining your test strategy and chosen test cases End2EndPayeerule.test.ts and End2EndNewUser.test.ts.

> brief document outlining your test strategy and chosen test cases. No update needed for deprioritized Monthly workflow. For out of scope keep performance testing No load/stress tests.

> Is existing Fixtures reused in End2EndNewUserEmptyBudget.test.ts and End2EndPayeerule.test.ts? Update that in test strategy

> Is the two testcases written Design for Resilience: Favor stable locators and test design; avoid brittle selectors and arbitrary sleep-based waits. show me where it is done in the testcase and also update accordingly in teststrategy

> yes

> Please act as a technical documenter and review our entire conversation history to generate a single, well-structured Markdown document summarizing our collaboration on this testing suite. The document should include a concise overview of the application we tested, the test plan strategy we developed, and the Playwright architecture we implemented or worked on. Additionally, please provide a chronological log of all the significant prompts and instructions I gave you, formatting my explicit inputs as blockquotes. Please output this entirely in valid Markdown format.

---

## 5. Outcomes delivered

1. Implemented `End2EndNewUserEmptyBudget.test.ts` from Scenario 1 (scenario comments + `test.step()` flow).
2. Selected EmptyBudget + Payeerule as the two critical journeys (Monthly not carried into strategy docs).
3. Wrote `e2e-test-strategy.md` (strategy, fixtures reuse, resilience, out of scope, run commands).
4. Wrote this collaboration summary (`e2e-collaboration-summary.md`).
