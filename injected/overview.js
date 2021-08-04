const runtime = require('./chrome/runtime');
const simple = require('./simple');
const logger = require('./logger');

async function getSharedAccountId(userId) {
  console.log('Grabbing shared account');
  const accounts = await simple.getAccounts(userId);

  const shared = accounts.find((a) => a.customerAccountType === 'SHARED');

  if (!shared) {
    logger.error('Could not find the shared account');
    return;
  }

  const accountId = shared.accountReference;

  await runtime.store('accountId', accountId);
  console.log('AccountId set', accountId);

  return accountId;
}

async function getUserId() {
  console.log('Grabbing user id');
  const userId = document.getElementsByTagName('Body')[0].getAttribute('data-uuid');

  await runtime.store('userId', userId);
  console.log('UserId set', userId);

  return userId;
}

function getCSRF() {
  const csrf = document.getElementsByTagName('Body')[0].getAttribute('data-csrf');

  // await runtime.store('csrf', csrf);
  console.log(csrf);

  return csrf;
}

async function process(request = {}, sendResponse) {
  try {
    let { what, accountId, userId } = request;

    console.log(what, accountId, userId);

    if (!userId) {
      userId = await getUserId();
    }

    if (!accountId) {
      accountId = await getSharedAccountId();
    }

    const client = simple.createAccountClient(userId, accountId);
    const map = {
      expenses: client.getExpenseSummary,
      goals: client.getGoalSummary,
      balances: client.getBalances,
    };

    const results = await Promise.all(
      what
        .map(async ({ type }) => {
          const get = map[type];

          if (!get) {
            console.log('requesting for something not mapped', type);
            return;
          }

          const result = await get();

          return { [type]: result };
        })
        .filter(Boolean)
    );

    const response = results.reduce((acc, item) => {
      acc = { ...acc, ...item };

      return acc;
    }, {});

    console.log('Sending response', response);

    sendResponse(response);
  } catch (error) {
    console.error('OVERVIEW', error);
  }
}

async function transfer(expenses, userId, accountId) {
  const client = simple.createAccountClient(userId, accountId, getCSRF());

  for (const expense of expenses) {
    try {
      console.log('TRANSFERING', expense);
      await client.transfer(expense.id, expense.budget);
      console.log('SUCCESS', expense.id, expense.budget);
    } catch (error) {
      console.error(expense.id, 'FAILED', error);
    }
  }
}

chrome.storage.local.get(['accountId', 'userId'], (local) => {
  chrome.storage.sync.get(['accountId', 'userId'], (sync) => {
    const result = { ...local, ...sync };
    console.log('Stored', result);
    if (!result.userId) {
      result.userId = getUserId();
    }
    if (!result.accountId) {
      getSharedAccountId(result.userId);
    }
  });
});

chrome.runtime.onMessage.addListener((request = {}, sender, sendResponse) => {
  console.log('Received Message', request);
  if (chrome.runtime.lastError) {
    console.error('LAST ERROR', chrome.runtime.lastError);
    return;
  }

  if (request.type === 'fetch') {
    console.log('Fetching data', request);
    process(request, sendResponse);
    return true;
  }

  if (request.type === 'transfer') {
    transfer(request.expenses, request.userId, request.accountId);
  }
});
