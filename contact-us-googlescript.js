function formatMailBody(obj, order) {
    var result = "";
    if (!order) {
      order = Object.keys(obj);
    }
    
    var i = 1;
    
    // loop over all keys in the ordered form data
    for (var idx in order) {
      var key = order[idx];
      if (i==2) {
        result += "<div>" + sanitizeInput(obj[key]) + "</div>";
      }
      i++;
    }
    return result; // once the looping is done, `result` will be one long string to put in the email body
  }
  
  // sanitize content from the user - trust no one 
  // ref: https://developers.google.com/apps-script/reference/html/html-output#appendUntrusted(String)
  function sanitizeInput(rawInput) {
     var placeholder = HtmlService.createHtmlOutput(" ");
     placeholder.appendUntrusted(rawInput);
    
     return placeholder.getContent();
   }
  
  // Your email here
  // var TO_ADDRESS = ""
  
  function doPost(e) {
  
    try {
      Logger.log(e); // the Google Script version of console.log see: Class Logger
      record_data(e);
      
      // shorter name for form data
      var mailData = e.parameters;
  
      // names and order of form elements (if set)
      var orderParameter = e.parameters.formDataNameOrder;
      var dataOrder;
      if (orderParameter) {
        dataOrder = JSON.parse(orderParameter);
      }
      
      // determine recepient of the email
      // if you have your email uncommented above, it uses that `TO_ADDRESS`
      // otherwise, it defaults to the email provided by the form's data attribute
      var sendEmailTo = (typeof TO_ADDRESS !== "undefined") ? TO_ADDRESS : mailData.formGoogleSendEmail;
      
      // send email if to address is set
      if (sendEmailTo) {
        MailApp.sendEmail({
          to: String(sendEmailTo),
          subject: "KCSOC Elections",
          replyTo: String(mailData.email),
          htmlBody: formatMailBody(mailData, dataOrder)
        });
      }
  
      return ContentService    // return json success results
            .createTextOutput(
              JSON.stringify({"result":"success",
                              "data": JSON.stringify(e.parameters) }))
            .setMimeType(ContentService.MimeType.JSON);
    } catch(error) { // if error return this
      Logger.log(error);
      return ContentService
            .createTextOutput(JSON.stringify({"result":"error", "error": error}))
            .setMimeType(ContentService.MimeType.JSON);
    }
  }
  
  
  /**
   * record_data inserts the data received from the html form submission
   * e is the data received from the POST
   */
  function record_data(e) {
    var lock = LockService.getDocumentLock();
    lock.waitLock(30000); // hold off up to 30 sec to avoid concurrent writing
    
    try {
      Logger.log(JSON.stringify(e)); // log the POST data in case we need to debug it
      
      // select the 'responses' sheet by default
      var doc = SpreadsheetApp.getActiveSpreadsheet();
      var sheetName = "responses";
      var sheet = doc.getSheetByName(sheetName);
      
      var oldHeader = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var newHeader = oldHeader.slice();
      var fieldsFromForm = getDataColumns(e.parameters);
      var row = [new Date()]; // first element in the row should always be a timestamp
      
      // loop through the header columns
      for (var i = 1; i < oldHeader.length; i++) { // start at 1 to avoid Timestamp column
        var field = oldHeader[i];
        var output = getFieldFromData(field, e.parameters);
        row.push(output);
        
        // mark as stored by removing from form fields
        var formIndex = fieldsFromForm.indexOf(field);
        if (formIndex > -1) {
          fieldsFromForm.splice(formIndex, 1);
        }
      }
      
      // set any new fields in our form
      for (var i = 0; i < fieldsFromForm.length; i++) {
        var field = fieldsFromForm[i];
        var output = getFieldFromData(field, e.parameters);
        row.push(output);
        newHeader.push(field);
      }
      
      // more efficient to set values as [][] array than individually
      var nextRow = sheet.getLastRow() + 1; // get next row
      sheet.getRange(nextRow, 1, 1, row.length).setValues([row]);
  
      // update header row with any new data
      if (newHeader.length > oldHeader.length) {
        sheet.getRange(1, 1, 1, newHeader.length).setValues([newHeader]);
      }
    }
    catch(error) {
      Logger.log(error);
    }
    finally {
      lock.releaseLock();
      return;
    }
  
  }
  
  function getDataColumns(data) {
    return Object.keys(data).filter(function(column) {
      return !(column === 'formDataNameOrder' || column === 'honeypot');
    });
  }
  
  function getFieldFromData(field, data) {
    var values = data[field] || '';
    var output = values.join ? values.join(', ') : values;
    return output;
  }