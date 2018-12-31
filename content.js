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
 *
 * @returns {undefined}
 */
function setBlockItems(blockItems) {
  blockSet = new window.Set(blockItems.map((item) => item.channelName));
}

/**
 * @param  {string} channelName The channelName to test if blocked
 *
 * @returns {boolean} true if the given channel is blocked
 */
function isBlocked(channelName) {
  return blockSet.has(channelName);
}

/**
 * @param  {Element} $video A "video" element
 *
 * @returns {string} The channel name for a given video
 */
function channelName($video) {
  let $byline = $video.querySelector('#byline');
  return $byline.title;
}

/**
 * @param  {Element} $video A "video" element
 *
 * @returns {string} The video title for a given video
 */
function videoTitle($video) {
  let $title = $video.querySelector('#video-title');
  return $title.title;
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
 * Fetch the modal shadow element (the parent element to the modal)
 *
 * @return {Element} The modal shadow element
 */
function $modalShadow() {
  return document.getElementsByClassName('noyafos-modal-shadow')[0];
}

/**
 * Dismiss (hide) the block-video modal if it is currently shown
 *
 * @return {undefined}
 */
function dismissModal() {
  $modalShadow().style.display = 'none';
}

/**
 * Handle click events on the block-video modal exit button
 *
 * @param {Event} event The click event to handle
 *
 * @return {undefined}
 */
function dismissModalHandler(event) {
  event.preventDefault();

  dismissModal();
}

/**
 * Handle keyboard (Enter) events on the block-video modal reason field
 *
 * @param {Event} event The keyup event to handle
 *
 * @return {undefined}
 */
function submitBlockKey(event) {
  if (event.keyCode === 13) {
    event.preventDefault();
    submitBlock();
  }
}

/**
 * Handle click events on the block-video modal submit button
 *
 * @param {Event} event The click event to handle
 *
 * @return {undefined}
 */
function submitBlockClick(event) {
  event.preventDefault();
  submitBlock();
}

/**
 * Submits a channel/video to the blocklist. Trigger that channel to get hidden.
 *
 * @return {undefined}
 */
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

/**
 * Set the block-video modal up for a given channel/video and display it.
 *
 * @param {String} theChannelName The name of the channel to block
 * @param {String} theVideoTitle The title of the video to block
 *
 * @return {undefined}
 */
function showBlockModal(theChannelName, theVideoTitle) {
  let $modal = document.querySelector('.noyafos-modal');
  let $header = $modal.querySelector('.noyafos-modal-title');
  let $reasonInput = $modal.querySelector('#NOYAFOSBlockReason');

  $header.textContent = `Block Channel ${theChannelName}`;

  $reasonInput.dataset.channelName = theChannelName;
  $reasonInput.dataset.videoTitle = theVideoTitle;
  $reasonInput.value = '';

  $modalShadow().style.display = 'block';

  $reasonInput.focus();
}

/**
 * Handles alt-clicking on videos. Triggers the block-video modal for the
 * given video.
 *
 * @param  {Event} event The click event that is being handled
 * @returns {undefined}
 */
function handleAltClickOnVideo(event) {
  if (!event.altKey) {
    return;
  }

  event.preventDefault();

  let $video = event.target;

  while ($video.parentNode.id != 'items') {
    $video = $video.parentNode;
  }

  let theChannelName = channelName($video)
  let theVideoTitle = videoTitle($video)

  showBlockModal(theChannelName, theVideoTitle);
}

/**
 * Checks a given video in a feed, hiding it if it should be blocked
 *
 * @param  {Element} $video The video to potentially block
 * @returns {undefined}
 */
function checkVideo($video) {
  let theChannelName = channelName($video)

  if (isBlocked(theChannelName)) {
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
 *   c. Just hide all end-of-video recommendations in content.css because who cares about those
 *
 * @returns {undefined}
 */
function main() {
  let $feeds = document.getElementsByTagName('ytd-grid-video-renderer');
  let $sidebar = document.getElementsByTagName('ytd-compact-video-renderer');

  Array.from($feeds).forEach(checkVideo);
  Array.from($sidebar).forEach(checkVideo);
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

/**
 * Fetch the HTML for the block-video modal
 *
 * @return {Promise<String>} The HTML for the modal
 */
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

/**
 * Initialize the block-video modal
 *
 * @return {undefined}
 */
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
