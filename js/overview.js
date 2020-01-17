(function() {
  function getAccounts(accountNo) {
    return axios.get(`https://bank.simple.com/customer-api/v1/customers/${accountNo}/accounts`, {
      params: { includeSubAccounts: true },
      withCredentials: true,
      contentType: 'application/json',
    });
  }

  function log(level, message) {
    chrome.runtime.sendMessage({ type: 'log', level, message });
  }

  chrome.runtime.sendMessage({ type: 'request', what: ['subAccountId', 'userId', 'sheetId'] }, async (response = {}) => {
    const options = { withCredentials: true, contentType: 'application/json' };
    let { subAccountId, userId, sheetId } = response;

    if (!userId) {
      userId = $('body').attr('data-uuid');

      chrome.runtime.sendMessage({ type: 'store', what: 'userId', value: userId });
    }

    if (!subAccountId) {
      log('info', 'Fetching subAccount Information');
      try {
        const userId = $('body').attr('data-uuid');

        const { data } = await getAccounts(userId);

        if (!Array.isArray(data)) {
          log('error', 'Did not get an array response');
          return;
        }
        const theAccount = data.find((a) => a.customerAccountType === 'SHARED');

        if (!theAccount) {
          log('error', 'Could not find the shared account');
          return;
        }

        subAccountId = theAccount.accountReference;

        chrome.runtime.sendMessage({ type: 'store', what: 'subAccountId', value: subAccountId });
      } catch (error) {
        log('error', error.message);
      }
    }

    const baseUrl = `https://bank.simple.com/goals-api/users/${userId}/accounts/${subAccountId}`;

    const { data: expenses } = await axios.get(`${baseUrl}/expenses/summary`, options);

    chrome.runtime.sendMessage({ type: 'expenses', data: expenses });

    const { data: goals } = await axios.get(`${baseUrl}/goals/summary`, options);

    chrome.runtime.sendMessage({ type: 'goals', data: goals });
  });
})();
