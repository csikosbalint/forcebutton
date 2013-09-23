pref("extensions.forcebutton.debugMode", false);
pref("extensions.forcebutton.modifyHeader", false);
pref("extensions.forcebutton.stringHeader", "Forced");
pref("extensions.forcebutton.freqTime", 5000);
pref("extensions.forcebutton.postScriptum", "Please respond!");

// https://developer.mozilla.org/en-US/docs/Extensions/Thunderbird/customDBHeaders_Preference
// this allows you to add extra headers while composing messages
user_pref("mail.compose.other.header", "X-Superfluous,X-Other,X-Whatever");
// this enables the preservation of custom headers as incoming mail is processed
user_pref( "mailnews.customDBHeaders", "x-superfluous x-other");

// https://developer.mozilla.org/en/Localizing_extension_descriptions
pref("extensions.forceButton@fnf.hu.description", "chrome://forcebutton/locale/overlay.properties");
