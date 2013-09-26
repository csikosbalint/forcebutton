/*
 *  Written by johnnym
 */

//GLOBAL VARIABLES
var MAIL_LIST = new Array();                // messageId -> nsIMsgDBHdr
var SEND_INTR = new Array();				// messageId -> ms
var ELDERMAIL;								// store oldest forcemail

var LOGSTREAM;                              // logging IO stream
var DAEMON;                                 // Daemon object - in order to kill/reload it!
var PREFS;                                  // Preferences branch object
var aCurrentIdentity;                       // For identity search
var aAccountManager;                        // For account search 
var sentFolder = [];

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

    // CONFIG VARIABLES
    // TODO: Put these config props into pref.js
    FORCEDIR    = "forcebutton";
    DAEMON_LOG  = "daemon.log";
    FORCELIST   = "forcedmails.lst";
    FREQ_TIME   = 60000;                      // daemon freq (ms)
    RESEND_TIME = 90000;                      // resending in (ms)
    DEBUG_MODE  = true;
    AUTHOR_MAIL = "johnnym@fnf.hu";

    // TODO: Check environment ... return true/false
    return true;
}

function initLogging() { 
    // Start logging ...
    LOGSTREAM = initTextFile(DAEMON_LOG);
    log("Logging has been initialized!");
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

    if( !forceDirFile.exists() || !forceDirFile.isDirectory() ) {
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
    PR_RDONLY       0x01    Open for reading only.
    PR_WRONLY       0x02    Open for writing only.
    PR_RDWR         0x04    Open for reading and writing.
    PR_CREATE_FILE  0x08    If the file exists, this flag has no effect.
    PR_APPEND       0x10    The file pointer is set to the end of the file...
    PR_TRUNCATE     0x20    If the file exists, its length is truncated to 0.
    PR_SYNC         0x40    If set, each write will wait for both the file...
    PR_EXCL         0x80    With PR_CREATE_FILE, if the file does not exist...
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

    if( !forceDirFile.exists() || !forceDirFile.isDirectory() ) {
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
    PR_RDONLY       0x01    Open for reading only.
    PR_WRONLY       0x02    Open for writing only.
    PR_RDWR         0x04    Open for reading and writing.
    PR_CREATE_FILE  0x08    If the file exists, this flag has no effect.
    PR_APPEND       0x10    The file pointer is set to the end of the file...
    PR_TRUNCATE     0x20    If the file exists, its length is truncated to 0.
    PR_SYNC         0x40    If set, each write will wait for both the file...
    PR_EXCL         0x80    With PR_CREATE_FILE, if the file does not exist...
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

    if( !forceDirFile.exists() || !forceDirFile.isDirectory() ) {
        forceDirFile.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0750);
    }

    // Create file if does not exists
    forceDirFile.append(filename);
    var forceFile = forceDirFile;

    // Prepare stream for append text
    var forceFileStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
                                    .createInstance(Components.interfaces.nsIFileInputStream);
    /* use 0x02 | 0x10 to open file for appending. */
    forceFileStream.init(forceFile, -1, -1, 0);
    /*
Parameters

file
    File to read from (must QI to nsILocalFile)
ioFlags
    The file status flags define how the file is accessed. See PR_Open documentation for more details. If set to -1 the file will be opened in default mode (PR_RDONLY).
perm
    File mode bits are described in the PR_Open documentation. If set to -1 the default value 0 will be used.
behaviorFlags
    Flags specifying various behaviors of the class (see enumerations in the class). 
     */
    /*
    PR_RDONLY       0x01    Open for reading only.
    PR_WRONLY       0x02    Open for writing only.
    PR_RDWR         0x04    Open for reading and writing.
    PR_CREATE_FILE  0x08    If the file exists, this flag has no effect.
    PR_APPEND       0x10    The file pointer is set to the end of the file...
    PR_TRUNCATE     0x20    If the file exists, its length is truncated to 0.
    PR_SYNC         0x40    If set, each write will wait for both the file...
    PR_EXCL         0x80    With PR_CREATE_FILE, if the file does not exist...
     */
    var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
                              .createInstance(Components.interfaces.nsIConverterInputStream);
        converter.init(forceFileStream, "UTF-8", -1, 0);
        /*
Parameters

aStream
    The source stream which is read and converted.
aCharset
    The character encoding to use for converting the bytes of the stream. A value of null or "UTF-8" equals UTF-8 encoding. Latin 1 is specified as "ISO-8859-1".
aBufferSize
    Defines the buffer size of the converter stream. In case of a buffer size of less than or equal to 0, the default size CONVERTER_BUFFER_SIZE will be used. This is currently set to 8192 bytes.
aReplacementChar
    Any unknown byte sequence will be replaced with this character. The default replacement character is U+FFFD. A value of 0x0000 will cause an exception to be thrown if unknown byte sequences are encountered in the stream. 
         */

    return converter;
}
