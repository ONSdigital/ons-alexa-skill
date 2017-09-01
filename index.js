'use strict';

var Alexa = require('alexa-sdk');
var request = require('request');
var ForerunnerDB = require('forerunnerdb');
var fdb = new ForerunnerDB();
var db = fdb.db('apiData');
var speechOutput;
var reprompt;
var welcomeOutput = "Let's get some stats, what would you like to know?";
var welcomeReprompt = "You can ask for unemployment, CPI or the population.";
var APP_ID = undefined;  // TODO replace with your app ID (OPTIONAL).

var handlers = {
	'LaunchRequest': function () {
		console.log(">>> handlers.LaunchRequest()");
		console.log("Sending :ask command with welcomeOutput");
		this.emit(':ask', welcomeOutput, welcomeReprompt);
	},
	'GetStatIntent': function (event, context) {
		var self = this;
		
		console.log(">>> handlers.GetStatIntent()");
		console.log("Calling delegateSlotCollection()");
		//delegate to Alexa to collect all the required slot values
		var filledSlots = delegateSlotCollection.call(this, function (err, finished) {
			var speechOutput,
				metric,
				forDate,
				areaData,
				areaName,
				areaId,
				metricUrl,
				metricUnits,
				metricData,
				metricName,
				metricId,
				metricMultiplier,
				metricOnlyUk,
				useLatestAvailable;
			
			if (err) {
				// Handle
				return;
			}
			
			if (!finished) {
				// Wait for further data
				console.log('Waiting for further input...', JSON.stringify(event), JSON.stringify(context));
				return;
			}
			
			speechOutput = '';
			useLatestAvailable = false;
			metricData = slotInfo(self.event.request.intent.slots.metric);
			areaData = slotInfo(self.event.request.intent.slots.area);
			forDate = self.event.request.intent.slots.forDate.value;
			
			if (metricData) {
				// We resolved a metric, read the required data
				metricName = metricData.name;
				metricId = metricData.id;
				
				console.log('>>> Getting data for metric', JSON.stringify(metricData));
			} else {
				// We couldn't resolve a metric, ask the user again
				// TODO: Find out how to get alexa delegate to ask for a particular slot's data
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
				
				speechOutput += 'The ' + metricName + ' in ' + forDate;
			} else {
				useLatestAvailable = true;
				speechOutput += 'The latest ' + metricName;
				
				console.log('>>> Getting data for latest available date');
			}
			
			// Default to unitedKingdom - must be a valid area id
			if (!areaId) {
				areaId = 'unitedKingdom';
				areaName = 'the United Kingdom';
			}
			
			// Get the metric value that the user is looking for - start with area-based metrics and then
			// fall back to non-area-based metrics
			console.log('>>> Checking for area-based metric matching: ' + metricId + '_' + areaId);
			switch (metricId + '_' + areaId) {
				case 'population_unitedKingdom':
					metricUrl = 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/ukpop/data';
					metricUnits = '';
					metricMultiplier = 1;
					speechOutput += ' for ' + areaName + ',';
					break;
				
				case 'population_greatBritain':
					metricUrl = 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/gbpop/data';
					metricUnits = '';
					metricMultiplier = 1;
					speechOutput += ' for ' + areaName + ',';
					break;
				
				case 'population_england':
					metricUrl = 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/enpop/data';
					metricUnits = '';
					metricMultiplier = 1;
					speechOutput += ' for ' + areaName + ',';
					break;
				
				case 'population_wales':
					metricUrl = 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/wapop/data';
					metricUnits = '';
					metricMultiplier = 1;
					speechOutput += ' for ' + areaName + ',';
					break;
				
				case 'population_scotland':
					metricUrl = 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/scpop/data';
					metricUnits = '';
					metricMultiplier = 1;
					speechOutput += ' for ' + areaName + ',';
					break;
				
				case 'population_northernIreland':
					metricUrl = 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/nipop/data';
					metricUnits = '';
					metricMultiplier = 1;
					speechOutput += ' for ' + areaName + ',';
					break;
				
				case 'population_englandAndWales':
					metricUrl = 'https://www.ons.gov.uk/peoplepopulationandcommunity/populationandmigration/populationestimates/timeseries/ewpop/data';
					metricUnits = '';
					metricMultiplier = 1;
					speechOutput += ' for ' + areaName + ',';
					break;
				
				case 'unemployment_unitedKingdom':
					metricUrl = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/data';
					metricUnits = ' percent';
					metricMultiplier = 1;
					
					speechOutput += ' for ' + areaName + ',';
					break;
				
				case 'unemployment_england':
					metricUrl = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/ycnl/lms/data';
					metricUnits = ' percent';
					metricMultiplier = 1;
					
					speechOutput += ' for ' + areaName + ',';
					break;
				
				case 'unemployment_scotland':
					metricUrl = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/ycnn/lms/data';
					metricUnits = ' percent';
					metricMultiplier = 1;
					
					speechOutput += ' for ' + areaName + ',';
					break;
				
				case 'unemployment_wales':
					metricUrl = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/ycnm/lms/data';
					metricUnits = ' percent';
					metricMultiplier = 1;
					
					speechOutput += ' for ' + areaName + ',';
					break;
				
				case 'unemployment_northernIreland':
					metricUrl = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/zsfb/lms/data';
					metricUnits = ' percent';
					metricMultiplier = 1;
					
					speechOutput += ' for ' + areaName + ',';
					break;
				
				default:
					console.log('>>> No area-based metric found matching: ' + metricId + '_' + areaId);
					console.log('>>> Checking for non-area-based metric matching: ' + metricId);
					switch (metricId) {
						case 'unemployment':
							metricUrl = 'https://www.ons.gov.uk/employmentandlabourmarket/peoplenotinwork/unemployment/timeseries/mgsx/data';
							metricUnits = ' percent';
							metricMultiplier = 1;
							
							if (areaId !== 'unitedKingdom') {
								speechOutput += ' is available for the United Kingdom, Wales, Northern Island and Scotland, for the United Kingdom,';
							} else {
								speechOutput += ' for the United Kingdom,';
							}
							break;
						
						case 'cpi':
							metricUrl = 'https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/d7g7/data';
							metricUnits = ' percent';
							metricMultiplier = 1;
							
							if (areaId !== 'unitedKingdom') {
								speechOutput += ' is only available for the United Kingdom,';
							} else {
								speechOutput += ' for the United Kingdom,';
							}
							break;
						
						case 'rpi':
							metricUrl = 'https://www.ons.gov.uk/economy/inflationandpriceindices/timeseries/czbh/data';
							metricUnits = ' percent';
							metricMultiplier = 1;
							
							if (areaId !== 'unitedKingdom') {
								speechOutput += ' is only available for the United Kingdom,';
							} else {
								speechOutput += ' for the United Kingdom,';
							}
							break;
						
						case 'gdp':
							metricUrl = 'https://www.ons.gov.uk/economy/grossdomesticproductgdp/timeseries/abmi/data';
							metricUnits = '';
							metricMultiplier = 1000000;
							
							if (areaId !== 'unitedKingdom') {
								speechOutput += ' is only available for the United Kingdom,';
							} else {
								speechOutput += ' for the United Kingdom,';
							}
							break;
						
						default:
							console.log('ERROR: Metric asked for is not recognised: ' + JSON.stringify(self.event.request));
							return self.emit(':tell', 'I didn\'t understand the metric you were looking for, please try again!');
							break;
					}
					break;
			}
			
			request(metricUrl, function (err, response, data) {
				var json,
					yearData;
				
				if (err) {
					return self.emit(':tell', 'There was an error accessing the office for national statistics data, please try again later!');
				}
				
				if (response) {
					if (response.statusCode !== 200) {
						console.log('ERROR: Received non-200 status code from ONS API: ' + JSON.stringify(response));
						return self.emit(':tell', 'There was an error accessing the office for national statistics data, please try again later!');
					}
				}
				
				try {
					json = JSON.parse(data);
				} catch (e) {
					console.log('ERROR: JSON parse of data from ONS API failed: ' + e, data);
					return self.emit(':tell', 'There was an error accessing the office for national statistics data, please try again later!');
				}
				
				if (!json.years) {
					console.log('ERROR: No years data available: ', JSON.stringify(json));
					return self.emit(':tell', 'There was an error accessing the office for national statistics data, please try again later!');
				}
				
				// We now have the JSON! Get the data we are interested in.
				db.collection('responseData').setData(json.years);
				
				if (useLatestAvailable) {
					// Just get the entry sorted by date descending
					yearData = db.collection('responseData').findOne({}, {
						$orderBy: {
							'year': -1
						}
					});
					
					forDate = yearData.year;
					
					speechOutput += ' compiled in ' + forDate + ', was'
				} else {
					yearData = db.collection('responseData').findOne({
						year: forDate
					});
				}
				
				if (!yearData) {
					console.log('ERROR: No data available for metric: ' + metricName + ' on date ' + forDate);
					return self.emit(':tell', 'There is no data available for ' + metricName + ' in ' + forDate);
				}
				
				speechOutput += ' ' + (yearData.value * metricMultiplier) + metricUnits + '. The next update will be published';
				speechOutput += ' on ' + json.description.nextRelease;
				
				console.log('Got data, speaking the response: "' + speechOutput + '"');
				
				//say the results
				self.emit(":tell", speechOutput);
			});
		});
	},
	'AMAZON.HelpIntent': function () {
		speechOutput = "I use the Office for National Statistics API to answer queries about UK statistics. Ask me a question like: What was the unemployment rate in 1976? or What is the current CPI?";
		reprompt = "Ask me a question like: What was the unemployment rate in 1976? or What is the current CPI?";
		this.emit(':ask', speechOutput, reprompt);
	},
	'AMAZON.CancelIntent': function () {
		speechOutput = "OK, cancelled";
		this.emit(':tell', speechOutput);
	},
	'AMAZON.StopIntent': function () {
		speechOutput = "STOPPED";
		this.emit(':tell', speechOutput);
	},
	'SessionEndedRequest': function () {
		var speechOutput = "Session ended";
		this.emit(':tell', speechOutput);
	}
};

exports.handler = function (event, context, callback) {
	var alexa = Alexa.handler(event, context, callback);
	alexa.APP_ID = APP_ID;
	// To enable string internationalization (i18n) features, set a resources object.
	//alexa.resources = languageStrings;
	alexa.registerHandlers(handlers);
	alexa.execute();
};

function slotInfo (slotData) {
	if (slotData && slotData.resolutions && slotData.resolutions.resolutionsPerAuthority && slotData.resolutions.resolutionsPerAuthority.length && slotData.resolutions.resolutionsPerAuthority[0].values && slotData.resolutions.resolutionsPerAuthority[0].values.length && slotData.resolutions.resolutionsPerAuthority[0].values[0].value) {
		// We resolved a metric, read the required data
		return slotData.resolutions.resolutionsPerAuthority[0].values[0].value;
	}
	
	return;
}

function delegateSlotCollection (callback) {
	console.log(">>> delegateSlotCollection()");
	console.log("Current dialogState: " + this.event.request.dialogState);
	if (this.event.request.dialogState === "STARTED") {
		console.log("STARTED: Asking Alexa to present dialog (:delegate)...");
		
		var updatedIntent = this.event.request.intent;
		
		this.emit(":delegate", updatedIntent);
		
		callback(false, false);
	} else if (this.event.request.dialogState !== "COMPLETED") {
		console.log("NOT COMPLETED: Asking Alexa to present dialog (:delegate)...");
		this.emit(":delegate");
		
		callback(false, false);
	} else {
		console.log("COMPLETED: Asking Alexa to present dialog (:delegate)...");
		console.log("Returning: " + JSON.stringify(this.event.request.intent));
		// Dialog is now complete and all required slots should be filled,
		// so call your normal intent handler.
		callback(false, true, this.event.request.intent);
	}
}

function isSlotValid (request, slotName) {
	var slot = request.intent.slots[slotName];
	//console.log("request = "+JSON.stringify(request)); //uncomment if you want to see the request
	var slotValue;
	
	//if we have a slot, get the text and store it into speechOutput
	if (slot && slot.value) {
		//we have a value in the slot
		slotValue = slot.value.toLowerCase();
		return slotValue;
	} else {
		//we didn't get a value in the slot.
		return false;
	}
}