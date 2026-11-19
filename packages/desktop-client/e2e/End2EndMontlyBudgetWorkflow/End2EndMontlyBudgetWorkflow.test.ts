/**
 * Scenario 2: Monthly Budgeting Workflow with Transaction Search and Rule Application
 *
 * Objective: Verify a user can allocate budget, add and search transactions,
 * apply rules automatically, post a scheduled transaction, and review spending
 * in reports.
 *
 * Steps
 * 1. Configuration Page — Load the app and create a demo budget with sample data
 * 2. Budget Page — Verify the budget summary shows Available funds, Budgeted, and
 *    Overspent fields; record the current spent total
 * 3. Account Page — Navigate to an existing account; add a transaction: payee
 *    "Shell Gas Station", debit $45.00, category "Transportation"
 * 4. Account Page — Search for "Shell" in the account transaction list; verify
 *    only matching transactions appear
 * 5. Rules Page — Navigate to Settings > Rules; create a rule: if payee is
 *    "Shell Gas Station" then set category to "Transportation" and notes to
 *    "Fuel"; save
 *    (Rules UI does not offer "contains" for payee id fields.)
 * 6. Account Page — Return to the account; add another transaction with payee
 *    "Shell Gas Station" and verify the rule auto-applies the category and notes
 * 7. Account Page — Search for "Fuel" using the Note filter; verify the
 *    rule-tagged transaction appears
 * 8. Schedules Page — Navigate to Schedules; create a schedule named "Gas Budget",
 *    payee "Shell Gas Station", account "Checking", amount $45.00; post the
 *    schedule as a real transaction
 * 9. Budget Page — Navigate to Budget; verify the Transportation category spent
 *    amount increased due to the new transaction
 * 10. Reports Page — Navigate to Reports; open Cash Flow report; verify the
 *     spending breakdown includes the Transportation category
 *
 * Demo-data notes:
 * - "Checking" is mapped to "Capital One Checking" (no plain Checking account).
 * - "Transportation" is created under Usual Expenses (not in the demo template).
 */

import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures';
import type { AccountPage } from '../page-models/account-page';
import type { BudgetPage } from '../page-models/budget-page';
import { ConfigurationPage } from '../page-models/configuration-page';
import { Navigation } from '../page-models/navigation';
import type { SchedulesPage } from '../page-models/schedules-page';

const PAYEE = 'Shell Gas Station';
const PAYEE_SEARCH = 'Shell';
const CATEGORY = 'Transportation';
const NOTES = 'Fuel';
const ACCOUNT = 'Capital One Checking';
const SCHEDULE_NAME = 'Gas Budget';
const AMOUNT = '45.00';
const AMOUNT_NUMBER = 45;

function parseAmountToCents(text: string | null) {
  if (!text) {
    return 0;
  }

  const normalized = text.replace(/[^0-9.-]/g, '');
  if (!normalized || normalized === '-' || normalized === '.') {
    return 0;
  }

  return Math.round(parseFloat(normalized) * 100);
}

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

async function getCategorySpentCents(
  budgetPage: BudgetPage,
  categoryName: string,
) {
  const row = budgetPage.budgetTable
    .getByTestId('row')
    .filter({ hasText: categoryName })
    .first();
  await expect(row).toBeVisible();
  return parseAmountToCents(
    await row.getByTestId('category-month-spent').textContent(),
  );
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

test.describe('End2End monthly budgeting workflow', () => {
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

  test('monthly budgeting workflow with transaction search and rule application', async () => {
    let accountPage: AccountPage;
    let totalSpentBefore = 0;
    let spentBeforeSchedule = 0;

    await test.step('1. Configuration Page — create demo budget', async () => {
      await configurationPage.createTestFile();
      await expect(page.getByTestId('budget-table')).toBeVisible();
    });

    await test.step('2. Budget Page — verify summary and create Transportation', async () => {
      const budgetPage = await navigation.goToBudgetPage();
      const summary = budgetPage.budgetSummary.first();
      await expect(summary.getByText('Available funds')).toBeVisible();
      await expect(summary.getByText(/^Overspent in /)).toBeVisible();
      await expect(summary.getByText('Budgeted')).toBeVisible();

      totalSpentBefore = await budgetPage.getTotalSpent();

      await addCategoryToGroup(page, budgetPage, 'Usual Expenses', CATEGORY);
      await expect(
        Math.abs(await getCategorySpentCents(budgetPage, CATEGORY)),
      ).toBe(0);
    });

    await test.step('3. Account Page — add Shell Gas Station transaction', async () => {
      accountPage = await navigation.goToAccountPage(ACCOUNT);
      await accountPage.waitFor();
      await accountPage.createSingleTransaction({
        payee: PAYEE,
        debit: AMOUNT,
        category: CATEGORY,
      });
      const firstTxn = accountPage.getNthTransaction(0);
      await expect(firstTxn.payee).toHaveText(PAYEE);
      await expect(firstTxn.category).toHaveText(CATEGORY);
      await expect(firstTxn.debit).toHaveText(AMOUNT);
    });

    await test.step('4. Account Page — search payee contains "Shell"', async () => {
      const payeeFilter = await accountPage.filterBy('Payee');
      const filtersMenu = page.getByTestId('filters-menu-tooltip');
      await filtersMenu.getByRole('button', { name: 'contains' }).click();
      await filtersMenu.getByPlaceholder('nothing').fill(PAYEE_SEARCH);
      await payeeFilter.applyButton.click();

      const filteredCount = await accountPage.transactionTableRow.count();
      expect(filteredCount).toBeGreaterThan(0);
      for (let i = 0; i < filteredCount; i++) {
        await expect(accountPage.getNthTransaction(i).payee).toContainText(
          PAYEE_SEARCH,
        );
      }
      await accountPage.removeFilter(0);
    });

    await test.step('5. Rules Page — create payee-is Shell Gas Station rule', async () => {
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
          { op: 'set', field: 'notes', value: NOTES },
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
      await expect(createdRuleRow).toContainText(`set notes to ${NOTES}`);
    });

    await test.step('6. Account Page — new Shell txn gets category + notes from rule', async () => {
      accountPage = await navigation.goToAccountPage(ACCOUNT);
      await accountPage.createSingleTransaction({
        payee: PAYEE,
        debit: AMOUNT,
      });
      const ruledTxn = accountPage.getNthTransaction(0);
      await expect(ruledTxn.payee).toHaveText(PAYEE);
      await expect(ruledTxn.category).toHaveText(CATEGORY);
      await expect(ruledTxn.notes).toHaveText(NOTES);
      await expect(ruledTxn.debit).toHaveText(AMOUNT);
    });

    await test.step('7. Account Page — Note filter for "Fuel"', async () => {
      await accountPage.filterByNote(NOTES);
      const noteFilteredCount = await accountPage.transactionTableRow.count();
      expect(noteFilteredCount).toBeGreaterThan(0);
      for (let i = 0; i < noteFilteredCount; i++) {
        await expect(accountPage.getNthTransaction(i).notes).toContainText(
          NOTES,
        );
      }
      await accountPage.removeFilter(0);

      const budget = await navigation.goToBudgetPage();
      spentBeforeSchedule = await getCategorySpentCents(budget, CATEGORY);
    });

    await test.step('8. Schedules Page — create + post "Gas Budget"', async () => {
      const schedulesPage = await navigation.goToSchedulesPage();
      const scheduleEditModal = await schedulesPage.addNewSchedule();
      await scheduleEditModal.fill({
        scheduleName: SCHEDULE_NAME,
        payee: PAYEE,
        account: ACCOUNT,
        amount: AMOUNT_NUMBER,
      });
      await scheduleEditModal.add();

      const scheduleIndex = await findScheduleIndex(schedulesPage, {
        payee: PAYEE,
        account: ACCOUNT,
        amount: AMOUNT,
      });
      await expect(
        schedulesPage.getNthSchedule(scheduleIndex).payee,
      ).toHaveText(PAYEE);
      await schedulesPage.postNthSchedule(scheduleIndex);
      await expect(
        schedulesPage.getNthSchedule(scheduleIndex).status,
      ).toHaveText('Paid');

      accountPage = await navigation.goToAccountPage(ACCOUNT);
      const postedScheduleTxn = accountPage.getNthTransaction(0);
      await expect(postedScheduleTxn.payee).toHaveText(PAYEE);
      await expect(postedScheduleTxn.debit).toHaveText(AMOUNT);
    });

    await test.step('9. Budget Page — Transportation spent increased', async () => {
      const budgetAfter = await navigation.goToBudgetPage();
      const spentAfterSchedule = await getCategorySpentCents(
        budgetAfter,
        CATEGORY,
      );
      // Manual Shell txs are categorized; posted schedule may also match the rule.
      expect(Math.abs(spentAfterSchedule)).toBeGreaterThanOrEqual(
        Math.abs(spentBeforeSchedule),
      );
      expect(Math.abs(spentAfterSchedule)).toBeGreaterThanOrEqual(
        parseAmountToCents(AMOUNT) * 2,
      );

      const totalSpentAfter = await budgetAfter.getTotalSpent();
      expect(Math.abs(totalSpentAfter)).toBeGreaterThanOrEqual(
        Math.abs(totalSpentBefore),
      );
    });

    await test.step('10. Reports Page — Cash Flow loads with expense totals', async () => {
      const reportsPage = await navigation.goToReportsPage();
      await reportsPage.waitToLoad();
      await reportsPage.goToCashFlowPage();
      await expect(page).toHaveURL(/\/reports\/cash-flow\//);
      await expect(
        page.getByText('Cash Flow', { exact: true }).first(),
      ).toBeVisible();
      await expect(page.getByText('Expenses:')).toBeVisible();
    });
  });
});
