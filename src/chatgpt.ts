import { z } from "zod";
import OpenAI from "openai";

const ChatGPTResponseSchema = z.object({
  definition: z.string().nonempty(),
  translation: z.string().nonempty().optional(),
  examples: z.array(z.string().nonempty()),
});
type ChatGPTResponse = z.infer<typeof ChatGPTResponseSchema>;
const FlashCardSchema = ChatGPTResponseSchema.extend({
  word: z.string().nonempty(),
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
      definition: {
        type: "string",
        description: `A definition of the word in ${wordLanguage}`,
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
          content: `You will be provided with a word in ${wordLanguage} , and your task is create a flashcard for language learning for it`,
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
  let chatGPTResponse: ChatGPTResponse;
  try {
    const args = completion.choices[0].message.function_call?.arguments;
    if (args === undefined) {
      throw new Error("Error: ChatGPT function arguments undefined.");
    }
    chatGPTResponse = ChatGPTResponseSchema.parse(JSON.parse(args));
  } catch (err: unknown) {
    console.error(
      "Error: Response form ChatGPT does not have the expected format!",
    );
    throw err;
  }
  return {
    ...chatGPTResponse,
    word,
  };
}
