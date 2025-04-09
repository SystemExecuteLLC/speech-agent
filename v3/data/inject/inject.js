// Store the currently focused element without changing focus
window.focused = [
  document.activeElement,
  document.querySelector(':focus')
].filter(e => e && e !== document.body).filter(e => {
  const name = e.nodeName.toLowerCase();
  if (e.nodeType === 1 && (
    name === 'textarea' ||
    (name === 'input' && /^(?:text|email|number|search|tel|url|password)$/i.test(e.type)) ||
    e.isContentEditable
  )) {
    return true;
  }
}).shift();

// Ensure the element stays focused
if (window.focused) {
  // Make sure the element maintains focus
  setTimeout(() => {
    window.focused.focus();
  }, 100);
}


if (window.focused) {
  let transcript = '';
  // Connect to the extension with a name to identify this connection
  const port = chrome.runtime.connect({name: "speech-agent-connection"});
  port.onDisconnect.addListener(() => {
    console.log("Port disconnected");
    // Don't call port.close() here as it's already closed
  });
  port.onMessage.addListener(request => {
    if (request.transcript) {
      console.log("Received transcript:", request.transcript);
      const focused = window.focused;
      if (!focused) {
        console.error("No focused element found");
        return;
      }
      
      if (focused.isContentEditable) {
        // Handle contentEditable elements
        focused.textContent = request.transcript;
      } else {
        // Handle input and textarea elements
        if (focused.selectionStart === focused.selectionEnd) {
          // Replace the entire value
          focused.value = request.transcript;
        } else {
          // Replace only the selected text
          const start = focused.selectionStart;
          const end = focused.selectionEnd;
          focused.value = focused.value.substring(0, start) + 
                          request.transcript + 
                          focused.value.substring(end);
          focused.selectionStart = start;
          focused.selectionEnd = start + request.transcript.length;
        }
      }
      
      transcript = request.transcript;
      
      // Make sure the element stays focused after inserting text
      focused.focus();
      
      // Trigger input event to notify the page that the input has changed
      const inputEvent = new Event('input', { bubbles: true });
      focused.dispatchEvent(inputEvent);
    }
  });
  
  // Send a message to confirm connection
  port.postMessage({action: "connected", element: window.focused.nodeName});
}

window.focused && window.focused.nodeName
