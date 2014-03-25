// API
var ltconn = chrome.extension.getBackgroundPage();

// popup elements
var form = document.getElementById('config');
var portField = document.getElementById('config_port');
var enableField = document.getElementById('config_enable');

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
  ltconn.setPort(portField.value);
}

/**
 * Callback when the user changes the enabled/disabled state for the current domain
 * @param {Event} evt
 */
function configEnable_onChange(evt) {
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    var hostname = ltconn.getHostname(tabs[0].url);
    if (enableField.checked) {
      ltconn.addHostname(hostname);
      ltconn.connectToTab(tabs[0].id);
    } else {
      ltconn.removeHostname(hostname);
      ltconn.toggleTabConnection(tabs[0].id, false);
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  // config form
  form.addEventListener('submit', configForm_onSubmit);
  // port field
  portField.addEventListener('input', configPort_onChange);
  // enable for this domain field
  enableField.addEventListener('change', configEnable_onChange)

  // sync the form fields with the underlying data
  portField.value = ltconn.getPort();
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    enableField.checked = ltconn.isHostnameEnabled(ltconn.getHostname(tabs[0].url));
  });
});