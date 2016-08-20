//--------------------------------------------------------------------------------------------------------------------------Global vars
var debug = true;
var wsio;

//--------------------------------------------------------------------------------------------------------------------------Start wsio communcation

function initializeWS() {
	console.log("Initializing client wsio");

	// Create a connection to server
	wsio = new WebsocketIO();
	console.log("Websocket status:" + wsio);
	wsio.open(function() {
		console.log("Websocket opened, ending addClient");
		wsio.emit('speechSource', {message:"User from webpage"});
		setupListeners(); 
	});

	wsio.on('close', function (evt) {
		logDiv.innerHTML = "\n<br>LOST CONNECTION\n<br>\n<br>" + logDiv.innerHTML;
	});


} //end initialize


//--------------------------------------------------------------------------------------------------------------------------Start wsio communcation
function setupListeners() {
	wsio.on('serverAccepted', function(data) {
		logDiv.innerHTML = "Connected to server\n<br>" + logDiv.innerHTML;
	});

	wsio.on('serverConfirm', function(data) {
		logDiv.innerHTML = "serverConfirm: " + data.message + "\n<br>" + logDiv.innerHTML;
	});

}





