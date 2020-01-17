(() => {
  chrome.storage.sync.get(['sheetId'], function(settings) {
    $(document).ready(() => {
      const sheetInput = $('#sheetId');

      if (settings.sheetId) {
        sheetInput.val(settings.sheetId);
      }

      sheetInput.on('change', () => {
        const token = sheetInput.val();
        chrome.storage.sync.set({ sheetId: token });
        chrome.runtime.sendMessage({ type: 'settings.update', value: token });
        $('#status').html('Saved!<br/>');
      });
    });
  });
})();
