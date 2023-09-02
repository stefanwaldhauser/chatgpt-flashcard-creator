#!/usr/bin/env node

import { parse, stringify } from "csv/sync";
import { Command } from "@commander-js/extra-typings";
import fs from "fs/promises";
import { PathLike } from "fs";
import _ from "lodash";
import OpenAI from "openai";
import { z } from "zod";

function stripNonAlphanumericFromStartAndEnd(input: string): string {
  const regex = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;
  return input.replace(regex, "");
}

async function extractWordsFromInputCSV(path: PathLike, column: number) {
  const transform = (record: Array<string>) => {
    const cell = record[column - 1];
    const stripped = stripNonAlphanumericFromStartAndEnd(cell);
    const numberOfWords = _.words(stripped).length;

    if (stripped.length === 0 || numberOfWords > 1) {
      return null;
    } else {
      return stripped;
    }
  };
  const data = await fs.readFile(path);
  const records = parse(data, {
    bom: true,
    trim: true,
    onRecord: transform,
  });
  return records as string[];
}

const flashcardSchema = z.object({
  definition: z.string().nonempty(),
  translation: z.string().nonempty(),
  examples: z.array(z.string().nonempty()),
});

type Flashcard = z.infer<typeof flashcardSchema>;

async function createFlashcard(
  word: string,
  sourceLanguage: string,
  targetLanguage: string,
  openAI: OpenAI,
): Promise<Flashcard | undefined> {
  let result: Flashcard | undefined;
  let tryNr = 1;
  while (result === undefined && tryNr <= 3) {
    const completion = await openAI.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You will be provided with a word in ${sourceLanguage} , and your task is create a flashcard for language learning for it`,
        },
        {
          role: "user",
          content: word,
        },
      ],
      model: "gpt-3.5-turbo",
      function_call: {
        name: "createFlashcard",
      },
      functions: [
        {
          name: "createFlashcard",
          description: "create a flashcard",
          parameters: {
            type: "object",
            properties: {
              definition: {
                type: "string",
                description: `A definition of the word in ${sourceLanguage}`,
              },
              translation: {
                type: "string",
                description: `The word translated into ${targetLanguage}`,
              },
              examples: {
                type: "array",
                maxItems: 3,
                minItems: 3,
                description: `An array containing exactly three example sentences using the word to demonstrage the usage. The sentence is in ${sourceLanguage}`,
                items: {
                  type: "string",
                  description: `An example sentence using the word in its original language. The sentence is in ${sourceLanguage}`,
                },
              },
            },
          },
        },
      ],
    });

    const args = completion.choices[0].message.function_call?.arguments;
    if (args) {
      try {
        const fnCallArgs = JSON.parse(args);
        const flashCard = flashcardSchema.parse(fnCallArgs);
        result = flashCard;
      } catch (e) {
        console.error(e);
      }
    }
    tryNr++;
  }

  return result;
}

function flashcardToAnkiString(flashCard: Flashcard) {
  let result = ``;
  result += flashCard.translation + `\n`;
  result += `----------- \n`;
  result += flashCard.definition + `\n`;
  result += `----------- \n`;
  flashCard.examples.forEach((example) => {
    result += example + `\n`;
  });
  return result;
}

async function writeCSV(
  path: PathLike,
  words: string[],
  apiKey: string,
  sourceLanguage: string,
  targetLanguage: string,
) {
  const openAI = new OpenAI({
    apiKey,
  });

  const entries = await Promise.all(
    words.map(async (word: string) => {
      const flashCard = await createFlashcard(
        word,
        sourceLanguage,
        targetLanguage,
        openAI,
      );
      if (flashCard) {
        return [word, flashcardToAnkiString(flashCard)];
      } else {
        return [word, "error"];
      }
    }),
  );

  const outputCSV = stringify(entries, {
    bom: true,
  });

  await fs.writeFile(path, outputCSV);
}

async function run() {
  const program = new Command()
    .requiredOption("-if, --inputFile <inputFile>")
    .requiredOption("-wc, --wordColumn <wordColumn>")
    .requiredOption("-sl, --sourceLanguage <sourceLanguage>")
    .requiredOption("-tl, --targetLanguage <targetLanguage>")
    .requiredOption("-of, --outputFile <outputFile>")
    .requiredOption("-k, --key <chatGPTApiKey>");
  program.parse();
  const {
    inputFile,
    wordColumn,
    outputFile,
    key,
    sourceLanguage,
    targetLanguage,
  } = program.opts();

  const words = await extractWordsFromInputCSV(inputFile, parseInt(wordColumn));
  await writeCSV(outputFile, words, key, sourceLanguage, targetLanguage);
}

run();
