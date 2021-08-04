function getFreq(term) {
  if (/every other month/i.test(term)) {
    return { term: 'Bi-Monthly', toMonthly: (amnt) => amnt / 2 };
  }

  if (/every month/i.test(term)) {
    return { term: 'Monthly', toMonthly: (amnt) => amnt };
  }

  if (/every other week/i.test(term)) {
    return { term: 'Bi-Weekly', toMonthly: (amnt) => (amnt * 26) / 12 };
  }

  if (/every week/i.test(term)) {
    return { term: 'Weekly', toMonthly: (amnt) => (amnt * 52) / 12 };
  }

  if (/every year/i.test(term)) {
    return { term: 'Yearly', toMonthly: (amnt) => amnt / 12 };
  }

  if (/every three months/i.test(term)) {
    return { term: 'Quarterly', toMonthly: (amnt) => amnt / 3 };
  }

  if (/every six months/i.test(term)) {
    return { term: 'Half Year', toMonthly: (amnt) => amnt / 6 };
  }

  console.log('UNKNOWN', term);

  return { term: 'Unknown', toMonthly: () => 0 };
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

exports.mapExpense = (exp) => {
  const { toMonthly } = getFreq(exp.recurrence.description);

  return {
    id: exp.id,
    name: exp.name,
    current: exp.contributed_amount,
    target: toMonthly(exp.target_amount),
  };
};
