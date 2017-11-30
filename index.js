'use strict';

var alexa;

var Alexa = require('alexa-sdk'),
	async = require('async'),
	request = require('request'),
	ForerunnerDB = require('forerunnerdb'),
	welcomeOutput = "Let's get some stats, what would you like to know?",
	welcomeReprompt = "You can ask for unemployment, CPI or the population.",
	APP_ID = 'amzn1.ask.skill.02cd168d-37f7-4b75-aac1-9093f075db9e',
	fdb,
	db,
	speechOutput,
	reprompt,
	isSlotValid,
	handleDialogState,
	getRequestSlotInfo,
	launchRequestHandler,
	getStatIntentHandler,
	amazonHelpIntentHandler,
	amazonCancelIntentHandler,
	amazonStopIntentHandler,
	sessionEndedRequestHandler;

// Init internal DB
fdb = new ForerunnerDB();
db = fdb.db('apiData');

/**
 * Gets slot data from the slot resolutions data object
 * instead of having to hard-code this path every time
 * we need to look up the ID and name of the slot.
 * @param {Object} slotData The slot data object that Alexa
 * API provided us with.
 * @returns {*} The slot data, or undefined if none is
 * available for the slot.
 */
getRequestSlotInfo = function getRequestSlotInfo (slotData) {
	console.log("slotData: " + JSON.stringify(slotData));
	if (slotData && slotData.resolutions && slotData.resolutions.resolutionsPerAuthority && slotData.resolutions.resolutionsPerAuthority.length && slotData.resolutions.resolutionsPerAuthority[0].values && slotData.resolutions.resolutionsPerAuthority[0].values.length && slotData.resolutions.resolutionsPerAuthority[0].values[0].value) {
		// We resolved a metric, read the required data
		return slotData.resolutions.resolutionsPerAuthority[0].values[0].value;
	}
};

/**
 * Called when a request comes in from a device but has not
 * yet been given any information about what the user wants.
 * This usually happens because the use has said "open ONS"
 * or "ask ONS" etc, but not provided any further info.
 */
launchRequestHandler = function launchRequestHandler () {
	console.log(">>> launchRequestHandler()");
	console.log("Sending :ask command with welcomeOutput");
	this.emit(':ask', welcomeOutput, welcomeReprompt);
};

/**
 * This is the main skill code, and once we know the dialog
 * with the user is complete we build speech output by going
 * and querying the data from the ONS and then building a
 * text string to speak.
 * @param {Object} event
 * @param {Object} context
 */
getStatIntentHandler = function getStatIntentHandler (event, context) {
	var self = this,
		handleDialogComplete;

	console.log("APP_ID: " + alexa.appId);
	console.log(">>> getStatIntentHandler()");
	console.log("Calling handleDialogState()");
	
	/**
	 * Handles the callback from the handleDialogState() method
	 * when the state of the dialog changes.
	 * @param {*} err If passed, the dialog with the user failed.
	 * @param {Boolean} finished If true we should proceed to produce
	 * the final speech output to the user. If false, we have been
	 * informed that the dialog has progressed but is not yet
	 * completed so hold off on saying anything to the user yet.
	 */
	handleDialogComplete = function (err, finished) {
		var speechOutput,
			metric,
			forDate,
			areaData,
			areaName,
			areaId,
			metricUrl1,
			metricUrl2,
			metricOperation,
			metricUnits,
			metricData,
			metricName,
			metricId,
			metricMultiplier,
			metricOnlyUk,
			useLatestAvailable,
			asyncArr,
			requestOnsData,
			originalAreaName;
		
		if (err) {
			// We handle this in handleDialogState instead, this is just
			// a callback to complete the circle but we don't need to handle
			// the error here.
			return;
		}
		
		if (!finished) {
			// Wait for further data
			console.log('Waiting for further input...', JSON.stringify(event), JSON.stringify(context));
			return;
		}
		
		speechOutput = '';
		useLatestAvailable = false;
		metricData = getRequestSlotInfo(self.event.request.intent.slots.metric);
		areaData = getRequestSlotInfo(self.event.request.intent.slots.area);
		forDate = self.event.request.intent.slots.forDate.value;
		
		if (metricData) {
			// We resolved a metric, read the required data
			metricName = metricData.name;
			metricId = metricData.id;
			
			console.log('>>> Getting data for metric', JSON.stringify(metricData));
		} else {
			// We couldn't resolve a metric, ask the user again - right now
			// this code path ends up just telling the user we didn't understand
			// what they wanted.
			
			// TODO: For next version - find out how to get alexa delegate to ask for a particular slot's data
		}
		
		if (areaData) {
			// We resolved a metric, read the required data
			areaName = areaData.name;
			areaId = areaData.id;
			
			console.log('>>> Getting data for area', JSON.stringify(areaData));
		}
		
		// forDate is optional so we'll add it to the output
		// only when we have a valid forDate
		if (isSlotValid(self.event.request, "forDate")) {
			// Sanitise date by cutting all other data except year from it
			if (forDate && forDate.length > 4) {
				forDate = forDate.substr(0, 4);
			}
			
			console.log('>>> Getting data for date', forDate);
		} else {
			useLatestAvailable = true;
			console.log('>>> Getting data for latest available date');
		}
		
		// Default to unitedKingdom - if you change this, must be a valid area id
		// as defined in the Alexa developer portal for this skill
		if (!areaId) {
			areaId = 'unitedKingdom';
			areaName = 'the United Kingdom';
		}
		
		originalAreaName = areaName;
		
		// Get the metric value that the user is looking for - start with area-based metrics and then
		// fall back to non-area-based metrics
		console.log('>>> Checking for area-based metric matching: ' + metricId + '_' + areaId);
		switch (metricId + '_' + areaId) {
			case 'population_unitedKingdom':
				metricUrl1 = 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/ukpop/data';
				metricUnits = '';
				metricMultiplier = 1;
				
				if (useLatestAvailable) {
					speechOutput += 'The latest ' + metricName;
				} else {
					speechOutput += 'The ' + metricName + ' in ' + forDate;
				}
				
				speechOutput += ' for ' + areaName + ',';
				break;
			
			case 'population_greatBritain':
				metricUrl1 = 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/gbpop/data';
				metricUnits = '';
				metricMultiplier = 1;
				
				if (useLatestAvailable) {
					speechOutput += 'The latest ' + metricName;
				} else {
					speechOutput += 'The ' + metricName + ' in ' + forDate;
				}
				
				speechOutput += ' for ' + areaName + ',';
				break;
			
			case 'population_england':
				metricUrl1 = 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/enpop/data';
				metricUnits = '';
				metricMultiplier = 1;
				
				if (useLatestAvailable) {
					speechOutput += 'The latest ' + metricName;
				} else {
					speechOutput += 'The ' + metricName + ' in ' + forDate;
				}
				
				speechOutput += ' for ' + areaName + ',';
				break;
			
			case 'population_wales':
				metricUrl1 = 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/wapop/data';
				metricUnits = '';
				metricMultiplier = 1;
				
				if (useLatestAvailable) {
					speechOutput += 'The latest ' + metricName;
				} else {
					speechOutput += 'The ' + metricName + ' in ' + forDate;
				}
				
				speechOutput += ' for ' + areaName + ',';
				break;
			
			case 'population_scotland':
				metricUrl1 = 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/scpop/data';
				metricUnits = '';
				metricMultiplier = 1;
				
				if (useLatestAvailable) {
					speechOutput += 'The latest ' + metricName;
				} else {
					speechOutput += 'The ' + metricName + ' in ' + forDate;
				}
				
				speechOutput += ' for ' + areaName + ',';
				break;
			
			case 'population_northernIreland':
				metricUrl1 = 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/nipop/data';
				metricUnits = '';
				metricMultiplier = 1;
				
				if (useLatestAvailable) {
					speechOutput += 'The latest ' + metricName;
				} else {
					speechOutput += 'The ' + metricName + ' in ' + forDate;
				}
				
				speechOutput += ' for ' + areaName + ',';
				break;
			
			case 'population_englandAndWales':
				metricUrl1 = 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/ewpop/data';
				metricUnits = '';
				metricMultiplier = 1;
				
				if (useLatestAvailable) {
					speechOutput += 'The latest ' + metricName;
				} else {
					speechOutput += 'The ' + metricName + ' in ' + forDate;
				}
				
				speechOutput += ' for ' + areaName + ',';
				break;
			
			case 'unemployment_unitedKingdom':
				metricUrl1 = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/data';
				metricUnits = ' percent';
				metricMultiplier = 1;
				
				if (useLatestAvailable) {
					speechOutput += 'The latest ' + metricName;
				} else {
					speechOutput += 'The ' + metricName + ' in ' + forDate;
				}
				
				speechOutput += ' for ' + areaName + ',';
				break;
			
			case 'unemployment_england':
				metricUrl1 = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/ycnl/lms/data';
				metricUnits = ' percent';
				metricMultiplier = 1;
				
				if (useLatestAvailable) {
					speechOutput += 'The latest ' + metricName;
				} else {
					speechOutput += 'The ' + metricName + ' in ' + forDate;
				}
				
				speechOutput += ' for ' + areaName + ',';
				break;
			
			case 'unemployment_scotland':
				metricUrl1 = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/ycnn/lms/data';
				metricUnits = ' percent';
				metricMultiplier = 1;
				
				if (useLatestAvailable) {
					speechOutput += 'The latest ' + metricName;
				} else {
					speechOutput += 'The ' + metricName + ' in ' + forDate;
				}
				
				speechOutput += ' for ' + areaName + ',';
				break;
			
			case 'unemployment_wales':
				metricUrl1 = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/ycnm/lms/data';
				metricUnits = ' percent';
				metricMultiplier = 1;
				
				if (useLatestAvailable) {
					speechOutput += 'The latest ' + metricName;
				} else {
					speechOutput += 'The ' + metricName + ' in ' + forDate;
				}
				
				speechOutput += ' for ' + areaName + ',';
				break;
			
			case 'unemployment_northernIreland':
				metricUrl1 = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/zsfb/lms/data';
				metricUnits = ' percent';
				metricMultiplier = 1;
				
				if (useLatestAvailable) {
					speechOutput += 'The latest ' + metricName;
				} else {
					speechOutput += 'The ' + metricName + ' in ' + forDate;
				}
				
				speechOutput += ' for ' + areaName + ',';
				break;
			
			default:
				console.log('>>> No area-based metric found matching: ' + metricId + '_' + areaId);
				console.log('>>> Checking for non-area-based metric matching: ' + metricId);
				switch (metricId) {
					case 'wageGrowth':
						metricUrl1 = 'https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/earningsandworkinghours/timeseries/kac3/lms/data';
						metricUnits = ' percent';
						metricMultiplier = 1;
						
						if (useLatestAvailable) {
							speechOutput += 'The latest ' + metricName;
						} else {
							speechOutput += 'The ' + metricName + ' in ' + forDate;
						}
						
						if (areaId !== 'unitedKingdom') {
							speechOutput += ' is only available for the United Kingdom,';
						} else {
							speechOutput += ' for the United Kingdom,';
						}
						
						areaName = "United Kingdom";
						break;
					
					case 'unemploymentFemale':
						metricUrl1 = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsz/lms/data';
						metricUnits = ' percent';
						metricMultiplier = 1;
						
						if (useLatestAvailable) {
							speechOutput += 'The latest ' + metricName;
						} else {
							speechOutput += 'The ' + metricName + ' in ' + forDate;
						}
						
						if (areaId !== 'unitedKingdom') {
							speechOutput += ' is only available for the United Kingdom,';
						} else {
							speechOutput += ' for the United Kingdom,';
						}
						
						areaName = "United Kingdom";
						break;
					
					case 'unemploymentMale':
						metricUrl1 = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsy/lms/data';
						metricUnits = ' percent';
						metricMultiplier = 1;
						
						if (useLatestAvailable) {
							speechOutput += 'The latest ' + metricName;
						} else {
							speechOutput += 'The ' + metricName + ' in ' + forDate;
						}
						
						if (areaId !== 'unitedKingdom') {
							speechOutput += ' is only available for the United Kingdom,';
						} else {
							speechOutput += ' for the United Kingdom,';
						}
						
						areaName = "United Kingdom";
						break;
					
					case 'unemploymentDifferenceMaleFemale':
						metricUrl1 = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsy/lms/data';
						metricUrl2 = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsz/lms/data';
						metricUnits = ' percent';
						metricMultiplier = 1;
						metricOperation = 'difference';
						
						if (useLatestAvailable) {
							speechOutput += 'The latest ' + metricName;
						} else {
							speechOutput += 'The ' + metricName + ' in ' + forDate;
						}
						
						if (areaId !== 'unitedKingdom') {
							speechOutput += ' is only available for the United Kingdom,';
						} else {
							speechOutput += ' for the United Kingdom,';
						}
						
						areaName = "United Kingdom";
						break;
					
					case 'unemployment':
						metricUrl1 = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/data';
						metricUnits = ' percent';
						metricMultiplier = 1;
						
						if (useLatestAvailable) {
							speechOutput += 'The latest ' + metricName;
						} else {
							speechOutput += 'The ' + metricName + ' in ' + forDate;
						}
						
						if (areaId !== 'unitedKingdom') {
							speechOutput += ' is available for the United Kingdom, Wales, Northern Island and Scotland, for the United Kingdom,';
						} else {
							speechOutput += ' for the United Kingdom,';
						}
						
						areaName = "United Kingdom";
						break;
					
					case 'cpi':
						metricUrl1 = 'https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/data';
						metricUnits = ' percent';
						metricMultiplier = 1;
						
						if (useLatestAvailable) {
							speechOutput += 'The latest ' + metricName;
						} else {
							speechOutput += 'The ' + metricName + ' in ' + forDate;
						}
						
						if (areaId !== 'unitedKingdom') {
							speechOutput += ' is only available for the United Kingdom,';
						} else {
							speechOutput += ' for the United Kingdom,';
						}
						
						areaName = "United Kingdom";
						break;
					
					case 'cpih':
						metricUrl1 = 'https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/l55o/mm23/data';
						metricUnits = ' percent';
						metricMultiplier = 1;
						
						if (useLatestAvailable) {
							speechOutput += 'The latest ' + metricName;
						} else {
							speechOutput += 'The ' + metricName + ' in ' + forDate;
						}
						
						if (areaId !== 'unitedKingdom') {
							speechOutput += ' is only available for the United Kingdom,';
						} else {
							speechOutput += ' for the United Kingdom,';
						}
						
						areaName = "United Kingdom";
						break;
					
					case 'rpi':
						metricUrl1 = 'https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/czbh/data';
						metricUnits = ' percent';
						metricMultiplier = 1;
						
						if (useLatestAvailable) {
							speechOutput += 'The latest ' + metricName;
						} else {
							speechOutput += 'The ' + metricName + ' in ' + forDate;
						}
						
						if (areaId !== 'unitedKingdom') {
							speechOutput += ' is only available for the United Kingdom,';
						} else {
							speechOutput += ' for the United Kingdom,';
						}
						
						areaName = "United Kingdom";
						break;
					
					case 'gdp':
						metricUnits = ' percent';
						metricMultiplier = 1;
						
						if (useLatestAvailable) {
							metricUrl1 = 'https://www.ons.gov.uk/economy/grossdomesticproductgdp/timeseries/ihyq/pgdp/data';
							speechOutput += 'The latest chained volume measure of GDP quarterly growth';
						} else {
							metricUrl1 = 'https://www.ons.gov.uk/economy/grossdomesticproductgdp/timeseries/ihyp/pn2/data';
							speechOutput += 'The chained volume measure of GDP yearly growth in ' + forDate;
						}
						
						if (areaId !== 'unitedKingdom') {
							speechOutput += ' is only available for the United Kingdom,';
						} else {
							speechOutput += ' for the United Kingdom,';
						}
						
						areaName = "United Kingdom";
						break;
					
					default:
						console.log('ERROR: Metric asked for is not recognised: ' + JSON.stringify(self.event.request));
						return self.emit(':tell', 'I didn\'t understand the metric you were looking for, please try again!');
						break;
				}
				break;
		}
		
		asyncArr = [];
		
		requestOnsData = function (url) {
			return function (complete) {
				request(url, function (err, response, data) {
					complete(err, {response: response, data: data});
				});
			}
		};
		
		if (metricUrl1) {
			asyncArr.push(requestOnsData(metricUrl1));
		}
		
		if (metricUrl2) {
			asyncArr.push(requestOnsData(metricUrl2));
		}
		
		async.parallel(asyncArr, function (err, args) {
			var json1,
				json2,
				yearData1,
				yearData2,
				response1 = args[0].response,
				data1 = args[0].data,
				response2 = args[1] ? args[1].response : undefined,
				data2 = args[1] ? args[1].data : undefined,
				metricValue;
			
			if (err) {
				return self.emit(':tell', 'There was an error accessing the office for national statistics data, please try again later!');
			}
			
			if (response1) {
				if (response1.statusCode !== 200) {
					console.log('ERROR: Received non-200 status code from ONS API: ' + JSON.stringify(response1));
					return self.emit(':tell', 'There was an error accessing the office for national statistics data, please try again later!');
				}
			}
			
			try {
				json1 = JSON.parse(data1);
			} catch (e) {
				console.log('ERROR: JSON parse of data1 from ONS API failed: ' + e, data1);
				return self.emit(':tell', 'There was an error accessing the office for national statistics data, please try again later!');
			}
			
			if (!json1.years) {
				console.log('ERROR: No years data1 available: ', JSON.stringify(json1));
				return self.emit(':tell', 'There was an error accessing the office for national statistics data, please try again later!');
			}
			
			if (response2) {
				if (response2.statusCode !== 200) {
					console.log('ERROR: Received non-200 status code from ONS API: ' + JSON.stringify(response2));
					return self.emit(':tell', 'There was an error accessing the office for national statistics data, please try again later!');
				}
			}
			
			if (data2) {
				try {
					json2 = JSON.parse(data2);
				} catch (e) {
					console.log('ERROR: JSON parse of data2 from ONS API failed: ' + e, data2);
					return self.emit(':tell', 'There was an error accessing the office for national statistics data, please try again later!');
				}
				
				if (!json2.years) {
					console.log('ERROR: No years data2 available: ', JSON.stringify(json2));
					return self.emit(':tell', 'There was an error accessing the office for national statistics data, please try again later!');
				}
			}
			
			console.log('JSON1: ', json1);
			console.log('JSON2: ', json2);
			
			// We now have the JSON! Get the data we are interested in.
			if (!useLatestAvailable) {
				db.collection('responseData1').setData(json1.years);
				
				yearData1 = db.collection('responseData1').findOne({
					year: forDate
				});
				
				if (!yearData1) {
					console.log('WARN: No data available for metric: ' + metricName + ' on date ' + forDate + ' - ATTEMPTING TO USE LATEST FIGURES');
					speechOutput = 'There is no data available for ' + metricName + ' in ' + forDate + ' for ' + originalAreaName + ', however the latest ' + metricName;
					
					if (areaName) {
						speechOutput += " for " + areaName;
					}
					
					useLatestAvailable = true;
				}
				
				if (json2) {
					db.collection('responseData1').setData(json2.years);
					
					yearData2 = db.collection('responseData1').findOne({
						year: forDate
					});
					
					if (!yearData2) {
						console.log('WARN: No data available for metric: ' + metricName + ' on date ' + forDate + ' - ATTEMPTING TO USE LATEST FIGURES');
						speechOutput = 'There is no data available for ' + metricName + ' in ' + forDate + ' for ' + originalAreaName + ', however the latest ' + metricName;
						
						if (areaName) {
							speechOutput += " for " + areaName;
						}
						
						useLatestAvailable = true;
					}
				}
			}
			
			if (useLatestAvailable) {
				// Use the data in "description" field, which has the latest available info
				yearData1 = {
					value: json1.description.number,
					year: json1.description.date.split(' ').reverse().join(' ') // get the date components in the correct spoken order (e.g. MAY 2017 instead of 2017 MAY)
				};
				
				// Convert any abbreviated month to what we want spoken
				yearData1.year = yearData1.year
					.replace('JAN ', 'January ')
					.replace('FEB ', 'February ')
					.replace('MAR ', 'March ')
					.replace('APR ', 'April ')
					.replace('MAY ', 'May ')
					.replace('JUN ', 'June ')
					.replace('JUL ', 'July ')
					.replace('AUG ', 'August ')
					.replace('SEP ', 'September ')
					.replace('OCT ', 'October ')
					.replace('NOV ', 'November ')
					.replace('DEC ', 'December ');
				
				if (json2) {
					yearData2 = {
						value: json2.description.number,
						year: json2.description.date.split(' ').reverse().join(' ') // get the date components in the correct spoken order (e.g. MAY 2017 instead of 2017 MAY)
					};
					
					// Convert any abbreviated month to what we want spoken
					yearData2.year = yearData2.year
						.replace('JAN ', 'January ')
						.replace('FEB ', 'February ')
						.replace('MAR ', 'March ')
						.replace('APR ', 'April ')
						.replace('MAY ', 'May ')
						.replace('JUN ', 'June ')
						.replace('JUL ', 'July ')
						.replace('AUG ', 'August ')
						.replace('SEP ', 'September ')
						.replace('OCT ', 'October ')
						.replace('NOV ', 'November ')
						.replace('DEC ', 'December ');
				}
				
				forDate = yearData1.year;
				
				speechOutput += ' compiled in ' + forDate + ', was'
			} else if (!yearData1) {
				console.log('ERROR: No data available for metric: ' + metricName + ' on date ' + forDate);
				return self.emit(':tell', 'There is no data available for ' + metricName + ' in ' + forDate);
			}
			
			switch (metricOperation) {
				case 'difference':
					console.log('Value1: ', parseFloat(yearData1.value));
					console.log('Value2: ', parseFloat(yearData2.value));
					metricValue = (parseFloat(yearData1.value) - parseFloat(yearData2.value)).toFixed(2);
					break;
					
				default:
					metricValue = yearData1.value;
					break;
			}
			
			speechOutput += ' ' + (metricValue * metricMultiplier) + metricUnits + '.';
			
			
			
			speechOutput += ' The next update will be published on ' + json1.description.nextRelease;
			
			console.log('Got data, speaking the response: "' + speechOutput + '"');
			
			// Command Alexa to speak the result to the user
			self.emit(":tell", speechOutput);
		});
	};
	
	// Handle the dialog state
	handleDialogState.call(this, handleDialogComplete);
};

/**
 * Called when Alexa API is asked for help from the use for this
 * skill. Tells the user what we can do.
 */
amazonHelpIntentHandler = function amazonHelpIntentHandler () {
	speechOutput = "I use the Office for National Statistics API to answer queries about UK statistics. Ask me a question like: What was the unemployment rate in 1976? or What is the current CPI?";
	reprompt = "Ask me a question like: What was the unemployment rate in 1976? or What is the current CPI?";
	this.emit(':ask', speechOutput, reprompt);
};

/**
 * Called when Alexa API tells us the user is cancelling (not usually called).
 */
amazonCancelIntentHandler = function amazonCancelIntentHandler () {
	speechOutput = "OK, cancelled";
	this.emit(':tell', speechOutput);
};

/**
 * Called when Alexa API tells us the user is stopping (not usually called).
 */
amazonStopIntentHandler = function amazonStopIntentHandler () {
	speechOutput = "STOPPED";
	this.emit(':tell', speechOutput);
};

/**
 * Called when Alexa API tells us the session has ended (not usually called).
 */
sessionEndedRequestHandler = function sessionEndedRequestHandler () {
	var speechOutput = "Session ended";
	this.emit(':tell', speechOutput);
};

/**
 * Handles the changes to the dialog state between the user and
 * Alexa.
 * @param {Function} callback The callback method that is called
 * with each state update and determines what to do once dialog
 * is completed.
 * @returns {*}
 */
handleDialogState = function handleDialogState (callback) {
	var updatedIntent;
	
	console.log(">>> handleDialogState()");
	console.log("Current dialogState: " + this.event.request.dialogState);
	
	switch (this.event.request.dialogState) {
		case 'STARTED':
			console.log("Dialog STARTED: Asking Alexa to present dialog (:delegate)...");
			
			updatedIntent = this.event.request.intent;
			this.emit(":delegate", updatedIntent);
			
			return callback(false, false);
			break;
		
		case 'COMPLETED':
			console.log("Dialog COMPLETED: Alex got all the slot info we need, call the intent handler...");
			console.log("Returning: " + JSON.stringify(this.event.request.intent));
			
			// Dialog is now complete and all required slots should be filled,
			// so call your normal intent handler.
			return callback(false, true, this.event.request.intent);
			break;
		
		default:
			console.log("Dialog NOT COMPLETED: Asking Alexa to present dialog (:delegate)...");
			this.emit(":delegate");
			
			return callback(false, false);
			break;
	}
};

/**
 * Checks if a slot has been provided data.
 * @param {Request} request The request data from Alexa API.
 * @param {String} slotName The name of the slot to check data for.
 * @returns {*} Either the slot's current value or false if no
 * value is found for the slot.
 */
isSlotValid = function isSlotValid (request, slotName) {
	var slot = request.intent.slots[slotName],
		slotValue;
	
	// Check if we have a slot
	if (slot && slot.value) {
		// We have a value in the slot
		slotValue = slot.value.toLowerCase();
		return slotValue;
	}
	
	// We didn't get a value in the slot.
	return false;
};

/**
 * Exports the handler data to the Alexa API.
 * @param event
 * @param context
 * @param callback
 */
exports.handler = function (event, context, callback) {
	console.log("Event: " + JSON.stringify(event));
	console.log("Context: " + JSON.stringify(context));
	
	alexa = Alexa.handler(event, context, callback);
	
	alexa.appId = APP_ID;
	alexa.registerHandlers({
		'LaunchRequest': launchRequestHandler,
		'GetStatIntent': getStatIntentHandler,
		'AMAZON.HelpIntent': amazonHelpIntentHandler,
		'AMAZON.CancelIntent': amazonCancelIntentHandler,
		'AMAZON.StopIntent': amazonStopIntentHandler,
		'SessionEndedRequest': sessionEndedRequestHandler
	});
	
	alexa.execute();
};