(function () {
	'use strict';
	
	var input = document.getElementById('input');
	var output = document.getElementById('output');
	var button = document.getElementById('expand');
	
	button.addEventListener('click', expand, false);
	
	expand();
	
	function expand () {
		var phrases = input.value.split('\n');
		var expanded = intentUtteranceExpander(phrases);
		var result = [];
		
		expanded.forEach(function (item) {
			result = result.concat(item);
		});
		
		output.value = JSON.stringify(result, null, "\t");
	}
	
})();
