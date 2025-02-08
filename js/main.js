document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const logoutForm = document.getElementById('logout-form');
    const submitButton = document.getElementById('submit');
    const logoutButton = document.getElementById('logout');
    const describer = document.getElementById('describer');
  
    // Check authentication state
    chrome.storage.local.get(['authenticated'], (result) => {
      if (result.authenticated) {
        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, (tabs) => {
            if (tabs.length > 0) {
                chrome.scripting.executeScript({
                    target: {
                        tabId: tabs[0].id
                    },
                    files: ['./js/content.js']
                });
            }
        });
        updateUIOnLogin();
      } else {
        updateUIOnLogout();
      }
    });
  
    // Login event
    submitButton.addEventListener('click', () => {
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
  
      chrome.runtime.sendMessage(
        { type: 'authenticate', email, password },
        (response) => {
          displayMessage(response.message);
          if (response.success) {
            updateUIOnLogin();
          } else {
            updateUIOnLogout();
          }
        }
      );
    });
  
    // Login with Enter key
    loginForm.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        submitButton.click();
      }
    });
  
    // Logout event
    logoutButton.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'logout' }, (response) => {
        displayMessage(response.message);
        if (response.success) {
          updateUIOnLogout();
        }
      });
    });
  
    // Helper functions
    function displayMessage(message) {
      describer.innerText = message;
    }
  
    function updateUIOnLogin() {
      loginForm.style.display = 'none';
      logoutForm.style.display = 'block';
    }
  
    function updateUIOnLogout() {
      loginForm.style.display = 'block';
      logoutForm.style.display = 'none';
      
    }

  });
  