var $result = null;

function isASCII(str) {
	return /^[\x00-\x7F]*$/.test(str);
}

var seriesObject = {};

// This function iterates through dataSet recursively and adds new HTML strings
// to the output array passed into it
// Make output a struct with an html entry and some more keys
function dumpDataSet(dataSet, output) {

	if (Array.isArray(output)) {
		output = { "html": [], "StudyInstanceUID": "", "SeriesInstanceUID": "" };
	}
	
	var validElementNames = {
		"x00100010": "PatientName",
		"x00100020": "PatientID",
		"x00100030": "PatientBirthDate",
		"x00100040": "Sex",
		"x00101010": "Age",
		"x00200011": "SeriesNumber",
		"x0020000e": "SeriesInstanceUID",
		"x0008103e": "SeriesDescription",
		"x0020000d": "StudyInstanceUID",
		"x00080020": "StudyDate",
		"x00080030": "StudyTime",
		"x00200013": "InstanceNumber",
		"x00201041": "SliceLocation",
		"x00180024": "SequenceName",
		"x00180020": "ScanningSequence",
		"x00180021": "SequenceVariant",
		"x00180022": "ScanOptions",
		"x00180023": "MRAcquisitionType",
		"x00080090": "ReferringPhysician",
		"x00080060": "Modality"
	};
	var validElements = Object.keys(validElementNames);
	
	var captureValues = {};
	
	// the dataSet.elements object contains properties for each element parsed.  The name of the property
	// is based on the elements tag and looks like 'xGGGGEEEE' where GGGG is the group number and EEEE is the
	// element number both with lowercase hexadecimal letters.  For example, the Series Description DICOM element 0008,103E would
	// be named 'x0008103e'.  Here we iterate over each property (element) so we can build a string describing its
	// contents to add to the output array
	try {
		for (var propertyName in dataSet.elements) {
			// lets use everything again
			//if (!validElements.includes(propertyName))
			//	continue;
			
			var element = dataSet.elements[propertyName];
			
			function propertyNameToGroupTag(str) {
				var group = str.slice(1,5);
				var tag = str.slice(5,9);
				return "(" + group + "," + tag + ")";
			}

			// The output string begins with the element tag, length and VR (if present).  VR is undefined for
			// implicit transfer syntaxes
			var text = "<span class='" + propertyName + "'>" + propertyNameToGroupTag(propertyName) + ": ";
			if (propertyName in validElementNames) {
				text = "<span class='" + validElementNames[propertyName] + "'>" + propertyNameToGroupTag(propertyName) + " - " + validElementNames[propertyName] + ": ";
			} else {
				// is it in the list of tag names?
				if (propertyName.toLowerCase() in tags) {
					text = "<span class='" + propertyName + "'>" + propertyNameToGroupTag(propertyName) + " - " + tags[propertyName] + ": ";
				}
			}
			//text += " length=" + element.length;
			
			//if (element.hadUndefinedLength) {
			//    text += " <strong>(-1)</strong>";
			//}
			//text += "; ";
			
			//if (element.vr) {
			//    text += " VR=" + element.vr + "; ";
			//}
			
			var color = 'black';
			var title = "";
			
			// Here we check for Sequence items and iterate over them if present.  items will not be set in the
			// element object for elements that don't have SQ VR type.  Note that implicit little endian
			// sequences will are currently not parsed.
			if (element.items) {
				output.html.push('<li>' + text + '</li>');
				output.html.push('<ul style="list-style-type: none; overflow-x: auto;">');
				
				// each item contains its own data set so we iterate over the items
				// and recursively call this function
				var itemNumber = 0;
				element.items.forEach(function (item) {
					output.html.push('<li>Item #' + itemNumber++ + ' ' + item.tag + '</li>')
					output.html.push('<ul style="list-style-type: none; overflow-x: auto;">');
					//var output2 = [];
					dumpDataSet(item.dataSet, output);
					//output.html += output2.html;
					output.html.push('</ul>');
				});
				output.html.push('</ul>');
			}
			else if (element.fragments) {
				output.html.push('<li>' + text + '</li>');
				output.html.push('<ul style="list-style-type: none; overflow-x: auto;">');
				
				// each item contains its own data set so we iterate over the items
				// and recursively call this function
				var itemNumber = 0;
				element.fragments.forEach(function (fragment) {
					var basicOffset;
					if (element.basicOffsetTable) {
						basicOffset = element.basicOffsetTable[itemNumber];
					}
					
					var str = '<li>Fragment #' + itemNumber++ + ' offset = ' + fragment.offset;
					str += '(' + basicOffset + ')';
					str += '; length = ' + fragment.length + '</li>';
					output.html.push(str);
				});
				output.html.push('</ul>');
			}
			else {
				
				
				// if the length of the element is less than 128 we try to show it.  We put this check in
				// to avoid displaying large strings which makes it harder to use.
				if (element.length < 128) {
					// Since the dataset might be encoded using implicit transfer syntax and we aren't using
					// a data dictionary, we need some simple logic to figure out what data types these
					// elements might be.  Since the dataset might also be explicit we could be switch on the
					// VR and do a better job on this, perhaps we can do that in another example
					
					// First we check to see if the element's length is appropriate for a UI or US VR.
					// US is an important type because it is used for the
					// image Rows and Columns so that is why those are assumed over other VR types.
					var perhapsNumber = -1;
					if (element.length === 2) {
						 perhapsNumber = dataSet.uint16(propertyName);
					}
					else if (element.length === 4) {
						 perhapsNumber = dataSet.uint32(propertyName);
					}
					
					// Next we ask the dataset to give us the element's data in string form.  Most elements are
					// strings but some aren't so we do a quick check to make sure it actually has all ascii
					// characters so we know it is reasonable to display it.
					var str = dataSet.string(propertyName);
					var stringIsAscii = isASCII(str);
					
					if (stringIsAscii) {
						// the string will be undefined if the element is present but has no data
						// (i.e. attribute is of type 2 or 3 ) so we only display the string if it has
						// data.  Note that the length of the element will be 0 to indicate "no data"
						// so we don't put anything here for the value in that case.
						if (str !== undefined) {
							if (validElementNames[propertyName] == "SeriesInstanceUID") {
								captureValues["SeriesInstanceUID"] = str;
								output.SeriesInstanceUID = str;
							}
							if (validElementNames[propertyName] == "StudyInstanceUID") {
								captureValues["StudyInstanceUID"] = str;
								output.StudyInstanceUID = str;
							}
							if (validElementNames[propertyName] == "SeriesDescription") {
								captureValues["SeriesDescription"] = str;
							}
							if (validElementNames[propertyName] == "SeriesNumber") {
								captureValues["SeriesNumber"] = str;
							}
							if (validElementNames[propertyName] == "SequenceName") {
								captureValues["SequenceName"] = str;
							}
							if (validElementNames[propertyName] == "ScanningSequence") {
								captureValues["ScanningSequence"] = str;
							}
							if (validElementNames[propertyName] == "PatientID") {
								captureValues["PatientID"] = str;
							}
							if (validElementNames[propertyName] == "Modality") {
								captureValues["Modality"] = str;
							}
							if (validElementNames[propertyName] == "StudyDate") {
								var y = str.slice(0,4);
								var m = str.slice(4,6) - 1;
								var d = str.slice(6,8);
								var dat = new Date(y,m,d);
								captureValues["StudyDate"] = dat.toDateString();
							}
							if (str == "" && perhapsNumber != -1) {
								str = perhapsNumber + "";
							}
							text += '"' + safetext(str) + '"';
						}
					}
					else {
						if (element.length !== 2 && element.length !== 4) {
							color = '#C8C8C8';
							// If it is some other length and we have no string
							text += "<i>binary data</i>";
						}
					}
					
					if (element.length === 0) {
						color = '#C8C8C8';
						title = "no value stored in DICOM header";
					}
					
				}
				else {
					color = '#C8C8C8';
					
					// Add text saying the data is too long to show...
					text += "<i>data too long to show</i>";
				}
				// finally we add the string to our output array surrounded by li elements so it shows up in the
				// DOM as a list
				output.html.push('<li style="color:' + color + ';" ' + (title != "" ? 'title="' + title + '"' : "") + '>' + text + '</li>');
				
			}
		}
	} catch (err) {
		var ex = {
			exception: err,
			output: output.html
		}
		throw ex;
	}
	if (typeof captureValues["SeriesInstanceUID"] !== "undefined") {
		if (typeof seriesObject[captureValues["SeriesInstanceUID"]] == "undefined") {
			seriesObject[captureValues["SeriesInstanceUID"]] = { 
				"Files": 0,
				"SeriesNumber": (typeof captureValues["SeriesNumber"] != 'undefined')?captureValues["SeriesNumber"]:"", 
				"SeriesDescription": (typeof captureValues["SeriesDescription"] != 'undefined')?captureValues["SeriesDescription"]:"", 
				"SequenceName": (typeof captureValues["ScanningSequence"] != 'undefined')?captureValues["ScanningSequence"]:"", 
				"PatientID": (typeof captureValues["PatientID"] != 'undefined')?captureValues['PatientID']:"", 
				"StudyDate": (typeof captureValues["StudyDate"] != 'undefined')?captureValues['StudyDate']:"", 
				"Modality": (typeof captureValues["Modality"] != 'undefined')?captureValues['Modality']:"" 
		    };
		}
		seriesObject[captureValues["SeriesInstanceUID"]]["Files"] += 1;
	}
}

var safetext = function (text) {
	var table = {
		'<': 'lt',
		'>': 'gt',
		'"': 'quot',
		'\'': 'apos',
		'&': 'amp',
		'\r': '#10',
		'\n': '#13'
	};
	if (typeof text == 'undefined') {
		return "";
	}
	
	return text.toString().replace(/[<>"'\r\n&]/g, function (chr) {
		return '&' + table[chr] + ';';
	});
};

// parse the DOM to get a JSON of events and characters
function createJSONStructure() {
	var s = {
		participants: {}, // characters are the participants (PatientID)
		events: [] // events are the individual series (participant ids) by event (in order of display)
	};
	var _events = {};
	jQuery('#results ul.image').each(function () {
		var patientid = jQuery(this).find('span.PatientID').text();
		if (typeof s.participants[patientid] == 'undefined') {
			var k = patientid.replace('PatientID: ', "").replace(/\"/g, "");
			s.participants[k] = {
				id: k,
				patientid: k,
				affiliation: "light"
			};
		}
	});
	
	// now create the events
	// we need to sort the  events as well, the order is kept in the visualization
	jQuery('#results ul.image').each(function () {
		var patientid = jQuery(this).find('span.PatientID').text();
		patientid = patientid.replace('PatientID: ', "").replace(/\"/g, "");
		
		var sequencename = jQuery(this).find('span.ScanningSequence').text();
		sequencename = sequencename.replace('SequenceName: ', "").replace(/\"/g, "");
		
		var seriesnumber = jQuery(this).find('span.SeriesNumber').text();
		seriesnumber = seriesnumber.replace('SeriesNumber: ', "").replace(/\"/g, "");
		
		var referringphysician = jQuery(this).find('span.ReferringPhysician').text();
		referringphysician = referringphysician.replace('ReferringPhysician: "EventName:', "").replace(/\"/g, "");
		
		// an event is the same sequence name and series number at a given referring physician event
		var event_name = sequencename + "_" + seriesnumber + "_" + referringphysician;
		var ev = {
			'sequencename': sequencename,
			'seriesnumber': seriesnumber,
			'event': referringphysician,
			'patientid': patientid,
			'event_name': event_name
		};
		
		if (typeof _events[event_name] == 'undefined') {
			_events[event_name] = [ev];
		} else {
			var found = false;
			for (var i = 0; i < _events[event_name].length; i++) {
				if (_events[event_name][i].patientid == patientid) {
					found = true;
					break;
				}
			}
			if (!found)
			_events[event_name].push(ev);
		}
	});
	// an array of arrays
	_events = Object.values(_events);
	
	// now sort the events by event and seriesnumber
	_events.sort(function (a, b) {
		var aa = a[0]; // all the events in this list share the seriesnumber and event name
		var bb = b[0];
		if (parseInt(aa.event) == parseInt(bb.event)) {
			// if its the same event sort by series number
			return parseInt(aa.seriesnumber) - parseInt(bb.seriesnumber);
		}
		return parseInt(aa.event) - parseInt(bb.event);
	});
	
	for (var i = 0; i < _events.length; i++) {
		var ss = {
			'participants': [],
			'event': _events[i][0].event,
			'seriesnumber': _events[i][0].seriesnumber
		};
		for (var j = 0; j < _events[i].length; j++) {
			ss.participants.push(_events[i][j].patientid);
		}
		s.events.push(ss);
	}
	
	s.participants = Object.values(s.participants);
	return s;
}

var historyHTMLBuffer = []; // an array of html values from previous meta fields

// some d3 to get a colored grid with the individual DICOM files
function setupGrid(numberOfFiles) {
	var w = jQuery('#grid').width();
	var h = jQuery('#grid').height();
	var area = w*h;
	var ar = w/h;
	var areaPerTile = area / numberOfFiles;
	var cellSize = [ Math.sqrt(areaPerTile), Math.sqrt(areaPerTile) ];
	var columns = Math.floor(w/cellSize[0]);
	var rows = Math.floor(h/cellSize[1]);
	
	// use the data from detailList
	function gridData() {
		var data = new Array();
		var xpos = 0; //starting xpos and ypos at 1 so the stroke will show when we make the grid below
		var ypos = 0;
		var width = cellSize[0];
		var height = cellSize[1];
		var click = 0;
		var counter = 0;
		
		// iterate for rows	
		for (var row = 0; row < rows; row++) {
			data.push( new Array() );
			
			// iterate for cells/columns inside rows
			for (var column = 0; column < columns; column++) {
				data[row].push({
					x: xpos,
					y: ypos,
					width: width,
					height: height,
					counter: counter,
					click: 0
				})
				// increment the x position. I.e. move it over by 50 (width variable)
				xpos += width;
				counter++;
			}
			// reset the x position after a row is complete
			xpos = 0;
			// increment the y position for the next row. Move it down 50 (height variable)
			ypos += height;	
		}
		return data;
	}
	
	var gridData = gridData();	
	// I like to log the data to the console for quick debugging
	//console.log(gridData);
	
	var grid = d3.select("#grid")
	.append("svg")
	.attr("width",w + "px")
	.attr("height",h + "px");
	
	var row = grid.selectAll(".row")
	.data(gridData)
	.enter().append("g")
	.attr("row-id", function(d, i) { return i; })
	.attr("class", "row");
	
	// default coloring of a cell based on the index
	var myColor = d3.scaleSequential().domain([0, numberOfFiles]).interpolator(d3.interpolateYlOrBr /*d3.interpolateViridis*/);
	
	var column = row.selectAll(".square")
	.data(function(d) { return d; })
	.enter().append("rect")
	.attr("class","square")
	.attr("index", function (d) { 
		return d.counter; 
	})
	.attr("x", function(d) { return d.x; })
	.attr("y", function(d) { return d.y; })
	.attr("width", function(d) { return d.width; })
	.attr("height", function(d) { return d.height; })
	.style("fill", function (d) {
		return myColor(d.counter); 
	})
	//.style("stroke", "#222")
	.on('click', function(ev, d) {
		if (d.click == 0) {
			// first click remember the current color
			d3.select(this).attr('series-color', d3.select(this).style("fill"));
		}
		// remove the text from that old field
		//if (d.click != 0) {
		//	jQuery('#meta-data-' + (d.click)%4).html("");
		//}
		d.click ++;
		var type = (d.click)%4;
		if (type == 0 ) { d3.select(this).style("fill","#fff"); }
		if (type == 1 ) { d3.select(this).style("fill","#2C93E8"); }
		if (type == 2 ) { d3.select(this).style("fill","#F56C4E"); }
		if (type == 3 ) { d3.select(this).style("fill", d3.select(this).attr('series-color')); 
			jQuery('#meta-data-0').html("");
			jQuery('#meta-data-0-header').html("");
	    }
		// fill in the meta-data
		var index = d.counter;
		if (index < detailsList.length && type >= 0 && type < 3) {
			var zipPath = detailsList[index].zipEntryName.replace("/", " / ");
			// always add to the first field and move the other forward
			if (jQuery('#meta-data-0-header').html() != zipPath) {
				jQuery('#meta-data-2').html(jQuery('#meta-data-1').html());
				jQuery('#meta-data-2-header').html(jQuery('#meta-data-1-header').html());
				jQuery('#meta-data-1').html(jQuery('#meta-data-0').html());
				jQuery('#meta-data-1-header').html(jQuery('#meta-data-0-header').html());
				jQuery('#meta-data-0').html(detailsList[index].htmlElem);
				jQuery('#meta-data-0-header').html(zipPath);
			}
		}
	});
	
}

// keep the last entry, in detailsList we only add more at the end
var lastColoredIndex = 0;
var seriesColorCache = {};
function colorGrid() {
	var myColor = d3.scaleSequential().domain([0, detailsList.length]).interpolator(d3.interpolateViridis);
	// go through all the detailsList and color the svg rects
	for (var i = lastColoredIndex; i < detailsList.length; i++) {
		// get the svg element for that i
		var key = detailsList[i].StudyInstanceUID + "-" + detailsList[i].SeriesInstanceUID;
		if (typeof seriesColorCache[key] == 'undefined')
		   seriesColorCache[key] = "#" + Math.floor(Math.random()*16777215).toString(16);
		jQuery('#grid svg rect[index=' + detailsList[i].num + ']').css('fill', seriesColorCache[key]);
	}
	lastColoredIndex = detailsList.length;
}

var detailsList = [];

jQuery(document).ready(function () {
	// Handle file upload logic
	$result = $("#results");
	
	detailsList = [];
	
	$('#file').on('change', function (e) {
		e.preventDefault();
		jQuery('#results').children().remove();
		jQuery('#results').html("");
		var numFilesTotal = 0;
		
		// Closure to capture the file information.
		function handleFile(f) {
			var $title = $("<i>", {
				text: f.name
			});
			var $fileContent = $("<ul>");
			$result.append($title);
			$result.append($fileContent);
			
			var dateBefore = new Date();
			let counter = 0;
			
			JSZip.loadAsync(f)                                   // 1) read the Blob
			.then(function (zip) {
				var dateAfter = new Date();
				$title.append($("<span>", {
					"class": "small",
					text: " (loaded in " + (dateAfter - dateBefore) + "ms)"
				}));
				numFilesTotal = numFilesTotal + Object.keys(zip.files).length;
				jQuery('#stat').html("Number of files: <span id='loadingCounter'>0</span>/" + numFilesTotal.toLocaleString("en-US") + "<br/>Number of series: <span id='number-series'>0</span>");
				
				// here we can setup our grid
				setupGrid(numFilesTotal);
				var updateEvery = Math.min(100, numFilesTotal-1);
				
				zip.forEach(function (relativePath, zipEntry) {  // 2) print entries
					var sanID = zipEntry.name.replace(/\//g, "_").replace(/\./g, "_").replace(/=/g, "_");
					
					// append only first 10 entries
					//if (counter < lazyLoadingLimit) {
					//	$fileContent.append("<li class='image-group' id='" + sanID + "'>[" + (counter + 1) + "] " + zipEntry.name + "</li>");
					//}
					
					(function (nam, zipEntryName, counter) {
						zipEntry.async("uint8array").then(function (data) {
							// console.log("we received the data for " + nam + " - size: " + data.length);
							// parse the data and get all the DICOM tags here... or just one of them...
							dataSet = dicomParser.parseDicom(data);
							var output = { "html": [], "StudyInstanceUID": "", "SeriesInstanceUID": "" };
							dumpDataSet(dataSet, output);
							//								if (counter < lazyLoadingLimit) {
							//									jQuery('#' + sanID).append('<ul class="image">' + output.join('') + '</ul>');
							//								} else {
							detailsList.push({
								'sanID': nam,
								'zipEntryName': zipEntryName,
								'htmlElem': (typeof output.html != "undefined")?output.html.join(''):"",
								'StudyInstanceUID': output.StudyInstanceUID,
								'SeriesInstanceUID': output.SeriesInstanceUID,
								'num': counter + 1 // is this the correct entry or should this be the index in detailsList?
							});
							//								}
							
							// update the seriesObject visual
							jQuery("#series-results").children().remove();
							var ks = Object.keys(seriesObject);
							ks.sort(function (a, b) {
								if (parseInt(seriesObject[a]["SeriesNumber"]) < parseInt(seriesObject[b]["SeriesNumber"]))
								return -1;
							});
							jQuery('#number-series').text(ks.length.toLocaleString("en-US"));
							//alert(safetext('A newline: \n see?'));
							
							
							for (var i = 0; i < ks.length; i++) {
								var sanSeriesInstanceUID = ks[i].replace(/\//g, "_").replace(/\./g, "_");
								const cssRules = {};
								if (i % 2 == 0) {
									cssRules['backgroundColor'] = '#C8C8C8';
									cssRules['textColor'] = '#212529';
								} else {
									cssRules['backgroundColor'] = '#212529';
									cssRules['textColor'] = '#C8C8C8';
								}
								
								jQuery('#series-results').append(`<div class="col-sm-12 col-lg-3 col-md-4 series" 
								id="ser-${sanSeriesInstanceUID}" 
								style="background-color: ${cssRules['backgroundColor']}; color: ${cssRules['textColor']}">
								${safetext(seriesObject[ks[i]]["PatientID"])}, ${seriesObject[ks[i]]["StudyDate"]}
								<br/>${safetext(seriesObject[ks[i]]["SeriesDescription"])}
								<br/>#files: ${seriesObject[ks[i]]["Files"]}
								<br/>SeriesNumber: ${seriesObject[ks[i]]["SeriesNumber"]}
								<br/>Modality: ${seriesObject[ks[i]]["Modality"]}
								</div>`);
							}
							//console.log("finished on zip file");
							
							var loadingCounter = parseInt(jQuery("#loadingCounter").text().replace(",", ""));
							loadingCounter = loadingCounter + 1;
							jQuery("#loadingCounter").text(loadingCounter.toLocaleString("en-US"));
							if (loadingCounter % updateEvery == 0)
							  colorGrid();
						})/*.finally(function() {
							colorGrid();
						});*/
					})(sanID, zipEntry.name, counter);
					counter++;
				});
			}, function (e) {
				$result.append($("<div>", {
					"class": "alert alert-danger",
					text: "Error reading " + f.name + ": " + e.message
				}));
			});
		}
		
		seriesObject = {};
		var files = e.target.files;
		for (var i = 0; i < files.length; i++) {
			handleFile(files[i]);
		}
	});
	
	// lazy load next `lazyLoadingLimit` number of entries
	/*	$(window).scroll(function () {
		const scrollHeight = $(document).height();
		const scrollPosition = $(window).height() + $(window).scrollTop();
		
		if ((scrollHeight - scrollPosition) < 10) {
			const nextList = detailsList.splice(0, lazyLoadingLimit); // detailsList.slice(0, lazyLoadingLimit);
			nextList.map(elem => {
				var e = jQuery("<li class='image-group' id='" + elem['sanID'] + "'>[" + elem['num'] + "] " + elem['zipEntryName'] +
				'<ul class="image">' + elem['htmlElem'] + '</ul>' + "</li>");
				$('#results > ul').append(e);
				
				//$('#results > ul').append("<li class='image-group' id='" + elem['sanID'] + "'>[" + elem['num'] + "] " + elem['zipEntryName'] + "</li>");
				//$('#' + elem['sanID']).append('<ul class="image">' + elem['htmlElem'] + '</ul>');
			});
			
		}
		
		if (scrollPosition > 1200) {
			$("#go-up-arrow").show();
		} else {
			$("#go-up-arrow").hide();
		}
	}); */
	
	jQuery(':file').on('fileselect', function (event, numFiles, label) {
		
		var input = $(this).parents('.input-group').find(':text'),
		log = numFiles > 1 ? numFiles + ' files selected' : label;
		
		if (input.length) {
			input.val(log);
		} else {
			if (log) alert(log);
		}
		
	});

	jQuery('#meta-data-0').parent().on('scroll', function(ev) {
		jQuery('#meta-data-1').parent().scrollTop(jQuery('#meta-data-0').parent().scrollTop());
		jQuery('#meta-data-2').parent().scrollTop(jQuery('#meta-data-0').parent().scrollTop());
	});
	
	
});

// This code will attach `fileselect` event to all file inputs on the page
$(document).on('change', ':file', function () {
	var input = $(this),
	numFiles = input.get(0).files ? input.get(0).files.length : 1,
	label = input.val().replace(/\\/g, '/').replace(/.*\//, '');
	loadingCounter = 0;
	input.trigger('fileselect', [numFiles, label]);
});
