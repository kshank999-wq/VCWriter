/**
 * **AutoCorrect** (from Ken, 21 November: *the spell checker needs to
 * automatically correct common words without asking — but this feature can
 * be turned off*). As Word's does: when a word is finished (a space or
 * punctuation after it), a common slip is put right where it stands — *teh*
 * becomes *the*, *dont* becomes *don't*. Only slips that are never words of
 * their own are on the list, so nothing a writer meant is ever changed;
 * anything else is the spell checker's to underline and the writer's to
 * decide. Backspace straight after a correction takes it back.
 */

const PAIRS: ReadonlyArray<readonly [string, string]> = [
  // Letters crossed
  ['teh', 'the'], ['hte', 'the'], ['tthe', 'the'], ['adn', 'and'], ['taht', 'that'], ['thta', 'that'],
  ['waht', 'what'], ['whta', 'what'], ['wiht', 'with'], ['iwth', 'with'], ['jsut', 'just'], ['becuase', 'because'],
  ['beacuse', 'because'], ['becasue', 'because'], ['thier', 'their'], ['hwich', 'which'], ['wich', 'which'],
  ['whcih', 'which'], ['wnat', 'want'], ['wnated', 'wanted'], ['knwo', 'know'], ['konw', 'know'], ['nkow', 'know'],
  ['abotu', 'about'], ['aboutt', 'about'], ['agian', 'again'], ['aginst', 'against'], ['alos', 'also'],
  ['alwasy', 'always'], ['alwyas', 'always'], ['anohter', 'another'], ['antoher', 'another'], ['awya', 'away'],
  ['bakc', 'back'], ['beign', 'being'], ['beleive', 'believe'], ['belive', 'believe'], ['bewteen', 'between'],
  ['cahnge', 'change'], ['chagne', 'change'], ['cmoe', 'come'], ['coudl', 'could'], ['cuold', 'could'],
  ['didnt', "didn't"], ['doesnt', "doesn't"], ['dont', "don't"], ['eahc', 'each'], ['evry', 'every'],
  ['firts', 'first'], ['frist', 'first'], ['freind', 'friend'], ['freinds', 'friends'],
  ['gonig', 'going'], ['goign', 'going'], ['gruop', 'group'], ['hda', 'had'], ['ahve', 'have'], ['hvae', 'have'],
  ['haev', 'have'], ['hsa', 'has'], ['hsi', 'his'], ['hlep', 'help'], ['ihs', 'his'], ['htis', 'this'],
  ['tihs', 'this'], ['thsi', 'this'], ['htey', 'they'], ['tehy', 'they'], ['theyre', "they're"], ['htere', 'there'],
  ['tehre', 'there'], ['thier', 'their'], ['htem', 'them'], ['tehm', 'them'], ['hten', 'then'], ['tehn', 'then'],
  ['iwll', 'will'], ['wiill', 'will'], ['wrok', 'work'], ['wokr', 'work'], ['wodl', 'world'], ['wrold', 'world'],
  ['woudl', 'would'], ['wuold', 'would'], ['yuo', 'you'], ['yoru', 'your'], ['yuor', 'your'], ['youre', "you're"],
  ['peopel', 'people'], ['poeple', 'people'], ['pepole', 'people'], ['shoudl', 'should'], ['shuold', 'should'],
  ['soem', 'some'], ['smoe', 'some'], ['somethign', 'something'], ['soemthing', 'something'], ['tiem', 'time'],
  ['tmie', 'time'], ['thign', 'thing'], ['thigns', 'things'], ['thnig', 'thing'], ['tkae', 'take'], ['taht', 'that'],
  ['woh', 'who'], ['whihc', 'which'], ['whiel', 'while'], ['wehn', 'when'], ['whne', 'when'], ['wehre', 'where'],
  ['whcih', 'which'], ['yera', 'year'], ['yeras', 'years'],
  // Spelled as it sounds
  ['accomodate', 'accommodate'], ['acheive', 'achieve'], ['acheived', 'achieved'], ['accross', 'across'],
  ['agressive', 'aggressive'], ['alot', 'a lot'], ['apparant', 'apparent'], ['arguement', 'argument'],
  ['basicly', 'basically'], ['begining', 'beginning'], ['buisness', 'business'], ['calender', 'calendar'],
  ['carribean', 'Caribbean'], ['cemetary', 'cemetery'], ['collegue', 'colleague'], ['comming', 'coming'],
  ['commited', 'committed'], ['completly', 'completely'], ['concious', 'conscious'], ['curiousity', 'curiosity'],
  ['definately', 'definitely'], ['definatly', 'definitely'], ['dissapear', 'disappear'], ['dissapoint', 'disappoint'],
  ['embarass', 'embarrass'], ['enviroment', 'environment'], ['excercise', 'exercise'], ['existance', 'existence'],
  ['experiance', 'experience'], ['familar', 'familiar'], ['finaly', 'finally'], ['foriegn', 'foreign'],
  ['fourty', 'forty'], ['freind', 'friend'], ['goverment', 'government'], ['gaurd', 'guard'], ['happend', 'happened'],
  ['harrass', 'harass'], ['heighth', 'height'], ['heirarchy', 'hierarchy'], ['humourous', 'humorous'],
  ['ignorence', 'ignorance'], ['immediatly', 'immediately'], ['independant', 'independent'], ['interupt', 'interrupt'],
  ['knowlege', 'knowledge'], ['liason', 'liaison'], ['libary', 'library'], ['lisence', 'license'],
  ['maintainance', 'maintenance'], ['millenium', 'millennium'], ['mischievious', 'mischievous'],
  ['neccessary', 'necessary'], ['necesary', 'necessary'], ['noticable', 'noticeable'],
  ['occassion', 'occasion'], ['occured', 'occurred'], ['occurence', 'occurrence'], ['occurance', 'occurrence'],
  ['persistant', 'persistent'], ['posession', 'possession'], ['potatos', 'potatoes'], ['preceed', 'precede'],
  ['prefered', 'preferred'], ['probaly', 'probably'], ['probalby', 'probably'], ['publically', 'publicly'],
  ['realy', 'really'], ['reccomend', 'recommend'], ['recomend', 'recommend'], ['recieve', 'receive'],
  ['recieved', 'received'], ['recieves', 'receives'], ['refered', 'referred'], ['relevent', 'relevant'],
  ['religous', 'religious'], ['remeber', 'remember'], ['rember', 'remember'], ['resistence', 'resistance'],
  ['rythm', 'rhythm'], ['sence', 'sense'], ['seperate', 'separate'], ['seperately', 'separately'],
  ['sieze', 'seize'], ['similiar', 'similar'], ['sincerly', 'sincerely'], ['speach', 'speech'], ['succesful', 'successful'],
  ['successfull', 'successful'], ['suprise', 'surprise'], ['suprised', 'surprised'],
  ['tendancy', 'tendency'], ['threshhold', 'threshold'], ['tomatos', 'tomatoes'],
  ['tommorow', 'tomorrow'], ['tommorrow', 'tomorrow'], ['tomorow', 'tomorrow'], ['tounge', 'tongue'],
  ['truely', 'truly'], ['twelth', 'twelfth'], ['tyrany', 'tyranny'], ['untill', 'until'],
  ['unforseen', 'unforeseen'], ['usualy', 'usually'], ['vaccum', 'vacuum'], ['visable', 'visible'],
  ['wierd', 'weird'], ['wellcome', 'welcome'], ['whereever', 'wherever'], ['writting', 'writing'],
  ['writen', 'written'], ['wrtie', 'write'], ['wriet', 'write'], ['charachter', 'character'], ['charcter', 'character'],
  ['chracter', 'character'], ['scirpt', 'script'], ['sceen', 'scene'], ['dialouge', 'dialogue'], ['dialoge', 'dialogue'],
  ['protagnist', 'protagonist'], ['antagnoist', 'antagonist'], ['narative', 'narrative'], ['chapetr', 'chapter'],
  // Apostrophes left out (never words without them)
  ['arent', "aren't"], ['couldnt', "couldn't"], ['hadnt', "hadn't"], ['hasnt', "hasn't"], ['havent', "haven't"],
  ['isnt', "isn't"], ['mustnt', "mustn't"], ['neednt', "needn't"], ['shouldnt', "shouldn't"], ['wasnt', "wasn't"],
  ['werent', "weren't"], ['wouldnt', "wouldn't"], ['couldve', "could've"], ['shouldve', "should've"],
  ['wouldve', "would've"], ['mightve', "might've"], ['mustve', "must've"], ['thats', "that's"], ['whats', "what's"],
  ['wheres', "where's"], ['theres', "there's"], ['heres', "here's"], ['im', "I'm"], ['ive', "I've"], ['youve', "you've"],
  ['weve', "we've"], ['theyve', "they've"], ['youll', "you'll"], ['theyll', "they'll"], ['itll', "it'll"],
  ['shes', "she's"], ['hes', "he's"], ['doesnt', "doesn't"], ['didnt', "didn't"], ['dont', "don't"],
  // A lone i is I
  ['i', 'I'],
];

/** One-word slips, by their lower-case spelling. */
const SLIPS: ReadonlyMap<string, string> = new Map(PAIRS.filter(([from, to]) => !from.includes(' ') && from !== to).map(([from, to]) => [from, to]));

/** The corrections, for the Preferences list and the tests. */
export const AUTOCORRECT_SLIPS = SLIPS;

/**
 * What a finished word should be, or null to leave it. The writer's capitals
 * carry over — *Teh* is *The*, *TEH* is *THE* — except that a correction with
 * a capital of its own (*I*, *I'm*, *Caribbean*) keeps it.
 */
export const autocorrectWord = (word: string): string | null => {
  const fixed = SLIPS.get(word.toLowerCase());
  if (!fixed) return null;
  if (fixed !== fixed.toLowerCase()) return fixed;
  if (word.length > 1 && word === word.toUpperCase()) return fixed.toUpperCase();
  if (word[0] === word[0]!.toUpperCase() && word[0] !== word[0]!.toLowerCase()) return fixed[0]!.toUpperCase() + fixed.slice(1);
  return fixed;
};

/** What ends a word, for AutoCorrect: a space or a mark of punctuation. */
export const WORD_END = /[\s.,;:!?)"”’\]]/;

/**
 * **The word just finished, put right** — for a plain text box. Given the
 * text and the caret just after the character typed, returns the new text and
 * caret where the word before that character was a slip, or null. Inside a
 * word's emphasis marks or a citation, nothing is touched.
 */
export const autocorrectAt = (text: string, caret: number): { text: string; caret: number; from: number; to: number; was: string } | null => {
  if (caret < 2) return null;
  const typed = text[caret - 1]!;
  if (!WORD_END.test(typed)) return null;
  let start = caret - 1;
  while (start > 0 && /[\p{L}]/u.test(text[start - 1]!)) start -= 1;
  const word = text.slice(start, caret - 1);
  if (!word) return null;
  // *i.e.*, *i.* in a list: a lone i before a full stop is not the pronoun.
  if (word === 'i' && typed === '.') return null;
  // A word joined to something before it (an apostrophe, a mark, a digit) is not a word on its own.
  if (start > 0 && !/[\s("“‘\[—–-]/.test(text[start - 1]!)) return null;
  const fixed = autocorrectWord(word);
  if (!fixed || fixed === word) return null;
  return { text: text.slice(0, start) + fixed + text.slice(caret - 1), caret: caret + fixed.length - word.length, from: start, to: start + fixed.length, was: word };
};
