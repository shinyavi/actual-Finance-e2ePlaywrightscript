/**
 * Scenario 2: Payee rule and schedule automation chain
 *
 * Goal: Verify payee-driven rule creation auto-categorizes transactions,
 * schedules reuse that automation, and reports/settings still work after the chain.
 *
 * | Step | Page | Action | Expected result |
 * |------|------|--------|-----------------|
 * | 1 | ConfigurationPage | Create the demo test budget (`createTestFile`) | Demo budget loads |
 * | 2 | Navigation | Go to Payees | PayeesPage loads with demo payees |
 * | 3 | PayeesPage | Search for an existing payee and open the context menu | Menu shows Create rule |
 * | 4 | PayeesPage | Choose Create rule | Rule editor opens with the payee condition prefilled |
 * | 5 | RulesPage | Complete the rule (set category action) and save | Rule appears in the rules list for that payee |
 * | 6 | Navigation | Go to an on-budget account | AccountPage loads |
 * | 7 | AccountPage | Create a transaction using that payee (leave category unset if UI allows, or verify override) | Rule applies; transaction is categorized to the rule’s category |
 * | 8 | BudgetPage | Open the budget and check that category | Spent increases by the transaction amount |
 * | 9 | SchedulesPage | Create a schedule for the same payee and account | Schedule is listed |
 * | 10 | SchedulesPage | Post the schedule | Schedule posts successfully |
 * | 11 | AccountPage | Open the account | Posted schedule transaction is present and categorized per the rule |
 * | 12 | ReportsPage | Open Cash Flow or Balance Forecast | Report loads and reflects the new activity |
 * | 13 | SettingsPage | Switch budget type to Tracking (or export data) then open Reports again | Setting change succeeds; reports still load |
 *
 * Pages covered: ConfigurationPage, Navigation, PayeesPage, RulesPage,
 * AccountPage, BudgetPage, SchedulesPage, ReportsPage, SettingsPage
 */

import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures';
import { ConfigurationPage } from '../page-models/configuration-page';
import { EditRuleModal } from '../page-models/edit-rule-modal';
import { Navigation } from '../page-models/navigation';
import type { SchedulesPage } from '../page-models/schedules-page';

const PAYEE = 'Fast Internet';
const CATEGORY = 'General';
const ACCOUNT = 'HSBC';
const TRANSACTION_DEBIT = '12.34';
const SCHEDULE_AMOUNT = 15;

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

test.describe('End2End payee rule automation', () => {
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

  test('payee rule and schedule automation chain', async () => {
    // Step 1: ConfigurationPage — create demo budget
    await configurationPage.createTestFile();
    await expect(page.getByTestId('budget-table')).toBeVisible();

    // Step 2: Navigation — go to Payees
    const payeesPage = await navigation.goToPayeesPage();
    await expect(payeesPage.searchBox).toBeVisible();

    // Step 3: PayeesPage — search payee and open context menu
    await payeesPage.searchFor(PAYEE);
    await expect(page.getByText(PAYEE).first()).toBeVisible();
    await payeesPage.rightClickNthPayee(0);
    const payeeMenu = page.getByRole('menu');
    await expect(payeeMenu).toBeVisible();
    await expect(
      payeeMenu.getByRole('button', { name: 'Create rule' }),
    ).toBeVisible();

    // Step 4: PayeesPage — choose Create rule
    await payeeMenu.getByRole('button', { name: 'Create rule' }).click();
    const editRuleModal = new EditRuleModal(
      page.getByTestId('edit-rule-modal'),
    );
    await expect(editRuleModal.locator).toBeVisible();
    // Payee is prefilled in an input; button labels alone only expose "payee" / "is".
    await expect(editRuleModal.conditionList.getByRole('textbox')).toHaveValue(
      PAYEE,
    );

    // Step 5: Complete rule (set category) and verify on RulesPage
    await editRuleModal.fill({
      actions: [{ field: 'category', value: CATEGORY }],
    });
    await editRuleModal.save();
    await expect(editRuleModal.locator).toBeHidden();

    const rulesPage = await navigation.goToRulesPage();
    await rulesPage.searchFor(PAYEE);
    const createdRuleRow = page
      .getByTestId('table')
      .getByTestId('row')
      .filter({ hasText: `payee is ${PAYEE}` })
      .filter({ hasText: `set category to ${CATEGORY}` });
    await expect(createdRuleRow).toBeVisible();

    // Capture category spent before the manual transaction
    const budgetBefore = await navigation.goToBudgetPage();
    const categoryRow = budgetBefore.budgetTable
      .getByTestId('row')
      .filter({ hasText: CATEGORY })
      .first();
    await expect(categoryRow).toBeVisible();
    const spentBeforeCents = parseAmountToCents(
      await categoryRow.getByTestId('category-month-spent').textContent(),
    );

    // Step 6: Navigation — go to on-budget account
    const accountPage = await navigation.goToAccountPage(ACCOUNT);
    await accountPage.waitFor();
    await expect(accountPage.accountName).toContainText(ACCOUNT);

    // Step 7: AccountPage — create transaction; rule categorizes it
    await accountPage.createSingleTransaction({
      payee: PAYEE,
      debit: TRANSACTION_DEBIT,
    });
    const manualTransaction = accountPage.getNthTransaction(0);
    await expect(manualTransaction.payee).toHaveText(PAYEE);
    await expect(manualTransaction.category).toHaveText(CATEGORY);
    await expect(manualTransaction.debit).toHaveText(TRANSACTION_DEBIT);

    // Step 8: BudgetPage — category spent increases by transaction amount
    const budgetPage = await navigation.goToBudgetPage();
    const categoryRowAfter = budgetPage.budgetTable
      .getByTestId('row')
      .filter({ hasText: CATEGORY })
      .first();
    await expect(categoryRowAfter).toBeVisible();

    const spentAfterCents = parseAmountToCents(
      await categoryRowAfter.getByTestId('category-month-spent').textContent(),
    );
    expect(Math.abs(spentAfterCents - spentBeforeCents)).toBe(
      parseAmountToCents(TRANSACTION_DEBIT),
    );

    // Step 9: SchedulesPage — create schedule for same payee/account
    const schedulesPage = await navigation.goToSchedulesPage();
    const scheduleEditModal = await schedulesPage.addNewSchedule();
    await scheduleEditModal.fill({
      payee: PAYEE,
      account: ACCOUNT,
      amount: SCHEDULE_AMOUNT,
    });
    await scheduleEditModal.add();

    const scheduleIndex = await findScheduleIndex(schedulesPage, {
      payee: PAYEE,
      account: ACCOUNT,
      amount: SCHEDULE_AMOUNT.toFixed(2),
    });
    const schedule = schedulesPage.getNthSchedule(scheduleIndex);
    await expect(schedule.payee).toHaveText(PAYEE);
    await expect(schedule.account).toHaveText(ACCOUNT);

    // Step 10: SchedulesPage — post the schedule
    await schedulesPage.postNthSchedule(scheduleIndex);
    await expect(schedulesPage.getNthSchedule(scheduleIndex).status).toHaveText(
      'Paid',
    );

    // Step 11: AccountPage — posted schedule txn present and categorized
    const accountAfterSchedule = await navigation.goToAccountPage(ACCOUNT);
    const postedScheduleTxn = accountAfterSchedule.getNthTransaction(0);
    await expect(postedScheduleTxn.payee).toHaveText(PAYEE);
    await expect(postedScheduleTxn.debit).toHaveText(
      SCHEDULE_AMOUNT.toFixed(2),
    );
    await expect(postedScheduleTxn.category).toHaveText(CATEGORY);

    // Step 12: ReportsPage — open Cash Flow
    const reportsPage = await navigation.goToReportsPage();
    await reportsPage.waitToLoad();
    await reportsPage.goToCashFlowPage();
    // Title is editable plain text (not a heading role).
    await expect(page).toHaveURL(/\/reports\/cash-flow\//);
    await expect(
      page.getByText('Cash Flow', { exact: true }).first(),
    ).toBeVisible();

    // Step 13: SettingsPage — switch to Tracking, reports still load
    const settingsPage = await navigation.goToSettingsPage();
    await settingsPage.useBudgetType('Tracking');

    const reportsAfterSettings = await navigation.goToReportsPage();
    await reportsAfterSettings.waitToLoad();
    await expect(
      reportsAfterSettings.pageContent.getByRole('button', { name: /^Net/ }),
    ).toBeVisible();
  });
});
