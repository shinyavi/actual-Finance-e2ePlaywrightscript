# End-to-End Test Plan

##  Scenario 1: New User Onboarding and First Budget Setup

**Objective:** Verify a brand new user can create a budget, add an account, enter transactions, set up rules and schedules, and review reports.

### Steps

1. **Configuration Page** — Load the app, click "Start budgeting" to create a fresh empty budget
2. **Navigation** — Navigate to the Budget page and verify the budget table renders
3. **Account Page** — Create a new on-budget account named "Checking" with a $5,000 starting balance; verify the initial balance transaction appears
4. **Account Page** — Add an expense transaction: payee "Whole Foods", debit $120.00, category "Groceries"; verify account balance updates to $4,880.00
5. **Budget Page** — Navigate back to Budget; set the Groceries category budget to $400; verify the total budgeted amount increases
6. **Rules Page** — Navigate to Settings > Rules; create a rule: if payee contains "Whole Foods" then set category to "Groceries" and notes to "Grocery run"; save and verify the rule appears in the list
7. **Schedules Page** — Navigate to Schedules; create a recurring schedule named "Monthly Rent", payee "Landlord", account "Checking", amount $1,500; save and verify the schedule appears
8. **Payees Page** — Navigate to Settings > Payees; search for "Whole" in the payee filter; verify "Whole Foods" appears in the filtered results
9. **Reports Page** — Navigate to Reports; open the Net Worth report and verify it renders; open the Cash Flow report and verify it renders
10. **Settings Page** — Navigate to Settings > General; verify the Export data button is visible and functional

---

## Scenario 2: Payee rule and schedule automation chain

**Goal:** Verify payee-driven rule creation auto-categorizes transactions, schedules reuse that automation, and reports/settings still work after the chain.

| Step | Page | Action | Expected result |
|------|------|--------|-----------------|
| 1 | ConfigurationPage | Create the demo test budget (`createTestFile`) | Demo budget loads |
| 2 | Navigation | Go to Payees | PayeesPage loads with demo payees |
| 3 | PayeesPage | Search for an existing payee and open the context menu | Menu shows Create rule |
| 4 | PayeesPage | Choose Create rule | Rule editor opens with the payee condition prefilled |
| 5 | RulesPage | Complete the rule (set category action) and save | Rule appears in the rules list for that payee |
| 6 | Navigation | Go to an on-budget account | AccountPage loads |
| 7 | AccountPage | Create a transaction using that payee (leave category unset if UI allows, or verify override) | Rule applies; transaction is categorized to the rule’s category |
| 8 | BudgetPage | Open the budget and check that category | Spent increases by the transaction amount |
| 9 | SchedulesPage | Create a schedule for the same payee and account | Schedule is listed |
| 10 | SchedulesPage | Post the schedule | Schedule posts successfully |
| 11 | AccountPage | Open the account | Posted schedule transaction is present and categorized per the rule |
| 12 | ReportsPage | Open Cash Flow or Balance Forecast | Report loads and reflects the new activity |
| 13 | SettingsPage | Switch budget type to Tracking (or export data) then open Reports again | Setting change succeeds; reports still load |

**Pages covered:** ConfigurationPage, Navigation, PayeesPage, RulesPage, AccountPage, BudgetPage, SchedulesPage, ReportsPage, SettingsPage
