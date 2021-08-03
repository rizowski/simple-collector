const axios = require('axios');
const runtime = require('../chrome/runtime');
const options = { withCredentials: true, contentType: 'application/json' };

exports.getAccounts = async (userId) => {
  if (!userId) {
    throw new Error('No userId specified');
  }

  const { data } = await axios.get(`https://bank.simple.com/customer-api/v1/customers/${userId}/accounts`, {
    params: { includeSubAccounts: true },
    ...options,
  });

  return data;
};

exports.createAccountClient = (userId, accountNo, csrf) => {
  if (!userId) {
    throw new Error('UserId is not defined');
  }

  if (!accountNo) {
    throw new Error('AccountNumber is not defined');
  }

  const goalsApi = `https://bank.simple.com/goals-api/users/${userId}/accounts/${accountNo}`;
  const trxApi = `https://bank.simple.com/txs-api/users/${userId}/accounts/${accountNo}`;

  return {
    async getExpenseSummary() {
      const { data } = await axios.get(`${goalsApi}/expenses/summary`, options);

      runtime.upload('expenses', data);

      return data;
    },
    async getGoalSummary() {
      const { data } = await axios.get(`${goalsApi}/goals/summary`, options);

      runtime.upload('goals', data);

      return data;
    },
    async getBalances() {
      const { data } = await axios.get(`${trxApi}/balances`);

      return data;
    },
    async transfer(id, amount) {
      /**
       * POST https://bank.simple.com/goals-api/users/${USERID}/accounts/${SHARED_ACCOUNT_ID}/transfers
       * {
       *   amount: 1000,
       *   to: {
       *     period: 'CURRENT',
       *     reference: <TransactionID>
       *   }
       * }
       */
      const { statusCode, data } = await axios.post(
        `${goalsApi}/transfers`,
        {
          amount,
          to: {
            period: 'CURRENT',
            reference: id,
          },
        },
        {
          ...options,
          headers: {
            referer: `https://bank.simple.com/expenses/${id}/current/transfer`,
            'x-csrf-token': csrf,
          },
        }
      );

      console.log(statusCode, data);

      return data;
    },
  };
};
