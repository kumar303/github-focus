const getOption = () => document.querySelector('.optionValue');

async function populateFormWithStoredData() {
  const restoredSettings = await browser.storage.local.get();
  getOption().value = restoredSettings.option || '';
}

populateFormWithStoredData();

document.querySelector('.saveButton').addEventListener('click', () => {
  const infoContainer = document.querySelector('.info span');
  infoContainer.innerHTML = '';

  const option = getOption().value.trim();

  let error;
  // Validation would go here.
  // error = 'some message';
  if (error) {
    infoContainer.innerHTML = `<span class="error">${error}</span>`;
  } else {
    infoContainer.innerHTML = 'Preferences saved';
    browser.storage.local.set({ option });
  }

});
