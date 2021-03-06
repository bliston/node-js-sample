// http://localhost:5000/next-melody-note?leapstart_notename=C2&leapend_notename=D2&prev_melody_notename=C3&scale_to_traverse_keyname=C&scale_to_traverse_name=pentatonic

// http://localhost:5000/next-middle-chord-notes?code=C(C:Major)|E7sus4(A:harmonic%20minor)&index=0
// http://localhost:5000/next-middle-melody-note?code=C(C:Major)|E7sus4(A:harmonic%20minor)&index=0&leapstart_notename=C2&leapend_notename=D2&prev_melody_notename=F3

var defaultChordOctave = 4

var express = require('express')
var s11 = require('sharp11')
var _ = require('underscore')
var app = express()

app.set('port', (process.env.PORT || 5000))
app.use(express.static(__dirname + '/public'))
app.use(express.json())       // to support JSON-encoded bodies
app.use(express.urlencoded())

app.get('/midi-thru', function(request, response) {
	var midi = request.query.midi
  response.json({'midi': midi})
})

app.get('/next-melody-note', function(request, response) {
	response.json(nextMelodyNoteQuery(request, response))
})

app.post('/middle-code-to-middle-json', function(request, response) {
	response.json(middleQuery(request, response))
})

app.post('/next-middle-chord-notes', function(request, response) {
	response.json(nextMiddleChordNotesQuery(request, response))
})

app.post('/next-middle-melody-note', function(request, response) {
	response.json(nextMiddleMelodyNoteQuery(request, response))
})

function middleQuery(request, response) {
	var middleCodeResults = middleResults(
			request.body.code
		)
	console.log(middleCodeResults)
	return {result : middleCodeResults }
	
}

function nextMiddleChordNotesQuery(request, response) {
	var middleCodeResults = middleCodeSharp11Results(
			request.body.code
		)
	var chordNotes = chordNoteValues(middleCodeResults[request.body.index % middleCodeResults.length].chord)
	return {midi : chordNotes }
	
}

function nextMiddleMelodyNoteQuery(request, response) {
	var middleCodeResults = middleCodeSharp11Results(
		request.body.code
	)
	melodyResult = nextMelodyNote(
		request.body.leapstart_notename
		, request.body.leapend_notename
		, request.body.prev_melody_notename
		, middleCodeResults[request.body.index % middleCodeResults.length].scale.key
		, middleCodeResults[request.body.index % middleCodeResults.length].scale.name
	)
	return {midi: [melodyResult.nextMelodyNoteVal]} 

}

function nextMelodyNoteQuery(request, response) {
	return nextMelodyNote(
			request.query.leapstart_notename
			, request.query.leapend_notename
			, request.query.prev_melody_notename
			, request.query.scale_to_traverse_keyname
			, request.query.scale_to_traverse_name
		)
}

function middleResults(code) {
	// C(C:Major)|E7sus4(A:harmonic minor)
	return _.map(middleCodeStringResults(code), function(middleCodeStringResult){
		return {
			'chordNotes' : chordNoteValues(
				s11.chord.create(
					middleCodeStringResult.chordName
					, defaultChordOctave))
			,'scaleNotes' : scaleSpace(
				s11.scale.create(
					middleCodeStringResult.scaleKeyName
					, middleCodeStringResult.scaleName))
		}
	})
}

function middleCodeSharp11Results(code) {
	// C(C:Major)|E7sus4(A:harmonic minor)
	return _.map(middleCodeStringResults(code), function(middleCodeStringResult){
		return {
			'chord' : s11.chord.create(middleCodeStringResult.chordName, defaultChordOctave)
			,'scale' : s11.scale.create(middleCodeStringResult.scaleKeyName, middleCodeStringResult.scaleName)
		}
	})
}

function middleCodeStringResults(code) {
	// C(C:Major)|E7sus4(A:harmonic minor)
	var chordScaleStrings = code.split('|')
	return _.map(chordScaleStrings, function(chordScaleString){
		var chordString = chordScaleString.split('(')[0]
		var scaleString = chordScaleString.split('(')[1].replace(')', '')
		var scaleKey = scaleString.split(':')[0]
		var scaleName = scaleString.split(':')[1]
		console.log(chordString)
		console.log(scaleString)
		console.log(scaleKey)
		console.log(scaleName)
		return {
			'chordName' : chordString
			,'scaleKeyName' : scaleKey
			,'scaleName' : scaleName
		}
	})
}

function scaleSpace(scale) {
	var scaleArray = _.filter(
		_.range(0,127)
			, function(val) {
				var include
				try{
					include = scale.contains(s11.note.fromValue(val))
				}
				catch(err){
					include = false
				}
				return include
			}
		)
	return scaleArray
}

function chordNoteValues(chord) {
	return fitChordInOctaveAndDropBass(chord, defaultChordOctave)
}

function fitChordInOctaveAndDropBass(chord, octave) {
	notes = _.map(chord.chord, function(note, i){
		note.octave = octave
		return note.value()
	})
	bassNote = chord.chord[0]
	bassNote.octave = octave - 1
	notes.unshift(bassNote.value())
	notes.sort()
	return notes


}

function nextMelodyNote(leapStartNoteName, leapEndNoteName, prevMelodyNoteName, scaleToTraverseKeyName, scaleToTraverseName) {
	var leapStartNote = s11.note.create(leapStartNoteName)
	var leapEndNote = s11.note.create(leapEndNoteName)
	var prevMelodyNote = s11.note.create(prevMelodyNoteName)
	var scaleToTraverse = s11.scale.create(scaleToTraverseKeyName, scaleToTraverseName)
	
	console.log(scaleToTraverse.key.fullName)
	console.log(scaleToTraverse.name)
	console.log(scaleToTraverse.toString())
	
	var defaultPrevMelodyNote = scaleToTraverse.nearest(s11.note.create('C4'))

	var lastMelodyNote = prevMelodyNote || defaultPrevMelodyNote
	var numWhiteNotesBetweenNotes = countWhiteNotesBetweenNotes(leapStartNote, leapEndNote)
	var leapNonZero = Math.abs(leapEndNote.value() - leapStartNote.value()) > 0

	var leapInScaleSteps = numWhiteNotesBetweenNotes == 0 ? (leapNonZero ? 1 : 0) : numWhiteNotesBetweenNotes
  	console.log(leapInScaleSteps)
  	var leapDirectionDown = leapStartNote.value() > leapEndNote.value()  

	var lastMelodyNoteAdjustedToScale = scaleToTraverse.nearest(lastMelodyNote)
	traversableScale = scaleToTraverse.traverse(lastMelodyNoteAdjustedToScale)

	var lastMelodyNoteScaleSnapDirectionDown = lastMelodyNote.value() > lastMelodyNoteAdjustedToScale.value()

	var lastMelodyNoteIsInScale = lastMelodyNote.value() == lastMelodyNoteAdjustedToScale.value()

	var signedLeapInScaleSteps = leapInScaleSteps * (leapDirectionDown ? -1 : 1)
	
	var isLastNoteInScaleSufficientWithoutShift = false
	
	// take one away from shift if the scale note snap agrees with the leap direction
	if(!lastMelodyNoteIsInScale && signedLeapInScaleSteps > 0 && !lastMelodyNoteScaleSnapDirectionDown) {
		signedLeapInScaleSteps--
	}
	else if(!lastMelodyNoteIsInScale && signedLeapInScaleSteps < 0 && lastMelodyNoteScaleSnapDirectionDown) {
		signedLeapInScaleSteps++
	}

	traversableScale = traversableScale.shift(signedLeapInScaleSteps)
  	var nextMelodyNote = traversableScale.current()
  	return {'lastMelodyNoteName': lastMelodyNote.fullName, 'lastMelodyNoteVal': lastMelodyNote.value(),'nextMelodyNoteName': nextMelodyNote.fullName,'nextMelodyNoteVal': nextMelodyNote.value()}
}

function countWhiteNotesBetweenNotes(note1, note2) {
	var orderedNotes = _.sortBy([note1, note2], function(note){ return note.value() })
	var betweenNoteValues = _.range(orderedNotes[0].value(), orderedNotes[1].value())
	var noteValsBetween = _.countBy(betweenNoteValues, function(val){return s11.note.fromValue(val).clean().accidental === 'n' ? 'natural' : 'unatural' })
	return noteValsBetween.natural ? noteValsBetween.natural : 0
}

app.listen(app.get('port'), function() {
  console.log("Node app is running at localhost:" + app.get('port'))
})
