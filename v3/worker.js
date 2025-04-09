// Store active connections
const connections = {};

// Listen for connections from content scripts
chrome.runtime.onConnect.addListener(port => {
  // Store the port for later use
  if (port.name === "speech-agent-connection") {
    const tabId = port.sender.tab.id;
    console.log("Content script connected from tab:", tabId);
    connections[tabId] = port;
    
    // Clean up when port is disconnected
    port.onDisconnect.addListener(() => {
      console.log("Content script disconnected from tab:", tabId);
      delete connections[tabId];
    });
    
    // Listen for messages from the content script
    port.onMessage.addListener(message => {
      console.log("Message from content script:", message);
    });
  }
});

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Received message from popup:", message);
  
  if (message.action === "transcript" && message.tabId) {
    if (connections[message.tabId]) {
      console.log("Forwarding transcript to tab:", message.tabId);
      // Forward the transcript to the content script
      connections[message.tabId].postMessage({
        transcript: message.transcript
      });
      sendResponse({success: true});
    } else {
      console.error("No connection found for tab:", message.tabId);
      console.log("Available connections:", Object.keys(connections));
      sendResponse({success: false, error: "No connection found for tab"});
    }
  }
  return true; // Required for async response
});

// Handle extension icon click
chrome.action.onClicked.addListener(tab => {
  // Execute the inject script on the active tab
  chrome.scripting.executeScript({
    target: {
      tabId: tab.id,
      allFrames: true
    },
    files: ['data/inject/inject.js']
  }, arr => {
    const lastError = chrome.runtime.lastError;
    if (lastError) {
      console.error(lastError.message);
      return;
    }
    
    if (!arr || !arr.filter(a => a.result).length) {
      // No active input found
      chrome.tabs.create({
        url: 'data/ui/index.html'
      });
    } else {
      // Open the UI in a popup window
      chrome.windows.create({
        url: `data/ui/index.html?tabId=${tab.id}`,
        type: 'popup',
        width: 400,
        height: 100
      });
    }
  });
});

/* FAQs & Feedback */
{
  const {management, runtime: {onInstalled, setUninstallURL, getManifest}, storage, tabs} = chrome;
  if (navigator.webdriver !== true) {
    const page = getManifest().homepage_url;
    const {name, version} = getManifest();
    onInstalled.addListener(({reason, previousVersion}) => {
      management.getSelf(({installType}) => installType === 'normal' && storage.local.get({
        'faqs': true,
        'last-update': 0
      }, prefs => {
        if (reason === 'install' || (prefs.faqs && reason === 'update')) {
          const doUpdate = (Date.now() - prefs['last-update']) / 1000 / 60 / 60 / 24 > 45;
          if (doUpdate && previousVersion !== version) {
            tabs.query({active: true, currentWindow: true}, tbs => tabs.create({
              url: page + '?version=' + version + (previousVersion ? '&p=' + previousVersion : '') + '&type=' + reason,
              active: reason === 'install',
              ...(tbs && tbs.length && {index: tbs[0].index + 1})
            }));
            storage.local.set({'last-update': Date.now()});
          }
        }
      }));
    });
    setUninstallURL(page + '?rd=feedback&name=' + encodeURIComponent(name) + '&version=' + version);
  }
}
