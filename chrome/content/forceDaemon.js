"use strict";

var myPrefObserver = {
  register: function() {
    // First we'll need the preference services to look for preferences.
    var prefService = Components.classes["@mozilla.org/preferences-service;1"]
                                .getService(Components.interfaces.nsIPrefService);

    // For this.branch we ask for the preferences for extensions.myextension. and children
    this.branch = prefService.getBranch("extensions.forcebutton.");

    // Now we queue the interface called nsIPrefBranch2. This interface is described as:  
    // "nsIPrefBranch2 allows clients to observe changes to pref values."
    // This is only necessary prior to Gecko 13
    if (!("addObserver" in this.branch))
        this.branch.QueryInterface(Components.interfaces.nsIPrefBranch2);

    // Finally add the observer.
    this.branch.addObserver("", this, false);
  },

  unregister: function() {
    this.branch.removeObserver("", this);
  },

  observe: function(aSubject, aTopic, aData) {
	if (aTopic != "nsPref:changed") {
		return;
	}
	log("--------------------------- Reinitalization ---------------------------");
	initConfig();
	initDaemon();
	return;
    // aSubject is the nsIPrefBranch we're observing (after appropriate QI)
    // aData is the name of the pref that's been changed (relative to aSubject)
//    switch (aData) {
//      case "pref1":
//        // extensions.myextension.pref1 was changed
//        break;
//      case "pref2":
//        // extensions.myextension.pref2 was changed
//        break;
//    }
  }
}
myPrefObserver.register();

function myOnLoad() {
	// Init config
	initConfig();
	// Init to send list
	initMAIL_LIST();
	// Init sent folders
	initFolders();
	// Start daemon cycle
	initDaemon();
}

function daemonThread() {
	if (FIRST) {
		FIRST = false;
		for ( var key in MAIL_LIST) {
			// Now we start counting for sending
			MAIL_LIST[key].date = new Date().getTime();
		}
		setTimeout('daemonThread()', FREQ_TIME * 60000);
		return;
	}

	log("--------------------------- Daemon cycle started ------------------------------");
	log("Start time: " + new Date() + " Repeate freq: " + (FREQ_TIME) + "(m)");
	log("-------------------------------------------------------------------------------");

	// Check for mails to send
	for ( var key in MAIL_LIST) {
		if (checkMAIL_LIST(MAIL_LIST[key].messageId)) { /*
														 * TRUE if mail in
														 * forcelist
														 */
			var now = new Date().getTime(); // seconds
			var old = now - (MAIL_LIST[key].date / 1000000); // seconds

			// WARN if resend is not a number
			if (!SEND_INTR[key].match(/^-?\d+$/)) {
				log("WARNING! Only whole hours can be used as resend interval! Changed to "
						+ SEND_DEF + "h!");
				SEND_INTR[key] = SEND_DEF;
			}

			// WARN if resend is not the same as in forcelist
			var send_int = resendMAIL_LIST(MAIL_LIST[key].messageId);
			if (send_int != SEND_INTR[key]) {
				log("WARNING! The forcelist or X-Forcebutton resend time changed! Using forcelist resend time!");
				SEND_INTR[key] = send_int;
			}

			if (old < SEND_INTR[key] * 3600000 / 10) {
				log("(" + (SEND_INTR[key] * 3600000 - old) / 1000 + "s)\t"
						+ MAIL_LIST[key].messageId + "\t"
						+ MAIL_LIST[key].subject);
			} else {
				log("SEND_START\t" + MAIL_LIST[key].messageId + "\t"
						+ MAIL_LIST[key].subject);
				SendMailNow(MAIL_LIST[key]);
			}
		} else {
			log("WARNING! Mail has been removed manually. Removing it from memory and demarking!");
			removeMAIL_LIST(key);
			delete MAIL_LIST[key];
		}

	}
	log("------------------------------ Daemon cycle end -------------------------------");

	// Loop for infinity and beyond
	setTimeout('daemonThread()', FREQ_TIME * 60000);
}
      window.addEventListener("load", myOnLoad, false);
//window.onload = onLoad;
