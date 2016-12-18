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
  blockSet = new window.Set(blockItems.map((item) => item.channelId));
}

/**
 * @param  {string} channelId The channelId to test if blocked
 * @returns {boolean} true if the given channel is blocked
 */
function isBlocked(channelId) {
  return blockSet.has(channelId);
}

/**
 * @param  {Element} $link A link to a channel. Doesn't necessarily have to be an a tag.
 * @returns {string} The channel ID for a given channel link
 */
function channelId($link) {
  return $link.dataset.ytid;
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
  $video.classList.add('blocked-video');
}

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
    channelId: $reasonInput.dataset.channelId,
    reason: $reasonInput.value
  };

  chrome.runtime.sendMessage({action: 'addNewBlockItem', newBlockItem: blockItem}, () => {
    blockSet.add(blockItem.channelId);
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

function showBlockModal(theChannelId, theChannelName) {
  document.body.appendChild(
    shadow(
      modal(`Block Channel ${theChannelName}`, ($modalContent) => {
        let $reasonInput = document.createElement('input');
        $reasonInput.dataset.channelId = theChannelId;
        $reasonInput.dataset.channelName = theChannelName;
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

    let $video = event.target;

    while ($video.nodeName != 'LI') {
      if ($video.classList.contains('delete-cell')) {
        return;
      }

      $video = $video.parentNode;
    }

    let $channelLink = $video.querySelector('[data-ytid]');
    let theChannelId = $channelLink.dataset.ytid;
    let theChannelName = $channelLink.textContent;

    showBlockModal(theChannelId, theChannelName);
  }
}

/**
 * Checks a given video in a feed, hiding it if it should be blocked
 *
 * @param  {Element} $video The video to potentially block
 * @returns {undefined}
 */
function checkFeedVideo($video) {
  let $details = $video.getElementsByClassName('yt-lockup-content')[0].children;
  let userId = channelId($details[1].children[0]);

  if (isBlocked(userId)) {
    // TODO: factor out logging to a configurable setting
    // console.log('Blocking ' + userId);
    blockVideo($video);
  } else {
    $video.onclick = handleAltClickOnVideo;
  }
}

/**
 * Checks a feed on the youtube front page for blocked videos
 *
 * @param  {Element} $feed The root element of one of the feeds
 * @returns {undefined}
 */
function checkFeed($feed) {
  let $userLinks = $feed.children[0].getElementsByTagName('a');
  let userId = $userLinks.length > 0 && channelId($userLinks[0]);

  if (isBlocked(userId)) {
    // console.log('Blocking whole feed by ' + userId);
    blockVideo($feed);
  } else {
    let $videos = $feed.getElementsByClassName('yt-shelf-grid-item');
    Array.from($videos).forEach(checkFeedVideo);
  }
}

/**
 * Checks a given video in the sidebar, hiding it if it should be blocked.
 * If the video is actually the "Show More" link at the end, recurse on the videos under that.
 *
 * @param  {Element} $video The video to potentially block
 * @returns {undefined}
 */
function checkSidebarVideo($video) {
  if ($video.nodeName === 'LI') {
    let $possibleUserElements = $video.getElementsByClassName('attribution');
    let $userElement = $possibleUserElements.length > 0 && $possibleUserElements[0].children[0];
    let userId = $userElement && channelId($userElement);
    if (isBlocked(userId)) {
      // console.log('Blocking ' + userId);
      blockVideo($video);
    } else {
      $video.onclick = handleAltClickOnVideo;
    }
  } else if ($video.id == 'watch-more-related') {
    Array.from($video.children, checkSidebarVideo);
  }
}

/**
 * Checks a given sidebar section for videos to block
 *
 * @param  {Element} $section The section to traverse for blocked videos
 * @returns {undefined}
 */
function checkSidebarSection($section) {
  let $videos = $section.getElementsByClassName('watch-sidebar-body')[0].children[0].children;
  Array.from($videos).forEach(checkSidebarVideo);
}

/**
 * Checks the sidebar for videos to block
 *
 * @param  {Element} $sidebar The sidebar element
 * @returns {undefined}
 */
function checkSidebar($sidebar) {
  if ($sidebar.children[1]) {
    let $sections = $sidebar.children[1].children[2].children;
    Array.from($sections).forEach(checkSidebarSection);
  }
}

/**
 * Checks the video endscreen for videos to block. And by that, I mean just hide the endscreen.
 *
 * @param  {Element} $endscreen The endscreen element
 * @returns {undefined}
 */
function checkEndscreen($endscreen) {
  blockVideo($endscreen);
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
  let $feeds = document.getElementsByClassName('feed-item-dismissable');
  let $sidebar = document.getElementsByClassName('watch-sidebar');
  let $endscreen = document.getElementsByClassName('html5-endscreen');

  Array.from($feeds).forEach(checkFeed);
  Array.from($sidebar).forEach(checkSidebar);
  Array.from($endscreen).forEach(checkEndscreen);
}

/**
 * Sets up a mutation observer to call main whenever the document changes.
 *
 * @returns {undefined}
 */
function loadObserver() {
  let triggerFunc = throttle(main, 500);
  let observer = new MutationObserver(triggerFunc);

  // TODO; figure out if this is the best way to handle this, or if this is woefully inefficient
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

chrome.storage.local.get('BlockItems', (o) => {
  setBlockItems(o.BlockItems || []);

  main();
  loadObserver();
});
