/*
 *  Written by johnnym
 */

//GLOBAL VARIABLES
var MAIL_LIST; // messageId -> nsIMsgDBHdr
var SEND_INTR; // messageId -> ms
var SEND_DEF; // default resend time -> h
var FIRST;
// TODO: implement
var ELDERMAIL; // store oldest forcemail (not implemented yet)

var LOGSTREAM; // logging IO stream
var DAEMON; // Daemon object - in order to kill/reload it!
var PREFS; // Preferences branch object
var aCurrentIdentity; // For identity search
var aAccountManager; // For account search
var sentFolder = []; // "Sent" folders for accounts

var def_identity;
var fld;

// CONFIG VARIABLES
var FORCEDIR;
var DAEMON_LOG;
var FORCELIST;
var FREQ_TIME;
var DEBUG_MODE;
var AUTHOR_MAIL;

function initConfig() {

	var prefService = Components.classes["@mozilla.org/preferences-service;1"]
			.getService(Components.interfaces.nsIPrefService).getBranch(
					"extensions.forcebutton.");

	// CONFIG VARIABLES
	// TODO: Put these config props into pref.js
	FORCEDIR = "forcebutton";
	DAEMON_LOG = "daemon.log";
	FORCELIST = "forcedmails.lst";
	if (prefService.getIntPref("freqTime") != 0) {
		FREQ_TIME = prefService.getIntPref("freqTime"); // daemon freq (ms)
	} else {
		FREQ_TIME = 1;
	}

	SEND_DEF = 2; // default resend (h)
	DEBUG_MODE = true;
	AUTHOR_MAIL = "johnnym@fnf.hu";
	FIRST = true;
	log("Config has been initialized!");
	// TODO: Check environment ... return true/false
	return true;
}

function initLogging() {
	// Start logging ...
	LOGSTREAM = initTextFile(DAEMON_LOG);
	log("Logging has been initialized!");
}

function log(string) {
	if (!DEBUG_MODE) {
		return;
	}

	if (LOGSTREAM == undefined) {
		LOGSTREAM = initTextFile(DAEMON_LOG);
	}

	var currentTime = new Date();
	var month = currentTime.getMonth() + 1;
	var day = currentTime.getDate();
	var year = currentTime.getFullYear();
	var hours = currentTime.getHours();
	var minutes = currentTime.getMinutes();
	var seconds = currentTime.getSeconds();
	if (minutes < 10) {
		minutes = "0" + minutes;
	}
	if (seconds < 10) {
		seconds = "0" + seconds;
	}
	LOGSTREAM.writeString("[ " + month + "/" + day + "/" + year + " " + hours
			+ ":" + minutes + ":" + seconds + " ] " + string + "\n");
}

function initTextFile(filename) {
	// Create forcedir if does not exists
	var dirService = Components.classes["@mozilla.org/file/directory_service;1"]
			.getService(Components.interfaces.nsIProperties);
	// Returns an nsIFile object with the profile directory
	var profileDirFile = dirService.get("ProfD", Components.interfaces.nsIFile);

	// Create forceDir if does not exists
	profileDirFile.append(FORCEDIR);
	var forceDirFile = profileDirFile;

	if (!forceDirFile.exists() || !forceDirFile.isDirectory()) {
		forceDirFile.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0750);
	}

	// Create file if does not exists
	forceDirFile.append(filename);
	var forceFile = forceDirFile;

	// Prepare stream for append text
	var forceFileStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream);
	/* use 0x02 | 0x10 to open file for appending. */
	forceFileStream.init(forceFile, 0x04 | 0x08 | 0x10, 0644, 0);
	/*
	 * PR_RDONLY 0x01 Open for reading only. PR_WRONLY 0x02 Open for writing
	 * only. PR_RDWR 0x04 Open for reading and writing. PR_CREATE_FILE 0x08 If
	 * the file exists, this flag has no effect. PR_APPEND 0x10 The file pointer
	 * is set to the end of the file... PR_TRUNCATE 0x20 If the file exists, its
	 * length is truncated to 0. PR_SYNC 0x40 If set, each write will wait for
	 * both the file... PR_EXCL 0x80 With PR_CREATE_FILE, if the file does not
	 * exist...
	 */
	var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
			.createInstance(Components.interfaces.nsIConverterOutputStream);
	converter.init(forceFileStream, "UTF-8", 0, 0);

	return converter;
}

function overwriteTextFile(filename) {
	// Create forcedir if does not exists
	var dirService = Components.classes["@mozilla.org/file/directory_service;1"]
			.getService(Components.interfaces.nsIProperties);
	// Returns an nsIFile object with the profile directory
	var profileDirFile = dirService.get("ProfD", Components.interfaces.nsIFile);

	// Create forceDir if does not exists
	profileDirFile.append(FORCEDIR);
	var forceDirFile = profileDirFile;

	if (!forceDirFile.exists() || !forceDirFile.isDirectory()) {
		forceDirFile.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0750);
	}

	// Create file if does not exists
	forceDirFile.append(filename);
	var forceFile = forceDirFile;

	// Prepare stream for append text
	var forceFileStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream);
	/* use 0x02 | 0x10 to open file for overwrite. */
	forceFileStream.init(forceFile, 0x04 | 0x08 | 0x20, 0644, 0);
	/*
	 * PR_RDONLY 0x01 Open for reading only. PR_WRONLY 0x02 Open for writing
	 * only. PR_RDWR 0x04 Open for reading and writing. PR_CREATE_FILE 0x08 If
	 * the file exists, this flag has no effect. PR_APPEND 0x10 The file pointer
	 * is set to the end of the file... PR_TRUNCATE 0x20 If the file exists, its
	 * length is truncated to 0. PR_SYNC 0x40 If set, each write will wait for
	 * both the file... PR_EXCL 0x80 With PR_CREATE_FILE, if the file does not
	 * exist...
	 */
	var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
			.createInstance(Components.interfaces.nsIConverterOutputStream);
	converter.init(forceFileStream, "UTF-8", 0, 0);

	return converter;
}

function readTextFile(filename) {
	// Create forcedir if does not exists
	var dirService = Components.classes["@mozilla.org/file/directory_service;1"]
			.getService(Components.interfaces.nsIProperties);
	// Returns an nsIFile object with the profile directory
	var profileDirFile = dirService.get("ProfD", Components.interfaces.nsIFile);

	// Create forceDir if does not exists
	profileDirFile.append(FORCEDIR);
	var forceDirFile = profileDirFile;

	if (!forceDirFile.exists() || !forceDirFile.isDirectory()) {
		forceDirFile.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0750);
	}

	// Create file if does not exists
	forceDirFile.append(filename);
	var forceFile = forceDirFile;

	// Prepare stream for append text
	var forceFileStream = Components.classes["@mozilla.org/network/file-input-stream;1"]
			.createInstance(Components.interfaces.nsIFileInputStream);
	/* use 0x02 | 0x10 to open file for appending. */
	forceFileStream.init(forceFile, -1, -1, 0);
	/*
	 * Parameters
	 * 
	 * file File to read from (must QI to nsILocalFile) ioFlags The file status
	 * flags define how the file is accessed. See PR_Open documentation for more
	 * details. If set to -1 the file will be opened in default mode
	 * (PR_RDONLY). perm File mode bits are described in the PR_Open
	 * documentation. If set to -1 the default value 0 will be used.
	 * behaviorFlags Flags specifying various behaviors of the class (see
	 * enumerations in the class).
	 */
	/*
	 * PR_RDONLY 0x01 Open for reading only. PR_WRONLY 0x02 Open for writing
	 * only. PR_RDWR 0x04 Open for reading and writing. PR_CREATE_FILE 0x08 If
	 * the file exists, this flag has no effect. PR_APPEND 0x10 The file pointer
	 * is set to the end of the file... PR_TRUNCATE 0x20 If the file exists, its
	 * length is truncated to 0. PR_SYNC 0x40 If set, each write will wait for
	 * both the file... PR_EXCL 0x80 With PR_CREATE_FILE, if the file does not
	 * exist...
	 */
	var converter = Components.classes["@mozilla.org/intl/converter-input-stream;1"]
			.createInstance(Components.interfaces.nsIConverterInputStream);
	converter.init(forceFileStream, "UTF-8", -1, 0);
	/*
	 * Parameters
	 * 
	 * aStream The source stream which is read and converted. aCharset The
	 * character encoding to use for converting the bytes of the stream. A value
	 * of null or "UTF-8" equals UTF-8 encoding. Latin 1 is specified as
	 * "ISO-8859-1". aBufferSize Defines the buffer size of the converter
	 * stream. In case of a buffer size of less than or equal to 0, the default
	 * size CONVERTER_BUFFER_SIZE will be used. This is currently set to 8192
	 * bytes. aReplacementChar Any unknown byte sequence will be replaced with
	 * this character. The default replacement character is U+FFFD. A value of
	 * 0x0000 will cause an exception to be thrown if unknown byte sequences are
	 * encountered in the stream.
	 */

	return converter;
}

function removeMAIL_LIST(key, actualMsgHdrDb) {
	// Removing marker
	log("--------------------------- Removed from MAIL LIST ----------------------------");
	log("REMOVED MESSAGE:    " + MAIL_LIST[key].subject);

	if (actualMsgHdrDb == undefined) {
		MAIL_LIST[key].subject += " [Answered by manually]";
	} else {
		MAIL_LIST[key].subject += " [Answered by\"" + actualMsgHdrDb.subject
				+ "]";
	}
	log("REPLACED SUBJECT:   " + MAIL_LIST[key].subject);

	MAIL_LIST[key].folder.msgDatabase = null;

	// Removing from list
	delete MAIL_LIST[key];
	delete SEND_INTR[key];

	return delMAIL_LIST(key);
}

function delMAIL_LIST(messageId) {
	var data = "";
	var list = readTextFile(FORCELIST);
	list.QueryInterface(Components.interfaces.nsIUnicharLineInputStream);

	if (list instanceof Components.interfaces.nsIUnicharLineInputStream) {
		var line = {};
		var cont;
		do {
			cont = list.readLine(line);
			/*
			 * messageId,subject,SEND_INTR[actualMsgHdrDb.messageId]
			 */
			// if (line.value.indexOf("#") == 0) {
			// continue;
			// }
			if (line.value.indexOf(messageId) == 0) {
				continue;
			}
			data += line.value + "\n";
		} while (cont);
	}
	list.close();
	list = overwriteTextFile(FORCELIST);
	list.writeString(data);
	list.close();
	return !checkMAIL_LIST(messageId);
}

function addToMAIL_LIST(actualMsgHdrDb) {
	log("------------------------------- Adding to MAIL_LIST ----------------------------");
	log("SUBJECT\t" + actualMsgHdrDb.subject + " ("
			+ actualMsgHdrDb.getStringProperty("x-forcebutton").split(",")[0]
			+ "h)");
	if (MAIL_LIST[actualMsgHdrDb.messageId] == undefined) {
		actualMsgHdrDb.date = new Date().getTime() * 1000000;
		MAIL_LIST[actualMsgHdrDb.messageId] = actualMsgHdrDb;
		SEND_INTR[actualMsgHdrDb.messageId] = actualMsgHdrDb.getStringProperty(
				"x-forcebutton").split(",")[0];

		var list = initTextFile(FORCELIST);
		/*
		 * messageId,subject,SEND_INTR[actualMsgHdrDb.messageId]
		 */
		list.writeString(actualMsgHdrDb.messageId + ","
				+ actualMsgHdrDb.subject + ","
				+ SEND_INTR[actualMsgHdrDb.messageId] + "\n");
		list.close();
	}
	return true;
}

function SendMailNow(aMsgDBHdr) {
	var aMsgURI = aMsgDBHdr.folder.getUriForMsg(aMsgDBHdr);

	var msgWindow = Components.classes["@mozilla.org/messenger/msgwindow;1"]
			.createInstance();
	msgWindow = msgWindow.QueryInterface(Components.interfaces.nsIMsgWindow);

	var msgStream = Components.classes["@mozilla.org/network/sync-stream-listener;1"]
			.createInstance();
	msgStream = msgStream.QueryInterface(Components.interfaces.nsIInputStream);

	var aMsgService = messenger.messageServiceFromURI(aMsgURI);

	var scriptInputStream = Components.classes["@mozilla.org/scriptableinputstream;1"]
			.createInstance();
	scriptInputStream = scriptInputStream
			.QueryInterface(Components.interfaces.nsIScriptableInputStream);

	scriptInputStream.init(msgStream);

	try {
		aMsgService.streamMessage(aMsgURI, // uri of message to stream
		msgStream, // a stream listener listening to the message
		msgWindow, // a nsIMsgWindow for progress and status feedback
		null, // a nsIUrlListener that is notified when url starts and stops
		false, // it will create a stream converter from message rfc2822 to
		null // Header added to the URI. e.g., header=filter
		);
	} catch (ex) {
	}

	// Creating content
	var content = "";
	while (scriptInputStream.available()) {
		content = content + scriptInputStream.read(512);
		if (content.match(/\r\n\r\n/) || content.match(/\n\n/)) {
			if (sendMail(content, aMsgDBHdr.messageId)) {
				log("SEND_DONE\t" + aMsgDBHdr.messageId + "\t"
						+ aMsgDBHdr.subject);
			} else {
				log("SEND_FAILED\t" + aMsgDBHdr.messageId + "\t"
						+ aMsgDBHdr.subject);
			}
			log("-------------------------------------------------------------------------------");
		}
	}
}

function sendMail(content, msgid) {
	// Modify "Date:" in message body and db
	content = content.replace(/^Date:.*$/m, "Date: "
			+ FormatDateTime(new Date(), true) + "");
	var now = new Date().getTime();
	MAIL_LIST[msgid].date = now * 1000000;

	// Remove marker;
	log("\tmarker\t\tremoved");
	content = content.replace(/X-Forcebutton:.*(\r\n|\n|\r)/gm, "");
	// log(content);
	var to = content.match(/^To: .*$/m).toString().split(": ")[1];
	var from = content.match(/^From: .*$/m).toString().split(": ")[1];

	// Save mail.eml to temp folder
	var dirService = Components.classes["@mozilla.org/file/directory_service;1"]
			.getService(Components.interfaces.nsIProperties);

	var tempDir = dirService.get("TmpD", Components.interfaces.nsIFile);
	tempDir.append(msgid + ".eml");

	var sfile = Components.classes["@mozilla.org/file/local;1"]
			.createInstance(Components.interfaces.nsILocalFile);
	sfile.initWithPath(tempDir.path);
	log("\tfile written\t" + tempDir.path);
	try {
		if (sfile.exists())
			sfile.remove(true);
	} catch (ex) {
		window.alert("Cannot remove " + tempDir.path + "!" + ex);
	}
	sfile.create(sfile.NORMAL_FILE_TYPE, parseInt("0600", 8));

	var stream = Components.classes['@mozilla.org/network/file-output-stream;1']
			.createInstance(Components.interfaces.nsIFileOutputStream);

	stream.init(sfile, 2, 0x200, false); // open as "write only"
	stream.write(content, content.length);
	stream.close();

	// Set listener
	var listener = new CopyRecurListener(fld);

	var copyService = Components.classes["@mozilla.org/messenger/messagecopyservice;1"]
			.getService(Components.interfaces.nsIMsgCopyService);
	var AM = Components.classes["@mozilla.org/messenger/account-manager;1"]
			.getService(Components.interfaces.nsIMsgAccountManager);

	var cf = Components.classes["@mozilla.org/messengercompose/composefields;1"]
			.createInstance(Components.interfaces.nsIMsgCompFields);
	cf.to = to;
	cf.replyTo = from;

	var nfile = Components.classes["@mozilla.org/file/directory_service;1"]
			.getService(Components.interfaces.nsIProperties).get("TmpD",
					Components.interfaces.nsIFile);

	nfile.append(msgid + ".eml");
	nfile.normalize();
	// file is nsIFile
	var ios = Components.classes["@mozilla.org/network/io-service;1"]
			.getService(Components.interfaces.nsIIOService);
	var URL = ios.newFileURI(nfile);
	var file = URL.QueryInterface(Components.interfaces.nsIFileURL).nfile;
	var acctMgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
			.getService(Components.interfaces.nsIMsgAccountManager);

	var accounts = acctMgr.accounts;
	log("\tsearching\t" + from);

	for ( var i = 0; i < accounts.length; i++) {
		// try {
		// var tmp =
		// accounts.queryElementAt(i,Components.interfaces.nsIMsgAccount)
		// if ( tmp == null ) {
		// log("nsIMsgAccount is null");
		// break;
		// }
		// //tmp.init();
		// aCurrentIdentity = tmp.defaultIdentity;
		// if ( aCurrentIdentity == null ) {
		// log(" aCurrentIdentity is null");
		// log("identities " + tmp.identities);
		// log("identity 0 " + tmp.identities.ElementAt(0));
		// //log("identity 1 " + tmp.identities.ElementAt(1));
		// //log("identity 2 " + tmp.identities.ElementAt(2));
		// log("incomingServer " + tmp.incomingServer);
		// log("key " + tmp.key);
		// log("defaultIdentity " + tmp.defaultIdentity);
		//				
		// break;
		// } else {
		// log("identities " + tmp.identities);
		// log("identity 0 " + tmp.identities.ElementAt(0));
		//				
		// log("incomingServer " + tmp.incomingServer);
		// log("key " + tmp.key);
		// log("defaultIdentity " + tmp.defaultIdentity);
		// }
		//			
		//			
		// } catch (ex) {
		// log("EXCEPTION: identity not found!");
		// continue;
		// }
		var account;
		try {
			account = accounts.queryElementAt(i,
					Components.interfaces.nsIMsgAccount);
		} catch (ex) {
			log("ACCOUNT EXCEPTION: " + ex);
			continue;
		}
		//log("\taccount\t\t#" + i + "(" + account.key + ")");
		var identities = account.identities;
		for ( var j = 0; j < identities.length; j++) {
			aCurrentIdentity = identities.queryElementAt(j,
					Components.interfaces.nsIMsgIdentity);
			log("\tidentity\t#" + j + "(" + aCurrentIdentity.fullName + " <"
					+ aCurrentIdentity.email + ">)");
			if (aCurrentIdentity == null) {
				continue;
			}
			if (aCurrentIdentity.email.indexOf(from) != -1
					|| from.indexOf(aCurrentIdentity.email) != -1) {
				log("\tsmtp_user\t" + aCurrentIdentity.identityName + " via "
						+ aCurrentIdentity.smtpServerKey);
				if (aCurrentIdentity.smtpServerKey != null) {
					cf.from = from;
					i = accounts.length;
					break;
				} else {
					continue;
				}
			} else if (i == accounts.length - 1) {
				log("SENDING ERROR: No smtp for " + from
						+ " using last account smtp (" + aCurrentIdentity.email
						+ ").");
				continue;
			}
		}

		// else if ( aCurrentIdentity.smtpServerKey != null ) {
		// Else sending with the last identity with smtp definied
		// cf.from = from;
		// log("ELSE MAIL " + aCurrentIdentity.identityName + " VIA " +
		// aCurrentIdentity.smtpServerKey + " WITH " + cf.from);
		// cf.from = aCurrentIdentity.identityName;
		// break;
		// } else {
		// }
		// if ( i == accounts.length - 1 ) {
		// log("SENDING ERROR: No smtp for " + from + " using last account smtp
		// (" + aCurrentIdentity.email + ").");
		// }
	}
	if (aCurrentIdentity == null) {
		log(" aCurrentIdentity is null");
		return false;
	}

	log("\tfromto\t\t" + cf.from + " >----> " + cf.to);
	log("\tdetails\t\t" + aCurrentIdentity.smtpServerKey + ","
			+ aCurrentIdentity.key + "," + accounts.length);

	var msgSend = Components.classes["@mozilla.org/messengercompose/send;1"]
			.createInstance(Components.interfaces.nsIMsgSend);
	LoadIdentity(true);

	try {
		msgSend.sendMessageFile(aCurrentIdentity, // in nsIMsgIdentity
		// aUserIdentity,
		aCurrentIdentity.key, // char* accountKey,
		cf, // in nsIMsgCompFields fields,
		nfile, // in nsIFile sendIFile,
		true, // in PRBool deleteSendFileOnCompletion,
		false, // in PRBool digest_p,
		msgSend.nsMsgDeliverNow, // in nsMsgDeliverMode mode,
		null, // in nsIMsgDBHdr msgToReplace,
		window.msgSendListener, // in nsIMsgSendListener aListener,
		window.MsgStatusFeedback, // in nsIMsgStatusFeedback aStatusFeedback,
		null // in string password
		);
		return true;
	} catch (ex) {
		log("SENDING ERROR: Unhandled exception:" + ex);
		window.alert(ex);
		return false;
	}
}

function LoadIdentity(startup) {
	aAccountManager = Components.classes["@mozilla.org/messenger/account-manager;1"]
			.getService(Components.interfaces.nsIMsgAccountManager);
	var identityElement = document.getElementById("msgIdentity");
	var prevIdentity = aCurrentIdentity;

	if (identityElement) {
		var idKey = identityElement.value;
		aCurrentIdentity = aAccountManager.getIdentity(idKey);

		// set the account name on the menu list value.
		var accountName = identityElement.selectedItem
				.getAttribute('accountname');
		identityElement.setAttribute('accountname', accountName);

		if (!startup && prevIdentity && idKey != prevIdentity.key) {
			var prefstring = "mail.identity." + prevIdentity.key;
			RemoveDirectoryServerObserver(prefstring);
		}

		AddDirectoryServerObserver(false);
		if (!startup) {
			if (getPref("mail.autoComplete.highlightNonMatches"))
				document.getElementById('addressCol2#1').highlightNonMatches = true;

			try {
				setupLdapAutocompleteSession();
			} catch (ex) {
				// catch the exception and ignore it, so that if LDAP setup
				// fails, the entire compose window doesn't end up horked
			}
		}
	}
}

function CopyRecurListener(folder) {
	this._folder = folder;
}

function initMAIL_LIST() {
	MAIL_LIST = new Array();
	SEND_INTR = new Array();

	var forcelist;
	forcelist = overwriteTextFile(FORCELIST);
	forcelist
			.writeString("#messageId,subject,SEND_INTR[actualMsgHdrDb.messageId]\n");
	log("MAIL_LIST initalized");
}

function initFolders() {

	var accountManager = Components.classes["@mozilla.org/messenger/account-manager;1"]
			.getService(Components.interfaces.nsIMsgAccountManager);
	var fdrlocal = accountManager.localFoldersServer.rootFolder;

	// Looking at local folders
	ProcessThisFolder(fdrlocal);

	// Looking at renmote folders
	var allaccounts = accountManager.accounts;
	var thisaccount;

	if (allaccounts.queryElementAt) {
		// Gecko 17+
		for ( var i = 0; i < allaccounts.length; i++) {
			thisaccount = allaccounts.queryElementAt(i,
					Components.interfaces.nsIMsgAccount);
			thisaccount = thisaccount
					.QueryInterface(Components.interfaces.nsIMsgAccount);
			switch (thisaccount.incomingServer.type) {
			case "pop3":
			case "imap":
				var folder = thisaccount.incomingServer.rootFolder;
				sentFolder.push(thisaccount.defaultIdentity.fccFolder);
				log("SENT FOLDER(" + sentFolder.length + ") PUSHED "
						+ thisaccount.defaultIdentity.fccFolder);
				ProcessThisFolder(folder);
				break;
			default:
				log("MAIL ACCOUNT SKIPPED[" + thisaccount.incomingServer.type
						+ "]: " + thisaccount);
				break;
			}
		}
	} else {
		// Gecko < 17
		for ( var i = 0; i < allaccounts.length; i++) {
			thisaccount = allaccounts.queryElementAt(i,
					Components.interfaces.nsIMsgAccount);
			thisaccount = thisaccount
					.QueryInterface(Components.interfaces.nsIMsgAccount);
			switch (thisaccount.incomingServer.type) {
			case "pop3":
			case "imap":
				var folder = thisaccount.incomingServer.rootFolder;
				sentFolder.push(thisaccount.defaultIdentity.fccFolder);
				log("SENT FOLDER(" + sentFolder.length + ") PUSHED "
						+ thisaccount.defaultIdentity.fccFolder);
				ProcessThisFolder(folder);
				break;
			default:
				log("MAIL ACCOUNT SKIPPED[" + thisaccount.incomingServer.type
						+ "]: " + thisaccount);
				break;
			}
		}
	}

}

function ProcessThisFolder(folder) {

	// Folders not to check if monitor or not
	// TODO: get exclude folders from config window
	if (folder.URI.indexOf("Junk") != -1)
		return;
	if (folder.URI.indexOf("Trash") != -1)
		return;

	// Recursive check
	if (folder.hasSubFolders) {
		var subFolders = folder.subFolders;
		while (subFolders.hasMoreElements()) {
			var aSubFolder = subFolders.getNext().QueryInterface(
					Components.interfaces.nsIMsgFolder);
			ProcessThisFolder(aSubFolder);
		}
	}

	// Checking final folder
	log("CHECKING FOLDER: " + folder.URI);
	// ??? why do query?
	var thisfolder = folder.QueryInterface(Components.interfaces.nsIMsgFolder);
	var messageenumerator = null;

	try {
		messageenumerator = thisfolder.messages;
		while (messageenumerator.hasMoreElements()) {
			var aMsgHdrDb = messageenumerator.getNext().QueryInterface(
					Components.interfaces.nsIMsgDBHdr);
			// Process mails
			ProcessThisMail(aMsgHdrDb);
		}
	} catch (e) {
		log("MONITORING EXCEPTION: " + thisfolder.URI);// log(e);
	}
}

function ProcessThisMail(actualMsgHdrDb) {
	var sent = false;

	for ( var i = 0; i < sentFolder.length; i++) {
		if (actualMsgHdrDb.folder.URI == sentFolder[i]) {
			sent = true;
			break;
		}
	}

	// Compatible with v0.X.X
	// This is a valid forceuuid in references

	// if ( uuid.indexOf("forcebutton.v0") != -1 ) {
	if (sent) {
		/*
		 * actual marker is [Forced!] in the Subject
		 */
		if (actualMsgHdrDb.subject.indexOf("Answered") == -1
				&& actualMsgHdrDb.getStringProperty("x-forcebutton") != "") {
			// This mail is in the "Sent" folder and FORCED
			if (addToMAIL_LIST(actualMsgHdrDb)) {
				log("-------------------------------- Adding DONE! ------------------------------");
			} else {
				log("------------------------------- Adding FAILED! -----------------------------");
			}

		}
	} else {
		// This mail is in the INBOX folder
		var answer = false;
		for ( var key in MAIL_LIST) {
			// log("------------- " + actualMsgHdrDb.subject + " vs. "
			// + MAIL_LIST[key].subject + " -------------");
			var vote = 0;

			// TODO: this is not enought criteria for the answer mail
			/*
			 * if (actualMsgHdrDb.subject.indexOf(":") != -1 &&
			 * actualMsgHdrDb.subject.split(":")[1].indexOf(MAIL_LIST[key].subject) !=
			 * -1) {
			 */
			if (actualMsgHdrDb.subject != undefined
					&& MAIL_LIST[key].subject.indexOf(actualMsgHdrDb.subject) != -1
					&& actualMsgHdrDb.subject.length > 0) {
				// log("------------- subject match ");
				// log(MAIL_LIST[key].subject + " == " +
				// actualMsgHdrDb.subject);
				vote++;
			}

			if (actualMsgHdrDb.messageSize > MAIL_LIST[key].messageSize) {
				// log("------------- messageSize match ");
				// log(actualMsgHdrDb.messageSize + " > "
				// + MAIL_LIST[key].messageSize);
				vote++;
			}

			if (actualMsgHdrDb.lineCount > MAIL_LIST[key].lineCount) {
				// log("------------- lineCount match ");
				// log(actualMsgHdrDb.lineCount + " > "
				// + MAIL_LIST[key].lineCount);
				vote++;
			}

			if (actualMsgHdrDb.dateInSeconds > MAIL_LIST[key].dateInSeconds) {
				// log("------------- dateInSeconds match ");
				// log(actualMsgHdrDb.dateInSeconds + " > "
				// + MAIL_LIST[key].dateInSeconds);
				vote++;
			}

			if (actualMsgHdrDb.author.indexOf(MAIL_LIST[key].recipients) != -1) {
				// log("------------- author match ");
				// log(actualMsgHdrDb.author + " == "
				// + MAIL_LIST[key].recipients);
				vote++;
			}

			// test if this is an answer
			// log("------------- vote: " + vote + " with \""
			// + actualMsgHdrDb.subject + "\"-------------");
			if (vote > 3) {
				// log("VOTE: " + vote);
				if (removeMAIL_LIST(key, actualMsgHdrDb)) {
					log("------------------------------- Remove DONE! -----------------------------");
				} else {
					log("------------------------------ Remove FAILED! ----------------------------");
				}

				break;
			}
		}
	}
	return;
}

var folderLoadListener = {
	OnItemEvent : function(folder, event) {
		// Folders not to check if monitor or not
		// if ( folder.URI.indexOf("Sent") != -1 ) return;
		if (folder.URI.indexOf("Junk") != -1)
			return;

		// Recursive check
		if (folder.hasSubFolders) {
			var subFolders = folder.subFolders;
			while (subFolders.hasMoreElements()) {
				var aSubFolder = subFolders.getNext().QueryInterface(
						Components.interfaces.nsIMsgFolder);
				folderLoadListener.OnItemEvent(aSubFolder);
			}
		}

		// Checking folder
		log("CHECKING FOLDER: " + folder.URI);
		var thisfolder = folder
				.QueryInterface(Components.interfaces.nsIMsgFolder);
		var messageenumerator = null;

		try {
			messageenumerator = thisfolder.messages;
		} catch (e) {
			log("MONITORING EXCEPTION: " + thisfolder.URI);
			log(e);
		}

		if (messageenumerator) {
			while (messageenumerator.hasMoreElements()) {
				var aMsgHdrDb = messageenumerator.getNext().QueryInterface(
						Components.interfaces.nsIMsgDBHdr);
				ProcessThisMail(aMsgHdrDb);
			}
		}
	}
};

var newMailListener = {
	msgAdded : function(aMsgHdr) {
		ProcessThisMail(aMsgHdr);
	}
}

function initWatchMailListener() {
	var notificationService = Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]
			.getService(Components.interfaces.nsIMsgFolderNotificationService);
	notificationService.addListener(newMailListener,
			notificationService.msgAdded);

	log("NewMail event listener has been registered!");
}

function initOnLoadListener() {
	window.addEventListener("load", function() {
		onLoad();
	}, false);

	log("OnLoad event listener has been registered!");
}

function initFolderLoadListener() {
	var mailSession = Components.classes["@mozilla.org/messenger/services/session;1"]
			.getService(Components.interfaces.nsIMsgMailSession);
	mailSession.AddFolderListener(folderLoadListener,
			Components.interfaces.nsIFolderListener.event);

	log("FolderLoad event listener has been registered!");
}

function initDaemon() {
	if (DAEMON != undefined) {
		clearTimeout(DAEMON);
	}
	log("Daemon has been initalized with " + (FREQ_TIME * 60000) + " ms!");
	DAEMON = setTimeout('daemonThread()', FREQ_TIME * 60000);
}

function checkMAIL_LIST(messageId) {
	var list = readTextFile(FORCELIST);
	list.QueryInterface(Components.interfaces.nsIUnicharLineInputStream);

	if (list instanceof Components.interfaces.nsIUnicharLineInputStream) {
		var line = {};
		var cont;
		do {
			cont = list.readLine(line);
			/*
			 * messageId,subject,SEND_INTR[actualMsgHdrDb.messageId]
			 */
			if (line.value.indexOf("#") == 0) {
				continue;
			}
			if (line.value.indexOf(messageId) == 0) {
				return true;
			}

		} while (cont);
	}
	list.close();

	return false;
}

function resendMAIL_LIST(messageId) {
	var list = readTextFile(FORCELIST);
	list.QueryInterface(Components.interfaces.nsIUnicharLineInputStream);

	if (list instanceof Components.interfaces.nsIUnicharLineInputStream) {
		var line = {};
		var cont;
		do {
			cont = list.readLine(line);
			/*
			 * messageId,subject,SEND_INTR[actualMsgHdrDb.messageId]
			 */
			if (line.value.indexOf("#") == 0) {
				continue;
			}
			if (line.value.indexOf(messageId) == 0) {
				return line.value.split(",")[2];
			}

		} while (cont);
		list.close();
	}
	return SEND_DEF;
}

function FormatDateTime(thisdate, includeTZ) {
	var s = "";
	var sDaysOfWeek = [ "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat" ];
	var sMonths = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug",
			"Sep", "Oct", "Nov", "Dec" ];

	var offset = thisdate.getTimezoneOffset();
	s += sDaysOfWeek[thisdate.getDay()];
	s += ", ";
	s += thisdate.getDate();
	s += " ";
	s += sMonths[thisdate.getMonth()];
	s += " ";
	s += (thisdate.getFullYear());
	s += " ";
	var val = thisdate.getHours();
	if (val < 10)
		s += "0";
	s += val;
	s += ":";
	val = thisdate.getMinutes();
	if (val < 10)
		s += "0";
	s += val;
	s += ":";
	val = thisdate.getSeconds();
	if (val < 10)
		s += "0";
	s += val;
	if (includeTZ) {
		s += " ";
		if (offset < 0) {
			offset *= -1;
			s += "+";
		} else
			s += "-";

		val = Math.floor(offset / 60);
		if (val < 10)
			s += "0";
		s += val;
		val = Math.floor(offset % 60);
		if (val < 10)
			s += "0";
		s += val;
	}
	return s;
}