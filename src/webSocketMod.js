// SAGE2 is available for use under the SAGE2 Software License
//
// University of Illinois at Chicago's Electronic Visualization Laboratory (EVL)
// and University of Hawai'i at Manoa's Laboratory for Advanced Visualization and
// Applications (LAVA)
//
// See full text, terms and conditions in the LICENSE.txt included file
//
// Copyright (c) 2014

/**
 * Lightweight object around websocket, handles string and binary communication
 *
 * @module server
 * @submodule WebsocketIO
 * @requires ws
 */

// require variables to be declared
"use strict";

var WebSocket = require('ws');
var WebSocketServer = WebSocket.Server;
var utils         = require("./utils");

/**
 * Client socket object
 *
 * @class WebsocketIO
 * @constructor
 * @param ws {Object} ULR of the server or actual websocket
 * @param strictSSL {Bool} require or not SSL verification with a certiifcate
 * @param openCallback {Function} callback when the socket opens
 */
function WebSocketIO(ws, strictSSL, openCallback) {
	if (typeof ws === "string")
		this.ws = new WebSocket(ws, null, {rejectUnauthorized: strictSSL});
	else
		this.ws = ws;

	var _this = this;
	this.messages = {};
	if (this.ws.readyState === 1) {
		this.remoteAddress = {address: this.ws._socket.remoteAddress, port: this.ws._socket.remotePort};
		this.id = this.remoteAddress.address + ":" + this.remoteAddress.port;
	}

	this.closeCallbacks = [];
	this.aliasCount = 1;
	this.remoteListeners = {"#WSIO#addListener": "0000"};
	this.localListeners = {"0000": "#WSIO#addListener"};

	this.ws.on('error', function(err) {
		console.log("erase me, error triggered");
		if (err.errno === "ECONNREFUSED") return; // do nothing
	});

	this.ws.on('open', function() {
		console.log();
		console.log();
		console.log("erase me, open triggered");
		console.log();
		console.log();
		_this.ws.binaryType = "arraybuffer";
		_this.remoteAddress = {address: _this.ws._socket.remoteAddress, port: _this.ws._socket.remotePort};
		_this.id = _this.remoteAddress.address + ":" + _this.remoteAddress.port;
		if(openCallback !== null) openCallback();
	});


	this.prefixCallbacks = {};


	this.ws.on('message', function(message) {
		var strConvert = "" + message;
		if (strConvert.indexOf("{") != -1) {
			var msg = JSON.parse(strConvert);
			var fName = _this.localListeners[msg.f];
			if (fName === undefined) {
				console.log("WebsocketIO>\tno handler for message");
			} else if (fName === "#WSIO#addListener") {
				// add lister to client
				_this.remoteListeners[msg.d.listener] = msg.d.alias;
				return;
			} else {
				// handle message
				_this.messages[fName](_this, msg.d);
			}
		} else {
			_this.activatePrefixMethod(_this, strConvert);
		}
	});

	this.ws.on('close', function() {
		console.log("erase me, close triggered");
		for(var i=0; i<_this.closeCallbacks.length; i++) {
			_this.closeCallbacks[i](_this);
		}
	});
}

/**
* Added this to check for prefix markers since the .on method no longer works with Unity.
*/
WebSocketIO.prototype.addPrefixListener = function(prefix, callback) {
	this.prefixCallbacks["" + prefix] = callback;
};

/*

*/
WebSocketIO.prototype.activatePrefixMethod = function(wsio, fullPacketString) {
	var prefixIndex = fullPacketString.indexOf(":");
	var prefix = "";
	if (prefixIndex != -1) {
		prefix = fullPacketString.substring(0, prefixIndex);
	}
	if (prefix.length > 0 && this.prefixCallbacks["" + prefix]) {
		var packetData = fullPacketString.substring(fullPacketString.indexOf(":") + 1);
		this.prefixCallbacks["" + prefix](wsio, packetData);
	} else {
		utils.consolePrint("Error no callback made for packet prefix:" + prefix, {error: true});
	}
};

WebSocketIO.prototype.send = function(stringToSend) {
	try {
		this.ws.send(stringToSend, {binary: false, mask: false});
	} catch (e) { 
		utils.consolePrint("Error cannot send " + stringToSend + " connection " + this.id + " already closed", {error: true});
	}
};

























/**
* Setting a callback when the socket closes
*
* @method onclose
* @param callback {Function} function to execute after closing
*/
WebSocketIO.prototype.onclose = function(callback) {
	this.closeCallbacks.push(callback);
};

/**
* Set a message handler for a given name
*
* @method on
* @param name {String} name for the handler
* @param callback {Function} handler to be called for a given name
*/
WebSocketIO.prototype.on = function(name, callback) {
	var alias = ("0000" + this.aliasCount.toString(16)).substr(-4);
	this.localListeners[alias] = name;
	this.messages[name] = callback;
	this.aliasCount++;
	this.emit('#WSIO#addListener', {listener: name, alias: alias});
};

/**
* Send a message with a given name and payload (format> f:name d:payload)
*
* @method emit
* @param name {String} name of the message (i.e. RPC)
* @param data {Object} data to be sent with the message
*/
WebSocketIO.prototype.emit = function(name, data, attempts) {
	if (this.ws.readyState === 1) {
		if (name === null || name === "") {
			console.log("WebsocketIO>\tError, no message name specified");
			return;
		}

		var _this = this;
		var message;
		var alias = this.remoteListeners[name];
		if(alias === undefined) {
			if(attempts === undefined) attempts = 16;
			if(attempts >= 0) {
				setImmediate(function() {
					_this.emit(name, data, attempts-1);
				});
			}
			else {
				console.log("WebsocketIO>\tWarning: not sending message, recipient has no listener (" + name + ")");
			}
			return;
		}

		// send binary data as array buffer
		if (Buffer.isBuffer(data)) {
			var funcName = new Buffer(alias);
			message      = Buffer.concat([funcName, data]);

			try {
				this.ws.send(message, {binary: true, mask: false}, function(err){
					if(err) console.log("WebsocketIO>\t---ERROR (ws.send)---", name);
					// else success
				});
			}
			catch(e) {
				console.log("WebsocketIO>\t---ERROR (try-catch)---", name);
			}
		}
		// send data as JSON string
		else {
			message = {f: alias, d: data};

			// double error handling
			try {
				var msgString = JSON.stringify(message);
				this.ws.send(msgString, {binary: false, mask: false}, function(err){
					if(err) console.log("WebsocketIO>\t---ERROR (ws.send)---", name);
					// else success
				});
			}
			catch(e) {
				console.log("WebsocketIO>\t---ERROR (try-catch)---", name);
			}
		}
	}
};

/**
* Faster version for emit: No JSON stringigy and no check version
*
* @method emitString
* @param data {String} data to be sent as the message
*/
WebSocketIO.prototype.emitString = function(name, dataString, attempts) {
	if (this.ws.readyState === 1) {
		var _this = this;
		var alias = this.remoteListeners[name];
		if(alias === undefined) {
			if(attempts === undefined) attempts = 16;
			if(attempts >= 0) {
				setImmediate(function() {
					_this.emitString(name, dataString, attempts-1);
				});
			}
			else {
				console.log("WebsocketIO>\tWarning: not sending message, recipient has no listener (" + name + ")");
			}
			return;
		}

		var message = "{\"f\":\""+alias+"\",\"d\":"+dataString+"}";

		this.ws.send(message, {binary: false, mask: false});
	}
};

/**
* Update the remote address of the client
*
* @method updateRemoteAddress
* @param host {String} hostname / ip address
* @param port {Integer} port number
*/
WebSocketIO.prototype.updateRemoteAddress = function(host, port) {
	if(typeof host === "string") this.remoteAddress.address = host;
	if(typeof port === "number") this.remoteAddress.port = port;
	this.id = this.remoteAddress.address + ":" + this.remoteAddress.port;
};


/**
 * Server socket object
 *
 * @class WebsocketIOServer
 * @constructor
 * @param data {Object} object containing .server or .port information
 */
function WebSocketIOServer(data) {
	if (data.server !== undefined)
		this.wss = new WebSocketServer({server: data.server, perMessageDeflate: false});
	else if(data.port !== undefined)
		this.wss = new WebSocketServer({port: data.port, perMessageDeflate: false});

	this.clients = {};
}

/**
* Setting a callback when a connection happens
*
* @method onconnection
* @param callback {Function} function taking the new client (WebsocketIO) as parameter
*/
WebSocketIOServer.prototype.onconnection = function(callback) {
	var _this = this;
	this.wss.on('connection', function(ws) {
		ws.binaryType = "arraybuffer";

		var wsio = new WebSocketIO(ws);
		wsio.onclose(function(closed) {
			delete _this.clients[closed.id];
		});
		_this.clients[wsio.id] = wsio;
		callback(wsio);
	});
};

WebSocketIOServer.prototype.broadcast = function(name, data) {
	var key;
	var alias;
	// send as binary buffer
	if (Buffer.isBuffer(data)) {
		for(key in this.clients) {
			alias = this.clients[key].remoteListeners[name];
			if(alias !== undefined) {
				this.clients[key].emit(name, data);
			}
		}
	}
	// send data as JSON string
	else {
		var dataString = JSON.stringify(data);
		for(key in this.clients) {
			alias = this.clients[key].remoteListeners[name];
			if(alias !== undefined) {
				this.clients[key].emitString(name, dataString);
			}
		}
	}
};



module.exports = WebSocketIO;
module.exports.Server = WebSocketIOServer;
