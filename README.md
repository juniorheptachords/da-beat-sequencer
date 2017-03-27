# Da Beat Sequencer
Easy to use Audio / Midi beat sequencer.

Still in development, works only in chrome but planned to be working on all browsers.

## How to use
Include the 2 files da-beat-sequecer.js and da-beat-sequencer.css and instantiate the sequencer like this:
```javascript
var sequencer = new DaBeatSequencer();
```
For examples see in the demo folder.

## Properties

### autoplay
Start playing as soon as it is ready.
__Default: true__

### showVisual
Create a visual representation of the sequencer.
__Default: true__

### showControls
Create inputs to control the sequencer.
__Default: true__

### samplesSet
Array of samples in base64 strings for the audio mode.
__Default: array of 4 samples__
		
### sendMidi
Send midi notes to a midi port. Currently the midi port is not configurable.
__Default: false__

### playSound
Play the samples set in the sampleSet option.
__Default: true__


### audioLatency
When playSound true and sendMidi true to play sound and send midi together, there could be latency between the audio in the browser and in the synthesizer connected to the midi out. This parameter allow to set a latency on the audio in milliseconds.
__Default: 0__
			
### midiLatency
Same as audioLatency but for the midi.
__Default: 0__	

### bars
Number of bars in the sequence. Currently not used.
__Default: 1__	


### stepsInBar
Number of steps in each bar. Some work to do still.
__Default: 16__	

### bpm
The bpm obviously.
__Default: 110__	
	
### steps
2D array representing the steps.
__Default:  [
			[1,1,0,1,0,0,1,1,0,1,1,0,0,0,0,0],
			[0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0],
			[1,0,1,1,1,0,1,0,1,0,1,0,1,0,1,1],
			[0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0]
			]__

### midiNotes
Array of midi notes used when sending midi. The order in the array is related to the array of steps.
__Default: [36, 38, 42, 43] __


## To do
- Make it work on all browser!
- Allow configuration of the midi port
- Allow more bars to be defined
- Load samples from files in addition of base64
- Allow more flexibility on customization/override 
- Make some more css
...