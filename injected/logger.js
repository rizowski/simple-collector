const runtime = require('./chrome/runtime');

exports.error = (message) => {
  runtime.sendMessage({ type: 'log', level: 'error', message });
};

exports.info = (message) => {
  runtime.sendMessage({ type: 'log', level: 'info', message });
};
