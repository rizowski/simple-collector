import React, { useEffect, useState } from 'react';
import expense from '../lib/expense';
import { createAccountClient } from '../../injected/simple';

function Overview() {
  const [{ goals, balances, expenses }, setFinances] = useState({ goals: undefined, balances: undefined, expenses: undefined });
  const [accountId, setAccountId] = useState();
  const [userId, setUserId] = useState();
  const [selected, setSelected] = useState();
  const [simpleClient, setSimpleClient] = useState();

  function budgetExpenses(balances, expenses) {
    if (!balances || !expenses) {
      return;
    }

    const { budgeted } = expenses.reduce(
      (acc, ex) => {
        const { budget, adjustedTotal } = doMaths(acc.total, ex.target / 2);

        acc.budgeted.push({ ...ex, budget: budget, runningTotal: adjustedTotal });
        acc.total = adjustedTotal;

        return acc;
      },
      { total: balances.safe_to_spend, budgeted: [] }
    );

    return budgeted;
  }

  useEffect(() => {
    chrome.storage.local.get(['accountId', 'userId'], (local) => {
      chrome.storage.sync.get(['accountId', 'userId'], (sync) => {
        const config = { ...local, ...sync };

        setAccountId(config.accountId);
        setUserId(config.userId);

        setSimpleClient(createAccountClient(config.userId, config.accountId));

        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
          if (chrome.runtime.lastError) {
            console.error('LAST ERROR', chrome.runtime.lastError);
            return;
          }

          const [available] = tabs;

          const { id: currentTab } = available;

          chrome.tabs.sendMessage(
            currentTab,
            { type: 'fetch', what: [{ type: 'goals' }, { type: 'expenses' }, { type: 'balances' }], userId: config.userId, accountId: config.accountId },
            (response) => {
              if (!response) {
                console.log('Empty response for request on goals', chrome.runtime.lastError);
                return;
              }

              const { expenses, goals, balances } = response;

              console.log(expenses);
              console.log(expenses && expenses.items.map((ex) => ({ modified: new Date(ex.modified), name: ex.name })));

              setFinances({
                expenses: Array.isArray(expenses.items) && budgetExpenses(balances, expenses.items.map(expense.mapExpense)),
                goals,
                balances,
              });
              return true;
            }
          );
        });
      });
    });
  }, []);

  function formatAmount(amount) {
    if (typeof amount === 'number') {
      return (amount / 10000).toFixed(2);
    }
  }

  function doMaths(total, expenseAmount) {
    if (total > 0) {
      return {
        adjustedTotal: total - expenseAmount,
        budget: expenseAmount,
      };
    }

    return {
      adjustedTotal: total,
      budget: 0,
    };
  }

  function renderMath(safeToSpend, expenses) {
    if (!expenses) {
      return null;
    }
    const { budgeted } = expenses.reduce(
      (acc, ex) => {
        const { budget, adjustedTotal } = doMaths(acc.total, ex.target / 2);

        acc.budgeted.push({ ...ex, budget });
        acc.total = adjustedTotal;

        return acc;
      },
      { total: safeToSpend, budgeted: [] }
    );

    setFinances({
      expenses: budgeted,
      goals,
      balances,
    });

    return budgeted.map(renderExpenseRow);
  }

  function renderExpenseRow(expense) {
    if (!expense) {
      return;
    }

    return (
      <tr id={expense.id}>
        <td>{expense.name}</td>
        <td>{formatAmount(expense.current)}</td>
        <td>{formatAmount(expense.target)}</td>
        <td>{formatAmount(expense.budget)}</td>
      </tr>
    );
  }

  function renderDoIt() {
    async function budget() {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        if (chrome.runtime.lastError) {
          console.error('LAST ERROR', chrome.runtime.lastError);
          return;
        }

        const [available] = tabs;

        const { id: currentTab } = available;
        chrome.tabs.sendMessage(currentTab, { type: 'transfer', expenses, accountId, userId });

        // expenses.forEach((expense) => {
        //   chrome.tabs.sendMessage(currentTab, { type: 'transfer', expense, accountId, userId });
        // });
      });
    }

    return <button onClick={budget}>Do it</button>;
  }

  function renderBalances() {
    if (!balances) {
      return null;
    }

    return (
      <>
        Safe to Spend: ${balances.safe_to_spend / 10000}
        <table>
          <tr>
            <th>Name</th>
            <th>Current</th>
            <th>Target</th>
            <th>Budget</th>
          </tr>
          {expenses && expenses.map(renderExpenseRow)}
          {expenses && renderDoIt()}
        </table>
      </>
    );
  }

  return (
    <>
      sup
      {renderBalances()}
    </>
  );
}

export default Overview;
