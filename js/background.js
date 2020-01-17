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

function formatExpense(data) {
  return data.items.reduce(
    (arr, i) => {
      const [year, month, day] = i.lastAutomatedContribution || [];
      const lastContribution = year ? `${year}-${month}-${day}` : '';
      const ppp = (i.contributionFrequency && formatAmount(i.contributionFrequency.amountPerFrequency)) || 0;
      arr.push([
        i.id,
        i.name,
        i.purpose,
        formatAmount(i.contributed_amount),
        formatAmount(i.target_amount),
        ppp,
        i.description,
        getPaused(i),
        (i.contributionFrequency && i.contributionFrequency.name) || '-',
        getFreq(i.recurrence.description),
        lastContribution,
        i.recurrence.nextOccurrenceDate,
        i.amounts.onTrack,
        ppp * 2,
      ]);

      return arr;
    },
    [['Id', 'Name', 'Type', 'Current Amount', 'Target', 'PPPP', 'Description', 'Paused', 'Frequency', 'Occurrence', 'Last', 'Next', 'On Track', 'Monthly']]
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

chrome.storage.sync.get('sheetId', (settings = {}) => {
  if (!settings.sheetId) {
    throw new Error('No sheet to save to. Open settings to set a sheetId');
  }

  let client = createClient(settings.sheetId);

  chrome.runtime.onMessage.addListener(async (msg, sender, respond) => {
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
        console.log('Fetching', msg.what);
        chrome.storage.local.get(msg.what, (local) => {
          chrome.storage.sync.get(msg.what, (sync) => {
            respond({ ...local, ...sync });
          });
        });

        return true;
      }

      if (msg.type === 'store') {
        console.log('Storing', msg.what);
        chrome.storage.local.set({ [msg.what]: msg.value });
        return;
      }

      if (msg.type === 'expenses') {
        console.log('expenses received');
        await client.updateSheet('import-expenses', formatExpense(msg.data));
        await client.updateSheet('import-summary', formatSummary(msg.data));
        return;
      }

      if (msg.type === 'goals') {
        console.log('goals received');
        await client.updateSheet('import-goals', formatGoals(msg.data));
        return;
      }
    } catch (error) {
      console.error('Broekn Error', error);
    }
  });
});
