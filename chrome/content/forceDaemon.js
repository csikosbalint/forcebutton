var myPrefObserver = {
	register : function() {
		// First we'll need the preference services to look for preferences.
		var prefService = Components.classes["@mozilla.org/preferences-service;1"]
				.getService(Components.interfaces.nsIPrefService);

		// For this.branch we ask for the preferences for
		// extensions.myextension. and children
		this.branch = prefService.getBranch("extensions.forcebutton.");

		// Now we queue the interface called nsIPrefBranch2. This interface is
		// described as:
		// "nsIPrefBranch2 allows clients to observe changes to pref values."
		// This is only necessary prior to Gecko 13
		if (!("addObserver" in this.branch))
			this.branch.QueryInterface(Components.interfaces.nsIPrefBranch2);

		// Finally add the observer.
		this.branch.addObserver("", this, false);
	},

	unregister : function() {
		this.branch.removeObserver("", this);
	},

	observe : function(aSubject, aTopic, aData) {
		if (aTopic != "nsPref:changed") {
			return;
		}
		log("--------------------------- Reinitalization ---------------------------");
		initConfig(false);
		initDaemon();
		return;
	}
}
myPrefObserver.register();
window.addEventListener("load", initOnLoadListener, false);
window.addEventListener("load", initFolderLoadListener, false);
window.addEventListener("load", initWatchMailListener, false);
log("INITALIZATION: Event listener(s) has been registered!");