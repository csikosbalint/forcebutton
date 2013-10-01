// GLOBAL VARIABLES
var FORCE_FLAG;
var major_version = '1';
var minor_version = '0.0';

// CONFIG VARIABLES
// TODO: Put these config props into pref.js
// var PStext = "P.s.:";
// var FORCEDIR = "forcebutton";
// var FORCELIST = "forcedmails.lst";
// var REPTIME = 2 * 60 * 60 * 1000;
// var REPTIME = 2 * 60 * 1000;
//
// function addListElement(hash, gMsgCompose) { // string,
// // document.getElementById("msgSubject").value
// var list = initTextFile(FORCELIST);
// list.writeString(hash + "," + new Date().getTime() + "," + REPTIME + ","
// + new Date().getTime() + "," + gMsgCompose.compFields.messageId
// + ",," + gMsgCompose.compFields.subject + "\n");
// list.close();
// MAIL_LIST = readMailList(FORCELIST);
// return true;
// }

// function initTextFile(filename) {
// var directory = Components.classes["@mozilla.org/file/directory_service;1"]
// .getService(Components.interfaces.nsIProperties);
//
// // Build file for output stream into profile directory
// var profile = directory.get("ProfD", Components.interfaces.nsIFile);
// profile.append(FORCEDIR);
// var forceDir = profile;
//
// // Create forceDir if does not exists
// if (!forceDir.exists() || !forceDir.isDirectory()) {
// forceDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0750);
// }
//
// forceDir.append(filename);
// var file = forceDir;
//
// var outstream =
// Components.classes["@mozilla.org/network/file-output-stream;1"]
// .createInstance(Components.interfaces.nsIFileOutputStream);
// outstream.init(file, 0x04 | 0x08 | 0x10, 0644, 0);
//
// var converter =
// Components.classes["@mozilla.org/intl/converter-output-stream;1"]
// .createInstance(Components.interfaces.nsIConverterOutputStream);
// converter.init(outstream, "UTF-8", 0, 0);
//
// return converter;
// }

function onSendEvent(evt) {

	var headers = gMsgCompose.compFields.otherRandomHeaders;
	if (headers.indexOf("X-Forcebutton: ") == -1) {
		return; // Do nothing ...
	}
	var from = gCurrentIdentity.email;
	if (from.indexOf("yahoo") = -1) {
		log("Sorry, Yahoo account not supported yet!");
		window.alert("Sorry, Yahoo account not supported yet!");
		headers = headers.replace(/X-Forcebutton:.*(\r\n|\n|\r)/gm, "");
		gMsgCompose.compFields.otherRandomHeaders = headers;
		return

	}
	/*
	 * check and normalize X-Forcebutton tag values
	 */
	var xforcebutton = headers.match(/X-Forcebutton: [0-9]+/g);
	if (xforcebutton == null) {
		xforcebutton = "X-Forcebutton: 2";
		headers = headers.replace(/X-Forcebutton:.*(\r\n|\n|\r)/gm,
				xforcebutton + "$1");
		// window.alert(headers);
	} else {
		// window.alert(xforcebutton.length);
		headers = headers.replace(/X-Forcebutton:.*(\r\n|\n|\r)/gm,
				xforcebutton + ",v" + major_version + "." + minor_version
						+ "$1");
		// window.alert(headers);
	}

	gMsgCompose.compFields.otherRandomHeaders = headers;

	// var prefs = Components.classes["@mozilla.org/preferences-service;1"]
	// .getService(Components.interfaces.nsIPrefService);

	// // Get items for modifications
	// // Default values if nothing else was definied
	// try {
	// var branch = prefs.getBranch("extensions.forcebutton.");
	// } catch (ex) {
	// var postScriptum = "Please respond!";
	// var modifyHeader = false;
	// var stringHeader = "Forced";
	// }
	// try {
	// var postScriptum = branch.getComplexValue("postScriptum",
	// Components.interfaces.nsIPrefLocalizedString).data;
	// } catch (ex) {
	// var postScriptum = "Please respond!";
	// }
	// try {
	// var modifyHeader = branch.getBoolPref("modifyHeader");
	// } catch (ex) {
	// var modifyHeader = false;
	// }
	// try {
	// var stringHeader = branch.getComplexValue("stringHeader",
	// Components.interfaces.nsIPrefLocalizedString).data;
	// } catch (ex) {
	// var stringHeader = "Forced";
	// }
	//
	// // Modify message header if requested
	// //gMsgCompose.compFields.subject += " [Forced!]"
	// if (modifyHeader) {
	// gMsgCompose.compFields.subject = "[" + stringHeader + "] "
	// + gMsgCompose.compFields.subject;
	// document.getElementById("msgSubject").value =
	// gMsgCompose.compFields.subject;
	// }
	//
	// // Append header hash into list file and message header
	// var hash = createUUID();
	// var header = "Keywords: " + hash + "\n";// + "@forcebutton.v" +
	// // major_version
	// + "-" + minor_version + "\n";
	// gMsgCompose.compFields.otherRandomHeaders += header;

	// if ( addListElement("<" + hash + "@forcebutton.v" + major_version + "-" +
	// minor_version + ">", gMsgCompose) == true ) {;

	// // Append postscriptum into message body
	// try {
	// var editor = GetCurrentEditor();
	// var editor_type = GetCurrentEditorType();
	// editor.beginTransaction();
	// editor.endOfDocument();
	// if (editor_type == "textmail" || editor_type == "text") {
	// editor.insertText(PStext + postScriptum);
	// editor.insertLineBreak();
	// } else {
	// editor.insertHTML("<p>" + PStext + postScriptum + "</p>");
	// }
	// editor.endTransaction();
	// } catch (ex) {
	// log("Append exception: " + ex + "\n");
	// window.alert("Cannot append message body! ...");
	// return false;
	// }
	// } else {
	// window.alert("Cannot add mail to list!...");
	// }
}
/*
 * 
 */

var columnHandler = {
	getCellText : function(row, col) {
		// get the messages header so that we can extract the 'X-Superfluous'
		// field
		var key = gDBView.getKeyAt(row);
		var hdr = gDBView.db.GetMsgHdrForKey(key);
		hdr.setStringProperty("x-forcebutton", "enabled");
		var retval = hdr.getStringProperty("x-forcebutton");
		return retval;
	},

	getSortStringForRow : function(hdr) {
		return hdr.getStringProperty("x-forcebutton");
	},
	isString : function() {
		return true;
	},
	getCellProperties : function(row, col, props) {
	},
	getImageSrc : function(row, col) {
		return null;
	},
	getSortLongForRow : function(hdr) {
		return 0;
	}
}

function addCustomColumnHandler() {
	gDBView.addColumnHandler("colForcebutton", columnHandler);
}

var CreateDbObserver = {
	// Components.interfaces.nsIObserver
	observe : function(aMsgFolder, aTopic, aData) {
		addCustomColumnHandler();
	}
}

function doOnceLoaded() {
	var ObserverService = Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);
	ObserverService.addObserver(CreateDbObserver, "MsgCreateDBView", false);
	// window.document.getElementById('folderTree').addEventListener("select",
	// addCustomColumnHandler, false);
}

window.addEventListener("load", doOnceLoaded, false);
window.addEventListener("compose-send-message", onSendEvent, true);
