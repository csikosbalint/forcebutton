// GLOBAL VARIABLES
var FORCE_FLAG;
var major_version = 0;
var minor_version = 1.3;

// CONFIG VARIABLES
// TODO: Put these config props into pref.js
var PStext = "P.s.:";
var FORCEDIR = "forcebutton";
var FORCELIST = "forcedmails.lst";
//var REPTIME = 2 * 60 * 60 * 1000; 
var REPTIME = 2 * 60 * 1000;

function addListElement(hash, gMsgCompose) { // string, document.getElementById("msgSubject").value
    var list = initTextFile(FORCELIST);
    list.writeString( hash + "," + new Date().getTime() + "," + REPTIME + "," + new Date().getTime() + ",,," + gMsgCompose.compFields.subject  + "\n");
    list.close();
    MAIL_LIST = readMailList(FORCELIST);
    return true;
}

function confirmButton(title, message) {
    var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                            .getService(Components.interfaces.nsIPromptService);

    // Confirmation to set FORCE_FLAG on
    if ( prompts.confirm(window, title, message) ) {
        FORCE_FLAG = true;
    }
}

function initTextFile(filename) {
    var directory = Components.classes["@mozilla.org/file/directory_service;1"]
                              .getService(Components.interfaces.nsIProperties);

    // Build file for output stream into profile directory
    var profile = directory.get("ProfD", Components.interfaces.nsIFile);
        profile.append( FORCEDIR );
    var forceDir= profile;

    // Create forceDir if does not exists
    if( !forceDir.exists() || !forceDir.isDirectory() ) {
        forceDir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0750);
    }

    forceDir.append(filename);
    var file = forceDir;

    var outstream = Components.classes["@mozilla.org/network/file-output-stream;1"]
                              .createInstance(Components.interfaces.nsIFileOutputStream);
        outstream.init(file, 0x04 | 0x08 | 0x10, 0644, 0);

    var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
                              .createInstance(Components.interfaces.nsIConverterOutputStream);
        converter.init(outstream, "UTF-8", 0, 0);

    return converter;
}

function createUUID() {
    // http://www.ietf.org/rfc/rfc4122.txt
    var s = [];
    var hexDigits = "0123456789ABCDEF";
    for (var i = 0; i < 32; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[12] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
    s[16] = hexDigits.substr((s[16] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01

    var uuid = s.join("");
    return uuid;
}


function onSendEvent( evt ) {
    if ( FORCE_FLAG == false ) {
        return; // Do nothing ...
    }
    // Go on ...
    FORCE_FLAG = false;

    var prefs = Components.classes["@mozilla.org/preferences-service;1"]
                          .getService(Components.interfaces.nsIPrefService);

    // Get items for modifications
    // Default values if nothing else was definied
    try {
        var branch = prefs.getBranch("extensions.forcebutton.");
    } catch(ex) {
        var postScriptum = "Please respond!";
        var modifyHeader = false;
        var stringHeader = "Forced";
    }
    try {
        var postScriptum = branch.getComplexValue("postScriptum",
                       Components.interfaces.nsIPrefLocalizedString).data;
    } catch(ex) {
        var postScriptum = "Please respond!";
    }
    try {
        var modifyHeader = branch.getBoolPref("modifyHeader");
    } catch(ex) {
        var modifyHeader = false;
    }
    try {
        var stringHeader = branch.getComplexValue("stringHeader",
                       Components.interfaces.nsIPrefLocalizedString).data;
    } catch(ex) {
        var stringHeader = "Forced";
    }

    // Modify message header if requested
    if ( modifyHeader ) {
        gMsgCompose.compFields.subject = "[" + stringHeader + "] " + gMsgCompose.compFields.subject;
        document.getElementById("msgSubject").value = gMsgCompose.compFields.subject;
    }

    // Append header hash into list file and message header
    var hash = createUUID();
    var header = "References: <" + hash + "@forcebutton.v" + major_version + "-" + minor_version + ">\n";
    gMsgCompose.compFields.otherRandomHeaders += header;
   
//    if ( addListElement("<" + hash + "@forcebutton.v" + major_version + "-" + minor_version + ">", gMsgCompose) == true ) {;

        // Append postscriptum into message body
        try {
            var editor = GetCurrentEditor();
            var editor_type = GetCurrentEditorType();
            editor.beginTransaction();
            editor.endOfDocument();
            if( editor_type == "textmail" || editor_type == "text" ) {
                editor.insertText( PStext + postScriptum );
                editor.insertLineBreak();
            } else {
                editor.insertHTML( "<p>" + PStext + postScriptum + "</p>" );
            }
            editor.endTransaction();
        } catch(ex) {
            log("Append exception: " + ex + "\n");
            window.alert("Cannot append message body! ...");
            return false;
        }
//    } else {
//        window.alert("Cannot add mail to list!...");
//    }
}
window.addEventListener( "compose-send-message", onSendEvent, true );
