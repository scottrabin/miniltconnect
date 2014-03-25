// extension cached configs
var config = {
  port: null,
  hostnames: {}
};
var lastActiveTabId = null;

// page scripts for connecting/disconnecting from LT
var LT_WS_CONNECT = ["(function() {",
                     "function notify_connect() {",
                       "console.log('LightTable Connect: connected @', {{ host }});",
                     "}",
                     "if (window.io && window.io.sockets && window.io.sockets[{{ host }}]) {",
                       "if (!window.io.sockets[{{ host }}].connected) {",
                         "window.io.sockets[{{ host }}].connect();",
                         "notify_connect();",
                       "}",
                     "} else {",
                       "var ws_script = document.createElement('script');",
                       "ws_script.src = {{ host }} + '/socket.io/lighttable/ws.js';",
                       "ws_script.id = 'lt_ws';",
                       "ws_script.onload = notify_connect;",
                       "ws_script.onerror = function() { console.error('LightTable Connect: Unable to connect @', {{ host }}); };",
                       "document.head.appendChild(ws_script);",
                     "}",
                     "})();"
                    ].join('');
var LT_WS_DISCONNECT = ["(function() {",
                        "if (window.io && window.io.sockets && window.io.sockets[{{ host }}]) {",
                          "window.io.sockets[{{ host }}].disconnect();",
                          "console.log('LightTable Connect: disconnected @', {{ host }});",
                        "}",
                        "})();"
                       ].join('');

var SCRIPT_EXECUTION_TEMPLATE = ["(function() {",
                                 "var scr = document.createElement('script');",
                                 "scr.innerHTML = {{ code }};",
                                 "document.head.appendChild(scr);",
                                 "})();"
                                ].join('');

/**
 * Set the LightTable connection port
 *
 * @param {Number} port
 */
function setPort(port) {
  var newVal = parseInt(port, 10);
  if (!isNaN(newVal)) {
    config.port = newVal;
    chrome.storage.local.set({port: config.port});
    if (lastActiveTabId) {
      connectToTab(lastActiveTabId);
    }
  }
}

/**
 * Get the currently configured port value
 *
 * @return {Number}
 */
function getPort() {
  return config.port;
}

/**
 * Add a hostname to the set of hostnames LT should automatically connect to
 *
 * @param {String} hostname
 */
function addHostname(hostname) {
  if (!config.hostnames[hostname]) {
    config.hostnames[hostname] = true;
    chrome.storage.local.set({"hostnames": config.hostnames});
  }
}

/**
 * Remove a hostname from the set of hostnames LT should automatically connect to
 *
 * @param {String} hostname
 */
function removeHostname(hostname) {
  if (config.hostnames[hostname]) {
    delete config.hostnames[hostname];
    chrome.storage.local.set({"hostnames": config.hostnames});
  }
}

/**
 * Determine if a hostname has LT connect enabled
 *
 * @param {String} hostname
 * @return {Boolean}
 */
function isHostnameEnabled(hostname) {
  return config.hostnames[hostname] || false;
}

/**
 * Parse the hostname from a string
 *
 * @param {String} url
 * @return {String}
 */
function getHostname(url) {
  return url.split('//')[1].split('/')[0];
}

/**
 * Substitute {{ }}-delimited placeholders with values from a given context object
 *
 * @param {String} template
 * @param {Object} obj
 * @return {String}
 */
function sub(template, obj) {
  return template.replace(/{{\s*(\w+)\s*}}/g, function(_, param) {
    return obj[param] || "";
  });
}

/**
 * Execute the given code in the evaluation context of the page,
 * because Chrome has a stringent execution policy that otherwise
 * prevents calling functions defined on a given page
 *
 * @param {Number?} tabId The id of the tab to execute the code in
 * @param {String} code
 * @param {Function?} callback
 */
function executeScriptInPageContext(tabId, code, callback) {
  chrome.tabs.executeScript(tabId, {
    code: sub(SCRIPT_EXECUTION_TEMPLATE, {code: JSON.stringify(code)})
  }, callback);
}

/**
 * Toggle the LT connection to the specified tab
 *
 * @param {Number} tabId
 * @param {Boolean} enable
 */
function toggleTabConnection(tabId, enable) {
  // @#$%ing security policy requires we insert script contents
  // that need to access the page variable (e.g. window.io) by
  // actually inserting a <script> element with the contents as needed...
  var template = (enable ? LT_WS_CONNECT : LT_WS_DISCONNECT);
  executeScriptInPageContext(tabId, sub(template, {host: JSON.stringify('http://localhost:' + getPort())}), function() {
    if (enable) {
      lastActiveTabId = tabId;
    } else if (lastActiveTabId === tabId) {
      lastActiveTabId = null;
    }
  });
}

/**
 * Connect to the given tab
 *
 * @param {Number} tabId
 */
function connectToTab(tabId) {
  if (lastActiveTabId !== tabId) {
    if (lastActiveTabId) {
      toggleTabConnection(lastActiveTabId, false);
    }
    toggleTabConnection(tabId, true);
  }
}

// when a tab updates, connect or disconnect as needed
chrome.tabs.onUpdated.addListener(function(tabId, props) {
  if (props.hasOwnProperty('url')) {
    // url changed, connect if it is now enabled, or disconnect otherwise
    var hostname = getHostname(props.url);
    if (isHostnameEnabled(hostname)) {
      connectToTab(tabId);
    } else if (lastActiveTabId === tabId) {
      toggleTabConnection(tabId, false);
    }
  } else if (props.hasOwnProperty('status')) {
    if (props.status === 'loading') {
      if (lastActiveTabId === tabId) {
        // user refreshed the page, most likely...
        lastActiveTabId = null;
      }
    } else if (props.status === 'complete') {
      // tab just became ready, try to connect if necessary
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0].active && isHostnameEnabled(getHostname(tabs[0].url))) {
          connectToTab(tabs[0].id);
        }
      });
    }
  }
});

// when the focused tab changes, attempt to connect to it if
// it falls under the set of domains that are flagged as "auto connect"
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    if (isHostnameEnabled(getHostname(tab.url))) {
      connectToTab(tab.id);
    }
  });
});

// load the stored values
chrome.storage.local.get(null, function(conf) {
  config = conf;
});

// Public API
window.addHostname = addHostname;
window.removeHostname = removeHostname;
window.getHostname = getHostname;
window.isHostnameEnabled = isHostnameEnabled;
window.setPort = setPort;
window.connectToTab = connectToTab;
window.toggleTabConnection = toggleTabConnection;