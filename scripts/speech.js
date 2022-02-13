function SpeechTracker() {
  let module = {};
  let mlogger = (a) => { }
  let disconnected = true;

  module.speech_loc_match = function (mapping, word) {
    for(var i = 0; i < mapping.length; i++) {
      if (mapping[i].words.includes(word)) {
        return i;
      }
    }
    return -1;
  }

  module.speech_value_match = function(mapping, word) {
    for (var j = 0; j < mapping.length; j++) {
      if (mapping[j].words.includes(word)) {
        return j;
      }
    }
    return -1;
  }
  // Mapping: { slot: Obj, words: ["word", "another"]}
  // slot: Obj { options: whatever }
  // Mapping for options: [{key: ID, words: [whatever you want to parse]]

  module.speech_loc_map = function(keyItemElems) {
    reducer = (r, a) => {
      r.push({
        slot: a.children[0],
        words: [ a.children[0].getAttribute('speechtext')]
      });
      return r;
    }
    return keyItemElems.reduce(reducer, []);
  }

  module.speech_option_map = function(options) {
    let options_array = Array.from(options);
    option_reducer = (r, a) => {
      let words = [];
      if (a.getAttribute('speechtext')) {
        words.push(a.getAttribute('speechtext'));
      }
      var cleanedInner = a.innerHTML.toLowerCase();
      if (cleanedInner.startsWith('(')) {
        cleanedInner = cleanedInner.split(" ")[1]
      }
      words.push(cleanedInner);
      let o = {
        key: a.getAttribute('value'),
        words: words
      };
      r.push(o);
      return r;
    }
    return options_array.reduce(option_reducer, []);
  }

  module.speech_match = function(elem, index) {
    module.markSlot(index, elem);
  }

  // This is for the more 'complex' mark a slot WITH something functionality
  // It is a little tightly bound to the old tracker but I could fix it
  module.markSlotWithItemFromSpeech = function(slots, splitSpeech) {
    let loc_mapping = module.speech_loc_map(slots);
    let elem_index = module.speech_loc_match(loc_mapping, splitSpeech[0]);
    if (elem_index >= 0) {
      let elem = loc_mapping[elem_index].slot;
      let mergedSpeech = splitSpeech.slice(1).join(" ");
      let option_mapping = module.speech_option_map(elem.options);
      let option_index = module.speech_value_match(option_mapping, mergedSpeech);
      if (option_index >= 0) {
        module.speech_match(elem, option_index);
        return true;
      }
    }
    return false;
  }

  // slots for this function is just an ordered list of word arrays
  module.markSlotFromSpeech = function(slots, splitSpeech) {
    let mergedSpeech = splitSpeech.join(" ");
    let elem_index = module.speech_loc_match(slots, mergedSpeech);
    if (elem_index >= 0) {
      module.markSlot(elem_index);
      return true;
    }
    return false;
  }

  module.modeSwitch = function(splitSpeech, complex) {
    if (module.getMarkingWords().includes(splitSpeech[0])) {
      mlogger('Mark match!');
      if (complex) {
        return module.markSlotWithItemFromSpeech(module.getSlotMapping(), splitSpeech.slice(1));
      }
      return module.markSlotFromSpeech(module.getSlotMapping(), splitSpeech.slice(1));
    }
    return false;
  }

  // Needs to be overridden, slot is only required for complex set passthroughs
  module.markSlot = function(index, slot) {
    mlogger('Mark slot undefined.');
    return false;
  }

  module.getMarkingWords = function() {
    return ['set', 'mark'];
  }

  module.getWakingWords = function() {
    return ['tracker','tracking','cracker'];
  }

  // Needs to be overridden to work
  module.getSlotMapping = function() {
    return [ {} ]
  }

  module.connect = function(mywindow, alts, complex, logging, grammar) {
    if (logging) {
      mlogger = console.log;
    }
    mlogger('Speech Recognition Initializing');
    grammar = grammar || '#JSGF V1.0; grammar tracking; public <start> = tracker <action> ; public <action> = set ;'
    alts = alts || 10;
    compplex = complex || false;
    disconnected = false;
    var recognition = new mywindow.SpeechRecognition;
    var speechRecognitionList = new SpeechGrammarList();
    speechRecognitionList.addFromString(grammar, 1);
    recognition.grammars = speechRecognitionList;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = alts;
    recognition.onresult = (event) => {
      mlogger(event.results[0]);
      const results = event.results[0];
      for (var i = 0; i < results.length; i++) {
        const result = results[i];
        const speechText = result.transcript;
        const splitSpeech = speechText.toLowerCase().split(" ");
        if (module.getWakingWords().includes(splitSpeech[0])) {
          mlogger('Tracker match!');
          var speechMatched = module.modeSwitch(splitSpeech.slice(1), complex);
        }
        if (speechMatched) {
          module.auto_update_func();
          return true;
        }
      }
      return false;
    }
    recognition.onend = (event) => {
      mlogger('Speech recognition service disconnected');
      if (!disconnected) {
        recognition.start();
      }
    }
    recognition.start();
  }

  module.disconnect = function() {
    disconnected = true;
    recognition.stop();
  }

  module.auto_update_func = () => {}

  return module;
}
