var utterances = require('./utterances.json'),
	newUtterances = require('./newUtterances.json'),
	missing = [],
	dupCheck = {},
	dup = [];

utterances.forEach(function (item) {
	if (newUtterances.indexOf(item) === -1) {
		missing.push(item);
	}
});

newUtterances.forEach(function (item) {
	if (dupCheck[item]) {
		dup.push(item);
	}
});

console.log(missing);
console.log('New Utterances: ' + newUtterances.length);
console.log('Utterances: ' + utterances.length);
console.log('Missing: ' + missing.length);
console.log('New Duplicates: ' + dup.length);