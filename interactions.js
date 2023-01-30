function attachScripts(srcs) {
  for (src of srcs) {
    const node = document.createElement('script');
    node.type = 'text/javascript';
    node.src = src;
    document.head.appendChild(node);
  }
}
attachScripts(['https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js','https://cdn.jsdelivr.net/npm/jquery@3.6.3/dist/jquery.min.js']);

// These css selectors select the Notes and select the contents of each Note
var noteSelector =  ".block-impact--note .block-impact__row"; // "[aria-label='Note']";
var noteContentsSelector = '.fr-view';

// These are the labels that accompany the data. These must be entered exactly
// correct or the Note will not be successfully processed
var sectionlabel = "Section:";
var promptlabel = "Prompt:";
var takeactionlabel = "Take Action:";
var coursetitlelabel = "Course Title:";
var includeEmailButtonLabel = "Include Email Button:";
var emailAddressLabel = "Email Address:";
var introsectionlabel = "Section:";
var introSectionOrderLabel = "Section Order:";
var introtitlelabel = "Intro Title:";
var introtextlabel = "Intro Text:";

// These are the text for the Print buttons
var PrintAllButton_Text = "Print My Journal";
var PrintTakeActionsOnly_Text = "Print My Actions";
var EmailButton_Text = "Email My Journal"; // text for the Email button, if active


// These are the data storage variables. When the course loads, these are filled
// with any existing journal entries found in localStorage. Likewise, when any entries are
// updated, these data storage variables are updated AND the localStorage is updated.
var UserData = {};
UserData.Sections = [];
var courseTitle = '';

// localStorageItem is the item in localStorage where the journal entry data is stored.
// a unique identifier is formed by concatenating
// localStorageItem_prefix and the URL path up to the html file.
var localStorageItem_prefix = 'Interactions_';
var localStorageItem = '';

// image in the printed journal header
// if 'interactions.png' exists in this folder, it will be used, otherwise the header is omitted
var imageIntroHeader;

// These are the settings used by the autosave of journal entries
var typingTimer;                //  timer identifier
var doneTypingInterval = 400;  //  time in ms

// Test if browser is firefox (used in printEntries)
var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

let cache = [];

/* ------------------------------------------------------------------------------------------------ */
function waitForElm(selector) {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}

// Rise dynamically loads and appends lessons; we often need to wait unti the next element exists before executing code.
function waitForNextSibling(me) {
  return new Promise(resolve => {
    if (me.nextElementSibling) {
        return resolve(me.nextElementSibling);
    }

    const observer = new MutationObserver(mutations => {
        if (me.nextElementSibling) {
            resolve(me.nextElementSibling);
            observer.disconnect();
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
  });
}


window.addEventListener('load', function initInteractions() {
  waitForElm('section.blocks-lesson').then((lessonSection) => {
    setlocalStorageItem();
    getSectionsfromLocalStorage();
    initialProcessNotes();
    addEvents();

    var img = new Image();
    img.onload = function () {
      imageIntroHeader = img.src;
    }
    img.onerror = function () {
      imageIntroHeader = undefined;
    }
    img.src = 'interactions.png';
  });
});

/**
  * @desc sets the value for the variable localStorageItem by concatenating
  *     localStorageItem_prefix and and the URL path up to the html file
  * @param none
  * @return string
*/
function setlocalStorageItem() {
  var loc = document.location;
  var uniqueURL = loc.origin + loc.pathname.substring(0, loc.pathname.lastIndexOf("/"));
  localStorageItem = localStorageItem_prefix + encodeURIComponent(uniqueURL);
}



/**
  * @desc Run processNotes several times when the page first loads
  * @return none
*/
function initialProcessNotes(  ) {
  var MAX_INSTANCES = 5;
  var instances = 0;
  var myInterval = setInterval(myTimerProcessNotes, 345);
  function myTimerProcessNotes() {
    instances++;
    if (instances === MAX_INSTANCES ) {
      clearInterval(myInterval);
    }
    if (processNotes()) { clearInterval(myInterval) }
  }
}



/**
  * @desc add eventlisteners so that the func processNotes is fired when appropriate
  * @param none
  * @return none
*/
function addEvents() {
  function changeObserver(event) {
    if (event.type=='hashchange' || (event.relatedNode && event.relatedNode.nodeName == "SECTION" && event.relatedNode.className == "blocks-lesson")) {
      processNotes();
    }
  }
  window.addEventListener("hashchange", changeObserver, false);
  window.addEventListener("DOMNodeInserted", changeObserver, false);

  // Set up autosave of journal entries to UserData and to localStorage
  // see https://stackoverflow.com/questions/4220126/run-javascript-function-when-user-finishes-typing-instead-of-on-key-up?utm_medium=organic&utm_source=google_rich_qa&utm_campaign=google_rich_qa
  $(document).on('keyup', '.journalentry-response', function(){
      clearTimeout(typingTimer);
      var myentrycontainer = this.parentNode;
      typingTimer = setTimeout(function() {
        var response = myentrycontainer.querySelector('.journalentry-response').value;
        var sectionid = myentrycontainer.dataset.sectionid;
        var entryid = myentrycontainer.dataset.entryid;
        UserData.Sections[sectionid].entries[entryid].response = response;
        setSectionstoLocalStorage();
      }, doneTypingInterval);
  });

}



/**
  * @desc Create Section object
  * @param string title - title of section
  * @param string introtitle - title of the section intro that appears in printed journal
  * @param string introtext - text of the section intro that appears in printed journal
  * @return none
*/
function Section( title, order, introtitle, introtext ) {
  if (!order) {
    order = 999
  }
	this["title"] = title;
  this["order"] = order;
  this["entries"] = [];
  introtitle = (introtitle) ? introtitle : '';
  this["introtitle"] = introtitle; // optional
  introtext = (introtext) ? introtext : '';
  this["introtext"] = introtext; // optional
}


/**
  * @desc Create Entry object
  * @param string section - which section does this entry belong in (linked to a Section object)
  * @param string prompt - text of the prompt
  * @param string response - text of the response (blank if new)
  * @param bool isTakeAction - is this a Take Action?
  * @return none
*/
function Entry( section, prompt, response, isTakeAction ) {
	this["section"] = section;
	this["prompt"] = prompt;
  this["response"] = response;
  this["isTakeAction"] = isTakeAction;
  // another data element is entryid, added after the entry is created
  // another data element is sectionid, added after the entry is created
}


/**
  * @desc these functions either copy localStorageItem to UserData.Sections or vice versa
  * @param none
  * @return none
*/
function setSectionstoLocalStorage() {
  localStorage.setItem(localStorageItem, JSON.stringify(UserData.Sections));
}
function getSectionsfromLocalStorage() {
  var retrievedString = localStorage.getItem(localStorageItem);
  if ( retrievedString == null || retrievedString == '' ) {
    localStorage.setItem(localStorageItem, '');
    var emptyarray = [];
    return emptyarray;
  } else {
    UserData.Sections = JSON.parse(retrievedString);
  }
}

function removeElement(el) {
  if (el) el.parentNode.removeChild(el);
}

/**
  * @desc This is the workhorse of the interaction processor. It finds all the supported references on the page
  *   and processes them depending on what type of entity it is
  * @param none
  * @return true if Notes were found
*/
function processNotes() {

    var $notes = $( noteSelector );
    var returnValue = ($notes.length > 0) ? true : false ;

    $notes.each( function() {
      switch (this.querySelector(noteContentsSelector).firstChild.innerText.trim()) {

        case "INTERACTION::TEXT-ENTRY": processTextbox(this); break;
        case "INTERACTION::BUTTONS": processButtons(this); break;
        case "INTERACTION::DETAILS": processDetails(this); break;
        case "INTERACTION::CASESTUDY": processDialog(this); break;
        case "INTERACTION::DIALOG": processDialog(this); break;
        case "INTERACTION::REFERENCES": processReferences(this); break;
        case "JOURNAL::ENTRY": processEntry(this); break;
        case "JOURNAL::BUTTONS": processButtons(this); break;
        case "SECTION::INTRO": processIntro(this); break;
        case "FLAG::FLOAT": floatImage(this); break;
        case "FLAG::FLOATRAW": floatImage(this, true); break;
       // case "FLAG::TABS::EXPAND": fixTabs(this); break;
        case "FLAG::MULTILINE": fixAccordion(this); break;
        case "FLAG::CONTINUE": mimicContinue(this); break;
        case "FLAG::BGCOLOR": setBackgroundColour(this); break;
        case "FLAG::EDGECOLOR": setEdgeColour(this); break;

        default: break;
      }

    });
    setSectionstoLocalStorage();
    return returnValue;
}


/**
  * @desc This processes an Entry. If successful, it updates UserData
  *   and renders the entry to DOM
  * @param jQueryObject note - the note to be processed
  * @return none
*/
function processEntry( note ) {

  var entry = createEntryfromNote( note );
  if ( entry ) {

    // use indexSection and indexEntry to determine if this is a new section and entry
    var indexSection = -1; indexEntry = -1;
    for (var i = 0; i < UserData.Sections.length; i++) {
      var currentSection = UserData.Sections[i];
      if ( currentSection.title == entry.section ) { indexSection = i; }
      for (var j = 0; j < currentSection.entries.length; j++ ) {
        if ( currentSection.entries[j].section == entry.section &&
          currentSection.entries[j].prompt == entry.prompt ) {
          indexEntry = j;
        }
      }
    }

    // New section, new entry
    if (indexSection == -1 && indexEntry == -1 ) {
      indexSection = UserData.Sections.length;
      indexEntry = 0;
      var newsection = new Section( entry.section );
      newsection.entries.push( entry );
      UserData.Sections.push( newsection );
    }

    // Existing section, new entry
    if (indexSection > -1 && indexEntry == -1 ) {
      indexEntry = UserData.Sections[indexSection].entries.length;
      UserData.Sections[indexSection].entries.push( entry );
    }

    // Existing section, existing entry
    if (indexSection > -1 && indexEntry > -1 ) {
      entry.response = UserData.Sections[indexSection].entries[indexEntry].response;
    }

    renderEntrytoDOM( note.parentNode, entry, indexSection, indexEntry );
  }

  removeElement(note);
}


/**
  * @desc renders an Entry to DOM.
  * @param DOMElement parentcontainer - entry's parent container
  * @param Entry entry - the entry
  * @param string sectionid - the id of the corresponding section in UserData.Sections
  * @param string entryid - the id on the entry within UserData.Sections
  * @return none
*/
function renderEntrytoDOM( parentcontainer, entry, sectionid, entryid ) {

    // create container
    var container = document.createElement("div");
    container.className = "journalentry-container";
    container.dataset.sectionid = sectionid;
    container.dataset.entryid = entryid;

    // create prompt
    var prompt = document.createElement("div");
    prompt.className = "journalentry-prompt";
    prompt.innerText = entry.prompt;
    container.appendChild( prompt );

    // create response
    var response = document.createElement("textarea");
    response.className = "journalentry-response";
    response.value = entry.response;
    container.appendChild(response);
    parentcontainer.appendChild(container);

    $( ".block-impact--note:has( .journalentry-container)").addClass("block-impact--note-journalentry");
}


/**
  * @desc creates an Entry object from a Note.
  * @param DOMElement note - note from which to create the entry
  * @return Entry object or null if fail (section or prompt is empty)
*/
function createEntryfromNote( note ) {

  var section = '', prompt = '', isTakeAction = false;
  var notecontents = note.querySelector(noteContentsSelector);
  for (var i = 0; i< notecontents.childNodes.length; i++ ) {
    var a = notecontents.childNodes[i];

    // set the section
    if ( a.innerText.substring(0,sectionlabel.length) == sectionlabel ) {
      section = a.innerText.substring(sectionlabel.length).trim();
    }
    // set the prompt
    if ( a.innerText.substring(0,promptlabel.length) == promptlabel ) {
      prompt = a.innerText.replace(promptlabel, "").trim();
    }
    // set the takeaction
    if ( a.innerText.substring(0,takeactionlabel.length) == takeactionlabel ) {
      var TakeActiontext = a.innerText.replace(takeactionlabel, "").trim();
      if ( TakeActiontext.toLowerCase() == "yes" ) { isTakeAction = true }
    }
  }

  if (section != '' && prompt != '') {
    return new Entry( section, prompt, '', isTakeAction); // response is added later
  } else {
    return null;
  }
}


/**
  * @desc This processes the Buttons. It updates sets the courseTitle variable
  *   and renders the buttons to DOM
  * @param DOMElement note - note
  * @return none
*/
function processButtons( note ) {

  var includeEmailButton = false;
  var emailAddress = '';

  // Set Course Title
  var notecontents = note.querySelector(noteContentsSelector);
  for (var i = 0; i< notecontents.childNodes.length; i++ ) {
    var a = notecontents.childNodes[i];

    // Set the Course Title
    if ( a.innerText.substring(0,coursetitlelabel.length) == coursetitlelabel ) {
      courseTitle = a.innerText.substring(coursetitlelabel.length).trim();
    }

    // Include an Email button
    if ( a.innerText.substring(0,includeEmailButtonLabel.length) == includeEmailButtonLabel ) {
      var emailButtonSetting = a.innerText.replace(includeEmailButtonLabel, "").trim();
      if ( emailButtonSetting.toLowerCase() == "yes" ) { includeEmailButton = true }
    }

    // Email address to which the journals will be emailed
    if ( a.innerText.substring(0,emailAddressLabel.length) == emailAddressLabel ) {
      emailAddress = a.innerText.substring(emailAddressLabel.length).trim();
    }
  }

  // Render buttons to DOM
  var container = document.createElement("div");
  container.className = "journalbuttons-container";

  var button1 = document.createElement("div");
  button1.className = "journalprintbutton";
  button1.innerText = PrintAllButton_Text;
  button1.addEventListener("click", function() { printEntries(false)} );
  container.appendChild(button1);

  var button2 = document.createElement("div");
  button2.className = "journalprintbutton";
  button2.innerText = PrintTakeActionsOnly_Text;
  button2.addEventListener("click", function() { printEntries(true)} );
  container.appendChild(button2);
  note.parentNode.appendChild(container);

  if ( includeEmailButton ) {
    var button3 = document.createElement("div");
    button3.className = "journalprintbutton";
    button3.innerText = EmailButton_Text;
    button3.addEventListener("click", function() { emailEntries( emailAddress )} );
    container.appendChild(button3);
    note.parentNode.appendChild(container);
  }

  removeElement(note);
}


/**
  * @desc This processes a Section Intro, saving the intro information to UserData
  * @param DOMElement note - note
  * @return none
*/
function processIntro( note ) {

  var notecontents = note.querySelector(noteContentsSelector);
  var introsection = '', introSectionOrder = 999, introtitle = '', introtext = '';
  for (var i = 0; i< notecontents.childNodes.length; i++ ) {
    var a = notecontents.childNodes[i];

    // set the intro section
    if ( a.innerText.substring(0,introsectionlabel.length) == introsectionlabel ) {
      introsection = a.innerText.substring(introsectionlabel.length).trim();
    }
    // set the intro section index
    if ( a.innerText.substring(0,introSectionOrderLabel.length) == introSectionOrderLabel ) {
      introSectionOrder = parseInt(a.innerText.substring(introSectionOrderLabel.length).trim());
      if ( introSectionOrder !== introSectionOrder ) { //  is not a number
        introSectionOrder = 999
      }
    }
    // set the intro title
    if ( a.innerText.substring(0,introtitlelabel.length) == introtitlelabel ) {
      introtitle = a.innerText.substring(introtitlelabel.length).trim();
    }
    // set the intro text
    if ( a.innerText.substring(0,introtextlabel.length) == introtextlabel ) {
      introtext = a.innerText.replace(introtextlabel, "").trim();

      // grab the rest of the Note for the text also
      i++;
      while (i < notecontents.childNodes.length) {
        introtext += "<br /><br />" + notecontents.childNodes[i].innerText;
        i++;
      }
    }
  }

  if (introsection != '' && introtitle != '' && introtext != '') {
    var sectionMatch = -1;
    for (var j = 0; j < UserData.Sections.length; j++) {
      if ( UserData.Sections[j].title == introsection ) { sectionMatch = j; }
    }

    if (sectionMatch == -1) {
      // new section
      UserData.Sections.push( new Section( introsection, introSectionOrder, introtitle, introtext ) );
    } else {
      // existing section
      UserData.Sections[sectionMatch].order = introSectionOrder;
      UserData.Sections[sectionMatch].introtitle = introtitle;
      UserData.Sections[sectionMatch].introtext = introtext;
    }
    UserData.Sections.sort( compareOrders )
  }

  removeElement(note);

  // SUB function
  // Sorts an array of objects on a particular property
  function compareOrders( a, b ) {
    if ( a.order < b.order ){
      return -1;
    }
    if ( a.order > b.order ){
      return 1;
    }
    return 0;
  }
}





/**
  * @desc prints the entries by opening a new browser window with a print button on it
  * @param bool TakeActionsOnly - are we printing all or simply Take Actions?
  * @return none
*/
function printEntries( TakeActionsOnly ) {

  var printtitle = ( TakeActionsOnly ) ? "Take Action Items" : "Learning Journal";
  var printCommand = (isFirefox)
		? 'window.print()'
		: 'document.execCommand(\"print\", false, null);';
	var date = getDate();

	var contents = "<html><head></head><body>"
  contents+= "<div class='no-print printbutton' ><button onclick='" + printCommand + "'>" +
    "Print My " + printtitle + "</button></div>";
	contents+="<div class='headertext' >" + courseTitle + " " + printtitle + "</div>";
	contents+="<div class='date' >"+date+"</div>";

  // print each entry if applicable
  for (var i = 0; i< UserData.Sections.length; i++ ) {
       var currentSection = UserData.Sections[i];

       var sectionheader = "<div class='sectiontitle' >Section: " + currentSection.title + "</div>";
       if ( currentSection.introtitle ) {
         sectionheader +=
           "<div class='sectionintrocontainer' >" +
             "<img class='sectionintroicon' src='" + imageIntroHeader + "' />" +
             "<div class='sectionintrotextcontainer'>" +
               "<div class='sectionintrotitle'>" + currentSection.introtitle + "</div>" +
               "<div class='sectionintrotext'>" + currentSection.introtext + "</div>" +
           "</div></div>";
       }


       var sectioncontents = '';
       for (var j = 0; j< currentSection.entries.length; j++ ) {
          if ( (!TakeActionsOnly || currentSection.entries[j].isTakeAction == true) &&
                currentSection.entries[j].response != '' ) {
            sectioncontents+="<div class='prompt' >" + currentSection.entries[j].prompt + "</div>";
            sectioncontents+="<div class='response' >" + currentSection.entries[j].response + "</div>";
          }
       }
       if (sectioncontents != '' ) {
          contents+= "<div class='sectionarea'>" + sectionheader + sectioncontents + "</div>";
          if (i != UserData.Sections.length - 1 ) { contents+= "<div class='pagebreak'></div>" }
       }
    //}
  }

	contents+= "</body></html>"

  var myWindow = window.open("","Print " + getTimestamp(),"width=810,height=610,scrollbars=1,resizable=1");
	myWindow.document.write(contents);

	var myStringOfstyles =  "@media print { .no-print, .no-print * { display: none !important; } }" +
							"body { width:650px;padding:20px;font-family:sans-serif }" +
							".printbutton { height:20px;padding:10px;margin-bottom:20px;text-align:center; }" +
							".headertext { text-transform: uppercase;text-align:center;font-size:22px; " +
              "    font-weight:bold;margin-bottom:20px; background-color: #4c4c4c !important; " +
              "    -webkit-print-color-adjust: exact;color: white; padding: 15px 20px; }" +
							".date { font-size:16px;font-weight:bold;text-align: center;margin-bottom: 30px }" +
              ".sectionarea { margin-bottom:80px;}" +
              ".sectionintrocontainer { margin-bottom: 5px; color: black; padding: 25px 20px;}" +
              ".sectionintroicon { height: 160px;  display: inline-block; padding: 0px 20px}" +
              ".sectionintrotextcontainer { display: inline-block; width: 330px; vertical-align: top;" +
              "    padding-left:20px}" +
              ".sectionintrotitle { font-weight: bold; font-size: 15pt;margin-bottom: 12px;}" +
              ".sectionintrotext { line-height: 18pt;}" +
              ".sectiontitle { font-weight: bold; margin-bottom: 10px;}" +
              ".pagebreak { page-break-before: always; }" +
              ".response { font-size: 11pt;border: 1.5px gray solid;padding: 15px;" +
              "    margin-bottom: 20px;white-space: pre-wrap; margin-top: 0px; }" +
							".prompt { font-size: 16px; background-color: #4c4c4c !important; " +
              "    -webkit-print-color-adjust: exact;color: white; font-weight: bold; " +
              "    padding: 8px 10px;line-height:15pt; }";
							//".section { font-size: 18px;font-weight:bold;margin-top: 50px;text-align: center;margin-bottom: 15px  }";
	var linkElement = myWindow.document.createElement('link');
	linkElement.setAttribute('rel', 'stylesheet');
	linkElement.setAttribute('type', 'text/css');
	linkElement.setAttribute('href', 'data:text/css;charset=UTF-8,' + encodeURIComponent(myStringOfstyles));
	myWindow.document.head.appendChild(linkElement);

  var titleElement = myWindow.document.createElement('title');
  var t = myWindow.document.createTextNode("Print " + printtitle);
  titleElement.appendChild(t);
  myWindow.document.head.appendChild(titleElement);

  // sub-function
  function getDate() {
    var m_names = new Array("January", "February", "March",
    "April", "May", "June", "July", "August", "September",
    "October", "November", "December");
    var today = new Date();
    var dd = today.getDate();
    var mm = today.getMonth();
    var yyyy = today.getFullYear();
    if(dd<10) { dd='0'+dd }
    return m_names[mm]+' '+dd+', '+yyyy;
  }
}


/**
  * @desc emails the entries
  * @param none
  * @return none
*/
function emailEntries( emailAddress ) {

  var printtitle = "Learning Journal";
  var lineBreak = '%0D';
	var contents = courseTitle + lineBreak + printtitle + lineBreak + lineBreak;
  contents+= "------------------------------" + lineBreak;

  // print each entry if applicable
  for (var i = 0; i< UserData.Sections.length; i++ ) {
       var currentSection = UserData.Sections[i];

       var sectionheader = "Section: " + currentSection.title + lineBreak;
       if ( currentSection.introtitle ) {
         sectionheader +=
           currentSection.introtitle + lineBreak +
           currentSection.introtext + lineBreak + lineBreak;
       }


       var sectioncontents = '';
       for (var j = 0; j< currentSection.entries.length; j++ ) {
          if ( currentSection.entries[j].response != '' ) {
            sectioncontents+= currentSection.entries[j].prompt + lineBreak;
            sectioncontents+= currentSection.entries[j].response + lineBreak + lineBreak;
          }
       }
       if (sectioncontents != '' ) {
          contents+= sectionheader + sectioncontents;
          if (i != UserData.Sections.length - 1 ) { contents+= "------------------------------" + lineBreak }
       }
    //}
  }


  window.open('mailto:' + emailAddress +
              '?subject=My Learning Journal&body=' + contents);


}



/**
  * @desc returns timestamp in the form of yyyymmddhhmmss
  * @param none
  * @return string
*/
function getTimestamp() {
    var today = new Date();
    var mm = today.getMonth()+1;
    if(mm<10) { mm='0'+mm }
    var dd = today.getDate();
    if(dd<10) { dd='0'+dd }
    var hh = today.getHours();
    if(hh<10) { hh='0'+hh }
    var min = today.getMinutes();
    if(min<10) { min='0'+min }
    var sec = today.getSeconds();
    if(sec<10) { sec='0'+sec }
    return today.getFullYear() + mm + dd + hh+ min + sec ;
}

// Polyfill for isNaN
Number.isNaN = Number.isNaN || function(value) {
    return value !== value;
}

function createTextLinks(text) {
  return (text || '').replace(/([^\S]|^)(((https?\:\/\/)|(www\.))(\S+))/gi, function (match, space, url) {
    var hyperlink = url;
    if (!hyperlink.match('^https?://')) {
      hyperlink = 'http://' + hyperlink;
    }
    return space + '<a href="' + hyperlink + '" target="_blank">' + url + '</a>';
  });
}

// get the note data as a document fragment; skip first element (already consumed); can delete original note
// cache in case we try to process the node more than once
function getNoteData(note) {
  const block = note.closest("div[data-block-id]");
  if (block.dataset.blockId in cache) {
    return {
      id: block.dataset.blockId,
      fragment: block[block.dataset.blockId]
    }
  } else {
    const node = note.querySelector(noteContentsSelector);
    if (!node.childNodes.length) return;
    const frag = new DocumentFragment();
    if (node.firstChild) node.removeChild(node.firstChild);
    while (node.childNodes.length) {
      frag.appendChild(node.firstChild);
    }
    cache[block.dataset.blockId] = frag;
    return {
      id: block.dataset.blockId,
      fragment: frag
    }
  }
}

// function setHtml(node,html) {
// node.innerHTML = `<div class="animated fadeInGrow" style="animation-duration: 0.5s; opacity: 1; animation-delay: 0s;">${html}</div>`;
// }

function processTextbox(note) {
  const data = getNoteData(note);

  const template = `
    <section class="blocks-textbox__container">
      <textarea id="textarea-${data.id}" rows="5" cols="80" style="width:100%;resize:vertical;" placeholder="${data.fragment.textContent}"></textarea>
      <div id="savehint-${data.id}" hidden>Saved</div>
    </section>
  `;
  note.parentNode.innerHTML = template;
  runTextbox(data.id);
}
function runTextbox(id) {
  // populate value if set
  // set up keyup listener
}

// create a horizontal row of buttons that link to things
function processButtons(note) {
  const data = getNoteData(note);
  let template = `<section class="blocks-button__container blocks-button--extended blocks-button--rounded" style="justify-content: space-between;">`;
  Array.from(data.fragment.childNodes).forEach(function(value,index) {
    const [text,link] = value.textContent.split("::");
    template += `<a class="blocks-button__button brand--ui" role="button" style="background-color: var(--color-accent)" href="${link}" target="_blank">${text}</a>`;
  });
  note.parentNode.innerHTML = `${template}</section>`;
}

// create a html details expanding section (doesn't remember state)
function processDetails(note) {
  const data = getNoteData(note);
  let template = `<section class="blocks-details__container"><details>`;
  let firstLine = 0;
  Array.from(data.fragment.childNodes).forEach(function(value,index) {
    if (index === firstLine && value.textContent.trim() !== '') {
      template += `<summary style="cursor:pointer">${value.outerHTML.replace(/<\/?p[^>]*>/g, "")}</summary>`;
    } else if (index === firstLine && value.textContent.trim() === '') {
      firstLine += 1;
    } else {
      template += value.outerHTML;
    }
  });
  note.parentNode.innerHTML = `${template}</details></section>`;
}

// create a html dialog which with close button
function processDialog(note) {
  const data = getNoteData(note);
  let template = `<section class="blocks-button__container blocks-button--extended blocks-button--rounded" style="justify-content: space-around;">`;
  Array.from(data.fragment.childNodes).forEach(function(value,index) {
    switch (index) {
      case 0: 
        template += `<a class="blocks-button__button brand--ui" role="button" style="background-color: var(--color-accent);cursor:pointer;" onclick="document.querySelector('#dialog_${data.id}').showModal()">${value.textContent}</a>`;
        break;

      case 1:
        template += `<dialog id='dialog_${data.id}' style='font-family:var(--font-family-body);border-color:var(--border-color-accent);box-shadow:0 .4rem 1.2rem .2rem rgba(0,0,0,.05)'>
          <form method='dialog'>
            <div style='text-align: right'>
              <button value='cancel' style='font-size:2.5rem;border:none;background:transparent;box-shadow:none;padding:1rem;color:var(--color-accent);' aria-role='button' type='button' onclick="document.querySelector('#dialog_${data.id}').close()">&times;</button>
            </div>
          </form>`;
        // no break

      default:
        template += value.outerHTML;
    }
  });
  note.parentNode.innerHTML = `${template}</dialog></section>`;
}

// turn a list of links into a list of buttons which reveal a paragraph below (like tabs but using buttons)
function processReferences(note) {
  const data = getNoteData(note);
  let links = '', references = '';
  Array.from(data.fragment.childNodes).forEach(function(value,index) {
    const [text,reference] = value.textContent.split("::");
    links += `<a class="blocks-button__button brand--ui button-minimal" data-p="ref_${data.id}_${index}" role="button" style="background-color: var(--color-accent); cursor:pointer;" onclick="document.querySelectorAll('#ref_${data.id}>p').forEach(function(el){el[(event.target.dataset.p==el.id)?"removeAttribute":"setAttribute"]('hidden','hidden')}">${text}</a>`;
    references += `<p id="ref_${data.id}_${index}" hidden>${createTextLinks(reference)}</p>`;
  });
  note.parentNode.innerHTML = `<section class="blocks-references__container">
   <div class="blocks-button__container blocks-button--extended blocks-button--rounded" style="justify-content: space-between;">
    ${links}
   </div>
   <div class="blocks-display__container" id="ref_${data.id}">
    ${references}
   </div>
  </section>`;
}

// takes 'image & text' and turn it into a floated image (maintaining size, functionality & alignment)
function floatImage(note, raw) {
  const me = note.closest("div[data-block-id]");
  if (cache[me.dataset.blockId]) return;
  cache[me.dataset.blockId] = true;
  waitForNextSibling(me).then((block) => {
    me.parentNode && me.parentNode.removeChild(me);
    if (!block.querySelector('.block-image')) return;
    const figure = block.querySelector('.block-image__figure'); // the image, might be a <figure> or a <div>
    const col = block.querySelector('.block-image__text').closest('.block-image__col'); // the column to keep
    if (col) { // may have already been patched
      figure.classList.add(col.previousElementSibling ? 'float-left' : 'float-right');
      if (raw) figure.classList.add('noresize');
      const target = col.querySelector(noteContentsSelector); // where to insert
      target.insertBefore(figure,target.firstChild); // moves the image container node
      for (node of col.parentNode.childNodes) {
        if (node!==col) node.parentNode.removeChild(node);
      }
      col.parentNode.appendChild(col.firstChild); // moves content out of column (expand to fill space)
      col.parentNode.removeChild(col);
    }
  });
}

// this flag is global once applied
function fixAllAccordions(note) {
  document.body.classList.add("flag-multiline");
  const me = note.closest("div[data-block-id]");
  me.parentNode && me.parentNode.removeChild(me);
}

// tells the next element to have multi-line titles
function fixAccordion(note) {
  const me = note.closest("div[data-block-id]");
  if (cache[me.dataset.blockId]) return;
  cache[me.dataset.blockId] = true;
  waitForNextSibling(me).then((block) => {
    // if the element wasn't an accordion, the following line won't match and nothing will happen.
    Array.from(block.querySelectorAll('.blocks-accordion__title')).forEach(function(el) {
      el.classList.add('blocks-accordion__multiline');
    });
    me.parentNode && me.parentNode.removeChild(me);
  });
}

function mimicContinue(note) {
  const me = note.closest("div[data-block-id]");
  if (cache[me.dataset.blockId]) return;
  cache[me.dataset.blockId] = true;
  waitForNextSibling(me).then((block) => {
    me.parentNode && me.parentNode.removeChild(me);
  });
}

// sets the background of the NEXT block to be the same as this NOTE block, then removes this note block
function setBackgroundColour(note) {
  const me = note.closest("div[data-block-id]");
  if (cache[me.dataset.blockId]) return;
  cache[me.dataset.blockId] = true;
  waitForNextSibling(me).then((block) => {
    const noteStyle = window.getComputedStyle(me.querySelector('.block-impact--note'));
    let target = block.querySelector('div[class^="block-"]');
    if (Object.isFrozen(target.getAttribute('style'))) { // some do, some don't. Rise lacks internal consistency. Something to do with 'legacy' blocks?
      target = target.querySelector('div'); // first one inside it
    }
    target.style.backgroundColor = noteStyle.backgroundColor;
    me.parentNode && me.parentNode.removeChild(me);
  });
}


function setEdgeColour(note) {
  const me = note.closest("div[data-block-id]");
  if (cache[me.dataset.blockId]) return;
  cache[me.dataset.blockId] = true;
  waitForNextSibling(me).then((block) => {
    const style = window.getComputedStyle(me.querySelector('.block-impact--note'));
    block.childNodes[0].childNodes[0].style.setProperty('--background-color-accent', style.backgroundColor); // set global for this element
    Array.from(block.querySelectorAll('.timeline-card__description .fr-view :first-child')).forEach(function(el) {
      if (el.textContent.indexOf('FLAG::EDGECOLOR::')!==-1) { // find colours defined inside descriptions
        const value = el.innerHTML.substr(0,30).split('::')[2];
        el.closest('.timeline-card').style.setProperty('--background-color-accent', value);
        el.innerHTML = el.innerHTML.replace(`FLAG::EDGECOLOR::${value}::`,'');
      }
      me.parentNode && me.parentNode.removeChild(me);
    });
  });
}
