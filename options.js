var $tableBody = document.getElementById('ChannelsBody');

/**
 * input - Creates a text input node
 *
 * @param  {string} value The value of the created input node
 * @param  {string} placeholder The placeholder of the created input node
 * @param  {string} className The class name of the created input node
 * @returns {Element} The created input node
 */
function input(value, placeholder, className) {
  let $input = document.createElement('input');
  $input.value = value;
  $input.setAttribute('placeholder', placeholder);
  $input.setAttribute('type', 'text');
  $input.classList.add(className);

  return $input;
}

/**
 * button - Creates a button
 *
 * @param  {string} text The button text
 * @param  {function} onClick A function to handle a click event on the button
 * @returns {Element} The created button
 */
function button(text, onClick) {
  let $button = document.createElement('button');
  $button.appendChild(textNode(text));
  $button.onclick = onClick;
  return $button;
}

/**
 * textNode - Creates a text node
 *
 * @param  {string} text The text of the node
 * @returns {Element} The text node
 */
function textNode(text) {
  return document.createTextNode(text);
}

/**
 * td - Creates a TD element
 *
 * @param  {Element} child The child element to append into the TD
 * @returns {Element} The created TD
 */
function td(child) {
  let $td = document.createElement('td');

  $td.appendChild(child);

  return $td;
}

/**
 * Event handler for deleting a row
 *
 * @param  {Event} event The event that triggered the save
 * @returns {undefined}
 */
function deleteRow(event) {
  event.preventDefault();

  let $row = event.target.parentNode.parentNode;
  let id = $row.dataset.id;

  chrome.storage.local.get('BlockItems', (s) => {
    let existingItems = s.BlockItems || [];
    let index = existingItems.findIndex((item) => item.id == id);
    existingItems.splice(index, 1);

    chrome.storage.local.set({ BlockItems: existingItems }, () => {
      $row.remove();
    });
  });
}

/**
 * Returns a new unique Id
 *
 * @param  {Array<BlockItem>} existingItems The existing block items
 * @returns {Number} A new unique numeric ID
 */
function newId(existingItems) {
  return existingItems.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
}

/**
 * Event handler for saving a new block item.
 *
 * @param  {Event} event The event that triggered the save
 * @returns {undefined}
 */
function saveNewBlockItem(event) {
  event.preventDefault();

  let $newChannelName = document.getElementById('NewChannelName');
  let $newChannelId = document.getElementById('NewChannelId');
  let $newReason = document.getElementById('NewReason');

  let blockItem = {
    channelName: $newChannelName.value,
    channelId: $newChannelId.value,
    reason: $newReason.value
  };

  // TODO: maybe split this out into a separate function
  chrome.storage.local.get('BlockItems', (s) => {
    let existingItems = s.BlockItems || [];
    blockItem.id = newId(existingItems);
    existingItems.push(blockItem);

    chrome.storage.local.set({ BlockItems: existingItems }, () => {
      $tableBody.appendChild(tableRow(blockItem));
      $newChannelName.value = '';
      $newChannelId.value = '';
      $newReason.value = '';
    });
  });
}

/**
 * createEditRow - Creates an edit row for a given block item
 *
 * @param  {BlockItem} blockItem The block item to base the row off of
 * @returns {Element} The created edit row with details filled in
 */
function createEditRow(blockItem) {
  let $row = document.createElement('tr');
  $row.dataset.id = blockItem.id;

  $row.appendChild(td(input(blockItem.channelName, 'Channel Name', 'channel-name')));
  $row.appendChild(td(input(blockItem.channelId, 'Channel ID', 'channel-id')));
  $row.appendChild(td(input(blockItem.reason, 'Reason', 'reason')));
  $row.appendChild(td(button('Save', commitUpdate)));

  return $row;
}

/**
 * commitUpdate - Handle an event to commit a block item's updates
 *
 * @param  {Event} event The event that triggered the update
 * @returns {undefined}
 */
function commitUpdate(event) {
  event.preventDefault();

  let $row = event.target.parentNode.parentNode;
  let id = $row.dataset.id;

  chrome.storage.local.get('BlockItems', (s) => {
    let existingItems = s.BlockItems || [];
    let item = existingItems.find((item) => item.id == id);

    item.channelName = $row.getElementsByClassName('channel-name')[0].value;
    item.channelId = $row.getElementsByClassName('channel-id')[0].value;
    item.reason = $row.getElementsByClassName('reason')[0].value;

    chrome.storage.local.set({ BlockItems: existingItems }, () => {
      $tableBody.replaceChild(tableRow(item), $row);
    });
  });
}

/**
 * showUpdateRow - Handle an event to show a block item's edit row
 *
 * @param  {Event} event The event that triggered the edit
 * @returns {undefined}
 */
function showUpdateRow(event) {
  event.preventDefault();

  let $row = event.target;

  while ($row.nodeName != 'TR') {
    if ($row.classList.contains('delete-cell')) {
      return;
    }

    $row = $row.parentNode;
  }

  let id = $row.dataset.id;

  chrome.storage.local.get('BlockItems', (s) => {
    let currentItem = s.BlockItems.find((item) => item.id == id);
    let $editRow = createEditRow(currentItem);

    $tableBody.replaceChild($editRow, $row);
  });
}

/**
 * @param  {BlockItem} blockItem The block item to generate the row by
 * @returns {Element} A table row for the given blockItem
 */
function tableRow(blockItem) {
  let $row = document.createElement('tr');
  $row.dataset.id = blockItem.id;
  $row.onclick = showUpdateRow;

  $row.appendChild(td(textNode(blockItem.channelName)));
  $row.appendChild(td(textNode(blockItem.channelId)));
  $row.appendChild(td(textNode(blockItem.reason)));

  let $deleteLink = document.createElement('a');
  $deleteLink.setAttribute('href', '#');
  $deleteLink.append('X');
  $deleteLink.onclick = deleteRow;

  let $deleteCell = document.createElement('td');
  $deleteCell.classList.add('delete-cell');
  $deleteCell.appendChild($deleteLink);

  $row.appendChild($deleteCell);

  return $row;
}

/**
 * Sets the content of the block items table
 *
 * @param  {Array<BlockItem>} blockItems The list of saved block items
 * @returns {undefined}
 */
function setBlockTableContent(blockItems) {
  while ($tableBody.firstChild) {
    $tableBody.removeChild($tableBody.firstChild);
  }

  blockItems.forEach((blockItem, i) => {
    $tableBody.appendChild(tableRow(blockItem, i));
  });
}

let $saveButton = document.getElementById('NewSave');
$saveButton.onclick = saveNewBlockItem;

chrome.storage.local.get('BlockItems', (s) => {
  setBlockTableContent(s.BlockItems || []);
});
