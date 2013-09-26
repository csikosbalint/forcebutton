"use strict";

function onLoad() {
	// Init to send list
	initMAIL_LIST();
	// Init sent folders
	initFolders();
	// Start daemon cycle
	DAEMON = setTimeout('daemonThread()');

}

function daemonThread() {
	if ( FIRST ) {
		FIRST = false;
		for ( var key in MAIL_LIST) {
			MAIL_LIST[key].date = new Date().getTime();
		}
		setTimeout('daemonThread()', FREQ_TIME);
		return;
	}
	
	log("--------------------------- Daemon cycle started ------------------------------");
	log("Start time: " + new Date() + " Repeate freq: " + (FREQ_TIME / 60000)
			+ "(m)");
	log("-------------------------------------------------------------------------------");

	// Check for mails to send
	for ( var key in MAIL_LIST) {
		if (checkMAIL_LIST(MAIL_LIST[key].messageId)) { /*
														 * TRUE if mail in
														 * forcelist
														 */
			var now = new Date().getTime();	// seconds
			var old = now - (MAIL_LIST[key].date / 1000000 ); // seconds

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

			if (old < SEND_INTR[key] * 3600000/10) {
				log("(" + (SEND_INTR[key] * 3600000 - old) / 1000 + "s)\t"
						+ MAIL_LIST[key].messageId + "\t"
						+ MAIL_LIST[key].subject);
			} else {
				log("SEND_START\t" + MAIL_LIST[key].messageId + "\t"
						+ MAIL_LIST[key].subject);
				SendMailNow(MAIL_LIST[key]);
			}
		} else {

		}

	}
	log("------------------------------ Daemon cycle end -------------------------------");

	// Loop for infinity and beyond
	setTimeout('daemonThread()', FREQ_TIME);
}

function addToMAIL_LIST(actualMsgHdrDb) {
	log("------------------------------- Adding to MAIL_LIST ----------------------------");
	log("SUBJECT\t" + actualMsgHdrDb.subject + " ("
			+ actualMsgHdrDb.getStringProperty("x-forcebutton") + "h)");
	if (MAIL_LIST[actualMsgHdrDb.messageId] == undefined) {
		actualMsgHdrDb.date = new Date().getTime() * 1000000;
		MAIL_LIST[actualMsgHdrDb.messageId] = actualMsgHdrDb;
		SEND_INTR[actualMsgHdrDb.messageId] = actualMsgHdrDb
				.getStringProperty("x-forcebutton");

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

function removeMAIL_LIST(key, actualMsgHdrDb) {
	// Removing marker
	log("--------------------------- Removed from MAIL LIST ----------------------------");
	log("REMOVED MESSAGE:    " + MAIL_LIST[key].subject);

	MAIL_LIST[key].subject += " [Answered by\"" + actualMsgHdrDb.subject + "\"]";
	log("REPLACED SUBJECT:   " + MAIL_LIST[key].subject);
	
	MAIL_LIST[key].folder.msgDatabase = null;

	// Removing from list
	delete MAIL_LIST[key];
	delete SEND_INTR[key];

	return delMAIL_LIST(key);
}

function daemonConfirm() {
	var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
			.getService(Components.interfaces.nsIPromptService);
	if (prompts
			.confirm(window, "ForceButton", "Should ForceButton initialize?")) {
		return true;
	}
	return false;
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
	//log(content);
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

	for ( var i = 0; i < accounts.Count(); i++) {
		log("\taccount\t\t#" + i);
		try {
			aCurrentIdentity = accounts.QueryElementAt(i,
					Components.interfaces.nsIMsgAccount).defaultIdentity;
		} catch (ex) {
			log("EXCEPTION: identity not found!");
			continue;
		}
		if (aCurrentIdentity == null) {
			continue;
		}
		if (aCurrentIdentity.identityName == from) {
			log("\tsmtp_user\t" + aCurrentIdentity.identityName + " via "
					+ aCurrentIdentity.smtpServerKey);
			if (aCurrentIdentity.smtpServerKey != null) {
				// TODO: get from MAIL_LIST
				cf.from = from;
				break;
			} else {
				continue;
			}
		} else if (i == accounts.Count() - 1) {
			log("SENDING ERROR: No smtp for " + from
					+ " using last account smtp (" + aCurrentIdentity.email
					+ ").");
			continue;
		} else {
			continue;
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
		// if ( i == accounts.Count() - 1 ) {
		// log("SENDING ERROR: No smtp for " + from + " using last account smtp
		// (" + aCurrentIdentity.email + ").");
		// }
	}
	log("\tfromto\t\t" + cf.from + " >----> " + cf.to);
	log("\tdetails\t\t" + aCurrentIdentity.smtpServerKey + ","
			+ aCurrentIdentity.key + "," + accounts.Count());

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

	var forcelist = overwriteTextFile(FORCELIST);

	forcelist
			.writeString("#messageId,subject,SEND_INTR[actualMsgHdrDb.messageId]\n");
}

function initFolders() {

	var accountManager = Components.classes["@mozilla.org/messenger/account-manager;1"]
			.getService(Components.interfaces.nsIMsgAccountManager);
	var fdrlocal = accountManager.localFoldersServer.rootFolder;

	// Looking at local folders
	ProcessThisFolder(fdrlocal);

	// Looking at renmote folders
	var allaccounts = accountManager.accounts;
	var acindex;

	for (acindex = 0; acindex < allaccounts.Count(); acindex++) {
		var thisaccount = allaccounts.GetElementAt(acindex);
		if (thisaccount) {
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
	} catch (e) {
		log("MONITORING EXCEPTION: " + thisfolder.URI);// log(e);
	}

	if (messageenumerator) {
		while (messageenumerator.hasMoreElements()) {
			var aMsgHdrDb = messageenumerator.getNext().QueryInterface(
					Components.interfaces.nsIMsgDBHdr);
			// Process mails
			ProcessThisMail(aMsgHdrDb);
		}
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
			if (actualMsgHdrDb.subject != undefined && 
				MAIL_LIST[key].subject.indexOf(actualMsgHdrDb.subject) != -1 &&
				actualMsgHdrDb.subject.length > 0 ) {
//				 log("------------- subject match ");
//				 log(MAIL_LIST[key].subject + " == " + actualMsgHdrDb.subject);
				vote++;
			}

			if (actualMsgHdrDb.messageSize > MAIL_LIST[key].messageSize) {
//				 log("------------- messageSize match ");
//				 log(actualMsgHdrDb.messageSize + " > "
//				 + MAIL_LIST[key].messageSize);
				vote++;
			}

			if (actualMsgHdrDb.lineCount > MAIL_LIST[key].lineCount) {
//				 log("------------- lineCount match ");
//				 log(actualMsgHdrDb.lineCount + " > "
//				 + MAIL_LIST[key].lineCount);
				vote++;
			}

			if (actualMsgHdrDb.dateInSeconds > MAIL_LIST[key].dateInSeconds) {
//				 log("------------- dateInSeconds match ");
//				 log(actualMsgHdrDb.dateInSeconds + " > "
//				 + MAIL_LIST[key].dateInSeconds);
				vote++;
			}

			if (actualMsgHdrDb.author.indexOf(MAIL_LIST[key].recipients) != -1 ) {
//				 log("------------- author match ");
//				 log(actualMsgHdrDb.author + " == "
//				 + MAIL_LIST[key].recipients);
				vote++;
			}

			// test if this is an answer
//			 log("------------- vote: " + vote + " with \""
//			 + actualMsgHdrDb.subject + "\"-------------");
			if (vote > 3) {
//				log("VOTE: " + vote);
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
//			if (line.value.indexOf("#") == 0) {
//				continue;
//			}
			if (line.value.indexOf(messageId) == 0) {
				continue;
			}
			data += line.value;
		} while (cont);
	}
	list.close();
	list = overwriteTextFile(FORCELIST);
	list.writeString(data);
	list.close();
	return !checkMAIL_LIST(messageId);
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
