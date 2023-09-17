import { z } from "zod";
import OpenAI from "openai";

const FlashCardSchema = z.object({
  word: z.string().nonempty(),
  definition: z.string().nonempty(),
  translation: z.string().nonempty().optional(),
  wordClass: z.string().nonempty(),
  examples: z.array(z.string().nonempty()),
});
export type FlashCard = z.infer<typeof FlashCardSchema>;
export async function createFlashcard(
  word: string,
  wordLanguage: string,
  translationFieldLanguage: string | undefined,
  definitionFieldLanguage: string,
  openAI: OpenAI,
): Promise<FlashCard> {
  let completion: OpenAI.Chat.Completions.ChatCompletion;

  const functionJSONSchema: Record<string, any> = {
    type: "object",
    properties: {
      word: {
        type: "string",
        description: `The word in ${wordLanguage}. Always specified in its dictionary form. This means for verbs the base form, also known as the infinitive, so instead of 'running' it would be 'to run'. For nouns the singular, so instead of 'apples' it would be 'apple'.`,
      },
      definition: {
        type: "string",
        description: `A definition of the word in ${wordLanguage}`,
      },
      wordClass: {
        type: "string",
        description:
          "A word class is a group of words that have the same basic behaviour, for example nouns, adjectives, or verbs. Modern english grammars normally recognise four major word classes (verb, noun, adjective, adverb) and five other word classes (determiners, preposition, pronoun, conjunction, interjection), making nine word classes (or parts of speech) in total",
      },
      examples: {
        type: "array",
        maxItems: 3,
        minItems: 3,
        description: `An array containing exactly three example sentences using the word to demonstrage the usage. Each sentence is written in ${definitionFieldLanguage}`,
        items: {
          type: "string",
          description: `An example sentence using the word in its original language. The sentence is written in ${definitionFieldLanguage}`,
        },
      },
    },
  };

  if (translationFieldLanguage !== undefined) {
    functionJSONSchema.properties.translation = {
      type: "string",
      description: `The word translated into ${translationFieldLanguage}`,
    };
  }

  try {
    completion = await openAI.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You will be provided with a word in ${wordLanguage} , and your task is create a flashcard for language learning for it. `,
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
          parameters: functionJSONSchema,
        },
      ],
    });
  } catch (err: unknown) {
    console.error("Error: Problem communicating with ChatGPT!");
    throw err;
  }
  let chatGPTResponse: FlashCard;
  try {
    const args = completion.choices[0].message.function_call?.arguments;
    if (args === undefined) {
      throw new Error("Error: ChatGPT function arguments undefined.");
    }
    chatGPTResponse = FlashCardSchema.parse(JSON.parse(args));
  } catch (err: unknown) {
    console.error(
      "Error: Response form ChatGPT does not have the expected format!",
    );
    throw err;
  }
  return {
    ...chatGPTResponse,
  };
}
