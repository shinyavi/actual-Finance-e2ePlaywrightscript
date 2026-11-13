# AI Collaboration Log

Well-structured summary of the Cursor collaboration on Actual Budget’s desktop Playwright E2E suite: local setup, onboarding/test planning, architecture, module/runtime errors, and a chronological log of user instructions.

---

## 1. Application Overview

**Actual Budget** is an open-source, local-first personal finance app (TypeScript/React monorepo).

| Area          | Detail                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| Product       | Envelope budgeting with accounts, payees, rules, schedules, and reports |
| UI under test | `@actual-app/web` (`packages/desktop-client`)                           |
| E2E location  | `packages/desktop-client/e2e/`                                          |
| Demo budget   | `ConfigurationPage.createTestFile()` (“Try the demo”)                   |
| Dev URL       | `http://localhost:3001` (`yarn start` / Playwright `webServer`)         |

Surfaces involved: **Configuration**, **Budget**, **Accounts**, **Payees**, **Rules**, **Schedules**, **Reports**, **Settings**.

---

## 2. Local System Setup

### Goal

Run Actual locally so Playwright could drive the browser app.

### Options considered

| Approach                       | Outcome                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| **Kind / Kubernetes**          | Not applicable — no K8s manifests in the repo                                                       |
| **Docker Compose (repo root)** | Documented path: `docker compose up --build` → Node 24 image, `yarn start:browser` on port **3001** |
| **Colima + Docker CLI**        | Proposed when Docker Desktop/Kind were missing                                                      |
| **Native Yarn**                | Adopted after Docker/Colima install was blocked in the agent environment                            |

### What blocked Docker in-session

- Homebrew could not write `/opt/homebrew/Cellar` under the agent sandbox
- Colima needed hypervisor / home-directory writes outside the workspace
- Elevated `all` permissions did not reliably disable the sandbox

### Yarn path (final setup direction)

```bash
cd /Users/shinyarvind/Documents/RHPlaywrighttestcase/actual
yarn install
yarn start   # http://localhost:3001
```

### Yarn install / module state issues

| Symptom                                                                    | Cause / fix                                                                                                                  |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `Couldn't find the node_modules state file (findPackageLocation)`          | Incomplete install — missing `node_modules/.yarn-state.yml`; run `yarn install` from repo root                               |
| Link `EPERM` creating `.vscode` / `.idea` / `.claude` under `node_modules` | Agent sandbox blocked IDE-named paths inside packages; install needed unrestricted host shell or cache stripping workarounds |
| Playwright: browser executable missing                                     | `yarn workspace @actual-app/web exec playwright install chromium` (CDN may be sandbox-blocked)                               |
| `Cannot find the root of your workspace`                                   | Command run from parent of `actual/` — must run from **repo root**                                                           |

---

## 3. New User Onboarding (Test Strategy)

### Coverage insight

Existing desktop e2e tests were strong **per feature** on the **demo budget**, but weak as **cross-page journeys**. Onboarding (`startFresh`, imports) lived mostly in `onboarding.test.ts`; feature suites almost always used `createTestFile()`.

### Strategy documented in `testplan.md`

**Scenario 1 — Fresh-budget money loop (new-user path)**  
Empty budget → settings → create account → budget → schedule → reports → export.  
Protects the journey demo-based tests never see.

**Scenario 2 — Payee rule and schedule automation chain**  
Demo → Payees “Create rule” → Rules → account txn → budget spent → schedule → Cash Flow → Tracking.  
Closes Payees → Rules gap and exercises the automation spine.

### Later onboarding-style workflow (implemented)

**Monthly budgeting workflow** (`End2EndMontlyBudgetWorkflow`)  
Budget summary → create Transportation → Shell Gas Station txns → payee/note search → contains-Shell rule → schedule “Gas Budget” → spent check → Cash Flow.

### Demo-data mappings (onboarding realism)

| Scenario wording     | Demo reality                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| Checking             | `Capital One Checking`                                                                                 |
| Transportation       | Not in template — create under Usual Expenses                                                          |
| Fast Internet @ HSBC | Demo may already have Fast Internet @ Bank of America — lookup by payee **and** account **and** amount |

---

## 4. Playwright Architecture

### Layout

```
packages/desktop-client/
├── playwright.config.ts       # testDir: e2e/, Chromium, webServer → yarn start
└── e2e/
    ├── fixtures.ts
    ├── page-models/             # Configuration, Navigation, Account, Budget, …
    ├── End2EndPayeerule/
    │   └── End2EndPayeerule.test.ts
    ├── End2EndMontlyBudgetWorkflow/
    │   └── End2EndMontlyBudgetWorkflow.test.ts
    └── AI Collaboration Log.md  # this file
```

### Patterns

- Fixtures: `import { expect, test } from '../fixtures'`
- Page models for navigation and assertions
- Setup: `browser.newPage()` → `goto('/')` → `createTestFile()` / `startFresh()`
- Nested feature folders under `e2e/` (recursive discovery)
- **Relative imports only** from nested folders (`../fixtures`, `../page-models/...`)

### Useful commands

```bash
cd /Users/shinyarvind/Documents/RHPlaywrighttestcase/actual

yarn workspace @actual-app/web run playwright test \
  e2e/End2EndPayeerule/End2EndPayeerule.test.ts --browser=chromium

yarn workspace @actual-app/web run playwright test \
  e2e/End2EndMontlyBudgetWorkflow/End2EndMontlyBudgetWorkflow.test.ts \
  --browser=chromium --headed

# Debug / watch
yarn workspace @actual-app/web run playwright test … --debug
yarn workspace @actual-app/web run playwright test … --headed --slow-mo=500
```

---

## 5. Playwright Test Module & Assertion Errors

### Module resolution

```
Error: Cannot find module 'packages/desktop-client/e2e/fixtures'
```

**Cause:** Absolute-style imports that Node/Playwright cannot resolve.  
**Fix:** Relative imports:

```ts
import { expect, test } from '../fixtures';
import { ConfigurationPage } from '../page-models/configuration-page';
// …
```

Editor buffers sometimes reverted this; reload from disk before re-running.

### Assertion / locator failures fixed during collaboration

| Failure                                                                 | Root cause                                       | Fix                                                                                          |
| ----------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `conditionList` `toContainText('Fast Internet')` → received `"payeeis"` | Payee lives in an **input value**, not list text | `conditionList.getByRole('textbox')` → `toHaveValue(PAYEE)`                                  |
| Schedule account Expected `HSBC`, Received `Bank of America`            | Lookup by payee alone hit existing demo schedule | Match payee **+** account **+** amount                                                       |
| `getByRole('heading', { name: /Cash Flow/i })` timeout                  | Title is editable **plain text**, not a heading  | `toHaveURL(/\/reports\/cash-flow\/)` + `getByText('Cash Flow')` (+ `Expenses:` where useful) |
| `No tests found` after import failure                                   | Spec failed to load                              | Fix imports first                                                                            |

### Vite `webServer` noise

Warnings about `__dirname` in `vite.config.mts` / `configLoader: 'native'` are **not** test failures; they appear when Playwright starts the app.

---

## 6. Deliverables

| Artifact                                                                                                                               | Role                                     |
| -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| [`testplan.md`](../../../testplan.md) (repo root)                                                                                      | Two actionable E2E scenarios             |
| [`End2EndPayeerule/End2EndPayeerule.test.ts`](./End2EndPayeerule/End2EndPayeerule.test.ts)                                             | Payee → rule → schedule → reports chain  |
| [`End2EndMontlyBudgetWorkflow/End2EndMontlyBudgetWorkflow.test.ts`](./End2EndMontlyBudgetWorkflow/End2EndMontlyBudgetWorkflow.test.ts) | Monthly budget + search + rules workflow |
| This log                                                                                                                               | Collaboration / setup / error record     |

---

## 7. Chronological Log of Significant User Instructions

> set up the system locally (using Docker or Kind).

> ok do this Proposed path: Colima + Docker Compose (the repo’s supported local container setup).

> Set up Actual locally with Docker  
> Implement the plan as specified, it is attached for your reference. Do NOT edit the plan file itself.  
> To-do's from the plan have already been created. Do not create them again. Mark them as in_progress as you work, starting with the first one. Don't stop until you have completed all the to-dos.

> Start multitasking

> stop and just use yarn

> fix the error yarn start  
> Usage Error: Couldn't find the node_modules state file - running an install might help (findPackageLocation)

> suggest two high priority end to end testcase consider including missed critical user journey and make it is end to end scenario covers ConfigurationPage, Navigation, AccountPage, BudgetPage, PayeesPage, RulesPage, SchedulesPage, ReportsPage, SettingsPage

> Please create a testplan for the 2 end-to-end test scenario. Don't write any code yet. I just want to have an idea what I could test. Write the test plan to testplan.md and include two actionable test scenarios. Do not include any additional information.

> Here is a Playwright test case scenario :  
> [Scenario 2: Payee rule and schedule automation chain]  
> Hey, Can you execute the test plan and please generate a playwright test case in desktop-client/e2e/End2EndPayeerule. The test case should include the test case scenario on top as comments.

> give me the terminal command to run this script

> fix the error in the terminal

> /Users/shinyarvind/.cursor/projects/…/terminals/2.txt:L73-L107 fix this

> [Vite / retry terminal snippet] fix this error

> how to see the script execute visibly in chrome browser and with debug

> /Users/shinyarvind/.cursor/projects/…/terminals/2.txt:L228-L272 fix this error

> Expect "toBeVisible"( page.getByRole('heading', { name: /Cash Flow/i }) ) — 10.0s …

> Error: expect(locator).toHaveText(expected) failed  
> Locator: … getByTestId('account')  
> Expected: "HSBC"  
> Received: "Bank of America"

> Expect "toBeVisible"( page.getByRole('heading', { name: /Cash Flow/i }) )  
> waiting for getByRole('heading', { name: /Cash Flow/i })

> Here is a Playwright test case scenario :  
> [Scenario 2: Monthly Budgeting Workflow with Transaction Search and Rule Application]  
> Hey, Can you execute the test plan and please generate a playwright test case in desktop-client/e2e/End2EndMontlyBudgetWorkflow. The test case should include the test case scenario on top as comments.

> Please act as a technical documenter and review our entire conversation history to generate a single, well-structured Markdown document summarizing our collaboration on this testing suite. The document should include a concise overview of the application we tested, the test plan strategy we developed, and the Playwright architecture we implemented or worked on. Additionally, please provide a chronological log of all the significant prompts and instructions I gave you, formatting my explicit inputs as blockquotes. Please output this entirely in valid Markdown format.

> Create a AI Collaboration Log.md in e2e folder refer to local system setup, new user onboarding and Playwright test module error “[same documentation request as above]”

---

## 8. Outcomes

| Track                | Result                                                                            |
| -------------------- | --------------------------------------------------------------------------------- |
| Local Docker/Colima  | Attempted; replaced by Yarn due to environment limits                             |
| Yarn / node_modules  | Install and state-file issues identified and worked around                        |
| Test plan            | `testplan.md` with two high-priority cross-page scenarios                         |
| Playwright E2E       | Two nested suites authored; several module/locator failures fixed against real UI |
| Collaboration record | This file under `packages/desktop-client/e2e/`                                    |

---

_Generated from the Cursor collaboration session on Actual Budget desktop-client E2E testing._
