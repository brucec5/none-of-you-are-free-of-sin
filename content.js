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

function $modalShadow() {
  return document.getElementsByClassName('noyafos-modal-shadow')[0];
}

function dismissModal() {
  $modalShadow().style.display = 'none';
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

function showBlockModal(theChannelName) {
  let $modal = document.querySelector('.noyafos-modal');
  let $header = $modal.querySelector('.noyafos-modal-title');
  let $reasonInput = $modal.querySelector('#NOYAFOSBlockReason');

  $header.textContent = `Block Channel ${theChannelName}`;

  $reasonInput.dataset.channelName = theChannelName;
  $reasonInput.value = '';

  $modalShadow().style.display = 'block';

  $reasonInput.focus();
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

    let $video = event.target;

    // TODO: is this always the case?
    while ($video.parentNode.id != 'items') {
      $video = $video.parentNode;
    }

    let theChannelName = channelName($video)

    showBlockModal(theChannelName);
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
  let $feeds = document.getElementsByTagName('ytd-grid-video-renderer');
  // let $sidebar = document.getElementsByClassName('watch-sidebar');
  // let $endscreen = document.getElementsByClassName('html5-endscreen');

  Array.from($feeds).forEach(checkFeedVideo);
  // Array.from($sidebar).forEach(checkSidebar);
  // Array.from($endscreen).forEach(checkEndscreen);
}

/**
 * Sets up a mutation observer to call main whenever the document changes.
 *
 * @returns {undefined}
 */
function loadObserver() {
  let triggerFunc = throttle(main, 500);
  let observer = new MutationObserver(triggerFunc);
}

function fetchModalHtml() {
  let htmlUrl = chrome.extension.getURL('/content_modal.html');

  return fetch(
    htmlUrl
  ).then(
    response => response.text()
  ).catch(failure => {
    console.error('Failure to fetch modal!');
    debugger;
  });
}

async function setUpBlockModal() {
  let modalHtml = await fetchModalHtml();

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  let $modal = document.querySelector('.noyafos-modal');
  let $closeButton = $modal.querySelector('.noyafos-modal-close-btn');
  let $reasonInput = $modal.querySelector('#NOYAFOSBlockReason');
  let $submit = $modal.querySelector('.noyafos-submit');

  $closeButton.onclick = dismissModalHandler;
  $reasonInput.onkeyup = submitBlockKey;
  $submit.onclick = submitBlockClick;
}

setUpBlockModal();

chrome.storage.local.get('BlockItems', (o) => {
  setBlockItems(o.BlockItems || []);

  main();
  loadObserver();
});
