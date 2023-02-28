document.addEventListener('DOMContentLoaded', (event) => {
  setTheme();

  checkStorage();

  // Collections
  const form = document.getElementById('app-form');
  const simpleInputs = document.querySelectorAll('.simple');
  const additionInputs = document.querySelectorAll('.addition');
  const contentEditable = document.querySelectorAll('[contenteditable]');
  const characSelects = document.querySelectorAll('.charac-select');
  const bonuses = document.querySelectorAll('output.bonus');
  const customData = document.querySelectorAll('.custom');
  const toggleHardy = document.getElementById('hardy-bonus');
  const speciesSelect = document.getElementById('species');
  const encumbranceSrc = document.querySelectorAll('.encumbrance-src');
  const encumbranceMax = document.getElementById('encumbrance-max')
  const highlights = document.querySelectorAll('.highlight-toggle')
  const settingsTheme = document.getElementById('theme')
  const exportButton = document.getElementById('export-button');
  const importButton = document.getElementById('import-button');

  // Event Listeners
  simpleInputs.forEach(input => {
    input.addEventListener('change', handleSimpleInput);
    input.addEventListener('input', handleSimpleInput);
  });
  additionInputs.forEach(input => {
    input.addEventListener('input', handleAdditionInput);
  });
  contentEditable.forEach(input => {
    input.addEventListener('input', handleContentEditable);
  });
  characSelects.forEach(select => {
    select.addEventListener('change', handleCharacSelect);
  });
  customData.forEach(custom => {
    custom.addEventListener('input', handleCustomInput);
  });
  toggleHardy.addEventListener('change', handleWoundsUpdate);
  speciesSelect.addEventListener('change', handleWoundsUpdate);
  encumbranceSrc.forEach(item => {
    item.addEventListener('input', handleEncumbrance);
    item.addEventListener('change', handleEncumbrance);
  });
  encumbranceMax.addEventListener('input', updateTotalEncumbrance);
  highlights.forEach(item => {
    item.addEventListener('input', toggleHighlight);
  });
  settingsTheme.addEventListener('change', setTheme);
  exportButton.addEventListener('click', exportData);
  importButton.addEventListener('click', importData);

  // Fill the sheet with stored data
  fillFromStorage();

  // Modal
  const modal = document.getElementById('modal');
  const pages = document.querySelectorAll('.page');
  const openModalButton = document.getElementById('open-modal');
  const closeModalButton = document.getElementById('close-modal');

  openModalButton.addEventListener('click', openModal);
  closeModalButton.addEventListener('click', closeModal);

  function openModal() {
    pages.forEach(page => {page.setAttribute('inert', true)});
    openModalButton.setAttribute('inert', true);
    modal.classList.add('open');
    closeModalButton.focus();
  }
  function closeModal() {
    pages.forEach(page => {page.removeAttribute('inert')});
    openModalButton.removeAttribute('inert');
    modal.classList.remove('open');
  }

  // Methods
  // --------------------
  // Check for persistent storage
  async function checkStorage() {
    if (navigator.storage && navigator.storage.persist) {
      const isPersisted = await navigator.storage.persisted();

      if (!isPersisted) {
        const persistGranted = await navigator.storage.persist();
        console.log(`Persisted storage granted: ${persistGranted}`);
      }
    }
  }

  // Fill inputs from locaStorage data
  async function fillFromStorage() {
    if (navigator.storage) {
      // Generate custom data rows if data available
      const custom = document.querySelectorAll('.custom');

      custom.forEach(custom => {
        const tbody = custom.querySelector('tbody');
        const type = custom.id;
        let i = 0;
        while (localStorage.getItem(`${type}-name-${i}`)) {
          addNewRow(tbody, i+1);
          i++
        }
      })

      // Fill every inputs in the page
      const inputs = document.querySelectorAll('.page input, .page select, #theme input');
      await inputs.forEach(input => {
        const item = localStorage.getItem(input.name);

        if (input.type === 'radio') {
          if (input.value === item) {
            input.checked = true;
          };
        } else if (input.type === 'checkbox' && (item === "true" || item === "on") ) {
          input.checked = true;
        } else {
          input.value = item ?? null;
        }

        // Other context adjustments
        if (item && input.type === 'hidden') {
          input.previousElementSibling.textContent = item;
        }
        if (item && input.tagName === 'SELECT') {
          input.dispatchEvent(new Event('change', { 'bubbles': true }));
        }
      });

      // Once all data is filled, proceed with updating outputs
      updateBonuses();
      encumbranceSrc.forEach(src => {
        src.dispatchEvent(new Event('change', {'bubbles': true}));
      });
      updateOutputs();

      updateTitle();

      highlights.forEach(item => {
        item.dispatchEvent(new Event('input', {'bubbles': true}));
      });
    }
  }

  // Sets the theme
  function setTheme(event) {
    const stored = localStorage.getItem('color-scheme') ?? '';
    const value = event !== undefined ? event.target.value : stored;
    if (value === 'light') {
      document.body.classList.add('light');
      document.body.classList.remove('dark');
    } else if (value === 'dark') {
      document.body.classList.add('dark');
      document.body.classList.remove('light');
    } else {
      document.body.classList.remove('light');
      document.body.classList.remove('dark');
    }
  }

  // Store data from simple inputs
  function handleSimpleInput(event) {
    if (event.target.type === "checkbox") {
      localStorage.setItem(event.target.name, event.target.checked);
    } else {
      localStorage.setItem(event.target.name, event.target.value);
    }
  }

  // Store data from addition inputs and update related outputs
  function handleAdditionInput(event) {
    handleSimpleInput(event);
    if(event.target.hasAttribute('contenteditable')) {
      return;
    }
    const outputs = document.querySelectorAll(`output[for~=${event.target.id}]:not(.bonus)`);
    updateOutputs(outputs);
    updateBonuses();
  }

  // Duplicate data from contenteditable elements to hidden inputs and store them
  function handleContentEditable(event) {
    const input = event.target.nextElementSibling;
    input.value = event.target.textContent;
    localStorage.setItem(input.name, input.value);
  }

  // Store custom skill base characteristic and update related output
  function handleCharacSelect(event) {
    const outputs = event.target.closest('tr').querySelectorAll('output');
    if (!event.target.value) {
      outputs.forEach(output => (output.value = ''));
      return;
    }
    handleSimpleInput(event);
    outputs[0].setAttribute('for', `${event.target.value}-i ${event.target.value}-a`);
    updateOutputs(outputs);
  }

  // Store custom data and add new blank row
  function handleCustomInput(event) {
    const tbody = event.target.closest('tbody');
    const totalRows = tbody.children;
    const currentRow = event.target.closest('tr');

    // If current inputted row is the last row then create a new row.
    if (currentRow === totalRows[totalRows.length - 1]) {
      addNewRow(tbody, totalRows.length);
    }
  }

  // Add wounds points if hardy talent is ON or if species is hafling
  function handleWoundsUpdate() {
    const wounds = document.querySelectorAll('.wounds output');
    updateOutputs(wounds);
  }

  // Calculate stuff encumbrance
  function handleEncumbrance(event) {
    const type = event.target.tagName === 'FIELDSET'
      ? event.target
      : event.target.closest('fieldset');
    const weights = type.querySelectorAll(`tbody [id^=${type.id}-encumbrance-]`);
    const output = type.querySelector(`#encumbrance-${type.id}-total`);

    let total = 0;
    for (let i = 0; i < weights.length - 1; i++) {
      let value = Number(weights[i].value);
      const worn = type.querySelector(`#${type.id}-worn-${i}`).checked;

      if (worn === true) {
        value = Math.max(0, value - 1);
      }

      total += value;
    }

    output.value = total;

    updateOutputs()
    updateTotalEncumbrance();
  }

  // Calculate if total encumbrance is above max encumbrance
  function updateTotalEncumbrance() {
    const armour = Number(document.getElementById('encumbrance-armour-total').value);
    const trappings = Number(document.getElementById('encumbrance-trappings-total').value);
    const weapons = Number(document.getElementById('encumbrance-weapons-total').value);
    const max = Number(document.getElementById('encumbrance-max').value);
    const total = document.getElementById('encumbrance-total');
    const msgs = document.querySelectorAll('.encumbrance-state-penalty');

    total.value = armour + trappings + weapons;

    let messageType = 0;
    if (Number(total.value) <= max) {
      total.classList.remove('error');
    } else if (Number(total.value) <= max * 2) {
      total.classList.add('error');
      messageType = 1;
    } else if (Number(total.value) <= max * 3) {
      total.classList.add('error');
      messageType = 2;
    } else if (Number(total.value) > max * 3) {
      total.classList.add('error');
      messageType = 3;
    }

    msgs.forEach((msg, index) => {
      if(messageType === index) {
        msg.removeAttribute('hidden');
      } else {
        msg.setAttribute('hidden', 'true');
      }
    })
  }

  // Add new blank talent row
  function addNewRow(parent, n) {
    const type = parent.closest('fieldset').id;
    const template = document.getElementById(`${type}-row`);
    const clone = template.content.cloneNode(true);

    const inputs = clone.querySelectorAll('input, output');
    const selects = clone.querySelectorAll('select');
    const contentEditable = clone.querySelectorAll('[contentEditable]');
    const labels = clone.querySelectorAll('label');
    const highlights = clone.querySelectorAll('.highlight-toggle');

    inputs.forEach(input => {
      input.name = input.name + n;
      input.id = input.id + n;
      if (input.tagName === 'OUTPUT' && input.id === `${type}-current-${n}`) {
        input.htmlFor = `${type}-initial-${n} ${type}-aug-${n}`;
      }
    });

    selects.forEach(input => {
      input.name = input.name + n;
      input.id = input.id + n;
    });

    labels.forEach(label => {
      label.htmlFor = label.htmlFor + n;
    });

    inputs.forEach(input => {
      input.addEventListener('input', handleSimpleInput);
    });
    selects.forEach(select => {
      select.addEventListener('change', handleCharacSelect);
    });
    contentEditable.forEach(content => {
      content.addEventListener('input', handleContentEditable);
    });
    highlights.forEach(item => {
      item.addEventListener('input', toggleHighlight);
    });

    parent.appendChild(clone);
  }

  // Generate bonuses from final characteristics
  function updateBonuses() {
    bonuses.forEach(bonus => {
      const inputs = bonus.getAttribute('for').split(' ');
      let current = 0;
      for (let i = 0; i < inputs.length; i++) {
        const input = document.getElementById(`${inputs[i]}`);
        const value = input.value !== '' ? parseInt(input.value,10) : 0;
        current += value;
      }
      bonus.value = current.toString()[0];
    });

    const outputs = document.querySelectorAll('[for^="bonus-"]');
    updateOutputs(outputs);
  }

  // Update outputs from related inputs value
  function updateOutputs(outputs) {
    if (outputs === undefined) {
      outputs = document.querySelectorAll('output:not(.bonus, .hidden, .encumbrance-total)');
    }
    outputs.forEach(output => {
      let current = 0;
      const inputs = output.getAttribute('for').split(' ');
      if (inputs[0] === '') {
        return;
      }

      for (let i = 0; i < inputs.length; i++) {
        const input = document.getElementById(`${inputs[i]}`);
        const value = input.value !== '' ? parseInt(input.value,10) : 0;

        if (output.id === 'walk') {
          current = value * 2;
        } else if (output.id === 'run') {
          current = value * 4;
        } else {
          current += value;
        }
      }

      const species = document.getElementById('species');

      if (output.id === 'strength-bonus') {
        output.value = species.value !== 'halfling' ? current : 0;
      } else if (output.id === 'toughness-bonus') {
        output.value = current * 2;
      } else if (output.id === 'wounds') {
        if (toggleHardy.checked) {
          const toughness = document.getElementById('bonus-t');
          const value = toughness.value !== '' ? parseInt(toughness.value,10) : 0;
          output.value = current + value;
        } else if (species.value === 'halfling') {
          const strength = document.getElementById('bonus-s');
          const value = strength.value !== '' ? parseInt(strength.value,10) : 0;
          output.value = current - value;
        } else {
          output.value = current;
        }
      } else {
        output.value = current;
      }
    });
  }

  function updateTitle() {
    if (localStorage.getItem('name')) {
      const base = document.title;
      const name = localStorage.getItem('name');
      document.title = `${name} - ${base}`;
    }
  }

  function toggleHighlight(event) {
    const parent = event.target.closest('tr');
    const value = event.target.checked;

    if(value === true) {
      parent.classList.add('highlighted');
    } else {
      parent.classList.remove('highlighted');
    }
  }

  function exportData() {
    const formData = new FormData(form)
    const json = Object.fromEntries(formData);
    const jsonString = JSON.stringify(json);
    const today = new Date();
    const date = `${today.getFullYear()}-${today.getMonth()+1}-${today.getDate()}`;
    const name = json.name.split(' ').join('_');
    const link = document.createElement("a");

    link.href = URL.createObjectURL(
      new Blob([jsonString], {type:"application/json"})
    );
    link.download = `${name}_${date}_backup.json`;
    link.click();
  }

  async function importData() {
    const fileInput = document.getElementById('import-db');
    const msgs = document.querySelectorAll('.error, .success');
    const errorMessage = document.getElementById('import-db-error');
    const errorMessageEmpty = document.getElementById('import-db-error-empty');
    const errorMessageFile = document.getElementById('import-db-error-file');
    const successMessage = document.getElementById('import-db-success');
    const selectedFile = fileInput.files[0] ?? undefined;

    // Reset current message displayed
    msgs.forEach(msg => msg.setAttribute('hidden', 'true'));

    if (!selectedFile) {
      errorMessageEmpty.removeAttribute('hidden');
    } else if (selectedFile.type !== "application/json") {
      fileInput.value = '';
      errorMessageFile.removeAttribute('hidden');
    } else {
      const raw = await selectedFile.text();
      try {
        data = JSON.parse(raw);
      } catch(e) {
        console.error(e);
        errorMessage.removeAttribute('hidden');
      }
      for (const key in data) {
        localStorage.setItem(key, data[key]);
      }
      fillFromStorage();
      setTheme();
      successMessage.removeAttribute('hidden');
    }
  }
});
