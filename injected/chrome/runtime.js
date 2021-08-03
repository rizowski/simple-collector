exports.sendMessage = (options) => {
  return new Promise((resolve, reject) => {
    console.log('Sending message to Runtime', options);
    chrome.runtime.sendMessage(options, (response = {}) => {
      const error = chrome.runtime.lastError;

      if (!response && error) {
        console.error('AN ERROR', error);
        return reject(error);
      }

      console.log('Message received from Runtime', options, response);
      resolve(response);
    });
  });
};

exports.request = (what) => {
  return exports.sendMessage({
    type: 'request',
    what,
  });
};

exports.store = (what, value) => {
  return exports.sendMessage({
    type: 'store',
    what,
    value,
  });
};

exports.upload = (what, value) => {
  return exports.sendMessage({
    type: 'upload',
    what,
    value,
  });
};
