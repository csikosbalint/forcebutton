"use strict";

function onLoad() {
    // Init to send list
    initToSendList();
    // Start daemon cycle
    DAEMON = setTimeout('daemonThread()');
}

function daemonThread() {
    log("--------------------------- Daemon cycle started ------------------------------");
    log( "Start time: " + new Date() + " Freq: " + FREQ_TIME/1000 + "(s) Resend: " + RESEND_TIME/1000 + "(s)");
    log("-------------------------------------------------------------------------------");

    // Check for mails to send 
    for ( var key in MAIL_LIST ) {
        var now = new Date().getTime();
        var old = now - ( MAIL_LIST[key].dateInSeconds * 1000 );
        // Send if the mail is older then resend time
        if ( old < RESEND_TIME ) {
            log("WAITING (" + (RESEND_TIME - old)/1000 + "s) " + MAIL_LIST[key].getStringReference(0).split("@")[0] + ":" + MAIL_LIST[key].subject );
        } else {
        	log("SENDING ( after " + RESEND_TIME /1000 + "s) " + MAIL_LIST[key].getStringReference(0).split("@")[0] + ":" + MAIL_LIST[key].subject );
            SendMailNow(MAIL_LIST[key]);
        }
    }
    log("-------------------------------------------------------------------------------");

    // Loop for infinity and beyond
    setTimeout('daemonThread()', FREQ_TIME);
}

function daemonConfirm() {
    var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                            .getService(Components.interfaces.nsIPromptService);
    if ( prompts.confirm(window, "ForceButton", "Should ForceButton initialize?") ) {
        return true;
    }
    return false;
}

function FormatDateTime(thisdate,includeTZ) {
    var s="";
    var sDaysOfWeek = [ "Sun","Mon","Tue","Wed","Thu","Fri","Sat" ];
    var sMonths= ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    var offset = thisdate.getTimezoneOffset();
    s += sDaysOfWeek[thisdate.getDay()];
    s += ", ";
    s += thisdate.getDate();
    s += " ";
    s += sMonths[thisdate.getMonth()];
    s += " ";
    s+=( thisdate.getFullYear());
    s += " ";
    var val = thisdate.getHours();
    if (val < 10)
    s += "0";
    s += val;
    s += ":";
    val = thisdate.getMinutes();
    if (val < 10)
    s += "0";
    s+= val;
    s += ":";
    val = thisdate.getSeconds();
    if (val < 10)
    s += "0";
    s+=val;
    if (includeTZ)
    {
        s += " ";
        if (offset < 0)
            {
            offset *= -1;
            s += "+";
            }
        else
            s += "-";

        val = Math.floor (offset / 60);
        if (val < 10)
            s += "0";
        s+=val;
        val = Math.floor (offset % 60);
        if (val < 10)
            s += "0";
        s+=val;
    }
    return s;
}


function log(string) {
    if ( ! DEBUG_MODE ) return;
    if ( LOGSTREAM == undefined ) LOGSTREAM = initTextFile(DAEMON_LOG);

    var currentTime = new Date();
    var month = currentTime.getMonth() + 1;
    var day = currentTime.getDate();
    var year = currentTime.getFullYear();
    var hours = currentTime.getHours();
    var minutes = currentTime.getMinutes();
    var seconds = currentTime.getSeconds();
    if (minutes < 10){
        minutes = "0" + minutes;
    }
    if (seconds < 10){
        seconds = "0" + seconds;
    }
    LOGSTREAM.writeString("[ " + month + "/" + day + "/" + year + " "
        + hours + ":" + minutes + ":" + seconds + " ] " + string + "\n");
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
        scriptInputStream = scriptInputStream.QueryInterface(Components.interfaces.nsIScriptableInputStream);

    scriptInputStream.init(msgStream);

    try {
        aMsgService.streamMessage(  aMsgURI,    // uri of message to stream 
                                    msgStream,  // a stream listener listening to the message
                                    msgWindow,  // a nsIMsgWindow for progress and status feedback
                                    null,       // a nsIUrlListener that is notified when url starts and stops
                                    false,      // it will create a stream converter from message rfc2822 to
                                    null        // Header added to the URI. e.g., header=filter
                                 );
    } catch (ex) {
    }

    // Creating content
    var content = "";
    while ( scriptInputStream.available() ) {
        content = content + scriptInputStream.read(512);
        if (content.match(/\r\n\r\n/) || content.match(/\n\n/)) {
            if ( sendMail(content, aMsgDBHdr.getStringReference(0).split("@")[0]) ) {
                    log("SENDING MESSAGE:   " + aMsgDBHdr.getStringReference(0).split("@")[0] + ":" + aMsgDBHdr.subject );
                } else {
                	log("SENDING FAILURE:   " + aMsgDBHdr.getStringReference(0).split("@")[0] + ":" + aMsgDBHdr.subject );
                }
        }
    }
}

function sendMail(content, hash) {
    // Modify "Date:" in message body
    content = content.replace(/^Date:.*$/m,"Date: "+ FormatDateTime(new Date(),true)+"");

    var to = content.match(/^To: .*$/m).toString().split(": ")[1];
    var from = content.match(/^From: .*$/m).toString().split(": ")[1];

    // Save mail.eml to temp folder
    var dirService = Components.classes["@mozilla.org/file/directory_service;1"]
                               .getService(Components.interfaces.nsIProperties);

    var tempDir = dirService.get("TmpD", Components.interfaces.nsIFile);
        tempDir.append( hash + ".eml");

    var sfile = Components.classes["@mozilla.org/file/local;1"]
                          .createInstance(Components.interfaces.nsILocalFile);
        sfile.initWithPath(tempDir.path);
        
    try {
        if (sfile.exists()) sfile.remove(true);
    } catch (ex) {
        window.alert("Cannot remove " + tempDir.path + "!" + ex);
    }
    sfile.create(sfile.NORMAL_FILE_TYPE, parseInt("0600", 8) );

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
                          .getService(Components.interfaces.nsIProperties)
                          .get("TmpD", Components.interfaces.nsIFile);

    nfile.append( hash + ".eml");
    nfile.normalize();
    // file is nsIFile
    var ios = Components.classes["@mozilla.org/network/io-service;1"]
                        .getService(Components.interfaces.nsIIOService);
    var URL = ios.newFileURI(nfile);
    var file = URL.QueryInterface(Components.interfaces.nsIFileURL).nfile;
    var acctMgr = Components.classes["@mozilla.org/messenger/account-manager;1"]
                            .getService(Components.interfaces.nsIMsgAccountManager);

    var accounts = acctMgr.accounts;

    for ( var i = 0; i < accounts.Count(); i++ ) {
        log("ACCOUNT " + i );
        try {
            aCurrentIdentity = accounts.QueryElementAt(i,
                                                       Components.interfaces.nsIMsgAccount
                                                      ).defaultIdentity;
        } catch(ex) {
        	log("EXCEPTION: identity not found!");
            continue;
        }
        if ( aCurrentIdentity == null ) {
            continue;
        }
        if ( aCurrentIdentity.identityName == from ) {
            log("SMTP MAIL " + aCurrentIdentity.identityName + " VIA " + aCurrentIdentity.smtpServerKey );
            if ( aCurrentIdentity.smtpServerKey != null ) {
                // TODO: get from MAIL_LIST 
                cf.from = from;
                break;
            } else {
                continue;
            }
        } else if ( i == accounts.Count() - 1 ) {
            log("SENDING ERROR: No smtp for " + from + " using last account smtp (" + aCurrentIdentity.email + ").");
            continue;
        } else {
            continue;
        }
        //else if ( aCurrentIdentity.smtpServerKey != null ) {
            // Else sending with the last identity with smtp definied
            //cf.from = from;
            //log("ELSE MAIL " + aCurrentIdentity.identityName + " VIA " + aCurrentIdentity.smtpServerKey + " WITH " + cf.from);
            // cf.from = aCurrentIdentity.identityName;
            //break;
        //} else {
        //}
        //if ( i == accounts.Count() - 1 ) {
        //    log("SENDING ERROR: No smtp for " + from + " using last account smtp (" + aCurrentIdentity.email + ").");
        //}
    }
    log("SENDING " + cf.from + " >----> " + cf.to);
    log("SENDING DETAILS: " + aCurrentIdentity.smtpServerKey + "," + aCurrentIdentity.key + "," + accounts.Count());

    var msgSend = Components.classes["@mozilla.org/messengercompose/send;1"]
                            .createInstance(Components.interfaces.nsIMsgSend);
    LoadIdentity(true);

    try {
        msgSend.sendMessageFile(
            aCurrentIdentity,               // in nsIMsgIdentity        aUserIdentity,
            aCurrentIdentity.key,           // char*                    accountKey,
            cf,                             // in nsIMsgCompFields      fields,
            nfile,                          // in nsIFile               sendIFile,
            true,                           // in PRBool                deleteSendFileOnCompletion,
            false,                          // in PRBool                digest_p,
            msgSend.nsMsgDeliverNow,        // in nsMsgDeliverMode      mode,
            null,                           // in nsIMsgDBHdr           msgToReplace,
            window.msgSendListener,         // in nsIMsgSendListener    aListener,
            window.MsgStatusFeedback,       // in nsIMsgStatusFeedback  aStatusFeedback,
            null                            // in string                password
        );
        return true;
    } catch(ex) {
        log("SENDING ERROR: Unhandled exception:" + ex);
        window.alert(ex);
        return false;
    }
}


function LoadIdentity(startup)
{  
    aAccountManager = Components.classes["@mozilla.org/messenger/account-manager;1"]
                                .getService(Components.interfaces.nsIMsgAccountManager);
    var identityElement = document.getElementById("msgIdentity");
    var prevIdentity = aCurrentIdentity;
    
    if (identityElement) {
        var idKey = identityElement.value;
        aCurrentIdentity = aAccountManager.getIdentity(idKey);

        // set the  account name on the menu list value.
        var accountName = identityElement.selectedItem.getAttribute('accountname');
        identityElement.setAttribute('accountname', accountName);

        if (!startup && prevIdentity && idKey != prevIdentity.key)
        {
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

function initToSendList() {

    var accountManager = Components.classes["@mozilla.org/messenger/account-manager;1"]
                                   .getService(Components.interfaces.nsIMsgAccountManager);
    var fdrlocal = accountManager.localFoldersServer.rootFolder;

    // Looking at local folders 
    ProcessThisFolder(fdrlocal);

    // Looking at renmote folders
    var allaccounts = accountManager.accounts;
    var acindex;

    for (acindex = 0;acindex < allaccounts.Count();acindex++) {
        var thisaccount = allaccounts.GetElementAt(acindex);
        if (thisaccount) {
            thisaccount = thisaccount.QueryInterface(Components.interfaces.nsIMsgAccount);
            switch (thisaccount.incomingServer.type) {
                case "pop3":
                case "imap":
                    var folder = thisaccount.incomingServer.rootFolder;
                    sentFolder.push( thisaccount.defaultIdentity.fccFolder);
                    log("SENT FOLDER(" + sentFolder.length + ") PUSHED " + thisaccount.defaultIdentity.fccFolder);
                    ProcessThisFolder(folder);
                    break;
                default:
                    log("MAIL ACCOUNT SKIPPED[" + thisaccount.incomingServer.type + "]: " + thisaccount);
                    break;
            }
        }
    }
}

function ProcessThisFolder(folder) {

        // Folders not to check if monitor or not
		// TODO: get exclude folders from config window
        if ( folder.URI.indexOf("Junk") != -1 ) return;
        if ( folder.URI.indexOf("Trash") != -1 ) return;
        // Recursive check
        if ( folder.hasSubFolders ) {
            var subFolders = folder.subFolders;
            while ( subFolders.hasMoreElements() ) {
                var aSubFolder = subFolders.getNext().QueryInterface(Components.interfaces.nsIMsgFolder);
                ProcessThisFolder(aSubFolder);
            }
        }

        // Checking final folder
        log("CHECKING FOLDER: " + folder.URI);
        // ??? why do query?
        var thisfolder = folder.QueryInterface(Components.interfaces.nsIMsgFolder);
        var messageenumerator=null;

        try {
            messageenumerator = thisfolder.messages;
        } catch (e) {
            log("MONITORING EXCEPTION: " + thisfolder.URI );// log(e);
        }

        if ( messageenumerator ) {
            while ( messageenumerator.hasMoreElements() ) {
                var aMsgHdrDb = messageenumerator.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
                // Process mails
                ProcessThisMail(aMsgHdrDb);
            }
        }

}

function ProcessThisMail(actualMsgHdrDb) {
    var uuid;
    var thid;
    
    var sent = false;
    var trash = false;
    
    try {
        uuid = actualMsgHdrDb.getStringReference(0);
        thid = actualMsgHdrDb.threadId;
    } catch ( ex ) {
        return;
    }
    for ( var i = 0 ; i < sentFolder.length; i++ ) {
        if ( actualMsgHdrDb.folder.URI == sentFolder[i] ) {
            sent = true;
            break;
        }
    }

    // Compatible with v0.X.X
    if ( uuid.indexOf("forcebutton.v0") != -1 ) {
        // This is a valid forceuuid in references
        if ( sent ) {
            // This mail is in the "Sent" folder
            log("---------------------------- Updating in MAIL LIST ----------------------------");
            log("MESSAGE(Thread:" +  actualMsgHdrDb.threadId + "): " + uuid + ":" + actualMsgHdrDb.subject);
            if ( MAIL_LIST[uuid] != undefined ) {
                log("MESSAGE TIMEMOD: " + MAIL_LIST[uuid].dateInSeconds + " TO " + actualMsgHdrDb.dateInSeconds + " (ms)");
            }
            MAIL_LIST[uuid] = actualMsgHdrDb;
            return;
        } else {
            // This mail is in the INBOX folder
            if ( MAIL_LIST[uuid] == undefined ) {
                // This is a new forceuuid in INBOX folder
                log("--------------------------------- Warning -------------------------------------");
                log("WARNING MESSAGE: it is impossible to have an answered forceuuid mail!");
                log("WARNING UUID:    " + uuid);
                log("WARNING THREADID " + actualMsgHdrDb.threadId);
                log("WARNING SUBJECT: " + actualMsgHdrDb.subject);
                return;
            } else {
                // This is an answered mail in INBOX folder
                log("--------------------------- Removed from MAIL LIST ----------------------------");
                log("REMOVED UUID:    " + uuid );
                log("REMOVED THREADID " + MAIL_LIST[uuid].threadId);
                log("REMOVED SUBJECT: " + MAIL_LIST[uuid].subject);
                //MAIL_LIST[uuid].
                delete MAIL_LIST[uuid];
                return
            }
        }
    } else {
        // This is an invalid forceuuid in references
        return;
    }
}

var folderLoadListener =
    {
    OnItemEvent: function(folder, event) {
        // Folders not to check if monitor or not
        //if ( folder.URI.indexOf("Sent") != -1 ) return;
        if ( folder.URI.indexOf("Junk") != -1 ) return;

        // Recursive check
        if ( folder.hasSubFolders ) {
            var subFolders = folder.subFolders;
            while ( subFolders.hasMoreElements() ) {
                var aSubFolder = subFolders.getNext().QueryInterface(Components.interfaces.nsIMsgFolder);
                folderLoadListener.OnItemEvent(aSubFolder);
            }
        }

        // Checking folder
        log("CHECKING FOLDER: " + folder.URI);
        var thisfolder = folder.QueryInterface(Components.interfaces.nsIMsgFolder);
        var messageenumerator=null;

        try {
            messageenumerator = thisfolder.messages;
        } catch (e) {
            log("MONITORING EXCEPTION: " + thisfolder.URI ); log(e);
        }

        if ( messageenumerator ) {
            while ( messageenumerator.hasMoreElements() ) {
                var aMsgHdrDb = messageenumerator.getNext().QueryInterface(Components.interfaces.nsIMsgDBHdr);
                ProcessThisMail(aMsgHdrDb);
            }
        }
    }
};

var newMailListener = {
    msgAdded: function(aMsgHdr) {
        try {
            var uuid = aMsgHdr.getStringReference(0);
            if ( uuid.indexOf("forcebutton.v0") != -1 ) {
                log("------------------------------ NewMail event ----------------------------------");
                log("MESSAGE SUBJECT: " + uuid.split("@")[0] + ":" + aMsgHdr.subject);
                ProcessThisMail(aMsgHdr);
            } else {
                return;
            }
        } catch ( ex ) {
            return;
        }
        log("-------------------------------------------------------------------------------");
    }
}

function initWatchMailListener() {
    var notificationService = Components.classes["@mozilla.org/messenger/msgnotificationservice;1"]
                                        .getService(Components.interfaces.nsIMsgFolderNotificationService);
        notificationService.addListener(newMailListener, notificationService.msgAdded);

    log("NewMail event listener has been registered!");
}

function initOnLoadListener() {
    window.addEventListener("load", function () { onLoad(); }, false);

    log("OnLoad event listener has been registered!");
}

function initFolderLoadListener() {
    var mailSession = Components.classes["@mozilla.org/messenger/services/session;1"]
                                .getService(Components.interfaces.nsIMsgMailSession);
    mailSession.AddFolderListener(folderLoadListener,Components.interfaces.nsIFolderListener.event);

    log("FolderLoad event listener has been registered!");
}
