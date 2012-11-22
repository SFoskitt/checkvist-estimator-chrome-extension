/*
 * @author Warren Harrison / http://hungry-media.com/
 */

/******************************************************************************

TO DO: 

******************************************************************************/

var url = document.location.toString();
var urlParts = url.split('/');
var rootAPIUrl = urlParts[0] + '//' + urlParts[2] + '/';
var listID = urlParts.pop().replace('#','');
var allTasks = {};
var extensionOptions = {};
var tagPatternMins = /^([0-9]+)m/;
var tagPatternHrs = /^([0-9]+)h/;
var tagPatternDays = /^([0-9]+)d/;

chrome.extension.sendRequest({command: "getOptions"}, function(response) {
  extensionOptions = response.answer;
  tagPatternMins = extensionOptions.minutes.prefix ?
                      new RegExp('^' + extensionOptions.minutes.tag + '([0-9]+)$') : 
                      new RegExp('^([0-9]+)' + extensionOptions.minutes.tag + '$');
  tagPatternHrs = extensionOptions.hours.prefix ?
                      new RegExp('^' + extensionOptions.hours.tag + '([0-9]+)$') : 
                      new RegExp('^([0-9]+)' + extensionOptions.hours.tag + '$');
  tagPatternDays = extensionOptions.days.prefix ? 
                      new RegExp('^' + extensionOptions.days.tag + '([0-9]+)$') : 
                      new RegExp('^([0-9]+)' + extensionOptions.days.tag + '$');
});


function main(){
  parseCurrentTags();
}

function parseCurrentTags(){
  $.getJSON(rootAPIUrl + 'checklists/' + listID + '/tasks.json').complete( function(data){
    var listData = JSON.parse(data.responseText);
    for(var task in listData){
      var thisID = listData[task].id;
      allTasks[thisID] = listData[task];
      allTasks[thisID]['minutes'] = 0;
      allTasks[thisID]['changed'] = false;
      distillToMinutes(thisID);
    }
    recalculateAll();
  });
}

function recalculateAll(){
  for(var task in allTasks){
    allTasks[task].minutes = calculateMinutes(allTasks[task]);
    logIfChanged(allTasks[task]);
  }
}

function distillToMinutes(taskID){
  var thisTask = allTasks[taskID];
  var thisTaskTags = Object.keys(thisTask.tags);
  for( var tag in thisTaskTags ){
    var tagText = thisTaskTags[tag].toString();
    var matchesMins = tagPatternMins.exec(tagText);
    var matchesHrs = tagPatternHrs.exec(tagText);
    var matchesDays = tagPatternDays.exec(tagText);

    if( matchesMins && matchesMins.length > 0 ){ 
      thisTask.minutes = parseInt(matchesMins[1]);
    }else if( matchesHrs && matchesHrs.length > 0 ){ 
      thisTask.minutes = parseInt(matchesHrs[1] * 60);
    }else if( matchesDays && matchesDays.length > 0 ){
      thisTask.minutes = parseInt(matchesDays[1] * 60 * extensionOptions.days.hoursPer);
    }
  }
}

function calculateMinutes(task){
  if( task.tasks > 0 ){
    task.minutes = 0;
    for( childTask in task.tasks ){
      task.minutes += calculateMinutes(allTasks[task.tasks[childTask]]);
      task.changed = true;
    }
  }
  return task.minutes;
}

function logIfChanged(task){
  if( task.changed ){
    console.log(task);
  }
}

var numChanged = function(){
  n = 0
  for(var task in allTasks){
    if( allTasks[task].changed ){
      n++;
    }
  }
  return n;
};

/*
function doRecalculateTags() {
  $.getJSON(rootAPIUrl + 'checklists/' + listID + '/tasks.json').complete( function(data){
//    console.log(data.responseText);
    var listData = JSON.parse(data.responseText);
    console.log(listData);
    for(var task in listData){
      var thisID = listData[task].id;
      allTasks[thisID] = listData[task];
      allTasks[thisID]['minutes'] = 0;
      allTasks[thisID]['hours'] = 0;
      allTasks[thisID]['days'] = 0;
      allTasks[thisID]['changed'] = false;
    }
    for( var t in allTasks ){
      if( allTasks[t].parent_id == 0 ){
        getChildTotal(allTasks[t].id);
      }
    }
    var currTask = 0;
    for( var t in allTasks ){
      var thisTask = allTasks[t]
      scrubCurrentTags(thisTask.id);
      thisTask.minutes = parseInt(thisTask.minutes);
      if( thisTask.minutes > 0 && extensionOptions.minutes.generate ){
        var thisTag = generateTag(thisTask.id, 'm');
        thisTask.tags[thisTag] = false;
        thisTask.changed = true;
      }
      if( thisTask.hours > 0 && extensionOptions.hours.generate ){
        var thisTag = generateTag(thisTask.id, 'h');
        thisTask.tags[thisTag] = false;
        thisTask.changed = true;
      }
      if( thisTask.days > 0 && extensionOptions.days.generate ){
        var thisTag = generateTag(thisTask.id, 'd');
        thisTask.tags[thisTag] = false;
        thisTask.changed = true;
      }
      if( thisTask.changed ){ 
        currTask++;
        var isLast = false;
        if( currTask == numChanged() ){ isLast = true; }
        updateTaskOnServer(thisTask.id, isLast);
      }
    }
  });
}



function getChildTotal(taskID){
	var thisTask = allTasks[taskID];
	if( thisTask.tasks.length == 0 ){
		// has no children, set its hours
		var tags = Object.keys(thisTask.tags);
		for( var tag in tags ){
			var tagText = tags[tag].toString();
			// capture regexp results
      var matchesMins = tagPatternMins.exec(tagText);
      if( matchesMins && matchesMins.length > 0 ){ 
        thisTask.minutes = matchesMins[1];
        thisTask.hours = Math.ceil(thisTask.minutes / 60);
        thisTask.days = Math.ceil(thisTask.hours / extensionOptions.days.hoursPer);
      }
			var matchesHrs = tagPatternHrs.exec(tagText);
			if( matchesHrs && matchesHrs.length > 0 ){ 
			  thisTask.hours = matchesHrs[1];
			  thisTask.days = Math.ceil(thisTask.hours / extensionOptions.days.hoursPer);
        thisTask.mins = thisTask.hours * 60;
		  }
			var matchesDays = tagPatternDays.exec(tagText);
			if( matchesDays && matchesDays.length > 0 ){ 
			  thisTask.days = matchesDays[1];
			  thisTask.hours = thisTask.days * extensionOptions.days.hoursPer;
        thisTask.mins = thisTask.hours * 60;
		  }
		}
	}else{
		for( var child in thisTask.tasks){
			getChildTotal(thisTask.tasks[child]);
			if( extensionOptions.includeClosed || 
			    ( extensionOptions.includeClosed == false && 
			      allTasks[thisTask.tasks[child]].status == 0 ) 
			){
        thisTask.mins += parseInt(allTasks[thisTask.tasks[child]].mins);
        thisTask.hours += parseInt(allTasks[thisTask.tasks[child]].hours);
		  }
			thisTask.days = Math.ceil(thisTask.hours / extensionOptions.days.hoursPer);
		}
	}
}

function generateTag(id, type){
  var thisTask = allTasks[id];
	
  switch (type){
    case 'm':
      return extensionOptions.minutes.prefix ? 
              extensionOptions.minutes.tag + thisTask.minutes : 
              thisTask.minutes + extensionOptions.minutes.tag;
      break;
    case 'h':
      return extensionOptions.hours.prefix ? 
              extensionOptions.hours.tag + thisTask.hours : 
              thisTask.hours + extensionOptions.hours.tag;
      break;
    case 'd':
      return extensionOptions.days.prefix ? 
              extensionOptions.days.tag + thisTask.days : 
              thisTask.days + extensionOptions.days.tag;
      break;
  }
}

function scrubCurrentTags(id){
	taskTags = Object.keys( allTasks[id].tags );
	
	var numDeletions = 0;
	for( var t in taskTags ){
    var minsTag = generateTag(id, 'm');
    var hoursTag = generateTag(id, 'h');
	  var daysTag = generateTag(id, 'd');
    if( tagPatternMins.test( taskTags[t] ) ){
      // don't bother to delete if the tag already matches the minutes
      if( !extensionOptions.minutes.generate || minsTag != taskTags[t] ){
        delete allTasks[id].tags[taskTags[t]];
        allTasks[id].changed = true;
        numDeletions++;
      }
    }
		if( tagPatternHrs.test( taskTags[t] ) ){
			// don't bother to delete if the tag already matches the hours
			if( !extensionOptions.hours.generate || hoursTag != taskTags[t] ){
				delete allTasks[id].tags[taskTags[t]];
				allTasks[id].changed = true;
				numDeletions++;
			}
		}
		if( tagPatternDays.test( taskTags[t] ) ){
			// don't bother to delete if the tag already matches the days
			if( !extensionOptions.days.generate || daysTag != taskTags[t] ){
				delete allTasks[id].tags[taskTags[t]];
				allTasks[id].changed = true;
				numDeletions++;
			}
		}
	}
  return numDeletions > 0;
}

function updateTaskOnServer( taskID, isLast ){
  if( allTasks[taskID].changed == false ){
    return false;
  }
	var updateURL = rootAPIUrl + 'checklists/' + listID + '/tasks/' + taskID + '.json';
	var tagsCommaDelimited = Object.keys( allTasks[taskID].tags ).join(',');
	// work around fact that API will not set tags to empty string
	if( tagsCommaDelimited == '' ){ 
	  tagsCommaDelimited = ',';
	}
	console.log('Setting tags: ' + tagsCommaDelimited + ' (for task: ' + allTasks[taskID].content + ')');
	$.ajax({
		type: 'PUT', 
		url: updateURL,
		data: {
			'task': { 
				'tags':  tagsCommaDelimited
			}
		}
	}).complete( function(d){
	  // only reload page if we've updated the last changed tag
    if( isLast ){ document.location.reload(); }
	  return true;
	});
}

function initTimeTagsClasses() {

  var count = 0;

  var doSetTags = function() {
    // If content is loaded or 10 seconds passed
    // Should _not_ consider tags in list names and wait for real content
    var hasLoadedContentWithTags = ($("#tags_content .tag").length + $(".topLevel .tag").length) > 0;
    if (hasLoadedContentWithTags || count > 100) {

      $(".tag").each(function(t) {
        var txt = $(this).text();
        if (tagPatternMins.test(txt) || tagPatternHrs.test(txt) || tagPatternDays.test(txt)) {
          $(this).addClass('timeTag');
        }
      });
    }
    else {
      count++;
      setTimeout(doSetTags, 100);
    }
  };

  doSetTags();
}

initTimeTagsClasses();

*/