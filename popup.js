// extension cached configs
var port = null;
var enabledDomains = {};

// popup elements
var form = document.getElementById('config');
var portField = document.getElementById('config_port');
var enableField = document.getElementById('config_enable');
var hostnameField = document.getElementById('config_hostname');

var LT_WS_CONNECT = ["(function() {",
                     "if (window.io && window.io.sockets && window.io.sockets[{{ host }}]) {",
                       "window.io.sockets[{{ host }}].connect();",
                     "} else {",
                       "var ws_script = document.createElement('script');",
                       "ws_script.src = {{ host }} + '/socket.io/lighttable/ws.js';",
                       "ws_script.id = 'lt_ws';",
                       "document.head.appendChild(ws_script);",
                     "}",
                     "console.log('LightTable Connect: connected @', {{ host }});",
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

function setPort(v) {
  var newVal = parseInt(v, 10);
  if (!isNaN(newVal)) {
    portField.value = newVal;
    port = newVal;
    chrome.storage.local.set({port: newVal});
  }
}

function sub(template, obj) {
  return template.replace(/{{\s*(\w+)\s*}}/g, function(_, param) {
    return obj[param] || "";
  });
}

function executeScriptInPageContext(tabId, code) {
  chrome.tabs.executeScript(tabId, {
    code: sub(SCRIPT_EXECUTION_TEMPLATE, {code: JSON.stringify(code)})
  });
}

function toggleTabConnection(tab, enable) {
  // @#$%ing security policy requires we insert script contents
  // that need to access the page variable (e.g. window.io) by
  // actually inserting a <script> element with the contents as needed...
  var template = (enable ? LT_WS_CONNECT : LT_WS_DISCONNECT);
  executeScriptInPageContext(tab.id, sub(template, {host: JSON.stringify('http://localhost:' + port)}));
}

/**
 * Callback for submitting the popup form
 * @param {Event} evt
 */
function configForm_onSubmit(evt) {
  evt.preventDefault();
}

/**
 * Callback when the port is changed
 * @param {Event} evt
 */
function configPort_onChange(evt) {
  setPort(portField.value);
}

/**
 * Callback when the user changes the enabled/disabled state for the current domain
 * @param {Event} evt
 */
function configEnable_onChange(evt) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    toggleTabConnection(tabs[0], enableField.checked);
  });
}

document.addEventListener('DOMContentLoaded', function() {
  // config form
  form.addEventListener('submit', configForm_onSubmit);
  // port field
  portField.addEventListener('input', configPort_onChange);
  // enable for this domain field
  enableField.addEventListener('change', configEnable_onChange)

  chrome.storage.local.get('port', function(vals) {
    setPort(vals.port);
  });
});