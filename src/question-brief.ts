/** Teaching purpose and item checks shared by all question formats. */
export const COMMON_QUESTION_BRIEF = `Write English practice for Taiwanese high-school students (GSAT-inspired). Return only JSON matching the schema.

Teaching core
- Each item teaches one distinction (meaning, form, connection or inference) that the learner decides from evidence in the text. The target word being supplied is never itself the reason for the answer.
- Use each source in its given sense (word + pos + meaningZh) in a natural sentence. Normal inflections are fine; a derived word (recovery for recover) is not.
- Write a familiar, natural scene with mainly common high-school words. Difficulty comes from how clues relate, not from rare words.
- After masking the answer, exactly one choice must work. Distractors must conflict with the evidence, not merely be less likely; reject properties that can coexist with the answer (reliable vs expensive). Every choice must fit the hole grammatically with the words left outside it. Distractors share the answer's part of speech and a related meaning field, so the learner must read the clue to reject them.
- Learners have studied the whole set, so a choice that is the only set word gives the answer away. For single-word meaning choices, take at least two distractors from setWords (same part of speech, adapted to the needed form) whenever they fit grammatically; they must still be clearly wrong by the evidence.
- The explanation teaches the clue that survives masking. Never use the hidden answer itself as proof. "Not mentioned" is not "impossible".
- Keep situations varied: each item or passage gets its own setting (school, home, travel, science, sports, work, nature...), not the first scene the words suggest. One item must not reveal another's answer.

Format
- Prose keeps the original answers in place; the program makes blanks. usage is an exact contiguous span copied from the text that occurs once; answer occurs once inside usage. Copy spans exactly.
- English text and options; concise Taiwan Traditional Chinese explanation and reasons. whyWrong lists each distractor once as {option, reason}: for meaning choices the reason is that option's own short Chinese meaning (add "；" + one short difference only if easily confused); for form choices one short form obstacle; for reading one short sentence tied to the passage. Do not repeat the explanation in reasons.
- Length matters: hit the aimed English word count in the task for every sentence or passage (count the words); short contexts give too few clues. Follow the specification for counts. Work through items in activeRef order and return only the final JSON.`;
