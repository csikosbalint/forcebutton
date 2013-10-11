initConfig(false);
initMAIL_LIST();
initFolders();
/*
 * https://developer.mozilla.org/en-US/docs/XUL/listbox
 */
var theList = document.getElementById('list');

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
		if ( line.value.indexOf("#") == 0 ) {
			continue;
		}
		
		var row = document.createElement('listitem');
		var cell;
		/*
		 * subject,SEND_INTR[actualMsgHdrDb.messageId],messageId
		 */
		
		cell = document.createElement('listcell');
		cell.setAttribute('label', line.value.split("|")[1]);
		row.appendChild(cell);

		cell = document.createElement('listcell');
		cell.setAttribute('label', line.value.split("|")[2]);
		row.appendChild(cell);
		
		cell = document.createElement('listcell');
		cell.setAttribute('label', line.value.split("|")[0]);
		row.appendChild(cell);

		theList.appendChild(row);

	} while (cont);
	list.close();
}

function dropMAIL_LIST() {
	var theList = document.getElementById('list');
	var selected= theList.getItemAtIndex(theList.selectedIndex);
	var id = selected.getElementsByTagName('listcell')[2];
	var sub = selected.getElementsByTagName('listcell')[0];
	if ( !delMAIL_LIST(id.getAttribute('label')) ) {
		alert( + sub.getAttribute('label') + "\" failed to remove+");
	}
	theList.removeItemAt(theList.selectedIndex);
	if ( theList.itemCount == 0 ) {
		var removebutton = document.getElementById('removeButton');
		removebutton.disabled = true;
	}
}
