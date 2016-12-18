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
 * addNewBlockItem - Adds a new block item to the store
 *
 * @param  {BlockItem} newBlockItem The new block item to add
 * @param  {function} callback A callback called on successful add. Takes in the created item.
 * @returns {undefined}
 */
function addNewBlockItem(newBlockItem, callback) {
  chrome.storage.local.get('BlockItems', (s) => {
    let existingItems = s.BlockItems || [];

    let foundItem = existingItems.find((item) => (item.channelId === newBlockItem.channelId));
    if (foundItem) {
      callback(foundItem);
      return;
    }

    newBlockItem.id = newId(existingItems);
    existingItems.push(newBlockItem);

    chrome.storage.local.set({ BlockItems: existingItems }, () => {
      callback(newBlockItem);
    });
  });
}

/**
 * deleteBlockItem - Deletes a block item from the store
 *
 * @param  {Number} id The block item ID to delete
 * @param  {function} callback A callback called on successful deletion. No arguments.
 * @returns {undefined}
 */
function deleteBlockItem(id, callback) {
  chrome.storage.local.get('BlockItems', (s) => {
    let existingItems = s.BlockItems || [];
    let index = existingItems.findIndex((item) => item.id == id);
    existingItems.splice(index, 1);

    chrome.storage.local.set({ BlockItems: existingItems }, () => {
      callback();
    });
  });
}

function updateBlockItem(id, blockItemData, callback) {
  chrome.storage.local.get('BlockItems', (s) => {
    let existingItems = s.BlockItems || [];
    let item = existingItems.find((item) => item.id == id);

    Object.assign(item, blockItemData);

    chrome.storage.local.set({ BlockItems: existingItems }, () => {
      callback(item);
    });
  });
}

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {
    switch (request.action) {
    case 'addNewBlockItem':
      addNewBlockItem(request.newBlockItem, (item) => {
        sendResponse({newBlockItem: item});
      });
      break;
    default:

    }
  }
);
