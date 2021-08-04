import React, { useEffect, useState } from 'react';

function Options() {
  const [sheetId, setSheetId] = useState();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.sync.get(['sheetId'], function (settings) {
      setSheetId(settings.sheetId);
    });
  });

  function onChange(event) {
    setSaved(false);
    setSheetId(event.target.value);

    chrome.storage.sync.set({ sheetId: event.target.value });
    setSaved(true);
  }

  return (
    <div>
      <label for="sheetId">Google Docs Sheet Id: </label>
      <input type="input" name="sheetId" onChange={onChange} value={sheetId}></input>
      {saved ? ' SAVED!' : ''}
    </div>
  );
}

export default Options;
