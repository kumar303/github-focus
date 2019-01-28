const getOption = () => document.querySelector('.optionValue');

async function populateFormWithStoredData() {
  const restoredSettings = await browser.storage.local.get();
  getOption().value = restoredSettings.option || '';
}

populateFormWithStoredData();

document.querySelector('.saveButton').addEventListener('click', async () => {
  const infoContainer = document.querySelector('.info span');
  infoContainer.innerHTML = '';

  const option = getOption().value.trim();

  let error;
  try {
    await browser.storage.local.set({ option });
  } catch (storageError) {
    error = `Storage error: ${storageError}`;
  }
  if (error) {
    infoContainer.innerHTML = `<span class="error">${error}</span>`;
  } else {
    infoContainer.innerHTML = 'Preferences saved';
  }

});
