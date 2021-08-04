function getFreq(term) {
  if (/every other month/i.test(term)) {
    return 'Bi-Monthly';
  }

  if (/every month/i.test(term)) {
    return 'Monthly';
  }

  if (/every other week/i.test(term)) {
    return 'Bi-Weekly';
  }

  if (/every week/i.test(term)) {
    return 'Weekly';
  }

  if (/every year/i.test(term)) {
    return 'Yearly';
  }

  if (/every three months/i.test(term)) {
    return 'Quarterly';
  }

  if (/every six months/i.test(term)) {
    return 'Half Year';
  }

  console.log('UNKNOWN', term);

  return 'Unknown';
}

function getPaused(item) {
  if (item.paused === true) {
    return true;
  }

  if (!item.contributionFrequency) {
    return true;
  }

  return false;
}

function formatAmount(amount) {
  return amount / 10000;
}

function contributionFrequency(i) {
  if (!i.contributionFrequency) {
    return {
      ppp: 0,
      frequency: 'None',
      contributed: 0,
      toBeContributed: 0,
    };
  }

  return {
    ppp: formatAmount(i.contributionFrequency.amountPerFrequency),
    frequency: i.contributionFrequency.name,
    contributed: i.contributionFrequency.numExpectedContributionsSoFar,
    toBeContributed: i.contributionFrequency.numExpectedTotalContributions,
  };
}

function expectedMonthlyPayment(freq, target) {
  const map = {
    Yearly: (amnt) => amnt / 12,
    Monthly: (amnt) => amnt,
    Quarterly: (amnt) => amnt / 3,
    Weekly: (amnt) => (amnt * 52) / 12,
    'Bi-Weekly': (amnt) => (amnt * 26) / 12,
    'Bi-Monthly': (amnt) => amnt / 2,
    'Half Year': (amnt) => amnt / 6,
  };

  const zero = () => 0;

  const calc = map[freq] || zero;

  return formatAmount(calc(target));
}

function formatExpense(data) {
  return data.items.reduce(
    (arr, i) => {
      const [year, month, day] = i.lastAutomatedContribution || [];
      const lastContribution = year ? `${year}-${month}-${day}` : '';
      const { ppp, frequency, contributed, toBeContributed } = contributionFrequency(i);
      const term = getFreq(i.recurrence.description);

      arr.push([
        i.id,
        i.name,
        formatAmount(i.contributed_amount),
        formatAmount(i.target_amount),
        ppp,
        contributed,
        toBeContributed,
        getPaused(i),
        frequency,
        term,
        lastContribution,
        i.recurrence.nextOccurrenceDate,
        i.amounts.onTrack,
        expectedMonthlyPayment(term, i.target_amount),
      ]);

      return arr;
    },
    [
      [
        'Id',
        'Name',
        'Current',
        'Target',
        'PPPP',
        'Contribution',
        'To Be Contributed',
        'Paused',
        'Frequency',
        'Occurrence',
        'Last',
        'Next',
        'On Track',
        'Monthly',
      ],
    ]
  );
}

function formatSummary(data) {
  return data.fundingSchedules.reduce(
    (arr, fs) => {
      arr.push([fs.name, fs.nextContributionDate, formatAmount(fs.expectedContributionAmount)]);
      return arr;
    },
    [['Name', 'Next', 'Expected']]
  );
}

function formatGoals(data) {
  return data.items.reduce(
    (arr, g) => {
      arr.push([g.id, g.name, formatAmount(g.balanceAvailableForSpending), formatAmount(g.target_amount), '', g.description, g.paused, g.amounts.onTrack]);

      return arr;
    },
    [['Id', 'Name', 'Amount', 'Target', 'PPPP', 'Description', 'Paused', 'On Track']]
  );
}

function createClient(sheetId) {
  let count = 0;
  return {
    updateSheet: function updateSheet(sheetName, data, interactive) {
      return new Promise((resolve, reject) => {
        chrome.identity.getAuthToken({ interactive: interactive }, (token) => {
          return axios
            .put(
              `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${sheetName}`,
              { values: data },
              {
                params: { valueInputOption: 'RAW' },
                headers: { authorization: `Bearer ${token}` },
              }
            )
            .then(({ data }) => {
              console.log('Success', data.updatedRange);
              resolve();
            })
            .catch((err) => {
              console.error(err.response.data);
              if (count > 3) {
                return reject();
              }
              if (err.response.status === 401) {
                count++;
                console.log(`Retrying with new authToken Attempt: ${count}`);
                return updateSheet(sheetName, data, true);
              }
              reject();
            });
        });
      });
    },
  };
}

async function setupListeners(msg, respond, client) {
  try {
    if (msg.type === 'log') {
      console[msg.level](msg.message);
      return;
    }

    if (msg.type === 'settings.update') {
      chrome.storage.sync.set({ sheetId: msg.value });
      client = createClient(msg.value, token);
      return;
    }

    if (msg.type === 'request') {
      console.log('Fetching for Injected', msg.what);
      chrome.storage.local.get(msg.what, (local) => {
        chrome.storage.sync.get(msg.what, (sync) => {
          const result = { ...local, ...sync };
          console.log('Responding to Injected', result);
          respond(result);
        });
      });

      return;
    }

    if (msg.type === 'store') {
      console.log('Storing', msg.what);
      if (!msg.value) {
        console.warn('trying to store an Empty value');
        return;
      }
      chrome.storage.local.set({ [msg.what]: msg.value });
      return;
    }

    if (msg.type === 'upload') {
      console.log('uploading', msg.what);

      if (msg.what === 'expenses') {
        await client.updateSheet('import-expenses', formatExpense(msg.value));
        return;
      }

      if (msg.what === 'goals') {
        console.log('goals received');
        await client.updateSheet('import-goals', formatGoals(msg.value));
      }
    }
  } catch (error) {
    console.error('Broekn Error', error);
  }
}

chrome.storage.sync.get('sheetId', (settings = {}) => {
  if (!settings.sheetId) {
    throw new Error('No sheet to save to. Open settings to set a sheetId');
  }

  let client = createClient(settings.sheetId);

  chrome.runtime.onMessage.addListener((msg, sender, respond) => {
    console.log(msg);

    setupListeners(msg, respond, client);

    if (['request'].includes(msg.type)) {
      return true;
    }
  });
});
