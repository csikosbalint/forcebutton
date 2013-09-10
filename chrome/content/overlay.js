if ( daemonConfirm() ) {

    initConfig();               // From forceConfig.js
    
    initLogging();              // From forceConfig.js

    // EventLister(s)
    initWatchMailListener();    // From forceDaemon.js
    initOnLoadListener();       // From forceDaemon.js
//    initFolderLoadListener();   // From forceDaemon.js

}
