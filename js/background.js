import {
  initializeApp
} from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import JSZip from 'jszip';

const firebaseConfig = {
  apiKey: "AIzaSyBZ6Zp_PLPRe4_u3u90ybtduhIMYe2hmDc",
  authDomain: "finac-e-taxes-extension.firebaseapp.com",
  projectId: "finac-e-taxes-extension",
  storageBucket: "finac-e-taxes-extension.firebasestorage.app",
  messagingSenderId: "69184083699",
  appId: "1:69184083699:web:e9f806aa9a43480ee40986"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Listener for authentication state changes
onAuthStateChanged(auth, async (user) => {
  console.log(chrome.storage.local)
  if (user) {
    const deviceId = await fetchOrGenerateDeviceId();
    const deviceValid = await validateDeviceIdForUser(user.email, deviceId);
    if (deviceValid) {
      chrome.storage.local.set({
        authenticated: true
      });
      console.log(`${user.email} authenticated successfully.`);
      chrome.tabs.query({
        active: true,
        currentWindow: true
      }, (tabs) => {
        if (tabs && tabs.length > 0) {
          chrome.scripting.executeScript({
            target: {
              tabId: tabs[0].id
            },
            files: ['./js/content.js']
          });
        }
      });
    } else {
      await signOut(auth);
      chrome.storage.local.remove('authenticated');
    }
  } else {
    chrome.storage.local.remove('authenticated');
    console.log("User signed out or not authenticated.");
  }
});

// Handle messages from the content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'authenticate') {
    handleLogin(message.email, message.password, sendResponse);
  } else if (message.type === 'logout') {
    handleLogout(sendResponse);
  }
  return true; // Indicate asynchronous response
});

// Function to handle login
async function handleLogin(email, password, sendResponse) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    const deviceId = await fetchOrGenerateDeviceId();
    const deviceValid = await validateDeviceIdForUser(user.email, deviceId);
    if (deviceValid) {
      sendResponse({
        success: true,
        message: `${user.email} logged in!`
      });
    } else {
      sendResponse({
        success: false,
        message: "Login failed! Device id mismatced."
      });
    }
  } catch (error) {
    sendResponse({
      success: false,
      message: "Login failed! Please check your credentials."
    });
  }
}

// Function to fetch or generate a device ID
async function fetchOrGenerateDeviceId() {
  return new Promise((resolve) => {
    chrome.storage.sync.get(['deviceId'], (result) => {
      if (result.deviceId) {
        resolve(result.deviceId);
      } else {
        const newDeviceId = generateUuid();
        chrome.storage.sync.set({
          deviceId: newDeviceId
        }, () => resolve(newDeviceId));
      }
    });
  });
}

// Function to validate device ID for the user
async function validateDeviceIdForUser(email, currentDeviceId) {
  const userDevicesRef = doc(db, 'user_devices', email);
  const docSnap = await getDoc(userDevicesRef);

  if (docSnap.exists()) {
    const storedDeviceId = docSnap.data().deviceId;
    return storedDeviceId === currentDeviceId;
  } else {
    await setDoc(userDevicesRef, {
      deviceId: currentDeviceId
    });
    return true;
  }
}

// Function to handle logout
async function handleLogout(sendResponse) {
  try {
    await signOut(auth);
    chrome.storage.local.remove('authenticated', () => {
      sendResponse({
        success: true,
        message: "User signed out!"
      });
    });
  } catch (error) {
    sendResponse({
      success: false,
      message: "Error signing out."
    });
  }
}

// Helper function to generate a UUID
function generateUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

chrome.storage.local.remove('xmlContent', () => {
  if (chrome.runtime.lastError) {
    console.error('Error removing xmlContent from storage:', chrome.runtime.lastError.message);
  } else {
    console.log('xmlContent removed from storage.');
  }
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.xmlContent) {
    const xmlFiles = changes.xmlContent.newValue;
    const zip = new JSZip();
    const today = new Date();
    const formattedDate = today.toISOString().slice(0, 10).replace(/-/g, '');

    zip.file("vhf-inf/vhf.mf", "VHF-Manifest-Version: 1.0");

    for (let i = 0; i < xmlFiles.length; i++) {
      if (xmlFiles[i].content && xmlFiles[i].filename) {
        zip.file(xmlFiles[i].filename, xmlFiles[i].content);
      } else {
        console.warn("Skipping invalid file entry:", {
          content: xmlFiles[i].content,
          filename: xmlFiles[i].filename
        });
      }
    }

    zip.generateAsync({
        type: "blob"
      })
      .then((zipBlob) => {
        const reader = new FileReader();
        reader.onloadend = function () {
          const blobUrl = reader.result;
          chrome.downloads.download({
              url: blobUrl,
              filename: `paket_${formattedDate}.zip`,
              saveAs: true,
            },
            () => {
              if (chrome.runtime.lastError) {
                console.error("Download error:", chrome.runtime.lastError.message);
              } else {
                console.log("Download initiated successfully.");
              }
            }
          );
        };
        reader.readAsDataURL(zipBlob); // Convert Blob to Data URL

        chrome.storage.local.remove('xmlContent', () => {
          if (chrome.runtime.lastError) {
            console.error('Error removing xmlContent from storage:', chrome.runtime.lastError.message);
          } else {
            console.log('xmlContent removed from storage.');
          }
        });
      })
      .catch((err) => {
        console.error("Error generating ZIP:", err);
      });
  }
});