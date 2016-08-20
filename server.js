// ---------------------------------------------------------------------------Imports
// node built in
var http           = require("http");
// npm required, defined in package.json
// var WebSocketIO		= require("websocketio");
// var json5 		= require("json5"); //for later

var httpServer    = require("./src/httpServer");
var utils         = require("./src/utils");
var gcSetup       = require("./src/globalsAndConstants");
var WebSocketIO   = require("./src/webSocketMod");

// ---------------------------------------------------------------------------WebServer variables
var webVars			= {};
	webVars.port 		= 9001;
	webVars.httpServer 	= new httpServer("public");
	webVars.mainServer 	= null;
	webVars.wsioServer 	= null;
	webVars.clients 	= []; // used to contain the wsio connections
	webVars.unityArrary = [];

gcSetup.initialize(); // Do global setup before other mechanic that might depend on this.

// --------------------------------------------------------------------------------------------------------------------------Start webserver
// create http listener
webVars.mainServer = http.createServer( webVars.httpServer.onrequest ).listen( webVars.port );
utils.debugPrint("Server started, listening on port:" + webVars.port, "http"); //only print if http debug is enabled.

// create ws listener
webVars.wsioServer = new WebSocketIO.Server( { server: webVars.mainServer } );
webVars.wsioServer.onconnection(openWebSocketClient);
// At this point the basic web server is online.









// --------------------------------------------------------------------------------------------------------------------------WebSocket(ws) related functions 
// If there is no websocket communication, the rest can be ignored.

/*
Called whenever a connection is made.
This happens on first contact through webpage entry. Regardless of if the client sends a packet.
*/
function openWebSocketClient(wsio) {
	utils.debugPrint("Connection from: " + wsio.id + " (" + wsio.clientType + " " + wsio.clientID+ ")", "wsio");
	
	// webpage handlers
	wsio.on("speechSource", wsSpeechSource);
	wsio.on("speechSentence", wsSpeechSentence);

	// unity handlers
	wsio.addPrefixListener("unityDestination", wsUnityDestination);

	// close action
	wsio.onclose(closeWebSocketClient);
	// add connection to client list
	webVars.clients.push(wsio);
}

/*
Cleanup for when a connection closes.
TODO
This isn"t complete. The necessary effects change depending on what types of services the server is for.
*/
function closeWebSocketClient(wsio) {
	utils.consolePrint("Disconnection from " + wsio.id + " (" + wsio.clientType + " " + wsio.clientID+ ")");
	// Possible to disconnect while trying to login
	if (wsio.entity) { wsio.entity.mapReference.removeClientFromMap(wsio.entity); }
	utils.removeArrayElement(webVars.clients, wsio);
} // end closeWebSocketClient



function wsSpeechSource(wsio, data) {
	utils.consolePrint("Speech Source identified self:" + wsio.id + "     " + data.message);
	wsio.emit("serverAccepted", {message:"connection established"});
}

function wsSpeechSentence(wsio, data) {
	utils.consolePrint("Sentence received:" + data.message);
	wsio.emit("serverConfirm", {message: data.message});

	for (var i = 0; i < webVars.unityArrary.length; i++) {
		webVars.unityArrary[i].send("sentence:" + data.message);
	}
}

function wsUnityDestination(wsio, dataString) {
	utils.consolePrint("Adding unity client()" + wsio.id + ":" + dataString);
	webVars.unityArrary.push(wsio);
	wsio.send("serverAccepted:Will relay packets");
}




