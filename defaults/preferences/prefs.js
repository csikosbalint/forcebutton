pref("extensions.forcebutton.debugMode", false);
pref("extensions.forcebutton.freqTime", 5000);

// https://developer.mozilla.org/en-US/docs/Extensions/Thunderbird/customDBHeaders_Preference
// this allows you to add extra headers while composing messages
user_pref("mail.compose.other.header", "X-Forcebutton");
// this enables the preservation of custom headers as incoming mail is processed
user_pref( "mailnews.customDBHeaders", "x-forcebutton");

// https://developer.mozilla.org/en/Localizing_extension_descriptions
pref("extensions.forceButton@fnf.hu.description", "chrome://forcebutton/locale/overlay.properties");
