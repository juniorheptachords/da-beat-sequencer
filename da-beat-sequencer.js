/*
	
██████╗  █████╗     ██████╗ ███████╗ █████╗ ████████╗    ███████╗███████╗ ██████╗ ██╗   ██╗███████╗███╗   ██╗ ██████╗███████╗██████╗ 
██╔══██╗██╔══██╗    ██╔══██╗██╔════╝██╔══██╗╚══██╔══╝    ██╔════╝██╔════╝██╔═══██╗██║   ██║██╔════╝████╗  ██║██╔════╝██╔════╝██╔══██╗
██║  ██║███████║    ██████╔╝█████╗  ███████║   ██║       ███████╗█████╗  ██║   ██║██║   ██║█████╗  ██╔██╗ ██║██║     █████╗  ██████╔╝
██║  ██║██╔══██║    ██╔══██╗██╔══╝  ██╔══██║   ██║       ╚════██║██╔══╝  ██║▄▄ ██║██║   ██║██╔══╝  ██║╚██╗██║██║     ██╔══╝  ██╔══██╗
██████╔╝██║  ██║    ██████╔╝███████╗██║  ██║   ██║       ███████║███████╗╚██████╔╝╚██████╔╝███████╗██║ ╚████║╚██████╗███████╗██║  ██║
╚═════╝ ╚═╝  ╚═╝    ╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝       ╚══════╝╚══════╝ ╚══▀▀═╝  ╚═════╝ ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝╚═╝  ╚═╝
                                                                                                                                     
version : 0.2
Release date : 2017-03-30

MIT License

Copyright (c) 2017 Christophe Jourdan, https://github.com/christophejourdan/da-beat-sequencer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE

*/


(function() {
	// Constructor
	this.DaBeatSequencer = function() {
		
		// Define option defaults
		var defaults = {
			autoplay:true,
			showVisual:true,
			showControls:true,
			samplesSet:[],
			sendMidi:false,
			playSound:true,
			audioLatency:0,
			midiLatency:0,
			bars: 1,
			stepsInBar: 16,
			bpm: 110,
			steps: [[1,1,0,1,0,0,1,1,0,1,1,0,0,0,0,0],
					 [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
					 [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,1],
					 [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0]
					],
			midiNotes:[36, 38, 42, 43]
		}
		
		this.midi = null;
		this.options = defaults;
		
		// Create this.options by extending defaults with the passed in arugments
		if (arguments[0] && typeof arguments[0] === "object") {
			this.options = extendDefaults(defaults, arguments[0]);
		}
		
		
		// Load the metronome worker 
		var metronome = new Worker(workerURL);
		
		// Init the metronome with this.options
		metronome.postMessage( JSON.stringify({action:"init", message: this.options}) );
		
		// Metronome events
		metronome.onmessage = function(e) {
			if(e.data["step"] != undefined){
				
				var currentStep = e.data["step"];
				
				for(var i = 0; i<this.options.steps.length; i++){
					if(this.options.steps[i][currentStep] == 1){
						if(this.options.playSound){
							playSample(i);
						}
						if(this.options.sendMidi){
							sendMidiNote(i);
						}
					}
				}
				
				if(this.options.showVisual){
					updateVisual(currentStep);
				}
			}
		}.bind(this);
		
		
		// Public methods
		
		// Pause playing
		this.pause = function() {
			metronome.postMessage( JSON.stringify({action:"pause"}) );
		}
		// Stop playing
		this.stop = function() {
			metronome.postMessage( JSON.stringify({action:"stop"}) );
		}
		// Start playin
		this.play = function() {
			metronome.postMessage( JSON.stringify({action:"play"}) );
		}
		// Change BPM
		this.setBpm = function(bpm) {
			metronome.postMessage( JSON.stringify({action:"setBpm", bpm:bpm}) );
		}
		// Change BPM
		this.setSteps = function(steps) {
			this.options.steps = steps;
			
		}
		
		
		// Private methods
		
		var initAudio = function(){
			window.AudioContext = window.AudioContext || window.webkitAudioContext;
			this.context = new AudioContext();
			this.bufferList = new Array();
			
			for(var i = 0; i<this.options.samplesSet.length; i++){
				var url = this.options.samplesSet[i];
				var self = this;
				
				// Closure is done to keep the var i in its current state in the asynchronous call
				(function(i) {
					// Load buffer asynchronously
					var request = new XMLHttpRequest();
					request.responseType = "arraybuffer";
					request.open("GET", url, true);
				
					request.onload = function(e, a) {
					    // Asynchronously decode the audio file data in request.response
					    
					    self.context.decodeAudioData(
					      e.srcElement.response,
					      function(buffer) {
					        if (!buffer) {
					          alert('error decoding file data: ' + url);
					          return;
					        }
					        self.bufferList[i] = buffer;
					        
					        //if (++loader.loadCount == loader.samplesSet.length)
					          //loader.onload(loader.bufferList);
					      },
					      function(error) {
					        console.error('decodeAudioData error', error);
					      }
					    );
					};
					request.onerror = function() {
					    alert('BufferLoader: XHR error');
					}
				
					request.send();
				})(i);
				
			}
			
		}.bind(this);
		
		// Play a sample from the samples set
		var playSample = function (sampleIndex = 0) {
			var self = this;
			if(this.bufferList && this.bufferList[sampleIndex]){
				// Let set a latency on the audio. Can be usefull if playing audio and sending midi together.
				setTimeout(function(){
					source = self.context.createBufferSource();
					source.buffer = self.bufferList[sampleIndex];
					
					source.connect(self.context.destination);
					source.start(0);
				}, this.options.audioLatency);
			}
			
			
		}.bind(this);
		
		// Init MIDI
		var initMidi = function () {
			if (navigator.requestMIDIAccess) {
			    navigator.requestMIDIAccess()
			        .then(function(midiAccess){onMIDISuccess(midiAccess);}, onMIDIFailure);
			}
		}.bind(this);
		
		// MIDI succss
		var onMIDISuccess = function ( midiAccess ) {
			console.log( "MIDI ready!" );
			this.midi = midiAccess;  // store in the global (in real usage, would probably keep in an object instance)
			listInputsAndOutputs( midiAccess );
		}.bind(this);
		
		// MIDI Failure
		function onMIDIFailure(msg) {
			console.log( "Failed to get MIDI access - " + msg );
		}
		
		// Setting MIDI output
		var listInputsAndOutputs = function( midiAccess ) {
			if(midiAccess){
				var outputs = this.midi.outputs.values();
				for (var output = outputs.next(); output && !output.done; output = outputs.next()) {
				    // each time there is a midi message call the onMIDIMessage function
				    this.midiOutput = output.value;
				}
			}
		}.bind(this);
		
		// Send MIDI note
		var sendMidiNote = function (instrumentIndex) {
			
			var note = this.options.midiNotes[instrumentIndex];
			var midiOutput = this.midiOutput;
			// Let set a latency on the midi. Can be usefull if playing audio and sending midi together.
			setTimeout(function(){
				var noteOnMessage = [0x90, note, 0x7f];    // note on, middle C, full velocity
				midiOutput.send( noteOnMessage );  //omitting the timestamp means send immediately.
				midiOutput.send( [0x80, note, 0x40], window.performance.now() + 100.0 ); // note off, release velocity = 64, timestamp = now + 100ms.                                                      
			}, this.options.midiLatency);
		}.bind(this);
		
		
		// Initialize the visual
		var initVisual = function(){
			
			var sequencer = document.createElement("DIV");
			sequencer.className = "sequencer";
			
			if(this.options.showControls){
				
				var controlsWrapper = document.createElement("DIV");
				controlsWrapper.className = "bpm-control-wrapper";
			
				var playControl = document.createElement("BUTTON");
				playControl.className = "play";
				playControl.innerHTML = "Play";
				
				var pauseControl = document.createElement("BUTTON");
				pauseControl.className = "pause";
				pauseControl.innerHTML = "Pause";
				
				var stopControl = document.createElement("BUTTON");
				stopControl.className = "stop";
				stopControl.innerHTML = "Stop";
				
				var bpmControl = document.createElement("INPUT");
				bpmControl.setAttribute("type", "number");
				bpmControl.setAttribute("value", this.options.bpm);
				
				controlsWrapper.appendChild(playControl); 
				controlsWrapper.appendChild(pauseControl); 
				controlsWrapper.appendChild(stopControl); 
				controlsWrapper.appendChild(bpmControl); 
				
				if(this.options.playSound && this.options.sendMidi){
					var audioLatencyControl = document.createElement("INPUT");
					audioLatencyControl.setAttribute("type", "number");
					audioLatencyControl.setAttribute("value", this.options.audioLatency);
					controlsWrapper.appendChild(audioLatencyControl); 
					
					var midiLatencyControl = document.createElement("INPUT");
					midiLatencyControl.setAttribute("type", "number");
					midiLatencyControl.setAttribute("value", this.options.midiLatency);
					controlsWrapper.appendChild(midiLatencyControl); 
				}
				
				sequencer.appendChild(controlsWrapper); 
				
				this.playControl = playControl;
				this.pauseControl = pauseControl;
				this.stopControl = stopControl;
				this.bpmControl = bpmControl;
				this.audioLatencyControl = audioLatencyControl;
				this.midiLatencyControl = midiLatencyControl;
			}
			
			var grid = document.createElement("DIV");
			grid.className = "grid";
				
			for(var i = 0; i<this.options.steps.length; i++){
				
				var line = document.createElement("DIV");
				line.className = "instrument";
					
				for(var s = 0; s<this.options.steps[i].length; s++){
					var block = document.createElement("DIV");
					block.className = "step";
					var t = null;
					if(this.options.steps[i][s]){
						t = document.createTextNode("x");
					}else{
						t = document.createTextNode(".");
					}
					block.appendChild(t);
					line.appendChild(block);  
					
					//block.addEventListener('click', this.close.bind(this)); 
				}
				grid.appendChild(line); 
			}
			
			sequencer.appendChild(grid); 
				
			
			
			document.body.appendChild(sequencer); 
			
			this.element = sequencer;
			this.gridElement = grid;
		}.bind(this);
		
		
		// Refresh the visual
		var updateVisual = function(currentStep){
			if(this.gridElement){
				for(var i = 0; i<this.gridElement.childNodes.length; i++){
					for(var s = 0; s<this.gridElement.childNodes[i].childNodes.length; s++){
						
						// Remove the active class on all elements
						stepElement = this.gridElement.childNodes[i].childNodes[s];
						stepElement.classList.remove("active");
						
						// Maybe the steps have changed so we rewrite each to be sure
						if(this.options.steps[i][s]){
							stepElement.innerHTML = "x";
						}else{
							stepElement.innerHTML = ".";
						}
					}
				}
				
				// Add the active class on current elements
				for(var i = 0; i<this.gridElement.childNodes.length; i++){
					currentStepElement = this.gridElement.childNodes[i].childNodes[currentStep];
					currentStepElement.classList.add("active");
				}
			}
		}.bind(this);
		
		
		// Initializing the events
		var initializeEvents = function() {

		    if (this.playControl) {
		      this.playControl.addEventListener('click', function(){this.play()}.bind(this));
		    }
		    if (this.pauseControl) {
		      this.pauseControl.addEventListener('click', function(){this.pause()}.bind(this));
		    }
		    if (this.stopControl) {
		      this.stopControl.addEventListener('click', function(){this.stop()}.bind(this));
		    }
		    if (this.bpmControl) {
		      this.bpmControl.addEventListener('change', function(){this.setBpm(this.bpmControl.value)}.bind(this));
		    }
		    if (this.audioLatencyControl) {
		      this.audioLatencyControl.addEventListener('change', function(){this.options.audioLatency = this.audioLatencyControl.value;}.bind(this));
		    }
		    if (this.midiLatencyControl) {
		      this.midiLatencyControl.addEventListener('change', function(){this.options.midiLatency = this.midiLatencyControl.value;}.bind(this));
		    }
		}.bind(this);
		
				
		// Init of the plugin
		this.init = function(){
			initAudio();
			
			if(this.options.sendMidi){
				initMidi();
			}
			
			if(this.options.showVisual){
				initVisual();
			}
			
			initializeEvents();
		}
		
		
		// Call the big init
		this.init();
	}
	
	
	
	// Inline web worker for the metronome
	// See for inline web worker : http://stackoverflow.com/questions/5408406/web-workers-without-a-separate-javascript-file
	var workerURL = URL.createObjectURL( new Blob([ '(',

		function(){
			var timer=null;
	
			var bpm = 100;
			var interval=1000*60/bpm;
			var interval_2=interval/2;
			var interval_4=interval/4;
			
			var stepsInBar = 16;
			var bars = 1;
			
			var currentStep = 0;
			
			self.onmessage=function(e){
				data = JSON.parse(e.data);
				
				if (data.action) {
					switch(data.action) {
					    case "init":
					        // Set the parameters before starting
							if(data.message.bpm){
								bpm = data.message.bpm;
							}
							if(data.message.bars){
								bars = data.message.bars;
							}
							if(data.message.stepsInBar){
								stepsInBar = data.message.stepsInBar;
							}
							// Calculate the interval
							interval=1000*60/bpm;
							interval_2=interval/2;
							interval_4=interval/4;
							
							// Auto playing
							if(data.message.autoplay){
								play();
							}
					    break;
					    case "play":
							// Start playing
							console.log("Playing");
							play();
						break;
					    case "pause":
							// Stop playing
							console.log("Pausing");
							clearInterval(timer);
							timer=null;
						break;
					    case "stop":
							// Stop playing
							console.log("Stopping");
							clearInterval(timer);
							timer=null;
							currentStep = 0;
						break;
						
					    case "setBpm":
							// Stop playing
							console.log("Set BPM");
							bpm = data.bpm
							
							if(timer){
								clearInterval(timer);
								timer=null;
								
								// Calculate the interval
								interval=1000*60/bpm;
								interval_2=interval/2;
								interval_4=interval/4;
								play();
							}
						break;
			        }
				}
				
				function play(){
					if(!timer){
						timer = setInterval(  
							function(){
								postMessage({"step":currentStep});
								
								currentStep++;
								currentStep = currentStep % stepsInBar;
							}
						,interval_4);
					}else{
						console.log("Already playing!");
					}
				}
			};
		}.toString(),
	
	')()' ], { type: 'application/javascript' } ) );


	// Utility method to extend defaults with user this.options
	function extendDefaults(source, properties) {
		var property;
		for (property in properties) {
			if (properties.hasOwnProperty(property)) {
				source[property] = properties[property];
			}
		}
		return source;
	}
				
}());