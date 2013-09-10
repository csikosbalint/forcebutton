function forceList() {
    var params =  {    inn:{   name:"foo",
                               description:"bar",
                               enabled:true
                           },
                       out:   null
                  };

  window.openDialog(    "chrome://forcebutton/content/forceList.xul",
                        "",
                        "chrome, dialog, modal, resizable=yes",
                        params
                    ).focus();
  if (params.out) {
    // User clicked ok. Process changed arguments; e.g. write them to disk or whatever
    window.alert(params.out.name);
  }
  else {
    // User clicked cancel. Typically, nothing is done here.
  }

}
