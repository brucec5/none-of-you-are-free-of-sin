'use strict';

// TODO: feature idea: add badge numbers for number of blocked videos?

/**
 * The memoized blockset, so that we don't have to constantly
 * query the background page
 * @type {Set|undefined}
 */
var blockSet = undefined;

/**
 * setBlockItems - Sets the locally saved block items
 *
 * @param  {Array<BlockItem>} blockItems The stored block items
 * @returns {undefined}
 */
function setBlockItems(blockItems) {
  blockSet = new window.Set(blockItems.map((item) => item.channelName));
}

/**
 * @param  {string} channelName The channelName to test if blocked
 * @returns {boolean} true if the given channel is blocked
 */
function isBlocked(channelName) {
  return blockSet.has(channelName);
}

/**
 * @param  {Element} $video A "video" element
 * @returns {string} The channel name for a given video
 */
function channelName($video) {
  let $byline = $video.querySelector('#byline');
  return $byline.title;
}

/**
 * Throttles a given function such that it only gets called once per timeout.
 * Note that calling
 * @param {function} func The function to throttle. Should take no arguments.
 * @param {number} timeout The throttle time, in milliseconds
 * @returns {function} The throttled version of func
 */
function throttle(func, timeout) {
  let timer = null;

  return function() {
    if (!timer) {
      timer = setTimeout(function() {
        func();
        timer = null;
      }, timeout);
    }
  };
}

/**
 * Blocks a video by hiding it
 *
 * @param  {Element} $video The video to block
 * @returns {undefined}
 */
function blockVideo($video) {
  console.log('Blocking a video by', channelName($video));
  $video.classList.add('blocked-video');
}

/**
 * Given a node under a video node, find the root of the video.
 *
 * @param {Node} $node The node to search from
 * @returns {Node} The found root node, or undefined if none was found.
 */
function rootVideoNode($node) {
  if ($node.nodeName == 'BODY') {
    return undefined;
  } else if ($node.nodeName.match(/YTD-(COMPACT-VIDEO|GRID-VIDEO|SHELF)-RENDERER/)) {
    return $node;
  } else {
    return rootVideoNode($node.parentNode);
  }
}

/**
 * Dismiss the video blocking modal
 * @returns {undefined}
 */
function dismissModal() {
  let $modalShadow = document.getElementsByClassName('noyafos-modal-shadow')[0];
  $modalShadow.remove();
}

function dismissModalHandler(event) {
  event.preventDefault();

  dismissModal();
}

function submitBlockKey(event) {
  if (event.keyCode === 13) {
    event.preventDefault();
    submitBlock();
  }
}

function submitBlockClick(event) {
  event.preventDefault();
  submitBlock();
}

function submitBlock() {
  let $reasonInput = document.getElementById('NOYAFOSBlockReason');
  let blockItem = {
    channelName: $reasonInput.dataset.channelName,
    videoTitle: $reasonInput.dataset.videoTitle,
    reason: $reasonInput.value
  };

  chrome.runtime.sendMessage({action: 'addNewBlockItem', newBlockItem: blockItem}, () => {
    blockSet.add(blockItem.channelName);
    dismissModal();
    main();
  });
}

function shadow($child) {
  let $shadow = document.createElement('div');
  $shadow.classList.add('noyafos-modal-shadow');
  $shadow.appendChild($child);
  return $shadow;
}

function modal(title, callback) {
  let $modal = document.createElement('div');
  $modal.classList.add('noyafos-modal');

  let $headerRow = document.createElement('div');
  $headerRow.classList.add('noyafos-modal-header');

  let $header = document.createElement('h1');
  $header.appendChild(document.createTextNode(title));
  $headerRow.appendChild($header);

  let $closeButton = document.createElement('a');
  $closeButton.classList.add('noyafos-modal-close-btn');
  $closeButton.setAttribute('href', '#');
  $closeButton.appendChild(document.createTextNode('×'));
  $closeButton.onclick = dismissModalHandler;
  $header.appendChild($closeButton);

  let $modalContent = document.createElement('div');
  $modalContent.classList.add('noyafos-modal-content');

  callback($modalContent);

  $modal.appendChild($headerRow);
  $modal.appendChild($modalContent);

  return $modal;
}

function showBlockModal(theChannelName, theVideoTitle) {
  document.body.appendChild(
    shadow(
      modal(`Block Channel ${theChannelName}`, ($modalContent) => {
        let $reasonInput = document.createElement('input');
        $reasonInput.dataset.channelName = theChannelName;
        $reasonInput.dataset.videoTitle = theVideoTitle;
        $reasonInput.setAttribute('id', 'NOYAFOSBlockReason');
        $reasonInput.setAttribute('type', 'text');
        $reasonInput.setAttribute('placeholder', 'Block Reason');
        $reasonInput.onkeyup = submitBlockKey;
        $modalContent.appendChild($reasonInput);

        let $submit = document.createElement('button');
        $submit.classList.add('noyafos-submit');
        $submit.appendChild(document.createTextNode('Submit'));
        $submit.onclick = submitBlockClick;
        $modalContent.appendChild($submit);

        window.setTimeout(() => $reasonInput.focus(), 0);
      })
    )
  );
}

/**
 * handleAltClickOnVideo - Handles alt-clicking on videos. Block the video.
 *
 * @param  {type} event description
 * @returns {type}       description
 */
function handleAltClickOnVideo(event) {
  if (event.altKey) {
    event.preventDefault();

    let $target = event.target;
    let $video = rootVideoNode($target);

    if ($video) {
      let theChannelName = channelName($video);
      let theVideoTitle = videoTitle($video);
      showBlockModal(theChannelName, theVideoTitle);
    }
  }
}

/**
 * Checks a given video in a feed, hiding it if it should be blocked
 *
 * @param  {Element} $video The video to potentially block
 * @returns {undefined}
 */
function checkFeedVideo($video) {
  let theChannelName = channelName($video)

  if (isBlocked(theChannelName)) {
    // TODO: factor out logging to a configurable setting
    // console.log('Blocking ' + userId);
    blockVideo($video);
  } else {
    $video.onclick = handleAltClickOnVideo;
  }
}

function videoTitle($video) {
  let $titleElement = $video.querySelector('#video-title');
  return $titleElement.textContent.trim();
}

/**
 * Checks a given video in the sidebar, hiding it if it should be blocked.
 * If the video is actually the "Show More" link at the end, recurse on the videos under that.
 *
 * @param  {Element} $video The video to potentially block
 * @returns {undefined}
 */
function checkVideo($video) {
  let name = channelName($video);
  if (isBlocked(name)) {
    blockVideo($video);
  } else {
    $video.onclick = handleAltClickOnVideo;
  }
}

/**
 * General workflow:
 * 1. Fetch the blocklist from settings
 * 2. Iterate over all of the videos, blocking them if they're on the blacklist
 *   a. Check main sections on the homescreen
 *   b. Check sidebar recommendations
 *   c. Just hide all end-of-video recommendations because who cares about those
 *
 * @returns {undefined}
 */
function main() {
  let $sidebar = document.getElementsByTagName('ytd-compact-video-renderer');
  let $grid = document.getElementsByTagName('ytd-grid-video-renderer');
  let $shelf = document.getElementsByTagName('ytd-shelf-renderer');

  Array.from($sidebar).forEach(checkVideo);
  Array.from($grid).forEach(checkVideo);
  Array.from($shelf).forEach(checkVideo);
  console.log('done blocking things');
}

/**
 * Sets up a mutation observer to call main whenever the document changes.
 *
 * @returns {undefined}
 */
function loadObserver() {
  let triggerFunc = throttle(main, 500);
  let observer = new MutationObserver(triggerFunc);
  let sidebarObserver = new MutationObserver(() => {
    let $related = document.getElementById('related');
    if ($related) {
      sidebarObserver.disconnect();
      observer.observe($related, {
        childList: true,
        subtree: true
      });
    }
  });

  let $gridView = document.getElementsByTagName('ytd-two-column-browse-results-renderer')[0];

  if ($gridView) {
    observer.observe($gridView, {
      childList: true,
      subtree: true
    });
  } else {
    // TODO; figure out if this is the best way to handle this, or if this is woefully inefficient
    sidebarObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

chrome.storage.local.get('BlockItems', (o) => {
  setBlockItems(o.BlockItems || []);

  main();
  loadObserver();
});
