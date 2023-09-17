#!/usr/bin/env node

import { Command } from "@commander-js/extra-typings";
import _ from "lodash";
import OpenAI from "openai";
import ProgressBar from "progress";
import { getWordList } from "./input";
import { FlashCard, createFlashcard } from "./chatgpt";
import { outputFlashCards } from "./output";

async function run() {
  const program = new Command()
    .name("chatgpt-flashcard-creator")
    .version("0.4.0")
    .requiredOption("-k, --key <chatGPTApiKey>", "API Key of ChatGPT")
    .requiredOption(
      "-w, --wordLang <language>",
      "Language of the words in the input",
      "english",
    )
    .requiredOption(
      "-d, --definitionLang <language>",
      "Desired language of the definiton on the backside of the flashcard",
      "english",
    )
    .option(
      "-t, --translationLang <language>",
      "Desired language of the translation on the backside of the flashcard. Optional",
    );

  program.parse();
  const { key, wordLang, definitionLang, translationLang } = program.opts();
  const openAI = new OpenAI({
    apiKey: key,
    timeout: 30000, // 30s
    maxRetries: 2,
  });

  const inputWords = await getWordList();

  var bar = new ProgressBar(
    "generating :word [:bar] :current/:total :percent'",
    {
      total: inputWords.length,
    },
  );

  const flashCards: FlashCard[] = [];
  for (const word of inputWords) {
    try {
      const card = await createFlashcard(
        word,
        wordLang,
        translationLang,
        definitionLang,
        openAI,
      );
      flashCards.push(card);
    } catch (err: unknown) {
      console.log(
        `Error: There was an error generating the flashCard for word ${word}. Will be skipped!`,
      );
    } finally {
      bar.tick({ word });
    }
  }
  outputFlashCards(flashCards);
}

run();
