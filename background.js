// background.js
// chrome.storage.session defaults to TRUSTED_CONTEXTS-only access, which
// excludes content scripts. This opts content scripts in; content.js
// (running on the Instagram page) can't set this itself.
chrome.storage.session.setAccessLevel({ accessLevel: 'TRUSTED_AND_UNTRUSTED_CONTEXTS' });
