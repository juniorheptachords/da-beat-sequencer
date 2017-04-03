/*
	
██████╗  █████╗     ██████╗ ███████╗ █████╗ ████████╗    ███████╗███████╗ ██████╗ ██╗   ██╗███████╗███╗   ██╗ ██████╗███████╗██████╗ 
██╔══██╗██╔══██╗    ██╔══██╗██╔════╝██╔══██╗╚══██╔══╝    ██╔════╝██╔════╝██╔═══██╗██║   ██║██╔════╝████╗  ██║██╔════╝██╔════╝██╔══██╗
██║  ██║███████║    ██████╔╝█████╗  ███████║   ██║       ███████╗█████╗  ██║   ██║██║   ██║█████╗  ██╔██╗ ██║██║     █████╗  ██████╔╝
██║  ██║██╔══██║    ██╔══██╗██╔══╝  ██╔══██║   ██║       ╚════██║██╔══╝  ██║▄▄ ██║██║   ██║██╔══╝  ██║╚██╗██║██║     ██╔══╝  ██╔══██╗
██████╔╝██║  ██║    ██████╔╝███████╗██║  ██║   ██║       ███████║███████╗╚██████╔╝╚██████╔╝███████╗██║ ╚████║╚██████╗███████╗██║  ██║
╚═════╝ ╚═╝  ╚═╝    ╚═════╝ ╚══════╝╚═╝  ╚═╝   ╚═╝       ╚══════╝╚══════╝ ╚══▀▀═╝  ╚═════╝ ╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝╚═╝  ╚═╝
                                                                                                                                     
version : 0.7
Release date : 2017-04-01

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
			bpm: 90,
			steps: [[1,1,0,1,0,0,1,1,0,1,1,0,0,0,0,0],
					 [0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
					 [1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,1],
					 [0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0]
					],
			midiNotes:[36, 38, 42, 43],
			midiClockMode: "standalone"
		}
		
		this.midi = null;
		this.options = defaults;
		this.midiInputs = new Array();
		this.midiOutputs = new Array();
		this.selectedMidiInput = 0;
		this.selectedMidiOutput = 0;
		
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
			//TODO standardise the data inside e.data, and make a switch case instead
			if(e.data == "clock" && this.options.midiClockMode=="master"){
				sendMidiClock();
			}
			else if(e.data["setBpm"] != undefined){
				this.bpmControl.value = e.data["setBpm"].toFixed(2);
				this.options.bpm = e.data["setBpm"];
			}
			else if(e.data["step"] != undefined){
				var currentStep = e.data["step"];
				
				if( this.options.midiClockMode=="master"){
					if(currentStep==0){
						sendMidiStart();
					}
				}
				
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
		// Change the steps
		this.setSteps = function(steps) {
			this.options.steps = steps;
			
		}
		this.setCursorPosition = function(position) {
			metronome.postMessage( JSON.stringify({action:"setCursorPosition", position:position}) );
			
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
			    navigator.requestMIDIAccess().then(
			    	function(midiAccess){
					    onMIDISuccess(midiAccess);
					}, 
					onMIDIFailure
					);
			}
		}.bind(this);
		
		// MIDI success
		var onMIDISuccess = function ( midiAccess ) {
			console.log( "MIDI ready!" );
			this.midi = midiAccess;  // store in the global (in real usage, would probably keep in an object instance)
			
			listMidiInAndOut( midiAccess );
			
			//Initialize the Midi output selector
			initMidiOutputControl();	
		}.bind(this);
		
		// MIDI Failure
		function onMIDIFailure(msg) {
			console.log( "Failed to get MIDI access - " + msg );
		}
		
		// Setting MIDI Input and Output
		var listMidiInAndOut = function( midiAccess ) {
			if(midiAccess){
				var outputs = this.midi.outputs.values();
				for (var output = outputs.next(); output && !output.done; output = outputs.next()) {
				    this.midiOutputs.push(output.value);
				}
				
				var inputs = this.midi.inputs.values();
				for (var input = inputs.next(); input && !input.done; input = inputs.next()) {
				    this.midiInputs.push(input.value);
				}
				this.midiInputs[this.selectedMidiInput].onmidimessage = this.onMIDIMessage;
			}
		}.bind(this);
		
		// Called when receiving any midi message
		this.onMIDIMessage = function(event){
			if(this.options.midiClockMode == "slave"){
				var timestamp = event.timestamp;
				var data = event.data;
				console.log(data);
				switch(data[0]) {
					// Receive a midi Clock signal
				    case 0xF8:
						metronome.postMessage( JSON.stringify({action:"clock"}) );
					break;
					// Receive a midi Play signal
				    case 0xFB:
						this.play();
					break;
					// Receive a midi Stop signal
				    case 0xFC:
						this.stop();
					break;
					// Receive a midi sursor position signal
				    case 0xF2:
						this.setCursorPosition(0);
					break;
				}
			}
		}.bind(this);
		
		// Send MIDI note
		var sendMidiNote = function (instrumentIndex) {
			
			var note = this.options.midiNotes[instrumentIndex];
			var midiOutput = this.midiOutputs[this.selectedMidiOutput];
			if(midiOutput){
				// Let set a latency on the midi. Can be usefull if playing audio and sending midi together.
				setTimeout(function(){
					var noteOnMessage = [0x90, note, 0x7f];    // note on, middle C, full velocity
					midiOutput.send( noteOnMessage );  //omitting the timestamp means send immediately.
					midiOutput.send( [0x80, note, 0x40], window.performance.now() + 10.0 ); // note off, release velocity = 64, timestamp = now + 100ms.                                                      
				}, this.options.midiLatency);
			}
		}.bind(this);
		
		var sendMidiClock = function(){
			midiOutput = this.midiOutputs[this.selectedMidiOutput];
			if(midiOutput){
				midiOutput.send( [0xF8] );
			}
			//midiOutput.send( [0xF8] );
		}.bind(this);
		
		var sendMidiStart = function(clockPosition){
			midiOutput = this.midiOutputs[this.selectedMidiOutput];
			if(midiOutput){
				midiOutput.send( [0xF2, 0x00, 0x00] );
				midiOutput.send( [0xFB] );
			}
		}.bind(this);
	
		// Initialize the visual
		var initVisual = function(){
			
			// The main container
			this.sequencerContainer = document.createElement("DIV");
			this.sequencerContainer.className = "da-beat-sequencer";
			document.body.appendChild(this.sequencerContainer); 
			
			// The controls inputs
			if(this.options.showControls){
				initControls();
			}
			
			// The grid
			initGrid();
		}.bind(this);
		
		// Initialize the controls
		var initControls = function(){
			this.controlsWrapper = document.createElement("DIV");
			this.controlsWrapper.className = "bpm-control-wrapper";
		
			this.playControl = document.createElement("BUTTON");
			this.playControl.className = "play";
			this.playControl.innerHTML = "Play";
			this.controlsWrapper.appendChild(this.playControl); 
			
			this.pauseControl = document.createElement("BUTTON");
			this.pauseControl.className = "pause";
			this.pauseControl.innerHTML = "Pause";
			this.controlsWrapper.appendChild(this.pauseControl); 
			
			this.stopControl = document.createElement("BUTTON");
			this.stopControl.className = "stop";
			this.stopControl.innerHTML = "Stop";
			this.controlsWrapper.appendChild(this.stopControl);
			
			// BPM input with label
			labelBpm = document.createElement("LABEL");
			labelBpm.innerHTML = "BPM";
			this.controlsWrapper.appendChild(labelBpm); 
			
			this.bpmControl = document.createElement("INPUT");
			this.bpmControl.setAttribute("type", "number");
			this.bpmControl.setAttribute("value", this.options.bpm);
			labelBpm.appendChild(this.bpmControl); 
			
			
			// Midi clock input with label
			if(this.options.sendMidi){
				labelMidiClockMode = document.createElement("LABEL");
				labelMidiClockMode.innerHTML = "Midi clock mode";
				this.controlsWrapper.appendChild(labelMidiClockMode); 
				
				this.midiClockModeControl = document.createElement("SELECT");
				
				option = document.createElement("OPTION");
			    option.value = "standalone";
			    option.text = "Standalone";
			    this.midiClockModeControl.appendChild(option);
			    option = document.createElement("OPTION");
			    option.value = "master";
			    option.text = "Master";
			    this.midiClockModeControl.appendChild(option);
			    // TODO: Will comme soon
			    option = document.createElement("OPTION");
			    option.value = "slave";
			    option.text = "Slave";
			    this.midiClockModeControl.appendChild(option);
			    
				labelMidiClockMode.appendChild(this.midiClockModeControl); 
			}
			
			if(this.options.playSound && this.options.sendMidi){
				
				// Audio latency input with label
				labelAudioLatency = document.createElement("LABEL");
				labelAudioLatency.innerHTML = "Audio latency";
				this.controlsWrapper.appendChild(labelAudioLatency); 
				
				this.audioLatencyControl = document.createElement("INPUT");
				this.audioLatencyControl.setAttribute("type", "number");
				this.audioLatencyControl.setAttribute("value", this.options.audioLatency);
				labelAudioLatency.appendChild(this.audioLatencyControl); 
				
				// Midi latency input with label
				labelMidiLatency = document.createElement("LABEL");
				labelMidiLatency.innerHTML = "Midi latency";
				this.controlsWrapper.appendChild(labelMidiLatency); 
				
				this.midiLatencyControl = document.createElement("INPUT");
				this.midiLatencyControl.setAttribute("type", "number");
				this.midiLatencyControl.setAttribute("value", this.options.midiLatency);
				labelMidiLatency.appendChild(this.midiLatencyControl); 
			}
			
			this.sequencerContainer.appendChild(this.controlsWrapper); 
		}.bind(this);
			
		// Initialize the midi output selector
		var initMidiOutputControl = function(){
			if(this.midiOutputs && this.midiOutputs.length>0){
				
				// Midi output selector with label
				labelMidiOutput = document.createElement("LABEL");
				labelMidiOutput.innerHTML = "Midi output";
				this.controlsWrapper.appendChild(labelMidiOutput); 
				
				this.midiOutControl = document.createElement("SELECT");
				
				for(var i=0; i<this.midiOutputs.length; i++){
				    var option = document.createElement("OPTION");
				    option.value = this.midiOutputs[i].id;
				    option.text = this.midiOutputs[i].name;
				    this.midiOutControl.appendChild(option);
				}
				labelMidiOutput.appendChild(this.midiOutControl);
				this.midiOutControl.addEventListener('change', function(){this.selectedMidiOutput = this.midiOutControl.selectedIndex;}.bind(this));
			}
		}.bind(this);
		
		
		// Initialize the grid
		var initGrid = function(){
			var self = this;
			this.gridElement = document.createElement("DIV");
			this.gridElement.className = "grid";
				
			for(var i = 0; i<this.options.steps.length; i++){
				
				var line = document.createElement("DIV");
				line.className = "instrument";
				this.gridElement.appendChild(line); 
				
				var steps = document.createElement("DIV");
				steps.className = "steps";
				
				// Midi note input with label
				if(this.options.sendMidi){
					labelMidiNote = document.createElement("LABEL");
					labelMidiNote.innerHTML = "Midi note";
					line.appendChild(labelMidiNote); 
					
					midiNoteControl = document.createElement("INPUT");
					midiNoteControl.setAttribute("type", "number");
					midiNoteControl.setAttribute("value", this.options.midiNotes[i]);
					labelMidiNote.appendChild(midiNoteControl);
					
					(function(i, midiNoteControl) {
						midiNoteControl.addEventListener('change', function(){self.options.midiNotes[i] = Number(midiNoteControl.value) }.bind(self));
					})(i, midiNoteControl);
				}
				
				// Create the visual representation of the steps 
				for(var s = 0; s<this.options.steps[i].length; s++){
					var block = document.createElement("DIV");
					block.className = "step";
					
					labelStep = document.createElement("LABEL");
					block.appendChild(labelStep); 
					
					stepInput = document.createElement("INPUT");
					stepInput.setAttribute("type", "checkbox");
					labelStep.appendChild(stepInput); 
					
					(function(i, s, stepInput) {
						stepInput.addEventListener('change', function(){ self.options.steps[i][s] = (stepInput.checked?1:0);}.bind(self));
					})(i, s, stepInput);
					
					stepInputSign = document.createElement("DIV");
					labelStep.appendChild(stepInputSign); 
					
					if(this.options.steps[i][s]){
						stepInput.setAttribute("checked", "checked");
					}
					
					steps.appendChild(block);  
					
					//block.addEventListener('click', this.close.bind(this)); 
				}
				line.appendChild(steps); 
			}
			
			this.sequencerContainer.appendChild(this.gridElement); 
		}.bind(this);

		// Refresh the visual
		var updateVisual = function(currentStep){
			if(this.gridElement){
				for(var i = 0; i<this.gridElement.childNodes.length; i++){
					
					var instrumentWrapper = this.gridElement.childNodes[i];
					var stepsWrapper = instrumentWrapper.getElementsByClassName("steps")[0];
				
					for(var s = 0; s<stepsWrapper.childNodes.length; s++){
						
						// Remove the active class on all elements
						stepElement = stepsWrapper.childNodes[s];
						stepElement.classList.remove("active");
						
						// Maybe the steps have changed so we rewrite each to be sure
						var stepInput = stepElement.getElementsByTagName("LABEL")[0].getElementsByTagName("INPUT")[0];
				
						if(this.options.steps[i][s]){
							stepInput.setAttribute("checked", "checked");
						}else{
							stepInput.removeAttribute("checked");
						}
					}
				}
				
				// Add the active class on current elements
				for(var i = 0; i<this.gridElement.childNodes.length; i++){
					
					var instrumentWrapper = this.gridElement.childNodes[i];
					var stepsWrapper = instrumentWrapper.getElementsByClassName("steps")[0];
					
					currentStepElement = stepsWrapper.childNodes[currentStep];
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
		    if (this.midiClockModeControl) {
		      this.midiClockModeControl.addEventListener('change', function(){this.options.midiClockMode = this.midiClockModeControl.value}.bind(this));
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
			var clock=null;
			var previousClockTime = null;
			var averageClockInterval = 0;
			var clockIntervalCount = 0;
			
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
							interval=(1000*60/bpm).toFixed(20);
							interval_2=interval/2;
							interval_4=interval/4;
							interval_clock = interval/23.8;
							
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
							pause();
						break;
					    case "stop":
							// Stop playing
							console.log("Stopping");
							stop();
						break;
					    case "setBpm":
							// Stop playing
							console.log("Set BPM");
							bpm = data.bpm
							
							if(clock){
								clearTimeout(clock);
								clock=null;
							}
							if(timer){
								clearTimeout(timer);
								timer=null;
								
								play();
							}
						break;
						case "setCursorPosition":
							position=data.position;
							currentStep = position;
						break;
						case "clock":
							var currentTime = new Date().getTime();
							if(previousClockTime!=null){
								clockIntervalCount++;
								averageClockInterval = averageClockInterval + (currentTime - previousClockTime);
								
								if(clockIntervalCount==6){
									averageClockInterval = averageClockInterval/6;
									bpm = (1000000 / (averageClockInterval*1000) / 24) * 60;
									averageClockInterval = 0;
								}
								
								clockIntervalCount = clockIntervalCount%6;
								
								
							}
							previousClockTime = currentTime;
							
							if(currentStep==6){
								calculateInterval();
								postMessage({"setBpm":bpm});
							}
						break;
			        }
				}
				
				function calculateInterval(){
					// Calculate the interval
					interval=1000*60/bpm;
					interval_2=interval/2;
					interval_4=interval/4;
					interval_clock = interval/23.8;
				}
				function play(){
					calculateInterval();
					if(!timer){
						updateTimer();
						/*timer = setInterval(  
							function(){
								postMessage({"step":currentStep});
								
								currentStep++;
								currentStep = currentStep % stepsInBar;
							}
						,interval_4);*/
					}else{
						console.log("Already playing!");
					}
					
					if(!clock){
						updateClock();
					}
				}
				function updateTimer(){
							
					postMessage({"step":currentStep});
						
					currentStep++;
					currentStep = currentStep % stepsInBar;
									
					clearTimeout(timer);
					timer = setTimeout(updateTimer, interval_4);
					
				};
				function updateClock(){
					postMessage("clock");				
					clearTimeout(clock);
					clock = setTimeout(updateClock, interval_clock);
				};
				function stop(){
					clearTimeout(timer);
					timer=null;							
					clearTimeout(clock);
					clock=null;
					currentStep = 0;
				}
				function pause(){
					clearTimeout(timer);
					timer=null;					
					clearTimeout(clock);
					clock=null;
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