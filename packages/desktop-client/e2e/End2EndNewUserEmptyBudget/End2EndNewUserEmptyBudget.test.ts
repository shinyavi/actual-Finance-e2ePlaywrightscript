/**
 * Scenario 1: New User Onboarding and First Budget Setup
 *
 * Objective: Verify a brand new user can create a budget, add an account,
 * enter transactions, set up rules and schedules, and review reports.
 *
 * Steps
 * 1. Configuration Page — Load the app, click "Start budgeting" to create a
 *    fresh empty budget
 * 2. Navigation — Navigate to the Budget page and verify the budget table
 *    renders; create a "Groceries" category (empty budgets ship with Food,
 *    not Groceries)
 * 3. Account Page — Create a new on-budget account named "Checking" with a
 *    $5,000 starting balance; verify the initial balance transaction appears
 * 4. Account Page — Add an expense transaction: payee "Whole Foods", debit
 *    $120.00, category "Groceries"; verify account balance updates to
 *    $4,880.00
 * 5. Budget Page — Navigate back to Budget; set the Groceries category budget
 *    to $400; verify the total budgeted amount increases
 * 6. Rules Page — Navigate to Settings > Rules; create a rule: if payee is
 *    "Whole Foods" then set category to "Groceries" and notes to
 *    "Grocery run"; save and verify the rule appears in the list
 *    (Rules UI does not offer "contains" for payee id fields.)
 * 7. Schedules Page — Navigate to Schedules; create a recurring schedule
 *    named "Monthly Rent", payee "Landlord", account "Checking", amount
 *    $1,500; save and verify the schedule appears
 * 8. Payees Page — Navigate to Settings > Payees; search for "Whole" in the
 *    payee filter; verify "Whole Foods" appears in the filtered results
 * 9. Reports Page — Navigate to Reports; open the Net Worth report and verify
 *    it renders; open the Cash Flow report and verify it renders
 * 10. Settings Page — Navigate to Settings > General; verify the Export data
 *     button is visible and functional
 */

import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures';
import type { BudgetPage } from '../page-models/budget-page';
import { ConfigurationPage } from '../page-models/configuration-page';
import { Navigation } from '../page-models/navigation';
import type { SchedulesPage } from '../page-models/schedules-page';

const ACCOUNT = 'Checking';
const STARTING_BALANCE = 5000;
const PAYEE = 'Whole Foods';
const PAYEE_SEARCH = 'Whole';
const CATEGORY = 'Groceries';
const EXPENSE_DEBIT = '120.00';
const EXPECTED_BALANCE = '4,880.00';
const GROCERIES_BUDGET = '400';
const RULE_NOTES = 'Grocery run';
const SCHEDULE_NAME = 'Monthly Rent';
const SCHEDULE_PAYEE = 'Landlord';
const SCHEDULE_AMOUNT = 1500;

async function addCategoryToGroup(
  page: Page,
  budgetPage: BudgetPage,
  groupName: string,
  categoryName: string,
) {
  const groupLabel = budgetPage.budgetTable.getByText(groupName, {
    exact: true,
  });
  await groupLabel.scrollIntoViewIfNeeded();
  await groupLabel.hover();

  const groupHeader = groupLabel.locator(
    'xpath=ancestor::*[.//button[@aria-label="Add category"]][1]',
  );
  await groupHeader.getByRole('button', { name: 'Add category' }).click();

  const nameInput = page.getByPlaceholder('New category name');
  await expect(nameInput).toBeVisible();
  await nameInput.fill(categoryName);
  await page.keyboard.press('Enter');

  await expect(
    budgetPage.budgetTable.getByText(categoryName, { exact: true }),
  ).toBeVisible();
}

async function findScheduleIndex(
  schedulesPage: SchedulesPage,
  {
    payee,
    account,
    amount,
  }: {
    payee: string;
    account: string;
    amount?: string;
  },
) {
  const count = await schedulesPage.schedulesTableRow.count();
  for (let i = 0; i < count; i++) {
    const schedule = schedulesPage.getNthSchedule(i);
    const payeeText = await schedule.payee.textContent();
    const accountText = await schedule.account.textContent();
    if (!payeeText?.includes(payee) || !accountText?.includes(account)) {
      continue;
    }
    if (amount) {
      const amountText = await schedule.amount.textContent();
      if (!amountText?.includes(amount)) {
        continue;
      }
    }
    return i;
  }

  throw new Error(
    `Schedule for payee "${payee}" on account "${account}" was not found`,
  );
}

test.describe('End2End new user empty budget', () => {
  let page: Page;
  let navigation: Navigation;
  let configurationPage: ConfigurationPage;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    navigation = new Navigation(page);
    configurationPage = new ConfigurationPage(page);

    await page.goto('/');
  });

  test.afterEach(async () => {
    await page?.close();
  });

  test('new user onboarding and first budget setup', async () => {
    test.setTimeout(120_000);

    await test.step('1. Configuration Page — create a fresh empty budget', async () => {
      await configurationPage.startFresh();
      await expect(page.getByTestId('budget-table')).toBeVisible();
    });

    await test.step('2. Budget Page — verify table and create Groceries', async () => {
      const budgetPage = await navigation.goToBudgetPage();
      await expect(budgetPage.budgetTable).toBeVisible();
      await addCategoryToGroup(page, budgetPage, 'Usual Expenses', CATEGORY);
    });

    const accountPage = await test.step(
      '3. Account Page — create Checking with $5,000 starting balance',
      async () => {
        const createdAccountPage = await navigation.createAccount({
          name: ACCOUNT,
          offBudget: false,
          balance: STARTING_BALANCE,
        });
        await expect(createdAccountPage.accountName).toContainText(ACCOUNT);

        const startingBalanceTxn = createdAccountPage.getNthTransaction(0);
        await expect(startingBalanceTxn.payee).toHaveText('Starting Balance');
        await expect(startingBalanceTxn.category).toHaveText(
          'Starting Balances',
        );
        await expect(startingBalanceTxn.credit).toHaveText('5,000.00');
        await expect(createdAccountPage.accountBalance).toHaveText('5,000.00');
        return createdAccountPage;
      },
    );

    await test.step('4. Account Page — Whole Foods expense; balance updates', async () => {
      await accountPage.createSingleTransaction({
        payee: PAYEE,
        debit: EXPENSE_DEBIT,
        category: CATEGORY,
      });
      const expenseTxn = accountPage.getNthTransaction(0);
      await expect(expenseTxn.payee).toHaveText(PAYEE);
      await expect(expenseTxn.category).toHaveText(CATEGORY);
      await expect(expenseTxn.debit).toHaveText(EXPENSE_DEBIT);
      await expect(accountPage.accountBalance).toHaveText(EXPECTED_BALANCE);
    });

    await test.step('5. Budget Page — set Groceries budget to $400', async () => {
      const budgetBefore = await navigation.goToBudgetPage();
      const totalBudgetedBefore = await budgetBefore.getTotalBudgeted();
      await budgetBefore.setBudgetedAmount(CATEGORY, GROCERIES_BUDGET);
      const totalBudgetedAfter = await budgetBefore.getTotalBudgeted();
      expect(totalBudgetedAfter).toBeGreaterThan(totalBudgetedBefore);
    });

    await test.step('6. Rules Page — create Whole Foods rule', async () => {
      // payee is an id field; contains/matches are not offered in the Rules UI
      const rulesPage = await navigation.goToRulesPage();
      const editRuleModal = await rulesPage.createNewRule();
      await editRuleModal.fill({
        conditions: [
          {
            field: 'payee',
            op: 'is',
            value: PAYEE,
          },
        ],
        actions: [
          { field: 'category', value: CATEGORY },
          { op: 'set', field: 'notes', value: RULE_NOTES },
        ],
      });
      await editRuleModal.save();
      await expect(editRuleModal.locator).toBeHidden();

      await rulesPage.searchFor(PAYEE);
      const createdRuleRow = page
        .getByTestId('table')
        .getByTestId('row')
        .filter({ hasText: `payee is ${PAYEE}` })
        .filter({ hasText: `set category to ${CATEGORY}` });
      await expect(createdRuleRow).toBeVisible();
      await expect(createdRuleRow).toContainText(`set notes to ${RULE_NOTES}`);
    });

    await test.step('7. Schedules Page — create Monthly Rent schedule', async () => {
      const schedulesPage = await navigation.goToSchedulesPage();
      const scheduleEditModal = await schedulesPage.addNewSchedule();
      await scheduleEditModal.fill({
        scheduleName: SCHEDULE_NAME,
        payee: SCHEDULE_PAYEE,
        account: ACCOUNT,
        amount: SCHEDULE_AMOUNT,
      });
      await scheduleEditModal.add();

      const scheduleIndex = await findScheduleIndex(schedulesPage, {
        payee: SCHEDULE_PAYEE,
        account: ACCOUNT,
        amount: '1,500.00',
      });
      const schedule = schedulesPage.getNthSchedule(scheduleIndex);
      await expect(schedule.payee).toHaveText(SCHEDULE_PAYEE);
      await expect(schedule.account).toHaveText(ACCOUNT);
      await expect(schedule.amount).toContainText('1,500.00');
    });

    await test.step('8. Payees Page — search for "Whole"', async () => {
      const payeesPage = await navigation.goToPayeesPage();
      await payeesPage.searchFor(PAYEE_SEARCH);
      await expect(page.getByText(PAYEE).first()).toBeVisible();
    });

    await test.step('9. Reports Page — Net Worth and Cash Flow render', async () => {
      const reportsPage = await navigation.goToReportsPage();
      await reportsPage.waitToLoad();

      await reportsPage.goToNetWorthPage();
      await expect(page).toHaveURL(/\/reports\/net-worth\//);
      await expect(
        page.getByText('Net Worth', { exact: true }).first(),
      ).toBeVisible();

      await navigation.goToReportsPage();
      await reportsPage.waitToLoad();
      await reportsPage.goToCashFlowPage();
      await expect(page).toHaveURL(/\/reports\/cash-flow\//);
      await expect(
        page.getByText('Cash Flow', { exact: true }).first(),
      ).toBeVisible();
    });

    await test.step('10. Settings Page — Export data is visible and functional', async () => {
      const settingsPage = await navigation.goToSettingsPage();
      await settingsPage.goToSection('General');
      await expect(settingsPage.exportDataButton).toBeVisible();

      const downloadPromise = page.waitForEvent('download');
      await settingsPage.exportDataButton.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/^\d{4}-\d{2}-\d{2}-.*.zip$/);
    });
  });
});
